use super::{
    detection,
    model::{DetectedPaths, PathSettings},
    settings,
};

#[tauri::command]
pub fn load_path_settings(app: tauri::AppHandle) -> Result<PathSettings, String> {
    settings::load_path_settings(app)
}

#[tauri::command]
pub fn save_path_settings(app: tauri::AppHandle, settings: PathSettings) -> Result<(), String> {
    settings::save_path_settings(app, settings)
}

#[tauri::command]
pub fn detect_rimworld_paths() -> Result<DetectedPaths, String> {
    detection::detect_rimworld_paths()
}

#[tauri::command]
pub fn detect_rimworld_version(game_path: String) -> Result<Option<String>, String> {
    detection::detect_rimworld_version(&game_path)
}
