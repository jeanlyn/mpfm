use std::io::Write;
use env_logger::{Builder, Env};
use log::LevelFilter;

/// 初始化日志系统
pub fn init() -> Result<(), Box<dyn std::error::Error>> {
    let env = Env::default()
        .filter_or("RUST_LOG", "info")
        .write_style_or("RUST_LOG_STYLE", "always");

    let mut builder = Builder::from_env(env);
    
    builder
        .format(|buf, record| {
            let timestamp = chrono::Local::now().format("%Y-%m-%d %H:%M:%S");
            writeln!(
                buf,
                "{} [{}] [{}] {}",
                timestamp,
                record.level(),
                record.target(),
                record.args()
            )
        })
        .filter(None, LevelFilter::Info)
        .init();

    Ok(())
}

/// 设置日志级别
pub fn set_log_level(level: LevelFilter) {
    log::set_max_level(level);
}