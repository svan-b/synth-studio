// ============================================================================
// Studio mixer document: what is saved with the project (studio.mixer).
// Pure data and helpers - no audio. Every field is optional on disk; the
// accessors below fill in defaults, so projects saved before the mixer existed
// (and channels never touched) load as "fader at 0 dB, centre, no sends".
//
// Levels are in dB. MIN_DB means off (-infinity): JSON can't hold -Infinity.
// 0 dB on a channel fader is the instrument's calibrated level (lib/studio/levels.ts).
// ============================================================================

export const MIN_DB = -60;
export const MAX_DB = 6;

export interface ChannelDoc {
  /** Fader, dB (MIN_DB = off) */
  gain: number;
  /** -1 (left) .. 1 (right) */
  pan: number;
  mute: boolean;
  solo: boolean;
  /** Post-fader send to return A (delay), dB */
  sendA: number;
  /** Post-fader send to return B (reverb), dB */
  sendB: number;
}

export type DelayDivision = '1/2' | '1/4.' | '1/4' | '1/4T' | '1/8.' | '1/8' | '1/8T' | '1/16';
export const DELAY_DIVISIONS: { id: DelayDivision; beats: number; label: string }[] = [
  { id: '1/2', beats: 2, label: '1/2' },
  { id: '1/4.', beats: 1.5, label: '1/4 dotted' },
  { id: '1/4', beats: 1, label: '1/4' },
  { id: '1/4T', beats: 2 / 3, label: '1/4 triplet' },
  { id: '1/8.', beats: 0.75, label: '1/8 dotted' },
  { id: '1/8', beats: 0.5, label: '1/8' },
  { id: '1/8T', beats: 1 / 3, label: '1/8 triplet' },
  { id: '1/16', beats: 0.25, label: '1/16' },
];

export interface DelayDoc {
  /** Return level, dB */
  level: number;
  mute: boolean;
  division: DelayDivision;
  /** 0 .. 0.9 */
  feedback: number;
  /** Low-pass in the feedback path, Hz: lower = darker, tape-like repeats */
  tone: number;
  /** Echoes alternate left and right */
  pingPong: boolean;
}

export interface ReverbDoc {
  level: number;
  mute: boolean;
  /** RT60, seconds */
  decay: number;
  /** Frequency where the decay halves, Hz */
  damping: number;
  /** seconds */
  predelay: number;
  /** 0..1 room size */
  size: number;
}

export interface MasterDoc {
  /** Master fader, dB (before the limiter) */
  gain: number;
  eq: { on: boolean; low: number; tilt: number; high: number };
  glue: { on: boolean; threshold: number; ratio: number; attack: number; release: number; auto: boolean; makeup: number; mix: number };
}

export interface MixerDoc {
  channels?: Record<string, Partial<ChannelDoc>>;
  delay?: Partial<DelayDoc>;
  reverb?: Partial<ReverbDoc>;
  master?: { gain?: number; eq?: Partial<MasterDoc['eq']>; glue?: Partial<MasterDoc['glue']> };
}

export const CHANNEL_DEFAULT: ChannelDoc = { gain: 0, pan: 0, mute: false, solo: false, sendA: MIN_DB, sendB: MIN_DB };
export const DELAY_DEFAULT: DelayDoc = { level: 0, mute: false, division: '1/8.', feedback: 0.35, tone: 4500, pingPong: true };
export const REVERB_DEFAULT: ReverbDoc = { level: 0, mute: false, decay: 2.2, damping: 6500, predelay: 0.02, size: 0.7 };
export const MASTER_DEFAULT: MasterDoc = {
  gain: 0,
  eq: { on: false, low: 0, tilt: 0, high: 0 },
  // SSL-style bus compressor starting point: 2:1, 10 ms attack, auto release
  glue: { on: false, threshold: -18, ratio: 2, attack: 0.01, release: 0.3, auto: true, makeup: 0, mix: 1 },
};

/** The channel of an instrument's separate output (DeviceModule.studio.outputs): '<instance>/<output>' */
export const outputChannelId = (instance: string, output: string) => `${instance}/${output}`;
/** The instrument a channel belongs to: a separate output's channel belongs to its instrument */
export const channelInstance = (id: string) => id.split('/')[0];

/** Every channel of the studio: one per instrument, then its separate outputs in use */
export function studioChannels(rack: { id: string }[], outputs: Record<string, string[]> | undefined): { id: string }[] {
  const out: { id: string }[] = [];
  rack.forEach(r => {
    out.push({ id: r.id });
    (outputs?.[r.id] ?? []).forEach(o => out.push({ id: outputChannelId(r.id, o) }));
  });
  return out;
}

export function channelOf(doc: MixerDoc | undefined, instance: string): ChannelDoc {
  const c = doc?.channels?.[instance];
  return c ? { ...CHANNEL_DEFAULT, ...c } : CHANNEL_DEFAULT;
}

export function delayOf(doc: MixerDoc | undefined): DelayDoc {
  return { ...DELAY_DEFAULT, ...(doc?.delay ?? {}) };
}

export function reverbOf(doc: MixerDoc | undefined): ReverbDoc {
  return { ...REVERB_DEFAULT, ...(doc?.reverb ?? {}) };
}

export function masterOf(doc: MixerDoc | undefined): MasterDoc {
  const m = doc?.master ?? {};
  return {
    gain: m.gain ?? MASTER_DEFAULT.gain,
    eq: { ...MASTER_DEFAULT.eq, ...(m.eq ?? {}) },
    glue: { ...MASTER_DEFAULT.glue, ...(m.glue ?? {}) },
  };
}

/** dB -> linear, with MIN_DB and below as silence */
export function dbToGain(db: number): number {
  return db <= MIN_DB ? 0 : Math.pow(10, db / 20);
}

export function formatDb(db: number, digits = 1): string {
  if (db <= MIN_DB) return '-∞';
  const v = db.toFixed(digits);
  return db > 0 ? `+${v}` : v;
}

export function formatPan(p: number): string {
  if (Math.abs(p) < 0.005) return 'C';
  return `${p < 0 ? 'L' : 'R'}${Math.round(Math.abs(p) * 100)}`;
}

/**
 * Fader travel (0..1) <-> dB, a DAW-style taper: unity at 75 % of the travel,
 * about 1 dB per 2 % near the top and a long tail down to -infinity.
 */
export function faderToDb(pos: number): number {
  const p = Math.max(0, Math.min(1, pos));
  if (p <= 0.001) return MIN_DB;
  if (p >= 0.75) return ((p - 0.75) / 0.25) * MAX_DB;          // 0 .. +6 dB over the top quarter
  if (p >= 0.4) return -((0.75 - p) / 0.35) * 18;              // -18 .. 0 dB
  if (p >= 0.15) return -18 - ((0.4 - p) / 0.25) * 22;         // -40 .. -18 dB
  return -40 - ((0.15 - p) / 0.15) * (-MIN_DB - 40);           // -60 .. -40 dB
}

export function dbToFader(db: number): number {
  if (db <= MIN_DB) return 0;
  if (db >= 0) return 0.75 + (Math.min(MAX_DB, db) / MAX_DB) * 0.25;
  if (db >= -18) return 0.75 - (-db / 18) * 0.35;
  if (db >= -40) return 0.4 - ((-db - 18) / 22) * 0.25;
  return Math.max(0.0011, 0.15 - ((-db - 40) / (-MIN_DB - 40)) * 0.15);
}

/** Who is audible under solo-in-place. Soloing a channel routed into a mixer keeps that mixer audible. */
export function audibleChannels(doc: MixerDoc | undefined, rack: { id: string }[], routes: Record<string, string>): Set<string> {
  const ids = rack.map(r => r.id);
  const target = (id: string) => {
    const r = routes[id] ?? 'master';
    return r === 'master' ? null : r.split(':')[0];
  };
  const soloed = ids.filter(id => channelOf(doc, id).solo);
  const out = new Set<string>();
  ids.forEach(id => {
    const ch = channelOf(doc, id);
    if (ch.mute) return;
    if (!soloed.length) { out.add(id); return; }
    if (ch.solo) { out.add(id); return; }
    // a mixer that a soloed channel feeds
    if (soloed.some(s => target(s) === id)) { out.add(id); return; }
    // a channel feeding a soloed mixer
    const t = target(id);
    if (t && channelOf(doc, t).solo) out.add(id);
  });
  return out;
}

export function anySolo(doc: MixerDoc | undefined): boolean {
  return Object.values(doc?.channels ?? {}).some(c => c?.solo);
}
