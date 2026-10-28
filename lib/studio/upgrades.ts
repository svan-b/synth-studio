// ============================================================================
// Saved-settings upgrades. When a rebuilt instrument changes what a control
// *means* (its range, unit or taper), settings saved by the older version must
// keep sounding the same - the way plugins convert old presets on load.
//
// Each upgrade runs once: on the browser's saved studio when the store version
// moves past it, and on project files written before it. To add one, append an
// entry and bump both versions below.
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
    apply: v => (typeof v.tempo === 'number' ? { ...v, tempo: Math.min(10500, Math.max(10.5, v.tempo / 4)) } : v),
  },
];

export const STORE_VERSION = 5;
export const PROJECT_VERSION = 2;

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
    pending.forEach(u => { if (values && u.device === device) values = u.apply(values); });
    out[instance] = values === state.controlValues ? state : { ...state, controlValues: values };
  });
  return out;
}
