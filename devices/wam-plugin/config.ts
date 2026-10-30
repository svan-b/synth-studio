// Web Audio plugin - per-instance data (DeviceModule.data). Pure, no browser APIs.

export interface WamData {
  v: 1;
  /** The plugin's ES module URL (…/index.js); null = no plugin */
  url: string | null;
  /** Name shown before the plugin has loaded */
  name: string | null;
  /** Plugin state from audioNode.getState(), saved when its window closes (JSON only) */
  state?: unknown;
}

export const initialWamData = (): WamData => ({ v: 1, url: null, name: null });

export function asWamData(d: unknown): WamData {
  if (!d || typeof d !== 'object') return initialWamData();
  const s = d as Partial<WamData>;
  const out: WamData = {
    v: 1,
    url: typeof s.url === 'string' && s.url ? s.url : null,
    name: typeof s.name === 'string' && s.name ? s.name.slice(0, 60) : null,
  };
  if (s.state !== undefined) out.state = s.state;
  return out;
}

export function migrateWamData(saved: unknown): WamData {
  const out = asWamData(saved);
  return JSON.stringify(out) === JSON.stringify(saved) ? (saved as WamData) : out;
}

/** Plugin state worth saving in a project: plain JSON and not huge */
export function jsonState(state: unknown, maxChars = 200_000): unknown | undefined {
  if (state === undefined || state === null) return undefined;
  try {
    const s = JSON.stringify(state);
    if (!s || s.length > maxChars) return undefined;
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}
