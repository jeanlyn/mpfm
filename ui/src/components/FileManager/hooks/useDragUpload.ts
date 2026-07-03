import { useEffect, useRef, useState, useCallback } from 'react';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { Connection } from '../../../types';

interface UseDragUploadOptions {
  connection: Connection | null;
  dropZoneRef: React.RefObject<HTMLElement | null>;
  onDrop: (paths: string[]) => void | Promise<void>;
}

/**
 * 监听 Tauri 原生拖放事件，在指定区域内触发上传
 */
export const useDragUpload = ({
  connection,
  dropZoneRef,
  onDrop,
}: UseDragUploadOptions) => {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const scaleFactorRef = useRef(1);
  const dragDepthRef = useRef(0);

  const isOverDropZone = useCallback((physicalPosition: { x: number; y: number }) => {
    const element = dropZoneRef.current;
    if (!element) {
      return false;
    }

    const scale = scaleFactorRef.current;
    const x = physicalPosition.x / scale;
    const y = physicalPosition.y / scale;
    const rect = element.getBoundingClientRect();

    return (
      x >= rect.left &&
      x <= rect.right &&
      y >= rect.top &&
      y <= rect.bottom
    );
  }, [dropZoneRef]);

  useEffect(() => {
    if (!connection) {
      setIsDraggingOver(false);
      dragDepthRef.current = 0;
      return;
    }

    let cancelled = false;
    let unlisten: (() => void) | undefined;

    const setup = async () => {
      try {
        scaleFactorRef.current = await getCurrentWindow().scaleFactor();
      } catch {
        scaleFactorRef.current = window.devicePixelRatio || 1;
      }

      if (cancelled) {
        return;
      }

      unlisten = await getCurrentWebview().onDragDropEvent((event) => {
        const { type } = event.payload;

        if (type === 'enter') {
          dragDepthRef.current += 1;
          return;
        }

        if (type === 'over') {
          setIsDraggingOver(isOverDropZone(event.payload.position));
          return;
        }

        if (type === 'leave') {
          dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
          if (dragDepthRef.current === 0) {
            setIsDraggingOver(false);
          }
          return;
        }

        if (type === 'drop') {
          dragDepthRef.current = 0;
          setIsDraggingOver(false);

          if (!isOverDropZone(event.payload.position)) {
            return;
          }

          const paths = event.payload.paths;
          if (paths.length > 0) {
            void onDrop(paths);
          }
        }
      });
    };

    void setup();

    return () => {
      cancelled = true;
      unlisten?.();
      dragDepthRef.current = 0;
      setIsDraggingOver(false);
    };
  }, [connection, isOverDropZone, onDrop]);

  return { isDraggingOver };
};
