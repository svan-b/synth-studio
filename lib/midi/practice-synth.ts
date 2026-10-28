// ============================================================================
// Practice synth: a built-in "hardware synth" at the end of a virtual MIDI
// cable. It appears as a MIDI output port everywhere real ports do (Your synth
// Setup, MIDI settings -> Clock out), so the workflow is identical with and
// without gear - and it works on iPad, which has no Web MIDI.
//
//   MIDI in (notes, velocity, CCs, program change, pitch bend, sustain, clock)
//     -> parts on channels 1 (Bass), 2 (Keys) and 10 (Drums) -> its audio out
//   audio out -> direct sound (like a synth's own headphone output), switched
//   off while an Audio input listens to it, exactly as you would turn off
//   direct monitoring when the synth comes back through the studio.
//
// Messages carry Web MIDI timestamps (performance.now() ms). They are mapped
// back to audio time with the same steady mapping the senders used
// (lib/midi/time.ts), so notes and clock land exactly where the studio put
// them. Pure logic lives in practice-core.ts.
// ============================================================================

import { getAudioContext, getMasterBus } from '@/lib/audio/context';
import { getNoiseBuffer } from '@/lib/audio/dsp';
import { useMidiStore } from '@/store/midi';
import { audioClock, outputLatency } from './time';
import { parseMidi } from './bytes';
import { midi, type MidiOutputLike } from './access';
import {
  ArpCore, BASS_PROGRAMS, ClockFollower, DRUM_PROGRAMS, INTERNAL_BPM, KEYS_PROGRAMS, PARTS, PCC,
  PRACTICE_SYNTH_ID, PRACTICE_SYNTH_NAME, ccAttackS, ccCutoffHz, ccDecayS, ccExpressionGain, ccGlideS, ccPan,
  ccReleaseS, ccResonanceDb, ccVibratoCents, ccVibratoRateHz, ccVolumeGain, drumFor, programIndex, velocityGain,
  velocityOctaves, type DrumVoice, type MelodicProgram,
} from './practice-core';

export { PRACTICE_SYNTH_ID, PRACTICE_SYNTH_NAME } from './practice-core';

/** The port as Your synth stores it */
export const PRACTICE_PORT = { id: PRACTICE_SYNTH_ID, name: PRACTICE_SYNTH_NAME };
export const isPracticePort = (p: { id?: string; name?: string } | null | undefined) =>
  !!p && (p.id === PRACTICE_SYNTH_ID || p.name === PRACTICE_SYNTH_NAME);

export interface PracticePartStatus {
  channel: number;
  name: string;
  program: number;
  programName: string;
  arp: boolean;
  /** performance.now() of the last note */
  lastNote: number;
}

export interface PracticeStatus {
  parts: PracticePartStatus[];
  clock: { present: boolean; running: boolean; bpm: number | null };
  /** Audio inputs listening to it (its direct sound is off while > 0) */
  listeners: number;
  /** performance.now() of the last message, and of the last one on a channel nobody listens on */
  lastMessage: number;
  ignored: { channel: number; at: number } | null;
}

const clampHz = (f: number) => Math.max(20, Math.min(18000, f));
const midiHz = (note: number) => 440 * Math.pow(2, (note - 69) / 12);

/** Exponential-approach envelope stages: click-free, retrigger from wherever the level is */
function envOn(p: AudioParam, t: number, peak: number, attack: number, sustain: number, decay: number) {
  p.cancelScheduledValues(t);
  p.setTargetAtTime(peak, t, Math.max(0.0004, attack / 3));
  p.setTargetAtTime(sustain, t + attack, Math.max(0.002, decay / 3));
}
function envOff(p: AudioParam, t: number, to: number, release: number) {
  p.cancelScheduledValues(t);
  p.setTargetAtTime(to, t, Math.max(0.002, release / 3.5));
}

// ----------------------------------------------------------------------------
// Melodic parts
// ----------------------------------------------------------------------------

abstract class MelodicPart {
  readonly input: GainNode;
  protected readonly vol: GainNode;
  protected readonly pan: StereoPannerNode;
  protected readonly vib: OscillatorNode;
  protected readonly vibDepth: GainNode;
  readonly arp = new ArpCore();
  prog: MelodicProgram;
  program = 0;
  /** Current settings in CC units (program values until a CC moves them) */
  cc: Record<number, number> = {};
  bend = 0;
  lastVelocity = 100;
  lastNote = 0;
  protected volume = 100;
  protected expression = 127;
  protected modWheel = 0;
  protected vibDepthCc = 0;

  constructor(protected ctx: AudioContext, dest: AudioNode, protected programs: MelodicProgram[]) {
    this.input = ctx.createGain();
    this.vol = ctx.createGain();
    this.pan = ctx.createStereoPanner();
    this.input.connect(this.vol).connect(this.pan).connect(dest);
    this.vib = ctx.createOscillator();
    this.vib.frequency.value = 5.5;
    this.vibDepth = ctx.createGain();
    this.vibDepth.gain.value = 0;
    this.vib.connect(this.vibDepth);
    this.vib.start();
    this.prog = programs[0];
    this.applyLevel(ctx.currentTime);
    // Subclasses call setProgram(0) at the end of their constructor: their own fields must exist first
  }

  setProgram(program: number, t: number) {
    this.program = Math.max(0, Math.min(127, Math.round(program)));
    this.prog = this.programs[programIndex(this.kind, this.program)];
    // A program change recalls the stored patch: CCs start from it again
    this.cc = {
      [PCC.CUTOFF]: this.prog.cutoff, [PCC.RESONANCE]: this.prog.resonance, [PCC.ATTACK]: this.prog.attack,
      [PCC.DECAY]: this.prog.decay, [PCC.RELEASE]: this.prog.release, [PCC.GLIDE]: this.prog.glide,
    };
    this.onProgram(t);
  }

  abstract get kind(): 'bass' | 'keys';
  protected abstract onProgram(t: number): void;
  protected abstract onTone(t: number): void;
  protected abstract onBend(t: number): void;
  abstract play(note: number, velocity: number, t: number): void;
  abstract release(note: number, t: number): void;
  abstract allOff(t: number, hard: boolean): void;

  protected applyLevel(t: number) {
    this.vol.gain.setTargetAtTime(ccVolumeGain(this.volume) * ccExpressionGain(this.expression), t, 0.01);
  }

  private applyVibrato(t: number) {
    this.vibDepth.gain.setTargetAtTime(Math.min(80, ccVibratoCents(this.modWheel) + ccVibratoCents(this.vibDepthCc)), t, 0.02);
  }

  controlChange(cc: number, v: number, t: number) {
    switch (cc) {
      case PCC.VOLUME: this.volume = v; this.applyLevel(t); break;
      case PCC.EXPRESSION: this.expression = v; this.applyLevel(t); break;
      case PCC.PAN: this.pan.pan.setTargetAtTime(ccPan(v), t, 0.01); break;
      case PCC.MOD_WHEEL: this.modWheel = v; this.applyVibrato(t); break;
      case PCC.VIBRATO_DEPTH: this.vibDepthCc = v; this.applyVibrato(t); break;
      case PCC.VIBRATO_RATE: this.vib.frequency.setTargetAtTime(ccVibratoRateHz(v), t, 0.02); break;
      case PCC.ARP: {
        const on = v >= 64;
        if (on !== this.arp.on) {
          this.arp.on = on;
          this.arp.clear();
          this.allOff(t, false);
        }
        break;
      }
      case PCC.CUTOFF: case PCC.RESONANCE: case PCC.ATTACK: case PCC.DECAY: case PCC.RELEASE: case PCC.GLIDE:
        this.cc[cc] = v;
        this.onTone(t);
        break;
      case PCC.RESET_CONTROLLERS:
        this.modWheel = 0; this.vibDepthCc = 0; this.expression = 127; this.bend = 0;
        this.applyVibrato(t); this.applyLevel(t); this.onBend(t);
        break;
    }
  }

  pitchBend(value: number, t: number) {
    this.bend = value * 200; // +/- 2 semitones
    this.onBend(t);
  }

  /** Note from MIDI: played, or collected by the arpeggiator */
  noteOn(note: number, velocity: number, t: number) {
    this.lastVelocity = velocity;
    this.lastNote = performance.now();
    if (this.arp.on) this.arp.noteOn(note);
    else this.play(note, velocity, t);
  }

  noteOff(note: number, t: number) {
    if (this.arp.on) this.arp.noteOff(note);
    else this.release(note, t);
  }

  protected tone(vel: number) {
    const base = clampHz(ccCutoffHz(this.cc[PCC.CUTOFF] ?? 64));
    const velCents = velocityOctaves(vel) * 1200;
    const envCents = this.prog.envAmount * 5 * 1200;
    return {
      base,
      velCents,
      envCents,
      attack: ccAttackS(this.cc[PCC.ATTACK] ?? 0),
      decay: ccDecayS(this.cc[PCC.DECAY] ?? 60),
      release: ccReleaseS(this.cc[PCC.RELEASE] ?? 30),
      q: ccResonanceDb(this.cc[PCC.RESONANCE] ?? 0),
    };
  }
}

/** Mono bass with last-note priority, legato glide and a sub oscillator */
class BassPart extends MelodicPart {
  private oscA!: OscillatorNode;
  private oscB!: OscillatorNode;
  private gB!: GainNode;
  private filter!: BiquadFilterNode;
  private amp!: GainNode;
  private keys: number[] = [];
  private vel = 100;

  get kind() { return 'bass' as const; }

  constructor(ctx: AudioContext, dest: AudioNode) {
    super(ctx, dest, BASS_PROGRAMS);
    this.setProgram(0, ctx.currentTime);
  }

  private build() {
    if (this.amp) return;
    const ctx = this.ctx;
    this.oscA = ctx.createOscillator();
    this.oscB = ctx.createOscillator();
    const gA = ctx.createGain();
    gA.gain.value = 0.55;
    this.gB = ctx.createGain();
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.amp = ctx.createGain();
    this.amp.gain.value = 0;
    this.oscA.connect(gA).connect(this.filter);
    this.oscB.connect(this.gB).connect(this.filter);
    this.filter.connect(this.amp).connect(this.input);
    this.vibDepth.connect(this.oscA.detune);
    this.vibDepth.connect(this.oscB.detune);
    this.oscA.start();
    this.oscB.start();
  }

  protected onProgram(t: number) {
    this.build();
    this.oscA.type = this.prog.waves[0];
    this.oscB.type = this.prog.waves[1] ?? this.prog.waves[0];
    this.gB.gain.setTargetAtTime(this.prog.mix2 * 0.55, t, 0.01);
    this.onBend(t);
    this.onTone(t);
  }

  protected onTone(t: number) {
    const k = this.tone(this.vel);
    this.filter.frequency.setTargetAtTime(k.base, t, 0.012);
    this.filter.Q.setTargetAtTime(k.q, t, 0.012);
  }

  protected onBend(t: number) {
    this.oscA.detune.setTargetAtTime(this.bend, t, 0.005);
    this.oscB.detune.setTargetAtTime(this.bend + (this.prog.subOctave ? -1200 : 0), t, 0.005);
  }

  private setPitch(note: number, t: number, glide: boolean) {
    const f = midiHz(note);
    const g = ccGlideS(this.cc[PCC.GLIDE] ?? 0);
    for (const o of [this.oscA, this.oscB]) {
      if (glide && g > 0) o.frequency.setTargetAtTime(f, t, g / 3);
      else { o.frequency.cancelScheduledValues(t); o.frequency.setValueAtTime(f, t); }
    }
  }

  play(note: number, velocity: number, t: number) {
    this.build();
    const legato = this.keys.length > 0;
    this.keys = this.keys.filter(k => k !== note);
    this.keys.push(note);
    this.setPitch(note, t, legato);
    if (legato) return; // single trigger: gliding between held keys does not restart the envelope
    this.vel = velocity;
    const k = this.tone(velocity);
    this.filter.frequency.setTargetAtTime(k.base, t, 0.005);
    envOn(this.amp.gain, t, velocityGain(velocity), k.attack, velocityGain(velocity) * this.prog.sustain, k.decay);
    envOn(this.filter.detune, t, k.velCents + k.envCents, k.attack, k.velCents + k.envCents * this.prog.sustain, k.decay);
  }

  release(note: number, t: number) {
    if (!this.keys.includes(note)) return;
    const wasTop = this.keys[this.keys.length - 1] === note;
    this.keys = this.keys.filter(k => k !== note);
    if (this.keys.length) {
      if (wasTop) this.setPitch(this.keys[this.keys.length - 1], t, true);
      return;
    }
    const k = this.tone(this.vel);
    envOff(this.amp.gain, t, 0, k.release);
    envOff(this.filter.detune, t, k.velCents, k.release);
  }

  allOff(t: number, hard: boolean) {
    this.keys = [];
    if (!this.amp) return;
    envOff(this.amp.gain, t, 0, hard ? 0.01 : this.tone(this.vel).release);
  }
}

class KeysVoice {
  private oscs: OscillatorNode[];
  private filter: BiquadFilterNode;
  private amp: GainNode;
  done = false;
  releasedAt = Infinity;

  constructor(private part: KeysPart, readonly note: number, readonly velocity: number, t: number) {
    const ctx = part.audio;
    const prog = part.prog;
    const k = part.toneFor(velocity);
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = k.base;
    this.filter.Q.value = k.q;
    this.amp = ctx.createGain();
    this.amp.gain.value = 0;
    const f = midiHz(note);
    this.oscs = prog.waves.slice(0, 2).map((w, i) => {
      const o = ctx.createOscillator();
      o.type = w;
      o.frequency.value = f;
      o.detune.value = (i === 0 ? -prog.detune : prog.detune) / 2 + part.bend;
      const g = ctx.createGain();
      g.gain.value = i === 0 ? 0.5 : 0.5 * Math.max(0.2, prog.mix2 * 2);
      o.connect(g).connect(this.filter);
      part.vibrato.connect(o.detune);
      o.start(t);
      return o;
    });
    this.filter.connect(this.amp).connect(part.input);
    const level = velocityGain(velocity) * 0.42;
    envOn(this.amp.gain, t, level, k.attack, level * prog.sustain, k.decay);
    envOn(this.filter.detune, t, k.velCents + k.envCents, k.attack, k.velCents + k.envCents * prog.sustain, k.decay);
    this.oscs[0].onended = () => this.dispose();
  }

  bend(cents: number, t: number) {
    this.oscs.forEach((o, i) => o.detune.setTargetAtTime((i === 0 ? -this.part.prog.detune : this.part.prog.detune) / 2 + cents, t, 0.005));
  }

  tone(t: number) {
    const k = this.part.toneFor(this.velocity);
    this.filter.frequency.setTargetAtTime(k.base, t, 0.012);
    this.filter.Q.setTargetAtTime(k.q, t, 0.012);
  }

  release(t: number, hard = false) {
    if (this.releasedAt <= t) return;
    this.releasedAt = t;
    const k = this.part.toneFor(this.velocity);
    const rel = hard ? 0.01 : k.release;
    envOff(this.amp.gain, t, 0, rel);
    envOff(this.filter.detune, t, k.velCents, rel);
    const end = t + rel * 1.8 + 0.05;
    this.oscs.forEach(o => { try { o.stop(end); } catch { /* already stopped */ } });
  }

  private dispose() {
    if (this.done) return;
    this.done = true;
    this.oscs.forEach(o => { try { this.part.vibrato.disconnect(o.detune); } catch { /* */ } o.disconnect(); });
    this.filter.disconnect();
    this.amp.disconnect();
    this.part.forget(this);
  }
}

/** Six-voice keys with a sustain pedal */
class KeysPart extends MelodicPart {
  private voices: KeysVoice[] = [];
  private sustain = false;
  private sustained = new Set<number>();

  get kind() { return 'keys' as const; }
  get audio() { return this.ctx; }
  get vibrato() { return this.vibDepth; }

  constructor(ctx: AudioContext, dest: AudioNode) {
    super(ctx, dest, KEYS_PROGRAMS);
    this.setProgram(0, ctx.currentTime);
  }

  toneFor(vel: number) {
    return this.tone(vel);
  }

  forget(v: KeysVoice) {
    this.voices = this.voices.filter(x => x !== v);
  }

  protected onProgram(t: number) {
    this.allOff(t, true);
  }

  protected onTone(t: number) {
    this.voices.forEach(v => v.tone(t));
  }

  protected onBend(t: number) {
    this.voices.forEach(v => v.bend(this.bend, t));
  }

  controlChange(cc: number, v: number, t: number) {
    if (cc === PCC.SUSTAIN) {
      this.sustain = v >= 64;
      if (!this.sustain) {
        this.sustained.forEach(n => this.release(n, t));
        this.sustained.clear();
      }
      return;
    }
    super.controlChange(cc, v, t);
  }

  play(note: number, velocity: number, t: number) {
    // Same key again: its old voice gives way
    this.voices.filter(v => v.note === note && v.releasedAt === Infinity).forEach(v => v.release(t, true));
    this.sustained.delete(note);
    const live = this.voices.filter(v => v.releasedAt === Infinity);
    if (live.length >= 6) live[0].release(t, true); // voice stealing: the oldest
    this.voices.push(new KeysVoice(this, note, velocity, t));
  }

  release(note: number, t: number) {
    if (this.sustain) { this.sustained.add(note); return; }
    this.voices.filter(v => v.note === note && v.releasedAt === Infinity).forEach(v => v.release(t));
  }

  allOff(t: number, hard: boolean) {
    this.sustained.clear();
    this.voices.forEach(v => v.release(t, hard));
  }
}

// ----------------------------------------------------------------------------
// Drums (General MIDI note numbers on channel 10)
// ----------------------------------------------------------------------------

class DrumPart {
  readonly input: GainNode;
  private vol: GainNode;
  private pan: StereoPannerNode;
  program = 0;
  lastNote = 0;
  private volume = 100;
  private expression = 127;
  private openHat: GainNode | null = null;

  constructor(private ctx: AudioContext, dest: AudioNode) {
    this.input = ctx.createGain();
    this.vol = ctx.createGain();
    this.pan = ctx.createStereoPanner();
    this.input.connect(this.vol).connect(this.pan).connect(dest);
    this.applyLevel(ctx.currentTime);
  }

  setProgram(program: number) {
    this.program = Math.max(0, Math.min(127, Math.round(program)));
  }

  private applyLevel(t: number) {
    this.vol.gain.setTargetAtTime(ccVolumeGain(this.volume) * ccExpressionGain(this.expression), t, 0.01);
  }

  controlChange(cc: number, v: number, t: number) {
    if (cc === PCC.VOLUME) { this.volume = v; this.applyLevel(t); }
    if (cc === PCC.EXPRESSION) { this.expression = v; this.applyLevel(t); }
    if (cc === PCC.PAN) this.pan.pan.setTargetAtTime(ccPan(v), t, 0.01);
  }

  private noise(t: number, dur: number): AudioBufferSourceNode {
    const s = this.ctx.createBufferSource();
    s.buffer = getNoiseBuffer(this.ctx);
    s.start(t, Math.random() * 2, dur + 0.05);
    return s;
  }

  private decayGain(t: number, peak: number, decay: number): GainNode {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.001);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    return g;
  }

  private cleanup(src: AudioScheduledSourceNode, ...nodes: AudioNode[]) {
    src.onended = () => { src.disconnect(); nodes.forEach(n => n.disconnect()); };
  }

  hit(voice: DrumVoice, note: number, velocity: number, t: number) {
    const ctx = this.ctx;
    const p = DRUM_PROGRAMS[programIndex('drums', this.program)];
    const v = velocityGain(velocity);
    this.lastNote = performance.now();
    switch (voice) {
      case 'kick': {
        const [f0, f1, decay] = p.kick;
        const o = ctx.createOscillator();
        o.frequency.setValueAtTime(f0, t);
        o.frequency.exponentialRampToValueAtTime(f1, t + 0.09);
        const g = this.decayGain(t, 0.95 * v, decay);
        o.connect(g).connect(this.input);
        o.start(t);
        o.stop(t + decay + 0.05);
        this.cleanup(o, g);
        const click = this.noise(t, 0.006);
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 3200;
        const cg = this.decayGain(t, 0.25 * v, 0.006);
        click.connect(bp).connect(cg).connect(this.input);
        this.cleanup(click, bp, cg);
        break;
      }
      case 'snare': case 'clap': case 'rim': {
        const [decay, toneHz] = p.snare;
        const n = this.noise(t, voice === 'clap' ? 0.3 : decay);
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = voice === 'clap' ? 1150 : voice === 'rim' ? 3000 : 1800;
        bp.Q.value = voice === 'clap' ? 1.4 : 0.8;
        const g = ctx.createGain();
        if (voice === 'clap') {
          g.gain.setValueAtTime(0.0001, t);
          [0, 0.011, 0.022].forEach(d => {
            g.gain.setValueAtTime(0.55 * v, t + d);
            g.gain.exponentialRampToValueAtTime(0.05 * v, t + d + 0.009);
          });
          g.gain.setValueAtTime(0.45 * v, t + 0.033);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
        } else {
          const peak = voice === 'rim' ? 0.35 * v : 0.5 * v;
          const d = voice === 'rim' ? 0.03 : decay;
          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(peak, t + 0.001);
          g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        }
        n.connect(bp).connect(g).connect(this.input);
        this.cleanup(n, bp, g);
        if (voice !== 'clap') {
          const o = ctx.createOscillator();
          o.type = 'triangle';
          o.frequency.setValueAtTime(voice === 'rim' ? 1700 : toneHz, t);
          if (voice === 'snare') o.frequency.exponentialRampToValueAtTime(toneHz * 0.8, t + 0.06);
          const og = this.decayGain(t, (voice === 'rim' ? 0.3 : 0.4) * v, voice === 'rim' ? 0.025 : 0.09);
          o.connect(og).connect(this.input);
          o.start(t);
          o.stop(t + 0.15);
          this.cleanup(o, og);
        }
        break;
      }
      case 'hat': case 'pedal': case 'open': case 'cymbal': {
        const [closed, open] = p.hat;
        const decay = voice === 'open' ? open : voice === 'cymbal' ? 1.2 : voice === 'pedal' ? closed * 1.4 : closed;
        if ((voice === 'hat' || voice === 'pedal') && this.openHat) {
          // Closing the hi-hat chokes the open one
          this.openHat.gain.cancelScheduledValues(t);
          this.openHat.gain.setTargetAtTime(0, t, 0.006);
          this.openHat = null;
        }
        const n = this.noise(t, decay);
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = voice === 'cymbal' ? 4800 : 7200;
        const g = this.decayGain(t, (voice === 'cymbal' ? 0.22 : 0.3) * v, decay);
        n.connect(hp).connect(g).connect(this.input);
        this.cleanup(n, hp, g);
        if (voice === 'open') this.openHat = g;
        break;
      }
      case 'tom': {
        const base = 80 + Math.max(0, note - 41) * 14;
        const o = ctx.createOscillator();
        o.frequency.setValueAtTime(base * 1.5, t);
        o.frequency.exponentialRampToValueAtTime(base, t + 0.08);
        const g = this.decayGain(t, 0.6 * v, 0.32);
        o.connect(g).connect(this.input);
        o.start(t);
        o.stop(t + 0.4);
        this.cleanup(o, g);
        break;
      }
    }
  }
}

// ----------------------------------------------------------------------------
// The synth
// ----------------------------------------------------------------------------

type StatusListener = () => void;

export class PracticeSynth implements MidiOutputLike {
  readonly id = PRACTICE_SYNTH_ID;
  readonly name = PRACTICE_SYNTH_NAME;
  readonly manufacturer = 'Synth Studio';
  readonly state = 'connected';
  private ctx: AudioContext | null = null;
  private bus: GainNode | null = null;
  private direct: GainNode | null = null;
  private bass: BassPart | null = null;
  private keys: KeysPart | null = null;
  private drums: DrumPart | null = null;
  private clock = new ClockFollower();
  private listeners = 0;
  private statusListeners = new Set<StatusListener>();
  private status: PracticeStatus;
  private arpTimer: ReturnType<typeof setInterval> | null = null;
  private nextArp = 0;
  private clockWatch: ReturnType<typeof setInterval> | null = null;
  private notifyQueued = false;
  private lastMessage = 0;
  private ignored: PracticeStatus['ignored'] = null;
  private wasPresent = false;

  constructor() {
    this.status = this.buildStatus();
  }

  /** The audio graph is built on first use (after the page has an AudioContext) */
  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    if (typeof window === 'undefined') return null;
    const ctx = getAudioContext();
    this.ctx = ctx;
    this.bus = ctx.createGain();
    this.bus.gain.value = 0.9;
    this.direct = ctx.createGain();
    this.direct.gain.value = this.listeners ? 0 : 1;
    this.bus.connect(this.direct).connect(getMasterBus());
    this.bass = new BassPart(ctx, this.bus);
    this.keys = new KeysPart(ctx, this.bus);
    this.drums = new DrumPart(ctx, this.bus);
    return ctx;
  }

  // --------------------------------------------------------------------------
  // MIDI in
  // --------------------------------------------------------------------------

  /** MidiOutputLike: Web MIDI timestamps are performance.now() milliseconds */
  send(data: number[] | Uint8Array, timestamp?: number): void {
    const ctx = this.ensure();
    if (!ctx) return;
    const msg = parseMidi(data);
    if (!msg) return;
    const t = this.audioTime(ctx, timestamp);
    const ms = timestamp ?? performance.now();
    this.lastMessage = performance.now();
    switch (msg.type) {
      case 'clock':
        if (this.clock.clock(ms)) this.arpStep(t, this.sixteenth());
        if (!this.wasPresent) this.watchClock();
        return;
      case 'start':
        this.clock.start();
        this.bass!.arp.restart();
        this.keys!.arp.restart();
        this.notify();
        return;
      case 'continue':
        this.clock.continue();
        this.notify();
        return;
      case 'stop':
        this.clock.stop();
        this.bass!.allOff(t, false);
        this.keys!.allOff(t, false);
        this.notify();
        return;
      case 'songposition':
        this.clock.position(msg.position);
        return;
      case 'other':
        return;
    }
    const part = this.partOn(msg.channel);
    if (!part) {
      if (msg.type === 'noteon') {
        this.ignored = { channel: msg.channel, at: performance.now() };
        this.notify();
      }
      return;
    }
    switch (msg.type) {
      case 'noteon':
        if (part instanceof DrumPart) {
          const voice = drumFor(msg.note);
          if (voice) part.hit(voice, msg.note, msg.velocity, t);
        } else {
          if (this.clock.halted) this.clock.halted = false;
          part.noteOn(msg.note, msg.velocity, t);
          if (part.arp.on) this.ensureArpTimer();
        }
        this.notify();
        break;
      case 'noteoff':
        if (!(part instanceof DrumPart)) part.noteOff(msg.note, t);
        break;
      case 'cc':
        if (msg.cc === PCC.ALL_NOTES_OFF || msg.cc === PCC.ALL_SOUND_OFF) {
          if (!(part instanceof DrumPart)) { part.arp.clear(); part.allOff(t, msg.cc === PCC.ALL_SOUND_OFF); }
          this.notify();
          break;
        }
        part.controlChange(msg.cc, msg.value, t);
        if (msg.cc === PCC.ARP) { this.ensureArpTimer(); this.notify(); }
        break;
      case 'program':
        part.setProgram(msg.program, t);
        this.notify();
        break;
      case 'pitchbend':
        if (!(part instanceof DrumPart)) part.pitchBend(msg.value, t);
        break;
    }
  }

  private partOn(channel: number): BassPart | KeysPart | DrumPart | null {
    if (channel === 0) return this.bass;
    if (channel === 1) return this.keys;
    if (channel === 9) return this.drums;
    return null;
  }

  /** Undo what the sender added (output-latency compensation, global offset): this synth plays through the same speakers as the twins */
  private audioTime(ctx: AudioContext, ts: number | undefined): number {
    if (ts === undefined) return ctx.currentTime;
    const s = useMidiStore.getState().clockOut;
    const latency = s.compensate ? outputLatency(ctx) : 0;
    const t = (ts - audioClock.offset(ctx) - (s.offsetMs || 0)) / 1000 - latency;
    return Math.max(ctx.currentTime, t);
  }

  // --------------------------------------------------------------------------
  // Arpeggiator: MIDI clock when it arrives, its own tempo otherwise
  // --------------------------------------------------------------------------

  private sixteenth(): number {
    return 60 / (this.clock.bpm() ?? 120) / 4;
  }

  private arpStep(t: number, len: number) {
    for (const part of [this.bass, this.keys]) {
      if (!part?.arp.on) continue;
      const note = part.arp.next();
      if (note === null) continue;
      part.play(note, part.lastVelocity, t);
      part.release(note, t + len * 0.5);
      part.lastNote = performance.now();
    }
  }

  private arpActive() {
    return !!(this.bass?.arp.on || this.keys?.arp.on);
  }

  private ensureArpTimer() {
    if (this.arpTimer || !this.arpActive() || !this.ctx) return;
    const ctx = this.ctx;
    this.nextArp = ctx.currentTime + 0.02;
    this.arpTimer = setInterval(() => {
      if (!this.arpActive()) {
        if (this.arpTimer) clearInterval(this.arpTimer);
        this.arpTimer = null;
        return;
      }
      const now = performance.now();
      // MIDI clock is in charge while it arrives; after a Stop the arpeggiator waits
      if (this.clock.present(now) || this.clock.halted) {
        this.nextArp = ctx.currentTime + 0.02;
        return;
      }
      const step = 60 / INTERNAL_BPM / 4;
      if (this.nextArp < ctx.currentTime - 0.2) this.nextArp = ctx.currentTime + 0.01;
      while (this.nextArp < ctx.currentTime + 0.1) {
        this.arpStep(this.nextArp, step);
        this.nextArp += step;
      }
    }, 25);
  }

  /** Notice when clock stops arriving (the status shows it; the arpeggiator falls back to its own tempo) */
  private watchClock() {
    this.wasPresent = true;
    this.notify();
    if (this.clockWatch) return;
    this.clockWatch = setInterval(() => {
      const present = this.clock.present(performance.now());
      if (!present) {
        this.wasPresent = false;
        if (this.clockWatch) clearInterval(this.clockWatch);
        this.clockWatch = null;
        this.ensureArpTimer();
      }
      this.notify();
    }, 250);
  }

  // --------------------------------------------------------------------------
  // Audio out for Audio input ("the cable from the synth to your interface")
  // --------------------------------------------------------------------------

  /** Connect its audio to `dest`. Its direct sound switches off while anything listens. */
  listen(dest: AudioNode): () => void {
    this.ensure();
    if (!this.bus) return () => undefined;
    this.bus.connect(dest);
    this.listeners++;
    this.updateDirect();
    let done = false;
    return () => {
      if (done) return;
      done = true;
      try { this.bus?.disconnect(dest); } catch { /* */ }
      this.listeners = Math.max(0, this.listeners - 1);
      this.updateDirect();
    };
  }

  private updateDirect() {
    if (this.direct && this.ctx) this.direct.gain.setTargetAtTime(this.listeners ? 0 : 1, this.ctx.currentTime, 0.01);
    this.notify();
  }

  /** Play a short phrase on a channel (lesson auditions, Audio input "test") */
  demo(channel = 0) {
    const ctx = this.ensure();
    if (!ctx) return;
    const notes = channel === 9 ? [36, 42, 38, 42, 36, 36, 38, 46] : channel === 1 ? [60, 63, 67, 70, 72, 70, 67, 63] : [36, 36, 48, 36, 39, 36, 43, 46];
    const step = 0.16;
    const now = performance.now() + 30;
    notes.forEach((n, i) => {
      const vel = i % 4 === 0 ? 118 : 92;
      this.send([0x90 | channel, n, vel], now + i * step * 1000 + this.latencyMs());
      this.send([0x80 | channel, n, 0], now + (i * step + step * 0.6) * 1000 + this.latencyMs());
    });
  }

  private latencyMs() {
    const s = useMidiStore.getState().clockOut;
    return (s.compensate && this.ctx ? outputLatency(this.ctx) * 1000 : 0) + (s.offsetMs || 0);
  }

  // --------------------------------------------------------------------------
  // Status for the panels
  // --------------------------------------------------------------------------

  private buildStatus(): PracticeStatus {
    const now = performance.now?.() ?? 0;
    return {
      parts: PARTS.map(p => {
        const part = this.partOn(p.channel);
        const program = part?.program ?? 0;
        return {
          channel: p.channel,
          name: p.name,
          program,
          programName: p.programs[programIndex(p.kind, program)],
          arp: !!(part && !(part instanceof DrumPart) && part.arp.on),
          lastNote: part?.lastNote ?? 0,
        };
      }),
      clock: { present: this.clock.present(now), running: this.clock.running, bpm: this.clock.bpm() },
      listeners: this.listeners,
      lastMessage: this.lastMessage,
      ignored: this.ignored,
    };
  }

  private notify() {
    if (this.notifyQueued) return;
    this.notifyQueued = true;
    const run = () => {
      this.notifyQueued = false;
      this.status = this.buildStatus();
      this.statusListeners.forEach(l => l());
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);
    else setTimeout(run, 16);
  }

  getStatus = (): PracticeStatus => this.status;

  subscribe = (l: StatusListener): (() => void) => {
    this.statusListeners.add(l);
    return () => this.statusListeners.delete(l);
  };
}

/** The app-wide Practice synth, listed as a MIDI output */
export const practiceSynth = new PracticeSynth();
midi.addVirtualOutput(practiceSynth);
