import type { DeviceModule } from '../types';
import type { Values } from '@/types/panel';
import {
  arrangerPatterns, asProject, displayWithLocks, interceptForLocks, isProject, migrateProject,
} from '@/lib/sequencer/elektron';
import { ANALOG_RYTM, KIT_CONTROL_IDS } from './spec';
import { ANALOG_RYTM_LAYOUT } from './layout';
import { ANALOG_RYTM_LESSONS } from './lessons';
import { AnalogRytmEngine } from './engine';
import { LOCKS } from './locks';
import { SEQ_TRACKS } from './model';
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
  return {
    ...(hasPatterns ? p : base),
    kits: s.kits && typeof s.kits === 'object' ? s.kits : base.kits,
    kit: typeof s.kit === 'string' ? s.kit : '01',
    rv: PROJECT_RV,
  };
}

/** Scene / performance edit: while a macro editor is open, encoder turns are stored in the macro */
function macroTarget(ui: Record<string, unknown>): { kind: 'scene' | 'perf'; index: number } | null {
  if (typeof ui.sceneEdit === 'number') return { kind: 'scene', index: ui.sceneEdit };
  if (typeof ui.perfEdit === 'number') return { kind: 'perf', index: ui.perfEdit };
  return null;
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
    return interceptForLocks(id, value, api, LOCKS);
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
    return displayWithLocks(api, LOCKS);
  },
  studio: { midiSync: true, stereo: true, patterns: data => arrangerPatterns(data, SEQ_TRACKS) },
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
