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
  /** Leave the clock cable out (the lesson patches it) */
  noCable?: boolean;
  /** Park clock-stepped DFAMs on ▶ (default true; the clock lesson teaches doing it by hand) */
  alignClocked?: boolean;
} = {}): LessonStudioStart {
  return {
    rack: [
      { id: 'studio-clock', device: 'studio-clock', values: { ...CLOCK_VALUES, ...(opts.clock ?? {}) } },
      { id: 'dfam', device: 'dfam', label: 'DFAM perc', values: { ...DFAM_KNOCK, ...(opts.dfam ?? {}) } },
      { id: 'xone96', device: 'xone96', values: xoneDesk(opts.xone) },
    ],
    routes: { dfam: 'xone96:studio_4' },
    sync: { xone96: true },
    cables: opts.noCable ? [] : [{ from: { instance: 'studio-clock', jack: 'out_clock' }, to: { instance: 'dfam', jack: 'in_adv_clock' }, color: '#38bdf8' }],
    bpm: opts.bpm ?? 124,
    swing: opts.swing ?? 0,
    mixer: opts.mixer ?? {},
    ...(opts.arrangement ? { arrangement: opts.arrangement } : {}),
    focus: 'xone96',
    ...(opts.ownStudio ? { ownStudio: opts.ownStudio } : {}),
    alignClocked: opts.alignClocked ?? true,
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

/**
 * Frequency slots, one solution: the DFAM high-passed, the stabs' lows and low mids cut, the
 * bass flat. The high-pass takes the perc's fundamental away, so its VOLUME comes up to full
 * (the level is fixed at the instrument, the way the mixdown lesson teaches).
 */
export const CP_SLOTTED = {
  xone: { ch3_lo: killKnob(-6), ch3_lomid: midKnob(-3), ch2_lomid: 0 } as Values,
  dfam: { ...DFAM_BOOMY, vcf_mode: 0, vcf_cutoff: 220, volume: 100 } as Values,
};

/** Space and depth, start: the slotted mix, completely dry. The delay is on 1/8, the returns flat. */
export const CP_DRY = {
  xone: { ...CP_SLOTTED.xone, fx_time: 0, fx_fdbk: 4, fx_size: 1.2, cha_fader: 7, chb_fader: 7 } as Values,
  dfam: CP_SLOTTED.dfam,
};

/** Space and depth, one solution: perc in a dotted-8th delay, stabs in the reverb, returns kept out of the lows */
export const CP_SPACED = {
  xone: {
    ...CP_DRY.xone,
    ch4_snd1: 5, ch3_snd2: 4.5, fx_time: 1, fx_fdbk: 4, fx_size: 3,
    cha_lo: killKnob(-12), chb_lo: killKnob(-12), cha_fader: 7, chb_fader: 7,
  } as Values,
  dfam: CP_SLOTTED.dfam,
};

/**
 * Mixdown, start: the "rough mix". Every fader up, the drums' GAIN at +9 dB and the stabs' at
 * +8 so their PK LEDs light, the returns as loud as the instruments and MASTER 1 fully up, so
 * the studio limiter is crushing the peaks. The booth is at unity for a fair mono check.
 */
export const CP_ROUGH = {
  xone: {
    ...CP_SPACED.xone,
    ch1_fader: 10, ch2_fader: 10, ch3_fader: 10, ch4_fader: 10, cha_fader: 10, chb_fader: 10,
    ch1_gain: 9, ch3_gain: 8, master: 10, booth: 8,
  } as Values,
  dfam: CP_SLOTTED.dfam,
};

/**
 * Mixdown, one solution (and the master lesson's start): every channel peaking about +3 to +6
 * on its meter, the drums leading, the bass 2 dB under them, stabs and perc further down,
 * returns below the instruments, and MASTER 1 set for about -6 dBFS peaks at the studio master.
 */
export const CP_MIXED = {
  xone: {
    ...CP_ROUGH.xone,
    // measured on the quasi-peak channel meters (Xone:96 review): drums +4, bass +4, stabs +4,
    // perc +3 dBu; the perc and the stabs need more GAIN than the decks to read that high, so
    // their faders sit lower for the same balance
    ch1_gain: 0, ch2_gain: -1, ch3_gain: 2, ch4_gain: 10,
    ch1_fader: 10, ch2_fader: 9.5, ch3_fader: 8.4, ch4_fader: 7.4, cha_fader: 7.5, chb_fader: 7.5,
    master: 7.75, booth: 8,
  } as Values,
  dfam: CP_SLOTTED.dfam,
};

// ---- the song ----------------------------------------------------------------------

/** Deck sources of a section: what channels 1-3 play */
const decks = (ch1: number, ch2: number, ch3: number): Values => ({ ch1_src: ch1, ch2_src: ch2, ch3_src: ch3 });

type Section = NonNullable<LessonStudioStart['arrangement']>['sections'][number];
const section = (name: string, bars: number, xone: Values, opts: { dfamMuted?: boolean; clock?: Values; dfam?: Values } = {}): Section => ({
  name,
  bars,
  parts: {
    xone96: { snapshot: xone },
    ...(opts.dfamMuted ? { dfam: { muted: true } } : opts.dfam ? { dfam: { snapshot: opts.dfam } } : {}),
    ...(opts.clock ? { 'studio-clock': { snapshot: opts.clock } } : {}),
  },
});

/**
 * The Tide Pool song: 72 bars, 2:19 at 124 BPM. Each section switches which stems the decks
 * play (like an Elektron pattern change) and mutes the DFAM where it sits out, so the mix
 * itself (GAIN, EQ, faders, sends) stays one static mix underneath.
 *   Intro 8 · Groove 8 · Drop 16 · Break 8 · Build 7 · Fill 1 · Drop 2 16 · Outro 8
 */
export function songSections(): Section[] {
  return [
    section('Intro', 8, decks(SRC.DRUMS, SRC.NONE, SRC.NONE), { dfamMuted: true }),
    section('Groove', 8, decks(SRC.DRUMS, SRC.BASS, SRC.NONE)),
    section('Drop', 16, decks(SRC.DRUMS, SRC.BASS, SRC.STABS)),
    section('Break', 8, decks(SRC.PERC, SRC.NONE, SRC.PAD), { dfamMuted: true }),
    section('Build', 7, decks(SRC.DRUMS, SRC.NONE, SRC.STABS)),
    section('Fill', 1, decks(SRC.DRUMS, SRC.NONE, SRC.STABS)),
    section('Drop 2', 16, decks(SRC.DRUMS, SRC.BASS, SRC.STABS)),
    section('Outro', 8, decks(SRC.DRUMS, SRC.NONE, SRC.NONE)),
  ];
}

/** Filter-off and clock-back values a section uses to undo a transition */
const FILTERS_OFF: Values = { ch1_filter: 1, ch2_filter: 1, f1_on: false, f2_on: false };

/**
 * The song with its transitions (the Transitions lesson's solution): the bass enters through
 * FILTER 2's low-pass in the Groove, the Build high-passes the drums through FILTER 1, the
 * Fill bar drops the drums out while the DFAM rolls in 32nds, and Drop 2 puts it all back.
 */
export function songWithTransitions(): Section[] {
  const s = songSections();
  const patch = (name: string, xone: Values, opts: { clock?: Values } = {}) => {
    const x = s.find(v => v.name === name)!;
    x.parts = { ...x.parts, xone96: { snapshot: { ...(x.parts?.xone96?.snapshot ?? {}), ...xone } } };
    if (opts.clock) x.parts['studio-clock'] = { snapshot: opts.clock };
  };
  patch('Intro', FILTERS_OFF, { clock: { division: 2 } });
  patch('Groove', { ch2_filter: 2, f2_on: true, f2_type: 2, f2_freq: 900, f2_res: 2 });
  patch('Drop', FILTERS_OFF);
  patch('Build', { ch1_filter: 0, f1_on: true, f1_type: 0, f1_freq: 300, f1_res: 5 });
  patch('Fill', { ch1_src: SRC.NONE }, { clock: { division: 3 } });
  patch('Drop 2', FILTERS_OFF, { clock: { division: 2 } });
  return s;
}
