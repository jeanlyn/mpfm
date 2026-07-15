import { configService } from '../services/configService';

export const EDITOR_SETTINGS_CONFIG_KEY = 'editor-settings';
export const EDITOR_SETTINGS_CHANGED_EVENT = 'mpfm-editor-settings-changed';

export interface EditorSettings {
  executablePath: string;
}

export async function loadEditorSettings(): Promise<EditorSettings> {
  return (
    (await configService.loadConfig<EditorSettings>(EDITOR_SETTINGS_CONFIG_KEY)) ?? {
      executablePath: '',
    }
  );
}

export async function saveEditorSettings(settings: EditorSettings): Promise<void> {
  await configService.saveConfig(EDITOR_SETTINGS_CONFIG_KEY, settings);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EDITOR_SETTINGS_CHANGED_EVENT));
  }
}

export function getEditorDisplayName(executablePath: string): string {
  const fileName = executablePath.split(/[\\/]/).pop()?.toLowerCase() || '';
  if (fileName === 'code.exe' || fileName === 'code') return 'VS Code';
  if (fileName === 'code - insiders.exe' || fileName === 'code-insiders') {
    return 'VS Code Insiders';
  }
  if (fileName === 'vscodium.exe' || fileName === 'codium.exe' || fileName === 'codium') {
    return 'VSCodium';
  }
  if (fileName === 'notepad3.exe' || fileName === 'notepad3') return 'Notepad3';
  if (fileName === 'notepad.exe' || fileName === 'notepad') return 'Notepad';
  if (fileName === 'visual studio code.app') return 'VS Code';
  if (fileName === 'visual studio code - insiders.app') return 'VS Code Insiders';
  if (fileName === 'vscodium.app') return 'VSCodium';
  if (fileName === 'textedit.app' || fileName === 'textedit') return 'TextEdit';

  return executablePath.split(/[\\/]/).pop()?.replace(/\.(exe|app)$/i, '') || 'Editor';
}
