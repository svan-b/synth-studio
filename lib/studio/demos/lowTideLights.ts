// ============================================================================
// Demo 1 · "Low Tide Lights" - Analog Rytm + Analog Four into the Xone:96.
// Deep, melodic techno-house, 124 BPM, A minor, 80 bars.
// Spec: docs/research/producer-path/demo-tracks.md, "Demo 1". Original music.
//
// Where the rebuilt twins' scales differ from the design's (written for the
// hardware), the values below aim at the design's sound, not its numbers:
//   - A4 filter values are converted through the design's approximate Hz to
//     the twin's one-semitone-a-step scale (13 Hz at 0), and the A4's filter
//     keytracking is relative to C4, so tracks with TRK on are offset to keep
//     the cutoff the design describes at the notes they play.
//   - Levels (Xone GAIN and faders, kit volumes, the master drive) are set by
//     measurement, see the mix notes at the end.
// ============================================================================

import { createProject, type Locks, type Pattern, type Step } from '@/lib/sequencer/elektron';
import { SEQ_TRACKS as A4_TRACKS, FX_BY_KEY, SYNTH_BY_KEY, dest, fxid, tid } from '@/devices/analog-four/params';
import { kitValues } from '@/devices/analog-rytm/presets';
import type { InstanceState, StudioDoc } from '@/store/studio';
import {
  XDECK_NONE, XFILTER, XTYPE, drumRow, elektronPattern, instance, lenIndex, melodic, mixer, nn, onSteps, section, strip,
  withCondition, withLocks, withSteps, xoneKill, xoneMid, type MelodicBar, type Values,
} from './common';
import { rytmPattern, rytmProject } from './rytm';
import { DEMO_BY_ID } from './meta';

const META = DEMO_BY_ID['low-tide-lights'];
const BPM = 124;
const SWING = 54;

// ----------------------------------------------------------------------------
// Analog Rytm kit "LOW TIDE"
// ----------------------------------------------------------------------------

// Levels are the design's, measured: each part soloed over its busiest 4 bars against the kick
// (short-term loudness, through the kit's master section) - clap -6, open hat -12, closed hats -15,
// rim -13, tom -13, ride -15, the Build B snare roll -7. The track volumes below are what gets there
// on this twin (its VOL, LEV and TRACK LEVEL each square their value).
const RYTM_KIT = kitValues({
  // the kick a little longer (DEC 62, HLD 18) than the design's 50 / 12: more body per peak, so the
  // drum bus reaches club loudness with less limiting
  bd: { machine: 'BD HARD', tun: 0, swt: 38, snp: 52, dec: 62, hld: 18, wav: 0, tic: 30, lev: 110, flt_typ: 0, flt_frq: 127, amp_atk: 0, amp_dec: 127, amp_ovr: 18, amp_pan: 0, amp_vol: 95 },
  sd: { machine: 'SD HARD', tun: 2, swd: 40, swt: 30, dec: 30, tic: 50, nod: 38, nol: 80, lev: 100, flt_typ: 4, flt_frq: 30, amp_dec: 127, amp_rev: 40, amp_vol: 71 },
  rs: { machine: 'RS HARD', tun: 5, swd: 20, swt: 10, dec: 20, sym: 10, nol: 20, tic: 60, lev: 127, trk_lev: 108, flt_typ: 4, flt_frq: 50, amp_del: 70, amp_rev: 20, amp_pan: -20, amp_vol: 127 },
  // NUM 2 = three claps (the first plus NUM)
  cp: { machine: 'CP CLASSIC', ton: 72, num: 2, rat: 50, nod: 48, nol: 80, rnd: 25, cpd: 50, lev: 118, flt_typ: 4, flt_frq: 41, amp_rev: 45, amp_pan: 0, amp_vol: 127 },
  // XT CLASSIC tunes half a semitone a step from 36.7 Hz: +28 is E2 (82.4 Hz), the fifth
  lt: { machine: 'XT CLASSIC', tun: 28, dec: 40, swd: 30, swt: 50, nol: 20, nod: 30, flt_typ: 0, flt_frq: 127, amp_del: 25, amp_pan: -12, amp_vol: 85 },
  ch: { machine: 'CH CLASSIC', tun: 0, col: 10, dec: 24, lev: 115, trk_lev: 104, flt_typ: 4, flt_frq: 58, amp_pan: 8, amp_vol: 127 },
  oh: { machine: 'OH CLASSIC', tun: 0, col: 10, dec: 55, lev: 100, flt_typ: 4, flt_frq: 58, amp_rev: 10, amp_pan: 8, amp_vol: 79 },
  cy: { machine: 'CY RIDE', tun: 0, typ: 1, hit: 30, dec: 60, c1: 90, c2: 64, c3: 64, lev: 90, flt_typ: 4, flt_frq: 64, amp_rev: 15, amp_pan: 25, amp_vol: 66 },
}, {
  // DELAY: dotted 8th, ping-pong, kept above the bass
  del_tim: 24, del_x: 1, del_wid: 63, del_fdb: 72, del_hpf: 48, del_lpf: 88, del_rev: 24, del_vol: 96,
  rev_pre: 10, rev_dec: 58, rev_frq: 90, rev_gai: 84, rev_hpf: 40, rev_lpf: 86, rev_vol: 90,
  // DISTORTION: the kit drives the master clipper like the factory techno kits (the design's AMT 8
  // left the drum bus too peaky to master at -10.5 LUFS); the returns go in before it (PRE)
  dis_amt: 36, dis_sym: 0, dis_dov: 0, dis_del: 0, dis_rev: 0,
  // COMPRESSOR: 0.3 ms, A1, 1:4, sidechain HPF (the kick doesn't pump the hats), fully wet. The
  // twin's threshold scale differs from the hardware's: THR 108 gives the design's couple of dB of glue
  cmp_thr: 108, cmp_atk: 2, cmp_rel: 6, cmp_mup: 10, cmp_rat: 1, cmp_seq: 2, cmp_mix: 127, cmp_vol: 100,
});

// ---- Rytm patterns (A01-A07). Steps in the extras are 1-based, as in the design ----

const KICK = '120 · · · 116 · · · 120 · · · 116 · · ·';
const CH_GHOST_MICRO = onSteps([2, 6, 10, 14], { micro: 2 });
const RIM = '· · · · · · · · · · · 85 · · · 68[1:2]';
const OH_OFF = '· · 90 · · · 90 · · · 90 · · · 94 ·';
const CH_GROOVE = '· 42 · 60 · 42 · 60 · 42 · 60 · 42 · 66';
const CP_DROP = '· · · · 108 · · · · · · · 110 · · 52[4:4]';
const LT_DROP = '· · · · · · · 64 · · 70[2:2] · · 56 · ·';
const SD_FILL = '· · · · · · · · · · · · · 70[8:8] 86[8:8] 104[8:8]';

function rytmPatterns(): Record<string, Pattern> {
  const P = (name: string, length: number, tracks: Parameters<typeof rytmPattern>[3]) => rytmPattern(name, length, SWING, tracks);
  const A01 = P('INTRO', 16, {
    bd: drumRow(KICK),
    ch: withSteps(drumRow('· 44 96 58 · 44 96 58 · 44 96 58 · 44 96 64'), CH_GHOST_MICRO),
    rs: drumRow(RIM),
  });
  const A02 = P('GROOVE', 16, {
    bd: drumRow(KICK),
    cp: withSteps(drumRow('· · · · 108 · · · · · · · 110 · · ·'), { 13: { micro: 1 } }),
    oh: drumRow(OH_OFF),
    ch: withSteps(drumRow(CH_GROOVE), CH_GHOST_MICRO),
    rs: drumRow(RIM),
  });
  const dropTracks = (extra: Parameters<typeof rytmPattern>[3] = {}) => ({
    bd: drumRow(KICK),
    cp: withSteps(drumRow(CP_DROP), { 13: { micro: 1 } }),
    oh: drumRow(OH_OFF),
    // CH 16: a slightly longer hat leading into the next bar (DEC 24 + 16)
    ch: withSteps(drumRow(CH_GROOVE), { ...CH_GHOST_MICRO, 16: { locks: { dec: 40 } } }),
    rs: drumRow(RIM),
    lt: drumRow(LT_DROP),
    sd: drumRow(SD_FILL),
    ...extra,
  });
  const A03 = P('DROP', 16, dropTracks());
  const A04 = P('BREAK', 16, {
    // one deep impact on the first bar of the break: DEC 50 + 30, into the reverb
    bd: withSteps(drumRow('127[1ST] · · · · · · · · · · · · · · ·'), { 1: { locks: { dec: 80, amp_rev: 60 } } }),
    rs: drumRow('· · · 78 · · 58[1:2] · · · · 85 · · · ·'),
    ch: drumRow('· · 66 · · · 66 · · · 66 · · · 72 ·'),
    cy: withSteps(drumRow('58[1:4] · · · · · · · · · · · · · · ·'), { 1: { locks: { dec: 110 } } }),
    lt: withSteps(drumRow('· · · · · · · · · · 58[2:2] · · · · ·'), { 11: { locks: { amp_del: 50 } } }),
  });
  const A05 = P('BUILD A', 16, {
    bd: drumRow('112 · · · 108 · · · 112 · · · 108 · · ·'),
    sd: drumRow('· · · · 60 · · · · · · · 60 · 66[4:4] 74[4:4]'),
    cp: drumRow('· · · · 100 · · · · · · · 104 · · ·'),
    oh: drumRow('· · 88 · · · 88 · · · 88 · · · 92 ·'),
    ch: drumRow('70 48 · 58 70 48 · 58 70 48 · 58 70 48 · 64'),
    rs: drumRow('· · · · · · · · · · · 80 · · · ·'),
  });
  // BUILD B: 4 bars, played once. The snare gets denser, higher and thinner every bar,
  // and the last bar has no kick, clap or open hat.
  const sdBars = [
    '60 · 62 · 64 · 66 · 68 · 70 · 72 · 74 ·',
    '76 · 78 · 80 · 82 · 84 · 86 · 88 · 90 ·',
    '84 85 87 88 89 91 92 93 95 96 97 99 100 101 103 104',
    '106 107 109 110 112 113 114 116 117 119 120 121 123 124 126 127',
  ];
  // per bar: NOTE +0 / +1 / +2 / +3 and FLTR FREQ 40 / 52 / 64 / 76; bar 4 also into the reverb
  const sdSteps = drumRow(sdBars.join(' '));
  for (const k of Object.keys(sdSteps)) {
    const i = Number(k);
    const bar = Math.floor(i / 16);
    const locks: Locks = { flt_frq: [40, 52, 64, 76][bar], ...(bar === 3 ? { amp_rev: 70 } : {}) };
    sdSteps[i] = { ...sdSteps[i], note: 60 + bar, locks };
  }
  // retrigs: 1/32 on steps 57-60, 1/64 on 61-64, one step long, the velocity rising into each hit
  for (let s = 57; s <= 64; s++) sdSteps[s - 1] = { ...sdSteps[s - 1], retrig: { rate: s <= 60 ? 12 : 15, len: lenIndex(1), vel: 20 } };
  const three = (bar: string) => [bar, bar, bar, '· · · · · · · · · · · · · · · ·'].join(' ');
  const A06 = P('BUILD B', 64, {
    bd: drumRow(three('110 · · · 110 · · · 110 · · · 110 · · ·')),
    sd: sdSteps,
    cp: drumRow(three('· · · · 100 · · · · · · · 100 · · ·')),
    oh: drumRow(three('· · 86 · · · 86 · · · 86 · · · 86 ·')),
    ch: drumRow([
      '50 51 · 52 53 54 · 56 56 57 · 59 60 60 · 62',
      '63 63 · 65 66 67 · 68 69 70 · 71 72 73 · 75',
      '75 76 · 78 79 79 · 81 82 83 · 84 85 86 · 87',
      '88 89 90 90 91 92 93 94 94 95 96 97 98 98 99 100',
    ].join(' ')),
  });
  // DROP 2: A03 plus a ride on every 8th and one more rim (after the clap's tail: RS and CP share a voice)
  const A07 = P('DROP 2', 16, dropTracks({
    rs: drumRow('· · · · · · · · · 58[1:2] · 85 · · · 68[1:2]'),
    cy: drumRow('68 · 88 · 68 · 88 · 68 · 88 · 68 · 88 ·'),
  }));
  return { A01, A02, A03, A04, A05, A06, A07 };
}

// ----------------------------------------------------------------------------
// Analog Four kit "LOW TIDE"
// ----------------------------------------------------------------------------

/** One A4 track's sound: every synth parameter from the init sound, then the given values */
function a4Track(t: number, p: Record<string, number>, trig: { note: number; len: number }): Values {
  const out: Values = {};
  for (const key in SYNTH_BY_KEY) {
    if (key.startsWith('trig_')) continue;
    out[tid(t, key)] = p[key] ?? SYNTH_BY_KEY[key].def;
  }
  out[tid(t, 'trig_note')] = trig.note;
  out[tid(t, 'trig_vel')] = 100;
  out[tid(t, 'trig_len')] = trig.len;
  return out;
}

function a4Fx(p: Record<string, number>): Values {
  const out: Values = {};
  for (const key in FX_BY_KEY) if (!key.startsWith('trig_')) out[fxid(key)] = p[key] ?? FX_BY_KEY[key].def;
  return out;
}

// Filter 1 keytracking (TRK) is relative to C4 here: 32 tracks 1:1, 16 half. The base values
// put the cutoff where the design wants it at the notes each track plays.
//
// Envelope times: the twin's run 1 ms x 2^(v x 14 / 127), so the design's stab envelope (DEC 46,
// REL 36) would last about 60 ms - a click. The stabs and the bass get longer envelopes, chosen for
// the sound the design describes (chord stabs with body, a plucked bass that holds its note).
// Levels are measured against the kick like the drums: bass -2, stabs -9, hook -7, break pad -8.
const STAB = {
  osc1_wav: 0, osc2_wav: 0, flt1_res: 30, flt1_trk: 16, flt1_dep: 12, flt2_typ: 4, flt2_frq: 38,
  envf_atk: 0, envf_dec: 50, envf_sus: 0, envf_rel: 30,
  amp_atk: 12, amp_dec: 72, amp_sus: 0, amp_rel: 72, amp_cho: 40, amp_del: 60, amp_rev: 45, amp_vol: 120, level: 59,
  // the slow filter LFO: SPD 8 x MUL 1 = one cycle every 16 bars
  lfo1_spd: 8, lfo1_mul: 0, lfo1_wav: 0, lfo1_mod: 0, lfo1_dsta: dest('F1 FRQ'), lfo1_depa: 8,
};

const A4_SOUND: Values = {
  // T1 bass: saw + the sub an octave down, ladder at about 175 Hz on A2, a plucked envelope that
  // settles on a full sustain
  ...a4Track(0, {
    osc1_wav: 0, osc1_sub: 1, osc1_lev: 100, osc2_lev: 0,
    flt1_frq: 60, flt1_res: 22, flt1_ovr: 8, flt1_trk: 32, flt1_dep: 18, flt2_typ: 4, flt2_frq: 15,
    envf_atk: 0, envf_dec: 46, envf_sus: 20, envf_rel: 20,
    amp_atk: 0, amp_dec: 60, amp_sus: 127, amp_rel: 12, amp_pan: 0, amp_vol: 110, level: 46,
  }, { note: nn('A2'), len: lenIndex(1) }),
  // T2 stab A: root and fifth; T3 stab B: minor third and minor seventh - one NOTE, a m7 chord
  ...a4Track(1, { ...STAB, osc1_lev: 85, osc1_tun: 0, osc2_lev: 75, osc2_tun: 7, osc2_det: 6, flt1_frq: 72, amp_pan: -12 }, { note: nn('A3'), len: lenIndex(0.5) }),
  ...a4Track(2, { ...STAB, osc1_lev: 80, osc1_tun: 3, osc2_lev: 75, osc2_tun: 10, osc2_det: -6, flt1_frq: 72, amp_pan: 12 }, { note: nn('A3'), len: lenIndex(0.5) }),
  // T4 hook / riser: a pulse and a triangle an octave up, about 1 kHz at the hook's notes
  ...a4Track(3, {
    osc1_wav: 2, osc1_pw: -20, osc1_lev: 90, osc2_wav: 3, osc2_tun: 12, osc2_lev: 50,
    flt1_frq: 67, flt1_res: 40, flt1_trk: 16, flt1_dep: 30, flt2_typ: 3, flt2_frq: 54,
    envf_atk: 0, envf_dec: 30, envf_sus: 10, envf_rel: 30,
    amp_atk: 0, amp_dec: 52, amp_sus: 40, amp_rel: 44, amp_cho: 30, amp_del: 70, amp_rev: 50, amp_pan: 0, amp_vol: 107, level: 62,
  }, { note: nn('E5'), len: lenIndex(1) }),
  ...a4Fx({
    cho_pre: 20, cho_spd: 28, cho_dep: 56, cho_wid: 110, cho_fb: 8, cho_hpf: 40, cho_lpf: 120, cho_vol: 90,
    del_tim: 24, del_x: 1, del_fb: 52, del_ovr: 8, del_hpf: 40, del_lpf: 80, del_rev: 30, del_vol: 95,
    rev_pre: 14, rev_dec: 82, rev_gai: 70, rev_hpf: 36, rev_lpf: 76, rev_vol: 110,
  }),
};

// ---- A4 patterns (A01-A07, 64 steps each) ----

const b = (note: string, vel: string, len: string): MelodicBar => ({ note, vel, len });
const EMPTY = '· · · · · · · · · · · · · · · ·';

const BASS = melodic([
  b('· · A2 · · · A2 A3 · · A2 · · · A2 E3', '· · 112 · · · 100 64 · · 108 · · · 100 60', '· · 1.5 · · · 1 0.5 · · 1.5 · · · 1 0.5'),
  b('· · A2 · · · A2 · · · C3 · · A2 G2 ·', '· · 112 · · · 100 · · · 104 · · 66 98 ·', '· · 1.5 · · · 1 · · · 1.5 · · 0.5 1 ·'),
  b('· · D3 · · · D3 D4 · · D3 · · · C3 ·', '· · 112 · · · 100 64 · · 108 · · · 98 ·', '· · 1.5 · · · 1 0.5 · · 1.5 · · · 1 ·'),
  b('· · E3 · · · E3 E4 · · E3 · · G3 A2 ·', '· · 112 · · · 100 64 · · 108 · · 70 110 ·', '· · 1.5 · · · 1 0.5 · · 1.5 · · 0.5 1.5 ·'),
]);

const STABS = melodic([
  b('· · A3 · · · · A3 · · A3 · · · · ·', '· · 100 · · · · 78 · · 92 · · · · ·', '· · 0.5 · · · · 0.5 · · 0.5 · · · · ·'),
  b('· · A3 · · · · · · · A3 · · A3 · ·', '· · 100 · · · · · · · 92 · · 74 · ·', '· · 0.5 · · · · · · · 0.5 · · 0.5 · ·'),
  b('· · D3 · · · · D3 · · D3 · · · · ·', '· · 100 · · · · 78 · · 92 · · · · ·', '· · 0.5 · · · · 0.5 · · 0.5 · · · · ·'),
  b('· · E3 · · · · E3 · · E3 · · · A3 ·', '· · 100 · · · · 80 · · 94 · · · 96 ·', '· · 0.5 · · · · 0.5 · · 0.5 · · · 0.5 ·'),
]);

const HOOK = melodic([
  b('· · E5 · · D5 · · C5 · · A4 · · C5 ·', '· · 100 · · 88 · · 94 · · 86 · · 80 ·', '· · 1.5 · · 1 · · 1 · · 1.5 · · 1 ·'),
  b('· · E5 · · D5 · · C5 · · D5 · · E5 ·', '· · 100 · · 88 · · 94 · · 86 · · 92 ·', '· · 1.5 · · 1 · · 1 · · 1 · · 2 ·'),
  b('· · F5 · · E5 · · D5 · · A4 · · D5 ·', '· · 100 · · 88 · · 94 · · 86 · · 80 ·', '· · 1.5 · · 1 · · 1 · · 1.5 · · 1 ·'),
  b('· · G5 · · E5 · · D5 · · B4 · · · ·', '· · 100 · · 88 · · 94 · · 90 · · · ·', '· · 1.5 · · 1 · · 1 · · 2 · · · ·'),
]);

const BREAK_HOOK = melodic([
  b('· · F5 · · E5 · · D5 · · A4 · · D5 ·', '· · 92 · · 84 · · 88 · · 80 · · 78 ·', '· · 1.5 · · 1 · · 1 · · 1.5 · · 1 ·'),
  b('· · F5 · · E5 · · D5 · · E5 · · F5 ·', '· · 92 · · 84 · · 88 · · 82 · · 86 ·', '· · 1.5 · · 1 · · 1 · · 1 · · 2 ·'),
  b('· · G5 · · E5 · · D5 · · B4 · · D5 ·', '· · 92 · · 84 · · 88 · · 80 · · 78 ·', '· · 1.5 · · 1 · · 1 · · 1.5 · · 1 ·'),
  b('· · G5 · · E5 · · D5 · · E5 · · · ·', '· · 92 · · 84 · · 88 · · 86 · · · ·', '· · 1.5 · · 1 · · 1 · · 4 · · · ·'),
]);

// The break pad: the stab tracks held for two bars each (Dm7, then Em7), turned into a pad by locks.
// Never the home chord: Am7 waits for Drop 2.
const PAD = withLocks(melodic([
  b('D3 · · · · · · · · · · · · · · ·', '90 · · · · · · · · · · · · · · ·', '32 · · · · · · · · · · · · · · ·'),
  null,
  b('E3 · · · · · · · · · · · · · · ·', '90 · · · · · · · · · · · · · · ·', '32 · · · · · · · · · · · · · · ·'),
  null,
]), { amp_atk: 72, amp_sus: 110, amp_rel: 96, flt1_frq: 58, amp_rev: 100, amp_vol: 84 });

/** E3 on 3, 7, 11 and 15 of each bar: the pedal on the fifth */
function pedalBars(bars: number, vel: number): MelodicBar[] {
  return Array.from({ length: bars }, () =>
    b('· · E3 · · · E3 · · · E3 · · · E3 ·', `· · ${vel} · · · ${vel} · · · ${vel} · · · ${vel} ·`, '· · 1 · · · 1 · · · 1 · · · 1 ·'));
}

/** Stabs on every 8th of a bar */
const eighths = (vels: number[]) => b(vels.map(() => 'E3 ·').join(' '), vels.map(v => `${v} ·`).join(' '), vels.map(() => '0.5 ·').join(' '));

function a4Patterns(): Record<string, Pattern> {
  const P = (name: string, tracks: Record<number, Record<number, Step>>) => elektronPattern(A4_TRACKS, { name, length: 64, swing: SWING }, tracks);

  // BUILD A: the bass pedals on E and brightens one filter step a bar (bar 1 keeps the kit's
  // cutoff); the stabs on E3 swell
  const buildABass = withLocks(melodic(pedalBars(4, 100)), (s): Locks => (s >= 16 ? { flt1_frq: [60, 64, 68, 71][Math.floor(s / 16)] } : {}));
  const buildAStabs = melodic([88, 92, 96, 100].map(v =>
    b('· · E3 · · · · · · · E3 · · · · ·', `· · ${v} · · · · · · · ${v} · · · · ·`, '· · 0.5 · · · · · · · 0.5 · · · · ·')));

  // BUILD B: the pedal a step brighter for 3 bars, 8th-note stabs rising in level and filter, and a
  // noise riser: one 64-step note whose parameter slide carries the filter from dark to bright
  const buildBBass = withLocks(melodic([...pedalBars(3, 104), null]), { flt1_frq: 75 });
  const buildBStabs = withLocks(melodic([
    eighths([80, 81, 83, 84, 85, 87, 88, 89]),
    eighths([90, 92, 93, 94, 96, 97, 98, 100]),
    eighths([101, 102, 103, 105, 106, 107, 109, 110]),
    b('E3 · E3 · E3 · E3 · · · · · · · · ·', '112 · 112 · 112 · 112 · · · · · · · · ·', '0.5 · 0.5 · 0.5 · 0.5 · · · · · · · · ·'),
  ]), s => ({ flt1_frq: [69, 75, 81, 86][Math.floor(s / 16)], ...(s >= 48 ? { amp_del: 70 } : {}) }));
  const RISER_LOCKS: Locks = { osc1_lev: 0, osc2_lev: 0, noise_lev: 110, flt1_frq: 34, amp_sus: 110 };
  const riser: Record<number, Step> = {
    0: { note: nn('E4'), vel: 100, len: lenIndex(64), pslide: true, locks: RISER_LOCKS },
    63: { trigless: true, locks: { ...RISER_LOCKS, flt1_frq: 118, noise_lev: 120 } },
  };

  return {
    A01: P('GROOVE', { 0: BASS }),
    A02: P('DROP', { 0: BASS, 1: STABS, 2: STABS }),
    A03: P('BREAK', { 1: PAD, 2: PAD, 3: BREAK_HOOK }),
    A04: P('BUILD A', { 0: buildABass, 1: buildAStabs, 2: buildAStabs }),
    A05: P('BUILD B', { 0: buildBBass, 1: buildBStabs, 2: buildBStabs, 3: riser }),
    A06: P('DROP 2', { 0: BASS, 1: STABS, 2: STABS, 3: HOOK }),
    // OUTRO A: the hook is out, the stabs play the first 4-bar loop only (1:2), the bass to the end
    A07: P('OUTRO', { 0: BASS, 1: withCondition(STABS, '1:2'), 2: withCondition(STABS, '1:2') }),
  };
}

// ----------------------------------------------------------------------------
// Xone:96 (channel 1 Rytm, 2 Analog Four, A delay return, B reverb return)
// ----------------------------------------------------------------------------

// Gain staging: GAIN sets each channel's meter (peaks around +6), the faders the balance - the
// bass 2 dB under the kick at the Xone's output. The twin's faders follow the hardware's
// constant-power curve (8.0 on the dial is -10 dB), so they sit higher than the design's 8.0 / 7.2,
// and SEND 2 / channel B are up from 1.0 / 5.5 for the shared room to be audible at all.
const XONE: Values = {
  // the built-in decks stay silent: every channel hears its studio input or FX return
  ch1_src: XDECK_NONE, ch2_src: XDECK_NONE, ch3_src: XDECK_NONE, ch4_src: XDECK_NONE, cha_src: XDECK_NONE, chb_src: XDECK_NONE,
  ch1_input: 2, ch2_input: 2, cha_input: 2, chb_input: 2,
  ch1_gain: 1, ch1_hi: xoneKill(-1), ch1_himid: 0, ch1_lomid: xoneMid(-2), ch1_lo: 0, ch1_fader: 9, ch1_snd1: 0, ch1_snd2: 0, ch1_filter: XFILTER.off,
  ch2_gain: 1, ch2_hi: xoneKill(-1.5), ch2_himid: xoneMid(1.5), ch2_lomid: xoneMid(-3), ch2_lo: 0, ch2_fader: 10, ch2_snd1: 0, ch2_snd2: 4, ch2_filter: XFILTER.off,
  cha_hi: xoneKill(-3), cha_mid: 0, cha_lo: xoneKill(-12), cha_fader: 5, cha_filter: XFILTER.off,
  chb_hi: xoneKill(-2), chb_mid: xoneMid(-2, true), chb_midf: 400, chb_lo: xoneKill(-12), chb_fader: 9, chb_filter: XFILTER.off,
  // FX unit: DELAY 3/16, FDBK 4.0, REVERB 2.2 s; FILTER 1 HPF RES 4 (Build B), FILTER 2 LPF RES 2 (Groove)
  fx_time: 1, fx_fdbk: 4, fx_size: 2.2,
  f1_on: true, f1_type: XTYPE.hpf, f1_freq: 140, f1_res: 4, f1_crunch: 0,
  f2_on: true, f2_type: XTYPE.lpf, f2_freq: 900, f2_res: 2, f2_crunch: 0,
  master: 8, monitor_out: 0, bpm: BPM, play: false,
};

/** Xone snapshot: which channels are on a filter in this section */
const filters = (ch1: number, ch2: number) => ({ snapshot: { ch1_filter: ch1, ch2_filter: ch2 } });

// ----------------------------------------------------------------------------
// The studio
// ----------------------------------------------------------------------------

export function build(): { devices: Record<string, InstanceState>; studio: StudioDoc; currentDevice: string } {
  const rytmData = rytmProject({
    kitName: 'LOW TIDE',
    kit: RYTM_KIT,
    patterns: rytmPatterns(),
    songName: 'LOW TIDE LIGHTS',
    song: [
      { pattern: 'A01', repeats: 8 }, { pattern: 'A02', repeats: 8 }, { pattern: 'A03', repeats: 16 }, { pattern: 'A04', repeats: 8 },
      { pattern: 'A05', repeats: 4 }, { pattern: 'A06', repeats: 1 }, { pattern: 'A07', repeats: 16 }, { pattern: 'A03', repeats: 8 },
      { pattern: 'A01', repeats: 8 },
    ],
  });
  const a4Data = createProject({ tracks: A4_TRACKS, defaults: [
    { note: nn('A2'), vel: 100, len: lenIndex(1) }, { note: nn('A3'), vel: 100, len: lenIndex(0.5) },
    { note: nn('A3'), vel: 100, len: lenIndex(0.5) }, { note: nn('E5'), vel: 100, len: lenIndex(1) },
  ], active: 'A01', mode: 'pattern', patterns: a4Patterns() });
  a4Data.song = {
    name: 'LOW TIDE LIGHTS', loop: false,
    rows: [{ pattern: 'A01', repeats: 2 }, { pattern: 'A02', repeats: 4 }, { pattern: 'A03', repeats: 2 }, { pattern: 'A04', repeats: 1 },
      { pattern: 'A05', repeats: 1 }, { pattern: 'A06', repeats: 4 }, { pattern: 'A07', repeats: 2 }],
  };

  const [intro, groove, drop1, brk, buildA, buildB, drop2, outroA, outroB] = META.sections;
  const S = (m: typeof intro, parts: Parameters<typeof section>[4]) => section(m.id, m.name, m.bars, m.color, parts);
  const off = XFILTER.off;
  const sections = [
    S(intro, { 'analog-rytm': { pattern: 'A01' }, 'analog-four': { muted: true }, xone96: filters(off, off) }),
    S(groove, { 'analog-rytm': { pattern: 'A02' }, 'analog-four': { pattern: 'A01' }, xone96: filters(off, XFILTER.two) }),
    S(drop1, { 'analog-rytm': { pattern: 'A03' }, 'analog-four': { pattern: 'A02' }, xone96: filters(off, off) }),
    S(brk, { 'analog-rytm': { pattern: 'A04' }, 'analog-four': { pattern: 'A03' }, xone96: filters(off, off) }),
    S(buildA, { 'analog-rytm': { pattern: 'A05' }, 'analog-four': { pattern: 'A04' }, xone96: filters(off, off) }),
    S(buildB, { 'analog-rytm': { pattern: 'A06' }, 'analog-four': { pattern: 'A05' }, xone96: filters(XFILTER.one, off) }),
    S(drop2, { 'analog-rytm': { pattern: 'A07' }, 'analog-four': { pattern: 'A06' }, xone96: filters(off, off) }),
    S(outroA, { 'analog-rytm': { pattern: 'A03' }, 'analog-four': { pattern: 'A07' }, xone96: filters(off, off) }),
    S(outroB, { 'analog-rytm': { pattern: 'A01' }, 'analog-four': { muted: true }, xone96: filters(off, off) }),
  ];

  const devices: Record<string, InstanceState> = {
    'studio-clock': instance({ division: 2, pulse_width: 5 }),
    'analog-rytm': instance({ ...RYTM_KIT, bpm: BPM, kit_demo: 0, track: 0, page: 1, play: false }, { data: rytmData }),
    'analog-four': instance({ ...A4_SOUND, tempo: BPM, swing: SWING, kit_project: 0, kit_project_loaded: 0, track: 0, page: 2, play: false }, { data: a4Data }),
    xone96: instance(XONE),
  };

  const studio: StudioDoc = {
    rack: [
      { id: 'studio-clock', device: 'studio-clock' },
      { id: 'analog-rytm', device: 'analog-rytm' },
      { id: 'analog-four', device: 'analog-four' },
      { id: 'xone96', device: 'xone96' },
    ],
    cables: [],
    routes: { 'analog-rytm': 'xone96:studio_1', 'analog-four': 'xone96:studio_2' },
    sync: { 'analog-rytm': true, 'analog-four': true, xone96: true },
    bpm: BPM,
    // swing lives in the patterns (54 % on both Elektrons), not on the studio clock
    swing: 0,
    arrangement: { enabled: true, loop: false, sections },
    off: {},
    // the Xone's own channel +6 dB and the master DRIVE +6 dB into the -1 dBTP limiter:
    // about -10.5 LUFS integrated
    mixer: mixer({
      'studio-clock': strip(0),
      'analog-rytm': strip(0),
      'analog-four': strip(0),
      xone96: strip(6),
    }, 6),
  };
  return { devices, studio, currentDevice: 'analog-rytm' };
}
