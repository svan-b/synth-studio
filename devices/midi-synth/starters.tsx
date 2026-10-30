'use client';

// ============================================================================
// Starter setups for "Your synth (MIDI)": "Category / Name" recipes that set the
// output, channel, clock, knobs and pattern in one tap (config.ts STARTERS).
// ============================================================================

import * as Dialog from '@radix-ui/react-dialog';
import type { ControlValue } from '@/types';
import { useMidiSnapshot } from '@/lib/midi';
import { STARTERS, isPractice, starterGroups, type MidiSynthData } from './config';

interface Props {
  data: MidiSynthData;
  onApply: (data: MidiSynthData, values?: Record<string, ControlValue>) => void;
  onClose: () => void;
}

const BLURB: Record<string, string> = {
  Setup: 'Where the MIDI goes: output, channel and clock.',
  Sequence: 'Patterns for the step sequencer. Your output and knobs stay as they are.',
  Knobs: 'Knob maps. Your output and pattern stay as they are.',
};

export default function StartersDialog({ data, onApply, onClose }: Props) {
  const snap = useMidiSnapshot();
  const hardware = snap.outputs.find(o => !o.virtual && o.state !== 'disconnected');
  const midiReady = snap.support.supported && snap.status === 'ready';

  return (
    <Dialog.Root open onOpenChange={o => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40" />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-hardware-panel border-2 border-[#3a3a3a] rounded-lg p-4 sm:p-5 w-[calc(100%-1.5rem)] max-w-3xl shadow-2xl z-50 max-h-[92vh] supports-[height:100dvh]:max-h-[92dvh] overflow-y-auto text-white"
          aria-describedby="midi-starters-desc"
          onOpenAutoFocus={e => { e.preventDefault(); (e.currentTarget as HTMLElement | null)?.focus?.(); }}
        >
          <Dialog.Title className="text-lg font-bold">Starter setups</Dialog.Title>
          <p id="midi-starters-desc" className="text-xs text-hardware-label mb-4 leading-snug">
            Ready-made starting points. Each one sets only what its name says; change anything afterwards in Setup.
            {!midiReady && ' Hardware setups need your synth\'s MIDI output: on this browser you will choose it once MIDI is available.'}
          </p>
          {starterGroups().map(([cat, items]) => (
            <section key={cat} className="mb-4">
              <h3 className="text-[11px] uppercase tracking-wider text-gray-400 font-bold">{cat}</h3>
              {BLURB[cat] && <p className="text-[11px] text-gray-500 mb-1.5">{BLURB[cat]}</p>}
              <div className="grid sm:grid-cols-2 gap-2">
                {items.map(st => {
                  const needs = st.hardware && !hardware && !(data.port && !isPractice(data.port));
                  return (
                    <button
                      key={st.id}
                      onClick={() => {
                        const r = st.apply(data, { hardware: hardware ? { id: hardware.id, name: hardware.name } : null });
                        onApply(r.data, r.values);
                      }}
                      className="text-left rounded-lg border border-[#3a3a3a] bg-[#1d1d1d] hover:bg-[#262626] px-3 py-2.5 min-h-[44px]"
                      data-starter={st.id}
                    >
                      <span className="flex items-center gap-2">
                        <span className="font-bold text-sm">{st.name.split(' / ').slice(1).join(' / ')}</span>
                        {st.hardware && <span className="ml-auto shrink-0 text-[10px] rounded px-1.5 py-0.5 border border-teal-800 text-teal-300">your synth</span>}
                      </span>
                      <span className="block text-[11px] text-gray-400 leading-snug mt-0.5">{st.description}</span>
                      {needs && <span className="block text-[11px] text-amber-300 mt-1">No synth is connected yet: Setup opens so you can choose its output.</span>}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
          <div className="flex justify-end">
            <Dialog.Close asChild><button className="px-4 min-h-[44px] bg-[#3a3a3a] rounded text-sm">Close</button></Dialog.Close>
          </div>
          <p className="sr-only">{STARTERS.length} starters</p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
