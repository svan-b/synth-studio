// ============================================================================
// Sub 37 panel layout (mm from the top-left of the black panel, cheeks excluded)
//
// The instrument is 26.375" x 14.75" (670 x 375 mm, manual p.61). Seen from
// above, the sloped control panel sits behind the 37-note keyboard, with the
// pitch and mod wheels to the left of the keys. Sections run left to right in
// signal-flow order as on the hardware: presets/LCD, arpeggiator and glide on
// the left; then MODULATION (Mod 1 over Mod 2), OSCILLATORS, MIXER, FILTER and
// ENVELOPES (Filter EG over Amp EG, KNOB SHIFT between the two).
// Drawn at 2 px/mm; the faceplate is 625 mm plus 16 mm wooden cheeks.
// ============================================================================

import type { ButtonElement, KnobElement, PanelElement, PanelLayout } from '@/types/panel';
import { Lcd, PresetBank, Wheel } from './panel';
import { MOD_SOURCES } from './spec';

const W = 625;
const H = 300;
const KEYS_Y = 182;

const BIG = 18;
const MID = 15;
const SMALL = 13;

const knob = (control: string, x: number, y: number, diameter = MID, extra: Partial<KnobElement> = {}): PanelElement => ({
  kind: 'knob', control, x, y, diameter, variant: 'moog-large', ...extra,
});
const led = (control: string, x: number, y: number, extra: Partial<ButtonElement> = {}): PanelElement => ({
  kind: 'button', control, x, y, shape: 'rect', w: 9, h: 5.5, color: '#1c1c1c', ledColor: '#ff3b30', ...extra,
});
const title = (text: string, x: number, y: number, align: 'left' | 'center' = 'left'): PanelElement => ({
  kind: 'label', text, x, y, size: 9, weight: 800, letterSpacing: 1.2, align,
});
const sub = (text: string, x: number, y: number, align: 'left' | 'center' = 'left'): PanelElement => ({
  kind: 'label', text, x, y, size: 7.5, weight: 700, letterSpacing: 0.8, align, color: '#bdbdbd',
});
const box = (x: number, y: number, w: number, h: number): PanelElement => ({
  kind: 'section', x, y, w, h, border: '1px solid #3b3b3b', radius: 1.5,
});

// --- Modulation bus rows ----------------------------------------------------
function modRow(n: 1 | 2, top: number): PanelElement[] {
  const ky = top + 24;
  return [
    sub(`MOD ${n}`, 124, top + 1),
    ...MOD_SOURCES.map((src, i): PanelElement => ({
      kind: 'button', control: `mod${n}_source`, setValue: i, x: 128, y: top + 9 + i * 10,
      shape: 'round', w: 5.5, color: '#1c1c1c', ledColor: '#ff3b30', label: 'right', labelText: src,
    })),
    knob(`mod${n}_rate`, 163, ky, BIG),
    led(`mod${n}_hi_range`, 163, top + 52),
    knob(`mod${n}_pitch_amt`, 190, ky, SMALL),
    { kind: 'switch', control: `mod${n}_pitch_dest`, x: 190, y: top + 59, style: 'buttons', orientation: 'vertical', scale: 1.3 },
    knob(`mod${n}_filter_amt`, 217, ky, SMALL),
    knob(`mod${n}_pgm_amt`, 246, ky, SMALL),
    { kind: 'switch', control: `mod${n}_pgm_dest`, x: 246, y: top + 62, style: 'buttons', orientation: 'vertical', scale: 1.3 },
  ];
}

// --- Envelope rows -------------------------------------------------------------
const EG_X = [512, 539, 566, 593];
function envRow(p: 'feg' | 'aeg', name: string, top: number): PanelElement[] {
  const shifted: Record<string, string> = { attack: 'delay', decay: 'hold', sustain: 'vel_amt', release: 'kb_amt' };
  return [
    sub(name, 498, top),
    ...(['attack', 'decay', 'sustain', 'release'] as const).map((stage, i) =>
      knob(`${p}_${stage}`, EG_X[i], top + 24, MID, {
        // KNOB SHIFT turns ATTACK/DECAY/SUSTAIN/RELEASE into DELAY/HOLD/VEL AMT/KB AMT
        control: ({ values }) => (values.knob_shift ? `${p}_${shifted[stage]}` : `${p}_${stage}`),
      })),
    ...(['multi_trig', 'reset', 'loop', 'latch'] as const).map((b, i) => led(`${p}_${b}`, EG_X[i], top + 52)),
  ];
}

const elements: PanelElement[] = [
  // ===== Section frames ========================================================
  box(4, 98, 64, 79),     // arpeggiator
  box(70, 98, 47, 79),    // glide
  box(120, 4, 143, 173),  // modulation
  box(266, 4, 95, 173),   // oscillators
  box(364, 4, 37, 173),   // mixer
  box(404, 4, 87, 173),   // filter
  box(494, 4, 127, 173),  // envelopes

  // ===== Branding, LCD, presets, output ========================================
  { kind: 'label', text: 'moog', x: 7, y: 13, size: 26, font: 'serif', italic: true, weight: 400, align: 'left' },
  { kind: 'label', text: 'SUB 37', x: 56, y: 10, size: 15, weight: 900, align: 'left', letterSpacing: 0.5 },
  { kind: 'label', text: 'TRIBUTE EDITION', x: 56, y: 18, size: 6, weight: 600, align: 'left', color: '#c9a86a', letterSpacing: 1.6 },
  { kind: 'display', x: 7, y: 26, w: 64, h: 32, render: ctx => <Lcd {...ctx} /> },
  knob('master_volume', 97, 44, MID, { labelText: 'MASTER VOL' }),
  sub('PRESETS  ·  BANK 1', 7, 64),
  { kind: 'custom', x: 7, y: 68, w: 108, h: 24, render: ctx => <PresetBank values={ctx.values} setValue={ctx.setValue} /> },

  // ===== Arpeggiator ===========================================================
  title('ARPEGGIATOR', 36, 102, 'center'),
  knob('arp_rate', 18, 120, SMALL),
  led('arp_on', 40, 115),
  led('arp_latch', 57, 115),
  led('arp_back_fwd', 48, 131),
  { kind: 'switch', control: 'arp_mode', x: 36, y: 149, style: 'buttons', orientation: 'horizontal', scale: 1.15 },
  { kind: 'switch', control: 'arp_range', x: 36, y: 167, style: 'buttons', orientation: 'horizontal', scale: 1.3 },

  // ===== Glide =================================================================
  title('GLIDE', 93.5, 102, 'center'),
  knob('glide_time', 93.5, 118, SMALL),
  led('glide_on', 77, 141),
  led('glide_legato', 92, 141),
  led('glide_gated', 109.5, 141),
  { kind: 'switch', control: 'glide_type', x: 82, y: 162, style: 'buttons', orientation: 'vertical', scale: 1.15 },
  { kind: 'switch', control: 'glide_osc', x: 105, y: 162, style: 'buttons', orientation: 'vertical', scale: 1.15 },

  // ===== Modulation ============================================================
  title('MODULATION', 191.5, 8, 'center'),
  ...modRow(1, 14),
  { kind: 'label', text: 'MOD WHEEL → MOD 1 DEPTH', x: 200, y: 92, size: 6, color: '#8a8a8a', weight: 600 },
  ...modRow(2, 96),

  // ===== Oscillators ===========================================================
  title('OSCILLATORS', 313.5, 8, 'center'),
  sub('OSC 1', 270, 17),
  { kind: 'switch', control: 'osc1_octave', x: 286, y: 44, style: 'rotary', scale: 1.25 },
  knob('osc1_wave', 318, 42, BIG),
  led('kb_reset', 348, 34),
  led('duo_mode', 348, 54),
  sub('OSC 2', 270, 79),
  { kind: 'switch', control: 'osc2_octave', x: 286, y: 106, style: 'rotary', scale: 1.25 },
  knob('osc2_wave', 318, 104, BIG),
  knob('osc2_frequency', 348, 104, SMALL),
  knob('beat_freq', 289, 148, SMALL),
  led('hard_sync', 318, 150),
  led('osc2_kb_ctrl', 348, 150),

  // ===== Mixer =================================================================
  title('MIXER', 382.5, 8, 'center'),
  ...['mix_osc1', 'mix_sub', 'mix_osc2', 'mix_noise', 'mix_feedback'].map((c, i) => knob(c, 382.5, 28 + i * 30, 12)),

  // ===== Filter ================================================================
  title('FILTER', 447.5, 8, 'center'),
  knob('cutoff', 447.5, 42, 28),
  knob('resonance', 421, 88, MID),
  knob('multidrive', 474, 88, MID),
  knob('filter_eg_amt', 421, 134, MID),
  knob('filter_kb_amt', 474, 134, MID),
  sub('SLOPE', 447.5, 78, 'center'),
  ...['-6dB', '-12dB', '-18dB', '-24dB'].map((txt, i): PanelElement => ({
    kind: 'button', control: 'filter_slope', setValue: i, x: 444, y: 87 + i * 12,
    shape: 'rect', w: 7, h: 5, color: '#1c1c1c', ledColor: '#ff3b30', label: 'right', labelText: txt,
  })),

  // ===== Envelopes =============================================================
  title('ENVELOPES', 557.5, 8, 'center'),
  ...envRow('feg', 'FILTER EG', 16),
  led('knob_shift', 512, 87, { label: 'right', ledColor: '#ffb020' }),
  ...envRow('aeg', 'AMP EG', 98),

  // ===== Wheels and keyboard ===================================================
  {
    kind: 'custom', x: 12, y: KEYS_Y + 6, w: 78, h: H - KEYS_Y - 12,
    render: ({ values, setValue }) => (
      <div style={{ display: 'flex', height: '100%', gap: '14%', padding: '0 6%' }}>
        <Wheel label="PITCH" value={Number(values.pitch_bend ?? 0)} min={-100} max={100} spring onChange={v => setValue('pitch_bend', v)} />
        <Wheel label="MOD" value={Number(values.mod_wheel ?? 0)} min={0} max={100} onChange={v => setValue('mod_wheel', v)} />
      </div>
    ),
  },
  { kind: 'section', x: 98, y: KEYS_Y - 2, w: W - 102, h: H - KEYS_Y, background: '#050505', radius: 1 },
  { kind: 'keyboard', x: 100, y: KEYS_Y, w: W - 106, h: H - KEYS_Y - 4, lowNote: 36, numKeys: 37, style: 'piano' },
];

export const SUB37_LAYOUT: PanelLayout = {
  width: W,
  height: H,
  pxPerMm: 2,
  theme: {
    background: 'linear-gradient(180deg, #161616 0%, #0e0e0e 58%, #080808 61%, #0b0b0b 100%)',
    text: '#f2f2f2',
    muted: '#cfcfcf',
    cheeks: { width: 16, background: 'linear-gradient(90deg, #4a2f1c 0%, #7a5232 35%, #8a5f3b 55%, #5a3a22 100%)' },
    frame: { padding: 0, background: '#0a0a0a', radius: 2.5 },
  },
  elements,
};
