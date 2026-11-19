'use client';

// Visible system messages under the header: why audio can't start, storage full,
// a crashed audio processor, iPad tips. Plus a portrait-orientation hint on small
// screens (iOS ignores the manifest's orientation).

import { useEffect, useState } from 'react';
import { useNotices } from '@/lib/studio/notices';
import { useAudioStatus } from '@/lib/studio/useHub';
import { hub } from '@/lib/studio/hub';

const STYLE = {
  error: 'border-red-600/70 bg-red-950/60 text-red-100',
  warn: 'border-amber-600/70 bg-amber-950/50 text-amber-100',
  info: 'border-sky-700/70 bg-sky-950/50 text-sky-100',
};

export default function SystemNotices() {
  const notices = useNotices(s => s.notices);
  const dismiss = useNotices(s => s.dismiss);
  const { status, error } = useAudioStatus();
  // The audio error is always shown as text (never only in a tooltip)
  const showAudio = status === 'error' && error && !notices.some(n => n.id === 'audio');
  return (
    <div className="flex flex-col" role="region" aria-label="Messages">
      {showAudio && (
        <div role="alert" className={`mb-2 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm ${STYLE.error}`}>
          <span className="flex-1 min-w-[240px]">{error}</span>
          <button onClick={() => hub.ensureAudio()} className="px-2.5 py-1 rounded bg-white/15 text-white text-xs font-bold">Try again</button>
        </div>
      )}
      {notices.map(n => (
        <div key={n.id} role={n.level === 'error' ? 'alert' : 'status'} className={`mb-2 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm ${STYLE[n.level]}`}>
          <span className="flex-1 min-w-[240px] leading-snug">{n.text}</span>
          {n.action && (
            <button
              onClick={() => { n.action!.run(); if (n.id === 'save-file' || n.id === 'home-import' || n.id === 'export' || n.id === 'old-settings') dismiss(n.id); }}
              className="px-2.5 py-1 rounded bg-white/15 text-white text-xs font-bold"
            >
              {n.action.label}
            </button>
          )}
          <button onClick={() => dismiss(n.id)} className="px-2 py-1 rounded text-xs text-white/70 hover:text-white" aria-label="Dismiss message">✕</button>
        </div>
      ))}
      <RotateHint />
    </div>
  );
}

/** Portrait on a small screen: the instruments are laid out for landscape */
function RotateHint() {
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    try { setHidden(localStorage.getItem('synth-studio-rotate-hint') === '1'); } catch { setHidden(false); }
  }, []);
  if (hidden) return null;
  return (
    <div className="mb-2 hidden [@media(orientation:portrait)_and_(max-width:900px)]:flex items-center gap-2 rounded-lg border border-[#3a3a3a] bg-[#1a1a1a] px-3 py-2 text-sm text-gray-200" role="status">
      <span aria-hidden className="text-lg">⟲</span>
      <span className="flex-1">Turn your device sideways: the instruments and the mixer are laid out for landscape.</span>
      <button
        onClick={() => { setHidden(true); try { localStorage.setItem('synth-studio-rotate-hint', '1'); } catch { /* */ } }}
        className="px-2 py-1 rounded text-xs text-gray-400 hover:text-white"
        aria-label="Dismiss rotate hint"
      >
        ✕
      </button>
    </div>
  );
}
