import React, { useCallback, useState } from 'react';
import { Button, Space, Typography, message } from 'antd';
import { CopyOutlined, ExportOutlined } from '@ant-design/icons';
import { save } from '@tauri-apps/plugin-dialog';
import { useAppI18n } from '../hooks/useI18n';
import { ApiService } from '../../services/api';

const { Text, Paragraph } = Typography;

interface DiagnosticsSectionProps {
  compact?: boolean;
}

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: 'rgba(0, 0, 0, 0.65)',
  marginBottom: 8,
  letterSpacing: '0.02em',
};

const DiagnosticsSection: React.FC<DiagnosticsSectionProps> = ({ compact = false }) => {
  const { settings } = useAppI18n();
  const [exportLoading, setExportLoading] = useState(false);
  const [copyLoading, setCopyLoading] = useState(false);

  const handleExport = useCallback(async () => {
    setExportLoading(true);
    try {
      const defaultName = `mpfm-diagnostics-${new Date().toISOString().slice(0, 10)}.txt`;
      const savePath = await save({
        title: settings.exportDiagnostics,
        defaultPath: defaultName,
        filters: [{ name: 'Text', extensions: ['txt'] }],
      });

      if (!savePath) {
        return;
      }

      await ApiService.exportDiagnosticsReport(savePath);
      message.success(settings.exportDiagnosticsSuccess);
    } catch (error) {
      message.error(`${settings.exportDiagnosticsFailed}: ${error}`);
    } finally {
      setExportLoading(false);
    }
  }, [settings]);

  const handleCopy = useCallback(async () => {
    setCopyLoading(true);
    try {
      const { report } = await ApiService.getDiagnosticsReport();
      await ApiService.copyTextToClipboard(report);
      message.success(settings.copyDiagnosticsSuccess);
    } catch (error) {
      message.error(`${settings.copyDiagnosticsFailed}: ${error}`);
    } finally {
      setCopyLoading(false);
    }
  }, [settings]);

  const description = compact ? settings.diagnosticsHint : settings.diagnosticsDescription;

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={compact ? 10 : 12}>
      {compact && <Text style={sectionLabelStyle}>{settings.diagnostics}</Text>}

      <Paragraph
        type="secondary"
        style={{
          fontSize: 12,
          lineHeight: 1.6,
          marginBottom: 0,
        }}
      >
        {description}
      </Paragraph>

      <Space direction="vertical" style={{ width: '100%' }} size={8}>
        <Button
          type="primary"
          block
          icon={<ExportOutlined />}
          loading={exportLoading}
          onClick={() => void handleExport()}
        >
          {settings.exportDiagnostics}
        </Button>
        <Button
          block
          icon={<CopyOutlined />}
          loading={copyLoading}
          onClick={() => void handleCopy()}
        >
          {settings.copyDiagnostics}
        </Button>
      </Space>
    </Space>
  );
};

export default DiagnosticsSection;
