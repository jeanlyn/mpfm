import React, { useEffect, useState } from 'react';
import { Button, Dropdown, Divider, Input, message, Space, Typography } from 'antd';
import {
  EditOutlined,
  FolderOpenOutlined,
  SaveOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import LanguageSwitcher from './LanguageSwitcher';
import DiagnosticsSection from './DiagnosticsSection';
import { useAppI18n } from '../hooks/useI18n';
import { loadEditorSettings, saveEditorSettings } from '../../utils/editorSettings';

const { Text, Title } = Typography;

interface FloatingSettingsButtonProps {
  className?: string;
}

const panelStyle: React.CSSProperties = {
  width: 340,
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
  const [editorPath, setEditorPath] = useState('');
  const [savingEditor, setSavingEditor] = useState(false);

  useEffect(() => {
    loadEditorSettings()
      .then((value) => setEditorPath(value.executablePath))
      .catch((error) => console.warn('加载文本编辑器设置失败:', error));
  }, []);

  const persistEditorPath = async (path: string) => {
    setSavingEditor(true);
    try {
      await saveEditorSettings({ executablePath: path.trim() });
      message.success(settings.editorSaved);
    } catch (error) {
      message.error(`${settings.editorSaveFailed}: ${error}`);
    } finally {
      setSavingEditor(false);
    }
  };

  const selectEditor = async () => {
    const selected = await openDialog({
      multiple: false,
      directory: false,
      title: settings.editorSelect,
    });
    if (selected && typeof selected === 'string') {
      setEditorPath(selected);
      await persistEditorPath(selected);
    }
  };

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
        <Text style={sectionLabelStyle}>
          <EditOutlined style={{ marginRight: 6 }} />
          {settings.localEditor}
        </Text>
        <Space.Compact style={{ width: '100%' }}>
          <Input
            value={editorPath}
            placeholder={settings.editorAutoDetect}
            onChange={(event) => setEditorPath(event.target.value)}
            onPressEnter={() => persistEditorPath(editorPath)}
            disabled={savingEditor}
          />
          <Button
            icon={<FolderOpenOutlined />}
            onClick={selectEditor}
            loading={savingEditor}
            title={settings.editorBrowse}
          />
          <Button
            icon={<SaveOutlined />}
            onClick={() => persistEditorPath(editorPath)}
            loading={savingEditor}
            title={settings.editorSave}
          />
        </Space.Compact>
        <Text type="secondary" style={{ display: 'block', fontSize: 12, marginTop: 6 }}>
          {settings.editorHint}
        </Text>
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
