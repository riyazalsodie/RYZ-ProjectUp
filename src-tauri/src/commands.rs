use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Instant;

use chrono::{DateTime, Local};
use tauri::{AppHandle, Emitter, Manager, State};
use uuid::Uuid;

use crate::archive;
use crate::drive::{self, DriveClient};
use crate::models::{
    now_iso, AppSnapshot, AutoBackupEvent, BackupProgressEvent, BackupRecord, DriveStatus, Project,
    ProjectView, RestoreProgressEvent, RestoreResult, ScanPreview, SettingsInput,
    DEFAULT_GLOBAL_HOTKEY, MAX_AUTO_BACKUP_INTERVAL_HOURS,
};
use crate::scanner;
use crate::state::AppState;

fn app_data_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|e| format!("Could not resolve the app data directory: {e}"))
}

struct TempFileGuard(PathBuf);

impl Drop for TempFileGuard {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.0);
    }
}

fn app_data_string(app: &AppHandle) -> String {
    app_data_path(app)
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default()
}

/// A project is due when it has never been backed up, or when its newest
/// snapshot is older than the configured interval. Invalid timestamps are
/// treated as due rather than silently disabling automation.
fn is_backup_due(last_backup: Option<&str>, interval_hours: u32, now: DateTime<Local>) -> bool {
    let Some(last_backup) = last_backup else {
        return true;
    };
    let Ok(last_backup) = DateTime::parse_from_rfc3339(last_backup) else {
        return true;
    };
    let elapsed = now.signed_duration_since(last_backup.with_timezone(&Local));
    elapsed.num_seconds()
        >= interval_hours.clamp(1, MAX_AUTO_BACKUP_INTERVAL_HOURS) as i64 * 3600
}

fn sanitize_hotkey(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        DEFAULT_GLOBAL_HOTKEY.to_string()
    } else {
        trimmed.chars().take(64).collect()
    }
}

fn human_bytes(bytes: u64) -> String {
    const UNITS: [&str; 5] = ["B", "KB", "MB", "GB", "TB"];
    let mut value = bytes as f64;
    let mut unit = 0usize;
    while value >= 1024.0 && unit < UNITS.len() - 1 {
        value /= 1024.0;
        unit += 1;
    }
    if unit == 0 {
        format!("{bytes} B")
    } else {
        format!("{value:.1} {}", UNITS[unit])
    }
}

fn sanitize_folder_name(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .map(|c| {
            if c == '/' || c == '\\' || c.is_control() {
                '-'
            } else {
                c
            }
        })
        .collect();
    let trimmed = cleaned.trim().trim_end_matches('.').trim();
    if trimmed.is_empty() {
        "RYZ ProjectUp".to_string()
    } else {
        trimmed.chars().take(120).collect()
    }
}

fn sanitize_file_name(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .map(|c| {
            if c.is_control() || matches!(c, '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*') {
                '-'
            } else {
                c
            }
        })
        .collect();
    let trimmed = cleaned.trim().trim_end_matches('.').trim();
    let candidate = if trimmed.is_empty() {
        "project".to_string()
    } else {
        trimmed.chars().take(90).collect::<String>()
    };
    const RESERVED: [&str; 22] = [
        "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8",
        "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
    ];
    if RESERVED.contains(&candidate.to_uppercase().as_str()) {
        format!("_{candidate}")
    } else {
        candidate
    }
}

/// Open the Drive session, refresh the token if needed, and ensure the backup
/// folder exists. Returns the client plus folder id.
fn open_drive(state: &AppState) -> Result<(DriveClient, String), String> {
    let (settings, tokens) = {
        let inner = state.lock();
        (inner.settings.clone(), inner.tokens.clone())
    };
    let mut tokens = tokens.ok_or_else(|| {
        "Google Drive is not connected. Connect it in Settings first.".to_string()
    })?;
    if tokens.refresh_token.is_empty() && tokens.access_token.is_empty() {
        return Err("Google Drive is not connected. Connect it in Settings first.".to_string());
    }

    let access =
        drive::ensure_access_token(&mut tokens, &settings.client_id, &settings.client_secret)?;
    {
        let mut inner = state.lock();
        inner.tokens = Some(tokens.clone());
    }
    state.save_tokens()?;

    let client = DriveClient::new(access)?;
    let folder_id = client.ensure_folder(&settings.folder_name, settings.folder_id.as_deref())?;
    {
        let mut inner = state.lock();
        inner.settings.folder_id = Some(folder_id.clone());
    }
    state.save_settings()?;
    Ok((client, folder_id))
}

fn upload_cloud_metadata(state: &AppState) -> Result<(), String> {
    let (client, folder_id) = open_drive(state)?;
    let vault = state.cloud_vault();
    client.upload_vault(&folder_id, &vault)
}

fn pull_and_merge_cloud(state: &AppState) -> Result<bool, String> {
    let (client, folder_id) = open_drive(state)?;
    let remote = client.download_vault(&folder_id)?;
    let changed = match remote {
        Some(vault) => state.merge_cloud_vault(vault)?,
        None => false,
    };

    // Keep the Drive index in sync with any local-only projects or snapshots.
    let local = state.cloud_vault();
    if let Err(err) = client.upload_vault(&folder_id, &local) {
        eprintln!("Drive vault index update after merge failed: {err}");
    }
    Ok(changed)
}

fn schedule_metadata_upload(state: AppState) {
    if !state.drive_status().connected {
        return;
    }
    tauri::async_runtime::spawn_blocking(move || {
        if let Err(err) = upload_cloud_metadata(&state) {
            eprintln!("Drive vault index upload failed: {err}");
        }
    });
}

fn emit_backup(
    app: &AppHandle,
    job_id: &str,
    phase: &str,
    percent: f64,
    message: String,
    current: u64,
    total: u64,
    bytes_done: u64,
    bytes_total: u64,
) {
    let _ = app.emit(
        "backup-progress",
        BackupProgressEvent {
            job_id: job_id.to_string(),
            phase: phase.to_string(),
            percent: percent.clamp(0.0, 100.0),
            message,
            current,
            total,
            bytes_done,
            bytes_total,
        },
    );
}

fn emit_restore(app: &AppHandle, job_id: &str, phase: &str, percent: f64, message: String) {
    let _ = app.emit(
        "restore-progress",
        RestoreProgressEvent {
            job_id: job_id.to_string(),
            phase: phase.to_string(),
            percent: percent.clamp(0.0, 100.0),
            message,
        },
    );
}

#[tauri::command]
pub fn get_app_state(app: AppHandle, state: State<'_, AppState>) -> Result<AppSnapshot, String> {
    Ok(state.snapshot(&app_data_string(&app), env!("CARGO_PKG_VERSION")))
}

#[tauri::command]
pub async fn add_project(state: State<'_, AppState>, path: String) -> Result<ProjectView, String> {
    let st = (*state).clone();
    tauri::async_runtime::spawn_blocking(move || {
        let canonical =
            dunce::canonicalize(&path).map_err(|e| format!("Could not open that folder: {e}"))?;
        if !canonical.is_dir() {
            return Err("Please select a project folder, not a file.".to_string());
        }
        let path_string = canonical.to_string_lossy().to_string();
        let path_key = path_string.to_lowercase();

        {
            let inner = st.lock();
            if inner
                .projects
                .iter()
                .any(|p| p.path.to_lowercase() == path_key)
            {
                return Err("That project is already in your vault.".to_string());
            }
        }

        let name = canonical
            .file_name()
            .and_then(|value| value.to_str())
            .filter(|value| !value.trim().is_empty())
            .unwrap_or("Project")
            .to_string();

        let settings = st.lock().settings.clone();
        let cancel = Arc::new(AtomicBool::new(false));
        let stats = scanner::scan_stats(&canonical, &settings, &cancel)?;

        let mut project = AppState::new_project(name, path_string);
        project.stats = Some(stats);
        {
            let mut inner = st.lock();
            inner.projects.push(project.clone());
        }
        st.save_projects()?;
        schedule_metadata_upload(st.clone());

        let backups = st.lock().backups.clone();
        Ok(st.project_view(&project, &backups))
    })
    .await
    .map_err(|e| format!("Project scan task failed: {e}"))?
}

#[tauri::command]
pub async fn refresh_project(
    state: State<'_, AppState>,
    project_id: String,
) -> Result<ProjectView, String> {
    let st = (*state).clone();
    tauri::async_runtime::spawn_blocking(move || {
        let project = st
            .find_project(&project_id)
            .ok_or_else(|| "Project not found.".to_string())?;
        let root = PathBuf::from(&project.path);
        if !root.is_dir() {
            return Err(format!("Project folder no longer exists: {}", project.path));
        }
        let settings = st.lock().settings.clone();
        let cancel = Arc::new(AtomicBool::new(false));
        let stats = scanner::scan_stats(&root, &settings, &cancel)?;
        st.update_project_stats(&project_id, stats)?;

        let project = st
            .find_project(&project_id)
            .ok_or_else(|| "Project not found.".to_string())?;
        let backups = st.lock().backups.clone();
        Ok(st.project_view(&project, &backups))
    })
    .await
    .map_err(|e| format!("Project scan task failed: {e}"))?
}

#[tauri::command]
pub async fn relink_project(
    state: State<'_, AppState>,
    project_id: String,
    path: String,
) -> Result<ProjectView, String> {
    let st = (*state).clone();
    tauri::async_runtime::spawn_blocking(move || {
        let canonical =
            dunce::canonicalize(&path).map_err(|e| format!("Could not open that folder: {e}"))?;
        if !canonical.is_dir() {
            return Err("Please select a project folder, not a file.".to_string());
        }
        let path_string = canonical.to_string_lossy().to_string();
        let path_key = path_string.to_lowercase();

        {
            let inner = st.lock();
            if inner
                .projects
                .iter()
                .any(|p| p.id != project_id && p.path.to_lowercase() == path_key)
            {
                return Err("That folder is already linked to another project.".to_string());
            }
            if !inner.projects.iter().any(|p| p.id == project_id) {
                return Err("Project not found.".to_string());
            }
        }

        let settings = st.lock().settings.clone();
        let cancel = Arc::new(AtomicBool::new(false));
        let stats = scanner::scan_stats(&canonical, &settings, &cancel)?;

        {
            let mut inner = st.lock();
            let project = inner
                .projects
                .iter_mut()
                .find(|p| p.id == project_id)
                .ok_or_else(|| "Project not found.".to_string())?;
            project.path = path_string;
            project.stats = Some(stats);
        }
        st.save_projects()?;
        schedule_metadata_upload(st.clone());

        let project = st
            .find_project(&project_id)
            .ok_or_else(|| "Project not found.".to_string())?;
        let backups = st.lock().backups.clone();
        Ok(st.project_view(&project, &backups))
    })
    .await
    .map_err(|e| format!("Project relink task failed: {e}"))?
}

#[tauri::command]
pub fn remove_project(state: State<'_, AppState>, project_id: String) -> Result<(), String> {
    let st = (*state).clone();
    {
        let mut inner = st.lock();
        inner.projects.retain(|p| p.id != project_id);
    }
    st.save_projects()?;
    schedule_metadata_upload(st);
    Ok(())
}

#[tauri::command]
pub async fn scan_project_preview(
    state: State<'_, AppState>,
    project_id: String,
) -> Result<ScanPreview, String> {
    let st = (*state).clone();
    tauri::async_runtime::spawn_blocking(move || {
        let project = st
            .find_project(&project_id)
            .ok_or_else(|| "Project not found.".to_string())?;
        let root = PathBuf::from(&project.path);
        if !root.is_dir() {
            return Err(format!("Project folder no longer exists: {}", project.path));
        }
        let settings = st.lock().settings.clone();
        let cancel = Arc::new(AtomicBool::new(false));
        let mut noop = |_: u64| {};
        let outcome = scanner::scan_project(&root, &settings, 400, &cancel, &mut noop)?;

        st.update_project_stats(&project_id, outcome.stats.clone())?;

        Ok(ScanPreview {
            stats: outcome.stats,
            ignored_samples: outcome.ignored_samples,
            included_samples: outcome.included_samples,
            warnings: outcome.warnings,
        })
    })
    .await
    .map_err(|e| format!("Project scan task failed: {e}"))?
}

#[tauri::command]
pub fn save_settings(
    app: AppHandle,
    state: State<'_, AppState>,
    input: SettingsInput,
) -> Result<AppSnapshot, String> {
    let st = (*state).clone();
    {
        let mut inner = st.lock();
        let mut credentials_changed = false;
        let mut client_id_changed = false;
        let mut secret_provided = false;
        let next_folder_name = sanitize_folder_name(&input.folder_name);

        if let Some(client_id) = input.client_id {
            let trimmed = client_id.trim().to_string();
            if trimmed != inner.settings.client_id {
                inner.settings.client_id = trimmed;
                client_id_changed = true;
                credentials_changed = true;
            }
        }
        if let Some(secret) = input.client_secret {
            let trimmed = secret.trim().to_string();
            if !trimmed.is_empty() && trimmed != inner.settings.client_secret {
                inner.settings.client_secret = trimmed;
                credentials_changed = true;
                secret_provided = true;
            }
        }
        if client_id_changed && !secret_provided {
            // A secret from a different OAuth client is useless — require a fresh one.
            inner.settings.client_secret.clear();
        }

        if next_folder_name != inner.settings.folder_name {
            inner.settings.folder_name = next_folder_name;
            inner.settings.folder_id = None;
        }

        inner.settings.retention = input.retention.min(365);
        inner.settings.compression_level = input.compression_level.clamp(0, 9);
        inner.settings.respect_gitignore = input.respect_gitignore;
        inner.settings.extra_ignore_patterns = input
            .extra_ignore_patterns
            .into_iter()
            .map(|line| line.trim().to_string())
            .filter(|line| !line.is_empty())
            .collect();
        inner.settings.auto_backup_enabled = input.auto_backup_enabled;
        inner.settings.auto_backup_interval_hours = input
            .auto_backup_interval_hours
            .clamp(1, MAX_AUTO_BACKUP_INTERVAL_HOURS);
        inner.settings.close_to_tray = input.close_to_tray;
        inner.settings.global_hotkey_enabled = input.global_hotkey_enabled;
        inner.settings.global_hotkey = sanitize_hotkey(&input.global_hotkey);

        if credentials_changed {
            inner.tokens = None;
            inner.settings.folder_id = None;
        }
    }

    if st.lock().tokens.is_none() {
        st.store.remove("auth.json");
    }
    st.save_settings()?;

    Ok(st.snapshot(&app_data_string(&app), env!("CARGO_PKG_VERSION")))
}

#[tauri::command]
pub async fn drive_connect(state: State<'_, AppState>) -> Result<DriveStatus, String> {
    let st = (*state).clone();
    let cancel = st.lock().auth_cancel.clone();
    cancel.store(false, Ordering::SeqCst);
    tauri::async_runtime::spawn_blocking(move || {
        let (client_id, client_secret) = {
            let inner = st.lock();
            (
                inner.settings.client_id.clone(),
                inner.settings.client_secret.clone(),
            )
        };

        if client_id.is_empty() || client_secret.is_empty() {
            return Err(
                "Add your Google OAuth Client ID and Client secret before connecting.".to_string(),
            );
        }

        let cancel = st.lock().auth_cancel.clone();

        let tokens = drive::run_oauth_flow(&client_id, &client_secret, cancel)?;

        {
            let mut inner = st.lock();
            inner.tokens = Some(tokens.clone());
        }
        st.save_tokens()?;

        // Pull the Drive vault index (if this account already has one) so a new
        // PC gets its projects and snapshot history back automatically.
        if let Err(err) = pull_and_merge_cloud(&st) {
            eprintln!("Drive vault sync deferred: {err}");
        }

        Ok(st.drive_status())
    })
    .await
    .map_err(|e| format!("Google Drive connection task failed: {e}"))?
}

#[tauri::command]
pub fn cancel_drive_auth(state: State<'_, AppState>) -> Result<(), String> {
    let cancel = state.lock().auth_cancel.clone();
    cancel.store(true, Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
pub async fn sync_cloud_metadata(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<AppSnapshot, String> {
    let st = (*state).clone();
    let handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        pull_and_merge_cloud(&st)?;
        Ok(st.snapshot(&app_data_string(&handle), env!("CARGO_PKG_VERSION")))
    })
    .await
    .map_err(|e| format!("Cloud vault sync task failed: {e}"))?
}

#[tauri::command]
pub fn drive_disconnect(state: State<'_, AppState>) -> Result<(), String> {
    {
        let mut inner = state.lock();
        inner.tokens = None;
        inner.settings.folder_id = None;
    }
    state.save_tokens()?;
    state.save_settings()?;
    Ok(())
}

fn cleanup_old_backups(
    state: &AppState,
    client: &DriveClient,
    project_id: &str,
    retention: u32,
    app: &AppHandle,
    job_id: &str,
) {
    if retention == 0 {
        return;
    }

    let excess: Vec<BackupRecord> = {
        let inner = state.lock();
        let mut list: Vec<BackupRecord> = inner
            .backups
            .iter()
            .filter(|b| b.project_id == project_id)
            .cloned()
            .collect();
        list.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        list.into_iter().skip(retention as usize).collect()
    };

    if excess.is_empty() {
        return;
    }

    let mut deleted: Vec<String> = Vec::new();
    for record in &excess {
        match client.delete_file(&record.file_id) {
            Ok(()) => deleted.push(record.id.clone()),
            Err(err) => {
                eprintln!("Retention cleanup skipped {}: {err}", record.file_name);
            }
        }
    }

    if !deleted.is_empty() {
        {
            let mut inner = state.lock();
            inner.backups.retain(|b| !deleted.contains(&b.id));
        }
        let _ = state.save_backups();
        emit_backup(
            app,
            job_id,
            "finalizing",
            96.0,
            format!(
                "Removed {} older snapshot{} (keeping {})",
                deleted.len(),
                if deleted.len() == 1 { "" } else { "s" },
                retention
            ),
            0,
            0,
            0,
            0,
        );
    }
}

fn backup_blocking(
    app: &AppHandle,
    state: &AppState,
    project_id: &str,
    job_id: &str,
) -> Result<BackupRecord, String> {
    let outcome = (|| -> Result<BackupRecord, String> {
        let project = state
            .find_project(project_id)
            .ok_or_else(|| "Project not found.".to_string())?;
        let root = PathBuf::from(&project.path);
        if !root.is_dir() {
            return Err(format!("Project folder no longer exists: {}", project.path));
        }

        let (settings, tokens) = {
            let inner = state.lock();
            (inner.settings.clone(), inner.tokens.clone())
        };
        let mut tokens = tokens.ok_or_else(|| {
            "Google Drive is not connected. Connect it in Settings first.".to_string()
        })?;
        if tokens.refresh_token.is_empty() && tokens.access_token.is_empty() {
            return Err("Google Drive is not connected. Connect it in Settings first.".to_string());
        }

        let cancel = state.lock().backup_cancel.clone();

        emit_backup(
            app,
            job_id,
            "scanning",
            3.0,
            "Reading .gitignore rules…".to_string(),
            0,
            0,
            0,
            0,
        );

        let mut last_scan_emit = Instant::now();
        let mut scan_callback = |found: u64| {
            if last_scan_emit.elapsed().as_millis() >= 160 {
                emit_backup(
                    app,
                    job_id,
                    "scanning",
                    6.0,
                    format!("Indexing project — {found} files selected"),
                    found,
                    0,
                    0,
                    0,
                );
                last_scan_emit = Instant::now();
            }
        };
        let scan = scanner::scan_project(&root, &settings, 400, &cancel, &mut scan_callback)?;

        if scan.files.is_empty() {
            return Err("No files to back up after applying ignore rules.".to_string());
        }

        state.update_project_stats(project_id, scan.stats.clone())?;

        emit_backup(
            app,
            job_id,
            "scanning",
            10.0,
            format!(
                "{} files selected · {} skipped by ignore rules",
                scan.stats.included_files, scan.stats.ignored_files
            ),
            scan.stats.included_files,
            scan.stats.included_files,
            0,
            0,
        );

        let access_token =
            drive::ensure_access_token(&mut tokens, &settings.client_id, &settings.client_secret)?;
        {
            let mut inner = state.lock();
            inner.tokens = Some(tokens.clone());
        }
        state.save_tokens()?;

        let client = DriveClient::new(access_token)?;

        if cancel.load(Ordering::Relaxed) {
            return Err("Backup cancelled.".to_string());
        }

        let folder_id =
            client.ensure_folder(&settings.folder_name, settings.folder_id.as_deref())?;
        {
            let mut inner = state.lock();
            inner.settings.folder_id = Some(folder_id.clone());
        }
        state.save_settings()?;

        let file_name = format!(
            "{}-{}.zip",
            sanitize_file_name(&project.name),
            chrono::Local::now().format("%Y-%m-%d_%H-%M-%S")
        );

        let temp_dir = std::env::temp_dir().join("ryz-projectup");
        fs::create_dir_all(&temp_dir)
            .map_err(|e| format!("Could not create temporary folder: {e}"))?;
        let archive_path = temp_dir.join(format!("snapshot-{}.zip", Uuid::new_v4()));
        let _archive_guard = TempFileGuard(archive_path.clone());

        let total_to_archive = scan.stats.included_bytes.max(1);
        let total_files = scan.stats.included_files.max(1);
        emit_backup(
            app,
            job_id,
            "archiving",
            12.0,
            "Compressing project files…".to_string(),
            0,
            total_files,
            0,
            total_to_archive,
        );

        let mut last_archive_emit = Instant::now();
        let mut archive_callback = |done: u64, total: u64, files: u64| {
            if last_archive_emit.elapsed().as_millis() >= 140 || done >= total {
                let total = total.max(1);
                let percent = 12.0 + (done as f64 / total as f64) * 43.0;
                emit_backup(
                    app,
                    job_id,
                    "archiving",
                    percent,
                    format!(
                        "Compressing {} / {} files · {}",
                        files,
                        total_files,
                        human_bytes(done)
                    ),
                    files,
                    total_files,
                    done,
                    total,
                );
                last_archive_emit = Instant::now();
            }
        };

        let archive = match archive::create_archive(
            &scan.files,
            &archive_path,
            settings.compression_level,
            total_to_archive,
            &cancel,
            &mut archive_callback,
        ) {
            Ok(archive) => archive,
            Err(err) => {
                let _ = fs::remove_file(&archive_path);
                return Err(err);
            }
        };
        let zip_size = archive.zip_size.max(1);
        let file_count = archive.file_count;

        if cancel.load(Ordering::Relaxed) {
            let _ = fs::remove_file(&archive_path);
            return Err("Backup cancelled.".to_string());
        }

        emit_backup(
            app,
            job_id,
            "uploading",
            58.0,
            format!(
                "Uploading {} snapshot to Google Drive…",
                human_bytes(zip_size)
            ),
            0,
            0,
            0,
            zip_size,
        );

        let upload_app = app.clone();
        let upload_job = job_id.to_string();
        let mut last_upload_emit = Instant::now();
        let progress: Box<dyn FnMut(u64, u64) + Send> = Box::new(move |done, total| {
            if last_upload_emit.elapsed().as_millis() >= 120 || done >= total {
                let total = total.max(1);
                let percent = 58.0 + (done as f64 / total as f64) * 32.0;
                emit_backup(
                    &upload_app,
                    &upload_job,
                    "uploading",
                    percent,
                    format!(
                        "Uploading to Google Drive · {} / {}",
                        human_bytes(done),
                        human_bytes(total)
                    ),
                    0,
                    0,
                    done,
                    total,
                );
                last_upload_emit = Instant::now();
            }
        });

        let uploaded = match client.upload_archive(
            &archive_path,
            &file_name,
            &folder_id,
            &project.id,
            &project.name,
            zip_size,
            cancel.clone(),
            progress,
        ) {
            Ok(uploaded) => uploaded,
            Err(err) => {
                let _ = fs::remove_file(&archive_path);
                return Err(err);
            }
        };

        emit_backup(
            app,
            job_id,
            "finalizing",
            94.0,
            "Saving snapshot metadata…".to_string(),
            file_count,
            file_count,
            zip_size,
            zip_size,
        );

        let record = BackupRecord {
            id: Uuid::new_v4().to_string(),
            project_id: project.id.clone(),
            project_name: project.name.clone(),
            file_id: uploaded.id,
            file_name: uploaded.name,
            size_bytes: zip_size,
            file_count,
            created_at: now_iso(),
            web_view_link: uploaded.web_view_link,
        };

        state.push_backup(record.clone())?;
        cleanup_old_backups(state, &client, &project.id, settings.retention, app, job_id);

        // Keep the cloud vault index up to date so another PC can restore the
        // project list and snapshot history.
        let vault = state.cloud_vault();
        if let Err(err) = client.upload_vault(&folder_id, &vault) {
            eprintln!("Snapshot uploaded but Drive vault index update failed: {err}");
        }

        let _ = fs::remove_file(&archive_path);

        emit_backup(
            app,
            job_id,
            "done",
            100.0,
            "Snapshot uploaded to Google Drive".to_string(),
            file_count,
            file_count,
            zip_size,
            zip_size,
        );

        Ok(record)
    })();

    if let Err(err) = &outcome {
        emit_backup(app, job_id, "error", 0.0, err.clone(), 0, 0, 0, 0);
    }

    outcome
}

struct BackupLaneGuard<'a>(&'a AppState);

impl Drop for BackupLaneGuard<'_> {
    fn drop(&mut self) {
        self.0.finish_backup();
    }
}

/// Runs one scheduled pass. The pass is project-by-project: every project is
/// checked against its own newest snapshot, so one project's schedule is never
/// delayed by another project's recent backup.
pub(crate) fn auto_backup_cycle(app: &AppHandle) {
    let state = (*app.state::<AppState>()).clone();

    let (enabled, interval_hours, drive_connected, projects) = {
        let inner = state.lock();
        let drive_connected = inner.tokens.as_ref().is_some_and(|tokens| {
            !tokens.refresh_token.is_empty() || !tokens.access_token.is_empty()
        });
        (
            inner.settings.auto_backup_enabled,
            inner
                .settings
                .auto_backup_interval_hours
                .clamp(1, MAX_AUTO_BACKUP_INTERVAL_HOURS),
            drive_connected,
            inner.projects.clone(),
        )
    };

    if !enabled || !drive_connected || projects.is_empty() {
        return;
    }

    let latest_by_project = {
        let inner = state.lock();
        let mut latest: HashMap<String, String> = HashMap::new();
        for backup in &inner.backups {
            let replace = latest
                .get(&backup.project_id)
                .map(|current| backup.created_at > *current)
                .unwrap_or(true);
            if replace {
                latest.insert(backup.project_id.clone(), backup.created_at.clone());
            }
        }
        latest
    };

    let now = Local::now();
    let due: Vec<Project> = projects
        .into_iter()
        .filter(|project| Path::new(&project.path).is_dir())
        .filter(|project| {
            is_backup_due(
                latest_by_project.get(&project.id).map(String::as_str),
                interval_hours,
                now,
            )
        })
        .collect();

    if due.is_empty() || !state.begin_backup() {
        return;
    }
    let _lane = BackupLaneGuard(&state);
    let cancel = state.lock().backup_cancel.clone();
    cancel.store(false, Ordering::SeqCst);

    for project in due {
        if !state.lock().settings.auto_backup_enabled || cancel.load(Ordering::SeqCst) {
            break;
        }
        let job_id = format!("auto-{}", Uuid::new_v4());

        let _ = app.emit(
            "auto-backup",
            AutoBackupEvent {
                project_name: project.name.clone(),
                status: "started".to_string(),
                message: "Scheduled backup started".to_string(),
                record: None,
            },
        );

        match backup_blocking(app, &state, &project.id, &job_id) {
            Ok(record) => {
                let _ = app.emit(
                    "auto-backup",
                    AutoBackupEvent {
                        project_name: project.name.clone(),
                        status: "success".to_string(),
                        message: format!("Uploaded {}", record.file_name),
                        record: Some(record),
                    },
                );
            }
            Err(err) => {
                let cancelled = err.to_lowercase().contains("cancel");
                let _ = app.emit(
                    "auto-backup",
                    AutoBackupEvent {
                        project_name: project.name.clone(),
                        status: if cancelled { "cancelled" } else { "error" }.to_string(),
                        message: if cancelled {
                            "Scheduled backup cancelled".to_string()
                        } else {
                            err
                        },
                        record: None,
                    },
                );
                if cancelled {
                    break;
                }
            }
        }
    }
}

#[tauri::command]
pub async fn run_backup(
    app: AppHandle,
    state: State<'_, AppState>,
    project_id: String,
    job_id: String,
) -> Result<BackupRecord, String> {
    let st = (*state).clone();
    if !st.begin_backup() {
        return Err(
            "A backup is already running. Wait for it to finish before starting another."
                .to_string(),
        );
    }
    let cancel = st.lock().backup_cancel.clone();
    cancel.store(false, Ordering::SeqCst);
    let handle = app.clone();
    let lane = st.clone();
    let outcome = tauri::async_runtime::spawn_blocking(move || {
        backup_blocking(&handle, &st, &project_id, &job_id)
    })
    .await;
    lane.finish_backup();
    match outcome {
        Ok(result) => result,
        Err(err) => Err(format!("Backup task failed: {err}")),
    }
}

#[tauri::command]
pub fn cancel_backup(state: State<'_, AppState>) -> Result<(), String> {
    let cancel = state.lock().backup_cancel.clone();
    cancel.store(true, Ordering::SeqCst);
    Ok(())
}

fn restore_blocking(
    app: &AppHandle,
    state: &AppState,
    backup_id: &str,
    destination: &str,
    job_id: &str,
) -> Result<RestoreResult, String> {
    let outcome = (|| -> Result<RestoreResult, String> {
        let record = state
            .find_backup(backup_id)
            .ok_or_else(|| "Snapshot not found in local history.".to_string())?;

        let (settings, tokens) = {
            let inner = state.lock();
            (inner.settings.clone(), inner.tokens.clone())
        };
        let mut tokens = tokens.ok_or_else(|| {
            "Google Drive is not connected. Connect it in Settings first.".to_string()
        })?;

        emit_restore(
            app,
            job_id,
            "downloading",
            1.0,
            "Authorizing with Google Drive…".to_string(),
        );

        let access =
            drive::ensure_access_token(&mut tokens, &settings.client_id, &settings.client_secret)?;
        {
            let mut inner = state.lock();
            inner.tokens = Some(tokens.clone());
        }
        state.save_tokens()?;

        let client = DriveClient::new(access)?;

        let temp_dir = std::env::temp_dir().join("ryz-projectup");
        fs::create_dir_all(&temp_dir)
            .map_err(|e| format!("Could not create temporary folder: {e}"))?;
        let temp_zip = temp_dir.join(format!("restore-{}.zip", Uuid::new_v4()));
        let _temp_guard = TempFileGuard(temp_zip.clone());

        let cancel = Arc::new(AtomicBool::new(false));
        let mut last_emit = Instant::now();
        let mut download_progress = |done: u64, total: u64| {
            if last_emit.elapsed().as_millis() >= 120 || done >= total {
                let total = total.max(1);
                let percent = 2.0 + (done as f64 / total as f64) * 53.0;
                emit_restore(
                    app,
                    job_id,
                    "downloading",
                    percent,
                    format!(
                        "Downloading snapshot · {} / {}",
                        human_bytes(done),
                        human_bytes(total)
                    ),
                );
                last_emit = Instant::now();
            }
        };

        let downloaded = match client.download_archive(
            &record.file_id,
            &temp_zip,
            &cancel,
            &mut download_progress,
        ) {
            Ok(bytes) => bytes,
            Err(err) => {
                let _ = fs::remove_file(&temp_zip);
                return Err(err);
            }
        };
        if downloaded == 0 {
            let _ = fs::remove_file(&temp_zip);
            return Err("Google Drive returned an empty snapshot.".to_string());
        }

        emit_restore(
            app,
            job_id,
            "extracting",
            58.0,
            "Extracting project files…".to_string(),
        );

        let destination_root = PathBuf::from(destination);
        if !destination_root.is_dir() {
            let _ = fs::remove_file(&temp_zip);
            return Err("The restore destination no longer exists.".to_string());
        }

        let base_name = sanitize_file_name(&record.project_name);
        let mut target = destination_root.join(&base_name);
        if target.exists() {
            target = destination_root.join(format!(
                "{}-restored-{}",
                base_name,
                chrono::Local::now().format("%Y%m%d-%H%M%S")
            ));
            let mut suffix = 1;
            while target.exists() {
                target = destination_root.join(format!(
                    "{}-restored-{}-{}",
                    base_name,
                    chrono::Local::now().format("%Y%m%d-%H%M%S"),
                    suffix
                ));
                suffix += 1;
            }
        }
        fs::create_dir_all(&target)
            .map_err(|e| format!("Could not create the restore folder: {e}"))?;

        let mut last_extract_emit = Instant::now();
        let mut extract_progress = |done: u64, total: u64| {
            if last_extract_emit.elapsed().as_millis() >= 120 || done >= total {
                let total = total.max(1);
                let percent = 58.0 + (done as f64 / total as f64) * 41.0;
                emit_restore(
                    app,
                    job_id,
                    "extracting",
                    percent,
                    format!("Extracting files · {} / {}", done, record.file_count.max(1)),
                );
                last_extract_emit = Instant::now();
            }
        };

        let extracted_files =
            match archive::extract_archive(&temp_zip, &target, &cancel, &mut extract_progress) {
                Ok(count) => count,
                Err(err) => {
                    let _ = fs::remove_file(&temp_zip);
                    return Err(err);
                }
            };

        let _ = fs::remove_file(&temp_zip);

        emit_restore(app, job_id, "done", 100.0, "Restore complete".to_string());

        Ok(RestoreResult {
            destination: target.to_string_lossy().to_string(),
            file_count: extracted_files,
        })
    })();

    if let Err(err) = &outcome {
        emit_restore(app, job_id, "error", 0.0, err.clone());
    }

    outcome
}

#[tauri::command]
pub async fn restore_backup(
    app: AppHandle,
    state: State<'_, AppState>,
    backup_id: String,
    destination: String,
    job_id: String,
) -> Result<RestoreResult, String> {
    let st = (*state).clone();
    let handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        restore_blocking(&handle, &st, &backup_id, &destination, &job_id)
    })
    .await
    .map_err(|e| format!("Restore task failed: {e}"))?
}

#[tauri::command]
pub async fn delete_backup(
    state: State<'_, AppState>,
    backup_id: String,
    delete_from_drive: bool,
) -> Result<(), String> {
    let st = (*state).clone();
    tauri::async_runtime::spawn_blocking(move || {
        let record = st
            .find_backup(&backup_id)
            .ok_or_else(|| "Snapshot not found in local history.".to_string())?;

        if delete_from_drive {
            let (settings, tokens) = {
                let inner = st.lock();
                (inner.settings.clone(), inner.tokens.clone())
            };
            let mut tokens = tokens.ok_or_else(|| {
                "Google Drive is not connected. Reconnect it to delete the cloud file.".to_string()
            })?;
            let access = drive::ensure_access_token(
                &mut tokens,
                &settings.client_id,
                &settings.client_secret,
            )?;
            {
                let mut inner = st.lock();
                inner.tokens = Some(tokens.clone());
            }
            st.save_tokens()?;
            let client = DriveClient::new(access)?;
            client.delete_file(&record.file_id)?;
        }

        {
            let mut inner = st.lock();
            inner.backups.retain(|b| b.id != backup_id);
        }
        st.save_backups()?;
        schedule_metadata_upload(st.clone());
        Ok(())
    })
    .await
    .map_err(|e| format!("Delete task failed: {e}"))?
}

#[tauri::command]
pub fn open_url(url: String) -> Result<(), String> {
    let parsed = url::Url::parse(&url).map_err(|e| format!("Invalid URL: {e}"))?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err("Only http(s) links can be opened.".to_string());
    }
    open::that(parsed.as_str()).map_err(|e| format!("Could not open the link: {e}"))
}

#[tauri::command]
pub fn reveal_path(path: String) -> Result<(), String> {
    let target = PathBuf::from(&path);
    if !target.exists() {
        return Err("That path no longer exists.".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        if target.is_dir() {
            Command::new("explorer")
                .arg(&target)
                .spawn()
                .map_err(|e| format!("Could not open Explorer: {e}"))?;
        } else {
            Command::new("explorer")
                .arg(format!("/select,{}", target.display()))
                .spawn()
                .map_err(|e| format!("Could not open Explorer: {e}"))?;
        }
    }

    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        if target.is_dir() {
            Command::new("open")
                .arg(&target)
                .spawn()
                .map_err(|e| format!("Could not open Finder: {e}"))?;
        } else {
            Command::new("open")
                .arg("-R")
                .arg(&target)
                .spawn()
                .map_err(|e| format!("Could not open Finder: {e}"))?;
        }
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        use std::process::Command;
        let open_target = if target.is_dir() {
            target.clone()
        } else {
            target
                .parent()
                .map(|p| p.to_path_buf())
                .unwrap_or_else(|| target.clone())
        };
        Command::new("xdg-open")
            .arg(open_target)
            .spawn()
            .map_err(|e| format!("Could not open the file manager: {e}"))?;
    }

    Ok(())
}

#[tauri::command]
pub fn quit_app(app: AppHandle) {
    app.exit(0);
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Duration;

    #[test]
    fn due_backups_use_each_projects_own_snapshot_age() {
        let now = Local::now();
        assert!(is_backup_due(None, 24, now));

        let recent = (now - Duration::hours(1)).to_rfc3339();
        assert!(!is_backup_due(Some(&recent), 24, now));

        let old = (now - Duration::hours(25)).to_rfc3339();
        assert!(is_backup_due(Some(&old), 24, now));

        assert!(is_backup_due(Some("not-a-timestamp"), 24, now));
    }

    #[test]
    fn backup_interval_is_clamped() {
        let now = Local::now();
        let two_hours_ago = (now - Duration::hours(2)).to_rfc3339();
        // An interval below one hour is raised to one hour.
        assert!(is_backup_due(Some(&two_hours_ago), 0, now));

        let seven_hundred_hours_ago = (now - Duration::hours(700)).to_rfc3339();
        assert!(!is_backup_due(Some(&seven_hundred_hours_ago), 999, now));

        let seven_hundred_twenty_one_hours_ago = (now - Duration::hours(721)).to_rfc3339();
        assert!(is_backup_due(
            Some(&seven_hundred_twenty_one_hours_ago),
            999,
            now
        ));
    }

    #[test]
    fn empty_hotkeys_fall_back_to_the_default() {
        assert_eq!(sanitize_hotkey("   "), DEFAULT_GLOBAL_HOTKEY);
        assert_eq!(
            sanitize_hotkey("CommandOrControl+Alt+KeyK"),
            "CommandOrControl+Alt+KeyK"
        );
    }
}
