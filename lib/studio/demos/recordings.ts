// ============================================================================
// Recordings of the demo tracks: what public/demos holds, from its manifest
// (written by scripts/render-demos.cjs, docs/DEMOS.md). Pure data and lookups,
// no audio: the player is lib/studio/demoAudio.ts, and the validator reads the
// same functions to check every lesson's references.
// ============================================================================

import manifestJson from '@/public/demos/manifest.json';
import type { DemoClipRef } from '@/types';

/** One file of public/demos: a variation of an excerpt */
export interface DemoRecording {
  file: string;
  /** What the coach calls this variation ("As made", "Drums only") */
  label: string;
  /** What differs from the demo as made */
  change?: string;
  /** Length of the file, seconds: the excerpt's bars, then the next bar fading out */
  seconds: number;
  /** Length of the excerpt's bars, seconds: what an A/B loops */
  loop: number;
  /** Samples in the file, at the manifest's sample rate */
  frames: number;
  /** Integrated loudness of the bars, LUFS, and the true peak of the file, dBTP (as decoded) */
  lufs: number;
  truePeak: number;
  kbps: number;
  bytes: number;
}

export interface DemoManifest {
  version: number;
  rendered: string;
  commit: string;
  codec: string;
  sampleRate: number;
  totalBytes: number;
  demos: Record<string, {
    title: string;
    bpm: number;
    bars: number;
    /** By excerpt id ('full' is the whole song): its bars (1-based, inclusive) and variations */
    excerpts: Record<string, { bars: [number, number]; variations: Record<string, DemoRecording> }>;
  }>;
}

export const DEMO_RECORDINGS = manifestJson as unknown as DemoManifest;

/** The variation a reference means when it names none: the demo as made */
export const AS_MADE = 'as-made';
/** The excerpt that is the whole song (the demo cards' Listen) */
export const FULL = 'full';

/** A recording found in the manifest */
export interface DemoClip extends DemoRecording {
  demo: string;
  title: string;
  excerpt: string;
  variation: string;
  bars: [number, number];
  url: string;
}

export function resolveClip(ref: DemoClipRef): DemoClip | null {
  const d = DEMO_RECORDINGS.demos[ref.demo];
  const ex = d?.excerpts[ref.excerpt];
  const variation = ref.variation ?? AS_MADE;
  const v = ex?.variations[variation];
  if (!d || !ex || !v) return null;
  return { ...v, demo: ref.demo, title: d.title, excerpt: ref.excerpt, variation, bars: ex.bars, url: `/demos/${v.file}` };
}

/** The references of an `info.play`, as a list */
export const refsOf = (play: DemoClipRef | DemoClipRef[] | undefined): DemoClipRef[] => (!play ? [] : Array.isArray(play) ? play : [play]);

/** The clips of an `info.play` (one or several, in order); unknown ones are left out */
export function clipsOf(play: DemoClipRef | DemoClipRef[] | undefined): DemoClip[] {
  return refsOf(play).map(resolveClip).filter((c): c is DemoClip => !!c);
}

/** "bars 17–20" (or "the whole song") */
export const barsLabel = (c: Pick<DemoClip, 'excerpt' | 'bars'>) =>
  (c.excerpt === FULL ? 'the whole song' : c.bars[0] === c.bars[1] ? `bar ${c.bars[0]}` : `bars ${c.bars[0]}–${c.bars[1]}`);
