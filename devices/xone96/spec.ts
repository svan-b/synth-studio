// ============================================================================
// ALLEN & HEATH XONE:96 - analogue 6+2 channel DJ mixer (2018)
// Every control, label, range and position is documented with its source and a
// confidence level in devices/xone96/REFERENCE.md. Laws (dB curves, fader and
// crossfader curves, filter Q) live in ./model.ts; presets in ./presets.ts.
//
// Page references are to the Xone:96 User Guide AP11645 issue 2 (41 pages,
// with the block diagram on p.34 and the specifications on p.35-37).
//
// Twin-only additions (marked "Twin only" in their manual reference): the deck
// strip above the mixer (built-in sources, file loading, PLAY, BPM), the YOU
// HEAR selector (a browser has one output) and the stand-in FX unit on
// SND 1 / SND 2. Not modelled: the USB audio interfaces, MIDI, X:LINK, the
// master insert, the LN/PH and LN/Hi-Z switches and the latching-cue mode.
// ============================================================================

import type { ButtonSpec, ControlSpec, DeviceSpec, KnobSpec, SwitchSpec } from '@/types';
import {
  CHANNELS, type ChannelId, chName, isAux, GAIN_MIN, killBandGain, midBandDb, MID_CUT_AUX, MID_CUT_MAIN, FADER_CURVE_NAMES,
  XFADER_CURVE_NAMES, FILTER_TYPES, SOURCE_NAMES, SRC, FX_TIMES, MONITOR_OUTS, masterLaw, resToQ, RETURNS, type ReturnId,
  sendLaw, PHONES2_SOURCES,
} from './model';
import { XONE96_PRESETS } from './presets';

const fmtDb = (db: number) => {
  if (db === -Infinity || db < -60) return '-∞ dB';
  if (Math.abs(db) < 0.05) return '0 dB';
  return `${db > 0 ? '+' : ''}${db.toFixed(Math.abs(db) < 10 ? 1 : 0)} dB`;
};
const fmtKill = (v: number) => (v <= -0.985 ? 'KILL' : fmtDb(20 * Math.log10(killBandGain(v))));
const fmtGain = (v: number) => (v <= GAIN_MIN + 0.01 ? '-∞ dB' : fmtDb(v));
const fmt10 = (v: number) => v.toFixed(1);
const fmtMaster = (v: number) => `${v.toFixed(1)} · ${fmtDb(20 * Math.log10(Math.max(1e-6, masterLaw(v))))}`;
const fmtSend = (v: number) => (v < 0.05 ? '-∞ dB' : fmtDb(20 * Math.log10(sendLaw(v))));

const UG = 'Xone:96 User Guide';
const P = {
  inputs: `${UG} p.10 – Input select: USB 1 / PH / LN / USB 2`,
  inputsAux: `${UG} p.8 – CH A/B input select: USB 1 / MIC / RTN / USB 2`,
  gain: `${UG} p.8, p.10 – GAIN, -∞ to +10 dB; PK! LED`,
  eq: `${UG} p.10 – 4-band EQ: HI 3 kHz, HI MID 1.1 kHz, LO MID 350 Hz, LO 180 Hz`,
  eqAux: `${UG} p.8 – CH A/B 3-band EQ: HI 3 kHz, swept MID 190 Hz–2.75 kHz, LO 180 Hz`,
  assign: `${UG} p.9, p.11 – FILTER assign (all six channels), XFADER assign (CH 1-4)`,
  cue: `${UG} p.9 – CUE (AUTO-CUE)`,
  fader: `${UG} p.9, p.11 – Channel faders: CH 1-4 VCA, CH A/B analogue`,
  curves: `${UG} p.12 – Crossfader and fader curve switches`,
  filter: `${UG} p.13-14 – Xone:VCF sections, FILTER 1 / FILTER 2`,
  sends: `${UG} p.8, p.10 – SEND 1 (PRE or post) / SEND 2 (post), ∞ to +6`,
  returns: `${UG} p.15 – Auxiliary return channels C–D`,
  master: `${UG} p.16 – MASTER 1 / MASTER 2`,
  phones2: `${UG} p.16 – PHONES 2: 9-way source, CUE/MST, LEVEL`,
  monitor: `${UG} p.17 – Monitor section: POST EQ, SPLIT CUE, CUE/MST, LEVEL`,
  booth: `${UG} p.17 – Booth section: STEREO/MONO, 3-band EQ, level, MUTE`,
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
      default: ({ a: SRC.LEAD, b: SRC.PAD, '1': SRC.TRACK_A, '2': SRC.NONE, '3': SRC.NONE, '4': SRC.NONE } as const)[ch],
      description: aux
        ? `Twin only: the built-in source on channel ${n}'s MIC input (it plays through the mic clean feed: MASTER outputs only).`
        : `Twin only: the built-in "record" on channel ${n}'s PHONO and LINE inputs. A studio instrument routed to CH ${n} takes over LINE.`,
      manualReference: P.twin,
    } as SwitchSpec,
    [`${p}input`]: aux
      ? {
          type: 'switch', label: 'INPUT', options: ['USB 1', 'MIC', 'RTN', 'USB 2'], default: 2,
          description: `Channel ${n} source. RTN is the stereo return input: the stand-in ${ch === 'a' ? 'delay on SEND 1' : 'reverb on SEND 2'}, or a studio instrument routed to CH ${n}. MIC plays the built-in deck through the clean feed (MASTER 1/2 only, no filter, no booth). USB plays your loaded file.`,
          manualReference: P.inputsAux,
        }
      : {
          type: 'switch', label: 'INPUT', options: ['USB 1', 'PH', 'LN', 'USB 2'], default: 2,
          description: `Channel ${n} source. LN (line) hears a studio instrument routed to CH ${n}, or the built-in deck when none is; PH (phono) the built-in deck; USB 1/2 the audio file you loaded.`,
          manualReference: P.inputs,
        },
    [`${p}gain`]: {
      type: 'knob', label: 'GAIN', min: GAIN_MIN, max: 10, default: 0, units: 'dB', format: fmtGain,
      description: 'Input trim, -∞ to +10 dB. Set it first: the channel meter should average around 0 with the loudest peaks near +6. If the PK! LED lights, turn GAIN down.',
      manualReference: P.gain,
    },
    [`${p}hi`]: kill('HI', 'Treble above 3 kHz: +6 dB boost, or anticlockwise all the way to a full kill (hats, air, sibilance).'),
    [`${p}lo`]: kill('LO', 'Bass below 180 Hz: +6 dB boost, or anticlockwise all the way to a full kill (kick and bassline).'),
    [`${p}cue`]: {
      type: 'button', label: 'CUE', default: false, ledColor: '#ff3b30',
      description: 'Listen to this channel in the MONITOR headphones before the crowd hears it; the main meters show its level. AUTO-CUE: pressing another CUE cancels this one.',
      manualReference: P.cue,
    } as ButtonSpec,
    [`${p}filter`]: {
      type: 'switch', label: 'FILTER', options: ['1', 'OFF', '2'], default: 1,
      description: aux
        ? 'Route the channel (after its fader) through FILTER 1, FILTER 2, or straight to the LR MIX when OFF. Ignored while INPUT is MIC: the mic goes to the clean feed.'
        : 'Route the channel (after its fader and the crossfader) through FILTER 1, FILTER 2, or straight to the LR MIX when OFF.',
      manualReference: P.assign,
    },
    [`${p}fader`]: {
      type: 'slider', label: `CH ${n}`, min: 0, max: 10, default: 10, units: 'none', format: fmt10,
      description: aux
        ? 'Channel fader (60 mm, analogue): off at the bottom, unity at the top. Not on the crossfader or the CHANNEL FADER curve switch.'
        : 'Channel fader (60 mm VCA): off at the bottom, unity at the top. Its response follows the CHANNEL FADER curve switch.',
      manualReference: P.fader,
    },
  };

  if (aux) {
    c[`${p}mid`] = mid('MID', 'Swept mid: +10 dB boost to -24 dB cut around the FREQ setting.', MID_CUT_AUX);
    c[`${p}midf`] = {
      type: 'knob', label: 'FREQ', min: 190, max: 2750, default: 650, units: 'Hz', curve: 'logarithmic',
      description: 'Centre of the swept MID band, 190 Hz to 2.75 kHz (650 Hz is printed at the top).', manualReference: P.eqAux,
    };
  } else {
    c[`${p}himid`] = mid('HI MID', 'Upper mids around 1.1 kHz: +10 / -27 dB (snare crack, vocal presence, stab bite).', MID_CUT_MAIN);
    c[`${p}lomid`] = mid('LO MID', 'Lower mids around 350 Hz: +10 / -27 dB (body and warmth - or mud when two tracks stack).', MID_CUT_MAIN);
    c[`${p}xf`] = {
      type: 'switch', label: 'XFADER', options: ['X', 'OFF', 'Y'], default: 1,
      description: 'Put the channel on the X (left) or Y (right) side of the crossfader, or OFF so the crossfader leaves it alone.',
      manualReference: P.assign,
    };
  }
  const loop = aux ? ` Careful: with INPUT on RTN, channel ${n}'s own sends feed its effect back into itself - dub-style feedback.` : '';
  c[`${p}snd1`] = {
    type: 'knob', label: 'SEND 1', min: 0, max: 10, default: 0, units: 'none', format: fmtSend,
    description: `Level sent to SND 1, off to +6 dB: after the fader${aux ? '' : ' and crossfader'} unless PRE is lit. It is taken before the filter, so the effect hears the unfiltered channel. In the twin SND 1 feeds the stand-in delay, returned on channel A (RTN).${loop}`,
    manualReference: P.sends,
  };
  c[`${p}snd2`] = {
    type: 'knob', label: 'SEND 2', min: 0, max: 10, default: 0, units: 'none', format: fmtSend,
    description: `Post-fader level sent to SND 2, off to +6 dB. In the twin SND 2 feeds the stand-in reverb, returned on channel B (RTN).${loop}`,
    manualReference: P.sends,
  };
  c[`${p}pre`] = {
    type: 'button', label: 'PRE', default: false, ledColor: '#ffb020',
    description: 'Take this channel\'s SEND 1 before the fader (after the EQ), so the effect keeps getting signal with the fader down. Off: post-fader. SEND 2 is always post-fader.',
    manualReference: P.sends,
  } as ButtonSpec;
  return c;
}

function returnControls(r: ReturnId): Record<string, ControlSpec> {
  const n = r.toUpperCase();
  return {
    [`rtn${r}_level`]: {
      type: 'knob', label: 'LEVEL', min: GAIN_MIN, max: 10, default: 0, units: 'dB', format: fmtGain,
      description: `RTN ${n} input level, off to +10. A studio instrument routed to RTN ${n} goes straight to the LR MIX (no EQ, fader or filter). The SIG LED glows green with signal, red when too hot.`,
      manualReference: P.returns,
    },
    [`rtn${r}_on`]: {
      type: 'button', label: 'ON/OFF', default: true, ledColor: '#34d058',
      description: `Switch RTN ${n} into the LR MIX. CUE still hears it while it is off.`, manualReference: P.returns,
    } as ButtonSpec,
    [`rtn${r}_cue`]: {
      type: 'button', label: 'CUE', default: false, ledColor: '#ff3b30',
      description: `Listen to RTN ${n} in the MONITOR headphones.`, manualReference: P.returns,
    } as ButtonSpec,
  };
}

function filterControls(f: 1 | 2): Record<string, ControlSpec> {
  const p = `f${f}_`;
  return {
    [`${p}on`]: {
      type: 'button', label: 'ON', default: false, ledColor: '#3b9dff',
      description: `FILTER ${f} on (blue). Off, the channels assigned to it pass unfiltered and CRUNCH is out of circuit.`,
      manualReference: P.filter,
    } as ButtonSpec,
    [`${p}type`]: {
      type: 'switch', label: 'TYPE', options: FILTER_TYPES, default: f === 1 ? 0 : 2,
      description: 'HPF removes the lows, BPF keeps a band, LPF removes the highs. Press two or three switches together to combine their outputs: HPF + LPF is a notch, all three an all-pass that is flat with RES at 12 o\'clock.',
      manualReference: P.filter,
    } as SwitchSpec,
    [`${p}freq`]: {
      type: 'knob', label: 'FREQ', min: 20, max: 20000, default: f === 1 ? 20 : 20000, units: 'Hz', curve: 'logarithmic',
      description: 'The filter\'s cut-off, 20 Hz to 20 kHz. HPF at 20 Hz or LPF at 20 kHz lets everything through.',
      manualReference: P.filter,
    },
    [`${p}res`]: {
      type: 'knob', label: 'RES', min: 0, max: 10, default: 2, units: 'none',
      format: v => (v < 0.25 ? 'MILD' : v > 9.75 ? 'WILD' : `Q ${resToQ(v).toFixed(2)}`),
      description: 'Resonance: from MILD (soft, -6 dB at FREQ) through flat at 12 o\'clock to WILD (a +7.6 dB peak at FREQ).',
      manualReference: P.filter,
    },
    [`${p}crunch`]: {
      type: 'knob', label: 'CRUNCH', min: 0, max: 10, default: 0, units: 'none', format: fmt10,
      description: 'Harmonic distortion before the filter. 0 is clean and the LED is off; 10 distorts hard and the LED glows red. It bites best with the assigned channels reading within ±6 dB of 0.',
      manualReference: P.filter,
    },
  };
}

export const XONE96: DeviceSpec = {
  id: 'xone96',
  name: 'Xone:96',
  manufacturer: 'Allen & Heath',
  year: 2018,
  description: 'Analogue 6+2 channel DJ mixer: two Xone:VCF filters with CRUNCH, two FX sends, 4-band EQ with kills, two cue systems, two USB soundcards',
  manualUrl: 'https://www.allen-heath.com/hardware/xone-series/xone96/',
  // Xone:96 User Guide p.37: 339 mm wide x 410 mm deep x 109 mm high, 7 kg
  dimensions: { width: 339, height: 410, depth: 109 },
  display: { width: 1017, height: 1371, scale: 3 },

  signalFlow: [
    { id: 'decks', name: 'Built-in decks and FX unit (twin only)', order: 0, controls: ['play', 'bpm', 'monitor_out', 'fx_time', 'fx_fdbk', 'fx_size', ...CHANNELS.map(c => `ch${c}_src`)] },
    ...CHANNELS.map((c, i) => ({
      id: `ch${c}`,
      name: `Channel ${chName(c)}`,
      description: isAux(c) ? 'Aux channel: input select, GAIN, 3-band EQ with swept mid, sends, filter assign' : 'Stereo channel: input select, GAIN, 4-band EQ, sends, filter and crossfader assign',
      order: i + 1,
      controls: Object.keys(channelControls(c)).filter(k => !k.endsWith('_src')),
    })),
    { id: 'returns', name: 'Return channels C and D', order: 7, controls: [...Object.keys(returnControls('c')), ...Object.keys(returnControls('d'))] },
    { id: 'filters', name: 'Xone:VCF filters', order: 8, controls: [...Object.keys(filterControls(1)), ...Object.keys(filterControls(2))] },
    { id: 'xfader', name: 'Crossfader and curves', order: 9, controls: ['xfader', 'xf_curve', 'fader_curve'] },
    { id: 'master', name: 'Master and booth', order: 10, controls: ['master', 'master2', 'booth', 'booth_lo', 'booth_mid', 'booth_hi', 'booth_mono', 'booth_mute'] },
    { id: 'monitor', name: 'Monitor and PHONES 2', order: 11, controls: ['cue_post_eq', 'split_cue', 'cue_mix', 'phones', 'cue_latch', 'phones2_src', 'phones2_mix', 'phones2'] },
  ],

  controls: {
    ...Object.assign({}, ...CHANNELS.map(channelControls)),
    ...Object.assign({}, ...RETURNS.map(returnControls)),
    ...filterControls(1),
    ...filterControls(2),

    xfader: {
      type: 'slider', label: 'XFADER', min: 0, max: 10, default: 5, units: 'none',
      format: v => (v < 0.05 ? 'X' : v > 9.95 ? 'Y' : v.toFixed(1)),
      description: 'Crossfader (45 mm innoFADER mini, a VCA): X side fully left, Y side fully right. It only affects channels 1-4 assigned to X or Y, and it also sets their level into the filters and post-fader sends.',
      manualReference: P.curves,
    },
    xf_curve: {
      type: 'switch', label: 'XFADER', options: XFADER_CURVE_NAMES, default: 0,
      description: 'CONST PWR: a smooth blend, both sides -3 dB in the middle. TRANSITION: both sides full over the middle, fading in the last fifth of the travel. FAST CUT: each side opens within the first few millimetres, for cuts and scratching.',
      manualReference: P.curves,
    },
    fader_curve: {
      type: 'switch', label: 'CHANNEL FADER', options: FADER_CURVE_NAMES, default: 0,
      description: 'Global response of the channel 1-4 faders. CONST PWR: a long taper (halfway is about -22 dB). DIPPED: halfway about -14 dB. FAST CUT: most of the change in the bottom third (halfway about -8 dB).',
      manualReference: P.curves,
    },

    master: {
      type: 'knob', label: 'MASTER 1', min: 0, max: 10, default: 8, units: 'none', format: fmtMaster,
      description: 'Level of the main MST 1 output (XLR). Unity at 8, +6 dB fully up. The LR MIX meters, booth and headphones read before it.',
      manualReference: P.master,
    },
    master2: {
      type: 'knob', label: 'MASTER 2', min: 0, max: 10, default: 8, units: 'none', format: fmtMaster,
      description: 'Level of the second MST 2 output (1/4" jacks), independent of MASTER 1. Its output stage clips 6 dB sooner (+18 dBu). Choose YOU HEAR: MST 2 to listen to it.',
      manualReference: P.master,
    },
    booth: {
      type: 'knob', label: 'BOOTH', min: 0, max: 10, default: 7, units: 'none', format: fmtMaster,
      description: 'Booth monitor level (rear BOOTH outputs). Unity at 8. The booth gets the music only: mics on the clean feed stay out of it. Choose YOU HEAR: BOOTH to listen to it.',
      manualReference: P.booth,
    },
    booth_lo: { type: 'knob', label: 'LO', min: -8, max: 8, default: 0, units: 'dB', bipolar: true, format: fmtDb, description: 'Booth EQ low shelf, ±8 dB.', manualReference: P.booth },
    booth_mid: { type: 'knob', label: 'MID', min: -8, max: 8, default: 0, units: 'dB', bipolar: true, format: fmtDb, description: 'Booth EQ mid, ±8 dB.', manualReference: P.booth },
    booth_hi: { type: 'knob', label: 'HI', min: -8, max: 8, default: 0, units: 'dB', bipolar: true, format: fmtDb, description: 'Booth EQ high shelf, ±8 dB.', manualReference: P.booth },
    booth_mono: {
      type: 'button', label: 'STEREO/MONO', default: false, ledColor: '#ffb020',
      description: 'Sum the booth output to mono (a level drop or thin bass means the left and right are out of phase).', manualReference: P.booth,
    },
    booth_mute: {
      type: 'button', label: 'MUTE', default: false, ledColor: '#ff3b30',
      description: 'Mute the booth outputs only.', manualReference: P.booth,
    },
    cue_mix: {
      type: 'knob', label: 'CUE / MST', min: 0, max: 10, default: 0, units: 'none',
      format: v => (v < 0.1 ? 'CUE' : v > 9.9 ? 'CUE + MST' : v.toFixed(1)),
      description: 'MONITOR headphones: an add-mix control. Fully anticlockwise you hear only the cued channels; turning clockwise adds the LR MIX alongside them, while the cue stays at full level. SPLIT CUE overrides it. With nothing cued, the headphones play the LR MIX.',
      manualReference: P.monitor,
    },
    phones: {
      type: 'knob', label: 'LEVEL', min: 0, max: 11, default: 6, units: 'none', format: fmt10,
      description: 'MONITOR headphone level (0 to 11). It does not change the master, booth or PHONES 2.', manualReference: P.monitor,
    },
    split_cue: {
      type: 'button', label: 'SPLIT CUE', default: false, ledColor: '#ffb020',
      description: 'Cue in the left ear, the LR MIX in the right; the main meters then show CUE (left) and PRG (right).',
      manualReference: P.monitor,
    },
    cue_post_eq: {
      type: 'button', label: 'POST EQ', default: true, ledColor: '#ffb020',
      description: 'Take every channel cue after the EQ (lit) or before it: the CUE switches and the PHONES 2 selector alike.', manualReference: P.monitor,
    },
    phones2_src: {
      type: 'switch', label: 'PHONES 2', options: PHONES2_SOURCES, default: 0,
      description: 'The second, independent cue system: pick the LR MIX (MST) or one channel (1-4, A, B, C, D, before its fader; after its EQ while POST EQ is lit). The channel CUE switches don\'t affect it.',
      manualReference: P.phones2,
    } as SwitchSpec,
    phones2_mix: {
      type: 'knob', label: 'CUE / MST', min: 0, max: 10, default: 0, units: 'none',
      format: v => (v < 0.1 ? 'CUE' : v > 9.9 ? 'CUE + MST' : v.toFixed(1)),
      description: 'PHONES 2: adds the LR MIX to the selected source.', manualReference: P.phones2,
    },
    phones2: {
      type: 'knob', label: 'LEVEL', min: 0, max: 11, default: 6, units: 'none', format: fmt10,
      description: 'PHONES 2 headphone level (0 to 11). Choose YOU HEAR: PHONES 2 to listen to it.', manualReference: P.phones2,
    },

    cue_latch: {
      type: 'button', label: 'LATCH CUE', default: false, ledColor: '#ff3b30',
      description: 'The LATCHING-CUE mode: lit, several CUEs can be on together; off (AUTO-CUE, the default), pressing a CUE cancels the others. On the mixer you set it by holding a filter type switch on both filters for 3 s and then pressing a CUE; the twin gives it a button.',
      manualReference: `${UG} p.9 – AUTO-CUE / LATCHING-CUE (twin: a button instead of the 3 s gesture)`,
    },

    // --- Twin only -------------------------------------------------------------
    monitor_out: {
      type: 'switch', label: 'YOU HEAR', options: MONITOR_OUTS, default: 0,
      description: 'Twin only: a browser has one output, so choose which mixer output your speakers play: MASTER (MST 1), BOOTH, PHONES (the MONITOR headphones), PHONES 2 or MST 2.',
      manualReference: P.twin,
    },
    play: {
      type: 'button', label: 'PLAY', default: false, ledColor: '#22c55e',
      description: 'Start / stop the built-in decks (Space). While the Xone follows the studio clock this is the studio ▶.',
      manualReference: P.twin,
    },
    bpm: {
      type: 'knob', label: 'BPM', min: 100, max: 140, default: 124, step: 1, units: 'BPM',
      description: 'Tempo of the built-in decks when the Xone is not synced to the studio (synced, the studio tempo rules).', manualReference: P.twin,
    },
    fx_time: {
      type: 'switch', label: 'DELAY', options: FX_TIMES, default: 1,
      description: 'Delay time of the stand-in FX unit on SEND 1, in beats of the tempo.', manualReference: P.twin,
    },
    fx_fdbk: {
      type: 'knob', label: 'FDBK', min: 0, max: 10, default: 4.5, units: 'none', format: fmt10,
      description: 'Delay feedback: how many repeats.', manualReference: P.twin,
    },
    fx_size: {
      type: 'knob', label: 'REVERB', min: 0.5, max: 6, default: 2.5, units: 's', curve: 'logarithmic',
      description: 'Reverb decay time of the stand-in FX unit on SEND 2.', manualReference: P.twin,
    },
  },

  presets: XONE96_PRESETS,
};
