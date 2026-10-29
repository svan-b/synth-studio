#!/usr/bin/env node
'use strict';
// ============================================================================
// Audio QA: render every preset of every instrument in the real app and gate
// it on loudness consistency, true peak, DC, clicks, silence, stuck notes and
// errors. See docs/AUDIO_QA.md.
//
//   node scripts/audio-qa.cjs <baseUrl> [deviceId[,deviceId...]|all] [options]
//
//   --presets <regex>   only presets whose key or name matches (case-insensitive)
//   --limit N           only the first N presets of each device (quick smoke runs)
//   --out <dir>         reports go here (default: $TMPDIR/synth-studio-audio-qa)
//   --seconds N         play time before stop (default 4 = 2 bars at 120 BPM)
//   --bars N            transport play time in bars at 120 BPM (sets --seconds)
//   --tail N            capture after stop (default 2.5)
//   --excite M          auto | audition | keys | transport, or per device: dfam=audition,analog-four=transport
//   --velocity V        note velocity 0..1 for the keyboard phrase (default 1, as the on-screen keys)
//   --suggest[=all]     print the gain change (dB) that brings each loudness outlier (or every preset) to its target
//   --target LUFS       judge loudness against this absolute target instead of each device's median
//   --config <file>     JSON overrides for scripts/audio-qa/config.cjs
//   --wav[=all]         also write 32-bit float WAVs of flagged (or all) captures
//   --sample-rate N     force the AudioContext sample rate (default: the browser's)
//   --fresh             do not merge a --presets run into the existing device report
//   --no-calibrate      skip the meter calibration at the start of the run
//   --calibrate         only run the meter calibration
//   --no-fail           exit 0 even when presets are flagged
//   --headed            show the browser
//   --from <dir|json>   re-evaluate saved reports (new config / --target / --suggest) without measuring
//   --selftest          check the meters on synthetic signals (no browser)
//
// Exit code: 0 clean, 1 presets flagged, 2 tool error.
// ============================================================================

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const DEFAULTS = require('./audio-qa/config.cjs');
const M = require('./audio-qa/metrics.cjs');
const R = require('./audio-qa/report.cjs');
const { initScript, pageLib, CAPTURE_PROCESSOR } = require('./audio-qa/page.cjs');

const VERSION = 1;
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_OUT = path.join(os.tmpdir(), 'synth-studio-audio-qa');

// ----------------------------------------------------------------------------
// Arguments and config
// ----------------------------------------------------------------------------
const VALUE_FLAGS = new Set(['presets', 'limit', 'out', 'seconds', 'bars', 'tail', 'excite', 'velocity', 'config', 'from', 'target', 'sample-rate']);
const OPTIONAL_VALUE_FLAGS = new Set(['suggest', 'wav']);
const BOOL_FLAGS = new Set(['fresh', 'no-calibrate', 'calibrate', 'no-fail', 'headed', 'selftest', 'help']);

function parseArgs(argv) {
  const o = { positional: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h') { o.help = true; continue; }
    if (!a.startsWith('--')) { o.positional.push(a); continue; }
    const eq = a.indexOf('=');
    const key = a.slice(2, eq > 0 ? eq : undefined);
    const inline = eq > 0 ? a.slice(eq + 1) : undefined;
    if (VALUE_FLAGS.has(key)) {
      const v = inline !== undefined ? inline : argv[++i];
      if (v === undefined) throw new Error(`--${key} needs a value`);
      o[key] = v;
    } else if (OPTIONAL_VALUE_FLAGS.has(key)) {
      o[key] = inline !== undefined ? inline : true;
    } else if (BOOL_FLAGS.has(key)) {
      o[key] = true;
    } else throw new Error(`unknown option --${key} (see --help)`);
  }
  return o;
}

function deepMerge(base, over) {
  if (Array.isArray(over) || typeof over !== 'object' || over === null) return over;
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) out[k] = k in base && typeof base[k] === 'object' && !Array.isArray(base[k]) ? deepMerge(base[k], v) : v;
  return out;
}

function loadConfig(file) {
  let cfg = JSON.parse(JSON.stringify(DEFAULTS));
  if (file) cfg = deepMerge(cfg, JSON.parse(fs.readFileSync(path.resolve(file), 'utf8')));
  return cfg;
}

function num(v, name, lo = -Infinity, hi = Infinity) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < lo || n > hi) throw new Error(`--${name} must be a number in ${lo}..${hi}`);
  return n;
}

function usage() {
  const src = fs.readFileSync(__filename, 'utf8').split('\n');
  const start = src.findIndex(l => l.includes('node scripts/audio-qa.cjs <baseUrl>'));
  const end = src.findIndex((l, i) => i > start && l.startsWith('// ====='));
  console.log(src.slice(start, end).map(l => l.replace(/^\/\/ ?/, '')).join('\n'));
}

// ----------------------------------------------------------------------------
// Repository facts (registry categories, store version, commit)
// ----------------------------------------------------------------------------
function readRegistry() {
  try {
    const src = fs.readFileSync(path.join(ROOT, 'devices', 'index.ts'), 'utf8');
    const out = [];
    const re = /\{\s*id:\s*'([^']+)'([\s\S]*?)\bload:/g;
    let m;
    while ((m = re.exec(src))) {
      const body = m[2];
      const get = k => {
        const r = new RegExp(`\\b${k}:\\s*'((?:[^'\\\\]|\\\\.)*)'`).exec(body);
        return r ? r[1].replace(/\\'/g, "'") : null;
      };
      out.push({ id: m[1], name: get('name'), manufacturer: get('manufacturer'), category: get('category') });
    }
    return out;
  } catch {
    return [];
  }
}

function storeVersion() {
  try {
    const m = /export const STORE_VERSION\s*=\s*(\d+)/.exec(fs.readFileSync(path.join(ROOT, 'lib', 'studio', 'upgrades.ts'), 'utf8'));
    if (m) return Number(m[1]);
  } catch { /* */ }
  return 5;
}

const git = (...args) => execFileSync('git', args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
/** Paths that do not change what the app sounds like: this tool and the docs */
const NOT_APP = [':(exclude)scripts/audio-qa.cjs', ':(exclude)scripts/audio-qa', ':(exclude)docs'];

function gitCommit() {
  try {
    const sha = git('rev-parse', '--short', 'HEAD');
    const dirty = git('status', '--porcelain', '--untracked-files=no', '--', '.', ...NOT_APP);
    // The app code measured: the oldest first-parent ancestor whose app files equal HEAD's
    let app = sha;
    for (const c of git('rev-list', '--first-parent', '--max-count=50', 'HEAD').split('\n')) {
      try { git('diff', '--quiet', c, 'HEAD', '--', '.', ...NOT_APP); app = c.slice(0, 7); } catch { break; }
    }
    return { commit: sha, appCommit: dirty ? `${app}+local changes` : app };
  } catch {
    return { commit: null, appCommit: null };
  }
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------
function withTimeout(promise, ms, what) {
  let t;
  return Promise.race([
    promise,
    new Promise((_, rej) => { t = setTimeout(() => rej(new Error(`${what} timed out after ${Math.round(ms / 1000)} s`)), ms); }),
  ]).finally(() => clearTimeout(t));
}

function decodeF32(b64) {
  const buf = Buffer.from(b64, 'base64');
  const ab = new ArrayBuffer(buf.length - (buf.length % 4));
  new Uint8Array(ab).set(buf.subarray(0, ab.byteLength));
  return new Float32Array(ab);
}

function writeWav(file, L, Rch, sampleRate) {
  const n = L.length;
  const data = n * 8;
  const buf = Buffer.alloc(58 + data);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(50 + data, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(18, 16);
  buf.writeUInt16LE(3, 20); // IEEE float
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 8, 28);
  buf.writeUInt16LE(8, 32);
  buf.writeUInt16LE(32, 34);
  buf.writeUInt16LE(0, 36);
  buf.write('fact', 38);
  buf.writeUInt32LE(4, 42);
  buf.writeUInt32LE(n, 46);
  buf.write('data', 50);
  buf.writeUInt32LE(data, 54);
  for (let i = 0; i < n; i++) {
    buf.writeFloatLE(L[i], 58 + i * 8);
    buf.writeFloatLE(Rch[i], 62 + i * 8);
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buf);
}

const slug = s => String(s).replace(/[^a-z0-9._-]+/gi, '_').slice(0, 80);
const pad = (s, n) => (String(s).length >= n ? String(s).slice(0, n - 1) + ' ' : String(s) + ' '.repeat(n - String(s).length));
const lpad = (s, n) => (String(s).length >= n ? String(s) : ' '.repeat(n - String(s).length) + String(s));

function keyEvents(ex) {
  const ph = ex.phrase;
  const ev = [];
  ph.notes.forEach((note, i) => {
    ev.push({ t: i * ph.step, note, on: true });
    ev.push({ t: i * ph.step + ph.gate, note, on: false });
  });
  ev.push({ t: ph.hold.at, note: ph.hold.note, on: true });
  ev.push({ t: Math.max(ph.hold.at + 0.25, ex.seconds), note: ph.hold.note, on: false });
  return ev.sort((a, b) => a.t - b.t || (a.on ? 1 : -1));
}

function chooseExcitation(info, entry, override, cfg) {
  const dcfg = (cfg.devices && cfg.devices[info.device]) || {};
  const forced = override[info.device] || dcfg.excite || override['*'];
  const can = { audition: true, keys: !!info.keyboard, transport: !!info.transportControl };
  if (forced && forced !== 'auto') {
    if (!(forced in can)) throw new Error(`unknown excitation '${forced}' (auto | audition | keys | transport)`);
    if (can[forced]) return { mode: forced, why: 'forced with --excite' };
    console.warn(`  ${info.device}: cannot use --excite ${forced} (no ${forced === 'keys' ? 'keyboard' : 'transport control'}); using auto`);
  }
  if (info.audition) return { mode: 'audition', why: "the module's own audition()" };
  const cats = cfg.excitation.transportFirstCategories || [];
  if (info.transportControl && entry && cats.includes(entry.category)) return { mode: 'transport', why: `${entry.category}: its presets are heard by pressing ${info.transportControl.toUpperCase()}` };
  if (info.keyboard) return { mode: 'keys', why: 'keyboard instrument: standard phrase' };
  if (info.transportControl) return { mode: 'transport', why: `sequencer: ${info.transportControl.toUpperCase()} for the play time` };
  return { mode: 'audition', why: "no keyboard or transport: the hub's default audition" };
}

// ----------------------------------------------------------------------------
// Page lifecycle
// ----------------------------------------------------------------------------
async function openDevicePage(browser, device, run) {
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  await context.addInitScript(initScript, { device, storeVersion: run.storeVersion, bpm: run.ex.bpm, sampleRate: run.sampleRate || 0 });
  const page = await context.newPage();
  const sink = { bucket: null, setup: [] };
  const push = e => (sink.bucket || sink.setup).push(e);
  page.on('console', msg => { if (msg.type() === 'error') push({ kind: 'console', message: msg.text().slice(0, 400) }); });
  page.on('pageerror', err => push({ kind: 'pageerror', message: String((err && err.message) || err).slice(0, 400) }));
  page.on('crash', () => push({ kind: 'crash', message: 'the page crashed' }));
  page.on('requestfailed', req => {
    const why = req.failure() ? req.failure().errorText : '';
    if (!/ERR_ABORTED/.test(why)) push({ kind: 'requestfailed', message: `${req.url()} ${why}` });
  });
  await page.goto(run.baseUrl, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForFunction(() => window.__synthStudio && window.__audioQA, null, { timeout: 30000 });
  await page.evaluate(pageLib, { captureSrc: CAPTURE_PROCESSOR });
  const info = await withTimeout(page.evaluate(([d, o]) => window.__qa.setup(d, o), [device, { bpm: run.ex.bpm }]), 60000, `setting up ${device}`);
  return { context, page, sink, info };
}

async function closePage(p) {
  if (!p) return;
  try { await p.context.close(); } catch { /* already gone */ }
}

async function alive(page) {
  try { return (await withTimeout(page.evaluate(() => 1), 5000, 'ping')) === 1; } catch { return false; }
}

async function applyPreset(page, device, key) {
  try {
    await page.selectOption(`[data-instance="${device}"] select[aria-label="Load preset"]`, key, { timeout: 4000 });
    return 'ui';
  } catch {
    await page.evaluate(k => window.__qa.applyFallback(k), key);
    return 'store-fallback';
  }
}

// ----------------------------------------------------------------------------
// Calibration
// ----------------------------------------------------------------------------
const CAL_TESTS = [
  {
    id: 'reference', name: '1 kHz sine at -20 dBFS in one channel (BS.1770 reference)',
    signal: { kind: 'sine-one-channel', freq: 1000, amp: 0.1, steady: true }, seconds: 3, tail: 0.3,
    checks: a => [['sample peak', a.samplePeakDb, -20, 0.05, 'dBFS'], ['integrated', a.lufs, -23.01, 0.3, 'LUFS']],
  },
  {
    id: 'dual-mono', name: '1 kHz sine at -20 dBFS from a mono node (heard on L and R)',
    signal: { kind: 'sine', freq: 1000, amp: 0.1, steady: true }, seconds: 3, tail: 0.3,
    checks: a => [['sample peak', a.samplePeakDb, -20, 0.05, 'dBFS'], ['integrated', a.lufs, -19.99, 0.3, 'LUFS']],
  },
  {
    id: 'true-peak', name: 'fs/4 sine at 45 deg, amplitude -6.02 dBFS (inter-sample peaks)',
    signal: { kind: 'quarter-rate', amp: 0.5, steady: true }, seconds: 2, tail: 0.3,
    checks: a => [['sample peak', a.samplePeakDb, -9.03, 0.05, 'dBFS'], ['true peak', a.truePeakDb, -6.02, [-0.4, 0.2], 'dBTP']],
  },
  {
    id: 'dc', name: 'constant +0.01 (DC offset)',
    signal: { kind: 'dc', offset: 0.01, steady: true }, seconds: 2, tail: 0.3,
    checks: a => [['DC', a.dc, 0.01, 0.0002, '']],
  },
  {
    id: 'click', name: '1 kHz sine at -20 dBFS with a 90 deg phase jump',
    signal: { kind: 'phase-jump', freq: 1000, amp: 0.1, seconds: 2 }, seconds: 2.2, tail: 2.5,
    checks: a => [['clicks', a.clicks.count, 1, 0, ''], ['mid-sound clicks', a.clicks.kinds.mid, 1, 0, '']],
  },
  {
    id: 'silence', name: 'nothing connected (the idle instrument)',
    signal: { kind: 'none' }, seconds: 1, tail: 2.5,
    checks: a => [['peak', a.samplePeakDb, -70, 'below', 'dBFS'], ['silent flag', a.silent ? 1 : 0, 1, 0, '(1 = raised)']],
  },
  {
    id: 'stuck', name: '1 kHz sine at -20 dBFS left on after stop',
    signal: { kind: 'sine', freq: 1000, amp: 0.1, keepAfterStop: true }, seconds: 1, tail: 2.5,
    checks: a => [['tail peak 2 s after stop', a.tail ? a.tail.peakDb : null, -20, 0.1, 'dBFS']],
  },
];

async function calibrate(page, info, run) {
  const out = { device: info.device, sampleRate: info.sampleRate, tests: [], ok: true };
  for (const t of CAL_TESTS) {
    await page.evaluate(() => window.__qa.reset());
    await page.evaluate(o => window.__qa.waitQuiet(o), run.cfg.quiet);
    const cap = await withTimeout(page.evaluate(o => window.__qa.capture(o), {
      mode: 'signal', signal: t.signal, seconds: t.seconds, tail: t.tail, preroll: 0.1, settleMs: 0,
    }), 60000, `calibration ${t.id}`);
    const ch = cap.pcm.map(decodeF32);
    const marks = {};
    cap.marks.forEach(m => { marks[m.name] = m.frame; });
    const a = M.analyzeTap([ch[0], ch[1]], cap.sampleRate, marks, { stereo: true, clicks: run.cfg.clicks, tail: { afterSec: run.cfg.thresholds.tailAfterSec } });
    const res = t.checks(a).map(([what, v, expect, tol, unit]) => {
      const u = unit ? ' ' + unit : '';
      const f = x => (!Number.isFinite(x) ? (x === -Infinity ? '-inf' : String(x)) : Math.abs(expect) < 0.1 && expect !== 0 ? x.toFixed(4) : Number.isInteger(expect) && Number.isInteger(x) ? String(x) : x.toFixed(2));
      if (tol === 'below') {
        const ok = typeof v === 'number' && v < expect;
        return { what, value: v, ok, measured: `${what} ${f(v)}${u}`, expected: `${what} below ${expect}${u}` };
      }
      const [lo, hi] = Array.isArray(tol) ? [expect + tol[0], expect + tol[1]] : [expect - tol, expect + tol];
      const ok = Number.isFinite(v) && v >= lo - 1e-9 && v <= hi + 1e-9;
      const tolText = Array.isArray(tol) ? `${tol[1] >= 0 ? '+' : ''}${tol[1]}/${tol[0]}` : tol ? `+-${tol}` : 'exactly';
      return { what, value: v, ok, measured: `${what} ${f(v)}${u}`, expected: `${f(expect)}${u} ${tolText}` };
    });
    if (t.id === 'reference' && cap.taps.masterFeeds > 0) {
      const m = M.analyzeTap([ch[2], ch[3]], cap.sampleRate, marks, { full: false });
      out.master = `${R.fx(m.lufs, 2)} LUFS, sample peak ${R.fx(m.samplePeakDb, 2)} dBFS (${R.signed(m.lufs - a.lufs, 2)} LU through the master bus)`;
    }
    const ok = res.every(r => r.ok);
    if (!ok) out.ok = false;
    out.tests.push({ id: t.id, name: t.name, measured: res.map(r => r.measured).join(', '), expected: res.map(r => r.expected).join(', '), ok, values: res.map(r => ({ what: r.what, value: Number.isFinite(r.value) ? +r.value.toFixed(4) : null })) });
    console.log(`  ${ok ? 'pass' : 'FAIL'}  ${t.name}: ${res.map(r => r.measured).join(', ')}  (expected ${res.map(r => r.expected).join(', ')})`);
  }
  if (out.master) console.log(`        master output during the reference: ${out.master}`);
  return out;
}

// ----------------------------------------------------------------------------
// One preset
// ----------------------------------------------------------------------------
function analyzeCapture(rec, cap, run, th) {
  const sr = cap.sampleRate;
  const ch = cap.pcm.map(decodeF32);
  const marks = {};
  cap.marks.forEach(m => { marks[m.name] = m.frame; });
  const stereo = cap.layout[0][2] > 0;
  rec.output = stereo ? 'stereo' : 'mono';
  rec.inst = R.compact(M.analyzeTap([ch[0], ch[1]], sr, { excite: marks.excite, stop: marks.stop }, {
    stereo, clicks: run.cfg.clicks, tail: { afterSec: th.tailAfterSec }, silentDb: th.silentDbfs,
  }));
  rec.master = cap.taps.masterFeeds > 0 ? R.compact(M.analyzeTap([ch[2], ch[3]], sr, marks, { full: false, silentDb: th.silentDbfs })) : null;
  if (rec.master) rec.master.deltaLu = Number.isFinite(rec.master.lufs) && Number.isFinite(rec.inst.lufs) ? +(rec.master.lufs - rec.inst.lufs).toFixed(2) : null;
  rec.capture = {
    seconds: +(cap.frames / sr).toFixed(3), excite: marks.excite != null ? +(marks.excite / sr).toFixed(3) : null,
    stop: marks.stop != null ? +(marks.stop / sr).toFixed(3) : null, realtime: cap.realtime, wallMs: cap.wallMs,
    channels: { mono: cap.layout[0][1], stereo: cap.layout[0][2], none: cap.layout[0][0] }, masterFeeds: cap.taps.masterFeeds, tap: cap.taps.tap,
  };
  (cap.errors || []).forEach(e => rec.errors.push({ kind: e.kind, message: e.processor ? `${e.processor}: ${e.message}` : e.message }));
  const notes = rec.runNotes;
  if (cap.nonFinite && cap.nonFinite[0]) notes.push(`${cap.nonFinite[0]} non-finite samples seen by the capture`);
  if (cap.stateChanges && cap.stateChanges.length) rec.errors.push({ kind: 'audiocontext', message: `state changed during the capture: ${cap.stateChanges.map(s => s.state).join(' > ')}` });
  if (cap.realtime < 0.9) notes.push(`audio ran at ${cap.realtime}x realtime (CPU contention): timing may be off`);
  if (cap.layout[0][0] > 0) notes.push(`instrument tap had no input for ${cap.layout[0][0]} render quanta`);
  if (cap.afterStop && cap.afterStop.transportPlaying) notes.push('the studio transport was still running after stop');
  return ch;
}

async function runPreset(dp, pr, idx, total, run) {
  const { page, sink, th } = dp;
  const device = dp.info.device;
  const rec = { key: pr.key, name: pr.name, source: pr.source, cables: pr.cables, errors: [], runNotes: [] };
  sink.bucket = rec.errors;
  const t0 = Date.now();
  let ch = null;
  try {
    await withTimeout(page.evaluate(() => window.__qa.reset()), 15000, 'reset');
    rec.quiet = await withTimeout(page.evaluate(o => window.__qa.waitQuiet(o), run.cfg.quiet), run.cfg.quiet.timeoutMs + 10000, 'wait for silence');
    if (!rec.quiet.quiet && !rec.quiet.floor) rec.runNotes.push(`the previous preset was still at ${R.fx(rec.quiet.levelDb)} dBFS when this one was applied`);
    else if (rec.quiet.floor) rec.runNotes.push(`constant idle floor ${R.fx(rec.quiet.levelDb)} dBFS before the preset`);
    rec.appliedVia = await applyPreset(page, device, pr.key);
    rec.verify = await page.evaluate(k => window.__qa.verify(k), pr.key);
    if (rec.verify.mismatchCount) rec.runNotes.push(`${rec.verify.mismatchCount} settings differ from the preset after loading (${rec.verify.mismatched.join(', ')})`);
    if (rec.verify.cables !== rec.verify.expectedCables) rec.runNotes.push(`${rec.verify.cables} cables after loading, preset has ${rec.verify.expectedCables}`);
    if (rec.verify.transportOn) rec.runNotes.push('the preset turns the transport on by itself');
    const opts = {
      mode: dp.excitation.mode, seconds: run.ex.seconds, tail: run.ex.tail, preroll: run.ex.preroll, settleMs: run.ex.settleMs,
      velocity: run.ex.velocity, events: dp.excitation.mode === 'keys' ? keyEvents(run.ex) : null,
    };
    const cap = await withTimeout(page.evaluate(o => window.__qa.capture(o), opts), (run.ex.seconds + run.ex.tail) * 4000 + 30000, 'capture');
    ch = analyzeCapture(rec, cap, run, th);
  } catch (err) {
    rec.runError = String((err && err.message) || err).split('\n')[0].slice(0, 300);
  }
  sink.bucket = null;
  rec.ms = Date.now() - t0;
  const rule = R.ruleFor(pr.name, dp.rules);
  const flags = R.computeFlags({ ...rec, target: null, rule: rule ? { name: rule.name, sustain: !!rule.sustain } : null }, th);
  const i = rec.inst;
  const line = i
    ? `${lpad(R.fx(i.lufs), 6)} LUFS  TP ${lpad(R.signed(i.truePeakDb), 5)}  tail ${lpad(i.tail ? R.fx(i.tail.peakDb, 0) : '-', 4)}  ${flags.length ? flags.map(f => (f.id === 'clicks' ? `clicks(${i.clicks.count})` : f.id)).join(', ') : 'ok'}`
    : `failed: ${rec.runError}`;
  console.log(`  [${lpad(idx + 1, String(total).length)}/${total}] ${pad(pr.name, 40)} ${line}`);
  return { rec, ch, flags };
}

// ----------------------------------------------------------------------------
// One device
// ----------------------------------------------------------------------------
async function runDevice(browser, device, run, calibration) {
  const entry = run.registry.find(e => e.id === device) || null;
  let dp;
  try {
    dp = await openDevicePage(browser, device, run);
  } catch (err) {
    console.log(`[${device}] could not be set up: ${String(err.message || err).split('\n')[0]}`);
    return { device, error: String(err.message || err) };
  }
  const info = dp.info;
  if (!run.sampleRate) run.actualRate = info.sampleRate;
  if (!info.presets.length) {
    console.log(`[${device}] ${info.name}: no presets - skipped`);
    await closePage(dp);
    return { device, skipped: 'no presets' };
  }
  // Devices with no sound of their own (config `skip`): their presets are routings or levels
  const skipWhy = run.cfg.devices && run.cfg.devices[device] && run.cfg.devices[device].skip;
  if (skipWhy) {
    console.log(`[${device}] ${info.name}: ${skipWhy} - skipped`);
    await closePage(dp);
    return { device, skipped: skipWhy };
  }
  if (calibration && !calibration.done) {
    console.log(`calibration (${device}, ${info.sampleRate} Hz):`);
    try {
      calibration.result = await calibrate(dp.page, info, run);
    } catch (err) {
      calibration.result = { device, sampleRate: info.sampleRate, ok: false, tests: [{ name: 'calibration run', measured: String(err.message || err), expected: 'completes', ok: false }] };
      console.log(`  FAIL calibration did not complete: ${err.message || err}`);
    }
    calibration.done = true;
  }
  let presets = info.presets;
  if (run.presetRe) presets = presets.filter(p => run.presetRe.test(p.key) || run.presetRe.test(p.name));
  if (run.limit) presets = presets.slice(0, run.limit);
  const dcfg = (run.cfg.devices && run.cfg.devices[device]) || {};
  dp.th = { ...run.cfg.thresholds, ...(dcfg.thresholds || {}) };
  dp.rules = dcfg.categories || run.cfg.categories || [];
  dp.excitation = chooseExcitation(info, entry, run.override, run.cfg);
  console.log(`[${device}] ${info.name}: ${presets.length}${presets.length !== info.presets.length ? ` of ${info.presets.length}` : ''} presets, excitation ${dp.excitation.mode} (${dp.excitation.why}), ${info.sampleRate} Hz, tap ${info.tap}, ${info.masterFeeds ? 'master tapped' : 'no master tap'}${info.presetSelect ? '' : ', preset menu not found (store fallback)'}`);
  if (dp.sink.setup.length) console.log(`  setup errors: ${dp.sink.setup.map(e => e.message).join(' | ').slice(0, 300)}`);

  const records = [];
  let recoveries = 0;
  for (let i = 0; i < presets.length; i++) {
    const { rec, ch, flags } = await runPreset(dp, presets[i], i, presets.length, run);
    rec.excitation = dp.excitation.mode;
    rec.measuredAt = new Date().toISOString();
    records.push(rec);
    if (ch && run.wav && (run.wav === 'all' || flags.length)) {
      const base = path.join(run.out, 'wav', device, slug(rec.key));
      writeWav(`${base}.inst.wav`, ch[0], ch[1], info.sampleRate);
      if (rec.master) writeWav(`${base}.master.wav`, ch[2], ch[3], info.sampleRate);
    }
    if (rec.runError && (!browser.isConnected() || !(await alive(dp.page)))) {
      if (!browser.isConnected()) {
        console.log(`  [${device}] the browser went away`);
        presets.slice(i + 1).forEach(p => records.push({ key: p.key, name: p.name, source: p.source, cables: p.cables, errors: [], runNotes: [], runError: 'not measured: the browser went away' }));
        break;
      }
      if (++recoveries > 3) {
        console.log(`  [${device}] page keeps failing - giving up on the remaining presets`);
        presets.slice(i + 1).forEach(p => records.push({ key: p.key, name: p.name, source: p.source, cables: p.cables, errors: [], runNotes: [], runError: 'not measured: the page kept failing' }));
        break;
      }
      console.log(`  [${device}] page not responding - reopening`);
      await closePage(dp);
      try {
        const reopened = await openDevicePage(browser, device, run);
        reopened.excitation = dp.excitation;
        reopened.th = dp.th;
        reopened.rules = dp.rules;
        reopened.sink.setup.unshift(...dp.sink.setup);
        dp = reopened;
      } catch (err) {
        console.log(`  [${device}] could not reopen: ${err.message || err}`);
        presets.slice(i + 1).forEach(p => records.push({ key: p.key, name: p.name, source: p.source, cables: p.cables, errors: [], runNotes: [], runError: 'not measured: the page could not be reopened' }));
        break;
      }
    }
  }
  const setupErrors = dp.sink.setup.slice(0, 20);
  await closePage(dp);

  const output = records.some(r => r.output === 'stereo') ? 'stereo' : 'mono';
  let rep = {
    kind: 'audio-qa-device',
    tool: { name: 'audio-qa', version: VERSION },
    run: {
      date: new Date().toISOString(), started: run.started, baseUrl: run.baseUrl, commit: run.commit, appCommit: run.appCommit, buildId: info.buildId, browser: run.browserVersion,
      sampleRate: info.sampleRate, options: { ...run.ex, presets: run.args.presets || null, excite: run.args.excite || 'auto' },
    },
    device: {
      id: device, name: info.name, manufacturer: info.manufacturer, category: entry ? entry.category : null,
      keyboard: info.keyboard, transportControl: info.transportControl, audition: info.audition, midiSync: info.midiSync,
      output, excitation: dp.excitation, presetsInSpec: info.presets.length,
    },
    setupErrors,
    presets: records,
  };
  const file = path.join(run.out, `${device}.json`);
  if ((run.presetRe || run.limit) && !run.args.fresh && fs.existsSync(file)) rep = mergeReports(JSON.parse(fs.readFileSync(file, 'utf8')), rep, info.presets);
  R.evaluateDevice(rep, run.cfg, { target: run.target });
  fs.writeFileSync(file, JSON.stringify(rep, null, 1) + '\n');
  fs.writeFileSync(path.join(run.out, `${device}.md`), R.deviceMarkdown(rep) + '\n');
  const s = rep.stats;
  console.log(`[${device}] median ${R.fx(s.median)} LUFS, spread ${R.fx(s.spread)} LU, ${s.flagged} of ${s.presets} flagged (${Object.entries(s.flagCounts).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}) -> ${path.join(run.out, device + '.md')}`);
  return { device, report: rep };
}

/** A --presets run replaces those presets in the previous full report */
function mergeReports(prev, next, specPresets) {
  if (!prev || prev.kind !== 'audio-qa-device' || !Array.isArray(prev.presets)) return next;
  const byKey = new Map(prev.presets.map(p => [p.key, p]));
  next.presets.forEach(p => byKey.set(p.key, p));
  const order = specPresets.map(p => p.key);
  next.presets = order.filter(k => byKey.has(k)).map(k => byKey.get(k));
  next.run.merged = { from: prev.run && prev.run.date, remeasured: next.presets.filter(p => p.measuredAt && p.measuredAt >= next.run.started).length, kept: next.presets.filter(p => !(p.measuredAt && p.measuredAt >= next.run.started)).length };
  return next;
}

// ----------------------------------------------------------------------------
// Summary, suggestions
// ----------------------------------------------------------------------------
function writeSummary(out, extra) {
  const reports = R.loadDeviceReports(out);
  if (!reports.length) return null;
  const prevFile = path.join(out, 'summary.json');
  let prev = null;
  try { prev = JSON.parse(fs.readFileSync(prevFile, 'utf8')); } catch { /* none */ }
  const measuredIds = new Set(reports.map(r => r.device.id));
  const skipped = [...((prev && prev.skipped) || []), ...(extra.skipped || [])]
    .filter((s, i, a) => !measuredIds.has(s.id) && a.findIndex(x => x.id === s.id) === i);
  const calibration = extra.calibration || (prev && prev.calibration) || null;
  const sum = R.summaryOf(reports, { calibration, skipped, order: extra.order });
  fs.writeFileSync(prevFile, JSON.stringify(sum, null, 1) + '\n');
  fs.writeFileSync(path.join(out, 'SUMMARY.md'), R.summaryMarkdown(sum, reports) + '\n');
  return sum;
}

function printSuggestions(reports, all) {
  const rows = [];
  reports.forEach(rep => rep.presets.forEach(p => {
    if (!p.inst || !R.fin(p.inst.lufs) || !R.fin(p.target)) return;
    if (!all && !p.suggestion) return;
    const gain = +(p.target - p.inst.lufs).toFixed(1);
    const tpAfter = R.fin(p.inst.truePeakDb) ? p.inst.truePeakDb + gain : null;
    rows.push({ device: rep.device.id, name: p.name, key: p.key, category: p.category, lufs: p.inst.lufs, target: p.target, gain, tpAfter, outlier: !!p.suggestion, ceiling: rep.stats.thresholds.truePeakDbtp });
  }));
  console.log('');
  console.log(all ? 'Gain change (dB) that brings each preset to its category target. Nothing was edited.' : 'Suggested gain changes (dB) for loudness outliers, to their category target. Nothing was edited.');
  if (!rows.length) { console.log('  none'); return; }
  console.log(`  ${pad('device', 14)}${pad('preset', 42)}${pad('category', 16)}${lpad('LUFS', 7)}${lpad('target', 8)}${lpad('change', 9)}   true peak after`);
  rows.sort((a, b) => a.device.localeCompare(b.device) || Math.abs(b.gain) - Math.abs(a.gain)).forEach(r => {
    const warn = R.fin(r.tpAfter) && r.tpAfter > r.ceiling ? '  (over the ceiling: needs limiting or a lower target)' : '';
    console.log(`  ${pad(r.device, 14)}${pad(r.name, 42)}${pad(r.category, 16)}${lpad(R.fx(r.lufs), 7)}${lpad(R.fx(r.target), 8)}${lpad(R.signed(r.gain) + ' dB', 9)}   ${R.signed(r.tpAfter)} dBTP${all && !r.outlier ? '  (within tolerance)' : ''}${warn}`);
  });
}

function fromReports(args, cfg) {
  const src = path.resolve(args.from);
  const reports = fs.statSync(src).isDirectory() ? R.loadDeviceReports(src) : [JSON.parse(fs.readFileSync(src, 'utf8'))];
  const only = args.positional.length ? new Set(args.positional.join(',').split(',')) : null;
  const chosen = reports.filter(r => r.kind === 'audio-qa-device' && (!only || only.has('all') || only.has(r.device.id)));
  if (!chosen.length) throw new Error(`no device reports in ${src}`);
  const target = args.target !== undefined ? num(args.target, 'target', -70, 0) : null;
  chosen.forEach(rep => R.evaluateDevice(rep, cfg, { target }));
  chosen.forEach(rep => {
    const s = rep.stats;
    console.log(`${pad(rep.device.id, 14)} ${lpad(s.presets, 3)} presets  median ${lpad(R.fx(s.median), 6)} LUFS  spread ${lpad(R.fx(s.spread), 5)} LU  flagged ${s.flagged} (${Object.entries(s.flagCounts).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'})`);
  });
  if (args.out) {
    const out = path.resolve(args.out);
    fs.mkdirSync(out, { recursive: true });
    chosen.forEach(rep => {
      fs.writeFileSync(path.join(out, `${rep.device.id}.json`), JSON.stringify(rep, null, 1) + '\n');
      fs.writeFileSync(path.join(out, `${rep.device.id}.md`), R.deviceMarkdown(rep) + '\n');
    });
    let cal = null;
    try { cal = JSON.parse(fs.readFileSync(path.join(fs.statSync(src).isDirectory() ? src : path.dirname(src), 'summary.json'), 'utf8')).calibration; } catch { /* */ }
    writeSummary(out, { calibration: cal, order: readRegistry().map(e => e.id) });
    console.log(`re-evaluated reports written to ${out}`);
  }
  if (args.suggest) printSuggestions(chosen, args.suggest === 'all');
  return chosen.some(r => r.stats.flagged) && !args['no-fail'] ? 1 : 0;
}

// ----------------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------------
async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { usage(); return 0; }
  const cfg = loadConfig(args.config);
  if (args.selftest) {
    console.log('audio-qa self-test (synthetic signals):');
    const r = require('./audio-qa/selftest.cjs').run();
    return r.failed ? 2 : 0;
  }
  if (args.from) return fromReports(args, cfg);

  const [baseUrlArg, which = 'all'] = args.positional;
  if (!baseUrlArg) { usage(); return 2; }
  const baseUrl = baseUrlArg.replace(/\/+$/, '');
  const ex = { ...cfg.excitation };
  if (args.bars !== undefined) ex.seconds = num(args.bars, 'bars', 0.25, 64) * (240 / ex.bpm);
  if (args.seconds !== undefined) ex.seconds = num(args.seconds, 'seconds', 0.5, 120);
  if (args.tail !== undefined) ex.tail = num(args.tail, 'tail', 0, 60);
  if (args.velocity !== undefined) ex.velocity = num(args.velocity, 'velocity', 0, 1);
  if (ex.seconds < ex.phrase.hold.at + 0.25) console.warn(`note: --seconds ${ex.seconds} is shorter than the keyboard phrase (${ex.phrase.hold.at + 0.25} s); keys mode plays the whole phrase`);
  if (ex.tail < cfg.thresholds.tailAfterSec + 0.1) console.warn(`note: --tail ${ex.tail} s is too short to measure the level ${cfg.thresholds.tailAfterSec} s after stop`);
  const override = {};
  if (args.excite) {
    String(args.excite).split(',').forEach(part => {
      const [k, v] = part.includes('=') ? part.split('=') : ['*', part];
      if (!['auto', 'audition', 'keys', 'transport'].includes(v.trim())) throw new Error(`--excite: unknown mode '${v.trim()}' (auto | audition | keys | transport)`);
      override[k.trim()] = v.trim();
    });
  }
  const registry = readRegistry();
  let devices;
  if (which === 'all') {
    if (!registry.length) throw new Error('could not read devices/index.ts to list the devices; pass device ids');
    devices = registry.map(e => e.id);
  } else devices = which.split(',').map(s => s.trim()).filter(Boolean);

  const out = path.resolve(args.out || DEFAULT_OUT);
  fs.mkdirSync(out, { recursive: true });
  const { chromium } = require('playwright');
  const launch = () => chromium.launch({ headless: !args.headed, args: ['--autoplay-policy=no-user-gesture-required'] });
  let browser = await launch();
  const run = {
    args, cfg, ex, baseUrl, out, registry, override, th: cfg.thresholds,
    presetRe: args.presets ? new RegExp(args.presets, 'i') : null,
    limit: args.limit !== undefined ? num(args.limit, 'limit', 1, 1e6) : 0,
    target: args.target !== undefined ? num(args.target, 'target', -70, 0) : null,
    wav: args.wav ? (args.wav === 'all' ? 'all' : 'flagged') : null,
    sampleRate: args['sample-rate'] ? num(args['sample-rate'], 'sample-rate', 8000, 192000) : 0,
    storeVersion: storeVersion(), ...gitCommit(), browserVersion: browser.version(), started: new Date().toISOString(),
  };
  console.log(`audio-qa ${baseUrl}: ${devices.join(', ')}; ${ex.seconds} s + ${ex.tail} s tail; reports in ${out}`);
  const results = [];
  const calibration = args['no-calibrate'] ? null : { done: false };
  try {
    if (args.calibrate) {
      const device = which === 'all' ? devices[0] : devices[0];
      const dp = await openDevicePage(browser, device, run);
      console.log(`calibration (${device}, ${dp.info.sampleRate} Hz):`);
      const cal = await calibrate(dp.page, dp.info, run);
      await closePage(dp);
      fs.writeFileSync(path.join(out, 'calibration.json'), JSON.stringify(cal, null, 1) + '\n');
      fs.writeFileSync(path.join(out, 'calibration.md'), `# Audio QA meter calibration\n\n${R.calibrationMarkdown(cal)}\n`);
      return cal.ok ? 0 : 1;
    }
    for (const device of devices) {
      if (!browser.isConnected()) {
        console.log('  the browser went away - relaunching it');
        browser = await launch();
      }
      results.push(await runDevice(browser, device, run, calibration));
    }
  } finally {
    try { await browser.close(); } catch { /* already gone */ }
  }
  if (calibration && calibration.result) {
    fs.writeFileSync(path.join(out, 'calibration.json'), JSON.stringify(calibration.result, null, 1) + '\n');
    fs.writeFileSync(path.join(out, 'calibration.md'), `# Audio QA meter calibration\n\n${R.calibrationMarkdown(calibration.result)}\n`);
  }
  const skipped = results.filter(r => r.skipped || r.error).map(r => ({ id: r.device, why: r.skipped || `setup failed: ${String(r.error).split('\n')[0]}` }));
  const sum = writeSummary(out, { calibration: calibration && calibration.result, skipped, order: registry.map(e => e.id) });
  const reports = results.filter(r => r.report).map(r => r.report);
  if (sum) console.log(`summary: ${sum.devices.length} devices, ${sum.presets} presets, ${sum.flagged} flagged -> ${path.join(out, 'SUMMARY.md')}`);
  if (args.suggest) printSuggestions(reports, args.suggest === 'all');
  if (results.some(r => r.error)) return 2;
  if (calibration && calibration.result && !calibration.result.ok) return 2;
  return reports.some(r => r.stats.flagged || r.stats.setupErrors) && !args['no-fail'] ? 1 : 0;
}

main().then(code => { process.exitCode = code; }, err => {
  console.error(`audio-qa: ${process.env.AUDIO_QA_DEBUG && err && err.stack ? err.stack : (err && err.message) || err}`);
  process.exitCode = 2;
});
