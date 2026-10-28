// ============================================================================
// External gear end-to-end check (Playwright, Chromium) - docs/EXTERNAL_GEAR.md
//   npm run build && npx next start -p 3107
//   node lib/midi/__tests__/external-gear.e2e.cjs http://localhost:3107 /tmp/out [pluginBase] [plugins.json]
//
//  - Web MIDI is mocked: every output.send(data, timestamp) is recorded with
//    performance.now(), ctx.currentTime and ctx.outputLatency at that moment,
//    so clock and sequencer timestamps can be checked against the transport.
//  - Audio input uses Chrome's fake capture device.
//  - [pluginBase] [plugins.json]: a static copy of the wam-community npm package
//    (http-server <pkg>/dist/plugins --cors) for the WAM checks; without them
//    only the unreachable-URL and trust checks run.
// Screenshots (desktop 1440x900, iPad 1180x820) go to <outDir>.
// Exits non-zero when a check fails. Always closes the browser.
// ============================================================================
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const [, , BASE = 'http://localhost:3107', OUT = './e2e-out', WAM_BASE = '', WAM_INDEX = ''] = process.argv;
const WAM_DIR = WAM_BASE;
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const consoleErrors = [];
const expectedNetworkFailures = [];
const requests = [];
let phase = 'main';
let failed = 0;

async function check(name, fn) {
  const t0 = Date.now();
  try {
    const info = await fn();
    results.push({ name, ok: true, ms: Date.now() - t0, ...(info ? { info } : {}) });
    console.log(`  ok   ${name}${info ? ` ${JSON.stringify(info)}` : ''}`);
  } catch (e) {
    failed++;
    results.push({ name, ok: false, error: String(e && e.stack || e) });
    console.log(`  FAIL ${name}\n       ${String(e && e.message || e)}`);
  }
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

// ---------------------------------------------------------------------------
// Page set-up: studio rack + Web MIDI mock
// ---------------------------------------------------------------------------

function seed(rack, current) {
  return ({ rack, current }) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('synth-studio-welcomed', '1');
    localStorage.setItem('synth-studio-storage', JSON.stringify({
      state: {
        currentDevice: current,
        devices: {},
        studio: { rack: rack.map(id => ({ id, device: id })), cables: [], routes: {}, sync: {}, bpm: 120, swing: 0, arrangement: { enabled: false, loop: true, sections: [] } },
        completedLessons: [], review: {}, focusMode: true,
      },
      version: 4,
    }));
  };
}

function midiMock() {
  const sent = [];
  window.__midiSent = sent;
  const ctxOf = () => { const s = window.__synthStudio; return s && s.transport && s.transport.ctx; };
  const mkOut = (id, name) => ({
    id, name, manufacturer: 'Test', type: 'output', state: 'connected', connection: 'open', version: '1', onstatechange: null,
    open() { return Promise.resolve(this); }, close() { return Promise.resolve(this); }, clear() {},
    addEventListener() {}, removeEventListener() {},
    send(data, ts) {
      const c = ctxOf();
      sent.push({ port: name, data: Array.from(data), ts: ts === undefined ? null : ts, now: performance.now(), ct: c ? c.currentTime : null, outLat: c ? (c.outputLatency || 0) : null });
    },
  });
  const mkIn = (id, name) => {
    const p = {
      id, name, manufacturer: 'Test', type: 'input', state: 'connected', connection: 'closed', version: '1', onmidimessage: null, onstatechange: null,
      open() { return Promise.resolve(p); }, close() { p.connection = 'closed'; return Promise.resolve(p); },
      addEventListener() {}, removeEventListener() {},
    };
    return p;
  };
  const inputs = new Map([['in1', mkIn('in1', 'Test Keys')]]);
  const outputs = new Map([['out1', mkOut('out1', 'Test Synth')], ['out2', mkOut('out2', 'Clock Box')]]);
  const access = { inputs, outputs, sysexEnabled: false, onstatechange: null, addEventListener() {}, removeEventListener() {} };
  Object.defineProperty(navigator, 'requestMIDIAccess', { configurable: true, value: () => Promise.resolve(access) });
  window.__midiIn = (id, bytes) => { const p = inputs.get(id); if (p && p.onmidimessage) p.onmidimessage({ data: new Uint8Array(bytes), timeStamp: performance.now() }); return !!(p && p.onmidimessage); };
  window.__midiPlug = (id, name) => { const o = mkOut(id, name); outputs.set(id, o); if (access.onstatechange) access.onstatechange({ port: o }); };
  const q = navigator.permissions && navigator.permissions.query && navigator.permissions.query.bind(navigator.permissions);
  if (q) navigator.permissions.query = d => (d && d.name === 'midi' ? Promise.resolve({ state: 'prompt' }) : q(d));
}

function noMidi() {
  // iPad / Safari: there is no Web MIDI at all
  delete Navigator.prototype.requestMIDIAccess;
  try { delete navigator.requestMIDIAccess; } catch { /* */ }
}

async function openPage(browser, { viewport, touch, ua, midi, rack, current }) {
  const context = await browser.newContext({ viewport, hasTouch: !!touch, userAgent: ua, permissions: ['microphone'] });
  const page = await context.newPage();
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const text = m.text();
    const loc = m.location() && m.location().url || '';
    consoleErrors.push({ phase, viewport: `${viewport.width}x${viewport.height}`, text, url: loc });
  });
  page.on('pageerror', e => consoleErrors.push({ phase, viewport: `${viewport.width}x${viewport.height}`, text: `pageerror: ${e.message}`, url: '' }));
  page.on('requestfailed', r => expectedNetworkFailures.push(r.url()));
  page.on('request', r => requests.push(r.url()));
  await page.addInitScript(seed(rack, current), { rack, current });
  await page.addInitScript(midi ? midiMock : noMidi);
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  return { context, page };
}

const tab = (page, name) => page.locator('nav[aria-label="Instruments"]').getByRole('button', { name, exact: true });
const levelPeak = (page, ms) => page.evaluate(async ms => {
  let m = 0; const t0 = performance.now();
  while (performance.now() - t0 < ms) { m = Math.max(m, window.__synthLevel ? window.__synthLevel() : 0); await new Promise(r => setTimeout(r, 15)); }
  return +m.toFixed(4);
}, ms);
const store = (page, fn, arg) => page.evaluate(fn, arg);

async function unlockAudio(page) {
  const b = page.getByRole('button', { name: /tap for sound/i });
  if (await b.count()) await b.first().click();
  await page.waitForFunction(() => window.__synthStudio && window.__synthStudio.hub.status === 'on', null, { timeout: 15000 });
}

async function dragKnob(page, control, dy) {
  const box = await page.locator(`[data-control="${control}"]`).first().boundingBox();
  assert(box, `knob ${control} not found`);
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) await page.mouse.move(x, y - (dy * i) / 6);
  await page.mouse.up();
}

// ---------------------------------------------------------------------------

(async () => {
  const browser = await chromium.launch({
    args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  });
  try {
    const rack = ['midi-synth', 'audio-in', 'wam-plugin', 'sub37'];
    const { context, page } = await openPage(browser, { viewport: { width: 1440, height: 900 }, midi: true, rack, current: 'midi-synth' });

    await page.screenshot({ path: path.join(OUT, 'midi-synth-desktop-initial.png') });

    // ---- MIDI permission, ports, hot-plug ---------------------------------
    await check('MIDI: enable from the header button; ports listed', async () => {
      await page.getByRole('button', { name: /^MIDI settings/ }).click();
      const dlg = page.getByRole('dialog');
      await dlg.getByRole('button', { name: 'Enable MIDI' }).click();
      await dlg.getByText('Test Keys', { exact: true }).first().waitFor({ timeout: 5000 });
      await dlg.getByText('Clock Box').first().waitFor();
      await page.screenshot({ path: path.join(OUT, 'midi-settings-desktop.png') });
      await dlg.getByLabel('Clock Box').check();
      const targets = await store(page, () => JSON.parse(localStorage.getItem('synth-studio-midi')).state.clockOut.targets.map(t => t.name));
      assert(targets.includes('Clock Box'), 'clock target saved');
      await page.evaluate(() => window.__midiPlug('out3', 'Hot Plugged Synth'));
      await dlg.getByText('Hot Plugged Synth', { exact: true }).first().waitFor({ timeout: 3000 });
      await dlg.getByRole('button', { name: 'Close' }).last().click();
      return { targets };
    });

    // ---- Your synth: setup with a midi.guide template ----------------------
    await check('Your synth: Setup - output, channel 2, midi.guide template', async () => {
      await page.getByRole('button', { name: 'Setup…' }).click();
      const dlg = page.getByRole('dialog');
      await dlg.locator('select[aria-label="MIDI output port"]').selectOption({ label: 'Test Synth' });
      await dlg.locator('select[aria-label="MIDI channel"]').selectOption('1');
      await dlg.locator('input[aria-label="Search templates"]').fill('subsequent 37');
      await dlg.getByRole('button', { name: /Subsequent 37/ }).first().click();
      await dlg.getByRole('button', { name: /^Use \d+ knobs?$/ }).waitFor({ timeout: 5000 });
      await page.screenshot({ path: path.join(OUT, 'midi-synth-setup-desktop.png') });
      await dlg.getByRole('button', { name: /^Use \d+ knobs?$/ }).click();
      await dlg.getByRole('button', { name: 'Save' }).click();
      const data = await store(page, () => window.__synthStudio.store.getState().devices['midi-synth'].data);
      assert(data.port && data.port.name === 'Test Synth', 'port saved');
      assert(data.channel === 1, 'channel 2 saved');
      assert(data.template && /Subsequent 37/.test(data.template.device), 'template applied');
      assert(data.knobs.length >= 8, `knobs from template (${data.knobs.length})`);
      await page.getByText(data.knobs[0].label, { exact: true }).first().waitFor();
      return { knobs: data.knobs.slice(0, 4).map(k => `${k.label}=CC${k.cc}${k.lsb !== undefined ? '/' + k.lsb : ''}`) };
    });

    await unlockAudio(page);
    await page.screenshot({ path: path.join(OUT, 'midi-synth-desktop.png') });

    // ---- Knob -> CC ----------------------------------------------------------
    await check('Your synth: moving a knob sends its CC (14-bit MSB+LSB) on channel 2; nothing on load', async () => {
      const before = await page.evaluate(() => window.__midiSent.filter(m => m.port === 'Test Synth' && (m.data[0] & 0xf0) === 0xb0).length);
      assert(before === 0, `no CC sent on load (got ${before})`);
      const k = await store(page, () => window.__synthStudio.store.getState().devices['midi-synth'].data.knobs[0]);
      await dragKnob(page, 'k1', 60);
      await page.waitForTimeout(100);
      const ccs = await page.evaluate(() => window.__midiSent.filter(m => m.port === 'Test Synth' && (m.data[0] & 0xf0) === 0xb0));
      assert(ccs.length > 0, 'CC sent');
      assert(ccs.every(m => m.data[0] === 0xb1), 'channel 2');
      assert(ccs.some(m => m.data[1] === k.cc), `CC ${k.cc} sent`);
      if (k.lsb !== undefined) assert(ccs.some(m => m.data[1] === k.lsb), `LSB CC ${k.lsb} sent`);
      return { messages: ccs.length, last: ccs.slice(-2).map(m => m.data) };
    });

    // ---- Sequencer + clock timing ------------------------------------------
    await check('Sequencer + clock out: exact timestamps from the studio transport', async () => {
      await page.evaluate(() => { window.__midiSent.length = 0; });
      await page.getByRole('button', { name: 'Play studio' }).click();
      await page.waitForTimeout(2300);
      const started = await page.evaluate(() => ({ at: window.__synthStudio.transport.startedAt, bpm: window.__synthStudio.transport.bpm }));
      await page.getByRole('button', { name: 'Stop studio' }).click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(OUT, 'midi-synth-after-play.png') });
      const sent = await page.evaluate(() => window.__midiSent.slice());
      const tickMs = 60000 / started.bpm / 24;
      const clock = sent.filter(m => m.port === 'Clock Box');
      const clocks = clock.filter(m => m.data[0] === 0xf8);
      assert(clock[0] && clock[0].data[0] === 0xfa, 'Start first');
      assert(clock[0].ts < clocks[0].ts, 'Start before the first clock');
      assert(clock[clock.length - 1].data[0] === 0xfc, 'Stop last');
      assert(clock[clock.length - 1].ts > clocks[clocks.length - 1].ts, 'Stop after the last queued clock');
      assert(clocks.length >= 100, `clocks: ${clocks.length}`);
      // 24 PPQN: even spacing (performance.now() is coarsened to 0.1 ms in Chrome)
      const gaps = clocks.slice(1).map((m, i) => m.ts - clocks[i].ts - tickMs);
      const maxGapErr = Math.max(...gaps.map(Math.abs));
      assert(maxGapErr < 0.3, `clock spacing error ${maxGapErr.toFixed(3)} ms`);
      // Formula: performance.now() + (tickTime - currentTime) * 1000 + outputLatency (offset smoothed)
      const tickTime = k => started.at + k * tickMs / 1000;
      const raw = clocks.map((m, k) => m.ts - (m.now + (tickTime(k) - m.ct) * 1000 + m.outLat * 1000));
      const rawMax = Math.max(...raw.map(Math.abs));
      // currentTime moves in callback steps, so the raw formula is late by up to one callback; ours removes that
      assert(rawMax < 25, `timestamps follow the formula within one audio callback (${rawMax.toFixed(2)} ms)`);
      assert(clocks.every(m => m.ts > m.now), 'every clock scheduled ahead');

      const notes = sent.filter(m => m.port === 'Test Synth');
      const ons = notes.filter(m => m.data[0] === 0x91);
      const offs = notes.filter(m => m.data[0] === 0x81);
      assert(ons.length >= 10, `note-ons: ${ons.length}`);
      assert(ons.length === offs.length, 'every note-on has its note-off');
      assert(ons.every(m => m.ts > m.now), 'notes scheduled ahead (timestamps in the future)');
      // Each note lands exactly on a 16th: the clock tick for the same moment has the same timestamp
      const steps = ons.map(m => {
        const k = clocks.findIndex(c => Math.abs(c.ts - m.ts) < 0.25);
        return k;
      });
      assert(steps.every(k => k >= 0 && k % 6 === 0), `notes on 16th-note clock ticks: ${steps.slice(0, 12)}`);
      const stepIdx = steps.map(k => (k / 6) % 16);
      const pattern = await store(page, () => window.__synthStudio.store.getState().devices['midi-synth'].data.steps.map(s => s.on));
      assert(stepIdx.every(i => pattern[i]), 'only switched-on steps play');
      const gate = (await store(page, () => window.__synthStudio.hub.valuesFor('midi-synth').gate)) / 100;
      const lens = ons.map((m, i) => offs[i].ts - m.ts);
      assert(lens.every(l => Math.abs(l - gate * 6 * tickMs) < 0.3), `gate lengths ${lens.slice(0, 3).map(l => l.toFixed(2))}`);
      return {
        clocks: clocks.length, clockSpacingErrMs: +maxGapErr.toFixed(3), formulaErrMs: +rawMax.toFixed(2),
        noteOns: ons.length, firstSteps: stepIdx.slice(0, 10), aheadMs: +(ons[0].ts - ons[0].now).toFixed(1), outputLatencyMs: +(ons[0].outLat * 1000).toFixed(1),
      };
    });

    await check('Your synth: step entry - tap a note name, play a key, the step takes it and the selection moves on', async () => {
      await page.getByRole('button', { name: 'Edit step 2' }).click();
      await page.mouse.move(5, 5);
      await page.keyboard.down('s'); // A-K row: s = lowNote + 2 = D3 (50)
      await page.waitForTimeout(150);
      await page.keyboard.up('s');
      await page.waitForTimeout(150);
      const st = await store(page, () => ({ step: window.__synthStudio.store.getState().devices['midi-synth'].data.steps[1] }));
      const sel = await page.getByRole('button', { name: 'Edit step 3' }).getAttribute('aria-pressed');
      await page.getByRole('button', { name: 'Done editing' }).click();
      assert(st.step.on && st.step.note === 50, `step 2 = ${JSON.stringify(st.step)}`);
      assert(sel === 'true', 'selection moved to step 3');
      return st.step;
    });

    // ---- MIDI input -----------------------------------------------------------
    await check('MIDI input: notes + bend reach the focused instrument (re-channelled MIDI thru)', async () => {
      await page.evaluate(() => { window.__midiSent.length = 0; });
      const attached = await page.evaluate(() => window.__midiIn('in1', [0x90, 64, 100]));
      assert(attached, 'input listener attached');
      await page.waitForTimeout(80);
      await page.evaluate(() => window.__midiIn('in1', [0xe0, 0, 80]));
      await page.evaluate(() => window.__midiIn('in1', [0x80, 64, 0]));
      await page.waitForTimeout(80);
      const got = await page.evaluate(() => window.__midiSent.filter(m => m.port === 'Test Synth').map(m => m.data));
      const has = d => got.some(g => g.join() === d.join());
      assert(has([0x91, 64, 100]), `note-on thru: ${JSON.stringify(got)}`);
      assert(has([0xe1, 0, 80]), 'pitch bend thru');
      assert(has([0x81, 64, 0]), 'note-off thru');
      return { got };
    });

    await check('MIDI input: plays a twin (Sub 37) with sound; bend drives its wheel', async () => {
      await tab(page, 'Sub 37').click();
      await page.waitForTimeout(700);
      await page.evaluate(() => window.__midiIn('in1', [0x90, 48, 120]));
      const peak = await levelPeak(page, 600);
      await page.evaluate(() => window.__midiIn('in1', [0x80, 48, 0]));
      await page.evaluate(() => window.__midiIn('in1', [0xe0, 0x7f, 0x7f]));
      await page.waitForTimeout(150);
      const bend = await store(page, () => window.__synthStudio.store.getState().devices.sub37?.controlValues.pitch_bend);
      await page.evaluate(() => window.__midiIn('in1', [0xe0, 0, 64]));
      assert(peak > 0.01, `Sub 37 sounds from MIDI (peak ${peak})`);
      return { peak, bend };
    });

    // ---- MIDI learn ------------------------------------------------------------
    await check('MIDI learn: arm, touch GATE, move CC 21 -> mapped and scaled via normToValue', async () => {
      await tab(page, 'Your synth (MIDI)').click();
      await page.waitForTimeout(500);
      await page.getByRole('button', { name: /^MIDI settings/ }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Start MIDI learn' }).click();
      await page.getByText(/touch a control on screen/).waitFor();
      await dragKnob(page, 'gate', 10);
      await page.getByText(/Now move a knob/).waitFor({ timeout: 3000 });
      await page.screenshot({ path: path.join(OUT, 'midi-learn-desktop.png') });
      await page.evaluate(() => window.__midiIn('in1', [0xb0, 21, 0]));
      await page.getByText(/Mapped CC 21/).waitFor({ timeout: 3000 });
      await page.waitForTimeout(80);
      const lo = await store(page, () => window.__synthStudio.hub.valuesFor('midi-synth').gate);
      await page.evaluate(() => window.__midiIn('in1', [0xb0, 21, 127]));
      await page.waitForTimeout(80);
      const hi = await store(page, () => window.__synthStudio.hub.valuesFor('midi-synth').gate);
      await page.evaluate(() => window.__midiIn('in1', [0xb0, 21, 64]));
      await page.waitForTimeout(80);
      const mid = await store(page, () => window.__synthStudio.hub.valuesFor('midi-synth').gate);
      await page.getByRole('button', { name: 'Done' }).click();
      const saved = await store(page, () => JSON.parse(localStorage.getItem('synth-studio-midi')).state.mappings);
      assert(lo === 5 && hi === 100, `GATE follows CC 21 (0 -> ${lo}, 127 -> ${hi})`);
      assert(Math.abs(mid - (5 + 95 * 64 / 127)) < 0.6, `mid value ${mid}`);
      assert(saved.some(m => m.cc === 21 && m.control === 'gate' && m.instance === 'midi-synth'), 'mapping persisted');
      return { lo, mid, hi, mappings: saved.length };
    });

    await check('MIDI clock in: follow an external Start + 125 BPM clock, then Stop', async () => {
      await page.getByRole('button', { name: /^MIDI settings/ }).click();
      const dlg = page.getByRole('dialog');
      await dlg.getByLabel('Follow an external clock').check();
      await dlg.locator('select[aria-label="Clock source"]').selectOption('Test Keys');
      await dlg.getByRole('button', { name: 'Close' }).last().click();
      // An external box: clock before Start (most gear runs it continuously), then Start, 3 s at 125 BPM (20 ms per clock)
      const res = await page.evaluate(async () => {
        const send = b => window.__midiIn('in1', b);
        const t = window.__synthStudio.transport;
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        let next = performance.now();
        const clocks = async n => { for (let i = 0; i < n; i++) { send([0xf8]); next += 20; await sleep(Math.max(0, next - performance.now())); } };
        await clocks(48);
        send([0xfa]);
        await clocks(150);
        const during = { playing: t.playing, bpm: t.bpm };
        send([0xfc]);
        await sleep(100);
        return { during, after: { playing: t.playing } };
      });
      const shown = await store(page, () => window.__synthStudio.store.getState().studio.bpm);
      // back to the studio's own clock for the remaining checks
      await page.getByRole('button', { name: /^MIDI settings/ }).click();
      await page.getByRole('dialog').getByLabel('Follow an external clock').uncheck();
      await page.getByRole('dialog').getByRole('button', { name: 'Close' }).last().click();
      await store(page, () => window.__synthStudio.store.getState().setBpm(120));
      assert(res.during.playing, 'external Start started the studio');
      assert(Math.abs(res.during.bpm - 125) < 1.5, `tempo ${res.during.bpm.toFixed(2)}`);
      assert(!res.after.playing, 'external Stop stopped the studio');
      return { bpm: +res.during.bpm.toFixed(2), shown };
    });

    // ---- Audio input -------------------------------------------------------------
    await check('Audio input: getUserMedia (processing off) -> signal on the meter and the master', async () => {
      await tab(page, 'Audio input').click();
      await page.waitForTimeout(500);
      await page.getByRole('button', { name: 'Connect' }).click();
      await page.waitForFunction(() => window.__synthStudio.hub.getState('audio-in').status === 'live', null, { timeout: 10000 });
      const st = await store(page, () => window.__synthStudio.hub.getState('audio-in'));
      const constraints = await page.evaluate(() => {
        const e = window.__synthStudio.hub.getEngine('audio-in');
        const tr = e && e.stream && e.stream.getAudioTracks()[0];
        return tr ? tr.getConstraints() : null;
      });
      const level = await levelPeak(page, 1500);
      const meter = await page.evaluate(() => Math.max(...[...document.querySelectorAll('[data-meter]')].map(el => parseFloat(el.style.width) || 0)));
      await page.screenshot({ path: path.join(OUT, 'audio-in-desktop.png') });
      assert(constraints && constraints.echoCancellation === false && constraints.noiseSuppression === false && constraints.autoGainControl === false, `constraints ${JSON.stringify(constraints)}`);
      assert(level > 0.01, `master level ${level}`);
      assert(meter > 0, `meter ${meter}%`);
      // MUTE silences the output but the meter keeps reading
      await page.locator('[data-control="mute"]').click();
      await page.waitForTimeout(300);
      const muted = await levelPeak(page, 800);
      const meterMuted = await page.evaluate(() => Math.max(...[...document.querySelectorAll('[data-meter]')].map(el => parseFloat(el.style.width) || 0)));
      await page.locator('[data-control="mute"]').click();
      assert(muted < level / 4, `muted level ${muted}`);
      assert(meterMuted > 0, 'meter still reads while muted');
      return { device: st.deviceLabel, channels: st.channels, inputLatency: st.inputLatency, level, meter, muted };
    });

    // ---- WAM: unreachable URLs --------------------------------------------------------
    const PLUGINS = 'https://www.webaudiomodules.com/community/plugins/';
    const waitPlugin = url => page.waitForFunction(u => {
      const st = window.__synthStudio.hub.getState('wam-plugin');
      return st.url === u && ['ready', 'error', 'untrusted'].includes(st.status);
    }, url, { timeout: 30000 });
    const pluginState = () => store(page, () => window.__synthStudio.hub.getState('wam-plugin'));
    const loadUrl = async url => {
      await page.getByRole('button', { name: /Choose plugin…|Change…/ }).click();
      const dlg = page.getByRole('dialog');
      await dlg.locator('#wam-url').fill(url);
      const trust = dlg.getByRole('checkbox');
      if (await trust.count()) await trust.check();
      await dlg.getByRole('button', { name: 'Load plugin' }).click();
    };
    await check('WAM host: unreachable URLs fail cleanly with a clear message', async () => {
      await tab(page, 'Web Audio plugin').click();
      await page.waitForTimeout(500);
      const out = {};
      for (const [typed, url] of [['http://127.0.0.1:9/nope/index.js', 'http://127.0.0.1:9/nope/index.js'], ['https://plugins.invalid/synth/', 'https://plugins.invalid/synth/index.js']]) {
        await loadUrl(typed);
        await waitPlugin(url);
        const st = await pluginState();
        assert(st.status === 'error', `${url}: ${st.status}`);
        assert(/Could not reach/.test(st.error) && st.error.includes(new URL(url).host), `${url}: ${st.error}`);
        out[url] = st.error;
      }
      await page.screenshot({ path: path.join(OUT, 'wam-plugin-error-desktop.png') });
      // Not http(s): explained in the dialog, Load stays disabled
      await page.getByRole('button', { name: /Choose plugin…|Change…/ }).click();
      const dlg = page.getByRole('dialog');
      await dlg.locator('#wam-url').fill('ftp://example.com/x.js');
      await dlg.getByText(/Plugin URLs must start with https:\/\//).waitFor();
      out.invalidDisabled = await dlg.getByRole('button', { name: 'Load plugin' }).isDisabled();
      await dlg.getByRole('button', { name: 'Cancel' }).click();
      assert(out.invalidDisabled, 'Load disabled for ftp://');
      return out;
    });

    await check('WAM trust gate: a project naming an untrusted site does not fetch it', async () => {
      const evil = 'https://untrusted.example/plugin/index.js';
      await store(page, u => window.__synthStudio.store.getState().setDeviceData('wam-plugin', { v: 1, url: u, name: null }), evil);
      await waitPlugin(evil);
      const st = await pluginState();
      await page.getByText(/Plugins run their own code inside this page/).waitFor();
      await page.getByRole('button', { name: 'Trust & load' }).waitFor();
      await page.screenshot({ path: path.join(OUT, 'wam-untrusted-desktop.png') });
      assert(st.status === 'untrusted', st.status);
      assert(!requests.some(r => r.includes('untrusted.example')), 'nothing fetched from the untrusted site');
      return { status: st.status, origin: st.origin };
    });

    // ---- WAM: a real WAM 2 plugin (npm copy) ------------------------------------------
    if (WAM_DIR) {
      await check('WAM host: Synth-101 loads, its window opens in the overlay, keys play it', async () => {
        await page.getByRole('button', { name: /Choose plugin…|Change…/ }).click();
        const dlg = page.getByRole('dialog');
        await dlg.getByRole('button', { name: /Synth-101/ }).click();
        const picked = await dlg.locator('#wam-url').inputValue();
        assert(picked === `${PLUGINS}burns-audio/synth101/index.js`, `curated entry fills its URL (${picked})`);
        await dlg.getByRole('checkbox').check();
        await page.screenshot({ path: path.join(OUT, 'wam-chooser-desktop.png') });
        // The public host is unreachable from here: load the identical files from the npm package
        const local = `${WAM_BASE}burns-audio/synth101/index.js`;
        await dlg.locator('#wam-url').fill(local);
        await dlg.getByRole('checkbox').check();
        await dlg.getByRole('button', { name: 'Load plugin' }).click();
        await waitPlugin(local);
        const st = await pluginState();
        assert(st.status === 'ready', `status ${st.status}: ${st.error}`);
        await page.mouse.click(5, 5);
        await page.keyboard.down('a');
        const peak = await levelPeak(page, 700);
        await page.keyboard.up('a');
        // MIDI input reaches the plugin too
        await page.waitForTimeout(400);
        await page.evaluate(() => window.__midiIn('in1', [0x90, 55, 110]));
        const midiPeak = await levelPeak(page, 600);
        await page.evaluate(() => window.__midiIn('in1', [0x80, 55, 0]));
        await page.getByRole('button', { name: 'Open plugin window' }).click();
        const win = page.getByRole('dialog', { name: /plugin window/ });
        await win.waitFor();
        await page.waitForTimeout(1500);
        const guiChildren = await win.evaluate(el => el.querySelectorAll('*').length);
        await page.screenshot({ path: path.join(OUT, 'wam-synth101-window-desktop.png') });
        await win.getByRole('button', { name: 'Close plugin window' }).click();
        await page.waitForTimeout(300);
        await page.screenshot({ path: path.join(OUT, 'wam-plugin-desktop.png') });
        assert(peak > 0.01, `plugin sounds from the keys (peak ${peak})`);
        assert(midiPeak > 0.01, `plugin sounds from MIDI input (peak ${midiPeak})`);
        assert(guiChildren > 3, `plugin GUI rendered (${guiChildren} elements)`);
        return { plugin: st.plugin, peak, midiPeak, guiChildren };
      });

      await check('WAM host: an effect (Simple Delay) processes audio cabled into IN; BYPASS passes it dry', async () => {
        await loadUrl(`${WAM_BASE}burns-audio/delay/index.js`);
        await waitPlugin(`${WAM_BASE}burns-audio/delay/index.js`);
        const st = await pluginState();
        assert(st.status === 'ready', `status ${st.status}: ${st.error}`);
        await store(page, () => window.__synthStudio.store.getState().addStudioCable({ from: { instance: 'audio-in', jack: 'out_l' }, to: { instance: 'wam-plugin', jack: 'in' } }));
        await page.waitForTimeout(300);
        const peakOf = ms => page.evaluate(async ms => {
          const e = window.__synthStudio.hub.getEngine('wam-plugin');
          const ctx = window.__synthStudio.transport.ctx;
          const a = ctx.createAnalyser();
          a.fftSize = 2048;
          e.level.connect(a);
          const buf = new Float32Array(a.fftSize);
          let m = 0; const t0 = performance.now();
          while (performance.now() - t0 < ms) {
            a.getFloatTimeDomainData(buf);
            for (let i = 0; i < buf.length; i++) m = Math.max(m, Math.abs(buf[i]));
            await new Promise(r => setTimeout(r, 20));
          }
          e.level.disconnect(a);
          return +m.toFixed(4);
        }, ms);
        const wet = await peakOf(1500);
        await page.locator('[data-control="bypass"]').click();
        await page.waitForTimeout(200);
        const dry = await peakOf(800);
        await page.locator('[data-control="bypass"]').click();
        await store(page, () => window.__synthStudio.store.getState().clearStudioCables());
        assert(wet > 0.01, `plugin output with audio on IN (peak ${wet})`);
        assert(dry > 0.01, `bypass passes IN (peak ${dry})`);
        return { plugin: st.plugin && st.plugin.name, wet, dry };
      });
    }

    if (WAM_DIR) {
      await check('WAM host: every curated plugin loads from its npm copy and makes sound', async () => {
        const src = fs.readFileSync(path.resolve(__dirname, '../../wam/plugins.ts'), 'utf8');
        const list = [...src.matchAll(/p\('([^']+)', '[^']+', '(instrument|effect)', '([^']+)'/g)].map(m => ({ name: m[1], kind: m[2], path: m[3] }));
        assert(list.length >= 6, `parsed ${list.length} curated plugins`);
        const outPeak = ms => page.evaluate(async ms => {
          const e = window.__synthStudio.hub.getEngine('wam-plugin');
          const a = window.__synthStudio.transport.ctx.createAnalyser();
          a.fftSize = 2048;
          e.level.connect(a);
          const buf = new Float32Array(a.fftSize);
          let m = 0; const t0 = performance.now();
          while (performance.now() - t0 < ms) {
            a.getFloatTimeDomainData(buf);
            for (let i = 0; i < buf.length; i++) m = Math.max(m, Math.abs(buf[i]));
            await new Promise(r => setTimeout(r, 20));
          }
          e.level.disconnect(a);
          return +m.toFixed(4);
        }, ms);
        const out = {};
        for (const pl of list) {
          const url = `${WAM_BASE}${pl.path}`;
          await loadUrl(url);
          await waitPlugin(url);
          const st = await pluginState();
          if (st.status !== 'ready') { out[pl.name] = `${st.status}: ${st.error}`; continue; }
          let peak;
          if (pl.kind === 'instrument') {
            await page.evaluate(() => window.__synthStudio.hub.noteOn('wam-plugin', 57, 0.9));
            peak = await outPeak(900);
            await page.evaluate(() => window.__synthStudio.hub.noteOff('wam-plugin', 57));
          } else {
            await store(page, () => window.__synthStudio.store.getState().addStudioCable({ from: { instance: 'audio-in', jack: 'out_l' }, to: { instance: 'wam-plugin', jack: 'in' } }));
            await page.waitForTimeout(250);
            peak = await outPeak(900);
            await store(page, () => window.__synthStudio.store.getState().clearStudioCables());
          }
          out[pl.name] = peak > 0.005 ? `ok (${pl.kind}, peak ${peak})` : `silent (${pl.kind}, peak ${peak})`;
        }
        fs.writeFileSync(path.join(OUT, 'wam-curated.json'), JSON.stringify(out, null, 2));
        const bad = Object.entries(out).filter(([, v]) => !v.startsWith('ok'));
        assert(!bad.length, JSON.stringify(out));
        return out;
      });

      await check('WAM host: sweep of the wam-community collection (npm copy, no host extensions needed)', async () => {
        const list = JSON.parse(fs.readFileSync(WAM_INDEX, 'utf8'));
        const root = path.dirname(WAM_INDEX);
        const candidates = list.filter(p => !(p.category || []).includes('Video') && !/WAMExtensions/.test(fs.readFileSync(path.join(root, 'plugins', p.path), 'utf8')));
        const out = {};
        phase = 'sweep';
        for (const p of candidates) {
          const url = `${WAM_BASE}${p.path}`;
          await loadUrl(url);
          await waitPlugin(url);
          const st = await pluginState();
          out[p.path] = st.status === 'ready' ? `ready (${st.plugin.isInstrument ? 'instrument' : 'effect'})` : `${st.status}: ${(st.error || '').slice(0, 120)}`;
        }
        phase = 'main';
        fs.writeFileSync(path.join(OUT, 'wam-sweep.json'), JSON.stringify(out, null, 2));
        const ready = Object.values(out).filter(v => v.startsWith('ready')).length;
        assert(ready >= 4, JSON.stringify(out));
        return { tried: candidates.length, ready };
      });
    }

    // ---- Studio view ------------------------------------------------------------------
    await check('Studio view renders the external devices with routable outputs', async () => {
      await page.locator('nav[aria-label="Instruments"]').getByRole('button', { name: /Studio/ }).click();
      await page.waitForTimeout(1200);
      await page.screenshot({ path: path.join(OUT, 'studio-desktop.png'), fullPage: true });
      const outputs = await page.locator('select').evaluateAll(els => els.filter(e => [...e.options].some(o => o.value === 'master')).length);
      assert(outputs >= 4, `Output selects: ${outputs}`);
      return { outputs };
    });

    const overflowDesktop = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    await context.close();

    // ---- iPad: no Web MIDI, audio input still works --------------------------------------
    const ipadUa = 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
    const ipad = await openPage(browser, { viewport: { width: 1180, height: 820 }, touch: true, ua: ipadUa, midi: false, rack, current: 'midi-synth' });
    await check('iPad 1180x820: friendly no-MIDI message; devices fit; audio input connects', async () => {
      const p = ipad.page;
      await p.getByText(/No Web MIDI on iPad/).first().waitFor({ timeout: 5000 });
      await p.screenshot({ path: path.join(OUT, 'midi-synth-ipad.png') });
      await p.getByRole('button', { name: /^MIDI settings/ }).click();
      await p.getByRole('dialog').getByText(/iPad and iPhone browsers have no Web MIDI/).waitFor();
      await p.screenshot({ path: path.join(OUT, 'midi-settings-ipad.png') });
      await p.getByRole('dialog').getByRole('button', { name: 'Close' }).last().click();
      await p.getByRole('button', { name: 'Setup…' }).click();
      await p.getByRole('dialog').getByText(/iPad and iPhone browsers have no Web MIDI/).waitFor();
      await p.screenshot({ path: path.join(OUT, 'midi-synth-setup-ipad.png') });
      await p.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
      await tab(p, 'Audio input').tap();
      await p.waitForTimeout(400);
      await p.getByRole('button', { name: 'Connect' }).tap();
      await p.waitForFunction(() => window.__synthStudio.hub.getState('audio-in').status === 'live', null, { timeout: 10000 });
      await p.waitForTimeout(600);
      await p.screenshot({ path: path.join(OUT, 'audio-in-ipad.png') });
      await tab(p, 'Web Audio plugin').tap();
      await p.waitForTimeout(500);
      await p.screenshot({ path: path.join(OUT, 'wam-plugin-ipad.png') });
      await p.locator('nav[aria-label="Instruments"]').getByRole('button', { name: /Studio/ }).tap();
      await p.waitForTimeout(1200);
      await p.screenshot({ path: path.join(OUT, 'studio-ipad.png'), fullPage: true });
      const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      assert(!overflow, 'no horizontal page overflow on iPad');
      return { overflow };
    });
    await ipad.context.close();

    await check('no horizontal overflow on desktop', async () => { assert(!overflowDesktop, 'desktop overflow'); });
  } finally {
    await browser.close();
  }

  // Console errors: the only acceptable ones are the browser's own logs for the URLs we made fail on purpose
  const deliberate = /127\.0\.0\.1:9\/|plugins\.invalid/;
  const sweepErrors = consoleErrors.filter(e => e.phase === 'sweep');
  const unexpected = consoleErrors.filter(e => e.phase !== 'sweep' && !(deliberate.test(e.text) || deliberate.test(e.url)));
  console.log(`\nconsole errors: ${consoleErrors.length} (${consoleErrors.length - unexpected.length - sweepErrors.length} from the deliberately unreachable plugin URLs, ${sweepErrors.length} from broken plugins during the collection sweep)`);
  unexpected.forEach(e => console.log(`  UNEXPECTED [${e.viewport}] ${e.text} ${e.url}`));
  if (unexpected.length) failed++;
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ results, consoleErrors, unexpected }, null, 2));
  console.log(`\n${results.filter(r => r.ok).length} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
