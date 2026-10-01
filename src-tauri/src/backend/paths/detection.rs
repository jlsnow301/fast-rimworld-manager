use std::fs;
use std::path::{Path, PathBuf};
#[cfg(target_os = "windows")]
use std::process::Command;

use crate::backend::paths::model::DetectedPaths;

pub(crate) fn detect_rimworld_version(game_path: &str) -> Result<Option<String>, String> {
    let version_path = Path::new(game_path).join("Version.txt");
    match fs::read_to_string(&version_path) {
        Ok(contents) => Ok(parse_rimworld_version(&contents)),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(format!(
            "Could not read RimWorld version at {}: {error}",
            version_path.display()
        )),
    }
}

fn parse_rimworld_version(contents: &str) -> Option<String> {
    let version = contents
        .trim_start_matches('\u{feff}')
        .lines()
        .next()?
        .trim();
    let mut components = version.split('.');
    let major = components.next()?;
    let minor = components.next()?;
    if major.is_empty()
        || minor.is_empty()
        || !major.chars().all(|character| character.is_ascii_digit())
        || !minor.chars().all(|character| character.is_ascii_digit())
    {
        return None;
    }
    Some(version.to_string())
}

fn normalize_windows_path(path: &str) -> String {
    path.replace('/', "\\")
}

fn detected_path(path: &Path) -> String {
    normalize_windows_path(&path.to_string_lossy())
}

#[cfg(test)]
mod windows_path_tests {
    use super::normalize_windows_path;

    #[test]
    fn normalizes_mixed_path_separators_to_backslashes() {
        assert_eq!(
            normalize_windows_path(r"C:\Games/Steam\steamapps/RimWorld"),
            r"C:\Games\Steam\steamapps\RimWorld",
        );
    }
}

pub(crate) fn detect_rimworld_paths() -> Result<DetectedPaths, String> {
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
        game_path: game.map(|(path, _)| detected_path(&path)),
        config_path: config.map(|path| detected_path(&path)),
        local_mods_path: local_mods.map(|path| detected_path(&path)),
        workshop_path: workshop.map(|path| detected_path(&path)),
    }
}
#[cfg(test)]
mod path_format_tests {
    use super::detected_path;
    use std::path::Path;

    #[test]
    fn detected_path_uses_windows_separators_consistently() {
        assert_eq!(
            detected_path(Path::new(r"C:\Games/Steam\steamapps/RimWorld")),
            r"C:\Games\Steam\steamapps\RimWorld",
        );
    }

    #[test]
    fn detected_unc_path_keeps_its_network_root() {
        assert_eq!(
            detected_path(Path::new("//server/share\\RimWorld")),
            "\\\\server\\share\\RimWorld",
        );
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
                .map(|value| PathBuf::from(normalize_windows_path(&value.replace("\\\\", "\\"))))
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
    fs::read_to_string(path.join("Version.txt"))
        .is_ok_and(|contents| parse_rimworld_version(&contents).is_some())
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
        (name.trim() == "InstallPath").then(|| PathBuf::from(normalize_windows_path(value.trim())))
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

#[cfg(test)]
mod version_tests {
    use super::*;

    #[test]
    fn parses_rimworld_version_with_revision_suffix() {
        assert_eq!(
            parse_rimworld_version("\u{feff}1.6.4871 rev573\n"),
            Some("1.6.4871 rev573".to_string()),
        );
    }

    #[test]
    fn rejects_non_numeric_major_and_minor_versions() {
        assert_eq!(parse_rimworld_version("version 1.6"), None);
        assert_eq!(parse_rimworld_version("1.beta.4871"), None);
    }

    #[test]
    fn detects_version_from_game_install_folder() {
        use std::time::{SystemTime, UNIX_EPOCH};

        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock should be after the epoch")
            .as_nanos();
        let game_path = std::env::temp_dir().join(format!("rimworld-version-{nonce}"));
        fs::create_dir_all(&game_path).expect("game folder should be created");
        fs::write(game_path.join("Version.txt"), "1.5.4104 rev123\n")
            .expect("version marker should be written");

        let version = detect_rimworld_version(game_path.to_str().expect("path should be UTF-8"))
            .expect("version file should be readable");

        assert_eq!(version, Some("1.5.4104 rev123".to_string()));
        fs::remove_dir_all(game_path).expect("game folder should be removed");
    }

    #[test]
    fn missing_version_marker_returns_none() {
        use std::time::{SystemTime, UNIX_EPOCH};

        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock should be after the epoch")
            .as_nanos();
        let game_path = std::env::temp_dir().join(format!("missing-rimworld-version-{nonce}"));
        assert_eq!(
            detect_rimworld_version(game_path.to_str().expect("path should be UTF-8"))
                .expect("missing Version.txt is not an error"),
            None,
        );
    }
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
    fn normalizes_mixed_separators_in_steam_library_vdf() {
        let paths = parse_library_paths(
            r#""libraryfolders"
		{
			"1"
			{
				"path" "D:/Steam\Library"
			}
		}"#,
        );

        assert_eq!(paths, vec![PathBuf::from(r"D:\Steam\Library")]);
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
    fn accepts_game_version_marker_with_numeric_version() {
        let root = unique_temp_directory("valid-version");
        fs::create_dir_all(&root).expect("fixture directory should be created");
        fs::write(root.join("Version.txt"), "1.6.4871 rev573\n")
            .expect("version marker should be created");

        assert!(is_rimworld_installation(&root));
        fs::remove_dir_all(root).expect("fixture directory should be removed");
    }

    #[test]
    fn reads_steam_install_path_from_registry_output() {
        let path = parse_registry_install_path(
            "HKEY_LOCAL_MACHINE\\SOFTWARE\\Valve\\Steam\n    InstallPath    REG_SZ    D:/Games\\Steam\n",
        );

        assert_eq!(path, Some(PathBuf::from(r"D:\Games\Steam")));
    }
}
