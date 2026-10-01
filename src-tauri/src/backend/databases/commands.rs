use super::{
    model::{DatabaseDownloadResult, DatabaseKind},
    service,
};

#[tauri::command]
pub async fn download_database(
    app: tauri::AppHandle,
    database: DatabaseKind,
) -> Result<DatabaseDownloadResult, String> {
    service::download_database(app, database).await
}
