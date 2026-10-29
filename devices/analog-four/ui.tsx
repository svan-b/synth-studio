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
  ChainBuilder, PatternPicker, ScaleMenu, SongEditor, TrigEditor, TrigKeys, pressPlay, pressStop,
} from '@/components/sequencer';
import { C as SC, Frame, Group, Overlay, SeqButton, Stepper, UI, lessonFocus, seqStateOf, viewPattern } from '@/components/sequencer/shared';
import {
  CHANGE_MODES, LEN_1_STEP, LOCK_LIMIT_A4, NOTE_LENGTHS, QUANTIZE_MAX, TRIG_CONDITIONS, addChordNote, asProject, clearPattern, copyPattern, formatChord, formatLength, formatNote, getPattern,
  lengthSteps, parsePatternId, reloadPattern, stepSeconds, trackSpeed,
  reloadTrack, rowEntry, savePattern, saveTrack, setStep as setStepFn, pastePattern, patternHasContent, patternId, setActive, setChain, setChangeMode,
  clearLocks, clearPage, copyPage, copyTrigs, pastePage, pasteTrigs, setLock, setMasterMute, setMasterMutes, setPlayMode, setTrackQuantize, setTrigMute, trackLength, trackTrigDefaults, updatePatternSettings, updateSteps, withSteps,
  withTrack,
  type Pattern, type Project, type SeqState, type Step, type StepsClip,
} from '@/lib/sequencer/elektron';
import {
  CV_BY_KEY, FX_BY_KEY, FX_TRACK, PAGE_TITLE, PERF_MACROS, POLY_ALLOC, SEQ_TRACKS, SYNTH_BY_KEY, SYNTH_TRACKS, TRACK_NAMES, V, VIEWS, keyOfView, levelControl, pageFor,
  pageSlots, controlFor, routeOf, trackKind, viewAfterPress, type ParamDef,
} from './params';
import { KEYS, PX_PER_MM, TRIGS, TRIG_LEGENDS, KEYBOARD, KB_KEY, KB_KEYS, MODE_LEDS, OCT_LEDS, PAGE_LEDS, LOGO } from './geometry';
import { SOUNDS, SOUND_CATEGORIES, type SoundDef } from './sounds';
import { KITS, KIT_PROJECT_IDS, SOUND_DEMO_BASE, kitValues, projectFor, soundTrackValues } from './kits';
import { isTransposable, setTransposable } from './arp';

const TRACKS = SEQ_TRACKS;
const k = PX_PER_MM;
/** MIDI note of the first keyboard key at octave 0 */
const KB_C1 = 72;

// ----------------------------------------------------------------------------
// Colours (the 2020 black finish, from a top-down image of the unit)
// ----------------------------------------------------------------------------

export const COL = {
  panel: '#161618',
  key: '#2c2d30',
  keyEdge: '#0e0e10',
  keyText: '#a3a6ab',     // a key's legend while its LED is off
  keyBright: '#eceef0',
  legend: '#cdd0d4',      // printed legends: near-white on the black unit
  legendGrey: '#a2a5aa',  // the grey half of the two-tone knob names; the letters under the trig keys
  legendDim: '#a6a9ae',   // the rear connector names
  label: '#eceef0',       // the white half of the two-tone knob names
  func: '#b9bbbf',        // the light grey FUNC key
  legendWhite: '#d9dbdf', // the FX / CV page names under the PARAMETER keys
  lightBlue: '#7fd6ff',   // a key whose secondary function is used
  ledOff: '#3b1612',      // an unlit LED behind the panel
  amber: '#ff7a3c',       // the strip LEDs (pattern mode, octave, pattern page)
  trigOff: '#8f9298',     // a trig key's number with its LED off
  red: '#ff3020',
  green: '#25d366',
  yellow: '#ffc21a',
  white: '#f3f3f3',
  blue: '#3aa0ff',
  pink: '#ff5fa8',
  cyan: '#4fd2ff',
  target: '#ff9f1c',
};

/**
 * Text sizes in the panel's native px (3.1 px/mm). Fitted to an iPad in landscape the panel
 * draws at about 0.95, so these render at about 9.5 CSS px there (the app's floors are 9 for
 * small legends and readouts, 10 for control names): as large as the panel's spacing allows
 * without neighbouring legends touching, and the black unit's own proportions.
 */
export const TXT = { cap: 10, legend: 10, small: 9.5 };

// ----------------------------------------------------------------------------
// UI state helpers
// ----------------------------------------------------------------------------

const UIK = {
  func: 'a4func',       // 'held' | 'latched' | null
  funcUsed: 'a4funcUsed',
  bank: 'a4bank',       // pattern-select mode: bank index or null
  qper: 'a4qper',
  trns: 'a4trns',
  menu: 'a4menu',       // 'sound' | 'kit' | 'global' | 'poly' | ... | null
  msg: 'a4msg',
  recDown: 'a4recDown',
  clip: 'a4clip',
  trnsLock: 'a4trnsLock',
  perfPending: 'a4perfPending', // PERF mode: tracks whose mute toggles when FUNC is released
  yesNo: 'a4yesNo',             // [YES] or [NO] held: quick save / reload with [PTN] and [TRK] (manual p.54)
  liveKnob: 'a4liveKnob',       // LIVE RECORDING: the values the knobs are recording (control id -> value)
  liveRec: 'a4liveRec',         // LIVE RECORDING: the last knob turn to write as a lock ({ n, id, key, value, track })
  liveQuant: 'a4liveQuant',     // LIVE RECORDING quantized ([RECORD] + [PLAY][PLAY], manual p.41)
  erase: 'a4erase',             // LIVE RECORDING real-time erase: { kind: 'locks' | 'trigs' | 'param', tracks, key? }
  trackDown: 'a4trackDown',     // track keys held down (with [NO]: erase their trigs as the playhead passes)
  recCombo: 'a4recCombo',       // [RECORD] was used in a combination while held ([STOP], [PLAY])
  stepRec: 'a4stepRec',         // STEP RECORDING: { jump, step } (the active step) or null (manual p.41)
  pageDown: 'a4pageDown',       // [PAGE] held: [RECORD] / [STOP] / [PLAY] copy, paste, clear the page (p.54)
  pageCombo: 'a4pageCombo',     // [PAGE] was used in a combination (its release then keeps the page)
  pageUndo: 'a4pageUndo',       // the last page / trig paste or clear, for the undo by repeating it (p.54)
  trigClip: 'a4trigClip',       // copied trigs (relative steps) and their track
  soundClip: 'a4soundClip',     // a copied track Sound ([TRACK] + [RECORD], p.54)
} as const;

/** STEP RECORDING: STANDARD (advance one step) or JUMP (advance by the NOTE page's LEN), and the active step */
interface StepRec { jump: boolean; step: number }

function stepRecOf(ctx: CustomRenderContext): StepRec | null {
  const v = liveUi(ctx)[UIK.stepRec] as StepRec | null | undefined;
  return v && typeof v.step === 'number' ? v : null;
}

/** Enter STEP RECORDING (or switch STANDARD / JUMP), starting on the shown page's first step */
function setStepRec(ctx: CustomRenderContext, sr: StepRec | null) {
  ctx.setUi({ [UIK.stepRec]: sr, ...(sr ? { [UI.stepPage]: Math.floor(sr.step / 16) } : {}) });
  ctx.sendEvent('a4:step-rec', { on: !!sr });
  if (sr) { ctx.setValue('rec', true); if (ctx.values.live_rec) ctx.setValue('live_rec', false); }
}

/** LIVE RECORDING real-time erase (manual p.41, p.50) */
interface EraseMode { kind: 'locks' | 'trigs' | 'param'; tracks: number[]; key?: string }

const num = (v: ControlValue | undefined, d = 0) => (typeof v === 'number' ? v : typeof v === 'boolean' ? (v ? 1 : 0) : d);

function liveUi(ctx: CustomRenderContext): Record<string, unknown> {
  return useUiStore.getState().ui[ctx.instance] ?? ctx.ui;
}

function project(ctx: { data?: unknown }): Project {
  return asProject(ctx.data, TRACKS);
}

/** A synth track whose voice is in the POLY CONFIG pool plays polyphonically (manual p.28-29) */
export function isPolyTrack(values: Record<string, ControlValue>, t: number): boolean {
  return t >= 0 && t < SYNTH_TRACKS && !!values[`poly_v${t + 1}`];
}

/** Track mutes ([FUNC] + [TRACK]) are the project's: global, kept through pattern changes (manual p.37) */
function masterMuted(pr: Project, t: number): boolean {
  return !!pr.mutes?.includes(t);
}

/** Song mutes of the playing song position: their track keys show half-bright (manual p.56) */
function songMuted(pr: Project, st: SeqState | undefined, t: number): boolean {
  if (!st?.playing || st.mode !== 'song' || st.arranged) return false;
  const row = pr.song.rows[st.songRow];
  return !!row && !!rowEntry(row, st.songPos ?? 0).mutes?.includes(t);
}

/**
 * A trig takes the NOTE menu's NOT, VEL and LEN as it is placed, so changing them
 * later only affects trigs placed afterwards (manual p.45). `after` is `before`
 * plus an edit; every note trig it creates gets the values it lacks.
 */
export function stampNewTrigs(before: Project, after: Project): Project {
  if (before === after) return after;
  let out = after;
  for (const id in after.patterns) {
    const pa = after.patterns[id];
    const pb = before.patterns[id];
    if (pa === pb) continue;
    pa.tracks.forEach((ta, t) => {
      const tb = pb?.tracks[t];
      if (tb && ta.steps === tb.steps) return;
      const fresh: number[] = [];
      for (const k in ta.steps) {
        const s = ta.steps[k];
        const prev = tb?.steps[Number(k)];
        if (s.trigless || (prev && !prev.trigless)) continue;
        if (s.note === undefined || s.vel === undefined || s.len === undefined) fresh.push(Number(k));
      }
      if (!fresh.length) return;
      const d = trackTrigDefaults(out, id, t);
      out = withSteps(out, id, t, fresh, s => (s ? { ...s, note: s.note ?? d.note, vel: s.vel ?? d.vel, len: s.len ?? d.len } : s));
    });
  }
  return out;
}

/** An edit of the pattern data whose new trigs get their NOTE menu values */
function editTrigs(ctx: Pick<CustomRenderContext, 'updateData'>, fn: (p: Project) => Project) {
  ctx.updateData(d => { const p = asProject(d, TRACKS); return stampNewTrigs(p, fn(p)); });
}

/** Show a short message on the OLED */
function say(ctx: CustomRenderContext, text: string, ms = 2200) {
  ctx.setUi({ [UIK.msg]: { text, until: Date.now() + ms } });
}

function funcActive(ctx: CustomRenderContext): boolean {
  const f = liveUi(ctx)[UIK.func];
  return f === 'held' || f === 'latched';
}

/** PERF mode mute changes waiting for FUNC to be released */
function pendingMutes(ctx: CustomRenderContext): number[] {
  const p = liveUi(ctx)[UIK.perfPending];
  return Array.isArray(p) ? (p as number[]) : [];
}

/** FUNC released (or a latched FUNC tapped off): the PERF mode mute changes take effect together (manual p.27) */
function applyPendingMutes(ctx: CustomRenderContext) {
  const p = pendingMutes(ctx);
  if (!p.length) return;
  ctx.setUi({ [UIK.perfPending]: [] });
  ctx.updateData(d => {
    const pr = asProject(d, TRACKS);
    const m = new Set(pr.mutes ?? []);
    p.forEach(t => (m.has(t) ? m.delete(t) : m.add(t)));
    return setMasterMutes(pr, Array.from(m));
  });
}

/** After a FUNC combination: a latched FUNC is used up */
function spendFunc(ctx: CustomRenderContext) {
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

/** The tempo you hear: the studio's while synced (the A4 then follows its clock), else the A4's own */
function setTempo(ctx: CustomRenderContext, bpm: number) {
  const st = useStudioStore.getState();
  if (st.studio.sync[ctx.instance] !== false) st.setBpm(bpm);
  ctx.setValue('tempo', Math.round(bpm));
}

type A4Menu = 'sound' | 'kit' | 'global' | 'tempo' | 'swing' | 'pattern' | 'track' | 'poly';

function toggleA4Menu(ctx: CustomRenderContext, menu: A4Menu) {
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
  /** Legend printed under the key: its FUNC function (underlined) */
  sub?: string;
  /** The legend under the key is not a FUNC function (not underlined): YES, NO, the arrows */
  subPlain?: boolean;
  /** White legend rows under the PARAMETER keys (FX track page, CV track page) */
  rows?: [string, string];
  /** LED colour (null = off); dim factor 0..1; blinking */
  led?: (e: KeyEnv) => [string, number, boolean?] | null;
  press: (e: KeyEnv) => void;
  release?: (e: KeyEnv) => void;
  /** Is this the key a lesson step points at? */
  target?: (control: string | undefined, value: unknown) => boolean;
  icon?: 'rec' | 'play' | 'stop' | 'up' | 'down' | 'left' | 'right' | 'gear' | 'metronome' | 'chain' | 'song';
  aria: string;
}

const pageKey = (name: string, label: string, rows: [string, string]): KeyDef => ({
  label,
  rows,
  aria: `${label} parameter key`,
  led: e => {
    if (lockedKeys(e.ctx).has(name)) return [COL.red, 1];
    // the open page's key: white on its first page, dimmed white on the second (manual p.12)
    const kv = keyOfView(e.view);
    if (!kv || kv.key !== name || !pageFor(e.track, e.view)) return null;
    return kv.second ? [COL.white, 0.5] : [COL.white, 1];
  },
  press: e => {
    if (e.func) { setView(e.ctx, V.SOUND); spendFunc(e.ctx); return; }
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
  led: e => (e.view === V[name] ? [COL.white, 1] : null),
  press: e => {
    if (e.func) { spendFunc(e.ctx); if (funcFn) funcFn(e); return; }
    setView(e.ctx, V[name]);
  },
  target: (c, v) => c === 'page' && v === V[name],
});

const lastTrackPress = { t: -1, at: 0 };
/** The last [STOP] press: a quick second press while stopped fades the send effects (manual p.38) */
const lastStopPress = { at: 0 };
/** The last [RECORD] + [PLAY]: a second [PLAY] soon after quantizes the live recording (manual p.41) */
const lastLivePlay = { at: 0 };

/** The held trig(s) of the active track, if any */
function heldTrig(ctx: CustomRenderContext): { track: number; pattern: string; steps: number[]; first: Step | undefined } | null {
  const u = ctx.ui;
  const steps = Array.isArray(u[UI.heldSteps]) ? (u[UI.heldSteps] as number[]) : [];
  if (!steps.length || typeof u[UI.heldTrack] !== 'number') return null;
  const track = u[UI.heldTrack] as number;
  const pr = project(ctx);
  const pattern = (u[UI.heldPattern] as string) ?? pr.active;
  return { track, pattern, steps, first: getPattern(pr, pattern).tracks[track]?.steps[steps[0]] };
}

/** PARAMETER keys whose pages hold locks of the held trig (they light red, manual p.50) */
function lockedKeys(ctx: CustomRenderContext): Set<string> {
  const out = new Set<string>();
  const h = heldTrig(ctx);
  if (!h?.first?.locks) return out;
  for (const key of Object.keys(h.first.locks)) {
    const r = routeOf(`${h.track < SYNTH_TRACKS ? `t${h.track + 1}_` : h.track === FX_TRACK ? 'fx_' : 'cv_'}${key}`);
    const kv = r && r.view >= 0 ? keyOfView(r.view) : null;
    if (kv) out.add(kv.key);
  }
  return out;
}

const trackKey = (t: number): KeyDef => ({
  label: TRACK_NAMES[t],
  sub: 'Mute',
  aria: `Track ${TRACK_NAMES[t]}`,
  led: e => {
    const pr = project(e.ctx);
    // [TRNS] held: the lit track keys are the transposable ones (manual p.53)
    if (trnsHeld(e.ctx)) return t < SYNTH_TRACKS && isTransposable(pr, viewPattern(e.ctx, pr), t) ? [COL.red, 1] : null;
    const muted = masterMuted(pr, t) || !!getPattern(pr, viewPattern(e.ctx, pr)).tracks[t]?.mute;
    // red = active, yellow = active and muted, green = audible, dark = muted; with the FX or CV
    // track active, the synth track the keyboard still plays is half-bright red (manual p.13, p.36);
    // a song mute of the playing song position shows half-bright (p.56)
    if (e.track === t) return muted ? [COL.yellow, 1] : [COL.red, 1];
    if (trackKind(e.track) !== 'synth' && e.ctx.engine.kbTrack === t) return [COL.red, 0.4];
    if (muted) return null;
    return songMuted(pr, seqStateOf(e.ctx.engine), t) ? [COL.green, 0.3] : [COL.green, 0.7];
  },
  press: e => {
    if (e.func) {
      const m = !masterMuted(project(e.ctx), t);
      e.ctx.updateData(d => setMasterMute(asProject(d, TRACKS), t, m));
      spendFunc(e.ctx);
      say(e.ctx, `${TRACK_NAMES[t]} ${m ? 'MUTED' : 'UNMUTED'}`, 1000);
      return;
    }
    // [TRNS] + [TRACK]: TRANSPOSABLE on / off for this track in the pattern (NOTES SETUP, manual p.47)
    if (trnsHeld(e.ctx)) {
      if (t >= SYNTH_TRACKS) return;
      const pr = project(e.ctx);
      const pat = viewPattern(e.ctx, pr);
      const on = !isTransposable(pr, pat, t);
      e.ctx.updateData(d => setTransposable(asProject(d, TRACKS), pat, t, on));
      say(e.ctx, `${TRACK_NAMES[t]} ${on ? 'TRANSPOSES' : 'KEEPS ITS NOTES (NOT TRANSPOSABLE)'}`, 1400);
      return;
    }
    const u = liveUi(e.ctx);
    const down = Array.isArray(u[UIK.trackDown]) ? (u[UIK.trackDown] as number[]) : [];
    e.ctx.setUi({ [UI.heldSteps]: [], [UI.trigEditor]: null, [UIK.trackDown]: [...down.filter(x => x !== t), t] });
    // LIVE RECORDING: [TRACK] + [NO] erases that track's trigs as the playhead passes them (manual p.41)
    if (e.ctx.values.live_rec && u[UIK.yesNo] === 'no') startErase(e.ctx, 'trigs', [...down.filter(x => x !== t), t]);
    const now = performance.now();
    const twice = lastTrackPress.t === t && now - lastTrackPress.at < 380 && t < SYNTH_TRACKS;
    lastTrackPress.t = t; lastTrackPress.at = now;
    e.ctx.setValue('track', t);
    if (twice) toggleA4Menu(e.ctx, 'sound');
  },
  release: e => {
    const down = liveUi(e.ctx)[UIK.trackDown];
    const rest = Array.isArray(down) ? (down as number[]).filter(x => x !== t) : [];
    e.ctx.setUi({ [UIK.trackDown]: rest });
    const er = liveUi(e.ctx)[UIK.erase] as EraseMode | null | undefined;
    if (er?.kind === 'trigs') e.ctx.setUi({ [UIK.erase]: rest.length ? { ...er, tracks: rest } : null });
  },
  target: (c, v) => c === 'track' && v === t,
});

/** [TRNS] held down (not TRANSPOSE LOCK, which keeps the keyboard for transposing only) */
function trnsHeld(ctx: CustomRenderContext): boolean {
  const u = liveUi(ctx);
  return !!u[UIK.trns] && !u[UIK.trnsLock];
}

/** LIVE RECORDING: start a real-time erase; it runs while the keys stay down (ui.tsx Helpers applies it) */
function startErase(ctx: CustomRenderContext, kind: EraseMode['kind'], tracks: number[], key?: string) {
  ctx.setUi({ [UIK.erase]: { kind, tracks, key } satisfies EraseMode });
  say(ctx, kind === 'locks' ? 'ERASING LOCKS AS IT PLAYS' : kind === 'trigs' ? `ERASING ${tracks.map(x => TRACK_NAMES[x]).join(' ')} TRIGS AS IT PLAYS` : 'ERASING THAT LOCK AS IT PLAYS', 1200);
}

/** BANK E-H: the trig flag each one sets with a held trig, its trig_mode, its LED colour (manual p.51-53) */
const BANK_FLAGS = [
  { flag: 'mute', mode: 4, color: COL.green, name: 'TRIG MUTE' },
  { flag: 'accent', mode: 1, color: COL.pink, name: 'ACCENT' },
  { flag: 'slide', mode: 2, color: COL.yellow, name: 'NOTE SLIDE' },
  { flag: 'pslide', mode: 3, color: COL.cyan, name: 'PARAMETER SLIDE' },
] as const;

function bankKey(b: number): KeyDef {
  const letter = 'ABCDEFGH'[b];
  const subs = ['', '', '', '', 'Trig Mute', 'Accent', 'Note Slide', 'Param Slide'];
  const bf = b >= 4 ? BANK_FLAGS[b - 4] : null;
  return {
    label: letter,
    sub: subs[b] || undefined,
    aria: `Bank ${letter}`,
    led: e => {
      const u = e.ctx.ui;
      // a held trig lights the BANK key of each flag it carries (manual p.51-53)
      const h = bf ? heldTrig(e.ctx) : null;
      if (h && bf) return h.first?.[bf.flag] ? [bf.color, 1] : null;
      if (u[UIK.bank] === b) return [COL.red, 1];
      if (e.func && bf) return num(e.ctx.values.trig_mode) === bf.mode ? [bf.color, 1] : [COL.white, 0.25];
      const pr = project(e.ctx);
      const st = seqStateOf(e.ctx.engine);
      const playing = st?.playing && st.pattern ? parsePatternId(st.pattern)?.bank : undefined;
      if (playing === b) return [COL.green, 0.7];
      if (parsePatternId(pr.active)?.bank === b) return [COL.red, 0.45];
      return null;
    },
    press: e => {
      if (e.func) {
        spendFunc(e.ctx);
        if (b === 3) {
          // TEMP JUMP arms once: the next pattern plays to its end, then the previous one returns (manual p.40)
          e.ctx.sendEvent('seq:temp-jump');
          say(e.ctx, 'TEMP JUMP ARMED: PICK A PATTERN', 1400);
          return;
        }
        if (b < 3) {
          const mode = CHANGE_MODES[b];
          e.ctx.updateData(d => setChangeMode(asProject(d, TRACKS), mode));
          say(e.ctx, ['SEQUENTIAL', 'DIRECT START', 'DIRECT JUMP'][b]);
          return;
        }
        const cur = num(e.ctx.values.trig_mode);
        const mode = bf!.mode;
        e.ctx.setValue('trig_mode', cur === mode ? 0 : mode);
        say(e.ctx, cur === mode ? 'TRIGS' : TRIG_MODE_HINTS[mode]);
        return;
      }
      const h = bf ? heldTrig(e.ctx) : null;
      if (h && bf) {
        const on = !h.first?.[bf.flag];
        if (bf.flag === 'mute') e.ctx.updateData(d => setTrigMute(asProject(d, TRACKS), h.pattern, h.track, h.steps, on));
        else e.ctx.updateData(d => updateSteps(asProject(d, TRACKS), h.pattern, h.track, h.steps, { [bf.flag]: on ? true : null }, { create: false }));
        e.ctx.setUi({ [UI.heldEdited]: true });
        say(e.ctx, `${bf.name} ${on ? 'ON' : 'OFF'}`, 1000);
        return;
      }
      const cur = liveUi(e.ctx)[UIK.bank];
      e.ctx.setUi({ [UIK.bank]: cur === b ? null : b, [UIK.qper]: false });
      if (cur !== b) say(e.ctx, `BANK ${letter}: CHOOSE PTN`, 1500);
    },
    target: (c, v) => !!bf && c === 'trig_mode' && v === bf.mode,
  };
}

const TRIG_MODE_HINTS = ['TRIGS', 'ACCENT: tap trigs to accent them', 'NOTE SLIDE: tap trigs to slide into them', 'PARAMETER SLIDE: tap trigs', 'TRIG MUTE: tap trigs to mute them'];

const KEYDEFS: Record<string, KeyDef> = {
  GLOBAL: {
    label: '', icon: 'gear', sub: 'Save Project', aria: 'Global settings',
    led: e => (e.ctx.ui[UIK.menu] === 'global' ? [COL.red, 1] : null),
    press: e => { if (e.func) { spendFunc(e.ctx); say(e.ctx, 'PROJECT SAVED (the studio keeps it)'); return; } toggleA4Menu(e.ctx, 'global'); },
  },
  QPER: {
    label: 'QPER', sub: 'Mute', aria: 'Quick performance',
    // green while the performance macros act, dark while they are muted (manual p.27)
    led: e => (e.ctx.ui[UIK.qper] ? [COL.white, 1] : e.ctx.values.perf_mute ? null : [COL.green, 0.75]),
    press: e => {
      if (e.func) { spendFunc(e.ctx); const m = !e.ctx.values.perf_mute; e.ctx.setValue('perf_mute', m); say(e.ctx, m ? 'PERFORMANCE MACROS MUTED' : 'MACROS ON'); return; }
      const on = !liveUi(e.ctx)[UIK.qper];
      e.ctx.setUi({ [UIK.qper]: on, [UIK.bank]: null });
      if (on) say(e.ctx, 'QUICK PERF: PICK A MACRO (TRIG 1-10)', 1800);
    },
    target: c => c === 'qper_sel' || c === 'perf_mute',
  },
  TEMPO: {
    label: '', icon: 'metronome', sub: 'Tap Tempo', aria: 'Tempo',
    led: e => (e.ctx.ui[UIK.menu] === 'tempo' ? [COL.white, 1] : null),
    press: e => {
      if (!e.func) { toggleA4Menu(e.ctx, 'tempo'); return; }
      const now = performance.now();
      if (tapTimes.length && now - tapTimes[tapTimes.length - 1] > 2000) tapTimes.length = 0;
      tapTimes.push(now);
      if (tapTimes.length > 8) tapTimes.shift();
      if (tapTimes.length >= 4) {
        const span = (tapTimes[tapTimes.length - 1] - tapTimes[0]) / (tapTimes.length - 1);
        const bpm = Math.round(Math.min(300, Math.max(30, 60000 / span)) * 10) / 10;
        setTempo(e.ctx, bpm);
        say(e.ctx, `TAP ${bpm.toFixed(1)} BPM`, 1200);
      } else say(e.ctx, `TAP ${tapTimes.length}/4`, 1200);
      e.ctx.setUi({ [UIK.func]: 'latched' }); // keep tapping
    },
    target: c => c === 'tempo',
  },
  FUNC: { label: 'FUNC', aria: 'Function', press: () => undefined, target: () => false },
  KIT: {
    label: 'KIT', sub: 'Save Kit', aria: 'Kit menu',
    led: e => (e.ctx.ui[UIK.menu] === 'kit' ? [COL.red, 1] : null),
    press: e => { if (e.func) { spendFunc(e.ctx); say(e.ctx, 'KIT SAVED (with the project)'); return; } toggleA4Menu(e.ctx, 'kit'); },
  },
  SND: {
    label: 'SND', sub: 'Settings', aria: 'Sound menu',
    led: e => (e.ctx.ui[UIK.menu] === 'sound' || e.view === V.SOUND || e.view === V.SOUND_2 ? [COL.red, 1] : null),
    press: e => {
      if (e.func) { spendFunc(e.ctx); setView(e.ctx, viewAfterPress('SOUND', e.track, e.view)); return; }
      toggleA4Menu(e.ctx, 'sound');
    },
    target: (c, v) => c === 'page' && (v === V.SOUND || v === V.SOUND_2),
  },
  // [FUNC] + [MIX] opens POLY CONFIG (manual p.28)
  MIX: {
    ...viewKey('MIX', 'MIX', 'Poly Config', e => toggleA4Menu(e.ctx, 'poly')),
    led: e => (e.ctx.ui[UIK.menu] === 'poly' ? [COL.lightBlue, 1] : e.view === V.MIX ? [COL.white, 1] : null),
    target: (c, v) => (c === 'page' && v === V.MIX) || (typeof c === 'string' && c.startsWith('poly_')),
  },
  PERF: viewKey('PERF', 'PERF', 'Setup', e => say(e.ctx, 'PERF SETUP: the macros are fixed; see the PERF page')),
  TRK: {
    label: 'TRK', sub: 'Metronome', aria: 'Track menu',
    led: e => (e.ctx.ui[UIK.menu] === 'track' ? [COL.red, 1] : null),
    press: e => {
      if (e.func) { spendFunc(e.ctx); say(e.ctx, 'CLICK TRACK: use the studio metronome (Click)'); return; }
      if (quickSaveReload(e, 'track')) return;
      toggleA4Menu(e.ctx, 'track');
    },
  },
  PTN: {
    label: 'PTN', sub: 'Swing', aria: 'Pattern menu',
    led: e => (e.ctx.ui[UIK.menu] === 'pattern' || e.ctx.ui[UI.menu] === 'pattern' ? [COL.red, 1] : null),
    press: e => {
      if (e.func) { spendFunc(e.ctx); toggleA4Menu(e.ctx, 'swing'); return; }
      if (quickSaveReload(e, 'pattern')) return;
      toggleA4Menu(e.ctx, 'pattern');
    },
    target: c => c === 'seq:menu:pattern',
  },
  SONG: {
    label: 'SONG', sub: 'Save Song', aria: 'Song menu',
    led: e => (e.ctx.ui[UI.menu] === 'song' ? [COL.red, 1] : null),
    press: e => { if (e.func) { spendFunc(e.ctx); say(e.ctx, 'SONG SAVED (with the project)'); return; } toggleKitMenu(e.ctx, 'song'); },
  },
  // Held, [YES] / [NO] + [PTN] or [TRK] quick-saves / quick-reloads (manual p.54)
  YES: {
    label: 'YES', sub: 'Save', subPlain: true, aria: 'Yes',
    press: e => { if (e.func) spendFunc(e.ctx); closeMenus(e.ctx); e.ctx.setUi({ [UIK.yesNo]: 'yes' }); },
    release: e => e.ctx.setUi({ [UIK.yesNo]: null }),
  },
  NO: {
    label: 'NO', sub: 'Reload', subPlain: true, aria: 'No',
    press: e => {
      const live = !!e.ctx.values.live_rec;
      const down = liveUi(e.ctx)[UIK.trackDown];
      if (e.func) spendFunc(e.ctx);
      closeMenus(e.ctx);
      e.ctx.setUi({ [UIK.yesNo]: 'no' });
      // LIVE RECORDING real-time erase (manual p.41, p.50): [FUNC] + [NO] the active track's locks,
      // [TRACK] + [NO] the held tracks' trigs, while the keys stay down
      if (live && e.func) startErase(e.ctx, 'locks', [Math.min(e.track, TRACKS - 1)]);
      else if (live && Array.isArray(down) && down.length) startErase(e.ctx, 'trigs', down as number[]);
      // STEP RECORDING: [NO] removes the active step's trig (a rest) and moves on (manual p.41)
      const sr = stepRecOf(e.ctx);
      if (sr && !e.func) {
        const pr = project(e.ctx);
        const pat = viewPattern(e.ctx, pr);
        const t = Math.min(e.track, TRACKS - 1);
        const len = trackLength(getPattern(pr, pat), t);
        e.ctx.updateData(d => setStepFn(asProject(d, TRACKS), pat, t, sr.step, null));
        const step = (sr.step + 1) % len;
        e.ctx.setUi({ [UIK.stepRec]: { ...sr, step }, [UI.stepPage]: Math.floor(step / 16) });
        say(e.ctx, `REST ON STEP ${sr.step + 1}`, 800);
      }
    },
    release: e => e.ctx.setUi({ [UIK.yesNo]: null, [UIK.erase]: null }),
  },
  UP: { label: '', icon: 'up', aria: 'Up', press: e => arrow(e, 0, 1) },
  DOWN: { label: '', icon: 'down', aria: 'Down', press: e => arrow(e, 0, -1) },
  LEFT: { label: '', icon: 'left', sub: 'µTime -', subPlain: true, aria: 'Left', press: e => arrow(e, -1, 0), release: arrowUp },
  RIGHT: { label: '', icon: 'right', sub: 'µTime +', subPlain: true, aria: 'Right', press: e => arrow(e, 1, 0), release: arrowUp },
  SONGMODE: {
    label: '', icon: 'song', sub: 'Edit Song', aria: 'Song mode',
    led: e => (project(e.ctx).mode === 'song' ? [COL.red, 1] : null),
    press: e => {
      if (e.func) { spendFunc(e.ctx); toggleKitMenu(e.ctx, 'song'); return; }
      const pr = project(e.ctx);
      const on = pr.mode !== 'song';
      e.ctx.updateData(d => setPlayMode(asProject(d, TRACKS), on ? 'song' : 'pattern'));
      say(e.ctx, on ? (pr.song.rows.length ? 'SONG MODE: PLAY plays the song' : 'SONG MODE: the song is empty ([FUNC] + [SONG M])') : 'PATTERN MODE');
    },
    target: c => c === 'seq:mode:song',
  },
  CHAIN: {
    label: '', icon: 'chain', sub: 'New Chain', aria: 'Chain mode',
    led: e => (project(e.ctx).mode === 'chain' ? [COL.red, 1] : null),
    press: e => {
      if (e.func) { spendFunc(e.ctx); e.ctx.updateData(d => setChain(asProject(d, TRACKS), [])); toggleKitMenu(e.ctx, 'chain'); say(e.ctx, 'NEW CHAIN: add patterns in order'); return; }
      const pr = project(e.ctx);
      const on = pr.mode !== 'chain';
      e.ctx.updateData(d => setPlayMode(asProject(d, TRACKS), on ? 'chain' : 'pattern'));
      say(e.ctx, on ? (pr.chain.length ? `CHAIN MODE: ${pr.chain.join(' ')}` : 'CHAIN MODE: the chain is empty ([FUNC] + [CHAIN])') : 'PATTERN MODE');
    },
  },
  RECORD: {
    label: '', icon: 'rec', sub: 'Copy', aria: 'Record',
    // lit in GRID RECORDING; flashing in LIVE RECORDING (manual p.40)
    led: e => (e.ctx.values.live_rec ? [COL.red, 1, true] : e.ctx.values.rec ? [COL.red, 0.85] : null),
    press: e => {
      if (e.func) { spendFunc(e.ctx); copyPaste(e, 'copy'); return; }
      // [PAGE] + [RECORD] copies the page, held trigs + [RECORD] copy the trigs, [TRACK] + [RECORD] the Sound (manual p.54)
      if (pageOp(e, 'copy') || trigOp(e, 'copy') || soundOp(e, 'copy')) return;
      e.ctx.setUi({ [UIK.recDown]: true, [UIK.recCombo]: false });
      // in STEP RECORDING [RECORD] leaves it - on release, unless [STOP] switched STANDARD / JUMP meanwhile
      if (stepRecOf(e.ctx)) return;
      if (e.ctx.values.live_rec) { e.ctx.setValue('live_rec', false); e.ctx.setValue('rec', true); say(e.ctx, 'GRID RECORDING'); return; }
      e.ctx.setValue('rec', !e.ctx.values.rec);
    },
    release: e => {
      const combo = !!liveUi(e.ctx)[UIK.recCombo];
      e.ctx.setUi({ [UIK.recDown]: false });
      if (stepRecOf(e.ctx) && !combo) { setStepRec(e.ctx, null); say(e.ctx, 'GRID RECORDING', 1000); }
    },
    target: (c, v) => (c === 'rec' && typeof v === 'boolean') || c === 'live_rec' || c === 'seq:step-rec',
  },
  PLAY: {
    label: '', icon: 'play', sub: 'Clear', aria: 'Play',
    // green while playing; paused, it blinks
    led: e => (e.playing ? [COL.green, 1] : seqStateOf(e.ctx.engine)?.paused ? [COL.green, 0.6, true] : null),
    press: e => {
      if (e.func) { spendFunc(e.ctx); copyPaste(e, 'clear'); return; }
      // [PAGE] + [PLAY] clears the page, held trigs + [PLAY] clear their locks (manual p.54)
      if (pageOp(e, 'clear') || trigOp(e, 'clear')) return;
      if (liveUi(e.ctx)[UIK.recDown]) {
        e.ctx.setUi({ [UIK.recCombo]: true });
        if (stepRecOf(e.ctx)) { pressPlay(e.ctx); return; }
        // [RECORD] + [PLAY] records live; a second [PLAY] before [RECORD] is let go quantizes it (manual p.40-41)
        const again = !!e.ctx.values.live_rec && performance.now() - lastLivePlay.at < 700;
        lastLivePlay.at = performance.now();
        e.ctx.setValue('rec', true);
        e.ctx.setValue('live_rec', true);
        e.ctx.setUi({ [UIK.liveQuant]: again });
        e.ctx.sendEvent('a4:live-quant', { on: again });
        if (!e.playing) pressPlay(e.ctx);
        say(e.ctx, again ? 'LIVE RECORDING, QUANTIZED: notes land on the steps' : 'LIVE RECORDING: play the keyboard, turn knobs');
        return;
      }
      if (e.ctx.values.live_rec && e.playing) { e.ctx.setValue('live_rec', false); say(e.ctx, 'LIVE RECORDING OFF'); return; }
      // [PLAY] while playing pauses, [PLAY] again resumes (manual p.39). Following the studio
      // transport (like MIDI clock) there is no pause: PLAY / STOP drive the studio transport.
      const st = seqStateOf(e.ctx.engine);
      if (e.playing && !st?.following) say(e.ctx, 'PAUSED (PLAY RESUMES)', 1400);
      pressPlay(e.ctx);
    },
    target: (c, v) => c === 'play' && v === true,
  },
  STOP: {
    label: '', icon: 'stop', sub: 'Paste', aria: 'Stop',
    led: e => (!e.playing ? [COL.white, 0.5] : null),
    press: e => {
      if (e.func) { spendFunc(e.ctx); copyPaste(e, 'paste'); return; }
      // [PAGE] + [STOP] pastes the page, a held trig + [STOP] pastes the copied trigs from it, [TRACK] + [STOP] the Sound (manual p.54)
      if (pageOp(e, 'paste') || trigOp(e, 'paste') || soundOp(e, 'paste')) return;
      // [RECORD] + [STOP]: STEP RECORDING; [STOP] again with [RECORD] still held switches STANDARD / JUMP (manual p.41)
      if (liveUi(e.ctx)[UIK.recDown]) {
        e.ctx.setUi({ [UIK.recCombo]: true });
        const sr = stepRecOf(e.ctx);
        const page = Math.round(Number(e.ctx.ui[UI.stepPage]) || 0);
        const next: StepRec = sr ? { ...sr, jump: !sr.jump } : { jump: false, step: page * 16 };
        setStepRec(e.ctx, next);
        say(e.ctx, `STEP RECORDING ${next.jump ? 'JUMP' : 'STANDARD'}: PLAY THE KEYBOARD`, 1600);
        return;
      }
      const now = performance.now();
      const quick = now - lastStopPress.at < 500;
      lastStopPress.at = now;
      // [STOP] cuts the sound, the send effects ring on; [STOP][STOP] fades them too (manual p.38).
      // A paused pattern stops too, so the next PLAY starts from the top.
      if (!e.playing && !seqStateOf(e.ctx.engine)?.paused && quick) { e.ctx.sendEvent('a4:fxfade'); say(e.ctx, 'SEND FX FADED', 900); }
      else e.ctx.sendEvent('a4:stopkey'); // this stop lets the send effects ring out (a studio stop fades them)
      pressStop(e.ctx);
      if (e.ctx.values.live_rec) e.ctx.setValue('live_rec', false);
    },
    target: (c, v) => c === 'play' && v === false,
  },
  ARP: viewKey('ARP', 'ARP', 'Setup', e => setView(e.ctx, V.ARP)),
  NOTE: viewKey('NOTE', 'NOTE', 'Setup', e => setView(e.ctx, V.NOTE)),
  OSC1: pageKey('OSC1', 'OSC1', ['Ext In', 'CV A']),
  OSC2: pageKey('OSC2', 'OSC2', ['', 'CV B']),
  FLTR: pageKey('FLTR', 'FLTR', ['Chorus', 'CV C']),
  AMP: pageKey('AMP', 'AMP', ['Delay', 'CV D']),
  ENV: pageKey('ENV', 'ENV', ['Reverb', 'Env']),
  LFO: pageKey('LFO', 'LFO', ['LFO', 'LFO']),
  OCT_DOWN: {
    label: 'OCT-', aria: 'Octave down',
    press: e => { const o = Math.max(0, num(e.ctx.values.kb_oct, 5) - 1); e.ctx.setValue('kb_oct', o); say(e.ctx, `OCTAVE ${o - 5 > 0 ? '+' : ''}${o - 5}`, 1000); },
    target: (c, v) => c === 'kb_oct' && typeof v === 'number' && v < 5,
  },
  OCT_UP: {
    label: 'OCT+', aria: 'Octave up',
    press: e => { const o = Math.min(10, num(e.ctx.values.kb_oct, 5) + 1); e.ctx.setValue('kb_oct', o); say(e.ctx, `OCTAVE ${o - 5 > 0 ? '+' : ''}${o - 5}`, 1000); },
    target: (c, v) => c === 'kb_oct' && typeof v === 'number' && v > 5,
  },
  TRNS: {
    label: 'TRNS', sub: 'Lock', aria: 'Transpose',
    led: e => (e.ctx.ui[UIK.trnsLock] ? [COL.red, 1] : e.ctx.ui[UIK.trns] ? [COL.red, 0.8] : num(e.ctx.values.trns) !== 0 ? [COL.red, 0.35] : null),
    press: e => {
      if (e.func) {
        spendFunc(e.ctx);
        const lock = !liveUi(e.ctx)[UIK.trnsLock];
        e.ctx.setUi({ [UIK.trnsLock]: lock, [UIK.trns]: lock });
        say(e.ctx, lock ? 'TRANSPOSE LOCK: THE KEYBOARD TRANSPOSES' : 'TRANSPOSE LOCK OFF', 1600);
        return;
      }
      e.ctx.setUi({ [UIK.trns]: true });
      say(e.ctx, `HOLD TRNS + A KEY (now ${num(e.ctx.values.trns) > 0 ? '+' : ''}${num(e.ctx.values.trns)})`, 1800);
    },
    release: e => { if (!liveUi(e.ctx)[UIK.trnsLock]) e.ctx.setUi({ [UIK.trns]: false }); },
    target: c => c === 'trns',
  },
  T1: trackKey(0), T2: trackKey(1), T3: trackKey(2), T4: trackKey(3), FX: trackKey(4), CV: trackKey(5),
  FILL: {
    label: 'FILL', sub: 'Cue Fill', aria: 'Fill',
    led: e => (seqStateOf(e.ctx.engine)?.fill ? [COL.red, 1] : null),
    press: e => {
      if (e.func) { spendFunc(e.ctx); e.ctx.sendEvent('seq:fill-cue'); say(e.ctx, 'FILL CUED for one cycle'); return; }
      if (e.ctx.values.rec) { say(e.ctx, 'FILL WORKS WITH GRID RECORDING OFF: PRESS REC', 1800); return; }
      e.ctx.sendEvent('seq:fill');
    },
    release: e => e.ctx.sendEvent('seq:fill:up'),
  },
  PAGE: {
    label: 'PAGE', sub: 'Scale', aria: 'Pattern page',
    // held, [PAGE] + [RECORD] / [STOP] / [PLAY] copy, paste and clear the shown page (manual p.54); let go
    // without one of them it shows the next page
    press: e => {
      if (e.func) { spendFunc(e.ctx); toggleKitMenu(e.ctx, 'scale'); return; }
      e.ctx.setUi({ [UIK.pageDown]: true, [UIK.pageCombo]: false });
    },
    release: e => {
      const u = liveUi(e.ctx);
      if (!u[UIK.pageDown]) return;
      e.ctx.setUi({ [UIK.pageDown]: false });
      if (u[UIK.pageCombo]) return;
      const pr = project(e.ctx);
      const pat = viewPattern(e.ctx, pr);
      const len = trackLength(getPattern(pr, pat), Math.min(e.track, TRACKS - 1));
      const pages = Math.max(1, Math.ceil(len / 16));
      const cur = Math.round(Number(e.ctx.ui[UI.stepPage]) || 0);
      e.ctx.setUi({ [UI.stepPage]: (cur + 1) % pages });
    },
    target: c => c === 'seq:pages' || c === 'seq:page-copy',
  },
};
for (let b = 0; b < 8; b++) KEYDEFS[`BANK_${'ABCDEFGH'[b]}`] = bankKey(b);

/** [YES] / [NO] held + [PTN] / [TRK]: SAVE / RELOAD PATTERN or TRACK (manual p.42-43, p.54). True when it acted. */
function quickSaveReload(e: KeyEnv, what: 'pattern' | 'track'): boolean {
  const yn = liveUi(e.ctx)[UIK.yesNo];
  if (yn !== 'yes' && yn !== 'no') return false;
  const t = Math.min(e.track, TRACKS - 1);
  if (what === 'pattern') e.ctx.updateData(d => (yn === 'yes' ? savePattern : reloadPattern)(asProject(d, TRACKS)));
  else e.ctx.updateData(d => (yn === 'yes' ? saveTrack(asProject(d, TRACKS), t) : reloadTrack(asProject(d, TRACKS), t)));
  say(e.ctx, `${yn === 'yes' ? 'SAVE' : 'RELOAD'} ${what === 'pattern' ? `PATTERN ${project(e.ctx).active}` : `TRACK ${TRACK_NAMES[t]}`}`, 1200);
  return true;
}

/** Arrow keys: with held trigs they edit them (UP/DOWN note, LEFT/RIGHT micro timing), else track / page */
function arrow(e: KeyEnv, dx: number, dy: number) {
  const ctx = e.ctx;
  const u = liveUi(ctx);
  const held = Array.isArray(u[UI.heldSteps]) ? (u[UI.heldSteps] as number[]) : [];
  if (e.func) spendFunc(ctx);
  if (held.length && typeof u[UI.heldTrack] === 'number') {
    const track = u[UI.heldTrack] as number;
    const pat = (u[UI.heldPattern] as string) ?? project(ctx).active;
    const p0 = project(ctx);
    const first = getPattern(p0, pat).tracks[track]?.steps[held[0]] as Step | undefined;
    const tdef = getPattern(p0, pat).tracks[track];
    if (dy) {
      const note = Math.max(0, Math.min(127, (first?.note ?? tdef?.note ?? 60) + dy * (e.func ? 12 : 1)));
      editTrigs(ctx, p => updateSteps(p, pat, track, held, { note }, { create: 'note' }));
      say(ctx, `NOTE ${formatNote(note)}`, 900);
    } else {
      const micro = Math.max(-23, Math.min(23, (first?.micro ?? 0) + dx * (e.func ? 6 : 1)));
      ctx.updateData(d => updateSteps(asProject(d, TRACKS), pat, track, held, { micro }, { create: false }));
      say(ctx, `MICRO TIMING ${micro > 0 ? '+' : ''}${micro}/384`, 900);
    }
    ctx.setUi({ [UI.heldEdited]: true });
    return;
  }
  // STEP RECORDING: LEFT / RIGHT move the active step (or skip steps, manual p.41)
  const sr = stepRecOf(ctx);
  if (sr && dx) {
    const pr = project(ctx);
    const len = trackLength(getPattern(pr, viewPattern(ctx, pr)), Math.min(e.track, TRACKS - 1));
    const step = (((sr.step + dx) % len) + len) % len;
    ctx.setUi({ [UIK.stepRec]: { ...sr, step }, [UI.stepPage]: Math.floor(step / 16) });
    say(ctx, `STEP ${step + 1}`, 700);
    return;
  }
  if (dy && u[UIK.menu] === 'tempo') {
    const st0 = useStudioStore.getState();
    const cur = st0.studio.sync[ctx.instance] !== false ? st0.studio.bpm : num(ctx.values.tempo, 120);
    setTempo(ctx, Math.max(30, Math.min(300, Math.round((cur + dy * 0.1) * 10) / 10)));
    return;
  }
  if (dy) {
    const o = Math.max(0, Math.min(10, num(ctx.values.kb_oct, 5) + dy));
    ctx.setValue('kb_oct', o);
    say(ctx, `OCTAVE ${o - 5 > 0 ? '+' : ''}${o - 5}`, 900);
    return;
  }
  const st = useStudioStore.getState();
  const base = st.studio.sync[ctx.instance] !== false ? st.studio.bpm : num(ctx.values.tempo, 120);
  tempoShift.base = base;
  setTempo(ctx, Math.round(base * (dx > 0 ? 1.1 : 0.9) * 10) / 10);
  say(ctx, `TEMPO SHIFT ${dx > 0 ? '+' : '-'}10%`, 900);
}

const tempoShift: { base: number | null } = { base: null };
/** Releasing LEFT / RIGHT ends a tempo shift */
function arrowUp(e: KeyEnv) {
  if (tempoShift.base === null) return;
  const b = tempoShift.base;
  tempoShift.base = null;
  setTempo(e.ctx, b);
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

// ---- Copy, paste and clear of pages, trigs and Sounds (manual p.19, p.54) ---------------------

/** Some steps of a track as they are (null = no trig), for undoing a paste or clear */
type Snap = Record<number, Step | null>;

function snap(pr: Project, pat: string, track: number, steps: readonly number[]): Snap {
  const t = getPattern(pr, pat).tracks[track];
  const out: Snap = {};
  for (const i of steps) out[i] = t?.steps[i] ? (JSON.parse(JSON.stringify(t.steps[i])) as Step) : null;
  return out;
}

function restoreSnap(p: Project, pat: string, track: number, s: Snap): Project {
  for (const k in s) p = setStepFn(p, pat, track, Number(k), s[k]);
  return p;
}

/** The last paste or clear: repeating it on what it left puts back what was there (and again, redoes it) */
interface EditUndo { key: string; op: string; pat: string; track: number; before: Snap; after: Snap }

/** Run a paste / clear (`fn`) on `steps`, or undo it when it repeats the last one (manual p.19). Returns 'undo' or 'done'. */
function editWithUndo(ctx: CustomRenderContext, key: string, op: string, pat: string, track: number, steps: readonly number[], fn: (p: Project) => Project): 'undo' | 'done' {
  const pr = project(ctx);
  const undo = liveUi(ctx)[UIK.pageUndo] as EditUndo | undefined;
  if (undo && undo.key === key && undo.op === op && JSON.stringify(snap(pr, pat, track, Object.keys(undo.after).map(Number))) === JSON.stringify(undo.after)) {
    ctx.updateData(d => restoreSnap(asProject(d, TRACKS), pat, track, undo.before));
    ctx.setUi({ [UIK.pageUndo]: { ...undo, before: undo.after, after: undo.before } satisfies EditUndo });
    return 'undo';
  }
  const before = snap(pr, pat, track, steps);
  const after = snap(fn(pr), pat, track, steps);
  ctx.updateData(d => fn(asProject(d, TRACKS)));
  ctx.setUi({ [UIK.pageUndo]: { key, op, pat, track, before, after } satisfies EditUndo });
  return 'done';
}

/** The shown track page's steps */
function pageRange(page: number): number[] {
  return Array.from({ length: 16 }, (_, i) => page * 16 + i);
}

/** [PAGE] held + [RECORD] / [STOP] / [PLAY]: copy, paste or clear the shown page of the active track (GRID RECORDING). True when it acted. */
function pageOp(e: KeyEnv, op: 'copy' | 'paste' | 'clear'): boolean {
  const ctx = e.ctx;
  const u = liveUi(ctx);
  if (!u[UIK.pageDown]) return false;
  ctx.setUi({ [UIK.pageCombo]: true });
  doPageOp(ctx, Math.min(e.track, TRACKS - 1), op);
  return true;
}

export function doPageOp(ctx: CustomRenderContext, track: number, op: 'copy' | 'paste' | 'clear') {
  if (!ctx.values.rec) { say(ctx, 'PAGE COPY, PASTE AND CLEAR NEED GRID RECORDING ([RECORD])', 1800); return; }
  const pr = project(ctx);
  const pat = viewPattern(ctx, pr);
  const page = Math.round(Number(ctx.ui[UI.stepPage]) || 0);
  const where = `PAGE ${page + 1} OF ${TRACK_NAMES[track]}`;
  if (op === 'copy') {
    ctx.setUi({ [UIK.clip]: { kind: 'page', steps: copyPage(pr, pat, track, page) } });
    say(ctx, `COPIED ${where}`);
    return;
  }
  if (op === 'paste') {
    const clip = liveUi(ctx)[UIK.clip] as { kind: string; steps: StepsClip } | undefined;
    if (!clip || clip.kind !== 'page') { say(ctx, 'COPY A PAGE FIRST ([PAGE] + [RECORD])', 1600); return; }
    const r = editWithUndo(ctx, `page:${pat}:${track}:${page}`, 'paste', pat, track, pageRange(page), p => pastePage(p, pat, track, page, clip.steps));
    say(ctx, r === 'undo' ? `${where}: PASTE UNDONE` : `PASTED INTO ${where} (AGAIN: UNDO)`);
    return;
  }
  const r = editWithUndo(ctx, `page:${pat}:${track}:${page}`, 'clear', pat, track, pageRange(page), p => clearPage(p, pat, track, page));
  say(ctx, r === 'undo' ? `${where}: CLEAR UNDONE` : `CLEARED ${where} (AGAIN: UNDO)`);
}

/**
 * Held trigs + [RECORD] / [STOP] / [PLAY] (GRID RECORDING): copy them with their locks, paste the copied
 * trigs from the held one on (in the same relation to each other), or clear their locks (manual p.54).
 * With the trig editor open its steps count as held, so a mouse can do it too. True when it acted.
 */
function trigOp(e: KeyEnv, op: 'copy' | 'paste' | 'clear'): boolean {
  const ctx = e.ctx;
  const u = liveUi(ctx);
  const held = Array.isArray(u[UI.heldSteps]) ? (u[UI.heldSteps] as number[]) : [];
  if (!held.length || typeof u[UI.heldTrack] !== 'number') return false;
  const track = u[UI.heldTrack] as number;
  const pat = (u[UI.heldPattern] as string) ?? project(ctx).active;
  // the held trig is not toggled when it is let go
  ctx.setUi({ [UI.heldEdited]: true });
  if (!ctx.values.rec) { say(ctx, 'TRIG COPY, PASTE AND CLEAR NEED GRID RECORDING ([RECORD])', 1800); return true; }
  const pr = project(ctx);
  if (op === 'copy') {
    const clip = copyTrigs(pr, pat, track, held);
    const n = Object.keys(clip).length;
    if (!n) { say(ctx, 'NO TRIG THERE TO COPY'); return true; }
    ctx.setUi({ [UIK.trigClip]: clip });
    say(ctx, `COPIED ${n} TRIG${n > 1 ? 'S' : ''}: HOLD ANOTHER TRIG + [STOP] PASTES`);
    return true;
  }
  if (op === 'paste') {
    const clip = u[UIK.trigClip] as StepsClip | undefined;
    if (!clip || !Object.keys(clip).length) { say(ctx, 'COPY TRIGS FIRST: HOLD THEM + [RECORD]', 1600); return true; }
    const at = Math.min(...held);
    const targets = Object.keys(clip).map(k => at + Number(k)).filter(i => i < 64);
    const r = editWithUndo(ctx, `trigs:${pat}:${track}:${at}`, 'paste', pat, track, targets, p => pasteTrigs(p, pat, track, at, clip));
    say(ctx, r === 'undo' ? 'PASTE UNDONE' : `PASTED ${targets.length} TRIG${targets.length > 1 ? 'S' : ''} FROM TRIG ${at + 1} (AGAIN: UNDO)`);
    return true;
  }
  const r = editWithUndo(ctx, `locks:${pat}:${track}:${held.join(',')}`, 'clear', pat, track, held, p => clearLocks(p, pat, track, held));
  say(ctx, r === 'undo' ? 'LOCKS PUT BACK' : `LOCKS CLEARED ON TRIG ${held.map(x => x + 1).join(' ')} (AGAIN: UNDO)`);
  return true;
}

/** [TRACK] held + [RECORD] / [STOP]: copy a synth track's Sound, or paste the copied one into it (manual p.54). True when it acted. */
function soundOp(e: KeyEnv, op: 'copy' | 'paste'): boolean {
  const down = liveUi(e.ctx)[UIK.trackDown];
  if (!Array.isArray(down) || !down.length) return false;
  doSoundOp(e.ctx, (down as number[])[down.length - 1], op);
  return true;
}

export function doSoundOp(ctx: CustomRenderContext, t: number, op: 'copy' | 'paste') {
  if (t < 0 || t >= SYNTH_TRACKS) { say(ctx, 'ONLY THE SYNTH TRACKS T1-T4 HAVE A SOUND'); return; }
  if (op === 'copy') {
    const vals: Record<string, number> = {};
    for (const key in SYNTH_BY_KEY) {
      if (key.startsWith('trig_') || key.startsWith('arp_') || key === 'level') continue;
      vals[key] = num(useStudioStore.getState().getControlValue(ctx.instance, `t${t + 1}_${key}`) ?? ctx.values[`t${t + 1}_${key}`], SYNTH_BY_KEY[key].def);
    }
    ctx.setUi({ [UIK.soundClip]: { from: t, vals } });
    say(ctx, `COPIED ${TRACK_NAMES[t]}'S SOUND: HOLD A TRACK KEY + [STOP] PASTES`);
    return;
  }
  const clip = liveUi(ctx)[UIK.soundClip] as { from: number; vals: Record<string, number> } | undefined;
  if (!clip) { say(ctx, 'COPY A SOUND FIRST: HOLD ITS TRACK KEY + [RECORD]', 1600); return; }
  const out: Record<string, ControlValue> = {};
  for (const key in clip.vals) out[`t${t + 1}_${key}`] = clip.vals[key];
  useStudioStore.getState().setControlValues(ctx.instance, out);
  say(ctx, `${TRACK_NAMES[clip.from]}'S SOUND PASTED INTO ${TRACK_NAMES[t]}`);
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

function Icon({ kind, color, size = 12 }: { kind: NonNullable<KeyDef['icon']>; color: string; size?: number }) {
  const s = size;
  const st = { fill: 'none', stroke: color, strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (kind) {
    case 'rec': return <svg width={s} height={s} viewBox="0 0 12 12"><circle cx="6" cy="6" r="4.2" {...st} strokeWidth={1.3} /></svg>;
    case 'play': return <svg width={s} height={s} viewBox="0 0 12 12"><path d="M3.4 1.8 L10 6 L3.4 10.2 Z" {...st} strokeWidth={1.3} /></svg>;
    case 'stop': return <svg width={s} height={s} viewBox="0 0 12 12"><rect x="2.4" y="2.4" width="7.2" height="7.2" rx="0.8" {...st} strokeWidth={1.3} /></svg>;
    case 'gear': return (
      <svg width={s} height={s} viewBox="0 0 12 12">
        <circle cx="6" cy="6" r="1.7" {...st} strokeWidth={1.1} />
        {Array.from({ length: 8 }, (_, i) => { const a = (i * Math.PI) / 4; return <line key={i} x1={6 + Math.cos(a) * 3.1} y1={6 + Math.sin(a) * 3.1} x2={6 + Math.cos(a) * 4.6} y2={6 + Math.sin(a) * 4.6} {...st} strokeWidth={1.3} />; })}
        <circle cx="6" cy="6" r="3.2" {...st} strokeWidth={1} />
      </svg>
    );
    case 'metronome': return <svg width={s} height={s} viewBox="0 0 12 12"><path d="M4.3 1.6 H7.7 L10 10.4 H2 Z" {...st} strokeWidth={1.1} /><path d="M6 8.6 L9.6 3" {...st} strokeWidth={1.1} /></svg>;
    case 'chain': return <svg width={s} height={s} viewBox="0 0 12 12"><rect x="0.9" y="3.4" width="6" height="3.6" rx="1.8" {...st} strokeWidth={1.1} /><rect x="5.1" y="5" width="6" height="3.6" rx="1.8" {...st} strokeWidth={1.1} /></svg>;
    case 'song': return (
      <svg width={s} height={s} viewBox="0 0 12 12">
        {[2.2, 5, 7.8, 10.6].map((y, i) => <g key={i}><line x1="1.4" y1={y} x2="3" y2={y} {...st} strokeWidth={1.2} /><line x1="4.6" y1={y} x2={i % 2 ? 8 : 10.6} y2={y} {...st} strokeWidth={1.2} /></g>)}
      </svg>
    );
    default: {
      const rot = { up: 0, right: 90, down: 180, left: 270 }[kind];
      return <svg width={s} height={s} viewBox="0 0 12 12" style={{ transform: `rotate(${rot}deg)` }}><path d="M2.3 8.2 L6 3.8 L9.7 8.2" {...st} strokeWidth={1.2} /></svg>;
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
      if (cur === 'latched') { ctx.setUi({ [UIK.func]: null }); applyPendingMutes(ctx); }
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
      if (u[UIK.func] === 'held') {
        ctx.setUi({ [UIK.func]: u[UIK.funcUsed] ? null : 'latched', [UIK.funcUsed]: false });
        if (u[UIK.funcUsed]) applyPendingMutes(ctx);
      }
      return;
    }
    def.release?.({ ...env, func: funcActive(ctx) });
  };

  // A key whose secondary function is being used lights up light blue (manual p.13)
  const funcPress = down && !isFunc && !!def.sub && !def.subPlain && funcActive(ctx);
  const led = funcPress ? ([COL.lightBlue, 1] as [string, number, boolean?]) : lit;
  const ledCol = led ? led[0] : null;
  const amt = led ? led[1] : 0;
  // FUNC: the light grey key (no LED); the ring shows a held / latched FUNC
  const face = isFunc ? (funcOn ? '#d3d5d8' : COL.func) : down ? '#36373b' : COL.key;
  // The keys are backlit through their legends: a lit key shows its legend in the LED colour
  // with a soft glow, the key itself stays dark (as on the black unit)
  const text = isFunc ? '#3a3c40' : ledCol ? mix(COL.keyText, ledCol, 0.55 + 0.45 * amt) : COL.keyText;
  const fs = name.startsWith('BANK') ? 11 : name === 'FUNC' ? 10 : box.w >= 15 ? 10.5 : TXT.cap;
  // the arrows' chevrons and the transport symbols fill about half the key, as printed
  const iconSize = big ? 22 : ['UP', 'DOWN', 'LEFT', 'RIGHT'].includes(name) ? 17 : 13;
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
        className={[highlight ? 'a4-target' : '', led?.[2] ? 'a4-blink' : '', big ? '' : box.w >= 15 ? 'a4-hit-v' : 'a4-hit'].filter(Boolean).join(' ') || undefined}
        style={{
          position: 'absolute', inset: 0, borderRadius: big ? 6 : 4.5, padding: 0, cursor: 'pointer',
          background: ledCol
            ? `linear-gradient(180deg, ${mix(mix(face, '#ffffff', 0.035), ledCol, 0.07 * amt)} 0%, ${mix(mix(face, '#000000', 0.2), ledCol, 0.04 * amt)} 100%)`
            : `linear-gradient(180deg, ${mix(face, '#ffffff', 0.035)} 0%, ${mix(face, '#000000', 0.2)} 100%)`,
          border: `1px solid ${ledCol ? mix(COL.keyEdge, ledCol, 0.16 * amt) : COL.keyEdge}`,
          boxShadow: [
            '0 2px 2px rgba(0,0,0,0.65)', '0 1px 0 rgba(0,0,0,0.8)',
            isFunc ? 'inset 0 1px 0 rgba(255,255,255,0.35)' : 'inset 0 1px 0 rgba(255,255,255,0.09)',
            ledCol ? `0 0 ${3 + 3 * amt}px ${ledCol}${amt > 0.6 ? '30' : '18'}` : '',
            funcOn ? '0 0 0 2px #e8eaee' : '',
          ].filter(Boolean).join(', '),
          transform: down ? 'translateY(1px)' : undefined,
          opacity: dim ? 0.3 : 1, transition: 'opacity 200ms',
          color: text, fontFamily: '"Helvetica Neue", Arial, sans-serif', fontWeight: 600, fontSize: fs, letterSpacing: 0.2,
          textShadow: ledCol && amt > 0.3 ? `0 0 ${3 + 4 * amt}px ${ledCol}` : undefined,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          touchAction: 'none', WebkitTapHighlightColor: 'transparent', userSelect: 'none', WebkitUserSelect: 'none',
        }}
      >
        {def.icon ? <Icon kind={def.icon} color={text} size={iconSize} /> : isFunc ? <span style={{ textDecoration: 'underline', textUnderlineOffset: 3 }}>{def.label}</span> : def.label}
      </button>
      {(def.sub || def.rows) && (
        <div style={{ position: 'absolute', left: '50%', top: '100%', transform: 'translateX(-50%)', marginTop: 2.5, textAlign: 'center', whiteSpace: 'nowrap', pointerEvents: 'none', opacity: dim ? 0.3 : 1, lineHeight: `${TXT.legend + 1}px`, fontFamily: '"Helvetica Neue", Arial, sans-serif' }}>
          {def.rows && (
            <>
              <div style={{ fontSize: TXT.small, fontWeight: 500, color: COL.legendWhite, minHeight: TXT.legend + 1 }}>{def.rows[0] || ' '}</div>
              <div style={{ fontSize: TXT.small, fontWeight: 500, color: COL.legendWhite }}>{def.rows[1]}</div>
            </>
          )}
          {def.sub && (
            <div style={{ fontSize: TXT.legend, fontWeight: 500, letterSpacing: -0.1, color: COL.legend, textDecoration: def.subPlain ? undefined : 'underline', textUnderlineOffset: 2.5 }}>{def.sub}</div>
          )}
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
/* touch: the 11 mm keys (about 32 CSS px on an iPad) answer within 44 px; neighbours are 16-17 mm apart */
@media (pointer: coarse) { .a4-hit::before, .a4-kb-key::before { content: ''; position: absolute; inset: -6px; } .a4-hit-v::before { content: ''; position: absolute; inset: -6px 0; } }
`}</style>
  );
}

/**
 * The black unit's knobs seen from above: smooth satin-black domes with a soft highlight (the
 * shared 'elektron' cap shows a knurled grey ring). Restyles only this instance's knob caps;
 * if the shared Knob markup changes, the shared look simply returns.
 */
function KnobCapStyles({ instance }: { instance: string }) {
  const scope = `[data-instance="${instance.replace(/["\\]/g, '')}"] [aria-roledescription="knob"] > .absolute.inset-0.rounded-full > .absolute.inset-0.rounded-full`;
  return (
    <style>{`
${scope} { background: radial-gradient(circle at 42% 30%, #56585c 0%, #2a2b2e 30%, #141416 62%, #070708 100%) !important; border: 1px solid #2c2d30 !important;
  box-shadow: 0 3px 5px rgba(0,0,0,.8), 0 1px 1px rgba(0,0,0,.9), inset 0 -2px 3px rgba(0,0,0,.5) !important; }
${scope} > .absolute.rounded-full:not(.inset-0) { inset: 10% !important; background: radial-gradient(circle at 40% 28%, rgba(255,255,255,.12) 0%, rgba(255,255,255,.03) 45%, rgba(255,255,255,0) 70%) !important; }
`}</style>
  );
}

// ----------------------------------------------------------------------------
// LED strips
// ----------------------------------------------------------------------------

function Dot({ on, color, x, y, label, labelBelow = true, underline = false, blink = false, size = TXT.small }: { on: number; color: string; x: number; y: number; label?: string; labelBelow?: boolean; underline?: boolean; blink?: boolean; size?: number }) {
  const d = 2 * k;
  return (
    <div style={{ position: 'absolute', left: x * k - d / 2, top: y * k - d / 2, width: d, height: d, pointerEvents: 'none' }}>
      {/* an unlit LED still shows as a dark red dot behind the panel */}
      <div
        className={blink ? 'a4-blink' : undefined}
        style={{ width: d, height: d, borderRadius: '50%', background: on > 0 ? color : COL.ledOff, opacity: on > 0 ? 0.45 + 0.55 * on : 1, boxShadow: on > 0 ? `0 0 ${3 + 5 * on}px ${color}` : 'inset 0 1px 1px rgba(0,0,0,0.7)' }}
      />
      {label && (
        <div style={{ position: 'absolute', left: '50%', [labelBelow ? 'top' : 'bottom']: '100%', transform: 'translateX(-50%)', [labelBelow ? 'marginTop' : 'marginBottom']: 1.5, fontSize: size, fontWeight: 500, color: COL.legend, whiteSpace: 'nowrap', textAlign: 'center', lineHeight: `${size + 1}px`, letterSpacing: size < 9 ? -0.4 : size < TXT.legend ? -0.2 : -0.1, textDecoration: underline ? 'underline' : undefined, textUnderlineOffset: 2, fontFamily: '"Helvetica Neue", Arial, sans-serif' }}>
          {label}
        </div>
      )}
    </div>
  );
}

const MODE_NAMES = ['Sequential', 'Direct Start', 'Direct Jump', 'Temp Jump'];
const OCT_NAMES = ['-3', '-2', '-1', '', '+1', '+2', '+3'];

export function LedStrips({ ctx }: { ctx: CustomRenderContext }) {
  const pr = project(ctx);
  const st = seqStateOf(ctx.engine);
  const cm = CHANGE_MODES.indexOf(pr.changeMode);
  const oct = Math.round(num(ctx.values.kb_oct, 5)) - 5;
  const track = Math.max(0, Math.min(TRACKS - 1, Math.round(num(ctx.values.track))));
  const pat = viewPattern(ctx, pr);
  const len = trackLength(getPattern(pr, pat), track);
  const pages = Math.max(1, Math.ceil(len / 16));
  const shown = Math.min(pages - 1, Math.round(Number(ctx.ui[UI.stepPage]) || 0));
  const playStep = st?.playing && st.pattern === pat ? st.steps[track] ?? -1 : -1;
  const playPage = playStep >= 0 ? Math.floor(playStep / 16) : -1;
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: 0, height: 0 }}>
      {/* PATTERN MODE: the LED above its (underlined, FUNC + BANK A-D) name; TEMP JUMP flashes while
          armed and lights while the jumped-to pattern plays (manual p.40) */}
      {MODE_LEDS.map((p, i) => {
        const tj = st?.tempJump;
        const on = i === 3 ? (tj === 'armed' || tj === 'active' || cm === 3 ? 1 : 0) : tj === 'active' ? 0 : cm === i ? 1 : 0;
        return <Dot key={`m${i}`} {...p} on={on} blink={i === 3 && tj === 'armed'} color={COL.amber} label={MODE_NAMES[i]} underline size={TXT.legend} />;
      })}
      {/* OCTAVE: -3 .. +3, the centre one unlabelled */}
      {OCT_LEDS.map((p, i) => <Dot key={`o${i}`} {...p} on={Math.max(-3, Math.min(3, oct)) + 3 === i ? (Math.abs(oct) > 3 ? 0.4 : 1) : 0} color={COL.amber} label={OCT_NAMES[i] || undefined} />)}
      {/* PATTERN PAGE: lit for the pattern's pages, full for the edited one, flashing for the playing one */}
      {PAGE_LEDS.map((p, i) => (
        // four labels 5 mm apart: the smallest legend on the panel (as printed)
        <Dot key={`p${i}`} {...p} on={i >= pages ? 0 : i === shown ? 1 : 0.35} color={COL.amber} blink={i === playPage && pages > 1} label={`${i + 1}:4`} labelBelow={false} size={8.5} />
      ))}
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
  const oct = Math.round(num(ctx.values.kb_oct, 5)) - 5;

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
    if (steps.length && typeof u[UI.heldTrack] === 'number' && trackKind(u[UI.heldTrack] as number) !== 'fx' && !u[UIK.stepRec]) {
      const track = u[UI.heldTrack] as number;
      const pat = (u[UI.heldPattern] as string) ?? project(ctx).active;
      const note = Math.max(0, Math.min(127, KB_C1 + 12 * oct + offset));
      // a key pressed while another is down adds to the trig's chord - on a poly track (manual p.28, p.42)
      const chord = pointers.current.size > 0;
      if (chord && isPolyTrack(ctx.values, track)) {
        editTrigs(ctx, p => steps.reduce((q, st) => addChordNote(q, pat, track, st, note), p));
        const after = getPattern(project(ctx), pat).tracks[track]?.steps[steps[0]];
        const root = after?.note ?? note;
        const offs = after?.chord ?? [];
        const shown = note === root || offs.includes(note - root) ? offs : [...offs, note - root];
        say(ctx, `TRIG ${steps.map(s => s + 1).join(' ')}: CHORD ${formatChord(root, shown)}`, 1400);
      } else {
        editTrigs(ctx, p => updateSteps(p, pat, track, steps, { note, chord: null }, { create: 'note' }));
        say(ctx, chord ? `CHORDS NEED POLY ON ${TRACK_NAMES[track]} ([FUNC] + [MIX])` : `TRIG ${steps.map(s => s + 1).join(' ')}: NOTE ${formatNote(note)}`, chord ? 1800 : 1100);
      }
      ctx.setUi({ [UI.heldEdited]: true });
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
  // 13 discrete keys, sharps in the upper row, each with a slit LED (manual p.12)
  return (
    <div className={target ? 'a4-target' : undefined} style={{ position: 'relative', width: '100%', height: '100%', opacity: dim ? 0.3 : 1, borderRadius: 4 }} aria-label="Keyboard">
      {KB_KEYS.map(kk => {
        const on = held.has(kk.offset);
        const left = (kk.x - KB_KEY.w / 2 - KEYBOARD.x) * k;
        const top = (kk.y - KB_KEY.h / 2 - KEYBOARD.y) * k;
        const note = KB_C1 + 12 * oct + kk.offset;
        return (
          <button
            key={kk.offset}
            type="button"
            className="a4-kb-key"
            aria-label={`Key ${kk.name}${kk.offset === 12 ? ' (octave up)' : ''} (${formatNote(note)})`}
            onPointerDown={e => press(kk.offset, e)} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release} onContextMenu={e => e.preventDefault()}
            style={{
              position: 'absolute', left, top, width: KB_KEY.w * k, height: KB_KEY.h * k, padding: 0, cursor: 'pointer',
              borderRadius: 5, border: `1px solid ${COL.keyEdge}`, touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', WebkitTapHighlightColor: 'transparent',
              background: `linear-gradient(180deg, ${on ? '#36373b' : COL.key} 0%, ${on ? '#2a2b2f' : '#222326'} 100%)`,
              boxShadow: '0 2px 2px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)',
              transform: on ? 'translateY(1px)' : undefined,
            }}
          >
            <span style={{
              position: 'absolute', left: '50%', top: '50%', width: 2.2, height: 7.5, marginLeft: -1.1, marginTop: -3.75, borderRadius: 1.1,
              background: on ? COL.red : '#cfd1d4', opacity: on ? 1 : 0.55, boxShadow: on ? `0 0 6px ${COL.red}` : undefined,
            }} />
          </button>
        );
      })}
    </div>
  );
}

// ----------------------------------------------------------------------------
// OLED screen
// ----------------------------------------------------------------------------

const OLED_ON = '#e9f1ff';
const OLED_DIM = '#8693a9';

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
    <svg width="15" height="13" viewBox="0 0 18 16" style={{ display: 'block', margin: '0 auto' }}>
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
  useEffect(() => {
    const slots = page && !['perf', 'mix', 'tempo'].includes(page) ? pageSlots(page) : [];
    for (const p of slots) {
      if (!p) continue;
      const id = controlFor(track, p);
      if (prev.current[id] !== undefined && prev.current[id] !== values[id]) setTouched({ name: p.name.toUpperCase(), until: Date.now() + 1400 });
      prev.current[id] = values[id];
    }
  }, [values, track, page]);
  useEffect(() => {
    if (!touched) return;
    const t = setTimeout(() => setTouched(null), touched.until - Date.now() + 20);
    return () => clearTimeout(t);
  }, [touched]);

  // the song row left of the pattern: only while the song plays (not while the studio arranger drives it)
  const songMode = st?.playing ? st.mode === 'song' && !st.arranged : pr.mode === 'song';
  const songRow = songMode ? (st?.playing && pr.song.rows.length ? `${String((st.songRow ?? 0) + 1).padStart(2, '0')}:` : '__:') : '';
  const shownPattern = st?.playing && st.pattern ? st.pattern : pr.active;
  const kitName = pr.song.name || getPattern(pr, shownPattern).name || 'KIT';
  const levelId = levelControl(track);
  const level = levelId ? num(values[levelId], 100) : 0;
  const title = page ? PAGE_TITLE[page] : '---';
  // the transport symbol: record, play, pause or stop (manual p.18)
  const icon = values.live_rec && playing ? '●▶' : playing ? '▶' : st?.paused ? '❚❚' : values.rec ? '●' : '■';

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
              <div style={{ fontSize: 9, letterSpacing: -0.2, fontWeight: 700, color: sel ? '#050608' : OLED_ON, background: sel ? OLED_ON : 'transparent', borderRadius: 2, whiteSpace: 'nowrap', overflow: 'hidden' }}>{m.name}</div>
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
          const muted = masterMuted(pr, i) || !!getPattern(pr, shownPattern).tracks[i]?.mute;
          return (
            <div key={i} style={{ textAlign: 'center', width: 34 }}>
              <div style={{ height: 52, width: 10, margin: '0 auto', border: `1px solid ${OLED_DIM}`, position: 'relative' }}>
                <div style={{ position: 'absolute', inset: 0, transformOrigin: '50% 100%', transform: `scaleY(${v / 127})`, background: muted ? OLED_DIM : OLED_ON }} />
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
        // every trig carries the NOT / VEL / LEN it was placed with: shown locked when it differs from the NOTE page
        if (p.key === 'trig_note') locked = step.note !== undefined && step.note !== tr?.note;
        else if (p.key === 'trig_vel') locked = step.vel !== undefined && step.vel !== tr?.vel;
        else if (p.key === 'trig_len') locked = step.len !== undefined && step.len !== tr?.len;
        else if (p.key === 'trig_micro') locked = !!step.micro;
        else if (p.key === 'trig_cond') locked = !!step.cond;
        else locked = !!step.locks && p.key in step.locks;
      }
      const txt = p.fmt ? p.fmt(v) : String(Math.round(v));
      return (
        <div key={i} style={{ textAlign: 'center', minWidth: 0 }}>
          <Arc norm={slotNorm(p, v)} bipolar={!!p.bipolar} locked={false} />
          <div style={{ fontSize: TXT.small, color: OLED_DIM, letterSpacing: 0.1, lineHeight: '10px', fontWeight: 700 }}>{p.short}</div>
          <div style={{ fontSize: 10.5, fontWeight: 700, lineHeight: '12px', whiteSpace: 'nowrap', overflow: 'hidden', color: locked ? '#050608' : OLED_ON, background: locked ? OLED_ON : 'transparent', borderRadius: 2, margin: '0 1px' }}>
            {txt}
          </div>
        </div>
      );
    };
    const s = pageSlots(page);
    // NOTE page: TRC takes PRB's place while a trig is held (manual p.50)
    if (heldOn && (page === 'note' || page === 'fxnote' || page === 'cvnote')) {
      const cond = (trackKind(track) === 'synth' ? SYNTH_BY_KEY : trackKind(track) === 'fx' ? FX_BY_KEY : CV_BY_KEY).trig_cond;
      if (cond) s[4] = cond;
    }
    body = (
      <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', marginTop: 2 }}>{s.slice(0, 5).map(cell)}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', marginTop: 2 }}>{s.slice(5).map(cell)}</div>
      </>
    );
  }

  // a held chord trig shows its notes (POLY, manual p.28)
  const heldTr = heldOn ? getPattern(pr, (ui[UI.heldPattern] as string) ?? shownPattern).tracks[track] : undefined;
  const heldStep = heldTr?.steps[held[0]];
  const chordTxt = heldStep?.chord?.length ? `TRIG ${held[0] + 1}: ${formatChord(heldStep.note ?? heldTr?.note ?? 60, heldStep.chord)}${isPolyTrack(values, track) ? '' : ' (MONO: ROOT ONLY)'}` : '';
  const stepRec = ui[UIK.stepRec] as StepRec | null | undefined;
  const srTxt = stepRec ? `STEP REC ${stepRec.jump ? 'JUMP' : 'STANDARD'}: STEP ${stepRec.step + 1}${stepRec.jump ? ` (LEN ${formatLength(getPattern(pr, shownPattern).tracks[track]?.len ?? 14)})` : ''}` : '';
  const liveTxt = values.live_rec && playing ? (ui[UIK.erase] ? 'LIVE REC: ERASING AS IT PLAYS' : ui[UIK.liveQuant] ? 'LIVE REC QUANTIZED: PLAY, TURN KNOBS' : 'LIVE REC: PLAY KEYS, TURN KNOBS') : '';
  const note = msg || chordTxt || (heldOn ? `TRIG ${held.map(s => s + 1).join(',')}: TURN A KNOB TO LOCK` : srTxt ? srTxt : liveTxt ? liveTxt : trackKind(track) === 'cv' ? 'CV TRACK: NO OUTPUT JACKS HERE' : view === V.OSC1 && trackKind(track) === 'fx' ? 'NO AUDIO INPUTS IN THE STUDIO' : '');
  const box = (inv: boolean): CSSProperties => ({ background: inv ? OLED_ON : 'transparent', color: inv ? '#050608' : OLED_ON, padding: '0 2px', borderRadius: 1.5 });
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', color: OLED_ON, fontFamily: '"Helvetica Neue", Arial, sans-serif', userSelect: 'none', WebkitUserSelect: 'none', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', fontSize: 9.5, lineHeight: '11px', gap: 3, fontWeight: 700 }}>
        <span style={{ ...box(true), flex: 1, whiteSpace: 'nowrap', overflow: 'hidden' }}>{touched ? touched.name : kitName}</span>
        <span style={{ ...box(true), whiteSpace: 'nowrap' }}>{bpm.toFixed(1)} {icon}</span>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>{body}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: TXT.small, lineHeight: '11px', fontWeight: 700 }}>
        {note ? (
          <span style={{ ...box(!!msg), flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', color: msg ? '#050608' : OLED_DIM }}>{note}</span>
        ) : (
          <>
            <span style={box(true)}>{TRACK_NAMES[track]}</span>
            {isPolyTrack(values, track) && <span style={{ ...box(false), border: `1px solid ${OLED_DIM}`, lineHeight: '9px' }} aria-label="Poly track">POLY</span>}
            <span style={{ color: OLED_DIM, whiteSpace: 'nowrap' }}>{title}</span>
            {levelId && (
              <span style={{ width: 30, height: 6, border: `1px solid ${OLED_DIM}`, position: 'relative' }} aria-label="Track level">
                <span style={{ position: 'absolute', inset: 0, transformOrigin: '0 50%', transform: `scaleX(${level / 127})`, background: OLED_ON }} />
              </span>
            )}
            <span style={{ flex: 1 }} />
          </>
        )}
        <span style={{ color: OLED_DIM }}>{songRow}</span>
        <span style={box(true)}>{shownPattern}</span>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Trig area: trigs, or patterns (bank mode), or macros (QPER)
// ----------------------------------------------------------------------------

/** trig_mode values: TRIGS, ACCENT, NOTE SLIDE, PARAM SLIDE, TRIG MUTE */
const TRIG_MODES = ['trig', 'accent', 'slide', 'pslide', 'trigmute'] as const;

/** Lessons: the trig keys step back (dimmed) while a step is about the sound, not the sequencer */
function trigAreaDimmed(ctx: CustomRenderContext, focusMode: boolean): boolean {
  const st = ctx.step;
  if (!focusMode || !ctx.teaching || !st || st.check) return false;
  const ids = [st.control, ...(st.focus ?? []), ...(st.match?.controls ?? [])].filter((x): x is string => typeof x === 'string');
  if (!ids.length) return false;
  return !ids.some(id => /_trig_|^trig_mode$|_mute$|^seq:/.test(id));
}

/** The trig keys' look: a dark key, the number backlit in the LED colour over a short bar,
 *  a printed frame round 1, 5, 9 and 13 (manual p.12). Restyles the kit's TrigKeys too. */
function TrigStyles({ gap }: { gap: number }) {
  return (
    <style>{`
.a4-trigs > div > div { gap: ${gap}px !important; }
.a4-trigs [data-step] { border-radius: 6px !important; padding: 0 !important; }
.a4-trigs [data-step] > span:first-child {
  position: absolute !important; left: 0 !important; right: 0 !important; top: 50% !important; transform: translateY(-64%);
  font-size: 15px !important; font-weight: 400 !important; line-height: 16px !important; text-align: center; color: inherit !important;
}
.a4-trigs [data-step]::after { content: ''; position: absolute; left: 36%; right: 36%; top: 67%; height: 2px; border-radius: 1px; background: currentColor; opacity: .9; }
.a4-trigs [data-step]:nth-child(4n+1)::before { content: ''; position: absolute; left: 13%; right: 13%; top: 13%; bottom: 13%; border: 1px solid currentColor; border-radius: 2px; opacity: .55; }
.a4-trigs.mode-trig [data-step] {
  background: linear-gradient(180deg, #2c2d30 0%, #232427 100%) !important; border: 1px solid #111214 !important;
  box-shadow: 0 2px 2px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.06) !important; filter: none !important; color: ${COL.trigOff};
}
.a4-trigs.mode-trig [data-trig="note"] { color: ${COL.red} !important; text-shadow: 0 0 5px ${COL.red}; }
.a4-trigs.mode-trig [data-trig="lock"] { color: ${COL.yellow} !important; text-shadow: 0 0 5px ${COL.yellow}; }
.a4-trigs.mode-trig [data-playhead="1"] { color: #f2f3f5 !important; box-shadow: 0 0 0 2px rgba(242,243,245,.85), 0 0 8px rgba(255,255,255,.35) !important; }
.a4-trigs.mode-trig [data-playhead="1"][data-trig="note"] { color: #ff8a80 !important; }
.a4-trigs [data-held="1"] { box-shadow: 0 0 0 2px ${COL.amber} !important; }
.a4-trigs.mode-trig [data-tmute="1"] { opacity: .45; }
.a4-trigs [data-step][style*="cursor: default"] { opacity: .35 !important; }
`}</style>
  );
}

export function TrigArea({ ctx }: { ctx: CustomRenderContext }) {
  const focusMode = useFocusMode();
  const dim = trigAreaDimmed(ctx, focusMode);
  const bank = ctx.ui[UIK.bank];
  const qper = !!ctx.ui[UIK.qper];
  const pr = project(ctx);
  const st = seqStateOf(ctx.engine);
  const view = Math.round(num(ctx.values.page, V.OSC1));
  const track = Math.max(0, Math.min(TRACKS - 1, Math.round(num(ctx.values.track))));
  const keyW = TRIGS.keyW * k;
  const pitch = TRIGS.pitch * k;
  const chainHold = useRef<{ pointer: number; first: string; list: string[] } | null>(null);
  const dimStyle = { opacity: dim ? 0.35 : 1, transition: 'opacity 0.2s' } as const;
  const strip = (render: (i: number) => ReactNode) => (
    <div style={{ position: 'relative', width: '100%', height: '100%', ...dimStyle }}>
      <A4Styles />
      {Array.from({ length: 16 }, (_, i) => <div key={i} style={{ position: 'absolute', left: i * pitch, top: 0, width: keyW, height: '100%' }}>{render(i)}</div>)}
    </div>
  );
  const keyBtn = (i: number, opts: { lit: string | null; amt?: number; label: string; sub?: string; blink?: boolean; outline?: boolean; target?: boolean; pressed?: boolean; onPress: (e: React.PointerEvent) => void; onRelease?: (e: React.PointerEvent) => void; aria: string }) => {
    const col = opts.lit ? mix(COL.trigOff, opts.lit, 0.35 + 0.65 * (opts.amt ?? 1)) : COL.trigOff;
    return (
      <button
        type="button"
        aria-label={opts.aria}
        onPointerDown={e => { if (e.button !== 0 && e.pointerType === 'mouse') return; e.preventDefault(); e.stopPropagation(); try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* */ } opts.onPress(e); }}
        onPointerUp={e => opts.onRelease?.(e)}
        onPointerCancel={e => opts.onRelease?.(e)}
        aria-pressed={opts.pressed}
        className={[opts.blink ? 'a4-blink' : '', opts.target ? 'a4-target' : ''].filter(Boolean).join(' ') || undefined}
        style={{
          position: 'absolute', inset: 0, borderRadius: 6, padding: 0, cursor: 'pointer', touchAction: 'none',
          border: `1px solid ${opts.outline ? '#e8e9eb' : '#111214'}`,
          background: 'linear-gradient(180deg, #2c2d30 0%, #232427 100%)',
          boxShadow: `0 2px 2px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.06)${opts.outline ? ', 0 0 0 1px #e8e9eb' : ''}`,
          color: col, textShadow: opts.lit ? `0 0 5px ${opts.lit}` : undefined, fontFamily: '"Helvetica Neue", Arial, sans-serif',
        }}
      >
        <span style={{ position: 'absolute', left: 0, right: 0, top: '22%', textAlign: 'center', fontSize: 14, fontWeight: 400, lineHeight: '15px' }}>{opts.label}</span>
        <span style={{ position: 'absolute', left: '36%', right: '36%', top: '63%', height: 2, borderRadius: 1, background: col }} />
        {opts.sub && <span style={{ position: 'absolute', left: 1, right: 1, bottom: 1.5, fontSize: 9, letterSpacing: -0.2, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textAlign: 'center', color: COL.trigOff }}>{opts.sub}</span>}
      </button>
    );
  };

  if (typeof bank === 'number') {
    // [BANK] + [TRIG]: pick a pattern. Keep the first trig held and press more: a quick chain (manual p.55)
    return strip(i => {
      const id = patternId(bank, i);
      const has = patternHasContent(pr.patterns[id]);
      const playing = st?.playing && st.pattern === id;
      const queued = st?.queued === id && !playing;
      return keyBtn(i, {
        lit: playing ? COL.green : queued ? COL.yellow : pr.active === id ? COL.red : has ? COL.red : null,
        amt: playing || queued || pr.active === id ? 1 : 0.45,
        label: `${i + 1}`,
        sub: pr.patterns[id]?.name || id,
        blink: queued,
        aria: `Pattern ${id}${has ? '' : ' (empty)'}`,
        onPress: e => {
          const hold = chainHold.current;
          if (hold && hold.pointer !== e.pointerId) {
            hold.list.push(id);
            ctx.updateData(d => setChain(asProject(d, TRACKS), hold.list.slice()));
            say(ctx, `CHAIN ${hold.list.join(' ')}`, 1600);
            return;
          }
          chainHold.current = { pointer: e.pointerId, first: id, list: [id] };
          ctx.updateData(d => setActive(asProject(d, TRACKS), id));
          say(ctx, st?.playing ? `${id} CUED` : `PATTERN ${id}`, 1200);
        },
        onRelease: e => {
          const hold = chainHold.current;
          if (!hold || hold.pointer !== e.pointerId) return;
          chainHold.current = null;
          ctx.setUi({ [UIK.bank]: null });
          if (hold.list.length > 1) say(ctx, `CHAIN ${hold.list.join(' ')} - [CHAIN MODE] plays it`, 2000);
        },
      });
    });
  }
  if (ctx.ui[UIK.menu] === 'poly') {
    // POLY CONFIG: TRIG 1-4 tick the voices - half-bright = a track's own mono voice, full-bright = in
    // the pool - and light up white while their voice plays (manual p.29)
    const act = String(ctx.engine.polyAct ?? '');
    const litIds = new Set<string>(ctx.teaching && ctx.step ? [ctx.step.control, ...(ctx.step.focus ?? [])].filter((x): x is string => typeof x === 'string') : []);
    return strip(i => {
      if (i >= SYNTH_TRACKS) return keyBtn(i, { lit: null, label: `${i + 1}`, aria: 'unused', onPress: () => undefined });
      const id = `poly_v${i + 1}`;
      const on = !!ctx.values[id];
      const playing = on && act[i] === '1';
      return keyBtn(i, {
        lit: playing ? COL.white : COL.red, amt: on ? 1 : 0.4, label: `${i + 1}`, sub: on ? `POLY ${i + 1}` : `MONO ${i + 1}`,
        aria: `Voice ${i + 1}: ${on ? 'in the poly pool' : `track ${i + 1}'s own mono voice`}`, pressed: on, target: litIds.has(id),
        onPress: () => { ctx.setValue(id, !on); say(ctx, `VOICE ${i + 1}: ${on ? `T${i + 1}'S OWN (MONO)` : 'IN THE POLY POOL'}`, 1100); },
      });
    });
  }
  if (qper) {
    return strip(i => {
      if (i >= PERF_MACROS.length) return keyBtn(i, { lit: null, label: `${i + 1}`, aria: 'unused', onPress: () => undefined });
      const sel = num(ctx.values.qper_sel) === i;
      return keyBtn(i, {
        lit: sel ? COL.white : null, label: `${i + 1}`, sub: PERF_MACROS[i].name, aria: `Quick perf macro ${PERF_MACROS[i].name}`,
        onPress: () => { ctx.setValue('qper_sel', i); ctx.setUi({ [UIK.qper]: false }); say(ctx, `QUICK PERF: ${PERF_MACROS[i].name}`, 1200); },
      });
    });
  }
  if (view === V.PERF) {
    // PERFORMANCE mode: [TRIG 1-6] mute the tracks; audible = full bright, muted = dim red. With
    // [FUNC] held the changes wait for its release: half-bright = will unmute, half-bright
    // blinking = will mute (manual p.27). These are the project's track mutes.
    const pending = pendingMutes(ctx);
    return strip(i => {
      if (i >= TRACKS) return keyBtn(i, { lit: null, label: `${i + 1}`, aria: 'unused', onPress: () => undefined });
      const muted = masterMuted(pr, i);
      const will = pending.includes(i);
      return keyBtn(i, {
        lit: COL.red, amt: will ? 0.5 : muted ? 0.25 : 1, blink: will && !muted, label: `${i + 1}`,
        sub: `${TRACK_NAMES[i]}${will ? (muted ? ' +' : ' *') : muted ? ' -' : ''}`, aria: `Mute ${TRACK_NAMES[i]}`,
        onPress: () => {
          if (funcActive(ctx)) {
            ctx.setUi({ [UIK.perfPending]: will ? pending.filter(x => x !== i) : [...pending, i] });
            if (liveUi(ctx)[UIK.func] === 'held') ctx.setUi({ [UIK.funcUsed]: true });
            say(ctx, 'MUTES CHANGE WHEN FUNC IS RELEASED', 1100);
            return;
          }
          ctx.updateData(d => setMasterMute(asProject(d, TRACKS), i, !muted));
          say(ctx, `${TRACK_NAMES[i]} ${muted ? 'UNMUTED' : 'MUTED'}`, 900);
        },
      });
    });
  }
  const sr = ctx.ui[UIK.stepRec] as StepRec | null | undefined;
  if (sr) {
    // STEP RECORDING: a key picks the active step (green, flashing) - held, its trig takes locks from the
    // knobs; trigs show red (note) and yellow (lock); the keyboard writes at the active step (manual p.41)
    const page = Math.round(Number(ctx.ui[UI.stepPage]) || 0);
    const pat = viewPattern(ctx, pr);
    const trk = getPattern(pr, pat).tracks[track];
    const len = trackLength(getPattern(pr, pat), track);
    const playStep = st?.playing && st.pattern === pat ? st.steps[track] ?? -1 : -1;
    const focus = lessonFocus(ctx);
    return strip(i => {
      const step = page * 16 + i;
      const s = trk?.steps[step];
      const active = sr.step === step;
      const inLen = step < len;
      return keyBtn(i, {
        lit: !inLen ? null : active ? COL.green : s ? (s.trigless ? COL.yellow : COL.red) : null, amt: inLen ? 1 : 0.3,
        blink: active, outline: playStep === step, label: `${step + 1}`, sub: s?.chord?.length ? `${s.chord.length + 1} NOTES` : undefined,
        target: !!focus && (focus.has(`seq:trig:${step + 1}`) || focus.has('seq:trigs')),
        aria: `Step ${step + 1}${active ? ' (active step)' : ''}${s ? (s.trigless ? ', lock trig' : ', note trig') : ''}`,
        onPress: () => {
          if (!inLen) return;
          ctx.setUi({ [UIK.stepRec]: { ...sr, step }, [UI.heldSteps]: [step], [UI.heldTrack]: track, [UI.heldPattern]: pat, [UI.heldEdited]: false });
        },
        onRelease: () => ctx.setUi({ [UI.heldSteps]: [], [UI.heldEdited]: false }),
      });
    });
  }
  // TRIGS, or the [FUNC] + [BANK E-H] menus: TRIG MUTE, ACCENT, NOTE SLIDE, PARAM SLIDE (manual p.51-53)
  const mode = TRIG_MODES[Math.round(num(ctx.values.trig_mode))] ?? 'trig';
  const editable = ctx.values.rec !== false;
  // [FUNC] + [TRIG] in GRID RECORDING places (or removes) a lock trig (manual p.40)
  const onFuncTrig = (e: React.PointerEvent) => {
    if (!editable || mode !== 'trig' || !funcActive(ctx)) return;
    const el = (e.target as HTMLElement).closest('[data-step]') as HTMLElement | null;
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    const step = Number(el.dataset.step);
    const pat = viewPattern(ctx, pr);
    const cur = getPattern(pr, pat).tracks[track]?.steps[step];
    spendFunc(ctx);
    if (cur && !cur.trigless) { say(ctx, `TRIG ${step + 1} IS A NOTE TRIG`, 1200); return; }
    ctx.updateData(d => (cur ? setStepFn(asProject(d, TRACKS), pat, track, step, null) : updateSteps(asProject(d, TRACKS), pat, track, [step], { trigless: true }, { create: 'lock' })));
    say(ctx, cur ? `LOCK TRIG ${step + 1} REMOVED` : `LOCK TRIG ${step + 1}`, 1100);
  };
  return (
    <div className={`a4-trigs mode-${mode}`} onPointerDownCapture={onFuncTrig} style={{ width: '100%', height: '100%', ...dimStyle }}>
      <TrigStyles gap={(TRIGS.pitch - TRIGS.keyW) * k} />
      {/* stampDefaults: a new trig takes the NOTE menu's NOT / VEL / LEN (manual p.45) */}
      <TrigKeys ctx={ctx} tracks={TRACKS} mode={mode} editable={editable} trackNames={[...TRACK_NAMES]} color={COL.red} stampDefaults muteTarget="project" />
    </div>
  );
}

/** Printed under the trig keys: A-P, the track names under 1-6, the Quick Performance bracket under 1-10 */
export function TrigLegends() {
  const L = TRIG_LEGENDS;
  const y0 = TRIGS.y + TRIGS.h;
  const cx = (i: number) => (i * TRIGS.pitch + TRIGS.keyW / 2) * k;
  const font = { fontFamily: '"Helvetica Neue", Arial, sans-serif', fontSize: TXT.small, fontWeight: 500, color: COL.legendGrey, whiteSpace: 'nowrap' as const, lineHeight: `${TXT.small + 1}px` };
  const x0 = 0, x1 = (9 * TRIGS.pitch + TRIGS.keyW) * k;
  const by = (L.bracketY - y0) * k;
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', pointerEvents: 'none' }}>
      {Array.from({ length: 16 }, (_, i) => (
        <div key={i} style={{ ...font, position: 'absolute', left: cx(i), top: (L.letterY - y0) * k, transform: 'translate(-50%, -50%)' }}>{'ABCDEFGHIJKLMNOP'[i]}</div>
      ))}
      {TRACK_NAMES.map((n, i) => (
        <div key={n} style={{ ...font, position: 'absolute', left: cx(i), top: (L.trackY - y0) * k, transform: 'translate(-50%, -50%)' }}>{n}</div>
      ))}
      {/* the bracket over TRIG 1-10, its name in the line under TRIG 8 (manual p.12) */}
      <div style={{ position: 'absolute', left: x0, top: by - 2.5 * k, width: 1, height: 2.5 * k, background: COL.legendGrey }} />
      <div style={{ position: 'absolute', left: x1 - 1, top: by - 2.5 * k, width: 1, height: 2.5 * k, background: COL.legendGrey }} />
      <div style={{ position: 'absolute', left: x0, top: by, width: x1 - x0, height: 1, background: COL.legendGrey }} />
      <div style={{ ...font, position: 'absolute', left: cx(7), top: by, transform: 'translate(-50%, -50%)', padding: '0 4px', background: '#131315' }}>Quick Performance</div>
    </div>
  );
}

/** Printed text in one or two tones ("Main" grey, "Volume" white; "Analog Four" bold, "MKII" light) */
export function Legend({ parts, size = TXT.legend, align = 'center', light = false }: { parts: { text: string; strong?: boolean }[]; size?: number; align?: 'left' | 'center'; light?: boolean }) {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: align === 'left' ? 'flex-start' : 'center', whiteSpace: 'nowrap', pointerEvents: 'none', fontFamily: '"Helvetica Neue", Arial, sans-serif', fontSize: size, letterSpacing: light ? -0.2 : 0.1 }}>
      {parts.map((p, i) => (
        <span key={i} style={{ fontWeight: p.strong ? (light ? 700 : 600) : light ? 300 : 500, color: p.strong ? COL.label : light ? '#a7aab0' : COL.legendGrey, whiteSpace: 'pre' }}>{p.text}</span>
      ))}
    </div>
  );
}

/** The maker's mark, top right: drawn as a simple outlined slanted square (not the trademark artwork) */
export function LogoMark() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 24 18" style={{ display: 'block' }} aria-hidden>
      <path d="M5 1.5 H22.5 L19 16.5 H1.5 Z" fill="none" stroke="#e9eaec" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M7.5 12.5 H14 L16.5 5" fill="none" stroke="#e9eaec" strokeWidth="2.2" strokeLinejoin="round" />
    </svg>
  );
}

/** The headphone symbol in the rear connector legend */
export function RearIcons() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 12 12" aria-hidden>
      <path d="M2 8 V6.5 A4 4 0 0 1 10 6.5 V8" fill="none" stroke={COL.legendDim} strokeWidth="1.2" />
      <rect x="1.4" y="7.2" width="2" height="3.4" rx="0.8" fill={COL.legendDim} />
      <rect x="8.6" y="7.2" width="2" height="3.4" rx="0.8" fill={COL.legendDim} />
    </svg>
  );
}

/** What TRACK LEVEL turns: the active track's level, or the TEMPO / SWING menu's value, or the accent in the ACCENT menu */
export function trackLevelControl(c: { values: Record<string, ControlValue>; ui?: Record<string, unknown> }): string | null {
  const m = c.ui?.[UIK.menu];
  if (m === 'tempo') return 'tempo';
  if (m === 'swing') return 'swing';
  const t = Math.max(0, Math.min(TRACKS - 1, Math.round(num(c.values.track))));
  if (num(c.values.trig_mode) === 1 && t < SYNTH_TRACKS) return `t${t + 1}_snd_acc`;
  return levelControl(t);
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
      style={{ width: '100%', height: '100%', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', color: open ? COL.white : COL.legend, fontSize: TXT.legend, fontWeight: 500, textDecoration: 'underline', textUnderlineOffset: 2.5, fontFamily: '"Helvetica Neue", Arial, sans-serif', whiteSpace: 'nowrap' }}
    >
      Sound Browser
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
        <div style={{ fontSize: 11, color: SC.dim, marginBottom: 6 }}>LOAD SOUNDS keeps your patterns. WITH PATTERNS also loads the kit&apos;s patterns and song, replacing the pattern memory.</div>
        <Group label="THIS KIT">
          <SeqButton height={40} onPress={() => ctx.setUi({ [UIK.menu]: 'poly' })} title="[FUNC] + [MIX]">POLY CONFIG</SeqButton>
          <span style={{ fontSize: 11, color: SC.dim, flex: '1 1 260px' }}>The kit&apos;s polyphony: which voices the poly tracks share, and how notes find a voice.</span>
        </Group>
        <div style={{ height: 6 }} />
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

function TempoMenu({ ctx }: { ctx: CustomRenderContext }) {
  const synced = useStudioStore(s => s.studio.sync[ctx.instance] !== false);
  const studioBpm = useStudioStore(s => s.studio.bpm);
  const tempo = num(ctx.values.tempo, 120);
  const opened = useRef(false);
  // the knob starts at the tempo you hear; turning it while synced moves the studio tempo
  useEffect(() => {
    if (!opened.current) { opened.current = true; if (synced && Math.round(studioBpm) !== tempo) ctx.setValue('tempo', Math.round(studioBpm)); return; }
    if (synced && Math.abs(tempo - studioBpm) >= 0.5) useStudioStore.getState().setBpm(tempo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tempo]);
  const bpm = synced ? studioBpm : tempo;
  const nudge = (d: number) => setTempo(ctx, Math.max(30, Math.min(300, Math.round((bpm + d) * 10) / 10)));
  return (
    <Overlay portal portalSize={{ w: 380, h: 220 }}>
      <Frame title="TEMPO" sub={synced ? 'synced: this is the studio tempo' : 'the project tempo'} onClose={() => ctx.setUi({ [UIK.menu]: null })}>
        <div style={{ textAlign: 'center', fontSize: 40, fontWeight: 800, color: SC.text, lineHeight: '46px' }}>{bpm.toFixed(1)}</div>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', margin: '6px 0' }}>
          <SeqButton onPress={() => nudge(-1)}>-1</SeqButton>
          <SeqButton onPress={() => nudge(-0.1)}>-0.1</SeqButton>
          <SeqButton onPress={() => nudge(0.1)}>+0.1</SeqButton>
          <SeqButton onPress={() => nudge(1)}>+1</SeqButton>
        </div>
        <div style={{ fontSize: 11, color: SC.dim, textAlign: 'center' }}>TRACK LEVEL sets the tempo; the DATA ENTRY knobs still edit the track. [FUNC] + [TEMPO] taps it; LEFT / RIGHT shift it 10% while held.</div>
      </Frame>
    </Overlay>
  );
}

function SwingMenu({ ctx }: { ctx: CustomRenderContext }) {
  const pr = project(ctx);
  const swing = getPattern(pr, pr.active).swing;
  return (
    <Overlay portal portalSize={{ w: 360, h: 200 }}>
      <Frame title="SWING" sub={`pattern ${pr.active}`} onClose={() => ctx.setUi({ [UIK.menu]: null })}>
        <div style={{ textAlign: 'center', fontSize: 40, fontWeight: 800, color: SC.text, lineHeight: '46px' }}>{swing}%</div>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', margin: '6px 0' }}>
          {[50, 54, 58, 62, 66].map(v => <SeqButton key={v} active={swing === v} onPress={() => ctx.setValue('swing', v)}>{v}%</SeqButton>)}
        </div>
        <div style={{ fontSize: 11, color: SC.dim, textAlign: 'center' }}>TRACK LEVEL sets the swing: every second 16th note plays later. 50% is straight.</div>
      </Frame>
    </Overlay>
  );
}

/** [PTN]: the PATTERN menu - RELOAD PATTERN and SAVE PATTERN (manual p.43) */
function PatternMenu({ ctx }: { ctx: CustomRenderContext }) {
  const pr = project(ctx);
  const id = pr.active;
  const name = getPattern(pr, id).name;
  const run = (fn: (p: Project) => Project, msg: string) => { ctx.updateData(d => fn(asProject(d, TRACKS))); say(ctx, msg, 1200); };
  return (
    <Overlay portal portalSize={{ w: 480, h: 260 }}>
      <Frame title="PATTERN" sub={`${id}${name ? ` ${name}` : ''}`} onClose={() => ctx.setUi({ [UIK.menu]: null })}>
        <Group label="RELOAD / SAVE">
          <SeqButton onPress={() => run(reloadPattern, `${id} RELOADED`)} title="[NO] + [PTN]">RELOAD PATTERN</SeqButton>
          <SeqButton onPress={() => run(savePattern, `${id} SAVED`)} color={SC.green} title="[YES] + [PTN]">SAVE PATTERN</SeqButton>
        </Group>
        <div style={{ fontSize: 11, color: SC.dim, margin: '6px 2px' }}>
          RELOAD puts the pattern back the way it was when you selected it, or at the last SAVE: an undo for live edits. Hold [NO] or [YES] and press [PTN] to do it from anywhere.
        </div>
        <Group label="MORE">
          <SeqButton onPress={() => ctx.setUi({ [UIK.menu]: null, [UI.menu]: 'pattern' })} title="Banks A-H: select, name, copy, paste, clear">PATTERN LIST</SeqButton>
          <span style={{ fontSize: 11, color: SC.dim, flex: '1 1 200px' }}>[BANK] + [TRIG] selects a pattern; [FUNC] + [PAGE] sets its length and scale.</span>
        </Group>
      </Frame>
    </Overlay>
  );
}

/** [TRK]: the TRACK menu - NOTES SETUP quantize, RELOAD TRACK and SAVE TRACK (manual p.42, p.47) */
function TrackMenu({ ctx }: { ctx: CustomRenderContext }) {
  const pr = project(ctx);
  const sr = ctx.ui[UIK.stepRec] as StepRec | null | undefined;
  const page = Math.round(Number(ctx.ui[UI.stepPage]) || 0);
  const focus = lessonFocus(ctx);
  const t = Math.max(0, Math.min(TRACKS - 1, Math.round(num(ctx.values.track))));
  const id = pr.active;
  const pat = getPattern(pr, id);
  const run = (fn: (p: Project) => Project, msg: string) => { ctx.updateData(d => fn(asProject(d, TRACKS))); say(ctx, msg, 1200); };
  return (
    <Overlay portal portalSize={{ w: 600, h: 460 }}>
      <Frame title="TRACK" sub={`${TRACK_NAMES[t]} in ${id}`} onClose={() => ctx.setUi({ [UIK.menu]: null })}>
        <Group label="NOTES SETUP">
          <Stepper label="QUANTIZE" value={pat.tracks[t]?.quantize ?? 0} min={0} max={QUANTIZE_MAX} width={56}
            title="Pulls this track's micro-timed trigs towards the grid (127 = on the grid)"
            onChange={v => ctx.updateData(d => setTrackQuantize(asProject(d, TRACKS), id, t, v))} />
          <Stepper label="GLOBAL QUANTIZE" value={pat.quantize ?? 0} min={0} max={QUANTIZE_MAX} width={56}
            title="The same for every track of the pattern"
            onChange={v => ctx.updateData(d => updatePatternSettings(asProject(d, TRACKS), id, { quantize: v }))} />
          {t < SYNTH_TRACKS && (() => {
            const tr = isTransposable(pr, id, t);
            return (
              <SeqButton height={40} active={tr} color={SC.green} highlight={!!focus?.has('a4:transposable')} title="[TRNS] + [TRACK]: off keeps the track out of [TRNS] and song transposes (drums)"
                onPress={() => ctx.updateData(d => setTransposable(asProject(d, TRACKS), id, t, !tr))}>{tr ? '☑ TRANSPOSABLE' : '☐ TRANSPOSABLE'}</SeqButton>
            );
          })()}
        </Group>
        <div style={{ height: 6 }} />
        <Group label="RELOAD / SAVE">
          <SeqButton onPress={() => run(p => reloadTrack(p, t), `TRACK ${TRACK_NAMES[t]} RELOADED`)} title="[NO] + [TRK]">RELOAD TRACK</SeqButton>
          <SeqButton onPress={() => run(p => saveTrack(p, t), `TRACK ${TRACK_NAMES[t]} SAVED`)} color={SC.green} title="[YES] + [TRK]">SAVE TRACK</SeqButton>
        </Group>
        <div style={{ height: 6 }} />
        {/* the same as the key combinations, for a mouse (manual p.41, p.54) */}
        <Group label="STEP RECORDING">
          {(['OFF', 'STANDARD', 'JUMP'] as const).map(m => {
            const cur = sr ? (sr.jump ? 'JUMP' : 'STANDARD') : 'OFF';
            return (
              <SeqButton key={m} height={40} active={cur === m} color={SC.green} highlight={!!focus?.has(`a4:step-rec:${m.toLowerCase()}`)}
                onPress={() => setStepRec(ctx, m === 'OFF' ? null : { jump: m === 'JUMP', step: sr?.step ?? page * 16 })} title="[RECORD] + [STOP]; [STOP] again switches STANDARD / JUMP">{m}</SeqButton>
            );
          })}
        </Group>
        <div style={{ height: 6 }} />
        <Group label={`PAGE ${page + 1}`}>
          <SeqButton height={40} onPress={() => doPageOp(ctx, t, 'copy')} title="[PAGE] + [RECORD]">COPY</SeqButton>
          <SeqButton height={40} onPress={() => doPageOp(ctx, t, 'paste')} title="[PAGE] + [STOP]; again undoes it">PASTE</SeqButton>
          <SeqButton height={40} onPress={() => doPageOp(ctx, t, 'clear')} title="[PAGE] + [PLAY]; again undoes it">CLEAR</SeqButton>
          {t < SYNTH_TRACKS && (
            <>
              <span style={{ width: 10 }} />
              <SeqButton height={40} onPress={() => doSoundOp(ctx, t, 'copy')} title="[TRACK] + [RECORD]">COPY SOUND</SeqButton>
              <SeqButton height={40} onPress={() => doSoundOp(ctx, t, 'paste')} title="[TRACK] + [STOP]">PASTE SOUND</SeqButton>
            </>
          )}
        </Group>
        <div style={{ fontSize: 11, color: SC.dim, margin: '6px 2px' }}>
          A track is its trigs, locks and NOTE settings in this pattern. RELOAD takes only this track back to its saved state. The [ARP] key sets the arpeggiator; its step offsets (ARP SETUP) are not modelled.
        </div>
      </Frame>
    </Overlay>
  );
}

/** [−] value [+] with 44 px touch targets (the A4's own menus: POLY CONFIG) */
function BigStep({ label, value, min, max, onChange, highlight, title }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void; highlight?: boolean; title?: string }) {
  const b = (d: number, glyph: string) => (
    <SeqButton height={44} minWidth={44} onPress={() => onChange(Math.max(min, Math.min(max, value + d)))} ariaLabel={`${d < 0 ? 'Lower' : 'Raise'} ${label} by ${Math.abs(d)}`} title={title}>{glyph}</SeqButton>
  );
  return (
    <div className={highlight ? 'a4-target' : undefined} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, borderRadius: 6 }} title={title}>
      <span style={{ fontSize: 11, fontWeight: 700, color: SC.dim, letterSpacing: 0.4, minWidth: 64 }}>{label}</span>
      {b(-8, '−8')}{b(-1, '−')}
      <span role="status" aria-label={label} style={{ minWidth: 40, textAlign: 'center', fontSize: 16, fontWeight: 800, color: SC.text, fontFamily: 'ui-monospace, Menlo, monospace' }}>{Math.round(value)}</span>
      {b(1, '+')}{b(8, '+8')}
    </div>
  );
}

const POLY_ALLOC_HINT = [
  'RESET: each new note takes the first free voice, counting up from the track\'s own voice.',
  'ROTATE: each new note takes the next voice in turn.',
  'REASSIGN: a note takes the voice it had last time if that one is free, else the one rested longest.',
  'UNISON: every pool voice plays the same note, detuned and spread by the two settings below.',
];

/**
 * POLY CONFIG ([FUNC] + [MIX], KIT > POLY CONFIG): the voices in the pool, the allocation method,
 * USE TRK SOUNDS and the unison settings (manual p.28-29). While it is open TRIG 1-4 tick the voices
 * and light up while their voice plays, so you can watch the allocation as you play.
 */
function PolyMenu({ ctx }: { ctx: CustomRenderContext }) {
  const act = String(ctx.engine.polyAct ?? '');
  useEffect(() => {
    ctx.sendEvent('a4:poly-watch', { on: true });
    return () => ctx.sendEvent('a4:poly-watch', { on: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.instance]);
  const on = [1, 2, 3, 4].map(n => !!ctx.values[`poly_v${n}`]);
  const alloc = Math.round(num(ctx.values.poly_alloc));
  const trk = !!ctx.values.poly_trk;
  // a lesson step about a POLY CONFIG setting lights it (its control, or its focus list)
  const lit = new Set<string>(ctx.teaching && ctx.step ? [ctx.step.control, ...(ctx.step.focus ?? []), ...(ctx.step.match?.controls ?? [])].filter((x): x is string => typeof x === 'string') : []);
  const focusCtl = { has: (id: string) => lit.has(id) };
  const polyTracks = on.map((v, i) => (v ? TRACK_NAMES[i] : null)).filter(Boolean).join(' ');
  return (
    <Overlay portal portalSize={{ w: 640, h: 470 }}>
      <Frame title="POLY CONFIG" sub={polyTracks ? `poly tracks: ${polyTracks}` : 'every track plays its own voice'} onClose={() => ctx.setUi({ [UIK.menu]: null })}>
        <Group label="VOICES">
          {on.map((v, i) => (
            <SeqButton key={i} height={44} minWidth={64} active={v} color={act[i] === '1' && v ? SC.white : SC.red} highlight={focusCtl.has(`poly_v${i + 1}`)}
              onPress={() => ctx.setValue(`poly_v${i + 1}`, !v)} ariaLabel={`Voice ${i + 1} in the poly pool`} title={`TRIG ${i + 1} does the same`}>
              {`${v ? '☑' : '☐'} ${i + 1}`}
            </SeqButton>
          ))}
          <span style={{ fontSize: 11, color: SC.dim, flex: '1 1 200px' }}>Ticked voices form the pool. A track whose voice is ticked plays chords and overlapping notes on any pool voice; the others keep their own mono voice.</span>
        </Group>
        <div style={{ height: 6 }} />
        <Group label="ALLOCATION">
          {POLY_ALLOC.map((a, i) => (
            <SeqButton key={a} height={44} minWidth={86} active={alloc === i} color={SC.green} highlight={focusCtl.has('poly_alloc')} onPress={() => ctx.setValue('poly_alloc', i)}>{a}</SeqButton>
          ))}
          <span style={{ fontSize: 11, color: SC.dim, flex: '1 1 260px' }}>{POLY_ALLOC_HINT[alloc] ?? ''}</span>
        </Group>
        <div style={{ height: 6 }} />
        <Group label="USE TRK SOUNDS">
          <SeqButton height={44} minWidth={64} active={trk} color={SC.green} highlight={focusCtl.has('poly_trk')} onPress={() => ctx.setValue('poly_trk', !trk)}>{trk ? '☑ ON' : '☐ OFF'}</SeqButton>
          <span style={{ fontSize: 11, color: SC.dim, flex: '1 1 260px' }}>{trk ? 'Each voice keeps its own track\'s sound: a chord on T1 is spread over the pool\'s sounds.' : 'A voice plays the sound of the track whose note it plays.'}</span>
        </Group>
        <div style={{ height: 6 }} />
        <Group label="UNISON">
          <BigStep label="DETUNE" value={num(ctx.values.poly_det, 16)} min={0} max={127} onChange={v => ctx.setValue('poly_det', v)} highlight={focusCtl.has('poly_det')} title="UNISON DETUNE: how far apart the voices are tuned" />
          <BigStep label="PAN SPREAD" value={num(ctx.values.poly_spr, 64)} min={0} max={127} onChange={v => ctx.setValue('poly_spr', v)} highlight={focusCtl.has('poly_spr')} title="UNISON PAN SPREAD: how wide the voices spread" />
        </Group>
        <div style={{ fontSize: 11, color: SC.dim, margin: '8px 2px 0' }}>
          Play a few notes on the keyboard and watch TRIG 1-4: each lights while its voice plays. With no free voice, the one used least recently is taken. Hold a trig and press two or more keys to store a chord.
        </div>
      </Frame>
    </Overlay>
  );
}

export function Menus({ ctx }: { ctx: CustomRenderContext }) {
  const m = ctx.ui[UIK.menu];
  return (
    <>
      <A4Styles />
      <TrigEditor ctx={ctx} tracks={TRACKS} portal portalPlacement="top" features={{ retrig: false, accent: true, slide: true, pslide: true, trigMute: true }}
        stampDefaults lockLimit={LOCK_LIMIT_A4} lockLabel={lockLabel} trackNames={[...TRACK_NAMES]} />
      <PatternPicker ctx={ctx} tracks={TRACKS} portal />
      <ChainBuilder ctx={ctx} tracks={TRACKS} portal />
      {/* A4 song rows play whole patterns or chains, with repeats, mutes and transpose (manual p.55-57);
          LOOP / END stays so the looping demo song can be made to end like the hardware's */}
      <SongEditor ctx={ctx} tracks={TRACKS} portal transpose length={false} tempo={false} trackNames={[...TRACK_NAMES]} />
      <ScaleMenu ctx={ctx} tracks={TRACKS} portal trackNames={[...TRACK_NAMES]} />
      {m === 'sound' && <SoundMenu ctx={ctx} />}
      {m === 'kit' && <KitMenu ctx={ctx} />}
      {m === 'global' && <GlobalMenu ctx={ctx} />}
      {m === 'tempo' && <TempoMenu ctx={ctx} />}
      {m === 'swing' && <SwingMenu ctx={ctx} />}
      {m === 'pattern' && <PatternMenu ctx={ctx} />}
      {m === 'track' && <TrackMenu ctx={ctx} />}
      {m === 'poly' && <PolyMenu ctx={ctx} />}
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
    if (proj) say(ctx, kp >= SOUND_DEMO_BASE ? 'DEMO IN A01: PRESS PLAY' : `PROJECT ${KIT_PROJECT_IDS[kp].toUpperCase()} LOADED`);
  }, [kp, kpl, pending, ctx]);

  // LIVE RECORDING ends with playback (the studio transport may stop it)
  const playing = !!ctx.engine.playing;
  const wasPlaying = useRef(playing);
  useEffect(() => {
    if (wasPlaying.current && !playing && ctx.values.live_rec) ctx.setValue('live_rec', false);
    wasPlaying.current = playing;
  }, [playing, ctx]);

  // LIVE RECORDING: the engine reports played notes with their quantised step
  const rec = ctx.engine.recNote as { id: number; track: number; note: number; vel: number; step: number; micro?: number; pattern: string; add?: boolean } | undefined;
  const lastRec = useRef(0);
  useEffect(() => {
    if (!rec || rec.id === lastRec.current) return;
    lastRec.current = rec.id;
    const pr = project(ctx);
    const len = trackLength(getPattern(pr, rec.pattern), rec.track);
    const step = ((rec.step % len) + len) % len;
    // POLY: a key played while another is held, on the same step, joins its chord
    if (rec.add) editTrigs(ctx, p => addChordNote(p, rec.pattern, rec.track, step, rec.note));
    else editTrigs(ctx, p => updateSteps(p, rec.pattern, rec.track, [step], { note: rec.note, trigless: null, micro: rec.micro ? rec.micro : null, chord: null }, { create: 'note' }));
  }, [rec, ctx]);

  // LIVE RECORDING: a knob turned with no trig held becomes a lock on the step that plays, on the
  // active track: a note trig takes the lock, an empty step gets a lock trig (manual p.50). NOT, VEL
  // and LEN go into the note trigs the playhead passes (p.47). The engine sounds the value at once.
  const liveRec = ctx.ui[UIK.liveRec] as { n: number; id: string; key: string; value: number; track: number } | undefined;
  const lastLive = useRef(0);
  useEffect(() => {
    if (!liveRec || liveRec.n === lastLive.current) return;
    lastLive.current = liveRec.n;
    const st = seqStateOf(ctx.engine);
    if (!ctx.values.live_rec || !st?.playing || !st.pattern) return;
    const { track, key, value } = liveRec;
    const step = st.steps[track] ?? -1;
    if (step < 0) return;
    const pattern = st.pattern;
    if (key === 'note' || key === 'vel' || key === 'len') {
      ctx.updateData(d => {
        const p = asProject(d, TRACKS);
        const cur = getPattern(p, pattern).tracks[track]?.steps[step];
        return cur && !cur.trigless ? updateSteps(p, pattern, track, [step], { [key]: value }) : p;
      });
      return;
    }
    ctx.updateData(d => setLock(asProject(d, TRACKS), pattern, track, [step], key, value, { limit: LOCK_LIMIT_A4 }));
    ctx.sendEvent('a4:live-lock', { track, key, value });
  }, [liveRec, ctx]);

  // LIVE RECORDING real-time erase: while the keys stay down, every step the playhead reaches on those
  // tracks loses its locks ([FUNC] + [NO]; NOT / VEL / LEN stay), its trig ([TRACK] + [NO]) or one
  // parameter's lock ([NO] + a knob) (manual p.41, p.47, p.50)
  const erase = ctx.ui[UIK.erase] as EraseMode | null | undefined;
  const seqNow = seqStateOf(ctx.engine);
  const eraseAt = erase && ctx.values.live_rec && seqNow?.playing && seqNow.pattern
    ? `${seqNow.pattern}|${erase.kind}|${erase.key ?? ''}|${erase.tracks.map(t => `${t}:${seqNow.steps[t] ?? -1}`).join(',')}`
    : '';
  useEffect(() => {
    if (!eraseAt || !erase || !seqNow?.pattern) return;
    const pattern = seqNow.pattern;
    ctx.updateData(d => {
      let p = asProject(d, TRACKS);
      for (const t of erase.tracks) {
        const step = seqNow.steps[t] ?? -1;
        if (step < 0) continue;
        if (erase.kind === 'trigs') p = setStepFn(p, pattern, t, step, null);
        else if (erase.kind === 'locks') p = clearLocks(p, pattern, t, [step]);
        else if (erase.key) p = setLock(p, pattern, t, [step], erase.key, null, { create: false });
      }
      return p;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eraseAt]);

  // STEP RECORDING (manual p.41-42): each key played writes a note trig at the active step (its locks
  // stay) and the active step moves on - one step (STANDARD) or the NOTE page's LEN (JUMP, which also
  // locks that LEN on the trig). A key pressed while another is still down joins the chord the first one
  // wrote (POLY tracks). With [YES] held the trig's LEN is how long the key was held.
  const sr = ctx.ui[UIK.stepRec] as StepRec | null | undefined;
  const heldNow = Array.isArray(ctx.ui[UI.heldSteps]) && (ctx.ui[UI.heldSteps] as number[]).length > 0;
  // the engine reports the keys played while they can write something: STEP RECORDING or a held trig
  const report = !!sr || heldNow;
  useEffect(() => {
    ctx.sendEvent('a4:kb-report', { on: report });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report]);
  const kbNote = ctx.engine.kbNote as { id: number; track: number; note: number; held: number; src?: string } | undefined;
  const kbOff = ctx.engine.kbOff as { id: number; track: number; note: number; held: number } | undefined;
  const lastKb = useRef(0);
  const lastKbOff = useRef(0);
  const chordAt = useRef<{ track: number; step: number } | null>(null);
  const pressedAt = useRef(new Map<number, { t: number; step: number; track: number; yes: boolean }>());
  useEffect(() => {
    if (!kbNote || kbNote.id === lastKb.current) return;
    lastKb.current = kbNote.id;
    const cur = stepRecOf(ctx);
    if (!cur) {
      // GRID RECORDING with a trig held: a computer-keyboard (or MIDI) key gives it its note, and keys
      // held together make a chord on a poly track (the A4's own keys do this in MiniKeyboard)
      const u = liveUi(ctx);
      const steps = Array.isArray(u[UI.heldSteps]) ? (u[UI.heldSteps] as number[]) : [];
      if (kbNote.src !== 'keys' || !steps.length || typeof u[UI.heldTrack] !== 'number' || u[UI.heldTrack] !== kbNote.track) return;
      const pat = (u[UI.heldPattern] as string) ?? project(ctx).active;
      const t = kbNote.track;
      if (kbNote.held > 1 && isPolyTrack(ctx.values, t)) editTrigs(ctx, p => steps.reduce((q, st) => addChordNote(q, pat, t, st, kbNote.note), p));
      else editTrigs(ctx, p => updateSteps(p, pat, t, steps, { note: kbNote.note, chord: null }, { create: 'note' }));
      ctx.setUi({ [UI.heldEdited]: true });
      say(ctx, `TRIG ${steps.map(x => x + 1).join(' ')}: ${kbNote.held > 1 && isPolyTrack(ctx.values, t) ? 'CHORD +' : 'NOTE'} ${formatNote(kbNote.note)}`, 1000);
      return;
    }
    const pr = project(ctx);
    const pat = viewPattern(ctx, pr);
    const t = kbNote.track;
    const tr = getPattern(pr, pat).tracks[t];
    const len = trackLength(getPattern(pr, pat), t);
    const ch = chordAt.current;
    if (kbNote.held > 1 && ch && ch.track === t && isPolyTrack(ctx.values, t)) {
      editTrigs(ctx, p => addChordNote(p, pat, t, ch.step, kbNote.note));
      say(ctx, `STEP ${ch.step + 1}: CHORD + ${formatNote(kbNote.note)}`, 1000);
      return;
    }
    const step = ((cur.step % len) + len) % len;
    const nlen = tr?.len ?? LEN_1_STEP;
    editTrigs(ctx, p => updateSteps(p, pat, t, [step], { note: kbNote.note, trigless: null, chord: null, ...(cur.jump ? { len: nlen } : {}) }, { create: 'note' }));
    chordAt.current = { track: t, step };
    const adv = cur.jump ? Math.max(1, Math.min(64, Math.round(Number.isFinite(lengthSteps(nlen)) ? lengthSteps(nlen) : 16))) : 1;
    const next = (step + adv) % len;
    ctx.setUi({ [UIK.stepRec]: { ...cur, step: next }, [UI.stepPage]: Math.floor(next / 16) });
    pressedAt.current.set(kbNote.note, { t: performance.now(), step, track: t, yes: liveUi(ctx)[UIK.yesNo] === 'yes' });
    say(ctx, `STEP ${step + 1}: ${formatNote(kbNote.note)} - NEXT ${next + 1}`, 900);
  }, [kbNote, ctx]);
  useEffect(() => {
    if (!kbOff || kbOff.id === lastKbOff.current) return;
    lastKbOff.current = kbOff.id;
    if (kbOff.held === 0) chordAt.current = null;
    const pa = pressedAt.current.get(kbOff.note);
    pressedAt.current.delete(kbOff.note);
    if (!pa?.yes || !stepRecOf(ctx)) return;
    // [YES] held while the key went down: the trig lasts as long as the key was held (manual p.42)
    const pr = project(ctx);
    const pat = viewPattern(ctx, pr);
    const bpm = seqStateOf(ctx.engine)?.bpm ?? num(ctx.values.tempo, 120);
    const steps = (performance.now() - pa.t) / 1000 / stepSeconds(trackSpeed(getPattern(pr, pat), pa.track), bpm);
    let best = 0;
    for (let i = 1; i < NOTE_LENGTHS.length - 1; i++) if (Math.abs(NOTE_LENGTHS[i] - steps) < Math.abs(NOTE_LENGTHS[best] - steps)) best = i;
    editTrigs(ctx, p => updateSteps(p, pat, pa.track, [pa.step], { len: best }));
    say(ctx, `STEP ${pa.step + 1}: LEN ${formatLength(best)}`, 900);
  }, [kbOff, ctx]);

  // LIVE RECORDING over: the knobs show the kit's values again
  const liveOn = !!ctx.values.live_rec;
  useEffect(() => {
    if (liveOn) return;
    if (ctx.ui[UIK.liveKnob] || ctx.ui[UIK.erase] || ctx.ui[UIK.liveQuant]) ctx.setUi({ [UIK.liveKnob]: null, [UIK.erase]: null, [UIK.liveQuant]: false });
    ctx.sendEvent('a4:live-quant', { on: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveOn]);

  // Shift on a computer keyboard works as FUNC
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === 'Shift' && !e.repeat) ctx.setUi({ [UIK.func]: 'held', [UIK.funcUsed]: false }); };
    const up = (e: KeyboardEvent) => { if (e.key === 'Shift') { ctx.setUi({ [UIK.func]: null }); applyPendingMutes(ctx); } };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.instance]);

  return <KnobCapStyles instance={ctx.instance} />;
}

// ----------------------------------------------------------------------------
// Labels for lock keys and the NOTE page readouts (used by index.ts)
// ----------------------------------------------------------------------------

export { lockLabel, formatLength, TRIG_CONDITIONS, VIEWS, FX_TRACK };
