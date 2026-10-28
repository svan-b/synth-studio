'use client';
// ============================================================================
// ScaleMenu - the pattern's SCALE setup ([FUNC] + [PAGE] on the hardware)
//
//   MODE     PER PATTERN: every track shares LENGTH and SCALE
//            PER TRACK: each track has its own LENGTH and SCALE; the MASTER
//            LENGTH restarts every track together (INF = never) and the MASTER
//            CHANGE sets when a cued or chained pattern takes over (OFF = at the
//            master length; INF + OFF = never)
//   LENGTH   1..64 steps         SCALE  2x 3/2x 1x 3/4x 1/2x 1/4x 1/8x
//   SWING    50..80 % (every second step is late)
// Edits the pattern the trig keys show, and in PER TRACK mode the selected
// track. Opens with ui.seqMenu = 'scale' (MenuKey), or pass `open`.
// Lesson focus ids: 'seq:scale:mode', 'seq:scale:length', 'seq:scale:speed',
// 'seq:scale:swing', 'seq:scale:master', 'seq:scale:change'.
// ============================================================================

import type { CustomRenderContext } from '@/types/panel';
import {
  MASTER_MAX, MAX_STEPS, SPEEDS, SWING_MAX, SWING_MIN, formatChange, formatMaster, formatSpeed, getPattern, setTrackScale,
  trackLength, trackSpeed, updatePatternSettings, type PatternId, type Speed,
} from '@/lib/sequencer/elektron';
import {
  C, Frame, Group, Overlay, SeqButton, Stepper, closeMenu, editProject, lessonFocus, menuOpen, projectOf, trackOf, viewPattern,
  type OverlayProps,
} from './shared';

export interface ScaleMenuProps extends OverlayProps {
  ctx: CustomRenderContext;
  tracks?: number;
  /** Track edited in PER TRACK mode (default: the `track` control) */
  track?: number;
  /** Pattern edited (default: the one the trig keys show) */
  pattern?: PatternId;
  trackNames?: string[];
}

export default function ScaleMenu(props: ScaleMenuProps) {
  const { ctx } = props;
  const tracks = props.tracks ?? 4;
  if (!menuOpen(ctx, 'scale', props.open)) return null;

  const project = projectOf(ctx, tracks);
  const pattern = viewPattern(ctx, project, props.pattern);
  const pat = getPattern(project, pattern);
  const track = trackOf(ctx, project, props.track);
  const perTrack = pat.scaleMode === 'track';
  const focus = lessonFocus(ctx);
  const hi = (k: string) => !!focus?.has(`seq:scale:${k}`);
  const trackName = props.trackNames?.[track] ?? `T${track + 1}`;
  const t = pat.tracks[track];
  const ownLen = perTrack && t?.length !== undefined;
  const ownSpeed = perTrack && t?.speed !== undefined;
  const set = (patch: Parameters<typeof updatePatternSettings>[2]) => editProject(ctx, tracks, p => updatePatternSettings(p, pattern, patch));
  const setTrack = (patch: { length?: number | null; speed?: Speed | null }) => editProject(ctx, tracks, p => setTrackScale(p, pattern, track, patch));

  const speeds = (value: Speed, onPick: (s: Speed) => void, key: string) => (
    <Group label={key === 'track' ? `${trackName} SCALE` : perTrack ? 'MASTER SCALE' : 'SCALE'} highlight={hi('speed')}>
      {SPEEDS.map(s => (
        <SeqButton key={s} active={value === s} color={C.white} minWidth={40} onPress={() => onPick(s)} title={`${s} speed`}>
          {formatSpeed(s)}
        </SeqButton>
      ))}
    </Group>
  );

  return (
    <Overlay portal={props.portal} portalSize={props.portalSize ?? { w: 640, h: 380 }}>
      <Frame
        title="SCALE"
        sub={pattern}
        onClose={props.open === undefined ? () => closeMenu(ctx) : undefined}
        right={(
          <Group label={undefined} highlight={hi('mode')} style={{ padding: 0, border: 'none', background: 'transparent' }}>
            <SeqButton active={!perTrack} color={C.cyan} onPress={() => set({ scaleMode: 'pattern' })} title="Every track shares the length and scale">PER PATTERN</SeqButton>
            <SeqButton active={perTrack} color={C.cyan} onPress={() => set({ scaleMode: 'track' })} title="Each track has its own length and scale">PER TRACK</SeqButton>
          </Group>
        )}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {perTrack ? (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <Group label={`${trackName} LENGTH`} highlight={hi('length')}>
                  <Stepper
                    value={trackLength(pat, track)}
                    min={1}
                    max={MAX_STEPS}
                    onChange={v => setTrack({ length: v })}
                    muted={!ownLen}
                    width={46}
                    title="Steps before this track loops"
                  />
                </Group>
                <Group label="DEFAULT LENGTH">
                  <Stepper value={pat.length} min={1} max={MAX_STEPS} onChange={v => set({ length: v })} width={46} title="Length of tracks without their own" />
                </Group>
                <Group label="MASTER LENGTH" highlight={hi('master')}>
                  <Stepper value={pat.master} min={0} max={MASTER_MAX} onChange={v => set({ master: v })} format={formatMaster} width={50} title="All tracks restart after this many master steps (INF = never)" />
                </Group>
                <Group label="MASTER CHANGE" highlight={hi('change')}>
                  <Stepper value={pat.change} min={0} max={MASTER_MAX} onChange={v => set({ change: v })} format={formatChange} width={50} title="Steps before a cued or chained pattern starts (OFF = at the master length)" />
                </Group>
              </div>
              {speeds(trackSpeed(pat, track), s => setTrack({ speed: s }), 'track')}
              {(ownLen || ownSpeed) && (
                <div>
                  <SeqButton onPress={() => setTrack({ length: null, speed: null })} title={`${trackName} follows the default length and the master scale`}>
                    {trackName}: FOLLOW PATTERN
                  </SeqButton>
                </div>
              )}
              {speeds(pat.speed, s => set({ speed: s }), 'master')}
              {pat.master === 0 && pat.change === 0 && (
                <span style={{ fontSize: 10, color: C.amber }}>MASTER LENGTH INF with CHANGE OFF: the pattern plays forever - cued patterns and chains wait (DIRECT changes still work).</span>
              )}
            </>
          ) : (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <Group label="LENGTH" highlight={hi('length')}>
                  <Stepper value={pat.length} min={1} max={MAX_STEPS} onChange={v => set({ length: v })} width={46} title="Steps in the pattern (1-64)" />
                  {[16, 32, 48, 64].map(l => (
                    <SeqButton key={l} active={pat.length === l} color={C.white} minWidth={34} onPress={() => set({ length: l })}>{l}</SeqButton>
                  ))}
                </Group>
              </div>
              {speeds(pat.speed, s => set({ speed: s }), 'pattern')}
            </>
          )}
          <Group label="SWING" highlight={hi('swing')}>
            <Stepper value={pat.swing} min={SWING_MIN} max={SWING_MAX} onChange={v => set({ swing: v })} format={v => `${v}%`} width={50} title="50% = straight; every second step is late" />
            {[50, 54, 58, 62, 66].map(v => (
              <SeqButton key={v} active={pat.swing === v} color={C.white} minWidth={38} onPress={() => set({ swing: v })}>{v}%</SeqButton>
            ))}
          </Group>
        </div>
      </Frame>
    </Overlay>
  );
}
