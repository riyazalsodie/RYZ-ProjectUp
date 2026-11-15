pub mod archive;
pub mod autostart;
pub mod commands;
pub mod drive;
pub mod models;
pub mod scanner;
pub mod secrets;
pub mod state;
pub mod store;

use std::time::Duration;

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Emitter, Manager};

use state::AppState;

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--hidden"]),
        ))
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            let state = AppState::new(data_dir).map_err(|err| {
                std::io::Error::new(
                    std::io::ErrorKind::Other,
                    format!("Vault init failed: {err}"),
                )
            })?;
            app.manage(state);

            let show_item = MenuItem::with_id(app, "show", "Open ProjectUp", true, None::<&str>)?;
            let backup_item =
                MenuItem::with_id(app, "backup-all", "Back up all now", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit ProjectUp", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &backup_item, &quit_item])?;

            if let Some(icon) = app.default_window_icon().cloned() {
                TrayIconBuilder::new()
                    .icon(icon)
                    .tooltip("RYZ ProjectUp — Drive backups")
                    .menu(&menu)
                    .show_menu_on_left_click(false)
                    .on_menu_event(|app, event| match event.id.as_ref() {
                        "show" => show_main_window(app),
                        "backup-all" => {
                            show_main_window(app);
                            let _ = app.emit("tray-backup-all", ());
                        }
                        "quit" => app.exit(0),
                        _ => {}
                    })
                    .on_tray_icon_event(|tray, event| {
                        if let TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        } = event
                        {
                            show_main_window(tray.app_handle());
                        }
                    })
                    .build(app)?;
            }

            // A single background pass checks every project against its own
            // last snapshot. Keeping this in Rust means it still runs while
            // the window is hidden in the tray.
            let scheduler_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(Duration::from_secs(30)).await;
                loop {
                    let handle = scheduler_handle.clone();
                    let _ = tauri::async_runtime::spawn_blocking(move || {
                        commands::auto_backup_cycle(&handle);
                    })
                    .await;
                    tokio::time::sleep(Duration::from_secs(300)).await;
                }
            });

            if std::env::args().any(|arg| arg == "--hidden") {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let state = window.app_handle().state::<AppState>();
                let close_to_tray = state.lock().settings.close_to_tray;
                if close_to_tray {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
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
            commands::quit_app,
            autostart::get_autostart,
            autostart::set_autostart,
        ])
        .run(tauri::generate_context!())
        .expect("error while running RYZ ProjectUp");
}
