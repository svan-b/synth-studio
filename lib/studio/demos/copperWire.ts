// ============================================================================
// Demo 3 · "Copper Wire" - Analog Rytm + Sub 37 into the Xone:96.
// Electro breaks, 122 BPM, G minor, 80 bars, dead straight (no swing).
// Spec: docs/research/producer-path/demo-tracks.md, "Demo 3". Original music.
//
// The Sub 37's two "presets" are arranger snapshots of its whole sound and its
// sequence (the twin keeps the sequence in its panel values, as the hardware
// keeps one with every preset). Twin differences, simplified here:
//   - the twin's sequencer stores no per-step velocity or SEQ MOD value, so the
//     bass plays every note at one level and the SEQ MOD accents are left out
//   - its MULTI TRIG retriggers the envelopes on tied steps too, so it is off:
//     ties stay legato and slide, as the design wants
//   - the wobble's first G1 starts on step 2 instead of 1: both sequences then
//     rest on step 1, so a preset change on a bar line (applied just before the
//     bar) can never sound a stray note on the downbeat; it also keeps the
//     downbeat to the kick
// ============================================================================

import type { Locks, Pattern, Step } from '@/lib/sequencer/elektron';
import { kitValues } from '@/devices/analog-rytm/presets';
import { buildSeq, DIV_EIGHTH, DIV_SIXTEENTH, type SeqToken } from '@/devices/sub37/model';
import type { InstanceState, StudioDoc } from '@/store/studio';
import {
  XDECK_NONE, XFILTER, XTYPE, drumRow, instance, mixer, section, strip, withSteps, xoneKill, xoneMid, type Values,
} from './common';
import { rytmPattern, rytmProject } from './rytm';
import { DEMO_BY_ID } from './meta';

const META = DEMO_BY_ID['copper-wire'];
const BPM = 122;
const STRAIGHT = 50;

// ----------------------------------------------------------------------------
// Analog Rytm kit "COPPER"
// ----------------------------------------------------------------------------

// Levels are the design's, measured at the Xone's output with each part soloed over its busiest
// 4 bars against the kick (short-term loudness): snare + clap -4, closed hats -15, open hat -12,
// cowbell -14, zaps -11, toms -8; the Sub 37's bass -1. The volumes below are what gets there on
// this twin (VOL, LEV and TRACK LEVEL each square their value).
const RYTM_KIT = kitValues({
  // BD CLASSIC tuned to G1 (55 Hz x 2^(-2/12) = 49 Hz): an 808-style kick, medium length
  bd: { machine: 'BD CLASSIC', tun: -2, swt: 45, swd: 45, dec: 58, hld: 15, wav: 0, tra: 17, lev: 115, flt_typ: 0, flt_frq: 127, amp_dec: 127, amp_ovr: 25, amp_pan: 0, amp_vol: 115 },
  sd: { machine: 'SD HARD', tun: 3, swd: 45, swt: 30, dec: 38, tic: 55, nod: 45, nol: 90, lev: 100, flt_typ: 4, flt_frq: 36, amp_dec: 127, amp_rev: 25, amp_vol: 79 },
  // NUM 3 = four claps
  cp: { machine: 'CP CLASSIC', ton: 80, num: 3, rat: 45, nod: 40, nol: 75, rnd: 30, cpd: 45, lev: 100, flt_typ: 4, flt_frq: 44, amp_rev: 40, amp_vol: 72 },
  // the zap: SY DUAL VCO on the RS track. TUN +31 puts NOTE 0 on G4 (65.4 Hz x 2^(31/12) = 392 Hz),
  // DET +7 a fifth, BND +48 (24 steps an octave) drops each hit two octaves into pitch,
  // CFG SSW+SIN_ a sinesaw plus sine mix, restarted on every trig
  rs: { machine: 'SY DUAL VCO', tun: 31, vdet: 7, bnd: 48, dec: 25, dec2: 20, bal: 0, cfg: 40, lev: 90, flt_typ: 0, flt_frq: 100, amp_del: 55, amp_rev: 10, amp_vol: 117 },
  // tuned toms: XT CLASSIC is half a semitone a step from 36.7 Hz - +34 is G2, +48 is D3
  lt: { machine: 'XT CLASSIC', tun: 34, dec: 50, swd: 30, swt: 50, nol: 25, nod: 30, flt_typ: 0, flt_frq: 127, amp_del: 40, amp_pan: -15, amp_vol: 58 },
  mt: { machine: 'XT CLASSIC', tun: 48, dec: 50, swd: 30, swt: 50, nol: 25, nod: 30, flt_typ: 0, flt_frq: 127, amp_del: 40, amp_pan: 15, amp_vol: 55 },
  ch: { machine: 'CH CLASSIC', tun: 0, dec: 22, col: 10, lev: 100, flt_typ: 4, flt_frq: 62, amp_pan: 10, amp_vol: 89 },
  oh: { machine: 'OH CLASSIC', tun: 0, dec: 55, col: 10, lev: 100, flt_typ: 4, flt_frq: 62, amp_pan: 10, amp_vol: 82 },
  // the 808 cowbell's 540 / 800 Hz pair: DET 54 is +6.8 semitones on this twin
  cb: { machine: 'CB CLASSIC', tun: 0, cdet: 54, dec: 30, lev: 90, flt_typ: 4, flt_frq: 60, amp_del: 40, amp_pan: -20, amp_vol: 97 },
}, {
  // DELAY an 8th (246 ms), ping-pong, above the bass; a short plate-like room
  del_tim: 16, del_x: 1, del_wid: 63, del_fdb: 64, del_hpf: 50, del_lpf: 80, del_rev: 20, del_vol: 92,
  rev_pre: 8, rev_dec: 40, rev_frq: 90, rev_gai: 90, rev_hpf: 50, rev_lpf: 90, rev_vol: 80,
  // DISTORTION a little more than the design's 20: a denser drum bus to master at -11 LUFS
  dis_amt: 30, dis_sym: 6, dis_dov: 0, dis_del: 0, dis_rev: 1,
  // the whole kit punches together: 0.3 ms, A1, 1:4, no sidechain filter. The twin's threshold
  // scale differs from the hardware's: at the design's THR 92 it would take 8 dB off the kit
  cmp_thr: 108, cmp_atk: 2, cmp_rel: 6, cmp_mup: 10, cmp_rat: 1, cmp_seq: 0, cmp_mix: 127, cmp_vol: 100,
});

// ---- Rytm patterns (A01-A06, 32 steps = 2 bars). Extras use 1-based steps ----

const two = (bar1: string, bar2: string) => `${bar1} ${bar2}`;
const both = (bar: string) => two(bar, bar);
const E = '· · · · · · · · · · · · · · · ·';

const KICK_A = two('127 · · · · · 105 · · · 110 · · · · ·', '127 · · 72 · · · · · 108 · 84 · · · ·');
// BEAT B: two soft extra kicks, on steps the bass leaves empty (14, and 25 doubling into 26)
const KICK_B = two('127 · · · · · 105 · · · 110 · · 64 · ·', '127 · · 72 · · · · 70 108 · 84 · · · ·');
const HATS = both('84 48 100 48 84 48 84 48 84 48 100 48 84 48 · 48');
const OPEN = both('· · · · · · · · · · · · · · 88 ·');
const BELL_A = two('· · · 72 · · · · · 58 · · · · · ·', '· · · · · · 66[1:2] · · · · · · · · ·');
const BELL_B = two('· · · 72 · · · · · 58 · · · · · ·', '· 62 · · · · 66 · · · · 60[2:2] · · · ·');
const SNARE = two('· · · · 118 · · 38 · · · · 118 · 44 ·', '· · · · 118 · · 40 · · · · 118 · 46 60');
const CLAP = both('· · · · 96 · · · · · · · 96 · · ·');

/** Zap locks: NOTE (60 = G4, +3 Bb, +7 D, +10 F, +12 G) and a pan swinging left and right */
const zap = (offset: number, pan: number, extra: Locks = {}): Partial<Step> => ({ note: 60 + offset, locks: { amp_pan: pan, ...extra } });
const ZAPS_A: Record<number, Partial<Step>> = { 15: zap(0, -30), 19: zap(3, 30), 27: zap(7, -30) };

function rytmPatterns(): Record<string, Pattern> {
  const P = (name: string, tracks: Parameters<typeof rytmPattern>[3]) => rytmPattern(name, 32, STRAIGHT, tracks);
  const zapsA = withSteps(drumRow(two('· · · · · · · · · · · · · · 84 ·', '· · 80 · · · · · · · 78 · · · · ·')), ZAPS_A);
  const A01 = P('INTRO', { bd: drumRow(KICK_A), ch: drumRow(HATS), oh: drumRow(OPEN), cb: drumRow(BELL_A) });
  const A02 = P('BEAT A', {
    bd: drumRow(KICK_A), sd: drumRow(SNARE), cp: drumRow(CLAP), rs: zapsA,
    ch: drumRow(HATS), oh: drumRow(OPEN), cb: drumRow(BELL_A),
  });
  // BREAK: no kick, snare or clap - tuned toms (G2, D3 and a Bb2 lock) and echoing zaps
  const A03 = P('BREAK', {
    lt: withSteps(drumRow(two('100 · · 70 · · 84 · · · 90 · · · · ·', '100 · · 70 · · 84 · · 76 · · · · · ·')), { 11: { note: 63 } }),
    mt: drumRow(two('· · · · · · · · 80 · · · · 72 · ·', '· · · · · · · · 80 · · · · 72 · 64')),
    ch: drumRow(both('52 34 52 34 52 34 52 34 52 34 52 34 52 34 · 34')),
    oh: drumRow(both('· · · · · · · · · · · · · · 70 ·')),
    rs: withSteps(drumRow(two('· · · · · 70[1:2] · · · · · · · · 84 ·', '· · 80 · · · · · · · 78 · · · · ·')), {
      6: zap(10, 30, { amp_del: 70 }), 15: zap(0, -30, { amp_del: 70 }), 19: zap(3, 30, { amp_del: 70 }), 27: zap(7, -30, { amp_del: 70 }),
    }),
  });
  const beatB = (extra: Parameters<typeof rytmPattern>[3]) => ({
    bd: drumRow(KICK_B), sd: drumRow(SNARE), cp: drumRow(CLAP),
    // a high zap on 3 (NOTE +12) on odd loops
    rs: withSteps(drumRow(two('· · 70[1:2] · · · · · · · · · · · 84 ·', '· · 80 · · · · · · · 78 · · · · ·')), { 3: zap(12, 30), ...ZAPS_A }),
    ch: drumRow(HATS), oh: drumRow(OPEN), cb: drumRow(BELL_B),
    ...extra,
  });
  const A04 = P('BEAT B', beatB({ lt: drumRow(two(E, '· · · · · · · · · · · · · · · 80[1:2]')) }));
  // BREAKDOWN: one impact, claps (the last one of each loop blooms into the reverb), echoing zaps
  const A05 = P('BREAKDOWN', {
    bd: drumRow(two('127[1ST] · · · · · · · · · · · · · · ·', E)),
    cp: withSteps(drumRow(two('· · · · 100 · · · · · · · 100 · · ·', '· · · · 100 · · · · · · · 104 · · ·')), { 29: { locks: { amp_rev: 90 } } }),
    rs: withSteps(drumRow(two('· · 76 · · · · · · · · · · · 84 ·', '· · 80 · · · · · · · 78 · · · 70 ·')), {
      3: zap(12, 30, { amp_del: 90 }), 15: zap(0, -30, { amp_del: 90 }), 19: zap(3, 30, { amp_del: 90 }), 27: zap(7, -30, { amp_del: 90 }), 31: zap(10, 30, { amp_del: 90 }),
    }),
    oh: drumRow(both('· · · · · · · · · · · · · · 80 ·')),
  });
  // FINAL: BEAT B plus a tom roll every 8 bars ([4:4] counts 2-bar loops: bars 7-8 and 15-16)
  const A06 = P('FINAL', beatB({
    mt: drumRow(two(E, '· · · · · · · · · · · 80[4:4] · 88[4:4] · 100[4:4]')),
    lt: drumRow(two(E, '· · · · · · · · · · · · 96[4:4] · 104[4:4] ·')),
  }));
  return { A01, A02, A03, A04, A05, A06 };
}

// ----------------------------------------------------------------------------
// Sub 37: two "presets", each with its own sequence (32 steps, CLOCK DIV 1/16)
// ----------------------------------------------------------------------------

// The oscillators run at 16', an octave below the keys, so the sequence holds each note an
// octave above its sounding pitch: written G1 (49 Hz, the kick's note) is stored as G2.
const G1 = 43, Bb1 = 46, C2 = 48, D2 = 50, F2 = 53, G2 = 55;
const tie = (n: number): SeqToken => ({ n, tie: true });

// Sequence A: every note on a step the kick leaves free; ties slide D2 -> C2, G1 -> Bb1, D2 -> C2
const SEQ_A = buildSeq([
  '.', '.', G1, G2, '.', Bb1, '.', '.', D2, tie(C2), '.', '.', G1, '.', F2, G2,
  '.', '.', G1, '.', '.', Bb1, C2, D2, '.', '.', F2, '.', G1, tie(Bb1), D2, tie(C2),
]);
// Sequence B: long notes tied into each other, the rhythm coming from the filter LFO
// (i - III - iv - i - v - iv - III: Gm, Bb, Cm, Gm, Dm, Cm, Bb)
const SEQ_B = buildSeq([
  '.', G1, '_', '_', '_', '_', '_', '_', tie(Bb1), '_', '_', '_', tie(C2), '_', '_', '_',
  tie(G1), '_', '_', '_', '_', '_', '_', '_', tie(D2), '_', '_', '_', tie(C2), '_', '_', tie(Bb1),
]);

/** Everything the two presets set (each snapshot carries all of it) */
function sub37Preset(which: 1 | 2, over: { cutoff?: number; egAmt?: number; drive?: number } = {}): Values {
  const p1 = which === 1;
  const seq = p1 ? SEQ_A : SEQ_B;
  return {
    arp_seq: seq.arp_seq, arp_seq2: seq.arp_seq2, arp_seq_flags: seq.arp_seq_flags, seq_len: 32, seq_first: 1,
    cutoff: over.cutoff ?? (p1 ? 260 : 180),
    resonance: p1 ? 30 : 45,
    filter_eg_amt: over.egAmt ?? (p1 ? 55 : 20),
    multidrive: over.drive ?? (p1 ? 35 : 40),
    aeg_sustain: p1 ? 80 : 100,
    aeg_release: p1 ? 60 : 80,
    glide_time: p1 ? 45 : 90,
    // MOD 2: a triangle LFO synced to 8ths (about 4.07 Hz at 122 BPM) on the cutoff - the wobble
    mod2_source: 0, mod2_sync: true, mod2_div: DIV_EIGHTH, mod2_filter_amt: p1 ? 0 : 45, mod2_pitch_amt: 0, mod2_mod_amt: 0,
    // PRESET VOL levels each preset as the factory ones are: the bass 1 dB under the kick, and the
    // sustained wobble (AMP SUSTAIN 100 %) at the same short-term level as the bassline
    preset_volume: p1 ? 46 : 29,
  };
}

const SUB37: Values = {
  // OSC 1 saw and OSC 2 square at 16', OSC 2 beating 0.8 Hz against OSC 1; KB RESET for punch
  osc1_octave: 0, osc1_wave: 33, osc2_octave: 0, osc2_wave: 67, osc2_frequency: 0, beat_freq: 0.8,
  hard_sync: false, kb_reset: true, duo_mode: false,
  mix_osc1: 85, mix_sub: 55, mix_osc2: 60, mix_noise: 0, mix_feedback: 15,
  filter_kb_amt: 50, filter_slope: 3,
  feg_attack: 1, feg_decay: 220, feg_sustain: 10, feg_release: 120, feg_multi_trig: false, feg_vel_amt: 60,
  aeg_attack: 1, aeg_decay: 400, aeg_multi_trig: false,
  glide_on: true, glide_type: 1, glide_legato: true, glide_osc: 0,
  master_volume: 70,
  // the sequencer: SEQ pattern, latched, synced to the studio, 1/16, GATE 50 %, straight;
  // REF NOTE MID C plays it as recorded
  arp_on: true, arp_pattern: 4, arp_latch: true, arp_sync: true, arp_div: DIV_SIXTEENTH, arp_gate: 50, arp_swing: 50, seq_ref: 1,
  ...sub37Preset(1, { cutoff: 210 }),
};

// ----------------------------------------------------------------------------
// Xone:96: channel 1 Rytm, 2 Sub 37, A delay, B reverb
// ----------------------------------------------------------------------------

const XONE: Values = {
  ch1_src: XDECK_NONE, ch2_src: XDECK_NONE, ch3_src: XDECK_NONE, ch4_src: XDECK_NONE, cha_src: XDECK_NONE, chb_src: XDECK_NONE,
  ch1_input: 2, ch2_input: 2, cha_input: 2, chb_input: 2,
  // GAIN lines both channels up (meter peaks near +6); the faders set the bass 1 dB under the kick.
  // The twin's faders follow the hardware's constant-power curve (8.0 on the dial is -10 dB), so
  // they sit higher than the design's 8.0 / 7.5; SEND 2 and channel B are up for an audible room
  ch1_gain: 5, ch1_hi: 0, ch1_himid: xoneMid(1), ch1_lomid: xoneMid(-2), ch1_lo: 0, ch1_fader: 10, ch1_snd1: 0, ch1_snd2: 2, ch1_filter: XFILTER.off,
  // HI MID +1.5 dB at 1.1 kHz: the bass's harmonics for small speakers
  ch2_gain: 3, ch2_hi: xoneKill(-2), ch2_himid: xoneMid(1.5), ch2_lomid: xoneMid(-3), ch2_lo: 0, ch2_fader: 9.5, ch2_snd1: 0, ch2_snd2: 0, ch2_filter: XFILTER.off,
  cha_hi: xoneKill(-3), cha_mid: 0, cha_lo: xoneKill(-12), cha_fader: 4, cha_filter: XFILTER.off,
  chb_hi: xoneKill(-2), chb_mid: xoneMid(-2, true), chb_midf: 500, chb_lo: xoneKill(-12), chb_fader: 8, chb_filter: XFILTER.off,
  // FX unit: DELAY 1/8, FDBK 3.5, REVERB 1.6 s; FILTER 2 LPF 2.5 kHz RES 3 (BREAKDOWN)
  fx_time: 0, fx_fdbk: 3.5, fx_size: 1.6,
  f1_on: false, f2_on: true, f2_type: XTYPE.lpf, f2_freq: 2500, f2_res: 3, f2_crunch: 0,
  master: 8, monitor_out: 0, bpm: BPM, play: false,
};

export function build(): { devices: Record<string, InstanceState>; studio: StudioDoc; currentDevice: string } {
  const rytmData = rytmProject({
    kitName: 'COPPER',
    kit: RYTM_KIT,
    patterns: rytmPatterns(),
    songName: 'COPPER WIRE',
    song: [
      { pattern: 'A01', repeats: 4 }, { pattern: 'A02', repeats: 8 }, { pattern: 'A03', repeats: 4 }, { pattern: 'A04', repeats: 8 },
      { pattern: 'A05', repeats: 4 }, { pattern: 'A06', repeats: 8 }, { pattern: 'A01', repeats: 4 },
    ],
  });

  const [intro, verse1, brk, verse2, breakdown, final, outro] = META.sections;
  const S = (m: typeof intro, parts: Parameters<typeof section>[4]) => section(m.id, m.name, m.bars, m.color, parts);
  const xone = (ch1: number) => ({ snapshot: { ch1_filter: ch1 } });
  const sections = [
    S(intro, { 'analog-rytm': { pattern: 'A01' }, sub37: { snapshot: sub37Preset(1, { cutoff: 210 }), muted: true }, xone96: xone(XFILTER.off) }),
    S(verse1, { 'analog-rytm': { pattern: 'A02' }, sub37: { snapshot: sub37Preset(1, { cutoff: 210 }) }, xone96: xone(XFILTER.off) }),
    S(brk, { 'analog-rytm': { pattern: 'A03' }, sub37: { snapshot: sub37Preset(2) }, xone96: xone(XFILTER.off) }),
    S(verse2, { 'analog-rytm': { pattern: 'A04' }, sub37: { snapshot: sub37Preset(1, { cutoff: 300, egAmt: 60 }) }, xone96: xone(XFILTER.off) }),
    S(breakdown, { 'analog-rytm': { pattern: 'A05' }, sub37: { snapshot: sub37Preset(2, { cutoff: 240 }) }, xone96: xone(XFILTER.two) }),
    S(final, { 'analog-rytm': { pattern: 'A06' }, sub37: { snapshot: sub37Preset(1, { cutoff: 340, drive: 45 }) }, xone96: xone(XFILTER.off) }),
    S(outro, { 'analog-rytm': { pattern: 'A01' }, sub37: { snapshot: sub37Preset(1, { cutoff: 210 }), muted: true }, xone96: xone(XFILTER.off) }),
  ];

  const devices: Record<string, InstanceState> = {
    'analog-rytm': instance({ ...RYTM_KIT, bpm: BPM, kit_demo: 0, track: 0, page: 1, play: false }, { data: rytmData }),
    sub37: instance(SUB37),
    xone96: instance(XONE),
  };

  const studio: StudioDoc = {
    rack: [
      { id: 'analog-rytm', device: 'analog-rytm' },
      { id: 'sub37', device: 'sub37' },
      { id: 'xone96', device: 'xone96' },
    ],
    cables: [],
    routes: { 'analog-rytm': 'xone96:studio_1', sub37: 'xone96:studio_2' },
    sync: { 'analog-rytm': true, sub37: true, xone96: true },
    bpm: BPM,
    swing: 0,
    arrangement: { enabled: true, loop: false, sections },
    off: {},
    // the Xone's own channel +6 dB and the master DRIVE +5 dB into the -1 dBTP limiter: about -11 LUFS
    mixer: mixer({ 'analog-rytm': strip(0), sub37: strip(0), xone96: strip(6) }, 5),
  };
  return { devices, studio, currentDevice: 'analog-rytm' };
}
