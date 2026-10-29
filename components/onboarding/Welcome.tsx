'use client';

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { STUDIO_SETS, loadStudioSet } from '@/lib/studio/sets';
import { DEMOS, playDemo, studioHasWork, type DemoMeta } from '@/lib/studio/demos';
import { downloadProject } from '@/lib/studio/project';
import { hub } from '@/lib/studio/hub';
import { DemoReplaceBody, demoInstruments } from '@/components/studio/StudioSets';

export type WelcomeChoice = 'learn' | 'explore' | 'track' | 'moog-studio';

/**
 * First-run welcome: get a newcomer to a sound in one tap, then into the
 * right first lesson. Shown once (and from the header's Help).
 */
export default function Welcome({ open, onClose, onChoose }: { open: boolean; onClose: () => void; onChoose: (c: WelcomeChoice) => void }) {
  const [pending, setPending] = useState<DemoMeta | null>(null);
  const choose = (c: WelcomeChoice) => {
    if (c === 'track') loadStudioSet(STUDIO_SETS.find(s => s.id === 'elektron-live')!);
    if (c === 'moog-studio') loadStudioSet(STUDIO_SETS.find(s => s.id === 'moog-sound-studio')!);
    onChoose(c);
  };
  const play = (demo: DemoMeta, save: boolean) => {
    hub.ensureAudio();
    if (save) downloadProject('My track');
    setPending(null);
    void playDemo(demo.id);
    // the demo plays in the studio view ('track' opens it; the demo itself replaces the set)
    onChoose('track');
  };
  const pick = (demo: DemoMeta) => {
    hub.ensureAudio();
    if (studioHasWork()) setPending(demo);
    else play(demo, false);
  };
  return (
    <Dialog.Root open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/85 backdrop-blur-sm z-40" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#141414] border-2 border-[#333] rounded-2xl p-6 w-[calc(100%-2rem)] max-w-3xl shadow-2xl z-50 max-h-[90dvh] overflow-y-auto">
          <Dialog.Title className="text-2xl font-bold text-white">Welcome to Synth Studio</Dialog.Title>
          <Dialog.Description className="text-sm text-gray-400 mt-1 max-w-xl">
            Real instruments you can play, patch and take apart - and lessons that teach you <i>why</i> they sound the way they do,
            so you can design your own sounds anywhere.
          </Dialog.Description>
          {pending ? (
            <div className="mt-5 p-4 rounded-xl bg-[#1b1b1b] border border-[#333]">
              <p className="font-bold text-white text-base mb-2">Play a demo track</p>
              <DemoReplaceBody demo={pending} onConfirm={save => play(pending, save)} onCancel={() => setPending(null)} />
            </div>
          ) : (
            <>
              <div className="grid sm:grid-cols-2 gap-3 mt-5">
                <Choice
                  title="Learn synthesis from zero"
                  text="Start on the Sub 37 keyboard synth. One idea at a time: oscillator, filter, envelope. About 5 minutes per lesson."
                  cta="Start the first lesson"
                  accent="#22c55e"
                  onClick={() => choose('learn')}
                />
                <Choice
                  title="Build a full track"
                  text="Analog Rytm drums and Analog Four synths into the Xone:96 mixer, synced to one clock, with a song arranger."
                  cta="Open the Elektron live set"
                  accent="#f97316"
                  onClick={() => choose('track')}
                />
                <Choice
                  title="Moog Sound Studio"
                  text="DFAM, Mother-32 and Subharmonicon clocked together. Patch cables between them like the 3-tier rack."
                  cta="Open the Moog trio"
                  accent="#38bdf8"
                  onClick={() => choose('moog-studio')}
                />
                <Choice
                  title="Just explore"
                  text="Pick any instrument and play. Every one has presets, a patch bay or sequencer, and its own lessons."
                  cta="Choose an instrument"
                  accent="#a78bfa"
                  onClick={() => choose('explore')}
                />
              </div>
              <section className="mt-3 p-4 rounded-xl bg-[#1b1b1b] border border-[#333]" aria-label="Play a demo track">
                <p className="font-bold text-white text-base">Play a demo track</p>
                <p className="text-[13px] text-gray-400 mt-1 leading-snug">
                  Three finished songs made with these instruments - hear what is possible, then open any part to see how it was done.
                </p>
                <div className="grid sm:grid-cols-3 gap-2 mt-3">
                  {DEMOS.map(d => (
                    <button
                      key={d.id}
                      onClick={() => pick(d)}
                      className="text-left p-3 rounded-lg bg-[#161616] border border-[#333] hover:border-[#555] transition-colors"
                      aria-label={`Play a demo track: ${d.title}`}
                    >
                      <span className="block text-sm font-bold" style={{ color: d.accent }}>▶ {d.title}</span>
                      <span className="block text-[12px] text-gray-300 mt-0.5 leading-snug">{d.style}, {d.bpm} BPM</span>
                      <span className="block text-[11px] text-gray-500 mt-0.5 leading-snug">{demoInstruments(d)}</span>
                    </button>
                  ))}
                </div>
              </section>
            </>
          )}
          <ul className="mt-5 text-[12px] text-gray-500 space-y-1 list-disc pl-5">
            <li>Use headphones or decent speakers - a lot of synthesis lives in the low end.</li>
            <li>On iPad, turn the ringer/silent switch or Silent Mode off if you hear nothing, and use landscape.</li>
            <li>Your work saves automatically in this browser. Use Project → Save to keep a file, and REC to bounce a WAV.</li>
            <li>Got your own synth? Add “Your synth (MIDI)” or “Audio input” from + Instrument.</li>
          </ul>
          <div className="mt-4 flex justify-end">
            <Dialog.Close asChild><button className="px-4 py-2 bg-[#2a2a2a] text-white rounded-lg text-sm">Skip</button></Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Choice({ title, text, cta, accent, onClick }: { title: string; text: string; cta: string; accent: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-left p-4 rounded-xl bg-[#1b1b1b] border border-[#333] hover:border-[#555] transition-colors group">
      <span className="block font-bold text-white text-base">{title}</span>
      <span className="block text-[13px] text-gray-400 mt-1 leading-snug">{text}</span>
      <span className="inline-block mt-3 text-sm font-bold" style={{ color: accent }}>{cta} →</span>
    </button>
  );
}
