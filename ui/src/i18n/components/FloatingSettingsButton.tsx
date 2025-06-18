import React, { useState } from 'react';
import { Button, Dropdown, Card, Space, Typography } from 'antd';
import { SettingOutlined, GlobalOutlined } from '@ant-design/icons';
import LanguageSwitcher from './LanguageSwitcher';
import { useAppI18n } from '../hooks/useI18n';

const { Text } = Typography;

interface FloatingSettingsButtonProps {
  className?: string;
}

const FloatingSettingsButton: React.FC<FloatingSettingsButtonProps> = ({ className }) => {
  const { settings } = useAppI18n();
  const [open, setOpen] = useState(false);

  const settingsContent = (
    <Card 
      size="small" 
      title={
        <Space>
          <GlobalOutlined />
          {settings.language}
        </Space>
      }
      style={{ width: 200, margin: 0 }}
      styles={{ body: { padding: '12px' } }}
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        <div>
          <Text style={{ fontSize: '12px', color: '#666' }}>
            选择语言 / Select Language
          </Text>
        </div>
        <LanguageSwitcher size="small" />
      </Space>
    </Card>
  );

  return (
    <div
      className={className}
      style={{
        position: 'fixed',
        bottom: '20px',
        left: '20px',
        zIndex: 1000,
      }}
    >
      <Dropdown
        overlay={settingsContent}
        trigger={['click']}
        placement="topLeft"
        open={open}
        onOpenChange={setOpen}
      >
        <Button
          type="primary"
          shape="circle"
          icon={<SettingOutlined />}
          size="large"
          style={{
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            border: 'none',
            background: open ? '#40a9ff' : '#1890ff',
            transition: 'all 0.3s ease',
          }}
          onMouseEnter={(e) => {
            if (!open) {
              e.currentTarget.style.background = '#40a9ff';
              e.currentTarget.style.transform = 'scale(1.1)';
            }
          }}
          onMouseLeave={(e) => {
            if (!open) {
              e.currentTarget.style.background = '#1890ff';
              e.currentTarget.style.transform = 'scale(1)';
            }
          }}
        />
      </Dropdown>
    </div>
  );
};

export default FloatingSettingsButton;
