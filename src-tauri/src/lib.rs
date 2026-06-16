use std::process::Command;
use std::path::PathBuf;
use std::fs;
use tempfile::tempdir;
use tauri::Manager;

fn find_svn() -> String {
    let candidates = ["/opt/homebrew/bin/svn", "/usr/local/bin/svn", "/usr/bin/svn"];
    for p in &candidates {
        if std::path::Path::new(p).exists() {
            return p.to_string();
        }
    }
    // fallback: hope it's in PATH
    "svn".to_string()
}

fn svn_cmd() -> Command {
    Command::new(find_svn())
}

/// 对 SVN URL 的 path 部分进行百分号编码，支持中文等非 ASCII 字符
fn encode_svn_url(raw: &str) -> String {
    let trimmed = raw.trim();
    match url::Url::parse(trimmed) {
        Ok(mut parsed) => {
            // path() 返回已解码的路径，set_path() 会重新百分号编码
            let path = parsed.path().to_string();
            parsed.set_path(&path);
            parsed.as_str().to_string()
        }
        Err(_) => trimmed.to_string(),
    }
}

#[derive(serde::Serialize)]
pub struct SvnEntry {
    name: String,
    kind: String, // "dir" | "file"
    date: String,
}

#[derive(serde::Serialize)]
pub struct ReplaceResult {
    success: bool,
    message: String,
}

fn parse_svn_ls_xml(xml: &str) -> Vec<SvnEntry> {
    let mut entries = Vec::new();
    let mut in_entry = false;
    let mut name = String::new();
    let mut kind = String::new();
    let mut date = String::new();

    for line in xml.lines() {
        let t = line.trim();
        if t.starts_with("<entry") {
            in_entry = true;
            name.clear();
            kind.clear();
            date.clear();
            // try to extract kind from same line as <entry
            if let Some(s) = t.find("kind=\"") {
                let rest = &t[s + 6..];
                if let Some(e) = rest.find('"') {
                    kind = rest[..e].to_string();
                }
            }
        }
        if in_entry {
            // kind might be on a separate line
            if kind.is_empty() {
                if let Some(s) = t.find("kind=\"") {
                    let rest = &t[s + 6..];
                    if let Some(e) = rest.find('"') {
                        kind = rest[..e].to_string();
                    }
                }
            }
            if t.starts_with("<name>") {
                name = t.trim_start_matches("<name>")
                    .trim_end_matches("</name>")
                    .trim_end_matches('/')
                    .to_string();
            }
            if t.starts_with("<date>") {
                date = t.trim_start_matches("<date>")
                    .trim_end_matches("</date>")
                    .to_string();
            }
        }
        if t == "</entry>" && !name.is_empty() {
            entries.push(SvnEntry { name: name.clone(), kind: kind.clone(), date: date.clone() });
            in_entry = false;
        }
    }
    entries
}

fn add_svn_auth(cmd: &mut std::process::Command, username: &Option<String>, password: &Option<String>) {
    if let Some(user) = username {
        cmd.arg("--username").arg(user);
        cmd.arg("--non-interactive"); // only non-interactive when providing creds
        if let Some(pass) = password {
            cmd.arg("--password").arg(pass);
        }
    }
}

	/// 远程列出 SVN 目录
#[tauri::command]
fn svn_ls(url: String, username: Option<String>, password: Option<String>) -> Result<Vec<SvnEntry>, String> {
    let url = encode_svn_url(&url);
    let mut cmd = svn_cmd();
    cmd.args(["ls", "--xml", &url]);
    add_svn_auth(&mut cmd, &username, &password);
    let output = cmd.output()
        .map_err(|e| format!("Failed to execute svn ls: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("svn ls failed: {}", stderr));
    }

    let xml = String::from_utf8_lossy(&output.stdout);
    Ok(parse_svn_ls_xml(&xml))
}

/// 执行替换：temp checkout → svn delete → copy → svn add → commit → cleanup
#[tauri::command]
fn do_replace(
    source: String,
    target_url: String,
    commit_msg: String,
    username: Option<String>,
    password: Option<String>,
) -> Result<ReplaceResult, String> {
    // Validate source exists
    let src_path = PathBuf::from(&source);
    let target_url = encode_svn_url(&target_url);
    if !src_path.exists() {
        return Err(format!("Source not found: {}", source));
    }

    // Create temp directory
    let tmp = tempdir().map_err(|e| format!("Failed to create temp dir: {}", e))?;
    let work_dir = tmp.path().join("svn-work");

    // Checkout with empty depth (just the skeleton)
    let mut co_cmd = svn_cmd();
    co_cmd.args(["checkout", "--depth", "empty", &target_url]).arg(&work_dir);
    add_svn_auth(&mut co_cmd, &username, &password);
    let checkout = co_cmd.output()
        .map_err(|e| format!("Failed to run svn checkout: {}", e))?;

    if !checkout.status.success() {
        let stderr = String::from_utf8_lossy(&checkout.stderr);
        return Err(format!("svn checkout failed: {}", stderr));
    }

    // Find the target name (last path component)
    let target_name = target_url.trim_end_matches('/').rsplit('/').next().unwrap_or("shj-fxc");
    let target_path = work_dir.join(target_name);

    // svn delete the existing target (if any)
    if target_path.exists() {
        let mut del_cmd = svn_cmd();
        del_cmd.args(["delete", "--force"]).arg(&target_path);
        add_svn_auth(&mut del_cmd, &username, &password);
        let del = del_cmd.output()
            .map_err(|e| format!("Failed to run svn delete: {}", e))?;
        if !del.status.success() {
            let stderr = String::from_utf8_lossy(&del.stderr);
            // Non-fatal: file might not be versioned
            eprintln!("svn delete warning: {}", stderr);
        }
    }

    // Ensure parent directory exists
    if let Some(parent) = target_path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create parent dir: {}", e))?;
    }

    // Copy source to target (recursive, preserving attributes)
    let mut cp_cmd = Command::new("cp");
    if src_path.is_dir() {
        cp_cmd.arg("-rf");
    } else {
        cp_cmd.arg("-f");
    }
    cp_cmd.arg(&source).arg(&target_path);

    let copy = cp_cmd.output()
        .map_err(|e| format!("Failed to copy files: {}", e))?;

    if !copy.status.success() {
        let stderr = String::from_utf8_lossy(&copy.stderr);
        return Err(format!("Copy failed: {}", stderr));
    }

    // svn add (--force to handle recursive adds)
    let mut add_cmd = svn_cmd();
    add_cmd.args(["add", "--parents", "--force"]).arg(&target_path);
    add_svn_auth(&mut add_cmd, &username, &password);
    let add = add_cmd.output()
        .map_err(|e| format!("Failed to run svn add: {}", e))?;

    if !add.status.success() {
        let stderr = String::from_utf8_lossy(&add.stderr);
        return Err(format!("svn add failed: {}", stderr));
    }

    // svn commit
    let mut ci_cmd = svn_cmd();
    ci_cmd.args(["commit", "-m"]).arg(&commit_msg).arg(&work_dir);
    add_svn_auth(&mut ci_cmd, &username, &password);
    let commit = ci_cmd.output()
        .map_err(|e| format!("Failed to run svn commit: {}", e))?;

    if !commit.status.success() {
        let stderr = String::from_utf8_lossy(&commit.stderr);
        return Err(format!("svn commit failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&commit.stdout);

    Ok(ReplaceResult {
        success: true,
        message: stdout.to_string(),
    })
}

#[derive(serde::Serialize)]
pub struct SvnLogEntry {
    revision: String,
    author: String,
    date: String,
    message: String,
}

fn parse_svn_log_xml(xml: &str) -> Vec<SvnLogEntry> {
    let mut entries = Vec::new();
    let mut in_entry = false;
    let mut revision = String::new();
    let mut author = String::new();
    let mut date = String::new();
    let mut message = String::new();

    for line in xml.lines() {
        let t = line.trim();
        if let Some(s) = t.find("<logentry") {
            in_entry = true;
            revision.clear();
            author.clear();
            date.clear();
            message.clear();
            // extract revision from attribute
            if let Some(ri) = t.find("revision=\"") {
                let rest = &t[ri + 10..];
                if let Some(e) = rest.find('"') {
                    revision = rest[..e].to_string();
                }
            }
        }
        if in_entry {
            if t.starts_with("<author>") {
                author = t.trim_start_matches("<author>").trim_end_matches("</author>").to_string();
            }
            if t.starts_with("<date>") {
                date = t.trim_start_matches("<date>").trim_end_matches("</date>").to_string();
            }
            if t.starts_with("<msg") {
                // message may span multiple lines
                let start = t.find('>').map(|i| i + 1).unwrap_or(0);
                if t.ends_with("</msg>") {
                    message = t[start..].trim_end_matches("</msg>").to_string();
                } else {
                    message = t[start..].to_string();
                }
            } else if !message.is_empty() && !t.starts_with("</logentry") && !t.starts_with("<logentry") {
                // continuation of multi-line message
                if t.ends_with("</msg>") {
                    message.push('\n');
                    message.push_str(&t[..t.len() - 6]);
                    in_entry = false;
                } else {
                    message.push('\n');
                    message.push_str(t);
                }
            }
        }
        if t == "</logentry>" && in_entry {
            entries.push(SvnLogEntry { revision: revision.clone(), author: author.clone(), date: date.clone(), message: message.trim().to_string() });
            in_entry = false;
        }
    }
    entries
}

/// 获取提交历史
#[tauri::command]
fn svn_log(url: String, limit: Option<u32>, username: Option<String>, password: Option<String>) -> Result<Vec<SvnLogEntry>, String> {
    let url = encode_svn_url(&url);
    let mut cmd = svn_cmd();
    let limit = limit.unwrap_or(50).to_string();
    cmd.args(["log", "--xml", "--limit", &limit, &url]);
    add_svn_auth(&mut cmd, &username, &password);
    let output = cmd.output()
        .map_err(|e| format!("Failed to execute svn log: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("svn log failed: {}", stderr));
    }

    let xml = String::from_utf8_lossy(&output.stdout);
    Ok(parse_svn_log_xml(&xml))
}

/// 测试 SVN 连接
#[tauri::command]
fn test_connection(url: String, username: Option<String>, password: Option<String>) -> Result<String, String> {
    let url = encode_svn_url(&url);
    let mut cmd = svn_cmd();
    cmd.args(["ls", "--depth", "0", &url]);
    add_svn_auth(&mut cmd, &username, &password);
    let output = cmd.output()
        .map_err(|e| format!("Failed to execute svn: {}", e))?;

    if output.status.success() {
        Ok("ok".to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("Connection failed: {}", stderr.trim()))
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            #[cfg(target_os = "macos")]
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_title_bar_style(tauri::utils::TitleBarStyle::Overlay);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![svn_ls, do_replace, test_connection, svn_log])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
