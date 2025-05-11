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
        let connections = Self::load_connections(&config_path)?;
        info!("已加载 {} 个连接配置", connections.len());
        
        Ok(Self { 
            config_path, 
            connections 
        })
    }
    
    /// 加载连接配置
    fn load_connections(path: &Path) -> Result<HashMap<String, ConnectionConfig>> {
        if !path.exists() {
            debug!("配置文件不存在: {:?}, 将创建一个空的配置", path);
            return Ok(HashMap::new());
        }
        
        let config_str = fs::read_to_string(path)
            .map_err(|e| Error::new_io(&format!("无法读取配置文件: {}", e)))?;
            
        if config_str.trim().is_empty() {
            debug!("配置文件为空, 返回空配置");
            return Ok(HashMap::new());
        }
        
        let configs: Vec<ConnectionConfig> = serde_json::from_str(&config_str)
            .map_err(|e| Error::new_config(&format!("解析配置文件失败: {}", e)))?;
            
        let mut connections = HashMap::new();
        for config in configs {
            connections.insert(config.id.clone(), config);
        }
        
        Ok(connections)
    }
    
    /// 保存连接配置
    pub fn save_connections(&self) -> Result<()> {
        let configs: Vec<ConnectionConfig> = self.connections.values().cloned().collect();
        
        let dir_path = self.config_path.parent()
            .ok_or_else(|| Error::new_io("无法获取配置文件的父目录"))?;
            
        if !dir_path.exists() {
            fs::create_dir_all(dir_path)
                .map_err(|e| Error::new_io(&format!("无法创建配置目录: {}", e)))?;
        }
        
        let config_str = serde_json::to_string_pretty(&configs)
            .map_err(|e| Error::new_config(&format!("序列化配置失败: {}", e)))?;
            
        fs::write(&self.config_path, config_str)
            .map_err(|e| Error::new_io(&format!("写入配置文件失败: {}", e)))?;
            
        debug!("已保存 {} 个连接配置到 {:?}", configs.len(), self.config_path);
        
        Ok(())
    }
    
    /// 添加新连接
    pub fn add_connection(&mut self, config: ConnectionConfig) -> Result<()> {
        info!("添加新连接: {} ({})", config.name, config.id);
        self.connections.insert(config.id.clone(), config);
        self.save_connections()
    }
    
    /// 更新连接
    pub fn update_connection(&mut self, config: ConnectionConfig) -> Result<()> {
        if !self.connections.contains_key(&config.id) {
            return Err(Error::new_not_found(&format!("连接 ID 不存在: {}", config.id)));
        }
        
        info!("更新连接: {} ({})", config.name, config.id);
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