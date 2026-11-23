import {
  AspectRatio,
  BuiltinSceneId,
  FeatherEdge,
  MediaAsset,
  MusicAsset,
  MusicClip,
  SeamDividerConfig,
  SelectionTarget,
  SoundEffectAsset,
  SoundEffectClip,
  TextOverlay,
  TransitionType,
  VideoClip,
} from '../types/editor';
import { getCanvasDimensions } from '../data/presets';
import { getAudioContext, getMusicBuffer, getSfxBuffer } from './soundEffects';
import {
  buildChromaKeyMask,
  generateAiMaskForExport,
  requestAiMaskUpdate,
} from './backgroundRemoval';

interface MediaCache {
  images: Map<string, HTMLImageElement>;
  videos: Map<string, HTMLVideoElement>;
}

const mediaCache: MediaCache = {
  images: new Map(),
  videos: new Map(),
};

let featherCanvas: HTMLCanvasElement | null = null;
let cutoutFgCanvas: HTMLCanvasElement | null = null;
let seamBlurCanvas: HTMLCanvasElement | null = null;
let seamGradCanvas: HTMLCanvasElement | null = null;

function getOffscreenCanvas(
  ref: HTMLCanvasElement | null,
  w: number,
  h: number
): HTMLCanvasElement {
  const canvas = ref || document.createElement('canvas');
  const cw = Math.max(2, Math.round(w));
  const ch = Math.max(2, Math.round(h));
  if (canvas.width !== cw) canvas.width = cw;
  if (canvas.height !== ch) canvas.height = ch;
  return canvas;
}

function getFeatherCanvas(w: number, h: number): HTMLCanvasElement {
  featherCanvas = getOffscreenCanvas(featherCanvas, w, h);
  return featherCanvas;
}

function getCutoutFgCanvas(w: number, h: number): HTMLCanvasElement {
  cutoutFgCanvas = getOffscreenCanvas(cutoutFgCanvas, w, h);
  return cutoutFgCanvas;
}

function addSmoothGradientStops(
  grad: CanvasGradient,
  startStop: number,
  endStop: number,
  fadeIn: boolean
) {
  const steps = 6;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const smooth = t * t * (3 - 2 * t);
    const alpha = fadeIn ? smooth : 1 - smooth;
    const pos = startStop + (endStop - startStop) * t;
    grad.addColorStop(Math.max(0, Math.min(1, pos)), `rgba(0, 0, 0, ${alpha.toFixed(3)})`);
  }
}

function applyFeatherMask(
  fctx: CanvasRenderingContext2D,
  cw: number,
  ch: number,
  featherPct: number,
  edge: FeatherEdge
) {
  const span = Math.max(0.02, Math.min(0.65, (featherPct / 100) * 1.15));
  fctx.save();
  fctx.globalCompositeOperation = 'destination-in';

  if (edge === 'top') {
    const g = fctx.createLinearGradient(0, 0, 0, ch);
    addSmoothGradientStops(g, 0, span, true);
    g.addColorStop(1, 'rgba(0,0,0,1)');
    fctx.fillStyle = g;
    fctx.fillRect(0, 0, cw, ch);
  } else if (edge === 'bottom') {
    const g = fctx.createLinearGradient(0, 0, 0, ch);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    addSmoothGradientStops(g, 1 - span, 1, false);
    fctx.fillStyle = g;
    fctx.fillRect(0, 0, cw, ch);
  } else if (edge === 'left') {
    const g = fctx.createLinearGradient(0, 0, cw, 0);
    addSmoothGradientStops(g, 0, span, true);
    g.addColorStop(1, 'rgba(0,0,0,1)');
    fctx.fillStyle = g;
    fctx.fillRect(0, 0, cw, ch);
  } else if (edge === 'right') {
    const g = fctx.createLinearGradient(0, 0, cw, 0);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    addSmoothGradientStops(g, 1 - span, 1, false);
    fctx.fillStyle = g;
    fctx.fillRect(0, 0, cw, ch);
  } else {
    const halfSpan = Math.min(0.48, span * 0.85);
    const gv = fctx.createLinearGradient(0, 0, 0, ch);
    addSmoothGradientStops(gv, 0, halfSpan, true);
    addSmoothGradientStops(gv, 1 - halfSpan, 1, false);
    fctx.fillStyle = gv;
    fctx.fillRect(0, 0, cw, ch);

    const gh = fctx.createLinearGradient(0, 0, cw, 0);
    addSmoothGradientStops(gh, 0, halfSpan, true);
    addSmoothGradientStops(gh, 1 - halfSpan, 1, false);
    fctx.fillStyle = gh;
    fctx.fillRect(0, 0, cw, ch);
  }

  fctx.restore();
}

const pendingPlayVideos = new WeakSet<HTMLVideoElement>();

const mediaReadyListeners = new Set<() => void>();

export function subscribeMediaReady(listener: () => void): () => void {
  mediaReadyListeners.add(listener);
  return () => {
    mediaReadyListeners.delete(listener);
  };
}

function notifyMediaReady() {
  mediaReadyListeners.forEach((cb) => cb());
}

export function preloadImage(url: string): HTMLImageElement | null {
  if (!url) return null;
  const existing = mediaCache.images.get(url);
  if (existing) return existing;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = notifyMediaReady;
  img.src = url;
  mediaCache.images.set(url, img);
  return img;
}

export function getOrCreateVideoElement(
  asset: MediaAsset,
  volume: number,
  speed: number
): HTMLVideoElement | null {
  if (asset.kind !== 'uploaded' || !asset.srcUrl) return null;
  let video = mediaCache.videos.get(asset.id);
  if (!video) {
    video = document.createElement('video');
    video.src = asset.srcUrl;
    video.playsInline = true;
    video.preload = 'auto';
    video.muted = volume <= 0;
    video.addEventListener('loadeddata', notifyMediaReady);
    video.addEventListener('canplay', notifyMediaReady);
    video.addEventListener('seeked', notifyMediaReady);
    mediaCache.videos.set(asset.id, video);
  }
  video.volume = Math.max(0, Math.min(1, volume));
  video.muted = volume <= 0;
  video.playbackRate = Math.max(0.25, Math.min(4, speed));
  return video;
}

export function pauseAllUploadedVideos(): void {
  mediaCache.videos.forEach((video) => {
    if (!video.paused) {
      video.pause();
    }
  });
}

// Easing helpers
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);
}

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const x = Math.max(0, Math.min(1, t));
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

function easeOutExpo(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
}

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawCoverSource(
  ctx: CanvasRenderingContext2D,
  source: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  fit: 'cover' | 'contain',
  extraZoom = 1,
  panX = 0,
  panY = 0
) {
  const sw =
    source instanceof HTMLVideoElement
      ? source.videoWidth
      : source instanceof HTMLImageElement
      ? source.naturalWidth
      : source.width;
  const sh =
    source instanceof HTMLVideoElement
      ? source.videoHeight
      : source instanceof HTMLImageElement
      ? source.naturalHeight
      : source.height;
  if (!sw || !sh) return;

  const srcRatio = sw / sh;
  const dstRatio = dw / dh;

  let drawW = dw;
  let drawH = dh;
  if (fit === 'cover') {
    if (srcRatio > dstRatio) {
      drawH = dh;
      drawW = dh * srcRatio;
    } else {
      drawW = dw;
      drawH = dw / srcRatio;
    }
  } else {
    if (srcRatio > dstRatio) {
      drawW = dw;
      drawH = dw / srcRatio;
    } else {
      drawH = dh;
      drawW = dh * srcRatio;
    }
  }

  drawW *= extraZoom;
  drawH *= extraZoom;
  const cx = dx + dw / 2 + panX;
  const cy = dy + dh / 2 + panY;
  ctx.drawImage(source, cx - drawW / 2, cy - drawH / 2, drawW, drawH);
}

function renderBuiltinAnimatedScene(
  ctx: CanvasRenderingContext2D,
  scene: BuiltinSceneId,
  img: HTMLImageElement | null,
  localTime: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  fit: 'cover' | 'contain'
) {
  if (scene === 'kinetic') {
    // Crisp high-FPS procedural kinetic tunnel grid
    const grad = ctx.createLinearGradient(dx, dy, dx, dy + dh);
    grad.addColorStop(0, '#090D16');
    grad.addColorStop(0.5, '#111827');
    grad.addColorStop(1, '#07090E');
    ctx.fillStyle = grad;
    ctx.fillRect(dx, dy, dw, dh);

    const cx = dx + dw / 2;
    const cy = dy + dh / 2;
    const rings = 10;
    for (let i = 0; i < rings; i++) {
      const progress = ((localTime * 0.45 + i / rings) % 1);
      const scale = Math.pow(progress, 1.7);
      const rw = dw * 1.45 * scale;
      const rh = dh * 1.45 * scale;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(progress * 0.35 + localTime * 0.15);
      ctx.strokeStyle =
        i % 2 === 0
          ? `rgba(59, 130, 246, ${(1 - progress) * 0.65})`
          : `rgba(243, 244, 246, ${(1 - progress) * 0.22})`;
      ctx.lineWidth = Math.max(1, dw * 0.004 * (0.4 + progress));
      ctx.strokeRect(-rw / 2, -rh / 2, rw, rh);
      ctx.restore();
    }

    // Center horizon beam
    const pulse = 0.5 + 0.5 * Math.sin(localTime * 3.2);
    const glow = ctx.createRadialGradient(cx, cy, 4, cx, cy, dw * 0.42);
    glow.addColorStop(0, `rgba(59, 130, 246, ${0.22 + pulse * 0.14})`);
    glow.addColorStop(1, 'rgba(59, 130, 246, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(dx, dy, dw, dh);
    return;
  }

  if (!img || !img.complete || img.naturalWidth === 0) {
    ctx.fillStyle = '#12151C';
    ctx.fillRect(dx, dy, dw, dh);
    return;
  }

  if (scene === 'podcast') {
    const zoom = 1.04 + 0.04 * Math.sin(localTime * 0.6);
    const panX = Math.sin(localTime * 0.45) * dw * 0.012;
    drawCoverSource(ctx, img, dx, dy, dw, dh, fit, zoom, panX, 0);

    // Subtle broadcast audio VU meter bars on bottom edge of studio cam
    const barCount = 18;
    const barW = Math.max(2, dw * 0.012);
    const gap = barW * 0.6;
    const totalW = barCount * (barW + gap);
    const startX = dx + dw * 0.06;
    const baseY = dy + dh - dh * 0.06;
    ctx.save();
    for (let i = 0; i < barCount; i++) {
      const h =
        (0.25 +
          0.75 *
            Math.abs(Math.sin(localTime * 8.5 + i * 0.7) * Math.cos(localTime * 3.1 + i))) *
        (dh * 0.055);
      ctx.fillStyle = i > 13 ? 'rgba(250, 204, 21, 0.85)' : 'rgba(243, 244, 246, 0.72)';
      ctx.fillRect(startX + i * (barW + gap), baseY - h, barW, h);
    }
    ctx.restore();
    void totalW;
  } else if (scene === 'parkour') {
    // High-energy FPV kinetic breathing + zoom pulse
    const zoom = 1.06 + 0.05 * Math.sin(localTime * 2.1);
    const shakeX = Math.sin(localTime * 9.5) * dw * 0.008;
    const shakeY = Math.cos(localTime * 7.2) * dh * 0.008;
    drawCoverSource(ctx, img, dx, dy, dw, dh, fit, zoom, shakeX, shakeY);
  } else if (scene === 'tokyo') {
    const zoom = 1.02 + (localTime % 12) * 0.008;
    const panY = Math.sin(localTime * 0.4) * dh * 0.015;
    drawCoverSource(ctx, img, dx, dy, dw, dh, fit, zoom, 0, panY);

    // Subtle rain streaks over wet alley
    ctx.save();
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.16)';
    ctx.lineWidth = Math.max(1, dw * 0.0018);
    for (let i = 0; i < 24; i++) {
      const rx = dx + ((i * 97 + localTime * 120) % dw);
      const ry = dy + ((i * 173 + localTime * 780) % dh);
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - dw * 0.01, ry + dh * 0.035);
      ctx.stroke();
    }
    ctx.restore();
  }
}

interface TransitionState {
  alpha: number;
  offsetX: number;
  offsetY: number;
  zoom: number;
  flashAlpha: number;
  wipeProgress: number; // 1 = fully visible
}

function computeClipTransition(
  clip: VideoClip,
  timeInClip: number,
  dw: number,
  dh: number
): TransitionState {
  const state: TransitionState = {
    alpha: clip.opacity,
    offsetX: 0,
    offsetY: 0,
    zoom: 1,
    flashAlpha: 0,
    wipeProgress: 1,
  };

  const applyTransition = (
    type: TransitionType,
    p: number,
    isExit: boolean
  ) => {
    if (type === 'none') return;
    const e = isExit ? 1 - easeOutCubic(1 - p) : easeOutCubic(p);
    switch (type) {
      case 'fade':
        state.alpha *= e;
        break;
      case 'slide-left':
        state.offsetX += isExit ? -(1 - e) * dw : (1 - e) * dw;
        break;
      case 'slide-up':
        state.offsetY += isExit ? -(1 - e) * dh : (1 - e) * dh;
        break;
      case 'zoom-punch': {
        const exp = easeOutExpo(p);
        state.zoom *= isExit ? 1 + (1 - exp) * 0.35 : 1 + (1 - exp) * 0.38;
        state.alpha *= Math.min(1, p * 2.5);
        break;
      }
      case 'flash':
        state.flashAlpha = Math.max(state.flashAlpha, (1 - p) * 0.85);
        break;
      case 'wipe-split':
        state.wipeProgress = Math.min(state.wipeProgress, easeOutCubic(p));
        break;
    }
  };

  if (clip.transitionIn !== 'none' && clip.transitionInDuration > 0) {
    const p = timeInClip / clip.transitionInDuration;
    if (p < 1) {
      applyTransition(clip.transitionIn, Math.max(0, p), false);
    }
  }

  const timeRemaining = clip.duration - timeInClip;
  if (clip.transitionOut !== 'none' && clip.transitionOutDuration > 0) {
    const p = timeRemaining / clip.transitionOutDuration;
    if (p < 1) {
      applyTransition(clip.transitionOut, Math.max(0, p), true);
    }
  }

  return state;
}

function renderVideoClipLayer(
  ctx: CanvasRenderingContext2D,
  clip: VideoClip,
  asset: MediaAsset,
  timelineTime: number,
  canvasW: number,
  canvasH: number,
  isPlaying: boolean,
  isExporting: boolean
) {
  const timeInClip = timelineTime - clip.startTime;
  if (timeInClip < 0 || timeInClip > clip.duration) return;

  const fullDw = (clip.widthPct / 100) * canvasW * clip.scale;
  const fullDh = (clip.heightPct / 100) * canvasH * clip.scale;
  const fullDx = (clip.x / 100) * canvasW - fullDw / 2;
  const fullDy = (clip.y / 100) * canvasH - fullDh / 2;

  const cropL = Math.max(0, Math.min(85, clip.cropLeft ?? 0));
  const cropR = Math.max(0, Math.min(85 - cropL, clip.cropRight ?? 0));
  const cropT = Math.max(0, Math.min(85, clip.cropTop ?? 0));
  const cropB = Math.max(0, Math.min(85 - cropT, clip.cropBottom ?? 0));

  const visOffsetX = (cropL / 100) * fullDw;
  const visOffsetY = (cropT / 100) * fullDh;
  const visW = Math.max(4, fullDw * (1 - (cropL + cropR) / 100));
  const visH = Math.max(4, fullDh * (1 - (cropT + cropB) / 100));

  const tr = computeClipTransition(clip, timeInClip, visW, visH);
  const localVideoTime = (clip.sourceOffset + timeInClip * clip.speed) % Math.max(0.5, asset.duration);

  const renderX = fullDx + visOffsetX + tr.offsetX;
  const renderY = fullDy + visOffsetY + tr.offsetY;
  const mediaRenderX = fullDx + tr.offsetX;
  const mediaRenderY = fullDy + tr.offsetY;

  const effectiveRadius =
    clip.borderRadius >= 900
      ? Math.min(visW, visH) / 2
      : (clip.borderRadius / 1080) * canvasW;

  const drawClipContent = (
    targetCtx: CanvasRenderingContext2D,
    ox: number,
    oy: number,
    w: number,
    h: number,
    mx: number,
    my: number,
    mw: number,
    mh: number
  ) => {
    targetCtx.save();

    drawRoundedRectPath(targetCtx, ox, oy, w, h, effectiveRadius);
    targetCtx.clip();

    // Center-outward wipe-split mask
    if (tr.wipeProgress < 1) {
      const wipeW = w * tr.wipeProgress;
      targetCtx.beginPath();
      targetCtx.rect(ox + (w - wipeW) / 2, oy, wipeW, h);
      targetCtx.clip();
    }

    // Apply transition zoom around center of clip region
    if (tr.zoom !== 1) {
      targetCtx.translate(ox + w / 2, oy + h / 2);
      targetCtx.scale(tr.zoom, tr.zoom);
      targetCtx.translate(-(ox + w / 2), -(oy + h / 2));
    }

    // Optional blurred backdrop for contain mode
    if (clip.blurBackdrop && clip.fit === 'contain') {
      targetCtx.save();
      targetCtx.filter = 'blur(22px) brightness(0.65)';
      if (asset.kind === 'builtin' && asset.builtinScene) {
        const img = preloadImage(asset.srcUrl);
        renderBuiltinAnimatedScene(
          targetCtx,
          asset.builtinScene,
          img,
          localVideoTime,
          mx,
          my,
          mw,
          mh,
          'cover'
        );
      } else if (asset.kind === 'uploaded' && asset.mediaType === 'image') {
        const img = preloadImage(asset.srcUrl);
        if (img && img.complete && img.naturalWidth > 0) {
          drawCoverSource(targetCtx, img, mx, my, mw, mh, 'cover');
        }
      } else {
        const video = getOrCreateVideoElement(asset, 0, clip.speed);
        if (video && video.readyState >= 2) {
          drawCoverSource(targetCtx, video, mx, my, mw, mh, 'cover');
        }
      }
      targetCtx.restore();
    }

    if (asset.kind === 'builtin' && asset.builtinScene) {
      const img = preloadImage(asset.srcUrl);
      renderBuiltinAnimatedScene(
        targetCtx,
        asset.builtinScene,
        img,
        localVideoTime,
        mx,
        my,
        mw,
        mh,
        clip.fit
      );
    } else if (asset.kind === 'uploaded' && asset.mediaType === 'image') {
      const img = preloadImage(asset.srcUrl);
      if (img && img.complete && img.naturalWidth > 0) {
        const removalMode = clip.bgRemovalMode ?? 'none';
        if (removalMode !== 'none') {
          const replaceMode = clip.bgReplaceMode ?? 'transparent';

          if (replaceMode === 'blur') {
            targetCtx.save();
            targetCtx.filter = 'blur(22px) brightness(0.88)';
            drawCoverSource(targetCtx, img, mx, my, mw, mh, 'cover');
            targetCtx.restore();
          } else if (replaceMode === 'solid') {
            targetCtx.fillStyle = clip.bgColor || '#18181B';
            targetCtx.fillRect(ox, oy, w, h);
          } else if (replaceMode === 'gradient') {
            const bgGrad = targetCtx.createLinearGradient(
              ox,
              oy,
              ox + w,
              oy + h
            );
            bgGrad.addColorStop(0, clip.bgColor || '#0F172A');
            bgGrad.addColorStop(1, clip.bgSecondaryColor || '#4C1D95');
            targetCtx.fillStyle = bgGrad;
            targetCtx.fillRect(ox, oy, w, h);
          } else if (replaceMode === 'image') {
            const bgImg = clip.bgImageUrl
              ? preloadImage(clip.bgImageUrl)
              : null;
            if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
              drawCoverSource(targetCtx, bgImg, ox, oy, w, h, 'cover');
            } else {
              targetCtx.fillStyle = '#111827';
              targetCtx.fillRect(ox, oy, w, h);
            }
          }

          const maskCanvas =
            removalMode === 'ai'
              ? requestAiMaskUpdate({
                  clipId: clip.id,
                  video: img,
                  videoTime: 0,
                  threshold: clip.bgThreshold ?? 0.5,
                  softness: clip.bgEdgeSoftness ?? 0.35,
                  invertMask: clip.bgInvertMask ?? false,
                })
              : buildChromaKeyMask(
                  img,
                  clip.chromaColor ?? '#00FF00',
                  clip.chromaTolerance ?? 0.28,
                  clip.bgEdgeSoftness ?? 0.3
                );

          if (maskCanvas) {
            const fgCanvas = getCutoutFgCanvas(mw, mh);
            const fgCtx = fgCanvas.getContext('2d');
            if (fgCtx) {
              fgCtx.save();
              fgCtx.globalCompositeOperation = 'source-over';
              fgCtx.filter = 'none';
              fgCtx.clearRect(0, 0, fgCanvas.width, fgCanvas.height);
              drawCoverSource(
                fgCtx,
                img,
                0,
                0,
                fgCanvas.width,
                fgCanvas.height,
                clip.fit
              );
              fgCtx.globalCompositeOperation = 'destination-in';
              const softPx = Math.max(
                0,
                (clip.bgEdgeSoftness ?? 0.35) * 2.4
              );
              if (softPx > 0.2) {
                fgCtx.filter = `blur(${softPx.toFixed(1)}px)`;
              }
              drawCoverSource(
                fgCtx,
                maskCanvas,
                0,
                0,
                fgCanvas.width,
                fgCanvas.height,
                clip.fit
              );
              fgCtx.restore();

              targetCtx.drawImage(fgCanvas, mx, my, mw, mh);
            }
          } else {
            drawCoverSource(targetCtx, img, mx, my, mw, mh, clip.fit);
          }
        } else {
          drawCoverSource(targetCtx, img, mx, my, mw, mh, clip.fit);
        }
      }
    } else if (asset.kind === 'uploaded') {
      const video = getOrCreateVideoElement(asset, clip.volume, clip.speed);
      if (video) {
        const realDuration =
          Number.isFinite(video.duration) && video.duration > 0
            ? video.duration
            : asset.duration;
        const rawOffset = clip.sourceOffset + timeInClip * clip.speed;
        const targetTime = Math.min(
          Math.max(0, rawOffset),
          Math.max(0.05, realDuration - 0.04)
        );

        if (isExporting || !isPlaying) {
          if (Math.abs(video.currentTime - targetTime) > 0.05 && !video.seeking) {
            video.currentTime = targetTime;
          }
          if (!video.paused) video.pause();
        } else {
          if (Math.abs(video.currentTime - targetTime) > 0.45 && !video.seeking) {
            video.currentTime = targetTime;
          }
          if (
            video.paused &&
            !video.seeking &&
            !pendingPlayVideos.has(video) &&
            targetTime < realDuration - 0.08
          ) {
            pendingPlayVideos.add(video);
            video
              .play()
              .catch(() => {
                video.muted = true;
                return video.play().catch(() => {});
              })
              .finally(() => {
                pendingPlayVideos.delete(video);
              });
          }
        }

        if (video.readyState >= 2) {
          const removalMode = clip.bgRemovalMode ?? 'none';
          if (removalMode !== 'none') {
            const replaceMode = clip.bgReplaceMode ?? 'transparent';

            if (replaceMode === 'blur') {
              targetCtx.save();
              targetCtx.filter = 'blur(22px) brightness(0.88)';
              drawCoverSource(targetCtx, video, mx, my, mw, mh, 'cover');
              targetCtx.restore();
            } else if (replaceMode === 'solid') {
              targetCtx.fillStyle = clip.bgColor || '#18181B';
              targetCtx.fillRect(ox, oy, w, h);
            } else if (replaceMode === 'gradient') {
              const bgGrad = targetCtx.createLinearGradient(
                ox,
                oy,
                ox + w,
                oy + h
              );
              bgGrad.addColorStop(0, clip.bgColor || '#0F172A');
              bgGrad.addColorStop(1, clip.bgSecondaryColor || '#4C1D95');
              targetCtx.fillStyle = bgGrad;
              targetCtx.fillRect(ox, oy, w, h);
            } else if (replaceMode === 'image') {
              const bgImg = clip.bgImageUrl
                ? preloadImage(clip.bgImageUrl)
                : null;
              if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
                drawCoverSource(targetCtx, bgImg, ox, oy, w, h, 'cover');
              } else {
                targetCtx.fillStyle = '#111827';
                targetCtx.fillRect(ox, oy, w, h);
              }
            }

            const maskCanvas =
              removalMode === 'ai'
                ? requestAiMaskUpdate({
                    clipId: clip.id,
                    video,
                    videoTime: video.currentTime,
                    threshold: clip.bgThreshold ?? 0.5,
                    softness: clip.bgEdgeSoftness ?? 0.35,
                    invertMask: clip.bgInvertMask ?? false,
                  })
                : buildChromaKeyMask(
                    video,
                    clip.chromaColor ?? '#00FF00',
                    clip.chromaTolerance ?? 0.28,
                    clip.bgEdgeSoftness ?? 0.3
                  );

            if (maskCanvas) {
              const fgCanvas = getCutoutFgCanvas(mw, mh);
              const fgCtx = fgCanvas.getContext('2d');
              if (fgCtx) {
                fgCtx.save();
                fgCtx.globalCompositeOperation = 'source-over';
                fgCtx.filter = 'none';
                fgCtx.clearRect(0, 0, fgCanvas.width, fgCanvas.height);
                drawCoverSource(
                  fgCtx,
                  video,
                  0,
                  0,
                  fgCanvas.width,
                  fgCanvas.height,
                  clip.fit
                );
                fgCtx.globalCompositeOperation = 'destination-in';
                const softPx = Math.max(
                  0,
                  (clip.bgEdgeSoftness ?? 0.35) * 2.4
                );
                if (softPx > 0.2) {
                  fgCtx.filter = `blur(${softPx.toFixed(1)}px)`;
                }
                drawCoverSource(
                  fgCtx,
                  maskCanvas,
                  0,
                  0,
                  fgCanvas.width,
                  fgCanvas.height,
                  clip.fit
                );
                fgCtx.restore();

                targetCtx.drawImage(fgCanvas, mx, my, mw, mh);
              }
            } else {
              drawCoverSource(targetCtx, video, mx, my, mw, mh, clip.fit);
            }
          } else {
            drawCoverSource(targetCtx, video, mx, my, mw, mh, clip.fit);
          }
        } else {
          targetCtx.fillStyle = '#12151C';
          targetCtx.fillRect(ox, oy, w, h);
        }
      }
    }

    // Flash transition overlay
    if (tr.flashAlpha > 0.01) {
      targetCtx.fillStyle = `rgba(255, 255, 255, ${tr.flashAlpha})`;
      targetCtx.fillRect(ox, oy, w, h);
    }

    targetCtx.restore();
  };

  const featherAmt = clip.feather ?? 0;
  if (featherAmt > 0) {
    const fCanvas = getFeatherCanvas(visW, visH);
    const fCtx = fCanvas.getContext('2d');
    if (fCtx) {
      fCtx.clearRect(0, 0, fCanvas.width, fCanvas.height);
      drawClipContent(
        fCtx,
        0,
        0,
        fCanvas.width,
        fCanvas.height,
        -visOffsetX,
        -visOffsetY,
        fullDw,
        fullDh
      );
      applyFeatherMask(
        fCtx,
        fCanvas.width,
        fCanvas.height,
        featherAmt,
        clip.featherEdge || 'all'
      );
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, tr.alpha));
      ctx.drawImage(fCanvas, renderX, renderY, visW, visH);
      ctx.restore();
    }
  } else {
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, tr.alpha));
    drawClipContent(
      ctx,
      renderX,
      renderY,
      visW,
      visH,
      mediaRenderX,
      mediaRenderY,
      fullDw,
      fullDh
    );
    ctx.restore();
  }

  // Border stroke for PiP / stacked overlays
  if (clip.borderWidth > 0) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, tr.alpha));
    drawRoundedRectPath(ctx, renderX, renderY, visW, visH, effectiveRadius);
    ctx.strokeStyle = clip.borderColor;
    ctx.lineWidth = (clip.borderWidth / 1080) * canvasW;
    ctx.stroke();
    ctx.restore();
  }
}

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let current = words[0];
  for (let i = 1; i < words.length; i++) {
    const test = `${current} ${words[i]}`;
    if (ctx.measureText(test).width <= maxWidth) {
      current = test;
    } else {
      lines.push(current);
      current = words[i];
    }
  }
  lines.push(current);
  return lines;
}

function renderTextOverlayLayer(
  ctx: CanvasRenderingContext2D,
  overlay: TextOverlay,
  timelineTime: number,
  canvasW: number,
  canvasH: number
) {
  const localT = timelineTime - overlay.startTime;
  if (localT < 0 || localT > overlay.duration) return;

  const rawText = overlay.uppercase ? overlay.text.toUpperCase() : overlay.text;
  let displayText = rawText;

  // Entrance animation transform
  let scale = 1;
  let alpha = 1;
  let offsetY = 0;

  const animDur = Math.max(0.08, overlay.animationDuration);
  const p = Math.min(1, localT / animDur);

  if (overlay.animation === 'pop') {
    scale = 0.65 + 0.35 * easeOutBack(p);
    alpha = Math.min(1, p * 3);
  } else if (overlay.animation === 'slide-up') {
    const e = easeOutCubic(p);
    offsetY = (1 - e) * (canvasH * 0.035);
    alpha = e;
  } else if (overlay.animation === 'fade') {
    alpha = easeOutCubic(p);
  } else if (overlay.animation === 'typewriter') {
    const charCount = Math.max(1, Math.floor(rawText.length * p));
    displayText = rawText.slice(0, charCount);
  }

  // Smooth fade-out last 0.15s
  const remaining = overlay.duration - localT;
  if (remaining < 0.15) {
    alpha *= Math.max(0, remaining / 0.15);
  }

  const fontPx = Math.round((overlay.fontSize / 1080) * canvasW);
  const weight = overlay.stylePreset === 'minimal-clean' ? '600' : '800';
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `${weight} ${fontPx}px "${overlay.fontFamily}", sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  const cx = (overlay.x / 100) * canvasW;
  const cy = (overlay.y / 100) * canvasH + offsetY;

  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  const lines = wrapTextLines(ctx, displayText, canvasW * 0.84);
  const lineHeight = fontPx * 1.24;
  const totalHeight = lines.length * lineHeight;
  const startY = -totalHeight / 2 + lineHeight / 2;

  if (overlay.stylePreset === 'caption-karaoke') {
    // Active word highlight mode synced to overlay progress
    const allWords = displayText.split(/\s+/).filter(Boolean);
    const activeWordIndex = Math.min(
      allWords.length - 1,
      Math.floor((localT / Math.max(0.2, overlay.duration)) * allWords.length)
    );
    let globalWordIdx = 0;

    lines.forEach((line, lineIdx) => {
      const y = startY + lineIdx * lineHeight;
      const lineWords = line.split(/\s+/).filter(Boolean);
      const metrics = lineWords.map((w) => ctx.measureText(w + ' ').width);
      const totalLineW =
        metrics.reduce((acc, w) => acc + w, 0) - ctx.measureText(' ').width;

      if (overlay.hasBg) {
        const padX = fontPx * 0.35;
        const padY = fontPx * 0.18;
        ctx.fillStyle = overlay.bgColor;
        drawRoundedRectPath(
          ctx,
          -totalLineW / 2 - padX,
          y - fontPx * 0.5 - padY,
          totalLineW + padX * 2,
          fontPx + padY * 2,
          fontPx * 0.24
        );
        ctx.fill();
      }

      let cursorX = -totalLineW / 2;
      ctx.textAlign = 'left';
      lineWords.forEach((word, wIdx) => {
        const isActive = globalWordIdx === activeWordIndex;
        const wordW = ctx.measureText(word).width;
        if (isActive) {
          ctx.fillStyle = overlay.accentColor;
          drawRoundedRectPath(
            ctx,
            cursorX - fontPx * 0.12,
            y - fontPx * 0.52,
            wordW + fontPx * 0.24,
            fontPx * 1.04,
            fontPx * 0.18
          );
          ctx.fill();
        }
        ctx.fillStyle = overlay.color;
        ctx.fillText(word, cursorX, y);
        cursorX += metrics[wIdx];
        globalWordIdx++;
      });
      ctx.textAlign = 'center';
    });
  } else {
    lines.forEach((line, idx) => {
      const y = startY + idx * lineHeight;
      const textW = ctx.measureText(line).width;

      if (overlay.hasBg) {
        const padX = fontPx * 0.36;
        const padY = fontPx * 0.2;
        ctx.fillStyle = overlay.bgColor;
        drawRoundedRectPath(
          ctx,
          -textW / 2 - padX,
          y - fontPx * 0.52 - padY,
          textW + padX * 2,
          fontPx + padY * 2,
          fontPx * 0.22
        );
        ctx.fill();
      } else {
        // Crisp broadcast stroke + shadow for Viral Bold
        ctx.lineJoin = 'round';
        ctx.lineWidth = Math.max(3, fontPx * 0.14);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.strokeText(line, 0, y);
      }

      ctx.fillStyle = overlay.color;
      ctx.fillText(line, 0, y);
    });
  }

  ctx.restore();
}

function drawSafeZoneOverlay(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  aspectRatio: AspectRatio
) {
  if (aspectRatio !== '9:16') return;
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.setLineDash([6, 6]);
  ctx.lineWidth = 1;

  // Top & Bottom TikTok/Reels safe zone guide
  const topSafe = canvasH * 0.12;
  const bottomSafe = canvasH * 0.8;
  const rightMargin = canvasW * 0.84;

  ctx.beginPath();
  ctx.moveTo(0, topSafe);
  ctx.lineTo(canvasW, topSafe);
  ctx.moveTo(0, bottomSafe);
  ctx.lineTo(canvasW, bottomSafe);
  ctx.moveTo(rightMargin, topSafe);
  ctx.lineTo(rightMargin, bottomSafe);
  ctx.stroke();

  // Subtle right action bar placeholders
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  const iconX = canvasW * 0.91;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(iconX, canvasH * (0.56 + i * 0.068), canvasW * 0.032, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function renderSeamDividerBand(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  seam: SeamDividerConfig
) {
  if (!seam.enabled) return;

  const bandH = Math.max(16, Math.round((seam.thickness / 100) * canvasH));
  const centerY = (seam.positionY / 100) * canvasH;
  const topY = centerY - bandH / 2;

  const applyVerticalSmoothMask = (
    targetCtx: CanvasRenderingContext2D,
    w: number,
    h: number,
    peakAlpha: number
  ) => {
    targetCtx.save();
    targetCtx.filter = 'none';
    targetCtx.globalCompositeOperation = 'destination-in';
    const g = targetCtx.createLinearGradient(0, 0, 0, h);
    const steps = 6;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const s = t * t * (3 - 2 * t);
      g.addColorStop(t * 0.42, `rgba(0,0,0,${(s * peakAlpha).toFixed(3)})`);
    }
    g.addColorStop(0.5, `rgba(0,0,0,${peakAlpha.toFixed(3)})`);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const s = 1 - t * t * (3 - 2 * t);
      g.addColorStop(0.58 + t * 0.42, `rgba(0,0,0,${(s * peakAlpha).toFixed(3)})`);
    }
    targetCtx.fillStyle = g;
    targetCtx.fillRect(0, 0, w, h);
    targetCtx.restore();
  };

  // 1. Feathered Frosted Blur directly across the dividing line
  if (seam.blurAmount > 0 && ctx.canvas) {
    seamBlurCanvas = getOffscreenCanvas(seamBlurCanvas, canvasW, bandH);
    const bCtx = seamBlurCanvas.getContext('2d');
    if (bCtx) {
      const blurPx = Math.max(1, (seam.blurAmount / 540) * canvasW);
      bCtx.save();
      bCtx.clearRect(0, 0, canvasW, bandH);
      bCtx.filter = `blur(${blurPx.toFixed(1)}px)`;
      bCtx.drawImage(ctx.canvas, 0, -topY);
      bCtx.restore();

      applyVerticalSmoothMask(bCtx, canvasW, bandH, 1);
      ctx.drawImage(seamBlurCanvas, 0, topY);
    }
  }

  // 2. Smooth Multi-Color Gradation across the dividing line
  if (seam.opacity > 0.01) {
    seamGradCanvas = getOffscreenCanvas(seamGradCanvas, canvasW, bandH);
    const gCtx = seamGradCanvas.getContext('2d');
    if (gCtx) {
      gCtx.save();
      gCtx.clearRect(0, 0, canvasW, bandH);
      const grad = gCtx.createLinearGradient(0, 0, canvasW, 0);
      grad.addColorStop(0, seam.color || '#09090B');
      grad.addColorStop(1, seam.secondaryColor || seam.color || '#09090B');
      gCtx.fillStyle = grad;
      gCtx.fillRect(0, 0, canvasW, bandH);
      gCtx.restore();

      applyVerticalSmoothMask(
        gCtx,
        canvasW,
        bandH,
        Math.max(0, Math.min(1, seam.opacity))
      );
      ctx.drawImage(seamGradCanvas, 0, topY);
    }
  }
}

export function renderFrame(params: {
  ctx: CanvasRenderingContext2D;
  canvasW: number;
  canvasH: number;
  aspectRatio: AspectRatio;
  timelineTime: number;
  baseClips: VideoClip[];
  overlayClips: VideoClip[];
  textOverlays: TextOverlay[];
  assetsById: Map<string, MediaAsset>;
  isPlaying: boolean;
  isExporting?: boolean;
  showSafeZone?: boolean;
  selection?: SelectionTarget;
  seamDivider?: SeamDividerConfig;
}) {
  const {
    ctx,
    canvasW,
    canvasH,
    aspectRatio,
    timelineTime,
    baseClips,
    overlayClips,
    textOverlays,
    assetsById,
    isPlaying,
    isExporting = false,
    showSafeZone = false,
    selection = null,
    seamDivider,
  } = params;

  // Clear stage
  ctx.fillStyle = '#07090D';
  ctx.fillRect(0, 0, canvasW, canvasH);

  // 1. Render Base Track (V1)
  for (const clip of baseClips) {
    const asset = assetsById.get(clip.assetId);
    if (!asset) continue;
    renderVideoClipLayer(
      ctx,
      clip,
      asset,
      timelineTime,
      canvasW,
      canvasH,
      isPlaying,
      isExporting
    );
  }

  // 2. Render Stacked Overlay Track (V2)
  for (const clip of overlayClips) {
    const asset = assetsById.get(clip.assetId);
    if (!asset) continue;
    renderVideoClipLayer(
      ctx,
      clip,
      asset,
      timelineTime,
      canvasW,
      canvasH,
      isPlaying,
      isExporting
    );
  }

  // Pause any uploaded videos that are not active at timelineTime
  const activeAssetIds = new Set<string>();
  for (const clip of [...baseClips, ...overlayClips]) {
    if (
      timelineTime >= clip.startTime &&
      timelineTime <= clip.startTime + clip.duration
    ) {
      activeAssetIds.add(clip.assetId);
    }
  }
  assetsById.forEach((asset) => {
    if (asset.kind === 'uploaded' && !activeAssetIds.has(asset.id)) {
      const vid = mediaCache.videos.get(asset.id);
      if (vid && !vid.paused) vid.pause();
    }
  });

  // 2.5 Render Blur + Color Gradation Seam Divider on dividing line
  if (seamDivider?.enabled) {
    renderSeamDividerBand(ctx, canvasW, canvasH, seamDivider);
  }

  // 3. Render Text & Kinetic Captions (T1)
  for (const overlay of textOverlays) {
    renderTextOverlayLayer(ctx, overlay, timelineTime, canvasW, canvasH);
  }

  // 4. Optional Safe Zone Guides (Preview only)
  if (!isExporting && showSafeZone) {
    drawSafeZoneOverlay(ctx, canvasW, canvasH, aspectRatio);
  }

  // 5. Selection Bounding Box & Interactive Resize Handles (Preview only)
  if (!isExporting && selection) {
    ctx.save();

    const drawHandleBox = (
      bx: number,
      by: number,
      bw: number,
      bh: number,
      withEdges: boolean
    ) => {
      const x1 = Math.max(2, bx);
      const y1 = Math.max(2, by);
      const x2 = Math.min(canvasW - 2, bx + bw);
      const y2 = Math.min(canvasH - 2, by + bh);
      const w = Math.max(8, x2 - x1);
      const h = Math.max(8, y2 - y1);

      ctx.strokeStyle = '#F97316';
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.strokeRect(x1, y1, w, h);

      // 4 Corner handles
      const cSize = Math.max(8, Math.round(canvasW * 0.018));
      const corners = [
        [x1, y1],
        [x1 + w, y1],
        [x1, y1 + h],
        [x1 + w, y1 + h],
      ];
      for (const [cx, cy] of corners) {
        const hx = Math.max(1, Math.min(canvasW - cSize - 1, cx - cSize / 2));
        const hy = Math.max(1, Math.min(canvasH - cSize - 1, cy - cSize / 2));
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(hx, hy, cSize, cSize);
        ctx.strokeStyle = '#F97316';
        ctx.lineWidth = 2;
        ctx.strokeRect(hx, hy, cSize, cSize);
      }

      // 4 Edge bars (top/bottom for vertical resize, left/right for horizontal resize)
      if (withEdges) {
        const barLong = Math.max(20, Math.round(canvasW * 0.065));
        const barThick = Math.max(5, Math.round(canvasW * 0.011));

        const edges = [
          // Top edge
          {
            x: x1 + w / 2 - barLong / 2,
            y: Math.max(2, y1 - barThick / 2),
            ew: barLong,
            eh: barThick,
          },
          // Bottom edge
          {
            x: x1 + w / 2 - barLong / 2,
            y: Math.min(canvasH - barThick - 2, y1 + h - barThick / 2),
            ew: barLong,
            eh: barThick,
          },
          // Left edge
          {
            x: Math.max(2, x1 - barThick / 2),
            y: y1 + h / 2 - barLong / 2,
            ew: barThick,
            eh: barLong,
          },
          // Right edge
          {
            x: Math.min(canvasW - barThick - 2, x1 + w - barThick / 2),
            y: y1 + h / 2 - barLong / 2,
            ew: barThick,
            eh: barLong,
          },
        ];

        for (const edge of edges) {
          ctx.fillStyle = '#FFFFFF';
          drawRoundedRectPath(ctx, edge.x, edge.y, edge.ew, edge.eh, 4);
          ctx.fill();
          ctx.strokeStyle = '#F97316';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
    };

    if (selection.kind === 'clip') {
      const clip =
        overlayClips.find((c) => c.id === selection.id) ||
        baseClips.find((c) => c.id === selection.id);
      if (
        clip &&
        timelineTime >= clip.startTime &&
        timelineTime <= clip.startTime + clip.duration
      ) {
        const fullDw = (clip.widthPct / 100) * canvasW * clip.scale;
        const fullDh = (clip.heightPct / 100) * canvasH * clip.scale;
        const fullDx = (clip.x / 100) * canvasW - fullDw / 2;
        const fullDy = (clip.y / 100) * canvasH - fullDh / 2;
        const cropL = Math.max(0, Math.min(85, clip.cropLeft ?? 0));
        const cropR = Math.max(0, Math.min(85 - cropL, clip.cropRight ?? 0));
        const cropT = Math.max(0, Math.min(85, clip.cropTop ?? 0));
        const cropB = Math.max(0, Math.min(85 - cropT, clip.cropBottom ?? 0));
        const visX = fullDx + (cropL / 100) * fullDw;
        const visY = fullDy + (cropT / 100) * fullDh;
        const visW = Math.max(4, fullDw * (1 - (cropL + cropR) / 100));
        const visH = Math.max(4, fullDh * (1 - (cropT + cropB) / 100));
        drawHandleBox(visX, visY, visW, visH, true);
      }
    } else if (selection.kind === 'text') {
      const txt = textOverlays.find((t) => t.id === selection.id);
      if (
        txt &&
        timelineTime >= txt.startTime &&
        timelineTime <= txt.startTime + txt.duration
      ) {
        const cx = (txt.x / 100) * canvasW;
        const cy = (txt.y / 100) * canvasH;
        const boxW = canvasW * 0.72;
        const boxH = (txt.fontSize / 1080) * canvasW * 2.1;
        drawHandleBox(cx - boxW / 2, cy - boxH / 2, boxW, boxH, false);
      }
    }
    ctx.restore();
  }
}

export async function exportTimelineToVideo(params: {
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
  const {
    aspectRatio,
    duration,
    resolution,
    fps,
    baseClips,
    overlayClips,
    textOverlays,
    soundEffects,
    musicClips,
    assetsById,
    sfxById,
    musicById,
    seamDivider,
    onProgress,
  } = params;

  const { width, height } = getCanvasDimensions(aspectRatio, resolution);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Unable to acquire 2D rendering context');

  const preferredMimes = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  const mimeType =
    preferredMimes.find((m) => MediaRecorder.isTypeSupported(m)) || 'video/webm';

  const videoStream = canvas.captureStream(fps);
  const combinedStream = new MediaStream(videoStream.getVideoTracks());

  // Preload custom replacement background images and uploaded images before rendering export frames
  const bgUrls = new Set<string>();
  [...baseClips, ...overlayClips].forEach((c) => {
    if (c.bgReplaceMode === 'image' && c.bgImageUrl) {
      bgUrls.add(c.bgImageUrl);
    }
    const asset = assetsById.get(c.assetId);
    if (asset?.kind === 'uploaded' && asset.mediaType === 'image' && asset.srcUrl) {
      bgUrls.add(asset.srcUrl);
    }
  });
  await Promise.all(
    Array.from(bgUrls).map((url) => {
      const img = preloadImage(url);
      if (!img) return Promise.resolve();
      if (img.complete) return Promise.resolve();
      return new Promise<void>((resolve) => {
        img.addEventListener('load', () => resolve(), { once: true });
        img.addEventListener('error', () => resolve(), { once: true });
        setTimeout(resolve, 1500);
      });
    })
  );

  // Mix SFX + Background Music audio track if any exist
  const audioCtx = getAudioContext();
  const sfxDest = audioCtx.createMediaStreamDestination();
  const preloadedSfx = new Map<string, AudioBuffer>();
  for (const sfxClip of soundEffects) {
    const asset = sfxById.get(sfxClip.sfxAssetId);
    if (!asset) continue;
    const buf = await getSfxBuffer(asset, audioCtx);
    if (buf) preloadedSfx.set(sfxClip.id, buf);
  }
  const preloadedMusic = new Map<string, AudioBuffer>();
  for (const mClip of musicClips) {
    const asset = musicById.get(mClip.musicAssetId);
    if (!asset) continue;
    const buf = await getMusicBuffer(asset, audioCtx);
    if (buf) preloadedMusic.set(mClip.id, buf);
  }
  if (preloadedSfx.size > 0 || preloadedMusic.size > 0) {
    sfxDest.stream.getAudioTracks().forEach((t) => combinedStream.addTrack(t));
  }

  const recorder = new MediaRecorder(combinedStream, {
    mimeType,
    videoBitsPerSecond: resolution === '1080p' ? 8_000_000 : 4_500_000,
  });

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const stopPromise = new Promise<Blob>((resolve) => {
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: mimeType }));
    };
  });

  recorder.start(100);

  const totalFrames = Math.max(1, Math.ceil(duration * fps));
  const frameIntervalMs = 1000 / fps;
  const triggeredSfx = new Set<string>();
  const activeExportMusic = new Map<string, AudioBufferSourceNode>();

  const seekVideoForFrame = (
    video: HTMLVideoElement,
    targetTime: number
  ): Promise<void> => {
    return new Promise((resolve) => {
      if (Math.abs(video.currentTime - targetTime) <= 0.03 && video.readyState >= 2) {
        resolve();
        return;
      }
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        video.removeEventListener('seeked', done);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve());
        });
      };
      video.addEventListener('seeked', done, { once: true });
      try {
        video.currentTime = targetTime;
      } catch {
        done();
      }
      setTimeout(done, 180);
    });
  };

  for (let frame = 0; frame < totalFrames; frame++) {
    const t = Math.min(duration, frame / fps);

    // Sync any active uploaded videos before drawing export frame
    const allActiveClips = [...baseClips, ...overlayClips];
    for (const clip of allActiveClips) {
      const timeInClip = t - clip.startTime;
      if (timeInClip < 0 || timeInClip > clip.duration) continue;
      const asset = assetsById.get(clip.assetId);
      if (asset?.kind === 'uploaded') {
        if (asset.mediaType === 'image') {
          const img = preloadImage(asset.srcUrl);
          if (img && img.complete && clip.bgRemovalMode === 'ai') {
            await generateAiMaskForExport({
              clipId: clip.id,
              video: img,
              videoTime: 0,
              threshold: clip.bgThreshold ?? 0.5,
              softness: clip.bgEdgeSoftness ?? 0.35,
              invertMask: clip.bgInvertMask ?? false,
            });
          }
        } else {
          const video = getOrCreateVideoElement(asset, 0, clip.speed);
          if (video) {
            const realDur =
              Number.isFinite(video.duration) && video.duration > 0
                ? video.duration
                : asset.duration;
            const targetT = Math.min(
              Math.max(0, clip.sourceOffset + timeInClip * clip.speed),
              Math.max(0.05, realDur - 0.04)
            );
            await seekVideoForFrame(video, targetT);
            if (clip.bgRemovalMode === 'ai') {
              await generateAiMaskForExport({
                clipId: clip.id,
                video,
                videoTime: video.currentTime,
                threshold: clip.bgThreshold ?? 0.5,
                softness: clip.bgEdgeSoftness ?? 0.35,
                invertMask: clip.bgInvertMask ?? false,
              });
            }
          }
        }
      }
    }

    // Trigger SFX into export audio destination as render time passes startTime
    for (const sfxClip of soundEffects) {
      if (!triggeredSfx.has(sfxClip.id) && t >= sfxClip.startTime) {
        triggeredSfx.add(sfxClip.id);
        const buf = preloadedSfx.get(sfxClip.id);
        if (buf) {
          const src = audioCtx.createBufferSource();
          src.buffer = buf;
          const gain = audioCtx.createGain();
          gain.gain.value = sfxClip.volume;
          src.connect(gain);
          gain.connect(sfxDest);
          src.start(0);
        }
      }
    }

    // Start/Stop looping Music clips into export audio destination
    for (const mClip of musicClips) {
      const inRange = t >= mClip.startTime && t < mClip.startTime + mClip.duration;
      const activeNode = activeExportMusic.get(mClip.id);
      if (inRange && !activeNode) {
        const buf = preloadedMusic.get(mClip.id);
        if (buf) {
          const src = audioCtx.createBufferSource();
          src.buffer = buf;
          src.loop = true;
          const gain = audioCtx.createGain();
          gain.gain.value = mClip.volume;
          src.connect(gain);
          gain.connect(sfxDest);
          src.start(0);
          activeExportMusic.set(mClip.id, src);
        }
      } else if (!inRange && activeNode) {
        try {
          activeNode.stop();
        } catch {
          // Ignore
        }
        activeExportMusic.delete(mClip.id);
      }
    }

    renderFrame({
      ctx,
      canvasW: width,
      canvasH: height,
      aspectRatio,
      timelineTime: t,
      baseClips,
      overlayClips,
      textOverlays,
      assetsById,
      isPlaying: false,
      isExporting: true,
      showSafeZone: false,
      selection: null,
      seamDivider,
    });
    onProgress(Math.round(((frame + 1) / totalFrames) * 95));
    await new Promise((r) => setTimeout(r, Math.min(frameIntervalMs, 20)));
  }

  activeExportMusic.forEach((src) => {
    try {
      src.stop();
    } catch {
      // Ignore
    }
  });
  activeExportMusic.clear();

  recorder.stop();
  const blob = await stopPromise;
  onProgress(100);

  const sizeMb = (blob.size / (1024 * 1024)).toFixed(1);
  return {
    blobUrl: URL.createObjectURL(blob),
    sizeLabel: `${sizeMb} MB`,
    mimeType,
  };
}
