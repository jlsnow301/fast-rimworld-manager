use crate::backend::models::steam::SteamModPreview;
use crate::backend::services::steam_preview;

#[tauri::command]
pub async fn fetch_steam_mod_details(
    published_file_id: String,
) -> Result<Option<SteamModPreview>, String> {
    steam_preview::fetch_steam_mod_details(published_file_id).await
}
