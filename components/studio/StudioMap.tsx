'use client';

// The studio at a glance: who is clocked by what, where every instrument's audio
// goes, and the patch cables between instruments. A signal-flow diagram drawn
// from the store, so it is always true. Tap an instrument to open it.

import { useMemo } from 'react';
import type { RackSlot, StudioCable } from '@/devices/types';
import { useStudioStore } from '@/store/studio';
import { hub } from '@/lib/studio/hub';
import { channelOf, MIN_DB, audibleChannels } from '@/lib/studio/mixerDoc';
import { deviceColor, instanceLabel } from './Mixer';
import { useSlotsVersion } from './hooks';

const NODE_W = 168;
const NODE_H = 40;
const GAP = 10;
const COL = [16, 236, 480, 676];

interface Node { id: string; x: number; y: number; label: string; sub: string; color: string; kind: 'clock' | 'inst' | 'mixer' | 'master' }

export default function StudioMap({ onFocus }: { onFocus: (instance: string) => void }) {
  const rack = useStudioStore(s => s.studio.rack);
  const routes = useStudioStore(s => s.studio.routes);
  const sync = useStudioStore(s => s.studio.sync);
  const cables = useStudioStore(s => s.studio.cables);
  const mixer = useStudioStore(s => s.studio.mixer);
  const off = useStudioStore(s => s.studio.off);
  useSlotsVersion();

  const layout = useMemo(() => buildLayout(rack, routes, sync, mixer, off ?? {}), [rack, routes, sync, mixer, off]);
  const { nodes, height, routeEdges, syncEdges } = layout;
  const pos = (id: string) => nodes.find(n => n.id === id);
  const audible = useMemo(() => audibleChannels(mixer, rack, routes), [mixer, rack, routes]);

  const cableEdges = cables.map(c => ({ c, a: pos(c.from.instance), b: pos(c.to.instance) })).filter(e => e.a && e.b) as { c: StudioCable; a: Node; b: Node }[];

  return (
    <section className="bg-[#121212] border border-[#2a2a2a] rounded-xl p-2.5" aria-label="Studio map">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-1 px-0.5">
        <h3 className="font-bold text-white text-sm">Signal flow</h3>
        <Legend />
      </div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 860 ${height}`} width={860} height={height} className="max-w-full h-auto min-w-[640px]" role="img" aria-label="How the instruments are clocked, wired and routed">
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#9ca3af" />
            </marker>
          </defs>
          {/* clock sync (MIDI-clock style) */}
          {syncEdges.map(e => {
            const a = pos(e.from)!, b = pos(e.to)!;
            return <path key={`s${e.to}`} d={curve(a.x + NODE_W, a.y + NODE_H / 2, b.x, b.y + NODE_H / 2)} stroke="#64748b" strokeWidth={1.5} strokeDasharray="2 4" fill="none" />;
          })}
          {/* audio routes */}
          {routeEdges.map(e => {
            const a = pos(e.from)!, b = pos(e.to)!;
            const y2 = b.y + NODE_H / 2 + (e.slot ?? 0);
            const on = e.from === 'master' || audible.has(e.from) || nodes.find(n => n.id === e.from)?.kind === 'mixer';
            return (
              <g key={`r${e.from}`}>
                <path d={curve(a.x + NODE_W, a.y + NODE_H / 2, b.x, y2)} stroke={on ? '#9ca3af' : '#4b5563'} strokeWidth={2} fill="none" markerEnd="url(#arrow)" opacity={on ? 0.9 : 0.5} />
                {e.label && (
                  <text x={b.x - 6} y={y2 - 4} textAnchor="end" fontSize={10} fill="#d1d5db">{e.label}</text>
                )}
              </g>
            );
          })}
          {/* patch cables between instruments */}
          {cableEdges.map(({ c, a, b }) => {
            const ax = a.kind === 'clock' ? a.x + NODE_W : a.x, bx = b.x;
            const ay = a.y + NODE_H / 2, by = b.y + NODE_H / 2;
            const sameCol = Math.abs(a.x - b.x) < 4;
            const d = sameCol
              ? `M ${a.x} ${ay} C ${a.x - 60} ${ay}, ${b.x - 60} ${by}, ${b.x} ${by}`
              : curve(ax, ay, bx, by);
            const color = c.color ?? '#f97316';
            return (
              <g key={`c${c.from.instance}${c.from.jack}${c.to.instance}${c.to.jack}`}>
                <path d={d} stroke="rgba(0,0,0,0.6)" strokeWidth={6} fill="none" />
                <path d={d} stroke={color} strokeWidth={3.5} fill="none" strokeLinecap="round">
                  <title>{`${a.label} ${jackName(c.from)} → ${b.label} ${jackName(c.to)}`}</title>
                </path>
                <text x={(ax + bx) / 2} y={(ay + by) / 2 - 6} textAnchor="middle" fontSize={10} fill={color} fontWeight={700}>
                  {jackName(c.from)} → {jackName(c.to)}
                </text>
              </g>
            );
          })}
          {nodes.map(n => (
            <g
              key={n.id}
              transform={`translate(${n.x},${n.y})`}
              onClick={() => n.kind !== 'master' && n.id !== '__transport' && onFocus(n.id)}
              style={{ cursor: n.kind === 'master' || n.id === '__transport' ? 'default' : 'pointer' }}
              role={n.kind === 'master' || n.id === '__transport' ? undefined : 'button'}
              aria-label={n.kind === 'master' || n.id === '__transport' ? undefined : `Open ${n.label}`}
            >
              <rect width={NODE_W} height={NODE_H} rx={7} fill="#1c1c1c" stroke={n.color} strokeWidth={1.5} opacity={off?.[n.id] ? 0.45 : 1} />
              <rect width={5} height={NODE_H} rx={2} fill={n.color} />
              <text x={13} y={17} fontSize={12} fontWeight={700} fill="#f3f4f6">{truncate(n.label, 21)}</text>
              <text x={13} y={31} fontSize={10} fill="#9ca3af">{truncate(n.sub, 28)}</text>
            </g>
          ))}
        </svg>
      </div>
    </section>
  );
}

function Legend() {
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-gray-400">
      <span className="flex items-center gap-1"><svg width="22" height="6"><line x1="0" y1="3" x2="22" y2="3" stroke="#9ca3af" strokeWidth="2" /></svg>audio</span>
      <span className="flex items-center gap-1"><svg width="22" height="6"><line x1="0" y1="3" x2="22" y2="3" stroke="#64748b" strokeWidth="1.5" strokeDasharray="2 4" /></svg>follows the clock (like MIDI clock)</span>
      <span className="flex items-center gap-1"><svg width="22" height="6"><line x1="0" y1="3" x2="22" y2="3" stroke="#38bdf8" strokeWidth="3.5" /></svg>patch cable (clock, trigger, CV, audio)</span>
    </span>
  );
}

function curve(x1: number, y1: number, x2: number, y2: number) {
  const dx = Math.max(30, (x2 - x1) * 0.5);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function jackName(end: { instance: string; jack: string }) {
  const device = useStudioStore.getState().deviceOf(end.instance);
  const pb = hub.getModule(device)?.spec.patchBay;
  const j = pb ? [...pb.inputs, ...pb.outputs].find(x => x.id === end.jack) : undefined;
  return j?.label ?? end.jack.replace(/^(out|in)_/, '').toUpperCase();
}

function buildLayout(
  rack: RackSlot[], routes: Record<string, string>, sync: Record<string, boolean>,
  mixer: ReturnType<typeof useStudioStore.getState>['studio']['mixer'], off: Record<string, boolean>,
) {
  const mod = (r: RackSlot) => hub.getModule(r.device);
  // A mixer only counts once it exposes inputs other instruments can be routed into
  const isMixer = (r: RackSlot) => !!mod(r)?.studio?.mixerInputs?.length;
  const clocks = rack.filter(r => r.device === 'studio-clock');
  const mixers = rack.filter(r => isMixer(r) && !clocks.includes(r));
  const insts = rack.filter(r => !clocks.includes(r) && !mixers.includes(r));
  const synced = insts.concat(mixers).filter(r => mod(r)?.studio?.midiSync && sync[r.id] !== false);

  const nodes: Node[] = [];
  const rows = Math.max(insts.length, mixers.length, 1);
  const height = Math.max(rows * (NODE_H + GAP) + 16, NODE_H * 2 + 40);
  const top = (n: number) => (height - (n * (NODE_H + GAP) - GAP)) / 2;

  // clock column: the Studio Clock device, or the top-bar transport when only MIDI-style sync is used
  const clockNodes = clocks.length ? clocks : synced.length ? [{ id: '__transport', device: '__transport' } as RackSlot] : [];
  clockNodes.forEach((r, i) => {
    nodes.push({
      id: r.id, x: COL[0], y: top(clockNodes.length) + i * (NODE_H + GAP),
      label: r.id === '__transport' ? 'Studio tempo' : instanceLabel(rack, r.id),
      sub: r.id === '__transport' ? 'top bar ▶ and BPM' : 'master clock',
      color: '#94a3b8', kind: 'clock',
    });
  });
  const routeEdges: { from: string; to: string; label?: string; slot?: number }[] = [];
  insts.forEach((r, i) => {
    const ch = channelOf(mixer, r.id);
    const route = routes[r.id] ?? 'master';
    const [mx, input] = route.split(':');
    const mxSlot = mixers.find(m => m.id === mx);
    const target = route !== 'master' && mxSlot && mod(mxSlot)?.studio?.mixerInputs?.some(x => x.id === input) ? mx : 'master';
    const inputLabel = target !== 'master' ? mod(rack.find(x => x.id === mx)!)?.studio?.mixerInputs?.find(x => x.id === input)?.label ?? input?.replace(/^studio_/, 'CH ').toUpperCase() : undefined;
    const tags = [
      mod(r)?.studio?.midiSync ? (sync[r.id] !== false ? 'synced' : 'own clock') : null,
      ch.mute ? 'muted' : ch.solo ? 'solo' : null,
      ch.sendA > MIN_DB ? 'A' : null,
      ch.sendB > MIN_DB ? 'B' : null,
      off[r.id] ? 'OFF' : null,
    ].filter(Boolean);
    nodes.push({
      id: r.id, x: COL[1], y: top(insts.length) + i * (NODE_H + GAP),
      label: instanceLabel(rack, r.id), sub: tags.join(' · ') || (mod(r)?.spec.manufacturer ?? ''),
      color: deviceColor(r.device), kind: 'inst',
    });
    routeEdges.push({ from: r.id, to: target, label: inputLabel });
  });
  mixers.forEach((r, i) => {
    nodes.push({
      id: r.id, x: COL[2], y: top(mixers.length) + i * (NODE_H + GAP),
      label: instanceLabel(rack, r.id), sub: 'mixer', color: deviceColor(r.device), kind: 'mixer',
    });
    routeEdges.push({ from: r.id, to: 'master' });
  });
  nodes.push({ id: 'master', x: COL[3], y: (height - NODE_H) / 2, label: 'Master', sub: 'limiter -1 dBTP → speakers', color: '#fbbf24', kind: 'master' });
  // spread arrows arriving at the same node
  const count: Record<string, number> = {};
  routeEdges.forEach(e => { count[e.to] = (count[e.to] ?? 0) + 1; });
  const seen: Record<string, number> = {};
  routeEdges.forEach(e => {
    const n = count[e.to];
    const k = (seen[e.to] = (seen[e.to] ?? -1) + 1);
    e.slot = n > 1 ? (k - (n - 1) / 2) * Math.min(6, 30 / n) : 0;
  });
  const clockId = clockNodes[0]?.id;
  const syncEdges = clockId ? synced.map(r => ({ from: clockId, to: r.id })) : [];
  return { nodes, height, routeEdges, syncEdges };
}
