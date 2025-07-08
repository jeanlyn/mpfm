use std::collections::HashMap;
use multi_protocol_file_manager::protocols::{create_protocol, ftp::FtpProtocol, Protocol};
use tokio;

/// 基础单元测试，不需要真实的FTP服务器
#[cfg(test)]
mod unit_tests {
    use super::*;

    #[test]
    fn test_create_ftp_protocol_via_factory() {
        let mut config = HashMap::new();
        config.insert("host".to_string(), "127.0.0.1".to_string());
        config.insert("port".to_string(), "2121".to_string());
        config.insert("username".to_string(), "testuser".to_string());
        config.insert("password".to_string(), "testpass".to_string());

        let protocol = create_protocol("ftp", &config).unwrap();
        assert_eq!(protocol.get_id(), "ftp://testuser@127.0.0.1:2121");
        assert!(protocol.get_name().contains("FTP"));
        
        let caps = protocol.get_capabilities();
        assert!(caps.can_list);
        assert!(caps.can_read);
        assert!(caps.can_write);
    }

    #[test]
    fn test_ftp_protocol_config_validation() {
        // 测试缺少必要配置项的情况
        let mut config = HashMap::new();
        config.insert("host".to_string(), "127.0.0.1".to_string());
        // 缺少username和password

        let result = create_protocol("ftp", &config);
        assert!(result.is_err());
    }

    #[test]
    fn test_ftp_protocol_invalid_port() {
        let mut config = HashMap::new();
        config.insert("host".to_string(), "127.0.0.1".to_string());
        config.insert("port".to_string(), "invalid_port".to_string());
        config.insert("username".to_string(), "testuser".to_string());
        config.insert("password".to_string(), "testpass".to_string());

        let result = create_protocol("ftp", &config);
        assert!(result.is_err());
    }

    #[test]
    fn test_ftp_protocol_capabilities() {
        let mut config = HashMap::new();
        config.insert("host".to_string(), "ftp.example.com".to_string());
        config.insert("username".to_string(), "user".to_string());
        config.insert("password".to_string(), "pass".to_string());

        let protocol = create_protocol("ftp", &config).unwrap();
        let caps = protocol.get_capabilities();
        
        // 根据README中的功能特性验证
        assert!(caps.can_list, "应该支持列出目录内容");
        assert!(caps.can_read, "应该支持读取文件");
        assert!(caps.can_write, "应该支持写入文件");
        assert!(caps.can_delete, "应该支持删除文件");
        assert!(caps.can_create_dir, "应该支持创建目录");
        assert!(caps.can_rename, "应该支持重命名文件");
        assert!(!caps.can_copy, "FTP协议不支持服务器端复制");
        assert!(!caps.can_batch_delete, "FTP协议不支持批量删除");
    }
}

/// 集成测试，需要一个可用的FTP服务器
/// 使用 ./scripts/setup_ftp_test.sh 启动测试服务器
#[cfg(test)]
mod integration_tests {
    use super::*;
    use opendal::EntryMode;

    // 辅助函数：创建测试用的FTP配置
    pub fn create_test_ftp_config() -> HashMap<String, String> {
        let mut config = HashMap::new();
        config.insert("host".to_string(), "127.0.0.1".to_string());
        config.insert("port".to_string(), "2121".to_string());
        config.insert("username".to_string(), "testuser".to_string());
        config.insert("password".to_string(), "testpass".to_string());
        config.insert("root".to_string(), "/ftp".to_string());
        config
    }

    // 检查是否有可用的FTP服务器
    async fn check_ftp_server_available() -> bool {
        let config = create_test_ftp_config();
        let protocol = match FtpProtocol::from_config(&config) {
            Ok(p) => p,
            Err(_) => return false,
        };

        let operator = match protocol.create_operator() {
            Ok(op) => op,
            Err(_) => return false,
        };

        // 尝试列出根目录来测试连接
        operator.list("/").await.is_ok()
    }

    #[tokio::test]
    async fn test_ftp_operator_creation() {
        let config = create_test_ftp_config();
        let protocol = FtpProtocol::from_config(&config).unwrap();
        
        // 创建操作符应该成功，即使没有连接到服务器
        let result = protocol.create_operator();
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_ftp_basic_operations() {
        // 只有在有可用的FTP服务器时才运行此测试
        if !check_ftp_server_available().await {
            println!("跳过FTP集成测试：没有可用的FTP服务器");
            println!("请运行 ./scripts/setup_ftp_test.sh 启动测试服务器");
            return;
        }

        let config = create_test_ftp_config();
        let protocol = FtpProtocol::from_config(&config).unwrap();
        let operator = protocol.create_operator().unwrap();

        // 测试写入文件
        let test_content = "Hello, FTP World!";
        let test_path = "test_file.txt";
        
        let write_result = operator.write(test_path, test_content).await;
        assert!(write_result.is_ok(), "写入文件失败: {:?}", write_result.err());

        // 测试读取文件
        let read_result = operator.read(test_path).await;
        assert!(read_result.is_ok(), "读取文件失败: {:?}", read_result.err());
        
        let content = read_result.unwrap();
        assert_eq!(content.to_vec(), test_content.as_bytes());

        // 测试列出目录
        let list_result = operator.list("/").await;
        assert!(list_result.is_ok(), "列出目录失败: {:?}", list_result.err());

        let entries = list_result.unwrap();
        let found_test_file = entries.iter().any(|entry| {
            entry.name() == test_path && entry.metadata().mode() == EntryMode::FILE
        });
        assert!(found_test_file, "未找到测试文件");

        // 测试删除文件
        let delete_result = operator.delete(test_path).await;
        assert!(delete_result.is_ok(), "删除文件失败: {:?}", delete_result.err());

        // 验证文件已被删除
        let read_after_delete = operator.read(test_path).await;
        assert!(read_after_delete.is_err(), "文件删除后仍然可以读取");
    }

    #[tokio::test]
    async fn test_ftp_directory_operations() {
        if !check_ftp_server_available().await {
            println!("跳过FTP目录操作测试：没有可用的FTP服务器");
            println!("请运行 ./scripts/setup_ftp_test.sh 启动测试服务器");
            return;
        }

        let config = create_test_ftp_config();
        let protocol = FtpProtocol::from_config(&config).unwrap();
        let operator = protocol.create_operator().unwrap();

        let test_dir = "test_directory/";
        
        // 测试创建目录
        let create_dir_result = operator.create_dir(test_dir).await;
        assert!(create_dir_result.is_ok(), "创建目录失败: {:?}", create_dir_result.err());

        // 测试列出根目录，应该包含新创建的目录
        let list_result = operator.list("/").await;
        assert!(list_result.is_ok());
        
        let entries = list_result.unwrap();
        let found_test_dir = entries.iter().any(|entry| {
            entry.name() == "test_directory/" && entry.metadata().mode() == EntryMode::DIR
        });
        assert!(found_test_dir, "未找到测试目录");

        // 在目录中创建文件
        let file_in_dir = "test_directory/file_in_dir.txt";
        let file_content = "File in directory";
        
        let write_result = operator.write(file_in_dir, file_content).await;
        assert!(write_result.is_ok(), "在目录中写入文件失败: {:?}", write_result.err());

        // 读取目录中的文件
        let read_result = operator.read(file_in_dir).await;
        assert!(read_result.is_ok());
        assert_eq!(read_result.unwrap().to_vec(), file_content.as_bytes());

        // 清理：删除文件和目录
        let _ = operator.delete(file_in_dir).await;
        let delete_dir_result = operator.delete(test_dir).await;
        assert!(delete_dir_result.is_ok(), "删除目录失败: {:?}", delete_dir_result.err());
    }

    #[tokio::test] 
    async fn test_ftp_large_file_operations() {
        if !check_ftp_server_available().await {
            println!("跳过FTP大文件测试：没有可用的FTP服务器");
            println!("请运行 ./scripts/setup_ftp_test.sh 启动测试服务器");
            return;
        }

        let config = create_test_ftp_config();
        let protocol = FtpProtocol::from_config(&config).unwrap();
        let operator = protocol.create_operator().unwrap();

        // 创建一个较大的测试内容（约10KB）
        let large_content = "A".repeat(10 * 1024);
        let test_path = "large_test_file.txt";

        // 写入大文件
        let write_result = operator.write(test_path, large_content.clone()).await;
        assert!(write_result.is_ok(), "写入大文件失败: {:?}", write_result.err());

        // 读取大文件
        let read_result = operator.read(test_path).await;
        assert!(read_result.is_ok(), "读取大文件失败: {:?}", read_result.err());

        let content = read_result.unwrap();
        assert_eq!(content.len(), large_content.len());
        assert_eq!(content.to_vec(), large_content.as_bytes());

        // 清理
        let _ = operator.delete(test_path).await;
    }

    #[tokio::test]
    async fn test_ftp_file_rename() {
        if !check_ftp_server_available().await {
            println!("跳过FTP文件重命名测试：没有可用的FTP服务器");
            println!("请运行 ./scripts/setup_ftp_test.sh 启动测试服务器");
            return;
        }

        let config = create_test_ftp_config();
        let protocol = FtpProtocol::from_config(&config).unwrap();
        let operator = protocol.create_operator().unwrap();

        // 创建测试文件
        let original_content = "File to be renamed";
        let original_path = "original_file.txt";
        let new_path = "renamed_file.txt";

        // 写入原文件
        let write_result = operator.write(original_path, original_content).await;
        assert!(write_result.is_ok(), "写入原文件失败: {:?}", write_result.err());

        // 重命名文件（复制 + 删除）
        let read_result = operator.read(original_path).await;
        assert!(read_result.is_ok(), "读取原文件失败");
        
        let content = read_result.unwrap();
        let write_new_result = operator.write(new_path, content).await;
        assert!(write_new_result.is_ok(), "写入新文件失败");
        
        let delete_old_result = operator.delete(original_path).await;
        assert!(delete_old_result.is_ok(), "删除原文件失败");

        // 验证新文件存在且内容正确
        let read_new_result = operator.read(new_path).await;
        assert!(read_new_result.is_ok(), "读取新文件失败");
        assert_eq!(read_new_result.unwrap().to_vec(), original_content.as_bytes());

        // 验证原文件不存在
        let read_old_result = operator.read(original_path).await;
        assert!(read_old_result.is_err(), "原文件应该已被删除");

        // 清理
        let _ = operator.delete(new_path).await;
    }

    #[tokio::test]
    async fn test_ftp_error_handling() {
        if !check_ftp_server_available().await {
            println!("跳过FTP错误处理测试：没有可用的FTP服务器");
            println!("请运行 ./scripts/setup_ftp_test.sh 启动测试服务器");
            return;
        }

        let config = create_test_ftp_config();
        let protocol = FtpProtocol::from_config(&config).unwrap();
        let operator = protocol.create_operator().unwrap();

        // 测试读取不存在的文件
        let read_result = operator.read("nonexistent_file.txt").await;
        assert!(read_result.is_err(), "读取不存在的文件应该失败");

        // 测试删除不存在的文件
        let delete_result = operator.delete("nonexistent_file.txt").await;
        assert!(delete_result.is_err(), "删除不存在的文件应该失败");

        // 测试创建已存在的目录
        let test_dir = "existing_test_dir/";
        let _ = operator.create_dir(test_dir).await;
        
        // 再次创建同一目录应该成功或失败（取决于FTP服务器实现）
        let _create_again_result = operator.create_dir(test_dir).await;
        // 无论成功还是失败都是可接受的行为
        
        // 清理
        let _ = operator.delete(test_dir).await;
    }
}

/// 性能测试
#[cfg(test)]
mod performance_tests {
    use super::*;
    use std::time::Instant;

    #[tokio::test]
    async fn test_ftp_connection_time() {
        let config = integration_tests::create_test_ftp_config();
        let protocol = FtpProtocol::from_config(&config).unwrap();
        
        let start = Instant::now();
        let result = protocol.create_operator();
        let duration = start.elapsed();
        
        assert!(result.is_ok());
        println!("FTP操作符创建时间: {:?}", duration);
        // 正常情况下应该在1秒内完成
        assert!(duration.as_millis() < 1000, "操作符创建时间过长: {:?}", duration);
    }

    #[tokio::test]
    async fn test_ftp_throughput() {
        // 只有在有可用的FTP服务器时才运行此测试
        let config = integration_tests::create_test_ftp_config();
        let protocol = match FtpProtocol::from_config(&config) {
            Ok(p) => p,
            Err(_) => {
                println!("跳过FTP吞吐量测试：配置无效");
                return;
            }
        };

        let operator = match protocol.create_operator() {
            Ok(op) => op,
            Err(_) => {
                println!("跳过FTP吞吐量测试：无法创建操作符");
                return;
            }
        };

        // 检查连接是否可用
        if operator.list("/").await.is_err() {
            println!("跳过FTP吞吐量测试：没有可用的FTP服务器");
            println!("请运行 ./scripts/setup_ftp_test.sh 启动测试服务器");
            return;
        }

        // 测试多个小文件的写入性能
        let file_count = 10;
        let file_size = 1024; // 1KB per file
        let content = "X".repeat(file_size);

        let start = Instant::now();
        
        for i in 0..file_count {
            let file_path = format!("perf_test_{}.txt", i);
            let write_result = operator.write(&file_path, content.clone()).await;
            assert!(write_result.is_ok(), "写入文件 {} 失败", file_path);
        }
        
        let write_duration = start.elapsed();
        println!("写入 {} 个文件（每个{}字节）耗时: {:?}", file_count, file_size, write_duration);

        // 测试读取性能
        let start = Instant::now();
        
        for i in 0..file_count {
            let file_path = format!("perf_test_{}.txt", i);
            let read_result = operator.read(&file_path).await;
            assert!(read_result.is_ok(), "读取文件 {} 失败", file_path);
            assert_eq!(read_result.unwrap().len(), file_size);
        }
        
        let read_duration = start.elapsed();
        println!("读取 {} 个文件耗时: {:?}", file_count, read_duration);

        // 清理测试文件
        for i in 0..file_count {
            let file_path = format!("perf_test_{}.txt", i);
            let _ = operator.delete(&file_path).await;
        }

        // 性能断言（宽松的限制，主要是确保没有严重性能问题）
        assert!(write_duration.as_secs() < 30, "写入性能过慢: {:?}", write_duration);
        assert!(read_duration.as_secs() < 30, "读取性能过慢: {:?}", read_duration);
    }
}
