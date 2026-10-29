// ============================================================================
// Panel layout analysis (pure functions, memoised by SynthPanel)
//
//   geometry   every element's drawn body in native px, its control ids, which
//              control a free-standing legend belongs to (so focus mode can dim a
//              control together with its printed legend), and the distance to the
//              nearest neighbour (so touch targets can grow to 44 px without
//              stealing a neighbour's touches)
//   text fits  every piece of text the panel draws, raised to a legible size for
//              the current zoom and fitted to the room it has (lib/controls/textFit):
//              it may not grow into a control or another text, and it is never
//              made smaller than the layout itself asked for
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
  /** The body is a circle (knobs, jacks, round buttons, LEDs) */
  round: boolean;
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
/** Line pitch of a toggle's stacked position legends (matches components/controls/Switch) */
const LEGEND_LINE = 1.22;
/** Content-area height of a line of text, as a fraction of the font size */
const CONTENT = 1.16;

interface SwitchMetrics { w: number; h: number; headerH: number; totalH: number }

/** Drawn size of a switch at given fonts (mirrors components/controls/Switch) */
function switchBox(el: Extract<PanelElement, { kind: 'switch' }>, spec: SwitchSpec | undefined, labelFont: number, legendFont: number, family: string): SwitchMetrics {
  const s = el.scale ?? 1;
  const opts = spec?.options ?? [];
  const n = Math.max(1, opts.length);
  const style = el.style ?? 'toggle';
  const vertical = (el.orientation ?? 'vertical') === 'vertical';
  const hasHeader = (el.label ?? 'above') !== 'none' && !!(el.labelText ?? spec?.label);
  const headerLines = (el.labelText ?? spec?.label ?? '').split('\n').length;
  const headerH = hasHeader ? labelFont * headerLines + 2 : 0;
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
    if (vertical) { w = trackShort + 2 + legendW; h = Math.max(trackLong, n * legendFont * LEGEND_LINE); }
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
    let round = false;
    let ids: string[] = [];
    switch (el.kind) {
      case 'knob': {
        const d = (el.diameter ?? 12) * k;
        body = { x: cx - d / 2, y: cy - d / 2, w: d, h: d };
        round = true;
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
        round = (el.shape ?? 'round') === 'round';
        ids = [el.control, el.event].filter((x): x is string => !!x);
        break;
      }
      case 'jack': {
        const d = JACK_MM * k;
        body = { x: cx - d / 2, y: cy - d / 2, w: d, h: d };
        round = true;
        ids = [el.jack];
        break;
      }
      case 'led': {
        const d = (el.size ?? 2.5) * k;
        body = { x: cx - d / 2, y: cy - d / 2, w: d, h: d };
        round = true;
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
    return { kind: el.kind, body, round, cx, cy, ids, owner: -1, nearest: Infinity };
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
  /** Switch position legends, button cap text */
  legend: (TextFit | undefined)[];
  /** Section titles */
  title: (TextFit | undefined)[];
  /** Vertical nudge (px) for switches whose header grew, so the switch body stays where it was drawn */
  shift: number[];
  /** Fit decisions, for the legibility tooling (only filled when window.__panelFitDebug is set) */
  debug?: { el: number; part: string; text: string; authored: number; want: number; maxW: number; fit: TextFit; limits?: string[] }[];
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
  /** Free-standing legends: nudge the centre so the edge facing the control stays put */
  shiftAnchor?: 'bottom' | 'top';
  /** Size already decided by a whole-control fit (switches) */
  presized?: boolean;
  /** The drawn section box this text sits inside (it stays inside it) */
  box?: Rect;
  // computed
  want: number;
  /** Width at the wanted size, and at the authored size */
  w: number;
  wA: number;
  band: [number, number];
  bandA: [number, number];
}

const GAP = 2.5;

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
  const out: PanelTextFits = { label: new Array(n), value: new Array(n), legend: new Array(n), title: new Array(n), shift: new Array(n).fill(0) };
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

  const add = (s: Omit<Slot, 'want' | 'w' | 'wA' | 'band' | 'bandA'>) => slots.push({ ...s, want: s.size, w: 0, wA: 0, band: [0, 0], bandA: [0, 0] });
  const faceW = layout.width * k;
  const faceH = layout.height * k;
  const switchSlots: { i: number; header?: Slot; legend?: Slot; el: Extract<PanelElement, { kind: 'switch' }>; sp: SwitchSpec }[] = [];

  layout.elements.forEach((el, i) => {
    const g = geo[i];
    const text = inputs.labels[i];
    switch (el.kind) {
      case 'label': {
        if (el.rotate) return;
        const size = el.size ?? 8;
        const big = size >= 14;
        const legend = g.owner >= 0;
        const lines = el.text.split('\n').length;
        // A legend grows away from its control: the edge facing the control stays where it was
        const ob = legend ? geo[g.owner].body : null;
        const boxH = lines * size + (el.invert ? 2 : 0);
        const anchor: 'bottom' | 'top' | undefined = ob ? (ob.y >= g.cy ? 'bottom' : ob.y + ob.h <= g.cy ? 'top' : undefined) : undefined;
        add({
          i, part: 'label', text: el.text, size, floorCss: legend ? FLOOR_CONTROL : FLOOR_SMALL,
          weight: el.weight ?? 700, family: el.font ? FONTS[el.font] : family, ls: el.letterSpacing ?? 0,
          padW: el.invert ? 6 : 0, lines, lh: 1, ax: g.cx, align: el.align ?? 'center',
          // The legend's own control is an obstacle too: the text must not grow into it
          vAnchor: anchor ?? 'center', ay: anchor === 'bottom' ? g.cy + boxH / 2 : anchor === 'top' ? g.cy - boxH / 2 : g.cy,
          shiftAnchor: anchor,
          own: -1, color: el.invert ? theme.jack?.outputLabelText ?? '#000' : el.color ?? theme.text,
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
          else if (pos === 'below') add({ ...base, ax: g.cx, align: 'center', vAnchor: 'top', ay: g.cy + d / 2 + gap + valueSize * 1.15 + 5 });
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
        const entry: (typeof switchSlots)[number] = { i, el, sp };
        if (text && (el.label ?? 'above') !== 'none') {
          add({ i, part: 'label', text, size: f.label, floorCss: FLOOR_CONTROL, weight: 700, family, ls: 0, padW: 0, lines: text.split('\n').length, lh: 1, ax: g.cx, align: 'center', vAnchor: 'bottom', ay: g.body.y - 2, own: i, color: theme.muted ?? theme.text, bg: bgAt(g.cx, g.cy) });
          entry.header = slots[slots.length - 1];
        }
        // Position legends: fitted as one block
        const style = el.style ?? 'toggle';
        const vertical = (el.orientation ?? 'vertical') === 'vertical';
        const stacked = vertical && style !== 'rotary';
        const longest = sp.options.reduce((a, o) => (measureText(o, 10, 700, family) > measureText(a, 10, 700, family) ? o : a), '');
        // The block's width: its texts back to back plus the fixed chrome around them
        // (button padding and borders, gaps) - the chrome does not grow with the font
        const blockText = stacked || style === 'rotary' ? longest : sp.options.join('');
        const s = el.scale ?? 1;
        const n = sp.options.length;
        const lever = style === 'toggle' ? 12 * s + 2 : 0;
        const legendSize = style === 'buttons' ? f.legend + 1 : f.legend;
        add({
          i, part: 'legend', text: blockText, size: legendSize, floorCss: FLOOR_SMALL, weight: 700, family, ls: 0,
          padW: style === 'buttons'
            ? (stacked ? 8 * s + 2 + 4 : n * (8 * s + 2) + (n - 1) * 2 + 4)
            : style === 'toggle' && !vertical ? (n - 1) * 4 : 0,
          lines: stacked ? sp.options.length : 1, lh: style === 'buttons' ? 1.6 : LEGEND_LINE,
          ax: style === 'toggle' && vertical ? g.body.x + lever : g.cx, align: style === 'toggle' && vertical ? 'left' : 'center',
          vAnchor: 'center', ay: g.body.y + g.body.h / 2, own: i,
          capW: style === 'rotary' ? 22 * s * 1.1 : undefined,
        });
        entry.legend = slots[slots.length - 1];
        switchSlots.push(entry);
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
          // Output legends sit in a box (padding 3 + border 1); input legends have no box
          i, part: 'label' as const, text, size: 6.5, floorCss: FLOOR_SMALL, weight: 700, family, ls: 0, padW: isOut ? 8 : 4, lines: 1, lh: 1, own: i,
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

  // Obstacles: drawn bodies of controls, screens, keyboards (LEDs are small art; custom overlays may be transparent)
  const obstacles = geo.map((g, i) => ({ i, g })).filter(o => o.g.body && o.g.kind !== 'led');

  // 1. preferred size: authored, raised to the floor for this zoom - limited by the room
  //    above/below (controls, other text at its authored size, the faceplate's edges)
  // Drawn boxes (sections with a visible border): text and switches inside one stay inside it.
  // Borderless background panels are not boxes - a legend may cross a subtle tint edge.
  const boxes: Rect[] = layout.elements
    .filter((el): el is Extract<PanelElement, { kind: 'section' }> => el.kind === 'section' && !!el.border && el.border !== 'none' && !/^0(px)?\b/.test(el.border))
    .map(el => ({ x: el.x * k, y: el.y * k, w: el.w * k, h: el.h * k }))
    .sort((a, b) => a.w * a.h - b.w * b.h);
  // (a few px of tolerance: controls drawn right up to a box edge still belong to the box)
  const boxAround = (x0: number, x1: number, y0: number, y1: number, tol = 0.5) =>
    boxes.find(b => b.x <= x0 + tol && x1 <= b.x + b.w + tol && b.y <= y0 + tol && y1 <= b.y + b.h + tol);

  for (const s of slots) {
    s.wA = measureText(s.text, s.size, s.weight, s.family, s.ls) + s.padW;
    s.w = s.wA;
    s.bandA = band(s, s.size);
    s.band = s.bandA;
    if (s.part !== 'title') {
      const [x0, x1] = extent(s, s.wA);
      s.box = boxAround(x0, x1, s.bandA[0], s.bandA[1], 3);
    }
  }
  // Switches are sized as a whole below, after the text around them
  for (const sw of switchSlots) {
    if (sw.header) sw.header.presized = true;
    if (sw.legend) sw.legend.presized = true;
  }
  for (const s of slots) {
    if (s.presized) continue;
    const floor = s.floorCss === FLOOR_CONTROL ? fControl : fSmall;
    s.want = s.fixed ? s.size : Math.max(s.size, floor);
    if (s.want > s.size) {
      const room = verticalRoom(s, obstacles, slots, faceH);
      const maxByRoom = (room - 2) / ((s.lines - 1) * s.lh + CONTENT);
      if (maxByRoom < s.want) s.want = Math.max(s.size, maxByRoom);
    }
    s.w = measureText(s.text, s.want, s.weight, s.family, s.ls) + s.padW;
    s.band = band(s, s.want);
  }

  // 1a. switches grow as a whole: the header and the body (taller buttons, longer legend
  //     columns) are centred on the anchor, so check the box against what is above and
  //     below - including the text around it at its new size
  for (const sw of switchSlots) {
    const g = geo[sw.i];
    if (!g.body) continue;
    const f = switchFonts(sw.el.scale ?? 1);
    const style = sw.el.style ?? 'toggle';
    const box0 = switchBox(sw.el, sw.sp, f.label, f.legend, family);
    const top0 = g.body.y - box0.headerH;
    const bottom0 = g.body.y + g.body.h;
    const own = new Set([sw.header, sw.legend].filter(Boolean));
    const encl = boxAround(g.cx - box0.w / 2, g.cx + box0.w / 2, top0, bottom0, 4);
    // Something the switch already touches as drawn: it may not grow towards it
    let blockUp = false;
    let blockDown = false;
    for (const o of obstacles) {
      if (o.i === sw.i) continue;
      const b = o.g.body!;
      if (b.x + b.w <= g.cx - box0.w / 2 || b.x >= g.cx + box0.w / 2) continue;
      if (b.y < top0 && b.y + b.h > top0) blockUp = true;
      if (b.y < bottom0 && b.y + b.h > bottom0) blockDown = true;
    }
    const hT = sw.header && !sw.header.fixed ? Math.max(f.label, fControl) : f.label;
    const lT = Math.max(f.legend, style === 'buttons' ? fSmall - 1 : fSmall);
    const fits = (t: number) => {
      const hS = f.label + (hT - f.label) * t;
      const lS = f.legend + (lT - f.legend) * t;
      const box1 = switchBox(sw.el, sw.sp, hS, lS, family);
      const dh = Math.max(0, box1.h - box0.h);
      const dHead = Math.max(0, box1.headerH - box0.headerH);
      const x0 = g.cx - Math.max(box0.w, box1.w) / 2;
      const x1 = g.cx + Math.max(box0.w, box1.w) / 2;
      const up = dh / 2 + dHead;
      const down = dh / 2;
      if ((up > 0.01 && blockUp) || (down > 0.01 && blockDown)) return null;
      // Stay inside the drawn section box (no growth at all towards an edge it already touches)
      if (encl) {
        const w1 = Math.max(box0.w, box1.w) / 2;
        if (box1.w > box0.w + 0.5 && (g.cx - w1 < encl.x + 1.5 || g.cx + w1 > encl.x + encl.w - 1.5)) return null;
        if (up > 0.01 && top0 - up < encl.y + 1.5) return null;
        if (down > 0.01 && bottom0 + down > encl.y + encl.h - 1.5) return null;
      }
      // Only the strips the switch would grow into, and only things wholly above / below it
      const strips: [number, number, 'up' | 'down'][] = [];
      if (up > 0.01) strips.push([top0 - up - 1.5, top0, 'up']);
      if (down > 0.01) strips.push([bottom0, bottom0 + down + 1.5, 'down']);
      for (const [yA, yB, dir] of strips) {
        for (const o of obstacles) {
          if (o.i === sw.i) continue;
          const b = o.g.body!;
          if (dir === 'up' ? b.y + b.h > top0 + 0.5 : b.y < bottom0 - 0.5) continue;
          const span = obstacleSpan(o.g, [yA, yB]);
          if (span && span[1] > x0 && span[0] < x1) return null;
        }
        for (const o of slots) {
          if (own.has(o)) continue;
          // Wholly above / below as drawn, and where it is now that it may have grown
          if (dir === 'up' ? o.bandA[1] > top0 + 0.5 : o.bandA[0] < bottom0 - 0.5) continue;
          const lo = Math.min(o.band[0], o.bandA[0]);
          const hi = Math.max(o.band[1], o.bandA[1]);
          if (hi <= yA || lo >= yB) continue;
          const [ox0, ox1] = extent(o, Math.max(o.w, o.wA));
          if (ox1 > x0 && ox0 < x1) return null;
        }
      }
      return { hS, lS, dh };
    };
    let best = fits(1);
    if (!best) {
      let lo = 0, hi = 1;
      best = fits(0);
      for (let it = 0; it < 10 && best; it++) {
        const m = (lo + hi) / 2;
        const r = fits(m);
        if (r) { best = r; lo = m; } else hi = m;
      }
    }
    // Already tight as drawn: keep the authored sizes
    if (!best) best = { hS: f.label, lS: f.legend, dh: 0 };
    if (sw.header) {
      sw.header.want = best.hS;
      sw.header.presized = true;
      sw.header.ay = g.body.y - best.dh / 2 - 2;
    }
    if (sw.legend) {
      sw.legend.want = style === 'buttons' ? best.lS + 1 : best.lS;
      sw.legend.presized = true;
    }
    for (const t of [sw.header, sw.legend]) {
      if (!t) continue;
      t.w = measureText(t.text, t.want, t.weight, t.family, t.ls) + t.padW;
      t.band = band(t, t.want);
    }
  }

  // 1b. two texts stacked one above the other that now meet because both grew (a readout
  //     under a knob and the legend of the knob below): share the vertical gap
  for (let iter = 0; iter < 4; iter++) {
    let changed = false;
    for (let a = 0; a < slots.length; a++) {
      for (let b = a + 1; b < slots.length; b++) {
        const s = slots[a];
        const o = slots[b];
        if (s.want <= s.size && o.want <= o.size) continue;
        if (!overlaps(s.band, o.band)) continue;
        const [sx0, sx1] = extent(s, s.w);
        const [ox0, ox1] = extent(o, o.w);
        if (sx1 <= ox0 || ox1 <= sx0) continue;
        if (overlaps(s.bandA, o.bandA)) {
          // Already touching as drawn: growing either would make it worse
          const [as0, as1] = extent(s, s.wA);
          const [ao0, ao1] = extent(o, o.wA);
          if (as1 > ao0 && ao1 > as0) {
            for (const t of [s, o]) {
              if (t.want > t.size) {
                t.want = t.size;
                t.w = t.wA;
                t.band = t.bandA;
                changed = true;
              }
            }
          }
          continue;
        }
        const sAbove = (s.bandA[0] + s.bandA[1]) / 2 < (o.bandA[0] + o.bandA[1]) / 2;
        const upper = sAbove ? s : o;
        const lower = sAbove ? o : s;
        const ov = upper.band[1] - lower.band[0] + 1;
        if (ov <= 0) continue;
        // How far each one's facing edge moved because it grew
        const eu = upper.band[1] - upper.bandA[1];
        const el = lower.bandA[0] - lower.band[0];
        const tot = eu + el;
        if (tot <= 0) continue;
        const keep = Math.max(0, 1 - ov / tot);
        for (const [t, e] of [[upper, eu], [lower, el]] as [Slot, number][]) {
          if (e <= 0) continue;
          const f = t.vAnchor === 'center' ? 0.5 : 1;        // a centred block grows both ways
          const hA = t.bandA[1] - t.bandA[0];
          const hNew = hA + (e * keep) / f;
          const per = (t.lines - 1) * t.lh + CONTENT;
          t.want = Math.max(t.size, Math.min(t.want, (hNew - 1) / per));
          t.w = measureText(t.text, t.want, t.weight, t.family, t.ls) + t.padW;
          t.band = band(t, t.want);
        }
        changed = true;
      }
    }
    if (!changed) break;
  }

  // 2. room. Text that fitted at its authored size keeps at least that much room; extra
  //    room between two texts is shared in proportion to how much each wants to grow.
  //    Text that already collided at its authored size is pulled apart.
  const debugOn = typeof window !== 'undefined' && !!(window as unknown as { __panelFitDebug?: boolean }).__panelFitDebug;
  const limiters: string[][] = slots.map(() => []);
  const maxW = slots.map((s, si) => {
    let left = Infinity;   // allowed reach to the left of the anchor
    let right = Infinity;
    const note = (what: string, v: number) => { if (debugOn) limiters[si].push(`${what}:${Math.round(v)}`); };
    const [ex0, ex1] = extent(s, s.w);
    for (const o of slots) {
      if (o === s) continue;
      // Side-by-side neighbours only: stacked texts were settled vertically above (and
      // squeezing a stacked pair sideways can't separate them)
      if (!overlaps(s.band, o.band)) continue;
      const [cs0, cs1] = extent(s, s.wA);
      const [co0, co1] = extent(o, o.wA);
      if (Math.abs((cs0 + cs1) / 2 - (co0 + co1) / 2) < Math.max(s.wA, o.wA) / 2) continue;
      const [ox0, ox1] = extent(o, o.w);
      const clear = Math.max(4.5, 0.5 * Math.max(s.want, o.want));
      if (ox1 + clear <= ex0 || ox0 - clear >= ex1) continue; // they don't collide
      const onLeft = (ox0 + ox1) / 2 <= (ex0 + ex1) / 2;
      const side = onLeft ? 'left' : 'right';
      const opp = onLeft ? 'right' : 'left';
      const mineA = reachAt(s, side, s.wA);
      const theirsA = reachAt(o, opp, o.wA);
      const mineW = reachAt(s, side, s.w);
      const theirsW = reachAt(o, opp, o.w);
      const between = onLeft ? s.ax - o.ax : o.ax - s.ax;
      // Separate legends need clearly more space between them than a word space (about half an em)
      const gap = Math.max(4.5, 0.5 * Math.max(s.want, o.want));
      const avail = Math.max(0, between - gap);
      const extra = avail - (mineA + theirsA);
      let share: number;
      if (extra >= 0) {
        const gm = Math.max(0, mineW - mineA);
        const go = Math.max(0, theirsW - theirsA);
        share = mineA + (gm + go > 0 ? (extra * gm) / (gm + go) : extra);
      } else {
        share = mineA + theirsA > 0 ? (avail * mineA) / (mineA + theirsA) : avail;
      }
      note(`text "${o.text.replace(/\n/g, '/')}" ${onLeft ? 'L' : 'R'}`, share);
      if (onLeft) left = Math.min(left, share);
      else right = Math.min(right, share);
    }
    for (const o of obstacles) {
      if (o.i === s.own || o.i === s.i) continue;
      const span = obstacleSpan(o.g, s.band);
      if (!span) continue;
      const [b0, b1] = span;
      // Text printed over a body (artwork on a section, a legend on a screen) isn't limited by it
      if (b0 <= s.ax && b1 >= s.ax) continue;
      // A body the text already ran into as drawn doesn't squeeze it below its drawn width
      const onLeft = b1 <= s.ax;
      const room = onLeft ? s.ax - b1 - GAP : b0 - s.ax - GAP;
      const allowed = Math.max(room, reachAt(s, onLeft ? 'left' : 'right', s.wA));
      note(`body#${o.i}(${o.g.kind}) ${onLeft ? 'L' : 'R'}`, allowed);
      if (onLeft) left = Math.min(left, allowed);
      else right = Math.min(right, allowed);
    }
    // The faceplate's edges and the drawn box around the text (never tighter than the authored text already was)
    left = Math.min(left, Math.max(s.ax - 1, reachAt(s, 'left', s.wA)));
    right = Math.min(right, Math.max(faceW - s.ax - 1, reachAt(s, 'right', s.wA)));
    if (s.box) {
      left = Math.min(left, Math.max(s.ax - (s.box.x + 2), reachAt(s, 'left', s.wA)));
      right = Math.min(right, Math.max(s.box.x + s.box.w - 2 - s.ax, reachAt(s, 'right', s.wA)));
    }
    let w: number;
    if (s.align === 'center') w = 2 * Math.min(left, right);
    else if (s.align === 'left') w = right;
    else w = left;
    if (s.capW !== undefined) w = Math.min(w, Math.max(s.capW, s.wA));
    return Math.max(0, w);
  });

  // 3. fit
  const debug = typeof window !== 'undefined' && (window as unknown as { __panelFitDebug?: boolean }).__panelFitDebug ? [] as NonNullable<PanelTextFits['debug']> : undefined;
  slots.forEach((s, idx) => {
    const floor = s.floorCss === FLOOR_CONTROL ? fControl : fSmall;
    let fit: TextFit;
    if (s.fixed) fit = { size: s.size };
    else if (maxW[idx] === Infinity || s.w <= maxW[idx]) fit = { size: +s.want.toFixed(2) };
    else fit = fitText(s.text, s.want, Math.min(s.want, floor), maxW[idx] - s.padW, s.weight, s.family, s.ls, s.size);
    if (s.color && s.bg && !s.fixed) {
      const c = ensureContrast(s.color, s.bg, 4.5);
      if (c) fit.color = c;
    }
    // A legend block or readout is fitted as a whole: keep its text, apply size/condense
    if (s.part === 'legend' || s.part === 'value') { delete fit.text; delete fit.title; }
    // A free legend that grew keeps the edge facing its control in place
    if (s.shiftAnchor && fit.size !== s.size) {
      const grow = (s.lines * (fit.size - s.size)) / 2;
      fit.dy = +(s.shiftAnchor === 'bottom' ? -grow : grow).toFixed(2);
    }
    out[s.part][s.i] = fit;
    debug?.push({ el: s.i, part: s.part, text: s.text, authored: s.size, want: +s.want.toFixed(2), maxW: Math.round(maxW[idx]), fit, limits: limiters[idx] });
  });

  // 4. a switch whose header or legends grew: keep its lever where the layout drew it
  for (const sw of switchSlots) {
    const f = switchFonts(sw.el.scale ?? 1);
    const before = switchBox(sw.el, sw.sp, f.label, f.legend, family);
    const hFit = out.label[sw.i]?.size ?? f.label;
    const lFit = out.legend[sw.i]?.size ?? f.legend;
    const after = switchBox(sw.el, sw.sp, hFit, (sw.el.style ?? 'toggle') === 'buttons' ? lFit - 1 : lFit, family);
    // The column (header + body) is centred on the anchor, so the body's centre sits half
    // a header below it: move the anchor up by half the header's growth to keep the body put
    out.shift[sw.i] = -(after.headerH - before.headerH) / 2;
  }
  if (debug) out.debug = debug;
  return out;
}

/** How far a slot of width `w` reaches from its anchor towards one side */
function reachAt(s: Slot, side: 'left' | 'right', w: number): number {
  if (s.align === 'center') return w / 2;
  if (s.align === 'left') return side === 'right' ? w : 0;
  return side === 'left' ? w : 0;
}

function extent(s: Slot, w: number): [number, number] {
  if (s.align === 'left') return [s.ax, s.ax + w];
  if (s.align === 'right') return [s.ax - w, s.ax];
  return [s.ax - w / 2, s.ax + w / 2];
}

/** Vertical extent of a text block's content area (glyph boxes overhang a tight line box a little) */
function band(s: Slot, size: number): [number, number] {
  const h = (s.lines - 1) * size * s.lh + size * CONTENT + 1;
  const over = Math.max(0, (CONTENT - s.lh) / 2) * size + 0.5;
  if (s.vAnchor === 'bottom') return [s.ay - h + over, s.ay + over];
  if (s.vAnchor === 'top') return [s.ay - over, s.ay + h - over];
  return [s.ay - h / 2, s.ay + h / 2];
}

function overlaps(a: [number, number], b: [number, number]) {
  return Math.min(a[1], b[1]) - Math.max(a[0], b[0]) > 0.5;
}

/** Horizontal span an element's body occupies within a horizontal band (circles: their chord) */
function obstacleSpan(g: ElementInfo, bandY: [number, number]): [number, number] | null {
  const b = g.body!;
  if (b.y + b.h <= bandY[0] || b.y >= bandY[1]) return null;
  if (!g.round) return [b.x, b.x + b.w];
  const r = b.w / 2;
  const cy = b.y + b.h / 2;
  const dy = cy >= bandY[0] && cy <= bandY[1] ? 0 : Math.min(Math.abs(cy - bandY[0]), Math.abs(cy - bandY[1]));
  if (dy >= r) return null;
  const hc = Math.sqrt(r * r - dy * dy);
  return [g.cx - hc, g.cx + hc];
}

/** Vertical room for a text block before it reaches a control, another text or the faceplate's edge */
function verticalRoom(s: Slot, obstacles: { i: number; g: ElementInfo }[], slots: Slot[], faceH: number): number {
  const [x0, x1] = extent(s, s.w);
  // Free space above / below the fixed edge (or the centre): the faceplate, or the drawn box it sits in
  const top = s.box ? s.box.y + 1 : 0;
  const bottom = s.box ? s.box.y + s.box.h - 1 : faceH;
  let up = Math.max(0, s.ay - top);
  let down = Math.max(0, bottom - s.ay);
  const consider = (top: number, bottom: number) => {
    if (bottom <= s.ay + 0.5) up = Math.min(up, s.ay - bottom);
    else if (top >= s.ay - 0.5) down = Math.min(down, top - s.ay);
  };
  for (const o of obstacles) {
    if (o.i === s.own || o.i === s.i) continue;
    const b = o.g.body!;
    if (b.x + b.w <= x0 || b.x >= x1) continue;
    if (o.g.round) {
      // Highest / lowest point of the circle within the text's horizontal span
      const r = b.w / 2;
      const dx = o.g.cx >= x0 && o.g.cx <= x1 ? 0 : Math.min(Math.abs(o.g.cx - x0), Math.abs(o.g.cx - x1));
      if (dx >= r) continue;
      const hc = Math.sqrt(r * r - dx * dx);
      consider(o.g.cy - hc, o.g.cy + hc);
    } else consider(b.y, b.y + b.h);
  }
  for (const o of slots) {
    if (o === s) continue;
    const [ox0, ox1] = extent(o, o.wA);
    if (ox1 <= x0 || ox0 >= x1) continue;
    consider(o.bandA[0], o.bandA[1]);
  }
  if (s.vAnchor === 'bottom') return up;
  if (s.vAnchor === 'top') return down;
  return 2 * Math.min(up, down);
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
