// Audio input - per-instance data (DeviceModule.data). Pure, no browser APIs.

/**
 * Where the sound comes from:
 *   device    an audio interface input or a microphone (getUserMedia)
 *   practice  the built-in Practice synth - the "cable" from a synth with no gear needed
 *   tone      a 1 kHz line-up tone at -18 dBFS, for setting levels
 */
export type InputSource = 'device' | 'practice' | 'tone';

export interface LevelCheck {
  /** Loudest peak during the check, in dBFS */
  peakDb: number;
  /** GAIN when it was measured (dB) */
  gainDb: number;
  /** Date.now() */
  at: number;
}

export interface Take {
  n: number;
  seconds: number;
  peakDb: number;
  at: number;
}

export interface AudioInData {
  v: 1;
  /** The input is on: reconnect on load (a device only when access is already granted) */
  enabled: boolean;
  source: InputSource;
  /** MediaDeviceInfo.deviceId (stable per site); null = the default input */
  deviceId: string | null;
  /** Device name, to find it again if its id changes */
  label: string | null;
  /** Your name for this input; null = named after what it plays */
  name: string | null;
  /** Last level check (lessons read it; the panel shows it) */
  levelCheck: LevelCheck | null;
  /** Takes recorded from this input. The WAV files go to your downloads; this is the list. */
  takes: Take[];
}

/** MODE options: which interface inputs play, and how */
export const MODES = ['IN 1', 'IN 2', 'L+R', 'STEREO'];

export const TONE_DBFS = -18;
/** Peaks around here leave headroom (and it is the middle of the meter's target zone) */
export const TARGET_DBFS = -12;
export const TARGET_ZONE: [number, number] = [-18, -6];

export const initialInputData = (): AudioInData => ({
  v: 1, enabled: false, source: 'device', deviceId: null, label: null, name: null, levelCheck: null, takes: [],
});

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function asInputData(d: unknown): AudioInData {
  if (!d || typeof d !== 'object') return initialInputData();
  const s = d as Partial<AudioInData>;
  const lc = s.levelCheck && typeof s.levelCheck === 'object' && finite(s.levelCheck.peakDb) ? s.levelCheck : null;
  return {
    v: 1,
    enabled: !!s.enabled,
    source: s.source === 'practice' || s.source === 'tone' ? s.source : 'device',
    deviceId: typeof s.deviceId === 'string' && s.deviceId ? s.deviceId : null,
    label: typeof s.label === 'string' && s.label ? s.label : null,
    name: typeof s.name === 'string' && s.name.trim() ? s.name.trim().slice(0, 40) : null,
    levelCheck: lc ? { peakDb: lc.peakDb, gainDb: finite(lc.gainDb) ? lc.gainDb : 0, at: finite(lc.at) ? lc.at : 0 } : null,
    takes: Array.isArray(s.takes)
      ? s.takes.filter(t => t && finite(t.n) && finite(t.seconds)).slice(-50).map(t => ({ n: t.n, seconds: t.seconds, peakDb: finite(t.peakDb) ? t.peakDb : -96, at: finite(t.at) ? t.at : 0 }))
      : [],
  };
}

export function migrateInputData(saved: unknown): AudioInData {
  const out = asInputData(saved);
  return JSON.stringify(out) === JSON.stringify(saved) ? (saved as AudioInData) : out;
}

/** Linear peak (0..1+) -> dBFS */
export const toDb = (v: number) => (v > 0 ? 20 * Math.log10(v) : -96);

export type LevelVerdict = 'silent' | 'quiet' | 'low' | 'good' | 'hot' | 'clip';

/** What a measured peak means, and how far to move GAIN to land on the target */
export function judgeLevel(peakDb: number, clipped = false): { verdict: LevelVerdict; changeDb: number; text: string } {
  const changeDb = Math.round((TARGET_DBFS - peakDb) * 2) / 2;
  const by = `${Math.abs(changeDb).toFixed(changeDb % 1 ? 1 : 0)} dB`;
  if (peakDb <= -60) return { verdict: 'silent', changeDb: 0, text: 'Nothing arrived. Check the cable, the input you chose and MODE, then play while it listens.' };
  if (clipped || peakDb >= -1) return { verdict: 'clip', changeDb, text: `Too loud: it hits 0 dBFS and clips. Turn down about ${by}.` };
  if (peakDb > TARGET_ZONE[1]) return { verdict: 'hot', changeDb, text: `Hot: only ${Math.abs(peakDb).toFixed(0)} dB of headroom. Turn down about ${by}.` };
  if (peakDb >= TARGET_ZONE[0]) return { verdict: 'good', changeDb, text: `Good level: peaks at ${peakDb.toFixed(1)} dBFS leave about ${Math.abs(peakDb).toFixed(0)} dB of headroom.` };
  if (peakDb >= -36) return { verdict: 'low', changeDb, text: `A bit quiet. Turn up about ${by}.` };
  return { verdict: 'quiet', changeDb, text: `Very quiet: turn up your interface's gain first, then GAIN here (about ${by} in all).` };
}

/** What the rack calls this input: your name, or what it plays */
export function inputLabel(d: AudioInData, mode: string): string | undefined {
  if (d.name) return d.name;
  if (!d.enabled) return undefined;
  if (d.source === 'practice') return 'Practice synth audio';
  if (d.source === 'tone') return 'Test tone';
  const dev = (d.label ?? 'Audio input').replace(/\s*\([0-9a-f]{4}:[0-9a-f]{4}\)\s*$/i, '').replace(/^Default - /, '');
  return `${dev.length > 22 ? `${dev.slice(0, 21)}…` : dev} · ${mode}`;
}
