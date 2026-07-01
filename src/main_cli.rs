use log::{error, info};
use multi_protocol_file_manager::cli::app::App;
use multi_protocol_file_manager::utils::logger;
use multi_protocol_file_manager::VERSION;
use std::process;

fn main() {
    if let Some(log_path) = logger::init(log::LevelFilter::Info) {
        info!("mpfm {VERSION} CLI starting");
        info!("Log file: {}", log_path.display());
    }

    info!("启动 多协议文件管理器");

    // 创建运行时
    let rt = match tokio::runtime::Runtime::new() {
        Ok(rt) => rt,
        Err(e) => {
            error!("无法创建异步运行时: {}", e);
            process::exit(1);
        }
    };

    // 在运行时中执行应用
    rt.block_on(async {
        // 创建并运行应用
        match App::new() {
            Ok(mut app) => {
                if let Err(e) = app.run().await {
                    error!("运行错误: {}", e);
                    process::exit(1);
                }
            }
            Err(e) => {
                error!("初始化应用程序失败: {}", e);
                process::exit(1);
            }
        }
    });

    info!("应用程序正常退出");
}
