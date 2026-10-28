'use client';
// ============================================================================
// TrigEditor - per-trig settings overlay (opened by a long hold / double tap on
// a TrigKey; ui.trigEditor = { track, pattern, steps }).
//
//   NOTE · VEL · LEN · micro timing · trig condition · retrig (rate, length,
//   velocity curve) · slide / param slide / accent · note or lock trig ·
//   the trig's parameter locks with a clear button each.
//
// Edits apply to every selected step. While it is open the steps stay held
// (ui.heldSteps), so turning an encoder on the panel locks it on them too.
// Renders inside its custom element's box; `portal` floats it over the page
// at full size instead (good on a scaled-down panel).
// ============================================================================

import type { ReactNode } from 'react';
import type { CustomRenderContext } from '@/types/panel';
import {
  LEN_INF, PROBABILITIES, RETRIG_DEFAULT, RETRIG_RATES, RETRIG_VEL_MAX, RETRIG_VEL_MIN,
  abCode, abOf, clearLocks, compileCondition, conditionString, describeCondition, formatLength, formatMicro,
  formatNote, formatRetrigRate, formatSigned, getPattern, isAB, isProbability, probabilityOf, setLock, setStep,
  updateSteps, type Step, type StepPatch,
} from '@/lib/sequencer/elektron';
import {
  C, FONT, MONO, Overlay, OverlayRoot, SeqButton, SeqStyles, Stepper, UI, clampN, editProject, lessonFocus, projectOf,
  type TrigEditorTarget,
} from './shared';

export interface TrigEditorProps {
  ctx: CustomRenderContext;
  tracks?: number;
  /** Which hardware features to show (Analog Four: slide, pslide, accent; Analog Rytm: retrig, accent) */
  features?: { slide?: boolean; pslide?: boolean; accent?: boolean; retrig?: boolean };
  /** Readable name of a lock key */
  lockLabel?: (key: string) => string;
  /** Readable value of a lock */
  lockFormat?: (key: string, value: number) => string;
  /** Note readout (default C4-style names; the Rytm may prefer a +/- tune offset) */
  noteFormat?: (note: number) => string;
  noteRange?: [number, number];
  /** Float over the page (document.body) instead of filling the custom element */
  portal?: boolean;
  /** Portal size in px (default 620 x 460) */
  portalSize?: { w: number; h: number };
  /** Portal at the 'top' (default) or 'bottom' of the viewport */
  portalPlacement?: 'top' | 'bottom';
  /** Track names for the title */
  trackNames?: string[];
}

const LOGIC = ['FILL', '!FILL', 'PRE', '!PRE', 'NEI', '!NEI', '1ST', '!1ST'];

function Cell({ children, label, highlight }: { children: ReactNode; label?: string; highlight?: boolean }) {
  return (
    <div className={highlight ? 'seq-target' : undefined} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 6, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 5 }}>
      {label && <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1, color: C.dim }}>{label}</span>}
      {children}
    </div>
  );
}

export default function TrigEditor(props: TrigEditorProps) {
  const { ctx } = props;
  const tracks = props.tracks ?? 4;
  const target = ctx.ui[UI.trigEditor] as TrigEditorTarget | null | undefined;
  if (!target || !Array.isArray(target.steps) || !target.steps.length) return null;

  const project = projectOf(ctx, tracks);
  const { track, pattern } = target;
  const steps = target.steps;
  const trk = getPattern(project, pattern).tracks[track];
  const first = trk?.steps[steps[0]] as Step | undefined;
  const any = steps.some(s => trk?.steps[s]);
  const focus = lessonFocus(ctx);
  const hi = (k: string) => !!focus?.has(`seq:edit:${k}`);
  const f = { slide: true, pslide: false, accent: true, retrig: true, ...props.features };
  const fmtNote = props.noteFormat ?? formatNote;
  const [nLo, nHi] = props.noteRange ?? [0, 127];

  const patch = (p: StepPatch) => editProject(ctx, tracks, pr => updateSteps(pr, pattern, track, steps, p, { create: 'note' }));
  const close = () => ctx.setUi({ [UI.trigEditor]: null, [UI.heldSteps]: [], [UI.heldEdited]: false });

  const note = first?.note ?? trk?.note ?? 60;
  const vel = first?.vel ?? trk?.vel ?? 100;
  const len = first?.len ?? trk?.len ?? 14;
  const micro = first?.micro ?? 0;
  const code = compileCondition(first?.cond);
  const retrig = first?.retrig;
  const locks = first?.locks ?? {};
  const lockKeys = Object.keys(locks);
  const title = steps.length === 1 ? `TRIG ${steps[0] + 1}` : `TRIGS ${steps[0] + 1}–${steps[steps.length - 1] + 1}`;
  const trackName = props.trackNames?.[track] ?? `T${track + 1}`;

  const setCond = (c: string | null) => patch({ cond: c });
  const condCat = code === 0 ? 'NONE' : isProbability(code) ? '%' : isAB(code) ? 'A:B' : conditionString(code);
  const [ca, cb] = isAB(code) ? abOf(code) : [1, 2];
  const pctIndex = isProbability(code) ? Math.max(0, PROBABILITIES.findIndex(p => p >= probabilityOf(code))) : 10;

  const body = (
    <OverlayRoot
      style={{
        boxSizing: 'border-box', display: 'flex', flexDirection: 'column', background: 'rgba(14,15,17,0.97)',
        color: C.text, fontFamily: FONT, border: `1px solid ${C.amber}`, borderRadius: 6, boxShadow: '0 10px 30px rgba(0,0,0,0.6)', overflow: 'hidden',
      }}
    >
      <SeqStyles />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', background: C.panel2, borderBottom: `1px solid ${C.border}`, flexWrap: 'wrap', minHeight: 40 }}>
        <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: 1 }}>{title}</span>
        <span style={{ fontSize: 11, color: C.dim, fontFamily: MONO }}>{trackName} · {pattern}</span>
        <div style={{ flex: 1 }} />
        {any ? (
          <>
            <SeqButton active={!first?.trigless} color={C.red} onPress={() => patch({ trigless: null })} title="Note trig: plays a note">NOTE</SeqButton>
            <SeqButton active={!!first?.trigless} color={C.amber} onPress={() => patch({ trigless: true })} title="Lock trig: applies its locks without a note">LOCK</SeqButton>
            <SeqButton onPress={() => { editProject(ctx, tracks, pr => steps.reduce((acc, s) => setStep(acc, pattern, track, s, null), pr)); }} title="Remove the trig(s) and their locks">CLEAR</SeqButton>
          </>
        ) : (
          <>
            <SeqButton onPress={() => patch({})} title="Place a note trig">+ NOTE TRIG</SeqButton>
            <SeqButton onPress={() => editProject(ctx, tracks, pr => updateSteps(pr, pattern, track, steps, { trigless: true }, { create: 'lock' }))} title="Place a lock trig">+ LOCK TRIG</SeqButton>
          </>
        )}
        <SeqButton active color={C.green} onPress={close}>DONE</SeqButton>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 8, touchAction: 'pan-y' }}>
        {!any && <div style={{ fontSize: 11, color: C.dim, marginBottom: 6 }}>Empty step - editing a value places a note trig. Turning an encoder places a lock trig.</div>}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <Cell label="NOTE" highlight={hi('note')}>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <SeqButton minWidth={36} onPress={() => patch({ note: clampN(note - 12, nLo, nHi) })} title="Octave down">−12</SeqButton>
              <Stepper value={note} min={nLo} max={nHi} onChange={v => patch({ note: v })} format={fmtNote} muted={first?.note === undefined} width={58} name="note" />
              <SeqButton minWidth={36} onPress={() => patch({ note: clampN(note + 12, nLo, nHi) })} title="Octave up">+12</SeqButton>
            </div>
          </Cell>
          <Cell label="VEL" highlight={hi('vel')}>
            <Stepper value={vel} min={1} max={127} onChange={v => patch({ vel: v })} muted={first?.vel === undefined} width={46} name="velocity" />
          </Cell>
          <Cell label="LEN" highlight={hi('len')}>
            <Stepper value={len} min={0} max={LEN_INF} onChange={v => patch({ len: v })} format={formatLength} muted={first?.len === undefined} width={58} dragPx={5} name="length" />
          </Cell>
          <Cell label="MICRO TIMING" highlight={hi('micro')}>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <Stepper value={micro} min={-23} max={23} onChange={v => patch({ micro: v })} format={formatMicro} width={70} dragPx={5} name="micro timing" />
              <SeqButton minWidth={30} onPress={() => patch({ micro: null })} dim={!micro} title="Back on the grid">0</SeqButton>
            </div>
          </Cell>
          {(f.slide || f.pslide || f.accent) && (
            <Cell label="TRIG">
              <div style={{ display: 'flex', gap: 4 }}>
                {f.slide && <SeqButton active={!!first?.slide} color={C.yellow} onPress={() => patch({ slide: first?.slide ? null : true })} highlight={hi('slide')} title="Note slide from the previous note">SLIDE</SeqButton>}
                {f.pslide && <SeqButton active={!!first?.pslide} color={C.cyan} onPress={() => patch({ pslide: first?.pslide ? null : true })} title="Parameter slide from the previous trig">P.SLIDE</SeqButton>}
                {f.accent && <SeqButton active={!!first?.accent} color={C.pink} onPress={() => patch({ accent: first?.accent ? null : true })} highlight={hi('accent')} title="Accent">ACCENT</SeqButton>}
              </div>
            </Cell>
          )}
        </div>

        <div style={{ marginTop: 6 }}>
          <Cell label={`CONDITION · ${conditionString(code) || 'NONE'}`} highlight={hi('cond')}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              <SeqButton active={condCat === 'NONE'} color={C.cyan} onPress={() => setCond(null)}>NONE</SeqButton>
              <SeqButton active={condCat === '%'} color={C.cyan} onPress={() => setCond(`${PROBABILITIES[pctIndex]}%`)}>%</SeqButton>
              <SeqButton active={condCat === 'A:B'} color={C.cyan} onPress={() => setCond(`${ca}:${cb}`)}>A:B</SeqButton>
              {LOGIC.map(c => <SeqButton key={c} active={condCat === c} color={C.cyan} onPress={() => setCond(c)}>{c}</SeqButton>)}
            </div>
            {condCat === '%' && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <Stepper label="CHANCE" value={pctIndex} min={0} max={PROBABILITIES.length - 1} onChange={i => setCond(`${PROBABILITIES[i]}%`)} format={i => `${PROBABILITIES[i]}%`} width={56} />
              </div>
            )}
            {condCat === 'A:B' && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <Stepper label="A (PLAYS ON)" value={ca} min={1} max={cb} onChange={a => setCond(conditionString(abCode(a, cb)))} width={36} />
                <Stepper label="B (OF LOOPS)" value={cb} min={2} max={8} onChange={b => setCond(conditionString(abCode(Math.min(ca, b), b)))} width={36} />
              </div>
            )}
            <span style={{ fontSize: 10, color: C.dim }}>{describeCondition(first?.cond)}</span>
          </Cell>
        </div>

        {f.retrig && (
          <div style={{ marginTop: 6 }}>
            <Cell label="RETRIG" highlight={hi('retrig')}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'flex-end' }}>
                <SeqButton active={!!retrig} color={C.amber} onPress={() => patch({ retrig: retrig ? null : { ...RETRIG_DEFAULT } })} height={30}>{retrig ? 'ON' : 'OFF'}</SeqButton>
                {retrig && (
                  <>
                    <Stepper label="RATE" value={retrig.rate} min={0} max={RETRIG_RATES.length - 1} onChange={v => patch({ retrig: { ...retrig, rate: v } })} format={formatRetrigRate} width={46} />
                    <Stepper label="LEN" name="retrig length" value={retrig.len} min={0} max={LEN_INF} onChange={v => patch({ retrig: { ...retrig, len: v } })} format={formatLength} width={54} dragPx={5} />
                    <Stepper label="VEL CURVE" name="retrig velocity curve" value={retrig.vel} min={RETRIG_VEL_MIN} max={RETRIG_VEL_MAX} onChange={v => patch({ retrig: { ...retrig, vel: v } })} format={formatSigned} width={46} dragPx={3} />
                  </>
                )}
              </div>
            </Cell>
          </div>
        )}

        <div style={{ marginTop: 6 }}>
          <Cell label={`PARAMETER LOCKS (${lockKeys.length})`} highlight={hi('locks')}>
            {lockKeys.length === 0 ? (
              <span style={{ fontSize: 10, color: C.dim }}>Turn an encoder while this editor is open (or while holding the trig) to lock it here.</span>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {lockKeys.map(k => (
                  <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '0 0 0 8px', height: 30, borderRadius: 4, background: '#2a2012', border: `1px solid ${C.amber}`, fontSize: 11 }}>
                    <span style={{ color: C.amber, fontWeight: 700 }}>{props.lockLabel?.(k) ?? k}</span>
                    <span style={{ fontFamily: MONO }}>{props.lockFormat?.(k, locks[k]) ?? String(Math.round(locks[k] * 100) / 100)}</span>
                    <button
                      type="button"
                      aria-label={`Clear ${k} lock`}
                      onClick={() => editProject(ctx, tracks, pr => setLock(pr, pattern, track, steps, k, null, { create: false }))}
                      style={{ width: 28, height: 28, border: 'none', background: 'transparent', color: C.text, fontSize: 14, cursor: 'pointer', touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
                    >
                      ×
                    </button>
                  </span>
                ))}
                <SeqButton onPress={() => editProject(ctx, tracks, pr => clearLocks(pr, pattern, track, steps))}>CLEAR ALL</SeqButton>
              </div>
            )}
          </Cell>
        </div>
      </div>
    </OverlayRoot>
  );

  return <Overlay portal={props.portal} portalPlacement={props.portalPlacement} portalSize={props.portalSize ?? { w: 620, h: 460 }}>{body}</Overlay>;
}
