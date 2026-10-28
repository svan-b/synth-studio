'use client';
// ============================================================================
// Analog Four MKII - panel pieces (custom layout elements)
//
//   PanelKey      every key of the panel: printed label, FUNC legend under it,
//                 RGB backlight, the key's function and its [FUNC] combination
//   LedStrip      PATTERN MODE, OCTAVE and PATTERN PAGE LEDs
//   MiniKeyboard  the 13-key keyboard (plays the active track; with a trig held
//                 it sets the trig's note; with [TRNS] held it transposes)
//   Screen        the OLED
//   TrigArea      the 16 trig keys: trigs (the sequencer UI kit's TrigKeys),
//                 patterns while a [BANK] key is active, macros with [QPER]
//   Menus         the kit's pattern / song / chain / scale / trig editors and
//                 the A4's own SOUND, KIT and GLOBAL menus (portals)
//   Helpers       loads kit projects, writes LIVE RECORDING notes, Shift = FUNC
//
// [FUNC] is held (two fingers on a touch screen) or tapped: a tap latches it
// for the next key, which is how a mouse reaches the secondary functions.
// ============================================================================

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { CustomRenderContext, PanelContext } from '@/types/panel';
import type { ControlValue } from '@/types';
import { useStudioStore } from '@/store/studio';
import { useUiStore } from '@/store/ui';
import {
  ChainBuilder, PatternPicker, ScaleMenu, SongEditor, TrigEditor, TrigKeys,
} from '@/components/sequencer';
import { C as SC, Frame, Group, Overlay, SeqButton, UI, lessonFocus, seqStateOf, viewPattern } from '@/components/sequencer/shared';
import {
  CHANGE_MODES, TRIG_CONDITIONS, asProject, clearPattern, copyPattern, formatLength, formatNote, getPattern, parsePatternId,
  pastePattern, patternHasContent, patternId, setActive, setChain, setChangeMode, setPlayMode, trackLength, updateSteps, withTrack,
  type Pattern, type Project, type Step,
} from '@/lib/sequencer/elektron';
import {
  FX_TRACK, PAGE_TITLE, PERF_MACROS, SEQ_TRACKS, SYNTH_TRACKS, TRACK_NAMES, V, VIEWS, keyOfView, levelControl, pageFor,
  pageSlots, controlFor, routeOf, trackKind, viewAfterPress, type ParamDef,
} from './params';
import { KEYS, PX_PER_MM, TRIGS, KEYBOARD, BLACK_KEYS, WHITE_OFFSETS, MODE_LEDS, OCT_LEDS, PAGE_LEDS } from './geometry';
import { SOUNDS, SOUND_CATEGORIES, type SoundDef } from './sounds';
import { KITS, KIT_PROJECT_IDS, kitValues, projectFor, soundTrackValues } from './kits';

const TRACKS = SEQ_TRACKS;
const k = PX_PER_MM;

// ----------------------------------------------------------------------------
// Colours (MKII Black edition)
// ----------------------------------------------------------------------------

export const COL = {
  panel: '#15171b',
  key: '#26282d',
  keyEdge: '#0d0e10',
  keyText: '#e9eaec',
  legend: '#8e939b',
  label: '#c9ccd1',
  red: '#ff3020',
  green: '#25d366',
  yellow: '#ffc21a',
  white: '#f3f3f3',
  blue: '#3aa0ff',
  pink: '#ff5fa8',
  cyan: '#4fd2ff',
  target: '#ff9f1c',
};

// ----------------------------------------------------------------------------
// UI state helpers
// ----------------------------------------------------------------------------

const UIK = {
  func: 'a4func',       // 'held' | 'latched' | null
  funcUsed: 'a4funcUsed',
  bank: 'a4bank',       // pattern-select mode: bank index or null
  qper: 'a4qper',
  trns: 'a4trns',
  menu: 'a4menu',       // 'sound' | 'kit' | 'global' | null
  msg: 'a4msg',
  recDown: 'a4recDown',
  clip: 'a4clip',
} as const;

const num = (v: ControlValue | undefined, d = 0) => (typeof v === 'number' ? v : typeof v === 'boolean' ? (v ? 1 : 0) : d);

function liveUi(ctx: CustomRenderContext): Record<string, unknown> {
  return useUiStore.getState().ui[ctx.instance] ?? ctx.ui;
}

function project(ctx: { data?: unknown }): Project {
  return asProject(ctx.data, TRACKS);
}

/** Show a short message on the OLED */
function say(ctx: CustomRenderContext, text: string, ms = 2200) {
  ctx.setUi({ [UIK.msg]: { text, until: Date.now() + ms } });
}

function funcActive(ctx: CustomRenderContext): boolean {
  const f = liveUi(ctx)[UIK.func];
  return f === 'held' || f === 'latched';
}

/** After a FUNC combination: a latched FUNC is used up */
function useFunc(ctx: CustomRenderContext) {
  const u = liveUi(ctx);
  if (u[UIK.func] === 'latched') ctx.setUi({ [UIK.func]: null });
  else if (u[UIK.func] === 'held') ctx.setUi({ [UIK.funcUsed]: true });
}

function setView(ctx: CustomRenderContext, view: number) {
  ctx.setValue('page', view);
}

function closeMenus(ctx: CustomRenderContext) {
  ctx.setUi({ [UI.menu]: null, [UIK.menu]: null, [UI.trigEditor]: null, [UI.heldSteps]: [], [UIK.bank]: null, [UIK.qper]: false });
}

function toggleKitMenu(ctx: CustomRenderContext, menu: 'pattern' | 'song' | 'chain' | 'scale') {
  const open = liveUi(ctx)[UI.menu] === menu;
  ctx.setUi({ [UI.menu]: open ? null : menu, [UIK.menu]: null });
}

function toggleA4Menu(ctx: CustomRenderContext, menu: 'sound' | 'kit' | 'global') {
  const open = liveUi(ctx)[UIK.menu] === menu;
  ctx.setUi({ [UIK.menu]: open ? null : menu, [UI.menu]: null });
}

const tapTimes: number[] = [];

// ----------------------------------------------------------------------------
// Keys
// ----------------------------------------------------------------------------

interface KeyEnv {
  ctx: CustomRenderContext;
  func: boolean;
  track: number;
  view: number;
  playing: boolean;
}

interface KeyDef {
  label: ReactNode;
  /** FUNC legend printed under the key (grey, underlined) */
  sub?: string;
  /** White legend rows under the PARAMETER keys (FX track page, CV track page) */
  rows?: [string, string];
  /** LED colour (null = off); dim factor 0..1 */
  led?: (e: KeyEnv) => [string, number] | null;
  press: (e: KeyEnv) => void;
  release?: (e: KeyEnv) => void;
  /** Is this the key a lesson step points at? */
  target?: (control: string | undefined, value: unknown) => boolean;
  icon?: 'rec' | 'play' | 'stop' | 'up' | 'down' | 'left' | 'right';
  aria: string;
}

const pageKey = (name: string, label: string, rows: [string, string]): KeyDef => ({
  label,
  rows,
  aria: `${label} parameter key`,
  led: e => {
    const kv = keyOfView(e.view);
    if (!kv || kv.key !== name || !pageFor(e.track, e.view)) return null;
    return kv.second ? [COL.green, 1] : [COL.red, 1];
  },
  press: e => {
    if (e.func) { setView(e.ctx, V.SOUND); useFunc(e.ctx); return; }
    if (!pageFor(e.track, V[name as keyof typeof V])) {
      say(e.ctx, `${TRACK_NAMES[e.track]} has no ${label} page`);
      return;
    }
    setView(e.ctx, viewAfterPress(name, e.track, e.view));
  },
  target: (c, v) => c === 'page' && typeof v === 'number' && keyOfView(v)?.key === name,
});

const viewKey = (name: 'ARP' | 'NOTE' | 'PERF' | 'MIX' | 'TEMPO', label: string, sub: string, funcFn?: (e: KeyEnv) => void): KeyDef => ({
  label,
  sub,
  aria: `${label} key`,
  led: e => (e.view === V[name] ? [COL.red, 1] : null),
  press: e => {
    if (e.func) { useFunc(e.ctx); if (funcFn) funcFn(e); return; }
    setView(e.ctx, V[name]);
  },
  target: (c, v) => c === 'page' && v === V[name],
});

const trackKey = (t: number): KeyDef => ({
  label: TRACK_NAMES[t],
  sub: 'MUTE',
  aria: `Track ${TRACK_NAMES[t]}`,
  led: e => {
    const pat = getPattern(project(e.ctx), viewPattern(e.ctx, project(e.ctx)));
    const muted = !!e.ctx.values[`t${t + 1}_mute`] || !!pat.tracks[t]?.mute;
    if (e.track === t) return muted ? [COL.red, 0.35] : [COL.red, 1];
    return muted ? null : [COL.green, 0.55];
  },
  press: e => {
    if (e.func) {
      const id = `t${t + 1}_mute`;
      const m = !e.ctx.values[id];
      e.ctx.setValue(id, m);
      useFunc(e.ctx);
      say(e.ctx, `${TRACK_NAMES[t]} ${m ? 'MUTED' : 'UNMUTED'}`, 1000);
      return;
    }
    e.ctx.setUi({ [UI.heldSteps]: [], [UI.trigEditor]: null });
    e.ctx.setValue('track', t);
  },
  target: (c, v) => (c === 'track' && v === t) || c === `t${t + 1}_mute`,
});

function bankKey(b: number): KeyDef {
  const letter = 'ABCDEFGH'[b];
  const subs = ['', '', '', '', 'TRIG MUTE', 'ACCENT', 'NOTE SLD', 'PARAM SLD'];
  return {
    label: letter,
    sub: subs[b] || undefined,
    aria: `Bank ${letter}`,
    led: e => {
      const u = e.ctx.ui;
      if (u[UIK.bank] === b) return [COL.red, 1];
      if (e.func && b >= 5) {
        const m = num(e.ctx.values.trig_mode);
        return m === b - 4 ? [[COL.pink, COL.yellow, COL.cyan][b - 5], 1] : [COL.white, 0.25];
      }
      const pr = project(e.ctx);
      const st = seqStateOf(e.ctx.engine);
      const playing = st?.playing && st.pattern ? parsePatternId(st.pattern)?.bank : undefined;
      if (playing === b) return [COL.green, 0.7];
      if (parsePatternId(pr.active)?.bank === b) return [COL.red, 0.45];
      return null;
    },
    press: e => {
      if (e.func) {
        useFunc(e.ctx);
        if (b < 4) {
          const mode = CHANGE_MODES[b];
          e.ctx.updateData(d => setChangeMode(asProject(d, TRACKS), mode));
          say(e.ctx, ['SEQUENTIAL', 'DIRECT START', 'DIRECT JUMP', 'TEMP JUMP'][b]);
          return;
        }
        if (b === 4) { say(e.ctx, 'TRIG MUTE: not modelled in the twin'); return; }
        const cur = num(e.ctx.values.trig_mode);
        const mode = b - 4;
        e.ctx.setValue('trig_mode', cur === mode ? 0 : mode);
        say(e.ctx, cur === mode ? 'TRIGS' : ['', 'ACCENT: tap trigs to accent them', 'NOTE SLIDE: tap trigs to slide into them', 'PARAMETER SLIDE: tap trigs'][mode]);
        return;
      }
      const cur = liveUi(e.ctx)[UIK.bank];
      e.ctx.setUi({ [UIK.bank]: cur === b ? null : b, [UIK.qper]: false });
      if (cur !== b) say(e.ctx, `BANK ${letter}: CHOOSE PTN`, 1500);
    },
    target: (c, v) => c === 'trig_mode' && v === b - 4 && b >= 5,
  };
}

const KEYDEFS: Record<string, KeyDef> = {
  GLOBAL: {
    label: 'GLOBAL', sub: 'SAVE PROJECT', aria: 'Global settings',
    led: e => (e.ctx.ui[UIK.menu] === 'global' ? [COL.red, 1] : null),
    press: e => { if (e.func) { useFunc(e.ctx); say(e.ctx, 'PROJECT SAVED (the studio keeps it)'); return; } toggleA4Menu(e.ctx, 'global'); },
  },
  QPER: {
    label: 'QPER', sub: 'MUTE', aria: 'Quick performance',
    led: e => (e.ctx.ui[UIK.qper] ? [COL.white, 1] : e.ctx.values.perf_mute ? [COL.red, 0.6] : null),
    press: e => {
      if (e.func) { useFunc(e.ctx); const m = !e.ctx.values.perf_mute; e.ctx.setValue('perf_mute', m); say(e.ctx, m ? 'PERFORMANCE MACROS MUTED' : 'MACROS ON'); return; }
      const on = !liveUi(e.ctx)[UIK.qper];
      e.ctx.setUi({ [UIK.qper]: on, [UIK.bank]: null });
      if (on) say(e.ctx, 'QUICK PERF: PICK A MACRO (TRIG 1-10)', 1800);
    },
    target: c => c === 'qper_sel' || c === 'perf_mute',
  },
  TEMPO: viewKey('TEMPO', 'TEMPO', 'TAP TEMPO', e => {
    const now = performance.now();
    if (tapTimes.length && now - tapTimes[tapTimes.length - 1] > 2000) tapTimes.length = 0;
    tapTimes.push(now);
    if (tapTimes.length > 5) tapTimes.shift();
    if (tapTimes.length >= 2) {
      const span = (tapTimes[tapTimes.length - 1] - tapTimes[0]) / (tapTimes.length - 1);
      const bpm = Math.round(Math.min(300, Math.max(30, 60000 / span)));
      e.ctx.setValue('tempo', bpm);
      say(e.ctx, `TAP ${bpm} BPM`, 1200);
    } else say(e.ctx, 'TAP AGAIN', 1200);
    e.ctx.setUi({ [UIK.func]: 'latched' }); // keep tapping
  }),
  FUNC: { label: 'FUNC', aria: 'Function', press: () => undefined, target: () => false },
  KIT: {
    label: 'KIT', sub: 'SAVE KIT', aria: 'Kit menu',
    led: e => (e.ctx.ui[UIK.menu] === 'kit' ? [COL.red, 1] : null),
    press: e => { if (e.func) { useFunc(e.ctx); say(e.ctx, 'KIT SAVED (with the project)'); return; } toggleA4Menu(e.ctx, 'kit'); },
  },
  SND: {
    label: 'SND', sub: 'SETTINGS', aria: 'Sound menu',
    led: e => (e.ctx.ui[UIK.menu] === 'sound' || e.view === V.SOUND || e.view === V.SOUND_2 ? [COL.red, 1] : null),
    press: e => {
      if (e.func) { useFunc(e.ctx); setView(e.ctx, viewAfterPress('SOUND', e.track, e.view)); return; }
      toggleA4Menu(e.ctx, 'sound');
    },
    target: (c, v) => c === 'page' && (v === V.SOUND || v === V.SOUND_2),
  },
  MIX: viewKey('MIX', 'MIX', 'POLY CONFIG', e => say(e.ctx, 'POLY CONFIG: each track keeps its own voice here')),
  PERF: viewKey('PERF', 'PERF', 'SETUP', e => say(e.ctx, 'PERF SETUP: the macros are fixed; see the PERF page')),
  TRK: {
    label: 'TRK', sub: 'METRONOME', aria: 'Track menu',
    led: e => (e.ctx.ui[UI.menu] === 'scale' ? [COL.red, 1] : null),
    press: e => { if (e.func) { useFunc(e.ctx); say(e.ctx, 'METRONOME: not modelled (use the studio click)'); return; } toggleKitMenu(e.ctx, 'scale'); },
  },
  PTN: {
    label: 'PTN', sub: 'SWING', aria: 'Pattern menu',
    led: e => (e.ctx.ui[UI.menu] === 'pattern' ? [COL.red, 1] : null),
    press: e => { if (e.func) { useFunc(e.ctx); toggleKitMenu(e.ctx, 'scale'); say(e.ctx, 'SWING is in the SCALE menu, and on the TEMPO page (knob B)'); return; } toggleKitMenu(e.ctx, 'pattern'); },
    target: c => c === 'seq:menu:pattern',
  },
  SONG: {
    label: 'SONG', sub: 'SAVE SONG', aria: 'Song menu',
    led: e => (e.ctx.ui[UI.menu] === 'song' ? [COL.red, 1] : null),
    press: e => { if (e.func) { useFunc(e.ctx); say(e.ctx, 'SONG SAVED (with the project)'); return; } toggleKitMenu(e.ctx, 'song'); },
  },
  YES: { label: 'YES', sub: 'SAVE', aria: 'Yes', press: e => { if (e.func) useFunc(e.ctx); closeMenus(e.ctx); } },
  NO: { label: 'NO', sub: 'RELOAD', aria: 'No', press: e => { if (e.func) { useFunc(e.ctx); say(e.ctx, 'RELOAD: load the kit preset again'); return; } closeMenus(e.ctx); } },
  UP: { label: '', icon: 'up', aria: 'Up', press: e => arrow(e, 0, 1) },
  DOWN: { label: '', icon: 'down', aria: 'Down', press: e => arrow(e, 0, -1) },
  LEFT: { label: '', icon: 'left', sub: 'TIME-', aria: 'Left', press: e => arrow(e, -1, 0) },
  RIGHT: { label: '', icon: 'right', sub: 'TIME+', aria: 'Right', press: e => arrow(e, 1, 0) },
  SONGMODE: {
    label: 'SONG M', sub: 'EDIT SONG', aria: 'Song mode',
    led: e => (project(e.ctx).mode === 'song' ? [COL.red, 1] : null),
    press: e => {
      if (e.func) { useFunc(e.ctx); toggleKitMenu(e.ctx, 'song'); return; }
      const pr = project(e.ctx);
      const on = pr.mode !== 'song';
      e.ctx.updateData(d => setPlayMode(asProject(d, TRACKS), on ? 'song' : 'pattern'));
      say(e.ctx, on ? (pr.song.rows.length ? 'SONG MODE: PLAY plays the song' : 'SONG MODE: the song is empty ([FUNC] + [SONG M])') : 'PATTERN MODE');
    },
    target: c => c === 'seq:mode:song',
  },
  CHAIN: {
    label: 'CHAIN', sub: 'NEW CHAIN', aria: 'Chain mode',
    led: e => (project(e.ctx).mode === 'chain' ? [COL.red, 1] : null),
    press: e => {
      if (e.func) { useFunc(e.ctx); e.ctx.updateData(d => setChain(asProject(d, TRACKS), [])); toggleKitMenu(e.ctx, 'chain'); say(e.ctx, 'NEW CHAIN: add patterns in order'); return; }
      const pr = project(e.ctx);
      const on = pr.mode !== 'chain';
      e.ctx.updateData(d => setPlayMode(asProject(d, TRACKS), on ? 'chain' : 'pattern'));
      say(e.ctx, on ? (pr.chain.length ? `CHAIN MODE: ${pr.chain.join(' ')}` : 'CHAIN MODE: the chain is empty ([FUNC] + [CHAIN])') : 'PATTERN MODE');
    },
  },
  RECORD: {
    label: '', icon: 'rec', sub: 'COPY', aria: 'Record',
    led: e => (e.ctx.values.live_rec ? [COL.red, 1] : e.ctx.values.rec ? [COL.red, 0.85] : null),
    press: e => {
      if (e.func) { useFunc(e.ctx); copyPaste(e, 'copy'); return; }
      e.ctx.setUi({ [UIK.recDown]: true });
      e.ctx.setValue('rec', !e.ctx.values.rec);
    },
    release: e => e.ctx.setUi({ [UIK.recDown]: false }),
    target: (c, v) => (c === 'rec' && typeof v === 'boolean') || c === 'live_rec',
  },
  PLAY: {
    label: '', icon: 'play', sub: 'CLEAR', aria: 'Play',
    led: e => (e.playing ? [COL.green, 1] : null),
    press: e => {
      if (e.func) { useFunc(e.ctx); copyPaste(e, 'clear'); return; }
      if (liveUi(e.ctx)[UIK.recDown]) {
        e.ctx.setValue('rec', true);
        e.ctx.setValue('live_rec', true);
        if (!e.playing) e.ctx.setValue('play', true);
        say(e.ctx, 'LIVE RECORDING: play the keyboard');
        return;
      }
      e.ctx.setValue('play', !e.playing);
    },
    target: (c, v) => c === 'play' && v === true,
  },
  STOP: {
    label: '', icon: 'stop', sub: 'PASTE', aria: 'Stop',
    led: e => (!e.playing ? [COL.white, 0.5] : null),
    press: e => {
      if (e.func) { useFunc(e.ctx); copyPaste(e, 'paste'); return; }
      e.ctx.setValue('play', false);
      if (e.ctx.values.live_rec) e.ctx.setValue('live_rec', false);
    },
    target: (c, v) => c === 'play' && v === false,
  },
  ARP: viewKey('ARP', 'ARP', 'SETUP', e => setView(e.ctx, V.ARP)),
  NOTE: viewKey('NOTE', 'NOTE', 'SETUP', e => setView(e.ctx, V.NOTE)),
  OSC1: pageKey('OSC1', 'OSC 1', ['EXT IN', 'CV A']),
  OSC2: pageKey('OSC2', 'OSC 2', ['', 'CV B']),
  FLTR: pageKey('FLTR', 'FILTER', ['CHORUS', 'CV C']),
  AMP: pageKey('AMP', 'AMP', ['DELAY', 'CV D']),
  ENV: pageKey('ENV', 'ENV', ['REVERB', 'ENV']),
  LFO: pageKey('LFO', 'LFO', ['LFO', 'LFO']),
  OCT_DOWN: {
    label: 'OCT-', aria: 'Octave down',
    press: e => { const o = Math.max(0, num(e.ctx.values.kb_oct, 4) - 1); e.ctx.setValue('kb_oct', o); say(e.ctx, `OCTAVE ${o - 3 > 0 ? '+' : ''}${o - 3}`, 1000); },
    target: (c, v) => c === 'kb_oct' && typeof v === 'number' && v < 4,
  },
  OCT_UP: {
    label: 'OCT+', aria: 'Octave up',
    press: e => { const o = Math.min(6, num(e.ctx.values.kb_oct, 4) + 1); e.ctx.setValue('kb_oct', o); say(e.ctx, `OCTAVE ${o - 3 > 0 ? '+' : ''}${o - 3}`, 1000); },
    target: (c, v) => c === 'kb_oct' && typeof v === 'number' && v > 4,
  },
  TRNS: {
    label: 'TRNS', sub: 'LOCK', aria: 'Transpose',
    led: e => (e.ctx.ui[UIK.trns] ? [COL.red, 1] : num(e.ctx.values.trns) !== 0 ? [COL.red, 0.45] : null),
    press: e => {
      if (e.func) { useFunc(e.ctx); e.ctx.setValue('trns', 0); say(e.ctx, 'TRANSPOSE 0'); return; }
      const on = !liveUi(e.ctx)[UIK.trns];
      e.ctx.setUi({ [UIK.trns]: on });
      if (on) say(e.ctx, `TRANSPOSE: PRESS A KEY (now ${num(e.ctx.values.trns) > 0 ? '+' : ''}${num(e.ctx.values.trns)})`, 2000);
    },
    target: c => c === 'trns',
  },
  T1: trackKey(0), T2: trackKey(1), T3: trackKey(2), T4: trackKey(3), FX: trackKey(4), CV: trackKey(5),
  FILL: {
    label: 'FILL', sub: 'CUE FILL', aria: 'Fill',
    led: e => (seqStateOf(e.ctx.engine)?.fill ? [COL.red, 1] : null),
    press: e => { if (e.func) { useFunc(e.ctx); e.ctx.sendEvent('seq:fill-cue'); say(e.ctx, 'FILL CUED for one cycle'); return; } e.ctx.sendEvent('seq:fill'); },
    release: e => e.ctx.sendEvent('seq:fill:up'),
  },
  PAGE: {
    label: 'PAGE', sub: 'SCALE', aria: 'Pattern page',
    press: e => {
      if (e.func) { useFunc(e.ctx); toggleKitMenu(e.ctx, 'scale'); return; }
      const pr = project(e.ctx);
      const pat = viewPattern(e.ctx, pr);
      const len = trackLength(getPattern(pr, pat), Math.min(e.track, TRACKS - 1));
      const pages = Math.max(1, Math.ceil(len / 16));
      const cur = Math.round(Number(e.ctx.ui[UI.stepPage]) || 0);
      e.ctx.setUi({ [UI.stepPage]: (cur + 1) % pages });
    },
    target: c => c === 'seq:pages',
  },
};
for (let b = 0; b < 8; b++) KEYDEFS[`BANK_${'ABCDEFGH'[b]}`] = bankKey(b);

/** Arrow keys: with held trigs they edit them (UP/DOWN note, LEFT/RIGHT micro timing), else track / page */
function arrow(e: KeyEnv, dx: number, dy: number) {
  const ctx = e.ctx;
  const u = liveUi(ctx);
  const held = Array.isArray(u[UI.heldSteps]) ? (u[UI.heldSteps] as number[]) : [];
  if (e.func) useFunc(ctx);
  if (held.length && typeof u[UI.heldTrack] === 'number') {
    const track = u[UI.heldTrack] as number;
    const pat = (u[UI.heldPattern] as string) ?? project(ctx).active;
    const p0 = project(ctx);
    const first = getPattern(p0, pat).tracks[track]?.steps[held[0]] as Step | undefined;
    const tdef = getPattern(p0, pat).tracks[track];
    if (dy) {
      const note = Math.max(0, Math.min(127, (first?.note ?? tdef?.note ?? 60) + dy * (e.func ? 12 : 1)));
      ctx.updateData(d => updateSteps(asProject(d, TRACKS), pat, track, held, { note }, { create: 'note' }));
      say(ctx, `NOTE ${formatNote(note)}`, 900);
    } else {
      const micro = Math.max(-23, Math.min(23, (first?.micro ?? 0) + dx * (e.func ? 6 : 1)));
      ctx.updateData(d => updateSteps(asProject(d, TRACKS), pat, track, held, { micro }, { create: false }));
      say(ctx, `MICRO TIMING ${micro > 0 ? '+' : ''}${micro}/384`, 900);
    }
    ctx.setUi({ [UI.heldEdited]: true });
    return;
  }
  if (dy) {
    ctx.setValue('track', Math.max(0, Math.min(TRACKS - 1, e.track - dy)));
    return;
  }
  const pr = project(ctx);
  const len = trackLength(getPattern(pr, viewPattern(ctx, pr)), Math.min(e.track, TRACKS - 1));
  const pages = Math.max(1, Math.ceil(len / 16));
  const cur = Math.round(Number(ctx.ui[UI.stepPage]) || 0);
  ctx.setUi({ [UI.stepPage]: (cur + dx + pages) % pages });
}

/** [FUNC] + [REC] / [PLAY] / [STOP]: copy, clear, paste - the track in GRID RECORDING, else the pattern */
function copyPaste(e: KeyEnv, op: 'copy' | 'clear' | 'paste') {
  const ctx = e.ctx;
  const pr = project(ctx);
  const pat = viewPattern(ctx, pr);
  const track = Math.min(e.track, TRACKS - 1);
  const grid = !!ctx.values.rec;
  const u = liveUi(ctx);
  if (grid) {
    if (op === 'copy') {
      const t = getPattern(pr, pat).tracks[track];
      ctx.setUi({ [UIK.clip]: { kind: 'track', steps: JSON.parse(JSON.stringify(t?.steps ?? {})) } });
      say(ctx, `COPIED ${TRACK_NAMES[track]} of ${pat}`);
    } else if (op === 'clear') {
      ctx.setUi({ [UIK.clip + 'Undo']: { kind: 'track', steps: JSON.parse(JSON.stringify(getPattern(pr, pat).tracks[track]?.steps ?? {})) } });
      ctx.updateData(d => withTrack(asProject(d, TRACKS), pat, track, t => ({ ...t, steps: {} })));
      say(ctx, `CLEARED ${TRACK_NAMES[track]} (paste undoes)`);
    } else {
      const clip = (u[UIK.clip] ?? u[UIK.clip + 'Undo']) as { kind: string; steps: Record<number, Step> } | undefined;
      if (!clip || clip.kind !== 'track') { say(ctx, 'COPY A TRACK FIRST ([FUNC] + [REC])'); return; }
      ctx.updateData(d => withTrack(asProject(d, TRACKS), pat, track, t => ({ ...t, steps: JSON.parse(JSON.stringify(clip.steps)) })));
      say(ctx, `PASTED into ${TRACK_NAMES[track]} of ${pat}`);
    }
    return;
  }
  if (op === 'copy') {
    ctx.setUi({ [UI.clipboard]: copyPattern(pr, pat) });
    say(ctx, `COPIED PATTERN ${pat}`);
  } else if (op === 'clear') {
    ctx.setUi({ [UI.clipboard]: copyPattern(pr, pat) });
    ctx.updateData(d => clearPattern(asProject(d, TRACKS), pat));
    say(ctx, `CLEARED PATTERN ${pat} (paste undoes)`);
  } else {
    const clip = u[UI.clipboard] as Pattern | null | undefined;
    if (!clip) { say(ctx, 'COPY A PATTERN FIRST ([FUNC] + [REC])'); return; }
    ctx.updateData(d => pastePattern(asProject(d, TRACKS), pat, clip));
    say(ctx, `PASTED into ${pat}`);
  }
}

function useFocusMode(): boolean {
  return useStudioStore(s => s.focusMode);
}

/**
 * The keys that lead to the step's controls: the track key while another
 * track is selected, then the page key while another page is shown (the
 * encoder itself lights once it shows the control).
 */
function guideKeys(ctx: CustomRenderContext): Set<string> {
  const out = new Set<string>();
  const st = ctx.step;
  if (!st) return out;
  const track = Math.round(num(ctx.values.track));
  const view = Math.round(num(ctx.values.page, V.OSC1));
  const ids = [st.control, ...(st.match?.controls ?? []), ...(st.focus ?? [])].filter((x): x is string => typeof x === 'string');
  for (const id of ids) {
    const r = routeOf(id);
    if (!r) continue;
    if (r.track !== null && r.track !== track) { out.add(TRACK_NAMES[r.track]); continue; }
    if (r.view >= 0 && r.view !== view) {
      const k = keyOfView(r.view)?.key;
      if (k) out.add(k === 'SOUND' ? 'SND' : k);
    }
  }
  return out;
}

/** Lesson highlight / dim for a key */
function keyFocus(ctx: CustomRenderContext, name: string, def: KeyDef, focusMode: boolean): { highlight: boolean; dim: boolean } {
  if (!ctx.teaching || !ctx.step) return { highlight: false, dim: false };
  const st = ctx.step;
  const f = lessonFocus(ctx);
  const hit = !!(f?.has(`key:${name}`) || guideKeys(ctx).has(name) || (def.target && def.target(st.control, st.targetValue)) || (def.target && st.focus?.some(x => def.target!(x, undefined))));
  const anyFocus = !!(st.control || st.focus?.length || st.match);
  return { highlight: hit, dim: focusMode && anyFocus && !hit };
}

function Icon({ kind, color }: { kind: NonNullable<KeyDef['icon']>; color: string }) {
  const s = 12;
  switch (kind) {
    case 'rec': return <svg width={s} height={s} viewBox="0 0 12 12"><circle cx="6" cy="6" r="4.2" fill="none" stroke={color} strokeWidth="1.6" /></svg>;
    case 'play': return <svg width={s} height={s} viewBox="0 0 12 12"><path d="M3 1.8 L10 6 L3 10.2 Z" fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" /></svg>;
    case 'stop': return <svg width={s} height={s} viewBox="0 0 12 12"><rect x="2.3" y="2.3" width="7.4" height="7.4" fill="none" stroke={color} strokeWidth="1.6" /></svg>;
    default: {
      const rot = { up: 0, right: 90, down: 180, left: 270 }[kind];
      return <svg width={s} height={s} viewBox="0 0 12 12" style={{ transform: `rotate(${rot}deg)` }}><path d="M2.5 8 L6 4 L9.5 8" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
    }
  }
}

function mix(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16));
  const c = pa.map((v, i) => Math.round(v * (1 - t) + pb[i] * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/** One panel key. The custom element's box is the key itself; legends hang below it. */
export function PanelKey({ ctx, name }: { ctx: CustomRenderContext; name: string }) {
  const def = KEYDEFS[name];
  const box = KEYS[name];
  const focusMode = useFocusMode();
  const [down, setDown] = useState(false);
  const pointer = useRef<number | null>(null);
  if (!def || !box) return null;
  const funcState = ctx.ui[UIK.func];
  const env: KeyEnv = {
    ctx,
    func: funcState === 'held' || funcState === 'latched',
    track: Math.max(0, Math.min(TRACKS - 1, Math.round(num(ctx.values.track)))),
    view: Math.round(num(ctx.values.page, V.OSC1)),
    playing: !!(ctx.engine.playing as boolean | undefined),
  };
  const lit = def.led?.(env) ?? null;
  const { highlight, dim } = keyFocus(ctx, name, def, focusMode);
  const isFunc = name === 'FUNC';
  const funcOn = isFunc && (funcState === 'held' || funcState === 'latched');
  const big = name === 'RECORD' || name === 'PLAY' || name === 'STOP' || name === 'FUNC';

  const onDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    e.stopPropagation();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    pointer.current = e.pointerId;
    setDown(true);
    if (isFunc) {
      const cur = liveUi(ctx)[UIK.func];
      if (cur === 'latched') ctx.setUi({ [UIK.func]: null });
      else ctx.setUi({ [UIK.func]: 'held', [UIK.funcUsed]: false });
      return;
    }
    const live: KeyEnv = { ...env, func: funcActive(ctx) };
    def.press(live);
  };
  const onUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (pointer.current !== e.pointerId) return;
    pointer.current = null;
    setDown(false);
    if (isFunc) {
      const u = liveUi(ctx);
      // a tap without using FUNC latches it for the next key (mouse); a used hold releases it
      if (u[UIK.func] === 'held') ctx.setUi({ [UIK.func]: u[UIK.funcUsed] ? null : 'latched', [UIK.funcUsed]: false });
      return;
    }
    def.release?.({ ...env, func: funcActive(ctx) });
  };

  const ledCol = lit ? lit[0] : null;
  const amt = lit ? lit[1] : 0;
  const face = isFunc ? (funcOn ? '#3d4f43' : '#2b3a30') : down ? '#33363c' : COL.key;
  const text = ledCol ? mix(COL.keyText, ledCol, 0.55 + 0.45 * amt) : isFunc ? '#dfe9e2' : COL.keyText;
  const fs = name.startsWith('BANK') ? 12 : big ? 10 : 9.5;
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <button
        type="button"
        data-control={`key:${name}`}
        aria-label={def.aria}
        aria-pressed={lit ? true : funcOn ? true : undefined}
        onPointerDown={onDown}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onLostPointerCapture={onUp}
        onContextMenu={e => e.preventDefault()}
        className={highlight ? 'a4-target' : undefined}
        style={{
          position: 'absolute', inset: 0, borderRadius: big ? 5 : 4, padding: 0, cursor: 'pointer',
          background: ledCol ? `linear-gradient(180deg, ${mix(face, ledCol, 0.22 * amt)} 0%, ${mix(face, ledCol, 0.12 * amt)} 100%)` : `linear-gradient(180deg, ${face} 0%, ${mix(face, '#000000', 0.18)} 100%)`,
          border: `1px solid ${ledCol ? mix(COL.keyEdge, ledCol, 0.7 * amt) : COL.keyEdge}`,
          boxShadow: [
            ledCol ? `0 0 ${3 + 7 * amt}px ${ledCol}${amt > 0.6 ? 'aa' : '55'}` : '0 2px 2px rgba(0,0,0,0.55)',
            'inset 0 1px 0 rgba(255,255,255,0.07)',
            funcOn ? '0 0 0 2px #6fd18f' : '',
          ].filter(Boolean).join(', '),
          transform: down ? 'translateY(1px)' : undefined,
          opacity: dim ? 0.3 : 1, transition: 'opacity 200ms',
          color: text, fontFamily: '"Helvetica Neue", Arial, sans-serif', fontWeight: 700, fontSize: fs, letterSpacing: 0.4,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          touchAction: 'none', WebkitTapHighlightColor: 'transparent', userSelect: 'none', WebkitUserSelect: 'none',
        }}
      >
        {def.icon ? <Icon kind={def.icon} color={text} /> : def.label}
      </button>
      {(def.sub || def.rows) && (
        <div style={{ position: 'absolute', left: '50%', top: '100%', transform: 'translateX(-50%)', marginTop: 2.5, textAlign: 'center', whiteSpace: 'nowrap', pointerEvents: 'none', opacity: dim ? 0.3 : 1, lineHeight: '10px' }}>
          {def.rows && (
            <>
              <div style={{ fontSize: 8.5, fontWeight: 700, color: '#d8dade', minHeight: 10 }}>{def.rows[0] || ' '}</div>
              <div style={{ fontSize: 8.5, fontWeight: 700, color: '#d8dade' }}>{def.rows[1]}</div>
            </>
          )}
          {def.sub && <div style={{ fontSize: 8.5, fontWeight: 700, color: COL.legend, textDecoration: 'underline', textUnderlineOffset: 2 }}>{def.sub}</div>}
        </div>
      )}
    </div>
  );
}

/** Lesson pulse for custom keys (kit components have their own) */
export function A4Styles() {
  return (
    <style>{`
@keyframes a4Pulse { 0%, 100% { box-shadow: 0 0 0 2px ${COL.target} } 50% { box-shadow: 0 0 0 5px ${COL.target}55 } }
.a4-target { animation: a4Pulse 1.1s ease-in-out infinite; }
@keyframes a4Blink { 0%, 49% { opacity: 1 } 50%, 100% { opacity: .3 } }
.a4-blink { animation: a4Blink .6s linear infinite }
@media (prefers-reduced-motion: reduce) { .a4-target { animation: none; box-shadow: 0 0 0 3px ${COL.target} } .a4-blink { animation-duration: 1.6s } }
`}</style>
  );
}

// ----------------------------------------------------------------------------
// LED strips
// ----------------------------------------------------------------------------

function Dot({ on, color, x, y, label, labelBelow = true }: { on: number; color: string; x: number; y: number; label?: string; labelBelow?: boolean }) {
  const d = 2.4 * k;
  return (
    <div style={{ position: 'absolute', left: x * k - d / 2, top: y * k - d / 2, width: d, height: d, pointerEvents: 'none' }}>
      <div style={{ width: d, height: d, borderRadius: '50%', background: on > 0 ? color : '#2a2c30', opacity: on > 0 ? 0.35 + 0.65 * on : 1, boxShadow: on > 0 ? `0 0 ${4 + 6 * on}px ${color}` : 'inset 0 1px 1px rgba(0,0,0,0.8)' }} />
      {label && (
        <div style={{ position: 'absolute', left: '50%', [labelBelow ? 'top' : 'bottom']: '100%', transform: 'translateX(-50%)', marginTop: 2, fontSize: 8, fontWeight: 700, color: COL.label, whiteSpace: 'pre', textAlign: 'center', lineHeight: '9px' }}>
          {label}
        </div>
      )}
    </div>
  );
}

export function LedStrips({ ctx }: { ctx: CustomRenderContext }) {
  const pr = project(ctx);
  const st = seqStateOf(ctx.engine);
  const cm = CHANGE_MODES.indexOf(pr.changeMode);
  const oct = Math.round(num(ctx.values.kb_oct, 4));
  const track = Math.max(0, Math.min(TRACKS - 1, Math.round(num(ctx.values.track))));
  const pat = viewPattern(ctx, pr);
  const len = trackLength(getPattern(pr, pat), track);
  const pages = Math.max(1, Math.ceil(len / 16));
  const shown = Math.min(pages - 1, Math.round(Number(ctx.ui[UI.stepPage]) || 0));
  const playStep = st?.playing && st.pattern === pat ? st.steps[track] ?? -1 : -1;
  const playPage = playStep >= 0 ? Math.floor(playStep / 16) : -1;
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: 0, height: 0 }}>
      {MODE_LEDS.map((p, i) => <Dot key={`m${i}`} {...p} on={cm === i ? 1 : 0} color={COL.red} label={['SEQUENTIAL', 'DIRECT\nSTART', 'DIRECT\nJUMP', 'TEMP\nJUMP'][i]} labelBelow={false} />)}
      {OCT_LEDS.map((p, i) => <Dot key={`o${i}`} {...p} on={oct === i ? 1 : 0} color={COL.red} label={['-3', '-2', '-1', '0', '+1', '+2', '+3'][i]} />)}
      {PAGE_LEDS.map((p, i) => <Dot key={`p${i}`} {...p} on={i >= pages ? 0 : i === shown ? 1 : i === playPage ? 0.7 : 0.25} color={i === playPage && i !== shown ? COL.green : COL.red} label={`${i + 1}`} labelBelow={false} />)}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Mini keyboard
// ----------------------------------------------------------------------------

export function MiniKeyboard({ ctx }: { ctx: CustomRenderContext }) {
  const [held, setHeld] = useState<Set<number>>(new Set());
  const pointers = useRef(new Map<number, number>());
  const focusMode = useFocusMode();
  const f = lessonFocus(ctx);
  const target = !!f?.has('key:KB');
  const dim = !!(ctx.teaching && ctx.step && focusMode && (ctx.step.control || ctx.step.focus?.length) && !target && ctx.step.control !== 'kb_oct');
  const oct = Math.round(num(ctx.values.kb_oct, 4)) - 3;

  const press = (offset: number, e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    e.stopPropagation();
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* ignore */ }
    const u = liveUi(ctx);
    if (u[UIK.trns]) {
      const v = funcActive(ctx) ? offset - 12 : offset;
      ctx.setValue('trns', v);
      say(ctx, `TRANSPOSE ${v > 0 ? '+' : ''}${v}`, 1200);
      return;
    }
    const steps = Array.isArray(u[UI.heldSteps]) ? (u[UI.heldSteps] as number[]) : [];
    if (steps.length && typeof u[UI.heldTrack] === 'number' && trackKind(u[UI.heldTrack] as number) !== 'fx') {
      const track = u[UI.heldTrack] as number;
      const pat = (u[UI.heldPattern] as string) ?? project(ctx).active;
      const note = Math.max(0, Math.min(127, 48 + 12 * oct + offset));
      ctx.updateData(d => updateSteps(asProject(d, TRACKS), pat, track, steps, { note }, { create: 'note' }));
      ctx.setUi({ [UI.heldEdited]: true });
      say(ctx, `TRIG ${steps.map(s => s + 1).join(' ')}: NOTE ${formatNote(note)}`, 1100);
    }
    pointers.current.set(e.pointerId, offset);
    setHeld(h => new Set(h).add(offset));
    ctx.sendEvent('kb:on', { offset });
  };
  const release = (e: React.PointerEvent) => {
    const off = pointers.current.get(e.pointerId);
    if (off === undefined) return;
    pointers.current.delete(e.pointerId);
    setHeld(h => { const n = new Set(h); n.delete(off); return n; });
    ctx.sendEvent('kb:off', { offset: off });
  };
  const W = KEYBOARD;
  const keyStyle = (offset: number, black: boolean): CSSProperties => {
    const on = held.has(offset);
    return {
      position: 'absolute', borderRadius: black ? 3 : 4, padding: 0, cursor: 'pointer', touchAction: 'none', userSelect: 'none', WebkitTapHighlightColor: 'transparent',
      border: `1px solid ${black ? '#050505' : '#0f1012'}`,
      background: black
        ? (on ? `linear-gradient(180deg, #4a2a28, ${COL.red})` : 'linear-gradient(180deg, #1d1e21 0%, #0f1012 100%)')
        : (on ? `linear-gradient(180deg, #d9dbe0 0%, #ffb3ad 100%)` : 'linear-gradient(180deg, #d4d7dc 0%, #b9bdc4 100%)'),
      boxShadow: on ? `0 0 8px ${COL.red}` : black ? '0 2px 3px rgba(0,0,0,0.7)' : 'inset 0 -3px 0 rgba(0,0,0,0.18), 0 2px 2px rgba(0,0,0,0.5)',
    };
  };
  const names = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C'];
  return (
    <div className={target ? 'a4-target' : undefined} style={{ position: 'relative', width: '100%', height: '100%', opacity: dim ? 0.3 : 1, borderRadius: 4 }} aria-label="Keyboard">
      {WHITE_OFFSETS.map((off, i) => (
        <button
          key={`w${i}`}
          type="button"
          aria-label={`Key ${names[i]}${i === 7 ? ' (octave up)' : ''}`}
          onPointerDown={e => press(off, e)} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release} onContextMenu={e => e.preventDefault()}
          style={{ ...keyStyle(off, false), left: i * W.whitePitch * k, top: 0, width: W.whiteW * k, height: W.whiteH * k }}
        >
          <span style={{ position: 'absolute', bottom: 4, left: 0, right: 0, textAlign: 'center', fontSize: 8, fontWeight: 700, color: '#45484e' }}>{i === 0 ? `C${4 + oct - 1}` : ''}</span>
        </button>
      ))}
      {BLACK_KEYS.map(b => (
        <button
          key={`b${b.slot}`}
          type="button"
          aria-label={`Key ${['C#', 'D#', '', 'F#', 'G#', 'A#'][b.slot]}`}
          onPointerDown={e => press(b.offset, e)} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release} onContextMenu={e => e.preventDefault()}
          style={{ ...keyStyle(b.offset, true), left: ((b.slot + 1) * W.whitePitch - W.blackW / 2 - (W.whitePitch - W.whiteW) / 2) * k, top: 0, width: W.blackW * k, height: W.blackH * k, zIndex: 2 }}
        />
      ))}
    </div>
  );
}

// ----------------------------------------------------------------------------
// OLED screen
// ----------------------------------------------------------------------------

const OLED_ON = '#e9f1ff';
const OLED_DIM = '#6f7b90';

function Arc({ norm, bipolar, locked }: { norm: number; bipolar: boolean; locked: boolean }) {
  const r = 7.5, cx = 9, cy = 9;
  const a0 = -225, a1 = 45;
  const ang = (t: number) => ((a0 + (a1 - a0) * t) * Math.PI) / 180;
  const pt = (t: number) => [cx + r * Math.cos(ang(t)), cy + r * Math.sin(ang(t))];
  const from = bipolar ? 0.5 : 0;
  const [x0, y0] = pt(Math.min(from, norm));
  const [x1, y1] = pt(Math.max(from, norm));
  const large = Math.abs(norm - from) * 270 > 180 ? 1 : 0;
  const [xa, ya] = pt(0), [xb, yb] = pt(1);
  const [xn, yn] = pt(norm);
  return (
    <svg width="18" height="16" viewBox="0 0 18 16" style={{ display: 'block', margin: '0 auto' }}>
      <path d={`M ${xa} ${ya} A ${r} ${r} 0 1 1 ${xb} ${yb}`} fill="none" stroke={locked ? '#16181c' : '#39404d'} strokeWidth="2" />
      {Math.abs(norm - from) > 0.002 && <path d={`M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`} fill="none" stroke={locked ? '#050608' : OLED_ON} strokeWidth="2" />}
      <circle cx={xn} cy={yn} r="1.6" fill={locked ? '#050608' : OLED_ON} />
    </svg>
  );
}

function slotNorm(p: ParamDef, v: number): number {
  return Math.max(0, Math.min(1, (v - p.min) / (p.max - p.min || 1)));
}

export function Screen(props: PanelContext) {
  const { values, engine } = props;
  const data = props.data;
  const ui = props.ui ?? {};
  const pr = asProject(data, TRACKS);
  const track = Math.max(0, Math.min(TRACKS - 1, Math.round(num(values.track))));
  const view = Math.round(num(values.page, V.OSC1));
  const page = pageFor(track, view);
  const st = seqStateOf(engine);
  const playing = !!st?.playing;
  const bpm = st?.following ? st.bpm : num(values.tempo, 120);
  const held = Array.isArray(ui[UI.heldSteps]) ? (ui[UI.heldSteps] as number[]) : [];
  const heldOn = held.length > 0 && ui[UI.heldTrack] === track;
  const msgObj = ui[UIK.msg] as { text: string; until: number } | undefined;
  const [, force] = useState(0);
  const msg = msgObj && msgObj.until > Date.now() ? msgObj.text : '';
  useEffect(() => {
    if (!msgObj || msgObj.until <= Date.now()) return;
    const t = setTimeout(() => force(n => n + 1), msgObj.until - Date.now() + 20);
    return () => clearTimeout(t);
  }, [msgObj]);

  // Last-turned parameter: its full name replaces the kit name for a moment (as on the hardware)
  const prev = useRef<Record<string, unknown>>({});
  const [touched, setTouched] = useState<{ name: string; until: number } | null>(null);
  const slots = page && !['perf', 'mix', 'tempo'].includes(page) ? pageSlots(page) : [];
  useEffect(() => {
    for (const p of slots) {
      if (!p) continue;
      const id = controlFor(track, p);
      if (prev.current[id] !== undefined && prev.current[id] !== values[id]) setTouched({ name: p.name.toUpperCase(), until: Date.now() + 1400 });
      prev.current[id] = values[id];
    }
  });
  useEffect(() => {
    if (!touched) return;
    const t = setTimeout(() => setTouched(null), touched.until - Date.now() + 20);
    return () => clearTimeout(t);
  }, [touched]);

  const songRow = pr.mode === 'song' ? (st?.playing && pr.song.rows.length ? `${String((st.songRow ?? 0) + 1).padStart(2, '0')}:` : '__:') : '';
  const shownPattern = st?.playing && st.pattern ? st.pattern : pr.active;
  const kitName = pr.song.name || getPattern(pr, shownPattern).name || 'KIT';
  const levelId = levelControl(track);
  const level = levelId ? num(values[levelId], 100) : 0;
  const title = page ? PAGE_TITLE[page] : '---';
  const icon = values.live_rec && playing ? '●▶' : playing ? '▶' : values.rec ? '●' : '■';

  let body: ReactNode;
  if (!page) {
    body = <div style={{ textAlign: 'center', paddingTop: 40, color: OLED_DIM, fontSize: 12 }}>{TRACK_NAMES[track]} has no page on this key</div>;
  } else if (page === 'tempo') {
    body = (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', paddingTop: 10 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, fontWeight: 700, lineHeight: '44px' }}>{bpm.toFixed(1)}</div>
          <div style={{ fontSize: 10, color: OLED_DIM }}>{st?.following ? 'STUDIO CLOCK (SYNC)' : 'BPM - KNOB A'}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{getPattern(pr, pr.active).swing}%</div>
          <div style={{ fontSize: 10, color: OLED_DIM }}>SWING - KNOB B</div>
        </div>
      </div>
    );
  } else if (page === 'perf') {
    body = (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px 2px', paddingTop: 6 }}>
        {PERF_MACROS.map((m, i) => {
          const v = num(values[`perf_${'abcdefghij'[i]}`]);
          const sel = num(values.qper_sel) === i;
          return (
            <div key={i} style={{ textAlign: 'center' }}>
              <Arc norm={v / 127} bipolar={false} locked={false} />
              <div style={{ fontSize: 8.5, fontWeight: 700, color: sel ? '#050608' : OLED_ON, background: sel ? OLED_ON : 'transparent', borderRadius: 2, whiteSpace: 'nowrap', overflow: 'hidden' }}>{m.name}</div>
            </div>
          );
        })}
      </div>
    );
  } else if (page === 'mix') {
    const lv = [0, 1, 2, 3].map(t => num(values[`t${t + 1}_level`], 100)).concat([num(values.fx_level, 100)]);
    body = (
      <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end', height: 78, paddingTop: 6 }}>
        {lv.map((v, i) => {
          const muted = !!values[`t${i + 1}_mute`] || !!getPattern(pr, shownPattern).tracks[i]?.mute;
          return (
            <div key={i} style={{ textAlign: 'center', width: 34 }}>
              <div style={{ height: 52, width: 10, margin: '0 auto', border: `1px solid ${OLED_DIM}`, position: 'relative' }}>
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${(v / 127) * 100}%`, background: muted ? OLED_DIM : OLED_ON }} />
              </div>
              <div style={{ fontSize: 10, fontWeight: 700 }}>{TRACK_NAMES[i]}{muted ? ' M' : ''}</div>
            </div>
          );
        })}
      </div>
    );
  } else {
    const tr = getPattern(pr, ui[UI.heldPattern] as string ?? shownPattern).tracks[track];
    const step = heldOn ? (tr?.steps[held[0]] as Step | undefined) : undefined;
    const cell = (p: ParamDef | null, i: number) => {
      if (!p) return <div key={i} />;
      const id = controlFor(track, p);
      const v = num(values[id], p.def);
      let locked = false;
      if (heldOn && step) {
        if (p.key === 'trig_note') locked = step.note !== undefined;
        else if (p.key === 'trig_vel') locked = step.vel !== undefined;
        else if (p.key === 'trig_len') locked = step.len !== undefined;
        else if (p.key === 'trig_micro') locked = !!step.micro;
        else if (p.key === 'trig_cond') locked = !!step.cond;
        else locked = !!step.locks && p.key in step.locks;
      }
      const txt = p.fmt ? p.fmt(v) : String(Math.round(v));
      return (
        <div key={i} style={{ textAlign: 'center', minWidth: 0 }}>
          <Arc norm={slotNorm(p, v)} bipolar={!!p.bipolar} locked={false} />
          <div style={{ fontSize: 9.5, color: OLED_DIM, letterSpacing: 0.3, lineHeight: '10px', fontWeight: 700 }}>{p.short}</div>
          <div style={{ fontSize: 12.5, fontWeight: 700, lineHeight: '14px', whiteSpace: 'nowrap', overflow: 'hidden', color: locked ? '#050608' : OLED_ON, background: locked ? OLED_ON : 'transparent', borderRadius: 2, margin: '0 1px' }}>
            {txt}
          </div>
        </div>
      );
    };
    const s = pageSlots(page);
    body = (
      <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', marginTop: 3 }}>{s.slice(0, 5).map(cell)}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', marginTop: 3 }}>{s.slice(5).map(cell)}</div>
      </>
    );
  }

  const foot = msg || (heldOn ? `TRIG ${held.map(s => s + 1).join(',')} · TURN A KNOB TO LOCK` : trackKind(track) === 'cv' ? 'CV TRACK: SEQUENCED, NO OUTPUT JACKS' : view === V.OSC1 && trackKind(track) === 'fx' ? 'NO AUDIO INPUTS IN THE STUDIO' : '');
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', color: OLED_ON, fontFamily: '"Helvetica Neue", Arial, sans-serif', userSelect: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', fontSize: 11, lineHeight: '13px', gap: 4 }}>
        <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', fontWeight: 700 }}>{touched ? touched.name : kitName}</span>
        <span>{bpm.toFixed(1)}</span>
        <span style={{ minWidth: 18, textAlign: 'right' }}>{icon}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', fontSize: 11, lineHeight: '14px', gap: 5, borderBottom: `1px solid ${OLED_DIM}`, paddingBottom: 1 }}>
        <b style={{ background: OLED_ON, color: '#050608', padding: '0 3px', borderRadius: 2 }}>{TRACK_NAMES[track]}</b>
        <b style={{ flex: 1 }}>{title}</b>
        <span style={{ color: OLED_DIM }}>{songRow}</span>
        <b>{shownPattern}</b>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>{body}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, lineHeight: '12px' }}>
        <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', color: msg ? '#050608' : OLED_DIM, background: msg ? OLED_ON : 'transparent', padding: msg ? '0 3px' : 0, borderRadius: 2 }}>{foot || ' '}</span>
        {levelId && (
          <span style={{ width: 36, height: 6, border: `1px solid ${OLED_DIM}`, position: 'relative' }} title="Track level">
            <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(level / 127) * 100}%`, background: OLED_ON }} />
          </span>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Trig area: trigs, or patterns (bank mode), or macros (QPER)
// ----------------------------------------------------------------------------

const TRIG_MODES = ['trig', 'accent', 'slide', 'pslide'] as const;

/** Lessons: the trig keys step back (dimmed) while a step is about the sound, not the sequencer */
function trigAreaDimmed(ctx: CustomRenderContext, focusMode: boolean): boolean {
  const st = ctx.step;
  if (!focusMode || !ctx.teaching || !st || st.check) return false;
  const ids = [st.control, ...(st.focus ?? []), ...(st.match?.controls ?? [])].filter((x): x is string => typeof x === 'string');
  if (!ids.length) return false;
  return !ids.some(id => /_trig_|^trig_mode$|_mute$|^seq:/.test(id));
}

export function TrigArea({ ctx }: { ctx: CustomRenderContext }) {
  const focusMode = useFocusMode();
  const dim = trigAreaDimmed(ctx, focusMode);
  const bank = ctx.ui[UIK.bank];
  const qper = !!ctx.ui[UIK.qper];
  const pr = project(ctx);
  const st = seqStateOf(ctx.engine);
  const keyW = TRIGS.keyW * k;
  const pitch = TRIGS.pitch * k;
  const dimStyle = { opacity: dim ? 0.35 : 1, transition: 'opacity 0.2s' } as const;
  const strip = (render: (i: number) => ReactNode) => (
    <div style={{ position: 'relative', width: '100%', height: '100%', ...dimStyle }}>
      <A4Styles />
      {Array.from({ length: 16 }, (_, i) => <div key={i} style={{ position: 'absolute', left: i * pitch, top: 0, width: keyW, height: '100%' }}>{render(i)}</div>)}
    </div>
  );
  const keyBtn = (i: number, opts: { lit: string | null; amt?: number; label: string; sub?: string; blink?: boolean; outline?: boolean; onPress: () => void; aria: string }) => (
    <button
      type="button"
      aria-label={opts.aria}
      onPointerDown={e => { if (e.button !== 0 && e.pointerType === 'mouse') return; e.preventDefault(); e.stopPropagation(); opts.onPress(); }}
      className={opts.blink ? 'a4-blink' : undefined}
      style={{
        position: 'absolute', inset: 0, borderRadius: 5, padding: 0, cursor: 'pointer', touchAction: 'none',
        border: `${opts.outline ? 2 : 1}px solid ${opts.outline ? COL.white : COL.keyEdge}`,
        background: opts.lit ? mix(COL.key, opts.lit, 0.25 + 0.6 * (opts.amt ?? 1)) : COL.key,
        boxShadow: opts.lit ? `0 0 ${4 + 6 * (opts.amt ?? 1)}px ${opts.lit}` : '0 2px 2px rgba(0,0,0,0.55)',
        color: opts.lit ? '#111' : COL.keyText, fontWeight: 800, fontSize: 11, fontFamily: '"Helvetica Neue", Arial, sans-serif',
      }}
    >
      <span>{opts.label}</span>
      {opts.sub && <span style={{ position: 'absolute', left: 2, right: 2, bottom: 2, fontSize: 8, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden' }}>{opts.sub}</span>}
    </button>
  );

  if (typeof bank === 'number') {
    return strip(i => {
      const id = patternId(bank, i);
      const has = patternHasContent(pr.patterns[id]);
      const playing = st?.playing && st.pattern === id;
      const queued = st?.queued === id && !playing;
      return keyBtn(i, {
        lit: playing ? COL.green : queued ? COL.yellow : has ? COL.red : null,
        amt: playing || queued ? 1 : 0.5,
        label: `${i + 1}`,
        sub: pr.patterns[id]?.name || id,
        blink: queued,
        outline: pr.active === id,
        aria: `Pattern ${id}${has ? '' : ' (empty)'}`,
        onPress: () => {
          ctx.updateData(d => setActive(asProject(d, TRACKS), id));
          ctx.setUi({ [UIK.bank]: null });
          say(ctx, st?.playing ? `${id} CUED` : `PATTERN ${id}`, 1200);
        },
      });
    });
  }
  if (qper) {
    return strip(i => {
      if (i >= PERF_MACROS.length) return keyBtn(i, { lit: null, label: '', aria: 'unused', onPress: () => undefined });
      const sel = num(ctx.values.qper_sel) === i;
      return keyBtn(i, {
        lit: sel ? COL.white : null, label: 'ABCDEFGHIJ'[i], sub: PERF_MACROS[i].name, aria: `Quick perf macro ${PERF_MACROS[i].name}`,
        onPress: () => { ctx.setValue('qper_sel', i); ctx.setUi({ [UIK.qper]: false }); say(ctx, `QUICK PERF: ${PERF_MACROS[i].name}`, 1200); },
      });
    });
  }
  const mode = TRIG_MODES[Math.round(num(ctx.values.trig_mode))] ?? 'trig';
  return (
    <div style={{ width: '100%', height: '100%', ...dimStyle }}>
      <TrigKeys ctx={ctx} tracks={TRACKS} mode={mode} editable={ctx.values.rec !== false} trackNames={[...TRACK_NAMES]} color={COL.red} />
    </div>
  );
}

// ----------------------------------------------------------------------------
// TRACK LEVEL push: the SOUND BROWSER
// ----------------------------------------------------------------------------

export function SoundBrowserLegend({ ctx }: { ctx: CustomRenderContext }) {
  const open = ctx.ui[UIK.menu] === 'sound';
  return (
    <button
      type="button"
      aria-label="Sound browser (TRACK LEVEL push)"
      onPointerDown={e => { e.preventDefault(); e.stopPropagation(); toggleA4Menu(ctx, 'sound'); }}
      style={{ width: '100%', height: '100%', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', color: open ? COL.white : COL.legend, fontSize: 8.5, fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 2, fontFamily: '"Helvetica Neue", Arial, sans-serif', whiteSpace: 'nowrap' }}
    >
      SOUND BROWSER
    </button>
  );
}

// ----------------------------------------------------------------------------
// Menus
// ----------------------------------------------------------------------------

/** A kit's project was written for its tempo: synced to the studio, move the studio tempo there too */
function followKitTempo(ctx: CustomRenderContext, bpm: number) {
  const st = useStudioStore.getState();
  if (st.studio.sync[ctx.instance] === false) return;
  if (Math.abs(st.studio.bpm - bpm) >= 0.5) st.setBpm(bpm);
}

function loadSound(ctx: CustomRenderContext, s: SoundDef, track: number) {
  useStudioStore.getState().setControlValues(ctx.instance, { ...soundTrackValues(s, track), ...(s.oct !== undefined ? { kb_oct: s.oct + 3 } : {}) });
  say(ctx, `${TRACK_NAMES[track]}: ${s.name.split(' / ')[1].toUpperCase()}`, 1500);
  // play it once so you hear what you loaded
  ctx.sendEvent('kb:on', { offset: 0 });
  setTimeout(() => ctx.sendEvent('kb:off', { offset: 0 }), 420);
}

function SoundMenu({ ctx }: { ctx: CustomRenderContext }) {
  const [cat, setCat] = useState<string>('Bass');
  const track = Math.max(0, Math.min(TRACKS - 1, Math.round(num(ctx.values.track))));
  const synth = track < SYNTH_TRACKS;
  return (
    <Overlay portal portalSize={{ w: 700, h: 420 }}>
      <Frame title="SOUND BROWSER" sub={synth ? `load into ${TRACK_NAMES[track]}` : 'select a synth track (T1-T4)'} onClose={() => ctx.setUi({ [UIK.menu]: null })}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
          {SOUND_CATEGORIES.map(c => <SeqButton key={c} active={cat === c} color={SC.white} onPress={() => setCat(c)}>{c.toUpperCase()}</SeqButton>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 6 }}>
          {SOUNDS.filter(s => s.category === cat).map(s => (
            <button
              key={s.id}
              type="button"
              disabled={!synth}
              onClick={e => { e.stopPropagation(); loadSound(ctx, s, track); }}
              title={s.desc}
              style={{ textAlign: 'left', padding: '6px 8px', minHeight: 44, borderRadius: 5, border: `1px solid ${SC.border}`, background: SC.key, color: SC.text, cursor: synth ? 'pointer' : 'default', opacity: synth ? 1 : 0.5, touchAction: 'manipulation' }}
            >
              <div style={{ fontSize: 12, fontWeight: 800 }}>{s.name.split(' / ')[1]}</div>
              <div style={{ fontSize: 10, color: SC.dim, lineHeight: '12px', marginTop: 2 }}>{s.desc.split(':')[0].slice(0, 70)}</div>
            </button>
          ))}
        </div>
      </Frame>
    </Overlay>
  );
}

function KitMenu({ ctx }: { ctx: CustomRenderContext }) {
  const load = (i: number, withProject: boolean) => {
    const kit = KITS[i];
    const vals: Record<string, ControlValue> = { ...kitValues(kit) };
    if (withProject) {
      const proj = kit.project();
      ctx.updateData(() => proj);
      vals.kit_project = i + 2;
      vals.kit_project_loaded = i + 2;
    }
    useStudioStore.getState().setControlValues(ctx.instance, vals);
    if (withProject) followKitTempo(ctx, kit.tempo);
    ctx.setUi({ [UIK.menu]: null });
    say(ctx, `${withProject ? 'PROJECT' : 'KIT'}: ${kit.name.split(' / ')[1].toUpperCase()}`);
  };
  return (
    <Overlay portal portalSize={{ w: 680, h: 440 }}>
      <Frame title="KIT" sub="four sounds + the FX track" onClose={() => ctx.setUi({ [UIK.menu]: null })}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {KITS.map((kit, i) => (
            <Group key={kit.id} label={kit.name.split(' / ')[1].toUpperCase()}>
              <span style={{ fontSize: 11, color: SC.dim, flex: '1 1 300px' }}>{kit.desc}</span>
              <SeqButton onPress={() => load(i, false)} title="Sounds only: your patterns stay">LOAD SOUNDS</SeqButton>
              <SeqButton onPress={() => load(i, true)} color={SC.green} title="Sounds, patterns and the song (replaces the pattern memory)">WITH PATTERNS</SeqButton>
            </Group>
          ))}
        </div>
      </Frame>
    </Overlay>
  );
}

function GlobalMenu({ ctx }: { ctx: CustomRenderContext }) {
  const synced = useStudioStore(s => s.studio.sync[ctx.instance] !== false);
  const setSync = useStudioStore(s => s.setSync);
  return (
    <Overlay portal portalSize={{ w: 560, h: 320 }}>
      <Frame title="GLOBAL SETTINGS" onClose={() => ctx.setUi({ [UIK.menu]: null })}>
        <Group label="MIDI CONFIG › SYNC">
          <SeqButton active={synced} color={SC.green} onPress={() => setSync(ctx.instance, !synced)}>{synced ? 'CLOCK RECEIVE: ON' : 'CLOCK RECEIVE: OFF'}</SeqButton>
          <span style={{ fontSize: 11, color: SC.dim }}>On: the A4 follows the studio transport (tempo, start, stop) like MIDI clock.</span>
        </Group>
        <div style={{ height: 6 }} />
        <Group label="PROJECT">
          <span style={{ fontSize: 11, color: SC.dim }}>The studio saves the project (sounds, patterns, songs) as you work. Use the toolbar to save it to a file.</span>
        </Group>
      </Frame>
    </Overlay>
  );
}

const lockLabel = (key: string) => {
  for (const pg of ['osc1', 'noise', 'osc2', 'osc12', 'filters', 'amp', 'envf', 'env2', 'lfo1', 'lfo2', 'arp', 'vmod', 'snd'] as const) {
    const p = pageSlots(pg).find(x => x?.key === key);
    if (p) return `${PAGE_TITLE[pg]} ${p.short}`;
  }
  return key.toUpperCase();
};

export function Menus({ ctx }: { ctx: CustomRenderContext }) {
  const m = ctx.ui[UIK.menu];
  return (
    <>
      <A4Styles />
      <TrigEditor ctx={ctx} tracks={TRACKS} portal portalPlacement="top" features={{ retrig: false, accent: true, slide: true, pslide: true }} lockLabel={lockLabel} trackNames={[...TRACK_NAMES]} />
      <PatternPicker ctx={ctx} tracks={TRACKS} portal />
      <ChainBuilder ctx={ctx} tracks={TRACKS} portal />
      <SongEditor ctx={ctx} tracks={TRACKS} portal transpose trackNames={[...TRACK_NAMES]} />
      <ScaleMenu ctx={ctx} tracks={TRACKS} portal trackNames={[...TRACK_NAMES]} />
      {m === 'sound' && <SoundMenu ctx={ctx} />}
      {m === 'kit' && <KitMenu ctx={ctx} />}
      {m === 'global' && <GlobalMenu ctx={ctx} />}
    </>
  );
}

// ----------------------------------------------------------------------------
// Helpers: kit project loading, LIVE RECORDING, Shift = FUNC
// ----------------------------------------------------------------------------

export function Helpers({ ctx }: { ctx: CustomRenderContext }) {
  const kp = Math.round(num(ctx.values.kit_project));
  const kpl = Math.round(num(ctx.values.kit_project_loaded));
  const pending = (ctx.data as { a4?: { pendingKit?: string } } | undefined)?.a4?.pendingKit;
  const applied = useRef('');

  // The default project carries its kit: apply the sounds once, the first time the panel opens
  useEffect(() => {
    if (!pending || applied.current === `pending:${pending}`) return;
    applied.current = `pending:${pending}`;
    const i = KITS.findIndex(kt => kt.id === pending);
    if (i >= 0) useStudioStore.getState().setControlValues(ctx.instance, { ...kitValues(KITS[i]), kit_project: i + 2, kit_project_loaded: i + 2 });
    ctx.updateData(d => {
      const { a4: _drop, ...rest } = (d ?? {}) as Record<string, unknown>;
      void _drop;
      return rest;
    });
  }, [pending, ctx]);

  // A kit preset sets kit_project: load its patterns into the pattern memory
  useEffect(() => {
    if (pending || kp <= 0 || kp === kpl) return;
    const key = `kit:${kp}:${kpl}`;
    if (applied.current === key) return;
    applied.current = key;
    const proj = projectFor(kp);
    if (proj) ctx.updateData(() => proj);
    useStudioStore.getState().setControlValues(ctx.instance, { kit_project_loaded: kp });
    const kit = KITS[kp - 2];
    if (kit) followKitTempo(ctx, kit.tempo);
    if (proj) say(ctx, `PROJECT ${KIT_PROJECT_IDS[kp].toUpperCase()} LOADED`);
  }, [kp, kpl, pending, ctx]);

  // LIVE RECORDING ends with playback (the studio transport may stop it)
  const playing = !!ctx.engine.playing;
  const wasPlaying = useRef(playing);
  useEffect(() => {
    if (wasPlaying.current && !playing && ctx.values.live_rec) ctx.setValue('live_rec', false);
    wasPlaying.current = playing;
  }, [playing, ctx]);

  // LIVE RECORDING: the engine reports played notes with their quantised step
  const rec = ctx.engine.recNote as { id: number; track: number; note: number; vel: number; step: number; pattern: string } | undefined;
  const lastRec = useRef(0);
  useEffect(() => {
    if (!rec || rec.id === lastRec.current) return;
    lastRec.current = rec.id;
    const pr = project(ctx);
    const len = trackLength(getPattern(pr, rec.pattern), rec.track);
    const step = ((rec.step % len) + len) % len;
    ctx.updateData(d => updateSteps(asProject(d, TRACKS), rec.pattern, rec.track, [step], { note: rec.note, trigless: null }, { create: 'note' }));
  }, [rec, ctx]);

  // Shift on a computer keyboard works as FUNC
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === 'Shift' && !e.repeat) ctx.setUi({ [UIK.func]: 'held', [UIK.funcUsed]: false }); };
    const up = (e: KeyboardEvent) => { if (e.key === 'Shift') ctx.setUi({ [UIK.func]: null }); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.instance]);

  return null;
}

// ----------------------------------------------------------------------------
// Labels for lock keys and the NOTE page readouts (used by index.ts)
// ----------------------------------------------------------------------------

export { lockLabel, formatLength, TRIG_CONDITIONS, VIEWS, FX_TRACK };
