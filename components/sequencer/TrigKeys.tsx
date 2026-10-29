'use client';
// ============================================================================
// TrigKeys - the 16 trig keys of the visible page
//
//   tap                 trig on / off (removing a trig removes its locks)
//   press and hold      holds the step: ui.heldSteps = [step] -> turning an
//                       encoder parameter-locks it (an empty step becomes a lock
//                       trig); release leaves the trig as it is
//   hold one + tap more selects the range of steps between them (multi-touch)
//   long hold, then release without turning anything / double tap
//                       opens the TrigEditor (it never pops up mid-gesture);
//                       while it is open the steps stay held, so mouse users
//                       can lock with the encoders too
//   editor open         keys pick the step(s) it edits (shift-click: a range)
//   mode 'accent' | 'slide' | 'pslide'   taps toggle that trig flag
//   mode 'mute'         keys 1..N mute / unmute tracks (the pattern's mutes, or
//                       the sequencer's live mutes with muteTarget 'live')
//   editable false      (REC off) keys audition steps: 'seq:preview' / 'seq:preview:up'
//
// LEDs: red note trig, amber lock trig, white ring = playhead, dim when the
// track is muted; markers for locks, condition, micro timing, retrig, slide,
// accent. Lesson steps light keys with focus ids 'seq:trig:<n>' or 'seq:trigs'.
// ============================================================================

import { useEffect, useRef, useState } from 'react';
import type { CustomRenderContext } from '@/types/panel';
import {
  getPattern, setStep, setTrackMute, stepHasLocks, trackLength, updateSteps,
  type PatternId, type Step,
} from '@/lib/sequencer/elektron';
import {
  C, FONT, SeqStyles, UI, editProject, lessonFocus, pageOf, projectOf, seqStateOf, trackOf, useLatest, viewPattern,
  type TrigEditorTarget,
} from './shared';

export type TrigKeysMode = 'trig' | 'accent' | 'slide' | 'pslide' | 'mute';

export interface TrigKeysProps {
  ctx: CustomRenderContext;
  /** Track shown (default: the `track` control) */
  track?: number;
  /** Pattern edited (default: the playing pattern in CHAIN / SONG mode, else the selected one) */
  pattern?: PatternId;
  /** Step page 0..3 (default: ui.stepPage, set by PagePicker) */
  page?: number;
  mode?: TrigKeysMode;
  /** false = REC off: keys audition steps instead of editing */
  editable?: boolean;
  /** 1 row of 16 or 2 rows of 8 */
  rows?: 1 | 2;
  /** Note-trig LED colour */
  color?: string;
  /** Track count when the data is missing */
  tracks?: number;
  /** Labels for mute mode */
  trackNames?: string[];
  /** Long hold that opens the editor (ms, default 600) */
  longPressMs?: number;
  doubleTapMs?: number;
  /** Open the TrigEditor on long hold / double tap (default true) */
  editor?: boolean;
  numbered?: boolean;
  /** Mute mode writes the pattern's track mutes (saved) or the sequencer's live mutes ('seq:mute') */
  muteTarget?: 'pattern' | 'live';
}

interface Hold {
  step: number;
  pointer: number;
  wasOn: boolean;
  before: Step | undefined;
  stepsRef: unknown;
  range: boolean;
  /** Held past longPressMs: releasing without an edit opens the editor */
  long: boolean;
  timer: ReturnType<typeof setTimeout> | null;
}

const NO_STEPS: Readonly<Record<number, Step>> = Object.freeze({});
const MODE_COLOR: Record<TrigKeysMode, string> = { trig: C.red, accent: C.pink, slide: C.yellow, pslide: C.cyan, mute: C.green };
const range = (a: number, b: number) => Array.from({ length: Math.abs(b - a) + 1 }, (_, i) => Math.min(a, b) + i);

export default function TrigKeys(props: TrigKeysProps) {
  const { ctx, mode = 'trig', editable = true, rows = 1, numbered = true, editor = true } = props;
  const tracks = props.tracks ?? 4;
  const project = projectOf(ctx, tracks);
  const track = trackOf(ctx, project, props.track);
  const pattern = viewPattern(ctx, project, props.pattern);
  const page = pageOf(ctx, project, pattern, track, props.page);
  const pat = getPattern(project, pattern);
  const trk = pat.tracks[track];
  // A stable fallback: the hold gesture compares the steps object to detect edits
  const steps = trk?.steps ?? NO_STEPS;
  const len = trackLength(pat, track);
  const st = seqStateOf(ctx.engine);
  const playStep = st?.playing && st.pattern === pattern ? st.steps[track] ?? -1 : -1;
  const focus = lessonFocus(ctx);
  const longPressMs = props.longPressMs ?? 600;
  const doubleTapMs = props.doubleTapMs ?? 320;

  const ui = ctx.ui;
  const heldSet = new Set<number>(
    ui[UI.heldTrack] === track && ui[UI.heldPattern] === pattern && Array.isArray(ui[UI.heldSteps]) ? (ui[UI.heldSteps] as number[]) : [],
  );
  const editorOpen = !!ui[UI.trigEditor];

  // Latest values for pointer handlers (they outlive renders)
  const live = useLatest({ ctx, project, track, pattern, steps, mode, editable, editorOpen, tracks });
  const hold = useRef<Hold | null>(null);
  const extra = useRef(new Map<number, number>()); // other pointers in a range gesture -> step
  const lastTap = useRef<{ step: number; time: number; before: Step | undefined; wasOn: boolean } | null>(null);
  const preview = useRef(-1);
  /** Step whose long hold is armed (release opens the editor) - drawn with a pulsing ring */
  const [armed, setArmed] = useState(-1);
  const muteLive = props.muteTarget === 'live';

  // Unmount / page or track change: drop a pending hold
  useEffect(() => () => { if (hold.current?.timer) clearTimeout(hold.current.timer); }, []);

  const release = () => {
    const l = live.current;
    l.ctx.setUi({ [UI.heldSteps]: [], [UI.heldEdited]: false });
  };

  const openEditor = (target: TrigEditorTarget) => {
    live.current.ctx.setUi({
      [UI.trigEditor]: target, [UI.heldSteps]: target.steps, [UI.heldTrack]: target.track, [UI.heldPattern]: target.pattern, [UI.heldEdited]: false,
    });
  };

  const down = (i: number, e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    e.stopPropagation();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    const l = live.current;
    const step = page * 16 + i;

    if (l.mode === 'mute') {
      if (i < l.project.tracks) {
        if (muteLive) {
          l.ctx.sendEvent('seq:mute', { track: i });
        } else {
          const muted = !!getPattern(l.project, l.pattern).tracks[i]?.mute;
          editProject(l.ctx, l.tracks, p => setTrackMute(p, l.pattern, i, !muted));
        }
      }
      return;
    }
    if (step >= len) return;
    if (!l.editable) {
      preview.current = e.pointerId;
      l.ctx.sendEvent('seq:preview', { track: l.track, step, pattern: l.pattern });
      return;
    }
    if (l.mode !== 'trig') {
      const flag = l.mode;
      const on = !!(l.steps[step] as Step | undefined)?.[flag];
      editProject(l.ctx, l.tracks, p => updateSteps(p, l.pattern, l.track, [step], { [flag]: on ? null : true }, { create: 'note' }));
      return;
    }

    // Second finger while holding: select the range
    const h = hold.current;
    if (h) {
      h.range = true;
      extra.current.set(e.pointerId, step);
      l.ctx.setUi({ [UI.heldSteps]: range(h.step, step), [UI.heldTrack]: l.track, [UI.heldPattern]: l.pattern });
      return;
    }

    // Editor open: keys pick the step(s) to edit (shift-click extends the range)
    if (l.editorOpen) {
      const cur = l.ctx.ui[UI.trigEditor] as TrigEditorTarget | undefined;
      if (cur && cur.track === l.track && cur.pattern === l.pattern && cur.steps.length === 1 && cur.steps[0] === step && !e.shiftKey) {
        l.ctx.setUi({ [UI.trigEditor]: null, [UI.heldSteps]: [], [UI.heldEdited]: false });
        return;
      }
      const steps = e.shiftKey && cur ? range(cur.steps[0], step) : [step];
      openEditor({ track: l.track, pattern: l.pattern, steps });
      return;
    }

    const before = l.steps[step] as Step | undefined;
    const nh: Hold = {
      step, pointer: e.pointerId, wasOn: !!before, before, stepsRef: l.steps, range: false, long: false, timer: null,
    };
    if (editor) {
      nh.timer = setTimeout(() => {
        const cur = hold.current;
        if (!cur || cur !== nh) return;
        const lv = live.current;
        if (lv.ctx.ui[UI.heldEdited] === true || lv.steps !== cur.stepsRef) return; // it is a p-lock gesture
        cur.long = true;
        setArmed(cur.step);
      }, longPressMs);
    }
    hold.current = nh;
    l.ctx.setUi({ [UI.heldSteps]: [step], [UI.heldTrack]: l.track, [UI.heldPattern]: l.pattern, [UI.heldEdited]: false });
  };

  const up = (e: React.PointerEvent<HTMLButtonElement>, cancelled = false) => {
    const l = live.current;
    if (preview.current === e.pointerId) {
      preview.current = -1;
      l.ctx.sendEvent('seq:preview:up', { track: l.track });
      return;
    }
    if (extra.current.delete(e.pointerId)) return; // a range key
    const h = hold.current;
    if (!h || h.pointer !== e.pointerId) return;
    hold.current = null;
    if (h.timer) clearTimeout(h.timer);
    setArmed(-1);
    const edited = l.ctx.ui[UI.heldEdited] === true || l.steps !== h.stepsRef;
    if (h.long && !edited && !cancelled) {
      // Long hold released without a lock: edit the held step (or range)
      const held = Array.isArray(l.ctx.ui[UI.heldSteps]) ? (l.ctx.ui[UI.heldSteps] as number[]) : [];
      openEditor({ track: l.track, pattern: l.pattern, steps: held.length ? held.slice() : [h.step] });
      return;
    }
    if (h.range || edited || cancelled) {
      release();
      return;
    }
    // A tap
    const now = performance.now();
    const lt = lastTap.current;
    if (editor && lt && lt.step === h.step && now - lt.time < doubleTapMs) {
      lastTap.current = null;
      const restore = lt.wasOn ? lt.before : (l.steps[h.step] as Step | undefined) ?? {};
      editProject(l.ctx, l.tracks, p => setStep(p, l.pattern, l.track, h.step, restore));
      openEditor({ track: l.track, pattern: l.pattern, steps: [h.step] });
      return;
    }
    lastTap.current = { step: h.step, time: now, before: h.before, wasOn: h.wasOn };
    editProject(l.ctx, l.tracks, p => setStep(p, l.pattern, l.track, h.step, h.wasOn ? null : {}));
    release();
  };

  const color = MODE_COLOR[mode] ?? props.color ?? C.red;
  const trigColor = props.color ?? C.red;
  const perRow = rows === 2 ? 8 : 16;
  const keys = Array.from({ length: 16 }, (_, i) => i);
  const trackMuted = !!trk?.mute || !!st?.mutes?.[track];

  const renderKey = (i: number) => {
    const step = page * 16 + i;
    const s = steps[step] as Step | undefined;
    const inLen = step < len;
    const isHead = playStep === step;
    const held = mode !== 'mute' && heldSet.has(step);
    const target = !!focus && (focus.has(`seq:trig:${step + 1}`) || focus.has('seq:trigs'));
    let fill = C.key;
    let lit = 0;
    let text = C.dim;
    let label: string = numbered ? String(step + 1) : '';

    if (mode === 'mute') {
      const exists = i < project.tracks;
      const muted = exists && (muteLive ? !!st?.mutes?.[i] : !!pat.tracks[i]?.mute);
      fill = !exists ? '#17181a' : muted ? '#26282b' : C.green;
      lit = exists && !muted ? 1 : 0;
      text = lit ? '#0d1a10' : C.dim;
      label = exists ? props.trackNames?.[i] ?? `T${i + 1}` : '';
    } else if (!inLen) {
      fill = '#17181a';
      text = C.faint;
    } else if (mode !== 'trig') {
      const on = !!s?.[mode as 'accent' | 'slide' | 'pslide'];
      if (on) { fill = color; lit = 1; text = '#111'; } else if (s) { fill = '#4a2a28'; text = C.text; }
    } else if (s) {
      if (s.trigless) { fill = C.amber; lit = 0.6; text = '#1a1206'; } else { fill = trigColor; lit = 1; text = '#1a0605'; }
    }
    const dimmed = mode !== 'mute' && trackMuted && lit > 0;
    const markers = mode === 'trig' && s && inLen;
    return (
      <button
        key={i}
        type="button"
        aria-label={mode === 'mute' ? `Mute track ${i + 1}` : `Trig key ${step + 1}${s ? (s.trigless ? ' lock trig' : ' trig on') : ''}`}
        data-step={step}
        data-trig={s ? (s.trigless ? 'lock' : 'note') : 'none'}
        data-playhead={isHead ? '1' : undefined}
        data-held={held ? '1' : undefined}
        onPointerDown={e => down(i, e)}
        onPointerUp={e => up(e)}
        onPointerCancel={e => up(e, true)}
        onLostPointerCapture={e => up(e, true)}
        onContextMenu={e => e.preventDefault()}
        className={armed === step && mode === 'trig' ? 'seq-armed' : target ? 'seq-target' : undefined}
        style={{
          position: 'relative', flex: 1, minWidth: 0, minHeight: 28, borderRadius: 3, border: `1px solid ${held ? C.amber : C.border}`,
          background: fill, opacity: dimmed ? 0.42 : 1, touchAction: 'none', WebkitTapHighlightColor: 'transparent', WebkitTouchCallout: 'none', userSelect: 'none', WebkitUserSelect: 'none', cursor: inLen || mode === 'mute' ? 'pointer' : 'default',
          boxShadow: [
            lit ? `0 0 ${8 * lit}px ${fill}` : 'inset 0 2px 3px rgba(0,0,0,0.6)',
            isHead ? `inset 0 0 0 2px ${C.white}` : '',
            held ? `0 0 0 2px ${C.amber}` : '',
          ].filter(Boolean).join(', '),
          filter: isHead && !lit ? 'brightness(1.9)' : undefined,
          fontFamily: FONT, padding: 0, overflow: 'hidden',
        }}
      >
        <span style={{ position: 'absolute', left: 3, top: 2, fontSize: 9, fontWeight: 700, color: text, lineHeight: '10px' }}>{label}</span>
        {markers && stepHasLocks(s) && (
          <span style={{ position: 'absolute', right: 3, top: 3, width: 5, height: 5, borderRadius: 3, background: s.trigless ? '#3a2405' : C.white, boxShadow: s.trigless ? undefined : `0 0 3px ${C.white}` }} />
        )}
        {markers && s.cond && (
          <span style={{ position: 'absolute', left: 2, right: 2, bottom: 2, fontSize: 9, fontWeight: 800, lineHeight: '10px', color: '#061620', background: C.cyan, borderRadius: 2, textAlign: 'center', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            {s.cond}
          </span>
        )}
        {markers && (s.micro || s.retrig || s.slide || s.accent) && (
          <span style={{ position: 'absolute', right: 3, bottom: s.cond ? 13 : 2, fontSize: 9, fontWeight: 800, lineHeight: '10px', color: text }}>
            {s.micro ? (s.micro < 0 ? '◂' : '▸') : ''}{s.retrig ? 'R' : ''}{s.slide ? 'S' : ''}{s.accent ? 'A' : ''}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="select-none" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', gap: 3, touchAction: 'none' }}>
      <SeqStyles />
      {rows === 2 ? (
        <>
          <div style={{ flex: 1, display: 'flex', gap: 3 }}>{keys.slice(0, perRow).map(renderKey)}</div>
          <div style={{ flex: 1, display: 'flex', gap: 3 }}>{keys.slice(perRow).map(renderKey)}</div>
        </>
      ) : (
        <div style={{ flex: 1, display: 'flex', gap: 3 }}>{keys.map(renderKey)}</div>
      )}
    </div>
  );
}
