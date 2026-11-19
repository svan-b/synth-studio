// ============================================================================
// midi.guide templates - shared by scripts/build-midi-guide.ts (Node) and the
// "Your synth" setup dialog (browser). No browser or Node APIs here.
//
// Data: MIDI Guide by Pencil Research (https://midi.guide,
// github.com/pencilresearch/midi), CC BY-SA 4.0 - see public/midi-guide/LICENSE.md
// ============================================================================

/** One MIDI-controllable parameter of a device */
export interface GuideParam {
  section?: string;
  name: string;
  /** 7-bit CC number (MSB) */
  cc?: number;
  /** LSB CC for 14-bit resolution */
  lsb?: number;
  /** NRPN parameter number (MSB * 128 + LSB) */
  nrpn?: number;
  /** CC value range (default 0..127) */
  min?: number;
  max?: number;
  /** NRPN value range (default 0..16383) */
  nrpnMin?: number;
  nrpnMax?: number;
  default?: number;
  /** Bipolar: the middle value is "zero" */
  centered?: boolean;
  /** Value meanings, e.g. "0-31: 16'; 32-63: 8'" */
  usage?: string;
  desc?: string;
}

/** Drum / trigger note */
export interface GuideNote {
  section?: string;
  name: string;
  note: number;
  /** "10", "basic", "auto"... as documented */
  channel?: string;
}

export interface GuideDevice {
  id: string;
  manufacturer: string;
  device: string;
  /** Link to the source CSV on GitHub */
  source: string;
  params: GuideParam[];
  /** Indices into params: suggested default knobs */
  suggested: number[];
  notes?: GuideNote[];
}

export interface GuideIndexEntry {
  id: string;
  manufacturer: string;
  device: string;
  /** Parameters with a CC / with NRPN only */
  cc: number;
  nrpn: number;
  notes: number;
}

export interface GuideIndex {
  source: string;
  repository: string;
  commit: string | null;
  license: string;
  licenseUrl: string;
  attribution: string;
  generated: string;
  devices: GuideIndexEntry[];
}

export const GUIDE_BASE = '/midi-guide';
export const GUIDE_ATTRIBUTION = 'Templates from MIDI Guide by Pencil Research (midi.guide), CC BY-SA 4.0';

export function slug(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ----------------------------------------------------------------------------
// Value meanings ("usage")
// ----------------------------------------------------------------------------

export interface UsageRange {
  from: number;
  to: number;
  label: string;
}

/** "0-31: 16'; 32-63: 8'; 64~127: Morph; 5: Off" -> ranges (empty when it isn't a value table) */
export function parseUsage(usage: string | undefined): UsageRange[] {
  if (!usage) return [];
  const out: UsageRange[] = [];
  for (const part of usage.split(/;|\n/)) {
    const m = /^\s*(\d+)\s*(?:[-~–]\s*(\d+))?\s*:\s*(.+?)\s*$/.exec(part);
    if (!m) continue;
    const from = Number(m[1]);
    const to = m[2] !== undefined ? Number(m[2]) : from;
    out.push({ from: Math.min(from, to), to: Math.max(from, to), label: m[3] });
  }
  return out;
}

export function usageLabel(ranges: UsageRange[], value: number): string | null {
  const r = ranges.find(x => value >= x.from && value <= x.to);
  return r ? r.label : null;
}

// ----------------------------------------------------------------------------
// Labels short enough for a knob
// ----------------------------------------------------------------------------

export const LABEL_MAX = 16;

const ABBREVIATIONS: [RegExp, string][] = [
  [/\s*\([^)]*\)/g, ''],
  [/oscillator/gi, 'Osc'],
  [/amplifier/gi, 'Amp'],
  [/envelope/gi, 'Env'],
  [/frequency/gi, 'Freq'],
  [/resonance/gi, 'Reso'],
  [/amount/gi, 'Amt'],
  [/intensity/gi, 'Int'],
  [/modulation/gi, 'Mod'],
  [/portamento/gi, 'Porta'],
  [/feedback/gi, 'Fdbk'],
  [/distortion/gi, 'Dist'],
  [/attack/gi, 'Atk'],
  [/decay/gi, 'Dec'],
  [/sustain/gi, 'Sus'],
  [/release/gi, 'Rel'],
  [/level/gi, 'Lvl'],
  [/filter/gi, 'Flt'],
  [/velocity/gi, 'Vel'],
  [/\s+/g, ' '],
];

export function shortLabel(name: string): string {
  let s = name.trim().replace(/\s+/g, ' ');
  for (const [re, rep] of ABBREVIATIONS) {
    if (s.length <= LABEL_MAX) break;
    s = s.replace(re, rep).trim();
  }
  return s.length > LABEL_MAX ? s.slice(0, LABEL_MAX).trim() : s;
}

// ----------------------------------------------------------------------------
// Suggested default knobs: the parameters you would reach for first
// ----------------------------------------------------------------------------

/** Never suggested: protocol messages, switches, routing, sequencer/arp, performance pedals */
const EXCLUDE = new RegExp(
  [
    'bank', 'program', 'data entry', 'all notes', 'all sound', 'reset all', 'local (control|on|off)', 'omni',
    'mono (mode|on)', 'poly (mode|on)', '\\bn?rpn\\b', '\\b[ml]sb\\b', 'pedal', 'damper', 'sostenuto', '\\bmute', '\\bsolo\\b',
    'select', 'on ?/ ?off', '\\bon off\\b', 'toggle', 'enable', '\\bswitch', '\\btype\\b', 'subtype', 'assign', 'target',
    'destination', '\\bdest\\b', 'polarity', 'trig', '\\bsync\\b', '\\bclock\\b', '\\barp', '\\bseq', 'pattern', '\\bkit\\b',
    '\\bcv\\b', '\\bgate\\b', 'tempo', '\\bbpm\\b', 'chain', '\\bscale\\b', '\\bkey', 'transpose', '\\bnote', 'preset', 'patch',
    '\\btap\\b', '\\bvel', 'octave', '\\bwave(form)?\\b', '\\brange\\b', '\\bfoot', 'expression', 'breath', 'joystick', 'pan\\b',
    '\\bspread\\b', '\\bvoice\\b', 'unison', '\\bslot', 'track level', '\\bmaster\\b',
  ].join('|'),
  'i',
);

/** Higher = more useful. First match wins (most specific first). */
const WEIGHTS: [RegExp, number][] = [
  [/cutoff|brightness|(filter|vcf|lpf|flt).*\bfreq|\bfreq.*(filter|vcf)/i, 100],
  [/reso(nance)?\b|emphasis|\bpeak\b/i, 92],
  [/(filter|vcf|flt).*(env|eg).*(amt|amount|depth|int)|(env|eg) ?(amt|amount|depth|int)|contour|filter (env )?amount|eg int/i, 86],
  [/attack|\brise\b/i, 72],
  [/decay|\bfall\b/i, 70],
  [/release/i, 68],
  [/sustain/i, 66],
  [/lfo.*(rate|speed|freq)|(rate|speed).*lfo/i, 63],
  [/lfo.*(amount|depth|int|amt)|(amount|depth|int|amt).*lfo|vibrato/i, 60],
  [/drive|distortion|overdrive|saturat|\bdist\b|crush/i, 58],
  [/glide|portamento/i, 54],
  [/timbre|shape|\bpwm\b|pulse width|\bpw\b|morph|fold|colou?r|\btone\b|harmonic/i, 52],
  [/cross ?mod|\bfm\b|ring/i, 46],
  [/detune|\bfine\b|beat/i, 44],
  [/(osc|vco|dco).*(pitch|freq|tune)|pitch|tune/i, 40],
  [/sub ?osc|\bsub\b/i, 38],
  [/noise/i, 36],
  [/mix|level|balance/i, 34],
  [/delay|echo/i, 30],
  [/reverb|chorus|phaser|flanger|ensemble/i, 28],
  [/feedback|dry ?\/ ?wet|\bwet\b|depth|\btime\b/i, 24],
  [/mod(ulation)? ?(wheel|1)?/i, 16],
  [/volume/i, 12],
];

const ENV_WORD = /attack|decay|sustain|release|\brise\b|\bfall\b/i;

function stepped(p: GuideParam): boolean {
  if (p.cc === undefined && p.nrpn !== undefined) return (p.nrpnMax ?? 16383) - (p.nrpnMin ?? 0) < 16;
  if ((p.max ?? 127) - (p.min ?? 0) < 16) return true;
  return parseUsage(p.usage).length >= 2;
}

export function knobScore(p: GuideParam): number {
  const text = `${p.section ?? ''} ${p.name}`;
  if (EXCLUDE.test(p.name) || stepped(p)) return -1;
  for (const [re, w] of WEIGHTS) if (re.test(p.name) || (w >= 86 && re.test(text))) return w;
  return 8; // continuous but unknown - a last resort
}

/** Group for diversity: the section, or the name without its parameter word */
function groupOf(p: GuideParam): string {
  if (p.section?.trim()) return p.section.trim().toLowerCase();
  return p.name.toLowerCase().replace(/attack|decay|sustain|release|amount|amt|rate|depth|level|freq\w*|shape|int\w*/g, '').trim();
}

/** Pick up to `n` default knobs (indices into params, in the device's own order) */
export function suggestKnobs(params: GuideParam[], n = 16): number[] {
  const scored = params
    .map((p, i) => ({ i, p, s: knobScore(p) + (p.cc !== undefined ? 0 : -20) }))
    .filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s || a.i - b.i);
  const picked: number[] = [];
  const perGroup = new Map<string, number>();
  const seenNames = new Set<string>();
  const seenCc = new Set<number>();
  let env = 0;
  for (const x of scored) {
    if (picked.length >= n) break;
    const key = x.p.name.toLowerCase();
    if (seenNames.has(key) || (x.p.cc !== undefined && seenCc.has(x.p.cc))) continue;
    const g = groupOf(x.p);
    if ((perGroup.get(g) ?? 0) >= 4) continue;
    const isEnv = ENV_WORD.test(x.p.name);
    if (isEnv && env >= 8) continue;
    picked.push(x.i);
    perGroup.set(g, (perGroup.get(g) ?? 0) + 1);
    seenNames.add(key);
    if (x.p.cc !== undefined) seenCc.add(x.p.cc);
    if (isEnv) env++;
  }
  // Devices with few continuous parameters (FX pedals, drum machines): fill with any usable CC
  if (picked.length < Math.min(n, 4)) {
    params.forEach((p, i) => {
      if (picked.length >= n || picked.includes(i) || p.cc === undefined || EXCLUDE.test(p.name)) return;
      if (seenCc.has(p.cc)) return;
      picked.push(i);
      seenCc.add(p.cc);
    });
  }
  return picked.sort((a, b) => a - b);
}
