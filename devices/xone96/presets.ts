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
    v[`ch${c}_filter`] = 1; v[`ch${c}_cue`] = false; v[`ch${c}_input`] = 2;
    v[`ch${c}_snd1`] = 0; v[`ch${c}_snd2`] = 0; v[`ch${c}_pre`] = false;
    // CH A/B are not on the crossfader (guide p.12)
    if (c === 'a' || c === 'b') { v[`ch${c}_mid`] = 0; v[`ch${c}_midf`] = 650; }
    else { v[`ch${c}_himid`] = 0; v[`ch${c}_lomid`] = 0; v[`ch${c}_xf`] = 1; }
  }
  Object.assign(v, {
    cha_src: SRC.LEAD, chb_src: SRC.PAD, ch1_src: SRC.NONE, ch2_src: SRC.NONE, ch3_src: SRC.NONE, ch4_src: SRC.NONE,
    f1_on: false, f1_type: 0, f1_freq: 20, f1_res: 2, f1_crunch: 0,
    f2_on: false, f2_type: 2, f2_freq: 20000, f2_res: 2, f2_crunch: 0,
    xfader: 5, xf_curve: 0, fader_curve: 0,
    master: 8, master2: 8, booth: 7, booth_mono: false, booth_mute: false, booth_lo: 0, booth_mid: 0, booth_hi: 0,
    cue_mix: 0, phones: 6, split_cue: false, cue_post_eq: true, cue_latch: false, monitor_out: 0,
    phones2_src: 0, phones2_mix: 0, phones2: 6,
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
    'TRACK A through FILTER 1: high-pass with the resonance up and a little CRUNCH. Turn FREQ clockwise to build, then back to 20 Hz (or FILTER ON off) for the drop.',
    { ch1_src: SRC.TRACK_A, ch1_filter: 0, f1_on: true, f1_type: 0, f1_freq: 300, f1_res: 7, f1_crunch: 2 }),
  lpf_breakdown: preset('DJ / Low-pass breakdown',
    'TRACK B through FILTER 2, a resonant low-pass at 450 Hz: the muffled "next room" sound of a breakdown. Open FREQ slowly back to 20 kHz.',
    { ch2_src: SRC.TRACK_B, ch2_filter: 2, f2_on: true, f2_type: 2, f2_freq: 450, f2_res: 7 }),
  cross_filter: preset('DJ / Cross-filter swap',
    'Two filters at once: TRACK A on FILTER 1 (high-pass), TRACK B on FILTER 2 (low-pass at 250 Hz, its LO killed). Raise FILTER 1 FREQ while you open FILTER 2, swap the basses halfway, then switch both FILTER assigns OFF.',
    {
      ch1_src: SRC.TRACK_A, ch2_src: SRC.TRACK_B, ch1_filter: 0, ch2_filter: 2, ch2_lo: -1,
      f1_on: true, f1_type: 0, f1_freq: 20, f1_res: 3, f2_on: true, f2_type: 2, f2_freq: 250, f2_res: 3,
    }),
  fast_cut: preset('DJ / Fast-cut chops',
    'XFADER curve on FAST CUT: DRUMS on X, STABS on Y. Flick the crossfader to chop the stabs in on the beat - cut mixing, not blending. Try TRANSITION and CONST PWR to hear the difference.',
    { ch1_src: SRC.DRUMS, ch2_src: SRC.STABS, ch1_xf: 0, ch2_xf: 2, xfader: 0, xf_curve: 2, fader_curve: 2 }),

  // ---------------------------------------------------------------- Filter
  telephone: preset('Filter / Telephone breakdown (BPF + CRUNCH)',
    'TRACK A through FILTER 2 on band-pass at 1.2 kHz with CRUNCH 3: thin and gritty, like a cheap speaker. Press FILTER 2 ON off for the drop.',
    { ch1_src: SRC.TRACK_A, ch1_filter: 2, f2_on: true, f2_type: 1, f2_freq: 1200, f2_res: 6, f2_crunch: 3 }),
  notch_sweep: preset('Filter / Notch sweep (HPF + LPF together)',
    'HPF and LPF lit together on FILTER 1 make a notch: a moving hole in the STABS. Sweep FREQ slowly between 400 Hz and 4 kHz. Light all three for an all-pass bell that RES boosts or cuts.',
    { ch1_src: SRC.DRUMS, ch3_src: SRC.STABS, ch1_fader: 9, ch3_fader: 9, ch3_filter: 0, f1_on: true, f1_type: 5, f1_freq: 600, f1_res: 4 }),

  // ---------------------------------------------------------------- FX
  dub_throw: preset('FX / Dub delay throw',
    'STABS on channel 3 into SEND 1 (the 3/16 delay), returned on channel A with its LO killed. DRUMS dry on channel 1. Flick SEND 1 up on a stab and back.',
    {
      ch1_src: SRC.DRUMS, ch3_src: SRC.STABS, ch3_snd1: 6, ch1_fader: 9, ch3_fader: 8,
      cha_input: 2, cha_lo: -1, cha_hi: -0.21, cha_fader: 8, fx_time: 1, fx_fdbk: 5.5,
    }),
  reverb_wash: preset('FX / Reverb wash',
    'PAD on channel 4 drowning in SEND 2 (a 5 s reverb returned on channel B), DRUMS dry on channel 1. SEND 2 is post-fader: pull the PAD fader down and the reverb stops being fed, so its tail rings out on its own.',
    { ch1_src: SRC.DRUMS, ch4_src: SRC.PAD, ch4_snd2: 6, chb_input: 2, chb_fader: 9, chb_lo: -0.44, fx_size: 5 }),
  prefade_ghost: preset('FX / Pre-fade echo ghost',
    'PERC on channel 4 sends to the delay with PRE lit. Pull channel 4\'s fader down: the dry percussion vanishes but its echoes carry on, because a PRE send ignores the fader. Close SEND 1 on the next phrase.',
    {
      ch1_src: SRC.DRUMS, ch4_src: SRC.PERC, ch1_fader: 9, ch4_fader: 7, ch4_snd1: 6, ch4_pre: true,
      cha_input: 2, cha_lo: -1, cha_fader: 8, fx_time: 2, fx_fdbk: 6.5,
    }),

  // ---------------------------------------------------------------- Stems
  stem_jam: preset('Stems / Stem jam with FX returns',
    'Four stems on channels 1-4, each with one job: DRUMS, BASS (HI trimmed), STABS and PERC (lows killed). The STABS feed the delay (channel A) and the PERC the reverb (channel B). Ride the faders and the EQ.',
    {
      ch1_src: SRC.DRUMS, ch2_src: SRC.BASS, ch3_src: SRC.STABS, ch4_src: SRC.PERC,
      ch1_fader: 9, ch2_fader: 8, ch2_hi: -0.29, ch3_fader: 7, ch3_lo: -1, ch3_snd1: 4, ch4_fader: 7, ch4_lo: -1, ch4_snd2: 4,
      cha_input: 2, cha_lo: -1, cha_fader: 7, chb_input: 2, chb_lo: -0.44, chb_fader: 7,
    }),
  kick_vs_bass: preset('Stems / Kick vs bass: carved low end',
    'DRUMS and BASS share the low end. The bass has LO trimmed and the drums have LO MID cut, so the kick punches and the bass sits under it.',
    { ch1_src: SRC.DRUMS, ch2_src: SRC.BASS, ch1_lomid: -0.4, ch2_lo: -0.3, ch2_himid: 0.2 }),
  overdriven: preset('Gain / Overdriven channel (what not to do)',
    'TRACK A with GAIN at +10 dB, LO and HI MID boosted: the PK! LED flashes, the meter sits on +10 and the peaks flatten into buzz. Fix it at GAIN (about -10 dB), not with the fader, then centre the EQ.',
    { ch1_src: SRC.TRACK_A, ch1_gain: 10, ch1_lo: 1, ch1_himid: 1, master: 6 }),

  // ---------------------------------------------------------------- Cue
  split_cue: preset('Cue / Split-cue headphones',
    'YOU HEAR set to PHONES with SPLIT CUE: TRACK B (cued) in your left ear, the live mix (TRACK A) in the right. Line them up before the crowd hears B.',
    {
      ch1_src: SRC.TRACK_A, ch2_src: SRC.TRACK_B, ch1_xf: 0, ch2_xf: 2, xfader: 0,
      ch2_cue: true, split_cue: true, monitor_out: 2, phones: 7,
    }),
  b2b: preset('Cue / Back to back: two cue systems',
    'Two DJs, two headphones. DJ 1 cues TRACK B on channel 2 with its CUE button (PHONES, split). DJ 2 listens to channel 3 on PHONES 2 with its own selector, without touching DJ 1\'s cue. YOU HEAR is on PHONES 2.',
    {
      ch1_src: SRC.TRACK_A, ch2_src: SRC.TRACK_B, ch3_src: SRC.STABS, ch2_fader: 0, ch3_fader: 0,
      ch2_cue: true, split_cue: true, phones2_src: 3, phones2_mix: 4, phones2: 7, monitor_out: 3,
    }),
  booth_tune: preset('Cue / Booth monitor tuning',
    'YOU HEAR on BOOTH: the booth has its own EQ (here LO -3 dB, HI +2 dB for a boomy booth), STEREO/MONO and MUTE, none of which touch MASTER. Press STEREO/MONO to check the mix in mono.',
    { ch1_src: SRC.TRACK_A, ch2_src: SRC.TRACK_B, ch2_fader: 0, booth: 7, booth_lo: -3, booth_hi: 2, monitor_out: 1 }),
  mc_mic: preset('Cue / MC on the mic (clean feed)',
    'Channel A on MIC (the VOX LEAD deck stands in for a singer) over TRACK A. The mic is a clean feed: it reaches MASTER 1 and 2 but not the booth, the filters or the headphones\' MST blend. Switch YOU HEAR between MASTER and BOOTH to hear the difference.',
    { ch1_src: SRC.TRACK_A, ch1_fader: 9, cha_src: SRC.LEAD, cha_input: 1, cha_lo: -0.44, cha_mid: 0.2, cha_midf: 2500, cha_fader: 8 }),

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
      ch1_fader: 9.5, ch2_fader: 9, ch3_fader: 8.5, ch4_fader: 8, ch2_lo: -0.15, ch3_lo: -1, ch3_snd2: 3, ch4_snd1: 2.5, ch4_hi: -0.2,
    }),
};
