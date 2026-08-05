import React, { useState } from 'react';
import { Button, Dropdown, Divider, Typography } from 'antd';
import { SettingOutlined } from '@ant-design/icons';
import LanguageSwitcher from './LanguageSwitcher';
import DiagnosticsSection from './DiagnosticsSection';
import EditorSelector from './EditorSelector';
import { useAppI18n } from '../hooks/useI18n';

const { Text, Title } = Typography;

interface FloatingSettingsButtonProps {
  className?: string;
}

const panelStyle: React.CSSProperties = {
  width: 370,
  background: '#fff',
  borderRadius: 12,
  boxShadow: '0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 3px 6px -4px rgba(0, 0, 0, 0.12)',
  overflow: 'hidden',
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: 'rgba(0, 0, 0, 0.65)',
  marginBottom: 8,
  letterSpacing: '0.02em',
};

const FloatingSettingsButton: React.FC<FloatingSettingsButtonProps> = ({ className }) => {
  const { settings } = useAppI18n();
  const [open, setOpen] = useState(false);

  const settingsPanel = (
    <div style={panelStyle}>
      <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid #f0f0f0' }}>
        <Title level={5} style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
          <SettingOutlined style={{ marginRight: 8, color: '#1677ff' }} />
          {settings.panelTitle}
        </Title>
      </div>

      <div style={{ padding: '14px 16px 4px' }}>
        <Text style={sectionLabelStyle}>{settings.language}</Text>
        <LanguageSwitcher size="middle" style={{ width: '100%' }} />
      </div>

      <Divider style={{ margin: '12px 0' }} />

      <div style={{ padding: '2px 16px 4px' }}>
        <Text style={sectionLabelStyle}>{settings.localEditor}</Text>
        <EditorSelector />
      </div>

      <Divider style={{ margin: '12px 0' }} />

      <div style={{ padding: '4px 16px 16px' }}>
        <DiagnosticsSection compact />
      </div>
    </div>
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
        dropdownRender={() => settingsPanel}
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
            boxShadow: open
              ? '0 6px 16px rgba(22, 119, 255, 0.35)'
              : '0 4px 12px rgba(0, 0, 0, 0.15)',
            border: 'none',
            background: open ? '#4096ff' : '#1677ff',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            if (!open) {
              e.currentTarget.style.background = '#4096ff';
              e.currentTarget.style.transform = 'scale(1.05)';
            }
          }}
          onMouseLeave={(e) => {
            if (!open) {
              e.currentTarget.style.background = '#1677ff';
              e.currentTarget.style.transform = 'scale(1)';
            }
          }}
        />
      </Dropdown>
    </div>
  );
};

export default FloatingSettingsButton;
