// ============================================================================
// Moog Sub 37 / Subsequent 37 audio engine (REFERENCE.md has every source; page
// numbers are the Subsequent 37 manual's). The signal flow is the block diagram
// on p.11:
//
//   sub37-ctl (envelopes, LFOs, glide, MOD 1/2, morph weights, smoothing)
//      │ 19 control channels, sample-accurate
//      ▼
//   OSC 1 (Vco + sub tap) ─┬─ tri/saw/pulse x weights ─┐
//   OSC 2 (Vco, hard sync) ┴─ tri/saw/pulse x weights ─┤
//   SUB OSC (OSC 1 / 2) ───────────────────────────────┤──► sub37-mix ──► LADDER (2x) ──► MULTIDRIVE ──► VCA ──► PRESET VOL ──► VOLUME ─┬─► MUTE ──► AUDIO OUT
//   PINK NOISE ────────────────────────────────────────┘   (FDBK loop       6/12/18/24      (OTA / FET       ▲                           └─► HEADPHONES ──► PHONES
//                                                            or EXT IN)      dB slopes       stages, 2x)    AMP EG
//
// Paraphonic voicing on the main thread: mono with LAST / LOW / HIGH priority, or
// DUO MODE (OSC 1 lowest key, OSC 2 highest with KB CTRL HI; swapped with LO; OSC 2
// drones with OFF). Single trigger for legato playing unless MULTI TRIG; RESET starts
// the attack from zero. The arpeggiator / sequencer runs on the studio transport like
// MIDI clock while ARP SYNC is lit (silent until the clock runs, p.15), else on the
// internal clock at RATE; LFO and envelope SYNC follow the same clock (p.46).
//
// Shared-core nodes: 2 vco, 1 ladder (quality 1). Device nodes: sub37-ctl, sub37-mix.
// ============================================================================

import type { ControlValue } from '@/types';
import { BaseEngine, Clock } from '@/lib/audio/engine';
import type { Transport, TransportTick } from '@/lib/audio/transport';
import { Ladder, Vco } from '@/lib/audio/dsp';
import { describeValue } from '@/lib/controls/mapping';
import { Arp, isSeqPattern, seqNextStep, seqStepFrom } from './arp';
import {
  C4_HZ, DEST_PGM, DIVISIONS, F_RATCHET, F_REST, F_TIE, LADDER_DRIVE, LADDER_MAKEUP, MD_CURVE_RANGE, MIDDLE_C, PATTERN_REC,
  PGM_ARP_RATE, SLOPE_MODES, SOURCE_PGM,
  charFlags, charNote, ctlSettings, firstSeqNote, lfoHz, mdPostGain, multidriveCurve, phonesGain, volumeGain,
} from './model';
import { SUB37 } from './spec';

const NCH = 19;
/** Each knob's LCD section prefix */
const SECTION: [RegExp, string][] = [
  [/^mod1_/, 'MOD 1'], [/^mod2_/, 'MOD 2'], [/^osc1_/, 'OSC 1'], [/^osc2_|^beat_freq|^kb_ctrl/, 'OSC 2'],
  [/^hard_sync|^kb_reset|^duo_mode/, 'OSC'], [/^mix_/, 'MIXER'], [/^feg_/, 'FILTER EG'], [/^aeg_/, 'AMP EG'],
  [/^glide_/, 'GLIDE'], [/^arp_|^seq_/, 'ARP'], [/^cutoff|^resonance|^multidrive|^filter_/, 'FILTER'],
  [/^master_volume|^output_mute|^phones|^preset_volume/, 'OUTPUT'], [/^bend_|^key_priority|^kb_transpose/, 'PRESET EDIT'],
];
const SILENT_LCD = new Set(['preset_number', 'preset_bank', 'pitch_bend', 'mod_wheel', 'arp_seq', 'arp_seq2', 'arp_seq_flags', 'knob_shift']);

type CtlEvent = Record<string, unknown> & { t: string; time: number };

export class Sub37Engine extends BaseEngine {
  private ctl!: AudioWorkletNode;
  private mix!: AudioWorkletNode;
  private osc1!: Vco;
  private osc2!: Vco;
  private syncGain!: GainNode;
  private ladder!: Ladder;
  private mdPost!: GainNode;
  private presetVol!: GainNode;
  private volume!: GainNode;
  private mute!: GainNode;
  private phones!: GainNode;
  private noise!: AudioBufferSourceNode;
  private clock!: Clock;
  private sent: Record<string, number> = {};
  private extPatched = false;
  private volPatched = false;
  private gateByEvents = false;
  private extGateId = 0;
  private keyCount = 0;
  private readonly keySid = Math.random().toString(36).slice(2);
  private auditioning = false;
  /** The audition plays on the player's own running arpeggio / sequence (and leaves it running) */
  private audKeep = false;
  private audNotes = new Set<number>();
  private audGen = 0;

  // ---- keys and voices -------------------------------------------------------
  /** Physical keys held, raw MIDI notes, in the order pressed */
  private held: number[] = [];
  private velocity = 1;
  private arp = new Arp();
  // ---- arpeggiator / sequencer ---------------------------------------------------
  private stepCount = 0;          // steps played since the arp started
  private seqIndex = -1;          // next sequencer step (-1 = the FIRST STEP)
  /** Keys that transpose the sequence (played notes, low to high); kept while LATCH holds it */
  private seqKeys: number[] = [];
  private seqTieOpen = false;     // the last step tied into the next one
  private arpGateUntil = 0;       // audio time the current arp gate ends
  private arpGateOpen = false;
  private internalRunning = false;
  private paused = false;         // stopped by the studio's ■ (latched notes kept)
  private unsubTick: (() => void) | null = null;
  private unsubEvent: (() => void) | null = null;
  private burst = 0;

  protected build(): void {
    const ctx = this.ctx;
    const g = (v = 1) => { const n = ctx.createGain(); n.gain.value = v; return n; };

    // --- control processor and its 19 channels ------------------------------------
    this.ctl = new AudioWorkletNode(ctx, 'sub37-ctl', {
      numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [NCH],
      channelCount: 4, channelCountMode: 'explicit', channelInterpretation: 'discrete',
    });
    const split = ctx.createChannelSplitter(NCH);
    this.ctl.connect(split);
    const cvMerge = ctx.createChannelMerger(4);
    cvMerge.connect(this.ctl);
    const cvIn = [g(), g(), g(), g()];
    cvIn.forEach((n, i) => n.connect(cvMerge, 0, i));

    // --- oscillators: the shared band-limited VCO, drift and tolerance ------------------
    this.osc1 = new Vco(ctx, C4_HZ, { subs: true, drift: 1.5, driftRate: 0.2, tolerance: 0 });
    this.osc2 = new Vco(ctx, C4_HZ, { drift: 1.5, driftRate: 0.23, tolerance: 2 });
    this.osc1.useOutputs('tri', 'saw', 'pulse', 'sine', 'sub1');
    this.osc2.useOutputs('tri', 'saw', 'pulse');
    for (const o of [this.osc1, this.osc2]) {
      o.pitch.value = 0;
      o.pw.value = 0.02;
      o.tri.gain.value = 0;
      o.saw.gain.value = 0;
      o.pulse.gain.value = 0;
    }
    split.connect(this.osc1.pitch, 0);
    split.connect(this.osc2.pitch, 1);
    split.connect(this.osc1.tri.gain, 4);
    split.connect(this.osc1.saw.gain, 5);
    split.connect(this.osc1.pulse.gain, 6);
    split.connect(this.osc1.pw, 7);
    split.connect(this.osc2.tri.gain, 8);
    split.connect(this.osc2.saw.gain, 9);
    split.connect(this.osc2.pulse.gain, 10);
    split.connect(this.osc2.pw, 11);
    // BEAT FREQ (p.26): a constant offset in Hz, so the beating is the same on every key
    this.osc2.fm.value = 0;
    split.connect(this.osc2.fm, 18);
    const sub = this.osc1.sub1!;
    sub.gain.value = 0;
    split.connect(sub.gain, 12);
    // HARD SYNC: OSC 2 restarts at OSC 1's rising zero crossing; KB RESET: a -2/+2 pulse
    // from the control processor restarts both on every new note (p.26)
    this.syncGain = g(0);
    this.osc1.sine.connect(this.syncGain).connect(this.osc2.syncInput);
    split.connect(this.osc1.syncInput, 17, 0);
    split.connect(this.osc2.syncInput, 17, 0);

    // --- noise: pink, as on the hardware (p.27) --------------------------------------------
    this.noise = ctx.createBufferSource();
    this.noise.buffer = pinkNoise(ctx);
    this.noise.loop = true;
    this.noise.start(0, Math.random() * 2);
    const noiseGain = g(0);
    this.noise.connect(noiseGain);
    split.connect(noiseGain.gain, 13);

    // --- mixer bus with FDBK / EXT IN -----------------------------------------------------
    const bus = g(1);
    [this.osc1.tri, this.osc1.saw, this.osc1.pulse, sub, this.osc2.tri, this.osc2.saw, this.osc2.pulse, noiseGain]
      .forEach(n => n.connect(bus));
    this.mix = new AudioWorkletNode(ctx, 'sub37-mix', {
      numberOfInputs: 3, numberOfOutputs: 1, outputChannelCount: [1],
      channelCount: 1, channelCountMode: 'explicit', channelInterpretation: 'speakers',
    });
    bus.connect(this.mix, 0, 0);
    split.connect(this.mix, 16, 1);
    const extIn = g(1);
    extIn.connect(this.mix, 0, 2);

    // --- the ladder, 2x oversampled transistor core ----------------------------------------------
    this.ladder = new Ladder(ctx, 1000, { quality: 1, comp: 0.2 });
    this.ladder.cutoff.value = 1000;
    this.ladder.resonance.value = 0;
    this.ladder.drive.value = LADDER_DRIVE;
    split.connect(this.ladder.cutoffCv, 2);
    split.connect(this.ladder.resonance, 14);
    this.mix.connect(this.ladder.input);

    // --- MULTIDRIVE (OTA / FET stages after the filter, p.28), DC blocker, VCA, outputs -----------
    const makeup = g(LADDER_MAKEUP / MD_CURVE_RANGE);
    const mdPre = g(0);
    split.connect(mdPre.gain, 15);
    const shaper = ctx.createWaveShaper();
    shaper.curve = multidriveCurve();
    shaper.oversample = '2x';
    this.mdPost = g(1);
    const dc = ctx.createBiquadFilter();
    dc.type = 'highpass';
    dc.frequency.value = 12;
    dc.Q.value = -3.01; // Butterworth (Q in dB for highpass)
    const vca = g(0);
    split.connect(vca.gain, 3);
    this.ladder.output.connect(makeup).connect(mdPre).connect(shaper).connect(this.mdPost).connect(dc).connect(vca);
    // OUTPUT (p.34): PRESET VOL and VOLUME feed both jacks; MUTE silences AUDIO OUT only;
    // HEADPHONES balances against VOLUME
    this.presetVol = g(1);
    this.volume = g(volumeGain(70));
    this.mute = g(1);
    this.phones = g(1);
    vca.connect(this.presetVol).connect(this.volume);
    this.volume.connect(this.mute).connect(this.out);
    this.volume.connect(this.phones);

    // --- patch points (left side panel, p.8) ------------------------------------------------------
    this.outputs = {
      out_audio: { node: this.mute },
      out_phones: { node: this.phones },
    };
    this.inputs = {
      in_ext: {
        node: extIn,
        onConnect: () => { this.extPatched = true; this.mix.port.postMessage({ t: 'ext', v: 1 }); this.pushSettings(); },
        onDisconnect: () => { this.extPatched = false; this.mix.port.postMessage({ t: 'ext', v: 0 }); this.pushSettings(); },
      },
      in_pitch: { node: cvIn[0] },
      in_filter: { node: cvIn[1] },
      in_volume: {
        node: cvIn[2],
        // VOLUME CV: 0-5 V opens the VCA while a cable is in (normalled to full)
        onConnect: () => { this.volPatched = true; this.pushSettings(); },
        onDisconnect: () => { this.volPatched = false; this.pushSettings(); },
      },
      in_gate: {
        node: cvIn[3],
        onEvent: (time, value) => this.externalGate(time, value),
        onDisconnect: () => { this.gateByEvents = false; this.pushSettings(); },
      },
    };

    // --- internal 24 PPQN clock: the arpeggiator / sequencer at RATE, LFO and envelope SYNC -------
    this.clock = new Clock(ctx, (time, tick) => this.onInternalTick(time, tick), 0.02);

    this.onDispose(() => {
      this.clock.stop();
      this.unsubTick?.();
      this.unsubEvent?.();
      try { this.noise.stop(); } catch { /* already stopped */ }
      this.ctl.port.postMessage({ t: 'clear' });
      [this.ctl, this.mix, this.osc1.node, this.osc2.node, this.ladder.node].forEach(n => { try { n.disconnect(); } catch { /* */ } });
    });

    this.emit({ arpStep: -1, seqStep: -1, gate: false, lcd: null, keyNote: null, clockWait: false });
  }

  // ==========================================================================
  // Settings
  // ==========================================================================

  private postAt(m: CtlEvent) {
    this.ctl.port.postMessage(m);
  }

  /**
   * MIDI-clock mode: with ARP SYNC lit only the studio clock (MIDI clock) runs the arpeggiator (p.15).
   * A lesson / QA audition with the studio stopped runs it on the internal clock at the studio tempo,
   * so a synced pattern can be heard without pressing ▶.
   */
  private onStudioClock(): boolean {
    return this.bool('arp_sync') && !(this.auditioning && !this.transport?.playing);
  }

  /** Tempo the arpeggiator, LFO SYNC and envelope SYNC follow (p.46) */
  private clockBpm(): number {
    if (this.bool('arp_sync') && this.transport) return this.transport.bpm;
    return Math.max(2, Math.min(280, this.num('arp_rate', 120) * this.arpRateMod()));
  }

  /**
   * PGM DST ARP RATE (p.51) on the internal clock: the clock follows the static sources (CONST ON,
   * VELOCITY, KB TRACK) times the bus's CONTROLLERS depth, +-2 octaves of tempo at full MOD AMT.
   */
  private arpRateMod(): number {
    let oct = 0;
    for (const n of [1, 2] as const) {
      if (Math.round(this.num(`mod${n}_dest`, 1)) !== DEST_PGM || Math.round(this.num(`mod${n}_pgm_dst`, 0)) !== PGM_ARP_RATE) continue;
      if (Math.round(this.num(`mod${n}_source`, 0)) !== SOURCE_PGM) continue;
      const ps = Math.round(this.num(`mod${n}_pgm_src`, 0));
      const src = ps === 2 ? 1 : ps === 12 ? this.velocity : ps === 11 ? Math.max(-1, Math.min(1, ((this.held.length ? this.played(this.held[this.held.length - 1]) : MIDDLE_C) - MIDDLE_C) / 24)) : 0;
      const wh = this.num(`mod${n}_wheel`, n === 1 ? 100 : 0) / 100, ve = this.num(`mod${n}_vel`, 0) / 100;
      const depth = wh === 0 && ve === 0 ? 1 : Math.max(-1, Math.min(1, wh * this.num('mod_wheel', 0) / 100 + ve * this.velocity));
      oct += src * depth * (this.num(`mod${n}_mod_amt`, 0) / 100) * 2;
    }
    return Math.pow(2, oct);
  }

  private lfoRate(n: 1 | 2): number {
    if (this.bool(`mod${n}_sync`)) {
      const div = DIVISIONS[Math.round(this.num(`mod${n}_div`, 10))] ?? DIVISIONS[10];
      return (this.clockBpm() / 60) * (24 / div.ticks);
    }
    return lfoHz(this.params, n);
  }

  private pushSettings() {
    if (!this.started) return;
    const s = ctlSettings(this.params, { lfoHz: [this.lfoRate(1), this.lfoRate(2)], extPatched: this.extPatched });
    s.volPatched = this.volPatched ? 1 : 0;
    s.gIgn = this.gateByEvents ? 1 : 0;
    const diff: Record<string, number> = {};
    let any = false;
    for (const k in s) {
      if (this.sent[k] !== s[k]) { diff[k] = s[k]; this.sent[k] = s[k]; any = true; }
    }
    if (any) this.ctl.port.postMessage({ t: 'set', s: diff });
  }

  setParam(id: string, value: ControlValue): void {
    const prev = this.params[id];
    super.setParam(id, value);
    if (!this.started || prev === undefined || prev === value) return;
    const spec = SUB37.controls[id];
    if (!spec || SILENT_LCD.has(id)) return;
    // A burst of changes in the same task is a preset load: let the LCD show the preset
    if (this.burst++ === 0) queueMicrotask(() => { this.burst = 0; });
    if (this.burst > 3) { this.emit({ lcd: null }); return; }
    const section = SECTION.find(([re]) => re.test(id))?.[1] ?? '';
    this.emit({ lcd: { title: `${section} ${spec.label}`.trim(), value: describeValue(spec, value), id } });
  }

  protected onParam(id: string, value: ControlValue): void {
    const t = this.ctx.currentTime;
    switch (id) {
      case 'hard_sync':
      case 'kb_reset': {
        const hs = this.bool('hard_sync'), kr = this.bool('kb_reset');
        this.syncGain.gain.setTargetAtTime(hs ? 1 : 0, t, 0.002);
        this.osc1.sync.value = kr ? 1 : 0;
        this.osc2.sync.value = hs || kr ? 1 : 0;
        break;
      }
      case 'filter_slope': this.ladder.setMode(SLOPE_MODES[Math.round(Number(value))] ?? 'lp24'); break;
      case 'multidrive': this.mdPost.gain.setTargetAtTime(mdPostGain(Number(value)), t, 0.01); break;
      case 'master_volume': this.volume.gain.setTargetAtTime(volumeGain(Number(value)), t, 0.01); break;
      case 'output_mute': this.mute.gain.setTargetAtTime(value ? 0 : 1, t, 0.005); break;
      case 'phones_volume': this.phones.gain.setTargetAtTime(phonesGain(Number(value)), t, 0.01); break;
      // PRESET VOL (pp.34, 42): OFF leaves the level to the VOLUME knob, else it scales the preset
      case 'preset_volume': { const v = Number(value); this.presetVol.gain.setTargetAtTime(v < 0.5 ? 1 : v / 100, t, 0.01); break; }
      case 'feg_latch': this.postAt({ t: 'latch', env: 0, on: value ? 1 : 0, time: 0 }); break;
      case 'aeg_latch': this.postAt({ t: 'latch', env: 1, on: value ? 1 : 0, time: 0 }); break;
      case 'duo_mode':
      case 'kb_ctrl':
      case 'key_priority':
      case 'kb_octave':
      case 'kb_transpose':
        if (this.held.length && !this.arpActive()) this.voice(t, false, false);
        break;
      case 'arp_on':
        this.onArpSwitch(!!value);
        break;
      case 'arp_latch':
        if (!value) {
          this.arp.unlatch(this.held.map(k => this.played(k)));
          if (!this.held.length) this.seqKeys = [];
          if (this.arpActive() && !this.held.length) this.stopArpSound(t);
        }
        break;
      case 'arp_pattern':
        this.arp.invalidate();
        this.seqIndex = -1;
        this.updateClock();
        break;
      case 'arp_oct_range':
      case 'arp_back_fwd':
      case 'arp_invert':
      case 'arp_end_notes':
        this.arp.invalidate();
        break;
      case 'arp_rate':
      case 'arp_sync':
      case 'arp_div':
      case 'feg_sync':
      case 'aeg_sync':
      case 'mod1_sync':
      case 'mod2_sync':
        this.pushSettings();
        this.updateClock();
        break;
      default:
        break;
    }
    this.pushSettings();
  }

  // ==========================================================================
  // Keys, voice allocation, glide and triggering
  // ==========================================================================

  /** Raw key -> played note (KB OCTAVE, KB TRANSPOSE; p.14) */
  private played(key: number) {
    return key + 12 * Math.round(this.num('kb_octave', 0)) + Math.round(this.num('kb_transpose', 0));
  }

  private pattern() {
    return Math.round(this.num('arp_pattern', 0));
  }

  private arpActive() {
    return this.bool('arp_on') && this.pattern() !== PATTERN_REC;
  }

  noteOn(note: number, velocity = 1): void {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    const wasHeld = this.held.length;
    this.held = this.held.filter(n => n !== note);
    this.held.push(note);
    this.velocity = velocity;
    // the panel writes keys into the sequence while step recording or editing a step (pp.17, 19);
    // a lesson or QA audition's demo phrase is not the learner playing, so it never records
    if (!this.auditioning) this.emit({ keyNote: { sid: this.keySid, n: ++this.keyCount, note: this.played(note), legato: wasHeld > 0 } });
    if (this.arpActive()) {
      const latch = this.bool('arp_latch');
      if (isSeqPattern(this.pattern())) {
        // a fresh press starts from the FIRST STEP, unless LATCH is holding a running sequence and
        // LATCH RSTRT (GLOBAL, p.47) is OFF: then it only transposes
        if (!wasHeld && (!latch || !this.seqKeys.length || this.bool('latch_restart'))) this.seqIndex = -1;
        this.seqKeys = this.seqKeysHeld();
      } else {
        if (latch && wasHeld === 0) this.arp.reset();
        this.arp.keyDown(this.played(note), latch);
      }
      if (this.paused && !(this.transport?.playing)) this.paused = false;
      this.updateClock();
      return;
    }
    this.voice(t, true, wasHeld > 0);
  }

  noteOff(note: number): void {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    if (!this.held.includes(note)) return;
    this.held = this.held.filter(n => n !== note);
    if (this.arpActive()) {
      const latch = this.bool('arp_latch');
      if (!isSeqPattern(this.pattern())) this.arp.keyUp(this.played(note), latch);
      else if (!latch && this.held.length) this.seqKeys = this.seqKeysHeld();
      if (!latch && !this.held.length) {
        this.seqKeys = [];
        this.stopArpSound(t);
      }
      this.updateClock();
      return;
    }
    if (this.held.length) this.voice(t, false, true);
    else {
      this.postAt({ t: 'gate', time: t, on: 0 });
      this.emit({ gate: false });
    }
  }

  /**
   * Keys transposing the sequence: the last key pressed, or in DUO MODE the lowest and the
   * highest held key (single steps then follow both, p.17)
   */
  private seqKeysHeld(): number[] {
    const keys = this.held.map(k => this.played(k));
    if (!keys.length) return [];
    if (!this.bool('duo_mode') || keys.length < 2) return [keys[keys.length - 1]];
    return [Math.min(...keys), Math.max(...keys)];
  }

  /** The two oscillators' notes for the keys held */
  private allocate(): [number, number] | null {
    const keys = this.held.map(k => this.played(k));
    if (!keys.length) return null;
    const pri = Math.round(this.num('key_priority', 0));
    const pick = () => (pri === 1 ? Math.min(...keys) : pri === 2 ? Math.max(...keys) : keys[keys.length - 1]);
    if (this.bool('duo_mode')) {
      const kb = Math.round(this.num('kb_ctrl', 2));
      if (kb === 0) { const n = pick(); return [n, n]; }      // OSC 2 drones (p.26)
      const lo = Math.min(...keys), hi = Math.max(...keys);
      return kb === 2 ? [lo, hi] : [hi, lo];                     // HI: OSC 2 on the top key
    }
    const n = pick();
    return [n, n];
  }

  /** Two pitches -> [OSC 1, OSC 2] by KB CTRL in DUO MODE */
  private duoPair(a: number, b: number): [number, number] {
    if (!this.bool('duo_mode')) return [a, a];
    const kb = Math.round(this.num('kb_ctrl', 2));
    const lo = Math.min(a, b), hi = Math.max(a, b);
    if (kb === 0) return [a, a];
    return kb === 2 ? [lo, hi] : [hi, lo];
  }

  /**
   * Re-voice after a key change. `press`: a key went down (else up / a switch changed);
   * `legato`: another key was already held.
   */
  private voice(t: number, press: boolean, legato: boolean) {
    const notes = this.allocate();
    if (!notes) return;
    // LEGATO glide (p.21): only when a key goes down while another is held
    const glideOn = this.bool('glide_on') && (!this.bool('glide_legato') || legato);
    const osc = Math.round(this.num('glide_osc', 0));
    const oct = (n: number) => (n - 60) / 12;
    this.postAt({ t: 'pitch', time: t, n1: oct(notes[0]), n2: oct(notes[1]), g1: glideOn && osc !== 2 ? 1 : 0, g2: glideOn && osc !== 1 ? 1 : 0, kb: notes[0] });
    if (!press) return;
    const newPhrase = !legato;
    const tf = newPhrase || this.bool('feg_multi_trig');
    const ta = newPhrase || this.bool('aeg_multi_trig');
    if (tf || ta) {
      if (this.bool('kb_reset')) this.postAt({ t: 'kbr', time: t });
      this.postAt({ t: 'gate', time: t, on: 1, vel: this.velocity, tf: tf ? 1 : 0, ta: ta ? 1 : 0, rf: this.bool('feg_reset') ? 1 : 0, ra: this.bool('aeg_reset') ? 1 : 0, kb: notes[0] });
      this.emit({ gate: true });
    }
    this.updateClock();
  }

  /** KB GATE input events from other instruments' gate / trigger outputs (p.8) */
  private externalGate(time: number, value: number) {
    if (!this.started) return;
    if (!this.gateByEvents) { this.gateByEvents = true; this.pushSettings(); }
    if (value > 0) {
      const id = ++this.extGateId;
      this.postAt({ t: 'gate', src: 'x', time, on: 1, id });
      // a trigger is a short pulse: hold the gate for a 16th unless a gate-off comes first
      this.postAt({ t: 'gate', src: 'x', time: time + Math.max(0.03, 15 / Math.max(20, this.clockBpm())), on: 0, id });
    } else {
      this.postAt({ t: 'gate', src: 'x', time, on: 0, id: this.extGateId });
    }
  }

  // ==========================================================================
  // Arpeggiator / sequencer clock
  // ==========================================================================

  /** Something the arpeggiator could play right now */
  private arpHasNotes() {
    if (!this.arpActive()) return false;
    if (isSeqPattern(this.pattern())) return this.held.length > 0 || (this.bool('arp_latch') && this.seqKeys.length > 0);
    return this.arp.notes.length > 0;
  }

  private envSyncWanted() {
    return (this.bool('feg_sync') || this.bool('aeg_sync')) && this.getState().gate === true;
  }

  /** Start / stop the internal clock to match what needs it; show the MIDI-clock wait on the LCD */
  private updateClock() {
    if (!this.started) return;
    const studio = this.onStudioClock();
    const want = !studio && !this.paused && (this.arpHasNotes() || this.envSyncWanted());
    this.clock.setInterval(60 / this.clockBpm() / 24);
    if (want && !this.internalRunning) {
      this.internalRunning = true;
      this.stepCount = 0;
      if (!isSeqPattern(this.pattern())) this.arp.reset();
      this.clock.start();
    } else if (!want && this.internalRunning) {
      this.internalRunning = false;
      this.clock.stop();
    }
    const wait = studio && this.arpHasNotes() && !this.transport?.playing;
    if (wait !== this.getState().clockWait) this.emit({ clockWait: wait });
  }

  private onInternalTick(time: number, tick: number) {
    const dur = 60 / this.clockBpm() / 24;
    this.clock.setInterval(dur);
    this.onTick(time, tick, dur);
  }

  /** One 24 PPQN tick of the clock in charge (internal, or the studio while ARP SYNC is lit) */
  private onTick(time: number, tick: number, tickDur: number) {
    // envelope SYNC (p.31): restart on each CLOCK DIV while the gate is high
    for (const [p, env] of [['feg', 0], ['aeg', 1]] as const) {
      if (!this.bool(`${p}_sync`)) continue;
      const d = DIVISIONS[Math.round(this.num(`${p}_sync_div`, 10))]?.ticks ?? 24;
      if (tick % d === 0 && tick > 0) this.postAt({ t: 'trig', time, env, rst: this.bool(`${p}_reset`) ? 1 : 0 });
    }
    // LFO SYNC (p.23): the phase locks to the clock on every division
    for (const n of [1, 2] as const) {
      if (!this.bool(`mod${n}_sync`)) continue;
      const d = DIVISIONS[Math.round(this.num(`mod${n}_div`, 10))]?.ticks ?? 24;
      if (tick % d === 0) this.postAt({ t: 'lfo', time, i: n - 1 });
    }
    if (!this.arpActive() || this.paused) return;
    const div = DIVISIONS[Math.round(this.num('arp_div', 16))]?.ticks ?? 6;
    if (tick % div !== 0) return;
    const stepDur = div * tickDur;
    // SWING (PRESET EDIT, p.40): 50 % straight; the off-beat steps move later (above) or earlier
    // (below), by up to a whole step: at 100 % only the on-beats play, at 0 % only the off-beats
    const s = (Math.max(0, Math.min(100, this.num('arp_swing', 50))) - 50) / 50;
    const odd = Math.floor(tick / div) % 2 === 1;
    if (s >= 0) {
      if (!odd) this.arpStep(time, stepDur, s > 0 ? stepDur * (1 + s) : stepDur);
      else if (s < 0.99) this.arpStep(time + s * stepDur, stepDur, stepDur * (1 - s));
    } else if (!odd) {
      // earlier off-beats are scheduled from the on-beat, so they are never in the past
      const off = stepDur * (1 + s);
      if (s > -0.99) this.arpStep(time, stepDur, off);
      this.arpStep(time + off, stepDur, stepDur * (2 - (1 + s)));
    }
  }

  /** Gate length of a step lasting `room` seconds before the next note */
  private gateFor(stepDur: number, room: number): number | null {
    const frac = Math.max(0, Math.min(100, this.num('arp_gate', 50))) / 100;
    if (frac >= 1) return null;                     // 100 %: legato, no gap
    return Math.min(stepDur * frac, Math.max(0.002, room - 0.002));
  }

  private arpStep(t: number, stepDur: number, room: number) {
    const gateFrac = Math.max(0, Math.min(100, this.num('arp_gate', 50))) / 100;
    if (isSeqPattern(this.pattern())) { this.seqStep(t, stepDur, room); return; }
    const o = {
      pattern: this.pattern(), range: Math.round(this.num('arp_oct_range', 3)),
      backFwd: this.bool('arp_back_fwd'), invert: this.bool('arp_invert'), twice: Math.round(this.num('arp_end_notes', 0)) === 1,
    };
    const note = this.arp.next(o);
    if (note === null) return;
    const step = this.stepCount++;
    this.emitAt(t, { arpStep: step % 16 });
    if (gateFrac <= 0) { this.pitchOnly(t, note, note); return; }   // GATE LENGTH OFF: no gate at all
    const len = this.gateFor(stepDur, room);
    this.playStep(t, note, note, len === null ? null : t + len, false, this.arp.first);
  }

  /** One sequencer step (pp.17-20): rests, ties, DUO steps, ratchets; SKIP steps never take time */
  private seqStep(t: number, stepDur: number, room: number) {
    if (!this.held.length && !(this.bool('arp_latch') && this.seqKeys.length)) return;
    const p1 = String(this.params.arp_seq ?? ''), p2 = String(this.params.arp_seq2 ?? ''), flags = String(this.params.arp_seq_flags ?? '');
    const first = Math.round(this.num('seq_first', 1)), last = Math.round(this.num('seq_len', 16));
    const firstPlayable = seqStepFrom(flags, first, last, first - 1);
    const i = this.seqIndex < 0 ? firstPlayable : seqStepFrom(flags, first, last, this.seqIndex);
    if (i < 0) return;
    this.seqIndex = seqNextStep(flags, first, last, i);
    this.stepCount++;
    this.emitAt(t, { seqStep: i, arpStep: i % 16 });
    const f = charFlags(flags[i]);
    const n1 = charNote(p1[i]);
    const tiedIn = this.seqTieOpen;
    this.seqTieOpen = false;
    if (f & F_REST || n1 === null) {
      if (this.arpGateOpen) this.postAt({ t: 'gate', time: t, on: 0 });
      this.arpGateOpen = false;
      this.arpGateUntil = t;
      this.emitAt(t, { gate: false });
      return;
    }
    // transposition (GLOBAL REF NOTE, p.46): FIRST = the key pressed is the first note; MID C = note 48 plays as recorded
    const ref = Math.round(this.num('seq_ref', 0)) === 1 ? MIDDLE_C : firstSeqNote(p1, flags, first - 1, last - 1) ?? MIDDLE_C;
    const keys = this.seqKeys.length ? this.seqKeys : [ref];
    const tLo = keys[0] - ref, tHi = keys[keys.length - 1] - ref;
    const n2 = charNote(p2[i]);
    // DUO steps play both recorded notes; single steps follow two held keys in DUO MODE (p.17)
    const [a, b] = n2 !== null ? this.duoPair(n1 + tLo, n2 + tLo) : keys.length > 1 ? this.duoPair(n1 + tLo, n1 + tHi) : [n1 + tLo, n1 + tLo];
    this.postAt({ t: 'sn', time: t, v: (a - MIDDLE_C) / 24, vel: this.velocity });
    const gateFrac = Math.max(0, Math.min(100, this.num('arp_gate', 50))) / 100;
    if (gateFrac <= 0) { this.pitchOnly(t, a, b); return; }
    const isFirst = i === firstPlayable;
    if (f & F_RATCHET) {
      // RATCHET (p.20): the step repeats RATCHET CNT times inside its own length
      const count = Math.max(1, Math.min(8, Math.round(this.num('seq_ratchet', 2))));
      const sub = stepDur / count;
      for (let r = 0; r < count; r++) {
        const at = t + r * sub;
        this.playStep(at, a, b, at + Math.max(0.002, sub * Math.min(0.95, gateFrac)), r === 0 && tiedIn, isFirst && r === 0);
      }
      return;
    }
    if (f & F_TIE) {
      // TIE: hold into the next step, which changes pitch without retriggering (p.17)
      this.seqTieOpen = true;
      this.playStep(t, a, b, null, tiedIn, isFirst);
      return;
    }
    const len = this.gateFor(stepDur, room);
    this.playStep(t, a, b, len === null ? null : t + len, tiedIn, isFirst);
  }

  private pitchOnly(t: number, a: number, b: number) {
    const oct = (n: number) => (n - 60) / 12;
    this.postAt({ t: 'pitch', time: t, n1: oct(a), n2: oct(b), g1: 0, g2: 0, kb: a });
  }

  /**
   * Gate a note on at t, and off at `offAt` (null = held into the next step). `tied`: legato from
   * the step before (sequencer TIE). `first`: the pattern's first note (STEP 1 RESET, p.40).
   */
  private playStep(t: number, n1: number, n2: number, offAt: number | null, tied: boolean, first: boolean) {
    const legato = tied || (this.arpGateOpen && t < this.arpGateUntil + 1e-6);
    // with LEGATO lit, glide only between tied / overlapping notes (p.17)
    const glideOn = this.bool('glide_on') && (!this.bool('glide_legato') || legato);
    const osc = Math.round(this.num('glide_osc', 0));
    const oct = (n: number) => (n - 60) / 12;
    this.postAt({ t: 'pitch', time: t, n1: oct(n1), n2: oct(n2), g1: glideOn && osc !== 2 ? 1 : 0, g2: glideOn && osc !== 1 ? 1 : 0, kb: n1 });
    const tf = !legato || this.bool('feg_multi_trig');
    const ta = !legato || this.bool('aeg_multi_trig');
    if (tf || ta) {
      // STEP 1 RESET: the KB RESETs (oscillators, LFOs) only on the pattern's first note
      const resets = !this.bool('arp_step1_reset') || first;
      if (resets && this.bool('kb_reset')) this.postAt({ t: 'kbr', time: t });
      this.postAt({ t: 'gate', time: t, on: 1, vel: this.velocity, tf: tf ? 1 : 0, ta: ta ? 1 : 0, rf: this.bool('feg_reset') ? 1 : 0, ra: this.bool('aeg_reset') ? 1 : 0, kb: n1, lr: resets ? 1 : 0 });
    }
    this.arpGateOpen = true;
    this.emitAt(t, { gate: true });
    if (offAt !== null) this.endGate(offAt);
    else this.arpGateUntil = Infinity;
  }

  private endGate(at: number) {
    this.arpGateUntil = at;
    this.postAt({ t: 'gate', time: at, on: 0 });
    this.atTime(at, () => { if (this.arpGateUntil === at) { this.arpGateOpen = false; this.emit({ gate: false }); } });
  }

  private stopArpSound(t: number) {
    this.postAt({ t: 'gate', time: t, on: 0 });
    this.arpGateOpen = false;
    this.arpGateUntil = 0;
    this.seqTieOpen = false;
    this.emit({ gate: false, arpStep: -1, seqStep: -1 });
  }

  private onArpSwitch(on: boolean) {
    const t = this.ctx.currentTime;
    this.arp.clear();
    this.seqIndex = -1;
    this.seqKeys = [];
    this.stepCount = 0;
    this.paused = false;
    if (on) {
      // keys already down join the arpeggio; they stop sounding as plain notes
      this.postAt({ t: 'gate', time: t, on: 0 });
      this.held.forEach(k => this.arp.keyDown(this.played(k), false));
      if (this.held.length) this.seqKeys = this.seqKeysHeld();
    } else {
      this.stopArpSound(t);
      if (this.held.length) this.voice(t, true, false);
    }
    this.updateClock();
  }

  // ==========================================================================
  // Studio transport (MIDI-clock style)
  // ==========================================================================

  protected onTransport(t: Transport | null): void {
    this.unsubTick?.();
    this.unsubEvent?.();
    this.unsubTick = null;
    this.unsubEvent = null;
    if (t) {
      this.unsubTick = t.onTick((tk: TransportTick) => {
        // MIDI clock only reaches the arpeggiator, LFO and envelope SYNC while ARP SYNC is lit (p.46)
        if (this.bool('arp_sync')) this.onTick(tk.time, tk.tick, tk.tickDuration);
      });
      this.unsubEvent = t.onEvent(e => {
        if (e.type === 'start') {
          // MIDI start: from the top, on the downbeat
          this.paused = false;
          this.stepCount = 0;
          this.seqIndex = -1;
          this.seqTieOpen = false;
          this.arp.reset();
          // Studio convenience: a latched, synced sequence with no key yet plays as recorded on ▶
          if (this.arpActive() && isSeqPattern(this.pattern()) && this.bool('arp_latch') && this.bool('arp_sync') && !this.seqKeys.length && !this.held.length) {
            const p1 = String(this.params.arp_seq ?? ''), flags = String(this.params.arp_seq_flags ?? '');
            const ref = Math.round(this.num('seq_ref', 0)) === 1 ? MIDDLE_C : firstSeqNote(p1, flags, Math.round(this.num('seq_first', 1)) - 1, Math.round(this.num('seq_len', 16)) - 1);
            if (ref !== null) this.seqKeys = [ref];
          }
          this.pushSettings();
          this.updateClock();
        } else if (e.type === 'stop') {
          // MIDI stop: the arpeggio / sequence stops; latched notes wait for the next start
          if (this.bool('arp_sync') && this.arpActive()) {
            this.paused = true;
            this.stopArpSound(this.ctx.currentTime);
          }
          this.updateClock();
        } else if (e.type === 'tempo') {
          this.pushSettings();
          this.updateClock();
        }
      });
    }
    this.pushSettings();
    this.updateClock();
  }

  // ==========================================================================
  // Lesson auditions and panel events
  // ==========================================================================

  /**
   * The demo phrase for lessons and the audio QA: the standard phrase (MIDI 36 48 55 60 as 8ths at
   * 120, then 48 held; in DUO MODE 48 + 55, a fifth) for keyboard patches; for an arpeggio a held
   * C major chord; for a sequence its first note held, so it plays as recorded. A latched pattern
   * the player already has running is left running.
   */
  private startAudition() {
    this.stopAudition();
    this.auditioning = true;
    const gen = ++this.audGen;
    const on = (k: number) => { if (gen !== this.audGen) return; this.audNotes.add(k); this.noteOn(k, 1); };
    const off = (k: number) => { if (gen !== this.audGen) return; if (this.audNotes.delete(k)) this.noteOff(k); };
    const at = (sec: number, fn: () => void) => this.atTime(this.ctx.currentTime + sec, fn);
    const shift = 12 * Math.round(this.num('kb_octave', 0)) + Math.round(this.num('kb_transpose', 0));
    // An arpeggio or sequence the player already has running (latched) is the demo: the A/B
    // values play on it, and it keeps running when the audition ends
    this.audKeep = this.arpActive() && this.arpHasNotes();
    if (this.audKeep) { this.updateClock(); return; }
    if (this.arpActive()) {
      if (isSeqPattern(this.pattern())) {
        const first = firstSeqNote(String(this.params.arp_seq ?? ''), String(this.params.arp_seq_flags ?? ''), Math.round(this.num('seq_first', 1)) - 1, Math.round(this.num('seq_len', 16)) - 1);
        on((Math.round(this.num('seq_ref', 0)) === 1 ? MIDDLE_C : first ?? MIDDLE_C) - shift);
      } else {
        [48, 52, 55].forEach(on);
      }
    } else {
      [36, 48, 55, 60].forEach((k, i) => { at(i * 0.5, () => on(k)); at(i * 0.5 + 0.375, () => off(k)); });
      at(2, () => on(48));
      // DUO MODE: the held ending is a fifth, so both oscillators' notes are heard (p.26)
      if (this.bool('duo_mode')) at(2.05, () => on(55));
    }
    this.updateClock();
  }

  private stopAudition() {
    this.audGen++;
    [...this.audNotes].forEach(k => this.noteOff(k));
    this.audNotes.clear();
    if (!this.auditioning) return;
    this.auditioning = false;
    if (this.audKeep) { this.audKeep = false; this.updateClock(); return; }
    if (this.arpActive()) {
      // a latched arpeggio or sequence started by the audition stops with it
      this.arp.clear();
      this.seqKeys = [];
      this.stopArpSound(this.ctx.currentTime);
    }
    this.updateClock();
  }

  event(name: string): void {
    if (!this.started) return;
    if (name === 'audition') { this.startAudition(); return; }
    if (name === 'audition:stop') { this.stopAudition(); return; }
    if (name === 'panic') {
      // both KB OCTAVE buttons held: MIDI panic (p.14)
      this.held = [];
      this.seqKeys = [];
      this.arp.clear();
      this.stopArpSound(this.ctx.currentTime);
      this.updateClock();
    }
  }
}

/** Two and a half seconds of pink noise (Paul Kellet's filter), peak-normalised */
function pinkNoise(ctx: BaseAudioContext): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * 2.5);
  const b = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = b.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  let peak = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    const p = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
    b6 = w * 0.115926;
    d[i] = p;
    peak = Math.max(peak, Math.abs(p));
  }
  const k = 0.9 / (peak || 1);
  for (let i = 0; i < len; i++) d[i] *= k;
  return b;
}
