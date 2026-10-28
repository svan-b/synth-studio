// ============================================================================
// Device data validator:  npm run validate [deviceId...]
// Checks specs, layouts, presets and lessons for the mistakes that break
// lessons or the panel at runtime. Exits non-zero on errors.
// ============================================================================

import type { ControlSpec, ControlValue, Lesson } from '../types';
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
  const hasDynamic = layout.elements.some(e => (e.kind === 'knob' || e.kind === 'stepgrid') && typeof e.control === 'function');
  Object.entries(controls).forEach(([cid, c]) => {
    if (!onPanel.has(cid) && !ui.has(cid) && c.type !== 'pattern' && c.type !== 'jack') {
      (hasDynamic ? warn : err)(`control "${cid}" is not placed on the panel${hasDynamic ? ' (fine if an encoder binding reaches it)' : ''}`);
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
  lessons.forEach((l: Lesson) => {
    const where = `lesson ${l.id}`;
    if (ids.has(l.id)) err(`${where}: duplicate id`);
    ids.add(l.id);
    if (l.device !== id) err(`${where}: device "${l.device}" should be "${id}"`);
    if (!l.steps.length) err(`${where}: no steps`);
    l.steps.forEach((s, si) => {
      const sw = `${where} step ${si + 1}`;
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
      if (!s.principle) warn(`${sw}: no principle`);
    });
  });
  if (lessons.length === 0) warn('no lessons');
  return out;
}

(async () => {
  const only = process.argv.slice(2);
  let errors = 0;
  for (const entry of DEVICES) {
    if (only.length && !only.includes(entry.id)) continue;
    const mod = (await entry.load()).default;
    const issues = validate(entry.id, mod);
    const e = issues.filter(i => i.level === 'error');
    const w = issues.filter(i => i.level === 'warn');
    errors += e.length;
    console.log(`\n${entry.id}: ${Object.keys(mod.spec.controls).length} controls, ${mod.layout.elements.length} elements, ${mod.lessons.length} lessons, ${Object.keys(mod.spec.presets ?? {}).length} presets — ${e.length} errors, ${w.length} warnings`);
    e.forEach(i => console.log(`  ERROR ${i.msg}`));
    w.slice(0, 40).forEach(i => console.log(`  warn  ${i.msg}`));
    if (w.length > 40) console.log(`  ... ${w.length - 40} more warnings`);
  }
  process.exit(errors ? 1 : 0);
})();
