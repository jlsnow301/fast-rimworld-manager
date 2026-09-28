use crate::backend::models::mods::InstalledMod;
use crate::backend::services::{installed_mods, sorting};

#[tauri::command]
pub fn list_installed_mods(app: tauri::AppHandle) -> Result<Vec<InstalledMod>, String> {
    installed_mods::list_installed_mods(app)
}

#[tauri::command]
pub fn sort_active_mods(
    app: tauri::AppHandle,
    active_mods: Vec<String>,
) -> Result<Vec<String>, String> {
    sorting::sort_active_mods(app, active_mods)
}
