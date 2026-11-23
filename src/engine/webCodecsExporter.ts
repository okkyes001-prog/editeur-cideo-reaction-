import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
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
import { getCanvasDimensions } from '../data/presets';
import {
  exportTimelineToVideo,
  getOrCreateVideoElement,
  preloadImage,
  renderFrame,
} from './compositor';
import { getAudioContext, getMusicBuffer, getSfxBuffer } from './soundEffects';
import { generateAiMaskForExport } from './backgroundRemoval';

const H264_CODEC_CANDIDATES = [
  'avc1.4d002a', // Main profile, Level 4.2 (broadly hardware-accelerated)
  'avc1.42001f', // Baseline profile, Level 3.1
  'avc1.640028', // High profile, Level 4.0
  'avc1.4d001f', // Main profile, Level 3.1
];

/**
 * Checks if WebCodecs VideoEncoder and MP4 muxing are supported in the current environment.
 */
export async function isWebCodecsSupported(): Promise<boolean> {
  if (
    typeof window === 'undefined' ||
    typeof VideoEncoder === 'undefined' ||
    typeof VideoFrame === 'undefined'
  ) {
    return false;
  }

  for (const codec of H264_CODEC_CANDIDATES) {
    try {
      const res = await VideoEncoder.isConfigSupported({
        codec,
        width: 1280,
        height: 720,
        bitrate: 4_000_000,
        framerate: 30,
        hardwareAcceleration: 'prefer-hardware',
      });
      if (res && res.supported) {
        return true;
      }
    } catch {
      // Try next codec candidate
    }
  }

  return false;
}

/**
 * Finds the first hardware-supported H.264 / AVC codec for the given dimensions and framerate.
 */
async function resolveSupportedVideoCodec(
  width: number,
  height: number,
  bitrate: number,
  fps: number
): Promise<string | null> {
  if (typeof VideoEncoder === 'undefined') return null;

  for (const codec of H264_CODEC_CANDIDATES) {
    try {
      const res = await VideoEncoder.isConfigSupported({
        codec,
        width,
        height,
        bitrate,
        framerate: fps,
        hardwareAcceleration: 'prefer-hardware',
      });
      if (res && res.supported) {
        return codec;
      }
    } catch {
      // Continue searching
    }
  }

  // Fallback check without forcing prefer-hardware
  for (const codec of H264_CODEC_CANDIDATES) {
    try {
      const res = await VideoEncoder.isConfigSupported({
        codec,
        width,
        height,
        bitrate,
        framerate: fps,
      });
      if (res && res.supported) {
        return codec;
      }
    } catch {
      // Continue searching
    }
  }

  return null;
}

/**
 * Instant Offline Audio Rendering using OfflineAudioContext.
 * Renders SFX and Music timeline into an AudioBuffer in milliseconds (no real-time waiting).
 */
async function renderOfflineAudioMixdown(params: {
  duration: number;
  sampleRate: number;
  soundEffects: SoundEffectClip[];
  musicClips: MusicClip[];
  sfxById: Map<string, SoundEffectAsset>;
  musicById: Map<string, MusicAsset>;
}): Promise<AudioBuffer | null> {
  const { duration, sampleRate, soundEffects, musicClips, sfxById, musicById } =
    params;

  if (soundEffects.length === 0 && musicClips.length === 0) {
    return null;
  }

  const baseAudioCtx = getAudioContext();
  const preloadedSfx = new Map<string, AudioBuffer>();
  for (const sfx of soundEffects) {
    const asset = sfxById.get(sfx.sfxAssetId);
    if (!asset) continue;
    const buf = await getSfxBuffer(asset, baseAudioCtx);
    if (buf) preloadedSfx.set(sfx.id, buf);
  }

  const preloadedMusic = new Map<string, AudioBuffer>();
  for (const m of musicClips) {
    const asset = musicById.get(m.musicAssetId);
    if (!asset) continue;
    const buf = await getMusicBuffer(asset, baseAudioCtx);
    if (buf) preloadedMusic.set(m.id, buf);
  }

  if (preloadedSfx.size === 0 && preloadedMusic.size === 0) {
    return null;
  }

  const totalSamples = Math.max(1, Math.ceil(duration * sampleRate));
  const offlineCtx = new OfflineAudioContext(2, totalSamples, sampleRate);

  // Mix SFX clips
  for (const sfx of soundEffects) {
    const buf = preloadedSfx.get(sfx.id);
    if (!buf) continue;
    const src = offlineCtx.createBufferSource();
    src.buffer = buf;
    const gain = offlineCtx.createGain();
    gain.gain.value = sfx.volume;
    src.connect(gain);
    gain.connect(offlineCtx.destination);
    src.start(Math.max(0, sfx.startTime));
  }

  // Mix Music clips (with looping if duration spans longer than source track)
  for (const m of musicClips) {
    const buf = preloadedMusic.get(m.id);
    if (!buf) continue;
    const src = offlineCtx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const gain = offlineCtx.createGain();
    gain.gain.value = m.volume;
    src.connect(gain);
    gain.connect(offlineCtx.destination);
    src.start(Math.max(0, m.startTime));
    src.stop(Math.max(0, m.startTime + m.duration));
  }

  try {
    return await offlineCtx.startRendering();
  } catch (err) {
    console.warn('OfflineAudioContext rendering error:', err);
    return null;
  }
}

/**
 * Fast Video Seek helper without double requestAnimationFrame delays.
 */
function seekVideoQuick(
  video: HTMLVideoElement,
  targetTime: number
): Promise<void> {
  return new Promise((resolve) => {
    if (
      Math.abs(video.currentTime - targetTime) <= 0.03 &&
      video.readyState >= 2
    ) {
      resolve();
      return;
    }

    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      video.removeEventListener('seeked', done);
      resolve();
    };

    video.addEventListener('seeked', done, { once: true });
    try {
      video.currentTime = targetTime;
    } catch {
      done();
    }
    setTimeout(done, 90);
  });
}

/**
 * High-performance CapCut-style offline video export using WebCodecs (VideoEncoder + AudioEncoder)
 * and mp4-muxer. Yields a universally compatible, hardware-accelerated MP4 file at 5x-10x real-time speed.
 * Automatically falls back to MediaRecorder if WebCodecs is unsupported on the user's browser.
 */
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

  // Determine target canvas dimensions
  const dims = getCanvasDimensions(aspectRatio, resolution);
  // H.264 requires dimensions to be even numbers (divisible by 2)
  const evenWidth = dims.width % 2 === 0 ? dims.width : dims.width - 1;
  const evenHeight = dims.height % 2 === 0 ? dims.height : dims.height - 1;
  const targetBitrate = resolution === '1080p' ? 8_000_000 : 4_500_000;

  // 1. Check WebCodecs availability
  const selectedCodec = await resolveSupportedVideoCodec(
    evenWidth,
    evenHeight,
    targetBitrate,
    fps
  );

  if (!selectedCodec) {
    console.warn(
      'WebCodecs H.264 not supported on this platform. Falling back to MediaRecorder.'
    );
    return exportTimelineToVideo(params);
  }

  try {
    // 2. Preload replacement images and static image assets
    const bgUrls = new Set<string>();
    [...baseClips, ...overlayClips].forEach((c) => {
      if (c.bgReplaceMode === 'image' && c.bgImageUrl) {
        bgUrls.add(c.bgImageUrl);
      }
      const asset = assetsById.get(c.assetId);
      if (
        asset?.kind === 'uploaded' &&
        asset.mediaType === 'image' &&
        asset.srcUrl
      ) {
        bgUrls.add(asset.srcUrl);
      }
    });

    await Promise.all(
      Array.from(bgUrls).map((url) => {
        const img = preloadImage(url);
        if (!img || img.complete) return Promise.resolve();
        return new Promise<void>((resolve) => {
          img.addEventListener('load', () => resolve(), { once: true });
          img.addEventListener('error', () => resolve(), { once: true });
          setTimeout(resolve, 1000);
        });
      })
    );

    // 3. Fast Offline Audio Mixdown in ~30ms
    const sampleRate = 44100;
    const mixedAudioBuffer = await renderOfflineAudioMixdown({
      duration,
      sampleRate,
      soundEffects,
      musicClips,
      sfxById,
      musicById,
    });

    // Check if AudioEncoder (AAC) is available for audio muxing
    let canEncodeAudio = false;
    if (mixedAudioBuffer && typeof AudioEncoder !== 'undefined') {
      try {
        const audioSup = await AudioEncoder.isConfigSupported({
          codec: 'mp4a.40.2',
          numberOfChannels: 2,
          sampleRate,
        });
        canEncodeAudio = Boolean(audioSup && audioSup.supported);
      } catch {
        canEncodeAudio = false;
      }
    }

    // 4. Initialize MP4 Muxer
    const muxerTarget = new ArrayBufferTarget();
    const muxer = new Muxer({
      target: muxerTarget,
      video: {
        codec: 'avc',
        width: evenWidth,
        height: evenHeight,
        frameRate: fps,
      },
      audio: canEncodeAudio
        ? {
            codec: 'aac',
            numberOfChannels: 2,
            sampleRate,
          }
        : undefined,
      fastStart: 'in-memory',
      firstTimestampBehavior: 'offset',
    });

    // 5. Initialize WebCodecs VideoEncoder
    let videoEncoderError: Error | null = null;
    const videoEncoder = new VideoEncoder({
      output: (chunk, meta) => {
        muxer.addVideoChunk(chunk, meta);
      },
      error: (e) => {
        videoEncoderError = e instanceof Error ? e : new Error(String(e));
      },
    });

    videoEncoder.configure({
      codec: selectedCodec,
      width: evenWidth,
      height: evenHeight,
      bitrate: targetBitrate,
      framerate: fps,
      hardwareAcceleration: 'prefer-hardware',
      avc: { format: 'avc' },
    });

    // 6. Encode Audio Chunks via AudioEncoder if available
    if (canEncodeAudio && mixedAudioBuffer) {
      let audioEncoderError: Error | null = null;
      const audioEncoder = new AudioEncoder({
        output: (chunk, meta) => {
          muxer.addAudioChunk(chunk, meta);
        },
        error: (e) => {
          audioEncoderError = e instanceof Error ? e : new Error(String(e));
        },
      });

      audioEncoder.configure({
        codec: 'mp4a.40.2',
        numberOfChannels: 2,
        sampleRate,
        bitrate: 128_000,
      });

      const ch0 = mixedAudioBuffer.getChannelData(0);
      const ch1 =
        mixedAudioBuffer.numberOfChannels > 1
          ? mixedAudioBuffer.getChannelData(1)
          : ch0;
      const totalAudioSamples = mixedAudioBuffer.length;
      const audioChunkFrames = 1024;

      for (
        let offset = 0;
        offset < totalAudioSamples;
        offset += audioChunkFrames
      ) {
        if (audioEncoderError) break;
        const count = Math.min(audioChunkFrames, totalAudioSamples - offset);
        const interleaved = new Float32Array(count * 2);
        for (let i = 0; i < count; i++) {
          interleaved[i * 2] = ch0[offset + i];
          interleaved[i * 2 + 1] = ch1[offset + i];
        }

        const audioData = new AudioData({
          format: 'f32',
          sampleRate,
          numberOfFrames: count,
          numberOfChannels: 2,
          timestamp: Math.round((offset / sampleRate) * 1_000_000), // in microseconds
          data: interleaved,
        });

        audioEncoder.encode(audioData);
        audioData.close();
      }

      await audioEncoder.flush();
      audioEncoder.close();
    }

    // 7. Video Frame Rendering Loop
    const canvas = document.createElement('canvas');
    canvas.width = evenWidth;
    canvas.height = evenHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: false });
    if (!ctx) throw new Error('Could not acquire 2D canvas context');

    const totalFrames = Math.max(1, Math.ceil(duration * fps));
    const allClips = [...baseClips, ...overlayClips];

    for (let frame = 0; frame < totalFrames; frame++) {
      if (videoEncoderError) throw videoEncoderError;

      const t = Math.min(duration, frame / fps);

      // Fast seek active clips
      for (const clip of allClips) {
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
              await seekVideoQuick(video, targetT);

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

      // Draw composited frame
      renderFrame({
        ctx,
        canvasW: evenWidth,
        canvasH: evenHeight,
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

      // Send frame directly to hardware VideoEncoder
      const timestampUs = Math.round((frame / fps) * 1_000_000); // microseconds
      const durationUs = Math.round((1 / fps) * 1_000_000);
      const isKeyFrame = frame === 0 || frame % (fps * 2) === 0;

      const videoFrame = new VideoFrame(canvas, {
        timestamp: timestampUs,
        duration: durationUs,
      });

      videoEncoder.encode(videoFrame, { keyFrame: isKeyFrame });
      videoFrame.close(); // Immediately free GPU texture memory

      onProgress(Math.round(((frame + 1) / totalFrames) * 92));

      // Yield every 6 frames to keep browser UI responsive without slowing down export
      if (frame % 6 === 0) {
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    onProgress(95);

    // 8. Flush and finalize
    await videoEncoder.flush();
    videoEncoder.close();
    muxer.finalize();

    onProgress(100);

    const mp4Blob = new Blob([muxerTarget.buffer], { type: 'video/mp4' });
    const sizeMb = (mp4Blob.size / (1024 * 1024)).toFixed(1);

    return {
      blobUrl: URL.createObjectURL(mp4Blob),
      sizeLabel: `${sizeMb} MB`,
      mimeType: 'video/mp4',
    };
  } catch (err) {
    console.error('WebCodecs MP4 export encountered an error, falling back:', err);
    return exportTimelineToVideo(params);
  }
}
