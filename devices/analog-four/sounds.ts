// ============================================================================
// Analog Four MKII sound library
//
// Sounds are A4 "sounds": one synth track's parameters, written as changes
// from the init sound (the OS's own init values, params.ts defaults). The
// factory library's names are the manufacturer's, so these are recreations by
// character with our own names, "Category / Name". `recreates` notes what a
// sound is modelled on where that is inferred.
//
// They load into any track from the SOUND menu ([SND] / TRACK LEVEL push) and
// make the kits in kits.ts.
// ============================================================================

import { dest } from './params';

export type SoundParams = Record<string, number>;

export interface SoundDef {
  id: string;
  /** "Category / Name" */
  name: string;
  category: 'Bass' | 'Lead' | 'Pad' | 'Pluck' | 'Keys' | 'Arp' | 'FX' | 'Drum';
  desc: string;
  /** What it is a recreation of, when that is inferred */
  recreates?: string;
  /** Changes from the init sound (keys of params.ts SYNTH_PARAMS) */
  p: SoundParams;
  /** Keyboard octave that suits it (-3..+3, default +1 = C4 on the C key) */
  oct?: number;
  /** A short phrase for auditions: [step, note, len index] */
  demo?: [number, number, number][];
}

const D = dest;

/** Bass-register demo: a one-bar riff around C2 */
const BASS_DEMO: [number, number, number][] = [[0, 36, 14], [3, 36, 10], [6, 48, 10], [8, 36, 14], [10, 39, 10], [12, 43, 10], [14, 46, 10]];
const LEAD_DEMO: [number, number, number][] = [[0, 72, 30], [4, 75, 14], [6, 79, 14], [8, 77, 30], [12, 74, 14], [14, 70, 14]];
const PAD_DEMO: [number, number, number][] = [[0, 60, 78], [8, 63, 46]];
const PLUCK_DEMO: [number, number, number][] = [[0, 60, 10], [3, 67, 10], [6, 72, 10], [8, 70, 10], [11, 67, 10], [14, 63, 10]];
const DRUM_DEMO: [number, number, number][] = [[0, 60, 14], [4, 60, 14], [8, 60, 14], [12, 60, 14]];

export const SOUNDS: SoundDef[] = [
  // ---------------------------------------------------------------- BASS
  {
    id: 'bass-saw', name: 'Bass / Plain Saw', category: 'Bass', recreates: 'the factory library\'s plain saw starting point ("The Saw")',
    desc: 'One sawtooth through the ladder with a short filter envelope: the A4 voice in its simplest, most useful form.',
    p: { flt1_frq: 74, flt1_res: 30, flt1_dep: 22, envf_dec: 58, envf_sus: 0, amp_dec: 70, amp_sus: 90, amp_rel: 20 },
    oct: -1, demo: BASS_DEMO,
  },
  {
    id: 'bass-acid', name: 'Bass / Acid Squelch', category: 'Bass', recreates: 'a TB-303 style acid line, the job the A4 manual gives the transistor pulse',
    desc: 'Transistor pulse into a screaming ladder with overdrive. Accent and slide trigs make it talk.',
    p: { osc1_wav: 1, osc1_pw: -10, flt1_frq: 46, flt1_res: 106, flt1_ovr: 52, flt1_dep: 30, envf_dec: 50, envf_sus: 0, amp_dec: 60, amp_sus: 60, amp_rel: 18, osc_sli: 40, snd_acc: 96 },
    oct: -1, demo: BASS_DEMO,
  },
  {
    id: 'bass-sub', name: 'Bass / Sub Pulse', category: 'Bass',
    desc: 'A square with its sub oscillator an octave down: round low end that sits under a kick.',
    p: { osc1_wav: 2, osc1_sub: 1, flt1_frq: 64, flt1_res: 10, flt1_dep: 10, envf_dec: 50, envf_sus: 0, amp_dec: 64, amp_sus: 110, amp_rel: 24 },
    oct: -1, demo: BASS_DEMO,
  },
  {
    id: 'bass-reese', name: 'Bass / Reese', category: 'Bass', recreates: 'the drum & bass "Reese" detuned-saw bass',
    desc: 'Two saws a few hertz apart beat against each other; a slow LFO on the cutoff keeps it moving.',
    p: { osc2_lev: 100, osc2_det: 7, osc2_fin: 10, flt1_frq: 70, flt1_res: 40, flt1_ovr: 34, amp_sus: 127, amp_rel: 30, lfo1_spd: 8, lfo1_mul: 2, lfo1_depa: 14 },
    oct: -1, demo: BASS_DEMO,
  },
  {
    id: 'bass-rubber', name: 'Bass / Rubber Pluck', category: 'Bass',
    desc: 'A resonant filter snap on every note: short, bouncy, funky.',
    p: { flt1_frq: 40, flt1_res: 82, flt1_dep: 36, envf_dec: 46, envf_sus: 0, amp_dec: 52, amp_sus: 0, amp_rel: 30 },
    oct: -1, demo: BASS_DEMO,
  },
  {
    id: 'bass-sync', name: 'Bass / Sync Growl', category: 'Bass',
    desc: 'Osc 1 hard-syncs osc 2 while ENV 2 sweeps osc 2\'s pitch: the classic tearing sync sound.',
    p: { osc1_lev: 0, osc2_lev: 110, osc2_tun: 7, osc_smd: 1, env2_dsta: D('O2 PIT'), env2_depa: 40, env2_dec: 62, env2_sus: 0, flt1_frq: 82, flt1_res: 30, amp_sus: 110, amp_rel: 24 },
    oct: -1, demo: BASS_DEMO,
  },
  {
    id: 'bass-wobble', name: 'Bass / Wobble', category: 'Bass',
    desc: 'A triggered sine LFO opens and closes the filter in eighth notes.',
    p: { osc1_sub: 1, osc2_wav: 2, osc2_lev: 80, osc2_tun: -12, flt1_frq: 52, flt1_res: 72, lfo1_spd: 32, lfo1_mul: 5, lfo1_wav: 1, lfo1_mod: 1, lfo1_depa: 40, amp_sus: 127, amp_rel: 20 },
    oct: -1, demo: BASS_DEMO,
  },
  {
    id: 'bass-am', name: 'Bass / Metallic AM', category: 'Bass',
    desc: 'Osc 2 (a 12th up, silent) modulates osc 1\'s amplitude: hollow, bell-like sidebands on a bass.',
    p: { osc_am1: 1, osc2_tun: 19, osc2_wav: 3, flt1_frq: 78, flt1_res: 34, flt1_dep: 16, envf_dec: 56, envf_sus: 20, amp_dec: 66, amp_sus: 80, amp_rel: 22 },
    oct: -1, demo: BASS_DEMO,
  },

  // ---------------------------------------------------------------- LEAD
  {
    id: 'lead-sync', name: 'Lead / Sync Lead', category: 'Lead',
    desc: 'Hard sync swept by ENV 2, with delayed vibrato: cuts through any mix.',
    p: { osc1_lev: 0, osc2_lev: 110, osc2_tun: 12, osc_smd: 1, env2_dsta: D('O2 PIT'), env2_depa: 30, env2_dec: 70, env2_sus: 0, flt1_frq: 100, amp_sus: 110, amp_rel: 30, osc_vib: 20, osc_vsp: 50, osc_vfa: -20, amp_del: 40 },
    demo: LEAD_DEMO,
  },
  {
    id: 'lead-square', name: 'Lead / Square Lead', category: 'Lead',
    desc: 'Two squares an octave apart, slightly detuned, with fade-in vibrato and an echo.',
    p: { osc1_wav: 2, osc2_wav: 2, osc2_tun: 12, osc2_lev: 50, osc2_det: 4, flt1_frq: 92, flt1_res: 30, flt1_dep: 12, envf_dec: 60, amp_sus: 120, osc_vib: 15, osc_vfa: -24, amp_del: 50, amp_rev: 30 },
    demo: LEAD_DEMO,
  },
  {
    id: 'lead-scream', name: 'Lead / Screamer', category: 'Lead',
    desc: 'Detuned saws into high resonance and heavy overdrive between the filters.',
    p: { osc2_lev: 100, osc2_det: 10, flt1_frq: 70, flt1_res: 110, flt1_ovr: 92, flt1_dep: 20, envf_dec: 70, envf_sus: 40, amp_sus: 120, amp_del: 40 },
    demo: LEAD_DEMO,
  },
  {
    id: 'lead-porta', name: 'Lead / Glide Saw', category: 'Lead',
    desc: 'Portamento always on: every note slides from the last one.',
    p: { snd_prt: 1, osc_sli: 50, osc2_lev: 70, osc2_tun: -12, flt1_frq: 96, flt1_res: 24, amp_sus: 127, amp_rel: 20 },
    demo: LEAD_DEMO,
  },
  {
    id: 'lead-whistle', name: 'Lead / Filter Whistle', category: 'Lead',
    desc: 'No oscillator at all: a self-oscillating ladder that tracks the keyboard, excited by a little noise.',
    p: { osc1_lev: 0, noise_lev: 10, flt1_frq: 64, flt1_res: 127, flt1_trk: 32, amp_atk: 20, amp_sus: 120, amp_rel: 50, amp_rev: 40 },
    demo: LEAD_DEMO,
  },

  // ---------------------------------------------------------------- PAD
  {
    id: 'pad-strings', name: 'Pad / String Ensemble', category: 'Pad', recreates: 'a string-machine ensemble pad',
    desc: 'Detuned saws, slow attack and release, chorus and reverb: the A4 as a string machine.',
    p: { osc2_lev: 100, osc2_det: 8, osc2_fin: 12, flt1_frq: 80, flt1_res: 20, flt1_dep: 10, envf_atk: 70, envf_dec: 80, envf_sus: 80, amp_atk: 78, amp_dec: 90, amp_sus: 110, amp_rel: 84, amp_cho: 110, amp_rev: 70, lfo1_spd: 4, lfo1_mul: 3, lfo1_depa: 6 },
    demo: PAD_DEMO,
  },
  {
    id: 'pad-pwm', name: 'Pad / Warm PWM', category: 'Pad',
    desc: 'Two pulse waves with their own pulse-width LFOs: a slowly shimmering, hollow warmth.',
    p: { osc1_wav: 2, osc1_pwm: 60, osc1_spd: 40, osc2_wav: 2, osc2_tun: 12, osc2_lev: 60, osc2_pwm: 50, osc2_spd: 30, flt1_frq: 72, flt1_res: 26, amp_atk: 70, amp_sus: 120, amp_rel: 80, amp_cho: 80, amp_rev: 60 },
    demo: PAD_DEMO,
  },
  {
    id: 'pad-glass', name: 'Pad / Glass Drone', category: 'Pad',
    desc: 'Triangles a 12th apart through a resonant peak filter, panned by LFO 2.',
    p: { osc1_wav: 3, osc2_wav: 3, osc2_tun: 19, osc2_lev: 80, flt1_frq: 110, flt2_typ: 6, flt2_frq: 90, flt2_res: 80, amp_atk: 90, amp_sus: 127, amp_rel: 100, amp_rev: 110, lfo2_spd: 6, lfo2_mul: 2, lfo2_dsta: D('AMP PAN'), lfo2_depa: 50 },
    demo: PAD_DEMO,
  },
  {
    id: 'pad-choir', name: 'Pad / Dark Choir', category: 'Pad',
    desc: 'Saws and dark noise through a band-pass "vowel": breathy and wide.',
    p: { noise_lev: 30, noise_col: -30, osc2_lev: 90, osc2_det: -6, flt1_frq: 66, flt1_res: 50, flt2_typ: 2, flt2_frq: 76, flt2_res: 60, amp_atk: 84, amp_sus: 127, amp_rel: 90, amp_rev: 100, amp_cho: 60 },
    demo: PAD_DEMO,
  },

  // ---------------------------------------------------------------- PLUCK
  {
    id: 'pluck-glass', name: 'Pluck / Glass Pluck', category: 'Pluck',
    desc: 'Triangle plus a saw an octave up, a fast filter envelope, echoes.',
    p: { osc1_wav: 3, osc2_tun: 12, osc2_lev: 60, flt1_frq: 60, flt1_res: 50, flt1_dep: 40, envf_dec: 44, envf_sus: 0, amp_dec: 60, amp_sus: 0, amp_rel: 46, amp_del: 60, amp_rev: 50 },
    demo: PLUCK_DEMO,
  },
  {
    id: 'pluck-marimba', name: 'Pluck / Wood Marimba', category: 'Pluck',
    desc: 'A triangle amplitude-modulated two octaves up: a woody mallet strike.',
    p: { osc1_wav: 3, osc_am1: 1, osc2_wav: 3, osc2_tun: 24, flt1_frq: 90, amp_dec: 50, amp_sus: 0, amp_rel: 40, amp_rev: 40, osc_trg: 1 },
    demo: PLUCK_DEMO,
  },
  {
    id: 'pluck-mute', name: 'Pluck / Muted Guitar', category: 'Pluck',
    desc: 'A thin pulse, closed filter and a short snap, oscillators retriggered for a consistent pick.',
    p: { osc1_wav: 2, osc1_pw: 30, flt1_frq: 52, flt1_res: 40, flt1_dep: 28, envf_dec: 36, envf_sus: 0, amp_dec: 44, amp_sus: 0, amp_rel: 30, osc_trg: 1 },
    demo: PLUCK_DEMO,
  },

  // ---------------------------------------------------------------- KEYS
  {
    id: 'keys-ep', name: 'Keys / Tine Piano', category: 'Keys', recreates: 'an electric-piano tine tone',
    desc: 'Triangle with an AM bell, velocity to brightness, chorus: soft and expressive.',
    p: { osc1_wav: 3, osc_am1: 1, osc2_wav: 3, osc2_tun: 12, flt1_frq: 96, flt1_dep: 10, amp_dec: 90, amp_sus: 30, amp_rel: 50, amp_cho: 60, amp_rev: 40, vmod_dst1: D('F1 FRQ'), vmod_dep1: 40, osc_trg: 1 },
    demo: PLUCK_DEMO,
  },
  {
    id: 'keys-organ', name: 'Keys / Drawbar Organ', category: 'Keys',
    desc: 'Triangles at 8\' and 4\' plus the sub, with an LFO tremolo and chorus for a rotary feel.',
    p: { osc1_wav: 3, osc1_sub: 1, osc2_wav: 3, osc2_tun: 12, osc2_lev: 90, flt1_frq: 100, amp_atk: 4, amp_sus: 127, amp_rel: 12, lfo1_spd: 48, lfo1_mul: 5, lfo1_wav: 1, lfo1_dsta: D('AMP VOL'), lfo1_depa: 8, amp_cho: 90 },
    demo: PAD_DEMO,
  },
  {
    id: 'keys-clav', name: 'Keys / Funk Clav', category: 'Keys',
    desc: 'A bright pulse through a 6 dB high-pass with a short decay: percussive and funky.',
    p: { osc1_wav: 2, osc1_pw: 48, flt1_frq: 100, flt1_res: 40, flt1_dep: 10, flt2_typ: 3, flt2_frq: 50, amp_dec: 52, amp_sus: 0, amp_rel: 20, envf_dec: 40, envf_sus: 0 },
    demo: PLUCK_DEMO,
  },
  {
    id: 'keys-brass', name: 'Keys / Poly Brass Stab', category: 'Keys', recreates: 'an analog polysynth brass stab',
    desc: 'Two detuned saws with a slightly slow filter attack: the brass "blat".',
    p: { osc2_lev: 100, osc2_det: 6, flt1_frq: 56, flt1_res: 24, flt1_dep: 26, envf_atk: 30, envf_dec: 66, envf_sus: 50, amp_atk: 18, amp_sus: 110, amp_rel: 40 },
    demo: LEAD_DEMO,
  },

  // ---------------------------------------------------------------- ARP
  {
    id: 'arp-pulse', name: 'Arp / Minor Seventh Arp', category: 'Arp',
    desc: 'The arpeggiator plays the note plus a minor third, fifth and seventh over two octaves.',
    p: { arp_mod: 2, arp_spd: 6, arp_rng: 2, arp_nlen: 10, arp_n2: 3, arp_n3: 7, arp_n4: 10, osc1_wav: 2, osc1_pw: 10, flt1_frq: 70, flt1_res: 40, flt1_dep: 24, envf_dec: 44, envf_sus: 0, amp_dec: 50, amp_sus: 0, amp_rel: 30, amp_del: 60 },
    demo: [[0, 60, 62]],
  },
  {
    id: 'arp-bubble', name: 'Arp / Bubble Cycle', category: 'Arp',
    desc: 'A major-seventh chord cycled up and down in 32nds over three octaves.',
    p: { arp_mod: 4, arp_spd: 3, arp_rng: 3, arp_nlen: 6, arp_n2: 4, arp_n3: 7, arp_n4: 11, flt1_frq: 66, flt1_res: 70, flt1_dep: 30, envf_dec: 40, envf_sus: 0, amp_dec: 44, amp_sus: 0, amp_del: 70, lfo1_spd: 4, lfo1_mul: 3, lfo1_depa: 10 },
    demo: [[0, 60, 62]],
  },
  {
    id: 'arp-gate', name: 'Arp / Trance Gate', category: 'Arp',
    desc: 'A square LFO chops a sustained detuned saw into 16th notes.',
    p: { osc2_lev: 100, osc2_det: 10, lfo1_wav: 2, lfo1_spd: 32, lfo1_mul: 6, lfo1_mod: 1, lfo1_dsta: D('AMP VOL'), lfo1_depa: -110, amp_sus: 127, flt1_frq: 90, amp_cho: 50, amp_rev: 40 },
    demo: PAD_DEMO,
  },

  // ---------------------------------------------------------------- FX
  {
    id: 'fx-zap', name: 'FX / Laser Zap', category: 'FX',
    desc: 'ENV 2 drops the pitch four octaves in a flash.',
    p: { osc1_tun: 24, env2_dsta: D('O1 PIT'), env2_depa: -128, env2_dec: 50, env2_sus: 0, amp_dec: 60, amp_sus: 0, amp_rel: 30, flt1_res: 60 },
    demo: DRUM_DEMO,
  },
  {
    id: 'fx-riser', name: 'FX / Noise Riser', category: 'FX',
    desc: 'Noise through a filter that LFO 1 (ONE mode, a ramp) opens over two bars.',
    p: { osc1_lev: 0, noise_lev: 120, flt1_frq: 40, flt1_res: 40, lfo1_mod: 3, lfo1_wav: 5, lfo1_spd: 16, lfo1_mul: 2, lfo1_depa: 100, amp_atk: 96, amp_sus: 127, amp_rel: 60, amp_rev: 90 },
    demo: [[0, 60, 94]],
  },
  {
    id: 'fx-bleeps', name: 'FX / Random Bleeps', category: 'FX',
    desc: 'A random-step LFO throws the pitch around in eighths: computer chatter.',
    p: { osc1_wav: 2, lfo1_wav: 6, lfo1_spd: 32, lfo1_mul: 5, lfo1_dsta: D('O1 PIT'), lfo1_depa: 40, amp_sus: 127, amp_del: 60, flt1_frq: 80, flt1_res: 70 },
    demo: PAD_DEMO,
  },
  {
    id: 'fx-metal', name: 'FX / Metal Ring', category: 'FX',
    desc: 'Metal sync: the two oscillators reset each other, an inharmonic clang.',
    p: { osc_smd: 3, osc2_tun: 7, osc2_lev: 100, osc1_lev: 80, flt1_frq: 100, flt1_res: 30, amp_dec: 70, amp_sus: 0, amp_rel: 60, amp_rev: 60 },
    demo: PLUCK_DEMO,
  },

  // ---------------------------------------------------------------- DRUM
  {
    id: 'drum-kick', name: 'Drum / Analog Kick', category: 'Drum',
    desc: 'A triangle at fixed pitch with a fast pitch envelope (ENV 2) and oscillator retrig for the punch.',
    p: { osc1_wav: 3, osc1_trk: 0, osc1_tun: -24, osc1_lev: 127, osc_trg: 1, env2_dsta: D('O1 PIT'), env2_depa: 80, env2_atk: 0, env2_dec: 46, env2_sus: 0, flt1_frq: 74, flt1_res: 0, amp_dec: 76, amp_sus: 0, amp_rel: 40, amp_vol: 110 },
    demo: DRUM_DEMO,
  },
  {
    id: 'drum-snare', name: 'Drum / Snare', category: 'Drum',
    desc: 'A tuned triangle body with a pitch dip, plus noise that fades out.',
    p: { osc1_wav: 3, osc1_trk: 0, osc1_tun: -7, osc1_lev: 70, osc_trg: 1, env2_dsta: D('O1 PIT'), env2_depa: 40, env2_dec: 30, env2_sus: 0, noise_lev: 110, noise_col: 20, noise_fad: 24, flt1_frq: 110, flt1_res: 10, flt2_frq: 50, amp_dec: 60, amp_sus: 0, amp_rel: 40 },
    demo: [[4, 60, 14], [12, 60, 14]],
  },
  {
    id: 'drum-hat', name: 'Drum / Closed Hat', category: 'Drum',
    desc: 'Bright noise through the high-pass, a very short envelope.',
    p: { osc1_lev: 0, noise_lev: 127, noise_col: 40, flt2_frq: 96, flt2_res: 20, amp_dec: 38, amp_sus: 0, amp_rel: 24, amp_pan: 10, amp_vol: 90 },
    demo: [[2, 60, 14], [6, 60, 14], [10, 60, 14], [14, 60, 14]],
  },
  {
    id: 'drum-ohat', name: 'Drum / Open Hat', category: 'Drum',
    desc: 'The closed hat with a longer decay and release.',
    p: { osc1_lev: 0, noise_lev: 127, noise_col: 40, flt2_frq: 94, flt2_res: 20, amp_dec: 66, amp_sus: 0, amp_rel: 50, amp_pan: -10, amp_vol: 84 },
    demo: [[2, 60, 14], [10, 60, 14]],
  },
  {
    id: 'drum-clap', name: 'Drum / Clap', category: 'Drum',
    desc: 'Band-passed noise chopped by a fast LFO that fades out: the multiple hands of a clap.',
    p: { osc1_lev: 0, noise_lev: 120, flt2_typ: 2, flt2_frq: 86, flt2_res: 40, lfo1_wav: 3, lfo1_spd: 50, lfo1_mul: 9, lfo1_mod: 1, lfo1_fad: 16, lfo1_dsta: D('AMP VOL'), lfo1_depa: -64, amp_dec: 52, amp_sus: 0, amp_rel: 36, amp_rev: 40 },
    demo: [[4, 60, 14], [12, 60, 14]],
  },
  {
    id: 'drum-tom', name: 'Drum / Analog Tom', category: 'Drum',
    desc: 'A tuned triangle with a pitch envelope and a breath of noise: play it with notes.',
    p: { osc1_wav: 3, osc_trg: 1, env2_dsta: D('O1 PIT'), env2_depa: 50, env2_dec: 44, env2_sus: 0, noise_lev: 20, noise_fad: 30, amp_dec: 66, amp_sus: 0, amp_rel: 50 },
    oct: -1, demo: [[0, 43, 14], [6, 41, 14], [10, 38, 14]],
  },
  {
    id: 'drum-rim', name: 'Drum / Rim Click', category: 'Drum',
    desc: 'A pulse at fixed pitch through a resonant band-pass, very short.',
    p: { osc1_wav: 2, osc1_trk: 0, osc1_tun: 12, osc_trg: 1, flt1_frq: 100, flt2_typ: 2, flt2_frq: 90, flt2_res: 60, amp_dec: 20, amp_sus: 0, amp_rel: 14 },
    demo: [[3, 60, 14], [11, 60, 14]],
  },
  {
    id: 'drum-cowbell', name: 'Drum / Cowbell', category: 'Drum', recreates: 'the two-square drum-machine cowbell',
    desc: 'Two square waves a fifth apart at fixed pitches through a band-pass.',
    p: { osc1_wav: 2, osc1_trk: 0, osc1_tun: 17, osc2_wav: 2, osc2_trk: 0, osc2_tun: 24, osc2_lev: 100, flt2_typ: 2, flt2_frq: 92, flt2_res: 40, amp_dec: 46, amp_sus: 0, amp_rel: 30 },
    demo: [[0, 60, 14], [3, 60, 14], [6, 60, 14]],
  },
  {
    id: 'drum-zap', name: 'Drum / Zap Perc', category: 'Drum',
    desc: 'A saw with an extreme, very fast pitch drop: electro percussion.',
    p: { osc1_trk: 0, osc_trg: 1, env2_dsta: D('O1 PIT'), env2_depa: 127, env2_dec: 30, env2_sus: 0, amp_dec: 40, amp_sus: 0, amp_rel: 20 },
    demo: DRUM_DEMO,
  },
];

export const SOUND_BY_ID: Record<string, SoundDef> = Object.fromEntries(SOUNDS.map(s => [s.id, s]));
export const SOUND_CATEGORIES = ['Bass', 'Lead', 'Pad', 'Pluck', 'Keys', 'Arp', 'FX', 'Drum'] as const;
