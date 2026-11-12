'use client';

import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import type { DemoClipRef, LessonStep } from '@/types';
import {
  barsLabel, clipsOf, elapsed, getPlayback, play, playSide, prefetch, resolveClip, subscribe, type DemoClip, type DemoPlayback,
} from '@/lib/studio/demoAudio';
import { onFrame } from '@/components/studio/controls';

/**
 * Controls for the demo recordings (lib/studio/demoAudio.ts): an info step's ▶ Hear it, a
 * demo listen step's A/B, and the demo cards' Listen. They play files, never the studio.
 */

/** What plays now, for one owner (null when it is someone else's or nothing plays) */
export function useDemoPlayback(owner: string): DemoPlayback | null {
  const pb = useSyncExternalStore(subscribe, getPlayback, () => null);
  return pb && pb.owner === owner ? pb : null;
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/**
 * A thin bar that follows the clip (or the A/B's loop) playing, on the shared animation loop;
 * with `time`, the time played and the length beside it
 */
export function DemoProgress({ playing, color = '#38bdf8', label, time }: { playing: boolean; color?: string; label: string; time?: boolean }) {
  const bar = useRef<HTMLDivElement>(null);
  const txt = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!playing) { if (bar.current) bar.current.style.transform = 'scaleX(0)'; return; }
    let last = '';
    return onFrame(() => {
      const pb = getPlayback();
      if (!bar.current || !pb || pb.status !== 'playing' || !pb.seconds) return;
      const t = elapsed();
      bar.current.style.transform = `scaleX(${Math.min(1, t / pb.seconds)})`;
      const s = `${mmss(t)} / ${mmss(pb.seconds)}`;
      if (txt.current && s !== last) { last = s; txt.current.textContent = s; }
    });
  }, [playing]);
  return (
    <div className="flex items-center gap-2" title={label}>
      <div className="flex-1 h-1.5 rounded-full bg-[#262626] overflow-hidden" aria-hidden>
        <div ref={bar} className="h-full origin-left" style={{ background: color, transform: 'scaleX(0)' }} />
      </div>
      {time && <span ref={txt} className="text-[10px] text-gray-400 tabular-nums" aria-hidden>{playing ? '' : '–'}</span>}
    </div>
  );
}

const fmtSec = (s: number) => `${Math.round(s)} s`;
const fmtDb = (g: number) => (Math.abs(g) < 0.05 ? '0.0' : `${g > 0 ? '+' : '−'}${Math.abs(g).toFixed(1)}`);

/** "Low Tide Lights · bars 17–20" */
export const clipCaption = (c: DemoClip) => `${c.title} · ${barsLabel(c)}`;

/** An info step's recording(s): ▶ Hear it plays them in turn; again stops */
export function DemoHearIt({ owner, refs }: { owner: string; refs: DemoClipRef | DemoClipRef[] }) {
  const clips = useMemo(() => clipsOf(refs), [refs]);
  const pb = useDemoPlayback(owner);
  useEffect(() => { prefetch(clips); }, [clips]);
  if (!clips.length) return <p className="mt-2 text-[11px] text-orange-200">This step&apos;s recording is missing.</p>;
  const status = pb?.status;
  const many = clips.length > 1;
  const total = clips.reduce((n, c) => n + c.seconds, 0);
  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex items-center gap-2.5">
        <button
          onClick={() => play(owner, refs)}
          aria-pressed={status === 'playing' || status === 'loading'}
          className={`min-h-[44px] min-w-[44px] px-4 rounded-lg text-sm font-bold shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-300 ${
            status === 'playing' ? 'bg-sky-500 text-black' : 'bg-[#1e2a36] text-sky-100 hover:bg-[#263646]'}`}
        >
          {status === 'loading' ? 'Loading…' : status === 'playing' ? '■ Stop' : status === 'error' ? '▶ Try again' : '▶ Hear it'}
        </button>
        <div className="min-w-0 text-[11px] leading-snug">
          {many ? (
            <p className="text-gray-200">
              {clips.map((c, i) => (
                <span key={i} className={status === 'playing' && pb?.index === i ? 'text-sky-200 font-bold' : ''}>{i ? ' · ' : ''}{c.title}</span>
              ))}
            </p>
          ) : (
            <p className="text-gray-200">{clipCaption(clips[0])}</p>
          )}
          <p className="text-gray-400">{many ? `${clips.length} recordings in turn` : 'A recording'}, {fmtSec(total)}. Your studio stays as it is.</p>
        </div>
      </div>
      <DemoProgress playing={status === 'playing'} label="How far the recording has played" />
      {status === 'error' && <p className="text-[11px] text-orange-200" role="status">Couldn&apos;t play it: {pb?.error}.</p>}
    </div>
  );
}

/**
 * A demo listen step: two variations of one excerpt, looping in step at the same loudness.
 * Press A or B; press the other to switch on the same phrase, the lit one again to stop.
 */
export function DemoABToggle({ owner, demo, labels, reveal }: {
  owner: string;
  demo: NonNullable<NonNullable<LessonStep['listen']>['demo']>;
  labels: [string, string];
  /** Say what each side is (after the question is answered, or when there is none) */
  reveal: boolean;
}) {
  const refs = useMemo(() => {
    const a: DemoClipRef = { demo: demo.demo, excerpt: demo.excerpt, variation: demo.a };
    const b: DemoClipRef = { demo: demo.demo, excerpt: demo.excerpt, variation: demo.b };
    return { a, b, clips: [resolveClip(a), resolveClip(b)] };
  }, [demo]);
  const pb = useDemoPlayback(owner);
  useEffect(() => { prefetch(refs.clips.filter((c): c is DemoClip => !!c)); }, [refs]);
  const [ca, cb] = refs.clips;
  if (!ca || !cb) return <p className="text-[11px] text-orange-200">This step&apos;s recordings are missing.</p>;
  const side = pb?.side ?? null;
  const on = pb?.status === 'playing' || pb?.status === 'loading';
  return (
    <div className="space-y-1.5">
      <div className="flex rounded-lg overflow-hidden border border-[#2c3a48]" role="group" aria-label="Compare by ear">
        {(['a', 'b'] as const).map((k, i) => {
          const lit = on && side === k;
          return (
            <button
              key={k}
              onClick={() => playSide(owner, refs.a, refs.b, k)}
              aria-pressed={lit}
              className={`flex-1 min-h-[44px] px-2 font-bold text-sm transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-300 ${
                lit ? (k === 'a' ? 'bg-purple-600 text-white' : 'bg-sky-600 text-white') : k === 'a' ? 'bg-[#2a1e36] text-purple-100 hover:bg-[#35264a]' : 'bg-[#1e2a36] text-sky-100 hover:bg-[#263646]'
              } ${i === 1 ? 'border-l border-[#2c3a48]' : ''}`}
            >
              {lit ? (pb?.status === 'loading' ? '…' : '■') : '▶'} {labels[i]}
            </button>
          );
        })}
      </div>
      <DemoProgress playing={pb?.status === 'playing'} color={side === 'a' ? '#9333ea' : '#0284c7'} label="Where the loop is" />
      <p className="text-[10px] text-gray-400 leading-snug" aria-live="polite">
        A recording of {ca.title}, {barsLabel(ca)}, looping. Both sides play at the same loudness
        {pb?.gainDb.length === 2 ? <> (A {fmtDb(pb.gainDb[0])} dB, B {fmtDb(pb.gainDb[1])} dB)</> : null}
        {on ? '; switch sides on the same phrase, press the lit side again to stop.' : '. Your studio stays as it is.'}
      </p>
      {reveal && (
        <p className="text-[11px] text-gray-300 leading-snug">
          <span className="text-purple-200 font-bold">A:</span> {ca.label}{ca.change ? ` (${ca.change})` : ''}. <span className="text-sky-200 font-bold">B:</span> {cb.label}{cb.change ? ` (${cb.change})` : ''}.
        </p>
      )}
      {pb?.status === 'error' && <p className="text-[11px] text-orange-200" role="status">Couldn&apos;t play it: {pb.error}.</p>}
    </div>
  );
}
