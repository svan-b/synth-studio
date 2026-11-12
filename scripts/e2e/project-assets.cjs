// ============================================================================
// User samples travel inside project files (DeviceModule.assets):
//   node scripts/e2e/project-assets.cjs <baseUrl>
// Browser A: a user sample in the Rytm's slot 1 (stored in IndexedDB), then Save project to
// a file - the file must carry the sample. Browser B (empty storage, like the iPad Home Screen
// app or another device): open that file - the sample must be back in IndexedDB and in slot 1.
// ============================================================================
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');

const seed = () => {
  if (sessionStorage.getItem('seeded')) return;
  sessionStorage.setItem('seeded', '1');
  localStorage.setItem('synth-studio-welcomed', '1');
  localStorage.setItem('synth-studio-storage', JSON.stringify({ state: { currentDevice: 'analog-rytm', devices: {}, completedLessons: [] }, version: 3 }));
};
const ready = page => page.waitForFunction(() => { const S = window.__synthStudio; return S && S.hub.status === 'on' && !!S.hub.getModule('analog-rytm'); }, null, { timeout: 30000 });

(async () => {
  const [, , base = 'http://localhost:3100'] = process.argv;
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const errs = [];
  const r = {};
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ss-assets-')), 'project.synthstudio.json');
  try {
    // ---- A: a sample in slot 1, saved with the project ----
    const a = await browser.newContext({ viewport: { width: 1180, height: 820 }, acceptDownloads: true });
    const pa = await a.newPage();
    pa.on('pageerror', e => errs.push('A ' + String(e)));
    await pa.addInitScript(seed);
    await pa.goto(base, { waitUntil: 'networkidle' });
    await pa.getByRole('button', { name: /tap for sound/i }).click().catch(() => pa.mouse.click(4, 4));
    await ready(pa);
    await pa.evaluate(async () => {
      const S = window.__synthStudio;
      // a 0.2 s 220 Hz tone as 16-bit PCM, base64
      const n = 9600, pcm = new Int16Array(n);
      for (let i = 0; i < n; i++) pcm[i] = Math.round(Math.sin((2 * Math.PI * 220 * i) / 48000) * 0.5 * 32767);
      let bin = ''; const bytes = new Uint8Array(pcm.buffer);
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      await S.hub.getModule('analog-rytm').assets.restore([{ kind: 'audio', id: 'stest-e2e', name: 'E2E TONE', rate: 48000, pcm16: btoa(bin) }]);
      S.store.getState().updateDeviceData('analog-rytm', d => ({ ...d, samples: { 1: { id: 'stest-e2e', name: 'E2E TONE' } } }));
    });
    await pa.waitForTimeout(800);
    const [dl] = await Promise.all([
      pa.waitForEvent('download', { timeout: 15000 }),
      pa.evaluate(() => window.dispatchEvent(new CustomEvent('synth-studio:save-project'))),
    ]);
    await dl.saveAs(file);
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    r.saved = { assets: Object.keys(saved.assets ?? {}), first: saved.assets?.['analog-rytm']?.[0] && { id: saved.assets['analog-rytm'][0].id, name: saved.assets['analog-rytm'][0].name, bytes: saved.assets['analog-rytm'][0].pcm16.length } };
    await a.close();

    // ---- B: empty storage, open the file ----
    const b = await browser.newContext({ viewport: { width: 1180, height: 820 } });
    const pb = await b.newPage();
    pb.on('pageerror', e => errs.push('B ' + String(e)));
    await pb.addInitScript(seed);
    await pb.goto(base, { waitUntil: 'networkidle' });
    await pb.getByRole('button', { name: /tap for sound/i }).click().catch(() => pb.mouse.click(4, 4));
    await ready(pb);
    r.before = await pb.evaluate(async () => (await window.__synthStudio.hub.getModule('analog-rytm').assets.collect({ samples: { 1: { id: 'stest-e2e', name: 'x' } } })).length);
    await pb.locator('input[type="file"][accept=".json,application/json"]').setInputFiles(file);
    await pb.waitForTimeout(2500);
    r.after = await pb.evaluate(async () => {
      const S = window.__synthStudio;
      const data = S.store.getState().devices['analog-rytm']?.data;
      const list = await S.hub.getModule('analog-rytm').assets.collect(data);
      return { slot1: data?.samples?.[1]?.id ?? null, restored: list.map(x => x.id), samples: list[0] ? Math.round(list[0].pcm16.length * 3 / 8) : 0 };
    });
    await b.close();
  } catch (e) {
    errs.push('test: ' + String(e).split('\n')[0]);
  }
  const ok = !!(r.saved?.first?.id === 'stest-e2e' && r.before === 0 && r.after?.slot1 === 'stest-e2e' && r.after?.restored?.[0] === 'stest-e2e' && r.after.samples > 9000);
  console.log(JSON.stringify({ ok, ...r, errs: errs.slice(0, 5) }));
  await browser.close();
})();
