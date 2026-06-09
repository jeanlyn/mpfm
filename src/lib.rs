//! Multi-Protocol File Manager Library
//!
//! This library provides functionality for managing files across different protocols
//! including local filesystem and S3-compatible storage.

#[cfg(feature = "cli")]
pub mod cli;
#[cfg(feature = "desktop")]
pub mod commands;
pub mod core;
pub mod protocols;
pub mod utils;

/// Library version
pub const VERSION: &str = env!("CARGO_PKG_VERSION");
