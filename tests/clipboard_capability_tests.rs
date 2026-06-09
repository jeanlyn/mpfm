use std::fs;

use serde_json::Value;

#[test]
fn default_capability_allows_clipboard_write_text() {
    let contents = fs::read_to_string("capabilities/default.json")
        .expect("should read default capability file");
    let capability: Value =
        serde_json::from_str(&contents).expect("default capability should be valid json");

    let permissions = capability["permissions"]
        .as_array()
        .expect("permissions should be an array");

    assert!(
        permissions.iter().any(|permission| {
            permission.as_str() == Some("clipboard-manager:allow-write-text")
        }),
        "default capability should allow clipboard text writes"
    );
}
