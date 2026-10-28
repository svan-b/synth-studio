// ============================================================================
// Analog Four MKII audio engine
//
//   T1..T4  a4-voice worklet (one node per track: the whole analog voice, see
//           public/worklets/analog-four-processors.js)        out0 dry, out1 sends
//              │ dry ──────────────────────────────────────────────┐
//              │ sends (cho, del, rev) ──┬─► split ─► chorus ─┐    │
//              │                         └──────────────────► a4-fx (delay, sends, mix) ─► main ─► out
//   T(n+1) mono ─► T(n) input (OSC 2 WAV NEI)                  ▲        │ reverb send
//   a4-fxmod (FX track params, FX LFOs, locks) ─► split ─► chorus / reverb params, a4-fx params
//                                                         fdn-reverb ◄──┘ ─► revRet ─► main
//
// Worklet nodes: 4 voices + a4-fxmod + chorus + fdn-reverb + a4-fx = 8 (the
// previous version used 36 plus about 120 native nodes). Native: 2 splitters,
// 2 gains.
//
// Sequencer: the shared ElektronSequencer with 6 tracks (T1-T4, FX, CV). Trigs
// carry their parameter locks to the voice at the trig's audio time; the next
// trig on the track returns unlocked parameters to the track (kit) value, as on
// the hardware (LockTracker). Parameter slides ramp in the worklet. FX track
// trigs lock FX parameters and retrigger the FX LFOs. The CV track is
// sequenced but has no outputs (rear-panel jacks are not in the twin).
// ============================================================================

import type { ControlValue } from '@/types';
import { BaseEngine } from '@/lib/audio/engine';
import type { Transport } from '@/lib/audio/transport';
import {
  ElektronSequencer, LockTracker, NOTE_LENGTHS, asProject, getPattern, type TrigEvent,
} from '@/lib/sequencer/elektron';
import {
  CV_TRACK, FX_BY_KEY, FX_DESTS, FX_KEYS, FX_TRACK, MOD_DESTS, PERF_MACROS, SEQ_TRACKS, SYNTH_BY_KEY, SYNTH_TRACKS,
  VOICE_KEYS,
} from './params';

const VI: Record<string, number> = Object.fromEntries(VOICE_KEYS.map((k, i) => [k, i]));
const FI: Record<string, number> = Object.fromEntries(FX_KEYS.map((k, i) => [k, i]));
const ARP_KEYS = ['arp_mod', 'arp_spd', 'arp_rng', 'arp_nlen', 'arp_leg', 'arp_n2', 'arp_n3', 'arp_n4'] as const;
type ArpKey = (typeof ARP_KEYS)[number];

/** a4-fxmod output channels driving the shared processors (must match the worklet) */
const FXC = { CHO_RATE: 0, CHO_DEPTH: 1, CHO_DELAY: 2, CHO_FB: 3, CHO_WIDTH: 4, REV_PRE: 5, REV_DECAY: 6, REV_SIZE: 7, REV_DAMP: 8, REV_WIDTH: 9, REV_VOL: 23 };
const FX_CHANNELS = 24;

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
}

export class AnalogFourEngine extends BaseEngine {
  private voices: AudioWorkletNode[] = [];
  private fxmod!: AudioWorkletNode;
  private fx!: AudioWorkletNode;
  private chorus!: AudioWorkletNode;
  private reverb!: AudioWorkletNode;
  private main!: GainNode;
  private seq!: ElektronSequencer;
  private locks = new LockTracker(SEQ_TRACKS);
  /** Track (kit) values of the voice parameters, per synth track */
  private base: Float64Array[] = [];
  private fxBase = new Float64Array(FX_KEYS.length);
  private arpBase: Record<ArpKey, number>[] = [];
  private arpLock: Partial<Record<ArpKey, number>>[] = [];
  private pending = new Map<MessagePort, number[]>();
  private flushQueued = false;
  private arps: (ArpState | null)[] = [null, null, null, null];
  private arpTimer: ReturnType<typeof setInterval> | null = null;
  private held: number[][] = [[], [], [], []];   // live keys per track (arp)
  private liveNote: (number | null)[] = [null, null, null, null];
  private lastStep: { step: number; time: number }[] = [];
  private transportUnsub: (() => void) | null = null;
  private recSerial = 0;

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
      if (t > 0) v.connect(this.voices[t - 1], 2, 0); // NEI: track t feeds track t-1's OSC 2
    });
    sendSplit.connect(this.chorus, 0, 0);
    this.chorus.connect(this.fx, 0, 1);
    this.fxmod.connect(this.fx, 0, 3);
    this.fx.connect(this.main, 0);
    this.fx.connect(this.reverb, 1, 0);
    this.reverb.connect(revRet).connect(this.main);
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
      onPlay: playing => {
        if (!playing) {
          this.locks.releaseAll((track, key) => this.revert(track, key, this.ctx.currentTime));
          for (let t = 0; t < SYNTH_TRACKS; t++) this.stopArp(t, this.ctx.currentTime);
        }
      },
    });
    this.seq.subscribe(s => this.emit({ seq: s, playing: s.playing }));
    this.sendTempo();

    this.onDispose(() => {
      this.seq.dispose();
      this.transportUnsub?.();
      if (this.arpTimer) clearInterval(this.arpTimer);
      [...this.voices, this.fxmod, this.fx, this.chorus, this.reverb].forEach(n => { try { n.disconnect(); n.port.close(); } catch { /* */ } });
    });
    this.emit({ playing: false, seq: this.seq.getState() });
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
      if (key === 'mute') { this.seq.setMute(t, !!value); return; }
      if (t >= SYNTH_TRACKS || key.startsWith('trig_')) return;
      if ((ARP_KEYS as readonly string[]).includes(key)) { this.arpBase[t][key as ArpKey] = v; return; }
      const i = VI[key];
      if (i === undefined) return;
      this.base[t][i] = v;
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
        if (!this.transport) { if (value) this.seq.start(); else this.seq.stop(); }
        break;
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

  private revert(track: number, key: string, time: number) {
    if (track < SYNTH_TRACKS) {
      if ((ARP_KEYS as readonly string[]).includes(key)) { delete this.arpLock[track][key as ArpKey]; return; }
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
    const v = this.voices[t];
    if (!v) return;
    const list: number[] = [];
    this.locks.apply(t, e.locks,
      (k, val) => {
        const i = VI[k];
        if (i !== undefined) list.push(i, val);
        else if ((ARP_KEYS as readonly string[]).includes(k)) this.arpLock[t][k as ArpKey] = val;
      },
      k => {
        const i = VI[k];
        if (i !== undefined) list.push(i, this.base[t][i]);
        else if ((ARP_KEYS as readonly string[]).includes(k)) delete this.arpLock[t][k as ArpKey];
      });
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
    if (e.trigless) return;
    const note = Math.max(0, Math.min(127, e.note + Math.round(this.num('trns', 0))));
    if (this.arpOn(t)) {
      this.startArp(t, [note, ...this.arpOffsets(t).map(o => note + o)], e.time, e.duration, e.velocity, e.accent, false);
      return;
    }
    v.port.postMessage({ t: 'on', time: e.time, note, vel: e.velocity, acc: e.accent ? 1 : 0, slide: e.slide });
  }

  private gateOff(track: number, time: number) {
    if (track >= SYNTH_TRACKS) return;
    if (this.arps[track] && !this.arps[track]!.live) { this.stopArp(track, time); return; }
    if (this.liveNote[track] !== null) return; // a held key owns the voice
    this.voices[track].port.postMessage({ t: 'off', time });
  }

  // --------------------------------------------------------------------------
  // Arpeggiator (engine side: schedules notes on the audio clock)
  // --------------------------------------------------------------------------

  private arpVal(t: number, k: ArpKey): number {
    return this.arpLock[t][k] ?? this.arpBase[t][k];
  }

  private arpOn(t: number): boolean {
    return Math.round(this.arpVal(t, 'arp_mod')) > 0;
  }

  private arpOffsets(t: number): number[] {
    return (['arp_n2', 'arp_n3', 'arp_n4'] as const).map(k => Math.round(this.arpVal(t, k))).filter(o => o > 0);
  }

  private startArp(t: number, notes: number[], time: number, duration: number, vel: number, accent: boolean, live: boolean) {
    const uniq = notes.filter((n, i) => notes.indexOf(n) === i);
    const st: ArpState = {
      notes: uniq, order: [], idx: 0, oct: 0, next: time, end: duration === Infinity ? time + 32 * (60 / this.bpm() / 4) : time + duration,
      dir: 1, vel, accent, live, lastNote: uniq[0],
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
    this.voices[t].port.postMessage({ t: 'off', time: Math.max(time, this.ctx.currentTime) });
    this.arps[t] = null;
  }

  private arpOrder(t: number, st: ArpState): number[] {
    const mode = Math.round(this.arpVal(t, 'arp_mod'));
    const sorted = [...st.notes].sort((a, b) => a - b);
    switch (mode) {
      case 1: return [...st.notes];                                  // TRU: as played
      case 2: return sorted;                                          // UP
      case 3: return sorted.reverse();                                // DWN
      case 4: return sorted.length > 2 ? [...sorted, ...sorted.slice(1, -1).reverse()] : sorted; // CYC
      case 5: { const s = [...sorted]; for (let i = s.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [s[i], s[j]] = [s[j], s[i]]; } return s; } // SHF
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
        v.port.postMessage({ t: 'on', time: st.next, note, vel: st.vel, acc: st.accent ? 1 : 0, slide: false, leg: legato, live: legato });
        const off = st.next + (legato ? Math.max(nlen, period * 1.02) : Math.min(nlen, period * 0.98));
        if (!legato || off >= st.end) v.port.postMessage({ t: 'off', time: Math.min(off, st.end) });
        st.lastNote = note;
        st.idx++;
        st.next += period;
      }
      if (st.next >= st.end && st.end !== Infinity) {
        v.port.postMessage({ t: 'off', time: st.end });
        this.arps[t] = null;
      }
    }
    if (!active && this.arpTimer) { clearInterval(this.arpTimer); this.arpTimer = null; }
  }

  // --------------------------------------------------------------------------
  // Live play: the keyboard (panel keys, computer keyboard) plays the active track
  // --------------------------------------------------------------------------

  private activeTrack(): number {
    return Math.max(0, Math.min(SEQ_TRACKS - 1, Math.round(this.num('track', 0))));
  }

  private octave(): number {
    return Math.round(this.num('kb_oct', 4)) - 3;
  }

  private trackVel(t: number): number {
    const p = asProject(this.data, SEQ_TRACKS);
    return getPattern(p, p.active).tracks[t]?.vel ?? 100;
  }

  /** note = MIDI note from the computer keyboard (lowNote 48 + offset) */
  noteOn(note: number, _velocity = 1): void {
    if (!this.started) return;
    this.liveOn(note + 12 * this.octave());
  }

  noteOff(note: number): void {
    if (!this.started) return;
    this.liveOff(note + 12 * this.octave());
  }

  private liveOn(note: number) {
    const t = this.activeTrack();
    if (t >= SYNTH_TRACKS) return;
    const time = this.ctx.currentTime + 0.004;
    const n = Math.max(0, Math.min(127, note));
    const held = this.held[t];
    if (!held.includes(n)) held.push(n);
    const vel = this.trackVel(t);
    this.recordLive(t, n, vel);
    if (this.arpOn(t)) {
      const notes = [...held];
      held.length === 1 && this.arpOffsets(t).forEach(o => notes.push(n + o));
      if (this.arps[t]?.live) { this.arps[t]!.notes = notes; this.arps[t]!.order = this.arpOrder(t, this.arps[t]!); }
      else this.startArp(t, notes, time, Infinity, vel, false, true);
      return;
    }
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
      const st = this.arps[t];
      if (st?.live) {
        if (!held.length) this.stopArp(t, time);
        else { st.notes = [...held]; st.order = this.arpOrder(t, st); }
        continue;
      }
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
    const stepSec = 60 / this.bpm() / 4;
    const late = this.ctx.currentTime - ls.time;
    const step = late > stepSec / 2 ? ls.step + 1 : ls.step;
    this.emit({ recNote: { id: ++this.recSerial, track: t, note, vel, step, pattern: st.pattern } });
  }

  event(name: string, payload?: unknown): void {
    if (!this.started) return;
    if (this.seq.handleEvent(name, payload)) return;
    const p = (payload ?? {}) as { offset?: number };
    switch (name) {
      case 'kb:on': this.liveOn(48 + 12 * this.octave() + (p.offset ?? 0)); break;
      case 'kb:off': this.liveOff(48 + 12 * this.octave() + (p.offset ?? 0)); break;
      case 'panic':
        for (let t = 0; t < SYNTH_TRACKS; t++) { this.held[t] = []; this.liveNote[t] = null; this.stopArp(t, this.ctx.currentTime); this.voices[t].port.postMessage({ t: 'reset' }); }
        break;
    }
  }
}
