use std::path::{Path, PathBuf};

use crate::utils::logger::{log_dir, log_file_path};
use crate::VERSION;

const TAIL_LINES: usize = 500;

pub struct DiagnosticsInfo {
    pub log_path: Option<PathBuf>,
    pub report: String,
}

/// 生成诊断报告，包含版本、系统信息与最近日志
pub fn build_diagnostics_report(build_target: &str) -> DiagnosticsInfo {
    let log_path = log_file_path();
    let mut report = String::new();

    report.push_str("MPFM Diagnostics Report\n");
    report.push_str(&format!(
        "Generated: {}\n",
        chrono::Local::now().format("%Y-%m-%d %H:%M:%S %:z")
    ));

    append_section(&mut report, "Application", |r| {
        r.push_str("Name: mpfm (Multi-Protocol File Manager)\n");
        r.push_str(&format!("Version: {VERSION}\n"));
        r.push_str(&format!("Build: {build_target}\n"));
    });

    append_section(&mut report, "System", |r| {
        r.push_str(&format!(
            "OS: {} {}\n",
            std::env::consts::OS,
            std::env::consts::ARCH
        ));
        if let Ok(value) = std::env::var("RUST_LOG") {
            r.push_str(&format!("RUST_LOG: {value}\n"));
        }
    });

    append_section(&mut report, "Paths", |r| {
        if let Some(dir) = log_dir() {
            r.push_str(&format!("Log directory: {}\n", dir.display()));
        }
        if let Some(config) = dirs::config_dir() {
            r.push_str(&format!("Config directory: {}/mpfm\n", config.display()));
        }
        if let Some(path) = &log_path {
            r.push_str(&format!("Log file: {}\n", path.display()));
        }
    });

    append_section(&mut report, "Recent Logs", |r| {
        match log_path.as_deref() {
            Some(path) => match read_tail_lines(path, TAIL_LINES) {
                Ok(content) if content.is_empty() => r.push_str("(empty)\n"),
                Ok(content) => r.push_str(&content),
                Err(e) => r.push_str(&format!("Failed to read log file: {e}\n")),
            },
            None => r.push_str("(log file unavailable)\n"),
        }
    });

    DiagnosticsInfo { log_path, report }
}

fn append_section(report: &mut String, title: &str, fill: impl FnOnce(&mut String)) {
    report.push_str(&format!("\n=== {title} ===\n"));
    fill(report);
}

fn read_tail_lines(path: &Path, max_lines: usize) -> std::io::Result<String> {
    let content = std::fs::read_to_string(path)?;
    let lines: Vec<&str> = content.lines().collect();
    let start = lines.len().saturating_sub(max_lines);
    Ok(lines[start..].join("\n"))
}
