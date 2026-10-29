'use client';

import { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { BUILD_PATHS, MORE_SETS, currentStage, loadStudioSet, type StudioSet } from '@/lib/studio/sets';
import { DEMOS, DEMO_SECTION, demoBars, demoSeconds, loadDemo, playDemo, restartDemo, studioDemo, studioHasWork, type DemoMeta } from '@/lib/studio/demos';
import { arranger } from '@/lib/studio/arranger';
import { downloadProject } from '@/lib/studio/project';
import { FULL, play as playRecording, resolveClip } from '@/lib/studio/demoAudio';
import { DemoProgress, useDemoPlayback } from '@/components/teaching/DemoClips';
import { transport } from '@/lib/audio/transport';
import { DEVICES } from '@/devices';
import { hub } from '@/lib/studio/hub';
import { useStudioStore } from '@/store/studio';

const nameOf = (device: string) => DEVICES.find(d => d.id === device)?.name ?? device;

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

/** The instruments a demo plays, as one line (the clock and the mixer last) */
export const demoInstruments = (d: DemoMeta) => d.instruments.map(nameOf).join(' · ');

/**
 * "Build a track": the demo tracks (finished songs to listen to, play and take apart), then
 * two paths of five stages - one instrument, + a clock, + a mixer, + a second
 * instrument, the full set. Each stage is a complete, wired and mixed studio, and
 * loading one keeps your patterns and sounds.
 */
export default function StudioSets() {
  return (
    <div className="space-y-3">
      <DemoTracks />
      <BuildPaths />
    </div>
  );
}

// ----------------------------------------------------------------------------
// Demo tracks
// ----------------------------------------------------------------------------

function DemoTracks() {
  const arrangement = useStudioStore(s => s.studio.arrangement);
  const loaded = studioDemo({ arrangement });
  const [open, setOpen] = useState(true);
  const [pending, setPending] = useState<{ demo: DemoMeta; play: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (demo: DemoMeta, play: boolean) => {
    setPending(null);
    setBusy(demo.id);
    try {
      if (play) await playDemo(demo.id);
      else await loadDemo(demo.id);
    } finally {
      setBusy(null);
    }
  };

  const ask = (demo: DemoMeta, play: boolean) => {
    // a tap is the gesture that unlocks audio on iPad: start it now, before any dialog
    hub.ensureAudio();
    // the demo that is already loaded just plays from the top
    if (loaded?.id === demo.id && play) {
      void restartDemo();
      return;
    }
    setPending({ demo, play });
  };

  return (
    <section className="bg-[#121212] border border-[#2a2a2a] rounded-xl p-3" aria-label="Demo tracks">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setOpen(o => !o)} className="flex items-center gap-2 text-sm font-bold text-white" aria-expanded={open}>
          {open ? '▾' : '▸'} Demo tracks
        </button>
        <span className="text-[11px] text-gray-400">Finished songs made in this studio: listen to one, then load it and take it apart.</span>
      </div>
      {open && (
        <ul className="grid sm:grid-cols-3 gap-2 mt-2">
          {DEMOS.map(d => {
            const active = loaded?.id === d.id;
            return (
              <li key={d.id} className={`p-2.5 rounded-lg border flex flex-col ${active ? 'bg-[#1b1b1b]' : 'bg-[#1a1a1a] border-[#333]'}`} style={active ? { borderColor: d.accent } : undefined}>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="font-bold text-white text-sm">{d.title}</span>
                  <span className="text-[10px] text-gray-500 tabular-nums">{d.bpm} BPM · {d.key} · {mmss(demoSeconds(d))}</span>
                </div>
                <p className="text-[11px] text-gray-300 mt-1 leading-snug flex-1">{d.description}</p>
                <p className="text-[10px] text-gray-500 mt-1 leading-snug">{demoInstruments(d)}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <ListenButton demo={d} />
                  <button
                    onClick={() => ask(d, true)}
                    disabled={!!busy}
                    className="px-3 h-11 rounded-lg bg-[#2a2a2a] text-white text-xs font-bold disabled:opacity-50 border border-[#3a3a3a]"
                    aria-label={active ? `Play the demo track ${d.title} from bar 1` : `Load and play the demo track ${d.title}`}
                  >
                    {busy === d.id ? 'Loading…' : active ? '▶ Play from bar 1' : 'Load and play'}
                  </button>
                  {!active && (
                    <button onClick={() => ask(d, false)} disabled={!!busy} className="px-3 h-11 rounded-lg bg-[#2a2a2a] text-white text-xs font-bold disabled:opacity-50 border border-[#3a3a3a]" aria-label={`Load the demo track ${d.title}`}>
                      Load
                    </button>
                  )}
                </div>
                <ListenProgress demo={d} />
                <p className="text-[11px] text-gray-400 mt-1.5 leading-snug">
                  Listen plays a recording, so your studio stays as it is. Load opens the real instruments, every pattern and sound, to play and take apart.
                </p>
              </li>
            );
          })}
        </ul>
      )}
      {loaded && <DemoCaption demo={loaded} />}
      <DemoReplaceDialog pending={pending} onCancel={() => setPending(null)} onConfirm={(save) => {
        if (!pending) return;
        if (save) downloadProject('My track');
        void run(pending.demo, pending.play);
      }} />
    </section>
  );
}

/** ▶ Listen: the whole demo, a recording (public/demos), played without loading anything */
function ListenButton({ demo }: { demo: DemoMeta }) {
  const owner = `card:${demo.id}`;
  const pb = useDemoPlayback(owner);
  const clip = resolveClip({ demo: demo.id, excerpt: FULL });
  if (!clip) return null;
  const status = pb?.status;
  return (
    <button
      onClick={() => playRecording(owner, { demo: demo.id, excerpt: FULL })}
      aria-pressed={status === 'playing' || status === 'loading'}
      className="px-3.5 h-11 rounded-lg text-xs font-bold text-black"
      style={{ background: demo.accent }}
      aria-label={status === 'playing' ? `Stop the recording of ${demo.title}` : `Listen to a recording of the demo track ${demo.title}`}
    >
      {status === 'loading' ? 'Loading…' : status === 'playing' ? '■ Stop' : '▶ Listen'}
    </button>
  );
}

/** While a card's recording plays: how far, and the time (the row is kept, so the cards' buttons stay in line) */
function ListenProgress({ demo }: { demo: DemoMeta }) {
  const pb = useDemoPlayback(`card:${demo.id}`);
  if (pb?.status === 'error') return <p className="text-[11px] text-orange-200 mt-1.5 min-h-4 leading-4" role="status">Couldn&apos;t play the recording: {pb.error}.</p>;
  return (
    <div className="mt-2 h-4">
      {pb && <DemoProgress playing={pb.status === 'playing'} color={demo.accent} label={`How far the recording of ${demo.title} has played`} time />}
    </div>
  );
}

/**
 * The confirm step before a demo replaces the studio: offers to save the current
 * project to a file first. Shared by the welcome dialog.
 */
export function DemoReplaceBody({ demo, onConfirm, onCancel }: { demo: DemoMeta; onConfirm: (save: boolean) => void; onCancel: () => void }) {
  const work = studioHasWork();
  return (
    <div>
      <p className="text-sm text-gray-300 leading-relaxed">
        <b className="text-white">{demo.title}</b> is a complete studio: {demoInstruments(demo)}, with its patterns, sounds, mix and
        {' '}{/^(8|11$|18$)/.test(String(demoBars(demo))) ? 'an' : 'a'} {demoBars(demo)}-bar song. It replaces what is in the studio now{work ? ', and the undo history starts again' : ''}.
      </p>
      {work && <p className="text-sm text-amber-200 mt-2">Save your current project to a file first?</p>}
      <div className="flex flex-wrap gap-2 mt-4 justify-end">
        <button onClick={onCancel} className="px-4 h-10 rounded-lg bg-[#2a2a2a] text-white text-sm">Cancel</button>
        {work && (
          <button onClick={() => onConfirm(false)} className="px-4 h-10 rounded-lg bg-[#2a2a2a] text-white text-sm border border-[#444]">
            Replace without saving
          </button>
        )}
        <button onClick={() => { hub.ensureAudio(); onConfirm(work); }} className="px-4 h-10 rounded-lg text-sm font-bold text-black" style={{ background: demo.accent }}>
          {work ? 'Save project, then load' : `Load ${demo.title}`}
        </button>
      </div>
    </div>
  );
}

function DemoReplaceDialog({ pending, onConfirm, onCancel }: { pending: { demo: DemoMeta } | null; onConfirm: (save: boolean) => void; onCancel: () => void }) {
  return (
    <Dialog.Root open={!!pending} onOpenChange={o => { if (!o) onCancel(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/70 z-40" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#161616] border-2 border-[#333] rounded-xl p-5 w-[calc(100%-2rem)] max-w-md shadow-2xl z-50 max-h-[90dvh] overflow-y-auto">
          <Dialog.Title className="text-lg font-bold text-white">Load the demo track?</Dialog.Title>
          <Dialog.Description className="sr-only">Loading a demo track replaces the current studio.</Dialog.Description>
          <div className="mt-2">
            {pending && <DemoReplaceBody demo={pending.demo} onConfirm={onConfirm} onCancel={onCancel} />}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * What the playing section teaches: the design's teaching note for the section under
 * the arranger's playhead. Inline at the top of the studio, and as a small floating
 * caption while the song plays and the inline one is scrolled out of view.
 */
function DemoCaption({ demo }: { demo: DemoMeta }) {
  const sections = useStudioStore(s => s.studio.arrangement.sections);
  const [head, setHead] = useState({ section: -1, bar: 0 });
  const [playing, setPlaying] = useState(transport.playing);
  const [inView, setInView] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => arranger.subscribe(setHead), []);
  useEffect(() => transport.onEvent(e => { if (e.type === 'start' || e.type === 'stop') setPlaying(e.type === 'start'); }), []);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.1 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const cur = playing && head.section >= 0 ? sections[head.section] : undefined;
  const info = cur ? DEMO_SECTION[cur.id] : undefined;
  const shown = info ?? DEMO_SECTION[sections[0]?.id ?? ''];
  if (!shown) return null;
  // the bar counter changes every bar: kept out of the live region, which speaks once a section
  const bar = info ? <span aria-hidden> · bar {head.bar + 1}/{cur!.bars}</span> : null;

  return (
    <>
      <div ref={ref} className="mt-2 rounded-lg border border-[#2f2f2f] bg-[#171717] px-3 py-2" data-demo-caption={info ? info.section.id : 'idle'}>
        <div role="status" aria-live="polite">
          <p className="text-[11px] font-bold tabular-nums" style={{ color: info ? info.section.color : '#9ca3af' }}>
            {info ? <>Now playing · {info.section.name}{bar}</> : `${demo.title} is loaded · ${sections.length} sections`}
          </p>
          <p className="text-[12px] text-gray-200 leading-snug mt-0.5">
            {info ? info.section.note : `Press ▶ to play it from bar 1. While it plays, this shows what each section teaches. First up, ${shown.section.name}: ${shown.section.note}`}
          </p>
        </div>
        {!info && demo.tip && <p className="text-[11px] text-gray-400 leading-snug mt-1">{demo.tip}</p>}
      </div>
      {info && !inView && (
        <div className="fixed left-3 bottom-3 z-30 max-w-[min(520px,calc(100vw-1.5rem))] rounded-lg border border-[#3a3a3a] bg-[#141414]/95 px-3 py-2 shadow-2xl pointer-events-none" aria-hidden>
          <p className="text-[11px] font-bold tabular-nums" style={{ color: info.section.color }}>{demo.title} · {info.section.name}{bar}</p>
          <p className="text-[12px] text-gray-200 leading-snug mt-0.5">{info.section.note}</p>
        </div>
      )}
    </>
  );
}

// ----------------------------------------------------------------------------
// Build paths
// ----------------------------------------------------------------------------

function BuildPaths() {
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
