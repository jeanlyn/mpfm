import React, { useState } from 'react';
import { Breadcrumb, Input, Space, Tooltip, message } from 'antd';
import { EditOutlined, FolderOutlined } from '@ant-design/icons';
import { useAppI18n } from '../../../i18n/hooks/useI18n';

interface BreadcrumbNavProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

/**
 * 面包屑导航组件
 */
const BreadcrumbNav: React.FC<BreadcrumbNavProps> = ({
  currentPath,
  onNavigate,
}) => {
  const { fileManager } = useAppI18n();
  const [isInputMode, setIsInputMode] = useState(false);
  const [inputPath, setInputPath] = useState('');

  // 处理点击面包屑区域切换到输入模式
  const handleBreadcrumbClick = () => {
    setInputPath(currentPath);
    setIsInputMode(true);
  };

  // 处理路径输入提交
  const handlePathSubmit = () => {
    if (!inputPath.trim()) {
      setIsInputMode(false);
      return;
    }

    // 简单的路径格式验证
    let normalizedPath = inputPath.trim();
    
    // 确保路径以 / 开头
    if (!normalizedPath.startsWith('/')) {
      normalizedPath = '/' + normalizedPath;
    }
    
    // 确保路径以 / 结尾（除非是根路径）
    if (normalizedPath !== '/' && !normalizedPath.endsWith('/')) {
      normalizedPath = normalizedPath + '/';
    }

    // 检查路径格式
    if (!/^\/[^<>:"|?*]*\/$|^\/$/.test(normalizedPath)) {
      message.error(fileManager.breadcrumb.invalidPath);
      return;
    }

    setIsInputMode(false);
    onNavigate(normalizedPath);
  };

  // 处理取消输入
  const handleInputCancel = () => {
    setIsInputMode(false);
    setInputPath('');
  };

  // 如果在输入模式，显示输入框
  if (isInputMode) {
    return (
      <div style={{ marginBottom: '16px' }}>
        <Input
          value={inputPath}
          onChange={(e) => setInputPath(e.target.value)}
          onPressEnter={handlePathSubmit}
          onBlur={handleInputCancel}
          placeholder={fileManager.breadcrumb.pathInputPlaceholder}
          prefix={<FolderOutlined />}
          style={{ width: '100%' }}
          autoFocus
        />
      </div>
    );
  }

  // 正常的面包屑导航模式
  return (
    <Tooltip title={fileManager.breadcrumb.pathInputTooltip} placement="bottom">
      <div 
        style={{ 
          marginBottom: '16px',
          padding: '4px 8px',
          borderRadius: '4px',
          border: '1px solid transparent',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
        onClick={handleBreadcrumbClick}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#f0f0f0';
          e.currentTarget.style.borderColor = '#d9d9d9';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.borderColor = 'transparent';
        }}
      >
        <Space size="small">
          <Breadcrumb>
            <Breadcrumb.Item onClick={(e) => {
              e.stopPropagation();
              onNavigate('/');
            }}>
              <span style={{ cursor: 'pointer' }}>
                {fileManager.breadcrumb.root}
              </span>
            </Breadcrumb.Item>
            {currentPath !== '/' && 
              currentPath.split('/').filter(part => part).map((part, index, array) => {
                const path = '/' + array.slice(0, index + 1).join('/') + '/';
                return (
                  <Breadcrumb.Item 
                    key={path}
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigate(path);
                    }}
                  >
                    <span style={{ cursor: 'pointer' }}>{part}</span>
                  </Breadcrumb.Item>
                );
              })
            }
          </Breadcrumb>
          <EditOutlined style={{ fontSize: '12px', color: '#8c8c8c' }} />
        </Space>
      </div>
    </Tooltip>
  );
};

export default BreadcrumbNav;
