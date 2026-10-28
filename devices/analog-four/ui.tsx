'use client';
// ============================================================================
// Analog Four MKII - custom panel pieces
//   Screen        the OLED: track, page, encoder names + values, lock state
//   TrigKeys      touch layer over the 16 trig keys (StepGrid draws them):
//                 tap = trig on/off, HOLD = parameter-lock that step,
//                 FUNC lit = mute tracks, REC off = audition steps
//   LockEncoders  while a trig is held, encoders write locks for that step
//   SubPageKeys   second press of OSC 1 / FILTER / LFO opens NOISE / ENV / LFO 2
// ============================================================================

import { useEffect, useRef } from 'react';
import type { ControlValue, KnobSpec } from '@/types';
import type { PanelContext, Values } from '@/types/panel';
import Knob from '@/components/controls/Knob';
import {
  CV_TRACK, FX_PAGE_NAMES, FX_TRACK, PAGE, PAGES, PARAM_KEYS, STEPS,
  clearStepLocks, fxPageFor, fxSlots, locksId, notesId, pageSlots, parseLocks, parseNotes, patternId, tid,
  withLock, withNote, type ParamDef,
} from './params';
import { ENC_D, KEY_ROW_Y, PKEY_H, PKEY_W, PKEY_X, PX_PER_MM, encPos } from './geometry';

type Ctx = PanelContext & { setValue: (id: string, v: ControlValue) => void; sendEvent: (e: string, payload?: unknown) => void };

const num = (values: Values, id: string, fallback = 0) => {
  const v = values[id];
  return typeof v === 'number' ? v : fallback;
};
const str = (values: Values, id: string) => (typeof values[id] === 'string' ? (values[id] as string) : '');

/** Shared between the trig layer and the lock encoders */
const hold = { step: -1, wasOn: false, t0: 0, locked: false, latched: false, pointer: -1 };
const LATCH_MS = 380;

// ----------------------------------------------------------------------------
// OLED screen
// ----------------------------------------------------------------------------

const OLED = '#e9f1ff';
const DIM = '#7f8aa0';

function Cell({ label, value, locked }: { label: string; value: string; locked?: boolean }) {
  return (
    <div style={{ width: '20%', textAlign: 'center', overflow: 'hidden' }}>
      <div style={{ fontSize: 12, color: DIM, letterSpacing: 0.5, lineHeight: '15px' }}>{label || ' '}</div>
      <div
        style={{
          fontSize: 19, lineHeight: '24px', fontWeight: 700, whiteSpace: 'nowrap',
          color: locked ? '#050805' : OLED, background: locked ? OLED : 'transparent', borderRadius: 2, margin: '0 3px',
        }}
      >
        {value || ' '}
      </div>
    </div>
  );
}

export function Screen({ values, engine }: PanelContext) {
  const track = Math.round(num(values, 'track'));
  const page = Math.round(num(values, 'page', 1));
  const lockStep = Math.round(num(values, 'lock_step'));
  const playing = !!engine.playing;
  const bpm = num(values, 'tempo', 120);
  const msg = typeof engine.msg === 'string' ? engine.msg : '';
  const trackName = track === FX_TRACK ? 'FX' : track === CV_TRACK ? 'CV' : `T${track + 1}`;

  let title: string = PAGES[page] ?? '';
  let slots: (ParamDef | null)[] = Array(10).fill(null);
  let idFor: (p: ParamDef) => string = p => p.key;
  let note = '';
  if (page === PAGE.TEMPO) {
    title = 'TEMPO';
  } else if (track === CV_TRACK) {
    note = 'CV track is not modelled in this twin';
  } else if (track === FX_TRACK) {
    const fp = fxPageFor(page);
    title = FX_PAGE_NAMES[fp];
    slots = fxSlots(fp);
    idFor = p => `fx_${p.key}`;
    if (fp === 'extin' || fp === 'fxlfo' || fp === 'fxtrig') note = `${title} page is not modelled`;
  } else {
    slots = pageSlots(page);
    idFor = p => tid(track, p.key);
    const parent = PARAM_KEYS.find(k => k.sub === page);
    if (parent) title = `${PAGES[parent.page]} › ${PAGES[page]}`;
  }

  // Locks of the held trig
  const locking = lockStep > 0 && track < FX_TRACK && page !== PAGE.TEMPO;
  const stepLocks = locking ? parseLocks(str(values, `t${track + 1}_locks`))[lockStep - 1] ?? {} : {};
  const stepNote = locking ? parseNotes(str(values, notesId(track)))[lockStep - 1] : null;

  const cell = (p: ParamDef | null, i: number) => {
    if (!p) return <Cell key={i} label="" value="" />;
    let v = num(values, idFor(p), p.def);
    let locked = false;
    if (locking) {
      if (p.key === 'trig_note' && stepNote != null) { v = stepNote; locked = true; }
      else if (p.key in stepLocks) { v = stepLocks[p.key]; locked = true; }
    }
    return <Cell key={i} label={p.short} value={p.fmt ? p.fmt(v) : String(v)} locked={locked} />;
  };

  const header = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, lineHeight: '17px', paddingBottom: 3, borderBottom: `1px solid ${DIM}` }}>
      <span>
        <b style={{ background: OLED, color: '#050805', padding: '0 3px', borderRadius: 2, marginRight: 5 }}>{trackName}</b>
        <b>{title}</b>
      </span>
      <span style={{ color: DIM }}>
        A01 <span style={{ color: playing ? '#9dff9d' : DIM }}>{playing ? '▶' : '■'}</span> {bpm.toFixed(0)}
      </span>
    </div>
  );

  let body: React.ReactNode;
  if (page === PAGE.TEMPO) {
    body = (
      <div style={{ textAlign: 'center', paddingTop: 16 }}>
        <div style={{ fontSize: 42, fontWeight: 700, lineHeight: '46px' }}>{bpm.toFixed(1)}</div>
        <div style={{ fontSize: 12, color: DIM, marginTop: 4 }}>BPM · turn encoder A</div>
      </div>
    );
  } else if (note && slots.every(s => !s)) {
    body = <div style={{ textAlign: 'center', paddingTop: 40, color: DIM, fontSize: 13 }}>{note}</div>;
  } else {
    body = (
      <>
        <div style={{ display: 'flex', marginTop: 8 }}>{slots.slice(0, 5).map((p, i) => cell(p, i))}</div>
        <div style={{ display: 'flex', marginTop: 10 }}>{slots.slice(5).map((p, i) => cell(p, i + 5))}</div>
      </>
    );
  }

  const footer = msg
    ? msg
    : locking
      ? `TRIG ${lockStep} LOCK · turn encoders · tap trig ${lockStep} = done`
      : track < FX_TRACK && page !== PAGE.TEMPO
        ? 'hold a trig + turn an encoder = parameter lock'
        : '';

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', color: OLED, fontFamily: 'ui-monospace, Menlo, monospace' }}>
      {header}
      <div style={{ flex: 1 }}>{body}</div>
      <div
        style={{
          fontSize: 11, lineHeight: '15px', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden',
          color: locking ? '#050805' : DIM, background: locking ? '#ffb347' : 'transparent', borderRadius: 2,
        }}
      >
        {footer || ' '}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Trig keys (touch layer drawn over the StepGrid)
// ----------------------------------------------------------------------------

export function TrigKeys({ values, setValue, sendEvent }: Ctx) {
  const latest = useRef(values);
  latest.current = values;
  const track = Math.round(num(values, 'track'));
  const func = !!values.func;
  const rec = values.grid_rec !== false;
  const lockStep = Math.round(num(values, 'lock_step'));
  const synth = track < FX_TRACK;

  // A latched lock from a previous session must not survive a reload
  useEffect(() => {
    if (Math.round(num(latest.current, 'lock_step')) !== 0 && hold.step < 0) setValue('lock_step', 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Changing track releases a latched lock (it belongs to the previous track)
  const firstTrack = useRef(true);
  useEffect(() => {
    if (firstTrack.current) { firstTrack.current = false; return; }
    hold.latched = false;
    hold.step = -1;
    if (Math.round(num(latest.current, 'lock_step')) !== 0) setValue('lock_step', 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track]);

  const pattern = synth ? str(values, patternId(track)).padEnd(STEPS, '0') : '0'.repeat(STEPS);
  const locks = synth ? parseLocks(str(values, locksId(track))) : [];
  const notes = synth ? parseNotes(str(values, notesId(track))) : [];
  const mutes = str(values, 'mutes').padEnd(4, '0');

  const setStep = (i: number, on: boolean) => {
    const cur = str(latest.current, patternId(track)).padEnd(STEPS, '0').split('');
    cur[i] = on ? '1' : '0';
    setValue(patternId(track), cur.join(''));
  };

  const down = (i: number, e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    e.stopPropagation();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    if (func) {
      if (i < 4) {
        const m = str(latest.current, 'mutes').padEnd(4, '0').split('');
        m[i] = m[i] === '1' ? '0' : '1';
        setValue('mutes', m.join(''));
      }
      return;
    }
    if (!synth) return;
    if (!rec) { sendEvent('preview', { step: i }); hold.pointer = e.pointerId; return; }

    // Latched lock: tapping the latched trig releases it without removing it
    if (hold.latched) {
      const latchedStep = Math.round(num(latest.current, 'lock_step')) - 1;
      hold.latched = false;
      setValue('lock_step', 0);
      if (latchedStep === i) { hold.step = -1; return; }
    }
    const wasOn = pattern[i] !== '0';
    if (!wasOn) setStep(i, true);
    Object.assign(hold, { step: i, wasOn, t0: performance.now(), locked: false, pointer: e.pointerId });
    setValue('lock_step', i + 1);
  };

  const up = (i: number, e: React.PointerEvent<HTMLButtonElement>) => {
    if (func) return;
    if (!rec) { if (hold.pointer === e.pointerId) { sendEvent('preview:up'); hold.pointer = -1; } return; }
    if (hold.step !== i || hold.pointer !== e.pointerId) return;
    const held = performance.now() - hold.t0;
    if (hold.locked) {
      setValue('lock_step', 0);
    } else if (held >= LATCH_MS) {
      hold.latched = true;           // long press latches the trig for locking (mouse friendly)
      hold.pointer = -1;
      return;
    } else {
      setValue('lock_step', 0);
      if (hold.wasOn) {
        // Removing a trig also removes its note and parameter locks, like the hardware
        setStep(i, false);
        setValue(locksId(track), clearStepLocks(str(latest.current, locksId(track)), i));
        setValue(notesId(track), withNote(str(latest.current, notesId(track)), i, null));
      }
    }
    hold.step = -1;
    hold.pointer = -1;
  };

  return (
    <div className="w-full h-full flex gap-[3px] select-none" style={{ touchAction: 'none' }}>
      {Array.from({ length: STEPS }, (_, i) => {
        const hasLock = synth && (Object.keys(locks[i] ?? {}).length > 0 || notes[i] != null) && pattern[i] !== '0';
        const isHeld = lockStep === i + 1 && synth;
        const muted = func && i < 4 && mutes[i] === '1';
        return (
          <button
            key={i}
            aria-label={`Trig key ${i + 1}`}
            onPointerDown={e => down(i, e)}
            onPointerUp={e => up(i, e)}
            onPointerCancel={e => up(i, e)}
            onContextMenu={e => e.preventDefault()}
            className="flex-1 relative rounded-sm"
            style={{
              touchAction: 'none',
              background: func ? (i < 4 ? (muted ? 'rgba(10,10,10,0.82)' : 'rgba(40,200,80,0.35)') : 'rgba(10,10,10,0.6)') : 'transparent',
              outline: isHeld ? '2px solid #ffb347' : undefined,
              outlineOffset: 1,
            }}
          >
            {hasLock && !func && (
              <span className="absolute rounded-full" style={{ top: 3, right: 3, width: 5, height: 5, background: '#fff', boxShadow: '0 0 3px #fff' }} />
            )}
            {func && i < 4 && (
              <span className="absolute inset-x-0 text-center font-bold" style={{ top: 3, fontSize: 8, color: muted ? '#888' : '#d8ffe0' }}>
                {muted ? 'MUTED' : `T${i + 1}`}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Lock encoders: drawn over the DATA ENTRY knobs while a trig is held
// ----------------------------------------------------------------------------

export function LockEncoders({ values, setValue }: Ctx) {
  const track = Math.round(num(values, 'track'));
  const page = Math.round(num(values, 'page', 1));
  const lockStep = Math.round(num(values, 'lock_step'));
  if (lockStep <= 0 || track >= FX_TRACK || page === PAGE.TEMPO) return null;
  const step = lockStep - 1;
  const k = PX_PER_MM;
  const d = ENC_D * k;
  const stepLocks = parseLocks(str(values, locksId(track)))[step] ?? {};
  const stepNote = parseNotes(str(values, notesId(track)))[step];

  return (
    <>
      {pageSlots(page).map((p, slot) => {
        if (!p || p.lock === false) return null;
        const id = tid(track, p.key);
        const base = num(values, id, p.def);
        const isNote = p.key === 'trig_note';
        const lockedVal = isNote ? stepNote : stepLocks[p.key];
        const value = lockedVal ?? base;
        const spec: KnobSpec = {
          type: 'knob', label: p.short, min: p.min, max: p.max, default: base, step: p.step, units: p.units ?? 'none',
          bipolar: p.bipolar, endless: true, format: p.fmt,
          description: `Lock ${p.name} for trig ${lockStep} (double-tap to remove the lock)`,
        };
        const pos = encPos(slot);
        const onChange = (v: number) => {
          hold.locked = true;
          const pat = str(values, patternId(track)).padEnd(STEPS, '0').split('');
          if (pat[step] === '0') { pat[step] = '1'; setValue(patternId(track), pat.join('')); }
          const clear = v === base;
          if (isNote) setValue(notesId(track), withNote(str(values, notesId(track)), step, clear ? null : v));
          else {
            const next = withLock(str(values, locksId(track)), step, p.key, clear ? null : v);
            if (next) setValue(locksId(track), next);
          }
        };
        return (
          <div key={slot} className="absolute" style={{ left: pos.x * k, top: pos.y * k, transform: 'translate(-50%, -50%)', zIndex: 20 }}>
            <div className="absolute rounded-full pointer-events-none" style={{ inset: -4, boxShadow: `0 0 0 2px ${lockedVal != null ? '#ffb347' : 'rgba(255,179,71,0.45)'}` }} />
            <Knob
              id={`${id}__lock`}
              spec={spec}
              value={value}
              onChange={onChange}
              diameter={d}
              variant="elektron"
              capColor="#ffb347"
              label="none"
              valueDisplay="always"
            />
          </div>
        );
      })}
    </>
  );
}

// ----------------------------------------------------------------------------
// Second press of a lit PARAMETER key opens its secondary page
// ----------------------------------------------------------------------------

export function SubPageKeys({ values, setValue }: Ctx) {
  const track = Math.round(num(values, 'track'));
  const page = Math.round(num(values, 'page', 1));
  if (track >= FX_TRACK) return null;
  const k = PX_PER_MM;
  return (
    <>
      {PARAM_KEYS.map((key, i) => {
        if (key.sub === undefined || page !== key.page) return null;
        return (
          <button
            key={i}
            aria-label={`${key.label} again: ${PAGES[key.sub]} page`}
            title={`Press again for the ${PAGES[key.sub]} page`}
            onPointerDown={e => { e.preventDefault(); e.stopPropagation(); setValue('page', key.sub!); }}
            className="absolute"
            style={{
              left: (PKEY_X(i) - PKEY_W / 2) * k, top: (KEY_ROW_Y - PKEY_H / 2) * k,
              width: PKEY_W * k, height: PKEY_H * k, background: 'transparent', touchAction: 'none', zIndex: 15,
            }}
          />
        );
      })}
    </>
  );
}

/** Lookup used by layout: is the parameter key for `page` lit? */
export const keyLit = (keyIndex: number, page: number) => {
  const key = PARAM_KEYS[keyIndex];
  return page === key.page || page === key.sub;
};

