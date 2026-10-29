// ============================================================================
// Saving the studio in the browser without stalling the UI.
//
// zustand's persist middleware writes on every set(): during a knob drag that is
// a full JSON.stringify of the studio (Elektron patterns included) on every
// pointermove. This storage keeps the latest state object and writes it at most
// once per INTERVAL: a single edit after a quiet moment is written at once (so a
// reload a moment later has it), a drag is written a couple of times a second,
// and anything pending is written when the page is hidden or closed.
//
// localStorage allows about 5 MB per site. When a write fails (quota), saving
// would otherwise stop silently: we keep retrying on the next change and show a
// visible "storage full - save the project to a file" message.
// ============================================================================

import type { PersistStorage, StorageValue } from 'zustand/middleware';
import { showNotice, dismissNotice } from './notices';

const INTERVAL = 600;

export interface FlushableStorage<S> extends PersistStorage<S> {
  /** Write anything pending now */
  flush(): void;
  /** True while the last write failed */
  readonly failing: boolean;
}

export function throttledLocalStorage<S>(interval = INTERVAL): FlushableStorage<S> {
  let pending: { name: string; value: StorageValue<S> } | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let last = 0;
  let failing = false;

  const write = () => {
    if (timer) { clearTimeout(timer); timer = null; }
    const p = pending;
    pending = null;
    if (!p) return;
    last = Date.now();
    try {
      localStorage.setItem(p.name, JSON.stringify(p.value));
      if (failing) { failing = false; dismissNotice('storage'); }
    } catch (e) {
      failing = true;
      const quota = e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22 || e.name === 'NS_ERROR_DOM_QUOTA_REACHED');
      showNotice({
        id: 'storage',
        level: 'error',
        text: quota
          ? 'Storage full: this browser has no room left to save your studio, so your latest changes are not saved here. Save the project to a file to keep them.'
          : 'This browser refused to save your studio (private mode or storage switched off). Save the project to a file to keep your work.',
        action: { label: 'Save project to a file', run: () => window.dispatchEvent(new CustomEvent('synth-studio:save-project')) },
      });
    }
  };

  if (typeof window !== 'undefined') {
    const flushNow = () => { if (pending) write(); };
    window.addEventListener('pagehide', flushNow);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushNow(); });
  }

  return {
    getItem: name => {
      try {
        const s = localStorage.getItem(name);
        return s ? (JSON.parse(s) as StorageValue<S>) : null;
      } catch {
        return null;
      }
    },
    setItem: (name, value) => {
      pending = { name, value };
      if (timer) return;
      const wait = last + interval - Date.now();
      if (wait <= 0) write();
      else timer = setTimeout(write, wait);
    },
    removeItem: name => {
      try { localStorage.removeItem(name); } catch { /* */ }
    },
    flush: () => write(),
    get failing() { return failing; },
  };
}
