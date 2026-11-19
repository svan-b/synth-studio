// ============================================================================
// Signal path diagram: which block a control belongs to, and what a block lights
//
// The small part of the diagram's code that an instrument's page always needs
// (the toolbar button, the spotlight, "you are here"). The drawing itself is in
// lib/signalPath.ts and loads with the diagram, when the learner opens it.
// ============================================================================

import type { SignalFlowSection } from '@/types';

/** The sections that are blocks of the diagram */
export function pathSections(flow: SignalFlowSection[]): SignalFlowSection[] {
  return flow.filter(s => !!s.at);
}

const matchers = new WeakMap<SignalFlowSection, RegExp | null>();
function matcherOf(s: SignalFlowSection): RegExp | null {
  if (!matchers.has(s)) {
    let re: RegExp | null = null;
    if (s.match) { try { re = new RegExp(s.match); } catch { re = null; } }
    matchers.set(s, re);
  }
  return matchers.get(s) ?? null;
}

/** The block a control or jack id belongs to (the first that lists it, else the first whose `match` fits) */
export function blockOfControl(flow: SignalFlowSection[], id: string | null | undefined): string | null {
  if (!id) return null;
  const blocks = pathSections(flow);
  const own = blocks.find(s => s.controls.includes(id) || s.jacks?.includes(id) || s.panel?.includes(id));
  if (own) return own.id;
  return blocks.find(s => matcherOf(s)?.test(id))?.id ?? null;
}

/**
 * The panel ids of a block: its controls, its patch points and anything else it names. With
 * `allControls` (every control id of the device) the same block on other tracks is included,
 * so an Elektron's knobs light up whichever track is active.
 */
export function blockTargets(s: SignalFlowSection, allControls?: string[]): string[] {
  const out = [...s.controls, ...(s.jacks ?? []), ...(s.panel ?? [])];
  const re = allControls ? matcherOf(s) : null;
  if (re && allControls) allControls.forEach(id => { if (re.test(id)) out.push(id); });
  return out;
}

/** The words of a block on one line */
export const blockLabel = (s: SignalFlowSection) => (s.label ?? s.name).replace(/\s*\n\s*/g, ' ');

/** How a block is wired, in words: what feeds it, what it feeds, what moves it, what it moves */
export function blockLinks(flow: SignalFlowSection[], id: string): { label: string; text: string }[] {
  const blocks = pathSections(flow);
  const name = (b: string) => { const s = blocks.find(x => x.id === b); return s ? blockLabel(s) : b; };
  const me = blocks.find(s => s.id === id);
  if (!me) return [];
  const out: { label: string; text: string }[] = [];
  const from = blocks.filter(s => s.to?.includes(id)).map(s => name(s.id));
  if (from.length) out.push({ label: 'From', text: from.join(', ') });
  if (me.to?.length) out.push({ label: 'To', text: me.to.map(t => (t.startsWith('>') ? t.slice(1) : name(t))).join(', ') });
  const by = blocks.flatMap(s => (s.mods ?? []).filter(m => m.to === id).map(m => `${name(s.id)} (${m.what})`));
  if (by.length) out.push({ label: 'Moved by', text: by.join(', ') });
  if (me.mods?.length) out.push({ label: 'Moves', text: me.mods.map(m => (m.to === '*' ? m.what : `${name(m.to)} (${m.what})`)).join(', ') });
  return out;
}
