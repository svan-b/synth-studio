// ============================================================================
// "Your synth (MIDI)": bring a hardware synth into the studio.
// CC knobs set up per instance (or from a midi.guide template), program
// changes, a 16-step sequencer locked to the studio transport with exactly
// timestamped notes, a keyboard and a MIDI monitor. It makes no sound of its
// own - pair it with an Audio input to hear (and record) the hardware through
// the studio. Out of the box it plays the built-in Practice synth, so it works
// without gear and on iPad. See docs/EXTERNAL_GEAR.md.
// ============================================================================

import type { DeviceModule } from '../types';
import { MIDI_SYNTH } from './spec';
import { MIDI_SYNTH_LAYOUT } from './layout';
import { MidiSynthEngine } from './engine';
import { initialData, migrateData } from './config';
import { MIDI_SYNTH_LESSONS } from './lessons';

const midiSynth: DeviceModule = {
  spec: MIDI_SYNTH,
  layout: MIDI_SYNTH_LAYOUT,
  lessons: MIDI_SYNTH_LESSONS,
  createEngine: () => new MidiSynthEngine(),
  keyboard: { lowNote: 48 },
  transportControl: 'play',
  studio: { midiSync: true },
  data: { initial: initialData, migrate: migrateData },
  // Four notes from soft to hard, on this synth's channel: velocity is easy to hear
  audition: api => {
    const notes: [number, number][] = [[48, 0.3], [51, 0.55], [55, 0.8], [60, 1]];
    notes.forEach(([n, v], i) => {
      api.after(i * 340, () => api.noteOn(n, v));
      api.after(i * 340 + 260, () => api.noteOff(n));
    });
  },
  tips: [
    'No synth yet? This panel starts on the built-in Practice synth (bass on channel 1, keys on 2, drums on 10), so you can learn every step without gear - also on iPad.',
    'Setup: choose your synth\'s MIDI output and channel, then a template from midi.guide (CC maps for 450+ instruments) or type CC numbers from the manual. Starters sets up common rigs in one tap.',
    'Hear it in the studio: connect the synth\'s audio out to your audio interface and add an Audio input. Then it mixes, records (REC) and routes like the twins.',
    'PLAY (or Space) starts the studio transport. The sequencer sends notes with exact MIDI timestamps, delayed by your audio output latency so the hardware lines up with what you hear. Tick "Send MIDI clock" in Setup to sync its arpeggiator.',
    'Tap a step to switch it on or off. Tap its note name, then play a key (on screen, A-K on your computer or a MIDI keyboard) to enter notes. Lower on a key plays louder.',
    'Opening a project never sends the knobs (it would overwrite your synth\'s patch). Press Send all to recall the program and the panel on the hardware.',
    'MIDI works in Chrome and Edge on a computer (Firefox too, with a small add-on). iPad and Safari have no Web MIDI: use the Practice synth there, and Audio input for your own gear.',
  ],
};

export default midiSynth;
