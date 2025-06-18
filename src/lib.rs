//! Multi-Protocol File Manager Library
//!
//! This library provides functionality for managing files across different protocols
//! including local filesystem and S3-compatible storage.

pub mod cli;
pub mod commands;
pub mod core;
pub mod protocols;
pub mod utils;

/// Library version
pub const VERSION: &str = env!("CARGO_PKG_VERSION");
