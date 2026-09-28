use crate::backend::models::mod_lists::{ImportedModListFile, SaveModListArgs};
use crate::backend::services::{mod_list_import, path_detection};

#[tauri::command]
pub fn load_mod_list_file(path: String) -> Result<ImportedModListFile, String> {
    mod_list_import::load_mod_list_file(path)
}

#[tauri::command]
pub fn load_startup_mod_list(app: tauri::AppHandle) -> Result<Option<String>, String> {
    path_detection::load_startup_mod_list(app)
}

#[tauri::command]
pub fn save_mod_list(app: tauri::AppHandle, args: SaveModListArgs) -> Result<String, String> {
    path_detection::save_mod_list(app, args)
}
