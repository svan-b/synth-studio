// ============================================================================
// Analog Rytm MKII model - tracks, voices, machines and PARAMETER pages
//
// Pure data (no React, no Web Audio). spec.ts turns it into controls, the
// layout binds the DATA ENTRY encoders A-H to it, the screen draws it and the
// engine maps it onto the 'analog-rytm' worklet (public/worklets/
// analog-rytm-processors.js). See REFERENCE.md for sources and confidence.
//
// Hardware facts used here (REFERENCE.md has the details):
//  - 12 tracks on 8 analog voices; RS/CP, MT/HT, CH/OH and CY/CB share a voice
//    (firmware voice table, rytm-mods machines.md) - the later trig chokes.
//  - Machine numbers, storage order of the 8 SRC parameters and the machines
//    each track may run come from libanalogrytm (sound.h / sound.c) and the
//    firmware's machine table (rytm-mods machines.md).
//  - SRC page knob positions (encoders A..H, with their gaps) are read from
//    the screen images of the Rytm MKII manual (OS 1.72, Appendix D,
//    pp.96-109); BD HARD matches the firmware's knob table. Storage order
//    (the slots, and the MIDI CC order, p.86) differs.
//  - FLTR FRQ is one semitone a step: 440 Hz at 60, 13.8 Hz at 0, 21.1 kHz at
//    127 (measured on hardware, filter-hz mod).
// ============================================================================

import { NOTE_LENGTHS, RETRIG_RATES, TRIG_CONDITIONS, formatLength } from '@/lib/sequencer/elektron';

// ----------------------------------------------------------------------------
// Machines (hardware numbering, libanalogrytm AR_SOUND_MACHINE_*)
// ----------------------------------------------------------------------------

export const M = {
  BD_HARD: 0, BD_CLASSIC: 1, SD_HARD: 2, SD_CLASSIC: 3, RS_HARD: 4, RS_CLASSIC: 5, CP_CLASSIC: 6,
  BT_CLASSIC: 7, XT_CLASSIC: 8, CH_CLASSIC: 9, OH_CLASSIC: 10, CY_CLASSIC: 11, CB_CLASSIC: 12,
  BD_FM: 13, SD_FM: 14, UT_NOISE: 15, UT_IMPULSE: 16, CH_METALLIC: 17, OH_METALLIC: 18,
  CY_METALLIC: 19, CB_METALLIC: 20, BD_PLASTIC: 21, BD_SILKY: 22, SD_NATURAL: 23, HH_BASIC: 24,
  CY_RIDE: 25, BD_SHARP: 26, DISABLE: 27, SY_DUAL_VCO: 28, SY_CHIP: 29, BD_ACOUSTIC: 30,
  SD_ACOUSTIC: 31, SY_RAW: 32, HH_LAB: 33,
} as const;

export type VoiceType = 'dual' | 'res' | 'hat' | 'cym';

// ----------------------------------------------------------------------------
// Machine parameters. One catalogue per voice type: a key is a control on every
// track of that type (bd_tun, sd_tun ...), shared by the machines that use it,
// so switching BD HARD -> BD CLASSIC keeps TUN, DEC, HLD and SWT.
// ----------------------------------------------------------------------------

export interface MParam {
  key: string;
  /** Screen label (three or four letters, as on the hardware) */
  abbr: string;
  name: string;
  min: number;
  max: number;
  def: number;
  bipolar?: boolean;
  semis?: boolean;
  /** Value names for stepped parameters */
  options?: readonly string[];
  desc: string;
}

const P = (key: string, abbr: string, name: string, min: number, max: number, def: number, desc: string, extra: Partial<MParam> = {}): MParam =>
  ({ key, abbr, name, min, max, def, desc, ...extra });
const U = (key: string, abbr: string, name: string, def: number, desc: string) => P(key, abbr, name, 0, 127, def, desc);
const B = (key: string, abbr: string, name: string, desc: string, def = 0) => P(key, abbr, name, -64, 63, def, desc, { bipolar: true });
const T = (key: string, abbr: string, name: string, desc: string, range = 32) =>
  P(key, abbr, name, -range, range, 0, desc, { bipolar: true, semis: true });

export const BD_WAVES = ['SIN', 'ASIN', 'TRI'] as const;
export const SHARP_WAVES = ['SINA', 'SINB', 'ASNA', 'ASNB', 'TRIA', 'TRIB', 'SSWA', 'SSWB', 'SAWA', 'SAWB', 'SQRA', 'SQRB'] as const;
export const RAW_WAVES1 = ['SIN', 'ASIN', 'TRI', 'SSAW', 'ASAW', 'SAW', 'RING'] as const;
export const RAW_WAVES2 = ['SINA', 'SSWA', 'SINB', 'SSWB'] as const;
export const CHIP_SPEEDS = [
  '128T', '128', '64T', '128.', '64', '32T', '64.', '32', '16T', '32.', '16', '8T', '16.', '8', '4T', '8.', '4', '2T', '4.', '2', '1T', '2.', '1', '1.',
  '1Hz', '1.56Hz', '1.88Hz', '2Hz', '3.13Hz', '3.75Hz', '4Hz', '5Hz', '6.25Hz', '7.5Hz', '10Hz', '12.5Hz', '15Hz', '20Hz', '25Hz', '30Hz', '40Hz',
  '50Hz', '60Hz', '75Hz', '100Hz', '120Hz', '150Hz', '180Hz', '200Hz', '240Hz', '250Hz', '300Hz', '350Hz', '360Hz', '400Hz', '420Hz', '480Hz',
  // single-shot: the arpeggio runs once and holds its last note
  '240S', '200S', '150S', '120S', '100S', '60S', '50S', '30S', '25S',
] as const;
/** First single-shot speed */
export const CHIP_ONESHOT = 57;
/** SY CHIP waveforms (manual p.103-104): analog waves, pitched noise, animations, PWM, tables, pulse widths */
export const CHIP_WAVES: readonly string[] = [
  'SIN', 'ASIN', 'TRI', 'SSAW', 'SAW', 'SQR', 'NOIS', 'ANM1', 'ANM2', 'ANM3', 'ANM4', 'ANM5', 'PWM+', 'PWM-',
  '.TRI', '+TRI', 'TRI+', 'TRI*', '.SAW', '+SAW', 'SAW+', 'SAW*', '.SQR', '+SQR', 'SQR+', 'SQR*', 'TBL1', 'TBL2', 'TBL3',
  ...Array.from({ length: 99 }, (_, i) => `P${i + 1}%`),
];
/** SY DUAL VCO CFG 0..79: osc 1 wave (Sine, Sinesaw) x mode (+ mix, R ring, F FM, FR FM + ring) x osc 2 wave, each with and without "_" (oscillators reset on the trig) */
export const DUAL_CFG: readonly string[] = (() => {
  const w1 = ['SIN', 'SSW'];
  const md = ['+', 'R', 'F', 'FR'];
  const w2 = ['SIN', 'SKW', 'TRI', 'SSW', 'SAW'];
  const out: string[] = [];
  for (const a of w1) for (const m of md) for (const b of w2) { out.push(`${a}${m}${b}_`); out.push(`${a}${m}${b}`); }
  return out;
})();
export const RIDE_TYPES = ['A', 'B', 'C', 'D'] as const;

/** Two-oscillator voices: BD, SD, RS, CP tracks */
const DUAL_PARAMS: MParam[] = [
  U('lev', 'LEV', 'Level', 100, 'Overall volume of the machine. It is squared on the way to the VCA, so halving it is about -12 dB.'),
  T('tun', 'TUN', 'Tune', 'Pitch of the oscillator in semitones. The trig NOTE, CHRO and the LFO add to it.'),
  U('dec', 'DEC', 'Decay', 50, 'Length of the decay phase: how long the drum rings.'),
  U('hld', 'HLD', 'Hold', 32, 'Hold time before the decay phase starts: the body of the drum.'),
  U('swt', 'SWT', 'Sweep Time', 64, 'Pitch sweep time. Low values give a short, clicky sweep; high values a long boom or a laser.'),
  U('swd', 'SWD', 'Sweep Depth', 64, 'Depth of the pitch sweep: how far above the tuned pitch the sweep starts.'),
  U('snp', 'SNP', 'Snap', 48, 'Snap: an immediate, very fast pitch drop at the start of the attack. Shape the transient with TIC.'),
  P('wav', 'WAV', 'Waveform', 0, 2, 0, 'Oscillator waveform: sine, asymmetric sine or triangle, with more overtones in that order.', { options: BD_WAVES }),
  P('wavx', 'WAV', 'Waveform', 0, 11, 0, 'Waveform: sine, asymmetric sine, triangle, sinesaw, saw or square. A restarts the oscillator on every trig, B lets it run free.', { options: SHARP_WAVES }),
  U('tic', 'TIC', 'Tick Level', 64, 'Level of the transient tick at the very start: the beater hitting the skin.'),
  P('tra', 'TRA', 'Transient', 0, 55, 17, 'Chooses the transient (a tick or a noise burst) together with its level: 56 variations.'),
  U('fma', 'FMA', 'FM Amount', 32, 'How strongly the second oscillator frequency-modulates the first: brighter, inharmonic partials.'),
  U('fms', 'FMS', 'FM Sweep Time', 32, 'Pitch sweep time of the modulating oscillator.'),
  U('fmd', 'FMD', 'FM Decay', 48, 'Decay of the modulating oscillator, so how long the FM brightness lasts.'),
  T('fmt', 'FMT', 'FM Tune', 'Pitch of the modulating oscillator in semitones.'),
  P('typ', 'TYP', 'Modulation Type', 0, 1, 1, 'A: linear FM between the two oscillators. B: FM together with ring modulation.', { options: ['A', 'B'] }),
  U('mod', 'MOD', 'Modulation', 32, 'Modulation depth between the oscillators: the harmonics and the rubbery bounce of the drum.'),
  U('dus', 'DUS', 'Dust', 64, 'Level of a soft, tape-like static layer.'),
  U('clk', 'CLK', 'VCO Click', 100, 'Level of a soft click made by the oscillator itself.'),
  U('imp', 'IMP', 'Impact', 64, 'Level of the digital transient: a mix of a short recording and noise.'),
  U('det', 'DET', 'Detune', 52, 'Pitch of the second oscillator relative to the first (0 = unison).'),
  U('nod', 'NOD', 'Noise Decay', 50, 'Length of the noise decay: the snare wires.'),
  U('nol', 'NOL', 'Noise Level', 64, 'Level of the noise.'),
  B('bal', 'BAL', 'Osc Balance', 'Balance between the levels of oscillator 1 and oscillator 2.'),
  U('nbal', 'BAL', 'Noise Balance', 64, 'Balance between the noise and the oscillator.'),
  U('bdy', 'BDY', 'Body Decay', 64, 'Decay time of the oscillator: the shell of the drum.'),
  U('lpf', 'LPF', 'Lowpass', 100, 'Low-pass cutoff of the noise filter.'),
  U('hpf', 'HPF', 'Highpass', 32, 'High-pass cutoff of the noise filter.'),
  U('nres', 'RES', 'Noise Resonance', 32, 'Resonant peak at the noise low-pass cutoff (0 = none).'),
  B('sym', 'SYM', 'Symmetry', 'Non-linearity of the rim-shot circuit: changes the knock of the rim.'),
  T('t1', 'T1', 'Tune Osc 1', 'Pitch of the first oscillator in semitones.'),
  T('t2', 'T2', 'Tune Osc 2', 'Pitch of the second oscillator in semitones.'),
  U('ton', 'TON', 'Noise Tone', 64, 'Pitch of the clap noise (the centre of its band-pass).'),
  U('num', 'NUM', 'Clap Number', 2, 'Number of hand claps before the tail.'),
  U('rat', 'RAT', 'Clap Rate', 85, 'Rate of the hand claps: higher is faster, so the claps sit closer together.'),
  U('rnd', 'RND', 'Random Claps', 32, 'Randomizes the timing of the claps: a looser, more human clap.'),
  U('cpd', 'CPD', 'Clap Decay', 90, 'Length of the decay of each clap.'),
  U('lpq', 'LPQ', 'LP Resonance', 0, 'Resonance at the low-pass cutoff (0 = none).'),
  U('atk', 'ATK', 'Attack', 0, 'Length of the attack phase.'),
  B('nswd', 'SWD', 'Sweep Depth', 'Depth of the low-pass cutoff sweep, up or down.'),
  P('pol', 'POL', 'Polarity', 0, 1, 0, 'Polarity of the impulse: positive or negative.', { options: ['POS', 'NEG'] }),
  U('dec2', 'DEC', 'Osc 2 Decay', 70, 'Decay of oscillator 2 (127 holds).'),
  T('vdet', 'DET', 'Osc 2 Detune', 'Pitch of oscillator 2 relative to oscillator 1, in semitones.', 16),
  B('bnd', 'BND', 'Bend', 'Depth of a fixed-time pitch envelope, up or down (24 steps an octave).'),
  P('cfg', 'CFG', 'Osc Config', 0, 79, 16, 'Waveforms and interaction: osc 1 sine or sinesaw; + mixes, R ring-modulates, F frequency-modulates (osc 1 the carrier), FR does both; osc 2 sine, skewed sine, triangle, sinesaw or saw; "_" resets the oscillators on every trig.', { options: DUAL_CFG }),
  T('of2', 'OF2', 'Offset 2', 'Second note of the arpeggio, in semitones above (or below) TUN. 0 ends the arpeggio here.', 24),
  T('of3', 'OF3', 'Offset 3', 'Third note of the arpeggio. 0 ends the arpeggio here.', 24),
  T('of4', 'OF4', 'Offset 4', 'Fourth note of the arpeggio. 0 ends the arpeggio here.', 24),
  P('cwav', 'WAV', 'Waveform', 0, 127, 2, 'Waveform: analog waves, pitched chip noise, animated and ring-modulated variants, PWM, noise-then-wave tables and fixed pulse widths.', { options: CHIP_WAVES }),
  P('cspd', 'SPD', 'Speed', 0, CHIP_SPEEDS.length - 1, 41, 'Arpeggio speed: note values of the tempo, then fixed rates in Hz, then single-shot rates (S) that play the arpeggio once.', { options: CHIP_SPEEDS }),
  T('rdet', 'DET', 'Detune', 'Tuning of oscillator 2 relative to oscillator 1, in semitones.', 24),
  P('wav1', 'WAV1', 'Osc 1 Wave', 0, 6, 4, 'Oscillator 1 waveform: sine, asymmetric sine, triangle, sinesaw, asymmetric saw, saw, or RING (oscillator 1 ring-modulates oscillator 2 with a square wave).', { options: RAW_WAVES1 }),
  P('wav2', 'WAV2', 'Osc 2 Wave', 0, 3, 0, 'Oscillator 2 waveform: sine or sinesaw. A resets both oscillators on every trig, B lets them run free.', { options: RAW_WAVES2 }),
];

/** UT NOISE / UT IMPULSE run on every voice */
const UT_KEYS = ['lev', 'lpf', 'hpf', 'lpq', 'atk', 'swt', 'nswd', 'pol', 'dec'];

/** TUN of the tom, hat, cymbal and cowbell circuits: shown -64..63, half a semitone a step (BT: a quarter) */
const TUN64 = P('tun', 'TUN', 'Tune', -64, 63, 0, 'Pitch of the circuit.', { bipolar: true });

/** Resonator voices: BT, LT, MT, HT */
const RES_PARAMS: MParam[] = [
  ...DUAL_PARAMS.filter(p => ['lev', 'dec', 'swd', 'swt', 'nod', 'nol', 'lpf', 'hpf', 'lpq', 'atk', 'nswd', 'pol'].includes(p.key)),
  TUN64,
  P('snp', 'SNP', 'Snap', 0, 3, 1, 'Length of the snap transient: the resonator is switched to a sharper state for a moment after the strike (0 = off, 3 = longest).'),
  B('ton', 'TON', 'Noise Tone', 'Pitch of the noise. It follows TUN, so the noise stays in tune with the drum.'),
];

/** Hi-hat bank: CH, OH */
const HAT_PARAMS: MParam[] = [
  ...DUAL_PARAMS.filter(p => UT_KEYS.includes(p.key)),
  TUN64,
  B('col', 'COL', 'Noise Color', 'Timbral colour: the hardness of the metal. Lower is darker, higher is brighter and thinner.'),
  B('ton', 'TON', 'Tone', 'Tone of the hat: higher is more shrill, lower is deeper.'),
  U('trd', 'TRD', 'Transient Decay', 68, 'Length of the transient at the start of the hit.'),
  P('rst', 'RST', 'Osc Reset', 0, 1, 0, 'ON restarts the oscillators on every trig, so every hit sounds the same; OFF lets them run free.', { options: ['OFF', 'ON'] }),
  U('osc1', 'OSC1', 'Osc 1 Frequency', 40, 'Frequency of oscillator 1.'),
  U('osc2', 'OSC2', 'Osc 2 Frequency', 52, 'Frequency of oscillator 2.'),
  U('osc3', 'OSC3', 'Osc 3 Frequency', 58, 'Frequency of oscillator 3.'),
  U('osc4', 'OSC4', 'Osc 4 Frequency', 70, 'Frequency of oscillator 4.'),
  U('osc5', 'OSC5', 'Osc 5 Frequency', 71, 'Frequency of oscillator 5.'),
  U('osc6', 'OSC6', 'Osc 6 Frequency', 84, 'Frequency of oscillator 6.'),
];

/** Cymbal / cowbell bank: CY, CB */
const CYM_PARAMS: MParam[] = [
  ...DUAL_PARAMS.filter(p => UT_KEYS.includes(p.key)),
  TUN64,
  B('col', 'COL', 'Noise Color', 'Timbral colour of the cymbal.'),
  B('ton', 'TON', 'Tone', 'Metallic tone: the balance of the cymbal bands (CY METALLIC: of transient and body).'),
  U('trd', 'TRD', 'Transient Decay', 35, 'Length of the transient decay phase.'),
  P('typ', 'TYP', 'Cymbal Type', 0, 3, 0, 'Set of oscillator frequencies and how they interact: A 808 ratios, B the HH BASIC set, C and D metallic sets.', { options: RIDE_TYPES }),
  U('hit', 'HIT', 'Hit Decay', 64, 'Decay of the top (hit) component.'),
  U('c1', 'C1', 'Component 1', 64, 'Level of component 1 (the hit).'),
  U('c2', 'C2', 'Component 2', 64, 'Level of component 2.'),
  U('c3', 'C3', 'Component 3', 32, 'Level of component 3.'),
  U('cdet', 'DET', 'Detune', 64, 'Detune offset of the second oscillator.'),
  B('pw1', 'PW1', 'Pulse Width 1', 'Pulse width of oscillator 1: its timbre.'),
  B('pw2', 'PW2', 'Pulse Width 2', 'Pulse width of oscillator 2: its timbre.'),
];

export const PARAMS_BY_TYPE: Record<VoiceType, MParam[]> = { dual: DUAL_PARAMS, res: RES_PARAMS, hat: HAT_PARAMS, cym: CYM_PARAMS };
const byKey = (list: MParam[]) => Object.fromEntries(list.map(p => [p.key, p])) as Record<string, MParam>;
export const PARAM_INDEX: Record<VoiceType, Record<string, MParam>> = {
  dual: byKey(DUAL_PARAMS), res: byKey(RES_PARAMS), hat: byKey(HAT_PARAMS), cym: byKey(CYM_PARAMS),
};

// ----------------------------------------------------------------------------
// Machine definitions
//   slots: the 8 synth parameters in storage order (sound index 9..16 / CC 16..23)
//   knobs: SRC page encoders A..H
// ----------------------------------------------------------------------------

export interface MachineDef {
  id: number;
  name: string;
  short: string;
  slots: (string | null)[];
  knobs: (string | null)[];
  /** The machine's own values when it is selected (the hardware's defaults, rytm-rs) */
  init?: Record<string, number>;
  /** Screen label / name / text of a parameter on this machine, where it differs from the catalogue */
  labels?: Record<string, { abbr?: string; name?: string; desc?: string }>;
  desc: string;
}

const MD = (id: number, name: string, short: string, slots: (string | null)[], knobs: (string | null)[], desc: string,
  init?: Record<string, number>, labels?: MachineDef['labels']): MachineDef =>
  ({ id, name, short, slots, knobs, desc, init, labels });

// knobs: the manual's SRC screens (Appendix D); slots: libanalogrytm / firmware storage order.
export const MACHINES: Record<number, MachineDef> = {
  [M.BD_HARD]: MD(M.BD_HARD, 'BD HARD', 'BDHD', ['lev', 'tun', 'dec', 'hld', 'swt', 'snp', 'wav', 'tic'], ['tun', 'swt', 'snp', 'dec', 'wav', 'hld', 'tic', 'lev'],
    'A hard, punchy kick: one oscillator with a fixed-depth pitch sweep, an extra snap and a hold-then-decay body.',
    { tun: -3, dec: 47, hld: 40, swt: 90, snp: 6, wav: 0, tic: 64 },
    { snp: { name: 'Snap Amount', desc: 'Level of the snap transient: an immediate pitch drop at the attack (the sweep depth itself is fixed).' } }),
  [M.BD_CLASSIC]: MD(M.BD_CLASSIC, 'BD CLASSIC', 'BDCL', ['lev', 'tun', 'dec', 'hld', 'swt', 'swd', 'wav', 'tra'], ['tun', 'swt', 'swd', 'dec', 'wav', 'hld', 'tra', 'lev'],
    'The classic analog kick: a swept oscillator with adjustable sweep depth and a choice of 56 transients.',
    { tun: -6, dec: 32, hld: 32, swt: 64, swd: 42, wav: 1, tra: 17 }),
  [M.BD_FM]: MD(M.BD_FM, 'BD FM', 'BDFM', ['lev', 'tun', 'dec', 'fma', 'swt', 'fms', 'fmd', 'fmt'], ['tun', 'swt', 'fmd', 'dec', 'fmt', 'fms', 'fma', 'lev'],
    'Two-operator FM kick: the second oscillator modulates the first, adding a bright, inharmonic attack that fades with FMD.',
    { tun: -6, dec: 32, fma: 32, swt: 48, fms: 32, fmd: 48, fmt: -16 },
    { tun: { desc: 'Pitch of the first (modulated) oscillator in semitones.' }, swt: { desc: 'Pitch sweep time of the first (modulated) oscillator.' }, dec: { desc: 'Decay of the first oscillator, and so of the whole drum.' } }),
  [M.BD_PLASTIC]: MD(M.BD_PLASTIC, 'BD PLASTIC', 'BDPL', ['lev', 'tun', 'dec', 'typ', 'mod', 'swt', 'swd', 'tic'], ['tun', 'swt', 'swd', 'dec', 'typ', 'mod', 'tic', 'lev'],
    'Two interacting oscillators at one pitch, the second modulating the first all the way through: a tight, rubbery, clicky kick.',
    { tun: -6, dec: 80, typ: 1, mod: 32, swt: 64, swd: 100, tic: 64 },
    { tun: { desc: 'Pitch of the two interacting oscillators in semitones.' } }),
  [M.BD_SILKY]: MD(M.BD_SILKY, 'BD SILKY', 'BDSI', ['lev', 'tun', 'dec', 'hld', 'swt', 'swd', 'dus', 'clk'], ['tun', 'swt', 'swd', 'dec', 'hld', 'dus', 'clk', 'lev'],
    'A smooth sine kick with a soft click from the oscillator and a tape-like dust layer.',
    { tun: -6, dec: 64, hld: 32, swt: 64, swd: 64, dus: 64, clk: 100 }),
  [M.BD_SHARP]: MD(M.BD_SHARP, 'BD SHARP', 'BDSH', ['lev', 'tun', 'dec', 'hld', 'swt', 'swd', 'wavx', 'tic'], ['tun', 'swt', 'swd', 'dec', 'hld', 'tic', 'wavx', 'lev'],
    'A single oscillator with six waveforms (up to saw and square), free-running or reset, and a recorded transient: aggressive and sharp.',
    { tun: -6, dec: 80, hld: 32, swt: 100, swd: 100, wavx: 0, tic: 64 }),
  [M.BD_ACOUSTIC]: MD(M.BD_ACOUSTIC, 'BD ACOUSTIC', 'BDAC', ['lev', 'tun', 'dec', 'hld', 'swt', 'swd', 'wavx', 'imp'], ['tun', 'swt', 'swd', 'dec', 'hld', 'imp', 'wavx', 'lev'],
    'Built like BD SHARP with a beater impact layer: an acoustic kick drum.',
    { tun: -3, dec: 64, hld: 64, swt: 80, swd: 92, wavx: 0, imp: 64 }),
  [M.SD_HARD]: MD(M.SD_HARD, 'SD HARD', 'SDHD', ['lev', 'tun', 'dec', 'swd', 'tic', 'nod', 'nol', 'swt'], ['tun', 'swt', 'swd', 'dec', 'tic', 'nod', 'nol', 'lev'],
    'Two swept oscillators at a fixed interval (a fifth) plus snare-wire noise: a hard, cracking snare.',
    { tun: 0, dec: 76, swd: 127, tic: 64, nod: 32, nol: 64, swt: 43 }),
  [M.SD_CLASSIC]: MD(M.SD_CLASSIC, 'SD CLASSIC', 'SDCL', ['lev', 'tun', 'dec', 'det', 'snp', 'nod', 'nol', 'bal'], ['tun', 'det', 'bal', 'dec', 'snp', 'nod', 'nol', 'lev'],
    'The classic analog snare: two drum-head oscillators at an adjustable interval, a snap and wire noise.',
    { tun: -6, dec: 48, det: 52, snp: 64, nod: 64, nol: 64, bal: -32 },
    { tun: { desc: 'Common pitch of the two oscillators in semitones.' }, snp: { name: 'Snap Amount', desc: 'Level of the snap transient.' } }),
  [M.SD_FM]: MD(M.SD_FM, 'SD FM', 'SDFM', ['lev', 'tun', 'dec', 'fmt', 'fmd', 'nod', 'nol', 'fma'], ['tun', 'fmt', 'fmd', 'dec', 'fma', 'nod', 'nol', 'lev'],
    'An FM snare: carrier and modulator, a short pitch blip and noise.',
    { tun: -6, dec: 64, fmt: 12, fmd: 64, nod: 32, nol: 64, fma: 127 },
    { tun: { desc: 'Pitch of the first (modulated) oscillator in semitones.' }, dec: { desc: 'Decay of the first oscillator, and so of the whole drum.' } }),
  [M.SD_NATURAL]: MD(M.SD_NATURAL, 'SD NATURAL', 'SDNA', ['lev', 'tun', 'bdy', 'dec', 'nbal', 'lpf', 'hpf', 'nres'], ['tun', 'dec', 'nbal', 'bdy', 'hpf', 'lpf', 'nres', 'lev'],
    'One oscillator for the shell and noise with its own filter (HPF, LPF, RES) for the wires: a natural snare.',
    { tun: 6, bdy: 90, dec: 32, nbal: 64, lpf: 90, hpf: 32, nres: 32 },
    { dec: { name: 'Noise Decay', desc: 'Length of the noise decay: the wires.' }, bdy: { name: 'Decay Time', desc: 'Length of the decay of the oscillator: the shell.' } }),
  [M.SD_ACOUSTIC]: MD(M.SD_ACOUSTIC, 'SD ACOUSTIC', 'SDAC', ['lev', 'tun', 'bdy', 'nod', 'nol', 'hld', 'swd', 'imp'], ['tun', 'nod', 'nol', 'bdy', 'hld', 'imp', 'swd', 'lev'],
    'Two oscillators a fifth apart, wire noise and a stick impact: an acoustic snare.',
    { tun: 6, bdy: 64, nod: 64, nol: 64, hld: 64, swd: 32, imp: 64 },
    { bdy: { name: 'Decay Time', desc: 'Length of the decay of the oscillator: the shell.' } }),
  [M.RS_HARD]: MD(M.RS_HARD, 'RS HARD', 'RSHD', ['lev', 'tun', 'dec', 'swd', 'tic', 'nol', 'sym', 'swt'], ['tun', 'swt', 'swd', 'dec', 'sym', 'tic', 'nol', 'lev'],
    'Two oscillators at the inharmonic rim-shot ratio (about 3.7:1) with a pitch sweep and the rim-shot circuit.',
    { tun: 0, dec: 52, swd: 127, tic: 48, nol: 8, sym: 0, swt: 34 }),
  [M.RS_CLASSIC]: MD(M.RS_CLASSIC, 'RS CLASSIC', 'RSCL', ['lev', 't1', 'dec', 'bal', 't2', 'sym', 'nol', 'tic'], ['t1', 't2', 'bal', 'dec', 'sym', 'tic', 'nol', 'lev'],
    'Two independently tuned oscillators through the rim-shot circuit: the classic analog rim shot.',
    { t1: 0, dec: 64, bal: 0, t2: 0, sym: 0, nol: 16, tic: 64 }),
  [M.CP_CLASSIC]: MD(M.CP_CLASSIC, 'CP CLASSIC', 'CPCL', ['lev', 'ton', 'nod', 'num', 'rat', 'nol', 'rnd', 'cpd'], ['rat', 'num', 'rnd', 'cpd', 'ton', 'nod', 'nol', 'lev'],
    'Hand clap: a few bursts of filtered noise, then a noise tail.',
    { lev: 115, ton: 64, nod: 55, num: 2, rat: 85, nol: 90, rnd: 32, cpd: 90 }),
  [M.BT_CLASSIC]: MD(M.BT_CLASSIC, 'BT CLASSIC', 'BTCL', ['lev', 'tun', 'dec', null, 'nol', 'snp', 'swd', null], ['tun', null, 'swd', 'dec', 'snp', null, 'nol', 'lev'],
    'Bass tom: a tuned resonator struck by a pulse, with snap, a pitch sweep and a noise layer.',
    { tun: 16, dec: 63, nol: 0, snp: 1, swd: 0 },
    { tun: { desc: 'Pitch of the bass tom: a quarter semitone a step, about 16 semitones either way.' } }),
  [M.XT_CLASSIC]: MD(M.XT_CLASSIC, 'XT CLASSIC', 'XTCL', ['lev', 'tun', 'dec', 'swd', 'swt', 'nod', 'nol', 'ton'], ['tun', 'swt', 'swd', 'dec', 'ton', 'nod', 'nol', 'lev'],
    'Analog tom: a tuned resonator with a pitch sweep and a noise layer that follows the tuning.',
    { tun: 34, dec: 52, swd: 36, swt: 34, nod: 5, nol: 85, ton: 0 },
    { tun: { desc: 'Pitch of the tom: half a semitone a step, about 2.7 octaves either way.' } }),
  [M.CH_CLASSIC]: MD(M.CH_CLASSIC, 'CH CLASSIC', 'CHCL', ['lev', 'tun', 'dec', 'col', null, null, null, null], ['tun', null, null, 'dec', null, null, 'col', 'lev'],
    'Closed hat: six square oscillators at the TR-808 ratios through the closed path: a quick fixed drop, then DEC.',
    { tun: 0, dec: 32, col: 0 }),
  [M.OH_CLASSIC]: MD(M.OH_CLASSIC, 'OH CLASSIC', 'OHCL', ['lev', 'tun', 'dec', 'col', null, null, null, null], ['tun', null, null, 'dec', null, null, 'col', 'lev'],
    'Open hat: the same 808-ratio bank through the open path.',
    { tun: 0, dec: 32, col: 0 }),
  [M.CH_METALLIC]: MD(M.CH_METALLIC, 'CH METALLIC', 'CHMT', ['lev', 'tun', 'dec', null, null, null, null, null], ['tun', null, null, 'dec', null, null, null, 'lev'],
    'Closed hat from interacting oscillators in a wider, more inharmonic set: harder and more metallic.',
    { tun: 0, dec: 40 }),
  [M.OH_METALLIC]: MD(M.OH_METALLIC, 'OH METALLIC', 'OHMT', ['lev', 'tun', 'dec', null, null, null, null, null], ['tun', null, null, 'dec', null, null, null, 'lev'],
    'Open hat from the metallic set, with a fixed opening segment before DEC.',
    { tun: 0, dec: 40 }),
  [M.HH_BASIC]: MD(M.HH_BASIC, 'HH BASIC', 'HHBA', ['lev', 'tun', 'dec', 'ton', 'trd', 'rst', null, null], ['tun', 'ton', 'trd', 'dec', null, null, 'rst', 'lev'],
    'A basic hat: its own six-oscillator set with tone, transient decay and oscillator reset.',
    { lev: 110, tun: 0, dec: 29, ton: 0, trd: 68, rst: 0 }),
  [M.HH_LAB]: MD(M.HH_LAB, 'HH LAB', 'HHLA', ['lev', 'osc1', 'dec', 'osc2', 'osc3', 'osc4', 'osc5', 'osc6'], ['osc1', 'osc2', 'osc3', 'dec', 'osc4', 'osc5', 'osc6', 'lev'],
    'A hat laboratory: set the frequency of each of the six oscillators yourself.',
    { lev: 110, dec: 29 }),
  [M.CY_CLASSIC]: MD(M.CY_CLASSIC, 'CY CLASSIC', 'CYCL', ['lev', 'tun', 'dec', 'col', 'ton', null, null, null], ['tun', 'ton', null, 'dec', null, null, 'col', 'lev'],
    'Cymbal: the 808-ratio bank through three bands; two decay quickly, DEC sets the long tail.',
    { lev: 127, tun: 0, dec: 64, col: 0, ton: 0 }),
  [M.CY_METALLIC]: MD(M.CY_METALLIC, 'CY METALLIC', 'CYMT', ['lev', 'tun', 'dec', 'ton', 'trd', null, null, null], ['tun', 'ton', 'trd', 'dec', null, null, null, 'lev'],
    'A metallic cymbal from ring-modulated oscillators: a transient and a body, balanced with TON.',
    { tun: 0, dec: 35, ton: 35, trd: 35 },
    { ton: { desc: 'Tone of the metallic transient.' } }),
  [M.CY_RIDE]: MD(M.CY_RIDE, 'CY RIDE', 'CYRD', ['lev', 'tun', 'dec', 'typ', 'hit', 'c1', 'c2', 'c3'], ['tun', 'typ', 'hit', 'dec', 'c1', 'c2', 'c3', 'lev'],
    'Ride cymbal: four oscillator sets and three separately set components (hit, body, tail).',
    { tun: 0, dec: 64, typ: 0, hit: 64, c1: 64, c2: 64, c3: 32 },
    { dec: { name: 'Tail Decay', desc: 'Decay of the tail.' } }),
  [M.CB_CLASSIC]: MD(M.CB_CLASSIC, 'CB CLASSIC', 'CBCL', ['lev', 'tun', 'dec', 'cdet', 'pw1', 'pw2', null, null], ['tun', null, null, 'dec', 'cdet', 'pw1', 'pw2', 'lev'],
    'Cowbell: two pulse oscillators with a two-stage envelope, like the TR-808.',
    { tun: 1, dec: 20, cdet: 64, pw1: 0, pw2: 0 },
    { tun: { desc: 'Base pitch of the two oscillators (half a semitone a step).' } }),
  [M.CB_METALLIC]: MD(M.CB_METALLIC, 'CB METALLIC', 'CBMT', ['lev', 'tun', 'dec', 'cdet', 'pw1', 'pw2', null, null], ['tun', null, null, 'dec', 'cdet', 'pw1', 'pw2', 'lev'],
    'A metallic cowbell: the pulse pair through a brighter path, tuned over half the range, DET in whole semitones.',
    { tun: 23, dec: 50, cdet: 64, pw1: 0, pw2: 0 },
    { tun: { desc: 'Base pitch of the two oscillators (a quarter semitone a step).' } }),
  [M.UT_NOISE]: MD(M.UT_NOISE, 'UT NOISE', 'UTNO', ['lev', 'lpf', 'dec', 'hpf', 'lpq', 'atk', 'swt', 'nswd'], ['lpf', 'lpq', 'atk', 'dec', 'hpf', 'nswd', 'swt', 'lev'],
    'White noise generator: noise through a low-pass and a high-pass, an attack-decay envelope and a low-pass sweep.',
    { lev: 100, lpf: 127, dec: 40, hpf: 0, lpq: 0, atk: 0, swt: 64, nswd: 0 },
    { lpf: { desc: 'Low-pass filter cutoff.' }, hpf: { desc: 'High-pass filter cutoff.' }, swt: { desc: 'Length of the low-pass sweep set by SWD: low values are snappy, high values long.' }, dec: { desc: 'Length of the decay phase (127 holds).' } }),
  [M.UT_IMPULSE]: MD(M.UT_IMPULSE, 'UT IMPULSE', 'UTIM', ['lev', 'atk', 'dec', null, null, null, null, 'pol'], [null, null, 'atk', 'dec', null, null, 'pol', 'lev'],
    'A single shaped pulse, positive or negative. Into the filter with high resonance it rings like a tuned drum.',
    { lev: 64, atk: 0, dec: 25, pol: 0 }),
  [M.SY_DUAL_VCO]: MD(M.SY_DUAL_VCO, 'SY DUAL VCO', 'SYDV', ['lev', 'tun', 'dec', 'vdet', 'dec2', 'bal', 'bnd', 'cfg'], ['tun', 'vdet', 'dec', 'dec2', 'cfg', 'bnd', 'bal', 'lev'],
    'A two-oscillator synth voice: two waves for oscillator 1, five for oscillator 2, mixed, ring- or frequency-modulated, with separate decays and a pitch bend.',
    { tun: 0, dec: 70, vdet: 0, dec2: 70, bal: 0, bnd: 0, cfg: 16 },
    { tun: { name: 'Osc 1 Tune', desc: 'Pitch of oscillator 1 in semitones.' }, dec: { name: 'Osc 1 Decay', desc: 'Decay of oscillator 1 (127 holds).' }, bal: { name: 'Balance', desc: 'Levels of the two oscillators: at 0 both are full, negative values turn oscillator 2 down, positive values oscillator 1.' } }),
  [M.SY_CHIP]: MD(M.SY_CHIP, 'SY CHIP', 'SYCH', ['lev', 'tun', 'dec', 'of2', 'of3', 'of4', 'cwav', 'cspd'], ['tun', 'cwav', 'cspd', 'dec', 'of2', 'of3', 'of4', 'lev'],
    'A home-computer style chip voice: a fast internal arpeggio over up to four notes fakes a chord; chip waveforms, PWM and pitched noise.',
    { tun: 12, dec: 42, of2: 3, of3: 7, of4: 10, cwav: 2, cspd: 41 },
    { tun: { abbr: 'TUNE', desc: 'Pitch of the oscillator (the root note of the arpeggio) in semitones.' }, dec: { desc: 'Length of the decay phase (127 holds).' } }),
  [M.SY_RAW]: MD(M.SY_RAW, 'SY RAW', 'SYRA', ['lev', 'tun', 'dec', 'rdet', 'nol', 'wav1', 'wav2', 'bal'], ['tun', 'rdet', 'bal', 'dec', 'wav1', 'wav2', 'nol', 'lev'],
    'A raw two-oscillator voice with seven waves for oscillator 1, two for oscillator 2 and a noise layer.',
    { tun: 0, dec: 127, rdet: -12, nol: 15, wav1: 4, wav2: 0, bal: 0 },
    { tun: { abbr: 'TUNE', name: 'Osc 1 Tune', desc: 'Pitch of oscillator 1 in semitones.' }, dec: { abbr: 'DEC2', name: 'Osc 2 Decay', desc: 'Decay of oscillator 2 level (127 holds).' }, nol: { abbr: 'NLEV', name: 'Noise Level', desc: 'Level of the noise.' }, bal: { name: 'Balance', desc: 'Balance between oscillator 1 and oscillator 2.' } }),
  [M.DISABLE]: MD(M.DISABLE, 'DISABLE', 'DISA', [null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null],
    'No machine: the analog sound generator is off and the track only plays its sample layer.'),
};

const DUAL_MACHINES = [M.BD_HARD, M.BD_CLASSIC, M.BD_FM, M.BD_PLASTIC, M.BD_SILKY, M.BD_SHARP, M.BD_ACOUSTIC,
  M.SD_HARD, M.SD_CLASSIC, M.SD_FM, M.SD_NATURAL, M.SD_ACOUSTIC, M.SY_DUAL_VCO, M.SY_CHIP, M.SY_RAW, M.UT_NOISE, M.UT_IMPULSE, M.DISABLE];
const RSCP_MACHINES = [M.BD_HARD, M.BD_CLASSIC, M.BD_FM, M.BD_PLASTIC, M.BD_SILKY, M.BD_SHARP, M.BD_ACOUSTIC,
  M.SD_HARD, M.SD_CLASSIC, M.SD_FM, M.SD_NATURAL, M.SD_ACOUSTIC, M.RS_HARD, M.RS_CLASSIC, M.CP_CLASSIC,
  M.SY_DUAL_VCO, M.SY_CHIP, M.SY_RAW, M.UT_NOISE, M.UT_IMPULSE, M.DISABLE];
const HAT_MACHINES = [M.CH_CLASSIC, M.CH_METALLIC, M.OH_CLASSIC, M.OH_METALLIC, M.HH_BASIC, M.HH_LAB, M.UT_NOISE, M.UT_IMPULSE, M.DISABLE];
const CYM_MACHINES = [M.CY_CLASSIC, M.CY_METALLIC, M.CY_RIDE, M.CB_CLASSIC, M.CB_METALLIC, M.UT_NOISE, M.UT_IMPULSE, M.DISABLE];

// ----------------------------------------------------------------------------
// Tracks and voices
// ----------------------------------------------------------------------------

export interface TrackDef {
  id: string;
  name: string;
  full: string;
  /** Worklet voice 0..7: BD, SD, RS/CP, BT, LT, MT/HT, CH/OH, CY/CB */
  voice: number;
  type: VoiceType;
  machines: number[];
  machine: number;
  /** The track's own defaults for its default machine (the toms are tuned and damped per track) */
  init?: Record<string, number>;
}

export const TRACKS: TrackDef[] = [
  { id: 'bd', name: 'BD', full: 'BASS DRUM', voice: 0, type: 'dual', machines: DUAL_MACHINES, machine: M.BD_HARD },
  { id: 'sd', name: 'SD', full: 'SNARE DRUM', voice: 1, type: 'dual', machines: DUAL_MACHINES, machine: M.SD_HARD },
  { id: 'rs', name: 'RS', full: 'RIM SHOT', voice: 2, type: 'dual', machines: RSCP_MACHINES, machine: M.RS_HARD },
  { id: 'cp', name: 'CP', full: 'HAND CLAP', voice: 2, type: 'dual', machines: RSCP_MACHINES, machine: M.CP_CLASSIC },
  { id: 'bt', name: 'BT', full: 'BASS TOM', voice: 3, type: 'res', machines: [M.BT_CLASSIC, M.UT_NOISE, M.UT_IMPULSE, M.DISABLE], machine: M.BT_CLASSIC },
  { id: 'lt', name: 'LT', full: 'LOW TOM', voice: 4, type: 'res', machines: [M.XT_CLASSIC, M.UT_NOISE, M.UT_IMPULSE, M.DISABLE], machine: M.XT_CLASSIC,
    init: { tun: 34, dec: 52, swd: 36, swt: 34, nod: 5, nol: 85, ton: 0 } },
  { id: 'mt', name: 'MT', full: 'MID TOM', voice: 5, type: 'res', machines: [M.XT_CLASSIC, M.UT_NOISE, M.UT_IMPULSE, M.DISABLE], machine: M.XT_CLASSIC,
    init: { tun: 44, dec: 70, swd: 42, swt: 29, nod: 5, nol: 100, ton: 0 } },
  { id: 'ht', name: 'HT', full: 'HIGH TOM', voice: 5, type: 'res', machines: [M.XT_CLASSIC, M.UT_NOISE, M.UT_IMPULSE, M.DISABLE], machine: M.XT_CLASSIC,
    init: { tun: 50, dec: 89, swd: 50, swt: 27, nod: 5, nol: 100, ton: 0 } },
  { id: 'ch', name: 'CH', full: 'CLOSED HIHAT', voice: 6, type: 'hat', machines: HAT_MACHINES, machine: M.CH_CLASSIC },
  { id: 'oh', name: 'OH', full: 'OPEN HIHAT', voice: 6, type: 'hat', machines: HAT_MACHINES, machine: M.OH_CLASSIC },
  { id: 'cy', name: 'CY', full: 'CYMBAL', voice: 7, type: 'cym', machines: CYM_MACHINES, machine: M.CY_CLASSIC },
  { id: 'cb', name: 'CB', full: 'COWBELL', voice: 7, type: 'cym', machines: CYM_MACHINES, machine: M.CB_CLASSIC },
];

export const TRACK_IDS = TRACKS.map(t => t.id);
export const TRACK_INDEX: Record<string, number> = Object.fromEntries(TRACKS.map((t, i) => [t.id, i]));
export const FX_TRACK = 12;
/** Sequencer tracks: 12 drum tracks + the FX track (lock trigs only) */
export const SEQ_TRACKS = 13;
export const TRACK_OPTIONS = [...TRACKS.map(t => t.name), 'FX'];
/** Pairs on one voice: [left, right] */
export const SHARED_PAIRS: [number, number][] = [[2, 3], [6, 7], [8, 9], [10, 11]];
export const VOICE_NAMES = ['BD', 'SD', 'RS/CP', 'BT', 'LT', 'MT/HT', 'CH/OH', 'CY/CB'];

/** The machine-parameter keys a track has (union of its machines' parameters) */
export function trackParamKeys(t: TrackDef): string[] {
  const keys = new Set<string>();
  t.machines.forEach(m => MACHINES[m].slots.forEach(k => { if (k) keys.add(k); }));
  return PARAMS_BY_TYPE[t.type].map(p => p.key).filter(k => keys.has(k));
}

/**
 * The values a machine starts from on a track: catalogue defaults, then the
 * machine's own defaults, then the track's (the toms) when it is the track's
 * default machine. Selecting a machine on the hardware loads these.
 */
export function soundDefaults(track: number, machine: number): Record<string, number> {
  const t = TRACKS[track];
  const out: Record<string, number> = {};
  for (const k of MACHINES[machine].slots) {
    if (!k) continue;
    const p = PARAM_INDEX[t.type][k];
    if (p) out[k] = p.def;
  }
  Object.assign(out, MACHINES[machine].init ?? {});
  if (machine === t.machine && t.init) Object.assign(out, t.init);
  return out;
}

/** Default value of a track's machine parameter (its default machine's sound) */
export function machineParamDefault(t: TrackDef, key: string): number {
  const p = PARAM_INDEX[t.type][key];
  const d = soundDefaults(TRACK_INDEX[t.id], t.machine)[key];
  return d ?? p?.def ?? 0;
}

// ----------------------------------------------------------------------------
// Pages
// ----------------------------------------------------------------------------

export const PAGES = ['TRIG', 'SRC', 'SMPL', 'FLTR', 'AMP', 'LFO'] as const;
export const PAGE = { TRIG: 0, SRC: 1, SMPL: 2, FLTR: 3, AMP: 4, LFO: 5 } as const;
/** Page titles on the screen (voice track / FX track) */
export const PAGE_TITLES = ['TRIG', 'SYNTH', 'SAMPLE', 'FILTER', 'AMP', 'LFO'];
export const FX_PAGE_TITLES = ['FX TRIG', 'DELAY', 'REVERB', 'DISTORTION', 'COMPRESSOR', 'FX LFO'];

export interface PageParam {
  /** Control id suffix after the track prefix ("flt_frq" -> bd_flt_frq) */
  key: string;
  abbr: string;
  name: string;
  min: number;
  max: number;
  def: number;
  step?: number;
  bipolar?: boolean;
  options?: readonly string[];
  /** Worklet parameter index (track params) */
  idx?: number;
  desc: string;
}

const PP = (key: string, abbr: string, name: string, min: number, max: number, def: number, desc: string, extra: Partial<PageParam> = {}): PageParam =>
  ({ key, abbr, name, min, max, def, desc, ...extra });

// Worklet track-parameter indices (keep in sync with analog-rytm-processors.js)
export const IX = {
  SYN: 0, // 0..7 machine slots in storage order
  SMP_TUN: 8, SMP_FIN: 9, SMP_BR: 10, SMP_SLOT: 11, SMP_STA: 12, SMP_END: 13, SMP_LOP: 14, SMP_LEV: 15,
  FLT_ATK: 16, FLT_DEC: 17, FLT_SUS: 18, FLT_REL: 19, FLT_FRQ: 20, FLT_RES: 21, FLT_TYP: 22, FLT_ENV: 23,
  AMP_ATK: 24, AMP_HLD: 25, AMP_DEC: 26, AMP_OVR: 27, AMP_DEL: 28, AMP_REV: 29, AMP_PAN: 30, AMP_VOL: 31,
  LFO_SPD: 32, LFO_MUL: 33, LFO_FAD: 34, LFO_DST: 35, LFO_WAV: 36, LFO_SPH: 37, LFO_MOD: 38, LFO_DEP: 39,
  TRK_LEV: 40, ACC_LEV: 41, VEL_VOL: 42, TRIG_SYN: 43, TRIG_SMP: 44, TRIG_ENV: 45, TRIG_LFO: 46,
  COUNT: 48,
} as const;

export const FILTER_TYPES = ['LP2', 'LP1', 'BP', 'HP1', 'HP2', 'BS', 'PK'] as const;
export const LFO_WAVES = ['TRI', 'SIN', 'SQR', 'SAW', 'EXP', 'RMP', 'RND'] as const;
export const LFO_MODES = ['FREE', 'TRG', 'HLD', 'ONE', 'HLF'] as const;
/** x1 .. x2k synced to the tempo, then .1 .. .2k fixed to 120 BPM */
export const LFO_MULTS: readonly string[] = [
  'x1', 'x2', 'x4', 'x8', 'x16', 'x32', 'x64', 'x128', 'x256', 'x512', 'x1k', 'x2k',
  '.1', '.2', '.4', '.8', '.16', '.32', '.64', '.128', '.256', '.512', '.1k', '.2k',
];
export const LFO_MULT_VALUES = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048];

/** LFO destinations in the hardware's list order (libanalogrytm ar_sound_lfo_dest_names_ui) */
export interface LfoDest { name: string; abbr: string; idx: number; range: number }
export const LFO_DESTS: LfoDest[] = [
  { name: 'NONE', abbr: '-', idx: -1, range: 0 },
  ...Array.from({ length: 8 }, (_, i) => ({ name: `SYN ${i + 1}`, abbr: `SY${i + 1}`, idx: IX.SYN + i, range: 128 })),
  { name: 'SMP TUN', abbr: 'STUN', idx: IX.SMP_TUN, range: 48 }, { name: 'SMP FIN', abbr: 'SFIN', idx: IX.SMP_FIN, range: 128 },
  { name: 'SMP SLOT', abbr: 'SSMP', idx: IX.SMP_SLOT, range: 16 }, { name: 'SMP BR', abbr: 'SBR', idx: IX.SMP_BR, range: 128 },
  { name: 'SMP STA', abbr: 'SSTA', idx: IX.SMP_STA, range: 120 }, { name: 'SMP END', abbr: 'SEND', idx: IX.SMP_END, range: 120 },
  { name: 'SMP LOP', abbr: 'SLOP', idx: IX.SMP_LOP, range: 2 }, { name: 'SMP LEV', abbr: 'SLEV', idx: IX.SMP_LEV, range: 128 },
  { name: 'FLT ENV', abbr: 'FENV', idx: IX.FLT_ENV, range: 128 }, { name: 'FLT ATK', abbr: 'FATK', idx: IX.FLT_ATK, range: 128 },
  { name: 'FLT DEC', abbr: 'FDEC', idx: IX.FLT_DEC, range: 128 }, { name: 'FLT SUS', abbr: 'FSUS', idx: IX.FLT_SUS, range: 128 },
  { name: 'FLT REL', abbr: 'FREL', idx: IX.FLT_REL, range: 128 }, { name: 'FLT FRQ', abbr: 'FFRQ', idx: IX.FLT_FRQ, range: 128 },
  { name: 'FLT RES', abbr: 'FRES', idx: IX.FLT_RES, range: 128 },
  { name: 'AMP ATK', abbr: 'AATK', idx: IX.AMP_ATK, range: 128 }, { name: 'AMP HLD', abbr: 'AHLD', idx: IX.AMP_HLD, range: 128 },
  { name: 'AMP DEC', abbr: 'ADEC', idx: IX.AMP_DEC, range: 128 }, { name: 'AMP OVR', abbr: 'AOVR', idx: IX.AMP_OVR, range: 128 },
  { name: 'AMP VOL', abbr: 'AVOL', idx: IX.AMP_VOL, range: 128 }, { name: 'AMP PAN', abbr: 'APAN', idx: IX.AMP_PAN, range: 128 },
  { name: 'AMP ACC', abbr: 'AACC', idx: IX.ACC_LEV, range: 128 }, { name: 'AMP DEL', abbr: 'ADEL', idx: IX.AMP_DEL, range: 128 },
  { name: 'AMP REV', abbr: 'AREV', idx: IX.AMP_REV, range: 128 },
];

export const TRIG_PAGE: PageParam[] = [
  PP('trig_note', 'NOT', 'Note', 36, 84, 60, 'Pitch of the trigs, -24 to +24 semitones (C3 = 0 plays the sound at its TUN). SOUND SETTINGS > CHROMATIC sets which part it moves.', { step: 1 }),
  PP('trig_vel', 'VEL', 'Velocity', 1, 127, 100, 'Velocity of the trigs - how hard each hit is played.', { step: 1 }),
  PP('trig_len', 'LEN', 'Length', 0, 127, 14, 'Note length (1/16 = one step). With AMP HLD at 0 the amp holds for this long.', { step: 1 }),
  PP('trig_prob', 'PRB', 'Probability', 0, 100, 100, 'Chance that a trig without a condition plays.', { step: 1 }),
  PP('trig_syn', 'SYN', 'Synth Trig', 0, 1, 1, 'Trigs start the analog machine.', { options: ['OFF', 'ON'], idx: IX.TRIG_SYN }),
  PP('trig_smp', 'SMP', 'Sample Trig', 0, 1, 1, 'Trigs start the sample layer.', { options: ['OFF', 'ON'], idx: IX.TRIG_SMP }),
  PP('trig_env', 'ENV', 'Filter Env Trig', 0, 1, 1, 'Trigs restart the filter envelope.', { options: ['OFF', 'ON'], idx: IX.TRIG_ENV }),
  PP('trig_lfo', 'LFO', 'LFO Trig', 0, 1, 0, 'Trigs restart the LFO (in TRG, HLD, ONE and HLF modes).', { options: ['OFF', 'ON'], idx: IX.TRIG_LFO }),
];

/**
 * TRC (Trig Condition): while a trig is held it takes encoder D's place (PRB) on the TRIG page,
 * and turning it sets that trig's condition (manual p.48). Not stored in the kit.
 */
export const TRIG_COND: PageParam = PP('trig_cond', 'TRC', 'Trig Condition', 0, TRIG_CONDITIONS.length - 1, 0,
  'Condition of the held trig: a probability, FILL / !FILL, PRE / !PRE, NEI / !NEI, 1ST / !1ST, or A:B (play on loop A of every B).', { step: 1 });

export const SMPL_PAGE: PageParam[] = [
  PP('smp_tun', 'TUN', 'Tune', -24, 24, 0, 'Sample pitch in semitones.', { bipolar: true, idx: IX.SMP_TUN, step: 1 }),
  PP('smp_fin', 'FIN', 'Fine Tune', -64, 63, 0, 'Fine tune of the sample: the whole range is one semitone down to one up.', { bipolar: true, idx: IX.SMP_FIN }),
  PP('smp_br', 'BR', 'Bit Reduction', 0, 127, 0, 'Bit reduction: lower resolution adds grit and aliasing.', { idx: IX.SMP_BR }),
  PP('smp_slot', 'SMP', 'Sample Slot', 0, 32, 0, 'Sample layered with the machine (OFF = none). This twin ships synthesized one-shots.', { idx: IX.SMP_SLOT, step: 1 }),
  PP('smp_sta', 'STA', 'Start', 0, 120, 0, 'Sample start point.', { idx: IX.SMP_STA }),
  PP('smp_end', 'END', 'End', 0, 120, 120, 'Sample end point. Below STA the sample plays backwards.', { idx: IX.SMP_END }),
  PP('smp_lop', 'LOP', 'Loop', 0, 1, 0, 'Loop the sample for the length of the trig (within the AMP envelope).', { options: ['OFF', 'ON'], idx: IX.SMP_LOP }),
  PP('smp_lev', 'LEV', 'Level', 0, 127, 100, 'Sample level.', { idx: IX.SMP_LEV }),
];

export const FLTR_PAGE: PageParam[] = [
  PP('flt_atk', 'ATK', 'Attack Time', 0, 127, 0, 'Filter envelope attack time.', { idx: IX.FLT_ATK }),
  PP('flt_dec', 'DEC', 'Decay Time', 0, 127, 64, 'Filter envelope decay time.', { idx: IX.FLT_DEC }),
  PP('flt_sus', 'SUS', 'Sustain Level', 0, 127, 0, 'Filter envelope sustain level, held for the trig length.', { idx: IX.FLT_SUS }),
  PP('flt_rel', 'REL', 'Release Time', 0, 127, 64, 'Filter envelope release time after the trig length.', { idx: IX.FLT_REL }),
  PP('flt_frq', 'FRQ', 'Frequency', 0, 127, 127, 'Cutoff / centre frequency: one semitone a step, 440 Hz at 60.', { idx: IX.FLT_FRQ }),
  PP('flt_res', 'RES', 'Resonance', 0, 127, 0, 'Resonance: a peak at the cutoff that rings at high values. With BS it narrows the notch.', { idx: IX.FLT_RES }),
  PP('flt_typ', 'TYP', 'Type', 0, 6, 0, 'Filter type: 2-pole and 1-pole low-pass, band-pass, 1-pole and 2-pole high-pass, band-stop, peak. All are resonant 2-pole filters; the 1-pole types have a flatter slope.', { options: FILTER_TYPES, idx: IX.FLT_TYP }),
  PP('flt_env', 'ENV', 'Env Depth', -64, 63, 0, 'How far the filter envelope moves the cutoff (two FRQ steps per unit).', { bipolar: true, idx: IX.FLT_ENV }),
];

export const AMP_PAGE: PageParam[] = [
  PP('amp_atk', 'ATK', 'Attack Time', 0, 127, 0, 'Amp attack. A new trig ramps on from the current level.', { idx: IX.AMP_ATK }),
  PP('amp_hld', 'HLD', 'Hold Time', 0, 127, 0, 'Amp hold before the decay. AUTO (0) holds for as long as the pad is pressed or the trig lasts (LEN); 1-127 is a fixed time.', { idx: IX.AMP_HLD }),
  PP('amp_dec', 'DEC', 'Decay Time', 0, 127, 127, 'Amp decay after the hold. 127 = INF: the amp stays open and the machine\'s own decay shapes the sound.', { idx: IX.AMP_DEC }),
  PP('amp_ovr', 'OVR', 'Overdrive', 0, 127, 0, 'Analog overdrive (a gain boost of the amp) before the multimode filter.', { idx: IX.AMP_OVR }),
  PP('amp_del', 'DEL', 'Delay Send', 0, 127, 0, 'Send to the FX track delay.', { idx: IX.AMP_DEL }),
  PP('amp_rev', 'REV', 'Reverb Send', 0, 127, 0, 'Send to the FX track reverb.', { idx: IX.AMP_REV }),
  PP('amp_pan', 'PAN', 'Pan', -64, 63, 0, 'Stereo position.', { bipolar: true, idx: IX.AMP_PAN }),
  PP('amp_vol', 'VOL', 'Volume', 0, 127, 110, 'Volume of the sound, separate from the track level.', { idx: IX.AMP_VOL }),
];

export const LFO_PAGE: PageParam[] = [
  PP('lfo_spd', 'SPD', 'Speed', -64, 63, 48, 'LFO speed: 8, 16 or 32 sync to straight beats (SPD x MUL = 128 is one cycle a bar). Negative runs the wave backwards.', { bipolar: true, idx: IX.LFO_SPD }),
  PP('lfo_mul', 'MUL', 'Multiplier', 0, 23, 4, 'Multiplies SPD: x1 .. x2k follow the tempo, .1 .. .2k run at 120 BPM whatever the tempo.', { options: LFO_MULTS, idx: IX.LFO_MUL }),
  PP('lfo_fad', 'FAD', 'Fade In/Out', -64, 63, 0, 'Fade: negative fades the LFO in after each trig, positive fades it out.', { bipolar: true, idx: IX.LFO_FAD }),
  PP('lfo_dst', 'DST', 'Destination', 0, LFO_DESTS.length - 1, 0, 'What the LFO modulates.', { options: LFO_DESTS.map(d => d.name), idx: IX.LFO_DST }),
  PP('lfo_wav', 'WAV', 'Waveform', 0, 6, 0, 'LFO waveform.', { options: LFO_WAVES, idx: IX.LFO_WAV }),
  PP('lfo_sph', 'SPH', 'Start Phase', 0, 127, 0, 'Where the wave starts when it is trigged (0 = start, 64 = middle). With WAV RND it adds slew instead.', { idx: IX.LFO_SPH }),
  PP('lfo_mod', 'MOD', 'Trig Mode', 0, 4, 0, 'FREE runs on, TRG restarts at each trig, HLD holds the value at the trig, ONE plays one cycle, HLF half a cycle.', { options: LFO_MODES, idx: IX.LFO_MOD }),
  PP('lfo_dep', 'DEP', 'Depth', -128, 127, 0, 'Depth and polarity of the modulation: positive starts towards the crest of the wave, negative towards the trough.', { bipolar: true, idx: IX.LFO_DEP }),
];

export const TRACK_PAGES: Record<number, PageParam[]> = {
  [PAGE.TRIG]: TRIG_PAGE, [PAGE.SMPL]: SMPL_PAGE, [PAGE.FLTR]: FLTR_PAGE, [PAGE.AMP]: AMP_PAGE, [PAGE.LFO]: LFO_PAGE,
};

/** RETRIG menu ([RTRG] held): per track, stored in the kit (manual p.41) */
export const RETRIG_MENU: PageParam[] = [
  PP('rtrg_rate', 'RTRG', 'Retrig Rate', 0, RETRIG_RATES.length - 1, 9, 'Rate of the pad retrig: 1/16 is one hit a step, 1/32 two; 1/12 and 1/24 give triplets.', { options: RETRIG_RATES.map(r => `1/${r}`) }),
  PP('rtrg_len', 'LEN', 'Retrig Length', 0, 127, 14, 'Length of the velocity curve of the pad retrig (1/16 = one step).'),
  PP('rtrg_vcr', 'VCUR', 'Velocity Curve', -128, 127, 0, 'Velocity curve over LEN: -128 fades out completely, 0 is flat, 127 fades in from silence.', { bipolar: true }),
  PP('rtrg_on', 'ON', 'Always On', 0, 1, 0, 'ON: the pad retrigs whenever it is held, without [RTRG].', { options: ['OFF', 'ON'] }),
];

/** Kit-level per-track settings (not on the PARAMETER pages) */
export const TRACK_EXTRA: PageParam[] = [
  PP('trk_lev', 'LEV', 'Track Level', 0, 127, 100, 'Track level (the LEVEL knob).', { idx: IX.TRK_LEV }),
  PP('acc_lev', 'ACC', 'Accent Level', 0, 127, 32, 'How much louder accented trigs play ([FUNC] + [BANK F]).', { idx: IX.ACC_LEV }),
  PP('vel_vol', 'VEL', 'Velocity to Volume', 0, 1, 1, 'Velocity changes the volume (SOUND SETTINGS).', { options: ['OFF', 'ON'], idx: IX.VEL_VOL }),
];

// ----------------------------------------------------------------------------
// FX track (Appendix B: DELAY, REVERB, DISTORTION, COMPRESSOR, FX LFO)
// ----------------------------------------------------------------------------

export const FX = {
  DEL_TIM: 0, DEL_X: 1, DEL_WID: 2, DEL_FDB: 3, DEL_HPF: 4, DEL_LPF: 5, DEL_REV: 6, DEL_VOL: 7,
  REV_PRE: 8, REV_DEC: 9, REV_FRQ: 10, REV_GAI: 11, REV_HPF: 12, REV_LPF: 13, REV_VOL: 14, TRK_LEV: 15,
  DIS_AMT: 16, DIS_SYM: 17, DIS_DOV: 18, DIS_DEL: 19, DIS_REV: 20,
  CMP_THR: 24, CMP_ATK: 25, CMP_REL: 26, CMP_MUP: 27, CMP_RAT: 28, CMP_SEQ: 29, CMP_MIX: 30, CMP_VOL: 31,
  LFO_SPD: 32, LFO_MUL: 33, LFO_FAD: 34, LFO_DST: 35, LFO_WAV: 36, LFO_SPH: 37, LFO_MOD: 38, LFO_DEP: 39,
  COUNT: 40,
} as const;

export const COMP_ATTACKS = ['.03', '.1', '.3', '1', '3', '10', '30'] as const;
export const COMP_RELEASES = ['.1', '.2', '.4', '.6', '1', '2', 'A1', 'A2'] as const;
export const COMP_RATIOS = ['1:2', '1:4', '1:8', 'MAX'] as const;
export const COMP_SEQ = ['OFF', 'LPF', 'HPF', 'HIT'] as const;
export const PRE_POST = ['PRE', 'POST'] as const;

/** FX LFO destinations in the hardware's order (libanalogrytm AR_FX_LFO_DEST_*): delay, reverb, distortion, compressor */
export const FX_LFO_DESTS: LfoDest[] = [
  { name: 'NONE', abbr: '-', idx: -1, range: 0 },
  { name: 'DEL TIM', abbr: 'DTIM', idx: FX.DEL_TIM, range: 128 }, { name: 'DEL X', abbr: 'DX', idx: FX.DEL_X, range: 2 },
  { name: 'DEL WID', abbr: 'DWID', idx: FX.DEL_WID, range: 128 }, { name: 'DEL FDB', abbr: 'DFDB', idx: FX.DEL_FDB, range: 198 },
  { name: 'DEL HPF', abbr: 'DHPF', idx: FX.DEL_HPF, range: 128 }, { name: 'DEL LPF', abbr: 'DLPF', idx: FX.DEL_LPF, range: 128 },
  { name: 'DEL REV', abbr: 'DREV', idx: FX.DEL_REV, range: 128 }, { name: 'DEL VOL', abbr: 'DVOL', idx: FX.DEL_VOL, range: 128 },
  { name: 'DEL DOV', abbr: 'DDOV', idx: FX.DIS_DOV, range: 128 },
  { name: 'REV PRE', abbr: 'RPRE', idx: FX.REV_PRE, range: 128 }, { name: 'REV DEC', abbr: 'RDEC', idx: FX.REV_DEC, range: 128 },
  { name: 'REV FRQ', abbr: 'RFRQ', idx: FX.REV_FRQ, range: 128 }, { name: 'REV GAI', abbr: 'RGAI', idx: FX.REV_GAI, range: 128 },
  { name: 'REV HPF', abbr: 'RHPF', idx: FX.REV_HPF, range: 128 }, { name: 'REV LPF', abbr: 'RLPF', idx: FX.REV_LPF, range: 128 },
  { name: 'REV VOL', abbr: 'RVOL', idx: FX.REV_VOL, range: 128 },
  { name: 'DIS AMT', abbr: 'DAMT', idx: FX.DIS_AMT, range: 128 }, { name: 'DIS SYM', abbr: 'DSYM', idx: FX.DIS_SYM, range: 128 },
  { name: 'CMP THR', abbr: 'CTHR', idx: FX.CMP_THR, range: 128 }, { name: 'CMP ATK', abbr: 'CATK', idx: FX.CMP_ATK, range: 7 },
  { name: 'CMP REL', abbr: 'CREL', idx: FX.CMP_REL, range: 8 }, { name: 'CMP RAT', abbr: 'CRAT', idx: FX.CMP_RAT, range: 4 },
  { name: 'CMP SEQ', abbr: 'CSEQ', idx: FX.CMP_SEQ, range: 4 }, { name: 'CMP MUP', abbr: 'CMUP', idx: FX.CMP_MUP, range: 128 },
  { name: 'CMP MIX', abbr: 'CMIX', idx: FX.CMP_MIX, range: 128 }, { name: 'CMP VOL', abbr: 'CVOL', idx: FX.CMP_VOL, range: 128 },
];

const FXP = (key: string, abbr: string, name: string, min: number, max: number, def: number, idx: number, desc: string, extra: Partial<PageParam> = {}): PageParam =>
  ({ key, abbr, name, min, max, def, idx, desc, ...extra });

/**
 * Kit 01's master section, which is also the FX defaults. A cleared hardware kit has DIST AMT 0
 * and COMP THR 96, MIX 0, VOL 64 (rytm-rs init values): the compressor is bypassed and the output
 * sits 6.4 dB under the mix. Kit 01 is the twin's default kit and plays the demo song, so it gets a
 * calibrated master instead: a little drive into the master clipper, gentle parallel compression
 * keyed to the kick, and VOL for about -18 LUFS at the output with true peaks under -1 dBTP.
 */
export const KIT01_MASTER = { dis_amt: 18, cmp_thr: 116, cmp_atk: 3, cmp_rel: 2, cmp_mup: 16, cmp_rat: 2, cmp_seq: 1, cmp_mix: 50, cmp_vol: 122 } as const;

export const FX_PAGES: Record<number, (PageParam | null)[]> = {
  [PAGE.SRC]: [
    FXP('del_tim', 'TIM', 'Delay Time', 0, 127, 23, FX.DEL_TIM, 'Delay time in 128th notes of the tempo: 32 is one beat (16 = an eighth, 24 = a dotted eighth).'),
    FXP('del_x', 'X', 'Pingpong', 0, 1, 0, FX.DEL_X, 'OFF: WID places the repeats in the stereo field. ON: the repeats alternate left and right, WID sets how far.', { options: ['OFF', 'ON'] }),
    FXP('del_wid', 'WID', 'Stereo Width', -64, 63, 0, FX.DEL_WID, 'Pan width of the delay signal across the stereo field.', { bipolar: true }),
    FXP('del_fdb', 'FDB', 'Feedback', 0, 198, 49, FX.DEL_FDB, 'How much of the delay output feeds back: more repeats; above 127 the delay swells and can get very loud.'),
    FXP('del_hpf', 'HPF', 'HP Filter', 0, 127, 32, FX.DEL_HPF, 'Cutoff of the delay high-pass filter.'),
    FXP('del_lpf', 'LPF', 'LP Filter', 0, 127, 96, FX.DEL_LPF, 'Cutoff of the delay low-pass filter: darker repeats.'),
    FXP('del_rev', 'REV', 'Reverb Send', 0, 127, 0, FX.DEL_REV, 'Sends the delay output to the reverb.'),
    FXP('del_vol', 'VOL', 'Mix Volume', 0, 127, 110, FX.DEL_VOL, 'Volume of the delay output. It returns before or after the distortion and compressor (DIST page, DEL).'),
  ],
  [PAGE.SMPL]: [
    FXP('rev_pre', 'PRE', 'Pre-delay', 0, 127, 8, FX.REV_PRE, 'Pre-delay of the reverb.'),
    FXP('rev_dec', 'DEC', 'Decay', 0, 127, 40, FX.REV_DEC, 'Length of the reverb decay: the size of the space.'),
    FXP('rev_frq', 'FRQ', 'Shelving Freq', 0, 127, 64, FX.REV_FRQ, 'Frequency of the shelving filter that damps the reverb.'),
    FXP('rev_gai', 'GAI', 'Shelving Gain', 0, 127, 32, FX.REV_GAI, 'Damping above the shelving frequency: at 127 the treble stays in, lower values darken the tail.'),
    FXP('rev_hpf', 'HPF', 'HP Filter', 0, 127, 32, FX.REV_HPF, 'Cutoff of the reverb high-pass filter.'),
    FXP('rev_lpf', 'LPF', 'LP Filter', 0, 127, 96, FX.REV_LPF, 'Cutoff of the reverb low-pass filter.'),
    null,
    FXP('rev_vol', 'VOL', 'Mix Volume', 0, 127, 110, FX.REV_VOL, 'Volume of the reverb output. It returns before or after the distortion and compressor (DIST page, REV).'),
  ],
  [PAGE.FLTR]: [
    FXP('dis_amt', 'AMT', 'Distortion Amount', 0, 127, KIT01_MASTER.dis_amt, FX.DIS_AMT, 'Amount of the analog master distortion: it drives the peaks of the whole mix into the clipper.'),
    FXP('dis_sym', 'SYM', 'Distortion Symmetry', -64, 63, 0, FX.DIS_SYM, 'Offsets the signal up or down before the distortion, so only the crests or the troughs clip.', { bipolar: true }),
    FXP('dis_dov', 'DOV', 'Delay Overdrive', 0, 127, 0, FX.DIS_DOV, 'Overdrive inside the delay: from a little edge to aggressive overtones. Works with FDB.'),
    null, null, null,
    FXP('dis_del', 'DEL', 'Delay Dist/Comp', 0, 1, 0, FX.DIS_DEL, 'The delay returns before (PRE) or after (POST) the distortion and compressor.', { options: PRE_POST }),
    FXP('dis_rev', 'REV', 'Reverb Dist/Comp', 0, 1, 1, FX.DIS_REV, 'The reverb returns before (PRE) or after (POST) the distortion and compressor.', { options: PRE_POST }),
  ],
  [PAGE.AMP]: [
    FXP('cmp_thr', 'THR', 'Threshold', 0, 127, KIT01_MASTER.cmp_thr, FX.CMP_THR, 'Threshold: about 1 dB a step; lower means more of the mix is compressed.'),
    FXP('cmp_atk', 'ATK', 'Attack', 0, 6, KIT01_MASTER.cmp_atk, FX.CMP_ATK, 'Attack time in ms: how fast the compressor reacts to peaks. Slow attacks let the transients through.', { options: COMP_ATTACKS }),
    FXP('cmp_rel', 'REL', 'Release', 0, 7, KIT01_MASTER.cmp_rel, FX.CMP_REL, 'Release time in seconds; A1 and A2 adapt to the material (A2 slightly longer).', { options: COMP_RELEASES }),
    FXP('cmp_mup', 'MUP', 'Makeup Gain', 0, 127, KIT01_MASTER.cmp_mup, FX.CMP_MUP, 'Makeup gain of the compressed signal: about 0.6 dB a step up to 48, then up to +40 dB.'),
    FXP('cmp_rat', 'RAT', 'Ratio', 0, 3, KIT01_MASTER.cmp_rat, FX.CMP_RAT, 'Compression ratio (1:2, 1:4, 1:8, MAX): higher ratios compress harder.', { options: COMP_RATIOS }),
    FXP('cmp_seq', 'SEQ', 'Sidechain EQ', 0, 3, KIT01_MASTER.cmp_seq, FX.CMP_SEQ, 'Filter on the detector: LPF reacts to the bass (pumping), HPF ignores it, HIT is balanced, OFF unfiltered.', { options: COMP_SEQ }),
    FXP('cmp_mix', 'MIX', 'Dry/Wet Mix', 0, 127, KIT01_MASTER.cmp_mix, FX.CMP_MIX, 'Parallel compression: 0 is the dry mix, 127 only the compressed signal.'),
    FXP('cmp_vol', 'VOL', 'Volume', 0, 127, KIT01_MASTER.cmp_vol, FX.CMP_VOL, 'Output volume of the compressor section (the whole mix).'),
  ],
  [PAGE.LFO]: [
    FXP('lfo_spd', 'SPD', 'Speed', -64, 63, 48, FX.LFO_SPD, 'FX LFO speed (8, 16, 32 sync to straight beats; negative runs backwards).', { bipolar: true }),
    FXP('lfo_mul', 'MUL', 'Multiplier', 0, 23, 4, FX.LFO_MUL, 'Multiplies SPD: x follows the tempo, . runs at 120 BPM.', { options: LFO_MULTS }),
    FXP('lfo_fad', 'FAD', 'Fade In/Out', -64, 63, 0, FX.LFO_FAD, 'Fade: negative fades the LFO in, positive fades it out.', { bipolar: true }),
    FXP('lfo_dst', 'DST', 'Destination', 0, FX_LFO_DESTS.length - 1, 0, FX.LFO_DST, 'Which FX parameter the LFO modulates.', { options: FX_LFO_DESTS.map(d => d.name) }),
    FXP('lfo_wav', 'WAV', 'Waveform', 0, 6, 0, FX.LFO_WAV, 'FX LFO waveform.', { options: LFO_WAVES }),
    FXP('lfo_sph', 'SPH', 'Start Phase', 0, 127, 0, FX.LFO_SPH, 'Start phase when trigged (RND: slew).'),
    FXP('lfo_mod', 'MOD', 'Trig Mode', 0, 4, 0, FX.LFO_MOD, 'FX LFO trig mode: FX track trigs restart it.', { options: LFO_MODES }),
    FXP('lfo_dep', 'DEP', 'Depth', -128, 127, 0, FX.LFO_DEP, 'FX LFO depth and polarity.', { bipolar: true }),
  ],
};

/** The FX track's level: the master return level of the delay and the reverb (TRACK LEVEL with [FX] selected) */
export const FX_TRACK_LEVEL: PageParam = FXP('trk_lev', 'LEV', 'FX Track Level', 0, 127, 100, FX.TRK_LEV, 'Master return level of the delay and the reverb (the TRACK LEVEL knob with the FX track active).');

/** The FX track's TRIG page: only probability matters (its trigs are lock trigs) */
export const FX_TRIG: (string | null)[] = [null, null, null, 'trig_prob', null, null, null, null];

// ----------------------------------------------------------------------------
// Sample layer: synthesized one-shots (the twin ships no recordings)
// ----------------------------------------------------------------------------

export const SAMPLES: readonly string[] = [
  'OFF', 'KICK ACOU', 'KICK 909', 'KICK SUB', 'SNARE ACOU', 'SNARE RIM', 'SNARE BRSH', 'CLAP ROOM', 'RIM WOOD',
  'HAT TIGHT', 'HAT OPEN', 'RIDE BELL', 'CRASH', 'SHAKER', 'TAMBOURINE', 'CONGA HI', 'CONGA LO', 'BONGO',
  'CLAVE', 'COWBELL', 'WOODBLOCK', 'TRIANGLE', 'VINYL', 'NOISE SWP', 'ZAP', 'BELL FM', 'VOX HA', 'STICKS',
  'GLASS', 'METAL HIT', 'SUB DROP', 'TOM ACOU', 'SNAP',
];

// ----------------------------------------------------------------------------
// Formatting
// ----------------------------------------------------------------------------

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const noteName = (n: number) => `${NOTE_NAMES[((Math.round(n) % 12) + 12) % 12]}${Math.floor(Math.round(n) / 12) - 2}`;
export const signed = (v: number) => (v > 0 ? `+${Math.round(v)}` : `${Math.round(v)}`);
export const filterHz = (v: number) => 440 * Math.pow(2, (v - 60) / 12);
export const hzText = (f: number) => (f >= 1000 ? `${(f / 1000).toFixed(f >= 10000 ? 1 : 2)}k` : `${f.toFixed(f >= 100 ? 0 : 1)}`);
export const panText = (v: number) => (Math.round(v) === 0 ? 'C' : v < 0 ? `L${-Math.round(v)}` : `R${Math.round(v)}`);

/** Readout of a page parameter value (screen and knob) */
export function formatPage(p: PageParam, v: number): string {
  if (p.options) return p.options[Math.round(v)] ?? '';
  switch (p.key) {
    case 'trig_note': return `${noteName(v)} ${signed(v - 60)}`;
    case 'trig_len': case 'rtrg_len': return LEN_TEXT(Math.round(v));
    case 'trig_prob': return `${Math.round(v)}%`;
    case 'trig_cond': return CONDITION_TEXT(v);
    case 'flt_frq': return hzText(filterHz(v));
    case 'amp_pan': return panText(v);
    case 'amp_dec': return v >= 127 ? 'INF' : `${Math.round(v)}`;
    case 'amp_hld': return Math.round(v) <= 0 ? 'AUTO' : `${Math.round(v)}`;
  }
  return p.bipolar ? signed(v) : `${Math.round(v)}`;
}

export function formatMachineParam(p: MParam, v: number): string {
  if (p.options) return p.options[Math.round(v)] ?? '';
  if (p.semis) return signed(v);
  if ((p.key === 'dec' || p.key === 'dec2') && v >= 127) return 'INF';
  return p.bipolar ? signed(v) : `${Math.round(v)}`;
}

/** A machine parameter as it reads on a given machine (labels that differ, e.g. SY RAW DEC2) */
export function machineParam(p: MParam, machine: number | undefined): MParam {
  const o = machine === undefined ? undefined : MACHINES[machine]?.labels?.[p.key];
  return o ? { ...p, abbr: o.abbr ?? p.abbr, name: o.name ?? p.name, desc: o.desc ?? p.desc } : p;
}

export const LEN_TEXT = (i: number) => (i >= NOTE_LENGTHS.length - 1 ? 'INF' : formatLength(i));
export const CONDITION_TEXT = (i: number) => TRIG_CONDITIONS[Math.round(i)] || 'NONE';

// ----------------------------------------------------------------------------
// Control ids
// ----------------------------------------------------------------------------

export const cid = (track: number, key: string) => (track === FX_TRACK ? `fx_${key}` : `${TRACKS[track].id}_${key}`);
export const machineId = (track: number) => `${TRACKS[track].id}_machine`;

/** Parse a control id into its track and key (null for globals) */
export function parseId(id: string): { track: number; key: string } | null {
  const u = id.indexOf('_');
  if (u < 0) return null;
  const pre = id.slice(0, u);
  const key = id.slice(u + 1);
  if (pre === 'fx') return { track: FX_TRACK, key };
  const t = TRACK_INDEX[pre];
  return t === undefined ? null : { track: t, key };
}

/** The machine of `track` given the control values */
export const machineOf = (values: Record<string, unknown>, track: number): number => {
  const t = TRACKS[track];
  const i = Math.round(Number(values[machineId(track)] ?? t.machines.indexOf(t.machine)));
  return t.machines[Math.max(0, Math.min(t.machines.length - 1, Number.isFinite(i) ? i : 0))];
};

/** Control ids under encoders A..H for a track and page (null = unused) */
export function pageControls(track: number, page: number, values: Record<string, unknown>, ui?: Record<string, unknown>): (string | null)[] {
  // a held trig: encoder D on the TRIG page is TRC, the trig's condition (manual p.48)
  const held = page === PAGE.TRIG && Array.isArray(ui?.heldSteps) && (ui!.heldSteps as unknown[]).length > 0;
  if (track === FX_TRACK) {
    if (page === PAGE.TRIG) return FX_TRIG.map((k, i) => (k ? `fx_${held && i === 3 ? TRIG_COND.key : k}` : null));
    return (FX_PAGES[page] ?? []).map(p => (p ? `fx_${p.key}` : null));
  }
  if (page === PAGE.SRC) return MACHINES[machineOf(values, track)].knobs.map(k => (k ? cid(track, k) : null));
  return (TRACK_PAGES[page] ?? []).map((p, i) => cid(track, held && i === 3 ? TRIG_COND.key : p.key));
}

/** Metadata for a control id: a machine parameter or a page parameter */
export function paramMeta(id: string): { kind: 'machine'; p: MParam; track: number } | { kind: 'page'; p: PageParam; track: number } | null {
  const pi = parseId(id);
  if (!pi) return null;
  if (pi.track === FX_TRACK) {
    for (const page of Object.values(FX_PAGES)) for (const p of page) if (p && p.key === pi.key) return { kind: 'page', p, track: pi.track };
    if (pi.key === 'trig_prob') return { kind: 'page', p: TRIG_PAGE[3], track: pi.track };
    if (pi.key === TRIG_COND.key) return { kind: 'page', p: TRIG_COND, track: pi.track };
    if (pi.key === 'trk_lev') return { kind: 'page', p: FX_TRACK_LEVEL, track: pi.track };
    return null;
  }
  const t = TRACKS[pi.track];
  const mp = PARAM_INDEX[t.type][pi.key];
  if (mp) return { kind: 'machine', p: mp, track: pi.track };
  for (const page of [...Object.values(TRACK_PAGES), TRACK_EXTRA, RETRIG_MENU, [TRIG_COND]]) for (const p of page) if (p.key === pi.key) return { kind: 'page', p, track: pi.track };
  return null;
}

/** Screen label + readout for a control id (`machine`: the track's machine, for its own labels) */
export function describe(id: string, v: number, machine?: number): { abbr: string; name: string; text: string } | null {
  const m = paramMeta(id);
  if (!m) return null;
  if (m.kind === 'machine') {
    const p = machineParam(m.p, machine);
    return { abbr: p.abbr, name: p.name, text: formatMachineParam(p, v) };
  }
  return { abbr: m.p.abbr, name: m.p.name, text: formatPage(m.p, v) };
}
