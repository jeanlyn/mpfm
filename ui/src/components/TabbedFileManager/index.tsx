import React from 'react';
import { Layout, Typography } from 'antd';
import { Connection } from '../../types';
import { isSameConnection } from '../../utils/connection';
import { useTabManager } from './hooks/useTabManager';
import TabBar from './components/TabBar';
import FileManagerTab from './components/FileManagerTab';
import { useAppI18n } from '../../i18n/hooks/useI18n';
import './TabbedFileManager.css';

const { Content } = Layout;
const { Title } = Typography;

interface TabbedFileManagerProps {
  selectedConnection: Connection | null;
  onConnectionSelect: (connection: Connection) => void;
}

/**
 * Tab式文件管理器主组件
 * 管理多个文件管理器Tab，确保同一连接不会重复打开
 */
const TabbedFileManager: React.FC<TabbedFileManagerProps> = ({
  selectedConnection,
  onConnectionSelect,
}) => {
  const {
    tabs,
    activeTabId,
    openTab,
    closeTab,
    switchToTab,
    closeAllTabs,
    closeOtherTabs,
  } = useTabManager();

  const { fileManager } = useAppI18n();

  const handleTabClick = React.useCallback(
    (tabId: string) => {
      if (tabId === activeTabId) return;

      const tab = tabs.find((t) => t.id === tabId);
      switchToTab(tabId);

      if (tab && !isSameConnection(selectedConnection, tab.connection)) {
        onConnectionSelect(tab.connection);
      }
    },
    [activeTabId, tabs, selectedConnection, switchToTab, onConnectionSelect]
  );

  const handleTabClose = React.useCallback(
    (tabId: string) => {
      if (tabId === activeTabId) {
        const remaining = tabs.filter((t) => t.id !== tabId);
        const nextActive = remaining.length > 0 ? remaining[remaining.length - 1] : null;
        closeTab(tabId);
        if (nextActive) {
          onConnectionSelect(nextActive.connection);
        }
      } else {
        closeTab(tabId);
      }
    },
    [activeTabId, tabs, closeTab, onConnectionSelect]
  );

  const handleCloseOthers = React.useCallback(
    (tabId: string) => {
      closeOtherTabs(tabId);
      const tab = tabs.find((t) => t.id === tabId);
      if (tab) {
        onConnectionSelect(tab.connection);
      }
    },
    [tabs, closeOtherTabs, onConnectionSelect]
  );

  // 当左侧选择新连接时，打开对应的 Tab（openTab 内部会跳过重复激活）
  React.useEffect(() => {
    if (selectedConnection) {
      openTab(selectedConnection);
    }
  }, [selectedConnection, openTab]);

  // 如果没有选择连接且没有打开的Tab，显示欢迎界面
  if (!selectedConnection && tabs.length === 0) {
    return (
      <Content style={{ padding: '24px', textAlign: 'center' }}>
        <Title level={3}>{fileManager.welcome.selectConnection}</Title>
        <p>{fileManager.welcome.selectConnectionDescription}</p>
      </Content>
    );
  }

  return (
    <div className="tabbed-file-manager">
      {/* Tab栏 */}
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onTabClick={handleTabClick}
        onTabClose={handleTabClose}
        onCloseAll={closeAllTabs}
        onCloseOthers={handleCloseOthers}
      />
      
      {/* Tab内容区域 */}
      <div className="tab-content">
        {tabs.map(tab => (
          <FileManagerTab
            key={tab.id}
            connection={tab.connection}
            visible={tab.id === activeTabId}
          />
        ))}
      </div>
    </div>
  );
};

export default TabbedFileManager;
