import React, { useState, useEffect } from 'react';
import { Alert, Button, Space, Spin } from 'antd';
import { LeftOutlined, RightOutlined, ZoomInOutlined, ZoomOutOutlined } from '@ant-design/icons';
import { useAppI18n } from '../../i18n/hooks/useI18n';

interface PdfPreviewProps {
  content: ArrayBuffer;
  fileName: string;
}

const PdfPreview: React.FC<PdfPreviewProps> = ({ content, fileName }) => {
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { filePreview } = useAppI18n();

  useEffect(() => {
    try {
      const blob = new Blob([content], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
      setLoading(false);

      // 清理函数
      return () => {
        URL.revokeObjectURL(url);
      };
    } catch (err) {
      setError('PDF文件加载失败');
      setLoading(false);
    }
  }, [content]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
        <div style={{ marginTop: '16px' }}>{filePreview.loading}</div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        message={filePreview.pdfPreviewFailed}
        description={error}
        type="error"
        showIcon
        style={{ margin: '20px' }}
      />
    );
  }

  return (
    <div style={{ 
      height: '100%',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* 提示信息 */}
      <div style={{ 
        padding: '16px', 
        backgroundColor: '#f0f0f0', 
        borderBottom: '1px solid #d9d9d9',
        textAlign: 'center',
        fontSize: '14px',
        color: '#666'
      }}>
        PDF预览 - 如需完整功能请下载文件使用专业PDF阅读器打开
      </div>

      {/* PDF嵌入显示 */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <iframe
          src={pdfUrl}
          style={{
            width: '100%',
            height: '100%',
            border: 'none'
          }}
          title={fileName}
        />
      </div>
    </div>
  );
};

export default PdfPreview;