// ============================================================================
// Lesson audit: every lesson against docs/PEDAGOGY.md, beyond what validate checks.
//   npx tsx scripts/lesson-audit.ts [device ...] [--table] [--json]
// It walks each lesson the way a learner would (start state, then every step's target
// applied in turn) and reports where the learning flow breaks the spec:
//   flow      a step that is already done when it begins, an A/B with nothing to hear,
//             an ear challenge whose target is the sound already playing
//   shape     the parts every lesson must have, in the place the spec gives them
//   words     instruction and principle lengths, option counts, hint ladders
//   sequence  order, prerequisites and paths across an instrument's lessons, and a walk along
//             "Next lesson" from nothing done: it reaches every lesson, each one unlocked
//   options   the shuffled order questions are shown in keeps the right answer moving
// Exit code 1 when anything is found (so it can gate), 0 when clean.
// ============================================================================
import type { ControlSpec, ControlValue, Lesson, LessonCheckState, LessonStep, MultipleChoice } from '../types';
import { DEVICES } from '../devices';
import type { DeviceModule } from '../devices/types';
import { isValueOnTarget, pressTargetOf, valueToNorm } from '../lib/controls/mapping';
import { lessonAfter, recommendedLesson } from '../lib/studio/lessonSequence';
import { keepsOrder, optionOrder } from '../components/teaching/optionOrder';

type Finding = { lesson: string; step?: number; cat: 'flow' | 'shape' | 'words' | 'sequence'; code: string; msg: string };

const words = (t: string | undefined) => (t ?? '').trim().split(/\s+/).filter(Boolean).length;
export const kindOf = (s: LessonStep) =>
  s.kind ?? (s.patchFrom && s.patchTo ? 'patch' : s.control ? 'do' : s.checklist?.length ? 'challenge' : 'info');

const OWN_GEAR = ['midi-synth', 'audio-in', 'wam-plugin'];
/** Recommended sequence of paths (docs/PEDAGOGY.md, "The curriculum for each instrument") */
const PATH_RANK: Record<string, number> = { foundations: 0, 'sound-design': 1, 'ear-training': 2, sequencing: 3, performance: 4, studio: 5 };

function travel(spec: ControlSpec | undefined, a: ControlValue | undefined, b: ControlValue | undefined): number {
  if (a === undefined || b === undefined) return 1;
  if (typeof a !== 'number' || typeof b !== 'number') return a === b ? 0 : 1;
  if (spec && (spec.type === 'knob' || spec.type === 'slider')) return Math.abs(valueToNorm(spec, a) - valueToNorm(spec, b));
  if (spec && 'min' in spec && 'max' in spec && typeof spec.min === 'number' && typeof spec.max === 'number' && spec.max > spec.min) return Math.abs(a - b) / (spec.max - spec.min);
  return a === b ? 0 : 1;
}

/**
 * One lesson. `mod` is its instrument; studio lessons (device 'studio') have none, so their
 * steps are not walked (validate plays their checks against their start studio instead).
 */
export function auditLesson(l: Lesson, mod: DeviceModule | undefined, all: Lesson[]): Finding[] {
  const out: Finding[] = [];
  const add = (cat: Finding['cat'], code: string, msg: string, step?: number) => out.push({ lesson: l.id, step, cat, code, msg });
  const controls = (mod?.spec.controls ?? {}) as Record<string, ControlSpec>;
  const defaults: Record<string, ControlValue> = {};
  Object.entries(controls).forEach(([id, c]) => { if ('default' in c && c.default !== undefined) defaults[id] = c.default as ControlValue; });

  // ---- flow: walk the lesson -------------------------------------------------
  let values: Record<string, ControlValue> = { ...defaults, ...(l.start?.values ?? {}) };
  let patches = [...(l.start?.patches ?? [])];
  const data: unknown = l.start?.data ?? mod?.data?.initial();
  // The store's check state when a step begins: nothing pressed, no notes played yet. The walk
  // follows values and cables only; `blind` is set when a check reads anything else (the
  // instrument's data, the studio around it), so those checks are left to the lesson runner.
  let blind = false;
  const stateNow = (): LessonCheckState => {
    const base: LessonCheckState = {
      values, patches, data, engine: {},
      instances: { [l.device]: { device: l.device, values, patches, data } },
      studioCables: [], routes: {}, sync: {}, transport: { playing: false, bpm: 120 }, arrangement: { enabled: false, loop: true, sections: [] },
      events: {}, notesPlayed: [], eventsByInstance: {},
    };
    const FOLLOWED = new Set(['values', 'patches', 'events', 'notesPlayed', 'eventsByInstance']);
    const watch = <T extends object>(o: T, followed: Set<string>): T => new Proxy(o, {
      get(t, k) {
        if (typeof k === 'string' && !followed.has(k)) blind = true;
        return Reflect.get(t, k);
      },
    });
    base.instances = watch({ [l.device]: watch(base.instances[l.device], FOLLOWED) }, new Set([l.device]));
    return watch(base, new Set([...FOLLOWED, 'instances']));
  };
  const hasPatch = (a?: string, b?: string) => patches.some(c => (c.from === a && c.to === b) || (c.from === b && c.to === a));
  const kinds = l.steps.map(kindOf);
  l.steps.forEach((s, i) => {
    const n = i + 1;
    const kind = kinds[i];
    const walked = !!mod && (!s.instance || s.instance === l.device); // another instrument's step is not walked here
    if (walked) {
    if (s.setup) values = { ...values, ...s.setup };
    if (s.setupPatches) patches = [...s.setupPatches];
    const spec = s.control ? controls[s.control] : undefined;
    const press = pressTargetOf(s, spec);

    if ((kind === 'do' || kind === 'predict') && s.control && !press && !s.play && s.targetValue !== undefined && !s.check) {
      if (isValueOnTarget(spec, values[s.control], s.targetValue, s.tolerance))
        add('flow', 'already-done', `${s.control} is already ${String(values[s.control])} when the step begins (target ${String(s.targetValue)}): it completes with no move`, n);
    }
    // a custom check or a challenge that passes before the learner has done anything
    if ((s.check || s.checklist?.some(c => c.check)) && kind !== 'listen' && kind !== 'quiz' && kind !== 'reflect' && kind !== 'match') {
      try {
        const st = stateNow();
        const checks = [...(s.check ? [s.check] : []), ...(s.checklist ?? []).map(c => c.check).filter((c): c is NonNullable<typeof c> => !!c)];
        const controlOk = !s.control || press || isValueOnTarget(spec, values[s.control], s.targetValue, s.tolerance);
        blind = false;
        const pass = checks.every(c => c(st));
        if (pass && !blind && controlOk && !press && !s.play && !s.event) add('flow', 'check-already', `${kind}: every check already passes when the step begins`, n);
      } catch { /* validate reports checks that throw */ }
    }
    if (kind === 'patch' && hasPatch(s.patchFrom, s.patchTo)) add('flow', 'already-done', `the cable ${s.patchFrom} -> ${s.patchTo} is already in when the step begins`, n);

    if (kind === 'listen' && s.listen && !s.listen.demo && !s.listen.parts && !s.listen.master && !s.listen.studio && !s.listen.patterns) {
      const keys = new Set([...Object.keys(s.listen.a), ...Object.keys(s.listen.b)]);
      const differs = [...keys].some(k => (s.listen!.a[k] ?? values[k]) !== (s.listen!.b[k] ?? values[k]));
      if (!differs) add('flow', 'ab-same', 'both sides of the A/B are the same sound', n);
    }
    if (kind === 'match' && s.match) {
      const m = s.match;
      const before = { ...values };
      Object.entries(m.target).forEach(([k, v]) => { if (!m.controls.includes(k)) values[k] = v; });
      const tol = m.tolerance ?? 0.08;
      const dist = m.controls.map(c => travel(controls[c], before[c], m.target[c]));
      if (m.controls.length && dist.every(d => d <= tol)) add('flow', 'match-already', `the target is the sound already playing (${m.controls.join(', ')} within tolerance): Check passes untouched`, n);
      m.controls.forEach(c => { values[c] = m.target[c]; });
      if (m.patches) patches = [...m.patches];
    }

    // the learner makes the move
    if ((kind === 'do' || kind === 'predict') && s.control && s.targetValue !== undefined && !press) values[s.control] = s.targetValue;
    if (kind === 'patch' && s.patchFrom && s.patchTo && !hasPatch(s.patchFrom, s.patchTo)) patches.push({ from: s.patchFrom, to: s.patchTo, color: '#888' } as never);
    if (s.solution?.values && (!s.solution.instance || s.solution.instance === l.device)) values = { ...values, ...s.solution.values };
    if (s.solution?.patches) s.solution.patches.forEach(p => { if (!hasPatch(p.from, p.to)) patches.push(p); });
    }

    // ---- words -----------------------------------------------------------------
    if (words(s.instruction) > 25) add('words', 'instruction-long', `instruction is ${words(s.instruction)} words (at most 25)`, n);
    if (words(s.principle) > 20) add('words', 'principle-long', `principle is ${words(s.principle)} words (at most 20)`, n);
    // an A/B question may ask "A or B?"; predictions and quizzes need 3 or 4 plausible options
    const mcs: [string, MultipleChoice | undefined, number][] = [['predict', s.predict, 3], ['quiz', s.quiz, 3], ['listen question', s.listen?.question, 2]];
    mcs.forEach(([name, mc, min]) => {
      if (!mc) return;
      if (mc.options.length < min || mc.options.length > 4) add('words', 'options-count', `${name} has ${mc.options.length} options (${min === 2 ? '2 to 4' : '3 or 4'})`, n);
      if (new Set(mc.options.map(o => o.trim().toLowerCase())).size !== mc.options.length) add('words', 'options-duplicate', `${name} has two identical options`, n);
    });
    // a hint ladder for the hard steps: ear challenges, and open briefs with more than one thing to get right
    const hard = kind === 'match' || (kind === 'challenge' && (s.checklist?.length ?? 0) >= 2);
    if (hard && (s.hints?.length ?? 0) < 2) add('words', 'hints-few', `${kind} has ${s.hints?.length ?? 0} hints (2 or 3, vague to specific)`, n);
    if ((s.hints?.length ?? 0) > 3) add('words', 'hints-many', `${s.hints!.length} hints (2 or 3)`, n);
    if (kind === 'match' && s.match && (s.match.controls.length < 1 && !s.match.pattern || s.match.controls.length > 3)) add('words', 'match-controls', `ear challenge tests ${s.match.controls.length} controls (1 to 3)`, n);
    if (kind === 'challenge' && !(s.checklist?.length || s.check)) add('flow', 'challenge-unchecked', 'challenge has no checklist and no check: nothing tells the learner they got there', n);
  });

  // ---- shape -------------------------------------------------------------------
  const has = (...k: string[]) => kinds.some(x => k.includes(x));
  if (!l.objective) add('shape', 'no-objective', 'no objective');
  if (!l.start?.reset && !l.start?.values && !l.start?.studio && l.path !== 'studio' && l.device !== 'studio') add('shape', 'no-start', 'no known starting point (start.reset or start.values)');
  const firstAct = kinds.findIndex(k => k === 'do' || k === 'patch' || k === 'predict' || k === 'challenge' || k === 'match');
  if (firstAct < 0) add('shape', 'no-first-win', 'no hands-on step');
  // A hook, a warm-up question from the lesson before and one line of orientation may come first
  // (the Producer path opens that way); after that the learner's hands are on the instrument
  else if (firstAct > 3) add('shape', 'late-first-win', `the first hands-on step is step ${firstAct + 1}: a first win belongs in the first minute (steps 1 to 4)`);
  if (!has('predict', 'listen')) add('shape', 'no-predict-listen', 'no predict or listen step');
  if (!has('quiz')) add('shape', 'no-quiz', 'no quiz step');
  if (!has('match', 'challenge')) add('shape', 'no-match-challenge', 'no match or challenge step');
  const last = kinds[kinds.length - 1];
  if (last !== 'reflect' && last !== 'challenge') add('shape', 'no-closing', `ends on a ${last} step: close with a reflect or an open experiment`);
  const rv = l.review?.length ?? 0;
  if (rv < 3 || rv > 5) add('shape', 'review-count', `${rv} review questions (3 to 5)`);
  l.review?.forEach((mc, i) => {
    if (mc.options.length < 3 || mc.options.length > 4) add('words', 'options-count', `review[${i}] has ${mc.options.length} options (3 or 4)`);
  });
  // ear training is matching by ear; where the target is a switch position that several settings
  // share (a tuning system), a judged A/B plus a challenge set by ear does the same job
  const judgedAB = l.steps.some(s => kindOf(s) === 'listen' && !!s.listen?.question);
  if (l.path === 'ear-training' && !has('match') && !(judgedAB && has('challenge'))) add('shape', 'ear-no-match', 'an ear-training lesson without a match step (or a judged A/B with a challenge)');

  // ---- sequence ------------------------------------------------------------------
  (l.prerequisites ?? []).forEach(p => {
    const pre = all.find(x => x.id === p);
    if (!pre) return;
    if ((pre.order ?? 999) >= (l.order ?? 999)) add('sequence', 'prereq-after', `prerequisite ${p} (order ${pre.order}) comes after this lesson (order ${l.order}) in the recommended sequence`);
  });
  return out;
}

export function auditDevice(mod: DeviceModule, id: string): Finding[] {
  const out: Finding[] = [];
  const ls = [...mod.lessons].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  const add = (lesson: string, code: string, msg: string) => out.push({ lesson, cat: 'sequence', code, msg });
  mod.lessons.forEach(l => out.push(...auditLesson(l, mod, mod.lessons)));
  const seen = new Map<number, string>();
  ls.forEach(l => {
    if (l.order === undefined) { add(l.id, 'no-order', 'no order: it sorts last, wherever its path sits'); return; }
    if (seen.has(l.order)) add(l.id, 'order-duplicate', `order ${l.order} is also ${seen.get(l.order)}: which comes first is left to chance`);
    seen.set(l.order, l.id);
  });
  const byPath = new Map<string, Lesson[]>();
  ls.forEach(l => { if (l.path) byPath.set(l.path, [...(byPath.get(l.path) ?? []), l]); });
  if (ls[0]?.prerequisites?.length) add(ls[0].id, 'first-locked', 'the first lesson in the sequence has prerequisites');
  if (ls[0] && ls[0].path !== 'foundations') add(ls[0].id, 'first-not-foundations', `the sequence opens on a ${ls[0].path} lesson`);
  // every lesson after the first should be reachable: unlocked by lessons before it
  ls.forEach((l, i) => {
    if (i > 0 && !(l.prerequisites?.length) && l.path !== 'foundations') add(l.id, 'no-prereq', `${l.path} lesson with no prerequisites: it is open before the foundations it builds on`);
  });
  out.push(...auditWalk(mod.lessons, id), ...auditOptions(mod.lessons, id));
  const paths = [...byPath.keys()];
  const firstOrder = (p: string) => Math.min(...(byPath.get(p) ?? []).map(l => l.order ?? 999));
  paths.sort((a, b) => firstOrder(a) - firstOrder(b));
  const ranked = paths.filter(p => p in PATH_RANK);
  for (let i = 1; i < ranked.length; i++) if (PATH_RANK[ranked[i]] < PATH_RANK[ranked[i - 1]]) add(id, 'path-order', `the ${ranked[i]} path starts after ${ranked[i - 1]} (spec: foundations, sound-design, ear-training, sequencing, performance, studio)`);
  // The full curriculum is for the instruments; the bring-your-own-gear devices teach a setup
  if (!OWN_GEAR.includes(id)) {
    if (mod.lessons.length < 14) add(id, 'lesson-count', `${mod.lessons.length} lessons (aim for 14 to 20)`);
    const ear = mod.lessons.filter(l => l.path === 'ear-training').length;
    if (ear < 4) add(id, 'ear-count', `${ear} ear-training lessons (at least 4)`);
  }
  return out;
}

/**
 * Follow "Next lesson" from nothing done, as a learner would (lib/studio/lessonSequence.ts):
 * it must reach every lesson, each one with its prerequisites finished, and agree with the
 * lesson browser's "Recommended next" all the way.
 */
export function auditWalk(lessons: readonly Lesson[], name: string): Finding[] {
  const out: Finding[] = [];
  const done: string[] = [];
  let cur = recommendedLesson(lessons, done);
  while (cur) {
    const open = (cur.prerequisites ?? []).filter(p => !done.includes(p));
    if (open.length) out.push({ lesson: cur.id, cat: 'sequence', code: 'walk-locked', msg: `reached before its prerequisites (${open.join(', ')})` });
    const next = lessonAfter(lessons, cur, done);
    done.push(cur.id);
    const rec = recommendedLesson(lessons, done);
    // "Next lesson" carries on from where the learner is; the browser starts from the top. Following
    // the path from the start they are the same lesson.
    if (next?.id !== rec?.id) out.push({ lesson: cur.id, cat: 'sequence', code: 'walk-disagrees', msg: `"Next lesson" goes to ${next?.id ?? 'nothing'}, "Recommended next" to ${rec?.id ?? 'nothing'}` });
    cur = next;
  }
  const missed = lessons.filter(l => !done.includes(l.id));
  if (missed.length) out.push({ lesson: name, cat: 'sequence', code: 'walk-unreached', msg: `never reached by following the path: ${missed.map(l => l.id).join(', ')}` });
  return out;
}

/** Shuffled option order (components/teaching/optionOrder.ts): a permutation, A/B sides kept, "Both"/"Neither" last */
export function auditOptions(lessons: readonly Lesson[], name: string): Finding[] {
  const out: Finding[] = [];
  const shown = [0, 0, 0, 0];
  let n = 0;
  lessons.forEach(l => {
    const mcs = [...l.steps.flatMap(s => [s.predict, s.quiz, s.listen?.question]), ...(l.review ?? [])].filter((m): m is MultipleChoice => !!m);
    mcs.forEach(mc => {
      for (const seed of [1, 77, 4242]) {
        const o = optionOrder(mc, seed);
        if ([...o].sort((a, b) => a - b).join() !== mc.options.map((_, i) => i).join()) out.push({ lesson: l.id, cat: 'flow', code: 'options-order', msg: `"${mc.question}": the shown order is not a permutation of the options` });
      }
      if (keepsOrder(mc)) return;
      n++;
      shown[optionOrder(mc, 1).indexOf(mc.answer)]++;
    });
  });
  // the point of shuffling: the right answer must not sit in one place
  const top = Math.max(...shown);
  if (n >= 30 && top / n > 0.5) out.push({ lesson: name, cat: 'flow', code: 'answer-position', msg: `the right answer is shown in the same position in ${Math.round((100 * top) / n)} % of ${n} questions` });
  return out;
}

const inOrder = (ls: readonly Lesson[]) => [...ls].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

/** The shared studio lessons, or the Producer path: shape, words and sequence (their steps are not walked) */
export function auditStudio(lessons: readonly Lesson[], name: string): Finding[] {
  const out: Finding[] = [];
  lessons.forEach(l => out.push(...auditLesson(l, undefined, [...lessons])));
  const seen = new Map<number, string>();
  inOrder(lessons).forEach((l, i) => {
    if (l.order === undefined) out.push({ lesson: l.id, cat: 'sequence', code: 'no-order', msg: 'no order' });
    else {
      if (seen.has(l.order)) out.push({ lesson: l.id, cat: 'sequence', code: 'order-duplicate', msg: `order ${l.order} is also ${seen.get(l.order)}` });
      seen.set(l.order, l.id);
    }
    if (i === 0 && l.prerequisites?.length) out.push({ lesson: l.id, cat: 'sequence', code: 'first-locked', msg: `the first ${name} lesson has prerequisites` });
  });
  out.push(...auditWalk(lessons, name), ...auditOptions(lessons, name));
  return out;
}

if (require.main === module) (async () => {
  const args = process.argv.slice(2);
  const only = args.filter(a => !a.startsWith('--'));
  const table = args.includes('--table');
  let total = 0;
  const tally: Record<string, number> = {};
  if (!only.length || only.includes('studio') || only.includes('producer')) {
    const { STUDIO_LESSONS } = await import('../lib/studio/lessons');
    const { PRODUCER_LESSONS } = await import('../lib/studio/producerLessons');
    for (const [name, ls] of [['studio', STUDIO_LESSONS], ['producer', PRODUCER_LESSONS]] as const) {
      const f = auditStudio(ls, name);
      total += f.length;
      console.log(`\n${name}: ${ls.length} lessons, ${f.length} findings`);
      if (table) inOrder(ls).forEach(l => console.log(`  ${String(l.order ?? '-').padStart(3)} ${(l.path ?? '-').padEnd(13)} ${l.difficulty.padEnd(12)} ${l.id.padEnd(34)} ${l.steps.map(s => kindOf(s)[0]).join('')}  <- ${(l.prerequisites ?? []).join(', ')}`));
      f.forEach(x => { tally[x.code] = (tally[x.code] ?? 0) + 1; console.log(`  [${x.cat}] ${x.lesson}${x.step ? ` step ${x.step}` : ''}: ${x.msg}`); });
    }
  }
  for (const entry of DEVICES) {
    if (only.length && !only.includes(entry.id)) continue;
    const mod = (await entry.load()).default;
    if (!mod.lessons.length) continue;
    const f = auditDevice(mod, entry.id);
    total += f.length;
    console.log(`\n${entry.id}: ${mod.lessons.length} lessons, ${f.length} findings`);
    if (table) [...mod.lessons].sort((a, b) => (a.order ?? 999) - (b.order ?? 999)).forEach(l =>
      console.log(`  ${String(l.order ?? '-').padStart(3)} ${(l.path ?? '-').padEnd(13)} ${l.difficulty.padEnd(12)} ${l.id.padEnd(34)} ${l.steps.map(s => kindOf(s)[0]).join('')}  <- ${(l.prerequisites ?? []).join(', ')}`));
    f.forEach(x => { tally[x.code] = (tally[x.code] ?? 0) + 1; console.log(`  [${x.cat}] ${x.lesson}${x.step ? ` step ${x.step}` : ''}: ${x.msg}`); });
  }
  console.log(`\n${total} findings${total ? ': ' + Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(', ') : ''}`);
  process.exit(total ? 1 : 0);
})();
