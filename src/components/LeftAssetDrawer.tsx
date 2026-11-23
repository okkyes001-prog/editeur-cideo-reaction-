import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowUpDown,
  Captions,
  Film,
  LayoutTemplate,
  Mic,
  Music,
  Play,
  Plus,
  SeparatorHorizontal,
  Sparkles,
  Square,
  Trash2,
  Type,
  Upload,
  Volume2,
  X,
} from 'lucide-react';
import {
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
import {
  parseSubtitleFile,
  TimedCaptionCue,
} from '../engine/captions';

export type LeftToolTab = 'videos' | 'format' | 'text' | 'line' | 'sfx' | 'music';

interface LeftAssetDrawerProps {
  assets: MediaAsset[];
  sfxAssets: SoundEffectAsset[];
  musicAssets: MusicAsset[];
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
  onDeleteAsset?: (assetId: string) => void;
  onApplyOverlayLayout: (preset: OverlayLayoutPreset) => void;
  onSwapTracks?: () => void;
  onUpdateSeamDivider?: (patch: Partial<SeamDividerConfig>) => void;
  onAddTextOverlay: (presetId: TextStylePreset, customText?: string) => void;
  onAddTimedCaptions?: (
    cues: TimedCaptionCue[],
    stylePreset?: TextStylePreset
  ) => void;
  onGenerateSyncedCaptions?: (
    scriptText: string,
    stylePreset: TextStylePreset
  ) => Promise<number>;
  onAddVoiceoverRecording?: (file: Blob, durationSec: number) => void;
  onAddSoundEffect: (sfxAsset: SoundEffectAsset) => void;
  onAddMusicClip: (musicAsset: MusicAsset) => void;
  onApplyTransitionToSelected: (transition: TransitionType) => void;
}

export const LeftAssetDrawer: React.FC<LeftAssetDrawerProps> = ({
  assets,
  sfxAssets,
  musicAssets,
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
  onDeleteAsset,
  onApplyOverlayLayout,
  onSwapTracks,
  onUpdateSeamDivider,
  onAddTextOverlay,
  onAddTimedCaptions,
  onGenerateSyncedCaptions,
  onAddVoiceoverRecording,
  onAddSoundEffect,
  onAddMusicClip,
  onApplyTransitionToSelected,
}) => {
  const viralInputRef = useRef<HTMLInputElement>(null);
  const reactionInputRef = useRef<HTMLInputElement>(null);
  const sfxInputRef = useRef<HTMLInputElement>(null);
  const musicInputRef = useRef<HTMLInputElement>(null);
  const subtitleInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const voiceChunksRef = useRef<BlobPart[]>([]);
  const voiceTimerRef = useRef<number | null>(null);
  const voiceStartRef = useRef<number>(0);

  const [quickText, setQuickText] = useState('');
  const [captionScript, setCaptionScript] = useState('');
  const [captionStatus, setCaptionStatus] = useState<string | null>(null);
  const [isSyncingCaptions, setIsSyncingCaptions] = useState(false);
  const [isListeningCaptions, setIsListeningCaptions] = useState(false);
  const speechRecRef = useRef<{ stop: () => void } | null>(null);

  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceSeconds, setVoiceSeconds] = useState(0);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const [sfxCategory, setSfxCategory] = useState<string>('All');
  const [musicMood, setMusicMood] = useState<string>('All');
  const [previewMusicId, setPreviewMusicId] = useState<string | null>(null);
  const [dragOverTrack, setDragOverTrack] = useState<'base' | 'overlay' | null>(
    null
  );
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    return () => {
      stopPreviewAudio();
      if (voiceTimerRef.current) window.clearInterval(voiceTimerRef.current);
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      try {
        speechRecRef.current?.stop();
      } catch {
        // Ignore
      }
    };
  }, []);

  const handleToggleVoiceRecording = async () => {
    if (isRecordingVoice) {
      if (voiceTimerRef.current) {
        window.clearInterval(voiceTimerRef.current);
        voiceTimerRef.current = null;
      }
      try {
        mediaRecorderRef.current?.stop();
      } catch {
        // Ignore
      }
      setIsRecordingVoice(false);
      return;
    }

    setVoiceError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setVoiceError('Microphone recording is not supported in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      voiceChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      voiceStartRef.current = performance.now();
      setVoiceSeconds(0);

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) voiceChunksRef.current.push(ev.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        micStreamRef.current = null;
        const elapsedSec = Math.max(
          0.5,
          Number(((performance.now() - voiceStartRef.current) / 1000).toFixed(2))
        );
        const mime = recorder.mimeType || 'audio/webm';
        const blob = new Blob(voiceChunksRef.current, { type: mime });
        voiceChunksRef.current = [];
        if (blob.size > 0 && onAddVoiceoverRecording) {
          onAddVoiceoverRecording(blob, elapsedSec);
        }
      };

      recorder.start(120);
      setIsRecordingVoice(true);
      voiceTimerRef.current = window.setInterval(() => {
        setVoiceSeconds((s) => s + 1);
      }, 1000);
    } catch {
      setVoiceError('Microphone permission denied or unavailable.');
    }
  };

  const handleToggleLiveSpeechCaptions = () => {
    if (isListeningCaptions) {
      try {
        speechRecRef.current?.stop();
      } catch {
        // Ignore
      }
      speechRecRef.current = null;
      setIsListeningCaptions(false);
      return;
    }

    const win = window as unknown as {
      SpeechRecognition?: new () => {
        continuous: boolean;
        interimResults: boolean;
        lang: string;
        onresult: ((ev: {
          resultIndex: number;
          results: ArrayLike<{
            isFinal: boolean;
            0?: { transcript?: string };
          }>;
        }) => void) | null;
        onerror: (() => void) | null;
        onend: (() => void) | null;
        start: () => void;
        stop: () => void;
      };
      webkitSpeechRecognition?: new () => {
        continuous: boolean;
        interimResults: boolean;
        lang: string;
        onresult: ((ev: {
          resultIndex: number;
          results: ArrayLike<{
            isFinal: boolean;
            0?: { transcript?: string };
          }>;
        }) => void) | null;
        onerror: (() => void) | null;
        onend: (() => void) | null;
        start: () => void;
        stop: () => void;
      };
    };

    const SpeechRecCtor = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRecCtor) {
      setCaptionStatus('Live dictation requires Chrome/Edge. Paste lines or import .srt/.vtt.');
      return;
    }

    try {
      const rec = new SpeechRecCtor();
      rec.continuous = true;
      rec.interimResults = false;
      rec.lang = navigator.language || 'en-US';
      let lastPhraseAt = performance.now();

      rec.onresult = (ev) => {
        const res = ev.results;
        const latest = res[res.length - 1];
        const text = latest?.[0]?.transcript?.trim();
        if (latest?.isFinal && text) {
          const now = performance.now();
          lastPhraseAt = now;
          setCaptionScript((prev) => (prev ? `${prev}\n${text}` : text));
          setCaptionStatus(`Captured: "${text.slice(0, 28)}..."`);
        } else {
          void lastPhraseAt;
        }
      };
      rec.onerror = () => {
        setIsListeningCaptions(false);
        setCaptionStatus('Speech recognition stopped.');
      };
      rec.onend = () => {
        setIsListeningCaptions(false);
        speechRecRef.current = null;
      };
      rec.start();
      speechRecRef.current = rec;
      setIsListeningCaptions(true);
      setCaptionStatus('Listening to microphone...');
    } catch {
      setCaptionStatus('Could not start speech dictation.');
    }
  };

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
      label: 'Layout',
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
    <aside className="flex h-full shrink-0 border-r border-[#262626] bg-[#090909] relative z-30">
      {/* Sleek Full-Height Icon Rail */}
      <div className="w-[56px] flex flex-col items-center py-2.5 gap-1.5">
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

      {/* Floating Popover Drawer for Videos, Layout, Text, Split Line, Sound & Music */}
      {isDrawerOpen && (
      <div className="absolute top-3 left-[64px] z-40 w-[264px] max-w-[calc(100vw-76px)] max-h-[calc(100%-24px)] rounded-xl border border-[#2a2a2e] bg-[#141416]/95 backdrop-blur-md shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex flex-col min-h-0 overflow-hidden">
        <div className="px-3 py-2 bg-[#1a1a1d]/90 border-b border-[#262626] flex items-center justify-between shrink-0">
          <h2 className="font-display text-[11px] font-semibold text-white tracking-wide">
            {activeTab === 'videos'
              ? 'Viral & Reaction'
              : activeTab === 'format'
              ? 'Split Layouts (9:16)'
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
            title="Close panel"
            aria-label="Close panel"
            className="p-1 rounded text-[#888888] hover:text-white hover:bg-[#262626] transition-colors cursor-pointer"
          >
            <X className="w-3 h-3" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2.5 space-y-3">
          {activeTab === 'videos' && (
            <>
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  ref={viralInputRef}
                  type="file"
                  accept="video/*,image/*"
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
                      Video or Image
                    </p>
                  </div>
                </button>

                <input
                  ref={reactionInputRef}
                  type="file"
                  accept="video/*,image/*"
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
                      Video or Image
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
                        <div className="relative h-12 rounded bg-[#090909] border border-[#262626] overflow-hidden flex items-center justify-center group">
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
                          {onDeleteAsset && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteAsset(asset.id);
                              }}
                              title="Delete from library"
                              aria-label={`Delete ${asset.name}`}
                              className="absolute top-1 right-1 p-1 rounded bg-black/75 hover:bg-red-500 text-white/80 hover:text-white transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
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
              {/* Ultra-Compact Pro Layout Tiles + 1-Tap Swap */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-[#888888]">
                    Layout
                  </span>
                  {onSwapTracks && canSwapTracks && (
                    <button
                      type="button"
                      onClick={onSwapTracks}
                      title="Swap Viral & Reaction positions"
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#090909] hover:bg-[#262626] border border-[#262626] hover:border-[#C8FF00] text-[10px] font-medium text-[#C8FF00] transition-colors cursor-pointer"
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
                            ? 'bg-[#191919] border-[#C8FF00]'
                            : 'bg-[#090909] border-[#262626] hover:border-[#888888]'
                        }`}
                      >
                        <div className="w-5 h-7 shrink-0 rounded-[3px] bg-[#090909] border border-[#262626] relative overflow-hidden">
                          <div
                            className="absolute bg-[#262626]"
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
                                ? 'bg-[#C8FF00]/75 border border-[#C8FF00]'
                                : 'bg-[#C8FF00]/30 border border-[#C8FF00]/60'
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
                                ? 'linear-gradient(to bottom, rgba(200,255,0,0.75) 0%, rgba(200,255,0,0) 100%)'
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
              <div className="space-y-1.5 pt-2.5 border-t border-[#262626]">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-[#888888]">
                    Transition
                  </span>
                  {!activeTransition && (
                    <span className="text-[10px] text-[#888888]">
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
                            ? 'bg-[#191919] border-[#C8FF00] text-white'
                            : 'bg-[#090909] border-[#262626] hover:border-[#888888] text-white'
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
              <div className="bg-[#090909] border border-[#262626] rounded-lg p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white">
                    Hide Split Line
                  </p>
                  <p className="text-[10px] text-[#888888] mt-0.5">
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
                      ? 'bg-[#C8FF00] text-[#090909]'
                      : 'bg-[#262626] text-[#888888] hover:text-white'
                  }`}
                >
                  {seamDivider.enabled ? 'ON' : 'OFF'}
                </button>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-medium text-[#888888]">
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
                            ? 'bg-[#191919] border-[#C8FF00]'
                            : 'bg-[#090909] border-[#262626] hover:border-[#888888]'
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
                <div className="space-y-3 pt-2 border-t border-[#262626]">
                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
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
                      className="w-full accent-[#C8FF00]"
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
                      className="w-full accent-[#C8FF00]"
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
                      className="w-full accent-[#C8FF00]"
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
                      className="w-full accent-[#C8FF00]"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-[11px] text-[#888888]">Colors</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        value={seamDivider.color}
                        onChange={(e) =>
                          onUpdateSeamDivider({ color: e.target.value })
                        }
                        title="Start color"
                        className="w-7 h-6 rounded border border-[#262626] bg-transparent cursor-pointer"
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
                        className="w-7 h-6 rounded border border-[#262626] bg-transparent cursor-pointer"
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
                  className="flex-1 min-w-0 bg-[#090909] border border-[#262626] focus:border-[#C8FF00] rounded-lg px-2.5 py-2 text-xs text-white placeholder-[#888888] outline-none"
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
                  className="px-3 py-2 rounded-lg bg-[#C8FF00] hover:bg-[#b5e600] text-xs font-bold text-[#090909] shrink-0 cursor-pointer transition-colors"
                >
                  Add
                </button>
              </div>

              {/* Auto-Captions & Subtitles */}
              <div className="bg-[#090909] border border-[#262626] rounded-lg p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-white flex items-center gap-1.5">
                    <Captions className="w-3.5 h-3.5 text-[#C8FF00]" />
                    Auto-Captions
                  </span>
                  <input
                    ref={subtitleInputRef}
                    type="file"
                    accept=".srt,.vtt,text/plain"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (!file || !onAddTimedCaptions) return;
                      const txt = await file.text();
                      const cues = parseSubtitleFile(txt);
                      if (cues.length > 0) {
                        onAddTimedCaptions(cues, 'caption-karaoke');
                        setCaptionStatus(`Added ${cues.length} subtitle cues.`);
                      } else {
                        setCaptionStatus('No valid .srt/.vtt cues found.');
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => subtitleInputRef.current?.click()}
                    className="px-2 py-0.5 rounded bg-[#191919] hover:bg-[#262626] border border-[#262626] hover:border-[#C8FF00] text-[10px] font-medium text-[#C8FF00] cursor-pointer transition-colors"
                  >
                    Import .SRT
                  </button>
                </div>

                <textarea
                  rows={3}
                  value={captionScript}
                  onChange={(e) => setCaptionScript(e.target.value)}
                  placeholder="Paste lines (1 caption per line) or dictate with mic to auto-sync with video speech..."
                  className="w-full bg-[#141414] border border-[#262626] focus:border-[#C8FF00] rounded-md p-2 text-[11px] text-white placeholder-[#666666] outline-none resize-none"
                />

                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={handleToggleLiveSpeechCaptions}
                    className={`py-1.5 px-2 rounded-md border text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                      isListeningCaptions
                        ? 'bg-red-500/20 border-red-500 text-red-400'
                        : 'bg-[#191919] border-[#262626] text-white hover:border-[#C8FF00]'
                    }`}
                  >
                    <Mic className="w-3 h-3" />
                    <span>{isListeningCaptions ? 'Stop Mic' : 'Dictate'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={isSyncingCaptions || !onGenerateSyncedCaptions}
                    onClick={async () => {
                      if (!onGenerateSyncedCaptions) return;
                      setIsSyncingCaptions(true);
                      setCaptionStatus('Scanning speech pauses...');
                      try {
                        const count = await onGenerateSyncedCaptions(
                          captionScript,
                          'caption-karaoke'
                        );
                        setCaptionStatus(
                          count > 0
                            ? `Synced ${count} captions to audio!`
                            : 'Add a clip first.'
                        );
                        if (count > 0) setCaptionScript('');
                      } finally {
                        setIsSyncingCaptions(false);
                      }
                    }}
                    className="py-1.5 px-2 rounded-md bg-[#C8FF00] hover:bg-[#b5e600] disabled:opacity-50 text-[10px] font-bold text-[#090909] flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>{isSyncingCaptions ? 'Syncing...' : 'Auto-Sync'}</span>
                  </button>
                </div>

                {captionStatus && (
                  <p className="text-[10px] text-[#888888] leading-snug">
                    {captionStatus}
                  </p>
                )}
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
                    className="w-full bg-[#090909] border border-[#262626] hover:border-[#C8FF00] rounded-lg p-3 text-left transition-colors cursor-pointer flex items-center justify-between gap-2"
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
                    <Plus className="w-3.5 h-3.5 text-[#888888] shrink-0" />
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
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => sfxInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-1 py-2.5 px-2 rounded-lg bg-[#090909] border border-dashed border-[#262626] hover:border-[#C8FF00] text-[11px] font-medium text-white transition-colors cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-[#C8FF00]" />
                  <span>Upload Audio</span>
                </button>

                <button
                  type="button"
                  onClick={handleToggleVoiceRecording}
                  className={`flex flex-col items-center justify-center gap-1 py-2.5 px-2 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer ${
                    isRecordingVoice
                      ? 'bg-red-500/15 border-red-500 text-red-400'
                      : 'bg-[#090909] border-[#262626] hover:border-[#C8FF00] text-white'
                  }`}
                >
                  {isRecordingVoice ? (
                    <>
                      <Square className="w-3.5 h-3.5 fill-current animate-pulse" />
                      <span className="font-mono-tabular">
                        Stop ({voiceSeconds}s)
                      </span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-3.5 h-3.5 text-[#C8FF00]" />
                      <span>Record Voice</span>
                    </>
                  )}
                </button>
              </div>

              {voiceError && (
                <p className="text-[10px] text-red-400 leading-snug">
                  {voiceError}
                </p>
              )}

              <div className="space-y-2.5">
                <div className="flex flex-wrap gap-1">
                  {[
                    'All',
                    'Voiceover',
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
                    if (
                      (cat === 'Uploaded' || cat === 'Voiceover') &&
                      count === 0
                    )
                      return null;
                    const active = sfxCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSfxCategory(cat)}
                        className={`px-2 py-1 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                          active
                            ? 'bg-[#C8FF00] text-[#090909] font-bold'
                            : 'bg-[#090909] border border-[#262626] text-[#888888] hover:text-white'
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
                    className="bg-[#090909] border border-[#262626] rounded-lg px-3 py-2.5 flex items-center justify-between gap-2"
                  >
                    <button
                      type="button"
                      onClick={() => playSfxNow(sfx, 0.85)}
                      className="min-w-0 flex-1 text-left flex items-center gap-2.5 cursor-pointer group"
                      title="Preview sound effect"
                    >
                      <Volume2 className="w-3.5 h-3.5 text-[#C8FF00] shrink-0 group-hover:scale-110 transition-transform" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-white truncate">
                          {sfx.name}
                        </p>
                        <p className="text-[10px] text-[#888888] font-mono-tabular">
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
                      className="px-2.5 py-1 rounded bg-[#262626] hover:bg-[#C8FF00] hover:text-[#090909] text-[11px] font-semibold text-white shrink-0 transition-colors cursor-pointer"
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
                className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-[#090909] border border-dashed border-[#262626] hover:border-[#C8FF00] text-xs font-medium text-white transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-[#C8FF00]" />
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
                            ? 'bg-[#C8FF00] text-[#090909] font-bold'
                            : 'bg-[#090909] border border-[#262626] text-[#888888] hover:text-white'
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
                            ? 'bg-[#191919] border-[#C8FF00]'
                            : 'bg-[#090909] border-[#262626]'
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
                                ? 'bg-[#C8FF00] text-[#090909]'
                                : 'bg-[#262626] text-[#C8FF00] group-hover:bg-[#C8FF00]/20'
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
                            <p className="text-[10px] text-[#888888]">
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
                          className="px-2.5 py-1 rounded bg-[#262626] hover:bg-[#C8FF00] hover:text-[#090909] text-[11px] font-semibold text-white shrink-0 transition-colors cursor-pointer"
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
