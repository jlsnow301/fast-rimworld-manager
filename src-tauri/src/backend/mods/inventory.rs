use std::fs;
use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager};

use super::about_xml::{
    parse_about_rules, parse_about_xml, parse_mod_dependencies, parse_xml_list, ParsedAboutXml,
};
use super::metadata;
use super::model::InstalledMod;
use crate::backend::paths::{model::PathSettings, settings::load_path_settings_for_app};

const RIMWORLD_GAME_CONTENT_NAMES: &[(&str, &str)] = &[
    ("ludeon.rimworld", "Core"),
    ("ludeon.rimworld.royalty", "RimWorld - Royalty"),
    ("ludeon.rimworld.ideology", "RimWorld - Ideology"),
    ("ludeon.rimworld.biotech", "RimWorld - Biotech"),
    ("ludeon.rimworld.anomaly", "RimWorld - Anomaly"),
    ("ludeon.rimworld.odyssey", "RimWorld - Odyssey"),
];

pub(crate) fn list_installed_mods(
    app: AppHandle,
    game_version: String,
) -> Result<Vec<InstalledMod>, String> {
    let settings = load_path_settings_for_app(&app)?;
    let mut mods = collect_installed_mods(&settings)?;
    if let Ok(config_directory) = app.path().app_config_dir() {
        metadata::enrich_installed_mods(
            &config_directory.join("databases"),
            &mut mods,
            &game_version,
        );
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
        let Some(ParsedAboutXml {
            name,
            author,
            package_id,
            description,
            mod_version,
        }) = parse_about_xml(&contents)
        else {
            continue;
        };
        let name = if source == "game" && name.eq_ignore_ascii_case(&package_id) {
            RIMWORLD_GAME_CONTENT_NAMES
                .iter()
                .find_map(|(known_id, name)| {
                    package_id.eq_ignore_ascii_case(known_id).then_some(*name)
                })
                .unwrap_or(&name)
                .to_string()
        } else {
            name
        };
        let parsed_rules = parse_about_rules(&contents);
        let supported_versions = parse_xml_list(&contents, "supportedVersions");
        let dependencies = parse_mod_dependencies(&contents);
        let published_file_id = published_file_id(&mod_path);

        mods.push(InstalledMod {
            name,
            author,
            mod_version,
            package_id,
            description,
            published_file_id,
            load_top: false,
            load_bottom: false,
            load_after: parsed_rules.load_after,
            load_before: parsed_rules.load_before,
            incompatible_with: parsed_rules.incompatible_with,
            supported_versions,
            version_warning_silenced: false,
            dependencies,
            path: mod_path.to_string_lossy().into_owned(),
            source: source.to_string(),
        });
    }

    Ok(())
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
        std::env::temp_dir().join(format!("fast-rimworld-manager-{name}-{nonce}"))
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
					"<ModMetaData><name>{xml_name}</name><packageId>{package_id}</packageId><supportedVersions><li>1.6</li></supportedVersions><modVersion>2.3.4</modVersion></ModMetaData>"
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
            assert_eq!(listed.mod_version.as_deref(), Some("2.3.4"));
            let serialized = serde_json::to_value(listed).expect("installed mod should serialize");
            assert_eq!(serialized["modVersion"], "2.3.4");
            assert_eq!(listed.supported_versions, ["1.6"]);
        }
        fs::remove_dir_all(root).expect("fixture directory should be removed");
    }

    #[test]
    fn gives_core_and_dlc_readable_names_when_about_xml_omits_names() {
        let root = unique_temp_directory("vanilla-content-names");
        let game_data = root.join("Data");
        let entries = [
            ("Core", "Ludeon.RimWorld", "Core"),
            ("Royalty", "Ludeon.RimWorld.Royalty", "RimWorld - Royalty"),
            (
                "Ideology",
                "Ludeon.RimWorld.Ideology",
                "RimWorld - Ideology",
            ),
            ("Biotech", "Ludeon.RimWorld.Biotech", "RimWorld - Biotech"),
            ("Anomaly", "Ludeon.RimWorld.Anomaly", "RimWorld - Anomaly"),
            ("Odyssey", "Ludeon.RimWorld.Odyssey", "RimWorld - Odyssey"),
        ];

        for (directory, package_id, _) in entries {
            let about_directory = game_data.join(directory).join("About");
            fs::create_dir_all(&about_directory).expect("About folder should be created");
            fs::write(
                about_directory.join("About.xml"),
                format!("<ModMetaData><packageId>{package_id}</packageId></ModMetaData>"),
            )
            .expect("About.xml should be created");
        }

        let settings = PathSettings {
            game_path: root.to_string_lossy().into_owned(),
            ..PathSettings::default()
        };
        let mods = collect_installed_mods(&settings).expect("game data should be scanned");
        let mut expected: Vec<_> = entries
            .iter()
            .map(|(_, package_id, name)| (*name, *package_id, "game"))
            .collect();
        expected.sort();
        let mut actual: Vec<_> = mods
            .iter()
            .map(|mod_entry| {
                (
                    mod_entry.name.as_str(),
                    mod_entry.package_id.as_str(),
                    mod_entry.source.as_str(),
                )
            })
            .collect();
        actual.sort();

        assert_eq!(actual, expected);
        fs::remove_dir_all(root).expect("fixture directory should be removed");
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
