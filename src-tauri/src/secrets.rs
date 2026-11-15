use std::fs;
use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::models::DriveTokens;

/// Sensitive Google data is kept out of settings.json/auth.json and stored in
/// one encrypted blob. On Windows the blob is protected by DPAPI, which binds
/// it to the current Windows user.
#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct Secrets {
    #[serde(default)]
    pub client_secret: String,
    #[serde(default)]
    pub tokens: Option<DriveTokens>,
}

pub fn secure_storage_available() -> bool {
    cfg!(windows)
}

pub fn secure_storage_label() -> &'static str {
    if cfg!(windows) {
        "Windows DPAPI"
    } else {
        "Local file"
    }
}

pub fn load(dir: &Path) -> Option<Secrets> {
    let path = dir.join("secrets.bin");
    let raw = fs::read(&path).ok()?;
    let plain = match unprotect(&raw) {
        Ok(value) => value,
        Err(err) => {
            eprintln!("Could not decrypt secrets.bin: {err}");
            return None;
        }
    };
    match serde_json::from_slice::<Secrets>(&plain) {
        Ok(secrets) => Some(secrets),
        Err(err) => {
            eprintln!("Could not read secrets.bin: {err}");
            None
        }
    }
}

pub fn save(dir: &Path, secrets: &Secrets) -> Result<(), String> {
    let plain = serde_json::to_vec(secrets)
        .map_err(|e| format!("Could not serialize secure settings: {e}"))?;
    let protected = protect(&plain)?;
    let path = dir.join("secrets.bin");
    let tmp = dir.join("secrets.bin.tmp");
    fs::write(&tmp, protected)
        .map_err(|e| format!("Could not write {}: {e}", tmp.display()))?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(&tmp, fs::Permissions::from_mode(0o600));
    }

    if path.exists() {
        let _ = fs::remove_file(&path);
    }
    fs::rename(&tmp, &path).map_err(|e| format!("Could not finalize {}: {e}", path.display()))
}

#[cfg(windows)]
fn protect(data: &[u8]) -> Result<Vec<u8>, String> {
    dpapi::protect(data)
}

#[cfg(windows)]
fn unprotect(data: &[u8]) -> Result<Vec<u8>, String> {
    dpapi::unprotect(data)
}

#[cfg(not(windows))]
fn protect(data: &[u8]) -> Result<Vec<u8>, String> {
    Ok(data.to_vec())
}

#[cfg(not(windows))]
fn unprotect(data: &[u8]) -> Result<Vec<u8>, String> {
    Ok(data.to_vec())
}

#[cfg(windows)]
mod dpapi {
    use std::ptr;

    use windows_sys::Win32::Foundation::{LocalFree, HLOCAL};
    use windows_sys::Win32::Security::Cryptography::{
        CryptProtectData, CryptUnprotectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
    };

    fn input_blob(data: &[u8]) -> CRYPT_INTEGER_BLOB {
        CRYPT_INTEGER_BLOB {
            cbData: data.len() as u32,
            pbData: data.as_ptr() as *mut u8,
        }
    }

    fn copy_output(output: CRYPT_INTEGER_BLOB) -> Vec<u8> {
        if output.pbData.is_null() || output.cbData == 0 {
            return Vec::new();
        }
        let bytes =
            unsafe { std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec() };
        unsafe {
            LocalFree(output.pbData as HLOCAL);
        }
        bytes
    }

    pub fn protect(data: &[u8]) -> Result<Vec<u8>, String> {
        let input = input_blob(data);
        let mut output = CRYPT_INTEGER_BLOB {
            cbData: 0,
            pbData: ptr::null_mut(),
        };
        let ok = unsafe {
            CryptProtectData(
                &input,
                ptr::null(),
                ptr::null(),
                ptr::null(),
                ptr::null(),
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut output,
            )
        };
        if ok == 0 {
            return Err(format!(
                "Windows DPAPI encryption failed: {}",
                std::io::Error::last_os_error()
            ));
        }
        Ok(copy_output(output))
    }

    pub fn unprotect(data: &[u8]) -> Result<Vec<u8>, String> {
        let input = input_blob(data);
        let mut output = CRYPT_INTEGER_BLOB {
            cbData: 0,
            pbData: ptr::null_mut(),
        };
        let ok = unsafe {
            CryptUnprotectData(
                &input,
                ptr::null_mut(),
                ptr::null(),
                ptr::null(),
                ptr::null(),
                0,
                &mut output,
            )
        };
        if ok == 0 {
            return Err(format!(
                "Windows DPAPI decryption failed: {}",
                std::io::Error::last_os_error()
            ));
        }
        Ok(copy_output(output))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn encrypts_and_reads_the_secret_blob() {
        let dir = std::env::temp_dir().join(format!("ryz-projectup-secrets-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        let secrets = Secrets {
            client_secret: "test-client-secret".to_string(),
            tokens: None,
        };
        save(&dir, &secrets).unwrap();
        let loaded = load(&dir).expect("secret blob should load");
        assert_eq!(loaded.client_secret, "test-client-secret");
        let _ = fs::remove_dir_all(&dir);
    }
}
