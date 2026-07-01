use std::fmt;

/// 错误种类，用于区分取消、IO、协议等不同来源
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ErrorKind {
    Io,
    Config,
    Protocol,
    NotFound,
    NotSupported,
    Cancelled,
    Other,
}

/// 错误结构体
#[derive(Debug)]
pub struct Error {
    message: String,
    kind: ErrorKind,
    source: Option<Box<dyn std::error::Error + Send + Sync>>,
}

impl Error {
    /// 错误种类
    pub fn kind(&self) -> ErrorKind {
        self.kind
    }

    /// 是否为取消错误
    pub fn is_cancelled(&self) -> bool {
        self.kind == ErrorKind::Cancelled
    }

    /// 创建新的 IO 错误
    pub fn new_io(message: &str) -> Self {
        Self {
            message: message.to_string(),
            kind: ErrorKind::Io,
            source: None,
        }
    }

    /// 创建新的配置错误
    pub fn new_config(message: &str) -> Self {
        Self {
            message: message.to_string(),
            kind: ErrorKind::Config,
            source: None,
        }
    }

    /// 创建新的协议错误
    pub fn new_protocol(message: &str) -> Self {
        Self {
            message: message.to_string(),
            kind: ErrorKind::Protocol,
            source: None,
        }
    }

    /// 创建新的未找到错误
    pub fn new_not_found(message: &str) -> Self {
        Self {
            message: message.to_string(),
            kind: ErrorKind::NotFound,
            source: None,
        }
    }

    /// 创建新的不支持错误
    pub fn new_not_supported(message: &str) -> Self {
        Self {
            message: message.to_string(),
            kind: ErrorKind::NotSupported,
            source: None,
        }
    }

    /// 创建新的取消错误（用户主动取消上传/下载等操作）
    pub fn new_cancelled(message: &str) -> Self {
        Self {
            message: message.to_string(),
            kind: ErrorKind::Cancelled,
            source: None,
        }
    }

    /// 创建新的其他错误
    pub fn new_other(message: &str) -> Self {
        Self {
            message: message.to_string(),
            kind: ErrorKind::Other,
            source: None,
        }
    }

    /// 添加源错误
    pub fn with_source<E>(mut self, source: E) -> Self
    where
        E: Into<Box<dyn std::error::Error + Send + Sync>>,
    {
        self.source = Some(source.into());
        self
    }
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.message)
    }
}

impl std::error::Error for Error {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        self.source.as_ref().map(|e| e.as_ref() as _)
    }
}

// 转换自常见错误类型
impl From<std::io::Error> for Error {
    fn from(err: std::io::Error) -> Self {
        Self::new_io(&err.to_string()).with_source(err)
    }
}

impl From<opendal::Error> for Error {
    fn from(err: opendal::Error) -> Self {
        let message = err.to_string();

        // OpenDAL 的 FTP backend 可能把 FTP 550 (Permission denied) 归类成 NotFound。
        // 这会误导用户去怀疑“路径不存在”。这里做一次兜底识别，给出更准确的提示。
        let lowered = message.to_lowercase();
        let is_ftp_permission_denied = (lowered.contains("ftp")
            || lowered.contains("service: ftp"))
            && lowered.contains("550")
            && (lowered.contains("permission denied") || lowered.contains("access denied"));

        if is_ftp_permission_denied {
            return Self::new_protocol("FTP 权限不足：服务器返回 550 Permission denied（常见原因：账号无读取权限，或 root_dir 配置与实际登录目录不匹配）")
                .with_source(err);
        }

        Self::new_protocol(&message).with_source(err)
    }
}

impl From<serde_json::Error> for Error {
    fn from(err: serde_json::Error) -> Self {
        Self::new_config(&err.to_string()).with_source(err)
    }
}

impl From<zip::result::ZipError> for Error {
    fn from(err: zip::result::ZipError) -> Self {
        Self::new_io(&err.to_string()).with_source(err)
    }
}

// 定义结果类型别名
pub type Result<T> = std::result::Result<T, Error>;
