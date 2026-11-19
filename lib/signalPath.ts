// ============================================================================
// Signal path diagram: geometry
//
// A device's `spec.signalFlow` sections that carry `at` are the blocks of its
// signal path, placed on a grid by hand from the facts of the maker's flow chart
// (which blocks there are, their order, what feeds and what moves what).
// This file turns them into rectangles and wires. It has no React in it, so the
// validator (scripts/validate-devices.ts) checks the same drawing the screen
// shows: a wire that would run through a block is reported there.
//
// Two kinds of wire, as in the manuals:
//   audio   - solid, right angles, left to right (`to`)
//   control - dashed, from an envelope, LFO or sequencer to what it moves (`mods`)
// Wires are drawn under the blocks, so nothing ever crosses a label.
// ============================================================================

import type { SignalFlowSection } from '@/types';
import { pathSections } from './signalPathBlocks';

export { blockLabel, blockLinks, blockOfControl, blockTargets, pathSections } from './signalPathBlocks';

/** Cell size and gutters, in CSS px: a block is 44 px high, the touch minimum */
export const CELL_W = 84;
export const CELL_H = 44;
export const GAP_X = 22;
export const GAP_Y = 14;
const PAD = 8;
/** Arrowhead length */
const HEAD = 6;
/** Corner radius of a wire's bends */
const BEND = 5;
/** Distance between two wires that run side by side outside the blocks */
const LANE = 8;

export interface PathBlock {
  id: string;
  section: SignalFlowSection;
  role: 'audio' | 'control';
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
}

export interface PathWire {
  from: string;
  /** '*' for a modulator whose destinations the player chooses */
  to: string;
  kind: 'audio' | 'control';
  /** SVG path */
  d: string;
  /** Arrowhead: tip and the direction it points (radians) */
  tip: [number, number];
  angle: number;
  /** Control wires: what the source moves at the target */
  what?: string;
  /** An arrowhead at the start too: the two blocks act on each other */
  tail?: { tip: [number, number]; angle: number };
  /** The straight runs of an audio wire: the validator checks them against the blocks */
  runs: [number, number, number, number][];
}

export interface PathLayout {
  blocks: PathBlock[];
  byId: Record<string, PathBlock>;
  wires: PathWire[];
  /** Where an audio wire branches off another */
  dots: { x: number; y: number; from: string }[];
  /** Where the path leaves the instrument: the word at the end of an arrow (`to: ['>Out']`) */
  labels: { x: number; y: number; text: string; from: string }[];
  width: number;
  height: number;
}

type Pt = [number, number];
type Side = 'top' | 'bottom' | 'left' | 'right';
/** A path as commands with numbers, so it can be measured and moved before it becomes a string */
type Cmd = [string, ...number[]];

const r1 = (n: number) => Math.round(n * 10) / 10;
const toD = (cmds: Cmd[]) => cmds.map(c => `${c[0]} ${c.slice(1).map(n => r1(n as number)).join(' ')}`).join(' ');

/** A line through `pts` with rounded bends */
function elbow(pts: Pt[], radius = BEND): Cmd[] {
  const out: Cmd[] = [['M', pts[0][0], pts[0][1]]];
  for (let i = 1; i < pts.length; i++) {
    const [x, y] = pts[i];
    const next = pts[i + 1];
    if (!next) { out.push(['L', x, y]); break; }
    const [px, py] = pts[i - 1];
    const r = Math.min(radius, Math.hypot(x - px, y - py) / 2, Math.hypot(next[0] - x, next[1] - y) / 2);
    const ax = x - Math.sign(x - px) * r, ay = y - Math.sign(y - py) * r;
    const bx = x + Math.sign(next[0] - x) * r, by = y + Math.sign(next[1] - y) * r;
    out.push(['L', ax, ay], ['Q', x, y, bx, by]);
  }
  return out;
}

/** Spread `n` points along a side of length `len` */
const slot = (len: number, i: number, n: number) => (len * (i + 1)) / (n + 1);

export function layoutSignalPath(flow: SignalFlowSection[]): PathLayout {
  const sections = pathSections(flow);
  const blocks: PathBlock[] = sections.map(s => {
    const [c, r] = s.at!;
    const [sw, sh] = s.size ?? [1, 1];
    const x = c * (CELL_W + GAP_X);
    const y = r * (CELL_H + GAP_Y);
    const w = sw * CELL_W + (sw - 1) * GAP_X;
    const h = sh * CELL_H + (sh - 1) * GAP_Y;
    return { id: s.id, section: s, role: s.role ?? 'audio', x, y, w, h, cx: x + w / 2, cy: y + h / 2 };
  });
  const byId: Record<string, PathBlock> = {};
  blocks.forEach(b => { byId[b.id] = b; });
  if (!blocks.length) return { blocks, byId, wires: [], dots: [], labels: [], width: 0, height: 0 };

  const box = {
    x0: Math.min(...blocks.map(b => b.x)), y0: Math.min(...blocks.map(b => b.y)),
    x1: Math.max(...blocks.map(b => b.x + b.w)), y1: Math.max(...blocks.map(b => b.y + b.h)),
  };
  interface Draft { from: string; to: string; kind: 'audio' | 'control'; cmds: Cmd[]; tip: Pt; angle: number; what?: string; pts: Pt[]; tail?: { tip: Pt; angle: number } }
  const drafts: Draft[] = [];
  const dots: { x: number; y: number; from: string }[] = [];
  const labels: { x: number; y: number; text: string; from: string }[] = [];
  /** Width of a label at the end of an arrow (10 px condensed capitals) */
  const labelWidth = (text: string) => text.length * 6.4 + 4;

  // ---- audio wires ----------------------------------------------------------
  // Wires into the left side of a block: each at its source's own height when that falls
  // on the side (a straight line), else spread along it
  const leftIn: Record<string, PathBlock[]> = {};
  const overlapY = (a: PathBlock, b: PathBlock) => a.y < b.y + b.h && a.y + a.h > b.y;
  const intoSide = (s: PathBlock, t: PathBlock) => t.x >= s.x + s.w && (overlapY(s, t) || t.x - (s.x + s.w) <= GAP_X + 1);
  blocks.forEach(s => (s.section.to ?? []).forEach(id => {
    const t = byId[id];
    if (t && intoSide(s, t)) (leftIn[id] ??= []).push(s);
  }));
  const entries: Record<string, number[]> = {};
  const entryY = (t: PathBlock, s: PathBlock): number => {
    const all = [...(leftIn[t.id] ?? [])].sort((a, b) => a.cy - b.cy);
    if (!entries[t.id]) {
      // each at its own height where that is on the side, the others at the nearest end of it,
      // then pushed apart so no two arrowheads touch
      const lo = t.y + 9, hi = t.y + t.h - 9;
      const ys = all.map(b => Math.max(lo, Math.min(hi, b.cy)));
      for (let i = 1; i < ys.length; i++) ys[i] = Math.max(ys[i], ys[i - 1] + 11);
      const over = ys.length ? ys[ys.length - 1] - hi : 0;
      if (over > 0) {
        for (let i = ys.length - 1; i >= 0; i--) ys[i] = Math.min(ys[i], hi - (ys.length - 1 - i) * 11);
        if (ys[0] < lo) ys.forEach((_, i) => { ys[i] = t.y + slot(t.h, i, ys.length); });
      }
      entries[t.id] = ys;
    }
    return entries[t.id][all.indexOf(s)];
  };
  blocks.forEach(s => (s.section.to ?? []).forEach(id => {
    if (id.startsWith('>')) {
      // where the path leaves the instrument: a short arrow and a word
      const x0 = s.x + s.w, x1 = x0 + 16;
      const text = id.slice(1).toUpperCase();
      drafts.push({ from: s.id, to: id, kind: 'audio', cmds: [['M', x0, s.cy], ['L', x1, s.cy]], tip: [x1, s.cy], angle: 0, pts: [[x0, s.cy], [x1, s.cy]] });
      labels.push({ x: x1 + 4, y: s.cy, text, from: s.id });
      return;
    }
    const t = byId[id];
    if (!t) return;
    let pts: Pt[];
    if (t.x >= s.x + s.w) {
      if (intoSide(s, t)) {
        // forward: out of the right side, into the left side
        const y1 = entryY(t, s);
        const x0 = s.x + s.w, x1 = t.x;
        if (Math.abs(y1 - s.cy) < 0.5) pts = [[x0, s.cy], [x1, y1]];
        else {
          const mid = x1 - GAP_X / 2;
          pts = [[x0, s.cy], [mid, s.cy], [mid, y1], [x1, y1]];
        }
      } else {
        // forward to a block in another row, further along: across, then down or up into it
        const below = t.y >= s.y + s.h;
        pts = [[s.x + s.w, s.cy], [t.cx, s.cy], [t.cx, below ? t.y : t.y + t.h]];
      }
    } else if (t.x + t.w <= s.x) {
      // back (a feedback path): round the outside of both blocks, over the top or under the bottom
      const over = s.cy < (box.y0 + box.y1) / 2 && t.y <= s.y + s.h;
      const lane = over ? Math.min(s.y, t.y) - GAP_Y / 2 - 1 : Math.max(s.y + s.h, t.y + t.h) + GAP_Y / 2 + 1;
      pts = over
        ? [[s.cx, s.y], [s.cx, lane], [t.cx, lane], [t.cx, t.y]]
        : [[s.cx, s.y + s.h], [s.cx, lane], [t.cx, lane], [t.cx, t.y + t.h]];
    } else if (t.y >= s.y + s.h) {
      pts = [[s.cx, s.y + s.h], [s.cx, t.y]]; // straight down
    } else {
      pts = [[s.cx, s.y], [s.cx, t.y + t.h]]; // straight up
    }
    const [ax, ay] = pts[pts.length - 2];
    const [bx, by] = pts[pts.length - 1];
    drafts.push({ from: s.id, to: t.id, kind: 'audio', cmds: elbow(pts), tip: [bx, by], angle: Math.atan2(by - ay, bx - ax), pts });
  }));
  // A dot where a wire leaves the run it shares with another wire of the same block
  blocks.forEach(s => {
    const mine = drafts.filter(w => w.kind === 'audio' && w.from === s.id);
    if (mine.length < 2) return;
    mine.forEach(w => {
      if (w.pts.length < 3) return;
      const [bx, by] = w.pts[1];
      const shared = mine.some(o => o !== w && Math.abs(o.pts[0][1] - by) < 0.5 && Math.abs(o.pts[1][1] - by) < 0.5
        && Math.max(o.pts[0][0], o.pts[1][0]) >= bx - 0.5 && Math.min(o.pts[0][0], o.pts[1][0]) <= bx + 0.5);
      if (shared && !dots.some(d => Math.abs(d.x - bx) < 0.5 && Math.abs(d.y - by) < 0.5)) dots.push({ x: bx, y: by, from: s.id });
    });
  });

  // ---- control wires --------------------------------------------------------
  // Each leaves the side of its block that faces the target and arrives at the side that
  // faces the source. Ends that share a side are spread along it in the order of their other
  // ends, so they fan out without crossing there.
  type Route = 'line' | 'corner' | 'arc' | 'around' | 'stub';
  interface Plan { s: PathBlock; t: PathBlock | null; what: string; route: Route; from: Side; into: Side; both?: boolean }
  interface End { plan: number; other: number; pref?: number }
  const plans: Plan[] = [];
  const sides: Record<string, End[]> = {};
  const key = (id: string, side: Side) => `${id}|${side}`;
  const alongX = (side: Side) => side === 'top' || side === 'bottom';
  const midY = (box.y0 + box.y1) / 2;
  blocks.forEach(s => (s.section.mods ?? []).forEach(m => {
    if (m.quiet) return;
    if (m.to === '*') {
      // out of the chart, away from the blocks: it reaches wherever the player points it
      const from: Side = s.cy > midY ? 'bottom' : 'top';
      const i = plans.push({ s, t: null, what: m.what, route: 'stub', from, into: from }) - 1;
      (sides[key(s.id, from)] ??= []).push({ plan: i, other: s.cx });
      return;
    }
    const t = byId[m.to];
    if (!t || t === s) return;
    const base = { s, t, what: m.what, both: m.both };
    const sameColumn = t.x < s.x + s.w && t.x + t.w > s.x;
    const sameRow = overlapY(s, t);
    const facing: Side = t.x > s.x ? 'right' : 'left';
    const opposite = (side: Side): Side => (side === 'right' ? 'left' : side === 'left' ? 'right' : side === 'top' ? 'bottom' : 'top');
    const vertical: Side = t.y > s.y ? 'bottom' : 'top';
    let plan: Plan;
    if (m.via === 'over' || m.via === 'under') {
      const side: Side = m.via === 'over' ? 'top' : 'bottom';
      plan = { ...base, route: 'arc', from: side, into: side };
    } else if (m.via === 'around-over' || m.via === 'around-under') {
      plan = { ...base, route: 'around', from: m.via === 'around-over' ? 'top' : 'bottom', into: t.cx < s.cx ? 'left' : 'right' };
    } else if (sameColumn) {
      plan = { ...base, route: 'line', from: vertical, into: opposite(vertical) };
    } else if (sameRow) {
      // straight across when nothing stands between them, else an arc round what does
      const between = blocks.some(b => b !== s && b !== t && b.y < Math.max(s.y + s.h, t.y + t.h) && b.y + b.h > Math.min(s.y, t.y)
        && b.x < Math.max(s.x, t.x) && b.x + b.w > Math.min(s.x + s.w, t.x + t.w));
      if (!between) plan = { ...base, route: 'line', from: facing, into: opposite(facing) };
      else {
        const side: Side = s.y <= box.y0 + 1 && t.y <= box.y0 + 1 ? 'top' : 'bottom';
        plan = { ...base, route: 'arc', from: side, into: side };
      }
    } else {
      // diagonal: an S-curve across the gutter when it is wide enough, else round the corner
      const hgap = t.x > s.x ? t.x - (s.x + s.w) : s.x - (t.x + t.w);
      plan = hgap >= 30
        ? { ...base, route: 'line', from: facing, into: opposite(facing) }
        : { ...base, route: 'corner', from: facing, into: opposite(vertical) };
    }
    const i = plans.push(plan) - 1;
    // A straight line needs the same coordinate at both ends: the middle of what the two sides share
    let pref: number | undefined;
    if (plan.route === 'line') {
      const lo = alongX(plan.from) ? Math.max(s.x, t.x) : Math.max(s.y, t.y);
      const hi = alongX(plan.from) ? Math.min(s.x + s.w, t.x + t.w) : Math.min(s.y + s.h, t.y + t.h);
      if (hi - lo >= 10) pref = (lo + hi) / 2;
    }
    (sides[key(s.id, plan.from)] ??= []).push({ plan: i, other: alongX(plan.from) ? t.cx : t.cy, pref });
    (sides[key(t.id, plan.into)] ??= []).push({ plan: i, other: alongX(plan.into) ? s.cx : s.cy, pref });
  }));
  Object.values(sides).forEach(list => list.sort((a, b) => a.other - b.other || a.plan - b.plan));

  // Where audio touches each side, so a control end never lands on an audio end
  const audioAt = (b: PathBlock, side: Side): number[] => {
    const out: number[] = [];
    drafts.forEach(w => {
      if (w.kind !== 'audio') return;
      const ends: Pt[] = [];
      if (w.from === b.id) ends.push(w.pts[0]);
      if (w.to === b.id) ends.push(w.pts[w.pts.length - 1]);
      ends.forEach(([x, y]) => {
        if (side === 'left' && Math.abs(x - b.x) < 0.5) out.push(y);
        if (side === 'right' && Math.abs(x - (b.x + b.w)) < 0.5) out.push(y);
        if (side === 'top' && Math.abs(y - b.y) < 0.5) out.push(x);
        if (side === 'bottom' && Math.abs(y - (b.y + b.h)) < 0.5) out.push(x);
      });
    });
    return out;
  };
  const placed: Record<string, number[]> = {};
  const coordsOf = (b: PathBlock, side: Side): number[] => {
    const k = key(b.id, side);
    if (placed[k]) return placed[k];
    const list = sides[k] ?? [];
    const start = alongX(side) ? b.x : b.y;
    const len = alongX(side) ? b.w : b.h;
    const prefs = list.map(e => e.pref);
    const usePrefs = prefs.every(p => p !== undefined) && prefs.every((p, i) => i === 0 || (p as number) - (prefs[i - 1] as number) >= 8);
    let at = usePrefs ? (prefs as number[]) : list.map((_, i) => start + slot(len, i, list.length));
    // keep clear of audio ends on this side
    const audio = audioAt(b, side);
    at = at.map((c, i) => {
      const hit = audio.find(a => Math.abs(a - c) < 8);
      if (hit === undefined) return c;
      const dir = list[i].other < hit ? -1 : 1;
      return Math.max(start + 5, Math.min(start + len - 5, hit + dir * Math.min(11, len * 0.28)));
    });
    placed[k] = at;
    return at;
  };
  const endOf = (b: PathBlock, side: Side, plan: number): Pt => {
    const list = sides[key(b.id, side)] ?? [];
    const c = coordsOf(b, side)[Math.max(0, list.findIndex(e => e.plan === plan))];
    if (side === 'top') return [c, b.y];
    if (side === 'bottom') return [c, b.y + b.h];
    if (side === 'left') return [b.x, c];
    return [b.x + b.w, c];
  };
  // Lanes outside the blocks for the wires that go round them: each has its own, the shortest
  // nearest the blocks, so one sits inside the other and they never cross on the way
  const outside = plans.map((p, i) => ({ p, i })).filter(({ p }) => p.t && (p.route === 'arc' || p.route === 'around'));
  const laneOf: Record<number, number> = {};
  (['top', 'bottom'] as const).forEach(side => {
    outside.filter(({ p }) => p.from === side)
      .map(({ p, i }) => {
        const x0 = endOf(p.s, p.from, i)[0];
        const far = p.route === 'around' ? (p.into === 'left' ? box.x0 - 1000 : box.x1 + 1000) : endOf(p.t!, p.into, i)[0];
        return { i, span: Math.abs(far - x0) };
      })
      .sort((a, b) => a.span - b.span || a.i - b.i)
      .forEach(({ i }, n) => { laneOf[i] = n; });
  });
  let lanesLeft = 0, lanesRight = 0;
  plans.forEach((p, i) => {
    const [x0, y0] = endOf(p.s, p.from, i);
    if (p.route === 'stub' || !p.t) {
      const dir = p.from === 'top' ? -1 : 1;
      const y1 = y0 + dir * (GAP_Y - 3);
      drafts.push({ from: p.s.id, to: '*', kind: 'control', cmds: [['M', x0, y0], ['L', x0, y1]], tip: [x0, y1], angle: dir * Math.PI / 2, what: p.what, pts: [] });
      return;
    }
    const [x1, y1] = endOf(p.t, p.into, i);
    let cmds: Cmd[];
    let angle: number;
    if (p.route === 'arc') {
      // out, along its lane past everything between, and back in on the same side
      const over = p.from === 'top';
      const yl = over ? box.y0 - LANE * (1 + laneOf[i]) : box.y1 + LANE * (1 + laneOf[i]);
      cmds = elbow([[x0, y0], [x0, yl], [x1, yl], [x1, y1]], 8);
      angle = over ? Math.PI / 2 : -Math.PI / 2;
    } else if (p.route === 'around') {
      const over = p.from === 'top';
      const yl = over ? box.y0 - LANE * (1 + laneOf[i]) : box.y1 + LANE * (1 + laneOf[i]);
      const left = p.into === 'left';
      const xl = left ? box.x0 - LANE * (1 + lanesLeft++) : box.x1 + LANE * (1 + lanesRight++);
      cmds = elbow([[x0, y0], [x0, yl], [xl, yl], [xl, y1], [x1, y1]], 7);
      angle = left ? 0 : Math.PI;
    } else if (p.route === 'corner') {
      cmds = elbow([[x0, y0], [x1, y0], [x1, y1]], 9);
      angle = p.into === 'top' ? Math.PI / 2 : -Math.PI / 2;
    } else if (p.from === 'left' || p.from === 'right') {
      const dir = p.from === 'right' ? 1 : -1;
      const k = Math.abs(x1 - x0) * 0.5;
      cmds = Math.abs(y1 - y0) < 0.5 ? [['M', x0, y0], ['L', x1, y1]] : [['M', x0, y0], ['C', x0 + dir * k, y0, x1 - dir * k, y1, x1, y1]];
      angle = dir > 0 ? 0 : Math.PI;
    } else {
      const dir = p.from === 'bottom' ? 1 : -1;
      const k = Math.max(6, Math.abs(y1 - y0) * 0.5);
      cmds = Math.abs(x1 - x0) < 0.5 ? [['M', x0, y0], ['L', x1, y1]] : [['M', x0, y0], ['C', x0, y0 + dir * k, x1, y1 - dir * k, x1, y1]];
      angle = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    const tailAngle: Record<Side, number> = { top: Math.PI / 2, bottom: -Math.PI / 2, left: 0, right: Math.PI };
    drafts.push({
      from: p.s.id, to: p.t.id, kind: 'control', cmds, tip: [x1, y1], angle, what: p.what, pts: [],
      tail: p.both ? { tip: [x0, y0], angle: tailAngle[p.from] } : undefined,
    });
  });

  // ---- fit: everything drawn, moved so the top left corner is at the padding ----
  let minX = box.x0, minY = box.y0, maxX = box.x1, maxY = box.y1;
  const grow = (x: number, y: number) => {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  };
  drafts.forEach(w => {
    let prev: Pt = [0, 0];
    w.cmds.forEach(c => {
      const n = c.slice(1) as number[];
      if (c[0] === 'C') {
        // where the curve really goes: sample it (its handles lie well outside it)
        for (let k = 1; k <= 8; k++) {
          const t = k / 8, u = 1 - t;
          const bx = u * u * u * prev[0] + 3 * u * u * t * n[0] + 3 * u * t * t * n[2] + t * t * t * n[4];
          const by = u * u * u * prev[1] + 3 * u * u * t * n[1] + 3 * u * t * t * n[3] + t * t * t * n[5];
          grow(bx, by - 2); grow(bx, by + 2);
        }
      } else {
        for (let k = 0; k + 1 < n.length; k += 2) grow(n[k], n[k + 1]);
      }
      prev = [n[n.length - 2], n[n.length - 1]];
    });
  });
  labels.forEach(l => grow(l.x + labelWidth(l.text), l.y));
  const dx = PAD - minX, dy = PAD - minY;
  blocks.forEach(b => { b.x += dx; b.y += dy; b.cx += dx; b.cy += dy; });
  const wires: PathWire[] = drafts.map(w => ({
    from: w.from, to: w.to, kind: w.kind, what: w.what, angle: w.angle,
    d: toD(w.cmds.map(c => [c[0], ...c.slice(1).map((n, i) => (n as number) + (i % 2 === 0 ? dx : dy))] as Cmd)),
    tip: [w.tip[0] + dx, w.tip[1] + dy],
    tail: w.tail ? { tip: [w.tail.tip[0] + dx, w.tail.tip[1] + dy], angle: w.tail.angle } : undefined,
    runs: w.pts.slice(1).map((p, i) => [w.pts[i][0] + dx, w.pts[i][1] + dy, p[0] + dx, p[1] + dy] as [number, number, number, number]),
  }));
  return {
    blocks, byId, wires,
    dots: dots.map(d => ({ x: d.x + dx, y: d.y + dy, from: d.from })),
    labels: labels.map(l => ({ ...l, x: l.x + dx, y: l.y + dy })),
    width: Math.ceil(maxX + dx + PAD), height: Math.ceil(maxY + dy + PAD),
  };
}

/** The three points of an arrowhead at a wire's end */
export function arrowHead(w: { tip: [number, number]; angle: number }, size = HEAD): string {
  const [x, y] = w.tip;
  const a = w.angle;
  const p = (da: number) => `${r1(x - size * Math.cos(a + da))},${r1(y - size * Math.sin(a + da))}`;
  return `${r1(x)},${r1(y)} ${p(0.45)} ${p(-0.45)}`;
}

/** Audio wires that run through a block they don't belong to (the validator reports them) */
export function wireCrossings(layout: PathLayout): string[] {
  const out: string[] = [];
  for (const w of layout.wires) {
    if (w.kind !== 'audio') continue;
    for (const b of layout.blocks) {
      if (b.id === w.from || b.id === w.to) continue;
      const hit = w.runs.some(([x0, y0, x1, y1]) => {
        const lx = Math.min(x0, x1), hx = Math.max(x0, x1), ly = Math.min(y0, y1), hy = Math.max(y0, y1);
        return lx < b.x + b.w - 1 && hx > b.x + 1 && ly < b.y + b.h - 1 && hy > b.y + 1;
      });
      if (hit) out.push(`the wire ${w.from} > ${w.to} runs through ${b.id}`);
    }
  }
  return out;
}

/** Blocks that share a cell */
export function blockOverlaps(layout: PathLayout): string[] {
  const out: string[] = [];
  layout.blocks.forEach((a, i) => layout.blocks.slice(i + 1).forEach(b => {
    if (a.x < b.x + b.w - 1 && a.x + a.w > b.x + 1 && a.y < b.y + b.h - 1 && a.y + a.h > b.y + 1) out.push(`${a.id} and ${b.id} overlap`);
  }));
  return out;
}
