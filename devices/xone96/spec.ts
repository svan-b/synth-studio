// ============================================================================
// ALLEN & HEATH XONE:96 - analogue 6+2 channel DJ mixer (2018)
// Every control, label, range and position is documented with its source and a
// confidence level in devices/xone96/REFERENCE.md. Laws (dB curves, fader and
// crossfader curves, filter Q) live in ./model.ts; presets in ./presets.ts.
//
// Page references: Xone:96 User Guide AP11645 (page numbers as indexed on
// ManualsLib) and the Quick Start Guide AP11255.
//
// Twin-only additions (marked "Twin only" in their manual reference): the deck
// strip above the mixer (built-in sources, file loading, PLAY, BPM), the YOU
// HEAR selector (a browser has one output) and the stand-in FX unit on
// SND 1 / SND 2. Not modelled: the USB audio interfaces, MIDI, X:LINK, PHONES 2,
// MASTER 2, the master insert and the latching-cue mode.
// ============================================================================

import type { ButtonSpec, ControlSpec, DeviceSpec, KnobSpec, SwitchSpec } from '@/types';
import {
  CHANNELS, type ChannelId, chName, isAux, GAIN_MIN, killBandGain, midBandDb, MID_CUT_AUX, MID_CUT_MAIN, FADER_CURVE_NAMES,
  XFADER_CURVE_NAMES, FILTER_TYPES, SOURCE_NAMES, SRC, FX_TIMES, MONITOR_OUTS, masterLaw, resToQ, RETURNS, type ReturnId,
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

const P = {
  inputs: 'User Guide p.10 – Input select: USB 1 / PHONO / LINE / USB 2',
  inputsAux: 'User Guide p.10 – Channel A/B input select: USB 1 / MIC / RTN / USB 2',
  gain: 'User Guide p.10 – Channel GAIN (-∞ to +10 dB)',
  eq: 'User Guide p.10 – 4-band EQ: HI 3 kHz, HI MID 1.1 kHz, LO MID 350 Hz, LO 180 Hz',
  eqAux: 'User Guide p.10 – Channel A/B 3-band EQ: HI 3 kHz, swept MID 190 Hz–2.75 kHz, LO 180 Hz',
  meters: 'User Guide p.11 – Channel meters: post-GAIN, post-EQ, pre-FADER',
  curves: 'User Guide p.12 – XFADER assign, curve switches',
  filter: 'User Guide p.13 – Xone:VCF sections, FILTER 1 / FILTER 2',
  sends: 'User Guide p.14 – SEND 1 (pre/post) / SEND 2 (post)',
  returns: 'User Guide p.15 – Auxiliary return channels C–D',
  master: 'User Guide p.15 – Master section',
  cue: 'User Guide p.17 – Monitor section: CUE, CUE/MST, SPLIT CUE, POST EQ',
  booth: 'User Guide p.17 – Booth section',
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
        ? `Twin only: the built-in source on channel ${n}'s MIC input.`
        : `Twin only: the built-in "record" on channel ${n}'s PHONO and LINE inputs. A studio instrument routed to CH ${n} takes over LINE.`,
      manualReference: P.twin,
    } as SwitchSpec,
    [`${p}input`]: aux
      ? {
          type: 'switch', label: 'INPUT', options: ['USB 1', 'MIC', 'RTN', 'USB 2'], default: 2,
          description: `Channel ${n} source. RTN is the stereo return input: the stand-in ${ch === 'a' ? 'delay on SEND 1' : 'reverb on SEND 2'}, or a studio instrument routed to CH ${n}. MIC plays the built-in deck, USB your loaded file.`,
          manualReference: P.inputsAux,
        }
      : {
          type: 'switch', label: 'INPUT', options: ['USB 1', 'PHONO', 'LINE', 'USB 2'], default: 2,
          description: `Channel ${n} source. LINE hears a studio instrument routed to CH ${n} (or the built-in deck when none is), PHONO the built-in deck, USB 1/2 the audio file you loaded.`,
          manualReference: P.inputs,
        },
    [`${p}gain`]: {
      type: 'knob', label: 'GAIN', min: GAIN_MIN, max: 10, default: 0, units: 'dB', format: fmtGain,
      description: 'Input trim, -∞ to +10 dB. Set it first, with the fader down: the meter should average around 0 with peaks near +6 - never PK!.',
      manualReference: P.gain,
    },
    [`${p}hi`]: kill('HI', 'Treble above 3 kHz: +6 dB boost, or anticlockwise all the way to a full kill (hats, air, sibilance).'),
    [`${p}lo`]: kill('LO', 'Bass below 180 Hz: +6 dB boost, or anticlockwise all the way to a full kill (kick and bassline).'),
    [`${p}cue`]: {
      type: 'button', label: 'CUE', default: false, ledColor: '#ff3b30',
      description: 'Listen to this channel in the headphones before the crowd hears it; the LR meters show its level. AUTO-CUE: pressing another CUE cancels this one.',
      manualReference: P.cue,
    } as ButtonSpec,
    [`${p}filter`]: {
      type: 'switch', label: 'FILTER', options: ['1', 'OFF', '2'], default: 1,
      description: 'Route the channel (post-fader, post-crossfader) through FILTER 1, FILTER 2, or straight to the LR MIX when OFF.',
      manualReference: P.filter,
    },
    [`${p}xf`]: {
      type: 'switch', label: 'XFADER', options: ['X', 'OFF', 'Y'], default: 1,
      description: 'Put the channel on the X (left) or Y (right) side of the crossfader, or OFF so the crossfader leaves it alone.',
      manualReference: P.curves,
    },
    [`${p}fader`]: {
      type: 'slider', label: `CH ${n}`, min: 0, max: 10, default: 10, units: 'none', format: fmt10,
      description: aux
        ? 'Channel fader (60 mm): off at the bottom, unity at the top.'
        : 'Channel fader (60 mm): off at the bottom, unity at the top. Its response follows the CHANNEL FADER curve switch.',
      manualReference: P.curves,
    },
  };

  if (aux) {
    c[`${p}mid`] = mid('MID', 'Swept mid: +10 dB boost to -24 dB cut around the FREQ setting.', MID_CUT_AUX);
    c[`${p}midf`] = {
      type: 'knob', label: 'FREQ', min: 190, max: 2750, default: 700, units: 'Hz', curve: 'logarithmic',
      description: 'Centre of the swept MID band, 190 Hz to 2.75 kHz.', manualReference: P.eqAux,
    };
  } else {
    c[`${p}himid`] = mid('HI MID', 'Upper mids around 1.1 kHz: +10 / -27 dB (snare crack, vocal presence, stab bite).', MID_CUT_MAIN);
    c[`${p}lomid`] = mid('LO MID', 'Lower mids around 350 Hz: +10 / -27 dB (body and warmth - or mud when two tracks stack).', MID_CUT_MAIN);
    c[`${p}snd1`] = {
      type: 'knob', label: 'SEND 1', min: 0, max: 10, default: 0, units: 'none', format: fmt10,
      description: 'Level sent to SND 1 (pre- or post-fader, see the SEND 1 switch). In the twin SND 1 feeds the stand-in delay, returned on channel A (RTN).',
      manualReference: P.sends,
    };
    c[`${p}snd2`] = {
      type: 'knob', label: 'SEND 2', min: 0, max: 10, default: 0, units: 'none', format: fmt10,
      description: 'Post-fader level sent to SND 2. In the twin SND 2 feeds the stand-in reverb, returned on channel B (RTN).',
      manualReference: P.sends,
    };
  }
  return c;
}

function returnControls(r: ReturnId): Record<string, ControlSpec> {
  const n = r.toUpperCase();
  return {
    [`rtn${r}_level`]: {
      type: 'knob', label: 'LEVEL', min: GAIN_MIN, max: 10, default: 0, units: 'dB', format: fmtGain,
      description: `RTN ${n} input level, off to +10 dB. A studio instrument routed to RTN ${n} goes straight to the LR MIX (no EQ, fader or filter).`,
      manualReference: P.returns,
    },
    [`rtn${r}_on`]: {
      type: 'button', label: 'ON', default: true, ledColor: '#34d058',
      description: `Switch RTN ${n} on or off.`, manualReference: P.returns,
    } as ButtonSpec,
    [`rtn${r}_cue`]: {
      type: 'button', label: 'CUE', default: false, ledColor: '#ff3b30',
      description: `Listen to RTN ${n} in the headphones.`, manualReference: P.returns,
    } as ButtonSpec,
  };
}

function filterControls(f: 1 | 2): Record<string, ControlSpec> {
  const p = `f${f}_`;
  return {
    [`${p}on`]: {
      type: 'button', label: 'ON', default: false, ledColor: '#3b9dff',
      description: `FILTER ${f} on (blue). Off, channels assigned to it pass unfiltered.`,
      manualReference: P.filter,
    } as ButtonSpec,
    [`${p}type`]: {
      type: 'switch', label: 'TYPE', options: FILTER_TYPES, default: f === 1 ? 0 : 2,
      description: 'HPF removes the lows, BPF keeps a band, LPF removes the highs. Press two switches together to combine them (HPF + LPF is a notch).',
      manualReference: P.filter,
    } as SwitchSpec,
    [`${p}freq`]: {
      type: 'knob', label: 'FREQ', min: 20, max: 20000, default: f === 1 ? 20 : 20000, units: 'Hz', curve: 'logarithmic',
      description: 'The filter\'s -3 dB cut-off, 20 Hz to 20 kHz. HPF at 20 Hz or LPF at 20 kHz lets everything through.',
      manualReference: P.filter,
    },
    [`${p}res`]: {
      type: 'knob', label: 'RES', min: 0, max: 10, default: 2, units: 'none',
      format: v => (v < 0.25 ? 'MILD' : v > 9.75 ? 'WILD' : `Q ${resToQ(v).toFixed(1)}`),
      description: 'Resonance: from MILD (barely there) to WILD (a ringing peak just short of self-oscillation).',
      manualReference: P.filter,
    },
    [`${p}crunch`]: {
      type: 'knob', label: 'CRUNCH', min: 0, max: 10, default: 0, units: 'none', format: fmt10,
      description: 'Harmonic distortion before the filter. 0 is clean; the LED lights red as it bites. Works only while the filter is ON.',
      manualReference: P.filter,
    },
  };
}

export const XONE96: DeviceSpec = {
  id: 'xone96',
  name: 'Xone:96',
  manufacturer: 'Allen & Heath',
  year: 2018,
  description: 'Analogue 6+2 channel DJ mixer: two Xone:VCF filters with CRUNCH, two FX sends, 4-band EQ with kills, two USB soundcards',
  manualUrl: 'https://www.allen-heath.com/hardware/xone-series/xone96/',
  // User Guide p.35: 336 mm wide x 410 mm deep x 109 mm high, 7 kg
  dimensions: { width: 336, height: 410, depth: 109 },
  display: { width: 1014, height: 1371, scale: 3 },

  signalFlow: [
    { id: 'decks', name: 'Built-in decks and FX unit (twin only)', order: 0, controls: ['play', 'bpm', 'monitor_out', 'fx_time', 'fx_fdbk', 'fx_size', ...CHANNELS.map(c => `ch${c}_src`)] },
    ...CHANNELS.map((c, i) => ({
      id: `ch${c}`,
      name: `Channel ${chName(c)}`,
      description: isAux(c) ? 'Aux channel: input select, GAIN, 3-band EQ with swept mid' : 'Stereo channel: input select, GAIN, 4-band EQ, two sends',
      order: i + 1,
      controls: Object.keys(channelControls(c)).filter(k => !k.endsWith('_src')),
    })),
    { id: 'filters', name: 'Xone:VCF filters', order: 7, controls: [...Object.keys(filterControls(1)), ...Object.keys(filterControls(2))] },
    { id: 'xfader', name: 'Crossfader and curves', order: 8, controls: ['xfader', 'xf_curve', 'fader_curve'] },
    { id: 'returns', name: 'Return channels C and D', order: 9, controls: [...Object.keys(returnControls('c')), ...Object.keys(returnControls('d'))] },
    { id: 'master', name: 'Master, booth and monitor', order: 10, controls: ['master', 'booth', 'booth_lo', 'booth_mid', 'booth_hi', 'booth_mono', 'booth_mute', 'cue_mix', 'phones', 'split_cue', 'cue_post_eq', 'send1_pre'] },
  ],

  controls: {
    ...Object.assign({}, ...CHANNELS.map(channelControls)),
    ...Object.assign({}, ...RETURNS.map(returnControls)),
    ...filterControls(1),
    ...filterControls(2),

    xfader: {
      type: 'slider', label: 'XFADER', min: 0, max: 10, default: 5, units: 'none',
      format: v => (v < 0.05 ? 'X' : v > 9.95 ? 'Y' : v.toFixed(1)),
      description: 'Crossfader (innoFADER mini): X side fully left, Y side fully right. It only affects channels assigned to X or Y.',
      manualReference: P.curves,
    },
    xf_curve: {
      type: 'switch', label: 'XFADER CURVE', options: XFADER_CURVE_NAMES, default: 0,
      description: 'CONST PWR: a smooth blend, both sides -3 dB in the middle. TRANSITION: both stay full to the middle, then fade. FAST CUT: full until the last millimetre, for cuts and scratching.',
      manualReference: P.curves,
    },
    fader_curve: {
      type: 'switch', label: 'CHANNEL FADER', options: FADER_CURVE_NAMES, default: 0,
      description: 'Global response of the channel 1-4 faders. CONST PWR: the smooth Xone:92 feel (most change near the top). DIPPED: more linear. FAST CUT: full level within 5 mm.',
      manualReference: P.curves,
    },

    master: {
      type: 'knob', label: 'MASTER 1', min: 0, max: 10, default: 8, units: 'none', format: fmtMaster,
      description: 'Main output level. Unity at 8 (about 3 o\'clock), +6 dB fully up. The LR MIX meters read before it, so it never changes them.',
      manualReference: P.master,
    },
    booth: {
      type: 'knob', label: 'BOOTH', min: 0, max: 10, default: 7, units: 'none', format: fmtMaster,
      description: 'Booth monitor level (rear BOOTH outputs). Unity at 8. Choose YOU HEAR: BOOTH to listen to it.',
      manualReference: P.booth,
    },
    booth_lo: { type: 'knob', label: 'LO', min: -8, max: 8, default: 0, units: 'dB', bipolar: true, format: fmtDb, description: 'Booth EQ low shelf, ±8 dB.', manualReference: P.booth },
    booth_mid: { type: 'knob', label: 'MID', min: -8, max: 8, default: 0, units: 'dB', bipolar: true, format: fmtDb, description: 'Booth EQ mid, ±8 dB.', manualReference: P.booth },
    booth_hi: { type: 'knob', label: 'HI', min: -8, max: 8, default: 0, units: 'dB', bipolar: true, format: fmtDb, description: 'Booth EQ high shelf, ±8 dB.', manualReference: P.booth },
    booth_mono: {
      type: 'button', label: 'MONO', default: false, ledColor: '#ffb020',
      description: 'Sum the booth output to mono (a level drop means the left and right are out of phase).', manualReference: P.booth,
    },
    booth_mute: {
      type: 'button', label: 'MUTE', default: false, ledColor: '#ff3b30',
      description: 'Mute the booth outputs only.', manualReference: P.booth,
    },
    cue_mix: {
      type: 'knob', label: 'CUE / MST', min: 0, max: 10, default: 0, units: 'none',
      format: v => (v < 0.1 ? 'CUE' : v > 9.9 ? 'MST' : v.toFixed(1)),
      description: 'Headphone blend: the cued channels (left) to the master mix (right). SPLIT CUE overrides it.',
      manualReference: P.cue,
    },
    phones: {
      type: 'knob', label: 'LEVEL', min: 0, max: 10, default: 6, units: 'none', format: fmt10,
      description: 'MONITOR headphone level. It does not change the master or booth.', manualReference: P.cue,
    },
    split_cue: {
      type: 'button', label: 'SPLIT CUE', default: false, ledColor: '#ff3b30',
      description: 'Cue in the left ear, the LR MIX in the right. The left LR meter then shows the cue.',
      manualReference: P.cue,
    },
    cue_post_eq: {
      type: 'button', label: 'POST EQ', default: true, ledColor: '#ffb020',
      description: 'Take the channel cue after the EQ (lit) or before it.', manualReference: P.cue,
    },
    send1_pre: {
      type: 'switch', label: 'SEND 1', options: ['POST', 'PRE'], default: 0,
      description: 'SEND 1 taken after the channel fader (POST) or before it (PRE, so the effect keeps going with the fader down). SEND 2 is always post-fader.',
      manualReference: P.sends,
    },

    // --- Twin only -------------------------------------------------------------
    monitor_out: {
      type: 'switch', label: 'YOU HEAR', options: MONITOR_OUTS, default: 0,
      description: 'Twin only: a browser has one output, so choose which mixer output your speakers play. PHONES lets you hear the cue.',
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
