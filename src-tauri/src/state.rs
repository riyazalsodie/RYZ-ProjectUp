use std::path::PathBuf;
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex, MutexGuard};

use crate::models::{
    CloudVault, DriveStatus, DriveTokens, Project, ProjectStats, ProjectView, PublicSettings,
    Settings, now_iso, AppSnapshot, BackupRecord,
};
use crate::secrets::{self, Secrets};
use crate::store::Store;

pub struct Inner {
    pub projects: Vec<Project>,
    pub backups: Vec<BackupRecord>,
    pub settings: Settings,
    pub tokens: Option<DriveTokens>,
    pub backup_cancel: Arc<AtomicBool>,
    pub auth_cancel: Arc<AtomicBool>,
}

#[derive(Clone)]
pub struct AppState {
    pub store: Store,
    pub inner: Arc<Mutex<Inner>>,
}

impl AppState {
    pub fn new(data_dir: PathBuf) -> Result<Self, String> {
        let store = Store::new(data_dir)?;
        let projects: Vec<Project> = store.load_or_default("projects.json");
        let backups: Vec<BackupRecord> = store.load_or_default("backups.json");
        let mut settings: Settings = store.load_or_default("settings.json");
        let legacy_tokens: Option<DriveTokens> = store.load("auth.json");

        // Users upgrading from the first beta had only three OS-junk defaults.
        // Replace that exact set with the expanded security/build defaults.
        const LEGACY_DEFAULTS: [&str; 3] = [".DS_Store", "Thumbs.db", "desktop.ini"];
        if settings.extra_ignore_patterns.len() == LEGACY_DEFAULTS.len()
            && LEGACY_DEFAULTS
                .iter()
                .all(|legacy| settings.extra_ignore_patterns.iter().any(|value| value == legacy))
        {
            settings.extra_ignore_patterns = Settings::default().extra_ignore_patterns;
        }

        let secrets = secrets::load(store.data_dir()).unwrap_or_else(|| Secrets {
            client_secret: settings.client_secret.clone(),
            tokens: legacy_tokens,
        });
        settings.client_secret = secrets.client_secret.clone();
        let tokens = secrets.tokens.clone();

        let state = Self {
            store,
            inner: Arc::new(Mutex::new(Inner {
                projects,
                backups,
                settings,
                tokens,
                backup_cancel: Arc::new(AtomicBool::new(false)),
                auth_cancel: Arc::new(AtomicBool::new(false)),
            })),
        };

        // Persist the encrypted blob before stripping any legacy plaintext
        // secret from settings.json.
        state.save_secrets()?;
        state.save_settings()?;
        state.store.remove("auth.json");
        Ok(state)
    }

    pub fn lock(&self) -> MutexGuard<'_, Inner> {
        self.inner.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    pub fn save_projects(&self) -> Result<(), String> {
        let projects = self.lock().projects.clone();
        self.store.save("projects.json", &projects)
    }

    pub fn save_backups(&self) -> Result<(), String> {
        let backups = self.lock().backups.clone();
        self.store.save("backups.json", &backups)
    }

    pub fn save_settings(&self) -> Result<(), String> {
        let settings = self.lock().settings.clone();
        self.store.save("settings.json", &settings)?;
        self.save_secrets()
    }

    pub fn save_tokens(&self) -> Result<(), String> {
        self.save_secrets()
    }

    pub fn save_secrets(&self) -> Result<(), String> {
        let secrets = {
            let inner = self.lock();
            Secrets {
                client_secret: inner.settings.client_secret.clone(),
                tokens: inner.tokens.clone(),
            }
        };
        secrets::save(self.store.data_dir(), &secrets)?;
        self.store.remove("auth.json");
        Ok(())
    }

    pub fn project_view(&self, project: &Project, backups: &[BackupRecord]) -> ProjectView {
        let project_backups: Vec<&BackupRecord> = backups
            .iter()
            .filter(|b| b.project_id == project.id)
            .collect();
        let last_backup = project_backups
            .iter()
            .max_by(|a, b| a.created_at.cmp(&b.created_at))
            .map(|b| (*b).clone());
        let total_backed_up_bytes = project_backups.iter().map(|b| b.size_bytes).sum();

        ProjectView {
            id: project.id.clone(),
            name: project.name.clone(),
            path: project.path.clone(),
            added_at: project.added_at.clone(),
            stats: project.stats.clone(),
            backup_count: project_backups.len() as u32,
            total_backed_up_bytes,
            last_backup,
            path_available: std::path::Path::new(&project.path).is_dir(),
        }
    }

    pub fn cloud_vault(&self) -> CloudVault {
        let inner = self.lock();
        CloudVault {
            schema: 1,
            app: "ryz-projectup".to_string(),
            updated_at: now_iso(),
            projects: inner.projects.clone(),
            backups: inner.backups.clone(),
        }
    }

    /// Merge a vault index downloaded from Drive. Matching IDs win locally;
    /// everything new from another PC is appended.
    pub fn merge_cloud_vault(&self, remote: CloudVault) -> Result<bool, String> {
        if !remote.app.is_empty() && remote.app != "ryz-projectup" {
            return Err("That Drive vault was created by a different application.".to_string());
        }
        if remote.schema > 1 {
            return Err(
                "That Drive vault was created by a newer version of ProjectUp. Update this app first."
                    .to_string(),
            );
        }

        let mut changed = false;
        {
            let mut inner = self.lock();
            for project in remote.projects {
                if !inner.projects.iter().any(|local| local.id == project.id) {
                    inner.projects.push(project);
                    changed = true;
                }
            }
            for backup in remote.backups {
                if !inner.backups.iter().any(|local| local.id == backup.id) {
                    inner.backups.push(backup);
                    changed = true;
                }
            }
        }

        if changed {
            self.save_projects()?;
            self.save_backups()?;
        }
        Ok(changed)
    }

    pub fn snapshot(&self, data_dir: &str, version: &str) -> AppSnapshot {
        let inner = self.lock();
        let mut backups = inner.backups.clone();
        backups.sort_by(|a, b| b.created_at.cmp(&a.created_at));

        let projects = inner
            .projects
            .iter()
            .map(|p| self.project_view(p, &backups))
            .collect();

        let drive = match inner.tokens.as_ref() {
            Some(tokens) if !tokens.refresh_token.is_empty() || !tokens.access_token.is_empty() => {
                DriveStatus {
                    connected: true,
                    email: tokens.email.clone(),
                    name: tokens.name.clone(),
                    picture: tokens.picture.clone(),
                    folder_id: inner.settings.folder_id.clone(),
                    folder_name: inner.settings.folder_name.clone(),
                }
            }
            _ => DriveStatus {
                connected: false,
                email: None,
                name: None,
                picture: None,
                folder_id: None,
                folder_name: inner.settings.folder_name.clone(),
            },
        };

        AppSnapshot {
            projects,
            backups,
            settings: PublicSettings::from(&inner.settings),
            drive,
            version: version.to_string(),
            data_dir: data_dir.to_string(),
            secure_storage: secrets::secure_storage_available(),
            secure_storage_label: secrets::secure_storage_label().to_string(),
        }
    }

    pub fn update_project_stats(&self, project_id: &str, stats: ProjectStats) -> Result<(), String> {
        {
            let mut inner = self.lock();
            if let Some(project) = inner.projects.iter_mut().find(|p| p.id == project_id) {
                project.stats = Some(stats);
            } else {
                return Err("Project not found".into());
            }
        }
        self.save_projects()
    }

    pub fn push_backup(&self, record: BackupRecord) -> Result<(), String> {
        {
            let mut inner = self.lock();
            inner.backups.push(record);
        }
        self.save_backups()
    }

    pub fn find_project(&self, project_id: &str) -> Option<Project> {
        self.lock().projects.iter().find(|p| p.id == project_id).cloned()
    }

    pub fn find_backup(&self, backup_id: &str) -> Option<BackupRecord> {
        self.lock().backups.iter().find(|b| b.id == backup_id).cloned()
    }

    pub fn drive_status(&self) -> DriveStatus {
        let inner = self.lock();
        match inner.tokens.as_ref() {
            Some(tokens) if !tokens.refresh_token.is_empty() || !tokens.access_token.is_empty() => DriveStatus {
                connected: true,
                email: tokens.email.clone(),
                name: tokens.name.clone(),
                picture: tokens.picture.clone(),
                folder_id: inner.settings.folder_id.clone(),
                folder_name: inner.settings.folder_name.clone(),
            },
            _ => DriveStatus {
                connected: false,
                email: None,
                name: None,
                picture: None,
                folder_id: None,
                folder_name: inner.settings.folder_name.clone(),
            },
        }
    }

    pub fn new_project(name: String, path: String) -> Project {
        Project {
            id: uuid::Uuid::new_v4().to_string(),
            name,
            path,
            added_at: now_iso(),
            stats: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::BackupRecord;
    use std::fs;

    fn sample_project(id: &str) -> Project {
        Project {
            id: id.to_string(),
            name: "demo-project".to_string(),
            path: "C:\\Projects\\demo-project".to_string(),
            added_at: now_iso(),
            stats: None,
        }
    }

    fn sample_backup(id: &str, project_id: &str) -> BackupRecord {
        BackupRecord {
            id: id.to_string(),
            project_id: project_id.to_string(),
            project_name: "demo-project".to_string(),
            file_id: format!("drive-{id}"),
            file_name: format!("demo-project_{id}.zip"),
            size_bytes: 4096,
            file_count: 10,
            created_at: now_iso(),
            web_view_link: None,
        }
    }

    #[test]
    fn merges_cloud_vault_without_duplicates() {
        let dir = std::env::temp_dir().join(format!("ryz-projectup-state-{}", uuid::Uuid::new_v4()));
        let state = AppState::new(dir.clone()).unwrap();

        let remote = CloudVault {
            schema: 1,
            app: "ryz-projectup".to_string(),
            updated_at: now_iso(),
            projects: vec![sample_project("p1")],
            backups: vec![sample_backup("b1", "p1")],
        };

        assert!(state.merge_cloud_vault(remote.clone()).unwrap());
        assert_eq!(state.lock().projects.len(), 1);
        assert_eq!(state.lock().backups.len(), 1);

        // Merging the same cloud index twice must not duplicate records.
        assert!(!state.merge_cloud_vault(remote).unwrap());
        assert_eq!(state.lock().projects.len(), 1);
        assert_eq!(state.lock().backups.len(), 1);

        let vault = state.cloud_vault();
        assert_eq!(vault.schema, 1);
        assert_eq!(vault.app, "ryz-projectup");
        assert_eq!(vault.projects.len(), 1);
        assert_eq!(vault.backups.len(), 1);

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn rejects_newer_cloud_vault_schema() {
        let dir = std::env::temp_dir().join(format!("ryz-projectup-state-{}", uuid::Uuid::new_v4()));
        let state = AppState::new(dir.clone()).unwrap();
        let remote = CloudVault {
            schema: 2,
            app: "ryz-projectup".to_string(),
            updated_at: now_iso(),
            projects: vec![sample_project("p1")],
            backups: vec![],
        };
        assert!(state.merge_cloud_vault(remote).is_err());
        assert_eq!(state.lock().projects.len(), 0);
        let _ = fs::remove_dir_all(&dir);
    }
}
