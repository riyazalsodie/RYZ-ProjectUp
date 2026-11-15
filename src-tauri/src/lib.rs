pub mod archive;
pub mod commands;
pub mod drive;
pub mod models;
pub mod scanner;
pub mod secrets;
pub mod state;
pub mod store;

use tauri::Manager;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            let state = AppState::new(data_dir).map_err(|err| {
                std::io::Error::new(std::io::ErrorKind::Other, format!("Vault init failed: {err}"))
            })?;
            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_app_state,
            commands::add_project,
            commands::refresh_project,
            commands::relink_project,
            commands::remove_project,
            commands::scan_project_preview,
            commands::save_settings,
            commands::drive_connect,
            commands::cancel_drive_auth,
            commands::sync_cloud_metadata,
            commands::drive_disconnect,
            commands::run_backup,
            commands::cancel_backup,
            commands::restore_backup,
            commands::delete_backup,
            commands::open_url,
            commands::reveal_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running RYZ ProjectUp");
}
