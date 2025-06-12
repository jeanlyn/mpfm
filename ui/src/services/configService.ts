import { invoke } from '@tauri-apps/api/core';
import { ApiResponse } from '../types';

export interface ConfigService {
  saveConfig(key: string, data: any): Promise<void>;
  loadConfig<T>(key: string): Promise<T | null>;
  deleteConfig(key: string): Promise<void>;
  exportConfigs(keys: string[]): Promise<Record<string, any>>;
  importConfigs(configs: Record<string, any>): Promise<void>;
}

/**
 * Tauri 配置服务实现
 * 使用 Tauri 的文件系统 API 在应用配置目录中存储配置
 */
class TauriConfigService implements ConfigService {
  async saveConfig(key: string, data: any): Promise<void> {
    try {
      const response = await invoke('save_app_config', {
        key,
        data: JSON.stringify(data)
      }) as ApiResponse<boolean>;
      
      if (!response.success) {
        throw new Error(response.error || '保存配置失败');
      }
    } catch (error) {
      console.error('保存配置失败:', error);
      throw new Error(`保存配置失败: ${error}`);
    }
  }

  async loadConfig<T>(key: string): Promise<T | null> {
    try {
      const response = await invoke('load_app_config', { key }) as ApiResponse<string>;
      
      if (!response.success) {
        if (response.error?.includes('文件不存在') || response.error?.includes('不存在')) {
          return null;
        }
        throw new Error(response.error || '加载配置失败');
      }
      
      const data = response.data;
      if (!data || data.trim() === '') {
        return null;
      }
      
      return JSON.parse(data) as T;
    } catch (error) {
      console.error('加载配置失败:', error);
      if (error instanceof SyntaxError) {
        console.warn('配置文件格式错误，返回 null');
        return null;
      }
      throw new Error(`加载配置失败: ${error}`);
    }
  }

  async deleteConfig(key: string): Promise<void> {
    try {
      const response = await invoke('delete_app_config', { key }) as ApiResponse<boolean>;
      
      if (!response.success) {
        throw new Error(response.error || '删除配置失败');
      }
    } catch (error) {
      console.error('删除配置失败:', error);
      throw new Error(`删除配置失败: ${error}`);
    }
  }

  async exportConfigs(keys: string[]): Promise<Record<string, any>> {
    try {
      const response = await invoke('export_app_config', { keys }) as ApiResponse<Record<string, string>>;
      
      if (!response.success) {
        throw new Error(response.error || '导出配置失败');
      }
      
      const exportedData: Record<string, any> = {};
      for (const [key, jsonString] of Object.entries(response.data || {})) {
        try {
          exportedData[key] = JSON.parse(jsonString as string);
        } catch (e) {
          console.warn(`配置项 ${key} 解析失败:`, e);
        }
      }
      
      return exportedData;
    } catch (error) {
      console.error('导出配置失败:', error);
      throw new Error(`导出配置失败: ${error}`);
    }
  }

  async importConfigs(configs: Record<string, any>): Promise<void> {
    try {
      const configData: Record<string, string> = {};
      for (const [key, value] of Object.entries(configs)) {
        configData[key] = JSON.stringify(value);
      }
      
      const response = await invoke('import_app_config', { configData }) as ApiResponse<boolean>;
      
      if (!response.success) {
        throw new Error(response.error || '导入配置失败');
      }
    } catch (error) {
      console.error('导入配置失败:', error);
      throw new Error(`导入配置失败: ${error}`);
    }
  }
}

/**
 * localStorage 配置服务实现（用于浏览器环境或开发模式）
 */
class LocalStorageConfigService implements ConfigService {
  private getKey(key: string): string {
    return `mpfm_config_${key}`;
  }

  async saveConfig(key: string, data: any): Promise<void> {
    try {
      localStorage.setItem(this.getKey(key), JSON.stringify(data));
    } catch (error) {
      console.error('保存配置到 localStorage 失败:', error);
      throw new Error(`保存配置失败: ${error}`);
    }
  }

  async loadConfig<T>(key: string): Promise<T | null> {
    try {
      const data = localStorage.getItem(this.getKey(key));
      if (!data) {
        return null;
      }
      return JSON.parse(data) as T;
    } catch (error) {
      console.error('从 localStorage 加载配置失败:', error);
      return null;
    }
  }

  async deleteConfig(key: string): Promise<void> {
    try {
      localStorage.removeItem(this.getKey(key));
    } catch (error) {
      console.error('从 localStorage 删除配置失败:', error);
      throw new Error(`删除配置失败: ${error}`);
    }
  }

  async exportConfigs(keys: string[]): Promise<Record<string, any>> {
    const exportedData: Record<string, any> = {};
    
    for (const key of keys) {
      try {
        const data = await this.loadConfig(key);
        if (data !== null) {
          exportedData[key] = data;
        }
      } catch (e) {
        console.warn(`导出配置项 ${key} 失败:`, e);
      }
    }
    
    return exportedData;
  }

  async importConfigs(configs: Record<string, any>): Promise<void> {
    for (const [key, value] of Object.entries(configs)) {
      try {
        await this.saveConfig(key, value);
      } catch (e) {
        console.error(`导入配置项 ${key} 失败:`, e);
        throw new Error(`导入配置项 ${key} 失败: ${e}`);
      }
    }
  }
}

// 检测是否在 Tauri 环境中
const isTauriEnvironment = (): boolean => {
    // return true
  return typeof window !== 'undefined' && 
         typeof (window as any).__TAURI_INTERNALS__ !== 'undefined';
};

// 导出配置服务实例
export const configService: ConfigService = isTauriEnvironment() 
  ? new TauriConfigService() 
  : new LocalStorageConfigService();

// 导出实现类以供测试使用
export { TauriConfigService, LocalStorageConfigService };
