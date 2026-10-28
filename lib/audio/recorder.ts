// ============================================================================
// Master recorder - bounce the studio to a 24-bit WAV file
// ============================================================================

import { getAudioContext, getRecordTap } from './context';

const URL_ = '/worklets/studio-processors.js';
let loaded: Promise<void> | null = null;

export class MasterRecorder {
  private node: AudioWorkletNode | null = null;
  private chunks: { l: Float32Array; r: Float32Array }[] = [];
  private startedAt = 0;
  recording = false;

  async start() {
    const ctx = getAudioContext();
    if (!loaded) loaded = ctx.audioWorklet.addModule(URL_);
    await loaded;
    this.chunks = [];
    this.node = new AudioWorkletNode(ctx, 'recorder', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2], channelCount: 2, channelCountMode: 'explicit' });
    this.node.port.onmessage = e => {
      if (e.data.type === 'chunk') this.chunks.push({ l: e.data.l, r: e.data.r });
    };
    getRecordTap().connect(this.node);
    // Keep the node pulled without making it audible
    const sink = ctx.createGain();
    sink.gain.value = 0;
    this.node.connect(sink).connect(ctx.destination);
    this.node.port.postMessage('start');
    this.startedAt = ctx.currentTime;
    this.recording = true;
  }

  elapsed(): number {
    return this.recording ? getAudioContext().currentTime - this.startedAt : 0;
  }

  /** Stop and return a WAV blob */
  stop(): Promise<Blob> {
    return new Promise(resolve => {
      const node = this.node;
      if (!node) return resolve(new Blob());
      node.port.onmessage = e => {
        if (e.data.type === 'chunk') this.chunks.push({ l: e.data.l, r: e.data.r });
        if (e.data.type === 'done') {
          try { getRecordTap().disconnect(node); } catch { /* */ }
          node.disconnect();
          this.node = null;
          this.recording = false;
          resolve(encodeWav(this.chunks, getAudioContext().sampleRate));
        }
      };
      node.port.postMessage('stop');
    });
  }
}

export function encodeWav(chunks: { l: Float32Array; r: Float32Array }[], sampleRate: number): Blob {
  const frames = chunks.reduce((n, c) => n + c.l.length, 0);
  const bytesPerSample = 3;
  const dataSize = frames * 2 * bytesPerSample;
  const buf = new ArrayBuffer(44 + dataSize);
  const v = new DataView(buf);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF');
  v.setUint32(4, 36 + dataSize, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 2, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2 * bytesPerSample, true);
  v.setUint16(32, 2 * bytesPerSample, true);
  v.setUint16(34, 24, true);
  str(36, 'data');
  v.setUint32(40, dataSize, true);
  let o = 44;
  const put = (x: number) => {
    const s = Math.max(-1, Math.min(1, x));
    const i = Math.round(s < 0 ? s * 0x800000 : s * 0x7fffff);
    v.setUint8(o, i & 0xff);
    v.setUint8(o + 1, (i >> 8) & 0xff);
    v.setUint8(o + 2, (i >> 16) & 0xff);
    o += 3;
  };
  chunks.forEach(c => {
    for (let i = 0; i < c.l.length; i++) {
      put(c.l[i]);
      put(c.r[i]);
    }
  });
  return new Blob([buf], { type: 'audio/wav' });
}

export const masterRecorder = new MasterRecorder();
