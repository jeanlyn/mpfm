use env_logger::{Builder, Env, Target};
use log::LevelFilter;
use std::fs::{self, OpenOptions};
use std::io::{self, Write};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

const LOG_FILE_NAME: &str = "mpfm.log";
const MAX_LOG_BYTES: u64 = 5 * 1024 * 1024;

/// 日志目录：`~/.config/mpfm/logs`（Windows 为 `%APPDATA%/mpfm/logs`）
pub fn log_dir() -> Option<PathBuf> {
    dirs::config_dir().map(|d| d.join("mpfm").join("logs"))
}

/// 当前日志文件路径
pub fn log_file_path() -> Option<PathBuf> {
    log_dir().map(|d| d.join(LOG_FILE_NAME))
}

fn trim_log_file(path: &PathBuf, keep_bytes: u64) -> io::Result<()> {
    let content = fs::read(path)?;
    let keep = keep_bytes as usize;
    if content.len() > keep {
        fs::write(path, &content[content.len() - keep..])?;
    }
    Ok(())
}

fn ensure_log_file() -> io::Result<PathBuf> {
    let dir = log_dir().ok_or_else(|| {
        io::Error::new(io::ErrorKind::NotFound, "无法获取配置目录")
    })?;
    fs::create_dir_all(&dir)?;
    let path = dir.join(LOG_FILE_NAME);
    if path.exists() {
        if let Ok(meta) = fs::metadata(&path) {
            if meta.len() > MAX_LOG_BYTES {
                trim_log_file(&path, MAX_LOG_BYTES / 2)?;
            }
        }
    }
    Ok(path)
}

struct TeeWriter {
    file: Arc<Mutex<std::fs::File>>,
}

impl Write for TeeWriter {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        let mut stderr = io::stderr();
        stderr.write_all(buf)?;
        if let Ok(mut file) = self.file.lock() {
            let _ = file.write_all(buf);
        }
        Ok(buf.len())
    }

    fn flush(&mut self) -> io::Result<()> {
        io::stderr().flush()?;
        if let Ok(mut file) = self.file.lock() {
            let _ = file.flush();
        }
        Ok(())
    }
}

/// 初始化日志：同时输出到 stderr 与日志文件。`RUST_LOG` 仍可覆盖默认级别。
pub fn init(default_level: LevelFilter) -> Option<PathBuf> {
    let log_path = ensure_log_file().ok()?;
    let file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
        .ok()?;

    let writer = TeeWriter {
        file: Arc::new(Mutex::new(file)),
    };

    Builder::from_env(Env::default().default_filter_or(match default_level {
        LevelFilter::Off => "off",
        LevelFilter::Error => "error",
        LevelFilter::Warn => "warn",
        LevelFilter::Info => "info",
        LevelFilter::Debug => "debug",
        LevelFilter::Trace => "trace",
    }))
    .format_timestamp_secs()
    .target(Target::Pipe(Box::new(writer)))
    .init();

    Some(log_path)
}
