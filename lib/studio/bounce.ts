// ============================================================================
// Export: live recording (REC), stems and "Bounce song".
//
// - Master: what you hear, after the limiter (24-bit WAV).
// - Stems: every channel strip after its fader and pan, plus the two returns,
//   recorded in parallel from the same audio frame to the same frame - so they
//   line up sample for sample in any DAW and have exactly the same length. They
//   come as one .zip with the master and a README.
// - Bounce song: waits for silence, starts the arrangement from bar 1 on an exact
//   audio time, stops on the song's last bar line, keeps recording until the
//   reverb and delay tails have died away, then downloads.
// - Optional loudness normalisation of the master to -14 LUFS with a -1 dBTP
//   true-peak limiter (off by default: it changes your mix's level).
// ============================================================================

import { getAudioContext, onMasterMeter, getLatencyInfo } from '@/lib/audio/context';
import { Take, WavStream, crc32, masterTap, type TakeTap, type TakeTrack } from '@/lib/audio/recorder';
import { transport, PPQN } from '@/lib/audio/transport';
import { useStudioStore } from '@/store/studio';
import { DEVICES } from '@/devices';
import { hub } from './hub';
import { outputChannelId } from './mixerDoc';
import { arranger } from './arranger';
import { withoutHistory } from './historyGate';
import { makeZip, zipSize, ZIP_LIMIT, type ZipEntry } from './zip';
import { LoudnessMeter, normalizeChunks, type LoudnessStats } from './loudness';
import { saveFilesOrOffer, type SaveItem, type SaveResult } from './platform';

export function instanceName(id: string): string {
  const st = useStudioStore.getState();
  const r = st.studio.rack.find(x => x.id === id);
  const entry = DEVICES.find(d => d.id === (r?.device ?? id.split('#')[0]));
  if (r?.label) return r.label;
  return id.includes('#') ? `${entry?.name ?? id} ${id.split('#')[1]}` : entry?.name ?? id;
}

const safe = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim();

/** Every channel strip (rack order) and the two returns */
export function stemTaps(): TakeTap[] {
  const mixer = hub.mixer;
  if (!mixer) return [];
  const rack = useStudioStore.getState().studio.rack;
  const taps: TakeTap[] = [];
  let n = 1;
  const outputs = useStudioStore.getState().studio.outputs ?? {};
  rack.forEach(r => {
    const node = hub.getStripOutput(r.id);
    if (!node) return;
    taps.push({ id: r.id, name: `${String(n++).padStart(2, '0')} ${safe(instanceName(r.id))}`, node });
    // its separate outputs in use, each its own stem
    const outs = hub.getModule(r.device)?.studio?.outputs ?? [];
    (outputs[r.id] ?? []).forEach(o => {
      const id = outputChannelId(r.id, o);
      const out = hub.getStripOutput(id);
      if (!out) return;
      const label = outs.find(x => x.id === o)?.label ?? o;
      taps.push({ id, name: `${String(n++).padStart(2, '0')} ${safe(`${instanceName(r.id)} - ${label}`)}`, node: out });
    });
  });
  mixer.taps().forEach(t => {
    if (t.id === '__delay') taps.push({ id: t.id, name: `${String(n++).padStart(2, '0')} Return A - Delay`, node: t.node });
    if (t.id === '__reverb') taps.push({ id: t.id, name: `${String(n++).padStart(2, '0')} Return B - Reverb`, node: t.node });
  });
  return taps;
}

const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

function readme(tracks: TakeTrack[], extra: string[]): string {
  const st = useStudioStore.getState().studio;
  const sr = getAudioContext().sampleRate;
  const frames = tracks[0]?.wav.frames ?? 0;
  const routed = st.rack.filter(r => (st.routes[r.id] ?? 'master') !== 'master');
  const lines = [
    'Synth Studio export',
    '',
    `Sample rate: ${sr} Hz, 24-bit stereo WAV`,
    `Tempo: ${st.bpm} BPM, swing ${Math.round(50 + st.swing * 50)} %`,
    `Length: ${frames} samples (${(frames / sr).toFixed(3)} s) - every file has exactly this length and starts on the same sample.`,
    '',
    'Files',
    ...tracks.map(t => `  ${t.id === 'master' ? 'Master' : t.name}.wav`),
    '',
    'How the stems add up',
    '  Each instrument stem is its mixer channel after the fader and pan, without its sends.',
    '  The two return stems hold the delay and reverb. Instruments + returns = the master before the',
    '  master section (glue / EQ / limiter). The master file is what you heard, after the limiter.',
  ];
  if (routed.length) {
    lines.push('', 'Routed into a mixer device', ...routed.map(r => `  ${instanceName(r.id)} -> ${st.routes[r.id]} (its stem is before that mixer; the mixer\'s own stem already contains it)`));
  }
  if (extra.length) lines.push('', ...extra);
  return lines.join('\n') + '\n';
}

function packStems(tracks: TakeTrack[], master: WavStream, extra: string[], base: string): Blob {
  const entries: ZipEntry[] = [];
  entries.push({ name: `${base}/Master.wav`, data: [master.blob()], size: master.fileSize(), crc: master.fileCrc() });
  tracks.forEach(t => {
    if (t.id === 'master') return;
    entries.push({ name: `${base}/${t.name}.wav`, data: [t.wav.blob()], size: t.wav.fileSize(), crc: t.wav.fileCrc() });
  });
  const text = new Uint8Array(new TextEncoder().encode(readme(tracks, extra)));
  entries.push({ name: `${base}/README.txt`, data: [text], size: text.length, crc: crc32(text) });
  return makeZip(entries);
}

/** The files of a take: the master WAV, or a .zip with the master, every stem and a README */
function takeFiles(tracks: TakeTrack[], master: WavStream, stems: boolean, label: string, extra: string[] = []): SaveItem[] {
  const base = `synth-studio-${label}-${stamp()}`;
  if (!stems) return [{ blob: master.blob(), name: `${base}.wav` }];
  const estimate = zipSize(tracks.map(t => ({ name: t.name, data: [], size: t.wav.fileSize(), crc: 0 })));
  if (estimate >= ZIP_LIMIT) {
    // Too big for a zip: separate files
    return [
      { blob: master.blob(), name: `${base}-Master.wav` },
      ...tracks.filter(t => t.id !== 'master').map(t => ({ blob: t.wav.blob(), name: `${base}-${t.name}.wav` })),
    ];
  }
  return [{ blob: packStems(tracks, master, extra, base), name: `${base}-stems.zip` }];
}

// ----------------------------------------------------------------------------
// Live recording (REC)
// ----------------------------------------------------------------------------

let live: { take: Take; stems: boolean } | null = null;

export async function startRecording(opts: { stems: boolean }) {
  if (live) return;
  hub.ensureAudio();
  await hub.startAudio();
  const taps = [masterTap(), ...(opts.stems ? stemTaps() : [])];
  const take = new Take(taps);
  live = { take, stems: opts.stems };
  await take.start(getAudioContext().currentTime + 0.03);
}

export function recordingElapsed(): number {
  return live ? live.take.elapsed() : 0;
}

export function isRecording(): boolean {
  return !!live;
}

export async function stopRecording(): Promise<void> {
  const cur = live;
  live = null;
  if (!cur) return;
  const tracks = await cur.take.stop();
  const master = tracks.find(t => t.id === 'master')!.wav;
  await saveFilesOrOffer(takeFiles(tracks, master, cur.stems, 'take'), cur.stems ? 'stems' : 'WAV');
}

// ----------------------------------------------------------------------------
// Bounce song
// ----------------------------------------------------------------------------

export interface BounceOptions {
  stems: boolean;
  normalize: boolean;
  /** Bars to bounce when there is no arrangement (song mode off or no sections) */
  bars?: number;
  /** Longest tail to wait for, seconds */
  maxTail?: number;
}

export type BouncePhase = 'preparing' | 'playing' | 'tail' | 'encoding' | 'done' | 'cancelled' | 'error';

export interface BounceProgress {
  phase: BouncePhase;
  bar?: number;
  bars?: number;
  seconds?: number;
  message?: string;
  result?: { seconds: number; master: LoudnessStats; normalized?: LoudnessStats; gainDb?: number; files: number; items: SaveItem[]; saved: SaveResult };
}

let bouncing: { cancel: () => void } | null = null;

export function isBouncing() {
  return !!bouncing;
}

export function cancelBounce() {
  bouncing?.cancel();
}

/** Resolves when the master stays below `db` for `holdMs` (or after `maxMs`) */
function waitForQuiet(db: number, holdMs: number, maxMs: number, isCancelled: () => boolean): Promise<void> {
  const lim = Math.pow(10, db / 20);
  return new Promise(resolve => {
    let quietSince = performance.now();
    const t0 = performance.now();
    const unsub = onMasterMeter(f => {
      const now = performance.now();
      if (Math.max(f.peakL, f.peakR) > lim) quietSince = now;
      if (now - quietSince >= holdMs || now - t0 >= maxMs || isCancelled()) { unsub(); resolve(); }
    });
    // no meter frames (audio not running): don't hang
    setTimeout(() => { unsub(); resolve(); }, maxMs + 500);
  });
}

export async function bounceSong(opts: BounceOptions, onProgress: (p: BounceProgress) => void): Promise<void> {
  if (bouncing || live) return;
  let cancelled = false;
  let take: Take | null = null;
  const st0 = useStudioStore.getState().studio;
  const song = st0.arrangement.sections.length > 0;
  const wasEnabled = st0.arrangement.enabled;
  const restore = () => {
    arranger.cancelStopAtEnd();
    if (song && !wasEnabled) withoutHistory(() => useStudioStore.getState().setArrangement(a => ({ ...a, enabled: false })));
  };
  bouncing = {
    cancel: () => {
      cancelled = true;
      hub.stopAll();
      take?.stop().catch(() => undefined);
      restore();
      bouncing = null;
      onProgress({ phase: 'cancelled' });
    },
  };
  try {
    onProgress({ phase: 'preparing', message: 'Waiting for silence…' });
    hub.ensureAudio();
    await hub.startAudio();
    if (transport.playing) hub.stopAll();
    // A clean start: let any running tail die away
    await waitForQuiet(-70, 250, 4000, () => cancelled);
    if (cancelled) return;
    if (song && !wasEnabled) withoutHistory(() => useStudioStore.getState().setArrangement(a => ({ ...a, enabled: true })));
    const bars = song ? arranger.totalBars() : Math.max(1, opts.bars ?? 8);
    const bpm = useStudioStore.getState().studio.bpm;
    const barDur = (4 * 60) / bpm;
    const ctx = getAudioContext();
    const meter = new LoudnessMeter(ctx.sampleRate);
    take = new Take([masterTap(opts.normalize, (l, r) => meter.push(l, r)), ...(opts.stems ? stemTaps() : [])]);
    const t0 = ctx.currentTime + 0.3;
    await take.start(t0);
    let end = t0 + bars * barDur;
    let ended = false;
    const onEnd = (time: number) => { end = time; ended = true; };
    // The arranger stops the transport on the last bar line, before any instrument hears
    // the next bar's tick (it listens to the transport first)
    if (song) arranger.stopAtEndOnce(onEnd);
    else arranger.stopAtBarOnce(bars, onEnd);
    hub.startAll({ at: t0, countIn: false, fromTick: 0 });
    // Progress while playing
    await new Promise<void>(resolve => {
      const tick = () => {
        if (cancelled) { resolve(); return; }
        const now = ctx.currentTime;
        const t = transport.tickAt(now);
        const bar = t === null ? 0 : Math.floor(t / (PPQN * 4)) + 1;
        onProgress({ phase: 'playing', bar: Math.min(bars, bar), bars, seconds: Math.max(0, now - t0) });
        if (ended && now >= end) { resolve(); return; }
        if (!transport.playing && now > t0 + 0.5) { end = Math.min(end, now); resolve(); return; }
        setTimeout(tick, 100);
      };
      tick();
    });
    if (cancelled) return;
    if (transport.playing) hub.stopAll();
    onProgress({ phase: 'tail', bars, bar: bars, message: 'Recording the reverb and delay tails…' });
    await waitForQuiet(-70, 400, (opts.maxTail ?? 12) * 1000, () => cancelled);
    if (cancelled) return;
    const tracks = await take.stop(Math.max(ctx.currentTime + 0.05, end + 0.5));
    take = null;
    restore();
    onProgress({ phase: 'encoding', message: opts.normalize ? 'Normalising to -14 LUFS…' : 'Writing files…' });
    await new Promise(r => setTimeout(r, 30));
    const masterTrack = tracks.find(t => t.id === 'master')!;
    let master = masterTrack.wav;
    const extra: string[] = [];
    const floats = master.floats ?? [];
    const measured: LoudnessStats = {
      integrated: meter.integrated(),
      truePeak: meter.truePeak > 0 ? 20 * Math.log10(meter.truePeak) : -Infinity,
      samplePeak: meter.peak > 0 ? 20 * Math.log10(meter.peak) : -Infinity,
      maxShortTerm: meter.maxShortTerm(),
    };
    let normalized: LoudnessStats | undefined;
    let gainDb: number | undefined;
    if (opts.normalize && floats.length) {
      const res = normalizeChunks(floats, ctx.sampleRate, -14, -1);
      const out = new WavStream(ctx.sampleRate);
      res.chunks.forEach(c => out.push(c.l, c.r));
      master = out;
      normalized = res.after;
      gainDb = res.gainDb;
      extra.push(
        'Loudness normalised (Master.wav only; stems are untouched):',
        `  before ${fmt(res.before.integrated)} LUFS integrated, ${fmt(res.before.truePeak)} dBTP`,
        `  gain ${gainDb >= 0 ? '+' : ''}${gainDb.toFixed(2)} dB, true-peak limiter at -1 dBTP (${res.limiterDb.toFixed(1)} dB max reduction)`,
        `  after ${fmt(res.after.integrated)} LUFS integrated, ${fmt(res.after.truePeak)} dBTP`,
      );
    }
    const lat = getLatencyInfo();
    if (lat) extra.push(`Recorded at ${lat.sampleRate} Hz; the master was shifted by the limiter's ${(lat.lookahead * 1000).toFixed(2)} ms look-ahead to line up with the stems.`);
    const items = takeFiles(tracks, master, opts.stems, song ? 'song' : `${bars}-bars`, extra);
    // On iPad the share sheet needs a recent tap: after a long bounce the dialog offers "Save"
    const saved = await saveFilesOrOffer(items, opts.stems ? 'stems' : 'WAV');
    const seconds = master.frames / ctx.sampleRate;
    onProgress({ phase: 'done', result: { seconds, master: measured, normalized, gainDb, files: opts.stems ? tracks.length + 1 : 1, items, saved } });
  } catch (e) {
    console.error('[bounce]', e);
    restore();
    onProgress({ phase: 'error', message: e instanceof Error ? e.message : String(e) });
  } finally {
    if (!cancelled) bouncing = null;
  }
}

const fmt = (v: number) => (Number.isFinite(v) ? v.toFixed(1) : '-inf');
