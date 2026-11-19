// ============================================================================
// Analog Rytm MKII audio engine
//
//   'analog-rytm' worklet: 8 voices (machines, sample layer, overdrive, filter,
//      amp), 12 track LFOs + FX LFO, the FX delay       out: dry | delay | reverb send | ctl
//        reverb send -> Reverb2 (shared FDN reverb) -> reverb return
//   'analog-rytm-master': distortion + compressor with PRE/POST returns
//        -> MAIN VOLUME -> out
//
// The ElektronSequencer (13 tracks: 12 drum tracks + the FX track's lock trigs)
// schedules trigs on the audio clock; each trig carries its parameter locks.
// The engine only translates: controls -> worklet parameters, trigs -> timed
// messages, kits / scenes / performance macros -> parameter tables.
//
// Kits: every pattern can link a kit (pattern.kit). When a linked pattern
// starts, the engine loads the kit at that audio time and tells the panel
// (engine state `ops`) to save the old kit's values and show the new ones.
// ============================================================================

import type { ControlValue } from '@/types';
import { BaseEngine } from '@/lib/audio/engine';
import type { Transport } from '@/lib/audio/transport';
import { Reverb2 } from '@/lib/audio/dsp';
import {
  ElektronSequencer, NOTE_LENGTHS, RETRIG_RATES, asProject, getPattern, stepSeconds, trackLength, trackSpeed,
  type SeqState, type TrigEvent,
} from '@/lib/sequencer/elektron';
import {
  FX, FX_PAGES, FX_TRACK, FX_TRACK_LEVEL, IX, MACHINES, SEQ_TRACKS, TRACKS, TRACK_EXTRA, TRACK_OUTS, TRACK_PAGES, TRIG_PAGE, parseId,
} from './model';
import { ANALOG_RYTM, KIT_CONTROL_IDS } from './spec';
import type { RytmProject } from './presets';
import { SOUND_LOCK, lenIndexOf, stepsBetween, type LiveHit, type LiveLock } from './live';
import { lockIndex, soundFits, soundLockMap, type RytmSound } from './pool';
import { euclidView } from './euclid';
import { getSample, prepareForWorklet } from './samples';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const expT = (v: number, lo: number, hi: number) => lo * Math.pow(hi / lo, clamp(v, 0, 127) / 127);

/** Track page key -> worklet parameter index */
const PAGE_IDX: Record<string, number> = {};
for (const page of [...Object.values(TRACK_PAGES), TRACK_EXTRA, TRIG_PAGE]) for (const p of page) if (p.idx !== undefined) PAGE_IDX[p.key] = p.idx;
/** FX key -> FX parameter index */
const FX_IDX: Record<string, number> = {};
for (const page of Object.values(FX_PAGES)) for (const p of page) if (p && p.idx !== undefined) FX_IDX[p.key] = p.idx;
FX_IDX[FX_TRACK_LEVEL.key] = FX_TRACK_LEVEL.idx!;
/** The reverb runs in a Reverb2 node: its parameters (and the FX track level, its master return) are applied here */
const REVERB_KEYS = new Set(['rev_pre', 'rev_dec', 'rev_frq', 'rev_gai', 'rev_hpf', 'rev_lpf', 'rev_vol', 'trk_lev']);
const FX_KEY_OF: Record<number, string> = Object.fromEntries(Object.entries(FX_IDX).map(([k, i]) => [i, k]));

const DEFAULTS: Record<string, ControlValue> = {};
for (const [id, c] of Object.entries(ANALOG_RYTM.controls)) if ('default' in c && c.default !== undefined) DEFAULTS[id] = c.default as ControlValue;

type RytmOpInput =
  | { type: 'kit'; from: string; to: string }
  // LIVE RECORDING (manual pp.40, 47): a hit, how long it was held, an encoder turn
  | ({ type: 'rec' } & LiveHit)
  | { type: 'reclen'; pattern: string; track: number; step: number; len: number; retrig?: boolean }
  | ({ type: 'lock' } & LiveLock)
  // STEP RECORDING (manual p.40): a trig on the active step, or a rest there ([NO])
  | ({ type: 'step' } & LiveHit)
  | { type: 'rest'; pattern: string; track: number; step: number };
export type RytmOp = RytmOpInput & { n: number };

/** An encoder turn during LIVE RECORDING, as the panel reports it (index.ts / ui.tsx LiveRec) */
export interface LiveTurn { n: number; track: number; key: string; value: number; at: number }

/** Encoder turns of one parameter less than this many steps apart record the steps in between too */
const FILL_STEPS = 3;

/** STEP RECORDING events: 'rytm:step-rec' { on } / { toggleJump }, ':select' { step }, ':move' { dir }, ':rest' */
type StepRecPayload = { on?: boolean; toggleJump?: boolean; step?: number; dir?: number };
/** STEP RECORDING state in the engine state (`stepRec`) */
export interface StepRecState { on: boolean; jump: boolean; step: number }

const num = (v: ControlValue | undefined, d = 0) => (typeof v === 'number' ? v : typeof v === 'boolean' ? (v ? 1 : 0) : d);

export class AnalogRytmEngine extends BaseEngine {
  private node!: AudioWorkletNode;
  private master!: AudioWorkletNode;
  /** The eight TRACK OUTs (worklet output 4, a channel per voice) and where each one goes */
  private trackOuts!: ChannelSplitterNode;
  private trackOutDest: (AudioNode | null)[] = new Array(8).fill(null);
  private reverb!: Reverb2;
  private revVol!: GainNode;
  private mainVol!: GainNode;
  private seq!: ElektronSequencer;
  /** Mirror of the control values the worklet holds, per track (keys without prefix) and FX */
  private vals: Record<string, number>[] = TRACKS.map(() => ({}));
  private fxv: Record<string, number> = {};
  private mach = new Int32Array(12);
  private project: RytmProject | null = null;
  private kitId = '';
  private lastDataKit: string | undefined = undefined;
  private lastActive = '';
  private pending: { at: number; values: Record<string, ControlValue> } | null = null;
  private padLv = new Float32Array(12);
  private ops: { sid: string; n: number; list: RytmOp[] } = { sid: Math.random().toString(36).slice(2), n: 0, list: [] };
  private scene = -1;
  /** Pad pressure of each performance macro (PERF mode), 0..1 */
  private perfAmt = new Float64Array(12);
  /** Macros under the QUICK PERF AMOUNT knob ([QPER] + pads) */
  private perfQuick = new Uint8Array(12);
  /** [FUNC] + [QPER]: the performance macros are muted */
  private perfMuted = false;
  /** FX track lock on a reverb parameter (held until the next FX trig) and the FX LFO's reverb offset */
  private revLock: Record<string, number> = {};
  private revLfo: { key: string; v: number } | null = null;
  private stepClock = Array.from({ length: SEQ_TRACKS }, () => ({ step: -1, time: 0 }));
  private retrigs = new Map<number, { next: number; vel: number; start: number; timer: ReturnType<typeof setInterval> }>();
  private auditionStop: (() => void) | null = null;
  private auditionTimer: ReturnType<typeof setTimeout>[] = [];
  private lastBpm = 0;
  private fxOffTimer: ReturnType<typeof setTimeout> | null = null;
  /** LIVE RECORDING: the hit recorded for each track's held pad (its length is written on release) */
  private liveHits = new Map<number, { pattern: string; step: number; t0: number; stepDur: number; retrig: boolean }>();
  /** LIVE RECORDING: the last recorded turn of each track's parameter ("track:key") */
  private lastTurn = new Map<string, { pattern: string; step: number; value: number; t: number }>();
  /** The pool Sound each track's last note trig played (a sound lock), for the lock trigs after it */
  private soundOn: (RytmSound | null)[] = TRACKS.map(() => null);
  /** Keys and MIDI notes held: note -> track; the latest note of each track (a track plays one note at a time) */
  private keyNotes = new Map<number, number>();
  private keyLatest = new Map<number, number>();
  /** STEP RECORDING (manual pp.40-41): on, JUMP mode, the active step */
  private stepRec = { on: false, jump: false, step: 0 };
  /** STEP RECORDING: hits held now, the first one's LEN (JUMP), [YES]-held hits (their length is recorded) */
  private stepDown = 0;
  private stepFirstLen = -1;
  private stepTimed = new Map<number, { pattern: string; step: number; t0: number; dur: number }>();
  /** User samples (samples.ts): the id each slot should hold, the one the worklet has, and the ones this browser lacks */
  private smpWant: (string | null)[] = new Array(33).fill(null);
  private smpLoaded: (string | null)[] = new Array(33).fill(null);
  private smpMissing = new Map<number, string>();

  protected build(): void {
    const ctx = this.ctx;
    this.node = new AudioWorkletNode(ctx, 'analog-rytm', {
      numberOfInputs: 0, numberOfOutputs: 5, outputChannelCount: [2, 2, 2, 12, 8],
    });
    this.trackOuts = ctx.createChannelSplitter(8);
    this.node.connect(this.trackOuts, 4);
    // channelCountMode 'max': each input takes its source's channel count (2, 2, 2 and 12 control channels)
    this.master = new AudioWorkletNode(ctx, 'analog-rytm-master', {
      numberOfInputs: 4, numberOfOutputs: 1, outputChannelCount: [2], channelInterpretation: 'discrete',
    });
    this.reverb = new Reverb2(ctx, 2.5, { lowCut: 120, highCut: 9000 });
    this.revVol = ctx.createGain();
    this.mainVol = ctx.createGain();
    this.node.connect(this.master, 0, 0);
    this.node.connect(this.master, 1, 1);
    this.node.connect(this.reverb.input, 2);
    this.reverb.output.connect(this.revVol).connect(this.master, 0, 2);
    this.node.connect(this.master, 3, 3);
    this.master.connect(this.mainVol).connect(this.out);
    this.node.port.onmessage = (e: MessageEvent) => {
      const m = e.data as { t: string; lv?: Float32Array; rv?: number; rvv?: number };
      if (m.t !== 'lv') return;
      if (m.lv) this.padLv.set(m.lv);
      // FX LFO on a reverb parameter: the worklet reports the effective value (~30 Hz)
      const key = m.rv !== undefined && m.rv >= 0 ? FX_KEY_OF[m.rv] : undefined;
      if (key && REVERB_KEYS.has(key)) { this.revLfo = { key, v: m.rvv ?? 0 }; this.applyReverb(0); }
      else if (this.revLfo) { this.revLfo = null; this.applyReverb(0); }
    };

    this.seq = new ElektronSequencer({
      ctx,
      tracks: SEQ_TRACKS,
      bpm: this.num('bpm', 120),
      onTrig: e => this.onTrig(e),
      onNoteOff: (track, _note, time) => { if (track < 12) this.post({ t: 'off', at: time, tr: track }); },
      onPattern: (id, time) => this.onPattern(id, time),
      onStep: (track, step, time) => { const c = this.stepClock[track]; c.step = step; c.time = time; },
      // [STOP] (or the studio's stop, or a song's end) cuts every track's sound; the delay and
      // reverb ring on (manual p.37). A pause ([PLAY] while playing) lets the sounds decay.
      onPlay: playing => { if (!playing && !this.seq.isPaused) this.post({ t: 'stop' }); },
    });
    this.seq.subscribe(s => this.onSeqState(s));

    this.onDispose(() => {
      this.seq.dispose();
      if (this.fxOffTimer) clearTimeout(this.fxOffTimer);
      this.retrigs.forEach(r => clearInterval(r.timer));
      this.auditionTimer.forEach(t => clearTimeout(t));
      this.node.port.onmessage = null;
      [this.node, this.master, this.revVol, this.mainVol].forEach(n => { try { n.disconnect(); } catch { /* */ } });
      try { this.reverb.output.disconnect(); } catch { /* */ }
    });

    // Start from the defaults so the voices are set before the first control push
    this.applyKit(DEFAULTS, 0);
    this.emit({ playing: false, padLv: this.padLv, ops: this.ops, scene: -1, perf: Array.from(this.perfAmt), perfQuick: Array.from(this.perfQuick), perfMuted: false, kit: this.kitId });
  }

  private post(m: Record<string, unknown>) {
    this.node?.port.postMessage(m);
  }

  /**
   * A TRACK OUT in the studio (DeviceModule.studio.outputs): the voice plays there, mono after
   * its level, and leaves the main mix and the master effects; null puts it back.
   */
  connectOutput(id: string, destination: AudioNode | null) {
    const k = TRACK_OUTS.findIndex(o => o.id === id);
    if (k < 0 || !this.trackOuts) return;
    const prev = this.trackOutDest[k];
    if (prev) { try { this.trackOuts.disconnect(prev, k); } catch { /* already gone */ } }
    this.trackOutDest[k] = destination;
    if (destination) this.trackOuts.connect(destination, k);
    this.post({ t: 'indiv', k, on: !!destination });
  }

  // --------------------------------------------------------------------------
  // Controls -> worklet
  // --------------------------------------------------------------------------

  /** Worklet target of a control id for the current machine: track (12 = FX) and index */
  private target(track: number, key: string): number {
    if (track === FX_TRACK) return FX_IDX[key] ?? -1;
    const pi = PAGE_IDX[key];
    if (pi !== undefined) return pi;
    return MACHINES[this.mach[track]]?.slots.indexOf(key) ?? -1;
  }

  /** Scheduled time for a parameter change: kit switches wait for their audio time */
  private paramTime(): number {
    if (!this.pending) return 0;
    if (this.pending.at <= this.ctx.currentTime) { this.pending = null; return 0; }
    return this.pending.at;
  }

  protected onParam(id: string, value: ControlValue): void {
    const v = num(value);
    switch (id) {
      case 'play':
        if (!this.transport) { if (value) this.seq.start(); else this.seq.stop(); }
        return;
      case 'bpm': this.seq.setTempo(v); return;
      case 'main_volume': this.mainVol.gain.setTargetAtTime(Math.pow(v / 100, 2), this.ctx.currentTime, 0.01); return;
      case 'qper': this.applyPerf(); return;
    }
    const pi = parseId(id);
    if (!pi) return;
    const at = this.paramTime();
    if (pi.track === FX_TRACK) {
      this.fxv[pi.key] = v;
      const i = FX_IDX[pi.key];
      if (i !== undefined) this.post({ t: 'fx', i, v, at });
      if (REVERB_KEYS.has(pi.key)) this.applyReverb(at);
      return;
    }
    const tr = pi.track;
    if (pi.key === 'machine') {
      const t = TRACKS[tr];
      this.mach[tr] = t.machines[clamp(Math.round(v), 0, t.machines.length - 1)];
      this.post({ t: 'm', tr, m: this.mach[tr], slots: this.slotValues(tr), at });
      return;
    }
    this.vals[tr][pi.key] = v;
    const i = this.target(tr, pi.key);
    if (i >= 0) this.post({ t: 'k', tr, i, v, at });
  }

  private slotValues(tr: number): number[] {
    const m = MACHINES[this.mach[tr]];
    return m.slots.map(k => (k ? this.vals[tr][k] ?? 0 : 0));
  }

  /** Load a whole kit (control id -> value) into the worklet at audio time `at` */
  private applyKit(values: Record<string, ControlValue>, at: number) {
    const tracks = TRACKS.map((t, tr) => {
      const vals: Record<string, number> = {};
      for (const id in values) {
        const pi = parseId(id);
        if (pi && pi.track === tr) vals[pi.key] = num(values[id]);
      }
      this.vals[tr] = { ...this.vals[tr], ...vals };
      const mIdx = clamp(Math.round(this.vals[tr].machine ?? t.machines.indexOf(t.machine)), 0, t.machines.length - 1);
      this.mach[tr] = t.machines[mIdx];
      const p = new Array<number>(IX.COUNT).fill(0);
      for (const key in PAGE_IDX) p[PAGE_IDX[key]] = this.vals[tr][key] ?? 0;
      this.slotValues(tr).forEach((x, s) => { p[s] = x; });
      return { m: this.mach[tr], p };
    });
    for (const id in values) {
      const pi = parseId(id);
      if (pi && pi.track === FX_TRACK) this.fxv[pi.key] = num(values[id]);
    }
    const fx = new Array<number>(FX.COUNT).fill(0);
    for (const key in FX_IDX) fx[FX_IDX[key]] = this.fxv[key] ?? 0;
    this.post({ t: 'kit', at, tracks, fx });
    this.applyReverb(at);
  }

  /**
   * The FX track's reverb parameters -> Reverb2: the kit value (or the scene's, or an
   * FX-track lock), plus the performance macros' depth, or the FX LFO's effective value.
   * The FX track level is the master return of the reverb (and of the delay, in the worklet).
   */
  private applyReverb(at: number) {
    if (!this.reverb) return;
    const v = (k: string) => {
      if (this.revLfo && this.revLfo.key === k) return this.revLfo.v;
      const base = this.sceneRev[k] ?? this.revLock[k] ?? this.fxv[k] ?? num(DEFAULTS[`fx_${k}`]);
      return base + (this.perfRev[k] ?? 0);
    };
    const t = Math.max(this.ctx.currentTime, at || 0);
    const set = (p: AudioParam, x: number) => { p.cancelScheduledValues(t); p.setTargetAtTime(x, t, 0.02); };
    const c = (x: number) => clamp(x, 0, 127);
    set(this.reverb.preDelay, Math.pow(c(v('rev_pre')) / 127, 2) * 0.3);
    set(this.reverb.decay, expT(c(v('rev_dec')), 0.25, 14));
    set(this.reverb.size, 0.35 + 0.65 * c(v('rev_dec')) / 127);
    const shelf = expT(c(v('rev_frq')), 600, 16000);
    set(this.reverb.damping, clamp(shelf * (0.25 + 1.75 * Math.pow(c(v('rev_gai')) / 127, 2)), 200, 20000));
    const lev = c(v('trk_lev')) / 100;
    set(this.revVol.gain, Math.pow(c(v('rev_vol')) / 127, 2) * 1.5 * lev * lev);
    this.reverb.set({ lowCut: expT(c(v('rev_hpf')), 20, 2000), highCut: expT(c(v('rev_lpf')), 600, 20000) });
  }

  // --------------------------------------------------------------------------
  // Kits
  // --------------------------------------------------------------------------

  /** Full control values of a stored kit */
  private kitFull(id: string): Record<string, ControlValue> {
    const k = this.project?.kits?.[id];
    const out: Record<string, ControlValue> = {};
    for (const cid of KIT_CONTROL_IDS) out[cid] = DEFAULTS[cid];
    if (k) for (const cid in k.values) if (cid in out) out[cid] = k.values[cid];
    return out;
  }

  private maybeSwitch(pattern: string, at: number) {
    const p = this.project;
    if (!p) return;
    const link = p.patterns[pattern]?.kit;
    if (!link || link === this.kitId || !p.kits?.[link]) return;
    const from = this.kitId;
    this.kitId = link;
    const values = this.kitFull(link);
    this.applyKit(values, at);
    this.pending = at > this.ctx.currentTime ? { at, values } : null;
    this.pushOp({ type: 'kit', from, to: link });
    this.scene = -1;
    this.revLock = {};
    this.applyScene();
    this.applyPerf();
    this.emit({ kit: link, scene: -1 });
  }

  private pushOp(op: RytmOpInput) {
    const n = this.ops.n + 1;
    this.ops = { sid: this.ops.sid, n, list: [...this.ops.list.slice(-31), { ...op, n } as RytmOp] };
    this.emit({ ops: this.ops });
  }

  /**
   * User samples (samples.ts): a slot the project gives a sample of the learner's loads it from
   * IndexedDB into the worklet; a slot whose sample isn't in this browser keeps its built-in
   * one-shot, and `samplesMissing` (engine state) says which, for the panel to tell.
   */
  private syncSamples(map: RytmProject['samples']) {
    for (let slot = 1; slot <= 32; slot++) {
      const ref = map?.[slot];
      const want = ref?.id ?? null;
      if (want === this.smpWant[slot]) continue;
      this.smpWant[slot] = want;
      if (!want) {
        if (this.smpLoaded[slot]) { this.post({ t: 'smp', slot, data: null }); this.smpLoaded[slot] = null; }
        if (this.smpMissing.delete(slot)) this.emitMissing();
        continue;
      }
      const name = ref!.name;
      void getSample(want).then(async s => {
        if (this.smpWant[slot] !== want || !this.node) return;
        if (!s) {
          if (this.smpLoaded[slot]) { this.post({ t: 'smp', slot, data: null }); this.smpLoaded[slot] = null; }
          this.smpMissing.set(slot, name);
          this.emitMissing();
          return;
        }
        const pcm = await prepareForWorklet(s, this.ctx.sampleRate);
        if (this.smpWant[slot] !== want) return;
        this.node.port.postMessage({ t: 'smp', slot, data: pcm }, [pcm.buffer]);
        this.smpLoaded[slot] = want;
        if (this.smpMissing.delete(slot)) this.emitMissing();
      }).catch(() => { this.smpMissing.set(slot, name); this.emitMissing(); });
    }
  }

  private emitMissing() {
    this.emit({ samplesMissing: [...this.smpMissing].sort((a, b) => a[0] - b[0]).map(([slot, name]) => ({ slot, name })) });
  }

  protected onData(data: unknown): void {
    const p = asProject(data, SEQ_TRACKS) as RytmProject;
    this.project = p;
    // Euclidean tracks play their generated trigs (euclid.ts; the same project when there are none)
    this.seq.setProject(euclidView(p));
    this.syncSamples(p.samples);
    if (p.kit !== this.lastDataKit) {
      this.lastDataKit = p.kit;
      if (p.kit) { this.kitId = p.kit; this.emit({ kit: p.kit }); }
    }
    if (p.active !== this.lastActive) {
      const first = this.lastActive === '';
      this.lastActive = p.active;
      if (!first && !this.seq.playing) this.maybeSwitch(p.active, 0);
    }
    // scenes and macros live in the kit: edits apply at once
    if (this.scene >= 0) this.applyScene();
    if (this.perfAmt.some(a => a > 0) || this.perfQuick.some(Boolean)) this.applyPerf();
  }

  private onPattern(id: string, time: number) {
    this.maybeSwitch(id, time);
  }

  // --------------------------------------------------------------------------
  // Scenes and performance macros
  // --------------------------------------------------------------------------

  private currentKit() {
    return this.project?.kits?.[this.kitId];
  }

  private applyScene() {
    this.post({ t: 'ovrclear' });
    const sc = this.scene >= 0 ? this.currentKit()?.scenes?.[this.scene] : undefined;
    const rev: Record<string, number> = {};
    if (sc) for (const id in sc) {
      const pi = parseId(id);
      if (!pi) continue;
      if (pi.track === FX_TRACK && REVERB_KEYS.has(pi.key)) rev[pi.key] = sc[id];
      const i = this.target(pi.track, pi.key);
      if (i >= 0) this.post({ t: 'ovr', tr: pi.track, i, v: sc[id] });
    }
    this.sceneRev = rev;
    this.applyReverb(0);
  }

  private sceneRev: Record<string, number> = {};
  private perfRev: Record<string, number> = {};

  /** Amount of each macro: pad pressure in PERF mode, or the QUICK PERF AMOUNT knob for the assigned ones */
  private perfAmounts(): number[] {
    const q = this.num('qper', 0) / 127;
    return Array.from(this.perfAmt, (a, i) => (this.perfMuted ? 0 : Math.max(a, this.perfQuick[i] ? q : 0)));
  }

  /**
   * Performance macros: each lock is a depth (an offset from the sound's value, manual p.30),
   * applied in proportion to the amount; macros on one parameter add up.
   */
  private applyPerf() {
    this.post({ t: 'perfclear' });
    const kit = this.currentKit();
    const amts = this.perfAmounts();
    const sum = new Map<string, number>();
    for (let i = 0; i < 12; i++) {
      const amt = amts[i];
      const macro = kit?.perfs?.[i];
      if (amt <= 0 || !macro) continue;
      for (const id in macro) sum.set(id, (sum.get(id) ?? 0) + macro[id] * amt);
    }
    const rev: Record<string, number> = {};
    sum.forEach((add, id) => {
      const pi = parseId(id);
      if (!pi) return;
      if (pi.track === FX_TRACK && REVERB_KEYS.has(pi.key)) rev[pi.key] = add;
      const i = this.target(pi.track, pi.key);
      if (i >= 0) this.post({ t: 'perf', tr: pi.track, i, add });
    });
    this.perfRev = rev;
    this.applyReverb(0);
    this.emit({ perf: amts, perfQuick: Array.from(this.perfQuick), perfMuted: this.perfMuted });
  }

  // --------------------------------------------------------------------------
  // Sequencer
  // --------------------------------------------------------------------------

  private convertLocks(track: number, locks: Readonly<Record<string, number>>): Record<number, number> {
    const out: Record<number, number> = {};
    for (const key in locks) {
      const i = this.target(track, key);
      if (i >= 0) out[i] = locks[key];
    }
    return out;
  }

  /** The pool Sound a trig's sound lock plays on `track`, if the track can run it (manual p.48) */
  private lockedSound(track: number, locks: Readonly<Record<string, number>>): RytmSound | null {
    const slot = locks[SOUND_LOCK];
    if (slot === undefined || track >= 12) return null;
    const snd = this.project?.pool?.[Math.round(slot) - 1];
    return soundFits(snd, track) ? snd : null;
  }

  /** A sound-locked trig: the whole pool Sound as locks, with the trig's own locks on top (keys mapped to its machine) */
  private soundLocks(snd: RytmSound, locks: Readonly<Record<string, number>>): Record<number, number> {
    const out: Record<number, number> = { ...soundLockMap(snd) };
    for (const key in locks) {
      const i = lockIndex(snd.machine, key);
      if (i >= 0) out[i] = locks[key];
    }
    return out;
  }

  private onTrig(e: TrigEvent) {
    if (e.track === FX_TRACK) {
      // FX track: lock trigs only. The worklet holds them until the next FX trig;
      // the reverb's (a separate node) are scheduled here.
      this.post({ t: 'fxlocks', at: e.time, locks: this.convertLocks(FX_TRACK, e.locks) });
      const rl: Record<string, number> = {};
      for (const k in e.locks) if (REVERB_KEYS.has(k)) rl[k] = e.locks[k];
      if (Object.keys(rl).length || Object.keys(this.revLock).length) { this.revLock = rl; this.applyReverb(e.time); }
      return;
    }
    if (e.trigless) {
      // a lock trig that only keeps a sound lock (LIVE RECORDING erased its note trig) does nothing
      if (e.locks[SOUND_LOCK] !== undefined && Object.keys(e.locks).length === 1) return;
      // after a sound-locked trig the voice plays the pool Sound: the lock trig's locks apply to it
      const playing = this.soundOn[e.track];
      const locks = playing ? this.soundLocks(playing, e.locks) : this.convertLocks(e.track, e.locks);
      this.post({ t: 'locks', at: e.time, tr: e.track, locks });
      return;
    }
    const snd = this.lockedSound(e.track, e.locks);
    this.soundOn[e.track] = snd;
    if (snd) {
      this.post({ t: 'trig', at: e.time, tr: e.track, vel: e.velocity, note: e.note, acc: e.accent, len: e.duration, locks: this.soundLocks(snd, e.locks), mach: snd.machine });
      return;
    }
    const locks = this.convertLocks(e.track, e.locks);
    this.post({ t: 'trig', at: e.time, tr: e.track, vel: e.velocity, note: e.note, acc: e.accent, len: e.duration, locks });
  }

  private onSeqState(s: SeqState) {
    const patch: Record<string, unknown> = { seq: s, playing: s.playing };
    if (s.bpm !== this.lastBpm) { this.lastBpm = s.bpm; this.post({ t: 'tempo', bpm: s.bpm }); }
    this.emit(patch);
  }

  protected onTransport(t: Transport | null): void {
    this.seq.follow(t);
    if (t) this.post({ t: 'tempo', bpm: t.bpm });
  }

  // --------------------------------------------------------------------------
  // Pads, retrig, live recording, auditions
  // --------------------------------------------------------------------------

  private padTrig(track: number, vel: number, note: number, at = 0) {
    this.soundOn[track] = null;
    this.post({ t: 'trig', at, tr: track, vel, note, acc: false, len: Infinity, locks: {} });
  }

  /** Where a hit at audio time `t` falls on the playing pattern: step and micro timing */
  private livePosition(track: number, t: number): { pattern: string; step: number; micro: number; dur: number; len: number } | null {
    const st = this.seq.getState();
    if (!st.playing || !st.pattern || !this.project) return null;
    const c = this.stepClock[track];
    if (c.step < 0) return null;
    const pat = getPattern(this.project, st.pattern);
    const dur = stepSeconds(trackSpeed(pat, track), st.bpm);
    const len = trackLength(pat, track);
    const frac = (t - c.time) / dur;
    let step = c.step + Math.floor(frac + 0.5);
    let micro = Math.round((frac - Math.floor(frac + 0.5)) * 24);
    step = ((step % len) + len) % len;
    micro = clamp(micro, -23, 23);
    return { pattern: st.pattern, step, micro, dur, len };
  }

  /** LIVE RECORDING is on and the sequencer plays */
  private recording(): boolean {
    return Math.round(this.num('rec')) === 2 && this.seq.getState().playing;
  }

  /**
   * LIVE RECORDING: a pad (or key) hit on `track` at audio time `at` becomes a note trig
   * with its velocity, micro timing (none when quantized), CHROMATIC pitch and, with
   * [RTRG], the roll (manual pp.40-41, 43). Its length follows on release (liveRelease).
   */
  private liveHit(track: number, at: number, vel: number, note: number | undefined, roll: boolean) {
    if (!this.recording()) return;
    const pos = this.livePosition(track, at);
    if (!pos) return;
    const id = TRACKS[track].id;
    const quantize = this.num('quantize', 1) > 0;
    const retrig = roll ? {
      rate: clamp(Math.round(this.num(`${id}_rtrg_rate`, 9)), 0, RETRIG_RATES.length - 1),
      len: clamp(Math.round(this.num(`${id}_rtrg_len`, 14)), 0, NOTE_LENGTHS.length - 1),
      vel: clamp(Math.round(this.num(`${id}_rtrg_vcr`)), -128, 127),
    } : undefined;
    this.pushOp({ type: 'rec', pattern: pos.pattern, track, step: pos.step, micro: quantize ? 0 : pos.micro, vel, note, retrig });
    this.liveHits.set(track, { pattern: pos.pattern, step: pos.step, t0: at, stepDur: pos.dur, retrig: roll });
  }

  /** The pad of a recorded hit was released: its LEN, or the roll's length (manual p.40) */
  private liveRelease(track: number) {
    const h = this.liveHits.get(track);
    if (!h) return;
    this.liveHits.delete(track);
    if (!this.recording()) return;
    const held = Math.max(0, this.ctx.currentTime - h.t0) / Math.max(1e-3, h.stepDur);
    this.pushOp({ type: 'reclen', pattern: h.pattern, track, step: h.step, len: lenIndexOf(held), retrig: h.retrig || undefined });
  }

  /**
   * LIVE RECORDING: an encoder turn on the active track becomes a parameter lock on the
   * step the sequencer is at, the nearest one as for a hit (manual p.47). Turns of the
   * same parameter less than FILL_STEPS steps apart also lock the steps in between to the
   * value that played there (**design**: a slow turn records a continuous sweep).
   */
  private liveTurn(turn: LiveTurn) {
    if (!this.recording()) return;
    const tr = clamp(Math.round(turn.track), 0, FX_TRACK);
    const lag = Math.max(0, Math.min(0.5, (performance.now() - turn.at) / 1000));
    const t = this.ctx.currentTime - lag;
    const pos = this.livePosition(tr, t);
    if (!pos) return;
    const k = `${tr}:${turn.key}`;
    const last = this.lastTurn.get(k);
    let fill: LiveLock['fill'];
    if (last && last.pattern === pos.pattern && last.step !== pos.step && t - last.t <= FILL_STEPS * pos.dur) {
      const steps = stepsBetween(last.step, pos.step, pos.len);
      if (steps.length && steps.length < FILL_STEPS) fill = { steps, value: last.value };
    }
    this.lastTurn.set(k, { pattern: pos.pattern, step: pos.step, value: turn.value, t });
    this.pushOp({ type: 'lock', pattern: pos.pattern, track: tr, step: pos.step, key: turn.key, value: turn.value, fill });
  }

  // --------------------------------------------------------------------------
  // STEP RECORDING (manual pp.40-41): [RECORD] + [STOP]. Pads (and keys) place trigs
  // on the active step, which moves on when they are let go: one step (STANDARD), or
  // the track's LEN (JUMP, LEN then locked on the trig). [NO] places a rest.
  // --------------------------------------------------------------------------

  private emitStepRec() {
    this.emit({ stepRec: { ...this.stepRec } });
  }

  /** Steps of the active track in the selected pattern (the active step wraps round them) */
  private stepLen(): number {
    const p = this.project;
    if (!p) return 16;
    return trackLength(getPattern(p, p.active), clamp(Math.round(this.num('track')), 0, FX_TRACK));
  }

  private stepTo(step: number) {
    const len = this.stepLen();
    this.stepRec.step = ((Math.round(step) % len) + len) % len;
    this.emitStepRec();
  }

  /** The active step moves on: one step, or in JUMP mode the LEN of the first track played */
  private stepAdvance(len: number) {
    const steps = this.stepRec.jump && len >= 0 && len < NOTE_LENGTHS.length - 1 ? Math.max(1, Math.round(NOTE_LENGTHS[len])) : 1;
    this.stepTo(this.stepRec.step + steps);
  }

  private trackLen(track: number): number {
    const p = this.project;
    return p ? getPattern(p, p.active).tracks[track]?.len ?? 14 : 14;
  }

  /** A pad or key on `track` while STEP RECORDING: a trig on the active step */
  private stepHit(track: number, vel: number, note: number | undefined, timed: boolean) {
    const p = this.project;
    if (!p) return;
    const len = this.trackLen(track);
    if (this.stepDown === 0) this.stepFirstLen = len;
    this.stepDown++;
    const step = this.stepRec.step;
    this.pushOp({ type: 'step', pattern: p.active, track, step, micro: 0, vel, note, len: this.stepRec.jump ? len : undefined });
    // [YES] held: the trig's LEN is how long the pad is pressed (manual p.41)
    if (timed) this.stepTimed.set(track, { pattern: p.active, step, t0: this.ctx.currentTime, dur: stepSeconds(trackSpeed(getPattern(p, p.active), track), this.seq.getState().bpm || this.num('bpm', 120)) });
  }

  private stepRelease(track: number) {
    const t = this.stepTimed.get(track);
    if (t) {
      this.stepTimed.delete(track);
      this.pushOp({ type: 'reclen', pattern: t.pattern, track, step: t.step, len: lenIndexOf(Math.max(0, this.ctx.currentTime - t.t0) / Math.max(1e-3, t.dur)) });
    }
    if (this.stepDown <= 0) return;
    this.stepDown--;
    if (this.stepDown === 0) this.stepAdvance(this.stepFirstLen);
  }

  private stepEvent(name: string, payload: StepRecPayload | undefined) {
    const p = payload ?? {};
    switch (name) {
      case 'rytm:step-rec':
        if (p.toggleJump && this.stepRec.on) this.stepRec.jump = !this.stepRec.jump;
        else if (p.on !== undefined) {
          this.stepRec.on = !!p.on;
          this.stepDown = 0;
          this.stepTimed.clear();
          if (p.on) this.stepRec.step = 0;
        }
        this.emitStepRec();
        return;
      case 'rytm:step-rec:select': if (p.step !== undefined) this.stepTo(p.step); return;
      case 'rytm:step-rec:move': this.stepTo(this.stepRec.step + Math.sign(p.dir ?? 1)); return;
      case 'rytm:step-rec:rest': {
        if (!this.stepRec.on || !this.project) return;
        const track = clamp(Math.round(this.num('track')), 0, FX_TRACK);
        this.pushOp({ type: 'rest', pattern: this.project.active, track, step: this.stepRec.step });
        this.stepAdvance(this.trackLen(Math.min(11, track)));
      }
    }
  }

  // --------------------------------------------------------------------------
  // Keys and MIDI notes (manual p.22): 0-11 play tracks 1-12; 12-59 play the active
  // track chromatically, its 48 variations from lowest to highest (36 = the sound's
  // own pitch, as the middle octave of the CHROMATIC pads). Others are ignored.
  // --------------------------------------------------------------------------

  noteOn(note: number, velocity = 1): void {
    if (!this.started) return;
    const n = Math.round(note);
    let track: number;
    let pitch: number | undefined;
    if (n >= 0 && n < 12) track = n;
    else if (n >= 12 && n <= 59) {
      track = Math.round(this.num('track'));
      if (track < 0 || track > 11) return;
      pitch = n + 24;
    } else return;
    const vel = clamp(Math.round(velocity * 127), 1, 127);
    this.keyNotes.set(n, track);
    this.keyLatest.set(track, n);
    this.padTrig(track, vel, pitch ?? 60);
    if (this.stepRec.on) this.stepHit(track, vel, pitch, false);
    else this.liveHit(track, this.ctx.currentTime + 0.01, vel, pitch, false);
  }

  noteOff(note: number): void {
    const n = Math.round(note);
    const track = this.keyNotes.get(n);
    if (track === undefined) return;
    this.keyNotes.delete(n);
    if (this.stepRec.on) this.stepRelease(track);
    // a track plays one note at a time: only its latest note ends the gate
    if (this.keyLatest.get(track) !== n) return;
    this.keyLatest.delete(track);
    if (!this.started) return;
    this.post({ t: 'off', at: 0, tr: track });
    this.liveRelease(track);
  }

  event(name: string, payload?: unknown): void {
    if (!this.started) return;
    if (this.seq.handleEvent(name, payload)) return;
    const p = (payload ?? {}) as { track?: number; vel?: number; note?: number; rtrg?: boolean | number; rec?: boolean; quantize?: boolean; index?: number; amount?: number };
    switch (name) {
      case 'pad': {
        const track = clamp(Math.round(p.track ?? 0), 0, 11);
        const vel = clamp(Math.round(p.vel ?? 100), 1, 127);
        const note = p.note ?? 60;
        const now = this.ctx.currentTime;
        this.padTrig(track, vel, note);
        // STEP RECORDING: a trig on the active step ([YES] held: its LEN is the press)
        if (this.stepRec.on) { this.stepHit(track, vel, p.note, !!(payload as { yes?: boolean } | undefined)?.yes); return; }
        // [RTRG] held, or the track's retrig set to ALWAYS ON: roll for as long as the pad is held
        const roll = !!p.rtrg || this.num(`${TRACKS[track].id}_rtrg_on`) > 0;
        // LIVE RECORDING: CHROMATIC pads (they send a note) record their pitch too
        if (p.rec) this.liveHit(track, now + 0.01, vel, p.note, roll);
        if (roll) this.startRetrig(track, vel, note, now);
        return;
      }
      case 'pad:pressure': {
        // pad pressure: the retrig velocity while rolling, else aftertouch (SOUND SETTINGS: +16 FLT FRQ)
        const track = clamp(Math.round(p.track ?? 0), 0, 11);
        const r = this.retrigs.get(track);
        if (r) r.vel = clamp(Math.round(p.vel ?? r.vel), 1, 127);
        else this.post({ t: 'at', tr: track, v: clamp(p.amount ?? 0, 0, 1) });
        return;
      }
      case 'pad:up': {
        const track = clamp(Math.round(p.track ?? 0), 0, 11);
        this.stopRetrig(track);
        this.post({ t: 'at', tr: track, v: 0 });
        this.post({ t: 'off', at: 0, tr: track });
        this.liveRelease(track);
        if (this.stepRec.on) this.stepRelease(track);
        return;
      }
      case 'rytm:live-lock': this.liveTurn(payload as LiveTurn); return;
      case 'rytm:step-rec': case 'rytm:step-rec:select': case 'rytm:step-rec:move': case 'rytm:step-rec:rest':
        this.stepEvent(name, payload as StepRecPayload | undefined);
        return;
      case 'rytm:preview-sound': {
        // the SOUND menu: a pool Sound played on the active track, as its pad would (manual p.32)
        const track = clamp(Math.round(p.track ?? 0), 0, 11);
        const slot = Math.round((payload as { slot?: number } | undefined)?.slot ?? 0);
        const snd = this.project?.pool?.[slot - 1];
        if (!soundFits(snd, track)) return;
        const at = this.ctx.currentTime + 0.01;
        this.soundOn[track] = snd;
        this.post({ t: 'trig', at, tr: track, vel: 100, note: 60, acc: false, len: 0.35, locks: soundLockMap(snd), mach: snd.machine });
        this.post({ t: 'off', at: at + 0.35, tr: track });
        return;
      }
      case 'scene':
        this.scene = p.index === undefined || p.index === this.scene ? -1 : p.index;
        this.applyScene();
        this.emit({ scene: this.scene });
        return;
      case 'perf':
        if (p.index !== undefined) { this.perfAmt[p.index] = clamp(p.amount ?? 1, 0, 1); this.applyPerf(); }
        return;
      case 'perf:up':
        if (p.index !== undefined) { this.perfAmt[p.index] = 0; this.applyPerf(); }
        return;
      case 'perf:assign': {
        // [QPER] + pads: these macros follow the QUICK PERF AMOUNT knob (replacing the earlier choice)
        const list = (payload as { list?: number[] } | undefined)?.list ?? [];
        this.perfQuick.fill(0);
        for (const i of list) if (i >= 0 && i < 12) this.perfQuick[i] = 1;
        this.applyPerf();
        return;
      }
      case 'perf:mute':
        this.perfMuted = !this.perfMuted;
        this.applyPerf();
        return;
      case 'perf:clear':
        this.perfAmt.fill(0); this.applyPerf();
        return;
      case 'rytm:fx-off':
        // [STOP] twice: the send effects fade out as well (manual p.37)
        this.post({ t: 'fxoff' });
        this.revVol.gain.cancelScheduledValues(this.ctx.currentTime);
        this.revVol.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
        this.fxOffTimer && clearTimeout(this.fxOffTimer);
        this.fxOffTimer = setTimeout(() => { this.fxOffTimer = null; this.applyReverb(0); }, 2500);
        return;
      case 'rytm:audition': this.audition(); return;
      case 'rytm:audition:stop': this.stopAudition(); return;
    }
  }

  /** Pad retrig with the track's RETRIG menu: rate, velocity curve over LENGTH (manual p.41) */
  private startRetrig(track: number, vel: number, note: number, from: number) {
    this.stopRetrig(track);
    const id = TRACKS[track].id;
    const r = { next: 0, vel, start: from, timer: 0 as unknown as ReturnType<typeof setInterval> };
    const bpm = () => Math.max(20, this.seq.getState().bpm || this.num('bpm', 120));
    const period = () => (4 * 60) / bpm() / RETRIG_RATES[clamp(Math.round(this.num(`${id}_rtrg_rate`, 9)), 0, RETRIG_RATES.length - 1)];
    const velAt = (t: number) => {
      const curve = clamp(this.num(`${id}_rtrg_vcr`), -128, 127);
      if (!curve) return r.vel;
      const li = clamp(Math.round(this.num(`${id}_rtrg_len`, 14)), 0, NOTE_LENGTHS.length - 1);
      const len = li >= NOTE_LENGTHS.length - 1 ? Infinity : NOTE_LENGTHS[li] * 15 / bpm();
      const frac = Math.min(1, (t - r.start) / len);
      const g = curve < 0 ? 1 + (curve / 128) * frac : 1 - (curve / 127) * (1 - frac);
      return clamp(Math.round(r.vel * g), 1, 127);
    };
    r.next = from + period();
    const pump = () => {
      const horizon = this.ctx.currentTime + 0.1;
      while (r.next < horizon) { this.padTrig(track, velAt(r.next), note, r.next); r.next += period(); }
    };
    r.timer = setInterval(pump, 25);
    pump();
    this.retrigs.set(track, r);
  }

  private stopRetrig(track: number) {
    const r = this.retrigs.get(track);
    if (r) { clearInterval(r.timer); this.retrigs.delete(track); }
  }

  /** Lessons: play the pattern (a groove), or a few hits of the selected track */
  private audition() {
    this.stopAudition();
    if (this.seq.playing) return;
    const p = this.project ? euclidView(this.project) : null;
    const pat = p ? getPattern(p, p.active) : null;
    const busy = pat ? pat.tracks.filter(t => Object.keys(t.steps).length > 0).length : 0;
    if (busy >= 3) {
      this.auditionStop = this.seq.audition();
      return;
    }
    const track = clamp(Math.round(this.num('track')), 0, 11);
    const beat = 60 / Math.max(40, this.seq.getState().bpm || this.num('bpm', 120));
    const t0 = this.ctx.currentTime + 0.05;
    for (let k = 0; k < 4; k++) {
      this.post({ t: 'trig', at: t0 + k * beat, tr: track, vel: 110, note: 60, acc: false, len: beat * 0.5, locks: {} });
      this.post({ t: 'off', at: t0 + k * beat + beat * 0.5, tr: track });
    }
  }

  private stopAudition() {
    this.auditionStop?.();
    this.auditionStop = null;
    this.auditionTimer.forEach(t => clearTimeout(t));
    this.auditionTimer = [];
  }
}
