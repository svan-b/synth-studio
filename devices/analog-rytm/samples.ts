// ============================================================================
// User samples (Rytm MKII manual pp.35-36, 58-60)
//
// On the hardware the project's sample slots hold samples from the +Drive; any
// slot can be replaced (p.59), and the SMPL page's SMP parameter picks the slot
// a Sound plays (p.35). The twin's 32 slots hold synthesized one-shots; a
// learner's own WAV or AIFF file can replace one of them, for this project.
//
// The design, kept small:
// - Decoding: our own WAV (PCM 8/16/24/32-bit, float 32/64) and AIFF / AIFF-C
//   (PCM, 'sowt', 'fl32', 'fl64') readers; anything else goes to the browser's
//   decodeAudioData. Mixed to mono and cut at 33 s (the hardware's longest
//   sampling time, p.56).
// - Storage: IndexedDB (database "synth-studio-rytm-samples"), keyed by a hash
//   of the audio, so the same file loaded twice is stored once. The project only
//   keeps `samples: { [slot]: { id, name } }`: saved projects stay small.
// - The engine loads a slot's sample from IndexedDB, resamples it to the audio
//   context's rate, normalizes it to the built-in one-shots' level and sends it
//   to the worklet. A sample missing from this browser (another device, cleared
//   site data) leaves the slot on its built-in one-shot, and the panel says which.
// ============================================================================

import type { ProjectAudioAsset } from '@/devices/types';

export const MAX_SECONDS = 33;
const DB_NAME = 'synth-studio-rytm-samples';
const STORE = 'samples';

export interface UserSampleRef { id: string; name: string }
export interface StoredSample { id: string; name: string; rate: number; data: Float32Array; created: number }

/** A slot map from saved data, repaired: slot 1-32 -> { id, name } */
export function cleanSampleMap(x: unknown): Record<string, UserSampleRef> | undefined {
  if (!x || typeof x !== 'object') return undefined;
  const out: Record<string, UserSampleRef> = {};
  for (const [k, v] of Object.entries(x as Record<string, unknown>)) {
    const slot = Number(k);
    const r = v as Partial<UserSampleRef> | null;
    if (Number.isInteger(slot) && slot >= 1 && slot <= 32 && r && typeof r.id === 'string' && r.id) {
      out[slot] = { id: r.id, name: typeof r.name === 'string' ? r.name.slice(0, 40) : 'SAMPLE' };
    }
  }
  return Object.keys(out).length ? out : undefined;
}

// ----------------------------------------------------------------------------
// Decoding
// ----------------------------------------------------------------------------

export interface Decoded { data: Float32Array; rate: number; truncated: boolean }

const tag = (dv: DataView, at: number) => String.fromCharCode(dv.getUint8(at), dv.getUint8(at + 1), dv.getUint8(at + 2), dv.getUint8(at + 3));

/** Mono mixdown of interleaved frames, read by `get(frame, channel)` */
function mono(frames: number, channels: number, rate: number, get: (i: number, c: number) => number): Decoded {
  const max = Math.min(frames, Math.floor(MAX_SECONDS * rate));
  const data = new Float32Array(max);
  for (let i = 0; i < max; i++) {
    let s = 0;
    for (let c = 0; c < channels; c++) s += get(i, c);
    data[i] = s / channels;
  }
  return { data, rate, truncated: max < frames };
}

/** A PCM / float sample reader for `bits` and byte order (`unsigned8`: WAV's 8-bit samples are unsigned, AIFF's signed) */
function reader(dv: DataView, bits: number, float: boolean, little: boolean, unsigned8 = false): ((at: number) => number) | null {
  if (float && bits === 32) return at => dv.getFloat32(at, little);
  if (float && bits === 64) return at => dv.getFloat64(at, little);
  if (float) return null;
  if (bits === 8) return unsigned8 ? at => (dv.getUint8(at) - 128) / 128 : at => dv.getInt8(at) / 128;
  if (bits === 16) return at => dv.getInt16(at, little) / 32768;
  if (bits === 24) return little
    ? at => ((dv.getUint8(at) | (dv.getUint8(at + 1) << 8) | (dv.getInt8(at + 2) << 16))) / 8388608
    : at => ((dv.getInt8(at) << 16) | (dv.getUint8(at + 1) << 8) | dv.getUint8(at + 2)) / 8388608;
  if (bits === 32) return at => dv.getInt32(at, little) / 2147483648;
  return null;
}

function parseWav(dv: DataView): Decoded | null {
  if (dv.byteLength < 12 || tag(dv, 0) !== 'RIFF' || tag(dv, 8) !== 'WAVE') return null;
  let fmt: { format: number; channels: number; rate: number; bits: number; align: number } | null = null;
  for (let at = 12; at + 8 <= dv.byteLength;) {
    const id = tag(dv, at), size = dv.getUint32(at + 4, true), body = at + 8;
    if (id === 'fmt ' && size >= 16) {
      let format = dv.getUint16(body, true);
      if (format === 0xfffe && size >= 26) format = dv.getUint16(body + 24, true); // WAVE_FORMAT_EXTENSIBLE: the sub-format
      fmt = { format, channels: dv.getUint16(body + 2, true), rate: dv.getUint32(body + 4, true), bits: dv.getUint16(body + 14, true), align: dv.getUint16(body + 12, true) };
    } else if (id === 'data' && fmt) {
      if (fmt.format !== 1 && fmt.format !== 3) return null;
      const read = reader(dv, fmt.bits, fmt.format === 3, true, true);
      if (!read || !fmt.channels || !fmt.rate) return null;
      const bytes = fmt.bits / 8, align = fmt.align || bytes * fmt.channels;
      const frames = Math.floor(Math.min(size, dv.byteLength - body) / align);
      return mono(frames, fmt.channels, fmt.rate, (i, c) => read(body + i * align + c * bytes));
    }
    at = body + size + (size & 1);
  }
  return null;
}

/** IEEE 754 80-bit extended (AIFF sample rate) */
function extended(dv: DataView, at: number): number {
  const exp = (dv.getUint16(at) & 0x7fff) - 16383;
  const hi = dv.getUint32(at + 2), lo = dv.getUint32(at + 6);
  return (hi * 2 ** 32 + lo) * 2 ** (exp - 63);
}

function parseAiff(dv: DataView): Decoded | null {
  if (dv.byteLength < 12 || tag(dv, 0) !== 'FORM') return null;
  const kind = tag(dv, 8);
  if (kind !== 'AIFF' && kind !== 'AIFC') return null;
  let comm: { channels: number; frames: number; bits: number; rate: number; comp: string } | null = null;
  for (let at = 12; at + 8 <= dv.byteLength;) {
    const id = tag(dv, at), size = dv.getUint32(at + 4), body = at + 8;
    if (id === 'COMM' && size >= 18) {
      comm = { channels: dv.getInt16(body), frames: dv.getUint32(body + 2), bits: dv.getInt16(body + 6), rate: extended(dv, body + 8), comp: kind === 'AIFC' && size >= 22 ? tag(dv, body + 18) : 'NONE' };
    } else if (id === 'SSND' && comm) {
      const offset = dv.getUint32(body);
      const start = body + 8 + offset;
      const comp = comm.comp;
      const float = comp === 'fl32' || comp === 'FL32' || comp === 'fl64' || comp === 'FL64';
      const bits = comp === 'fl64' || comp === 'FL64' ? 64 : float ? 32 : comm.bits;
      if (!float && comp !== 'NONE' && comp !== 'sowt' && comp !== 'twos') return null;
      const read = reader(dv, bits, float, comp === 'sowt');
      if (!read || !comm.channels || !(comm.rate > 0)) return null;
      const bytes = Math.ceil(bits / 8), align = bytes * comm.channels;
      const frames = Math.min(comm.frames, Math.floor((dv.byteLength - start) / align));
      return mono(frames, comm.channels, comm.rate, (i, c) => read(start + i * align + c * bytes));
    }
    at = body + size + (size & 1);
  }
  return null;
}

/** Decode a WAV or AIFF file (our readers), or anything the browser can decode */
export async function decodeAudioFile(buf: ArrayBuffer): Promise<Decoded> {
  const dv = new DataView(buf);
  const own = parseWav(dv) ?? parseAiff(dv);
  if (own) {
    if (!own.data.length) throw new Error('the file holds no audio');
    return own;
  }
  if (typeof window === 'undefined' || !(window.OfflineAudioContext || (window as unknown as { webkitOfflineAudioContext?: unknown }).webkitOfflineAudioContext)) throw new Error('unsupported file');
  const ctx = new OfflineAudioContext(1, 1, 44100);
  const ab = await ctx.decodeAudioData(buf.slice(0));
  return mono(ab.length, ab.numberOfChannels, ab.sampleRate, (i, c) => ab.getChannelData(c)[i]);
}

/** A stable id from the audio itself (the same file loaded twice is stored once) */
export function sampleId(d: Decoded): string {
  let h = 0x811c9dc5;
  const step = Math.max(1, Math.floor(d.data.length / 4096));
  for (let i = 0; i < d.data.length; i += step) {
    h ^= Math.round(d.data[i] * 32767) & 0xffff;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `s${h.toString(16).padStart(8, '0')}-${d.data.length}-${d.rate}`;
}

/** The slot's display name from a file name: "Kick 01.wav" -> "KICK 01" */
export const sampleName = (file: string) => file.replace(/\.[a-z0-9]+$/i, '').replace(/[_]+/g, ' ').trim().toUpperCase().slice(0, 24) || 'SAMPLE';

// ----------------------------------------------------------------------------
// IndexedDB
// ----------------------------------------------------------------------------

let dbp: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('this browser has no IndexedDB'));
  dbp ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { dbp = null; reject(req.error ?? new Error('IndexedDB open failed')); };
  });
  return dbp;
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return db().then(d => new Promise<T>((resolve, reject) => {
    const t = d.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  }));
}

export const putSample = (s: StoredSample) => tx('readwrite', st => st.put(s)).then(() => undefined);
export const getSample = (id: string) => tx<StoredSample | undefined>('readonly', st => st.get(id) as IDBRequest<StoredSample | undefined>).catch(() => undefined);
export const deleteSample = (id: string) => tx('readwrite', st => st.delete(id)).then(() => undefined);

/** Resample to `rate` (the browser's own resampler) and normalize to the built-in one-shots' peak (0.8) */
export async function prepareForWorklet(s: Pick<StoredSample, 'data' | 'rate'>, rate: number): Promise<Float32Array> {
  let out = s.data;
  if (Math.abs(s.rate - rate) > 0.5 && typeof OfflineAudioContext !== 'undefined') {
    const frames = Math.max(1, Math.ceil(s.data.length * rate / s.rate));
    const oc = new OfflineAudioContext(1, frames, rate);
    const b = oc.createBuffer(1, s.data.length, s.rate);
    b.getChannelData(0).set(s.data);
    const src = oc.createBufferSource();
    src.buffer = b;
    src.connect(oc.destination);
    src.start();
    out = (await oc.startRendering()).getChannelData(0).slice();
  } else out = s.data.slice();
  let peak = 0;
  for (let i = 0; i < out.length; i++) peak = Math.max(peak, Math.abs(out[i]));
  if (peak > 1e-6) for (let i = 0; i < out.length; i++) out[i] *= 0.8 / peak;
  return out;
}

// ----------------------------------------------------------------------------
// Project files: the user samples a project uses travel inside it (16-bit, base64)
// ----------------------------------------------------------------------------

function toPcm16Base64(data: Float32Array): string {
  const pcm = new Int16Array(data.length);
  for (let i = 0; i < data.length; i++) pcm[i] = Math.max(-32768, Math.min(32767, Math.round(data[i] * 32767)));
  const bytes = new Uint8Array(pcm.buffer);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function fromPcm16Base64(b64: string): Float32Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const pcm = new Int16Array(bytes.buffer, 0, bytes.length >> 1);
  const out = new Float32Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) out[i] = pcm[i] / 32767;
  return out;
}

/** The samples a project's slots use, for its project file */
export async function collectSampleAssets(refs: Record<string, UserSampleRef> | undefined): Promise<ProjectAudioAsset[]> {
  const ids = [...new Set(Object.values(refs ?? {}).map(r => r.id))];
  const out: ProjectAudioAsset[] = [];
  for (const id of ids) {
    const s = await getSample(id);
    if (s) out.push({ kind: 'audio', id: s.id, name: s.name, rate: s.rate, pcm16: toPcm16Base64(s.data) });
  }
  return out;
}

/** A project file's samples back into this browser (ones it already has are kept) */
export async function restoreSampleAssets(list: ProjectAudioAsset[]): Promise<void> {
  for (const a of list) {
    if (a?.kind !== 'audio' || !a.id || typeof a.pcm16 !== 'string') continue;
    if (await getSample(a.id)) continue;
    await putSample({ id: a.id, name: a.name, rate: a.rate, data: fromPcm16Base64(a.pcm16), created: Date.now() });
  }
}
