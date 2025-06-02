use opendal::Operator;
use std::fmt::Debug;

use crate::core::error::Result;

/// 文件系统或存储服务的能力描述
#[derive(Debug, Default, Clone)]
pub struct Capabilities {
    pub can_list: bool,
    pub can_read: bool,
    pub can_write: bool,
    pub can_delete: bool,
    pub can_rename: bool,
    pub can_copy: bool,
    pub can_create_dir: bool,
    pub can_batch_delete: bool,
}

impl Capabilities {
    pub fn with_list(mut self, value: bool) -> Self {
        self.can_list = value;
        self
    }

    pub fn with_read(mut self, value: bool) -> Self {
        self.can_read = value;
        self
    }

    pub fn with_write(mut self, value: bool) -> Self {
        self.can_write = value;
        self
    }

    pub fn with_delete(mut self, value: bool) -> Self {
        self.can_delete = value;
        self
    }

    pub fn with_rename(mut self, value: bool) -> Self {
        self.can_rename = value;
        self
    }

    pub fn with_copy(mut self, value: bool) -> Self {
        self.can_copy = value;
        self
    }

    pub fn with_create_dir(mut self, value: bool) -> Self {
        self.can_create_dir = value;
        self
    }

    pub fn with_batch_delete(mut self, value: bool) -> Self {
        self.can_batch_delete = value;
        self
    }
}

/// 存储协议接口特性
pub trait Protocol: Debug + Send + Sync {
    /// 创建 OpenDAL 操作符
    fn create_operator(&self) -> Result<Operator>;

    /// 获取协议的唯一标识符
    fn get_id(&self) -> String;

    /// 获取协议的友好名称
    fn get_name(&self) -> String;

    /// 获取该协议的能力描述
    fn get_capabilities(&self) -> Capabilities;
}
