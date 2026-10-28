'use client';

// ============================================================================
// /bench - DSP benchmark (see docs/DSP.md, scripts/bench.cjs)
//
// Renders every registered instrument and every shared processor offline at
// 48 kHz, with the DSP core before the upgrade and after it, and reports the
// realtime factor (seconds of audio per second of CPU), the per-instance cost
// and the output peak. Results are published on window.__benchResults.
//
// Query string: ?auto=1 runs on load; ?only=devices|processors;
// ?devices=dfam,sub37 and ?scenarios=vco,ladder pick a subset; ?reps=3.
// Open it on the iPad to measure the target device itself.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { DEVICES } from '@/devices';
import type { DeviceModule } from '@/devices/types';
import {
  SCENARIOS, SECONDS, SR, measureFramework, runDevice, runScenario,
  type BenchResults, type DeviceRun, type ProcRun, type Variant,
} from './runner';

declare global {
  interface Window { __benchResults?: BenchResults }
}

const VARIANTS: Variant[] = ['before', 'after'];

function emptyResults(): BenchResults {
  return {
    status: 'idle', progress: '', sampleRate: SR, seconds: SECONDS,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    startedAt: '', framework: { emptyMs: 0, suspendMs: 0, suspends: 0 },
    devices: [], processors: [], errors: [],
  };
}

interface Options { only?: 'devices' | 'processors'; devices?: string[]; scenarios?: string[]; reps: number }

function readOptions(): { auto: boolean; opts: Options } {
  const q = new URLSearchParams(window.location.search);
  const list = (k: string) => (q.get(k) ? q.get(k)!.split(',').map(s => s.trim()).filter(Boolean) : undefined);
  const only = q.get('only');
  return {
    auto: q.get('auto') === '1',
    opts: {
      only: only === 'devices' || only === 'processors' ? only : undefined,
      devices: list('devices'),
      scenarios: list('scenarios'),
      reps: Math.max(1, Math.min(10, Number(q.get('reps')) || 3)),
    },
  };
}

const fmt = (v: number, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '-');

export default function BenchPage() {
  const [res, setRes] = useState<BenchResults>(emptyResults);
  const [opts, setOpts] = useState<Options>({ reps: 3 });
  const running = useRef(false);

  const publish = useCallback((r: BenchResults) => {
    const copy = { ...r, devices: [...r.devices], processors: [...r.processors], errors: [...r.errors] };
    window.__benchResults = copy;
    setRes(copy);
  }, []);

  const run = useCallback(async (o: Options) => {
    if (running.current) return;
    running.current = true;
    const r = emptyResults();
    r.status = 'running';
    r.startedAt = new Date().toISOString();
    const onError = (e: ErrorEvent | PromiseRejectionEvent) => {
      r.errors.push('reason' in e ? String(e.reason) : e.message);
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onError);
    try {
      r.progress = 'framework overhead';
      publish(r);
      r.framework = await measureFramework();

      if (o.only !== 'processors') {
        const entries = DEVICES.filter(d => !o.devices || o.devices.includes(d.id));
        for (const entry of entries) {
          let mod: DeviceModule;
          try {
            mod = (await entry.load()).default;
          } catch (e) {
            r.errors.push(`${entry.id}: failed to load (${String(e)})`);
            continue;
          }
          for (const v of VARIANTS) {
            r.progress = `device ${entry.id} (${v})`;
            publish(r);
            r.devices.push(await runDevice(entry, mod, v, o.reps));
          }
        }
      }

      if (o.only !== 'devices') {
        const list = SCENARIOS.filter(s => !o.scenarios || o.scenarios.includes(s.id));
        for (const s of list) {
          for (const v of VARIANTS) {
            if (v === 'before' && s.afterOnly) continue;
            r.progress = `processor ${s.id} (${v})`;
            publish(r);
            r.processors.push(await runScenario(s, v, o.reps));
          }
        }
      }
      r.status = 'done';
      r.progress = '';
    } catch (e) {
      r.status = 'error';
      r.errors.push(e instanceof Error ? e.message : String(e));
    } finally {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onError);
      r.finishedAt = new Date().toISOString();
      publish(r);
      running.current = false;
    }
  }, [publish]);

  useEffect(() => {
    const { auto, opts: o } = readOptions();
    setOpts(o);
    window.__benchResults = emptyResults();
    if (auto) void run(o);
  }, [run]);

  const deviceIds = Array.from(new Set(res.devices.map(d => d.device)));
  const procIds = Array.from(new Set(res.processors.map(p => p.id)));
  const dev = (id: string, v: Variant) => res.devices.find(d => d.device === id && d.variant === v);
  const proc = (id: string, v: Variant) => res.processors.find(p => p.id === id && p.variant === v);

  return (
    <main className="min-h-screen bg-hardware-bg text-gray-100 px-4 py-6 md:px-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-semibold">DSP benchmark</h1>
        <p className="text-sm text-gray-400 mt-1 max-w-3xl">
          Offline renders at {SR / 1000} kHz, {SECONDS} s each, best of {opts.reps}. Realtime factor = seconds of audio per
          second of CPU (higher is better). &ldquo;Before&rdquo; is the original DSP core, &ldquo;after&rdquo; the upgraded one.
          Open this page on the iPad to measure it there.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void run(opts)}
            disabled={res.status === 'running'}
            className="px-5 py-3 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 font-medium"
          >
            {res.status === 'running' ? 'Running…' : 'Run benchmark'}
          </button>
          <span className="text-sm text-gray-400" aria-live="polite">
            {res.status === 'running' ? `Rendering ${res.progress}` : res.status === 'done' ? `Done (${res.finishedAt})` : ''}
          </span>
        </div>

        {res.framework.emptyMs > 0 && (
          <p className="text-xs text-gray-500 mt-3">
            Framework: an empty {SECONDS} s render takes {fmt(res.framework.emptyMs)} ms; with the {res.framework.suspends} scheduling
            suspends used by the device runs, {fmt(res.framework.suspendMs)} ms.
          </p>
        )}

        {deviceIds.length > 0 && (
          <section className="mt-6">
            <h2 className="text-lg font-semibold">Instruments</h2>
            <div className="overflow-x-auto">
              <table className="mt-2 text-sm w-full min-w-[720px]">
                <thead className="text-gray-400 text-left">
                  <tr>
                    <th className="py-1 pr-3">Instrument</th><th className="pr-3">Demo</th>
                    <th className="pr-3 text-right">Before ×RT</th><th className="pr-3 text-right">After ×RT</th>
                    <th className="pr-3 text-right">Speed-up</th><th className="pr-3 text-right">Peak (before / after)</th>
                    <th className="pr-3">Worklet nodes</th>
                  </tr>
                </thead>
                <tbody>
                  {deviceIds.map(id => {
                    const b = dev(id, 'before'), a = dev(id, 'after');
                    const any = a ?? b;
                    const nodes = Object.entries(any?.worklets ?? {}).map(([k, n]) => `${k} ${n}`).join(', ');
                    return (
                      <tr key={id} className="border-t border-white/10">
                        <td className="py-1 pr-3">{any?.name}</td>
                        <td className="pr-3 text-gray-400">{any?.demo}</td>
                        <td className="pr-3 text-right tabular-nums">{b?.ok ? `${fmt(b.realtime)} (${fmt(b.renderMs, 0)} ms)` : b?.error ?? '-'}</td>
                        <td className="pr-3 text-right tabular-nums">{a?.ok ? `${fmt(a.realtime)} (${fmt(a.renderMs, 0)} ms)` : a?.error ?? '-'}</td>
                        <td className="pr-3 text-right tabular-nums">{a?.ok && b?.ok ? `${fmt(a.realtime / b.realtime, 2)}×` : '-'}</td>
                        <td className="pr-3 text-right tabular-nums">{fmt(b?.peak ?? NaN, 3)} / {fmt(a?.peak ?? NaN, 3)}</td>
                        <td className="pr-3 text-gray-400 text-xs">{nodes || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {procIds.length > 0 && (
          <section className="mt-6">
            <h2 className="text-lg font-semibold">Processors (cost of one instance)</h2>
            <div className="overflow-x-auto">
              <table className="mt-2 text-sm w-full min-w-[720px]">
                <thead className="text-gray-400 text-left">
                  <tr>
                    <th className="py-1 pr-3">Scenario</th><th className="pr-3 text-right">N</th>
                    <th className="pr-3 text-right">Before ns/sample</th><th className="pr-3 text-right">After ns/sample</th>
                    <th className="pr-3 text-right">Speed-up</th><th className="pr-3 text-right">After % of a core</th>
                    <th className="pr-3">Before is</th>
                  </tr>
                </thead>
                <tbody>
                  {procIds.map(id => {
                    const b: ProcRun | undefined = proc(id, 'before'), a = proc(id, 'after');
                    const any = a ?? b;
                    return (
                      <tr key={id} className="border-t border-white/10">
                        <td className="py-1 pr-3">{any?.label}</td>
                        <td className="pr-3 text-right tabular-nums">{any?.instances}</td>
                        <td className="pr-3 text-right tabular-nums">{b ? (b.ok ? fmt(b.nsPerSample) : b.error) : 'new'}</td>
                        <td className="pr-3 text-right tabular-nums">{a ? (a.ok ? fmt(a.nsPerSample) : a.error) : '-'}</td>
                        <td className="pr-3 text-right tabular-nums">{a?.ok && b?.ok && a.nsPerSample > 0 ? `${fmt(b.nsPerSample / a.nsPerSample, 2)}×` : '-'}</td>
                        <td className="pr-3 text-right tabular-nums">{a?.ok ? `${fmt(a.corePct, 2)}%` : '-'}</td>
                        <td className="pr-3 text-gray-400 text-xs">{b && b.processor !== a?.processor ? b.processor : b ? 'same processor' : ''}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {res.errors.length > 0 && (
          <section className="mt-6">
            <h2 className="text-lg font-semibold text-red-400">Errors</h2>
            <ul className="text-sm text-red-300 list-disc pl-5">
              {res.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </section>
        )}
        {res.devices.some(d => d.timerErrors.length) && (
          <section className="mt-4 text-xs text-amber-300">
            {res.devices.filter(d => d.timerErrors.length).map(d => (
              <p key={`${d.device}-${d.variant}`}>{d.device} ({d.variant}): {d.timerErrors.join('; ')}</p>
            ))}
          </section>
        )}
        <p className="text-xs text-gray-600 mt-8 break-all">{res.userAgent}</p>
      </div>
    </main>
  );
}
