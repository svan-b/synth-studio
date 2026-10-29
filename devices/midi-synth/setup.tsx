'use client';

// ============================================================================
// Setup dialog for "Your synth (MIDI)", in the order you set up real gear:
//   1. Where the MIDI goes - name, output (a real port or the Practice synth),
//      channel (with a warning when another synth already uses it), clock
//   2. Template - midi.guide CC maps: search, or browse by manufacturer
//   3. Knobs - label, CC, range, 14-bit LSB; "Learn" takes the CC from a knob
//      you turn on the synth
//   4. Program change (bank select) and timing
// Edits a draft; Save commits it.
// ============================================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { midi } from '@/lib/midi/access';
import { useMidiSnapshot } from '@/lib/midi';
import { parseMidi } from '@/lib/midi/bytes';
import { PARTS } from '@/lib/midi/practice-core';
import { GUIDE_ATTRIBUTION, GUIDE_BASE, type GuideDevice, type GuideIndexEntry } from './guide';
import { byManufacturer, groupResults, loadGuideDevice, loadGuideIndex, manufacturers, searchGuide } from './templates';
import {
  GENERIC_KNOBS, MAX_KNOBS, PRACTICE_KNOBS, PRACTICE_PORT, applyTemplate, channelClashes, freeChannel, isPractice, knobCandidates, sanitizeKnob,
  type CcKnob, type MidiSynthData, type SynthUse,
} from './config';

interface Props {
  instance: string;
  data: MidiSynthData;
  /** Every "Your synth" in the studio (channel clashes) */
  uses: SynthUse[];
  onSave: (d: MidiSynthData) => void;
  onClose: () => void;
}

const input = 'bg-[#141414] border border-[#3a3a3a] rounded px-2.5 text-sm text-white min-w-0 min-h-[44px]';
const small = 'bg-[#141414] border border-[#3a3a3a] rounded px-1.5 text-xs text-white w-full min-w-0 font-mono min-h-[40px]';
const button = 'px-3 min-h-[44px] rounded bg-[#333] text-xs font-bold disabled:opacity-40';
const NONE = '';
const SAVED = '__saved';

/** CCs that belong to protocols: never taken by Learn */
const PROTOCOL_CC = new Set([0, 6, 32, 38, 96, 97, 98, 99, 100, 101, 120, 121, 122, 123, 124, 125, 126, 127]);

export default function SetupDialog({ instance, data, uses, onSave, onClose }: Props) {
  const [draft, setDraft] = useState<MidiSynthData>(() => structuredClone(data));
  const [learning, setLearning] = useState<number | null>(null);
  const snap = useMidiSnapshot();
  const set = (patch: Partial<MidiSynthData>) => setDraft(d => ({ ...d, ...patch }));
  const setKnob = (i: number, patch: Partial<CcKnob>) =>
    setDraft(d => ({ ...d, knobs: d.knobs.map((k, j) => (j === i ? { ...k, ...patch } : k)) }));

  const save = () => {
    const knobs = draft.knobs.map(k => sanitizeKnob(k)).filter((k): k is CcKnob => !!k).slice(0, MAX_KNOBS);
    onSave({ ...draft, name: draft.name.trim() || 'My synth', knobs });
  };

  const real = snap.outputs.filter(o => !o.virtual);
  const midiReady = snap.support.supported && snap.status === 'ready';
  const practice = isPractice(draft.port);
  const found = draft.port && !practice ? real.find(o => o.id === draft.port!.id) ?? real.find(o => o.name === draft.port!.name) : undefined;
  const portValue = !draft.port ? NONE : practice ? PRACTICE_PORT.id : found?.id ?? SAVED;
  const clashes = channelClashes(instance, draft.port, draft.channel, uses);
  const free = freeChannel(instance, draft.port, uses);
  const part = practice ? PARTS.find(p => p.channel === draft.channel) : undefined;

  return (
    <Dialog.Root open onOpenChange={o => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40" />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-hardware-panel border-2 border-[#3a3a3a] rounded-lg p-4 sm:p-5 w-[calc(100%-1.5rem)] max-w-3xl shadow-2xl z-50 max-h-[92vh] overflow-y-auto text-white"
          aria-describedby="midi-synth-setup-desc"
          // Don't jump into the Name field: on iPad that pops up the keyboard over the dialog
          onOpenAutoFocus={e => { e.preventDefault(); (e.currentTarget as HTMLElement | null)?.focus?.(); }}
        >
          <Dialog.Title className="text-lg font-bold">Set up your synth</Dialog.Title>
          <p id="midi-synth-setup-desc" className="text-xs text-hardware-label mb-4">
            Choose where the MIDI goes, then pick a template (or type CC numbers from your synth&apos;s manual).
          </p>

          {/* ---- 1. Where the MIDI goes ------------------------------------------ */}
          <SectionTitle n={1}>Where the MIDI goes</SectionTitle>
          <section className="grid sm:grid-cols-2 gap-3 mb-5">
            <label className="flex flex-col gap-1 text-xs text-gray-300">
              Name <span className="text-[10px] text-gray-500">(also its name in the studio rack and menus)</span>
              <input className={input} value={draft.name} maxLength={40} onChange={e => set({ name: e.target.value })} />
            </label>
            <div className="flex flex-col gap-1 text-xs text-gray-300">
              MIDI output
              <div className="flex items-center gap-2">
                <select
                  className={`${input} flex-1`}
                  value={portValue}
                  onChange={e => {
                    const v = e.target.value;
                    if (v === NONE) set({ port: null });
                    else if (v === PRACTICE_PORT.id) set({ port: { ...PRACTICE_PORT } });
                    else if (v !== SAVED) {
                      const o = real.find(x => x.id === v);
                      if (o) set({ port: { id: o.id, name: o.name } });
                    }
                  }}
                  aria-label="MIDI output port"
                >
                  <option value={NONE}>- none (silent) -</option>
                  <optgroup label="Built in">
                    <option value={PRACTICE_PORT.id}>Practice synth (built in)</option>
                  </optgroup>
                  {(real.length > 0 || portValue === SAVED) && (
                    <optgroup label="Your MIDI outputs">
                      {portValue === SAVED && draft.port && <option value={SAVED}>{draft.port.name} (not connected)</option>}
                      {real.map(o => <option key={o.id} value={o.id}>{o.name}{o.state === 'disconnected' ? ' (disconnected)' : ''}</option>)}
                    </optgroup>
                  )}
                </select>
                {snap.support.supported && snap.status !== 'ready' && (
                  <button onClick={() => void midi.request()} className="px-3 min-h-[44px] rounded bg-teal-400 text-black font-bold text-xs shrink-0">
                    {snap.status === 'requesting' ? 'Waiting…' : snap.status === 'denied' ? 'Try again' : 'Enable MIDI'}
                  </button>
                )}
              </div>
              <OutputHelp snap={snap} practice={practice} midiReady={midiReady} realCount={real.length} />
            </div>

            <label className="flex flex-col gap-1 text-xs text-gray-300">
              Channel
              <select className={input} value={draft.channel} onChange={e => set({ channel: Number(e.target.value) })} aria-label="MIDI channel">
                {Array.from({ length: 16 }, (_, i) => {
                  const used = channelClashes(instance, draft.port, i, uses);
                  const p = practice ? PARTS.find(x => x.channel === i) : undefined;
                  return (
                    <option key={i} value={i}>
                      Channel {i + 1}{p ? ` - ${p.name} part` : ''}{used.length ? ` - used by ${used[0].name}` : ''}
                    </option>
                  );
                })}
              </select>
              {clashes.length ? (
                <span className="text-[11px] text-amber-300 leading-snug">
                  {clashes.map(c => c.name).join(', ')} already sends on this output and channel, so both would play the same part.
                  {free !== draft.channel && (
                    <> <button className="underline font-bold" onClick={e => { e.preventDefault(); set({ channel: free }); }}>Use channel {free + 1}</button> instead.</>
                  )}
                </span>
              ) : (
                <span className="text-[10px] text-gray-500 leading-snug">
                  {practice
                    ? part ? `The Practice synth plays its ${part.name.toLowerCase()} part on this channel.` : 'Nothing on the Practice synth listens here: its parts are on 1, 2 and 10.'
                    : 'Set the same receive channel on your synth (often in its MIDI or Global menu). Most synths listen on 1 out of the box.'}
                </span>
              )}
            </label>

            <label className="flex items-start gap-2.5 text-xs text-gray-200 rounded border border-[#333] bg-[#1b1b1b] p-2.5 cursor-pointer">
              <input type="checkbox" checked={draft.clock} onChange={e => set({ clock: e.target.checked })} className="mt-0.5 w-5 h-5 accent-teal-400 shrink-0" aria-label="Send MIDI clock to this synth" />
              <span className="leading-snug">
                <b>Send MIDI clock to this synth</b>
                <span className="block text-[11px] text-gray-400">
                  24 pulses per beat with Start and Stop, so its arpeggiator, sequencer and synced LFOs follow the studio. Set the synth to external or auto clock.
                </span>
              </span>
            </label>
          </section>

          {/* ---- 2. Template ------------------------------------------------------ */}
          <SectionTitle n={2}>Template</SectionTitle>
          <TemplatePicker draft={draft} onApply={d => setDraft(d)} />

          {/* ---- 3. Knobs ---------------------------------------------------------- */}
          <section className="mb-5">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <SectionTitle n={3} inline>Knobs <span className="text-gray-500 font-normal">({draft.knobs.length}/{MAX_KNOBS})</span></SectionTitle>
              <div className="ml-auto flex flex-wrap gap-2">
                <button onClick={() => set({ knobs: PRACTICE_KNOBS.map(k => ({ ...k })), template: null })} className={button} title="Every control the Practice synth has">Practice synth</button>
                <button onClick={() => set({ knobs: GENERIC_KNOBS.map(k => ({ ...k })), template: null })} className={button} title="General MIDI sound controllers (CC 7, 71-77) - many synths follow them">Generic</button>
                <button
                  onClick={() => set({ knobs: [...draft.knobs, { label: `CC ${nextFreeCc(draft.knobs)}`, cc: nextFreeCc(draft.knobs), min: 0, max: 127 }] })}
                  disabled={draft.knobs.length >= MAX_KNOBS}
                  className={button}
                >
                  + Add knob
                </button>
              </div>
            </div>
            {midiReady && (
              <p className="text-[11px] text-gray-400 mb-2 leading-snug">
                <b className="text-gray-200">Learn</b>: press it, then turn that knob on your synth. Most synths send a CC when you turn a knob
                (check its MIDI menu: &quot;CC out&quot; or &quot;Local&quot;). A second CC 32 numbers higher is taken as the 14-bit LSB.
              </p>
            )}
            <div className="grid grid-cols-[1.6rem_minmax(0,3fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto_2.75rem] gap-1 items-center text-[10px] text-gray-400 mb-1 px-0.5">
              <span>#</span><span>Label</span><span>CC</span><span>Min</span><span>Max</span><span title="14-bit controllers: the LSB CC number (often CC + 32)">LSB</span><span>{midiReady ? 'Learn' : ''}</span><span />
            </div>
            <div className="space-y-1">
              {draft.knobs.map((k, i) => (
                <div key={i} className="grid grid-cols-[1.6rem_minmax(0,3fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto_2.75rem] gap-1 items-center">
                  <span className="text-[10px] text-gray-500 text-center">{i + 1}</span>
                  <input className={small} value={k.label} maxLength={24} onChange={e => setKnob(i, { label: e.target.value })} aria-label={`Knob ${i + 1} label`} />
                  <NumberCell value={k.cc} onChange={cc => setKnob(i, { cc })} label={`Knob ${i + 1} CC number`} />
                  <NumberCell value={k.min} onChange={min => setKnob(i, { min })} label={`Knob ${i + 1} minimum`} />
                  <NumberCell value={k.max} onChange={max => setKnob(i, { max })} label={`Knob ${i + 1} maximum`} />
                  <NumberCell value={k.lsb} optional onChange={lsb => setKnob(i, { lsb })} label={`Knob ${i + 1} LSB CC`} />
                  {midiReady ? (
                    <LearnButton
                      active={learning === i}
                      onToggle={() => setLearning(l => (l === i ? null : i))}
                      onLearn={(cc, lsb) => { setKnob(i, { cc, lsb }); setLearning(null); }}
                      label={`Learn the CC for knob ${i + 1} from your synth`}
                    />
                  ) : <span />}
                  <button
                    onClick={() => set({ knobs: draft.knobs.filter((_, j) => j !== i) })}
                    className="h-10 rounded bg-[#3a2323] text-red-300 text-xs" aria-label={`Remove knob ${i + 1}`}
                  >
                    ✕
                  </button>
                </div>
              ))}
              {!draft.knobs.length && <p className="text-xs text-gray-500">No knobs. Add some, or pick a template above.</p>}
            </div>
          </section>

          {/* ---- 4. Program change and timing -------------------------------------- */}
          <SectionTitle n={4}>Program change and timing</SectionTitle>
          <section className="grid sm:grid-cols-3 gap-3 mb-4">
            <BankField label="Bank select MSB (CC 0)" value={draft.bank.msb} onChange={msb => set({ bank: { ...draft.bank, msb } })} />
            <BankField label="Bank select LSB (CC 32)" value={draft.bank.lsb} onChange={lsb => set({ bank: { ...draft.bank, lsb } })} />
            <label className="flex flex-col gap-1 text-xs text-gray-300">
              Timing trim (ms)
              <input
                type="number" className={input} value={draft.offsetMs} min={-200} max={200} step={1}
                onChange={e => set({ offsetMs: Math.max(-200, Math.min(200, Number(e.target.value) || 0)) })}
              />
            </label>
            <p className="sm:col-span-3 text-[10px] text-gray-500 leading-snug -mt-1">
              Bank select is sent before each program change; leave it blank if your synth has one bank (check its MIDI chart).
              Timing trim: + plays later, − earlier. Most synths need 0; slow-responding ones a few ms negative.
            </p>
          </section>

          <footer className="flex flex-wrap items-center gap-2 pt-3 border-t border-[#3a3a3a]">
            <p className="text-[10px] text-gray-500 flex-1 min-w-[12rem] leading-snug">
              {GUIDE_ATTRIBUTION}.{' '}
              <a href={`${GUIDE_BASE}/LICENSE.md`} target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-300">License &amp; attribution</a>
              {' · '}
              <a href="https://midi.guide" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-300">midi.guide</a>
            </p>
            <Dialog.Close asChild><button className="px-4 min-h-[44px] bg-[#3a3a3a] rounded text-sm">Cancel</button></Dialog.Close>
            <button onClick={save} className="px-5 min-h-[44px] bg-teal-400 text-black font-bold rounded text-sm">Save</button>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function SectionTitle({ n, children, inline }: { n: number; children: React.ReactNode; inline?: boolean }) {
  return (
    <h3 className={`text-sm font-bold flex items-center gap-2 ${inline ? '' : 'mb-2'}`}>
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-teal-400 text-black text-[11px]">{n}</span>
      {children}
    </h3>
  );
}

/** What this output choice means, in plain words, for this browser */
function OutputHelp({ snap, practice, midiReady, realCount }: { snap: ReturnType<typeof useMidiSnapshot>; practice: boolean; midiReady: boolean; realCount: number }) {
  if (!snap.support.supported) {
    return (
      <div className="text-[11px] leading-snug rounded border border-amber-800/60 bg-amber-950/30 p-2 text-amber-100" role="note">
        <p>{snap.support.message || 'This browser has no Web MIDI.'}</p>
        <p className="mt-1 text-amber-200/80">
          The <b>Practice synth</b> works here, so you can learn every step. Your own synth: play it by hand and record it with <b>Audio input</b>,
          or use Chrome or Edge on a computer for MIDI.
        </p>
      </div>
    );
  }
  if (!midiReady) {
    return <span className="text-[11px] text-gray-400 leading-snug">{snap.error ?? 'Enable MIDI to list your synths (the browser asks for permission once). The Practice synth works without it.'}</span>;
  }
  if (!realCount) {
    return <span className="text-[11px] text-amber-300 leading-snug">No MIDI outputs found. Plug in your synth or MIDI interface: it appears here by itself.</span>;
  }
  if (practice) return <span className="text-[10px] text-gray-500 leading-snug">The Practice synth is built in: a synth at the end of a virtual MIDI cable.</span>;
  return <span className="text-[10px] text-gray-500 leading-snug">USB synths show their own name; 5-pin DIN synths show the MIDI interface&apos;s port.</span>;
}

function nextFreeCc(knobs: CcKnob[]): number {
  const used = new Set(knobs.map(k => k.cc));
  for (let cc = 14; cc < 120; cc++) if (!used.has(cc) && ![32, 38, 64, 65, 66, 67, 98, 99, 100, 101].includes(cc)) return cc;
  return 1;
}

function NumberCell({ value, onChange, label, optional }: { value: number | undefined; onChange: (v: number | undefined) => void; label: string; optional?: boolean }) {
  const [text, setText] = useState(value === undefined ? '' : String(value));
  useEffect(() => { setText(value === undefined ? '' : String(value)); }, [value]);
  return (
    <input
      className={small}
      inputMode="numeric"
      value={text}
      placeholder={optional ? '-' : undefined}
      aria-label={label}
      onChange={e => {
        const t = e.target.value.replace(/[^0-9]/g, '').slice(0, 3);
        setText(t);
        if (t === '') { if (optional) onChange(undefined); return; }
        onChange(Math.max(0, Math.min(127, Number(t))));
      }}
    />
  );
}

function BankField({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  const [text, setText] = useState(value === null ? '' : String(value));
  useEffect(() => { setText(value === null ? '' : String(value)); }, [value]);
  return (
    <label className="flex flex-col gap-1 text-xs text-gray-300">
      {label}
      <input
        className={input}
        inputMode="numeric"
        value={text}
        placeholder="not sent"
        onChange={e => {
          const t = e.target.value.replace(/[^0-9]/g, '').slice(0, 3);
          setText(t);
          onChange(t === '' ? null : Math.max(0, Math.min(127, Number(t))));
        }}
      />
    </label>
  );
}

/** Take a knob's CC number from the next CC your synth (or controller) sends */
function LearnButton({ active, onToggle, onLearn, label }: { active: boolean; onToggle: () => void; onLearn: (cc: number, lsb?: number) => void; label: string }) {
  const cb = useRef({ onToggle, onLearn });
  cb.current = { onToggle, onLearn };
  useEffect(() => {
    if (!active) return;
    let first: { cc: number; at: number } | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let done = false;
    const finish = (lsb?: number) => {
      if (timer) clearTimeout(timer);
      if (first && !done) { done = true; cb.current.onLearn(first.cc, lsb); }
    };
    const off = midi.onMessage(m => {
      const msg = parseMidi(m.data);
      if (!msg || msg.type !== 'cc' || PROTOCOL_CC.has(msg.cc)) return;
      if (!first) {
        first = { cc: msg.cc, at: m.timeStamp };
        // Wait a moment for a 14-bit LSB (CC + 32)
        timer = setTimeout(() => finish(), 40);
      } else if (msg.cc === first.cc + 32) {
        finish(msg.cc);
      }
    });
    const giveUp = setTimeout(() => cb.current.onToggle(), 15000);
    return () => { off(); if (timer) clearTimeout(timer); clearTimeout(giveUp); };
  }, [active]);
  return (
    <button
      onClick={onToggle}
      className={`h-10 px-2 rounded text-[11px] font-bold ${active ? 'bg-sky-500 text-black animate-pulse motion-reduce:animate-none' : 'bg-[#1e3a50] text-sky-200'}`}
      aria-pressed={active}
      aria-label={label}
      title={active ? 'Turn a knob on your synth now (press again to cancel)' : label}
    >
      {active ? 'Turn it…' : 'Learn'}
    </button>
  );
}

// ----------------------------------------------------------------------------
// midi.guide template picker: search, browse by manufacturer, pick knobs
// ----------------------------------------------------------------------------

type Browse = { mode: 'search' } | { mode: 'makers' } | { mode: 'maker'; name: string };

function TemplatePicker({ draft, onApply }: { draft: MidiSynthData; onApply: (d: MidiSynthData) => void }) {
  const [entries, setEntries] = useState<GuideIndexEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [browse, setBrowse] = useState<Browse>({ mode: 'search' });
  const [device, setDevice] = useState<GuideDevice | null>(null);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<Set<number>>(new Set());

  useEffect(() => {
    let alive = true;
    loadGuideIndex().then(i => alive && setEntries(i.devices)).catch(e => alive && setError(String(e instanceof Error ? e.message : e)));
    return () => { alive = false; };
  }, []);

  const results = useMemo(() => (entries ? searchGuide(entries, query, 48) : []), [entries, query]);
  const makers = useMemo(() => (entries ? manufacturers(entries) : []), [entries]);

  const open = (id: string) => {
    setLoading(true);
    setError(null);
    loadGuideDevice(id)
      .then(d => { setDevice(d); setPicked(new Set(d.suggested.filter(i => d.params[i]?.cc !== undefined))); })
      .catch(e => setError(String(e instanceof Error ? e.message : e)))
      .finally(() => setLoading(false));
  };

  const candidates = device ? knobCandidates(device) : [];
  const tab = (b: Browse['mode'], label: string) => (
    <button
      onClick={() => setBrowse(b === 'maker' ? browse : ({ mode: b } as Browse))}
      className={`px-3 min-h-[40px] rounded text-xs font-bold ${browse.mode === b || (b === 'makers' && browse.mode === 'maker') ? 'bg-teal-400 text-black' : 'bg-[#262626] text-gray-300'}`}
      aria-pressed={browse.mode === b}
    >
      {label}
    </button>
  );

  return (
    <section className="mb-5 rounded border border-[#3a3a3a] bg-[#1d1d1d] p-3">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="text-[11px] text-gray-400 flex-1 min-w-[12rem]">
          {draft.template ? <>Using <b className="text-gray-200">{draft.template.manufacturer} {draft.template.device}</b></> : `CC maps for ${entries ? entries.length : '450+'} instruments from midi.guide`}
        </span>
        {!device && <div className="flex gap-1.5">{tab('search', 'Search')}{tab('makers', 'By manufacturer')}</div>}
      </div>
      {error && <p className="text-xs text-red-300 mb-1">Could not load templates: {error}. You can still type CC numbers below.</p>}
      {!entries && !error && <p className="text-xs text-gray-500">Loading templates…</p>}
      {!device && entries && browse.mode === 'search' && (
        <>
          <input
            className={`${input} w-full mb-2`}
            placeholder="Search: e.g. Minilogue, Sub 37, Digitone, Microfreak…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && results[0]) open(results[0].id); }}
            aria-label="Search templates"
          />
          {!query.trim() && (
            <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">Popular · or browse all {makers.length} manufacturers</p>
          )}
          <div className="max-h-56 overflow-y-auto pr-1">
            {groupResults(results).map(([maker, items]) => (
              <div key={maker} className="mb-1.5">
                <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-0.5">{maker}</div>
                <div className="grid sm:grid-cols-2 gap-1">
                  {items.map(e => <TemplateButton key={e.id} entry={e} onOpen={open} disabled={loading} />)}
                </div>
              </div>
            ))}
            {!results.length && <p className="text-xs text-gray-500">No match. Try the manufacturer&apos;s name, or type CC numbers below.</p>}
          </div>
        </>
      )}
      {!device && entries && browse.mode === 'makers' && (
        <div className="max-h-56 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-1 pr-1">
          {makers.map(m => (
            <button key={m.name} onClick={() => setBrowse({ mode: 'maker', name: m.name })} className="text-left px-2.5 min-h-[44px] rounded bg-[#262626] hover:bg-[#303030] border border-[#333] text-sm flex items-center">
              <span className="truncate flex-1">{m.name}</span>
              <span className="text-[10px] text-gray-500 ml-1 shrink-0">{m.count}</span>
            </button>
          ))}
        </div>
      )}
      {!device && entries && browse.mode === 'maker' && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <button onClick={() => setBrowse({ mode: 'makers' })} className={button}>◀ All manufacturers</button>
            <span className="font-bold">{browse.name}</span>
          </div>
          <div className="max-h-56 overflow-y-auto grid sm:grid-cols-2 gap-1 pr-1">
            {byManufacturer(entries, browse.name).map(e => <TemplateButton key={e.id} entry={e} onOpen={open} disabled={loading} />)}
          </div>
        </div>
      )}
      {device && (
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <button onClick={() => setDevice(null)} className={button}>◀ Back</button>
            <span className="font-bold">{device.manufacturer} {device.device}</span>
            <a href={device.source} target="_blank" rel="noopener noreferrer" className="text-[11px] text-gray-400 underline">source CSV</a>
            <span className="ml-auto text-[11px] text-gray-400">{picked.size}/{MAX_KNOBS} knobs</span>
          </div>
          {!candidates.length && <p className="text-xs text-amber-300 mb-2">This template has no CC parameters (NRPN or notes only).</p>}
          <div className="max-h-56 overflow-y-auto space-y-0.5 pr-1">
            {candidates.map(i => {
              const p = device.params[i];
              const on = picked.has(i);
              return (
                <label key={i} className={`flex items-center gap-2 px-1.5 min-h-[40px] rounded text-xs ${on ? 'bg-[#123330]' : 'hover:bg-[#262626]'}`}>
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={!on && picked.size >= MAX_KNOBS}
                    onChange={() => setPicked(s => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; })}
                    className="accent-teal-400 w-4 h-4"
                  />
                  <span className="font-mono text-gray-400 w-12 shrink-0">CC{p.cc}{p.lsb !== undefined ? `/${p.lsb}` : ''}</span>
                  <span className="text-gray-100 truncate">{p.section ? <span className="text-gray-500">{p.section} · </span> : null}{p.name}</span>
                  {(p.min !== undefined || p.max !== undefined) && <span className="ml-auto text-gray-500 shrink-0">{p.min ?? 0}-{p.max ?? 127}</span>}
                </label>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            <button
              onClick={() => onApply(applyTemplate(draft, device, [...picked].sort((a, b) => a - b)))}
              disabled={!picked.size}
              className="px-4 min-h-[44px] rounded bg-teal-400 text-black font-bold text-xs disabled:opacity-40"
            >
              Use {picked.size} knob{picked.size === 1 ? '' : 's'}
            </button>
            <button onClick={() => setPicked(new Set(device.suggested.filter(i => device.params[i]?.cc !== undefined)))} className={button}>Suggested</button>
            <button onClick={() => setPicked(new Set())} className={button}>None</button>
          </div>
          <p className="text-[10px] text-gray-500 mt-2">
            Check the CC numbers against your synth&apos;s manual - firmware versions differ. Found a mistake? Fix it upstream at{' '}
            <a className="underline" href="https://github.com/pencilresearch/midi" target="_blank" rel="noopener noreferrer">github.com/pencilresearch/midi</a>.
          </p>
        </div>
      )}
    </section>
  );
}

function TemplateButton({ entry: e, onOpen, disabled }: { entry: GuideIndexEntry; onOpen: (id: string) => void; disabled: boolean }) {
  return (
    <button
      onClick={() => onOpen(e.id)}
      disabled={disabled}
      className="text-left px-2.5 py-1.5 min-h-[44px] rounded bg-[#262626] hover:bg-[#303030] border border-[#333] disabled:opacity-50"
    >
      <span className="block text-sm text-white leading-tight">{e.device}</span>
      <span className="block text-[10px] text-gray-500">{e.manufacturer} · {e.cc} CC{e.nrpn ? ` · ${e.nrpn} NRPN-only` : ''}{e.notes ? ` · ${e.notes} drum notes` : ''}</span>
    </button>
  );
}
