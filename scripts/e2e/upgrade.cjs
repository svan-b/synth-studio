// ============================================================================
// Saved-settings upgrades (lib/studio/upgrades.ts): an old v4 save with the
// DFAM's TEMPO in steps per minute loads as 16th-note BPM at the same speed,
// once, and leaves other values and instruments alone.
//   node scripts/e2e/upgrade.cjs <baseUrl>
// ============================================================================
const { chromium } = require('playwright');

(async () => {
  const [, , url = 'http://localhost:3000'] = process.argv;
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 1180, height: 820 } });
  const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('synth-studio-welcomed', '1');
    localStorage.setItem('synth-studio-storage', JSON.stringify({ version: 4, state: { currentDevice: 'dfam', completedLessons: ['sub37-waveforms'], review: {}, focusMode: true,
      devices: { dfam: { controlValues: { tempo: 120, vco1_freq: 220 }, patchConnections: [] }, mother32: { controlValues: { tempo: 120 }, patchConnections: [] } },
      studio: { rack: [{ id: 'dfam', device: 'dfam' }], cables: [], routes: {}, sync: {}, bpm: 120, swing: 0, arrangement: { enabled: false, loop: true, sections: [] } } } }));
  });
  const read = () => p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('synth-studio-storage'));
    return { version: s.version, dfamTempo: s.state.devices.dfam?.controlValues.tempo, vco1: s.state.devices.dfam?.controlValues.vco1_freq, m32Tempo: s.state.devices.mother32?.controlValues.tempo, m32Decay: s.state.devices.mother32?.controlValues.decay, lessonCarried: (s.state.completedLessons || []).includes('sub37-f1-oscillators') };
  });
  let first = null;
  let afterReload = null;
  try {
    await p.goto(url, { waitUntil: 'networkidle' });
    await p.waitForTimeout(1500);
    first = await read();
    await p.reload({ waitUntil: 'networkidle' });
    await p.waitForTimeout(1200);
    afterReload = await read();
  } catch (e) {
    errs.push('test: ' + String(e).split('\n')[0]);
  }
  console.log(JSON.stringify({ first, afterReload, errs: errs.slice(0, 5) }));
  await b.close();
})();
