import React, { useEffect, useRef, useState } from 'react';
import {
  FlipHorizontal,
  ImagePlus,
  Layers,
  Maximize2,
  Music,
  Scissors,
  Sliders,
  Trash2,
  Type,
  Volume2,
  X,
} from 'lucide-react';
import {
  BackgroundRemovalMode,
  ClipBackgroundMode,
  FeatherEdge,
  MusicClip,
  SeamDividerConfig,
  SelectionTarget,
  SoundEffectClip,
  TextAnimation,
  TextOverlay,
  TextStylePreset,
  TransitionType,
  VideoClip,
} from '../types/editor';
import {
  DEFAULT_SEAM_DIVIDER,
  SEAM_DIVIDER_PRESETS,
  TEXT_STYLE_PRESETS,
  TRANSITION_OPTIONS,
} from '../data/presets';
import {
  AiModelStatus,
  getAiModelError,
  getAiModelStatus,
  preloadAiSegmenter,
  retryAiSegmenter,
  subscribeAiModelStatus,
} from '../engine/backgroundRemoval';

interface RightInspectorProps {
  selection: SelectionTarget;
  selectedClip: VideoClip | null;
  selectedText: TextOverlay | null;
  selectedSfx: SoundEffectClip | null;
  selectedMusic: MusicClip | null;
  seamDivider?: SeamDividerConfig;
  isBaseSplit?: boolean;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  onExpandBaseFullFrame?: () => void;
  onUpdateSeamDivider?: (patch: Partial<SeamDividerConfig>) => void;
  onUpdateClip: (clipId: string, patch: Partial<VideoClip>) => void;
  onUpdateText: (textId: string, patch: Partial<TextOverlay>) => void;
  onUpdateSfx: (sfxId: string, patch: Partial<SoundEffectClip>) => void;
  onUpdateMusic: (musicId: string, patch: Partial<MusicClip>) => void;
  onDeleteSelected: () => void;
}

const SOLID_BG_SWATCHES = ['#09090B', '#1E1B4B', '#064E3B', '#7F1D1D', '#F4F4F5'];
const GRADIENT_BG_SWATCHES: Array<{ label: string; c1: string; c2: string }> = [
  { label: 'Midnight', c1: '#0F172A', c2: '#4C1D95' },
  { label: 'Cyber', c1: '#083344', c2: '#1D4ED8' },
  { label: 'Sunset', c1: '#7C2D12', c2: '#831843' },
  { label: 'Studio', c1: '#18181B', c2: '#3F3F46' },
];
const CHROMA_SWATCHES = ['#00FF00', '#0055FF', '#FFFFFF'];

export const RightInspector: React.FC<RightInspectorProps> = ({
  selection,
  selectedClip,
  selectedText,
  selectedSfx,
  selectedMusic,
  seamDivider = DEFAULT_SEAM_DIVIDER,
  isBaseSplit = false,
  isMobileOpen = false,
  onCloseMobile,
  onExpandBaseFullFrame,
  onUpdateSeamDivider,
  onUpdateClip,
  onUpdateText,
  onUpdateSfx,
  onUpdateMusic,
  onDeleteSelected,
}) => {
  const bgImageInputRef = useRef<HTMLInputElement>(null);
  const [aiStatus, setAiStatus] = useState<AiModelStatus>(() =>
    getAiModelStatus()
  );
  const [aiError, setAiError] = useState<string | null>(() =>
    getAiModelError()
  );

  useEffect(() => {
    return subscribeAiModelStatus(() => {
      setAiStatus(getAiModelStatus());
      setAiError(getAiModelError());
    });
  }, []);

  const asideClasses =
    'fixed top-14 right-3 z-40 w-[264px] max-h-[calc(100vh-5rem)] lg:absolute lg:top-3 lg:right-3 lg:w-[260px] lg:max-h-[calc(100%-24px)] rounded-xl border border-[#2a2a2e] bg-[#141416]/95 backdrop-blur-md shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex flex-col min-h-0 overflow-hidden';

  if (!isMobileOpen) {
    return null;
  }

  if (
    !selection ||
    (!selectedClip && !selectedText && !selectedSfx && !selectedMusic)
  ) {
    return (
      <aside className={asideClasses}>
        <div className="px-3 py-2 bg-[#1a1a1d]/90 border-b border-[#262626] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-[#C8FF00]" />
            <h2 className="font-display text-[11px] font-semibold text-white">
              Split Line
            </h2>
          </div>
          <div className="flex items-center gap-1">
            {onUpdateSeamDivider && (
              <button
                type="button"
                onClick={() =>
                  onUpdateSeamDivider({ enabled: !seamDivider.enabled })
                }
                className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-colors cursor-pointer ${
                  seamDivider.enabled
                    ? 'bg-[#C8FF00] text-[#090909]'
                    : 'bg-[#262626] text-[#888888] hover:text-white'
                }`}
              >
                {seamDivider.enabled ? 'ON' : 'OFF'}
              </button>
            )}
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
          <div className="space-y-2.5">
          {onUpdateSeamDivider && (
            <>
              <div className="space-y-1.5">
                <p className="text-[10px] font-medium text-[#888888]">
                  Style Presets
                </p>
                <div className="grid grid-cols-3 gap-1">
                  {SEAM_DIVIDER_PRESETS.map((preset) => {
                    const active =
                      seamDivider.enabled &&
                      seamDivider.color.toLowerCase() ===
                        preset.color.toLowerCase() &&
                      seamDivider.secondaryColor.toLowerCase() ===
                        preset.secondaryColor.toLowerCase();
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() =>
                          onUpdateSeamDivider({
                            enabled: true,
                            blurAmount: preset.blurAmount,
                            thickness: preset.thickness,
                            color: preset.color,
                            secondaryColor: preset.secondaryColor,
                            opacity: preset.opacity,
                          })
                        }
                        className={`rounded-md p-1.5 border text-left transition-colors cursor-pointer space-y-1 ${
                          active
                            ? 'bg-[#222222] border-[#C8FF00]'
                            : 'bg-[#090909] border-[#262626] hover:border-[#333333]'
                        }`}
                      >
                        <div
                          className="h-2 w-full rounded-sm"
                          style={{
                            background: `linear-gradient(90deg, ${preset.color}, ${preset.secondaryColor})`,
                          }}
                        />
                        <p className="text-[9px] font-medium text-white truncate leading-none">
                          {preset.label}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {seamDivider.enabled && (
                <div className="space-y-2 pt-2 border-t border-[#262626]">
                  <div>
                    <div className="flex justify-between text-[10px] mb-0.5">
                      <span className="text-[#888888]">Blur</span>
                      <span className="font-mono-tabular text-white">
                        {seamDivider.blurAmount}px
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={45}
                      value={seamDivider.blurAmount}
                      onChange={(e) =>
                        onUpdateSeamDivider({
                          blurAmount: Number(e.target.value),
                        })
                      }
                      className="w-full"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-[#888888]">Height</span>
                      <span className="font-mono-tabular text-white">
                        {seamDivider.thickness}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={5}
                      max={36}
                      value={seamDivider.thickness}
                      onChange={(e) =>
                        onUpdateSeamDivider({
                          thickness: Number(e.target.value),
                        })
                      }
                      className="w-full"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-[#888888]">Position</span>
                      <span className="font-mono-tabular text-white">
                        {seamDivider.positionY}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={15}
                      max={85}
                      value={seamDivider.positionY}
                      onChange={(e) =>
                        onUpdateSeamDivider({
                          positionY: Number(e.target.value),
                        })
                      }
                      className="w-full"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-[#888888]">Color Fade</span>
                      <span className="font-mono-tabular text-white">
                        {Math.round(seamDivider.opacity * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={Math.round(seamDivider.opacity * 100)}
                      onChange={(e) =>
                        onUpdateSeamDivider({
                          opacity: Number(e.target.value) / 100,
                        })
                      }
                      className="w-full"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-[#888888]">Colors</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={seamDivider.color}
                        onChange={(e) =>
                          onUpdateSeamDivider({ color: e.target.value })
                        }
                        className="w-7 h-6 rounded border border-[#262626] bg-transparent cursor-pointer"
                      />
                      <input
                        type="color"
                        value={seamDivider.secondaryColor}
                        onChange={(e) =>
                          onUpdateSeamDivider({ secondaryColor: e.target.value })
                        }
                        className="w-7 h-6 rounded border border-[#262626] bg-transparent cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="pt-2 border-t border-[#262626] text-center space-y-1">
            <Layers className="w-3.5 h-3.5 text-[#888888] mx-auto" />
            <p className="text-[10px] text-[#888888] leading-snug">
              Click any video, text, or audio to edit.
            </p>
          </div>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className={asideClasses}>
      <div className="px-3 py-2 bg-[#1a1a1d]/90 border-b border-[#262626] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <Layers className="w-3.5 h-3.5 text-[#C8FF00] shrink-0" />
          <h2 className="font-display text-[11px] font-semibold text-white truncate">
            {selectedClip
              ? selectedClip.track === 'overlay'
                ? 'Reaction Video'
                : 'Viral Video'
              : selectedText
              ? 'Text Properties'
              : selectedMusic
              ? 'Background Music'
              : 'Sound Effect'}
          </h2>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onDeleteSelected}
            title="Delete selected"
            className="p-1 rounded text-[#888888] hover:text-[#EF4444] hover:bg-[#262626] transition-colors cursor-pointer"
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
            {/* Background Removal & Replacement */}
            <div className="space-y-2 pb-2.5 border-b border-[#22222A]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-white flex items-center gap-1">
                  <Scissors className="w-3 h-3 text-[#06B6D4]" />
                  Background &amp; Cutout
                </span>
                {(selectedClip.bgRemovalMode ?? 'none') !== 'none' && (
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateClip(selectedClip.id, {
                        bgRemovalMode: 'none',
                      })
                    }
                    className="text-[9px] text-[#71717A] hover:text-white cursor-pointer"
                  >
                    Reset
                  </button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-1">
                {(
                  [
                    { id: 'none', label: 'Off' },
                    { id: 'ai', label: 'AI Cutout' },
                    { id: 'chroma', label: 'Color Key' },
                  ] as Array<{ id: BackgroundRemovalMode; label: string }>
                ).map((mode) => {
                  const active = (selectedClip.bgRemovalMode ?? 'none') === mode.id;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => {
                        if (mode.id === 'ai') {
                          preloadAiSegmenter().catch(() => {});
                        }
                        const replaceMode =
                          selectedClip.bgReplaceMode ?? 'transparent';
                        onUpdateClip(selectedClip.id, {
                          bgRemovalMode: mode.id,
                          bgReplaceMode: replaceMode,
                          bgThreshold: selectedClip.bgThreshold ?? 0.5,
                          bgEdgeSoftness: selectedClip.bgEdgeSoftness ?? 0.35,
                          chromaColor: selectedClip.chromaColor ?? '#00FF00',
                          chromaTolerance: selectedClip.chromaTolerance ?? 0.28,
                          ...(mode.id !== 'none' && replaceMode === 'transparent'
                            ? { borderWidth: 0, borderRadius: 0 }
                            : {}),
                        });
                      }}
                      className={`py-1 rounded text-[9px] font-medium transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#06B6D4] text-[#09090B] font-semibold'
                          : 'bg-[#14141A] border border-[#22222A] text-[#A1A1AA] hover:text-white'
                      }`}
                    >
                      {mode.label}
                    </button>
                  );
                })}
              </div>

              {selectedClip.bgRemovalMode === 'ai' && aiStatus === 'loading' && (
                <p className="text-[10px] text-[#06B6D4]">
                  Loading AI cutout model...
                </p>
              )}

              {selectedClip.bgRemovalMode === 'ai' && aiStatus === 'error' && (
                <div className="bg-[#14141A] border border-[#EF4444]/40 rounded-md p-2 space-y-1.5">
                  <p className="text-[10px] text-[#FCA5A5] leading-snug">
                    {aiError || 'AI model unavailable. Try Color Key.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => retryAiSegmenter().catch(() => {})}
                    className="text-[10px] font-semibold text-[#06B6D4] hover:underline cursor-pointer"
                  >
                    Retry AI Model
                  </button>
                </div>
              )}

              {(selectedClip.bgRemovalMode ?? 'none') !== 'none' && (
                <div className="space-y-3 pt-1">
                  {/* Change Background */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-[#A1A1AA] block">
                      Replace Background
                    </span>
                    <div className="grid grid-cols-5 gap-1">
                      {(
                        [
                          { id: 'transparent', label: 'None' },
                          { id: 'blur', label: 'Blur' },
                          { id: 'solid', label: 'Color' },
                          { id: 'gradient', label: 'Grad' },
                          { id: 'image', label: 'Photo' },
                        ] as Array<{ id: ClipBackgroundMode; label: string }>
                      ).map((bg) => {
                        const active =
                          (selectedClip.bgReplaceMode ?? 'transparent') ===
                          bg.id;
                        return (
                          <button
                            key={bg.id}
                            type="button"
                            onClick={() =>
                              onUpdateClip(selectedClip.id, {
                                bgReplaceMode: bg.id,
                                bgColor: selectedClip.bgColor ?? '#0F172A',
                                bgSecondaryColor:
                                  selectedClip.bgSecondaryColor ?? '#4C1D95',
                                ...(bg.id === 'transparent'
                                  ? { borderWidth: 0, borderRadius: 0 }
                                  : {}),
                              })
                            }
                            className={`py-1 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                              active
                                ? 'bg-[#F97316] text-white font-semibold'
                                : 'bg-[#14141A] border border-[#22222A] text-[#A1A1AA] hover:text-white'
                            }`}
                          >
                            {bg.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Solid BG options */}
                  {selectedClip.bgReplaceMode === 'solid' && (
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {SOLID_BG_SWATCHES.map((hex) => (
                          <button
                            key={hex}
                            type="button"
                            onClick={() =>
                              onUpdateClip(selectedClip.id, { bgColor: hex })
                            }
                            className={`w-5 h-5 rounded border cursor-pointer ${
                              (selectedClip.bgColor ?? '#09090B').toLowerCase() ===
                              hex.toLowerCase()
                                ? 'border-[#F97316] scale-110'
                                : 'border-[#3F3F46]'
                            }`}
                            style={{ backgroundColor: hex }}
                          />
                        ))}
                      </div>
                      <input
                        type="color"
                        value={selectedClip.bgColor ?? '#09090B'}
                        onChange={(e) =>
                          onUpdateClip(selectedClip.id, {
                            bgColor: e.target.value,
                          })
                        }
                        className="w-7 h-6 rounded border border-[#27272F] bg-transparent cursor-pointer"
                      />
                    </div>
                  )}

                  {/* Gradient BG options */}
                  {selectedClip.bgReplaceMode === 'gradient' && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-4 gap-1">
                        {GRADIENT_BG_SWATCHES.map((g) => (
                          <button
                            key={g.label}
                            type="button"
                            onClick={() =>
                              onUpdateClip(selectedClip.id, {
                                bgColor: g.c1,
                                bgSecondaryColor: g.c2,
                              })
                            }
                            title={g.label}
                            className="h-5 rounded border border-[#27272F] hover:border-white cursor-pointer"
                            style={{
                              background: `linear-gradient(135deg, ${g.c1}, ${g.c2})`,
                            }}
                          />
                        ))}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-[#71717A]">
                          Colors
                        </span>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="color"
                            value={selectedClip.bgColor ?? '#0F172A'}
                            onChange={(e) =>
                              onUpdateClip(selectedClip.id, {
                                bgColor: e.target.value,
                              })
                            }
                            className="w-7 h-6 rounded border border-[#27272F] bg-transparent cursor-pointer"
                          />
                          <input
                            type="color"
                            value={selectedClip.bgSecondaryColor ?? '#4C1D95'}
                            onChange={(e) =>
                              onUpdateClip(selectedClip.id, {
                                bgSecondaryColor: e.target.value,
                              })
                            }
                            className="w-7 h-6 rounded border border-[#27272F] bg-transparent cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Image BG Upload */}
                  {selectedClip.bgReplaceMode === 'image' && (
                    <div className="space-y-1.5">
                      <input
                        ref={bgImageInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const url = URL.createObjectURL(file);
                          onUpdateClip(selectedClip.id, { bgImageUrl: url });
                          e.target.value = '';
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => bgImageInputRef.current?.click()}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-md bg-[#14141A] border border-dashed border-[#3F3F46] hover:border-[#06B6D4] text-[11px] font-medium text-white transition-colors cursor-pointer"
                      >
                        <ImagePlus className="w-3.5 h-3.5 text-[#06B6D4]" />
                        <span>
                          {selectedClip.bgImageUrl
                            ? 'Change Background Photo'
                            : 'Upload Background Photo'}
                        </span>
                      </button>
                    </div>
                  )}

                  {/* Quick Place Cutout (Side, Top, Corner, Anywhere) */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-[#A1A1AA] block">
                      Place Cutout (or drag on canvas)
                    </span>
                    <div className="grid grid-cols-5 gap-1">
                      {[
                        {
                          label: 'Left',
                          patch: {
                            x: 25,
                            y: 58,
                            widthPct: 50,
                            heightPct: 72,
                            scale: 1,
                          },
                        },
                        {
                          label: 'Right',
                          patch: {
                            x: 75,
                            y: 58,
                            widthPct: 50,
                            heightPct: 72,
                            scale: 1,
                          },
                        },
                        {
                          label: 'Top',
                          patch: {
                            x: 50,
                            y: 25,
                            widthPct: 68,
                            heightPct: 48,
                            scale: 1,
                          },
                        },
                        {
                          label: 'Corner',
                          patch: {
                            x: 74,
                            y: 74,
                            widthPct: 48,
                            heightPct: 48,
                            scale: 1,
                          },
                        },
                        {
                          label: 'Full',
                          patch: {
                            x: 50,
                            y: 50,
                            widthPct: 100,
                            heightPct: 100,
                            scale: 1,
                          },
                        },
                      ].map((pos) => (
                        <button
                          key={pos.label}
                          type="button"
                          onClick={() =>
                            onUpdateClip(selectedClip.id, {
                              ...pos.patch,
                              ...(selectedClip.bgReplaceMode === 'transparent'
                                ? { borderWidth: 0, borderRadius: 0 }
                                : {}),
                            })
                          }
                          className="py-1 rounded bg-[#14141A] border border-[#22222A] hover:border-[#06B6D4] text-[10px] font-medium text-[#E4E4E7] transition-colors cursor-pointer"
                        >
                          {pos.label}
                        </button>
                      ))}
                    </div>

                    {selectedClip.track === 'overlay' &&
                      (selectedClip.bgReplaceMode ?? 'transparent') ===
                        'transparent' &&
                      isBaseSplit &&
                      onExpandBaseFullFrame && (
                        <button
                          type="button"
                          onClick={onExpandBaseFullFrame}
                          className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md bg-[#1B1B22] hover:bg-[#27272F] border border-[#27272F] text-[10px] font-medium text-[#06B6D4] transition-colors cursor-pointer"
                        >
                          <Maximize2 className="w-3 h-3" />
                          <span>Fill Main Video Behind</span>
                        </button>
                      )}
                  </div>

                  {/* Chroma or AI Tuning */}
                  {selectedClip.bgRemovalMode === 'chroma' ? (
                    <div className="space-y-2.5 pt-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-[#A1A1AA]">
                          Key Color
                        </span>
                        <div className="flex items-center gap-1.5">
                          {CHROMA_SWATCHES.map((hex) => (
                            <button
                              key={hex}
                              type="button"
                              onClick={() =>
                                onUpdateClip(selectedClip.id, {
                                  chromaColor: hex,
                                })
                              }
                              className={`w-4 h-4 rounded-full border cursor-pointer ${
                                (selectedClip.chromaColor ?? '#00FF00').toLowerCase() ===
                                hex.toLowerCase()
                                  ? 'border-white scale-110'
                                  : 'border-[#3F3F46]'
                              }`}
                              style={{ backgroundColor: hex }}
                            />
                          ))}
                          <input
                            type="color"
                            value={selectedClip.chromaColor ?? '#00FF00'}
                            onChange={(e) =>
                              onUpdateClip(selectedClip.id, {
                                chromaColor: e.target.value,
                              })
                            }
                            className="w-6 h-5 rounded border border-[#27272F] bg-transparent cursor-pointer"
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-[#A1A1AA]">Key Tolerance</span>
                          <span className="font-mono-tabular text-[#E4E4E7]">
                            {Math.round(
                              (selectedClip.chromaTolerance ?? 0.28) * 100
                            )}
                            %
                          </span>
                        </div>
                        <input
                          type="range"
                          min={5}
                          max={60}
                          value={Math.round(
                            (selectedClip.chromaTolerance ?? 0.28) * 100
                          )}
                          onChange={(e) =>
                            onUpdateClip(selectedClip.id, {
                              chromaTolerance: Number(e.target.value) / 100,
                            })
                          }
                          className="w-full"
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-[#A1A1AA]">
                          Cutout Tightness
                        </span>
                        <span className="font-mono-tabular text-[#E4E4E7]">
                          {Math.round((selectedClip.bgThreshold ?? 0.5) * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={15}
                        max={85}
                        value={Math.round(
                          (selectedClip.bgThreshold ?? 0.5) * 100
                        )}
                        onChange={(e) =>
                          onUpdateClip(selectedClip.id, {
                            bgThreshold: Number(e.target.value) / 100,
                          })
                        }
                        className="w-full"
                      />
                    </div>
                  )}

                  <div>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-[#A1A1AA]">Edge Softness</span>
                      <span className="font-mono-tabular text-[#E4E4E7]">
                        {Math.round((selectedClip.bgEdgeSoftness ?? 0.35) * 100)}
                        %
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={Math.round(
                        (selectedClip.bgEdgeSoftness ?? 0.35) * 100
                      )}
                      onChange={(e) =>
                        onUpdateClip(selectedClip.id, {
                          bgEdgeSoftness: Number(e.target.value) / 100,
                        })
                      }
                      className="w-full"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="space-y-1">
                <span className="text-[10px] text-[#A1A1AA] block">
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
                      className={`py-1 rounded text-[10px] font-medium capitalize transition-colors cursor-pointer ${
                        selectedClip.fit === fitMode
                          ? 'bg-[#F97316] text-white font-semibold'
                          : 'bg-[#14141A] border border-[#22222A] text-[#A1A1AA] hover:text-white'
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
                    className="w-full py-1 rounded bg-[#14141A] border border-[#22222A] hover:border-[#F97316] text-[9px] font-medium text-[#A1A1AA] hover:text-white transition-colors cursor-pointer"
                  >
                    Reset Edge Crop
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="flex justify-between text-[10px] mb-0.5">
                    <span className="text-[#A1A1AA]">Scale</span>
                    <span className="font-mono-tabular text-[#E4E4E7]">
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
                    <span className="text-[#A1A1AA]">Radius</span>
                    <span className="font-mono-tabular text-[#E4E4E7]">
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
              </div>

              <div className="pt-1.5 border-t border-[#22222A] space-y-1.5">
                <div>
                  <div className="flex justify-between text-[10px] mb-0.5">
                    <span className="text-[#A1A1AA]">Edge Feather</span>
                    <span className="font-mono-tabular text-[#E4E4E7]">
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
                    <span className="text-[9px] text-[#71717A] block mb-1">
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
                                ? 'bg-[#F97316] text-white font-semibold'
                                : 'bg-[#14141A] border border-[#22222A] text-[#A1A1AA] hover:text-white'
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

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="flex justify-between text-[10px] mb-0.5">
                    <span className="text-[#A1A1AA]">Duration</span>
                    <span className="font-mono-tabular text-[#E4E4E7]">
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
                    <span className="text-[#A1A1AA]">Volume</span>
                    <span className="font-mono-tabular text-[#E4E4E7]">
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
                    <span className="text-[#A1A1AA]">Fade In</span>
                    <span className="font-mono-tabular text-[#E4E4E7]">
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
                    <span className="text-[#A1A1AA]">Fade Out</span>
                    <span className="font-mono-tabular text-[#E4E4E7]">
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
              <div className="space-y-1.5 pt-1.5 border-t border-[#22222A]">
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
                          : 'bg-[#14141A] border-[#22222A] text-[#A1A1AA] hover:text-white'
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
                        className="text-[9px] text-[#71717A] hover:text-white cursor-pointer"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <div className="flex justify-between text-[9px] mb-0.5">
                      <span className="text-[#A1A1AA]">Bright</span>
                      <span className="font-mono-tabular text-[#E4E4E7]">
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
                      <span className="text-[#A1A1AA]">Contrast</span>
                      <span className="font-mono-tabular text-[#E4E4E7]">
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
                      <span className="text-[#A1A1AA]">Sat</span>
                      <span className="font-mono-tabular text-[#E4E4E7]">
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

            <div className="space-y-1 pt-2 border-t border-[#22222A]">
              <label className="text-[10px] font-medium text-[#A1A1AA] block">
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
                className="w-full bg-[#14141A] border border-[#27272F] focus:border-[#F97316] rounded px-2 py-1 text-[11px] text-white outline-none cursor-pointer"
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
              <label className="text-[10px] font-medium text-[#A1A1AA] block">
                Caption Text
              </label>
              <textarea
                rows={2}
                value={selectedText.text}
                onChange={(e) =>
                  onUpdateText(selectedText.id, { text: e.target.value })
                }
                className="w-full bg-[#14141A] border border-[#27272F] focus:border-[#F97316] rounded-md p-2 text-[11px] text-white outline-none resize-none"
              />
            </div>

            <div className="space-y-1.5 pt-1.5 border-t border-[#22222A]">
              <label className="text-[10px] font-medium text-[#A1A1AA] block">
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
                        ? 'bg-[#1B1B22] border-[#F97316] text-white'
                        : 'bg-[#14141A] border-[#22222A] text-[#A1A1AA] hover:text-white'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 pt-1.5 border-t border-[#22222A]">
              <div>
                <div className="flex justify-between text-[10px] mb-0.5">
                  <span className="text-[#A1A1AA]">Font Size</span>
                  <span className="font-mono-tabular text-[#E4E4E7]">
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

              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label className="text-[9px] text-[#71717A] block mb-0.5">
                    Text Color
                  </label>
                  <input
                    type="color"
                    value={selectedText.color}
                    onChange={(e) =>
                      onUpdateText(selectedText.id, { color: e.target.value })
                    }
                    className="w-full h-5 bg-transparent border border-[#27272F] rounded cursor-pointer"
                  />
                </div>
                <div>
                  <label className="text-[9px] text-[#71717A] block mb-0.5">
                    Box Color
                  </label>
                  <input
                    type="color"
                    value={selectedText.bgColor}
                    onChange={(e) =>
                      onUpdateText(selectedText.id, { bgColor: e.target.value })
                    }
                    className="w-full h-5 bg-transparent border border-[#27272F] rounded cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-medium text-[#A1A1AA] block mb-1">
                  Animation
                </label>
                <select
                  value={selectedText.animation}
                  onChange={(e) =>
                    onUpdateText(selectedText.id, {
                      animation: e.target.value as TextAnimation,
                    })
                  }
                  className="w-full bg-[#14141A] border border-[#27272F] focus:border-[#F97316] rounded px-2 py-1 text-[11px] text-white outline-none cursor-pointer"
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
          <div className="space-y-4">
            <div className="bg-[#14141A] border border-[#22222A] rounded-lg p-3">
              <p className="text-xs font-medium text-white">
                {selectedSfx.label}
              </p>
              <p className="text-[11px] text-[#71717A] font-mono-tabular mt-0.5">
                Starts at {selectedSfx.startTime.toFixed(1)}s
              </p>
            </div>

            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-[#A1A1AA]">SFX Volume</span>
                <span className="font-mono-tabular text-[#E4E4E7]">
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
                  <span className="text-[#A1A1AA]">Fade In</span>
                  <span className="font-mono-tabular text-[#E4E4E7]">
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
                  <span className="text-[#A1A1AA]">Fade Out</span>
                  <span className="font-mono-tabular text-[#E4E4E7]">
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
          <div className="space-y-4">
            <div className="bg-[#14141A] border border-[#22222A] rounded-lg p-3">
              <p className="text-xs font-medium text-white">
                {selectedMusic.label}
              </p>
              <p className="text-[11px] text-[#71717A] font-mono-tabular mt-0.5">
                {selectedMusic.startTime.toFixed(1)}s ·{' '}
                {selectedMusic.duration.toFixed(1)}s loop
              </p>
            </div>

            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-[#A1A1AA]">Music Volume</span>
                <span className="font-mono-tabular text-[#E4E4E7]">
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
                  <span className="text-[#A1A1AA]">Fade In</span>
                  <span className="font-mono-tabular text-[#E4E4E7]">
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
                  <span className="text-[#A1A1AA]">Fade Out</span>
                  <span className="font-mono-tabular text-[#E4E4E7]">
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
                <span className="text-[#A1A1AA]">Duration</span>
                <span className="font-mono-tabular text-[#E4E4E7]">
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
