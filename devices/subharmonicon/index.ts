import type { DeviceModule } from '../types';
import { SUBHARMONICON } from './spec';
import { SUBHARMONICON_LAYOUT } from './layout';
import { SUBHARMONICON_LESSONS } from './lessons';
import { SubharmoniconEngine } from './engine';

const subharmonicon: DeviceModule = {
  spec: SUBHARMONICON,
  layout: SUBHARMONICON_LAYOUT,
  lessons: SUBHARMONICON_LESSONS,
  createEngine: () => new SubharmoniconEngine(),
  worklets: ['/worklets/subharmonicon-processors.js'],
  transportControl: 'play',
  // The computer keyboard stands in for MIDI IN: notes are offsets from C4 (the A key)
  keyboard: { lowNote: 60 },
  // MIDI clock: follows the studio transport (one master count per 16th note)
  studio: { midiSync: true },
  /**
   * Lessons' "listen to the target": the sequence from step 1 on the internal clock
   * (with EG off, or nothing assigned, the envelopes are gated so it still sounds).
   * If it is already playing it simply keeps playing with the target settings.
   */
  audition: api => {
    api.event('audition');
    return () => api.event('audition:stop');
  },
  tips: [
    'PLAY (or Space) runs the sequencers. Each RHYTHM knob divides the clock by 1-16; its SEQ 1 / SEQ 2 buttons choose which sequencer it steps. Two rhythms on two sequencers make a polyrhythm.',
    'SUB FREQ knobs divide their VCO by a whole number: ÷1 fully clockwise (unison) to ÷16. Press and hold EG until it blinks (HELD) for a drone, so you can tune chords by ear.',
    'SEQ OCT and QUANTIZE: press the button to cycle, or tap an LED. EG: tap for ON / OFF, press and hold for HELD.',
    'Keys A-K play from C4 (A = no transposition): they transpose both VCOs and the running sequence, and the last key stays in effect - press A to return to the panel\'s pitch.',
    'In the studio the Subharmonicon follows the studio clock like MIDI: one master count per 16th note, so RHYTHM ÷4 plays quarter notes. A cable from Studio Clock CLOCK into CLOCK takes over the clock; the studio still starts and stops PLAY.',
    'Patch: tap an output (white label), then an input, or drag. Tap a cable to unplug it. The VCA and CUTOFF jacks add to their envelopes; VCO 1\'s jack also feeds VCO 2 until VCO 2 has a cable; a PWM cable replaces SUB 1\'s sweep.',
  ],
};

export default subharmonicon;
