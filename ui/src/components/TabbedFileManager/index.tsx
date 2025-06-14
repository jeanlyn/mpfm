import React from 'react';
import { Layout, Typography } from 'antd';
import { Connection } from '../../types';
import { useTabManager } from './hooks/useTabManager';
import TabBar from './components/TabBar';
import FileManagerTab from './components/FileManagerTab';
import { useAppI18n } from '../../i18n/hooks/useI18n';
import './TabbedFileManager.css';

const { Content } = Layout;
const { Title } = Typography;

interface TabbedFileManagerProps {
  selectedConnection: Connection | null;
}

/**
 * Tab式文件管理器主组件
 * 管理多个文件管理器Tab，确保同一连接不会重复打开
 */
const TabbedFileManager: React.FC<TabbedFileManagerProps> = ({
  selectedConnection,
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

  // 当选择新连接时，打开对应的Tab
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
        onTabClick={switchToTab}
        onTabClose={closeTab}
        onCloseAll={closeAllTabs}
        onCloseOthers={closeOtherTabs}
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
