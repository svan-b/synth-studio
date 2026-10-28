// ============================================================================
// "Your synth (MIDI)": bring a hardware synth into the studio.
// CC knobs set up per instance (or from a midi.guide template), a 16-step
// sequencer locked to the studio transport with exactly timestamped notes, and
// a keyboard. It makes no sound of its own - pair it with an Audio input to hear
// (and record) the hardware through the studio. See docs/EXTERNAL_GEAR.md.
// ============================================================================

import type { DeviceModule } from '../types';
import { MIDI_SYNTH } from './spec';
import { MIDI_SYNTH_LAYOUT } from './layout';
import { MidiSynthEngine } from './engine';
import { initialData, migrateData } from './config';

const midiSynth: DeviceModule = {
  spec: MIDI_SYNTH,
  layout: MIDI_SYNTH_LAYOUT,
  lessons: [],
  createEngine: () => new MidiSynthEngine(),
  keyboard: { lowNote: 48 },
  transportControl: 'play',
  studio: { midiSync: true },
  data: { initial: initialData, migrate: migrateData },
  tips: [
    'Open Setup: choose your synth\'s MIDI output and channel, then a template from midi.guide (CC maps for 450+ instruments) or type CC numbers from the manual.',
    'Hear it in the studio: connect the synth\'s audio out to your audio interface and add an Audio input. Then it mixes, records (REC) and routes like the twins.',
    'PLAY (or Space) starts the studio transport. The sequencer sends notes with exact MIDI timestamps, delayed by your audio output latency so the hardware lines up with what you hear.',
    'Tap a step to switch it on or off. Tap its note name, then play a key (on screen, A-K on your computer or a MIDI keyboard) to enter notes.',
    'Opening a project never sends the knobs (it would overwrite your synth\'s patch). Press Send all to recall the panel on the hardware.',
    'MIDI works in Chrome, Edge and Firefox on a computer. iPad and Safari have no Web MIDI, but Audio input still works there.',
  ],
};

export default midiSynth;
