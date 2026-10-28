// ============================================================================
// Panel text legibility
//
// Hardware legends are tiny, and a fitted panel on an iPad is drawn at 60-90% of
// its native size. The panel computes, for every piece of text it draws:
//   1. a floor: the native size that renders at >= 9 CSS px (jack legends, switch
//      positions, readouts) or >= 10 CSS px (control legends, section titles) at
//      the current zoom
//   2. a box: how wide the text may be before it reaches a neighbour (half the gap
//      to neighbouring text, shared in proportion to need, and never into another
//      control)
//   3. the fit: raise to the floor; if too wide, shrink towards the floor, then
//      condense the letters (down to 82%), then truncate with an ellipsis and keep
//      the full text as a tooltip and accessible name
// Text colours are lifted until they reach WCAG contrast against the faceplate.
// ============================================================================

export interface TextFit {
  /** Font size in the panel's native px */
  size: number;
  /** Horizontal condense, 1 = none */
  scaleX?: number;
  /** Text to show (truncated with an ellipsis when it cannot fit) */
  text?: string;
  /** Full text when truncated (tooltip / accessible name) */
  title?: string;
  /** Colour lifted for contrast, when the authored one was too faint */
  color?: string;
}

/** Rendered CSS px floors */
export const FLOOR_SMALL = 9;
export const FLOOR_CONTROL = 10;
/** Floors stop growing below this zoom (a panel drawn tinier than this needs a bigger zoom, not bigger text) */
export const MIN_FLOOR_SCALE = 0.7;
export const MIN_CONDENSE = 0.82;

export const FONTS: Record<string, string> = {
  sans: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  condensed: '"Arial Narrow", "Roboto Condensed", Arial, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  mono: 'ui-monospace, Menlo, monospace',
};

/** Native px that renders at `cssPx` at this zoom */
export function floorPx(cssPx: number, scale: number): number {
  const s = Math.max(MIN_FLOOR_SCALE, Math.min(1.5, scale || 1));
  return cssPx / s;
}

// ---- measuring ------------------------------------------------------------------

let canvas: CanvasRenderingContext2D | null = null;
const widthCache = new Map<string, number>();

/** Width in px of one line of text at `size` px (canvas measureText; estimated on the server) */
export function measureLine(text: string, size: number, weight: number, family: string, letterSpacing = 0): number {
  if (!text) return 0;
  const key = `${weight}|${family}|${text}`;
  let w100 = widthCache.get(key);
  if (w100 === undefined) {
    if (!canvas && typeof document !== 'undefined') canvas = document.createElement('canvas').getContext('2d');
    if (canvas) {
      canvas.font = `${weight} 100px ${family}`;
      w100 = canvas.measureText(text).width;
    } else {
      w100 = text.length * 60; // rough average glyph width when there is no DOM
    }
    widthCache.set(key, w100);
  }
  return (w100 * size) / 100 + letterSpacing * text.length;
}

export function measureText(text: string, size: number, weight: number, family: string, letterSpacing = 0): number {
  let w = 0;
  for (const line of text.split('\n')) w = Math.max(w, measureLine(line, size, weight, family, letterSpacing));
  return w;
}

/**
 * Fit text into `maxW` px. `want` is the preferred size (authored, raised to the floor);
 * the text shrinks towards `floor`, then condenses, then truncates.
 */
export function fitText(
  text: string,
  want: number,
  floor: number,
  maxW: number,
  weight: number,
  family: string,
  letterSpacing = 0,
): TextFit {
  const lim = Math.max(8, maxW);
  const w = measureText(text, want, weight, family, letterSpacing);
  if (w <= lim) return { size: want };
  const lo = Math.min(want, floor);
  // Shrink towards the floor
  const shrunk = Math.max(lo, (want * lim) / w);
  const ws = measureText(text, shrunk, weight, family, letterSpacing);
  if (ws <= lim) return { size: +shrunk.toFixed(2) };
  // Condense the letters
  const sx = lim / ws;
  if (sx >= MIN_CONDENSE) return { size: +shrunk.toFixed(2), scaleX: +sx.toFixed(3) };
  // Truncate (per line), keeping the full text as a tooltip
  const lines = text.split('\n').map(line => {
    if (measureLine(line, shrunk, weight, family, letterSpacing) * MIN_CONDENSE <= lim) return line;
    let n = line.length;
    while (n > 1 && measureLine(`${line.slice(0, n).trimEnd()}…`, shrunk, weight, family, letterSpacing) * MIN_CONDENSE > lim) n--;
    return `${line.slice(0, n).trimEnd()}…`;
  });
  const shown = lines.join('\n');
  const wt = measureText(shown, shrunk, weight, family, letterSpacing);
  return { size: +shrunk.toFixed(2), scaleX: wt > lim ? +Math.max(MIN_CONDENSE, lim / wt).toFixed(3) : undefined, text: shown, title: text };
}

// ---- colour contrast -----------------------------------------------------------------

type RGB = [number, number, number];

const NAMED: Record<string, RGB> = {
  white: [255, 255, 255], black: [0, 0, 0], transparent: [0, 0, 0], gray: [128, 128, 128], grey: [128, 128, 128],
  red: [255, 0, 0], orange: [255, 165, 0], yellow: [255, 255, 0], green: [0, 128, 0], blue: [0, 0, 255],
};

/** Parse #rgb, #rrggbb, rgb()/rgba() or a few names. Gradients: the average of their colour stops. */
export function parseColor(input: string | undefined): RGB | null {
  if (!input) return null;
  const s = input.trim().toLowerCase();
  if (s.includes('gradient(')) {
    const stops = [...s.matchAll(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)/g)].map(m => parseColor(m[0])).filter((c): c is RGB => !!c);
    if (!stops.length) return null;
    return [0, 1, 2].map(i => Math.round(stops.reduce((a, c) => a + c[i], 0) / stops.length)) as RGB;
  }
  let m = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(s);
  if (m) {
    let h = m[1];
    if (h.length <= 4) h = h.slice(0, 3).split('').map(c => c + c).join('');
    return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)) as RGB;
  }
  m = /^rgba?\(([^)]+)\)$/.exec(s);
  if (m) {
    const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    if (p.length >= 3 && p.slice(0, 3).every(n => Number.isFinite(n))) return [p[0], p[1], p[2]];
  }
  return NAMED[s] ?? null;
}

function luminance([r, g, b]: RGB): number {
  const f = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrastRatio(a: RGB, b: RGB): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const toHex = (c: RGB) => `#${c.map(v => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`;

/**
 * The colour itself when it already reaches `min` contrast on `bg`, otherwise the
 * same hue moved towards white (dark backgrounds) or black (light ones) just far
 * enough. Unparseable colours are left alone.
 */
export function ensureContrast(color: string | undefined, bg: string | undefined, min = 4.5): string | undefined {
  const fg = parseColor(color);
  const back = parseColor(bg);
  if (!fg || !back || !color) return undefined;
  if (contrastRatio(fg, back) >= min) return undefined;
  const target: RGB = luminance(back) < 0.4 ? [255, 255, 255] : [0, 0, 0];
  for (let t = 0.05; t <= 1.0001; t += 0.05) {
    const c: RGB = [0, 1, 2].map(i => fg[i] + (target[i] - fg[i]) * t) as RGB;
    if (contrastRatio(c, back) >= min) return toHex(c);
  }
  return toHex(target);
}

/** CSS for a fitted piece of text (keep the element's own transform as `base`) */
export function fitTransform(fit: TextFit | undefined, base = ''): string | undefined {
  const sx = fit?.scaleX && fit.scaleX < 0.999 ? ` scaleX(${fit.scaleX})` : '';
  const t = `${base}${sx}`.trim();
  return t || undefined;
}
