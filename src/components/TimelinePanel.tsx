import React, { useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Maximize,
  Pause,
  Play,
  Repeat,
  Scissors,
  SeparatorHorizontal,
  SkipBack,
  Smartphone,
  Sparkles,
  Trash2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
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
  const [timelineHeight, setTimelineHeight] = useState(148);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [snapTime, setSnapTime] = useState<number | null>(null);
  const trackContainerRef = useRef<HTMLDivElement>(null);

  const handleResizePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = isCollapsed ? 28 : timelineHeight;
    setIsResizing(true);

    const onMove = (ev: PointerEvent) => {
      const deltaY = startY - ev.clientY;
      const nextHeight = startHeight + deltaY;
      if (nextHeight < 78) {
        setIsCollapsed(true);
      } else {
        setIsCollapsed(false);
        setTimelineHeight(Math.max(122, Math.min(340, nextHeight)));
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
    const fitPx = Math.max(18, Math.min(100, Math.floor(visibleWidth / (duration + 0.8))));
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
  const majorTicks: number[] = [];
  for (let s = 0; s <= Math.ceil(duration + 4); s += tickStep) {
    majorTicks.push(s);
  }

  return (
    <section
      style={{ height: isCollapsed ? 32 : timelineHeight }}
      className={`shrink-0 bg-[#090909] border-t border-[#262626] flex flex-col select-none relative ${
        isResizing ? '' : 'transition-[height] duration-200 ease-out'
      }`}
    >
      {/* Top Drag-to-Resize Handle */}
      <div
        onPointerDown={handleResizePointerDown}
        onDoubleClick={() => setIsCollapsed((c) => !c)}
        title="Drag up/down to resize timeline · Double-click to collapse"
        className="h-1.5 w-full bg-[#141414] hover:bg-[#1f1f1f] flex items-center justify-center cursor-ns-resize shrink-0 group"
      >
        <div className="w-10 h-0.5 rounded-full bg-[#333333] group-hover:bg-[#C8FF00] transition-colors" />
      </div>

      {/* Pro Ultra-Slim Toolbar (h-7) */}
      <div className="h-[28px] px-2.5 bg-[#141414] border-b border-[#262626] flex items-center justify-between gap-2 shrink-0 overflow-x-auto no-scrollbar">
        {/* Left: Playback + Timecode + Quick Edit Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onSeek(0)}
            title="Restart"
            className="w-5 h-5 rounded text-[#888888] hover:text-white hover:bg-[#262626] flex items-center justify-center transition-colors cursor-pointer"
          >
            <SkipBack className="w-3 h-3" />
          </button>

          {onTogglePlay && (
            <button
              type="button"
              onClick={onTogglePlay}
              title="Play / Pause (Space)"
              className="w-5 h-5 rounded-full bg-[#C8FF00] hover:bg-[#b5e600] text-[#090909] flex items-center justify-center transition-colors cursor-pointer"
            >
              {isPlaying ? (
                <Pause className="w-2.5 h-2.5 fill-current" />
              ) : (
                <Play className="w-2.5 h-2.5 fill-current ml-0.5" />
              )}
            </button>
          )}

          {/* Precision Pro Timecode */}
          <div className="flex items-center gap-1 font-mono-tabular text-[10px] leading-none px-1.5 py-1 rounded bg-[#090909] border border-[#262626]">
            <span className="text-[#C8FF00] font-semibold">
              {formatCompactTimecode(currentTime)}
            </span>
            <span className="text-[#555555]">/</span>
            <span className="text-[#888888]">
              {formatCompactTimecode(duration)}
            </span>
          </div>

          <div className="h-3.5 w-px bg-[#262626] mx-0.5" />

          <button
            type="button"
            onClick={onSplitAtPlayhead}
            title="Split clip at playhead (S)"
            className="h-5 px-1.5 rounded bg-[#191919] hover:bg-[#262626] hover:text-[#C8FF00] border border-[#262626] text-[10px] font-medium text-white flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Scissors className="w-2.5 h-2.5" />
            <span className="hidden sm:inline">Split</span>
          </button>

          <button
            type="button"
            onClick={onDeleteSelected}
            disabled={!selection}
            title="Delete selected item (Del)"
            className="h-5 px-1.5 rounded bg-[#191919] hover:bg-[#262626] hover:text-red-400 border border-[#262626] text-[10px] font-medium text-white disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Trash2 className="w-2.5 h-2.5" />
            <span className="hidden sm:inline">Delete</span>
          </button>
        </div>

        {/* Center: 1-Click Seamless Blend & Frosted Toggles */}
        <div className="flex items-center gap-1 shrink-0">
          {onToggleSeamlessBlend && (
            <button
              type="button"
              onClick={onToggleSeamlessBlend}
              title="Toggle Seamless Blend layout"
              className={`h-5 px-2 rounded border text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
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
              <span>Seamless Blend</span>
            </button>
          )}

          {onToggleFrosted && (
            <button
              type="button"
              onClick={onToggleFrosted}
              title="Toggle Frosted glass seam blur"
              className={`h-5 px-2 rounded border text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                seamDivider?.enabled &&
                seamDivider.color.toLowerCase() === '#ffffff' &&
                seamDivider.secondaryColor.toLowerCase() === '#d4d4d8'
                  ? 'bg-[#C8FF00] border-[#C8FF00] text-[#090909]'
                  : 'bg-[#191919] border-[#262626] text-white hover:border-[#C8FF00]'
              }`}
            >
              <SeparatorHorizontal
                className={`w-2.5 h-2.5 ${
                  seamDivider?.enabled &&
                  seamDivider.color.toLowerCase() === '#ffffff' &&
                  seamDivider.secondaryColor.toLowerCase() === '#d4d4d8'
                    ? 'text-[#090909]'
                    : 'text-[#C8FF00]'
                }`}
              />
              <span>Frosted</span>
            </button>
          )}
        </div>

        {/* Right: Safe Zone, Loop, Zoom & Collapse */}
        <div className="flex items-center gap-1 shrink-0">
          {onToggleSafeZone && (
            <button
              type="button"
              onClick={onToggleSafeZone}
              title="Toggle 9:16 Safe Zone guide"
              className={`h-5 w-5 rounded border flex items-center justify-center transition-colors cursor-pointer ${
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
              className={`h-5 w-5 rounded border flex items-center justify-center transition-colors cursor-pointer ${
                isLooping
                  ? 'bg-[#262626] border-[#C8FF00] text-[#C8FF00]'
                  : 'bg-[#090909] border-[#262626] text-[#888888] hover:text-white'
              }`}
            >
              <Repeat className="w-2.5 h-2.5" />
            </button>
          )}

          <div className="flex items-center bg-[#090909] border border-[#262626] rounded h-5 px-1">
            <button
              type="button"
              onClick={() => setPxPerSec((z) => Math.max(18, z - 10))}
              title="Zoom out"
              className="p-0.5 text-[#888888] hover:text-[#C8FF00] transition-colors cursor-pointer"
            >
              <ZoomOut className="w-2.5 h-2.5" />
            </button>
            <span className="text-[9px] font-mono-tabular text-white px-1 min-w-[30px] text-center">
              {Math.round((pxPerSec / 52) * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setPxPerSec((z) => Math.min(96, z + 10))}
              title="Zoom in"
              className="p-0.5 text-[#888888] hover:text-[#C8FF00] transition-colors cursor-pointer"
            >
              <ZoomIn className="w-2.5 h-2.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleFitTimeline}
            title="Auto-fit timeline to view"
            className="h-5 px-1.5 rounded bg-[#090909] hover:bg-[#191919] hover:text-[#C8FF00] border border-[#262626] text-[9px] font-mono-tabular font-medium text-[#888888] flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Maximize className="w-2.5 h-2.5" />
            <span>FIT</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCollapsed((c) => !c)}
            title={isCollapsed ? 'Expand timeline' : 'Collapse timeline'}
            aria-label={isCollapsed ? 'Expand timeline' : 'Collapse timeline'}
            className={`h-5 px-1.5 rounded border text-[9px] font-mono-tabular font-medium flex items-center gap-1 transition-colors cursor-pointer ${
              isCollapsed
                ? 'bg-[#C8FF00] border-[#C8FF00] text-[#090909] font-bold hover:bg-[#b5e600]'
                : 'bg-[#090909] border-[#262626] text-[#888888] hover:bg-[#191919] hover:text-[#C8FF00]'
            }`}
          >
            {isCollapsed ? (
              <>
                <ChevronUp className="w-3 h-3" />
                <span>Timeline</span>
              </>
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>
        </div>
      </div>

      {/* Track Labels + Multi-Track Lanes */}
      {!isCollapsed && (
      <div className="flex-1 min-h-0 flex">
        {/* Sleek Compact Track Header Sidebar (w-20) */}
        <div className="w-20 shrink-0 border-r border-[#262626] bg-[#111111] flex flex-col z-10">
          <div className="h-4 border-b border-[#262626] px-2 flex items-center justify-between text-[8px] font-mono-tabular font-semibold text-[#888888] tracking-wider uppercase">
            <span>TRACK</span>
            <span>NLE</span>
          </div>

          <div className="flex-1 flex flex-col justify-between py-0.5">
            {/* T1 */}
            <div className="h-[20px] px-1.5 flex items-center gap-1 text-[10px] text-white">
              <span className="px-1 py-[1px] rounded-[3px] bg-[#FACC15]/15 border border-[#FACC15]/40 text-[#FACC15] text-[9px] font-mono-tabular font-bold leading-none">
                T1
              </span>
              <span className="text-[10px] text-[#888888] truncate font-medium">Text</span>
            </div>

            {/* V2 */}
            <div className="h-[20px] px-1.5 flex items-center gap-1 text-[10px] text-white">
              <span className="px-1 py-[1px] rounded-[3px] bg-[#38BDF8]/15 border border-[#38BDF8]/40 text-[#38BDF8] text-[9px] font-mono-tabular font-bold leading-none">
                V2
              </span>
              <span className="text-[10px] text-[#888888] truncate font-medium">React</span>
            </div>

            {/* V1 */}
            <div className="h-[20px] px-1.5 flex items-center gap-1 text-[10px] text-white">
              <span className="px-1 py-[1px] rounded-[3px] bg-[#FB923C]/15 border border-[#FB923C]/40 text-[#FB923C] text-[9px] font-mono-tabular font-bold leading-none">
                V1
              </span>
              <span className="text-[10px] text-[#888888] truncate font-medium">Viral</span>
            </div>

            {/* A1 */}
            <div className="h-[20px] px-1.5 flex items-center gap-1 text-[10px] text-white">
              <span className="px-1 py-[1px] rounded-[3px] bg-[#34D399]/15 border border-[#34D399]/40 text-[#34D399] text-[9px] font-mono-tabular font-bold leading-none">
                A1
              </span>
              <span className="text-[10px] text-[#888888] truncate font-medium">SFX</span>
            </div>

            {/* M1 */}
            <div className="h-[20px] px-1.5 flex items-center gap-1 text-[10px] text-white">
              <span className="px-1 py-[1px] rounded-[3px] bg-[#C084FC]/15 border border-[#C084FC]/40 text-[#C084FC] text-[9px] font-mono-tabular font-bold leading-none">
                M1
              </span>
              <span className="text-[10px] text-[#888888] truncate font-medium">Music</span>
            </div>
          </div>
        </div>

        {/* Scrollable Tracks Canvas with Razor Playhead */}
        <div
          ref={trackContainerRef}
          className="flex-1 min-w-0 overflow-x-auto overflow-y-hidden relative bg-[#090909]"
        >
          <div
            style={{ width: totalTimelineWidth }}
            className="h-full relative flex flex-col"
          >
            {/* Precision Micro Ruler (h-4) */}
            <div
              onPointerDown={handleRulerPointerDown}
              className="h-4 border-b border-[#262626] bg-[#141414] relative cursor-ew-resize shrink-0 select-none"
            >
              {majorTicks.map((sec) => (
                <div
                  key={sec}
                  style={{ left: sec * pxPerSec }}
                  className="absolute top-0 bottom-0 flex flex-col justify-end pointer-events-none"
                >
                  <span className="text-[8px] font-mono-tabular text-[#888888] pl-0.5 leading-none mb-0.5">
                    {sec}s
                  </span>
                  <div className="w-px h-1.5 bg-[#333333]" />
                </div>
              ))}
            </div>

            {/* 5 Pro Tracks Container (5 x 20px) */}
            <div className="flex-1 flex flex-col justify-between py-0.5 relative">
              {/* T1 - Text Track */}
              <div className="h-[20px] relative bg-[#0e0e11] border-y border-[#1a1a22] flex items-center">
                {textOverlays.map((txt) => {
                  const isSel =
                    selection?.kind === 'text' && selection.id === txt.id;
                  const itemWidth = Math.max(24, txt.duration * pxPerSec);
                  return (
                    <div
                      key={txt.id}
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
                      className={`h-[17px] absolute rounded-[3px] px-1.5 flex items-center justify-between cursor-grab active:cursor-grabbing overflow-hidden border transition-shadow ${
                        isSel
                          ? 'bg-[#FACC15]/25 border-[#FACC15] ring-1 ring-[#FACC15]/50 text-white z-10'
                          : 'bg-[#201d10] border-[#443b1c] text-[#FDE047] hover:border-[#FACC15]/70'
                      }`}
                    >
                      <div
                        onPointerDown={(e) =>
                          startDragItem(
                            e,
                            'trim-left',
                            'text',
                            txt.id,
                            txt.startTime,
                            txt.duration
                          )
                        }
                        title="Trim start"
                        className="w-1.5 h-full cursor-ew-resize shrink-0 hover:bg-[#FACC15] -ml-1.5 mr-0.5"
                      />
                      <span className="text-[9px] font-medium truncate flex-1 leading-none">
                        {txt.text}
                      </span>
                      {itemWidth > 55 && (
                        <span className="text-[8px] font-mono-tabular opacity-75 shrink-0 ml-1">
                          {txt.duration.toFixed(1)}s
                        </span>
                      )}
                      <div
                        onPointerDown={(e) =>
                          startDragItem(
                            e,
                            'trim-right',
                            'text',
                            txt.id,
                            txt.startTime,
                            txt.duration
                          )
                        }
                        title="Trim end"
                        className="w-1.5 h-full cursor-ew-resize shrink-0 hover:bg-[#FACC15] -mr-1.5 ml-0.5"
                      />
                    </div>
                  );
                })}
              </div>

              {/* V2 - Reaction Track */}
              <div className="h-[20px] relative bg-[#0a1114] border-y border-[#142229] flex items-center">
                {overlayClips.map((clip) => {
                  const isSel =
                    selection?.kind === 'clip' && selection.id === clip.id;
                  const itemWidth = Math.max(28, clip.duration * pxPerSec);
                  return (
                    <div
                      key={clip.id}
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
                      className={`h-[17px] absolute rounded-[3px] px-1.5 flex items-center justify-between cursor-grab active:cursor-grabbing overflow-hidden border transition-shadow ${
                        isSel
                          ? 'bg-[#38BDF8]/25 border-[#38BDF8] ring-1 ring-[#38BDF8]/50 text-white z-10'
                          : 'bg-[#0e2129] border-[#1b4352] text-[#A5F3FC] hover:border-[#38BDF8]/70'
                      }`}
                    >
                      <div
                        onPointerDown={(e) =>
                          startDragItem(
                            e,
                            'trim-left',
                            'clip',
                            clip.id,
                            clip.startTime,
                            clip.duration
                          )
                        }
                        title="Trim start"
                        className="w-1.5 h-full cursor-ew-resize shrink-0 hover:bg-[#38BDF8] -ml-1.5 mr-0.5"
                      />
                      <span className="text-[9px] font-medium truncate flex-1 leading-none">
                        {clip.label}
                      </span>
                      {itemWidth > 55 && (
                        <span className="text-[8px] font-mono-tabular opacity-75 shrink-0 ml-1">
                          {clip.duration.toFixed(1)}s
                        </span>
                      )}
                      <div
                        onPointerDown={(e) =>
                          startDragItem(
                            e,
                            'trim-right',
                            'clip',
                            clip.id,
                            clip.startTime,
                            clip.duration
                          )
                        }
                        title="Trim end"
                        className="w-1.5 h-full cursor-ew-resize shrink-0 hover:bg-[#38BDF8] -mr-1.5 ml-0.5"
                      />
                    </div>
                  );
                })}
              </div>

              {/* V1 - Viral Base Track */}
              <div className="h-[20px] relative bg-[#130d0a] border-y border-[#291b14] flex items-center">
                {baseClips.map((clip) => {
                  const isSel =
                    selection?.kind === 'clip' && selection.id === clip.id;
                  const itemWidth = Math.max(28, clip.duration * pxPerSec);
                  return (
                    <div
                      key={clip.id}
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
                      className={`h-[17px] absolute rounded-[3px] px-1.5 flex items-center justify-between cursor-grab active:cursor-grabbing overflow-hidden border transition-shadow ${
                        isSel
                          ? 'bg-[#FB923C]/25 border-[#FB923C] ring-1 ring-[#FB923C]/50 text-white z-10'
                          : 'bg-[#291710] border-[#522c1b] text-[#FED7AA] hover:border-[#FB923C]/70'
                      }`}
                    >
                      <div
                        onPointerDown={(e) =>
                          startDragItem(
                            e,
                            'trim-left',
                            'clip',
                            clip.id,
                            clip.startTime,
                            clip.duration
                          )
                        }
                        title="Trim start"
                        className="w-1.5 h-full cursor-ew-resize shrink-0 hover:bg-[#FB923C] -ml-1.5 mr-0.5"
                      />
                      <span className="text-[9px] font-medium truncate flex-1 leading-none">
                        {clip.label}
                      </span>
                      {itemWidth > 55 && (
                        <span className="text-[8px] font-mono-tabular opacity-75 shrink-0 ml-1">
                          {clip.duration.toFixed(1)}s
                        </span>
                      )}
                      <div
                        onPointerDown={(e) =>
                          startDragItem(
                            e,
                            'trim-right',
                            'clip',
                            clip.id,
                            clip.startTime,
                            clip.duration
                          )
                        }
                        title="Trim end"
                        className="w-1.5 h-full cursor-ew-resize shrink-0 hover:bg-[#FB923C] -mr-1.5 ml-0.5"
                      />
                    </div>
                  );
                })}
              </div>

              {/* A1 - SFX Track */}
              <div className="h-[20px] relative bg-[#09120e] border-y border-[#12261d] flex items-center">
                {soundEffects.map((sfx) => {
                  const isSel =
                    selection?.kind === 'sfx' && selection.id === sfx.id;
                  const itemWidth = Math.max(36, sfx.duration * pxPerSec);
                  return (
                    <div
                      key={sfx.id}
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
                      className={`h-[17px] absolute rounded-[3px] px-1.5 flex items-center cursor-grab active:cursor-grabbing overflow-hidden border transition-shadow ${
                        isSel
                          ? 'bg-[#34D399]/25 border-[#34D399] ring-1 ring-[#34D399]/50 text-white z-10'
                          : 'bg-[#0f261d] border-[#1d4f3b] text-[#6EE7B7] hover:border-[#34D399]/70'
                      }`}
                    >
                      <span className="text-[9px] font-medium truncate leading-none">
                        {sfx.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* M1 - Music Track */}
              <div className="h-[20px] relative bg-[#120a1c] border-y border-[#25143a] flex items-center">
                {musicClips.map((mus) => {
                  const isSel =
                    selection?.kind === 'music' && selection.id === mus.id;
                  const itemWidth = Math.max(40, mus.duration * pxPerSec);
                  return (
                    <div
                      key={mus.id}
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
                      className={`h-[17px] absolute rounded-[3px] px-1.5 flex items-center justify-between cursor-grab active:cursor-grabbing overflow-hidden border transition-shadow ${
                        isSel
                          ? 'bg-[#C084FC]/25 border-[#C084FC] ring-1 ring-[#C084FC]/50 text-white z-10'
                          : 'bg-[#251438] border-[#4c2973] text-[#D8B4FE] hover:border-[#C084FC]/70'
                      }`}
                    >
                      <div
                        onPointerDown={(e) =>
                          startDragItem(
                            e,
                            'trim-left',
                            'music',
                            mus.id,
                            mus.startTime,
                            mus.duration
                          )
                        }
                        title="Trim start"
                        className="w-1.5 h-full cursor-ew-resize shrink-0 hover:bg-[#C084FC] -ml-1.5 mr-0.5"
                      />
                      <span className="text-[9px] font-medium truncate flex-1 leading-none">
                        {mus.label}
                      </span>
                      {itemWidth > 55 && (
                        <span className="text-[8px] font-mono-tabular opacity-75 shrink-0 ml-1">
                          {mus.duration.toFixed(1)}s
                        </span>
                      )}
                      <div
                        onPointerDown={(e) =>
                          startDragItem(
                            e,
                            'trim-right',
                            'music',
                            mus.id,
                            mus.startTime,
                            mus.duration
                          )
                        }
                        title="Trim end"
                        className="w-1.5 h-full cursor-ew-resize shrink-0 hover:bg-[#C084FC] -mr-1.5 ml-0.5"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Signal Electric Lime Playhead Laser Needle */}
            <div
              style={{ left: currentTime * pxPerSec }}
              className="absolute top-0 bottom-0 w-px bg-[#C8FF00] pointer-events-none z-30"
            >
              {/* Diamond Arrowhead at Ruler */}
              <div className="w-2.5 h-2.5 bg-[#C8FF00] -translate-x-[4.5px] rotate-45 -mt-0.5 rounded-[1px] shadow-sm" />
            </div>

            {snapTime !== null && (
              <div
                style={{ left: snapTime * pxPerSec }}
                className="absolute top-0 bottom-0 w-px bg-[#38BDF8] shadow-[0_0_6px_#38BDF8] pointer-events-none z-20"
              />
            )}
          </div>
        </div>
      </div>
      )}
    </section>
  );
};
