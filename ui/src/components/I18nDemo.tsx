import React from 'react';
import { Card, Space, Button, Typography, Divider } from 'antd';
import { useTranslation } from 'react-i18next';
import { useAppI18n } from '../i18n/hooks/useI18n';
import LanguageSwitcher from '../i18n/components/LanguageSwitcher';

const { Title, Paragraph, Text } = Typography;

interface I18nDemoProps {
  className?: string;
}

const I18nDemo: React.FC<I18nDemoProps> = ({ className }) => {
  const { t } = useTranslation();
  const { app, connection, fileManager, settings, demo } = useAppI18n();

  return (
    <Card title={demo.title} className={className}>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        
        <div>
          <Title level={4}>{demo.languageSwitch}</Title>
          <Paragraph>
            {demo.languageSwitchDescription}
          </Paragraph>
          <LanguageSwitcher />
        </div>

        <Divider />

        <div>
          <Title level={4}>{demo.appCommonText}</Title>
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
          <Title level={4}>{demo.connectionManagementText}</Title>
          <Space direction="vertical">
            <Text strong>{connection.title}</Text>
            <Space wrap>
              <Button>{connection.add}</Button>
              <Button>{connection.connect}</Button>
              <Button>{connection.test}</Button>
            </Space>
            <div>
              <Text>{demo.statusExample} </Text>
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
          <Title level={4}>{demo.fileManagerText}</Title>
          <Space direction="vertical">
            <Text strong>{fileManager.title}</Text>
            <Space wrap>
              <Button>{fileManager.actions.upload}</Button>
              <Button>{fileManager.actions.download}</Button>
              <Button>{fileManager.actions.newFolder}</Button>
              <Button>{fileManager.actions.rename}</Button>
            </Space>
            <div>
              <Text>{demo.fieldNames} </Text>
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
          <Title level={4}>{demo.settingsText}</Title>
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
          <Title level={4}>{demo.directUseTFunction}</Title>
          <Paragraph>
            <Text>{demo.appTitle} <Text strong>{t('app.title')}</Text></Text>
            <br />
            <Text>{demo.currentLanguageExample}</Text>
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
