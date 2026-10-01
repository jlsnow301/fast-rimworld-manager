use super::{
    model::{DatabaseDownloadResult, DatabaseFileStatus, DatabaseKind},
    service,
};

#[tauri::command]
pub async fn download_database(
    app: tauri::AppHandle,
    database: DatabaseKind,
) -> Result<DatabaseDownloadResult, String> {
    service::download_database(app, database).await
}

#[tauri::command]
pub fn list_database_statuses(app: tauri::AppHandle) -> Result<Vec<DatabaseFileStatus>, String> {
    service::list_database_statuses(app)
}
