use std::fs;
use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager};

use super::model::PathSettings;
pub(crate) fn load_path_settings(app: AppHandle) -> Result<PathSettings, String> {
    load_path_settings_for_app(&app)
}

pub(crate) fn load_path_settings_for_app(app: &AppHandle) -> Result<PathSettings, String> {
    load_settings_file(&settings_file(app)?)
}

pub(crate) fn save_path_settings(app: AppHandle, settings: PathSettings) -> Result<(), String> {
    save_settings_file(&settings_file(&app)?, &settings)
}

fn load_settings_file(path: &Path) -> Result<PathSettings, String> {
    match fs::read_to_string(path) {
        Ok(contents) => serde_json::from_str(&contents)
            .map_err(|error| format!("Could not read saved paths: {error}")),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(PathSettings::default()),
        Err(error) => Err(format!("Could not read saved paths: {error}")),
    }
}

fn save_settings_file(path: &Path, settings: &PathSettings) -> Result<(), String> {
    let settings_directory = path
        .parent()
        .ok_or_else(|| "Could not resolve the settings directory".to_string())?;
    fs::create_dir_all(settings_directory)
        .map_err(|error| format!("Could not create the settings directory: {error}"))?;
    let contents = serde_json::to_vec_pretty(settings)
        .map_err(|error| format!("Could not encode saved paths: {error}"))?;
    fs::write(path, contents).map_err(|error| format!("Could not save paths: {error}"))
}

fn settings_file(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map(|directory| directory.join("paths.json"))
        .map_err(|error| format!("Could not resolve the settings directory: {error}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn unique_temp_directory() -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock should be after the epoch")
            .as_nanos();
        std::env::temp_dir().join(format!("path-settings-{nonce}"))
    }

    #[test]
    fn persists_path_settings_between_loads() {
        let root = unique_temp_directory();
        let settings_file = root.join("app/paths.json");
        let settings = PathSettings {
            game_path: "C:/Games/RimWorld".to_string(),
            config_path: "C:/Users/player/AppData/LocalLow/RimWorld/Config".to_string(),
            local_mods_path: "C:/Games/RimWorld/Mods".to_string(),
            workshop_path: "D:/Steam/steamapps/workshop/content/294100".to_string(),
        };

        save_settings_file(&settings_file, &settings).expect("settings should save");

        assert_eq!(load_settings_file(&settings_file), Ok(settings));
        fs::remove_dir_all(root).expect("fixture directory should be removed");
    }

    #[test]
    fn serializes_settings_with_frontend_field_names() {
        let serialized = serde_json::to_value(PathSettings {
            game_path: "game".to_string(),
            config_path: "config".to_string(),
            local_mods_path: "local".to_string(),
            workshop_path: "workshop".to_string(),
        })
        .expect("path settings should serialize");

        assert_eq!(serialized["gamePath"], "game");
        assert_eq!(serialized["configPath"], "config");
        assert_eq!(serialized["localModsPath"], "local");
        assert_eq!(serialized["workshopPath"], "workshop");
    }
}
