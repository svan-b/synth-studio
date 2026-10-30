// Subharmonicon behaviour check in the real app (Playwright, headless Chromium):
//   node scripts/checks/subharmonicon.cjs <baseUrl> <outDir>
// 1. Subharmonic ratios: VCO alone vs each sub alone, measured with an AnalyserNode (FFT peak).
// 2. QUANTIZE snaps the VCO FREQ knob (500 Hz -> B4 in 12-ET).
// 3. Polyrhythm: ÷3 on Sequencer 1 against ÷4 on Sequencer 2 -> step counts 4 : 3.
// 4. Studio ▶ at the studio BPM: synced step interval follows 120 and 90 BPM (16th master pulse).
// 5. Studio Clock CLOCK -> Subharmonicon CLOCK IN: the cable's 1/8 pulses take over from the 16ths.
// 6. Every preset makes sound under the studio transport and under its audition.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const [, , base = 'http://localhost:3124', outDir = '.'] = process.argv;
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('synth-studio-storage', JSON.stringify({
        state: {
          currentDevice: 'subharmonicon', devices: {}, completedLessons: [],
          studio: { rack: [{ id: 'subharmonicon', device: 'subharmonicon' }], cables: [], routes: {}, sync: {}, bpm: 120, swing: 0, arrangement: { enabled: false, loop: true, sections: [] } },
        },
        version: 4,
      }));
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('synth-studio-welcomed', '1');
    }
  });
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__synthStudio, null, { timeout: 15000 });
  await page.mouse.click(4, 4);
  await page.waitForTimeout(1200);

  const result = await page.evaluate(async () => {
    const { store, hub } = window.__synthStudio;
    const S = () => store.getState();
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const inst = 'subharmonicon';
    hub.ensureAudio();
    await wait(300);
    const mod = await hub.loadModule(inst);
    const spec = mod.spec;
    const defaults = {};
    Object.entries(spec.controls).forEach(([id, c]) => { if ('default' in c && c.type !== 'jack') defaults[id] = c.default; });
    const set = v => S().setControlValues(inst, v);
    const reset = () => { hub.stopAll(); S().clearPatchConnections(inst); S().resetControlsToSpec(inst, { ...defaults, play: false }); };
    const engine = () => hub.getEngine(inst);
    const out = () => engine().getMainOutput();
    const ctx = () => out().context;
    // Analyser on the instrument's own output
    const an = ctx().createAnalyser();
    an.fftSize = 32768;
    an.smoothingTimeConstant = 0;
    out().connect(an);
    const fbuf = new Float32Array(an.frequencyBinCount);
    const tbuf = new Float32Array(an.fftSize);
    const sr = ctx().sampleRate;
    const peakHz = (lo, hi) => {
      an.getFloatFrequencyData(fbuf);
      const bin = sr / an.fftSize;
      let k = Math.max(2, Math.floor(lo / bin)), best = k;
      for (; k < Math.min(fbuf.length - 2, hi / bin); k++) if (fbuf[k] > fbuf[best]) best = k;
      const a = fbuf[best - 1], b = fbuf[best], c = fbuf[best + 1];
      const p = 0.5 * (a - c) / (a - 2 * b + c);
      return (best + (Number.isFinite(p) ? p : 0)) * bin;
    };
    const level = async ms => {
      let pk = 0, sumsq = 0, n = 0;
      const t0 = performance.now();
      while (performance.now() - t0 < ms) {
        an.getFloatTimeDomainData(tbuf);
        for (const x of tbuf) { const a = Math.abs(x); if (a > pk) pk = a; sumsq += x * x; n++; }
        await wait(40);
      }
      return { peak: +pk.toFixed(4), rms: +Math.sqrt(sumsq / Math.max(1, n)).toFixed(4) };
    };
    const res = {};

    // ---- 1. subharmonic ratios -------------------------------------------------------
    reset();
    const drone = { eg_mode: 2, quantize: 0, vco1_wave: 2, vco2_wave: 2, cutoff: 20000, resonance: 0, vcf_eg_amt: 0, volume: 60,
      vco1_level: 0, vco1_sub1_level: 0, vco1_sub2_level: 0, vco2_level: 0, vco2_sub1_level: 0, vco2_sub2_level: 0,
      seq1_osc: false, seq2_osc: false, vco1_freq: 523.25, vco2_freq: 392.0 };
    set(drone);
    await wait(700);
    const ratios = [];
    for (const [v, f0] of [[1, 523.25], [2, 392.0]]) {
      set({ [`vco${v}_level`]: 80 });
      await wait(500);
      const fv = peakHz(f0 * 0.8, f0 * 1.25);
      set({ [`vco${v}_level`]: 0 });
      for (const [s, n] of [[1, 2], [1, 3], [2, 5], [1, 7], [2, 12], [1, 16]]) {
        set({ [`vco${v}_sub${s}_freq`]: -n, [`vco${v}_sub${s}_level`]: 90 });
        await wait(550);
        const fs = peakHz(fv / n * 0.85, fv / n * 1.15);
        set({ [`vco${v}_sub${s}_level`]: 0 });
        ratios.push({ vco: v, sub: s, div: n, vcoHz: +fv.toFixed(2), subHz: +fs.toFixed(3), ratio: +(fv / fs).toFixed(4), ok: Math.abs(fv / fs - n) / n < 0.006 });
      }
    }
    res.ratios = ratios;
    res.ratiosOk = ratios.every(r => r.ok);

    // ---- 2. QUANTIZE snaps VCO FREQ ------------------------------------------------------
    set({ quantize: 1, vco1_freq: 500, vco1_level: 80 });
    await wait(600);
    const q12 = peakHz(400, 600);
    set({ quantize: 0 });
    await wait(600);
    const q0 = peakHz(400, 600);
    set({ vco1_level: 0 });
    res.quantize = { knobHz: 500, quantized12ET: +q12.toFixed(2), unquantized: +q0.toFixed(2), ok: Math.abs(q12 - 493.88) < 2 && Math.abs(q0 - 500) < 2 };

    // ---- helpers: step changes over time -----------------------------------------------------
    const watchSteps = async ms => {
      const log = { seq1: [], seq2: [] };
      let last = {};
      const t0 = performance.now();
      while (performance.now() - t0 < ms) {
        const st = hub.getState(inst).steps || {};
        for (const k of ['seq1', 'seq2']) if (st[k] !== last[k]) { log[k].push(performance.now() - t0); last[k] = st[k]; }
        await wait(8);
      }
      const iv = a => { const d = []; for (let i = 2; i < a.length; i++) d.push(a[i] - a[i - 1]); d.sort((x, y) => x - y); return d.length ? d[Math.floor(d.length / 2)] : null; };
      return { seq1: log.seq1.length - 1, seq2: log.seq2.length - 1, seq1Ms: iv(log.seq1), seq2Ms: iv(log.seq2) };
    };

    // ---- 3 + 4. polyrhythm on the studio clock at 120 and 90 BPM --------------------------------
    const p34 = spec.presets.poly_34;
    reset();
    S().loadPreset(inst, { ...defaults, ...p34.settings }, p34.patchConnections || []);
    await wait(400);
    S().setBpm(120);
    hub.startAll();
    await wait(400);
    const w120 = await watchSteps(6000);
    hub.stopAll();
    await wait(300);
    S().setBpm(90);
    hub.startAll();
    await wait(400);
    const w90 = await watchSteps(6000);
    hub.stopAll();
    S().setBpm(120);
    res.polyrhythm = { at120: w120, at90: w90,
      ratio: +(w120.seq1 / Math.max(1, w120.seq2)).toFixed(3),
      ok: Math.abs(w120.seq1 / Math.max(1, w120.seq2) - 4 / 3) < 0.15 };
    // ÷3 of 16ths at 120 BPM = 375 ms, ÷4 = 500 ms; at 90 BPM 500 ms and 667 ms
    res.studioTempo = {
      expect120: [375, 500], got120: [w120.seq1Ms, w120.seq2Ms],
      expect90: [500, 666.7], got90: [w90.seq1Ms, w90.seq2Ms],
      ok: Math.abs(w120.seq1Ms - 375) < 40 && Math.abs(w120.seq2Ms - 500) < 40 && Math.abs(w90.seq1Ms - 500) < 45 && Math.abs(w90.seq2Ms - 666.7) < 50,
    };

    // ---- 5. Studio Clock CLOCK -> CLOCK IN -------------------------------------------------------
    reset();
    S().loadPreset(inst, { ...defaults, ...p34.settings, rhythm3: -1, rhythm4: -2 }, []);
    if (!S().studio.rack.some(r => r.device === 'studio-clock')) S().addToRack('studio-clock');
    await wait(1200);
    const clockInst = S().studio.rack.find(r => r.device === 'studio-clock').id;
    S().setControlValue(clockInst, 'division', 1); // 1/8 note pulses
    hub.startAll();
    await wait(400);
    const synced = await watchSteps(3000);
    hub.stopAll();
    await wait(300);
    S().addStudioCable({ from: { instance: clockInst, jack: 'out_clock' }, to: { instance: inst, jack: 'in_clock' } });
    await wait(500);
    hub.startAll();
    await wait(400);
    const cabled = await watchSteps(3000);
    hub.stopAll();
    S().clearStudioCables();
    // ÷1 counts every pulse: 16ths (125 ms) synced, 8ths (250 ms) from the cable; ÷2 twice that
    res.studioClockCable = { synced, cabled,
      ok: Math.abs(synced.seq1Ms - 125) < 25 && Math.abs(cabled.seq1Ms - 250) < 35 && Math.abs(cabled.seq2Ms - 500) < 50 };

    // ---- 6. every preset makes sound -------------------------------------------------------
    const presets = [];
    for (const [key, p] of Object.entries(spec.presets)) {
      reset();
      await wait(250);
      S().loadPreset(inst, { ...defaults, ...p.settings }, p.patchConnections || []);
      await wait(450);
      hub.startAll();
      const tr = await level(1600);
      hub.stopAll();
      await wait(250);
      hub.audition(inst, null, { ms: 1800 });
      const au = await level(1600);
      hub.stopAudition();
      await wait(200);
      presets.push({ key, name: p.name, transportPeak: tr.peak, auditionPeak: au.peak, ok: tr.peak > 0.01 && au.peak > 0.01 && Number.isFinite(tr.peak) && Number.isFinite(au.peak) });
    }
    reset();
    res.presets = presets;
    res.presetsOk = presets.every(p => p.ok);
    return res;
  });

  result.errors = errors;
  result.ok = result.ratiosOk && result.quantize.ok && result.polyrhythm.ok && result.studioTempo.ok && result.studioClockCable.ok && result.presetsOk && !errors.length;
  fs.writeFileSync(path.join(outDir, 'subh-check.json'), JSON.stringify(result, null, 2));
  const brief = {
    ratiosOk: result.ratiosOk, quantize: result.quantize, polyrhythm: { ratio: result.polyrhythm.ratio, ok: result.polyrhythm.ok, at120: result.polyrhythm.at120 },
    studioTempo: result.studioTempo, studioClockCable: result.studioClockCable,
    presetsOk: result.presetsOk, silent: result.presets.filter(p => !p.ok), errors, ok: result.ok,
  };
  console.log(JSON.stringify(brief, null, 2));
  await browser.close();
  process.exit(result.ok ? 0 : 1);
})();
