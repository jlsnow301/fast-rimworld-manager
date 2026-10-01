use std::fs;
use std::path::{Path, PathBuf};

use tauri::AppHandle;

use super::model::SaveModListArgs;
use crate::backend::paths::{model::PathSettings, settings::load_path_settings_for_app};
pub(crate) fn load_startup_mod_list(app: AppHandle) -> Result<Option<String>, String> {
    let settings = load_path_settings_for_app(&app)?;
    load_configured_mod_list(&settings)
}

fn load_configured_mod_list(settings: &PathSettings) -> Result<Option<String>, String> {
    read_mods_config(&settings.config_path)
}

fn read_mods_config(config_path: &str) -> Result<Option<String>, String> {
    if config_path.trim().is_empty() {
        return Ok(None);
    }

    let mods_config = PathBuf::from(config_path).join("ModsConfig.xml");
    match fs::read_to_string(&mods_config) {
        Ok(contents) => Ok(Some(contents)),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(format!(
            "Could not read ModsConfig.xml at {}: {error}",
            mods_config.display()
        )),
    }
}

pub(crate) fn save_mod_list(app: AppHandle, args: SaveModListArgs) -> Result<String, String> {
    let settings = load_path_settings_for_app(&app)?;
    save_configured_mod_list(&settings.config_path, &args)
}

fn save_configured_mod_list(config_path: &str, args: &SaveModListArgs) -> Result<String, String> {
    if config_path.trim().is_empty() {
        return Err("Set the RimWorld config folder in Settings before saving.".to_string());
    }
    let config_directory = Path::new(config_path);
    if !config_directory.is_dir() {
        return Err(format!(
            "RimWorld config folder does not exist: {}",
            config_directory.display()
        ));
    }
    let mods_config_path = config_directory.join("ModsConfig.xml");
    fs::write(&mods_config_path, serialize_mods_config(args))
        .map_err(|error| format!("Could not save {}: {error}", mods_config_path.display()))?;
    Ok(mods_config_path.to_string_lossy().into_owned())
}

fn serialize_mods_config(args: &SaveModListArgs) -> String {
    let mut xml =
        String::from("<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<ModsConfigData>\n  <version>");
    xml.push_str(&quick_xml::escape::escape(&args.version));
    xml.push_str("</version>\n  <activeMods>");
    for package_id in &args.active_mods {
        xml.push_str("\n    <li>");
        xml.push_str(&quick_xml::escape::escape(package_id));
        xml.push_str("</li>");
    }
    xml.push_str("\n  </activeMods>\n  <knownExpansions>");
    for expansion in &args.known_expansions {
        xml.push_str("\n    <li>");
        xml.push_str(&quick_xml::escape::escape(expansion));
        xml.push_str("</li>");
    }
    xml.push_str("\n  </knownExpansions>\n</ModsConfigData>");
    xml
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn unique_temp_directory(name: &str) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock should be after the epoch")
            .as_nanos();
        std::env::temp_dir().join(format!("mod-list-config-{name}-{nonce}"))
    }

    #[test]
    fn reads_mods_config_from_the_configured_folder() {
        let root = unique_temp_directory("read");
        let config_directory = root.join("RimWorld/Config");
        fs::create_dir_all(&config_directory).expect("config folder should be created");
        let xml =
            "<ModsConfigData><activeMods><li>Ludeon.RimWorld</li></activeMods></ModsConfigData>";
        fs::write(config_directory.join("ModsConfig.xml"), xml)
            .expect("ModsConfig.xml should be written");
        let settings = PathSettings {
            config_path: config_directory.to_string_lossy().into_owned(),
            ..PathSettings::default()
        };

        let loaded =
            load_configured_mod_list(&settings).expect("configured mod list should be readable");

        assert_eq!(loaded.as_deref(), Some(xml));
        fs::remove_dir_all(root).expect("fixture directory should be removed");
    }

    #[test]
    fn returns_no_mod_list_when_config_file_is_missing() {
        let config_directory = unique_temp_directory("missing-config");
        fs::create_dir_all(&config_directory).expect("config folder should be created");

        assert_eq!(
            read_mods_config(config_directory.to_str().expect("path should be UTF-8")),
            Ok(None)
        );
        fs::remove_dir_all(config_directory).expect("fixture directory should be removed");
    }

    #[test]
    fn returns_no_mod_list_when_config_path_is_empty() {
        assert_eq!(read_mods_config(""), Ok(None));
    }

    #[test]
    fn saves_active_order_version_and_expansions_to_config_folder() {
        let root = unique_temp_directory("save-mod-list");
        fs::create_dir_all(&root).expect("config folder should be created");
        let args = SaveModListArgs {
            version: "1.6&test".to_string(),
            active_mods: vec!["Ludeon.RimWorld".to_string(), "Author.Mod&Name".to_string()],
            known_expansions: vec!["Ludeon.RimWorld".to_string()],
        };

        let saved_path =
            save_configured_mod_list(root.to_str().expect("path should be UTF-8"), &args)
                .expect("mod list should save");
        let saved_contents = fs::read_to_string(&saved_path).expect("saved config should read");

        assert_eq!(
            saved_contents,
            "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<ModsConfigData>\n  <version>1.6&amp;test</version>\n  <activeMods>\n    <li>Ludeon.RimWorld</li>\n    <li>Author.Mod&amp;Name</li>\n  </activeMods>\n  <knownExpansions>\n    <li>Ludeon.RimWorld</li>\n  </knownExpansions>\n</ModsConfigData>"
        );
        fs::remove_dir_all(root).expect("fixture directory should be removed");
    }

    #[test]
    fn rejects_save_without_a_config_folder() {
        let error = save_configured_mod_list(
            "",
            &SaveModListArgs {
                version: "1.6".to_string(),
                active_mods: Vec::new(),
                known_expansions: Vec::new(),
            },
        )
        .expect_err("empty config folder should not save");

        assert_eq!(
            error,
            "Set the RimWorld config folder in Settings before saving."
        );
    }

    #[test]
    fn reports_missing_config_folder_without_writing_elsewhere() {
        let config_directory = unique_temp_directory("missing-save-folder");
        let error = save_configured_mod_list(
            config_directory.to_str().expect("path should be UTF-8"),
            &SaveModListArgs {
                version: "1.6".to_string(),
                active_mods: Vec::new(),
                known_expansions: Vec::new(),
            },
        )
        .expect_err("missing config folder should fail");

        assert!(error.contains("RimWorld config folder does not exist"));
    }
}
