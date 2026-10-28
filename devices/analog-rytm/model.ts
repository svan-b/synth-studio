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
//  - SRC page knob order: TUN on A, DEC on D and LEV on H for every machine;
//    BD HARD reads TUN SWT SNP DEC / WAV HLD TIC LEV (firmware knob table and
//    the manual). Other machines follow that family pattern (likely).
//  - FLTR FRQ is one semitone a step: 440 Hz at 60, 13.8 Hz at 0, 21.1 kHz at
//    127 (measured on hardware, filter-hz mod).
// ============================================================================

import { NOTE_LENGTHS, TRIG_CONDITIONS, formatLength } from '@/lib/sequencer/elektron';

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
] as const;
/** SY CHIP step programs (OS 1.70 list): basic waves, animations, PWM, variants, tables, pulse widths */
export const CHIP_WAVES: readonly string[] = [
  'ASIN0', 'ASIN', 'TRI', 'SSAW', 'SAW', 'SQR', 'NOIS', 'ANM1', 'ANM2', 'ANM3', 'ANM4', 'ANM5', 'PWM+', 'PWM-',
  '.TRI', '+TRI', 'TRI+', 'TRI*', '.SAW', '+SAW', 'SAW+', 'SAW*', '.SQR', '+SQR', 'SQR+', 'SQR*', 'TBL1', 'TBL2', 'TBL3',
  ...Array.from({ length: 99 }, (_, i) => `P${i + 1}%`),
];
/** SY DUAL VCO CFG 0..79: osc 1 wave (Sine, Sinesaw) x mode (+ mix, R ring, F FM, FR) x osc 2 wave x restart */
export const DUAL_CFG: readonly string[] = (() => {
  const w1 = ['SIN', 'SSW'];
  const md = ['+', 'R', 'F', 'FR'];
  const w2 = ['SIN', 'SKW', 'TRI', 'SSW', 'SAW'];
  const out: string[] = [];
  for (const a of w1) for (const m of md) for (const b of w2) { out.push(`${a}${m}${b}-`); out.push(`${a}${m}${b}`); }
  return out;
})();
export const RIDE_TYPES = ['A', 'B', 'C', 'D'] as const;

/** Two-oscillator voices: BD, SD, RS, CP tracks */
const DUAL_PARAMS: MParam[] = [
  U('lev', 'LEV', 'Level', 100, 'Output level of the machine. It is squared on the way to the VCA, so halving it is about -12 dB.'),
  T('tun', 'TUN', 'Tune', 'Pitch in semitones around the machine\'s base note. Trig NOTE and LFO add to it.'),
  U('dec', 'DEC', 'Decay', 50, 'Decay time of the machine\'s own amplitude envelope - how long the drum rings.'),
  U('hld', 'HLD', 'Hold', 10, 'Time the body is held up before the decay starts.'),
  U('swt', 'SWT', 'Sweep Time', 40, 'How fast the pitch sweep falls back to the tuned pitch. Low = a click, high = a long "boom" or a laser.'),
  U('swd', 'SWD', 'Sweep Depth', 64, 'How far above the tuned pitch the sweep starts (the value is squared, so the low half is subtle).'),
  U('snp', 'SNP', 'Snap', 48, 'An immediate, very fast pitch drop at the start of the attack - the hard "snap" of the transient.'),
  P('wav', 'WAV', 'Waveform', 0, 2, 0, 'Oscillator waveform: sine, asymmetric sine or triangle. More harmonics = a harder, buzzier kick.', { options: BD_WAVES }),
  P('wavx', 'WAV', 'Waveform', 0, 11, 0, 'Waveform: sine, asymmetric sine, triangle, sinesaw, saw or square. A versions restart the oscillator on each trig, B versions run free.', { options: SHARP_WAVES }),
  U('tic', 'TIC', 'Tick Level', 40, 'Level of a short digital click at the very start - the beater hitting the skin.'),
  P('tra', 'TRA', 'Transient', 0, 55, 8, 'Picks one of 56 attack transients: combinations of click, noise level and noise colour.'),
  U('fma', 'FMA', 'FM Amount', 40, 'Frequency modulation depth: the modulator adds brighter, more inharmonic partials.'),
  U('fms', 'FMS', 'FM Sweep Time', 30, 'Pitch sweep time of the modulator - moves the FM tone during the attack.'),
  U('fmd', 'FMD', 'FM Decay', 40, 'How fast the FM brightness fades, leaving the plain tone.'),
  T('fmt', 'FMT', 'FM Tune', 'Modulator pitch in semitones. At 0 the modulator sits an octave above the carrier.'),
  P('typ', 'TYP', 'Type', 0, 1, 0, 'Modulation type: A = FM with the ring modulator, B = FM alone.', { options: ['A', 'B'] }),
  U('mod', 'MOD', 'Modulation', 30, 'Amount of modulation from the second oscillator. It does not decay, so it colours the whole hit.'),
  U('dus', 'DUS', 'Dust', 0, 'A noise layer ("dust") that follows the level and fades with the decay.'),
  U('clk', 'CLK', 'Click', 30, 'An analog click from the second oscillator gated by a very fast envelope.'),
  U('imp', 'IMP', 'Impact', 40, 'Level of a recorded-style beater / stick impulse layered over the start.'),
  U('det', 'DET', 'Detune', 56, 'Interval between the two drum-head oscillators (0 = unison, 56 = about a minor seventh).'),
  U('nod', 'NOD', 'Noise Decay', 50, 'Decay of the noise layer - the snare wires.'),
  U('nol', 'NOL', 'Noise Level', 64, 'Level of the noise layer.'),
  B('bal', 'BAL', 'Balance', 'Balance between the two oscillators (0 = equal).'),
  U('nbal', 'BAL', 'Body/Noise Balance', 64, 'Balance between the drum body and the noise.'),
  U('bdy', 'BDY', 'Body Decay', 50, 'Decay of the drum body (the tonal part).'),
  U('lpf', 'LPF', 'Lowpass', 100, 'Low-pass cutoff of the digital noise filter: brightness of the noise.'),
  U('hpf', 'HPF', 'Highpass', 40, 'High-pass cutoff of the digital noise filter: thinness of the noise.'),
  U('nres', 'RES', 'Noise Resonance', 20, 'Resonant peak of the noise filter.'),
  B('sym', 'SYM', 'Symmetry', 'Wave symmetry of the rim oscillators: asymmetry gives the knock of a rim shot.'),
  T('t1', 'T1', 'Tune 1', 'Pitch of the lower oscillator.'),
  T('t2', 'T2', 'Tune 2', 'Pitch of the upper oscillator.'),
  U('ton', 'TON', 'Tone', 64, 'Centre frequency of the band-passed clap noise.'),
  U('num', 'NUM', 'Number', 48, 'Number of hand claps before the tail (0 = one clap).'),
  U('rat', 'RAT', 'Rate', 50, 'Spacing between the individual claps.'),
  U('rnd', 'RND', 'Random', 20, 'Random variation of the clap spacing - more human.'),
  U('cpd', 'CPD', 'Clap Decay', 50, 'Decay of each individual clap.'),
  U('lpq', 'LPQ', 'LP Resonance', 30, 'Resonance of the noise low-pass.'),
  U('atk', 'ATK', 'Attack', 0, 'Attack time of the generator.'),
  B('nswd', 'SWD', 'Sweep Depth', 'Bipolar low-pass sweep at the start of the note.'),
  P('pol', 'POL', 'Polarity', 0, 1, 0, 'Pulse polarity: positive or negative.', { options: ['POS', 'NEG'] }),
  U('dec2', 'DEC2', 'Decay 2', 50, 'Decay of oscillator 2 (127 = hold).'),
  T('vdet', 'DET', 'Detune', 'Interval of oscillator 2 above or below oscillator 1, in semitones.'),
  B('bnd', 'BND', 'Bend', 'A pitch bend that starts at this offset and glides back to the tuned pitch.'),
  P('cfg', 'CFG', 'Oscillator Config', 0, 79, 1, 'Waveform pair and connection: + mix, R ring modulation, F FM, FR both; "-" = free-running oscillators.', { options: DUAL_CFG }),
  T('of2', 'OF2', 'Offset 2', 'Pitch of arpeggio step 2, in semitones.', 24),
  T('of3', 'OF3', 'Offset 3', 'Pitch of arpeggio step 3, in semitones.', 24),
  T('of4', 'OF4', 'Offset 4', 'Pitch of arpeggio step 4, in semitones.', 24),
  P('cwav', 'WAV', 'Waveform', 0, 127, 5, 'Step program: VCO waves, chip pulse waves, PWM sweeps, chip noise.', { options: CHIP_WAVES }),
  P('cspd', 'SPD', 'Speed', 0, 56, 10, 'Arpeggio speed: note values synced to the tempo, then fixed rates in Hz.', { options: CHIP_SPEEDS }),
  T('rdet', 'DET', 'Detune', 'Detune of oscillator 1 against oscillator 2, in semitones.', 24),
  P('wav1', 'WAV1', 'Osc 1 Wave', 0, 6, 0, 'Oscillator 1 waveform.', { options: RAW_WAVES1 }),
  P('wav2', 'WAV2', 'Osc 2 Wave', 0, 3, 0, 'Oscillator 2 waveform.', { options: RAW_WAVES2 }),
];

/** UT NOISE / UT IMPULSE run on every voice */
const UT_KEYS = ['lev', 'lpf', 'hpf', 'lpq', 'atk', 'swt', 'nswd', 'pol', 'dec'];

/** Resonator voices: BT, LT, MT, HT */
const RES_PARAMS: MParam[] = [
  ...DUAL_PARAMS.filter(p => ['lev', 'tun', 'dec', 'swd', 'swt', 'nod', 'nol', 'lpf', 'hpf', 'lpq', 'atk', 'nswd', 'pol'].includes(p.key)),
  P('snp', 'SNP', 'Snap', 0, 3, 1, 'Snap: switches the resonator to a sharper state for a moment after the strike (0 = off, 3 = longest).'),
  B('ton', 'TON', 'Noise Tone', 'Colour of the noise layer. It follows TUN, so the noise stays in tune with the drum.'),
];

/** Hi-hat bank: CH, OH */
const HAT_PARAMS: MParam[] = [
  ...DUAL_PARAMS.filter(p => [...UT_KEYS, 'tun', 'nol', 'nod'].includes(p.key)),
  B('col', 'COL', 'Color', 'Tone of the six-oscillator bank: lower = darker and more metallic, higher = brighter and thinner.'),
  B('ton', 'TON', 'Tone', 'Tone of the bank.'),
  U('trd', 'TRD', 'Transient Decay', 30, 'Length of the initial transient.'),
  P('rst', 'RST', 'Osc Reset', 0, 1, 0, 'Restart the oscillators on every trig, so every hit sounds the same.', { options: ['OFF', 'ON'] }),
  U('osc1', 'OSC1', 'Osc 1', 40, 'Frequency of oscillator 1.'),
  U('osc2', 'OSC2', 'Osc 2', 52, 'Frequency of oscillator 2.'),
  U('osc3', 'OSC3', 'Osc 3', 58, 'Frequency of oscillator 3.'),
  U('osc4', 'OSC4', 'Osc 4', 70, 'Frequency of oscillator 4.'),
  U('osc5', 'OSC5', 'Osc 5', 71, 'Frequency of oscillator 5.'),
  U('osc6', 'OSC6', 'Osc 6', 84, 'Frequency of oscillator 6.'),
];

/** Cymbal / cowbell bank: CY, CB */
const CYM_PARAMS: MParam[] = [
  ...DUAL_PARAMS.filter(p => [...UT_KEYS, 'tun'].includes(p.key)),
  B('col', 'COL', 'Color', 'Tone of the oscillator bank.'),
  B('ton', 'TON', 'Tone', 'Balance between the low and high cymbal bands (or transient and body).'),
  U('trd', 'TRD', 'Transient Decay', 30, 'Decay of the attack transient.'),
  P('typ', 'TYP', 'Cymbal Type', 0, 3, 0, 'Oscillator bank: A = 808 ratios, B = HH BASIC set, C / D = metallic sets.', { options: RIDE_TYPES }),
  U('hit', 'HIT', 'Hit Decay', 30, 'Decay of the hit (attack) band.'),
  U('c1', 'C1', 'Component 1', 90, 'Level of the hit band.'),
  U('c2', 'C2', 'Component 2', 64, 'Level of the second band.'),
  U('c3', 'C3', 'Component 3', 64, 'Level of the third band.'),
  U('cdet', 'DET', 'Detune', 27, 'Interval between the two pulse oscillators (27 = the classic 540 / 800 Hz cowbell).'),
  B('pw1', 'PW1', 'Pulse Width 1', 'Pulse width of oscillator 1: timbre.'),
  B('pw2', 'PW2', 'Pulse Width 2', 'Pulse width of oscillator 2: timbre.'),
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
  /** Parameter values the machine starts from when selected (others keep their value) */
  init?: Record<string, number>;
  desc: string;
}

const MD = (id: number, name: string, short: string, slots: (string | null)[], knobs: (string | null)[], desc: string, init?: Record<string, number>): MachineDef =>
  ({ id, name, short, slots, knobs, desc, init });

export const MACHINES: Record<number, MachineDef> = {
  [M.BD_HARD]: MD(M.BD_HARD, 'BD HARD', 'BDHD', ['lev', 'tun', 'dec', 'hld', 'swt', 'snp', 'wav', 'tic'], ['tun', 'swt', 'snp', 'dec', 'wav', 'hld', 'tic', 'lev'],
    'A hard, punchy kick: one oscillator with a fixed-depth pitch sweep, an extra snap and a hold-then-decay body.'),
  [M.BD_CLASSIC]: MD(M.BD_CLASSIC, 'BD CLASSIC', 'BDCL', ['lev', 'tun', 'dec', 'hld', 'swt', 'swd', 'wav', 'tra'], ['tun', 'swt', 'swd', 'dec', 'wav', 'hld', 'tra', 'lev'],
    'The classic analog kick: a swept oscillator with adjustable sweep depth and a choice of 56 transients.'),
  [M.BD_FM]: MD(M.BD_FM, 'BD FM', 'BDFM', ['lev', 'tun', 'dec', 'fma', 'swt', 'fms', 'fmd', 'fmt'], ['tun', 'swt', 'fms', 'dec', 'fma', 'fmd', 'fmt', 'lev'],
    'Two-operator FM kick: the modulator adds a bright, inharmonic attack that fades with FMD.'),
  [M.BD_PLASTIC]: MD(M.BD_PLASTIC, 'BD PLASTIC', 'BDPL', ['lev', 'tun', 'dec', 'typ', 'mod', 'swt', 'swd', 'tic'], ['tun', 'swt', 'swd', 'dec', 'typ', 'mod', 'tic', 'lev'],
    'Both oscillators at one pitch, the second modulating the first all the way through: a tight, plastic, clicky kick.',
    { swt: 20, swd: 70, dec: 40 }),
  [M.BD_SILKY]: MD(M.BD_SILKY, 'BD SILKY', 'BDSI', ['lev', 'tun', 'dec', 'hld', 'swt', 'swd', 'dus', 'clk'], ['tun', 'swt', 'swd', 'dec', 'dus', 'hld', 'clk', 'lev'],
    'A smooth sine kick with an analog click from the second oscillator and an optional dust (noise) layer.'),
  [M.BD_SHARP]: MD(M.BD_SHARP, 'BD SHARP', 'BDSH', ['lev', 'tun', 'dec', 'hld', 'swt', 'swd', 'wavx', 'tic'], ['tun', 'swt', 'swd', 'dec', 'wavx', 'hld', 'tic', 'lev'],
    'A single oscillator with twelve waveforms (up to saw and square) and a recorded transient: aggressive and sharp.'),
  [M.BD_ACOUSTIC]: MD(M.BD_ACOUSTIC, 'BD ACOUSTIC', 'BDAC', ['lev', 'tun', 'dec', 'hld', 'swt', 'swd', 'wavx', 'imp'], ['tun', 'swt', 'swd', 'dec', 'wavx', 'hld', 'imp', 'lev'],
    'Built like BD SHARP with a beater impulse: an acoustic kick drum.', { swd: 40, swt: 60, imp: 60 }),
  [M.SD_HARD]: MD(M.SD_HARD, 'SD HARD', 'SDHD', ['lev', 'tun', 'dec', 'swd', 'tic', 'nod', 'nol', 'swt'], ['tun', 'swt', 'swd', 'dec', 'tic', 'nod', 'nol', 'lev'],
    'Two swept oscillators a fifth apart plus snare-wire noise: a hard, cracking snare.', { swd: 40, swt: 30, dec: 40 }),
  [M.SD_CLASSIC]: MD(M.SD_CLASSIC, 'SD CLASSIC', 'SDCL', ['lev', 'tun', 'dec', 'det', 'snp', 'nod', 'nol', 'bal'], ['tun', 'det', 'snp', 'dec', 'nod', 'nol', 'bal', 'lev'],
    'The classic analog snare: two drum-head oscillators at an adjustable interval, a fixed snap and wire noise.', { dec: 40 }),
  [M.SD_FM]: MD(M.SD_FM, 'SD FM', 'SDFM', ['lev', 'tun', 'dec', 'fmt', 'fmd', 'nod', 'nol', 'fma'], ['tun', 'fmt', 'fmd', 'dec', 'nod', 'nol', 'fma', 'lev'],
    'An FM snare: carrier and modulator, a short pitch blip and noise.', { dec: 40 }),
  [M.SD_NATURAL]: MD(M.SD_NATURAL, 'SD NATURAL', 'SDNA', ['lev', 'tun', 'bdy', 'dec', 'nbal', 'lpf', 'hpf', 'nres'], ['tun', 'bdy', 'nbal', 'dec', 'lpf', 'hpf', 'nres', 'lev'],
    'One oscillator for the shell and noise with its own filter (LPF, HPF, RES) for the wires: a natural snare.', { dec: 50 }),
  [M.SD_ACOUSTIC]: MD(M.SD_ACOUSTIC, 'SD ACOUSTIC', 'SDAC', ['lev', 'tun', 'bdy', 'nod', 'nol', 'hld', 'swd', 'imp'], ['tun', 'hld', 'swd', 'bdy', 'nod', 'nol', 'imp', 'lev'],
    'Two oscillators a fifth apart, wire noise and a stick impulse: an acoustic snare.', { hld: 4, swd: 30 }),
  [M.RS_HARD]: MD(M.RS_HARD, 'RS HARD', 'RSHD', ['lev', 'tun', 'dec', 'swd', 'tic', 'nol', 'sym', 'swt'], ['tun', 'swt', 'swd', 'dec', 'sym', 'nol', 'tic', 'lev'],
    'Two oscillators at the inharmonic rim-shot ratio (about 3.7:1) with a pitch sweep.', { dec: 30, swd: 20, swt: 10 }),
  [M.RS_CLASSIC]: MD(M.RS_CLASSIC, 'RS CLASSIC', 'RSCL', ['lev', 't1', 'dec', 'bal', 't2', 'sym', 'nol', 'tic'], ['t1', 't2', 'bal', 'dec', 'sym', 'nol', 'tic', 'lev'],
    'Two independently tuned oscillators with symmetry shaping: the classic analog rim shot.', { dec: 30 }),
  [M.CP_CLASSIC]: MD(M.CP_CLASSIC, 'CP CLASSIC', 'CPCL', ['lev', 'ton', 'nod', 'num', 'rat', 'nol', 'rnd', 'cpd'], ['ton', 'num', 'rat', 'nod', 'nol', 'rnd', 'cpd', 'lev'],
    'Hand clap: bursts of filtered noise followed by a reverberant tail.'),
  [M.BT_CLASSIC]: MD(M.BT_CLASSIC, 'BT CLASSIC', 'BTCL', ['lev', 'tun', 'dec', null, 'nol', 'snp', 'swd', null], ['tun', 'swd', 'snp', 'dec', 'nol', null, null, 'lev'],
    'Bass tom: a tuned resonator struck by a pulse, with snap, pitch sweep and a noise layer.', { swd: 30, nol: 20, dec: 60 }),
  [M.XT_CLASSIC]: MD(M.XT_CLASSIC, 'XT CLASSIC', 'XTCL', ['lev', 'tun', 'dec', 'swd', 'swt', 'nod', 'nol', 'ton'], ['tun', 'swt', 'swd', 'dec', 'nod', 'nol', 'ton', 'lev'],
    'Analog tom: a tuned resonator with pitch sweep and a noise layer tuned with the drum.', { swd: 40, swt: 60, nol: 20, nod: 30, dec: 60 }),
  [M.CH_CLASSIC]: MD(M.CH_CLASSIC, 'CH CLASSIC', 'CHCL', ['lev', 'tun', 'dec', 'col', null, null, null, null], ['tun', 'col', null, 'dec', null, null, null, 'lev'],
    'Closed hat: six square oscillators at the TR-808 ratios through the metal path, a quick drop then DEC.', { dec: 30 }),
  [M.OH_CLASSIC]: MD(M.OH_CLASSIC, 'OH CLASSIC', 'OHCL', ['lev', 'tun', 'dec', 'col', null, null, null, null], ['tun', 'col', null, 'dec', null, null, null, 'lev'],
    'Open hat: the same 808-ratio bank through the long path.', { dec: 60 }),
  [M.CH_METALLIC]: MD(M.CH_METALLIC, 'CH METALLIC', 'CHMT', ['lev', 'tun', 'dec', null, null, null, null, null], ['tun', null, null, 'dec', null, null, null, 'lev'],
    'Closed hat from a wider, more inharmonic oscillator set: harder and more metallic.', { dec: 30 }),
  [M.OH_METALLIC]: MD(M.OH_METALLIC, 'OH METALLIC', 'OHMT', ['lev', 'tun', 'dec', null, null, null, null, null], ['tun', null, null, 'dec', null, null, null, 'lev'],
    'Open hat from the metallic set, with a fixed opening segment before DEC.', { dec: 60 }),
  [M.HH_BASIC]: MD(M.HH_BASIC, 'HH BASIC', 'HHBA', ['lev', 'tun', 'dec', 'ton', 'trd', 'rst', 'nol', 'nod'], ['tun', 'ton', 'trd', 'dec', 'rst', 'nol', 'nod', 'lev'],
    'A basic hat: its own oscillator set with transient decay, tone, oscillator reset and a noise layer.', { dec: 30 }),
  [M.HH_LAB]: MD(M.HH_LAB, 'HH LAB', 'HHLA', ['lev', 'osc1', 'dec', 'osc2', 'osc3', 'osc4', 'osc5', 'osc6'], ['osc1', 'osc2', 'osc3', 'dec', 'osc4', 'osc5', 'osc6', 'lev'],
    'A hat lab: set the frequency of each of the six oscillators yourself.', { dec: 30 }),
  [M.CY_CLASSIC]: MD(M.CY_CLASSIC, 'CY CLASSIC', 'CYCL', ['lev', 'tun', 'dec', 'col', 'ton', null, null, null], ['tun', 'col', 'ton', 'dec', null, null, null, 'lev'],
    'Cymbal: the 808-ratio bank through three bands; two decay quickly, DEC sets the long tail.', { dec: 70 }),
  [M.CY_METALLIC]: MD(M.CY_METALLIC, 'CY METALLIC', 'CYMT', ['lev', 'tun', 'dec', 'ton', 'trd', null, null, null], ['tun', 'ton', 'trd', 'dec', null, null, null, 'lev'],
    'A metallic cymbal: an attack transient and a body, balanced with TON.', { dec: 70 }),
  [M.CY_RIDE]: MD(M.CY_RIDE, 'CY RIDE', 'CYRD', ['lev', 'tun', 'dec', 'typ', 'hit', 'c1', 'c2', 'c3'], ['tun', 'typ', 'hit', 'dec', 'c1', 'c2', 'c3', 'lev'],
    'Ride cymbal: four oscillator banks and three separately set bands (hit, body, tail).', { dec: 70 }),
  [M.CB_CLASSIC]: MD(M.CB_CLASSIC, 'CB CLASSIC', 'CBCL', ['lev', 'tun', 'dec', 'cdet', 'pw1', 'pw2', null, null], ['tun', 'cdet', null, 'dec', 'pw1', 'pw2', null, 'lev'],
    'Cowbell: two pulse oscillators (540 and 800 Hz at the defaults) with a two-stage envelope, like the TR-808.', { dec: 45 }),
  [M.CB_METALLIC]: MD(M.CB_METALLIC, 'CB METALLIC', 'CBMT', ['lev', 'tun', 'dec', 'cdet', 'pw1', 'pw2', null, null], ['tun', 'cdet', null, 'dec', 'pw1', 'pw2', null, 'lev'],
    'A metallic cowbell: the pulse pair through a brighter path, DET in whole semitones.', { dec: 45, cdet: 7 }),
  [M.UT_NOISE]: MD(M.UT_NOISE, 'UT NOISE', 'UTNO', ['lev', 'lpf', 'dec', 'hpf', 'lpq', 'atk', 'swt', 'nswd'], ['lpf', 'hpf', 'lpq', 'dec', 'atk', 'swt', 'nswd', 'lev'],
    'Utility noise: white noise through a digital low-pass / high-pass with an attack-decay envelope and a cutoff sweep.', { dec: 40 }),
  [M.UT_IMPULSE]: MD(M.UT_IMPULSE, 'UT IMPULSE', 'UTIM', ['lev', 'atk', 'dec', null, null, null, null, 'pol'], ['atk', null, null, 'dec', 'pol', null, null, 'lev'],
    'A single shaped pulse. Into the filter with high resonance it makes the filter ring like a tuned drum.', { dec: 20, atk: 0 }),
  [M.SY_DUAL_VCO]: MD(M.SY_DUAL_VCO, 'SY DUAL VCO', 'SYDV', ['lev', 'tun', 'dec', 'vdet', 'dec2', 'bal', 'bnd', 'cfg'], ['tun', 'vdet', 'bnd', 'dec', 'dec2', 'bal', 'cfg', 'lev'],
    'A general two-oscillator synth voice: 80 waveform / ring / FM configurations, independent decays and a pitch bend.', { dec: 70, dec2: 70 }),
  [M.SY_CHIP]: MD(M.SY_CHIP, 'SY CHIP', 'SYCH', ['lev', 'tun', 'dec', 'of2', 'of3', 'of4', 'cwav', 'cspd'], ['tun', 'cwav', 'cspd', 'dec', 'of2', 'of3', 'of4', 'lev'],
    'An 8-bit style arpeggiator: four pitch steps with chip waveforms, PWM and periodic noise.', { dec: 60, of2: 12, of3: 7, of4: 3 }),
  [M.SY_RAW]: MD(M.SY_RAW, 'SY RAW', 'SYRA', ['lev', 'tun', 'dec', 'rdet', 'nol', 'wav1', 'wav2', 'bal'], ['tun', 'rdet', 'bal', 'dec', 'wav1', 'wav2', 'nol', 'lev'],
    'A raw two-oscillator voice with independent waveforms and a noise layer.', { dec: 60, nol: 0 }),
  [M.DISABLE]: MD(M.DISABLE, 'DISABLE', 'DISA', [null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null],
    'No machine: the track only plays its sample layer.'),
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
  /** Default TUN of the default sound (toms are spread across the kit) */
  tune?: number;
}

export const TRACKS: TrackDef[] = [
  { id: 'bd', name: 'BD', full: 'BASS DRUM', voice: 0, type: 'dual', machines: DUAL_MACHINES, machine: M.BD_HARD },
  { id: 'sd', name: 'SD', full: 'SNARE DRUM', voice: 1, type: 'dual', machines: DUAL_MACHINES, machine: M.SD_HARD },
  { id: 'rs', name: 'RS', full: 'RIM SHOT', voice: 2, type: 'dual', machines: RSCP_MACHINES, machine: M.RS_HARD },
  { id: 'cp', name: 'CP', full: 'HAND CLAP', voice: 2, type: 'dual', machines: RSCP_MACHINES, machine: M.CP_CLASSIC },
  { id: 'bt', name: 'BT', full: 'BASS TOM', voice: 3, type: 'res', machines: [M.BT_CLASSIC, M.UT_NOISE, M.UT_IMPULSE, M.DISABLE], machine: M.BT_CLASSIC },
  { id: 'lt', name: 'LT', full: 'LOW TOM', voice: 4, type: 'res', machines: [M.XT_CLASSIC, M.UT_NOISE, M.UT_IMPULSE, M.DISABLE], machine: M.XT_CLASSIC },
  { id: 'mt', name: 'MT', full: 'MID TOM', voice: 5, type: 'res', machines: [M.XT_CLASSIC, M.UT_NOISE, M.UT_IMPULSE, M.DISABLE], machine: M.XT_CLASSIC },
  { id: 'ht', name: 'HT', full: 'HIGH TOM', voice: 5, type: 'res', machines: [M.XT_CLASSIC, M.UT_NOISE, M.UT_IMPULSE, M.DISABLE], machine: M.XT_CLASSIC, tune: 5 },
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

/** Default value of a track's machine parameter (machine init values for the default machine) */
export function machineParamDefault(t: TrackDef, key: string): number {
  const p = PARAM_INDEX[t.type][key];
  const init = MACHINES[t.machine].init?.[key];
  if (key === 'tun' && t.tune !== undefined) return t.tune;
  return init ?? p?.def ?? 0;
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
  PP('trig_note', 'NOT', 'Note', 36, 84, 60, 'Note of the trigs: 60 (C3) plays the sound at its TUN; every step up is a semitone.', { step: 1 }),
  PP('trig_vel', 'VEL', 'Velocity', 1, 127, 100, 'Velocity of the trigs - how hard each hit is played.', { step: 1 }),
  PP('trig_len', 'LEN', 'Length', 0, 127, 14, 'Note length (1/16 = one step). With AMP HLD at 0 the amp holds for this long.', { step: 1 }),
  PP('trig_prob', 'PRB', 'Probability', 0, 100, 100, 'Chance that a trig without a condition plays.', { step: 1 }),
  PP('trig_syn', 'SYN', 'Synth Trig', 0, 1, 1, 'Trigs start the analog machine.', { options: ['OFF', 'ON'], idx: IX.TRIG_SYN }),
  PP('trig_smp', 'SMP', 'Sample Trig', 0, 1, 1, 'Trigs start the sample layer.', { options: ['OFF', 'ON'], idx: IX.TRIG_SMP }),
  PP('trig_env', 'ENV', 'Filter Env Trig', 0, 1, 1, 'Trigs restart the filter envelope.', { options: ['OFF', 'ON'], idx: IX.TRIG_ENV }),
  PP('trig_lfo', 'LFO', 'LFO Trig', 0, 1, 1, 'Trigs restart the LFO (in TRG, HLD, ONE and HLF modes).', { options: ['OFF', 'ON'], idx: IX.TRIG_LFO }),
];

export const SMPL_PAGE: PageParam[] = [
  PP('smp_tun', 'TUN', 'Tune', -24, 24, 0, 'Sample pitch in semitones.', { bipolar: true, idx: IX.SMP_TUN, step: 1 }),
  PP('smp_fin', 'FIN', 'Fine Tune', -64, 63, 0, 'Fine tune of the sample (cents).', { bipolar: true, idx: IX.SMP_FIN }),
  PP('smp_br', 'BR', 'Bit Reduction', 0, 127, 0, 'Bit reduction: lower resolution adds grit and aliasing.', { idx: IX.SMP_BR }),
  PP('smp_slot', 'SMP', 'Sample Slot', 0, 32, 0, 'Sample layered with the machine (OFF = none). This twin ships synthesized one-shots.', { idx: IX.SMP_SLOT, step: 1 }),
  PP('smp_sta', 'STA', 'Start', 0, 120, 0, 'Sample start point.', { idx: IX.SMP_STA }),
  PP('smp_end', 'END', 'End', 0, 120, 120, 'Sample end point.', { idx: IX.SMP_END }),
  PP('smp_lop', 'LOP', 'Loop', 0, 1, 0, 'Loop the sample between start and end.', { options: ['OFF', 'ON'], idx: IX.SMP_LOP }),
  PP('smp_lev', 'LEV', 'Level', 0, 127, 100, 'Sample level.', { idx: IX.SMP_LEV }),
];

export const FLTR_PAGE: PageParam[] = [
  PP('flt_atk', 'ATK', 'Attack Time', 0, 127, 0, 'Filter envelope attack time.', { idx: IX.FLT_ATK }),
  PP('flt_dec', 'DEC', 'Decay Time', 0, 127, 64, 'Filter envelope decay time.', { idx: IX.FLT_DEC }),
  PP('flt_sus', 'SUS', 'Sustain Level', 0, 127, 0, 'Filter envelope sustain level, held for the trig length.', { idx: IX.FLT_SUS }),
  PP('flt_rel', 'REL', 'Release Time', 0, 127, 64, 'Filter envelope release time after the trig length.', { idx: IX.FLT_REL }),
  PP('flt_frq', 'FRQ', 'Frequency', 0, 127, 127, 'Cutoff / centre frequency: one semitone a step, 440 Hz at 60.', { idx: IX.FLT_FRQ }),
  PP('flt_res', 'RES', 'Resonance', 0, 127, 0, 'Resonance: boosts the frequencies at the cutoff, ringing at high values.', { idx: IX.FLT_RES }),
  PP('flt_typ', 'TYP', 'Type', 0, 6, 0, 'Filter type: 2- and 1-pole low-pass, band-pass, 1- and 2-pole high-pass, band-stop, peak.', { options: FILTER_TYPES, idx: IX.FLT_TYP }),
  PP('flt_env', 'ENV', 'Env Depth', -64, 63, 0, 'How far the filter envelope moves the cutoff (two FRQ steps per unit).', { bipolar: true, idx: IX.FLT_ENV }),
];

export const AMP_PAGE: PageParam[] = [
  PP('amp_atk', 'ATK', 'Attack Time', 0, 127, 0, 'Amp attack. A new trig ramps on from the current level.', { idx: IX.AMP_ATK }),
  PP('amp_hld', 'HLD', 'Hold Time', 0, 127, 0, 'Amp hold. 0 = hold for the trig length (LEN), then decay.', { idx: IX.AMP_HLD }),
  PP('amp_dec', 'DEC', 'Decay Time', 0, 127, 127, 'Amp decay after the hold. 127 = INF: the amp stays open and the machine\'s own decay shapes the sound.', { idx: IX.AMP_DEC }),
  PP('amp_ovr', 'OVR', 'Overdrive', 0, 127, 0, 'Analog overdrive before the filter.', { idx: IX.AMP_OVR }),
  PP('amp_del', 'DEL', 'Delay Send', 0, 127, 0, 'Send to the FX track delay.', { idx: IX.AMP_DEL }),
  PP('amp_rev', 'REV', 'Reverb Send', 0, 127, 0, 'Send to the FX track reverb.', { idx: IX.AMP_REV }),
  PP('amp_pan', 'PAN', 'Pan', -64, 63, 0, 'Stereo position.', { bipolar: true, idx: IX.AMP_PAN }),
  PP('amp_vol', 'VOL', 'Volume', 0, 127, 100, 'Sound volume.', { idx: IX.AMP_VOL }),
];

export const LFO_PAGE: PageParam[] = [
  PP('lfo_spd', 'SPD', 'Speed', -64, 63, 16, 'LFO speed. With MUL, SPD x MUL = 128 is one cycle per bar. Negative runs the wave backwards.', { bipolar: true, idx: IX.LFO_SPD }),
  PP('lfo_mul', 'MUL', 'Multiplier', 0, 23, 3, 'Speed multiplier: x1 .. x2k follow the tempo, .1 .. .2k are fixed (120 BPM).', { options: LFO_MULTS, idx: IX.LFO_MUL }),
  PP('lfo_fad', 'FAD', 'Fade In/Out', -64, 63, 0, 'Fade: negative fades the LFO in after each trig, positive fades it out.', { bipolar: true, idx: IX.LFO_FAD }),
  PP('lfo_dst', 'DST', 'Destination', 0, LFO_DESTS.length - 1, 0, 'What the LFO modulates.', { options: LFO_DESTS.map(d => d.name), idx: IX.LFO_DST }),
  PP('lfo_wav', 'WAV', 'Waveform', 0, 6, 0, 'LFO waveform.', { options: LFO_WAVES, idx: IX.LFO_WAV }),
  PP('lfo_sph', 'SPH', 'Start Phase', 0, 127, 0, 'Where the wave starts after a trig (TRG, HLD, ONE, HLF).', { idx: IX.LFO_SPH }),
  PP('lfo_mod', 'MOD', 'Trig Mode', 0, 4, 0, 'FREE runs on, TRG restarts at each trig, HLD holds the value at the trig, ONE plays one cycle, HLF half a cycle.', { options: LFO_MODES, idx: IX.LFO_MOD }),
  PP('lfo_dep', 'DEP', 'Depth', -64, 63, 0, 'Modulation depth (bipolar).', { bipolar: true, idx: IX.LFO_DEP }),
];

export const TRACK_PAGES: Record<number, PageParam[]> = {
  [PAGE.TRIG]: TRIG_PAGE, [PAGE.SMPL]: SMPL_PAGE, [PAGE.FLTR]: FLTR_PAGE, [PAGE.AMP]: AMP_PAGE, [PAGE.LFO]: LFO_PAGE,
};

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
  REV_PRE: 8, REV_DEC: 9, REV_FRQ: 10, REV_GAI: 11, REV_HPF: 12, REV_LPF: 13, REV_VOL: 14,
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

/** FX LFO destinations: the delay (voice worklet) and the distortion / compressor (master worklet) */
export const FX_LFO_DESTS: LfoDest[] = [
  { name: 'NONE', abbr: '-', idx: -1, range: 0 },
  { name: 'DEL TIM', abbr: 'DTIM', idx: FX.DEL_TIM, range: 128 }, { name: 'DEL WID', abbr: 'DWID', idx: FX.DEL_WID, range: 128 },
  { name: 'DEL FDB', abbr: 'DFDB', idx: FX.DEL_FDB, range: 198 }, { name: 'DEL HPF', abbr: 'DHPF', idx: FX.DEL_HPF, range: 128 },
  { name: 'DEL LPF', abbr: 'DLPF', idx: FX.DEL_LPF, range: 128 }, { name: 'DEL REV', abbr: 'DREV', idx: FX.DEL_REV, range: 128 },
  { name: 'DEL VOL', abbr: 'DVOL', idx: FX.DEL_VOL, range: 128 },
  { name: 'DIS AMT', abbr: 'DAMT', idx: FX.DIS_AMT, range: 128 }, { name: 'DIS SYM', abbr: 'DSYM', idx: FX.DIS_SYM, range: 128 },
  { name: 'DIS DOV', abbr: 'DDOV', idx: FX.DIS_DOV, range: 128 },
  { name: 'CMP THR', abbr: 'CTHR', idx: FX.CMP_THR, range: 128 }, { name: 'CMP MUP', abbr: 'CMUP', idx: FX.CMP_MUP, range: 128 },
  { name: 'CMP MIX', abbr: 'CMIX', idx: FX.CMP_MIX, range: 128 }, { name: 'CMP VOL', abbr: 'CVOL', idx: FX.CMP_VOL, range: 128 },
];

const FXP = (key: string, abbr: string, name: string, min: number, max: number, def: number, idx: number, desc: string, extra: Partial<PageParam> = {}): PageParam =>
  ({ key, abbr, name, min, max, def, idx, desc, ...extra });

export const FX_PAGES: Record<number, (PageParam | null)[]> = {
  [PAGE.SRC]: [
    FXP('del_tim', 'TIM', 'Delay Time', 0, 127, 23, FX.DEL_TIM, 'Delay time in 128th notes (16 = 1/8, 24 = dotted 1/8, 32 = 1/4).'),
    FXP('del_x', 'X', 'Ping-pong', 0, 1, 0, FX.DEL_X, 'Ping-pong: repeats bounce between left and right.', { options: ['OFF', 'ON'] }),
    FXP('del_wid', 'WID', 'Stereo Width', -64, 63, 63, FX.DEL_WID, 'Stereo width of the repeats.', { bipolar: true }),
    FXP('del_fdb', 'FDB', 'Feedback', 0, 198, 49, FX.DEL_FDB, 'Feedback: how many repeats. Above 127 the delay feeds itself and builds up.'),
    FXP('del_hpf', 'HPF', 'Highpass', 0, 127, 0, FX.DEL_HPF, 'High-pass filter in the delay loop.'),
    FXP('del_lpf', 'LPF', 'Lowpass', 0, 127, 127, FX.DEL_LPF, 'Low-pass filter in the delay loop: darker repeats.'),
    FXP('del_rev', 'REV', 'Reverb Send', 0, 127, 0, FX.DEL_REV, 'Sends the delay into the reverb.'),
    FXP('del_vol', 'VOL', 'Mix Volume', 0, 127, 127, FX.DEL_VOL, 'Delay return level.'),
  ],
  [PAGE.SMPL]: [
    FXP('rev_pre', 'PRE', 'Pre-delay', 0, 127, 8, FX.REV_PRE, 'Time before the reverb starts.'),
    FXP('rev_dec', 'DEC', 'Decay Time', 0, 127, 64, FX.REV_DEC, 'Reverb decay time (room size).'),
    FXP('rev_frq', 'FRQ', 'Shelving Freq', 0, 127, 64, FX.REV_FRQ, 'Frequency of the shelving filter in the reverb.'),
    FXP('rev_gai', 'GAI', 'Shelving Gain', 0, 127, 96, FX.REV_GAI, 'Gain of the shelving filter: lower = a darker tail.'),
    FXP('rev_hpf', 'HPF', 'Highpass', 0, 127, 32, FX.REV_HPF, 'High-pass filter on the reverb input.'),
    FXP('rev_lpf', 'LPF', 'Lowpass', 0, 127, 96, FX.REV_LPF, 'Low-pass filter on the reverb input.'),
    null,
    FXP('rev_vol', 'VOL', 'Mix Volume', 0, 127, 100, FX.REV_VOL, 'Reverb return level.'),
  ],
  [PAGE.FLTR]: [
    FXP('dis_amt', 'AMT', 'Amount', 0, 127, 0, FX.DIS_AMT, 'Amount of analog master distortion.'),
    FXP('dis_sym', 'SYM', 'Symmetry', -64, 63, 0, FX.DIS_SYM, 'Shifts the signal before distortion: asymmetric clipping adds even harmonics.', { bipolar: true }),
    FXP('dis_dov', 'DOV', 'Delay Overdrive', 0, 127, 0, FX.DIS_DOV, 'Overdrive inside the delay: warm, dirty repeats. Works with FDB.'),
    null,
    FXP('dis_del', 'DEL', 'Delay Dist/Comp', 0, 1, 0, FX.DIS_DEL, 'Delay returns before (PRE) or after (POST) the distortion and compressor.', { options: PRE_POST }),
    FXP('dis_rev', 'REV', 'Reverb Dist/Comp', 0, 1, 1, FX.DIS_REV, 'Reverb returns before (PRE) or after (POST) the distortion and compressor.', { options: PRE_POST }),
    null, null,
  ],
  [PAGE.AMP]: [
    FXP('cmp_thr', 'THR', 'Threshold', 0, 127, 105, FX.CMP_THR, 'Level above which the compressor works: about 0.9 dB a step, no reduction from 105 up.'),
    FXP('cmp_atk', 'ATK', 'Attack', 0, 6, 1, FX.CMP_ATK, 'Attack in ms: fast attacks catch transients, slower ones let the punch through.', { options: COMP_ATTACKS }),
    FXP('cmp_rel', 'REL', 'Release', 0, 7, 1, FX.CMP_REL, 'Release in seconds (A1 / A2 = auto).', { options: COMP_RELEASES }),
    FXP('cmp_mup', 'MUP', 'Makeup Gain', 0, 127, 47, FX.CMP_MUP, 'Make-up gain after compression (47 = unity).'),
    FXP('cmp_rat', 'RAT', 'Ratio', 0, 3, 0, FX.CMP_RAT, 'Ratio: how strongly level above the threshold is reduced.', { options: COMP_RATIOS }),
    FXP('cmp_seq', 'SEQ', 'Sidechain EQ', 0, 3, 1, FX.CMP_SEQ, 'Filter on the detector: LPF reacts to the kick, HPF ignores it, HIT to the transients.', { options: COMP_SEQ }),
    FXP('cmp_mix', 'MIX', 'Dry/Wet Mix', 0, 127, 127, FX.CMP_MIX, 'Parallel compression: blend of the dry and compressed signal.'),
    FXP('cmp_vol', 'VOL', 'Output Volume', 0, 127, 127, FX.CMP_VOL, 'Output level after the compressor.'),
  ],
  [PAGE.LFO]: [
    FXP('lfo_spd', 'SPD', 'Speed', -64, 63, 16, FX.LFO_SPD, 'FX LFO speed.', { bipolar: true }),
    FXP('lfo_mul', 'MUL', 'Multiplier', 0, 23, 3, FX.LFO_MUL, 'FX LFO speed multiplier.', { options: LFO_MULTS }),
    FXP('lfo_fad', 'FAD', 'Fade In/Out', -64, 63, 0, FX.LFO_FAD, 'FX LFO fade.', { bipolar: true }),
    FXP('lfo_dst', 'DST', 'Destination', 0, FX_LFO_DESTS.length - 1, 0, FX.LFO_DST, 'What the FX LFO modulates.', { options: FX_LFO_DESTS.map(d => d.name) }),
    FXP('lfo_wav', 'WAV', 'Waveform', 0, 6, 0, FX.LFO_WAV, 'FX LFO waveform.', { options: LFO_WAVES }),
    FXP('lfo_sph', 'SPH', 'Start Phase', 0, 127, 0, FX.LFO_SPH, 'FX LFO start phase.'),
    FXP('lfo_mod', 'MOD', 'Trig Mode', 0, 4, 0, FX.LFO_MOD, 'FX LFO trig mode (FX track lock trigs restart it).', { options: LFO_MODES }),
    FXP('lfo_dep', 'DEP', 'Depth', -64, 63, 0, FX.LFO_DEP, 'FX LFO depth.', { bipolar: true }),
  ],
};

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
    case 'trig_len': return formatLength(Math.round(v));
    case 'trig_prob': return `${Math.round(v)}%`;
    case 'flt_frq': return hzText(filterHz(v));
    case 'amp_pan': return panText(v);
    case 'amp_dec': return v >= 127 ? 'INF' : `${Math.round(v)}`;
  }
  return p.bipolar ? signed(v) : `${Math.round(v)}`;
}

export function formatMachineParam(p: MParam, v: number): string {
  if (p.options) return p.options[Math.round(v)] ?? '';
  if (p.semis) return signed(v);
  if ((p.key === 'dec' || p.key === 'dec2') && v >= 127) return 'INF';
  return p.bipolar ? signed(v) : `${Math.round(v)}`;
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
export function pageControls(track: number, page: number, values: Record<string, unknown>): (string | null)[] {
  if (track === FX_TRACK) {
    if (page === PAGE.TRIG) return FX_TRIG.map(k => (k ? `fx_${k}` : null));
    return (FX_PAGES[page] ?? []).map(p => (p ? `fx_${p.key}` : null));
  }
  if (page === PAGE.SRC) return MACHINES[machineOf(values, track)].knobs.map(k => (k ? cid(track, k) : null));
  return (TRACK_PAGES[page] ?? []).map(p => cid(track, p.key));
}

/** Metadata for a control id: a machine parameter or a page parameter */
export function paramMeta(id: string): { kind: 'machine'; p: MParam; track: number } | { kind: 'page'; p: PageParam; track: number } | null {
  const pi = parseId(id);
  if (!pi) return null;
  if (pi.track === FX_TRACK) {
    for (const page of Object.values(FX_PAGES)) for (const p of page) if (p && p.key === pi.key) return { kind: 'page', p, track: pi.track };
    if (pi.key === 'trig_prob') return { kind: 'page', p: TRIG_PAGE[3], track: pi.track };
    return null;
  }
  const t = TRACKS[pi.track];
  const mp = PARAM_INDEX[t.type][pi.key];
  if (mp) return { kind: 'machine', p: mp, track: pi.track };
  for (const page of [...Object.values(TRACK_PAGES), TRACK_EXTRA]) for (const p of page) if (p.key === pi.key) return { kind: 'page', p, track: pi.track };
  return null;
}

/** Screen label + readout for a control id */
export function describe(id: string, v: number): { abbr: string; name: string; text: string } | null {
  const m = paramMeta(id);
  if (!m) return null;
  if (m.kind === 'machine') return { abbr: m.p.abbr, name: m.p.name, text: formatMachineParam(m.p, v) };
  return { abbr: m.p.abbr, name: m.p.name, text: formatPage(m.p, v) };
}
