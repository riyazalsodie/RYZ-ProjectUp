use std::fs;
use std::path::{Path, PathBuf};

use serde::de::DeserializeOwned;
use serde::Serialize;

#[derive(Clone, Debug)]
pub struct Store {
    dir: PathBuf,
}

impl Store {
    pub fn new(dir: PathBuf) -> Result<Self, String> {
        fs::create_dir_all(&dir)
            .map_err(|e| format!("Could not create app data directory {}: {e}", dir.display()))?;
        Ok(Self { dir })
    }

    pub fn data_dir(&self) -> &Path {
        &self.dir
    }

    fn path_for(&self, name: &str) -> PathBuf {
        self.dir.join(name)
    }

    pub fn load<T: DeserializeOwned>(&self, name: &str) -> Option<T> {
        let path = self.path_for(name);
        let raw = fs::read_to_string(&path).ok()?;
        match serde_json::from_str::<T>(&raw) {
            Ok(value) => Some(value),
            Err(err) => {
                eprintln!("Ignoring unreadable {}: {err}", path.display());
                None
            }
        }
    }

    pub fn load_or_default<T: DeserializeOwned + Default>(&self, name: &str) -> T {
        self.load(name).unwrap_or_default()
    }

    pub fn save<T: Serialize>(&self, name: &str, value: &T) -> Result<(), String> {
        let data = serde_json::to_string_pretty(value)
            .map_err(|e| format!("Could not serialize {name}: {e}"))?;
        let path = self.path_for(name);
        let tmp = self.path_for(&format!("{name}.tmp"));
        fs::write(&tmp, data).map_err(|e| format!("Could not write {}: {e}", tmp.display()))?;
        if path.exists() {
            // Windows refuses to rename over an existing file.
            let _ = fs::remove_file(&path);
        }
        fs::rename(&tmp, &path)
            .map_err(|e| format!("Could not finalize {}: {e}", path.display()))?;
        Ok(())
    }

    pub fn remove(&self, name: &str) {
        let _ = fs::remove_file(self.path_for(name));
    }
}
