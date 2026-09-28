use crate::backend::models::databases::{DatabaseDownloadResult, DatabaseKind};
use crate::backend::services::databases;

#[tauri::command]
pub async fn download_database(
    app: tauri::AppHandle,
    database: DatabaseKind,
) -> Result<DatabaseDownloadResult, String> {
    databases::download_database(app, database).await
}
