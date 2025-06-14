import React, { useState, useEffect } from 'react';
import { Layout, Typography, message, Alert, Space } from 'antd';
import ConnectionManager from './components/ConnectionManager';
import TabbedFileManager from './components/TabbedFileManager';
import LanguageSwitcher from './i18n/components/LanguageSwitcher';
import { Connection } from './types';
import { ApiService } from './services/api';
import { useAppI18n } from './i18n/hooks/useI18n';
import { I18nProvider } from './i18n/contexts/I18nContext';

const { Header } = Layout;
const { Title } = Typography;

// 检测是否在 Tauri 环境中
const isTauriEnvironment = (): boolean => {
  return true;
};
const App: React.FC = () => {
  return (
    <I18nProvider>
      <AppContent />
    </I18nProvider>
  );
};

const AppContent: React.FC = () => {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [currentConnection, setCurrentConnection] = useState<Connection | null>(null);
  const { app, connection } = useAppI18n();

  const loadConnections = async () => {
    try {
      const connectionList = await ApiService.getConnections();
      setConnections(connectionList);
    } catch (error) {
      message.error(`${connection.messages.loadFailed}: ${error}`);
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
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <Title level={3} style={{ margin: 0, color: '#1890ff' }}>
          {app.title}
        </Title>
        <Space>
          <LanguageSwitcher size="small" />
        </Space>
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
        <TabbedFileManager selectedConnection={currentConnection} />
      </Layout>
    </div>
  );
};

export default App;
