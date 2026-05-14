/**
 * --------------------------------------------------------------------
 * docmd : the zero-config documentation engine.
 *
 * @package     @docmd/core (and ecosystem)
 * @website     https://docmd.io
 * @repository  https://github.com/docmd-io/docmd
 * @license     MIT
 * @copyright   Copyright (c) 2025-present docmd.io
 *
 * [docmd-source] - Please do not remove this header.
 * --------------------------------------------------------------------
 */

use napi_derive::napi;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::path::Path;
use tokio::process::Command;

type TaskResult = Result<Value, String>;

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

#[napi]
pub async fn run_task(task_type: String, payload_json: String) -> napi::Result<String> {
  let payload: Value = serde_json::from_str(&payload_json)
    .map_err(|e| napi::Error::from_reason(format!("Invalid payload JSON: {e}")))?;

  let result: TaskResult = dispatch(&task_type, payload).await;

  match result {
    Ok(data) => serde_json::to_string(&data)
      .map_err(|e| napi::Error::from_reason(format!("Failed to serialise: {e}"))),
    Err(msg) => Ok(format!(r#"{{"error":"{}"}}"#, msg.replace('"', "\\\""))),
  }
}

async fn dispatch(task_type: &str, payload: Value) -> TaskResult {
  match task_type {
    "file:discover"  => file_discover(payload).await,
    "file:read"      => file_read(payload).await,
    "file:readBatch" => file_read_batch(payload).await,
    "file:write"     => file_write(payload).await,
    "file:exists"    => file_exists(payload).await,
    "git:log"        => git_log(payload).await,
    "git:status"     => git_status(payload).await,
    "search:index"   => search_index(payload).await,
    other            => Err(format!("Unknown task type: '{other}'")),
  }
}

// ---------------------------------------------------------------------------
// file:discover
// ---------------------------------------------------------------------------

#[derive(Serialize)]
struct FileEntry { path: String, size: u64, #[serde(rename = "mtimeMs")] mtime_ms: u64 }

const SKIP_DIRS: &[&str] = &["node_modules", ".git", ".docmd", "dist", "site"];

async fn file_discover(payload: Value) -> TaskResult {
  let dir = payload["dir"].as_str().ok_or_else(|| "file:discover: missing 'dir'".to_string())?;
  let extensions: Option<Vec<String>> = payload["extensions"].as_array()
    .map(|a| a.iter().filter_map(|v| v.as_str().map(String::from)).collect());
  let exclude: Vec<String> = payload["exclude"].as_array()
    .map(|a| a.iter().filter_map(|v| v.as_str().map(String::from)).collect())
    .unwrap_or_default();

  let mut results: Vec<FileEntry> = Vec::new();
  walk_dir(Path::new(dir), &extensions, &exclude, &mut results).map_err(|e| format!("file:discover: {e}"))?;
  serde_json::to_value(results).map_err(|e| e.to_string())
}

fn walk_dir(dir: &Path, extensions: &Option<Vec<String>>, extra_skip: &[String], results: &mut Vec<FileEntry>) -> std::io::Result<()> {
  let entries = match std::fs::read_dir(dir) { Ok(e) => e, Err(_) => return Ok(()) };
  for entry in entries.flatten() {
    let path = entry.path();
    let name_str = entry.file_name().to_string_lossy().to_string();
    if path.is_dir() {
      if !SKIP_DIRS.contains(&name_str.as_str()) && !extra_skip.iter().any(|s| s == &name_str) {
        walk_dir(&path, extensions, extra_skip, results)?;
      }
    } else if path.is_file() {
      let include = match extensions {
        None => true,
        Some(exts) => {
          let ext = path.extension().map(|e| format!(".{}", e.to_string_lossy())).unwrap_or_default();
          exts.iter().any(|e| e == &ext || e == &name_str)
        }
      };
      if include {
        if let Ok(meta) = entry.metadata() {
          let mtime_ms = meta.modified().ok().and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok()).map(|d| d.as_millis() as u64).unwrap_or(0);
          results.push(FileEntry { path: path.to_string_lossy().into_owned(), size: meta.len(), mtime_ms });
        }
      }
    }
  }
  Ok(())
}

// ---------------------------------------------------------------------------
// file:read
// ---------------------------------------------------------------------------

async fn file_read(payload: Value) -> TaskResult {
  let file_path = payload["path"].as_str().ok_or_else(|| "file:read: missing 'path'".to_string())?;
  let content = tokio::fs::read_to_string(file_path).await.map_err(|e| format!("file:read: {e}"))?;
  Ok(Value::String(content))
}

// ---------------------------------------------------------------------------
// file:readBatch
// ---------------------------------------------------------------------------

async fn file_read_batch(payload: Value) -> TaskResult {
  let paths: Vec<String> = payload["paths"].as_array()
    .ok_or_else(|| "file:readBatch: missing 'paths'".to_string())?
    .iter().filter_map(|v| v.as_str().map(String::from)).collect();

  let mut handles = Vec::with_capacity(paths.len());
  for p in paths {
    handles.push(tokio::spawn(async move {
      let content = tokio::fs::read_to_string(&p).await.unwrap_or_default();
      (p, content)
    }));
  }

  let mut map = HashMap::new();
  for h in handles {
    let (p, c) = h.await.map_err(|e| format!("file:readBatch: {e}"))?;
    if !c.is_empty() { map.insert(p, c); }
  }
  serde_json::to_value(map).map_err(|e| e.to_string())
}

// ---------------------------------------------------------------------------
// file:write
// ---------------------------------------------------------------------------

async fn file_write(payload: Value) -> TaskResult {
  let file_path = payload["path"].as_str().ok_or_else(|| "file:write: missing 'path'".to_string())?;
  let content = payload["content"].as_str().ok_or_else(|| "file:write: missing 'content'".to_string())?;
  if let Some(parent) = Path::new(file_path).parent() {
    tokio::fs::create_dir_all(parent).await.map_err(|e| format!("file:write mkdir: {e}"))?;
  }
  tokio::fs::write(file_path, content).await.map_err(|e| format!("file:write: {e}"))?;
  Ok(serde_json::json!({ "success": true }))
}

// ---------------------------------------------------------------------------
// file:exists
// ---------------------------------------------------------------------------

async fn file_exists(payload: Value) -> TaskResult {
  let file_path = payload["path"].as_str().ok_or_else(|| "file:exists: missing 'path'".to_string())?;
  Ok(Value::Bool(tokio::fs::metadata(file_path).await.is_ok()))
}

// ---------------------------------------------------------------------------
// git:log
// ---------------------------------------------------------------------------

#[derive(Serialize)]
struct GitEntry { hash: String, #[serde(rename = "shortHash")] short_hash: String, author: String, email: String, timestamp: u64, message: String }

async fn git_log(payload: Value) -> TaskResult {
  let file_paths: Vec<String> = payload["filePaths"].as_array()
    .ok_or_else(|| "git:log: missing 'filePaths'".to_string())?
    .iter().filter_map(|v| v.as_str().map(String::from)).collect();
  let max_commits = payload["maxCommits"].as_u64().unwrap_or(6);

  let mut handles = Vec::with_capacity(file_paths.len());
  for fp in file_paths {
    let n = max_commits;
    handles.push(tokio::spawn(async move {
      let out = Command::new("git").args(["log", "--follow", "-n", &n.to_string(), "--format=%H|%h|%an|%ae|%at|%s", "--", &fp]).output().await;
      let entries: Vec<GitEntry> = match out {
        Ok(o) if o.status.success() => {
          String::from_utf8_lossy(&o.stdout).trim().lines().filter(|l| !l.is_empty()).map(|line| {
            let parts: Vec<&str> = line.splitn(6, '|').collect();
            let ts = parts.get(4).and_then(|s| s.parse::<u64>().ok()).unwrap_or(0);
            GitEntry { hash: parts.first().unwrap_or(&"").to_string(), short_hash: parts.get(1).unwrap_or(&"").to_string(), author: parts.get(2).unwrap_or(&"").to_string(), email: parts.get(3).unwrap_or(&"").to_string(), timestamp: ts * 1000, message: parts.get(5).unwrap_or(&"").to_string() }
          }).collect()
        }
        _ => vec![],
      };
      (fp, entries)
    }));
  }

  let mut map: HashMap<String, Vec<GitEntry>> = HashMap::new();
  for h in handles {
    let (fp, entries) = h.await.map_err(|e| format!("git:log: {e}"))?;
    map.insert(fp, entries);
  }
  serde_json::to_value(map).map_err(|e| e.to_string())
}

// ---------------------------------------------------------------------------
// git:status
// ---------------------------------------------------------------------------

async fn git_status(_payload: Value) -> TaskResult {
  let out = Command::new("git").args(["status", "--porcelain"]).output().await.map_err(|e| format!("git:status: {e}"))?;
  let entries: Vec<Value> = String::from_utf8_lossy(&out.stdout).lines().filter(|l| !l.is_empty()).map(|line| {
    let status = if line.len() >= 2 { line[..2].trim() } else { "" };
    let path = if line.len() > 3 { &line[3..] } else { "" };
    serde_json::json!({ "status": status, "path": path })
  }).collect();
  Ok(Value::Array(entries))
}

// ---------------------------------------------------------------------------
// search:index
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
struct SearchDoc { id: String, title: String, content: String, path: String, locale: Option<String>, version: Option<String> }

#[derive(Serialize)]
struct IndexedDoc { id: String, title: String, content: String, path: String, #[serde(skip_serializing_if = "Option::is_none")] locale: Option<String>, #[serde(skip_serializing_if = "Option::is_none")] version: Option<String> }

async fn search_index(payload: Value) -> TaskResult {
  let docs: Vec<SearchDoc> = serde_json::from_value(payload["documents"].clone()).map_err(|e| format!("search:index: {e}"))?;
  let indexed: Vec<IndexedDoc> = docs.into_iter().map(|doc| IndexedDoc {
    id: doc.id, title: doc.title.to_lowercase(), content: doc.content.to_lowercase().chars().take(5000).collect(), path: doc.path, locale: doc.locale, version: doc.version,
  }).collect();
  let result = serde_json::json!({ "documents": indexed, "builtAt": std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0) });
  let s = serde_json::to_string(&result).map_err(|e| e.to_string())?;
  Ok(Value::String(s))
}