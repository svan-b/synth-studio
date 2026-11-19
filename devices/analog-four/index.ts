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
import { CV_BY_KEY, FX_BY_KEY, FX_TRACK, SEQ_TRACKS, SYNTH_BY_KEY, SYNTH_TRACKS, TRACK_OUTS, V } from './params';
import { ARP_KEYS, isArpKey, patternArp, setPatternArp, type ArpSettings } from './arp';
import { KIT_BY_ID, migrateKits } from './kits';

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

/** The page each block of the signal path opens (spec.ts signalFlow ids) */
const PATH_VIEWS: Record<string, number> = {
  sequencer: V.NOTE, osc1: V.OSC1, noise: V.OSC1_2, osc2: V.OSC2, ladder: V.FLTR, overdrive: V.FLTR, multimode: V.FLTR,
  amp: V.AMP, envf: V.ENV, env2: V.ENV_2, lfo1: V.LFO, lfo2: V.LFO_2, fx: V.FLTR,
};

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
    // the sequencer's own repairs, then the project's kits to the current kit format
    migrate: saved => migrateKits(base.migrate(saved)),
  },
  // Signal path: a block of the voice opens its page on a synth track; the effects are the FX track,
  // where the FLTR key opens CHORUS (AMP is DELAY and ENV is REVERB, as printed under the keys)
  signalPath: {
    open: (block, api) => {
      const view = PATH_VIEWS[block];
      if (view === undefined) return;
      const track = Math.round(Number(api.values.track) || 0);
      if (block === 'fx') {
        if (track !== FX_TRACK) api.setValue('track', FX_TRACK);
      } else if (track >= SYNTH_TRACKS) api.setValue('track', 0);
      api.setValue('page', view);
      // an open menu would cover the page (ui.tsx UIK.menu, the sequencer's UI.menu and trig editor)
      api.setUi({ a4menu: null, seqMenu: null, trigEditor: null });
    },
  },
  interceptChange: (id: string, value: ControlValue, api) => {
    // [FUNC] + TRACK LEVEL opens the SOUND BROWSER (manual p.12, p.21); while it is open TRACK LEVEL
    // scrolls its list on the hardware, so it leaves the track level alone here too
    if (/^(t[1-4]|fx)_level$/.test(id)) {
      const func = api.ui.a4func; // ui.tsx UIK.func: 'held' | 'latched'
      if (func === 'held' || func === 'latched') {
        api.setUi({ a4menu: 'sound', a4func: func === 'latched' ? null : func, a4funcUsed: true });
        return true;
      }
      if (api.ui.a4menu === 'sound') return true;
    }
    if (id === 'swing' && typeof value === 'number') {
      api.updateData(d => { const p = asProject(d, SEQ_TRACKS); return updatePatternSettings(p, p.active, { swing: value }); });
      return true;
    }
    // CONTROL ALL (manual p.18): with a [T1-4] key held, a knob moves its parameter on all four synth
    // tracks by the same amount, each from where it stands. The values from before are kept while the
    // key is down, so [NO] can take the change back (ui.tsx: UIK.trackDown, UIK.ctlAll).
    const all = /^t([1-4])_(.+)$/.exec(id);
    const tracksDown = api.ui.a4trackDown;
    if (all && typeof value === 'number' && Array.isArray(tracksDown) && tracksDown.some(t => typeof t === 'number' && t < SYNTH_TRACKS)
      && !heldSteps(api.ui).length && api.values.live_rec !== true) {
      const p = SYNTH_BY_KEY[all[2]];
      if (p && !all[2].startsWith('trig_') && !isArpKey(all[2]) && all[2] !== 'level') {
        const delta = value - (typeof api.values[id] === 'number' ? (api.values[id] as number) : p.def);
        const before = { ...((api.ui.a4ctlAll as Record<string, ControlValue> | null | undefined) ?? {}) };
        for (let t = 1; t <= SYNTH_TRACKS; t++) {
          const cid = `t${t}_${all[2]}`;
          const cur = typeof api.values[cid] === 'number' ? (api.values[cid] as number) : p.def;
          if (!(cid in before)) before[cid] = cur;
          api.setValue(cid, cid === id ? value : Math.max(p.min, Math.min(p.max, cur + delta)));
        }
        api.setUi({ a4ctlAll: before, a4msg: { text: `CONTROL ALL: ${p.name.toUpperCase()} ON T1-T4 ([NO] REVERTS)`, until: Date.now() + 1400 } });
        return true;
      }
    }
    // micro timing and conditions belong to a held trig: without one there is nothing to set
    if (/^t\d_trig_(micro|cond|envf|env2|lfo1|lfo2)$/.test(id) && !heldSteps(api.ui).length) return true;
    // LIVE RECORDING: a knob turned with no trig held records a lock on the step that plays, on the
    // active track (manual p.50); NOT, VEL and LEN go into the note trigs it passes (p.47). The kit
    // keeps its value; the panel (ui.tsx Helpers) writes the lock and the engine sounds it at once.
    if (api.values.live_rec === true && !heldSteps(api.ui).length && typeof value === 'number') {
      const key = LOCKS.lockKey(id);
      const track = LOCKS.trackOf?.(id);
      const active = Math.max(0, Math.min(SEQ_TRACKS - 1, Math.round(Number(api.values.track) || 0)));
      if (key && key !== 'prob' && key !== 'micro' && key !== 'cond' && track === active) {
        // [NO] held + a knob: erase that parameter's locks as the playhead passes them (manual p.50)
        if (api.ui.a4yesNo === 'no') {
          api.setUi({ a4erase: { kind: 'param', tracks: [track], key } });
          return true;
        }
        const live = (api.ui.a4liveKnob as Record<string, number> | undefined) ?? {};
        const n = Number((api.ui.a4liveRec as { n?: number } | undefined)?.n ?? 0) + 1;
        api.setUi({ a4liveKnob: { ...live, [id]: value }, a4liveRec: { n, id, key, value, track } });
        return true;
      }
    }
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
    // LIVE RECORDING: the knobs show the values you are recording (the kit keeps its own)
    const live = api.values.live_rec === true ? (api.ui.a4liveKnob as Record<string, number> | undefined) : undefined;
    if (live) for (const id in live) if (v[id] !== live[id]) v = { ...v, [id]: live[id] };
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
    // the four TRACK outputs: each voice on a stereo mixer channel of its own
    outputs: TRACK_OUTS,
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
    'Chords: [FUNC] + [MIX] opens POLY CONFIG. Tick voices (or TRIG 1-4) to share them between their tracks, then hold a trig and press several keys together to store a chord. ALLOCATION picks how notes find a voice; UNISON stacks them all on one note.',
    'Recording: [RECORD] + [PLAY] records live - played notes, and knob turns as locks on the steps that pass ([PLAY][PLAY] quantizes). [RECORD] + [STOP] is STEP RECORDING: each key writes the active step and moves on. [PAGE] or held trigs + [RECORD] / [STOP] / [PLAY] copy, paste and clear.',
    'Two-key moves, with two fingers on a touch screen: hold a page key (OSC 1, FILTER, AMP...) and press [YES] to roll random values for that page, [NO] to bring the page back as it was saved. Hold a track key and turn a knob for CONTROL ALL: the parameter moves on all four synth tracks, and [NO] before you let go takes it back.',
    'Simplified: one kit per project, no CV or audio-input jacks (the CV track is sequenced and shown), no sound locks and no Euclidean NOTE page. Value-to-Hz and -seconds curves are fits to the documented ranges.',
  ],
};

export default analogFour;
