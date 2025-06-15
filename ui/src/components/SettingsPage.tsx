import React from 'react';
import { Card, Form, Select, Switch, Typography, Space } from 'antd';
import { GlobalOutlined, BgColorsOutlined, SettingOutlined } from '@ant-design/icons';
import LanguageSwitcher from '../i18n/components/LanguageSwitcher';
import { useAppI18n } from '../i18n/hooks/useI18n';

const { Title, Text } = Typography;
const { Option } = Select;

interface SettingsPageProps {
  className?: string;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ className }) => {
  const { settings } = useAppI18n();

  return (
    <div className={className} style={{ padding: '24px' }}>
      <Title level={2}>
        <SettingOutlined /> {settings.title}
      </Title>
      
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        
        {/* 语言设置 */}
        <Card 
          title={
            <Space>
              <GlobalOutlined />
              {settings.language}
            </Space>
          }
        >
          <Form layout="vertical">
            <Form.Item label={settings.language}>
              <LanguageSwitcher />
            </Form.Item>
            <Text type="secondary">
              {settings.languageDescription}
            </Text>
          </Form>
        </Card>

        {/* 外观设置 */}
        <Card 
          title={
            <Space>
              <BgColorsOutlined />
              {settings.appearance}
            </Space>
          }
        >
          <Form layout="vertical">
            <Form.Item label={settings.theme}>
              <Select defaultValue="light" style={{ width: 120 }}>
                <Option value="light">{settings.lightTheme}</Option>
                <Option value="dark">{settings.darkTheme}</Option>
                <Option value="auto">{settings.autoTheme}</Option>
              </Select>
            </Form.Item>
            <Form.Item label={settings.compactMode}>
              <Switch />
            </Form.Item>
          </Form>
        </Card>

        {/* 常规设置 */}
        <Card title={settings.general}>
          <Form layout="vertical">
            <Form.Item label={settings.autoConnect}>
              <Switch defaultChecked />
            </Form.Item>
            <Form.Item label={settings.showWelcomeOnStartup}>
              <Switch defaultChecked />
            </Form.Item>
            <Form.Item label={settings.virtualizeFileList}>
              <Switch defaultChecked />
            </Form.Item>
          </Form>
        </Card>

        {/* 高级设置 */}
        <Card title={settings.advanced}>
          <Form layout="vertical">
            <Form.Item label={settings.developerMode}>
              <Switch />
            </Form.Item>
            <Form.Item label={settings.verboseLogging}>
              <Switch />
            </Form.Item>
            <Form.Item label={settings.debugInfo}>
              <Switch />
            </Form.Item>
          </Form>
        </Card>
      </Space>
    </div>
  );
};

export default SettingsPage;
