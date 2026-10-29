'use client';

import { useState } from 'react';
import { BUILD_PATHS, MORE_SETS, currentStage, loadStudioSet, type StudioSet } from '@/lib/studio/sets';
import { DEVICES } from '@/devices';
import { hub } from '@/lib/studio/hub';
import { useStudioStore } from '@/store/studio';

const nameOf = (device: string) => DEVICES.find(d => d.id === device)?.name ?? device;

/**
 * "Build a track": two paths of five stages - one instrument, + a clock, + a mixer,
 * + a second instrument, the full set. Each stage is a complete, wired and mixed
 * studio, and loading one keeps your patterns and sounds.
 */
export default function StudioSets() {
  const rack = useStudioStore(s => s.studio.rack);
  const here = currentStage(rack);
  const [open, setOpen] = useState(rack.length <= 1);
  const [path, setPath] = useState<'elektron' | 'moog'>(here?.path ?? 'elektron');
  const [more, setMore] = useState(false);
  const p = BUILD_PATHS.find(x => x.id === path)!;

  const load = (set: StudioSet) => {
    const added = set.rack.filter(r => !rack.some(x => x.device === r.device)).map(r => nameOf(r.device));
    const removed = rack.filter(r => !set.rack.some(x => x.device === r.device)).map(r => r.label ?? nameOf(r.device));
    const msg = [
      `Load "${set.name}"?`,
      added.length ? `Adds: ${added.join(', ')}.` : '',
      removed.length ? `Removes from the rack: ${removed.join(', ')} (their settings are kept for later).` : '',
      'Cables, routing and the mix change to this stage. Your sounds and patterns stay. You can undo this.',
    ].filter(Boolean).join('\n');
    if (!confirm(msg)) return;
    hub.ensureAudio();
    loadStudioSet(set);
  };

  return (
    <section className="bg-[#121212] border border-[#2a2a2a] rounded-xl p-3" aria-label="Build a track">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setOpen(o => !o)} className="flex items-center gap-2 text-sm font-bold text-white" aria-expanded={open}>
          {open ? '▾' : '▸'} Build a track, step by step
        </button>
        {here && !open && (
          <span className="text-[11px] text-gray-400">
            You are at <b className="text-teaching-current">{BUILD_PATHS.find(b => b.id === here.path)?.name} {here.stage}/5 · {here.name}</b>
          </span>
        )}
        {open && (
          <div className="flex rounded-lg border border-[#333] overflow-hidden ml-1" role="tablist" aria-label="Build path">
            {BUILD_PATHS.map(b => (
              <button
                key={b.id}
                role="tab"
                aria-selected={path === b.id}
                onClick={() => setPath(b.id)}
                className={`px-3 h-8 text-xs ${path === b.id ? 'bg-[#2e2e2e] text-white font-bold' : 'bg-[#181818] text-gray-400'}`}
              >
                {b.name}
              </button>
            ))}
          </div>
        )}
      </div>
      {open && (
        <>
          <p className="text-[11px] text-gray-500 mt-1.5">{p.blurb} Each stage is a complete studio: wired, routed and mixed. Loading one keeps your sounds and patterns.</p>
          <ol className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 mt-2">
            {p.stages.map(set => {
              const active = here?.id === set.id;
              return (
                <li key={set.id} className={`relative p-2.5 rounded-lg border flex flex-col ${active ? 'border-teaching-current bg-[#132013]' : 'border-[#333] bg-[#1a1a1a]'}`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[12px] font-bold ${active ? 'bg-teaching-current text-black' : 'bg-[#2e2e2e] text-gray-200'}`}>{set.stage}</span>
                    <span className="font-bold text-white text-sm leading-tight">{set.name}</span>
                  </div>
                  <p className="text-[11px] text-gray-300 mt-1 leading-snug flex-1">{set.adds}</p>
                  <p className="text-[10px] text-gray-500 mt-1 leading-snug">{set.rack.map(r => nameOf(r.device)).join(' · ')}</p>
                  <p className="text-[11px] text-sky-300 mt-1 leading-snug">Try: {set.goal}</p>
                  <button
                    onClick={() => load(set)}
                    className={`mt-2 px-3 py-1.5 rounded text-xs font-bold ${active ? 'bg-[#2a2a2a] text-gray-300' : 'bg-teaching-current text-black'}`}
                    aria-label={`Load stage ${set.stage}: ${set.name}`}
                  >
                    {active ? 'Reload this stage' : `Load stage ${set.stage}`}
                  </button>
                </li>
              );
            })}
          </ol>
          <button onClick={() => setMore(m => !m)} className="mt-2 text-[11px] text-gray-400 hover:text-white" aria-expanded={more}>
            {more ? '▾' : '▸'} More sets
          </button>
          {more && (
            <div className="grid sm:grid-cols-2 gap-2 mt-1.5">
              {MORE_SETS.map(set => (
                <div key={set.id} className="p-2.5 rounded-lg bg-[#1a1a1a] border border-[#333]">
                  <p className="font-bold text-white text-sm">{set.name}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">{set.description}</p>
                  <p className="text-[11px] text-sky-300 mt-1 leading-snug">{set.goal}</p>
                  <button onClick={() => load(set)} className="mt-2 px-3 py-1.5 rounded bg-[#2a2a2a] text-white text-xs font-bold">Load set</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
