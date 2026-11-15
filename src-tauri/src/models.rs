use serde::{Deserialize, Serialize};

pub fn now_iso() -> String {
    chrono::Local::now().to_rfc3339()
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct ProjectStats {
    pub total_files: u64,
    pub included_files: u64,
    pub ignored_files: u64,
    pub included_bytes: u64,
    pub ignored_bytes: u64,
    pub gitignore_present: bool,
    pub ryzignore_present: bool,
    pub scanned_at: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub path: String,
    pub added_at: String,
    #[serde(default)]
    pub stats: Option<ProjectStats>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct BackupRecord {
    pub id: String,
    pub project_id: String,
    pub project_name: String,
    pub file_id: String,
    pub file_name: String,
    pub size_bytes: u64,
    pub file_count: u64,
    pub created_at: String,
    #[serde(default)]
    pub web_view_link: Option<String>,
}

#[derive(Serialize, Clone, Debug)]
pub struct ProjectView {
    pub id: String,
    pub name: String,
    pub path: String,
    pub added_at: String,
    pub stats: Option<ProjectStats>,
    pub backup_count: u32,
    pub total_backed_up_bytes: u64,
    pub last_backup: Option<BackupRecord>,
    pub path_available: bool,
}

#[derive(Serialize, Clone, Debug, Default)]
pub struct DriveStatus {
    pub connected: bool,
    pub email: Option<String>,
    pub name: Option<String>,
    pub picture: Option<String>,
    pub folder_id: Option<String>,
    pub folder_name: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Settings {
    #[serde(default)]
    pub client_id: String,
    #[serde(default, skip_serializing)]
    pub client_secret: String,
    #[serde(default = "default_folder_name")]
    pub folder_name: String,
    #[serde(default)]
    pub folder_id: Option<String>,
    #[serde(default = "default_retention")]
    pub retention: u32,
    #[serde(default = "default_compression")]
    pub compression_level: i64,
    #[serde(default = "default_true")]
    pub respect_gitignore: bool,
    #[serde(default = "default_extra_patterns")]
    pub extra_ignore_patterns: Vec<String>,
    #[serde(default)]
    pub auto_backup_enabled: bool,
    #[serde(default = "default_auto_backup_interval")]
    pub auto_backup_interval_hours: u32,
    #[serde(default)]
    pub close_to_tray: bool,
    #[serde(default)]
    pub minimize_to_tray: bool,
    #[serde(default = "default_true")]
    pub global_hotkey_enabled: bool,
}

fn default_folder_name() -> String {
    "RYZ ProjectUp".to_string()
}

fn default_retention() -> u32 {
    10
}

fn default_compression() -> i64 {
    6
}

fn default_true() -> bool {
    true
}

fn default_auto_backup_interval() -> u32 {
    24
}

fn default_extra_patterns() -> Vec<String> {
    [
        "node_modules/",
        "bower_components/",
        "dist/",
        "build/",
        "out/",
        "target/",
        "obj/",
        ".next/",
        ".nuxt/",
        ".svelte-kit/",
        ".turbo/",
        ".cache/",
        ".parcel-cache/",
        "coverage/",
        ".nyc_output/",
        ".idea/",
        ".vscode/",
        ".gradle/",
        ".dart_tool/",
        "Pods/",
        "DerivedData/",
        "__pycache__/",
        ".venv/",
        "venv/",
        "*.log",
        "*.tmp",
        "*.swp",
        "*~",
        ".env",
        ".env.*",
        "*.pem",
        "*.key",
        "*.p12",
        "*.pfx",
        ".DS_Store",
        "Thumbs.db",
        "desktop.ini",
    ]
    .iter()
    .map(|pattern| pattern.to_string())
    .collect()
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            client_id: String::new(),
            client_secret: String::new(),
            folder_name: default_folder_name(),
            folder_id: None,
            retention: default_retention(),
            compression_level: default_compression(),
            respect_gitignore: true,
            extra_ignore_patterns: default_extra_patterns(),
            auto_backup_enabled: false,
            auto_backup_interval_hours: default_auto_backup_interval(),
            close_to_tray: false,
            minimize_to_tray: false,
            global_hotkey_enabled: true,
        }
    }
}

#[derive(Deserialize, Clone, Debug)]
pub struct SettingsInput {
    pub folder_name: String,
    pub retention: u32,
    pub compression_level: i64,
    pub respect_gitignore: bool,
    pub extra_ignore_patterns: Vec<String>,
    #[serde(default)]
    pub auto_backup_enabled: bool,
    #[serde(default = "default_auto_backup_interval")]
    pub auto_backup_interval_hours: u32,
    #[serde(default)]
    pub close_to_tray: bool,
    #[serde(default)]
    pub minimize_to_tray: bool,
    #[serde(default = "default_true")]
    pub global_hotkey_enabled: bool,
    #[serde(default)]
    pub client_id: Option<String>,
    #[serde(default)]
    pub client_secret: Option<String>,
}

#[derive(Serialize, Clone, Debug)]
pub struct PublicSettings {
    pub client_id: String,
    pub has_client_secret: bool,
    pub folder_name: String,
    pub retention: u32,
    pub compression_level: i64,
    pub respect_gitignore: bool,
    pub extra_ignore_patterns: Vec<String>,
    pub auto_backup_enabled: bool,
    pub auto_backup_interval_hours: u32,
    pub close_to_tray: bool,
    pub minimize_to_tray: bool,
    pub global_hotkey_enabled: bool,
}

impl From<&Settings> for PublicSettings {
    fn from(value: &Settings) -> Self {
        Self {
            client_id: value.client_id.clone(),
            has_client_secret: !value.client_secret.is_empty(),
            folder_name: value.folder_name.clone(),
            retention: value.retention,
            compression_level: value.compression_level,
            respect_gitignore: value.respect_gitignore,
            extra_ignore_patterns: value.extra_ignore_patterns.clone(),
            auto_backup_enabled: value.auto_backup_enabled,
            auto_backup_interval_hours: value.auto_backup_interval_hours,
            close_to_tray: value.close_to_tray,
            minimize_to_tray: value.minimize_to_tray,
            global_hotkey_enabled: value.global_hotkey_enabled,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct DriveTokens {
    #[serde(default)]
    pub access_token: String,
    #[serde(default)]
    pub refresh_token: String,
    #[serde(default)]
    pub expiry: i64,
    #[serde(default)]
    pub token_type: Option<String>,
    #[serde(default)]
    pub scope: Option<String>,
    #[serde(default)]
    pub email: Option<String>,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub picture: Option<String>,
}

#[derive(Serialize, Clone, Debug)]
pub struct IgnoredSample {
    pub path: String,
    pub pattern: Option<String>,
}

#[derive(Serialize, Clone, Debug)]
pub struct ScanPreview {
    pub stats: ProjectStats,
    pub ignored_samples: Vec<IgnoredSample>,
    pub included_samples: Vec<String>,
    pub warnings: Vec<String>,
}

#[derive(Serialize, Clone, Debug)]
pub struct AppSnapshot {
    pub projects: Vec<ProjectView>,
    pub backups: Vec<BackupRecord>,
    pub settings: PublicSettings,
    pub drive: DriveStatus,
    pub version: String,
    pub data_dir: String,
    pub secure_storage: bool,
    pub secure_storage_label: String,
}

#[derive(Serialize, Clone, Debug)]
pub struct BackupProgressEvent {
    pub job_id: String,
    pub phase: String,
    pub percent: f64,
    pub message: String,
    pub current: u64,
    pub total: u64,
    pub bytes_done: u64,
    pub bytes_total: u64,
}

#[derive(Serialize, Clone, Debug)]
pub struct RestoreProgressEvent {
    pub job_id: String,
    pub phase: String,
    pub percent: f64,
    pub message: String,
}

#[derive(Serialize, Clone, Debug)]
pub struct RestoreResult {
    pub destination: String,
    pub file_count: u64,
}

#[derive(Serialize, Clone, Debug)]
pub struct AutoBackupEvent {
    pub project_name: String,
    pub status: String,
    pub message: String,
    pub record: Option<BackupRecord>,
}

#[derive(Serialize, Clone, Debug)]
pub struct UploadedFile {
    pub id: String,
    pub name: String,
    pub size: Option<u64>,
    pub web_view_link: Option<String>,
}

/// The small JSON index stored in the user's Drive folder. It lets a new PC
/// reconnect to the same vault and recover projects + snapshot history.
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CloudVault {
    #[serde(default = "default_cloud_schema")]
    pub schema: u32,
    #[serde(default)]
    pub app: String,
    #[serde(default)]
    pub updated_at: String,
    #[serde(default)]
    pub projects: Vec<Project>,
    #[serde(default)]
    pub backups: Vec<BackupRecord>,
}

fn default_cloud_schema() -> u32 {
    1
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn upgrading_old_settings_keeps_safe_automation_defaults() {
        let settings: Settings = serde_json::from_str("{}").expect("settings should deserialize");
        assert!(!settings.auto_backup_enabled);
        assert_eq!(settings.auto_backup_interval_hours, 24);
        assert!(!settings.close_to_tray);
        assert!(!settings.minimize_to_tray);
        assert!(settings.global_hotkey_enabled);
    }
}
