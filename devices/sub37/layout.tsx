// ============================================================================
// Sub 37 panel layout (mm from the top-left of the black panel, cheeks excluded)
//
// One row of ten sections, as on the hardware: PROGRAMMING · ARPEGGIATOR · GLIDE ·
// MOD 1 · MOD 2 · OSCILLATORS · MIXER · FILTER · ENVELOPE GENERATORS · OUTPUT, three
// knob rows, and the strip with KB OCTAVE, BANK and PRESET 1-16 along the bottom.
// Positions come from the Quickstart legend decode in REFERENCE.md (x' = 50 +
// (x - 42.4) * 0.9575: PROGRAMMING is widened so the LCD stays readable on an iPad).
// The PROGRAMMING and FILTER sections follow the manual's drawings (pp.13, 28):
// three buttons under the LCD, then two columns, FINE TUNE at the bottom; the
// CUTOFF frequency legend around the large knob and SLOPE in its own box.
// Below the panel: the left side-panel jacks (on the hardware they are on the left
// cheek), the PITCH and MOD wheels and the 37 keys (MIDI 36-72).
//
// Drawn at 2 px/mm. The panel raises small legends to a legible size for the zoom
// (9-10 CSS px), so every legend has room to grow: position legends of stepped
// knobs sit on the knob's own arc, with the knob's name above them.
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
/** The three knob rows (QS legend: 27.5, 79.3, 132.2; the top row sits 4 mm lower, for the legends above it) */
const ROW1 = 31.5;
const ROW2 = 79.3;
const ROW3 = 132.2;
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
/** Button names, LED and position legends: condensed, so they keep their words at the legible size */
const small = (text: string, x: number, y: number, extra: Partial<Extract<PanelElement, { kind: 'label' }>> = {}): PanelElement =>
  label(text, x, y, 7, { weight: 700, color: '#d6d6d6', font: 'condensed', letterSpacing: 0.2, ...extra });
const btn = (control: string, x: number, y: number): PanelElement => ({
  kind: 'button', control, x, y, shape: 'rect', w: 8.5, h: 5, color: '#1c1c1c', ledColor: LED_RED, label: 'none',
});
const led = (x: number, y: number, on: (ctx: PanelContext) => boolean | number): PanelElement => ({
  kind: 'led', x, y, size: 2.2, color: LED_RED, on,
});
const custom = (x: number, y: number, w: number, h: number, render: Extract<PanelElement, { kind: 'custom' }>['render']): PanelElement => ({
  kind: 'custom', x, y, w, h, render,
});
/**
 * A button cap drawn by a custom element, centred at x / y like the built-in buttons (a flex box,
 * so the cap does not sit on a text baseline below its place)
 */
const capAt = (x: number, y: number, render: Extract<PanelElement, { kind: 'custom' }>['render'], w = 10, h = 6): PanelElement =>
  custom(x - w / 2, y - h / 2, w, h, ctx => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', pointerEvents: 'none' }}>{render(ctx)}</div>
  ));
const box = (x0: number, x1: number, title: string): PanelElement[] => [
  { kind: 'section', x: x0, y: BOX_TOP, w: x1 - x0, h: BOX_BOTTOM - BOX_TOP, border: '1px solid #3a3a3a', background: '#121212', radius: 1.2 },
  label(title, (x0 + x1) / 2, BOX_TOP + 6, 9, { letterSpacing: 1.4 }),
];
/**
 * A legend on a knob's arc at `deg` (0 = top). Legends left of the knob end at their point and
 * those to the right start there, so they grow away from the knob, never into it.
 */
const arcLabel = (text: string, cx: number, cy: number, r: number, deg: number, size = 6.5, fixed = false): PanelElement => {
  const a = (deg * Math.PI) / 180;
  const x = cx + r * Math.sin(a), y = cy - r * Math.cos(a);
  if (deg < -15) return small(text, x + 1.6, y, { size, align: 'right', fixed });
  if (deg > 15) return small(text, x - 1.6, y, { size, align: 'left', fixed });
  return small(text, x, y, { size, fixed });
};
/**
 * Position legends around a stepped knob, at the pointer's angles (-135 to +135 degrees). Short
 * legends (`fixedSize`) are drawn at one size, so no position reads larger than its neighbours.
 */
const arc = (cx: number, cy: number, r: number, names: string[], fixedSize?: number): PanelElement[] => names.map((n, i) =>
  arcLabel(n, cx, cy, r, -135 + (270 * i) / Math.max(1, names.length - 1), fixedSize ?? 6.5, fixedSize !== undefined));
/** A knob with its printed name above */
const named = (name: string, control: KnobElement['control'], x: number, y: number, d = KN, extra: Partial<KnobElement> = {}): PanelElement[] => [
  label(name, x, y - d / 2 - 3.2),
  knob(control, x, y, d, extra),
];
/** A stepped knob: its positions on the arc, its name above them */
const stepped = (name: string, control: string, x: number, y: number, positions: string[], r: number, nameDy: number, fixedSize?: number): PanelElement[] => [
  label(name, x, y - nameDy),
  knob(control, x, y),
  ...arc(x, y, r, positions, fixedSize),
];
/** A built-in button with its printed name above (`size`: the name's authored size) */
const namedBtn = (name: string, control: string, x: number, y: number, under?: string, size = 7): PanelElement[] => [
  small(name, x, y - 5.5, { size }),
  btn(control, x, y),
  ...(under ? [small(under, x, y + 5.5, { color: '#a8a8a8' })] : []),
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
    ...named('RATE', ctx => (ctx.values[`mod${n}_sync`] ? `mod${n}_div` : `mod${n}_rate`), xl, ROW1),
    ...stepped('SOURCE', `mod${n}_source`, xr, ROW1, ['TRI', 'SQR', 'SAW', 'RAMP', 'S&H', 'F.EG/PGM'], 12.2, 17.6),
    ...namedBtn('HI RANGE', `mod${n}_hi_range`, xl, 53.5),
    ...namedBtn('SYNC', `mod${n}_sync`, xm, 53.5),
    ...namedBtn('KB RESET', `mod${n}_kb_reset`, xr, 53.5),
    ...named('PITCH AMT', `mod${n}_pitch_amt`, xl, ROW2),
    ...named('FILTER AMT', `mod${n}_filter_amt`, xr, ROW2),
    // OSC (PITCH AMT destination): LEDs 1 and 2 over the button
    small('1', xl - 4, 90), small('2', xl + 4, 90),
    led(xl - 4, 93.5, ctx => v(ctx, `mod${n}_pitch_dest`) !== 2),
    led(xl + 4, 93.5, ctx => v(ctx, `mod${n}_pitch_dest`) !== 1),
    capAt(xl, 99, ctx => <CycleButton ctx={ctx} control={`mod${n}_pitch_dest`} hit={[24, 24, 7, 17]} />),
    small('OSC', xl, 105.5),
    capAt(xr, 99, ctx => <ControllersButton ctx={ctx} bus={n} hit={[24, 24, 7, 17]} />),
    small('CONTROLLERS', xr, 105.5),
    // MOD DEST: six LEDs (the other LFO's RATE first) beside the DEST button
    ...DEST_LEDS.flatMap((name, i): PanelElement[] => [
      led(x0 + 3.5, 111.5 + i * 5.5, ctx => destLit(v(ctx, `mod${n}_dest`, 1), i)),
      small(i === 0 ? `LFO ${other} RATE` : name, x0 + 6, 111.5 + i * 5.5, { size: 8, align: 'left' }),
    ]),
    // DEST and MOD AMT 3 mm further apart than the Quickstart legend, so the button's touch
    // area never reaches into the knob's
    small('DEST', xm + 3, 129.5),
    capAt(xm + 3, 135.5, ctx => <DestButton ctx={ctx} bus={n} hit={[18, 3, 14, 8]} />),
    ...named('MOD AMT', `mod${n}_mod_amt`, xr + 4, ROW3),
  ];
}

// ---- envelopes ------------------------------------------------------------------
const EG_X = [509.2, 540.0, 570.7, 601.5];
const EG_BTN_X = [499.5, 528.0, 556.5, 585.0, 613.5];
const STAGES = [['attack', 'ATTACK', 'delay', 'DELAY'], ['decay', 'DECAY', 'hold', 'HOLD'], ['sustain', 'SUSTAIN', 'vel_amt', 'VEL AMT'], ['release', 'RELEASE', 'kb_amt', 'KB TRACK']] as const;

function envRow(p: 'feg' | 'aeg', y: number, btnY: number): PanelElement[] {
  return [
    ...STAGES.flatMap(([stage, name, shifted, shiftedName], i): PanelElement[] => [
      label(name, EG_X[i], y - KN / 2 - 3.2),
      // KNOB SHIFT turns ATTACK / DECAY / SUSTAIN / RELEASE into DELAY / HOLD / VEL AMT / KB TRACK (p.30)
      knob(ctx => (ctx.values.knob_shift ? `${p}_${shifted}` : `${p}_${stage}`), EG_X[i], y),
      small(shiftedName, EG_X[i], y + KN / 2 + 3.2, { color: SHIFT_LABEL, size: 9 }),
    ]),
    ...(['multi_trig', 'reset', 'sync', 'loop', 'latch'] as const).flatMap((b, i): PanelElement[] =>
      namedBtn(['MULTI TRIG', 'RESET', 'SYNC', 'LOOP', 'LATCH ON'][i], `${p}_${b}`, EG_BTN_X[i], btnY, undefined, 9)),
  ];
}

// ---- FILTER: the CUTOFF legend (p.28 drawing) -----------------------------------------
const CUTOFF_LEGEND: [string, number][] = [['20Hz', -135], ['80Hz', -90], ['320Hz', -43], ['500Hz', 0], ['1.2KHz', 43], ['5KHz', 90], ['20KHz', 135]];

const elements: PanelElement[] = [
  // ===== PROGRAMMING (pp.12-14): LCD, ▼ ▲ CURSOR, two button columns, FINE TUNE ===========
  ...box(0.5, 49.5, 'PROGRAMMING'),
  custom(2.5, 11.5, 45, 31.5, ctx => <Lcd ctx={ctx} />),
  custom(0.5, 45, 49, 59, ctx => <ProgButtons ctx={ctx} />),
  ...named('FINE TUNE', 'fine_tune', 25, 126),

  // ===== ARPEGGIATOR (pp.15-17) ===================================================
  ...box(50.5, 100.9, 'ARPEGGIATOR'),
  ...named('RATE', ctx => (ctx.values.arp_sync ? 'arp_div' : 'arp_rate'), 66, ROW1),
  small('SYNC', 90, 25.5),
  capAt(90, ROW1, ctx => <SyncTapButton ctx={ctx} hit={[11, 12, 18, 18]} />),
  small('[TAP]', 90, 37, { color: '#a8a8a8', size: 8 }),
  ...(['-2', '-1', '0', '+1', '+2'] as const).flatMap((t, i): PanelElement[] => {
    const x = 62 + i * 6.5;
    const lit = (r: number) => (t === '0' ? r === 0 || r === 3 || r === 6 : t === '-2' ? r === 0 || r === 1 : t === '+2' ? r === 5 || r === 6 : t === '-1' ? r === 2 : r === 4);
    return [small(t, x, 43, { size: 9, fixed: true }), led(x, 46.5, ctx => lit(v(ctx, 'arp_oct_range', 3)))];
  }),
  capAt(64, 54, ctx => <RangeButton ctx={ctx} dir={-1} hit={[17, 14, 7, 5]} />),
  small('RANGE', 75.6, 54),
  capAt(87, 54, ctx => <RangeButton ctx={ctx} dir={1} hit={[14, 17, 7, 5]} />),
  ...namedBtn('BACK/FORTH', 'arp_back_fwd', 63, 71.5),
  ...namedBtn('INVERT', 'arp_invert', 88.5, 71.5),
  ...stepped('PATTERN', 'arp_pattern', 75.6, 106, ['UP', 'DWN', 'ORDR', 'RND', 'SEQ', 'REC'], 12.2, 19.1),
  ...namedBtn('ON', 'arp_on', 63.0, 130.5, '[REST]'),
  ...namedBtn('LATCH', 'arp_latch', 88.0, 130.5, '[TIE]'),

  // ===== GLIDE (p.21) ===============================================================
  ...box(101.9, 134.3, 'GLIDE'),
  ...named('TIME', 'glide_time', 118.1, ROW1),
  small('1', 114, 43), small('2', 122.2, 43),
  led(114, 46.5, ctx => v(ctx, 'glide_osc') !== 2),
  led(122.2, 46.5, ctx => v(ctx, 'glide_osc') !== 1),
  capAt(118.1, 53, ctx => <CycleButton ctx={ctx} control="glide_osc" hit={[21, 21, 11, 17]} />),
  small('OSC', 118.1, 59),
  ...(['LCR', 'LCT', 'EXP'] as const).flatMap((t, i): PanelElement[] => [
    small(t, 108.1 + i * 10, 66.5, { size: 8 }), led(108.1 + i * 10, 70, ctx => v(ctx, 'glide_type') === i),
  ]),
  capAt(118.1, 77, ctx => <CycleButton ctx={ctx} control="glide_type" hit={[21, 21, 21, 17]} />),
  small('TYPE', 118.1, 83),
  ...namedBtn('GATED', 'glide_gated', 118.1, 97),
  ...namedBtn('LEGATO', 'glide_legato', 118.1, 114.5),
  ...namedBtn('ON', 'glide_on', 118.1, ROW3),

  // ===== MOD 1 / MOD 2 (pp.22-24, 50-52) ===============================================
  ...modBus(1, 135.2, 210.6),
  ...modBus(2, 211.5, 287.2),

  // ===== OSCILLATORS (pp.25-26) ===========================================================
  ...box(288.1, 360.5, 'OSCILLATORS'),
  small('1', 292.5, 13, { size: 8, color: LABEL, font: 'sans' }),
  ...stepped('OCTAVE', 'osc1_octave', 305.9, ROW1, ["16'", "8'", "4'", "2'"], 11.5, 14.4, 8.5),
  ...stepped('WAVE', 'osc1_wave', 342.5, ROW1, ['TRI', 'SAW', 'SQR', 'PULSE'], 11.5, 15.9),
  ...namedBtn('HARD SYNC', 'hard_sync', 305.9, 52),
  ...namedBtn('KB RESET', 'kb_reset', 335.2, 52),
  small('2', 292.5, 63, { size: 8, color: LABEL, font: 'sans' }),
  ...stepped('OCTAVE', 'osc2_octave', 305.9, ROW2, ["16'", "8'", "4'", "2'"], 11.5, 14.4, 8.5),
  ...stepped('WAVE', 'osc2_wave', 342.5, ROW2, ['TRI', 'SAW', 'SQR', 'PULSE'], 11.5, 15.9),
  small('LO', 297, 93), small('HI', 305, 93),
  led(297, 96.5, ctx => v(ctx, 'kb_ctrl', 2) === 1),
  led(305, 96.5, ctx => v(ctx, 'kb_ctrl', 2) === 2),
  capAt(301, 101.5, ctx => <CycleButton ctx={ctx} control="kb_ctrl" hit={[14, 24, 12, 20]} />),
  small('KB CTRL', 301, 109),
  ...namedBtn('DUO MODE', 'duo_mode', 340, 102.5),
  ...named('FREQUENCY', 'osc2_frequency', 305.9, ROW3),
  ...named('BEAT FREQ', 'beat_freq', 342.5, ROW3),

  // ===== MIXER (p.27): five levels zig-zagged against their on buttons =====================
  ...box(361.5, 420.9, 'MIXER'),
  ...named('OSC 1', 'mix_osc1', 379.8, 28.6, KN_MIX), ...namedBtn('ON', 'mix_osc1_on', 403.9, 28.6),
  ...named('SUB OSC', 'mix_sub', 403.9, 53.8, KN_MIX), ...namedBtn('ON', 'mix_sub_on', 379.8, 53.8),
  ...named('OSC 2', 'mix_osc2', 379.8, 79.5, KN_MIX), ...namedBtn('ON', 'mix_osc2_on', 403.9, 79.5),
  ...named('NOISE', 'mix_noise', 403.9, 105.1, KN_MIX), ...namedBtn('ON', 'mix_noise_on', 379.8, 105.1),
  ...named('FDBK/EXT IN', 'mix_feedback', 379.8, 130.9, KN_MIX), ...namedBtn('ON', 'mix_fb_on', 403.9, 130.9),

  // ===== FILTER (pp.28-29, drawing p.28) =====================================================
  ...box(421.9, 485.9, 'FILTER'),
  knob('cutoff', 453.8, 33, KN_BIG),
  ...CUTOFF_LEGEND.map(([t, deg]) => arcLabel(t, 453.8, 33, deg === 0 ? 16 : Math.abs(deg) < 90 ? 17 : Math.abs(deg) > 90 ? 15.5 : 16.5, deg)),
  label('CUTOFF', 453.8, 52.5),
  ...named('RESONANCE', 'resonance', 437.3, ROW2),
  ...named('MULTIDRIVE', 'multidrive', 470.4, ROW2),
  // SLOPE: LEDs 6 12 | button | 18 24 in their own box
  { kind: 'section', x: 431.5, y: 93, w: 44.6, h: 19, border: '1px solid #4a4a4a', background: 'transparent', radius: 1 },
  ...(['6', '12', '18', '24'] as const).flatMap((t, i): PanelElement[] => {
    const x = [437.5, 444.5, 463.1, 470.1][i];
    return [small(t, x, 96.8, { size: 9.5, fixed: true }), led(x, 100.5, ctx => v(ctx, 'filter_slope', 3) === i)];
  }),
  capAt(453.8, 100.5, ctx => <CycleButton ctx={ctx} control="filter_slope" hit={[33, 32, 9, 18]} />),
  small('SLOPE', 453.8, 107.8),
  ...named('EG AMT', 'filter_eg_amt', 437.3, ROW3),
  ...named('KB TRACK', 'filter_kb_amt', 470.4, ROW3),

  // ===== ENVELOPE GENERATORS (pp.29-33) ======================================================
  ...box(486.8, 622.5, 'ENVELOPE GENERATORS'),
  label('FILTER', 490.6, 32, 7.5, { rotate: -90, letterSpacing: 1.2, color: '#cfcfcf' }),
  ...envRow('feg', ROW1, 56),
  label('KNOB SHIFT', 509.2, 66),
  capAt(509.2, 72, ctx => <ShiftButton ctx={ctx} hit={[28, 28, 1, 30]} />),
  label('AMPLIFIER', 490.6, 109, 7.5, { rotate: -90, letterSpacing: 1.2, color: '#cfcfcf' }),
  ...envRow('aeg', 105.1, ROW3),
  label('SUB 37', 580, 69, 22, { weight: 900, letterSpacing: 1 }),
  small('PARAPHONIC ANALOG SYNTHESIZER', 580, 79, { size: 6.5, letterSpacing: 1, font: 'sans' }),

  // ===== OUTPUT (p.34) ==================================================================
  ...box(623, 659.5, 'OUTPUT'),
  ...named('VOLUME', 'master_volume', 641.4, ROW1),
  ...namedBtn('MUTE', 'output_mute', 641.4, 53.5),
  ...named('HEADPHONES', 'phones_volume', 641.4, ROW2),
  { kind: 'jack', jack: 'out_phones', x: 641.4, y: 104, label: 'below' },

  // ===== bottom strip: KB OCTAVE, BANK, PRESET 1-16 (pp.12, 14) ============================
  small('KB OCTAVE', 16.5, 145.5),
  custom(4, 148, 26, 7, ctx => <KbOctave ctx={ctx} />),
  small('BANK', 40.5, 145.5),
  capAt(40.5, 151.5, ctx => <BankButton ctx={ctx} hit={[8, 12, 14, 18]} />, 12, 6),
  custom(100, 145.5, 552, 15.5, ctx => <PresetRow ctx={ctx} />),

  // ===== left side panel (jacks), wheels, keyboard ===========================================
  { kind: 'section', x: 1.5, y: KEYS_Y, w: 39, h: H - KEYS_Y - 3, border: '1px solid #2e2e2e', background: '#0d0d0d', radius: 1.2 },
  small('LEFT SIDE PANEL', 21, KEYS_Y + 4, { size: 6, letterSpacing: 1 }),
  // The three CV inputs in one column; EXT IN sits just above AUDIO OUT (p.8). Each long legend
  // shares its row with a short one, so neither has to shrink much
  { kind: 'jack', jack: 'in_pitch', x: 11, y: 183 },
  { kind: 'jack', jack: 'in_gate', x: 31, y: 183 },
  { kind: 'jack', jack: 'in_filter', x: 11, y: 204 },
  { kind: 'jack', jack: 'in_ext', x: 31, y: 204 },
  { kind: 'jack', jack: 'in_volume', x: 11, y: 225 },
  { kind: 'jack', jack: 'out_audio', x: 31, y: 225 },
  // The PITCH wheel springs back, so lessons count "pushed all the way" as the events
  // pitch_wheel_up / pitch_wheel_down
  custom(44, KEYS_Y + 4, 42, H - KEYS_Y - 10, ({ values, setValue, sendEvent }) => (
    <div style={{ display: 'flex', height: '100%', gap: '14%', padding: '0 6%' }}>
      <Wheel label="PITCH" control="pitch_bend" value={Number(values.pitch_bend ?? 0)} min={-100} max={100} spring onChange={x => setValue('pitch_bend', x)} onEnd={end => sendEvent(`pitch_wheel_${end}`)} />
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
