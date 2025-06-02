import React from 'react';
import { Tabs, Dropdown, Button } from 'antd';
import { CloseOutlined, MoreOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { FileManagerTab } from '../hooks/useTabManager';

interface TabBarProps {
  tabs: FileManagerTab[];
  activeTabId: string | null;
  onTabClick: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onCloseAll: () => void;
  onCloseOthers: (tabId: string) => void;
}

/**
 * Tab栏组件
 * 显示所有打开的连接Tab，支持切换、关闭等操作
 */
const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  onTabClick,
  onTabClose,
  onCloseAll,
  onCloseOthers,
}) => {
  // 生成Tab项
  const tabItems = tabs.map(tab => {
    // 为每个Tab创建右键菜单
    const contextMenu: MenuProps = {
      items: [
        {
          key: 'close',
          label: '关闭',
          onClick: () => onTabClose(tab.id),
        },
        {
          key: 'closeOthers',
          label: '关闭其他',
          disabled: tabs.length <= 1,
          onClick: () => onCloseOthers(tab.id),
        },
        {
          key: 'closeAll',
          label: '关闭所有',
          onClick: () => onCloseAll(),
        },
      ],
    };

    return {
      key: tab.id,
      label: (
        <Dropdown menu={contextMenu} trigger={['contextMenu']}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              maxWidth: '200px',
              cursor: 'pointer',
            }}
          >
            <span
              style={{
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={tab.title}
            >
              {tab.title}
            </span>
            <CloseOutlined
              className="tab-close-btn"
              style={{
                fontSize: '12px',
                padding: '2px',
                borderRadius: '2px',
                color: '#999',
              }}
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(tab.id);
              }}
            />
          </div>
        </Dropdown>
      ),
      closable: false, // 我们自己处理关闭
    };
  });

  // Tab操作菜单
  const tabOperationsMenu: MenuProps = {
    items: [
      {
        key: 'closeAll',
        label: '关闭所有Tab',
        disabled: tabs.length === 0,
        onClick: () => onCloseAll(),
      },
    ],
  };

  if (tabs.length === 0) {
    return (
      <div className="empty-state">
        请从左侧选择连接来打开文件管理器
      </div>
    );
  }

  return (
    <div className="tab-bar">
      <div style={{ flex: 1 }}>
        <Tabs
          type="card"
          size="small"
          activeKey={activeTabId || undefined}
          items={tabItems}
          onChange={onTabClick}
          style={{
            marginBottom: 0,
          }}
          tabBarStyle={{
            marginBottom: 0,
            paddingLeft: '8px',
          }}
        />
      </div>
      
      {/* Tab操作按钮 */}
      <div className="tab-operations">
        <Dropdown menu={tabOperationsMenu} placement="bottomRight">
          <Button
            icon={<MoreOutlined />}
            size="small"
            type="text"
            style={{ border: 'none' }}
          />
        </Dropdown>
      </div>
    </div>
  );
};

export default TabBar;
