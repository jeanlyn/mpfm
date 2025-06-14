import React from 'react';
import { Card, Form, Select, Switch, Divider, Typography, Space } from 'antd';
import { GlobalOutlined, BgColorsOutlined, SettingOutlined } from '@ant-design/icons';
import LanguageSwitcher from './LanguageSwitcher';
import { useAppI18n } from '../hooks/useI18n';

const { Title, Text } = Typography;
const { Option } = Select;

interface SettingsPageProps {
  className?: string;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ className }) => {
  const { settings, app } = useAppI18n();

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
              更改语言后，界面文字将立即更新。设置会自动保存到本地存储。
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
                <Option value="light">浅色</Option>
                <Option value="dark">深色</Option>
                <Option value="auto">自动</Option>
              </Select>
            </Form.Item>
            <Form.Item label="紧凑模式">
              <Switch />
            </Form.Item>
          </Form>
        </Card>

        {/* 常规设置 */}
        <Card title={settings.general}>
          <Form layout="vertical">
            <Form.Item label="自动连接">
              <Switch defaultChecked />
            </Form.Item>
            <Form.Item label="启动时显示欢迎页面">
              <Switch defaultChecked />
            </Form.Item>
            <Form.Item label="文件列表虚拟化">
              <Switch defaultChecked />
            </Form.Item>
          </Form>
        </Card>

        {/* 高级设置 */}
        <Card title={settings.advanced}>
          <Form layout="vertical">
            <Form.Item label="开发者模式">
              <Switch />
            </Form.Item>
            <Form.Item label="详细日志">
              <Switch />
            </Form.Item>
            <Form.Item label="调试信息">
              <Switch />
            </Form.Item>
          </Form>
        </Card>
      </Space>
    </div>
  );
};

export default SettingsPage;
