import { invoke } from '@tauri-apps/api/tauri';
import { Connection, FileInfo, PaginatedFileList, ApiResponse } from '../types';

// 检测是否在 Tauri 环境中
const isTauriEnvironment = (): boolean => {
  return typeof window !== 'undefined' && window.__TAURI_IPC__ !== undefined;
};

// 模拟数据，用于浏览器环境下的演示
const mockConnections: Connection[] = [
  {
    id: 'mock-1',
    name: '本地文件系统',
    protocol_type: 'fs',
    config: { root: '/tmp' },
  },
  {
    id: 'mock-2', 
    name: 'S3存储桶',
    protocol_type: 's3',
    config: { bucket: 'demo-bucket', region: 'us-east-1' },
  }
];

export class ApiService {
  static async getConnections(): Promise<Connection[]> {
    if (!isTauriEnvironment()) {
      console.warn('Not in Tauri environment, returning mock data');
      return Promise.resolve(mockConnections);
    }
    
    try {
      const response: ApiResponse<Connection[]> = await invoke('get_connections');
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error(response.error || '获取连接失败');
    } catch (error) {
      console.error('Tauri invoke error:', error);
      throw new Error(`获取连接失败: ${error}`);
    }
  }

  static async addConnection(
    name: string,
    protocolType: string,
    config: Record<string, string>
  ): Promise<Connection> {
    if (!isTauriEnvironment()) {
      console.warn('Not in Tauri environment, simulating add connection');
      const newConnection: Connection = {
        id: `mock-${Date.now()}`,
        name,
        protocol_type: protocolType,
        config,
        created_at: new Date().toISOString(),
      };
      return Promise.resolve(newConnection);
    }

    try {
      const response: ApiResponse<Connection> = await invoke('add_connection', {
        name,
        protocolType,
        config,
      });
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error(response.error || '添加连接失败');
    } catch (error) {
      console.error('Tauri invoke error:', error);
      throw new Error(`添加连接失败: ${error}`);
    }
  }

  static async removeConnection(connectionId: string): Promise<void> {
    if (!isTauriEnvironment()) {
      console.warn('Not in Tauri environment, simulating remove connection');
      return Promise.resolve();
    }

    try {
      const response: ApiResponse<boolean> = await invoke('remove_connection', {
        connectionId,
      });
      if (!response.success) {
        throw new Error(response.error || '删除连接失败');
      }
    } catch (error) {
      console.error('Tauri invoke error:', error);
      throw new Error(`删除连接失败: ${error}`);
    }
  }

  static async listFiles(connectionId: string, path: string): Promise<FileInfo[]> {
    if (!isTauriEnvironment()) {
      console.warn('Not in Tauri environment, returning mock file list');
      const mockFiles: FileInfo[] = [
        {
          name: 'documents',
          path: path === '/' ? '/documents' : `${path}/documents`,
          is_dir: true,
          size: 0,
          modified: new Date().toISOString(),
        },
        {
          name: 'image.png',
          path: path === '/' ? '/image.png' : `${path}/image.png`,
          is_dir: false,
          size: 1024000,
          modified: new Date().toISOString(),
        },
        {
          name: 'data.json',
          path: path === '/' ? '/data.json' : `${path}/data.json`,
          is_dir: false,
          size: 2048,
          modified: new Date().toISOString(),
        }
      ];
      return Promise.resolve(mockFiles);
    }

    try {
      const response: ApiResponse<FileInfo[]> = await invoke('list_files', {
        connectionId,
        path,
      });
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error(response.error || '获取文件列表失败');
    } catch (error) {
      console.error('Tauri invoke error:', error);
      throw new Error(`获取文件列表失败: ${error}`);
    }
  }

  static async uploadFile(
    connectionId: string,
    localPath: string,
    remotePath: string
  ): Promise<void> {
    if (!isTauriEnvironment()) {
      console.warn('Not in Tauri environment, simulating file upload');
      return Promise.resolve();
    }

    try {
      const response: ApiResponse<boolean> = await invoke('upload_file', {
        connectionId,
        localPath,
        remotePath,
      });
      if (!response.success) {
        throw new Error(response.error || '上传文件失败');
      }
    } catch (error) {
      console.error('Tauri invoke error:', error);
      throw new Error(`上传文件失败: ${error}`);
    }
  }

  static async downloadFile(
    connectionId: string,
    remotePath: string,
    localPath: string
  ): Promise<void> {
    if (!isTauriEnvironment()) {
      console.warn('Not in Tauri environment, simulating file download');
      return Promise.resolve();
    }

    try {
      const response: ApiResponse<boolean> = await invoke('download_file', {
        connectionId,
        remotePath,
        localPath,
      });
      if (!response.success) {
        throw new Error(response.error || '下载文件失败');
      }
    } catch (error) {
      console.error('Tauri invoke error:', error);
      throw new Error(`下载文件失败: ${error}`);
    }
  }

  static async deleteFile(connectionId: string, path: string): Promise<void> {
    if (!isTauriEnvironment()) {
      console.warn('Not in Tauri environment, simulating file deletion');
      return Promise.resolve();
    }

    try {
      const response: ApiResponse<boolean> = await invoke('delete_file', {
        connectionId,
        path,
      });
      if (!response.success) {
        throw new Error(response.error || '删除文件失败');
      }
    } catch (error) {
      console.error('Tauri invoke error:', error);
      throw new Error(`删除文件失败: ${error}`);
    }
  }

  static async createDirectory(connectionId: string, path: string): Promise<void> {
    if (!isTauriEnvironment()) {
      console.warn('Not in Tauri environment, simulating directory creation');
      return Promise.resolve();
    }

    try {
      const response: ApiResponse<boolean> = await invoke('create_directory', {
        connectionId,
        path,
      });
      if (!response.success) {
        throw new Error(response.error || '创建目录失败');
      }
    } catch (error) {
      console.error('Tauri invoke error:', error);
      throw new Error(`创建目录失败: ${error}`);
    }
  }

  static async listFilesPaginated(
    connectionId: string, 
    path: string, 
    page: number = 0, 
    pageSize: number = 50
  ): Promise<PaginatedFileList> {
    if (!isTauriEnvironment()) {
      console.warn('Not in Tauri environment, returning mock paginated file list');
      
      // 生成更多模拟数据来测试分页
      const mockFiles: FileInfo[] = [];
      for (let i = 0; i < 150; i++) {
        mockFiles.push({
          name: `file_${i.toString().padStart(3, '0')}.txt`,
          path: path === '/' ? `/file_${i.toString().padStart(3, '0')}.txt` : `${path}/file_${i.toString().padStart(3, '0')}.txt`,
          is_dir: i % 10 === 0, // 每10个文件中有一个目录
          size: i % 10 === 0 ? undefined : Math.floor(Math.random() * 1000000),
          modified: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        });
      }
      
      const start = page * pageSize;
      const end = start + pageSize;
      const paginatedFiles = mockFiles.slice(start, end);
      
      return Promise.resolve({
        files: paginatedFiles,
        total: mockFiles.length,
        page,
        page_size: pageSize,
        has_more: end < mockFiles.length,
      });
    }

    try {
      const response: ApiResponse<PaginatedFileList> = await invoke('list_files_paginated', {
        connectionId,
        path,
        page,
        pageSize,
      });
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error(response.error || '获取分页文件列表失败');
    } catch (error) {
      console.error('Tauri invoke error:', error);
      throw new Error(`获取分页文件列表失败: ${error}`);
    }
  }

  static async getDirectoryCount(connectionId: string, path: string): Promise<number> {
    if (!isTauriEnvironment()) {
      console.warn('Not in Tauri environment, returning mock count');
      return Promise.resolve(150); // 模拟150个文件
    }

    try {
      const response: ApiResponse<number> = await invoke('get_directory_count', {
        connectionId,
        path,
      });
      if (response.success && response.data !== undefined) {
        return response.data;
      }
      throw new Error(response.error || '获取目录文件数失败');
    } catch (error) {
      console.error('Tauri invoke error:', error);
      throw new Error(`获取目录文件数失败: ${error}`);
    }
  }
}
