import { ALL_FORMATS, AudioBufferSink, BlobSource, Input } from 'mediabunny';

export interface TimedCaptionCue {
  startTime: number;
  duration: number;
  text: string;
}

export interface SpeechSegment {
  startTime: number;
  duration: number;
}

function parseTimestampToSeconds(raw: string): number {
  const clean = raw.trim().replace(',', '.');
  const parts = clean.split(':').map((p) => Number(p));
  if (parts.some((n) => !Number.isFinite(n))) return 0;
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return parts[0] || 0;
}

/**
 * Parses standard .srt and .vtt subtitle files into timed caption cues.
 */
export function parseSubtitleFile(content: string): TimedCaptionCue[] {
  const normalized = content
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  const blocks = normalized
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  const cues: TimedCaptionCue[] = [];
  const timeRegex =
    /((?:\d{1,2}:)?\d{1,2}:\d{2}[,.]\d{1,3})\s*-->\s*((?:\d{1,2}:)?\d{1,2}:\d{2}[,.]\d{1,3})/;

  for (const block of blocks) {
    if (block.startsWith('WEBVTT') || block.startsWith('NOTE')) continue;
    const lines = block.split('\n').map((l) => l.trim());
    const timingLineIdx = lines.findIndex((l) => timeRegex.test(l));
    if (timingLineIdx === -1) continue;

    const match = lines[timingLineIdx].match(timeRegex);
    if (!match) continue;

    const startTime = Math.max(0, parseTimestampToSeconds(match[1]));
    const endTime = Math.max(startTime + 0.4, parseTimestampToSeconds(match[2]));
    const text = lines
      .slice(timingLineIdx + 1)
      .join(' ')
      .replace(/<[^>]+>/g, '')
      .trim();

    if (!text) continue;
    cues.push({
      startTime: Number(startTime.toFixed(2)),
      duration: Number((endTime - startTime).toFixed(2)),
      text,
    });
  }

  return cues;
}

/**
 * Analyzes a clip's actual audio track RMS energy to locate spoken segments on the timeline.
 */
export async function detectSpeechSegmentsFromUrl(
  srcUrl: string,
  sourceOffset: number,
  clipDuration: number,
  speed: number,
  clipStartTime: number
): Promise<SpeechSegment[]> {
  const safeSpeed = Math.max(0.25, Math.min(4, speed || 1));
  const srcStart = Math.max(0, sourceOffset);
  const srcDur = Math.max(0.5, clipDuration * safeSpeed);
  const srcEnd = srcStart + srcDur;
  const binSec = 0.05; // 50ms RMS energy bins
  const binCount = Math.max(1, Math.ceil(srcDur / binSec));
  const energies = new Float32Array(binCount);
  let extracted = false;

  let input: Input | null = null;
  try {
    const resp = await fetch(srcUrl);
    const blob = await resp.blob();
    input = new Input({
      formats: ALL_FORMATS,
      source: new BlobSource(blob),
    });
    const audioTrack = await input.getPrimaryAudioTrack();
    if (audioTrack && (await audioTrack.canDecode())) {
      const firstTs = await audioTrack.getFirstTimestamp();
      const sink = new AudioBufferSink(audioTrack);
      const adjStart = Math.max(firstTs, srcStart);

      for await (const { buffer, timestamp } of sink.buffers(
        adjStart,
        adjStart + srcDur
      )) {
        const sr = buffer.sampleRate;
        const ch = buffer.getChannelData(0);
        const samplesPerBin = Math.max(1, Math.floor(sr * binSec));
        for (let i = 0; i < ch.length; i += samplesPerBin) {
          const tRel = timestamp + i / sr - srcStart;
          const binIdx = Math.floor(tRel / binSec);
          if (binIdx < 0 || binIdx >= binCount) continue;
          let sumSq = 0;
          const end = Math.min(ch.length, i + samplesPerBin);
          for (let j = i; j < end; j++) {
            sumSq += ch[j] * ch[j];
          }
          const rms = Math.sqrt(sumSq / Math.max(1, end - i));
          if (rms > energies[binIdx]) energies[binIdx] = rms;
        }
        extracted = true;
      }
    }
  } catch {
    // Fallback below if Mediabunny can't read track
  } finally {
    if (input) {
      try {
        input.dispose();
      } catch {
        // Ignore
      }
    }
  }

  if (!extracted) {
    return buildEvenSegments(clipStartTime, clipDuration, 2.4);
  }

  let peak = 0;
  for (let i = 0; i < energies.length; i++) {
    if (energies[i] > peak) peak = energies[i];
  }

  if (peak < 0.008) {
    return buildEvenSegments(clipStartTime, clipDuration, 2.4);
  }

  const threshold = Math.max(0.012, peak * 0.16);
  const rawSegments: SpeechSegment[] = [];
  let inSpeech = false;
  let segStartBin = 0;
  let silentBins = 0;
  const maxGapBins = 6; // allow 300ms pause inside same phrase

  for (let i = 0; i < binCount; i++) {
    const active = energies[i] >= threshold;
    if (active) {
      if (!inSpeech) {
        inSpeech = true;
        segStartBin = i;
      }
      silentBins = 0;
    } else if (inSpeech) {
      silentBins++;
      if (silentBins >= maxGapBins) {
        const endBin = i - silentBins + 1;
        const sTime = clipStartTime + (segStartBin * binSec) / safeSpeed;
        const eTime = clipStartTime + (endBin * binSec) / safeSpeed;
        if (eTime - sTime >= 0.45) {
          rawSegments.push({
            startTime: Number(sTime.toFixed(2)),
            duration: Number(Math.max(0.6, eTime - sTime).toFixed(2)),
          });
        }
        inSpeech = false;
        silentBins = 0;
      }
    }
  }

  if (inSpeech) {
    const sTime = clipStartTime + (segStartBin * binSec) / safeSpeed;
    const eTime = clipStartTime + clipDuration;
    if (eTime - sTime >= 0.4) {
      rawSegments.push({
        startTime: Number(sTime.toFixed(2)),
        duration: Number(Math.max(0.6, eTime - sTime).toFixed(2)),
      });
    }
  }

  if (rawSegments.length === 0) {
    return buildEvenSegments(clipStartTime, clipDuration, 2.4);
  }

  // Split any overly long continuous monologue chunk (> 3.4s) into bite-sized caption beats
  const splitSegments: SpeechSegment[] = [];
  for (const seg of rawSegments) {
    if (seg.duration <= 3.6) {
      splitSegments.push(seg);
    } else {
      const pieces = Math.ceil(seg.duration / 2.6);
      const step = seg.duration / pieces;
      for (let p = 0; p < pieces; p++) {
        splitSegments.push({
          startTime: Number((seg.startTime + p * step).toFixed(2)),
          duration: Number(Math.max(0.6, step - 0.05).toFixed(2)),
        });
      }
    }
  }

  return splitSegments;
}

function buildEvenSegments(
  startTime: number,
  totalDuration: number,
  chunkSec = 2.4
): SpeechSegment[] {
  const count = Math.max(1, Math.round(totalDuration / chunkSec));
  const step = totalDuration / count;
  const out: SpeechSegment[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      startTime: Number((startTime + i * step).toFixed(2)),
      duration: Number(Math.max(0.6, step - 0.06).toFixed(2)),
    });
  }
  return out;
}

/**
 * Aligns lines of text (or auto-splits a paragraph into short viral phrases) onto speech segments.
 */
export function buildTimedCaptionsFromScript(
  scriptText: string,
  segments: SpeechSegment[],
  fallbackStart: number,
  fallbackDuration: number
): TimedCaptionCue[] {
  let lines = scriptText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 1) {
    // Auto-chunk a single paragraph into 3-5 word viral caption phrases
    const words = lines[0].split(/\s+/).filter(Boolean);
    if (words.length > 5) {
      lines = [];
      for (let i = 0; i < words.length; i += 4) {
        lines.push(words.slice(i, i + 4).join(' '));
      }
    }
  }

  if (lines.length === 0) {
    return segments.map((seg, idx) => ({
      startTime: seg.startTime,
      duration: seg.duration,
      text: `Caption ${idx + 1}`,
    }));
  }

  if (segments.length === 0) {
    return buildEvenSegments(fallbackStart, Math.max(1.5, fallbackDuration), 2.2)
      .slice(0, lines.length)
      .map((seg, idx) => ({
        startTime: seg.startTime,
        duration: seg.duration,
        text: lines[idx] || '',
      }));
  }

  // Distribute lines cleanly across detected speech segments
  const activeStart = segments[0].startTime;
  const lastSeg = segments[segments.length - 1];
  const activeEnd = lastSeg.startTime + lastSeg.duration;

  if (lines.length <= segments.length) {
    return lines.map((text, idx) => {
      const seg = segments[idx];
      return {
        startTime: seg.startTime,
        duration: seg.duration,
        text,
      };
    });
  }

  // More lines than detected bursts: subdivide total active window proportionally
  const totalSpan = Math.max(1, activeEnd - activeStart);
  const step = totalSpan / lines.length;
  return lines.map((text, idx) => ({
    startTime: Number((activeStart + idx * step).toFixed(2)),
    duration: Number(Math.max(0.55, step - 0.05).toFixed(2)),
    text,
  }));
}
