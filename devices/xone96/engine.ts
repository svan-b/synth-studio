// ============================================================================
// Xone:96 audio engine
//
//  deck / file / RTN ─► INPUT sel ─► GAIN ─► EQ ─► (soft clip) ─┬─► METER (post-EQ, pre-fader)
//                                                              ├─► CUE (pre- or post-EQ) ─► cue bus
//                                                              ├─► SEND 1 (PRE)
//                                                  CH FADER ◄──┘
//                                                     ├─► SEND 1 (POST) / SEND 2 ─► FX unit ─► RTN A / RTN B
//                                                     └─► XFADER (X/OFF/Y) ─► FILTER assign 1 / OFF / 2
//  FILTER 1, FILTER 2: CRUNCH ─► state-variable HPF/BPF/LPF ─┐
//  direct channels ──────────────────────────────────────────┴─► LR MIX ─┬─► LR meters
//                                                                       ├─► MASTER ─► master out
//                                                                       ├─► BOOTH (mono) ─► booth out
//                                                                       └─► PHONES (CUE/MST or SPLIT)
//  YOU HEAR (twin) picks which output goes to the speakers.
//
// Levels: internal 0.1 = 0 dBu. The channel and master stages soft-clip at
// 1.0 (+20 dBu), matching the specified 20 dB of headroom.
//
// EQ: the kill bands are made with Linkwitz-Riley (LR4) band splits at 180 Hz
// and 3 kHz, so LO/HI can reach a true kill (-inf) while the bands still sum
// flat at 0 dB; the mid bands are peaking filters on the middle band
// (350 Hz / 1.1 kHz on 1-4, swept 190 Hz-2.75 kHz on A/B).
//
// Filters: one 2-pole state-variable-style BiquadFilter per section (12 dB/oct,
// HPF/BPF/LPF) after a CRUNCH waveshaper. The "external" FX unit is a
// tempo-synced Delay on SEND 1 (returned on channel A's RTN input) and a
// Reverb on SEND 2 (returned on channel B's RTN input).
// ============================================================================

import type { ControlValue } from '@/types';
import { BaseEngine, Clock } from '@/lib/audio/engine';
import { Delay, Reverb, smooth } from '@/lib/audio/dsp';
import { CHANNELS, type ChannelId, isAux, killBandGain, midBandDb, gainDb, CH_METER_DBU, MASTER_METER_DBU } from './spec';
import { Voices, playStep, SRC, ARRANGEMENT_BARS, SOURCE_TRIM_DB } from './sources';

const REF = 0.1;          // 0 dBu
const FILE_GAIN = 0.25;   // a full-scale file arrives at about +8 dBu, like a CDJ line out
const OUT_SCALE = 3.5;      // mixer level -> app master bus
const METER_MS = 50;

type Fader = 'const' | 'dipped' | 'cut';
const CURVE_KEYS: Fader[] = ['const', 'dipped', 'cut'];

/** Channel fader law (position 0..1 -> gain) */
export function faderLaw(pos: number, curve: Fader): number {
  const p = Math.max(0, Math.min(1, pos));
  if (curve === 'cut') return 1 - Math.pow(1 - p, 3);
  if (curve === 'dipped') return Math.pow(p, 1.5);
  return Math.pow(p, 2.5);
}

/** Crossfader law: position 0 (X) .. 1 (Y) -> [gainX, gainY] */
export function xfaderLaw(pos: number, curve: Fader): [number, number] {
  const p = Math.max(0, Math.min(1, pos));
  if (curve === 'cut') return [Math.min(1, (1 - p) / 0.04), Math.min(1, p / 0.04)];
  const x = Math.cos((p * Math.PI) / 2), y = Math.sin((p * Math.PI) / 2);
  if (curve === 'dipped') return [x * x, y * y];
  return [x, y];
}

const knobLaw = (v: number) => Math.pow(Math.max(0, v) / 7.5, 2); // 7.5 on the dial = unity

function softClipCurve(): Float32Array<ArrayBuffer> {
  // Pre-gain 0.5 maps +-2.0 onto the curve's +-1 domain; linear to 0.8, then saturates at 1.0
  const n = 2048;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = ((i / (n - 1)) * 2 - 1) * 2;
    const m = Math.abs(a);
    const y = m < 0.8 ? m : 0.8 + 0.2 * Math.tanh((m - 0.8) / 0.2);
    c[i] = Math.sign(a) * y;
  }
  return c;
}

function tanhCurve(): Float32Array<ArrayBuffer> {
  const n = 2048;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) c[i] = Math.tanh(((i / (n - 1)) * 2 - 1) * 4);
  return c;
}

interface Strip {
  id: ChannelId;
  deckIn: GainNode;
  fileIn: GainNode;
  selDeck: GainNode;
  selFile: GainNode;
  selRtn?: GainNode;
  trim: GainNode;
  lo: GainNode;
  hi: GainNode;
  peaks: BiquadFilterNode[];  // [lomid, himid] or [mid]
  out: GainNode;              // post-EQ, post-clip (meter point)
  meter: AnalyserNode;
  cuePre: GainNode;
  cuePost: GainNode;
  cue: GainNode;
  fader: GainNode;
  snd1Pre?: GainNode;
  snd1Post?: GainNode;
  snd1?: GainNode;
  snd2?: GainNode;
  xf: GainNode;
  toDirect: GainNode;
  toF1: GainNode;
  toF2: GainNode;
  player?: AudioBufferSourceNode;
  buffer?: AudioBuffer;
}

interface FilterSection {
  input: GainNode;
  dry: GainNode;
  wetPre: GainNode;
  wetPost: GainNode;
  wet: GainNode;
  biquad: BiquadFilterNode;
  makeup: GainNode;
}

export class Xone96Engine extends BaseEngine {
  private strips = {} as Record<ChannelId, Strip>;
  private filters: FilterSection[] = [];
  private mix!: GainNode;
  private cueBus!: GainNode;
  private send1!: GainNode;
  private send2!: GainNode;
  private delay!: Delay;
  private reverb!: Reverb;
  private masterGain!: GainNode;
  private boothGain!: GainNode;
  private boothStereo!: GainNode;
  private boothMono!: GainNode;
  private phonesBlendCue!: GainNode;
  private phonesBlendMix!: GainNode;
  private phonesSplit!: GainNode;
  private phonesBlend!: GainNode;
  private phonesLevel!: GainNode;
  private mon: GainNode[] = [];
  private meterL!: AnalyserNode;
  private meterR!: AnalyserNode;
  private meterCue!: AnalyserNode;
  private buf = new Float32Array(2048);
  private held: Record<string, number> = {};
  private lastSig = '';
  private meterTimer: ReturnType<typeof setInterval> | null = null;

  private voices!: Voices;
  private clock!: Clock;
  private t0 = 0;
  private playing = false;
  private pendingFiles = new Map<ChannelId, File>();
  private files: Record<string, string> = {};

  protected build(): void {
    const ctx = this.ctx;
    const g = (v = 1) => { const n = ctx.createGain(); n.gain.value = v; return n; };
    const stereo = (v = 1) => {
      const n = g(v);
      n.channelCount = 2;
      n.channelCountMode = 'explicit';
      n.channelInterpretation = 'speakers';
      return n;
    };
    // Web Audio reads lowpass/highpass Q in dB (Butterworth = -3.01 dB) and
    // allpass/peaking/bandpass Q as a linear ratio (Butterworth = 0.7071)
    const bq = (type: BiquadFilterType, f: number, q?: number) => {
      const b = ctx.createBiquadFilter();
      b.type = type;
      b.frequency.value = f;
      b.Q.value = q ?? (type === 'lowpass' || type === 'highpass' ? 20 * Math.log10(Math.SQRT1_2) : Math.SQRT1_2);
      return b;
    };
    const chain = (...nodes: AudioNode[]) => { for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]); return nodes[nodes.length - 1]; };
    const clipCurve = softClipCurve();
    const analyser = () => { const a = ctx.createAnalyser(); a.fftSize = 2048; return a; };

    this.voices = new Voices(ctx);
    this.mix = stereo();
    this.cueBus = stereo();
    this.send1 = stereo();
    this.send2 = stereo();

    // --- Virtual FX unit (stands in for external hardware on SND/RTN) ----------
    this.delay = new Delay(ctx, 2);
    this.reverb = new Reverb(ctx, 2.5);
    this.send1.connect(this.delay.input);
    this.send2.connect(this.reverb.input);
    const rtnA = stereo(1);
    const rtnB = stereo(1);
    this.delay.output.connect(rtnA);
    this.reverb.output.connect(rtnB);

    // --- Filter sections ------------------------------------------------------------
    const crunch = tanhCurve();
    for (let f = 0; f < 2; f++) {
      const input = stereo();
      const dry = g(1), wetPre = g(0.25), wetPost = g(1), wet = g(0);
      const ws = ctx.createWaveShaper();
      ws.curve = crunch;
      ws.oversample = '2x';
      const biquad = bq('highpass', 20);
      const makeup = g(1);
      input.connect(dry).connect(biquad);
      chain(input, wetPre, ws, wetPost, wet, biquad);
      biquad.connect(makeup).connect(this.mix);
      this.filters.push({ input, dry, wetPre, wetPost, wet, biquad, makeup });
    }

    // --- Channel strips --------------------------------------------------------------
    CHANNELS.forEach(id => {
      const aux = isAux(id);
      const deckIn = stereo(), fileIn = stereo(FILE_GAIN);
      const selDeck = g(0), selFile = g(0);
      const pre = stereo();
      deckIn.connect(selDeck).connect(pre);
      fileIn.connect(selFile).connect(pre);
      let selRtn: GainNode | undefined;
      if (aux) {
        selRtn = g(0);
        (id === 'a' ? rtnA : rtnB).connect(selRtn).connect(pre);
      }
      const trim = g(1);
      pre.connect(trim);

      // LR4 band split: LO < 180 Hz, MID, HI > 3 kHz; lo path all-passed at 3 kHz so the sum is flat
      const loBand = chain(trim, bq('lowpass', 180), bq('lowpass', 180), bq('allpass', 3000)) as BiquadFilterNode;
      const rest = chain(trim, bq('highpass', 180), bq('highpass', 180));
      const hiBand = chain(rest, bq('highpass', 3000), bq('highpass', 3000));
      const midBand = chain(rest, bq('lowpass', 3000), bq('lowpass', 3000));
      const peaks = aux ? [bq('peaking', 700, 1.0)] : [bq('peaking', 350, 0.9), bq('peaking', 1100, 0.9)];
      peaks.forEach(p => (p.gain.value = 0));
      const midOut = chain(midBand, ...peaks);
      const lo = g(1), hi = g(1);
      const sum = stereo();
      loBand.connect(lo).connect(sum);
      hiBand.connect(hi).connect(sum);
      midOut.connect(sum);

      // Soft clip (20 dB headroom), then the meter point
      const clipPre = g(0.5);
      const ws = ctx.createWaveShaper();
      ws.curve = clipCurve;
      const out = stereo();
      chain(sum, clipPre, ws, out);
      const meter = analyser();
      out.connect(meter);

      // Cue (pre- or post-EQ)
      const cuePre = g(0), cuePost = g(1), cue = g(0);
      trim.connect(cuePre).connect(cue);
      out.connect(cuePost).connect(cue);
      cue.connect(this.cueBus);

      // Fader, sends, crossfader, filter assign
      const fader = g(0);
      out.connect(fader);
      let snd1Pre: GainNode | undefined, snd1Post: GainNode | undefined, snd1: GainNode | undefined, snd2: GainNode | undefined;
      if (!aux) {
        snd1Pre = g(0); snd1Post = g(1); snd1 = g(0); snd2 = g(0);
        out.connect(snd1Pre).connect(snd1);
        fader.connect(snd1Post).connect(snd1);
        snd1.connect(this.send1);
        fader.connect(snd2).connect(this.send2);
      }
      const xf = g(1);
      fader.connect(xf);
      const toDirect = g(1), toF1 = g(0), toF2 = g(0);
      xf.connect(toDirect).connect(this.mix);
      xf.connect(toF1).connect(this.filters[0].input);
      xf.connect(toF2).connect(this.filters[1].input);

      this.strips[id] = { id, deckIn, fileIn, selDeck, selFile, selRtn, trim, lo, hi, peaks, out, meter, cuePre, cuePost, cue, fader, snd1Pre, snd1Post, snd1, snd2, xf, toDirect, toF1, toF2 };
    });

    // --- LR MIX meters (pre-MASTER, as on the hardware) -------------------------------
    const split = ctx.createChannelSplitter(2);
    this.mix.connect(split);
    this.meterL = analyser();
    this.meterR = analyser();
    split.connect(this.meterL, 0);
    split.connect(this.meterR, 1);
    this.meterCue = analyser();
    this.cueBus.connect(this.meterCue);

    // --- Master -----------------------------------------------------------------------
    this.masterGain = g(1);
    const mClipPre = g(0.5);
    const mClip = ctx.createWaveShaper();
    mClip.curve = clipCurve;
    mClip.oversample = '2x';
    const masterOut = stereo();
    chain(this.mix, this.masterGain, mClipPre, mClip, masterOut);

    // --- Booth --------------------------------------------------------------------------
    this.boothGain = g(1);
    this.boothStereo = g(1);
    this.boothMono = g(0);
    this.boothMono.channelCount = 1;
    this.boothMono.channelCountMode = 'explicit';
    const boothOut = stereo();
    this.mix.connect(this.boothGain);
    this.boothGain.connect(this.boothStereo).connect(boothOut);
    this.boothGain.connect(this.boothMono).connect(boothOut);

    // --- Headphones: CUE/MST blend or SPLIT (cue left, master right) ---------------------
    this.phonesBlendCue = g(1);
    this.phonesBlendMix = g(0);
    this.phonesBlend = g(1);
    this.phonesSplit = g(0);
    this.phonesLevel = g(1);
    const phonesOut = stereo();
    this.cueBus.connect(this.phonesBlendCue).connect(this.phonesBlend);
    this.mix.connect(this.phonesBlendMix).connect(this.phonesBlend);
    this.phonesBlend.connect(this.phonesLevel);
    const mono = (src: AudioNode) => { const m = g(1); m.channelCount = 1; m.channelCountMode = 'explicit'; src.connect(m); return m; };
    const merger = ctx.createChannelMerger(2);
    mono(this.cueBus).connect(merger, 0, 0);
    mono(this.mix).connect(merger, 0, 1);
    merger.connect(this.phonesSplit).connect(this.phonesLevel);
    this.phonesLevel.connect(phonesOut);

    // --- YOU HEAR (twin): which output reaches the speakers -------------------------
    const outScale = g(OUT_SCALE);
    [masterOut, boothOut, phonesOut].forEach((o, i) => {
      const m = g(i === 0 ? 1 : 0);
      o.connect(m).connect(outScale);
      this.mon.push(m);
    });
    outScale.connect(this.out);

    // --- Clock: 16th-note ticks drive every deck -------------------------------------------
    this.clock = new Clock(ctx, (time, tick) => this.onTick(time, tick), this.dur16());
    this.meterTimer = setInterval(() => this.readMeters(), METER_MS);

    this.onDispose(() => {
      this.clock.stop();
      if (this.meterTimer) clearInterval(this.meterTimer);
      this.stopPlayers();
      Object.values(this.strips).forEach(s => s.deckIn.disconnect());
    });

    this.emit({ playing: false, bar: 0, beat: 0, files: {}, meters: {} });
    // Files chosen before audio was unlocked
    this.pendingFiles.forEach((f, ch) => void this.loadFile(ch, f));
    this.pendingFiles.clear();
  }

  // --------------------------------------------------------------------------
  // Transport and decks
  // --------------------------------------------------------------------------

  private dur16(): number {
    return 60 / this.num('bpm', 124) / 4;
  }

  private onTick(time: number, tick: number) {
    if (tick === 0) {
      this.t0 = time;
      this.startPlayers(time);
    }
    const d = this.dur16();
    CHANNELS.forEach(id => {
      if (!this.deckSelected(id)) return;
      const src = this.num(`ch${id}_src`, SRC.NONE);
      if (src === SRC.NONE) return;
      playStep(this.voices, src, this.strips[id].deckIn, time, tick, d);
    });
    if (tick % 4 === 0) {
      const bar = Math.floor(tick / 16) % ARRANGEMENT_BARS;
      this.emitAt(time, { bar: bar + 1, beat: (tick / 4) % 4 + 1 });
    }
  }

  private deckSelected(id: ChannelId): boolean {
    const i = this.num(`ch${id}_input`, 2);
    return i === 1 || (i === 2 && !isAux(id));
  }

  private setPlaying(on: boolean) {
    if (on === this.playing) return;
    this.playing = on;
    if (on) {
      this.clock.setInterval(this.dur16());
      this.clock.start();
    } else {
      this.clock.stop();
      this.stopPlayers();
      this.emit({ bar: 0, beat: 0 });
    }
    this.emit({ playing: on });
  }

  private startPlayers(time: number) {
    CHANNELS.forEach(id => this.startPlayer(id, time));
  }

  private startPlayer(id: ChannelId, time: number) {
    const s = this.strips[id];
    if (!s.buffer) return;
    if (s.player) { try { s.player.stop(); } catch { /* */ } s.player.disconnect(); }
    const p = this.ctx.createBufferSource();
    p.buffer = s.buffer;
    p.loop = true;
    p.connect(s.fileIn);
    p.start(Math.max(time, this.ctx.currentTime));
    s.player = p;
  }

  private stopPlayers() {
    Object.values(this.strips).forEach(s => {
      if (!s.player) return;
      try { s.player.stop(); } catch { /* */ }
      s.player.disconnect();
      s.player = undefined;
    });
  }

  private async loadFile(id: ChannelId, file: File) {
    this.files = { ...this.files, [id]: `Decoding ${file.name}…` };
    this.emit({ files: this.files });
    try {
      const data = await file.arrayBuffer();
      const buffer = await this.ctx.decodeAudioData(data);
      if (!this.started) return;
      this.strips[id].buffer = buffer;
      this.files = { ...this.files, [id]: file.name };
      if (this.playing) {
        // Drop it in on the next bar line of the master clock
        const bar = this.dur16() * 16;
        const k = Math.ceil((this.ctx.currentTime + 0.05 - this.t0) / bar);
        this.startPlayer(id, this.t0 + k * bar);
      }
    } catch (e) {
      console.warn('[xone96] could not decode', file.name, e);
      this.files = { ...this.files, [id]: `Can't decode ${file.name}` };
    }
    this.emit({ files: this.files });
  }

  event(name: string, payload?: unknown): void {
    const m = /^load:(a|b|[1-4])$/.exec(name);
    if (!m || !(payload instanceof Blob)) return;
    const id = m[1] as ChannelId;
    const file = payload as File;
    if (!this.started) {
      this.pendingFiles.set(id, file);
      return;
    }
    void this.loadFile(id, file);
  }

  // --------------------------------------------------------------------------
  // Meters (UI only - sampled every 50 ms, LED states emitted when they change)
  // --------------------------------------------------------------------------

  private peak(a: AnalyserNode): number {
    a.getFloatTimeDomainData(this.buf);
    let p = 0;
    for (let i = 0; i < this.buf.length; i++) {
      const v = Math.abs(this.buf[i]);
      if (v > p) p = v;
    }
    return p;
  }

  private readMeters() {
    if (!this.started) return;
    const raw: Record<string, number> = {};
    CHANNELS.forEach(id => (raw[id] = this.peak(this.strips[id].meter)));
    const cue = this.peak(this.meterCue);
    raw.L = this.bool('split_cue') ? cue : this.peak(this.meterL);
    raw.R = this.peak(this.meterR);
    raw.cue = cue;
    const meters: Record<string, number> = {};
    let sig = '';
    Object.entries(raw).forEach(([k, v]) => {
      // Fast attack, ~10 dB/100 ms release like an LED peak meter
      const held = Math.max(v, (this.held[k] ?? 0) * 0.56);
      this.held[k] = held;
      meters[k] = held;
      // Only re-render the panel when a lit LED changes
      const db = held > 1e-6 ? 20 * Math.log10(held / REF) : -99;
      const steps = k === 'L' || k === 'R' ? MASTER_METER_DBU : CH_METER_DBU;
      sig += steps.filter(s => db >= s).length + ',';
    });
    if (sig !== this.lastSig) {
      this.lastSig = sig;
      this.emit({ meters });
    }
  }

  // --------------------------------------------------------------------------
  // Controls
  // --------------------------------------------------------------------------

  private faderCurve(): Fader {
    return CURVE_KEYS[this.num('fader_curve', 0)] ?? 'const';
  }

  private updateFader(id: ChannelId) {
    const curve = isAux(id) ? 'const' : this.faderCurve();
    smooth(this.strips[id].fader.gain, faderLaw(this.num(`ch${id}_fader`, 0) / 10, curve), this.ctx, 0.006);
  }

  private updateXfader() {
    const curve = CURVE_KEYS[this.num('xf_curve', 0)] ?? 'const';
    const [gx, gy] = xfaderLaw(this.num('xfader', 5) / 10, curve);
    CHANNELS.forEach(id => {
      const a = this.num(`ch${id}_xf`, 1);
      smooth(this.strips[id].xf.gain, a === 0 ? gx : a === 2 ? gy : 1, this.ctx, 0.003);
    });
  }

  private updateInput(id: ChannelId) {
    const s = this.strips[id];
    const i = this.num(`ch${id}_input`, 2);
    const file = i === 0 || i === 3;
    smooth(s.selFile.gain, file ? 1 : 0, this.ctx, 0.005);
    smooth(s.selDeck.gain, this.deckSelected(id) ? 1 : 0, this.ctx, 0.005);
    if (s.selRtn) smooth(s.selRtn.gain, i === 2 ? 1 : 0, this.ctx, 0.005);
  }

  private updateFilterAssign(id: ChannelId) {
    const s = this.strips[id];
    const a = this.num(`ch${id}_filter`, 1);
    smooth(s.toF1.gain, a === 0 ? 1 : 0, this.ctx, 0.005);
    smooth(s.toDirect.gain, a === 1 ? 1 : 0, this.ctx, 0.005);
    smooth(s.toF2.gain, a === 2 ? 1 : 0, this.ctx, 0.005);
  }

  private updateFilter(f: 0 | 1) {
    const p = `f${f + 1}_`;
    const sec = this.filters[f];
    const type = this.num(`${p}type`, f === 0 ? 0 : 2);
    const res = this.num(`${p}res`, 2) / 10;
    const freq = this.num(`${p}freq`, f === 0 ? 20 : 20000);
    const b = sec.biquad;
    const t: BiquadFilterType = type === 0 ? 'highpass' : type === 1 ? 'bandpass' : 'lowpass';
    if (b.type !== t) b.type = t;
    // LP/HP Q is the resonant peak in dB (Butterworth = -3 dB); BP Q is linear bandwidth
    const q = t === 'bandpass' ? 0.6 + res * 9 : -3 + res * 21;
    smooth(b.Q, q, this.ctx, 0.02);
    smooth(b.frequency, freq, this.ctx, 0.015);
    // Keep perceived loudness roughly level: a band-pass throws most of the spectrum away
    smooth(sec.makeup.gain, t === 'bandpass' ? 1.6 + res * 0.6 : 1 / (1 + res * 0.5), this.ctx, 0.02);
  }

  private updateCrunch(f: 0 | 1) {
    const c = this.num(`f${f + 1}_crunch`, 0);
    const sec = this.filters[f];
    const d = 1 + c * 3;                       // drive into tanh
    const mix = Math.min(1, c / 2.5);
    smooth(sec.wetPre.gain, d / 4, this.ctx);  // curve domain is +-4
    smooth(sec.wetPost.gain, 1 / Math.min(d, 4), this.ctx);
    smooth(sec.wet.gain, mix, this.ctx);
    smooth(sec.dry.gain, 1 - mix, this.ctx);
  }

  private updateCue() {
    const post = this.bool('cue_post_eq');
    CHANNELS.forEach(id => {
      const s = this.strips[id];
      smooth(s.cue.gain, this.bool(`ch${id}_cue`) ? 1 : 0, this.ctx, 0.005);
      smooth(s.cuePre.gain, post ? 0 : 1, this.ctx, 0.005);
      smooth(s.cuePost.gain, post ? 1 : 0, this.ctx, 0.005);
    });
  }

  private updatePhones() {
    const split = this.bool('split_cue');
    const m = this.num('cue_mix', 0) / 10;
    smooth(this.phonesBlendCue.gain, Math.cos((m * Math.PI) / 2), this.ctx);
    smooth(this.phonesBlendMix.gain, Math.sin((m * Math.PI) / 2), this.ctx);
    smooth(this.phonesBlend.gain, split ? 0 : 1, this.ctx, 0.005);
    smooth(this.phonesSplit.gain, split ? 1 : 0, this.ctx, 0.005);
    smooth(this.phonesLevel.gain, knobLaw(this.num('phones', 6)), this.ctx);
  }

  private updateSend1Mode() {
    const pre = this.num('send1_pre', 0) === 1;
    CHANNELS.forEach(id => {
      const s = this.strips[id];
      if (!s.snd1Pre || !s.snd1Post) return;
      smooth(s.snd1Pre.gain, pre ? 1 : 0, this.ctx, 0.005);
      smooth(s.snd1Post.gain, pre ? 0 : 1, this.ctx, 0.005);
    });
  }

  private updateDelayTime() {
    const beats = [0.5, 0.75, 1][this.num('fx_time', 1)] ?? 0.75;
    smooth(this.delay.delay.delayTime, (60 / this.num('bpm', 124)) * beats, this.ctx, 0.05);
  }

  protected onParam(id: string, value: ControlValue): void {
    const n = typeof value === 'number' ? value : value ? 1 : 0;
    const ctx = this.ctx;
    const m = /^ch(a|b|[1-4])_(\w+)$/.exec(id);
    if (m) {
      const ch = m[1] as ChannelId;
      const s = this.strips[ch];
      switch (m[2]) {
        case 'input': this.updateInput(ch); break;
        case 'gain': { const db = gainDb(n); smooth(s.trim.gain, db === -Infinity ? 0 : Math.pow(10, db / 20), ctx); break; }
        case 'hi': smooth(s.hi.gain, killBandGain(n), ctx); break;
        case 'lo': smooth(s.lo.gain, killBandGain(n), ctx); break;
        case 'lomid': smooth(s.peaks[0].gain, midBandDb(n, -27), ctx); break;
        case 'himid': smooth(s.peaks[1].gain, midBandDb(n, -27), ctx); break;
        case 'mid': smooth(s.peaks[0].gain, midBandDb(n, -24), ctx); break;
        case 'midf': smooth(s.peaks[0].frequency, n, ctx); break;
        case 'snd1': if (s.snd1) smooth(s.snd1.gain, Math.pow(n / 10, 2), ctx); break;
        case 'snd2': if (s.snd2) smooth(s.snd2.gain, Math.pow(n / 10, 2), ctx); break;
        case 'fader': this.updateFader(ch); break;
        case 'xf': this.updateXfader(); break;
        case 'filter': this.updateFilterAssign(ch); break;
        case 'cue': this.updateCue(); break;
        case 'src': smooth(s.deckIn.gain, Math.pow(10, (SOURCE_TRIM_DB[n] ?? 0) / 20), ctx); break; // source read on every tick
      }
      return;
    }
    switch (id) {
      case 'f1_type': case 'f1_freq': case 'f1_res': this.updateFilter(0); break;
      case 'f2_type': case 'f2_freq': case 'f2_res': this.updateFilter(1); break;
      case 'f1_crunch': this.updateCrunch(0); break;
      case 'f2_crunch': this.updateCrunch(1); break;
      case 'xfader': case 'xf_curve': this.updateXfader(); break;
      case 'fader_curve': CHANNELS.forEach(c => this.updateFader(c)); break;
      case 'master': smooth(this.masterGain.gain, knobLaw(n), ctx); break;
      case 'booth': smooth(this.boothGain.gain, knobLaw(n), ctx); break;
      case 'booth_mono':
        smooth(this.boothStereo.gain, n ? 0 : 1, ctx, 0.005);
        smooth(this.boothMono.gain, n ? 1 : 0, ctx, 0.005);
        break;
      case 'cue_mix': case 'phones': case 'split_cue': this.updatePhones(); break;
      case 'cue_post_eq': this.updateCue(); break;
      case 'send1_pre': this.updateSend1Mode(); break;
      case 'monitor_out': this.mon.forEach((g, i) => smooth(g.gain, i === n ? 1 : 0, ctx, 0.01)); break;
      case 'play': this.setPlaying(!!value); break;
      case 'bpm': this.clock.setInterval(this.dur16()); this.updateDelayTime(); break;
      case 'fx_time': this.updateDelayTime(); break;
      case 'fx_fdbk': smooth(this.delay.feedback.gain, (n / 10) * 0.85, ctx); break;
      case 'fx_size': this.reverb.setSize(n); break;
    }
  }
}
