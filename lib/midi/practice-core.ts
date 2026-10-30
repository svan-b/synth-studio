// ============================================================================
// Practice synth - the pure parts (no browser APIs, unit-tested):
// what it listens to, its programs, how CC values become sound settings, its
// arpeggiator and how it follows MIDI clock.
//
// The Practice synth stands in for a hardware synth at the end of a MIDI
// cable, so people without gear (and iPads, which have no Web MIDI) can learn
// the whole workflow: ports, channels, velocity, CCs, program changes and clock.
//
//   channel 1   Bass   mono, glide              programs 1-4
//   channel 2   Keys   6 voices, sustain pedal  programs 1-4
//   channel 10  Drums  General MIDI note map    programs 1-2
//   other channels: nothing listens (on purpose: that is what channels are for)
// ============================================================================

export const PRACTICE_SYNTH_ID = 'synth-studio-practice-synth';
export const PRACTICE_SYNTH_NAME = 'Practice synth (built in)';

/** The controller numbers it follows (General MIDI 2 "sound controllers" where they exist) */
export const PCC = {
  MOD_WHEEL: 1,
  GLIDE: 5,
  VOLUME: 7,
  PAN: 10,
  EXPRESSION: 11,
  SUSTAIN: 64,
  RESONANCE: 71,
  RELEASE: 72,
  ATTACK: 73,
  CUTOFF: 74,
  DECAY: 75,
  VIBRATO_RATE: 76,
  VIBRATO_DEPTH: 77,
  ARP: 80,
  ALL_SOUND_OFF: 120,
  RESET_CONTROLLERS: 121,
  ALL_NOTES_OFF: 123,
} as const;

/** Internal arpeggiator tempo when no MIDI clock arrives - deliberately not a "round" studio tempo */
export const INTERNAL_BPM = 104;
/** Clock pulses this long apart (ms) mean the clock has stopped arriving */
export const CLOCK_TIMEOUT_MS = 300;

export type PartKind = 'bass' | 'keys' | 'drums';

export interface MelodicProgram {
  name: string;
  /** Oscillator waves (bass: main + sub one octave down) */
  waves: OscillatorType[];
  /** Level of the second oscillator 0..1 */
  mix2: number;
  /** Detune between the oscillators in cents (keys) */
  detune: number;
  /** Second oscillator one octave down (bass sub) */
  subOctave: boolean;
  /** Patch values in CC units 0..127: the CCs overwrite these until the next program change */
  cutoff: number;
  resonance: number;
  attack: number;
  decay: number;
  release: number;
  glide: number;
  /** Filter envelope depth 0..1 (0..5 octaves) */
  envAmount: number;
  /** Sustain level 0..1 */
  sustain: number;
}

export interface DrumProgram {
  name: string;
  /** Kick start / end pitch (Hz) and decay (s) */
  kick: [number, number, number];
  /** Snare decay (s) and tone (Hz) */
  snare: [number, number];
  /** Hat closed / open decay (s) */
  hat: [number, number];
}

const mp = (p: Partial<MelodicProgram> & { name: string }): MelodicProgram => ({
  waves: ['sawtooth', 'sawtooth'], mix2: 0.5, detune: 0, subOctave: false,
  cutoff: 64, resonance: 20, attack: 0, decay: 60, release: 30, glide: 0, envAmount: 0.4, sustain: 0.6,
  ...p,
});

export const BASS_PROGRAMS: MelodicProgram[] = [
  mp({ name: 'Saw bass', waves: ['sawtooth', 'square'], subOctave: true, mix2: 0.45, cutoff: 50, resonance: 28, envAmount: 0.55, decay: 56, sustain: 0.5, release: 26 }),
  mp({ name: 'Square bass', waves: ['square', 'square'], subOctave: true, mix2: 0.35, cutoff: 46, resonance: 16, envAmount: 0.45, decay: 62, sustain: 0.6, release: 26 }),
  mp({ name: 'Acid bass', waves: ['sawtooth', 'sawtooth'], subOctave: false, mix2: 0, cutoff: 36, resonance: 104, envAmount: 0.85, decay: 46, sustain: 0.08, release: 20, glide: 38 }),
  mp({ name: 'Sub bass', waves: ['triangle', 'sine'], subOctave: true, mix2: 0.7, cutoff: 74, resonance: 0, envAmount: 0.1, decay: 80, sustain: 0.9, release: 34 }),
];

export const KEYS_PROGRAMS: MelodicProgram[] = [
  mp({ name: 'Bright lead', waves: ['sawtooth', 'sawtooth'], detune: 9, cutoff: 78, resonance: 24, envAmount: 0.35, decay: 70, sustain: 0.7, release: 44 }),
  mp({ name: 'Square lead', waves: ['square', 'square'], detune: 5, cutoff: 70, resonance: 18, envAmount: 0.3, decay: 64, sustain: 0.75, release: 40 }),
  mp({ name: 'Soft pad', waves: ['sawtooth', 'triangle'], detune: 13, cutoff: 56, resonance: 8, envAmount: 0.15, attack: 88, decay: 92, sustain: 0.85, release: 96 }),
  mp({ name: 'Pluck', waves: ['sawtooth', 'square'], detune: 6, cutoff: 48, resonance: 34, envAmount: 0.75, decay: 52, sustain: 0, release: 52 }),
];

export const DRUM_PROGRAMS: DrumProgram[] = [
  { name: 'Analog kit', kick: [150, 46, 0.42], snare: [0.2, 185], hat: [0.045, 0.32] },
  { name: 'Tight kit', kick: [190, 55, 0.24], snare: [0.12, 230], hat: [0.03, 0.18] },
];

export interface PartInfo {
  channel: number;
  kind: PartKind;
  name: string;
  programs: string[];
}

/** Which part listens on which channel (0-based) */
export const PARTS: PartInfo[] = [
  { channel: 0, kind: 'bass', name: 'Bass', programs: BASS_PROGRAMS.map(p => p.name) },
  { channel: 1, kind: 'keys', name: 'Keys', programs: KEYS_PROGRAMS.map(p => p.name) },
  { channel: 9, kind: 'drums', name: 'Drums', programs: DRUM_PROGRAMS.map(p => p.name) },
];

export const partFor = (channel: number): PartInfo | undefined => PARTS.find(p => p.channel === channel);

/** Program number (0-127 on the wire) -> one of the part's programs (they repeat every N) */
export function programIndex(kind: PartKind, program: number): number {
  const n = kind === 'bass' ? BASS_PROGRAMS.length : kind === 'keys' ? KEYS_PROGRAMS.length : DRUM_PROGRAMS.length;
  return ((Math.round(program) % n) + n) % n;
}

export function programName(channel: number, program: number): string | null {
  const part = partFor(channel);
  if (!part) return null;
  return part.programs[programIndex(part.kind, program)];
}

// General MIDI percussion (channel 10) -> the drum voices it has
export type DrumVoice = 'kick' | 'rim' | 'snare' | 'clap' | 'hat' | 'pedal' | 'open' | 'tom' | 'cymbal';

export function drumFor(note: number): DrumVoice | null {
  switch (note) {
    case 35: case 36: return 'kick';
    case 37: return 'rim';
    case 38: case 40: return 'snare';
    case 39: return 'clap';
    case 42: return 'hat';
    case 44: return 'pedal';
    case 46: return 'open';
    case 41: case 43: case 45: case 47: case 48: case 50: return 'tom';
    case 49: case 51: case 52: case 53: case 55: case 57: case 59: return 'cymbal';
    default: return null;
  }
}

export const DRUM_NAMES: Record<DrumVoice, string> = {
  kick: 'Kick', rim: 'Rim', snare: 'Snare', clap: 'Clap', hat: 'Closed hat', pedal: 'Pedal hat', open: 'Open hat', tom: 'Tom', cymbal: 'Cymbal',
};

// ----------------------------------------------------------------------------
// CC value (0..127) -> sound settings
// ----------------------------------------------------------------------------

const n = (v: number) => Math.max(0, Math.min(127, v)) / 127;

/** Cutoff in Hz: 30 Hz .. ~18 kHz, exponential like a real filter knob */
export const ccCutoffHz = (v: number) => 30 * Math.pow(2, n(v) * 9.2);
/** Resonance as BiquadFilter Q (dB for a low-pass) */
export const ccResonanceDb = (v: number) => n(v) * 22;
export const ccAttackS = (v: number) => 0.001 * Math.pow(3000, n(v));
export const ccDecayS = (v: number) => 0.01 * Math.pow(400, n(v));
export const ccReleaseS = (v: number) => 0.01 * Math.pow(500, n(v));
export const ccGlideS = (v: number) => (v <= 0 ? 0 : 0.004 * Math.pow(2, n(v) * 7.3));
/** CC 7: 100 is unity, like most synths' default */
export const ccVolumeGain = (v: number) => Math.min(1.62, Math.pow(Math.max(0, v) / 100, 2));
export const ccExpressionGain = (v: number) => Math.pow(n(v), 2);
export const ccPan = (v: number) => Math.max(-1, Math.min(1, (v - 64) / 63));
export const ccVibratoRateHz = (v: number) => 1 + n(v) * 11;
/** Vibrato depth in cents (mod wheel and CC 77 add up) */
export const ccVibratoCents = (v: number) => n(v) * 60;

/** Note-on velocity -> level (a clear curve, so velocity is easy to hear) */
export const velocityGain = (vel: number) => Math.pow(Math.max(1, Math.min(127, vel)) / 127, 1.6);
/** Note-on velocity -> filter brightness in octaves (harder = brighter) */
export const velocityOctaves = (vel: number) => ((Math.max(1, Math.min(127, vel)) - 96) / 127) * 1.8;

// ----------------------------------------------------------------------------
// Arpeggiator: latched, up, one octave, 16th notes
// ----------------------------------------------------------------------------

export class ArpCore {
  on = false;
  /** Latched notes, low to high */
  notes: number[] = [];
  private held = new Set<number>();
  private released = true;
  private index = 0;

  /** A key goes down. A new chord (after every key was released) replaces the latched notes. */
  noteOn(note: number) {
    if (this.released) {
      this.notes = [];
      this.index = 0;
      this.released = false;
    }
    this.held.add(note);
    if (!this.notes.includes(note)) {
      this.notes.push(note);
      this.notes.sort((a, b) => a - b);
    }
  }

  /** A key comes up: the note stays latched */
  noteOff(note: number) {
    this.held.delete(note);
    if (!this.held.size) this.released = true;
  }

  clear() {
    this.notes = [];
    this.held.clear();
    this.released = true;
    this.index = 0;
  }

  /** Back to the first note (a clock Start) */
  restart() {
    this.index = 0;
  }

  /** The note for the next step, or null when there is nothing to play */
  next(): number | null {
    if (!this.on || !this.notes.length) return null;
    const note = this.notes[this.index % this.notes.length];
    this.index++;
    return note;
  }
}

// ----------------------------------------------------------------------------
// MIDI clock follower: 24 pulses per quarter note, Start / Stop / Continue / SPP
// ----------------------------------------------------------------------------

export const CLOCKS_PER_16TH = 6;

export class ClockFollower {
  /** Start (or Continue) received and no Stop since */
  running = false;
  /** Pulses since Start */
  count = 0;
  /** Stopped by a Stop message: the arpeggiator waits for a Start or a new note */
  halted = false;
  private last = -Infinity;
  private gaps: number[] = [];

  start() {
    this.running = true;
    this.halted = false;
    this.count = 0;
  }

  continue() {
    this.running = true;
    this.halted = false;
  }

  stop() {
    this.running = false;
    this.halted = true;
  }

  /** Song Position Pointer, in MIDI beats (16th notes) */
  position(sixteenths: number) {
    this.count = Math.max(0, Math.floor(sixteenths)) * CLOCKS_PER_16TH;
  }

  /** A timing clock at `ms`. Returns true when it falls on a 16th note while running. */
  clock(ms: number): boolean {
    const gap = ms - this.last;
    if (gap > 0 && gap < 250) {
      this.gaps.push(gap);
      if (this.gaps.length > 24) this.gaps.shift();
    } else if (gap >= 250) {
      this.gaps = [];
    }
    this.last = ms;
    if (!this.running) return false;
    const on16th = this.count % CLOCKS_PER_16TH === 0;
    this.count++;
    return on16th;
  }

  /** Clock pulses are arriving */
  present(ms: number): boolean {
    return ms - this.last < CLOCK_TIMEOUT_MS;
  }

  /** Tempo measured from the pulses (null until a few have arrived) */
  bpm(): number | null {
    if (this.gaps.length < 6) return null;
    const avg = this.gaps.reduce((a, b) => a + b, 0) / this.gaps.length;
    return 60000 / (avg * 24);
  }
}
