// ============================================================================
// Elektron Analog Four MKII - device module
// ============================================================================

import type { ControlValue } from '@/types';
import type { DeviceModule } from '../types';
import {
  LOCK_LIMIT_A4, arrangerPatterns, asProject, displayWithLocks, getPattern, heldSteps, interceptForLocks, projectData, updatePatternSettings,
  type LockOptions,
} from '@/lib/sequencer/elektron';
import { ANALOG_FOUR } from './spec';
import { ANALOG_FOUR_LAYOUT } from './layout';
import { ANALOG_FOUR_LESSONS } from './lessons';
import { AnalogFourEngine } from './engine';
import { CV_BY_KEY, FX_BY_KEY, SEQ_TRACKS, SYNTH_BY_KEY, SYNTH_TRACKS } from './params';
import { ARP_KEYS, isArpKey, patternArp, setPatternArp, type ArpSettings } from './arp';
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
  // a pattern holds at most 128 different locked parameters; one more is refused (manual p.50)
  lockLimit: LOCK_LIMIT_A4,
};

const base = projectData({ tracks: SEQ_TRACKS, defaults: { note: 60, vel: 100 } });

const analogFour: DeviceModule = {
  spec: ANALOG_FOUR,
  layout: ANALOG_FOUR_LAYOUT,
  lessons: ANALOG_FOUR_LESSONS,
  createEngine: () => new AnalogFourEngine(),
  keyboard: { lowNote: 72 },
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
    if (/^t\d_trig_(micro|cond|envf|env2|lfo1|lfo2)$/.test(id) && !heldSteps(api.ui).length) return true;
    // the ARP page belongs to the pattern (manual p.43); with a trig held only NO2-NO4 lock (p.44)
    const arp = /^t([1-4])_(arp_\w+)$/.exec(id);
    if (arp && isArpKey(arp[2]) && typeof value === 'number') {
      const track = Number(arp[1]) - 1;
      const key = arp[2];
      if (heldSteps(api.ui).length) return /^arp_n[234]$/.test(key) ? interceptForLocks(id, value, api, LOCKS) : true;
      api.updateData(d => {
        const p = asProject(d, SEQ_TRACKS);
        const current: ArpSettings = {};
        ARP_KEYS.forEach(k => { const v = api.values[`t${track + 1}_${k}`]; if (typeof v === 'number') current[k] = v; });
        return setPatternArp(p, p.active, track, key, value, current);
      });
      return true;
    }
    return interceptForLocks(id, value, api, LOCKS);
  },
  displayValues: api => {
    let v = displayWithLocks(api, LOCKS);
    const p = asProject(api.data, SEQ_TRACKS);
    const sw = getPattern(p, p.active).swing;
    if (v.swing !== sw) v = { ...v, swing: sw };
    // the ARP page shows the selected pattern's arpeggiator (or the track's values when it has none)
    for (let t = 0; t < SYNTH_TRACKS; t++) {
      const a = patternArp(p, p.active, t);
      if (!a) continue;
      for (const k of ARP_KEYS) {
        const id = `t${t + 1}_${k}`;
        if (a[k] !== undefined && v[id] !== a[k] && !(heldSteps(api.ui).length && /^arp_n[234]$/.test(k))) v = { ...v, [id]: a[k] as number };
      }
    }
    return v;
  },
  studio: {
    midiSync: true,
    stereo: true,
    patterns: data => arrangerPatterns(data, SEQ_TRACKS),
  },
  // A preview plays the selected pattern (a riff on the keyboard's track when it is empty) and ends
  // like [STOP][STOP]: the sound is cut and the send effects fade (engine.ts startAudition)
  audition: api => {
    api.event('a4:audition');
    return () => api.event('a4:audition:stop');
  },
  tips: [
    'Pick a track with T1-T4 (FX, CV), a page with OSC 1, OSC 2, FILTER, AMP, ENV or LFO, and turn knobs A-J: the screen shows what each one does. Press a lit page key again for its second page (NOISE, OSC 1&2, ENV 2, LFO 2).',
    'Trig keys: tap to add or remove a trig. Hold a trig and turn a knob to parameter-lock that step; hold a trig and press a keyboard key to give it a note. A long hold (or double tap) opens the trig editor: note, length, micro timing, conditions, slides.',
    '[FUNC] reaches the grey legends under the keys: hold it, or tap it once for the next key (Shift on a computer keyboard works too). [FUNC] + a track key mutes that track. [BANK A-H] then a trig key picks a pattern; [PTN], [SONG], [FUNC]+[CHAIN] and [FUNC]+[PAGE] open the pattern, song, chain and scale menus.',
    'Space = PLAY/STOP; synced to the studio it is the studio transport. On its own clock [PLAY] while playing pauses and [PLAY] resumes; [STOP] cuts the sound while the delay rings on, and [STOP][STOP] fades the send effects. Keys A-K play the active track, Z/X shift the octave. [SND] or the TRACK LEVEL push opens the sound browser; [KIT] loads whole kits.',
    'Simplified: one kit per project, no POLY mode (so no PLY arpeggio), no CV or audio-input jacks (the CV track is sequenced and shown), no sound locks and no Euclidean NOTE page. Value-to-Hz and -seconds curves are fits to the documented ranges.',
  ],
};

export default analogFour;
