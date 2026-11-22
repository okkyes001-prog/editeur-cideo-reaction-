import {
  AspectRatio,
  MediaAsset,
  MusicAsset,
  MusicClip,
  SeamDividerConfig,
  SoundEffectAsset,
  SoundEffectClip,
  TextOverlay,
  VideoClip,
} from '../types/editor';
import { exportTimelineToVideo } from './compositor';

export async function isWebCodecsSupported(): Promise<boolean> {
  return false;
}

export async function exportWithWebCodecs(params: {
  aspectRatio: AspectRatio;
  duration: number;
  resolution: '720p' | '1080p';
  fps: 30 | 60;
  baseClips: VideoClip[];
  overlayClips: VideoClip[];
  textOverlays: TextOverlay[];
  soundEffects: SoundEffectClip[];
  musicClips: MusicClip[];
  assetsById: Map<string, MediaAsset>;
  sfxById: Map<string, SoundEffectAsset>;
  musicById: Map<string, MusicAsset>;
  seamDivider?: SeamDividerConfig;
  onProgress: (pct: number) => void;
}): Promise<{ blobUrl: string; sizeLabel: string; mimeType: string }> {
  // Use the robust MediaRecorder stream-recording pipeline which guarantees valid WebM container headers and zero black screens.
  return exportTimelineToVideo(params);
}
