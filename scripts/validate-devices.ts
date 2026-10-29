// ============================================================================
// Device data validator:  npm run validate [deviceId...]
// Checks specs, layouts, presets and lessons for the mistakes that break
// lessons or the panel at runtime. Exits non-zero on errors.
// ============================================================================

import type { ControlSpec, ControlValue, Lesson, LessonCheckState, LessonStep, MultipleChoice } from '../types';
import { LESSON_PATHS } from '../types';
import type { PanelElement } from '../types/panel';
import { DEVICES } from '../devices';
import type { DeviceModule } from '../devices/types';

type Issue = { level: 'error' | 'warn'; msg: string };

function checkValue(spec: ControlSpec, v: ControlValue, where: string, out: Issue[]) {
  const err = (m: string) => out.push({ level: 'error', msg: `${where}: ${m}` });
  switch (spec.type) {
    case 'knob':
    case 'slider':
      if (typeof v !== 'number' || !Number.isFinite(v)) return err(`expected number, got ${JSON.stringify(v)}`);
      if (v < spec.min || v > spec.max) err(`${v} outside ${spec.min}..${spec.max}`);
      break;
    case 'switch':
      if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v >= spec.options.length)
        err(`switch index ${JSON.stringify(v)} invalid (options: ${spec.options.join(', ')})`);
      break;
    case 'button':
      if (typeof v !== 'boolean') err(`expected boolean, got ${JSON.stringify(v)}`);
      break;
    case 'pattern':
      if (typeof v !== 'string' || v.length !== spec.steps) err(`pattern must be a ${spec.steps}-char string`);
      break;
  }
}

/** Lessons written for the v2 coach (have an objective or any v2 step kind) */
function lessonV2(l: Lesson): boolean {
  return !!l.objective || l.steps.some(s => !!s.kind);
}

function radius(el: PanelElement): number | null {
  switch (el.kind) {
    case 'knob': return (el.diameter ?? 12) / 2;
    case 'jack': return 3.1;
    case 'button': return (el.w ?? 7) / 2;
    case 'led': return (el.size ?? 2.5) / 2;
    default: return null;
  }
}

function validate(id: string, mod: DeviceModule): Issue[] {
  const out: Issue[] = [];
  const err = (m: string) => out.push({ level: 'error', msg: m });
  const warn = (m: string) => out.push({ level: 'warn', msg: m });
  const { spec, layout, lessons } = mod;

  if (spec.id !== id) err(`spec.id "${spec.id}" does not match registry id "${id}"`);
  const controls = spec.controls;
  const jacks = new Map<string, string>();
  spec.patchBay?.inputs.forEach(j => { if (jacks.has(j.id)) err(`duplicate jack ${j.id}`); jacks.set(j.id, 'input'); if (j.jackType !== 'input') err(`jack ${j.id} listed in inputs but jackType=${j.jackType}`); });
  spec.patchBay?.outputs.forEach(j => { if (jacks.has(j.id)) err(`duplicate jack ${j.id}`); jacks.set(j.id, 'output'); if (j.jackType !== 'output') err(`jack ${j.id} listed in outputs but jackType=${j.jackType}`); });

  // Control specs
  Object.entries(controls).forEach(([cid, c]) => {
    if ('default' in c && c.default !== undefined) checkValue(c, c.default as ControlValue, `control ${cid} default`, out);
    if ((c.type === 'knob' || c.type === 'slider') && c.curve === 'logarithmic' && c.min <= 0) err(`control ${cid}: logarithmic curve needs min > 0`);
    if (c.type === 'switch' && c.options.length < 2) err(`control ${cid}: switch needs >= 2 options`);
  });

  // Layout
  const onPanel = new Set<string>();
  const jacksOnPanel = new Map<string, number>();
  const ui = new Set(mod.uiControls ?? []);
  layout.elements.forEach((el, i) => {
    const where = `layout[${i}] ${el.kind}`;
    if ('x' in el && (el.x < -2 || el.x > layout.width + 2 || el.y < -2 || el.y > layout.height + 2)) warn(`${where} at (${el.x},${el.y}) is outside the ${layout.width}x${layout.height}mm panel`);
    const ref = (cid: string, kinds: ControlSpec['type'][]) => {
      const c = controls[cid];
      if (!c) return err(`${where} references missing control "${cid}"`);
      if (!kinds.includes(c.type)) err(`${where} control "${cid}" is a ${c.type}, expected ${kinds.join('/')}`);
      onPanel.add(cid);
    };
    switch (el.kind) {
      case 'knob': if (typeof el.control === 'string') ref(el.control, ['knob']); break;
      case 'slider': ref(el.control, ['slider']); break;
      case 'switch': ref(el.control, ['switch']); break;
      case 'button':
        if (el.control) {
          const c = controls[el.control];
          if (!c) err(`${where} references missing control "${el.control}"`);
          else {
            onPanel.add(el.control);
            if (el.setValue !== undefined) checkValue(c, el.setValue, `${where} setValue`, out);
            else if (c.type !== 'button') err(`${where} control "${el.control}" is a ${c.type}; non-radio buttons need a button control`);
          }
        } else if (!el.event) warn(`${where} has neither control nor event`);
        break;
      case 'stepgrid': if (typeof el.control === 'string') ref(el.control, ['pattern']); break;
      case 'jack':
        if (!jacks.has(el.jack)) err(`${where} references missing jack "${el.jack}"`);
        jacksOnPanel.set(el.jack, (jacksOnPanel.get(el.jack) ?? 0) + 1);
        break;
    }
  });
  jacks.forEach((_, j) => {
    const n = jacksOnPanel.get(j) ?? 0;
    if (n === 0) err(`jack "${j}" is in spec.patchBay but not on the panel`);
    if (n > 1) err(`jack "${j}" is placed ${n} times`);
  });
  // Evaluate encoder/step-grid bindings across every combination of UI-state switches
  const dynamic = layout.elements.filter(e => (e.kind === 'knob' || e.kind === 'stepgrid') && typeof e.control === 'function');
  const hasDynamic = dynamic.length > 0;
  if (hasDynamic) {
    const defaults: Record<string, ControlValue> = {};
    Object.entries(controls).forEach(([cid, c]) => { if ('default' in c && c.default !== undefined) defaults[cid] = c.default as ControlValue; });
    const axes = (mod.uiControls ?? [])
      .map(cid => controls[cid])
      .map((c, i) => {
        const cid = mod.uiControls![i];
        if (!c) return null;
        if (c.type === 'switch') return { cid, vals: c.options.map((_, k) => k) as ControlValue[] };
        if (c.type === 'button') return { cid, vals: [false, true] as ControlValue[] };
        if (c.type === 'knob' && c.step && (c.max - c.min) / c.step <= 32) {
          const vals: ControlValue[] = [];
          for (let v = c.min; v <= c.max + 1e-9; v += c.step) vals.push(+v.toFixed(6));
          return { cid, vals };
        }
        return null;
      })
      .filter((a): a is { cid: string; vals: ControlValue[] } => !!a);
    let combos: Record<string, ControlValue>[] = [{}];
    for (const a of axes) {
      const next: Record<string, ControlValue>[] = [];
      for (const c of combos) for (const v of a.vals) next.push({ ...c, [a.cid]: v });
      combos = next;
      if (combos.length > 50000) { warn('too many UI-state combinations to check every binding'); break; }
    }
    for (const combo of combos) {
      const ctx = { values: { ...defaults, ...combo }, engine: {} };
      for (const el of dynamic) {
        const fn = (el as { control: (c: typeof ctx) => string | null }).control;
        let cid: string | null = null;
        try { cid = fn(ctx); } catch (e) { err(`binding threw for ${JSON.stringify(combo)}: ${e}`); }
        if (cid === null || cid === undefined) continue;
        if (!controls[cid]) err(`binding returned unknown control "${cid}" for ${JSON.stringify(combo)}`);
        else onPanel.add(cid);
      }
    }
  }
  Object.entries(controls).forEach(([cid, c]) => {
    if (!onPanel.has(cid) && !ui.has(cid) && c.type !== 'pattern' && c.type !== 'jack') {
      (hasDynamic ? warn : err)(`control "${cid}" is not on the panel${hasDynamic ? ' and no encoder binding reaches it (fine only if a custom element edits it)' : ''}`);
    }
  });

  // Overlap check (control centres too close)
  const solid = layout.elements.filter(e => radius(e) !== null && e.kind !== 'led') as (PanelElement & { x: number; y: number })[];
  for (let a = 0; a < solid.length; a++) {
    for (let b = a + 1; b < solid.length; b++) {
      const ra = radius(solid[a])!, rb = radius(solid[b])!;
      const d = Math.hypot(solid[a].x - solid[b].x, solid[a].y - solid[b].y);
      if (d < (ra + rb) * 0.95) {
        const name = (e: PanelElement) => e.kind === 'jack' ? e.jack : e.kind === 'knob' && typeof e.control === 'string' ? e.control : e.kind === 'button' ? (e.control ?? e.event) : e.kind;
        warn(`overlap: ${solid[a].kind} ${name(solid[a])} and ${solid[b].kind} ${name(solid[b])} (${d.toFixed(1)}mm apart)`);
      }
    }
  }

  // Presets
  Object.entries(spec.presets ?? {}).forEach(([pid, p]) => {
    Object.entries(p.settings).forEach(([cid, v]) => {
      const c = controls[cid];
      if (!c) err(`preset ${pid}: unknown control "${cid}"`);
      else checkValue(c, v, `preset ${pid}.${cid}`, out);
    });
    p.patchConnections?.forEach(pc => {
      if (!jacks.has(pc.from)) err(`preset ${pid}: unknown jack "${pc.from}"`);
      if (!jacks.has(pc.to)) err(`preset ${pid}: unknown jack "${pc.to}"`);
    });
  });

  // Lessons
  const ids = new Set<string>();
  const defaults: Record<string, ControlValue> = {};
  Object.entries(controls).forEach(([cid, c]) => { if ('default' in c && c.default !== undefined) defaults[cid] = c.default as ControlValue; });
  // Mirrors the store's check state at the start of a step: nothing pressed, no notes played
  // yet (a check that reads `s.events.trigger` or `s.notesPlayed.length` must not throw here)
  const fakeState = (values: Record<string, ControlValue>): LessonCheckState => ({
    values, patches: [], data: mod.data?.initial(), engine: {},
    instances: { [id]: { device: id, values, patches: [], data: mod.data?.initial() } },
    studioCables: [], routes: {}, sync: {}, transport: { playing: false, bpm: 120 }, arrangement: { enabled: false, loop: true, sections: [] },
    events: {}, notesPlayed: [], eventsByInstance: {},
  });
  const checkValues = (vals: Record<string, ControlValue> | undefined, where: string) => {
    Object.entries(vals ?? {}).forEach(([cid, v]) => {
      const c = controls[cid];
      if (!c) err(`${where}: unknown control "${cid}"`);
      else checkValue(c, v, `${where}.${cid}`, out);
    });
  };
  const checkMC = (mc: MultipleChoice | undefined, where: string) => {
    if (!mc) return;
    if (!mc.question) err(`${where}: question missing`);
    if (!Array.isArray(mc.options) || mc.options.length < 2) err(`${where}: needs at least 2 options`);
    else if (!Number.isInteger(mc.answer) || mc.answer < 0 || mc.answer >= mc.options.length) err(`${where}: answer index ${mc.answer} out of range`);
    if (!mc.explain) warn(`${where}: no explain (say why the answer is right)`);
  };
  lessons.forEach((l: Lesson) => {
    const where = `lesson ${l.id}`;
    if (ids.has(l.id)) err(`${where}: duplicate id`);
    ids.add(l.id);
    if (l.device !== id) err(`${where}: device "${l.device}" should be "${id}"`);
    if (!l.steps.length) err(`${where}: no steps`);
    checkValues(l.start?.values, `${where} start`);
    (l.start?.patches ?? []).forEach(pc => {
      if (!jacks.has(pc.from) || !jacks.has(pc.to)) err(`${where} start: unknown jack in ${pc.from} -> ${pc.to}`);
    });
    l.review?.forEach((mc, i) => checkMC(mc, `${where} review[${i}]`));
    l.prerequisites?.forEach(pre => { if (!lessons.some(x => x.id === pre)) warn(`${where}: prerequisite "${pre}" is not a lesson on this device`); });

    const kinds = new Set<string>();
    l.steps.forEach((s, si) => {
      const sw = `${where} step ${si + 1}`;
      const kind = s.kind ?? (s.patchFrom && s.patchTo ? 'patch' : s.control ? 'do' : s.checklist?.length ? 'challenge' : 'info');
      kinds.add(kind);
      if (s.control) {
        const c = controls[s.control];
        if (!c) err(`${sw}: unknown control "${s.control}"`);
        else if (s.targetValue === undefined) err(`${sw}: control step without targetValue`);
        else checkValue(c, s.targetValue, sw, out);
      }
      if (s.patchFrom || s.patchTo) {
        if (!s.patchFrom || !s.patchTo) err(`${sw}: patch step needs patchFrom and patchTo`);
        if (s.patchFrom && !jacks.has(s.patchFrom)) err(`${sw}: unknown jack "${s.patchFrom}"`);
        if (s.patchTo && !jacks.has(s.patchTo)) err(`${sw}: unknown jack "${s.patchTo}"`);
        if (s.patchFrom && s.patchTo && jacks.get(s.patchFrom) === jacks.get(s.patchTo)) warn(`${sw}: patch connects two ${jacks.get(s.patchFrom)}s`);
      }
      checkValues(s.setup, `${sw} setup`);
      if (kind === 'predict') { if (!s.predict) err(`${sw}: predict step without predict`); checkMC(s.predict, `${sw} predict`); if (!s.control && !s.patchFrom && !s.check) warn(`${sw}: predict step has no action to test the prediction`); }
      if (kind === 'quiz') { if (!s.quiz) err(`${sw}: quiz step without quiz`); checkMC(s.quiz, `${sw} quiz`); }
      if (kind === 'listen') {
        if (!s.listen) err(`${sw}: listen step without listen`);
        else { checkValues(s.listen.a, `${sw} listen.a`); checkValues(s.listen.b, `${sw} listen.b`); checkMC(s.listen.question, `${sw} listen.question`); }
      }
      if (kind === 'match') {
        if (!s.match) err(`${sw}: match step without match`);
        else {
          checkValues(s.match.target, `${sw} match.target`);
          if (!s.match.controls.length) err(`${sw}: match needs at least one control`);
          s.match.controls.forEach(cid => {
            if (!controls[cid]) err(`${sw}: match control "${cid}" unknown`);
            if (s.match!.target[cid] === undefined) err(`${sw}: match control "${cid}" has no target value`);
          });
          if (s.match.controls.length > 3) warn(`${sw}: more than 3 controls in one ear challenge is very hard`);
        }
      }
      if (kind === 'reflect' && (!s.reflect?.prompt || !s.reflect?.model)) err(`${sw}: reflect needs prompt and model answer`);
      if (kind === 'challenge') {
        // Without a solution the coach can't "show me" and the lesson runner can't verify the step
        if (!s.solution) warn(`${sw}: challenge without solution`);
        if (!s.hints?.length) warn(`${sw}: challenge without hints`);
      }
      // Run custom checks against the default state to catch crashes
      const st = fakeState({ ...defaults });
      if (s.check) { try { s.check(st); } catch (e) { err(`${sw}: check() throws on the default state: ${e}`); } }
      s.checklist?.forEach((c, ci) => { if (c.check) { try { c.check(st); } catch (e) { err(`${sw}: checklist[${ci}] throws: ${e}`); } } });
      if (!s.principle && (kind === 'do' || kind === 'patch' || kind === 'predict')) warn(`${sw}: no principle`);
      if (s.instruction && s.instruction.split(/\s+/).length > 32) warn(`${sw}: instruction is long (${s.instruction.split(/\s+/).length} words)`);
    });
    // Pedagogy shape (docs/PEDAGOGY.md) - warnings only
    if (!l.id.startsWith(`${id}-`)) warn(`${where}: id should start with "${id}-"`);
    if (l.path && !(LESSON_PATHS as readonly string[]).includes(l.path)) err(`${where}: unknown path "${l.path}" (${LESSON_PATHS.join(', ')})`);
    if (lessonV2(l)) {
      if (!l.objective) warn(`${where}: no objective`);
      if (!l.path) warn(`${where}: no path (${LESSON_PATHS.join(', ')})`);
      if (!kinds.has('predict') && !kinds.has('listen')) warn(`${where}: no predict or listen step`);
      if (!kinds.has('quiz')) warn(`${where}: no quiz step`);
      if (!kinds.has('match') && !kinds.has('challenge')) warn(`${where}: no match or challenge step`);
      if ((l.review?.length ?? 0) < 3) warn(`${where}: fewer than 3 review questions`);
    }
  });
  if (lessons.length === 0) warn('no lessons');
  return out;
}

/**
 * Studio lessons (device 'studio'), the Producer path included. Beyond the shape checks, a
 * lesson with a whole-studio start state (Lesson API v3) is checked against the real
 * instruments: rack devices, every value, routes to real mixer inputs, cables between real
 * jacks, and each step's instrument, controls, A/B values, match targets and solutions.
 * Every check runs twice: on an empty studio and on the lesson's start studio.
 */
async function validateStudioLessons(lessons: Lesson[]): Promise<Issue[]> {
  const out: Issue[] = [];
  const err = (m: string) => out.push({ level: 'error', msg: m });
  const warn = (m: string) => out.push({ level: 'warn', msg: m });
  const empty: LessonCheckState = {
    values: {}, patches: [], data: undefined, engine: {}, instances: {}, studioCables: [], routes: {}, sync: {},
    transport: { playing: false, bpm: 120, swing: 0 }, arrangement: { enabled: false, loop: true, sections: [] },
    events: {}, notesPlayed: [], eventsByInstance: {},
  };
  // Device modules the lessons use, loaded once
  const mods = new Map<string, DeviceModule>();
  const modOf = async (device: string) => {
    if (mods.has(device)) return mods.get(device)!;
    const entry = DEVICES.find(d => d.id === device);
    if (!entry) return undefined;
    const m = (await entry.load()).default;
    mods.set(device, m);
    return m;
  };
  const defaultsOf = (m: DeviceModule) => {
    const d: Record<string, ControlValue> = {};
    Object.entries(m.spec.controls).forEach(([cid, c]) => { if ('default' in c && c.default !== undefined) d[cid] = c.default as ControlValue; });
    return d;
  };
  const checkVals = (m: DeviceModule | undefined, vals: Record<string, ControlValue> | undefined, where: string) => {
    if (!m || !vals) return;
    Object.entries(vals).forEach(([cid, v]) => {
      const c = m.spec.controls[cid];
      if (!c) err(`${where}: ${m.spec.id} has no control "${cid}"`);
      else checkValue(c, v, `${where}.${cid}`, out);
    });
  };
  const checkMC = (mc: MultipleChoice | undefined, where: string) => {
    if (!mc) return;
    if (!mc.question) err(`${where}: question missing`);
    if (!Array.isArray(mc.options) || mc.options.length < 2) err(`${where}: needs at least 2 options`);
    else if (!Number.isInteger(mc.answer) || mc.answer < 0 || mc.answer >= mc.options.length) err(`${where}: answer out of range`);
    if (!mc.explain) warn(`${where}: no explain (say why the answer is right)`);
  };
  const ids = new Set<string>();
  for (const l of lessons) {
    const where = `lesson ${l.id}`;
    if (ids.has(l.id)) err(`${where}: duplicate id`);
    ids.add(l.id);
    if (l.device !== 'studio') err(`${where}: device should be 'studio'`);
    if (l.path && !(LESSON_PATHS as readonly string[]).includes(l.path)) err(`${where}: unknown path "${l.path}" (${LESSON_PATHS.join(', ')})`);
    if (l.path === 'producer' && !l.id.startsWith('studio-producer-')) warn(`${where}: Producer path ids start with "studio-producer-"`);
    l.requires?.forEach(d => { if (!DEVICES.some(x => x.id === d)) err(`${where}: requires unknown device ${d}`); });
    l.prerequisites?.forEach(p => { if (!lessons.some(x => x.id === p)) warn(`${where}: prerequisite "${p}" is not a studio lesson`); });
    l.review?.forEach((mc, i) => checkMC(mc, `${where} review[${i}]`));

    // ---- the start studio ------------------------------------------------------
    const start = l.start?.studio;
    const rackMods = new Map<string, DeviceModule>();
    let startState: LessonCheckState | null = null;
    if (start) {
      const seen = new Set<string>();
      for (const r of start.rack) {
        if (seen.has(r.id)) err(`${where} start: instance "${r.id}" twice in the rack`);
        seen.add(r.id);
        const m = await modOf(r.device);
        if (!m) { err(`${where} start: unknown device "${r.device}"`); continue; }
        rackMods.set(r.id, m);
        checkVals(m, r.values, `${where} start ${r.id}`);
        const jacks = new Set([...(m.spec.patchBay?.inputs ?? []), ...(m.spec.patchBay?.outputs ?? [])].map(j => j.id));
        r.patches?.forEach(p => { if (!jacks.has(p.from) || !jacks.has(p.to)) err(`${where} start ${r.id}: unknown jack in ${p.from} -> ${p.to}`); });
      }
      const jackOf = (instId: string, jack: string, dir: 'input' | 'output') => {
        const m = rackMods.get(instId);
        const list = dir === 'input' ? m?.spec.patchBay?.inputs : m?.spec.patchBay?.outputs;
        return !!list?.some(j => j.id === jack);
      };
      start.cables?.forEach(c => {
        if (!rackMods.has(c.from.instance) || !rackMods.has(c.to.instance)) { err(`${where} start: cable between instruments not in the rack (${c.from.instance} -> ${c.to.instance})`); return; }
        const ok = (jackOf(c.from.instance, c.from.jack, 'output') && jackOf(c.to.instance, c.to.jack, 'input')) ||
          (jackOf(c.to.instance, c.to.jack, 'output') && jackOf(c.from.instance, c.from.jack, 'input'));
        if (!ok) err(`${where} start: cable ${c.from.instance}.${c.from.jack} -> ${c.to.instance}.${c.to.jack} doesn't join an output to an input`);
      });
      Object.entries(start.routes ?? {}).forEach(([instId, route]) => {
        if (!rackMods.has(instId)) err(`${where} start: route for "${instId}", which is not in the rack`);
        if (route === 'master') return;
        const [mixer, input] = route.split(':');
        const mm = rackMods.get(mixer);
        if (!mm) err(`${where} start: ${instId} routed to "${mixer}", which is not in the rack`);
        else if (!mm.studio?.mixerInputs?.some(i => i.id === input)) err(`${where} start: ${mixer} has no mixer input "${input}"`);
      });
      Object.keys(start.sync ?? {}).forEach(k => { if (!rackMods.has(k)) err(`${where} start: sync for "${k}", which is not in the rack`); });
      Object.keys(start.mixer?.channels ?? {}).forEach(k => { if (!rackMods.has(k)) err(`${where} start: mixer channel for "${k}", which is not in the rack`); });
      if (start.focus && !rackMods.has(start.focus)) err(`${where} start: focus "${start.focus}" is not in the rack`);
      start.arrangement?.sections.forEach((sec, si) => {
        if (!(sec.bars >= 1)) err(`${where} start: section ${si + 1} needs at least 1 bar`);
        Object.entries(sec.parts ?? {}).forEach(([k, p]) => {
          if (!rackMods.has(k)) { err(`${where} start: section "${sec.name}" has a part for "${k}", which is not in the rack`); return; }
          checkVals(rackMods.get(k), p.snapshot, `${where} start section "${sec.name}" ${k} snapshot`);
        });
      });
      // A check state of the start studio: every instrument at its defaults plus the start values
      const instances: LessonCheckState['instances'] = {};
      start.rack.forEach(r => {
        const m = rackMods.get(r.id);
        if (!m) return;
        const values = { ...defaultsOf(m), ...(r.values ?? {}) };
        instances[r.id] = { device: r.device, values, patches: r.patches ?? [], data: r.data ?? m.data?.initial() };
      });
      startState = {
        ...empty,
        instances,
        studioCables: (start.cables ?? []).map(c => ({ from: c.from, to: c.to })),
        routes: start.routes ?? {},
        sync: start.sync ?? {},
        transport: { playing: false, bpm: start.bpm ?? 120, swing: start.swing ?? 0 },
        arrangement: { enabled: !!start.arrangement?.enabled, loop: start.arrangement?.loop ?? true, sections: (start.arrangement?.sections ?? []).map(x => ({ name: x.name, bars: x.bars, parts: x.parts ?? {} })) },
      };
    }
    /** The module behind a step's instance (an instance id or a device name) */
    const stepMod = (instOrDev: string | undefined): DeviceModule | undefined => {
      if (!instOrDev) return undefined;
      if (rackMods.has(instOrDev)) return rackMods.get(instOrDev);
      return [...rackMods.values()].find(m => m.spec.id === instOrDev) ?? mods.get(instOrDev);
    };

    // ---- steps ------------------------------------------------------------------
    const kinds = new Set<string>();
    for (const [i, s] of l.steps.entries()) {
      const w = `${where} step ${i + 1}`;
      const kind = s.kind ?? (s.patchFrom && s.patchTo ? 'patch' : s.control ? 'do' : s.checklist?.length ? 'challenge' : 'info');
      kinds.add(kind);
      [s.predict, s.quiz, s.listen?.question].forEach((mc, k) => checkMC(mc, `${w} ${['predict', 'quiz', 'listen.question'][k]}`));
      if (kind === 'predict' && !s.predict) err(`${w}: predict step without predict`);
      if (kind === 'quiz' && !s.quiz) err(`${w}: quiz step without quiz`);
      if (kind === 'listen' && !s.listen) err(`${w}: listen step without listen`);
      if (kind === 'match' && !s.match) err(`${w}: match step without match`);
      if (kind === 'reflect' && (!s.reflect?.prompt || !s.reflect?.model)) err(`${w}: reflect needs prompt and model`);
      if (start) {
        // Steps act on the start studio's instruments
        if (s.instance && !stepMod(s.instance)) err(`${w}: instance "${s.instance}" is not in the start studio`);
        const m = stepMod(s.instance ?? start.focus ?? start.rack[0]?.id);
        if (s.control) {
          const c = m?.spec.controls[s.control];
          if (!c) err(`${w}: ${m?.spec.id ?? 'instrument'} has no control "${s.control}"`);
          else if (s.targetValue === undefined) err(`${w}: control step without targetValue`);
          else checkValue(c, s.targetValue, w, out);
        }
        checkVals(m, s.setup, `${w} setup`);
        if (s.listen) {
          checkVals(m, s.listen.a, `${w} listen.a`);
          checkVals(m, s.listen.b, `${w} listen.b`);
          (['a', 'b'] as const).forEach(side => Object.entries(s.listen!.parts?.[side] ?? {}).forEach(([k, v]) => {
            const pm = stepMod(k);
            if (!pm) err(`${w}: listen.parts.${side} names "${k}", which is not in the start studio`);
            checkVals(pm, v, `${w} listen.parts.${side}.${k}`);
          }));
        }
        if (s.match) {
          checkVals(m, s.match.target, `${w} match.target`);
          if (!s.match.controls.length) err(`${w}: match needs at least one control`);
          s.match.controls.forEach(cid => { if (s.match!.target[cid] === undefined) err(`${w}: match control "${cid}" has no target value`); });
          if (s.match.controls.length > 3) warn(`${w}: more than 3 controls in one ear challenge is very hard`);
        }
        if (s.solution) {
          const sm = stepMod(s.solution.instance ?? s.instance ?? start.focus);
          checkVals(sm, s.solution.values, `${w} solution.values`);
          Object.entries(s.solution.parts ?? {}).forEach(([k, v]) => {
            const pm = stepMod(k);
            if (!pm) err(`${w}: solution.parts names "${k}", which is not in the start studio`);
            checkVals(pm, v, `${w} solution.parts.${k}`);
          });
          s.solution.capture?.forEach(c => { if (!stepMod(c.instance)) err(`${w}: solution.capture names "${c.instance}", which is not in the start studio`); });
        }
      }
      if (kind === 'challenge') {
        if (!s.solution) warn(`${w}: challenge without solution`);
        if (!s.hints?.length) warn(`${w}: challenge without hints`);
      }
      if (!s.principle && (kind === 'do' || kind === 'patch' || kind === 'predict')) warn(`${w}: no principle`);
      if (s.instruction && s.instruction.split(/\s+/).length > 32) warn(`${w}: instruction is long (${s.instruction.split(/\s+/).length} words)`);
      // Every check must survive an empty studio and the start studio
      for (const [label, st] of [['an empty studio', empty], ['the start studio', startState]] as const) {
        if (!st) continue;
        try { s.check?.(st); } catch (e) { err(`${w}: check() throws on ${label}: ${e}`); }
        s.checklist?.forEach((c, ci) => { try { c.check?.(st); } catch (e) { err(`${w}: checklist[${ci}] throws on ${label}: ${e}`); } });
      }
      // A step already done at the start teaches nothing (except steps that only ask for Play)
      if (startState && (kind === 'challenge' || kind === 'do' || kind === 'predict') && (s.check || s.checklist?.length) && !s.control) {
        let done = true;
        try {
          if (s.check && !s.check(startState)) done = false;
          if (s.checklist?.some(c => c.check && !c.check(startState!))) done = false;
        } catch { done = false; }
        if (done && i > 0 && !isPlayOnly(s)) warn(`${w}: already satisfied by the start studio`);
      }
    }
    // Pedagogy shape (docs/PEDAGOGY.md) - warnings only
    if (l.objective || l.steps.some(s => !!s.kind)) {
      if (!l.objective) warn(`${where}: no objective`);
      if (!l.path) warn(`${where}: no path`);
      if (!kinds.has('predict') && !kinds.has('listen')) warn(`${where}: no predict or listen step`);
      if (!kinds.has('quiz')) warn(`${where}: no quiz step`);
      if (!kinds.has('match') && !kinds.has('challenge')) warn(`${where}: no match or challenge step`);
      if ((l.review?.length ?? 0) < 3) warn(`${where}: fewer than 3 review questions`);
    }
  }
  return out;
}

/** A step whose only check is "the transport is playing" (fine to be done already) */
function isPlayOnly(s: LessonStep): boolean {
  return !!s.solution?.transport && !s.checklist?.length;
}

(async () => {
  const only = process.argv.slice(2);
  let errors = 0;
  if (!only.length || only.includes('studio') || only.includes('producer')) {
    const { STUDIO_LESSONS } = await import('../lib/studio/lessons');
    const { PRODUCER_LESSONS } = await import('../lib/studio/producerLessons');
    const { PRODUCER_LESSON_IDS } = await import('../lib/studio/producerIndex');
    const all = [...STUDIO_LESSONS, ...PRODUCER_LESSONS];
    const issues = await validateStudioLessons(all);
    // The id list the app knows up front must match the lessons that load on demand
    const listed = [...PRODUCER_LESSON_IDS].sort().join(',');
    const actual = PRODUCER_LESSONS.map(l => l.id).sort().join(',');
    if (listed !== actual) issues.push({ level: 'error', msg: `producerIndex.ts PRODUCER_LESSON_IDS (${listed}) differ from producerLessons.ts (${actual})` });
    PRODUCER_LESSONS.forEach(l => { if (l.path !== 'producer') issues.push({ level: 'error', msg: `lesson ${l.id}: Producer path lessons need path 'producer'` }); });
    STUDIO_LESSONS.forEach(l => { if (l.path === 'producer') issues.push({ level: 'error', msg: `lesson ${l.id}: Producer path lessons belong in producerLessons.ts (they load on demand)` }); });
    const e = issues.filter(i => i.level === 'error');
    errors += e.length;
    console.log(`\nstudio lessons: ${STUDIO_LESSONS.length} studio + ${PRODUCER_LESSONS.length} Producer path — ${e.length} errors, ${issues.length - e.length} warnings`);
    const byPath = all.reduce((m: Record<string, number>, l) => ({ ...m, [l.path ?? 'none']: (m[l.path ?? 'none'] ?? 0) + 1 }), {});
    console.log(`  lessons by path: ${Object.entries(byPath).map(([k, n]) => `${k} ${n}`).join(', ')}`);
    issues.forEach(i => console.log(`  ${i.level === 'error' ? 'ERROR' : 'warn '} ${i.msg}`));
  }
  for (const entry of DEVICES) {
    if (only.length && !only.includes(entry.id)) continue;
    const mod = (await entry.load()).default;
    const issues = validate(entry.id, mod);
    const e = issues.filter(i => i.level === 'error');
    const w = issues.filter(i => i.level === 'warn');
    errors += e.length;
    console.log(`\n${entry.id}: ${Object.keys(mod.spec.controls).length} controls, ${mod.layout.elements.length} elements, ${mod.lessons.length} lessons, ${Object.keys(mod.spec.presets ?? {}).length} presets — ${e.length} errors, ${w.length} warnings`);
    const byPath = mod.lessons.reduce((m: Record<string, number>, l: Lesson) => ({ ...m, [l.path ?? 'none']: (m[l.path ?? 'none'] ?? 0) + 1 }), {});
    if (mod.lessons.length) console.log(`  lessons by path: ${Object.entries(byPath).map(([k, n]) => `${k} ${n}`).join(', ')}`);
    e.forEach(i => console.log(`  ERROR ${i.msg}`));
    w.slice(0, 40).forEach(i => console.log(`  warn  ${i.msg}`));
    if (w.length > 40) console.log(`  ... ${w.length - 40} more warnings`);
  }
  process.exit(errors ? 1 : 0);
})();
