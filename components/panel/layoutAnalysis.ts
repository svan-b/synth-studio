// ============================================================================
// Panel layout analysis (pure functions, memoised by SynthPanel)
//
//   geometry   every element's drawn body in native px, its control ids, which
//              control a free-standing legend belongs to (so focus mode can dim a
//              control together with its printed legend), and the distance to the
//              nearest neighbour (so touch targets can grow to 44 px without
//              stealing a neighbour's touches)
//   text fits  every piece of text the panel draws, raised to a legible size for
//              the current zoom and fitted to the room it has (lib/controls/textFit)
// ============================================================================

import type { ButtonSpec, DeviceSpec, KnobSpec, SliderSpec, SwitchSpec } from '@/types';
import type { PanelElement, PanelLayout } from '@/types/panel';
import { FLOOR_CONTROL, FLOOR_SMALL, FONTS, ensureContrast, fitText, floorPx, measureText, type TextFit } from '@/lib/controls/textFit';
import { formatValue } from '@/lib/controls/mapping';
import { switchFonts } from '@/components/controls/Switch';

export interface Rect { x: number; y: number; w: number; h: number }

export interface ElementInfo {
  kind: PanelElement['kind'];
  /** Drawn body in native px (null for labels, sections, custom overlays) */
  body: Rect | null;
  cx: number;
  cy: number;
  /** Static control/jack/event ids (knobs and step grids bound by a function resolve at render) */
  ids: string[];
  /** Labels: index of the control element this legend belongs to, or -1 */
  owner: number;
  /** Centre distance to the nearest other control-like element, native px */
  nearest: number;
}

const CONTROL_KINDS = new Set(['knob', 'slider', 'switch', 'button', 'jack']);
const JACK_MM = 6.2;

/** Rough drawn size of a switch (matches components/controls/Switch at its native fonts) */
function switchBox(el: Extract<PanelElement, { kind: 'switch' }>, spec: SwitchSpec | undefined, labelFont: number, legendFont: number, family: string) {
  const s = el.scale ?? 1;
  const opts = spec?.options ?? [];
  const n = Math.max(1, opts.length);
  const style = el.style ?? 'toggle';
  const vertical = (el.orientation ?? 'vertical') === 'vertical';
  const hasHeader = (el.label ?? 'above') !== 'none' && !!(el.labelText ?? spec?.label);
  const headerH = hasHeader ? labelFont + 2 : 0;
  const legendW = opts.length ? Math.max(...opts.map(o => measureText(o, legendFont, 700, family))) : 0;
  let w: number;
  let h: number;
  if (style === 'buttons') {
    const bw = (o: string) => Math.max(16 * s, measureText(o, legendFont + 1, 700, family) + 8 * s + 2);
    const bh = legendFont + 1 + 4 * s + 2;
    if (vertical) { w = Math.max(...opts.map(bw), 16 * s) + 4; h = n * (bh + 2) + 2; }
    else { w = opts.reduce((a, o) => a + bw(o) + 2, 2); h = bh + 4; }
  } else if (style === 'rotary') {
    const d = 22 * s;
    w = d * 2.2;
    h = d * 2;
  } else {
    const trackLong = (n === 3 ? 20 : 16) * s;
    const trackShort = 12 * s;
    if (vertical) { w = trackShort + 2 + legendW; h = Math.max(trackLong, n * legendFont * 1.08); }
    else { w = Math.max(trackLong, opts.reduce((a, o) => a + measureText(o, legendFont, 700, family) + 4, -4)); h = trackShort + 2 + legendFont; }
  }
  return { w, h, headerH, totalH: headerH + h };
}

export function analyseLayout(layout: PanelLayout, spec: DeviceSpec): ElementInfo[] {
  const k = layout.pxPerMm;
  const family = layout.theme.font ?? FONTS.sans;
  const infos: ElementInfo[] = layout.elements.map(el => {
    const cx = el.x * k;
    const cy = el.y * k;
    let body: Rect | null = null;
    let ids: string[] = [];
    switch (el.kind) {
      case 'knob': {
        const d = (el.diameter ?? 12) * k;
        body = { x: cx - d / 2, y: cy - d / 2, w: d, h: d };
        if (typeof el.control === 'string') ids = [el.control];
        break;
      }
      case 'slider': {
        const vertical = (el.orientation ?? 'vertical') === 'vertical';
        const len = el.length * k;
        const w = vertical ? 30 : len + 22;
        const h = vertical ? len + 22 : 30;
        body = { x: cx - w / 2, y: cy - h / 2, w, h };
        ids = [el.control];
        break;
      }
      case 'switch': {
        const sp = spec.controls[el.control] as SwitchSpec | undefined;
        const f = switchFonts(el.scale ?? 1);
        const b = switchBox(el, sp?.type === 'switch' ? sp : undefined, f.label, f.legend, family);
        body = { x: cx - b.w / 2, y: cy - b.totalH / 2 + b.headerH, w: b.w, h: b.h };
        ids = [el.control];
        break;
      }
      case 'button': {
        const w = (el.w ?? 7) * k;
        const h = el.shape === 'rect' ? (el.h !== undefined ? el.h * k : w * 0.6) : w;
        body = { x: cx - w / 2, y: cy - h / 2, w, h };
        ids = [el.control, el.event].filter((x): x is string => !!x);
        break;
      }
      case 'jack': {
        const d = JACK_MM * k;
        body = { x: cx - d / 2, y: cy - d / 2, w: d, h: d };
        ids = [el.jack];
        break;
      }
      case 'led': {
        const d = (el.size ?? 2.5) * k;
        body = { x: cx - d / 2, y: cy - d / 2, w: d, h: d };
        break;
      }
      case 'display':
      case 'keyboard':
      case 'stepgrid':
        body = { x: cx, y: cy, w: el.w * k, h: el.h * k };
        if (el.kind === 'stepgrid' && typeof el.control === 'string') ids = [el.control];
        break;
      default:
        break;
    }
    return { kind: el.kind, body, cx, cy, ids, owner: -1, nearest: Infinity };
  });

  // Nearest neighbour between control-like elements (touch target budget)
  const ctrl = infos.map((inf, i) => (CONTROL_KINDS.has(inf.kind) ? i : -1)).filter(i => i >= 0);
  for (const i of ctrl) {
    let best = Infinity;
    for (const j of ctrl) {
      if (i === j) continue;
      const dd = Math.hypot(infos[i].cx - infos[j].cx, infos[i].cy - infos[j].cy);
      if (dd < best) best = dd;
    }
    infos[i].nearest = best;
  }

  // Which control a free-standing legend belongs to: the nearest control body, preferring
  // one just below the text (legends are printed above their control) and nothing far away
  const maxDist = 14 * k;
  layout.elements.forEach((el, i) => {
    if (el.kind !== 'label') return;
    let best = -1;
    let bestCost = Infinity;
    for (const j of ctrl) {
      const b = infos[j].body;
      if (!b) continue;
      const dx = Math.max(b.x - infos[i].cx, 0, infos[i].cx - (b.x + b.w));
      const dyBelow = b.y - infos[i].cy;            // > 0: the control is below the text
      const dyAbove = infos[i].cy - (b.y + b.h);    // > 0: the control is above the text
      const dy = Math.max(dyBelow, dyAbove, 0);
      const cost = Math.hypot(dx, dy * (dyBelow > 0 ? 0.75 : 1.25));
      if (cost < bestCost) { bestCost = cost; best = j; }
    }
    infos[i].owner = bestCost <= maxDist ? best : -1;
  });
  return infos;
}

// ---- text fits ----------------------------------------------------------------------

export interface PanelTextFits {
  /** Per element: its main text (label element, knob/slider/button/jack legend, switch header) */
  label: (TextFit | undefined)[];
  /** Knob/slider readouts */
  value: (TextFit | undefined)[];
  /** Switch position legends, button cap text, step-grid numbers */
  legend: (TextFit | undefined)[];
  /** Section titles */
  title: (TextFit | undefined)[];
}

interface Slot {
  i: number;
  part: 'label' | 'value' | 'legend' | 'title';
  text: string;
  /** Authored size */
  size: number;
  /** Rendered CSS px floor */
  floorCss: number;
  weight: number;
  family: string;
  ls: number;
  /** Extra width the box adds around the text (padding, border) */
  padW: number;
  lines: number;
  lh: number;
  /** Horizontal anchor: centre x, or the fixed edge for left/right aligned text */
  ax: number;
  align: 'center' | 'left' | 'right';
  /** Vertical: 'bottom' = bottom edge fixed (text above a control), 'top', or 'center' */
  vAnchor: 'bottom' | 'top' | 'center';
  ay: number;
  /** Hard cap on width (e.g. a section's width, a button's face) */
  capW?: number;
  /** Element whose body this text belongs to (not an obstacle for it) */
  own: number;
  color?: string;
  bg?: string;
  /** Never resize (fixed labels, large artwork) */
  fixed?: boolean;
  // computed
  want: number;
  w: number;
  band: [number, number];
}

const GAP = 3;

export interface TextInputs {
  /** Label text per element (resolved for function-bound encoders), undefined = none */
  labels: (string | undefined)[];
  /** Control spec per element for readouts (knobs/sliders) */
  valueSpecs: (KnobSpec | SliderSpec | undefined)[];
}

export function computeTextFits(layout: PanelLayout, spec: DeviceSpec, geo: ElementInfo[], scale: number, inputs: TextInputs): PanelTextFits {
  const k = layout.pxPerMm;
  const theme = layout.theme;
  const family = theme.font ?? FONTS.sans;
  const n = layout.elements.length;
  const out: PanelTextFits = { label: new Array(n), value: new Array(n), legend: new Array(n), title: new Array(n) };
  const fSmall = floorPx(FLOOR_SMALL, scale);
  const fControl = floorPx(FLOOR_CONTROL, scale);
  const slots: Slot[] = [];

  // Background behind a point: the topmost section with a solid background, else the faceplate
  const sections = layout.elements
    .map((el, i) => ({ el, i }))
    .filter((x): x is { el: Extract<PanelElement, { kind: 'section' }>; i: number } => x.el.kind === 'section' && !!x.el.background && x.el.background !== 'transparent');
  const bgAt = (x: number, y: number) => {
    for (let s = sections.length - 1; s >= 0; s--) {
      const el = sections[s].el;
      if (x >= el.x * k && x <= (el.x + el.w) * k && y >= el.y * k && y <= (el.y + el.h) * k) return el.background;
    }
    return theme.background;
  };

  const add = (s: Omit<Slot, 'want' | 'w' | 'band'>) => slots.push({ ...s, want: s.size, w: 0, band: [0, 0] });

  layout.elements.forEach((el, i) => {
    const g = geo[i];
    const text = inputs.labels[i];
    switch (el.kind) {
      case 'label': {
        if (el.rotate) return;
        const big = (el.size ?? 8) >= 14;
        const legend = g.owner >= 0;
        add({
          i, part: 'label', text: el.text, size: el.size ?? 8, floorCss: legend ? FLOOR_CONTROL : FLOOR_SMALL,
          weight: el.weight ?? 700, family: el.font ? FONTS[el.font] : family, ls: el.letterSpacing ?? 0,
          padW: el.invert ? 6 : 0, lines: el.text.split('\n').length, lh: 1, ax: g.cx, align: el.align ?? 'center',
          // The legend's own control is an obstacle too: the text must not grow into it
          vAnchor: 'center', ay: g.cy, own: -1, color: el.invert ? theme.jack?.outputLabelText ?? '#000' : el.color ?? theme.text,
          bg: el.invert ? theme.jack?.outputLabelBg ?? '#fff' : bgAt(g.cx, g.cy), fixed: el.fixed || big,
        });
        return;
      }
      case 'knob': {
        const d = (el.diameter ?? 12) * k;
        const pos = el.label ?? 'above';
        const vs = inputs.valueSpecs[i];
        const valueOn = (el.value ?? 'always') === 'always' && !!vs;
        const valueSize = d >= 30 ? 9 : 8;
        if (text && pos !== 'none') {
          const gap = (el.variant ?? 'moog-silver') === 'moog-silver' ? 2 : 4;
          const base = { i, part: 'label' as const, text, size: d >= 50 ? 10 : d >= 36 ? 9 : d >= 26 ? 8 : 7, floorCss: FLOOR_CONTROL, weight: 700, family, ls: 0.3, padW: 0, lines: text.split('\n').length, lh: 1.05, own: i, color: theme.text, bg: bgAt(g.cx, g.cy) };
          if (pos === 'above') add({ ...base, ax: g.cx, align: 'center', vAnchor: 'bottom', ay: g.cy - d / 2 - gap });
          else if (pos === 'below') add({ ...base, ax: g.cx, align: 'center', vAnchor: 'top', ay: g.cy + d / 2 + gap + Math.max(valueSize, fSmall) * 1.15 + 5 });
          else if (pos === 'left') add({ ...base, ax: g.cx - d / 2 - gap - 4, align: 'right', vAnchor: 'center', ay: g.cy });
          else add({ ...base, ax: g.cx + d / 2 + gap + 4, align: 'left', vAnchor: 'center', ay: g.cy });
        }
        if (valueOn && vs) {
          const samples = [vs.min, vs.max, vs.default, (vs.min + vs.max) / 2].map(v => formatValue(vs, v));
          const widest = samples.reduce((a, b) => (measureText(b, 10, 400, FONTS.mono) > measureText(a, 10, 400, FONTS.mono) ? b : a), '');
          add({ i, part: 'value', text: widest, size: valueSize, floorCss: FLOOR_SMALL, weight: 400, family: FONTS.mono, ls: 0, padW: 8, lines: 1, lh: 1.15, ax: g.cx, align: 'center', vAnchor: 'top', ay: g.cy + d / 2 + 3, own: i });
        }
        return;
      }
      case 'slider': {
        if (!text || (el.label ?? 'above') === 'none' || !g.body) return;
        const b = g.body;
        const pos = el.label ?? 'above';
        const base = { i, part: 'label' as const, text, size: 9, floorCss: FLOOR_CONTROL, weight: 700, family, ls: 0, padW: 0, lines: text.split('\n').length, lh: 1, own: i, color: theme.text, bg: bgAt(g.cx, g.cy) };
        if (pos === 'below') add({ ...base, ax: g.cx, align: 'center', vAnchor: 'top', ay: b.y + b.h + 4 });
        else if (pos === 'left') add({ ...base, ax: b.x - 6, align: 'right', vAnchor: 'center', ay: g.cy });
        else if (pos === 'right') add({ ...base, ax: b.x + b.w + 6, align: 'left', vAnchor: 'center', ay: g.cy });
        else add({ ...base, ax: g.cx, align: 'center', vAnchor: 'bottom', ay: b.y - 4 });
        return;
      }
      case 'switch': {
        const sp = spec.controls[el.control] as SwitchSpec | undefined;
        if (!sp || sp.type !== 'switch' || !g.body) return;
        const f = switchFonts(el.scale ?? 1);
        if (text && (el.label ?? 'above') !== 'none') {
          add({ i, part: 'label', text, size: f.label, floorCss: FLOOR_CONTROL, weight: 700, family, ls: 0, padW: 0, lines: text.split('\n').length, lh: 1, ax: g.cx, align: 'center', vAnchor: 'bottom', ay: g.body.y - 2, own: i, color: theme.muted ?? theme.text, bg: bgAt(g.cx, g.cy) });
        }
        // Position legends: fitted as one block (the switch's own width grows with them)
        const style = el.style ?? 'toggle';
        const vertical = (el.orientation ?? 'vertical') === 'vertical';
        const stacked = vertical && style !== 'rotary';
        const longest = sp.options.reduce((a, o) => (measureText(o, 10, 700, family) > measureText(a, 10, 700, family) ? o : a), '');
        const blockText = stacked || style === 'rotary' ? longest : sp.options.join(style === 'buttons' ? '  ' : ' ');
        const s = el.scale ?? 1;
        const lever = style === 'toggle' ? 12 * s + 2 : 0;
        add({
          i, part: 'legend', text: blockText, size: style === 'buttons' ? f.legend + 1 : f.legend, floorCss: FLOOR_SMALL, weight: 700, family, ls: 0,
          padW: style === 'buttons' ? (stacked ? 8 * s + 4 : sp.options.length * (8 * s + 4)) : 0,
          lines: stacked ? sp.options.length : 1, lh: style === 'buttons' ? 1.6 : 1.08,
          ax: style === 'toggle' && vertical ? g.body.x + lever : g.cx, align: style === 'toggle' && vertical ? 'left' : 'center',
          vAnchor: 'center', ay: g.body.y + g.body.h / 2, own: i,
          capW: style === 'rotary' ? 22 * s * 1.1 : undefined,
        });
        return;
      }
      case 'button': {
        const b = g.body!;
        const pos = el.label ?? (text ? 'above' : 'none');
        if (text && pos !== 'none') {
          const base = { i, part: 'label' as const, text: text.toUpperCase(), size: b.w >= 30 ? 8 : 7, floorCss: FLOOR_CONTROL, weight: 700, family, ls: 0.4, padW: 0, lines: text.split('\n').length, lh: 1, own: i, color: theme.muted ?? theme.text, bg: bgAt(g.cx, g.cy) };
          if (pos === 'below') add({ ...base, ax: g.cx, align: 'center', vAnchor: 'top', ay: b.y + b.h + 4 });
          else if (pos === 'left') add({ ...base, ax: b.x - 6, align: 'right', vAnchor: 'center', ay: g.cy });
          else if (pos === 'right') add({ ...base, ax: b.x + b.w + 6, align: 'left', vAnchor: 'center', ay: g.cy });
          else add({ ...base, ax: g.cx, align: 'center', vAnchor: 'bottom', ay: b.y - 4 });
        }
        if (el.capText) {
          add({ i, part: 'legend', text: el.capText, size: Math.max(6, Math.min(10, b.w * 0.22)), floorCss: FLOOR_SMALL, weight: 700, family, ls: 0, padW: 4, lines: 1, lh: 1, ax: g.cx, align: 'center', vAnchor: 'center', ay: g.cy, own: i, capW: b.w });
        }
        return;
      }
      case 'jack': {
        const jp = [...(spec.patchBay?.inputs ?? []), ...(spec.patchBay?.outputs ?? [])].find(j => j.id === el.jack);
        if (!jp || !text) return;
        const pos = el.label ?? 'above';
        if (pos === 'none') return;
        const b = g.body!;
        const isOut = jp.jackType === 'output';
        const base = {
          i, part: 'label' as const, text, size: 6.5, floorCss: FLOOR_SMALL, weight: 700, family, ls: 0, padW: 8, lines: 1, lh: 1, own: i,
          color: isOut ? theme.jack?.outputLabelText ?? '#fff' : theme.muted ?? '#999', bg: isOut ? theme.jack?.outputLabelBg ?? '#000' : bgAt(g.cx, g.cy),
        };
        if (pos === 'below') add({ ...base, ax: g.cx, align: 'center', vAnchor: 'top', ay: b.y + b.h + 2 });
        else if (pos === 'left') add({ ...base, ax: b.x - 3, align: 'right', vAnchor: 'center', ay: g.cy });
        else if (pos === 'right') add({ ...base, ax: b.x + b.w + 3, align: 'left', vAnchor: 'center', ay: g.cy });
        else add({ ...base, ax: g.cx, align: 'center', vAnchor: 'bottom', ay: b.y - 2 });
        return;
      }
      case 'section': {
        if (!el.title) return;
        add({ i, part: 'title', text: el.title, size: 8, floorCss: FLOOR_CONTROL, weight: 700, family, ls: 0.6, padW: 8, lines: 1, lh: 1.2, ax: (el.x + el.w / 2) * k, align: 'center', vAnchor: 'center', ay: el.y * k, own: -1, capW: el.w * k - 4, color: el.titleColor ?? theme.muted ?? theme.text, bg: el.background && el.background !== 'transparent' ? el.background : bgAt(g.cx + 1, g.cy - 1) });
        return;
      }
      default:
        return;
    }
  });

  // Obstacles: drawn bodies of everything but labels, sections and custom overlays
  const obstacles = geo.map((g, i) => ({ i, b: g.body, kind: g.kind })).filter(o => o.b && o.kind !== 'led');

  // 1. preferred size: authored, raised to the floor for this zoom
  for (const s of slots) {
    const floor = s.floorCss === FLOOR_CONTROL ? fControl : fSmall;
    s.want = s.fixed ? s.size : Math.max(s.size, floor);
    // Text above/below a control may not grow into whatever is on its far side
    const hNeed = (sz: number) => s.lines * sz * s.lh + 2;
    const room = verticalRoom(s, obstacles);
    if (room !== Infinity && hNeed(s.want) > room && !s.fixed) s.want = Math.max(s.size, Math.min(s.want, (room - 2) / (s.lines * s.lh)));
    s.w = measureText(s.text, s.want, s.weight, s.family, s.ls) + s.padW;
    s.band = band(s, s.want);
  }

  // 2. room: split gaps with neighbouring text in proportion to need; stop at other controls
  const maxW = slots.map(s => {
    let left = Infinity;
    let right = Infinity;
    const [ex0, ex1] = extent(s, s.w);
    for (const o of slots) {
      if (o === s) continue;
      if (!overlaps(s.band, o.band)) continue;
      const [ox0, ox1] = extent(o, o.w);
      if (ox1 <= ex0 - 40 || ox0 >= ex1 + 40) continue;
      // Shared gap between the two anchors, in proportion to each one's width
      if (ocx(o) <= ocx(s)) {
        const avail = ocx(s) - ocx(o) - GAP;
        const mine = s.align === 'left' ? 0 : s.align === 'right' ? 1 : 0.5;
        const theirs = o.align === 'right' ? 0 : o.align === 'left' ? 1 : 0.5;
        const need = s.w * mine + o.w * theirs;
        if (need > avail && need > 0) left = Math.min(left, (avail * (s.w * mine)) / need);
        else left = Math.min(left, avail - o.w * theirs);
      } else {
        const avail = ocx(o) - ocx(s) - GAP;
        const mine = s.align === 'right' ? 0 : s.align === 'left' ? 1 : 0.5;
        const theirs = o.align === 'left' ? 0 : o.align === 'right' ? 1 : 0.5;
        const need = s.w * mine + o.w * theirs;
        if (need > avail && need > 0) right = Math.min(right, (avail * (s.w * mine)) / need);
        else right = Math.min(right, avail - o.w * theirs);
      }
    }
    for (const o of obstacles) {
      if (o.i === s.own || o.i === s.i) continue;
      const b = o.b!;
      if (!overlaps(s.band, [b.y, b.y + b.h])) continue;
      // Text that already sits on top of this body (art printed over it) is not limited by it
      if (b.x <= ocx(s) && b.x + b.w >= ocx(s)) continue;
      if (b.x + b.w <= ocx(s)) left = Math.min(left, ocx(s) - (b.x + b.w) - GAP);
      else right = Math.min(right, b.x - ocx(s) - GAP);
    }
    let w: number;
    if (s.align === 'center') w = 2 * Math.min(left, right);
    else if (s.align === 'left') w = right;
    else w = left;
    if (s.capW !== undefined) w = Math.min(w, s.capW);
    return Math.max(0, w);
  });

  // 3. fit
  slots.forEach((s, idx) => {
    const floor = s.floorCss === FLOOR_CONTROL ? fControl : fSmall;
    let fit: TextFit;
    if (s.fixed) fit = { size: s.size };
    else if (maxW[idx] === Infinity || s.w <= maxW[idx]) fit = { size: +s.want.toFixed(2) };
    else fit = fitText(s.text, s.want, Math.min(s.want, floor), maxW[idx] - s.padW, s.weight, s.family, s.ls);
    if (s.color && s.bg && !s.fixed) {
      const c = ensureContrast(s.color, s.bg, 4.5);
      if (c) fit.color = c;
    }
    // A legend block or readout is fitted as a whole: keep its text, apply size/condense
    if (s.part === 'legend' || s.part === 'value') { delete fit.text; delete fit.title; }
    out[s.part][s.i] = fit;
  });
  return out;
}

const ocx = (s: Slot) => s.ax;

function extent(s: Slot, w: number): [number, number] {
  if (s.align === 'left') return [s.ax, s.ax + w];
  if (s.align === 'right') return [s.ax - w, s.ax];
  return [s.ax - w / 2, s.ax + w / 2];
}

function band(s: Slot, size: number): [number, number] {
  const h = s.lines * size * s.lh + 2;
  if (s.vAnchor === 'bottom') return [s.ay - h, s.ay];
  if (s.vAnchor === 'top') return [s.ay, s.ay + h];
  return [s.ay - h / 2, s.ay + h / 2];
}

function overlaps(a: [number, number], b: [number, number]) {
  return Math.min(a[1], b[1]) - Math.max(a[0], b[0]) > 0.5;
}

/** Vertical room for a text block before it runs into a body above/below it (horizontally overlapping) */
function verticalRoom(s: Slot, obstacles: { i: number; b: Rect | null }[]): number {
  const [x0, x1] = extent(s, measureText(s.text, s.size, s.weight, s.family, s.ls) + s.padW);
  let room = Infinity;
  for (const o of obstacles) {
    if (o.i === s.own || o.i === s.i) continue;
    const b = o.b!;
    if (b.x + b.w <= x0 || b.x >= x1) continue;
    if (s.vAnchor === 'bottom') {
      if (b.y + b.h <= s.ay) room = Math.min(room, s.ay - (b.y + b.h));
    } else if (s.vAnchor === 'top') {
      if (b.y >= s.ay) room = Math.min(room, b.y - s.ay);
    } else {
      if (b.y + b.h <= s.ay) room = Math.min(room, 2 * (s.ay - (b.y + b.h)));
      else if (b.y >= s.ay) room = Math.min(room, 2 * (b.y - s.ay));
    }
  }
  return room;
}

/** Label text an element shows (resolved control for bound encoders) */
export function elementLabel(el: PanelElement, spec: DeviceSpec, resolvedControl?: string | null): string | undefined {
  switch (el.kind) {
    case 'knob': {
      const id = resolvedControl ?? (typeof el.control === 'string' ? el.control : null);
      const s = id ? spec.controls[id] : undefined;
      return el.labelText ?? (s && s.type === 'knob' ? s.label : undefined);
    }
    case 'slider': {
      const s = spec.controls[el.control];
      return el.labelText ?? (s && s.type === 'slider' ? s.label : undefined);
    }
    case 'switch': {
      const s = spec.controls[el.control];
      return el.labelText ?? (s && s.type === 'switch' ? s.label : undefined);
    }
    case 'button': {
      const cs = el.control ? spec.controls[el.control] : undefined;
      const radio = el.setValue !== undefined && cs?.type === 'switch' ? (cs as SwitchSpec).options[el.setValue as number] : undefined;
      return el.labelText ?? radio ?? (cs ? (cs as ButtonSpec).label : undefined);
    }
    case 'jack': {
      const j = [...(spec.patchBay?.inputs ?? []), ...(spec.patchBay?.outputs ?? [])].find(x => x.id === el.jack);
      return el.labelText ?? j?.label;
    }
    default:
      return undefined;
  }
}
