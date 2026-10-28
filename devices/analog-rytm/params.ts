// ============================================================================
// Elektron Analog Rytm MKII - parameter tables
//
// One source of truth for the 12 drum tracks, their analog machines and the
// PARAMETER pages (TRIG / SRC / SMPL / FLTR / AMP / LFO, plus the FX track's
// DELAY / REVERB / DIST / COMP pages). spec.ts turns these into controls,
// layout.ts binds the eight DATA ENTRY encoders (A-H) to them, the screen
// renders them and engine.ts reads them.
//
// Page numbers refer to the Analog Rytm MKII User Manual (102-page edition):
//   Mode keys p.23 · Editing a sound p.34 · Editing the FX p.36 · Sequencer p.37
//   Parameter locks p.44 · Appendix A Drum track parameters p.71
//   Appendix B FX track parameters p.75 · Appendix D Machines p.88
//
// Simplifications (documented in index.ts tips too):
//   - Each track uses one fixed "CLASSIC"/"HARD" machine (no machine select).
//   - Values use the Elektron 0-127 style; TUNE/NOTE are in semitones.
//   - The SMPL page (sample layer) is not modelled.
// ============================================================================

import type { Units } from '@/types';

export interface TrackInfo {
  id: string;
  name: string;      // pad legend
  full: string;      // long name
  machine: string;   // analog machine used by this twin
  voice: number;     // analog voice (8 voices, 12 tracks)
}

// Voices shared by two tracks: RS/CP, MT/HT, CH/OH, CY/CB (the right-hand pad wins)
export const TRACKS: TrackInfo[] = [
  { id: 'bd', name: 'BD', full: 'BASS DRUM', machine: 'BD HARD', voice: 0 },
  { id: 'sd', name: 'SD', full: 'SNARE DRUM', machine: 'SD CLASSIC', voice: 1 },
  { id: 'rs', name: 'RS', full: 'RIM SHOT', machine: 'RS CLASSIC', voice: 2 },
  { id: 'cp', name: 'CP', full: 'HAND CLAP', machine: 'CP CLASSIC', voice: 2 },
  { id: 'bt', name: 'BT', full: 'BASS TOM', machine: 'BT CLASSIC', voice: 3 },
  { id: 'lt', name: 'LT', full: 'LOW TOM', machine: 'XT CLASSIC', voice: 4 },
  { id: 'mt', name: 'MT', full: 'MID TOM', machine: 'XT CLASSIC', voice: 5 },
  { id: 'ht', name: 'HT', full: 'HIGH TOM', machine: 'XT CLASSIC', voice: 5 },
  { id: 'ch', name: 'CH', full: 'CLOSED HAT', machine: 'CH CLASSIC', voice: 6 },
  { id: 'oh', name: 'OH', full: 'OPEN HAT', machine: 'OH CLASSIC', voice: 6 },
  { id: 'cy', name: 'CY', full: 'CYMBAL', machine: 'CY CLASSIC', voice: 7 },
  { id: 'cb', name: 'CB', full: 'COWBELL', machine: 'CB CLASSIC', voice: 7 },
];
export const FX_TRACK = 12;
export const TRACK_OPTIONS = [...TRACKS.map(t => t.name), 'FX'];
/** Pairs of tracks that share one analog voice: [left, right] (right has priority) */
export const SHARED_PAIRS: [number, number][] = [[2, 3], [6, 7], [8, 9], [10, 11]];

export const PAGES = ['TRIG', 'SRC', 'SMPL', 'FLTR', 'AMP', 'LFO', 'TEMPO'] as const;
export const PAGE = { TRIG: 0, SRC: 1, SMPL: 2, FLTR: 3, AMP: 4, LFO: 5, TEMPO: 6 } as const;
/** Same keys, FX track: SRC->DELAY, SMPL->REVERB, FLTR->DIST, AMP->COMP */
export const FX_PAGE_NAMES = ['-', 'DELAY', 'REVERB', 'DIST', 'COMP', 'LFO', 'TEMPO'];

export const PAD_MODES = ['PLAY', 'MUTE', 'CHRO', 'SCNE', 'PERF'];

export interface ParamDef {
  key: string;        // control id suffix (bd_<key>)
  abbr: string;       // screen abbreviation, as on the hardware
  label: string;      // encoder legend (prefixed with the track name in the spec)
  min: number;
  max: number;
  def: number;
  bipolar?: boolean;
  units?: Units;
  step?: number;
  fmt?: (v: number) => string;
  desc: string;
  ref: string;
}

const int = (v: number) => `${Math.round(v)}`;
const signed = (v: number) => (v > 0 ? `+${Math.round(v)}` : `${Math.round(v)}`);
export const FILTER_TYPES = ['LP2', 'LP1', 'BP', 'HP1', 'HP2', 'BS', 'PK'];
export const LFO_WAVES = ['TRI', 'SIN', 'SQR', 'SAW', 'RMP'];
export const LFO_DESTS = ['NONE', 'TUNE', 'FLT FRQ', 'PAN', 'VOL'];
export const LFO_MULTS = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048];
export const BD_WAVES = ['SIN', 'ASIN', 'TRI'];
export const lenFormat = (v: number) => {
  const n = Math.round(v);
  return ({ 1: '1/16', 2: '1/8', 4: '1/4', 8: '1/2', 16: '1 BAR' } as Record<number, string>)[n] ?? `${n}/16`;
};

const P = (key: string, abbr: string, label: string, min: number, max: number, def: number, desc: string, ref: string, extra: Partial<ParamDef> = {}): ParamDef =>
  ({ key, abbr, label, min, max, def, desc, ref, fmt: min < 0 ? signed : int, ...extra });

const REF_SRC = 'p.71 – Appendix A: SRC page';
const REF_MACH = 'p.88 – Appendix D: Machines';

// ----------------------------------------------------------------------------
// SRC page per machine (8 encoder slots A-H; null = unused on this machine)
// ----------------------------------------------------------------------------
const LEV = P('level', 'LEV', 'LEVEL', 0, 127, 100, 'Level of the analog machine before the filter', REF_SRC);
const TUN = (desc = 'Pitch of the drum in semitones') => P('tune', 'TUN', 'TUNE', -24, 24, 0, desc, REF_MACH, { units: 'semitones' });
const DEC = (desc: string, def = 50) => P('decay', 'DEC', 'DECAY', 0, 127, def, desc, REF_MACH);

export const MACHINE_PARAMS: Record<string, (ParamDef | null)[]> = {
  'BD HARD': [
    LEV, TUN('Base pitch the kick settles to after the sweep'), DEC('Length of the body (amplitude decay)', 50),
    P('hold', 'HLD', 'HOLD', 0, 127, 10, 'Time the body is held at full level before decaying', REF_MACH),
    P('sweep_time', 'SWT', 'SWP TIME', 0, 127, 40, 'How fast the pitch falls from the sweep start down to TUNE', REF_MACH),
    P('sweep_depth', 'SWD', 'SWP DEPTH', 0, 127, 70, 'How far above TUNE the pitch starts (the "boom" sweep)', REF_MACH),
    P('snap', 'SNP', 'SNAP', 0, 127, 40, 'Click transient at the start of the kick', REF_MACH),
    P('wave', 'WAV', 'WAVE', 0, 2, 0, 'Oscillator waveform: sine, asymmetric sine, triangle', REF_MACH, { step: 1, fmt: v => BD_WAVES[Math.round(v)] ?? '' }),
  ],
  'SD CLASSIC': [
    LEV, TUN('Pitch of the two drum-head tones'), DEC('Decay of the tonal (drum head) part', 35),
    P('detune', 'DET', 'DETUNE', 0, 127, 50, 'Interval between the two tone oscillators', REF_MACH),
    P('snap', 'SNP', 'SNAP', 0, 127, 60, 'Sharp attack transient (stick hitting the head)', REF_MACH),
    P('noise_decay', 'NOD', 'NOISE DEC', 0, 127, 50, 'Decay of the noise (snare wires)', REF_MACH),
    P('noise_level', 'NOL', 'NOISE LEV', 0, 127, 85, 'Level of the noise (snare wires)', REF_MACH),
    P('balance', 'BAL', 'BALANCE', 0, 127, 50, 'Balance between tone 1 and tone 2', REF_MACH),
  ],
  'RS CLASSIC': [
    LEV, TUN('Pitch of tone 1'), DEC('Decay of the rim shot', 30),
    P('balance', 'BAL', 'BALANCE', 0, 127, 64, 'Balance between tone 1 and tone 2', REF_MACH),
    P('tune2', 'T2', 'TUNE 2', -24, 24, 0, 'Pitch of tone 2', REF_MACH, { units: 'semitones' }),
    P('symmetry', 'SYM', 'SYMMETRY', 0, 127, 40, 'Asymmetric clipping that gives the rim its knock', REF_MACH),
    P('noise_level', 'NOL', 'NOISE LEV', 0, 127, 30, 'Level of the noise burst', REF_MACH),
    P('tick', 'TIC', 'TICK', 0, 127, 50, 'Very short click at the start', REF_MACH),
  ],
  'CP CLASSIC': [
    LEV,
    P('tone', 'TON', 'TONE', 0, 127, 64, 'Centre frequency of the band-passed clap noise', REF_MACH),
    P('noise_decay', 'NOD', 'NOISE DEC', 0, 127, 55, 'Decay of the room-like tail after the claps', REF_MACH),
    P('number', 'NUM', 'NUMBER', 0, 7, 3, 'Number of extra hand claps before the tail', REF_MACH, { step: 1 }),
    P('rate', 'RAT', 'RATE', 0, 127, 50, 'Spacing between the individual claps', REF_MACH),
    P('noise_level', 'NOL', 'NOISE LEV', 0, 127, 80, 'Level of the tail', REF_MACH),
    P('random', 'RND', 'RANDOM', 0, 127, 20, 'Random variation of the clap spacing (more human)', REF_MACH),
    P('clap_decay', 'CPD', 'CLAP DEC', 0, 127, 50, 'Decay of each individual clap', REF_MACH),
  ],
  'BT CLASSIC': [
    LEV, TUN('Pitch of the bass tom'), DEC('Decay of the bass tom', 60),
    P('noise_level', 'NOL', 'NOISE LEV', 0, 127, 20, 'Level of the noise mixed into the attack', REF_MACH),
    P('snap', 'SNP', 'SNAP', 0, 127, 30, 'Attack click', REF_MACH),
    null, null, null,
  ],
  'XT CLASSIC': [
    LEV, TUN('Pitch of the tom'), DEC('Decay of the tom', 60),
    P('sweep_depth', 'SWD', 'SWP DEPTH', 0, 127, 40, 'How far above TUNE the pitch starts', REF_MACH),
    P('sweep_time', 'SWT', 'SWP TIME', 0, 127, 60, 'How fast the pitch falls to TUNE', REF_MACH),
    P('noise_level', 'NOL', 'NOISE LEV', 0, 127, 25, 'Level of the noise (skin texture)', REF_MACH),
    P('noise_tone', 'NOT', 'NOISE TON', 0, 127, 60, 'Brightness of the noise', REF_MACH),
    null,
  ],
  'CH CLASSIC': [LEV, TUN('Pitch of the six metallic square oscillators'), DEC('Decay of the closed hat', 30),
    P('color', 'COL', 'COLOR', 0, 127, 64, 'Tone colour: metallic squares versus brighter noise', REF_MACH), null, null, null, null],
  'OH CLASSIC': [LEV, TUN('Pitch of the six metallic square oscillators'), DEC('Decay of the open hat', 60),
    P('color', 'COL', 'COLOR', 0, 127, 64, 'Tone colour: metallic squares versus brighter noise', REF_MACH), null, null, null, null],
  'CY CLASSIC': [LEV, TUN('Pitch of the metallic oscillators'), DEC('Decay of the cymbal', 70),
    P('color', 'COL', 'COLOR', 0, 127, 64, 'Tone colour: metallic versus noisy', REF_MACH),
    P('tone', 'TON', 'TONE', 0, 127, 64, 'Balance between the low and high cymbal bands', REF_MACH), null, null, null],
  'CB CLASSIC': [LEV, TUN('Pitch of the two square oscillators'), DEC('Decay of the cowbell', 45),
    P('detune', 'DET', 'DETUNE', 0, 127, 64, 'Interval between the two squares (64 = classic)', REF_MACH), null, null, null, null],
};

// Per-track overrides of machine defaults (so the default kit sounds like a kit)
export const TRACK_DEFAULTS: Record<string, Record<string, number>> = {
  sd: { tune: 0 },
  lt: { tune: -5 }, mt: { tune: 0 }, ht: { tune: 5 },
  oh: { decay: 62 },
  ch: { decay: 28 },
  cb: { level: 80 },
  cy: { level: 85 },
};

// ----------------------------------------------------------------------------
// Pages common to every drum track
// ----------------------------------------------------------------------------
const REF_TRIG = 'p.38 – TRIG page';
const REF_FLTR = 'p.72 – Appendix A: FLTR page';
const REF_AMP = 'p.72 – Appendix A: AMP page';
const REF_LFO = 'p.73 – Appendix A: LFO page';

export const TRIG_PARAMS: (ParamDef | null)[] = [
  P('note', 'NOTE', 'NOTE', -24, 24, 0, 'Default note of the track trigs (transposes TUNE)', REF_TRIG, { units: 'semitones' }),
  P('velocity', 'VEL', 'VELOCITY', 1, 127, 100, 'Velocity of normal trigs and pad hits (accent trigs play at 127)', REF_TRIG),
  P('length', 'LEN', 'LENGTH', 1, 16, 1, 'Note length: when the filter envelope enters its release', REF_TRIG, { step: 1, fmt: lenFormat }),
  null, null, null, null, null,
];

export const FLTR_PARAMS: (ParamDef | null)[] = [
  P('flt_attack', 'ATK', 'FLT ATK', 0, 127, 0, 'Filter envelope attack time', REF_FLTR),
  P('flt_decay', 'DEC', 'FLT DEC', 0, 127, 50, 'Filter envelope decay time', REF_FLTR),
  P('flt_sustain', 'SUS', 'FLT SUS', 0, 127, 0, 'Filter envelope sustain level', REF_FLTR),
  P('flt_release', 'REL', 'FLT REL', 0, 127, 40, 'Filter envelope release time (after LEN)', REF_FLTR),
  P('flt_freq', 'FRQ', 'FLT FREQ', 0, 127, 127, 'Filter cutoff / centre frequency', REF_FLTR),
  P('flt_res', 'RES', 'FLT RES', 0, 127, 0, 'Filter resonance (emphasis at the cutoff)', REF_FLTR),
  P('flt_type', 'TYPE', 'FLT TYPE', 0, 6, 0, 'Filter type: 2/1-pole low-pass, band-pass, 1/2-pole high-pass, band-stop, peak', REF_FLTR, { step: 1, fmt: v => FILTER_TYPES[Math.round(v)] ?? '' }),
  P('flt_env', 'ENV', 'FLT ENV', -64, 63, 0, 'Filter envelope depth (how far the envelope moves the cutoff)', REF_FLTR, { bipolar: true }),
];

export const AMP_PARAMS: (ParamDef | null)[] = [
  P('amp_attack', 'ATK', 'AMP ATK', 0, 127, 0, 'Amplitude envelope attack time', REF_AMP),
  P('amp_hold', 'HLD', 'AMP HOLD', 0, 127, 0, 'Time the amplitude is held before the decay starts', REF_AMP),
  P('amp_decay', 'DEC', 'AMP DEC', 0, 127, 127, 'Amplitude envelope decay (127 = infinite: the machine decay alone shapes the sound)', REF_AMP,
    { fmt: v => (v >= 127 ? 'INF' : int(v)) }),
  P('overdrive', 'OVR', 'OVERDRIVE', 0, 127, 0, 'Overdrive before the filter', REF_AMP),
  P('delay_send', 'DEL', 'DEL SEND', 0, 127, 0, 'Send level to the FX track delay', REF_AMP),
  P('reverb_send', 'REV', 'REV SEND', 0, 127, 0, 'Send level to the FX track reverb', REF_AMP),
  P('pan', 'PAN', 'PAN', -64, 63, 0, 'Stereo position', REF_AMP, { bipolar: true, fmt: v => (v === 0 ? 'C' : v < 0 ? `L${-Math.round(v)}` : `R${Math.round(v)}`) }),
  P('volume', 'VOL', 'VOLUME', 0, 127, 100, 'Track volume', REF_AMP),
];

export const LFO_PARAMS: (ParamDef | null)[] = [
  P('lfo_speed', 'SPD', 'LFO SPEED', -64, 63, 16, 'LFO speed (with MULT: 16 x8 = one cycle per bar)', REF_LFO, { bipolar: true }),
  P('lfo_mult', 'MULT', 'LFO MULT', 0, 11, 3, 'LFO speed multiplier', REF_LFO, { step: 1, fmt: v => { const m = LFO_MULTS[Math.round(v)] ?? 1; return m >= 1024 ? `x${m / 1024}k` : `x${m}`; } }),
  null, // FADE (not modelled)
  P('lfo_dest', 'DEST', 'LFO DEST', 0, 4, 0, 'What the LFO modulates', REF_LFO, { step: 1, fmt: v => LFO_DESTS[Math.round(v)] ?? '' }),
  P('lfo_wave', 'WAVE', 'LFO WAVE', 0, 4, 0, 'LFO waveform', REF_LFO, { step: 1, fmt: v => LFO_WAVES[Math.round(v)] ?? '' }),
  null, // SPH start phase (not modelled)
  null, // MODE (free running only)
  P('lfo_depth', 'DEP', 'LFO DEPTH', -64, 63, 0, 'LFO modulation depth', REF_LFO, { bipolar: true }),
];

// ----------------------------------------------------------------------------
// FX track (master effects) - Appendix B, p.75-77
// ----------------------------------------------------------------------------
const REF_DEL = 'p.75 – Appendix B: DELAY';
const REF_REV = 'p.75 – Appendix B: REVERB';
const REF_DIS = 'p.76 – Appendix B: DISTORTION';
const REF_CMP = 'p.76 – Appendix B: COMPRESSOR';
const prePost = (v: number) => (Math.round(v) ? 'POST' : 'PRE');
export const COMP_ATTACKS = [0.03, 0.1, 0.3, 1, 3, 10, 30];          // ms
export const COMP_RELEASES = ['0.1', '0.2', '0.4', '0.6', '1', '2', 'A1', 'A2'];
export const COMP_RELEASE_S = [0.1, 0.2, 0.4, 0.6, 1, 2, 0.25, 0.8];
export const COMP_RATIOS = ['1:2', '1:4', '1:8', 'MAX'];
export const COMP_RATIO_N = [2, 4, 8, 20];

export const FX_DELAY: (ParamDef | null)[] = [
  P('fx_delay_time', 'TIME', 'DEL TIME', 1, 127, 24, 'Delay time in 128th notes of the bar (16 = 1/8, 24 = dotted 1/8, 32 = 1/4)', REF_DEL),
  P('fx_delay_pingpong', 'X', 'PING PONG', 0, 1, 0, 'Ping-pong: repeats bounce between left and right', REF_DEL, { step: 1, fmt: v => (Math.round(v) ? 'ON' : 'OFF') }),
  P('fx_delay_width', 'WID', 'DEL WIDTH', -64, 63, 63, 'Stereo width of the delay repeats', REF_DEL, { bipolar: true }),
  P('fx_delay_feedback', 'FDBK', 'FEEDBACK', 0, 198, 60, 'How much of the output is fed back (number of repeats)', REF_DEL),
  P('fx_delay_hpf', 'HPF', 'DEL HPF', 0, 127, 20, 'High-pass filter in the delay', REF_DEL),
  P('fx_delay_lpf', 'LPF', 'DEL LPF', 0, 127, 100, 'Low-pass filter in the delay', REF_DEL),
  P('fx_delay_reverb', 'REV', 'DEL>REV', 0, 127, 0, 'Send from the delay into the reverb', REF_DEL),
  P('fx_delay_volume', 'VOL', 'DEL VOL', 0, 127, 100, 'Delay return level', REF_DEL),
];
export const FX_REVERB: (ParamDef | null)[] = [
  P('fx_reverb_predelay', 'PRE', 'PREDELAY', 0, 127, 10, 'Time before the reverb starts', REF_REV),
  P('fx_reverb_decay', 'DEC', 'REV DECAY', 0, 127, 50, 'Reverb decay time (room size)', REF_REV),
  P('fx_reverb_freq', 'FREQ', 'SHELF FRQ', 0, 127, 90, 'Shelving filter frequency', REF_REV),
  P('fx_reverb_gain', 'GAIN', 'SHELF GAIN', 0, 127, 100, 'Shelving filter gain (lower = darker tail)', REF_REV),
  P('fx_reverb_hpf', 'HPF', 'REV HPF', 0, 127, 25, 'High-pass filter on the reverb', REF_REV),
  P('fx_reverb_lpf', 'LPF', 'REV LPF', 0, 127, 100, 'Low-pass filter on the reverb', REF_REV),
  null,
  P('fx_reverb_volume', 'VOL', 'REV VOL', 0, 127, 100, 'Reverb return level', REF_REV),
];
export const FX_DIST: (ParamDef | null)[] = [
  P('fx_dist_delay', 'DEL', 'DEL PRE/POST', 0, 1, 0, 'Delay return before (PRE) or after (POST) the distortion', REF_DIS, { step: 1, fmt: prePost }),
  P('fx_dist_reverb', 'REV', 'REV PRE/POST', 0, 1, 1, 'Reverb return before (PRE) or after (POST) the distortion', REF_DIS, { step: 1, fmt: prePost }),
  null, null,
  P('fx_dist_amount', 'AMT', 'DIST AMT', 0, 127, 0, 'Amount of master distortion', REF_DIS),
  P('fx_dist_symmetry', 'SYM', 'DIST SYM', -64, 63, 0, 'Symmetry of the clipping (asymmetry adds even harmonics)', REF_DIS, { bipolar: true }),
  null, null,
];
export const FX_COMP: (ParamDef | null)[] = [
  P('fx_comp_threshold', 'THR', 'COMP THR', 0, 127, 127, 'Threshold: level above which compression starts (127 = 0 dB)', REF_CMP),
  P('fx_comp_attack', 'ATK', 'COMP ATK', 0, 6, 3, 'Attack: how fast the compressor reacts', REF_CMP, { step: 1, fmt: v => `${COMP_ATTACKS[Math.round(v)]}ms` }),
  P('fx_comp_release', 'REL', 'COMP REL', 0, 7, 3, 'Release: how fast the gain recovers (A1/A2 = auto)', REF_CMP, { step: 1, fmt: v => COMP_RELEASES[Math.round(v)] ?? '' }),
  P('fx_comp_makeup', 'MUP', 'MAKEUP', 0, 127, 0, 'Make-up gain after compression', REF_CMP),
  P('fx_comp_ratio', 'RAT', 'RATIO', 0, 3, 1, 'Ratio: how strongly level above the threshold is reduced', REF_CMP, { step: 1, fmt: v => COMP_RATIOS[Math.round(v)] ?? '' }),
  null, // SEQ sidechain EQ (not modelled)
  P('fx_comp_mix', 'MIX', 'COMP MIX', 0, 127, 127, 'Dry/wet mix (parallel compression)', REF_CMP),
  P('fx_comp_volume', 'VOL', 'COMP VOL', 0, 127, 100, 'Output volume after the compressor', REF_CMP),
];

export const TEMPO_PARAMS: (string | null)[] = ['bpm', 'swing', null, null, null, null, null, null];

export const FX_PAGES: Record<number, (ParamDef | null)[]> = { 1: FX_DELAY, 2: FX_REVERB, 3: FX_DIST, 4: FX_COMP };
export const FX_ALL = [...FX_DELAY, ...FX_REVERB, ...FX_DIST, ...FX_COMP].filter((p): p is ParamDef => !!p);

export const trackPages = (t: number): Record<number, (ParamDef | null)[]> => ({
  [PAGE.TRIG]: TRIG_PARAMS,
  [PAGE.SRC]: MACHINE_PARAMS[TRACKS[t].machine],
  [PAGE.FLTR]: FLTR_PARAMS,
  [PAGE.AMP]: AMP_PARAMS,
  [PAGE.LFO]: LFO_PARAMS,
});

/** Control ids bound to encoders A-H for a track/page (null = unbound) */
export function pageControls(track: number, page: number): (string | null)[] {
  if (page === PAGE.TEMPO) return TEMPO_PARAMS;
  if (track === FX_TRACK) {
    const defs = FX_PAGES[page];
    return defs ? defs.map(d => (d ? d.key : null)) : Array(8).fill(null);
  }
  const t = TRACKS[track];
  if (!t) return Array(8).fill(null);
  const defs = trackPages(track)[page];
  return defs ? defs.map(d => (d ? `${t.id}_${d.key}` : null)) : Array(8).fill(null);
}

/** Screen abbreviations for the current page */
export function pageAbbrs(track: number, page: number): (string | null)[] {
  if (page === PAGE.TEMPO) return ['BPM', 'SWNG', null, null, null, null, null, null];
  if (track === FX_TRACK) return (FX_PAGES[page] ?? Array(8).fill(null)).map(d => (d ? d.abbr : null));
  return (trackPages(track)[page] ?? Array(8).fill(null)).map(d => (d ? d.abbr : null));
}

export const ENCODER_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
