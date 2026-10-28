// ============================================================================
// DSP benchmark driver: opens /bench in headless Chromium, waits for
// window.__benchResults, prints a summary and saves the JSON.
//
//   node scripts/bench.cjs <baseUrl> [out.json] [query]
//   node scripts/bench.cjs http://localhost:3110 /tmp/bench.json "devices=dfam&reps=1"
//
// The query string is passed to the page (only=devices|processors,
// devices=a,b, scenarios=x,y, reps=N). Exit code 1 on errors.
// ============================================================================
const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const [, , base = 'http://localhost:3000', out = '', query = ''] = process.argv;
  const url = `${base.replace(/\/$/, '')}/bench?auto=1${query ? `&${query}` : ''}`;
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const consoleErrors = [];
  let results = null;
  try {
    const page = await browser.newPage();
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    page.on('pageerror', e => consoleErrors.push(String(e)));
    await page.goto(url, { waitUntil: 'networkidle' });
    const t0 = Date.now();
    let last = '';
    for (;;) {
      const r = await page.evaluate(() => window.__benchResults && { status: window.__benchResults.status, progress: window.__benchResults.progress });
      if (r && r.progress !== last) { last = r.progress; if (last) process.stderr.write(`  ${last}\n`); }
      if (r && (r.status === 'done' || r.status === 'error')) break;
      if (Date.now() - t0 > 30 * 60 * 1000) throw new Error('benchmark timed out');
      await page.waitForTimeout(1000);
    }
    results = await page.evaluate(() => window.__benchResults);
  } finally {
    await browser.close();
  }

  const pad = (s, n) => String(s).padEnd(n);
  const lpad = (s, n) => String(s).padStart(n);
  const f = (v, d = 1) => (typeof v === 'number' && Number.isFinite(v) ? v.toFixed(d) : '-');
  console.log(`\n${results.userAgent}\n${results.sampleRate} Hz, ${results.seconds} s renders`);
  console.log(`framework: empty render ${f(results.framework.emptyMs)} ms, with ${results.framework.suspends} suspends ${f(results.framework.suspendMs)} ms\n`);

  const ids = [...new Set(results.devices.map(d => d.device))];
  if (ids.length) {
    console.log(pad('instrument', 16), lpad('before xRT', 11), lpad('after xRT', 11), lpad('speed-up', 9), lpad('peak b/a', 15), '  worklets (after)');
    for (const id of ids) {
      const b = results.devices.find(d => d.device === id && d.variant === 'before');
      const a = results.devices.find(d => d.device === id && d.variant === 'after');
      const nodes = a ? Object.values(a.worklets).reduce((s, n) => s + n, 0) : 0;
      console.log(
        pad(id, 16),
        lpad(b && b.ok ? f(b.realtime) : 'err', 11),
        lpad(a && a.ok ? f(a.realtime) : 'err', 11),
        lpad(a && b && a.ok && b.ok ? `${f(a.realtime / b.realtime, 2)}x` : '-', 9),
        lpad(`${f(b && b.peak, 3)}/${f(a && a.peak, 3)}`, 15),
        ` ${nodes}`,
      );
      for (const r of [b, a]) if (r && !r.ok) console.log(`   ${r.variant}: ${r.error}`);
    }
    console.log('');
  }
  const pids = [...new Set(results.processors.map(p => p.id))];
  if (pids.length) {
    console.log(pad('processor scenario', 34), lpad('N', 3), lpad('before ns', 10), lpad('after ns', 10), lpad('speed-up', 9), lpad('after %core', 12));
    for (const id of pids) {
      const b = results.processors.find(p => p.id === id && p.variant === 'before');
      const a = results.processors.find(p => p.id === id && p.variant === 'after');
      const x = a || b;
      console.log(
        pad(x.label, 34), lpad(x.instances, 3),
        lpad(b ? (b.ok ? f(b.nsPerSample) : 'err') : 'new', 10),
        lpad(a ? (a.ok ? f(a.nsPerSample) : 'err') : '-', 10),
        lpad(a && b && a.ok && b.ok && a.nsPerSample > 0 ? `${f(b.nsPerSample / a.nsPerSample, 2)}x` : '', 9),
        lpad(a && a.ok ? `${f(a.corePct, 3)}%` : '-', 12),
      );
      for (const r of [b, a]) if (r && !r.ok) console.log(`   ${r.variant}: ${r.error}`);
    }
  }
  const errs = [...results.errors, ...consoleErrors];
  if (errs.length) console.log('\nerrors:\n  ' + errs.join('\n  '));
  if (out) { fs.writeFileSync(out, JSON.stringify({ ...results, consoleErrors }, null, 2)); console.log(`\nsaved ${out}`); }
  process.exitCode = errs.length || results.status !== 'done' ? 1 : 0;
})().catch(e => { console.error(e); process.exit(1); });
