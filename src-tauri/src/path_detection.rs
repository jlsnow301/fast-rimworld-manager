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
    load_path_settings_for_app(&app)
}

pub(crate) fn load_path_settings_for_app(app: &AppHandle) -> Result<PathSettings, String> {
    load_settings_file(&settings_file(app)?)
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
pub fn load_startup_mod_list(app: AppHandle) -> Result<Option<String>, String> {
    load_configured_mod_list(&settings_file(&app)?)
}

fn load_configured_mod_list(settings_file: &Path) -> Result<Option<String>, String> {
    let settings = load_settings_file(settings_file)?;
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

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveModListArgs {
    pub version: String,
    pub active_mods: Vec<String>,
    pub known_expansions: Vec<String>,
}

#[tauri::command]
pub fn save_mod_list(app: AppHandle, args: SaveModListArgs) -> Result<String, String> {
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
    fn loads_mods_config_from_the_persisted_config_folder() {
        let root = unique_temp_directory("startup-modlist");
        let settings_file = root.join("app/paths.json");
        let config_directory = root.join("RimWorld/Config");
        fs::create_dir_all(&config_directory).expect("config directory should be created");
        let xml =
            "<ModsConfigData><activeMods><li>Ludeon.RimWorld</li></activeMods></ModsConfigData>";
        fs::write(config_directory.join("ModsConfig.xml"), xml)
            .expect("ModsConfig.xml should be created");
        let settings = PathSettings {
            config_path: config_directory.to_string_lossy().into_owned(),
            ..PathSettings::default()
        };
        save_settings_file(&settings_file, &settings).expect("path settings should save");

        let loaded = load_configured_mod_list(&settings_file)
            .expect("configured mod list should be readable");

        assert_eq!(loaded.as_deref(), Some(xml));
        fs::remove_dir_all(root).expect("fixture directory should be removed");
    }

    #[test]
    fn returns_no_modlist_when_config_file_is_missing() {
        let config_directory = unique_temp_directory("missing-config");
        fs::create_dir_all(&config_directory).expect("config directory should be created");

        assert_eq!(
            read_mods_config(config_directory.to_str().expect("path should be UTF-8")),
            Ok(None)
        );
        fs::remove_dir_all(config_directory).expect("fixture directory should be removed");
    }

    #[test]
    fn returns_no_modlist_when_config_path_is_empty() {
        assert_eq!(read_mods_config(""), Ok(None));
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
