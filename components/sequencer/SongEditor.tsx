'use client';
// ============================================================================
// SongEditor - the song: rows of pattern x repeats, played top to bottom
//
// Each row:  ▶ n      cue the song from this row (sets PLAY to SONG; while the
//                     song plays it jumps per the change mode)
//            PATTERN  which pattern (hold / drag / wheel the value)
//            REPEAT   times the row plays (1..99)
//            LENGTH   master steps per repeat, AUTO = the pattern's own
//                     (its length, or the master change in PER TRACK mode)
//            BPM      tempo while the row plays, AUTO = keep the tempo
//                     (internal clock only: synced to the studio, the studio
//                     transport keeps the tempo)
//            TRSP     note transpose for the row (Analog Four, `transpose`)
//            MUTES    tracks muted while the row plays
//            ▲ ▼ ⟲ ✕ move, loop back here at the end, delete
// Header: LOOP (at the end jump back to the ⟲ row, else stop), PLAY SONG, + ROW.
// The playing row is green with its repeat count. Opens with ui.seqMenu =
// 'song' (MenuKey), or pass `open`. Lesson focus ids: 'seq:song',
// 'seq:song:row:<index>', 'seq:song:add', 'seq:song:loop', 'seq:mode:song'.
// ============================================================================

import type { CustomRenderContext } from '@/types/panel';
import {
  ALL_PATTERN_IDS, MASTER_MAX, TEMPO_MAX, TEMPO_MIN, getPattern, patternHasContent, setPlayMode, setSongLoop, setSongName,
  songAddRow, songMoveRow, songRemoveRow, songToggleMute, songUpdateRow,
  type Pattern, type Project, type SongRowPatch,
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
  /** Show the per-row tempo (default true) */
  tempo?: boolean;
  /** Show the per-row note transpose (Analog Four; default false) */
  transpose?: boolean;
  /** Show the song name field (default true) */
  names?: boolean;
  /** Most rows allowed (default 99) */
  maxRows?: number;
}

/** Master steps of one repeat when the row's LENGTH is AUTO */
function autoLength(pat: Pattern): number {
  if (pat.scaleMode !== 'track') return pat.length;
  return pat.change || pat.master || pat.length;
}

const COL = { cue: 46, pattern: 118, repeat: 104, length: 112, bpm: 112, trsp: 104 };

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
  const maxRows = props.maxRows ?? 99;
  const bpmNow = st?.bpm ?? 120;
  const edit = (fn: (p: Project) => Project) => editProject(ctx, tracks, fn);
  const patch = (i: number, pt: SongRowPatch) => edit(p => songUpdateRow(p, i, pt));
  const muteW = n * 30 + (n - 1) * 2;

  const header = (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '0 2px 4px', borderBottom: `1px solid ${C.border}`, minWidth: 'max-content' }}>
      <Label style={{ width: COL.cue }}>ROW</Label>
      <Label style={{ width: COL.pattern, textAlign: 'center' }}>PATTERN</Label>
      <Label style={{ width: COL.repeat, textAlign: 'center' }}>REPEAT</Label>
      <Label style={{ width: COL.length, textAlign: 'center' }}>LENGTH</Label>
      {showTempo && <Label style={{ width: COL.bpm, textAlign: 'center' }}>BPM</Label>}
      {props.transpose && <Label style={{ width: COL.trsp, textAlign: 'center' }}>TRSP</Label>}
      <Label style={{ width: muteW, textAlign: 'center' }}>MUTES</Label>
    </div>
  );

  const row = (i: number) => {
    const r = rows[i];
    const pat = getPattern(project, r.pattern);
    const isPlaying = songPlaying && st!.songRow === i;
    const isCue = !st?.playing && project.mode === 'song' && (st?.songRow ?? 0) === i;
    const isLoop = song.loop && (song.loopRow ?? 0) === i;
    const pIdx = Math.max(0, ALL_PATTERN_IDS.indexOf(r.pattern));
    return (
      <div
        key={i}
        className={focus?.has(`seq:song:row:${i}`) ? 'seq-target' : undefined}
        style={{
          display: 'flex', gap: 6, alignItems: 'center', padding: '4px 2px', minWidth: 'max-content', borderRadius: 4,
          background: isPlaying ? '#12301c' : i % 2 ? '#16171a' : 'transparent', borderLeft: `3px solid ${isPlaying ? C.green : isCue ? C.amber : 'transparent'}`,
        }}
      >
        <SeqButton
          minWidth={COL.cue}
          active={isPlaying}
          color={C.green}
          onPress={() => {
            if (project.mode !== 'song') edit(p => setPlayMode(p, 'song'));
            ctx.sendEvent('seq:song-row', { row: i });
          }}
          title={`Play the song from row ${i + 1}`}
          ariaLabel={`Play from row ${i + 1}`}
        >
          ▶ {i + 1}
        </SeqButton>
        <div style={{ width: COL.pattern }}>
          <Stepper
            value={pIdx}
            min={0}
            max={ALL_PATTERN_IDS.length - 1}
            onChange={v => patch(i, { pattern: ALL_PATTERN_IDS[v] })}
            format={v => ALL_PATTERN_IDS[v]}
            muted={!patternHasContent(project.patterns[r.pattern])}
            width={46}
            dragPx={10}
            title={pat.name ? `${r.pattern} ${pat.name}` : r.pattern}
          />
        </div>
        <div style={{ width: COL.repeat }}>
          <Stepper value={r.repeats} min={1} max={99} onChange={v => patch(i, { repeats: v })} format={v => `×${v}`} width={38} />
        </div>
        <div style={{ width: COL.length }}>
          <Stepper
            value={r.length ?? 0}
            min={0}
            max={MASTER_MAX}
            onChange={v => patch(i, { length: r.length === undefined ? autoLength(pat) : v || null })}
            format={v => (v ? String(v) : 'AUTO')}
            muted={r.length === undefined}
            width={46}
            title={`Master steps per repeat (AUTO = ${autoLength(pat)})`}
          />
        </div>
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
              title="Tempo while this row plays (AUTO = unchanged)"
            />
          </div>
        )}
        {props.transpose && (
          <div style={{ width: COL.trsp }}>
            <Stepper
              value={r.transpose ?? 0}
              min={-48}
              max={48}
              onChange={v => patch(i, { transpose: v || null })}
              format={v => (v > 0 ? `+${v}` : String(v))}
              muted={!r.transpose}
              width={38}
              title="Semitones added to every note of this row"
            />
          </div>
        )}
        <div style={{ display: 'flex', gap: 2, width: muteW }}>
          {names.slice(0, n).map((nm, t) => {
            const muted = !!r.mutes?.includes(t);
            return (
              <button
                key={t}
                type="button"
                aria-label={`${muted ? 'Unmute' : 'Mute'} ${nm} in row ${i + 1}`}
                aria-pressed={muted}
                onClick={e => { e.stopPropagation(); edit(p => songToggleMute(p, i, t)); }}
                onPointerDown={e => e.stopPropagation()}
                style={{
                  width: 30, height: 30, padding: 0, borderRadius: 3, cursor: 'pointer', touchAction: 'manipulation', userSelect: 'none',
                  border: `1px solid ${muted ? C.border : '#2f5f3e'}`, background: muted ? '#26282b' : '#1f4a2c',
                  color: muted ? C.faint : '#bff5cf', fontFamily: FONT, fontSize: 9, fontWeight: 800, overflow: 'hidden', whiteSpace: 'nowrap',
                }}
              >
                {nm.slice(0, 3)}
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 3 }}>
          <SeqButton onPress={() => edit(p => songMoveRow(p, i, i - 1))} disabled={i === 0} ariaLabel={`Move row ${i + 1} up`} title="Move up">▲</SeqButton>
          <SeqButton onPress={() => edit(p => songMoveRow(p, i, i + 1))} disabled={i === rows.length - 1} ariaLabel={`Move row ${i + 1} down`} title="Move down">▼</SeqButton>
          <SeqButton active={isLoop} color={C.cyan} onPress={() => edit(p => setSongLoop(p, true, i))} ariaLabel={`Loop back to row ${i + 1}`} title="At the end of the song, loop back to this row">⟲</SeqButton>
          <SeqButton onPress={() => edit(p => songRemoveRow(p, i))} ariaLabel={`Delete row ${i + 1}`} title="Delete the row">✕</SeqButton>
        </div>
        {isPlaying && r.repeats > 1 && (
          <span style={{ fontFamily: MONO, fontSize: 11, color: C.green, whiteSpace: 'nowrap' }}>{st!.songRepeat + 1}/{r.repeats}</span>
        )}
      </div>
    );
  };

  return (
    <Overlay portal={props.portal} portalSize={props.portalSize ?? { w: 1120, h: 520 }}>
      <Frame
        title="SONG"
        sub={`${rows.length} row${rows.length === 1 ? '' : 's'}${songPlaying ? ` · row ${st!.songRow + 1}` : ''}`}
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
            <SeqButton active={song.loop} color={C.cyan} onPress={() => edit(p => setSongLoop(p, !p.song.loop))} highlight={!!focus?.has('seq:song:loop')} title={song.loop ? `Loops back to row ${(song.loopRow ?? 0) + 1}` : 'Stops at the end'}>
              {song.loop ? 'LOOP ⟲' : 'END ■'}
            </SeqButton>
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
            <span style={{ fontSize: 11, color: C.dim, padding: 8 }}>No rows yet - press + ROW, then pick each row&apos;s pattern and how many times it repeats.</span>
          )}
          {rows.map((_, i) => row(i))}
        </div>
      </Frame>
    </Overlay>
  );
}
