'use client';

import { useEffect, useRef, useState } from 'react';
import { getLatencyInfo, getLatencyPreference, setLatencyPreference, type LatencyInfo, type LatencyPreference } from '@/lib/audio/context';

const ms = (s: number) => `${(s * 1000).toFixed(1)} ms`;

/** Gear button: output latency and the latency preference (applied on the next page load) */
export default function AudioSettings() {
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<LatencyInfo | null>(null);
  const [pref, setPref] = useState<LatencyPreference>('interactive');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setPref(getLatencyPreference());
    const read = () => setInfo(getLatencyInfo());
    read();
    const id = setInterval(read, 1000); // outputLatency settles once audio runs
    const close = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('pointerdown', close, true);
    window.addEventListener('keydown', esc);
    return () => { clearInterval(id); window.removeEventListener('pointerdown', close, true); window.removeEventListener('keydown', esc); };
  }, [open]);

  const changed = info && pref !== info.hint;
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-label="Audio settings and latency"
        title="Audio settings: latency"
        className={`w-9 h-9 rounded text-[15px] ${open ? 'bg-[#333] text-white' : 'bg-[#242424] text-gray-300'}`}
      >
        ⚙
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-[300px] rounded-xl border border-[#3a3a3a] bg-[#1b1b1b] shadow-2xl p-3 text-sm" role="dialog" aria-label="Audio settings">
          <h4 className="font-bold text-white mb-1">Latency</h4>
          <p className="text-[11px] text-gray-400 leading-snug mb-2">
            The time from pressing a pad or key to hearing it. Below about 10 ms feels instant; above 25 ms feels sluggish to play.
          </p>
          {info ? (
            <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-[12px] tabular-nums">
              <dt className="text-gray-400">Audio buffer (base)</dt><dd className="text-right text-gray-100">{ms(info.base)}</dd>
              <dt className="text-gray-400">Device output</dt><dd className="text-right text-gray-100">{info.output ? ms(info.output) : 'not reported'}</dd>
              <dt className="text-gray-400" title="The master limiter looks ahead this far so it can catch peaks smoothly">Limiter look-ahead</dt><dd className="text-right text-gray-100">{ms(info.lookahead)}</dd>
              <dt className="text-white font-bold border-t border-[#333] pt-1 mt-0.5">Total</dt><dd className="text-right text-white font-bold border-t border-[#333] pt-1 mt-0.5">{ms(info.total)}</dd>
              <dt className="text-gray-500 text-[11px]">Sample rate</dt><dd className="text-right text-gray-400 text-[11px]">{info.sampleRate} Hz</dd>
            </dl>
          ) : (
            <p className="text-[12px] text-gray-500">Start audio to measure.</p>
          )}
          <h4 className="font-bold text-white mt-3 mb-1">Preference</h4>
          <div className="space-y-1.5">
            {([
              ['interactive', 'Interactive', 'Lowest latency, best for playing. Default.'],
              ['balanced', 'Balanced', 'Bigger buffers: fewer crackles with a big studio on a slow device.'],
            ] as const).map(([id, name, text]) => (
              <label key={id} className="flex gap-2 items-start cursor-pointer">
                <input
                  type="radio"
                  name="latency-pref"
                  checked={pref === id}
                  onChange={() => { setPref(id); setLatencyPreference(id); }}
                  className="mt-1 accent-sky-500"
                />
                <span><span className="text-[12px] text-white font-bold">{name}</span> <span className="text-[11px] text-gray-400">{text}</span></span>
              </label>
            ))}
          </div>
          {changed && (
            <div className="mt-2 flex items-center gap-2">
              <p className="text-[11px] text-amber-300 flex-1">Applies when the page reloads (your work is saved).</p>
              <button onClick={() => window.location.reload()} className="px-2 py-1 rounded bg-sky-600 text-white text-[11px] font-bold">Reload now</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
