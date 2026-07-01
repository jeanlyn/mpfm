import React, { useState, useEffect, useCallback } from 'react';
import { Layout, message, Alert } from 'antd';
import ConnectionManager from './components/ConnectionManager';
import TabbedFileManager from './components/TabbedFileManager';
import FloatingSettingsButton from './i18n/components/FloatingSettingsButton';
import { Connection } from './types';
import { ApiService } from './services/api';
import { useAppI18n } from './i18n/hooks/useI18n';
import { I18nProvider } from './i18n/contexts/I18nContext';
import { useWindowTitle } from './i18n/hooks/useWindowTitle';

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
  const { connection, app } = useAppI18n();

  useWindowTitle();

  const refreshConnections = useCallback(async (showSuccessMessage = false) => {
    try {
      const connectionList = await ApiService.reloadConnections();
      setConnections(connectionList);

      setCurrentConnection((prev) => {
        if (!prev) return prev;
        const updated = connectionList.find((conn) => conn.id === prev.id);
        return updated ?? null;
      });

      if (showSuccessMessage) {
        message.success(connection.messages.refreshSuccess);
      }

      return connectionList;
    } catch (error) {
      message.error(`${connection.messages.refreshFailed}: ${error}`);
      throw error;
    }
  }, [connection.messages.refreshFailed, connection.messages.refreshSuccess]);

  useEffect(() => {
    refreshConnections();
  }, [refreshConnections]);

  const handleConnectionSelect = (connection: Connection) => {
    setCurrentConnection(connection);
  };

  const handleConnectionsChange = () => {
    refreshConnections();
  };

  return (
    <div className="app" style={{ position: 'relative', height: '100vh' }}>
      {!isTauriEnvironment() && (
        <Alert
          message={app.demo.title}
          description={app.demo.description}
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
          onRefreshConnections={() => refreshConnections(true)}
        />
        <TabbedFileManager selectedConnection={currentConnection} />
      </Layout>
      
      {/* 悬浮设置按钮 */}
      <FloatingSettingsButton />
    </div>
  );
};

export default App;
