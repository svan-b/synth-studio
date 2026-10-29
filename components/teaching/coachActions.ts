// ============================================================================
// Coach actions: "show me" demonstrations and A/B auditions.
//
// A demonstration is a worked example: the coach moves the control itself (you hear
// the change as the knob turns), holds the result so you can listen, then puts it
// back and hands over - "your turn". The learner still makes the move, which is
// what makes it stick (worked example -> faded guidance). Challenges with a
// `solution` are the exception: "show me one way" leaves the solution in place.
// ============================================================================

import type { ControlSpec, ControlValue, LessonStep } from '@/types';
import { normToValue, valueToNorm } from '@/lib/controls/mapping';
import { hub } from '@/lib/studio/hub';
import { applyStudioSolution, isTimedSolution, resolveInstance } from '@/lib/studio/lessonRuntime';
import { useStudioStore, getSpec } from '@/store/studio';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Move a control smoothly from its value to `to` (in knob travel, so log knobs sweep evenly) */
async function sweep(instance: string, id: string, spec: ControlSpec | undefined, to: ControlValue, ms: number) {
  const st = useStudioStore.getState();
  const from = hub.valuesFor(instance)[id];
  const continuous = spec && (spec.type === 'knob' || spec.type === 'slider') && typeof from === 'number' && typeof to === 'number';
  if (!continuous || prefersReducedMotion()) {
    hub.setControl(instance, id, to);
    return;
  }
  const s = spec as Extract<ControlSpec, { type: 'knob' | 'slider' }>;
  const n0 = valueToNorm(s, from as number);
  const n1 = valueToNorm(s, to as number);
  const t0 = performance.now();
  await new Promise<void>(resolve => {
    const frame = () => {
      const t = Math.min(1, (performance.now() - t0) / ms);
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // ease in-out
      const v = t >= 1 ? to : normToValue(s, n0 + (n1 - n0) * e);
      if (useStudioStore.getState().lessonDemo === null) { resolve(); return; } // cancelled
      hub.setControl(instance, id, v);
      if (t < 1) requestAnimationFrame(frame); else resolve();
    };
    requestAnimationFrame(frame);
  });
  void st;
}

export interface ShowMeResult {
  /** What to tell the learner afterwards */
  message: string;
}

/** Can the coach demonstrate this step? */
export function canShowMe(step: LessonStep): boolean {
  return (step.control !== undefined && step.targetValue !== undefined)
    || !!(step.patchFrom && step.patchTo)
    || !!step.event
    || !!step.solution;
}

let running = false;

/** Demonstrate the step on `instance`. Resolves when the demonstration is over. */
export async function showMe(step: LessonStep, instance: string, labelOf: (id: string) => string): Promise<ShowMeResult | null> {
  if (running) return null;
  running = true;
  const store = useStudioStore.getState();
  const spec = getSpec(store.deviceOf(instance));
  store.markStepShown();
  try {
    // A momentary button / event: press it once so the learner hears what it does
    const momentary = step.control && spec?.controls[step.control]?.type === 'button' && (spec.controls[step.control] as { momentary?: boolean }).momentary;
    if (step.event || momentary) {
      store.setLessonDemo({ instance, control: step.control ?? step.event });
      hub.ensureAudio();
      if (step.control && momentary) hub.setControl(instance, step.control, true);
      if (step.event) hub.event(instance, step.event);
      await sleep(140);
      if (step.control && momentary) hub.setControl(instance, step.control, false);
      if (step.event) hub.event(instance, `${step.event}:up`);
      await sleep(700);
      store.setLessonDemo(null);
      const name = labelOf(step.control ?? step.event!);
      return { message: `That was ${name}. Your turn: press it yourself${(step.presses ?? 1) > 1 ? ` ${step.presses} times` : ''}.` };
    }

    // A cable: draw it as a ghost from one jack to the other
    if (step.patchFrom && step.patchTo) {
      store.setLessonDemo({ instance, patch: { from: step.patchFrom, to: step.patchTo } });
      await sleep(prefersReducedMotion() ? 3000 : 2600);
      store.setLessonDemo(null);
      return { message: 'Your turn: drag from the first glowing jack to the second (or tap one, then the other).' };
    }

    // A control move: there and back, so the learner makes the move
    if (step.control && step.targetValue !== undefined) {
      const id = step.control;
      const cspec = spec?.controls[id];
      const before = hub.valuesFor(instance)[id];
      store.setLessonDemo({ instance, control: id });
      hub.ensureAudio();
      hub.audition(instance, null, { ms: 3800 });
      await sweep(instance, id, cspec, step.targetValue, 1100);
      await sleep(1300);
      if (useStudioStore.getState().lessonDemo) await sweep(instance, id, cspec, before, 700);
      store.setLessonDemo(null);
      return { message: `Your turn: set ${labelOf(id)} yourself - aim for the glowing marker.` };
    }

    // An open challenge: one way to do it, left in place
    if (step.solution) {
      const sol = step.solution;
      const target = sol.instance ? resolveInstance(sol.instance) ?? sol.instance : instance;
      store.setLessonDemo({ instance: target });
      const tspec = getSpec(store.deviceOf(target));
      for (const [id, v] of Object.entries(sol.values ?? {})) await sweep(target, id, tspec?.controls[id], v, 450);
      sol.patches?.forEach(p => useStudioStore.getState().addPatchConnection(target, p.from, p.to));
      if (sol.data !== undefined) useStudioStore.getState().setDeviceData(target, sol.data);
      // Other instruments' knobs sweep too, so the learner sees and hears each move
      for (const [k, vals] of Object.entries(sol.parts ?? {})) {
        const inst = resolveInstance(k);
        if (!inst) continue;
        const pspec = getSpec(store.deviceOf(inst));
        for (const [id, v] of Object.entries(vals)) await sweep(inst, id, pspec?.controls[id], v, 350);
      }
      // The studio itself: the mix, the master, the song, snapshots, the transport
      applyStudioSolution({ ...sol, parts: undefined }, target);
      if (sol.transport === 'play') hub.startAll();
      // A button pressed until the step is done (parking a sequencer), slowly enough to follow
      if (sol.pressUntilDone) {
        // Like the panel button: its light (a momentary control) and its action (the event)
        const id = sol.pressUntilDone;
        const isControl = !!getSpec(store.deviceOf(target))?.controls[id];
        // The step's own check (the store doesn't re-evaluate while the coach demonstrates)
        const done = () => {
          const cs = useStudioStore.getState().lessonCheckState();
          try { return !!cs && (!step.check || step.check(cs)); } catch { return false; }
        };
        for (let k = 0; k < 16 && !done(); k++) {
          if (isControl) hub.setControl(target, id, true);
          hub.event(target, id);
          await sleep(90);
          if (isControl) hub.setControl(target, id, false);
          useStudioStore.getState().lessonPress(target, [id]);
          await sleep(320);
        }
      }
      store.setLessonDemo(null);
      return { message: isTimedSolution(sol) ? 'That is one way to set it up. Now play it through and listen.' : 'That is one way to do it. Listen, then change one thing and make it yours.' };
    }
    return null;
  } finally {
    running = false;
    if (useStudioStore.getState().lessonDemo) useStudioStore.getState().setLessonDemo(null);
  }
}

/** Stop any demonstration in progress (step change, lesson end) */
export function cancelShowMe() {
  if (useStudioStore.getState().lessonDemo) useStudioStore.getState().setLessonDemo(null);
}
