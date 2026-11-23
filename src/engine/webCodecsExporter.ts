import { Muxer, StreamTarget } from 'mp4-muxer';
import {
  ALL_FORMATS,
  AudioBufferSink,
  BlobSource,
  Input,
} from 'mediabunny';
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

// Prefer hardware GPU encoder first for CapCut-level speed, falling back cleanly if unavailable
const HW_ACCEL_MODES: HardwareAcceleration[] = [
  'prefer-hardware',
  'no-preference',
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

const resolvedEncoderCache = new Map<string, ResolvedVideoEncoderConfig>();

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

  const cacheKey = `${width}x${height}@${fps}`;
  const cached = resolvedEncoderCache.get(cacheKey);
  if (cached) {
    return cached;
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
            const resolved = { codec, hardwareAcceleration };
            resolvedEncoderCache.set(cacheKey, resolved);
            return resolved;
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
 * Stitches a single audible video clip's trimmed audio into ONE AudioBuffer via Mediabunny
 * AudioBufferSink and schedules a single AudioBufferSourceNode on OfflineAudioContext.
 */
async function scheduleClipAudioWithMediabunny(
  offlineCtx: OfflineAudioContext,
  clip: VideoClip,
  srcUrl: string
): Promise<'scheduled' | 'silent' | 'unsupported'> {
  let input: Input | null = null;
  try {
    const resp = await fetch(srcUrl);
    const blob = await resp.blob();
    input = new Input({
      formats: ALL_FORMATS,
      source: new BlobSource(blob),
    });
    const audioTrack = await input.getPrimaryAudioTrack();
    if (!audioTrack) {
      return 'silent';
    }
    if (!(await audioTrack.canDecode())) {
      return 'unsupported';
    }

    const firstTs = await audioTrack.getFirstTimestamp();
    const speed = Math.max(0.25, Math.min(4, clip.speed));
    const srcStart = Math.max(firstTs, clip.sourceOffset);
    const clipSrcDur = Math.max(0.05, clip.duration * speed);
    const srcEnd = srcStart + clipSrcDur;

    const sink = new AudioBufferSink(audioTrack);
    let trackSampleRate = 0;
    let numChannels = 0;
    const chunks: Array<{ startSample: number; channels: Float32Array[] }> = [];
    let maxEndSample = 0;

    for await (const { buffer, timestamp } of sink.buffers(srcStart, srcEnd)) {
      if (!trackSampleRate) {
        trackSampleRate = buffer.sampleRate;
        numChannels = Math.min(2, buffer.numberOfChannels);
      }

      const trimStartSec = Math.max(0, srcStart - timestamp);
      const startSampleInChunk = Math.floor(trimStartSec * buffer.sampleRate);
      if (startSampleInChunk >= buffer.length) continue;

      const relSec = Math.max(0, timestamp + trimStartSec - srcStart);
      if (relSec >= clipSrcDur) break;

      const maxNeededSamples = Math.ceil((clipSrcDur - relSec) * buffer.sampleRate);
      const available = buffer.length - startSampleInChunk;
      const copyCount = Math.min(available, maxNeededSamples);
      if (copyCount <= 0) continue;

      const destStart = Math.max(0, Math.round(relSec * trackSampleRate));
      const chData: Float32Array[] = [];
      for (let c = 0; c < numChannels; c++) {
        const srcCh = buffer.getChannelData(Math.min(c, buffer.numberOfChannels - 1));
        chData.push(srcCh.slice(startSampleInChunk, startSampleInChunk + copyCount));
      }
      chunks.push({ startSample: destStart, channels: chData });
      maxEndSample = Math.max(maxEndSample, destStart + copyCount);
    }

    if (chunks.length === 0 || maxEndSample <= 0 || !trackSampleRate) {
      return 'silent';
    }

    const stitched = offlineCtx.createBuffer(
      Math.max(1, numChannels),
      maxEndSample,
      trackSampleRate
    );
    for (let c = 0; c < stitched.numberOfChannels; c++) {
      const out = stitched.getChannelData(c);
      for (const chunk of chunks) {
        const ch = chunk.channels[c];
        if (ch && chunk.startSample + ch.length <= out.length) {
          out.set(ch, chunk.startSample);
        }
      }
    }
    chunks.length = 0;

    const src = offlineCtx.createBufferSource();
    src.buffer = stitched;
    src.playbackRate.value = speed;
    const gain = offlineCtx.createGain();
    applyAudioFadeEnvelope(
      gain.gain,
      Math.max(0, Math.min(1, clip.volume)),
      Math.max(0, clip.startTime),
      Math.max(0.05, clip.duration),
      clip.fadeIn,
      clip.fadeOut
    );
    src.connect(gain);
    gain.connect(offlineCtx.destination);
    src.start(Math.max(0, clip.startTime), 0, Math.max(0.05, clip.duration));

    return 'scheduled';
  } catch {
    return 'unsupported';
  } finally {
    if (input) {
      try {
        input.dispose();
      } catch {
        // Ignore
      }
    }
  }
}

function applyAudioFadeEnvelope(
  gainParam: AudioParam,
  baseVolume: number,
  startTime: number,
  clipDuration: number,
  fadeIn = 0,
  fadeOut = 0
): void {
  const safeVol = Math.max(0, Math.min(1.5, baseVolume));
  const safeIn = Math.max(0, Math.min(clipDuration * 0.8, fadeIn));
  const safeOut = Math.max(0, Math.min(clipDuration * 0.8, fadeOut));
  const endTime = startTime + clipDuration;

  if (safeIn <= 0.02 && safeOut <= 0.02) {
    gainParam.setValueAtTime(safeVol, startTime);
    return;
  }

  if (safeIn > 0.02) {
    gainParam.setValueAtTime(0, startTime);
    gainParam.linearRampToValueAtTime(safeVol, startTime + safeIn);
  } else {
    gainParam.setValueAtTime(safeVol, startTime);
  }

  if (safeOut > 0.02) {
    const fadeOutStart = Math.max(startTime + safeIn, endTime - safeOut);
    gainParam.setValueAtTime(safeVol, fadeOutStart);
    gainParam.linearRampToValueAtTime(0, endTime);
  }
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

  const totalSamples = Math.max(1, Math.ceil(duration * sampleRate));
  const offlineCtx = new OfflineAudioContext(2, totalSamples, sampleRate);
  let hasScheduledAnyAudio = false;

  const fallbackAudioByAssetId = new Map<string, AudioBuffer>();
  for (const clip of audibleVideoClips) {
    const asset = assetsById.get(clip.assetId);
    if (!asset?.srcUrl) continue;

    const audioResult = await scheduleClipAudioWithMediabunny(
      offlineCtx,
      clip,
      asset.srcUrl
    );
    if (audioResult === 'scheduled') {
      hasScheduledAnyAudio = true;
      continue;
    }
    if (audioResult === 'silent') {
      continue;
    }

    // Fallback to decodeAudioData only if Mediabunny couldn't demux/decode audio
    try {
      let buf = fallbackAudioByAssetId.get(clip.assetId);
      if (!buf) {
        const resp = await fetch(asset.srcUrl);
        const arr = await resp.arrayBuffer();
        if (arr.byteLength <= 120 * 1024 * 1024) {
          buf = await baseAudioCtx.decodeAudioData(arr);
          fallbackAudioByAssetId.set(clip.assetId, buf);
        }
      }
      if (buf) {
        const src = offlineCtx.createBufferSource();
        src.buffer = buf;
        src.playbackRate.value = Math.max(0.25, Math.min(4, clip.speed));
        const gain = offlineCtx.createGain();
        const startWhen = Math.max(0, clip.startTime);
        const offset = Math.max(0, clip.sourceOffset);
        const dur = Math.max(0.05, clip.duration);
        applyAudioFadeEnvelope(
          gain.gain,
          Math.max(0, Math.min(1, clip.volume)),
          startWhen,
          dur,
          clip.fadeIn,
          clip.fadeOut
        );
        src.connect(gain);
        gain.connect(offlineCtx.destination);
        if (offset < buf.duration) {
          src.start(startWhen, offset, dur);
          hasScheduledAnyAudio = true;
        }
      }
    } catch {
      // Video has no audio track or unsupported codec
    }
  }

  // Mix SFX clips
  for (const sfx of soundEffects) {
    const buf = preloadedSfx.get(sfx.id);
    if (!buf) continue;
    const src = offlineCtx.createBufferSource();
    src.buffer = buf;
    const gain = offlineCtx.createGain();
    const sfxStart = Math.max(0, sfx.startTime);
    const sfxDur = Math.max(0.1, Math.min(buf.duration, sfx.duration));
    applyAudioFadeEnvelope(
      gain.gain,
      sfx.volume,
      sfxStart,
      sfxDur,
      sfx.fadeIn,
      sfx.fadeOut
    );
    src.connect(gain);
    gain.connect(offlineCtx.destination);
    src.start(sfxStart);
    hasScheduledAnyAudio = true;
  }

  // Mix Music clips (with looping if duration spans longer than source track)
  for (const m of musicClips) {
    const buf = preloadedMusic.get(m.id);
    if (!buf) continue;
    const src = offlineCtx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const gain = offlineCtx.createGain();
    const mStart = Math.max(0, m.startTime);
    const mDur = Math.max(0.1, m.duration);
    applyAudioFadeEnvelope(
      gain.gain,
      m.volume,
      mStart,
      mDur,
      m.fadeIn,
      m.fadeOut
    );
    src.connect(gain);
    gain.connect(offlineCtx.destination);
    src.start(mStart);
    src.stop(Math.max(0, mStart + mDur));
    hasScheduledAnyAudio = true;
  }

  if (!hasScheduledAnyAudio) {
    return null;
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
    let lastYield = performance.now();

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

      if (performance.now() - lastYield > 40) {
        lastYield = performance.now();
        await new Promise((r) => setTimeout(r, 0));
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
 * + Mediabunny sequential VideoDecoder + mp4-muxer.
 * Automatically falls back to MediaRecorder if WebCodecs is unsupported or fails.
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
  signal?: AbortSignal;
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
    signal,
    onProgress,
  } = params;

  if (signal?.aborted) {
    throw new DOMException('Export cancelled', 'AbortError');
  }

  const dims = getCanvasDimensions(aspectRatio, resolution);
  // H.264 requires even dimensions
  const evenWidth = dims.width % 2 === 0 ? dims.width : dims.width - 1;
  const evenHeight = dims.height % 2 === 0 ? dims.height : dims.height - 1;
  const targetBitrate = resolution === '1080p' ? 8_000_000 : 4_500_000;

  onProgress(2);

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

  onProgress(4);

  const session = createExportMediaSession(
    [...baseClips, ...overlayClips],
    assetsById,
    {
      duration,
      fps,
      maxDim: Math.max(evenWidth, evenHeight),
    }
  );

  let videoEncoder: VideoEncoder | null = null;

  try {
    // 2. Prepare sequential decoders & preload images
    await session.prepare();
    if (signal?.aborted) {
      throw new DOMException('Export cancelled', 'AbortError');
    }
    onProgress(7);

    // 3. Offline Audio Mixdown + optional AAC pre-encode
    const sampleRate = 44100;
    let mixedAudioBuffer = await renderOfflineAudioMixdown({
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
    // Release uncompressed Float32 AudioBuffer before allocating video encoding buffers
    mixedAudioBuffer = null;
    const hasAudio = encodedAudioChunks.length > 0;
    onProgress(10);

    // 4. Initialize MP4 Muxer using StreamTarget to avoid contiguous ArrayBuffer duplication in RAM
    const mp4Parts: Array<{ position: number; data: Uint8Array<ArrayBuffer> }> = [];
    const muxerTarget = new StreamTarget({
      onData: (data, position) => {
        const copy = new Uint8Array(data.byteLength);
        copy.set(data);
        mp4Parts.push({ position, data: copy });
      },
    });
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
    let lastUiYield = performance.now();

    for (let frame = 0; frame < totalFrames; frame++) {
      if (signal?.aborted) {
        throw new DOMException('Export cancelled', 'AbortError');
      }
      if (videoEncoderError) throw videoEncoderError;

      const t = Math.min(duration, frame / fps);

      // Decode next sequential frame (Mediabunny VideoSampleSink) or fallback seek
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

      // Keep GPU pipeline fed while applying gentle backpressure
      while (videoEncoder.encodeQueueSize > 12 && !videoEncoderError) {
        await new Promise((r) => setTimeout(r, 2));
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

      onProgress(10 + Math.round(((frame + 1) / totalFrames) * 84));

      if (performance.now() - lastUiYield > 35) {
        lastUiYield = performance.now();
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    onProgress(95);

    await videoEncoder.flush();
    if (videoEncoderError) throw videoEncoderError;
    videoEncoder.close();
    videoEncoder = null;

    muxer.finalize();
    encodedAudioChunks.length = 0;

    mp4Parts.sort((a, b) => a.position - b.position);
    const mp4Blob = new Blob(
      mp4Parts.map((part) => part.data),
      { type: 'video/mp4' }
    );
    mp4Parts.length = 0;

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
    session.dispose();
    if (
      signal?.aborted ||
      (err instanceof DOMException && err.name === 'AbortError')
    ) {
      throw err;
    }
    console.error('WebCodecs MP4 export encountered an error, falling back:', err);
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
