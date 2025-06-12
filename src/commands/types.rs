use crate::core::config::ConnectionConfig;
use opendal::Entry;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize)]
pub struct ConnectionInfo {
    pub id: String,
    pub name: String,
    pub protocol_type: String,
    pub config: HashMap<String, String>,
}

impl From<ConnectionConfig> for ConnectionInfo {
    fn from(config: ConnectionConfig) -> Self {
        Self {
            id: config.id,
            name: config.name,
            protocol_type: config.protocol_type,
            config: config.config,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileInfo {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: Option<u64>,
    pub modified: Option<String>,
}

impl From<Entry> for FileInfo {
    fn from(entry: Entry) -> Self {
        let metadata = entry.metadata();
        Self {
            name: entry.name().to_string(),
            path: entry.path().to_string(),
            is_dir: metadata.is_dir(),
            size: if metadata.is_file() {
                Some(metadata.content_length())
            } else {
                None
            },
            modified: metadata.last_modified().map(|dt| dt.to_rfc3339()),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

impl<T> ApiResponse<T> {
    pub fn success(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
        }
    }

    pub fn error(error: String) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(error),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PaginatedFileList {
    pub files: Vec<FileInfo>,
    pub total: usize,
    pub page: usize,
    pub page_size: usize,
    pub has_more: bool,
}
