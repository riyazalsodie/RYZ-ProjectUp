use std::path::PathBuf;
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex, MutexGuard};

use crate::models::{
    now_iso, AppSnapshot, BackupRecord, DriveStatus, DriveTokens, Project, ProjectStats,
    ProjectView, PublicSettings, Settings,
};
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
        let settings: Settings = store.load_or_default("settings.json");
        let tokens: Option<DriveTokens> = store.load("auth.json");

        Ok(Self {
            store,
            inner: Arc::new(Mutex::new(Inner {
                projects,
                backups,
                settings,
                tokens,
                backup_cancel: Arc::new(AtomicBool::new(false)),
                auth_cancel: Arc::new(AtomicBool::new(false)),
            })),
        })
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
        self.store.save("settings.json", &settings)
    }

    pub fn save_tokens(&self) -> Result<(), String> {
        let tokens = self.lock().tokens.clone();
        match tokens {
            Some(tokens) => self.store.save("auth.json", &tokens),
            None => {
                self.store.remove("auth.json");
                Ok(())
            }
        }
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
        }
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
