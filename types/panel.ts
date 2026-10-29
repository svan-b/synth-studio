// ============================================================================
// Panel layout types
// A device panel is a list of positioned elements on a physical panel measured
// in millimetres. The generic <SynthPanel> renders any layout, so adding a new
// instrument is data (spec + layout) plus an audio engine.
//
// Coordinate convention: x/y are millimetres from the panel's top-left corner.
//   - control-like elements (knob, slider, switch, button, jack, led, pad) use x/y as their CENTRE
//   - box-like elements (section, display, keyboard, stepgrid, custom) use x/y as their TOP-LEFT
//   - labels use x/y as the anchor given by `align` (default centre), y = text centre line
// ============================================================================

import type { ReactNode } from 'react';
import type { ControlValue, LessonStep } from './index';

export type Values = Record<string, ControlValue>;

/** Live state the audio engine publishes for the UI (current step, LEDs, meters...) */
export interface EngineState {
  playing?: boolean;
  step?: number;
  /** Per-track or per-voice step positions, keyed however the device likes */
  steps?: Record<string, number>;
  /** LED brightness 0..1 keyed by LED id */
  leds?: Record<string, number>;
  /** Meter levels 0..1 keyed by meter id */
  meters?: Record<string, number>;
  [key: string]: unknown;
}

export interface PanelContext {
  values: Values;
  engine: EngineState;
  /** Structured device data (patterns, songs...) - DeviceModule.data */
  data?: unknown;
  /** Ephemeral per-instance UI state (held trig, page, menu open...) */
  ui?: Record<string, unknown>;
}

export type KnobVariant =
  | 'moog-silver'   // DFAM aluminium caps
  | 'moog-black'    // Mother-32 / Subharmonicon black caps with white line
  | 'moog-large'    // Sub 37 large knurled knobs
  | 'elektron'      // Endless encoders
  | 'xone'          // Allen & Heath rubberised caps
  | 'chicken';      // Pointer knob

export type LabelPosition = 'above' | 'below' | 'left' | 'right' | 'none';
export type ValueDisplay = 'always' | 'hover' | 'never';

interface Positioned {
  x: number;
  y: number;
}

export interface KnobElement extends Positioned {
  kind: 'knob';
  /** Fixed control, or a function that picks the control from current state (encoders on paged UIs) */
  control: string | ((ctx: PanelContext) => string | null);
  diameter?: number;       // mm, default 12
  variant?: KnobVariant;
  capColor?: string;
  label?: LabelPosition;   // default 'above'
  labelText?: string;      // overrides spec label
  value?: ValueDisplay;    // default 'always'
}

export interface SliderElement extends Positioned {
  kind: 'slider';
  control: string;
  length: number;          // mm of travel
  orientation?: 'vertical' | 'horizontal';
  capColor?: string;
  label?: LabelPosition;
  labelText?: string;
  value?: ValueDisplay;
}

export interface SwitchElement extends Positioned {
  kind: 'switch';
  control: string;
  orientation?: 'vertical' | 'horizontal';
  /** toggle = bat lever, buttons = row of radio buttons, rotary = small selector knob */
  style?: 'toggle' | 'buttons' | 'rotary';
  label?: LabelPosition;
  labelText?: string;
  scale?: number;          // visual scale multiplier (1 = DFAM size)
  /**
   * Where a vertical toggle's position legends go: beside the lever (default), or 'ends' - the
   * first above it and the last below, as Moog prints them on the Mother-32 (the middle one of a
   * three-way switch stays beside)
   */
  legends?: 'side' | 'ends';
}

export interface ButtonElement extends Positioned {
  kind: 'button';
  /** Control this button writes. Toggle/momentary per spec; with `setValue` it acts as a radio button */
  control?: string;
  setValue?: ControlValue;
  /** Engine event fired on press (and `${event}:up` on release) - for pads, trig keys, transport */
  event?: string;
  shape?: 'round' | 'square' | 'rect';
  w?: number;              // mm (diameter for round)
  h?: number;              // mm (rect only)
  color?: string;          // cap colour
  ledColor?: string;
  /** Lit state; defaults to control value / radio match */
  lit?: (ctx: PanelContext) => number | boolean;
  label?: LabelPosition;
  labelText?: string;
  capText?: string;        // text printed on the button itself
}

export interface JackElement extends Positioned {
  kind: 'jack';
  jack: string;            // id from spec.patchBay
  label?: LabelPosition;   // default 'above'
  labelText?: string;
}

export interface LedElement extends Positioned {
  kind: 'led';
  color?: string;
  size?: number;           // mm, default 2.5
  on: (ctx: PanelContext) => number | boolean;
}

export interface LabelElement extends Positioned {
  kind: 'label';
  text: string;
  size?: number;           // px font size at native scale
  color?: string;
  align?: 'left' | 'center' | 'right';
  weight?: number;
  font?: 'sans' | 'serif' | 'mono' | 'condensed';
  italic?: boolean;
  invert?: boolean;        // white box with dark text (Moog output-jack style)
  letterSpacing?: number;
  rotate?: number;
  /**
   * Keep this exact size and colour. By default the panel raises small text to a legible
   * size for the current zoom and shrinks it again where it would collide; logos and
   * artwork that must not change can opt out.
   */
  fixed?: boolean;
}

export interface SectionElement extends Positioned {
  kind: 'section';
  w: number;
  h: number;
  title?: string;
  titleColor?: string;
  border?: string;
  background?: string;
  radius?: number;         // mm
}

export interface DisplayElement extends Positioned {
  kind: 'display';
  w: number;
  h: number;
  style?: 'oled' | 'lcd' | 'led-segment';
  render: (ctx: PanelContext) => ReactNode | string[];
}

export interface KeyboardElement extends Positioned {
  kind: 'keyboard';
  w: number;
  h: number;
  lowNote: number;         // MIDI note of the leftmost key
  numKeys: number;
  style?: 'piano' | 'membrane';
}

export interface StepGridElement extends Positioned {
  kind: 'stepgrid';
  w: number;
  h: number;
  steps: number;
  /** Pattern control to edit; function form lets the grid follow the selected track */
  control: string | ((ctx: PanelContext) => string | null);
  /** Which step is playing, from engine state */
  playhead?: (ctx: PanelContext) => number | undefined;
  color?: string;
  rows?: number;           // e.g. 2 rows of 8
  numbered?: boolean;
}

export interface CustomElement extends Positioned {
  kind: 'custom';
  w: number;
  h: number;
  /** `teaching`/`step` let custom widgets highlight themselves when a lesson step targets them */
  render: (ctx: CustomRenderContext) => ReactNode;
}

/** Everything a `custom` element can read and do */
export interface CustomRenderContext extends PanelContext {
  setValue: (id: string, v: ControlValue) => void;
  sendEvent: (e: string, payload?: unknown) => void;
  teaching: boolean;
  step: LessonStep | null;
  data: unknown;
  ui: Record<string, unknown>;
  updateData: (fn: (draft: unknown) => unknown) => void;
  setUi: (patch: Record<string, unknown>) => void;
  /** Instance id of the device (studio may hold several of the same device) */
  instance: string;
}

export type PanelElement =
  | KnobElement
  | SliderElement
  | SwitchElement
  | ButtonElement
  | JackElement
  | LedElement
  | LabelElement
  | SectionElement
  | DisplayElement
  | KeyboardElement
  | StepGridElement
  | CustomElement;

export interface PanelTheme {
  background: string;      // CSS background of the faceplate
  text: string;            // primary legend colour
  muted?: string;          // secondary legend colour
  accent?: string;
  font?: string;           // CSS font-family for legends
  /** Wooden (or metal) end cheeks either side of the faceplate */
  cheeks?: { width: number; background: string };
  /** Extra frame around the faceplate, e.g. Elektron chassis */
  frame?: { padding: number; background: string; radius?: number };
  jack?: { ring: string; outputLabelBg?: string; outputLabelText?: string };
}

export interface PanelLayout {
  width: number;           // faceplate width in mm
  height: number;          // faceplate height in mm
  pxPerMm: number;         // native render scale
  theme: PanelTheme;
  elements: PanelElement[];
  /** Degrees a knob turns from minimum to maximum (default 270). Moog's drawn knobs turn
   *  about 300, from 7 o'clock to 5 o'clock, and their manuals' clock positions assume it */
  knobTravel?: number;
}
