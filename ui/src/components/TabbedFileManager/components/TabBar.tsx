import React, { useEffect, useRef } from 'react';
import { Tabs, Dropdown, Button } from 'antd';
import { CloseOutlined, MoreOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { FileManagerTab } from '../hooks/useTabManager';

interface TabBarProps {
  tabs: FileManagerTab[];
  activeTabId: string | null;
  onTabClick: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onCloseAll: () => void;
  onCloseOthers: (tabId: string) => void;
}

/**
 * Tab栏组件
 * 显示所有打开的连接Tab，支持切换、关闭等操作
 */
const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  onTabClick,
  onTabClose,
  onCloseAll,
  onCloseOthers,
}) => {
  const tabsRef = useRef<HTMLDivElement>(null);

  // 当活动标签改变时，滚动到可见区域
  useEffect(() => {
    if (activeTabId && tabsRef.current) {
      const activeTabElement = tabsRef.current.querySelector(`[data-node-key="${activeTabId}"]`);
      if (activeTabElement) {
        activeTabElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center'
        });
      }
    }
  }, [activeTabId]);

  // 添加鼠标滚轮支持和滚动阴影
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (tabsRef.current) {
        const navWrap = tabsRef.current.querySelector('.ant-tabs-nav-wrap') as HTMLElement;
        if (navWrap && navWrap.contains(e.target as Node)) {
          e.preventDefault();
          navWrap.scrollLeft += e.deltaY;
        }
      }
    };

    const updateScrollShadows = () => {
      if (tabsRef.current) {
        const navWrap = tabsRef.current.querySelector('.ant-tabs-nav-wrap') as HTMLElement;
        if (navWrap) {
          const { scrollLeft, scrollWidth, clientWidth } = navWrap;
          const hasScrollLeft = scrollLeft > 0;
          const hasScrollRight = scrollLeft < scrollWidth - clientWidth - 1;
          
          tabsRef.current.classList.toggle('has-scroll-left', hasScrollLeft);
          tabsRef.current.classList.toggle('has-scroll-right', hasScrollRight);
        }
      }
    };

    const tabContainer = tabsRef.current;
    if (tabContainer) {
      const navWrap = tabContainer.querySelector('.ant-tabs-nav-wrap') as HTMLElement;
      
      tabContainer.addEventListener('wheel', handleWheel, { passive: false });
      
      if (navWrap) {
        navWrap.addEventListener('scroll', updateScrollShadows);
        // 初始检查
        updateScrollShadows();
        // 监听窗口大小变化
        const resizeObserver = new ResizeObserver(updateScrollShadows);
        resizeObserver.observe(navWrap);
        
        return () => {
          tabContainer.removeEventListener('wheel', handleWheel);
          navWrap.removeEventListener('scroll', updateScrollShadows);
          resizeObserver.disconnect();
        };
      }
    }
  }, [tabs.length]); // 依赖标签数量变化
  // 生成Tab项
  const tabItems = tabs.map(tab => {
    // 为每个Tab创建右键菜单
    const contextMenu: MenuProps = {
      items: [
        {
          key: 'close',
          label: '关闭',
          onClick: () => onTabClose(tab.id),
        },
        {
          key: 'closeOthers',
          label: '关闭其他',
          disabled: tabs.length <= 1,
          onClick: () => onCloseOthers(tab.id),
        },
        {
          key: 'closeAll',
          label: '关闭所有',
          onClick: () => onCloseAll(),
        },
      ],
    };

    return {
      key: tab.id,
      label: (
        <Dropdown menu={contextMenu} trigger={['contextMenu']}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              maxWidth: '160px',
              minWidth: '80px',
              cursor: 'pointer',
            }}
          >
            <span
              style={{
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={tab.title}
            >
              {tab.title}
            </span>
            <CloseOutlined
              className="tab-close-btn"
              style={{
                fontSize: '12px',
                padding: '2px',
                borderRadius: '2px',
                color: '#999',
              }}
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(tab.id);
              }}
            />
          </div>
        </Dropdown>
      ),
      closable: false, // 我们自己处理关闭
    };
  });

  // Tab操作菜单
  const tabOperationsMenu: MenuProps = {
    items: [
      {
        key: 'closeAll',
        label: '关闭所有Tab',
        disabled: tabs.length === 0,
        onClick: () => onCloseAll(),
      },
    ],
  };

  if (tabs.length === 0) {
    return (
      <div className="empty-state">
        请从左侧选择连接来打开文件管理器
      </div>
    );
  }

  return (
    <div className="tab-bar" style={{ display: 'flex', alignItems: 'center' }}>
      <style>{`
        .scrollable-tab-container {
          flex: 1;
          overflow: hidden;
          position: relative;
        }
        
        /* 滚动阴影指示器 */
        .scrollable-tab-container::before,
        .scrollable-tab-container::after {
          content: '';
          position: absolute;
          top: 0;
          bottom: 6px;
          width: 20px;
          pointer-events: none;
          z-index: 10;
          transition: opacity 0.3s ease;
        }
        
        .scrollable-tab-container::before {
          left: 0;
          background: linear-gradient(to right, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0) 100%);
          opacity: 0;
        }
        
        .scrollable-tab-container::after {
          right: 0;
          background: linear-gradient(to left, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0) 100%);
          opacity: 0;
        }
        
        .scrollable-tab-container.has-scroll-left::before {
          opacity: 1;
        }
        
        .scrollable-tab-container.has-scroll-right::after {
          opacity: 1;
        }
        
        .scrollable-tab-container .ant-tabs {
          overflow: visible;
        }
        
        .scrollable-tab-container .ant-tabs-nav {
          margin: 0 !important;
        }
        
        .scrollable-tab-container .ant-tabs-nav-wrap {
          overflow-x: auto !important;
          overflow-y: hidden !important;
          scrollbar-width: thin;
          scrollbar-color: #1890ff #f5f5f5;
          scroll-behavior: smooth;
        }
        
        .scrollable-tab-container .ant-tabs-nav-list {
          display: flex !important;
          flex-wrap: nowrap !important;
          width: max-content !important;
        }
        
        .scrollable-tab-container .ant-tabs-tab {
          flex-shrink: 0 !important;
        }
        
        .scrollable-tab-container .ant-tabs-nav-operations {
          display: none !important;
        }
        
        /* 简化的滚动条样式 */
        .scrollable-tab-container .ant-tabs-nav-wrap::-webkit-scrollbar {
          height: 6px;
        }
        
        .scrollable-tab-container .ant-tabs-nav-wrap::-webkit-scrollbar-track {
          background: #f5f5f5;
          border-radius: 3px;
        }
        
        .scrollable-tab-container .ant-tabs-nav-wrap::-webkit-scrollbar-thumb {
          background: #1890ff;
          border-radius: 3px;
          transition: background 0.2s ease;
        }
        
        .scrollable-tab-container .ant-tabs-nav-wrap::-webkit-scrollbar-thumb:hover {
          background: #096dd9;
        }
      `}</style>
      <div className="scrollable-tab-container" ref={tabsRef}>
        <Tabs
          type="card"
          size="small"
          activeKey={activeTabId || undefined}
          items={tabItems}
          onChange={onTabClick}
          tabBarGutter={2}
          hideAdd
          animated={false}
          style={{
            marginBottom: 0,
          }}
          tabBarStyle={{
            marginBottom: 0,
            paddingLeft: '8px',
          }}
        />
      </div>
      
      {/* Tab操作按钮 */}
      <div className="tab-operations">
        <Dropdown menu={tabOperationsMenu} placement="bottomRight">
          <Button
            icon={<MoreOutlined />}
            size="small"
            type="text"
            style={{ border: 'none' }}
          />
        </Dropdown>
      </div>
    </div>
  );
};

export default TabBar;
