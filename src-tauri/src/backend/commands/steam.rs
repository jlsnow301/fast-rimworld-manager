use crate::backend::models::steam::SteamModPreview;
use crate::backend::services::{steam_api, steam_preview};

#[tauri::command]
pub async fn fetch_steam_mod_details(
    published_file_id: String,
) -> Result<Option<SteamModPreview>, String> {
    steam_preview::fetch_steam_mod_details(published_file_id).await
}
#[tauri::command]
pub fn save_steam_api_key(api_key: String) -> Result<(), String> {
    steam_api::save_steam_api_key(api_key)
}

#[tauri::command]
pub fn remove_steam_api_key() -> Result<(), String> {
    steam_api::remove_steam_api_key()
}

#[tauri::command]
pub fn steam_api_key_configured() -> Result<bool, String> {
    steam_api::steam_api_key_configured()
}

#[tauri::command]
pub async fn test_steam_api_connection() -> Result<(), String> {
    steam_api::test_steam_api_connection().await
}
