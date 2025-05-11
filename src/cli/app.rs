use std::path::{Path, PathBuf};
use std::collections::HashMap;
use std::io::Write;

use clap::ArgMatches;
use log::debug;
use indicatif::{ProgressBar, ProgressStyle};
use prettytable::{Table, row};
use serde_json::Value;

use crate::core::{ConnectionManager, ConnectionConfig, Result, Error};
use crate::core::operator;
use super::commands::build_cli;

pub struct App {
    conn_manager: ConnectionManager,
}

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
        let matches = build_cli().get_matches();
        
        match matches.subcommand() {
            Some(("connection", sub_matches)) => {
                self.handle_connection_command(sub_matches).await
            },
            Some(("ls", sub_matches)) => {
                self.handle_ls_command(sub_matches).await
            },
            Some(("upload", sub_matches)) => {
                self.handle_upload_command(sub_matches).await
            },
            Some(("download", sub_matches)) => {
                self.handle_download_command(sub_matches).await
            },
            Some(("rm", sub_matches)) => {
                self.handle_rm_command(sub_matches).await
            },
            Some(("mkdir", sub_matches)) => {
                self.handle_mkdir_command(sub_matches).await
            },
            Some(("stat", sub_matches)) => {
                self.handle_stat_command(sub_matches).await
            },
            _ => Err(Error::new_other("无效的命令")),
        }
    }
    
    async fn handle_connection_command(&mut self, matches: &ArgMatches) -> Result<()> {
        match matches.subcommand() {
            Some(("list", _)) => {
                let connections = self.conn_manager.get_connections();
                if connections.is_empty() {
                    println!("没有找到任何连接配置");
                    return Ok(());
                }
                
                let mut table = Table::new();
                table.add_row(row!["ID", "名称", "协议类型"]);
                
                for conn in connections {
                    table.add_row(row![conn.id, conn.name, conn.protocol_type]);
                }
                
                table.printstd();
                Ok(())
            },
            Some(("show", sub_matches)) => {
                let id = sub_matches.get_one::<String>("id").unwrap();
                let conn = self.conn_manager.get_connection(id)
                    .ok_or_else(|| Error::new_not_found(&format!("未找到连接: {}", id)))?;
                
                println!("连接 ID: {}", conn.id);
                println!("名称: {}", conn.name);
                println!("协议类型: {}", conn.protocol_type);
                println!("配置:");
                
                for (key, value) in &conn.config {
                    // 敏感信息隐藏显示
                    let display_value = if key.contains("key") || key.contains("password") || key.contains("secret") {
                        "******".to_string()
                    } else {
                        value.clone()
                    };
                    
                    println!("  {}: {}", key, display_value);
                }
                
                Ok(())
            },
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
            },
            Some(("remove", sub_matches)) => {
                let id = sub_matches.get_one::<String>("id").unwrap();
                self.conn_manager.remove_connection(id)?;
                
                println!("连接删除成功");
                Ok(())
            },
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
        
        let mut table = Table::new();
        table.add_row(row!["名称", "类型", "大小", "最后修改时间"]);
        
        for entry in entries {
            let name = entry.name();
            let mode = crate::utils::format::format_mode(entry.metadata().mode());
            
            let size = if entry.metadata().mode().is_file() {
                crate::utils::format::format_size(entry.metadata().content_length())
            } else {
                "-".to_string()
            };
            
            let time = crate::utils::format::format_time(entry.metadata().last_modified());
            
            table.add_row(row![name, mode, size, time]);
        }
        
        table.printstd();
        Ok(())
    }
    
    async fn handle_upload_command(&self, matches: &ArgMatches) -> Result<()> {
        let connection_id = matches.get_one::<String>("connection").unwrap();
        let local_path = matches.get_one::<String>("local_path").unwrap();
        let remote_path = matches.get_one::<String>("remote_path").unwrap();
        
        let protocol = self.conn_manager.create_protocol(connection_id)?;
        let file_manager = operator::create_file_manager(protocol.as_ref())?;
        
        let local_path = Path::new(local_path);
        
        if !local_path.exists() {
            return Err(Error::new_not_found(&format!(
                "本地文件不存在: {}", local_path.display()
            )));
        }
        
        let meta = local_path.metadata()?;
        let size = meta.len();
        
        if size > 5 * 1024 * 1024 {
            // 大于 5MB 的文件显示进度条
            let pb = ProgressBar::new(size);
            pb.set_style(ProgressStyle::default_bar()
                .template("{spinner:.green} [{elapsed_precise}] [{bar:40.cyan/blue}] {bytes}/{total_bytes} ({eta})")
                .unwrap()
                .progress_chars("#>-"));
            
            file_manager.upload_with_progress(local_path, remote_path, move |current, total| {
                pb.set_position(current);
                if current >= total {
                    pb.finish_with_message("上传完成");
                }
            }).await?;
        } else {
            file_manager.upload(local_path, remote_path).await?;
            println!("文件上传成功");
        }
        
        Ok(())
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
            // 大于 5MB 的文件显示进度条
            let pb = ProgressBar::new(size);
            pb.set_style(ProgressStyle::default_bar()
                .template("{spinner:.green} [{elapsed_precise}] [{bar:40.cyan/blue}] {bytes}/{total_bytes} ({eta})")
                .unwrap()
                .progress_chars("#>-"));
            
            file_manager.download_with_progress(remote_path, &local_path, move |current, total| {
                pb.set_position(current);
                if current >= total {
                    pb.finish_with_message("下载完成");
                }
            }).await?;
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
            return Err(Error::new_other("无法删除目录，请使用 --recursive 参数递归删除"));
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
        println!("类型: {}", if meta.mode().is_file() { "文件" } else { "目录" });
        
        if meta.mode().is_file() {
            println!("大小: {} ({})", crate::utils::format::format_size(meta.content_length()), meta.content_length());
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