'use client';

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useStudioStore } from '@/store/studio';
import { bounceSong, cancelBounce, type BounceProgress } from '@/lib/studio/bounce';

const fmt = (v: number | undefined) => (v === undefined || !Number.isFinite(v) ? '–' : v.toFixed(1));

/** Bounce the song (or N bars of the loop) to WAV, with optional stems and -14 LUFS normalising */
export default function BounceDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const sections = useStudioStore(s => s.studio.arrangement.sections);
  const bpm = useStudioStore(s => s.studio.bpm);
  const [stems, setStems] = useState(false);
  const [normalize, setNormalize] = useState(false);
  const [bars, setBars] = useState(8);
  const [progress, setProgress] = useState<BounceProgress | null>(null);
  const song = sections.length > 0;
  const totalBars = song ? sections.reduce((n, s) => n + Math.max(1, s.bars), 0) : bars;
  const seconds = (totalBars * 4 * 60) / bpm;
  const busy = !!progress && ['preparing', 'playing', 'tail', 'encoding'].includes(progress.phase);

  const start = () => {
    setProgress({ phase: 'preparing' });
    void bounceSong({ stems, normalize, bars }, p => setProgress(p));
  };

  return (
    <Dialog.Root open={open} onOpenChange={o => { if (!busy) { onOpenChange(o); if (!o) setProgress(null); } }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/70 z-40" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#161616] border-2 border-[#333] rounded-xl p-5 w-[calc(100%-2rem)] max-w-md shadow-2xl z-50">
          <Dialog.Title className="text-lg font-bold text-white">Bounce song</Dialog.Title>
          <Dialog.Description className="text-xs text-gray-400 mt-1 leading-relaxed">
            {song
              ? <>Plays the arrangement from bar 1 to the end ({totalBars} bars, {Math.floor(seconds / 60)}:{String(Math.round(seconds % 60)).padStart(2, '0')}), keeps recording until the reverb and delay tails have died away, then downloads.</>
              : <>No song sections yet, so this bounces the loop that is playing now. Build sections in the arranger to bounce a whole song.</>}
          </Dialog.Description>

          {!song && (
            <label className="mt-3 flex items-center gap-2 text-sm text-gray-200">
              Length
              <select value={bars} onChange={e => setBars(Number(e.target.value))} className="bg-[#232323] border border-[#3a3a3a] rounded px-2 py-1 text-sm" disabled={busy}>
                {[1, 2, 4, 8, 16, 32].map(b => <option key={b} value={b}>{b} bar{b > 1 ? 's' : ''}</option>)}
              </select>
              <span className="text-xs text-gray-500">{fmt(seconds)} s at {bpm} BPM</span>
            </label>
          )}

          <div className="mt-4 space-y-2.5">
            <Check checked={stems} onChange={setStems} disabled={busy} title="Stems">
              Every channel and both returns as separate WAV files, sample-aligned and the same length, zipped with the master.
            </Check>
            <Check checked={normalize} onChange={setNormalize} disabled={busy} title="Normalise loudness to −14 LUFS">
              Streaming level: gain to −14 LUFS integrated with a −1 dBTP true-peak limiter. Master file only; stems keep your mix levels. Off keeps exactly what you hear.
            </Check>
          </div>

          {progress && (
            <div className="mt-4 rounded-lg bg-black/40 border border-[#2a2a2a] p-3 text-sm" role="status" aria-live="polite">
              {progress.phase === 'preparing' && <p className="text-gray-300">{progress.message ?? 'Getting ready…'}</p>}
              {progress.phase === 'playing' && (
                <>
                  <p className="text-gray-200">Recording bar <b className="tabular-nums">{progress.bar ?? 0}</b> of {progress.bars}</p>
                  <div className="mt-2 h-2 rounded bg-[#2a2a2a] overflow-hidden">
                    <div className="h-full bg-red-500 transition-[width]" style={{ width: `${Math.min(100, ((progress.bar ?? 0) / (progress.bars || 1)) * 100)}%` }} />
                  </div>
                </>
              )}
              {progress.phase === 'tail' && <p className="text-gray-300">{progress.message}</p>}
              {progress.phase === 'encoding' && <p className="text-gray-300">{progress.message}</p>}
              {progress.phase === 'done' && progress.result && (
                <div className="text-gray-200 space-y-1">
                  <p className="text-green-400 font-bold">Done - {progress.result.files > 1 ? `${progress.result.files} files in a .zip` : 'WAV'} downloaded ({fmt(progress.result.seconds)} s).</p>
                  <p className="text-xs text-gray-400 tabular-nums">
                    Your mix: {fmt(progress.result.master.integrated)} LUFS integrated, true peak {fmt(progress.result.master.truePeak)} dBTP.
                  </p>
                  {progress.result.normalized && (
                    <p className="text-xs text-gray-400 tabular-nums">
                      Normalised: {progress.result.gainDb! >= 0 ? '+' : ''}{fmt(progress.result.gainDb)} dB → {fmt(progress.result.normalized.integrated)} LUFS, {fmt(progress.result.normalized.truePeak)} dBTP.
                    </p>
                  )}
                </div>
              )}
              {progress.phase === 'cancelled' && <p className="text-gray-400">Cancelled.</p>}
              {progress.phase === 'error' && <p className="text-red-400">Bounce failed: {progress.message}</p>}
            </div>
          )}

          <div className="mt-5 flex justify-end gap-2">
            {busy ? (
              <button onClick={() => cancelBounce()} className="px-4 py-2 rounded bg-[#3a3a3a] text-white text-sm">Cancel</button>
            ) : (
              <>
                <Dialog.Close asChild><button className="px-4 py-2 rounded bg-[#2a2a2a] text-gray-200 text-sm">Close</button></Dialog.Close>
                <button onClick={start} className="px-4 py-2 rounded bg-red-600 text-white text-sm font-bold">
                  {progress?.phase === 'done' ? 'Bounce again' : 'Bounce'}
                </button>
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Check({ checked, onChange, disabled, title, children }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; title: string; children: React.ReactNode }) {
  return (
    <label className={`flex gap-2.5 items-start ${disabled ? 'opacity-60' : ''}`}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} disabled={disabled} className="mt-1 w-4 h-4 accent-sky-500" />
      <span>
        <span className="block text-sm text-white font-bold">{title}</span>
        <span className="block text-xs text-gray-400 leading-snug">{children}</span>
      </span>
    </label>
  );
}
