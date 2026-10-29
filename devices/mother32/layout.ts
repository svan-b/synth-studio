// ============================================================================
// Mother-32 panel layout
// 60 HP x 3U Eurorack faceplate, 304.8 x 128.5 mm, in wooden end cheeks.
// All x/y in millimetres from the faceplate's top-left; controls use their
// centre, boxes (section / custom) their top-left.
//
// Positions: the panel drawing in the v2 manual (p.68) as measured at 200 dpi by
// the patchscore project (see REFERENCE.md "PD"), moved into faceplate
// coordinates. Three rows of identical black knobs and bat toggles, two rows of
// square pads (the 13-note keyboard and the sequencer keys), MIDI IN bottom left,
// and the 4 x 8 patch bay on the right under its IN / OUT legend. The panel
// prints no section boxes.
// ============================================================================

import type { ReactNode } from 'react';
import type { CustomRenderContext, PanelElement, PanelLayout } from '@/types/panel';
import { MOTHER32 } from './spec';
import {
  BLACK, WHITE, editTarget, renderDin, renderFn, renderKey, renderMidiLed, renderOctLeds, renderReadout, renderSetup, renderStepLeds,
  renderTempoLed, ui,
} from './panelUi';

const K = 4.1; // px per mm -> 1250 px faceplate

const KNOB = 14.5;          // cap diameter (all 14 knobs are the same size)
const ROW1 = 18.0, ROW2 = 46.9, ROW3 = 75.9;
const LEGEND = 7.6;         // px

const knob = (control: string, x: number, y: number): PanelElement =>
  ({ kind: 'knob', control, x, y, diameter: KNOB, variant: 'moog-black', label: 'none' });

/** A printed legend above a control (one or two lines) */
const legend = (text: string, x: number, y: number, size = LEGEND): PanelElement => {
  const lines = text.split('\n').length;
  return { kind: 'label', text, x, y: y - KNOB / 2 - (lines === 2 ? 4.0 : 2.6), size, letterSpacing: 0.3 };
};

/** A bat toggle with its title printed above; position legends sit beside the lever */
const toggle = (control: string, title: string, x: number, y: number, legendW = 7): PanelElement[] => [
  { kind: 'switch', control, x: x + legendW / 2, y, scale: 1.9, label: 'none' },
  { kind: 'label', text: title, x, y: y - (title.includes('\n') ? 9.4 : 8.2), size: LEGEND, letterSpacing: 0.3 },
];

/** The printed scale ring of FREQUENCY, PULSE WIDTH, TEMPO and LFO RATE (manual p.9, p.11, p.13) */
const scaleRing = (x: number, y: number): PanelElement[] => [
  { kind: 'section', x: x - 10.4, y: y - 10.4, w: 20.8, h: 20.8, radius: 10.4, border: '1px solid #d9d9d9' },
  { kind: 'section', x: x - 9.0, y: y - 9.0, w: 18.0, h: 18.0, radius: 9.0, border: '1px solid #8a8a8a' },
];

/** The small holes beside some knobs (the panel drawing, manual p.9; four reach the VCO trimmers, p.61) */
const hole = (x: number, y: number): PanelElement =>
  ({ kind: 'section', x: x - 1.25, y: y - 1.25, w: 2.5, h: 2.5, radius: 1.25, border: '1px solid #9a9a9a', background: '#050505' });

const screw = (x: number, y: number): PanelElement =>
  ({ kind: 'section', x: x - 1.6, y: y - 1.6, w: 3.2, h: 3.2, radius: 1.6, background: 'radial-gradient(circle at 40% 35%, #d0d0d0 0%, #808080 55%, #3a3a3a 100%)' });

// --- Patch bay: 4 columns x 8 rows ---------------------------------------------
const PB_X = [256.2, 270.0, 283.9, 297.8];
const PB_Y = (row: number) => 19.6 + row * 13.4;
// The circled (gate) inputs of the patch bay drawing, manual p.46: GATE, RUN / STOP, RESET, HOLD
const GATE_INPUTS = new Set(['in_gate', 'in_run_stop', 'in_reset', 'in_hold']);

const patchBay: PanelElement[] = [
  { kind: 'section', x: 248.8, y: 7.9, w: 55, h: 111.6, border: '1px solid #8c8c8c', radius: 1.2 },
  { kind: 'label', text: 'IN', x: 270.2, y: 5.3, size: 7.5, color: '#f2f2f2' },
  { kind: 'label', text: '/', x: 273.8, y: 5.3, size: 7.5, color: '#9a9a9a' },
  { kind: 'label', text: 'OUT', x: 278.6, y: 5.3, size: 7.5, invert: true },
];
[...(MOTHER32.patchBay?.inputs ?? []), ...(MOTHER32.patchBay?.outputs ?? [])].forEach(j => {
  const x = PB_X[j.column], y = PB_Y(j.row);
  if (GATE_INPUTS.has(j.id)) {
    // gate inputs are printed inside a circle
    patchBay.push({ kind: 'section', x: x - 4.4, y: y - 4.4, w: 8.8, h: 8.8, radius: 4.4, border: '1px solid #d8d8d8' });
  }
  patchBay.push({
    kind: 'label', text: j.label, x, y: y - 6.0, size: 7.2, font: 'condensed', weight: 700,
    ...(j.jackType === 'output' ? { invert: true } : { color: '#f2f2f2' }),
  });
  patchBay.push({ kind: 'jack', jack: j.id, x, y, label: 'none' });
});

// --- Sequencer buttons and keyboard ----------------------------------------------
const UP_Y = 96.0, LO_Y = 108.2;
const PAD_W = 8.3, PAD_H = 7.2;
const ARROW_W = 9.7, ARROW_H = 10.4;
const STEP_X = (k: number) => 126.4 + k * 15.3;
const BLACK_X = [134.1, 149.3, 179.9, 195.3, 210.5];

const pad = (x: number, y: number, w: number, hgt: number, render: (c: CustomRenderContext) => ReactNode): PanelElement =>
  ({ kind: 'custom', x: x - w / 2, y: y - hgt / 2, w, h: hgt, render });

const keyLegend = (text: string, x: number, y: number): PanelElement =>
  ({ kind: 'label', text, x, y, size: 7, color: '#e8e8e8', letterSpacing: 0.2 });

const sequencer: PanelElement[] = [
  // upper row: HOLD / REST, PATTERN (BANK), OCTAVE / LOCATION LEDs, the five black keys
  keyLegend('HOLD / REST', 40.0, UP_Y - 6.1),
  pad(40.0, UP_Y, PAD_W, PAD_H, renderFn('hold', PAD_W, PAD_H, K)),
  // the Tempo LED sits directly above (SHIFT) (manual p.18)
  { kind: 'custom', x: 55.3 - 1.1, y: UP_Y - 1.1, w: 2.2, h: 2.2, render: renderTempoLed(2.2, K) },
  keyLegend('PATTERN\n(BANK)', 70.6, UP_Y - 6.9),
  pad(70.6, UP_Y, PAD_W, PAD_H, renderFn('pattern', PAD_W, PAD_H, K)),
  keyLegend('OCTAVE / LOCATION', 98.1, UP_Y - 4.4),
  { kind: 'custom', x: 98.1 - 18, y: UP_Y - 1.1, w: 36, h: 2.2, render: renderOctLeds(4.5, 2.2, K) },
  ...['1', '2', '3', '4', '5', '6', '7', '8'].map((n, i): PanelElement => ({ kind: 'label', text: n, x: 98.1 - 18 + 2.25 + i * 4.5, y: UP_Y + 2.8, size: 5, color: '#9a9a9a' })),
  ...['1-8', '9-16', '17-24', '25-32', 'SET END'].map((t, j) => keyLegend(t, BLACK_X[j], UP_Y - 6.1)),
  ...BLACK.map((ki, j) => pad(BLACK_X[j], UP_Y, PAD_W, PAD_H, renderKey(ki, PAD_W, PAD_H, K))),

  // lower row: RESET / ACCENT, (SHIFT), RUN / STOP (REC), the two arrows, the eight step pads
  keyLegend('RESET /\nACCENT', 40.0, LO_Y - 6.9),
  pad(40.0, LO_Y, PAD_W, PAD_H, renderFn('reset', PAD_W, PAD_H, K)),
  keyLegend('(SHIFT)', 55.3, LO_Y - 6.1),
  pad(55.3, LO_Y, PAD_W, PAD_H, renderFn('shift', PAD_W, PAD_H, K)),
  keyLegend('RUN / STOP\n(REC)', 70.7, LO_Y - 6.9),
  pad(70.7, LO_Y, PAD_W, PAD_H, renderFn('run', PAD_W, PAD_H, K)),
  keyLegend('(KB)', 89.4, LO_Y - 7.0),
  pad(89.4, LO_Y, ARROW_W, ARROW_H, renderFn('kb', ARROW_W, ARROW_H, K)),
  keyLegend('(STEP)', 106.7, LO_Y - 7.0),
  pad(106.7, LO_Y, ARROW_W, ARROW_H, renderFn('step', ARROW_W, ARROW_H, K)),
  ...WHITE.map((ki, k) => keyLegend(String(k + 1), STEP_X(k), LO_Y - 6.1)),
  ...WHITE.map((ki, k) => pad(STEP_X(k), LO_Y, PAD_W, PAD_H, renderKey(ki, PAD_W, PAD_H, K))),
  { kind: 'custom', x: STEP_X(0) - 7.65, y: LO_Y + 5.2, w: 15.3 * 8, h: 2.0, render: renderStepLeds(15.3, 2.0, K) },

  // teaching readout (not on the hardware) and the Setup page
  { kind: 'custom', x: 120.2, y: 118.4, w: 124, h: 4, render: renderReadout(124, K) },
  { kind: 'custom', x: 262, y: 121.1, w: 22, h: 5, render: renderSetup(K) },
];

const editing = (values: CustomRenderContext['values'], u: Record<string, unknown> | undefined) =>
  editTarget(values, ui({ ui: u })) >= 0;

const elements: PanelElement[] = [
  // --- Frame details ------------------------------------------------------------------
  screw(7.5, 3.0), screw(297.1, 3.0), screw(7.5, 125.5), screw(297.1, 125.5),

  // --- Row 1: FREQUENCY, VCO WAVE, PULSE WIDTH, MIX, CUTOFF, RESONANCE, VCA MODE, VOLUME --
  ...scaleRing(21.7, ROW1), ...scaleRing(80.8, ROW1), ...scaleRing(41.0, ROW3), ...scaleRing(80.8, ROW3),
  hole(36.5, ROW1), hole(65.9, ROW1), hole(95.6, ROW1), hole(95.6, ROW2), hole(95.6, ROW3),
  legend('FREQUENCY', 21.7, ROW1), knob('frequency', 21.7, ROW1),
  ...toggle('vco_wave', 'VCO WAVE', 51.3, ROW1, 7.5),
  legend('PULSE WIDTH', 80.8, ROW1), knob('pulse_width', 80.8, ROW1),
  legend('MIX', 110.3, ROW1), knob('mix', 110.3, ROW1),
  { kind: 'label', text: 'VCO', x: 103.6, y: ROW1 + 8.4, size: 5.6, color: '#bdbdbd' },
  { kind: 'label', text: 'NOISE / EXT', x: 118.4, y: ROW1 + 8.4, size: 5.6, color: '#bdbdbd' },
  legend('CUTOFF', 146.1, ROW1), knob('cutoff', 146.1, ROW1),
  { kind: 'label', text: '20Hz', x: 137.8, y: ROW1 + 8.0, size: 5.6, color: '#bdbdbd' },
  { kind: 'label', text: '200Hz', x: 137.4, y: ROW1 - 7.2, size: 5.6, color: '#bdbdbd' },
  { kind: 'label', text: '2KHz', x: 154.8, y: ROW1 - 7.2, size: 5.6, color: '#bdbdbd' },
  { kind: 'label', text: '20KHz', x: 154.6, y: ROW1 + 8.0, size: 5.6, color: '#bdbdbd' },
  legend('RESONANCE', 181.8, ROW1), knob('resonance', 181.8, ROW1),
  ...toggle('vca_mode', 'VCA MODE', 206.3, ROW1, 4.5),
  legend('VOLUME', 228.7, ROW1), knob('volume', 228.7, ROW1),

  // --- Row 2: GLIDE, VCO MOD SOURCE / AMOUNT / DEST, VCF MODE, VCF MOD SOURCE / AMOUNT / POLARITY --
  legend('GLIDE', 21.8, ROW2),
  {
    kind: 'knob',
    // While a step is edited GLIDE turns that step's glide on / off, with SHIFT its ratchet. With
    // KB / STEP held it picks the swing interval (both: straight, KB: dotted, STEP: triplet); with
    // SHIFT during playback, live ratchets (manual pp.21, 29)
    control: ({ values, ui: u }) => {
      if (editing(values, u)) return values.shift ? 'step_ratchet' : 'step_glide';
      const held = (u?.held ?? {}) as { kb?: boolean; step?: boolean };
      if (held.kb && held.step) return 'swing_div';
      if (held.kb) return 'swing_dotted';
      if (held.step) return 'swing_triplet';
      return values.shift ? 'live_ratchet' : 'glide';
    },
    x: 21.8, y: ROW2, diameter: KNOB, variant: 'moog-black', label: 'none',
  },
  ...toggle('vco_mod_source', 'VCO MOD\nSOURCE', 51.3, ROW2, 5),
  legend('VCO MOD\nAMOUNT', 80.8, ROW2), knob('vco_mod_amount', 80.8, ROW2),
  ...toggle('vco_mod_dest', 'VCO MOD\nDEST', 110.5, ROW2, 6),
  ...toggle('vcf_mode', 'VCF MODE', 139.9, ROW2, 10),
  ...toggle('vcf_mod_source', 'VCF MOD\nSOURCE', 169.6, ROW2, 5),
  legend('VCF MOD\nAMOUNT', 199.2, ROW2), knob('vcf_mod_amount', 199.2, ROW2),
  ...toggle('vcf_mod_polarity', 'VCF MOD\nPOLARITY', 228.6, ROW2, 3),

  // --- Row 3: TEMPO / GATE LENGTH (SWING), LFO RATE, LFO WAVE, ATTACK, SUSTAIN, DECAY, VC MIX --
  legend('TEMPO / GATE LENGTH\n(SWING)', 41.0, ROW3, 7.2),
  {
    kind: 'knob',
    // TEMPO is GATE LENGTH while a step is edited and SWING with SHIFT. Otherwise (firmware 2.0) it
    // picks the clock division: a straight one when the studio (MIDI) clock or a TEMPO-jack clock
    // drives the steps, or with KB + STEP held; a dotted one with KB held, a triplet with STEP held.
    // On the internal clock it sets the tempo.
    control: ({ values, engine, ui: u }) => {
      if (editing(values, u)) return 'step_gate';
      if (values.shift) return 'swing';
      const held = (u?.held ?? {}) as { kb?: boolean; step?: boolean };
      if (held.kb && held.step) return 'step_div';
      if (held.kb) return 'div_dotted';
      if (held.step) return 'div_triplet';
      return engine?.synced || engine?.extClock ? 'step_div' : 'tempo';
    },
    x: 41.0, y: ROW3, diameter: KNOB, variant: 'moog-black', label: 'none',
  },
  legend('LFO RATE', 80.8, ROW3), knob('lfo_rate', 80.8, ROW3),
  ...toggle('lfo_wave', 'LFO WAVE', 110.4, ROW3, 5),
  legend('ATTACK', 139.9, ROW3), knob('attack', 139.9, ROW3),
  ...toggle('sustain', 'SUSTAIN', 169.5, ROW3, 5),
  legend('DECAY', 199.2, ROW3), knob('decay', 199.2, ROW3),
  legend('VC MIX', 228.7, ROW3), knob('vc_mix', 228.7, ROW3),
  { kind: 'label', text: 'LO / MIX 1', x: 219.6, y: ROW3 + 8.4, size: 5.6, color: '#bdbdbd' },
  { kind: 'label', text: 'HI / MIX 2', x: 237.8, y: ROW3 + 8.4, size: 5.6, color: '#bdbdbd' },

  // --- MIDI IN: its LED left of TEMPO, the legend above the socket (manual p.9) ---------
  { kind: 'custom', x: 14.3 - 1.4, y: 77.4 - 1.4, w: 2.8, h: 2.8, render: renderMidiLed(2.8, K) },
  { kind: 'label', text: 'MIDI IN', x: 14.3, y: 89.0, size: 6.4, color: '#e8e8e8' },
  { kind: 'custom', x: 13.8 - 7.8, y: 107.8 - 7.8, w: 15.6, h: 15.6, render: renderDin(15.6, K) },
  { kind: 'label', text: 'moog', x: 6.4, y: 122.3, size: 17, font: 'serif', italic: true, weight: 400, align: 'left' },
  { kind: 'label', text: 'MOTHER-32', x: 26.6, y: 122.6, size: 10.5, weight: 800, align: 'left', letterSpacing: 1.4 },

  ...sequencer,
  ...patchBay,
];

export const MOTHER32_LAYOUT: PanelLayout = {
  width: 304.8,
  height: 128.5,
  pxPerMm: K,
  theme: {
    background: 'linear-gradient(180deg, #161616 0%, #0e0e0e 100%)',
    text: '#f2f2f2',
    muted: '#cfcfcf',
    font: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    cheeks: { width: 7.25, background: 'linear-gradient(90deg, #3b2616 0%, #6e4a2c 45%, #5a3b22 70%, #3b2616 100%)' },
    jack: { ring: '#5a5a5a', outputLabelBg: '#f2f2f2', outputLabelText: '#000000' },
  },
  elements,
};
