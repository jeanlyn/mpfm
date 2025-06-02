import { useState, useCallback } from 'react';
import { Form } from 'antd';
import { DirectoryItem } from '../types';

/**
 * 目录模态框管理Hook
 */
export const useDirectoryModal = () => {
  const [isDirectoryModalOpen, setIsDirectoryModalOpen] = useState(false);
  const [editingDirectory, setEditingDirectory] = useState<DirectoryItem | null>(null);
  const [directoryForm] = Form.useForm();

  const handleAddDirectory = useCallback(() => {
    setEditingDirectory(null);
    setIsDirectoryModalOpen(true);
    directoryForm.resetFields();
  }, [directoryForm]);

  const handleEditDirectory = useCallback((directory: DirectoryItem) => {
    setEditingDirectory(directory);
    setIsDirectoryModalOpen(true);
    directoryForm.setFieldsValue({
      name: directory.name,
      connectionIds: directory.connectionIds
    });
  }, [directoryForm]);

  const closeDirectoryModal = useCallback(() => {
    setIsDirectoryModalOpen(false);
    setEditingDirectory(null);
    directoryForm.resetFields();
  }, [directoryForm]);

  return {
    isDirectoryModalOpen,
    setIsDirectoryModalOpen,
    editingDirectory,
    setEditingDirectory,
    directoryForm,
    handleAddDirectory,
    handleEditDirectory,
    closeDirectoryModal,
  };
};
