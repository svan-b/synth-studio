// ============================================================================
// Lesson runtime (Lesson API v3 – studio state). Everything a studio lesson needs
// that only exists while audio runs, published for lesson checks through
// lessonLive.ts:
//
//   meters    the studio master (LUFS M / S / I, sample and true peak, limiter and
//             glue gain reduction, overs), held and windowed the way checks need
//             them, plus every mixer-device channel meter (Xone:96 dBu, PK) and
//             every studio strip
//   bounce    REC and Bounce in progress, and the last finished take measured on
//             the master meter: length, integrated loudness, true peak, stems
//   history   what the learner did since the lesson started (changed, wasOn, min, max)
//   arranger  the song position
//
// It also runs the studio-level A/B of listen steps (several instruments, the
// master section, swing) with loudness matching, keeps clock-stepped DFAMs on the
// bar during lessons that start from a whole studio, and applies step solutions
// ("show me one way", the lesson runner).
//
// The store loads this module when a studio lesson starts; the coach imports it.
// It must stay out of the store's static imports (it imports the hub).
// ============================================================================

import type {
  ControlValue, Lesson, LessonChannelMeter, LessonHistory, LessonMasterMeters, LessonMasterPatch, LessonPatternPatch, LessonSolution, LessonStep, LessonTake,
} from '@/types';
import { useStudioStore, stepInstance, getSpec, specDefaults } from '@/store/studio';
import { STAMPS_TRIGS, withPatternPatch, withSequenceEdit } from './elektronEdits';
import { hub } from './hub';
import { arranger } from './arranger';
import { history as undoHistory } from './history';
import { historyPaused } from './historyGate';
import { setLessonLive, setLessonStudioHooks } from './lessonLive';
import { sectionsFromStart } from './lessonStudio';
import { bounceSong, isBouncing, isRecording, startRecording, stopRecording, type BounceProgress } from './bounce';
import { dbToGain, masterOf } from './mixerDoc';
import { getAudioContext, getRecordTap, onMasterMeter, setMasterSettings, type MasterMeterFrame } from '@/lib/audio/context';
import { transport, PPQN } from '@/lib/audio/transport';

const FRAME_SEC = 0.05;
const toDb = (v: number) => (v > 0 ? 20 * Math.log10(v) : -Infinity);
const lufsOf = (meanEnergy: number) => (meanEnergy > 0 ? -0.691 + 10 * Math.log10(meanEnergy) : -Infinity);
const energyOf = (lufs: number) => Math.pow(10, (lufs + 0.691) / 10);
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** The instance a lesson names: an instance id, or the first instance of a device */
export function resolveInstance(idOrDevice: string): string | undefined {
  const rack = useStudioStore.getState().studio.rack;
  if (rack.some(r => r.id === idOrDevice)) return idOrDevice;
  return rack.find(r => r.device === idOrDevice)?.id;
}

// ============================================================================
// Master meter tracking
// ============================================================================

interface MasterTrack {
  t0: number;
  fromStart: boolean;
  frames: number;
  maxIn: number;
  maxTp: number;
  maxGr: number;
  overs: number;
  sMax: number | null;
  steady: boolean;
  /** frames of the last 3 s: [time, inPeak, tp, gr] */
  recent: [number, number, number, number][];
  last: MasterMeterFrame | null;
}

const freshTrack = (fromStart = false): MasterTrack => ({
  t0: now(), fromStart, frames: 0, maxIn: 0, maxTp: 0, maxGr: 0, overs: 0, sMax: null, steady: true, recent: [], last: null,
});

let track = freshTrack();
let meterLive = false;
let lastFrameAt = 0;

function onFrame(f: MasterMeterFrame) {
  lastFrameAt = now();
  meterLive = true;
  track.last = f;
  ab.onFrame(f);
  take?.onFrame(f);
  if (!transport.playing) return;
  track.frames++;
  if (f.inPeak > track.maxIn) track.maxIn = f.inPeak;
  if (f.tp > track.maxTp) track.maxTp = f.tp;
  if (f.gr > track.maxGr) track.maxGr = f.gr;
  if (f.inPeak >= 1) track.overs++;
  if (f.s !== null && (track.sMax === null || f.s > track.sMax)) track.sMax = f.s;
  const t = lastFrameAt;
  track.recent.push([t, f.inPeak, f.tp, f.gr]);
  while (track.recent.length && t - track.recent[0][0] > 3000) track.recent.shift();
}

function masterMeters(): LessonMasterMeters {
  const f = track.last;
  const t = now();
  let in3 = 0, tp3 = 0, gr1 = 0;
  for (const [ft, inPk, tp, gr] of track.recent) {
    if (t - ft > 3000) continue;
    if (inPk > in3) in3 = inPk;
    if (tp > tp3) tp3 = tp;
    if (t - ft <= 1000 && gr > gr1) gr1 = gr;
  }
  const playing = transport.playing;
  return {
    lufsM: playing ? f?.m ?? null : null,
    lufsS: playing ? f?.s ?? null : null,
    // Integrated loudness holds after Stop, so "play it through, then check" works
    lufsI: f?.i ?? null,
    lufsSMax: track.sMax,
    peakDb: toDb(in3),
    maxPeakDb: toDb(track.maxIn),
    truePeakDb: toDb(tp3),
    maxTruePeakDb: toDb(track.maxTp),
    grDb: gr1,
    maxGrDb: track.maxGr,
    glueGrDb: playing ? f?.glue ?? 0 : 0,
    overs: track.overs,
    measuredSec: track.frames * FRAME_SEC,
    fromStart: track.fromStart,
    steady: track.steady,
  };
}

// ============================================================================
// Channel meters: mixer devices (Xone:96) and studio strips
// ============================================================================

interface ChannelTrack { samples: [number, number, boolean][]; max: number; unit: 'dBu' | 'dBFS' }
const channelTracks = new Map<string, ChannelTrack>();
let stripWatch: (() => void) | null = null;

type MeterEngine = { meterSnapshot?: () => { meters: Readonly<Record<string, { db: number; pk: boolean }>> } };
const MIXER_KEYS = ['1', '2', '3', '4', 'a', 'b', 'c', 'd'];

function sampleChannels() {
  const t = now();
  const st = useStudioStore.getState();
  const put = (key: string, db: number, pk: boolean, unit: 'dBu' | 'dBFS') => {
    let c = channelTracks.get(key);
    if (!c) { c = { samples: [], max: -Infinity, unit }; channelTracks.set(key, c); }
    c.samples.push([t, db, pk]);
    while (c.samples.length && t - c.samples[0][0] > 2000) c.samples.shift();
    if (transport.playing && db > c.max) c.max = db;
  };
  st.studio.rack.forEach(r => {
    const eng = hub.getEngine(r.id) as unknown as MeterEngine | undefined;
    const snap = eng?.meterSnapshot?.();
    if (snap) {
      MIXER_KEYS.forEach(k => {
        const m = snap.meters[k];
        if (m) put(`${r.id}:${k}`, m.db, m.pk, 'dBu');
      });
    }
    const lv = hub.mixer?.getLevels(r.id);
    if (lv) put(`strip:${r.id}`, toDb(Math.max(lv.peakL, lv.peakR)), Math.max(lv.peakL, lv.peakR) >= 1, 'dBFS');
  });
}

function channelMeters(): Record<string, LessonChannelMeter> {
  const out: Record<string, LessonChannelMeter> = {};
  const t = now();
  channelTracks.forEach((c, key) => {
    let peak = -Infinity, pk = false, cur = -Infinity;
    for (const [st, db, p] of c.samples) {
      if (t - st > 2000) continue;
      if (db > peak) peak = db;
      if (p) pk = true;
      cur = db;
    }
    out[key] = { peak, now: cur, pk, maxSincePlay: c.max, unit: c.unit };
  });
  return out;
}

// ============================================================================
// REC and Bounce takes
// ============================================================================

let recorderCount = 0;

/** Count 'recorder' worklet nodes: one per file a take records (the master, then each stem) */
function watchRecorders() {
  const w = window as unknown as { AudioWorkletNode?: typeof AudioWorkletNode & { __watched?: boolean; __counting?: boolean } };
  const Orig = w.AudioWorkletNode;
  if (!Orig || Orig.__counting) return;
  class Counting extends Orig {
    constructor(context: BaseAudioContext, name: string, options?: AudioWorkletNodeOptions) {
      super(context, name, options);
      if (name === 'recorder') recorderCount++;
    }
  }
  const C = Counting as unknown as { __watched?: boolean; __counting?: boolean };
  C.__counting = true;
  C.__watched = Orig.__watched;
  w.AudioWorkletNode = Counting as unknown as typeof AudioWorkletNode;
}

class Take {
  playStart: number | null = null;
  playSec = 0;
  fromStart = false;
  maxTp = 0;
  maxGr = 0;
  blocks: number[] = [];
  workletI: number | null = null;
  private n = 0;
  readonly recorders0 = recorderCount;
  readonly at = Date.now();
  constructor(readonly kind: 'rec' | 'bounce', readonly songSeconds: number) {
    if (transport.playing) this.playStart = now();
  }
  onStart(fromTick: number) {
    if (this.playStart === null) this.playStart = now();
    if (fromTick === 0 && this.playSec === 0) this.fromStart = true;
  }
  onStop() {
    if (this.playStart !== null) { this.playSec += (now() - this.playStart) / 1000; this.playStart = null; }
  }
  onFrame(f: MasterMeterFrame) {
    if (f.tp > this.maxTp) this.maxTp = f.tp;
    if (f.gr > this.maxGr) this.maxGr = f.gr;
    if (this.playStart !== null && f.i !== null) this.workletI = f.i;
    // BS.1770 gating blocks: 400 ms momentary loudness every 100 ms
    if (this.n++ % 2 === 0 && f.m !== null && this.playStart !== null) this.blocks.push(f.m);
  }
  finish(): LessonTake {
    this.onStop();
    const integrated = gatedLoudness(this.blocks);
    const lufsI = this.kind === 'bounce' && this.fromStart && this.workletI !== null ? this.workletI : integrated;
    const complete = this.kind === 'bounce'
      ? this.fromStart && (this.songSeconds > 0 ? this.playSec >= this.songSeconds - 0.75 : this.playSec > 1)
      : this.playSec > 0.5;
    return {
      kind: this.kind,
      seconds: Math.round(this.playSec * 100) / 100,
      lufsI: lufsI !== null && Number.isFinite(lufsI) ? Math.round(lufsI * 100) / 100 : null,
      truePeakDb: toDb(this.maxTp),
      maxGrDb: this.maxGr,
      stems: Math.max(0, recorderCount - this.recorders0 - 1),
      fromStart: this.fromStart,
      complete,
      songSeconds: this.songSeconds,
      at: this.at,
    };
  }
}

/** BS.1770-4 gated loudness of momentary (400 ms) block loudnesses */
function gatedLoudness(blocks: number[]): number | null {
  const abs = blocks.filter(l => l > -70);
  if (!abs.length) return null;
  const rel = lufsOf(abs.reduce((a, l) => a + energyOf(l), 0) / abs.length) - 10;
  const g = abs.filter(l => l > rel);
  return g.length ? lufsOf(g.reduce((a, l) => a + energyOf(l), 0) / g.length) : null;
}

let take: Take | null = null;
let lastTake: LessonTake | undefined;
let takeCount = 0;

function songSeconds(): number {
  const st = useStudioStore.getState().studio;
  if (!st.arrangement.sections.length) return 0;
  return (arranger.totalBars() * 4 * 60) / Math.max(20, st.bpm);
}

function pollTakes() {
  const rec = isRecording(), bnc = isBouncing();
  if (take && ((take.kind === 'bounce' && !bnc) || (take.kind === 'rec' && !rec))) {
    lastTake = take.finish();
    take = null;
    takeCount++;
  }
  if (!take && bnc) take = new Take('bounce', songSeconds());
  else if (!take && rec) take = new Take('rec', songSeconds());
}

// ============================================================================
// History: what the learner did since the lesson started
// ============================================================================

interface HistEntry { min?: number; max?: number; wasTrue: boolean; changes: number }
let hist = new Map<string, HistEntry>();
let histLesson: string | undefined;

const histKey = (inst: string, control: string) => `${inst}\u0001${control}`;

function noteValue(e: HistEntry, v: ControlValue | undefined) {
  if (typeof v === 'number') {
    e.min = e.min === undefined ? v : Math.min(e.min, v);
    e.max = e.max === undefined ? v : Math.max(e.max, v);
  } else if (v === true) e.wasTrue = true;
}

function recordChange(inst: string, control: string, before: ControlValue | undefined, after: ControlValue | undefined) {
  const k = histKey(inst, control);
  let e = hist.get(k);
  if (!e) { e = { wasTrue: false, changes: 0 }; noteValue(e, before); hist.set(k, e); }
  noteValue(e, after);
  e.changes++;
}

const historyApi: LessonHistory = {
  changed: (i, c) => { const inst = resolveInstance(i) ?? i; return (hist.get(histKey(inst, c))?.changes ?? 0) > 0; },
  wasOn: (i, c) => {
    const inst = resolveInstance(i) ?? i;
    if (hist.get(histKey(inst, c))?.wasTrue) return true;
    return inst === 'master' ? false : hub.valuesFor(inst)[c] === true;
  },
  min: (i, c) => {
    const inst = resolveInstance(i) ?? i;
    const e = hist.get(histKey(inst, c));
    const cur = currentValue(inst, c);
    if (e?.min !== undefined) return typeof cur === 'number' ? Math.min(e.min, cur) : e.min;
    return typeof cur === 'number' ? cur : undefined;
  },
  max: (i, c) => {
    const inst = resolveInstance(i) ?? i;
    const e = hist.get(histKey(inst, c));
    const cur = currentValue(inst, c);
    if (e?.max !== undefined) return typeof cur === 'number' ? Math.max(e.max, cur) : e.max;
    return typeof cur === 'number' ? cur : undefined;
  },
};

function currentValue(inst: string, control: string): ControlValue | undefined {
  if (inst === 'master') {
    const m = masterOf(useStudioStore.getState().studio.mixer);
    return control === 'gain' ? m.gain : control === 'glue' ? m.glue.on : control === 'eq' ? m.eq.on : undefined;
  }
  return hub.valuesFor(inst)[control];
}

// ============================================================================
// Clock alignment: ▶ parks clock-stepped DFAMs so step 1 lands on the bar
// ============================================================================

const CLOCK_TICKS = [PPQN, PPQN / 2, PPQN / 4, PPQN / 8, PPQN / 3, PPQN / 6];
const DFAM_STEPS = 8;

function alignClocked(fromTick: number) {
  const s = useStudioStore.getState();
  const start = s.isTeachingMode ? s.currentLesson?.start?.studio : undefined;
  if (!start || start.alignClocked === false || s.lessonStudio?.own) return;
  s.studio.cables.forEach(c => {
    const ends = [[c.from, c.to], [c.to, c.from]] as const;
    ends.forEach(([src, dst]) => {
      if (s.deviceOf(src.instance) !== 'studio-clock' || s.deviceOf(dst.instance) !== 'dfam' || dst.jack !== 'in_adv_clock') return;
      let ticksPer = 0;
      if (src.jack === 'out_beat') ticksPer = PPQN;
      else if (src.jack === 'out_clock') ticksPer = CLOCK_TICKS[Number(hub.valuesFor(src.instance).division ?? 2)] ?? PPQN / 4;
      if (!ticksPer) return;
      const pulsesBefore = Math.ceil(fromTick / ticksPer);
      const target = (pulsesBefore + DFAM_STEPS - 1) % DFAM_STEPS;
      const cur = Number(hub.getState(dst.instance).step);
      const at = Number.isFinite(cur) ? cur : DFAM_STEPS - 1;
      const n = (target - at + DFAM_STEPS) % DFAM_STEPS;
      for (let k = 0; k < n; k++) hub.event(dst.instance, 'advance');
    });
  });
}

// ============================================================================
// Studio A/B with loudness matching (listen steps)
// ============================================================================

type Side = 'a' | 'b';

export interface AbInfo {
  side: Side | null;
  /** Gain the matcher applies to each side now, dB (0 = untouched) */
  gainDb: Record<Side, number>;
  /** Loudness measured for each side, LUFS (null until heard) */
  lufs: Record<Side, number | null>;
  matching: boolean;
}

/** Does this listen step play the whole studio (several instruments, the master, swing, pattern settings)? */
export function isStudioListen(step: LessonStep | undefined): boolean {
  const l = step?.listen;
  return !!l && (!!l.parts || !!l.master || !!l.studio || !!l.patterns);
}

class StudioAB {
  private key = '';
  private side: Side | null = null;
  private overrides = new Map<string, Record<string, ControlValue>>();
  /** Instruments playing other pattern settings (an Elektron project override) */
  private dataOverrides = new Set<string>();
  private masterOn = false;
  private swingOn = false;
  private est: Record<Side, { e: number; n: number }> = { a: { e: 0, n: 0 }, b: { e: 0, n: 0 } };
  private predicted: Record<Side, number> = { a: 0, b: 0 };
  private applied = 0;
  private switchAt = 0;
  private match = false;
  private startedTransport = false;
  private auditionTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<() => void>();

  subscribe(l: () => void) { this.listeners.add(l); return () => { this.listeners.delete(l); }; }
  private emit() { this.listeners.forEach(l => l()); }

  info(key: string): AbInfo {
    const same = key === this.key;
    const l = (s: Side) => (same && this.est[s].n ? lufsOf(this.est[s].e / this.est[s].n) : null);
    return {
      side: same ? this.side : null,
      gainDb: { a: same ? this.gainFor('a') : 0, b: same ? this.gainFor('b') : 0 },
      lufs: { a: l('a'), b: l('b') },
      matching: same && this.match,
    };
  }

  /** Play side A or B of a listen step; the same side again stops */
  play(lesson: Lesson, stepIndex: number, side: Side) {
    const step = lesson.steps[stepIndex];
    const listen = step?.listen;
    if (!listen) return;
    const key = `${lesson.id}:${stepIndex}`;
    if (key !== this.key) { this.stop(); this.key = key; this.est = { a: { e: 0, n: 0 }, b: { e: 0, n: 0 } }; }
    if (this.side === side) { this.stop(); return; }
    this.clearOverrides();
    this.match = !!listen.matchLoudness;
    const s = useStudioStore.getState();
    const lessonInstance = stepInstance(step, lesson, s.lessonInstance);
    const studioWide = isStudioListen(step) || !!lesson.start?.studio;
    // Values on the step's instrument, then on any others
    const sets: [string, Record<string, ControlValue>][] = [];
    if (Object.keys(listen[side] ?? {}).length) sets.push([lessonInstance, listen[side]]);
    Object.entries(listen.parts?.[side] ?? {}).forEach(([k, v]) => { const inst = resolveInstance(k); if (inst) sets.push([inst, v]); });
    sets.forEach(([inst, values]) => {
      const eng = hub.getEngine(inst);
      if (!eng) return;
      const prev = this.overrides.get(inst) ?? {};
      Object.entries(values).forEach(([k, v]) => { eng.setParam(k, v); prev[k] = v; });
      this.overrides.set(inst, prev);
    });
    // Elektron pattern settings (SWING): every pattern of the instrument, so the song's too
    Object.entries(listen.patterns?.[side] ?? {}).forEach(([k, patch]) => {
      const inst = resolveInstance(k);
      const eng = inst ? hub.getEngine(inst) : undefined;
      if (!inst || !eng) return;
      eng.setData(withPatternPatch(s.devices[inst]?.data, patch, { all: true }));
      this.dataOverrides.add(inst);
    });
    const mp = listen.master?.[side];
    if (mp) { this.applyMaster(mp); this.masterOn = true; }
    const sw = listen.studio?.[side]?.swing;
    if (sw !== undefined) { transport.setSwing(sw); this.swingOn = true; }
    // Predicted loudness from the master fader alone (refined by measuring)
    const g = (x: Side) => listen.master?.[x]?.gain ?? masterOf(s.studio.mixer).gain;
    this.predicted = { a: g('a'), b: g('b') };
    this.side = side;
    this.switchAt = now();
    if (studioWide) {
      hub.ensureAudio();
      if (!transport.playing) {
        // Both sides on the same part of the song
        if (!(listen.from && playFromSection(listen.from))) hub.startAll({ countIn: false });
        this.startedTransport = true;
      }
    } else {
      // A single instrument with its own phrase: the hub audition plays it, then stops
      if (this.auditionTimer) clearTimeout(this.auditionTimer);
      hub.audition(lessonInstance, null, { ms: 3400 });
      this.auditionTimer = setTimeout(() => { if (this.side === side && this.key === key) this.stop(); }, 3400);
    }
    this.applyGain();
    this.emit();
  }

  private applyMaster(p: LessonMasterPatch) {
    const m = masterOf(useStudioStore.getState().studio.mixer);
    setMasterSettings({
      gain: dbToGain(p.gain ?? m.gain),
      eq: { ...m.eq, ...(p.eq ?? {}) },
      glue: { ...m.glue, ...(p.glue ?? {}) },
    });
  }

  private clearOverrides() {
    this.overrides.forEach((vals, inst) => {
      const eng = hub.getEngine(inst);
      if (!eng) return;
      const real = hub.valuesFor(inst);
      Object.keys(vals).forEach(k => eng.setParam(k, real[k]));
    });
    this.overrides.clear();
    // The real patterns back, as the store holds them now
    this.dataOverrides.forEach(inst => hub.getEngine(inst)?.setData(useStudioStore.getState().devices[inst]?.data));
    this.dataOverrides.clear();
    if (this.masterOn) {
      const m = masterOf(useStudioStore.getState().studio.mixer);
      setMasterSettings({ gain: dbToGain(m.gain), eq: m.eq, glue: m.glue });
      this.masterOn = false;
    }
    if (this.swingOn) { transport.setSwing(useStudioStore.getState().studio.swing ?? 0); this.swingOn = false; }
  }

  stop() {
    if (this.auditionTimer) { clearTimeout(this.auditionTimer); this.auditionTimer = null; }
    const was = this.side;
    this.clearOverrides();
    this.side = null;
    this.setOutputGain(1);
    if (this.startedTransport) { this.startedTransport = false; if (transport.playing) hub.stopAll(); }
    if (was) hub.stopAudition();
    if (was) this.emit();
  }

  /** Leave the step: stop and forget its measurements */
  reset() {
    this.stop();
    this.key = '';
    this.est = { a: { e: 0, n: 0 }, b: { e: 0, n: 0 } };
  }

  onFrame(f: MasterMeterFrame) {
    if (!this.side || f.m === null) return;
    // Skip the switch itself: the momentary window still holds the other side
    if (now() - this.switchAt < 600) return;
    const e = this.est[this.side];
    e.e += energyOf(f.m);
    e.n++;
    if (this.match) this.applyGain();
    if (e.n % 10 === 1) this.emit();
  }

  /** The matcher's gain for a side, dB: the louder side comes down to the quieter one */
  private gainFor(side: Side): number {
    if (!this.match) return 0;
    const other: Side = side === 'a' ? 'b' : 'a';
    const L = (s: Side) => (this.est[s].n >= 4 ? lufsOf(this.est[s].e / this.est[s].n) : null);
    const mine = L(side), theirs = L(other);
    if (mine !== null && theirs !== null) return Math.max(-24, Math.min(0, theirs - mine));
    // Not measured yet: predict from the master fader difference (limiting makes it a little less)
    const diff = this.predicted[side] - this.predicted[other];
    return diff > 0.5 ? -Math.min(24, diff * 0.8) : 0;
  }

  private applyGain() {
    if (!this.side) return;
    const g = dbToGain(this.gainFor(this.side));
    if (Math.abs(g - this.applied) > 0.005) this.setOutputGain(g);
  }

  private setOutputGain(g: number) {
    this.applied = g;
    try {
      // The master output after the limiter and meter: the meter keeps reading the real level
      const out = getRecordTap() as GainNode;
      if (!out.gain) return;
      if (isRecording() || isBouncing()) g = 1; // never change what is being recorded
      const ctx = getAudioContext();
      out.gain.cancelScheduledValues(ctx.currentTime);
      out.gain.setTargetAtTime(g, ctx.currentTime, 0.04);
    } catch { /* audio not started */ }
  }
}

const ab = new StudioAB();
export const studioAB = ab;

// ============================================================================
// Solutions: "show me one way" and the lesson runner
// ============================================================================

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Find a section by name (case-insensitive, spaces ignored) */
function sectionIndex(name: string): number {
  const norm = (x: string) => x.toLowerCase().replace(/\s+/g, '');
  return useStudioStore.getState().studio.arrangement.sections.findIndex(s => norm(s.name) === norm(name));
}

/** A route target with its mixer named by device or instance ('xone96:studio_1'), as the studio stores it */
function resolveRoute(target: string): string {
  if (target === 'master') return target;
  const [mixer, input] = target.split(':');
  return input ? `${resolveInstance(mixer) ?? mixer}:${input}` : target;
}

/** Set an Elektron pattern setting (SWING, LENGTH) on an instrument's active pattern */
export function setPatternSettings(instanceOrDevice: string, patch: LessonPatternPatch) {
  const inst = resolveInstance(instanceOrDevice);
  if (inst) useStudioStore.getState().updateDeviceData(inst, d => withPatternPatch(d, patch));
}

/**
 * Apply the studio parts of a solution: other instruments' values, the mixer, the master,
 * tempo / swing / routing, the song, arranger snapshots, Elektron pattern settings and
 * trigs, and the transport. Values, patches and data on the step's instrument are the
 * caller's (as before v3); `instance` is that instrument, for sequence edits that name none.
 */
export function applyStudioSolution(sol: LessonSolution, instance?: string) {
  const st = useStudioStore.getState();
  sol.studioCables?.forEach(c => {
    const a = resolveInstance(c.from.instance ?? c.from.device ?? '');
    const b = resolveInstance(c.to.instance ?? c.to.device ?? '');
    if (a && b) st.addStudioCable({ from: { instance: a, jack: c.from.jack }, to: { instance: b, jack: c.to.jack } });
  });
  Object.entries(sol.parts ?? {}).forEach(([k, v]) => {
    const inst = resolveInstance(k);
    if (inst) Object.entries(v).forEach(([id, val]) => hub.setControl(inst, id, val));
  });
  Object.entries(sol.channels ?? {}).forEach(([k, v]) => { const inst = resolveInstance(k); if (inst) st.setChannel(inst, v); });
  if (sol.master) {
    st.setMasterSection({
      ...(sol.master.gain !== undefined ? { gain: sol.master.gain } : {}),
      ...(sol.master.eq ? { eq: sol.master.eq } : {}),
      ...(sol.master.glue ? { glue: sol.master.glue } : {}),
    });
  }
  if (sol.studio?.bpm !== undefined) st.setBpm(sol.studio.bpm);
  if (sol.studio?.swing !== undefined) st.setSwing(sol.studio.swing);
  Object.entries(sol.studio?.routes ?? {}).forEach(([k, r]) => { const inst = resolveInstance(k); if (inst) st.setRoute(inst, resolveRoute(r)); });
  Object.entries(sol.studio?.sync ?? {}).forEach(([k, on]) => { const inst = resolveInstance(k); if (inst) st.setSync(inst, on); });
  if (sol.arrangement) {
    const arr = sol.arrangement;
    // Parts may name a device: they belong to its instance in this studio
    const sections = arr.sections?.map(x => ({
      ...x,
      parts: x.parts ? Object.fromEntries(Object.entries(x.parts).map(([k, p]) => [resolveInstance(k) ?? k, p])) : undefined,
    }));
    st.setArrangement(a => ({ enabled: arr.enabled ?? a.enabled, loop: arr.loop ?? a.loop, sections: sections ? sectionsFromStart(sections) : a.sections }));
  }
  Object.entries(sol.patterns ?? {}).forEach(([k, patch]) => setPatternSettings(k, patch));
  sol.sequence?.forEach(e => {
    const inst = resolveInstance(e.instance ?? instance ?? '');
    if (!inst) return;
    const stamp = STAMPS_TRIGS.has(st.deviceOf(inst));
    useStudioStore.getState().updateDeviceData(inst, d => withSequenceEdit(d, e, { stamp }));
  });
  sol.capture?.forEach(c => {
    const i = sectionIndex(c.section);
    if (i >= 0) captureInto(i, c.instance, c.controls, c.values);
  });
  if (sol.transport === 'stop' && transport.playing) hub.stopAll();
}

/**
 * An arranger snapshot of chosen controls: the instrument's current values of `controls`
 * (all its controls without a list), plus `extra`, into section `index`'s snapshot. A
 * partial capture merges with what the snapshot already holds.
 */
export function captureInto(index: number, instanceOrDevice: string, controls?: string[], extra?: Record<string, ControlValue>) {
  const inst = resolveInstance(instanceOrDevice);
  const st = useStudioStore.getState();
  if (!inst || index < 0 || index >= st.studio.arrangement.sections.length) return;
  const all = { ...hub.valuesFor(inst), ...(extra ?? {}) };
  const picked: Record<string, ControlValue> = controls ? Object.fromEntries(controls.filter(k => all[k] !== undefined).map(k => [k, all[k]])) : all;
  st.setArrangement(a => ({
    ...a,
    sections: a.sections.map((x, k) => {
      if (k !== index) return x;
      const prev = (x.parts[inst]?.snapshot ?? {}) as Record<string, ControlValue>;
      return { ...x, parts: { ...x.parts, [inst]: { ...x.parts[inst], snapshot: controls ? { ...prev, ...picked } : picked } } };
    }),
  }));
}

/** Start the song from a section (song mode on), like the arranger's "▶ from here" */
export function playFromSection(name: string): boolean {
  const i = sectionIndex(name);
  if (i < 0) return false;
  const st = useStudioStore.getState();
  if (!st.studio.arrangement.enabled) st.setArrangement(a => ({ ...a, enabled: true }));
  hub.ensureAudio();
  arranger.playFrom(i);
  return true;
}

/** Run the timed parts of a solution: play for a while, bounce, record. Resolves when done. */
export async function runTimedSolution(sol: LessonSolution, opts: { until?: () => boolean } = {}): Promise<void> {
  const st = useStudioStore.getState();
  if (sol.play) {
    if (sol.play.song && st.studio.arrangement.sections.length && !st.studio.arrangement.enabled) st.setArrangement(a => ({ ...a, enabled: true }));
    if (transport.playing && (sol.play.fromStart || sol.play.song || sol.play.from)) { hub.stopAll(); await wait(400); }
    if (sol.play.from && playFromSection(sol.play.from)) { /* started at that section */ }
    else if (!transport.playing) hub.startAll({ countIn: false, fromTick: 0 });
    const secs = sol.play.song ? songSeconds() + 1 : sol.play.seconds ?? 8;
    const t0 = now();
    while (now() - t0 < secs * 1000) {
      if (opts.until?.()) break;
      await wait(250);
    }
  }
  if (sol.bounce) {
    await new Promise<void>(resolve => {
      void bounceSong({ stems: !!sol.bounce?.stems, normalize: false }, (p: BounceProgress) => {
        if (p.phase === 'done' || p.phase === 'cancelled' || p.phase === 'error') resolve();
      });
    });
    await wait(400);
    pollTakes();
  }
  if (sol.record) {
    await startRecording({ stems: !!sol.record.stems });
    pollTakes();
    if (!transport.playing) hub.startAll({ countIn: false });
    await wait(sol.record.seconds * 1000);
    await stopRecording();
    await wait(200);
    pollTakes();
  }
}

/** Does a solution need time (play, bounce, record)? */
export function isTimedSolution(sol: LessonSolution | undefined): boolean {
  return !!sol && (!!sol.play || !!sol.bounce || !!sol.record);
}

// ============================================================================
// Navigation: take the learner to where a step happens
// ============================================================================

const AREA_SELECTOR: Record<string, string> = {
  mixer: 'section[aria-label="Mixer"]',
  master: 'section[aria-label="Mixer"] [aria-label="Master"]',
  arranger: 'section[aria-label="Song arranger"]',
  rack: 'section[aria-label="Rack"]',
};

function tabButtons(): HTMLButtonElement[] {
  return Array.from(document.querySelectorAll<HTMLButtonElement>('nav[aria-label="Instruments"] button'));
}

/** Show an instrument (its tab) or a part of the Studio tab. Returns false when it can't. */
export function goTo(target: { instance?: string; area?: LessonStep['area'] }): boolean {
  if (typeof document === 'undefined') return false;
  if (target.area === 'transport') {
    document.querySelector('header')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return true;
  }
  if (target.area) {
    const sel = AREA_SELECTOR[target.area];
    const find = () => (sel ? document.querySelector(sel) : null);
    if (!find()) tabButtons().find(b => /Studio/.test(b.textContent ?? ''))?.click();
    setTimeout(() => find()?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
    return true;
  }
  if (target.instance) {
    const inst = resolveInstance(target.instance);
    if (!inst) return false;
    const st = useStudioStore.getState();
    const r = st.studio.rack.find(x => x.id === inst);
    const spec = getSpec(r?.device ?? '');
    const label = r?.label ?? spec?.name ?? inst;
    const tab = tabButtons().find(b => (b.textContent ?? '').trim() === label) ?? tabButtons().find(b => (b.textContent ?? '').includes(label));
    if (tab) { tab.click(); setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 60); return true; }
    document.querySelector(`[data-rack-slot="${CSS.escape(inst)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return true;
  }
  return false;
}

// ============================================================================
// Publishing and installation
// ============================================================================

let publishQueued = false;
let lastPublish = 0;

function publish() {
  publishQueued = false;
  lastPublish = now();
  if (meterLive && now() - lastFrameAt > 1500) meterLive = false;
  setLessonLive({
    meters: { live: meterLive, master: masterMeters(), channels: channelMeters() },
    bounce: { recording: isRecording(), bouncing: isBouncing(), last: lastTake, count: takeCount },
    history: historyApi,
    arranger: arrangerState,
  });
  const s = useStudioStore.getState();
  if (s.isTeachingMode && !s.lessonFinished) s.reevaluate();
}

function schedulePublish() {
  if (publishQueued) return;
  publishQueued = true;
  setTimeout(publish, Math.max(0, 200 - (now() - lastPublish)));
}

let arrangerState: { section: number; bar: number; name?: string } = { section: -1, bar: 0 };
let installed = false;


function lessonActive() {
  const s = useStudioStore.getState();
  return s.isTeachingMode && !!s.currentLesson;
}

function tick() {
  pollTakes();
  const active = lessonActive();
  if (active || take) sampleChannels();
  // Studio strip meters run while a lesson needs them
  if (active && !stripWatch && hub.mixer) stripWatch = hub.mixer.watchLevels(() => undefined);
  if (!active && stripWatch) { stripWatch(); stripWatch = null; }
  if (active || take) schedulePublish();
}

/** The lesson runner's handle (window.__synthLesson) */
export const lessonRuntimeApi = {
  applyStudioSolution,
  setPatternSettings,
  runTimedSolution,
  isTimedSolution,
  resolveInstance,
  captureInto,
  playFromSection,
  studioAB,
  publish,
  /** Recorder nodes created so far (stems check) */
  recorders: () => recorderCount,
};

function install() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  watchRecorders();
  onMasterMeter(onFrame);
  arranger.init();
  arranger.subscribe(p => {
    const arr = useStudioStore.getState().studio.arrangement;
    arrangerState = { section: p.section, bar: p.bar, ...(p.section >= 0 && arr.sections[p.section] ? { name: arr.sections[p.section].name } : {}) };
    schedulePublish();
  });
  transport.onEvent(e => {
    if (e.type === 'start') {
      const from = transport.startedAtTick;
      track = freshTrack(from === 0);
      channelTracks.forEach(c => { c.max = -Infinity; });
      take?.onStart(from);
      alignClocked(from);
    } else if (e.type === 'stop') {
      take?.onStop();
    }
    schedulePublish();
  });
  useStudioStore.subscribe((s, prev) => {
    // A new lesson: start its history afresh
    const lessonId = s.isTeachingMode ? s.currentLesson?.id : undefined;
    if (lessonId !== histLesson) {
      histLesson = lessonId;
      hist = new Map();
      lastTake = undefined;
      takeCount = 0;
      ab.reset();
    }
    if (s.currentStep !== prev.currentStep || s.currentLesson !== prev.currentLesson) ab.reset();
    const automation = historyPaused();
    if (s.devices !== prev.devices) {
      Object.keys(s.devices).forEach(inst => {
        const a = s.devices[inst]?.controlValues, b = prev.devices[inst]?.controlValues;
        if (a === b || !a) return;
        const keys = new Set([...Object.keys(a), ...Object.keys(b ?? {})]);
        let defaults: Record<string, ControlValue> | null = null;
        let any = false;
        keys.forEach(k => {
          if (a[k] === b?.[k]) return;
          any = true;
          if (!lessonId || automation) return;
          if (!defaults) defaults = specDefaults(s.deviceOf(inst));
          recordChange(inst, k, b?.[k] ?? defaults[k], a[k] ?? defaults[k]);
        });
        if (any && transport.playing && !automation) track.steady = false;
      });
    }
    if (s.studio.mixer !== prev.studio.mixer) {
      const g0 = masterOf(prev.studio.mixer).gain, g1 = masterOf(s.studio.mixer).gain;
      if (lessonId && g0 !== g1) recordChange('master', 'gain', g0, g1);
      if (transport.playing && !automation) track.steady = false;
    }
    if (s.studio.swing !== prev.studio.swing && transport.playing && !automation) track.steady = false;
  });
  setLessonStudioHooks({
    stopAll: () => { ab.reset(); if (transport.playing) hub.stopAll(); },
    studioReplaced: () => {
      undoHistory.clear();
      channelTracks.clear();
      track = freshTrack();
      schedulePublish();
    },
  });
  setInterval(tick, 100);
  (window as unknown as { __synthLesson?: typeof lessonRuntimeApi }).__synthLesson = lessonRuntimeApi;
  publish();
}

install();
