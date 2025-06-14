import React, { useState, useEffect } from 'react';
import { Alert, Button, Space, Spin } from 'antd';
import { ZoomInOutlined, ZoomOutOutlined, RotateLeftOutlined, RotateRightOutlined } from '@ant-design/icons';
import { useAppI18n } from '../../i18n/hooks/useI18n';

interface ImagePreviewProps {
  content: ArrayBuffer;
  fileName: string;
}

const ImagePreview: React.FC<ImagePreviewProps> = ({ content, fileName }) => {
  const { filePreview } = useAppI18n();
  const [imageUrl, setImageUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    try {
      // 检测图片类型
      const uint8Array = new Uint8Array(content);
      let mimeType = 'image/png'; // 默认类型
      
      // 简单的文件头检测
      if (uint8Array[0] === 0xFF && uint8Array[1] === 0xD8) {
        mimeType = 'image/jpeg';
      } else if (uint8Array[0] === 0x89 && uint8Array[1] === 0x50) {
        mimeType = 'image/png';
      } else if (uint8Array[0] === 0x47 && uint8Array[1] === 0x49) {
        mimeType = 'image/gif';
      } else if (uint8Array[0] === 0x42 && uint8Array[1] === 0x4D) {
        mimeType = 'image/bmp';
      }

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      setImageUrl(url);
      setLoading(false);

      // 清理函数
      return () => {
        URL.revokeObjectURL(url);
      };
    } catch (err) {
      console.error('图片加载失败:', err);
      setError(filePreview.imageFileFailed);
      setLoading(false);
    }
  }, [content]);

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev * 1.2, 5));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev / 1.2, 0.1));
  };

  const handleRotateLeft = () => {
    setRotation(prev => prev - 90);
  };

  const handleRotateRight = () => {
    setRotation(prev => prev + 90);
  };

  const handleReset = () => {
    setScale(1);
    setRotation(0);
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
        <div style={{ marginTop: '16px' }}>{filePreview.loadingImage}</div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        message={filePreview.imageLoadFailed}
        description={error}
        type="error"
        showIcon
        style={{ margin: '20px' }}
      />
    );
  }

  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      {/* 工具栏 */}
      <div style={{ marginBottom: '16px' }}>
        <Space>
          <Button icon={<ZoomInOutlined />} onClick={handleZoomIn}>
            {filePreview.zoomIn}
          </Button>
          <Button icon={<ZoomOutOutlined />} onClick={handleZoomOut}>
            {filePreview.zoomOut}
          </Button>
          <Button icon={<RotateLeftOutlined />} onClick={handleRotateLeft}>
            {filePreview.rotateLeft}
          </Button>
          <Button icon={<RotateRightOutlined />} onClick={handleRotateRight}>
            {filePreview.rotateRight}
          </Button>
          <Button onClick={handleReset}>
            {filePreview.reset}
          </Button>
          <span style={{ marginLeft: '16px', color: '#666' }}>
            {filePreview.zoom}: {Math.round(scale * 100)}%
          </span>
        </Space>
      </div>

      {/* 图片容器 */}
      <div 
        style={{ 
          overflow: 'auto',
          maxHeight: 'calc(70vh - 120px)',
          border: '1px solid #d9d9d9',
          borderRadius: '6px',
          backgroundColor: '#fafafa'
        }}
      >
        <img
          src={imageUrl}
          alt={fileName}
          style={{
            maxWidth: '100%',
            height: 'auto',
            transform: `scale(${scale}) rotate(${rotation}deg)`,
            transition: 'transform 0.3s ease',
            display: 'block',
            margin: '20px auto'
          }}
          onError={() => setError(filePreview.imageFormatNotSupported)}
        />
      </div>
    </div>
  );
};

export default ImagePreview;