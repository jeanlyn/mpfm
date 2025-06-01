import React from 'react';
import { getFileExtension } from './utils/fileTypeDetector';

interface CodePreviewProps {
  content: string;
  fileName: string;
}

const CodePreview: React.FC<CodePreviewProps> = ({ content, fileName }) => {
  const getLanguageFromExtension = (fileName: string): string => {
    const ext = getFileExtension(fileName).toLowerCase();
    const languageMap: Record<string, string> = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.java': 'java',
      '.c': 'c',
      '.cpp': 'cpp',
      '.h': 'c',
      '.hpp': 'cpp',
      '.cs': 'csharp',
      '.php': 'php',
      '.rb': 'ruby',
      '.go': 'go',
      '.rs': 'rust',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.scala': 'scala',
      '.html': 'html',
      '.htm': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.sass': 'sass',
      '.less': 'less',
      '.sql': 'sql',
      '.sh': 'bash',
      '.bash': 'bash',
      '.ps1': 'powershell',
      '.bat': 'batch',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.toml': 'toml',
      '.ini': 'ini',
      '.conf': 'ini',
      '.dockerfile': 'dockerfile',
      '.vue': 'vue',
    };
    
    return languageMap[ext] || 'text';
  };

  const language = getLanguageFromExtension(fileName);

  // 简单的语法高亮样式
  const getCodeStyle = () => ({
    fontFamily: 'Monaco, Consolas, "Courier New", monospace',
    fontSize: '14px',
    lineHeight: '1.6',
    backgroundColor: '#f6f8fa',
    border: '1px solid #d9d9d9',
    borderRadius: '6px',
    padding: '20px',
    overflow: 'auto',
    maxHeight: 'calc(70vh - 40px)',
    color: '#24292e',
  });

  // 为不同语言添加基本的颜色标识
  const addBasicSyntaxHighlight = (code: string, lang: string): JSX.Element => {
    const lines = code.split('\n');
    
    return (
      <div>
        {lines.map((line, index) => (
          <div key={index} style={{ display: 'flex' }}>
            <span style={{ 
              color: '#8b949e', 
              fontSize: '12px', 
              marginRight: '16px',
              minWidth: '40px',
              textAlign: 'right',
              userSelect: 'none'
            }}>
              {index + 1}
            </span>
            <span style={{ flex: 1 }}>
              {highlightLine(line, lang)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const highlightLine = (line: string, lang: string): JSX.Element => {
    // 简单的关键字高亮
    const keywords: Record<string, string[]> = {
      javascript: ['function', 'const', 'let', 'var', 'if', 'else', 'for', 'while', 'return', 'class', 'extends', 'import', 'export'],
      typescript: ['function', 'const', 'let', 'var', 'if', 'else', 'for', 'while', 'return', 'class', 'extends', 'import', 'export', 'interface', 'type'],
      python: ['def', 'class', 'if', 'else', 'elif', 'for', 'while', 'return', 'import', 'from', 'try', 'except'],
      java: ['public', 'private', 'protected', 'class', 'interface', 'if', 'else', 'for', 'while', 'return', 'import', 'package'],
    };

    const langKeywords = keywords[lang] || [];
    
    // 检查是否是注释行
    const isComment = line.trim().startsWith('//') || line.trim().startsWith('#') || line.trim().startsWith('/*');
    
    if (isComment) {
      return <span style={{ color: '#6a737d', fontStyle: 'italic' }}>{line}</span>;
    }

    // 简单的关键字高亮
    let highlightedLine = line;
    langKeywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'g');
      highlightedLine = highlightedLine.replace(regex, `<span style="color: #d73a49; font-weight: bold;">${keyword}</span>`);
    });

    // 字符串高亮
    highlightedLine = highlightedLine.replace(
      /(["'])((?:\\.|(?!\1)[^\\])*?)\1/g,
      '<span style="color: #032f62;">$&</span>'
    );

    return <span dangerouslySetInnerHTML={{ __html: highlightedLine }} />;
  };

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ 
        marginBottom: '12px', 
        fontSize: '12px', 
        color: '#666',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        语言: {language.toUpperCase()} | 行数: {content.split('\n').length}
      </div>
      
      <div style={getCodeStyle()}>
        {addBasicSyntaxHighlight(content, language)}
      </div>
    </div>
  );
};

export default CodePreview;