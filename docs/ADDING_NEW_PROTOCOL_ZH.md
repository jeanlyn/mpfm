# 添加新协议支持 - 通用指南

## 概述
添加新协议需要在后端（Rust）和前端（React）同时实现：

## 后端实现（30分钟）

### 1. 创建协议文件
`src/protocols/your_protocol.rs`

### 2. 注册协议
更新 `src/protocols/mod.rs`

### 3. 后端核心代码
```rust
impl Protocol for YourProtocol {
    fn create_operator(&self) -> Result<Operator> {
        // 使用opendal创建连接
    }
    
    fn get_id(&self) -> String {
        format\!("yourprotocol://{}", self.config_field)
    }
}
```

## 前端实现（30分钟）

### 1. 协议字段组件
`ui/src/components/ConnectionManager/components/ProtocolFields.tsx`

### 2. 配置映射
`ui/src/components/ConnectionManager/utils.tsx`

### 3. 表单回填
`ui/src/components/ConnectionManager/hooks/useConnectionModal.ts`

## 快速实现步骤
1. **复制FTP实现**：参考现有FTP代码
2. **修改字段**：替换为协议特定字段
3. **添加图标**：设置协议图标
4. **更新翻译**：添加多语言支持


## 参考文件
- `src/protocols/ftp.rs` - 后端实现模板
- `ui/src/components/ConnectionManager/` - 前端实现目录
