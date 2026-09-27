mod databases;
mod installed_mods;
mod path_detection;
mod sorting;
mod steam_preview;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            databases::download_database,
            path_detection::detect_rimworld_paths,
            path_detection::load_path_settings,
            path_detection::save_path_settings,
            path_detection::load_startup_mod_list,
            installed_mods::list_installed_mods,
            steam_preview::fetch_steam_mod_details,
            sorting::sort_active_mods,
            path_detection::save_mod_list,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
