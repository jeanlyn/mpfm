import React from 'react';
import { Breadcrumb } from 'antd';
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

  return (
    <Breadcrumb style={{ marginBottom: '16px' }}>
      <Breadcrumb.Item onClick={() => onNavigate('/')}>
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
              onClick={() => onNavigate(path)}
            >
              <span style={{ cursor: 'pointer' }}>{part}</span>
            </Breadcrumb.Item>
          );
        })
      }
    </Breadcrumb>
  );
};

export default BreadcrumbNav;
