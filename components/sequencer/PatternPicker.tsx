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
//   CHANGE             SEQUENTIAL / DIRECT START / DIRECT JUMP / TEMP JUMP
//   PLAY               what PLAY plays: the pattern, the chain or the song
//
// LEDs: green = playing, blinking amber = cued, white outline = selected,
// red dot = holds trigs. Opens with ui.seqMenu = 'pattern' (MenuKey), or pass
// `open`. Lesson focus ids: 'seq:pattern:<ID>', 'seq:patterns', 'seq:bank:<B>',
// 'seq:copy', 'seq:paste', 'seq:clear', 'seq:change:<mode>', 'seq:mode:<mode>'.
// ============================================================================

import { useEffect, useRef, useState } from 'react';
import type { CustomRenderContext } from '@/types/panel';
import {
  CHANGE_MODES, clearPattern, copyPattern, getPattern, pastePattern, setActive, setChangeMode, setPlayMode,
  updatePatternSettings, type ChangeMode, type Pattern, type PlayMode,
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
  /** Change modes offered (default all four) */
  changeModes?: readonly ChangeMode[];
  /** Show the PATTERN / CHAIN / SONG play mode keys (default true) */
  playModes?: boolean;
  /** Show the pattern name field (default true) */
  names?: boolean;
  /** Close the menu after picking a pattern (default false) */
  closeOnPick?: boolean;
}

const CHANGE_LABEL: Record<ChangeMode, string> = {
  sequential: 'SEQUENTIAL', 'direct-start': 'DIRECT START', 'direct-jump': 'DIRECT JUMP', 'temp-jump': 'TEMP JUMP',
};
const CHANGE_HELP: Record<ChangeMode, string> = {
  sequential: 'The new pattern starts when the playing one reaches its end',
  'direct-start': 'Changes on the next step; the new pattern starts from step 1',
  'direct-jump': 'Changes on the next step and carries on from the same position',
  'temp-jump': 'Like DIRECT JUMP, plays the new pattern to its end once, then returns',
};
const PLAY_LABEL: Record<PlayMode, string> = { pattern: 'PATTERN', chain: 'CHAIN', song: 'SONG' };

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
  const name = getPattern(project, active).name;

  const pick = (id: string) => {
    editProject(ctx, tracks, p => setActive(p, id));
    if (props.closeOnPick) closeMenu(ctx);
  };
  const clear = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(() => setConfirmClear(false), 2500);
      return;
    }
    setConfirmClear(false);
    editProject(ctx, tracks, p => clearPattern(p, active));
  };

  const status = st?.playing
    ? `${active} · playing ${st.pattern ?? '-'}${st.queued ? ` · cued ${st.queued}` : ''}${st.arranged ? ' · ARRANGER' : ''}`
    : `${active}${name ? ` ${name}` : ''}`;

  return (
    <Overlay portal={props.portal} portalPlacement={props.portalPlacement} portalSize={props.portalSize ?? { w: 620, h: 420 }}>
      <Frame
        title="PATTERN"
        sub={status}
        onClose={props.open === undefined ? () => closeMenu(ctx) : undefined}
        right={(
          <>
            <SeqButton onPress={() => ctx.setUi({ [UI.clipboard]: copyPattern(project, active) })} disabled={!pat} highlight={!!focus?.has('seq:copy')} title={`Copy ${active}`}>COPY</SeqButton>
            <SeqButton onPress={() => editProject(ctx, tracks, p => pastePattern(p, active, clip ?? null))} disabled={!clip} highlight={!!focus?.has('seq:paste')} title={clip ? `Paste into ${active}` : 'Copy a pattern first'}>PASTE</SeqButton>
            <SeqButton onPress={clear} active={confirmClear} color={C.red} disabled={!pat} highlight={!!focus?.has('seq:clear')} title={confirmClear ? 'Tap again to clear' : `Clear ${active}`}>
              {confirmClear ? 'SURE?' : 'CLEAR'}
            </SeqButton>
          </>
        )}
      >
        <PatternGrid ctx={ctx} project={project} bank={bank} banks={props.banks} onBank={b => ctx.setUi({ [UI.bank]: b })} onPattern={pick} selected={active} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {modes.length > 1 && (
            <Group label="PATTERN CHANGE">
              {modes.map(m => (
                <SeqButton
                  key={m}
                  active={project.changeMode === m}
                  color={C.cyan}
                  onPress={() => editProject(ctx, tracks, p => setChangeMode(p, m))}
                  highlight={!!focus?.has(`seq:change:${m}`)}
                  title={CHANGE_HELP[m]}
                >
                  {CHANGE_LABEL[m]}
                </SeqButton>
              ))}
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
