// ============================================================================
// Monkey test of the studio: random tabs, added instruments, studio sets, transport,
// BPM, mixer mutes and solos, routes, undo/redo, the Clock chip and lessons (start
// one, skip a few steps); reports every page error with the actions before it.
//   node scripts/e2e/studio-monkey.cjs <baseUrl> [seconds] [seed]          TOUCH=1 for iPad touch
// ============================================================================
const { chromium } = require('playwright');
(async () => {
  const [, , base, secs = '120', seedArg = '5'] = process.argv;
  let seed = Number(seedArg) >>> 0 || 1;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const pick = a => a[Math.floor(rnd() * a.length)];
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, hasTouch: process.env.TOUCH === '1' });
  const errs = []; const log = [];
  page.on('pageerror', e => errs.push({ err: String(e).slice(0, 400), after: log.slice(-8) }));
  page.on('console', m => { if (m.type() === 'error') errs.push({ err: m.text().slice(0, 400), after: log.slice(-8) }); });
  page.on('dialog', d => d.accept().catch(() => {}));
  await page.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('synth-studio-welcomed', '1'); } });
  await page.goto(base, { waitUntil: 'networkidle' }); await page.waitForTimeout(1200);
  await page.getByRole('button', { name: /tap for sound/i }).click().catch(() => page.mouse.click(4, 4));
  const t0 = Date.now(); let n = 0;
  const click = async (loc, what) => { if (await loc.count()) { log.push(what); await loc.first().click({ timeout: 1500 }); return true; } return false; };
  while (Date.now() - t0 < Number(secs) * 1000) {
    n++;
    const kind = pick(['tab', 'tab', 'add', 'set', 'play', 'bpm', 'mixer', 'route', 'undo', 'lesson', 'escape', 'clock']);
    try {
      if (kind === 'tab') {
        const tabs = page.locator('nav[aria-label="Instruments"] button');
        const c = await tabs.count(); if (c) { const i = Math.floor(rnd() * c); log.push(`tab ${i}`); await tabs.nth(i).click({ timeout: 1500 }); }
      } else if (kind === 'add') {
        if (await click(page.locator('nav[aria-label="Instruments"] button', { hasText: /Instrument/ }), 'open instruments')) {
          await page.waitForTimeout(300);
          const btns = page.getByRole('dialog').getByRole('button', { name: /^(Add to studio|Add another|Switch to this|Open)$/ });
          const c = await btns.count(); if (c) { const i = Math.floor(rnd() * c); log.push(`instrument btn ${i}`); await btns.nth(i).click({ timeout: 1500 }); }
          await page.keyboard.press('Escape');
        }
      } else if (kind === 'set') {
        await click(page.locator('nav[aria-label="Instruments"] button', { hasText: /Studio/ }), 'studio tab');
        await page.waitForTimeout(400);
        const loads = page.getByRole('button', { name: /^Load stage \\d|^Load set$/ });
        const c = await loads.count(); if (c) { const i = Math.floor(rnd() * c); log.push(`load set ${i}`); await loads.nth(i).click({ timeout: 1500 }); }
      } else if (kind === 'play') {
        log.push('transport'); await page.locator('header button', { hasText: /^[▶■]$/ }).first().click({ timeout: 1500 }).catch(() => page.keyboard.press('Space'));
      } else if (kind === 'bpm') {
        const b = page.locator('header button', { hasText: pick(['+', '−']) }); await click(b, 'bpm');
      } else if (kind === 'mixer') {
        const ms = page.locator('section[aria-label="Mixer"] button[aria-label^="Mute"], section[aria-label="Mixer"] button[aria-label^="Solo"]');
        const c = await ms.count(); if (c) { const i = Math.floor(rnd() * c); log.push(`mixer btn ${i}`); await ms.nth(i).click({ timeout: 1500 }); }
      } else if (kind === 'route') {
        const sels = page.locator('section[aria-label="Mixer"] select[aria-label$="output"]');
        const c = await sels.count(); if (c) {
          const s = sels.nth(Math.floor(rnd() * c)); const opts = await s.locator('option').evaluateAll(o => o.map(x => x.value));
          const v = pick(opts); log.push(`route ${v}`); await s.selectOption(v, { timeout: 1500 });
        }
      } else if (kind === 'undo') {
        await click(page.getByRole('button', { name: pick([/^Undo/, /^Redo/]) }), 'undo/redo');
      } else if (kind === 'lesson') {
        if (await click(page.getByRole('button', { name: /^Lessons/ }), 'lessons')) {
          await page.waitForTimeout(400);
          const ls = page.getByRole('dialog').locator('button').filter({ hasText: /min/ });
          const c = await ls.count();
          if (c) { const i = Math.floor(rnd() * c); log.push(`lesson ${i}`); await ls.nth(i).click({ timeout: 1500 }); await page.waitForTimeout(600);
            for (let k = 0; k < 3; k++) { if (!(await click(page.getByRole('button', { name: /^Skip/ }), 'skip'))) break; await page.waitForTimeout(250); } }
          else await page.keyboard.press('Escape');
        }
      } else if (kind === 'clock') {
        await click(page.getByRole('button', { name: /^Clock:/ }), 'clock chip');
      } else {
        log.push('escape'); await page.keyboard.press('Escape');
      }
    } catch (e) { /* moved or gone */ }
    await page.waitForTimeout(80 + rnd() * 250);
  }
  const st = await page.evaluate(() => { const S = window.__synthStudio; const s = S.store.getState().studio; return { rack: s.rack.map(r => r.id), status: S.hub.status }; });
  console.log(JSON.stringify({ actions: n, errors: errs.length, first: errs.slice(0, 3), end: st }));
  await browser.close();
})();
