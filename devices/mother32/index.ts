import type { DeviceModule } from '../types';
import { MOTHER32 } from './spec';
import { MOTHER32_LAYOUT } from './layout';
import { MOTHER32_LESSONS } from './lessons';
import { Mother32Engine } from './engine';
import { MOTHER32_PRESETS } from './presets';
import { KB_LOW, LANES, LOCATIONS, type Mother32Data, asData, patternOf, setLaneChar, stepAt, timingOf } from './sequence';
import { editTarget, type M32Ui } from './panelUi';

/** Factory pattern memory: bank 1 holds eight patterns from the presets, the rest is empty */
const FACTORY = ['init', 'bass_sequencer', 'bass_acid', 'bass_ratchet_acid', 'seq_swing_house', 'seq_chugging', 'lead_pwm', 'drum_kick_snare'];

export function initialData(): Mother32Data {
  const bank: Mother32Data['bank'] = new Array(LOCATIONS).fill(null);
  FACTORY.forEach((key, i) => {
    const p = MOTHER32_PRESETS[key];
    if (p) bank[i] = { ...patternOf(p.settings), ...timingOf(p.settings) };
  });
  return { v: 1, loc: 0, bank };
}

const STEP_KNOBS: Record<string, 'seq_gate' | 'seq_glide' | 'seq_ratchet'> = {
  step_gate: 'seq_gate', step_glide: 'seq_glide', step_ratchet: 'seq_ratchet',
};
const DIV_KNOBS: Record<string, number> = { step_div: 0, div_dotted: 1, div_triplet: 2 };
const SWING_KNOBS: Record<string, number> = { swing_div: 0, swing_dotted: 1, swing_triplet: 2 };
const clamp7 = (v: unknown) => Math.max(0, Math.min(7, Math.round(typeof v === 'number' ? v : 5)));

const mother32: DeviceModule = {
  spec: MOTHER32,
  layout: MOTHER32_LAYOUT,
  lessons: MOTHER32_LESSONS,
  createEngine: () => new Mother32Engine(),
  keyboard: { lowNote: KB_LOW },
  transportControl: 'run_stop',
  worklets: ['/worklets/mother32-processors.js'],
  // Performance and memory state rather than sound: Reset leaves the pattern and its timing, the
  // Setup pages (which the hardware keeps through power-off) and the keyboard octave alone
  uiControls: [
    'run_stop', 'shift', 'rec', 'seq_mode', 'kb_octave', 'assign_source', 'tempo_mode', 'clock_in_ppqn', 'save_mode',
    'accent_cv_only', 'tempo_in_range', 'delay_pattern', 'load_timing', 'seq_direction',
    'step_div', 'div_type', 'div_dotted', 'div_triplet', 'swing', 'swing_div', 'swing_type', 'swing_dotted', 'swing_triplet',
    'live_ratchet', 'seq_length', 'step_gate', 'step_glide', 'step_ratchet', ...LANES,
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
   * Clock division (TEMPO) and swing interval (GLIDE): alone / with KB + STEP held a straight value,
   * with KB held a dotted one, with STEP held a triplet; setting the division also resets the swing
   * interval to it (manual p.21, p.54).
   */
  interceptChange: (id, value, api) => {
    const u = api.ui as M32Ui;
    const modifier = !!(u.held && (u.held.kb || u.held.step));
    if (id in DIV_KNOBS) {
      const type = DIV_KNOBS[id];
      const k = clamp7(value);
      api.setUi({ touch: { k: 'div', at: Date.now() }, ...(modifier ? { heldUsed: true } : {}) });
      if (Number(api.values.div_type ?? 0) !== type) api.setValue('div_type', type);
      if (id !== 'step_div') api.setValue('step_div', k);
      api.setValue('swing_type', type);
      api.setValue('swing_div', k);
      return id !== 'step_div';
    }
    if (id in SWING_KNOBS) {
      const type = SWING_KNOBS[id];
      api.setUi({ touch: { k: 'swing', at: Date.now() }, ...(modifier ? { heldUsed: true } : {}) });
      if (Number(api.values.swing_type ?? 0) !== type) api.setValue('swing_type', type);
      if (id === 'swing_div') return false;
      api.setValue('swing_div', clamp7(value));
      return true;
    }
    const lane = STEP_KNOBS[id];
    if (!lane) return false;
    const t = editTarget(api.values, u);
    if (t < 0) return true;
    const v = typeof value === 'number' ? value : 0;
    const ch = lane === 'seq_glide' ? (v > 0.5 ? '1' : '0')
      : lane === 'seq_gate' ? String(Math.max(1, Math.min(8, Math.round(v))))
      : String(Math.max(1, Math.min(4, Math.round(v))));
    if (lane !== 'seq_glide') api.setUi({ touch: { k: lane === 'seq_gate' ? 'gate' : 'ratchet', at: Date.now() } });
    const next = setLaneChar(api.values, lane, t, ch);
    if (next !== api.values[lane]) api.setValue(lane, next);
    return true;
  },
  /** The step knobs show the edited step's values; the dotted / triplet bindings the division */
  displayValues: api => {
    const div = api.values.step_div ?? 5, sw = api.values.swing_div ?? 5;
    const base = { ...api.values, div_dotted: div, div_triplet: div, swing_dotted: sw, swing_triplet: sw };
    const t = editTarget(api.values, api.ui as M32Ui);
    if (t < 0) return base;
    const s = stepAt(api.values, t);
    return { ...base, step_gate: s.gate, step_glide: s.glide ? 100 : 0, step_ratchet: s.ratchet };
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
    'Play the 13 keys or A-K on your computer keyboard; the KB and STEP arrows change the octave (the red OCTAVE / LOCATION LED; 4 at power-up). RUN / STOP (or Space) pauses and resumes the 32-step sequencer, RESET returns to step 1; while it runs, the keys transpose it.',
    'SHIFT latches: tap it, then the second button (SHIFT + RUN / STOP = REC). On an iPad you can also hold it - and hold KB and / or STEP while turning TEMPO (clock division) or GLIDE (swing interval). Second functions are printed in brackets.',
    'Record (KB mode): SHIFT + RUN / STOP, then play notes - each key or REST writes the next step and the pattern grows; ACCENT, TEMPO (gate length) and GLIDE (glide; SHIFT + GLIDE ratchet) edit the step just written. SHIFT + RESET + PATTERN first gives a clean one-step pattern.',
    'STEP mode (SHIFT + STEP): the step buttons switch steps on and off; the 1-8 ... 25-32 buttons pick the page; SET END + a step sets the length; SHIFT + a step edits it (keys set its note); the arrows rotate the pattern.',
    'Patterns: PATTERN, then a step button (or the arrows) picks 1-8 of this bank; SHIFT + PATTERN picks the bank. During playback the new pattern starts when the current one ends. Save: hold SHIFT on RUN / STOP for a second, pick the slot, then SHIFT + RUN / STOP.',
    'Patch: tap an output (white box), then an input - or drag. Normals: NOISE into EXT. AUDIO, the EG into VCO MOD, 0 V into MIX 1, +5 V into MIX 2. In the studio, ASSIGN (CLOCK) into the DFAM\'s ADV / CLOCK keeps them in step.',
  ],
};

export default mother32;
