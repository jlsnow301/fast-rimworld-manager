use std::fs;
use std::path::{Path, PathBuf};
#[cfg(target_os = "windows")]
use std::process::Command;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PathSettings {
    pub game_path: String,
    pub config_path: String,
    pub local_mods_path: String,
    pub workshop_path: String,
}

#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectedPaths {
    pub game_path: Option<String>,
    pub config_path: Option<String>,
    pub local_mods_path: Option<String>,
    pub workshop_path: Option<String>,
}

#[tauri::command]
pub fn load_path_settings(app: AppHandle) -> Result<PathSettings, String> {
    load_settings_file(&settings_file(&app)?)
}

#[tauri::command]
pub fn save_path_settings(app: AppHandle, settings: PathSettings) -> Result<(), String> {
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

#[tauri::command]
pub fn detect_rimworld_paths() -> Result<DetectedPaths, String> {
    #[cfg(target_os = "windows")]
    {
        Ok(detect_windows_paths())
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("Automatic path detection is currently available only on Windows.".to_string())
    }
}

#[cfg(target_os = "windows")]
fn detect_windows_paths() -> DetectedPaths {
    let steam_roots = steam_roots();
    let game = find_steam_game(&steam_roots)
        .map(|(path, library)| (path, Some(library)))
        .or_else(|| find_game_in_roots(&game_search_roots()).map(|path| (path, None)));
    let config = config_directory().filter(|path| path.is_dir());
    let workshop = game
        .as_ref()
        .and_then(|(_, library)| library.as_deref())
        .and_then(workshop_directory);
    let local_mods = game
        .as_ref()
        .map(|(game_path, _)| game_path.join("Mods"))
        .filter(|path| path.is_dir());

    DetectedPaths {
        game_path: game.map(|(path, _)| path.to_string_lossy().into_owned()),
        config_path: config.map(|path| path.to_string_lossy().into_owned()),
        local_mods_path: local_mods.map(|path| path.to_string_lossy().into_owned()),
        workshop_path: workshop.map(|path| path.to_string_lossy().into_owned()),
    }
}

#[cfg(target_os = "windows")]
fn find_steam_game(steam_roots: &[PathBuf]) -> Option<(PathBuf, PathBuf)> {
    for root in steam_roots {
        let mut libraries = vec![root.clone()];
        for vdf_path in [
            root.join("config/libraryfolders.vdf"),
            root.join("steamapps/libraryfolders.vdf"),
        ] {
            if let Ok(contents) = fs::read_to_string(vdf_path) {
                libraries.extend(parse_library_paths(&contents));
            }
        }

        for library in libraries {
            let game_path = library.join("steamapps/common/RimWorld");
            if is_rimworld_installation(&game_path) {
                return Some((game_path, library));
            }
        }
    }
    None
}

#[cfg(target_os = "windows")]
fn parse_library_paths(contents: &str) -> Vec<PathBuf> {
    contents
        .lines()
        .filter_map(|line| {
            let mut quoted = line.split('"');
            let key = quoted.nth(1)?;
            if key != "path" {
                return None;
            }
            quoted
                .nth(1)
                .map(|value| PathBuf::from(value.replace("\\\\", "\\")))
        })
        .collect()
}

#[cfg(target_os = "windows")]
fn find_game_in_roots(roots: &[PathBuf]) -> Option<PathBuf> {
    for root in roots {
        let mut directories = vec![(root.clone(), 0)];
        while let Some((directory, depth)) = directories.pop() {
            if is_rimworld_installation(&directory) {
                return Some(directory);
            }
            if depth >= 2 {
                continue;
            }
            let Ok(entries) = fs::read_dir(directory) else {
                continue;
            };
            for entry in entries.flatten().take(500) {
                let Ok(file_type) = entry.file_type() else {
                    continue;
                };
                if file_type.is_dir() {
                    directories.push((entry.path(), depth + 1));
                }
            }
        }
    }
    None
}

#[cfg(target_os = "windows")]
fn is_rimworld_installation(path: &Path) -> bool {
    path.is_dir()
        && (path.join("RimWorldWin64.exe").is_file()
            || path.join("RimWorldWin.exe").is_file()
            || has_valid_version_file(path))
}

#[cfg(target_os = "windows")]
fn has_valid_version_file(path: &Path) -> bool {
    let Ok(version) = fs::read_to_string(path.join("Version.txt")) else {
        return false;
    };
    let Some(version_number) = version.lines().next().map(str::trim) else {
        return false;
    };
    let mut parts = version_number.split('.');
    matches!(
        (parts.next(), parts.next()),
        (Some(major), Some(minor))
            if !major.is_empty()
                && !minor.is_empty()
                && major.chars().all(|character| character.is_ascii_digit())
                && minor.chars().all(|character| character.is_ascii_digit())
    )
}

#[cfg(target_os = "windows")]
fn workshop_directory(library: &Path) -> Option<PathBuf> {
    let workshop = library.join("steamapps/workshop/content/294100");
    workshop.is_dir().then_some(workshop)
}

#[cfg(target_os = "windows")]
fn steam_roots() -> Vec<PathBuf> {
    let Some(home) = home_directory() else {
        return Vec::new();
    };
    let mut roots = steam_registry_path();
    roots.push(PathBuf::from(r"C:\Program Files (x86)\Steam"));
    roots.push(PathBuf::from(r"C:\Program Files\Steam"));
    roots.push(home.join("AppData/Local/Programs/Steam"));
    roots
}

#[cfg(target_os = "windows")]
fn steam_registry_path() -> Vec<PathBuf> {
    [
        r"HKLM\SOFTWARE\Wow6432Node\Valve\Steam",
        r"HKLM\SOFTWARE\Valve\Steam",
    ]
    .into_iter()
    .filter_map(|key| {
        let output = Command::new("reg.exe")
            .args(["query", key, "/v", "InstallPath"])
            .output()
            .ok()?;
        if !output.status.success() {
            return None;
        }
        parse_registry_install_path(&String::from_utf8_lossy(&output.stdout))
    })
    .collect()
}

#[cfg(target_os = "windows")]
fn parse_registry_install_path(output: &str) -> Option<PathBuf> {
    output.lines().find_map(|line| {
        let (name, value) = line.split_once("REG_SZ")?;
        (name.trim() == "InstallPath").then(|| PathBuf::from(value.trim()))
    })
}

#[cfg(target_os = "windows")]
fn game_search_roots() -> Vec<PathBuf> {
    let Some(home) = home_directory() else {
        return Vec::new();
    };
    let mut roots = vec![home.join("Games"), home.join("GOG Games")];
    roots.push(PathBuf::from(r"C:\GOG Games"));
    roots.push(PathBuf::from(r"C:\Games"));
    if let Some(program_files) = std::env::var_os("ProgramFiles") {
        roots.push(PathBuf::from(program_files).join("GOG Galaxy/Games"));
    }
    if let Some(program_files_x86) = std::env::var_os("ProgramFiles(x86)") {
        roots.push(PathBuf::from(program_files_x86).join("GOG Galaxy/Games"));
    }
    roots
}

#[cfg(target_os = "windows")]
fn config_directory() -> Option<PathBuf> {
    let home = home_directory()?;
    Some(home.join("AppData/LocalLow/Ludeon Studios/RimWorld by Ludeon Studios/Config"))
}

#[cfg(target_os = "windows")]
fn home_directory() -> Option<PathBuf> {
    std::env::var_os("USERPROFILE").map(PathBuf::from)
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
    fn finds_game_installed_in_secondary_steam_library() {
        let root = unique_temp_directory("steam-library");
        let library = root.join("SteamLibrary");
        let game = library.join("steamapps/common/RimWorld");
        fs::create_dir_all(&game).expect("fixture directory should be created");
        fs::write(game.join("RimWorldWin64.exe"), b"game")
            .expect("fixture executable should be created");
        fs::create_dir_all(root.join("config")).expect("Steam config should be created");
        fs::write(
            root.join("config/libraryfolders.vdf"),
            format!(
                "\"libraryfolders\" {{\n\t\"1\" {{\n\t\t\"path\" \"{}\"\n\t}}\n}}",
                library.display()
            ),
        )
        .expect("Steam library list should be created");

        let found = find_steam_game(std::slice::from_ref(&root));

        assert_eq!(found, Some((game, library)));
        fs::remove_dir_all(root).expect("fixture directory should be removed");
    }

    #[test]
    fn ignores_unmarked_game_directory() {
        let root = unique_temp_directory("unmarked-game");
        let game = root.join("RimWorld");
        fs::create_dir_all(&game).expect("fixture directory should be created");

        let found = find_game_in_roots(std::slice::from_ref(&root));

        assert_eq!(found, None);
        fs::remove_dir_all(root).expect("fixture directory should be removed");
    }
    #[test]
    fn persists_path_settings_between_loads() {
        let root = unique_temp_directory("path-settings");
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
    fn accepts_game_version_marker_with_numeric_version() {
        let root = unique_temp_directory("valid-version");
        fs::create_dir_all(&root).expect("fixture directory should be created");
        fs::write(root.join("Version.txt"), "1.6.4871 rev573\n")
            .expect("version marker should be created");

        assert!(is_rimworld_installation(&root));
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

    #[cfg(target_os = "windows")]
    #[test]
    fn reads_steam_install_path_from_registry_output() {
        let path = parse_registry_install_path(
            "HKEY_LOCAL_MACHINE\\SOFTWARE\\Valve\\Steam\n    InstallPath    REG_SZ    D:\\Games\\Steam\n",
        );

        assert_eq!(path, Some(PathBuf::from(r"D:\Games\Steam")));
    }
}
