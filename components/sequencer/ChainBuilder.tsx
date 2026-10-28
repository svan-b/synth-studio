'use client';
// ============================================================================
// ChainBuilder - a chain is a list of patterns played in order, looping
//
//   tap a pattern below      append it to the chain (after the selected entry)
//   tap an entry             select it; then move it, remove it, or cue it
//   PLAY CHAIN               PLAY plays the chain instead of the pattern
//                            (the play mode; it changes at the end of the
//                            playing pattern)
//   CUE                      play from this entry: on the next start, or at the
//                            next pattern change while the chain plays
//
// The playing entry is green. Opens with ui.seqMenu = 'chain' (MenuKey), or pass
// `open`. Lesson focus ids: 'seq:chain', 'seq:chain:<index>' (0-based), plus the
// grid's 'seq:pattern:<ID>'.
// ============================================================================

import { useEffect, useRef, useState } from 'react';
import type { CustomRenderContext } from '@/types/panel';
import { chainAdd, chainMove, chainRemove, setChain, setPlayMode } from '@/lib/sequencer/elektron';
import {
  C, Frame, Group, Label, MONO, Overlay, PatternGrid, SeqButton, UI, bankOf, closeMenu, editProject, lessonFocus, menuOpen,
  projectOf, seqStateOf, type OverlayProps,
} from './shared';

export interface ChainBuilderProps extends OverlayProps {
  ctx: CustomRenderContext;
  tracks?: number;
  banks?: number;
  /** Most entries allowed (default 64) */
  maxLength?: number;
}

export default function ChainBuilder(props: ChainBuilderProps) {
  const { ctx } = props;
  const tracks = props.tracks ?? 4;
  const [sel, setSel] = useState(-1);
  const [confirmClear, setConfirmClear] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  if (!menuOpen(ctx, 'chain', props.open)) return null;

  const project = projectOf(ctx, tracks);
  const chain = project.chain;
  const max = props.maxLength ?? 64;
  const st = seqStateOf(ctx.engine);
  const chainPlaying = !!st?.playing && st.mode === 'chain';
  const playingIdx = chainPlaying ? st!.chainIndex : -1;
  const cueIdx = !st?.playing && project.mode === 'chain' ? st?.chainIndex ?? 0 : -1;
  const focus = lessonFocus(ctx);
  const selected = sel >= 0 && sel < chain.length ? sel : -1;
  const bank = bankOf(ctx, selected >= 0 ? chain[selected] : project.active);

  const add = (id: string) => {
    if (chain.length >= max) return;
    const at = selected >= 0 ? selected + 1 : chain.length;
    editProject(ctx, tracks, p => chainAdd(p, id, at));
    setSel(at);
  };
  const move = (dir: -1 | 1) => {
    if (selected < 0) return;
    const to = selected + dir;
    if (to < 0 || to >= chain.length) return;
    editProject(ctx, tracks, p => chainMove(p, selected, to));
    setSel(to);
  };
  const remove = () => {
    if (selected < 0) return;
    editProject(ctx, tracks, p => chainRemove(p, selected));
    setSel(Math.min(selected, chain.length - 2));
  };
  const clear = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setConfirmClear(false), 2500);
      return;
    }
    setConfirmClear(false);
    setSel(-1);
    editProject(ctx, tracks, p => setChain(p, []));
  };

  return (
    <Overlay portal={props.portal} portalPlacement={props.portalPlacement} portalSize={props.portalSize ?? { w: 620, h: 440 }}>
      <Frame
        title="CHAIN"
        sub={`${chain.length} pattern${chain.length === 1 ? '' : 's'}${chainPlaying ? ` · playing ${playingIdx + 1}/${chain.length}` : ''}`}
        onClose={props.open === undefined ? () => closeMenu(ctx) : undefined}
        right={(
          <>
            <SeqButton
              active={project.mode === 'chain'}
              color={C.green}
              onPress={() => editProject(ctx, tracks, p => setPlayMode(p, p.mode === 'chain' ? 'pattern' : 'chain'))}
              highlight={!!focus?.has('seq:mode:chain')}
              title="PLAY plays the chain (changes at the end of the playing pattern)"
            >
              PLAY CHAIN
            </SeqButton>
            <SeqButton onPress={clear} active={confirmClear} color={C.red} disabled={!chain.length} title={confirmClear ? 'Tap again to clear the chain' : 'Clear the chain'}>
              {confirmClear ? 'SURE?' : 'CLEAR'}
            </SeqButton>
          </>
        )}
      >
        <div className={focus?.has('seq:chain') ? 'seq-target' : undefined} style={{ display: 'flex', flexWrap: 'wrap', gap: 4, minHeight: 34, padding: 4, borderRadius: 5, background: '#0b0c0d', border: `1px solid ${C.border}` }}>
          {chain.length === 0 && <span style={{ fontSize: 11, color: C.dim, alignSelf: 'center', padding: '0 4px' }}>Empty - tap patterns below to add them in playing order.</span>}
          {chain.map((id, i) => {
            const isPlaying = i === playingIdx;
            const isSel = i === selected;
            return (
              <button
                key={`${i}-${id}`}
                type="button"
                aria-label={`Chain entry ${i + 1}: ${id}${isPlaying ? ' playing' : ''}`}
                aria-pressed={isSel}
                onClick={e => { e.stopPropagation(); setSel(isSel ? -1 : i); }}
                onPointerDown={e => e.stopPropagation()}
                className={focus?.has(`seq:chain:${i}`) ? 'seq-target' : undefined}
                style={{
                  position: 'relative', minWidth: 48, height: 34, padding: '0 6px', borderRadius: 4, cursor: 'pointer',
                  border: `2px solid ${isSel ? C.white : i === cueIdx ? C.amber : C.border}`,
                  background: isPlaying ? C.green : C.key, color: isPlaying ? '#0d1a10' : C.text,
                  fontFamily: MONO, fontSize: 11, fontWeight: 700, touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent', userSelect: 'none',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1.05,
                }}
              >
                <span style={{ fontSize: 9, opacity: 0.7 }}>{i + 1}</span>
                <span>{id}</span>
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6, alignItems: 'center' }}>
          <Label style={{ marginRight: 2 }}>{selected >= 0 ? `ENTRY ${selected + 1}` : 'SELECT AN ENTRY'}</Label>
          <SeqButton onPress={() => move(-1)} disabled={selected <= 0} title="Move earlier" ariaLabel="Move earlier">◀</SeqButton>
          <SeqButton onPress={() => move(1)} disabled={selected < 0 || selected >= chain.length - 1} title="Move later" ariaLabel="Move later">▶</SeqButton>
          <SeqButton onPress={remove} disabled={selected < 0} title="Remove from the chain">REMOVE</SeqButton>
          <SeqButton
            onPress={() => { if (selected >= 0) ctx.sendEvent('seq:chain-index', { index: selected }); }}
            disabled={selected < 0}
            color={C.amber}
            title="Play the chain from here (next start, or the next pattern change while it plays)"
          >
            CUE
          </SeqButton>
        </div>
        <Group label={chain.length >= max ? `CHAIN FULL (${max})` : selected >= 0 ? `ADD AFTER ENTRY ${selected + 1}` : 'ADD TO THE END'} style={{ marginTop: 8 }}>
          <div style={{ width: '100%' }}>
            <PatternGrid ctx={ctx} project={project} bank={bank} banks={props.banks} onBank={b => ctx.setUi({ [UI.bank]: b })} onPattern={add} selected={selected >= 0 ? chain[selected] : null} />
          </div>
        </Group>
      </Frame>
    </Overlay>
  );
}
