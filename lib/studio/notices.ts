// ============================================================================
// Visible system messages (audio can't start, storage full, an audio processor
// crashed, iPad tips). Not persisted; one-time tips remember their dismissal in
// localStorage.
// ============================================================================

import { create } from 'zustand';

export type NoticeId =
  | 'audio'          // audio engine can't start (insecure page, no AudioWorklet, error)
  | 'storage'        // the browser refused to save (quota)
  | 'processor'      // an AudioWorklet processor threw
  | 'wake-lock'      // iPad Home Screen app before iOS 18.4: set Auto-Lock to Never
  | 'home-import'    // first launch from the Home Screen: separate storage
  | 'export'         // gentle reminder to save a project file
  | 'save-file';     // a finished bounce waiting for a tap to share (iPad)

export interface Notice {
  id: NoticeId;
  level: 'error' | 'warn' | 'info';
  text: string;
  /** Remember the dismissal on this browser (one-time tips) */
  once?: boolean;
  action?: { label: string; run: () => void };
}

interface NoticeStore {
  notices: Notice[];
  show: (n: Notice) => void;
  dismiss: (id: NoticeId) => void;
}

const SEEN_KEY = 'synth-studio-tips-seen';

function seen(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}'); } catch { return {}; }
}

export const useNotices = create<NoticeStore>((set, get) => ({
  notices: [],
  show: n => {
    if (n.once && seen()[n.id]) return;
    set({ notices: [...get().notices.filter(x => x.id !== n.id), n] });
  },
  dismiss: id => {
    const n = get().notices.find(x => x.id === id);
    if (n?.once) {
      try { localStorage.setItem(SEEN_KEY, JSON.stringify({ ...seen(), [id]: true })); } catch { /* */ }
    }
    set({ notices: get().notices.filter(x => x.id !== id) });
  },
}));

export const showNotice = (n: Notice) => useNotices.getState().show(n);
export const dismissNotice = (id: NoticeId) => useNotices.getState().dismiss(id);
