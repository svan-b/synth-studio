'use client';

import { useEffect, useRef, useState } from 'react';
import { getMasterAnalyser } from '@/lib/audio/context';

/**
 * Oscilloscope + spectrum of the studio output. Seeing a filter remove
 * harmonics *while* hearing it is the fastest way to understand timbre
 * (dual coding: the same idea through ear and eye).
 */
export default function Scope({ height = 120, mode: initial = 'both' }: { height?: number; mode?: 'wave' | 'spectrum' | 'both' }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState(initial);

  useEffect(() => {
    let raf = 0;
    const timeBuf = new Float32Array(2048);
    const freqBuf = new Float32Array(1024);
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const canvas = canvasRef.current;
      const an = getMasterAnalyser();
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
      const g = canvas.getContext('2d');
      if (!g) return;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = '#060a06';
      g.fillRect(0, 0, w, h);
      if (!an) return;
      const showWave = mode !== 'spectrum';
      const showSpec = mode !== 'wave';
      const waveH = showWave && showSpec ? h * 0.5 : h;
      const specTop = showWave && showSpec ? h * 0.5 : 0;

      if (showWave) {
        an.getFloatTimeDomainData(timeBuf);
        // Trigger on a rising zero crossing so periodic waves stand still
        let start = 0;
        for (let i = 1; i < timeBuf.length / 2; i++) {
          if (timeBuf[i - 1] < 0 && timeBuf[i] >= 0) { start = i; break; }
        }
        const span = 1024;
        g.strokeStyle = 'rgba(80,255,120,0.12)';
        g.beginPath();
        g.moveTo(0, waveH / 2);
        g.lineTo(w, waveH / 2);
        g.stroke();
        g.strokeStyle = '#4ade80';
        g.lineWidth = 1.5;
        g.beginPath();
        for (let i = 0; i < span; i++) {
          const v = timeBuf[start + i] ?? 0;
          const x = (i / span) * w;
          const y = waveH / 2 - v * (waveH / 2) * 0.9;
          if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
        }
        g.stroke();
      }

      if (showSpec) {
        an.getFloatFrequencyData(freqBuf);
        const sr = an.context.sampleRate;
        const binHz = sr / 2 / freqBuf.length;
        const fMin = 30, fMax = 16000;
        const specH = h - specTop;
        g.fillStyle = 'rgba(56,189,248,0.85)';
        const cols = Math.floor(w / 3);
        for (let c = 0; c < cols; c++) {
          const f = fMin * Math.pow(fMax / fMin, c / cols);
          const bin = Math.min(freqBuf.length - 1, Math.round(f / binHz));
          const db = freqBuf[bin];
          const norm = Math.max(0, Math.min(1, (db + 100) / 80));
          const bh = norm * (specH - 10);
          g.fillRect(c * 3, specTop + specH - bh, 2, bh);
        }
        g.fillStyle = 'rgba(255,255,255,0.35)';
        g.font = '9px ui-monospace, monospace';
        [100, 1000, 10000].forEach(f => {
          const x = (Math.log(f / fMin) / Math.log(fMax / fMin)) * w;
          g.fillText(f >= 1000 ? `${f / 1000}k` : `${f}`, x + 2, h - 2);
        });
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [mode]);

  return (
    <div className="relative">
      <canvas ref={canvasRef} className="w-full rounded border border-[#1d2a1d]" style={{ height }} aria-label="Oscilloscope and spectrum of the output" role="img" />
      <div className="absolute top-1 right-1 flex gap-1">
        {(['wave', 'spectrum', 'both'] as const).map(m => (
          <button key={m} onClick={() => setMode(m)} className={`px-1.5 py-0.5 rounded text-[9px] ${mode === m ? 'bg-green-700 text-white' : 'bg-black/60 text-gray-400'}`}>
            {m}
          </button>
        ))}
      </div>
    </div>
  );
}
