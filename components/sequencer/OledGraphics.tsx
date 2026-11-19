'use client';
// ============================================================================
// The parameter graphics of an Elektron OLED (Analog Four MKII, Analog Rytm MKII)
//
// The hardware's screens draw each parameter as a small graphic above its name
// (the page figures in both manuals): a dial for a plain value, a switch for
// on/off, a level column for levels and sends, a waveform, a curve across FRQ
// and RES for a filter, the envelope across its time knobs, and a word for
// lists (MUL, MOD, DST). A knob with no parameter shows a hatched square.
//
// These are our own drawings of the same ideas, computed from the values: the
// filter curve is the response of the chosen type, the envelope follows the
// times, the level and the shape.
//
// Every graphic is drawn in `currentColor`, so a cell shown inverted (a locked
// parameter) inverts its graphic too. `h` is the graphic's height: a number of
// CSS px or any CSS length ('1.9em'); the width follows the drawing.
// ============================================================================

import type { ReactNode } from 'react';

type Size = number | string;
const VH = 14; // the drawings' own height
const DIM = 0.55;

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const f = (n: number) => n.toFixed(1);
const NS = { vectorEffect: 'non-scaling-stroke' as const };

/** A graphic for one knob slot, `w` wide in the drawing's own units */
function Svg({ w, h = VH, children }: { w: number; h?: Size; children: ReactNode }) {
  return (
    <svg viewBox={`0 0 ${w} ${VH}`} fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', margin: '0 auto', height: h, width: 'auto', flex: 'none' }} aria-hidden>
      {children}
    </svg>
  );
}

/** A graphic stretched across several knob slots; strokes keep their weight */
function Wide({ w, h = VH, children }: { w: number; h?: Size; children: ReactNode }) {
  return (
    <svg viewBox={`0 0 ${w} ${VH}`} preserveAspectRatio="none" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', height: h, width: '100%' }} aria-hidden>
      {children}
    </svg>
  );
}

// ---- one knob slot --------------------------------------------------------------

/** A dial: the ring is open at the bottom, the pointer shows the value (straight up = the middle) */
export function DialIcon({ norm, h }: { norm: number; h?: Size }) {
  const cx = 9, cy = 7.7, r = 5.9;
  const at = (deg: number, rad = r) => `${f(cx + rad * Math.cos((deg * Math.PI) / 180))} ${f(cy + rad * Math.sin((deg * Math.PI) / 180))}`;
  const a = -225 + 270 * clamp(norm, 0, 1);
  return (
    <Svg w={18} h={h}>
      <path d={`M ${at(-225)} A ${r} ${r} 0 1 1 ${at(45)}`} />
      <path d={`M ${cx} ${cy} L ${at(a, r - 0.4)}`} strokeWidth={1.5} />
    </Svg>
  );
}

/** An on/off switch: an outline with the slider at the left when off, a lit body with the slider at the right when on */
export function SwitchIcon({ on, h }: { on: boolean; h?: Size }) {
  // on: the body is filled and the slider is a hole in it (even-odd), so no background colour is needed
  const body = 'M 6 3 H 18 A 4.5 4.5 0 0 1 18 12 H 6 A 4.5 4.5 0 0 1 6 3 Z';
  const hole = 'M 19.5 7.5 A 2.5 2.5 0 1 0 14.5 7.5 A 2.5 2.5 0 1 0 19.5 7.5 Z';
  return (
    <Svg w={24} h={h}>
      {on
        ? <path d={`${body} ${hole}`} fill="currentColor" fillRule="evenodd" />
        : <><path d={body} /><circle cx={7} cy={7.5} r={2.5} fill="currentColor" stroke="none" /></>}
    </Svg>
  );
}

/** A level column, filled from the bottom */
export function LevelIcon({ norm, h }: { norm: number; h?: Size }) {
  const fill = 10 * clamp(norm, 0, 1);
  return (
    <Svg w={12} h={h}>
      <rect x={1.5} y={1} width={9} height={12} />
      {fill > 0.3 && <rect x={3.2} y={12 - fill} width={5.6} height={fill} fill="currentColor" stroke="none" />}
    </Svg>
  );
}

/** PAN: a marker on a line between left and right */
export function PanIcon({ norm, h }: { norm: number; h?: Size }) {
  const x = 3 + 18 * clamp(norm, 0, 1);
  return (
    <Svg w={24} h={h}>
      <path d="M 3 3.5 H 21 M 3 11.5 H 21" strokeDasharray="0.1 2.4" strokeOpacity={DIM} />
      <path d="M 2.5 7.5 H 21.5" />
      <path d={`M ${f(x)} 2.5 V 12.5`} strokeWidth={2.2} />
    </Svg>
  );
}

/** A hatched square: this knob does nothing on this page */
export function UnusedIcon({ h }: { h?: Size }) {
  const dots: ReactNode[] = [];
  for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) if ((x + y) % 2 === 0) dots.push(<rect key={`${x}-${y}`} x={4 + x * 2} y={2 + y * 2} width={2} height={2} />);
  return (
    <svg viewBox={`0 0 18 ${VH}`} fill="currentColor" opacity={0.4} style={{ display: 'block', margin: '0 auto', height: h ?? VH, width: 'auto', flex: 'none' }} aria-hidden>
      {dots}
    </svg>
  );
}

/** A waveform (or any small line drawing) in a 26 x 14 box */
export function PathIcon({ d, h }: { d: string; h?: Size }) {
  return <Svg w={26} h={h}><path d={d} /></Svg>;
}

/** Waves of an LFO: TRI, SIN, SQR, SAW, EXP, RMP, RND */
export const LFO_WAVE_PATHS = [
  'M 2 11.5 L 13 2.5 L 24 11.5',
  'M 2 7 C 5 -0.5, 10 -0.5, 13 7 S 21 14.5, 24 7',
  'M 2 11.5 V 2.5 H 13 V 11.5 H 24',
  'M 2 2.5 L 13 11.5 V 2.5 L 24 11.5',
  'M 2 2.5 C 4 9.5, 9 11.5, 24 11.5',
  'M 2 11.5 L 24 2.5',
  'M 2 8.5 H 6 V 4 H 10 V 10.5 H 14 V 5.5 H 18 V 11.5 H 22 V 7',
];
/** A flat line: off */
export const FLAT_PATH = 'M 2 7.5 H 24';

/** PW: where the wave flips; the dotted mark is the middle (the plain wave) */
export function PulseWidthIcon({ norm, h }: { norm: number; h?: Size }) {
  const x = 3.5 + 19 * clamp(norm, 0, 1);
  return (
    <Svg w={26} h={h}>
      <path d="M 13 2 V 13" strokeDasharray="0.1 2.2" strokeOpacity={DIM} />
      <path d={`M 2 3.5 H ${f(x)} V 11 H 24`} />
    </Svg>
  );
}

/** FAD: flat (with a cross) at 0, a rising slope for a fade-in (negative), a falling one for a fade-out */
export function FadeIcon({ value, range = 64, h }: { value: number; range?: number; h?: Size }) {
  const len = 5 + 14 * clamp(Math.abs(value) / range, 0, 1);
  return (
    <Svg w={26} h={h}>
      <path d="M 3 12.5 H 23" strokeDasharray="0.1 2.2" strokeOpacity={DIM} />
      {value === 0 && <path d="M 3 9.5 H 23 M 11 3 L 15 7 M 15 3 L 11 7" />}
      {value < 0 && <path d={`M 3 11.5 L ${f(3 + len)} 3 H 23`} />}
      {value > 0 && <path d={`M 3 3 L ${f(3 + len)} 11.5`} />}
    </Svg>
  );
}

/** Curve kinds of an envelope segment */
export type Rise = 'linear' | 'standard' | 'exponential' | 'full';
export type Fall = 'linear' | 'exponential';

/** A rising segment from (x0, y0) to (x1, y1) */
function rise(kind: Rise, x0: number, y0: number, x1: number, y1: number): string {
  if (kind === 'full') return `V ${f(y1)} H ${f(x1)}`;                                       // up at once, held for the time
  if (kind === 'standard') return `Q ${f(x0 + (x1 - x0) * 0.25)} ${f(y1)} ${f(x1)} ${f(y1)}`; // fast, then easing in
  if (kind === 'exponential') return `Q ${f(x0 + (x1 - x0) * 0.8)} ${f(y0)} ${f(x1)} ${f(y1)}`; // faster and faster
  return `L ${f(x1)} ${f(y1)}`;
}
/** A falling segment to (x1, y1): exponential falls fast at first and leaves a tail */
function fall(kind: Fall, x0: number, x1: number, y1: number): string {
  return kind === 'exponential' ? `Q ${f(x0 + (x1 - x0) * 0.2)} ${f(y1)} ${f(x1)} ${f(y1)}` : `L ${f(x1)} ${f(y1)}`;
}

/** SHP: the curve of the rise and the fall; a dot at the left means it restarts from zero on every trig */
export function ShapeIcon({ attack, decay, restart, h }: { attack: Rise; decay: Fall; restart: boolean; h?: Size }) {
  return (
    <Svg w={26} h={h}>
      {restart && <circle cx={2.6} cy={11.6} r={1.4} fill="currentColor" stroke="none" />}
      <path d={`M 6 11.5 ${rise(attack, 6, 11.5, 14, 2.5)} ${fall(decay, 14, 24, 11.5)}`} />
    </Svg>
  );
}

/** A small sketch of a multimode filter type: LP2, LP1, BP, HP1, HP2, BS, PK */
const TYPE_PATHS = [
  'M 2 4 H 13 L 22 12',
  'M 2 4 H 11 L 24 9.5',
  'M 2 12 L 13 3 L 24 12',
  'M 2 9.5 L 15 4 H 24',
  'M 4 12 L 13 4 H 24',
  'M 2 4 H 9 L 13 12 L 17 4 H 24',
  'M 2 9 H 9 L 13 3 L 17 9 H 24',
];
export function FilterTypeIcon({ type, h }: { type: number; h?: Size }) {
  return <PathIcon d={TYPE_PATHS[clamp(Math.round(type), 0, TYPE_PATHS.length - 1)]} h={h} />;
}

// ---- across several knob slots -----------------------------------------------------

/** Resonance 0..127 as a Q for the drawing: about 0.6 (no peak) to 14 */
const drawQ = (res: number) => 0.6 * Math.pow(2, (clamp(res, 0, 127) / 127) * 4.5);

/** Magnitude of a multimode filter type (LP2, LP1, BP, HP1, HP2, BS, PK) at r = f / cutoff */
function multimodeMag(type: number, r: number, q: number): number {
  const d = Math.sqrt((1 - r * r) * (1 - r * r) + (r / q) * (r / q)) || 1e-6;
  switch (type) {
    case 0: return 1 / d;
    case 1: return Math.sqrt(1 / d);            // half the slope, a softer peak
    case 2: return (r / d) * 0.75;
    case 3: return Math.sqrt((r * r) / d);
    case 4: return (r * r) / d;
    case 5: return Math.abs(1 - r * r) / d;     // the notch narrows as resonance rises
    default: return 1 + (0.9 * r) / d;          // everything passes, the band is boosted
  }
}
/** A 4-pole ladder low-pass: twice the slope of LP2 in decibels */
function ladderMag(r: number, q: number): number {
  const qq = Math.sqrt(q);
  const d = Math.sqrt((1 - r * r) * (1 - r * r) + (r / qq) * (r / qq)) || 1e-6;
  return 1 / (d * d);
}

/** A response curve: the x axis is the FRQ scale (a semitone per step), 0 dB sits a little below the middle */
function responsePath(w: number, frq: number, mag: (r: number) => number): string {
  const pts: string[] = [];
  for (let x = 2; x <= w - 2; x += 1) {
    const semis = ((x - 2) / (w - 4)) * 127 - frq;
    const db = 20 * Math.log10(Math.max(1e-4, mag(Math.pow(2, semis / 12))));
    pts.push(`${f(x)} ${f(clamp(8 - db * 0.3, 1.6, 12.4))}`);
  }
  return `M ${pts.join(' L ')}`;
}

function Frame() {
  return <rect x={0.8} y={0.8} width={78.4} height={12.4} rx={2} strokeOpacity={DIM} strokeWidth={1} {...NS} />;
}

/** A 4-pole low-pass across FRQ and RES: the peak grows with the resonance */
export function LadderGraph({ frq, res, h }: { frq: number; res: number; h?: Size }) {
  const q = drawQ(res);
  return <Wide w={80} h={h}><Frame /><path d={responsePath(80, frq, r => ladderMag(r, q))} {...NS} /></Wide>;
}

/** A multimode filter across FRQ and RES: the response of the chosen type (0..6: LP2, LP1, BP, HP1, HP2, BS, PK) */
export function MultimodeGraph({ frq, res, type, h }: { frq: number; res: number; type: number; h?: Size }) {
  const q = drawQ(res);
  const t = Math.round(clamp(type, 0, 6));
  return <Wide w={80} h={h}><Frame /><path d={responsePath(80, frq, r => multimodeMag(t, r, q))} {...NS} /></Wide>;
}

/** HPF and LPF of an effect: what is left between the two cut-offs */
export function BandGraph({ hpf, lpf, h }: { hpf: number; lpf: number; h?: Size }) {
  const xh = 4 + 62 * (clamp(hpf, 0, 127) / 127);
  const xl = Math.max(xh + 6, 14 + 62 * (clamp(lpf, 0, 127) / 127));
  return (
    <Wide w={80} h={h}>
      <Frame />
      <path d={`M 2 12 H ${f(xh)} L ${f(xh + 4)} 4 H ${f(xl - 4)} L ${f(xl)} 12 H 78`} {...NS} />
    </Wide>
  );
}

/** A reverb's shelf across FRQ and GAI: above FRQ the tail is damped, less so as GAI rises */
export function ShelfGraph({ frq, gain, h }: { frq: number; gain: number; h?: Size }) {
  const x = 6 + 62 * (clamp(frq, 0, 127) / 127);
  const y = 4 + 7.5 * (1 - clamp(gain, 0, 127) / 127);
  return (
    <Wide w={80} h={h}>
      <Frame />
      <path d={`M ${f(x)} 2 V 12`} strokeDasharray="0.1 2.2" strokeOpacity={DIM} {...NS} />
      <path d={`M 2 4 H ${f(x)} L ${f(Math.min(76, x + 5))} ${f(y)} H 78`} {...NS} />
    </Wide>
  );
}

const TOP = 2.2, BOTTOM = 12.2;
const node = (x: number, y: number, k: string) => <rect key={k} x={x - 1.4} y={y - 1.2} width={2.8} height={2.4} fill="currentColor" stroke="none" />;
const guides = (d: string) => <path d={d} strokeDasharray="0.1 2.2" strokeOpacity={DIM} {...NS} />;

/**
 * An ADSR envelope across four knob slots: the times (0..127) set the widths, SUS the level, the
 * curve kinds the segments. `hold`: the release never falls (REL at its maximum).
 */
export function AdsrGraph({ atk, dec, sus, rel, attack = 'linear', decay = 'linear', hold = false, h }: {
  atk: number; dec: number; sus: number; rel: number; attack?: Rise; decay?: Fall; hold?: boolean; h?: Size;
}) {
  const W = 160;
  const unit = (W - 8) / 4.3;
  const seg = (v: number) => unit * (0.07 + 0.93 * (clamp(v, 0, 127) / 127));
  const x0 = 4, xa = x0 + seg(atk), xd = xa + seg(dec), xs = xd + unit * 1.3;
  const xr = hold ? W - 2 : xs + seg(rel);
  const ys = BOTTOM - (BOTTOM - TOP) * (clamp(sus, 0, 127) / 127);
  return (
    <Wide w={W} h={h}>
      {guides(`M ${f(xa)} ${f(TOP)} V ${f(BOTTOM)} M ${f(xd)} ${f(ys)} V ${f(BOTTOM)} M ${f(xs)} ${f(ys)} V ${f(BOTTOM)}`)}
      <path d={`M ${f(x0)} ${f(BOTTOM)} ${rise(attack, x0, BOTTOM, xa, TOP)} ${fall(decay, xa, xd, ys)} H ${f(xs)} ${hold ? `H ${f(xr)}` : fall(decay, xs, xr, BOTTOM)}`} {...NS} />
      {node(x0, BOTTOM, 'o')}{node(xa, TOP, 'a')}{node(xd, ys, 'd')}{node(xs, ys, 's')}
    </Wide>
  );
}

/**
 * An attack, hold, decay envelope across three knob slots (the Rytm's AMP page). `hold`: the
 * decay never falls (DEC at its maximum).
 */
export function AhdGraph({ atk, hld, dec, hold = false, h }: { atk: number; hld: number; dec: number; hold?: boolean; h?: Size }) {
  const W = 120;
  const unit = (W - 8) / 3;
  const seg = (v: number) => unit * (0.07 + 0.93 * (clamp(v, 0, 127) / 127));
  const x0 = 4, xa = x0 + seg(atk), xh = xa + seg(hld);
  const xd = hold ? W - 2 : xh + seg(dec);
  return (
    <Wide w={W} h={h}>
      {guides(`M ${f(xa)} ${f(TOP)} V ${f(BOTTOM)} M ${f(xh)} ${f(TOP)} V ${f(BOTTOM)}`)}
      <path d={`M ${f(x0)} ${f(BOTTOM)} L ${f(xa)} ${f(TOP)} H ${f(xh)} ${hold ? `H ${f(xd)}` : `L ${f(xd)} ${f(BOTTOM)}`}`} {...NS} />
      {node(x0, BOTTOM, 'o')}{node(xa, TOP, 'a')}{node(xh, TOP, 'h')}
    </Wide>
  );
}
