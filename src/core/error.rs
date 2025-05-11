use std::fmt;

#[derive(Debug)]
pub enum ErrorKind {
    Io,
    Config,
    Protocol,
    NotFound,
    NotSupported,
    Authentication,
    Other,
}

#[derive(Debug)]
pub struct Error {
    kind: ErrorKind,
    message: String,
    source: Option<Box<dyn std::error::Error + Send + Sync>>,
}

impl Error {
    pub fn new_io(message: &str) -> Self {
        Self {
            kind: ErrorKind::Io,
            message: message.to_string(),
            source: None,
        }
    }
    
    pub fn new_config(message: &str) -> Self {
        Self {
            kind: ErrorKind::Config,
            message: message.to_string(),
            source: None,
        }
    }
    
    pub fn new_protocol(message: &str) -> Self {
        Self {
            kind: ErrorKind::Protocol,
            message: message.to_string(),
            source: None,
        }
    }
    
    pub fn new_not_found(message: &str) -> Self {
        Self {
            kind: ErrorKind::NotFound,
            message: message.to_string(),
            source: None,
        }
    }
    
    pub fn new_not_supported(message: &str) -> Self {
        Self {
            kind: ErrorKind::NotSupported,
            message: message.to_string(),
            source: None,
        }
    }
    
    pub fn new_authentication(message: &str) -> Self {
        Self {
            kind: ErrorKind::Authentication,
            message: message.to_string(),
            source: None,
        }
    }
    
    pub fn new_other(message: &str) -> Self {
        Self {
            kind: ErrorKind::Other,
            message: message.to_string(),
            source: None,
        }
    }
    
    pub fn with_source<E>(mut self, source: E) -> Self
    where
        E: Into<Box<dyn std::error::Error + Send + Sync>>,
    {
        self.source = Some(source.into());
        self
    }
    
    pub fn kind(&self) -> &ErrorKind {
        &self.kind
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

// Conversion from various error types
impl From<std::io::Error> for Error {
    fn from(err: std::io::Error) -> Self {
        Self::new_io(&err.to_string()).with_source(err)
    }
}

impl From<opendal::Error> for Error {
    fn from(err: opendal::Error) -> Self {
        Self::new_protocol(&err.to_string()).with_source(err)
    }
}

impl From<serde_json::Error> for Error {
    fn from(err: serde_json::Error) -> Self {
        Self::new_config(&err.to_string()).with_source(err)
    }
}

pub type Result<T> = std::result::Result<T, Error>;