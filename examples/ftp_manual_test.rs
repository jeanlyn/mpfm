use std::collections::HashMap;
use multi_protocol_file_manager::protocols::create_protocol;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("FTP协议手动测试");
    
    // 创建FTP配置
    let mut config = HashMap::new();
    config.insert("host".to_string(), "127.0.0.1".to_string());
    config.insert("port".to_string(), "2121".to_string());
    config.insert("username".to_string(), "testuser".to_string());
    config.insert("password".to_string(), "testpass".to_string());
    config.insert("root".to_string(), "/ftp".to_string());

    println!("配置: {:?}", config);
    
    // 通过工厂函数创建FTP协议
    let protocol = create_protocol("ftp", &config)?;
    println!("协议ID: {}", protocol.get_id());
    println!("协议名称: {}", protocol.get_name());
    
    // 创建操作符
    let operator = protocol.create_operator()?;
    println!("操作符创建成功");
    
    // 测试列出根目录
    println!("正在测试列出根目录...");
    match operator.list("/").await {
        Ok(entries) => {
            println!("根目录列出成功，包含 {} 个条目:", entries.len());
            for entry in entries {
                println!("  - {} ({})", entry.name(), 
                    if entry.metadata().is_dir() { "目录" } else { "文件" });
            }
        }
        Err(e) => {
            println!("列出根目录失败: {:?}", e);
        }
    }
    
    // 测试写入文件
    println!("正在测试写入文件...");
    let test_content = "Hello, FTP World from Rust!";
    let test_path = "rust_test.txt";
    
    match operator.write(test_path, test_content).await {
        Ok(_) => {
            println!("文件写入成功: {}", test_path);
            
            // 测试读取文件
            println!("正在测试读取文件...");
            match operator.read(test_path).await {
                Ok(content) => {
                    let content_vec = content.to_vec();
                    let content_str = String::from_utf8_lossy(&content_vec);
                    println!("文件读取成功: {}", content_str);
                    
                    if content_str == test_content {
                        println!("✅ 文件内容验证成功!");
                    } else {
                        println!("❌ 文件内容验证失败!");
                    }
                }
                Err(e) => {
                    println!("文件读取失败: {:?}", e);
                }
            }
            
            // 清理测试文件
            println!("正在清理测试文件...");
            match operator.delete(test_path).await {
                Ok(_) => println!("测试文件删除成功"),
                Err(e) => println!("测试文件删除失败: {:?}", e),
            }
        }
        Err(e) => {
            println!("文件写入失败: {:?}", e);
        }
    }
    
    println!("FTP协议测试完成");
    Ok(())
}
