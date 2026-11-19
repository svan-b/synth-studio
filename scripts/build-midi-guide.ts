// ============================================================================
// Build the "Your synth (MIDI)" template library from the open midi.guide dataset
// (MIDI Guide by Pencil Research - github.com/pencilresearch/midi - CC BY-SA 4.0).
//
//   npx tsx scripts/build-midi-guide.ts                 # clones the dataset (git) into a temp dir
//   npx tsx scripts/build-midi-guide.ts --src ../midi   # or use a local clone
//
// Writes public/midi-guide/:
//   index.json            every device: id, manufacturer, name, parameter counts (small, loaded first)
//   devices/<id>.json     one per device: CC / NRPN parameters, suggested default knobs, drum notes
//   LICENSE.md            attribution + the CC BY-SA 4.0 license (the derived JSON is CC BY-SA 4.0 too)
// ============================================================================

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { slug, suggestKnobs, type GuideDevice, type GuideIndex, type GuideIndexEntry, type GuideNote, type GuideParam } from '../devices/midi-synth/guide';

const REPO = 'https://github.com/pencilresearch/midi';
const OUT = resolve(process.cwd(), 'public/midi-guide');
const MAX_TEXT = 220;

// ----------------------------------------------------------------------------
// CSV (RFC 4180: quoted fields, "" escapes, newlines inside quotes, BOM, CRLF)
// ----------------------------------------------------------------------------

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(f => f.trim() !== ''));
}

function records(file: string): Record<string, string>[] {
  const [header, ...rows] = parseCsv(readFileSync(file, 'utf8'));
  if (!header) return [];
  const keys = header.map(h => h.trim().toLowerCase());
  return rows.map(r => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])));
}

const int = (v: string | undefined, lo: number, hi: number): number | undefined => {
  if (v === undefined || v === '' || !/^-?\d+$/.test(v)) return undefined;
  const n = Number(v);
  return n >= lo && n <= hi ? n : undefined;
};
const text = (v: string | undefined) => {
  const t = (v ?? '').replace(/\s+/g, ' ').trim();
  return t ? (t.length > MAX_TEXT ? `${t.slice(0, MAX_TEXT - 1)}…` : t) : undefined;
};

function param(r: Record<string, string>): GuideParam | null {
  const name = text(r.parameter_name);
  if (!name) return null;
  const cc = int(r.cc_msb, 0, 127);
  const lsb = int(r.cc_lsb, 0, 127);
  const nm = int(r.nrpn_msb, 0, 127);
  const nl = int(r.nrpn_lsb, 0, 127);
  const nrpn = nm !== undefined && nl !== undefined ? nm * 128 + nl : undefined;
  if (cc === undefined && nrpn === undefined) return null;
  const p: GuideParam = { name };
  const section = text(r.section);
  if (section) p.section = section;
  if (cc !== undefined) {
    p.cc = cc;
    if (lsb !== undefined && lsb !== cc) p.lsb = lsb;
    const min = int(r.cc_min_value, 0, 127) ?? 0;
    const max = int(r.cc_max_value, 0, 127) ?? 127;
    if (min !== 0) p.min = min;
    if (max !== 127) p.max = Math.max(min, max);
    const def = int(r.cc_default_value, 0, 127);
    if (def !== undefined) p.default = def;
  }
  if (nrpn !== undefined) {
    p.nrpn = nrpn;
    const nmin = int(r.nrpn_min_value, 0, 16383) ?? 0;
    const nmax = int(r.nrpn_max_value, 0, 16383) ?? 16383;
    if (nmin !== 0) p.nrpnMin = nmin;
    if (nmax !== 16383) p.nrpnMax = Math.max(nmin, nmax);
    if (cc === undefined) {
      const def = int(r.nrpn_default_value, 0, 16383);
      if (def !== undefined) p.default = def;
    }
  }
  if (r.orientation?.toLowerCase() === 'centered') p.centered = true;
  const usage = text(r.usage);
  if (usage) p.usage = usage;
  const desc = text(r.parameter_description);
  if (desc) p.desc = desc;
  return p;
}

function note(r: Record<string, string>): GuideNote | null {
  const name = text(r.sound_name);
  const n = int(r.note_number_default_value, 0, 127) ?? int(r.note_number_min_value, 0, 127);
  if (!name || n === undefined) return null;
  const out: GuideNote = { name, note: n };
  const section = text(r.section);
  if (section) out.section = section;
  if (r.midi_channel) out.channel = r.midi_channel;
  return out;
}

// ----------------------------------------------------------------------------

function source(argv: string[]): { dir: string; temp: boolean } {
  const i = argv.indexOf('--src');
  if (i >= 0 && argv[i + 1]) return { dir: resolve(argv[i + 1]), temp: false };
  const dir = mkdtempSync(join(tmpdir(), 'midi-guide-'));
  console.log(`Cloning ${REPO} ...`);
  execFileSync('git', ['clone', '--depth', '1', `${REPO}.git`, dir], { stdio: 'inherit' });
  return { dir, temp: true };
}

function commitOf(dir: string): string | null {
  try {
    return execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function main() {
  const { dir, temp } = source(process.argv.slice(2));
  if (!existsSync(join(dir, 'LICENSE'))) throw new Error(`${dir} does not look like the midi.guide dataset (no LICENSE)`);
  const commit = commitOf(dir);

  // <Manufacturer>/<Device>.csv and <Manufacturer>/<Device>.triggers.csv
  const devices = new Map<string, { manufacturer: string; device: string; cc?: string; triggers?: string }>();
  for (const m of readdirSync(dir).sort()) {
    const mdir = join(dir, m);
    if (m.startsWith('.') || !statSync(mdir).isDirectory()) continue;
    for (const f of readdirSync(mdir).sort()) {
      if (!f.toLowerCase().endsWith('.csv')) continue;
      const triggers = f.toLowerCase().endsWith('.triggers.csv');
      const device = triggers ? f.slice(0, -'.triggers.csv'.length) : f.slice(0, -'.csv'.length);
      const key = `${m}/${device}`;
      const e = devices.get(key) ?? { manufacturer: m, device };
      if (triggers) e.triggers = join(mdir, f);
      else e.cc = join(mdir, f);
      devices.set(key, e);
    }
  }

  rmSync(join(OUT, 'devices'), { recursive: true, force: true });
  mkdirSync(join(OUT, 'devices'), { recursive: true });

  const used = new Set<string>();
  const index: GuideIndexEntry[] = [];
  let total = 0;
  let bytes = 0;
  for (const e of devices.values()) {
    const params = e.cc ? records(e.cc).map(param).filter((p): p is GuideParam => !!p) : [];
    const notes = e.triggers ? records(e.triggers).map(note).filter((n): n is GuideNote => !!n) : [];
    if (!params.length && !notes.length) continue;
    let id = slug(`${e.manufacturer} ${e.device}`) || 'device';
    for (let n = 2; used.has(id); n++) id = `${slug(`${e.manufacturer} ${e.device}`)}-${n}`;
    used.add(id);
    const file = e.cc ?? e.triggers!;
    const doc: GuideDevice = {
      id,
      manufacturer: e.manufacturer,
      device: e.device,
      source: `${REPO}/blob/main/${encodeURIComponent(e.manufacturer)}/${encodeURIComponent(basename(file))}`,
      params,
      suggested: suggestKnobs(params),
      ...(notes.length ? { notes } : {}),
    };
    const json = JSON.stringify(doc);
    bytes += json.length;
    writeFileSync(join(OUT, 'devices', `${id}.json`), json);
    index.push({
      id,
      manufacturer: e.manufacturer,
      device: e.device,
      cc: params.filter(p => p.cc !== undefined).length,
      nrpn: params.filter(p => p.cc === undefined).length,
      notes: notes.length,
    });
    total += params.length;
  }
  index.sort((a, b) => a.manufacturer.localeCompare(b.manufacturer) || a.device.localeCompare(b.device));

  const doc: GuideIndex = {
    source: 'https://midi.guide',
    repository: REPO,
    commit,
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    attribution: 'MIDI Guide by Pencil Research (https://midi.guide), CC BY-SA 4.0. Converted to JSON by Synth Studio (scripts/build-midi-guide.ts).',
    generated: new Date().toISOString().slice(0, 10),
    devices: index,
  };
  writeFileSync(join(OUT, 'index.json'), JSON.stringify(doc));
  writeFileSync(join(OUT, 'LICENSE.md'), licenseFile(readFileSync(join(dir, 'LICENSE'), 'utf8'), commit));

  console.log(`${index.length} devices, ${total} parameters, ${(bytes / 1024).toFixed(0)} KB of device JSON -> ${OUT}`);
  if (temp) rmSync(dir, { recursive: true, force: true });
}

function licenseFile(license: string, commit: string | null): string {
  return `# MIDI Guide data - attribution and license

The files in this folder (\`index.json\` and \`devices/*.json\`) are derived from
**MIDI Guide**, the MIDI CC, NRPN and notes dataset maintained by **Pencil Research**:

- Website: https://midi.guide
- Source: ${REPO}${commit ? ` (commit \`${commit}\`)` : ''}
- License: Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0),
  https://creativecommons.org/licenses/by-sa/4.0/

**Changes made:** the CSV files were converted to JSON by \`scripts/build-midi-guide.ts\`:
a subset of the columns was kept (parameter section, name, CC / CC LSB / NRPN numbers,
value ranges, defaults, orientation, usage, description - long texts shortened),
rows without a CC or NRPN number were dropped, and a list of suggested default
knobs was added to each device.

These derived files are licensed under the same **CC BY-SA 4.0** license. If you
share or adapt them, credit "MIDI Guide by Pencil Research (midi.guide)", link the
license, indicate changes, and license your contributions under CC BY-SA 4.0.

As the dataset notes, the portions that refer to specific devices may be owned by
the devices' respective manufacturers. Device and manufacturer names are
trademarks of their owners; Synth Studio is not affiliated with them or with
Pencil Research. Spotted a wrong CC? Please contribute the fix upstream at
${REPO} so everyone benefits.

---

${license.trim()}
`;
}

main();
