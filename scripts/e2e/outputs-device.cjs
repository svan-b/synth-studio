// ============================================================================
// An instrument's hardware outputs as studio separate outputs:
//   node scripts/e2e/outputs-device.cjs <baseUrl> [device] [output]     (default: analog-rytm bd)
// With its demo pattern playing, turning the output on puts that part on a channel of its own
// ('<device>/<output>') and takes it out of the instrument's main channel; turning it off
// brings it back. The new channel starts at the instrument's fader and route. Levels are RMS at
// the channels' outputs over a few bars.
// ============================================================================
const { chromium } = require('playwright');

(async () => {
  const [, , base = 'http://localhost:3100', device = 'analog-rytm', output = 'bd'] = process.argv;
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.addInitScript(d => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('synth-studio-welcomed', '1');
    localStorage.setItem('synth-studio-storage', JSON.stringify({ state: { currentDevice: d, devices: {}, completedLessons: [] }, version: 3 }));
  }, device);
  let r = {};
  try {
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await page.getByRole('button', { name: /tap for sound/i }).click().catch(() => page.mouse.click(4, 4));
    await page.waitForFunction(d => { const S = window.__synthStudio; return S && S.hub.status === 'on' && !!S.hub.getStripOutput(d); }, device, { timeout: 30000 });
    r = await page.evaluate(async ([device, output]) => {
      const ch = `${device}/${output}`;
      const S = window.__synthStudio;
      const ctx = S.audio.getAudioContext();
      const rms = async (node, ms) => {
        const a = ctx.createAnalyser(); a.fftSize = 2048; node.connect(a);
        const buf = new Float32Array(a.fftSize); let sum = 0, n = 0; const t0 = performance.now();
        while (performance.now() - t0 < ms) {
          a.getFloatTimeDomainData(buf);
          for (let i = 0; i < buf.length; i++) { sum += buf[i] * buf[i]; n++; }
          await new Promise(res => setTimeout(res, 40));
        }
        try { node.disconnect(a); } catch (e) { /* */ }
        return +Math.sqrt(sum / Math.max(1, n)).toFixed(4);
      };
      const wait = ms => new Promise(res => setTimeout(res, ms));
      // a fader that isn't at 0 dB: the new output channel must start at it
      S.store.getState().setChannel(device, { gain: -6 });
      S.hub.startAll({ countIn: false });
      await wait(1500);
      const before = await rms(S.hub.getStripOutput(device), 3000);
      S.store.getState().setOutputUsed(device, output, true);
      await wait(500);
      const st = S.store.getState().studio;
      const inherit = { gain: st.mixer?.channels?.[ch]?.gain, route: st.routes[ch] };
      const bdOut = S.hub.getStripOutput(ch);
      const [mainWith, bd] = await Promise.all([rms(S.hub.getStripOutput(device), 3000), bdOut ? rms(bdOut, 3000) : 0]);
      S.store.getState().setOutputUsed(device, output, false);
      await wait(500);
      const after = await rms(S.hub.getStripOutput(device), 3000);
      S.hub.stopAll();
      return { before, mainWith, bd, after, strip: !!bdOut, gone: !S.hub.getStripOutput(ch), inherit };
    }, [device, output]);
  } catch (e) {
    errs.push('test: ' + String(e).split('\n')[0]);
  }
  // the kick moves: its channel carries signal, the main loses energy, and gets it back after
  const ok = !!(r.strip && r.bd > 0.01 && r.mainWith < r.before * 0.9 && r.after > r.before * 0.8 && r.gone
    && r.inherit?.gain === -6 && r.inherit?.route === 'master');
  console.log(JSON.stringify({ ok, ...r, errs: errs.slice(0, 5) }));
  await browser.close();
})();
