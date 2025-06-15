import React from 'react';

interface TextPreviewProps {
  content: string;
  fileName: string;
}

const TextPreview: React.FC<TextPreviewProps> = ({ content }) => {
  return (
    <div style={{ 
      padding: '20px', 
      fontFamily: 'Monaco, Consolas, "Courier New", monospace',
      fontSize: '14px',
      lineHeight: '1.6',
      backgroundColor: '#fafafa',
      border: '1px solid #d9d9d9',
      borderRadius: '6px',
      maxHeight: '100%',
      overflow: 'auto'
    }}>
      <pre style={{ 
        margin: 0, 
        whiteSpace: 'pre-wrap', 
        wordBreak: 'break-word',
        color: '#333'
      }}>
        {content}
      </pre>
    </div>
  );
};

export default TextPreview;