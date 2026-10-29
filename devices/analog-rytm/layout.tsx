// ============================================================================
// Analog Rytm MKII panel layout (mm from the faceplate's top-left)
//
// Labels and key functions follow the Rytm MKII manual (OS 1.72), 3.1 FRONT
// PANEL (pp.10-11), the quick keys (pp.74-75) and the chapters they point to.
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
import { ChainBuilder, PatternPicker, ScaleMenu, SongEditor, TrigEditor, TrigKeys, pressPlay, pressStop, seqStateOf, trigModeOf } from '@/components/sequencer';
import {
  CHANGE_MODES, LOCK_LIMIT_RYTM, asProject, getPattern, reloadPattern, savePattern, setChangeMode, setPlayMode, trackLength, type ChangeMode,
} from '@/lib/sequencer/elektron';
import { FX_TRACK, PAGE, SEQ_TRACKS, TRACKS, pageControls, describe } from './model';
import {
  Key, Menus, PageLeds, Pads, PlayTrigs, RY, RytmStyles, Screen, applyMutePreselect, flash, funcOn, nudgeHeld, nudgeSwing, openMenu,
  pageReloadOrRandom, reloadKit, reloadSound, saveKit, shiftTrack, toggleHeldFlag, toggleHeldMute, trackClear, trackCopy, trackPaste, consumeFunc,
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
  if (func && funcOn(ctx)) { consumeFunc(ctx); func(); } else normal();
};

const closeAll = (ctx: CustomRenderContext) =>
  ctx.setUi({ rytmMenu: null, seqMenu: null, sceneEdit: null, perfEdit: null, trigEditor: null, trkLatch: false, qperLatch: false, heldSteps: [] });

/** A second press within 350 ms (pointer timing: no dblclick on touch) */
function doublePress(ctx: CustomRenderContext, key: string): boolean {
  const now = Date.now();
  const last = num(ctx.ui[key]);
  ctx.setUi({ [key]: now });
  return now - last < 350;
}

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
  sampling: icon(<><path d="M5 10 V14" /><path d="M8.5 7 V17" /><path d="M12 4.5 V19.5" /><path d="M15.5 7 V17" /><path d="M19 10 V14" /></>),
  gear: icon(<><circle cx={12} cy={12} r={3.2} /><path d="M12 3.5 V6 M12 18 V20.5 M3.5 12 H6 M18 12 H20.5 M6 6 L7.8 7.8 M16.2 16.2 L18 18 M6 18 L7.8 16.2 M16.2 7.8 L18 6" /></>),
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

/** [YES] / [NO] + a mode key: quick save / reload (manual p.51) */
function quickSaveReload(ctx: CustomRenderContext, mode: number): boolean {
  const yes = !!ctx.ui.yesHeld, no = !!ctx.ui.noHeld;
  if (!yes && !no) return false;
  ctx.setUi({ yesNoUsed: true });
  if (mode === 0) { if (yes) saveKit(ctx); else reloadKit(ctx); return true; }
  if (mode === 1) { if (yes) flash(ctx, 'THE SOUND IS KEPT IN THE KIT ([YES] + [PLAY] SAVES IT)'); else reloadSound(ctx); return true; }
  if (mode === 3) {
    // [YES] + [SCNE]: SAVE PATTERN (the restore point); [NO] + [SCNE]: RELOAD PATTERN (manual p.43)
    ctx.updateData(d => (yes ? savePattern : reloadPattern)(asProject(d, SEQ_TRACKS)));
    flash(ctx, yes ? `PATTERN ${projectOf(ctx).active} SAVED` : `PATTERN ${projectOf(ctx).active} RELOADED`);
    return true;
  }
  flash(ctx, `${mode === 2 ? 'TRACKS' : 'SONGS'} ARE SAVED AUTOMATICALLY IN THIS TWIN`);
  return true;
}

function modeDown(ctx: CustomRenderContext, mode: number, menu: string) {
  if (quickSaveReload(ctx, mode)) return;
  if (funcOn(ctx)) { consumeFunc(ctx); modeFunc(ctx, menu); return; }
  const cur = Math.round(num(ctx.values.pad_mode));
  // in an edit, the key ends it
  if (mode === 3 && typeof ctx.ui.sceneEdit === 'number') { ctx.setUi({ sceneEdit: null }); return; }
  if (mode === 4 && typeof ctx.ui.perfEdit === 'number') { ctx.setUi({ perfEdit: null }); return; }
  ctx.setUi({ modeHeld: mode, modeAt: Date.now(), modeWasOn: cur === mode });
  if (cur !== mode) ctx.setValue('pad_mode', mode);
  if (mode === 3 || mode === 4) {
    // hold [SCNE] / [PERF] for a moment: scene / performance edit
    const at = Date.now();
    setTimeout(() => {
      if (ctx.ui.modeHeld !== mode || num(ctx.ui.modeAt) !== at) return;
      const idx = mode === 3 ? Math.max(0, num(ctx.engine.scene, 0)) : 0;
      ctx.setUi(mode === 3 ? { sceneEdit: idx, perfEdit: null, modeHeld: null } : { perfEdit: idx, sceneEdit: null, modeHeld: null });
      flash(ctx, mode === 3 ? `SCENE ${idx + 1} EDIT: TAP A PAD, TURN ENCODERS` : `PERF ${idx + 1} EDIT: TAP A PAD, TURN ENCODERS`);
    }, 550);
  }
}

function modeUp(ctx: CustomRenderContext, mode: number) {
  if (ctx.ui.modeHeld !== mode) return;
  // a press on the lit mode key switches it off (back to PLAY)
  if (ctx.ui.modeWasOn && mode !== 0) ctx.setValue('pad_mode', 0);
  ctx.setUi({ modeHeld: null });
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

/** The trig-key menu each of [FUNC] + [BANK E-H] opens (manual pp.49-50) */
const BANK_TRIG_MODE: Record<number, string> = { 4: 'trigmute', 5: 'accent', 6: 'swing', 7: 'pslide' };

function bankPress(ctx: CustomRenderContext, b: number) {
  // a held trig + [BANK E] / [BANK F] / [BANK H]: trig mute / accent / parameter slide on it (manual pp.49-51)
  if ((b === 4 && toggleHeldMute(ctx)) || (b === 5 && toggleHeldFlag(ctx, 'accent')) || (b === 7 && toggleHeldFlag(ctx, 'pslide'))) return;
  press(ctx, () => ctx.setUi({ seqMenu: 'pattern', seqBank: b, rytmMenu: null }), () => {
    if (b < 4) {
      ctx.updateData(d => setChangeMode(asProject(d, SEQ_TRACKS), CHANGE_MODES[b] as ChangeMode));
      flash(ctx, `PATTERN MODE: ${MODE_LED_NAMES[b].toUpperCase()}`);
      return;
    }
    // the same key again closes the menu: the trig keys place trigs again
    const mode = BANK_TRIG_MODE[b];
    const on = trigModeOf(ctx) === mode;
    ctx.setUi({ seqTrigMode: on ? 'trig' : mode });
    if (on) { flash(ctx, 'TRIG KEYS: TRIGS'); return; }
    const p = projectOf(ctx);
    flash(ctx, b === 4 ? 'TRIG MUTE: TRIG KEYS MUTE OR UNMUTE THE TRIGS'
      : b === 5 ? 'ACCENT: TRIG KEYS SET ACCENTS, TRACK LEVEL THE AMOUNT'
        : b === 6 ? `SWING ${getPattern(p, p.active).swing}%: TRIG KEYS PICK THE STEPS, [UP] / [DOWN] THE AMOUNT`
          : 'TRIG KEYS: PARAMETER SLIDE');
  });
}

/** [FX] + [NO]: every FX track parameter back to the stored kit */
function fxReload(ctx: CustomRenderContext) {
  const prev = Math.round(num(ctx.values.page, 1));
  for (let pg = 1; pg <= 5; pg++) { ctx.setValue('page', pg); pageReloadOrRandom(ctx, pg, false); }
  ctx.setValue('page', prev);
  flash(ctx, 'FX TRACK RELOADED');
}

/**
 * The arrow keys outside menus: with a trig held, LEFT / RIGHT micro-time it and UP / DOWN
 * set its retrig; [FUNC] + LEFT / RIGHT shift the track's trigs (GRID RECORDING); in CHRO
 * mode UP / DOWN change the octave; [RTRG] held, UP / DOWN change the retrig rate;
 * otherwise LEFT / RIGHT nudge the tempo -10 % / +10 % while held (manual p.38).
 */
function arrow(ctx: CustomRenderContext, dir: 'up' | 'down' | 'left' | 'right') {
  const horiz = dir === 'left' || dir === 'right';
  const d = dir === 'right' || dir === 'up' ? 1 : -1;
  const f = funcOn(ctx);
  if (nudgeHeld(ctx, horiz ? 'micro' : 'retrig', d)) { if (f) consumeFunc(ctx); return; }
  if (f) {
    consumeFunc(ctx);
    if (horiz && Math.round(num(ctx.values.rec)) === 1) { shiftTrack(ctx, d); return; }
  }
  if (trigModeOf(ctx) === 'swing' && !horiz) { nudgeSwing(ctx, d); return; }
  if ((ctx.ui.rtrgHeld || ctx.ui.rtrgLatch) && !horiz) {
    const t = Math.min(11, Math.round(num(ctx.values.track)));
    const id = `${TRACKS[t].id}_rtrg_rate`;
    const v = Math.max(0, Math.min(16, Math.round(num(ctx.values[id], 9)) + d));
    ctx.setValue(id, v);
    flash(ctx, `${TRACKS[t].name} RETRIG 1/${[1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64, 80][v]}`);
    return;
  }
  if (num(ctx.values.pad_mode) === 2 && !horiz) {
    const o = Math.max(-2, Math.min(1, num(ctx.ui.octave) + d));
    ctx.setUi({ octave: o });
    flash(ctx, `CHROMATIC OCTAVE ${o > 0 ? '+' : ''}${o}`);
    return;
  }
  if (horiz) {
    const synced = !!(ctx.engine.seq as { following?: boolean } | undefined)?.following;
    if (synced) { flash(ctx, 'FOLLOWING THE STUDIO CLOCK: NO TEMPO NUDGE'); return; }
    const bpm = num(ctx.ui.nudgeFrom, 0) || num(ctx.values.bpm, 120);
    ctx.setUi({ nudgeFrom: bpm });
    ctx.setValue('bpm', Math.round(bpm * (1 + 0.1 * d) * 10) / 10);
    flash(ctx, `TEMPO ${d > 0 ? '+' : '-'}10 %`);
  }
}

/** Releasing LEFT / RIGHT ends a tempo nudge */
function arrowUp(ctx: CustomRenderContext) {
  const from = num(ctx.ui.nudgeFrom, 0);
  if (from > 0) { ctx.setValue('bpm', from); ctx.setUi({ nudgeFrom: 0 }); }
}

function keys(): PanelElement[] {
  const out: PanelElement[] = [];
  // --- Top row: SAMPLING, QPER ------------------------------------------------
  out.push(key(55.0, 17.1, SMALL, ctx => <Key ctx={ctx} id="key:sampling" label={I.sampling} title="SAMPLING" sub="Direct" funcSub onDown={() => flash(ctx, 'SAMPLING IS NOT MODELLED. THE SMPL PAGE PLAYS SYNTHESIZED ONE-SHOTS')} />));
  out.push(key(90.7, 17.1, SMALL, ctx => {
    const muted = !!ctx.engine.perfMuted;
    const choosing = !!ctx.ui.qperHeld || !!ctx.ui.qperLatch;
    return <Key ctx={ctx} id="key:qper" label="QPER" sub="Mute" funcSub lit={choosing ? 1 : muted ? 0 : 0.45} blink={!!ctx.ui.qperLatch} ledColor={RY.green}
      title="Hold [QPER] and press pads (or trig keys 1-12) to choose the macros of the QUICK PERF AMOUNT knob; [FUNC] + [QPER] mutes the macros"
      onDown={() => press(ctx, () => ctx.setUi({ qperHeld: true, qperAt: Date.now(), qperList: ctx.ui.qperLatch ? ctx.ui.qperList : [] }), () => {
        ctx.sendEvent('perf:mute');
        flash(ctx, muted ? 'PERFORMANCE MACROS ON' : 'PERFORMANCE MACROS MUTED');
      })}
      onUp={() => {
        if (!ctx.ui.qperHeld) return;
        const list = (ctx.ui.qperList as number[] | undefined) ?? [];
        const tap = Date.now() - num(ctx.ui.qperAt) < 350;
        if (tap && !list.length && !ctx.ui.qperLatch) { ctx.setUi({ qperHeld: false, qperLatch: true }); flash(ctx, 'QPER: TAP PADS FOR THE QUICK PERF KNOB, THEN [QPER]'); return; }
        if (list.length || ctx.ui.qperLatch) {
          ctx.sendEvent('perf:assign', { list });
          flash(ctx, list.length ? `QUICK PERF AMOUNT: MACRO ${list.map(x => x + 1).join(' ')}` : 'QUICK PERF: NO MACROS');
        }
        ctx.setUi({ qperHeld: false, qperLatch: false, qperList: [] });
      }} />;
  }));
  // --- Mode row ------------------------------------------------------------------
  out.push(key(26.2, ROW2, SMALL, ctx => <Key ctx={ctx} id="key:global" label={I.gear} title="GLOBAL SETTINGS" sub="Save Project" funcSub onDown={() => press(ctx, () => flash(ctx, 'GLOBAL SETTINGS ARE NOT MODELLED'), () => flash(ctx, 'THE PROJECT SAVES AUTOMATICALLY'))} />));
  MODE_KEYS.forEach(([label, sub, menu, mode], i) => out.push(key(MODE_X[i], ROW2, SMALL, ctx => (
    <Key ctx={ctx} id={`key:${label.toLowerCase()}`} label={label} sub={sub} funcSub
      lit={Math.round(num(ctx.values.pad_mode)) === mode ? 1 : (mode === 1 && (projectOf(ctx).mutes ?? []).length > 0) || (mode === 3 && num(ctx.engine.scene, -1) >= 0) ? 0.35 : 0}
      blink={(mode === 3 && typeof ctx.ui.sceneEdit === 'number') || (mode === 4 && typeof ctx.ui.perfEdit === 'number')}
      ledColor={mode === 0 ? RY.green : RY.led} control="pad_mode" value={mode}
      onDown={() => modeDown(ctx, mode, menu)} onUp={() => modeUp(ctx, mode)} />
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
    onUp={() => { applyMutePreselect(ctx); ctx.setUi(ctx.ui.funcUsed ? { func: false } : { func: false, funcLatch: !ctx.ui.funcLatch }); }}
    capStyle={{ fontSize: 'var(--rytm-func-font, 11px)' }} title="Hold (or tap) FUNC, then press a key for its second function" />, true));
  out.push(key(26.6, 111.3, SMALL, ctx => <Key ctx={ctx} id="key:trk" label="TRK" sub="Save Kit" funcSub lit={!!ctx.ui.trkHeld || !!ctx.ui.trkLatch}
    onDown={() => press(ctx, () => {
      if (doublePress(ctx, 'trkTap')) { ctx.setUi({ trkHeld: false, trkLatch: false }); openMenu(ctx, 'sound'); return; }
      ctx.setUi({ trkHeld: true, trkAt: Date.now() });
    }, () => saveKit(ctx))}
    onUp={() => { if (!ctx.ui.trkHeld) return; const tap = Date.now() - num(ctx.ui.trkAt) < 350; ctx.setUi({ trkHeld: false, trkLatch: tap ? !ctx.ui.trkLatch : false }); }} />));
  out.push(key(26.6, 145.0, SMALL, ctx => <Key ctx={ctx} id="key:rtrg" label="RTRG" sub="Metronome" funcSub lit={!!ctx.ui.rtrgHeld || !!ctx.ui.rtrgLatch} ledColor={RY.amber}
    onDown={() => press(ctx, () => ctx.setUi({ rtrgHeld: true, rtrgAt: Date.now(), rytmMenu: 'retrig' }), () => flash(ctx, 'THE CLICK TRACK (METRONOME) IS NOT MODELLED'))}
    onUp={() => {
      if (!ctx.ui.rtrgHeld) return;
      // a tap latches RTRG (pads roll until the next tap); a hold shows the RETRIG menu while held
      const tap = Date.now() - num(ctx.ui.rtrgAt) < 350;
      const latch = tap ? !ctx.ui.rtrgLatch : false;
      ctx.setUi({ rtrgHeld: false, rtrgLatch: latch, rytmMenu: latch ? 'retrig' : null });
      if (latch) flash(ctx, 'RETRIG ON: PADS ROLL WHILE HELD');
    }} />));
  // --- YES / NO / arrows ------------------------------------------------------------
  // [YES] / [NO]: confirm / back; held with a mode key they save / reload (with a mouse: [FUNC] + [YES] = KIT menu, [FUNC] + [NO] = reload kit)
  out.push(key(197.2, 79.6, SMALL, ctx => <Key ctx={ctx} id="key:yes" label="YES" sub="Save" lit={!!ctx.ui.yesHeld}
    onDown={() => press(ctx, () => ctx.setUi({ yesHeld: true, yesNoUsed: false }), () => openMenu(ctx, 'kit'))}
    onUp={() => { if (!ctx.ui.yesHeld) return; const used = !!ctx.ui.yesNoUsed; ctx.setUi({ yesHeld: false }); if (!used) closeAll(ctx); }} />));
  out.push(key(197.2, 97.2, SMALL, ctx => <Key ctx={ctx} id="key:no" label="NO" sub="Reload" lit={!!ctx.ui.noHeld}
    onDown={() => press(ctx, () => ctx.setUi({ noHeld: true, yesNoUsed: false }), () => reloadKit(ctx))}
    onUp={() => { if (!ctx.ui.noHeld) return; const used = !!ctx.ui.yesNoUsed; ctx.setUi({ noHeld: false }); if (!used) closeAll(ctx); }} />));
  out.push(key(228.8, 79.6, SMALL, ctx => <Key ctx={ctx} id="key:up" label={I.up} sub="Retrig +" onDown={() => arrow(ctx, 'up')} />));
  out.push(key(213.1, 97.2, SMALL, ctx => <Key ctx={ctx} id="key:left" label={I.left} sub="µTime -" onDown={() => arrow(ctx, 'left')} onUp={() => arrowUp(ctx)} />));
  out.push(key(228.8, 97.2, SMALL, ctx => <Key ctx={ctx} id="key:down" label={I.down} sub="Retrig -" onDown={() => arrow(ctx, 'down')} />));
  out.push(key(244.8, 97.2, SMALL, ctx => <Key ctx={ctx} id="key:right" label={I.right} sub="µTime +" onDown={() => arrow(ctx, 'right')} onUp={() => arrowUp(ctx)} />));
  // --- PARAMETER keys ------------------------------------------------------------------
  PARAM_KEYS.forEach(([label, fx, func], i) => out.push(key(PARAM_X[i], ROW_PARAM, SMALL, ctx => (
    <Key ctx={ctx} id={`key:${label.toLowerCase()}`} label={label} sub={func} sub2={fx} funcSub lit={Math.round(num(ctx.values.page, 1)) === i} control="page" value={i}
      onDown={() => {
        if (ctx.ui.yesHeld || ctx.ui.noHeld) { ctx.setUi({ yesNoUsed: true }); ctx.setValue('page', i); pageReloadOrRandom(ctx, i, !!ctx.ui.yesHeld); return; }
        press(ctx, () => {
          // a quick double press on [SRC] opens the MACHINE menu
          if (i === 1 && Math.round(num(ctx.values.track)) !== FX_TRACK && doublePress(ctx, 'srcTap')) { openMenu(ctx, 'sound'); return; }
          ctx.setValue('page', i);
        }, func ? () => {
          if (i === 0) { const q = num(ctx.values.quantize, 1) > 0 ? 0 : 1; ctx.setValue('quantize', q); flash(ctx, q ? 'TRIGS SETUP: LIVE RECORDING QUANTIZED' : 'TRIGS SETUP: LIVE RECORDING KEEPS MICRO TIMING'); }
          else if (i === 1 || i === 3) openMenu(ctx, 'sound');
          else if (i === 2) openMenu(ctx, 'samples');
        } : undefined);
      }} />
  ))));
  out.push(key(353.8, 103.2, SMALL, ctx => <Key ctx={ctx} id="key:fx" label="FX" sub="MIDI Config" funcSub lit={Math.round(num(ctx.values.track)) === FX_TRACK} control="track" value={FX_TRACK} ledColor={RY.amber}
    onDown={() => {
      if (ctx.ui.noHeld) { ctx.setUi({ yesNoUsed: true }); fxReload(ctx); return; }
      if (ctx.ui.qperHeld) return;
      press(ctx, () => ctx.setValue('track', FX_TRACK), () => flash(ctx, 'MIDI CONFIG IS NOT MODELLED'));
    }} />));
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
      const menuOpen = !!BANK_TRIG_MODE[b] && trigModeOf(ctx) === BANK_TRIG_MODE[b];
      return <Key ctx={ctx} id={`key:bank:${'ABCDEFGH'[b]}`} label={'ABCDEFGH'[b]} sub={BANK_SUB[b] || undefined} funcSub lit={menuOpen ? 1 : active ? 0.7 : 0}
        ledColor={menuOpen ? (b === 4 ? RY.green : b === 5 ? RY.purple : b === 6 ? RY.yellow : RY.blue) : undefined} focusIds={[`seq:bank:${'ABCDEFGH'[b]}`, 'seq:patterns']}
        onDown={() => bankPress(ctx, b)} />;
    }));
  }
  // --- Transport -----------------------------------------------------------------------
  out.push(key(282.7, 141.7, BIG, ctx => {
    const rec = Math.round(num(ctx.values.rec, 1));
    return <Key ctx={ctx} id="key:rec" big label={I.rec} sub="Copy" funcSub lit={rec > 0} blink={rec === 2} control="rec"
      onDown={() => press(ctx, () => { ctx.setUi({ recHeld: true }); ctx.setValue('rec', rec === 1 ? 0 : 1); }, () => trackCopy(ctx))}
      onUp={() => ctx.setUi({ recHeld: false })} />;
  }, true));
  out.push(key(303.2, 141.7, BIG, ctx => {
    const st = ctx.engine.seq as { paused?: boolean; following?: boolean } | undefined;
    const playing = !!ctx.engine.playing;
    const paused = !!st?.paused;
    return <Key ctx={ctx} id="key:play" big label={I.play} sub="Clear" funcSub lit={playing || paused} blink={paused} ledColor={RY.green} control="play" focusIds={['seq:play']}
      onDown={() => press(ctx, () => {
        // [RECORD] + [PLAY]: LIVE RECORDING (and play); [PLAY] during it leaves it and keeps playing (manual p.40)
        if (ctx.ui.recHeld) { ctx.setValue('rec', 2); flash(ctx, 'LIVE RECORDING: PLAY THE PADS'); if (!playing) pressPlay(ctx); return; }
        if (playing && Math.round(num(ctx.values.rec)) === 2) { ctx.setValue('rec', 0); flash(ctx, 'LIVE RECORDING OFF'); return; }
        // stopped: play; playing: pause; paused: resume (manual p.37). Synced, it plays / stops the studio.
        if (playing && !seqStateOf(ctx.engine)?.following) flash(ctx, 'PAUSED: [PLAY] RESUMES, [STOP] STOPS');
        pressPlay(ctx);
      }, () => trackClear(ctx))} />;
  }, true));
  out.push(key(323.8, 141.7, BIG, ctx => <Key ctx={ctx} id="key:stop" big label={I.stop} sub="Paste" funcSub control="play" focusIds={['seq:stop']}
    onDown={() => press(ctx, () => {
      if (ctx.ui.recHeld) { flash(ctx, 'STEP RECORDING IS NOT IN THIS TWIN YET: USE GRID RECORDING'); return; }
      const st = seqStateOf(ctx.engine);
      const twice = doublePress(ctx, 'stopTap') && !st?.playing && !st?.paused;
      pressStop(ctx);
      // [STOP] ends LIVE RECORDING as well as the playback (manual p.40)
      if (Math.round(num(ctx.values.rec)) === 2) ctx.setValue('rec', 0);
      // [STOP] twice: the delay and reverb fade out too (manual p.37)
      if (twice) { ctx.sendEvent('rytm:fx-off'); flash(ctx, 'SEND FX OFF'); }
    }, () => trackPaste(ctx))} />, true));
  out.push(key(353.8, 145.2, SMALL, ctx => {
    const st = ctx.engine.seq as { fill?: boolean; fillCued?: boolean } | undefined;
    return <Key ctx={ctx} id="key:fill" label="FILL" sub="Cue Fill" funcSub lit={!!st?.fill} blink={!!st?.fillCued} ledColor={RY.yellow} focusIds={['seq:fill']}
      onDown={() => press(ctx, () => {
        if ((st as { fillLatched?: boolean } | undefined)?.fillLatched) { ctx.sendEvent('seq:fill-latch', { on: false }); return; }
        ctx.setUi({ fillHeld: true }); ctx.sendEvent('seq:fill');
      }, () => {
        // [FUNC] + [FILL] cues a fill for one cycle; [FUNC] + [FILL] twice latches it
        if (doublePress(ctx, 'fillTap')) { ctx.sendEvent('seq:fill-latch', { on: true }); flash(ctx, 'FILL LATCHED: [FILL] RELEASES IT'); }
        else ctx.sendEvent('seq:fill-cue');
      })}
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
export const encoderBinding = (i: number) => ({ values, ui }: PanelContext) =>
  pageControls(Math.round(num(values.track)), Math.max(0, Math.min(5, Math.round(num(values.page, 1)))), values, ui)[i] ?? null;

const levelBinding = ({ values, ui }: PanelContext) => {
  const t = Math.round(num(values.track));
  if (t === FX_TRACK) return 'fx_trk_lev';
  return (ui as Record<string, unknown> | undefined)?.seqTrigMode === 'accent' ? `${TRACKS[t].id}_acc_lev` : `${TRACKS[t].id}_trk_lev`;
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
      const rec = Math.round(num(ctx.values.rec, 0));
      const mode = trigModeOf(ctx);
      const gap = { ['--rytm-trig-gap' as string]: `${(TRIG_PITCH - TRIG_SIZE) * PX}px` };
      const editing = rec > 0 || mode !== 'trig';
      return (
        <div className="rytm-trigs" style={{ position: 'absolute', inset: 0, ...gap }}>
          {editing
            ? <TrigKeys ctx={ctx} tracks={SEQ_TRACKS} trackNames={TRACK_NAMES} editable color="#ff3b2a" longPressMs={550} />
            : <PlayTrigs ctx={ctx} />}
        </div>
      );
    },
  },
  ...TRACKS.map((t, i): PanelElement => ({ kind: 'label', text: t.name, x: TRIG_X0 + i * TRIG_PITCH, y: TRIG_Y + TRIG_SIZE / 2 + 3.6, size: 9, color: '#d8d8d8', weight: 700 })),
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
        <TrigEditor ctx={ctx} tracks={SEQ_TRACKS} portal portalPlacement="top" trackNames={TRACK_NAMES} features={{ retrig: true, accent: true, slide: false, pslide: true, trigMute: true }} lockLimit={LOCK_LIMIT_RYTM}
          lockLabel={k => describe(`bd_${k}`, 0)?.abbr ?? describe(`fx_${k}`, 0)?.abbr ?? k.toUpperCase()}
          noteFormat={n => `${n - 60 >= 0 ? '+' : ''}${n - 60}`} noteRange={[36, 84]} />
        <PatternPicker ctx={ctx} tracks={SEQ_TRACKS} portal />
        <ChainBuilder ctx={ctx} tracks={SEQ_TRACKS} portal />
        <SongEditor ctx={ctx} tracks={SEQ_TRACKS} portal trackNames={TRACK_NAMES} loop={false} length={false} tempo={false} />
        <ScaleMenu ctx={ctx} tracks={SEQ_TRACKS} portal trackNames={TRACK_NAMES} />
        <Menus ctx={ctx} />
      </>
    ),
  },
];

// ----------------------------------------------------------------------------
// Decor: rear-panel legends, screen window, logo, the mode-key line
// ----------------------------------------------------------------------------

const REAR = ['Headphones', 'Main Out', 'Ext In', 'BD', 'SD', 'RS/CP', 'BT', 'LT', 'MT/HT', 'CH/OH', 'CY/CB', 'Audio In', 'MIDI In', 'MIDI Out / Sync A', 'MIDI Thru / Sync B', 'Control In', 'USB', 'DC In', 'Power'];

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
