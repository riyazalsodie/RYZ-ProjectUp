use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};

use ignore::gitignore::{Gitignore, GitignoreBuilder};
use ignore::WalkBuilder;

use crate::models::{now_iso, IgnoredSample, ProjectStats, Settings};

pub struct ScanFile {
    pub rel: String,
    pub abs: PathBuf,
    pub size: u64,
}

pub struct ScanOutcome {
    pub files: Vec<ScanFile>,
    pub stats: ProjectStats,
    pub ignored_samples: Vec<IgnoredSample>,
    pub included_samples: Vec<String>,
    pub warnings: Vec<String>,
}

fn is_git_entry(path: &Path) -> bool {
    path.file_name()
        .map(|name| name == ".git")
        .unwrap_or(false)
}

fn push_warning(warnings: &mut Vec<String>, message: String) {
    if warnings.len() < 30 {
        warnings.push(message);
    }
}

fn build_matcher(root: &Path, file_name: Option<&str>, extras: &[String]) -> Gitignore {
    let mut builder = GitignoreBuilder::new(root);
    if let Some(name) = file_name {
        let candidate = root.join(name);
        if candidate.is_file() {
            let _ = builder.add(&candidate);
        }
    }
    for line in extras {
        let trimmed = line.trim();
        if !trimmed.is_empty() {
            let _ = builder.add_line(None, trimmed);
        }
    }
    builder.build().unwrap_or_else(|_| Gitignore::empty())
}

fn ignore_reason(
    rel: &Path,
    gitignore: &Gitignore,
    ryzignore: &Gitignore,
    extras: &Gitignore,
) -> Option<String> {
    if gitignore.matched_path_or_any_parents(rel, false).is_ignore() {
        return Some(".gitignore".to_string());
    }
    if ryzignore.matched_path_or_any_parents(rel, false).is_ignore() {
        return Some(".ryzignore".to_string());
    }
    if extras.matched_path_or_any_parents(rel, false).is_ignore() {
        return Some("custom rule".to_string());
    }
    None
}

/// Walk the project using its own ignore files, collect every file that will be
/// archived, and measure what was skipped.
pub fn scan_project<F>(
    root: &Path,
    settings: &Settings,
    sample_limit: usize,
    cancel: &AtomicBool,
    on_found: &mut F,
) -> Result<ScanOutcome, String>
where
    F: FnMut(u64),
{
    if cancel.load(Ordering::Relaxed) {
        return Err("Backup cancelled".to_string());
    }

    let gitignore_present = root.join(".gitignore").is_file();
    let ryzignore_present = root.join(".ryzignore").is_file();

    let root_gitignore = build_matcher(root, Some(".gitignore"), &[]);
    let root_ryzignore = build_matcher(root, Some(".ryzignore"), &[]);
    let extra_matcher = build_matcher(root, None, &settings.extra_ignore_patterns);

    // Pass 1 — files that will actually be archived.
    let mut included_walker = WalkBuilder::new(root);
    included_walker
        .hidden(false)
        .ignore(true)
        .git_ignore(settings.respect_gitignore)
        .git_global(false)
        .git_exclude(settings.respect_gitignore)
        .parents(false)
        .require_git(false)
        .follow_links(false)
        .add_custom_ignore_filename(".ryzignore");

    // Prune extra-ignored directories during the walk as well (keeps huge
    // folders like node_modules from being traversed twice).
    let extra_for_filter = extra_matcher.clone();
    let root_for_filter = root.to_path_buf();
    included_walker.filter_entry(move |entry| {
        if is_git_entry(entry.path()) {
            return false;
        }
        if entry.depth() == 0 {
            return true;
        }
        let rel = match entry.path().strip_prefix(&root_for_filter) {
            Ok(rel) => rel,
            Err(_) => return true,
        };
        let is_dir = entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false);
        !extra_for_filter
            .matched_path_or_any_parents(rel, is_dir)
            .is_ignore()
    });

    let mut files: Vec<ScanFile> = Vec::new();
    let mut included_bytes: u64 = 0;
    let mut included_samples: Vec<String> = Vec::new();
    let mut warnings: Vec<String> = Vec::new();
    let mut found_since_tick: u64 = 0;

    for result in included_walker.build() {
        if cancel.load(Ordering::Relaxed) {
            return Err("Backup cancelled".to_string());
        }
        let entry = match result {
            Ok(entry) => entry,
            Err(err) => {
                push_warning(&mut warnings, format!("Skipped unreadable entry: {err}"));
                continue;
            }
        };

        if entry.depth() == 0 {
            continue;
        }

        let path = entry.path();
        let meta = match fs::symlink_metadata(path) {
            Ok(meta) => meta,
            Err(err) => {
                push_warning(&mut warnings, format!("Could not read {}: {err}", path.display()));
                continue;
            }
        };
        if !meta.file_type().is_file() {
            continue;
        }

        let rel_path = match path.strip_prefix(root) {
            Ok(rel) => rel,
            Err(_) => continue,
        };
        if extra_matcher
            .matched_path_or_any_parents(rel_path, false)
            .is_ignore()
        {
            continue;
        }

        let rel = rel_path.to_string_lossy().replace('\\', "/");
        let size = meta.len();

        if included_samples.len() < sample_limit {
            included_samples.push(rel.clone());
        }

        included_bytes = included_bytes.saturating_add(size);
        files.push(ScanFile {
            rel,
            abs: path.to_path_buf(),
            size,
        });

        found_since_tick += 1;
        if found_since_tick >= 128 {
            found_since_tick = 0;
            on_found(files.len() as u64);
        }
    }
    on_found(files.len() as u64);

    let included_set: HashSet<String> = files.iter().map(|f| f.rel.clone()).collect();

    // Pass 2 — everything on disk (minus .git) to measure what was skipped.
    let mut all_walker = WalkBuilder::new(root);
    all_walker
        .hidden(false)
        .ignore(false)
        .git_ignore(false)
        .git_global(false)
        .git_exclude(false)
        .parents(false)
        .require_git(false)
        .follow_links(false);
    all_walker.filter_entry(|entry| !is_git_entry(entry.path()));

    let mut total_files: u64 = 0;
    let mut ignored_files: u64 = 0;
    let mut ignored_bytes: u64 = 0;
    let mut ignored_samples: Vec<IgnoredSample> = Vec::new();

    for result in all_walker.build() {
        if cancel.load(Ordering::Relaxed) {
            return Err("Backup cancelled".to_string());
        }
        let entry = match result {
            Ok(entry) => entry,
            Err(_) => continue,
        };
        if entry.depth() == 0 {
            continue;
        }
        let path = entry.path();
        let meta = match fs::symlink_metadata(path) {
            Ok(meta) => meta,
            Err(_) => continue,
        };
        if !meta.file_type().is_file() {
            continue;
        }
        total_files += 1;

        let rel_path = match path.strip_prefix(root) {
            Ok(rel) => rel,
            Err(_) => continue,
        };
        let rel = rel_path.to_string_lossy().replace('\\', "/");
        if included_set.contains(&rel) {
            continue;
        }

        ignored_files += 1;
        ignored_bytes = ignored_bytes.saturating_add(meta.len());

        if ignored_samples.len() < sample_limit {
            let reason = ignore_reason(rel_path, &root_gitignore, &root_ryzignore, &extra_matcher);
            ignored_samples.push(IgnoredSample {
                path: rel,
                pattern: reason,
            });
        }
    }

    let stats = ProjectStats {
        total_files,
        included_files: files.len() as u64,
        ignored_files,
        included_bytes,
        ignored_bytes,
        gitignore_present,
        ryzignore_present,
        scanned_at: now_iso(),
    };

    Ok(ScanOutcome {
        files,
        stats,
        ignored_samples,
        included_samples,
        warnings,
    })
}

/// Cheap stats-only scan (still walks the tree once, but does not retain file paths).
pub fn scan_stats(
    root: &Path,
    settings: &Settings,
    cancel: &AtomicBool,
) -> Result<ProjectStats, String> {
    let mut noop = |_: u64| {};
    scan_project(root, settings, 1, cancel, &mut noop).map(|outcome| outcome.stats)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::Settings;
    use std::fs;

    fn make_project() -> PathBuf {
        let root = std::env::temp_dir().join(format!("ryz-projectup-scan-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(root.join("src")).unwrap();
        fs::create_dir_all(root.join("node_modules/pkg")).unwrap();
        fs::create_dir_all(root.join("secret")).unwrap();
        fs::create_dir_all(root.join("dist")).unwrap();
        fs::create_dir_all(root.join("cache")).unwrap();

        fs::write(
            root.join(".gitignore"),
            "node_modules/\n*.log\nsecret/*\n!secret/keep.txt\n",
        )
        .unwrap();
        fs::write(root.join(".ryzignore"), "dist/\n").unwrap();
        fs::write(root.join("README.md"), "hello").unwrap();
        fs::write(root.join("debug.log"), "log").unwrap();
        fs::write(root.join("node_modules/pkg/index.js"), "module").unwrap();
        fs::write(root.join("secret/private.txt"), "no").unwrap();
        fs::write(root.join("secret/keep.txt"), "yes").unwrap();
        fs::write(root.join("dist/bundle.js"), "built").unwrap();
        fs::write(root.join("cache/data.bin"), "cached").unwrap();
        fs::write(root.join("src/main.rs"), "fn main() {}").unwrap();
        fs::write(root.join("Thumbs.db"), "junk").unwrap();
        fs::write(root.join(".env"), "SECRET=1").unwrap();
        fs::create_dir_all(root.join(".git")).unwrap();
        fs::write(root.join(".git/config"), "[core]").unwrap();
        root
    }

    #[test]
    fn honors_nested_ignore_rules_without_git_directory() {
        let root = make_project();
        let mut settings = Settings::default();
        settings.extra_ignore_patterns.push(".env".to_string());
        settings.extra_ignore_patterns.push("cache/".to_string());
        let cancel = AtomicBool::new(false);
        let mut noop = |_: u64| {};
        let outcome = scan_project(&root, &settings, 50, &cancel, &mut noop).unwrap();
        let names: HashSet<&str> = outcome.files.iter().map(|file| file.rel.as_str()).collect();

        // Safe, tracked files survive.
        assert!(names.contains("README.md"));
        assert!(names.contains("src/main.rs"));
        assert!(names.contains(".gitignore"));
        assert!(names.contains(".ryzignore"));
        // Negation inside .gitignore is honored.
        assert!(names.contains("secret/keep.txt"));

        // Ignored files are pruned.
        assert!(!names.contains("debug.log"));
        assert!(!names.contains("node_modules/pkg/index.js"));
        assert!(!names.contains("secret/private.txt"));
        assert!(!names.contains("dist/bundle.js"));
        assert!(!names.contains("Thumbs.db"));
        assert!(!names.contains(".env"));
        assert!(!names.contains(".git/config"));
        assert!(!names.contains("cache/data.bin"));

        assert!(outcome.stats.gitignore_present);
        assert!(outcome.stats.ryzignore_present);
        assert_eq!(outcome.stats.included_files, names.len() as u64);
        assert_eq!(
            outcome.stats.ignored_files,
            outcome.stats.total_files - outcome.stats.included_files
        );
        assert!(outcome
            .ignored_samples
            .iter()
            .any(|sample| sample.path == ".env" && sample.pattern.as_deref() == Some("custom rule")));

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn can_disable_gitignore_rules() {
        let root = make_project();
        let mut settings = Settings::default();
        settings.respect_gitignore = false;
        settings.extra_ignore_patterns.clear();
        let cancel = AtomicBool::new(false);
        let mut noop = |_: u64| {};
        let outcome = scan_project(&root, &settings, 50, &cancel, &mut noop).unwrap();
        let names: HashSet<&str> = outcome.files.iter().map(|file| file.rel.as_str()).collect();

        assert!(names.contains("debug.log"));
        assert!(names.contains("node_modules/pkg/index.js"));
        // .ryzignore is still honored.
        assert!(!names.contains("dist/bundle.js"));

        let _ = fs::remove_dir_all(&root);
    }
}

