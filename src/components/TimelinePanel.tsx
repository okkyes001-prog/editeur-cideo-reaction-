import React, { useRef, useState } from 'react';
import {
  Layers,
  Music,
  Scissors,
  Trash2,
  Type,
  Video,
  Volume2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  MusicClip,
  SelectionTarget,
  SoundEffectClip,
  TextOverlay,
  VideoClip,
} from '../types/editor';

interface TimelinePanelProps {
  currentTime: number;
  duration: number;
  baseClips: VideoClip[];
  overlayClips: VideoClip[];
  textOverlays: TextOverlay[];
  soundEffects: SoundEffectClip[];
  musicClips: MusicClip[];
  selection: SelectionTarget;
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

export const TimelinePanel: React.FC<TimelinePanelProps> = ({
  currentTime,
  duration,
  baseClips,
  overlayClips,
  textOverlays,
  soundEffects,
  musicClips,
  selection,
  onSeek,
  onSelect,
  onUpdateClipTiming,
  onUpdateTextTiming,
  onUpdateSfxTiming,
  onUpdateMusicTiming,
  onSplitAtPlayhead,
  onDeleteSelected,
}) => {
  const [pxPerSec, setPxPerSec] = useState(48);
  const trackContainerRef = useRef<HTMLDivElement>(null);

  const totalTimelineWidth = Math.max(760, (duration + 4) * pxPerSec);

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

    const onMove = (ev: PointerEvent) => {
      const deltaSec = (ev.clientX - startX) / pxPerSec;
      let nextStart = initialStart;
      let nextDur = initialDur;

      if (mode === 'move') {
        nextStart = Math.max(
          0,
          Math.round((initialStart + deltaSec) * 10) / 10
        );
      } else if (mode === 'trim-left') {
        const clampedDelta = Math.min(deltaSec, initialDur - 0.4);
        nextStart = Math.max(
          0,
          Math.round((initialStart + clampedDelta) * 10) / 10
        );
        nextDur = Math.max(0.4, initialDur - (nextStart - initialStart));
      } else {
        nextDur = Math.max(
          0.4,
          Math.round((initialDur + deltaSec) * 10) / 10
        );
      }

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
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const ticks: number[] = [];
  for (let s = 0; s <= Math.ceil(duration + 4); s += 2) {
    ticks.push(s);
  }

  return (
    <section className="h-[214px] shrink-0 bg-[#191919] border-t border-[#262626] flex flex-col select-none">
      {/* Compact Timeline Toolbar */}
      <div className="h-8 px-3.5 border-b border-[#262626] flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onSplitAtPlayhead}
            title="Split clip at playhead (S)"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#090909] hover:bg-[#262626] border border-[#262626] text-[11px] font-medium text-white transition-colors cursor-pointer"
          >
            <Scissors className="w-3 h-3" />
            <span>Split</span>
          </button>

          <button
            type="button"
            onClick={onDeleteSelected}
            disabled={!selection}
            title="Delete selected item (Del)"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#090909] hover:bg-[#262626] border border-[#262626] text-[11px] font-medium text-white disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
            <span>Delete</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-[10px] font-mono-tabular text-[#888888]">
            Drag clips · Trim edges
          </span>
          <div className="flex items-center gap-1 bg-[#090909] border border-[#262626] rounded px-1 py-0.5">
            <button
              type="button"
              onClick={() => setPxPerSec((z) => Math.max(18, z - 12))}
              title="Zoom out timeline"
              className="p-0.5 text-[#888888] hover:text-white cursor-pointer"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <span className="text-[10px] font-mono-tabular text-[#888888] w-8 text-center">
              {Math.round((pxPerSec / 48) * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setPxPerSec((z) => Math.min(96, z + 12))}
              title="Zoom in timeline"
              className="p-0.5 text-[#888888] hover:text-white cursor-pointer"
            >
              <ZoomIn className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Track Labels + Multi-Track Lanes */}
      <div className="flex-1 min-h-0 flex">
        <div className="w-24 shrink-0 border-r border-[#262626] bg-[#141414] flex flex-col">
          <div className="h-5 border-b border-[#262626] px-2.5 flex items-center text-[9px] font-mono-tabular text-[#888888]">
            TRACKS
          </div>
          <div className="flex-1 flex flex-col justify-evenly px-2 py-0.5 gap-0.5">
            <div className="h-6 flex items-center gap-1.5 text-[11px] text-white">
              <Type className="w-3 h-3 text-[#C8FF00] shrink-0" />
              <span className="truncate">Text</span>
            </div>
            <div className="h-6 flex items-center gap-1.5 text-[11px] text-white">
              <Layers className="w-3 h-3 text-[#C8FF00] shrink-0" />
              <span className="truncate">Reaction</span>
            </div>
            <div className="h-6 flex items-center gap-1.5 text-[11px] text-white">
              <Video className="w-3 h-3 text-[#C8FF00] shrink-0" />
              <span className="truncate">Viral</span>
            </div>
            <div className="h-6 flex items-center gap-1.5 text-[11px] text-white">
              <Volume2 className="w-3 h-3 text-[#C8FF00] shrink-0" />
              <span className="truncate">SFX</span>
            </div>
            <div className="h-6 flex items-center gap-1.5 text-[11px] text-white">
              <Music className="w-3 h-3 text-[#C8FF00] shrink-0" />
              <span className="truncate">Music</span>
            </div>
          </div>
        </div>

        <div
          ref={trackContainerRef}
          className="flex-1 min-w-0 overflow-x-auto overflow-y-hidden relative bg-[#090909]"
        >
          <div
            style={{ width: totalTimelineWidth }}
            className="h-full relative flex flex-col"
          >
            {/* Scrubbable Ruler */}
            <div
              onPointerDown={handleRulerPointerDown}
              className="h-5 border-b border-[#262626] bg-[#191919] relative cursor-ew-resize shrink-0"
            >
              {ticks.map((sec) => (
                <div
                  key={sec}
                  style={{ left: sec * pxPerSec }}
                  className="absolute top-0 bottom-0 flex flex-col justify-end pointer-events-none"
                >
                  <span className="text-[9px] font-mono-tabular text-[#888888] pl-1 leading-none mb-0.5">
                    {sec}s
                  </span>
                  <div className="w-px h-1 bg-[#262626]" />
                </div>
              ))}
            </div>

            {/* 5 Tracks */}
            <div className="flex-1 flex flex-col justify-evenly py-0.5 gap-0.5 relative">
              {/* Text Track */}
              <div className="h-6 relative bg-[#0D0D11] border-y border-[#18181F]">
                {textOverlays.map((txt) => {
                  const isSel =
                    selection?.kind === 'text' && selection.id === txt.id;
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
                        width: Math.max(26, txt.duration * pxPerSec),
                      }}
                      className={`absolute top-0.5 bottom-0.5 rounded px-2 flex items-center justify-between cursor-grab active:cursor-grabbing overflow-hidden border ${
                        isSel
                          ? 'bg-[#FACC15]/20 border-[#FACC15] text-white'
                          : 'bg-[#1C190E] border-[#423815] text-[#FDE047]'
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
                        className="w-1.5 h-full cursor-ew-resize shrink-0 hover:bg-[#FACC15]/50 -ml-2 mr-1"
                      />
                      <span className="text-[11px] font-medium truncate flex-1">
                        {txt.text}
                      </span>
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
                        className="w-1.5 h-full cursor-ew-resize shrink-0 hover:bg-[#FACC15]/50 -mr-2 ml-1"
                      />
                    </div>
                  );
                })}
              </div>

              {/* Reaction Video Track (V2) */}
              <div className="h-6 relative bg-[#0D0D11] border-y border-[#18181F]">
                {overlayClips.map((clip) => {
                  const isSel =
                    selection?.kind === 'clip' && selection.id === clip.id;
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
                        width: Math.max(32, clip.duration * pxPerSec),
                      }}
                      className={`absolute top-0.5 bottom-0.5 rounded px-2 flex items-center justify-between cursor-grab active:cursor-grabbing overflow-hidden border ${
                        isSel
                          ? 'bg-[#06B6D4]/25 border-[#06B6D4] text-white'
                          : 'bg-[#0F2026] border-[#1A4352] text-[#A5F3FC]'
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
                        className="w-1.5 h-full cursor-ew-resize shrink-0 hover:bg-[#06B6D4]/60 -ml-2 mr-1"
                      />
                      <span className="text-[11px] font-medium truncate flex-1">
                        {clip.label}
                      </span>
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
                        className="w-1.5 h-full cursor-ew-resize shrink-0 hover:bg-[#06B6D4]/60 -mr-2 ml-1"
                      />
                    </div>
                  );
                })}
              </div>

              {/* Viral Base Track (V1) */}
              <div className="h-6 relative bg-[#0D0D11] border-y border-[#18181F]">
                {baseClips.map((clip) => {
                  const isSel =
                    selection?.kind === 'clip' && selection.id === clip.id;
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
                        width: Math.max(32, clip.duration * pxPerSec),
                      }}
                      className={`absolute top-0.5 bottom-0.5 rounded px-2 flex items-center justify-between cursor-grab active:cursor-grabbing overflow-hidden border ${
                        isSel
                          ? 'bg-[#F97316]/25 border-[#F97316] text-white'
                          : 'bg-[#1D1512] border-[#42281B] text-[#FED7AA]'
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
                        className="w-1.5 h-full cursor-ew-resize shrink-0 hover:bg-[#F97316]/60 -ml-2 mr-1"
                      />
                      <span className="text-[11px] font-medium truncate flex-1">
                        {clip.label}
                      </span>
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
                        className="w-1.5 h-full cursor-ew-resize shrink-0 hover:bg-[#F97316]/60 -mr-2 ml-1"
                      />
                    </div>
                  );
                })}
              </div>

              {/* Sound Effects Track (A1) */}
              <div className="h-6 relative bg-[#0D0D11] border-y border-[#18181F]">
                {soundEffects.map((sfx) => {
                  const isSel =
                    selection?.kind === 'sfx' && selection.id === sfx.id;
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
                        width: Math.max(44, sfx.duration * pxPerSec),
                      }}
                      className={`absolute top-0.5 bottom-0.5 rounded px-2 flex items-center cursor-grab active:cursor-grabbing overflow-hidden border ${
                        isSel
                          ? 'bg-[#10B981]/25 border-[#10B981] text-white'
                          : 'bg-[#0E221B] border-[#1B4A38] text-[#6EE7B7]'
                      }`}
                    >
                      <span className="text-[10px] font-medium truncate">
                        {sfx.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Background Music Track (M1) */}
              <div className="h-6 relative bg-[#0D0D11] border-y border-[#18181F]">
                {musicClips.map((mus) => {
                  const isSel =
                    selection?.kind === 'music' && selection.id === mus.id;
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
                        width: Math.max(48, mus.duration * pxPerSec),
                      }}
                      className={`absolute top-0.5 bottom-0.5 rounded px-2 flex items-center justify-between cursor-grab active:cursor-grabbing overflow-hidden border ${
                        isSel
                          ? 'bg-[#A855F7]/25 border-[#A855F7] text-white'
                          : 'bg-[#1B1229] border-[#3B2163] text-[#D8B4FE]'
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
                        className="w-1.5 h-full cursor-ew-resize shrink-0 hover:bg-[#A855F7]/60 -ml-2 mr-1"
                      />
                      <span className="text-[10px] font-medium truncate flex-1">
                        {mus.label}
                      </span>
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
                        className="w-1.5 h-full cursor-ew-resize shrink-0 hover:bg-[#A855F7]/60 -mr-2 ml-1"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Signal Electric Lime Playhead Needle */}
            <div
              style={{ left: currentTime * pxPerSec }}
              className="absolute top-0 bottom-0 w-px bg-[#C8FF00] pointer-events-none z-20"
            >
              <div className="w-2.5 h-2.5 bg-[#C8FF00] -translate-x-1/2 rotate-45 -mt-0.5 rounded-[1px]" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
