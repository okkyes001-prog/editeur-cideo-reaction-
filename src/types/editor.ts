export type AspectRatio = '9:16' | '1:1' | '16:9';

export type TransitionType =
  | 'none'
  | 'fade'
  | 'slide-left'
  | 'slide-up'
  | 'zoom-punch'
  | 'flash'
  | 'wipe-split';

export type OverlayLayoutPreset =
  | 'split-50'
  | 'split-65'
  | 'split-blend'
  | 'pip-br'
  | 'pip-tr'
  | 'pip-circle'
  | 'full-overlay';

export type FeatherEdge = 'all' | 'top' | 'bottom' | 'left' | 'right';

export type BackgroundRemovalMode = 'none' | 'ai' | 'chroma';

export type ClipBackgroundMode =
  | 'transparent'
  | 'blur'
  | 'solid'
  | 'gradient'
  | 'image';

export type TextAnimation = 'none' | 'pop' | 'slide-up' | 'fade' | 'typewriter';

export type TextStylePreset =
  | 'viral-bold'
  | 'highlight-box'
  | 'minimal-clean'
  | 'caption-karaoke';

export type BuiltinSceneId = 'podcast' | 'parkour' | 'tokyo' | 'kinetic';

export type BuiltinSfxId =
  | 'whoosh'
  | 'swish'
  | 'rewind'
  | 'riser'
  | 'boom'
  | 'vine-boom'
  | 'punch'
  | 'slam'
  | 'pop'
  | 'click'
  | 'typing'
  | 'cash'
  | 'flash'
  | 'ding'
  | 'wrong'
  | 'record-scratch'
  | 'boing'
  | 'sparkle'
  | 'bleep'
  | 'glitch'
  | 'alert'
  | 'heartbeat'
  | 'news-stinger'
  | 'news-ticker';

export type BuiltinMusicId =
  | 'horror-drone'
  | 'suspense-pulse'
  | 'chase-tension'
  | 'happy-upbeat'
  | 'victory-groove'
  | 'phonk-drive'
  | 'motivation-epic'
  | 'lofi-chill'
  | 'sad-piano'
  | 'dramatic-choir'
  | 'quirky-comedy'
  | 'sneaky-tip'
  | 'news-breaking'
  | 'news-report'
  | 'news-urgent';

export interface MediaAsset {
  id: string;
  name: string;
  kind: 'uploaded' | 'builtin';
  mediaType?: 'video' | 'image';
  srcUrl: string;
  thumbnailUrl: string;
  duration: number;
  width: number;
  height: number;
  builtinScene?: BuiltinSceneId;
  category?: string;
}

export interface SoundEffectAsset {
  id: string;
  name: string;
  kind: 'uploaded' | 'builtin';
  duration: number;
  builtinSfx?: BuiltinSfxId;
  srcUrl?: string;
  category: string;
}

export interface SoundEffectClip {
  id: string;
  sfxAssetId: string;
  label: string;
  startTime: number;
  duration: number;
  volume: number;
  fadeIn?: number;
  fadeOut?: number;
}

export interface MusicAsset {
  id: string;
  name: string;
  kind: 'uploaded' | 'builtin';
  duration: number;
  builtinMusic?: BuiltinMusicId;
  srcUrl?: string;
  mood: string;
}

export interface MusicClip {
  id: string;
  musicAssetId: string;
  label: string;
  startTime: number;
  duration: number;
  volume: number;
  fadeIn?: number;
  fadeOut?: number;
}

export interface VideoClip {
  id: string;
  assetId: string;
  label: string;
  track: 'base' | 'overlay';
  startTime: number;
  duration: number;
  sourceOffset: number;
  x: number;
  y: number;
  widthPct: number;
  heightPct: number;
  scale: number;
  borderRadius: number;
  borderWidth: number;
  borderColor: string;
  feather?: number;
  featherEdge?: FeatherEdge;
  cropTop?: number;
  cropBottom?: number;
  cropLeft?: number;
  cropRight?: number;
  opacity: number;
  fit: 'cover' | 'contain';
  blurBackdrop: boolean;
  volume: number;
  speed: number;
  fadeIn?: number;
  fadeOut?: number;
  brightness?: number;
  contrast?: number;
  saturate?: number;
  flipH?: boolean;
  transitionIn: TransitionType;
  transitionInDuration: number;
  transitionOut: TransitionType;
  transitionOutDuration: number;
  layoutPreset?: OverlayLayoutPreset;
  bgRemovalMode?: BackgroundRemovalMode;
  bgThreshold?: number;
  bgEdgeSoftness?: number;
  bgInvertMask?: boolean;
  chromaColor?: string;
  chromaTolerance?: number;
  bgReplaceMode?: ClipBackgroundMode;
  bgColor?: string;
  bgSecondaryColor?: string;
  bgImageUrl?: string;
}

export interface TextOverlay {
  id: string;
  text: string;
  startTime: number;
  duration: number;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: 'Outfit' | 'Plus Jakarta Sans' | 'JetBrains Mono';
  color: string;
  bgColor: string;
  accentColor: string;
  hasBg: boolean;
  stylePreset: TextStylePreset;
  animation: TextAnimation;
  animationDuration: number;
  uppercase: boolean;
}

export type SelectionTarget =
  | { kind: 'clip'; id: string }
  | { kind: 'text'; id: string }
  | { kind: 'sfx'; id: string }
  | { kind: 'music'; id: string }
  | null;

export interface SeamDividerConfig {
  enabled: boolean;
  positionY: number;
  thickness: number;
  blurAmount: number;
  color: string;
  secondaryColor: string;
  opacity: number;
}

export interface ClipProject {
  id: string;
  title: string;
  category: 'Split Screen' | 'PiP Overlay' | 'Multi-Cut';
  aspectRatio: AspectRatio;
  updatedAt: string;
  thumbnailUrl: string;
  baseClips: VideoClip[];
  overlayClips: VideoClip[];
  textOverlays: TextOverlay[];
  soundEffects: SoundEffectClip[];
  musicClips: MusicClip[];
  seamDivider?: SeamDividerConfig;
}

export interface ExportRecord {
  id: string;
  projectId: string;
  projectTitle: string;
  format: string;
  resolution: string;
  duration: number;
  fileSizeLabel: string;
  createdAt: string;
  downloadUrl?: string;
}

export interface BrandKit {
  primaryFont: 'Outfit' | 'Plus Jakarta Sans' | 'JetBrains Mono';
  accentColor: string;
  textColor: string;
  defaultTextStyle: TextStylePreset;
  defaultSafeZone: boolean;
}
