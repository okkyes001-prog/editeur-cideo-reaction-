import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowUpDown,
  Film,
  LayoutTemplate,
  Music,
  PanelLeftClose,
  Play,
  Plus,
  SeparatorHorizontal,
  Square,
  Type,
  Upload,
  Volume2,
} from 'lucide-react';
import {
  AspectRatio,
  MediaAsset,
  MusicAsset,
  OverlayLayoutPreset,
  SeamDividerConfig,
  SoundEffectAsset,
  TextStylePreset,
  TransitionType,
} from '../types/editor';
import {
  DEFAULT_SEAM_DIVIDER,
  OVERLAY_LAYOUT_PRESETS,
  SEAM_DIVIDER_PRESETS,
  TEXT_STYLE_PRESETS,
  TRANSITION_OPTIONS,
} from '../data/presets';
import {
  getPreviewingMusicId,
  playSfxNow,
  stopPreviewAudio,
  togglePreviewMusic,
} from '../engine/soundEffects';

export type LeftToolTab = 'videos' | 'format' | 'text' | 'line' | 'sfx' | 'music';

interface LeftAssetDrawerProps {
  assets: MediaAsset[];
  sfxAssets: SoundEffectAsset[];
  musicAssets: MusicAsset[];
  aspectRatio: AspectRatio;
  activeTab: LeftToolTab;
  isTimelinePlaying?: boolean;
  seamDivider?: SeamDividerConfig;
  activeLayout?: OverlayLayoutPreset;
  activeTransition?: TransitionType;
  canSwapTracks?: boolean;
  onChangeTab: (tab: LeftToolTab) => void;
  onUploadVideoForTrack: (files: FileList, track: 'base' | 'overlay') => void;
  onUploadSfxFiles: (files: FileList) => void;
  onUploadMusicFiles: (files: FileList) => void;
  onAddClipToTrack: (asset: MediaAsset, track: 'base' | 'overlay') => void;
  onAspectRatioChange: (ratio: AspectRatio) => void;
  onApplyOverlayLayout: (preset: OverlayLayoutPreset) => void;
  onSwapTracks?: () => void;
  onUpdateSeamDivider?: (patch: Partial<SeamDividerConfig>) => void;
  onAddTextOverlay: (presetId: TextStylePreset, customText?: string) => void;
  onAddSoundEffect: (sfxAsset: SoundEffectAsset) => void;
  onAddMusicClip: (musicAsset: MusicAsset) => void;
  onApplyTransitionToSelected: (transition: TransitionType) => void;
}

export const LeftAssetDrawer: React.FC<LeftAssetDrawerProps> = ({
  assets,
  sfxAssets,
  musicAssets,
  aspectRatio,
  activeTab,
  isTimelinePlaying = false,
  seamDivider = DEFAULT_SEAM_DIVIDER,
  activeLayout,
  activeTransition,
  canSwapTracks = false,
  onChangeTab,
  onUploadVideoForTrack,
  onUploadSfxFiles,
  onUploadMusicFiles,
  onAddClipToTrack,
  onAspectRatioChange,
  onApplyOverlayLayout,
  onSwapTracks,
  onUpdateSeamDivider,
  onAddTextOverlay,
  onAddSoundEffect,
  onAddMusicClip,
  onApplyTransitionToSelected,
}) => {
  const viralInputRef = useRef<HTMLInputElement>(null);
  const reactionInputRef = useRef<HTMLInputElement>(null);
  const sfxInputRef = useRef<HTMLInputElement>(null);
  const musicInputRef = useRef<HTMLInputElement>(null);
  const [quickText, setQuickText] = useState('');
  const [sfxCategory, setSfxCategory] = useState<string>('All');
  const [musicMood, setMusicMood] = useState<string>('All');
  const [previewMusicId, setPreviewMusicId] = useState<string | null>(null);
  const [dragOverTrack, setDragOverTrack] = useState<'base' | 'overlay' | null>(
    null
  );
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);

  useEffect(() => {
    return () => stopPreviewAudio();
  }, []);

  useEffect(() => {
    if ((activeTab !== 'music' || isTimelinePlaying) && previewMusicId) {
      stopPreviewAudio();
      setPreviewMusicId(null);
    }
  }, [activeTab, isTimelinePlaying, previewMusicId]);

  const railItems: Array<{
    id: LeftToolTab;
    label: string;
    icon: React.ReactNode;
  }> = [
    { id: 'videos', label: 'Videos', icon: <Film className="w-4 h-4" /> },
    {
      id: 'format',
      label: 'Format',
      icon: <LayoutTemplate className="w-4 h-4" />,
    },
    { id: 'text', label: 'Text', icon: <Type className="w-4 h-4" /> },
    {
      id: 'line',
      label: 'Split Line',
      icon: <SeparatorHorizontal className="w-4 h-4" />,
    },
    { id: 'sfx', label: 'Sound', icon: <Volume2 className="w-4 h-4" /> },
    { id: 'music', label: 'Music', icon: <Music className="w-4 h-4" /> },
  ];

  return (
    <aside className="flex h-full shrink-0 border-r border-[#262626] bg-[#090909]">
      {/* Sleek Full-Height Icon Rail */}
      <div className="w-[56px] border-r border-[#262626] flex flex-col items-center py-2.5 gap-1.5">
        {railItems.map((item) => {
          const active = activeTab === item.id && isDrawerOpen;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (activeTab === item.id) {
                  setIsDrawerOpen((o) => !o);
                } else {
                  onChangeTab(item.id);
                  setIsDrawerOpen(true);
                }
              }}
              className={`w-11 py-2 rounded-lg flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
                active
                  ? 'bg-[#191919] text-white'
                  : 'text-[#888888] hover:text-white hover:bg-[#191919]'
              }`}
            >
              <span className={active ? 'text-[#C8FF00]' : ''}>
                {item.icon}
              </span>
              <span className="text-[10px] font-medium leading-none">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Collapsible Contextual Asset Drawer */}
      {isDrawerOpen && (
      <div className="w-[264px] flex flex-col min-h-0 bg-[#191919]">
        <div className="px-3.5 py-2.5 border-b border-[#262626] flex items-center justify-between">
          <h2 className="font-display text-xs font-semibold text-white tracking-wide">
            {activeTab === 'videos'
              ? 'Viral & Reaction'
              : activeTab === 'format'
              ? 'Format & Layout'
              : activeTab === 'text'
              ? 'Text & Captions'
              : activeTab === 'line'
              ? 'Split Line'
              : activeTab === 'sfx'
              ? 'Sound Effects'
              : 'Mood Music'}
          </h2>
          <button
            type="button"
            onClick={() => setIsDrawerOpen(false)}
            title="Collapse panel"
            className="p-1 rounded text-[#888888] hover:text-white hover:bg-[#262626] transition-colors cursor-pointer"
          >
            <PanelLeftClose className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3.5">
          {activeTab === 'videos' && (
            <>
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  ref={viralInputRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      onUploadVideoForTrack(e.target.files, 'base');
                      e.target.value = '';
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => viralInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverTrack('base');
                  }}
                  onDragLeave={() => setDragOverTrack(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverTrack(null);
                    if (e.dataTransfer.files?.length) {
                      onUploadVideoForTrack(e.dataTransfer.files, 'base');
                    }
                  }}
                  className={`flex flex-col items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg border text-center transition-colors cursor-pointer ${
                    dragOverTrack === 'base'
                      ? 'bg-[#C8FF00]/15 border-[#C8FF00]'
                      : 'bg-[#090909] border-[#262626] hover:border-[#C8FF00]'
                  }`}
                >
                  <div className="w-7 h-7 rounded-md bg-[#262626] flex items-center justify-center text-[#C8FF00]">
                    <Upload className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-white leading-tight">
                      Viral (V1)
                    </p>
                    <p className="text-[10px] text-[#888888]">
                      Drop or click
                    </p>
                  </div>
                </button>

                <input
                  ref={reactionInputRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      onUploadVideoForTrack(e.target.files, 'overlay');
                      e.target.value = '';
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => reactionInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverTrack('overlay');
                  }}
                  onDragLeave={() => setDragOverTrack(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverTrack(null);
                    if (e.dataTransfer.files?.length) {
                      onUploadVideoForTrack(e.dataTransfer.files, 'overlay');
                    }
                  }}
                  className={`flex flex-col items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg border text-center transition-colors cursor-pointer ${
                    dragOverTrack === 'overlay'
                      ? 'bg-[#C8FF00]/15 border-[#C8FF00]'
                      : 'bg-[#090909] border-[#262626] hover:border-[#C8FF00]'
                  }`}
                >
                  <div className="w-7 h-7 rounded-md bg-[#262626] flex items-center justify-center text-[#C8FF00]">
                    <Plus className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-white leading-tight">
                      Reaction (V2)
                    </p>
                    <p className="text-[10px] text-[#888888]">
                      Drop or click
                    </p>
                  </div>
                </button>
              </div>

              <div className="space-y-2 pt-2 border-t border-[#262626]">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-medium text-[#888888]">
                    Clip Library
                  </p>
                  {assets.length > 0 && (
                    <span className="text-[10px] font-mono-tabular text-[#888888]">
                      {assets.length}
                    </span>
                  )}
                </div>

                {assets.length === 0 ? (
                  <p className="text-[11px] text-[#888888] py-2">
                    Your uploaded videos will appear here in compact tiles.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-1.5">
                    {assets.map((asset) => (
                      <div
                        key={asset.id}
                        className="bg-[#090909] border border-[#262626] rounded-md p-1.5 space-y-1.5"
                      >
                        <div className="relative h-12 rounded bg-[#090909] border border-[#262626] overflow-hidden flex items-center justify-center">
                          {asset.thumbnailUrl ? (
                            <img
                              src={asset.thumbnailUrl}
                              alt={asset.name}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Film className="w-3.5 h-3.5 text-[#888888]" />
                          )}
                          <span className="absolute bottom-0.5 right-1 px-1 rounded bg-black/75 text-[9px] font-mono-tabular text-white">
                            {asset.duration.toFixed(1)}s
                          </span>
                        </div>
                        <p className="text-[10px] font-medium text-white truncate px-0.5">
                          {asset.name}
                        </p>
                        <div className="grid grid-cols-2 gap-1">
                          <button
                            type="button"
                            onClick={() => onAddClipToTrack(asset, 'base')}
                            className="py-1 rounded bg-[#262626] hover:bg-[#C8FF00] hover:text-[#090909] text-[10px] font-semibold text-white transition-colors cursor-pointer"
                            title="Add to Viral track (V1)"
                          >
                            + V1
                          </button>
                          <button
                            type="button"
                            onClick={() => onAddClipToTrack(asset, 'overlay')}
                            className="py-1 rounded bg-[#262626] hover:bg-[#C8FF00] hover:text-[#090909] text-[10px] font-semibold text-white transition-colors cursor-pointer"
                            title="Add to Reaction track (V2)"
                          >
                            + V2
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'format' && (
            <div className="space-y-4">
              {/* Sleek Segmented Aspect Ratio */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-[#888888]">
                    Ratio
                  </span>
                  <span className="text-[10px] text-[#888888]">
                    {aspectRatio === '9:16'
                      ? 'Reels / TikTok'
                      : aspectRatio === '1:1'
                      ? 'Square Feed'
                      : 'YouTube Wide'}
                  </span>
                </div>
                <div className="bg-[#090909] border border-[#262626] rounded-lg p-0.5 grid grid-cols-3 gap-0.5">
                  {(
                    [
                      { id: '9:16', box: 'w-2 h-3' },
                      { id: '1:1', box: 'w-2.5 h-2.5' },
                      { id: '16:9', box: 'w-3.5 h-2' },
                    ] as Array<{ id: AspectRatio; box: string }>
                  ).map((item) => {
                    const active = aspectRatio === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onAspectRatioChange(item.id)}
                        className={`py-1.5 rounded-md flex items-center justify-center gap-1.5 text-[11px] font-mono-tabular font-medium transition-colors cursor-pointer ${
                          active
                            ? 'bg-[#C8FF00] text-[#090909] font-bold'
                            : 'text-[#888888] hover:text-white hover:bg-[#090909]'
                        }`}
                      >
                        <span
                          className={`rounded-[2px] border ${item.box} ${
                            active ? 'border-[#090909]' : 'border-current'
                          }`}
                        />
                        <span>{item.id}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Ultra-Compact Pro Layout Tiles + 1-Tap Swap */}
              <div className="space-y-1.5 pt-2.5 border-t border-[#22222A]">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-[#A1A1AA]">
                    Layout
                  </span>
                  {onSwapTracks && canSwapTracks && (
                    <button
                      type="button"
                      onClick={onSwapTracks}
                      title="Swap Viral & Reaction positions"
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#14141A] hover:bg-[#1B1B22] border border-[#27272F] hover:border-[#06B6D4] text-[10px] font-medium text-[#06B6D4] transition-colors cursor-pointer"
                    >
                      <ArrowUpDown className="w-2.5 h-2.5" />
                      <span>Swap</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  {OVERLAY_LAYOUT_PRESETS.map((preset) => {
                    const isActive = activeLayout === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        title={preset.hint}
                        onClick={() => onApplyOverlayLayout(preset.id)}
                        className={`flex items-center gap-2 p-1.5 rounded-lg border text-left transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-[#1B1B22] border-[#F97316]'
                            : 'bg-[#14141A] border-[#22222A] hover:border-[#3F3F46]'
                        }`}
                      >
                        <div className="w-5 h-7 shrink-0 rounded-[3px] bg-[#09090B] border border-[#27272F] relative overflow-hidden">
                          <div
                            className="absolute bg-[#27272F]"
                            style={{
                              left: `${
                                preset.baseBounds.x -
                                preset.baseBounds.widthPct / 2
                              }%`,
                              top: `${
                                preset.baseBounds.y -
                                preset.baseBounds.heightPct / 2
                              }%`,
                              width: `${preset.baseBounds.widthPct}%`,
                              height: `${preset.baseBounds.heightPct}%`,
                            }}
                          />
                          <div
                            className={`absolute ${
                              preset.overlayBounds.feather
                                ? ''
                                : isActive
                                ? 'bg-[#F97316]/75 border border-[#F97316]'
                                : 'bg-[#06B6D4]/45 border border-[#06B6D4]'
                            }`}
                            style={{
                              left: `${
                                preset.overlayBounds.x -
                                preset.overlayBounds.widthPct / 2
                              }%`,
                              top: `${
                                preset.overlayBounds.y -
                                preset.overlayBounds.heightPct / 2
                              }%`,
                              width: `${preset.overlayBounds.widthPct}%`,
                              height: `${preset.overlayBounds.heightPct}%`,
                              background: preset.overlayBounds.feather
                                ? 'linear-gradient(to bottom, rgba(6,182,212,0.75) 0%, rgba(6,182,212,0) 100%)'
                                : undefined,
                              borderRadius:
                                preset.overlayBounds.borderRadius >= 900
                                  ? '9999px'
                                  : `${Math.min(
                                      3,
                                      preset.overlayBounds.borderRadius / 6
                                    )}px`,
                            }}
                          />
                        </div>
                        <span className="text-[11px] font-medium text-white truncate">
                          {preset.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Compact Transitions */}
              <div className="space-y-1.5 pt-2.5 border-t border-[#22222A]">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-[#A1A1AA]">
                    Transition
                  </span>
                  {!activeTransition && (
                    <span className="text-[10px] text-[#71717A]">
                      Select clip
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {TRANSITION_OPTIONS.map((tr) => {
                    const isActive = activeTransition === tr.id;
                    return (
                      <button
                        key={tr.id}
                        type="button"
                        title={tr.description}
                        onClick={() => onApplyTransitionToSelected(tr.id)}
                        className={`px-2 py-1.5 rounded-md border text-left text-[11px] font-medium truncate transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-[#1B1B22] border-[#F97316] text-white'
                            : 'bg-[#14141A] border-[#22222A] hover:border-[#3F3F46] text-[#E4E4E7]'
                        }`}
                      >
                        {tr.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'line' && onUpdateSeamDivider && (
            <div className="space-y-4">
              <div className="bg-[#14141A] border border-[#22222A] rounded-lg p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white">
                    Hide Split Line
                  </p>
                  <p className="text-[10px] text-[#71717A] mt-0.5">
                    Blur & color fade between videos
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSeamDivider({ enabled: !seamDivider.enabled })
                  }
                  className={`px-2.5 py-1 rounded-md text-[10px] font-semibold shrink-0 transition-colors cursor-pointer ${
                    seamDivider.enabled
                      ? 'bg-[#F97316] text-white'
                      : 'bg-[#1B1B22] text-[#A1A1AA] hover:text-white'
                  }`}
                >
                  {seamDivider.enabled ? 'ON' : 'OFF'}
                </button>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-medium text-[#A1A1AA]">
                  Style Presets
                </p>
                <div className="grid grid-cols-2 gap-1.5">
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
                        className={`rounded-lg p-2 border text-left transition-colors cursor-pointer space-y-1.5 ${
                          active
                            ? 'bg-[#1B1B22] border-[#F97316]'
                            : 'bg-[#14141A] border-[#22222A] hover:border-[#3F3F46]'
                        }`}
                      >
                        <div
                          className="h-3 w-full rounded"
                          style={{
                            background: `linear-gradient(90deg, ${preset.color}, ${preset.secondaryColor})`,
                          }}
                        />
                        <p className="text-[11px] font-medium text-white truncate">
                          {preset.label}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {seamDivider.enabled && (
                <div className="space-y-3 pt-2 border-t border-[#22222A]">
                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-[#A1A1AA]">Blur</span>
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
                      <span className="text-[#A1A1AA]">Height</span>
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
                      <span className="text-[#A1A1AA]">Position</span>
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
                      <span className="text-[#A1A1AA]">Color Fade</span>
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

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-[11px] text-[#A1A1AA]">Colors</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        value={seamDivider.color}
                        onChange={(e) =>
                          onUpdateSeamDivider({ color: e.target.value })
                        }
                        title="Start color"
                        className="w-7 h-6 rounded border border-[#27272F] bg-transparent cursor-pointer"
                      />
                      <input
                        type="color"
                        value={seamDivider.secondaryColor}
                        onChange={(e) =>
                          onUpdateSeamDivider({
                            secondaryColor: e.target.value,
                          })
                        }
                        title="End color"
                        className="w-7 h-6 rounded border border-[#27272F] bg-transparent cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'text' && (
            <div className="space-y-4">
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={quickText}
                  onChange={(e) => setQuickText(e.target.value)}
                  placeholder="Write caption..."
                  className="flex-1 min-w-0 bg-[#14141A] border border-[#27272F] focus:border-[#F97316] rounded-lg px-2.5 py-2 text-xs text-white placeholder-[#71717A] outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    onAddTextOverlay(
                      'highlight-box',
                      quickText.trim() || undefined
                    );
                    setQuickText('');
                  }}
                  className="px-3 py-2 rounded-lg bg-[#F97316] hover:bg-[#EA580C] text-xs font-semibold text-white shrink-0 cursor-pointer"
                >
                  Add
                </button>
              </div>

              <div className="space-y-2">
                {TEXT_STYLE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() =>
                      onAddTextOverlay(
                        preset.id,
                        quickText.trim() || preset.sample
                      )
                    }
                    className="w-full bg-[#14141A] border border-[#22222A] hover:border-[#F97316] rounded-lg p-3 text-left transition-colors cursor-pointer flex items-center justify-between gap-2"
                  >
                    <span
                      className="inline-block px-2 py-0.5 rounded text-xs font-bold tracking-tight truncate"
                      style={{
                        fontFamily: preset.fontFamily,
                        color: preset.color,
                        backgroundColor: preset.hasBg
                          ? preset.bgColor
                          : 'transparent',
                      }}
                    >
                      {preset.sample}
                    </span>
                    <Plus className="w-3.5 h-3.5 text-[#71717A] shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'sfx' && (
            <div className="space-y-4">
              <input
                ref={sfxInputRef}
                type="file"
                accept="audio/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    onUploadSfxFiles(e.target.files);
                    e.target.value = '';
                  }
                }}
              />
              <button
                type="button"
                onClick={() => sfxInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-[#14141A] border border-dashed border-[#343440] hover:border-[#10B981] text-xs font-medium text-white transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-[#10B981]" />
                <span>Upload Audio / SFX</span>
              </button>

              <div className="space-y-2.5">
                <div className="flex flex-wrap gap-1">
                  {[
                    'All',
                    'News',
                    'Transition',
                    'Impact',
                    'Caption',
                    'Reaction',
                    'Glitch',
                    'Uploaded',
                  ].map((cat) => {
                    const count =
                      cat === 'All'
                        ? sfxAssets.length
                        : sfxAssets.filter((s) => s.category === cat).length;
                    if (cat === 'Uploaded' && count === 0) return null;
                    const active = sfxCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSfxCategory(cat)}
                        className={`px-2 py-1 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                          active
                            ? 'bg-[#10B981] text-[#09090B] font-semibold'
                            : 'bg-[#14141A] border border-[#22222A] text-[#A1A1AA] hover:text-white'
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>

                {sfxAssets
                  .filter(
                    (s) => sfxCategory === 'All' || s.category === sfxCategory
                  )
                  .map((sfx) => (
                  <div
                    key={sfx.id}
                    className="bg-[#14141A] border border-[#22222A] rounded-lg px-3 py-2.5 flex items-center justify-between gap-2"
                  >
                    <button
                      type="button"
                      onClick={() => playSfxNow(sfx, 0.85)}
                      className="min-w-0 flex-1 text-left flex items-center gap-2.5 cursor-pointer group"
                      title="Preview sound effect"
                    >
                      <Volume2 className="w-3.5 h-3.5 text-[#10B981] shrink-0 group-hover:scale-110 transition-transform" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-white truncate">
                          {sfx.name}
                        </p>
                        <p className="text-[10px] text-[#71717A] font-mono-tabular">
                          {sfx.duration.toFixed(2)}s · {sfx.category}
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        playSfxNow(sfx, 0.75);
                        onAddSoundEffect(sfx);
                      }}
                      className="px-2.5 py-1 rounded bg-[#1B1B22] hover:bg-[#10B981] hover:text-[#09090B] text-[11px] font-semibold text-white shrink-0 transition-colors cursor-pointer"
                    >
                      + Add
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'music' && (
            <div className="space-y-4">
              <input
                ref={musicInputRef}
                type="file"
                accept="audio/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    onUploadMusicFiles(e.target.files);
                    e.target.value = '';
                  }
                }}
              />
              <button
                type="button"
                onClick={() => musicInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-[#14141A] border border-dashed border-[#343440] hover:border-[#A855F7] text-xs font-medium text-white transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-[#A855F7]" />
                <span>Upload Background Music</span>
              </button>

              <div className="space-y-2.5">
                <div className="flex flex-wrap gap-1">
                  {[
                    'All',
                    'News',
                    'Scary / Fear',
                    'Happy / Joy',
                    'Hype / Viral',
                    'Sad / Drama',
                    'Comedy',
                    'Uploaded',
                  ].map((mood) => {
                    const count =
                      mood === 'All'
                        ? musicAssets.length
                        : musicAssets.filter((m) => m.mood === mood).length;
                    if (mood === 'Uploaded' && count === 0) return null;
                    const active = musicMood === mood;
                    return (
                      <button
                        key={mood}
                        type="button"
                        onClick={() => setMusicMood(mood)}
                        className={`px-2 py-1 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                          active
                            ? 'bg-[#A855F7] text-white font-semibold'
                            : 'bg-[#14141A] border border-[#22222A] text-[#A1A1AA] hover:text-white'
                        }`}
                      >
                        {mood}
                      </button>
                    );
                  })}
                </div>

                {musicAssets
                  .filter((m) => musicMood === 'All' || m.mood === musicMood)
                  .map((track) => {
                    const isPreviewing = previewMusicId === track.id;
                    return (
                      <div
                        key={track.id}
                        className={`rounded-lg px-3 py-2.5 flex items-center justify-between gap-2 border transition-colors ${
                          isPreviewing
                            ? 'bg-[#1C1629] border-[#A855F7]/60'
                            : 'bg-[#14141A] border-[#22222A]'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={async () => {
                            if (isPreviewing) {
                              stopPreviewAudio();
                              setPreviewMusicId(null);
                              return;
                            }
                            setPreviewMusicId(track.id);
                            await togglePreviewMusic(track, 0.55);
                            setPreviewMusicId(getPreviewingMusicId());
                          }}
                          className="min-w-0 flex-1 text-left flex items-center gap-2.5 cursor-pointer group"
                          title={isPreviewing ? 'Stop preview' : 'Preview music'}
                        >
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                              isPreviewing
                                ? 'bg-[#A855F7] text-white'
                                : 'bg-[#1D1D25] text-[#A855F7] group-hover:bg-[#A855F7]/20'
                            }`}
                          >
                            {isPreviewing ? (
                              <Square className="w-2.5 h-2.5 fill-current" />
                            ) : (
                              <Play className="w-2.5 h-2.5 fill-current ml-0.5" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-white truncate">
                              {track.name}
                            </p>
                            <p className="text-[10px] text-[#71717A]">
                              {track.mood}
                            </p>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            stopPreviewAudio();
                            setPreviewMusicId(null);
                            onAddMusicClip(track);
                          }}
                          className="px-2.5 py-1 rounded bg-[#1B1B22] hover:bg-[#A855F7] text-[11px] font-semibold text-white shrink-0 transition-colors cursor-pointer"
                        >
                          + Add
                        </button>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      </div>
      )}
    </aside>
  );
};
