import React, { useState, useEffect } from 'react';
import { Layout, Typography, message, Alert } from 'antd';
import ConnectionManager from './components/ConnectionManager';
import FileManager from './components/FileManager';
import { Connection } from './types';
import { ApiService } from './services/api';
import FileManagerWrapper from './components/FileManagerWrapper';

const { Header } = Layout;
const { Title } = Typography;

// 检测是否在 Tauri 环境中
const isTauriEnvironment = (): boolean => {
  return typeof window !== 'undefined' && window.__TAURI_IPC__ !== undefined;
};

const App: React.FC = () => {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [currentConnection, setCurrentConnection] = useState<Connection | null>(null);
  const [loading, setLoading] = useState(true);

  const loadConnections = async () => {
    try {
      const connectionList = await ApiService.getConnections();
      setConnections(connectionList);
    } catch (error) {
      message.error(`加载连接失败: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConnections();
  }, []);

  const handleConnectionSelect = (connection: Connection) => {
    setCurrentConnection(connection);
  };

  const handleConnectionsChange = () => {
    loadConnections();
    // 如果当前选中的连接被删除了，清空选择
    if (currentConnection) {
      const exists = connections.some(conn => conn.id === currentConnection.id);
      if (!exists) {
        setCurrentConnection(null);
      }
    }
  };

  return (
    <div className="app">
      <Header style={{ 
        background: '#fff', 
        borderBottom: '1px solid #f0f0f0',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center'
      }}>
        <Title level={3} style={{ margin: 0, color: '#1890ff' }}>
          多协议文件管理器
        </Title>
        {currentConnection && (
          <div style={{ marginLeft: 'auto', color: '#666' }}>
            当前连接: {currentConnection.name} ({currentConnection.protocol_type.toUpperCase()})
          </div>
        )}
      </Header>
      
      {!isTauriEnvironment() && (
        <Alert
          message="演示模式"
          description="您正在浏览器中查看界面演示。要使用完整功能，请运行 'npm run tauri:dev' 启动 Tauri 应用。"
          type="info"
          showIcon
          style={{ margin: '16px' }}
        />
      )}
      
      <Layout style={{ height: 'calc(100vh - 64px)' }}>
        <ConnectionManager
          connections={connections}
          currentConnection={currentConnection}
          onConnectionSelect={handleConnectionSelect}
          onConnectionsChange={handleConnectionsChange}
        />
        <FileManager connection={currentConnection} />
      </Layout>
    </div>
  );
};

export default App;
