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
    'SUB FREQ knobs divide their VCO by a whole number: ÷1 fully clockwise (unison) to ÷16. Press and hold EG until it blinks (or tap HELD under it) for a drone, so you can tune chords by ear.',
    'SEQ OCT and QUANTIZE: press the button to cycle, or tap an LED. Press and hold one until its LED flashes (or tap OUT ±5 / OUT UNQ beside them) to free the SEQ 1 / SEQ 2 jacks from it.',
    'TEMPO is linear, as on the hardware: 12 o\'clock is about 1510 BPM, so musical tempos sit in its first quarter. 480 BPM counts 16th notes at 120.',
    'Keys A-K play from C4. Stopped, a key acts like TRIGGER with a pitch: a pluck with EG lit, but with EG off a gate that keeps the sound at full VOLUME until you let go - much louder than the steps, so tap on EG-off patches. Running, keys transpose the sequence and the last one stays, as on the hardware: press A to return to the panel\'s pitch.',
    'In the studio the Subharmonicon follows the studio clock like MIDI: one master count per 16th note, so RHYTHM ÷4 plays quarter notes and TEMPO is ignored. Moog\'s patch sheets set their speed with TEMPO: to hear one at its own pace, untick Sync to studio clock in the Studio tab. A cable from Studio Clock CLOCK into CLOCK takes over the clock; the studio still starts and stops PLAY.',
    'Patch: tap an output (white label), then an input, or drag. Tap a cable to unplug it. The VCA and CUTOFF jacks add to their envelopes; VCO 1\'s jack also feeds VCO 2 until VCO 2 has a cable; a PWM cable replaces SUB 1\'s sweep.',
  ],
};

export default subharmonicon;
