use std::collections::HashMap;
use std::fs;
use std::path::Path;

use serde_json::{Map, Value};

use crate::backend::models::mods::{InstalledMod, ModDependency};

pub(crate) fn enrich_installed_mods(database_directory: &Path, mods: &mut [InstalledMod]) {
    let community_rules = read_database(&database_directory.join("communityRules.json"));
    let steam_database = read_database(&database_directory.join("steamDB.json"));
    let community_rules_by_package_id = index_community_rules(&community_rules);
    let steam_entries = steam_database
        .as_ref()
        .and_then(|database| database.get("database"))
        .and_then(Value::as_object);
    let steam_package_ids = index_steam_package_ids(steam_entries);

    for mod_entry in mods {
        if let Some(rule) =
            community_rules_by_package_id.get(&normalize_package_id(&mod_entry.package_id))
        {
            append_rule_package_ids(&mut mod_entry.load_after, rule.get("loadAfter"));
            append_rule_package_ids(&mut mod_entry.load_before, rule.get("loadBefore"));
        }

        let Some(steam_entries) = steam_entries else {
            continue;
        };
        let Some(steam_entry) = mod_entry
            .published_file_id
            .as_ref()
            .and_then(|published_file_id| steam_entries.get(published_file_id))
        else {
            continue;
        };
        let Some(dependencies) = steam_entry.get("dependencies").and_then(Value::as_object) else {
            continue;
        };

        for (published_file_id, dependency_info) in dependencies {
            let Some(package_id) = steam_package_ids.get(published_file_id) else {
                continue;
            };
            let name = dependency_name(dependency_info)
                .or_else(|| {
                    steam_entries
                        .get(published_file_id)
                        .and_then(database_entry_name)
                })
                .unwrap_or_else(|| package_id.clone());
            append_dependency(
                &mut mod_entry.dependencies,
                ModDependency {
                    package_id: package_id.clone(),
                    name,
                    alternative_package_ids: Vec::new(),
                },
            );
        }
    }
}

fn read_database(path: &Path) -> Option<Value> {
    let contents = fs::read_to_string(path).ok()?;
    serde_json::from_str(&contents).ok()
}

fn index_community_rules(database: &Option<Value>) -> HashMap<String, &Value> {
    let Some(rules) = database
        .as_ref()
        .and_then(|database| database.get("rules"))
        .and_then(Value::as_object)
    else {
        return HashMap::new();
    };

    rules
        .iter()
        .map(|(package_id, rule)| (normalize_package_id(package_id), rule))
        .collect()
}

fn index_steam_package_ids(steam_entries: Option<&Map<String, Value>>) -> HashMap<String, String> {
    let Some(steam_entries) = steam_entries else {
        return HashMap::new();
    };

    steam_entries
        .iter()
        .filter_map(|(published_file_id, entry)| {
            let package_id = entry
                .get("packageId")
                .or_else(|| entry.get("packageid"))
                .and_then(Value::as_str)?;
            (!package_id.trim().is_empty())
                .then(|| (published_file_id.clone(), package_id.trim().to_string()))
        })
        .collect()
}

fn append_rule_package_ids(target: &mut Vec<String>, value: Option<&Value>) {
    let Some(value) = value else {
        return;
    };

    match value {
        Value::Object(package_ids) => {
            for package_id in package_ids.keys() {
                append_package_id(target, package_id);
            }
        }
        Value::Array(package_ids) => {
            for package_id in package_ids.iter().filter_map(Value::as_str) {
                append_package_id(target, package_id);
            }
        }
        _ => {}
    }
}

fn append_package_id(target: &mut Vec<String>, package_id: &str) {
    if !package_id.trim().is_empty()
        && !target
            .iter()
            .any(|existing| normalize_package_id(existing) == normalize_package_id(package_id))
    {
        target.push(package_id.to_string());
    }
}

fn dependency_name(value: &Value) -> Option<String> {
    let name = match value {
        Value::Array(details) => details.first()?.as_str()?,
        Value::Object(details) => details.get("name")?.as_str()?,
        Value::String(name) => name,
        _ => return None,
    };
    (!name.trim().is_empty()).then(|| name.trim().to_string())
}

fn database_entry_name(value: &Value) -> Option<String> {
    value
        .get("steamName")
        .or_else(|| value.get("name"))
        .and_then(Value::as_str)
        .filter(|name| !name.trim().is_empty())
        .map(|name| name.trim().to_string())
}

fn append_dependency(target: &mut Vec<ModDependency>, dependency: ModDependency) {
    if !target.iter().any(|existing| {
        normalize_package_id(&existing.package_id) == normalize_package_id(&dependency.package_id)
    }) {
        target.push(dependency);
    }
}

fn normalize_package_id(package_id: &str) -> String {
    package_id.trim().to_ascii_lowercase()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn unique_temp_directory() -> std::path::PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_nanos())
            .unwrap_or_default();
        std::env::temp_dir().join(format!("fast-rimworld-manager-mod-metadata-{nonce}"))
    }

    fn installed_mod(package_id: &str, published_file_id: Option<&str>) -> InstalledMod {
        InstalledMod {
            name: package_id.to_string(),
            package_id: package_id.to_string(),
            description: String::new(),
            published_file_id: published_file_id.map(str::to_string),
            load_after: Vec::new(),
            load_before: Vec::new(),
            incompatible_with: Vec::new(),
            supported_versions: Vec::new(),
            dependencies: Vec::new(),
            path: String::new(),
            source: "workshop".to_string(),
        }
    }

    #[test]
    fn enriches_mods_from_community_rules_and_steam_database() {
        let directory = unique_temp_directory();
        fs::create_dir_all(&directory).expect("database directory should be created");
        fs::write(
            directory.join("communityRules.json"),
            r#"{"timestamp":1,"rules":{"Author.Mod":{"loadAfter":{"author.framework":{"name":["Framework"]}},"loadBefore":{"author.patch":{"name":["Patch"]}}}}}"#,
        )
        .expect("community rules should be written");
        fs::write(
            directory.join("steamDB.json"),
            r#"{"version":1,"database":{"100":{"packageId":"author.mod","dependencies":{"200":["Framework","https://workshop/200"],"300":["Core DLC","https://store/300"]}},"200":{"packageId":"author.framework","name":"Framework"},"300":{"appid":true,"packageId":"ludeon.rimworld.royalty","name":"RimWorld - Royalty"}}}"#,
        )
        .expect("Steam database should be written");
        let mut mods = [installed_mod("author.mod", Some("100"))];

        enrich_installed_mods(&directory, &mut mods);

        assert_eq!(mods[0].load_after, ["author.framework"]);
        assert_eq!(mods[0].load_before, ["author.patch"]);
        assert_eq!(
            mods[0].dependencies,
            [
                ModDependency {
                    package_id: "author.framework".to_string(),
                    name: "Framework".to_string(),
                    alternative_package_ids: Vec::new(),
                },
                ModDependency {
                    package_id: "ludeon.rimworld.royalty".to_string(),
                    name: "Core DLC".to_string(),
                    alternative_package_ids: Vec::new(),
                },
            ]
        );
        fs::remove_dir_all(directory).expect("database directory should be removed");
    }

    #[test]
    fn malformed_or_missing_databases_leave_mod_metadata_unchanged() {
        let directory = unique_temp_directory();
        fs::create_dir_all(&directory).expect("database directory should be created");
        fs::write(directory.join("communityRules.json"), "{")
            .expect("invalid community rules should be written");
        let mut mods = [installed_mod("author.mod", Some("100"))];

        enrich_installed_mods(&directory, &mut mods);

        assert!(mods[0].load_after.is_empty());
        assert!(mods[0].load_before.is_empty());
        assert!(mods[0].dependencies.is_empty());
        fs::remove_dir_all(directory).expect("database directory should be removed");
    }
}
