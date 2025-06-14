import React, { useState } from 'react';
import { Alert, Button, Space } from 'antd';
import { CompressOutlined, ExpandOutlined } from '@ant-design/icons';
import { useAppI18n } from '../../i18n/hooks/useI18n';

interface JsonPreviewProps {
  content: string;
  fileName: string;
}

const JsonPreview: React.FC<JsonPreviewProps> = ({ content, fileName }) => {
  const [isFormatted, setIsFormatted] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { filePreview } = useAppI18n();

  const formatJson = (jsonString: string): string => {
    try {
      const parsed = JSON.parse(jsonString);
      return JSON.stringify(parsed, null, 2);
    } catch (err) {
      setError(filePreview.jsonFormatError);
      return jsonString;
    }
  };

  const displayContent = isFormatted ? formatJson(content) : content;

  if (error) {
    return (
      <div style={{ padding: '20px' }}>
        <Alert
          message={filePreview.jsonParseError}
          description={error}
          type="error"
          showIcon
          style={{ marginBottom: '16px' }}
        />
        <div style={{ 
          fontFamily: 'Monaco, Consolas, "Courier New", monospace',
          fontSize: '14px',
          backgroundColor: '#fafafa',
          border: '1px solid #d9d9d9',
          borderRadius: '6px',
          padding: '16px',
          overflow: 'auto'
        }}>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
            {content}
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ marginBottom: '16px' }}>
        <Space>
          <Button
            size="small"
            icon={isFormatted ? <CompressOutlined /> : <ExpandOutlined />}
            onClick={() => setIsFormatted(!isFormatted)}
          >
            {isFormatted ? filePreview.compressDisplay : filePreview.formatDisplay}
          </Button>
        </Space>
      </div>
      
      <div style={{ 
        fontFamily: 'Monaco, Consolas, "Courier New", monospace',
        fontSize: '14px',
        backgroundColor: '#fafafa',
        border: '1px solid #d9d9d9',
        borderRadius: '6px',
        padding: '16px',
        overflow: 'auto',
        maxHeight: 'calc(70vh - 120px)'
      }}>
        <pre style={{ 
          margin: 0, 
          whiteSpace: 'pre-wrap',
          color: '#333'
        }}>
          {displayContent}
        </pre>
      </div>
    </div>
  );
};

export default JsonPreview;