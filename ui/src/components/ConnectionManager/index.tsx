import React, { useState, useEffect } from 'react';
import { message } from 'antd';
import { PlusOutlined, DragOutlined } from '@ant-design/icons';
import { DndContext, closestCenter, DragOverlay, defaultDropAnimationSideEffects } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

// 类型定义
import { ConnectionManagerProps, MODAL_TYPES, DirectoryItem } from './types';

// Hooks
import { useDirectories } from './hooks/useDirectories';
import { useDirectoryModal } from './hooks/useDirectoryModal';
import { useConnectionModal } from './hooks/useConnectionModal';
import { useDragAndDrop } from './hooks/useDragAndDrop';
import { useConnectionOperations } from './hooks/useConnectionOperations';

// 组件
import { Sidebar } from './components/Sidebar';
import { DraggableConnection } from './components/DraggableConnection';
import { DroppableDirectory } from './components/DroppableDirectory';
import { ConnectionModal } from './components/ConnectionModal';
import { DirectoryModal } from './components/DirectoryModal';

// 工具函数
import { getConnectionIcon } from './utils.tsx';

/**
 * 连接管理器主组件
 */
const ConnectionManager: React.FC<ConnectionManagerProps> = ({
  connections,
  currentConnection,
  onConnectionSelect,
  onConnectionsChange,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  // 目录管理
  const {
    directories,
    loadDirectories,
    saveDirectories,
    handleDirectoryToggle,
    handleDeleteDirectory,
  } = useDirectories(connections);

  // 目录模态框
  const {
    isDirectoryModalOpen,
    editingDirectory,
    directoryForm,
    handleAddDirectory,
    handleEditDirectory,
    closeDirectoryModal,
  } = useDirectoryModal();

  // 连接模态框
  const {
    modalConfig,
    form,
    openModal,
    closeModal,
  } = useConnectionModal(directories);

  // 拖拽功能
  const {
    activeConnection,
    sensors,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
  } = useDragAndDrop(connections, directories, saveDirectories);

  // 连接操作
  const {
    handleConnectionOperation,
    handleDeleteConnection,
  } = useConnectionOperations(
    modalConfig,
    directories,
    saveDirectories,
    onConnectionsChange,
    closeModal
  );

  // 目录操作处理
  const handleDirectoryOperation = async (values: any) => {
    try {
      if (editingDirectory) {
        // 编辑目录
        const newDirectories = directories.map(dir =>
          dir.id === editingDirectory.id
            ? { ...dir, name: values.name, connectionIds: values.connectionIds || [] }
            : dir
        );
        saveDirectories(newDirectories);
        message.success('目录编辑成功');
      } else {
        // 添加目录
        const newDirectory: DirectoryItem = {
          id: `dir_${Date.now()}`,
          name: values.name,
          connectionIds: values.connectionIds || [],
          expanded: true
        };
        saveDirectories([...directories, newDirectory]);
        message.success('目录添加成功');
      }
      closeDirectoryModal();
    } catch (error) {
      message.error('目录操作失败');
    }
  };

  // 拖拽动画配置
  const dropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: '0.5',
        },
      },
    }),
  };

  // 初始化时加载目录
  useEffect(() => {
    loadDirectories();
  }, [loadDirectories]);

  // 渲染展开状态的目录和连接列表
  const renderExpandedContent = () => (
    <div style={{ marginTop: '8px' }}>
      {directories.map((directory) => {
        const directoryConnections = connections
          .filter(conn => directory.connectionIds.includes(conn.id))
          .sort((a, b) => a.name.localeCompare(b.name)); // 按名称排序

        return (
          <div key={directory.id} style={{ marginBottom: '12px' }}>
            <DroppableDirectory
              directory={directory}
              onToggle={() => handleDirectoryToggle(directory.id)}
              onEdit={() => handleEditDirectory(directory)}
              onDelete={() => handleDeleteDirectory(directory.id)}
              onAddConnection={() => {
                // 打开新建连接模态框，并预选当前目录
                openModal(MODAL_TYPES.ADD);
                // 设置表单的目录字段
                setTimeout(() => {
                  form.setFieldsValue({ directoryId: directory.id });
                }, 100);
              }}
            >
              {directory.expanded && (
                <div style={{ paddingLeft: '8px', marginTop: '8px' }}>
                  <SortableContext
                    items={directoryConnections.map(conn => conn.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {directoryConnections.map((conn) => (
                      <div
                        key={conn.id}
                        onClick={() => onConnectionSelect(conn)}
                        style={{
                          marginBottom: '4px',
                          cursor: 'pointer',
                          borderRadius: '4px',
                          backgroundColor: currentConnection?.id === conn.id ? '#e6f7ff' : 'transparent',
                          border: currentConnection?.id === conn.id ? '1px solid #1890ff' : '1px solid transparent',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <DraggableConnection
                          connection={conn}
                          directoryId={directory.id}
                          onEdit={() => openModal(MODAL_TYPES.EDIT, conn)}
                          onCopy={() => openModal(MODAL_TYPES.COPY, conn)}
                          onDelete={() => handleDeleteConnection(conn.id)}
                        />
                      </div>
                    ))}
                  </SortableContext>
                </div>
              )}
            </DroppableDirectory>
          </div>
        );
      })}
      
      {/* 添加新目录按钮 */}
      <div 
        style={{ 
          padding: '8px',
          borderRadius: '4px',
          border: '1px dashed #d9d9d9',
          textAlign: 'center',
          color: '#666',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
        onClick={handleAddDirectory}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = '#1890ff';
          e.currentTarget.style.color = '#1890ff';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = '#d9d9d9';
          e.currentTarget.style.color = '#666';
        }}
      >
        <PlusOutlined /> 添加新目录
      </div>
    </div>
  );

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <Sidebar
          collapsed={collapsed}
          connections={connections}
          currentConnection={currentConnection}
          onConnectionSelect={onConnectionSelect}
          onConnectionsChange={onConnectionsChange}
          onToggleCollapse={() => setCollapsed(!collapsed)}
          onAddConnection={() => openModal(MODAL_TYPES.ADD)}
        >
          {renderExpandedContent()}
        </Sidebar>

        {/* 拖拽覆盖层 */}
        <DragOverlay dropAnimation={dropAnimation}>
          {activeConnection ? (
            <div style={{
              padding: '8px 12px',
              backgroundColor: '#fff',
              borderRadius: '6px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              border: '1px solid #d9d9d9',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              minWidth: '200px',
            }}>
              {getConnectionIcon(activeConnection.protocol_type)}
              <span style={{ fontWeight: 'medium' }}>{activeConnection.name}</span>
              <DragOutlined style={{ color: '#999', marginLeft: 'auto' }} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* 连接操作模态框 */}
      <ConnectionModal
        modalConfig={modalConfig}
        directories={directories}
        form={form}
        onFinish={handleConnectionOperation}
        onCancel={closeModal}
      />

      {/* 目录管理模态框 */}
      <DirectoryModal
        isOpen={isDirectoryModalOpen}
        editingDirectory={editingDirectory}
        connections={connections}
        form={directoryForm}
        onFinish={handleDirectoryOperation}
        onCancel={closeDirectoryModal}
      />
    </>
  );
};

export default ConnectionManager;
