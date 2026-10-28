// ============================================================================
// Xone:96 presets: mix scenes and DJ setups, named "Category / Name" (the
// preset menu groups by category). The hardware has no preset memory, so all
// of these are community techniques set up on the twin. Every preset states
// all six built-in deck sources, so it sounds the same whatever was loaded
// before, and every one makes sound on its own with PLAY (or the studio ▶);
// the Studio presets use decks as stand-ins until instruments are routed in.
// ============================================================================

import type { PresetSpec } from '@/types';
import { SRC } from './model';

type Values = Record<string, number | boolean>;

/** A neutral desk: every channel at unity, EQ flat, no sends, no assigns, no cue */
function desk(): Values {
  const v: Values = {};
  for (const c of ['a', 'b', '1', '2', '3', '4']) {
    v[`ch${c}_gain`] = 0; v[`ch${c}_hi`] = 0; v[`ch${c}_lo`] = 0; v[`ch${c}_fader`] = 10;
    v[`ch${c}_filter`] = 1; v[`ch${c}_xf`] = 1; v[`ch${c}_cue`] = false; v[`ch${c}_input`] = 2;
    v[`ch${c}_snd1`] = 0; v[`ch${c}_snd2`] = 0; v[`ch${c}_pre`] = false;
    if (c === 'a' || c === 'b') { v[`ch${c}_mid`] = 0; v[`ch${c}_midf`] = 700; }
    else { v[`ch${c}_himid`] = 0; v[`ch${c}_lomid`] = 0; }
  }
  Object.assign(v, {
    cha_src: SRC.LEAD, chb_src: SRC.PAD, ch1_src: SRC.NONE, ch2_src: SRC.NONE, ch3_src: SRC.NONE, ch4_src: SRC.NONE,
    f1_on: false, f1_type: 0, f1_freq: 20, f1_res: 2, f1_crunch: 0,
    f2_on: false, f2_type: 2, f2_freq: 20000, f2_res: 2, f2_crunch: 0,
    xfader: 5, xf_curve: 0, fader_curve: 0,
    master: 8, booth: 7, booth_mono: false, booth_mute: false, booth_lo: 0, booth_mid: 0, booth_hi: 0,
    cue_mix: 0, phones: 6, split_cue: false, cue_post_eq: true, monitor_out: 0,
    rtnc_level: 0, rtnc_on: true, rtnc_cue: false, rtnd_level: 0, rtnd_on: true, rtnd_cue: false,
    fx_time: 1, fx_fdbk: 4.5, fx_size: 2.5,
  });
  return v;
}

function preset(name: string, description: string, settings: Values, source: PresetSpec['source'] = 'community'): PresetSpec {
  return { name, description, source, settings: { ...desk(), ...settings } };
}

export const XONE96_PRESETS: Record<string, PresetSpec> = {
  init: preset('Init / Clean slate',
    'Every channel at unity, EQ flat, filters off, crossfader out of the way. TRACK A on channel 1 - press PLAY.',
    { ch1_src: SRC.TRACK_A }, 'factory'),

  // ---------------------------------------------------------------- DJ
  two_decks: preset('DJ / Blend-ready: two decks',
    'TRACK A live on X, TRACK B waiting on Y and cued in the headphones, gains matched, crossfader hard to X. Slide it across on a phrase.',
    { ch1_src: SRC.TRACK_A, ch2_src: SRC.TRACK_B, ch1_xf: 0, ch2_xf: 2, xfader: 0, xf_curve: 0, ch2_cue: true }),
  bass_swap: preset('DJ / Bass swap',
    'Both tracks up on their faders, TRACK B with its LO killed. On the first beat of a phrase, swap the two LO knobs so only one bassline plays.',
    { ch1_src: SRC.TRACK_A, ch2_src: SRC.TRACK_B, ch2_lo: -1, ch2_fader: 9 }),
  filter_build: preset('DJ / Filter build (HPF)',
    'TRACK A through FILTER 1: high-pass with the resonance up and a little CRUNCH. Turn FREQ clockwise to build, then back to 20 Hz for the drop.',
    { ch1_src: SRC.TRACK_A, ch1_filter: 0, f1_on: true, f1_type: 0, f1_freq: 300, f1_res: 6, f1_crunch: 2 }),
  lpf_breakdown: preset('DJ / Low-pass breakdown',
    'TRACK B through FILTER 2, a resonant low-pass at 450 Hz: the muffled "next room" sound of a breakdown. Open FREQ slowly back to 20 kHz.',
    { ch2_src: SRC.TRACK_B, ch2_filter: 2, f2_on: true, f2_type: 2, f2_freq: 450, f2_res: 5 }),
  fast_cut: preset('DJ / Fast-cut chops',
    'XFADER CURVE on FAST CUT: DRUMS on X, STABS on Y. Flick the crossfader to chop the stabs in on the beat - cut mixing, not blending.',
    { ch1_src: SRC.DRUMS, ch2_src: SRC.STABS, ch1_xf: 0, ch2_xf: 2, xfader: 0, xf_curve: 2, fader_curve: 2 }),

  // ---------------------------------------------------------------- FX
  dub_throw: preset('FX / Dub delay throw',
    'STABS on channel 3 into SEND 1 (the 3/16 delay), returned on channel A with its LO cut. DRUMS dry on channel 1. Flick SEND 1 up on a stab and back.',
    {
      ch1_src: SRC.DRUMS, ch3_src: SRC.STABS, ch3_snd1: 7, ch1_fader: 9,
      cha_input: 2, cha_lo: -0.6, cha_fader: 9, fx_time: 1, fx_fdbk: 6,
    }),
  reverb_wash: preset('FX / Reverb wash',
    'PAD on channel 4 drowning in SEND 2 (a 5 s reverb returned on channel B), DRUMS dry on channel 1. SEND 2 is post-fader: pull the PAD fader down and the reverb stops being fed, so its tail rings out on its own.',
    { ch1_src: SRC.DRUMS, ch4_src: SRC.PAD, ch4_snd2: 7, chb_input: 2, chb_fader: 9, fx_size: 5 }),

  // ---------------------------------------------------------------- Stems
  stem_jam: preset('Stems / Stem jam',
    'Six stems on six channels: DRUMS, BASS, STABS and PERC on 1-4, the sung lead and the pad on A and B (MIC). Ride the faders and the EQ.',
    {
      ch1_src: SRC.DRUMS, ch2_src: SRC.BASS, ch3_src: SRC.STABS, ch4_src: SRC.PERC,
      cha_input: 1, chb_input: 1, ch1_fader: 9.5, ch2_fader: 9, ch3_fader: 7.5, ch4_fader: 7.5, cha_fader: 7, chb_fader: 6.5,
      ch3_snd2: 3,
    }),
  kick_vs_bass: preset('Stems / Kick vs bass: carved low end',
    'DRUMS and BASS share the low end. The bass has LO trimmed and the drums have LO MID cut, so the kick punches and the bass sits under it.',
    { ch1_src: SRC.DRUMS, ch2_src: SRC.BASS, ch1_lomid: -0.4, ch2_lo: -0.3, ch2_himid: 0.2 }),

  // ---------------------------------------------------------------- Cue
  split_cue: preset('Cue / Split-cue headphones',
    'YOU HEAR set to PHONES with SPLIT CUE: TRACK B (cued) in your left ear, the live mix (TRACK A) in the right. Line them up before the crowd hears B.',
    {
      ch1_src: SRC.TRACK_A, ch2_src: SRC.TRACK_B, ch1_xf: 0, ch2_xf: 2, xfader: 0,
      ch2_cue: true, split_cue: true, monitor_out: 2, phones: 7,
    }),

  // ---------------------------------------------------------------- Studio
  studio_elektrons: preset('Studio / Route the Elektrons in',
    'Ready for the Elektron live set: CH 1 for the Analog Rytm, CH 2 for the Analog Four (Studio tab → each instrument\'s Output). Until they are routed, DRUMS and BASS decks stand in. The bass gives the kick some room.',
    {
      ch1_src: SRC.DRUMS, ch2_src: SRC.BASS, ch1_lomid: -0.25, ch2_lo: -0.2, ch2_fader: 9, ch1_snd2: 1.5,
    }),
  studio_mixdown: preset('Studio / Full-track mix-down',
    'Four instruments on CH 1-4 (drums, bass, synth, percussion), a send of reverb on the synth and delay on the percussion. Decks stand in until you route your instruments.',
    {
      ch1_src: SRC.DRUMS, ch2_src: SRC.BASS, ch3_src: SRC.STABS, ch4_src: SRC.PERC,
      ch1_fader: 9.5, ch2_fader: 9, ch3_fader: 7.5, ch4_fader: 7, ch2_lo: -0.15, ch3_lo: -1, ch3_snd2: 3, ch4_snd1: 2.5, ch4_hi: -0.2,
    }),
};
