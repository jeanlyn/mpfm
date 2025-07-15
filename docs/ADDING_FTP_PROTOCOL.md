# 新增FTP协议支持 - 前端调整指南

## 快速实现步骤

### 1. 协议字段组件 (ProtocolFields.tsx)
```tsx
// 在 ProtocolFields 组件中添加 FTP 分支
if (protocolType === 'ftp') {
  return (
    <>
      <Form.Item name="host" label="主机" rules={[{ required: true }]}>
        <Input addonBefore="ftp://" />
      </Form.Item>
      <Form.Item name="port" label="端口" rules={[{ required: true }]}>
        <Input type="number" />
      </Form.Item>
      <Form.Item name="username" label="用户名" rules={[{ required: true }]}>
        <Input />
      </Form.Item>
      <Form.Item name="password" label="密码" rules={[{ required: true }]}>
        <Input.Password />
      </Form.Item>
      <Form.Item name="root_dir" label="根目录">
        <Input addonBefore="/" />
      </Form.Item>
      <Form.Item name="secure" valuePropName="checked">
        <Checkbox>安全连接</Checkbox>
      </Form.Item>
    </>
  );
}
```

### 2. 配置映射 (utils.tsx)
```tsx
export const buildConfig = (values: any): Record<string, string> => {
  const config: Record<string, string> = {};
  
  if (values.protocolType === 'ftp') {
    config.host = values.host;
    config.port = values.port?.toString() || '21';
    config.username = values.username;
    config.password = values.password;
    config.root_dir = values.root_dir || '/';
    config.secure = values.secure ? 'true' : 'false';
  }
  
  return config;
};
```

### 3. 表单回填 (useConnectionModal.ts)
```tsx
// 在 COPY 和 EDIT 模式下添加
else if (connection.protocol_type === 'ftp') {
  initialValues = {
    ...initialValues,
    host: connection.config.host,
    port: connection.config.port,
    username: connection.config.username,
    password: connection.config.password,
    root_dir: connection.config.root_dir,
    secure: connection.config.secure === 'true',
  };
}
```

### 4. 国际化 (翻译文件)
```json
{
  "host": "主机",
  "port": "端口",
  "username": "用户名",
  "password": "密码",
  "rootDirectory": "根目录",
  "secureConnection": "安全连接"
}
```

### 5. 图标配置 (utils.tsx)
```tsx
case 'ftp':
  return <DatabaseOutlined style={{ color: '#1890ff' }} />;
```

完成以上5步即可支持FTP协议。