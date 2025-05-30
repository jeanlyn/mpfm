import React, { useState, useEffect } from 'react';
import { Layout, Typography, message } from 'antd';
import ConnectionManager from './components/ConnectionManager';
import FileManager from './components/FileManager';
import { Connection } from './types';
import { ApiService } from './services/api';

const { Header } = Layout;
const { Title } = Typography;

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
          OpenDAL 多协议文件管理器
        </Title>
        {currentConnection && (
          <div style={{ marginLeft: 'auto', color: '#666' }}>
            当前连接: {currentConnection.name} ({currentConnection.protocol_type.toUpperCase()})
          </div>
        )}
      </Header>
      
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
