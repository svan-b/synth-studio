'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { StudioCable } from '@/devices/types';
import { useStudioStore } from '@/store/studio';
import { hub } from '@/lib/studio/hub';
import { DEVICES } from '@/devices';
import DeviceHost from '@/components/DeviceHost';
import type { PatchController } from '@/components/panel/SynthPanel';
import Arranger from './Arranger';

interface StudioViewProps {
  onAddInstrument: () => void;
  onFocus: (instance: string) => void;
}

/**
 * The whole studio: every instrument in the rack, how its audio is routed,
 * whether it follows the studio clock, and the cables between instruments.
 */
export default function StudioView({ onAddInstrument, onFocus }: StudioViewProps) {
  const rack = useStudioStore(s => s.studio.rack);
  const cables = useStudioStore(s => s.studio.cables);
  const routes = useStudioStore(s => s.studio.routes);
  const sync = useStudioStore(s => s.studio.sync);
  const setRoute = useStudioStore(s => s.setRoute);
  const setSync = useStudioStore(s => s.setSync);
  const removeFromRack = useStudioStore(s => s.removeFromRack);
  const moveInRack = useStudioStore(s => s.moveInRack);
  const addStudioCable = useStudioStore(s => s.addStudioCable);
  const removeStudioCable = useStudioStore(s => s.removeStudioCable);
  const clearStudioCables = useStudioStore(s => s.clearStudioCables);
  const [active, setActive] = useState<PatchController['active']>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [, force] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Re-render when modules load (labels, mixer inputs)
  useEffect(() => hub.onSlotsChange(() => force(n => n + 1)), []);

  const controller: PatchController = useMemo(() => ({
    active,
    tap: (instance, jack) => {
      if (!active) { setActive({ instance, jack }); return; }
      if (active.instance === instance && active.jack === jack) { setActive(null); return; }
      addStudioCable({ from: active, to: { instance, jack } });
      setActive(null);
    },
  }), [active, addStudioCable]);

  // Mixer inputs available as routing targets
  const mixerTargets = useMemo(() => {
    const out: { value: string; label: string }[] = [];
    rack.forEach(r => {
      const mod = hub.getModule(r.device);
      mod?.studio?.mixerInputs?.forEach(inp => out.push({ value: `${r.id}:${inp.id}`, label: `${r.label ?? mod.spec.name} · ${inp.label}` }));
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rack, hub.getModule('xone96')]);

  const nameOf = useCallback((id: string) => {
    const r = rack.find(x => x.id === id);
    if (!r) return id;
    const entry = DEVICES.find(d => d.id === r.device);
    return r.label ?? (r.id.includes('#') ? `${entry?.name ?? r.device} ${r.id.split('#')[1]}` : entry?.name ?? r.device);
  }, [rack]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <button onClick={onAddInstrument} className="px-3 py-2 rounded-lg bg-teaching-current text-black font-bold">+ Add instrument</button>
        <span className="text-gray-400">
          {active
            ? <span className="text-orange-300">Cable in hand from <b>{nameOf(active.instance)}</b> - tap a jack on any instrument to plug it in (tap the same jack to cancel).</span>
            : 'Tap a jack, then a jack on another instrument, to patch between them. Tap a cable to unplug it.'}
        </span>
        {cables.length > 0 && (
          <button onClick={() => clearStudioCables()} className="ml-auto px-3 py-1.5 rounded-full bg-[#2a2a2a] text-gray-200 border border-[#3a3a3a]">
            Clear studio cables ({cables.length})
          </button>
        )}
      </div>

      <div ref={containerRef} className="relative space-y-4">
        {rack.map((slot, i) => {
          const mod = hub.getModule(slot.device);
          const isMixer = !!mod?.studio?.mixerInputs?.length;
          const canSync = !!mod?.studio?.midiSync;
          return (
            <section key={slot.id} className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-2" aria-label={nameOf(slot.id)}>
              <header className="flex flex-wrap items-center gap-2 mb-1.5 px-1">
                <button onClick={() => onFocus(slot.id)} className="font-bold text-white hover:text-teaching-current text-sm" title="Open this instrument">
                  {nameOf(slot.id)}
                </button>
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">{mod?.spec.manufacturer}</span>
                {!isMixer && (
                  <label className="flex items-center gap-1 text-[11px] text-gray-400">
                    Output
                    <select
                      value={routes[slot.id] ?? 'master'}
                      onChange={e => setRoute(slot.id, e.target.value)}
                      className="bg-[#232323] border border-[#3a3a3a] text-white rounded px-1.5 py-1 text-[11px]"
                    >
                      <option value="master">Master out</option>
                      {mixerTargets.filter(t => !t.value.startsWith(`${slot.id}:`)).map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </label>
                )}
                {canSync && (
                  <label className="flex items-center gap-1 text-[11px] text-gray-400" title="Follow the studio clock (like MIDI clock): starts, stops and keeps tempo with the studio">
                    <input type="checkbox" checked={sync[slot.id] !== false} onChange={e => setSync(slot.id, e.target.checked)} className="accent-green-500" />
                    Sync to studio clock
                  </label>
                )}
                <div className="ml-auto flex items-center gap-1">
                  <IconButton onClick={() => moveInRack(slot.id, -1)} disabled={i === 0} label="Move up">↑</IconButton>
                  <IconButton onClick={() => moveInRack(slot.id, 1)} disabled={i === rack.length - 1} label="Move down">↓</IconButton>
                  <IconButton onClick={() => setCollapsed(c => ({ ...c, [slot.id]: !c[slot.id] }))} label={collapsed[slot.id] ? 'Expand' : 'Collapse'}>
                    {collapsed[slot.id] ? '▸' : '▾'}
                  </IconButton>
                  {rack.length > 1 && <IconButton onClick={() => removeFromRack(slot.id)} label="Remove from studio">✕</IconButton>}
                </div>
              </header>
              {!collapsed[slot.id] && (
                <DeviceHost instance={slot.id} compact keyboardActive={false} patchController={controller} zoomOverride="fit" />
              )}
            </section>
          );
        })}
        <CableOverlay containerRef={containerRef} cables={cables} onRemove={removeStudioCable} collapsed={collapsed} />
      </div>

      {cables.length > 0 && (
        <details className="text-xs text-gray-400">
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

      <Arranger />
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
    <button onClick={onClick} disabled={disabled} aria-label={label} title={label} className="w-7 h-7 rounded bg-[#232323] text-gray-300 disabled:opacity-30 hover:bg-[#2f2f2f]">
      {children}
    </button>
  );
}

/** Cables between instruments, drawn over the whole rack in page coordinates */
function CableOverlay({ containerRef, cables, onRemove, collapsed }: {
  containerRef: React.RefObject<HTMLDivElement>;
  cables: StudioCable[];
  onRemove: (c: StudioCable) => void;
  collapsed: Record<string, boolean>;
}) {
  const [points, setPoints] = useState<{ c: StudioCable; a: { x: number; y: number }; b: { x: number; y: number } }[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });

  const measure = useCallback(() => {
    const root = containerRef.current;
    if (!root) return;
    const base = root.getBoundingClientRect();
    const find = (end: { instance: string; jack: string }) => {
      const host = root.querySelector(`[data-instance="${CSS.escape(end.instance)}"]`);
      const el = host?.querySelector(`[data-jack="${CSS.escape(end.jack)}"]`) as HTMLElement | null;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left - base.left + r.width / 2, y: r.top - base.top + r.height / 2 };
    };
    const next: typeof points = [];
    cables.forEach(c => {
      const a = find(c.from);
      const b = find(c.to);
      if (a && b) next.push({ c, a, b });
    });
    setPoints(next);
    setSize({ w: root.scrollWidth, h: root.scrollHeight });
  }, [containerRef, cables]);

  useLayoutEffect(() => {
    measure();
    const root = containerRef.current;
    if (!root) return;
    const ro = new ResizeObserver(() => requestAnimationFrame(measure));
    ro.observe(root);
    root.querySelectorAll('[data-instance]').forEach(n => ro.observe(n));
    const t = setInterval(measure, 1000); // modules load asynchronously
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      clearInterval(t);
      window.removeEventListener('resize', measure);
    };
  }, [measure, containerRef, collapsed]);

  return (
    <svg className="absolute left-0 top-0 pointer-events-none" width={size.w} height={size.h} style={{ overflow: 'visible', zIndex: 45 }}>
      {points.map(({ c, a, b }) => {
        const dist = Math.hypot(b.x - a.x, b.y - a.y);
        const sag = Math.min(dist * 0.25, 120) + 20;
        const d = `M ${a.x} ${a.y} C ${a.x} ${a.y + sag}, ${b.x} ${b.y + sag}, ${b.x} ${b.y}`;
        const color = c.color ?? '#f97316';
        return (
          <g key={`${c.from.instance}${c.from.jack}${c.to.instance}${c.to.jack}`}>
            <path d={d} stroke="rgba(0,0,0,0.55)" strokeWidth={8} fill="none" strokeLinecap="round" transform="translate(2,3)" />
            <path d={d} stroke={color} strokeWidth={5} fill="none" strokeLinecap="round" opacity={0.95} />
            <path d={d} stroke="transparent" strokeWidth={18} fill="none" style={{ pointerEvents: 'stroke', cursor: 'pointer' }} onPointerDown={e => { e.stopPropagation(); onRemove(c); }}>
              <title>Tap to unplug</title>
            </path>
            <circle cx={a.x} cy={a.y} r={6} fill="#1a1a1a" stroke={color} strokeWidth={2.5} />
            <circle cx={b.x} cy={b.y} r={6} fill="#1a1a1a" stroke={color} strokeWidth={2.5} />
          </g>
        );
      })}
    </svg>
  );
}
