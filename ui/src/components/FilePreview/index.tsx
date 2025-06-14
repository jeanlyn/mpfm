import React, { useState, useEffect } from 'react';
import { Modal, Spin, Alert, Button, Space } from 'antd';
import { 
  CloseOutlined, 
  DownloadOutlined, 
  FileTextOutlined,
  FilePdfOutlined,
  FileExcelOutlined,
  FileImageOutlined,
  FileWordOutlined,
  CodeOutlined
} from '@ant-design/icons';
import { Connection, FileInfo } from '../../types';
import { ApiService } from '../../services/api';
import TextPreview from './TextPreview';
import JsonPreview from './JsonPreview';
import ImagePreview from './ImagePreview';
import PdfPreview from './PdfPreview';
import CodePreview from './CodePreview';
import ExcelPreview from './ExcelPreview';
import WordPreview from './WordPreview';
import { useAppI18n } from '../../i18n/hooks/useI18n';
import { getFileType, FileType } from './utils/fileTypeDetector';

interface FilePreviewProps {
  file: FileInfo | null;
  connection: Connection | null;
  visible: boolean;
  onClose: () => void;
  onDownload?: (file: FileInfo) => void;
}

const FilePreview: React.FC<FilePreviewProps> = ({
  file,
  connection,
  visible,
  onClose,
  onDownload,
}) => {
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState<string | ArrayBuffer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileType, setFileType] = useState<FileType>('unknown');
  const { filePreview } = useAppI18n();

  useEffect(() => {
    if (visible && file && connection && !file.is_dir) {
      loadFileContent();
    } else {
      resetState();
    }
  }, [visible, file, connection]);

  const resetState = () => {
    setContent(null);
    setError(null);
    setLoading(false);
    setFileType('unknown');
  };

  const loadFileContent = async () => {
    if (!file || !connection) return;

    setLoading(true);
    setError(null);

    try {
      const detectedType = getFileType(file.name);
      setFileType(detectedType);

      // 对于大文件，只预览前几KB
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size && file.size > maxSize) {
        setError(filePreview.fileTooLarge.replace('{size}', Math.round(file.size / 1024 / 1024).toString()));
        return;
      }

      // 根据文件类型决定获取方式
      if (detectedType === 'image' || detectedType === 'pdf' || detectedType === 'excel' || detectedType === 'word') {
        // 二进制文件获取二进制数据
        const arrayBuffer = await ApiService.getFileContent(connection.id, file.path, 'binary');
        setContent(arrayBuffer);
      } else {
        // 文本类型文件获取文本内容
        const textContent = await ApiService.getFileContent(connection.id, file.path, 'text');
        setContent(textContent as string);
      }
    } catch (err) {
      console.error(filePreview.loadContentFailed, err);
      setError(`${filePreview.loadFileFailed}: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const getFileIcon = (type: FileType) => {
    switch (type) {
      case 'pdf': return <FilePdfOutlined style={{ color: '#ff4d4f' }} />;
      case 'image': return <FileImageOutlined style={{ color: '#52c41a' }} />;
      case 'excel': return <FileExcelOutlined style={{ color: '#faad14' }} />;
      case 'word': return <FileWordOutlined style={{ color: '#1890ff' }} />;
      case 'code': return <CodeOutlined style={{ color: '#1890ff' }} />;
      case 'json': return <CodeOutlined style={{ color: '#722ed1' }} />;
      default: return <FileTextOutlined style={{ color: '#666' }} />;
    }
  };

  const renderPreview = () => {
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
          message={filePreview.renderPreviewFailed}
          description={error}
          type="error"
          showIcon
          style={{ margin: '20px' }}
        />
      );
    }

    if (!content || !file) {
      return (
        <Alert
          message={filePreview.noContent}
          description={filePreview.noContentDescription}
          type="warning"
          showIcon
          style={{ margin: '20px' }}
        />
      );
    }

    try {
      switch (fileType) {
        case 'text':
          return <TextPreview content={content as string} fileName={file.name} />;
        case 'json':
          return <JsonPreview content={content as string} fileName={file.name} />;
        case 'code':
          return <CodePreview content={content as string} fileName={file.name} />;
        case 'image':
          return <ImagePreview content={content as ArrayBuffer} fileName={file.name} />;
        case 'pdf':
          return <PdfPreview content={content as ArrayBuffer} fileName={file.name} />;
        case 'excel':
          return <ExcelPreview content={content as ArrayBuffer} fileName={file.name} />;
        case 'word':
          return <WordPreview content={content as ArrayBuffer} fileName={file.name} />;
        default:
          return (
            <Alert
              message={filePreview.unsupportedFileType}
              description={filePreview.unsupportedFileDescription.replace('{fileName}', file.name)}
              type="info"
              showIcon
              style={{ margin: '20px' }}
            />
          );
      }
    } catch (previewError) {
      console.error(filePreview.renderPreviewFailed, previewError);
      return (
        <Alert
          message={filePreview.renderPreviewFailed}
          description={filePreview.renderPreviewFailedDescription}
          type="error"
          showIcon
          style={{ margin: '20px' }}
        />
      );
    }
  };

  const getModalTitle = () => {
    if (!file) return filePreview.filePreviewTitle;
    
    return (
      <Space>
        {getFileIcon(fileType)}
        <span>{file.name}</span>
        {file.size && (
          <span style={{ color: '#666', fontSize: '12px' }}>
            ({Math.round(file.size / 1024)} KB)
          </span>
        )}
      </Space>
    );
  };

  return (
    <Modal
      title={getModalTitle()}
      open={visible}
      onCancel={onClose}
      width="80vw"
      style={{ maxWidth: '1200px', top: '20px' }}
      bodyStyle={{ 
        height: '70vh', 
        overflow: 'auto',
        padding: 0
      }}
      footer={
        <Space>
          {file && onDownload && (
            <Button
              icon={<DownloadOutlined />}
              onClick={() => onDownload(file)}
            >
              {filePreview.downloadFile}
            </Button>
          )}
          <Button
            icon={<CloseOutlined />}
            onClick={onClose}
          >
            {filePreview.close}
          </Button>
        </Space>
      }
      destroyOnClose
    >
      {renderPreview()}
    </Modal>
  );
};

export default FilePreview;