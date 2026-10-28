// ============================================================================
// Mother-32 panel layout
// 60 HP x 3U Eurorack faceplate: 304.8 x 128.5 mm, wooden end cheeks.
// All x/y in millimetres from the faceplate's top-left. Controls use their
// centre, boxes (section / custom) their top-left.
//
// Left ~3/4: three rows of synthesis controls above the sequencer buttons and
// the 13-key button keyboard. Right ~1/4: the 32-point patch bay (4 x 8),
// outputs with boxed (inverted) legends, gate inputs ringed - as on the panel.
// ============================================================================

import type { PanelElement, PanelLayout } from '@/types/panel';
import { MOTHER32 } from './spec';
import { renderFn, renderKeyboard } from './panelUi';

const K = 4.1; // px per mm → ~1250 px faceplate

const BIG = 17;
const MED = 13;
const SMALL = 11;

const ROW1 = 24;
const ROW2 = 54;
const ROW3 = 82;

const knob = (control: string, x: number, y: number, diameter = MED): PanelElement =>
  ({ kind: 'knob', control, x, y, diameter, variant: 'moog-black' });
const sw = (control: string, x: number, y: number, labelText?: string): PanelElement =>
  ({ kind: 'switch', control, x, y, scale: 1.8, ...(labelText ? { labelText } : {}) });
const line = (x: number, y: number, w: number, hgt: number): PanelElement =>
  ({ kind: 'section', x, y, w, h: hgt, background: '#9a9a9a', radius: 0.2 });
const screw = (x: number, y: number): PanelElement =>
  ({ kind: 'section', x: x - 1.7, y: y - 1.7, w: 3.4, h: 3.4, radius: 1.7, background: 'radial-gradient(circle at 40% 35%, #c8c8c8 0%, #7a7a7a 60%, #3a3a3a 100%)' });

// --- Patch bay ---------------------------------------------------------------
const PB_X = (col: number) => 238 + col * 18;
const PB_Y = (row: number) => 18 + row * 14.4;
const GATE_INPUTS = new Set(['in_gate', 'in_tempo', 'in_run_stop', 'in_reset', 'in_hold']);

const patchBay: PanelElement[] = [];
const allJacks = [...(MOTHER32.patchBay?.inputs ?? []), ...(MOTHER32.patchBay?.outputs ?? [])];
allJacks.forEach(j => {
  const x = PB_X(j.column), y = PB_Y(j.row);
  if (GATE_INPUTS.has(j.id)) {
    // Gate inputs have a white circle printed around the jack nut
    patchBay.push({ kind: 'section', x: x - 4.3, y: y - 4.3, w: 8.6, h: 8.6, radius: 4.3, border: '1px solid #d8d8d8' });
  }
  patchBay.push({
    kind: 'label', text: j.label, x, y: y - 6.1, size: 8, font: 'condensed', weight: 700,
    ...(j.jackType === 'output' ? { invert: true } : { color: '#f2f2f2' }),
  });
  patchBay.push({ kind: 'jack', jack: j.id, x, y, label: 'none' });
});

// --- Sequencer buttons ---------------------------------------------------------
const BTN_W = 9, BTN_H = 6;
const BTN_X = [13, 27, 41];
const BTN_Y1 = 104, BTN_Y2 = 118;
const rectBtn = { shape: 'rect' as const, w: BTN_W, h: BTN_H, color: '#1c1c1c' };

const elements: PanelElement[] = [
  // --- Frame details ------------------------------------------------------------
  screw(7, 3), screw(220, 3), screw(7, 125.5), screw(220, 125.5),
  screw(298, 3), screw(298, 125.5),
  line(4, 95, 220, 0.35),                       // controls / keyboard divider
  { kind: 'section', x: 227.5, y: 7.5, w: 74.5, h: 117, border: '1px solid #8a8a8a', radius: 1.2 },

  // --- Row 1: TEMPO, VCO, MIX, VCF, VOLUME -------------------------------------------
  // TEMPO doubles as GATE LENGTH while SHIFT is on (hardware: SHIFT + TEMPO)
  { kind: 'knob', control: ({ values }) => (values.shift ? 'gate_length' : 'tempo'), x: 16, y: ROW1, diameter: SMALL, variant: 'moog-black' },
  knob('frequency', 46, ROW1, BIG),
  knob('pulse_width', 77, ROW1),
  knob('mix', 106, ROW1),
  { kind: 'label', text: 'VCO', x: 98.5, y: ROW1 + 9.5, size: 6, color: '#bdbdbd' },
  { kind: 'label', text: 'NOISE', x: 113.5, y: ROW1 + 9.5, size: 6, color: '#bdbdbd' },
  knob('cutoff', 140, ROW1, BIG),
  knob('resonance', 172, ROW1),
  knob('volume', 205, ROW1),

  // --- Row 2: GLIDE, VCO MOD, VCO WAVE, VCF MOD, VCF MODE, VCA MODE ------------------
  knob('glide', 16, ROW2, SMALL),
  knob('vco_mod_amount', 46, ROW2),
  sw('vco_mod_source', 62, ROW2, 'SOURCE'),
  sw('vco_mod_dest', 75, ROW2, 'DEST'),
  sw('vco_wave', 90, ROW2),
  sw('vcf_mod_source', 124, ROW2, 'SOURCE'),
  knob('vcf_mod_amount', 140, ROW2),
  sw('vcf_mode', 157, ROW2),
  sw('vca_mode', 205, ROW2),

  // --- Row 3: LFO, EG, ASSIGN, VC MIX ----------------------------------------------------
  knob('lfo_rate', 16, ROW3, SMALL),
  sw('lfo_wave', 33, ROW3),
  knob('attack', 106, ROW3),
  knob('decay', 140, ROW3),
  sw('sustain', 157, ROW3),
  { kind: 'switch', control: 'assign_source', x: 180, y: ROW3, style: 'buttons', orientation: 'vertical', scale: 1.4, labelText: 'ASSIGN (SETUP)' },
  knob('vc_mix', 205, ROW3, SMALL),

  // --- Branding ----------------------------------------------------------------------------
  { kind: 'label', text: 'moog', x: 70, y: ROW3 - 3, size: 30, font: 'serif', italic: true, weight: 400 },
  { kind: 'label', text: 'MOTHER-32', x: 70, y: ROW3 + 6, size: 11, weight: 800, letterSpacing: 2 },
  { kind: 'label', text: 'SEMI-MODULAR ANALOG SYNTHESIZER', x: 70, y: ROW3 + 10.5, size: 5, color: '#8a8a8a', letterSpacing: 0.8 },

  // --- Sequencer / keyboard buttons --------------------------------------------------------
  { kind: 'button', control: 'shift', x: BTN_X[0], y: BTN_Y1, ...rectBtn, ledColor: '#f5f5f5', label: 'above' },
  {
    kind: 'button', event: 'oct_down', x: BTN_X[1], y: BTN_Y1, ...rectBtn, ledColor: '#f5f5f5', labelText: 'KB ◂', label: 'above',
    lit: ({ engine }) => ((engine.octave as number) ?? 0) < 0,
  },
  {
    kind: 'button', event: 'oct_up', x: BTN_X[2], y: BTN_Y1, ...rectBtn, ledColor: '#f5f5f5', labelText: 'STEP ▸', label: 'above',
    lit: ({ engine }) => ((engine.octave as number) ?? 0) > 0,
  },
  {
    kind: 'button', control: 'run_stop', x: BTN_X[0], y: BTN_Y2, ...rectBtn, ledColor: '#ff3b30', label: 'above',
    lit: ({ values, engine }) => (values.rec ? 0.6 : engine.playing ? 1 : 0),
  },
  // REC overlay sits on RUN/STOP while SHIFT is latched (SHIFT + RUN/STOP = REC)
  // (a zero-size box, so when SHIFT is off nothing covers RUN/STOP; the cap overflows it)
  { kind: 'custom', x: BTN_X[0] - BTN_W / 2, y: BTN_Y2 - BTN_H / 2, w: 0, h: 0, render: renderFn('rec', BTN_W, BTN_H, K) },
  { kind: 'label', text: 'HOLD/REST', x: BTN_X[1], y: BTN_Y2 - BTN_H / 2 - 2.1, size: 7, color: '#d4d4d4' },
  { kind: 'custom', x: BTN_X[1] - BTN_W / 2, y: BTN_Y2 - BTN_H / 2, w: BTN_W, h: BTN_H, render: renderFn('hold', BTN_W, BTN_H, K) },
  { kind: 'label', text: 'RESET/ACCENT', x: BTN_X[2], y: BTN_Y2 - BTN_H / 2 - 2.1, size: 7, color: '#d4d4d4' },
  { kind: 'custom', x: BTN_X[2] - BTN_W / 2, y: BTN_Y2 - BTN_H / 2, w: BTN_W, h: BTN_H, render: renderFn('reset', BTN_W, BTN_H, K) },

  // --- 13-key button keyboard (key LEDs show the sounding note / sequencer step) ------------
  { kind: 'custom', x: 52, y: 96.5, w: 172, h: 27, render: renderKeyboard(172, 27, K) },

  // --- Patch bay ---------------------------------------------------------------------------
  ...patchBay,
];

export const MOTHER32_LAYOUT: PanelLayout = {
  width: 304.8,
  height: 128.5,
  pxPerMm: K,
  theme: {
    background: 'linear-gradient(180deg, #141414 0%, #0c0c0c 100%)',
    text: '#f2f2f2',
    muted: '#cfcfcf',
    font: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    cheeks: { width: 9, background: 'linear-gradient(90deg, #3b2616 0%, #6e4a2c 45%, #5a3b22 70%, #3b2616 100%)' },
    jack: { ring: '#5a5a5a', outputLabelBg: '#f2f2f2', outputLabelText: '#000000' },
  },
  elements,
};
