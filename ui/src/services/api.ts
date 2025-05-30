import { invoke } from '@tauri-apps/api/tauri';
import { Connection, FileInfo, ApiResponse } from '../types';

export class ApiService {
  static async getConnections(): Promise<Connection[]> {
    const response: ApiResponse<Connection[]> = await invoke('get_connections');
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.error || '获取连接失败');
  }

  static async addConnection(
    name: string,
    protocolType: string,
    config: Record<string, string>
  ): Promise<Connection> {
    const response: ApiResponse<Connection> = await invoke('add_connection', {
      name,
      protocolType,
      config,
    });
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.error || '添加连接失败');
  }

  static async removeConnection(connectionId: string): Promise<void> {
    const response: ApiResponse<boolean> = await invoke('remove_connection', {
      connectionId,
    });
    if (!response.success) {
      throw new Error(response.error || '删除连接失败');
    }
  }

  static async listFiles(connectionId: string, path: string): Promise<FileInfo[]> {
    const response: ApiResponse<FileInfo[]> = await invoke('list_files', {
      connectionId,
      path,
    });
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.error || '获取文件列表失败');
  }

  static async uploadFile(
    connectionId: string,
    localPath: string,
    remotePath: string
  ): Promise<void> {
    const response: ApiResponse<boolean> = await invoke('upload_file', {
      connectionId,
      localPath,
      remotePath,
    });
    if (!response.success) {
      throw new Error(response.error || '上传文件失败');
    }
  }

  static async downloadFile(
    connectionId: string,
    remotePath: string,
    localPath: string
  ): Promise<void> {
    const response: ApiResponse<boolean> = await invoke('download_file', {
      connectionId,
      remotePath,
      localPath,
    });
    if (!response.success) {
      throw new Error(response.error || '下载文件失败');
    }
  }

  static async deleteFile(connectionId: string, path: string): Promise<void> {
    const response: ApiResponse<boolean> = await invoke('delete_file', {
      connectionId,
      path,
    });
    if (!response.success) {
      throw new Error(response.error || '删除文件失败');
    }
  }

  static async createDirectory(connectionId: string, path: string): Promise<void> {
    const response: ApiResponse<boolean> = await invoke('create_directory', {
      connectionId,
      path,
    });
    if (!response.success) {
      throw new Error(response.error || '创建目录失败');
    }
  }
}
