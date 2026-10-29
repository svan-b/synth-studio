// ============================================================================
// Sub 37 panel layout (mm from the top-left of the black panel, cheeks excluded)
//
// One row of ten sections, as on the hardware: PROGRAMMING · ARPEGGIATOR · GLIDE ·
// MOD 1 · MOD 2 · OSCILLATORS · MIXER · FILTER · ENVELOPE GENERATORS · OUTPUT, three
// knob rows, and the strip with KB OCTAVE, BANK and PRESET 1-16 along the bottom.
// Positions come from the Quickstart legend decode in REFERENCE.md (x' = 50 +
// (x - 42.4) * 0.9575: PROGRAMMING is widened so the LCD stays readable on an iPad).
// Below the panel: the left side-panel jacks (on the hardware they are on the left
// cheek), the PITCH and MOD wheels and the 37 keys (MIDI 36-72).
// Drawn at 2 px/mm; labels are separate elements so they stay legible when the
// panel is scaled to an iPad.
// ============================================================================

import type { KnobElement, PanelContext, PanelElement, PanelLayout } from '@/types/panel';
import { ARP_RANGES } from './model';
import {
  BankButton, ControllersButton, CycleButton, DestButton, KbOctave, Lcd, PresetRow, ProgButtons, RangeButton,
  ShiftButton, SyncTapButton, Wheel,
} from './panel';

const W = 660;
const H = 240;
const KEYS_Y = 166;
const BOX_TOP = 3;
const BOX_BOTTOM = 142;
const KN = 15;           // standard knob, mm
const KN_MIX = 14;
const KN_BIG = 23;       // CUTOFF
const LABEL = '#f2f2f2';
const SHIFT_LABEL = '#8fb3ff';
const LED_RED = '#ff2d2d';

const v = (ctx: PanelContext, id: string, d = 0) => Math.round(Number(ctx.values[id] ?? d));

// ---- element helpers ----------------------------------------------------------
const knob = (control: KnobElement['control'], x: number, y: number, diameter = KN, extra: Partial<KnobElement> = {}): PanelElement => ({
  kind: 'knob', control, x, y, diameter, variant: 'moog-large', label: 'none', value: 'hover', ...extra,
});
const label = (text: string, x: number, y: number, size = 8.5, extra: Partial<Extract<PanelElement, { kind: 'label' }>> = {}): PanelElement => ({
  kind: 'label', text, x, y, size, weight: 800, letterSpacing: 0.4, color: LABEL, ...extra,
});
const small = (text: string, x: number, y: number, extra: Partial<Extract<PanelElement, { kind: 'label' }>> = {}): PanelElement =>
  label(text, x, y, 7, { weight: 700, color: '#cfcfcf', ...extra });
const btn = (control: string, x: number, y: number): PanelElement => ({
  kind: 'button', control, x, y, shape: 'rect', w: 8.5, h: 5, color: '#1c1c1c', ledColor: LED_RED, label: 'none',
});
const led = (x: number, y: number, on: (ctx: PanelContext) => boolean | number): PanelElement => ({
  kind: 'led', x, y, size: 2.2, color: LED_RED, on,
});
const custom = (x: number, y: number, w: number, h: number, render: Extract<PanelElement, { kind: 'custom' }>['render']): PanelElement => ({
  kind: 'custom', x, y, w, h, render,
});
/** A button cap drawn by a custom element, centred at x / y like the built-in buttons */
const capAt = (x: number, y: number, render: Extract<PanelElement, { kind: 'custom' }>['render'], w = 10, h = 6): PanelElement =>
  custom(x - w / 2, y - h / 2, w, h, render);
const box = (x0: number, x1: number, title: string): PanelElement[] => [
  { kind: 'section', x: x0, y: BOX_TOP, w: x1 - x0, h: BOX_BOTTOM - BOX_TOP, border: '1px solid #3a3a3a', background: '#121212', radius: 1.2 },
  label(title, (x0 + x1) / 2, BOX_TOP + 5, 9, { letterSpacing: 1.4 }),
];
/** Position labels around a stepped knob, from -135 to +135 degrees */
const arc = (cx: number, cy: number, r: number, names: string[]): PanelElement[] => names.map((n, i) => {
  const a = ((-135 + (270 * i) / Math.max(1, names.length - 1)) * Math.PI) / 180;
  return small(n, cx + r * Math.sin(a), cy - r * Math.cos(a), { size: 6.5 });
});
/** A knob with its printed name above */
const named = (name: string, control: KnobElement['control'], x: number, y: number, d = KN, extra: Partial<KnobElement> = {}): PanelElement[] => [
  label(name, x, y - d / 2 - 3.2),
  knob(control, x, y, d, extra),
];
/** A built-in button with its printed name above */
const namedBtn = (name: string, control: string, x: number, y: number, under?: string): PanelElement[] => [
  small(name, x, y - 5),
  btn(control, x, y),
  ...(under ? [small(under, x, y + 5, { color: '#9a9a9a' })] : []),
];

// ---- MOD 1 / MOD 2 --------------------------------------------------------------
const DEST_LEDS = ['LFO RATE', 'VCA LEVEL', 'OSC 1 WAVE', 'OSC 2 WAVE', 'NOISE LEVEL', 'EG TIME/PGM'];
/** MOD DEST position -> lit LEDs (OSC 1+2 WAVE lights both wave LEDs) */
const destLit = (dest: number, led: number) =>
  dest === 3 ? led === 2 || led === 3 : dest <= 2 ? led === dest : led === dest - 1;

function modBus(n: 1 | 2, x0: number, x1: number): PanelElement[] {
  const dx = n === 1 ? 0 : 76.35;
  const xl = 155.3 + dx, xr = 191.5 + dx, xm = 173.2 + dx;
  const other = n === 1 ? 2 : 1;
  return [
    ...box(x0, x1, `MOD ${n}`),
    ...named('RATE', ctx => (ctx.values[`mod${n}_sync`] ? `mod${n}_div` : `mod${n}_rate`), xl, 27.5),
    ...named('SOURCE', `mod${n}_source`, xr, 27.5),
    ...arc(xr, 27.5, 12.2, ['TRI', 'SQR', 'SAW', 'RAMP', 'S&H', 'F.EG/PGM']),
    ...namedBtn('HI RANGE', `mod${n}_hi_range`, xl, 52),
    ...namedBtn('SYNC', `mod${n}_sync`, xm, 52),
    ...namedBtn('KB RESET', `mod${n}_kb_reset`, xr, 52),
    ...named('PITCH AMT', `mod${n}_pitch_amt`, xl, 79.3),
    ...named('FILTER AMT', `mod${n}_filter_amt`, xr, 79.3),
    // OSC (PITCH AMT destination): LEDs 1 and 2
    small('1', xl - 4, 94.5), small('2', xl + 4, 94.5),
    led(xl - 4, 98, ctx => v(ctx, `mod${n}_pitch_dest`) !== 2),
    led(xl + 4, 98, ctx => v(ctx, `mod${n}_pitch_dest`) !== 1),
    capAt(xl, 104, ctx => <CycleButton ctx={ctx} control={`mod${n}_pitch_dest`} />),
    small('OSC', xl, 110),
    capAt(xr, 104, ctx => <ControllersButton ctx={ctx} bus={n} />),
    small('CONTROLLERS', xr, 110),
    // MOD DEST: six LEDs (the other LFO's RATE first)
    ...DEST_LEDS.flatMap((name, i): PanelElement[] => [
      led(x0 + 4, 117 + i * 4.6, ctx => destLit(v(ctx, `mod${n}_dest`, 1), i)),
      small(i === 0 ? `LFO ${other} RATE` : name, x0 + 6.5, 117 + i * 4.6, { size: 6, align: 'left' }),
    ]),
    capAt(xm - 1, 131, ctx => <DestButton ctx={ctx} bus={n} />),
    small('MOD DEST', xm - 1, 125),
    ...named('MOD AMT', `mod${n}_mod_amt`, xr + 1, 132.2),
  ];
}

// ---- envelopes ------------------------------------------------------------------
const EG_X = [509.2, 540.0, 570.7, 601.5];
const EG_BTN_X = [497.2, 526.8, 556.4, 586.0, 615.5];
const STAGES = [['attack', 'ATTACK', 'delay', 'DELAY'], ['decay', 'DECAY', 'hold', 'HOLD'], ['sustain', 'SUSTAIN', 'vel_amt', 'VEL AMT'], ['release', 'RELEASE', 'kb_amt', 'KB TRACK']] as const;

function envRow(p: 'feg' | 'aeg', y: number, btnY: number): PanelElement[] {
  return [
    ...STAGES.flatMap(([stage, name, shifted, shiftedName], i): PanelElement[] => [
      label(name, EG_X[i], y - KN / 2 - 3.2),
      // KNOB SHIFT turns ATTACK / DECAY / SUSTAIN / RELEASE into DELAY / HOLD / VEL AMT / KB TRACK (p.30)
      knob(ctx => (ctx.values.knob_shift ? `${p}_${shifted}` : `${p}_${stage}`), EG_X[i], y),
      small(shiftedName, EG_X[i], y + KN / 2 + 3, { color: SHIFT_LABEL }),
    ]),
    ...(['multi_trig', 'reset', 'sync', 'loop', 'latch'] as const).flatMap((b, i): PanelElement[] =>
      namedBtn(['MULTI TRIG', 'RESET', 'SYNC', 'LOOP', 'LATCH ON'][i], `${p}_${b}`, EG_BTN_X[i], btnY)),
  ];
}

const elements: PanelElement[] = [
  // ===== PROGRAMMING (pp.12-14) ===================================================
  ...box(0.5, 49.5, 'PROGRAMMING'),
  custom(2.5, 11, 45, 25, ctx => <Lcd ctx={ctx} />),
  custom(2, 39, 46, 50, ctx => <ProgButtons ctx={ctx} />),
  ...named('FINE TUNE', 'fine_tune', 25, 126),

  // ===== ARPEGGIATOR (pp.15-17) ===================================================
  ...box(50.5, 100.9, 'ARPEGGIATOR'),
  ...named('RATE', ctx => (ctx.values.arp_sync ? 'arp_div' : 'arp_rate'), 68.0, 27.5),
  small('SYNC', 91.3, 22.5),
  capAt(91.3, 27.5, ctx => <SyncTapButton ctx={ctx} />),
  small('[TAP]', 91.3, 32.5, { color: '#9a9a9a' }),
  ...(['-2', '-1', '0', '+1', '+2'] as const).flatMap((t, i): PanelElement[] => {
    const x = 62 + i * 6.5;
    const lit = (r: number) => (t === '0' ? r === 0 || r === 3 || r === 6 : t === '-2' ? r === 0 || r === 1 : t === '+2' ? r === 5 || r === 6 : t === '-1' ? r === 2 : r === 4);
    return [small(t, x, 41), led(x, 45, ctx => lit(v(ctx, 'arp_oct_range', 3)))];
  }),
  capAt(66.9, 53, ctx => <RangeButton ctx={ctx} dir={-1} />),
  small('RANGE', 75.6, 53),
  capAt(84.1, 53, ctx => <RangeButton ctx={ctx} dir={1} />),
  ...namedBtn('BACK/FORTH', 'arp_back_fwd', 66.9, 70),
  ...namedBtn('INVERT', 'arp_invert', 84.1, 70),
  label('PATTERN', 75.6, 88.5),
  knob('arp_pattern', 75.6, 106),
  ...arc(75.6, 106, 12.2, ['UP', 'DWN', 'ORDR', 'RND', 'SEQ', 'REC']),
  ...namedBtn('ON', 'arp_on', 63.0, 132, '[REST]'),
  ...namedBtn('LATCH', 'arp_latch', 87.9, 132, '[TIE]'),

  // ===== GLIDE (p.21) ===============================================================
  ...box(101.9, 134.3, 'GLIDE'),
  ...named('TIME', 'glide_time', 118.1, 27.5),
  small('1', 114, 41.5), small('2', 122.2, 41.5),
  led(114, 45, ctx => v(ctx, 'glide_osc') !== 2),
  led(122.2, 45, ctx => v(ctx, 'glide_osc') !== 1),
  capAt(118.1, 51.5, ctx => <CycleButton ctx={ctx} control="glide_osc" />),
  small('OSC', 118.1, 57.5),
  ...(['LCR', 'LCT', 'EXP'] as const).flatMap((t, i): PanelElement[] => [
    small(t, 110.6 + i * 7.5, 65), led(110.6 + i * 7.5, 68.5, ctx => v(ctx, 'glide_type') === i),
  ]),
  capAt(118.1, 75, ctx => <CycleButton ctx={ctx} control="glide_type" />),
  small('TYPE', 118.1, 81),
  ...namedBtn('GATED', 'glide_gated', 118.1, 94),
  ...namedBtn('LEGATO', 'glide_legato', 118.1, 111),
  ...namedBtn('ON', 'glide_on', 118.1, 128),

  // ===== MOD 1 / MOD 2 (pp.22-24, 50-52) ===============================================
  ...modBus(1, 135.2, 210.6),
  ...modBus(2, 211.5, 287.2),

  // ===== OSCILLATORS (pp.25-26) ===========================================================
  ...box(288.1, 360.5, 'OSCILLATORS'),
  small('1', 293, 13, { size: 8, color: LABEL }),
  ...named('OCTAVE', 'osc1_octave', 305.9, 27.5),
  ...arc(305.9, 27.5, 11.5, ["16'", "8'", "4'", "2'"]),
  ...named('WAVE', 'osc1_wave', 342.5, 27.5),
  ...arc(342.5, 27.5, 11.5, ['TRI', 'SAW', 'SQR', 'PULSE']),
  ...namedBtn('HARD SYNC', 'hard_sync', 305.9, 50),
  ...namedBtn('KB RESET', 'kb_reset', 335.2, 50),
  small('2', 293, 64, { size: 8, color: LABEL }),
  ...named('OCTAVE', 'osc2_octave', 305.9, 79.3),
  ...arc(305.9, 79.3, 11.5, ["16'", "8'", "4'", "2'"]),
  ...named('WAVE', 'osc2_wave', 342.5, 79.3),
  ...arc(342.5, 79.3, 11.5, ['TRI', 'SAW', 'SQR', 'PULSE']),
  small('LO', 296, 95), small('HI', 303, 95),
  led(296, 98.5, ctx => v(ctx, 'kb_ctrl', 2) === 1),
  led(303, 98.5, ctx => v(ctx, 'kb_ctrl', 2) === 2),
  capAt(313, 103, ctx => <CycleButton ctx={ctx} control="kb_ctrl" />),
  small('KB CTRL', 304.5, 108.5),
  ...namedBtn('DUO MODE', 'duo_mode', 340, 103),
  ...named('FREQUENCY', 'osc2_frequency', 305.9, 132.2),
  ...named('BEAT FREQ', 'beat_freq', 342.5, 132.2),

  // ===== MIXER (p.27): five levels zig-zagged against their on buttons =====================
  ...box(361.5, 420.9, 'MIXER'),
  ...named('OSC 1', 'mix_osc1', 379.8, 27.6, KN_MIX), ...namedBtn('ON', 'mix_osc1_on', 403.9, 27.6),
  ...named('SUB OSC', 'mix_sub', 403.9, 52.8, KN_MIX), ...namedBtn('ON', 'mix_sub_on', 379.8, 52.8),
  ...named('OSC 2', 'mix_osc2', 379.8, 79.5, KN_MIX), ...namedBtn('ON', 'mix_osc2_on', 403.9, 79.5),
  ...named('NOISE', 'mix_noise', 403.9, 105.1, KN_MIX), ...namedBtn('ON', 'mix_noise_on', 379.8, 105.1),
  ...named('FDBK/EXT IN', 'mix_feedback', 379.8, 130.9, KN_MIX), ...namedBtn('ON', 'mix_fb_on', 403.9, 130.9),

  // ===== FILTER (pp.28-29) =================================================================
  ...box(421.9, 485.9, 'FILTER'),
  ...named('CUTOFF', 'cutoff', 453.8, 30, KN_BIG),
  ...named('RESONANCE', 'resonance', 437.3, 79.3),
  ...named('MULTIDRIVE', 'multidrive', 470.4, 79.3),
  ...(['6', '12', '18', '24'] as const).flatMap((t, i): PanelElement[] => [
    small(t, 444.8 + i * 6, 96.5), led(444.8 + i * 6, 100, ctx => v(ctx, 'filter_slope', 3) === i),
  ]),
  capAt(453.8, 106, ctx => <CycleButton ctx={ctx} control="filter_slope" />),
  small('SLOPE', 453.8, 112),
  ...named('EG AMT', 'filter_eg_amt', 437.3, 132.2),
  ...named('KB TRACK', 'filter_kb_amt', 470.4, 132.2),

  // ===== ENVELOPE GENERATORS (pp.29-33) ======================================================
  ...box(486.8, 622.5, 'ENVELOPE GENERATORS'),
  small('FILTER', 492, 13, { align: 'left', size: 7.5, color: LABEL }),
  ...envRow('feg', 27.4, 51),
  label('KNOB SHIFT', 509.2, 63.5, 7.5),
  capAt(509.2, 69, ctx => <ShiftButton ctx={ctx} />),
  small('AMPLIFIER', 492, 90.5, { align: 'left', size: 7.5, color: LABEL }),
  ...envRow('aeg', 105.1, 128.5),
  label('SUB 37', 580, 69, 22, { weight: 900, letterSpacing: 1 }),
  small('PARAPHONIC ANALOG SYNTHESIZER', 580, 79, { size: 6, letterSpacing: 1 }),

  // ===== OUTPUT (p.34) ==================================================================
  ...box(623, 659.5, 'OUTPUT'),
  ...named('VOLUME', 'master_volume', 641.4, 27.4),
  ...namedBtn('MUTE', 'output_mute', 641.4, 52),
  ...named('HEADPHONES', 'phones_volume', 641.4, 79.3),
  { kind: 'jack', jack: 'out_phones', x: 641.4, y: 104, label: 'below' },

  // ===== bottom strip: KB OCTAVE, BANK, PRESET 1-16 (pp.12, 14) ============================
  small('KB OCTAVE', 16, 145.5),
  custom(4, 148, 26, 7, ctx => <KbOctave ctx={ctx} />),
  small('BANK', 40.5, 145.5),
  capAt(40.5, 151.5, ctx => <BankButton ctx={ctx} />, 12, 6),
  custom(100, 145.5, 552, 15.5, ctx => <PresetRow ctx={ctx} />),

  // ===== left side panel (jacks), wheels, keyboard ===========================================
  { kind: 'section', x: 1.5, y: KEYS_Y, w: 39, h: H - KEYS_Y - 3, border: '1px solid #2e2e2e', background: '#0d0d0d', radius: 1.2 },
  small('LEFT SIDE PANEL', 21, KEYS_Y + 4, { size: 6, letterSpacing: 1 }),
  { kind: 'jack', jack: 'in_ext', x: 11, y: 183 },
  { kind: 'jack', jack: 'in_pitch', x: 31, y: 183 },
  { kind: 'jack', jack: 'in_filter', x: 11, y: 204 },
  { kind: 'jack', jack: 'in_volume', x: 31, y: 204 },
  { kind: 'jack', jack: 'in_gate', x: 11, y: 225 },
  { kind: 'jack', jack: 'out_audio', x: 31, y: 225 },
  custom(44, KEYS_Y + 4, 42, H - KEYS_Y - 10, ({ values, setValue }) => (
    <div style={{ display: 'flex', height: '100%', gap: '14%', padding: '0 6%' }}>
      <Wheel label="PITCH" control="pitch_bend" value={Number(values.pitch_bend ?? 0)} min={-100} max={100} spring onChange={x => setValue('pitch_bend', x)} />
      <Wheel label="MOD" control="mod_wheel" value={Number(values.mod_wheel ?? 0)} min={0} max={100} onChange={x => setValue('mod_wheel', x)} />
    </div>
  )),
  { kind: 'section', x: 89, y: KEYS_Y - 1, w: W - 90, h: H - KEYS_Y - 1, background: '#050505', radius: 1 },
  { kind: 'keyboard', x: 90, y: KEYS_Y, w: W - 92, h: H - KEYS_Y - 3, lowNote: 36, numKeys: 37, style: 'piano' },
];

/** RANGE states for documentation / lessons */
export const RANGE_STATES = ARP_RANGES;

export const SUB37_LAYOUT: PanelLayout = {
  width: W,
  height: H,
  pxPerMm: 2,
  theme: {
    background: 'linear-gradient(180deg, #151515 0%, #0e0e0e 62%, #080808 66%, #0b0b0b 100%)',
    text: '#f2f2f2',
    muted: '#cfcfcf',
    cheeks: { width: 16, background: 'linear-gradient(90deg, #4a2f1c 0%, #7a5232 35%, #8a5f3b 55%, #5a3a22 100%)' },
    frame: { padding: 0, background: '#0a0a0a', radius: 2.5 },
    jack: { ring: '#6a6a6a', outputLabelBg: '#e8e8e8', outputLabelText: '#111' },
  },
  elements,
};
