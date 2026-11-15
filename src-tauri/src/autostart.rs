use tauri::AppHandle;

#[cfg(not(target_os = "windows"))]
use tauri_plugin_autostart::ManagerExt;

#[cfg(target_os = "windows")]
const RUN_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";
#[cfg(target_os = "windows")]
const VALUE_NAME: &str = "RYZ ProjectUp";

#[cfg(target_os = "windows")]
fn startup_command(exe: &std::path::Path) -> String {
    // Quote the path: the per-user install directory contains spaces.
    format!("\"{}\" --hidden", exe.display())
}

/// Read the startup registration. Windows uses a per-user Run entry directly
/// so the executable path can be quoted correctly even when it contains spaces.
#[tauri::command]
pub fn get_autostart(app: AppHandle) -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        let _ = app;
        match windows_registry::CURRENT_USER.open(RUN_KEY) {
            Ok(key) => Ok(key.get_string(VALUE_NAME).is_ok()),
            Err(_) => Ok(false),
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        app.autolaunch()
            .is_enabled()
            .map_err(|err| format!("Could not read the startup setting: {err}"))
    }
}

#[tauri::command]
pub fn set_autostart(app: AppHandle, enabled: bool) -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        let _ = app;
        let key = windows_registry::CURRENT_USER
            .create(RUN_KEY)
            .map_err(|err| format!("Could not open the startup registry key: {err}"))?;

        if enabled {
            let exe = std::env::current_exe()
                .map_err(|err| format!("Could not locate the ProjectUp executable: {err}"))?;
            key.set_string(VALUE_NAME, &startup_command(&exe))
                .map_err(|err| format!("Could not enable startup launch: {err}"))?;
            Ok(true)
        } else {
            let _ = key.remove_value(VALUE_NAME);
            let still_enabled = windows_registry::CURRENT_USER
                .open(RUN_KEY)
                .and_then(|key| key.get_string(VALUE_NAME))
                .is_ok();
            if still_enabled {
                return Err("Could not remove the startup registration.".to_string());
            }
            Ok(false)
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        if enabled {
            app.autolaunch()
                .enable()
                .map_err(|err| format!("Could not enable startup launch: {err}"))?;
        } else {
            app.autolaunch()
                .disable()
                .map_err(|err| format!("Could not disable startup launch: {err}"))?;
        }
        app.autolaunch()
            .is_enabled()
            .map_err(|err| format!("Could not verify the startup setting: {err}"))
    }
}

#[cfg(all(test, target_os = "windows"))]
mod tests {
    use super::*;
    use std::path::Path;

    #[test]
    fn startup_command_quotes_paths_with_spaces() {
        let command = startup_command(Path::new(
            r"C:\Users\Example\AppData\Local\Programs\RYZ ProjectUp\RYZ ProjectUp.exe",
        ));
        assert_eq!(
            command,
            r#""C:\Users\Example\AppData\Local\Programs\RYZ ProjectUp\RYZ ProjectUp.exe" --hidden"#
        );
    }
}
