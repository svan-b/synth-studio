import type { DeviceModule } from '../types';
import { SUB37 } from './spec';
import { SUB37_LAYOUT } from './layout';
import { SUB37_LESSONS } from './lessons';
import { Sub37Engine } from './engine';
import { UI_CONTROLS, interceptSub37 } from './combos';

const sub37: DeviceModule = {
  spec: SUB37,
  layout: SUB37_LAYOUT,
  lessons: SUB37_LESSONS,
  createEngine: () => new Sub37Engine(),
  // The 37 keys are MIDI 36-72 at KB OCTAVE 0 (Moog calls MIDI 48 middle C, "C3"); computer
  // keys A-K start on the lowest key, Z / X shift them by octaves
  keyboard: { lowNote: 36 },
  // KNOB SHIFT, the wheels, the bank / preset buttons, KB OCTAVE and the GLOBAL sequencer
  // options are hands-on state, not part of a sound: presets and Reset leave them alone
  uiControls: UI_CONTROLS,
  worklets: ['/worklets/sub37-processors.js'],
  // The studio transport is the Sub 37's MIDI clock: with ARP SYNC lit the arpeggiator,
  // sequencer, LFO SYNC and envelope SYNC follow its tempo, start and stop (p.15)
  studio: { midiSync: true },
  // REC REST / TIE, the BANK and step combinations of STEP EDIT, hold MOD DEST + move a control
  interceptChange: interceptSub37,
  // Lessons and the audio QA: the standard phrase for keyboard sounds, a held C major chord for
  // an arpeggio, the sequence played from its first note (engine.ts startAudition)
  audition: api => {
    api.event('audition');
    return () => api.event('audition:stop');
  },
  tips: [
    'Play the 37 keys with the mouse or your fingers, or with computer keys A–K (Z / X change octave). Drag the PITCH wheel (it springs back) and the MOD wheel.',
    'DUO MODE plays two keys at once, paraphonically: OSC 1 takes the lowest and OSC 2 the highest key (KB CTRL HI; LO swaps them; no LED: OSC 2 drones). Both share one filter, one VCA and one pair of envelopes.',
    'Presets live in banks 1–4: press BANK, then a PRESET button for the bank, then PRESET 1–16. The ◀ ▶ buttons step through presets; the LCD shows the bank, the name, the category and the last control you touched. Hold PRESET for the PRESET EDIT menu; CONTROLLERS opens each MOD bus menu.',
    'KNOB SHIFT turns the envelope knobs into DELAY, HOLD, VEL AMT and KB TRACK. Hold MOD DEST and move a control to make it that bus\'s destination.',
    'Arpeggiator: ON, then hold keys; PATTERN UP / DWN / ORDR / RND. With SYNC lit it follows the studio clock: it waits silently until you press ▶. PATTERN REC records a step sequence from the keys (ON adds a REST, LATCH a TIE); SEQ plays it from the key you press. Hold BANK and press LATCH for STEP EDIT.',
    'Button combinations work with two fingers on a touch screen. With a mouse, long-press the first button for half a second and let go: it stays held (it blinks) for the next button you press.',
    'Not modelled: aftertouch and CTRL4, on-screen velocity (keys play full velocity; MIDI keyboards send velocity), SAVE and COMPARE (save your work as a studio project), the MIDI and CV MAPPING menus, SEQ MOD recording.',
  ],
};

export default sub37;
