// ============================================================================
// Xone:96 panel layout (top panel, 336 x 410 mm, User Guide p.35)
// Channel strips A, B, 1-4 left to right with the master / cue section on the
// right; the two Xone:VCF filter sections sit either side of the crossfader
// at the bottom (p.13). A deck strip above the mixer (twin only) holds the
// built-in sources, file loading, transport and the stand-in FX unit.
// All x/y in mm; controls are centred on x/y, boxes use top-left.
// ============================================================================

import type { ControlValue } from '@/types';
import type { PanelContext, PanelElement, PanelLayout } from '@/types/panel';
import { CHANNELS, type ChannelId, chName, isAux, CH_METER_DBU, MASTER_METER_DBU } from './spec';
import { SOURCE_NAMES } from './sources';

const K = 3;            // px per mm
const DECK_H = 44;      // twin-only deck strip above the faceplate
const MY = DECK_H;      // top of the mixer faceplate
const W = 336;
const H = DECK_H + 410;
const CX: Record<ChannelId, number> = { a: 25, b: 67, '1': 109, '2': 151, '3': 193, '4': 235 };
const MCX = 296;        // master column centre

// Xone-style cap colours
const CAP = {
  gain: '#e9e9e9',
  eq: '#8e9399',
  mid: '#6f757c',
  send: '#e8c547',
  freq: '#ff7a1a',
  res: '#a7adb3',
  crunch: '#e0463c',
  master: '#e0463c',
  booth: '#a7adb3',
  phones: '#f0a21a',
};

// ---------------------------------------------------------------------------
// Meter ladders
// ---------------------------------------------------------------------------

const REF = 0.1; // engine: 0.1 = 0 dBu
const dbu = (amp: number | undefined) => (amp && amp > 1e-6 ? 20 * Math.log10(amp / REF) : -99);

const CH_STEPS = CH_METER_DBU;
const CH_LABELS = ['-20', '-12', '-6', '-3', '0', '+3', '+6', '+10', 'PK!'];
const MS_STEPS = MASTER_METER_DBU;
const MS_LABELS = ['-35', '-25', '-20', '-15', '-10', '-6', '-3', '0', '+3', '+6', '+10'];

const ledColor = (db: number) => (db >= 10 ? '#ff3b30' : db >= 3 ? '#ffb020' : '#34d058');

function Ladder({ level, steps, heightPx, widthPx }: { level: number; steps: number[]; heightPx: number; widthPx: number }) {
  const n = steps.length;
  const seg = heightPx / n;
  return (
    <div style={{ position: 'relative', width: widthPx, height: heightPx }}>
      {steps.map((s, i) => {
        const on = level >= s;
        const c = ledColor(s);
        return (
          <div
            key={s}
            style={{
              position: 'absolute', left: 0, width: widthPx, top: (n - 1 - i) * seg + 1, height: seg - 2.5, borderRadius: 1.5,
              background: on ? c : '#1b1d1f',
              boxShadow: on ? `0 0 5px ${c}` : 'inset 0 1px 1px #000',
              opacity: on ? 1 : 0.9,
              border: `1px solid ${on ? c : '#2a2d30'}`,
            }}
          />
        );
      })}
    </div>
  );
}

function channelMeter(ch: ChannelId): PanelElement {
  const h = 72;
  return {
    kind: 'custom', x: CX[ch] + 8.5, y: 66, w: 12, h,
    render: ({ engine }) => {
      const m = (engine.meters ?? {}) as Record<string, number>;
      const lvl = dbu(m[ch]);
      return (
        <div style={{ display: 'flex', gap: 3, pointerEvents: 'none' }} aria-label={`Channel ${chName(ch)} meter`}>
          <Ladder level={lvl} steps={CH_STEPS} heightPx={h * K} widthPx={11} />
          <div style={{ position: 'relative', height: h * K, width: 18 }}>
            {CH_LABELS.map((l, i) => (
              <div key={l} style={{ position: 'absolute', top: (CH_STEPS.length - 1 - i + 0.5) * ((h * K) / CH_STEPS.length), transform: 'translateY(-50%)', fontSize: 7, fontWeight: 700, color: i === 8 ? '#ff6b5e' : '#9aa1a8', whiteSpace: 'nowrap', lineHeight: 1 }}>{l}</div>
            ))}
          </div>
        </div>
      );
    },
  };
}

const masterMeters: PanelElement = {
  kind: 'custom', x: 262, y: 52, w: 32, h: 76,
  render: ({ engine, values }) => {
    const m = (engine.meters ?? {}) as Record<string, number>;
    const hpx = 76 * K;
    const split = !!values.split_cue;
    return (
      <div style={{ display: 'flex', gap: 4, pointerEvents: 'none', alignItems: 'flex-start' }} aria-label="LR MIX meters">
        <div style={{ position: 'relative', height: hpx, width: 22 }}>
          {MS_LABELS.map((l, i) => (
            <div key={l} style={{ position: 'absolute', right: 0, top: (MS_STEPS.length - 1 - i + 0.5) * (hpx / MS_STEPS.length), transform: 'translateY(-50%)', fontSize: 7, fontWeight: 700, color: '#9aa1a8', lineHeight: 1 }}>{l}</div>
          ))}
        </div>
        {(['L', 'R'] as const).map(side => (
          <div key={side} style={{ position: 'relative' }}>
            <Ladder level={dbu(m[side])} steps={MS_STEPS} heightPx={hpx} widthPx={12} />
            <div style={{ position: 'absolute', top: hpx + 3, left: '50%', transform: 'translateX(-50%)', fontSize: 7, fontWeight: 800, color: split && side === 'L' ? '#ff8a1f' : '#cfd3d7' }}>
              {split && side === 'L' ? 'CUE' : side}
            </div>
          </div>
        ))}
      </div>
    );
  },
};

// ---------------------------------------------------------------------------
// Deck strip (twin only): source menu, file loader, what the channel hears
// ---------------------------------------------------------------------------

type Ctx = PanelContext & { setValue: (id: string, v: ControlValue) => void; sendEvent: (e: string, payload?: unknown) => void };

function hears(ch: ChannelId, values: Record<string, ControlValue>, files: Record<string, string>): string {
  const input = Number(values[`ch${ch}_input`] ?? 2);
  if (input === 0 || input === 3) return files[ch] ? `USB: ${files[ch]}` : 'USB: no file';
  if (isAux(ch) && input === 2) return ch === 'a' ? 'RTN: delay' : 'RTN: reverb';
  const src = Number(values[`ch${ch}_src`] ?? 8);
  const via = isAux(ch) ? 'MIC' : input === 1 ? 'PHONO' : 'LINE';
  return `${via}: ${SOURCE_NAMES[src] ?? '—'}`;
}

function DeckColumn({ ch, ctx }: { ch: ChannelId; ctx: Ctx }) {
  const files = (ctx.engine.files ?? {}) as Record<string, string>;
  const src = Number(ctx.values[`ch${ch}_src`] ?? 8);
  const status = hears(ch, ctx.values, files);
  return (
    <div style={{ width: 38 * K, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ fontSize: 8, fontWeight: 800, color: '#8fd3ff', letterSpacing: 0.5 }}>DECK → CH {chName(ch)}</div>
      <select
        aria-label={`Deck source for channel ${chName(ch)}`}
        value={src}
        onChange={e => ctx.setValue(`ch${ch}_src`, Number(e.target.value))}
        style={{ fontSize: 11, height: 24, background: '#101418', color: '#fff', border: '1px solid #3b4652', borderRadius: 4, padding: '0 4px', touchAction: 'manipulation' }}
      >
        {SOURCE_NAMES.map((n, i) => <option key={n} value={i}>{n}</option>)}
      </select>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <label
          style={{ fontSize: 9, fontWeight: 700, color: '#dfe6ec', background: '#24303b', border: '1px solid #3b4652', borderRadius: 4, padding: '3px 6px', cursor: 'pointer', whiteSpace: 'nowrap' }}
          title="Load your own audio file; it plays (looping) on this channel's USB input"
        >
          LOAD FILE
          <input
            type="file"
            accept="audio/*"
            style={{ display: 'none' }}
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) {
                ctx.sendEvent(`load:${ch}`, f);
                ctx.setValue(`ch${ch}_input`, 0);
              }
              e.target.value = '';
            }}
          />
        </label>
        <div style={{ fontSize: 7, color: '#6f8090', whiteSpace: 'nowrap' }}>plays on USB 1</div>
      </div>
      <div style={{ fontSize: 8.5, fontWeight: 600, color: '#b9c8d6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={status}>
        <span style={{ color: '#6f8090' }}>hears </span>{status}
      </div>
    </div>
  );
}

const deckStrip: PanelElement = {
  kind: 'custom', x: 6, y: 7, w: 250, h: 33,
  render: ctx => (
    <div style={{ display: 'flex', gap: 4 * K }}>
      {CHANNELS.map(ch => <DeckColumn key={ch} ch={ch} ctx={ctx} />)}
    </div>
  ),
};

// ---------------------------------------------------------------------------
// Element helpers
// ---------------------------------------------------------------------------

type KnobExtra = Partial<Extract<PanelElement, { kind: 'knob' }>>;
const knob = (control: string, x: number, y: number, diameter: number, capColor: string, extra: KnobExtra = {}): PanelElement => ({
  kind: 'knob', control, x, y, diameter, variant: 'xone', capColor, value: 'hover', ...extra,
});
const label = (text: string, x: number, y: number, size = 7, extra: Partial<Extract<PanelElement, { kind: 'label' }>> = {}): PanelElement => ({
  kind: 'label', text, x, y, size, ...extra,
});

function strip(ch: ChannelId): PanelElement[] {
  const cx = CX[ch];
  const p = `ch${ch}_`;
  const aux = isAux(ch);
  const kx = cx - 6;
  const els: PanelElement[] = [
    { kind: 'switch', control: `${p}input`, x: cx, y: MY + 9, style: 'buttons', orientation: 'horizontal', scale: 1 },
    knob(`${p}gain`, kx, MY + 26, 11, CAP.gain),
    knob(`${p}hi`, kx, MY + 44, 10, CAP.eq),
    ...(aux
      ? [knob(`${p}midf`, kx, MY + 61, 9, CAP.mid), knob(`${p}mid`, kx, MY + 78, 10, CAP.eq)]
      : [knob(`${p}himid`, kx, MY + 61, 10, CAP.mid), knob(`${p}lomid`, kx, MY + 78, 10, CAP.mid)]),
    knob(`${p}lo`, kx, MY + 95, 10, CAP.eq),
    channelMeter(ch),
    { kind: 'switch', control: `${p}filter`, x: cx, y: MY + 133, style: 'buttons', orientation: 'horizontal', scale: 1.25 },
    { kind: 'button', control: `${p}cue`, x: cx, y: MY + 148, shape: 'rect', w: 13, h: 6, color: '#2a2622', ledColor: '#ff8a1f', capText: 'CUE', label: 'none' },
    { kind: 'switch', control: `${p}xf`, x: cx, y: MY + 163, style: 'buttons', orientation: 'horizontal', scale: 1.25 },
    { kind: 'slider', control: `${p}fader`, x: cx, y: MY + 208, length: 60, capColor: '#e6e6e6', label: 'none', value: 'hover' },
    label(chName(ch), cx, MY + 248, 16, { weight: 900 }),
    ...[10, 8, 6, 4, 2, 0].map(v => label(String(v), cx - 10, MY + 178 + (1 - v / 10) * 60, 6, { color: '#8c939a', align: 'right' })),
  ];
  if (aux) {
    els.push(label(ch === 'a' ? 'RTN A ← DELAY' : 'RTN B ← REVERB', cx, MY + 116, 6, { color: '#8fd3ff' }));
    els.push(label('(no sends)', cx, MY + 121, 5.5, { color: '#6c737a', weight: 500 }));
  } else {
    els.push(knob(`${p}snd1`, cx - 9, MY + 117, 8.5, CAP.send));
    els.push(knob(`${p}snd2`, cx + 9, MY + 117, 8.5, CAP.send));
  }
  return els;
}

function filterSection(f: 1 | 2): PanelElement[] {
  // Filter 1 on the left of the crossfader, filter 2 mirrored on the right
  const X = (x: number) => (f === 1 ? x : 260 - x);
  const p = `f${f}_`;
  const top = MY + 262;
  return [
    { kind: 'section', x: f === 1 ? 6 : 164, y: top, w: 90, h: 82, border: '1px solid #4a5057', radius: 2, background: '#26292d', title: `FILTER ${f}`, titleColor: '#ffb070' },
    ...(['HPF', 'BPF', 'LPF'] as const).map((t, i): PanelElement => ({
      kind: 'button', control: `${p}type`, setValue: i, x: X(18 + i * 14), y: top + 13, shape: 'rect', w: 11, h: 6,
      color: '#202326', ledColor: '#ff7a1a', capText: t, label: 'none',
    })),
    knob(`${p}freq`, X(77), top + 33, 17, CAP.freq),
    knob(`${p}res`, X(20), top + 60, 11, CAP.res),
    knob(`${p}crunch`, X(48), top + 60, 11, CAP.crunch),
    { kind: 'led', x: X(59), y: top + 52, size: 2.5, color: '#ff3b30', on: ({ values }) => Math.min(1, Number(values[`${p}crunch`] ?? 0) / 6) },
    label('MILD ← → WILD', X(20), top + 72, 5, { color: '#8c939a', weight: 600 }),
    label('TYPE', X(32), top + 6.5, 6, { color: '#c6cbd0' }),
  ];
}

// ---------------------------------------------------------------------------

const elements: PanelElement[] = [
  // --- Deck strip (twin only) --------------------------------------------------
  { kind: 'section', x: 2, y: 2, w: W - 4, h: DECK_H - 5, background: '#0f1316', border: '1px solid #26313b', radius: 2, title: 'STUDIO DECKS  ·  twin only, not part of the mixer', titleColor: '#8fd3ff' },
  deckStrip,
  { kind: 'button', control: 'play', x: 268, y: 15, shape: 'round', w: 11, color: '#13261a', ledColor: '#22c55e', capText: 'PLAY', label: 'none' },
  knob('bpm', 284, 16, 8.5, '#cfd3d7', { value: 'always', label: 'above' }),
  {
    kind: 'display', x: 294, y: 6, w: 39, h: 17, style: 'oled',
    render: ({ engine, values }) => {
      const bar = Number(engine.bar ?? 0);
      const beat = Number(engine.beat ?? 0);
      const playing = !!engine.playing;
      const phrase = bar ? Math.floor((bar - 1) / 8) + 1 : 0;
      return [
        playing ? `▶ ${values.bpm ?? 124} BPM` : `■ ${values.bpm ?? 124} BPM`,
        bar ? `BAR ${String(bar).padStart(2, '0')}/32 · ${beat}` : 'BAR --/32',
        bar ? `PHRASE ${phrase}/4 · ${((bar - 1) % 8) + 1}/8` : 'SPACE = PLAY',
      ];
    },
  },
  label('VIRTUAL FX UNIT', 272, 26.5, 5.5, { color: '#8fd3ff' }),
  { kind: 'switch', control: 'fx_time', x: 272, y: 34, style: 'buttons', orientation: 'horizontal', scale: 0.85, label: 'none' },
  knob('fx_fdbk', 303, 35, 7.5, '#cfd3d7'),
  knob('fx_size', 323, 35, 7.5, '#cfd3d7'),

  // --- Faceplate ------------------------------------------------------------------
  { kind: 'section', x: 0, y: MY, w: W, h: 410, background: 'linear-gradient(180deg, #34383c 0%, #2c3034 60%, #25282b 100%)', radius: 3 },
  ...CHANNELS.map((ch): PanelElement => ({ kind: 'section', x: CX[ch] - 20, y: MY + 3, w: 40, h: 252, border: '1px solid #3d4247', radius: 2 })),
  { kind: 'section', x: 258, y: MY + 3, w: 75, h: 252, border: '1px solid #3d4247', radius: 2 },
  ...CHANNELS.flatMap(strip),

  // --- Master section -----------------------------------------------------------------
  label('LR MIX', 278, MY + 6, 7, { color: '#c6cbd0' }),
  masterMeters,
  { kind: 'led', x: 318, y: MY + 12, size: 3, color: '#ff8a1f', on: ({ values }) => CHANNELS.some(c => !!values[`ch${c}_cue`]) },
  label('CUE', 318, MY + 7, 6, { color: '#c6cbd0' }),
  knob('master', 318, MY + 32, 14, CAP.master),
  knob('booth', 318, MY + 59, 11, CAP.booth),
  { kind: 'button', control: 'booth_mono', x: 318, y: MY + 74, shape: 'rect', w: 12, h: 5.5, color: '#2a2722', ledColor: '#ffd23f', capText: 'MONO', label: 'none' },
  { kind: 'switch', control: 'send1_pre', x: 278, y: MY + 103, style: 'buttons', orientation: 'horizontal', scale: 1.15 },
  label('SEND 2: POST', 312, MY + 103, 6, { color: '#9aa1a8' }),
  { kind: 'section', x: 261, y: MY + 117, w: 69, h: 62, border: '1px solid #4a5057', radius: 2, title: 'HEADPHONES', titleColor: '#ffb070', background: '#2b2f33' },
  knob('cue_mix', 276, MY + 134, 11, CAP.res),
  knob('phones', 315, MY + 134, 12, CAP.phones),
  { kind: 'button', control: 'split_cue', x: 276, y: MY + 154, shape: 'rect', w: 13, h: 6, color: '#2a2622', ledColor: '#ff8a1f', capText: 'SPLIT', label: 'none' },
  { kind: 'button', control: 'cue_post_eq', x: 315, y: MY + 154, shape: 'rect', w: 17, h: 6, color: '#2a2622', ledColor: '#ff8a1f', capText: 'POST EQ', label: 'none' },
  label('CUE ← → MST', 276, MY + 143.5, 5, { color: '#8c939a', weight: 600 }),
  { kind: 'switch', control: 'monitor_out', x: MCX, y: MY + 169, style: 'buttons', orientation: 'horizontal', scale: 0.95, labelText: 'YOU HEAR (twin)' },
  // (x left of the column centre: an anchor near the right edge would be squeezed and wrap)
  { kind: 'switch', control: 'fader_curve', x: 284, y: MY + 205, style: 'buttons', orientation: 'horizontal', scale: 1.1 },
  label('applies to channels 1–4', 284, MY + 216, 5.5, { color: '#8c939a', weight: 500 }),
  label('XONE:96', MCX, MY + 296, 24, { weight: 900, letterSpacing: 1, font: 'condensed' }),
  label('ANALOGUE DJ MIXER', MCX, MY + 309, 6, { color: '#8c939a', letterSpacing: 1.5 }),
  label('6 + 2 CHANNELS · DUAL XONE:VCF', MCX, MY + 316, 5.5, { color: '#6c737a', letterSpacing: 0.8 }),

  // --- Filters and crossfader ---------------------------------------------------------
  ...filterSection(1),
  ...filterSection(2),
  { kind: 'switch', control: 'xf_curve', x: 130, y: MY + 272, style: 'buttons', orientation: 'horizontal', scale: 1.1 },
  { kind: 'slider', control: 'xfader', x: 130, y: MY + 305, length: 45, orientation: 'horizontal', capColor: '#e6e6e6', label: 'none', value: 'hover' },
  label('X', 101, MY + 305, 11, { weight: 900 }),
  label('Y', 159, MY + 305, 11, { weight: 900 }),
  label('CROSSFADER', 130, MY + 318, 6.5, { color: '#c6cbd0' }),

  // --- Branding / front lip -------------------------------------------------------------
  { kind: 'section', x: 0, y: MY + 352, w: W, h: 58, background: 'linear-gradient(180deg, #2a2d30 0%, #1d1f21 100%)', radius: 3 },
  label('ALLEN&HEATH', 20, MY + 380, 16, { align: 'left', weight: 800, letterSpacing: 1.5 }),
  label('XONE SERIES', W - 16, MY + 380, 8, { align: 'right', color: '#8c939a', letterSpacing: 3 }),
];

export const XONE96_LAYOUT: PanelLayout = {
  width: W,
  height: H,
  pxPerMm: K,
  theme: {
    background: '#15181b',
    text: '#f2f4f5',
    muted: '#b8bec4',
    font: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    frame: { padding: 2, background: '#0c0d0e', radius: 3 },
  },
  elements,
};
