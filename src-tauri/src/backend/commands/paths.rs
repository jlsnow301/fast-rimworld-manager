use crate::backend::models::paths::{DetectedPaths, PathSettings};
use crate::backend::services::path_detection;

#[tauri::command]
pub fn load_path_settings(app: tauri::AppHandle) -> Result<PathSettings, String> {
    path_detection::load_path_settings(app)
}

#[tauri::command]
pub fn save_path_settings(app: tauri::AppHandle, settings: PathSettings) -> Result<(), String> {
    path_detection::save_path_settings(app, settings)
}

#[tauri::command]
pub fn detect_rimworld_paths() -> Result<DetectedPaths, String> {
    path_detection::detect_rimworld_paths()
}
