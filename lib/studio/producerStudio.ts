// ============================================================================
// The Producer path studio, built from instruments on this branch: the Studio
// Clock, a DFAM and the Xone:96 (docs/research/producer-path/curriculum.md).
//
// The track is "Tide Pool": deep house in A minor at 124 BPM (Am7 - Fmaj7 - C - G).
// The Xone:96's built-in decks play its stems, which follow the studio clock
// like MIDI-synced machines: DRUMS on channel 1, BASS on 2, STABS on 3. The
// DFAM is the learner's own part: a knock-and-tick percussion loop clocked by
// cable from the Studio Clock, on channel 4. Channels A and B return the Xone's
// delay (SEND 1) and reverb (SEND 2). The studio master (limiter at -1 dBTP and
// the BS.1770 meter) and Bounce finish the chain.
//
// Each lesson's checkpoint is this studio plus the changes listed with it, so a
// learner can start any lesson and every check knows what it starts from.
// ============================================================================

import type { ControlValue, LessonStudioStart } from '@/types';
import { SRC } from '@/devices/xone96/model';
import { XONE96_PRESETS } from '@/devices/xone96/presets';
import { DFAM_PRESETS } from '@/devices/dfam/presets';
import { killKnob, midKnob } from './checks';

type Values = Record<string, ControlValue>;

const st = (semitones: number) => Math.round((semitones / 12) * 10000) / 10000;

/** The DFAM's eight steps: pitch in semitones and velocity in % */
function dfamSteps(pitch: number[], vel: number[]): Values {
  const v: Values = {};
  for (let i = 0; i < 8; i++) {
    v[`pitch_${i + 1}`] = st(pitch[i] ?? 0);
    v[`velocity_${i + 1}`] = vel[i] ?? 100;
  }
  return v;
}

/**
 * "Knock perc": a triangle knock with a fast pitch blip (VCO EG), a breath of noise and a
 * low-pass pluck. Eight 16ths, a half-bar loop: quiet ticks around loud knocks on the
 * "and"s (steps 3 and 7) and a pick-up on step 8, so it grooves against the kick instead
 * of doubling it. Notes C, G and F: all in A minor. Sits in the mids (250 Hz - 2 kHz).
 */
export const DFAM_KNOCK: Values = {
  ...DFAM_PRESETS.init.settings,
  vco1_wave: 1, vco1_frequency: 1, vco1_eg_amount: 30, vco_decay: 30, vco1_level: 85,
  vco2_level: 0, noise_level: 15, fm_amount: 0, hard_sync: 1, seq_pitch_mod: 0,
  vcf_mode: 1, vcf_cutoff: 3000, vcf_resonance: 15, vcf_eg_amount: 30, vcf_decay: 80, noise_vcf_mod: 0,
  vca_attack_mode: 0, vca_decay: 120, volume: 85, run_stop: false,
  ...dfamSteps([0, 12, 7, 12, 0, 12, 5, 12], [55, 25, 100, 35, 50, 25, 90, 60]),
};

/** The same loop as a first attempt often sounds: tuned an octave down, long and wide open - boomy toms in the bass's range */
export const DFAM_BOOMY: Values = { ...DFAM_KNOCK, vco1_frequency: 0, vca_decay: 300, vcf_cutoff: 6000 };

/** The Xone:96 desk with the Tide Pool stems on channels 1-3 and the DFAM on 4 */
export function xoneDesk(extra: Values = {}): Values {
  return {
    ...XONE96_PRESETS.init.settings,
    ch1_src: SRC.DRUMS, ch2_src: SRC.BASS, ch3_src: SRC.STABS, ch4_src: SRC.NONE,
    cha_input: 2, chb_input: 2,
    // A balanced starting mix (CONST PWR faders: 9.5 is about -2 dB, 8.5 about -8 dB) with headroom
    ch1_fader: 10, ch2_fader: 9.5, ch3_fader: 8.5, ch4_fader: 8.5,
    cha_fader: 7, chb_fader: 7,
    master: 7,
    fx_time: 1, fx_fdbk: 4, fx_size: 2.2,
    play: false,
    ...extra,
  };
}

export const CLOCK_VALUES: Values = { division: 2, pulse_width: 5 };

/** The Tide Pool studio; `xone`, `dfam` and the rest override the defaults */
export function producerStudio(opts: {
  xone?: Values;
  dfam?: Values;
  clock?: Values;
  mixer?: LessonStudioStart['mixer'];
  arrangement?: LessonStudioStart['arrangement'];
  ownStudio?: string;
  bpm?: number;
  swing?: number;
} = {}): LessonStudioStart {
  return {
    rack: [
      { id: 'studio-clock', device: 'studio-clock', values: { ...CLOCK_VALUES, ...(opts.clock ?? {}) } },
      { id: 'dfam', device: 'dfam', label: 'DFAM perc', values: { ...DFAM_KNOCK, ...(opts.dfam ?? {}) } },
      { id: 'xone96', device: 'xone96', values: xoneDesk(opts.xone) },
    ],
    routes: { dfam: 'xone96:studio_4' },
    sync: { xone96: true },
    cables: [{ from: { instance: 'studio-clock', jack: 'out_clock' }, to: { instance: 'dfam', jack: 'in_adv_clock' }, color: '#38bdf8' }],
    bpm: opts.bpm ?? 124,
    swing: opts.swing ?? 0,
    mixer: opts.mixer ?? {},
    ...(opts.arrangement ? { arrangement: opts.arrangement } : {}),
    focus: 'xone96',
    ...(opts.ownStudio ? { ownStudio: opts.ownStudio } : {}),
    alignClocked: true,
  };
}

// ---- checkpoints ---------------------------------------------------------------------

/**
 * Frequency slots, start: the "muddy mix". The stabs channel has its LO and LO MID boosted,
 * the bass channel's LO MID too, and the DFAM perc is tuned down and wide open.
 */
export const CP_MUDDY = {
  xone: { ch3_lo: killKnob(6), ch3_lomid: midKnob(5), ch2_lomid: midKnob(4) },
  dfam: DFAM_BOOMY,
};

/** Frequency slots, one solution: the DFAM high-passed, the stabs' lows and low mids cut, the bass flat */
export const CP_SLOTTED = {
  xone: { ch3_lo: killKnob(-6), ch3_lomid: midKnob(-3), ch2_lomid: 0 },
  dfam: { ...DFAM_BOOMY, vcf_mode: 0, vcf_cutoff: 220 },
};
