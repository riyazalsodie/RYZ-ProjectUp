# Security Policy

## Supported versions

| Version | Supported |
| --- | --- |
| `0.2.x-beta` | ✅ |
| `0.1.x-beta` | ❌ (please update) |

RYZ ProjectUp is currently a beta. Security fixes will be shipped in the latest beta.

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

Use GitHub's private vulnerability reporting:

**https://github.com/riyazalsodie/RYZ-ProjectUp/security/advisories/new**

Please include:

- A short description of the issue and its impact
- Steps to reproduce
- App version, OS and installation method
- Relevant logs or screenshots with **tokens, client secrets and personal paths redacted**

You will get an acknowledgement as soon as possible. Please give us a reasonable window to fix the issue before public disclosure.

## Security model

- Scanning, compression and extraction run locally in the Rust backend.
- Uploads go directly from the user's machine to Google Drive using the user's own OAuth client.
- The app requests only the `https://www.googleapis.com/auth/drive.file` scope.
- OAuth credentials and refresh tokens are stored in the local app data directory (`%APPDATA%\com.ryz.projectup` on Windows) as local JSON, **not encrypted at rest**. Protect the user account and disk accordingly.
- Backup snapshots are compressed zip archives and are **not encrypted** by ProjectUp. They are only as private as the Google account / Drive folder that holds them.
- The current beta installer is unsigned.

## In scope

- OAuth flow and callback handling (state validation, loopback listener, token handling)
- Token or client-secret exposure caused by the app
- Path traversal, zip-slip, symlink or archive extraction issues
- Scanning outside the selected project directory
- Command/argument injection in `open_url`, `reveal_path` or archive handling
- Unauthorized Drive access outside the `drive.file` scope
- Supply-chain or dependency issues in this repository

## Out of scope

- Vulnerabilities in Google Drive, Google OAuth or the user's browser
- A compromised local machine or malicious local process reading the user's app data
- SmartScreen warnings caused by the unsigned beta installer
- Social engineering
- Loss of data caused by deleting app data or Drive files manually

## Handling credentials

Never commit:

- `auth.json`
- OAuth client secrets
- refresh/access tokens
- personal project paths or `.env` files
- screenshots containing tokens or personal information

If a credential is leaked, delete the OAuth client in Google Cloud, create a new one, revoke the app's access at <https://myaccount.google.com/permissions>, and reconnect.
