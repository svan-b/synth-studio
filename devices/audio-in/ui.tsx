'use client';

// Audio input panel widgets: connection + device chooser + latency, and the meter.

import { useEffect, useRef, useState } from 'react';
import type { CustomRenderContext } from '@/types/panel';
import { hub } from '@/lib/studio/hub';
import { getAudioContext } from '@/lib/audio/context';
import { asInputData } from './config';
import type { AudioInEngine, InputStatus } from './engine';

const ACCENT = '#f59e0b';

const ms = (s: number | null | undefined) => (typeof s === 'number' && Number.isFinite(s) && s > 0 ? Math.round(s * 1000) : null);

/** Audio inputs the browser lists (names appear once access is granted) */
function useAudioInputs(refresh: unknown): MediaDeviceInfo[] {
  const [list, setList] = useState<MediaDeviceInfo[]>([]);
  useEffect(() => {
    const md = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined;
    if (!md?.enumerateDevices) return;
    let alive = true;
    const load = () => md.enumerateDevices()
      .then(all => { if (alive) setList(all.filter(d => d.kind === 'audioinput')); })
      .catch(() => undefined);
    void load();
    md.addEventListener?.('devicechange', load);
    return () => { alive = false; md.removeEventListener?.('devicechange', load); };
  }, [refresh]);
  return list;
}

/** ctx.baseLatency / ctx.outputLatency, refreshed every second (outputLatency can change) */
function useOutputLatency() {
  const [lat, setLat] = useState<{ base: number | null; out: number | null }>({ base: null, out: null });
  useEffect(() => {
    const read = () => {
      try {
        const c = getAudioContext() as AudioContext & { outputLatency?: number };
        setLat({ base: ms(c.baseLatency), out: ms(c.outputLatency) });
      } catch { /* no audio yet */ }
    };
    read();
    const id = setInterval(read, 1000);
    return () => clearInterval(id);
  }, []);
  return lat;
}

export function InputPanel(ctx: CustomRenderContext) {
  const data = asInputData(ctx.data);
  const status = (ctx.engine.status as InputStatus | undefined) ?? 'off';
  const error = ctx.engine.error as string | null | undefined;
  const live = status === 'live';
  const devices = useAudioInputs(status);
  const lat = useOutputLatency();
  const inLat = ms(ctx.engine.inputLatency as number | null | undefined);
  const supported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

  const connect = (deviceId: string | null, label: string | null) => {
    ctx.updateData(() => ({ v: 1, enabled: true, deviceId, label }));
    ctx.sendEvent('connect');
  };
  const disconnect = () => ctx.updateData(() => ({ ...data, enabled: false }));

  const dot = live ? '#22c55e' : status === 'error' ? '#ef4444' : status === 'connecting' ? ACCENT : '#6b6b6b';
  const label = live
    ? String(ctx.engine.deviceLabel ?? 'Audio input')
    : status === 'connecting' ? 'Connecting…'
      : status === 'needs-permission' ? 'Press Connect to allow audio input'
        : status === 'error' ? 'Not connected' : 'Not connected';
  const selected = data.deviceId && devices.some(d => d.deviceId === data.deviceId) ? data.deviceId : '';
  const roundTrip = [inLat, lat.base, lat.out].every(v => v !== null) ? (inLat ?? 0) + (lat.base ?? 0) + (lat.out ?? 0) : null;

  return (
    <div className="w-full h-full rounded flex flex-col gap-1 px-1.5 py-1" style={{ background: 'rgba(0,0,0,0.45)', border: '1px solid #3b3326', fontSize: 10, color: '#e8e2d6' }}>
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="inline-block rounded-full shrink-0" style={{ width: 8, height: 8, background: dot, boxShadow: live ? `0 0 6px ${dot}` : undefined }} />
        <span className="font-bold truncate" style={{ fontSize: 11 }}>{label}</span>
        {live && (
          <span className="ml-auto shrink-0 font-mono" style={{ color: '#a89f8c' }}>
            {ctx.engine.sampleRate ? `${Math.round(Number(ctx.engine.sampleRate) / 100) / 10} kHz · ` : ''}{Number(ctx.engine.channels) === 1 ? 'mono' : `${ctx.engine.channels ?? 2} ch`}
          </span>
        )}
      </div>
      {supported ? (
        <div className="flex items-center gap-1 min-w-0">
          <select
            value={selected}
            onChange={e => {
              const d = devices.find(x => x.deviceId === e.target.value);
              connect(d?.deviceId || null, d?.label || null);
            }}
            className="min-w-0 flex-1 rounded px-1 py-0.5"
            style={{ fontSize: 10, background: '#16130e', color: '#e8e2d6', border: '1px solid #4a3f2c' }}
            aria-label="Audio input device"
          >
            <option value="">Default input</option>
            {devices.filter(d => d.deviceId && d.deviceId !== 'default').map((d, i) => (
              <option key={d.deviceId} value={d.deviceId}>{d.label || `Input ${i + 1}`}</option>
            ))}
          </select>
          {live || status === 'connecting' ? (
            <button onClick={disconnect} className="shrink-0 rounded px-2 py-0.5 font-bold" style={{ fontSize: 10, background: '#2b251b', color: '#e8e2d6', border: '1px solid #4a3f2c' }}>
              Disconnect
            </button>
          ) : (
            <button onClick={() => connect(data.deviceId, data.label)} className="shrink-0 rounded px-2 py-0.5 font-bold" style={{ fontSize: 10, background: ACCENT, color: '#1b1306' }}>
              Connect
            </button>
          )}
        </div>
      ) : (
        <div style={{ color: '#fca5a5' }}>This browser cannot open audio inputs (it needs https:// and a current browser).</div>
      )}
      {error ? (
        <div className="leading-snug" style={{ color: '#fca5a5' }}>{error}</div>
      ) : (
        <div className="font-mono leading-snug" style={{ color: '#a89f8c' }} title="Input latency is reported by Chrome; base + output latency by every browser that supports them">
          latency in {inLat ?? '?'} ms · out {lat.out ?? '?'} ms (base {lat.base ?? '?'} ms)
          {roundTrip !== null ? ` · ≈${roundTrip} ms round trip` : ''}
        </div>
      )}
    </div>
  );
}

/** L/R peak meter. Polls the engine every frame without re-rendering React. */
export function Meter({ instance }: { instance: string }) {
  const lRef = useRef<HTMLDivElement>(null);
  const rRef = useRef<HTMLDivElement>(null);
  const clipRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const held = { l: 0, r: 0 };
    const bar = (el: HTMLDivElement | null, v: number) => {
      if (!el) return;
      // -48..0 dBFS scale
      const db = v > 0 ? 20 * Math.log10(v) : -96;
      const pct = Math.max(0, Math.min(100, ((db + 48) / 48) * 100));
      el.style.width = `${pct}%`;
      el.style.background = db > -1 ? '#ef4444' : db > -9 ? '#eab308' : '#22c55e';
    };
    const tick = () => {
      const engine = hub.getEngine(instance) as AudioInEngine | undefined;
      const lv = engine && typeof engine.levels === 'function' ? engine.levels() : { l: 0, r: 0, clip: false };
      held.l = Math.max(lv.l, held.l * 0.92);
      held.r = Math.max(lv.r, held.r * 0.92);
      bar(lRef.current, held.l);
      bar(rRef.current, held.r);
      if (clipRef.current) clipRef.current.style.background = lv.clip ? '#ef4444' : '#3a1414';
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [instance]);

  return (
    <div className="w-full h-full flex items-center gap-1.5 select-none" aria-label="Input level meter" role="img">
      <div className="flex-1 flex flex-col gap-1">
        {(['L', 'R'] as const).map(ch => (
          <div key={ch} className="flex items-center gap-1">
            <span className="font-bold" style={{ fontSize: 8, color: '#a89f8c', width: 7 }}>{ch}</span>
            <div className="relative flex-1 rounded-sm overflow-hidden" style={{ height: 9, background: '#0d0b08', border: '1px solid #3b3326' }}>
              <div ref={ch === 'L' ? lRef : rRef} className="absolute inset-y-0 left-0" style={{ width: 0 }} data-meter={ch} />
              {[-36, -24, -12, -6].map(db => (
                <div key={db} className="absolute inset-y-0" style={{ left: `${((db + 48) / 48) * 100}%`, width: 1, background: 'rgba(255,255,255,0.18)' }} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-col items-center" title="Clip: the signal hit 0 dBFS - turn GAIN (or the interface gain) down">
        <div ref={clipRef} className="rounded-full" style={{ width: 10, height: 10, background: '#3a1414' }} />
        <span className="font-bold" style={{ fontSize: 7, color: '#a89f8c' }}>CLIP</span>
      </div>
    </div>
  );
}
