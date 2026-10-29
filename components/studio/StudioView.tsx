'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { StudioCable } from '@/devices/types';
import { useStudioStore } from '@/store/studio';
import { hub } from '@/lib/studio/hub';
import { DEVICES } from '@/devices';
import DeviceHost from '@/components/DeviceHost';
import type { PatchController } from '@/components/panel/SynthPanel';
import Arranger from './Arranger';
import StudioSets from './StudioSets';
import StudioMap from './StudioMap';
import Mixer, { deviceColor, instanceLabel } from './Mixer';

interface StudioViewProps {
  onAddInstrument: () => void;
  onFocus: (instance: string) => void;
}

const QUICK_ADD: { group: string; ids: string[] }[] = [
  { group: 'Drums', ids: ['analog-rytm', 'dfam'] },
  { group: 'Synths', ids: ['analog-four', 'sub37', 'mother32', 'subharmonicon'] },
  { group: 'Mix & sync', ids: ['xone96', 'studio-clock'] },
  { group: 'Your gear', ids: ['midi-synth', 'audio-in', 'wam-plugin'] },
];

const EXTERNAL_HINT: Record<string, string> = {
  'midi-synth': 'Press Setup… on its panel to pick the MIDI port and channel. Add an Audio input to hear the synth in the studio.',
  'audio-in': 'Press Connect on its panel and choose your interface input. It gets its own mixer channel.',
  'wam-plugin': 'Press Choose plugin… on its panel to load a WAM 2 synth or effect.',
};

/**
 * The whole studio: build stages, the signal flow, the mixer, the song, and every
 * instrument in the rack with the cables between them.
 */
export default function StudioView({ onAddInstrument, onFocus }: StudioViewProps) {
  const rack = useStudioStore(s => s.studio.rack);
  const cables = useStudioStore(s => s.studio.cables);
  const sync = useStudioStore(s => s.studio.sync);
  const setSync = useStudioStore(s => s.setSync);
  const setPowered = useStudioStore(s => s.setPowered);
  const off = useStudioStore(s => s.studio.off ?? {});
  const removeFromRack = useStudioStore(s => s.removeFromRack);
  const moveInRack = useStudioStore(s => s.moveInRack);
  const addToRack = useStudioStore(s => s.addToRack);
  const addStudioCable = useStudioStore(s => s.addStudioCable);
  const removeStudioCable = useStudioStore(s => s.removeStudioCable);
  const clearStudioCables = useStudioStore(s => s.clearStudioCables);
  const [active, setActive] = useState<PatchController['active']>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [note, setNote] = useState<string | null>(null);
  const [, force] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Re-render when modules load (labels, mixer inputs)
  useEffect(() => hub.onSlotsChange(() => force(n => n + 1)), []);
  useEffect(() => { if (!note) return; const t = setTimeout(() => setNote(null), 9000); return () => clearTimeout(t); }, [note]);

  const controller: PatchController = useMemo(() => ({
    active,
    tap: (instance, jack) => {
      if (!active) { setActive({ instance, jack }); return; }
      if (active.instance === instance && active.jack === jack) { setActive(null); return; }
      addStudioCable({ from: active, to: { instance, jack } });
      setActive(null);
    },
  }), [active, addStudioCable]);

  const nameOf = useCallback((id: string) => instanceLabel(rack, id), [rack]);

  const quickAdd = (device: string) => {
    hub.ensureAudio();
    const dup = useStudioStore.getState().studio.rack.some(r => r.device === device);
    const id = addToRack(device, { duplicate: dup });
    setNote(`Added ${instanceLabel(useStudioStore.getState().studio.rack, id)}: it has a mixer channel and a panel below.${EXTERNAL_HINT[device] ? ` ${EXTERNAL_HINT[device]}` : ''}`);
    // bring its panel into view once it has rendered
    setTimeout(() => document.querySelector(`[data-rack-slot="${CSS.escape(id)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 400);
  };

  return (
    <div className="space-y-3">
      <StudioSets />

      <section className="bg-[#121212] border border-[#2a2a2a] rounded-xl px-3 py-2" aria-label="Add instruments">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-sm font-bold text-white">Add</span>
          {QUICK_ADD.map(g => (
            <div key={g.group} className="flex flex-wrap items-center gap-1">
              <span className="text-[10px] uppercase tracking-wider text-gray-500 mr-0.5">{g.group}</span>
              {g.ids.map(id => {
                const e = DEVICES.find(d => d.id === id);
                if (!e) return null;
                return (
                  <button
                    key={id}
                    onClick={() => quickAdd(id)}
                    className="px-2.5 h-8 rounded-full text-[12px] text-gray-100 bg-[#202020] border hover:bg-[#2a2a2a]"
                    style={{ borderColor: `${deviceColor(id)}88` }}
                    title={`${e.manufacturer} ${e.name}: ${e.tagline}`}
                    aria-label={`Add ${e.name} to the studio`}
                  >
                    + {e.name}
                  </button>
                );
              })}
            </div>
          ))}
          <button onClick={onAddInstrument} className="ml-auto px-3 h-8 rounded-lg bg-[#2a2a2a] text-gray-200 text-[12px] border border-[#3a3a3a]">All instruments…</button>
        </div>
        {note && <p className="text-[11px] text-sky-300 mt-1.5" role="status">{note}</p>}
      </section>

      <StudioMap onFocus={onFocus} />
      <Mixer onFocus={onFocus} />
      <Arranger />

      <section aria-label="Rack" className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-xs px-0.5">
          <h3 className="font-bold text-white text-sm">Rack</h3>
          <span className="text-gray-400">
            {active
              ? <span className="text-orange-300">Cable in hand from <b>{nameOf(active.instance)}</b> - tap a jack on any instrument to plug it in (tap the same jack to cancel).</span>
              : 'Patch between instruments: tap a jack, then a jack on another instrument. Tap a cable to unplug it.'}
          </span>
          {cables.length > 0 && (
            <button onClick={() => clearStudioCables()} className="ml-auto px-3 py-1.5 rounded-full bg-[#2a2a2a] text-gray-200 border border-[#3a3a3a]">
              Clear studio cables ({cables.length})
            </button>
          )}
        </div>

        <div ref={containerRef} className="relative space-y-3">
          {rack.map((slot, i) => {
            const mod = hub.getModule(slot.device);
            const canSync = !!mod?.studio?.midiSync && slot.device !== 'studio-clock';
            return (
              <section key={slot.id} data-rack-slot={slot.id} className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-2" style={{ borderLeft: `4px solid ${deviceColor(slot.device)}` }} aria-label={nameOf(slot.id)}>
                <header className="flex flex-wrap items-center gap-2 mb-1.5 px-1" data-rack-header={slot.id}>
                  <button onClick={() => onFocus(slot.id)} className="font-bold text-white hover:text-teaching-current text-sm" title="Open this instrument">
                    {nameOf(slot.id)}
                  </button>
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider">{mod?.spec.manufacturer}</span>
                  {canSync && (
                    <label className="flex items-center gap-1 text-[11px] text-gray-400" title="Follow the studio clock (like MIDI clock): starts, stops and keeps tempo with the studio">
                      <input type="checkbox" checked={sync[slot.id] !== false} onChange={e => setSync(slot.id, e.target.checked)} className="accent-green-500" />
                      Sync to studio clock
                    </label>
                  )}
                  <div className="ml-auto flex items-center gap-1">
                    <button
                      onClick={() => setPowered(slot.id, !!off[slot.id])}
                      className={`px-2 h-8 rounded text-[11px] font-bold ${off[slot.id] ? 'bg-[#2a2a2a] text-gray-500' : 'bg-green-900/60 text-green-300'}`}
                      title={off[slot.id] ? 'Power on (starts its audio engine)' : 'Power off to save CPU - settings are kept'}
                      aria-pressed={!off[slot.id]}
                    >
                      {off[slot.id] ? 'OFF' : 'ON'}
                    </button>
                    <IconButton onClick={() => moveInRack(slot.id, -1)} disabled={i === 0} label="Move up">↑</IconButton>
                    <IconButton onClick={() => moveInRack(slot.id, 1)} disabled={i === rack.length - 1} label="Move down">↓</IconButton>
                    <IconButton onClick={() => setCollapsed(c => ({ ...c, [slot.id]: !c[slot.id] }))} label={collapsed[slot.id] ? 'Expand' : 'Collapse'}>
                      {collapsed[slot.id] ? '▸' : '▾'}
                    </IconButton>
                    {rack.length > 1 && <IconButton onClick={() => removeFromRack(slot.id)} label="Remove from studio">✕</IconButton>}
                  </div>
                </header>
                {!collapsed[slot.id] && (
                  <div style={{ opacity: off[slot.id] ? 0.45 : 1 }}>
                    <DeviceHost instance={slot.id} compact keyboardActive={false} patchController={controller} zoomOverride="fit" />
                  </div>
                )}
              </section>
            );
          })}
          <CableOverlay containerRef={containerRef} cables={cables} onRemove={removeStudioCable} collapsed={collapsed} nameOf={nameOf} />
        </div>

        {cables.length > 0 && (
          <details className="text-xs text-gray-400 px-0.5">
            <summary className="cursor-pointer">Studio cables ({cables.length})</summary>
            <ul className="mt-1 space-y-1">
              {cables.map(c => (
                <li key={`${c.from.instance}${c.from.jack}${c.to.instance}${c.to.jack}`} className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ background: c.color }} />
                  {nameOf(c.from.instance)} {jackLabel(c.from)} → {nameOf(c.to.instance)} {jackLabel(c.to)}
                  <button onClick={() => removeStudioCable(c)} className="text-red-400 hover:text-red-300">unplug</button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>
    </div>
  );
}

function jackLabel(end: { instance: string; jack: string }) {
  const device = useStudioStore.getState().deviceOf(end.instance);
  const pb = hub.getModule(device)?.spec.patchBay;
  const j = pb ? [...pb.inputs, ...pb.outputs].find(x => x.id === end.jack) : undefined;
  return j ? `${j.label} ${j.jackType === 'output' ? 'OUT' : 'IN'}` : end.jack;
}

function IconButton({ children, onClick, disabled, label }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; label: string }) {
  return (
    <button onClick={onClick} disabled={disabled} aria-label={label} title={label} className="w-8 h-8 rounded bg-[#232323] text-gray-300 disabled:opacity-30 hover:bg-[#2f2f2f]">
      {children}
    </button>
  );
}

/**
 * Cables between instruments, drawn over the whole rack in page coordinates.
 * A cable to a collapsed instrument ends on its header.
 */
function CableOverlay({ containerRef, cables, onRemove, collapsed, nameOf }: {
  containerRef: React.RefObject<HTMLDivElement>;
  cables: StudioCable[];
  onRemove: (c: StudioCable) => void;
  collapsed: Record<string, boolean>;
  nameOf: (id: string) => string;
}) {
  const [points, setPoints] = useState<{ c: StudioCable; a: { x: number; y: number }; b: { x: number; y: number } }[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hover, setHover] = useState<string | null>(null);
  const press = useRef<{ x: number; y: number; id: number; key: string } | null>(null);

  const measure = useCallback(() => {
    const root = containerRef.current;
    if (!root) return;
    const base = root.getBoundingClientRect();
    const find = (end: { instance: string; jack: string }) => {
      const host = root.querySelector(`[data-instance="${CSS.escape(end.instance)}"]`);
      let el = host?.querySelector(`[data-jack="${CSS.escape(end.jack)}"]`) as HTMLElement | null;
      if (!el) el = root.querySelector(`[data-rack-header="${CSS.escape(end.instance)}"]`) as HTMLElement | null;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (!r.width && !r.height) return null;
      return { x: r.left - base.left + r.width / 2, y: r.top - base.top + r.height / 2 };
    };
    const next: typeof points = [];
    cables.forEach(c => {
      const a = find(c.from);
      const b = find(c.to);
      if (a && b) next.push({ c, a, b });
    });
    setPoints(prev => (JSON.stringify(prev.map(p => [p.a, p.b])) === JSON.stringify(next.map(p => [p.a, p.b])) && prev.length === next.length ? prev : next));
    setSize(s => (s.w === root.scrollWidth && s.h === root.scrollHeight ? s : { w: root.scrollWidth, h: root.scrollHeight }));
  }, [containerRef, cables]);

  useLayoutEffect(() => {
    measure();
    const root = containerRef.current;
    if (!root) return;
    let queued = 0;
    const later = () => { if (!queued) queued = requestAnimationFrame(() => { queued = 0; measure(); }); };
    const ro = new ResizeObserver(later);
    ro.observe(root);
    const observePanels = () => root.querySelectorAll('[data-instance]').forEach(n => ro.observe(n));
    observePanels();
    // Instrument panels render when their module has loaded: re-measure then (no polling)
    const mo = new MutationObserver(() => { observePanels(); later(); });
    mo.observe(root, { childList: true, subtree: true });
    const unsub = hub.onSlotsChange(later);
    window.addEventListener('resize', later);
    return () => {
      ro.disconnect();
      mo.disconnect();
      unsub();
      if (queued) cancelAnimationFrame(queued);
      window.removeEventListener('resize', later);
    };
  }, [measure, containerRef, collapsed]);

  return (
    <svg className="absolute left-0 top-0 pointer-events-none" width={size.w} height={size.h} style={{ overflow: 'visible', zIndex: 45 }}>
      {points.map(({ c, a, b }) => {
        const key = `${c.from.instance}${c.from.jack}${c.to.instance}${c.to.jack}`;
        const dist = Math.hypot(b.x - a.x, b.y - a.y);
        const sag = Math.min(dist * 0.25, 120) + 20;
        const d = `M ${a.x} ${a.y} C ${a.x} ${a.y + sag}, ${b.x} ${b.y + sag}, ${b.x} ${b.y}`;
        const color = c.color ?? '#f97316';
        const hot = hover === key;
        return (
          <g key={key}>
            <path d={d} stroke="rgba(0,0,0,0.55)" strokeWidth={hot ? 11 : 9} fill="none" strokeLinecap="round" transform="translate(2,3)" />
            <path d={d} stroke={color} strokeWidth={hot ? 7.5 : 6} fill="none" strokeLinecap="round" opacity={0.96} />
            <path d={d} stroke="rgba(255,255,255,0.35)" strokeWidth={1.5} fill="none" strokeLinecap="round" transform="translate(-1,-1)" />
            <path
              d={d}
              stroke="transparent"
              strokeWidth={22}
              fill="none"
              style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
              onPointerEnter={() => setHover(key)}
              onPointerLeave={() => setHover(h => (h === key ? null : h))}
              // Unplug on a tap (released within 8 px): a scroll that starts on a cable must not unplug it
              onPointerDown={e => { e.stopPropagation(); press.current = { x: e.clientX, y: e.clientY, id: e.pointerId, key }; }}
              onPointerUp={e => {
                const p0 = press.current;
                press.current = null;
                if (p0 && p0.id === e.pointerId && p0.key === key && Math.hypot(e.clientX - p0.x, e.clientY - p0.y) < 8) onRemove(c);
              }}
              onPointerCancel={() => { press.current = null; }}
            >
              <title>{`${nameOf(c.from.instance)} ${jackLabel(c.from)} → ${nameOf(c.to.instance)} ${jackLabel(c.to)} - tap to unplug`}</title>
            </path>
            <circle cx={a.x} cy={a.y} r={7} fill="#1a1a1a" stroke={color} strokeWidth={3} />
            <circle cx={b.x} cy={b.y} r={7} fill="#1a1a1a" stroke={color} strokeWidth={3} />
            {hot && (
              <text x={(a.x + b.x) / 2} y={Math.max(a.y, b.y) + sag * 0.75 + 18} textAnchor="middle" fontSize={12} fontWeight={700} fill="#fff" stroke="#000" strokeWidth={3} paintOrder="stroke">
                {`${jackLabel(c.from)} → ${jackLabel(c.to)} · tap to unplug`}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
