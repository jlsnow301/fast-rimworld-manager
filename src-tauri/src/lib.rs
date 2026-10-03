mod backend;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            backend::databases::commands::download_database,
            backend::databases::commands::list_database_statuses,
            backend::paths::commands::detect_rimworld_paths,
            backend::paths::commands::detect_rimworld_version,
            backend::paths::commands::load_path_settings,
            backend::paths::commands::save_path_settings,
            backend::mod_lists::commands::load_startup_mod_list,
            backend::mods::commands::list_installed_mods,
            backend::steam::commands::fetch_steam_mod_details,
            backend::steam::commands::check_outdated_mods,
            backend::steam::commands::save_steam_api_key,
            backend::steam::commands::remove_steam_api_key,
            backend::steam::commands::steam_api_key_configured,
            backend::steam::commands::test_steam_api_connection,
            backend::mods::commands::sort_active_mods,
            backend::mod_lists::commands::load_mod_list_file,
            backend::mod_lists::commands::save_mod_list,
            backend::mod_lists::commands::export_active_mod_list,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
