'use client';

import { useEffect, useState } from 'react';
import { useStudioStore, type ArrangementSection } from '@/store/studio';
import { hub } from '@/lib/studio/hub';
import { arranger } from '@/lib/studio/arranger';
import { DEVICES } from '@/devices';

const SECTION_NAMES = ['Intro', 'Build', 'Drop', 'Break', 'Verse', 'Chorus', 'Bridge', 'Outro'];
const COLORS = ['#38bdf8', '#a78bfa', '#f97316', '#22c55e', '#f43f5e', '#eab308', '#14b8a6', '#ec4899'];

/**
 * Song arranger: sections in time order, and for each instrument what it plays
 * in that section - a pattern, a knob snapshot, or nothing (muted).
 */
export default function Arranger() {
  const arrangement = useStudioStore(s => s.studio.arrangement);
  const rack = useStudioStore(s => s.studio.rack);
  const devices = useStudioStore(s => s.devices);
  const setArrangement = useStudioStore(s => s.setArrangement);
  const [playhead, setPlayhead] = useState({ section: -1, bar: 0 });

  useEffect(() => arranger.subscribe(setPlayhead), []);

  const sections = arrangement.sections;
  const totalBars = sections.reduce((n, s) => n + s.bars, 0);

  const update = (id: string, fn: (s: ArrangementSection) => ArrangementSection) =>
    setArrangement(a => ({ ...a, sections: a.sections.map(s => (s.id === id ? fn(s) : s)) }));

  const addSection = (copyOf?: ArrangementSection) => {
    const n = sections.length;
    const section: ArrangementSection = copyOf
      ? { ...structuredClone(copyOf), id: `s${Date.now()}`, name: `${copyOf.name} 2` }
      : { id: `s${Date.now()}`, name: SECTION_NAMES[n % SECTION_NAMES.length], bars: 8, color: COLORS[n % COLORS.length], parts: {} };
    setArrangement(a => ({ ...a, sections: [...a.sections, section] }));
  };

  const capture = (sectionId: string, instance: string) => {
    const values = useStudioStore.getState().devices[instance]?.controlValues ?? {};
    update(sectionId, s => ({ ...s, parts: { ...s.parts, [instance]: { ...s.parts[instance], snapshot: { ...values } } } }));
  };

  const nameOf = (id: string) => {
    const r = rack.find(x => x.id === id);
    const entry = DEVICES.find(d => d.id === r?.device);
    return r?.label ?? entry?.name ?? id;
  };

  return (
    <section className="bg-[#121212] border border-[#2a2a2a] rounded-xl p-3" aria-label="Song arranger">
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <h3 className="font-bold text-white text-sm">Song arranger</h3>
        <label className="flex items-center gap-1.5 text-xs text-gray-300">
          <input
            type="checkbox"
            checked={arrangement.enabled}
            onChange={e => setArrangement(a => ({ ...a, enabled: e.target.checked }))}
            className="accent-green-500"
          />
          Song mode (follow the sections when you press Play)
        </label>
        <label className="flex items-center gap-1.5 text-xs text-gray-300">
          <input type="checkbox" checked={arrangement.loop} onChange={e => setArrangement(a => ({ ...a, loop: e.target.checked }))} className="accent-green-500" />
          Loop
        </label>
        <span className="text-[11px] text-gray-500">{sections.length} sections · {totalBars} bars</span>
        <button onClick={() => addSection()} className="ml-auto px-3 py-1.5 rounded-full bg-[#2a2a2a] text-white text-xs border border-[#3a3a3a]">+ Section</button>
      </div>

      {sections.length === 0 ? (
        <p className="text-xs text-gray-500 leading-relaxed">
          Songs are built from sections: an <b>intro</b> that introduces the groove, a <b>build</b> that adds tension,
          a <b>drop</b> where everything plays, a <b>break</b> that gives the ear a rest. Add a section, then for each
          instrument choose a pattern (Elektrons) or capture a knob snapshot (analog gear), or leave it muted.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="text-xs border-separate" style={{ borderSpacing: 4 }}>
            <thead>
              <tr>
                <th className="text-left text-gray-500 font-normal pr-2">Instrument</th>
                {sections.map((s, i) => (
                  <th key={s.id} className="min-w-[150px] align-top">
                    <div
                      className={`rounded-lg p-1.5 border ${playhead.section === i ? 'border-white' : 'border-transparent'}`}
                      style={{ background: `${s.color ?? '#444'}33` }}
                    >
                      <input
                        value={s.name}
                        onChange={e => update(s.id, x => ({ ...x, name: e.target.value }))}
                        className="w-full bg-transparent font-bold text-white outline-none"
                        aria-label="Section name"
                      />
                      <div className="flex items-center gap-1 mt-1 text-gray-300 font-normal">
                        <button className="w-6 h-6 rounded bg-black/40" onClick={() => update(s.id, x => ({ ...x, bars: Math.max(1, x.bars - 1) }))} aria-label="Fewer bars">−</button>
                        <span className="tabular-nums w-14 text-center">{s.bars} bar{s.bars > 1 ? 's' : ''}</span>
                        <button className="w-6 h-6 rounded bg-black/40" onClick={() => update(s.id, x => ({ ...x, bars: Math.min(128, x.bars + 1) }))} aria-label="More bars">+</button>
                        {playhead.section === i && <span className="ml-1 text-green-400 tabular-nums">bar {playhead.bar + 1}</span>}
                      </div>
                      <div className="flex gap-1 mt-1 font-normal">
                        <button className="px-1.5 py-0.5 rounded bg-black/40 text-green-300" onClick={() => { hub.ensureAudio(); setArrangement(a => ({ ...a, enabled: true })); arranger.playFrom(i); }}>▶ from here</button>
                        <button className="px-1.5 py-0.5 rounded bg-black/40 text-gray-300" onClick={() => addSection(s)}>copy</button>
                        <button className="px-1.5 py-0.5 rounded bg-black/40 text-red-300" onClick={() => setArrangement(a => ({ ...a, sections: a.sections.filter(x => x.id !== s.id) }))}>delete</button>
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rack.map(slot => {
                const mod = hub.getModule(slot.device);
                const patterns = mod?.studio?.patterns?.(devices[slot.id]?.data) ?? null;
                return (
                  <tr key={slot.id}>
                    <td className="text-gray-300 pr-2 whitespace-nowrap">{nameOf(slot.id)}</td>
                    {sections.map(s => {
                      const part = s.parts[slot.id] ?? {};
                      return (
                        <td key={s.id} className="align-top">
                          <div className={`rounded-lg p-1.5 bg-[#1c1c1c] border border-[#2c2c2c] ${part.muted ? 'opacity-50' : ''}`}>
                            {patterns ? (
                              <select
                                value={part.pattern ?? ''}
                                onChange={e => update(s.id, x => ({ ...x, parts: { ...x.parts, [slot.id]: { ...part, pattern: e.target.value || undefined } } }))}
                                className="w-full bg-[#262626] text-white rounded px-1 py-1"
                                aria-label={`${nameOf(slot.id)} pattern in ${s.name}`}
                              >
                                <option value="">(keep playing)</option>
                                {patterns.map(p => <option key={p.id} value={p.id}>{p.label ?? p.id}</option>)}
                              </select>
                            ) : (
                              <button
                                onClick={() => capture(s.id, slot.id)}
                                className={`w-full rounded px-1 py-1 ${part.snapshot ? 'bg-sky-900 text-sky-200' : 'bg-[#262626] text-gray-300'}`}
                                title="Store the instrument's current knob settings for this section"
                              >
                                {part.snapshot ? '✓ snapshot (re-capture)' : 'Capture knobs'}
                              </button>
                            )}
                            <label className="flex items-center gap-1 mt-1 text-gray-400">
                              <input
                                type="checkbox"
                                checked={!!part.muted}
                                onChange={e => update(s.id, x => ({ ...x, parts: { ...x.parts, [slot.id]: { ...part, muted: e.target.checked } } }))}
                                className="accent-red-500"
                              />
                              mute
                            </label>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
