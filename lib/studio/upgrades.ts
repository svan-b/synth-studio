// ============================================================================
// Saved-settings upgrades. When a rebuilt instrument changes what a control
// *means* (its range, unit or taper), settings saved by the older version must
// keep sounding the same - the way plugins convert old presets on load.
//
// Each upgrade runs once: on the browser's saved studio when the store version
// moves past it, and on project files written before it. To add one, append an
// entry and bump both versions below.
//
// Saves only keep the controls someone touched; the rest follow the spec's
// default. So when a rebuild also changes defaults, an entry lists the old ones
// (`oldDefaults`) and they are filled in first: the conversion then sees the
// patch the user actually heard.
// ============================================================================

import type { ControlValue } from '@/types';
import type { RackSlot } from '@/devices/types';

type Values = Record<string, ControlValue>;

interface Upgrade {
  /** First store version with the new meaning */
  store: number;
  /** First project-file version with the new meaning */
  project: number;
  device: string;
  /** Defaults of the version being replaced, for controls whose default changed or that were removed */
  oldDefaults?: Values;
  apply: (values: Values) => Values;
}

const UPGRADES: Upgrade[] = [
  {
    // DFAM rebuild: TEMPO used to count steps per minute; it is now BPM with
    // each step a 16th note (the hardware's 0.7-700 Hz). A quarter of the old
    // number plays at the same speed.
    store: 5,
    project: 2,
    device: 'dfam',
    oldDefaults: { vco_decay: 300, vco2_level: 50, vcf_cutoff: 1000, vcf_decay: 400, vca_decay: 500, tempo: 120 },
    apply: v => (typeof v.tempo === 'number' ? { ...v, tempo: Math.min(10500, Math.max(10.5, v.tempo / 4)) } : v),
  },
  {
    // Xone:96 rebuild to the User Guide: MASTER and BOOTH have unity at 8 on a new
    // law (it was 7.5), the crossfader's second curve is TRANSITION (DIPPED is gone),
    // SEND 1 PRE became a switch per channel, and the sends gained +6 dB of travel.
    store: 6,
    project: 3,
    device: 'xone96',
    oldDefaults: {
      master: 7.5, booth: 6, send1_pre: 0,
      cha_fader: 7, chb_fader: 7, cha_midf: 700, chb_midf: 700,
      ch2_src: 1, ch3_src: 4, ch4_src: 5, ch2_fader: 0, ch3_fader: 0, ch4_fader: 0,
    },
    apply: v => {
      const out: Values = { ...v };
      const law = (x: ControlValue) =>
        typeof x === 'number' ? Math.min(10, Math.max(0, 8 * Math.pow(Math.max(0, x) / 7.5, 0.644))) : x;
      if (out.master !== undefined) out.master = law(out.master);
      if (out.booth !== undefined) out.booth = law(out.booth);
      if (out.xf_curve === 1) out.xf_curve = 0;
      if (out.send1_pre !== undefined) {
        for (const ch of ['ch1', 'ch2', 'ch3', 'ch4', 'cha', 'chb']) {
          if (out[`${ch}_pre`] === undefined) out[`${ch}_pre`] = out.send1_pre;
        }
        delete out.send1_pre;
      }
      for (const k of Object.keys(out)) {
        const x = out[k];
        if (/_snd[12]$/.test(k) && typeof x === 'number') out[k] = x * 0.707;
      }
      return out;
    },
  },
];

export const STORE_VERSION = 6;
export const PROJECT_VERSION = 3;

/**
 * Upgrade the control values of every instance saved before version `from`
 * ('store' for browser saves, 'project' for project files). `rack` maps
 * instance ids to devices; ids not in it are "<device>" or "<device>#n".
 */
export function upgradeDevices<S extends { controlValues?: Values }>(
  devices: Record<string, S>,
  rack: RackSlot[],
  key: 'store' | 'project',
  from: number,
): Record<string, S> {
  const pending = UPGRADES.filter(u => u[key] > from);
  if (!pending.length) return devices;
  const out: Record<string, S> = {};
  Object.entries(devices).forEach(([instance, state]) => {
    const device = rack.find(r => r.id === instance)?.device ?? instance.split('#')[0];
    let values = state.controlValues;
    pending.forEach(u => {
      if (values && u.device === device) values = u.apply(u.oldDefaults ? { ...u.oldDefaults, ...values } : values);
    });
    out[instance] = values === state.controlValues ? state : { ...state, controlValues: values };
  });
  return out;
}
