/**
 * The iPad app.
 *
 * Middle C can run inside a native shell that gives it what a web page on an
 * iPad cannot have: MIDI straight from the piano, and a durable file for
 * progress. The shell announces itself as `window.__middleC` before any of
 * the page's own code runs, and adds `navigator.requestMIDIAccess`, so the
 * rest of the app talks to the piano exactly as it does in a browser that
 * has MIDI.
 *
 * In an ordinary browser none of this exists and every call here does nothing.
 */

interface NativeApp {
  native?: boolean;
  version?: string;
  /** Progress as last written to the app's own file, by storage key, with when it was written. */
  saved?: Record<string, { value: string; at: number }>;
  post?: (message: Record<string, unknown>) => void;
}

function shell(): NativeApp | null {
  if (typeof window === 'undefined') return null;
  const app = (window as unknown as { __middleC?: NativeApp }).__middleC;
  return app && app.native === true ? app : null;
}

/** Is the app running inside the iPad shell? */
export function isNative(): boolean {
  return shell() !== null;
}

function post(message: Record<string, unknown>): boolean {
  const app = shell();
  if (!app || typeof app.post !== 'function') return false;
  try {
    app.post(message);
    return true;
  } catch {
    return false;
  }
}

/** Progress as the app's own file has it, with the time it was written, or null. */
export function savedCopy(key: string): { value: string; at: number } | null {
  const copy = shell()?.saved?.[key];
  if (!copy || typeof copy.value !== 'string' || copy.value.length === 0) return null;
  return { value: copy.value, at: typeof copy.at === 'number' ? copy.at : 0 };
}

/** Write progress to the app's own file, which survives the web view's storage being cleared. */
export function saveCopy(key: string, value: string, at: number): void {
  const app = shell();
  if (!app) return;
  // Keep the copy in step, so a later read in this same visit sees it.
  if (!app.saved) app.saved = {};
  app.saved[key] = { value, at };
  post({ type: 'store.save', key, value, at });
}

/** Hand a backup to the iPad's share sheet: Files, AirDrop, Mail. */
export function shareFile(name: string, text: string): boolean {
  return post({ type: 'share', name, text });
}

/** Open the iPad's own list of Bluetooth MIDI instruments. */
export function pairBluetooth(): boolean {
  return post({ type: 'bluetooth' });
}
