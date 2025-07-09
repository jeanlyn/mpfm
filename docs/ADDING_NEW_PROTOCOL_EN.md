# Adding New Protocol Support

This guide explains how to add support for a new protocol to the Multi-Protocol File Manager using OpenDAL.

## Overview

The Multi-Protocol File Manager is built on top of OpenDAL, which provides a unified interface for accessing different storage services. Adding a new protocol involves:

1. Implementing the protocol-specific logic
2. Integrating with the protocol factory
3. Writing comprehensive tests
4. Updating documentation

## Step-by-Step Guide

### Step 1: Check OpenDAL Support

First, verify that OpenDAL supports your target protocol:
- Check the [OpenDAL documentation](https://opendal.apache.org/)
- Look for the service in the features list
- Ensure the service is stable and well-documented

### Step 2: Add Dependencies

Update `Cargo.toml` to include the new protocol service:

```toml
[dependencies]
opendal = { version = "0.53.1", features = ["services-s3", "services-fs", "services-ftp", "services-YOUR_PROTOCOL"] }
```

### Step 3: Implement the Protocol

Create a new file `src/protocols/your_protocol.rs`:

```rust
use std::collections::HashMap;
use log::debug;
use opendal::{services, Operator};
use super::traits::{Capabilities, Protocol};
use crate::core::error::{Error, Result};

#[derive(Debug)]
pub struct YourProtocol {
    // Protocol-specific fields
    host: String,
    port: u16,
    // Add other required fields
}

impl YourProtocol {
    pub fn new(/* parameters */) -> Self {
        Self {
            // Initialize fields
        }
    }

    pub fn from_config(config: &HashMap<String, String>) -> Result<Self> {
        // Parse configuration and validate required fields
        let host = config
            .get("host")
            .ok_or_else(|| Error::new_config("Missing 'host' parameter"))?
            .clone();
        
        // Add validation for other fields
        
        Ok(Self::new(/* parsed parameters */))
    }
}

impl Protocol for YourProtocol {
    fn create_operator(&self) -> Result<Operator> {
        debug!("Creating operator for {}", self.host);

        // Create service configuration
        let builder = services::YourService::default()
            .endpoint(&format!("protocol://{}:{}", self.host, self.port));
            // Add other configuration

        // Create and return Operator
        let op = match Operator::new(builder) {
            Ok(op_builder) => op_builder.finish(),
            Err(e) => return Err(Error::from(e)),
        };

        Ok(op)
    }

    fn get_id(&self) -> String {
        format!("protocol://{}:{}", self.host, self.port)
    }

    fn get_name(&self) -> String {
        format!("Your Protocol ({}:{})", self.host, self.port)
    }

    fn get_capabilities(&self) -> Capabilities {
        Capabilities::default()
            .with_list(true)
            .with_read(true)
            .with_write(true)
            .with_delete(true)
            .with_create_dir(true)
            // Set capabilities based on protocol support
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_protocol_from_config() {
        let mut config = HashMap::new();
        config.insert("host".to_string(), "example.com".to_string());
        // Add test configuration

        let protocol = YourProtocol::from_config(&config).unwrap();
        assert_eq!(protocol.host, "example.com");
    }

    #[test]
    fn test_protocol_capabilities() {
        let protocol = YourProtocol::new(/* test parameters */);
        let caps = protocol.get_capabilities();
        assert!(caps.can_read);
        assert!(caps.can_write);
    }
}
```

### Step 4: Update Module Declarations

Update `src/protocols/mod.rs`:

```rust
pub mod fs;
pub mod s3;
pub mod ftp;
pub mod your_protocol; // Add this line

pub use traits::Protocol;

pub fn create_protocol(
    protocol_type: &str,
    config: &std::collections::HashMap<String, String>,
) -> crate::core::error::Result<Box<dyn Protocol>> {
    match protocol_type {
        "s3" => {
            let protocol = s3::S3Protocol::from_config(config)?;
            Ok(Box::new(protocol))
        }
        "fs" => {
            let protocol = fs::FSProtocol::from_config(config)?;
            Ok(Box::new(protocol))
        }
        "ftp" => {
            let protocol = ftp::FtpProtocol::from_config(config)?;
            Ok(Box::new(protocol))
        }
        "your_protocol" => { // Add this case
            let protocol = your_protocol::YourProtocol::from_config(config)?;
            Ok(Box::new(protocol))
        }
        _ => Err(crate::core::error::Error::new_not_supported(&format!(
            "Unsupported protocol type: {}",
            protocol_type
        ))),
    }
}
```

### Step 5: Create Integration Tests

Create `tests/your_protocol_integration_tests.rs`:

```rust
use std::collections::HashMap;
use multi_protocol_file_manager::protocols::{create_protocol, your_protocol::YourProtocol, Protocol};

#[cfg(test)]
mod unit_tests {
    use super::*;

    #[test]
    fn test_create_protocol_via_factory() {
        let mut config = HashMap::new();
        config.insert("host".to_string(), "test.example.com".to_string());
        // Add required configuration

        let protocol = create_protocol("your_protocol", &config).unwrap();
        assert!(protocol.get_name().contains("Your Protocol"));
    }
}

#[cfg(test)]
mod integration_tests {
    use super::*;

    fn create_test_config() -> HashMap<String, String> {
        let mut config = HashMap::new();
        config.insert("host".to_string(), "127.0.0.1".to_string());
        // Add test server configuration
        config
    }

    #[tokio::test]
    async fn test_basic_operations() {
        // Skip if no test server available
        let config = create_test_config();
        let protocol = YourProtocol::from_config(&config).unwrap();
        let operator = protocol.create_operator().unwrap();

        // Test basic operations
        let test_content = "Hello, World!";
        let test_path = "test_file.txt";
        
        // Write test
        let write_result = operator.write(test_path, test_content).await;
        assert!(write_result.is_ok());

        // Read test
        let read_result = operator.read(test_path).await;
        assert!(read_result.is_ok());
        
        let content = read_result.unwrap();
        assert_eq!(content.to_vec(), test_content.as_bytes());

        // Cleanup
        let _ = operator.delete(test_path).await;
    }
}
```

### Step 6: Create Test Environment Setup

Create test setup scripts if needed:

```bash
#!/bin/bash
# scripts/setup_your_protocol_test.sh

echo "Setting up test environment for Your Protocol..."

# Add setup logic for test server/service
# Example: Docker container, local service, etc.

echo "Test environment ready!"
```

### Step 7: Update Documentation

1. Create protocol-specific documentation
2. Update main README with new protocol support
3. Add configuration examples
4. Document any limitations or special requirements

### Step 8: Testing

Run comprehensive tests:

```bash
# Unit tests
cargo test protocols::your_protocol

# Integration tests (if test server available)
cargo test --test your_protocol_integration_tests

# All tests
cargo test
```

## Configuration Examples

### Basic Configuration

```rust
let mut config = HashMap::new();
config.insert("host".to_string(), "your-server.com".to_string());
config.insert("port".to_string(), "12345".to_string());
config.insert("username".to_string(), "user".to_string());
config.insert("password".to_string(), "password".to_string());

let protocol = create_protocol("your_protocol", &config)?;
```

### Advanced Configuration

```rust
let mut config = HashMap::new();
config.insert("host".to_string(), "your-server.com".to_string());
config.insert("port".to_string(), "12345".to_string());
config.insert("username".to_string(), "user".to_string());
config.insert("password".to_string(), "password".to_string());
config.insert("ssl".to_string(), "true".to_string());
config.insert("timeout".to_string(), "30".to_string());
config.insert("root".to_string(), "/data".to_string());

let protocol = create_protocol("your_protocol", &config)?;
```

## Best Practices

1. **Error Handling**: Use proper error types and provide meaningful error messages
2. **Configuration Validation**: Validate all required parameters in `from_config()`
3. **Testing**: Write both unit tests and integration tests
4. **Documentation**: Document all configuration parameters and their defaults
5. **Capabilities**: Accurately report what operations the protocol supports
6. **Logging**: Use appropriate log levels for debugging and monitoring

## Common Issues

### Compilation Errors
- Ensure OpenDAL features are correctly specified
- Check that all imports are available
- Verify trait implementations are complete

### Runtime Errors
- Validate configuration parameters
- Check network connectivity and credentials
- Ensure the target service is accessible

### Test Failures
- Verify test environment setup
- Check service availability
- Review configuration parameters

## Example: FTP Protocol Implementation

For a complete example, see the FTP protocol implementation:
- `src/protocols/ftp.rs` - Protocol implementation
- `tests/ftp_integration_tests.rs` - Integration tests
- `scripts/setup_ftp_test.sh` - Test environment setup
- `tests/FTP_TEST_README.md` - Detailed testing guide

This example demonstrates all the concepts covered in this guide.
