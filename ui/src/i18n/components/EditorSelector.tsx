import React, { useEffect, useRef, useState } from 'react';
import { Button, Divider, Empty, message, Select, Space, Spin, Tag, Tooltip, Typography } from 'antd';
import {
  ArrowLeftOutlined,
  CheckOutlined,
  DeleteOutlined,
  FolderOpenOutlined,
  HolderOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { Modifier } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ApiService, DetectedEditor } from '../../services/api';
import {
  createEditorSettings,
  EditorCandidate,
  loadEditorSettings,
  mergeEditorCandidates,
  resolveDefaultEditorId,
  saveEditorSettings,
} from '../../utils/editorSettings';
import { useAppI18n } from '../hooks/useI18n';

const { Text } = Typography;

const editorNameKey = (name: string): string =>
  name.normalize('NFKC').toLocaleLowerCase().replace(/[\s._()-]+/g, '');

const isSameEditor = (
  left: DetectedEditor,
  right: DetectedEditor,
  compareName: boolean
): boolean =>
  left.id === right.id
  || (compareName && editorNameKey(left.name) === editorNameKey(right.name));

const restrictEditorDragToList: Modifier = ({
  activeNodeRect,
  containerNodeRect,
  transform,
}) => {
  if (!activeNodeRect || !containerNodeRect) return { ...transform, x: 0 };

  const minimumY = containerNodeRect.top - activeNodeRect.top + 1;
  const maximumY = containerNodeRect.bottom - activeNodeRect.bottom - 1;
  return {
    ...transform,
    x: 0,
    y: minimumY <= maximumY
      ? Math.min(maximumY, Math.max(minimumY, transform.y))
      : 0,
  };
};

interface SortableEditorOptionProps {
  editor: EditorCandidate;
  selected: boolean;
  customLabel: string;
  defaultLabel: string;
  removeLabel: string;
  onSelect: () => void;
  onRemove: () => void;
}

const SortableEditorOption: React.FC<SortableEditorOptionProps> = ({
  editor,
  selected,
  customLabel,
  defaultLabel,
  removeLabel,
  onSelect,
  onRemove,
}) => {
  const [hovered, setHovered] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: editor.id });
  return (
    <div
      ref={setNodeRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        minHeight: editor.source === 'custom' ? 44 : 38,
        padding: '5px 8px',
        margin: '2px 4px',
        borderRadius: 6,
        background: selected ? '#e6f4ff' : '#fff',
        boxShadow: isDragging ? '0 4px 12px rgba(0, 0, 0, 0.12)' : undefined,
        transform: CSS.Transform.toString(transform),
        transition,
        position: 'relative',
        zIndex: isDragging ? 1 : undefined,
      }}
    >
      <Tooltip title={defaultLabel}>
        <Button
          type="text"
          size="small"
          icon={<CheckOutlined style={{ color: selected ? '#1677ff' : 'transparent' }} />}
          onClick={onSelect}
          style={{ flexShrink: 0 }}
        />
      </Tooltip>
      <div onClick={onSelect} style={{ minWidth: 0, flex: 1, cursor: 'pointer' }}>
        <Space size={5} style={{ maxWidth: '100%' }}>
          <Text ellipsis style={{ maxWidth: 170, fontSize: 13 }} title={editor.name}>
            {editor.name}
          </Text>
          {editor.source === 'custom' && (
            <Tag
              bordered={false}
              style={{ marginInlineEnd: 0, fontSize: 10, lineHeight: '17px' }}
            >
              {customLabel}
            </Tag>
          )}
        </Space>
      </div>
      {editor.source !== 'detected' && (
        <Tooltip title={removeLabel}>
          <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined />}
            style={{
              opacity: hovered && !isDragging ? 1 : 0,
              pointerEvents: hovered && !isDragging ? 'auto' : 'none',
              transition: 'opacity 0.15s ease',
            }}
            onClick={(event) => {
              event.stopPropagation();
              onRemove();
            }}
          />
        </Tooltip>
      )}
      <span
        {...attributes}
        {...listeners}
        style={{
          color: '#8c8c8c',
          cursor: isDragging ? 'grabbing' : 'grab',
          display: 'inline-flex',
          padding: 4,
          touchAction: 'none',
        }}
      >
        <HolderOutlined />
      </span>
    </div>
  );
};

const EditorSelector: React.FC = () => {
  const { settings } = useAppI18n();
  const [candidates, setCandidates] = useState<EditorCandidate[]>([]);
  const [defaultEditorId, setDefaultEditorId] = useState('');
  const [applications, setApplications] = useState<DetectedEditor[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingApplications, setLoadingApplications] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectOpen, setSelectOpen] = useState(false);
  const [showOtherApplications, setShowOtherApplications] = useState(false);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      const [detectedResult, settingsResult] = await Promise.allSettled([
        ApiService.detectLocalEditors(),
        loadEditorSettings(),
      ]);
      if (!active) return;

      const stored = settingsResult.status === 'fulfilled'
        ? settingsResult.value
        : createEditorSettings([], '');
      const detected = detectedResult.status === 'fulfilled' ? detectedResult.value : [];
      const merged = mergeEditorCandidates(stored, detected);
      const resolvedDefaultId = resolveDefaultEditorId(stored, merged);
      setCandidates(merged);
      setDefaultEditorId(resolvedDefaultId);
      if (resolvedDefaultId && resolvedDefaultId !== stored.defaultEditorId) {
        void saveEditorSettings(createEditorSettings(merged, resolvedDefaultId));
      }
      setLoading(false);
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  const persist = (nextCandidates: EditorCandidate[], nextDefaultEditorId: string) => {
    setSaving(true);
    const operation = saveQueue.current
      .catch(() => undefined)
      .then(() => saveEditorSettings(createEditorSettings(nextCandidates, nextDefaultEditorId)));
    saveQueue.current = operation;
    void operation
      .catch((error) => message.error(`${settings.editorSaveFailed}: ${error}`))
      .finally(() => {
        if (saveQueue.current === operation) setSaving(false);
      });
  };

  const applyCandidates = (
    nextCandidates: EditorCandidate[],
    nextDefaultEditorId = defaultEditorId
  ) => {
    setCandidates(nextCandidates);
    setDefaultEditorId(nextDefaultEditorId);
    persist(nextCandidates, nextDefaultEditorId);
  };

  const selectEditor = (id: string) => {
    setDefaultEditorId(id);
    persist(candidates, id);
    setSelectOpen(false);
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const oldIndex = candidates.findIndex((editor) => editor.id === active.id);
    const newIndex = candidates.findIndex((editor) => editor.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    applyCandidates(arrayMove(candidates, oldIndex, newIndex));
  };

  const addCandidate = (editor: DetectedEditor, source: 'installed' | 'custom') => {
    if (candidates.some((candidate) => isSameEditor(
      candidate,
      editor,
      source === 'installed'
    ))) {
      message.info(settings.editorDuplicate);
      return;
    }

    const nextCandidates: EditorCandidate[] = [...candidates, { ...editor, source }];
    applyCandidates(nextCandidates, editor.id);
    setShowOtherApplications(false);
    setSelectOpen(false);
  };

  const browseForApplication = async () => {
    try {
      addCandidate(await ApiService.chooseAndRegisterLocalEditor(), 'custom');
    } catch (error) {
      message.error(`${settings.editorAddFailed}: ${error}`);
    }
  };

  const openOtherApplications = async () => {
    setShowOtherApplications(true);
    if (applications.length > 0 || loadingApplications) return;
    setLoadingApplications(true);
    try {
      setApplications(await ApiService.listLocalApplications());
    } catch (error) {
      message.error(`${settings.editorAddFailed}: ${error}`);
    } finally {
      setLoadingApplications(false);
    }
  };

  const removeEditor = async (id: string) => {
    try {
      await ApiService.removeRegisteredEditor(id);
      const nextCandidates = candidates.filter((editor) => editor.id !== id);
      const nextDefaultEditorId = id === defaultEditorId
        ? (nextCandidates[0]?.id ?? '')
        : defaultEditorId;
      applyCandidates(nextCandidates, nextDefaultEditorId);
    } catch (error) {
      message.error(`${settings.editorAddFailed}: ${error}`);
    }
  };

  const availableApplications = applications.filter((application, index) =>
    !candidates.some((candidate) => isSameEditor(candidate, application, true))
    && applications.findIndex(
      (other) => editorNameKey(other.name) === editorNameKey(application.name)
    ) === index
  );

  const renderOtherApplications = () => (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', padding: '4px 6px 6px' }}>
        <Button
          type="text"
          size="small"
          icon={<ArrowLeftOutlined />}
          onClick={() => setShowOtherApplications(false)}
        />
        <Text strong style={{ marginLeft: 4, fontSize: 13 }}>
          {settings.editorOtherApplications}
        </Text>
      </div>
      <Divider style={{ margin: '0 0 4px' }} />
      <Spin spinning={loadingApplications} size="small">
        <div style={{ maxHeight: 250, overflowY: 'auto', padding: '2px 4px' }}>
          {!loadingApplications && availableApplications.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={settings.editorNoOtherApplications}
              style={{ margin: '14px 0' }}
            />
          ) : availableApplications.map((application) => (
            <Button
              key={application.id}
              type="text"
              block
              onClick={() => void ApiService.registerDetectedEditor(application.id)
                .then((editor) => addCandidate(editor, 'installed'))
                .catch((error) => message.error(`${settings.editorAddFailed}: ${error}`))}
              style={{ height: 36, textAlign: 'left', paddingInline: 10 }}
            >
              <Text ellipsis title={application.name}>{application.name}</Text>
            </Button>
          ))}
        </div>
      </Spin>
      <Divider style={{ margin: '4px 0' }} />
      <Button
        type="text"
        block
        icon={<FolderOpenOutlined />}
        onClick={() => void browseForApplication()}
        style={{ textAlign: 'left', height: 36 }}
      >
        {settings.editorChooseFromComputer}
      </Button>
    </div>
  );

  const renderCandidates = () => (
    <div>
      {candidates.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictEditorDragToList]}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={candidates.map((editor) => editor.id)}
            strategy={verticalListSortingStrategy}
          >
            <div
              style={{
                maxHeight: 260,
                overflowY: 'auto',
                overflowX: 'hidden',
                padding: '2px 0',
              }}
            >
              {candidates.map((editor) => (
                <SortableEditorOption
                  key={editor.id}
                  editor={editor}
                  selected={editor.id === defaultEditorId}
                  customLabel={settings.editorCustom}
                  defaultLabel={settings.editorSetDefault}
                  removeLabel={settings.editorRemove}
                  onSelect={() => selectEditor(editor.id)}
                  onRemove={() => void removeEditor(editor.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={settings.editorNoCandidates}
          style={{ margin: '14px 0' }}
        />
      )}
      <Divider style={{ margin: '4px 0' }} />
      <Button
        type="text"
        block
        icon={<PlusOutlined />}
        onClick={() => void openOtherApplications()}
        style={{ textAlign: 'left', height: 36 }}
      >
        {settings.editorAdd}
      </Button>
    </div>
  );

  return (
    <Spin spinning={loading} size="small">
      <Select
        value={defaultEditorId || undefined}
        placeholder={settings.editorNoCandidates}
        style={{ width: '100%' }}
        suffixIcon={null}
        open={selectOpen}
        loading={saving}
        onDropdownVisibleChange={(open) => {
          setSelectOpen(open);
          if (!open) setShowOtherApplications(false);
        }}
        options={candidates.map((editor) => ({ value: editor.id, label: editor.name }))}
        onChange={selectEditor}
        dropdownRender={() => (
          <div
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
          >
            {showOtherApplications ? renderOtherApplications() : renderCandidates()}
          </div>
        )}
      />
    </Spin>
  );
};

export default EditorSelector;
