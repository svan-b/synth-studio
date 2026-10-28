import type { ControlSpec, DeviceSpec } from '@/types';
import { KNOB_IDS, POS_MAX } from './config';

// Knobs k1..k16 store the knob *position* (0..127). What each one sends - its
// label, CC number and range - lives in the instance's data (config.ts), so the
// same device can be a Sub 37, a Minilogue or a guitar pedal.
const knobs: Record<string, ControlSpec> = Object.fromEntries(
  KNOB_IDS.map((id, i) => [id, {
    type: 'knob',
    label: `KNOB ${i + 1}`,
    min: 0,
    max: POS_MAX,
    default: 64,
    units: 'none',
    description: 'Sends the MIDI CC set up for this knob (Setup)',
  } satisfies ControlSpec]),
);

export const MIDI_SYNTH: DeviceSpec = {
  id: 'midi-synth',
  name: 'Your synth (MIDI)',
  manufacturer: 'Bring your own',
  description: 'Plays and controls a hardware synth over MIDI: CC knobs, program changes, a 16-step sequencer locked to the studio and a keyboard',
  dimensions: { width: 290, height: 180 },
  display: { width: 1160, height: 720, scale: 4 },
  signalFlow: [],
  controls: {
    ...knobs,
    program: {
      type: 'knob', label: 'PROGRAM', min: 0, max: 127, default: 0, step: 1, units: 'none', size: 'small',
      format: v => String(Math.round(v) + 1),
      description: 'Program change: recalls a sound stored in your synth. Synths show programs from 1; the MIDI message counts from 0.',
    },
    play: {
      type: 'button', label: 'PLAY', default: false,
      description: 'Starts and stops the studio transport. The sequencer plays your synth in time with everything else.',
    },
    seq: {
      type: 'button', label: 'SEQ', default: true,
      description: 'Sequencer on/off. Off: the studio plays, but no steps are sent (play your synth by hand, or let its own arpeggiator play).',
    },
    gate: {
      type: 'knob', label: 'GATE', min: 5, max: 100, default: 50, units: '%', size: 'small',
      description: 'How long each step\'s note is held, as a share of a 16th note',
    },
    length: {
      type: 'knob', label: 'LENGTH', min: 1, max: 16, default: 16, step: 1, units: 'steps', size: 'small',
      description: 'Number of steps before the pattern repeats (odd lengths make polymeters against the studio)',
    },
    transpose: {
      type: 'knob', label: 'TRANSPOSE', min: -24, max: 24, default: 0, step: 1, units: 'semitones', bipolar: true, size: 'small',
      description: 'Shifts the whole pattern up or down in semitones',
    },
  },
};
