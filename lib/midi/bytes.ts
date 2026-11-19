// ============================================================================
// MIDI bytes - pure helpers (no browser APIs), shared by the router, clock,
// the MIDI synth device and the WAM host. Channels are 0-based (0 = ch 1).
// ============================================================================

export const NOTE_OFF = 0x80;
export const NOTE_ON = 0x90;
export const POLY_AFTERTOUCH = 0xa0;
export const CONTROL_CHANGE = 0xb0;
export const PROGRAM_CHANGE = 0xc0;
export const CHANNEL_AFTERTOUCH = 0xd0;
export const PITCH_BEND = 0xe0;

export const SONG_POSITION = 0xf2;
export const TIMING_CLOCK = 0xf8;
export const START = 0xfa;
export const CONTINUE = 0xfb;
export const STOP = 0xfc;
export const ACTIVE_SENSING = 0xfe;

export const CC_MOD_WHEEL = 1;
export const CC_ALL_SOUND_OFF = 120;
export const CC_ALL_NOTES_OFF = 123;

const b7 = (v: number) => Math.max(0, Math.min(127, Math.round(v))) & 0x7f;
const ch = (c: number) => Math.max(0, Math.min(15, Math.round(c))) & 0x0f;

export const noteOn = (channel: number, note: number, velocity: number) => [NOTE_ON | ch(channel), b7(note), Math.max(1, b7(velocity))];
export const noteOff = (channel: number, note: number, velocity = 0) => [NOTE_OFF | ch(channel), b7(note), b7(velocity)];
export const controlChange = (channel: number, cc: number, value: number) => [CONTROL_CHANGE | ch(channel), b7(cc), b7(value)];
export const programChange = (channel: number, program: number) => [PROGRAM_CHANGE | ch(channel), b7(program)];
/** `value` is -1..+1 (0 = centre) */
export function pitchBend(channel: number, value: number): number[] {
  const v14 = Math.max(0, Math.min(16383, Math.round(8192 + value * 8192)));
  return [PITCH_BEND | ch(channel), v14 & 0x7f, (v14 >> 7) & 0x7f];
}
/** Song position in MIDI beats (one MIDI beat = a 16th note = 6 clocks) */
export function songPosition(midiBeats: number): number[] {
  const v = Math.max(0, Math.min(16383, Math.floor(midiBeats)));
  return [SONG_POSITION, v & 0x7f, (v >> 7) & 0x7f];
}

/** NRPN parameter write: CC 99/98 select the parameter, CC 6/38 carry the value */
export function nrpn(channel: number, param: number, value: number, hiRes = true): number[][] {
  const p = Math.max(0, Math.min(16383, Math.round(param)));
  const v = Math.max(0, Math.min(hiRes ? 16383 : 127, Math.round(value)));
  const msgs = [controlChange(channel, 99, p >> 7), controlChange(channel, 98, p & 0x7f)];
  if (hiRes) msgs.push(controlChange(channel, 6, v >> 7), controlChange(channel, 38, v & 0x7f));
  else msgs.push(controlChange(channel, 6, v));
  return msgs;
}

export type MidiMessage =
  | { type: 'noteon'; channel: number; note: number; velocity: number }
  | { type: 'noteoff'; channel: number; note: number; velocity: number }
  | { type: 'cc'; channel: number; cc: number; value: number }
  | { type: 'pitchbend'; channel: number; /** -1..+1 */ value: number; raw: number }
  | { type: 'program'; channel: number; program: number }
  | { type: 'aftertouch'; channel: number; value: number }
  | { type: 'polyaftertouch'; channel: number; note: number; value: number }
  | { type: 'clock' }
  | { type: 'start' }
  | { type: 'continue' }
  | { type: 'stop' }
  | { type: 'songposition'; /** 16th notes */ position: number }
  | { type: 'other'; status: number };

/** Decode one complete MIDI message (Web MIDI delivers one per event) */
export function parseMidi(data: ArrayLike<number>): MidiMessage | null {
  if (!data || data.length === 0) return null;
  const status = data[0];
  if (status >= 0xf0) {
    switch (status) {
      case TIMING_CLOCK: return { type: 'clock' };
      case START: return { type: 'start' };
      case CONTINUE: return { type: 'continue' };
      case STOP: return { type: 'stop' };
      case SONG_POSITION: return data.length >= 3 ? { type: 'songposition', position: (data[1] & 0x7f) | ((data[2] & 0x7f) << 7) } : null;
      default: return { type: 'other', status };
    }
  }
  if (status < 0x80) return null; // running status is resolved by the browser
  const kind = status & 0xf0;
  const channel = status & 0x0f;
  const d1 = (data[1] ?? 0) & 0x7f;
  const d2 = (data[2] ?? 0) & 0x7f;
  switch (kind) {
    case NOTE_ON:
      // Note on with velocity 0 is a note off (running-status friendly)
      return d2 === 0 ? { type: 'noteoff', channel, note: d1, velocity: 64 } : { type: 'noteon', channel, note: d1, velocity: d2 };
    case NOTE_OFF: return { type: 'noteoff', channel, note: d1, velocity: d2 };
    case CONTROL_CHANGE: return { type: 'cc', channel, cc: d1, value: d2 };
    case PITCH_BEND: {
      const raw = d1 | (d2 << 7);
      return { type: 'pitchbend', channel, raw, value: raw >= 8192 ? (raw - 8192) / 8191 : (raw - 8192) / 8192 };
    }
    case PROGRAM_CHANGE: return { type: 'program', channel, program: d1 };
    case CHANNEL_AFTERTOUCH: return { type: 'aftertouch', channel, value: d1 };
    case POLY_AFTERTOUCH: return { type: 'polyaftertouch', channel, note: d1, value: d2 };
    default: return { type: 'other', status };
  }
}

/** Re-address a channel voice message to another channel (status 0x80-0xEF) */
export function withChannel(data: ArrayLike<number>, channel: number): number[] {
  const out = Array.from(data);
  if (out[0] >= 0x80 && out[0] < 0xf0) out[0] = (out[0] & 0xf0) | ch(channel);
  return out;
}

export const isChannelMessage = (data: ArrayLike<number>) => data.length > 0 && data[0] >= 0x80 && data[0] < 0xf0;

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
/** MIDI note name, middle C (60) = C4 */
export const midiNoteName = (n: number) => `${NAMES[((n % 12) + 12) % 12]}${Math.floor(n / 12) - 1}`;

// ----------------------------------------------------------------------------
// Human-readable messages (the MIDI monitor in "Your synth", tests, docs)
// ----------------------------------------------------------------------------

/** Standard controller names (General MIDI / GM2); synths may use the rest freely */
export const CC_NAMES: Record<number, string> = {
  0: 'Bank select', 1: 'Mod wheel', 2: 'Breath', 4: 'Foot pedal', 5: 'Glide time', 6: 'Data entry', 7: 'Volume', 8: 'Balance',
  10: 'Pan', 11: 'Expression', 32: 'Bank select LSB', 64: 'Sustain pedal', 65: 'Glide on/off', 66: 'Sostenuto', 67: 'Soft pedal',
  71: 'Resonance', 72: 'Release', 73: 'Attack', 74: 'Cutoff', 75: 'Decay', 76: 'Vibrato rate', 77: 'Vibrato depth', 78: 'Vibrato delay',
  91: 'Reverb send', 93: 'Chorus send', 98: 'NRPN LSB', 99: 'NRPN MSB', 100: 'RPN LSB', 101: 'RPN MSB',
  120: 'All sound off', 121: 'Reset controllers', 122: 'Local control', 123: 'All notes off', 124: 'Omni off', 125: 'Omni on', 126: 'Mono mode', 127: 'Poly mode',
};

export interface DescribedMidi {
  /** "Note on", "CC", "Program"... */
  kind: string;
  /** 0-based channel, null for system messages */
  channel: number | null;
  /** "C3 (48) · vel 100", "74 Cutoff = 87" */
  detail: string;
  /** "90 30 64" */
  hex: string;
}

export const toHex = (data: ArrayLike<number>) => Array.from(data, b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');

/** Describe one message. `ccLabel` names CCs the way the panel does (its knob labels). */
export function describeMidi(data: ArrayLike<number>, ccLabel?: (cc: number) => string | undefined): DescribedMidi {
  const hex = toHex(data);
  const m = parseMidi(data);
  if (!m) return { kind: 'Data', channel: null, detail: '', hex };
  switch (m.type) {
    case 'noteon': return { kind: 'Note on', channel: m.channel, detail: `${midiNoteName(m.note)} (${m.note}) · vel ${m.velocity}`, hex };
    case 'noteoff': return { kind: 'Note off', channel: m.channel, detail: `${midiNoteName(m.note)} (${m.note})`, hex };
    case 'cc': {
      const name = ccLabel?.(m.cc) ?? CC_NAMES[m.cc];
      return { kind: 'CC', channel: m.channel, detail: `${m.cc}${name ? ` ${name}` : ''} = ${m.value}`, hex };
    }
    case 'program': return { kind: 'Program', channel: m.channel, detail: `${m.program + 1} (MIDI value ${m.program})`, hex };
    case 'pitchbend': {
      const v = m.raw - 8192;
      return { kind: 'Pitch bend', channel: m.channel, detail: `${v > 0 ? '+' : ''}${v}`, hex };
    }
    case 'aftertouch': return { kind: 'Aftertouch', channel: m.channel, detail: String(m.value), hex };
    case 'polyaftertouch': return { kind: 'Poly AT', channel: m.channel, detail: `${midiNoteName(m.note)} = ${m.value}`, hex };
    case 'clock': return { kind: 'Clock', channel: null, detail: '24 per beat', hex };
    case 'start': return { kind: 'Start', channel: null, detail: '', hex };
    case 'continue': return { kind: 'Continue', channel: null, detail: '', hex };
    case 'stop': return { kind: 'Stop', channel: null, detail: '', hex };
    case 'songposition': return { kind: 'Song position', channel: null, detail: `16th ${m.position}`, hex };
    default: return { kind: 'System', channel: null, detail: '', hex };
  }
}
