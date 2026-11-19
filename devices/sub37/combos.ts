// ============================================================================
// Sub 37 button combinations (Subsequent 37 manual pages in brackets) and the
// module's interceptChange. Every combination the twin models goes through
// here or through the panel parts in panel.tsx, which share the hold rules:
//
//   ARPEGGIATOR, PATTERN at REC (step record)
//     ON [REST]          adds a silent step and advances (p.16)
//     LATCH [TIE]        ties the previous note to the next one played (pp.16-17)
//   BANK held (PATTERN at SEQ or REC)
//     + LATCH            enters / leaves STEP EDIT (p.18)
//     + BACK / FORTH     RATCHET CNT down; + INVERT: up (p.20)
//     + PATTERN to REC   sequence quick-erase (p.20)
//     + RANGE < >        rotate, + KB OCTAVE: step page, + a step: select it (panel.tsx)
//   STEP EDIT
//     a step held + ON   SKIP; + LATCH: RATCHET (pp.19-20)
//     a step selected    ON toggles its REST, LATCH its TIE (p.19)
//   MOD DEST held        the next control moved becomes that bus's destination (p.24)
//
// "Held" means held down with a finger (iPad: any number of fingers), or, for a
// mouse, a long press (LATCH_MS) and release: the button then stays held for the
// next press, which "uses" it. A short press does the button's own job.
// ============================================================================

import type { ControlValue } from '@/types';
import type { DeviceUiApi } from '../types';
import {
  DEST_OF_CONTROL, DEST_PGM, MOD_DESTS, PATTERN_REC, PATTERN_SEQ, PGM_DESTS, PGM_DEST_OF_CONTROL,
} from './model';
import {
  blankSeq, blankSteps, readSeq, recRest, recTie, seqDiff, toggleRatchet, toggleRest, toggleSkip, toggleTie,
  type SeqStrings,
} from './seq';

type Ui = Record<string, unknown>;
type SetValue = (id: string, v: ControlValue) => void;

/** A long press this long (ms) and release keeps a button held for the next press (mouse users) */
export const LATCH_MS = 500;

/** Controls that hold UI navigation state, not sound: never assignable, never swallowed */
export const UI_CONTROLS = ['knob_shift', 'pitch_bend', 'mod_wheel', 'preset_number', 'preset_bank', 'kb_octave', 'seq_ref', 'latch_restart'];
const UI = new Set(UI_CONTROLS);

// ---- hold state --------------------------------------------------------------

/** BANK is down, or latched by a long press */
export const bankHeld = (ui: Ui) => !!(ui.bankDown || ui.bankLatched);

/** The step button held down (or latched) in STEP EDIT, or null */
export function heldStep(ui: Ui): number | null {
  const s = ui.stepHeld;
  return typeof s === 'number' && Number.isFinite(s) ? s : null;
}

/** The step selected for editing in STEP EDIT (BANK + step), or null */
export function selectedStep(ui: Ui): number | null {
  const s = ui.stepSel;
  return typeof s === 'number' && Number.isFinite(s) ? s : null;
}

/** BANK took part in a combination: its release does nothing, a latched BANK lets go */
export const usedBank = (ui: Ui): Ui => (ui.bankLatched ? { bankUsed: true, bankLatched: false } : { bankUsed: true });

/** A held step took part in a combination: its release does nothing, a latched step lets go */
export const usedStep = (ui: Ui): Ui => (ui.stepLatched ? { stepHeldUsed: true, stepHeld: null, stepLatched: false } : { stepHeldUsed: true });

/** Write a sequence edit back as control values (only what changed) */
export function applySeq(setValue: SetValue, before: SeqStrings, after: SeqStrings) {
  Object.entries(seqDiff(before, after)).forEach(([k, v]) => setValue(k, v as ControlValue));
}

const flash = (text: string): Ui => ({ note: text, noteAt: Date.now() });
const pat = (v: Record<string, ControlValue>) => Math.round(Number(v.arp_pattern ?? 0));
const isSeqMode = (p: number) => p === PATTERN_SEQ || p === PATTERN_REC;

// ---- MOD DEST assignment (p.24) ------------------------------------------------------

/**
 * What holding MOD n DEST and moving `id` assigns: one of the panel DEST positions for the
 * controls that have their own (NOISE level, either WAVE, the other LFO's RATE), else the
 * programmable destination (DEST EG TIME/PGM + PGM DST). Null: not a twin destination.
 */
export function destFor(bus: 1 | 2, id: string): { dest: number; pgm?: number; label: string } | null {
  const other = bus === 1 ? 2 : 1;
  if (id === `mod${other}_rate` || id === `mod${other}_div`) return { dest: 0, label: `LFO ${other} RATE` };
  const d = DEST_OF_CONTROL[id];
  if (d !== undefined) return { dest: d, label: MOD_DESTS[d] };
  const p = PGM_DEST_OF_CONTROL[id];
  if (p !== undefined) return { dest: DEST_PGM, pgm: p, label: `PGM ${PGM_DESTS[p]}` };
  return null;
}

// ---- interceptChange ------------------------------------------------------------------

/**
 * DeviceModule.interceptChange: a control change the panel (or MIDI) is about to make. Returns
 * true when a combination used it instead (the control itself does not change).
 */
export function interceptSub37(id: string, value: ControlValue, api: DeviceUiApi): boolean {
  const ui = api.ui ?? {};
  const v = api.values;
  const pattern = pat(v);

  // 1. MOD DEST held: assign instead of turning (p.24)
  const bus = Number(ui.destHeld ?? 0);
  if ((bus === 1 || bus === 2) && !UI.has(id) && id !== 'mod1_dest' && id !== 'mod2_dest') {
    const a = destFor(bus, id);
    const release: Ui = ui.destLatched ? { destHeld: 0, destLatched: 0 } : {};
    if (a) {
      api.setValue(`mod${bus}_dest`, a.dest);
      if (a.pgm !== undefined) api.setValue(`mod${bus}_pgm_dst`, a.pgm);
      api.setUi({ destAssigned: true, ...release, ...flash(`MOD ${bus} DEST: ${a.label}`) });
    } else {
      api.setUi({ destAssigned: true, ...release, ...flash(`MOD ${bus} DEST: NOT IN TWIN`) });
    }
    return true;
  }

  const held = bankHeld(ui);
  const step = heldStep(ui);
  const sel = selectedStep(ui);
  const stepEdit = !!ui.stepEdit && isSeqMode(pattern);

  switch (id) {
    case 'arp_pattern': {
      const to = Math.round(Number(value));
      if (to === PATTERN_REC && pattern !== PATTERN_REC) {
        // BANK held while turning to REC: quick-erase (p.20). Running: the steps go blank and
        // the length stays; stopped: the whole sequence goes. Either way the next key records step 1.
        if (held) {
          const s = readSeq(v);
          applySeq(api.setValue, s, v.arp_on ? blankSteps(s) : { ...s, ...blankSeq() });
          api.setUi({ ...usedBank(ui), ...flash('SEQUENCE: ERASED') });
        }
        api.setUi({ recPos: 0, recTie: false });
      }
      // leaving SEQ / REC ends STEP EDIT (p.18)
      if (!isSeqMode(to) && ui.stepEdit) api.setUi({ stepEdit: false, stepSel: null, stepHeld: null, stepLatched: false });
      return false;
    }

    case 'arp_latch': {
      // BANK + LATCH: enter / leave STEP EDIT with PATTERN at SEQ or REC (p.18)
      if (held && isSeqMode(pattern)) {
        const on = !ui.stepEdit;
        api.setUi({
          ...usedBank(ui), stepEdit: on, stepSel: null, stepHeld: null, stepLatched: false, seqPage: 0, pageChase: true,
          bankMode: false, menu: null, ...flash(on ? 'STEP EDIT: ON' : 'STEP EDIT: OFF'),
        });
        return true;
      }
      if (stepEdit && step !== null) {
        // hold a step + LATCH: RATCHET on / off (p.20)
        const s = readSeq(v);
        applySeq(api.setValue, s, toggleRatchet(s, step));
        api.setUi({ ...usedStep(ui), ...flash(`STEP ${step + 1}: RATCHET`) });
        return true;
      }
      if (stepEdit && sel !== null) {
        // a selected step: LATCH [TIE] toggles its tie (p.19)
        const s = readSeq(v);
        applySeq(api.setValue, s, toggleTie(s, sel));
        return true;
      }
      if (pattern === PATTERN_REC) {
        // step record: TIE the last note to the next one (pp.16-17)
        const pos = Number(ui.recPos ?? 0);
        const r = recTie({ pos, tie: !!ui.recTie });
        api.setUi({ recTie: r.tie, ...flash(pos ? 'STEP RECORD: TIE' : 'TIE: NOTE FIRST') });
        return true;
      }
      return false;
    }

    case 'arp_on': {
      if (stepEdit && step !== null) {
        // hold a step + ON: SKIP on / off (p.19)
        const s = readSeq(v);
        applySeq(api.setValue, s, toggleSkip(s, step));
        api.setUi({ ...usedStep(ui), ...flash(`STEP ${step + 1}: SKIP`) });
        return true;
      }
      if (stepEdit && sel !== null) {
        // a selected step: ON [REST] toggles its rest (p.19)
        const s = readSeq(v);
        applySeq(api.setValue, s, toggleRest(s, sel));
        return true;
      }
      if (pattern === PATTERN_REC) {
        // step record: REST adds a silent step and advances (p.16)
        const s = readSeq(v);
        const out = recRest(s, { pos: Number(ui.recPos ?? 0), tie: !!ui.recTie });
        applySeq(api.setValue, s, out.seq);
        api.setUi({ recPos: out.rec.pos, recTie: false });
        return true;
      }
      return false;
    }

    case 'arp_back_fwd':
    case 'arp_invert': {
      // BANK + BACK/FORTH: RATCHET CNT down, BANK + INVERT: up (p.20)
      if (!held || !isSeqMode(pattern)) return false;
      const cur = Math.max(1, Math.min(8, Math.round(Number(v.seq_ratchet ?? 2))));
      const next = Math.max(1, Math.min(8, cur + (id === 'arp_invert' ? 1 : -1)));
      api.setValue('seq_ratchet', next);
      api.setUi({ ...usedBank(ui), ...flash(`RATCHET CNT: ${next}x`) });
      return true;
    }

    default:
      return false;
  }
}
