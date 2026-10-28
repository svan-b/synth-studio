'use client';

// ============================================================================
// Setup dialog for "Your synth (MIDI)": output port, channel, name, timing,
// a midi.guide template and up to 16 CC knobs. Edits a draft; Save commits it.
// ============================================================================

import { useEffect, useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { midi } from '@/lib/midi/access';
import { useMidiSnapshot } from '@/lib/midi';
import { GUIDE_ATTRIBUTION, GUIDE_BASE, type GuideDevice, type GuideIndexEntry } from './guide';
import { loadGuideDevice, loadGuideIndex, searchGuide } from './templates';
import {
  GENERIC_KNOBS, MAX_KNOBS, applyTemplate, knobCandidates, sanitizeKnob,
  type CcKnob, type MidiSynthData,
} from './config';

interface Props {
  data: MidiSynthData;
  onSave: (d: MidiSynthData) => void;
  onClose: () => void;
}

const input = 'bg-[#141414] border border-[#3a3a3a] rounded px-2 py-1.5 text-sm text-white min-w-0';
const small = 'bg-[#141414] border border-[#3a3a3a] rounded px-1.5 py-1 text-xs text-white w-full min-w-0 font-mono';

export default function SetupDialog({ data, onSave, onClose }: Props) {
  const [draft, setDraft] = useState<MidiSynthData>(() => structuredClone(data));
  const snap = useMidiSnapshot();
  const set = (patch: Partial<MidiSynthData>) => setDraft(d => ({ ...d, ...patch }));
  const setKnob = (i: number, patch: Partial<CcKnob>) =>
    setDraft(d => ({ ...d, knobs: d.knobs.map((k, j) => (j === i ? { ...k, ...patch } : k)) }));

  const save = () => {
    const knobs = draft.knobs.map(k => sanitizeKnob(k)).filter((k): k is CcKnob => !!k).slice(0, MAX_KNOBS);
    onSave({ ...draft, name: draft.name.trim() || 'My synth', knobs });
  };

  const portValue = draft.port ? (snap.outputs.find(o => o.id === draft.port!.id) ?? snap.outputs.find(o => o.name === draft.port!.name))?.id ?? '__saved' : '';

  return (
    <Dialog.Root open onOpenChange={o => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40" />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-hardware-panel border-2 border-[#3a3a3a] rounded-lg p-4 sm:p-5 w-[calc(100%-1.5rem)] max-w-3xl shadow-2xl z-50 max-h-[92vh] overflow-y-auto text-white"
          aria-describedby="midi-synth-setup-desc"
        >
          <Dialog.Title className="text-lg font-bold">Set up your synth</Dialog.Title>
          <p id="midi-synth-setup-desc" className="text-xs text-hardware-label mb-4">
            Choose where the MIDI goes, then pick a template (or type CC numbers from your synth&apos;s manual).
          </p>

          {/* ---- Connection --------------------------------------------------- */}
          <section className="grid sm:grid-cols-2 gap-3 mb-5">
            <label className="flex flex-col gap-1 text-xs text-gray-300">
              Name
              <input className={input} value={draft.name} maxLength={40} onChange={e => set({ name: e.target.value })} />
            </label>
            <div className="flex flex-col gap-1 text-xs text-gray-300">
              MIDI output
              {!snap.support.supported ? (
                <p className="text-[11px] text-amber-300 leading-snug">{snap.support.message}</p>
              ) : snap.status !== 'ready' ? (
                <div className="flex items-center gap-2">
                  <button onClick={() => void midi.request()} className="px-3 py-1.5 rounded bg-teal-400 text-black font-bold text-xs">
                    {snap.status === 'requesting' ? 'Waiting…' : 'Enable MIDI'}
                  </button>
                  <span className="text-[11px] text-gray-400">{snap.error ?? snap.support.message ?? 'The browser will ask for permission.'}</span>
                </div>
              ) : (
                <select
                  className={input}
                  value={portValue}
                  onChange={e => {
                    const o = snap.outputs.find(x => x.id === e.target.value);
                    set({ port: o ? { id: o.id, name: o.name } : null });
                  }}
                  aria-label="MIDI output port"
                >
                  <option value="">- none -</option>
                  {portValue === '__saved' && draft.port && <option value="__saved">{draft.port.name} (not connected)</option>}
                  {snap.outputs.map(o => <option key={o.id} value={o.id}>{o.name}{o.state === 'disconnected' ? ' (disconnected)' : ''}</option>)}
                </select>
              )}
              {snap.status === 'ready' && !snap.outputs.length && (
                <span className="text-[11px] text-amber-300">No MIDI outputs found - plug in your synth or interface (it appears here automatically).</span>
              )}
            </div>
            <label className="flex flex-col gap-1 text-xs text-gray-300">
              Channel
              <select className={input} value={draft.channel} onChange={e => set({ channel: Number(e.target.value) })} aria-label="MIDI channel">
                {Array.from({ length: 16 }, (_, i) => <option key={i} value={i}>Channel {i + 1}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-gray-300">
              Timing trim (ms)
              <input
                type="number" className={input} value={draft.offsetMs} min={-200} max={200} step={1}
                onChange={e => set({ offsetMs: Math.max(-200, Math.min(200, Number(e.target.value) || 0)) })}
              />
              <span className="text-[10px] text-gray-500">+ plays later, − earlier. Most synths need 0; slow-responding ones a few ms negative.</span>
            </label>
          </section>

          {/* ---- Template ----------------------------------------------------- */}
          <TemplatePicker draft={draft} onApply={d => setDraft(d)} />

          {/* ---- Knobs -------------------------------------------------------- */}
          <section className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-bold">Knobs <span className="text-gray-500 font-normal">({draft.knobs.length}/{MAX_KNOBS})</span></h3>
              <div className="ml-auto flex gap-2">
                <button
                  onClick={() => set({ knobs: GENERIC_KNOBS.map(k => ({ ...k })), template: null })}
                  className="px-2 py-1 rounded bg-[#333] text-xs" title="General MIDI sound controllers (CC 7, 71-77) - many synths follow them"
                >
                  Generic
                </button>
                <button
                  onClick={() => set({ knobs: [...draft.knobs, { label: `CC ${nextFreeCc(draft.knobs)}`, cc: nextFreeCc(draft.knobs), min: 0, max: 127 }] })}
                  disabled={draft.knobs.length >= MAX_KNOBS}
                  className="px-2 py-1 rounded bg-[#333] text-xs disabled:opacity-40"
                >
                  + Add knob
                </button>
              </div>
            </div>
            <div className="grid grid-cols-[1.6rem_minmax(0,3fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_1.8rem] gap-1 items-center text-[10px] text-gray-400 mb-1 px-0.5">
              <span>#</span><span>Label</span><span>CC</span><span>Min</span><span>Max</span><span title="14-bit controllers: the LSB CC number (often CC + 32)">LSB</span><span />
            </div>
            <div className="space-y-1">
              {draft.knobs.map((k, i) => (
                <div key={i} className="grid grid-cols-[1.6rem_minmax(0,3fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_1.8rem] gap-1 items-center">
                  <span className="text-[10px] text-gray-500 text-center">{i + 1}</span>
                  <input className={small} value={k.label} maxLength={24} onChange={e => setKnob(i, { label: e.target.value })} aria-label={`Knob ${i + 1} label`} />
                  <NumberCell value={k.cc} onChange={cc => setKnob(i, { cc })} label={`Knob ${i + 1} CC number`} />
                  <NumberCell value={k.min} onChange={min => setKnob(i, { min })} label={`Knob ${i + 1} minimum`} />
                  <NumberCell value={k.max} onChange={max => setKnob(i, { max })} label={`Knob ${i + 1} maximum`} />
                  <NumberCell value={k.lsb} optional onChange={lsb => setKnob(i, { lsb })} label={`Knob ${i + 1} LSB CC`} />
                  <button
                    onClick={() => set({ knobs: draft.knobs.filter((_, j) => j !== i) })}
                    className="h-7 rounded bg-[#3a2323] text-red-300 text-xs" aria-label={`Remove knob ${i + 1}`}
                  >
                    ✕
                  </button>
                </div>
              ))}
              {!draft.knobs.length && <p className="text-xs text-gray-500">No knobs. Add some, or pick a template above.</p>}
            </div>
          </section>

          <footer className="flex flex-wrap items-center gap-2 pt-3 border-t border-[#3a3a3a]">
            <p className="text-[10px] text-gray-500 flex-1 min-w-[12rem] leading-snug">
              {GUIDE_ATTRIBUTION}.{' '}
              <a href={`${GUIDE_BASE}/LICENSE.md`} target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-300">License &amp; attribution</a>
              {' · '}
              <a href="https://midi.guide" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-300">midi.guide</a>
            </p>
            <Dialog.Close asChild><button className="px-4 py-2 bg-[#3a3a3a] rounded text-sm">Cancel</button></Dialog.Close>
            <button onClick={save} className="px-4 py-2 bg-teal-400 text-black font-bold rounded text-sm">Save</button>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
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

// ----------------------------------------------------------------------------
// midi.guide template picker
// ----------------------------------------------------------------------------

function TemplatePicker({ draft, onApply }: { draft: MidiSynthData; onApply: (d: MidiSynthData) => void }) {
  const [entries, setEntries] = useState<GuideIndexEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [device, setDevice] = useState<GuideDevice | null>(null);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<Set<number>>(new Set());

  useEffect(() => {
    let alive = true;
    loadGuideIndex().then(i => alive && setEntries(i.devices)).catch(e => alive && setError(String(e instanceof Error ? e.message : e)));
    return () => { alive = false; };
  }, []);

  const results = useMemo(() => (entries ? searchGuide(entries, query, 40) : []), [entries, query]);

  const open = (id: string) => {
    setLoading(true);
    setError(null);
    loadGuideDevice(id)
      .then(d => { setDevice(d); setPicked(new Set(d.suggested.filter(i => d.params[i]?.cc !== undefined))); })
      .catch(e => setError(String(e instanceof Error ? e.message : e)))
      .finally(() => setLoading(false));
  };

  const candidates = device ? knobCandidates(device) : [];

  return (
    <section className="mb-5 rounded border border-[#3a3a3a] bg-[#1d1d1d] p-3">
      <div className="flex flex-wrap items-baseline gap-2 mb-2">
        <h3 className="text-sm font-bold">Template</h3>
        <span className="text-[11px] text-gray-400">
          {draft.template ? <>Using <b className="text-gray-200">{draft.template.manufacturer} {draft.template.device}</b></> : 'CC maps for 450+ instruments from midi.guide'}
        </span>
      </div>
      {!device ? (
        <>
          <input
            className={`${input} w-full mb-2`}
            placeholder="Search: e.g. Minilogue, Sub 37, Digitone, Microfreak…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            aria-label="Search templates"
          />
          {error && <p className="text-xs text-red-300 mb-1">Could not load templates: {error}</p>}
          {!entries && !error && <p className="text-xs text-gray-500">Loading templates…</p>}
          <div className="max-h-48 overflow-y-auto grid sm:grid-cols-2 gap-1">
            {results.map(e => (
              <button
                key={e.id}
                onClick={() => open(e.id)}
                disabled={loading}
                className="text-left px-2 py-1.5 rounded bg-[#262626] hover:bg-[#303030] border border-[#333] disabled:opacity-50"
              >
                <span className="block text-[10px] uppercase tracking-wide text-gray-500">{e.manufacturer}</span>
                <span className="block text-sm text-white leading-tight">{e.device}</span>
                <span className="block text-[10px] text-gray-500">{e.cc} CC{e.nrpn ? ` · ${e.nrpn} NRPN-only` : ''}{e.notes ? ` · ${e.notes} drum notes` : ''}</span>
              </button>
            ))}
            {entries && !results.length && <p className="text-xs text-gray-500">No match. You can still type CC numbers below.</p>}
          </div>
        </>
      ) : (
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <button onClick={() => setDevice(null)} className="px-2 py-1 rounded bg-[#333] text-xs">◀ Back</button>
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
                <label key={i} className={`flex items-center gap-2 px-1.5 py-1 rounded text-xs ${on ? 'bg-[#123330]' : 'hover:bg-[#262626]'}`}>
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={!on && picked.size >= MAX_KNOBS}
                    onChange={() => setPicked(s => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; })}
                    className="accent-teal-400"
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
              className="px-3 py-1.5 rounded bg-teal-400 text-black font-bold text-xs disabled:opacity-40"
            >
              Use {picked.size} knob{picked.size === 1 ? '' : 's'}
            </button>
            <button onClick={() => setPicked(new Set(device.suggested.filter(i => device.params[i]?.cc !== undefined)))} className="px-3 py-1.5 rounded bg-[#333] text-xs">
              Suggested
            </button>
            <button onClick={() => setPicked(new Set())} className="px-3 py-1.5 rounded bg-[#333] text-xs">None</button>
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
