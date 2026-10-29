// ============================================================================
// Control value mapping
// Shared by knobs, sliders, the store and the lesson checker so that
// "where the knob points", "what the value reads" and "is the lesson step done"
// always agree.
// ============================================================================

import type { ControlSpec, ControlValue, KnobSpec, LessonStep, SliderSpec, Units } from '@/types';

type ContinuousSpec = Pick<KnobSpec, 'min' | 'max' | 'curve' | 'step'> | Pick<SliderSpec, 'min' | 'max' | 'curve' | 'step'>;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// A log curve only makes sense for a strictly positive range
const isLog = (spec: ContinuousSpec) => spec.curve === 'logarithmic' && spec.min > 0 && spec.max > spec.min;
const isExp = (spec: ContinuousSpec) => spec.curve === 'exponential';

/** Value → 0..1 knob travel */
export function valueToNorm(spec: ContinuousSpec, value: number): number {
  const { min, max } = spec;
  if (max === min) return 0;
  const v = clamp(value, min, max);
  if (isLog(spec)) return Math.log(v / min) / Math.log(max / min);
  const lin = (v - min) / (max - min);
  if (isExp(spec)) return Math.sqrt(lin);
  return lin;
}

/** 0..1 knob travel → value (snapped to step if the spec has one) */
export function normToValue(spec: ContinuousSpec, norm: number): number {
  const { min, max } = spec;
  const n = clamp(norm, 0, 1);
  let v: number;
  if (isLog(spec)) v = min * Math.pow(max / min, n);
  else if (isExp(spec)) v = min + (max - min) * n * n;
  else v = min + (max - min) * n;
  if (spec.step) v = Math.round(v / spec.step) * spec.step;
  else v = roundSensibly(v, max - min);
  return clamp(v, min, max);
}

// Avoid values like 799.9999 without forcing a step on every control
function roundSensibly(v: number, range: number): number {
  const decimals = range <= 2 ? 3 : range <= 20 ? 2 : range <= 200 ? 1 : 0;
  const f = Math.pow(10, decimals);
  return Math.round(v * f) / f;
}

export function formatValue(spec: { units?: Units; bipolar?: boolean; format?: (v: number) => string }, value: number): string {
  if (spec.format) return spec.format(value);
  const { units = '%', bipolar = false } = spec;
  const sign = bipolar && value > 0 ? '+' : '';
  if (bipolar && Math.abs(value) < 1e-9) return '0';
  switch (units) {
    case 'Hz':
      if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
      return value < 10 ? value.toFixed(2) : value.toFixed(0);
    case 'ms':
      if (value >= 1000) return `${(value / 1000).toFixed(1)}s`;
      return value < 10 ? value.toFixed(1) : value.toFixed(0);
    case 's':
      return value < 10 ? `${value.toFixed(2)}s` : `${value.toFixed(1)}s`;
    case 'BPM':
      if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
      return value.toFixed(0);
    case 'octaves':
    case 'V':
    case 'dB':
      return `${sign}${value.toFixed(1)}`;
    case 'semitones':
    case 'cents':
    case 'steps':
      return `${sign}${Math.round(value)}`;
    case 'ratio':
      return `${value.toFixed(2)}`;
    case '%':
      return `${sign}${Math.round(value)}`;
    default:
      return `${sign}${Math.abs(value) >= 100 ? Math.round(value) : value.toFixed(1)}`;
  }
}

/** Human readable target for lesson UI ("800 Hz", "LP", "ON", pattern) */
export function describeValue(spec: ControlSpec | undefined, value: ControlValue | undefined): string {
  if (value === undefined) return '';
  if (!spec) return String(value);
  switch (spec.type) {
    case 'switch':
      return spec.options[value as number] ?? String(value);
    case 'button':
      return value ? 'ON' : 'OFF';
    case 'knob':
    case 'slider': {
      const units = spec.units === '%' || spec.units === 'none' ? (spec.units === '%' ? '%' : '') : ` ${spec.units}`;
      return `${formatValue(spec, value as number)}${spec.format ? '' : units}`;
    }
    case 'pattern':
      return String(value).split('').map(c => (c === '0' ? '·' : '●')).join('');
    default:
      return String(value);
  }
}

/**
 * Tolerance for "close enough" numeric matches.
 * For log controls we compare in knob-travel space (3% of travel), which is how
 * the knob actually feels; otherwise 3% of the full range, never less than one step.
 */
export function isValueOnTarget(
  spec: ControlSpec | undefined,
  value: ControlValue | undefined,
  target: ControlValue | undefined,
  overrideTolerance?: number,
): boolean {
  if (value === undefined || target === undefined) return false;
  if (typeof target !== 'number' || typeof value !== 'number') return value === target;
  if (overrideTolerance !== undefined) return Math.abs(value - target) <= overrideTolerance;
  if (spec && (spec.type === 'knob' || spec.type === 'slider')) {
    const stepTol = spec.step ? spec.step / 2 + 1e-9 : 0;
    const travelDiff = Math.abs(valueToNorm(spec, value) - valueToNorm(spec, target));
    return travelDiff <= 0.03 || Math.abs(value - target) <= stepTol;
  }
  if (spec && spec.type === 'switch') return value === target;
  return Math.abs(value - target) <= Math.max(Math.abs(target) * 0.05, 0.1);
}

/** What the learner did during a step, beyond the panel's values (from the lesson session) */
export interface StepActivity {
  /** Presses by control id and by event name */
  events?: Record<string, number>;
  /** Notes played, oldest first */
  notesPlayed?: number[];
}

/**
 * The control id or event name whose presses a step counts, or null for a value step.
 * Momentary buttons (TRIGGER, ADVANCE, TAP) have no lasting value, so a step about one
 * is done once it has been pressed; `presses` makes a toggle button count presses too.
 */
export function pressTargetOf(step: LessonStep, spec: ControlSpec | undefined): string | null {
  if (step.event) return step.event;
  if (step.control && spec?.type === 'button' && (spec.momentary || step.presses !== undefined)) return step.control;
  return null;
}

/** Presses a step still needs (at least 1) */
export function pressesNeeded(step: LessonStep): number {
  return Math.max(1, Math.round(step.presses ?? 1));
}

/** Has the learner played what `play` asks for? Exact notes must appear in order, back to back. */
export function isPlaySatisfied(play: NonNullable<LessonStep['play']>, played: number[] | undefined): boolean {
  const notes = played ?? [];
  const want = play.notes ?? [];
  if (want.length) {
    const norm = (n: number) => (play.anyOctave ? ((n % 12) + 12) % 12 : n);
    for (let i = 0; i + want.length <= notes.length; i++) {
      if (want.every((n, j) => norm(notes[i + j]) === norm(n))) return true;
    }
    return false;
  }
  return notes.length >= Math.max(1, play.count ?? 1);
}

/** How many presses of `id` a check state has seen this step - a helper for lesson checks */
export function pressCount(s: { events?: Record<string, number> }, id: string): number {
  return s.events?.[id] ?? 0;
}

export function isStepSatisfied(
  step: LessonStep,
  spec: ControlSpec | undefined,
  values: Record<string, ControlValue>,
  patches: { from: string; to: string }[],
  activity?: StepActivity,
): boolean {
  if (step.patchFrom && step.patchTo) {
    return patches.some(
      c => (c.from === step.patchFrom && c.to === step.patchTo) || (c.from === step.patchTo && c.to === step.patchFrom),
    );
  }
  const playOk = !step.play || isPlaySatisfied(step.play, activity?.notesPlayed);
  const press = pressTargetOf(step, spec);
  if (press) return (activity?.events?.[press] ?? 0) >= pressesNeeded(step) && playOk;
  if (!step.control) return playOk; // informational step (or a "play the keys" step)
  return isValueOnTarget(spec, values[step.control] ?? defaultOf(spec), step.targetValue, step.tolerance) && playOk;
}

export function defaultOf(spec: ControlSpec | undefined): ControlValue | undefined {
  if (!spec || !('default' in spec)) return undefined;
  return spec.default as ControlValue;
}
