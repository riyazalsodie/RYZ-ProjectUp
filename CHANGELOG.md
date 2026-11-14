# Changelog

All notable changes to RYZ ProjectUp are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/).

## [0.2.0-beta.1] — 2026-11-15

### Added

- Drive vault index sync: projects, original paths, stats and snapshot history are saved as `ryz-projectup-vault.json` inside the Drive backup folder
- Automatic vault restore when connecting the same Drive account on a new PC
- Automatic metadata sync after project add/remove, backups, snapshot deletion and app launch
- Manual **Settings → Sync** action
- **Relink folder** flow for restored projects whose local paths no longer exist
- `path_available` project state with a visible **Folder missing** warning
- Drive account sync button and vault-index privacy note in Settings
- Merge tests for the cloud vault index and newer-schema rejection

### Fixed

- Square window corners caused by the blurred dialog overlay escaping the rounded app shell
- Dialog overlays now use the same rounded radius as the window and become square only while maximized
- Ignore Inspector overflow on narrow windows with very long file paths
- Long path labels truncate with full paths available on hover

### Changed

- New-PC setup requires the same OAuth client, Google account and backup folder name
- Cloud sync is additive in this beta; local deletions do not propagate to other PCs' local vaults

### Security

- The Drive vault index contains no OAuth credentials or tokens
- Project paths and snapshot metadata stay inside the user's private Drive folder

## [0.1.0-beta.1] — 2026-11-15

Initial public beta.

### Added

- Git-aware project scanning using the `.gitignore` specification, nested ignore files, `.ignore` and `.ryzignore`
- Global "Always ignore" patterns in Settings
- Ignore Inspector with included/ignored samples, sizes and rule source
- Native project folder picker
- Google Drive OAuth 2.0 with PKCE and a loopback callback
- In-app Google Cloud / OAuth setup guide with direct console links
- Drive folder creation under a configurable name
- Streamed snapshot uploads with live progress and cancellation
- Snapshot retention (keep last N per project)
- Backup history with restore, open-in-Drive and delete actions
- Safe zip extraction with zip-slip protection
- Local atomic JSON persistence for projects, history, settings and tokens
- OLED pitch-black + `#00FF88` design system with rounded, frameless window
- Animated sidebar, stat cards, dialogs and toasts
- Rust tests for ignore scanning and archive round-trips

### Fixed

- Ignore Inspector dialog overflowing horizontally on narrow windows or very long file paths
- Dialog content now capped to the viewport with scrolling
- Long paths truncate with full path available on hover
- OAuth credential changes correctly require/clear the matching client secret
- Refresh/cancel flags reset before new Drive connection and backup jobs
- Temporary snapshot files cleaned up on every failure path

### Security

- `drive.file` scope only
- OAuth state validation
- Path containment checks during restore
- No hard-coded Google credentials
- Refresh tokens stored locally only

### Known limitations

- No scheduled / background backups
- Full snapshots only (no incremental/delta)
- No client-side snapshot encryption
- No auto-update
- Requires a user-owned Google OAuth client
- Windows is the primary tested platform

[0.1.0-beta.1]: https://github.com/riyazalsodie/RYZ-ProjectUp/releases/tag/v0.1.0-beta.1
[0.2.0-beta.1]: https://github.com/riyazalsodie/RYZ-ProjectUp/releases/tag/v0.2.0-beta.1
