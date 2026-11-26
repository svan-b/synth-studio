'use client';

/**
 * Shown in place of a screen that failed to draw, so one fault never leaves
 * the learner looking at a blank page. Progress is saved as it is made, so it
 * is safe, and a backup can be taken from here before anything else is tried.
 */

import { useEffect, useState } from 'react';
import { exportData } from '@/lib/guitar/learn/store';
import { shareFile } from '@/lib/guitar/native/bridge';
import { dayKey } from '@/lib/guitar/util/emitter';

export default function GuitarError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    console.error(error);
  }, [error]);
  const backup = () => {
    try {
      const text = exportData();
      const name = `open-string-${dayKey()}.json`;
      if (!shareFile(name, text)) {
        const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      }
      setSaved(true);
    } catch {
      setSaved(false);
    }
  };
  const button = { height: 60, padding: '0 28px', borderRadius: 999, fontSize: 20, fontWeight: 600, border: 'none', cursor: 'pointer' } as const;
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 32, textAlign: 'center', background: '#F7F3EB', color: '#1C1D1B', font: '20px/1.5 -apple-system, system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 40, fontWeight: 600, margin: 0 }}>That screen could not be shown</h1>
      <p style={{ maxWidth: 560, margin: 0 }}>Your progress is safe. It is saved as you go. Go back and carry on, and if it happens again on the same screen, save a backup and tell whoever set the app up for you.</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
        <button style={{ ...button, background: '#E9E3D6', color: '#1C1D1B' }} onClick={backup}>
          {saved ? 'Backup saved' : 'Save a backup'}
        </button>
        <button
          style={{ ...button, background: '#1C1D1B', color: '#F7F3EB' }}
          onClick={() => {
            // Start the app afresh at Today. What is saved is read back in.
            reset();
            if (typeof window !== 'undefined') window.location.reload();
          }}
        >
          Back to the start
        </button>
      </div>
    </div>
  );
}
