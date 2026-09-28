mod backend;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            backend::commands::databases::download_database,
            backend::commands::paths::detect_rimworld_paths,
            backend::commands::paths::load_path_settings,
            backend::commands::paths::save_path_settings,
            backend::commands::mod_lists::load_startup_mod_list,
            backend::commands::mods::list_installed_mods,
            backend::commands::steam::fetch_steam_mod_details,
            backend::commands::steam::check_outdated_mods,
            backend::commands::steam::save_steam_api_key,
            backend::commands::steam::remove_steam_api_key,
            backend::commands::steam::steam_api_key_configured,
            backend::commands::steam::test_steam_api_connection,
            backend::commands::mods::sort_active_mods,
            backend::commands::mod_lists::load_mod_list_file,
            backend::commands::mod_lists::save_mod_list,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
