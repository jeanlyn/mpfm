import { stat } from '@tauri-apps/plugin-fs';

/** 判断本地路径是否为目录 */
export async function isLocalDirectory(path: string): Promise<boolean> {
  try {
    const metadata = await stat(path);
    return metadata.isDirectory;
  } catch {
    return false;
  }
}
