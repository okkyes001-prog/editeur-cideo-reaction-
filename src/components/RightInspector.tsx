import React from 'react';
import {
  Film,
  FlipHorizontal,
  Layers,
  Music,
  Sliders,
  Trash2,
  Type,
  Volume2,
  X,
} from 'lucide-react';
import {
  FeatherEdge,
  MusicClip,
  SelectionTarget,
  SoundEffectClip,
  TextAnimation,
  TextOverlay,
  TextStylePreset,
  TransitionType,
  VideoClip,
} from '../types/editor';
import { TEXT_STYLE_PRESETS, TRANSITION_OPTIONS } from '../data/presets';

interface RightInspectorProps {
  selection: SelectionTarget;
  selectedClip: VideoClip | null;
  selectedText: TextOverlay | null;
  selectedSfx: SoundEffectClip | null;
  selectedMusic: MusicClip | null;
  baseClips?: VideoClip[];
  overlayClips?: VideoClip[];
  textOverlays?: TextOverlay[];
  soundEffects?: SoundEffectClip[];
  musicClips?: MusicClip[];
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  onSelect?: (target: SelectionTarget) => void;
  onUpdateClip: (clipId: string, patch: Partial<VideoClip>) => void;
  onUpdateText: (textId: string, patch: Partial<TextOverlay>) => void;
  onUpdateSfx: (sfxId: string, patch: Partial<SoundEffectClip>) => void;
  onUpdateMusic: (musicId: string, patch: Partial<MusicClip>) => void;
  onDeleteSelected: () => void;
}

export const RightInspector: React.FC<RightInspectorProps> = ({
  selection,
  selectedClip,
  selectedText,
  selectedSfx,
  selectedMusic,
  baseClips = [],
  overlayClips = [],
  textOverlays = [],
  soundEffects = [],
  musicClips = [],
  isMobileOpen = false,
  onCloseMobile,
  onSelect,
  onUpdateClip,
  onUpdateText,
  onUpdateSfx,
  onUpdateMusic,
  onDeleteSelected,
}) => {
  const asideClasses =
    'fixed top-14 right-3 z-40 w-[264px] max-h-[calc(100vh-5rem)] lg:absolute lg:top-3 lg:right-3 lg:w-[260px] lg:max-h-[calc(100%-24px)] rounded-xl border border-[#2a2a2e] bg-[#141416]/95 backdrop-blur-md shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex flex-col min-h-0 overflow-hidden';

  if (!isMobileOpen) {
    return null;
  }

  const hasSelectedItem = Boolean(
    selection &&
      (selectedClip || selectedText || selectedSfx || selectedMusic)
  );

  if (!hasSelectedItem) {
    return (
      <aside className={asideClasses}>
        <div className="px-3 py-2 bg-[#1a1a1d]/90 border-b border-[#262626] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-[#C8FF00]" />
            <h2 className="font-display text-[11px] font-semibold text-white">
              Edit Element
            </h2>
          </div>
          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Close properties"
              title="Close"
              className="p-1 rounded text-[#888888] hover:text-white hover:bg-[#262626] transition-colors cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          <p className="text-[11px] text-[#888888] leading-snug">
            Click any clip, text, sound, or music on the preview or timeline to
            control its settings here.
          </p>

          {onSelect &&
            (overlayClips.length > 0 ||
              baseClips.length > 0 ||
              textOverlays.length > 0 ||
              soundEffects.length > 0 ||
              musicClips.length > 0) && (
              <div className="space-y-1.5 pt-2 border-t border-[#262626]">
                <span className="text-[10px] font-medium text-[#888888] block">
                  Quick Select
                </span>
                <div className="space-y-1">
                  {overlayClips.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => onSelect({ kind: 'clip', id: c.id })}
                      className="w-full px-2 py-1.5 rounded-md bg-[#090909] border border-[#262626] hover:border-[#C8FF00] text-left text-[11px] text-white flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <Layers className="w-3 h-3 text-[#38BDF8] shrink-0" />
                      <span className="truncate flex-1">{c.label}</span>
                      <span className="text-[9px] font-mono-tabular text-[#888888]">
                        V2
                      </span>
                    </button>
                  ))}
                  {baseClips.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => onSelect({ kind: 'clip', id: c.id })}
                      className="w-full px-2 py-1.5 rounded-md bg-[#090909] border border-[#262626] hover:border-[#C8FF00] text-left text-[11px] text-white flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <Film className="w-3 h-3 text-[#C8FF00] shrink-0" />
                      <span className="truncate flex-1">{c.label}</span>
                      <span className="text-[9px] font-mono-tabular text-[#888888]">
                        V1
                      </span>
                    </button>
                  ))}
                  {textOverlays.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onSelect({ kind: 'text', id: t.id })}
                      className="w-full px-2 py-1.5 rounded-md bg-[#090909] border border-[#262626] hover:border-[#C8FF00] text-left text-[11px] text-white flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <Type className="w-3 h-3 text-[#FACC15] shrink-0" />
                      <span className="truncate flex-1">{t.text}</span>
                      <span className="text-[9px] font-mono-tabular text-[#888888]">
                        T1
                      </span>
                    </button>
                  ))}
                  {soundEffects.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onSelect({ kind: 'sfx', id: s.id })}
                      className="w-full px-2 py-1.5 rounded-md bg-[#090909] border border-[#262626] hover:border-[#C8FF00] text-left text-[11px] text-white flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <Volume2 className="w-3 h-3 text-[#34D399] shrink-0" />
                      <span className="truncate flex-1">{s.label}</span>
                      <span className="text-[9px] font-mono-tabular text-[#888888]">
                        SFX
                      </span>
                    </button>
                  ))}
                  {musicClips.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => onSelect({ kind: 'music', id: m.id })}
                      className="w-full px-2 py-1.5 rounded-md bg-[#090909] border border-[#262626] hover:border-[#C8FF00] text-left text-[11px] text-white flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <Music className="w-3 h-3 text-[#C084FC] shrink-0" />
                      <span className="truncate flex-1">{m.label}</span>
                      <span className="text-[9px] font-mono-tabular text-[#888888]">
                        MUS
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
        </div>
      </aside>
    );
  }

  return (
    <aside className={asideClasses}>
      <div className="px-3 py-2 bg-[#1a1a1d]/90 border-b border-[#262626] flex items-center justify-between shrink-0 gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {selectedClip ? (
            <Film className="w-3.5 h-3.5 text-[#C8FF00] shrink-0" />
          ) : selectedText ? (
            <Type className="w-3.5 h-3.5 text-[#FACC15] shrink-0" />
          ) : selectedMusic ? (
            <Music className="w-3.5 h-3.5 text-[#C084FC] shrink-0" />
          ) : (
            <Volume2 className="w-3.5 h-3.5 text-[#34D399] shrink-0" />
          )}
          <div className="min-w-0">
            <h2 className="font-display text-[11px] font-semibold text-white truncate leading-tight">
              {selectedClip
                ? selectedClip.track === 'overlay'
                  ? `Reaction · ${selectedClip.label}`
                  : `Viral · ${selectedClip.label}`
                : selectedText
                ? 'Text Properties'
                : selectedMusic
                ? `Music · ${selectedMusic.label}`
                : `SFX · ${selectedSfx?.label ?? 'Sound'}`}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onDeleteSelected}
            title="Delete selected"
            className="p-1 rounded text-[#888888] hover:text-red-400 hover:bg-[#262626] transition-colors cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
          </button>
          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Close properties"
              title="Close"
              className="p-1 rounded text-[#888888] hover:text-white hover:bg-[#262626] transition-colors cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2.5">
        <div className="space-y-3">
          {selectedClip && (
            <>
              <div className="space-y-2.5">
                <div className="space-y-1">
                  <span className="text-[10px] text-[#888888] block">
                    Frame Fit
                  </span>
                  <div className="grid grid-cols-2 gap-1">
                    {(['cover', 'contain'] as const).map((fitMode) => (
                      <button
                        key={fitMode}
                        type="button"
                        onClick={() =>
                          onUpdateClip(selectedClip.id, {
                            fit: fitMode,
                            blurBackdrop: fitMode === 'contain',
                          })
                        }
                        className={`py-1 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                          selectedClip.fit === fitMode
                            ? 'bg-[#C8FF00] text-[#090909] font-bold'
                            : 'bg-[#090909] border border-[#262626] text-[#888888] hover:text-white'
                        }`}
                      >
                        {fitMode === 'cover' ? 'Fill Frame' : 'Fit + Blur BG'}
                      </button>
                    ))}
                  </div>
                  {((selectedClip.cropTop ?? 0) > 0 ||
                    (selectedClip.cropBottom ?? 0) > 0 ||
                    (selectedClip.cropLeft ?? 0) > 0 ||
                    (selectedClip.cropRight ?? 0) > 0) && (
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateClip(selectedClip.id, {
                          cropTop: 0,
                          cropBottom: 0,
                          cropLeft: 0,
                          cropRight: 0,
                        })
                      }
                      className="w-full py-1 rounded bg-[#090909] border border-[#262626] hover:border-[#C8FF00] text-[9px] font-medium text-[#888888] hover:text-white transition-colors cursor-pointer"
                    >
                      Reset Edge Crop
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="flex justify-between text-[10px] mb-0.5">
                      <span className="text-[#888888]">Scale</span>
                      <span className="font-mono-tabular text-white">
                        {Math.round(selectedClip.scale * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={40}
                      max={160}
                      value={Math.round(selectedClip.scale * 100)}
                      onChange={(e) =>
                        onUpdateClip(selectedClip.id, {
                          scale: Number(e.target.value) / 100,
                        })
                      }
                      className="w-full"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] mb-0.5">
                      <span className="text-[#888888]">Opacity</span>
                      <span className="font-mono-tabular text-white">
                        {Math.round((selectedClip.opacity ?? 1) * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={100}
                      value={Math.round((selectedClip.opacity ?? 1) * 100)}
                      onChange={(e) =>
                        onUpdateClip(selectedClip.id, {
                          opacity: Number(e.target.value) / 100,
                        })
                      }
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="flex justify-between text-[10px] mb-0.5">
                      <span className="text-[#888888]">Radius</span>
                      <span className="font-mono-tabular text-white">
                        {selectedClip.borderRadius >= 900
                          ? 'Circle'
                          : `${selectedClip.borderRadius}px`}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={120}
                      value={Math.min(120, selectedClip.borderRadius)}
                      onChange={(e) =>
                        onUpdateClip(selectedClip.id, {
                          borderRadius: Number(e.target.value),
                        })
                      }
                      className="w-full"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] mb-0.5">
                      <span className="text-[#888888]">Speed</span>
                      <span className="font-mono-tabular text-white">
                        {(selectedClip.speed ?? 1).toFixed(2).replace(/\.00$/, '')}x
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.5}
                      max={2}
                      step={0.1}
                      value={selectedClip.speed ?? 1}
                      onChange={(e) =>
                        onUpdateClip(selectedClip.id, {
                          speed: Number(e.target.value),
                        })
                      }
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="pt-1.5 border-t border-[#262626] space-y-1.5">
                  <div>
                    <div className="flex justify-between text-[10px] mb-0.5">
                      <span className="text-[#888888]">Edge Feather</span>
                      <span className="font-mono-tabular text-white">
                        {selectedClip.feather ?? 0}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={60}
                      value={selectedClip.feather ?? 0}
                      onChange={(e) =>
                        onUpdateClip(selectedClip.id, {
                          feather: Number(e.target.value),
                          featherEdge:
                            selectedClip.featherEdge ??
                            (selectedClip.track === 'overlay' &&
                            selectedClip.widthPct >= 85
                              ? 'top'
                              : 'all'),
                        })
                      }
                      className="w-full"
                    />
                  </div>

                  {(selectedClip.feather ?? 0) > 0 && (
                    <div>
                      <span className="text-[9px] text-[#888888] block mb-1">
                        Blend Edge
                      </span>
                      <div className="grid grid-cols-5 gap-1">
                        {(
                          [
                            { id: 'all', label: 'All' },
                            { id: 'top', label: 'Top' },
                            { id: 'bottom', label: 'Btm' },
                            { id: 'left', label: 'Left' },
                            { id: 'right', label: 'Right' },
                          ] as Array<{ id: FeatherEdge; label: string }>
                        ).map((opt) => {
                          const active =
                            (selectedClip.featherEdge ?? 'all') === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() =>
                                onUpdateClip(selectedClip.id, {
                                  featherEdge: opt.id,
                                })
                              }
                              className={`py-0.5 rounded text-[9px] font-medium transition-colors cursor-pointer ${
                                active
                                  ? 'bg-[#C8FF00] text-[#090909] font-bold'
                                  : 'bg-[#090909] border border-[#262626] text-[#888888] hover:text-white'
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-[#262626]">
                  <div>
                    <div className="flex justify-between text-[10px] mb-0.5">
                      <span className="text-[#888888]">Duration</span>
                      <span className="font-mono-tabular text-white">
                        {selectedClip.duration.toFixed(1)}s
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.5}
                      max={Math.max(120, Math.ceil(selectedClip.duration))}
                      step={0.5}
                      value={selectedClip.duration}
                      onChange={(e) =>
                        onUpdateClip(selectedClip.id, {
                          duration: Number(e.target.value),
                        })
                      }
                      className="w-full"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] mb-0.5">
                      <span className="text-[#888888]">Volume</span>
                      <span className="font-mono-tabular text-white">
                        {Math.round(selectedClip.volume * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={Math.round(selectedClip.volume * 100)}
                      onChange={(e) =>
                        onUpdateClip(selectedClip.id, {
                          volume: Number(e.target.value) / 100,
                        })
                      }
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="flex justify-between text-[9px] mb-0.5">
                      <span className="text-[#888888]">Fade In</span>
                      <span className="font-mono-tabular text-white">
                        {(selectedClip.fadeIn ?? 0).toFixed(1)}s
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={4}
                      step={0.2}
                      value={selectedClip.fadeIn ?? 0}
                      onChange={(e) =>
                        onUpdateClip(selectedClip.id, {
                          fadeIn: Number(e.target.value),
                        })
                      }
                      className="w-full"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[9px] mb-0.5">
                      <span className="text-[#888888]">Fade Out</span>
                      <span className="font-mono-tabular text-white">
                        {(selectedClip.fadeOut ?? 0).toFixed(1)}s
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={4}
                      step={0.2}
                      value={selectedClip.fadeOut ?? 0}
                      onChange={(e) =>
                        onUpdateClip(selectedClip.id, {
                          fadeOut: Number(e.target.value),
                        })
                      }
                      className="w-full"
                    />
                  </div>
                </div>

                {/* Color Adjustments & Mirror */}
                <div className="space-y-1.5 pt-1.5 border-t border-[#262626]">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium text-white">
                      Color &amp; Flip
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateClip(selectedClip.id, {
                            flipH: !selectedClip.flipH,
                          })
                        }
                        title="Flip horizontally"
                        className={`px-1.5 py-0.5 rounded text-[9px] font-medium flex items-center gap-1 border transition-colors cursor-pointer ${
                          selectedClip.flipH
                            ? 'bg-[#C8FF00] border-[#C8FF00] text-[#090909] font-bold'
                            : 'bg-[#090909] border-[#262626] text-[#888888] hover:text-white'
                        }`}
                      >
                        <FlipHorizontal className="w-2.5 h-2.5" />
                        <span>Flip</span>
                      </button>
                      {((selectedClip.brightness ?? 100) !== 100 ||
                        (selectedClip.contrast ?? 100) !== 100 ||
                        (selectedClip.saturate ?? 100) !== 100) && (
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateClip(selectedClip.id, {
                              brightness: 100,
                              contrast: 100,
                              saturate: 100,
                            })
                          }
                          className="text-[9px] text-[#888888] hover:text-white cursor-pointer"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <div className="flex justify-between text-[9px] mb-0.5">
                        <span className="text-[#888888]">Bright</span>
                        <span className="font-mono-tabular text-white">
                          {selectedClip.brightness ?? 100}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={50}
                        max={150}
                        value={selectedClip.brightness ?? 100}
                        onChange={(e) =>
                          onUpdateClip(selectedClip.id, {
                            brightness: Number(e.target.value),
                          })
                        }
                        className="w-full"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-[9px] mb-0.5">
                        <span className="text-[#888888]">Contrast</span>
                        <span className="font-mono-tabular text-white">
                          {selectedClip.contrast ?? 100}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={50}
                        max={150}
                        value={selectedClip.contrast ?? 100}
                        onChange={(e) =>
                          onUpdateClip(selectedClip.id, {
                            contrast: Number(e.target.value),
                          })
                        }
                        className="w-full"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-[9px] mb-0.5">
                        <span className="text-[#888888]">Sat</span>
                        <span className="font-mono-tabular text-white">
                          {selectedClip.saturate ?? 100}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={200}
                        value={selectedClip.saturate ?? 100}
                        onChange={(e) =>
                          onUpdateClip(selectedClip.id, {
                            saturate: Number(e.target.value),
                          })
                        }
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-1 pt-2 border-t border-[#262626]">
                <label className="text-[10px] font-medium text-[#888888] block">
                  Dynamic Transition
                </label>
                <select
                  value={selectedClip.transitionIn}
                  onChange={(e) =>
                    onUpdateClip(selectedClip.id, {
                      transitionIn: e.target.value as TransitionType,
                      transitionInDuration:
                        e.target.value === 'none' ? 0 : 0.4,
                    })
                  }
                  className="w-full bg-[#090909] border border-[#262626] focus:border-[#C8FF00] rounded px-2 py-1 text-[11px] text-white outline-none cursor-pointer"
                >
                  {TRANSITION_OPTIONS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {selectedText && (
            <>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-medium text-[#888888]">
                    Caption Text
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateText(selectedText.id, {
                          uppercase: !selectedText.uppercase,
                        })
                      }
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition-colors cursor-pointer ${
                        selectedText.uppercase
                          ? 'bg-[#C8FF00] border-[#C8FF00] text-[#090909]'
                          : 'bg-[#090909] border-[#262626] text-[#888888] hover:text-white'
                      }`}
                    >
                      AA
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateText(selectedText.id, {
                          hasBg: !selectedText.hasBg,
                        })
                      }
                      className={`px-1.5 py-0.5 rounded text-[9px] font-medium border transition-colors cursor-pointer ${
                        selectedText.hasBg
                          ? 'bg-[#C8FF00] border-[#C8FF00] text-[#090909] font-bold'
                          : 'bg-[#090909] border-[#262626] text-[#888888] hover:text-white'
                      }`}
                    >
                      BG
                    </button>
                  </div>
                </div>
                <textarea
                  rows={2}
                  value={selectedText.text}
                  onChange={(e) =>
                    onUpdateText(selectedText.id, { text: e.target.value })
                  }
                  className="w-full bg-[#090909] border border-[#262626] focus:border-[#C8FF00] rounded-md p-2 text-[11px] text-white outline-none resize-none"
                />
              </div>

              <div className="space-y-1.5 pt-1.5 border-t border-[#262626]">
                <label className="text-[10px] font-medium text-[#888888] block">
                  Style
                </label>
                <div className="grid grid-cols-2 gap-1">
                  {TEXT_STYLE_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() =>
                        onUpdateText(selectedText.id, {
                          stylePreset: preset.id as TextStylePreset,
                          fontFamily: preset.fontFamily,
                          color: preset.color,
                          bgColor: preset.bgColor,
                          accentColor: preset.accentColor,
                          hasBg: preset.hasBg,
                          uppercase: preset.uppercase,
                        })
                      }
                      className={`px-2 py-1 rounded border text-[10px] font-medium transition-colors cursor-pointer ${
                        selectedText.stylePreset === preset.id
                          ? 'bg-[#191919] border-[#C8FF00] text-[#C8FF00] font-semibold'
                          : 'bg-[#090909] border-[#262626] text-[#888888] hover:text-white'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2 pt-1.5 border-t border-[#262626]">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="flex justify-between text-[10px] mb-0.5">
                      <span className="text-[#888888]">Font Size</span>
                      <span className="font-mono-tabular text-white">
                        {selectedText.fontSize}px
                      </span>
                    </div>
                    <input
                      type="range"
                      min={28}
                      max={120}
                      value={selectedText.fontSize}
                      onChange={(e) =>
                        onUpdateText(selectedText.id, {
                          fontSize: Number(e.target.value),
                        })
                      }
                      className="w-full"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] mb-0.5">
                      <span className="text-[#888888]">Duration</span>
                      <span className="font-mono-tabular text-white">
                        {selectedText.duration.toFixed(1)}s
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.5}
                      max={Math.max(30, Math.ceil(selectedText.duration))}
                      step={0.5}
                      value={selectedText.duration}
                      onChange={(e) =>
                        onUpdateText(selectedText.id, {
                          duration: Number(e.target.value),
                        })
                      }
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <label className="text-[9px] text-[#888888] block mb-0.5">
                      Text Color
                    </label>
                    <input
                      type="color"
                      value={selectedText.color}
                      onChange={(e) =>
                        onUpdateText(selectedText.id, { color: e.target.value })
                      }
                      className="w-full h-5 bg-transparent border border-[#262626] rounded cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-[#888888] block mb-0.5">
                      Box Color
                    </label>
                    <input
                      type="color"
                      value={selectedText.bgColor}
                      onChange={(e) =>
                        onUpdateText(selectedText.id, {
                          bgColor: e.target.value,
                        })
                      }
                      className="w-full h-5 bg-transparent border border-[#262626] rounded cursor-pointer"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-medium text-[#888888] block mb-1">
                    Animation
                  </label>
                  <select
                    value={selectedText.animation}
                    onChange={(e) =>
                      onUpdateText(selectedText.id, {
                        animation: e.target.value as TextAnimation,
                      })
                    }
                    className="w-full bg-[#090909] border border-[#262626] focus:border-[#C8FF00] rounded px-2 py-1 text-[11px] text-white outline-none cursor-pointer"
                  >
                    <option value="pop">Spring Pop</option>
                    <option value="slide-up">Slide Up</option>
                    <option value="typewriter">Typewriter</option>
                    <option value="fade">Clean Fade</option>
                    <option value="none">Static</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {selectedSfx && (
            <div className="space-y-3">
              <div className="bg-[#090909] border border-[#262626] rounded-lg p-2.5">
                <p className="text-xs font-medium text-white truncate">
                  {selectedSfx.label}
                </p>
                <p className="text-[10px] text-[#888888] font-mono-tabular mt-0.5">
                  Starts at {selectedSfx.startTime.toFixed(1)}s ·{' '}
                  {selectedSfx.duration.toFixed(1)}s
                </p>
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-[#888888]">SFX Volume</span>
                  <span className="font-mono-tabular text-white">
                    {Math.round(selectedSfx.volume * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={150}
                  value={Math.round(selectedSfx.volume * 100)}
                  onChange={(e) =>
                    onUpdateSfx(selectedSfx.id, {
                      volume: Number(e.target.value) / 100,
                    })
                  }
                  className="w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-[#888888]">Fade In</span>
                    <span className="font-mono-tabular text-white">
                      {(selectedSfx.fadeIn ?? 0).toFixed(1)}s
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={3}
                    step={0.1}
                    value={selectedSfx.fadeIn ?? 0}
                    onChange={(e) =>
                      onUpdateSfx(selectedSfx.id, {
                        fadeIn: Number(e.target.value),
                      })
                    }
                    className="w-full"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-[#888888]">Fade Out</span>
                    <span className="font-mono-tabular text-white">
                      {(selectedSfx.fadeOut ?? 0).toFixed(1)}s
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={3}
                    step={0.1}
                    value={selectedSfx.fadeOut ?? 0}
                    onChange={(e) =>
                      onUpdateSfx(selectedSfx.id, {
                        fadeOut: Number(e.target.value),
                      })
                    }
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          )}

          {selectedMusic && (
            <div className="space-y-3">
              <div className="bg-[#090909] border border-[#262626] rounded-lg p-2.5">
                <p className="text-xs font-medium text-white truncate">
                  {selectedMusic.label}
                </p>
                <p className="text-[10px] text-[#888888] font-mono-tabular mt-0.5">
                  {selectedMusic.startTime.toFixed(1)}s ·{' '}
                  {selectedMusic.duration.toFixed(1)}s loop
                </p>
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-[#888888]">Music Volume</span>
                  <span className="font-mono-tabular text-white">
                    {Math.round(selectedMusic.volume * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={120}
                  value={Math.round(selectedMusic.volume * 100)}
                  onChange={(e) =>
                    onUpdateMusic(selectedMusic.id, {
                      volume: Number(e.target.value) / 100,
                    })
                  }
                  className="w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-[#888888]">Fade In</span>
                    <span className="font-mono-tabular text-white">
                      {(selectedMusic.fadeIn ?? 0).toFixed(1)}s
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={5}
                    step={0.2}
                    value={selectedMusic.fadeIn ?? 0}
                    onChange={(e) =>
                      onUpdateMusic(selectedMusic.id, {
                        fadeIn: Number(e.target.value),
                      })
                    }
                    className="w-full"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-[#888888]">Fade Out</span>
                    <span className="font-mono-tabular text-white">
                      {(selectedMusic.fadeOut ?? 0).toFixed(1)}s
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={5}
                    step={0.2}
                    value={selectedMusic.fadeOut ?? 0}
                    onChange={(e) =>
                      onUpdateMusic(selectedMusic.id, {
                        fadeOut: Number(e.target.value),
                      })
                    }
                    className="w-full"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-[#888888]">Duration</span>
                  <span className="font-mono-tabular text-white">
                    {selectedMusic.duration.toFixed(1)}s
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={Math.max(120, Math.ceil(selectedMusic.duration))}
                  step={0.5}
                  value={selectedMusic.duration}
                  onChange={(e) =>
                    onUpdateMusic(selectedMusic.id, {
                      duration: Number(e.target.value),
                    })
                  }
                  className="w-full"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
