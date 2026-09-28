use std::fs;
use std::path::{Path, PathBuf};

use quick_xml::events::Event;
use quick_xml::Reader;
use serde::Serialize;
use tauri::{AppHandle, Manager};

use crate::path_detection::{load_path_settings_for_app, PathSettings};

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledMod {
    pub name: String,
    pub package_id: String,
    pub description: String,
    pub published_file_id: Option<String>,
    pub load_after: Vec<String>,
    pub load_before: Vec<String>,
    pub dependencies: Vec<ModDependency>,
    pub path: String,
    pub source: String,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModDependency {
    pub package_id: String,
    pub name: String,
    pub alternative_package_ids: Vec<String>,
}

#[derive(Clone, Copy)]
enum AboutField {
    Name,
    PackageId,
    Description,
}

#[tauri::command]
pub fn list_installed_mods(app: AppHandle) -> Result<Vec<InstalledMod>, String> {
    let settings = load_path_settings_for_app(&app)?;
    let mut mods = collect_installed_mods(&settings)?;
    if let Ok(config_directory) = app.path().app_config_dir() {
        crate::mod_metadata::enrich_installed_mods(&config_directory.join("databases"), &mut mods);
    }
    Ok(mods)
}

pub(crate) fn collect_installed_mods(settings: &PathSettings) -> Result<Vec<InstalledMod>, String> {
    let mut mods = Vec::new();

    if !settings.game_path.trim().is_empty() {
        scan_mod_root(
            &PathBuf::from(&settings.game_path).join("Data"),
            "game",
            &mut mods,
        )?;
    }
    if !settings.local_mods_path.trim().is_empty() {
        scan_mod_root(Path::new(&settings.local_mods_path), "local", &mut mods)?;
    }
    if !settings.workshop_path.trim().is_empty() {
        scan_mod_root(Path::new(&settings.workshop_path), "workshop", &mut mods)?;
    }

    mods.sort_by(|left, right| {
        left.name
            .cmp(&right.name)
            .then_with(|| left.package_id.cmp(&right.package_id))
            .then_with(|| left.path.cmp(&right.path))
    });
    Ok(mods)
}

fn scan_mod_root(root: &Path, source: &str, mods: &mut Vec<InstalledMod>) -> Result<(), String> {
    let entries = match fs::read_dir(root) {
        Ok(entries) => entries,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(error) => {
            return Err(format!(
                "Could not scan mod folder {}: {error}",
                root.display()
            ))
        }
    };

    for entry in entries.flatten() {
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        if !file_type.is_dir() {
            continue;
        }

        let mod_path = entry.path();
        let about_path = mod_path.join("About/About.xml");
        let Ok(contents) = fs::read_to_string(about_path) else {
            continue;
        };
        let Some((name, package_id, description)) = parse_about_xml(&contents) else {
            continue;
        };
        let (load_after, load_before) = parse_load_order_rules(&contents);
        let dependencies = parse_mod_dependencies(&contents);
        let published_file_id = published_file_id(&mod_path);

        mods.push(InstalledMod {
            name,
            package_id,
            description,
            published_file_id,
            load_after,
            load_before,
            dependencies,
            path: mod_path.to_string_lossy().into_owned(),
            source: source.to_string(),
        });
    }

    Ok(())
}

fn parse_about_xml(xml: &str) -> Option<(String, String, String)> {
    let mut reader = Reader::from_str(xml);
    let mut current_field = None;
    let mut name = String::new();
    let mut package_id = String::new();
    let mut description = String::new();

    loop {
        match reader.read_event() {
            Ok(Event::Start(element)) => {
                let tag = element.local_name();
                current_field = if tag.as_ref().eq_ignore_ascii_case("name") {
                    Some(AboutField::Name)
                } else if tag.as_ref().eq_ignore_ascii_case("packageId") {
                    Some(AboutField::PackageId)
                } else if tag.as_ref().eq_ignore_ascii_case("description") {
                    Some(AboutField::Description)
                } else {
                    current_field
                };
            }
            Ok(Event::Text(text)) => {
                let unescaped = quick_xml::escape::unescape(text.as_ref()).ok()?;
                append_about_text(
                    current_field,
                    &unescaped,
                    &mut name,
                    &mut package_id,
                    &mut description,
                );
            }
            Ok(Event::GeneralRef(reference)) => {
                let entity = format!("&{};", reference.as_ref());
                let unescaped = quick_xml::escape::unescape(&entity).ok()?;
                append_about_text(
                    current_field,
                    &unescaped,
                    &mut name,
                    &mut package_id,
                    &mut description,
                );
            }
            Ok(Event::End(element)) => {
                let tag = element.local_name();
                if tag.as_ref().eq_ignore_ascii_case("name")
                    || tag.as_ref().eq_ignore_ascii_case("packageId")
                    || tag.as_ref().eq_ignore_ascii_case("description")
                {
                    current_field = None;
                }
            }
            Ok(Event::Eof) => break,
            Ok(_) => {}
            Err(_) => return None,
        }
    }

    let package_id = package_id.trim();
    if package_id.is_empty() {
        return None;
    }
    let name = name.trim();
    Some((
        if name.is_empty() {
            package_id.to_string()
        } else {
            name.to_string()
        },
        package_id.to_string(),
        description.trim().to_string(),
    ))
}

fn append_about_text(
    field: Option<AboutField>,
    value: &str,
    name: &mut String,
    package_id: &mut String,
    description: &mut String,
) {
    match field {
        Some(AboutField::Name) => name.push_str(value),
        Some(AboutField::PackageId) => package_id.push_str(value),
        Some(AboutField::Description) => description.push_str(value),
        None => {}
    }
}

fn published_file_id(mod_path: &Path) -> Option<String> {
    let id_file = mod_path.join("About/PublishedFileId.txt");
    if let Ok(contents) = fs::read_to_string(&id_file) {
        let id = contents.trim_start_matches('\u{feff}').trim();
        return valid_published_file_id(id);
    }

    mod_path
        .file_name()
        .and_then(|name| name.to_str())
        .and_then(valid_published_file_id)
}

fn valid_published_file_id(value: &str) -> Option<String> {
    let id = value.parse::<u64>().ok()?;
    (id > 0).then(|| value.to_string())
}

#[derive(Clone, Copy)]
enum LoadOrderRule {
    After,
    Before,
}

fn parse_load_order_rules(xml: &str) -> (Vec<String>, Vec<String>) {
    let mut reader = Reader::from_str(xml);
    let mut rule = None;
    let mut in_list_item = false;
    let mut item = String::new();
    let mut load_after = Vec::new();
    let mut load_before = Vec::new();

    loop {
        match reader.read_event() {
            Ok(Event::Start(element)) => {
                let tag = element.local_name();
                if tag.as_ref().eq_ignore_ascii_case("loadAfter") {
                    rule = Some(LoadOrderRule::After);
                } else if tag.as_ref().eq_ignore_ascii_case("loadBefore") {
                    rule = Some(LoadOrderRule::Before);
                } else if rule.is_some() && tag.as_ref().eq_ignore_ascii_case("li") {
                    in_list_item = true;
                    item.clear();
                }
            }
            Ok(Event::Text(text)) if in_list_item => {
                let Ok(text) = quick_xml::escape::unescape(text.as_ref()) else {
                    continue;
                };
                item.push_str(&text);
            }
            Ok(Event::GeneralRef(reference)) if in_list_item => {
                let entity = format!("&{};", reference.as_ref());
                let Ok(text) = quick_xml::escape::unescape(&entity) else {
                    continue;
                };
                item.push_str(&text);
            }
            Ok(Event::End(element)) => {
                let tag = element.local_name();
                if tag.as_ref().eq_ignore_ascii_case("li") && in_list_item {
                    let package_id = item.trim();
                    if !package_id.is_empty() {
                        match rule {
                            Some(LoadOrderRule::After) => load_after.push(package_id.to_string()),
                            Some(LoadOrderRule::Before) => load_before.push(package_id.to_string()),
                            None => {}
                        }
                    }
                    in_list_item = false;
                } else if tag.as_ref().eq_ignore_ascii_case("loadAfter")
                    || tag.as_ref().eq_ignore_ascii_case("loadBefore")
                {
                    rule = None;
                }
            }
            Ok(Event::Eof) | Err(_) => break,
            _ => {}
        }
    }

    (load_after, load_before)
}

#[derive(Clone, Copy)]
enum ModDependencyField {
    PackageId,
    Name,
    AlternativePackageId,
}

fn parse_mod_dependencies(xml: &str) -> Vec<ModDependency> {
    let mut reader = Reader::from_str(xml);
    let mut depth = 0usize;
    let mut dependencies_depth = None;
    let mut dependency_depth = None;
    let mut alternatives_depth = None;
    let mut alternative_item_depth = None;
    let mut field = None;
    let mut package_id = String::new();
    let mut name = String::new();
    let mut alternative_package_ids = Vec::new();
    let mut alternative_package_id = String::new();
    let mut dependencies = Vec::new();

    loop {
        match reader.read_event() {
            Ok(Event::Start(element)) => {
                depth += 1;
                let tag = element.local_name();
                if tag.as_ref().eq_ignore_ascii_case("modDependencies") {
                    dependencies_depth = Some(depth);
                } else if dependencies_depth == Some(depth - 1)
                    && tag.as_ref().eq_ignore_ascii_case("li")
                {
                    dependency_depth = Some(depth);
                    package_id.clear();
                    name.clear();
                    alternative_package_ids.clear();
                } else if dependency_depth == Some(depth - 1)
                    && tag.as_ref().eq_ignore_ascii_case("alternativePackageIds")
                {
                    alternatives_depth = Some(depth);
                } else if alternatives_depth == Some(depth - 1)
                    && tag.as_ref().eq_ignore_ascii_case("li")
                {
                    alternative_item_depth = Some(depth);
                    alternative_package_id.clear();
                    field = Some(ModDependencyField::AlternativePackageId);
                } else if dependency_depth == Some(depth - 1) {
                    field = if tag.as_ref().eq_ignore_ascii_case("packageId") {
                        Some(ModDependencyField::PackageId)
                    } else if tag.as_ref().eq_ignore_ascii_case("displayName") {
                        Some(ModDependencyField::Name)
                    } else {
                        None
                    };
                }
            }
            Ok(Event::Text(text)) => {
                if let Ok(text) = quick_xml::escape::unescape(text.as_ref()) {
                    append_dependency_text(
                        field,
                        &text,
                        &mut package_id,
                        &mut name,
                        &mut alternative_package_id,
                    );
                }
            }
            Ok(Event::GeneralRef(reference)) => {
                let entity = format!("&{};", reference.as_ref());
                if let Ok(text) = quick_xml::escape::unescape(&entity) {
                    append_dependency_text(
                        field,
                        &text,
                        &mut package_id,
                        &mut name,
                        &mut alternative_package_id,
                    );
                }
            }
            Ok(Event::End(element)) => {
                let tag = element.local_name();
                if alternative_item_depth == Some(depth) && tag.as_ref().eq_ignore_ascii_case("li")
                {
                    let alternative = alternative_package_id.trim();
                    if !alternative.is_empty() {
                        alternative_package_ids.push(alternative.to_string());
                    }
                    alternative_item_depth = None;
                    field = None;
                } else if alternatives_depth == Some(depth)
                    && tag.as_ref().eq_ignore_ascii_case("alternativePackageIds")
                {
                    alternatives_depth = None;
                } else if dependency_depth == Some(depth) && tag.as_ref().eq_ignore_ascii_case("li")
                {
                    let package_id = package_id.trim();
                    if !package_id.is_empty() {
                        dependencies.push(ModDependency {
                            package_id: package_id.to_string(),
                            name: if name.trim().is_empty() {
                                package_id.to_string()
                            } else {
                                name.trim().to_string()
                            },
                            alternative_package_ids: std::mem::take(&mut alternative_package_ids),
                        });
                    }
                    dependency_depth = None;
                    field = None;
                } else if tag.as_ref().eq_ignore_ascii_case("packageId")
                    || tag.as_ref().eq_ignore_ascii_case("displayName")
                {
                    field = None;
                }
                if dependencies_depth == Some(depth)
                    && tag.as_ref().eq_ignore_ascii_case("modDependencies")
                {
                    dependencies_depth = None;
                }
                depth = depth.saturating_sub(1);
            }
            Ok(Event::Eof) | Err(_) => break,
            _ => {}
        }
    }

    dependencies
}

fn append_dependency_text(
    field: Option<ModDependencyField>,
    value: &str,
    package_id: &mut String,
    name: &mut String,
    alternative_package_id: &mut String,
) {
    match field {
        Some(ModDependencyField::PackageId) => package_id.push_str(value),
        Some(ModDependencyField::Name) => name.push_str(value),
        Some(ModDependencyField::AlternativePackageId) => {
            alternative_package_id.push_str(value);
        }
        None => {}
    }
}
#[test]
fn parses_mod_dependencies_with_nested_alternative_ids() {
    let dependencies = parse_mod_dependencies(
		"<ModMetaData><modDependencies><li><packageId>Author.Framework</packageId><alternativePackageIds><li>Author.Framework.Continued</li></alternativePackageIds><displayName>Framework &amp; More</displayName></li><li><packageId>Author.Other</packageId></li></modDependencies></ModMetaData>",
	);

    assert_eq!(
        dependencies,
        vec![
            ModDependency {
                package_id: "Author.Framework".to_string(),
                name: "Framework & More".to_string(),
                alternative_package_ids: vec!["Author.Framework.Continued".to_string()],
            },
            ModDependency {
                package_id: "Author.Other".to_string(),
                name: "Author.Other".to_string(),
                alternative_package_ids: Vec::new(),
            },
        ],
    );
}

#[test]
fn parses_load_after_and_load_before_list_items() {
    let (load_after, load_before) = parse_load_order_rules(
            "<ModMetaData><loadAfter><li>Author.Framework</li></loadAfter><loadBefore><li>Author.Patch</li></loadBefore></ModMetaData>",
        );

    assert_eq!(load_after, vec!["Author.Framework"]);
    assert_eq!(load_before, vec!["Author.Patch"]);
}

#[cfg(all(test, target_os = "windows"))]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn unique_temp_directory(name: &str) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_nanos())
            .unwrap_or_default();
        std::env::temp_dir().join(format!("rimsort-{name}-{nonce}"))
    }

    #[test]
    fn lists_about_metadata_from_game_local_and_workshop_folders() {
        let root = unique_temp_directory("installed-mods");
        let game = root.join("RimWorld");
        let local = root.join("Local");
        let workshop = root.join("Workshop");
        let fixtures = [
            (
                game.join("Data/Core"),
                "Core",
                "Core",
                "Ludeon.RimWorld",
                "game",
            ),
            (
                local.join("ExampleMod"),
                "Example & Mods",
                "Example &amp; Mods",
                "Author.Example",
                "local",
            ),
            (
                workshop.join("12345"),
                "Workshop Mod",
                "Workshop Mod",
                "Author.Workshop",
                "workshop",
            ),
        ];

        for (mod_path, _, xml_name, package_id, _) in &fixtures {
            let about_directory = mod_path.join("About");
            fs::create_dir_all(&about_directory).expect("About folder should be created");
            fs::write(
                about_directory.join("About.xml"),
                format!(
                    "<ModMetaData><name>{xml_name}</name><packageId>{package_id}</packageId></ModMetaData>"
                ),
            )
            .expect("About.xml should be created");
        }

        let settings = PathSettings {
            game_path: game.to_string_lossy().into_owned(),
            local_mods_path: local.to_string_lossy().into_owned(),
            workshop_path: workshop.to_string_lossy().into_owned(),
            ..PathSettings::default()
        };
        let mods = collect_installed_mods(&settings).expect("mod folders should be scanned");

        assert_eq!(mods.len(), 3);
        for (_, name, _, package_id, source) in fixtures {
            let listed = mods
                .iter()
                .find(|mod_entry| mod_entry.package_id == package_id)
                .expect("each installed package should be listed");
            assert_eq!(listed.name, name);
            assert_eq!(listed.source, source);
        }
        fs::remove_dir_all(root).expect("fixture directory should be removed");
    }

    #[test]
    fn parses_escaped_description_for_preview() {
        let parsed = parse_about_xml(
            "<ModMetaData><name>Mod &amp; More</name><packageId>Author.Mod</packageId><description>Details &amp; requirements</description></ModMetaData>",
        );

        assert_eq!(
            parsed,
            Some((
                "Mod & More".to_string(),
                "Author.Mod".to_string(),
                "Details & requirements".to_string(),
            ))
        );
    }

    #[test]
    fn reads_published_file_id_from_about_file_or_workshop_folder() {
        let root = unique_temp_directory("published-file-id");
        let local_mod = root.join("LocalMod");
        let about_directory = local_mod.join("About");
        fs::create_dir_all(&about_directory).expect("About folder should be created");
        fs::write(
            about_directory.join("PublishedFileId.txt"),
            "\u{feff} 98765\n",
        )
        .expect("PublishedFileId.txt should be created");
        let workshop_mod = root.join("12345");
        fs::create_dir_all(&workshop_mod).expect("Workshop folder should be created");

        assert_eq!(published_file_id(&local_mod).as_deref(), Some("98765"));
        assert_eq!(published_file_id(&workshop_mod).as_deref(), Some("12345"));
        fs::remove_dir_all(root).expect("fixture directory should be removed");
    }

    #[test]
    fn ignores_about_xml_without_package_id() {
        let root = unique_temp_directory("missing-package-id");
        let about_directory = root.join("Mod/About");
        fs::create_dir_all(&about_directory).expect("About folder should be created");
        fs::write(
            about_directory.join("About.xml"),
            "<ModMetaData><name>Missing ID</name></ModMetaData>",
        )
        .expect("About.xml should be created");

        let mut mods = Vec::new();
        scan_mod_root(&root, "local", &mut mods).expect("mod folder should be scanned");

        assert!(mods.is_empty());
        fs::remove_dir_all(root).expect("fixture directory should be removed");
    }
}
