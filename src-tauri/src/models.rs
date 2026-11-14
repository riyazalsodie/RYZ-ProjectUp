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
    #[serde(default)]
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

fn default_extra_patterns() -> Vec<String> {
    vec![
        ".DS_Store".to_string(),
        "Thumbs.db".to_string(),
        "desktop.ini".to_string(),
    ]
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
pub struct UploadedFile {
    pub id: String,
    pub name: String,
    pub size: Option<u64>,
    pub web_view_link: Option<String>,
}
