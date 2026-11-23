import React, { useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Film,
  Layers,
  Magnet,
  Maximize,
  Music,
  Pause,
  Play,
  Repeat,
  Scissors,
  SeparatorHorizontal,
  SkipBack,
  Smartphone,
  Sparkles,
  Trash2,
  Type,
  Volume2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  MediaAsset,
  MusicClip,
  OverlayLayoutPreset,
  SeamDividerConfig,
  SelectionTarget,
  SoundEffectClip,
  TextOverlay,
  VideoClip,
} from '../types/editor';

interface TimelinePanelProps {
  currentTime: number;
  duration: number;
  isPlaying?: boolean;
  isLooping?: boolean;
  showSafeZone?: boolean;
  seamDivider?: SeamDividerConfig;
  activeLayout?: OverlayLayoutPreset;
  baseClips: VideoClip[];
  overlayClips: VideoClip[];
  textOverlays: TextOverlay[];
  soundEffects: SoundEffectClip[];
  musicClips: MusicClip[];
  assetsById?: Map<string, MediaAsset>;
  selection: SelectionTarget;
  onTogglePlay?: () => void;
  onToggleLoop?: () => void;
  onToggleSafeZone?: () => void;
  onToggleFrosted?: () => void;
  onToggleSeamlessBlend?: () => void;
  onSeek: (time: number) => void;
  onSelect: (target: SelectionTarget) => void;
  onUpdateClipTiming: (
    clipId: string,
    startTime: number,
    duration: number
  ) => void;
  onUpdateTextTiming: (
    textId: string,
    startTime: number,
    duration: number
  ) => void;
  onUpdateSfxTiming: (sfxId: string, startTime: number) => void;
  onUpdateMusicTiming: (
    musicId: string,
    startTime: number,
    duration: number
  ) => void;
  onSplitAtPlayhead: () => void;
  onDeleteSelected: () => void;
}

function formatCompactTimecode(seconds: number): string {
  const safe = Math.max(0, seconds);
  const mins = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  const cs = Math.floor((safe % 1) * 100);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(
    2,
    '0'
  )}.${String(cs).padStart(2, '0')}`;
}

function formatRulerTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

const SoundWaveBars: React.FC<{ active: boolean }> = ({ active }) => (
  <div
    className="flex items-end gap-[1.5px] h-2 px-0.5 shrink-0"
    title={active ? 'Audio active & playing' : 'Audio track'}
  >
    <span
      className={`w-[1.5px] rounded-full bg-current transition-all ${
        active ? 'animate-pulse' : 'opacity-60'
      }`}
      style={{ height: '65%', animationDuration: '0.38s' }}
    />
    <span
      className={`w-[1.5px] rounded-full bg-current transition-all ${
        active ? 'animate-pulse' : 'opacity-60'
      }`}
      style={{ height: '100%', animationDuration: '0.24s' }}
    />
    <span
      className={`w-[1.5px] rounded-full bg-current transition-all ${
        active ? 'animate-pulse' : 'opacity-60'
      }`}
      style={{ height: '45%', animationDuration: '0.48s' }}
    />
  </div>
);

/**
 * CapCut-style continuous audio waveform strip spanning the clip width.
 */
const AudioWaveformStrip: React.FC<{
  seedKey: string;
  widthPx: number;
  active: boolean;
  colorClass: string;
}> = ({ seedKey, widthPx, active, colorClass }) => {
  const barCount = Math.max(8, Math.min(110, Math.floor(widthPx / 4)));
  const heights = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < seedKey.length; i++) {
      hash = (hash * 31 + seedKey.charCodeAt(i)) >>> 0;
    }
    const list: number[] = [];
    for (let i = 0; i < barCount; i++) {
      const n = Math.abs(
        Math.sin(hash * 0.017 + i * 0.72) * Math.cos(i * 0.29 + 0.5)
      );
      list.push(Math.max(20, Math.round(22 + n * 76)));
    }
    return list;
  }, [seedKey, barCount]);

  return (
    <div
      aria-hidden="true"
      className={`absolute inset-x-1 bottom-0 top-1.5 flex items-end gap-[1.5px] pointer-events-none overflow-hidden opacity-55 ${colorClass}`}
    >
      {heights.map((h, idx) => (
        <span
          key={idx}
          className={`flex-1 min-w-[1.5px] max-w-[2px] rounded-t-[1px] bg-current transition-opacity ${
            active ? 'animate-pulse' : 'opacity-80'
          }`}
          style={{
            height: `${h}%`,
            animationDuration: active ? `${0.35 + (idx % 5) * 0.09}s` : undefined,
          }}
        />
      ))}
    </div>
  );
};

/**
 * CapCut-style drag-trim handles aligned with the app's white/lime palette.
 */
const TrimHandles: React.FC<{
  isSelected: boolean;
  accentHoverClass: string;
  onTrimLeft: (e: React.PointerEvent) => void;
  onTrimRight: (e: React.PointerEvent) => void;
}> = ({ isSelected, accentHoverClass, onTrimLeft, onTrimRight }) => (
  <>
    <div
      onPointerDown={onTrimLeft}
      title="Trim start"
      className={`absolute left-0 top-0 bottom-0 z-20 cursor-ew-resize flex items-center justify-center transition-all ${
        isSelected
          ? 'w-2 bg-white rounded-l-[3px]'
          : `w-1.5 opacity-0 group-hover/clip:opacity-100 ${accentHoverClass}`
      }`}
    >
      {isSelected && <span className="w-[1.5px] h-2.5 rounded-full bg-[#090909]" />}
    </div>
    <div
      onPointerDown={onTrimRight}
      title="Trim end"
      className={`absolute right-0 top-0 bottom-0 z-20 cursor-ew-resize flex items-center justify-center transition-all ${
        isSelected
          ? 'w-2 bg-white rounded-r-[3px]'
          : `w-1.5 opacity-0 group-hover/clip:opacity-100 ${accentHoverClass}`
      }`}
    >
      {isSelected && <span className="w-[1.5px] h-2.5 rounded-full bg-[#090909]" />}
    </div>
  </>
);

export const TimelinePanel: React.FC<TimelinePanelProps> = ({
  currentTime,
  duration,
  isPlaying = false,
  isLooping = false,
  showSafeZone = false,
  seamDivider,
  activeLayout,
  baseClips,
  overlayClips,
  textOverlays,
  soundEffects,
  musicClips,
  assetsById,
  selection,
  onTogglePlay,
  onToggleLoop,
  onToggleSafeZone,
  onToggleFrosted,
  onToggleSeamlessBlend,
  onSeek,
  onSelect,
  onUpdateClipTiming,
  onUpdateTextTiming,
  onUpdateSfxTiming,
  onUpdateMusicTiming,
  onSplitAtPlayhead,
  onDeleteSelected,
}) => {
  const [pxPerSec, setPxPerSec] = useState(52);
  const [timelineHeight, setTimelineHeight] = useState(134);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [snapTime, setSnapTime] = useState<number | null>(null);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const trackContainerRef = useRef<HTMLDivElement>(null);

  const handleResizePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = isCollapsed ? 32 : timelineHeight;
    setIsResizing(true);

    const onMove = (ev: PointerEvent) => {
      const deltaY = startY - ev.clientY;
      const nextHeight = startHeight + deltaY;
      if (nextHeight < 76) {
        setIsCollapsed(true);
      } else {
        setIsCollapsed(false);
        setTimelineHeight(Math.max(114, Math.min(260, nextHeight)));
      }
    };

    const onUp = () => {
      setIsResizing(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const totalTimelineWidth = Math.max(680, (duration + 4) * pxPerSec);

  const scrubFromClientX = (clientX: number) => {
    const el = trackContainerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left + el.scrollLeft;
    const nextTime = Math.max(0, Math.min(duration, x / pxPerSec));
    onSeek(nextTime);
  };

  const handleRulerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    scrubFromClientX(e.clientX);
    const onMove = (ev: PointerEvent) => scrubFromClientX(ev.clientX);
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const handleFitTimeline = () => {
    const el = trackContainerRef.current;
    if (!el || duration <= 0) return;
    const visibleWidth = Math.max(300, el.clientWidth - 48);
    const fitPx = Math.max(
      18,
      Math.min(100, Math.floor(visibleWidth / (duration + 0.8)))
    );
    setPxPerSec(fitPx);
  };

  const startDragItem = (
    e: React.PointerEvent,
    mode: 'move' | 'trim-left' | 'trim-right',
    kind: 'clip' | 'text' | 'sfx' | 'music',
    id: string,
    initialStart: number,
    initialDur: number
  ) => {
    e.stopPropagation();
    onSelect({ kind, id });
    const startX = e.clientX;

    const snapTargets = new Set<number>([0, Number(currentTime.toFixed(2))]);
    const collectItem = (itemId: string, start: number, dur: number) => {
      if (itemId === id) return;
      snapTargets.add(Number(start.toFixed(2)));
      snapTargets.add(Number((start + dur).toFixed(2)));
    };
    baseClips.forEach((c) => collectItem(c.id, c.startTime, c.duration));
    overlayClips.forEach((c) => collectItem(c.id, c.startTime, c.duration));
    textOverlays.forEach((t) => collectItem(t.id, t.startTime, t.duration));
    soundEffects.forEach((s) => collectItem(s.id, s.startTime, s.duration));
    musicClips.forEach((m) => collectItem(m.id, m.startTime, m.duration));
    const sortedSnaps = Array.from(snapTargets);
    const snapThreshold = 0.14;

    const findSnap = (val: number): number | null => {
      if (!snapEnabled) return null;
      let best: number | null = null;
      let bestDist = snapThreshold;
      for (const target of sortedSnaps) {
        const d = Math.abs(val - target);
        if (d < bestDist) {
          bestDist = d;
          best = target;
        }
      }
      return best;
    };

    const onMove = (ev: PointerEvent) => {
      const deltaSec = (ev.clientX - startX) / pxPerSec;
      let nextStart = initialStart;
      let nextDur = initialDur;
      let matchedSnap: number | null = null;

      if (mode === 'move') {
        const rawStart = Math.max(
          0,
          Math.round((initialStart + deltaSec) * 10) / 10
        );
        const startSnap = findSnap(rawStart);
        const endSnap = findSnap(rawStart + initialDur);
        if (startSnap !== null) {
          nextStart = startSnap;
          matchedSnap = startSnap;
        } else if (endSnap !== null) {
          nextStart = Math.max(0, Number((endSnap - initialDur).toFixed(2)));
          matchedSnap = endSnap;
        } else {
          nextStart = rawStart;
        }
      } else if (mode === 'trim-left') {
        const clampedDelta = Math.min(deltaSec, initialDur - 0.4);
        const rawStart = Math.max(
          0,
          Math.round((initialStart + clampedDelta) * 10) / 10
        );
        const startSnap = findSnap(rawStart);
        if (
          startSnap !== null &&
          initialStart + initialDur - startSnap >= 0.4
        ) {
          nextStart = startSnap;
          matchedSnap = startSnap;
        } else {
          nextStart = rawStart;
        }
        nextDur = Math.max(0.4, initialDur - (nextStart - initialStart));
      } else {
        const rawDur = Math.max(
          0.4,
          Math.round((initialDur + deltaSec) * 10) / 10
        );
        const endSnap = findSnap(initialStart + rawDur);
        if (endSnap !== null && endSnap - initialStart >= 0.4) {
          nextDur = Number((endSnap - initialStart).toFixed(2));
          matchedSnap = endSnap;
        } else {
          nextDur = rawDur;
        }
      }

      setSnapTime(matchedSnap);

      if (kind === 'clip') {
        onUpdateClipTiming(id, nextStart, nextDur);
      } else if (kind === 'text') {
        onUpdateTextTiming(id, nextStart, nextDur);
      } else if (kind === 'music') {
        onUpdateMusicTiming(id, nextStart, nextDur);
      } else {
        onUpdateSfxTiming(id, nextStart);
      }
    };

    const onUp = () => {
      setSnapTime(null);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const tickStep = pxPerSec < 32 ? 4 : pxPerSec < 64 ? 2 : 1;
  const maxSeconds = Math.ceil(duration + 4);
  const majorTicks: number[] = [];
  for (let s = 0; s <= maxSeconds; s += tickStep) {
    majorTicks.push(s);
  }

  const isFrostedActive =
    seamDivider?.enabled &&
    seamDivider.color.toLowerCase() === '#ffffff' &&
    seamDivider.secondaryColor.toLowerCase() === '#d4d4d8';

  return (
    <section
      style={{ height: isCollapsed ? 32 : timelineHeight }}
      className={`shrink-0 bg-[#141416]/95 backdrop-blur-md border-t border-[#262626] flex flex-col select-none relative shadow-[0_-8px_28px_rgba(0,0,0,0.65)] ${
        isResizing ? '' : 'transition-[height] duration-200 ease-out'
      }`}
    >
      {/* Top Drag-to-Resize Handle */}
      <div
        onPointerDown={handleResizePointerDown}
        onDoubleClick={() => setIsCollapsed((c) => !c)}
        title="Drag up/down to resize timeline · Double-click to collapse"
        className="h-1 w-full bg-[#191919] hover:bg-[#262626] flex items-center justify-center cursor-ns-resize shrink-0 group"
      >
        <div className="w-8 h-0.5 rounded-full bg-[#333333] group-hover:bg-[#C8FF00] transition-colors" />
      </div>

      {/* Ultra-Compact Studio Toolbar */}
      <div className="h-[26px] px-2.5 bg-[#141416] border-b border-[#262626] flex items-center justify-between gap-2 shrink-0 overflow-x-auto no-scrollbar">
        {/* Left: Split, Delete, Magnet, Quick Blend/Frosted */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onSplitAtPlayhead}
            title="Split clip at playhead (S)"
            className="h-[19px] px-1.5 rounded bg-[#191919] hover:bg-[#262626] hover:text-[#C8FF00] border border-[#262626] text-[10px] font-medium text-white flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Scissors className="w-2.5 h-2.5" />
            <span className="hidden sm:inline">Split</span>
          </button>

          <button
            type="button"
            onClick={onDeleteSelected}
            disabled={!selection}
            title="Delete selected item (Del)"
            className="h-[19px] px-1.5 rounded bg-[#191919] hover:bg-[#262626] hover:text-red-400 border border-[#262626] text-[10px] font-medium text-white disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Trash2 className="w-2.5 h-2.5" />
            <span className="hidden sm:inline">Delete</span>
          </button>

          <button
            type="button"
            onClick={() => setSnapEnabled((s) => !s)}
            title={snapEnabled ? 'Magnetic snap ON' : 'Magnetic snap OFF'}
            className={`h-[19px] w-[19px] rounded border flex items-center justify-center transition-colors cursor-pointer ${
              snapEnabled
                ? 'bg-[#262626] border-[#C8FF00]/60 text-[#C8FF00]'
                : 'bg-[#090909] border-[#262626] text-[#888888] hover:text-white'
            }`}
          >
            <Magnet className="w-2.5 h-2.5" />
          </button>

          <div className="h-3 w-px bg-[#262626] mx-0.5" />

          {onToggleSeamlessBlend && (
            <button
              type="button"
              onClick={onToggleSeamlessBlend}
              title="Toggle Seamless Blend layout"
              className={`h-[19px] px-1.5 rounded border text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                activeLayout === 'split-blend'
                  ? 'bg-[#C8FF00] border-[#C8FF00] text-[#090909]'
                  : 'bg-[#191919] border-[#262626] text-white hover:border-[#C8FF00]'
              }`}
            >
              <Sparkles
                className={`w-2.5 h-2.5 ${
                  activeLayout === 'split-blend'
                    ? 'text-[#090909]'
                    : 'text-[#C8FF00]'
                }`}
              />
              <span className="hidden md:inline">Seamless Blend</span>
              <span className="md:hidden">Blend</span>
            </button>
          )}

          {onToggleFrosted && (
            <button
              type="button"
              onClick={onToggleFrosted}
              title="Toggle Frosted glass seam blur"
              className={`h-[19px] px-1.5 rounded border text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                isFrostedActive
                  ? 'bg-[#C8FF00] border-[#C8FF00] text-[#090909]'
                  : 'bg-[#191919] border-[#262626] text-white hover:border-[#C8FF00]'
              }`}
            >
              <SeparatorHorizontal
                className={`w-2.5 h-2.5 ${
                  isFrostedActive ? 'text-[#090909]' : 'text-[#C8FF00]'
                }`}
              />
              <span>Frosted</span>
            </button>
          )}
        </div>

        {/* Center: Playback + Live Timecode */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onSeek(0)}
            title="Restart"
            className="w-[19px] h-[19px] rounded text-[#888888] hover:text-white hover:bg-[#262626] flex items-center justify-center transition-colors cursor-pointer"
          >
            <SkipBack className="w-2.5 h-2.5" />
          </button>

          {onTogglePlay && (
            <button
              type="button"
              onClick={onTogglePlay}
              title="Play / Pause (Space)"
              className="w-[19px] h-[19px] rounded-full bg-[#C8FF00] hover:bg-[#b5e600] text-[#090909] flex items-center justify-center transition-colors cursor-pointer"
            >
              {isPlaying ? (
                <Pause className="w-2.5 h-2.5 fill-current" />
              ) : (
                <Play className="w-2.5 h-2.5 fill-current ml-0.5" />
              )}
            </button>
          )}

          <div className="flex items-center gap-1 font-mono-tabular text-[10px] leading-none px-1.5 py-0.5 rounded bg-[#090909] border border-[#262626]">
            <span className="text-[#C8FF00] font-semibold">
              {formatCompactTimecode(currentTime)}
            </span>
            <span className="text-[#555555]">/</span>
            <span className="text-[#888888]">
              {formatCompactTimecode(duration)}
            </span>
          </div>
        </div>

        {/* Right: Safe Zone, Loop, Zoom Slider, FIT & Collapse */}
        <div className="flex items-center gap-1 shrink-0">
          {onToggleSafeZone && (
            <button
              type="button"
              onClick={onToggleSafeZone}
              title="Toggle 9:16 Safe Zone guide"
              className={`h-[19px] w-[19px] rounded border flex items-center justify-center transition-colors cursor-pointer ${
                showSafeZone
                  ? 'bg-[#262626] border-[#C8FF00] text-[#C8FF00]'
                  : 'bg-[#090909] border-[#262626] text-[#888888] hover:text-white'
              }`}
            >
              <Smartphone className="w-2.5 h-2.5" />
            </button>
          )}

          {onToggleLoop && (
            <button
              type="button"
              onClick={onToggleLoop}
              title="Loop playback"
              className={`h-[19px] w-[19px] rounded border flex items-center justify-center transition-colors cursor-pointer ${
                isLooping
                  ? 'bg-[#262626] border-[#C8FF00] text-[#C8FF00]'
                  : 'bg-[#090909] border-[#262626] text-[#888888] hover:text-white'
              }`}
            >
              <Repeat className="w-2.5 h-2.5" />
            </button>
          )}

          <div className="flex items-center gap-1 bg-[#090909] border border-[#262626] rounded h-[19px] px-1">
            <button
              type="button"
              onClick={() => setPxPerSec((z) => Math.max(18, z - 10))}
              title="Zoom out"
              className="text-[#888888] hover:text-[#C8FF00] transition-colors cursor-pointer"
            >
              <ZoomOut className="w-2.5 h-2.5" />
            </button>
            <input
              type="range"
              min={18}
              max={104}
              value={pxPerSec}
              onChange={(e) => setPxPerSec(Number(e.target.value))}
              aria-label="Timeline zoom"
              className="w-12 hidden sm:block"
            />
            <button
              type="button"
              onClick={() => setPxPerSec((z) => Math.min(104, z + 10))}
              title="Zoom in"
              className="text-[#888888] hover:text-[#C8FF00] transition-colors cursor-pointer"
            >
              <ZoomIn className="w-2.5 h-2.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleFitTimeline}
            title="Auto-fit timeline to view"
            className="h-[19px] px-1.5 rounded bg-[#090909] hover:bg-[#191919] hover:text-[#C8FF00] border border-[#262626] text-[9px] font-mono-tabular font-semibold text-[#888888] flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Maximize className="w-2.5 h-2.5" />
            <span className="hidden sm:inline">FIT</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCollapsed((c) => !c)}
            title={isCollapsed ? 'Expand timeline' : 'Collapse timeline'}
            aria-label={isCollapsed ? 'Expand timeline' : 'Collapse timeline'}
            className={`h-[19px] px-1.5 rounded border text-[9px] font-mono-tabular font-medium flex items-center gap-1 transition-colors cursor-pointer ${
              isCollapsed
                ? 'bg-[#C8FF00] border-[#C8FF00] text-[#090909] font-bold hover:bg-[#b5e600]'
                : 'bg-[#090909] border-[#262626] text-[#888888] hover:bg-[#191919] hover:text-[#C8FF00]'
            }`}
          >
            {isCollapsed ? (
              <>
                <ChevronUp className="w-2.5 h-2.5" />
                <span>Timeline</span>
              </>
            ) : (
              <ChevronDown className="w-2.5 h-2.5" />
            )}
          </button>
        </div>
      </div>

      {/* Compact Track Rail + CapCut-Style Tracks Canvas */}
      {!isCollapsed && (
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden flex bg-[#090909]">
          {/* Left Compact Track Header Column */}
          <div className="w-[64px] shrink-0 border-r border-[#262626] bg-[#111111] flex flex-col z-20">
            <div className="h-[15px] sticky top-0 z-30 border-b border-[#262626] bg-[#141416] px-1.5 flex items-center justify-between text-[8px] font-mono-tabular font-semibold text-[#888888] uppercase tracking-wider shrink-0">
              <span>TRK</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#C8FF00]" />
            </div>

            <div className="flex flex-col gap-[1px] py-[2px] px-1">
              {/* T1 */}
              <div className="h-[14px] rounded-[3px] px-1 flex items-center gap-1">
                <Type className="w-2.5 h-2.5 text-[#FACC15] shrink-0" />
                <span className="text-[9px] font-medium text-[#888888] truncate leading-none">
                  Text
                </span>
              </div>

              {/* V2 */}
              <div className="h-[17px] rounded-[3px] px-1 flex items-center gap-1">
                <Layers className="w-2.5 h-2.5 text-[#38BDF8] shrink-0" />
                <span className="text-[9px] font-medium text-[#888888] truncate leading-none">
                  PIP
                </span>
              </div>

              {/* V1 Main Track */}
              <div className="h-[21px] rounded-[3px] bg-[#191919] border border-[#262626] px-1 flex items-center gap-1">
                <Film className="w-2.5 h-2.5 text-[#C8FF00] shrink-0" />
                <span className="text-[9px] font-semibold text-white truncate leading-none">
                  Main
                </span>
              </div>

              {/* A1 SFX */}
              <div className="h-[14px] rounded-[3px] px-1 flex items-center gap-1">
                <Volume2 className="w-2.5 h-2.5 text-[#34D399] shrink-0" />
                <span className="text-[9px] font-medium text-[#888888] truncate leading-none">
                  SFX
                </span>
              </div>

              {/* M1 Music */}
              <div className="h-[15px] rounded-[3px] px-1 flex items-center gap-1">
                <Music className="w-2.5 h-2.5 text-[#C084FC] shrink-0" />
                <span className="text-[9px] font-medium text-[#888888] truncate leading-none">
                  Music
                </span>
              </div>
            </div>
          </div>

          {/* Scrollable Tracks Canvas with Lime Shield Playhead */}
          <div
            ref={trackContainerRef}
            onClick={() => onSelect(null)}
            className="flex-1 min-w-0 overflow-x-auto overflow-y-hidden relative bg-[#090909]"
          >
            <div
              style={{ width: totalTimelineWidth }}
              className="min-h-full relative flex flex-col"
            >
              {/* Compact Precision Tick Ruler (h-[15px]) */}
              <div
                onPointerDown={handleRulerPointerDown}
                className="h-[15px] sticky top-0 z-20 border-b border-[#262626] bg-[#141416] relative cursor-ew-resize shrink-0 select-none"
              >
                {majorTicks.map((sec) => (
                  <React.Fragment key={sec}>
                    <div
                      style={{ left: sec * pxPerSec }}
                      className="absolute top-0 bottom-0 flex flex-col justify-between pointer-events-none"
                    >
                      <span className="text-[8px] font-mono-tabular text-[#888888] pl-1 pt-[1px] leading-none">
                        {formatRulerTime(sec)}
                      </span>
                      <div className="w-px h-1.5 bg-[#444444]" />
                    </div>
                    {[0.25, 0.5, 0.75].map((sub) => {
                      const subSec = sec + sub * tickStep;
                      if (subSec > maxSeconds) return null;
                      return (
                        <div
                          key={`${sec}-${sub}`}
                          style={{ left: subSec * pxPerSec }}
                          className={`absolute bottom-0 w-px pointer-events-none ${
                            sub === 0.5
                              ? 'h-1 bg-[#333333]'
                              : 'h-[2px] bg-[#242424]'
                          }`}
                        />
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>

              {/* 5 Ultra-Compact CapCut-Style Tracks */}
              <div className="flex flex-col gap-[1px] py-[2px] relative">
                {/* T1 - Text Track (14px) */}
                <div className="h-[14px] relative bg-[#0e0e11] flex items-center">
                  {textOverlays.map((txt) => {
                    const isSel =
                      selection?.kind === 'text' && selection.id === txt.id;
                    const itemWidth = Math.max(24, txt.duration * pxPerSec);
                    return (
                      <div
                        key={txt.id}
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) =>
                          startDragItem(
                            e,
                            'move',
                            'text',
                            txt.id,
                            txt.startTime,
                            txt.duration
                          )
                        }
                        style={{
                          left: txt.startTime * pxPerSec,
                          width: itemWidth,
                        }}
                        className={`group/clip h-[13px] absolute rounded-[3px] flex items-center cursor-grab active:cursor-grabbing overflow-hidden transition-shadow ${
                          isSel
                            ? 'bg-[#362c0e] border border-[#C8FF00] text-white z-10 px-2.5'
                            : 'bg-[#201d10] border border-[#443b1c] text-[#FDE047] hover:border-[#FACC15] px-1'
                        }`}
                      >
                        <TrimHandles
                          isSelected={isSel}
                          accentHoverClass="bg-[#FACC15]/80"
                          onTrimLeft={(e) =>
                            startDragItem(
                              e,
                              'trim-left',
                              'text',
                              txt.id,
                              txt.startTime,
                              txt.duration
                            )
                          }
                          onTrimRight={(e) =>
                            startDragItem(
                              e,
                              'trim-right',
                              'text',
                              txt.id,
                              txt.startTime,
                              txt.duration
                            )
                          }
                        />
                        <span className="text-[8px] font-medium truncate flex-1 leading-none">
                          {txt.text}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* V2 - PIP / Overlay Filmstrip Track (17px) */}
                <div className="h-[17px] relative bg-[#0b1014] flex items-center">
                  {overlayClips.map((clip) => {
                    const isSel =
                      selection?.kind === 'clip' && selection.id === clip.id;
                    const itemWidth = Math.max(28, clip.duration * pxPerSec);
                    const thumbUrl = assetsById?.get(clip.assetId)?.thumbnailUrl;
                    return (
                      <div
                        key={clip.id}
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) =>
                          startDragItem(
                            e,
                            'move',
                            'clip',
                            clip.id,
                            clip.startTime,
                            clip.duration
                          )
                        }
                        style={{
                          left: clip.startTime * pxPerSec,
                          width: itemWidth,
                        }}
                        className={`group/clip h-[16px] absolute rounded-[3px] cursor-grab active:cursor-grabbing overflow-hidden transition-shadow ${
                          isSel
                            ? 'border border-[#C8FF00] ring-1 ring-[#C8FF00]/50 z-10'
                            : 'border border-[#1b4352] hover:border-[#38BDF8]'
                        }`}
                      >
                        {thumbUrl ? (
                          <div
                            className="absolute inset-0 bg-[#0e2129]"
                            style={{
                              backgroundImage: `url(${thumbUrl})`,
                              backgroundRepeat: 'repeat-x',
                              backgroundSize: 'auto 100%',
                              backgroundPosition: 'left center',
                            }}
                          />
                        ) : (
                          <div className="absolute inset-0 bg-[#0e2129]" />
                        )}
                        <div
                          className="absolute inset-0 pointer-events-none"
                          style={{
                            backgroundImage:
                              'repeating-linear-gradient(90deg, transparent 0px, transparent 23px, rgba(0,0,0,0.45) 23px, rgba(0,0,0,0.45) 24px)',
                          }}
                        />
                        <div className="absolute inset-0 bg-black/35 pointer-events-none" />

                        <TrimHandles
                          isSelected={isSel}
                          accentHoverClass="bg-[#38BDF8]/80"
                          onTrimLeft={(e) =>
                            startDragItem(
                              e,
                              'trim-left',
                              'clip',
                              clip.id,
                              clip.startTime,
                              clip.duration
                            )
                          }
                          onTrimRight={(e) =>
                            startDragItem(
                              e,
                              'trim-right',
                              'clip',
                              clip.id,
                              clip.startTime,
                              clip.duration
                            )
                          }
                        />

                        <div
                          className={`relative z-10 h-full flex items-center justify-between ${
                            isSel ? 'px-2.5' : 'px-1'
                          }`}
                        >
                          <span className="text-[8px] font-medium text-[#E0F2FE] drop-shadow truncate leading-none">
                            {clip.label}
                          </span>
                          {itemWidth > 62 && (
                            <span className="text-[7px] font-mono-tabular text-[#BAE6FD] leading-none shrink-0 ml-1">
                              {clip.duration.toFixed(1)}s
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* V1 - Main Filmstrip Track (21px) */}
                <div className="h-[21px] relative bg-[#121214] border-y border-[#222226] flex items-center">
                  {baseClips.map((clip) => {
                    const isSel =
                      selection?.kind === 'clip' && selection.id === clip.id;
                    const itemWidth = Math.max(30, clip.duration * pxPerSec);
                    const thumbUrl = assetsById?.get(clip.assetId)?.thumbnailUrl;
                    return (
                      <div
                        key={clip.id}
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) =>
                          startDragItem(
                            e,
                            'move',
                            'clip',
                            clip.id,
                            clip.startTime,
                            clip.duration
                          )
                        }
                        style={{
                          left: clip.startTime * pxPerSec,
                          width: itemWidth,
                        }}
                        className={`group/clip h-[19px] absolute rounded-[4px] cursor-grab active:cursor-grabbing overflow-hidden transition-shadow ${
                          isSel
                            ? 'border border-[#C8FF00] ring-1 ring-[#C8FF00]/50 z-10'
                            : 'border border-[#333338] hover:border-[#C8FF00]/75'
                        }`}
                      >
                        {thumbUrl ? (
                          <div
                            className="absolute inset-0 bg-[#191919]"
                            style={{
                              backgroundImage: `url(${thumbUrl})`,
                              backgroundRepeat: 'repeat-x',
                              backgroundSize: 'auto 100%',
                              backgroundPosition: 'left center',
                            }}
                          />
                        ) : (
                          <div className="absolute inset-0 bg-[#1f1f24]" />
                        )}
                        <div
                          className="absolute inset-0 pointer-events-none"
                          style={{
                            backgroundImage:
                              'repeating-linear-gradient(90deg, transparent 0px, transparent 27px, rgba(0,0,0,0.48) 27px, rgba(0,0,0,0.48) 28px)',
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/25 to-black/45 pointer-events-none" />

                        <TrimHandles
                          isSelected={isSel}
                          accentHoverClass="bg-[#C8FF00]/80"
                          onTrimLeft={(e) =>
                            startDragItem(
                              e,
                              'trim-left',
                              'clip',
                              clip.id,
                              clip.startTime,
                              clip.duration
                            )
                          }
                          onTrimRight={(e) =>
                            startDragItem(
                              e,
                              'trim-right',
                              'clip',
                              clip.id,
                              clip.startTime,
                              clip.duration
                            )
                          }
                        />

                        <div
                          className={`relative z-10 h-full flex items-center justify-between ${
                            isSel ? 'px-2.5' : 'px-1.5'
                          }`}
                        >
                          <span className="text-[9px] font-semibold text-white drop-shadow truncate leading-none">
                            {clip.label}
                          </span>
                          {itemWidth > 62 && (
                            <span className="text-[8px] font-mono-tabular text-[#d4d4d8] drop-shadow leading-none shrink-0 ml-1">
                              {clip.duration.toFixed(1)}s
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* A1 - SFX Waveform Track (14px) */}
                <div className="h-[14px] relative bg-[#09120e] flex items-center">
                  {soundEffects.map((sfx) => {
                    const isSel =
                      selection?.kind === 'sfx' && selection.id === sfx.id;
                    const itemWidth = Math.max(36, sfx.duration * pxPerSec);
                    return (
                      <div
                        key={sfx.id}
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) =>
                          startDragItem(
                            e,
                            'move',
                            'sfx',
                            sfx.id,
                            sfx.startTime,
                            sfx.duration
                          )
                        }
                        style={{
                          left: sfx.startTime * pxPerSec,
                          width: itemWidth,
                        }}
                        className={`h-[13px] absolute rounded-[3px] px-1 flex items-center justify-between cursor-grab active:cursor-grabbing overflow-hidden transition-shadow ${
                          isSel
                            ? 'bg-[#123828] border border-[#C8FF00] text-white z-10'
                            : 'bg-[#0f261d] border border-[#1d4f3b] text-[#6EE7B7] hover:border-[#34D399]'
                        }`}
                      >
                        <AudioWaveformStrip
                          seedKey={sfx.id + sfx.label}
                          widthPx={itemWidth}
                          active={isPlaying}
                          colorClass="text-[#34D399]"
                        />
                        <span className="relative z-10 text-[8px] font-medium truncate leading-none">
                          {sfx.label}
                        </span>
                        <div className="relative z-10">
                          <SoundWaveBars active={isPlaying} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* M1 - Music Waveform Track (15px) */}
                <div className="h-[15px] relative bg-[#110a1a] flex items-center">
                  {musicClips.map((mus) => {
                    const isSel =
                      selection?.kind === 'music' && selection.id === mus.id;
                    const itemWidth = Math.max(40, mus.duration * pxPerSec);
                    return (
                      <div
                        key={mus.id}
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) =>
                          startDragItem(
                            e,
                            'move',
                            'music',
                            mus.id,
                            mus.startTime,
                            mus.duration
                          )
                        }
                        style={{
                          left: mus.startTime * pxPerSec,
                          width: itemWidth,
                        }}
                        className={`group/clip h-[14px] absolute rounded-[3px] flex items-center justify-between cursor-grab active:cursor-grabbing overflow-hidden transition-shadow ${
                          isSel
                            ? 'bg-[#331a4f] border border-[#C8FF00] text-white z-10 px-2.5'
                            : 'bg-[#211233] border border-[#4c2973] text-[#D8B4FE] hover:border-[#C084FC] px-1'
                        }`}
                      >
                        <AudioWaveformStrip
                          seedKey={mus.id + mus.label}
                          widthPx={itemWidth}
                          active={isPlaying}
                          colorClass="text-[#C084FC]"
                        />
                        <TrimHandles
                          isSelected={isSel}
                          accentHoverClass="bg-[#C084FC]/80"
                          onTrimLeft={(e) =>
                            startDragItem(
                              e,
                              'trim-left',
                              'music',
                              mus.id,
                              mus.startTime,
                              mus.duration
                            )
                          }
                          onTrimRight={(e) =>
                            startDragItem(
                              e,
                              'trim-right',
                              'music',
                              mus.id,
                              mus.startTime,
                              mus.duration
                            )
                          }
                        />
                        <span className="relative z-10 text-[8px] font-medium truncate leading-none">
                          {mus.label}
                        </span>
                        <div className="relative z-10 flex items-center gap-1 shrink-0">
                          <SoundWaveBars active={isPlaying} />
                          {itemWidth > 68 && (
                            <span className="text-[7px] font-mono-tabular opacity-80 leading-none">
                              {mus.duration.toFixed(1)}s
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Studio Electric Lime Playhead + Shield Head */}
              <div
                style={{ left: currentTime * pxPerSec }}
                className="absolute top-0 bottom-0 w-[1.5px] bg-[#C8FF00] shadow-[0_0_8px_rgba(200,255,0,0.55)] pointer-events-none z-30"
              >
                <svg
                  width="10"
                  height="11"
                  viewBox="0 0 12 14"
                  className="-translate-x-[4.25px] -mt-[1px] drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]"
                >
                  <path
                    d="M1 0 H11 C11.55 0 12 0.45 12 1 V8.2 L6 14 L0 8.2 V1 C0 0.45 0.45 0 1 0 Z"
                    fill="#C8FF00"
                  />
                </svg>
              </div>

              {/* Magnetic Snap Guide */}
              {snapTime !== null && (
                <div
                  style={{ left: snapTime * pxPerSec }}
                  className="absolute top-0 bottom-0 w-px bg-white/80 shadow-[0_0_6px_rgba(255,255,255,0.8)] pointer-events-none z-20"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
