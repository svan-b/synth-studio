// ============================================================================
// Rapid instrument switching across panel-, data- and setup-driven devices:
// the shown instrument must always be the selected one, with no errors (a
// stale module paired with another instrument's data throws or mis-renders).
//   node scripts/e2e/switching.cjs <baseUrl>
// ============================================================================
const { chromium } = require('playwright');

const RACK = [
  { id: 'dfam', device: 'dfam', tab: 'DFAM' },
  { id: 'midi-synth', device: 'midi-synth', tab: 'Your synth' },
  { id: 'analog-rytm', device: 'analog-rytm', tab: 'Analog Rytm' },
  { id: 'wam-plugin', device: 'wam-plugin', tab: 'Web Audio plugin' },
  { id: 'audio-in', device: 'audio-in', tab: 'Audio input' },
];

(async () => {
  const [, , url = 'http://localhost:3000'] = process.argv;
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1180, height: 820 } });
  const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.addInitScript(rack => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('synth-studio-welcomed', '1');
    localStorage.setItem('synth-studio-storage', JSON.stringify({ state: { currentDevice: 'dfam', devices: {}, completedLessons: [], review: {}, focusMode: true,
      studio: { rack: rack.map(({ id, device }) => ({ id, device })), cables: [], routes: {}, sync: {}, bpm: 120, swing: 0, arrangement: { enabled: false, loop: true, sections: [] } } }, version: 5 }));
  }, RACK);
  const found = new Set();
  let mismatches = 0;
  try {
    await p.goto(url, { waitUntil: 'networkidle' });
    await p.waitForTimeout(1200);
    for (let round = 0; round < 3; round++) {
      for (const r of RACK) {
        const btn = p.locator('nav[aria-label="Instruments"] button', { hasText: r.tab }).first();
        if (!(await btn.count())) continue;
        await btn.click();
        found.add(r.tab);
        await p.waitForTimeout(round === 0 ? 400 : 30); // later rounds switch as fast as possible
        if (round === 0) {
          const shown = await p.evaluate(() => document.querySelector('[data-instance]')?.getAttribute('data-instance'));
          if (shown !== r.id) mismatches++;
        }
      }
    }
    await p.waitForTimeout(800);
  } catch (e) {
    errs.push('test: ' + String(e).split('\n')[0]);
  }
  const lastShown = await p.evaluate(() => document.querySelector('[data-instance]')?.getAttribute('data-instance')).catch(() => null);
  console.log(JSON.stringify({ tabsFound: [...found], expectedLast: RACK[RACK.length - 1].id, lastShown, mismatches, errors: errs.slice(0, 8) }));
  await b.close();
})();
