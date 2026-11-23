import { FilesetResolver, ImageSegmenter } from '@mediapipe/tasks-vision';

export type AiModelStatus = 'idle' | 'loading' | 'ready' | 'error';

const LOCAL_WASM_PATH = '/mediapipe/wasm';
const CDN_WASM_PATH =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite';

let segmenter: ImageSegmenter | null = null;
let segmenterPromise: Promise<ImageSegmenter> | null = null;
let aiStatus: AiModelStatus = 'idle';
let aiError: string | null = null;
let personMaskIndex = 1;
let invertSingleMask = false;

const statusListeners = new Set<() => void>();
const cutoutReadyListeners = new Set<() => void>();

export function subscribeAiModelStatus(cb: () => void): () => void {
  statusListeners.add(cb);
  return () => {
    statusListeners.delete(cb);
  };
}

export function subscribeCutoutReady(cb: () => void): () => void {
  cutoutReadyListeners.add(cb);
  return () => {
    cutoutReadyListeners.delete(cb);
  };
}

function notifyStatus() {
  statusListeners.forEach((cb) => cb());
}

function notifyCutoutReady() {
  cutoutReadyListeners.forEach((cb) => cb());
}

export function getAiModelStatus(): AiModelStatus {
  return aiStatus;
}

export function getAiModelError(): string | null {
  return aiError;
}

async function initSegmenter(): Promise<ImageSegmenter> {
  aiStatus = 'loading';
  aiError = null;
  notifyStatus();

  try {
    let vision;
    try {
      vision = await FilesetResolver.forVisionTasks(LOCAL_WASM_PATH);
    } catch {
      vision = await FilesetResolver.forVisionTasks(CDN_WASM_PATH);
    }

    let instance: ImageSegmenter;
    try {
      instance = await ImageSegmenter.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MODEL_URL,
          delegate: 'GPU',
        },
        runningMode: 'IMAGE',
        outputConfidenceMasks: true,
        outputCategoryMask: false,
      });
    } catch {
      instance = await ImageSegmenter.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MODEL_URL,
          delegate: 'CPU',
        },
        runningMode: 'IMAGE',
        outputConfidenceMasks: true,
        outputCategoryMask: false,
      });
    }

    const labels = instance.getLabels?.() || [];
    if (labels.length >= 2) {
      const idx = labels.findIndex((l) =>
        /person|selfie|foreground|body|face/i.test(l)
      );
      personMaskIndex = idx >= 0 ? idx : 1;
      invertSingleMask = false;
    } else if (labels.length === 1) {
      personMaskIndex = 0;
      invertSingleMask = /background/i.test(labels[0]);
    } else {
      personMaskIndex = 1;
      invertSingleMask = false;
    }

    segmenter = instance;
    aiStatus = 'ready';
    aiError = null;
    notifyStatus();
    notifyCutoutReady();
    return instance;
  } catch (err) {
    aiStatus = 'error';
    aiError =
      err instanceof Error
        ? err.message
        : 'Failed to load AI cutout model. Check connection or use Color Key.';
    segmenterPromise = null;
    notifyStatus();
    throw err;
  }
}

export function preloadAiSegmenter(): Promise<ImageSegmenter> {
  if (segmenter) return Promise.resolve(segmenter);
  if (!segmenterPromise) {
    segmenterPromise = initSegmenter();
  }
  return segmenterPromise;
}

export function retryAiSegmenter(): Promise<ImageSegmenter> {
  if (aiStatus === 'error') {
    segmenterPromise = null;
  }
  return preloadAiSegmenter();
}

interface ClipMaskCacheEntry {
  maskCanvas: HTMLCanvasElement;
  maskCtx: CanvasRenderingContext2D;
  scratchCanvas: HTMLCanvasElement;
  scratchCtx: CanvasRenderingContext2D;
  imageData: ImageData | null;
  lastVideoTime: number;
  lastConfigKey: string;
  inFlight: boolean;
}

const clipMaskCache = new Map<string, ClipMaskCacheEntry>();

function getOrCreateCacheEntry(clipId: string): ClipMaskCacheEntry | null {
  let entry = clipMaskCache.get(clipId);
  if (entry) return entry;

  const maskCanvas = document.createElement('canvas');
  const maskCtx = maskCanvas.getContext('2d');
  const scratchCanvas = document.createElement('canvas');
  const scratchCtx = scratchCanvas.getContext('2d', {
    willReadFrequently: true,
  });

  if (!maskCtx || !scratchCtx) return null;

  entry = {
    maskCanvas,
    maskCtx,
    scratchCanvas,
    scratchCtx,
    imageData: null,
    lastVideoTime: -999,
    lastConfigKey: '',
    inFlight: false,
  };
  clipMaskCache.set(clipId, entry);
  return entry;
}

export function clearClipMaskCache(clipId: string): void {
  clipMaskCache.delete(clipId);
}

export function getCachedAiMask(clipId: string): HTMLCanvasElement | null {
  const entry = clipMaskCache.get(clipId);
  if (!entry || entry.lastVideoTime < -900) return null;
  return entry.maskCanvas;
}

function computeScaledDims(sw: number, sh: number, maxDim = 256) {
  const safeW = Math.max(2, sw);
  const safeH = Math.max(2, sh);
  if (safeW >= safeH) {
    const w = maxDim;
    const h = Math.max(2, Math.round((maxDim * safeH) / safeW));
    return { w, h };
  }
  const h = maxDim;
  const w = Math.max(2, Math.round((maxDim * safeW) / safeH));
  return { w, h };
}

function getSourceMediaInfo(
  src: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
): { sw: number; sh: number; isReady: boolean } {
  if (src instanceof HTMLVideoElement) {
    return {
      sw: src.videoWidth,
      sh: src.videoHeight,
      isReady: src.readyState >= 2 && src.videoWidth > 0,
    };
  }
  if (src instanceof HTMLImageElement) {
    return {
      sw: src.naturalWidth,
      sh: src.naturalHeight,
      isReady: src.complete && src.naturalWidth > 0,
    };
  }
  return {
    sw: src.width,
    sh: src.height,
    isReady: src.width > 0 && src.height > 0,
  };
}

function runSegmentationSync(
  inst: ImageSegmenter,
  entry: ClipMaskCacheEntry,
  video: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  videoTime: number,
  threshold: number,
  softness: number,
  invertMask: boolean,
  configKey: string
): boolean {
  const { sw, sh, isReady } = getSourceMediaInfo(video);

  if (!sw || !sh || !isReady) {
    return false;
  }

  const { w, h } = computeScaledDims(sw, sh, 256);

  if (entry.scratchCanvas.width !== w || entry.scratchCanvas.height !== h) {
    entry.scratchCanvas.width = w;
    entry.scratchCanvas.height = h;
    entry.maskCanvas.width = w;
    entry.maskCanvas.height = h;
    entry.imageData = entry.maskCtx.createImageData(w, h);
  } else if (!entry.imageData) {
    entry.imageData = entry.maskCtx.createImageData(w, h);
  }

  entry.scratchCtx.drawImage(video, 0, 0, w, h);

  let wrote = false;
  inst.segment(entry.scratchCanvas, (result) => {
    try {
      const masks = result.confidenceMasks;
      if (!masks || masks.length === 0 || !entry.imageData) return;

      const idx =
        masks.length > 1 ? Math.min(personMaskIndex, masks.length - 1) : 0;
      const shouldInvert =
        (masks.length === 1 && invertSingleMask) !== invertMask;

      const mask = masks[idx];
      const floats = mask.getAsFloat32Array();
      const maskW = mask.width || w;
      const maskH = mask.height || h;

      if (maskW * maskH !== floats.length) return;

      if (
        entry.maskCanvas.width !== maskW ||
        entry.maskCanvas.height !== maskH
      ) {
        entry.maskCanvas.width = maskW;
        entry.maskCanvas.height = maskH;
        entry.imageData = entry.maskCtx.createImageData(maskW, maskH);
      }

      const data = entry.imageData.data;
      const softBand = Math.max(0.015, softness * 0.26);
      const low = threshold - softBand;
      const span = softBand * 2;
      const total = maskW * maskH;

      for (let i = 0; i < total; i++) {
        const raw = floats[i];
        const val = shouldInvert ? 1 - raw : raw;
        let t = (val - low) / span;
        if (t <= 0) {
          t = 0;
        } else if (t >= 1) {
          t = 1;
        } else {
          t = t * t * (3 - 2 * t);
        }
        const p = i * 4;
        data[p] = 255;
        data[p + 1] = 255;
        data[p + 2] = 255;
        data[p + 3] = Math.round(t * 255);
      }

      entry.maskCtx.putImageData(entry.imageData, 0, 0);
      entry.lastVideoTime = videoTime;
      entry.lastConfigKey = configKey;
      wrote = true;
    } finally {
      result.close();
    }
  });

  return wrote;
}

export function requestAiMaskUpdate(params: {
  clipId: string;
  video: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement;
  videoTime: number;
  threshold?: number;
  softness?: number;
  invertMask?: boolean;
}): HTMLCanvasElement | null {
  const {
    clipId,
    video,
    videoTime,
    threshold = 0.5,
    softness = 0.35,
    invertMask = false,
  } = params;

  const entry = getOrCreateCacheEntry(clipId);
  if (!entry) return null;

  const configKey = `${threshold.toFixed(2)}|${softness.toFixed(2)}|${
    invertMask ? 1 : 0
  }`;
  const { isReady } = getSourceMediaInfo(video);
  const needsUpdate =
    Math.abs(videoTime - entry.lastVideoTime) >= 0.025 ||
    entry.lastConfigKey !== configKey;

  if (!segmenter) {
    if (aiStatus === 'idle') {
      preloadAiSegmenter().catch(() => {});
    }
    return entry.lastVideoTime > -900 ? entry.maskCanvas : null;
  }

  if (needsUpdate && !entry.inFlight && isReady) {
    entry.inFlight = true;
    const inst = segmenter;
    window.setTimeout(() => {
      try {
        const updated = runSegmentationSync(
          inst,
          entry,
          video,
          videoTime,
          threshold,
          softness,
          invertMask,
          configKey
        );
        if (updated) {
          notifyCutoutReady();
        }
      } catch {
        // Ignore transient decode state errors while seeking
      } finally {
        entry.inFlight = false;
      }
    }, 0);
  }

  return entry.lastVideoTime > -900 ? entry.maskCanvas : null;
}

export async function generateAiMaskForExport(params: {
  clipId: string;
  video: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement;
  videoTime: number;
  threshold?: number;
  softness?: number;
  invertMask?: boolean;
}): Promise<HTMLCanvasElement | null> {
  const {
    clipId,
    video,
    videoTime,
    threshold = 0.5,
    softness = 0.35,
    invertMask = false,
  } = params;

  const entry = getOrCreateCacheEntry(clipId);
  if (!entry) return null;

  const configKey = `${threshold.toFixed(2)}|${softness.toFixed(2)}|${
    invertMask ? 1 : 0
  }`;

  // Temporal mask reuse: Skip expensive deep inference if video time moved under 0.05s or on static images
  if (
    entry.lastVideoTime > -900 &&
    Math.abs(videoTime - entry.lastVideoTime) < 0.05 &&
    entry.lastConfigKey === configKey
  ) {
    return entry.maskCanvas;
  }

  try {
    const inst = await preloadAiSegmenter();
    runSegmentationSync(
      inst,
      entry,
      video,
      videoTime,
      threshold,
      softness,
      invertMask,
      configKey
    );
    return entry.lastVideoTime > -900 ? entry.maskCanvas : null;
  } catch {
    return null;
  }
}

// Fast YCbCr Chroma Key Mask for solid colored walls / green screens
let chromaWorkCanvas: HTMLCanvasElement | null = null;
let chromaMaskCanvas: HTMLCanvasElement | null = null;
let chromaMaskImageData: ImageData | null = null;

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    return [
      parseInt(clean[0] + clean[0], 16) || 0,
      parseInt(clean[1] + clean[1], 16) || 255,
      parseInt(clean[2] + clean[2], 16) || 0,
    ];
  }
  if (clean.length >= 6) {
    return [
      parseInt(clean.slice(0, 2), 16) || 0,
      parseInt(clean.slice(2, 4), 16) || 255,
      parseInt(clean.slice(4, 6), 16) || 0,
    ];
  }
  return [0, 255, 0];
}

function rgbToYCbCr(r: number, g: number, b: number): [number, number, number] {
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  return [y, cb, cr];
}

export function buildChromaKeyMask(
  video: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  keyColor = '#00FF00',
  tolerance = 0.28,
  softness = 0.3
): HTMLCanvasElement | null {
  const { sw, sh, isReady } = getSourceMediaInfo(video);

  if (!sw || !sh || !isReady) {
    return null;
  }

  const { w, h } = computeScaledDims(sw, sh, 320);

  if (!chromaWorkCanvas) chromaWorkCanvas = document.createElement('canvas');
  if (!chromaMaskCanvas) chromaMaskCanvas = document.createElement('canvas');

  if (chromaWorkCanvas.width !== w || chromaWorkCanvas.height !== h) {
    chromaWorkCanvas.width = w;
    chromaWorkCanvas.height = h;
    chromaMaskCanvas.width = w;
    chromaMaskCanvas.height = h;
    chromaMaskImageData = null;
  }

  const wCtx = chromaWorkCanvas.getContext('2d', { willReadFrequently: true });
  const mCtx = chromaMaskCanvas.getContext('2d');
  if (!wCtx || !mCtx) return null;

  wCtx.drawImage(video, 0, 0, w, h);
  const srcData = wCtx.getImageData(0, 0, w, h).data;
  if (!chromaMaskImageData) {
    chromaMaskImageData = mCtx.createImageData(w, h);
  }
  const outData = chromaMaskImageData.data;

  const [kr, kg, kb] = hexToRgb(keyColor);
  const [ky, kcb, kcr] = rgbToYCbCr(kr, kg, kb);

  const tolDist = 14 + tolerance * 135;
  const softSpan = Math.max(6, softness * 45);
  const total = w * h;

  for (let i = 0; i < total; i++) {
    const p = i * 4;
    const r = srcData[p];
    const g = srcData[p + 1];
    const b = srcData[p + 2];

    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
    const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

    const chromaDist = Math.hypot(cb - kcb, cr - kcr);
    const lumaDiff = Math.abs(y - ky) * 0.22;
    const dist = chromaDist + lumaDiff;

    let alpha = 1;
    if (dist <= tolDist) {
      alpha = 0;
    } else if (dist < tolDist + softSpan) {
      const t = (dist - tolDist) / softSpan;
      alpha = t * t * (3 - 2 * t);
    }

    outData[p] = 255;
    outData[p + 1] = 255;
    outData[p + 2] = 255;
    outData[p + 3] = Math.round(alpha * 255);
  }

  mCtx.putImageData(chromaMaskImageData, 0, 0);
  return chromaMaskCanvas;
}
