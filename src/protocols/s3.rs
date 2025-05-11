use std::collections::HashMap;

use opendal::{Operator, services};
use log::debug;

use crate::core::error::{Error, Result};
use super::traits::{Protocol, Capabilities};

#[derive(Debug)]
pub struct S3Protocol {
    bucket: String,
    region: String,
    endpoint: Option<String>,
    access_key: String,
    secret_key: String,
    path_style: bool,
}

impl S3Protocol {
    pub fn new(
        bucket: String,
        region: String,
        access_key: String,
        secret_key: String,
        endpoint: Option<String>,
        path_style: bool,
    ) -> Self {
        Self {
            bucket,
            region,
            endpoint,
            access_key,
            secret_key,
            path_style,
        }
    }
    
    pub fn from_config(config: &HashMap<String, String>) -> Result<Self> {
        let bucket = config.get("bucket")
            .ok_or_else(|| Error::new_config("S3配置缺少 'bucket' 参数"))?
            .clone();
            
        let region = config.get("region")
            .ok_or_else(|| Error::new_config("S3配置缺少 'region' 参数"))?
            .clone();
            
        let access_key = config.get("access_key")
            .ok_or_else(|| Error::new_config("S3配置缺少 'access_key' 参数"))?
            .clone();
            
        let secret_key = config.get("secret_key")
            .ok_or_else(|| Error::new_config("S3配置缺少 'secret_key' 参数"))?
            .clone();
            
        let endpoint = config.get("endpoint").cloned();
        
        let path_style = config.get("path_style")
            .map(|v| v.to_lowercase() == "true")
            .unwrap_or(false);
            
        Ok(Self::new(
            bucket,
            region,
            access_key,
            secret_key,
            endpoint,
            path_style,
        ))
    }
}

impl Protocol for S3Protocol {
    fn create_operator(&self) -> Result<Operator> {
        debug!("创建 S3 操作符, bucket: {}, region: {}", self.bucket, self.region);
        
        // 创建 S3 服务配置
        let mut builder = services::S3::default();
        builder.bucket(&self.bucket);
        builder.region(&self.region);
        builder.access_key_id(&self.access_key);
        builder.secret_access_key(&self.secret_key);
        
        if let Some(endpoint) = &self.endpoint {
            debug!("使用自定义端点: {}", endpoint);
            builder.endpoint(endpoint);
        }
        
        if self.path_style {
            debug!("使用路径样式访问");
            // 某些版本可能不支持 path_style
            // builder.path_style(true);
        }
        
        // 创建 Operator - 注意需要 finish() 完成初始化
        let op = match Operator::new(builder) {
            Ok(op_builder) => op_builder.finish(),
            Err(e) => return Err(Error::from(e)),
        };
        
        Ok(op)
    }
    
    fn get_id(&self) -> String {
        format!("s3:{}", self.bucket)
    }
    
    fn get_name(&self) -> String {
        if let Some(endpoint) = &self.endpoint {
            format!("S3 ({}) @ {}", self.bucket, endpoint)
        } else {
            format!("S3 ({}) @ {}", self.bucket, self.region)
        }
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