'use client';

// Master meters (BS.1770-4): sample and true peak, momentary / short-term /
// integrated loudness, limiter gain reduction and an over indicator. Data comes
// from the master-bus worklet 20 times a second; bars animate on the shared
// meter loop, numbers refresh at 10 Hz.

import { useEffect, useRef, useState } from 'react';
import { getLastMasterMeter, onMasterMeter, resetMasterMeter, LIMITER_CEILING_DB, type MasterMeterFrame } from '@/lib/audio/context';
import { StereoMeter } from './controls';

const db = (v: number) => (v > 0 ? 20 * Math.log10(v) : -Infinity);
const fmt = (v: number | null | undefined, d = 1) => (v === null || v === undefined || !Number.isFinite(v) ? '–' : v.toFixed(d));

export interface MasterReadout {
  frame: MasterMeterFrame | null;
  peakMax: number;
  tpMax: number;
  grMax: number;
  grNow: number;
  glueNow: number;
  over: boolean;
  limiting: boolean;
}

/** Master meter numbers with holds (reset by resetMasterHolds or Play) */
export function useMasterReadout(rateMs = 100): [MasterReadout, () => void] {
  const acc = useRef({ peakMax: 0, tpMax: 0, grMax: 0, grNow: 0, glueNow: 0, over: false, limitT: 0 });
  const [r, setR] = useState<MasterReadout>({ frame: getLastMasterMeter(), peakMax: -Infinity, tpMax: -Infinity, grMax: 0, grNow: 0, glueNow: 0, over: false, limiting: false });
  useEffect(() => {
    const unsub = onMasterMeter(f => {
      const a = acc.current;
      a.peakMax = Math.max(a.peakMax, f.peakL, f.peakR);
      a.tpMax = Math.max(a.tpMax, f.tp);
      a.grMax = Math.max(a.grMax, f.gr);
      a.grNow = Math.max(f.gr, a.grNow * 0.7);
      a.glueNow = f.glue;
      if (f.inPeak >= 1) a.over = true;
      if (f.gr > 0.1) a.limitT = performance.now();
    });
    const id = setInterval(() => {
      const a = acc.current;
      setR({
        frame: getLastMasterMeter(), peakMax: db(a.peakMax), tpMax: db(a.tpMax), grMax: a.grMax, grNow: a.grNow, glueNow: a.glueNow,
        over: a.over, limiting: performance.now() - a.limitT < 1200,
      });
    }, rateMs);
    return () => { unsub(); clearInterval(id); };
  }, [rateMs]);
  const reset = () => {
    acc.current = { peakMax: 0, tpMax: 0, grMax: 0, grNow: 0, glueNow: 0, over: false, limitT: 0 };
    resetMasterMeter();
  };
  return [r, reset];
}

const readMaster = () => {
  const f = getLastMasterMeter();
  return f ? { l: f.peakL, r: f.peakR } : null;
};

/** Top-bar meter: stereo peak, short-term loudness, limiter and over lights */
export function MasterMeterCompact() {
  const [r] = useMasterReadout(200);
  const s = r.frame?.s ?? null;
  return (
    <span className="flex items-center gap-1.5" aria-label="Master meter">
      <HBar />
      <span
        className="font-mono text-[10px] tabular-nums text-gray-300 w-[44px] text-right"
        title="Short-term loudness (last 3 s), LUFS. Streaming services play at about -14."
      >
        {fmt(s)}<span className="text-gray-500"> LU</span>
      </span>
      <span
        className={`text-[9px] font-bold px-1 rounded ${r.limiting ? 'bg-amber-500 text-black' : 'bg-[#2a2a2a] text-gray-600'}`}
        title={`Master limiter (ceiling ${LIMITER_CEILING_DB} dBTP). It lights when it is catching peaks: turn something down if it stays on.`}
      >
        LIM
      </span>
    </span>
  );
}

function HBar() {
  // horizontal stereo bar for the top bar (uses the shared meter loop through a rotated container)
  return (
    <span className="relative inline-block w-12 h-[10px]" aria-hidden>
      <span className="absolute left-1/2 top-1/2 w-[10px] h-12 -translate-x-1/2 -translate-y-1/2 rotate-90">
        <StereoMeter read={readMaster} />
      </span>
    </span>
  );
}

/** The master strip's meter block */
export function MasterMeterPanel({ height = 168 }: { height?: number }) {
  const [r, reset] = useMasterReadout(100);
  const f = r.frame;
  const grPct = Math.min(1, r.grNow / 12);
  return (
    <div className="flex gap-2 items-start">
      <div className="relative" style={{ height, width: 16 }} title="Master output peak, left and right (on the fader scale)">
        <StereoMeter read={readMaster} showClip />
      </div>
      <div className="relative w-[7px] bg-black/70 rounded-[1px] overflow-hidden" style={{ height }} title="Limiter gain reduction (0 at the top, 12 dB at the bottom)">
        <div className="absolute inset-0 origin-top bg-amber-400" style={{ transform: `scaleY(${grPct.toFixed(3)})` }} />
      </div>
      <dl className="text-[10px] leading-tight grid grid-cols-[auto_auto] gap-x-1.5 gap-y-0.5 tabular-nums font-mono">
        <dt className="text-gray-500" title="Momentary loudness: the last 0.4 s">M</dt><dd className="text-right text-gray-200">{fmt(f?.m)}</dd>
        <dt className="text-gray-500" title="Short-term loudness: the last 3 s">S</dt><dd className="text-right text-gray-100 font-bold">{fmt(f?.s)}</dd>
        <dt className="text-gray-500" title="Integrated loudness since Play (gated, BS.1770-4). Streaming targets: about -14 LUFS.">I</dt><dd className="text-right text-sky-300 font-bold">{fmt(f?.i)}</dd>
        <dt className="col-span-2 text-[9px] text-gray-600 -mt-0.5">LUFS</dt>
        <dt className="text-gray-500" title="Highest sample peak since reset, dBFS">PK</dt><dd className="text-right text-gray-200">{fmt(r.peakMax)}</dd>
        <dt className="text-gray-500" title="Highest true peak (4x oversampled, between samples) since reset, dBTP">TP</dt>
        <dd className={`text-right ${r.tpMax > LIMITER_CEILING_DB + 0.05 ? 'text-red-400' : 'text-gray-200'}`}>{fmt(r.tpMax)}</dd>
        <dt className="text-gray-500" title="Limiter gain reduction now / most since reset, dB">GR</dt>
        <dd className={`text-right ${r.limiting ? 'text-amber-300' : 'text-gray-400'}`}>{fmt(r.grNow)}<span className="text-gray-600">/{fmt(r.grMax)}</span></dd>
        {r.glueNow > 0.05 && (<><dt className="text-gray-500" title="Glue compressor gain reduction, dB">GL</dt><dd className="text-right text-violet-300">{fmt(r.glueNow)}</dd></>)}
      </dl>
      <div className="flex flex-col gap-1">
        <span
          className={`text-[9px] font-bold px-1 py-0.5 rounded text-center ${r.limiting ? 'bg-amber-500 text-black' : 'bg-[#262626] text-gray-600'}`}
          title="The limiter is catching peaks above -1 dBTP right now"
        >
          LIMIT
        </span>
        <span
          className={`text-[9px] font-bold px-1 py-0.5 rounded text-center ${r.over ? 'bg-red-600 text-white' : 'bg-[#262626] text-gray-600'}`}
          title="The mix went over 0 dBFS before the limiter (it would have clipped). Turn faders or the master down. Tap reset to clear."
        >
          OVER
        </span>
        <button onClick={reset} className="text-[9px] px-1 py-1 rounded bg-[#262626] text-gray-300 hover:bg-[#333]" title="Reset peak holds and the integrated loudness">
          reset
        </button>
      </div>
    </div>
  );
}
