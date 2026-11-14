use std::fs::{self, File};
use std::io::{BufWriter, Read, Write};
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Instant;

use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipWriter};

use crate::scanner::ScanFile;

pub struct ArchiveResult {
    pub zip_size: u64,
    pub file_count: u64,
    pub warnings: Vec<String>,
}

pub fn create_archive(
    files: &[ScanFile],
    dest: &Path,
    compression_level: i64,
    total_bytes: u64,
    cancel: &AtomicBool,
    on_progress: &mut dyn FnMut(u64, u64, u64),
) -> Result<ArchiveResult, String> {
    if files.is_empty() {
        return Err("No files to archive after applying ignore rules.".to_string());
    }

    let out = File::create(dest)
        .map_err(|e| format!("Could not create archive at {}: {e}", dest.display()))?;
    let mut zip = ZipWriter::new(BufWriter::new(out));

    let method = if compression_level > 0 {
        CompressionMethod::Deflated
    } else {
        CompressionMethod::Stored
    };
    let options = SimpleFileOptions::default()
        .compression_method(method)
        .compression_level(if compression_level > 0 {
            Some(compression_level.clamp(1, 9))
        } else {
            None
        })
        .unix_permissions(0o644)
        .large_file(true);

    let mut warnings: Vec<String> = Vec::new();
    let mut done_bytes: u64 = 0;
    let mut added_files: u64 = 0;
    let mut last_emit = Instant::now();
    let mut buffer = vec![0u8; 256 * 1024];

    for file in files {
        if cancel.load(Ordering::Relaxed) {
            let _ = zip.finish();
            let _ = fs::remove_file(dest);
            return Err("Backup cancelled".to_string());
        }

        let mut source = match File::open(&file.abs) {
            Ok(source) => source,
            Err(err) => {
                if warnings.len() < 30 {
                    warnings.push(format!("Skipped {}: {err}", file.rel));
                }
                done_bytes = done_bytes.saturating_add(file.size);
                continue;
            }
        };

        if let Err(err) = zip.start_file(&file.rel, options) {
            return Err(format!("Could not write archive entry {}: {err}", file.rel));
        }

        loop {
            if cancel.load(Ordering::Relaxed) {
                let _ = zip.finish();
                let _ = fs::remove_file(dest);
                return Err("Backup cancelled".to_string());
            }
            let read = match source.read(&mut buffer) {
                Ok(0) => break,
                Ok(n) => n,
                Err(err) => {
                    return Err(format!("Could not read {}: {err}", file.rel));
                }
            };
            if let Err(err) = zip.write_all(&buffer[..read]) {
                return Err(format!("Could not compress {}: {err}", file.rel));
            }
            done_bytes = done_bytes.saturating_add(read as u64);
            if last_emit.elapsed().as_millis() >= 130 {
                on_progress(done_bytes, total_bytes, added_files);
                last_emit = Instant::now();
            }
        }

        added_files += 1;
        on_progress(done_bytes, total_bytes, added_files);
        last_emit = Instant::now();
    }

    let mut writer = zip
        .finish()
        .map_err(|e| format!("Could not finalize archive: {e}"))?;
    writer
        .flush()
        .map_err(|e| format!("Could not flush archive: {e}"))?;
    drop(writer);

    let zip_size = fs::metadata(dest)
        .map_err(|e| format!("Could not inspect archive: {e}"))?
        .len();

    Ok(ArchiveResult {
        zip_size,
        file_count: added_files,
        warnings,
    })
}

/// Extract a snapshot into `target`, refusing absolute paths and `..` traversal.
/// Returns the number of regular files written.
pub fn extract_archive(
    archive_path: &Path,
    target: &Path,
    cancel: &AtomicBool,
    on_progress: &mut dyn FnMut(u64, u64),
) -> Result<u64, String> {
    fs::create_dir_all(target)
        .map_err(|e| format!("Could not create {}: {e}", target.display()))?;

    let file = File::open(archive_path)
        .map_err(|e| format!("Could not open the downloaded snapshot: {e}"))?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| format!("Downloaded snapshot is not a valid zip: {e}"))?;

    let total_entries = archive.len() as u64;
    let mut extracted_files: u64 = 0;

    for index in 0..archive.len() {
        if cancel.load(Ordering::Relaxed) {
            return Err("Restore cancelled.".to_string());
        }

        let mut entry = archive
            .by_index(index)
            .map_err(|e| format!("Could not read archive entry: {e}"))?;
        let enclosed = match entry.enclosed_name() {
            Some(path) => path.to_path_buf(),
            None => continue,
        };
        let out_path = target.join(&enclosed);
        if !out_path.starts_with(target) {
            continue;
        }

        if entry.is_dir() {
            fs::create_dir_all(&out_path)
                .map_err(|e| format!("Could not create {}: {e}", out_path.display()))?;
        } else {
            if let Some(parent) = out_path.parent() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("Could not create {}: {e}", parent.display()))?;
            }
            let mut output = File::create(&out_path)
                .map_err(|e| format!("Could not write {}: {e}", out_path.display()))?;
            std::io::copy(&mut entry, &mut output)
                .map_err(|e| format!("Could not extract {}: {e}", out_path.display()))?;
            extracted_files += 1;
        }

        on_progress((index + 1) as u64, total_entries.max(1));
    }

    if total_entries == 0 {
        on_progress(1, 1);
    }

    Ok(extracted_files)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::scanner::ScanFile;
    use std::io::Read;

    #[test]
    fn creates_a_readable_zip_and_extracts_it() {
        let root = std::env::temp_dir().join(format!("ryz-projectup-zip-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(root.join("src")).unwrap();
        fs::write(root.join("src/a.txt"), "hello").unwrap();
        fs::write(root.join("b.txt"), "world!").unwrap();

        let files = vec![
            ScanFile {
                rel: "src/a.txt".to_string(),
                abs: root.join("src/a.txt"),
                size: 5,
            },
            ScanFile {
                rel: "b.txt".to_string(),
                abs: root.join("b.txt"),
                size: 6,
            },
        ];
        let archive_path = root.join("snapshot.zip");
        let cancel = AtomicBool::new(false);
        let mut ticks = 0u32;
        let result = create_archive(&files, &archive_path, 6, 11, &cancel, &mut |_, _, _| {
            ticks += 1;
        })
        .unwrap();

        assert_eq!(result.file_count, 2);
        assert_eq!(result.warnings.len(), 0);
        assert!(result.zip_size > 0);
        assert!(ticks > 0);

        let file = File::open(&archive_path).unwrap();
        let mut zip = zip::ZipArchive::new(file).unwrap();
        assert_eq!(zip.len(), 2);
        let mut entry = zip.by_name("src/a.txt").unwrap();
        let mut content = String::new();
        entry.read_to_string(&mut content).unwrap();
        assert_eq!(content, "hello");
        drop(entry);
        drop(zip);

        let restore_dir = root.join("restored");
        let extracted = extract_archive(&archive_path, &restore_dir, &cancel, &mut |_, _| {}).unwrap();
        assert_eq!(extracted, 2);
        assert_eq!(fs::read_to_string(restore_dir.join("src/a.txt")).unwrap(), "hello");
        assert_eq!(fs::read_to_string(restore_dir.join("b.txt")).unwrap(), "world!");

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn refuses_to_start_when_cancelled() {
        let cancel = AtomicBool::new(true);
        let files: Vec<ScanFile> = Vec::new();
        let root = std::env::temp_dir().join(format!("ryz-projectup-zip-{}", uuid::Uuid::new_v4()));
        let archive_path = root.join("should-not-exist.zip");
        let result = create_archive(&files, &archive_path, 6, 0, &cancel, &mut |_, _, _| {});
        assert!(result.is_err());
        assert!(!archive_path.exists());
    }
}

