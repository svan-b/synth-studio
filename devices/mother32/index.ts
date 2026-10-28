import type { DeviceModule } from '../types';
import { MOTHER32 } from './spec';
import { MOTHER32_LAYOUT } from './layout';
import { MOTHER32_LESSONS } from './lessons';
import { Mother32Engine } from './engine';
import { MOTHER32_PRESETS } from './presets';
import { KB_LOW, LANES, LOCATIONS, type Mother32Data, asData, patternOf, setLaneChar, stepAt } from './sequence';
import { editTarget, type M32Ui } from './panelUi';

/** Factory pattern memory: bank 1 holds eight patterns from the presets, the rest is empty */
const FACTORY = ['init', 'bass_sequencer', 'bass_acid', 'bass_ratchet_acid', 'seq_swing_house', 'seq_chugging', 'lead_pwm', 'drum_kick_snare'];

export function initialData(): Mother32Data {
  const bank: Mother32Data['bank'] = new Array(LOCATIONS).fill(null);
  FACTORY.forEach((key, i) => {
    const p = MOTHER32_PRESETS[key];
    if (p) bank[i] = patternOf(p.settings);
  });
  return { v: 1, loc: 0, bank };
}

const STEP_KNOBS: Record<string, 'seq_gate' | 'seq_glide' | 'seq_ratchet'> = {
  step_gate: 'seq_gate', step_glide: 'seq_glide', step_ratchet: 'seq_ratchet',
};

const mother32: DeviceModule = {
  spec: MOTHER32,
  layout: MOTHER32_LAYOUT,
  lessons: MOTHER32_LESSONS,
  createEngine: () => new Mother32Engine(),
  keyboard: { lowNote: KB_LOW },
  transportControl: 'run_stop',
  worklets: ['/worklets/mother32-processors.js'],
  // Performance and memory state rather than sound: Reset leaves the pattern, the Setup pages
  // (which the hardware keeps through power-off) and the keyboard octave alone
  uiControls: [
    'run_stop', 'shift', 'rec', 'seq_mode', 'kb_octave', 'assign_source', 'tempo_mode', 'step_div',
    'seq_length', 'step_gate', 'step_glide', 'step_ratchet', ...LANES,
  ],
  // MIDI clock and start / stop: the sequencer follows the studio transport
  studio: { midiSync: true },
  data: {
    initial: initialData,
    migrate: saved => asData(saved) ?? initialData(),
  },
  /**
   * While a step is edited, TEMPO is that step's GATE LENGTH and GLIDE its glide on/off (with SHIFT,
   * its ratchet). Those knob moves write the pattern lanes instead of a control.
   */
  interceptChange: (id, value, api) => {
    const lane = STEP_KNOBS[id];
    if (!lane) return false;
    const t = editTarget(api.values, api.ui as M32Ui);
    if (t < 0) return true;
    const v = typeof value === 'number' ? value : 0;
    const ch = lane === 'seq_glide' ? (v > 0.5 ? '1' : '0')
      : lane === 'seq_gate' ? String(Math.max(1, Math.min(8, Math.round(v))))
      : String(Math.max(1, Math.min(4, Math.round(v))));
    const next = setLaneChar(api.values, lane, t, ch);
    if (next !== api.values[lane]) api.setValue(lane, next);
    return true;
  },
  /** The step knobs show the edited step's values */
  displayValues: api => {
    const t = editTarget(api.values, api.ui as M32Ui);
    if (t < 0) return api.values;
    const s = stepAt(api.values, t);
    return { ...api.values, step_gate: s.gate, step_glide: s.glide ? 100 : 0, step_ratchet: s.ratchet };
  },
  /**
   * Lessons' "listen to the target": the pattern from step 1 at the current TEMPO. If the
   * sequencer is already running it simply keeps playing with the target settings.
   */
  audition: api => {
    api.event('audition');
    return () => api.event('audition:stop');
  },
  tips: [
    'Play the 13 pads or A-K on your computer keyboard; the KB and STEP arrows change the octave (the OCTAVE / LOCATION LEDs show it). RUN / STOP (or Space) plays the 32-step sequencer; while it runs, the keys transpose it.',
    'SHIFT latches: tap it, then the second button (SHIFT + RUN / STOP = REC). On an iPad you can also hold it. Second functions are printed in brackets.',
    'Record: SHIFT + RUN / STOP, then play notes; HOLD / REST adds a rest, RESET / ACCENT accents the last note, TEMPO sets its gate length and GLIDE its glide (SHIFT + GLIDE: ratchet). RUN / STOP finishes.',
    'STEP mode (SHIFT + STEP): the pads switch steps on and off; the 1-8 ... 25-32 keys pick the page; SET END + a pad sets the length; SHIFT + a pad edits a step (keys set its note).',
    'Patterns: PATTERN, then a step pad loads 1-8 of this bank (SHIFT + PATTERN: bank). Save: hold SHIFT on RUN / STOP for a second, pick the slot with a pad, then SHIFT + RUN / STOP.',
    'Patch: tap an output (white box), then an input - or drag. Normals: NOISE into EXT. AUDIO, the EG into VCO MOD, 0 V into MIX 1, +5 V into MIX 2. In the studio, ASSIGN (CLOCK) into the DFAM\'s ADV / CLOCK keeps them in step.',
  ],
};

export default mother32;
