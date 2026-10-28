'use client';

import { useState } from 'react';
import { STUDIO_SETS, loadStudioSet } from '@/lib/studio/sets';
import { DEVICES } from '@/devices';
import { hub } from '@/lib/studio/hub';

/** Ready-wired studios, loadable in one tap */
export default function StudioSets() {
  const [open, setOpen] = useState(false);
  return (
    <section className="bg-[#121212] border border-[#2a2a2a] rounded-xl p-3">
      <button onClick={() => setOpen(o => !o)} className="flex items-center gap-2 text-sm font-bold text-white">
        {open ? '▾' : '▸'} Studio sets <span className="text-[11px] font-normal text-gray-500">ready-wired racks to start from</span>
      </button>
      {open && (
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-2 mt-2">
          {STUDIO_SETS.map(set => (
            <div key={set.id} className="p-3 rounded-lg bg-[#1a1a1a] border border-[#333]">
              <p className="font-bold text-white text-sm">{set.name}</p>
              <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">{set.description}</p>
              <p className="text-[11px] text-sky-300 mt-1 leading-snug">{set.goal}</p>
              <p className="text-[10px] text-gray-500 mt-1">
                {set.rack.map(r => DEVICES.find(d => d.id === r.device)?.name ?? r.device).join(' · ')}
              </p>
              <button
                onClick={() => {
                  if (!confirm(`Load “${set.name}”? This replaces the rack, routing and studio cables (instrument settings are kept).`)) return;
                  hub.ensureAudio();
                  loadStudioSet(set);
                }}
                className="mt-2 px-3 py-1.5 rounded bg-teaching-current text-black text-xs font-bold"
              >
                Load set
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
