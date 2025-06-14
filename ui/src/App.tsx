import React, { useState, useEffect } from 'react';
import { Layout, message, Alert } from 'antd';
import ConnectionManager from './components/ConnectionManager';
import TabbedFileManager from './components/TabbedFileManager';
import FloatingSettingsButton from './i18n/components/FloatingSettingsButton';
import { Connection } from './types';
import { ApiService } from './services/api';
import { useAppI18n } from './i18n/hooks/useI18n';
import { I18nProvider } from './i18n/contexts/I18nContext';

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
  const { connection } = useAppI18n();

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
    <div className="app" style={{ position: 'relative', height: '100vh' }}>
      {!isTauriEnvironment() && (
        <Alert
          message="演示模式"
          description="您正在浏览器中查看界面演示。要使用完整功能，请运行 'npm run tauri:dev' 启动 Tauri 应用。"
          type="info"
          showIcon
          style={{ margin: '16px' }}
        />
      )}
      
      <Layout style={{ height: isTauriEnvironment() ? '100vh' : 'calc(100vh - 80px)' }}>
        <ConnectionManager
          connections={connections}
          currentConnection={currentConnection}
          onConnectionSelect={handleConnectionSelect}
          onConnectionsChange={handleConnectionsChange}
        />
        <TabbedFileManager selectedConnection={currentConnection} />
      </Layout>
      
      {/* 悬浮设置按钮 */}
      <FloatingSettingsButton />
    </div>
  );
};

export default App;
