// ============================================================================
// Demo 2 · "Three Clocks" - DFAM + Mother-32 + Subharmonicon, Studio Clock, Xone:96.
// A hypnotic polyrhythmic jam, 110 BPM, D minor pentatonic, 72 bars.
// Spec: docs/research/producer-path/demo-tracks.md, "Demo 2". Original music.
//
// Every part steps on one 16th-note clock, on loops of different lengths: the
// DFAM every 2 beats (8 steps), the Mother-32 every 3 beats (12 steps), the
// Subharmonicon's sequencers every 4 beats (RHYTHM 1 ÷4) and every 3 beats
// (RHYTHM 2 ÷3). None of them has pattern memory, so the song is arranger
// mutes plus knob snapshots.
//
// Clocking: the DFAM (no MIDI) steps on Studio Clock CLOCK pulses through its
// ADV/CLOCK jack, as designed. The Mother-32 and the Subharmonicon follow the
// studio clock MIDI-style (one step per 16th), the design's alternative for
// the Subharmonicon: a stop and a new ▶ always restart them on step 1, where
// the CLOCK / RESET cables would depend on the reset pulse winning the race
// with the first clock pulse.
// ============================================================================

import { semis } from '@/devices/subharmonicon/theory';
import { sequence } from '@/devices/mother32/sequence';
import type { InstanceState, StudioDoc } from '@/store/studio';
import { XDECK_NONE, XFILTER, instance, mixer, nn, section, strip, xoneKill, xoneMid, type Values } from './common';
import { DEMO_BY_ID } from './meta';

const META = DEMO_BY_ID['three-clocks'];
const BPM = 110;

// ----------------------------------------------------------------------------
// DFAM · "clock kick": one voice plays kick, knock and tick through per-step pitch and velocity
// ----------------------------------------------------------------------------

// PITCH in volts (1 V = an octave): 0, +24, +12, +24, 0, +19, +7, +24 semitones
const DFAM_PITCH = [0, 24, 12, 24, 0, 19, 7, 24].map(st => st / 12);
const DFAM_VEL = [100, 20, 60, 28, 94, 22, 66, 34];

const DFAM: Values = {
  // VCO 1: triangle, PITCH 0 = A1 (55 Hz): 1.25 octaves below C3
  vco1_frequency: -1.25, vco1_wave: 1,
  // VCO 2: square, an octave and a half above VCO 1, silent until LIFT
  vco2_frequency: 0.25, vco2_wave: 0, vco2_level: 0, hard_sync: 1, fm_amount: 0,
  vco_decay: 70, vco1_eg_amount: 45, vco2_eg_amount: 20, seq_pitch_mod: 0,
  vco1_level: 85, noise_level: 12,
  vcf_mode: 1, vcf_cutoff: 1400, vcf_resonance: 20, vcf_decay: 150, vcf_eg_amount: 35, noise_vcf_mod: 0,
  // VCA DECAY at its shortest: the VELOCITY -> VCA DECAY cable adds a doubling per volt (0-5 V),
  // so a full-velocity kick rings about 320 ms and the 20-30 % ticks stay at 15-25 ms
  vca_attack_mode: 0, vca_decay: 10, volume: 75,
  tempo: BPM, run_stop: false,
  ...Object.fromEntries(DFAM_PITCH.map((v, i) => [`pitch_${i + 1}`, v])),
  ...Object.fromEntries(DFAM_VEL.map((v, i) => [`velocity_${i + 1}`, v])),
};

// ----------------------------------------------------------------------------
// Mother-32 · "rotor bass": a 12-step loop (3 beats) over the 16-step bar
// ----------------------------------------------------------------------------

const D2 = nn('D2'), F2 = nn('F2'), G2 = nn('G2'), A2 = nn('A2'), C3 = nn('C3'), D3 = nn('D3');
const ROTOR = sequence([
  { note: D2, accent: true }, null, D2, null, F2, { note: D3, accent: true, glide: true }, null, C3, null, A2, { note: G2, glide: true }, null,
]);

const MOTHER32: Values = {
  ...ROTOR,
  // the step written D2 sounds at 73.4 Hz (FREQUENCY at the centre, 0 V = C4)
  frequency: 0, vco_wave: 1, pulse_width: 50, vco_mod_source: 0, vco_mod_amount: 0, vco_mod_dest: 1, glide: 35,
  mix: 0, vcf_mode: 1, cutoff: 380, resonance: 40, vcf_mod_source: 0, vcf_mod_amount: 45, vcf_mod_polarity: 0,
  // DECAY 360 rather than 260 ms: the same pluck with more body, 1.3 dB less crest. VOLUME 52
  // (the design's 70 % drives the twin's output stage into its rail on the accents); the Xone's
  // GAIN makes up the level
  attack: 1.25, decay: 360, sustain: 1, vca_mode: 1, volume: 52,
  // ASSIGN = ACCENT, patched into VCF CUTOFF: accented steps open the filter
  assign_source: 0,
  step_div: 5, div_type: 0, swing: 50, swing_div: 5, swing_type: 0, seq_direction: 0, tempo: BPM, run_stop: false,
};

// ----------------------------------------------------------------------------
// Subharmonicon · "undertow"
// ----------------------------------------------------------------------------

const SUBH: Values = {
  // VCO 1 on D4 with subs ÷2 (an octave down) and ÷3 (an octave and a fifth down);
  // VCO 2 on A4 with ÷2 and ÷4 (plain octaves, so its melody stays clear)
  vco1_freq: 293.66, vco1_sub1_freq: -2, vco1_sub2_freq: -3, vco1_wave: 1,
  vco2_freq: 440, vco2_sub1_freq: -2, vco2_sub2_freq: -4, vco2_wave: 2,
  vco1_level: 30, vco1_sub1_level: 45, vco1_sub2_level: 30, vco2_level: 35, vco2_sub1_level: 30, vco2_sub2_level: 15,
  seq1_osc: true, seq1_sub1: false, seq1_sub2: false, seq2_osc: true, seq2_sub1: false, seq2_sub2: false,
  // SEQ OCT ±1, QUANTIZE 12-ET: SEQ 1 D A G C (0 +7 +5 -2), SEQ 2 A C G D (0 +3 -2 +5)
  seq_oct: 0, quantize: 1,
  seq1_step1: semis(0), seq1_step2: semis(7), seq1_step3: semis(5), seq1_step4: semis(-2),
  seq2_step1: semis(0), seq2_step2: semis(3), seq2_step3: semis(-2), seq2_step4: semis(5),
  // RHYTHM 1 ÷4 -> SEQ 1 (one step a beat), RHYTHM 2 ÷3 -> SEQ 2 (one a dotted 8th);
  // RHYTHM 3 ÷5 joins SEQ 1 from UNDERTOW on; RHYTHM 4 unassigned; LOGIC OR
  rhythm1: -4, rhythm1_seq1: true, rhythm1_seq2: false,
  rhythm2: -3, rhythm2_seq1: false, rhythm2_seq2: true,
  rhythm3: -5, rhythm3_seq1: false, rhythm3_seq2: false,
  rhythm4: -5, rhythm4_seq1: false, rhythm4_seq2: false,
  rhythm_logic: 0,
  cutoff: 450, resonance: 35, vcf_eg_amt: 40, vcf_attack: 2, vcf_decay: 220,
  vca_attack: 3, vca_decay: 600, eg_mode: 1, volume: 65,
  tempo: 440, play: false,
};

// ----------------------------------------------------------------------------
// Xone:96: channel 1 DFAM, 2 Mother-32, 3 Subharmonicon, A delay, B reverb.
// All three are mono and the Xone has no pans: width comes from the returns.
// ----------------------------------------------------------------------------

// Gain staging, measured: GAIN lines each channel up to the guide's level (meter peaks near +6),
// the faders set the design's balance against the DFAM's kick steps - the Mother-32 -3 dB, the
// Subharmonicon -8 dB (short-term loudness at the Xone's output). The twin's channel faders follow
// the hardware's constant-power curve (6.5 on the dial is -16 dB), and its sends rise with the
// square of the dial, so faders and sends sit higher than the design's numbers; the returns then
// come in about where the design puts them (delay -14, reverb -15 against the kick).
// All the faders sit 5 dB under that balance and MASTER 1 makes it up (9.65, +5 dB): three channels
// lined up sum hot, and this keeps the LR MIX meters (before MASTER) under their PK! LED.
const XONE: Values = {
  ch1_src: XDECK_NONE, ch2_src: XDECK_NONE, ch3_src: XDECK_NONE, ch4_src: XDECK_NONE, cha_src: XDECK_NONE, chb_src: XDECK_NONE,
  ch1_input: 2, ch2_input: 2, ch3_input: 2, cha_input: 2, chb_input: 2,
  ch1_gain: 4, ch1_hi: xoneKill(-2), ch1_himid: 0, ch1_lomid: xoneMid(-2), ch1_lo: xoneKill(1), ch1_fader: 8.92, ch1_snd1: 0, ch1_snd2: 5, ch1_filter: XFILTER.off,
  ch2_gain: 2, ch2_hi: 0, ch2_himid: xoneMid(2), ch2_lomid: xoneMid(-3), ch2_lo: 0, ch2_fader: 8.49, ch2_snd1: 0, ch2_snd2: 3.5, ch2_filter: XFILTER.off,
  // the Subharmonicon's LO shelf at -6 dB hands 87-147 Hz to the bass; it sends the most
  ch3_gain: 4, ch3_hi: xoneKill(-1), ch3_himid: 0, ch3_lomid: xoneMid(-2), ch3_lo: xoneKill(-6), ch3_fader: 7.36, ch3_snd1: 7, ch3_snd2: 7.5, ch3_filter: XFILTER.off,
  cha_hi: xoneKill(-3), cha_mid: 0, cha_lo: xoneKill(-12), cha_fader: 10, cha_filter: XFILTER.off,
  chb_hi: xoneKill(-2), chb_mid: xoneMid(-3, true), chb_midf: 400, chb_lo: xoneKill(-12), chb_fader: 10, chb_filter: XFILTER.off,
  // FX unit: DELAY 3/16 (409 ms), FDBK 4.5, REVERB 3.0 s, SEND 1 post-fader
  fx_time: 1, fx_fdbk: 4.5, fx_size: 3,
  f1_on: false, f2_on: false,
  master: 9.65, monitor_out: 0, bpm: BPM, play: false,
};

// ----------------------------------------------------------------------------
// Section snapshots: every snapshot names every control that changes in the song,
// so a section sounds the same however you got to it ("▶ from here" included)
// ----------------------------------------------------------------------------

const dfam = (noise: number, vco2: number, fm: number, kick = 100, kick2 = 94) => ({
  snapshot: { noise_level: noise, vco2_level: vco2, fm_amount: fm, velocity_1: kick, velocity_5: kick2 },
});
const m32 = (cutoff: number, mod: number) => ({ snapshot: { cutoff, vcf_mod_amount: mod } });
/**
 * The Subharmonicon's snapshot. `volume` is a fader ride on its VOLUME: up when it plays alone in
 * CLOCKWORK (an intro that isn't 8 dB under the track), down for the held drone of UNDERTOW,
 * which sustains where the sequence plucks.
 */
const subh = (cutoff: number, resonance: number, eg: 1 | 2, r3: boolean, volume = 65) => ({
  snapshot: { cutoff, resonance, eg_mode: eg, rhythm3_seq1: r3, volume },
});

export function build(): { devices: Record<string, InstanceState>; studio: StudioDoc; currentDevice: string } {
  const [clockwork, pulse, lowEnd, lift, undertow, ret, drift] = META.sections;
  const S = (m: typeof clockwork, parts: Parameters<typeof section>[4]) => section(m.id, m.name, m.bars, m.color, parts);
  const sections = [
    S(clockwork, { dfam: { ...dfam(12, 0, 0), muted: true }, mother32: { ...m32(380, 45), muted: true }, subharmonicon: subh(450, 35, 1, false, 85) }),
    S(pulse, { dfam: dfam(12, 0, 0), mother32: { ...m32(380, 45), muted: true }, subharmonicon: subh(650, 35, 1, false) }),
    S(lowEnd, { dfam: dfam(12, 0, 0), mother32: m32(380, 45), subharmonicon: subh(800, 35, 1, false) }),
    // LIFT: energy without new notes - noise and FM on the DFAM, the bass and the Subharmonicon brighter
    S(lift, { dfam: dfam(30, 30, 25), mother32: m32(520, 55), subharmonicon: subh(1300, 45, 1, false) }),
    // UNDERTOW: EG HELD makes the sequencers a drone chord; RHYTHM 3 ÷5 joins SEQ 1
    S(undertow, { dfam: { ...dfam(12, 0, 0), muted: true }, mother32: { ...m32(380, 55), muted: true }, subharmonicon: subh(900, 55, 2, true, 58) }),
    // RETURN: the PULSE settings with a little metal (VCO 2 at 15 %), the ÷5 rhythm kept
    S(ret, { dfam: dfam(12, 15, 0), mother32: m32(380, 55), subharmonicon: subh(1000, 40, 1, true) }),
    // DRIFT: the kick loses its bloom (softer steps 1 and 5 decay sooner through the VELOCITY cable)
    S(drift, { dfam: dfam(12, 15, 0, 78, 72), mother32: { ...m32(380, 45), muted: true }, subharmonicon: subh(500, 35, 1, true, 70) }),
  ];

  const devices: Record<string, InstanceState> = {
    // CLOCK DIV 1/16, 5 ms pulses: one DFAM step per 16th
    'studio-clock': instance({ division: 2, pulse_width: 5 }),
    // VELOCITY -> VCA DECAY: loud steps ring longer
    dfam: instance(DFAM, { patchConnections: [{ from: 'out_velocity', to: 'in_vca_decay', color: '#f97316' }] }),
    // ASSIGN (ACCENT) -> VCF CUTOFF: accented steps are brighter
    mother32: instance(MOTHER32, { patchConnections: [{ from: 'out_assign', to: 'in_vcf_cutoff', color: '#22c55e' }] }),
    subharmonicon: instance(SUBH),
    xone96: instance(XONE),
  };

  const studio: StudioDoc = {
    rack: [
      { id: 'studio-clock', device: 'studio-clock' },
      { id: 'dfam', device: 'dfam' },
      { id: 'mother32', device: 'mother32' },
      { id: 'subharmonicon', device: 'subharmonicon' },
      { id: 'xone96', device: 'xone96' },
    ],
    cables: [{ from: { instance: 'studio-clock', jack: 'out_clock' }, to: { instance: 'dfam', jack: 'in_adv_clock' }, color: '#38bdf8' }],
    routes: { dfam: 'xone96:studio_1', mother32: 'xone96:studio_2', subharmonicon: 'xone96:studio_3' },
    sync: { mother32: true, subharmonicon: true, xone96: true },
    bpm: BPM,
    swing: 0,
    arrangement: { enabled: true, loop: false, sections },
    off: {},
    // the Xone's own channel +6 dB and the master DRIVE +5 dB into the -1 dBTP limiter: about -13 LUFS
    mixer: mixer({
      'studio-clock': strip(0), dfam: strip(0), mother32: strip(0), subharmonicon: strip(0), xone96: strip(6),
    }, 5),
  };
  return { devices, studio, currentDevice: 'dfam' };
}
