import React, { useMemo } from 'react';
import { Layout, Typography, Button, Tooltip, Menu, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { 
  SettingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PlusOutlined,
  ImportOutlined,
  ExportOutlined,
  MoreOutlined,
} from '@ant-design/icons';
import { ConnectionManagerProps } from '../types';
import { getConnectionIcon } from '../utils.tsx';
import { useAppI18n } from '../../../i18n/hooks/useI18n';
import './Sidebar.css';

const { Sider } = Layout;
const { Title } = Typography;

interface SidebarProps extends ConnectionManagerProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  onAddConnection: () => void;
  onImportConnections: () => void;
  onExportAllConnections: () => void;
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
  onImportConnections,
  onExportAllConnections,
  children,
}) => {
  const { connection } = useAppI18n();

  const bulkActionMenu: MenuProps = useMemo(
    () => ({
      items: [
        {
          key: 'import',
          icon: <ImportOutlined />,
          label: connection.sidebar.importConnections,
        },
        {
          key: 'export',
          icon: <ExportOutlined />,
          label: connection.sidebar.exportAllConnections,
          disabled: connections.length === 0,
        },
      ],
      onClick: ({ key }) => {
        if (key === 'import') onImportConnections();
        if (key === 'export') onExportAllConnections();
      },
    }),
    [
      connection.sidebar.importConnections,
      connection.sidebar.exportAllConnections,
      connections.length,
      onImportConnections,
      onExportAllConnections,
    ]
  );

  // 折叠状态的菜单项
  const collapsedMenuItems = connections
    .sort((a, b) => a.name.localeCompare(b.name)) // 按名称排序
    .map((conn) => ({
    key: conn.id,
    icon: (
      <Tooltip title={`${conn.name} (${conn.protocol_type.toUpperCase()})`} placement="right">
        {getConnectionIcon(conn.protocol_type)}
      </Tooltip>
    ),
    label: null,
  }));

  const collapsedSiderWidth = 48;

  return (
    <Sider 
      className="connection-sidebar"
      width={280}
      collapsedWidth={collapsedSiderWidth}
      collapsed={collapsed}
      collapsible
      trigger={null}
      style={{ 
        background: '#fff', 
        borderRight: '1px solid #f0f0f0',
        transition: 'all 0.2s',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: collapsed ? '8px 0' : '16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: collapsed ? 'center' : 'stretch',
        }}
      >
        {/* 标题和折叠按钮 */}
        <div style={{ 
          display: 'flex', 
          justifyContent: collapsed ? 'center' : 'space-between', 
          alignItems: 'center',
          marginBottom: collapsed ? '8px' : '16px',
          height: '32px',
          width: collapsed ? '100%' : undefined,
        }}>
          {!collapsed && (
            <Title level={4} style={{ margin: 0, fontSize: '16px' }}>
              <SettingOutlined /> {connection.title}
            </Title>
          )}
          <Tooltip title={collapsed ? connection.sidebar.expand : connection.sidebar.collapse}>
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

        {/* 添加连接 + 更多操作 */}
        <div
          style={{
            display: 'flex',
            flexDirection: collapsed ? 'column' : 'row',
            gap: collapsed ? '4px' : '8px',
            marginBottom: collapsed ? '8px' : '16px',
            alignItems: 'center',
            width: collapsed ? '100%' : undefined,
          }}
        >
          <Tooltip title={collapsed ? connection.add : undefined} placement="right">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={onAddConnection}
              style={{
                ...(collapsed
                  ? {
                      width: '32px',
                      height: '32px',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }
                  : {
                      flex: 1,
                      minWidth: 0,
                    }),
              }}
            >
              {!collapsed && connection.sidebar.addConnection}
            </Button>
          </Tooltip>

          <Dropdown menu={bulkActionMenu} trigger={['click']} placement={collapsed ? 'bottomRight' : 'bottomLeft'}>
            <Tooltip title={connection.sidebar.moreActions} placement="right">
              <Button
                type="text"
                icon={<MoreOutlined />}
                style={{
                  flexShrink: 0,
                  width: '32px',
                  height: '32px',
                  padding: 0,
                  color: 'rgba(0, 0, 0, 0.45)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              />
            </Tooltip>
          </Dropdown>
        </div>

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
              width: '100%',
              background: 'transparent',
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
