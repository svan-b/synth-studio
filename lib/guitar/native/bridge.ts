/**
 * The iPad app.
 *
 * Fretward can run inside a native shell that gives it what a web page on
 * an iPad cannot have: a durable file for progress, recordings saved where
 * the Files app can see them, a daily reminder, and the iPad's own volume.
 * The shell announces itself as `window.__openString` before any of the
 * page's own code runs.
 *
 * In an ordinary browser none of this exists and every call here does nothing.
 */

interface NativeApp {
  native?: boolean;
  version?: string;
  /** Progress as last written to the app's own file, by key, with when it was written. */
  saved?: Record<string, { value: string; at: number }>;
  post?: (message: Record<string, unknown>) => void;
  /** Called by the app when it comes back to the front. */
  wake?: () => void;
  /** Called by the app with the iPad's output volume, 0 to 1. */
  volume?: (v: number) => void;
  /** The last output volume the app reported. */
  lastVolume?: number;
}

function shell(): NativeApp | null {
  if (typeof window === 'undefined') return null;
  const app = (window as unknown as { __openString?: NativeApp }).__openString;
  return app && app.native === true ? app : null;
}

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

export function savedCopy(key: string): { value: string; at: number } | null {
  const copy = shell()?.saved?.[key];
  if (!copy || typeof copy.value !== 'string' || copy.value.length === 0) return null;
  return { value: copy.value, at: typeof copy.at === 'number' ? copy.at : 0 };
}

export function saveCopy(key: string, value: string, at: number): void {
  const app = shell();
  if (!app) return;
  if (!app.saved) app.saved = {};
  app.saved[key] = { value, at };
  post({ type: 'store.save', key, value, at });
}

export function onWake(fn: () => void): void {
  const app = shell();
  if (app) app.wake = fn;
}

const volumeListeners = new Set<(v: number) => void>();

/** Follow the iPad's output volume, when the app can tell. Returns a function that stops following it. */
export function onVolume(fn: (v: number) => void): () => void {
  const app = shell();
  if (!app) return () => undefined;
  volumeListeners.add(fn);
  app.volume = (v: number) => {
    app.lastVolume = v;
    volumeListeners.forEach((listener) => listener(v));
  };
  if (typeof app.lastVolume === 'number') fn(app.lastVolume);
  // Each request also brings a fresh reading.
  post({ type: 'volume.watch' });
  return () => {
    volumeListeners.delete(fn);
  };
}

/** Hand a text file to the iPad's share sheet. */
export function shareFile(name: string, text: string): boolean {
  return post({ type: 'share', name, text });
}

/** Save a recording where the Files app can see it, and offer it to the share sheet when asked. */
export function saveRecording(name: string, base64: string, mime: string, share = false): boolean {
  return post({ type: 'recording.save', name, data: base64, mime, share });
}

/**
 * Ask for a daily reminder at a time of day, on the days ahead that have not
 * been played yet. The app asks the iPad's permission the first time.
 */
export function setReminder(on: boolean, hour: number, minute: number, playedToday: boolean, message: string): boolean {
  return post({ type: 'remind', on, hour, minute, playedToday, message });
}

/** Keep the iPad's sound on the speaker while the microphone is in use. */
export function audioListening(on: boolean): boolean {
  return post({ type: 'audio.listening', on });
}
