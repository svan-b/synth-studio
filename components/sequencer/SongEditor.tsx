'use client';
// ============================================================================
// SongEditor - the song: rows of a pattern, or a chain of patterns, x repeats,
// played top to bottom (a row's chain plays through before the next row)
//
// Each row:  ▶ n      cue the song from this row (sets PLAY to SONG; while the
//                     song plays it jumps per the change mode)
//            PATTERN  the row's (first) pattern (hold / drag / wheel the value)
//            REPEAT   times the row plays (1..99), its whole chain each time
//            LENGTH   master steps each pattern plays per repeat, AUTO = the
//                     pattern's own (its length, or the master change in PER
//                     TRACK mode). Not on the hardware (`length={false}` hides it)
//            BPM      tempo while the row plays, AUTO = keep the tempo
//                     (internal clock only: synced to the studio, the studio
//                     transport keeps the tempo). Not on the hardware
//            TRSP     note transpose of the pattern (Analog Four, `transpose`)
//            MUTES    song mutes: tracks muted while this pattern plays here
//            ▲ ▼ ⟲ ✕ move the row, loop back here at the end, delete (a row
//                     with a chain loses one pattern at a time, as on the hardware)
//            + PTN    add a pattern to the row (a chain row; `chains`)
// Chain positions (rows with a chain): ▶ n.m cue from that pattern, PATTERN,
// TRSP and MUTES of that position, ▲ ▼ move it within the row, ✕ remove it.
// Header: LOOP (at the end jump back to the ⟲ row, else stop - the A4 / Rytm
// songs stop; `loop={false}` hides it), PLAY SONG, + ROW. The playing row and
// pattern are green, with the repeat count. Opens with ui.seqMenu = 'song'
// (MenuKey), or pass `open`. Lesson focus ids: 'seq:song', 'seq:song:row:<i>',
// 'seq:song:row:<i>:<pos>', 'seq:song:chain:<i>', 'seq:song:add',
// 'seq:song:loop', 'seq:mode:song'.
// ============================================================================

import type { CustomRenderContext } from '@/types/panel';
import {
  ALL_PATTERN_IDS, MASTER_MAX, TEMPO_MAX, TEMPO_MIN, getPattern, patternHasContent, rowEntry, rowSize, setPlayMode,
  setSongLoop, setSongName, songAddEntry, songAddRow, songMoveEntry, songMoveRow, songRemoveEntry, songRemoveRow,
  songToggleEntryMute, songUpdateEntry, songUpdateRow,
  type Pattern, type Project, type SongEntry, type SongRowPatch,
} from '@/lib/sequencer/elektron';
import {
  C, FONT, Frame, Label, MONO, Overlay, SeqButton, Stepper, closeMenu, editProject, lessonFocus, menuOpen, projectOf,
  seqStateOf, type OverlayProps,
} from './shared';

export interface SongEditorProps extends OverlayProps {
  ctx: CustomRenderContext;
  tracks?: number;
  /** Track labels for the mute keys (default T1, T2...) */
  trackNames?: string[];
  /** Show the per-row tempo (default true; not on the A4 / Rytm MKII) */
  tempo?: boolean;
  /** Show the per-pattern note transpose (Analog Four; default false) */
  transpose?: boolean;
  /** Show the song name field (default true) */
  names?: boolean;
  /** Most rows allowed (default 99) */
  maxRows?: number;
  /** Rows can hold a chain of patterns: + PTN and the chain positions (default true) */
  chains?: boolean;
  /** Show the LOOP setting and the loop-here keys (default true; the A4 / Rytm songs stop at their end) */
  loop?: boolean;
  /** Show the per-row LENGTH (default true; not on the A4 / Rytm MKII) */
  length?: boolean;
  /** Most pattern positions per row (default 16) */
  maxChain?: number;
}

/** Master steps of one repeat when the row's LENGTH is AUTO */
function autoLength(pat: Pattern): number {
  if (pat.scaleMode !== 'track') return pat.length;
  return pat.change || pat.master || pat.length;
}

const COL = { cue: 58, pattern: 118, repeat: 104, length: 112, bpm: 112, trsp: 104 };
/** The cued pattern position of a stopped song (where PLAY starts) */
const CUED = { outline: `2px solid ${C.amber}`, outlineOffset: -2 } as const;

export default function SongEditor(props: SongEditorProps) {
  const { ctx } = props;
  const tracks = props.tracks ?? 4;
  if (!menuOpen(ctx, 'song', props.open)) return null;

  const project = projectOf(ctx, tracks);
  const song = project.song;
  const rows = song.rows;
  const st = seqStateOf(ctx.engine);
  const songPlaying = !!st?.playing && st.mode === 'song';
  const focus = lessonFocus(ctx);
  const n = project.tracks;
  const names = props.trackNames ?? Array.from({ length: n }, (_, i) => `T${i + 1}`);
  const showTempo = props.tempo !== false;
  const showLength = props.length !== false;
  const showLoop = props.loop !== false;
  const chains = props.chains !== false;
  const maxRows = props.maxRows ?? 99;
  const maxChain = Math.max(1, props.maxChain ?? 16);
  const bpmNow = st?.bpm ?? 120;
  const edit = (fn: (p: Project) => Project) => editProject(ctx, tracks, fn);
  const patch = (i: number, pt: SongRowPatch) => edit(p => songUpdateRow(p, i, pt));
  const muteW = n * 30 + (n - 1) * 2;
  const cueRow = !st?.playing && project.mode === 'song' ? st?.songRow ?? 0 : -1;
  const cuePos = st?.songPos ?? 0;

  const cue = (i: number, pos: number) => {
    if (project.mode !== 'song') edit(p => setPlayMode(p, 'song'));
    ctx.sendEvent('seq:song-row', pos ? { row: i, pos } : { row: i });
  };

  const header = (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '0 2px 4px', borderBottom: `1px solid ${C.border}`, minWidth: 'max-content' }}>
      <Label style={{ width: COL.cue }}>ROW</Label>
      <Label style={{ width: COL.pattern, textAlign: 'center' }}>PATTERN</Label>
      <Label style={{ width: COL.repeat, textAlign: 'center' }}>REPEAT</Label>
      {showLength && <Label style={{ width: COL.length, textAlign: 'center' }}>LENGTH</Label>}
      {showTempo && <Label style={{ width: COL.bpm, textAlign: 'center' }}>BPM</Label>}
      {props.transpose && <Label style={{ width: COL.trsp, textAlign: 'center' }}>TRSP</Label>}
      <Label style={{ width: muteW, textAlign: 'center' }}>MUTES</Label>
    </div>
  );

  /** PATTERN, TRSP and MUTES of one pattern position (the same columns on the row line and its chain lines) */
  const entryCells = (i: number, pos: number, e: SongEntry, where: string) => {
    const pIdx = Math.max(0, ALL_PATTERN_IDS.indexOf(e.pattern));
    const pat = getPattern(project, e.pattern);
    return {
      pattern: (
        <div style={{ width: COL.pattern }}>
          <Stepper
            value={pIdx}
            min={0}
            max={ALL_PATTERN_IDS.length - 1}
            onChange={v => edit(p => songUpdateEntry(p, i, pos, { pattern: ALL_PATTERN_IDS[v] }))}
            format={v => ALL_PATTERN_IDS[v]}
            muted={!patternHasContent(project.patterns[e.pattern])}
            width={46}
            name={`${where} pattern`}
            dragPx={10}
            title={pat.name ? `${e.pattern} ${pat.name}` : e.pattern}
          />
        </div>
      ),
      transpose: props.transpose ? (
        <div style={{ width: COL.trsp }}>
          <Stepper
            value={e.transpose ?? 0}
            min={-48}
            max={48}
            onChange={v => edit(p => songUpdateEntry(p, i, pos, { transpose: v || null }))}
            format={v => (v > 0 ? `+${v}` : String(v))}
            muted={!e.transpose}
            width={38}
            name={`${where} transpose`}
            title="Semitones added to every note of this pattern here"
          />
        </div>
      ) : null,
      mutes: (
        <div style={{ display: 'flex', gap: 2, width: muteW }}>
          {names.slice(0, n).map((nm, t) => {
            const muted = !!e.mutes?.includes(t);
            return (
              <button
                key={t}
                type="button"
                aria-label={`${muted ? 'Unmute' : 'Mute'} ${nm} in ${where}`}
                aria-pressed={muted}
                onClick={ev => { ev.stopPropagation(); edit(p => songToggleEntryMute(p, i, pos, t)); }}
                onPointerDown={ev => ev.stopPropagation()}
                style={{
                  width: 30, height: 30, padding: 0, borderRadius: 3, cursor: 'pointer', touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent', WebkitTouchCallout: 'none', userSelect: 'none', WebkitUserSelect: 'none',
                  border: `1px solid ${muted ? C.border : '#2f5f3e'}`, background: muted ? '#26282b' : '#1f4a2c',
                  color: muted ? C.faint : '#bff5cf', fontFamily: FONT, fontSize: 9, fontWeight: 800, overflow: 'hidden', whiteSpace: 'nowrap',
                }}
              >
                {nm.slice(0, 3)}
              </button>
            );
          })}
        </div>
      ),
    };
  };

  const row = (i: number) => {
    const r = rows[i];
    const pat = getPattern(project, r.pattern);
    const size = rowSize(r);
    const isPlayingRow = songPlaying && st!.songRow === i;
    const playingPos = isPlayingRow ? st!.songPos ?? 0 : -1;
    const isCueRow = cueRow === i;
    const isLoop = song.loop && (song.loopRow ?? 0) === i;
    const own = entryCells(i, 0, r, size > 1 ? `row ${i + 1}, pattern 1` : `row ${i + 1}`);
    const lineStyle = (pos: number) => ({
      display: 'flex', gap: 6, alignItems: 'center', padding: '4px 2px', minWidth: 'max-content', borderRadius: 4,
      background: playingPos === pos ? '#12301c' : 'transparent',
    });
    const posTitle = size > 1 ? 'Master steps each pattern of the row plays per repeat' : 'Master steps per repeat';
    return (
      <div
        key={i}
        className={focus?.has(`seq:song:row:${i}`) ? 'seq-target' : undefined}
        style={{
          borderRadius: 4, background: i % 2 ? '#16171a' : 'transparent',
          borderLeft: `3px solid ${isPlayingRow ? C.green : isCueRow ? C.amber : 'transparent'}`,
        }}
      >
        <div className={focus?.has(`seq:song:row:${i}:0`) ? 'seq-target' : undefined} style={lineStyle(0)}>
          <SeqButton
            minWidth={COL.cue}
            active={playingPos === 0}
            color={C.green}
            onPress={() => cue(i, 0)}
            title={`Play the song from row ${i + 1}`}
            ariaLabel={`Play from row ${i + 1}`}
            style={isCueRow && cuePos === 0 && size > 1 ? CUED : undefined}
          >
            ▶ {i + 1}
          </SeqButton>
          {own.pattern}
          <div style={{ width: COL.repeat }}>
            <Stepper value={r.repeats} min={1} max={99} onChange={v => patch(i, { repeats: v })} format={v => `×${v}`} width={38} name={`row ${i + 1} repeats`} title={size > 1 ? 'Times the whole row (its chain) plays' : 'Times the row plays'} />
          </div>
          {showLength && (
            <div style={{ width: COL.length }}>
              <Stepper
                value={r.length ?? 0}
                min={0}
                max={MASTER_MAX}
                onChange={v => patch(i, { length: r.length === undefined ? autoLength(pat) : v || null })}
                format={v => (v ? String(v) : 'AUTO')}
                muted={r.length === undefined}
                width={46}
                name={`row ${i + 1} length`}
                title={`${posTitle} (AUTO = the pattern's own: ${autoLength(pat)})`}
              />
            </div>
          )}
          {showTempo && (
            <div style={{ width: COL.bpm }}>
              <Stepper
                value={r.tempo ?? 0}
                min={0}
                max={TEMPO_MAX}
                onChange={v => patch(i, { tempo: r.tempo === undefined ? Math.round(bpmNow) : v < TEMPO_MIN ? null : v })}
                format={v => (v ? String(Math.round(v)) : 'AUTO')}
                muted={r.tempo === undefined}
                width={46}
                name={`row ${i + 1} tempo`}
                title="Tempo while this row plays (AUTO = unchanged)"
              />
            </div>
          )}
          {own.transpose}
          {own.mutes}
          <div style={{ display: 'flex', gap: 3 }}>
            <SeqButton onPress={() => edit(p => songMoveRow(p, i, i - 1))} disabled={i === 0} ariaLabel={`Move row ${i + 1} up`} title="Move up">▲</SeqButton>
            <SeqButton onPress={() => edit(p => songMoveRow(p, i, i + 1))} disabled={i === rows.length - 1} ariaLabel={`Move row ${i + 1} down`} title="Move down">▼</SeqButton>
            {showLoop && <SeqButton active={isLoop} color={C.cyan} onPress={() => edit(p => setSongLoop(p, true, i))} ariaLabel={`Loop back to row ${i + 1}`} title="At the end of the song, loop back to this row">⟲</SeqButton>}
            {size > 1 ? (
              <SeqButton onPress={() => edit(p => songRemoveEntry(p, i, 0))} ariaLabel={`Remove pattern 1 of row ${i + 1}`} title="Remove this pattern: the next one in the row takes its place">✕</SeqButton>
            ) : (
              <SeqButton onPress={() => edit(p => songRemoveRow(p, i))} ariaLabel={`Delete row ${i + 1}`} title="Delete the row">✕</SeqButton>
            )}
            {chains && (
              <SeqButton
                onPress={() => edit(p => songAddEntry(p, i, rowEntry(p.song.rows[i], rowSize(p.song.rows[i]) - 1).pattern))}
                disabled={size >= maxChain}
                highlight={!!focus?.has(`seq:song:chain:${i}`)}
                ariaLabel={`Add a pattern to row ${i + 1}`}
                title="Add a pattern to this row: a chain, played through before the next row"
              >
                + PTN
              </SeqButton>
            )}
          </div>
          {isPlayingRow && r.repeats > 1 && (
            <span style={{ fontFamily: MONO, fontSize: 11, color: C.green, whiteSpace: 'nowrap' }}>{st!.songRepeat + 1}/{r.repeats}</span>
          )}
        </div>
        {(r.chain ?? []).map((e, k) => {
          const pos = k + 1;
          const where = `row ${i + 1}, pattern ${pos + 1}`;
          const cells = entryCells(i, pos, e, where);
          return (
            <div key={pos} className={focus?.has(`seq:song:row:${i}:${pos}`) ? 'seq-target' : undefined} style={lineStyle(pos)}>
              <SeqButton
                minWidth={COL.cue}
                active={playingPos === pos}
                color={C.green}
                onPress={() => cue(i, pos)}
                title={`Play the song from row ${i + 1}, pattern ${pos + 1}`}
                ariaLabel={`Play from ${where}`}
                style={{ fontSize: 10, ...(isCueRow && cuePos === pos ? CUED : {}) }}
              >
                ▶ {i + 1}.{pos + 1}
              </SeqButton>
              {cells.pattern}
              <div style={{ width: COL.repeat, textAlign: 'center', fontSize: 10, color: C.faint }}>›</div>
              {showLength && <div style={{ width: COL.length }} />}
              {showTempo && <div style={{ width: COL.bpm }} />}
              {cells.transpose}
              {cells.mutes}
              <div style={{ display: 'flex', gap: 3 }}>
                <SeqButton onPress={() => edit(p => songMoveEntry(p, i, pos, pos - 1))} ariaLabel={`Move ${where} earlier`} title="Play it earlier in the row">▲</SeqButton>
                <SeqButton onPress={() => edit(p => songMoveEntry(p, i, pos, pos + 1))} disabled={pos >= size - 1} ariaLabel={`Move ${where} later`} title="Play it later in the row">▼</SeqButton>
                <SeqButton onPress={() => edit(p => songRemoveEntry(p, i, pos))} ariaLabel={`Remove ${where}`} title="Remove this pattern from the row">✕</SeqButton>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const playingRow = songPlaying ? rows[st!.songRow] : undefined;
  const sub = `${rows.length} row${rows.length === 1 ? '' : 's'}${songPlaying ? ` · row ${st!.songRow + 1}${playingRow && rowSize(playingRow) > 1 ? `, pattern ${(st!.songPos ?? 0) + 1}/${rowSize(playingRow)}` : ''}` : ''}`;

  return (
    <Overlay portal={props.portal} portalPlacement={props.portalPlacement} portalSize={props.portalSize ?? { w: 1120, h: 520 }}>
      <Frame
        title="SONG"
        sub={sub}
        onClose={props.open === undefined ? () => closeMenu(ctx) : undefined}
        right={(
          <>
            {props.names !== false && (
              <input
                value={song.name}
                maxLength={16}
                placeholder="SONG NAME"
                aria-label="Song name"
                onChange={e => { const v = e.target.value.toUpperCase(); edit(p => setSongName(p, v)); }}
                onPointerDown={e => e.stopPropagation()}
                onKeyDown={e => e.stopPropagation()}
                style={{
                  width: 130, height: 30, boxSizing: 'border-box', borderRadius: 4, border: `1px solid ${C.border}`, background: '#0b0c0d',
                  color: C.text, fontFamily: MONO, fontSize: 16, padding: '0 6px',
                }}
              />
            )}
            {showLoop && (
              <SeqButton active={song.loop} color={C.cyan} onPress={() => edit(p => setSongLoop(p, !p.song.loop))} highlight={!!focus?.has('seq:song:loop')} title={song.loop ? `Loops back to row ${(song.loopRow ?? 0) + 1}` : 'Stops at the end'}>
                {song.loop ? 'LOOP ⟲' : 'END ■'}
              </SeqButton>
            )}
            <SeqButton active={project.mode === 'song'} color={C.green} onPress={() => edit(p => setPlayMode(p, p.mode === 'song' ? 'pattern' : 'song'))} highlight={!!focus?.has('seq:mode:song')} title="PLAY plays the song">
              PLAY SONG
            </SeqButton>
            <SeqButton
              onPress={() => edit(p => songAddRow(p, { pattern: p.song.rows[p.song.rows.length - 1]?.pattern ?? p.active }))}
              disabled={rows.length >= maxRows}
              highlight={!!focus?.has('seq:song:add')}
              title="Add a row at the end"
            >
              + ROW
            </SeqButton>
          </>
        )}
      >
        <div className={focus?.has('seq:song') ? 'seq-target' : undefined} style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 'max-content' }}>
          {header}
          {rows.length === 0 && (
            <span style={{ fontSize: 11, color: C.dim, padding: 8 }}>
              No rows yet - press + ROW, then pick each row&apos;s pattern and how many times it repeats{chains ? '; + PTN chains more patterns into a row' : ''}.
            </span>
          )}
          {rows.map((_, i) => row(i))}
        </div>
      </Frame>
    </Overlay>
  );
}
