use std::fs;
use std::path::{Path, PathBuf};

use quick_xml::events::Event;
use quick_xml::Reader;
use serde::Serialize;
use tauri::AppHandle;

use crate::path_detection::{load_path_settings_for_app, PathSettings};

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledMod {
    pub name: String,
    pub package_id: String,
    pub path: String,
    pub source: String,
}

#[derive(Clone, Copy, PartialEq)]
enum AboutField {
    Name,
    PackageId,
}

#[tauri::command]
pub fn list_installed_mods(app: AppHandle) -> Result<Vec<InstalledMod>, String> {
    let settings = load_path_settings_for_app(&app)?;
    collect_installed_mods(&settings)
}

fn collect_installed_mods(settings: &PathSettings) -> Result<Vec<InstalledMod>, String> {
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
        let Some((name, package_id)) = parse_about_xml(&contents) else {
            continue;
        };

        mods.push(InstalledMod {
            name,
            package_id,
            path: mod_path.to_string_lossy().into_owned(),
            source: source.to_string(),
        });
    }

    Ok(())
}

fn parse_about_xml(xml: &str) -> Option<(String, String)> {
    let mut reader = Reader::from_str(xml);
    let mut current_field = None;
    let mut name = String::new();
    let mut package_id = String::new();

    loop {
        match reader.read_event() {
            Ok(Event::Start(element)) => {
                let tag = element.local_name();
                current_field = if tag.as_ref().eq_ignore_ascii_case("name") {
                    Some(AboutField::Name)
                } else if tag.as_ref().eq_ignore_ascii_case("packageId") {
                    Some(AboutField::PackageId)
                } else {
                    current_field
                };
            }
            Ok(Event::Text(text)) => {
                let unescaped = quick_xml::escape::unescape(text.as_ref()).ok()?;
                append_about_text(current_field, &unescaped, &mut name, &mut package_id);
            }
            Ok(Event::GeneralRef(reference)) => {
                let entity = format!("&{};", reference.as_ref());
                let unescaped = quick_xml::escape::unescape(&entity).ok()?;
                append_about_text(current_field, &unescaped, &mut name, &mut package_id);
            }
            Ok(Event::End(element)) => {
                let tag = element.local_name();
                if tag.as_ref().eq_ignore_ascii_case("name")
                    || tag.as_ref().eq_ignore_ascii_case("packageId")
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
    ))
}

fn append_about_text(
    field: Option<AboutField>,
    value: &str,
    name: &mut String,
    package_id: &mut String,
) {
    match field {
        Some(AboutField::Name) => name.push_str(value),
        Some(AboutField::PackageId) => package_id.push_str(value),
        None => {}
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
