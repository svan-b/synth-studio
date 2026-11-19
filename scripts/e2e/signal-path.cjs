// ============================================================================
// The signal path diagram, by touch on an iPad-sized screen (1180 x 820):
//   node scripts/e2e/signal-path.cjs <baseUrl> [device ...]
//
// For every instrument (or the ones named):
//   opens      the toolbar's "Signal path" shows the diagram; it stays open after a reload
//   fits       every block is at least 44 px tall, no two overlap, the diagram needs no
//              sideways scroll and neither does the page
//   lights     tapping a block presses it and lights its controls on the panel (the ring
//              the lessons use), dims one that is not its own, and says what it is
//   opens page on the Elektrons the block opens its parameter page (and the FX track)
//   here       touching a control on the panel marks its block "you are here"
//   clears     "Show all" lights the whole panel again; the toolbar button closes the diagram
// And once, on the DFAM: a lesson step's own spotlight wins over a chosen block, and the
// diagram marks the block the step is about.
// Prints one JSON object; scripts/e2e/run.cjs checks `ok`.
// ============================================================================
const { chromium } = require('playwright');

/** block: the one to choose; lit / dim: a control it lights and one it does not; values: what an
 *  Elektron's block sets; touch / here: a control to touch and the block that should mark itself;
 *  always: a control that stays on the panel whatever page is open (default: `dim`) */
const CASES = {
  dfam: { block: 'filter', lit: 'vcf_cutoff', dim: 'vco1_frequency', touch: 'vca_decay', here: 'vca_eg' },
  mother32: { block: 'lfo', lit: 'lfo_rate', dim: 'cutoff', touch: 'cutoff', here: 'vcf' },
  subharmonicon: { block: 'mixer', lit: 'vco1_level', dim: 'cutoff', touch: 'tempo', here: 'rhythm' },
  sub37: { block: 'feg', lit: 'feg_attack', dim: 'cutoff', touch: 'cutoff', here: 'filter' },
  'analog-four': { block: 'ladder', lit: 't1_flt1_frq', dim: 't1_flt1_ovr', always: 'main_volume', values: { page: 6 }, then: { block: 'fx', values: { track: 4, page: 6 }, lit: 'fx_cho_pre' }, touch: 'fx_cho_pre', here: 'fx' },
  'analog-rytm': { block: 'filter', lit: 'bd_flt_frq', dim: 'main_volume', values: { page: 3 }, then: { block: 'compressor', values: { track: 12, page: 4 }, lit: 'fx_cmp_thr' }, touch: 'fx_cmp_thr', here: 'compressor' },
  xone96: { block: 'eq', lit: 'ch1_hi', dim: 'ch1_gain', touch: 'master', here: 'master' },
};

(async () => {
  const [, , base = 'http://localhost:3100', ...only] = process.argv;
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const errs = [];
  const report = {};
  const failed = [];
  const check = (device, name, ok, detail) => {
    (report[device] ??= {})[name] = ok ? true : detail ?? false;
    if (!ok) failed.push(`${device}: ${name}`);
  };

  const open = async device => {
    const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(`${device}: ${String(e)}`));
    page.on('console', m => { if (m.type() === 'error') errs.push(`${device}: console: ${m.text()}`); });
    await page.addInitScript(d => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('synth-studio-welcomed', '1');
      localStorage.setItem('synth-studio-storage', JSON.stringify({ state: { currentDevice: d, devices: {}, completedLessons: [] }, version: 3 }));
    }, device);
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => !!window.__synthStudio, null, { timeout: 30000 });
    await page.waitForSelector('[data-instance]', { timeout: 30000 });
    await page.waitForTimeout(700);
    return { ctx, page };
  };

  /** A control on the panel: how bright it is (its own opacity times its parents') and whether it wears the spotlight ring */
  const look = (page, id) => page.evaluate(cid => {
    const el = document.querySelector(`[data-control="${cid}"]`);
    if (!el) return null;
    let o = 1;
    for (let e = el; e && e !== document.body; e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity || '1');
    return { opacity: +o.toFixed(2), ring: !!(el.querySelector('.ssc-spot-focus') || el.parentElement?.querySelector('.ssc-spot-focus')) };
  }, id);
  const values = page => page.evaluate(() => {
    const s = window.__synthStudio.store.getState();
    const inst = document.querySelector('[data-instance]').getAttribute('data-instance');
    return { ...(s.devices[inst]?.controlValues ?? {}), __pref: s.signalPath };
  });
  const block = (page, id) => page.locator(`[data-path-block="${id}"]`);
  const toggle = page => page.getByRole('button', { name: 'Signal path', exact: true });

  for (const [device, c] of Object.entries(CASES)) {
    if (only.length && !only.includes(device)) continue;
    const { ctx, page } = await open(device);
    try {
      // ---- opens, and stays open -------------------------------------------------------
      check(device, 'closed until asked for', (await page.locator('[data-signal-path]').count()) === 0);
      await toggle(page).tap();
      await page.waitForSelector('[data-signal-path]', { timeout: 5000 });
      await page.waitForTimeout(900); // the store saves at most every 600 ms
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForFunction(() => !!window.__synthStudio, null, { timeout: 30000 });
      await page.waitForSelector('[data-signal-path]', { timeout: 15000 }).catch(() => undefined);
      check(device, 'open after a reload', (await page.locator('[data-signal-path]').count()) === 1 && (await toggle(page).getAttribute('aria-pressed')) === 'true');
      await page.waitForTimeout(500);

      // ---- fits --------------------------------------------------------------------------
      const fit = await page.evaluate(() => {
        const boxes = [...document.querySelectorAll('[data-path-block]')].map(b => { const r = b.getBoundingClientRect(); return { id: b.getAttribute('data-path-block'), x: r.x, y: r.y, w: r.width, h: r.height, clipped: b.scrollWidth > b.clientWidth + 1 || b.scrollHeight > b.clientHeight + 1 }; });
        const overlaps = [];
        boxes.forEach((a, i) => boxes.slice(i + 1).forEach(b => { if (a.x < b.x + b.w - 1 && a.x + a.w > b.x + 1 && a.y < b.y + b.h - 1 && a.y + a.h > b.y + 1) overlaps.push(`${a.id}/${b.id}`); }));
        const scroller = document.querySelector('[data-signal-path] > div');
        return {
          blocks: boxes.length, minHeight: Math.min(...boxes.map(b => b.h)), minWidth: Math.min(...boxes.map(b => b.w)), overlaps,
          clipped: boxes.filter(b => b.clipped).map(b => b.id),
          sideways: scroller.scrollWidth > scroller.clientWidth + 1,
          pageSideways: document.documentElement.scrollWidth > window.innerWidth + 1,
          wires: document.querySelectorAll('[data-wire]').length,
        };
      });
      check(device, 'blocks are touch sized, apart and unclipped', fit.blocks >= 8 && fit.minHeight >= 44 && fit.minWidth >= 44 && !fit.overlaps.length && !fit.clipped.length, fit);
      check(device, 'no sideways scroll', !fit.sideways && !fit.pageSideways && fit.wires >= fit.blocks - 2, fit);

      // ---- lights its controls -------------------------------------------------------------
      await block(page, c.block).tap();
      await page.waitForTimeout(450);
      const pressed = await block(page, c.block).getAttribute('aria-pressed');
      const lit = await look(page, c.lit);
      const dim = await look(page, c.dim);
      const info = await page.locator('[data-signal-path-info]').innerText();
      check(device, 'a tapped block lights its controls and dims the rest', pressed === 'true' && lit?.ring && lit.opacity > 0.9 && dim && !dim.ring && dim.opacity < 0.5, { pressed, lit, dim });
      check(device, 'the note says what the block is', info.length > 60 && /Show all/.test(info), info.slice(0, 80));
      if (c.values) {
        const v = await values(page);
        check(device, `the block opens its page (${JSON.stringify(c.values)})`, Object.entries(c.values).every(([k, want]) => v[k] === want), Object.fromEntries(Object.keys(c.values).map(k => [k, v[k]])));
      }
      if (c.then) {
        await block(page, c.then.block).tap();
        await page.waitForTimeout(450);
        const v = await values(page);
        const l2 = await look(page, c.then.lit);
        check(device, `another block opens its own (${JSON.stringify(c.then.values)})`, Object.entries(c.then.values).every(([k, want]) => v[k] === want) && l2?.ring, { values: Object.fromEntries(Object.keys(c.then.values).map(k => [k, v[k]])), lit: l2 });
      }

      // ---- clears ------------------------------------------------------------------------
      await page.locator('[data-signal-path-info]').getByRole('button', { name: 'Show all' }).tap();
      await page.waitForTimeout(350);
      const after = await look(page, c.always ?? c.dim);
      check(device, '"Show all" lights the panel again', (await page.locator('[data-path-block][aria-pressed="true"]').count()) === 0 && after?.opacity > 0.9 && (await page.locator('.ssc-spot-focus').count()) === 0, after);

      // ---- you are here -------------------------------------------------------------------
      await page.locator(`[data-control="${c.touch}"]`).first().tap();
      await page.waitForTimeout(350);
      const here = await page.evaluate(() => [...document.querySelectorAll('[data-path-block][data-here]')].map(b => b.getAttribute('data-path-block')));
      check(device, `touching ${c.touch} marks ${c.here}`, here.length === 1 && here[0] === c.here, here);

      // ---- closes ------------------------------------------------------------------------
      await block(page, c.block).tap();
      await page.waitForTimeout(200);
      await toggle(page).tap();
      await page.waitForTimeout(350);
      const closed = await look(page, c.always ?? c.dim);
      check(device, 'the toolbar button closes it and leaves the panel lit', (await page.locator('[data-signal-path]').count()) === 0 && closed?.opacity > 0.9 && (await values(page)).__pref === false, closed);

      // ---- a lesson's spotlight comes first (DFAM) -------------------------------------------
      if (device === 'dfam') {
        await toggle(page).tap();
        await page.waitForSelector('[data-signal-path]');
        await block(page, 'filter').tap();
        await page.evaluate(() => window.__synthStudio.store.getState().startLesson({
          id: 'dfam-e2e-signal-path', device: 'dfam', name: 'Signal path', description: 'e2e', difficulty: 'beginner', source: 'scripts/e2e/signal-path.cjs',
          steps: [{ instruction: 'Turn VCA DECAY up.', control: 'vca_decay', targetValue: 600 }],
        }, 'dfam'));
        await page.waitForTimeout(600);
        const stepKnob = await look(page, 'vca_decay');
        const blockKnob = await look(page, 'vcf_cutoff');
        const hereNow = await page.evaluate(() => [...document.querySelectorAll('[data-path-block][data-here]')].map(b => b.getAttribute('data-path-block')));
        check(device, 'a lesson step keeps the panel, and the diagram marks its block', stepKnob?.opacity > 0.9 && blockKnob?.opacity < 0.5 && hereNow[0] === 'vca_eg', { stepKnob, blockKnob, hereNow });
      }
    } catch (e) {
      check(device, 'ran to the end', false, String(e).split('\n')[0]);
    }
    await ctx.close();
  }

  await browser.close();
  console.log(JSON.stringify({ ok: failed.length === 0 && errs.length === 0, failed, errs: errs.slice(0, 6), report }));
})();
