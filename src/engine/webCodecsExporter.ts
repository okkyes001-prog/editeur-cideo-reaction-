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
  createExportMediaSession,
  exportTimelineToVideo,
  renderFrame,
} from './compositor';
import { getAudioContext, getMusicBuffer, getSfxBuffer } from './soundEffects';

const H264_CODEC_CANDIDATES = [
  'avc1.4d002a', // Main profile, Level 4.2
  'avc1.640028', // High profile, Level 4.0
  'avc1.42001f', // Baseline profile, Level 3.1
  'avc1.4d001f', // Main profile, Level 3.1
];

const HW_ACCEL_MODES: HardwareAcceleration[] = [
  'no-preference',
  'prefer-hardware',
  'prefer-software',
];

interface ResolvedVideoEncoderConfig {
  codec: string;
  hardwareAcceleration: HardwareAcceleration;
}

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

  for (const hardwareAcceleration of HW_ACCEL_MODES) {
    for (const codec of H264_CODEC_CANDIDATES) {
      try {
        const res = await VideoEncoder.isConfigSupported({
          codec,
          width: 1280,
          height: 720,
          bitrate: 4_000_000,
          framerate: 30,
          hardwareAcceleration,
        });
        if (res && res.supported) {
          return true;
        }
      } catch {
        // Try next candidate
      }
    }
  }

  return false;
}

/**
 * Probes candidate H.264 configurations by actually creating, configuring, encoding a test frame,
 * and flushing a disposable VideoEncoder so runtime "Encoder creation error" never breaks mid-export.
 */
async function resolveWorkingVideoEncoderConfig(
  width: number,
  height: number,
  bitrate: number,
  fps: number
): Promise<ResolvedVideoEncoderConfig | null> {
  if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') {
    return null;
  }

  const probeCanvas = document.createElement('canvas');
  probeCanvas.width = width;
  probeCanvas.height = height;
  const probeCtx = probeCanvas.getContext('2d');
  if (probeCtx) {
    probeCtx.fillStyle = '#07090D';
    probeCtx.fillRect(0, 0, width, height);
  }

  for (const hardwareAcceleration of HW_ACCEL_MODES) {
    for (const codec of H264_CODEC_CANDIDATES) {
      try {
        const config: VideoEncoderConfig = {
          codec,
          width,
          height,
          bitrate,
          framerate: fps,
          hardwareAcceleration,
          avc: { format: 'avc' },
        };

        const support = await VideoEncoder.isConfigSupported(config);
        if (!support?.supported) continue;

        let probeErr: Error | null = null;
        let outputChunks = 0;

        const probeEncoder = new VideoEncoder({
          output: () => {
            outputChunks++;
          },
          error: (e) => {
            probeErr = e instanceof Error ? e : new Error(String(e));
          },
        });

        let testFrame: VideoFrame | null = null;
        try {
          probeEncoder.configure(config);
          testFrame = new VideoFrame(probeCanvas, {
            timestamp: 0,
            duration: Math.round((1 / fps) * 1_000_000),
          });
          probeEncoder.encode(testFrame, { keyFrame: true });
          await probeEncoder.flush();
          if (!probeErr && outputChunks > 0) {
            return { codec, hardwareAcceleration };
          }
        } finally {
          testFrame?.close();
          try {
            if (probeEncoder.state !== 'closed') {
              probeEncoder.close();
            }
          } catch {
            // Ignore cleanup failure
          }
        }
      } catch {
        // Continue trying next combination
      }
    }
  }

  return null;
}

/**
 * Instant Offline Audio Rendering using OfflineAudioContext.
 * Renders SFX, Music, and uploaded video clip audio into a mixed AudioBuffer.
 */
async function renderOfflineAudioMixdown(params: {
  duration: number;
  sampleRate: number;
  baseClips: VideoClip[];
  overlayClips: VideoClip[];
  assetsById: Map<string, MediaAsset>;
  soundEffects: SoundEffectClip[];
  musicClips: MusicClip[];
  sfxById: Map<string, SoundEffectAsset>;
  musicById: Map<string, MusicAsset>;
}): Promise<AudioBuffer | null> {
  const {
    duration,
    sampleRate,
    baseClips,
    overlayClips,
    assetsById,
    soundEffects,
    musicClips,
    sfxById,
    musicById,
  } = params;

  const audibleVideoClips = [...baseClips, ...overlayClips].filter((clip) => {
    if (clip.volume <= 0) return false;
    const asset = assetsById.get(clip.assetId);
    return (
      asset?.kind === 'uploaded' &&
      asset.mediaType !== 'image' &&
      Boolean(asset.srcUrl)
    );
  });

  if (
    soundEffects.length === 0 &&
    musicClips.length === 0 &&
    audibleVideoClips.length === 0
  ) {
    return null;
  }

  const baseAudioCtx = getAudioContext();
  if (baseAudioCtx.state === 'suspended') {
    await baseAudioCtx.resume().catch(() => {});
  }

  const preloadedSfx = new Map<string, AudioBuffer>();
  for (const sfx of soundEffects) {
    const asset = sfxById.get(sfx.sfxAssetId);
    if (!asset) continue;
    const buf = await getSfxBuffer(asset, baseAudioCtx).catch(() => null);
    if (buf) preloadedSfx.set(sfx.id, buf);
  }

  const preloadedMusic = new Map<string, AudioBuffer>();
  for (const m of musicClips) {
    const asset = musicById.get(m.musicAssetId);
    if (!asset) continue;
    const buf = await getMusicBuffer(asset, baseAudioCtx).catch(() => null);
    if (buf) preloadedMusic.set(m.id, buf);
  }

  const preloadedClipAudio = new Map<string, AudioBuffer>();
  for (const clip of audibleVideoClips) {
    const asset = assetsById.get(clip.assetId);
    if (!asset?.srcUrl) continue;
    try {
      const resp = await fetch(asset.srcUrl);
      const arr = await resp.arrayBuffer();
      // Guard against huge files causing OOM during audio decoding
      if (arr.byteLength > 120 * 1024 * 1024) continue;
      const decoded = await baseAudioCtx.decodeAudioData(arr);
      preloadedClipAudio.set(clip.id, decoded);
    } catch {
      // Video may have no audio track or unsupported codec — skip cleanly
    }
  }

  if (
    preloadedSfx.size === 0 &&
    preloadedMusic.size === 0 &&
    preloadedClipAudio.size === 0
  ) {
    return null;
  }

  const totalSamples = Math.max(1, Math.ceil(duration * sampleRate));
  const offlineCtx = new OfflineAudioContext(2, totalSamples, sampleRate);

  for (const clip of audibleVideoClips) {
    const buf = preloadedClipAudio.get(clip.id);
    if (!buf) continue;
    try {
      const src = offlineCtx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = Math.max(0.25, Math.min(4, clip.speed));
      const gain = offlineCtx.createGain();
      gain.gain.value = Math.max(0, Math.min(1, clip.volume));
      src.connect(gain);
      gain.connect(offlineCtx.destination);
      const startWhen = Math.max(0, clip.startTime);
      const offset = Math.max(0, clip.sourceOffset);
      const dur = Math.max(0.05, clip.duration);
      if (offset < buf.duration) {
        src.start(startWhen, offset, dur * src.playbackRate.value);
      }
    } catch {
      // Skip invalid offsets
    }
  }

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
 * Encodes an AudioBuffer into AAC chunks up front so any audio encoder quirk
 * falls back cleanly to silent MP4 rather than corrupting the muxer.
 */
async function encodeAudioBufferToAacChunks(
  audioBuffer: AudioBuffer,
  sampleRate: number
): Promise<Array<{ chunk: EncodedAudioChunk; meta?: EncodedAudioChunkMetadata }>> {
  if (typeof AudioEncoder === 'undefined' || typeof AudioData === 'undefined') {
    return [];
  }

  const audioSup = await AudioEncoder.isConfigSupported({
    codec: 'mp4a.40.2',
    numberOfChannels: 2,
    sampleRate,
    bitrate: 128_000,
  }).catch(() => null);

  if (!audioSup?.supported) return [];

  const encodedChunks: Array<{
    chunk: EncodedAudioChunk;
    meta?: EncodedAudioChunkMetadata;
  }> = [];
  let audioEncoderError: Error | null = null;

  const audioEncoder = new AudioEncoder({
    output: (chunk, meta) => {
      encodedChunks.push({ chunk, meta });
    },
    error: (e) => {
      audioEncoderError = e instanceof Error ? e : new Error(String(e));
    },
  });

  try {
    audioEncoder.configure({
      codec: 'mp4a.40.2',
      numberOfChannels: 2,
      sampleRate,
      bitrate: 128_000,
    });

    const ch0 = audioBuffer.getChannelData(0);
    const ch1 =
      audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : ch0;
    const totalAudioSamples = audioBuffer.length;
    const audioChunkFrames = 1024;

    for (let offset = 0; offset < totalAudioSamples; offset += audioChunkFrames) {
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
        timestamp: Math.round((offset / sampleRate) * 1_000_000),
        data: interleaved,
      });

      try {
        audioEncoder.encode(audioData);
      } finally {
        audioData.close();
      }
    }

    await audioEncoder.flush();
    if (audioEncoderError) return [];
    return encodedChunks;
  } catch {
    return [];
  } finally {
    try {
      if (audioEncoder.state !== 'closed') {
        audioEncoder.close();
      }
    } catch {
      // Ignore
    }
  }
}

/**
 * High-performance offline video export using WebCodecs (VideoEncoder + AudioEncoder)
 * and mp4-muxer. Automatically falls back to MediaRecorder if WebCodecs is unsupported
 * or encounters an encoder error.
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

  const dims = getCanvasDimensions(aspectRatio, resolution);
  // H.264 requires even dimensions
  const evenWidth = dims.width % 2 === 0 ? dims.width : dims.width - 1;
  const evenHeight = dims.height % 2 === 0 ? dims.height : dims.height - 1;
  const targetBitrate = resolution === '1080p' ? 8_000_000 : 4_500_000;

  // 1. Probe WebCodecs encoder availability with an actual test encode
  const encoderConfig = await resolveWorkingVideoEncoderConfig(
    evenWidth,
    evenHeight,
    targetBitrate,
    fps
  );

  if (!encoderConfig) {
    console.warn(
      'WebCodecs H.264 encoder unavailable or failed probe. Falling back to MediaRecorder.'
    );
    return exportTimelineToVideo(params);
  }

  const session = createExportMediaSession(
    [...baseClips, ...overlayClips],
    assetsById
  );

  let videoEncoder: VideoEncoder | null = null;

  try {
    // 2. Prepare DOM-attached export media decoders & preload all images/videos
    await session.prepare();

    // 3. Offline Audio Mixdown + optional AAC pre-encode
    const sampleRate = 44100;
    const mixedAudioBuffer = await renderOfflineAudioMixdown({
      duration,
      sampleRate,
      baseClips,
      overlayClips,
      assetsById,
      soundEffects,
      musicClips,
      sfxById,
      musicById,
    });

    const encodedAudioChunks = mixedAudioBuffer
      ? await encodeAudioBufferToAacChunks(mixedAudioBuffer, sampleRate)
      : [];
    const hasAudio = encodedAudioChunks.length > 0;

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
      audio: hasAudio
        ? {
            codec: 'aac',
            numberOfChannels: 2,
            sampleRate,
          }
        : undefined,
      fastStart: 'in-memory',
      firstTimestampBehavior: 'offset',
    });

    for (const { chunk, meta } of encodedAudioChunks) {
      muxer.addAudioChunk(chunk, meta);
    }

    // 5. Initialize WebCodecs VideoEncoder
    let videoEncoderError: Error | null = null;
    videoEncoder = new VideoEncoder({
      output: (chunk, meta) => {
        muxer.addVideoChunk(chunk, meta);
      },
      error: (e) => {
        videoEncoderError = e instanceof Error ? e : new Error(String(e));
      },
    });

    videoEncoder.configure({
      codec: encoderConfig.codec,
      width: evenWidth,
      height: evenHeight,
      bitrate: targetBitrate,
      framerate: fps,
      hardwareAcceleration: encoderConfig.hardwareAcceleration,
      avc: { format: 'avc' },
    });

    // 6. Video Frame Rendering Loop
    const canvas = document.createElement('canvas');
    canvas.width = evenWidth;
    canvas.height = evenHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: false });
    if (!ctx) throw new Error('Could not acquire 2D canvas context');

    const totalFrames = Math.max(1, Math.ceil(duration * fps));

    for (let frame = 0; frame < totalFrames; frame++) {
      if (videoEncoderError) throw videoEncoderError;

      const t = Math.min(duration, frame / fps);

      // Cleanly seek and snapshot every active video clip before compositing
      await session.prepareFrame(t);

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
        exportSources: session.exportSources,
      });

      // Backpressure so encoder queue doesn't overflow on 1080p/60fps
      while (videoEncoder.encodeQueueSize > 8 && !videoEncoderError) {
        await new Promise((r) => setTimeout(r, 4));
      }
      if (videoEncoderError) throw videoEncoderError;

      const timestampUs = Math.round((frame / fps) * 1_000_000);
      const durationUs = Math.round((1 / fps) * 1_000_000);
      const isKeyFrame = frame === 0 || frame % (fps * 2) === 0;

      const videoFrame = new VideoFrame(canvas, {
        timestamp: timestampUs,
        duration: durationUs,
      });

      try {
        videoEncoder.encode(videoFrame, { keyFrame: isKeyFrame });
      } finally {
        videoFrame.close();
      }

      onProgress(Math.round(((frame + 1) / totalFrames) * 92));

      if (frame % 6 === 0) {
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    onProgress(95);

    await videoEncoder.flush();
    if (videoEncoderError) throw videoEncoderError;
    videoEncoder.close();
    videoEncoder = null;

    muxer.finalize();

    const mp4Blob = new Blob([muxerTarget.buffer], { type: 'video/mp4' });
    if (mp4Blob.size === 0) {
      throw new Error('Muxed MP4 output buffer was empty');
    }

    onProgress(100);
    const sizeMb = (mp4Blob.size / (1024 * 1024)).toFixed(1);

    return {
      blobUrl: URL.createObjectURL(mp4Blob),
      sizeLabel: `${sizeMb} MB`,
      mimeType: 'video/mp4',
    };
  } catch (err) {
    console.error('WebCodecs MP4 export encountered an error, falling back:', err);
    session.dispose();
    return exportTimelineToVideo(params);
  } finally {
    if (videoEncoder) {
      try {
        if (videoEncoder.state !== 'closed') {
          videoEncoder.close();
        }
      } catch {
        // Ignore cleanup
      }
    }
    session.dispose();
  }
}
