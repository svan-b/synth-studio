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

/** Where the iPad's own sound is going, as the app reports it. */
export interface SoundInfo {
  /** The iPad's speaker, wired headphones, something over Bluetooth, or anything else. */
  route: 'speaker' | 'headphones' | 'bluetooth' | 'other';
  /** The name of the output, such as "P-525 AUDIO". */
  name: string;
  /** How long sound takes to be heard after it is sent, in milliseconds. */
  delayMs: number;
}

interface NativeApp {
  native?: boolean;
  /** The last word from the app about its sound output, and who to tell when it changes. */
  soundInfo?: SoundInfo;
  onSound?: (info: SoundInfo) => void;
  version?: string;
  /** Progress as last written to the app's own file, by storage key, with when it was written. */
  saved?: Record<string, { value: string; at: number }>;
  post?: (message: Record<string, unknown>) => void;
  /** Called by the app when it is brought back to the front. */
  wake?: () => void;
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

/** Have the app call this each time it comes back to the front. */
export function onWake(fn: () => void): void {
  const app = shell();
  if (app) app.wake = fn;
}

/** Hand a backup to the iPad's share sheet: Files, AirDrop, Mail. */
export function shareFile(name: string, text: string): boolean {
  return post({ type: 'share', name, text });
}

/** Open the iPad's own list of Bluetooth MIDI instruments. */
export function pairBluetooth(): boolean {
  return post({ type: 'bluetooth' });
}

const soundListeners = new Set<(info: SoundInfo | null) => void>();

/** What the app last said about where the iPad's sound is going, or null outside the app. */
export function soundInfo(): SoundInfo | null {
  const info = shell()?.soundInfo;
  return info && typeof info.delayMs === 'number' ? info : null;
}

/** Be told where the iPad's sound is going, now and whenever it changes. Returns a way to stop. */
export function onSound(fn: (info: SoundInfo | null) => void): () => void {
  const app = shell();
  soundListeners.add(fn);
  if (app) {
    app.onSound = (info) => soundListeners.forEach((f) => f(info));
    const known = soundInfo();
    fn(known);
    // Ask once, in case the app spoke before the page was ready to listen.
    if (!known) post({ type: 'sound.ask' });
  }
  return () => {
    soundListeners.delete(fn);
  };
}
