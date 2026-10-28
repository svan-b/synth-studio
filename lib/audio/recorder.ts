// ============================================================================
// Recording: the master and stems to 24-bit WAV files.
//
// A Take records any number of taps (the master, every channel strip, the
// returns) with one 'recorder' worklet each. All of them get the same start and
// stop time, which the worklet turns into exact audio frames, so every file of a
// take starts on the same sample and has the same length. The master is recorded
// after the limiter, so it is shifted by the limiter's look-ahead to line up
// with the stems.
//
// Chunks are encoded to 24-bit as they arrive and kept as Blob parts (the
// browser can page those out), so long multitrack takes don't hold gigabytes of
// floats. Each file also gets a CRC-32 for zipping.
// ============================================================================

import { getAudioContext, getMasterLatencyFrames, getRecordTap, loadStudioWorklet } from './context';

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes: Uint8Array, crc = 0): number {
  let c = ~crc >>> 0;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
}

/** 44-byte WAV header for 24-bit stereo PCM */
export function wavHeader(frames: number, sampleRate: number, channels = 2): Uint8Array<ArrayBuffer> {
  const bytesPerSample = 3;
  const dataSize = frames * channels * bytesPerSample;
  const buf = new ArrayBuffer(44);
  const v = new DataView(buf);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF');
  v.setUint32(4, 36 + dataSize, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, channels, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * channels * bytesPerSample, true);
  v.setUint16(32, channels * bytesPerSample, true);
  v.setUint16(34, 24, true);
  str(36, 'data');
  v.setUint32(40, dataSize, true);
  return new Uint8Array(buf);
}

/** Interleaved 24-bit little-endian PCM of a stereo chunk (TPDF dither-free: 24 bits is below the noise floor) */
export function encodeInt24(l: Float32Array, r: Float32Array, gain = 1): Uint8Array<ArrayBuffer> {
  const n = l.length;
  const out = new Uint8Array(n * 6);
  let o = 0;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < 2; c++) {
      let x = (c === 0 ? l[i] : r[i]) * gain;
      if (!(x === x)) x = 0;
      x = x > 1 ? 1 : x < -1 ? -1 : x;
      const s = Math.round(x < 0 ? x * 0x800000 : x * 0x7fffff);
      out[o] = s & 0xff;
      out[o + 1] = (s >> 8) & 0xff;
      out[o + 2] = (s >> 16) & 0xff;
      o += 3;
    }
  }
  return out;
}

/** Incremental WAV writer: push float chunks, get a Blob. Keeps floats only when asked (normalising). */
export class WavStream {
  frames = 0;
  crc = 0;
  size = 0;
  private parts: BlobPart[] = [];
  private pendingBytes: Uint8Array<ArrayBuffer>[] = [];
  private pendingSize = 0;
  readonly floats: { l: Float32Array; r: Float32Array }[] | null;

  constructor(readonly sampleRate: number, opts: { keepFloats?: boolean } = {}) {
    this.floats = opts.keepFloats ? [] : null;
  }

  push(l: Float32Array, r: Float32Array) {
    if (this.floats) this.floats.push({ l, r });
    const bytes = encodeInt24(l, r);
    this.crc = crc32(bytes, this.crc);
    this.frames += l.length;
    this.size += bytes.length;
    this.pendingBytes.push(bytes);
    this.pendingSize += bytes.length;
    // Fold into Blobs every ~4 MB so the browser can move them out of the JS heap
    if (this.pendingSize > 4 << 20) this.fold();
  }

  private fold() {
    if (!this.pendingBytes.length) return;
    this.parts.push(new Blob(this.pendingBytes));
    this.pendingBytes = [];
    this.pendingSize = 0;
  }

  /** The PCM data (no header) as Blob parts */
  data(): BlobPart[] {
    this.fold();
    return this.parts;
  }

  /** A complete .wav file */
  blob(): Blob {
    return new Blob([wavHeader(this.frames, this.sampleRate), ...this.data()], { type: 'audio/wav' });
  }

  /** CRC-32 of the complete .wav file: crc(header) combined with the running crc of the data */
  fileCrc(): number {
    return crc32Combine(crc32(wavHeader(this.frames, this.sampleRate)), this.crc, this.size);
  }

  fileSize(): number {
    return 44 + this.size;
  }
}

// zlib's crc32_combine: CRC of A||B from crc(A), crc(B) and len(B)
function gf2Times(mat: Uint32Array, vec: number): number {
  let sum = 0;
  let i = 0;
  while (vec) {
    if (vec & 1) sum ^= mat[i];
    vec >>>= 1;
    i++;
  }
  return sum >>> 0;
}
function gf2Square(square: Uint32Array, mat: Uint32Array) {
  for (let n = 0; n < 32; n++) square[n] = gf2Times(mat, mat[n]);
}
export function crc32Combine(crc1: number, crc2: number, len2: number): number {
  if (len2 <= 0) return crc1;
  const even = new Uint32Array(32);
  const odd = new Uint32Array(32);
  odd[0] = 0xedb88320;
  let row = 1;
  for (let n = 1; n < 32; n++) { odd[n] = row; row <<= 1; }
  gf2Square(even, odd);
  gf2Square(odd, even);
  let c1 = crc1 >>> 0;
  let len = len2;
  do {
    gf2Square(even, odd);
    if (len & 1) c1 = gf2Times(even, c1);
    len = Math.floor(len / 2);
    if (!len) break;
    gf2Square(odd, even);
    if (len & 1) c1 = gf2Times(odd, c1);
    len = Math.floor(len / 2);
  } while (len);
  return (c1 ^ crc2) >>> 0;
}

export interface TakeTap {
  id: string;
  name: string;
  node: AudioNode;
  /** Record this many frames later (the master: the limiter's look-ahead) */
  offsetFrames?: number;
  keepFloats?: boolean;
}

export interface TakeTrack {
  id: string;
  name: string;
  wav: WavStream;
}

/** Several taps recorded sample-aligned between two audio times */
export class Take {
  private nodes: AudioWorkletNode[] = [];
  private sink: GainNode | null = null;
  readonly tracks: TakeTrack[];
  private done: Promise<void>[] = [];
  startTime = 0;
  stopTime = 0;

  constructor(private taps: TakeTap[]) {
    const sr = getAudioContext().sampleRate;
    this.tracks = taps.map(t => ({ id: t.id, name: t.name, wav: new WavStream(sr, { keepFloats: t.keepFloats }) }));
  }

  /** Arm every recorder to start at audio time `time` (>= 50 ms from now is safest) */
  async start(time?: number) {
    const ctx = getAudioContext();
    await loadStudioWorklet();
    this.sink = ctx.createGain();
    this.sink.gain.value = 0;
    this.sink.connect(ctx.destination);
    const t = time ?? ctx.currentTime + 0.1;
    this.startTime = t;
    this.taps.forEach((tap, i) => {
      const node = new AudioWorkletNode(ctx, 'recorder', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
        channelCount: 2,
        channelCountMode: 'explicit',
        channelInterpretation: 'speakers',
      });
      const track = this.tracks[i];
      this.done.push(new Promise<void>(resolve => {
        node.port.onmessage = e => {
          const d = e.data as { type: string; l: Float32Array; r: Float32Array };
          if (d.type === 'chunk') track.wav.push(d.l, d.r);
          else if (d.type === 'done') resolve();
        };
      }));
      tap.node.connect(node);
      node.connect(this.sink!);
      node.port.postMessage({ type: 'start', time: t, offset: tap.offsetFrames ?? 0 });
      this.nodes.push(node);
    });
  }

  elapsed(): number {
    return Math.max(0, getAudioContext().currentTime - this.startTime);
  }

  /** Stop every recorder at audio time `time` (default: now + 50 ms); resolves with the tracks */
  async stop(time?: number): Promise<TakeTrack[]> {
    const ctx = getAudioContext();
    const t = Math.max(this.startTime, time ?? ctx.currentTime + 0.05);
    this.stopTime = t;
    this.nodes.forEach((n, i) => n.port.postMessage({ type: 'stop', time: t, offset: this.taps[i].offsetFrames ?? 0 }));
    await Promise.all(this.done);
    this.nodes.forEach((n, i) => {
      try { this.taps[i].node.disconnect(n); } catch { /* */ }
      n.disconnect();
      n.port.onmessage = null;
    });
    this.nodes = [];
    this.sink?.disconnect();
    this.sink = null;
    return this.tracks;
  }
}

/** The master, recorded after the limiter and shifted to line up with stems */
export function masterTap(keepFloats = false): TakeTap {
  return { id: 'master', name: 'Master', node: getRecordTap(), offsetFrames: getMasterLatencyFrames(), keepFloats };
}

/** REC in the top bar: what you hear, to a WAV file */
export class MasterRecorder {
  private take: Take | null = null;
  recording = false;

  async start() {
    this.take = new Take([masterTap()]);
    this.recording = true;
    await this.take.start(getAudioContext().currentTime + 0.03);
  }

  elapsed(): number {
    return this.recording && this.take ? this.take.elapsed() : 0;
  }

  /** Stop and return a WAV blob */
  async stop(): Promise<Blob> {
    const take = this.take;
    this.take = null;
    this.recording = false;
    if (!take) return new Blob();
    const [track] = await take.stop();
    return track.wav.blob();
  }
}

/** Original helper: chunks -> 24-bit stereo WAV */
export function encodeWav(chunks: { l: Float32Array; r: Float32Array }[], sampleRate: number): Blob {
  const w = new WavStream(sampleRate);
  chunks.forEach(c => w.push(c.l, c.r));
  return w.blob();
}

export const masterRecorder = new MasterRecorder();
