// Run: node scripts/checks/sub37.cjs http://localhost:3125 <outDir>   (after npm run build && npx next start -p 3125)
// Sub 37 interaction check, against the Subsequent 37 manual (REFERENCE.md):
//  1. keys by mouse (desktop) and by touch (iPad), with sound
//  2. DUO MODE: two keys give two pitches through one filter (KB CTRL HI / LO pick which oscillator
//     takes the top key); mono plays one note (last-note priority). Rendered offline, plus a
//     two-finger chord on the iPad
//  3. the four filter slopes, rendered offline: attenuation 2-4x above the cutoff, in dB per octave
//  4. a latched arpeggio with ARP SYNC waits silently, runs at the studio tempo on the studio ▶
//     (1/16 steps) and stops on ■
//  5. every preset makes sound (synced arpeggios with the studio playing)
//  6. screenshots at desktop and iPad size, no console errors
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const [, , base = 'http://localhost:3125', outDir = '.'] = process.argv;
fs.mkdirSync(outDir, { recursive: true });

const seed = d => {
  if (!sessionStorage.getItem('seeded')) {
    localStorage.setItem('synth-studio-storage', JSON.stringify({
      state: { currentDevice: d, devices: {}, completedLessons: [], studio: { rack: [{ id: d, device: d }], cables: [], routes: {}, sync: {}, bpm: 120, swing: 0, arrangement: { enabled: false, loop: true, sections: [] } } },
      version: 5,
    }));
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('synth-studio-welcomed', '1');
  }
};

/** In-page helpers: an analyser on the Sub 37's channel, an offline renderer of the engine, an FFT */
const PAGE_LIB = () => {
  window.__s37 = {
    analyser() {
      if (this.an) return this.an;
      const { hub, audio } = window.__synthStudio;
      const ctx = audio.getAudioContext();
      const an = ctx.createAnalyser();
      an.fftSize = 4096;
      hub.getStripInput('sub37').connect(an);
      this.an = an;
      return an;
    },
    async peak(ms) {
      const an = this.analyser();
      const td = new Float32Array(an.fftSize);
      let p = 0;
      const t0 = performance.now();
      while (performance.now() - t0 < ms) {
        an.getFloatTimeDomainData(td);
        for (const v of td) p = Math.max(p, Math.abs(v));
        await new Promise(r => setTimeout(r, 30));
      }
      return +p.toFixed(4);
    },
    fft(x) {
      const n = x.length;
      const re = Float64Array.from(x, (v, i) => v * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1))));
      const im = new Float64Array(n);
      for (let i = 1, j = 0; i < n; i++) {
        let bit = n >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
      }
      for (let len = 2; len <= n; len <<= 1) {
        const a = (-2 * Math.PI) / len;
        for (let i = 0; i < n; i += len) {
          for (let k = 0; k < len / 2; k++) {
            const wr = Math.cos(a * k), wi = Math.sin(a * k);
            const ur = re[i + k], ui = im[i + k];
            const vr = re[i + k + len / 2] * wr - im[i + k + len / 2] * wi;
            const vi = re[i + k + len / 2] * wi + im[i + k + len / 2] * wr;
            re[i + k] = ur + vr; im[i + k] = ui + vi;
            re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
          }
        }
      }
      const mag = new Float64Array(n / 2);
      for (let i = 0; i < n / 2; i++) mag[i] = Math.hypot(re[i], im[i]);
      return mag;
    },
    /** Render the real engine offline: spec defaults, then `settings`, then `notes` held */
    async render(settings, notes, seconds = 1.3) {
      const { hub } = window.__synthStudio;
      const mod = await hub.loadModule('sub37');
      const SR = 48000;
      const ctx = new OfflineAudioContext(1, Math.round(SR * seconds), SR);
      await ctx.audioWorklet.addModule('/worklets/synth-processors.js');
      for (const u of mod.worklets) await ctx.audioWorklet.addModule(u);
      const eng = mod.createEngine();
      Object.entries(mod.spec.controls).forEach(([id, c]) => { if ('default' in c && c.default !== undefined) eng.setParam(id, c.default); });
      Object.entries(settings).forEach(([k, v]) => eng.setParam(k, v));
      eng.start(ctx, ctx.destination);
      ctx.suspend(256 / SR).then(() => { notes.forEach(n => eng.noteOn(n, 1)); ctx.resume(); });
      const buf = await ctx.startRendering();
      try { eng.dispose(); } catch { /* */ }
      return { x: buf.getChannelData(0), sr: SR };
    },
    /** Magnitude (dB) of the strongest bin near f */
    level(mag, sr, n, f) {
      const b = Math.round((f * n) / sr);
      let m = 0;
      for (let k = Math.max(1, b - 3); k <= b + 3 && k < mag.length; k++) m = Math.max(m, mag[k]);
      return 20 * Math.log10(m + 1e-30);
    },
  };
};

async function unlock(page) {
  const unlockBtn = page.getByRole('button', { name: /enable audio|tap for sound/i });
  if (await unlockBtn.count()) await unlockBtn.first().click();
  else await page.mouse.click(4, 4);
  await page.waitForTimeout(900);
}

(async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const result = { errors: [] };

  // ======================= Desktop, mouse =======================
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('console', m => { if (m.type() === 'error') result.errors.push(m.text()); });
  page.on('pageerror', e => result.errors.push(String(e)));
  await page.addInitScript(seed, 'sub37');
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await unlock(page);
  await page.evaluate(PAGE_LIB);
  const peak = ms => page.evaluate(ms => window.__s37.peak(ms), ms);

  // ---- 1. a key by mouse ----
  const keyBox = async note => (await page.locator(`[data-note="${note}"]`).boundingBox());
  const kb = await keyBox(48);
  const holdKey = async (ms, note = 48) => {
    const b = note === 48 ? kb : await keyBox(note);
    await page.mouse.move(b.x + b.width / 2, b.y + b.height * 0.85);
    await page.mouse.down();
    const p = await peak(ms);
    await page.mouse.up();
    return p;
  };
  result.idle = await peak(300);
  result.mouseKey = await holdKey(700);
  await page.waitForTimeout(700);
  result.afterRelease = await peak(300);

  // ---- 2. DUO MODE / paraphonic, offline ----
  result.duo = await page.evaluate(async () => {
    const S = window.__s37;
    const N = 32768;
    const pitches = async settings => {
      const { x, sr } = await S.render({ cutoff: 20000, filter_kb_amt: 0, ...settings }, [48, 55]);
      const mag = S.fft(x.subarray(x.length - N));
      return { c3: +S.level(mag, sr, N, 130.81).toFixed(1), g3: +S.level(mag, sr, N, 196.0).toFixed(1) };
    };
    return {
      // only OSC 2 audible: which key does it take?
      hiOsc2: await pitches({ duo_mode: true, kb_ctrl: 2, mix_osc1: 0, mix_osc2: 50 }),
      loOsc2: await pitches({ duo_mode: true, kb_ctrl: 1, mix_osc1: 0, mix_osc2: 50 }),
      duoBoth: await pitches({ duo_mode: true, kb_ctrl: 2, mix_osc1: 50, mix_osc2: 50 }),
      mono: await pitches({ duo_mode: false, mix_osc1: 50, mix_osc2: 50 }),
    };
  });

  // ---- 3. filter slopes, offline: attenuation against the open filter, 2x to 4x the cutoff ----
  result.slopes = await page.evaluate(async () => {
    const S = window.__s37;
    const N = 32768, FC = 250, F0 = 65.406; // MIDI 36 at 8'
    const spectrum = async settings => {
      const { x, sr } = await S.render({ mix_osc1: 20, filter_kb_amt: 0, resonance: 0, multidrive: 0, ...settings }, [36]);
      return { mag: S.fft(x.subarray(x.length - N)), sr };
    };
    const open = await spectrum({ cutoff: 20000 });
    const out = {};
    for (const slope of [0, 1, 2, 3]) {
      const f = await spectrum({ cutoff: FC, filter_slope: slope });
      // least-squares slope of (filtered - open) dB against log2(f) over the harmonics 2fc..4fc
      const pts = [];
      for (let h = 1; h * F0 <= 4 * FC; h++) {
        const hz = h * F0;
        if (hz < 2 * FC) continue;
        pts.push([Math.log2(hz), S.level(f.mag, f.sr, N, hz) - S.level(open.mag, open.sr, N, hz)]);
      }
      const mx = pts.reduce((a, p) => a + p[0], 0) / pts.length, my = pts.reduce((a, p) => a + p[1], 0) / pts.length;
      const k = pts.reduce((a, p) => a + (p[0] - mx) * (p[1] - my), 0) / pts.reduce((a, p) => a + (p[0] - mx) ** 2, 0);
      out[['-6dB', '-12dB', '-18dB', '-24dB'][slope]] = { dBperOct: +k.toFixed(1), at2fc: +(pts[0][1]).toFixed(1) };
    }
    return out;
  });

  // ---- 4. latched, synced arpeggio and the studio transport ----
  result.arp = await (async () => {
    await page.evaluate(() => {
      const { store } = window.__synthStudio;
      store.getState().setBpm(100);
      store.getState().setControlValues('sub37', { arp_on: true, arp_latch: true, arp_sync: true, arp_div: 16, arp_pattern: 0, arp_oct_range: 3, aeg_sustain: 60 });
    });
    await page.waitForTimeout(300);
    // a chord on the computer keys (A D G = MIDI 36 40 43), then let go: LATCH holds it
    await page.mouse.click(4, 4);
    for (const k of ['a', 'd', 'g']) await page.keyboard.down(k);
    await page.waitForTimeout(250);
    for (const k of ['a', 'd', 'g']) await page.keyboard.up(k);
    const waitingPeak = await peak(800);
    const waiting = await page.evaluate(() => window.__synthStudio.hub.getState('sub37').clockWait === true);
    await page.evaluate(() => {
      const { hub } = window.__synthStudio;
      window.__steps = [];
      window.__unsub = hub.subscribeState('sub37', st => {
        const last = window.__steps[window.__steps.length - 1];
        if (typeof st.arpStep === 'number' && st.arpStep >= 0 && (!last || last.s !== st.arpStep)) window.__steps.push({ s: st.arpStep, t: performance.now() });
      });
    });
    await page.getByRole('button', { name: 'Play studio' }).click();
    const runningPeak = await peak(2200);
    const steps = await page.evaluate(() => { window.__unsub(); return window.__steps; });
    const dts = steps.slice(1).map((x, i) => x.t - steps[i].t).sort((a, b) => a - b);
    const median = dts.length ? dts[Math.floor(dts.length / 2)] : null;
    await page.screenshot({ path: path.join(outDir, 'sub37-check-arp-running.png') });
    await page.getByRole('button', { name: 'Stop studio' }).click();
    await page.waitForTimeout(900);
    const stoppedPeak = await peak(500);
    const stepAfterStop = await page.evaluate(() => window.__synthStudio.hub.getState('sub37').arpStep);
    await page.evaluate(() => {
      const { store } = window.__synthStudio;
      store.getState().setControlValues('sub37', { arp_on: false, arp_latch: false, arp_sync: false });
      store.getState().setBpm(120);
    });
    await page.waitForTimeout(600);
    return { waitingPeak, waiting, runningPeak, steps: steps.length, medianStepMs: median && +median.toFixed(1), expectedStepMs: 150, stoppedPeak, stepAfterStop };
  })();

  // ---- 5. every preset makes sound ----
  result.presets = await (async () => {
    const list = await page.evaluate(async () => {
      const mod = await window.__synthStudio.hub.loadModule('sub37');
      return Object.entries(mod.spec.presets).map(([k, p]) => ({ k, name: p.name, synced: !!(p.settings.arp_on && p.settings.arp_sync) }));
    });
    const out = {};
    for (const p of list) {
      await page.selectOption('select[aria-label="Load preset"]', p.k);
      await page.waitForTimeout(250);
      if (p.synced) await page.evaluate(() => window.__synthStudio.hub.startAll());
      out[p.name] = await holdKey(1300);
      if (p.synced) await page.evaluate(() => window.__synthStudio.hub.stopAll());
      await page.waitForTimeout(350);
    }
    return out;
  })();
  await page.selectOption('select[aria-label="Load preset"]', 'three_osc_mono_bass');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, 'sub37-check-desktop.png') });
  await page.close();

  // ======================= iPad, touch =======================
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: false });
  const ipad = await ctx.newPage();
  ipad.on('console', m => { if (m.type() === 'error') result.errors.push('[ipad] ' + m.text()); });
  ipad.on('pageerror', e => result.errors.push('[ipad] ' + String(e)));
  await ipad.addInitScript(seed, 'sub37');
  await ipad.goto(base, { waitUntil: 'networkidle' });
  await ipad.waitForTimeout(1200);
  const unlock2 = ipad.getByRole('button', { name: /enable audio|tap for sound/i });
  if (await unlock2.count()) await unlock2.first().tap(); else await ipad.touchscreen.tap(4, 4);
  await ipad.waitForTimeout(900);
  await ipad.evaluate(PAGE_LIB);
  const ipeak = ms => ipad.evaluate(ms => window.__s37.peak(ms), ms);
  const cdp = await ctx.newCDPSession(ipad);
  const pt = async (note, id) => { const b = await ipad.locator(`[data-note="${note}"]`).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height * 0.85, id }; };
  // one finger
  const p1 = await pt(48, 1);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [p1] });
  result.touchKey = await ipeak(600);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await ipad.waitForTimeout(800);
  // DUO MODE by touch, then a two-finger chord: both pitches in the spectrum
  await ipad.locator('[data-control="duo_mode"]').tap();
  // OSC 2 plays the second key: give it a level in the mixer (the init patch has it at 0)
  await ipad.evaluate(() => window.__synthStudio.store.getState().setControlValues('sub37', { mix_osc2: 50 }));
  await ipad.waitForTimeout(250);
  const a = await pt(48, 1), b = await pt(55, 2);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a, b] });
  await ipad.waitForTimeout(500);
  result.ipadChord = await ipad.evaluate(async () => {
    const S = window.__s37;
    const an = S.analyser();
    const sr = an.context.sampleRate;
    const fb = new Float32Array(an.frequencyBinCount);
    const acc = new Float64Array(fb.length);
    for (let i = 0; i < 12; i++) {
      an.getFloatFrequencyData(fb);
      for (let k = 0; k < fb.length; k++) acc[k] += Math.pow(10, fb[k] / 20);
      await new Promise(r => setTimeout(r, 40));
    }
    const lvl = f => { const b = Math.round((f * an.fftSize) / sr); let m = 0; for (let k = b - 2; k <= b + 2; k++) m = Math.max(m, acc[k]); return 20 * Math.log10(m / 12 + 1e-12); };
    // between the two fundamentals there is no harmonic of either note
    return { c3: +lvl(130.81).toFixed(1), g3: +lvl(196).toFixed(1), gap: +lvl(163.4).toFixed(1), duo: !!window.__synthStudio.store.getState().devices.sub37?.controlValues.duo_mode };
  });
  result.ipadChord.peak = await ipeak(300);
  await ipad.screenshot({ path: path.join(outDir, 'sub37-check-ipad-chord.png') });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await ipad.waitForTimeout(300);
  await ipad.screenshot({ path: path.join(outDir, 'sub37-check-ipad.png') });
  await ctx.close();

  // ======================= verdict =======================
  const r = result;
  const sl = r.slopes;
  const within = (v, want, tol) => Math.abs(v - want) <= tol;
  r.pass = {
    mouseKeySounds: r.mouseKey > 0.02 && r.idle < 0.005,
    releasesToSilence: r.afterRelease < 0.01,
    touchKeySounds: r.touchKey > 0.02,
    duoKbCtrlHi: r.duo.hiOsc2.g3 > r.duo.hiOsc2.c3 + 20,
    duoKbCtrlLo: r.duo.loOsc2.c3 > r.duo.loOsc2.g3 + 20,
    duoTwoPitches: Math.abs(r.duo.duoBoth.c3 - r.duo.duoBoth.g3) < 10,
    monoOnePitch: r.duo.mono.g3 > r.duo.mono.c3 + 20,
    // a 1-4 pole ladder measured 2x-4x above the cutoff: about -5.3 / -10.6 / -15.9 / -21.2 dB per octave
    filterSlopes: within(sl['-6dB'].dBperOct, -5.3, 1.6) && within(sl['-12dB'].dBperOct, -10.6, 2.2) && within(sl['-18dB'].dBperOct, -15.9, 2.8) && within(sl['-24dB'].dBperOct, -21.2, 3.4),
    arpWaitsForClock: r.arp.waiting && r.arp.waitingPeak < 0.005,
    arpRunsAtStudioTempo: r.arp.runningPeak > 0.02 && r.arp.steps >= 8 && Math.abs(r.arp.medianStepMs - 150) < 25,
    arpStopsOnStop: r.arp.stoppedPeak < 0.005 && r.arp.stepAfterStop === -1,
    ipadTwoFingerChord: r.ipadChord.duo && r.ipadChord.c3 > r.ipadChord.gap + 15 && r.ipadChord.g3 > r.ipadChord.gap + 15 && r.ipadChord.peak > 0.02,
    allPresetsSound: Object.values(r.presets).every(p => p > 0.01),
    noErrors: r.errors.length === 0,
  };
  r.quietPresets = Object.entries(r.presets).filter(([, p]) => p <= 0.01).map(([n]) => n);
  console.log(JSON.stringify(r, null, 2));
  await browser.close();
  process.exit(Object.values(r.pass).every(Boolean) ? 0 : 1);
})();
