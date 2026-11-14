# Contributing to RYZ ProjectUp

Thanks for wanting to improve ProjectUp. This is a beta, so feedback and focused PRs are especially useful.

## Before you start

- Search existing issues and PRs first.
- For security issues, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.
- For large features, open an issue or discussion before writing a lot of code.

## Development setup

Requirements:

- [Bun](https://bun.sh/) 1.2+
- [Rust](https://rustup.rs/) 1.88+
- Windows: WebView2 + MSVC build tools
- macOS: Xcode command line tools
- Linux: WebKitGTK 4.1 + Tauri dependencies

```bash
bun install
bun tauri dev
```

Useful checks before opening a PR:

```bash
bunx tsc --noEmit
bun run build
cargo test --manifest-path src-tauri/Cargo.toml
```

## Code style

- Match the existing structure and naming.
- Keep the UI consistent with the OLED + `#00FF88` design language.
- Use rounded surfaces consistently; avoid square cards/buttons.
- Keep native work in Rust and UI work in React. Do not move filesystem or archive work into the webview.
- Keep user-facing strings clear and concise.
- Add a Rust test when touching scanning, archive or path handling.

## Commit and PR guidelines

- Use a short, descriptive commit message, e.g. `fix: truncate long ignore paths`.
- Keep PRs focused on one change.
- UI changes should include before/after screenshots or a short clip.
- Mention the commands you ran in the PR description.

## Do not commit

- OAuth Client secrets
- `auth.json` or refresh/access tokens
- `.env` files
- personal absolute paths
- screenshots containing account data or tokens
- app data directories

`docs/screenshot-*.png` are allowed and expected to use demo data only.

## License

By contributing, you agree that your contributions are licensed under the MIT License.
