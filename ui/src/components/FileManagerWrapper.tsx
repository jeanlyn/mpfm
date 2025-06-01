import React, { useState } from 'react';
import { Button, Space, Tooltip, Switch } from 'antd';
import { ThunderboltOutlined, AppstoreOutlined } from '@ant-design/icons';
import { Connection } from '../types';

// 导入两个版本的文件管理器
import FileManager from './FileManager';
import AdvancedFileManager from './AdvancedFileManager';

interface FileManagerWrapperProps {
  connection: Connection | null;
  useAdvancedMode?: boolean;
}

const FileManagerWrapper: React.FC<FileManagerWrapperProps> = ({ 
  connection, 
  useAdvancedMode = true // 默认使用高级模式
}) => {
  const [isAdvanced, setIsAdvanced] = useState(useAdvancedMode);

  return (
    <div>
      {/* 模式切换控制栏 */}
      <div style={{ 
        padding: '12px 24px', 
        backgroundColor: '#f5f5f5', 
        borderBottom: '1px solid #d9d9d9',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <Space>
          <span style={{ fontWeight: 'bold', color: '#666' }}>文件管理器模式:</span>
          <Switch
            checked={isAdvanced}
            onChange={setIsAdvanced}
            checkedChildren={
              <Space size={4}>
                <ThunderboltOutlined />
                <span>高级</span>
              </Space>
            }
            unCheckedChildren={
              <Space size={4}>
                <AppstoreOutlined />
                <span>基础</span>
              </Space>
            }
            style={{ minWidth: '80px' }}
          />
        </Space>
        
        <Space>
          <Tooltip title="基础模式：简单易用，适合日常文件操作">
            <Button size="small" type={!isAdvanced ? 'primary' : 'default'} onClick={() => setIsAdvanced(false)}>
              基础模式
            </Button>
          </Tooltip>
          <Tooltip title="高级模式：虚拟滚动、无限加载，适合大量文件处理">
            <Button size="small" type={isAdvanced ? 'primary' : 'default'} onClick={() => setIsAdvanced(true)}>
              高级模式
            </Button>
          </Tooltip>
        </Space>
      </div>
      
      {/* 根据模式渲染对应的文件管理器 */}
      {isAdvanced ? (
        <AdvancedFileManager connection={connection} />
      ) : (
        <FileManager connection={connection} />
      )}
    </div>
  );
};

export default FileManagerWrapper;