use super::{
    config, import,
    model::{ImportedModListFile, SaveModListArgs},
};

#[tauri::command]
pub fn load_mod_list_file(path: String) -> Result<ImportedModListFile, String> {
    import::load_mod_list_file(path)
}

#[tauri::command]
pub fn load_startup_mod_list(app: tauri::AppHandle) -> Result<Option<String>, String> {
    config::load_startup_mod_list(app)
}

#[tauri::command]
pub fn save_mod_list(app: tauri::AppHandle, args: SaveModListArgs) -> Result<String, String> {
    config::save_mod_list(app, args)
}
