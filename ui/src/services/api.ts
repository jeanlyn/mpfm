import { invoke } from '@tauri-apps/api/core';
import { Connection, FileInfo, PaginatedFileList, ApiResponse, CopyResultSummary } from '../types';
import { listenUploadProgress, UploadProgress } from '../utils/uploadProgress';

export interface EditFileResult {
  changed: boolean;
  uploaded: boolean;
  syncCount: number;
  editorName: string;
}

export interface DetectedEditor {
  name: string;
  path: string;
}

// 检测是否在 Tauri 环境中
const isTauriEnvironment = (): boolean => {
  return true;
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
  },
  {
    id: 'mock-3',
    name: 'FTP服务器',
    protocol_type: 'ftp',
    config: { host: 'ftp.example.com', port: '21', username: 'demo', password: 'demo', root_dir: '/' },
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

  static async reloadConnections(): Promise<Connection[]> {
    if (!isTauriEnvironment()) {
      console.warn('Not in Tauri environment, returning mock data');
      return Promise.resolve(mockConnections);
    }

    try {
      const response: ApiResponse<Connection[]> = await invoke('reload_connections');
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error(response.error || '刷新连接失败');
    } catch (error) {
      console.error('Tauri invoke error:', error);
      throw new Error(`刷新连接失败: ${error}`);
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

  static async copyConnection(connectionId: string, newName: string): Promise<Connection> {
    if (!isTauriEnvironment()) {
      console.warn('Not in Tauri environment, simulating copy connection');
      const mockConnection: Connection = {
        id: `mock-copy-${Date.now()}`,
        name: newName,
        protocol_type: 's3',
        config: {},
        created_at: new Date().toISOString(),
      };
      return Promise.resolve(mockConnection);
    }

    try {
      const response: ApiResponse<Connection> = await invoke('copy_connection', {
        connectionId,
        newName,
      });
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error(response.error || '复制连接失败');
    } catch (error) {
      console.error('Tauri invoke error:', error);
      throw new Error(`复制连接失败: ${error}`);
    }
  }

  static async checkS3BucketExists(
    bucket: string,
    region: string,
    endpoint: string | null,
    accessKey: string,
    secretKey: string
  ): Promise<boolean> {
    if (!isTauriEnvironment()) {
      console.warn('Not in Tauri environment, simulating bucket check');
      return Promise.resolve(false); // 模拟 bucket 不存在
    }

    try {
      const response: ApiResponse<boolean> = await invoke('check_s3_bucket_exists', {
        bucket,
        region,
        endpoint,
        accessKey,
        secretKey,
      });
      if (response.success && response.data !== undefined) {
        return response.data;
      }
      throw new Error(response.error || '检查 bucket 失败');
    } catch (error) {
      console.error('Tauri invoke error:', error);
      throw new Error(`检查 bucket 失败: ${error}`);
    }
  }

  static async createS3Bucket(
    bucket: string,
    region: string,
    endpoint: string | null,
    accessKey: string,
    secretKey: string
  ): Promise<boolean> {
    if (!isTauriEnvironment()) {
      console.warn('Not in Tauri environment, simulating bucket creation');
      return Promise.resolve(true); // 模拟创建成功
    }

    try {
      const response: ApiResponse<boolean> = await invoke('create_s3_bucket', {
        bucket,
        region,
        endpoint,
        accessKey,
        secretKey,
      });
      if (response.success && response.data !== undefined) {
        return response.data;
      }
      throw new Error(response.error || '创建 bucket 失败');
    } catch (error) {
      console.error('Tauri invoke error:', error);
      throw new Error(`创建 bucket 失败: ${error}`);
    }
  }

  static async listS3Buckets(
    region: string,
    endpoint: string | null,
    accessKey: string,
    secretKey: string
  ): Promise<string[]> {
    if (!isTauriEnvironment()) {
      console.warn('Not in Tauri environment, returning mock bucket list');
      return Promise.resolve(['demo-bucket', 'test-bucket']);
    }

    try {
      const response: ApiResponse<string[]> = await invoke('list_s3_buckets', {
        region,
        endpoint,
        accessKey,
        secretKey,
      });
      if (response.success && response.data !== undefined) {
        return response.data;
      }
      throw new Error(response.error || '列举 bucket 失败');
    } catch (error) {
      console.error('Tauri invoke error:', error);
      throw new Error(`列举 bucket 失败: ${error}`);
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

  static async checkFileExists(
    connectionId: string,
    path: string
  ): Promise<{ exists: boolean; isDir: boolean }> {
    if (!isTauriEnvironment()) {
      return { exists: false, isDir: false };
    }

    try {
      const response: ApiResponse<{ exists: boolean; isDir: boolean }> = await invoke(
        'check_file_exists',
        { connectionId, path }
      );
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error(response.error || '检查文件是否存在失败');
    } catch (error) {
      console.error('Tauri invoke error:', error);
      throw new Error(`检查文件是否存在失败: ${error}`);
    }
  }

  static async uploadFile(
    connectionId: string,
    localPath: string,
    remotePath: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<void> {
    if (!isTauriEnvironment()) {
      console.warn('Not in Tauri environment, simulating file upload');
      return Promise.resolve();
    }

    const unlisten = onProgress
      ? await listenUploadProgress(onProgress)
      : null;

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
    } finally {
      if (unlisten) {
        await unlisten();
      }
    }
  }

  static async uploadDirectory(
    connectionId: string,
    localDirPath: string,
    remoteBasePath: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<number> {
    if (!isTauriEnvironment()) {
      console.warn('Not in Tauri environment, simulating directory upload');
      return Promise.resolve(0);
    }

    const unlisten = onProgress
      ? await listenUploadProgress(onProgress)
      : null;

    try {
      const response: ApiResponse<number> = await invoke('upload_directory', {
        connectionId,
        localDirPath,
        remoteBasePath,
      });
      if (!response.success) {
        throw new Error(response.error || '上传目录失败');
      }
      return response.data || 0;
    } catch (error) {
      console.error('Tauri invoke error:', error);
      throw new Error(`上传目录失败: ${error}`);
    } finally {
      if (unlisten) {
        await unlisten();
      }
    }
  }

  /**
   * 取消指定上传。置位取消标志后，后端上传循环在下一个分块检查点中止上传。
   */
  static async cancelUpload(uploadId: string): Promise<void> {
    if (!isTauriEnvironment()) {
      console.warn('Not in Tauri environment, simulating cancel upload');
      return Promise.resolve();
    }

    try {
      await invoke('cancel_upload', { uploadId });
    } catch (error) {
      console.error('Tauri invoke error:', error);
      throw new Error(`取消上传失败: ${error}`);
    }
  }

  static async copyFilesBetweenConnections(
    sourceConnectionId: string,
    sourcePaths: string[],
    targetConnectionId: string,
    targetBasePath: string,
    overwrite: boolean,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<CopyResultSummary> {
    if (!isTauriEnvironment()) {
      console.warn('Not in Tauri environment, simulating cross-connection copy');
      return Promise.resolve({ copied: sourcePaths.length, failed: 0, total: sourcePaths.length });
    }

    const unlisten = onProgress
      ? await listenUploadProgress(onProgress)
      : null;

    try {
      const response: ApiResponse<CopyResultSummary> = await invoke('copy_files_between_connections', {
        sourceConnectionId,
        sourcePaths,
        targetConnectionId,
        targetBasePath,
        overwrite,
      });
      if (!response.success) {
        throw new Error(response.error || '跨连接复制失败');
      }
      return response.data ?? { copied: 0, failed: 0, total: 0 };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('Tauri invoke error:', message);
      throw new Error(message);
    } finally {
      if (unlisten) {
        await unlisten();
      }
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
      if (error instanceof Error && error.message.includes('下载文件失败')) {
        throw error;
      }
      console.error('Tauri invoke error:', error);
      throw error;
    }
  }

  static async editFileWithLocalEditor(
    connectionId: string,
    remotePath: string,
    editorPath?: string
  ): Promise<EditFileResult> {
    try {
      const response: ApiResponse<EditFileResult> = await invoke(
        'edit_file_with_local_editor',
        {
          connectionId,
          remotePath,
          editorPath: editorPath?.trim() || null,
        }
      );
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error(response.error || '本地编辑失败');
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(String(error));
    }
  }

  static async detectLocalEditors(): Promise<DetectedEditor[]> {
    try {
      const response: ApiResponse<DetectedEditor[]> = await invoke('detect_local_editors');
      if (response.success) {
        return response.data || [];
      }
      throw new Error(response.error || '检测本地编辑器失败');
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(String(error));
    }
  }

  static async listLocalApplications(): Promise<DetectedEditor[]> {
    try {
      const response: ApiResponse<DetectedEditor[]> = await invoke('list_local_applications');
      if (response.success) {
        return response.data || [];
      }
      throw new Error(response.error || '读取本机应用失败');
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(String(error));
    }
  }

  static async inspectLocalEditor(path: string): Promise<DetectedEditor> {
    try {
      const response: ApiResponse<DetectedEditor> = await invoke('inspect_local_editor', {
        path,
      });
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error(response.error || '选择的编辑器不可用');
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(String(error));
    }
  }

  static async buildDownloadCommand(
    connectionId: string,
    remotePath: string,
    targetShell: 'bash' | 'powershell'
  ): Promise<string> {
    if (!isTauriEnvironment()) {
      console.warn('Not in Tauri environment, returning mock download command');
      return Promise.resolve(
        `main_cli download --connection '${connectionId}' '${remotePath}' './${remotePath.split('/').pop() || 'downloaded-file'}'`
      );
    }

    try {
      const response: ApiResponse<string> = await invoke('build_download_command', {
        connectionId,
        remotePath,
        targetShell,
      });
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error(response.error || 'Failed to build download command');
    } catch (error) {
      console.error('Tauri invoke error:', error);
      throw new Error(`Failed to build download command: ${error}`);
    }
  }

  static async buildDownloadCurlCommand(
    connectionId: string,
    remotePath: string
  ): Promise<string> {
    if (!isTauriEnvironment()) {
      console.warn('Not in Tauri environment, returning mock curl download command');
      const fileName = remotePath.split('/').pop() || 'downloaded-file';
      return Promise.resolve(
        `curl -L 'https://example.com/${fileName}' -o './${fileName}'`
      );
    }

    try {
      const response: ApiResponse<string> = await invoke('build_download_curl_command', {
        connectionId,
        remotePath,
      });
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error(response.error || 'Failed to build curl download command');
    } catch (error) {
      console.error('Tauri invoke error:', error);
      throw new Error(`Failed to build curl download command: ${error}`);
    }
  }

  static async copyTextToClipboard(text: string): Promise<void> {
    if (!isTauriEnvironment()) {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard API unavailable');
      }
      await navigator.clipboard.writeText(text);
      return;
    }

    try {
      const response: ApiResponse<boolean> = await invoke('copy_text_to_clipboard', {
        text,
      });
      if (!response.success) {
        throw new Error(response.error || 'Failed to copy to clipboard');
      }
    } catch (error) {
      console.error('Tauri invoke error:', error);
      throw new Error(`Failed to copy to clipboard: ${error}`);
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

  // 搜索文件（支持模糊匹配文件名）
  static async searchFiles(
    connectionId: string, 
    path: string, 
    query: string,
    page: number = 0,
    pageSize: number = 50
  ): Promise<PaginatedFileList> {
    if (!isTauriEnvironment()) {
      console.warn('Not in Tauri environment, returning mock search results');
      
      // 模拟搜索结果
      const allMockFiles: FileInfo[] = [];
      for (let i = 0; i < 50; i++) {
        const fileName = `search_result_${i.toString().padStart(3, '0')}.txt`;
        if (fileName.toLowerCase().includes(query.toLowerCase())) {
          allMockFiles.push({
            name: fileName,
            path: path === '/' ? `/${fileName}` : `${path}/${fileName}`,
            is_dir: i % 15 === 0,
            size: i % 15 === 0 ? undefined : Math.floor(Math.random() * 1000000),
            modified: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
          });
        }
      }
      
      const start = page * pageSize;
      const end = start + pageSize;
      const paginatedFiles = allMockFiles.slice(start, end);
      
      return Promise.resolve({
        files: paginatedFiles,
        total: allMockFiles.length,
        page,
        page_size: pageSize,
        has_more: end < allMockFiles.length,
      });
    }

    try {
      const response: ApiResponse<PaginatedFileList> = await invoke('search_files', {
        connectionId,
        path,
        query,
        page,
        pageSize,
      });
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error(response.error || '搜索文件失败');
    } catch (error) {
      console.error('Tauri invoke error:', error);
      throw new Error(`搜索文件失败: ${error}`);
    }
  }

  // 更新连接配置
  static async updateConnection(
    connectionId: string,
    name: string,
    protocolType: string,
    config: Record<string, string>
  ): Promise<Connection> {
    if (!isTauriEnvironment()) {
      console.warn('Not in Tauri environment, simulating update connection');
      const updatedConnection: Connection = {
        id: connectionId,
        name,
        protocol_type: protocolType,
        config,
        created_at: new Date().toISOString(),
      };
      return Promise.resolve(updatedConnection);
    }

    try {
      const response: ApiResponse<Connection> = await invoke('update_connection', {
        connectionId,
        name,
        protocolType,
        config,
      });
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error(response.error || '更新连接失败');
    } catch (error) {
      console.error('Tauri invoke error:', error);
      throw new Error(`更新连接失败: ${error}`);
    }
  }

  // 获取文件内容用于预览
  static async getFileContent(
    connectionId: string, 
    path: string, 
    type: 'text' | 'binary' = 'text'
  ): Promise<string | ArrayBuffer> {
    if (!isTauriEnvironment()) {
      console.warn('Not in Tauri environment, returning mock file content');
      
      if (type === 'binary') {
        // 模拟二进制数据（1x1像素的PNG图片）
        const mockImageData = new Uint8Array([
          0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
          0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
          0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
          0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8, 0x0F, 0x00, 0x00,
          0x01, 0x00, 0x01, 0x5C, 0xCF, 0x80, 0x64, 0x00, 0x00, 0x00, 0x00, 0x49,
          0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
        ]);
        return Promise.resolve(mockImageData.buffer);
      } else {
        // 根据文件扩展名返回不同的模拟内容
        const fileName = path.split('/').pop() || '';
        const ext = fileName.toLowerCase().split('.').pop();
        
        let mockContent = '';
        switch (ext) {
          case 'json':
            mockContent = `{
  "name": "示例文件",
  "type": "演示数据",
  "items": [
    {"id": 1, "title": "项目1", "completed": false},
    {"id": 2, "title": "项目2", "completed": true}
  ],
  "metadata": {
    "created": "2024-01-01",
    "version": "1.0"
  }
}`;
            break;
          case 'js':
          case 'jsx':
            mockContent = `// JavaScript 示例文件
function greet(name) {
  console.log('Hello, ' + name + '!');
}

const users = [
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' }
];

export { greet, users };`;
            break;
          case 'py':
            mockContent = `# Python 示例文件
def hello_world():
    print("Hello, World!")

class Calculator:
    def add(self, a, b):
        return a + b
    
    def multiply(self, a, b):
        return a * b

if __name__ == "__main__":
    calc = Calculator()
    result = calc.add(2, 3)
    print(f"2 + 3 = {result}")`;
            break;
          default:
            mockContent = `这是一个示例文本文件的内容。
文件名: ${fileName}
路径: ${path}

这里可以是任何类型的文本内容，比如：
- 配置文件
- 日志文件  
- 说明文档
- 代码文件

当前时间: ${new Date().toLocaleString()}
文件大小: 模拟数据`;
        }
        return Promise.resolve(mockContent);
      }
    }

    try {
      const response: ApiResponse<string | number[]> = await invoke('get_file_content', {
        connectionId,
        path,
        type,
      });
      if (response.success && response.data !== undefined) {
        if (type === 'binary' && Array.isArray(response.data)) {
          // 将数字数组转换为 ArrayBuffer
          const uint8Array = new Uint8Array(response.data);
          return uint8Array.buffer;
        }
        return response.data as string;
      }
      throw new Error(response.error || '获取文件内容失败');
    } catch (error) {
      console.error('Tauri invoke error:', error);
      throw new Error(`获取文件内容失败: ${error}`);
    }
  }

  // 批量下载文件并打包成ZIP
  static async batchDownloadFiles(
    connectionId: string,
    filePaths: string[],
    savePath: string,
    onProgress?: (current: number, total: number, currentFile: string) => void
  ): Promise<void> {
    if (!isTauriEnvironment()) {
      console.warn('Not in Tauri environment, simulating batch download');
      
      // 模拟下载进度
      const total = filePaths.length;
      for (let i = 0; i < total; i++) {
        await new Promise(resolve => setTimeout(resolve, 500)); // 模拟下载延迟
        onProgress?.(i + 1, total, filePaths[i]);
      }
      return Promise.resolve();
    }

    try {
      const response: ApiResponse<boolean> = await invoke('batch_download_files', {
        connectionId,
        filePaths,
        savePath,
        // 注意：进度回调需要通过事件系统实现，这里先简化处理
      });

      if (!response.success) {
        throw new Error(response.error || '批量下载失败');
      }
    } catch (error) {
      console.error('Tauri invoke error:', error);
      throw new Error(`批量下载失败: ${error}`);
    }
  }

  // 递归列出目录下的所有文件
  static async listFilesRecursive(connectionId: string, path: string): Promise<string[]> {
    if (!isTauriEnvironment()) {
      console.warn('Not in Tauri environment, returning empty file list');
      return [];
    }

    try {
      const response: ApiResponse<string[]> = await invoke('list_files_recursive', {
        connectionId,
        path,
      });

      if (!response.success) {
        throw new Error(response.error || '递归列出文件失败');
      }

      return response.data || [];
    } catch (error) {
      console.error('Tauri invoke error:', error);
      throw new Error(`递归列出文件失败: ${error}`);
    }
  }

  static async getDiagnosticsReport(): Promise<{ report: string; logPath: string | null }> {
    if (!isTauriEnvironment()) {
      return {
        report: 'MPFM Diagnostics Report\n(Demo mode - no backend logs available)\n',
        logPath: null,
      };
    }

    try {
      const response: ApiResponse<{ report: string; logPath: string | null }> =
        await invoke('get_diagnostics_report');
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error(response.error || '获取诊断信息失败');
    } catch (error) {
      console.error('Tauri invoke error:', error);
      throw new Error(`获取诊断信息失败: ${error}`);
    }
  }

  static async exportDiagnosticsReport(path: string): Promise<string> {
    if (!isTauriEnvironment()) {
      throw new Error('Not in Tauri environment');
    }

    try {
      const response: ApiResponse<string> = await invoke('export_diagnostics_report', { path });
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error(response.error || '导出诊断信息失败');
    } catch (error) {
      console.error('Tauri invoke error:', error);
      throw new Error(`导出诊断信息失败: ${error}`);
    }
  }
}
