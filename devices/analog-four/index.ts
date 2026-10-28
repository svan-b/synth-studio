// ============================================================================
// Elektron Analog Four MKII - device module
// ============================================================================

import type { ControlValue } from '@/types';
import type { DeviceModule } from '../types';
import {
  arrangerPatterns, asProject, displayWithLocks, getPattern, heldSteps, interceptForLocks, projectData, updatePatternSettings,
  type LockOptions,
} from '@/lib/sequencer/elektron';
import { ANALOG_FOUR } from './spec';
import { ANALOG_FOUR_LAYOUT } from './layout';
import { ANALOG_FOUR_LESSONS } from './lessons';
import { AnalogFourEngine } from './engine';
import { CV_BY_KEY, FX_BY_KEY, SEQ_TRACKS, SYNTH_BY_KEY } from './params';
import { KIT_BY_ID } from './kits';

const STEP_KEYS: Record<string, string> = { trig_note: 'note', trig_vel: 'vel', trig_len: 'len', trig_micro: 'micro', trig_cond: 'cond', trig_prob: 'prob' };

export const LOCKS: LockOptions = {
  lockKey: id => {
    let m = /^t([1-6])_(.+)$/.exec(id);
    if (m) {
      const k = m[2];
      if (STEP_KEYS[k]) return STEP_KEYS[k];
      const p = SYNTH_BY_KEY[k];
      return p && p.lock !== false && k !== 'level' ? k : null;
    }
    m = /^fx_(.+)$/.exec(id);
    if (m) { const p = FX_BY_KEY[m[1]]; return p && p.lock !== false && m[1] !== 'level' ? m[1] : null; }
    m = /^cv_(.+)$/.exec(id);
    if (m) { const p = CV_BY_KEY[m[1]]; return p && p.lock !== false ? m[1] : null; }
    return null;
  },
  trackOf: id => {
    const m = /^t([1-6])_/.exec(id);
    if (m) return Number(m[1]) - 1;
    if (id.startsWith('fx_')) return 4;
    if (id.startsWith('cv_')) return 5;
    return null;
  },
  currentTrack: values => Number(values.track) || 0,
  currentPattern: data => asProject(data, SEQ_TRACKS).active,
  trackDefaults: true,
  tracks: SEQ_TRACKS,
};

const swingOf = (data: unknown) => {
  const p = asProject(data, SEQ_TRACKS);
  return getPattern(p, p.active).swing;
};

const base = projectData({ tracks: SEQ_TRACKS, defaults: { note: 60, vel: 100 } });

const analogFour: DeviceModule = {
  spec: ANALOG_FOUR,
  layout: ANALOG_FOUR_LAYOUT,
  lessons: ANALOG_FOUR_LESSONS,
  createEngine: () => new AnalogFourEngine(),
  keyboard: { lowNote: 48 },
  transportControl: 'play',
  uiControls: ['track', 'page', 'kb_oct', 'qper_sel'],
  worklets: ['/worklets/analog-four-processors.js'],
  data: {
    // A new A4 opens on the demo song; its kit (sounds) is applied when the panel first shows
    initial: () => ({ ...KIT_BY_ID['night-drive'].project(), a4: { pendingKit: 'night-drive' } }),
    migrate: base.migrate,
  },
  interceptChange: (id: string, value: ControlValue, api) => {
    if (id === 'swing' && typeof value === 'number') {
      api.updateData(d => { const p = asProject(d, SEQ_TRACKS); return updatePatternSettings(p, p.active, { swing: value }); });
      return true;
    }
    // micro timing and conditions belong to a held trig: without one there is nothing to set
    if (/^t\d_trig_(micro|cond)$/.test(id) && !heldSteps(api.ui).length) return true;
    return interceptForLocks(id, value, api, LOCKS);
  },
  displayValues: api => {
    const v = displayWithLocks(api, LOCKS);
    const sw = swingOf(api.data);
    return v.swing === sw ? v : { ...v, swing: sw };
  },
  studio: {
    midiSync: true,
    stereo: true,
    patterns: data => arrangerPatterns(data, SEQ_TRACKS),
  },
  audition: api => {
    api.event('seq:audition');
    return () => api.event('seq:audition:stop');
  },
  tips: [
    'Pick a track with T1-T4 (FX, CV), a page with OSC 1, OSC 2, FILTER, AMP, ENV or LFO, and turn knobs A-J: the screen shows what each one does. Press a lit page key again for its second page (NOISE, OSC 1&2, ENV 2, LFO 2).',
    'Trig keys: tap to add or remove a trig. Hold a trig and turn a knob to parameter-lock that step; hold a trig and press a keyboard key to give it a note. A long hold (or double tap) opens the trig editor: note, length, micro timing, conditions, slides.',
    '[FUNC] reaches the grey legends under the keys: hold it, or tap it once for the next key (Shift on a computer keyboard works too). [BANK A-H] then a trig key picks a pattern; [PTN], [SONG], [FUNC]+[CHAIN] and [FUNC]+[PAGE] open the pattern, song, chain and scale menus.',
    'Space = PLAY/STOP; synced to the studio it is the studio transport. Keys A-K play the active track, Z/X shift the octave. [SND] or the TRACK LEVEL push opens the sound browser; [KIT] loads whole kits.',
    'Simplified: one kit per project, no POLY mode, no CV or audio-input jacks (the CV track is sequenced and shown), trig mutes and sound locks not modelled. Value-to-Hz and -seconds curves are fits to the documented ranges.',
  ],
};

export default analogFour;
