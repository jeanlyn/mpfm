use std::collections::HashMap;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

use clap::{Arg, ArgAction, ArgMatches, Command};
use log::debug;
use serde_json::Value;

use crate::core::operator;
use crate::core::{ConnectionConfig, ConnectionManager, Error, Result};

#[allow(dead_code)]
pub struct App {
    conn_manager: ConnectionManager,
}

#[allow(dead_code)]
impl App {
    pub fn new() -> Result<Self> {
        // 初始化应用程序
        let config_dir = dirs::config_dir()
            .ok_or_else(|| Error::new_config("无法获取配置目录"))?
            .join("mpfm");

        if !config_dir.exists() {
            std::fs::create_dir_all(&config_dir)?;
        }

        let config_path = config_dir.join("connections.json");
        debug!("使用配置文件: {:?}", config_path);

        let conn_manager = ConnectionManager::new(config_path)?;

        Ok(Self { conn_manager })
    }

    pub async fn run(&mut self) -> Result<()> {
        // 构建命令行参数解析器
        let matches = self.build_cli().get_matches();

        match matches.subcommand() {
            Some(("connection", sub_matches)) => self.handle_connection_command(sub_matches).await,
            Some(("ls", sub_matches)) => self.handle_ls_command(sub_matches).await,
            Some(("upload", sub_matches)) => self.handle_upload_command(sub_matches).await,
            Some(("download", sub_matches)) => self.handle_download_command(sub_matches).await,
            Some(("rm", sub_matches)) => self.handle_rm_command(sub_matches).await,
            Some(("mkdir", sub_matches)) => self.handle_mkdir_command(sub_matches).await,
            Some(("stat", sub_matches)) => self.handle_stat_command(sub_matches).await,
            _ => Err(Error::new_other("无效的命令")),
        }
    }

    fn build_cli(&self) -> Command {
        Command::new("mpfm")
            .about("多协议文件管理器")
            .version(env!("CARGO_PKG_VERSION"))
            .subcommand_required(true)
            .arg_required_else_help(true)
            .subcommand(
                Command::new("connection")
                    .about("管理连接配置")
                    .subcommand_required(true)
                    .subcommand(Command::new("list").about("列出所有连接"))
                    .subcommand(
                        Command::new("show")
                            .about("显示连接详情")
                            .arg(Arg::new("id").help("连接 ID").required(true)),
                    )
                    .subcommand(
                        Command::new("add")
                            .about("添加新连接")
                            .arg(
                                Arg::new("name")
                                    .short('n')
                                    .long("name")
                                    .help("连接名称")
                                    .required(true),
                            )
                            .arg(
                                Arg::new("type")
                                    .short('t')
                                    .long("type")
                                    .help("协议类型 (s3, fs 等)")
                                    .required(true),
                            )
                            .arg(
                                Arg::new("config")
                                    .short('c')
                                    .long("config")
                                    .help("连接配置 (JSON 格式)")
                                    .required(true),
                            ),
                    )
                    .subcommand(
                        Command::new("remove")
                            .about("删除连接")
                            .arg(Arg::new("id").help("连接 ID").required(true)),
                    ),
            )
            .subcommand(
                Command::new("ls")
                    .about("列出文件和目录")
                    .arg(
                        Arg::new("connection")
                            .short('c')
                            .long("connection")
                            .help("连接 ID")
                            .required(true),
                    )
                    .arg(Arg::new("path").help("远程路径").default_value("/")),
            )
            .subcommand(
                Command::new("upload")
                    .about("上传文件")
                    .arg(
                        Arg::new("connection")
                            .short('c')
                            .long("connection")
                            .help("连接 ID")
                            .required(true),
                    )
                    .arg(Arg::new("local_path").help("本地文件路径").required(true))
                    .arg(Arg::new("remote_path").help("远程文件路径").required(true)),
            )
            .subcommand(
                Command::new("download")
                    .about("下载文件")
                    .arg(
                        Arg::new("connection")
                            .short('c')
                            .long("connection")
                            .help("连接 ID")
                            .required(true),
                    )
                    .arg(Arg::new("remote_path").help("远程文件路径").required(true))
                    .arg(Arg::new("local_path").help("本地文件路径").required(true)),
            )
            .subcommand(
                Command::new("rm")
                    .about("删除文件或目录")
                    .arg(
                        Arg::new("connection")
                            .short('c')
                            .long("connection")
                            .help("连接 ID")
                            .required(true),
                    )
                    .arg(Arg::new("path").help("远程路径").required(true))
                    .arg(
                        Arg::new("recursive")
                            .short('r')
                            .long("recursive")
                            .help("递归删除目录")
                            .action(ArgAction::SetTrue),
                    ),
            )
            .subcommand(
                Command::new("mkdir")
                    .about("创建目录")
                    .arg(
                        Arg::new("connection")
                            .short('c')
                            .long("connection")
                            .help("连接 ID")
                            .required(true),
                    )
                    .arg(Arg::new("path").help("远程路径").required(true)),
            )
            .subcommand(
                Command::new("stat")
                    .about("获取文件或目录信息")
                    .arg(
                        Arg::new("connection")
                            .short('c')
                            .long("connection")
                            .help("连接 ID")
                            .required(true),
                    )
                    .arg(Arg::new("path").help("远程路径").required(true)),
            )
    }

    async fn handle_connection_command(&mut self, matches: &ArgMatches) -> Result<()> {
        match matches.subcommand() {
            Some(("list", _)) => {
                let connections = self.conn_manager.get_connections();
                if connections.is_empty() {
                    println!("没有找到任何连接配置");
                    return Ok(());
                }

                // 使用简单的打印方式
                println!("{:<36} {:<20} {:<10}", "ID", "名称", "协议类型");
                println!("{:-<36} {:-<20} {:-<10}", "", "", "");

                for conn in connections {
                    println!(
                        "{:<36} {:<20} {:<10}",
                        conn.id, conn.name, conn.protocol_type
                    );
                }

                Ok(())
            }
            Some(("show", sub_matches)) => {
                let id = sub_matches.get_one::<String>("id").unwrap();
                let conn = self
                    .conn_manager
                    .get_connection(id)
                    .ok_or_else(|| Error::new_not_found(&format!("未找到连接: {}", id)))?;

                println!("连接 ID: {}", conn.id);
                println!("名称: {}", conn.name);
                println!("协议类型: {}", conn.protocol_type);
                println!("配置:");

                for (key, value) in &conn.config {
                    // 敏感信息隐藏显示
                    let display_value = if key.contains("key")
                        || key.contains("password")
                        || key.contains("secret")
                    {
                        "******".to_string()
                    } else {
                        value.clone()
                    };

                    println!("  {}: {}", key, display_value);
                }

                Ok(())
            }
            Some(("add", sub_matches)) => {
                let name = sub_matches.get_one::<String>("name").unwrap().clone();
                let protocol_type = sub_matches.get_one::<String>("type").unwrap().clone();
                let config_json = sub_matches.get_one::<String>("config").unwrap();

                let config_value: Value = serde_json::from_str(config_json)
                    .map_err(|e| Error::new_config(&format!("无效的 JSON 配置: {}", e)))?;

                if !config_value.is_object() {
                    return Err(Error::new_config("配置必须是 JSON 对象"));
                }

                let config_obj = config_value.as_object().unwrap();
                let mut config = HashMap::new();

                for (key, value) in config_obj {
                    if !value.is_string() {
                        return Err(Error::new_config(&format!("配置值 '{}' 必须是字符串", key)));
                    }

                    config.insert(key.clone(), value.as_str().unwrap().to_string());
                }

                let conn_config = ConnectionConfig::new(name, protocol_type, config);
                self.conn_manager.add_connection(conn_config)?;

                println!("连接添加成功");
                Ok(())
            }
            Some(("remove", sub_matches)) => {
                let id = sub_matches.get_one::<String>("id").unwrap();
                self.conn_manager.remove_connection(id)?;

                println!("连接删除成功");
                Ok(())
            }
            _ => Err(Error::new_other("无效的连接命令")),
        }
    }

    async fn handle_ls_command(&self, matches: &ArgMatches) -> Result<()> {
        let connection_id = matches.get_one::<String>("connection").unwrap();
        let path = matches.get_one::<String>("path").unwrap();

        let protocol = self.conn_manager.create_protocol(connection_id)?;
        let file_manager = operator::create_file_manager(protocol.as_ref())?;

        let entries = file_manager.list(path).await?;

        if entries.is_empty() {
            println!("目录为空");
            return Ok(());
        }

        // 使用简单的打印方式
        println!(
            "{:<30} {:<10} {:<15} {:<25}",
            "名称", "类型", "大小", "最后修改时间"
        );
        println!("{:-<30} {:-<10} {:-<15} {:-<25}", "", "", "", "");

        for entry in entries {
            let name = entry.name();
            let mode = if entry.metadata().mode().is_file() {
                "文件"
            } else {
                "目录"
            };

            let size = if entry.metadata().mode().is_file() {
                // Check if content_length is available before accessing it
                entry.metadata().content_length().to_string()
            } else {
                "-".to_string()
            };

            let time = if let Some(tm) = entry.metadata().last_modified() {
                tm.format("%Y-%m-%d %H:%M:%S").to_string()
            } else {
                "未知".to_string()
            };

            println!("{:<30} {:<10} {:<15} {:<25}", name, mode, size, time);
        }

        Ok(())
    }

    async fn handle_upload_command(&self, matches: &ArgMatches) -> Result<()> {
        let connection_id = matches.get_one::<String>("connection").unwrap();
        let local_path = matches.get_one::<String>("local_path").unwrap();
        let remote_path = matches.get_one::<String>("remote_path").unwrap();

        println!("准备上传: {} -> {}", local_path, remote_path);

        let protocol = self.conn_manager.create_protocol(connection_id)?;
        let file_manager = operator::create_file_manager(protocol.as_ref())?;

        let local_path = Path::new(local_path);

        if !local_path.exists() {
            return Err(Error::new_not_found(&format!(
                "本地文件不存在: {}",
                local_path.display()
            )));
        }

        // Simple upload without any progress tracking
        let result = file_manager.upload(local_path, remote_path).await;

        match result {
            Ok(_) => {
                println!("文件上传成功");
                Ok(())
            }
            Err(e) => Err(e),
        }
    }

    async fn handle_download_command(&self, matches: &ArgMatches) -> Result<()> {
        let connection_id = matches.get_one::<String>("connection").unwrap();
        let remote_path = matches.get_one::<String>("remote_path").unwrap();
        let local_path = matches.get_one::<String>("local_path").unwrap();

        let protocol = self.conn_manager.create_protocol(connection_id)?;
        let file_manager = operator::create_file_manager(protocol.as_ref())?;

        // 获取远程文件元信息
        let meta = file_manager.stat(remote_path).await?;
        let size = meta.content_length();

        let local_path = PathBuf::from(local_path);

        if size > 5 * 1024 * 1024 {
            // 大于 5MB 的文件显示进度
            println!("正在下载: {} -> {}", remote_path, local_path.display());
            println!("文件大小: {}", crate::utils::format::format_size(size));

            // 使用 AtomicU64 来存储进度百分比, 这样可以在闭包中安全修改
            let progress = Arc::new(AtomicU64::new(0));
            let progress_clone = Arc::clone(&progress);

            file_manager
                .download_with_progress(remote_path, &local_path, move |current, total| {
                    let percent = ((current as f64 / total as f64) * 100.0) as u64;
                    let last_percent = progress_clone.load(Ordering::Relaxed);

                    if percent > last_percent && percent % 10 == 0 {
                        println!("下载进度: {}%", percent);
                        progress_clone.store(percent, Ordering::Relaxed);
                    }
                })
                .await?;

            println!("下载完成: 100%");
        } else {
            file_manager.download(remote_path, &local_path).await?;
            println!("文件下载成功");
        }

        Ok(())
    }

    async fn handle_rm_command(&self, matches: &ArgMatches) -> Result<()> {
        let connection_id = matches.get_one::<String>("connection").unwrap();
        let path = matches.get_one::<String>("path").unwrap();
        let recursive = matches.get_flag("recursive");

        let protocol = self.conn_manager.create_protocol(connection_id)?;
        let file_manager = operator::create_file_manager(protocol.as_ref())?;

        // 获取文件/目录信息
        let meta = file_manager.stat(path).await?;

        if meta.mode().is_dir() && !recursive {
            return Err(Error::new_other(
                "无法删除目录，请使用 --recursive 参数递归删除",
            ));
        }

        // 确认删除提示
        print!("确认删除 {}? [y/N] ", path);
        std::io::stdout().flush().unwrap();

        let mut input = String::new();
        std::io::stdin().read_line(&mut input).unwrap();

        if !input.trim().eq_ignore_ascii_case("y") {
            println!("操作取消");
            return Ok(());
        }

        file_manager.delete(path).await?;
        println!("删除成功");

        Ok(())
    }

    async fn handle_mkdir_command(&self, matches: &ArgMatches) -> Result<()> {
        let connection_id = matches.get_one::<String>("connection").unwrap();
        let path = matches.get_one::<String>("path").unwrap();

        let protocol = self.conn_manager.create_protocol(connection_id)?;
        let file_manager = operator::create_file_manager(protocol.as_ref())?;

        // 确保路径以斜杠结尾
        let mut dir_path = path.to_string();
        if !dir_path.ends_with('/') {
            dir_path.push('/');
        }

        file_manager.create_dir(&dir_path).await?;
        println!("目录创建成功");

        Ok(())
    }

    async fn handle_stat_command(&self, matches: &ArgMatches) -> Result<()> {
        let connection_id = matches.get_one::<String>("connection").unwrap();
        let path = matches.get_one::<String>("path").unwrap();

        let protocol = self.conn_manager.create_protocol(connection_id)?;
        let file_manager = operator::create_file_manager(protocol.as_ref())?;

        let meta = file_manager.stat(path).await?;

        println!("路径: {}", path);
        println!(
            "类型: {}",
            if meta.mode().is_file() {
                "文件"
            } else {
                "目录"
            }
        );

        if meta.mode().is_file() {
            println!(
                "大小: {} ({})",
                crate::utils::format::format_size(meta.content_length()),
                meta.content_length()
            );
        }

        if let Some(time) = meta.last_modified() {
            println!("最后修改时间: {}", time.format("%Y-%m-%d %H:%M:%S"));
        }

        if let Some(etag) = meta.etag() {
            println!("ETag: {}", etag);
        }

        if let Some(content_type) = meta.content_type() {
            println!("Content-Type: {}", content_type);
        }

        println!("内容 MD5: {:?}", meta.content_md5());

        Ok(())
    }
}
