// ============================================================================
// Analog Four MKII audio engine
//
//   T1..T4  a4-voice worklet (one node per track: the whole analog voice, see
//           public/worklets/analog-four-processors.js)        out0 dry, out1 sends
//              │ dry ──────────────────────────────────────────────┐
//              │ sends (cho, del, rev) ──┬─► split ─► chorus ─┐    │
//              │                         └──────────────────► a4-fx (delay, sends, mix) ─► stage ─► main ─► out
//   T(n+1) mono ─► T(n) input (OSC 2 WAV NEI)                  ▲        │ reverb send
//   a4-fxmod (FX track params, FX LFOs, locks) ─► split ─► chorus / reverb params, a4-fx params
//                                                         fdn-reverb ◄──┘ ─► revRet ─► stage
//   stage: the analog output stage (a soft rail above 0 dBFS); main: MAIN VOLUME
//
// Worklet nodes: 4 voices + a4-fxmod + chorus + fdn-reverb + a4-fx = 8 (the
// previous version used 36 plus about 120 native nodes). Native: 2 splitters,
// 4 gains, 1 wave shaper.
//
// Sequencer: the shared ElektronSequencer with 6 tracks (T1-T4, FX, CV). Trigs
// carry their parameter locks to the voice at the trig's audio time; the next
// trig on the track returns unlocked parameters to the track (kit) value, as on
// the hardware (LockTracker). Parameter slides ramp in the worklet. FX track
// trigs lock FX parameters and retrigger the FX LFOs. The CV track is
// sequenced but has no outputs (rear-panel jacks are not in the twin).
// Track mutes live in the project (Project.mutes, applied by the sequencer).
//
// POLY (manual p.28-31): voices ticked in POLY CONFIG form a pool shared by
// their tracks. A poly track's notes (chord trigs, overlapping trigs, keys,
// arpeggios) each take a pool voice by the allocation method (RESET, ROTATE,
// REASSIGN; UNISON plays them all), stealing the least recently used one when
// none is free. The voice loads the playing track's sound (or keeps its own
// with USE TRK SOUNDS) and the trig's locks at the note's audio time; knob
// turns reach every voice that holds that track's sound. Poly notes carry ids,
// so a stolen voice ignores its old note's note-off. Voices out of the pool, and
// everything with POLY off, run the mono code paths unchanged.
//
// Transport (manual p.38-39): [PLAY] starts, [PLAY] while playing pauses
// (sounding notes are released) and [PLAY] again resumes (the kit's pressPlay:
// seq:pause / seq:resume); [STOP] stops and cuts the voices while the send
// effects ring on; [STOP][STOP] while stopped fades the send effects.
// Following the studio transport, its start / stop drive the sequencer
// instead (no pause, like MIDI clock).
// ============================================================================

import type { ControlValue } from '@/types';
import { BaseEngine } from '@/lib/audio/engine';
import type { Transport } from '@/lib/audio/transport';
import {
  ElektronSequencer, LockTracker, NOTE_LENGTHS, asProject, getPattern, getStep, trigNotes, type Locks, type TrigEvent,
} from '@/lib/sequencer/elektron';
import {
  ARP_PLY, CV_TRACK, FX_BY_KEY, FX_DESTS, FX_KEYS, FX_TRACK, MOD_DESTS, PERF_MACROS, POLY_UNISON, SEQ_TRACKS, SYNTH_BY_KEY,
  SYNTH_TRACKS, VOICE_KEYS, tid,
} from './params';
import { ARP_KEYS, isArpKey, isTransposable, patternArp, type ArpKey } from './arp';
import { kitFull, projectKits } from './kits';

const VI: Record<string, number> = Object.fromEntries(VOICE_KEYS.map((k, i) => [k, i]));
const FI: Record<string, number> = Object.fromEntries(FX_KEYS.map((k, i) => [k, i]));
/** MIDI note of the first keyboard key at octave 0 (EMU, measured on OS 1.56) */
const KB_C1 = 72;
/** OSC 2 WAV index of NEI: the previous track's multimode filter output (manual p.73) */
const NEI_WAVE = 6;
const EMPTY_LOCKS: Readonly<Locks> = Object.freeze({});
const clampNote = (n: number) => Math.max(0, Math.min(127, Math.round(n)));

/** A poly voice's latest note: its id, the track that played it, when it started and ends (Infinity: held) */
interface Booking { id: number; track: number; note: number; on: number; end: number; live: boolean }
/**
 * What a poly voice's parameters hold from `time` on: the sound of track `owner`, the playing
 * trig's `locks`, and the UNISON position `uni` (-1 .. 1 across the pool; NaN = not in unison)
 */
interface Seg { time: number; owner: number; locks: Readonly<Locks>; uni: number }
/** Voice parameters a UNISON position offsets: both oscillators' TUN (detune) and PAN (spread) */
const UNI_KEYS = ['osc1_tun', 'osc2_tun', 'amp_pan'];


/** a4-fxmod output channels driving the shared processors (must match the worklet) */
const FXC = { CHO_RATE: 0, CHO_DEPTH: 1, CHO_DELAY: 2, CHO_FB: 3, CHO_WIDTH: 4, REV_PRE: 5, REV_DECAY: 6, REV_SIZE: 7, REV_DAMP: 8, REV_WIDTH: 9, REV_VOL: 23 };
const FX_CHANNELS = 25;
/** [STOP][STOP]: how long the send effects take to fade out */
const FX_FADE_SEC = 0.3;
/**
 * A stop that comes from the studio (the top bar, Space, the arranger's end, another machine) is a
 * full stop for the whole rack: the send effects fade out over this time instead of ringing on.
 * The A4's own [STOP] key and the end of its own song let them ring (twin choice; the manual only
 * describes the A4's keys, p.38).
 */
const STUDIO_STOP_FADE_SEC = 1.5;
/** A riff for an empty pattern's audition: [step, semitones from the keyboard's C, length in steps] */
const AUDITION_RIFF: [number, number, number][] = [
  [0, 0, 2], [2, 7, 1], [4, 12, 2], [6, 10, 1], [8, 7, 2], [10, 3, 1], [12, 5, 1], [14, 7, 2],
  [16, 0, 2], [18, 7, 1], [20, 12, 2], [22, 15, 1], [24, 14, 3], [28, 12, 4],
];

function voiceOptions() {
  const mins: number[] = [], maxs: number[] = [], defs: number[] = [];
  for (const k of VOICE_KEYS) {
    const p = SYNTH_BY_KEY[k];
    mins.push(p ? p.min : -200);
    maxs.push(p ? p.max : 200);
    defs.push(p ? p.def : 0);
  }
  return { keys: VOICE_KEYS, mins, maxs, defs, dests: MOD_DESTS.map(d => ({ keys: d.keys, range: d.range })) };
}

/**
 * The analog output stage, ahead of MAIN VOLUME (the FX returns are mixed in before it, manual p.15):
 * unity up to 0 dBFS, then a soft knee towards +3.5 dBFS, so however hot a kit is (every source,
 * accent, VOL and TRACK LEVEL up) the A4 stays below about +0.2 dBFS at the default MAIN VOLUME.
 * Drawn over +-3 (the shaper's input is scaled by 1/3 and its output by 3).
 */
const STAGE_SPAN = 3;
function outputStageCurve(): Float32Array<ArrayBuffer> {
  const n = 4097;
  const c = new Float32Array(new ArrayBuffer(n * 4));
  for (let i = 0; i < n; i++) {
    const x = ((i / (n - 1)) * 2 - 1) * STAGE_SPAN;
    const a = Math.abs(x);
    const y = a <= 1 ? a : 1 + 0.5 * Math.tanh((a - 1) / 0.5);
    c[i] = (Math.sign(x) * y) / STAGE_SPAN;
  }
  return c;
}

function fxOptions() {
  const mins: number[] = [], maxs: number[] = [], defs: number[] = [];
  for (const k of FX_KEYS) {
    const p = FX_BY_KEY[k];
    mins.push(p.min); maxs.push(p.max); defs.push(p.def);
  }
  return { keys: FX_KEYS, mins, maxs, defs, dests: FX_DESTS.map(d => ({ key: d.key, range: d.range })) };
}

/** Hardware LPF/HPF 0..127 -> Hz (one semitone a step) */
const fltHz = (v: number) => 13 * Math.pow(2, v / 12);

interface ArpState {
  notes: number[];        // the chord (sequencer trig + offsets) or the held keys
  order: number[];        // play order of the current cycle
  idx: number;
  oct: number;
  next: number;           // audio time of the next arp note
  end: number;            // gate end (Infinity while keys are held)
  dir: 1 | -1;
  vel: number;
  accent: boolean;
  live: boolean;
  lastNote: number;
  /** The trig's locks (poly voices load them with each arpeggio note) */
  locks: Readonly<Locks>;
  /** POLY: the voices and note ids of the sounding arpeggio note (null on a mono track) */
  pv: number[] | null;
  pid: number[];
}

export class AnalogFourEngine extends BaseEngine {
  private voices: AudioWorkletNode[] = [];
  private fxmod!: AudioWorkletNode;
  private fx!: AudioWorkletNode;
  private chorus!: AudioWorkletNode;
  private reverb!: AudioWorkletNode;
  private main!: GainNode;
  private seq!: ElektronSequencer;
  private lastSynth = 0;
  private locks = new LockTracker(SEQ_TRACKS);
  /** Track (kit) values of the voice parameters, per synth track */
  private base: Float64Array[] = [];
  private fxBase = new Float64Array(FX_KEYS.length);
  private arpBase: Record<ArpKey, number>[] = [];
  private arpLock: Partial<Record<ArpKey, number>>[] = [];
  /** The pattern whose ARP settings each track's arpeggiator follows (they belong to the pattern) */
  private arpPattern: (string | null)[] = [null, null, null, null];
  private pending = new Map<MessagePort, number[]>();
  private flushQueued = false;
  private arps: (ArpState | null)[] = [null, null, null, null];
  private arpTimer: ReturnType<typeof setInterval> | null = null;
  private held: number[][] = [[], [], [], []];   // live keys per track (arp)
  private liveNote: (number | null)[] = [null, null, null, null];
  private lastStep: { step: number; time: number }[] = [];
  private transportUnsub: (() => void) | null = null;
  private recSerial = 0;
  /** The loaded kit's slot ('' = none linked), and a counter for the panel's kitNow reports */
  private kitNow = '';
  private kitSerial = 0;
  /** LIVE RECORDING quantized ([RECORD] + [PLAY][PLAY]): notes land on the grid, no micro timing (manual p.41) */
  private liveQuant = false;
  /**
   * STEP RECORDING, or a trig held: report each key played and released (kbNote / kbOff), so the
   * panel can write it - at the active step, or into the held trig (manual p.41-42)
   */
  private kbReport = false;
  private kbSerial = 0;
  /** LIVE RECORDING: the step each track's last recorded note went to (POLY chords) */
  private lastRec: ({ step: number; pattern: string } | null)[] = [null, null, null, null];
  /** The audition in progress (a preview): its stop */
  private auditionEnd: (() => void) | null = null;
  private fxFaded = false;
  /** Audio time of the last press of the A4's own [STOP] key (its stop lets the sends ring) */
  private stopKeyAt = -Infinity;
  /** Voice t feeds track t+1's OSC 2 (WAV NEI): it keeps running while its VCA is closed */
  private feedOn = [false, false, false];
  /** The playing trig of each synth track locks OSC 2 WAV to NEI */
  private neiLock = [false, false, false, false];
  /** The mono tracks want voice t running for track t+1's NEI (feedOn is what the voices were told) */
  private feedNeed = [false, false, false];

  // --- POLY (manual p.28-31) ---------------------------------------------------
  /** POLY CONFIG: the voices in the pool (a track whose voice is in it plays polyphonically) */
  private pool = [false, false, false, false];
  private poolVoices: number[] = [];
  /** ALLOCATION: 0 RESET, 1 ROTATE, 2 REASSIGN, 3 UNISON */
  private alloc = 0;
  /** USE TRK SOUNDS: each voice keeps its own track's sound */
  private trkSounds = false;
  private uniDet = 16;
  private uniSpr = 64;
  private book: Booking[] = [0, 1, 2, 3].map(v => ({ id: 0, track: v, note: -1, on: -Infinity, end: -Infinity, live: false }));
  /** Per voice, in time order: what its parameters hold (the last one before now is in effect) */
  private segs: Seg[][] = [0, 1, 2, 3].map(v => [{ time: -Infinity, owner: v, locks: EMPTY_LOCKS, uni: NaN }]);
  private nextNoteId = 1;
  /** ROTATE: the voice the last note took */
  private rotPos = -1;
  /** REASSIGN: the voice each note (MIDI number) had last time */
  private lastVoiceOf = new Int8Array(128).fill(-1);
  /** Each poly track's last trig: its voices and note ids (a note slide takes them over) */
  private lastTrig: { voices: number[]; ids: number[] }[] = [0, 1, 2, 3].map(() => ({ voices: [], ids: [] }));
  /** Keys held on poly tracks ('track:note'), and UNISON's sounding key per track */
  private polyKeys = new Map<string, { voices: number[]; ids: number[] }>();
  private uniLive: ({ voices: number[]; ids: number[] } | null)[] = [null, null, null, null];
  /** A poly voice needs its neighbour running (its sound takes OSC 2 from it, WAV NEI) */
  private feedPoly = [false, false, false];
  /** Knob turns for poly voices, scheduled per voice and time ('at' messages) */
  private pendingAt = new Map<number, Map<number, number[]>>();
  /** POLY CONFIG open: the voices' activity for the TRIG 1-4 LEDs (manual p.29) */
  private watchTimer: ReturnType<typeof setInterval> | null = null;
  private lastAct = '';

  // --------------------------------------------------------------------------

  protected build(): void {
    const ctx = this.ctx;
    const vo = voiceOptions();
    for (let t = 0; t < SYNTH_TRACKS; t++) {
      this.base.push(Float64Array.from(vo.defs));
      const arp = {} as Record<ArpKey, number>;
      ARP_KEYS.forEach(k => (arp[k] = SYNTH_BY_KEY[k].def));
      this.arpBase.push(arp);
      this.arpLock.push({});
      this.voices.push(new AudioWorkletNode(ctx, 'a4-voice', {
        numberOfInputs: 1, numberOfOutputs: 3, outputChannelCount: [2, 3, 1], processorOptions: vo,
      }));
    }
    FX_KEYS.forEach((k, i) => (this.fxBase[i] = FX_BY_KEY[k].def));

    // --- FX track ------------------------------------------------------------
    this.fxmod = new AudioWorkletNode(ctx, 'a4-fxmod', {
      numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [FX_CHANNELS], processorOptions: fxOptions(),
    });
    const fxSplit = ctx.createChannelSplitter(FX_CHANNELS);
    this.fxmod.connect(fxSplit);
    this.chorus = new AudioWorkletNode(ctx, 'chorus', {
      numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2],
      processorOptions: { voices: 2, lfoShape: 1, highCut: 18000, lowCut: 20, drive: 0.04, phase: 0.25 },
    });
    this.reverb = new AudioWorkletNode(ctx, 'fdn-reverb', {
      numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2],
      processorOptions: { lowCut: 60, highCut: 12000, seed: 4 },
    });
    // The params' own values sit at their minimum; a4-fxmod adds the rest (locks, LFOs, mapping in one place)
    const drive = (node: AudioWorkletNode, name: string, ch: number) => {
      const p = node.parameters.get(name)!;
      p.value = p.minValue;
      fxSplit.connect(p, ch);
    };
    drive(this.chorus, 'rate', FXC.CHO_RATE); drive(this.chorus, 'depth', FXC.CHO_DEPTH);
    drive(this.chorus, 'delay', FXC.CHO_DELAY); drive(this.chorus, 'feedback', FXC.CHO_FB); drive(this.chorus, 'width', FXC.CHO_WIDTH);
    drive(this.reverb, 'predelay', FXC.REV_PRE); drive(this.reverb, 'decay', FXC.REV_DECAY); drive(this.reverb, 'size', FXC.REV_SIZE);
    drive(this.reverb, 'damping', FXC.REV_DAMP); drive(this.reverb, 'width', FXC.REV_WIDTH);
    this.reverb.parameters.get('mod')!.value = 0.55;
    this.reverb.parameters.get('modRate')!.value = 0.5;

    this.fx = new AudioWorkletNode(ctx, 'a4-fx', { numberOfInputs: 4, numberOfOutputs: 2, outputChannelCount: [2, 2] });
    const sendSplit = ctx.createChannelSplitter(3);
    const revRet = ctx.createGain();
    revRet.gain.value = 0;
    fxSplit.connect(revRet.gain, FXC.REV_VOL);
    this.main = ctx.createGain();
    this.main.gain.value = 0.7;

    this.voices.forEach((v, t) => {
      v.connect(this.fx, 0, 2);   // dry
      v.connect(this.fx, 1, 0);   // sends
      v.connect(sendSplit, 1);
      if (t < SYNTH_TRACKS - 1) v.connect(this.voices[t + 1], 2, 0); // NEI: each voice feeds the next track's OSC 2 (manual p.88, p.110)
    });
    sendSplit.connect(this.chorus, 0, 0);
    this.chorus.connect(this.fx, 0, 1);
    this.fxmod.connect(this.fx, 0, 3);
    const stageIn = ctx.createGain();
    stageIn.gain.value = 1 / STAGE_SPAN;
    const stage = ctx.createWaveShaper();
    stage.curve = outputStageCurve();
    // no oversampling: its anti-alias filter overshoots on clipped peaks (+1 dB measured), the curve alone bounds the level
    stage.oversample = 'none';
    const stageOut = ctx.createGain();
    stageOut.gain.value = STAGE_SPAN;
    stageIn.connect(stage).connect(stageOut).connect(this.main);
    this.fx.connect(stageIn, 0);
    this.fx.connect(this.reverb, 1, 0);
    this.reverb.connect(revRet).connect(stageIn);
    this.main.connect(this.out);

    // --- sequencer -------------------------------------------------------------
    for (let t = 0; t < SEQ_TRACKS; t++) this.lastStep.push({ step: -1, time: 0 });
    this.seq = new ElektronSequencer({
      ctx,
      tracks: SEQ_TRACKS,
      bpm: this.num('tempo', 120),
      onTrig: e => this.trig(e),
      onNoteOff: (track, _note, time) => this.gateOff(track, time),
      onStep: (track, step, time) => { const s = this.lastStep[track]; s.step = step; s.time = time; },
      // a pattern linked to another kit brings it in where it starts (manual p.16, p.24)
      onPattern: (id, time) => this.patternKit(id, time),
      onPlay: playing => {
        if (playing) { this.unfadeFx(); return; }
        const now = this.ctx.currentTime;
        if (this.seq.isPaused) {
          // [PLAY] while playing pauses: the sequencer releases its notes, the arpeggios end with them
          for (let t = 0; t < SYNTH_TRACKS; t++) if (this.arps[t] && !this.arps[t]!.live) this.stopArp(t, now);
        } else {
          // [STOP] cuts the sound off; the send effects ring on (manual p.38). Keys still held keep playing.
          for (let t = 0; t < SYNTH_TRACKS; t++) {
            if (this.liveNote[t] !== null || this.arps[t]?.live) continue;
            this.arps[t] = null;
            if (this.pool[t]) continue; // poly voices: polyStop
            this.voices[t].port.postMessage({ t: 'cut' });
          }
          // ... after the A4's own [STOP] key or the end of its song. A studio stop (the transport, or
          // the PLAY control turned off from outside) fades them
          const studioStop = this.transport ? !this.transport.playing : !this.bool('play');
          if (studioStop && now - this.stopKeyAt > 0.6) this.fadeFx(STUDIO_STOP_FADE_SEC);
        }
        if (this.poolVoices.length) this.polyStop(now, this.seq.isPaused);
        this.locks.releaseAll((track, key) => this.revert(track, key, now));
      },
    });
    this.seq.subscribe(s => this.emit({ seq: s, playing: s.playing }));
    this.sendTempo();

    this.onDispose(() => {
      this.seq.dispose();
      this.transportUnsub?.();
      if (this.arpTimer) clearInterval(this.arpTimer);
      if (this.watchTimer) clearInterval(this.watchTimer);
      [...this.voices, this.fxmod, this.fx, this.chorus, this.reverb].forEach(n => { try { n.disconnect(); n.port.close(); } catch { /* */ } });
    });
    this.emit({ playing: false, seq: this.seq.getState(), kbTrack: this.lastSynth });
  }

  // --------------------------------------------------------------------------
  // Messaging (batched per render tick)
  // --------------------------------------------------------------------------

  private queue(node: AudioWorkletNode, i: number, v: number) {
    let l = this.pending.get(node.port);
    if (!l) { l = []; this.pending.set(node.port, l); }
    l.push(i, v);
    if (!this.flushQueued) {
      this.flushQueued = true;
      queueMicrotask(() => this.flush());
    }
  }

  private flush() {
    this.flushQueued = false;
    this.pending.forEach((list, port) => port.postMessage({ t: 'p', list }));
    this.pending.clear();
    if (this.pendingAt.size) {
      this.pendingAt.forEach((m, u) => m.forEach((list, time) => this.voices[u].port.postMessage({ t: 'at', time, list })));
      this.pendingAt.clear();
    }
  }

  /** A poly voice's parameter at an audio time (batched like queue()) */
  private queueAt(u: number, time: number, i: number, v: number) {
    let m = this.pendingAt.get(u);
    if (!m) { m = new Map(); this.pendingAt.set(u, m); }
    let l = m.get(time);
    if (!l) { l = []; m.set(time, l); }
    l.push(i, v);
    if (!this.flushQueued) {
      this.flushQueued = true;
      queueMicrotask(() => this.flush());
    }
  }

  private bpm(): number {
    return this.transport ? this.transport.bpm : this.num('tempo', 120);
  }

  private sendTempo() {
    const bpm = this.bpm();
    const step = 60 / bpm / 4;
    this.voices.forEach(v => { v.port.postMessage({ t: 'bpm', v: bpm }); v.port.postMessage({ t: 'step', v: step }); });
    this.fxmod?.port.postMessage({ t: 'bpm', v: bpm });
  }

  // --------------------------------------------------------------------------
  // Parameters
  // --------------------------------------------------------------------------

  protected onParam(id: string, value: ControlValue): void {
    const v = typeof value === 'number' ? value : value ? 1 : 0;
    const m = /^t([1-6])_(.+)$/.exec(id);
    if (m) {
      const t = Number(m[1]) - 1;
      const key = m[2];
      if (t >= SYNTH_TRACKS || key.startsWith('trig_')) return;
      if ((ARP_KEYS as readonly string[]).includes(key)) { this.arpBase[t][key as ArpKey] = v; return; }
      const i = VI[key];
      if (i === undefined) return;
      this.base[t][i] = v;
      if (key === 'osc2_wav') this.updateFeed(t);
      // a poly track's sound can be on any pool voice: every voice holding it gets the change
      if (this.pool[t]) { this.polyParam(t, i, key); return; }
      if (this.locks.isLocked(t, key)) return; // the playing trig holds a lock for it
      this.queue(this.voices[t], i, v);
      return;
    }
    if (id.startsWith('fx_')) {
      const key = id.slice(3);
      const i = FI[key];
      if (i === undefined) return;
      this.fxBase[i] = v;
      if (this.locks.isLocked(FX_TRACK, key)) return;
      this.queue(this.fxmod, i, v);
      this.toneFor(key, v);
      return;
    }
    if (/^perf_/.test(id)) { this.applyPerf(); return; }
    if (id.startsWith('poly_')) { this.polyConfig(); return; }
    switch (id) {
      case 'tempo':
        this.seq.setTempo(v);
        if (!this.transport) this.sendTempo();
        break;
      case 'main_volume': {
        const g = Math.pow(v / 127, 2) * 1.1;
        this.main.gain.setTargetAtTime(g, this.ctx.currentTime, 0.015);
        break;
      }
      case 'play':
        // Start / stop. Synced, the hub turns PLAY into the studio transport; [PLAY] while playing
        // pauses and resumes through the kit's seq:pause / seq:resume events (pressPlay)
        if (!this.transport) { if (value) this.seq.start(); else this.seq.stop(); }
        break;
      case 'track': {
        // with the FX or CV track active, the keyboard keeps playing the last synth track (manual p.36)
        const t = Math.round(v);
        if (t >= 0 && t < SYNTH_TRACKS && t !== this.lastSynth) { this.lastSynth = t; this.emit({ kbTrack: t }); }
        break;
      }
    }
  }

  /** Chorus / reverb tone filters are processor settings, not AudioParams */
  private toneFor(key: string, v: number) {
    if (key === 'cho_hpf') this.chorus.port.postMessage({ type: 'set', lowCut: Math.min(4000, Math.max(10, v <= 0 ? 10 : fltHz(v * 0.85))) });
    else if (key === 'cho_lpf') this.chorus.port.postMessage({ type: 'set', highCut: Math.min(20000, Math.max(500, fltHz(v))) });
    else if (key === 'rev_hpf') this.reverb.port.postMessage({ type: 'set', lowCut: Math.min(4000, Math.max(20, v <= 0 ? 20 : fltHz(v * 0.85))) });
    else if (key === 'rev_lpf') this.reverb.port.postMessage({ type: 'set', highCut: Math.min(20000, Math.max(500, fltHz(v))) });
  }

  /** Performance macros: offsets on every synth track (and the FX track), sent as one message per node */
  private applyPerf() {
    const muted = this.bool('perf_mute');
    const voice: Record<string, number> = {};
    const fx: Record<string, number> = {};
    PERF_MACROS.forEach((mac, i) => {
      const amt = muted ? 0 : this.num(`perf_${'abcdefghij'[i]}`, 0) / 127;
      if (!amt) return;
      mac.synth.forEach(([k, d]) => (voice[k] = (voice[k] ?? 0) + d * amt));
      mac.fx?.forEach(([k, d]) => (fx[k] = (fx[k] ?? 0) + d * amt));
    });
    const vl: number[] = [];
    Object.entries(voice).forEach(([k, d]) => { if (VI[k] !== undefined) vl.push(VI[k], d); });
    this.voices.forEach(n => n.port.postMessage({ t: 'off2', list: vl }));
    const fl: number[] = [];
    Object.entries(fx).forEach(([k, d]) => { if (FI[k] !== undefined) fl.push(FI[k], d); });
    this.fxmod.port.postMessage({ t: 'off2', list: fl });
  }

  // --------------------------------------------------------------------------
  // Data / transport
  // --------------------------------------------------------------------------

  protected onData(data: unknown): void {
    this.seq.setProject(data);
    // the kit the panel loaded (KIT menu, a pattern picked while stopped)
    this.kitNow = projectKits(asProject(data, SEQ_TRACKS)).active;
  }

  /**
   * A pattern starts at `time`: when it is linked to a kit other than the loaded one, that kit's
   * settings take over exactly there - the voices', the FX track's - and the panel is told, so the
   * knobs show it from the moment you hear it (manual p.16, p.24). Unlinked patterns change nothing.
   */
  private patternKit(id: string, time: number) {
    const p = asProject(this.data, SEQ_TRACKS);
    const k = getPattern(p, id).kit;
    if (!k || k === this.kitNow) return;
    const slot = projectKits(p).kits[k];
    if (!slot) return;
    this.kitNow = k;
    const v = kitFull(slot.values);
    // a kit with another POLY CONFIG: the new pool is set up now, so the new pattern's first trigs (scheduled
    // next) already use it; the panel's echo of these values then changes nothing
    let polyMoved = false;
    for (const id of ['poly_v1', 'poly_v2', 'poly_v3', 'poly_v4', 'poly_alloc', 'poly_trk', 'poly_det', 'poly_spr']) {
      const x = v[id];
      if (x !== undefined && x !== this.params[id]) { this.params[id] = x; polyMoved = true; }
    }
    if (polyMoved) this.polyConfig();
    for (let t = 0; t < SYNTH_TRACKS; t++) {
      const list: number[] = [];
      for (let i = 0; i < VOICE_KEYS.length; i++) {
        const key = VOICE_KEYS[i];
        const x = v[tid(t, key)];
        if (typeof x !== 'number' || x === this.base[t][i]) continue;
        this.base[t][i] = x;
        if (this.pool[t]) this.polyParamAt(t, i, key, time);
        else list.push(i, x);
      }
      if (list.length) this.voices[t].port.postMessage({ t: 'at', time, list });
      this.updateFeed(t);
    }
    const fl: number[] = [];
    for (let i = 0; i < FX_KEYS.length; i++) {
      const key = FX_KEYS[i];
      const x = v[`fx_${key}`];
      if (typeof x !== 'number' || x === this.fxBase[i]) continue;
      this.fxBase[i] = x;
      fl.push(i, x);
      this.toneAt(key, x, time);
    }
    if (fl.length) this.fxmod.port.postMessage({ t: 'at', time, list: fl });
    // the panel follows when you hear it (earlier, its knobs would reach the voices before the pattern change)
    this.emitAt(time, { kitNow: { n: ++this.kitSerial, kit: k } });
  }

  protected onTransport(t: Transport | null): void {
    this.transportUnsub?.();
    this.transportUnsub = null;
    this.seq.follow(t);
    if (t) this.transportUnsub = t.onEvent(e => { if (e.type === 'tempo') this.sendTempo(); });
    this.sendTempo();
  }

  // --------------------------------------------------------------------------
  // Sequencer
  // --------------------------------------------------------------------------

  /** Track t uses OSC 2 WAV NEI (its own value or the playing trig's lock): the voice before it must keep running */
  private updateFeed(t: number) {
    if (t < 1 || t >= SYNTH_TRACKS) return;
    this.feedNeed[t - 1] = Math.round(this.base[t][VI.osc2_wav]) === NEI_WAVE || this.neiLock[t];
    this.postFeed(t - 1);
  }

  /** Voice k keeps running for its neighbour while a mono track or a poly voice needs it */
  private postFeed(k: number) {
    const on = this.feedNeed[k] || this.feedPoly[k];
    if (on === this.feedOn[k]) return;
    this.feedOn[k] = on;
    this.voices[k].port.postMessage({ t: 'feed', v: on });
  }

  private revert(track: number, key: string, time: number) {
    if (track < SYNTH_TRACKS) {
      if ((ARP_KEYS as readonly string[]).includes(key)) { delete this.arpLock[track][key as ArpKey]; return; }
      if (key === 'osc2_wav') { this.neiLock[track] = false; this.updateFeed(track); }
      const i = VI[key];
      if (i !== undefined) this.voices[track].port.postMessage({ t: 'at', time, list: [i, this.base[track][i]] });
    } else if (track === FX_TRACK) {
      const i = FI[key];
      if (i !== undefined) {
        this.fxmod.port.postMessage({ t: 'at', time, list: [i, this.fxBase[i]] });
        this.toneAt(key, this.fxBase[i], time);
      }
    }
  }

  private toneAt(key: string, v: number, time: number) {
    if (!/^(cho|rev)_(hpf|lpf)$/.test(key)) return;
    this.atTime(time, () => this.toneFor(key, v));
  }

  private trackValue(track: number, key: string): number {
    if (track < SYNTH_TRACKS) {
      const i = VI[key];
      return i !== undefined ? this.base[track][i] : (this.arpBase[track] as Record<string, number>)[key] ?? 0;
    }
    if (track === FX_TRACK) { const i = FI[key]; return i !== undefined ? this.fxBase[i] : 0; }
    return 0;
  }

  private trig(e: TrigEvent) {
    const t = e.track;
    if (t === CV_TRACK) return;
    if (t === FX_TRACK) {
      const list: number[] = [];
      this.locks.apply(t, e.locks,
        (k, val) => { const i = FI[k]; if (i !== undefined) { list.push(i, val); this.toneAt(k, val, e.time); } },
        k => { const i = FI[k]; if (i !== undefined) { list.push(i, this.fxBase[i]); this.toneAt(k, this.fxBase[i], e.time); } });
      if (list.length) this.fxmod.port.postMessage({ t: 'at', time: e.time, list });
      if (!e.trigless) this.fxmod.port.postMessage({ t: 'trig', time: e.time });
      return;
    }
    if (this.pool[t]) { this.polyTrig(e); return; }
    const v = this.voices[t];
    if (!v) return;
    const list: number[] = [];
    const nei = this.neiLock[t];
    this.locks.apply(t, e.locks,
      (k, val) => {
        const i = VI[k];
        if (i !== undefined) list.push(i, val);
        else if ((ARP_KEYS as readonly string[]).includes(k)) this.arpLock[t][k as ArpKey] = val;
        if (k === 'osc2_wav') this.neiLock[t] = Math.round(val) === NEI_WAVE;
      },
      k => {
        const i = VI[k];
        if (i !== undefined) list.push(i, this.base[t][i]);
        else if ((ARP_KEYS as readonly string[]).includes(k)) delete this.arpLock[t][k as ArpKey];
        if (k === 'osc2_wav') this.neiLock[t] = false;
      });
    if (this.neiLock[t] !== nei) this.updateFeed(t);
    if (list.length) v.port.postMessage({ t: 'at', time: e.time, list });
    if (e.paramSlide && e.slideTo) {
      const to = e.slideTo;
      const ramp: number[] = [];
      const keys = new Set([...Object.keys(e.locks), ...Object.keys(to.locks)]);
      keys.forEach(k => {
        const i = VI[k];
        if (i === undefined) return;
        ramp.push(i, e.locks[k] ?? this.base[t][i], to.locks[k] ?? this.base[t][i]);
      });
      if (ramp.length) v.port.postMessage({ t: 'ramp', time: e.time, t1: to.time, list: ramp });
    }
    // NOTE page retrig switches (lock only): on for note trigs and off for lock trigs unless locked (manual p.45)
    const sw = (k: string, d: number) => { const x = e.locks[k]; return x === undefined ? d : x >= 0.5 ? 1 : 0; };
    if (e.trigless) {
      const rt = sw('trig_envf', 0) | (sw('trig_env2', 0) << 1) | (sw('trig_lfo1', 0) << 2) | (sw('trig_lfo2', 0) << 3);
      if (rt) v.port.postMessage({ t: 'rtrg', time: e.time, rt });
      return;
    }
    const rt = sw('trig_envf', 1) | (sw('trig_env2', 1) << 1) | (sw('trig_lfo1', 1) << 2) | (sw('trig_lfo2', 1) << 3);
    const note = this.trigNote(e);
    this.arpPattern[t] = e.pattern;
    if (this.arpOn(t)) {
      this.startArp(t, [note, ...this.arpOffsets(t).map(o => note + o)], e.time, e.duration, e.velocity, e.accent, false);
      return;
    }
    // ARP LEG also makes the track's overlapping note trigs legato with the arpeggiator off (manual p.44)
    v.port.postMessage({ t: 'on', time: e.time, note, vel: e.velocity, acc: e.accent ? 1 : 0, slide: e.slide, rt, leg: this.arpVal(t, 'arp_leg') >= 0.5 });
  }

  /**
   * A synth trig's note with [TRNS] added. A track with TRANSPOSABLE off (NOTES SETUP, manual p.47)
   * keeps its own notes: no [TRNS], no song transpose (which works like a track transpose, p.57).
   */
  private trigNote(e: TrigEvent): number {
    const p = asProject(this.data, SEQ_TRACKS);
    if (isTransposable(p, e.pattern, e.track)) return clampNote(e.note + Math.round(this.num('trns', 0)));
    const st = getStep(p, e.pattern, e.track, e.step);
    return clampNote(st?.note ?? getPattern(p, e.pattern).tracks[e.track]?.note ?? e.note);
  }

  private gateOff(track: number, time: number) {
    if (track >= SYNTH_TRACKS) return;
    if (this.arps[track] && !this.arps[track]!.live) { this.stopArp(track, time); return; }
    // a poly track's notes overlap: each ends on its own LEN (polyTrig schedules it), and a stop or
    // pause releases them (polyStop)
    if (this.pool[track]) return;
    if (this.liveNote[track] !== null) return; // a held key owns the voice
    this.voices[track].port.postMessage({ t: 'off', time });
  }

  // --------------------------------------------------------------------------
  // Arpeggiator (engine side: schedules notes on the audio clock)
  // --------------------------------------------------------------------------

  private arpVal(t: number, k: ArpKey): number {
    const lock = this.arpLock[t][k];
    if (lock !== undefined) return lock;
    const p = asProject(this.data, SEQ_TRACKS);
    return patternArp(p, this.arpPattern[t] ?? p.active, t)?.[k] ?? this.arpBase[t][k];
  }

  private arpOn(t: number): boolean {
    return Math.round(this.arpVal(t, 'arp_mod')) > 0;
  }

  private arpOffsets(t: number): number[] {
    return (['arp_n2', 'arp_n3', 'arp_n4'] as const).map(k => Math.round(this.arpVal(t, k))).filter(o => o > 0);
  }

  private startArp(t: number, notes: number[], time: number, duration: number, vel: number, accent: boolean, live: boolean, locks: Readonly<Locks> = EMPTY_LOCKS) {
    const uniq = notes.filter((n, i) => notes.indexOf(n) === i);
    // a poly track's previous arpeggio ends where this one starts (one arpeggiator per track)
    const old = this.arps[t];
    if (old?.pv) this.polyRelease(old.pv, old.pid, time);
    const st: ArpState = {
      notes: uniq, order: [], idx: 0, oct: 0, next: time, end: duration === Infinity ? time + 32 * (60 / this.bpm() / 4) : time + duration,
      dir: 1, vel, accent, live, lastNote: uniq[0], locks, pv: this.pool[t] ? [] : null, pid: [],
    };
    if (live) st.end = Infinity;
    st.order = this.arpOrder(t, st);
    this.arps[t] = st;
    this.pumpArps();
    if (!this.arpTimer) this.arpTimer = setInterval(() => this.pumpArps(), 25);
  }

  private stopArp(t: number, time: number) {
    const st = this.arps[t];
    if (!st) return;
    st.end = Math.min(st.end, time);
    if (st.pv) this.polyRelease(st.pv, st.pid, Math.max(time, this.ctx.currentTime));
    else this.voices[t].port.postMessage({ t: 'off', time: Math.max(time, this.ctx.currentTime) });
    this.arps[t] = null;
  }

  private arpOrder(t: number, st: ArpState): number[] {
    const mode = Math.round(this.arpVal(t, 'arp_mod'));
    const sorted = [...st.notes].sort((a, b) => a - b);
    switch (mode) {
      case 1: return [...st.notes];                                  // THR: in the order the notes came in (manual p.43)
      case 2: return sorted;                                          // UP
      case 3: return sorted.reverse();                                // DWN
      case 4: return sorted.length > 2 ? [...sorted, ...sorted.slice(1, -1).reverse()] : sorted; // CYC
      case 5: { const s = [...sorted]; for (let i = s.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [s[i], s[j]] = [s[j], s[i]]; } return s; } // SHF
      // PLY: the whole chord is one arpeggio step, so each step climbs an octave (manual p.43); a mono
      // track plays the chord's first note
      case ARP_PLY: return [st.notes[0]];
      default: return sorted;                                         // RND picks per note
    }
  }

  private pumpArps() {
    const horizon = this.ctx.currentTime + 0.12;
    let active = false;
    for (let t = 0; t < SYNTH_TRACKS; t++) {
      const st = this.arps[t];
      if (!st) continue;
      active = true;
      const v = this.voices[t];
      const stepSec = 60 / this.bpm() / 4;
      const period = Math.max(1, Math.round(this.arpVal(t, 'arp_spd'))) * (60 / this.bpm() / 24);
      const nlen = NOTE_LENGTHS[Math.max(0, Math.min(NOTE_LENGTHS.length - 1, Math.round(this.arpVal(t, 'arp_nlen'))))] * stepSec;
      const legato = this.arpVal(t, 'arp_leg') >= 0.5;
      const range = Math.max(1, Math.round(this.arpVal(t, 'arp_rng')));
      const mode = Math.round(this.arpVal(t, 'arp_mod'));
      while (st.next < horizon && st.next < st.end) {
        if (st.idx >= st.order.length) {
          st.idx = 0;
          st.oct = (st.oct + 1) % range;
          st.order = this.arpOrder(t, st);
        }
        const base = mode === 6 ? st.notes[Math.floor(Math.random() * st.notes.length)] : st.order[st.idx];
        const note = Math.max(0, Math.min(127, base + 12 * st.oct));
        const off = st.next + (legato ? Math.max(nlen, period * 1.02) : Math.min(nlen, period * 0.98));
        if (st.pv) {
          // POLY: each arpeggio note takes a pool voice (PLY: the whole chord); legato keeps the voices
          const chord = mode === ARP_PLY ? st.notes.map(n => clampNote(n + 12 * st.oct)) : [note];
          const last = !legato || off >= st.end;
          const r = this.polyPlay(t, chord, st.next, last ? Math.min(off, st.end) : Infinity, {
            vel: st.vel, acc: st.accent, slide: false, leg: legato, live: legato, locks: st.locks, prefer: legato && st.pv.length ? st.pv : null, postOff: last,
          });
          st.pv = r.voices; st.pid = r.ids;
        } else {
          v.port.postMessage({ t: 'on', time: st.next, note, vel: st.vel, acc: st.accent ? 1 : 0, slide: false, leg: legato, live: legato });
          if (!legato || off >= st.end) v.port.postMessage({ t: 'off', time: Math.min(off, st.end) });
        }
        st.lastNote = note;
        st.idx++;
        st.next += period;
      }
      if (st.next >= st.end && st.end !== Infinity) {
        if (st.pv) this.polyRelease(st.pv, st.pid, st.end);
        else v.port.postMessage({ t: 'off', time: st.end });
        this.arps[t] = null;
      }
    }
    if (!active && this.arpTimer) { clearInterval(this.arpTimer); this.arpTimer = null; }
  }

  // --------------------------------------------------------------------------
  // Live play: the keyboard (panel keys, computer keyboard) plays the active track
  // --------------------------------------------------------------------------

  /** The synth track the keyboard plays: the active track, or the last synth track while FX / CV is active */
  private activeTrack(): number {
    const t = Math.max(0, Math.min(SEQ_TRACKS - 1, Math.round(this.num('track', 0))));
    return t < SYNTH_TRACKS ? t : this.lastSynth;
  }

  private octave(): number {
    return Math.round(this.num('kb_oct', 5)) - 5;
  }

  private trackVel(t: number): number {
    const p = asProject(this.data, SEQ_TRACKS);
    return getPattern(p, p.active).tracks[t]?.vel ?? 100;
  }

  /** note = MIDI note from the computer keyboard (lowNote 48 + offset) */
  noteOn(note: number, _velocity = 1): void {
    if (!this.started) return;
    this.liveOn(note + 12 * this.octave(), 'keys');
  }

  noteOff(note: number): void {
    if (!this.started) return;
    this.liveOff(note + 12 * this.octave());
  }

  /** A key played: `src` 'panel' (the A4's own keyboard) or 'keys' (the computer keyboard, MIDI) */
  private liveOn(note: number, src: 'panel' | 'keys' = 'panel') {
    const t = this.activeTrack();
    if (t >= SYNTH_TRACKS) return;
    this.unfadeFx();
    const time = this.ctx.currentTime + 0.004;
    const n = Math.max(0, Math.min(127, note));
    const held = this.held[t];
    if (!held.includes(n)) held.push(n);
    const vel = this.trackVel(t);
    this.recordLive(t, n, vel);
    // `held` counts the keys down on the track, this one included (2+: a chord)
    if (this.kbReport) this.emit({ kbNote: { id: ++this.kbSerial, track: t, note: n, held: held.length, src } });
    this.arpPattern[t] = this.seq.getState().pattern ?? null;
    if (this.arpOn(t)) {
      const notes = [...held];
      held.length === 1 && this.arpOffsets(t).forEach(o => notes.push(n + o));
      if (this.arps[t]?.live) { this.arps[t]!.notes = notes; this.arps[t]!.order = this.arpOrder(t, this.arps[t]!); }
      else this.startArp(t, notes, time, Infinity, vel, false, true);
      return;
    }
    if (this.pool[t]) { this.polyKeyOn(t, n, vel, time); return; }
    this.liveNote[t] = n;
    this.voices[t].port.postMessage({ t: 'on', time, note: n, vel, acc: 0, slide: false, live: true });
  }

  private liveOff(note: number) {
    const time = this.ctx.currentTime + 0.004;
    for (let t = 0; t < SYNTH_TRACKS; t++) {
      const held = this.held[t];
      const i = held.indexOf(note);
      if (i < 0) continue;
      held.splice(i, 1);
      if (this.kbReport) this.emit({ kbOff: { id: ++this.kbSerial, track: t, note, held: held.length } });
      const st = this.arps[t];
      if (st?.live) {
        if (!held.length) this.stopArp(t, time);
        else { st.notes = [...held]; st.order = this.arpOrder(t, st); }
        continue;
      }
      if (this.pool[t]) { this.polyKeyOff(t, note, time); continue; }
      if (held.length) {
        // last-note priority: return to the previous held key (legato)
        const prev = held[held.length - 1];
        this.liveNote[t] = prev;
        this.voices[t].port.postMessage({ t: 'on', time, note: prev, vel: this.trackVel(t), acc: 0, slide: false, live: true });
      } else {
        this.liveNote[t] = null;
        this.voices[t].port.postMessage({ t: 'off', time });
      }
    }
  }

  /** LIVE RECORDING: report the played note and its quantised step to the panel (which writes the trig) */
  private recordLive(t: number, note: number, vel: number) {
    if (!this.bool('live_rec')) return;
    const st = this.seq.getState();
    if (!st.playing || !st.pattern) return;
    const ls = this.lastStep[t];
    if (ls.step < 0) return;
    // LIVE RECORDING places trigs micro-timed: the nearest step plus a µTM offset in 1/24 steps (manual p.40)
    const stepSec = 60 / this.bpm() / 4;
    const frac = (this.ctx.currentTime - ls.time) / stepSec;
    const next = frac > 0.5;
    const step = next ? ls.step + 1 : ls.step;
    const micro = this.liveQuant ? 0 : Math.max(-23, Math.min(23, Math.round((next ? frac - 1 : frac) * 24)));
    // POLY: a key pressed while another is held, on the same step, joins that trig's chord
    let add = false;
    if (this.pool[t] && this.held[t].length > 1) {
      const lr = this.lastRec[t];
      add = !!lr && lr.step === step && lr.pattern === st.pattern;
    }
    this.lastRec[t] = { step, pattern: st.pattern };
    this.emit({ recNote: { id: ++this.recSerial, track: t, note, vel, step, micro, pattern: st.pattern, add } });
  }

  event(name: string, payload?: unknown): void {
    if (!this.started) return;
    if (this.seq.handleEvent(name, payload)) return;
    const p = (payload ?? {}) as { offset?: number };
    switch (name) {
      case 'kb:on': this.liveOn(KB_C1 + 12 * this.octave() + (p.offset ?? 0)); break;
      case 'kb:off': this.liveOff(KB_C1 + 12 * this.octave() + (p.offset ?? 0)); break;
      case 'panic':
        for (let t = 0; t < SYNTH_TRACKS; t++) { this.held[t] = []; this.liveNote[t] = null; this.stopArp(t, this.ctx.currentTime); this.voices[t].port.postMessage({ t: 'reset' }); }
        this.polyReset();
        break;
      // POLY CONFIG open / closed: report the voices' activity for the TRIG 1-4 LEDs (manual p.29)
      case 'a4:poly-watch': this.setWatch(!!(payload as { on?: boolean } | undefined)?.on); break;
      // LIVE RECORDING: a knob turn recorded as a lock sounds at once (the panel writes the lock)
      case 'a4:live-lock': this.liveLock(payload as { track?: number; key?: string; value?: number } | undefined); break;
      case 'a4:live-quant': this.liveQuant = !!(payload as { on?: boolean } | undefined)?.on; break;
      case 'a4:kb-report': this.kbReport = !!(payload as { on?: boolean } | undefined)?.on; break;
      // [STOP][STOP] while stopped: the send effects fade out (manual p.38)
      case 'a4:fxfade': this.fadeFx(); break;
      // the A4's own [STOP] key: the stop it causes lets the send effects ring (manual p.38)
      case 'a4:stopkey': this.stopKeyAt = this.ctx.currentTime; break;
      case 'a4:audition': this.startAudition(); break;
      case 'a4:audition:stop': this.auditionEnd?.(); break;
    }
  }

  /**
   * LIVE RECORDING: a knob turned while the track plays is recorded as a lock on the step that plays
   * (the panel writes it, manual p.50). It sounds at once, as a lock of the playing trig: the next
   * trig returns it to the kit value unless it is locked there too.
   */
  private liveLock(p: { track?: number; key?: string; value?: number } | undefined) {
    const t = p?.track, key = p?.key, val = p?.value;
    if (typeof t !== 'number' || typeof key !== 'string' || typeof val !== 'number') return;
    const now = this.ctx.currentTime;
    if (t === FX_TRACK) {
      const i = FI[key];
      if (i === undefined) return;
      this.locks.add(t, key, val);
      this.fxmod.port.postMessage({ t: 'at', time: now, list: [i, val] });
      this.toneAt(key, val, now);
      return;
    }
    if (t < 0 || t >= SYNTH_TRACKS) return;
    if (isArpKey(key)) { this.arpLock[t][key] = val; return; }
    const i = VI[key];
    if (i === undefined) return;
    if (this.pool[t]) {
      // every voice playing this track's notes
      for (const u of this.poolVoices) {
        if (this.book[u].track !== t) continue;
        const k = this.segAt(u, now);
        const s = k >= 0 ? this.segs[u][k] : null;
        if (s) this.loadVoice(u, t, { ...s.locks, [key]: val }, now, s.uni);
      }
      return;
    }
    this.locks.add(t, key, val);
    this.voices[t].port.postMessage({ t: 'at', time: now, list: [i, val] });
    if (key === 'osc2_wav') { this.neiLock[t] = Math.round(val) === NEI_WAVE; this.updateFeed(t); }
  }

  // --------------------------------------------------------------------------
  // POLY (manual p.28-31)
  // --------------------------------------------------------------------------

  /** POLY CONFIG changed ([FUNC] + [MIX], a kit, a lesson): a new pool starts from silence */
  private polyConfig() {
    const pool = [1, 2, 3, 4].map(n => this.bool(`poly_v${n}`));
    const alloc = Math.max(0, Math.min(POLY_UNISON, Math.round(this.num('poly_alloc', 0))));
    const trk = this.bool('poly_trk');
    const det = this.num('poly_det', 16), spr = this.num('poly_spr', 64);
    const uniMoved = det !== this.uniDet || spr !== this.uniSpr;
    this.uniDet = det;
    this.uniSpr = spr;
    if (pool.every((x, i) => x === this.pool[i]) && alloc === this.alloc && trk === this.trkSounds) {
      if (uniMoved) this.retuneUnison();
      return;
    }
    const now = this.ctx.currentTime;
    const touched = [0, 1, 2, 3].filter(v => pool[v] || this.pool[v]);
    this.pool = pool;
    this.alloc = alloc;
    this.trkSounds = trk;
    this.poolVoices = [0, 1, 2, 3].filter(v => pool[v]);
    this.rotPos = -1;
    this.lastVoiceOf.fill(-1);
    this.polyKeys.clear();
    // Every voice the old or the new pool holds is cut (nothing it had queued may sound) and goes
    // back to its own track's sound; those tracks start without held keys, arpeggios or locks
    for (const v of touched) {
      const node = this.voices[v];
      node.port.postMessage({ t: 'cut' });
      this.held[v] = [];
      this.liveNote[v] = null;
      this.arps[v] = null;
      this.uniLive[v] = null;
      this.arpLock[v] = {};
      this.locks.release(v, () => undefined);
      this.neiLock[v] = false;
      const b = this.book[v];
      b.id = 0; b.end = -Infinity; b.live = false;
      this.lastTrig[v] = { voices: [], ids: [] };
      this.segs[v] = [{ time: now, owner: v, locks: EMPTY_LOCKS, uni: NaN }];
      const list: number[] = [];
      for (let i = 0; i < VOICE_KEYS.length; i++) list.push(i, this.base[v][i]);
      node.port.postMessage({ t: 'at', time: now, list });
    }
    this.feedPoly.fill(false);
    for (let t = 1; t < SYNTH_TRACKS; t++) this.updateFeed(t);
    for (let k = 0; k < 3; k++) this.postFeed(k);
  }

  /** Panic: forget every poly note */
  private polyReset() {
    this.polyKeys.clear();
    this.uniLive.fill(null);
    for (const b of this.book) { b.id = 0; b.end = -Infinity; b.live = false; }
    this.lastTrig = [0, 1, 2, 3].map(() => ({ voices: [], ids: [] }));
  }

  /** A voice parameter for a segment: the owner's sound, the trig's lock, the UNISON offset */
  private segValue(s: Seg, i: number): number {
    const key = VOICE_KEYS[i];
    const l = s.locks[key];
    let v = l !== undefined ? l : this.base[s.owner][i];
    if (s.uni === s.uni) {
      if (key === 'osc1_tun' || key === 'osc2_tun') v += (s.uni * this.uniDet) / 128;
      else if (key === 'amp_pan') v = Math.max(-64, Math.min(63, v + (s.uni * this.uniSpr * 64) / 127));
    }
    return v;
  }

  /** The segment of voice u in effect at `time` (index), -1 when none */
  private segAt(u: number, time: number): number {
    const segs = this.segs[u];
    let k = segs.length - 1;
    while (k >= 0 && segs[k].time > time + 1e-9) k--;
    return k;
  }

  /**
   * From `time` on, voice u plays a note of `track`: it loads that track's sound (its own with USE
   * TRK SOUNDS), the trig's `locks` and the UNISON position `uni` - the whole sound when the owner
   * changes, else only what the locks and the position change
   */
  private loadVoice(u: number, track: number, locks: Readonly<Locks>, time: number, uni: number) {
    const owner = this.trkSounds ? u : track;
    const segs = this.segs[u];
    // segments long past are dropped (the last one before now stays in effect)
    const now = this.ctx.currentTime;
    while (segs.length > 1 && segs[1].time <= now - 0.25) segs.shift();
    const k = this.segAt(u, time);
    const prev = k >= 0 ? segs[k] : null;
    const seg: Seg = { time, owner, locks, uni };
    const list: number[] = [];
    if (!prev || prev.owner !== owner || k < segs.length - 1) {
      for (let i = 0; i < VOICE_KEYS.length; i++) list.push(i, this.segValue(seg, i));
    } else {
      const keys = new Set<number>();
      for (const key in prev.locks) { const i = VI[key]; if (i !== undefined) keys.add(i); }
      for (const key in locks) { const i = VI[key]; if (i !== undefined) keys.add(i); }
      if (!Object.is(prev.uni, uni)) for (const key of UNI_KEYS) keys.add(VI[key]);
      keys.forEach(i => list.push(i, this.segValue(seg, i)));
    }
    segs.splice(k + 1, 0, seg);
    if (list.length) this.voices[u].port.postMessage({ t: 'at', time, list });
    // loaded ahead of a segment already scheduled (a key played into notes queued by the sequencer):
    // that one was sent as a change from the state before, so it is sent whole again
    const nextSeg = segs[k + 2];
    if (nextSeg) {
      const full: number[] = [];
      for (let i = 0; i < VOICE_KEYS.length; i++) full.push(i, this.segValue(nextSeg, i));
      this.voices[u].port.postMessage({ t: 'at', time: nextSeg.time, list: full });
    }
    // a sound that takes OSC 2 from the voice before (WAV NEI) keeps that voice running (manual p.73)
    if (u >= 1) {
      const nei = Math.round(this.segValue(seg, VI.osc2_wav)) === NEI_WAVE;
      if (nei !== this.feedPoly[u - 1]) { this.feedPoly[u - 1] = nei; this.postFeed(u - 1); }
    }
  }

  /** A knob of poly track t moved: every voice that holds (or will hold) t's sound follows, except where a trig locks it */
  private polyParam(t: number, i: number, key: string) {
    const now = this.ctx.currentTime;
    for (const u of this.poolVoices) {
      const segs = this.segs[u];
      for (let k = Math.max(0, this.segAt(u, now)); k < segs.length; k++) {
        const s = segs[k];
        if (s.owner !== t || key in s.locks) continue;
        this.queueAt(u, Math.max(s.time, now), i, this.segValue(s, i));
      }
    }
  }

  /** polyParam at an audio time (a kit change where a pattern starts) */
  private polyParamAt(t: number, i: number, key: string, time: number) {
    for (const u of this.poolVoices) {
      const segs = this.segs[u];
      for (let k = Math.max(0, this.segAt(u, time)); k < segs.length; k++) {
        const s = segs[k];
        if (s.owner !== t || key in s.locks) continue;
        this.voices[u].port.postMessage({ t: 'at', time: Math.max(s.time, time), list: [i, this.segValue(s, i)] });
      }
    }
  }

  /** UNISON DETUNE / PAN SPREAD moved: the voices in unison retune at once */
  private retuneUnison() {
    const now = this.ctx.currentTime;
    for (const u of this.poolVoices) {
      const segs = this.segs[u];
      for (let k = Math.max(0, this.segAt(u, now)); k < segs.length; k++) {
        const s = segs[k];
        if (s.uni !== s.uni) continue;
        for (const key of UNI_KEYS) this.queueAt(u, Math.max(s.time, now), VI[key], this.segValue(s, VI[key]));
      }
    }
  }

  /** Is poly voice u free at `time`: its note has ended and no later one is booked on it */
  private voiceFree(u: number, time: number): boolean {
    const b = this.book[u];
    return b.end <= time + 1e-9 && b.on <= time + 1e-9;
  }

  /**
   * Pool voices for `notes` of `track` at `time` (manual p.29-31). RESET: the first free voice
   * counting up from the track's own voice. ROTATE: the next free voice after the last one used.
   * REASSIGN: the voice the note had last time when it is free, else the free voice used least
   * recently. No free voice: the least recently used one is stolen. UNISON: every pool voice.
   * `prefer` (a note slide, a legato arpeggio) takes those voices first.
   */
  private allocVoices(track: number, notes: number[], time: number, prefer: number[] | null): number[] {
    const pool = this.poolVoices;
    if (!pool.length) return [];
    if (this.alloc === POLY_UNISON) return pool.slice();
    const out: number[] = [];
    const lru = (ok: (u: number) => boolean) => {
      let pick = -1;
      for (const u of pool) if (ok(u) && (pick < 0 || this.book[u].on < this.book[pick].on)) pick = u;
      return pick;
    };
    for (let k = 0; k < notes.length && out.length < pool.length; k++) {
      const note = notes[k];
      const free = (u: number) => !out.includes(u) && this.voiceFree(u, time);
      let pick = -1;
      if (prefer && k < prefer.length && pool.includes(prefer[k]) && !out.includes(prefer[k])) pick = prefer[k];
      else if (this.alloc === 0 || this.alloc === 1) {
        const start = this.alloc === 0 ? Math.max(0, pool.indexOf(track)) : pool.indexOf(this.rotPos) + 1;
        for (let j = 0; j < pool.length && pick < 0; j++) { const u = pool[(start + j) % pool.length]; if (free(u)) pick = u; }
      } else {
        const last = this.lastVoiceOf[note];
        pick = last >= 0 && pool.includes(last) && free(last) ? last : lru(free);
      }
      if (pick < 0) pick = lru(u => !out.includes(u));
      if (pick < 0) break;
      out.push(pick);
      if (this.alloc === 1) this.rotPos = pick;
    }
    return out;
  }

  /**
   * Play `notes` on poly track `track` from `time` until `end` (Infinity: until released): a trig's
   * note and chord, an arpeggio step, a key. UNISON plays the first note on every pool voice, each
   * detuned and panned by its place in the pool. Returns the voices and the note ids.
   */
  private polyPlay(track: number, notes: number[], time: number, end: number, o: {
    vel: number; acc: boolean; slide: boolean; rt?: number; leg: boolean; live: boolean; locks: Readonly<Locks>; prefer: number[] | null; postOff: boolean;
  }): { voices: number[]; ids: number[] } {
    const unison = this.alloc === POLY_UNISON;
    const list = unison ? notes.slice(0, 1) : notes;
    const voices = this.allocVoices(track, list, time, o.prefer);
    const ids: number[] = [];
    const n = this.poolVoices.length;
    voices.forEach((u, k) => {
      const note = unison ? list[0] : list[k];
      const uni = unison ? (n > 1 ? (2 * this.poolVoices.indexOf(u)) / (n - 1) - 1 : 0) : NaN;
      this.loadVoice(u, track, o.locks, time, uni);
      const id = this.nextNoteId++;
      const on: Record<string, unknown> = { t: 'on', time, note, vel: o.vel, acc: o.acc ? 1 : 0, slide: o.slide, leg: o.leg, live: o.live, id };
      if (o.rt !== undefined) on.rt = o.rt;
      this.voices[u].port.postMessage(on);
      if (o.postOff && end !== Infinity) this.voices[u].port.postMessage({ t: 'off', time: end, id });
      const b = this.book[u];
      b.id = id; b.track = track; b.note = note; b.on = time; b.end = end; b.live = o.live && end === Infinity;
      if (!unison) this.lastVoiceOf[note] = u;
      ids.push(id);
    });
    return { voices, ids };
  }

  /** End poly notes (voice, id) at `time`; a voice another note has taken ignores it */
  private polyRelease(voices: number[], ids: number[], time: number) {
    voices.forEach((u, k) => {
      this.voices[u].port.postMessage({ t: 'off', time, id: ids[k] });
      const b = this.book[u];
      if (b.id === ids[k]) { b.end = Math.min(b.end, time); b.live = false; }
    });
  }

  /** A sequencer trig on a poly track: its notes (a chord trig plays them all), locks and slides on the voices it takes */
  private polyTrig(e: TrigEvent) {
    const t = e.track;
    // NO2-NO4 locks belong to this trig: the next one replaces them
    const arpL: Partial<Record<ArpKey, number>> = {};
    for (const k in e.locks) if ((ARP_KEYS as readonly string[]).includes(k)) arpL[k as ArpKey] = e.locks[k];
    this.arpLock[t] = arpL;
    const sw = (k: string, d: number) => { const x = e.locks[k]; return x === undefined ? d : x >= 0.5 ? 1 : 0; };
    if (e.trigless) {
      // a lock trig changes the sound of the voices playing this track's notes
      const rt = sw('trig_envf', 0) | (sw('trig_env2', 0) << 1) | (sw('trig_lfo1', 0) << 2) | (sw('trig_lfo2', 0) << 3);
      const voices: number[] = [];
      for (const u of this.poolVoices) {
        const b = this.book[u];
        if (b.track !== t || b.on > e.time + 1e-9) continue;
        const k = this.segAt(u, e.time);
        const prev = k >= 0 ? this.segs[u][k] : null;
        this.loadVoice(u, t, { ...(prev?.locks ?? {}), ...e.locks }, e.time, prev ? prev.uni : NaN);
        if (rt) this.voices[u].port.postMessage({ t: 'rtrg', time: e.time, rt });
        voices.push(u);
      }
      this.polySlide(e, voices);
      return;
    }
    const rt = sw('trig_envf', 1) | (sw('trig_env2', 1) << 1) | (sw('trig_lfo1', 1) << 2) | (sw('trig_lfo2', 1) << 3);
    const step = getStep(asProject(this.data, SEQ_TRACKS), e.pattern, t, e.step);
    const notes = trigNotes(step, this.trigNote(e));
    this.arpPattern[t] = e.pattern;
    if (this.arpOn(t)) {
      this.startArp(t, [...notes, ...this.arpOffsets(t).map(o => notes[0] + o)], e.time, e.duration, e.velocity, e.accent, false, e.locks);
      return;
    }
    const end = e.duration === Infinity ? Infinity : e.time + e.duration;
    const r = this.polyPlay(t, notes, e.time, end, {
      vel: e.velocity, acc: e.accent, slide: e.slide, rt, leg: this.arpVal(t, 'arp_leg') >= 0.5, live: false, locks: e.locks,
      prefer: e.slide ? this.lastTrig[t].voices : null, postOff: true,
    });
    this.lastTrig[t] = r;
    this.polySlide(e, r.voices);
  }

  /** A parameter slide on poly voices: this trig's values glide to the next trig's */
  private polySlide(e: TrigEvent, voices: number[]) {
    if (!e.paramSlide || !e.slideTo || !voices.length) return;
    const to = e.slideTo;
    const keys = new Set([...Object.keys(e.locks), ...Object.keys(to.locks)]);
    for (const u of voices) {
      const k = this.segAt(u, e.time);
      const s = k >= 0 ? this.segs[u][k] : null;
      if (!s) continue;
      const ramp: number[] = [];
      keys.forEach(key => {
        const i = VI[key];
        if (i === undefined) return;
        ramp.push(i, this.segValue({ ...s, locks: e.locks }, i), this.segValue({ ...s, locks: to.locks }, i));
      });
      if (ramp.length) this.voices[u].port.postMessage({ t: 'ramp', time: e.time, t1: to.time, list: ramp });
    }
  }

  /** A key on a poly track: a voice of its own (UNISON: every voice, the last key wins) */
  private polyKeyOn(t: number, n: number, vel: number, time: number) {
    const opts = { vel, acc: false, slide: false, leg: false, live: true, locks: EMPTY_LOCKS, prefer: null, postOff: false };
    if (this.alloc === POLY_UNISON) { this.uniLive[t] = this.polyPlay(t, [n], time, Infinity, opts); return; }
    const prev = this.polyKeys.get(`${t}:${n}`);
    if (prev) this.polyRelease(prev.voices, prev.ids, time);
    this.polyKeys.set(`${t}:${n}`, this.polyPlay(t, [n], time, Infinity, opts));
  }

  /** A key on a poly track released (`held`: the keys still down on it) */
  private polyKeyOff(t: number, n: number, time: number) {
    if (this.alloc === POLY_UNISON) {
      const cur = this.uniLive[t];
      if (!cur) return;
      const held = this.held[t];
      if (held.length) {
        // back to the last key still held, like a mono track
        this.uniLive[t] = this.polyPlay(t, [held[held.length - 1]], time, Infinity, {
          vel: this.trackVel(t), acc: false, slide: false, leg: false, live: true, locks: EMPTY_LOCKS, prefer: null, postOff: false,
        });
      } else {
        this.polyRelease(cur.voices, cur.ids, time);
        this.uniLive[t] = null;
      }
      return;
    }
    const r = this.polyKeys.get(`${t}:${n}`);
    if (!r) return;
    this.polyKeys.delete(`${t}:${n}`);
    this.polyRelease(r.voices, r.ids, time);
  }

  /**
   * The sequencer stopped (the poly voices are cut, as [STOP] cuts the sound) or paused (their
   * sequencer notes are released). Held keys keep playing. Locks end with the stop: each voice
   * returns to its sound.
   */
  private polyStop(now: number, paused: boolean) {
    for (const u of this.poolVoices) {
      const b = this.book[u];
      // held keys keep playing, and so does an arpeggio of held keys
      if (b.live || this.arps[b.track]?.live) continue;
      if (paused) {
        if (b.end > now) { this.voices[u].port.postMessage({ t: 'off', time: now, id: b.id }); b.end = now; }
      } else {
        this.voices[u].port.postMessage({ t: 'cut' });
        b.end = Math.min(b.end, now);
        // the cut drops what the voice had queued, so its later segments go too
        this.segs[u].length = Math.max(0, this.segAt(u, now)) + 1;
      }
      const k = this.segAt(u, now);
      const s = k >= 0 ? this.segs[u][k] : null;
      if (s && Object.keys(s.locks).length) this.loadVoice(u, s.owner, EMPTY_LOCKS, now, s.uni);
    }
  }

  /** POLY CONFIG open: report which pool voices sound (engine state `polyAct`, e.g. '0101'), 25 times a second */
  private setWatch(on: boolean) {
    if (on && !this.watchTimer) this.watchTimer = setInterval(() => this.emitActivity(), 40);
    if (!on && this.watchTimer) { clearInterval(this.watchTimer); this.watchTimer = null; }
    this.lastAct = '';
    this.emitActivity();
  }

  private emitActivity() {
    const now = this.ctx.currentTime;
    const act = this.book.map((b, u) => (this.pool[u] && b.on <= now && b.end > now ? '1' : '0')).join('');
    if (act === this.lastAct) return;
    this.lastAct = act;
    this.emit({ polyAct: act });
  }

  // --------------------------------------------------------------------------
  // Send-FX fade, auditions
  // --------------------------------------------------------------------------

  private fadeFx(dur = FX_FADE_SEC) {
    this.fxFaded = true;
    this.fxmod.port.postMessage({ t: 'fade', dur });
  }

  private unfadeFx() {
    if (!this.fxFaded) return;
    this.fxFaded = false;
    this.fxmod.port.postMessage({ t: 'unfade' });
  }

  /**
   * A preview (lessons, the preset browser, audio QA): the pattern from its
   * start, as [PLAY] would play it; an empty pattern plays a riff on the
   * keyboard's track instead. The preview ends like [STOP][STOP]: the sound is
   * cut and the send effects fade.
   */
  private startAudition() {
    this.auditionEnd?.();
    if (this.seq.getState().playing) return; // already playing: nothing to preview
    this.unfadeFx();
    const p = asProject(this.data, SEQ_TRACKS);
    const pat = getPattern(p, p.active);
    const hasTrigs = pat.tracks.slice(0, SYNTH_TRACKS).some((tr, t) => !this.seq.isMuted(t) && !tr.mute && Object.values(tr.steps).some(s => s && !s.trigless));
    if (hasTrigs) {
      const stop = this.seq.audition();
      this.auditionEnd = () => { this.auditionEnd = null; stop(); this.fadeFx(); };
      return;
    }
    const t = this.activeTrack();
    const v = this.voices[t];
    const stepSec = 60 / this.bpm() / 4;
    const t0 = this.ctx.currentTime + 0.03;
    if (this.pool[t]) {
      // a poly track's own voice may hold another track's sound: give it this track's for the riff
      this.loadVoice(t, t, EMPTY_LOCKS, t0, NaN);
      const b = this.book[t];
      b.id = 0; b.track = t; b.on = t0; b.end = t0 + 32 * stepSec; b.live = false;
    }
    const root = KB_C1 + 12 * this.octave();
    const vel = this.trackVel(t);
    for (const [step, semis, len] of AUDITION_RIFF) {
      const note = Math.max(0, Math.min(127, root + semis));
      v.port.postMessage({ t: 'on', time: t0 + step * stepSec, note, vel, acc: 0, slide: false });
      v.port.postMessage({ t: 'off', time: t0 + (step + len) * stepSec - 0.002 });
    }
    this.auditionEnd = () => { this.auditionEnd = null; v.port.postMessage({ t: 'cut' }); this.fadeFx(); };
  }
}
