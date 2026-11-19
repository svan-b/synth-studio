// ============================================================================
// Recordings of the demo tracks, for the lessons' demo hooks (`info.play`,
// `listen.demo`) and the demo cards' Listen button: public/demos/*.m4a and
// public/demos/manifest.json. How and when to run it: docs/DEMOS.md.
//
//   node scripts/render-demos.cjs <baseUrl> [--only ltl,ltl-drums] [--wav <dir>] [--encode-only]
//                                 [--kbps 128] [--full-kbps 96] [--headed]
//
// The real app makes them, in headless Chromium, through the demos' own bounce:
// each render loads a demo from the studio's Demo tracks (lib/studio/demos,
// loadDemo), sets up a variation (a recipe below: an instrument muted, a pattern
// setting, a level), and bounces the song from bar 1 with the studio's Bounce…
// dialog (lib/studio/bounce.ts: a 24-bit WAV of the master, bar 1 on its first
// sample, plus the tails). A variation only needs the song up to its excerpt, so
// its render ends one bar after it. The transport's own ticks give the bar lines;
// a render whose ticks went out late (a busy machine stalled the page, so those
// notes would play late) is done again.
//
// Then ffmpeg cuts every excerpt exactly on its bar lines (no fade in, so an A/B loops
// onto a whole downbeat; the player fades in a first start), the next bar following and
// fading out over 0.8 s after the loop the A/B plays, encodes AAC-LC
// in .m4a (excerpts at --kbps, the full tracks at --full-kbps) 3 dB down (AAC overshoots
// the -1 dBTP masters on transients; the player's trim makes the level up), and measures each
// file as it decodes: integrated loudness over its bars (BS.1770 / EBU R128) and
// true peak. The manifest lists every file: demo, bars, variation, what changed,
// length, loudness and size. EXCERPTS below are exactly the ones the lessons use;
// `npm run validate` checks both ways.
//
// Needs ffmpeg (/usr/bin/ffmpeg or on PATH) and a production build:
//   npm run build && npx next start -p 3100
//   node scripts/render-demos.cjs http://localhost:3100
// ============================================================================
const { chromium } = require('playwright');
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { initScript } = require('./e2e/demoTap.cjs');

const args = process.argv.slice(2);
const valueFlags = new Set(['--only', '--wav', '--kbps', '--full-kbps']);
const base = args.find((a, i) => !a.startsWith('--') && !valueFlags.has(args[i - 1])) ?? 'http://localhost:3100';
const opt = name => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'public', 'demos');
const WAV_DIR = path.resolve(opt('wav') ?? path.join(os.tmpdir(), 'synth-demo-renders'));
const ONLY = opt('only') ? new Set(opt('only').split(',')) : null;
const ENCODE_ONLY = args.includes('--encode-only');
const KBPS = Number(opt('kbps') ?? 128);
const FULL_KBPS = Number(opt('full-kbps') ?? 96);
const FFMPEG = fs.existsSync('/usr/bin/ffmpeg') ? '/usr/bin/ffmpeg' : 'ffmpeg';
/** public/demos may hold at most this much (docs/DEMOS.md) */
const BUDGET_BYTES = 10_000_000;
const FADE_OUT = 0.8;
/**
 * Encoded this much below the bounce, dB: AAC overshoots sharp transients (up to +3 dB over the
 * -1 dBTP masters at 96 kbps), and the decoded files should stay below full scale on every
 * decoder. The player trims every file down to the studio's level from its measured loudness
 * anyway, so the headroom costs nothing.
 */
const HEADROOM_DB = 3;
/** The full tracks keep at most this much of the tail after the song's last bar line */
const FULL_TAIL = 6;
/** The transport's look-ahead while rendering, seconds (0.1 on screen, 1.8 on a hidden iPad page) */
const LOOKAHEAD = 0.5;
const ATTEMPTS = 4;

// ----------------------------------------------------------------------------
// What to render
// ----------------------------------------------------------------------------

const DEMOS = {
  'low-tide-lights': { title: 'Low Tide Lights', short: 'ltl', rack: ['studio-clock', 'analog-rytm', 'analog-four', 'xone96'] },
  'three-clocks': { title: 'Three Clocks', short: 'tc', rack: ['studio-clock', 'dfam', 'mother32', 'subharmonicon', 'xone96'] },
  'copper-wire': { title: 'Copper Wire', short: 'cw', rack: ['analog-rytm', 'sub37', 'xone96'] },
};

/**
 * Variations: what changes from the demo as made, and how. `apply` runs in the page
 * (window.__synthStudio), on the loaded demo, before the bounce; it changes only that
 * page's studio, never the demo's definition. The labels are what the coach shows.
 */
const VARIATIONS = {
  'as-made': { label: 'As made', change: null, apply: null },
  drums: {
    label: 'Drums only',
    change: 'the Analog Rytm alone, the Analog Four\'s studio channel muted',
    apply: () => window.__synthStudio.store.getState().setChannel('analog-four', { mute: true }),
  },
  'drums-straight': {
    label: 'Straight, no ghosts',
    change: 'the drums alone, every pattern at SWING 50 % with no micro timing, the ghost notes (VEL below 56) at VEL 1',
    apply: () => {
      const st = window.__synthStudio.store.getState();
      st.setChannel('analog-four', { mute: true });
      st.updateDeviceData('analog-rytm', d => {
        const patterns = {};
        for (const [id, p] of Object.entries(d.patterns)) {
          patterns[id] = {
            ...p, swing: 50,
            tracks: p.tracks.map(t => ({
              ...t,
              steps: Object.fromEntries(Object.entries(t.steps ?? {}).map(([k, s]) => {
                const n = { ...s };
                delete n.micro;
                if (typeof n.vel === 'number' && n.vel < 56) n.vel = 1;
                return [k, n];
              })),
            })),
          };
        }
        return { ...d, patterns };
      });
    },
  },
  'kick-bass': {
    label: 'Kick and bass',
    change: 'every Rytm track but the kick muted; here the Analog Four plays only its bass',
    apply: () => window.__synthStudio.store.getState().updateDeviceData('analog-rytm', d => ({ ...d, mutes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] })),
  },
  // The curriculum's "muddy mix" (CP-07): no high-pass anywhere, and the low mids up
  muddy: {
    label: 'Muddy',
    change: 'every high-pass off (the Rytm and Analog Four filters fully open, no low cut on the effects or the Xone:96 returns) and LO MID +6 dB on Xone:96 channels 1 and 2',
    apply: () => {
      const { store, hub } = window.__synthStudio;
      const st = store.getState();
      const rytm = hub.valuesFor('analog-rytm'), a4 = hub.valuesFor('analog-four');
      const r = {}, f = {};
      // FILTER TYPE options on both: LP2 LP1 BP HP1 HP2 BS PK
      for (const tk of ['bd', 'sd', 'rs', 'cp', 'bt', 'lt', 'mt', 'ht', 'ch', 'oh', 'cy', 'cb']) {
        if ([3, 4].includes(rytm[`${tk}_flt_typ`])) { r[`${tk}_flt_typ`] = 0; r[`${tk}_flt_frq`] = 127; }
      }
      r.fx_del_hpf = 0; r.fx_rev_hpf = 0;
      for (const t of [1, 2, 3, 4]) {
        if ([3, 4].includes(a4[`t${t}_flt2_typ`])) { f[`t${t}_flt2_typ`] = 0; f[`t${t}_flt2_frq`] = 127; }
      }
      f.fx_cho_hpf = 0; f.fx_del_hpf = 0; f.fx_rev_hpf = 0;
      st.setControlValues('analog-rytm', r);
      st.setControlValues('analog-four', f);
      // LO MID knob: +10 dB at 1, so 0.6 is +6 dB (devices/xone96/model.ts)
      st.setControlValues('xone96', { cha_lo: 0, chb_lo: 0, ch1_lomid: 0.6, ch2_lomid: 0.6 });
    },
  },
  dry: {
    label: 'Dry',
    change: 'every effect return off: the Rytm\'s delay and reverb, the Analog Four\'s chorus, delay and reverb, the Xone:96 returns A and B',
    apply: () => {
      const st = window.__synthStudio.store.getState();
      st.setControlValues('analog-rytm', { fx_del_vol: 0, fx_rev_vol: 0 });
      st.setControlValues('analog-four', { fx_cho_vol: 0, fx_del_vol: 0, fx_rev_vol: 0 });
      st.setControlValues('xone96', { cha_fader: 0, chb_fader: 0 });
    },
  },
  'drums-down': {
    label: 'Drums 6 dB down',
    change: 'the Analog Rytm\'s studio channel at −6 dB, into Xone:96 channel 1',
    apply: () => {
      const st = window.__synthStudio.store.getState();
      st.setChannel('analog-rytm', { gain: (st.studio.mixer?.channels?.['analog-rytm']?.gain ?? 0) - 6 });
    },
  },
  crushed: {
    label: 'Pushed 9 dB',
    change: 'the master driven 9 dB harder into the −1 dBTP limiter',
    apply: () => {
      const st = window.__synthStudio.store.getState();
      st.setMasterSection({ gain: (st.studio.mixer?.master?.gain ?? 0) + 9 });
    },
  },
};

/**
 * Every excerpt a lesson plays, and its variations (each one a render below). Bars are
 * 1-based and inclusive, like the arranger. `full` is the whole song.
 */
const EXCERPTS = [
  { demo: 'low-tide-lights', id: 'full', variations: ['as-made'] },
  { demo: 'low-tide-lights', id: 'groove-9-12', bars: [9, 12], variations: ['kick-bass'] },
  { demo: 'low-tide-lights', id: 'into-drop-15-18', bars: [15, 18], variations: ['as-made'] },
  { demo: 'low-tide-lights', id: 'drop-17-20', bars: [17, 20], variations: ['as-made', 'drums', 'drums-straight', 'muddy'] },
  { demo: 'low-tide-lights', id: 'drop-17-24', bars: [17, 24], variations: ['as-made'] },
  { demo: 'low-tide-lights', id: 'break-33-36', bars: [33, 36], variations: ['as-made', 'dry'] },
  { demo: 'low-tide-lights', id: 'build-45-49', bars: [45, 49], variations: ['as-made'] },
  { demo: 'low-tide-lights', id: 'drop2-49-52', bars: [49, 52], variations: ['as-made', 'drums-down', 'crushed'] },
  { demo: 'three-clocks', id: 'full', variations: ['as-made'] },
  { demo: 'three-clocks', id: 'low-end-17-20', bars: [17, 20], variations: ['as-made'] },
  { demo: 'three-clocks', id: 'return-49-52', bars: [49, 52], variations: ['as-made'] },
  { demo: 'copper-wire', id: 'full', variations: ['as-made'] },
  { demo: 'copper-wire', id: 'final-57-60', bars: [57, 60], variations: ['as-made'] },
];

/** One render per demo and variation; it plays the song as far as its excerpts need */
function renders() {
  const out = new Map();
  for (const ex of EXCERPTS) {
    for (const v of ex.variations) {
      const id = v === 'as-made' ? DEMOS[ex.demo].short : `${DEMOS[ex.demo].short}-${v}`;
      const r = out.get(id) ?? { id, demo: ex.demo, variation: v, until: 0 };
      // the bar after the excerpt plays too: the fade-out
      r.until = ex.id === 'full' ? Infinity : Math.max(r.until, ex.bars[1] + 1);
      out.set(id, r);
    }
  }
  return [...out.values()];
}

const fileOf = (ex, v) => (ex.id === 'full' ? `${ex.demo}.m4a` : `${DEMOS[ex.demo].short}-${ex.id}${v === 'as-made' ? '' : `-${v}`}.m4a`);
const renderOf = (ex, v) => (v === 'as-made' ? DEMOS[ex.demo].short : `${DEMOS[ex.demo].short}-${v}`);

// ----------------------------------------------------------------------------
// Rendering: the app bounces each variation
// ----------------------------------------------------------------------------

async function renderOne(browser, r) {
  const demo = DEMOS[r.demo];
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.addInitScript(initScript);
  try {
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await page.getByRole('button', { name: /tap for sound/i }).click().catch(() => page.mouse.click(4, 4));
    await page.getByRole('button', { name: /Studio/ }).first().click();
    await page.getByText('Opening the studio…').waitFor({ state: 'detached', timeout: 20000 }).catch(() => undefined);
    await page.getByRole('button', { name: `Load the demo track ${demo.title}` }).click();
    await page.getByRole('dialog').getByRole('button', { name: new RegExp(`^(Load ${demo.title}|Replace without saving)$`) }).click();
    await page.waitForFunction(rack => {
      const S = window.__synthStudio;
      const st = S.store.getState().studio;
      return S.hub.status === 'on' && st.rack.length === rack.length && rack.every(id => st.rack.some(x => x.id === id)) && st.rack.every(x => !!S.hub.getStripOutput(x.id));
    }, demo.rack, { timeout: 30000 });
    await page.waitForTimeout(1500);
    const v = VARIATIONS[r.variation];
    if (v.apply) await page.evaluate(v.apply);
    // The song as far as this render needs: the sections up to bar `until`
    const song = await page.evaluate(until => {
      const { store } = window.__synthStudio;
      const st = store.getState();
      const all = st.studio.arrangement.sections;
      const total = all.reduce((n, x) => n + x.bars, 0);
      if (Number.isFinite(until) && until < total) {
        let left = until;
        const kept = [];
        for (const x of all) { if (left <= 0) break; kept.push({ ...x, bars: Math.min(x.bars, left) }); left -= x.bars; }
        st.setArrangement(a => ({ ...a, sections: kept }));
      }
      const now = store.getState().studio;
      return { bpm: now.bpm, bars: now.arrangement.sections.reduce((n, x) => n + x.bars, 0), totalBars: total, enabled: now.arrangement.enabled, loop: now.arrangement.loop };
    }, r.until);
    if (!song.enabled || song.loop) throw new Error(`the demo's song should be on and not loop: ${JSON.stringify(song)}`);
    await page.waitForTimeout(800);
    // The transport's own ticks: bar lines in audio time, and any tick handed out late.
    // It schedules further ahead than on screen (as on a hidden iPad page: everything that
    // follows it, the arranger included, works on the audio clock), so a busy machine that
    // stalls the page for a moment doesn't make a note late.
    await page.evaluate(lookahead => {
      const S = window.__synthStudio;
      const ctx = S.audio.getAudioContext();
      S.transport.setLookahead(lookahead);
      const log = { started: null, bars: [], late: [], worst: -1, stops: [], rate: ctx.sampleRate };
      window.__renderLog = log;
      S.transport.onEvent(e => {
        if (e.type === 'start') log.started = { time: e.time, tick: S.transport.startedAtTick };
        if (e.type === 'stop') log.stops.push(e.time);
      });
      S.transport.onTick(t => {
        const late = ctx.currentTime - t.time;
        if (late > log.worst) log.worst = late;
        if (late > -0.012) log.late.push([t.tick, Math.round(late * 1000)]);
        if (t.tick % 96 === 0) log.bars.push([t.bar + 1, t.time]);
      });
    }, LOOKAHEAD);
    const barDur = 240 / song.bpm;
    const songSec = song.bars * barDur;
    await page.getByRole('button', { name: /Bounce…/ }).click();
    const dl = page.waitForEvent('download', { timeout: (songSec + 120) * 1000 });
    await page.getByRole('dialog').getByRole('button', { name: /^Bounce$/ }).click();
    const download = await dl;
    const wav = path.join(WAV_DIR, `${r.id}.wav`);
    await download.saveAs(wav);
    const log = await page.evaluate(() => window.__renderLog);
    const status = await page.getByRole('dialog').getByRole('status').innerText().catch(() => '');
    if (errs.length) throw new Error(`page errors: ${errs.slice(0, 3).join(' | ')}`);
    if (!log.started || log.started.tick !== 0) throw new Error('the bounce did not start from bar 1');
    // Bar lines on the tempo grid from bar 1 (a stall that made the transport resync moves them)
    const off = log.bars.map(([b, t]) => Math.abs(t - log.started.time - (b - 1) * barDur)).reduce((a, x) => Math.max(a, x), 0);
    const late = log.late.filter(([tick]) => tick < song.bars * 96);
    return { ok: late.length === 0 && off < 0.001, wav, bpm: song.bpm, bars: song.bars, totalBars: song.totalBars, rate: log.rate, late, gridMs: Math.round(off * 1e4) / 10, worstMs: Math.round(log.worst * 1000), status: status.replace(/\s+/g, ' ').slice(0, 160) };
  } finally {
    await ctx.close();
  }
}

// ----------------------------------------------------------------------------
// Encoding and measuring
// ----------------------------------------------------------------------------

const FFPROBE = fs.existsSync('/usr/bin/ffprobe') ? '/usr/bin/ffprobe' : 'ffprobe';
const ff = a => execFileSync(FFMPEG, ['-hide_banner', '-nostats', ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 << 20 });
const r2 = v => Math.round(v * 100) / 100;

/** ffmpeg's EBU R128 scanner over the decoded file (its summary goes to stderr) */
function ebur128(file, filters) {
  const res = spawnSync(FFMPEG, ['-hide_banner', '-nostats', '-i', file, '-af', filters, '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 64 << 20 });
  return String(res.stderr ?? '').split('Summary:').pop() ?? '';
}

/** Integrated loudness over [0, seconds) - the excerpt's bars - and the true peak of the whole file, as it decodes */
function measure(file, seconds) {
  const num = (s, re) => { const m = re.exec(s); return m ? Number(m[1]) : NaN; };
  const lufs = num(ebur128(file, `atrim=0:${seconds.toFixed(4)},ebur128=framelog=quiet`), /I:\s+(-?[\d.]+) LUFS/);
  const truePeak = num(ebur128(file, 'ebur128=peak=true:framelog=quiet'), /True peak:\s+Peak:\s+(-?[\d.]+) dBFS/);
  const probe = execFileSync(FFPROBE, ['-v', 'error', '-show_entries', 'stream=sample_rate,duration', '-of', 'json', file], { encoding: 'utf8' });
  const st = JSON.parse(probe).streams[0];
  return { lufs, truePeak, duration: Number(st.duration), sampleRate: Number(st.sample_rate) };
}

/** Cut [from, to) seconds of a WAV, then `tail` seconds fading out; encode AAC. Returns the samples encoded. */
function encode(wav, outFile, { from, to, tail, rate, kbps }) {
  const s0 = Math.round(from * rate), s1 = Math.round((to + tail) * rate);
  const fades = tail > 0 ? [`afade=t=out:st=${(to - from).toFixed(6)}:d=${tail.toFixed(6)}`] : [];
  ff(['-y', '-loglevel', 'error', '-i', wav, '-af', [`atrim=start_sample=${s0}:end_sample=${s1}`, 'asetpts=PTS-STARTPTS', `volume=-${HEADROOM_DB}dB`, ...fades].join(','),
    '-ac', '2', '-c:a', 'aac', '-b:a', `${kbps}k`, '-movflags', '+faststart', outFile]);
  return s1 - s0;
}

/** Seconds of the WAV (from its header) */
function wavSeconds(file) {
  const b = fs.readFileSync(file);
  const ch = b.readUInt16LE(22), rate = b.readUInt32LE(24), bits = b.readUInt16LE(34);
  let off = 12, data = 0;
  while (off < b.length - 8) { const tag = b.toString('ascii', off, off + 4), size = b.readUInt32LE(off + 4); if (tag === 'data') { data = size; break; } off += 8 + size; }
  return { seconds: data / (ch * (bits / 8)) / rate, rate };
}

function git(...a) { try { return execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim(); } catch { return ''; } }

async function main() {
  fs.mkdirSync(WAV_DIR, { recursive: true });
  fs.mkdirSync(OUT, { recursive: true });
  const all = renders();
  const todo = all.filter(r => !ONLY || ONLY.has(r.id));
  const infoFile = path.join(WAV_DIR, 'renders.json');
  const info = fs.existsSync(infoFile) ? JSON.parse(fs.readFileSync(infoFile, 'utf8')) : {};

  if (!ENCODE_ONLY && todo.length) {
    const browser = await chromium.launch({ headless: !args.includes('--headed'), args: ['--autoplay-policy=no-user-gesture-required'] });
    try {
      for (const r of todo) {
        let res = null;
        for (let k = 1; k <= ATTEMPTS; k++) {
          const t0 = Date.now();
          try {
            res = await renderOne(browser, r);
          } catch (e) {
            res = { ok: false, error: String(e).split('\n')[0] };
          }
          console.error(`${res.ok ? 'ok  ' : 'redo'} ${r.id} (try ${k}, ${Math.round((Date.now() - t0) / 1000)} s)${res.ok ? '' : `: ${res.error ?? `late ticks ${JSON.stringify(res.late.slice(0, 4))}, grid ${res.gridMs} ms`}`}`);
          if (res.ok) break;
        }
        if (!res.ok) throw new Error(`${r.id}: no clean render in ${ATTEMPTS} tries`);
        info[r.id] = { ...res, demo: r.demo, variation: r.variation, at: new Date().toISOString() };
        fs.writeFileSync(infoFile, JSON.stringify(info, null, 1));
      }
    } finally {
      await browser.close();
    }
  }

  // ---- cut, encode, measure ----
  const missing = all.filter(r => !info[r.id] || !fs.existsSync(info[r.id].wav));
  if (missing.length) throw new Error(`no render yet for ${missing.map(r => r.id).join(', ')}: run without --encode-only`);
  const manifest = {
    about: 'Recordings of the demo tracks for the lessons (info.play, listen.demo) and the demo cards. Written by scripts/render-demos.cjs (docs/DEMOS.md): do not edit by hand.',
    version: 1,
    rendered: new Date().toISOString().slice(0, 10),
    commit: git('rev-parse', '--short', 'HEAD'),
    codec: 'AAC-LC in MP4 (.m4a)',
    sampleRate: 0,
    totalBytes: 0,
    demos: {},
  };
  const keep = new Set(['manifest.json']);
  for (const ex of EXCERPTS) {
    const d = DEMOS[ex.demo];
    for (const v of ex.variations) {
      const r = info[renderOf(ex, v)];
      const rate = r.rate;
      const barDur = 240 / r.bpm;
      const bars = ex.id === 'full' ? [1, r.totalBars] : ex.bars;
      if (bars[1] + (ex.id === 'full' ? 0 : 1) > r.bars) throw new Error(`${renderOf(ex, v)} stops at bar ${r.bars}: too short for ${ex.id}`);
      const from = (bars[0] - 1) * barDur, to = bars[1] * barDur;
      const wav = wavSeconds(r.wav);
      const tail = ex.id === 'full' ? Math.max(0, Math.min(FULL_TAIL, wav.seconds - to)) : FADE_OUT;
      const file = fileOf(ex, v);
      const kbps = ex.id === 'full' ? FULL_KBPS : KBPS;
      const frames = encode(r.wav, path.join(OUT, file), { from, to, tail, rate, kbps });
      keep.add(file);
      const m = measure(path.join(OUT, file), to - from);
      const bytes = fs.statSync(path.join(OUT, file)).size;
      manifest.sampleRate = rate;
      const D = manifest.demos[ex.demo] ??= { title: d.title, bpm: r.bpm, bars: r.totalBars, excerpts: {} };
      const E = D.excerpts[ex.id] ??= { bars, variations: {} };
      E.variations[v] = {
        file, label: VARIATIONS[v].label, ...(VARIATIONS[v].change ? { change: VARIATIONS[v].change } : {}),
        seconds: r2(m.duration), loop: Math.round((to - from) * 1e4) / 1e4, frames,
        lufs: r2(m.lufs), truePeak: r2(m.truePeak), kbps, bytes,
      };
      manifest.totalBytes += bytes;
      console.error(`${file.padEnd(36)} ${String(bars.join('-')).padEnd(6)} ${m.duration.toFixed(2).padStart(7)} s ${m.lufs.toFixed(1).padStart(6)} LUFS ${m.truePeak.toFixed(1).padStart(5)} dBTP ${(bytes / 1024).toFixed(0).padStart(5)} KB`);
      if (!Number.isFinite(m.lufs) || !Number.isFinite(m.truePeak)) throw new Error(`${file}: could not measure it`);
    }
  }
  // Files no excerpt uses any more
  for (const f of fs.readdirSync(OUT)) if (!keep.has(f)) { fs.unlinkSync(path.join(OUT, f)); console.error(`removed ${f}`); }
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n');
  manifest.totalBytes += fs.statSync(path.join(OUT, 'manifest.json')).size;
  const mb = manifest.totalBytes / 1e6;
  console.error(`\npublic/demos: ${fs.readdirSync(OUT).length} files, ${mb.toFixed(2)} MB (budget ${BUDGET_BYTES / 1e6} MB)`);
  console.log(JSON.stringify({ ok: manifest.totalBytes <= BUDGET_BYTES, files: fs.readdirSync(OUT).length, megabytes: Math.round(mb * 100) / 100, renders: Object.fromEntries(Object.entries(info).map(([k, x]) => [k, { bars: x.bars, worstLateMs: x.worstMs, at: x.at }])) }));
  if (manifest.totalBytes > BUDGET_BYTES) process.exit(1);
}

main().catch(e => { console.error(String(e.stack ?? e)); process.exit(1); });
