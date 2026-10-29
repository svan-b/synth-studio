'use client';
// ============================================================================
// PatternPicker - banks A-H x 16 patterns (the hardware's [PTN] + [BANK] keys)
//
//   tap a bank         show its 16 patterns (a dot = the bank holds patterns)
//   tap a pattern      select it: stopped, it plays on PLAY; playing, it is cued
//                      per the change mode (SEQUENTIAL: at the end of the
//                      playing pattern - it blinks until then)
//   COPY / PASTE       copy the selected pattern, paste it into another slot
//   CLEAR              empty the selected slot (tap twice to confirm)
//   UNDO               puts back what the last PASTE or CLEAR replaced; tap
//                      again to redo (the hardware: the same keys again)
//   SAVE / RELOAD      SAVE PATTERN sets the restore point, RELOAD PATTERN goes
//                      back to it (its state when it was selected, or at the
//                      last SAVE) - an undo for live edits
//   CHANGE             SEQUENTIAL / DIRECT START / DIRECT JUMP; TEMP JUMP arms a
//                      one-shot jump ('seq:temp-jump'): it blinks while armed,
//                      lights while the jumped-to pattern plays, then goes off
//   PLAY               what PLAY plays: the pattern, the chain or the song
//
// LEDs: green = playing, blinking amber = cued, white outline = selected,
// red dot = holds trigs. Opens with ui.seqMenu = 'pattern' (MenuKey), or pass
// `open`. Lesson focus ids: 'seq:pattern:<ID>', 'seq:patterns', 'seq:bank:<B>',
// 'seq:copy', 'seq:paste', 'seq:clear', 'seq:undo', 'seq:save', 'seq:reload',
// 'seq:change:<mode>', 'seq:temp-jump', 'seq:mode:<mode>'.
// ============================================================================

import { useEffect, useRef, useState } from 'react';
import type { CustomRenderContext } from '@/types/panel';
import {
  CHANGE_MODES, clearPattern, copyPattern, getPattern, pastePattern, reloadPattern, savePattern, setActive, setChangeMode,
  setPlayMode, updatePatternSettings, type ChangeMode, type Pattern, type PatternId, type PlayMode, type Project,
} from '@/lib/sequencer/elektron';
import {
  C, Frame, Group, MONO, Overlay, PatternGrid, SeqButton, UI, bankOf, closeMenu, editProject, lessonFocus, menuOpen,
  projectOf, seqStateOf, type OverlayProps,
} from './shared';

export interface PatternPickerProps extends OverlayProps {
  ctx: CustomRenderContext;
  tracks?: number;
  /** Banks offered (default 8: A-H) */
  banks?: number;
  /** Change modes offered (default all four; 'temp-jump' is the TEMP JUMP arming key) */
  changeModes?: readonly ChangeMode[];
  /** Show the PATTERN / CHAIN / SONG play mode keys (default true) */
  playModes?: boolean;
  /** Show the pattern name field (default true) */
  names?: boolean;
  /** Close the menu after picking a pattern (default false) */
  closeOnPick?: boolean;
  /** Show SAVE / RELOAD (default true) */
  saveReload?: boolean;
}

/** What the last PASTE / CLEAR (or UNDO) replaced in a slot: UNDO puts it back */
interface UndoRecord {
  id: PatternId;
  pattern: Pattern | null;
  what: 'paste' | 'clear';
  /** The record now holds the state before an UNDO: the key reads REDO */
  undone?: boolean;
}

const CHANGE_LABEL: Record<ChangeMode, string> = {
  sequential: 'SEQUENTIAL', 'direct-start': 'DIRECT START', 'direct-jump': 'DIRECT JUMP', 'temp-jump': 'TEMP JUMP',
};
const CHANGE_HELP: Record<ChangeMode, string> = {
  sequential: 'The new pattern starts when the playing one reaches its end',
  'direct-start': 'Changes on the next step; the new pattern starts from step 1',
  'direct-jump': 'Changes on the next step and carries on from the same position',
  'temp-jump': 'Arms a one-off jump: the next pattern you pick starts at once from the same position, plays to its end once, then the previous pattern returns',
};
const PLAY_LABEL: Record<PlayMode, string> = { pattern: 'PATTERN', chain: 'CHAIN', song: 'SONG' };

const isUndo = (x: unknown): x is UndoRecord => typeof x === 'object' && x !== null && typeof (x as UndoRecord).id === 'string';

/** Does the active pattern differ from its restore point (so RELOAD would change it)? */
function canReload(p: Project): boolean {
  const r = p.restore;
  if (!r || r.id !== p.active) return false;
  const cur = p.patterns[p.active] ?? null;
  if (cur === r.pattern) return false;
  // Identity breaks after a save / load round trip: compare the content
  return JSON.stringify(cur) !== JSON.stringify(r.pattern);
}

export default function PatternPicker(props: PatternPickerProps) {
  const { ctx } = props;
  const tracks = props.tracks ?? 4;
  const [confirmClear, setConfirmClear] = useState(false);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (confirmTimer.current) clearTimeout(confirmTimer.current); }, []);
  if (!menuOpen(ctx, 'pattern', props.open)) return null;

  const project = projectOf(ctx, tracks);
  const active = project.active;
  const pat = project.patterns[active];
  const st = seqStateOf(ctx.engine);
  const focus = lessonFocus(ctx);
  const clip = ctx.ui[UI.clipboard] as Pattern | null | undefined;
  const bank = bankOf(ctx, active);
  const modes = props.changeModes ?? CHANGE_MODES;
  const baseModes = modes.filter(m => m !== 'temp-jump');
  const name = getPattern(project, active).name;
  const undoRec = isUndo(ctx.ui[UI.undo]) && (ctx.ui[UI.undo] as UndoRecord).id === active ? (ctx.ui[UI.undo] as UndoRecord) : null;
  const tempJump = st?.tempJump ?? 'off';
  // The base change mode: a saved 'temp-jump' project mode (older data) shows the mode it falls back to
  const baseMode: ChangeMode = project.changeMode !== 'temp-jump'
    ? project.changeMode
    : st?.changeMode && st.changeMode !== 'temp-jump' ? st.changeMode : 'sequential';
  const reloadable = canReload(project);
  const saved = !reloadable && project.restore?.id === active;

  const pick = (id: string) => {
    editProject(ctx, tracks, p => setActive(p, id));
    if (props.closeOnPick) closeMenu(ctx);
  };
  /** Replace the active slot, remembering what was there for UNDO */
  const replace = (what: UndoRecord['what'], next: Pattern | null) => {
    const rec: UndoRecord = { id: active, pattern: copyPattern(project, active), what };
    ctx.setUi({ [UI.undo]: rec });
    editProject(ctx, tracks, p => (next ? pastePattern(p, active, next) : clearPattern(p, active)));
  };
  const clear = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(() => setConfirmClear(false), 2500);
      return;
    }
    setConfirmClear(false);
    replace('clear', null);
  };
  const undo = () => {
    if (!undoRec) return;
    // Swap: the slot gets the remembered pattern, the record keeps what the slot held (REDO)
    const rec: UndoRecord = { ...undoRec, pattern: copyPattern(project, active), undone: !undoRec.undone };
    ctx.setUi({ [UI.undo]: rec });
    editProject(ctx, tracks, p => pastePattern(p, undoRec.id, undoRec.pattern));
  };

  const status = st?.playing
    ? `${active} · playing ${st.pattern ?? '-'}${st.queued ? ` · cued ${st.queued}` : ''}${st.arranged ? ' · ARRANGER' : ''}`
    : `${active}${name ? ` ${name}` : ''}${st?.paused ? ' · PAUSED' : ''}`;
  const undoLabel = `${undoRec?.undone ? 'REDO' : 'UNDO'}${undoRec ? ` ${undoRec.what.toUpperCase()}` : ''}`;

  return (
    <Overlay portal={props.portal} portalPlacement={props.portalPlacement} portalSize={props.portalSize ?? { w: 640, h: 440 }}>
      <Frame
        title="PATTERN"
        sub={status}
        onClose={props.open === undefined ? () => closeMenu(ctx) : undefined}
        right={(
          <>
            <SeqButton onPress={() => ctx.setUi({ [UI.clipboard]: copyPattern(project, active) })} disabled={!pat} highlight={!!focus?.has('seq:copy')} title={`Copy ${active}`}>COPY</SeqButton>
            <SeqButton onPress={() => replace('paste', clip ?? null)} disabled={!clip} highlight={!!focus?.has('seq:paste')} title={clip ? `Paste into ${active} (UNDO puts back what was there)` : 'Copy a pattern first'}>PASTE</SeqButton>
            <SeqButton onPress={clear} active={confirmClear} color={C.red} disabled={!pat} highlight={!!focus?.has('seq:clear')} title={confirmClear ? 'Tap again to clear' : `Clear ${active}`}>
              {confirmClear ? 'SURE?' : 'CLEAR'}
            </SeqButton>
            <SeqButton
              onPress={undo}
              disabled={!undoRec}
              highlight={!!focus?.has('seq:undo')}
              title={undoRec ? `${undoRec.undone ? 'Redo' : 'Undo'} the ${undoRec.what} on ${active}` : 'Undo the last PASTE or CLEAR on this slot'}
              ariaLabel={undoLabel}
            >
              {undoRec?.undone ? 'REDO' : 'UNDO'}
            </SeqButton>
          </>
        )}
      >
        <PatternGrid ctx={ctx} project={project} bank={bank} banks={props.banks} onBank={b => ctx.setUi({ [UI.bank]: b })} onPattern={pick} selected={active} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {modes.length > 1 && (
            <Group label="PATTERN CHANGE">
              {baseModes.map(m => (
                <SeqButton
                  key={m}
                  active={baseMode === m}
                  color={C.cyan}
                  onPress={() => editProject(ctx, tracks, p => setChangeMode(p, m))}
                  highlight={!!focus?.has(`seq:change:${m}`)}
                  title={CHANGE_HELP[m]}
                >
                  {CHANGE_LABEL[m]}
                </SeqButton>
              ))}
              {modes.includes('temp-jump') && (
                <SeqButton
                  active={tempJump !== 'off'}
                  blink={tempJump === 'armed'}
                  color={C.amber}
                  onPress={() => ctx.sendEvent('seq:temp-jump')}
                  highlight={!!focus?.has('seq:change:temp-jump') || !!focus?.has('seq:temp-jump')}
                  title={tempJump === 'armed' ? 'TEMP JUMP armed: pick a pattern (tap again to disarm)' : tempJump === 'active' ? 'TEMP JUMP: the jumped-to pattern plays once, then the previous one returns' : CHANGE_HELP['temp-jump']}
                  ariaLabel={`Temp jump ${tempJump}`}
                >
                  {CHANGE_LABEL['temp-jump']}
                </SeqButton>
              )}
            </Group>
          )}
          {props.playModes !== false && (
            <Group label="PLAY">
              {(['pattern', 'chain', 'song'] as const).map(m => {
                const empty = (m === 'chain' && !project.chain.length) || (m === 'song' && !project.song.rows.length);
                return (
                  <SeqButton
                    key={m}
                    active={project.mode === m}
                    color={C.green}
                    dim={empty}
                    onPress={() => editProject(ctx, tracks, p => setPlayMode(p, m))}
                    highlight={!!focus?.has(`seq:mode:${m}`)}
                    title={empty ? `The ${m} is empty - PLAY plays the pattern until you add some` : `PLAY plays the ${m}`}
                  >
                    {PLAY_LABEL[m]}
                  </SeqButton>
                );
              })}
            </Group>
          )}
          {props.saveReload !== false && (
            <Group label="RESTORE POINT">
              <SeqButton
                onPress={() => editProject(ctx, tracks, savePattern)}
                dim={saved}
                highlight={!!focus?.has('seq:save')}
                title={`SAVE PATTERN: ${active} as it is now becomes the point RELOAD goes back to`}
              >
                SAVE
              </SeqButton>
              <SeqButton
                onPress={() => editProject(ctx, tracks, reloadPattern)}
                disabled={!reloadable}
                highlight={!!focus?.has('seq:reload')}
                title={reloadable
                  ? `RELOAD PATTERN: undo the edits to ${active} since it was selected or saved`
                  : project.restore?.id === active
                    ? 'Nothing to reload: no edits since the pattern was selected or saved'
                    : 'No restore point yet: SAVE (or select the pattern) first'}
              >
                RELOAD
              </SeqButton>
            </Group>
          )}
          {props.names !== false && (
            <Group label="NAME">
              <input
                value={name}
                maxLength={16}
                placeholder={active}
                aria-label={`Name of pattern ${active}`}
                onChange={e => { const v = e.target.value.toUpperCase(); editProject(ctx, tracks, p => updatePatternSettings(p, active, { name: v })); }}
                onPointerDown={e => e.stopPropagation()}
                onKeyDown={e => e.stopPropagation()}
                style={{
                  width: 150, height: 30, boxSizing: 'border-box', borderRadius: 4, border: `1px solid ${C.border}`, background: '#0b0c0d',
                  color: C.text, fontFamily: MONO, fontSize: 16, padding: '0 6px', textTransform: 'uppercase',
                }}
              />
            </Group>
          )}
        </div>
      </Frame>
    </Overlay>
  );
}
