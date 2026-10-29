// ============================================================================
// Separate outputs (DeviceModule.studio.outputs, SynthEngine.connectOutput):
//   node scripts/e2e/outputs.cjs <baseUrl> [outDir]
// The studio side, checked with a stand-in output on the Sub 37 (a 440 Hz tone), so it holds
// whichever instruments declare outputs: turning an output on makes a channel '<instance>/<id>'
// that carries it to the master, mutes, shows in the mixer with an Outs menu, arranger-mutes
// with its instrument and goes away when turned off (the engine gets the destination, then null).
// ============================================================================
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const [, , base = 'http://localhost:3100', outDir = ''] = process.argv;
  if (outDir) fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('synth-studio-welcomed', '1');
    localStorage.setItem('synth-studio-storage', JSON.stringify({ state: { currentDevice: 'sub37', devices: {}, completedLessons: [] }, version: 3 }));
  });
  const r = {};
  try {
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await page.getByRole('button', { name: /tap for sound/i }).click().catch(() => page.mouse.click(4, 4));
    await page.waitForFunction(() => { const S = window.__synthStudio; return S && S.hub.status === 'on' && !!S.hub.getStripOutput('sub37'); }, null, { timeout: 30000 });

    // A stand-in separate output: the module declares it, the engine connects a tone to it
    await page.evaluate(() => {
      const S = window.__synthStudio;
      const mod = S.hub.getModule('sub37');
      mod.studio = { ...(mod.studio || {}), outputs: [{ id: 'test', label: 'TEST' }] };
      const ctx = S.audio.getAudioContext();
      const osc = ctx.createOscillator();
      osc.frequency.value = 440;
      const g = ctx.createGain();
      g.gain.value = 0.2;
      osc.connect(g);
      osc.start();
      window.__outCalls = [];
      S.hub.getEngine('sub37').connectOutput = (id, dest) => {
        window.__outCalls.push([id, !!dest]);
        try { g.disconnect(); } catch (e) { /* */ }
        if (dest) g.connect(dest);
      };
      // an analyser on whatever node the channel outputs
      window.__rms = async (node, ms = 300) => {
        const a = ctx.createAnalyser(); a.fftSize = 2048; node.connect(a);
        const buf = new Float32Array(a.fftSize); let best = 0; const t0 = performance.now();
        while (performance.now() - t0 < ms) {
          a.getFloatTimeDomainData(buf);
          let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
          best = Math.max(best, Math.sqrt(s / buf.length));
          await new Promise(res => setTimeout(res, 30));
        }
        try { node.disconnect(a); } catch (e) { /* */ }
        return +best.toFixed(4);
      };
    });

    // On: a channel of its own, carrying the output to the master
    r.on = await page.evaluate(async () => {
      const S = window.__synthStudio;
      S.store.getState().setOutputUsed('sub37', 'test', true);
      await new Promise(res => setTimeout(res, 300));
      const out = S.hub.getStripOutput('sub37/test');
      return { strip: !!out, calls: window.__outCalls.slice(), rms: out ? await window.__rms(out) : 0, masterLevel: window.__synthLevel ? +window.__synthLevel().toFixed(3) : null };
    });

    // The mixer shows it, with the instrument's Outs menu
    await page.getByRole('button', { name: /Studio/ }).first().click();
    await page.getByText('Opening the studio…').waitFor({ state: 'detached', timeout: 20000 }).catch(() => undefined);
    await page.waitForTimeout(600);
    r.ui = await page.evaluate(() => {
      const mixer = document.querySelector('section[aria-label="Mixer"]');
      const text = mixer ? mixer.innerText : '';
      return { strip: /Sub 37 · TEST/.test(text), outs: !!mixer && [...mixer.querySelectorAll('summary')].some(s => /^Outs/.test(s.innerText.trim())) };
    });
    if (outDir) {
      await page.locator('section[aria-label="Mixer"]').scrollIntoViewIfNeeded().catch(() => undefined);
      await page.locator('section[aria-label="Mixer"] summary').first().click().catch(() => undefined);
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(outDir, 'outputs-mixer.png') });
      await page.locator('section[aria-label="Mixer"] summary').first().click().catch(() => undefined);
    }

    // Mute, then the arranger's mute of the instrument mutes its outputs too
    r.mute = await page.evaluate(async () => {
      const S = window.__synthStudio;
      S.store.getState().setChannel('sub37/test', { mute: true });
      await new Promise(res => setTimeout(res, 250));
      const muted = await window.__rms(S.hub.getStripOutput('sub37/test'));
      S.store.getState().setChannel('sub37/test', { mute: false });
      await new Promise(res => setTimeout(res, 250));
      S.hub.setMuted('sub37', true);
      await new Promise(res => setTimeout(res, 250));
      const arranger = await window.__rms(S.hub.getStripOutput('sub37/test'));
      S.hub.setMuted('sub37', false);
      await new Promise(res => setTimeout(res, 250));
      const back = await window.__rms(S.hub.getStripOutput('sub37/test'));
      return { muted, arranger, back };
    });

    // Off: the channel goes, and the engine gets null (the part is back in the main output)
    r.off = await page.evaluate(async () => {
      const S = window.__synthStudio;
      S.store.getState().setOutputUsed('sub37', 'test', false);
      await new Promise(res => setTimeout(res, 300));
      return { strip: !!S.hub.getStripOutput('sub37/test'), calls: window.__outCalls.slice(), saved: S.store.getState().studio.outputs ?? {} };
    });
  } catch (e) {
    errs.push('test: ' + String(e).split('\n')[0]);
  }
  const ok = !!(r.on?.strip && r.on.rms > 0.05 && r.on.calls?.[0]?.[0] === 'test' && r.on.calls[0][1] === true
    && r.ui?.strip && r.ui?.outs
    && r.mute?.muted < 0.005 && r.mute?.arranger < 0.005 && r.mute?.back > 0.05
    && r.off && !r.off.strip && r.off.calls?.at(-1)?.[1] === false && !r.off.saved.sub37);
  console.log(JSON.stringify({ ok, ...r, errs: errs.slice(0, 5) }));
  await browser.close();
})();
