'use client';

// ============================================================================
// Audio input panel widgets:
//   InputHeader   name (also the rack name), status, Connect / Disconnect
//   SourcePicker  interface or mic / Practice synth / test tone, and the device
//   LatencyBox    input + output + base latency, round trip, what to do about it
//   Meter         input and post-GAIN peaks, target zone, peak readout, CLIP latch
//   LevelCheck    listen for a few seconds, judge the level, suggest GAIN
//   RouteRecord   where it goes (master or a mixer channel) and record a take
// Touch targets are at least 44 px at the panel's native size.
// ============================================================================

import { useEffect, useRef, useState } from 'react';
import type { CustomRenderContext } from '@/types/panel';
import { DEVICES } from '@/devices';
import { hub } from '@/lib/studio/hub';
import { useStudioStore } from '@/store/studio';
import { getAudioContext } from '@/lib/audio/context';
import { transport } from '@/lib/audio/transport';
import {
  MODES, TARGET_DBFS, TARGET_ZONE, TONE_DBFS, asInputData, inputLabel, judgeLevel, toDb,
  type AudioInData, type InputSource,
} from './config';
import type { AudioInEngine, InputStatus } from './engine';

const ACCENT = '#f59e0b';
const METER_MIN = -60;

const ms = (s: number | null | undefined) => (typeof s === 'number' && Number.isFinite(s) && s >= 0 ? Math.round(s * 1000) : null);
const engineOf = (instance: string) => hub.getEngine(instance) as AudioInEngine | undefined;
const lit = (ctx: CustomRenderContext, id: string) => !!ctx.step?.focus?.includes(id);
const glow = (on: boolean) => (on ? { boxShadow: '0 0 0 3px #facc15, 0 0 18px rgba(250,204,21,0.6)' } : undefined);
const pctOf = (db: number) => Math.max(0, Math.min(100, ((db - METER_MIN) / -METER_MIN) * 100));

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

const supportsDevices = () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
const modeLabel = (ctx: CustomRenderContext) => MODES[Math.round(Number(ctx.values.mode ?? 0))] ?? 'IN 1';

function defaultRackName(instance: string) {
  const base = DEVICES.find(d => d.id === 'audio-in')?.name ?? 'Audio input';
  return instance.includes('#') ? `${base} ${instance.split('#')[1]}` : base;
}

/** Name the rack tab (and every routing menu) after what this input plays */
function useRackLabel(instance: string, data: AudioInData, mode: string) {
  const current = useStudioStore(s => s.studio.rack.find(r => r.id === instance)?.label);
  const wanted = inputLabel(data, mode) ?? defaultRackName(instance);
  useEffect(() => {
    const st = useStudioStore.getState();
    const slot = st.studio.rack.find(r => r.id === instance);
    if (!slot) return;
    if ((slot.label ?? defaultRackName(instance)) !== wanted) st.renameInstance(instance, wanted);
  }, [instance, wanted, current]);
}

/** Turn this input on with a source (and device) - from a click, so the browser may ask */
function connectTo(ctx: CustomRenderContext, source: InputSource, deviceId?: string | null, label?: string | null) {
  ctx.updateData(d => {
    const cur = asInputData(d);
    return { ...cur, enabled: true, source, deviceId: deviceId === undefined ? cur.deviceId : deviceId, label: label === undefined ? cur.label : label };
  });
  ctx.sendEvent('connect');
}

// ----------------------------------------------------------------------------
// Header
// ----------------------------------------------------------------------------

export function InputHeader(ctx: CustomRenderContext) {
  const data = asInputData(ctx.data);
  const status = (ctx.engine.status as InputStatus | undefined) ?? 'off';
  const error = ctx.engine.error as string | null | undefined;
  const live = status === 'live' && data.enabled;
  const mode = modeLabel(ctx);
  useRackLabel(ctx.instance, data, mode);
  const [editing, setEditing] = useState(false);
  // Remember the interface's real name (the "Default input" has none in the data), so the rack names it
  const liveLabel = live && data.source === 'device' ? String(ctx.engine.deviceLabel ?? '') : '';
  useEffect(() => {
    if (!liveLabel || data.label === liveLabel) return;
    ctx.updateData(d => ({ ...asInputData(d), label: liveLabel }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveLabel]);
  const title = data.name ?? inputLabel(data, mode) ?? 'Audio input';

  const dot = live ? '#22c55e' : status === 'error' ? '#ef4444' : status === 'connecting' ? ACCENT : '#6b6b6b';
  let line: string;
  if (live) {
    const sr = ctx.engine.sampleRate ? `${Math.round(Number(ctx.engine.sampleRate) / 100) / 10} kHz · ` : '';
    const ch = Number(ctx.engine.channels) === 1 ? 'mono' : 'stereo';
    line = `${String(ctx.engine.deviceLabel ?? 'Audio input')} · ${sr}${ch}`;
  } else if (status === 'connecting') line = 'Connecting… (the browser may ask to use your microphone or interface)';
  else if (status === 'needs-permission') line = 'Press Connect to allow audio input';
  else if (status === 'error') line = error ?? 'Not connected';
  else line = 'Off. Choose a source below, or press Connect for your interface.';

  return (
    <div className="w-full h-full flex items-center gap-2 px-2 rounded" style={{ background: 'rgba(0,0,0,0.45)', border: '1px solid #3b3326', color: '#f3ead8' }}>
      <span className="inline-block rounded-full shrink-0" style={{ width: 10, height: 10, background: dot, boxShadow: live ? `0 0 6px ${dot}` : undefined }} />
      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            autoFocus
            defaultValue={data.name ?? ''}
            placeholder={inputLabel({ ...data, name: null }, mode) ?? 'Audio input'}
            maxLength={40}
            aria-label="Name this input"
            className="w-full rounded px-1.5 font-bold"
            style={{ fontSize: 15, height: 30, background: '#16130e', color: '#f3ead8', border: '1px solid #4a3f2c' }}
            onBlur={e => { const name = e.target.value.trim() || null; ctx.updateData(d => ({ ...asInputData(d), name })); setEditing(false); }}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditing(false); }}
          />
        ) : (
          <div className="font-bold truncate max-w-full" style={{ fontSize: 16 }}>{title}</div>
        )}
        <div className="truncate leading-tight" style={{ fontSize: 11, color: status === 'error' ? '#fca5a5' : '#c9bfa9' }} title={line} data-testid="audio-in-status">{line}</div>
      </div>
      <HeaderButton onClick={() => setEditing(e => !e)} label="Rename this input (its name in the rack and in routing menus)">✎</HeaderButton>
      {live || status === 'connecting' ? (
        <HeaderButton onClick={() => ctx.updateData(d => ({ ...asInputData(d), enabled: false }))}>Disconnect</HeaderButton>
      ) : (
        <HeaderButton accent onClick={() => connectTo(ctx, data.source)} style={glow(lit(ctx, 'connect'))}>Connect</HeaderButton>
      )}
    </div>
  );
}

function HeaderButton({ children, onClick, accent, style, disabled, label }: { children: React.ReactNode; onClick: () => void; accent?: boolean; style?: React.CSSProperties; disabled?: boolean; label?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="shrink-0 rounded font-bold whitespace-nowrap disabled:opacity-40"
      style={{ fontSize: 13, minHeight: 46, minWidth: 46, padding: '0 14px', color: accent ? '#1b1306' : '#f3ead8', background: accent ? ACCENT : '#2b251b', border: `1px solid ${accent ? ACCENT : '#4a3f2c'}`, ...style }}
    >
      {children}
    </button>
  );
}

// ----------------------------------------------------------------------------
// Source
// ----------------------------------------------------------------------------

const SOURCES: { id: InputSource; label: string; hint: string }[] = [
  { id: 'device', label: 'Interface / mic', hint: 'Your audio interface (a synth plugged into its inputs) or a microphone' },
  { id: 'practice', label: 'Practice synth', hint: 'The built-in Practice synth: hardware-style audio with no gear' },
  { id: 'tone', label: 'Test tone', hint: `1 kHz at ${TONE_DBFS} dBFS: a known level for setting GAIN` },
];

export function SourcePicker(ctx: CustomRenderContext) {
  const data = asInputData(ctx.data);
  const status = (ctx.engine.status as InputStatus | undefined) ?? 'off';
  const devices = useAudioInputs(status);
  const canDevice = supportsDevices();
  const selected = data.deviceId && devices.some(d => d.deviceId === data.deviceId) ? data.deviceId : '';
  const processing = ctx.engine.processing as { echoCancellation: boolean | null; noiseSuppression: boolean | null; autoGainControl: boolean | null } | undefined;
  const voiceOn = processing && (processing.echoCancellation || processing.noiseSuppression || processing.autoGainControl);

  return (
    <div className="w-full h-full flex flex-col gap-1 rounded px-1.5 py-1" style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid #3b3326', ...glow(lit(ctx, 'source')) }}>
      <div className="flex gap-1" role="radiogroup" aria-label="Input source">
        {SOURCES.map(s => {
          const on = data.source === s.id;
          return (
            <button
              key={s.id}
              role="radio"
              aria-checked={on}
              title={s.hint}
              disabled={s.id === 'device' && !canDevice}
              onClick={() => connectTo(ctx, s.id)}
              className="flex-1 rounded font-bold disabled:opacity-40"
              style={{ minHeight: 46, fontSize: 12, color: on ? '#1b1306' : '#f3ead8', background: on ? ACCENT : '#2b251b', border: `1px solid ${on ? ACCENT : '#4a3f2c'}` }}
            >
              {s.label}
            </button>
          );
        })}
      </div>
      {data.source === 'device' ? (
        canDevice ? (
          <div className="flex items-center gap-1 min-w-0">
            <select
              value={selected}
              onChange={e => {
                const d = devices.find(x => x.deviceId === e.target.value);
                connectTo(ctx, 'device', d?.deviceId || null, d?.label || null);
              }}
              className="min-w-0 flex-1 rounded px-1.5"
              style={{ fontSize: 12, height: 46, background: '#16130e', color: '#f3ead8', border: '1px solid #4a3f2c' }}
              aria-label="Audio input device"
            >
              <option value="">Default input</option>
              {devices.filter(d => d.deviceId && d.deviceId !== 'default').map((d, i) => (
                <option key={d.deviceId} value={d.deviceId}>{d.label || `Input ${i + 1} (names appear after Connect)`}</option>
              ))}
            </select>
            <span className="shrink-0 leading-tight" style={{ fontSize: 10, color: voiceOn ? '#fca5a5' : '#a89f8c' }} title="Echo cancellation, noise suppression and auto gain are for voice calls: they would pump, gate and colour a synth">
              {voiceOn ? 'voice processing ON' : 'voice processing off'}
            </span>
          </div>
        ) : (
          <div className="leading-snug" style={{ fontSize: 11, color: '#fca5a5' }}>This page cannot open audio inputs (it needs https:// and a current browser). The Practice synth and the test tone work.</div>
        )
      ) : (
        <div className="leading-snug" style={{ fontSize: 11, color: '#c9bfa9' }}>
          {data.source === 'practice'
            ? 'The Practice synth\'s audio, as if its output were cabled into your interface. Play it from Your synth (MIDI).'
            : `A steady 1 kHz sine peaking at ${TONE_DBFS} dBFS, like the line-up tone in a studio. Use it to see what GAIN does.`}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// MODE: how your synth is cabled to the interface
// ----------------------------------------------------------------------------

const MODE_HINTS = ['Input 1, in the middle (a mono synth)', 'Input 2, in the middle', 'Inputs 1 and 2 summed, in the middle', 'Input 1 left, input 2 right (a stereo synth)'];

export function ModeSelector(ctx: CustomRenderContext) {
  const mode = Math.round(Number(ctx.values.mode ?? 0));
  const mono = Number(ctx.engine.channels) === 1;
  const step = ctx.step;
  const target = step?.control === 'mode' && typeof step.targetValue === 'number' ? step.targetValue : null;
  return (
    <div className="w-full h-full flex flex-col select-none rounded" style={glow(target !== null && mode !== target)}>
      <div className="font-bold text-center leading-none mb-1" style={{ fontSize: 10, color: '#b3a585' }}>MODE</div>
      <div className="grid grid-cols-2 gap-1 flex-1" role="radiogroup" aria-label="MODE: which inputs play">
        {MODES.map((m, i) => {
          const on = i === mode;
          return (
            <button
              key={m}
              role="radio"
              aria-checked={on}
              title={MODE_HINTS[i]}
              onClick={() => ctx.setValue('mode', i)}
              className="rounded font-bold"
              style={{
                minHeight: 46, fontSize: 12,
                color: on ? '#1b1306' : mono && i > 0 ? '#6f6656' : '#f3ead8',
                background: on ? '#e8dcc2' : '#2b251b',
                border: `1px solid ${target === i && !on ? '#facc15' : on ? '#e8dcc2' : '#4a3f2c'}`,
              }}
              data-control-mode={i}
            >
              {m}
            </button>
          );
        })}
      </div>
      <div className="text-center leading-tight mt-0.5 truncate" style={{ fontSize: 9, color: '#a89f8c' }}>
        {mono ? 'mono source: every mode plays input 1' : MODE_HINTS[mode]}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Latency
// ----------------------------------------------------------------------------

export function LatencyBox(ctx: CustomRenderContext) {
  const data = asInputData(ctx.data);
  const lat = useOutputLatency();
  const live = ctx.engine.status === 'live' && data.enabled;
  const builtIn = data.source !== 'device';
  const inLat = builtIn ? 0 : ms(ctx.engine.inputLatency as number | null | undefined);
  const muted = !!ctx.values.mute;
  // Parts a browser does not report are "n/a" (Safari before 18.4 has no outputLatency; only Chrome reports input latency)
  const parts = [inLat, lat.base, lat.out];
  const round = parts.every(v => v !== null) ? parts.reduce<number>((a, b) => a + (b ?? 0), 0) : null;
  const known = (inLat ?? 0) + (lat.base ?? 0) + (lat.out ?? 0);
  const na = (v: number | null) => (v === null ? 'n/a' : String(v));
  const missing = [inLat === null && live ? 'input' : '', lat.out === null ? 'output' : ''].filter(Boolean).join(' and ');
  const verdict = round === null
    ? (missing ? `This browser does not report ${missing} latency, so the real total is at least what is shown.` : '')
    : round <= 10 ? 'Feels instant.' : round <= 20 ? 'Fine for most playing.' : 'You may feel it: lower your interface\'s buffer size, or use direct monitoring.';

  return (
    <div className="w-full h-full rounded px-1.5 py-1 flex flex-col justify-between" style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid #3b3326', color: '#e8e2d6', ...glow(lit(ctx, 'latency')) }}>
      <div className="flex items-baseline justify-between">
        <span className="font-bold" style={{ fontSize: 10, color: '#b3a585' }}>LATENCY</span>
        <span className="font-mono font-bold" style={{ fontSize: 15 }} title="Round trip: from the synth's output, through the interface and the studio, back to your ears" data-testid="latency-total">
          {round !== null ? `≈${round} ms` : known ? `≥${known} ms` : 'n/a'}
        </span>
      </div>
      <div className="font-mono leading-snug" style={{ fontSize: 10, color: '#c9bfa9' }} title="Input latency is reported by Chrome; base and output latency by browsers that support them (Safari from 18.4 for output)">
        in {builtIn ? '0 (built in)' : na(inLat)} · base {na(lat.base)} · out {na(lat.out)} ms
      </div>
      <div className="leading-snug" style={{ fontSize: 10, color: muted ? '#86efac' : '#a89f8c' }}>
        {muted ? 'MUTE is on: you monitor directly from your interface (no studio delay); it still meters and records.' : verdict}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Meter
// ----------------------------------------------------------------------------

/** L/R peak meters after GAIN, an input-stage clip light and a peak readout. Polls without re-rendering React. */
export function Meter({ instance, ctx }: { instance: string; ctx?: CustomRenderContext }) {
  const lRef = useRef<HTMLDivElement>(null);
  const rRef = useRef<HTMLDivElement>(null);
  const clipRef = useRef<HTMLButtonElement>(null);
  const inClipRef = useRef<HTMLSpanElement>(null);
  const peakRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let raf = 0;
    const held = { l: 0, r: 0 };
    let hold = { db: -96, at: 0 };
    let lastText = 0;
    const colours = new WeakMap<HTMLElement, string>();
    // transform and colour only: no layout work per frame (iPad)
    const bar = (el: HTMLDivElement | null, v: number) => {
      if (!el) return;
      const db = toDb(v);
      el.style.transform = `scaleX(${(pctOf(db) / 100).toFixed(4)})`;
      const c = db > -1 ? '#ef4444' : db > TARGET_ZONE[1] ? '#eab308' : '#22c55e';
      if (colours.get(el) !== c) { colours.set(el, c); el.style.background = c; }
    };
    const tick = () => {
      const engine = engineOf(instance);
      const lv = engine && typeof engine.levels === 'function' ? engine.levels() : { l: 0, r: 0, inL: 0, inR: 0, clip: false, inputClip: false };
      held.l = Math.max(lv.l, held.l * 0.9);
      held.r = Math.max(lv.r, held.r * 0.9);
      bar(lRef.current, held.l);
      bar(rRef.current, held.r);
      const now = performance.now();
      const db = toDb(Math.max(lv.l, lv.r));
      if (db >= hold.db || now - hold.at > 2000) hold = { db, at: now };
      if (peakRef.current && now - lastText > 120) {
        lastText = now;
        peakRef.current.textContent = hold.db <= -90 ? '-∞' : hold.db.toFixed(1);
      }
      const clipBg = lv.clip ? '#ef4444' : '#3a1414';
      const inBg = lv.inputClip ? '#ef4444' : '#3a1414';
      if (clipRef.current && clipRef.current.style.background !== clipBg) clipRef.current.style.background = clipBg;
      if (inClipRef.current && inClipRef.current.style.background !== inBg) inClipRef.current.style.background = inBg;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [instance]);

  const ticks = [-48, -36, -24, -18, -12, -6, 0];
  return (
    <div className="w-full h-full flex items-stretch gap-2 select-none rounded px-1.5 py-1" style={{ background: 'rgba(0,0,0,0.45)', border: '1px solid #3b3326', ...(ctx ? glow(lit(ctx, 'meter')) : {}) }}>
      <div className="flex-1 flex flex-col justify-between min-w-0" aria-label="Input level meter: peaks after GAIN, in dBFS" role="img">
        {(['L', 'R'] as const).map(ch => (
          <div key={ch} className="flex items-center gap-1">
            <span className="font-bold" style={{ fontSize: 9, color: '#a89f8c', width: 8 }}>{ch}</span>
            <div className="relative flex-1 rounded-sm overflow-hidden" style={{ height: 14, background: '#0d0b08', border: '1px solid #3b3326' }}>
              {/* Target zone: peaks around -12 dBFS */}
              <div className="absolute inset-y-0" style={{ left: `${pctOf(TARGET_ZONE[0])}%`, width: `${pctOf(TARGET_ZONE[1]) - pctOf(TARGET_ZONE[0])}%`, background: 'rgba(34,197,94,0.16)' }} />
              <div ref={ch === 'L' ? lRef : rRef} className="absolute inset-0" style={{ transform: 'scaleX(0)', transformOrigin: 'left center', willChange: 'transform' }} data-meter={ch} />
              {ticks.map(db => (
                <div key={db} className="absolute inset-y-0" style={{ left: `${pctOf(db)}%`, width: 1, background: db === TARGET_DBFS ? 'rgba(134,239,172,0.7)' : 'rgba(255,255,255,0.18)' }} />
              ))}
            </div>
          </div>
        ))}
        <div className="relative" style={{ height: 11, marginLeft: 12 }} aria-hidden>
          {ticks.map(db => (
            <span key={db} className="absolute font-mono -translate-x-1/2" style={{ left: `${pctOf(db)}%`, fontSize: 8.5, color: db === TARGET_DBFS ? '#86efac' : '#8c826e' }}>{db}</span>
          ))}
        </div>
      </div>
      <div className="flex flex-col items-center justify-center shrink-0" style={{ width: 54 }}>
        <span className="font-mono font-bold" style={{ fontSize: 15, color: '#f3ead8' }}><span ref={peakRef} data-peak>-∞</span></span>
        <span style={{ fontSize: 8.5, color: '#a89f8c' }}>dBFS peak</span>
      </div>
      <button
        ref={clipRef}
        onClick={() => engineOf(instance)?.clearClip()}
        className="shrink-0 rounded flex flex-col items-center justify-center"
        style={{ width: 46, background: '#3a1414', border: '1px solid #5a2020' }}
        title="CLIP: the signal hit 0 dBFS and was cut off (it stays lit until you tap it). IN lights when it clipped before GAIN, in your interface: turn the interface's gain down."
        aria-label="Clip indicator - tap to clear"
        data-clip
      >
        <span className="font-bold" style={{ fontSize: 10, color: '#fee2e2' }}>CLIP</span>
        <span className="flex items-center gap-1" style={{ fontSize: 8, color: '#fecaca' }}>
          <span ref={inClipRef} className="inline-block rounded-full" style={{ width: 7, height: 7, background: '#3a1414', border: '1px solid #7f1d1d' }} />IN
        </span>
      </button>
    </div>
  );
}

export function MeterBox(ctx: CustomRenderContext) {
  return <Meter instance={ctx.instance} ctx={ctx} />;
}

// ----------------------------------------------------------------------------
// Level check
// ----------------------------------------------------------------------------

const CHECK_MS = 5000;

export function LevelCheck(ctx: CustomRenderContext) {
  const data = asInputData(ctx.data);
  const [listening, setListening] = useState<{ until: number; peak: number; clip: boolean; inClip: boolean } | null>(null);
  const [, force] = useState(0);
  const live = ctx.engine.status === 'live' && data.enabled;
  const gain = Number(ctx.values.gain ?? 0);

  useEffect(() => {
    if (!listening) return;
    let raf = 0;
    const acc = { peak: 0, clip: false, inClip: false };
    engineOf(ctx.instance)?.clearClip();
    // The Practice synth only sounds when played: play its phrase through the check
    const demos: ReturnType<typeof setTimeout>[] = [];
    if (data.source === 'practice') [0, 1350, 2700, 4050].forEach(t => demos.push(setTimeout(() => ctx.sendEvent('audition'), t)));
    const tick = () => {
      const lv = engineOf(ctx.instance)?.levels();
      if (lv) {
        acc.peak = Math.max(acc.peak, lv.l, lv.r);
        acc.clip ||= lv.clip;
        acc.inClip ||= lv.inputClip;
      }
      if (performance.now() >= listening.until) {
        const peakDb = Math.round(toDb(acc.peak) * 10) / 10;
        ctx.updateData(d => {
          const cur = asInputData(d);
          return { ...cur, levelCheck: { peakDb, gainDb: Number(ctx.values.gain ?? 0), source: cur.source, at: Date.now() } };
        });
        setListening(null);
        return;
      }
      force(n => n + 1);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); demos.forEach(t => clearTimeout(t)); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listening?.until]);

  const result = data.levelCheck;
  const judged = result ? judgeLevel(result.peakDb) : null;
  const target = result && judged ? Math.max(-24, Math.min(24, Math.round((result.gainDb + judged.changeDb) * 2) / 2)) : null;
  const left = listening ? Math.max(0, Math.ceil((listening.until - performance.now()) / 1000)) : 0;

  return (
    <div className="w-full h-full rounded px-1.5 py-1 flex flex-col gap-1" style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid #3b3326', color: '#e8e2d6', ...glow(lit(ctx, 'level-check')) }}>
      <div className="flex items-center gap-1.5">
        <HeaderButton
          accent={!listening}
          disabled={!live || !!listening}
          onClick={() => setListening({ until: performance.now() + CHECK_MS, peak: 0, clip: false, inClip: false })}
          label="Check the input level"
        >
          {listening ? `Listening… ${left}` : 'Check level'}
        </HeaderButton>
        {judged && target !== null && judged.verdict !== 'good' && judged.verdict !== 'silent' && !listening && Math.abs(target - gain) >= 0.5 && (
          <HeaderButton onClick={() => ctx.setValue('gain', target)} label={`Set GAIN to ${target} dB`}>GAIN {target > 0 ? '+' : ''}{target} dB</HeaderButton>
        )}
      </div>
      <div className="leading-snug" style={{ fontSize: 11, color: !judged ? '#a89f8c' : judged.verdict === 'good' ? '#86efac' : judged.verdict === 'clip' || judged.verdict === 'hot' ? '#fca5a5' : '#fcd34d' }} data-testid="level-verdict">
        {listening
          ? data.source === 'practice' ? 'The Practice synth plays its phrase while the check listens.' : 'Play the loudest part now (or let it run): the check keeps the highest peak.'
          : judged
            ? `${judged.text}${result ? ` (peak ${result.peakDb.toFixed(1)} dBFS at GAIN ${result.gainDb > 0 ? '+' : ''}${result.gainDb} dB)` : ''}`
            : live ? 'Aim for peaks around -12 dBFS: loud enough to stay clear of noise, with room for louder notes.' : 'Connect a source, then check its level.'}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Routing and takes
// ----------------------------------------------------------------------------

export function RouteRecord(ctx: CustomRenderContext) {
  const data = asInputData(ctx.data);
  const rack = useStudioStore(s => s.studio.rack);
  const route = useStudioStore(s => s.studio.routes[ctx.instance] ?? 'master');
  const setRoute = useStudioStore(s => s.setRoute);
  const recording = !!ctx.engine.recording;
  const startedAt = Number(ctx.engine.takeStartedAt ?? 0);
  const startedTransport = useRef(false);
  const [, force] = useState(0);
  const [busy, setBusy] = useState(false);
  const live = ctx.engine.status === 'live' && data.enabled;

  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => force(n => n + 1), 250);
    return () => clearInterval(id);
  }, [recording]);

  // Mixer channels in this studio (any instrument with mixer inputs)
  const targets: { value: string; label: string }[] = [];
  rack.forEach(r => {
    const mod = hub.getModule(r.device);
    mod?.studio?.mixerInputs?.forEach(inp => targets.push({ value: `${r.id}:${inp.id}`, label: `${r.label ?? mod.spec.name} · ${inp.label}` }));
  });
  const known = route === 'master' || targets.some(t => t.value === route);

  const toggleTake = async () => {
    const engine = engineOf(ctx.instance);
    if (!engine || busy) return;
    setBusy(true);
    try {
      if (!engine.recording) {
        hub.ensureAudio();
        await engine.startTake();
        // One button records a take in time: start the studio if it is stopped
        if (!transport.playing) { hub.startAll(); startedTransport.current = true; }
      } else {
        const r = await engine.stopTake();
        if (startedTransport.current) { hub.stopAll(); startedTransport.current = false; }
        if (r) {
          const n = (data.takes[data.takes.length - 1]?.n ?? 0) + 1;
          const name = (inputLabel(data, modeLabel(ctx)) ?? 'Audio input').replace(/[^\w\- ]+/g, '').trim() || 'Audio input';
          const a = document.createElement('a');
          a.href = URL.createObjectURL(r.blob);
          a.download = `${name} - take ${n}.wav`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
          ctx.updateData(d => {
            const cur = asInputData(d);
            return { ...cur, takes: [...cur.takes, { n, seconds: Math.round(r.seconds * 10) / 10, peakDb: Math.round(r.peakDb * 10) / 10, at: Date.now() }].slice(-50) };
          });
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const last = data.takes[data.takes.length - 1];
  const elapsed = recording && startedAt ? (performance.now() - startedAt) / 1000 : 0;
  const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  return (
    <div className="w-full h-full flex items-center gap-2 rounded px-1.5" style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid #3b3326', color: '#e8e2d6' }}>
      <label className="flex items-center gap-1.5 min-w-0" style={{ fontSize: 11, ...glow(lit(ctx, 'route')) }}>
        <span className="shrink-0 font-bold" style={{ color: '#b3a585' }}>OUTPUT</span>
        <select
          value={known ? route : 'master'}
          onChange={e => setRoute(ctx.instance, e.target.value)}
          className="min-w-0 rounded px-1.5"
          style={{ fontSize: 12, height: 46, maxWidth: 190, background: '#16130e', color: '#f3ead8', border: '1px solid #4a3f2c' }}
          aria-label="Output: where this input goes"
          title={targets.length ? 'Master, or a mixer channel (gain, EQ, filter and fader for this input)' : 'Add a mixer (Xone:96) to the studio to route this input to its own channel'}
        >
          <option value="master">Master out</option>
          {targets.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </label>
      <button
        onClick={() => void toggleTake()}
        disabled={!live || busy}
        className="shrink-0 rounded font-bold flex items-center gap-1.5 disabled:opacity-40"
        style={{ minHeight: 46, padding: '0 12px', fontSize: 13, color: recording ? '#fff' : '#fee2e2', background: recording ? '#dc2626' : '#3a1d1d', border: '1px solid #7f1d1d', ...glow(lit(ctx, 'record')) }}
        aria-pressed={recording}
        title="Record this input alone to a WAV file (after GAIN). Starts the studio too, so the sequencer plays along."
      >
        <span className="inline-block rounded-full" style={{ width: 10, height: 10, background: recording ? '#fff' : '#ef4444' }} />
        {recording ? `Stop take ${clock(elapsed)}` : 'Record take'}
      </button>
      <span className="truncate" style={{ fontSize: 10, color: '#a89f8c' }}>
        {recording
          ? 'Recording this input…'
          : last ? `Take ${last.n} · ${clock(last.seconds)} · peak ${last.peakDb.toFixed(1)} dBFS · saved to Downloads` : 'Takes are saved as WAV files.'}
      </span>
    </div>
  );
}
