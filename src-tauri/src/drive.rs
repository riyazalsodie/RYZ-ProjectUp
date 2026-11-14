use std::fs::{self, File};
use std::io::{BufWriter, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use rand::RngCore;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};

use crate::models::{CloudVault, DriveTokens, UploadedFile};

const AUTH_ENDPOINT: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT: &str = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT: &str = "https://www.googleapis.com/oauth2/v3/userinfo";
const DRIVE_FILES_ENDPOINT: &str = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD_ENDPOINT: &str = "https://www.googleapis.com/upload/drive/v3/files";
const SCOPE: &str = "openid email profile https://www.googleapis.com/auth/drive.file";
const VAULT_FILE_NAME: &str = "ryz-projectup-vault.json";

fn http_client() -> Result<reqwest::blocking::Client, String> {
    reqwest::blocking::Client::builder()
        .connect_timeout(Duration::from_secs(30))
        .timeout(Duration::from_secs(3600))
        .user_agent(format!("RYZ-ProjectUp/{}", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|e| format!("Could not create HTTP client: {e}"))
}

fn now_epoch() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

fn random_verifier() -> String {
    const CHARSET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
    let mut rng = rand::thread_rng();
    (0..64)
        .map(|_| CHARSET[(rng.next_u32() as usize) % CHARSET.len()] as char)
        .collect()
}

fn random_state() -> String {
    let mut rng = rand::thread_rng();
    let mut bytes = [0u8; 24];
    rng.fill_bytes(&mut bytes);
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

fn escape_html(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

fn oauth_page(success: bool, message: &str) -> String {
    let accent = if success { "#00ff88" } else { "#ff5f56" };
    let glow = if success {
        "0 0 60px -10px rgba(0,255,136,0.65)"
    } else {
        "0 0 60px -10px rgba(255,95,86,0.65)"
    };
    let mark = if success { "&#10003;" } else { "&#10005;" };
    let heading = if success {
        "Google Drive connected"
    } else {
        "Authorization failed"
    };
    format!(
        r#"<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>RYZ ProjectUp</title>
<style>
  * {{ box-sizing: border-box; }}
  body {{
    margin: 0; min-height: 100vh; display: grid; place-items: center;
    background: #000; color: #f3f6f4;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background-image: radial-gradient(ellipse 60% 40% at 50% 0%, rgba(0,255,136,0.09), transparent 70%);
  }}
  .card {{
    width: min(440px, calc(100vw - 32px)); padding: 40px 32px; text-align: center;
    background: linear-gradient(180deg, #060c08, #020503);
    border: 1px solid rgba(0,255,136,0.18); border-radius: 28px;
    box-shadow: 0 30px 80px -30px #000, 0 0 50px -30px rgba(0,255,136,0.4);
  }}
  .mark {{
    width: 68px; height: 68px; margin: 0 auto 22px; display: grid; place-items: center;
    border-radius: 50%; border: 1px solid {accent}55; color: {accent};
    background: {accent}18; font-size: 30px; box-shadow: {glow};
  }}
  .brand {{ font-size: 10px; letter-spacing: 0.28em; color: #00ff8899; font-weight: 700; margin-bottom: 12px; }}
  h1 {{ font-size: 20px; margin: 0 0 10px; letter-spacing: -0.02em; }}
  p {{ margin: 0; font-size: 13px; line-height: 1.6; color: #8a9a90; }}
  .hint {{ margin-top: 24px; padding-top: 18px; border-top: 1px solid rgba(255,255,255,0.06); font-size: 11px; color: #5c6b62; }}
  .dot {{ display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #00ff88; margin-right: 6px; }}
</style>
</head>
<body>
  <div class="card">
    <div class="mark">{mark}</div>
    <div class="brand">RYZ PROJECTUP</div>
    <h1>{heading}</h1>
    <p>{message}</p>
    <div class="hint"><span class="dot"></span>You can close this tab and return to the app.</div>
  </div>
</body>
</html>"#,
        accent = accent,
        glow = glow,
        mark = mark,
        heading = heading,
        message = escape_html(message),
    )
}

fn write_oauth_response(stream: &mut TcpStream, success: bool, message: &str) {
    let html = oauth_page(success, message);
    let response = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\nCache-Control: no-store\r\n\r\n{}",
        html.as_bytes().len(),
        html
    );
    let _ = stream.write_all(response.as_bytes());
    let _ = stream.flush();
}

pub fn google_error(body: &str, status: u16) -> String {
    if let Ok(value) = serde_json::from_str::<Value>(body) {
        if let Some(message) = value.pointer("/error/message").and_then(|v| v.as_str()) {
            return format!("Google API error ({status}): {message}");
        }
        if let Some(description) = value.get("error_description").and_then(|v| v.as_str()) {
            return description.to_string();
        }
        if let Some(error) = value.get("error").and_then(|v| v.as_str()) {
            return format!("Google API error ({status}): {error}");
        }
    }
    let trimmed: String = body.chars().take(400).collect();
    format!("Google API error ({status}): {trimmed}")
}

/// Browser-based OAuth 2.0 with PKCE. Opens a loopback listener on a random
/// port and waits for Google to redirect back with an authorization code.
pub fn run_oauth_flow(
    client_id: &str,
    client_secret: &str,
    cancel: Arc<AtomicBool>,
) -> Result<DriveTokens, String> {
    if client_id.trim().is_empty() || client_secret.trim().is_empty() {
        return Err(
            "Add your Google OAuth Client ID and Client secret in Settings before connecting."
                .to_string(),
        );
    }

    let verifier = random_verifier();
    let challenge = URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()));
    let state = random_state();

    let listener = TcpListener::bind("127.0.0.1:0")
        .map_err(|e| format!("Could not start the local OAuth listener: {e}"))?;
    listener
        .set_nonblocking(true)
        .map_err(|e| format!("Could not configure the OAuth listener: {e}"))?;
    let port = listener
        .local_addr()
        .map_err(|e| format!("Could not read OAuth listener port: {e}"))?
        .port();
    let redirect_uri = format!("http://127.0.0.1:{port}");

    let mut url = url::Url::parse(AUTH_ENDPOINT)
        .map_err(|e| format!("Could not build Google authorization URL: {e}"))?;
    {
        let mut query = url.query_pairs_mut();
        query.append_pair("client_id", client_id);
        query.append_pair("redirect_uri", &redirect_uri);
        query.append_pair("response_type", "code");
        query.append_pair("scope", SCOPE);
        query.append_pair("access_type", "offline");
        query.append_pair("prompt", "consent");
        query.append_pair("include_granted_scopes", "true");
        query.append_pair("code_challenge", &challenge);
        query.append_pair("code_challenge_method", "S256");
        query.append_pair("state", &state);
    }

    open::that(url.as_str()).map_err(|e| {
        format!("Could not open your browser ({e}). Open this URL manually: {url}")
    })?;

    let deadline = Instant::now() + Duration::from_secs(240);
    let mut stream: Option<TcpStream> = None;
    while Instant::now() < deadline {
        if cancel.load(Ordering::Relaxed) {
            return Err("Connection cancelled.".to_string());
        }
        match listener.accept() {
            Ok((socket, _)) => {
                stream = Some(socket);
                break;
            }
            Err(err) if err.kind() == std::io::ErrorKind::WouldBlock => {
                std::thread::sleep(Duration::from_millis(120));
            }
            Err(err) => {
                return Err(format!("Local OAuth callback failed: {err}"));
            }
        }
    }

    let mut stream = stream.ok_or_else(|| {
        "Google sign-in timed out after 4 minutes. Please try connecting again.".to_string()
    })?;
    let _ = stream.set_read_timeout(Some(Duration::from_secs(10)));

    let mut request = Vec::new();
    let mut buffer = [0u8; 4096];
    loop {
        match stream.read(&mut buffer) {
            Ok(0) => break,
            Ok(n) => {
                request.extend_from_slice(&buffer[..n]);
                if request.windows(4).any(|w| w == b"\r\n\r\n") || request.len() > 64 * 1024 {
                    break;
                }
            }
            Err(_) => break,
        }
    }
    if cancel.load(Ordering::Relaxed) {
        return Err("Connection cancelled.".to_string());
    }

    let request_text = String::from_utf8_lossy(&request);
    let first_line = request_text.lines().next().unwrap_or_default();
    let target = first_line.split_whitespace().nth(1).unwrap_or_default();
    let query_string = target.split_once('?').map(|(_, q)| q).unwrap_or_default();

    let mut code: Option<String> = None;
    let mut returned_state: Option<String> = None;
    let mut oauth_error: Option<String> = None;
    let mut oauth_error_description: Option<String> = None;

    for (key, value) in url::form_urlencoded::parse(query_string.as_bytes()) {
        match key.as_ref() {
            "code" => code = Some(value.into_owned()),
            "state" => returned_state = Some(value.into_owned()),
            "error" => oauth_error = Some(value.into_owned()),
            "error_description" => oauth_error_description = Some(value.into_owned()),
            _ => {}
        }
    }

    if let Some(error) = oauth_error {
        let message = oauth_error_description.unwrap_or(error);
        write_oauth_response(&mut stream, false, &message);
        return Err(message);
    }

    let code = match code {
        Some(code) => code,
        None => {
            let message = "Google did not return an authorization code. Please try again.";
            write_oauth_response(&mut stream, false, message);
            return Err(message.to_string());
        }
    };

    if returned_state.as_deref() != Some(state.as_str()) {
        let message = "OAuth state verification failed. Please try again.";
        write_oauth_response(&mut stream, false, message);
        return Err(message.to_string());
    }

    if cancel.load(Ordering::Relaxed) {
        return Err("Connection cancelled.".to_string());
    }

    let client = http_client()?;
    let form = [
        ("client_id", client_id),
        ("client_secret", client_secret),
        ("code", code.as_str()),
        ("code_verifier", verifier.as_str()),
        ("grant_type", "authorization_code"),
        ("redirect_uri", redirect_uri.as_str()),
    ];

    let response = client
        .post(TOKEN_ENDPOINT)
        .form(&form)
        .send()
        .map_err(|e| format!("Could not exchange the Google authorization code: {e}"))?;
    let status = response.status();
    let body = response
        .text()
        .map_err(|e| format!("Could not read Google's token response: {e}"))?;

    if !status.is_success() {
        let message = google_error(&body, status.as_u16());
        write_oauth_response(&mut stream, false, &message);
        return Err(message);
    }

    let parsed: Value = serde_json::from_str(&body)
        .map_err(|e| format!("Unexpected Google token response: {e}"))?;
    let access_token = parsed
        .get("access_token")
        .and_then(|v| v.as_str())
        .unwrap_or_default()
        .to_string();
    let refresh_token = parsed
        .get("refresh_token")
        .and_then(|v| v.as_str())
        .unwrap_or_default()
        .to_string();
    let expires_in = parsed
        .get("expires_in")
        .and_then(|v| v.as_i64())
        .unwrap_or(3600);

    if access_token.is_empty() {
        let message = "Google did not return an access token.";
        write_oauth_response(&mut stream, false, message);
        return Err(message.to_string());
    }
    if refresh_token.is_empty() {
        let message = "Google did not return a refresh token. Remove RYZ ProjectUp from your Google account permissions and connect again.";
        write_oauth_response(&mut stream, false, message);
        return Err(message.to_string());
    }

    let mut email = None;
    let mut name = None;
    let mut picture = None;
    if let Ok(info_response) = client
        .get(USERINFO_ENDPOINT)
        .bearer_auth(&access_token)
        .send()
    {
        if info_response.status().is_success() {
            if let Ok(info) = info_response.json::<Value>() {
                email = info
                    .get("email")
                    .and_then(|v| v.as_str())
                    .map(|v| v.to_string());
                name = info
                    .get("name")
                    .and_then(|v| v.as_str())
                    .map(|v| v.to_string());
                picture = info
                    .get("picture")
                    .and_then(|v| v.as_str())
                    .map(|v| v.to_string());
            }
        }
    }

    let message = match email.as_deref() {
        Some(email) => format!("Signed in as {email}. ProjectUp can now create backups in your Drive."),
        None => "ProjectUp can now create backups in your Drive.".to_string(),
    };
    write_oauth_response(&mut stream, true, &message);

    Ok(DriveTokens {
        access_token,
        refresh_token,
        expiry: now_epoch() + expires_in - 60,
        token_type: parsed
            .get("token_type")
            .and_then(|v| v.as_str())
            .map(|v| v.to_string()),
        scope: parsed
            .get("scope")
            .and_then(|v| v.as_str())
            .map(|v| v.to_string()),
        email,
        name,
        picture,
    })
}

pub fn ensure_access_token(
    tokens: &mut DriveTokens,
    client_id: &str,
    client_secret: &str,
) -> Result<String, String> {
    if !tokens.access_token.is_empty() && tokens.expiry > now_epoch() + 30 {
        return Ok(tokens.access_token.clone());
    }
    if tokens.refresh_token.is_empty() {
        return Err("Google Drive is not connected. Reconnect it in Settings.".to_string());
    }

    let client = http_client()?;
    let form = [
        ("client_id", client_id),
        ("client_secret", client_secret),
        ("refresh_token", tokens.refresh_token.as_str()),
        ("grant_type", "refresh_token"),
    ];
    let response = client
        .post(TOKEN_ENDPOINT)
        .form(&form)
        .send()
        .map_err(|e| format!("Could not refresh the Google Drive token: {e}"))?;
    let status = response.status();
    let body = response
        .text()
        .map_err(|e| format!("Could not read Google's token response: {e}"))?;

    if !status.is_success() {
        if status.as_u16() == 400 && body.contains("invalid_grant") {
            return Err(
                "Google Drive access expired or was revoked. Disconnect and reconnect Drive in Settings."
                    .to_string(),
            );
        }
        return Err(google_error(&body, status.as_u16()));
    }

    let parsed: Value = serde_json::from_str(&body)
        .map_err(|e| format!("Unexpected Google refresh response: {e}"))?;
    let access_token = parsed
        .get("access_token")
        .and_then(|v| v.as_str())
        .unwrap_or_default()
        .to_string();
    if access_token.is_empty() {
        return Err("Google did not return a refreshed access token.".to_string());
    }
    let expires_in = parsed
        .get("expires_in")
        .and_then(|v| v.as_i64())
        .unwrap_or(3600);

    tokens.access_token = access_token.clone();
    tokens.expiry = now_epoch() + expires_in - 60;
    if let Some(refresh) = parsed.get("refresh_token").and_then(|v| v.as_str()) {
        if !refresh.is_empty() {
            tokens.refresh_token = refresh.to_string();
        }
    }
    if let Some(scope) = parsed.get("scope").and_then(|v| v.as_str()) {
        tokens.scope = Some(scope.to_string());
    }
    if let Some(token_type) = parsed.get("token_type").and_then(|v| v.as_str()) {
        tokens.token_type = Some(token_type.to_string());
    }

    Ok(access_token)
}

pub struct DriveClient {
    http: reqwest::blocking::Client,
    token: String,
}

impl DriveClient {
    pub fn new(token: String) -> Result<Self, String> {
        Ok(Self {
            http: http_client()?,
            token,
        })
    }

    /// Verify a cached folder id, or find/create the app's backup folder.
    pub fn ensure_folder(&self, name: &str, cached: Option<&str>) -> Result<String, String> {
        if let Some(folder_id) = cached.filter(|id| !id.is_empty()) {
            let url = format!(
                "{DRIVE_FILES_ENDPOINT}/{folder_id}?fields=id,trashed&supportsAllDrives=true"
            );
            match self.http.get(&url).bearer_auth(&self.token).send() {
                Ok(response) if response.status().is_success() => {
                    let payload: Value = response.json().unwrap_or_default();
                    if payload.get("trashed").and_then(|v| v.as_bool()) != Some(true) {
                        return Ok(folder_id.to_string());
                    }
                }
                Ok(response) if response.status().as_u16() == 401 => {
                    return Err(
                        "Google Drive authorization expired. Reconnect Drive in Settings.".to_string(),
                    );
                }
                _ => {}
            }
        }

        let escaped = name.replace('\\', "\\\\").replace('\'', "\\'");
        let query = format!(
            "mimeType = 'application/vnd.google-apps.folder' and name = '{}' and trashed = false",
            escaped
        );
        let encoded: String = url::form_urlencoded::byte_serialize(query.as_bytes()).collect();
        let list_url = format!(
            "{DRIVE_FILES_ENDPOINT}?q={encoded}&fields=files(id,name)&spaces=drive&pageSize=10&supportsAllDrives=true&includeItemsFromAllDrives=true"
        );
        let response = self
            .http
            .get(&list_url)
            .bearer_auth(&self.token)
            .send()
            .map_err(|e| format!("Could not query Google Drive: {e}"))?;
        let status = response.status();
        let body = response
            .text()
            .map_err(|e| format!("Could not read Google Drive response: {e}"))?;
        if !status.is_success() {
            return Err(google_error(&body, status.as_u16()));
        }
        if let Ok(payload) = serde_json::from_str::<Value>(&body) {
            if let Some(id) = payload
                .pointer("/files/0/id")
                .and_then(|v| v.as_str())
                .filter(|v| !v.is_empty())
            {
                return Ok(id.to_string());
            }
        }

        let create_url = format!(
            "{DRIVE_FILES_ENDPOINT}?fields=id,name&supportsAllDrives=true"
        );
        let metadata = json!({
            "name": name,
            "mimeType": "application/vnd.google-apps.folder",
            "appProperties": { "ryzApp": "projectup" }
        });
        let response = self
            .http
            .post(&create_url)
            .bearer_auth(&self.token)
            .json(&metadata)
            .send()
            .map_err(|e| format!("Could not create the Drive backup folder: {e}"))?;
        let status = response.status();
        let body = response
            .text()
            .map_err(|e| format!("Could not read Google Drive response: {e}"))?;
        if !status.is_success() {
            return Err(google_error(&body, status.as_u16()));
        }
        let payload: Value = serde_json::from_str(&body)
            .map_err(|e| format!("Unexpected Google Drive response: {e}"))?;
        payload
            .get("id")
            .and_then(|v| v.as_str())
            .map(|v| v.to_string())
            .ok_or_else(|| "Google Drive did not return a folder id.".to_string())
    }

    pub fn upload_archive(
        &self,
        archive: &Path,
        file_name: &str,
        folder_id: &str,
        project_id: &str,
        project_name: &str,
        size: u64,
        cancel: Arc<AtomicBool>,
        on_progress: Box<dyn FnMut(u64, u64) + Send>,
    ) -> Result<UploadedFile, String> {
        let metadata = json!({
            "name": file_name,
            "parents": [folder_id],
            "description": "RYZ ProjectUp snapshot",
            "appProperties": {
                "ryzApp": "projectup",
                "ryzProjectId": project_id,
                "ryzProjectName": project_name.chars().take(100).collect::<String>()
            }
        });

        let init_url = format!(
            "{DRIVE_UPLOAD_ENDPOINT}?uploadType=resumable&fields=id,name,size,webViewLink&supportsAllDrives=true"
        );
        let response = self
            .http
            .post(&init_url)
            .bearer_auth(&self.token)
            .header("X-Upload-Content-Type", "application/zip")
            .header("X-Upload-Content-Length", size.to_string())
            .json(&metadata)
            .send()
            .map_err(|e| format!("Could not start the Drive upload: {e}"))?;
        let status = response.status();
        if !status.is_success() {
            let body = response.text().unwrap_or_default();
            return Err(google_error(&body, status.as_u16()));
        }
        let session_url = response
            .headers()
            .get("location")
            .and_then(|value| value.to_str().ok())
            .map(|value| value.to_string())
            .ok_or_else(|| "Google Drive did not return an upload session URL.".to_string())?;

        let file = File::open(archive)
            .map_err(|e| format!("Could not reopen the snapshot: {e}"))?;
        let cancel_for_reader = cancel.clone();
        let reader = CountingReader::new(file, size, cancel_for_reader, on_progress);
        let body = reqwest::blocking::Body::sized(reader, size);

        let response = self
            .http
            .put(&session_url)
            .bearer_auth(&self.token)
            .header("Content-Type", "application/zip")
            .header("Content-Length", size.to_string())
            .body(body)
            .send();

        let response = match response {
            Ok(response) => response,
            Err(err) => {
                if cancel.load(Ordering::Relaxed) {
                    return Err("Backup cancelled.".to_string());
                }
                return Err(format!("Snapshot upload failed: {err}"));
            }
        };
        let status = response.status();
        let body = response
            .text()
            .map_err(|e| format!("Could not read the Drive upload response: {e}"))?;
        if !status.is_success() {
            return Err(google_error(&body, status.as_u16()));
        }
        let payload: Value = serde_json::from_str(&body)
            .map_err(|e| format!("Unexpected Drive upload response: {e}"))?;
        let id = payload
            .get("id")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string();
        if id.is_empty() {
            return Err("Google Drive did not return the uploaded file id.".to_string());
        }

        Ok(UploadedFile {
            id: id.clone(),
            name: payload
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or(file_name)
                .to_string(),
            size: payload.get("size").and_then(|v| v.as_str()).and_then(|v| v.parse().ok()),
            web_view_link: payload
                .get("webViewLink")
                .and_then(|v| v.as_str())
                .map(|v| v.to_string())
                .or_else(|| Some(format!("https://drive.google.com/file/d/{id}/view"))),
        })
    }

    pub fn download_archive(
        &self,
        file_id: &str,
        destination: &Path,
        cancel: &AtomicBool,
        on_progress: &mut dyn FnMut(u64, u64),
    ) -> Result<u64, String> {
        let url = format!(
            "{DRIVE_FILES_ENDPOINT}/{file_id}?alt=media&supportsAllDrives=true"
        );
        let mut response = self
            .http
            .get(&url)
            .bearer_auth(&self.token)
            .send()
            .map_err(|e| format!("Could not download the snapshot: {e}"))?;
        let status = response.status();
        if !status.is_success() {
            let body = response.text().unwrap_or_default();
            return Err(google_error(&body, status.as_u16()));
        }

        let total = response.content_length().unwrap_or(0);
        let file = File::create(destination)
            .map_err(|e| format!("Could not create {}: {e}", destination.display()))?;
        let mut writer = BufWriter::new(file);
        let mut downloaded: u64 = 0;
        let mut buffer = vec![0u8; 256 * 1024];
        let mut last_emit = Instant::now();

        loop {
            if cancel.load(Ordering::Relaxed) {
                return Err("Restore cancelled.".to_string());
            }
            let read = response
                .read(&mut buffer)
                .map_err(|e| format!("Snapshot download failed: {e}"))?;
            if read == 0 {
                break;
            }
            writer
                .write_all(&buffer[..read])
                .map_err(|e| format!("Could not write the snapshot: {e}"))?;
            downloaded = downloaded.saturating_add(read as u64);
            if last_emit.elapsed().as_millis() >= 120 {
                on_progress(downloaded, if total > 0 { total } else { downloaded });
                last_emit = Instant::now();
            }
        }
        writer
            .flush()
            .map_err(|e| format!("Could not flush the snapshot: {e}"))?;
        on_progress(downloaded, if total > 0 { total } else { downloaded });
        Ok(downloaded)
    }

    pub fn delete_file(&self, file_id: &str) -> Result<(), String> {
        let url =
            format!("{DRIVE_FILES_ENDPOINT}/{file_id}?supportsAllDrives=true");
        let response = self
            .http
            .delete(&url)
            .bearer_auth(&self.token)
            .send()
            .map_err(|e| format!("Could not delete the Drive file: {e}"))?;
        let status = response.status();
        if status.is_success() || status.as_u16() == 404 {
            return Ok(());
        }
        let body = response.text().unwrap_or_default();
        Err(google_error(&body, status.as_u16()))
    }

    fn find_vault_file_id(&self, folder_id: &str) -> Result<Option<String>, String> {
        let escaped_name = VAULT_FILE_NAME.replace('\\', "\\\\").replace('\'', "\\'");
        let query = format!(
            "name = '{}' and '{}' in parents and trashed = false",
            escaped_name, folder_id
        );
        let encoded: String = url::form_urlencoded::byte_serialize(query.as_bytes()).collect();
        let url = format!(
            "{DRIVE_FILES_ENDPOINT}?q={encoded}&fields=files(id,name,modifiedTime)&spaces=drive&pageSize=10&supportsAllDrives=true&includeItemsFromAllDrives=true"
        );
        let response = self
            .http
            .get(&url)
            .bearer_auth(&self.token)
            .send()
            .map_err(|e| format!("Could not look up the Drive vault index: {e}"))?;
        let status = response.status();
        let body = response
            .text()
            .map_err(|e| format!("Could not read the Drive vault index response: {e}"))?;
        if !status.is_success() {
            return Err(google_error(&body, status.as_u16()));
        }
        let payload: Value = serde_json::from_str(&body)
            .map_err(|e| format!("Unexpected Drive vault index response: {e}"))?;
        let files = match payload.get("files").and_then(|value| value.as_array()) {
            Some(files) => files,
            None => return Ok(None),
        };

        let mut best: Option<(String, String)> = None;
        for file in files {
            let id = match file.get("id").and_then(|value| value.as_str()) {
                Some(id) if !id.is_empty() => id.to_string(),
                _ => continue,
            };
            let modified = file
                .get("modifiedTime")
                .and_then(|value| value.as_str())
                .unwrap_or_default()
                .to_string();
            let replace = best
                .as_ref()
                .map(|(_, current)| modified > *current)
                .unwrap_or(true);
            if replace {
                best = Some((id, modified));
            }
        }
        Ok(best.map(|(id, _)| id))
    }

    /// Download the synced project/snapshot index from the backup folder.
    pub fn download_vault(&self, folder_id: &str) -> Result<Option<CloudVault>, String> {
        let file_id = match self.find_vault_file_id(folder_id)? {
            Some(id) => id,
            None => return Ok(None),
        };
        let url = format!(
            "{DRIVE_FILES_ENDPOINT}/{file_id}?alt=media&supportsAllDrives=true"
        );
        let response = self
            .http
            .get(&url)
            .bearer_auth(&self.token)
            .send()
            .map_err(|e| format!("Could not download the Drive vault index: {e}"))?;
        let status = response.status();
        let body = response
            .text()
            .map_err(|e| format!("Could not read the Drive vault index: {e}"))?;
        if !status.is_success() {
            return Err(google_error(&body, status.as_u16()));
        }
        if body.trim().is_empty() {
            return Ok(None);
        }
        let vault: CloudVault = serde_json::from_str(&body)
            .map_err(|e| format!("The Drive vault index is not valid JSON: {e}"))?;
        if !vault.app.is_empty() && vault.app != "ryz-projectup" {
            return Err("That Drive vault was created by a different application.".to_string());
        }
        if vault.schema > 1 {
            return Err(
                "That Drive vault was created by a newer version of ProjectUp. Update this app first."
                    .to_string(),
            );
        }
        Ok(Some(vault))
    }

    /// Create or replace the synced vault index in the backup folder.
    pub fn upload_vault(&self, folder_id: &str, vault: &CloudVault) -> Result<(), String> {
        let json = serde_json::to_vec_pretty(vault)
            .map_err(|e| format!("Could not serialize the Drive vault index: {e}"))?;

        let file_id = match self.find_vault_file_id(folder_id)? {
            Some(id) => id,
            None => {
                let metadata = json!({
                    "name": VAULT_FILE_NAME,
                    "parents": [folder_id],
                    "mimeType": "application/json",
                    "appProperties": {
                        "ryzApp": "projectup",
                        "ryzType": "vault"
                    }
                });
                let url = format!("{DRIVE_FILES_ENDPOINT}?fields=id&supportsAllDrives=true");
                let response = self
                    .http
                    .post(&url)
                    .bearer_auth(&self.token)
                    .json(&metadata)
                    .send()
                    .map_err(|e| format!("Could not create the Drive vault index: {e}"))?;
                let status = response.status();
                let body = response
                    .text()
                    .map_err(|e| format!("Could not read the Drive vault response: {e}"))?;
                if !status.is_success() {
                    return Err(google_error(&body, status.as_u16()));
                }
                let payload: Value = serde_json::from_str(&body)
                    .map_err(|e| format!("Unexpected Drive vault response: {e}"))?;
                payload
                    .get("id")
                    .and_then(|value| value.as_str())
                    .map(|value| value.to_string())
                    .ok_or_else(|| "Google Drive did not return a vault index id.".to_string())?
            }
        };

        let url = format!(
            "https://www.googleapis.com/upload/drive/v3/files/{file_id}?uploadType=media&fields=id,modifiedTime&supportsAllDrives=true"
        );
        let response = self
            .http
            .patch(&url)
            .bearer_auth(&self.token)
            .header("Content-Type", "application/json")
            .body(json)
            .send()
            .map_err(|e| format!("Could not update the Drive vault index: {e}"))?;
        let status = response.status();
        if !status.is_success() {
            let body = response.text().unwrap_or_default();
            return Err(google_error(&body, status.as_u16()));
        }
        Ok(())
    }
}

struct CountingReader {
    inner: File,
    total: u64,
    done: u64,
    cancel: Arc<AtomicBool>,
    last_emit: Instant,
    on_progress: Box<dyn FnMut(u64, u64) + Send>,
}

impl CountingReader {
    fn new(
        inner: File,
        total: u64,
        cancel: Arc<AtomicBool>,
        on_progress: Box<dyn FnMut(u64, u64) + Send>,
    ) -> Self {
        Self {
            inner,
            total,
            done: 0,
            cancel,
            last_emit: Instant::now(),
            on_progress,
        }
    }
}

impl Read for CountingReader {
    fn read(&mut self, buffer: &mut [u8]) -> std::io::Result<usize> {
        if self.cancel.load(Ordering::Relaxed) {
            return Err(std::io::Error::new(
                std::io::ErrorKind::Interrupted,
                "backup cancelled",
            ));
        }
        let read = self.inner.read(buffer)?;
        self.done = self.done.saturating_add(read as u64);
        if self.last_emit.elapsed().as_millis() >= 120 || self.done >= self.total {
            (self.on_progress)(self.done, self.total);
            self.last_emit = Instant::now();
        }
        Ok(read)
    }
}

/// Ensure downloaded files cannot escape the restore directory.
pub fn safe_zip_entries(destination: &Path) -> Result<(), String> {
    if !destination.exists() {
        fs::create_dir_all(destination)
            .map_err(|e| format!("Could not create {}: {e}", destination.display()))?;
    }
    Ok(())
}
