use std::collections::HashMap;
use std::path::{Path, PathBuf};

use opendal::{Operator, services};
use log::debug;

use crate::core::error::{Error, Result};
use super::traits::{Protocol, Capabilities};

/// 本地文件系统协议适配器
#[derive(Debug)]
pub struct FSProtocol {
    root_dir: PathBuf,
}

impl FSProtocol {
    /// 创建新的本地文件系统协议适配器
    pub fn new<P: AsRef<Path>>(root_dir: P) -> Self {
        Self {
            root_dir: root_dir.as_ref().to_path_buf(),
        }
    }
    
    /// 从配置创建适配器
    pub fn from_config(config: &HashMap<String, String>) -> Result<Self> {
        let root_dir = config.get("root_dir")
            .ok_or_else(|| Error::new_config("本地文件系统配置缺少 'root_dir' 参数"))?;
            
        // 验证路径是否存在
        let path = Path::new(root_dir);
        if !path.exists() {
            return Err(Error::new_not_found(&format!("路径不存在: {}", root_dir)));
        }
        
        if !path.is_dir() {
            return Err(Error::new_config(&format!("路径不是目录: {}", root_dir)));
        }
        
        Ok(Self::new(path))
    }
}

impl Protocol for FSProtocol {
    fn create_operator(&self) -> Result<Operator> {
        debug!("创建本地文件系统操作符, 根目录: {:?}", self.root_dir);
        
        // 创建 FS 服务配置
        let builder = services::Fs::default()
            .root(&self.root_dir.to_string_lossy());
        
        // 创建 Operator
        let op = match Operator::new(builder) {
            Ok(op_builder) => op_builder.finish(),
            Err(e) => return Err(Error::from(e)),
        };
        
        Ok(op)
    }
    
    fn get_id(&self) -> String {
        format!("fs:{}", self.root_dir.display())
    }
    
    fn get_name(&self) -> String {
        format!("本地文件系统 ({})", self.root_dir.display())
    }
    
    fn get_capabilities(&self) -> Capabilities {
        Capabilities::default()
            .with_list(true)
            .with_read(true)
            .with_write(true)
            .with_delete(true)
            .with_create_dir(true)
    }
}