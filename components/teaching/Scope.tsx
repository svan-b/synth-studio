'use client';

import { useEffect, useRef, useState } from 'react';
import { getAudioContext, getMasterAnalyser, getRecordTap } from '@/lib/audio/context';

export type ScopeMode = 'wave' | 'spectrum' | 'both';

const F_MIN = 20;
const F_MAX = 20000;
const DB_MAX = 0;
const DB_MIN = -96;
const FREQ_GRID = [50, 100, 200, 500, 1000, 2000, 5000, 10000];
const FREQ_LABELS = new Set([100, 1000, 10000]);
const DB_GRID = [-12, -24, -36, -48, -60, -72, -84];
const DB_LABELS = new Set([-24, -48, -72]);

const xOfFreq = (f: number, w: number) => (Math.log(f / F_MIN) / Math.log(F_MAX / F_MIN)) * w;

/**
 * Oscilloscope + spectrum of the studio output. Seeing a filter remove harmonics
 * *while* hearing it is the fastest way to understand timbre (dual coding: the same
 * idea through ear and eye).
 *
 *   wave      the waveform, triggered on a rising zero crossing so it stands still
 *   spectrum  level by frequency: log frequency axis (20 Hz - 20 kHz), dB scale,
 *             with a slowly falling peak line - for EQ and filter work
 *   both      waveform above, spectrum below
 *
 * `stepMode` (a lesson step's `scope`) switches the view when the step begins; the
 * learner can still change it.
 */
export default function Scope({ height = 120, mode: initial = 'both', stepMode }: { height?: number; mode?: ScopeMode; stepMode?: ScopeMode }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<ScopeMode>(stepMode ?? initial);

  // A step that asks for a view gets it when it begins
  useEffect(() => { if (stepMode) setMode(stepMode); }, [stepMode]);

  useEffect(() => {
    let raf = 0;
    const timeBuf = new Float32Array(2048);
    let spec: AnalyserNode | null = null;
    let tap: AudioNode | null = null;
    let freqBuf: Float32Array<ArrayBuffer> | null = null;
    let peaks: Float32Array | null = null;
    let lastT = performance.now();
    const showSpec = mode !== 'wave';
    if (showSpec) {
      // A dedicated high-resolution analyser (8192-point FFT: ~6 Hz bins, so bass is readable)
      try {
        const ctx = getAudioContext();
        tap = getRecordTap();
        spec = ctx.createAnalyser();
        spec.fftSize = 8192;
        spec.smoothingTimeConstant = 0.72;
        spec.minDecibels = DB_MIN;
        spec.maxDecibels = DB_MAX;
        tap.connect(spec);
        freqBuf = new Float32Array(spec.frequencyBinCount);
      } catch {
        spec = null;
      }
    }

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      const g = canvas.getContext('2d');
      if (!g) return;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = '#060a06';
      g.fillRect(0, 0, w, h);
      const showWave = mode !== 'spectrum';
      const both = showWave && showSpec;
      const waveH = both ? Math.round(h * 0.42) : h;
      const specTop = both ? waveH : 0;
      const an = getMasterAnalyser();

      if (showWave) {
        g.strokeStyle = 'rgba(80,255,120,0.14)';
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(0, waveH / 2);
        g.lineTo(w, waveH / 2);
        g.stroke();
        if (an) {
          an.getFloatTimeDomainData(timeBuf);
          // Trigger on a rising zero crossing so periodic waves stand still
          let start = 0;
          for (let i = 1; i < timeBuf.length / 2; i++) {
            if (timeBuf[i - 1] < 0 && timeBuf[i] >= 0) { start = i; break; }
          }
          const span = 1024;
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
      }

      if (showSpec) {
        const specH = h - specTop;
        const plotTop = specTop + 3;
        const plotH = specH - 14;
        const yOf = (db: number) => plotTop + ((DB_MAX - Math.max(DB_MIN, Math.min(DB_MAX, db))) / (DB_MAX - DB_MIN)) * plotH;
        if (both) {
          g.fillStyle = 'rgba(255,255,255,0.06)';
          g.fillRect(0, specTop, w, 1);
        }
        // Grid: decades and octaves of frequency, 12 dB steps of level
        g.lineWidth = 1;
        g.font = '9px ui-monospace, Menlo, monospace';
        FREQ_GRID.forEach(f => {
          const x = Math.round(xOfFreq(f, w)) + 0.5;
          g.strokeStyle = FREQ_LABELS.has(f) ? 'rgba(148,197,255,0.22)' : 'rgba(148,197,255,0.1)';
          g.beginPath();
          g.moveTo(x, plotTop);
          g.lineTo(x, plotTop + plotH);
          g.stroke();
        });
        DB_GRID.forEach(db => {
          const y = Math.round(yOf(db)) + 0.5;
          g.strokeStyle = DB_LABELS.has(db) ? 'rgba(148,197,255,0.18)' : 'rgba(148,197,255,0.07)';
          g.beginPath();
          g.moveTo(0, y);
          g.lineTo(w, y);
          g.stroke();
        });

        if (spec && freqBuf) {
          spec.getFloatFrequencyData(freqBuf);
          const binHz = spec.context.sampleRate / spec.fftSize;
          const cols = Math.max(2, Math.floor(w));
          if (!peaks || peaks.length !== cols) peaks = new Float32Array(cols).fill(DB_MIN);
          const now = performance.now();
          const fall = ((now - lastT) / 1000) * 18; // peak line falls 18 dB a second
          lastT = now;
          const level = new Float32Array(cols);
          for (let c = 0; c < cols; c++) {
            const f0 = F_MIN * Math.pow(F_MAX / F_MIN, c / cols);
            const f1 = F_MIN * Math.pow(F_MAX / F_MIN, (c + 1) / cols);
            const b0 = f0 / binHz;
            const b1 = f1 / binHz;
            let db: number;
            if (b1 - b0 < 1) {
              // Fewer bins than pixels (the bass end): interpolate between bins
              const i = Math.floor(b0);
              const t = b0 - i;
              const a = freqBuf[Math.min(freqBuf.length - 1, i)];
              const b = freqBuf[Math.min(freqBuf.length - 1, i + 1)];
              db = a + (b - a) * t;
            } else {
              // Several bins per pixel: the loudest one
              db = DB_MIN;
              for (let i = Math.floor(b0); i <= Math.min(freqBuf.length - 1, Math.ceil(b1)); i++) if (freqBuf[i] > db) db = freqBuf[i];
            }
            if (!Number.isFinite(db)) db = DB_MIN;
            level[c] = db;
            peaks[c] = Math.max(db, peaks[c] - fall);
          }
          // Filled curve
          const grad = g.createLinearGradient(0, plotTop, 0, plotTop + plotH);
          grad.addColorStop(0, 'rgba(56,189,248,0.55)');
          grad.addColorStop(1, 'rgba(56,189,248,0.05)');
          g.beginPath();
          g.moveTo(0, plotTop + plotH);
          for (let c = 0; c < cols; c++) g.lineTo((c / cols) * w, yOf(level[c]));
          g.lineTo(w, plotTop + plotH);
          g.closePath();
          g.fillStyle = grad;
          g.fill();
          g.beginPath();
          for (let c = 0; c < cols; c++) {
            const x = (c / cols) * w;
            if (c === 0) g.moveTo(x, yOf(level[c])); else g.lineTo(x, yOf(level[c]));
          }
          g.strokeStyle = 'rgba(125,211,252,0.95)';
          g.lineWidth = 1.25;
          g.stroke();
          // Peak hold
          g.beginPath();
          for (let c = 0; c < cols; c++) {
            const x = (c / cols) * w;
            if (c === 0) g.moveTo(x, yOf(peaks[c])); else g.lineTo(x, yOf(peaks[c]));
          }
          g.strokeStyle = 'rgba(253,230,138,0.55)';
          g.lineWidth = 1;
          g.stroke();
        }

        // Axis labels (level labels only where there is room for them)
        g.fillStyle = 'rgba(226,232,240,0.62)';
        FREQ_GRID.forEach(f => {
          if (!FREQ_LABELS.has(f) && w < 420) return;
          const x = xOfFreq(f, w);
          g.fillText(f >= 1000 ? `${f / 1000}k` : `${f}`, x + 2, h - 3);
        });
        g.fillText('Hz', w - 16, h - 3);
        const tall = plotH >= 70;
        let lastY = -Infinity;
        DB_GRID.forEach(db => {
          if (!DB_LABELS.has(db) && !tall) return;
          const y = yOf(db) - 2;
          if (y - lastY < 11 || y < plotTop + 8) return;
          g.fillText(`${db} dB`, 2, y);
          lastY = y;
        });
      }
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      if (spec && tap) {
        try { tap.disconnect(spec); } catch { /* already gone */ }
      }
    };
  }, [mode]);

  const label = mode === 'wave'
    ? 'Oscilloscope: the waveform of the output'
    : mode === 'spectrum'
    ? 'Spectrum: output level by frequency, 20 hertz to 20 kilohertz, in decibels'
    : 'Waveform and spectrum of the output';

  return (
    <div className="relative" data-scope-mode={mode}>
      <canvas ref={canvasRef} className="w-full rounded border border-[#1d2a1d] block" style={{ height }} aria-label={label} role="img" />
      <div className="absolute top-1 right-1 flex gap-1" role="group" aria-label="Scope view">
        {(['wave', 'spectrum', 'both'] as const).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            aria-pressed={mode === m}
            className={`px-1.5 py-0.5 rounded text-[10px] leading-tight focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-300 ${mode === m ? 'bg-green-700 text-white' : 'bg-black/70 text-gray-300 hover:text-white'}`}
          >
            {m}
          </button>
        ))}
      </div>
    </div>
  );
}
