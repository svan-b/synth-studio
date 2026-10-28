// ============================================================================
// ALLEN & HEATH XONE:96 - analogue DJ mixer
// Sources: Xone:96 User Guide AP11645 issue 1 (2018, 41 pages; page numbers
// below follow that PDF as indexed on ManualsLib), the Quick Start Guide
// AP11255 and the published specifications.
//   p.10  Stereo channels 1-4: USB 1 / PHONO / LINE / USB 2 inputs, GAIN, EQ
//   p.12  XFADER and fader-curve switches
//   p.13  Xone:VCF sections, FILTER 1 / FILTER 2
//   p.16  SEND 1 / SEND 2, metering
//   p.17  Cue, headphones, master and booth sections
//   p.35  Specifications (EQ, meters, dimensions)
//
// Modelled: 6 channel strips (stereo 1-4 with the asymmetric 4-band EQ, aux
// channels A and B with the 3-band EQ and swept parametric mid), GAIN
// (-inf..+10 dB), channel faders with the global CHANNEL FADER curve, X/OFF/Y
// crossfader assign with the XFADER curve switch, two VCF filter sections
// (HPF/BPF/LPF, FREQ, RES MILD..WILD, CRUNCH) with per-channel FILTER 1/OFF/2
// assign, SEND 1 (pre/post) and SEND 2 (post), CUE per channel, CUE/MST mix,
// SPLIT CUE, POST EQ cue, PHONES level, MASTER and BOOTH levels with BOOTH MONO,
// 9-LED channel meters and 11-LED LR MIX meters.
//
// Honest simplifications (also listed in the module tips):
//   - No USB audio interface, MIDI, X:LINK, PHONES 2 / second cue system,
//     RTN C/D, MASTER 2, booth EQ or the rear-panel insert.
//   - The "external" FX unit (SND 1 -> delay -> RTN A, SND 2 -> reverb -> RTN B)
//     is built in, standing in for the hardware you would plug into the rear.
//   - The twin has a deck strip above the mixer (sources, file loading, PLAY,
//     BPM) and a YOU HEAR switch, because a browser has one stereo output:
//     it picks whether your speakers play MASTER, BOOTH or PHONES.
//   - SEND 1 PRE/POST is modelled as one global switch; channels A/B have no
//     sends here (they are usually the FX returns, so this avoids feedback).
//   - No pitch faders or beat-matching: all built-in decks share one tempo.
// ============================================================================

import type { ControlSpec, DeviceSpec, KnobSpec, SwitchSpec } from '@/types';
import { SOURCE_NAMES } from './sources';

export const CHANNELS = ['a', 'b', '1', '2', '3', '4'] as const;
export type ChannelId = (typeof CHANNELS)[number];
export const isAux = (ch: ChannelId) => ch === 'a' || ch === 'b';
export const chName = (ch: ChannelId) => (isAux(ch) ? ch.toUpperCase() : ch);

export const GAIN_MIN = -40; // knob fully anticlockwise = -inf

/** LED thresholds in dBu. Channel: 9 LEDs, -20 .. +10 with the top one as PK! (p.35); LR MIX: 11 LEDs, -35 .. +10 */
export const CH_METER_DBU = [-20, -12, -6, -3, 0, 3, 6, 10, 14];
export const MASTER_METER_DBU = [-35, -25, -20, -15, -10, -6, -3, 0, 3, 6, 10];

// ---------------------------------------------------------------------------
// Value <-> dB laws (shared with the engine so panel readouts match the audio)
// ---------------------------------------------------------------------------

/** HI / LO kill bands: centre 0 dB, clockwise +6 dB, anticlockwise to full kill */
export function killBandGain(v: number): number {
  if (v >= 0) return Math.pow(10, (6 * v) / 20);
  return Math.pow(1 + v, 2);
}
/** Mid bands: centre 0 dB, +10 dB boost, -27 dB (1-4) or -24 dB (A/B) cut */
export function midBandDb(v: number, cut: number): number {
  return v >= 0 ? 10 * v : cut * -v;
}
const fmtDb = (db: number) => (Math.abs(db) < 0.05 ? '0 dB' : `${db > 0 ? '+' : ''}${db.toFixed(db > -10 && db < 10 ? 1 : 0)} dB`);
const fmtKill = (v: number) => {
  if (v <= -0.985) return 'KILL';
  const g = killBandGain(v);
  return fmtDb(20 * Math.log10(g));
};
export const gainDb = (v: number) => (v <= GAIN_MIN + 0.01 ? -Infinity : v);
const fmtGain = (v: number) => (v <= GAIN_MIN + 0.01 ? '-∞ dB' : fmtDb(v));
const fmt10 = (v: number) => v.toFixed(1);

// ---------------------------------------------------------------------------

const P = {
  inputs: 'p.10 – Input select (USB 1 / PHONO / LINE / USB 2)',
  inputsAux: 'p.10 – Channel A/B input select (USB 1 / MIC / RTN / USB 2)',
  gain: 'p.10 – Channel GAIN (-∞ to +10 dB)',
  eq: 'p.10 – 4-band EQ (HI 3 kHz, HI MID 1.1 kHz, LO MID 350 Hz, LO 180 Hz)',
  eqAux: 'p.10 – Channel A/B 3-band EQ (HI 3 kHz, MID 190 Hz–2.75 kHz, LO 180 Hz)',
  curves: 'p.12 – XFADER / fader curve switches',
  filter: 'p.13 – Xone:VCF sections, FILTER 1 / FILTER 2',
  sends: 'p.16 – SEND 1 / SEND 2',
  meters: 'p.16 – Metering (post-GAIN / post-EQ / pre-fader)',
  cue: 'p.17 – Cue and headphones',
  master: 'p.17 – Master and booth sections',
  twin: 'Twin only – not on the hardware',
};

function channelControls(ch: ChannelId): Record<string, ControlSpec> {
  const p = `ch${ch}_`;
  const n = chName(ch);
  const aux = isAux(ch);
  const kill = (label: string, desc: string): KnobSpec => ({
    type: 'knob', label, min: -1, max: 1, default: 0, units: 'dB', bipolar: true, format: fmtKill,
    description: desc, manualReference: aux ? P.eqAux : P.eq,
  });
  const mid = (label: string, desc: string, cut: number): KnobSpec => ({
    type: 'knob', label, min: -1, max: 1, default: 0, units: 'dB', bipolar: true,
    format: v => fmtDb(midBandDb(v, cut)), description: desc, manualReference: aux ? P.eqAux : P.eq,
  });

  const c: Record<string, ControlSpec> = {
    [`${p}src`]: {
      type: 'switch', label: `DECK ${n}`, options: [...SOURCE_NAMES],
      default: ({ a: 7, b: 6, '1': 0, '2': 1, '3': 4, '4': 5 } as const)[ch],
      description: `Twin only: which built-in source is "plugged into" channel ${n}. Load your own audio file to play it on the USB inputs.`,
      manualReference: P.twin,
    },
    [`${p}input`]: aux
      ? {
          type: 'switch', label: 'INPUT', options: ['USB 1', 'MIC', 'RTN', 'USB 2'], default: 2,
          description: `Channel ${n} source: USB (your loaded file), MIC (the built-in deck) or RTN (FX return ${n}: ${ch === 'a' ? 'the delay on SEND 1' : 'the reverb on SEND 2'}).`,
          manualReference: P.inputsAux,
        }
      : {
          type: 'switch', label: 'INPUT', options: ['USB 1', 'PHONO', 'LINE', 'USB 2'], default: 2,
          description: `Channel ${n} source. LINE/PHONO play the built-in deck; USB 1/2 play the audio file you loaded for this channel.`,
          manualReference: P.inputs,
        },
    [`${p}gain`]: {
      type: 'knob', label: 'GAIN', min: GAIN_MIN, max: 10, default: 0, units: 'dB', format: fmtGain,
      description: 'Input trim. Set it first: meter averaging around 0 with peaks near +6, never PK.',
      manualReference: P.gain,
    },
    [`${p}hi`]: kill('HI', 'Treble shelf above 3 kHz: +6 dB to full kill (hats, air, vocal sibilance).'),
    [`${p}lo`]: kill('LO', 'Bass below 180 Hz: +6 dB to full kill (kick and bassline fundamentals).'),
    [`${p}cue`]: {
      type: 'button', label: 'CUE', default: false, ledColor: '#ff8a1f',
      description: 'Send this channel to the headphones (pre-fader) so you can listen before the crowd hears it.',
      manualReference: P.cue,
    },
    [`${p}filter`]: {
      type: 'switch', label: 'FILTER', options: ['1', 'OFF', '2'], default: 1,
      description: 'Route the channel through FILTER 1 (left) or FILTER 2 (right), or straight to the LR MIX when OFF.',
      manualReference: P.filter,
    },
    [`${p}xf`]: {
      type: 'switch', label: 'XFADER', options: ['X', 'OFF', 'Y'], default: 1,
      description: 'Assign the channel to the X (left) or Y (right) side of the crossfader, or OFF to bypass it.',
      manualReference: P.curves,
    },
    [`${p}fader`]: {
      type: 'slider', label: `CH ${n}`, min: 0, max: 10, default: ch === '1' ? 10 : ch === 'a' || ch === 'b' ? 7 : 0,
      units: 'none', format: fmt10,
      description: 'Channel fader (60 mm). Its response follows the global CHANNEL FADER curve switch.',
      manualReference: P.curves,
    },
  };

  if (aux) {
    c[`${p}mid`] = mid('MID', 'Swept parametric mid: +10 dB boost / -24 dB cut at the MID FREQ.', -24);
    c[`${p}midf`] = {
      type: 'knob', label: 'FREQ', min: 190, max: 2750, default: 700, units: 'Hz', curve: 'logarithmic',
      description: 'Centre frequency of the parametric mid, 190 Hz to 2.75 kHz.', manualReference: P.eqAux,
    };
  } else {
    c[`${p}himid`] = mid('HI MID', 'Upper mids around 1.1 kHz: +10 / -27 dB (snare crack, vocal presence).', -27);
    c[`${p}lomid`] = mid('LO MID', 'Lower mids around 350 Hz: +10 / -27 dB (warmth, or mud when two tracks stack).', -27);
    c[`${p}snd1`] = {
      type: 'knob', label: 'SND 1', min: 0, max: 10, default: 0, units: 'none', format: fmt10,
      description: 'Level sent to SEND 1 (pre or post fader). In the twin SEND 1 feeds the tempo-synced delay, returned on channel A (RTN).',
      manualReference: P.sends,
    };
    c[`${p}snd2`] = {
      type: 'knob', label: 'SND 2', min: 0, max: 10, default: 0, units: 'none', format: fmt10,
      description: 'Post-fader level sent to SEND 2. In the twin SEND 2 feeds the reverb, returned on channel B (RTN).',
      manualReference: P.sends,
    };
  }
  return c;
}

function filterControls(f: 1 | 2): Record<string, ControlSpec> {
  const p = `f${f}_`;
  return {
    [`${p}type`]: {
      type: 'switch', label: 'TYPE', options: ['HPF', 'BPF', 'LPF'], default: f === 1 ? 0 : 2,
      description: 'High-pass removes lows, band-pass keeps a band, low-pass removes highs (state-variable filter, 12 dB/oct).',
      manualReference: P.filter,
    } as SwitchSpec,
    [`${p}freq`]: {
      type: 'knob', label: 'FREQ', min: 20, max: 20000, default: f === 1 ? 20 : 20000, units: 'Hz', curve: 'logarithmic',
      description: 'Filter cutoff / centre frequency. HPF at 20 Hz and LPF at 20 kHz are transparent.',
      manualReference: P.filter,
    },
    [`${p}res`]: {
      type: 'knob', label: 'RES', min: 0, max: 10, default: 2, units: 'none', format: v => (v < 0.5 ? 'MILD' : v > 9.5 ? 'WILD' : v.toFixed(1)),
      description: 'Resonance from MILD (subtle) to WILD (a sharp peak just short of self-oscillation).',
      manualReference: P.filter,
    },
    [`${p}crunch`]: {
      type: 'knob', label: 'CRUNCH', min: 0, max: 10, default: 0, units: 'none', format: fmt10,
      description: 'Pre-filter harmonic distortion. 0 is clean; the LED lights as it bites.',
      manualReference: P.filter,
    },
  };
}

const CURVES = ['CONST PWR', 'DIPPED', 'FAST CUT'];

export const XONE96: DeviceSpec = {
  id: 'xone96',
  name: 'Xone:96',
  manufacturer: 'Allen & Heath',
  year: 2018,
  description: 'Analogue 6+2 channel DJ mixer with dual Xone:VCF filters, two FX sends and a 4-band asymmetric EQ',
  manualUrl: 'https://www.allen-heath.com/hardware/xone-series/xone96/',
  // p.35: 336 mm wide x 410 mm deep x 109 mm high, about 7 kg
  dimensions: { width: 336, height: 410, depth: 109 },
  display: { width: 1008, height: 1362, scale: 3 },

  signalFlow: [
    { id: 'decks', name: 'Virtual decks (twin only)', order: 0, controls: ['play', 'bpm', ...CHANNELS.map(c => `ch${c}_src`)] },
    ...CHANNELS.map((c, i) => ({
      id: `ch${c}`,
      name: `Channel ${chName(c)}`,
      description: isAux(c) ? 'Aux channel: input select, GAIN, 3-band EQ with parametric mid' : 'Stereo channel: input select, GAIN, 4-band EQ, two sends',
      order: i + 1,
      controls: Object.keys(channelControls(c)).filter(k => !k.endsWith('_src')),
    })),
    { id: 'filters', name: 'Xone:VCF filters', order: 7, controls: [...Object.keys(filterControls(1)), ...Object.keys(filterControls(2))] },
    { id: 'xfader', name: 'Crossfader', order: 8, controls: ['xfader', 'xf_curve', 'fader_curve'] },
    { id: 'master', name: 'Master, booth and headphones', order: 9, controls: ['master', 'booth', 'booth_mono', 'cue_mix', 'phones', 'split_cue', 'cue_post_eq', 'send1_pre', 'monitor_out'] },
    { id: 'fx', name: 'Virtual FX unit (twin only)', order: 10, controls: ['fx_time', 'fx_fdbk', 'fx_size'] },
  ],

  controls: {
    ...Object.assign({}, ...CHANNELS.map(channelControls)),
    ...filterControls(1),
    ...filterControls(2),

    xfader: {
      type: 'slider', label: 'XFADER', min: 0, max: 10, default: 5, units: 'none',
      format: v => (v < 0.05 ? 'X' : v > 9.95 ? 'Y' : v.toFixed(1)),
      description: 'Crossfader: X side fully left, Y side fully right. Only channels assigned to X or Y are affected.',
      manualReference: P.curves,
    },
    xf_curve: {
      type: 'switch', label: 'XFADER CURVE', options: CURVES, default: 0,
      description: 'CONST PWR: smooth blend (-3 dB each in the middle). DIPPED: deeper dip in the middle. FAST CUT: both sides full until the last few mm, for cuts and scratching.',
      manualReference: P.curves,
    },
    fader_curve: {
      type: 'switch', label: 'CHANNEL FADER', options: CURVES, default: 0,
      description: 'Global channel-fader response (applies to channels 1-4). CONST PWR is the smooth Xone:92-like taper; FAST CUT reaches full level early.',
      manualReference: P.curves,
    },

    master: {
      type: 'knob', label: 'MASTER', min: 0, max: 10, default: 7.5, units: 'none', format: fmt10,
      description: 'MASTER 1 output level. The LR MIX meters read before this control, so it does not change them.',
      manualReference: P.master,
    },
    booth: {
      type: 'knob', label: 'BOOTH', min: 0, max: 10, default: 6, units: 'none', format: fmt10,
      description: 'Booth monitor level (rear BOOTH outputs). Select YOU HEAR: BOOTH to listen to it.',
      manualReference: P.master,
    },
    booth_mono: {
      type: 'button', label: 'MONO', default: false, ledColor: '#ffd23f',
      description: 'Sum the booth output to mono.', manualReference: P.master,
    },
    cue_mix: {
      type: 'knob', label: 'CUE / MST', min: 0, max: 10, default: 0, units: 'none',
      format: v => (v < 0.1 ? 'CUE' : v > 9.9 ? 'MST' : v.toFixed(1)),
      description: 'Blend between the cue signal (left) and the master mix (right) in the headphones. Bypassed by SPLIT CUE.',
      manualReference: P.cue,
    },
    phones: {
      type: 'knob', label: 'PHONES', min: 0, max: 10, default: 6, units: 'none', format: fmt10,
      description: 'Headphone level.', manualReference: P.cue,
    },
    split_cue: {
      type: 'button', label: 'SPLIT', default: false, ledColor: '#ff8a1f',
      description: 'Split cue: cue in the left ear, master in the right. The left LR meter then shows the cue level.',
      manualReference: P.cue,
    },
    cue_post_eq: {
      type: 'button', label: 'POST EQ', default: true, ledColor: '#ff8a1f',
      description: 'Take channel cue after the EQ (lit) or before it.', manualReference: P.cue,
    },
    send1_pre: {
      type: 'switch', label: 'SEND 1', options: ['POST', 'PRE'], default: 0,
      description: 'SEND 1 taken after the channel fader (POST) or before it (PRE). SEND 2 is always post-fader.',
      manualReference: P.sends,
    },
    monitor_out: {
      type: 'switch', label: 'YOU HEAR', options: ['MASTER', 'BOOTH', 'PHONES'], default: 0,
      description: 'Twin only: a browser has one output, so choose which mixer output your speakers play. PHONES lets you hear the cue.',
      manualReference: P.twin,
    },

    // --- Twin: transport, tempo and the stand-in FX unit -------------------------
    play: {
      type: 'button', label: 'PLAY', default: false, ledColor: '#22c55e',
      description: 'Start / stop every built-in deck together (Space bar).', manualReference: P.twin,
    },
    bpm: {
      type: 'knob', label: 'BPM', min: 100, max: 140, default: 124, step: 1, units: 'BPM',
      description: 'Master tempo of the built-in decks (loaded files play at their own speed).', manualReference: P.twin,
    },
    fx_time: {
      type: 'switch', label: 'DELAY', options: ['1/8', '3/16', '1/4'], default: 1,
      description: 'Delay time of the virtual FX unit on SEND 1, synced to the BPM.', manualReference: P.twin,
    },
    fx_fdbk: {
      type: 'knob', label: 'FDBK', min: 0, max: 10, default: 4.5, units: 'none', format: fmt10,
      description: 'Delay feedback: how many repeats.', manualReference: P.twin,
    },
    fx_size: {
      type: 'knob', label: 'REVERB', min: 0.5, max: 6, default: 2.5, units: 's', curve: 'logarithmic',
      description: 'Reverb decay time of the virtual FX unit on SEND 2.', manualReference: P.twin,
    },
  },

  presets: {
    two_decks: {
      name: 'Two decks ready to blend',
      description: 'Track A live on X, Track B gain-matched and waiting on Y with the crossfader hard to X.',
      source: 'community',
      settings: {
        ch1_src: 0, ch2_src: 1, ch1_input: 2, ch2_input: 2,
        ch1_fader: 10, ch2_fader: 10, ch3_fader: 0, ch4_fader: 0, cha_fader: 7, chb_fader: 7,
        ch1_xf: 0, ch2_xf: 2, xfader: 0, xf_curve: 0, ch2_cue: true, monitor_out: 0,
      },
    },
    bass_swap: {
      name: 'Bass swap',
      description: 'Both tracks playing; Track B has its LO killed. Swap the two LO knobs on the first beat of a phrase.',
      source: 'community',
      settings: {
        ch1_src: 0, ch2_src: 1, ch1_fader: 10, ch2_fader: 9, ch2_lo: -1, ch1_lo: 0, ch1_xf: 1, ch2_xf: 1,
        ch3_fader: 0, ch4_fader: 0,
      },
    },
    filter_build: {
      name: 'Filter sweep build-up',
      description: 'Track A through FILTER 1 (HPF) with the resonance up: turn FREQ clockwise to build, back to 20 Hz to drop.',
      source: 'community',
      settings: {
        ch1_src: 0, ch1_fader: 10, ch1_filter: 0, f1_type: 0, f1_freq: 250, f1_res: 6, f1_crunch: 2,
        ch2_fader: 0, ch3_fader: 0, ch4_fader: 0,
      },
    },
    dub_echoes: {
      name: 'Dub stabs into the delay',
      description: 'Chord stabs on channel 3 feeding SEND 1 into the delay, returned on channel A; perc on channel 4 into the reverb.',
      source: 'community',
      settings: {
        ch1_src: 2, ch1_fader: 8, ch3_src: 4, ch3_fader: 8, ch3_snd1: 7, ch4_src: 5, ch4_fader: 6, ch4_snd2: 6,
        cha_input: 2, cha_fader: 8, chb_input: 2, chb_fader: 7, fx_time: 1, fx_fdbk: 5.5, ch2_fader: 0,
      },
    },
    stem_jam: {
      name: 'Live stem jam',
      description: 'Six stems on six channels (drums, bass, stabs, perc, sung lead on A via MIC, pad on B via MIC). Ride the faders and EQ.',
      source: 'community',
      settings: {
        ch1_src: 2, ch2_src: 3, ch3_src: 4, ch4_src: 5, cha_src: 7, chb_src: 6,
        ch1_input: 2, ch2_input: 2, ch3_input: 2, ch4_input: 2, cha_input: 1, chb_input: 1,
        ch1_fader: 9, ch2_fader: 8.5, ch3_fader: 6, ch4_fader: 6, cha_fader: 6, chb_fader: 5,
        ch2_snd1: 0, ch3_snd2: 3,
      },
    },
  },
};
