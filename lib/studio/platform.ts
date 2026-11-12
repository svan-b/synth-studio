// ============================================================================
// Browser and iPad integration for the studio:
//   - saving files: the share sheet on iPad ("Save to Files"), a download elsewhere
//   - a screen wake lock while the studio plays
//   - Media Session play / pause / stop (headphone buttons, lock screen)
//   - persistent storage, Home Screen app detection
//   - a longer scheduling look-ahead while the page is hidden
//   - timers on the audio clock (hidden pages' setTimeout runs once a second on iPad)
// ============================================================================

import { Clock } from '@/lib/audio/engine';
import { transport, Transport } from '@/lib/audio/transport';
import { getAudioContext } from '@/lib/audio/context';
import { showNotice } from './notices';

// ---------------------------------------------------------------------------
// Platform
// ---------------------------------------------------------------------------

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // iPadOS 13+ asks for desktop sites and reports itself as a Mac with touch
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

/** Launched from the Home Screen (a web app with its own storage) */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (navigator as unknown as { standalone?: boolean }).standalone === true || window.matchMedia?.('(display-mode: standalone)').matches;
}

/** iOS / iPadOS (or Safari) version as [major, minor], from the user agent */
export function appleVersion(): [number, number] | null {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent;
  const os = ua.match(/OS (\d+)_(\d+)/);
  if (os && /iPhone|iPad|iPod/.test(ua)) return [Number(os[1]), Number(os[2])];
  const v = ua.match(/Version\/(\d+)\.(\d+)/);
  return v ? [Number(v[1]), Number(v[2])] : null;
}

// ---------------------------------------------------------------------------
// Saving files
// ---------------------------------------------------------------------------

export function downloadBlob(blob: Blob, filename: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
}

export type SaveResult = 'shared' | 'downloaded' | 'cancelled' | 'needs-tap';

/**
 * Save a file. On iPad and iPhone this opens the share sheet (Save to Files, AirDrop,
 * an app); a download link there often just previews the file. The share sheet needs a
 * tap within the last few seconds: after a long bounce it returns 'needs-tap' and the
 * caller offers a Save button.
 */
export async function saveFile(blob: Blob, filename: string): Promise<SaveResult> {
  const nav = navigator as Navigator & { userActivation?: { isActive: boolean } };
  if (isIOS() && typeof nav.share === 'function') {
    const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
    if (nav.canShare?.({ files: [file] })) {
      if (nav.userActivation && !nav.userActivation.isActive) return 'needs-tap';
      try {
        await nav.share({ files: [file], title: filename });
        return 'shared';
      } catch (e) {
        const name = (e as { name?: string }).name;
        if (name === 'AbortError') return 'cancelled';
        if (name === 'NotAllowedError') return 'needs-tap';
        // anything else: fall back to a download
      }
    }
  }
  downloadBlob(blob, filename);
  return 'downloaded';
}

export interface SaveItem { blob: Blob; name: string }

/** Several files: one share sheet on iPad, one download each elsewhere */
export async function saveFiles(items: SaveItem[]): Promise<SaveResult> {
  if (items.length === 1) return saveFile(items[0].blob, items[0].name);
  const nav = navigator as Navigator & { userActivation?: { isActive: boolean } };
  if (isIOS() && typeof nav.share === 'function') {
    const files = items.map(i => new File([i.blob], i.name, { type: i.blob.type || 'application/octet-stream' }));
    if (nav.canShare?.({ files })) {
      if (nav.userActivation && !nav.userActivation.isActive) return 'needs-tap';
      try { await nav.share({ files }); return 'shared'; } catch (e) {
        const name = (e as { name?: string }).name;
        if (name === 'AbortError') return 'cancelled';
        if (name === 'NotAllowedError') return 'needs-tap';
      }
    }
  }
  items.forEach(i => downloadBlob(i.blob, i.name));
  return 'downloaded';
}

/** saveFiles, and when the share sheet needs a fresh tap, a visible "Save" button that gives it one */
export async function saveFilesOrOffer(items: SaveItem[], what = 'file'): Promise<SaveResult> {
  const r = await saveFiles(items);
  if (r === 'needs-tap') {
    showNotice({
      id: 'save-file', level: 'info', text: `Your ${what} is ready.`,
      action: { label: `Save ${what}`, run: () => { void saveFiles(items); } },
    });
  }
  return r;
}

// ---------------------------------------------------------------------------
// Screen wake lock while playing
// ---------------------------------------------------------------------------

type Sentinel = { release: () => Promise<void>; released?: boolean; addEventListener?: (t: string, l: () => void) => void };
let lock: Sentinel | null = null;
let wantLock = false;

async function requestLock() {
  const wl = (navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<Sentinel> } }).wakeLock;
  if (!wl || lock || document.visibilityState !== 'visible') return;
  try {
    lock = await wl.request('screen');
    lock.addEventListener?.('release', () => { lock = null; });
    if (!wantLock) { void lock.release(); lock = null; }
  } catch {
    lock = null; // not allowed (no gesture, battery saver...)
  }
}

/** Keep the screen on while the studio plays. Call from the Play gesture. */
export function holdWakeLock() {
  wantLock = true;
  void requestLock();
  // iPadOS Home Screen apps can't hold a wake lock before 18.4
  const v = appleVersion();
  if (isIOS() && isStandalone() && v && (v[0] < 18 || (v[0] === 18 && v[1] < 4))) {
    showNotice({
      id: 'wake-lock', level: 'info', once: true,
      text: 'Tip: so the iPad doesn’t lock and stop the music, set Settings › Display & Brightness › Auto-Lock to Never while you play (this Home Screen app can’t keep the screen on before iPadOS 18.4).',
    });
  }
}

export function releaseWakeLock() {
  wantLock = false;
  const l = lock;
  lock = null;
  void l?.release().catch(() => undefined);
}

// ---------------------------------------------------------------------------
// Media Session (hardware play / pause, lock screen)
// ---------------------------------------------------------------------------

export function initMediaSession(h: { play: () => void; stop: () => void }) {
  const ms = (navigator as unknown as { mediaSession?: MediaSession }).mediaSession;
  if (!ms) return;
  const set = (action: MediaSessionAction, fn: () => void) => { try { ms.setActionHandler(action, fn); } catch { /* unsupported action */ } };
  set('play', h.play);
  set('pause', h.stop);
  set('stop', h.stop);
  try {
    if (typeof MediaMetadata !== 'undefined') ms.metadata = new MediaMetadata({ title: 'Synth Studio', artist: 'Your studio' });
  } catch { /* */ }
}

export function setMediaPlaying(playing: boolean) {
  const ms = (navigator as unknown as { mediaSession?: MediaSession }).mediaSession;
  if (ms) { try { ms.playbackState = playing ? 'playing' : 'paused'; } catch { /* */ } }
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

let persistAsked = false;

/** Ask the browser not to evict our data (no prompt in Safari and Chrome; Firefox asks, so only on request) */
export function requestPersistentStorage(force = false) {
  if (persistAsked) return;
  const firefox = /Firefox\//.test(navigator.userAgent);
  if (firefox && !force) return;
  persistAsked = true;
  void navigator.storage?.persist?.().catch(() => undefined);
}

// ---------------------------------------------------------------------------
// Hidden pages: longer look-ahead
// ---------------------------------------------------------------------------

let visibilityHooked = false;

/** WebKit runs hidden pages' timers once a second even while audio plays: schedule further ahead then */
export function watchVisibility(onVisible?: () => void) {
  if (visibilityHooked || typeof document === 'undefined') return;
  visibilityHooked = true;
  const apply = () => {
    const hidden = document.visibilityState === 'hidden';
    transport.setLookahead(hidden ? Transport.HIDDEN_LOOKAHEAD : Transport.LOOKAHEAD);
    Clock.minLookahead = hidden ? Transport.HIDDEN_LOOKAHEAD : 0;
    if (!hidden) {
      if (wantLock) void requestLock();
      onVisible?.();
    }
  };
  document.addEventListener('visibilitychange', apply);
  apply();
}

// ---------------------------------------------------------------------------
// Timers on the audio clock
// ---------------------------------------------------------------------------

let timerSink: GainNode | null = null;

/**
 * Run `fn` on the main thread when the audio clock reaches `time` (a source node's
 * 'ended' event). Unlike setTimeout it isn't held back while the page is hidden.
 * Returns a cancel function.
 */
export function atAudioTime(time: number, fn: () => void): () => void {
  const ctx = getAudioContext();
  if (time <= ctx.currentTime + 0.003) { fn(); return () => undefined; }
  if (!timerSink) {
    timerSink = ctx.createGain();
    timerSink.gain.value = 0;
    timerSink.connect(ctx.destination);
  }
  const src = ctx.createConstantSource();
  src.offset.value = 0;
  let done = false;
  src.onended = () => {
    src.disconnect();
    if (done) return;
    done = true;
    fn();
  };
  src.connect(timerSink);
  src.start();
  src.stop(time);
  return () => { done = true; try { src.stop(); } catch { /* */ } };
}
