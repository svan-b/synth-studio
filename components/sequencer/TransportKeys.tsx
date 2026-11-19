'use client';
// ============================================================================
// TransportKeys - [PLAY] and [STOP], with the hardware's pause
//
//   PLAY   stopped: plays from the top. Playing: pauses where it is. Paused:
//          carries on from there (A4 MKII manual p.39, Rytm MKII manual p.37).
//   STOP   stops (a pause too); the next PLAY starts from the top.
// Synced to the studio, PLAY and STOP play and stop the studio transport (it
// has no pause). LEDs: PLAY green while playing, blinking while paused.
//
// The device's own keys can do the same with pressPlay(ctx) / pressStop(ctx).
// They drive the device's transport control (`play`, the module's
// transportControl: true starts, false stops) and send 'seq:pause' /
// 'seq:resume' / 'seq:start' / 'seq:stop', which ElektronSequencer.handleEvent
// routes - so the control stays on while paused, and STOP (or the studio's
// stop-all) ends the pause. Lesson focus ids: 'seq:play', 'seq:stop' (and a
// step's `control` or `event`: 'play', 'seq:pause', 'seq:resume').
// ============================================================================

import type { CSSProperties } from 'react';
import type { CustomRenderContext } from '@/types/panel';
import { C, SeqButton, SeqStyles, lessonFocus, seqStateOf } from './shared';

/**
 * [PLAY]: stopped - play from the top; playing - pause; paused - resume. Synced
 * to the studio transport: play / stop it (no pause). `control` is the
 * device's transport control (default 'play').
 */
export function pressPlay(ctx: CustomRenderContext, control = 'play'): void {
  const st = seqStateOf(ctx.engine);
  const on = ctx.values[control] === true;
  if (!st) {
    ctx.setValue(control, !on);
    return;
  }
  if (st.following) {
    ctx.setValue(control, !st.playing);
    return;
  }
  if (st.paused) { ctx.sendEvent('seq:resume'); return; }
  if (st.playing) { ctx.sendEvent('seq:pause'); return; }
  // Stopped. A song that ended stopped by itself and left the control on: start again by event
  if (on) ctx.sendEvent('seq:start');
  else ctx.setValue(control, true);
}

/** [STOP]: stop playback (also a pause); the next PLAY plays from the top */
export function pressStop(ctx: CustomRenderContext, control = 'play'): void {
  const st = seqStateOf(ctx.engine);
  if (ctx.values[control] !== false) ctx.setValue(control, false);
  // The control may already be off (a pause keeps it on, a song that ended does not reset it)
  if (st && !st.following && (st.playing || st.paused)) ctx.sendEvent('seq:stop');
}

export interface TransportKeysProps {
  ctx: CustomRenderContext;
  /** The device's transport control (default 'play') */
  control?: string;
  /** Stack the keys vertically */
  vertical?: boolean;
  /** Key labels (default ▶ and ■) */
  labels?: { play?: string; stop?: string };
  style?: CSSProperties;
}

export default function TransportKeys(props: TransportKeysProps) {
  const { ctx, vertical } = props;
  const control = props.control ?? 'play';
  const st = seqStateOf(ctx.engine);
  const focus = lessonFocus(ctx);
  const playing = st ? st.playing : ctx.values[control] === true;
  const paused = !!st?.paused;
  const playTarget = !!focus && (focus.has('seq:play') || focus.has(control) || focus.has('seq:pause') || focus.has('seq:resume'));
  const playTitle = st?.following
    ? (playing ? 'Stop the studio transport' : 'Play the studio transport')
    : paused ? 'Paused: PLAY carries on from here' : playing ? 'PLAY again pauses' : 'Play from the top';
  const key: CSSProperties = { flex: 1, height: '100%', minWidth: 32, fontSize: 13 };
  return (
    <div
      onPointerDown={e => e.stopPropagation()}
      style={{ width: '100%', height: '100%', display: 'flex', flexDirection: vertical ? 'column' : 'row', gap: 4, ...props.style }}
    >
      <SeqStyles />
      <SeqButton
        active={playing || paused}
        blink={paused}
        color={C.green}
        highlight={playTarget}
        onPress={() => pressPlay(ctx, control)}
        title={playTitle}
        ariaLabel={paused ? 'Play (paused)' : playing ? 'Pause' : 'Play'}
        style={key}
      >
        {props.labels?.play ?? '▶'}
      </SeqButton>
      <SeqButton
        highlight={!!focus?.has('seq:stop')}
        onPress={() => pressStop(ctx, control)}
        title="Stop; the next PLAY starts from the top"
        ariaLabel="Stop"
        style={key}
      >
        {props.labels?.stop ?? '■'}
      </SeqButton>
    </div>
  );
}
