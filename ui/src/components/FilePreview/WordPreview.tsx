import React, { useState, useEffect } from 'react';
import { Alert, Spin, Typography } from 'antd';
import mammoth from 'mammoth';
import DOMPurify from 'dompurify';

interface WordPreviewProps {
  content: ArrayBuffer;
  fileName: string;
}

const WordPreview: React.FC<WordPreviewProps> = ({ content, fileName }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [messages, setMessages] = useState<string[]>([]);

  useEffect(() => {
    convertWordToHtml();
  }, [content]);

  const convertWordToHtml = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 使用mammoth将Word文档转换为HTML
      const result = await mammoth.convertToHtml({ arrayBuffer: content });
      
      // 使用DOMPurify清理HTML内容，防止XSS攻击
      const sanitizedHtml = DOMPurify.sanitize(result.value, {
        // 允许的标签和属性
        ALLOWED_TAGS: [
          'p', 'div', 'span', 'br', 'strong', 'b', 'em', 'i', 'u', 's',
          'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
          'ul', 'ol', 'li',
          'table', 'thead', 'tbody', 'tr', 'td', 'th',
          'img', 'a'
        ],
        ALLOWED_ATTR: [
          'style', 'class', 'id', 'href', 'src', 'alt', 'title',
          'colspan', 'rowspan'
        ],
        // 移除script和其他危险元素
        FORBID_TAGS: ['script', 'object', 'embed', 'form', 'input'],
        FORBID_ATTR: ['onload', 'onerror', 'onclick', 'onmouseover']
      });
      
      setHtmlContent(sanitizedHtml);
      
      // 收集转换过程中的消息（警告等）
      const messageTexts = result.messages.map(msg => msg.message);
      setMessages(messageTexts);
      
      setLoading(false);
    } catch (err) {
      console.error('Word文档转换失败:', err);
      setError(`解析Word文档失败: ${err}`);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
        <div style={{ marginTop: '16px' }}>解析Word文档中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        message="Word预览失败"
        description={error}
        type="error"
        showIcon
        style={{ margin: '20px' }}
      />
    );
  }

  return (
    <div style={{ padding: '10px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 文档信息 */}
      <div style={{ 
        marginBottom: '12px', 
        fontSize: '12px', 
        color: '#666',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        flexShrink: 0
      }}>
        Word文档: {fileName}
        {messages.length > 0 && (
          <div style={{ marginTop: '4px' }}>
            <Typography.Text type="warning" style={{ fontSize: '12px' }}>
              注意: 某些格式可能无法完全保持原样
            </Typography.Text>
          </div>
        )}
      </div>

      {/* Word内容显示区域 */}
      <div 
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid #d9d9d9',
          borderRadius: '6px',
          padding: '30px',
          flex: 1,
          overflow: 'auto',
          fontFamily: '"Times New Roman", Times, serif',
          fontSize: '14px',
          lineHeight: '1.6',
          color: '#333',
          // 模拟Word文档的页面效果
          boxShadow: '0 0 10px rgba(0,0,0,0.1)'
        }}
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />

      {/* 转换消息显示 */}
      {messages.length > 0 && (
        <div style={{ marginTop: '12px', flexShrink: 0 }}>
          <Alert
            message={`转换提醒: 检测到 ${messages.length} 个格式转换问题，某些元素可能无法完全显示`}
            type="info"
            showIcon
            style={{ fontSize: '12px' }}
          />
        </div>
      )}
    </div>
  );
};

export default WordPreview;
