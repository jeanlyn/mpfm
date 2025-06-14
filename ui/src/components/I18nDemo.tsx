import React from 'react';
import { Card, Space, Button, Typography, Divider } from 'antd';
import { useTranslation } from 'react-i18next';
import { useAppI18n } from '../hooks/useI18n';
import LanguageSwitcher from './LanguageSwitcher';

const { Title, Paragraph, Text } = Typography;

interface I18nDemoProps {
  className?: string;
}

const I18nDemo: React.FC<I18nDemoProps> = ({ className }) => {
  const { t } = useTranslation();
  const { app, connection, fileManager, settings } = useAppI18n();

  return (
    <Card title="国际化 (i18n) 演示" className={className}>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        
        <div>
          <Title level={4}>语言切换</Title>
          <Paragraph>
            使用下面的选择器来切换语言：
          </Paragraph>
          <LanguageSwitcher />
        </div>

        <Divider />

        <div>
          <Title level={4}>应用通用文本</Title>
          <Space wrap>
            <Button type="primary">{app.save}</Button>
            <Button>{app.cancel}</Button>
            <Button danger>{app.delete}</Button>
            <Button>{app.edit}</Button>
            <Button>{app.refresh}</Button>
          </Space>
        </div>

        <Divider />

        <div>
          <Title level={4}>连接管理文本</Title>
          <Space direction="vertical">
            <Text strong>{connection.title}</Text>
            <Space wrap>
              <Button>{connection.add}</Button>
              <Button>{connection.connect}</Button>
              <Button>{connection.test}</Button>
            </Space>
            <div>
              <Text>状态示例: </Text>
              <Text type="success">{connection.status.connected}</Text>
              <Text> | </Text>
              <Text type="warning">{connection.status.connecting}</Text>
              <Text> | </Text>
              <Text type="danger">{connection.status.error}</Text>
            </div>
          </Space>
        </div>

        <Divider />

        <div>
          <Title level={4}>文件管理器文本</Title>
          <Space direction="vertical">
            <Text strong>{fileManager.title}</Text>
            <Space wrap>
              <Button>{fileManager.actions.upload}</Button>
              <Button>{fileManager.actions.download}</Button>
              <Button>{fileManager.actions.newFolder}</Button>
              <Button>{fileManager.actions.rename}</Button>
            </Space>
            <div>
              <Text>字段名称: </Text>
              <Text code>{fileManager.name}</Text>
              <Text> | </Text>
              <Text code>{fileManager.size}</Text>
              <Text> | </Text>
              <Text code>{fileManager.modified}</Text>
            </div>
          </Space>
        </div>

        <Divider />

        <div>
          <Title level={4}>设置文本</Title>
          <Space wrap>
            <Text>{settings.language}</Text>
            <Text> | </Text>
            <Text>{settings.theme}</Text>
            <Text> | </Text>
            <Text>{settings.general}</Text>
          </Space>
        </div>

        <Divider />

        <div>
          <Title level={4}>直接使用 t 函数</Title>
          <Paragraph>
            <Text>应用标题: <Text strong>{t('app.title')}</Text></Text>
            <br />
            <Text>当前语言键值对示例:</Text>
            <br />
            <Text code>t('app.loading') = "{t('app.loading')}"</Text>
            <br />
            <Text code>t('connection.messages.connectSuccess') = "{t('connection.messages.connectSuccess')}"</Text>
          </Paragraph>
        </div>
      </Space>
    </Card>
  );
};

export default I18nDemo;
