import React, { useState, useEffect, useCallback } from 'react';
import { Layout, message } from 'antd';
import ConnectionManager from './components/ConnectionManager';
import TabbedFileManager from './components/TabbedFileManager';
import FloatingSettingsButton from './i18n/components/FloatingSettingsButton';
import UploadProgressModal from './components/FileManager/UploadProgressModal';
import { Connection, FileInfo } from './types';
import { ApiService } from './services/api';
import { isSameConnection } from './utils/connection';
import { useAppI18n } from './i18n/hooks/useI18n';
import { I18nProvider } from './i18n/contexts/I18nContext';
import { useWindowTitle } from './i18n/hooks/useWindowTitle';
import { ConnectionPathRegistryProvider } from './contexts/ConnectionPathRegistry';
import { AppDndProvider } from './components/AppDndProvider';
import { useCrossConnectionTransfer } from './hooks/useCrossConnectionTransfer';
import { UploadProgress } from './utils/uploadProgress';

const App: React.FC = () => {
  return (
    <I18nProvider>
      <ConnectionPathRegistryProvider>
        <AppContent />
      </ConnectionPathRegistryProvider>
    </I18nProvider>
  );
};

const AppContent: React.FC = () => {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [currentConnection, setCurrentConnection] = useState<Connection | null>(null);
  const [uploadVisible, setUploadVisible] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const { connection } = useAppI18n();

  useWindowTitle();

  const { transferFiles } = useCrossConnectionTransfer({
    setUploadVisible,
    setUploadProgress,
  });

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

  const handleConnectionSelect = useCallback((conn: Connection) => {
    setCurrentConnection((prev) =>
      isSameConnection(prev, conn) ? prev : conn
    );
  }, []);

  const handleConnectionsChange = () => {
    refreshConnections();
  };

  const handleRemoteFileDrop = useCallback(
    (sourceConnectionId: string, files: FileInfo[], targetConnection: Connection) => {
      void transferFiles(sourceConnectionId, files, targetConnection);
    },
    [transferFiles]
  );

  const handleOpenTab = useCallback((conn: Connection) => {
    // 拖拽落到未打开的连接时，激活该连接以驱动 TabbedFileManager 打开标签页。
    // 与点击走同一条 selectedConnection 路径，避免双重 openTab 触发。
    setCurrentConnection((prev) => (isSameConnection(prev, conn) ? prev : conn));
  }, []);

  const handleUploadClose = useCallback(() => {
    setUploadVisible(false);
    setUploadProgress(null);
  }, []);

  return (
    <div className="app" style={{ position: 'relative', height: '100vh' }}>
      <AppDndProvider
        connections={connections}
        onRemoteFileDrop={handleRemoteFileDrop}
        onOpenTab={handleOpenTab}
      >
        <Layout style={{ height: '100vh' }}>
          <ConnectionManager
            connections={connections}
            currentConnection={currentConnection}
            onConnectionSelect={handleConnectionSelect}
            onConnectionsChange={handleConnectionsChange}
            onRefreshConnections={() => refreshConnections(true)}
          />
          <TabbedFileManager
            selectedConnection={currentConnection}
            onConnectionSelect={handleConnectionSelect}
          />
        </Layout>
      </AppDndProvider>

      <UploadProgressModal
        visible={uploadVisible}
        progress={uploadProgress}
        onClose={handleUploadClose}
      />

      <FloatingSettingsButton />
    </div>
  );
};

export default App;
