use std::path::PathBuf;
use crate::core::config::ConnectionManager;

pub fn test_ftp_persistence() {
    println!("Testing FTP connection persistence...");
    
    let config_path = dirs::config_dir()
        .unwrap()
        .join("mpfm")
        .join("connections.json");
    
    println!("Config path: {:?}", config_path);
    
    match ConnectionManager::new(config_path.clone()) {
        Ok(manager) => {
            let connections = manager.get_connections();
            println!("Loaded {} connections:", connections.len());
            
            for conn in connections {
                println!("  - {} ({}): {} config keys", 
                    conn.name, 
                    conn.protocol_type, 
                    conn.config.len()
                );
                
                if conn.protocol_type == "ftp" {
                    println!("    FTP Config: {:?}", conn.config);
                }
            }
        }
        Err(e) => {
            println!("Error loading connections: {}", e);
        }
    }
}