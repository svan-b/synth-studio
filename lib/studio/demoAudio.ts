// ============================================================================
// Demo recordings: excerpts and whole songs of the three demo tracks, rendered
// ahead of time by scripts/render-demos.cjs (public/demos/, docs/DEMOS.md).
//
// The Producer path's hooks (`info.play`), its demo A/Bs (`listen.demo`) and the
// demo cards' Listen button play these files instead of loading a demo into the
// studio. So the learner's work is never at risk (autosave, undo and the lesson
// checks never see a demo), and an older iPad doesn't have to run every
// instrument to hear one.
//
//   - a file is fetched and decoded the first time it plays, then kept (the
//     excerpts, and the last full song)
//   - it plays into the speakers past the studio master (the demos are mastered),
//     trimmed to about the loudness the learner's own studio plays at (its master
//     meter while it plays; -20 LUFS before it has played), never above -1 dBTP.
//     The two sides of an A/B play at the same loudness, from the manifest's
//     measurements, so "louder" never wins
//   - while a recording plays, the studio is held back from the speakers. It keeps
//     running: its meter, recordings and lesson checks see it as before
//   - playback stops on the studio's ▶ or ■, on a second press of the same
//     button, and when the coach leaves the step or the lesson (stop)
//
// It never touches the store, the hub, the instruments or the studio.
// ============================================================================

import type { DemoClipRef } from '@/types';
import { getAudioContext, getSpeakerBus, onMasterMeter, resumeAudio, setStudioToSpeakers, type MasterMeterFrame } from '@/lib/audio/context';
import { transport } from '@/lib/audio/transport';
import { DEMO_RECORDINGS, clipsOf, resolveClip, type DemoClip, type DemoRecording } from './demos/recordings';

export { AS_MADE, DEMO_RECORDINGS, FULL, barsLabel, clipsOf, refsOf, resolveClip, type DemoClip, type DemoRecording } from './demos/recordings';

// ----------------------------------------------------------------------------
// Level: about as loud as the learner's own studio
// ----------------------------------------------------------------------------

/**
 * Where recordings play before the studio has been heard, LUFS: about where the Producer path's
 * studios play (measured with ▶: the Elektron studio -24 to -23, Tide Pool -21 to -20, the mixed
 * song -19.4)
 */
export const DEFAULT_TARGET_LUFS = -20;
/** The studio's loudness is followed within this range, LUFS */
const TARGET_RANGE: [number, number] = [-26, -12];
/** No recording goes above this after its trim, dBTP */
const PEAK_CEILING = -1;
/** Seconds of the studio's playing the estimate averages over */
const WINDOW = 20;

const energyOf = (lufs: number) => Math.pow(10, (lufs + 0.691) / 10);
const lufsOf = (e: number) => -0.691 + 10 * Math.log10(e);
let studioE = 0;
let studioW = 0;

function onMeter(f: MasterMeterFrame) {
  // Momentary loudness, only while the studio plays and makes sound (a stopped studio's
  // tail doesn't count), averaged as energy: what the learner has been hearing
  if (!transport.playing || f.m === null || f.m < -50) return;
  const k = 0.05 / WINDOW; // a meter frame is 50 ms
  studioE = studioE * (1 - k) + energyOf(f.m) * k;
  studioW = studioW * (1 - k) + k;
}

/** The studio's loudness over its last ~20 s of playing, LUFS (null until it has played 3 s) */
export function studioLoudness(): number | null {
  if (studioW < (0.05 / WINDOW) * 60) return null;
  return lufsOf(studioE / studioW);
}

/** The loudness recordings play at now, LUFS */
export function targetLufs(): number {
  const s = studioLoudness();
  return Math.max(TARGET_RANGE[0], Math.min(TARGET_RANGE[1], s ?? DEFAULT_TARGET_LUFS));
}

/** One level for all of `clips` (the target, lower if a clip would pass the peak ceiling): each clip's trim, dB */
export function trimsFor(clips: Pick<DemoRecording, 'lufs' | 'truePeak'>[], target = targetLufs()): number[] {
  const level = Math.min(target, ...clips.map(c => c.lufs + (PEAK_CEILING - c.truePeak)));
  return clips.map(c => level - c.lufs);
}

// ----------------------------------------------------------------------------
// Loading
// ----------------------------------------------------------------------------

interface Entry { bytes?: Promise<ArrayBuffer>; buffer?: Promise<AudioBuffer>; size: number; used: number }
const cache = new Map<string, Entry>();
/** Decoded audio kept, bytes (an excerpt is about 3 MB, a full song about 55) */
const CACHE_BYTES = 80e6;

function entry(url: string): Entry {
  let e = cache.get(url);
  if (!e) { e = { size: 0, used: 0 }; cache.set(url, e); }
  e.used = performance.now();
  return e;
}

function fetchBytes(url: string): Promise<ArrayBuffer> {
  const e = entry(url);
  if (!e.bytes) {
    e.bytes = fetch(url).then(r => {
      if (!r.ok) throw new Error(`the recording ${url} is missing (${r.status})`);
      return r.arrayBuffer();
    });
    e.bytes.catch(() => { if (cache.get(url) === e) cache.delete(url); });
  }
  return e.bytes;
}

/** Fetch recordings ahead of a press (not decoded: that waits for the press) */
export function prefetch(clips: DemoClip[]) {
  if (typeof window === 'undefined') return;
  clips.forEach(c => { if (!cache.get(c.url)?.buffer) fetchBytes(c.url).catch(() => undefined); });
}

function decode(url: string): Promise<AudioBuffer> {
  const e = entry(url);
  if (!e.buffer) {
    const ctx = getAudioContext();
    e.buffer = fetchBytes(url).then(bytes => new Promise<AudioBuffer>((resolve, reject) => {
      // a copy: decoding detaches the buffer it is given
      ctx.decodeAudioData(bytes.slice(0), resolve, () => reject(new Error('this browser could not decode the recording (AAC)')));
    })).then(buf => {
      e.size = buf.length * buf.numberOfChannels * 4;
      e.bytes = undefined; // the decoded audio is what is kept
      return buf;
    });
    e.buffer.catch(() => { if (cache.get(url) === e) cache.delete(url); });
  }
  return e.buffer;
}

/** Drop the least recently used decoded audio over the budget (never what is playing) */
function trimCache(keep: Set<string>) {
  let total = 0;
  cache.forEach(e => { total += e.size; });
  const old = [...cache.entries()].filter(([u, e]) => !keep.has(u) && e.size > 0).sort((a, b) => a[1].used - b[1].used);
  for (const [u, e] of old) {
    if (total <= CACHE_BYTES) break;
    total -= e.size;
    cache.delete(u);
  }
}

/**
 * Where the recording starts in a decoded buffer, seconds. The encoder (ffmpeg's AAC) puts
 * 1024 samples of priming in front and pads the end to a whole 1024-sample frame. A decoder
 * that reads the file's edit list drops the priming (and maybe the padding); one that doesn't
 * keeps both. The manifest knows the exact length, so the extra samples tell which.
 */
function startOffset(clip: DemoClip, buf: AudioBuffer): number {
  const rate = DEMO_RECORDINGS.sampleRate || buf.sampleRate;
  const scale = buf.sampleRate / rate;
  const pad = (1024 - ((clip.frames + 1024) % 1024)) % 1024;
  const extra = buf.length - clip.frames * scale;
  return extra > (pad + 512) * scale ? 1024 / rate : 0;
}

// ----------------------------------------------------------------------------
// Playback
// ----------------------------------------------------------------------------

export type DemoSide = 'a' | 'b';

/** What plays now (one thing at a time) */
export interface DemoPlayback {
  /** Who started it: 'lesson:<lesson id>:<step>' for the coach, 'card:<demo>' for a demo card */
  owner: string;
  /** clips: one or more recordings once, in turn (info.play, Listen); ab: two sides of an excerpt, looping */
  kind: 'clips' | 'ab';
  status: 'loading' | 'playing' | 'error';
  error?: string;
  /** clips: in order; ab: [A, B] */
  clips: DemoClip[];
  /** clips: the one playing */
  index: number;
  /** ab: the side you hear */
  side: DemoSide | null;
  /** The trim on each clip, dB */
  gainDb: number[];
  /** The loudness they play at, LUFS */
  targetLufs: number;
  /** Audio time the clip playing (or the A/B's loop) started */
  startedAt: number;
  /** Its length: the clip, or the A/B's loop, seconds */
  seconds: number;
}

interface Running {
  pb: DemoPlayback;
  sources: AudioBufferSourceNode[];
  gains: GainNode[];
  timers: ReturnType<typeof setTimeout>[];
}

let cur: Running | null = null;
let generation = 0;
let output: GainNode | null = null;
let meter: AnalyserNode | null = null;
let meterBuf: Float32Array<ArrayBuffer> | null = null;
const listeners = new Set<() => void>();
let installed = false;

/** Fade on switching sides and stopping, and in on a first start (the files begin on a downbeat), seconds */
const XFADE = 0.025;
const STOP_FADE = 0.06;
const START_FADE = 0.004;
/** Gap between clips played in turn, seconds */
const GAP = 0.35;
/** An A/B loops for at most about this long, seconds */
const AB_MAX = 60;

function install() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  onMasterMeter(onMeter);
  // The studio's ▶ and ■ stop a recording
  transport.onEvent(e => { if (e.type === 'start' || e.type === 'stop') stop(); });
}

function out(): GainNode {
  const ctx = getAudioContext();
  if (!output) {
    output = ctx.createGain();
    output.connect(getSpeakerBus());
    meter = ctx.createAnalyser();
    meter.fftSize = 2048;
    meterBuf = new Float32Array(meter.fftSize);
    output.connect(meter);
  }
  return output;
}

function emit() { listeners.forEach(l => l()); }
function update(patch: Partial<DemoPlayback>) {
  if (!cur) return;
  cur.pb = { ...cur.pb, ...patch };
  emit();
}

export function subscribe(l: () => void): () => void {
  install();
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export function getPlayback(): DemoPlayback | null {
  return cur?.pb ?? null;
}

/** Seconds into the clip playing, or into the A/B's loop (0 when nothing plays) */
export function elapsed(): number {
  if (!cur || cur.pb.status !== 'playing') return 0;
  const t = getAudioContext().currentTime - cur.pb.startedAt;
  if (t < 0) return 0;
  return cur.pb.kind === 'ab' ? t % cur.pb.seconds : Math.min(t, cur.pb.seconds);
}

/** Peak level of the recording playing (0..1), the last ~40 ms */
export function outputLevel(): number {
  if (!meter || !meterBuf) return 0;
  meter.getFloatTimeDomainData(meterBuf);
  let p = 0;
  for (let i = 0; i < meterBuf.length; i++) p = Math.max(p, Math.abs(meterBuf[i]));
  return p;
}

const dbToGain = (db: number) => Math.pow(10, db / 20);

function begin(owner: string, kind: DemoPlayback['kind'], clips: DemoClip[], side: DemoSide | null): number {
  install();
  stop();
  const gen = ++generation;
  // inside the press: iPad lets audio start only from a gesture
  void resumeAudio().catch(() => undefined);
  const target = targetLufs();
  cur = {
    pb: { owner, kind, status: 'loading', clips, index: 0, side, gainDb: trimsFor(clips, target), targetLufs: target, startedAt: 0, seconds: 0 },
    sources: [], gains: [], timers: [],
  };
  emit();
  return gen;
}

function fail(gen: number, e: unknown) {
  if (gen !== generation || !cur) return;
  stopNodes(cur, 0);
  setStudioToSpeakers(true);
  update({ status: 'error', error: e instanceof Error ? e.message : String(e) });
}

/**
 * Play one or more recordings, in turn (an info step's ▶ Hear it, a demo card's Listen).
 * The same owner pressing again while they play stops them.
 */
export function play(owner: string, refs: DemoClipRef | DemoClipRef[]): void {
  if (cur && cur.pb.owner === owner && cur.pb.kind === 'clips' && cur.pb.status !== 'error') { stop(); return; }
  const clips = clipsOf(refs);
  if (!clips.length) return;
  const gen = begin(owner, 'clips', clips, null);
  void (async () => {
    try {
      const bufs = await Promise.all(clips.map(c => decode(c.url)));
      if (gen !== generation || !cur) return;
      trimCache(new Set(clips.map(c => c.url)));
      setStudioToSpeakers(false);
      const ctx = getAudioContext();
      let t = ctx.currentTime + 0.04;
      clips.forEach((c, i) => {
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, ctx.currentTime);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(dbToGain(cur!.pb.gainDb[i]), t + START_FADE);
        g.connect(out());
        const s = ctx.createBufferSource();
        s.buffer = bufs[i];
        s.connect(g);
        const off = startOffset(c, bufs[i]);
        const len = Math.min(c.seconds, bufs[i].duration - off);
        s.start(t, off, len);
        const at = t;
        // the coach follows which clip plays
        cur!.timers.push(setTimeout(() => { if (gen === generation) update({ index: i, startedAt: at, seconds: len }); }, Math.max(0, (at - ctx.currentTime) * 1000)));
        cur!.sources.push(s);
        cur!.gains.push(g);
        t += len + GAP;
      });
      const end = t - GAP;
      update({ status: 'playing', index: 0, startedAt: ctx.currentTime + 0.04, seconds: Math.min(clips[0].seconds, bufs[0].duration) });
      cur.timers.push(setTimeout(() => { if (gen === generation) stop(); }, (end - ctx.currentTime) * 1000 + 30));
    } catch (e) {
      fail(gen, e);
    }
  })();
}

/**
 * A/B of two variations of an excerpt (a demo listen step): both play in sync, looping
 * the excerpt's bars, and you hear one side. Pressing the other side switches on the same
 * phrase; pressing the side you hear stops.
 */
export function playSide(owner: string, a: DemoClipRef, b: DemoClipRef, side: DemoSide): void {
  if (cur && cur.pb.owner === owner && cur.pb.kind === 'ab' && cur.pb.status !== 'error') {
    if (cur.pb.side === side) { stop(); return; }
    if (cur.pb.status === 'playing') {
      const ctx = getAudioContext();
      const now = ctx.currentTime;
      cur.gains.forEach((g, i) => {
        const to = (i === 0) === (side === 'a') ? dbToGain(cur!.pb.gainDb[i]) : 0;
        g.gain.cancelScheduledValues(now);
        g.gain.setValueAtTime(g.gain.value, now);
        g.gain.linearRampToValueAtTime(to, now + XFADE);
      });
    }
    update({ side });
    return;
  }
  const clips = [resolveClip(a), resolveClip(b)];
  if (!clips[0] || !clips[1]) return;
  const pair = clips as DemoClip[];
  const gen = begin(owner, 'ab', pair, side);
  void (async () => {
    try {
      const bufs = await Promise.all(pair.map(c => decode(c.url)));
      if (gen !== generation || !cur) return;
      trimCache(new Set(pair.map(c => c.url)));
      setStudioToSpeakers(false);
      const ctx = getAudioContext();
      const t0 = ctx.currentTime + 0.04;
      // Both loop the same bars: the shorter of the two, so they stay in step
      const loop = Math.min(pair[0].loop, pair[1].loop);
      pair.forEach((c, i) => {
        const g = ctx.createGain();
        const on = (i === 0) === (cur!.pb.side === 'a');
        g.gain.setValueAtTime(0, ctx.currentTime);
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(on ? dbToGain(cur!.pb.gainDb[i]) : 0, t0 + START_FADE);
        g.connect(out());
        const s = ctx.createBufferSource();
        s.buffer = bufs[i];
        const off = startOffset(c, bufs[i]);
        s.loop = true;
        s.loopStart = off;
        s.loopEnd = off + loop;
        s.connect(g);
        s.start(t0, off);
        cur!.sources.push(s);
        cur!.gains.push(g);
      });
      update({ status: 'playing', startedAt: t0, seconds: loop });
      const loops = Math.max(2, Math.ceil(AB_MAX / loop));
      cur.timers.push(setTimeout(() => { if (gen === generation) stop(); }, (t0 + loops * loop - ctx.currentTime) * 1000));
    } catch (e) {
      fail(gen, e);
    }
  })();
}

function stopNodes(r: Running, fade: number) {
  const ctx = getAudioContext();
  const now = ctx.currentTime;
  r.timers.forEach(t => clearTimeout(t));
  r.timers = [];
  r.gains.forEach(g => {
    try {
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(g.gain.value, now);
      g.gain.linearRampToValueAtTime(0, now + fade);
    } catch { /* already gone */ }
  });
  const sources = r.sources, gains = r.gains;
  r.sources = [];
  r.gains = [];
  sources.forEach(s => { try { s.stop(now + fade + 0.01); } catch { /* not started */ } });
  setTimeout(() => {
    sources.forEach(s => { try { s.disconnect(); } catch { /* */ } });
    gains.forEach(g => { try { g.disconnect(); } catch { /* */ } });
  }, (fade + 0.05) * 1000);
}

/**
 * Stop what plays: anything, or only if its owner is `match` (or passes it). The studio is
 * let through to the speakers again.
 */
export function stop(match?: string | ((owner: string) => boolean)): void {
  if (!cur) return;
  if (match !== undefined && !(typeof match === 'string' ? cur.pb.owner === match : match(cur.pb.owner))) return;
  const r = cur;
  cur = null;
  generation++;
  stopNodes(r, STOP_FADE);
  setStudioToSpeakers(true, 0.08);
  emit();
}

/** The coach's owner name for a step */
export const lessonOwner = (lessonId: string, step: number) => `lesson:${lessonId}:${step}`;
export const isLessonOwner = (owner: string) => owner.startsWith('lesson:');

// From the start: the level recordings play at follows the studio from before the first press
install();

/** Automation hook (the lesson runner, e2e tests), like window.__synthStudio */
export const demoAudio = {
  manifest: DEMO_RECORDINGS, resolveClip, clipsOf, play, playSide, stop, getPlayback, elapsed, outputLevel, targetLufs,
  studioLoudness, trimsFor, output: () => out(),
};

if (typeof window !== 'undefined') {
  (window as unknown as { __synthDemoAudio?: typeof demoAudio }).__synthDemoAudio = demoAudio;
}
