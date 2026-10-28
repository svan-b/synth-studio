'use client';
// ============================================================================
// PagePicker - the step page LEDs / keys (1:4 ... 4:4)
//
// Patterns run up to 64 steps; the 16 trig keys show one page at a time.
//   tap a page        edit that page (ui.stepPage, which TrigKeys follows)
//   LEDs              white = the page the trig keys show, green dot = the page
//                     playing, dark = beyond the track's length
// Lesson steps light keys with focus ids 'seq:page:<n>' (1-based) or 'seq:pages'.
// ============================================================================

import type { CustomRenderContext } from '@/types/panel';
import { MAX_PAGES, PAGE_SIZE, getPattern, trackLength, type PatternId } from '@/lib/sequencer/elektron';
import { C, FONT, SeqStyles, UI, lessonFocus, pageOf, projectOf, seqStateOf, trackOf, viewPattern } from './shared';

export interface PagePickerProps {
  ctx: CustomRenderContext;
  /** Track whose length decides the pages (default: the `track` control) */
  track?: number;
  /** Pattern (default: the one the trig keys show) */
  pattern?: PatternId;
  tracks?: number;
  /** Stack the keys vertically */
  vertical?: boolean;
  /** Show the step count (e.g. "32") after the keys */
  showLength?: boolean;
}

export default function PagePicker(props: PagePickerProps) {
  const { ctx, vertical, showLength = true } = props;
  const tracks = props.tracks ?? 4;
  const project = projectOf(ctx, tracks);
  const track = trackOf(ctx, project, props.track);
  const pattern = viewPattern(ctx, project, props.pattern);
  const len = trackLength(getPattern(project, pattern), track);
  const pages = Math.max(1, Math.ceil(len / PAGE_SIZE));
  const page = pageOf(ctx, project, pattern, track);
  const st = seqStateOf(ctx.engine);
  const playStep = st?.playing && st.pattern === pattern ? st.steps[track] ?? -1 : -1;
  const playPage = playStep >= 0 ? Math.floor(playStep / PAGE_SIZE) : -1;
  const focus = lessonFocus(ctx);

  return (
    <div
      onPointerDown={e => e.stopPropagation()}
      style={{ width: '100%', height: '100%', display: 'flex', flexDirection: vertical ? 'column' : 'row', gap: 4, alignItems: 'stretch', fontFamily: FONT }}
    >
      <SeqStyles />
      {Array.from({ length: MAX_PAGES }, (_, i) => {
        const inLen = i < pages;
        const shown = i === page;
        const target = !!focus && (focus.has(`seq:page:${i + 1}`) || focus.has('seq:pages'));
        return (
          <button
            key={i}
            type="button"
            disabled={!inLen}
            aria-label={`Step page ${i + 1}${shown ? ' (shown)' : ''}${i === playPage ? ' (playing)' : ''}`}
            aria-pressed={shown}
            onClick={e => { e.stopPropagation(); if (inLen) ctx.setUi({ [UI.stepPage]: i }); }}
            className={target ? 'seq-target' : undefined}
            style={{
              position: 'relative', flex: 1, minWidth: 28, minHeight: 28, borderRadius: 4, padding: 0,
              border: `1px solid ${shown ? C.white : C.border}`,
              background: shown ? C.white : inLen ? C.key : '#17181a',
              color: shown ? '#111' : inLen ? C.text : C.faint,
              fontSize: 10, fontWeight: 800, letterSpacing: 0.5, cursor: inLen ? 'pointer' : 'default',
              touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent', userSelect: 'none',
              boxShadow: shown ? `0 0 6px ${C.white}88` : 'inset 0 -2px 0 rgba(0,0,0,0.35)',
            }}
          >
            {i + 1}
            {i === playPage && (
              <span style={{ position: 'absolute', right: 3, top: 3, width: 6, height: 6, borderRadius: 3, background: C.green, boxShadow: `0 0 4px ${C.green}` }} />
            )}
          </button>
        );
      })}
      {showLength && (
        <span style={{ alignSelf: 'center', minWidth: 30, textAlign: 'center', fontSize: 10, fontWeight: 700, color: C.dim }} title="Steps in this track">
          {len}
        </span>
      )}
    </div>
  );
}
