import { configService } from '../services/configService';
import type { DetectedEditor } from '../services/api';

export const EDITOR_SETTINGS_CONFIG_KEY = 'editor-settings';
export const EDITOR_SETTINGS_CHANGED_EVENT = 'mpfm-editor-settings-changed';

export type EditorCandidateSource = 'detected' | 'installed' | 'custom';

export interface EditorCandidate extends DetectedEditor {
  source: EditorCandidateSource;
}

interface StoredEditor extends DetectedEditor {
  source?: Exclude<EditorCandidateSource, 'detected'>;
}

export interface EditorSettings {
  version: 2;
  /** 兼容旧版本，同时作为默认编辑器路径供现有调用方使用。 */
  executablePath: string;
  defaultEditorPath: string;
  editorOrder: string[];
  customEditors: StoredEditor[];
}

export async function loadEditorSettings(): Promise<EditorSettings> {
  const stored = await configService.loadConfig<Partial<EditorSettings>>(
    EDITOR_SETTINGS_CONFIG_KEY
  );
  const legacyPath = typeof stored?.executablePath === 'string'
    ? stored.executablePath.trim()
    : '';
  const defaultEditorPath = typeof stored?.defaultEditorPath === 'string'
    ? stored.defaultEditorPath.trim()
    : legacyPath;
  const editorOrder = Array.isArray(stored?.editorOrder)
    ? stored.editorOrder.filter((path): path is string => typeof path === 'string' && path.trim() !== '')
    : (legacyPath ? [legacyPath] : []);
  const customEditors = Array.isArray(stored?.customEditors)
    ? stored.customEditors.filter(
        (editor): editor is StoredEditor =>
          typeof editor?.name === 'string'
          && typeof editor?.path === 'string'
          && editor.path.trim() !== ''
      )
    : (legacyPath
        ? [{ name: getEditorDisplayName(legacyPath), path: legacyPath }]
        : []);

  return {
    version: 2,
    executablePath: defaultEditorPath,
    defaultEditorPath,
    editorOrder,
    customEditors,
  };
}

export async function saveEditorSettings(settings: EditorSettings): Promise<void> {
  const defaultEditorPath = settings.defaultEditorPath.trim();
  await configService.saveConfig(EDITOR_SETTINGS_CONFIG_KEY, {
    ...settings,
    version: 2,
    executablePath: defaultEditorPath,
    defaultEditorPath,
  });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EDITOR_SETTINGS_CHANGED_EVENT));
  }
}

const editorPathKey = (path: string): string =>
  path.trim().replace(/\\/g, '/').replace(/\/$/, '').toLowerCase();

export function mergeEditorCandidates(
  settings: EditorSettings,
  detectedEditors: DetectedEditor[]
): EditorCandidate[] {
  const candidates = new Map<string, EditorCandidate>();

  for (const editor of detectedEditors) {
    candidates.set(editorPathKey(editor.path), { ...editor, source: 'detected' });
  }
  for (const editor of settings.customEditors) {
    const key = editorPathKey(editor.path);
    if (!candidates.has(key)) {
      candidates.set(key, { ...editor, source: editor.source ?? 'custom' });
    }
  }

  // 旧配置可能只有 executablePath；迁移时仍需保留便携版编辑器。
  if (settings.executablePath) {
    const key = editorPathKey(settings.executablePath);
    if (!candidates.has(key)) {
      candidates.set(key, {
        name: getEditorDisplayName(settings.executablePath),
        path: settings.executablePath,
        source: 'custom',
      });
    }
  }

  const order = new Map(
    settings.editorOrder.map((path, index) => [editorPathKey(path), index])
  );
  return Array.from(candidates.entries())
    .map(([key, editor], originalIndex) => ({ key, editor, originalIndex }))
    .sort((left, right) => {
      const leftOrder = order.get(left.key);
      const rightOrder = order.get(right.key);
      if (leftOrder !== undefined && rightOrder !== undefined) return leftOrder - rightOrder;
      if (leftOrder !== undefined) return -1;
      if (rightOrder !== undefined) return 1;
      return left.originalIndex - right.originalIndex;
    })
    .map(({ editor }) => editor);
}

export function resolveDefaultEditorPath(
  settings: EditorSettings,
  candidates: EditorCandidate[]
): string {
  const configuredKey = editorPathKey(
    settings.defaultEditorPath || settings.executablePath
  );
  return candidates.find((editor) => editorPathKey(editor.path) === configuredKey)?.path
    ?? candidates[0]?.path
    ?? '';
}

export function createEditorSettings(
  candidates: EditorCandidate[],
  defaultEditorPath: string
): EditorSettings {
  return {
    version: 2,
    executablePath: defaultEditorPath,
    defaultEditorPath,
    editorOrder: candidates.map((editor) => editor.path),
    customEditors: candidates
      .filter((editor) => editor.source !== 'detected')
      .map(({ name, path, source }) => ({
        name,
        path,
        source: source === 'installed' ? 'installed' : 'custom',
      })),
  };
}

export function getEditorDisplayName(executablePath: string): string {
  const normalizedPath = executablePath.replace(/[\\/]+$/, '');
  const fileName = normalizedPath.split(/[\\/]/).pop()?.toLowerCase() || '';
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

  return normalizedPath.split(/[\\/]/).pop()?.replace(/\.(exe|app)$/i, '') || 'Editor';
}
