use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};
use log::{debug, info};
use uuid::Uuid;

use crate::core::error::{Error, Result};
use crate::protocols::{self, Protocol};

/// 存储连接配置信息
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConnectionConfig {
    pub id: String,
    pub name: String,
    pub protocol_type: String,
    pub config: HashMap<String, String>,
}

impl ConnectionConfig {
    /// 创建新的连接配置
    pub fn new(name: String, protocol_type: String, config: HashMap<String, String>) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            name,
            protocol_type,
            config,
        }
    }
}

/// 管理连接配置的结构体
pub struct ConnectionManager {
    config_path: PathBuf,
    connections: HashMap<String, ConnectionConfig>,
}

impl ConnectionManager {
    /// 创建新的连接管理器
    pub fn new(config_path: PathBuf) -> Result<Self> {
        // 如果目录不存在，创建目录
        if let Some(parent) = config_path.parent() {
            if !parent.exists() {
                fs::create_dir_all(parent)?;
            }
        }
        
        let connections = if config_path.exists() {
            let content = fs::read_to_string(&config_path)?;
            if content.trim().is_empty() {
                HashMap::new()
            } else {
                match serde_json::from_str::<Vec<ConnectionConfig>>(&content) {
                    Ok(configs) => {
                        let mut map = HashMap::new();
                        for config in configs {
                            map.insert(config.id.clone(), config);
                        }
                        map
                    },
                    Err(e) => {
                        debug!("解析配置文件失败: {}, 将使用空配置", e);
                        HashMap::new()
                    }
                }
            }
        } else {
            HashMap::new()
        };
        
        info!("已加载 {} 个连接配置", connections.len());
        
        Ok(Self { 
            config_path, 
            connections 
        })
    }
    
    /// 保存连接配置
    pub fn save_connections(&self) -> Result<()> {
        let configs: Vec<ConnectionConfig> = self.connections.values().cloned().collect();
        let config_json = serde_json::to_string_pretty(&configs)?;
        fs::write(&self.config_path, config_json)?;
        debug!("已保存 {} 个连接配置到 {:?}", configs.len(), self.config_path);
        Ok(())
    }
    
    /// 添加新连接
    pub fn add_connection(&mut self, config: ConnectionConfig) -> Result<()> {
        info!("添加新连接: {} ({})", config.name, config.id);
        self.connections.insert(config.id.clone(), config);
        self.save_connections()
    }
    
    /// 删除连接
    pub fn remove_connection(&mut self, id: &str) -> Result<()> {
        if !self.connections.contains_key(id) {
            return Err(Error::new_not_found(&format!("连接 ID 不存在: {}", id)));
        }
        
        info!("删除连接: {}", id);
        self.connections.remove(id);
        self.save_connections()
    }

    /// 更新连接配置
    pub fn update_connection(&mut self, id: &str, name: String, protocol_type: String, config: HashMap<String, String>) -> Result<()> {
        if !self.connections.contains_key(id) {
            return Err(Error::new_not_found(&format!("连接 ID 不存在: {}", id)));
        }
        
        info!("更新连接: {} -> {}", id, name);
        
        // 创建新的连接配置，保持原有的 ID
        let mut updated_config = ConnectionConfig::new(name, protocol_type, config);
        updated_config.id = id.to_string(); // 保持原有 ID
        
        self.connections.insert(id.to_string(), updated_config);
        self.save_connections()
    }
    
    /// 获取连接列表
    pub fn get_connections(&self) -> Vec<&ConnectionConfig> {
        self.connections.values().collect()
    }
    
    /// 获取连接配置
    pub fn get_connection(&self, id: &str) -> Option<&ConnectionConfig> {
        self.connections.get(id)
    }
    
    /// 根据连接 ID 创建对应的协议适配器
    pub fn create_protocol(&self, id: &str) -> Result<Box<dyn Protocol>> {
        let config = self.get_connection(id)
            .ok_or_else(|| Error::new_not_found(&format!("连接不存在: {}", id)))?;
        
        protocols::create_protocol(&config.protocol_type, &config.config)
    }
}