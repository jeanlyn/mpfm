import React from 'react';
import { Layout, Typography, Button, Tooltip, Menu } from 'antd';
import { 
  SettingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { ConnectionManagerProps } from '../types';
import { getConnectionIcon } from '../utils.tsx';

const { Sider } = Layout;
const { Title } = Typography;

interface SidebarProps extends ConnectionManagerProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  onAddConnection: () => void;
  children: React.ReactNode;
}

/**
 * 侧边栏组件
 */
export const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  connections,
  currentConnection,
  onConnectionSelect,
  onToggleCollapse,
  onAddConnection,
  children,
}) => {
  // 折叠状态的菜单项
  const collapsedMenuItems = connections.map((conn) => ({
    key: conn.id,
    icon: (
      <Tooltip title={`${conn.name} (${conn.protocol_type.toUpperCase()})`} placement="right">
        {getConnectionIcon(conn.protocol_type)}
      </Tooltip>
    ),
    label: null,
  }));

  return (
    <Sider 
      width={collapsed ? 80 : 280} 
      collapsed={collapsed}
      collapsible
      trigger={null}
      style={{ 
        background: '#fff', 
        borderRight: '1px solid #f0f0f0',
        transition: 'all 0.2s'
      }}
    >
      <div style={{ padding: collapsed ? '16px 8px' : '16px' }}>
        {/* 标题和折叠按钮 */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '16px',
          height: '32px'
        }}>
          {!collapsed && (
            <Title level={4} style={{ margin: 0, fontSize: '16px' }}>
              <SettingOutlined /> 连接管理
            </Title>
          )}
          <Tooltip title={collapsed ? "展开面板" : "收起面板"}>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={onToggleCollapse}
              style={{
                fontSize: '16px',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            />
          </Tooltip>
        </div>

        {/* 添加连接按钮 */}
        <Tooltip title={collapsed ? "添加连接" : ""} placement="right">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={onAddConnection}
            style={{ 
              width: '100%', 
              marginBottom: '16px',
              ...(collapsed && { 
                width: '48px', 
                height: '48px',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              })
            }}
          >
            {!collapsed && '添加连接'}
          </Button>
        </Tooltip>

        {/* 连接列表 */}
        {collapsed ? (
          // 折叠状态：使用传统 Menu 组件
          <Menu
            mode="inline"
            selectedKeys={currentConnection ? [currentConnection.id] : []}
            items={collapsedMenuItems}
            onSelect={({ key }) => {
              const connection = connections.find((conn) => conn.id === key);
              if (connection) {
                onConnectionSelect(connection);
              }
            }}
            style={{
              border: 'none',
              width: '48px'
            }}
            inlineCollapsed={collapsed}
          />
        ) : (
          // 展开状态：使用自定义布局
          children
        )}
      </div>
    </Sider>
  );
};
