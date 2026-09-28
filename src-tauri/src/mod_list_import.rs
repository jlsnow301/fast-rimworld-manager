use std::fs;
use std::path::Path;

use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportedModListFile {
    pub file_name: String,
    pub contents: String,
}

#[tauri::command]
pub fn load_mod_list_file(path: String) -> Result<ImportedModListFile, String> {
    load_mod_list_file_from_path(Path::new(&path))
}

fn load_mod_list_file_from_path(path: &Path) -> Result<ImportedModListFile, String> {
    if !path
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("xml"))
    {
        return Err("Select an XML file to import a mod list.".to_string());
    }

    let contents = fs::read_to_string(path)
        .map_err(|error| format!("Could not read mod list {}: {error}", path.display()))?;
    let file_name = path
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .ok_or_else(|| "Could not determine the selected mod list file name.".to_string())?;

    Ok(ImportedModListFile {
        file_name,
        contents,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn unique_temp_directory() -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_nanos())
            .unwrap_or_default();
        std::env::temp_dir().join(format!("rimsort-import-{nonce}"))
    }

    #[test]
    fn reads_xml_and_returns_file_name_for_import() {
        let directory = unique_temp_directory();
        fs::create_dir_all(&directory).expect("fixture directory should be created");
        let path = directory.join("ModsConfig.xml");
        let contents = "<ModsConfigData><activeMods><li>Core</li></activeMods></ModsConfigData>";
        fs::write(&path, contents).expect("fixture XML should be written");

        let imported = load_mod_list_file_from_path(&path).expect("XML should load");

        assert_eq!(imported.file_name, "ModsConfig.xml");
        assert_eq!(imported.contents, contents);
        fs::remove_dir_all(directory).expect("fixture directory should be removed");
    }

    #[test]
    fn rejects_non_xml_files_before_reading_them() {
        let path = Path::new("/missing/mod-list.json");

        let result = load_mod_list_file_from_path(path);

        assert_eq!(
            result.expect_err("non-XML selection should fail"),
            "Select an XML file to import a mod list."
        );
    }
}
