import {
  BuiltinMusicId,
  BuiltinSfxId,
  MusicAsset,
  MusicClip,
  SoundEffectAsset,
} from '../types/editor';

let sharedAudioCtx: AudioContext | null = null;
const bufferCache = new Map<string, AudioBuffer>();

let previewAudioEl: HTMLAudioElement | null = null;
let previewSource: AudioBufferSourceNode | null = null;
let previewingId: string | null = null;
let previewToken = 0;

interface ActiveMusicNode {
  source: AudioBufferSourceNode;
  gain: GainNode;
  assetId: string;
}
const activeMusicNodes = new Map<string, ActiveMusicNode>();
let timelineMusicPlaying = false;

export function getAudioContext(): AudioContext {
  if (!sharedAudioCtx) {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    sharedAudioCtx = new AudioCtx();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

function synthesizeBuiltinSfx(
  ctx: BaseAudioContext,
  type: BuiltinSfxId
): AudioBuffer {
  const sampleRate = ctx.sampleRate;

  const makeBuf = (dur: number, fn: (data: Float32Array, len: number) => void) => {
    const len = Math.floor(sampleRate * dur);
    const buf = ctx.createBuffer(1, len, sampleRate);
    fn(buf.getChannelData(0), len);
    return buf;
  };

  switch (type) {
    case 'whoosh':
      return makeBuf(0.65, (data, len) => {
        let lp = 0;
        for (let i = 0; i < len; i++) {
          const t = i / sampleRate;
          const env = Math.sin((Math.PI * t) / 0.65) ** 1.4;
          const white = Math.random() * 2 - 1;
          const cutoff = 0.04 + 0.36 * Math.sin((Math.PI * t) / 0.65);
          lp += cutoff * (white - lp);
          data[i] = lp * env * 0.85;
        }
      });

    case 'swish':
      return makeBuf(0.32, (data, len) => {
        let lp = 0;
        let prev = 0;
        for (let i = 0; i < len; i++) {
          const t = i / sampleRate;
          const p = t / 0.32;
          const env = Math.sin(Math.PI * p) ** 1.2;
          const white = Math.random() * 2 - 1;
          lp += (0.12 + 0.45 * p) * (white - lp);
          const hp = lp - prev * 0.65;
          prev = lp;
          data[i] = hp * env * 0.9;
        }
      });

    case 'rewind':
      return makeBuf(0.6, (data, len) => {
        let phase = 0;
        for (let i = 0; i < len; i++) {
          const t = i / sampleRate;
          const p = t / 0.6;
          const freq = 260 + 1350 * Math.pow(p, 1.5) + Math.sin(t * 90) * 140;
          phase += (2 * Math.PI * freq) / sampleRate;
          const wobble = 0.7 + 0.3 * Math.sin(t * 75);
          const env = Math.sin(Math.PI * p) ** 0.7;
          const saw = (phase % (2 * Math.PI)) / Math.PI - 1;
          data[i] = saw * wobble * env * 0.55;
        }
      });

    case 'riser':
      return makeBuf(1.4, (data, len) => {
        let phase = 0;
        let lp = 0;
        for (let i = 0; i < len; i++) {
          const t = i / sampleRate;
          const p = t / 1.4;
          const freq = 140 + 820 * Math.pow(p, 2.1);
          phase += (2 * Math.PI * freq) / sampleRate;
          const white = Math.random() * 2 - 1;
          lp += (0.02 + p * 0.28) * (white - lp);
          const env = Math.pow(p, 1.7) * (p > 0.94 ? (1 - p) / 0.06 : 1);
          data[i] = (Math.sin(phase) * 0.42 + lp * 0.58) * env * 0.78;
        }
      });

    case 'boom':
      return makeBuf(1.1, (data, len) => {
        let phase = 0;
        for (let i = 0; i < len; i++) {
          const t = i / sampleRate;
          const freq = 130 * Math.exp(-t * 5.2) + 36;
          phase += (2 * Math.PI * freq) / sampleRate;
          const env = Math.exp(-t * 3.1) * Math.min(1, t / 0.008);
          const punch =
            Math.sin(phase) + 0.25 * Math.sin(phase * 2) * Math.exp(-t * 14);
          data[i] = Math.tanh(punch * 1.4) * env * 0.9;
        }
      });

    case 'vine-boom':
      return makeBuf(0.85, (data, len) => {
        let phase = 0;
        for (let i = 0; i < len; i++) {
          const t = i / sampleRate;
          const freq = 185 * Math.exp(-t * 16) + 48;
          phase += (2 * Math.PI * freq) / sampleRate;
          const env = Math.exp(-t * 4.4) * Math.min(1, t / 0.003);
          const sub = Math.sin(phase) + 0.4 * Math.sin(phase * 1.5) * Math.exp(-t * 12);
          const snap = (Math.random() * 2 - 1) * Math.exp(-t * 85) * 0.4;
          data[i] = Math.tanh((sub + snap) * 1.75) * env * 0.92;
        }
      });

    case 'punch':
      return makeBuf(0.28, (data, len) => {
        let phase = 0;
        for (let i = 0; i < len; i++) {
          const t = i / sampleRate;
          const freq = 260 * Math.exp(-t * 28) + 62;
          phase += (2 * Math.PI * freq) / sampleRate;
          const env = Math.exp(-t * 14) * Math.min(1, t / 0.002);
          const crack = (Math.random() * 2 - 1) * Math.exp(-t * 50) * 0.45;
          data[i] = Math.tanh((Math.sin(phase) + crack) * 1.5) * env * 0.9;
        }
      });

    case 'slam':
      return makeBuf(0.95, (data, len) => {
        let phase = 0;
        let lp = 0;
        for (let i = 0; i < len; i++) {
          const t = i / sampleRate;
          const freq = 150 * Math.exp(-t * 8) + 42;
          phase += (2 * Math.PI * freq) / sampleRate;
          const white = Math.random() * 2 - 1;
          lp += 0.25 * (white - lp);
          const metal =
            Math.sin(2 * Math.PI * 340 * t) * 0.25 +
            Math.sin(2 * Math.PI * 515 * t) * 0.18;
          const env = Math.exp(-t * 3.8) * Math.min(1, t / 0.004);
          data[i] =
            Math.tanh((Math.sin(phase) + lp * 0.65 + metal * Math.exp(-t * 9)) * 1.35) *
            env *
            0.88;
        }
      });

    case 'pop':
      return makeBuf(0.18, (data, len) => {
        let phase = 0;
        for (let i = 0; i < len; i++) {
          const t = i / sampleRate;
          const freq = 380 + 520 * Math.exp(-t * 28);
          phase += (2 * Math.PI * freq) / sampleRate;
          const env = Math.exp(-t * 24) * Math.min(1, t / 0.003);
          data[i] = Math.sin(phase) * env * 0.8;
        }
      });

    case 'click':
      return makeBuf(0.08, (data, len) => {
        for (let i = 0; i < len; i++) {
          const t = i / sampleRate;
          const env = Math.exp(-t * 95) * Math.min(1, t / 0.001);
          const tick =
            Math.sin(2 * Math.PI * 1850 * t) * 0.6 +
            Math.sin(2 * Math.PI * 3400 * t) * 0.35;
          data[i] = tick * env * 0.85;
        }
      });

    case 'typing':
      return makeBuf(0.45, (data, len) => {
        const hits = [0.01, 0.09, 0.16, 0.25, 0.33];
        for (let i = 0; i < len; i++) {
          const t = i / sampleRate;
          let sum = 0;
          for (let h = 0; h < hits.length; h++) {
            const dt = t - hits[h];
            if (dt >= 0 && dt < 0.05) {
              const e = Math.exp(-dt * 110);
              const tone = Math.sin(2 * Math.PI * (1200 + h * 110) * dt);
              const click = (Math.random() * 2 - 1) * 0.45;
              sum += (tone * 0.55 + click) * e;
            }
          }
          data[i] = Math.tanh(sum) * 0.78;
        }
      });

    case 'cash':
      return makeBuf(0.7, (data, len) => {
        for (let i = 0; i < len; i++) {
          const t = i / sampleRate;
          const n1 =
            Math.sin(2 * Math.PI * 1975.5 * t) *
            Math.exp(-t * 14) *
            Math.min(1, t / 0.003);
          const t2 = Math.max(0, t - 0.09);
          const n2 =
            t >= 0.09
              ? (Math.sin(2 * Math.PI * 2637 * t2) * 0.7 +
                  Math.sin(2 * Math.PI * 5274 * t2) * 0.25) *
                Math.exp(-t2 * 6.5) *
                Math.min(1, t2 / 0.003)
              : 0;
          data[i] = (n1 * 0.65 + n2 * 0.85) * 0.72;
        }
      });

    case 'flash':
      return makeBuf(0.35, (data, len) => {
        for (let i = 0; i < len; i++) {
          const t = i / sampleRate;
          const env = Math.exp(-t * 14) * Math.min(1, t / 0.002);
          const click = Math.sin(2 * Math.PI * 1900 * t) * Math.exp(-t * 45);
          const noise = (Math.random() * 2 - 1) * 0.55;
          data[i] = (click + noise) * env * 0.75;
        }
      });

    case 'ding':
      return makeBuf(0.75, (data, len) => {
        for (let i = 0; i < len; i++) {
          const t = i / sampleRate;
          const env = Math.exp(-t * 5.5) * Math.min(1, t / 0.004);
          const tone =
            Math.sin(2 * Math.PI * 1046.5 * t) * 0.6 +
            Math.sin(2 * Math.PI * 1567.98 * t) * 0.35 +
            Math.sin(2 * Math.PI * 2093 * t) * 0.15;
          data[i] = tone * env * 0.65;
        }
      });

    case 'wrong':
      return makeBuf(0.55, (data, len) => {
        for (let i = 0; i < len; i++) {
          const t = i / sampleRate;
          const pulse = t < 0.22 ? 1 : t >= 0.26 && t < 0.52 ? 1 : 0;
          const f = t < 0.24 ? 155 : 138;
          const saw1 = ((t * f) % 1) * 2 - 1;
          const saw2 = ((t * (f * 1.04)) % 1) * 2 - 1;
          const env = pulse * Math.min(1, t / 0.01) * Math.exp(-Math.max(0, t - 0.26) * 4);
          data[i] = (saw1 + saw2) * 0.32 * env;
        }
      });

    case 'record-scratch':
      return makeBuf(0.48, (data, len) => {
        let phase = 0;
        for (let i = 0; i < len; i++) {
          const t = i / sampleRate;
          const p = t / 0.48;
          const freq = 950 - 760 * Math.pow(p, 0.75) + Math.sin(t * 115) * 240;
          phase += (2 * Math.PI * Math.max(80, freq)) / sampleRate;
          const grit = (Math.random() * 2 - 1) * 0.28;
          const env = Math.exp(-t * 4.8) * Math.min(1, t / 0.005);
          data[i] = Math.tanh((Math.sin(phase) + grit) * 1.6) * env * 0.72;
        }
      });

    case 'boing':
      return makeBuf(0.5, (data, len) => {
        let phase = 0;
        for (let i = 0; i < len; i++) {
          const t = i / sampleRate;
          const freq = 240 + 280 * Math.sin(t * 28) * Math.exp(-t * 3.5) + t * 220;
          phase += (2 * Math.PI * freq) / sampleRate;
          const env = Math.exp(-t * 4.5) * Math.min(1, t / 0.008);
          data[i] = Math.sin(phase) * env * 0.75;
        }
      });

    case 'sparkle':
      return makeBuf(0.85, (data, len) => {
        const notes = [1046.5, 1318.5, 1568, 2093, 2637];
        for (let i = 0; i < len; i++) {
          const t = i / sampleRate;
          let sum = 0;
          for (let n = 0; n < notes.length; n++) {
            const dt = t - n * 0.07;
            if (dt >= 0) {
              const e = Math.exp(-dt * 5.2) * Math.min(1, dt / 0.005);
              sum += Math.sin(2 * Math.PI * notes[n] * dt) * e * 0.35;
            }
          }
          data[i] = sum * 0.85;
        }
      });

    case 'bleep':
      return makeBuf(0.45, (data, len) => {
        for (let i = 0; i < len; i++) {
          const t = i / sampleRate;
          const fadeIn = Math.min(1, t / 0.008);
          const fadeOut = Math.min(1, (0.45 - t) / 0.015);
          data[i] = Math.sin(2 * Math.PI * 1000 * t) * fadeIn * fadeOut * 0.45;
        }
      });

    case 'glitch':
      return makeBuf(0.36, (data, len) => {
        const stepSamples = Math.floor(sampleRate * 0.018);
        let held = 0;
        for (let i = 0; i < len; i++) {
          const t = i / sampleRate;
          if (i % stepSamples === 0) {
            held = (Math.random() * 2 - 1) * (Math.random() > 0.3 ? 1 : 0.2);
          }
          const zap = Math.sin(2 * Math.PI * (320 + (i % 900)) * t) * 0.45;
          const env = Math.exp(-t * 5.5) * Math.min(1, t / 0.003);
          data[i] = Math.tanh((held * 0.65 + zap) * 1.4) * env * 0.7;
        }
      });

    case 'alert':
      return makeBuf(0.8, (data, len) => {
        for (let i = 0; i < len; i++) {
          const t = i / sampleRate;
          const inPulse1 = t < 0.28;
          const inPulse2 = t >= 0.38 && t < 0.72;
          if (!inPulse1 && !inPulse2) {
            data[i] = 0;
            continue;
          }
          const lt = inPulse1 ? t : t - 0.38;
          const freq = 760 + 240 * Math.sin(lt * 22);
          const env = Math.min(1, lt / 0.01) * Math.exp(-lt * 4.5);
          data[i] =
            (Math.sin(2 * Math.PI * freq * lt) * 0.7 +
              Math.sin(2 * Math.PI * freq * 1.5 * lt) * 0.25) *
            env *
            0.55;
        }
      });

    case 'heartbeat':
      return makeBuf(0.9, (data, len) => {
        const beats = [0.02, 0.28];
        let p1 = 0;
        let p2 = 0;
        for (let i = 0; i < len; i++) {
          const t = i / sampleRate;
          let sum = 0;
          const dt1 = t - beats[0];
          if (dt1 >= 0) {
            const f1 = 95 * Math.exp(-dt1 * 12) + 42;
            p1 += (2 * Math.PI * f1) / sampleRate;
            sum += Math.sin(p1) * Math.exp(-dt1 * 9) * Math.min(1, dt1 / 0.008);
          }
          const dt2 = t - beats[1];
          if (dt2 >= 0) {
            const f2 = 82 * Math.exp(-dt2 * 13) + 38;
            p2 += (2 * Math.PI * f2) / sampleRate;
            sum +=
              Math.sin(p2) *
              0.78 *
              Math.exp(-dt2 * 10) *
              Math.min(1, dt2 / 0.008);
          }
          data[i] = Math.tanh(sum * 1.5) * 0.92;
        }
      });

    case 'news-stinger':
      return makeBuf(0.9, (data, len) => {
        // Iconic 3-note broadcast chime + warm swoosh bed
        const hits = [
          { t: 0.0, f: 523.25 },
          { t: 0.14, f: 659.25 },
          { t: 0.28, f: 783.99 },
        ];
        for (let i = 0; i < len; i++) {
          const t = i / sampleRate;
          let tone = 0;
          for (const h of hits) {
            const dt = t - h.t;
            if (dt >= 0) {
              const e = Math.exp(-dt * 5.8) * Math.min(1, dt / 0.004);
              tone +=
                (Math.sin(2 * Math.PI * h.f * dt) * 0.65 +
                  Math.sin(2 * Math.PI * h.f * 2 * dt) * 0.22) *
                e;
            }
          }
          const subHit =
            Math.sin(2 * Math.PI * (120 * Math.exp(-t * 14) + 55) * t) *
            Math.exp(-t * 8) *
            0.45;
          data[i] = Math.tanh(tone * 0.6 + subHit) * 0.85;
        }
      });

    case 'news-ticker':
      return makeBuf(0.38, (data, len) => {
        // Crisp 3-pulse news teleprinter headline beep
        const pulses = [0.0, 0.11, 0.22];
        for (let i = 0; i < len; i++) {
          const t = i / sampleRate;
          let sum = 0;
          for (const p of pulses) {
            const dt = t - p;
            if (dt >= 0 && dt < 0.075) {
              const e = Math.min(1, dt / 0.002) * Math.exp(-dt * 32);
              sum += Math.sin(2 * Math.PI * 1760 * dt) * e;
            }
          }
          data[i] = sum * 0.6;
        }
      });
  }
}

function synthesizeBuiltinMusic(
  ctx: BaseAudioContext,
  type: BuiltinMusicId
): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const dur = 6.0;
  const len = Math.floor(sampleRate * dur);
  const buf = ctx.createBuffer(1, len, sampleRate);
  const data = buf.getChannelData(0);

  const smoothLoopEdge = (t: number) =>
    Math.min(1, t / 0.025) * Math.min(1, (dur - t) / 0.025);

  switch (type) {
    case 'horror-drone': {
      // Dark dissonant sub drone + eerie high cluster
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / sampleRate;
        const lfo = 0.7 + 0.3 * Math.sin((2 * Math.PI * t) / 3.0);
        const sub =
          Math.sin(2 * Math.PI * 55 * t) * 0.55 +
          Math.sin(2 * Math.PI * 58.3 * t) * 0.35; // ominous minor 2nd beat
        const eerie =
          Math.sin(2 * Math.PI * 440 * t + Math.sin(t * 2.5) * 1.5) *
          0.12 *
          (0.5 + 0.5 * Math.sin(t * 1.05));
        const wind = Math.random() * 2 - 1;
        lp += 0.015 * (wind - lp);
        data[i] =
          Math.tanh((sub * lfo + eerie + lp * 0.4) * 1.1) *
          0.65 *
          smoothLoopEdge(t);
      }
      break;
    }

    case 'suspense-pulse': {
      // Creepy ticking pizzicato minor arpeggio + sub pulse
      const notes = [146.83, 155.56, 174.61, 146.83, 220, 174.61, 155.56, 138.59];
      const step = 0.375;
      for (let i = 0; i < len; i++) {
        const t = i / sampleRate;
        const stepIdx = Math.floor(t / step) % notes.length;
        const lt = t % step;
        const freq = notes[stepIdx];
        const pluck =
          (Math.sin(2 * Math.PI * freq * lt) +
            0.35 * Math.sin(2 * Math.PI * freq * 2 * lt)) *
          Math.exp(-lt * 8.5) *
          Math.min(1, lt / 0.004);
        const subTick =
          Math.sin(2 * Math.PI * 55 * t) *
          0.35 *
          (0.6 + 0.4 * Math.sin((2 * Math.PI * t) / 1.5));
        const clock =
          lt < 0.03
            ? (Math.random() * 2 - 1) * Math.exp(-lt * 140) * 0.2
            : 0;
        data[i] = (pluck * 0.5 + subTick + clock) * 0.72 * smoothLoopEdge(t);
      }
      break;
    }

    case 'chase-tension': {
      // Fast driving thriller 160bpm minor bass pulse
      const step = 0.1875;
      const bassNotes = [73.42, 73.42, 87.31, 73.42, 98, 87.31, 82.41, 73.42];
      for (let i = 0; i < len; i++) {
        const t = i / sampleRate;
        const idx = Math.floor(t / step) % bassNotes.length;
        const lt = t % step;
        const f = bassNotes[idx];
        const saw = ((lt * f) % 1) * 2 - 1;
        const bass =
          (Math.sin(2 * Math.PI * f * lt) * 0.65 + saw * 0.25) *
          Math.exp(-lt * 6.5) *
          Math.min(1, lt / 0.004);
        const beatT = t % 0.375;
        const kick =
          Math.sin(2 * Math.PI * (120 * Math.exp(-beatT * 24) + 48) * beatT) *
          Math.exp(-beatT * 14) *
          0.55;
        data[i] = Math.tanh(bass + kick) * 0.68 * smoothLoopEdge(t);
      }
      break;
    }

    case 'happy-upbeat': {
      // Sunny major chord bounce (C - G - Am - F feel)
      const chords = [
        [261.63, 329.63, 392.0],
        [196.0, 246.94, 293.66],
        [220.0, 261.63, 329.63],
        [174.61, 220.0, 261.63],
      ];
      const bar = 1.5;
      for (let i = 0; i < len; i++) {
        const t = i / sampleRate;
        const cIdx = Math.floor(t / bar) % chords.length;
        const chord = chords[cIdx];
        const beatT = t % 0.375;
        const env = Math.exp(-beatT * 4.5) * Math.min(1, beatT / 0.008);
        let pad = 0;
        for (const f of chord) {
          pad += Math.sin(2 * Math.PI * f * t) * 0.25;
        }
        const bassF = chord[0] / 2;
        const bass =
          Math.sin(2 * Math.PI * bassF * t) *
          0.42 *
          Math.exp(-beatT * 3.5);
        const hat =
          beatT > 0.18 && beatT < 0.24
            ? (Math.random() * 2 - 1) * Math.exp(-(beatT - 0.18) * 65) * 0.14
            : 0;
        data[i] = (pad * env + bass + hat) * 0.72 * smoothLoopEdge(t);
      }
      break;
    }

    case 'victory-groove': {
      // Bright celebratory synth + uplifting arpeggio
      const arp = [523.25, 659.25, 783.99, 1046.5, 783.99, 659.25];
      const step = 0.25;
      for (let i = 0; i < len; i++) {
        const t = i / sampleRate;
        const lt = t % step;
        const f = arp[Math.floor(t / step) % arp.length];
        const bell =
          (Math.sin(2 * Math.PI * f * lt) * 0.6 +
            Math.sin(2 * Math.PI * f * 2 * lt) * 0.2) *
          Math.exp(-lt * 6) *
          Math.min(1, lt / 0.005);
        const beat = t % 0.5;
        const groove =
          Math.sin(2 * Math.PI * 130.81 * t) * 0.35 +
          Math.sin(2 * Math.PI * (140 * Math.exp(-beat * 26) + 55) * beat) *
            Math.exp(-beat * 12) *
            0.45;
        data[i] = Math.tanh(bell * 0.55 + groove) * 0.66 * smoothLoopEdge(t);
      }
      break;
    }

    case 'phonk-drive': {
      // Iconic Memphis cowbell melody + heavy 808 + crisp hats
      const cowbellNotes = [587.33, 587.33, 698.46, 523.25, 587.33, 440, 523.25, 587.33];
      const step = 0.375;
      for (let i = 0; i < len; i++) {
        const t = i / sampleRate;
        const lt = t % step;
        const cf = cowbellNotes[Math.floor(t / step) % cowbellNotes.length];
        const cowbell =
          (Math.sin(2 * Math.PI * cf * lt) +
            Math.sin(2 * Math.PI * cf * 1.48 * lt) * 0.7) *
          Math.exp(-lt * 11) *
          Math.min(1, lt / 0.002);
        const beat = t % 0.75;
        const kick808 =
          Math.sin(2 * Math.PI * (110 * Math.exp(-beat * 18) + 44) * beat) *
          Math.exp(-beat * 3.8) *
          0.85;
        const hatT = t % 0.1875;
        const hat = (Math.random() * 2 - 1) * Math.exp(-hatT * 70) * 0.16;
        data[i] =
          Math.tanh((cowbell * 0.42 + kick808 + hat) * 1.65) *
          0.62 *
          smoothLoopEdge(t);
      }
      break;
    }

    case 'motivation-epic': {
      // Warm cinematic brass-pad + driving cinematic pulse
      const roots = [110, 87.31, 130.81, 98];
      for (let i = 0; i < len; i++) {
        const t = i / sampleRate;
        const r = roots[Math.floor(t / 1.5) % roots.length];
        const pad =
          Math.sin(2 * Math.PI * r * t) * 0.45 +
          Math.sin(2 * Math.PI * (r * 1.5) * t) * 0.28 +
          Math.sin(2 * Math.PI * (r * 2) * t) * 0.22;
        const beat = t % 0.5;
        const tom =
          Math.sin(2 * Math.PI * (95 * Math.exp(-beat * 12) + 52) * beat) *
          Math.exp(-beat * 7.5) *
          0.55;
        data[i] = Math.tanh(pad * 0.75 + tom) * 0.65 * smoothLoopEdge(t);
      }
      break;
    }

    case 'lofi-chill': {
      // Warm Rhodes-style jazzy chords + soft vinyl crackle
      const chords = [
        [220, 261.63, 329.63, 392],
        [174.61, 220, 261.63, 329.63],
      ];
      for (let i = 0; i < len; i++) {
        const t = i / sampleRate;
        const barT = t % 3.0;
        const ch = chords[Math.floor(t / 3.0) % chords.length];
        const env = Math.min(1, barT / 0.08) * Math.exp(-barT * 0.55);
        let rhodes = 0;
        for (const f of ch) {
          rhodes +=
            Math.sin(2 * Math.PI * f * t + Math.sin(t * 2.1) * 0.15) * 0.22;
        }
        const beat = t % 0.75;
        const softKick =
          Math.sin(2 * Math.PI * (90 * Math.exp(-beat * 20) + 46) * beat) *
          Math.exp(-beat * 12) *
          0.35;
        const crackle = Math.random() > 0.992 ? (Math.random() * 2 - 1) * 0.18 : 0;
        data[i] = (rhodes * env + softKick + crackle) * 0.68 * smoothLoopEdge(t);
      }
      break;
    }

    case 'sad-piano': {
      // Gentle melancholic minor piano arpeggio (Am - F - C - G)
      const notes = [
        220, 329.63, 440, 329.63,
        174.61, 261.63, 349.23, 261.63,
        130.81, 261.63, 329.63, 261.63,
        196.0, 246.94, 293.66, 246.94,
      ];
      const step = 0.375;
      for (let i = 0; i < len; i++) {
        const t = i / sampleRate;
        const idx = Math.floor(t / step) % notes.length;
        const lt = t % step;
        const f = notes[idx];
        const piano =
          (Math.sin(2 * Math.PI * f * lt) * 0.65 +
            Math.sin(2 * Math.PI * f * 2 * lt) * 0.22 * Math.exp(-lt * 6)) *
          Math.exp(-lt * 2.6) *
          Math.min(1, lt / 0.006);
        const warmBass = Math.sin(2 * Math.PI * (notes[Math.floor(idx / 4) * 4] / 2) * t) * 0.22;
        data[i] = (piano + warmBass) * 0.72 * smoothLoopEdge(t);
      }
      break;
    }

    case 'dramatic-choir': {
      // Deep emotional swelling string/choir minor chord
      const chords = [
        [146.83, 174.61, 220, 293.66],
        [130.81, 164.81, 196, 261.63],
      ];
      for (let i = 0; i < len; i++) {
        const t = i / sampleRate;
        const ch = chords[Math.floor(t / 3.0) % chords.length];
        const barT = t % 3.0;
        const swell = Math.sin((Math.PI * barT) / 3.0) ** 0.6;
        let pad = 0;
        for (const f of ch) {
          pad +=
            (Math.sin(2 * Math.PI * f * t) +
              0.35 * Math.sin(2 * Math.PI * (f * 1.004) * t)) *
            0.18;
        }
        data[i] = pad * swell * 0.75 * smoothLoopEdge(t);
      }
      break;
    }

    case 'quirky-comedy': {
      // Bouncy playful pizzicato melody
      const notes = [392, 493.88, 587.33, 493.88, 659.25, 587.33, 493.88, 392];
      const step = 0.25;
      for (let i = 0; i < len; i++) {
        const t = i / sampleRate;
        const lt = t % step;
        const f = notes[Math.floor(t / step) % notes.length];
        const pitchBend = f * (1 + 0.06 * Math.exp(-lt * 25));
        const pluck =
          Math.sin(2 * Math.PI * pitchBend * lt) *
          Math.exp(-lt * 10) *
          Math.min(1, lt / 0.003);
        const bass =
          Math.sin(2 * Math.PI * 196 * (t % 0.5)) *
          Math.exp(-(t % 0.5) * 9) *
          0.35;
        data[i] = (pluck * 0.65 + bass) * 0.72 * smoothLoopEdge(t);
      }
      break;
    }

    case 'sneaky-tip': {
      // Classic cartoon creeping bassline
      const walk = [130.81, 146.83, 155.56, 174.61, 196, 174.61, 155.56, 146.83];
      const step = 0.375;
      for (let i = 0; i < len; i++) {
        const t = i / sampleRate;
        const lt = t % step;
        const f = walk[Math.floor(t / step) % walk.length];
        const stepNote =
          (Math.sin(2 * Math.PI * f * lt) * 0.7 +
            Math.sin(2 * Math.PI * f * 2 * lt) * 0.2) *
          Math.exp(-lt * 9.5) *
          Math.min(1, lt / 0.004);
        data[i] = stepNote * 0.75 * smoothLoopEdge(t);
      }
      break;
    }

    case 'news-breaking': {
      // Classic urgent broadcast newsroom arpeggio + brass chords + ticker pulse
      const arp = [293.66, 440, 587.33, 440, 349.23, 440, 587.33, 523.25];
      const step = 0.1875;
      for (let i = 0; i < len; i++) {
        const t = i / sampleRate;
        const lt = t % step;
        const f = arp[Math.floor(t / step) % arp.length];
        const synth =
          (Math.sin(2 * Math.PI * f * lt) * 0.55 +
            (((lt * f) % 1) * 2 - 1) * 0.18) *
          Math.exp(-lt * 8.5) *
          Math.min(1, lt / 0.003);
        const barT = t % 1.5;
        const brass =
          (Math.sin(2 * Math.PI * 146.83 * t) * 0.4 +
            Math.sin(2 * Math.PI * 220 * t) * 0.25) *
          Math.exp(-barT * 1.8) *
          Math.min(1, barT / 0.02);
        const beat = t % 0.375;
        const snareTick =
          beat < 0.04 ? (Math.random() * 2 - 1) * Math.exp(-beat * 90) * 0.16 : 0;
        data[i] =
          Math.tanh((synth * 0.55 + brass + snareTick) * 1.25) *
          0.66 *
          smoothLoopEdge(t);
      }
      break;
    }

    case 'news-report': {
      // Steady investigative journalism marimba/synth pulse + authoritative bass
      const notes = [261.63, 392, 329.63, 392, 293.66, 392, 329.63, 440];
      const step = 0.25;
      for (let i = 0; i < len; i++) {
        const t = i / sampleRate;
        const lt = t % step;
        const f = notes[Math.floor(t / step) % notes.length];
        const marimba =
          (Math.sin(2 * Math.PI * f * lt) * 0.65 +
            Math.sin(2 * Math.PI * f * 4 * lt) * 0.12 * Math.exp(-lt * 25)) *
          Math.exp(-lt * 7.5) *
          Math.min(1, lt / 0.004);
        const bass = Math.sin(2 * Math.PI * 65.41 * t) * 0.32;
        data[i] = (marimba * 0.55 + bass) * 0.68 * smoothLoopEdge(t);
      }
      break;
    }

    case 'news-urgent': {
      // Fast tense headline countdown pulse
      const step = 0.15;
      for (let i = 0; i < len; i++) {
        const t = i / sampleRate;
        const idx = Math.floor(t / step);
        const lt = t % step;
        const f = idx % 4 === 0 ? 587.33 : 440;
        const blip =
          Math.sin(2 * Math.PI * f * lt) *
          Math.exp(-lt * 16) *
          Math.min(1, lt / 0.002) *
          0.42;
        const beat = t % 0.6;
        const sub =
          Math.sin(2 * Math.PI * (110 * Math.exp(-beat * 18) + 48) * beat) *
          Math.exp(-beat * 8) *
          0.65;
        data[i] = Math.tanh(blip + sub) * 0.68 * smoothLoopEdge(t);
      }
      break;
    }
  }

  return buf;
}

export async function getSfxBuffer(
  asset: SoundEffectAsset,
  ctx?: BaseAudioContext
): Promise<AudioBuffer | null> {
  const audioCtx = ctx || getAudioContext();
  const cacheKey = `${asset.id}-${audioCtx.sampleRate}`;
  const cached = bufferCache.get(cacheKey);
  if (cached) return cached;

  if (asset.srcUrl) {
    try {
      const res = await fetch(asset.srcUrl);
      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        const decoded = await audioCtx.decodeAudioData(arrayBuf);
        bufferCache.set(cacheKey, decoded);
        return decoded;
      }
    } catch {
      // Fall back to local synthesizer if offline
    }
  }

  if (asset.kind === 'builtin' && asset.builtinSfx) {
    const buf = synthesizeBuiltinSfx(audioCtx, asset.builtinSfx);
    bufferCache.set(cacheKey, buf);
    return buf;
  }

  return null;
}

export async function getMusicBuffer(
  asset: MusicAsset,
  ctx?: BaseAudioContext
): Promise<AudioBuffer | null> {
  const audioCtx = ctx || getAudioContext();
  const cacheKey = `${asset.id}-${audioCtx.sampleRate}`;
  const cached = bufferCache.get(cacheKey);
  if (cached) return cached;

  if (asset.srcUrl) {
    try {
      const res = await fetch(asset.srcUrl);
      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        const decoded = await audioCtx.decodeAudioData(arrayBuf);
        bufferCache.set(cacheKey, decoded);
        return decoded;
      }
    } catch {
      // Fall back to local synthesizer if offline
    }
  }

  if (asset.kind === 'builtin' && asset.builtinMusic) {
    const buf = synthesizeBuiltinMusic(audioCtx, asset.builtinMusic);
    bufferCache.set(cacheKey, buf);
    return buf;
  }

  return null;
}

export async function playSfxNow(
  asset: SoundEffectAsset,
  volume = 0.85,
  offsetSeconds = 0
): Promise<void> {
  const ctx = getAudioContext();
  const buffer = await getSfxBuffer(asset, ctx);
  if (!buffer) return;

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const gain = ctx.createGain();
  gain.gain.value = Math.max(0, Math.min(1.5, volume));

  source.connect(gain);
  gain.connect(ctx.destination);

  const safeOffset = Math.max(0, Math.min(buffer.duration - 0.02, offsetSeconds));
  source.start(0, safeOffset);
}

export function stopPreviewAudio(): void {
  previewToken++;
  previewingId = null;

  if (previewAudioEl) {
    try {
      previewAudioEl.pause();
      previewAudioEl.currentTime = 0;
      previewAudioEl.removeAttribute('src');
      previewAudioEl.load();
    } catch {
      // Ignore cleanup errors
    }
    previewAudioEl = null;
  }

  if (previewSource) {
    try {
      previewSource.stop();
    } catch {
      // Ignore already stopped
    }
    previewSource.disconnect();
    previewSource = null;
  }
}

export function getPreviewingMusicId(): string | null {
  return previewingId;
}

export async function togglePreviewMusic(
  asset: MusicAsset,
  volume = 0.5
): Promise<string | null> {
  if (previewingId === asset.id) {
    stopPreviewAudio();
    return null;
  }

  stopPreviewAudio();
  const myToken = previewToken;
  previewingId = asset.id;

  // Stream MP3 directly via HTMLAudioElement for instant start and guaranteed stop
  if (asset.srcUrl) {
    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.loop = true;
    audio.volume = Math.max(0, Math.min(1, volume));
    audio.src = asset.srcUrl;
    previewAudioEl = audio;

    try {
      await audio.play();
      if (myToken !== previewToken || previewingId !== asset.id) {
        audio.pause();
        audio.removeAttribute('src');
        return null;
      }
      return asset.id;
    } catch {
      if (myToken !== previewToken || previewingId !== asset.id) {
        return null;
      }
      // Fall back to synthesized buffer if URL failed
      if (previewAudioEl === audio) {
        previewAudioEl = null;
      }
    }
  }

  const ctx = getAudioContext();
  const buffer = await getMusicBuffer(asset, ctx);
  if (!buffer || myToken !== previewToken || previewingId !== asset.id) {
    if (myToken === previewToken) previewingId = null;
    return null;
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;

  const gain = ctx.createGain();
  gain.gain.value = Math.max(0, Math.min(1.2, volume));

  source.connect(gain);
  gain.connect(ctx.destination);
  source.start(0);

  previewSource = source;
  return asset.id;
}

export function stopAllActiveMusic(): void {
  timelineMusicPlaying = false;
  activeMusicNodes.forEach((node) => {
    try {
      node.source.stop();
    } catch {
      // Ignore
    }
    node.source.disconnect();
    node.gain.disconnect();
  });
  activeMusicNodes.clear();
}

export function syncActiveMusicPlayback(
  isPlaying: boolean,
  timelineTime: number,
  musicClips: MusicClip[],
  musicById: Map<string, MusicAsset>
): void {
  timelineMusicPlaying = isPlaying;
  if (!isPlaying) {
    stopAllActiveMusic();
    return;
  }

  const activeIds = new Set<string>();
  for (const clip of musicClips) {
    const inRange =
      timelineTime >= clip.startTime &&
      timelineTime < clip.startTime + clip.duration;
    if (!inRange) continue;
    activeIds.add(clip.id);

    const existing = activeMusicNodes.get(clip.id);
    if (existing) {
      existing.gain.gain.value = Math.max(0, Math.min(1.2, clip.volume));
      continue;
    }

    const asset = musicById.get(clip.musicAssetId);
    if (!asset) continue;

    // Reserve slot immediately so async decode doesn't double-start
    const ctx = getAudioContext();
    const dummyGain = ctx.createGain();
    const dummySrc = ctx.createBufferSource();
    activeMusicNodes.set(clip.id, {
      source: dummySrc,
      gain: dummyGain,
      assetId: asset.id,
    });

    void getMusicBuffer(asset, ctx).then((buffer) => {
      const current = activeMusicNodes.get(clip.id);
      if (
        !timelineMusicPlaying ||
        !buffer ||
        !current ||
        current.source !== dummySrc
      ) {
        return;
      }

      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      const gain = ctx.createGain();
      gain.gain.value = Math.max(0, Math.min(1.2, clip.volume));
      src.connect(gain);
      gain.connect(ctx.destination);

      const offset =
        (((timelineTime - clip.startTime) % buffer.duration) + buffer.duration) %
        buffer.duration;
      src.start(0, offset);
      activeMusicNodes.set(clip.id, {
        source: src,
        gain,
        assetId: asset.id,
      });
    });
  }

  // Stop any clips no longer active
  Array.from(activeMusicNodes.keys()).forEach((id) => {
    if (!activeIds.has(id)) {
      const node = activeMusicNodes.get(id);
      if (node) {
        try {
          node.source.stop();
        } catch {
          // Ignore
        }
        node.source.disconnect();
        node.gain.disconnect();
      }
      activeMusicNodes.delete(id);
    }
  });
}
