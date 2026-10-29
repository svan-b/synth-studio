import type { DeviceModule, DeviceUiApi } from '../types';
import type { Values } from '@/types/panel';
import {
  arrangerPatterns, asProject, displayWithLocks, getPattern, heldSteps, heldTarget, interceptForLocks, isProject, isStepField, migrateProject,
  setTrackScale, trackLength,
} from '@/lib/sequencer/elektron';
import { cleanPool, setSoundLock, soundChoices } from './pool';
import { euclidSettings, euclidView, euclidWriteBack, setEuclid } from './euclid';
import { ANALOG_RYTM, KIT_CONTROL_IDS } from './spec';
import { ANALOG_RYTM_LAYOUT } from './layout';
import { ANALOG_RYTM_LESSONS } from './lessons';
import { AnalogRytmEngine } from './engine';
import { LOCKS } from './locks';
import { EUC_IDS, SEQ_TRACKS, parseId } from './model';
import { PROJECT_RV, defaultProject, type RytmProject } from './presets';
import { editMacro } from './ui';

const KIT_IDS = new Set(KIT_CONTROL_IDS);

/**
 * Saved data from any version: a current Rytm project is returned unchanged;
 * anything else keeps its patterns, chain and song and gets the factory kits.
 */
function migrate(saved: unknown): unknown {
  const s = saved as Partial<RytmProject> | null;
  if (isProject(saved) && saved.tracks === SEQ_TRACKS && s?.rv === PROJECT_RV && s.kits) return saved;
  const base = defaultProject();
  if (!s || typeof s !== 'object') return base;
  const p = migrateProject({ ...(s as object), tracks: SEQ_TRACKS }, SEQ_TRACKS, { note: 60, vel: 100 }) as RytmProject;
  const hasPatterns = Object.keys(p.patterns).length > 0;
  const pool = cleanPool(s.pool);
  return {
    ...(hasPatterns ? p : base),
    kits: s.kits && typeof s.kits === 'object' ? s.kits : base.kits,
    kit: typeof s.kit === 'string' ? s.kit : '01',
    ...(pool ? { pool } : {}),
    rv: PROJECT_RV,
  };
}

/** Scene / performance edit: while a macro editor is open, encoder turns are stored in the macro */
function macroTarget(ui: Record<string, unknown>): { kind: 'scene' | 'perf'; index: number } | null {
  if (typeof ui.sceneEdit === 'number') return { kind: 'scene', index: ui.sceneEdit };
  if (typeof ui.perfEdit === 'number') return { kind: 'perf', index: ui.perfEdit };
  return null;
}

/**
 * SOUND LOCKS (manual p.48): with a note trig held, TRACK LEVEL scrolls the Sound pool
 * list (ui.tsx SoundLockPicker shows it) and the Sound it reaches is locked on the held
 * trigs; TRACK SOUND (the first entry) removes the lock. Sounds the track cannot run are
 * skipped. The track level itself doesn't change while a trig is held.
 */
function soundLockTurn(id: string, value: unknown, api: DeviceUiApi): boolean {
  const held = heldSteps(api.ui);
  if (!held.length || typeof value !== 'number') return false;
  const pi = parseId(id);
  if (!pi || pi.key !== 'trk_lev' || pi.track >= 12) return false;
  const { track, pattern } = heldTarget(api, LOCKS);
  if (track !== pi.track) return false;
  // the trig keys' view: a Euclidean track's generated trigs can be sound locked too
  const vapi = euclidApi(api);
  const p = asProject(vapi.data, SEQ_TRACKS) as RytmProject;
  const step = getPattern(p, pattern).tracks[track]?.steps[held[0]];
  if (!step || step.trigless) {
    api.setUi({ message: { text: 'SOUND LOCKS GO ON NOTE TRIGS', at: Date.now() } });
    return true;
  }
  const choices = soundChoices(p.pool, track).filter(c => c.fits);
  const cur = Math.round(step.locks?.sound ?? 0);
  const at = Math.max(0, choices.findIndex(c => c.slot === cur));
  const next = Math.max(0, Math.min(choices.length - 1, at + Math.sign(value - Number(api.values[id] ?? 0))));
  api.setUi({ soundLock: { track, pattern }, heldEdited: true });
  const slot = choices[next].slot;
  if (slot !== cur) vapi.updateData(d => { const q = asProject(d, SEQ_TRACKS) as RytmProject; return setSoundLock(q, pattern, track, held, slot, q.pool); });
  return true;
}

/**
 * The data as the trig keys show it: Euclidean tracks hold their generated trigs, and an
 * edit made on that view is written back (euclid.ts). The same api when nothing is Euclidean.
 */
function euclidApi(api: DeviceUiApi): DeviceUiApi {
  const real = asProject(api.data, SEQ_TRACKS);
  const view = euclidView(real);
  if (view === real) return api;
  return {
    ...api,
    data: view,
    updateData: fn => api.updateData(d => {
      const r = asProject(d, SEQ_TRACKS);
      return euclidWriteBack(r, asProject(fn(euclidView(r)), SEQ_TRACKS));
    }),
  };
}

/**
 * TRIG page 2, the Euclidean sequencer (manual p.44): the encoders set the active track's
 * pulse generators, rotations and operator in the pattern; EUC turned off with [FUNC] held
 * keeps the generated trigs. LEN sets the track length in the ADVANCED (per track) scale
 * mode only.
 */
function euclidTurn(id: string, value: unknown, api: DeviceUiApi): boolean {
  if (!EUC_IDS.includes(id)) return false;
  const v = Math.round(Number(value));
  const track = Math.round(Number(api.values.track));
  if (!Number.isFinite(v) || track < 0 || track >= 12) return true;
  const p = asProject(api.data, SEQ_TRACKS);
  const pattern = p.active;
  const pat = getPattern(p, pattern);
  const len = trackLength(pat, track);
  const say = (text: string) => api.setUi({ message: { text, at: Date.now() } });
  const key = id.slice(4);
  if (key === 'len') {
    if (pat.scaleMode !== 'track') { say('LEN: SET THE SCALE TO PER TRACK ([FUNC] + [PAGE]) FIRST'); return true; }
    api.updateData(d => setTrackScale(asProject(d, SEQ_TRACKS), pattern, track, { length: Math.max(1, Math.min(64, v)) }, { copyPages: true }));
    return true;
  }
  if (key === 'on') {
    const on = v > 0;
    const convert = !on && (!!api.ui.func || !!api.ui.funcLatch);
    if (convert && api.ui.funcLatch) api.setUi({ funcLatch: false, funcUsed: true });
    api.updateData(d => setEuclid(asProject(d, SEQ_TRACKS), pattern, track, { on }, { convert }));
    say(on ? 'EUCLIDEAN MODE ON: THE TRACK\'S OWN TRIGS ARE HIDDEN' : convert ? 'EUCLIDEAN MODE OFF: THE GENERATED TRIGS STAY' : 'EUCLIDEAN MODE OFF');
    return true;
  }
  const lim = key === 'op' ? [0, 3] : key === 'pl1' || key === 'pl2' ? [0, len] : [-(len - 1), len - 1];
  const x = Math.max(lim[0], Math.min(lim[1], v));
  api.updateData(d => setEuclid(asProject(d, SEQ_TRACKS), pattern, track, { [key]: x }));
  return true;
}

/** The Euclidean settings of the active track on the encoders of TRIG page 2 */
function euclidDisplay(api: Pick<DeviceUiApi, 'values' | 'data' | 'ui'>, values: Values): Values {
  if (api.ui.trigPage2 !== true) return values;
  const track = Math.round(Number(api.values.track));
  if (track < 0 || track >= 12) return values;
  const p = asProject(api.data, SEQ_TRACKS);
  const e = euclidSettings(p, p.active, track);
  const out: Values = { ...values };
  out.euc_pl1 = e.pl1; out.euc_pl2 = e.pl2; out.euc_ro1 = e.ro1; out.euc_ro2 = e.ro2; out.euc_tro = e.tro; out.euc_op = e.op;
  out.euc_on = e.on ? 1 : 0;
  out.euc_len = trackLength(getPattern(p, p.active), track);
  return out;
}

let liveTurns = 0;

/**
 * LIVE RECORDING (manual pp.40, 47): a turn of a PARAMETER page encoder of the active
 * track, with no trig held, is recorded as a parameter lock where the sequencer is
 * (ui.liveTurn -> ui.tsx LiveRec -> engine.liveTurn). The turn is also an ordinary edit
 * (returns false), so the sound follows the knob. With [NO] held the turn erases that
 * parameter's locks instead, on every step reached until [NO] is let go (returns true).
 * The TRIG page, the track level and the trig settings are not PARAMETER pages.
 */
function liveRecTurn(id: string, value: unknown, api: DeviceUiApi): boolean {
  if (Math.round(Number(api.values.rec)) !== 2 || api.ui.livePlaying !== true || typeof value !== 'number') return false;
  if (heldSteps(api.ui).length) return false;
  const pi = parseId(id);
  const key = LOCKS.lockKey(id);
  if (!pi || !key || isStepField(key) || key === 'prob' || key.startsWith('trig_')) return false;
  if (pi.track !== Math.round(Number(api.values.track))) return false;
  if (api.ui.noHeld) {
    api.setUi({ liveEraseKey: { track: pi.track, key }, yesNoUsed: true });
    return true;
  }
  api.setUi({ liveTurn: { n: ++liveTurns, track: pi.track, key, value, at: performance.now() } });
  return false;
}

const analogRytm: DeviceModule = {
  spec: ANALOG_RYTM,
  layout: ANALOG_RYTM_LAYOUT,
  lessons: ANALOG_RYTM_LESSONS,
  createEngine: () => new AnalogRytmEngine(),
  worklets: ['/worklets/analog-rytm-processors.js'],
  transportControl: 'play',
  uiControls: ['track', 'page', 'pad_mode', 'rec', 'fix', 'auto_trk'],
  data: { initial: defaultProject, migrate },
  interceptChange: (id, value, api) => {
    const m = macroTarget(api.ui);
    if (m && KIT_IDS.has(id) && typeof value === 'number' && !id.endsWith('_machine')) {
      // scenes store fixed values; performance macros store the depth from the kit's value (manual pp.28-30)
      const base = typeof api.values[id] === 'number' ? (api.values[id] as number) : 0;
      api.updateData(d => {
        const p = asProject(d, SEQ_TRACKS) as RytmProject;
        return editMacro(p, p.kit ?? '01', m.kind, m.index, macro => ({ ...macro, [id]: m.kind === 'perf' ? Math.round(value - base) : value }));
      });
      return true;
    }
    if (euclidTurn(id, value, api)) return true;
    if (soundLockTurn(id, value, api)) return true;
    if (liveRecTurn(id, value, api)) return true;
    return interceptForLocks(id, value, euclidApi(api), LOCKS);
  },
  displayValues: api => {
    const m = macroTarget(api.ui);
    if (m) {
      const p = asProject(api.data, SEQ_TRACKS) as RytmProject;
      const k = p.kits?.[p.kit ?? '01'];
      const macro = (m.kind === 'scene' ? k?.scenes : k?.perfs)?.[m.index];
      if (macro && Object.keys(macro).length) {
        const out: Values = { ...api.values };
        for (const id in macro) out[id] = m.kind === 'perf' ? (typeof api.values[id] === 'number' ? (api.values[id] as number) : 0) + macro[id] : macro[id];
        return out;
      }
      return api.values;
    }
    return euclidDisplay(api, displayWithLocks({ values: api.values, ui: api.ui, data: euclidView(asProject(api.data, SEQ_TRACKS)) }, LOCKS));
  },
  studio: { midiSync: true, stereo: true, patterns: data => arrangerPatterns(euclidView(asProject(data, SEQ_TRACKS)), SEQ_TRACKS) },
  audition: api => {
    api.event('rytm:audition');
    return () => api.event('rytm:audition:stop');
  },
  tips: [
    'Tap a pad to play it (tap higher on the pad for a harder hit, or switch [FIX] on for a fixed velocity). The pad also selects its track. [PLAY] (or Space) runs the demo song; [SONG] switches between song and pattern mode.',
    'The PARAMETER keys (TRIG, SRC, SMPL, FLTR, AMP, LFO) pick the page; encoders A–H edit what the screen shows for the active track. [FX] selects the FX track: SRC = delay, SMPL = reverb, FLTR = distortion, AMP = compressor.',
    'Trig keys: tap to place a trig. Hold a trig and turn an encoder for a parameter lock (mouse: long-press a trig to open the trig editor, then turn encoders). [PAGE] steps through the 4 pages of a 64-step pattern; [FUNC] + [PAGE] opens SCALE.',
    'BANK A–H open the pattern grid. Each pattern can link a kit ([FUNC] + [PLAY] = KIT): bank A holds the demo song, bank B one demo pattern for every factory kit in the preset menu.',
    'Pad modes: [MUTE] mutes tracks, [CHRO] plays the active track chromatically, [SCNE] switches scenes (long-press a pad to edit one), [PERF] morphs macros with how high you press. Hold [RTRG] and play a pad for a roll; hold [REC] and press [PLAY] to record the pads live.',
    'FUNC: hold it with one finger and press a key with another, or tap it once (it lights) and then press the key. The secondary functions are printed under the keys.',
    'Twelve tracks share eight voices: RS/CP, MT/HT, CH/OH and CY/CB (marked ||) cut each other off, just like the hardware. Sampling, the GLOBAL menu and MIDI are not modelled; the sample layer plays synthesized one-shots.',
  ],
};

export default analogRytm;
