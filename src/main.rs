mod cli;
mod core;
mod protocols;
mod utils;

use cli::App;
use log::{error, info};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 初始化日志
    utils::logger::init()?;
    
    info!("启动 OpenDAL 多协议文件管理器");
    
    // 创建并运行应用
    match App::new() {
        Ok(mut app) => {
            if let Err(e) = app.run().await {
                error!("运行错误: {}", e);
                return Err(e.into());
            }
        }
        Err(e) => {
            error!("初始化应用程序失败: {}", e);
            return Err(e.into());
        }
    }
    
    info!("应用程序正常退出");
    Ok(())
}