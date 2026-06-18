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

fn svn_cmd() -> tokio::process::Command {
    tokio::process::Command::new(find_svn())
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

#[derive(serde::Serialize)]
pub struct SvnStatusEntry {
    path: String,
    item: String,
    revision: String,
    author: String,
    date: String,
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
            if let Some(s) = t.find("kind=\"") {
                let rest = &t[s + 6..];
                if let Some(e) = rest.find('"') {
                    kind = rest[..e].to_string();
                }
            }
        }
        if in_entry {
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

fn add_svn_auth(cmd: &mut tokio::process::Command, username: &Option<String>, password: &Option<String>) {
    if let Some(user) = username {
        cmd.arg("--username").arg(user);
        cmd.arg("--non-interactive");
        if let Some(pass) = password {
            cmd.arg("--password").arg(pass);
        }
    }
}

async fn run_svn_with_auth(args: &[&str], username: &Option<String>, password: &Option<String>) -> Result<std::process::Output, String> {
    let mut cmd = svn_cmd();
    cmd.args(args);
    add_svn_auth(&mut cmd, username, password);
    cmd.output().await.map_err(|e| format!("Failed to execute svn: {}", e))
}

/// 远程列出 SVN 目录
#[tauri::command]
async fn svn_ls(url: String, username: Option<String>, password: Option<String>) -> Result<Vec<SvnEntry>, String> {
    let url = encode_svn_url(&url);
    let output = run_svn_with_auth(&["ls", "--xml", &url], &username, &password).await?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("svn ls failed: {}", stderr));
    }

    let xml = String::from_utf8_lossy(&output.stdout);
    Ok(parse_svn_ls_xml(&xml))
}

/// 执行替换：temp checkout → svn delete → copy → svn add → commit → cleanup
#[tauri::command]
async fn do_replace(
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
    let checkout = run_svn_with_auth(&["checkout", "--depth", "empty", &target_url, &work_dir.to_string_lossy()], &username, &password).await?;
    if !checkout.status.success() {
        let stderr = String::from_utf8_lossy(&checkout.stderr);
        return Err(format!("svn checkout failed: {}", stderr));
    }

    // Find the target name (last path component)
    let target_name = target_url.trim_end_matches('/').rsplit('/').next().unwrap_or("shj-fxc");
    let target_path = work_dir.join(target_name);

    // svn delete the existing target (if any)
    if target_path.exists() {
        let del = run_svn_with_auth(&["delete", "--force", &target_path.to_string_lossy()], &username, &password).await?;
        if !del.status.success() {
            let stderr = String::from_utf8_lossy(&del.stderr);
            eprintln!("svn delete warning: {}", stderr);
        }
    }

    // Ensure parent directory exists
    if let Some(parent) = target_path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create parent dir: {}", e))?;
    }

    // Copy source to target (recursive, preserving attributes) - fast, use blocking spawn
    let src_path_clone = src_path.clone();
    let target_path_clone = target_path.clone();
    tokio::task::spawn_blocking(move || {
        let mut cp_cmd = std::process::Command::new("cp");
        if src_path_clone.is_dir() {
            cp_cmd.arg("-rf");
        } else {
            cp_cmd.arg("-f");
        }
        cp_cmd.arg(&src_path_clone).arg(&target_path_clone);
        cp_cmd.output()
    }).await.map_err(|e| format!("Join error: {}", e))?
        .map_err(|e| format!("Failed to copy files: {}", e))
        .and_then(|output| {
            if output.status.success() {
                Ok(())
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr);
                Err(format!("Copy failed: {}", stderr))
            }
        })?;

    // svn add (--force to handle recursive adds)
    let add = run_svn_with_auth(&["add", "--parents", "--force", &target_path.to_string_lossy()], &username, &password).await?;
    if !add.status.success() {
        let stderr = String::from_utf8_lossy(&add.stderr);
        return Err(format!("svn add failed: {}", stderr));
    }

    // svn commit
    let commit = run_svn_with_auth(&["commit", "-m", &commit_msg, &work_dir.to_string_lossy()], &username, &password).await?;
    if !commit.status.success() {
        let stderr = String::from_utf8_lossy(&commit.stderr);
        return Err(format!("svn commit failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&commit.stdout);
    Ok(ReplaceResult { success: true, message: stdout.to_string() })
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
        if t.find("<logentry").is_some() {
            in_entry = true;
            revision.clear();
            author.clear();
            date.clear();
            message.clear();
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
                let start = t.find('>').map(|i| i + 1).unwrap_or(0);
                if t.ends_with("</msg>") {
                    message = t[start..].trim_end_matches("</msg>").to_string();
                } else {
                    message = t[start..].to_string();
                }
            } else if !message.is_empty() && !t.starts_with("</logentry") && !t.starts_with("<logentry") {
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
async fn svn_log(url: String, limit: Option<u32>, username: Option<String>, password: Option<String>) -> Result<Vec<SvnLogEntry>, String> {
    let url = encode_svn_url(&url);
    let limit = limit.unwrap_or(50).to_string();
    let output = run_svn_with_auth(&["log", "--xml", "--limit", &limit, &url], &username, &password).await?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("svn log failed: {}", stderr));
    }

    let xml = String::from_utf8_lossy(&output.stdout);
    Ok(parse_svn_log_xml(&xml))
}

/// 测试 SVN 连接
#[tauri::command]
async fn test_connection(url: String, username: Option<String>, password: Option<String>) -> Result<String, String> {
    let url = encode_svn_url(&url);
    let output = run_svn_with_auth(&["ls", "--depth", "0", &url], &username, &password).await?;

    if output.status.success() {
        Ok("ok".to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("Connection failed: {}", stderr.trim()))
    }
}

/// 获取 SVN 工作副本状态
#[tauri::command]
async fn svn_status(path: String, username: Option<String>, password: Option<String>) -> Result<Vec<SvnStatusEntry>, String> {
    let output = run_svn_with_auth(&["status", "--xml", &path], &username, &password).await?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("svn status failed: {}", stderr));
    }

    let xml = String::from_utf8_lossy(&output.stdout);
    let mut entries = Vec::new();
    let mut in_entry = false;
    let mut entry_path = String::new();
    let mut item = String::new();
    let mut revision = String::new();
    let mut author = String::new();
    let mut date = String::new();
    let mut in_commit = false;

    for line in xml.lines() {
        let t = line.trim();

        if t.starts_with("<entry") {
            in_entry = true;
            entry_path.clear();
            item.clear();
            revision.clear();
            author.clear();
            date.clear();
            in_commit = false;
            if let Some(s) = t.find("path=\"") {
                let rest = &t[s + 6..];
                if let Some(e) = rest.find('"') {
                    entry_path = rest[..e].to_string();
                }
            }
        }

        if in_entry {
            if t.starts_with("<wc-status") {
                if let Some(s) = t.find("item=\"") {
                    let rest = &t[s + 6..];
                    if let Some(e) = rest.find('"') {
                        item = rest[..e].to_string();
                    }
                }
            }
            if t.starts_with("<commit") {
                in_commit = true;
                if let Some(s) = t.find("revision=\"") {
                    let rest = &t[s + 10..];
                    if let Some(e) = rest.find('"') {
                        revision = rest[..e].to_string();
                    }
                }
            }
            if in_commit {
                if t.starts_with("<author>") {
                    author = t.trim_start_matches("<author>").trim_end_matches("</author>").to_string();
                }
                if t.starts_with("<date>") {
                    date = t.trim_start_matches("<date>").trim_end_matches("</date>").to_string();
                }
            }
            if t == "</commit>" {
                in_commit = false;
            }
        }

        if t == "</entry>" && !entry_path.is_empty() {
            entries.push(SvnStatusEntry {
                path: entry_path.clone(),
                item: item.clone(),
                revision: revision.clone(),
                author: author.clone(),
                date: date.clone(),
            });
            in_entry = false;
        }
    }

    Ok(entries)
}

/// 更新 SVN 工作副本
#[tauri::command]
async fn svn_update(path: String, username: Option<String>, password: Option<String>, accept: Option<String>) -> Result<String, String> {
    let mut args = vec!["update", &path];
    if let Some(ref a) = accept {
        args.push("--accept");
        args.push(a);
    }
    let output = run_svn_with_auth(&args, &username, &password).await?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("svn update failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout.trim().to_string())
}

/// SVN checkout
#[tauri::command]
async fn svn_checkout(url: String, path: String, username: Option<String>, password: Option<String>) -> Result<String, String> {
    let url = encode_svn_url(&url);
    let output = run_svn_with_auth(&["checkout", &url, &path], &username, &password).await?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("svn checkout failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout.trim().to_string())
}

/// Read local directory (one level, for local file tree)
#[tauri::command]
fn read_local_dir(path: String) -> Result<Vec<SvnEntry>, String> {
    let dir = std::path::Path::new(&path);
    if !dir.is_dir() {
        return Err(format!("Not a directory: {}", path));
    }
    let mut entries = Vec::new();
    let mut rd = std::fs::read_dir(dir).map_err(|e| format!("Failed to read directory: {}", e))?;
    for entry in rd {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') { continue; }
        if name == ".svn" { continue; }
        let kind = entry.file_type().map(|t| if t.is_dir() { "dir" } else { "file" }).unwrap_or("file");
        entries.push(SvnEntry { name, kind: kind.to_string(), date: String::new() });
    }
    // Sort: directories first, then alphabetical
    entries.sort_by(|a, b| {
        if a.kind != b.kind {
            if a.kind == "dir" { std::cmp::Ordering::Less } else { std::cmp::Ordering::Greater }
        } else {
            a.name.cmp(&b.name)
        }
    });
    Ok(entries)
}

/// SVN add 文件/目录
#[tauri::command]
async fn svn_add(path: String, username: Option<String>, password: Option<String>) -> Result<String, String> {
    let output = run_svn_with_auth(&["add", "--parents", "--force", &path], &username, &password).await?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("svn add failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout.trim().to_string())
}

/// SVN delete 文件/目录
#[tauri::command]
async fn svn_delete(path: String, username: Option<String>, password: Option<String>) -> Result<String, String> {
    let output = run_svn_with_auth(&["delete", "--force", &path], &username, &password).await?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("svn delete failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout.trim().to_string())
}

/// 获取 SVN diff 输出
#[tauri::command]
async fn svn_diff(url: String, username: Option<String>, password: Option<String>) -> Result<String, String> {
    let url = encode_svn_url(&url);
    let output = run_svn_with_auth(&["diff", "--non-interactive", "-c", "HEAD", &url], &username, &password).await?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("svn diff failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout.trim().to_string())
}

/// 还原 SVN 工作副本中的本地修改
#[tauri::command]
async fn svn_revert(path: String, username: Option<String>, password: Option<String>) -> Result<String, String> {
    let output = run_svn_with_auth(&["revert", "--recursive", &path], &username, &password).await?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("svn revert failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout.trim().to_string())
}

/// 清理 SVN 工作副本（解锁等工作）
#[tauri::command]
async fn svn_cleanup(path: String, username: Option<String>, password: Option<String>) -> Result<String, String> {
    let output = run_svn_with_auth(&["cleanup", &path], &username, &password).await?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("svn cleanup failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout.trim().to_string())
}

/// SVN resolve — auto-resolve conflicts
#[tauri::command]
async fn svn_resolve(path: String, accept: String, recursive: bool, username: Option<String>, password: Option<String>) -> Result<String, String> {
    let mut args = vec!["resolve", "--accept", &accept, &path];
    if recursive { args.push("-R"); }
    let output = run_svn_with_auth(&args, &username, &password).await?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("svn resolve failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout.trim().to_string())
}

/// 标准 SVN 提交（commit）
#[tauri::command]
async fn svn_commit(path: String, message: String, username: Option<String>, password: Option<String>) -> Result<String, String> {
    let output = run_svn_with_auth(&["commit", "-m", &message, &path], &username, &password).await?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("svn commit failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout.trim().to_string())
}

/// 远程删除 SVN 文件/目录
#[tauri::command]
async fn svn_remote_delete(url: String, message: String, username: Option<String>, password: Option<String>) -> Result<String, String> {
    let url = encode_svn_url(&url);
    let output = run_svn_with_auth(&["delete", "-m", &message, &url], &username, &password).await?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("svn delete failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout.trim().to_string())
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
        .invoke_handler(tauri::generate_handler![svn_ls, svn_status, do_replace, test_connection, svn_log, svn_update, svn_checkout, svn_add, svn_delete, svn_diff, svn_revert, svn_cleanup, svn_resolve, svn_commit, svn_remote_delete, read_local_dir])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
