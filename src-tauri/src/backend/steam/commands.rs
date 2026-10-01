use super::{
    api_key,
    model::{SteamModPreview, WorkshopUpdateCheckResult},
    preview, updates,
};
use crate::backend::paths::settings::load_path_settings_for_app;

#[tauri::command]
pub async fn check_outdated_mods(
    app: tauri::AppHandle,
) -> Result<WorkshopUpdateCheckResult, String> {
    let settings = load_path_settings_for_app(&app)?;
    updates::check_outdated_mods(&settings).await
}

#[tauri::command]
pub async fn fetch_steam_mod_details(
    published_file_id: String,
) -> Result<Option<SteamModPreview>, String> {
    preview::fetch_steam_mod_details(published_file_id).await
}

#[tauri::command]
pub fn save_steam_api_key(api_key: String) -> Result<(), String> {
    api_key::save_steam_api_key(api_key)
}

#[tauri::command]
pub fn remove_steam_api_key() -> Result<(), String> {
    api_key::remove_steam_api_key()
}

#[tauri::command]
pub fn steam_api_key_configured() -> Result<bool, String> {
    api_key::steam_api_key_configured()
}

#[tauri::command]
pub async fn test_steam_api_connection() -> Result<(), String> {
    api_key::test_steam_api_connection().await
}
