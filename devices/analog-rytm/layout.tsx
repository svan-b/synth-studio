// ============================================================================
// Analog Rytm MKII panel layout (mm from the faceplate's top-left)
//
// Positions follow a front-on photo of the MKII (rytm-emu's photo layout,
// REFERENCE.md "Front panel"), black finish (2020-): top row MAIN VOLUME,
// SAMPLING, QPER, QUICK PERF AMOUNT, TRACK LEVEL; the mode keys; FUNC / TRK /
// RTRG down the left; the 12 pads (CH OH CY CB / BT LT MT HT / BD SD RS CP);
// the screen window; YES / NO and the arrows; encoders A-H; the PARAMETER
// keys; FX, CHAIN, SONG; the bank keys with the pattern-mode LEDs; the
// transport; FILL; the PAGE LEDs and key; 16 trig keys along the bottom.
// The screen is drawn larger than the real 128 x 64 OLED for an iPad.
// ============================================================================

import React, { type ReactNode } from 'react';
import type { CustomElement, CustomRenderContext, PanelContext, PanelElement, PanelLayout } from '@/types/panel';
import { ChainBuilder, PatternPicker, ScaleMenu, SongEditor, TrigEditor, TrigKeys } from '@/components/sequencer';
import {
  CHANGE_MODES, asProject, getPattern, setChangeMode, setPlayMode, trackLength, type ChangeMode,
} from '@/lib/sequencer/elektron';
import { FX_TRACK, PAGE, SEQ_TRACKS, TRACKS, pageControls, describe } from './model';
import {
  Key, Menus, PageLeds, Pads, RY, RytmStyles, Screen, flash, funcOn, nudgeHeld, openMenu, reloadKit, trackClear, trackCopy, trackPaste, useFunc,
} from './ui';
import type { RytmProject } from './presets';

const W = 385;
const H = 193;
const PX = 3.2;

const num = (v: unknown, d = 0) => (typeof v === 'number' ? v : typeof v === 'boolean' ? (v ? 1 : 0) : d);
const TRACK_NAMES = [...TRACKS.map(t => t.name), 'FX'];

// ----------------------------------------------------------------------------
// Key placement: centre (x, y) and cap size; the box adds room for the labels below
// ----------------------------------------------------------------------------

const SMALL = { w: 11.8, h: 10.4 };
const BIG = { w: 16.4, h: 16.4 };
const LABEL_ROOM = 7;

function key(x: number, y: number, size: { w: number; h: number }, render: (ctx: CustomRenderContext) => ReactNode, big = false): CustomElement {
  const h = big ? size.h + LABEL_ROOM : size.h / 0.62;
  return { kind: 'custom', x: x - size.w / 2, y: y - size.h / 2, w: size.w, h, render };
}

/** FUNC-aware press: `normal` without FUNC, `func` with it */
const press = (ctx: CustomRenderContext, normal: () => void, func?: () => void) => {
  if (func && funcOn(ctx)) { useFunc(ctx); func(); } else normal();
};

const closeAll = (ctx: CustomRenderContext) =>
  ctx.setUi({ rytmMenu: null, seqMenu: null, sceneEdit: null, perfEdit: null, trigEditor: null, trkLatch: false, heldSteps: [] });

const projectOf = (ctx: CustomRenderContext) => asProject(ctx.data, SEQ_TRACKS) as RytmProject;

// --- Icons (SVG, currentColor) ---------------------------------------------------

const icon = (d: ReactNode, vb = '0 0 24 24') => (
  <svg viewBox={vb} style={{ width: '1.5em', height: '1.5em', display: 'block' }} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);
const I = {
  rec: icon(<circle cx={12} cy={12} r={6.5} />),
  play: icon(<path d="M8 5.5 L18.5 12 L8 18.5 Z" />),
  stop: icon(<rect x={6.5} y={6.5} width={11} height={11} />),
  up: icon(<path d="M6 15 L12 8.5 L18 15" />),
  down: icon(<path d="M6 9 L12 15.5 L18 9" />),
  left: icon(<path d="M15 6 L8.5 12 L15 18" />),
  right: icon(<path d="M9 6 L15.5 12 L9 18" />),
  tempo: icon(<><path d="M8 20 L10.5 4 L13.5 4 L16 20 Z" /><path d="M12 15 L17 8" /></>),
  chain: icon(<><rect x={3} y={9} width={9} height={6} rx={3} /><rect x={12} y={9} width={9} height={6} rx={3} /></>),
  song: icon(<><path d="M5 7 H19" /><path d="M5 12 H19" /><path d="M5 17 H13" /></>),
};

// ----------------------------------------------------------------------------
// Keys
// ----------------------------------------------------------------------------

const MODE_KEYS: [string, string, string, number][] = [
  // label, secondary (FUNC), menu, pad mode
  ['PLAY', 'Kit', 'kit', 0], ['MUTE', 'Sound', 'sound', 1], ['CHRO', 'Track', 'track', 2], ['SCNE', 'Pattern', 'pattern', 3], ['PERF', 'Song', 'song', 4],
];
const MODE_X = [54.6, 72.6, 90.3, 108.3, 126.0];
const ROW2 = 38.7;

function modeFunc(ctx: CustomRenderContext, menu: string) {
  if (menu === 'pattern') ctx.setUi({ seqMenu: 'pattern', rytmMenu: null });
  else if (menu === 'song') ctx.setUi({ seqMenu: 'song', rytmMenu: null });
  else if (menu === 'track') ctx.setUi({ seqMenu: 'scale', rytmMenu: null });
  else openMenu(ctx, menu);
}

const PARAM_KEYS: [string, string | undefined, string | undefined][] = [
  // label, FX-track page name, FUNC function
  ['TRIG', undefined, 'Quantize'], ['SRC', 'Delay', 'Assign'], ['SMPL', 'Reverb', 'Samples'], ['FLTR', 'Dist', 'Settings'], ['AMP', 'Comp', undefined], ['LFO', 'LFO', undefined],
];
const PARAM_X = [275.0, 290.9, 306.7, 322.6, 338.5, 354.2];
const ROW_PARAM = 79.6;

const BANK_X = [186.5, 209.5, 232.5, 255.4];
const BANK_SUB = ['', '', '', '', 'Trig Mute', 'Accent', 'Swing', 'Slide'];
const MODE_LED_NAMES = ['Sequential', 'Direct Start', 'Direct Jump', 'Temp Jump'];

function bankPress(ctx: CustomRenderContext, b: number) {
  press(ctx, () => ctx.setUi({ seqMenu: 'pattern', seqBank: b, rytmMenu: null }), () => {
    if (b < 4) {
      ctx.updateData(d => setChangeMode(asProject(d, SEQ_TRACKS), CHANGE_MODES[b] as ChangeMode));
      flash(ctx, `PATTERN CHANGE: ${MODE_LED_NAMES[b].toUpperCase()}`);
    } else if (b === 4) flash(ctx, 'TRIG MUTE IS NOT MODELLED');
    else if (b === 5) { const on = ctx.ui.trigMode === 'accent'; ctx.setUi({ trigMode: on ? 'trig' : 'accent' }); flash(ctx, on ? 'TRIG KEYS: TRIGS' : 'TRIG KEYS: ACCENTS'); }
    else if (b === 6) openMenu(ctx, 'tempo');
    else { const on = ctx.ui.trigMode === 'pslide'; ctx.setUi({ trigMode: on ? 'trig' : 'pslide' }); flash(ctx, on ? 'TRIG KEYS: TRIGS' : 'TRIG KEYS: PARAMETER SLIDE'); }
  });
}

function arrow(ctx: CustomRenderContext, dir: 'up' | 'down' | 'left' | 'right') {
  const f = funcOn(ctx);
  if (f) {
    useFunc(ctx);
    const what = dir === 'left' || dir === 'right' ? 'micro' : 'retrig';
    const d = dir === 'right' || dir === 'up' ? 1 : -1;
    if (nudgeHeld(ctx, what, d)) return;
  }
  if ((ctx.ui.rtrgHeld || ctx.ui.rtrgLatch) && (dir === 'up' || dir === 'down')) {
    const v = Math.max(0, Math.min(16, Math.round(num(ctx.values.rtrg_rate, 9)) + (dir === 'up' ? 1 : -1)));
    ctx.setValue('rtrg_rate', v);
    flash(ctx, `RETRIG 1/${[1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64, 80][v]}`);
    return;
  }
  if (num(ctx.values.pad_mode) === 2 && (dir === 'up' || dir === 'down')) {
    const o = Math.max(-3, Math.min(3, num(ctx.ui.octave) + (dir === 'up' ? 1 : -1)));
    ctx.setUi({ octave: o });
    flash(ctx, `OCTAVE ${o > 0 ? '+' : ''}${o}`);
    return;
  }
  if (dir === 'up' || dir === 'down') {
    const t = Math.round(num(ctx.values.track));
    ctx.setValue('track', (t + (dir === 'up' ? 12 : 1)) % 13);
  } else {
    const p = Math.round(num(ctx.values.page, 1));
    ctx.setValue('page', (p + (dir === 'left' ? 5 : 1)) % 6);
  }
}

function keys(): PanelElement[] {
  const out: PanelElement[] = [];
  // --- Top row: SAMPLING, QPER ------------------------------------------------
  out.push(key(55.0, 17.1, SMALL, ctx => <Key ctx={ctx} id="key:sampling" label="SMPLNG" sub="Direct" funcSub onDown={() => flash(ctx, 'SAMPLING IS NOT MODELLED. THE SMPL PAGE PLAYS SYNTHESIZED ONE-SHOTS')} />));
  out.push(key(90.7, 17.1, SMALL, ctx => {
    const latched = ((ctx.engine.perfLatch as number[] | undefined) ?? []).some(Boolean);
    return <Key ctx={ctx} id="key:qper" label="QPER" sub="Mute" funcSub lit={latched || !!ctx.ui.qper} ledColor={RY.green}
      onDown={() => press(ctx, () => { const on = !ctx.ui.qper; ctx.setUi({ qper: on }); flash(ctx, on ? 'QUICK PERFORMANCE: PADS LATCH MACROS' : 'QUICK PERFORMANCE OFF'); }, () => { ctx.sendEvent('perf:clear'); flash(ctx, 'PERFORMANCE MACROS OFF'); })} />;
  }));
  // --- Mode row ------------------------------------------------------------------
  out.push(key(26.2, ROW2, SMALL, ctx => <Key ctx={ctx} id="key:global" label="GLOBAL" sub="Save Proj" funcSub onDown={() => press(ctx, () => flash(ctx, 'GLOBAL SETTINGS ARE NOT MODELLED'), () => flash(ctx, 'THE PROJECT SAVES AUTOMATICALLY'))} />));
  MODE_KEYS.forEach(([label, sub, menu, mode], i) => out.push(key(MODE_X[i], ROW2, SMALL, ctx => (
    <Key ctx={ctx} id={`key:${label.toLowerCase()}`} label={label} sub={sub} funcSub lit={Math.round(num(ctx.values.pad_mode)) === mode} ledColor={mode === 0 ? RY.green : RY.led}
      control="pad_mode" value={mode}
      onDown={() => press(ctx, () => ctx.setValue('pad_mode', Math.round(num(ctx.values.pad_mode)) === mode && mode !== 0 ? 0 : mode), () => modeFunc(ctx, menu))} />
  ))));
  out.push(key(144.0, ROW2, SMALL, ctx => <Key ctx={ctx} id="key:fix" label={<span style={{ fontStyle: 'italic', fontWeight: 900, letterSpacing: -0.5 }}>FIX</span>} sub="Setup" funcSub
    lit={num(ctx.values.fix) > 0} control="fix" onDown={() => press(ctx, () => ctx.setValue('fix', num(ctx.values.fix) > 0 ? 0 : 1), () => openMenu(ctx, 'fix'))} />));
  out.push(key(161.9, ROW2, SMALL, ctx => <Key ctx={ctx} id="key:tempo" label={I.tempo} sub="Tap Tempo" funcSub
    onDown={() => press(ctx, () => openMenu(ctx, 'tempo'), () => {
      const now = performance.now();
      const taps = ([...((ctx.ui.taps as number[] | undefined) ?? []).filter(t => now - t < 2500), now]).slice(-5);
      ctx.setUi({ taps });
      if (taps.length >= 2) {
        const bpm = Math.max(30, Math.min(300, Math.round(600000 / ((taps[taps.length - 1] - taps[0]) / (taps.length - 1))) / 10));
        ctx.setValue('bpm', bpm);
        flash(ctx, `TAP TEMPO ${bpm.toFixed(1)}`);
      } else flash(ctx, 'TAP TEMPO: KEEP TAPPING [FUNC] + [TEMPO]');
    })} />));
  // --- Left column -----------------------------------------------------------------
  out.push(key(26.6, 74.2, BIG, ctx => <Key ctx={ctx} id="key:func" big label="FUNC" lit={funcOn(ctx) ? 1 : 0} ledColor={RY.blue}
    onDown={() => ctx.setUi({ func: true, funcUsed: false })}
    onUp={() => ctx.setUi(ctx.ui.funcUsed ? { func: false } : { func: false, funcLatch: !ctx.ui.funcLatch })}
    capStyle={{ fontSize: 'var(--rytm-func-font, 11px)' }} title="Hold (or tap) FUNC, then press a key for its second function" />, true));
  out.push(key(26.6, 111.3, SMALL, ctx => <Key ctx={ctx} id="key:trk" label="TRK" sub="Save Kit" funcSub lit={!!ctx.ui.trkHeld || !!ctx.ui.trkLatch}
    onDown={() => press(ctx, () => ctx.setUi({ trkHeld: true, trkAt: Date.now() }), () => openMenu(ctx, 'kit'))}
    onUp={() => { if (!ctx.ui.trkHeld) return; const tap = Date.now() - num(ctx.ui.trkAt) < 350; ctx.setUi({ trkHeld: false, trkLatch: tap ? !ctx.ui.trkLatch : false }); }} />));
  out.push(key(26.6, 145.0, SMALL, ctx => <Key ctx={ctx} id="key:rtrg" label="RTRG" sub="Metronome" funcSub lit={!!ctx.ui.rtrgHeld || !!ctx.ui.rtrgLatch} ledColor={RY.amber}
    onDown={() => press(ctx, () => ctx.setUi({ rtrgHeld: true, rtrgAt: Date.now() }), () => flash(ctx, 'THE METRONOME IS NOT MODELLED'))}
    onUp={() => { if (!ctx.ui.rtrgHeld) return; const tap = Date.now() - num(ctx.ui.rtrgAt) < 350; ctx.setUi({ rtrgHeld: false, rtrgLatch: tap ? !ctx.ui.rtrgLatch : false }); if (tap && !ctx.ui.rtrgLatch) flash(ctx, 'RETRIG ON: PADS ROLL. UP / DOWN CHANGE THE RATE'); }} />));
  // --- YES / NO / arrows ------------------------------------------------------------
  out.push(key(197.2, 79.6, SMALL, ctx => <Key ctx={ctx} id="key:yes" label="YES" sub="Save" funcSub onDown={() => press(ctx, () => closeAll(ctx), () => openMenu(ctx, 'kit'))} />));
  out.push(key(197.2, 97.2, SMALL, ctx => <Key ctx={ctx} id="key:no" label="NO" sub="Reload" funcSub onDown={() => press(ctx, () => closeAll(ctx), () => reloadKit(ctx))} />));
  out.push(key(228.8, 79.6, SMALL, ctx => <Key ctx={ctx} id="key:up" label={I.up} sub="Retrig +" funcSub onDown={() => arrow(ctx, 'up')} />));
  out.push(key(213.1, 97.2, SMALL, ctx => <Key ctx={ctx} id="key:left" label={I.left} sub="μTime -" funcSub onDown={() => arrow(ctx, 'left')} />));
  out.push(key(228.8, 97.2, SMALL, ctx => <Key ctx={ctx} id="key:down" label={I.down} sub="Retrig -" funcSub onDown={() => arrow(ctx, 'down')} />));
  out.push(key(244.8, 97.2, SMALL, ctx => <Key ctx={ctx} id="key:right" label={I.right} sub="μTime +" funcSub onDown={() => arrow(ctx, 'right')} />));
  // --- PARAMETER keys ------------------------------------------------------------------
  PARAM_KEYS.forEach(([label, fx, func], i) => out.push(key(PARAM_X[i], ROW_PARAM, SMALL, ctx => (
    <Key ctx={ctx} id={`key:${label.toLowerCase()}`} label={label} sub={func} sub2={fx} funcSub lit={Math.round(num(ctx.values.page, 1)) === i} control="page" value={i}
      onDown={() => press(ctx, () => ctx.setValue('page', i), func ? () => {
        if (i === 0) { const q = num(ctx.values.quantize, 1) > 0 ? 0 : 1; ctx.setValue('quantize', q); flash(ctx, q ? 'LIVE RECORDING QUANTIZED' : 'LIVE RECORDING WITH MICRO TIMING'); }
        else if (i === 1 || i === 3) openMenu(ctx, 'sound');
        else if (i === 2) openMenu(ctx, 'samples');
      } : undefined)} />
  ))));
  out.push(key(353.8, 103.2, SMALL, ctx => <Key ctx={ctx} id="key:fx" label="FX" sub="MIDI Config" funcSub lit={Math.round(num(ctx.values.track)) === FX_TRACK} control="track" value={FX_TRACK} ledColor={RY.amber}
    onDown={() => press(ctx, () => ctx.setValue('track', FX_TRACK), () => flash(ctx, 'MIDI CONFIG IS NOT MODELLED'))} />));
  out.push(key(292.7, 115.5, SMALL, ctx => {
    const p = projectOf(ctx);
    return <Key ctx={ctx} id="key:chain" label={I.chain} sub="New Chain" funcSub lit={p.mode === 'chain'} ledColor={RY.green} focusIds={['seq:menu:chain']}
      onDown={() => press(ctx, () => {
        if (p.mode === 'chain') ctx.updateData(d => setPlayMode(asProject(d, SEQ_TRACKS), 'pattern'));
        else if (p.chain.length) { ctx.updateData(d => setPlayMode(asProject(d, SEQ_TRACKS), 'chain')); flash(ctx, `CHAIN MODE: ${p.chain.join(' ')}`); }
        else ctx.setUi({ seqMenu: 'chain' });
      }, () => ctx.setUi({ seqMenu: 'chain' }))} />;
  }));
  out.push(key(313.3, 115.5, SMALL, ctx => {
    const p = projectOf(ctx);
    return <Key ctx={ctx} id="key:song" label={I.song} sub="Edit Song" funcSub lit={p.mode === 'song'} ledColor={RY.green} focusIds={['seq:menu:song', 'seq:mode:song']}
      onDown={() => press(ctx, () => {
        const next = p.mode === 'song' ? 'pattern' : 'song';
        ctx.updateData(d => setPlayMode(asProject(d, SEQ_TRACKS), next));
        flash(ctx, next === 'song' ? `SONG MODE: ${p.song.name || 'SONG'} (${p.song.rows.length} ROWS)` : 'PATTERN MODE');
      }, () => ctx.setUi({ seqMenu: 'song' }))} />;
  }));
  // --- Banks ----------------------------------------------------------------------------
  for (let b = 0; b < 8; b++) {
    out.push(key(BANK_X[b % 4], b < 4 ? 129.0 : 145.2, { w: 15, h: 9.2 }, ctx => {
      const p = projectOf(ctx);
      const st = ctx.engine.seq as { pattern?: string | null; playing?: boolean } | undefined;
      const shown = (st?.playing && st.pattern) || p.active;
      const active = shown.charCodeAt(0) - 65 === b;
      return <Key ctx={ctx} id={`key:bank:${'ABCDEFGH'[b]}`} label={'ABCDEFGH'[b]} sub={BANK_SUB[b] || undefined} funcSub lit={active ? 0.7 : 0} focusIds={[`seq:bank:${'ABCDEFGH'[b]}`, 'seq:patterns']}
        onDown={() => bankPress(ctx, b)} />;
    }));
  }
  // --- Transport -----------------------------------------------------------------------
  out.push(key(282.7, 141.7, BIG, ctx => {
    const rec = Math.round(num(ctx.values.rec, 1));
    return <Key ctx={ctx} id="key:rec" big label={I.rec} sub="Copy" funcSub lit={rec > 0} blink={rec === 2} control="rec"
      onDown={() => press(ctx, () => { ctx.setUi({ recHeld: true }); ctx.setValue('rec', rec === 0 ? 1 : 0); }, () => trackCopy(ctx))}
      onUp={() => ctx.setUi({ recHeld: false })} />;
  }, true));
  out.push(key(303.2, 141.7, BIG, ctx => {
    const playing = !!ctx.engine.playing;
    return <Key ctx={ctx} id="key:play" big label={I.play} sub="Clear" funcSub lit={playing} ledColor={RY.green} control="play"
      onDown={() => press(ctx, () => {
        if (ctx.ui.recHeld) { ctx.setValue('rec', 2); flash(ctx, 'LIVE RECORDING: PLAY THE PADS'); }
        ctx.setValue('play', true);
      }, () => trackClear(ctx))} />;
  }, true));
  out.push(key(323.8, 141.7, BIG, ctx => <Key ctx={ctx} id="key:stop" big label={I.stop} sub="Paste" funcSub control="play"
    onDown={() => press(ctx, () => { ctx.setValue('play', false); if (Math.round(num(ctx.values.rec)) === 2) ctx.setValue('rec', 1); }, () => trackPaste(ctx))} />, true));
  out.push(key(353.8, 145.2, SMALL, ctx => {
    const st = ctx.engine.seq as { fill?: boolean; fillCued?: boolean } | undefined;
    return <Key ctx={ctx} id="key:fill" label="FILL" sub="Cue Fill" funcSub lit={!!st?.fill} blink={!!st?.fillCued} ledColor={RY.yellow} focusIds={['seq:fill']}
      onDown={() => press(ctx, () => { ctx.setUi({ fillHeld: true }); ctx.sendEvent('seq:fill'); }, () => ctx.sendEvent('seq:fill-cue'))}
      onUp={() => { if (ctx.ui.fillHeld) { ctx.setUi({ fillHeld: false }); ctx.sendEvent('seq:fill:up'); } }} />;
  }));
  out.push(key(354.4, 176.8, SMALL, ctx => <Key ctx={ctx} id="key:page" label="PAGE" sub="Scale" funcSub focusIds={['seq:pages', 'seq:menu:scale']}
    onDown={() => press(ctx, () => {
      const p = projectOf(ctx);
      const t = Math.round(num(ctx.values.track));
      const pages = Math.max(1, Math.ceil(trackLength(getPattern(p, p.active), t) / 16));
      const cur = Math.round(num(ctx.ui.stepPage));
      ctx.setUi({ stepPage: (cur + 1) % pages });
    }, () => ctx.setUi({ seqMenu: 'scale' }))} />));
  return out;
}

// ----------------------------------------------------------------------------
// Encoders and knobs
// ----------------------------------------------------------------------------

const ENC_X = [275.2, 301.4, 328.0, 354.8];
const ENC_Y = [22.2, 50.4];
const ENC_D = 13.6;

/** Which control encoder i (0..7) edits right now */
export const encoderBinding = (i: number) => ({ values }: PanelContext) =>
  pageControls(Math.round(num(values.track)), Math.max(0, Math.min(5, Math.round(num(values.page, 1)))), values)[i] ?? null;

const levelBinding = ({ values }: PanelContext) => {
  const t = Math.round(num(values.track));
  return t === FX_TRACK ? 'fx_cmp_vol' : `${TRACKS[t].id}_trk_lev`;
};

const knobs: PanelElement[] = [
  ...ENC_Y.flatMap((y, r) => ENC_X.map((x, c): PanelElement => ({
    kind: 'knob', control: encoderBinding(r * 4 + c), x, y, diameter: ENC_D, variant: 'elektron', label: 'none', value: 'never',
  }))),
  ...ENC_Y.flatMap((y, r) => ENC_X.map((x, c): PanelElement => ({
    kind: 'label', text: 'ABCDEFGH'[r * 4 + c], x, y: y + ENC_D / 2 + 3.2, size: 9, color: RY.sub, weight: 600,
  }))),
  { kind: 'knob', control: 'main_volume', x: 25.2, y: 16.7, diameter: 11.5, variant: 'moog-black', label: 'none', value: 'hover' },
  { kind: 'label', text: 'Main Volume', x: 25.2, y: 26.4, size: 8.5, color: RY.sub, weight: 600 },
  { kind: 'knob', control: 'qper', x: 116.5, y: 16.7, diameter: 10.5, variant: 'moog-black', label: 'none', value: 'hover' },
  { kind: 'label', text: 'Quick Perf Amount', x: 116.5, y: 26.4, size: 8.5, color: RY.sub, weight: 600 },
  { kind: 'knob', control: levelBinding, x: 161.9, y: 16.7, diameter: 11.5, variant: 'elektron', label: 'none', value: 'hover' },
  { kind: 'label', text: 'Track Level', x: 161.9, y: 25.9, size: 8.5, color: '#d8d8d8', weight: 700 },
];

// ----------------------------------------------------------------------------
// Sequencer UI kit: trig keys, page LEDs, overlays
// ----------------------------------------------------------------------------

const TRIG_X0 = 26.6;
const TRIG_PITCH = 20.48;
const TRIG_SIZE = 17;
const TRIG_Y = 173.4;

const sequencer: PanelElement[] = [
  {
    kind: 'custom', x: TRIG_X0 - TRIG_SIZE / 2, y: TRIG_Y - TRIG_SIZE / 2, w: TRIG_PITCH * 15 + TRIG_SIZE, h: TRIG_SIZE,
    render: ctx => {
      const rec = Math.round(num(ctx.values.rec, 1));
      const mode = (ctx.ui.trigMode as 'trig' | 'accent' | 'pslide' | undefined) ?? 'trig';
      return (
        <div className="rytm-trigs" style={{ position: 'absolute', inset: 0, ['--rytm-trig-gap' as string]: `${(TRIG_PITCH - TRIG_SIZE) * PX}px` }}>
          <TrigKeys ctx={ctx} tracks={SEQ_TRACKS} trackNames={TRACK_NAMES} editable={rec > 0} mode={mode} color="#ff3b2a" longPressMs={550} />
        </div>
      );
    },
  },
  ...TRACKS.map((t, i): PanelElement => ({ kind: 'label', text: t.name, x: TRIG_X0 + i * TRIG_PITCH, y: TRIG_Y + TRIG_SIZE / 2 + 3.6, size: 9, color: '#d8d8d8', weight: 700 })),
  { kind: 'label', text: 'FX', x: TRIG_X0 + 12 * TRIG_PITCH, y: TRIG_Y + TRIG_SIZE / 2 + 3.6, size: 8, color: RY.sub, weight: 600 },
  { kind: 'custom', x: 344.0, y: 160.6, w: 21.0, h: 6.2, render: ctx => <PageLeds ctx={ctx} /> },
  ...['1:4', '2:4', '3:4', '4:4'].map((t, i): PanelElement => ({ kind: 'label', text: t, x: 346.3 + i * 5.25, y: 158.0, size: 6.5, color: RY.sub, weight: 600 })),
  // Pattern-mode LEDs over BANK A-D (FUNC + BANK A-D sets them)
  ...MODE_LED_NAMES.map((n, i): PanelElement => ({
    kind: 'led', x: BANK_X[i], y: 117.0, size: 2.2, color: '#ff3b2a',
    on: ctx => (asProject(ctx.data, SEQ_TRACKS).changeMode === CHANGE_MODES[i] ? 1 : 0),
  })),
  ...MODE_LED_NAMES.map((n, i): PanelElement => ({ kind: 'label', text: n, x: BANK_X[i], y: 121.0, size: 7, color: RY.sub, weight: 600 })),
  {
    kind: 'custom', x: 0, y: 0, w: 1, h: 1,
    render: ctx => (
      <>
        <RytmStyles />
        <TrigEditor ctx={ctx} tracks={SEQ_TRACKS} portal portalPlacement="top" trackNames={TRACK_NAMES} features={{ retrig: true, accent: true, slide: false, pslide: true }}
          lockLabel={k => describe(`bd_${k}`, 0)?.abbr ?? describe(`fx_${k}`, 0)?.abbr ?? k.toUpperCase()}
          noteFormat={n => `${n - 60 >= 0 ? '+' : ''}${n - 60}`} noteRange={[36, 84]} />
        <PatternPicker ctx={ctx} tracks={SEQ_TRACKS} portal />
        <ChainBuilder ctx={ctx} tracks={SEQ_TRACKS} portal />
        <SongEditor ctx={ctx} tracks={SEQ_TRACKS} portal trackNames={TRACK_NAMES} />
        <ScaleMenu ctx={ctx} tracks={SEQ_TRACKS} portal trackNames={TRACK_NAMES} />
        <Menus ctx={ctx} />
      </>
    ),
  },
];

// ----------------------------------------------------------------------------
// Decor: rear-panel legends, screen window, logo, the mode-key line
// ----------------------------------------------------------------------------

const REAR = ['Headphones', 'Main L', 'Main R', 'BD', 'SD', 'RS/CP', 'BT', 'LT', 'MT/HT', 'CH/OH', 'CY/CB', 'Audio In', 'MIDI In', 'MIDI Out / Sync A', 'MIDI Thru / Sync B', 'Control In', 'USB', 'DC In', 'Power'];

const decor: PanelElement[] = [
  ...REAR.map((t, i): PanelElement => ({ kind: 'label', text: t, x: 12 + i * 19.0, y: 3.4, size: 6.5, color: '#6f7277', weight: 600, align: 'left' })),
  // Elektron logo mark (top right)
  { kind: 'section', x: 370.5, y: 9.5, w: 6.5, h: 6.5, border: '1.6px solid #d0d0d0', radius: 0.6 },
  { kind: 'label', text: '◢', x: 373.9, y: 12.9, size: 11, color: '#d0d0d0' },
  // The line joining PLAY .. PERF
  { kind: 'section', x: MODE_X[0], y: ROW2 - 0.25, w: MODE_X[4] - MODE_X[0], h: 0.5, background: '#3b3d41', radius: 0 },
  // Screen window
  { kind: 'section', x: 175.0, y: 8.8, w: 92.0, h: 62.4, background: 'linear-gradient(180deg, #0b0c0d 0%, #050505 100%)', border: '1px solid #2b2c2f', radius: 2.2 },
  { kind: 'label', text: '8 Voice Analog Drum Computer & Sampler', x: 221.0, y: 13.0, size: 8.5, color: '#d6d6d6', weight: 600 },
  { kind: 'label', text: 'Analog Rytm', x: 216.0, y: 64.4, size: 17, color: '#e6e6e6', weight: 800, align: 'right', letterSpacing: -0.4 },
  { kind: 'label', text: 'MKII', x: 217.2, y: 64.4, size: 17, color: '#c9c9c9', weight: 300, align: 'left', letterSpacing: 0.2 },
  { kind: 'label', text: 'Sound Browser', x: 161.9, y: 29.3, size: 8, color: RY.sub, weight: 600 },
  { kind: 'section', x: 154.5, y: 31.2, w: 14.8, h: 0.25, background: RY.sub, radius: 0 },
];

const screen: PanelElement = { kind: 'custom', x: 179.6, y: 16.6, w: 82.8, h: 42.4, render: ctx => <Screen ctx={ctx} /> };
const pads: PanelElement = { kind: 'custom', x: 49.7, y: 57.2, w: 117.4, h: 99, render: ctx => <Pads ctx={ctx} /> };

export const ANALOG_RYTM_LAYOUT: PanelLayout = {
  width: W,
  height: H,
  pxPerMm: PX,
  theme: {
    background: 'linear-gradient(180deg, #141516 0%, #101112 60%, #0c0d0e 100%)',
    text: '#e6e6e6',
    muted: RY.sub,
    font: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    frame: { padding: 2.6, background: '#070708', radius: 4 },
  },
  elements: [...decor, pads, screen, ...keys(), ...knobs, ...sequencer],
};

// The classic JSX transform (tsx scripts) needs React in scope
void React;
