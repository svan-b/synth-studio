// Audio input - per-instance data (DeviceModule.data). Pure, no browser APIs.

export interface AudioInData {
  v: 1;
  /** You connected this input: reconnect on load when access is already granted */
  enabled: boolean;
  /** MediaDeviceInfo.deviceId (stable per site); null = the default input */
  deviceId: string | null;
  /** Device name, to find it again if its id changes */
  label: string | null;
}

export const initialInputData = (): AudioInData => ({ v: 1, enabled: false, deviceId: null, label: null });

export function asInputData(d: unknown): AudioInData {
  if (!d || typeof d !== 'object') return initialInputData();
  const s = d as Partial<AudioInData>;
  return {
    v: 1,
    enabled: !!s.enabled,
    deviceId: typeof s.deviceId === 'string' && s.deviceId ? s.deviceId : null,
    label: typeof s.label === 'string' && s.label ? s.label : null,
  };
}

export function migrateInputData(saved: unknown): AudioInData {
  const out = asInputData(saved);
  return JSON.stringify(out) === JSON.stringify(saved) ? (saved as AudioInData) : out;
}
