// ============================================================================
// Xone:96 audio engine. The signal flow follows the block diagram in the
// Xone:96 User Guide (p.34); REFERENCE.md lists every source.
//
//  studio_1..4 (LINE) ┐                          ┌─ LR MIX ─────────────────────────┐
//  deck / USB file    ├─► 'xone96-strips' 1-4 ──┼─ FILTER 1 MIX ───────────────────┤
//                     ┘   (GAIN, EQ, meter,     ├─ FILTER 2 MIX ───────────────────┼─► 'xone96-master' ─► out
//  studio_a/b (RTN)   ┐    VCA = fader x XF,    ├─ AUX 1 ─► delay ─► RTN A ─┐      │   (Xone:VCF x 2, LR MIX,
//  FX returns, deck,  ├─► 'xone96-strips' A-D ──┤  AUX 2 ─► reverb ─► RTN B ─┤      │    MASTER 1 / 2, BOOTH,
//  file, RTN C/D      ┘    FILTER SELECT, CUE)  ├─ CUE 1, CUE 2 (PHONES 2) ──────────┤    MONITOR, PHONES 2,
//                                               └─ CLEANFEED (MIC A/B) ─────────────┘    YOU HEAR)
//
// Channels 1-4 and A-D run in two worklet nodes, so the FX returns (fed by the
// 1-4 sends) reach A/B without a feedback cycle. Studio instruments arrive on
// GainNode inputs (this.inputs.studio_*): routed in, an instrument takes over
// its channel's LINE input (RTN on A/B, replacing the stand-in FX return);
// routed out, the channel hears its built-in deck again.
//
// The built-in decks follow the studio transport (16th-note steps with audio
// times from its ticks), or the twin's own clock when the Xone isn't synced.
// Nothing in the audio path looks ahead: zero added latency.
// ============================================================================

import type { ControlValue } from '@/types';
import { BaseEngine, Clock } from '@/lib/audio/engine';
import { Delay, Reverb2, smooth } from '@/lib/audio/dsp';
import type { Transport } from '@/lib/audio/transport';
import {
  AUDITION_START_16TH, CHANNELS, type ChannelId, FILE_IN, FADER_CURVES, FX_BEATS, MON, OUT_SCALE, PHONES2_SOURCES,
  RETURNS, type ReturnId, SOURCE_TRIM_DB, SRC, STUDIO_IN, STUDIO_INPUTS, STUDIO_POSITION, TYPE_MASK, XFADER_CURVES,
  addMixLaw, crunchDriveDb, faderLaw, gainLin, isAux, killBandGain, linToDbu, masterLaw, midBandDb, MID_CUT_AUX,
  MID_CUT_MAIN, phonesLaw, resToQ, returnLevelLin, sendLaw, xfaderLaw,
} from './model';

// Strip parameter slots (keep in sync with public/worklets/xone96-processors.js)
const P = {
  DECK: 0, STUDIO: 1, FILE: 2, RTN: 3, TRIM: 4, LO: 5, HI: 6, MIDA: 7, MIDB: 8, MIDF: 9,
  FADER: 10, XF: 11, DIRECT: 12, F1: 13, F2: 14, S1PRE: 15, S1POST: 16, S2: 17, CUE: 18, CUEPOST: 19, CF: 20, CUE2: 21,
} as const;
const NP = 22;
const K_MAIN = 0, K_AUX = 1, K_RTN = 2;
/** Strip outputs (stereo): LR MIX, FILTER 1 MIX, FILTER 2 MIX, AUX 1, AUX 2, CUE 1, CUE 2, CLEANFEED MIX */
const O = { DIRECT: 0, F1: 1, F2: 2, S1: 3, S2: 4, CUE: 5, CUE2: 6, CF: 7 } as const;
/** Master inputs */
const I = { DIRECT: 0, F1: 1, F2: 2, CUE: 3, CUE2: 4, CF: 5 } as const;
/** INPUT position of the mic on CH A/B */
const MIC = 1;

export type StripId = ChannelId | ReturnId;
/** The worklet node and slot of each strip */
const SLOT: Record<StripId, { node: 0 | 1; i: number }> = {
  '1': { node: 0, i: 0 }, '2': { node: 0, i: 1 }, '3': { node: 0, i: 2 }, '4': { node: 0, i: 3 },
  a: { node: 1, i: 0 }, b: { node: 1, i: 1 }, c: { node: 1, i: 2 }, d: { node: 1, i: 3 },
};
const STRIPS: StripId[] = ['1', '2', '3', '4', 'a', 'b', 'c', 'd'];

/** Studio transport: 24 PPQN, so a 16th note is 6 ticks */
const SIXTEENTH_TICKS = 6;

export type MeterReading = { db: number; pk: boolean };
export type MeterSnapshot = { stamp: number; cueOn: boolean; meters: Readonly<Record<string, MeterReading>> };

export class Xone96Engine extends BaseEngine {
  private strips: AudioWorkletNode[] = [];
  private master!: AudioWorkletNode;
  private studioIn = {} as Record<StripId, GainNode>;
  private fileIn = {} as Record<ChannelId, GainNode>;
  private players = {} as Record<ChannelId, { buffer?: AudioBuffer; node?: AudioBufferSourceNode }>;
  private delay!: Delay;
  private reverb!: Reverb2;
  private routed = {} as Record<StripId, boolean>;
  private sent = new Map<string, string>();
  private sentSrc = new Map<string, number>();

  // decks and transport
  private clock!: Clock;
  private clockStart16 = 0;
  private running = false;
  private auditioning = false;
  private t0 = 0;
  private unsub: (() => void)[] = [];
  private stepLog: { time: number; n: number }[] = [];
  private pendingFiles = new Map<ChannelId, File>();
  private files: Record<string, string> = {};

  // meters
  private stripMeters: number[][] = [[], []];
  private masterMeters: number[] = [];
  private meterState: Record<string, MeterReading> = {};
  private meterCue = false;
  private meterStamp = 0;

  protected build(): void {
    const ctx = this.ctx;
    const g = (v = 1) => { const n = ctx.createGain(); n.gain.value = v; return n; };

    // --- inputs ------------------------------------------------------------------
    STRIPS.forEach(id => { this.studioIn[id] = g(1); this.routed[id] = false; });
    CHANNELS.forEach(id => { this.fileIn[id] = g(FILE_IN); this.players[id] = {}; });
    const rtnA = g(1), rtnB = g(1);

    // --- channel strips: 1-4 in one node, A, B and the RTN C/D returns in another ---
    const opts = (kinds: number[], inputs: { studio?: number; file?: number; rtn?: number }[], seed: number): AudioWorkletNodeOptions => ({
      numberOfInputs: 8,
      numberOfOutputs: 8,
      outputChannelCount: [2, 2, 2, 2, 2, 2, 2, 2],
      processorOptions: { kinds, inputs, seed },
    });
    const s14 = new AudioWorkletNode(ctx, 'xone96-strips', opts([K_MAIN, K_MAIN, K_MAIN, K_MAIN],
      [{ studio: 0, file: 4 }, { studio: 1, file: 5 }, { studio: 2, file: 6 }, { studio: 3, file: 7 }], 1));
    const sAD = new AudioWorkletNode(ctx, 'xone96-strips', opts([K_AUX, K_AUX, K_RTN, K_RTN],
      [{ studio: 0, file: 4, rtn: 6 }, { studio: 1, file: 5, rtn: 7 }, { studio: 2 }, { studio: 3 }], 2));
    this.strips = [s14, sAD];
    (['1', '2', '3', '4'] as const).forEach((id, i) => {
      this.studioIn[id].connect(s14, 0, i);
      this.fileIn[id].connect(s14, 0, 4 + i);
    });
    (['a', 'b', 'c', 'd'] as const).forEach((id, i) => this.studioIn[id].connect(sAD, 0, i));
    this.fileIn.a.connect(sAD, 0, 4);
    this.fileIn.b.connect(sAD, 0, 5);
    rtnA.connect(sAD, 0, 6);
    rtnB.connect(sAD, 0, 7);

    // --- master section: the buses, both Xone:VCF sections and the outputs -----------
    // The VCFs run inside the master worklet: a state-variable filter whose three outputs are
    // summed by the lit type switches (guide p.14), so every combination is exact.
    this.master = new AudioWorkletNode(ctx, 'xone96-master', { numberOfInputs: 6, numberOfOutputs: 1, outputChannelCount: [2] });
    this.master.connect(this.out);
    for (const s of this.strips) {
      s.connect(this.master, O.DIRECT, I.DIRECT);
      s.connect(this.master, O.F1, I.F1);
      s.connect(this.master, O.F2, I.F2);
      s.connect(this.master, O.CUE, I.CUE);
      s.connect(this.master, O.CUE2, I.CUE2);
    }
    sAD.connect(this.master, O.CF, I.CF); // only MIC A / MIC B use the clean feed

    // --- the stand-in FX unit: SND 1 -> delay -> RTN A, SND 2 -> reverb -> RTN B -----
    // Every channel has sends, A and B included, so a return can feed its own effect
    // (dub feedback) as on the hardware. Web Audio allows a loop only through a
    // DelayNode: the delay has one, and the reverb return gets one render quantum
    // (2.7 ms, inaudible on a reverb with 20 ms predelay). The main path has none.
    this.delay = new Delay(ctx, 2);
    this.delay.tone.frequency.value = 4500;
    this.reverb = new Reverb2(ctx, 2.5, { lowCut: 120, highCut: 12000 });
    this.reverb.damping.value = 6000;
    for (const s of this.strips) {
      s.connect(this.delay.input, O.S1);
      s.connect(this.reverb.input, O.S2);
    }
    const loopGuard = ctx.createDelay(0.01);
    this.delay.output.connect(rtnA);
    this.reverb.output.connect(loopGuard).connect(rtnB);

    // --- studio routing targets ----------------------------------------------------
    this.inputs = {};
    STUDIO_INPUTS.forEach(({ id, ch }) => {
      this.inputs[id] = {
        node: this.studioIn[ch],
        scale: STUDIO_IN,
        onConnect: () => this.setRouted(ch, true),
        onDisconnect: () => this.setRouted(ch, false),
      };
    });

    // --- meters ------------------------------------------------------------------
    this.strips.forEach((s, k) => {
      s.port.onmessage = (e: MessageEvent<{ t: string; v: number[] }>) => {
        if (e.data?.t !== 'm') return;
        this.stripMeters[k] = e.data.v;
        if (k === 1) this.publishMeters();
      };
    });
    this.master.port.onmessage = (e: MessageEvent<{ t: string; v: number[] }>) => {
      if (e.data?.t === 'm') this.masterMeters = e.data.v;
    };

    // --- the twin's own clock (when not following the studio transport) ------------
    this.clock = new Clock(ctx, (time, tick) => this.internalTick(time, tick), this.dur16());

    this.onDispose(() => {
      this.unsub.forEach(u => u());
      this.unsub = [];
      this.clock.stop();
      this.stopPlayers();
      this.strips.forEach(s => { s.port.onmessage = null; try { s.disconnect(); } catch { /* */ } });
      this.master.port.onmessage = null;
      try { this.master.disconnect(); } catch { /* */ }
    });

    this.emit({ playing: false, synced: false, files: {}, routed: {} });
    this.pendingFiles.forEach((f, ch) => void this.loadFile(ch, f));
    this.pendingFiles.clear();
  }

  /** Send the whole state once the graph exists (BaseEngine calls onParam for every control first) */
  start(ctx: AudioContext, destination: AudioNode | null): void {
    super.start(ctx, destination);
    CHANNELS.forEach(c => this.updateStrip(c));
    RETURNS.forEach(r => this.updateReturn(r));
    this.updateFilter(0);
    this.updateFilter(1);
    this.updateMaster();
    this.updateDelayTime();
  }

  // --------------------------------------------------------------------------
  // Controls -> worklet settings
  // --------------------------------------------------------------------------

  /** Post a strip's targets, only when one of them changed */
  private sendStrip(id: StripId, v: number[]) {
    const key = v.map(x => (Number.isFinite(x) ? x.toPrecision(6) : '0')).join(',');
    if (this.sent.get(id) === key) return;
    this.sent.set(id, key);
    const s = SLOT[id];
    this.strips[s.node].port.postMessage({ t: 'ch', c: s.i, v });
  }

  /**
   * FILTER SELECT, after the VCA: LR MIX, FILTER 1 MIX or FILTER 2 MIX. A section that is OFF
   * passes its bus dry, so its channels go straight to the LR MIX (CRUNCH out of circuit).
   * With MIC selected on A/B the clean feed takes the channel instead (block diagram).
   */
  private filterAssign(id: ChannelId, cleanFeed: boolean) {
    if (cleanFeed) return { direct: 0, f1: 0, f2: 0, cf: 1 };
    const a = this.num(`ch${id}_filter`, 1);
    const on1 = this.bool('f1_on'), on2 = this.bool('f2_on');
    return {
      direct: a === 1 || (a === 0 && !on1) || (a === 2 && !on2) ? 1 : 0,
      f1: a === 0 && on1 ? 1 : 0,
      f2: a === 2 && on2 ? 1 : 0,
      cf: 0,
    };
  }

  /** The crossfader's share of the channel VCA. Only CH 1-4 have an XFADER assign (guide p.11-12). */
  private xfGain(id: ChannelId): number {
    if (isAux(id)) return 1;
    const assign = this.num(`ch${id}_xf`, 1);
    if (assign === 1) return 1;
    const curve = XFADER_CURVES[this.num('xf_curve', 0)] ?? 'const';
    const [gx, gy] = xfaderLaw(this.num('xfader', 5) / 10, curve);
    return assign === 0 ? gx : gy;
  }

  /** What a channel hears: its deck, a routed studio instrument, a file or the FX return */
  private sourceOf(id: ChannelId) {
    const input = this.num(`ch${id}_input`, 2);
    const file = input === 0 || input === 3;
    const studio = input === STUDIO_POSITION && this.routed[id];
    const aux = isAux(id);
    const deck = !file && !studio && (aux ? input === MIC : true) && this.num(`ch${id}_src`, SRC.NONE) !== SRC.NONE;
    const rtn = aux && input === 2 && !studio;
    return { deck, studio, file, rtn, cleanFeed: aux && input === MIC };
  }

  /** PHONES 2 9-way source: 0 = MST, else the channel or return it listens to */
  private phones2Of(id: StripId): number {
    return PHONES2_SOURCES[this.num('phones2_src', 0)]?.toLowerCase() === id ? 1 : 0;
  }

  private updateStrip(id: ChannelId) {
    if (!this.started) return;
    const aux = isAux(id);
    const v = new Array<number>(NP).fill(0);
    const src = this.sourceOf(id);
    const deckSrc = this.num(`ch${id}_src`, SRC.NONE);
    v[P.DECK] = src.deck ? Math.pow(10, (SOURCE_TRIM_DB[deckSrc] ?? 0) / 20) : 0;
    v[P.STUDIO] = src.studio ? 1 : 0;
    v[P.FILE] = src.file ? 1 : 0;
    v[P.RTN] = src.rtn ? 1 : 0;
    v[P.TRIM] = gainLin(this.num(`ch${id}_gain`, 0));
    v[P.LO] = killBandGain(this.num(`ch${id}_lo`, 0));
    v[P.HI] = killBandGain(this.num(`ch${id}_hi`, 0));
    if (aux) {
      v[P.MIDA] = midBandDb(this.num(`ch${id}_mid`, 0), MID_CUT_AUX);
      v[P.MIDF] = this.num(`ch${id}_midf`, 650);
    } else {
      v[P.MIDA] = midBandDb(this.num(`ch${id}_lomid`, 0), MID_CUT_MAIN);
      v[P.MIDB] = midBandDb(this.num(`ch${id}_himid`, 0), MID_CUT_MAIN);
      v[P.MIDF] = 650;
    }
    // CH 1-4: a VCA set by the fader (through the CHANNEL FADER curve) and the crossfader.
    // CH A/B: an analogue fader, not on the curve switch or the crossfader (guide p.9, p.12).
    const curve = aux ? 'const' : FADER_CURVES[this.num('fader_curve', 0)] ?? 'const';
    v[P.FADER] = faderLaw(this.num(`ch${id}_fader`, 10) / 10, curve);
    v[P.XF] = this.xfGain(id);
    const fx = this.filterAssign(id, src.cleanFeed);
    v[P.DIRECT] = fx.direct;
    v[P.F1] = fx.f1;
    v[P.F2] = fx.f2;
    v[P.CF] = fx.cf;
    // SEND 1: PRE (post-EQ, pre-VCA) or post-VCA per channel; SEND 2: always post-VCA (the worklet applies the VCA)
    const s1 = sendLaw(this.num(`ch${id}_snd1`, 0));
    const pre = this.bool(`ch${id}_pre`);
    v[P.S1PRE] = pre ? s1 : 0;
    v[P.S1POST] = pre ? 0 : s1;
    v[P.S2] = sendLaw(this.num(`ch${id}_snd2`, 0));
    v[P.CUE] = this.bool(`ch${id}_cue`) ? 1 : 0;
    v[P.CUEPOST] = this.bool('cue_post_eq') ? 1 : 0;
    v[P.CUE2] = this.phones2Of(id);
    this.sendStrip(id, v);
    const deck = src.deck ? deckSrc : SRC.NONE;
    if (this.sentSrc.get(id) !== deck) {
      this.sentSrc.set(id, deck);
      const s = SLOT[id];
      this.strips[s.node].port.postMessage({ t: 'src', c: s.i, v: deck });
    }
  }

  /** RTN C / RTN D: LEVEL, then ON into the LR MIX; CUE and PHONES 2 listen before ON (block diagram) */
  private updateReturn(id: ReturnId) {
    if (!this.started) return;
    const v = new Array<number>(NP).fill(0);
    v[P.STUDIO] = 1;
    v[P.TRIM] = returnLevelLin(this.num(`rtn${id}_level`, 0));
    v[P.LO] = 1; v[P.HI] = 1; v[P.FADER] = 1; v[P.XF] = 1;
    v[P.DIRECT] = this.bool(`rtn${id}_on`) ? 1 : 0;
    v[P.CUE] = this.bool(`rtn${id}_cue`) ? 1 : 0;
    v[P.CUEPOST] = 1;
    v[P.CUE2] = this.phones2Of(id);
    this.sendStrip(id, v);
  }

  /** A Xone:VCF section: lit switch mask, FREQ, Q (from RES), CRUNCH drive in dB */
  private updateFilter(f: 0 | 1) {
    if (!this.started) return;
    const p = `f${f + 1}_`;
    const mask = TYPE_MASK[this.num(`${p}type`, f === 0 ? 0 : 2)] ?? 1;
    this.master.port.postMessage({
      t: 'f', f,
      v: [mask, this.num(`${p}freq`, f === 0 ? 20 : 20000), resToQ(this.num(`${p}res`, 2)), crunchDriveDb(this.num(`${p}crunch`, 0))],
    });
  }

  private updateMaster() {
    if (!this.started) return;
    this.master.port.postMessage({
      t: 'p',
      v: [
        masterLaw(this.num('master', 8)),
        masterLaw(this.num('booth', 8)),
        this.bool('booth_mono') ? 1 : 0,
        this.bool('booth_mute') ? 1 : 0,
        this.num('booth_lo', 0), this.num('booth_mid', 0), this.num('booth_hi', 0),
        phonesLaw(this.num('phones', 6)),
        addMixLaw(this.num('cue_mix', 0)),
        this.bool('split_cue') ? 1 : 0,
        this.num('monitor_out', MON.MST1),
        OUT_SCALE,
        // With nothing cued the MONITOR headphones hear the LR MIX
        CHANNELS.some(c => this.bool(`ch${c}_cue`)) || RETURNS.some(r => this.bool(`rtn${r}_cue`)) ? 1 : 0,
        masterLaw(this.num('master2', 8)),
        phonesLaw(this.num('phones2', 6)),
        addMixLaw(this.num('phones2_mix', 0)),
        this.num('phones2_src', 0) === 0 ? 1 : 0,
      ],
    });
  }

  private bpm(): number {
    return this.transport ? this.transport.bpm : this.num('bpm', 124);
  }

  private dur16(): number {
    return 60 / this.bpm() / 4;
  }

  private updateDelayTime() {
    if (!this.started) return;
    const beats = FX_BEATS[this.num('fx_time', 1)] ?? 0.75;
    smooth(this.delay.delay.delayTime, Math.min(1.95, (60 / this.bpm()) * beats), this.ctx, 0.05);
  }

  protected onParam(id: string, value: ControlValue): void {
    const n = typeof value === 'number' ? value : value ? 1 : 0;
    const m = /^ch(a|b|[1-4])_/.exec(id);
    if (m) {
      this.updateStrip(m[1] as ChannelId);
      if (id.endsWith('_cue')) this.updateMaster();
      return;
    }
    const r = /^rtn(c|d)_/.exec(id);
    if (r) {
      this.updateReturn(r[1] as ReturnId);
      if (id.endsWith('_cue')) this.updateMaster();
      return;
    }
    switch (id) {
      case 'f1_type': case 'f1_freq': case 'f1_res': case 'f1_crunch': this.updateFilter(0); break;
      case 'f2_type': case 'f2_freq': case 'f2_res': case 'f2_crunch': this.updateFilter(1); break;
      case 'f1_on': case 'f2_on': case 'xfader': case 'xf_curve': case 'fader_curve': case 'cue_post_eq':
        CHANNELS.forEach(c => this.updateStrip(c));
        break;
      case 'phones2_src':
        CHANNELS.forEach(c => this.updateStrip(c));
        RETURNS.forEach(r => this.updateReturn(r));
        this.updateMaster();
        break;
      case 'master': case 'master2': case 'booth': case 'booth_mono': case 'booth_mute': case 'booth_lo': case 'booth_mid': case 'booth_hi':
      case 'phones': case 'cue_mix': case 'split_cue': case 'monitor_out': case 'phones2': case 'phones2_mix':
        this.updateMaster();
        break;
      case 'play': this.setPlaying(!!value); break;
      case 'bpm':
        if (!this.transport) { this.clock.setInterval(this.dur16()); this.updateDelayTime(); }
        break;
      case 'fx_time': this.updateDelayTime(); break;
      case 'fx_fdbk': smooth(this.delay.feedback.gain, (n / 10) * 0.85, this.ctx); break;
      case 'fx_size': this.reverb.setSize(n); break;
    }
  }

  // --------------------------------------------------------------------------
  // Studio routing
  // --------------------------------------------------------------------------

  private setRouted(id: StripId, on: boolean) {
    this.routed[id] = on;
    if (id === 'c' || id === 'd') this.updateReturn(id);
    else this.updateStrip(id);
    this.emit({ routed: { ...this.routed } });
  }

  // --------------------------------------------------------------------------
  // Decks: the studio transport, or the twin's own clock
  // --------------------------------------------------------------------------

  /** One 16th-note step for every deck, at audio time `time` */
  private step(time: number, n: number, d16: number) {
    const f = Math.round(time * this.ctx.sampleRate);
    for (const s of this.strips) s.port.postMessage({ t: 'step', f, n, d: d16 });
    this.stepLog.push({ time, n });
    if (this.stepLog.length > 16) this.stepLog.shift();
  }

  private internalTick(time: number, tick: number) {
    if (tick === 0) {
      this.t0 = time;
      if (!this.auditioning) this.startPlayers(time);
    }
    this.step(time, this.clockStart16 + tick, this.dur16());
  }

  private startInternal(from16: number) {
    this.clockStart16 = from16;
    this.clock.setInterval(this.dur16());
    this.clock.start();
  }

  private haltDecks() {
    this.clock.stop();
    for (const s of this.strips) s.port.postMessage({ t: 'stop' });
    this.stopPlayers();
    this.stepLog = [];
  }

  private setPlaying(on: boolean) {
    // While following the studio, the hub turns PLAY into studio play/stop and mirrors it back
    if (this.transport) { this.emit({ playing: this.transport.playing }); return; }
    if (on === this.running && !this.auditioning) return;
    if (this.auditioning) { this.auditioning = false; this.haltDecks(); }
    this.running = on;
    if (on) this.startInternal(0);
    else this.haltDecks();
    this.emit({ playing: on });
  }

  protected onTransport(t: Transport | null): void {
    this.unsub.forEach(u => u());
    this.unsub = [];
    if (this.auditioning) { this.auditioning = false; this.haltDecks(); }
    if (t) {
      if (this.running) { this.running = false; this.haltDecks(); }
      this.unsub.push(t.onTick(tk => {
        if (tk.tick % SIXTEENTH_TICKS !== 0) return;
        this.step(tk.time, Math.floor(tk.tick / SIXTEENTH_TICKS), tk.tickDuration * SIXTEENTH_TICKS);
      }));
      this.unsub.push(t.onEvent(e => {
        if (e.type === 'start') {
          if (this.auditioning) { this.auditioning = false; this.haltDecks(); }
          this.t0 = e.time;
          this.startPlayers(e.time);
          this.emit({ playing: true });
        } else if (e.type === 'stop') {
          for (const s of this.strips) s.port.postMessage({ t: 'stop' });
          this.stopPlayers();
          this.stepLog = [];
          this.emit({ playing: false });
        } else if (e.type === 'tempo') {
          this.updateDelayTime();
        }
      }));
      if (t.playing) this.startPlayers(this.ctx.currentTime + 0.05);
      this.emit({ playing: t.playing, synced: true });
    } else {
      this.emit({ playing: false, synced: false });
      if (this.bool('play')) { this.running = true; this.startInternal(0); this.emit({ playing: true }); }
    }
    this.updateDelayTime();
  }

  /** Lessons' "listen": play the decks from bar 17 (every element playing) if nothing runs */
  private audition(on: boolean) {
    if (on) {
      if (this.running || this.auditioning || this.transport?.playing) return;
      this.auditioning = true;
      this.startInternal(AUDITION_START_16TH);
    } else if (this.auditioning) {
      this.auditioning = false;
      this.haltDecks();
    }
  }

  /** Where the decks are: the 16th-note index sounding now, or -1 when stopped */
  position(): number {
    if (!this.started || !(this.running || this.auditioning || this.transport?.playing)) return -1;
    const now = this.ctx.currentTime;
    let n = -1;
    for (const s of this.stepLog) if (s.time <= now && s.n > n) n = s.n;
    return n;
  }

  // --------------------------------------------------------------------------
  // Files on the USB inputs (twin: your own audio, looping)
  // --------------------------------------------------------------------------

  private startPlayers(time: number) {
    CHANNELS.forEach(id => this.startPlayer(id, time));
  }

  private startPlayer(id: ChannelId, time: number) {
    const p = this.players[id];
    if (!p.buffer) return;
    if (p.node) { try { p.node.stop(); } catch { /* */ } p.node.disconnect(); }
    const node = this.ctx.createBufferSource();
    node.buffer = p.buffer;
    node.loop = true;
    node.connect(this.fileIn[id]);
    node.start(Math.max(time, this.ctx.currentTime));
    p.node = node;
  }

  private stopPlayers() {
    CHANNELS.forEach(id => {
      const p = this.players[id];
      if (!p?.node) return;
      try { p.node.stop(); } catch { /* */ }
      p.node.disconnect();
      p.node = undefined;
    });
  }

  private async loadFile(id: ChannelId, file: File) {
    this.files = { ...this.files, [id]: `Decoding ${file.name}…` };
    this.emit({ files: this.files });
    try {
      const data = await file.arrayBuffer();
      const buffer = await this.ctx.decodeAudioData(data);
      if (!this.started) return;
      this.players[id].buffer = buffer;
      this.files = { ...this.files, [id]: file.name };
      if (this.running || this.transport?.playing) {
        // Drop it in on the next bar line
        const bar = this.dur16() * 16;
        const start = this.transport?.playing ? this.transport.startedAt : this.t0;
        const k = Math.ceil((this.ctx.currentTime + 0.05 - start) / bar);
        this.startPlayer(id, start + k * bar);
      }
    } catch (e) {
      console.warn('[xone96] could not decode', file.name, e);
      this.files = { ...this.files, [id]: `Can't decode ${file.name}` };
    }
    this.emit({ files: this.files });
  }

  event(name: string, payload?: unknown): void {
    if (name === 'audition') { if (this.started) this.audition(true); return; }
    if (name === 'audition:stop') { if (this.started) this.audition(false); return; }
    const m = /^load:(a|b|[1-4])$/.exec(name);
    if (!m || !(payload instanceof Blob)) return;
    const id = m[1] as ChannelId;
    if (!this.started) { this.pendingFiles.set(id, payload as File); return; }
    void this.loadFile(id, payload as File);
  }

  // --------------------------------------------------------------------------
  // Meters. The panel reads them on animation frames (meterSnapshot), so a
  // moving meter never re-renders the whole panel.
  // --------------------------------------------------------------------------

  private publishMeters() {
    const [a, b] = this.stripMeters;
    const mm = this.masterMeters;
    const meters = this.meterState;
    const put = (k: string, lin: number | undefined, pk: number | undefined) => {
      const m = meters[k] ?? (meters[k] = { db: -120, pk: false });
      m.db = linToDbu(lin);
      m.pk = !!pk; // sample-peak flags: channel PK! post-GAIN, pre-EQ at +15 dBu (block diagram); LR MIX PK! LED at +10 dBu
    };
    (['1', '2', '3', '4'] as const).forEach((id, i) => put(id, a?.[2 * i], a?.[2 * i + 1]));
    (['a', 'b', 'c', 'd'] as const).forEach((id, i) => put(id, b?.[2 * i], b?.[2 * i + 1]));
    // The LR MIX meters show the cue while a CUE is on; SPLIT CUE: cue left, LR MIX right
    const cueOn = CHANNELS.some(c => this.bool(`ch${c}_cue`)) || RETURNS.some(r => this.bool(`rtn${r}_cue`));
    const split = this.bool('split_cue');
    const cueMono = Math.max(mm[2] ?? 0, mm[3] ?? 0), mixMono = Math.max(mm[0] ?? 0, mm[1] ?? 0);
    if (split && cueOn) { put('L', cueMono, mm[6] || mm[7]); put('R', mixMono, mm[4] || mm[5]); }
    else if (cueOn) { put('L', mm[2], mm[6]); put('R', mm[3], mm[7]); }
    else { put('L', mm[0], mm[4]); put('R', mm[1], mm[5]); }
    put('mix', mixMono, mm[4] || mm[5]);
    this.meterCue = cueOn;
    this.meterStamp++;
  }

  /** Latest meter readings in dBu (the panel polls this on animation frames) */
  meterSnapshot(): MeterSnapshot {
    return { stamp: this.meterStamp, cueOn: this.meterCue, meters: this.meterState };
  }

  /** The LR MIX level in dBu, pre-MASTER (tests and the studio lessons) */
  mixLevelDbu(): number {
    return this.meterState.mix?.db ?? -120;
  }
}
