<p align="center">
  <img src="docs/logo.png" width="96" alt="RYZ ProjectUp" />
</p>

<h1 align="center">RYZ ProjectUp</h1>

<p align="center">
  <strong>Git-aware project backups, straight to your Google Drive.</strong><br />
  Select a folder. ProjectUp reads its <code>.gitignore</code>, skips the noise, builds a compressed snapshot, and uploads it directly to your own Drive.
</p>

<p align="center">
  <a href="https://github.com/riyazalsodie/RYZ-ProjectUp/releases"><img alt="Status: Beta" src="https://img.shields.io/badge/status-beta-00ff88?style=flat-square" /></a>
  <a href="https://github.com/riyazalsodie/RYZ-ProjectUp/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/riyazalsodie/RYZ-ProjectUp/actions/workflows/ci.yml/badge.svg" /></a>
  <img alt="Version 0.1.0-beta.1" src="https://img.shields.io/badge/version-0.1.0--beta.1-00ff88?style=flat-square" />
  <img alt="Platforms" src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-0b0f0d?style=flat-square" />
  <img alt="Tauri 2" src="https://img.shields.io/badge/Tauri-2-24C8DB?style=flat-square&logo=tauri&logoColor=white" />
  <img alt="Rust" src="https://img.shields.io/badge/Rust-1.88%2B-000000?style=flat-square&logo=rust" />
  <img alt="React 18" src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black" />
  <img alt="MIT License" src="https://img.shields.io/badge/license-MIT-00ff88?style=flat-square" />
</p>

<p align="center">
  <a href="#download">Download</a> ·
  <a href="#quick-start">Quick start</a> ·
  <a href="#google-drive-setup">Google Drive setup</a> ·
  <a href="#development">Development</a> ·
  <a href="#beta-notes">Beta notes</a>
</p>

![RYZ ProjectUp dashboard](docs/screenshot-dashboard.png)

> Preview with sample data. The OLED black + green theme and rounded, frameless window are the real app UI.

---

## What is RYZ ProjectUp?

RYZ ProjectUp is a **local-first desktop backup vault** for code and project folders. It is built with **Tauri 2, Rust, React 18 and TypeScript**, and it talks **directly to Google Drive** using your own Google OAuth client — no RYZ servers, no telemetry, no middleman.

It is designed for developers who want a one-click, git-aware snapshot of a project without committing build artifacts, dependencies or secrets.

```text
Select a folder  →  Read ignore rules  →  Build zip locally  →  Upload to Drive  →  Keep or restore any version
```

---

## Features

| | |
| --- | --- |
| **Git-aware scanning** | Reads the full `.gitignore` spec — nested files, globs, directory rules and negations — using the same Rust `ignore` engine that powers ripgrep. |
| **Ignore Inspector** | See exactly what will go into a snapshot, what will be skipped, why it was skipped, and how much space is saved. |
| **Direct Google Drive uploads** | Streams a compressed snapshot to your own Drive folder. No RYZ cloud in the middle. |
| **OAuth 2.0 + PKCE** | Connects through a loopback redirect and your own Desktop OAuth client. Tokens never pass through a third party. |
| **Snapshot retention** | Keep the last N backups per project — older Drive files are cleaned up automatically. |
| **Restore anywhere** | Download any snapshot and extract it into a fresh folder. Zip-slip protected. |
| **Backup history** | Search, open in Drive, restore or delete every snapshot from one place. |
| **Extra ignore rules** | Add global patterns on top of each project's rules, or drop a `.ryzignore` file inside a project. |
| **In-app setup guide** | A complete Google Cloud walkthrough with direct links, test-user steps and OAuth troubleshooting. |
| **OLED UI** | Pitch-black surfaces, `#00FF88` accents, rounded cards and dialogs, custom frameless title bar and subtle motion. |

### A closer look

| Backup history | Ignore Inspector |
| --- | --- |
| <img src="docs/screenshot-backups.png" alt="Backup history" /> | <img src="docs/screenshot-ignore.png" alt="Ignore Inspector" /> |

### Google Drive setup, inside the app

<p align="center">
  <img src="docs/screenshot-oauth-guide.png" width="820" alt="In-app Google OAuth setup guide" />
</p>

The built-in guide covers creating the Google Cloud project, enabling the Drive API, the consent screen, test users, the `drive.file` scope, creating a **Desktop app** OAuth client, and fixing common OAuth errors.

---

## Download

Grab the latest **beta** from the [Releases page](https://github.com/riyazalsodie/RYZ-ProjectUp/releases).

| Build | File | Notes |
| --- | --- | --- |
| Windows installer | `RYZ ProjectUp 0.1.0-beta.1 Setup.exe` | NSIS, per-user install, no admin required |
| Windows portable | `RYZ ProjectUp 0.1.0-beta.1.exe` | Run from any folder |

**Requirements:** Windows 10/11 with the WebView2 runtime (preinstalled on modern Windows). macOS and Linux build from source; beta testing is currently Windows-first.

> The beta installer is **unsigned**. Windows SmartScreen may show “Windows protected your PC” — choose **More info → Run anyway** if you downloaded it from this repository's Releases page.

---

## Quick start

1. **Install** RYZ ProjectUp (or run the portable exe).
2. Click **Add project** and choose a project folder.
3. Optional: open the project's **···** menu → **Inspect ignore rules** to preview the snapshot.
4. Click **Connect Google Drive** and follow the in-app guide (one-time OAuth setup).
5. Click **Back up** on any project.
6. Open **Backup History** to restore a snapshot or jump to the file in Google Drive.

ProjectUp creates its Drive folder (`RYZ ProjectUp` by default) on the first backup.

---

## Google Drive setup

ProjectUp does **not** ship a Google OAuth client. Each user connects their own Drive. It takes about **3 minutes** and is free.

1. Open [Google Cloud Console](https://console.cloud.google.com/) and create (or select) a project.
2. Enable the [Google Drive API](https://console.cloud.google.com/apis/library/drive.googleapis.com).
3. Configure the **OAuth consent screen** (now under **Google Auth Platform**):
   - User type: **External**
   - Add your Google account under **Audience → Test users**
   - Add the `https://www.googleapis.com/auth/drive.file` scope under **Data access**
4. Create an OAuth client under **Credentials → Create credentials → OAuth client ID**:
   - Application type: **Desktop app**
   - Copy the **Client ID** and **Client secret**
5. In ProjectUp, open **Connect Google Drive**, paste both values, and click **Continue with Google**.
6. If Google says the app is not verified, choose **Advanced → Go to RYZ ProjectUp (unsafe)**. This is expected for your own test app.

The app requests:

```text
openid email profile https://www.googleapis.com/auth/drive.file
```

`drive.file` is intentionally narrow: ProjectUp can create and manage **only the files it uploaded**. It cannot read the rest of your Drive.

### OAuth troubleshooting

| Symptom | Fix |
| --- | --- |
| `Access blocked` / app not verified | Add your Google account under **Audience → Test users**, or publish the OAuth app. |
| `Drive API has not been used…` | Enable the **Google Drive API** in the same Google Cloud project. |
| `invalid_grant` / access expired | Testing-mode refresh tokens expire after about 7 days. Disconnect and reconnect Drive, or publish the app. |
| `Google did not return a refresh token` | Remove RYZ ProjectUp from [your Google permissions](https://myaccount.google.com/permissions), then reconnect. |
| Browser never returns | Allow the loopback callback (`127.0.0.1`), check your firewall and default browser. |

---

## How ignore rules work

ProjectUp applies, in order:

1. **Built-in exclusions** — `.git` is always skipped.
2. The project's **`.gitignore`** (including nested files).
3. **`.ignore`** files supported by the `ignore` crate.
4. An optional **`.ryzignore`** file in the project root.
5. Your global **Always ignore** patterns in Settings.

Hidden files such as `.env` are included unless a rule excludes them. Add `.env`, `*.pem` or other secrets to **Settings → Always ignore** if you do not want them in a snapshot.

> Standard Git behavior applies: a file cannot be re-included with `!pattern` if its parent directory is excluded. Ignore the directory's contents (`secret/*`) instead if you need negations.

---

## Where your data lives

| Data | Location |
| --- | --- |
| Projects, backup history, settings | `%APPDATA%\com.ryz.projectup` (Windows) |
| OAuth tokens | `auth.json` in the same local data folder |
| WebView2 cache | `%LOCALAPPDATA%\com.ryz.projectup` |
| Snapshots | Your Google Drive → `RYZ ProjectUp` folder |
| Temporary zip | OS temp folder — deleted after upload or restore |

The app data folder contains your Drive **refresh token**. Treat it as sensitive; the token is stored as plain local JSON, not encrypted. Use full-disk encryption and a locked user account on shared machines.

---

## Tech stack

- **Tauri 2** — native shell, IPC commands and progress events
- **Rust** — `ignore`, `zip`, `reqwest` (rustls), `serde`, `chrono`
- **React 18 + TypeScript** — typed UI, Tauri event listeners
- **Tailwind CSS 3 + shadcn/ui patterns** — OLED design system, Radix primitives
- **Framer Motion + Sonner** — page motion and toasts

### Project structure

```text
src/
  components/           UI dialogs, cards, title bar, sidebar
  components/ui/        shadcn-style primitives
  pages/                Projects, Backup History, Settings
  hooks/                window controls
  lib/                  class utilities
src-tauri/src/
  commands.rs           Tauri commands + backup/restore orchestration
  scanner.rs            .gitignore-aware filesystem walker
  archive.rs            streaming zip creation + safe extraction
  drive.rs              Google OAuth (PKCE), Drive API, upload/download
  state.rs              in-memory state + snapshot views
  store.rs              atomic JSON persistence
  models.rs             serialized DTOs
  lib.rs                app setup and invoke handler
docs/                   README screenshots and logo
assets/                 app icon source
```

---

## Development

### Prerequisites

- [Bun](https://bun.sh/) 1.2+
- [Rust](https://rustup.rs/) 1.88+
- Windows: WebView2 + MSVC build tools
- macOS: Xcode command line tools
- Linux: WebKitGTK 4.1 and related Tauri dependencies

### Commands

```bash
bun install                 # install frontend dependencies
bun tauri dev               # run the desktop app with HMR
bun run build               # typecheck + production frontend build
bunx tsc --noEmit           # typecheck only
cargo test --manifest-path src-tauri/Cargo.toml
bun tauri build --bundles nsis
```

The release installer and portable exe are written to:

```text
src-tauri/target/release/bundle/nsis/
src-tauri/target/release/ryz-projectup.exe
```

Regenerate icons after changing `assets/icon.svg`:

```bash
bunx tauri icon assets/icon.svg -o src-tauri/icons
```

### Tauri commands

| Command | Purpose |
| --- | --- |
| `get_app_state` | Projects, history, settings, Drive status |
| `add_project` / `refresh_project` / `remove_project` | Manage the vault |
| `scan_project_preview` | Included/ignored samples + stats |
| `save_settings` | Snapshot rules and OAuth credentials |
| `drive_connect` / `drive_disconnect` / `cancel_drive_auth` | Google Drive session |
| `run_backup` / `cancel_backup` | Create + upload a snapshot |
| `restore_backup` | Download + extract a snapshot |
| `delete_backup` | Remove local record and optionally the Drive file |
| `open_url` / `reveal_path` | Open links and reveal folders |

Backup and restore progress is streamed to the UI through `backup-progress` and `restore-progress` events.

---

## Security & privacy

- **No RYZ servers.** Scanning, zipping and extracting happen locally. Uploads go from your PC directly to Google Drive.
- **Narrow Drive scope.** ProjectUp requests only `drive.file`; it cannot browse unrelated files.
- **Credentials stay local.** The OAuth Client ID, Client secret and refresh token live in the local app data folder.
- **Snapshots are compressed, not encrypted.** If your project contains secrets, use Drive/OS-level encryption or exclude those files. Backup zips are only as private as the Google account that holds them.
- **Path traversal protection.** Restore uses zip entry name validation and refuses paths outside the restore directory.
- **Beta installer is unsigned.** Verify the SHA-256 on the release page before running.

Found a security issue? Please use the private reporting flow in [SECURITY.md](SECURITY.md) — do not open a public issue for vulnerabilities.

---

## Beta notes

This is the first public beta. What works today:

- Add/scan projects with Git-aware ignore rules
- Inspect include/ignore decisions
- One-click uploads to Google Drive
- Retention cleanup
- Backup history, restore and delete
- In-app Google OAuth setup guide
- OLED desktop UI and native window controls

Known limitations / not yet included:

- No scheduled or background automatic backups
- No incremental/delta snapshots — each backup is a full zip
- No client-side encryption of snapshots
- One Drive destination folder per configuration
- No auto-update channel yet
- Requires your own Google OAuth client
- Windows is the primary tested target; macOS/Linux builds are source-supported

### Roadmap

- [ ] Scheduled backups with a background tray mode
- [ ] Incremental snapshots and deduplication
- [ ] Optional client-side encryption
- [ ] Multiple Drive destinations / per-project folders
- [ ] Signed installers and auto-update
- [ ] Cross-platform release testing
- [ ] More theme accents while keeping OLED black

---

## Contributing

Issues and pull requests are welcome.

1. Fork the repository.
2. Create a branch: `git checkout -b feat/your-idea`
3. Install with `bun install`.
4. Run `bunx tsc --noEmit` and `cargo test --manifest-path src-tauri/Cargo.toml`.
5. Keep the UI consistent with the existing OLED + `#00FF88` design system.
6. Open a PR with screenshots for UI changes.

Never commit OAuth client secrets, refresh tokens, `auth.json`, or app data. See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## License

MIT © 2026 **R ! Y 4 Z**

See [LICENSE](LICENSE).

---

<p align="center">
  <sub>Built with Rust, Tauri, React and an unhealthy appreciation for pitch black.</sub>
</p>
