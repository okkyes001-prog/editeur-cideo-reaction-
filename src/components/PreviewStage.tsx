import React, { useEffect, useRef, useState } from 'react';
import {
  Pause,
  Play,
  Plus,
  Repeat,
  Scissors,
  SkipBack,
  Smartphone,
  Upload,
} from 'lucide-react';
import {
  AspectRatio,
  MediaAsset,
  SeamDividerConfig,
  SelectionTarget,
  TextOverlay,
  VideoClip,
} from '../types/editor';
import { getCanvasDimensions } from '../data/presets';
import {
  pauseAllUploadedVideos,
  renderFrame,
  subscribeMediaReady,
} from '../engine/compositor';
import { subscribeCutoutReady } from '../engine/backgroundRemoval';

type DragHandle =
  | 'move'
  | 'n'
  | 's'
  | 'w'
  | 'e'
  | 'nw'
  | 'ne'
  | 'sw'
  | 'se';

interface PreviewStageProps {
  aspectRatio: AspectRatio;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  isLooping: boolean;
  baseClips: VideoClip[];
  overlayClips: VideoClip[];
  textOverlays: TextOverlay[];
  assetsById: Map<string, MediaAsset>;
  selection: SelectionTarget;
  seamDivider?: SeamDividerConfig;
  onTogglePlay: () => void;
  onToggleLoop: () => void;
  onSeek: (time: number) => void;
  onSplitAtPlayhead: () => void;
  onSelect: (target: SelectionTarget) => void;
  onUpdateClipGeometry: (clipId: string, patch: Partial<VideoClip>) => void;
  onUpdateTextGeometry: (textId: string, patch: Partial<TextOverlay>) => void;
  onDropVideoFile?: (files: FileList) => void;
  onUploadVideoForTrack?: (files: FileList, track: 'base' | 'overlay') => void;
}

function formatTimecode(seconds: number): string {
  const safe = Math.max(0, seconds);
  const mins = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  const cs = Math.floor((safe % 1) * 100);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(
    2,
    '0'
  )}.${String(cs).padStart(2, '0')}`;
}

function getClipBoxPct(clip: VideoClip) {
  const fullW = clip.widthPct * clip.scale;
  const fullH = clip.heightPct * clip.scale;
  const fullLeft = clip.x - fullW / 2;
  const fullTop = clip.y - fullH / 2;
  const cropL = Math.max(0, Math.min(85, clip.cropLeft ?? 0));
  const cropR = Math.max(0, Math.min(85 - cropL, clip.cropRight ?? 0));
  const cropT = Math.max(0, Math.min(85, clip.cropTop ?? 0));
  const cropB = Math.max(0, Math.min(85 - cropT, clip.cropBottom ?? 0));

  const left = fullLeft + (cropL / 100) * fullW;
  const right = fullLeft + fullW - (cropR / 100) * fullW;
  const top = fullTop + (cropT / 100) * fullH;
  const bottom = fullTop + fullH - (cropB / 100) * fullH;

  return {
    left,
    right,
    top,
    bottom,
    width: Math.max(4, right - left),
    height: Math.max(4, bottom - top),
    fullLeft,
    fullRight: fullLeft + fullW,
    fullTop,
    fullBottom: fullTop + fullH,
    cropL,
    cropR,
    cropT,
    cropB,
  };
}

function hitTestClipHandle(
  px: number,
  py: number,
  clip: VideoClip
): DragHandle | null {
  const box = getClipBoxPct(clip);
  const tolX = 5.5;
  const tolY = 4.0;

  // Clamp hit targets slightly inside 0..100 so edges flush with canvas border are still grabbable
  const hitLeft = Math.max(1.5, Math.min(98.5, box.left));
  const hitRight = Math.max(1.5, Math.min(98.5, box.right));
  const hitTop = Math.max(1.5, Math.min(98.5, box.top));
  const hitBottom = Math.max(1.5, Math.min(98.5, box.bottom));

  const nearL = Math.abs(px - hitLeft) <= tolX;
  const nearR = Math.abs(px - hitRight) <= tolX;
  const nearT = Math.abs(py - hitTop) <= tolY;
  const nearB = Math.abs(py - hitBottom) <= tolY;

  if (nearT && nearL) return 'nw';
  if (nearT && nearR) return 'ne';
  if (nearB && nearL) return 'sw';
  if (nearB && nearR) return 'se';
  if (nearT && px >= box.left - tolX && px <= box.right + tolX) return 'n';
  if (nearB && px >= box.left - tolX && px <= box.right + tolX) return 's';
  if (nearL && py >= box.top - tolY && py <= box.bottom + tolY) return 'w';
  if (nearR && py >= box.top - tolY && py <= box.bottom + tolY) return 'e';

  if (px >= box.left && px <= box.right && py >= box.top && py <= box.bottom) {
    return 'move';
  }
  return null;
}

function cursorForHandle(handle: DragHandle | null, isDragging: boolean): string {
  if (isDragging && handle === 'move') return 'grabbing';
  switch (handle) {
    case 'n':
    case 's':
      return 'ns-resize';
    case 'w':
    case 'e':
      return 'ew-resize';
    case 'nw':
    case 'se':
      return 'nwse-resize';
    case 'ne':
    case 'sw':
      return 'nesw-resize';
    case 'move':
      return 'grab';
    default:
      return 'default';
  }
}

export const PreviewStage: React.FC<PreviewStageProps> = ({
  aspectRatio,
  currentTime,
  duration,
  isPlaying,
  isLooping,
  baseClips,
  overlayClips,
  textOverlays,
  assetsById,
  selection,
  seamDivider,
  onTogglePlay,
  onToggleLoop,
  onSeek,
  onSplitAtPlayhead,
  onSelect,
  onUpdateClipGeometry,
  onUpdateTextGeometry,
  onDropVideoFile,
  onUploadVideoForTrack,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const emptyViralInputRef = useRef<HTMLInputElement>(null);
  const emptyReactionInputRef = useRef<HTMLInputElement>(null);
  const dragStateRef = useRef<{
    target: SelectionTarget;
    handle: DragHandle;
    startClientX: number;
    startClientY: number;
    initialX: number;
    initialY: number;
    initialLeft: number;
    initialRight: number;
    initialTop: number;
    initialBottom: number;
    initialFullLeft: number;
    initialFullRight: number;
    initialFullTop: number;
    initialFullBottom: number;
    initialCropL: number;
    initialCropR: number;
    initialCropT: number;
    initialCropB: number;
    initialFontSize: number;
  } | null>(null);
  const [hoverCursor, setHoverCursor] = useState<string>('default');
  const [mediaTick, setMediaTick] = useState(0);
  const [isFileDragOver, setIsFileDragOver] = useState(false);
  const [showSafeZone, setShowSafeZone] = useState(false);

  const dims = getCanvasDimensions(aspectRatio, 'preview');

  useEffect(() => {
    const unsubMedia = subscribeMediaReady(() => {
      setMediaTick((n) => n + 1);
    });
    const unsubCutout = subscribeCutoutReady(() => {
      setMediaTick((n) => n + 1);
    });
    return () => {
      unsubMedia();
      unsubCutout();
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    renderFrame({
      ctx,
      canvasW: dims.width,
      canvasH: dims.height,
      aspectRatio,
      timelineTime: currentTime,
      baseClips,
      overlayClips,
      textOverlays,
      assetsById,
      isPlaying,
      isExporting: false,
      showSafeZone,
      selection,
      seamDivider,
    });
  }, [
    aspectRatio,
    dims.width,
    dims.height,
    currentTime,
    baseClips,
    overlayClips,
    textOverlays,
    assetsById,
    isPlaying,
    showSafeZone,
    selection,
    seamDivider,
    mediaTick,
  ]);

  useEffect(() => {
    if (!isPlaying) {
      pauseAllUploadedVideos();
    }
  }, [isPlaying]);

  const getPointerPct = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { px: 50, py: 50, rect: null };
    const rect = canvas.getBoundingClientRect();
    return {
      px: ((e.clientX - rect.left) / rect.width) * 100,
      py: ((e.clientY - rect.top) / rect.height) * 100,
      rect,
    };
  };

  const resolveSelectedActiveClip = (): VideoClip | null => {
    if (selection?.kind !== 'clip') return null;
    const clip =
      overlayClips.find((c) => c.id === selection.id) ||
      baseClips.find((c) => c.id === selection.id);
    if (
      clip &&
      currentTime >= clip.startTime &&
      currentTime <= clip.startTime + clip.duration
    ) {
      return clip;
    }
    return null;
  };

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { px, py } = getPointerPct(e);

    // 0. If a clip is already selected, prioritize its resize edge/corner handles first
    const selectedActiveClip = resolveSelectedActiveClip();
    if (selectedActiveClip) {
      const handle = hitTestClipHandle(px, py, selectedActiveClip);
      if (handle && handle !== 'move') {
        const box = getClipBoxPct(selectedActiveClip);
        dragStateRef.current = {
          target: { kind: 'clip', id: selectedActiveClip.id },
          handle,
          startClientX: e.clientX,
          startClientY: e.clientY,
          initialX: selectedActiveClip.x,
          initialY: selectedActiveClip.y,
          initialLeft: box.left,
          initialRight: box.right,
          initialTop: box.top,
          initialBottom: box.bottom,
          initialFullLeft: box.fullLeft,
          initialFullRight: box.fullRight,
          initialFullTop: box.fullTop,
          initialFullBottom: box.fullBottom,
          initialCropL: box.cropL,
          initialCropR: box.cropR,
          initialCropT: box.cropT,
          initialCropB: box.cropB,
          initialFontSize: 60,
        };
        setHoverCursor(cursorForHandle(handle, true));
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
    }

    // 1. Hit test active text overlays (check corner scale handles if selected, then body)
    const activeTexts = textOverlays.filter(
      (t) =>
        currentTime >= t.startTime && currentTime <= t.startTime + t.duration
    );
    for (let i = activeTexts.length - 1; i >= 0; i--) {
      const txt = activeTexts[i];
      const boxHalfW = 36;
      const boxHalfH = ((txt.fontSize / 1080) * 100) * 0.65;
      const isSelected =
        selection?.kind === 'text' && selection.id === txt.id;

      if (isSelected) {
        const nearCorner =
          (Math.abs(px - (txt.x - boxHalfW)) <= 5 ||
            Math.abs(px - (txt.x + boxHalfW)) <= 5) &&
          (Math.abs(py - (txt.y - boxHalfH)) <= 4.5 ||
            Math.abs(py - (txt.y + boxHalfH)) <= 4.5);
        if (nearCorner) {
          const target: SelectionTarget = { kind: 'text', id: txt.id };
          dragStateRef.current = {
            target,
            handle: 'se',
            startClientX: e.clientX,
            startClientY: e.clientY,
            initialX: txt.x,
            initialY: txt.y,
            initialLeft: 0,
            initialRight: 0,
            initialTop: 0,
            initialBottom: 0,
            initialFullLeft: 0,
            initialFullRight: 0,
            initialFullTop: 0,
            initialFullBottom: 0,
            initialCropL: 0,
            initialCropR: 0,
            initialCropT: 0,
            initialCropB: 0,
            initialFontSize: txt.fontSize,
          };
          setHoverCursor('nwse-resize');
          e.currentTarget.setPointerCapture(e.pointerId);
          return;
        }
      }

      if (
        Math.abs(px - txt.x) <= boxHalfW &&
        Math.abs(py - txt.y) <= Math.max(8, boxHalfH)
      ) {
        const target: SelectionTarget = { kind: 'text', id: txt.id };
        onSelect(target);
        dragStateRef.current = {
          target,
          handle: 'move',
          startClientX: e.clientX,
          startClientY: e.clientY,
          initialX: txt.x,
          initialY: txt.y,
          initialLeft: 0,
          initialRight: 0,
          initialTop: 0,
          initialBottom: 0,
          initialFullLeft: 0,
          initialFullRight: 0,
          initialFullTop: 0,
          initialFullBottom: 0,
          initialCropL: 0,
          initialCropR: 0,
          initialCropT: 0,
          initialCropB: 0,
          initialFontSize: txt.fontSize,
        };
        setHoverCursor('grabbing');
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
    }

    // 2. Hit test active Reaction / Overlay clips (V2)
    const activeOverlays = overlayClips.filter(
      (c) =>
        currentTime >= c.startTime && currentTime <= c.startTime + c.duration
    );
    for (let i = activeOverlays.length - 1; i >= 0; i--) {
      const clip = activeOverlays[i];
      const handle = hitTestClipHandle(px, py, clip);
      if (handle) {
        const box = getClipBoxPct(clip);
        const target: SelectionTarget = { kind: 'clip', id: clip.id };
        onSelect(target);
        dragStateRef.current = {
          target,
          handle,
          startClientX: e.clientX,
          startClientY: e.clientY,
          initialX: clip.x,
          initialY: clip.y,
          initialLeft: box.left,
          initialRight: box.right,
          initialTop: box.top,
          initialBottom: box.bottom,
          initialFullLeft: box.fullLeft,
          initialFullRight: box.fullRight,
          initialFullTop: box.fullTop,
          initialFullBottom: box.fullBottom,
          initialCropL: box.cropL,
          initialCropR: box.cropR,
          initialCropT: box.cropT,
          initialCropB: box.cropB,
          initialFontSize: 60,
        };
        setHoverCursor(cursorForHandle(handle, true));
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
    }

    // 3. Hit test active Viral / Base clips (V1) — now also draggable & resizable on canvas!
    const activeBases = baseClips.filter(
      (c) =>
        currentTime >= c.startTime && currentTime <= c.startTime + c.duration
    );
    for (let i = activeBases.length - 1; i >= 0; i--) {
      const clip = activeBases[i];
      const handle = hitTestClipHandle(px, py, clip);
      if (handle) {
        const box = getClipBoxPct(clip);
        const target: SelectionTarget = { kind: 'clip', id: clip.id };
        onSelect(target);
        dragStateRef.current = {
          target,
          handle,
          startClientX: e.clientX,
          startClientY: e.clientY,
          initialX: clip.x,
          initialY: clip.y,
          initialLeft: box.left,
          initialRight: box.right,
          initialTop: box.top,
          initialBottom: box.bottom,
          initialFullLeft: box.fullLeft,
          initialFullRight: box.fullRight,
          initialFullTop: box.fullTop,
          initialFullBottom: box.fullBottom,
          initialCropL: box.cropL,
          initialCropR: box.cropR,
          initialCropT: box.cropT,
          initialCropB: box.cropB,
          initialFontSize: 60,
        };
        setHoverCursor(cursorForHandle(handle, true));
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
    }

    onSelect(null);
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragStateRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!drag) {
      // Update hover cursor based on active selection handles
      const { px, py } = getPointerPct(e);
      const selectedActiveClip = resolveSelectedActiveClip();
      if (selectedActiveClip) {
        const h = hitTestClipHandle(px, py, selectedActiveClip);
        setHoverCursor(cursorForHandle(h, false));
        return;
      }
      setHoverCursor('default');
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const dxPct = ((e.clientX - drag.startClientX) / rect.width) * 100;
    const dyPct = ((e.clientY - drag.startClientY) / rect.height) * 100;

    if (drag.target?.kind === 'text') {
      if (drag.handle === 'move') {
        let nextX = Math.max(5, Math.min(95, drag.initialX + dxPct));
        let nextY = Math.max(5, Math.min(95, drag.initialY + dyPct));
        if (Math.abs(nextX - 50) < 2.2) nextX = 50;
        if (Math.abs(nextY - 50) < 2.2) nextY = 50;
        onUpdateTextGeometry(drag.target.id, {
          x: Math.round(nextX),
          y: Math.round(nextY),
        });
      } else {
        const nextSize = Math.round(
          Math.max(24, Math.min(130, drag.initialFontSize + dyPct * 1.4))
        );
        onUpdateTextGeometry(drag.target.id, { fontSize: nextSize });
      }
      return;
    }

    if (drag.target?.kind === 'clip') {
      if (drag.handle === 'move') {
        let nextX = Math.max(-20, Math.min(120, drag.initialX + dxPct));
        let nextY = Math.max(-20, Math.min(120, drag.initialY + dyPct));
        if (Math.abs(nextX - 50) < 2.2) nextX = 50;
        if (Math.abs(nextY - 50) < 2.2) nextY = 50;
        if (Math.abs(nextY - 25) < 2.0) nextY = 25;
        if (Math.abs(nextY - 75) < 2.0) nextY = 75;
        onUpdateClipGeometry(drag.target.id, {
          x: Math.round(nextX * 10) / 10,
          y: Math.round(nextY * 10) / 10,
        });
        return;
      }

      const round1 = (v: number) => Math.round(v * 10) / 10;
      const minSize = 10;
      const fullW = Math.max(10, drag.initialFullRight - drag.initialFullLeft);
      const fullH = Math.max(10, drag.initialFullBottom - drag.initialFullTop);

      // Single-edge handles crop the video cleanly without zooming!
      if (drag.handle === 'n') {
        let top = Math.max(0, Math.min(drag.initialBottom - minSize, drag.initialTop + dyPct));
        if (Math.abs(top) < 1.5) top = 0;
        if (Math.abs(top - 50) < 1.8) top = 50;

        const rawCropT = ((top - drag.initialFullTop) / fullH) * 100;
        if (rawCropT >= 0) {
          onUpdateClipGeometry(drag.target.id, {
            x: round1(drag.initialFullLeft + fullW / 2),
            y: round1(drag.initialFullTop + fullH / 2),
            widthPct: round1(fullW),
            heightPct: round1(fullH),
            scale: 1,
            cropTop: round1(Math.min(85 - drag.initialCropB, rawCropT)),
          });
        } else {
          const nextH = drag.initialFullBottom - top;
          const preservedBottomPx = (drag.initialCropB / 100) * fullH;
          onUpdateClipGeometry(drag.target.id, {
            x: round1(drag.initialFullLeft + fullW / 2),
            y: round1(top + nextH / 2),
            widthPct: round1(fullW),
            heightPct: round1(nextH),
            scale: 1,
            cropTop: 0,
            cropBottom: round1(Math.min(85, (preservedBottomPx / nextH) * 100)),
          });
        }
        return;
      }

      if (drag.handle === 's') {
        let bottom = Math.min(100, Math.max(drag.initialTop + minSize, drag.initialBottom + dyPct));
        if (Math.abs(bottom - 100) < 1.5) bottom = 100;
        if (Math.abs(bottom - 50) < 1.8) bottom = 50;

        const rawCropB = ((drag.initialFullBottom - bottom) / fullH) * 100;
        if (rawCropB >= 0) {
          onUpdateClipGeometry(drag.target.id, {
            x: round1(drag.initialFullLeft + fullW / 2),
            y: round1(drag.initialFullTop + fullH / 2),
            widthPct: round1(fullW),
            heightPct: round1(fullH),
            scale: 1,
            cropBottom: round1(Math.min(85 - drag.initialCropT, rawCropB)),
          });
        } else {
          const nextH = bottom - drag.initialFullTop;
          const preservedTopPx = (drag.initialCropT / 100) * fullH;
          onUpdateClipGeometry(drag.target.id, {
            x: round1(drag.initialFullLeft + fullW / 2),
            y: round1(drag.initialFullTop + nextH / 2),
            widthPct: round1(fullW),
            heightPct: round1(nextH),
            scale: 1,
            cropBottom: 0,
            cropTop: round1(Math.min(85, (preservedTopPx / nextH) * 100)),
          });
        }
        return;
      }

      if (drag.handle === 'w') {
        let left = Math.max(0, Math.min(drag.initialRight - minSize, drag.initialLeft + dxPct));
        if (Math.abs(left) < 1.5) left = 0;

        const rawCropL = ((left - drag.initialFullLeft) / fullW) * 100;
        if (rawCropL >= 0) {
          onUpdateClipGeometry(drag.target.id, {
            x: round1(drag.initialFullLeft + fullW / 2),
            y: round1(drag.initialFullTop + fullH / 2),
            widthPct: round1(fullW),
            heightPct: round1(fullH),
            scale: 1,
            cropLeft: round1(Math.min(85 - drag.initialCropR, rawCropL)),
          });
        } else {
          const nextW = drag.initialFullRight - left;
          const preservedRightPx = (drag.initialCropR / 100) * fullW;
          onUpdateClipGeometry(drag.target.id, {
            x: round1(left + nextW / 2),
            y: round1(drag.initialFullTop + fullH / 2),
            widthPct: round1(nextW),
            heightPct: round1(fullH),
            scale: 1,
            cropLeft: 0,
            cropRight: round1(Math.min(85, (preservedRightPx / nextW) * 100)),
          });
        }
        return;
      }

      if (drag.handle === 'e') {
        let right = Math.min(100, Math.max(drag.initialLeft + minSize, drag.initialRight + dxPct));
        if (Math.abs(right - 100) < 1.5) right = 100;

        const rawCropR = ((drag.initialFullRight - right) / fullW) * 100;
        if (rawCropR >= 0) {
          onUpdateClipGeometry(drag.target.id, {
            x: round1(drag.initialFullLeft + fullW / 2),
            y: round1(drag.initialFullTop + fullH / 2),
            widthPct: round1(fullW),
            heightPct: round1(fullH),
            scale: 1,
            cropRight: round1(Math.min(85 - drag.initialCropL, rawCropR)),
          });
        } else {
          const nextW = right - drag.initialFullLeft;
          const preservedLeftPx = (drag.initialCropL / 100) * fullW;
          onUpdateClipGeometry(drag.target.id, {
            x: round1(drag.initialFullLeft + nextW / 2),
            y: round1(drag.initialFullTop + fullH / 2),
            widthPct: round1(nextW),
            heightPct: round1(fullH),
            scale: 1,
            cropRight: 0,
            cropLeft: round1(Math.min(85, (preservedLeftPx / nextW) * 100)),
          });
        }
        return;
      }

      // Corner handles resize/scale the clip box
      let left = drag.initialLeft;
      let right = drag.initialRight;
      let top = drag.initialTop;
      let bottom = drag.initialBottom;

      if (drag.handle.includes('w')) {
        left = Math.max(0, Math.min(right - minSize, drag.initialLeft + dxPct));
        if (Math.abs(left) < 1.5) left = 0;
      }
      if (drag.handle.includes('e')) {
        right = Math.min(
          100,
          Math.max(left + minSize, drag.initialRight + dxPct)
        );
        if (Math.abs(right - 100) < 1.5) right = 100;
      }
      if (drag.handle.includes('n')) {
        top = Math.max(0, Math.min(bottom - minSize, drag.initialTop + dyPct));
        if (Math.abs(top) < 1.5) top = 0;
        if (Math.abs(top - 50) < 2.0) top = 50;
      }
      if (drag.handle.includes('s')) {
        bottom = Math.min(
          100,
          Math.max(top + minSize, drag.initialBottom + dyPct)
        );
        if (Math.abs(bottom - 100) < 1.5) bottom = 100;
        if (Math.abs(bottom - 50) < 2.0) bottom = 50;
      }

      const visFracW = Math.max(0.15, 1 - (drag.initialCropL + drag.initialCropR) / 100);
      const visFracH = Math.max(0.15, 1 - (drag.initialCropT + drag.initialCropB) / 100);
      const nextFullW = Math.max(minSize, right - left) / visFracW;
      const nextFullH = Math.max(minSize, bottom - top) / visFracH;
      const nextFullLeft = left - (drag.initialCropL / 100) * nextFullW;
      const nextFullTop = top - (drag.initialCropT / 100) * nextFullH;

      onUpdateClipGeometry(drag.target.id, {
        x: round1(nextFullLeft + nextFullW / 2),
        y: round1(nextFullTop + nextFullH / 2),
        widthPct: round1(nextFullW),
        heightPct: round1(nextFullH),
        scale: 1,
      });
    }
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragStateRef.current) {
      dragStateRef.current = null;
      setHoverCursor('grab');
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore if pointer not captured
      }
    }
  };

  const aspectStyle =
    aspectRatio === '9:16'
      ? 'aspect-[9/16] h-full max-h-full'
      : aspectRatio === '1:1'
      ? 'aspect-square h-full max-h-full'
      : 'aspect-[16/9] w-full max-w-[620px]';

  return (
    <div
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          setIsFileDragOver(true);
        }
      }}
      onDragLeave={() => setIsFileDragOver(false)}
      onDrop={(e) => {
        if (e.dataTransfer.files?.length && onDropVideoFile) {
          e.preventDefault();
          setIsFileDragOver(false);
          onDropVideoFile(e.dataTransfer.files);
        } else {
          setIsFileDragOver(false);
        }
      }}
      className="flex-1 min-w-0 min-h-0 studio-stage-bg flex flex-col items-center justify-between p-3 select-none"
    >
      {/* Canvas Stage */}
      <div className="flex-1 min-h-0 w-full flex items-center justify-center py-0.5">
        <div
          className={`relative rounded-xl overflow-hidden border bg-black shadow-2xl flex items-center justify-center transition-colors ${aspectStyle} ${
            isFileDragOver
              ? 'border-[#C8FF00] ring-2 ring-[#C8FF00]/40'
              : 'border-[#262626]'
          }`}
        >
          <canvas
            ref={canvasRef}
            width={dims.width}
            height={dims.height}
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerUp}
            style={{ cursor: hoverCursor }}
            className="w-full h-full object-contain touch-none"
          />

          {baseClips.length === 0 && overlayClips.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-5 text-center bg-[#090909]/90">
              <input
                ref={emptyViralInputRef}
                type="file"
                accept="video/*,image/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length && onUploadVideoForTrack) {
                    onUploadVideoForTrack(e.target.files, 'base');
                    e.target.value = '';
                  }
                }}
              />
              <input
                ref={emptyReactionInputRef}
                type="file"
                accept="video/*,image/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length && onUploadVideoForTrack) {
                    onUploadVideoForTrack(e.target.files, 'overlay');
                    e.target.value = '';
                  }
                }}
              />

              <p className="font-display text-sm font-semibold text-white">
                Drop your media to start
              </p>
              <p className="text-[11px] text-[#888888] mt-1 mb-4 max-w-[210px]">
                Add a viral clip and a reaction video or photo to auto-build your split edit.
              </p>

              <div className="w-full max-w-[210px] space-y-2">
                <button
                  type="button"
                  onClick={() => emptyViralInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-[#C8FF00] hover:bg-[#b5e600] text-xs font-bold text-[#090909] transition-colors cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Import Viral Media</span>
                </button>
                <button
                  type="button"
                  onClick={() => emptyReactionInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-[#191919] border border-[#262626] hover:border-[#C8FF00] text-xs font-semibold text-white transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-[#C8FF00]" />
                  <span>Add Reaction Video / Photo</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Compact Playback Bar */}
      <div className="w-full max-w-md mt-2 bg-[#191919] border border-[#262626] rounded-lg px-3 py-1 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onSeek(0)}
            title="Restart"
            className="p-1.5 rounded text-[#888888] hover:text-white hover:bg-[#262626] transition-colors cursor-pointer"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onTogglePlay}
            title="Play / Pause (Space)"
            className="w-7 h-7 rounded-full bg-[#C8FF00] hover:bg-[#b5e600] text-[#090909] flex items-center justify-center transition-colors cursor-pointer font-bold"
          >
            {isPlaying ? (
              <Pause className="w-3.5 h-3.5 fill-current" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
            )}
          </button>
        </div>

        <div className="font-mono-tabular text-xs text-white flex items-center gap-1.5">
          <span className="text-white font-medium">
            {formatTimecode(currentTime)}
          </span>
          <span className="text-[#888888]">/</span>
          <span className="text-[#888888]">{formatTimecode(duration)}</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onSplitAtPlayhead}
            title="Split clip (S)"
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-[#888888] hover:text-white hover:bg-[#262626] transition-colors cursor-pointer"
          >
            <Scissors className="w-3.5 h-3.5" />
            <span>Split</span>
          </button>

          {aspectRatio === '9:16' && (
            <button
              type="button"
              onClick={() => setShowSafeZone((s) => !s)}
              title="Toggle 9:16 Safe Zone guide"
              className={`p-1.5 rounded transition-colors cursor-pointer ${
                showSafeZone
                  ? 'text-[#C8FF00] bg-[#262626]'
                  : 'text-[#888888] hover:text-white hover:bg-[#262626]'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={onToggleLoop}
            title="Loop playback"
            className={`p-1.5 rounded transition-colors cursor-pointer ${
              isLooping
                ? 'text-[#C8FF00] bg-[#262626]'
                : 'text-[#888888] hover:text-white hover:bg-[#262626]'
            }`}
          >
            <Repeat className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
