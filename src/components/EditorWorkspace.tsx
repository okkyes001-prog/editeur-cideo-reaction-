import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AspectRatio,
  BrandKit,
  ClipProject,
  ExportRecord,
  MediaAsset,
  MusicAsset,
  MusicClip,
  OverlayLayoutPreset,
  SeamDividerConfig,
  SelectionTarget,
  SoundEffectAsset,
  SoundEffectClip,
  TextOverlay,
  TextStylePreset,
  TransitionType,
  VideoClip,
} from '../types/editor';
import {
  DEFAULT_SEAM_DIVIDER,
  OVERLAY_LAYOUT_PRESETS,
  TEXT_STYLE_PRESETS,
} from '../data/presets';
import {
  playSfxNow,
  stopAllActiveMusic,
  stopPreviewAudio,
  syncActiveMusicPlayback,
} from '../engine/soundEffects';
import { EditorTopBar } from './EditorTopBar';
import { LeftAssetDrawer, LeftToolTab } from './LeftAssetDrawer';
import { PreviewStage } from './PreviewStage';
import { RightInspector } from './RightInspector';
import { TimelinePanel } from './TimelinePanel';
import { ExportModal } from './ExportModal';
import { clearClipMaskCache } from '../engine/backgroundRemoval';

interface EditorWorkspaceProps {
  project: ClipProject;
  assets: MediaAsset[];
  sfxAssets: SoundEffectAsset[];
  musicAssets: MusicAsset[];
  brandKit: BrandKit;
  onUpdateProject: (updated: ClipProject) => void;
  onAddAssets: (newAssets: MediaAsset[]) => void;
  onAddSfxAssets: (newSfx: SoundEffectAsset[]) => void;
  onAddMusicAssets: (newMusic: MusicAsset[]) => void;
  onExportComplete: (record: ExportRecord) => void;
  onOpenProjects: () => void;
}

function readUploadedVideoMetadata(
  file: File
): Promise<{
  srcUrl: string;
  duration: number;
  width: number;
  height: number;
  thumbnailUrl: string;
}> {
  return new Promise((resolve) => {
    const srcUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.src = srcUrl;

    let resolved = false;
    const finish = (
      duration: number,
      width: number,
      height: number,
      thumbnailUrl: string
    ) => {
      if (resolved) return;
      resolved = true;
      resolve({
        srcUrl,
        duration: Number.isFinite(duration) && duration > 0 ? duration : 15,
        width: width || 1080,
        height: height || 1920,
        thumbnailUrl,
      });
    };

    let captured = false;
    const captureFrameAndFinish = (dur: number) => {
      if (captured) return;
      captured = true;
      const w = video.videoWidth || 1080;
      const h = video.videoHeight || 1920;
      const previewSeek = Math.min(0.4, Math.max(0.05, dur / 4));

      const snap = () => {
        try {
          const c = document.createElement('canvas');
          c.width = 180;
          c.height = Math.round((180 * h) / w) || 320;
          const ctx = c.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, c.width, c.height);
            finish(dur, w, h, c.toDataURL('image/jpeg', 0.72));
            return;
          }
        } catch {
          // Ignore canvas taint fallback
        }
        finish(dur, w, h, '');
      };

      video.addEventListener('seeked', snap, { once: true });
      video.currentTime = previewSeek;
      setTimeout(() => snap(), 600);
    };

    const handlePossibleDuration = () => {
      if (video.duration === Infinity) {
        const onDurationFix = () => {
          if (Number.isFinite(video.duration) && video.duration > 0) {
            video.removeEventListener('timeupdate', onDurationFix);
            video.removeEventListener('seeked', onDurationFix);
            video.removeEventListener('durationchange', onDurationFix);
            captureFrameAndFinish(video.duration);
          }
        };
        video.addEventListener('timeupdate', onDurationFix);
        video.addEventListener('seeked', onDurationFix);
        video.addEventListener('durationchange', onDurationFix);
        video.currentTime = 1e10;
      } else if (Number.isFinite(video.duration) && video.duration > 0) {
        captureFrameAndFinish(video.duration);
      }
    };

    video.onloadedmetadata = handlePossibleDuration;
    video.onloadeddata = handlePossibleDuration;
    video.ondurationchange = handlePossibleDuration;

    video.onerror = () => {
      finish(15, 1080, 1920, '');
    };

    setTimeout(() => {
      finish(
        Number.isFinite(video.duration) && video.duration > 0
          ? video.duration
          : 15,
        video.videoWidth || 1080,
        video.videoHeight || 1920,
        ''
      );
    }, 10000);
  });
}

function readUploadedImageMetadata(
  file: File,
  fallbackDuration = 10
): Promise<{
  srcUrl: string;
  duration: number;
  width: number;
  height: number;
  thumbnailUrl: string;
}> {
  return new Promise((resolve) => {
    const srcUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({
        srcUrl,
        duration: fallbackDuration,
        width: img.naturalWidth || 1080,
        height: img.naturalHeight || 1080,
        thumbnailUrl: srcUrl,
      });
    };
    img.onerror = () => {
      resolve({
        srcUrl,
        duration: fallbackDuration,
        width: 1080,
        height: 1080,
        thumbnailUrl: srcUrl,
      });
    };
    img.src = srcUrl;
  });
}

function readUploadedAudioDuration(file: File): Promise<{
  srcUrl: string;
  duration: number;
}> {
  return new Promise((resolve) => {
    const srcUrl = URL.createObjectURL(file);
    const audio = new Audio(srcUrl);
    audio.onloadedmetadata = () => {
      resolve({
        srcUrl,
        duration:
          Number.isFinite(audio.duration) && audio.duration > 0
            ? audio.duration
            : 1.5,
      });
    };
    audio.onerror = () => resolve({ srcUrl, duration: 1.5 });
  });
}

export const EditorWorkspace: React.FC<EditorWorkspaceProps> = ({
  project,
  assets,
  sfxAssets,
  musicAssets,
  brandKit,
  onUpdateProject,
  onAddAssets,
  onAddSfxAssets,
  onAddMusicAssets,
  onExportComplete,
  onOpenProjects,
}) => {
  const [activeTab, setActiveTab] = useState<LeftToolTab>('videos');
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(true);
  const [selection, setSelection] = useState<SelectionTarget>(() =>
    project.overlayClips[0]
      ? { kind: 'clip', id: project.overlayClips[0].id }
      : project.baseClips[0]
      ? { kind: 'clip', id: project.baseClips[0].id }
      : null
  );
  const [showExportModal, setShowExportModal] = useState(false);

  const [past, setPast] = useState<ClipProject[]>([]);
  const [future, setFuture] = useState<ClipProject[]>([]);

  const seamDivider = useMemo(
    () => project.seamDivider ?? DEFAULT_SEAM_DIVIDER,
    [project.seamDivider]
  );

  const commitProjectChange = useCallback(
    (next: ClipProject, recordHistory = true) => {
      if (recordHistory) {
        setPast((p) => [...p.slice(-29), project]);
        setFuture([]);
      }
      onUpdateProject({ ...next, updatedAt: 'Just now' });
    },
    [project, onUpdateProject]
  );

  const handleUpdateSeamDivider = useCallback(
    (patch: Partial<SeamDividerConfig>) => {
      commitProjectChange({
        ...project,
        seamDivider: { ...seamDivider, ...patch },
      });
    },
    [project, seamDivider, commitProjectChange]
  );

  const handleUndo = useCallback(() => {
    if (past.length === 0) return;
    const prev = past[past.length - 1];
    setPast((p) => p.slice(0, -1));
    setFuture((f) => [project, ...f]);
    onUpdateProject(prev);
  }, [past, project, onUpdateProject]);

  const handleRedo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    setFuture((f) => f.slice(1));
    setPast((p) => [...p, project]);
    onUpdateProject(next);
  }, [future, project, onUpdateProject]);

  const musicClips = project.musicClips || [];

  const duration = useMemo(() => {
    const maxB = project.baseClips.reduce(
      (m, c) => Math.max(m, c.startTime + c.duration),
      0
    );
    const maxO = project.overlayClips.reduce(
      (m, c) => Math.max(m, c.startTime + c.duration),
      0
    );
    const maxT = project.textOverlays.reduce(
      (m, t) => Math.max(m, t.startTime + t.duration),
      0
    );
    const maxS = project.soundEffects.reduce(
      (m, s) => Math.max(m, s.startTime + s.duration),
      0
    );
    const maxM = musicClips.reduce(
      (m, mus) => Math.max(m, mus.startTime + mus.duration),
      0
    );
    return Math.max(maxB, maxO, maxT, maxS, maxM, 5);
  }, [project, musicClips]);

  const assetsById = useMemo(() => {
    const map = new Map<string, MediaAsset>();
    assets.forEach((a) => map.set(a.id, a));
    return map;
  }, [assets]);

  const sfxById = useMemo(() => {
    const map = new Map<string, SoundEffectAsset>();
    sfxAssets.forEach((s) => map.set(s.id, s));
    return map;
  }, [sfxAssets]);

  const musicById = useMemo(() => {
    const map = new Map<string, MusicAsset>();
    musicAssets.forEach((m) => map.set(m.id, m));
    return map;
  }, [musicAssets]);

  const lastRafRef = useRef<number | null>(null);
  const triggeredSfxRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isPlaying) {
      lastRafRef.current = null;
      triggeredSfxRef.current.clear();
      return;
    }

    let rafId = 0;
    const tick = (now: number) => {
      if (lastRafRef.current !== null) {
        const dt = (now - lastRafRef.current) / 1000;
        setCurrentTime((prev) => {
          const next = prev + dt;

          for (const sfxClip of project.soundEffects) {
            if (
              !triggeredSfxRef.current.has(sfxClip.id) &&
              sfxClip.startTime >= prev - 0.04 &&
              sfxClip.startTime <= next
            ) {
              triggeredSfxRef.current.add(sfxClip.id);
              const asset = sfxById.get(sfxClip.sfxAssetId);
              if (asset) {
                playSfxNow(asset, sfxClip.volume);
              }
            }
          }

          if (next >= duration) {
            triggeredSfxRef.current.clear();
            if (isLooping) return 0;
            setIsPlaying(false);
            return duration;
          }
          return next;
        });
      }
      lastRafRef.current = now;
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, duration, isLooping, project.soundEffects, sfxById]);

  useEffect(() => {
    if (isPlaying) {
      stopPreviewAudio();
    }
    syncActiveMusicPlayback(isPlaying, currentTime, musicClips, musicById);
  }, [isPlaying, currentTime, musicClips, musicById]);

  useEffect(() => {
    return () => {
      stopAllActiveMusic();
      stopPreviewAudio();
    };
  }, []);

  const selectedClip = useMemo(() => {
    if (!selection || selection.kind !== 'clip') return null;
    return (
      project.overlayClips.find((c) => c.id === selection.id) ||
      project.baseClips.find((c) => c.id === selection.id) ||
      null
    );
  }, [selection, project]);

  const selectedText = useMemo(() => {
    if (!selection || selection.kind !== 'text') return null;
    return project.textOverlays.find((t) => t.id === selection.id) || null;
  }, [selection, project]);

  const selectedSfx = useMemo(() => {
    if (!selection || selection.kind !== 'sfx') return null;
    return project.soundEffects.find((s) => s.id === selection.id) || null;
  }, [selection, project]);

  const selectedMusic = useMemo(() => {
    if (!selection || selection.kind !== 'music') return null;
    return musicClips.find((m) => m.id === selection.id) || null;
  }, [selection, musicClips]);

  const handleAddClipToTrack = useCallback(
    (asset: MediaAsset, track: 'base' | 'overlay', replaceStarter = false) => {
      const existing =
        track === 'base' ? project.baseClips : project.overlayClips;

      // If user uploads their own video while only the default sample clip is on that track, replace it at 0s
      const onlyBuiltinSample =
        replaceStarter &&
        existing.length === 1 &&
        assetsById.get(existing[0].assetId)?.kind === 'builtin';

      const startAt = onlyBuiltinSample
        ? 0
        : track === 'base'
        ? existing.reduce((m, c) => Math.max(m, c.startTime + c.duration), 0)
        : existing.reduce((m, c) => Math.max(m, c.startTime + c.duration), 0);

      const clipDuration = Math.max(0.5, Number(asset.duration.toFixed(2)));
      const templateClip = existing[0];

      const newClip: VideoClip =
        track === 'base'
          ? {
              id: `clip-${Date.now()}`,
              assetId: asset.id,
              label: asset.name,
              track: 'base',
              startTime: startAt,
              duration: clipDuration,
              sourceOffset: 0,
              x: templateClip?.x ?? 50,
              y:
                templateClip?.y ??
                (project.overlayClips.length > 0 ? 75 : 50),
              widthPct: templateClip?.widthPct ?? 100,
              heightPct:
                templateClip?.heightPct ??
                (project.overlayClips.length > 0 ? 50 : 100),
              scale: 1,
              borderRadius: 0,
              borderWidth: 0,
              borderColor: '#FFFFFF',
              opacity: 1,
              fit: 'cover',
              blurBackdrop: false,
              volume: 1,
              speed: 1,
              transitionIn: startAt > 0 ? 'slide-left' : 'none',
              transitionInDuration: startAt > 0 ? 0.35 : 0,
              transitionOut: 'none',
              transitionOutDuration: 0,
            }
          : {
              id: `clip-${Date.now()}`,
              assetId: asset.id,
              label: asset.name,
              track: 'overlay',
              startTime: startAt,
              duration: clipDuration,
              sourceOffset: 0,
              x: templateClip?.x ?? 50,
              y: templateClip?.y ?? 25,
              widthPct: templateClip?.widthPct ?? 100,
              heightPct: templateClip?.heightPct ?? 50,
              scale: 1,
              borderRadius: templateClip?.borderRadius ?? 0,
              borderWidth: templateClip?.borderWidth ?? 0,
              borderColor: '#FFFFFF',
              opacity: 1,
              fit: 'cover',
              blurBackdrop: false,
              volume: 0.9,
              speed: 1,
              transitionIn: 'none',
              transitionInDuration: 0,
              transitionOut: 'none',
              transitionOutDuration: 0,
              layoutPreset: templateClip?.layoutPreset ?? 'split-50',
            };

      const nextBaseClips =
        track === 'base'
          ? onlyBuiltinSample
            ? [newClip]
            : [...project.baseClips, newClip]
          : project.baseClips.map((c) =>
              c.heightPct === 100 && c.y === 50 && project.overlayClips.length === 0
                ? { ...c, y: 75, heightPct: 50 }
                : c
            );

      const nextOverlayClips =
        track === 'overlay'
          ? onlyBuiltinSample
            ? [newClip]
            : [...project.overlayClips, newClip]
          : project.overlayClips;

      const next: ClipProject = {
        ...project,
        thumbnailUrl: project.thumbnailUrl || asset.thumbnailUrl || '',
        baseClips: nextBaseClips,
        overlayClips: nextOverlayClips,
      };

      commitProjectChange(next);
      setSelection({ kind: 'clip', id: newClip.id });
      setCurrentTime(startAt);
    },
    [project, assetsById, commitProjectChange]
  );

  const handleUploadVideoForTrack = async (
    files: FileList,
    track: 'base' | 'overlay'
  ) => {
    const file = files[0];
    if (!file) return;

    const isVideoFile =
      file.type.startsWith('video/') ||
      /\.(mp4|mov|webm|mkv|avi|m4v|ogv)$/i.test(file.name);
    const isImageFile =
      file.type.startsWith('image/') ||
      /\.(png|jpe?g|webp|gif|svg|avif|bmp)$/i.test(file.name);

    if (!isVideoFile && !isImageFile) return;

    if (isImageFile) {
      const suggestedDur = Math.max(
        6,
        Math.min(60, Number(duration.toFixed(1)))
      );
      const meta = await readUploadedImageMetadata(file, suggestedDur);
      const asset: MediaAsset = {
        id: `asset-img-${Date.now()}`,
        name: file.name.replace(/\.[^.]+$/, ''),
        kind: 'uploaded',
        mediaType: 'image',
        srcUrl: meta.srcUrl,
        thumbnailUrl: meta.thumbnailUrl,
        duration: meta.duration,
        width: meta.width,
        height: meta.height,
      };
      onAddAssets([asset]);
      handleAddClipToTrack(asset, track, true);
    } else {
      const meta = await readUploadedVideoMetadata(file);
      const asset: MediaAsset = {
        id: `asset-up-${Date.now()}`,
        name: file.name.replace(/\.[^.]+$/, ''),
        kind: 'uploaded',
        mediaType: 'video',
        srcUrl: meta.srcUrl,
        thumbnailUrl: meta.thumbnailUrl,
        duration: meta.duration,
        width: meta.width,
        height: meta.height,
      };
      onAddAssets([asset]);
      handleAddClipToTrack(asset, track, true);
    }
  };

  const handleUploadSfxFiles = async (files: FileList) => {
    const created: SoundEffectAsset[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('audio/')) continue;
      const meta = await readUploadedAudioDuration(file);
      created.push({
        id: `sfx-up-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        name: file.name.replace(/\.[^.]+$/, ''),
        kind: 'uploaded',
        duration: meta.duration,
        srcUrl: meta.srcUrl,
        category: 'Uploaded',
      });
    }
    if (created.length > 0) {
      onAddSfxAssets(created);
    }
  };

  const handleUploadMusicFiles = async (files: FileList) => {
    const created: MusicAsset[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('audio/')) continue;
      const meta = await readUploadedAudioDuration(file);
      created.push({
        id: `mus-up-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        name: file.name.replace(/\.[^.]+$/, ''),
        kind: 'uploaded',
        duration: meta.duration,
        srcUrl: meta.srcUrl,
        mood: 'Uploaded',
      });
    }
    if (created.length > 0) {
      onAddMusicAssets(created);
    }
  };

  const handleApplyOverlayLayout = (presetId: OverlayLayoutPreset) => {
    const preset = OVERLAY_LAYOUT_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    const nextBase = project.baseClips.map((clip) => ({
      ...clip,
      x: preset.baseBounds.x,
      y: preset.baseBounds.y,
      widthPct: preset.baseBounds.widthPct,
      heightPct: preset.baseBounds.heightPct,
      scale: 1,
      feather: 0,
      cropTop: 0,
      cropBottom: 0,
      cropLeft: 0,
      cropRight: 0,
    }));

    const nextOverlay = project.overlayClips.map((clip) => ({
      ...clip,
      x: preset.overlayBounds.x,
      y: preset.overlayBounds.y,
      widthPct: preset.overlayBounds.widthPct,
      heightPct: preset.overlayBounds.heightPct,
      scale: 1,
      borderRadius: preset.overlayBounds.borderRadius,
      borderWidth: preset.overlayBounds.borderWidth,
      feather: preset.overlayBounds.feather ?? 0,
      featherEdge: preset.overlayBounds.featherEdge ?? 'all',
      cropTop: 0,
      cropBottom: 0,
      cropLeft: 0,
      cropRight: 0,
      layoutPreset: presetId,
    }));

    const alignedY = presetId === 'split-65' ? 35 : 50;
    commitProjectChange({
      ...project,
      category: presetId.startsWith('split') ? 'Split Screen' : 'PiP Overlay',
      baseClips: nextBase,
      overlayClips: nextOverlay,
      seamDivider: {
        ...seamDivider,
        positionY: presetId.startsWith('split')
          ? alignedY
          : seamDivider.positionY,
      },
    });
  };

  const handleSwapTracks = useCallback(() => {
    const b0 = project.baseClips[0];
    const o0 = project.overlayClips[0];
    if (!b0 || !o0) return;

    const isBaseFullscreen = b0.widthPct >= 95 && b0.heightPct >= 95;
    const isOverlaySmall = o0.widthPct < 90 || o0.heightPct < 90;

    if (isBaseFullscreen && isOverlaySmall) {
      // PiP layout: swap clips across tracks while keeping fullscreen on base & PiP on overlay
      const nextBase = project.overlayClips.map((c) => ({
        ...c,
        track: 'base' as const,
        x: b0.x,
        y: b0.y,
        widthPct: b0.widthPct,
        heightPct: b0.heightPct,
        scale: b0.scale,
        borderRadius: b0.borderRadius,
        borderWidth: b0.borderWidth,
        feather: b0.feather ?? 0,
        featherEdge: b0.featherEdge,
      }));
      const nextOverlay = project.baseClips.map((c) => ({
        ...c,
        track: 'overlay' as const,
        x: o0.x,
        y: o0.y,
        widthPct: o0.widthPct,
        heightPct: o0.heightPct,
        scale: o0.scale,
        borderRadius: o0.borderRadius,
        borderWidth: o0.borderWidth,
        feather: o0.feather ?? 0,
        featherEdge: o0.featherEdge,
        layoutPreset: o0.layoutPreset,
      }));
      commitProjectChange({
        ...project,
        baseClips: nextBase,
        overlayClips: nextOverlay,
      });
      return;
    }

    const flipEdge = (
      edge?: VideoClip['featherEdge']
    ): VideoClip['featherEdge'] => {
      if (edge === 'top') return 'bottom';
      if (edge === 'bottom') return 'top';
      if (edge === 'left') return 'right';
      if (edge === 'right') return 'left';
      return edge;
    };

    // Split screen: swap geometry positions
    const nextBase = project.baseClips.map((c) => ({
      ...c,
      x: o0.x,
      y: o0.y,
      widthPct: o0.widthPct,
      heightPct: o0.heightPct,
      scale: o0.scale,
      borderRadius: o0.borderRadius,
      borderWidth: o0.borderWidth,
      feather: o0.feather ?? 0,
      featherEdge: flipEdge(o0.featherEdge),
    }));
    const nextOverlay = project.overlayClips.map((c) => ({
      ...c,
      x: b0.x,
      y: b0.y,
      widthPct: b0.widthPct,
      heightPct: b0.heightPct,
      scale: b0.scale,
      borderRadius: b0.borderRadius,
      borderWidth: b0.borderWidth,
      feather: b0.feather ?? 0,
      featherEdge: flipEdge(b0.featherEdge),
    }));

    commitProjectChange({
      ...project,
      baseClips: nextBase,
      overlayClips: nextOverlay,
    });
  }, [project, commitProjectChange]);

  const handleAddTextOverlay = (
    presetId: TextStylePreset,
    customText?: string
  ) => {
    const preset =
      TEXT_STYLE_PRESETS.find((p) => p.id === presetId) ||
      TEXT_STYLE_PRESETS[0];

    const newText: TextOverlay = {
      id: `txt-${Date.now()}`,
      text: customText || preset.sample,
      startTime: Number(currentTime.toFixed(1)),
      duration: 3.5,
      x: 50,
      y: 50,
      fontSize: 60,
      fontFamily: brandKit.primaryFont || preset.fontFamily,
      color: preset.color,
      bgColor: preset.bgColor,
      accentColor: brandKit.accentColor || preset.accentColor,
      hasBg: preset.hasBg,
      stylePreset: preset.id,
      animation: 'pop',
      animationDuration: 0.28,
      uppercase: preset.uppercase,
    };

    commitProjectChange({
      ...project,
      textOverlays: [...project.textOverlays, newText],
    });
    setSelection({ kind: 'text', id: newText.id });
  };

  const handleAddSoundEffect = (sfxAsset: SoundEffectAsset) => {
    const newSfx: SoundEffectClip = {
      id: `sfx-c-${Date.now()}`,
      sfxAssetId: sfxAsset.id,
      label: sfxAsset.name,
      startTime: Number(currentTime.toFixed(1)),
      duration: Math.max(0.5, sfxAsset.duration),
      volume: 0.85,
    };
    commitProjectChange({
      ...project,
      soundEffects: [...project.soundEffects, newSfx],
    });
    setSelection({ kind: 'sfx', id: newSfx.id });
  };

  const handleAddMusicClip = (musicAsset: MusicAsset) => {
    const targetDuration = Math.max(8, Number(duration.toFixed(1)));
    const newMusic: MusicClip = {
      id: `mus-c-${Date.now()}`,
      musicAssetId: musicAsset.id,
      label: musicAsset.name,
      startTime: 0,
      duration: targetDuration,
      volume: 0.32,
    };
    commitProjectChange({
      ...project,
      musicClips: [...musicClips, newMusic],
    });
    setSelection({ kind: 'music', id: newMusic.id });
  };

  const handleApplyTransitionToSelected = (transition: TransitionType) => {
    if (selection?.kind !== 'clip') return;
    commitProjectChange({
      ...project,
      baseClips: project.baseClips.map((c) =>
        c.id === selection.id
          ? {
              ...c,
              transitionIn: transition,
              transitionInDuration: transition === 'none' ? 0 : 0.4,
            }
          : c
      ),
      overlayClips: project.overlayClips.map((c) =>
        c.id === selection.id
          ? {
              ...c,
              transitionIn: transition,
              transitionInDuration: transition === 'none' ? 0 : 0.4,
            }
          : c
      ),
    });
  };

  const handleUpdateClip = (clipId: string, patch: Partial<VideoClip>) => {
    if (patch.bgRemovalMode === 'none') {
      clearClipMaskCache(clipId);
    }
    commitProjectChange(
      {
        ...project,
        baseClips: project.baseClips.map((c) =>
          c.id === clipId ? { ...c, ...patch } : c
        ),
        overlayClips: project.overlayClips.map((c) =>
          c.id === clipId ? { ...c, ...patch } : c
        ),
      },
      false
    );
  };

  const isBaseSplit = useMemo(
    () =>
      project.baseClips.some(
        (c) => c.widthPct < 98 || c.heightPct < 98 || c.x !== 50 || c.y !== 50
      ),
    [project.baseClips]
  );

  const handleExpandBaseFullFrame = useCallback(() => {
    commitProjectChange({
      ...project,
      baseClips: project.baseClips.map((c) => ({
        ...c,
        x: 50,
        y: 50,
        widthPct: 100,
        heightPct: 100,
        scale: 1,
        feather: 0,
      })),
    });
  }, [project, commitProjectChange]);

  const handleUpdateText = (textId: string, patch: Partial<TextOverlay>) => {
    commitProjectChange(
      {
        ...project,
        textOverlays: project.textOverlays.map((t) =>
          t.id === textId ? { ...t, ...patch } : t
        ),
      },
      false
    );
  };

  const handleUpdateSfx = (
    sfxId: string,
    patch: Partial<SoundEffectClip>
  ) => {
    commitProjectChange(
      {
        ...project,
        soundEffects: project.soundEffects.map((s) =>
          s.id === sfxId ? { ...s, ...patch } : s
        ),
      },
      false
    );
  };

  const handleUpdateMusic = (
    musicId: string,
    patch: Partial<MusicClip>
  ) => {
    commitProjectChange(
      {
        ...project,
        musicClips: musicClips.map((m) =>
          m.id === musicId ? { ...m, ...patch } : m
        ),
      },
      false
    );
  };

  const handleSplitAtPlayhead = useCallback(() => {
    const trySplitClip = (list: VideoClip[], targetId?: string) => {
      const idx = list.findIndex((c) => {
        const inside =
          currentTime > c.startTime + 0.35 &&
          currentTime < c.startTime + c.duration - 0.35;
        return targetId ? c.id === targetId && inside : inside;
      });
      if (idx === -1) return null;
      const clip = list[idx];
      const leftDur = Number((currentTime - clip.startTime).toFixed(2));
      const rightDur = Number((clip.duration - leftDur).toFixed(2));

      const leftClip: VideoClip = {
        ...clip,
        duration: leftDur,
        transitionOut: 'none',
        transitionOutDuration: 0,
      };
      const rightClip: VideoClip = {
        ...clip,
        id: `clip-${Date.now()}`,
        startTime: currentTime,
        duration: rightDur,
        sourceOffset: clip.sourceOffset + leftDur * clip.speed,
        transitionIn: 'none',
        transitionInDuration: 0,
      };
      const copy = [...list];
      copy.splice(idx, 1, leftClip, rightClip);
      return { copy, newId: rightClip.id };
    };

    const targetId = selection?.kind === 'clip' ? selection.id : undefined;
    const splitOverlay = trySplitClip(project.overlayClips, targetId);
    if (splitOverlay) {
      commitProjectChange({ ...project, overlayClips: splitOverlay.copy });
      setSelection({ kind: 'clip', id: splitOverlay.newId });
      return;
    }

    const splitBase = trySplitClip(project.baseClips, targetId);
    if (splitBase) {
      commitProjectChange({ ...project, baseClips: splitBase.copy });
      setSelection({ kind: 'clip', id: splitBase.newId });
    }
  }, [currentTime, selection, project, commitProjectChange]);

  const handleDeleteSelected = useCallback(() => {
    if (!selection) return;
    if (selection.kind === 'clip') {
      clearClipMaskCache(selection.id);
      commitProjectChange({
        ...project,
        baseClips: project.baseClips.filter((c) => c.id !== selection.id),
        overlayClips: project.overlayClips.filter((c) => c.id !== selection.id),
      });
    } else if (selection.kind === 'text') {
      commitProjectChange({
        ...project,
        textOverlays: project.textOverlays.filter((t) => t.id !== selection.id),
      });
    } else if (selection.kind === 'sfx') {
      commitProjectChange({
        ...project,
        soundEffects: project.soundEffects.filter((s) => s.id !== selection.id),
      });
    } else {
      commitProjectChange({
        ...project,
        musicClips: musicClips.filter((m) => m.id !== selection.id),
      });
    }
    setSelection(null);
  }, [selection, project, musicClips, commitProjectChange]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        handleSplitAtPlayhead();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleDeleteSelected();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSplitAtPlayhead, handleDeleteSelected, handleUndo, handleRedo]);

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#09090B] text-[#F4F4F5] flex flex-col">
      {/* Top Navbar */}
      <EditorTopBar
        title={project.title}
        aspectRatio={project.aspectRatio}
        canUndo={past.length > 0}
        canRedo={future.length > 0}
        onOpenProjects={() => {
          setIsPlaying(false);
          onOpenProjects();
        }}
        onTitleChange={(nextTitle) =>
          commitProjectChange({ ...project, title: nextTitle }, false)
        }
        onAspectRatioChange={(ratio: AspectRatio) =>
          commitProjectChange({ ...project, aspectRatio: ratio })
        }
        onUndo={handleUndo}
        onRedo={handleRedo}
        onOpenExport={() => {
          setIsPlaying(false);
          setShowExportModal(true);
        }}
      />

      {/* RVE Layout: Full-Height Sidebar on Left | [ [Preview + Inspector] / Timeline ] on Right */}
      <div className="flex-1 min-h-0 flex">
        <LeftAssetDrawer
          assets={assets}
          sfxAssets={sfxAssets}
          musicAssets={musicAssets}
          aspectRatio={project.aspectRatio}
          activeTab={activeTab}
          isTimelinePlaying={isPlaying}
          seamDivider={seamDivider}
          activeLayout={project.overlayClips[0]?.layoutPreset}
          activeTransition={selectedClip?.transitionIn}
          canSwapTracks={
            project.baseClips.length > 0 && project.overlayClips.length > 0
          }
          onChangeTab={setActiveTab}
          onUploadVideoForTrack={handleUploadVideoForTrack}
          onUploadSfxFiles={handleUploadSfxFiles}
          onUploadMusicFiles={handleUploadMusicFiles}
          onAddClipToTrack={handleAddClipToTrack}
          onAspectRatioChange={(ratio) =>
            commitProjectChange({ ...project, aspectRatio: ratio })
          }
          onApplyOverlayLayout={handleApplyOverlayLayout}
          onSwapTracks={handleSwapTracks}
          onUpdateSeamDivider={handleUpdateSeamDivider}
          onAddTextOverlay={handleAddTextOverlay}
          onAddSoundEffect={handleAddSoundEffect}
          onAddMusicClip={handleAddMusicClip}
          onApplyTransitionToSelected={handleApplyTransitionToSelected}
        />

        <div className="flex-1 min-w-0 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 flex">
            <PreviewStage
              aspectRatio={project.aspectRatio}
              currentTime={currentTime}
              duration={duration}
              isPlaying={isPlaying}
              isLooping={isLooping}
              baseClips={project.baseClips}
              overlayClips={project.overlayClips}
              textOverlays={project.textOverlays}
              assetsById={assetsById}
              selection={selection}
              seamDivider={seamDivider}
              onTogglePlay={() => setIsPlaying((p) => !p)}
              onToggleLoop={() => setIsLooping((l) => !l)}
              onSeek={(t) => {
                triggeredSfxRef.current.clear();
                stopAllActiveMusic();
                setCurrentTime(t);
              }}
              onSplitAtPlayhead={handleSplitAtPlayhead}
              onSelect={setSelection}
              onUpdateClipGeometry={handleUpdateClip}
              onUpdateTextGeometry={handleUpdateText}
              onDropVideoFile={(files) => {
                const f = files[0];
                const isImg =
                  f?.type.startsWith('image/') ||
                  /\.(png|jpe?g|webp|gif|svg|avif|bmp)$/i.test(f?.name || '');
                const targetTrack =
                  project.baseClips.length > 0 || isImg ? 'overlay' : 'base';
                handleUploadVideoForTrack(files, targetTrack);
              }}
              onUploadVideoForTrack={handleUploadVideoForTrack}
            />

            <RightInspector
              selection={selection}
              selectedClip={selectedClip}
              selectedText={selectedText}
              selectedSfx={selectedSfx}
              selectedMusic={selectedMusic}
              seamDivider={seamDivider}
              isBaseSplit={isBaseSplit}
              onExpandBaseFullFrame={handleExpandBaseFullFrame}
              onUpdateSeamDivider={handleUpdateSeamDivider}
              onUpdateClip={handleUpdateClip}
              onUpdateText={handleUpdateText}
              onUpdateSfx={handleUpdateSfx}
              onUpdateMusic={handleUpdateMusic}
              onDeleteSelected={handleDeleteSelected}
            />
          </div>

          <TimelinePanel
            currentTime={currentTime}
            duration={duration}
            baseClips={project.baseClips}
            overlayClips={project.overlayClips}
            textOverlays={project.textOverlays}
            soundEffects={project.soundEffects}
            musicClips={musicClips}
            selection={selection}
            onSeek={(t) => {
              triggeredSfxRef.current.clear();
              stopAllActiveMusic();
              setCurrentTime(t);
            }}
            onSelect={setSelection}
            onUpdateClipTiming={(clipId, startTime, nextDur) =>
              handleUpdateClip(clipId, { startTime, duration: nextDur })
            }
            onUpdateTextTiming={(textId, startTime, nextDur) =>
              handleUpdateText(textId, { startTime, duration: nextDur })
            }
            onUpdateSfxTiming={(sfxId, startTime) =>
              handleUpdateSfx(sfxId, { startTime })
            }
            onUpdateMusicTiming={(musicId, startTime, nextDur) =>
              handleUpdateMusic(musicId, { startTime, duration: nextDur })
            }
            onSplitAtPlayhead={handleSplitAtPlayhead}
            onDeleteSelected={handleDeleteSelected}
          />
        </div>
      </div>

      {showExportModal && (
        <ExportModal
          projectId={project.id}
          projectTitle={project.title}
          aspectRatio={project.aspectRatio}
          duration={duration}
          baseClips={project.baseClips}
          overlayClips={project.overlayClips}
          textOverlays={project.textOverlays}
          soundEffects={project.soundEffects}
          musicClips={musicClips}
          assetsById={assetsById}
          sfxById={sfxById}
          musicById={musicById}
          seamDivider={seamDivider}
          onClose={() => setShowExportModal(false)}
          onExportComplete={onExportComplete}
        />
      )}
    </div>
  );
};
