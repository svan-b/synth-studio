// ============================================================================
// Demo tracks: load each one from the studio's Demo tracks section, play it from
// bar 1 to the end with the studio ▶, and bounce it.
//   node scripts/e2e/demos.cjs <baseUrl> [--demo low-tide-lights,copper-wire] [--out <dir>]
//                              [--no-bounce] [--parts] [--bars N] [--headed]
//
// Per demo it checks that:
//   - the demo loads (rack, routes, tempo, song sections) and every engine starts
//   - every instrument makes sound, and none clips (instrument outputs < 0 dBFS, no Xone PK!,
//     the Xone's LR MIX under its PK! LED too)
//   - the song plays through its sections and the changes land on bar lines: the caption
//     follows the arranger section by section, the kick hits each section's first beat, and
//     a part the arranger unmutes comes in exactly on its section's bar line
//   - the transport stops by itself on the song's last bar line (song mode on, loop off)
//   - the master's integrated loudness is near the demo's target, with no true peak over -1 dBTP
//   - the bounce downloads a WAV of the song plus its tails, on target too
// --parts also measures the parts in the busiest section against the kick (short-term
// loudness at the Xone's output, each part soloed). --bars N plays only N bars (quick run).
// Bar times come from the transport's own ticks, so a page that stalls (a busy machine)
// and makes the transport resync does not fail the timing checks; resyncs are reported.
// A bar line the transport handed out after its time (the page stalled just then, so every
// part plays it late together) can't show where the demo puts its notes: the timing checks
// skip and report those bar lines, and fail if fewer than half of them were on time.
// Prints one JSON object (the last line) and exits 1 if a check fails.
// ============================================================================
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { initScript, installTap, startPolling, makeTap, lufsOf, db, r1 } = require('./demoTap.cjs');

const args = process.argv.slice(2);
const valueFlags = new Set(['--demo', '--out', '--bars']);
const base = args.find((a, i) => !a.startsWith('--') && !valueFlags.has(args[i - 1])) ?? 'http://localhost:3000';
const opt = name => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const DEMO_IDS = (opt('demo') ?? 'low-tide-lights,three-clocks,copper-wire').split(',');
const outDir = path.resolve(opt('out') ?? fs.mkdtempSync('/tmp/synth-demos-'));
const BOUNCE = !args.includes('--no-bounce');
const PARTS = args.includes('--parts');
const MAX_BARS = opt('bars') ? Number(opt('bars')) : 0;
fs.mkdirSync(outDir, { recursive: true });

// What each demo should be (docs/research/producer-path/demo-tracks.md; lib/studio/demos/meta.ts)
const EXPECT = {
  'low-tide-lights': {
    title: 'Low Tide Lights', bpm: 124, lufs: -10.5, rack: ['studio-clock', 'analog-rytm', 'analog-four', 'xone96'],
    sections: [8, 8, 16, 8, 4, 4, 16, 8, 8],
    // the kick plays every section's first beat (BREAK: its 1ST impact)
    kick: 'analog-rytm',
    // the A4 is muted in the intro: the bass comes in on bar 9, first note on step 3
    entries: [{ instance: 'analog-four', bar: 9, step: 3 }],
    parts: { section: 6, solos: [
      { name: 'kick', instance: 'analog-rytm', tracks: [0] },
      { name: 'bass', instance: 'analog-four', tracks: [0] },
      { name: 'stabs', instance: 'analog-four', tracks: [1, 2] },
      { name: 'hook', instance: 'analog-four', tracks: [3] },
      { name: 'clap', instance: 'analog-rytm', tracks: [3] },
      { name: 'hats', instance: 'analog-rytm', tracks: [8, 9] },
      { name: 'ride', instance: 'analog-rytm', tracks: [10] },
    ] },
  },
  'three-clocks': {
    title: 'Three Clocks', bpm: 110, lufs: -13, rack: ['studio-clock', 'dfam', 'mother32', 'subharmonicon', 'xone96'],
    sections: [8, 8, 16, 8, 8, 16, 8],
    kick: 'dfam', kickFrom: 2, kickSkip: [5],
    // the DFAM is muted in CLOCKWORK and its kick lands on bar 9; the bass comes in on bar 17
    entries: [{ instance: 'dfam', bar: 9, step: 1 }, { instance: 'mother32', bar: 17, step: 1 }],
    parts: { section: 5, solos: [
      { name: 'kick (DFAM)', instance: 'dfam' }, { name: 'bass (Mother-32)', instance: 'mother32' }, { name: 'Subharmonicon', instance: 'subharmonicon' },
    ] },
  },
  'copper-wire': {
    title: 'Copper Wire', bpm: 122, lufs: -11, rack: ['analog-rytm', 'sub37', 'xone96'],
    sections: [8, 16, 8, 16, 8, 16, 8],
    // BREAK (section 3) has no kick
    kick: 'analog-rytm', kickSkip: [3],
    // the Sub 37 is muted in the intro: the bassline comes in on bar 9, first note on step 3
    entries: [{ instance: 'sub37', bar: 9, step: 3 }],
    parts: { section: 5, solos: [
      { name: 'kick', instance: 'analog-rytm', tracks: [0] },
      { name: 'bass', instance: 'sub37' },
      { name: 'snare + clap', instance: 'analog-rytm', tracks: [1, 3] },
      { name: 'zaps', instance: 'analog-rytm', tracks: [2] },
      { name: 'hats', instance: 'analog-rytm', tracks: [8, 9] },
      { name: 'toms', instance: 'analog-rytm', tracks: [5, 6] },
    ] },
  },
};

(async () => {
  const browser = await chromium.launch({ headless: !args.includes('--headed'), args: ['--autoplay-policy=no-user-gesture-required'] });
  const report = { base, demos: {} };
  const failures = [];
  const check = (demo, name, ok, detail) => {
    report.demos[demo].checks.push({ name, ok: !!ok, detail });
    if (!ok) failures.push(`${demo}: ${name}`);
    console.error(`${ok ? 'PASS' : 'FAIL'}  ${demo}: ${name}${detail !== undefined ? `  (${typeof detail === 'string' ? detail : JSON.stringify(detail)})` : ''}`);
  };

  for (const id of DEMO_IDS) {
    const exp = EXPECT[id];
    if (!exp) { failures.push(`unknown demo ${id}`); continue; }
    const R = report.demos[id] = { checks: [] };
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
      await page.getByRole('button', { name: `Load the demo track ${exp.title}` }).click();
      await page.getByRole('dialog').getByRole('button', { name: new RegExp(`^(Load ${exp.title}|Replace without saving)$`) }).click();
      const ready = await page.waitForFunction(rack => {
        const S = window.__synthStudio;
        const st = S.store.getState().studio;
        return S.hub.status === 'on' && st.rack.length === rack.length && rack.every(r => st.rack.some(x => x.id === r)) && st.rack.every(r => !!S.hub.getStripOutput(r.id));
      }, exp.rack, { timeout: 30000 }).then(() => true).catch(() => false);
      const st = await page.evaluate(() => {
        const s = window.__synthStudio.store.getState().studio;
        return { rack: s.rack.map(r => r.id), routes: s.routes, bpm: s.bpm, sections: s.arrangement.sections.map(x => x.bars), ids: s.arrangement.sections.map(x => x.id), enabled: s.arrangement.enabled, loop: s.arrangement.loop };
      });
      check(id, 'loads: every engine starts', ready, st.rack);
      check(id, 'loads: tempo, song and routing', st.bpm === exp.bpm && st.enabled && !st.loop && JSON.stringify(st.sections) === JSON.stringify(exp.sections) && Object.keys(st.routes).length >= 2,
        { bpm: st.bpm, sections: st.sections, routes: st.routes });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(outDir, `${id}-loaded.png`) });

      await installTap(page);
      await startPolling(page);
      const audible = exp.rack.filter(r => r !== 'studio-clock');
      await page.evaluate(ids => window.__demoTap.start(ids), [...audible, 'master']);
      await page.waitForTimeout(400);

      // ▶ the studio transport, from bar 1
      await page.getByRole('button', { name: 'Play studio' }).click();
      const barDur = 240 / exp.bpm;
      const total = exp.sections.reduce((a, b) => a + b, 0);
      const bars = MAX_BARS || total;
      const songDur = bars * barDur;
      if (MAX_BARS) {
        await page.waitForTimeout(songDur * 1000 + 600);
        await page.getByRole('button', { name: 'Stop studio' }).click();
        await page.waitForTimeout(2500);
      } else {
        // the song stops by itself on its last bar line; then the tails
        await page.waitForFunction(() => window.__demoLog.stops.length > 0, null, { timeout: (songDur + 40) * 1000 }).catch(() => undefined);
        await page.waitForTimeout(4500);
      }
      const cap = await page.evaluate(() => window.__demoTap.stop());
      const log = await page.evaluate(() => window.__demoStopPolling());
      await page.screenshot({ path: path.join(outDir, `${id}-played.png`) });

      const sr = cap.sampleRate;
      const T = Object.fromEntries(cap.taps.map(t => [t.id, makeTap(t, sr, cap.started.time)]));
      // the transport's own bar lines (1-based bar -> audio time)
      const barTime = new Map(log.bars.map(([b, t]) => [b + 1, t]));
      // ms each bar line was handed out after its time; > -2 ms: the page stalled over it
      const barLate = new Map(log.bars.map(([b, , late]) => [b + 1, Math.round(late * 1000)]));
      const stalled = b => (barLate.get(b) ?? -100) > -2;
      const lastBar = Math.max(...barTime.keys());
      const barT = b => barTime.get(b) ?? (barTime.get(lastBar) + (b - lastBar) * barDur);
      const t0 = barT(1);
      let resyncs = 0;
      for (let b = 2; b <= lastBar; b++) if (barTime.has(b) && barTime.has(b - 1) && barTime.get(b) - barTime.get(b - 1) > barDur + 0.02) resyncs++;
      R.transportResyncs = resyncs;
      const endT = log.stops[0]?.time ?? barT(bars + 1);

      const secs = [];
      exp.sections.reduce((b, n) => { secs.push({ start: b, bars: n }); return b + n; }, 1);
      const inSong = secs.filter(s => s.start <= bars);

      // every instrument makes sound; nothing clips at an instrument's output. The taps are the studio
      // channels after their faders, so the instrument's own output is the tap less its fader gain
      // (the Xone's channel adds 6 dB on the way to the master; its own output is what can clip).
      const fader = await page.evaluate(() => Object.fromEntries(Object.entries(window.__synthStudio.store.getState().studio.mixer?.channels ?? {}).map(([k, c]) => [k, c.gain ?? 0])));
      const sound = {};
      for (const inst of audible) {
        let best = -Infinity;
        inSong.forEach(s => { best = Math.max(best, T[inst].lufs(barT(s.start), Math.min(endT, barT(s.start + s.bars)))); });
        sound[inst] = { lufs: r1(best), peakDb: r1(db(T[inst].peak(t0, endT + 2)) - (fader[inst] ?? 0)) };
      }
      R.sound = sound;
      check(id, 'every instrument makes sound', audible.every(i => sound[i].lufs > -45), sound);
      check(id, 'nothing clips at an instrument output (< 0 dBFS before its studio fader)', audible.every(i => sound[i].peakDb < 0), Object.fromEntries(audible.map(i => [i, sound[i].peakDb])));
      // the channels' PK! (post-GAIN, +15 dBu) and the LR MIX meters' PK! LED (+10 dBu, before MASTER)
      const pkLit = Object.entries(log.xone).filter(([k, m]) => m.pk > 0 && /^([1-4ab]|mix)$/.test(k)).map(([k]) => k);
      R.xoneMaxDbu = Object.fromEntries(Object.entries(log.xone).filter(([, m]) => m.max > -100).map(([k, m]) => [k, r1(m.max)]));
      check(id, 'no Xone channel or LR MIX PK! lit', pkLit.length === 0, { pk: pkLit, maxDbu: R.xoneMaxDbu });

      // the caption follows the arranger: each section's note shows within 0.4 s of its first bar line
      const capMs = inSong.map((s, i) => {
        const tStart = barT(s.start);
        const c = log.captions.find(x => x.id === st.ids[i] && x.t >= tStart - 0.2);
        return c ? Math.round((c.t - tStart) * 1000) : null;
      });
      R.captionMs = capMs;
      check(id, 'the song plays through its sections (caption, ms after each section\'s bar line)', capMs.every(v => v !== null && v >= -200 && v < 450), capMs);

      // the kick hits each section's first beat: a rise of 6 dB or more that starts within 12 ms of the bar line
      const kickSecs = inSong.map((s, i) => ({ ...s, i })).filter(s => s.i >= (exp.kickFrom ?? 1) - 1 && !(exp.kickSkip ?? []).includes(s.i + 1));
      const kicks = kickSecs.map(s => ({ section: s.i + 1, ...T[exp.kick].hitAt(barT(s.start)), ...(stalled(s.start) ? { stalledMs: barLate.get(s.start) } : {}) }));
      R.kickHits = kicks;
      const onTime = list => list.filter(x => x.stalledMs === undefined);
      check(id, 'section changes land on bar lines (the kick on each section\'s first beat)',
        onTime(kicks).length * 2 >= kicks.length && onTime(kicks).every(k => k.db >= 6 && k.ms !== null && Math.abs(k.ms) <= 12), kicks);

      // a part the arranger unmutes comes in on its section's bar line (its first note on its step)
      const stepDur = barDur / 16;
      const entries = exp.entries.filter(e => e.bar <= bars).map(e => {
        const tb = barT(e.bar);
        const quiet = lufsOf(T[e.instance].meanPower(tb - 1.0, tb - 0.01)) < -60;
        const on = T[e.instance].entryAfter(tb - 0.01, tb + barDur);
        return {
          instance: e.instance, bar: e.bar, silentBefore: quiet, onsetMs: on === null ? null : Math.round((on - (tb + (e.step - 1) * stepDur)) * 1000),
          ...(stalled(e.bar) ? { stalledMs: barLate.get(e.bar) } : {}),
        };
      });
      R.entries = entries;
      check(id, 'unmuted parts enter on their section\'s bar line',
        entries.every(e => e.silentBefore) && onTime(entries).length * 2 >= entries.length && onTime(entries).every(e => e.onsetMs !== null && Math.abs(e.onsetMs) <= 12), entries);
      R.stalledBars = [...barLate].filter(([b]) => stalled(b)).map(([b, ms]) => [b, ms]);

      if (!MAX_BARS) {
        const stop = log.stops[0];
        const expectedEnd = barT(lastBar) + barDur;
        check(id, 'the song stops on its last bar line', !!stop && lastBar === total && Math.abs(stop.time - expectedEnd) < 0.01,
          stop ? { lastBar, stopMs: Math.round((stop.time - expectedEnd) * 1000) } : 'no stop');
        const mi = T.master.lufs(t0, endT + 3);
        const tp = db(T.master.truePeak(t0, endT + 4));
        R.master = {
          integrated: r1(mi), appMeterIntegrated: r1(log.meter.i), truePeakDbtp: r1(tp), maxLimiterGrDb: r1(log.meter.gr),
          preLimiterPeakDb: r1(db(log.meter.inPeak)), shortTermMax: r1(T.master.shortTermMax(t0, endT)),
        };
        check(id, `master loudness near ${exp.lufs} LUFS (±1)`, Math.abs(mi - exp.lufs) <= 1.0, R.master);
        check(id, 'no overs: true peak <= -1.0 dBTP', tp <= -0.95, r1(tp));
        R.sectionLufs = inSong.map(s => r1(T.master.lufs(barT(s.start), barT(s.start + s.bars))));
      }
      check(id, 'no page errors', errs.length === 0 && (await page.evaluate(() => window.__demoQA.errors)).length === 0, errs.slice(0, 5));

      // ---- parts in the busiest section, each soloed, at the Xone's output ----
      if (PARTS && exp.parts) {
        const sec = secs[exp.parts.section];
        const levels = {};
        const others = audible.filter(i => i !== 'xone96');
        for (const solo of exp.parts.solos) {
          await page.evaluate(({ solo, others }) => {
            const S = window.__synthStudio;
            const store = S.store.getState();
            // the mixer's channel mutes (the arranger's section mutes would undo hub mutes)
            others.forEach(i => store.setChannel(i, { mute: i !== solo.instance }));
            (solo.tracks ?? []).forEach(t => S.hub.event(solo.instance, 'seq:solo', { track: t, on: true }));
          }, { solo, others });
          await page.evaluate(() => window.__demoTap.start(['xone96']));
          const t = await page.evaluate(start => {
            const S = window.__synthStudio;
            S.hub.startAll({ fromTick: (start - 1) * 96, countIn: false });
            return S.audio.getAudioContext().currentTime;
          }, sec.start);
          const dur = Math.min(sec.bars, 8) * barDur;
          await page.waitForTimeout(dur * 1000 + 500);
          await page.evaluate(() => window.__synthStudio.hub.stopAll());
          const c2 = await page.evaluate(() => window.__demoTap.stop());
          await page.evaluate(({ solo }) => (solo.tracks ?? []).forEach(tr => window.__synthStudio.hub.event(solo.instance, 'seq:solo', { track: tr, on: false })), { solo });
          const tap = makeTap(c2.taps[0], c2.sampleRate, c2.started.time);
          levels[solo.name] = { lufs: r1(tap.lufs(t + 0.6, t + dur)), shortTerm: r1(tap.shortTermMax(t + 0.6, t + dur)), peakDb: r1(db(tap.peak(t + 0.6, t + dur))) };
          await page.waitForTimeout(1500);
        }
        await page.evaluate(others => others.forEach(i => window.__synthStudio.store.getState().setChannel(i, { mute: false })), others);
        const ref = levels[exp.parts.solos[0].name].shortTerm;
        R.parts = Object.fromEntries(Object.entries(levels).map(([n, v]) => [n, { ...v, vsKick: r1(v.shortTerm - ref) }]));
        console.error(`parts ${id}: ${JSON.stringify(R.parts)}`);
      }

      // ---- bounce: the song from bar 1 plus its tails, to WAV ----
      if (BOUNCE && !MAX_BARS) {
        await page.getByRole('button', { name: /Bounce…/ }).click();
        const dl = page.waitForEvent('download', { timeout: (songDur + 90) * 1000 });
        await page.getByRole('dialog').getByRole('button', { name: /^Bounce$/ }).click();
        const download = await dl;
        const file = path.join(outDir, `${id}.wav`);
        await download.saveAs(file);
        const wav = fs.readFileSync(file);
        const channels = wav.readUInt16LE(22), rate = wav.readUInt32LE(24), bits = wav.readUInt16LE(34);
        let off = 12, dataBytes = 0;
        while (off < wav.length - 8) { const tag = wav.toString('ascii', off, off + 4); const size = wav.readUInt32LE(off + 4); if (tag === 'data') { dataBytes = size; break; } off += 8 + size; }
        const seconds = dataBytes / (channels * (bits / 8)) / rate;
        await page.getByRole('dialog').getByText(/LUFS integrated/).waitFor({ timeout: 20000 }).catch(() => undefined);
        const status = await page.getByRole('dialog').getByRole('status').innerText().catch(() => '');
        R.bounce = { seconds: r1(seconds), songSeconds: r1(songDur), rate, bits, channels, dialog: status.replace(/\s+/g, ' ').slice(0, 200) };
        check(id, 'the bounce is a WAV of the song plus its tails', seconds >= songDur + 0.4 && seconds <= songDur + 13, R.bounce);
        const m = /(-?\d+\.\d) LUFS integrated, true peak (-?\d+\.\d) dBTP/.exec(status);
        R.bounce.lufs = m ? Number(m[1]) : null;
        R.bounce.truePeak = m ? Number(m[2]) : null;
        check(id, 'the bounce meets the loudness target with no overs', !!m && Math.abs(R.bounce.lufs - exp.lufs) <= 1.0 && R.bounce.truePeak <= -0.95, { lufs: R.bounce.lufs, truePeak: R.bounce.truePeak });
      }
    } catch (e) {
      check(id, 'runs', false, String(e).split('\n')[0]);
    }
    await ctx.close();
  }
  await browser.close();
  report.ok = failures.length === 0;
  report.failures = failures;
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  process.exit(failures.length ? 1 : 0);
})();
