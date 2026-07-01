import React, { useCallback, useEffect, useState } from 'react';
import { Button, Space, Typography, message } from 'antd';
import { CopyOutlined, ExportOutlined, FileTextOutlined } from '@ant-design/icons';
import { save } from '@tauri-apps/plugin-dialog';
import { useAppI18n } from '../hooks/useI18n';
import { ApiService } from '../../services/api';

const { Text } = Typography;

const DiagnosticsSection: React.FC = () => {
  const { settings } = useAppI18n();
  const [logPath, setLogPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    ApiService.getDiagnosticsReport()
      .then((data) => setLogPath(data.logPath))
      .catch(() => {
        // 非 Tauri 环境或后端不可用时静默忽略
      });
  }, []);

  const handleExport = useCallback(async () => {
    setLoading(true);
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
      setLoading(false);
    }
  }, [settings]);

  const handleCopy = useCallback(async () => {
    setLoading(true);
    try {
      const { report } = await ApiService.getDiagnosticsReport();
      await ApiService.copyTextToClipboard(report);
      message.success(settings.copyDiagnosticsSuccess);
    } catch (error) {
      message.error(`${settings.copyDiagnosticsFailed}: ${error}`);
    } finally {
      setLoading(false);
    }
  }, [settings]);

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="small">
      <Text style={{ fontSize: '12px', color: '#666' }}>
        {settings.diagnosticsDescription}
      </Text>
      {logPath && (
        <Text
          type="secondary"
          style={{ fontSize: '11px', wordBreak: 'break-all' }}
          copyable={{ text: logPath }}
        >
          <FileTextOutlined /> {logPath}
        </Text>
      )}
      <Space wrap>
        <Button
          size="small"
          icon={<ExportOutlined />}
          loading={loading}
          onClick={() => void handleExport()}
        >
          {settings.exportDiagnostics}
        </Button>
        <Button
          size="small"
          icon={<CopyOutlined />}
          loading={loading}
          onClick={() => void handleCopy()}
        >
          {settings.copyDiagnostics}
        </Button>
      </Space>
    </Space>
  );
};

export default DiagnosticsSection;
