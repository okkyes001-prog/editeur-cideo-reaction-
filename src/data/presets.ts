import {
  AspectRatio,
  BrandKit,
  ClipProject,
  ExportRecord,
  FeatherEdge,
  MediaAsset,
  MusicAsset,
  OverlayLayoutPreset,
  SeamDividerConfig,
  SoundEffectAsset,
  TextStylePreset,
  TransitionType,
} from '../types/editor';

export const CREATOR_AVATAR_URL =
  '/src/assets/images/avatar_creator_pro_1795373509882.jpg';

export const BUILTIN_MEDIA_ASSETS: MediaAsset[] = [];

export const BUILTIN_SFX_ASSETS: SoundEffectAsset[] = [
  // News (Akhbar)
  {
    id: 'sfx-news-stinger',
    name: 'News Report Transition',
    kind: 'builtin',
    duration: 2.2,
    builtinSfx: 'news-stinger',
    srcUrl: 'https://assets.mixkit.co/active_storage/sfx/3089/3089-preview.mp3',
    category: 'News',
  },
  {
    id: 'sfx-news-intro',
    name: 'Breaking News Intro',
    kind: 'builtin',
    duration: 2.8,
    builtinSfx: 'news-stinger',
    srcUrl: 'https://assets.mixkit.co/active_storage/sfx/1151/1151-preview.mp3',
    category: 'News',
  },
  {
    id: 'sfx-news-musical',
    name: 'News Bulletin Music Sting',
    kind: 'builtin',
    duration: 3.0,
    builtinSfx: 'news-ticker',
    srcUrl: 'https://assets.mixkit.co/active_storage/sfx/1145/1145-preview.mp3',
    category: 'News',
  },
  {
    id: 'sfx-alert',
    name: 'Urgent Alert Buzzer',
    kind: 'builtin',
    duration: 1.5,
    builtinSfx: 'alert',
    srcUrl: 'https://assets.mixkit.co/active_storage/sfx/992/992-preview.mp3',
    category: 'News',
  },

  // Transitions
  {
    id: 'sfx-whoosh',
    name: 'Air Whoosh',
    kind: 'builtin',
    duration: 1.0,
    builtinSfx: 'whoosh',
    srcUrl: 'https://assets.mixkit.co/active_storage/sfx/1489/1489-preview.mp3',
    category: 'Transition',
  },
  {
    id: 'sfx-swish',
    name: 'Cinematic Fast Whoosh',
    kind: 'builtin',
    duration: 1.2,
    builtinSfx: 'swish',
    srcUrl: 'https://assets.mixkit.co/active_storage/sfx/1492/1492-preview.mp3',
    category: 'Transition',
  },
  {
    id: 'sfx-arrow-whoosh',
    name: 'Fast Whip Swish',
    kind: 'builtin',
    duration: 0.8,
    builtinSfx: 'swish',
    srcUrl: 'https://assets.mixkit.co/active_storage/sfx/1491/1491-preview.mp3',
    category: 'Transition',
  },
  {
    id: 'sfx-riser',
    name: 'Cinematic Sweep Heartbeat',
    kind: 'builtin',
    duration: 2.4,
    builtinSfx: 'riser',
    srcUrl: 'https://assets.mixkit.co/active_storage/sfx/488/488-preview.mp3',
    category: 'Transition',
  },
  {
    id: 'sfx-flash',
    name: 'Camera Shutter Flash',
    kind: 'builtin',
    duration: 0.5,
    builtinSfx: 'flash',
    srcUrl: 'https://assets.mixkit.co/active_storage/sfx/1430/1430-preview.mp3',
    category: 'Transition',
  },

  // Impacts
  {
    id: 'sfx-boom',
    name: 'Cinematic Deep Impact',
    kind: 'builtin',
    duration: 2.2,
    builtinSfx: 'boom',
    srcUrl: 'https://assets.mixkit.co/active_storage/sfx/1143/1143-preview.mp3',
    category: 'Impact',
  },
  {
    id: 'sfx-vine-boom',
    name: 'Movie Impact Slam',
    kind: 'builtin',
    duration: 1.8,
    builtinSfx: 'vine-boom',
    srcUrl: 'https://assets.mixkit.co/active_storage/sfx/2902/2902-preview.mp3',
    category: 'Impact',
  },
  {
    id: 'sfx-punch',
    name: 'Short Explosion Hit',
    kind: 'builtin',
    duration: 1.2,
    builtinSfx: 'punch',
    srcUrl: 'https://assets.mixkit.co/active_storage/sfx/1694/1694-preview.mp3',
    category: 'Impact',
  },
  {
    id: 'sfx-heartbeat',
    name: 'Heartbeat Thud',
    kind: 'builtin',
    duration: 1.1,
    builtinSfx: 'heartbeat',
    srcUrl: 'https://assets.mixkit.co/active_storage/sfx/490/490-preview.mp3',
    category: 'Impact',
  },

  // Captions & UI
  {
    id: 'sfx-pop',
    name: 'Message Pop Alert',
    kind: 'builtin',
    duration: 0.4,
    builtinSfx: 'pop',
    srcUrl: 'https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3',
    category: 'Caption',
  },
  {
    id: 'sfx-click',
    name: 'Hard Pop Click',
    kind: 'builtin',
    duration: 0.3,
    builtinSfx: 'click',
    srcUrl: 'https://assets.mixkit.co/active_storage/sfx/2364/2364-preview.mp3',
    category: 'Caption',
  },
  {
    id: 'sfx-typing',
    name: 'Keyboard Typing',
    kind: 'builtin',
    duration: 1.6,
    builtinSfx: 'typing',
    srcUrl: 'https://assets.mixkit.co/active_storage/sfx/1386/1386-preview.mp3',
    category: 'Caption',
  },
  {
    id: 'sfx-cash',
    name: 'Gold Coin / Cash',
    kind: 'builtin',
    duration: 1.0,
    builtinSfx: 'cash',
    srcUrl: 'https://assets.mixkit.co/active_storage/sfx/1999/1999-preview.mp3',
    category: 'Caption',
  },

  // Reactions & Comedy
  {
    id: 'sfx-ding',
    name: 'Bell Notification Ding',
    kind: 'builtin',
    duration: 1.2,
    builtinSfx: 'ding',
    srcUrl: 'https://assets.mixkit.co/active_storage/sfx/933/933-preview.mp3',
    category: 'Reaction',
  },
  {
    id: 'sfx-wrong',
    name: 'Wrong Answer Buzzer',
    kind: 'builtin',
    duration: 1.1,
    builtinSfx: 'wrong',
    srcUrl: 'https://assets.mixkit.co/active_storage/sfx/948/948-preview.mp3',
    category: 'Reaction',
  },
  {
    id: 'sfx-sad-trombone',
    name: 'Sad Fail Trombone',
    kind: 'builtin',
    duration: 2.1,
    builtinSfx: 'record-scratch',
    srcUrl: 'https://assets.mixkit.co/active_storage/sfx/471/471-preview.mp3',
    category: 'Reaction',
  },
  {
    id: 'sfx-laugh',
    name: 'Cartoon Laugh',
    kind: 'builtin',
    duration: 1.4,
    builtinSfx: 'boing',
    srcUrl: 'https://assets.mixkit.co/active_storage/sfx/2882/2882-preview.mp3',
    category: 'Reaction',
  },
  {
    id: 'sfx-sparkle',
    name: 'Happy Bells Chime',
    kind: 'builtin',
    duration: 1.4,
    builtinSfx: 'sparkle',
    srcUrl: 'https://assets.mixkit.co/active_storage/sfx/937/937-preview.mp3',
    category: 'Reaction',
  },

  // Glitch & Scary
  {
    id: 'sfx-bleep',
    name: 'Censor Bleep',
    kind: 'builtin',
    duration: 1.0,
    builtinSfx: 'bleep',
    srcUrl: 'https://assets.mixkit.co/active_storage/sfx/1082/1082-preview.mp3',
    category: 'Glitch',
  },
  {
    id: 'sfx-glitch',
    name: 'Electric Glitch Zap',
    kind: 'builtin',
    duration: 0.9,
    builtinSfx: 'glitch',
    srcUrl: 'https://assets.mixkit.co/active_storage/sfx/2595/2595-preview.mp3',
    category: 'Glitch',
  },
  {
    id: 'sfx-static',
    name: 'TV Glitch Static',
    kind: 'builtin',
    duration: 1.2,
    builtinSfx: 'glitch',
    srcUrl: 'https://assets.mixkit.co/active_storage/sfx/1457/1457-preview.mp3',
    category: 'Glitch',
  },
  {
    id: 'sfx-terror-sweep',
    name: 'Terror Dark Sweep',
    kind: 'builtin',
    duration: 2.3,
    builtinSfx: 'riser',
    srcUrl: 'https://assets.mixkit.co/active_storage/sfx/2630/2630-preview.mp3',
    category: 'Glitch',
  },
];

export const BUILTIN_MUSIC_ASSETS: MusicAsset[] = [
  // Scary / Fear
  {
    id: 'mus-horror-drone',
    name: 'Piano Horror',
    kind: 'builtin',
    duration: 60,
    builtinMusic: 'horror-drone',
    srcUrl: 'https://assets.mixkit.co/music/671/671.mp3',
    mood: 'Scary / Fear',
  },
  {
    id: 'mus-suspense-pulse',
    name: 'Dark Shadows',
    kind: 'builtin',
    duration: 60,
    builtinMusic: 'suspense-pulse',
    srcUrl: 'https://assets.mixkit.co/music/64/64.mp3',
    mood: 'Scary / Fear',
  },
  {
    id: 'mus-chase-tension',
    name: 'Fright Night Thriller',
    kind: 'builtin',
    duration: 60,
    builtinMusic: 'chase-tension',
    srcUrl: 'https://assets.mixkit.co/music/871/871.mp3',
    mood: 'Scary / Fear',
  },

  // Happy / Joy
  {
    id: 'mus-happy-upbeat',
    name: 'Feeling Happy',
    kind: 'builtin',
    duration: 60,
    builtinMusic: 'happy-upbeat',
    srcUrl: 'https://assets.mixkit.co/music/5/5.mp3',
    mood: 'Happy / Joy',
  },
  {
    id: 'mus-victory-groove',
    name: 'Smile Upbeat',
    kind: 'builtin',
    duration: 60,
    builtinMusic: 'victory-groove',
    srcUrl: 'https://assets.mixkit.co/music/1076/1076.mp3',
    mood: 'Happy / Joy',
  },
  {
    id: 'mus-tears-joy',
    name: 'Tears of Joy',
    kind: 'builtin',
    duration: 60,
    builtinMusic: 'happy-upbeat',
    srcUrl: 'https://assets.mixkit.co/music/839/839.mp3',
    mood: 'Happy / Joy',
  },

  // News (Akhbar)
  {
    id: 'mus-news-breaking',
    name: 'Breaking News Pulse',
    kind: 'builtin',
    duration: 60,
    builtinMusic: 'news-breaking',
    srcUrl: 'https://assets.mixkit.co/music/54/54.mp3',
    mood: 'News',
  },
  {
    id: 'mus-news-report',
    name: 'Live Newsroom Report',
    kind: 'builtin',
    duration: 60,
    builtinMusic: 'news-report',
    srcUrl: 'https://assets.mixkit.co/music/720/720.mp3',
    mood: 'News',
  },
  {
    id: 'mus-news-urgent',
    name: 'Headline Broadcast',
    kind: 'builtin',
    duration: 60,
    builtinMusic: 'news-urgent',
    srcUrl: 'https://assets.mixkit.co/music/623/623.mp3',
    mood: 'News',
  },

  // Hype / Viral
  {
    id: 'mus-phonk-drive',
    name: 'Trap Electro Vibes',
    kind: 'builtin',
    duration: 60,
    builtinMusic: 'phonk-drive',
    srcUrl: 'https://assets.mixkit.co/music/126/126.mp3',
    mood: 'Hype / Viral',
  },
  {
    id: 'mus-motivation-epic',
    name: 'Hip Hop Viral Beat',
    kind: 'builtin',
    duration: 60,
    builtinMusic: 'motivation-epic',
    srcUrl: 'https://assets.mixkit.co/music/738/738.mp3',
    mood: 'Hype / Viral',
  },
  {
    id: 'mus-lofi-chill',
    name: 'Sports Highlights Hype',
    kind: 'builtin',
    duration: 60,
    builtinMusic: 'lofi-chill',
    srcUrl: 'https://assets.mixkit.co/music/51/51.mp3',
    mood: 'Hype / Viral',
  },

  // Sad / Drama
  {
    id: 'mus-sad-piano',
    name: 'Silent Descent',
    kind: 'builtin',
    duration: 60,
    builtinMusic: 'sad-piano',
    srcUrl: 'https://assets.mixkit.co/music/614/614.mp3',
    mood: 'Sad / Drama',
  },
  {
    id: 'mus-dramatic-choir',
    name: 'Emotional Skyline',
    kind: 'builtin',
    duration: 60,
    builtinMusic: 'dramatic-choir',
    srcUrl: 'https://assets.mixkit.co/music/601/601.mp3',
    mood: 'Sad / Drama',
  },

  // Comedy
  {
    id: 'mus-quirky-comedy',
    name: 'Upbeat Comedy Jazz',
    kind: 'builtin',
    duration: 60,
    builtinMusic: 'quirky-comedy',
    srcUrl: 'https://assets.mixkit.co/music/644/644.mp3',
    mood: 'Comedy',
  },
  {
    id: 'mus-sneaky-tip',
    name: 'Playful Cat Walk',
    kind: 'builtin',
    duration: 60,
    builtinMusic: 'sneaky-tip',
    srcUrl: 'https://assets.mixkit.co/music/371/371.mp3',
    mood: 'Comedy',
  },
];

export const OVERLAY_LAYOUT_PRESETS: Array<{
  id: OverlayLayoutPreset;
  label: string;
  hint: string;
  baseBounds: { x: number; y: number; widthPct: number; heightPct: number };
  overlayBounds: {
    x: number;
    y: number;
    widthPct: number;
    heightPct: number;
    borderRadius: number;
    borderWidth: number;
    feather?: number;
    featherEdge?: FeatherEdge;
  };
}> = [
  {
    id: 'split-50',
    label: '50 / 50 Split',
    hint: 'Top reaction + bottom viral video',
    baseBounds: { x: 50, y: 75, widthPct: 100, heightPct: 50 },
    overlayBounds: {
      x: 50,
      y: 25,
      widthPct: 100,
      heightPct: 50,
      borderRadius: 0,
      borderWidth: 0,
      feather: 0,
    },
  },
  {
    id: 'split-65',
    label: '35 / 65 Split',
    hint: 'Top reaction + main bottom video',
    baseBounds: { x: 50, y: 67.5, widthPct: 100, heightPct: 65 },
    overlayBounds: {
      x: 50,
      y: 17.5,
      widthPct: 100,
      heightPct: 35,
      borderRadius: 0,
      borderWidth: 0,
      feather: 0,
    },
  },
  {
    id: 'split-blend',
    label: 'Seamless Blend',
    hint: 'Top reaction fades into bottom video',
    baseBounds: { x: 50, y: 69, widthPct: 100, heightPct: 62 },
    overlayBounds: {
      x: 50,
      y: 27,
      widthPct: 100,
      heightPct: 54,
      borderRadius: 0,
      borderWidth: 0,
      feather: 34,
      featherEdge: 'bottom',
    },
  },
  {
    id: 'pip-br',
    label: 'Reaction Corner',
    hint: 'Floating bottom-right reaction',
    baseBounds: { x: 50, y: 50, widthPct: 100, heightPct: 100 },
    overlayBounds: {
      x: 73,
      y: 76,
      widthPct: 40,
      heightPct: 28,
      borderRadius: 20,
      borderWidth: 3,
    },
  },
  {
    id: 'pip-tr',
    label: 'Top Right Box',
    hint: 'Floating top-right reaction',
    baseBounds: { x: 50, y: 50, widthPct: 100, heightPct: 100 },
    overlayBounds: {
      x: 73,
      y: 22,
      widthPct: 38,
      heightPct: 26,
      borderRadius: 20,
      borderWidth: 3,
    },
  },
  {
    id: 'pip-circle',
    label: 'Reaction Circle',
    hint: 'Circular cam over viral video',
    baseBounds: { x: 50, y: 50, widthPct: 100, heightPct: 100 },
    overlayBounds: {
      x: 25,
      y: 76,
      widthPct: 34,
      heightPct: 19.1,
      borderRadius: 999,
      borderWidth: 4,
    },
  },
  {
    id: 'full-overlay',
    label: 'Full Overlay',
    hint: 'Edge-to-edge video stack',
    baseBounds: { x: 50, y: 50, widthPct: 100, heightPct: 100 },
    overlayBounds: {
      x: 50,
      y: 50,
      widthPct: 100,
      heightPct: 100,
      borderRadius: 0,
      borderWidth: 0,
    },
  },
];

export const DEFAULT_SEAM_DIVIDER: SeamDividerConfig = {
  enabled: false,
  positionY: 50,
  thickness: 15,
  blurAmount: 20,
  color: '#09090B',
  secondaryColor: '#1E1B4B',
  opacity: 0.78,
};

export const SEAM_DIVIDER_PRESETS: Array<{
  id: string;
  label: string;
  blurAmount: number;
  thickness: number;
  color: string;
  secondaryColor: string;
  opacity: number;
}> = [
  {
    id: 'dark-smoke',
    label: 'Dark Blur',
    blurAmount: 20,
    thickness: 16,
    color: '#09090B',
    secondaryColor: '#09090B',
    opacity: 0.82,
  },
  {
    id: 'sunset-grad',
    label: 'Sunset',
    blurAmount: 18,
    thickness: 15,
    color: '#F97316',
    secondaryColor: '#A855F7',
    opacity: 0.65,
  },
  {
    id: 'cyan-neon',
    label: 'Cyber',
    blurAmount: 18,
    thickness: 14,
    color: '#06B6D4',
    secondaryColor: '#3B82F6',
    opacity: 0.65,
  },
  {
    id: 'news-red',
    label: 'News Red',
    blurAmount: 16,
    thickness: 14,
    color: '#EF4444',
    secondaryColor: '#7F1D1D',
    opacity: 0.72,
  },
  {
    id: 'pure-frosted',
    label: 'Frosted',
    blurAmount: 28,
    thickness: 16,
    color: '#FFFFFF',
    secondaryColor: '#D4D4D8',
    opacity: 0.16,
  },
];

export const TRANSITION_OPTIONS: Array<{
  id: TransitionType;
  label: string;
  description: string;
}> = [
  { id: 'none', label: 'Hard Cut', description: 'Instant cut' },
  { id: 'fade', label: 'Cross Dissolve', description: 'Smooth fade' },
  { id: 'slide-left', label: 'Whip Pan Left', description: 'Fast horizontal slide' },
  { id: 'slide-up', label: 'Vertical Push', description: 'Slide up reveal' },
  { id: 'zoom-punch', label: 'Zoom Punch', description: 'Dynamic snap zoom' },
  { id: 'flash', label: 'Flash Cut', description: 'Bright impact flash' },
  { id: 'wipe-split', label: 'Center Split', description: 'Symmetrical wipe' },
];

export const TEXT_STYLE_PRESETS: Array<{
  id: TextStylePreset;
  label: string;
  sample: string;
  fontFamily: 'Outfit' | 'Plus Jakarta Sans' | 'JetBrains Mono';
  color: string;
  bgColor: string;
  accentColor: string;
  hasBg: boolean;
  uppercase: boolean;
}> = [
  {
    id: 'viral-bold',
    label: 'Bold Impact',
    sample: 'WAIT FOR THE DROP',
    fontFamily: 'Outfit',
    color: '#FFFFFF',
    bgColor: '#000000',
    accentColor: '#FACC15',
    hasBg: false,
    uppercase: true,
  },
  {
    id: 'highlight-box',
    label: 'Highlight Box',
    sample: '3 SECOND HOOK',
    fontFamily: 'Outfit',
    color: '#090B0F',
    bgColor: '#FACC15',
    accentColor: '#F97316',
    hasBg: true,
    uppercase: true,
  },
  {
    id: 'minimal-clean',
    label: 'Editorial Sans',
    sample: 'Tokyo After Midnight',
    fontFamily: 'Plus Jakarta Sans',
    color: '#F3F4F6',
    bgColor: '#111827',
    accentColor: '#F97316',
    hasBg: true,
    uppercase: false,
  },
  {
    id: 'caption-karaoke',
    label: 'Karaoke Word Pop',
    sample: 'EVERY CLIPPER NEEDS THIS',
    fontFamily: 'Outfit',
    color: '#FFFFFF',
    bgColor: '#090B0F',
    accentColor: '#F97316',
    hasBg: true,
    uppercase: true,
  },
];

export const INITIAL_PROJECTS: ClipProject[] = [
  {
    id: 'proj-new-edit',
    title: 'New Reaction Edit',
    category: 'Split Screen',
    aspectRatio: '9:16',
    updatedAt: 'Just now',
    thumbnailUrl: '',
    baseClips: [],
    overlayClips: [],
    textOverlays: [],
    soundEffects: [],
    musicClips: [],
    seamDivider: DEFAULT_SEAM_DIVIDER,
  },
];

export const INITIAL_EXPORTS: ExportRecord[] = [];

export const DEFAULT_BRAND_KIT: BrandKit = {
  primaryFont: 'Outfit',
  accentColor: '#3B82F6',
  textColor: '#FFFFFF',
  defaultTextStyle: 'highlight-box',
  defaultSafeZone: false,
};

export function getCanvasDimensions(
  aspectRatio: AspectRatio,
  quality: 'preview' | '720p' | '1080p' = 'preview'
): { width: number; height: number } {
  const scale = quality === '1080p' ? 1 : quality === '720p' ? 2 / 3 : 0.5;
  if (aspectRatio === '9:16') {
    return { width: Math.round(1080 * scale), height: Math.round(1920 * scale) };
  }
  if (aspectRatio === '1:1') {
    return { width: Math.round(1080 * scale), height: Math.round(1080 * scale) };
  }
  return { width: Math.round(1920 * scale), height: Math.round(1080 * scale) };
}
