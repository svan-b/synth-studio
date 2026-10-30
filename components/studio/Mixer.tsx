'use client';

// The studio mixer: a channel strip for every instrument in the rack (twins,
// your MIDI synth's audio input, plugins), two shared returns and the master.
// Everything here is saved with the project and undoable.

import { Fragment, useEffect, useMemo, useState } from 'react';
import { useStudioStore } from '@/store/studio';
import { hub } from '@/lib/studio/hub';
import { DEVICES } from '@/devices';
import {
  CHANNEL_DEFAULT, DELAY_DIVISIONS, MIN_DB, audibleChannels, delayOf, formatDb, formatPan, masterOf, outputChannelId, reverbOf,
  studioChannels, type ChannelDoc, type DelayDivision,
} from '@/lib/studio/mixerDoc';
import { levelTrimDb } from '@/lib/studio/levels';
import { LIMITER_CEILING_DB, LIMITER_LOOKAHEAD } from '@/lib/audio/context';
import { Fader, HSlider, StereoMeter } from './controls';
import { MasterMeterPanel } from './MasterMeter';
import { useSlotsVersion } from './hooks';

const FADER_H = 168;

const sendFmt = (v: number) => (v <= MIN_DB ? 'off' : `${formatDb(v, 0)}`);
// sends: -60 (off) .. +6 dB on a gentle taper (most of the travel between -30 and 0)
const sendToPos = (db: number) => (db <= MIN_DB ? 0 : Math.max(0.02, Math.min(1, (db + 40) / 46)));
const posToSend = (p: number) => (p < 0.02 ? MIN_DB : Math.round((-40 + p * 46) * 2) / 2);
const logPos = (min: number, max: number) => (v: number) => Math.log(v / min) / Math.log(max / min);
const logVal = (min: number, max: number) => (p: number) => min * Math.pow(max / min, p);

export function deviceColor(device: string): string {
  const e = DEVICES.find(d => d.id === device);
  if (!e) return '#9ca3af';
  if (e.manufacturer === 'Elektron') return '#f97316';
  if (e.manufacturer === 'Moog') return '#38bdf8';
  if (e.category === 'DJ Mixer') return '#e5e7eb';
  if (e.category === 'External') return '#a78bfa';
  return '#22c55e';
}

export function instanceLabel(rack: { id: string; device: string; label?: string }[], id: string): string {
  const r = rack.find(x => x.id === id);
  const entry = DEVICES.find(d => d.id === r?.device);
  if (r?.label) return r.label;
  return id.includes('#') ? `${entry?.name ?? id} ${id.split('#')[1]}` : entry?.name ?? id;
}

export default function Mixer({ onFocus }: { onFocus: (instance: string) => void }) {
  const rack = useStudioStore(s => s.studio.rack);
  const mixerDoc = useStudioStore(s => s.studio.mixer);
  const routes = useStudioStore(s => s.studio.routes);
  const off = useStudioStore(s => s.studio.off);
  const outputs = useStudioStore(s => s.studio.outputs);
  const [chainOpen, setChainOpen] = useState(false);
  useSlotsVersion();
  const mixer = hub.mixer;

  // Meters run only while the mixer is on screen
  useEffect(() => {
    if (!mixer) return;
    return mixer.watchLevels(() => undefined);
  }, [mixer]);

  const channels = useMemo(() => studioChannels(rack, outputs), [rack, outputs]);
  const audible = useMemo(() => audibleChannels(mixerDoc, channels, routes), [mixerDoc, channels, routes]);
  const anySolo = channels.some(c => mixerDoc?.channels?.[c.id]?.solo);

  // Mixer devices' inputs (Xone:96 channels) as routing targets
  const targets = useMemo(() => {
    const out: { value: string; label: string; short: string; mixer: string }[] = [];
    rack.forEach(r => {
      const mod = hub.getModule(r.device);
      mod?.studio?.mixerInputs?.forEach(inp => out.push({
        value: `${r.id}:${inp.id}`,
        label: `${instanceLabel(rack, r.id)} · ${inp.label}`,
        short: `${(mod.spec.name || r.device).split(':')[0].slice(0, 5)} ${inp.label.replace(/^(channel|ch)\s*/i, '')}`,
        mixer: r.id,
      }));
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rack, hub.getModule('xone96')]);

  return (
    <section className="bg-[#121212] border border-[#2a2a2a] rounded-xl p-2.5" aria-label="Mixer">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2 px-0.5">
        <h3 className="font-bold text-white text-sm">Mixer</h3>
        <p className="text-[11px] text-gray-500 leading-snug flex-1 min-w-[260px]">
          At 0 dB every instrument plays at its nominal level (about -18 LUFS). Sends feed the shared <b className="text-gray-300">delay (A)</b> and <b className="text-gray-300">reverb (B)</b>.
          <b className="text-gray-300"> S</b> solos a channel (returns stay on), <b className="text-gray-300">M</b> mutes it. Double-tap a control to reset it.
        </p>
        {anySolo && (
          <button
            onClick={() => useStudioStore.getState().setMixer(m => ({ ...m, channels: Object.fromEntries(Object.entries(m.channels ?? {}).map(([k, v]) => [k, { ...v, solo: false }])) }))}
            className="px-2 py-1 rounded bg-sky-700 text-white text-[11px] font-bold"
          >
            Clear solo
          </button>
        )}
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
        {rack.filter(r => !DEVICES.find(d => d.id === r.device)?.silent).map(r => {
          const outs = hub.getModule(r.device)?.studio?.outputs ?? [];
          return (
            <Fragment key={r.id}>
              <Strip
                id={r.id}
                device={r.device}
                name={instanceLabel(rack, r.id)}
                audible={audible.has(r.id)}
                powered={!off?.[r.id]}
                targets={targets.filter(t => t.mixer !== r.id)}
                onFocus={onFocus}
                outputs={outs.length ? { list: outs, used: outputs?.[r.id] ?? [] } : undefined}
              />
              {/* its separate outputs in use, each its own channel */}
              {(outputs?.[r.id] ?? []).map(o => {
                const id = outputChannelId(r.id, o);
                return (
                  <Strip
                    key={id}
                    id={id}
                    device={r.device}
                    name={`${instanceLabel(rack, r.id)} · ${outs.find(x => x.id === o)?.label ?? o}`}
                    heading={{ main: outs.find(x => x.id === o)?.label ?? o, sub: instanceLabel(rack, r.id) }}
                    audible={audible.has(id)}
                    powered={!off?.[r.id]}
                    targets={targets.filter(t => t.mixer !== r.id)}
                    onFocus={() => onFocus(r.id)}
                  />
                );
              })}
            </Fragment>
          );
        })}
        <div className="w-px shrink-0 bg-[#2a2a2a] mx-0.5" />
        <DelayStrip />
        <ReverbStrip />
        <div className="w-px shrink-0 bg-[#2a2a2a] mx-0.5" />
        <MasterStrip chainOpen={chainOpen} onChain={() => setChainOpen(o => !o)} />
      </div>
      {chainOpen && <MasterChain />}
    </section>
  );
}

function StripShell({ children, accent, dim, label, wide }: { children: React.ReactNode; accent: string; dim?: boolean; label: string; wide?: boolean }) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`shrink-0 rounded-lg bg-[#191919] border border-[#2c2c2c] px-1.5 pt-1 pb-1.5 flex flex-col items-center gap-1 ${wide ? '' : 'w-[94px]'}`}
      style={{ borderTop: `3px solid ${accent}`, opacity: dim ? 0.55 : 1 }}
    >
      {children}
    </div>
  );
}

function Strip({ id, device, name, audible, powered, targets, onFocus, outputs, heading }: {
  id: string; device: string; name: string; audible: boolean; powered: boolean;
  /** A separate output's header: its name, with the instrument under it (the full name is too long) */
  heading?: { main: string; sub: string };
  targets: { value: string; label: string; short: string }[];
  onFocus: (id: string) => void;
  /** The instrument's separate outputs (hardware individual outs), and which are in use */
  outputs?: { list: { id: string; label: string }[]; used: string[] };
}) {
  const saved = useStudioStore(s => s.studio.mixer?.channels?.[id]);
  const route = useStudioStore(s => s.studio.routes[id] ?? 'master');
  const setChannel = useStudioStore(s => s.setChannel);
  const setRoute = useStudioStore(s => s.setRoute);
  const c: ChannelDoc = { ...CHANNEL_DEFAULT, ...(saved ?? {}) };
  const mod = hub.getModule(device);
  const isMixer = !!mod?.studio?.mixerInputs?.length;
  const set = (patch: Partial<ChannelDoc>) => setChannel(id, patch);
  const trim = levelTrimDb(device);
  const read = () => {
    const l = hub.mixer?.getLevels(id);
    return l ? { l: l.peakL, r: l.peakR } : null;
  };
  const routeTarget = targets.find(t => t.value === route);
  const viaMixer = !isMixer && !!routeTarget;
  return (
    <StripShell accent={deviceColor(device)} dim={!powered} label={`${name} channel`}>
      <button
        onClick={() => onFocus(id)}
        className="w-full text-[11px] font-bold text-white truncate hover:text-teaching-current leading-tight h-[28px] flex items-center justify-center text-center"
        title={`${name} - open the instrument`}
      >
        {heading ? (
          <span className="flex flex-col items-center leading-tight min-w-0">
            <span className="truncate max-w-full">{heading.main}</span>
            <span className="truncate max-w-full text-[9px] font-normal text-gray-400">{heading.sub}</span>
          </span>
        ) : (
          <span className="line-clamp-2 break-words">{name}</span>
        )}
      </button>
      {!isMixer ? (
        <select
          value={routeTarget ? route : 'master'}
          onChange={e => setRoute(id, e.target.value)}
          className="w-full bg-[#232323] border border-[#3a3a3a] text-white rounded px-0.5 py-0.5 text-[10px] h-[24px]"
          aria-label={`${name} output`}
          title="Where this channel goes: the master, or a channel of a mixer in your rack"
        >
          <option value="master">→ Master</option>
          {targets.map(t => <option key={t.value} value={t.value}>→ {t.label}</option>)}
        </select>
      ) : (
        <span className="w-full text-center text-[10px] text-gray-500 h-[24px] leading-[24px]">→ Master</span>
      )}
      {outputs && <SeparateOuts instance={id} name={name} outputs={outputs} />}
      <div
        className={viaMixer ? 'opacity-40 pointer-events-none w-full' : 'w-full'}
        aria-disabled={viaMixer || undefined}
        title={viaMixer ? `This channel goes through ${routeTarget?.label ?? 'a mixer'}: use that mixer's FX sends` : undefined}
      >
        <Labeled text="A · delay">
          <HSlider value={c.sendA} min={MIN_DB} max={6} onChange={v => set({ sendA: v })} label={`${name} send A (delay)`} format={sendFmt} resetTo={MIN_DB} width={78} toPos={sendToPos} fromPos={posToSend} accent="#22d3ee" />
        </Labeled>
        <Labeled text="B · reverb">
          <HSlider value={c.sendB} min={MIN_DB} max={6} onChange={v => set({ sendB: v })} label={`${name} send B (reverb)`} format={sendFmt} resetTo={MIN_DB} width={78} toPos={sendToPos} fromPos={posToSend} accent="#a78bfa" />
        </Labeled>
      </div>
      <Labeled text="pan">
        <HSlider value={c.pan} min={-1} max={1} onChange={v => set({ pan: Math.round(v * 100) / 100 })} label={`${name} pan`} format={formatPan} resetTo={0} width={78} centered accent="#e5e7eb" />
      </Labeled>
      <div className="flex gap-1 w-full">
        <button
          onClick={() => set({ mute: !c.mute })}
          aria-pressed={c.mute}
          aria-label={`Mute ${name}`}
          className={`flex-1 h-[28px] rounded text-[12px] font-bold ${c.mute ? 'bg-amber-500 text-black' : 'bg-[#2a2a2a] text-gray-300'}`}
          title="Mute this channel (its sends too)"
        >
          M
        </button>
        <button
          onClick={() => set({ solo: !c.solo })}
          aria-pressed={c.solo}
          aria-label={`Solo ${name}`}
          className={`flex-1 h-[28px] rounded text-[12px] font-bold ${c.solo ? 'bg-sky-500 text-black' : 'bg-[#2a2a2a] text-gray-300'}`}
          title="Solo: hear only soloed channels (and the returns)"
        >
          S
        </button>
      </div>
      <Fader value={c.gain} onChange={v => set({ gain: v })} height={FADER_H} label={`${name} fader`}>
        <StereoMeter read={read} />
      </Fader>
      <span className={`text-[11px] tabular-nums font-mono ${c.gain === 0 ? 'text-amber-300' : 'text-gray-200'}`} title={audible ? undefined : 'Silent: muted, or another channel is soloed'}>
        {formatDb(c.gain)} dB{!audible && <span className="text-gray-500"> ·off</span>}
      </span>
      {(trim !== 0 || !powered) && (
        <span className="text-[9px] text-gray-600 leading-none" title="Input trim before the fader">
          {trim ? `trim ${trim > 0 ? '+' : ''}${trim} dB` : ''}{!powered ? (trim ? ' · OFF' : 'powered off') : ''}
        </span>
      )}
    </StripShell>
  );
}

/**
 * The instrument's separate outputs, like the hardware's individual outs: each one turned on
 * takes that part out of the main channel onto a channel of its own (to EQ a kick on its own
 * mixer channel, say).
 */
function SeparateOuts({ instance, name, outputs }: { instance: string; name: string; outputs: { list: { id: string; label: string }[]; used: string[] } }) {
  const setOutputUsed = useStudioStore(s => s.setOutputUsed);
  const n = outputs.used.length;
  return (
    <details className="w-full relative">
      <summary
        className={`list-none cursor-pointer w-full text-center rounded text-[10px] font-bold h-[24px] leading-[24px] coarse:h-[32px] coarse:leading-[32px] ${n ? 'bg-sky-900/60 text-sky-100' : 'bg-[#232323] text-gray-300'}`}
        title={`${name}: put parts on channels of their own, like the hardware's separate outputs`}
      >
        Outs{n ? ` · ${n}` : ''} ▾
      </summary>
      <div className="absolute left-0 top-full mt-1 z-20 w-[150px] rounded border border-[#3a3a3a] bg-[#1a1a1a] p-1.5 shadow-xl" role="group" aria-label={`${name} separate outputs`}>
        <p className="text-[10px] text-gray-400 leading-snug mb-1">A part with its own output leaves the main channel.</p>
        {outputs.list.map(o => {
          const on = outputs.used.includes(o.id);
          return (
            <label key={o.id} className="flex items-center gap-2 text-[11px] text-gray-200 min-h-[28px] coarse:min-h-[36px] cursor-pointer">
              <input type="checkbox" checked={on} onChange={e => setOutputUsed(instance, o.id, e.target.checked)} className="accent-sky-500" />
              {o.label}
            </label>
          );
        })}
      </div>
    </details>
  );
}

function Labeled({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <div className="w-full flex flex-col items-center">
      <span className="text-[9px] uppercase tracking-wide text-gray-500 leading-none mb-[2px] self-start pl-[3px]">{text}</span>
      {children}
    </div>
  );
}

function DelayStrip() {
  const saved = useStudioStore(s => s.studio.mixer?.delay);
  const setReturn = useStudioStore(s => s.setReturn);
  const d = delayOf({ delay: saved });
  const set = (patch: Partial<typeof d>) => setReturn('delay', patch);
  const read = () => { const l = hub.mixer?.getLevels('__delay'); return l ? { l: l.peakL, r: l.peakR } : null; };
  return (
    <StripShell accent="#22d3ee" label="Return A: delay">
      <div className="w-full text-[11px] font-bold text-white text-center leading-tight h-[28px] flex items-center justify-center">A · Delay</div>
      <select
        value={d.division}
        onChange={e => set({ division: e.target.value as DelayDivision })}
        className="w-full bg-[#232323] border border-[#3a3a3a] text-white rounded px-0.5 py-0.5 text-[10px] h-[24px]"
        aria-label="Delay time"
        title="Delay time, synced to the studio tempo"
      >
        {DELAY_DIVISIONS.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
      </select>
      <Labeled text="feedback">
        <HSlider value={d.feedback} min={0} max={0.9} onChange={v => set({ feedback: Math.round(v * 100) / 100 })} label="Delay feedback" format={v => `${Math.round(v * 100)}%`} resetTo={0.35} width={78} accent="#22d3ee" />
      </Labeled>
      <Labeled text="tone">
        <HSlider value={d.tone} min={800} max={16000} onChange={v => set({ tone: Math.round(v) })} label="Delay tone" format={v => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`)} resetTo={4500} width={78} toPos={logPos(800, 16000)} fromPos={logVal(800, 16000)} accent="#22d3ee" />
      </Labeled>
      <div className="flex gap-1 w-full">
        <button
          onClick={() => set({ pingPong: !d.pingPong })}
          aria-pressed={d.pingPong}
          className={`flex-1 h-[28px] rounded text-[10px] font-bold ${d.pingPong ? 'bg-cyan-800 text-cyan-100' : 'bg-[#2a2a2a] text-gray-400'}`}
          title="Ping-pong: echoes alternate left and right"
        >
          L↔R
        </button>
        <button
          onClick={() => set({ mute: !d.mute })}
          aria-pressed={d.mute}
          aria-label="Mute delay return"
          className={`w-[30px] h-[28px] rounded text-[12px] font-bold ${d.mute ? 'bg-amber-500 text-black' : 'bg-[#2a2a2a] text-gray-300'}`}
        >
          M
        </button>
      </div>
      <Fader value={d.level} onChange={v => set({ level: v })} height={FADER_H} label="Delay return level">
        <StereoMeter read={read} />
      </Fader>
      <span className="text-[11px] tabular-nums font-mono text-gray-200">{formatDb(d.level)} dB</span>
      <span className="text-[9px] text-gray-600 leading-none">return</span>
    </StripShell>
  );
}

function ReverbStrip() {
  const saved = useStudioStore(s => s.studio.mixer?.reverb);
  const setReturn = useStudioStore(s => s.setReturn);
  const r = reverbOf({ reverb: saved });
  const set = (patch: Partial<typeof r>) => setReturn('reverb', patch);
  const read = () => { const l = hub.mixer?.getLevels('__reverb'); return l ? { l: l.peakL, r: l.peakR } : null; };
  return (
    <StripShell accent="#a78bfa" label="Return B: reverb">
      <div className="w-full text-[11px] font-bold text-white text-center leading-tight h-[28px] flex items-center justify-center">B · Reverb</div>
      <Labeled text="decay">
        <HSlider value={r.decay} min={0.3} max={10} onChange={v => set({ decay: Math.round(v * 10) / 10 })} label="Reverb decay" format={v => `${v.toFixed(1)} s`} resetTo={2.2} width={78} toPos={logPos(0.3, 10)} fromPos={logVal(0.3, 10)} accent="#a78bfa" />
      </Labeled>
      <Labeled text="tone">
        <HSlider value={r.damping} min={1000} max={16000} onChange={v => set({ damping: Math.round(v) })} label="Reverb tone (damping)" format={v => `${(v / 1000).toFixed(1)}k`} resetTo={6500} width={78} toPos={logPos(1000, 16000)} fromPos={logVal(1000, 16000)} accent="#a78bfa" />
      </Labeled>
      <Labeled text="size">
        <HSlider value={r.size} min={0.05} max={1} onChange={v => set({ size: Math.round(v * 100) / 100 })} label="Reverb size" format={v => `${Math.round(v * 100)}%`} resetTo={0.7} width={78} accent="#a78bfa" />
      </Labeled>
      <Labeled text="pre-delay">
        <HSlider value={r.predelay} min={0} max={0.12} onChange={v => set({ predelay: Math.round(v * 1000) / 1000 })} label="Reverb pre-delay" format={v => `${Math.round(v * 1000)} ms`} resetTo={0.02} width={78} accent="#a78bfa" />
      </Labeled>
      <button
        onClick={() => set({ mute: !r.mute })}
        aria-pressed={r.mute}
        aria-label="Mute reverb return"
        className={`w-full h-[24px] rounded text-[12px] font-bold ${r.mute ? 'bg-amber-500 text-black' : 'bg-[#2a2a2a] text-gray-300'}`}
      >
        M
      </button>
      <Fader value={r.level} onChange={v => set({ level: v })} height={FADER_H - 8} label="Reverb return level">
        <StereoMeter read={read} />
      </Fader>
      <span className="text-[11px] tabular-nums font-mono text-gray-200">{formatDb(r.level)} dB</span>
      <span className="text-[9px] text-gray-600 leading-none">return</span>
    </StripShell>
  );
}

function MasterStrip({ chainOpen, onChain }: { chainOpen: boolean; onChain: () => void }) {
  const saved = useStudioStore(s => s.studio.mixer?.master);
  const setMaster = useStudioStore(s => s.setMasterSection);
  const m = masterOf({ master: saved });
  const chainOn = m.glue.on || m.eq.on;
  return (
    <StripShell accent="#fbbf24" label="Master" wide>
      <div className="w-full flex items-center justify-between gap-2 h-[28px]">
        <span className="text-[11px] font-bold text-white">MASTER</span>
        <span className="text-[9px] text-gray-500" title="Always on. Only touches peaks above the ceiling; below it the signal passes untouched.">
          limiter {LIMITER_CEILING_DB} dBTP · {(LIMITER_LOOKAHEAD * 1000).toFixed(1)} ms
        </span>
      </div>
      <button
        onClick={onChain}
        aria-expanded={chainOpen}
        className={`w-full h-[24px] rounded text-[10px] font-bold border ${chainOn ? 'bg-violet-900/70 border-violet-500 text-violet-100' : 'bg-[#232323] border-[#3a3a3a] text-gray-400'}`}
        title="Optional glue compressor and tone EQ on the master (bypassed by default)"
      >
        {chainOpen ? '▾' : '▸'} Master chain: {chainOn ? [m.glue.on && 'GLUE', m.eq.on && 'EQ'].filter(Boolean).join(' + ') : 'bypassed'}
      </button>
      <div className="flex gap-2 items-start mt-1">
        <div className="flex flex-col items-center gap-1">
          <Fader value={m.gain} onChange={v => setMaster({ gain: v })} height={FADER_H + 70} label="Master fader" />
          <span className={`text-[11px] tabular-nums font-mono ${m.gain === 0 ? 'text-amber-300' : 'text-gray-200'}`}>{formatDb(m.gain)} dB</span>
        </div>
        <MasterMeterPanel height={FADER_H + 70} />
      </div>
    </StripShell>
  );
}

const RATIOS = [1.5, 2, 4, 10];
const ATTACKS = [0.0001, 0.0003, 0.001, 0.003, 0.01, 0.03];
const RELEASES: (number | 'auto')[] = [0.1, 0.3, 0.6, 1.2, 'auto'];

/** Optional master processing: glue compressor + tone EQ (bypassed by default) */
function MasterChain() {
  const saved = useStudioStore(s => s.studio.mixer?.master);
  const setMaster = useStudioStore(s => s.setMasterSection);
  const m = masterOf({ master: saved });
  const g = m.glue, eq = m.eq;
  const msFmt = (s: number) => (s < 0.001 ? `${(s * 1000).toFixed(1)} ms` : `${Math.round(s * 1000)} ms`);
  return (
    <div className="mt-2 grid md:grid-cols-2 gap-2">
      <div className={`rounded-lg border p-2 ${g.on ? 'border-violet-500/70 bg-violet-950/30' : 'border-[#2c2c2c] bg-[#171717]'}`}>
        <div className="flex items-center gap-2 mb-1.5">
          <button
            onClick={() => setMaster({ glue: { on: !g.on } })}
            aria-pressed={g.on}
            className={`px-2.5 h-[28px] rounded text-[11px] font-bold ${g.on ? 'bg-violet-500 text-black' : 'bg-[#2a2a2a] text-gray-300'}`}
          >
            GLUE {g.on ? 'ON' : 'OFF'}
          </button>
          <p className="text-[11px] text-gray-400 leading-snug">
            A gentle bus compressor (SSL-style: 2:1, slow attack, auto release) that makes the parts move together. Aim for 1–3 dB of reduction (GL in the meter).
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
          <Labeled text="threshold">
            <HSlider value={g.threshold} min={-40} max={0} onChange={v => setMaster({ glue: { threshold: Math.round(v * 2) / 2 } })} label="Glue threshold" format={v => `${v.toFixed(1)} dB`} resetTo={-18} width={96} accent="#a78bfa" />
          </Labeled>
          <PickRow label="ratio" values={RATIOS} value={g.ratio} format={v => `${v}:1`} onPick={v => setMaster({ glue: { ratio: v } })} />
          <PickRow label="attack" values={ATTACKS} value={g.attack} format={msFmt} onPick={v => setMaster({ glue: { attack: v } })} />
          <PickRow
            label="release"
            values={RELEASES}
            value={g.auto ? 'auto' : g.release}
            format={v => (v === 'auto' ? 'auto' : `${v} s`)}
            onPick={v => setMaster({ glue: v === 'auto' ? { auto: true } : { auto: false, release: v } })}
          />
          <Labeled text="makeup">
            <HSlider value={g.makeup} min={0} max={12} onChange={v => setMaster({ glue: { makeup: Math.round(v * 2) / 2 } })} label="Glue makeup gain" format={v => `+${v.toFixed(1)} dB`} resetTo={0} width={84} accent="#a78bfa" />
          </Labeled>
          <Labeled text="mix">
            <HSlider value={g.mix} min={0} max={1} onChange={v => setMaster({ glue: { mix: Math.round(v * 100) / 100 } })} label="Glue mix (parallel compression)" format={v => `${Math.round(v * 100)}%`} resetTo={1} width={72} accent="#a78bfa" />
          </Labeled>
        </div>
      </div>
      <div className={`rounded-lg border p-2 ${eq.on ? 'border-emerald-500/70 bg-emerald-950/20' : 'border-[#2c2c2c] bg-[#171717]'}`}>
        <div className="flex items-center gap-2 mb-1.5">
          <button
            onClick={() => setMaster({ eq: { on: !eq.on } })}
            aria-pressed={eq.on}
            className={`px-2.5 h-[28px] rounded text-[11px] font-bold ${eq.on ? 'bg-emerald-500 text-black' : 'bg-[#2a2a2a] text-gray-300'}`}
          >
            EQ {eq.on ? 'ON' : 'OFF'}
          </button>
          <p className="text-[11px] text-gray-400 leading-snug">
            Broad tone moves for the whole mix: weight (100 Hz shelf), tilt (brighter or warmer around 1 kHz) and air (10 kHz shelf). Small amounts: 1–2 dB.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
          <Labeled text="low 100 Hz">
            <HSlider value={eq.low} min={-6} max={6} onChange={v => setMaster({ eq: { low: Math.round(v * 2) / 2 } })} label="Master EQ low shelf" format={v => `${v > 0 ? '+' : ''}${v.toFixed(1)} dB`} resetTo={0} width={96} centered accent="#34d399" />
          </Labeled>
          <Labeled text="tilt 1 kHz">
            <HSlider value={eq.tilt} min={-4} max={4} onChange={v => setMaster({ eq: { tilt: Math.round(v * 4) / 4 } })} label="Master EQ tilt" format={v => (Math.abs(v) < 0.01 ? 'flat' : `${v > 0 ? 'bright ' : 'warm '}${Math.abs(v).toFixed(1)}`)} resetTo={0} width={96} centered accent="#34d399" />
          </Labeled>
          <Labeled text="high 10 kHz">
            <HSlider value={eq.high} min={-6} max={6} onChange={v => setMaster({ eq: { high: Math.round(v * 2) / 2 } })} label="Master EQ high shelf" format={v => `${v > 0 ? '+' : ''}${v.toFixed(1)} dB`} resetTo={0} width={96} centered accent="#34d399" />
          </Labeled>
        </div>
      </div>
    </div>
  );
}

function PickRow<T extends number | string>({ label, values, value, format, onPick }: { label: string; values: T[]; value: T; format: (v: T) => string; onPick: (v: T) => void }) {
  return (
    <div className="flex flex-col">
      <span className="text-[9px] uppercase tracking-wide text-gray-500 leading-none mb-[2px] pl-[3px]">{label}</span>
      <div className="flex rounded border border-[#333] overflow-hidden">
        {values.map(v => (
          <button
            key={String(v)}
            onClick={() => onPick(v)}
            aria-pressed={v === value}
            className={`px-1.5 h-[24px] text-[10px] tabular-nums ${v === value ? 'bg-violet-500 text-black font-bold' : 'bg-[#222] text-gray-300'}`}
          >
            {format(v)}
          </button>
        ))}
      </div>
    </div>
  );
}
