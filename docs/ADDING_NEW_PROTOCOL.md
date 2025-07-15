# Adding New Protocol Support - Generic Guide

This guide provides step-by-step instructions for adding a new protocol to the Multi-Protocol File Manager.

## Overview

Adding a new protocol requires changes in both backend (Rust) and frontend (React/TypeScript):

1. **Backend**: Protocol implementation
2. **Frontend**: UI components and form handling
3. **Integration**: Connecting both parts

## Backend Implementation

### 1. Create Protocol File

```bash
# Create new protocol file
src/protocols/your_protocol.rs
```

```rust
use std::collections::HashMap;
use opendal::{services, Operator};
use super::traits::{Capabilities, Protocol};
use crate::core::error::{Error, Result};

#[derive(Debug)]
pub struct YourProtocol {
    // Add your protocol fields
    field1: String,
    field2: String,
    // ...
}

impl YourProtocol {
    pub fn new(field1: String, field2: String) -> Self {
        Self { field1, field2 }
    }

    pub fn from_config(config: &HashMap<String, String>) -> Result<Self> {
        let field1 = config.get("field1")
            .ok_or_else(|| Error::new_config("Missing 'field1'"))?.clone();
        let field2 = config.get("field2")
            .ok_or_else(|| Error::new_config("Missing 'field2'"))?.clone();
        
        Ok(Self::new(field1, field2))
    }
}

impl Protocol for YourProtocol {
    fn create_operator(&self) -> Result<Operator> {
        let mut builder = services::YourService::default()
            .field1(&self.field1)
            .field2(&self.field2);
        
        let op = Operator::new(builder)?.finish();
        Ok(op)
    }

    fn get_id(&self) -> String {
        format!("yourprotocol://{}", self.field1)
    }

    fn get_name(&self) -> String {
        format!("Your Protocol ({}/{}", self.field1, self.field2)
    }

    fn get_capabilities(&self) -> Capabilities {
        Capabilities::default()
            .with_list(true)
            .with_read(true)
            .with_write(true)
            // Add other capabilities
    }
}
```

### 2. Register Protocol

Update `src/protocols/mod.rs`:

```rust
pub mod your_protocol;
use your_protocol::YourProtocol;

pub fn create_protocol(protocol_type: &str, config: &HashMap<String, String>) -> Result<Box<dyn Protocol>> {
    match protocol_type {
        "yourprotocol" => Ok(Box::new(YourProtocol::from_config(config)?)),
        // ... existing protocols
    }
}
```

### 3. Add Command (if needed)

Add new command in `src/commands/connection.rs`:

```rust
#[command]
pub async fn test_your_protocol(
    field1: String,
    field2: String,
) -> ApiResponse<bool> {
    let mut config = HashMap::new();
    config.insert("field1".to_string(), field1);
    config.insert("field2".to_string(), field2);
    
    // Test connection logic
}
```

### 4. Register Command

Update `src/main.rs`:

```rust
.invoke_handler(tauri::generate_handler![
    // ... existing commands
    connection::test_your_protocol,
])
```

## Frontend Implementation

### 1. Protocol Fields Component

Update `ui/src/components/ConnectionManager/components/ProtocolFields.tsx`:

```tsx
if (protocolType === 'yourprotocol') {
  return (
    <>
      <Form.Item name="field1" label="Field 1" rules={[{ required: true }]}>
        <Input placeholder="Enter field1" />
      </Form.Item>
      <Form.Item name="field2" label="Field 2" rules={[{ required: true }]}>
        <Input placeholder="Enter field2" />
      </Form.Item>
      {/* Add more fields as needed */}
    </>
  );
}
```

### 2. Configuration Mapping

Update `ui/src/components/ConnectionManager/utils.tsx`:

```tsx
export const buildConfig = (values: any): Record<string, string> => {
  const config: Record<string, string> = {};
  
  if (values.protocolType === 'yourprotocol') {
    config.field1 = values.field1;
    config.field2 = values.field2;
    // Map additional fields
  }
  
  return config;
};
```

### 3. Form Population

Update `ui/src/components/ConnectionManager/hooks/useConnectionModal.ts`:

```tsx
else if (connection.protocol_type === 'yourprotocol') {
  initialValues = {
    ...initialValues,
    field1: connection.config.field1,
    field2: connection.config.field2,
    // Map additional fields
  };
}
```

### 4. Add Protocol Icon

Update `ui/src/components/ConnectionManager/utils.tsx`:

```tsx
case 'yourprotocol':
  return <YourIcon style={{ color: '#your-color' }} />;
```

### 5. Update Translations

Add to translation files:

```json
// ui/src/i18n/locales/en/translation.json
{
  "yourprotocol": {
    "field1": "Field 1",
    "field2": "Field 2",
    // Add more translations
  }
}
```

```json
// ui/src/i18n/locales/zh/translation.json
{
  "yourprotocol": {
    "field1": "字段1",
    "field2": "字段2",
    // Add more translations
  }
}
```

## Testing

1. **Backend Tests**: Add protocol-specific tests
2. **Frontend Tests**: Test form rendering and submission
3. **Integration Tests**: Test end-to-end functionality

## Example Protocols

- **FTP**: File Transfer Protocol
- **SFTP**: SSH File Transfer Protocol
- **WebDAV**: Web-based Distributed Authoring and Versioning
- **Azure Blob**: Microsoft Azure Blob Storage
- **Google Cloud Storage**: Google Cloud Storage

## Best Practices

1. **Error Handling**: Provide clear error messages
2. **Validation**: Validate all required fields
3. **Security**: Never log sensitive information
4. **Consistency**: Follow existing code patterns
5. **Documentation**: Add protocol-specific documentation

## Quick Checklist

- [ ] Backend protocol implementation
- [ ] Frontend form fields
- [ ] Configuration mapping
- [ ] Form population
- [ ] Icon and styling
- [ ] Translations
- [ ] Testing