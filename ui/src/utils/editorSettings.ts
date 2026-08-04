import { configService } from '../services/configService';
import type { DetectedEditor } from '../services/api';

export const EDITOR_SETTINGS_CONFIG_KEY = 'editor-settings';
export const EDITOR_SETTINGS_CHANGED_EVENT = 'mpfm-editor-settings-changed';

export type EditorCandidateSource = 'detected' | 'installed' | 'custom';

export interface EditorCandidate extends DetectedEditor {
  source: EditorCandidateSource;
}

export interface EditorSettings {
  version: 3;
  defaultEditorId: string;
  editorOrder: string[];
}

export async function loadEditorSettings(): Promise<EditorSettings> {
  const stored = await configService.loadConfig<Record<string, unknown>>(
    EDITOR_SETTINGS_CONFIG_KEY
  );
  const defaultEditorId = typeof stored?.defaultEditorId === 'string'
    ? stored.defaultEditorId.trim()
    : '';
  const editorOrder = Array.isArray(stored?.editorOrder)
    ? stored.editorOrder.filter((id): id is string => typeof id === 'string' && id.trim() !== '')
    : [];

  return { version: 3, defaultEditorId, editorOrder };
}

export async function saveEditorSettings(settings: EditorSettings): Promise<void> {
  await configService.saveConfig(EDITOR_SETTINGS_CONFIG_KEY, {
    version: 3,
    defaultEditorId: settings.defaultEditorId.trim(),
    editorOrder: settings.editorOrder,
  });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EDITOR_SETTINGS_CHANGED_EVENT));
  }
}

export function mergeEditorCandidates(
  settings: EditorSettings,
  detectedEditors: DetectedEditor[]
): EditorCandidate[] {
  const order = new Map(settings.editorOrder.map((id, index) => [id, index]));
  return detectedEditors
    .map((editor, originalIndex) => ({
      editor: {
        ...editor,
        source: (editor.removable ? 'custom' : 'detected') as EditorCandidateSource,
      },
      originalIndex,
    }))
    .sort((left, right) => {
      const leftOrder = order.get(left.editor.id);
      const rightOrder = order.get(right.editor.id);
      if (leftOrder !== undefined && rightOrder !== undefined) return leftOrder - rightOrder;
      if (leftOrder !== undefined) return -1;
      if (rightOrder !== undefined) return 1;
      return left.originalIndex - right.originalIndex;
    })
    .map(({ editor }) => editor);
}

export function resolveDefaultEditorId(
  settings: EditorSettings,
  candidates: DetectedEditor[]
): string {
  if (candidates.some((editor) => editor.id === settings.defaultEditorId)) {
    return settings.defaultEditorId;
  }
  const migrated = candidates.find((editor) => editor.legacyDefault);
  if (migrated) return migrated.id;
  return candidates[0]?.id ?? '';
}

export function createEditorSettings(
  candidates: EditorCandidate[],
  defaultEditorId: string
): EditorSettings {
  return {
    version: 3,
    defaultEditorId,
    editorOrder: candidates.map((editor) => editor.id),
  };
}
