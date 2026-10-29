// ============================================================================
// External gear end-to-end check (Playwright, Chromium) - docs/EXTERNAL_GEAR.md
//   npm run build && npx next start -p 3130
//   node lib/midi/__tests__/external-gear.e2e.cjs http://localhost:3130 /tmp/out [pluginBase] [plugins.json]
//
//  - Web MIDI is mocked: every output.send(data, timestamp) is recorded with
//    performance.now(), ctx.currentTime and ctx.outputLatency at that moment,
//    so clock and sequencer timestamps can be checked against the transport.
//  - getUserMedia is mocked with an oscillator stream (220 Hz sine peaking at
//    -12 dBFS, from a second AudioContext), so levels are known exactly; the
//    constraints the app asked for are recorded.
//  - Rack: two "Your synth" instances, Audio input, Web Audio plugin, Sub 37.
//  - iPad (no Web MIDI) and macOS Safari (no Web MIDI) get their own pages.
//  - [pluginBase] [plugins.json]: a static copy of the wam-community npm package
//    (http-server <pkg>/dist/plugins --cors) for the web-plugin checks; without
//    them the built-in plugins, the unreachable-URL and the trust checks run.
// Screenshots (desktop 1440x900, iPad 1180x820) go to <outDir>.
// Exits non-zero when a check fails. Always closes the browser.
// ============================================================================
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const [, , BASE = 'http://localhost:3130', OUT = './e2e-out', WAM_BASE = '', WAM_INDEX = ''] = process.argv;
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
// Page set-up: studio rack, Web MIDI mock, getUserMedia mock
// ---------------------------------------------------------------------------

function seed({ rack, current }) {
  if (sessionStorage.getItem('seeded')) return;
  sessionStorage.setItem('seeded', '1');
  localStorage.setItem('synth-studio-welcomed', '1');
  localStorage.setItem('synth-studio-storage', JSON.stringify({
    state: {
      currentDevice: current,
      devices: {},
      studio: { rack: rack.map(id => ({ id, device: id.split('#')[0] })), cables: [], routes: {}, sync: {}, bpm: 120, swing: 0, arrangement: { enabled: false, loop: true, sections: [] } },
      completedLessons: [], review: {}, focusMode: true,
    },
    version: 5,
  }));
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

/** WebKit's navigator.audioSession (iOS 16.4+), recording every type it is set to */
function audioSessionMock() {
  const types = [];
  window.__sessionTypes = types;
  let type = 'auto';
  Object.defineProperty(navigator, 'audioSession', {
    configurable: true,
    value: { get type() { return type; }, set type(v) { type = v; types.push(v); } },
  });
}

/** getUserMedia -> a 220 Hz sine at -12 dBFS from its own AudioContext (an "interface") */
function gumMock() {
  const md = navigator.mediaDevices;
  if (!md) return;
  window.__gum = [];
  md.getUserMedia = async constraints => {
    window.__gum.push(JSON.parse(JSON.stringify(constraints)));
    const ac = new AudioContext();
    await ac.resume().catch(() => undefined);
    const osc = ac.createOscillator();
    osc.frequency.value = 220;
    const g = ac.createGain();
    g.gain.value = 0.25; // -12.04 dBFS peak
    const dest = ac.createMediaStreamDestination();
    osc.connect(g).connect(dest);
    osc.start();
    return dest.stream;
  };
  md.enumerateDevices = async () => [
    { deviceId: 'default', kind: 'audioinput', label: 'Default', groupId: 'g' },
    { deviceId: 'mock-interface', kind: 'audioinput', label: 'Mock Interface 2i2', groupId: 'g' },
  ];
}

async function openPage(browser, { viewport, touch, ua, midi, rack, current, session }) {
  const context = await browser.newContext({ viewport, hasTouch: !!touch, userAgent: ua, permissions: ['microphone'], acceptDownloads: true });
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
  await page.addInitScript(seed, { rack, current });
  await page.addInitScript(midi ? midiMock : noMidi);
  await page.addInitScript(gumMock);
  if (session) await page.addInitScript(audioSessionMock);
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  return { context, page };
}

const store = (page, fn, arg) => page.evaluate(fn, arg);
/** Tabs are named after the gear (rack labels), so find them by instance id */
async function tab(page, instance) {
  const label = await page.evaluate(id => {
    const s = window.__synthStudio.store.getState();
    const r = s.studio.rack.find(x => x.id === id);
    const names = { 'midi-synth': 'Your synth (MIDI)', 'audio-in': 'Audio input', 'wam-plugin': 'Web Audio plugin', sub37: 'Sub 37', xone96: 'Xone:96' };
    const base = names[r.device] || r.device;
    return r.label || (id.includes('#') ? `${base} ${id.split('#')[1]}` : base);
  }, instance);
  return page.locator('nav[aria-label="Instruments"]').getByRole('button', { name: label, exact: true });
}
const levelPeak = (page, ms) => page.evaluate(async ms => {
  let m = 0; const t0 = performance.now();
  while (performance.now() - t0 < ms) { m = Math.max(m, window.__synthLevel ? window.__synthLevel() : 0); await new Promise(r => setTimeout(r, 15)); }
  return +m.toFixed(4);
}, ms);
const sentTo = (page, port) => page.evaluate(p => window.__midiSent.filter(m => m.port === p), port);
const clearSent = page => page.evaluate(() => { window.__midiSent.length = 0; });
const dataOf = (page, id) => store(page, i => window.__synthStudio.store.getState().devices[i].data, id);
const hostOf = (page, id) => page.locator(`[data-instance="${id}"]`).first();

async function unlockAudio(page) {
  const b = page.getByRole('button', { name: /tap for sound/i });
  if (await b.count()) await b.first().click();
  await page.waitForFunction(() => window.__synthStudio && window.__synthStudio.hub.status === 'on', null, { timeout: 15000 });
}

async function dragKnob(page, control, dy, scope = page) {
  const box = await scope.locator(`[data-control="${control}"]`).first().boundingBox();
  assert(box, `knob ${control} not found`);
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) await page.mouse.move(x, y - (dy * i) / 6);
  await page.mouse.up();
}

/** Note-ons of a pattern played by the studio: which step each one fell on */
function stepsOf(ons, clocks) {
  return ons.map(m => {
    const k = clocks.findIndex(c => Math.abs(c.ts - m.ts) < 0.3);
    return k >= 0 ? (k / 6) % 16 : -1;
  });
}

// ---------------------------------------------------------------------------

(async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    const rack = ['midi-synth', 'midi-synth#2', 'audio-in', 'wam-plugin', 'sub37'];
    const { context, page } = await openPage(browser, { viewport: { width: 1440, height: 900 }, midi: true, rack, current: 'midi-synth' });

    await page.screenshot({ path: path.join(OUT, 'midi-synth-desktop-initial.png') });

    // ---- Practice synth: sound with no gear and no MIDI permission ------------
    await check('Practice synth: a new Your synth plays the built-in synth (no gear, no permission)', async () => {
      await unlockAudio(page);
      const status = await page.getByTestId('midi-synth-status').first().innerText();
      assert(/Practice synth · ch 1 · Bass part/.test(status), `status: ${status}`);
      await page.mouse.click(5, 5);
      await page.keyboard.down('a');
      const peak = await levelPeak(page, 500);
      await page.keyboard.up('a');
      await page.waitForTimeout(150);
      const monitor = await page.getByRole('log', { name: /MIDI monitor/ }).first().innerText();
      const second = await dataOf(page, 'midi-synth#2');
      assert(peak > 0.01, `practice synth sounds (peak ${peak})`);
      assert(/Note on/.test(monitor) && /90 30 7F/.test(monitor), `monitor shows the note: ${monitor}`);
      assert(second.channel === 1, `a second new Your synth starts on the next free channel (${second.channel + 1})`);
      return { status, peak, monitor: monitor.split('\n').slice(0, 2), secondChannel: second.channel + 1 };
    });

    // ---- MIDI permission, ports, hot-plug ---------------------------------
    await check('MIDI: enable from the header button; ports listed with the built-in Practice synth', async () => {
      await page.getByRole('button', { name: /^MIDI settings/ }).click();
      const dlg = page.getByRole('dialog');
      await dlg.getByRole('button', { name: 'Enable MIDI' }).click();
      await dlg.getByText('Test Keys', { exact: true }).first().waitFor({ timeout: 5000 });
      await dlg.getByText('Clock Box').first().waitFor();
      await dlg.getByText('Practice synth (built in)').first().waitFor();
      await page.screenshot({ path: path.join(OUT, 'midi-settings-desktop.png') });
      await dlg.getByLabel('Send clock to Clock Box').check();
      const targets = await store(page, () => JSON.parse(localStorage.getItem('synth-studio-midi')).state.clockOut.targets.map(t => t.name));
      assert(targets.includes('Clock Box'), 'clock target saved');
      await page.evaluate(() => window.__midiPlug('out3', 'Hot Plugged Synth'));
      await dlg.getByText('Hot Plugged Synth', { exact: true }).first().waitFor({ timeout: 3000 });
      await dlg.getByRole('button', { name: 'Close' }).last().click();
      return { targets };
    });

    // ---- Your synth: setup with a midi.guide template ----------------------
    await check('Your synth: Setup - output, channel 2, name, midi.guide template; the rack tab takes the name', async () => {
      await hostOf(page, 'midi-synth').getByRole('button', { name: 'Setup…' }).click();
      const dlg = page.getByRole('dialog');
      await dlg.locator('select[aria-label="MIDI output port"]').selectOption({ label: 'Test Synth' });
      await dlg.locator('select[aria-label="MIDI channel"]').selectOption('1');
      await dlg.getByRole('textbox').first().fill('Bass');
      await dlg.locator('input[aria-label="Search templates"]').fill('subsequent 37');
      await dlg.getByRole('button', { name: /Subsequent 37/ }).first().click();
      await dlg.getByRole('button', { name: /^Use \d+ knobs?$/ }).waitFor({ timeout: 5000 });
      await page.screenshot({ path: path.join(OUT, 'midi-synth-setup-desktop.png') });
      await dlg.getByRole('button', { name: /^Use \d+ knobs?$/ }).click();
      await dlg.getByRole('textbox').first().fill('Bass');
      await dlg.getByRole('button', { name: 'Save' }).click();
      const data = await dataOf(page, 'midi-synth');
      assert(data.port && data.port.name === 'Test Synth', 'port saved');
      assert(data.channel === 1, 'channel 2 saved');
      assert(data.name === 'Bass', `name ${data.name}`);
      assert(data.template && /Subsequent 37/.test(data.template.device), 'template applied');
      assert(data.knobs.length >= 8, `knobs from template (${data.knobs.length})`);
      await page.getByText(data.knobs[0].label, { exact: true }).first().waitFor();
      await page.locator('nav[aria-label="Instruments"]').getByRole('button', { name: 'Bass', exact: true }).waitFor({ timeout: 3000 });
      return { knobs: data.knobs.slice(0, 4).map(k => `${k.label}=CC${k.cc}${k.lsb !== undefined ? '/' + k.lsb : ''}`) };
    });

    await check('Templates: browse by manufacturer (132 makers), grouped search results', async () => {
      await hostOf(page, 'midi-synth').getByRole('button', { name: 'Setup…' }).click();
      const dlg = page.getByRole('dialog');
      await dlg.getByRole('button', { name: 'By manufacturer' }).click();
      const makers = await dlg.locator('button:has-text("Moog")').count();
      await dlg.getByRole('button', { name: /^Moog\s*\d+$/ }).click();
      await dlg.getByRole('button', { name: /Subsequent 37/ }).first().waitFor();
      const moog = await dlg.getByRole('button', { name: /Moog ·/ }).count();
      await dlg.getByRole('button', { name: /All manufacturers/ }).click();
      await dlg.getByRole('button', { name: 'Search' }).click();
      await dlg.locator('input[aria-label="Search templates"]').fill('korg volca');
      const volcas = await dlg.getByRole('button', { name: /volca/i }).count();
      await page.screenshot({ path: path.join(OUT, 'midi-synth-templates-desktop.png') });
      await dlg.getByRole('button', { name: 'Cancel' }).click();
      assert(makers >= 1 && moog >= 5, `Moog instruments listed (${moog})`);
      assert(volcas >= 3, `volca search (${volcas})`);
      return { moog, volcas };
    });

    // ---- Knob -> CC ----------------------------------------------------------
    await check('Your synth: moving a knob sends its CC (14-bit MSB+LSB) on channel 2; nothing on load', async () => {
      const before = (await sentTo(page, 'Test Synth')).filter(m => (m.data[0] & 0xf0) === 0xb0).length;
      assert(before === 0, `no CC sent on load (got ${before})`);
      const k = (await dataOf(page, 'midi-synth')).knobs[0];
      await dragKnob(page, 'k1', 60, hostOf(page, 'midi-synth'));
      await page.waitForTimeout(100);
      const ccs = (await sentTo(page, 'Test Synth')).filter(m => (m.data[0] & 0xf0) === 0xb0);
      assert(ccs.length > 0, 'CC sent');
      assert(ccs.every(m => m.data[0] === 0xb1), 'channel 2');
      assert(ccs.some(m => m.data[1] === k.cc), `CC ${k.cc} sent`);
      if (k.lsb !== undefined) assert(ccs.some(m => m.data[1] === k.lsb), `LSB CC ${k.lsb} sent`);
      return { messages: ccs.length, last: ccs.slice(-2).map(m => m.data) };
    });

    // ---- Program change ------------------------------------------------------
    await check('Program change: + sends a program change on channel 2; bank select goes first when set', async () => {
      await clearSent(page);
      await hostOf(page, 'midi-synth').getByRole('button', { name: 'Next program' }).click();
      await page.waitForTimeout(350);
      const pc1 = (await sentTo(page, 'Test Synth')).map(m => m.data);
      await hostOf(page, 'midi-synth').getByRole('button', { name: 'Setup…' }).click();
      const dlg = page.getByRole('dialog');
      await dlg.getByPlaceholder('not sent').first().fill('2');
      await dlg.getByRole('button', { name: 'Save' }).click();
      await clearSent(page);
      await hostOf(page, 'midi-synth').getByRole('button', { name: 'Next program' }).click();
      await page.waitForTimeout(350);
      const pc2 = (await sentTo(page, 'Test Synth')).map(m => m.data);
      assert(pc1.length === 1 && pc1[0].join() === [0xc1, 1].join(), `program 2: ${JSON.stringify(pc1)}`);
      assert(pc2.length === 2 && pc2[0].join() === [0xb1, 0, 2].join() && pc2[1].join() === [0xc1, 2].join(), `bank 2 + program 3: ${JSON.stringify(pc2)}`);
      const shown = await hostOf(page, 'midi-synth').getByText('003').count();
      assert(shown > 0, 'program 003 shown');
      return { pc1, pc2 };
    });

    // ---- Sequencer + clock timing ------------------------------------------
    await check('Sequencer + clock out: notes on channel 2 and clock with exact timestamps when the studio ▶ runs', async () => {
      await clearSent(page);
      await page.getByRole('button', { name: 'Play studio' }).click();
      await page.waitForTimeout(2300);
      const started = await page.evaluate(() => ({ at: window.__synthStudio.transport.startedAt, bpm: window.__synthStudio.transport.bpm }));
      await page.screenshot({ path: path.join(OUT, 'midi-synth-playing-desktop.png') });
      await page.getByRole('button', { name: 'Stop studio' }).click();
      await page.waitForTimeout(400);
      const sent = await page.evaluate(() => window.__midiSent.slice());
      const tickMs = 60000 / started.bpm / 24;
      const clock = sent.filter(m => m.port === 'Clock Box');
      const clocks = clock.filter(m => m.data[0] === 0xf8);
      assert(clock[0] && clock[0].data[0] === 0xfa, 'Start first');
      assert(clock[0].ts < clocks[0].ts, 'Start before the first clock');
      assert(clock[clock.length - 1].data[0] === 0xfc, 'Stop last');
      assert(clock[clock.length - 1].ts > clocks[clocks.length - 1].ts, 'Stop after the last queued clock');
      assert(clocks.length >= 100, `clocks: ${clocks.length}`);
      const gaps = clocks.slice(1).map((m, i) => m.ts - clocks[i].ts - tickMs);
      const maxGapErr = Math.max(...gaps.map(Math.abs));
      assert(maxGapErr < 0.3, `clock spacing error ${maxGapErr.toFixed(3)} ms`);
      const tickTime = k => started.at + k * tickMs / 1000;
      const raw = clocks.map((m, k) => m.ts - (m.now + (tickTime(k) - m.ct) * 1000 + m.outLat * 1000));
      const rawMax = Math.max(...raw.map(Math.abs));
      assert(rawMax < 25, `timestamps follow the formula within one audio callback (${rawMax.toFixed(2)} ms)`);
      assert(clocks.every(m => m.ts > m.now), 'every clock scheduled ahead');

      const notes = sent.filter(m => m.port === 'Test Synth');
      const ons = notes.filter(m => m.data[0] === 0x91);
      const offs = notes.filter(m => m.data[0] === 0x81);
      assert(ons.length >= 10, `note-ons: ${ons.length}`);
      assert(ons.length === offs.length, 'every note-on has its note-off');
      assert(ons.every(m => m.ts > m.now), 'notes scheduled ahead (timestamps in the future)');
      assert(!notes.some(m => (m.data[0] & 0xf0) === 0x90 && m.data[0] !== 0x91), 'notes only on channel 2');
      const idx = stepsOf(ons, clocks);
      assert(idx.every(i => i >= 0), `notes on 16th-note clock ticks: ${idx.slice(0, 12)}`);
      const pattern = (await dataOf(page, 'midi-synth')).steps.map(s => s.on);
      assert(idx.every(i => pattern[i]), 'only switched-on steps play');
      const gate = (await store(page, () => window.__synthStudio.hub.valuesFor('midi-synth').gate)) / 100;
      const lens = ons.map((m, i) => offs[i].ts - m.ts);
      assert(lens.every(l => Math.abs(l - gate * 6 * tickMs) < 0.3), `gate lengths ${lens.slice(0, 3).map(l => l.toFixed(2))}`);
      return {
        clocks: clocks.length, clockSpacingErrMs: +maxGapErr.toFixed(3), formulaErrMs: +rawMax.toFixed(2),
        noteOns: ons.length, firstSteps: idx.slice(0, 10), aheadMs: +(ons[0].ts - ons[0].now).toFixed(1), outputLatencyMs: +(ons[0].outLat * 1000).toFixed(1),
      };
    });

    await check('Your synth: step entry - tap a note name, play a key, the step takes it and the selection moves on', async () => {
      const host = hostOf(page, 'midi-synth');
      await host.getByRole('button', { name: 'Edit step 2' }).click();
      await page.mouse.move(5, 5);
      await page.keyboard.down('s'); // A-K row: s = lowNote + 2 = D3 (50)
      await page.waitForTimeout(150);
      await page.keyboard.up('s');
      await page.waitForTimeout(150);
      const step = (await dataOf(page, 'midi-synth')).steps[1];
      const sel = await host.getByRole('button', { name: 'Edit step 3' }).getAttribute('aria-pressed');
      await host.getByRole('button', { name: 'Done editing' }).click();
      assert(step.on && step.note === 50, `step 2 = ${JSON.stringify(step)}`);
      assert(sel === 'true', 'selection moved to step 3');
      return step;
    });

    // ---- MIDI input -----------------------------------------------------------
    await check('MIDI input: notes + bend reach the focused instrument (re-channelled MIDI thru)', async () => {
      await clearSent(page);
      const attached = await page.evaluate(() => window.__midiIn('in1', [0x90, 64, 100]));
      assert(attached, 'input listener attached');
      await page.waitForTimeout(80);
      await page.evaluate(() => window.__midiIn('in1', [0xe0, 0, 80]));
      await page.evaluate(() => window.__midiIn('in1', [0x80, 64, 0]));
      await page.waitForTimeout(80);
      const got = (await sentTo(page, 'Test Synth')).map(m => m.data);
      const has = d => got.some(g => g.join() === d.join());
      assert(has([0x91, 64, 100]), `note-on thru: ${JSON.stringify(got)}`);
      assert(has([0xe1, 0, 80]), 'pitch bend thru');
      assert(has([0x81, 64, 0]), 'note-off thru');
      return { got };
    });

    await check('MIDI input: plays a twin (Sub 37) with sound; bend drives its wheel', async () => {
      await (await tab(page, 'sub37')).click();
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
      await (await tab(page, 'midi-synth')).click();
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

    await check('MIDI learn to a panel knob: a controller CC moves knob 1, which sends the synth\'s own CC', async () => {
      await page.getByRole('button', { name: /^MIDI settings/ }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Start MIDI learn' }).click();
      await dragKnob(page, 'k2', 8, hostOf(page, 'midi-synth'));
      await page.getByText(/Now move a knob/).waitFor({ timeout: 3000 });
      await page.evaluate(() => window.__midiIn('in1', [0xb0, 22, 10]));
      await page.getByText(/Mapped CC 22/).waitFor({ timeout: 3000 });
      await page.getByRole('button', { name: 'Done' }).click();
      const k2 = (await dataOf(page, 'midi-synth')).knobs[1];
      await clearSent(page);
      await page.evaluate(() => window.__midiIn('in1', [0xb0, 22, 120]));
      await page.waitForTimeout(150);
      const out = (await sentTo(page, 'Test Synth')).map(m => m.data);
      assert(out.some(d => d[0] === 0xb1 && d[1] === k2.cc), `controller CC 22 -> panel knob 2 -> synth CC ${k2.cc}: ${JSON.stringify(out)}`);
      return { knob: `${k2.label} CC${k2.cc}`, sent: out.slice(0, 2) };
    });

    await check('Learn from the synth (Setup): the next CC from the synth becomes the knob\'s CC, with its 14-bit LSB', async () => {
      await hostOf(page, 'midi-synth').getByRole('button', { name: 'Setup…' }).click();
      const dlg = page.getByRole('dialog');
      await dlg.getByRole('button', { name: 'Learn the CC for knob 3 from your synth' }).click();
      await page.waitForTimeout(100);
      await page.evaluate(() => { window.__midiIn('in1', [0xb0, 14, 90]); window.__midiIn('in1', [0xb0, 46, 3]); });
      await page.waitForTimeout(250);
      const cc = await dlg.getByLabel('Knob 3 CC number').inputValue();
      const lsb = await dlg.getByLabel('Knob 3 LSB CC').inputValue();
      await dlg.getByRole('button', { name: 'Save' }).click();
      const k3 = (await dataOf(page, 'midi-synth')).knobs[2];
      assert(cc === '14' && lsb === '46', `learned CC ${cc}/${lsb}`);
      assert(k3.cc === 14 && k3.lsb === 46, `saved ${JSON.stringify(k3)}`);
      return { knob3: k3 };
    });

    await check('MIDI clock in: follow an external Start + 125 BPM clock, then Stop', async () => {
      await page.getByRole('button', { name: /^MIDI settings/ }).click();
      const dlg = page.getByRole('dialog');
      await dlg.getByLabel('Follow an external clock').check();
      await dlg.locator('select[aria-label="Clock source"]').selectOption('Test Keys');
      await dlg.getByRole('button', { name: 'Close' }).last().click();
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
      await page.getByRole('button', { name: /^MIDI settings/ }).click();
      await page.getByRole('dialog').getByLabel('Follow an external clock').uncheck();
      await page.getByRole('dialog').getByRole('button', { name: 'Close' }).last().click();
      await store(page, () => window.__synthStudio.store.getState().setBpm(120));
      assert(res.during.playing, 'external Start started the studio');
      assert(Math.abs(res.during.bpm - 125) < 1.5, `tempo ${res.during.bpm.toFixed(2)}`);
      assert(!res.after.playing, 'external Stop stopped the studio');
      return { bpm: +res.during.bpm.toFixed(2) };
    });

    // ---- Spare capacity: two Your synth instances ---------------------------------
    await check('Two synths: the second one on channel 3 with clock; notes, clock and panic never cross over', async () => {
      await (await tab(page, 'midi-synth#2')).click();
      await page.waitForTimeout(600);
      const host = hostOf(page, 'midi-synth#2');
      await host.getByRole('button', { name: 'Setup…' }).click();
      const dlg = page.getByRole('dialog');
      await dlg.getByRole('textbox').first().fill('Lead');
      await dlg.locator('select[aria-label="MIDI output port"]').selectOption({ label: 'Test Synth' });
      // Same output and channel as Bass: Setup warns and offers a free channel
      await dlg.locator('select[aria-label="MIDI channel"]').selectOption('1');
      await dlg.getByText(/already sends on this output and channel/).waitFor({ timeout: 2000 });
      await page.screenshot({ path: path.join(OUT, 'midi-synth-clash-desktop.png') });
      await dlg.locator('select[aria-label="MIDI channel"]').selectOption('2');
      await dlg.getByLabel('Send MIDI clock to this synth').check();
      await dlg.getByRole('button', { name: 'Save' }).click();
      await page.locator('nav[aria-label="Instruments"]').getByRole('button', { name: 'Lead', exact: true }).waitFor({ timeout: 3000 });

      await clearSent(page);
      await page.getByRole('button', { name: 'Play studio' }).click();
      await page.waitForTimeout(2200);
      await page.getByRole('button', { name: 'Stop studio' }).click();
      await page.waitForTimeout(400);
      const sent = await page.evaluate(() => window.__midiSent.slice());
      const clocks = sent.filter(m => m.port === 'Clock Box' && m.data[0] === 0xf8);
      const synthClocks = sent.filter(m => m.port === 'Test Synth' && m.data[0] === 0xf8);
      const onsBass = sent.filter(m => m.port === 'Test Synth' && m.data[0] === 0x91);
      const onsLead = sent.filter(m => m.port === 'Test Synth' && m.data[0] === 0x92);
      const bass = (await dataOf(page, 'midi-synth')).steps;
      const lead = (await dataOf(page, 'midi-synth#2')).steps;
      const sb = stepsOf(onsBass, clocks);
      const sl = stepsOf(onsLead, clocks);
      assert(onsBass.length >= 8 && onsLead.length >= 8, `both play (${onsBass.length} / ${onsLead.length})`);
      assert(sb.every(i => i >= 0 && bass[i].on), 'Bass notes follow the Bass pattern');
      assert(sl.every(i => i >= 0 && lead[i].on), 'Lead notes follow the Lead pattern');
      assert(onsLead.every((m, i) => m.data[1] === lead[sl[i]].note), 'Lead notes are its own');
      // Clock to Test Synth because Lead asked for it: exactly one clock per tick
      assert(Math.abs(synthClocks.length - clocks.length) <= 1, `one clock stream to Test Synth (${synthClocks.length} vs ${clocks.length})`);

      // Bass asks for clock too: still one stream (the port is shared)
      await store(page, () => window.__synthStudio.store.getState().updateDeviceData('midi-synth', d => ({ ...d, clock: true })));
      await clearSent(page);
      await page.getByRole('button', { name: 'Play studio' }).click();
      await page.waitForTimeout(1200);
      await page.getByRole('button', { name: 'Stop studio' }).click();
      await page.waitForTimeout(300);
      const sent2 = await page.evaluate(() => window.__midiSent.slice());
      const c1 = sent2.filter(m => m.port === 'Clock Box' && m.data[0] === 0xf8).length;
      const c2 = sent2.filter(m => m.port === 'Test Synth' && m.data[0] === 0xf8).length;
      assert(Math.abs(c1 - c2) <= 1, `no double clock when both synths share the port (${c2} vs ${c1})`);

      // Panic and knobs stay on their own channel
      await clearSent(page);
      await host.getByRole('button', { name: 'Panic' }).click();
      await page.waitForTimeout(100);
      const panic = (await sentTo(page, 'Test Synth')).map(m => m.data);
      assert(panic.length >= 2 && panic.every(d => (d[0] & 0x0f) === 2), `Lead panic on channel 3 only: ${JSON.stringify(panic)}`);
      await clearSent(page);
      await dragKnob(page, 'k1', 40, host);
      await page.waitForTimeout(100);
      const ccs = (await sentTo(page, 'Test Synth')).map(m => m.data);
      assert(ccs.length > 0 && ccs.every(d => d[0] === 0xb2), `Lead knob on channel 3 only: ${JSON.stringify(ccs.slice(0, 3))}`);
      await page.screenshot({ path: path.join(OUT, 'two-synths-desktop.png') });
      return { bassNotes: onsBass.length, leadNotes: onsLead.length, clocks: clocks.length, clocksToSynth: synthClocks.length, sharedPortClocks: [c1, c2] };
    });

    await check('MIDI settings: clock targets from a Your synth show where they come from', async () => {
      await page.getByRole('button', { name: /^MIDI settings/ }).click();
      const dlg = page.getByRole('dialog');
      await dlg.getByText(/from Bass, Lead|from Lead, Bass/).first().waitFor({ timeout: 2000 });
      await page.screenshot({ path: path.join(OUT, 'midi-settings-synth-clock-desktop.png') });
      await dlg.getByRole('button', { name: 'Close' }).last().click();
    });

    await check('Starters: "Setup / Practice synth: drums on channel 10" sets output, channel and a drum pattern', async () => {
      const host = hostOf(page, 'midi-synth#2');
      await host.getByRole('button', { name: 'Starters' }).click();
      const dlg = page.getByRole('dialog');
      await page.screenshot({ path: path.join(OUT, 'midi-synth-starters-desktop.png') });
      await dlg.locator('[data-starter="practice-drums"]').click();
      await page.waitForTimeout(200);
      const d = await dataOf(page, 'midi-synth#2');
      const status = await host.getByTestId('midi-synth-status').innerText();
      assert(d.channel === 9 && d.port.name === 'Practice synth (built in)', `drums setup ${d.channel} ${d.port && d.port.name}`);
      assert(d.steps.filter(s => s.on).every(s => [36, 38, 42, 46].includes(s.note)), 'GM drum notes');
      assert(/ch 10 · Drums part/.test(status), status);
      // Back to the lead setup on Test Synth for the rest
      return { status };
    });

    // ---- Audio input -------------------------------------------------------------
    await check('Audio input: getUserMedia (voice processing off) -> -12 dBFS on the meter and the master', async () => {
      await (await tab(page, 'audio-in')).click();
      await page.waitForTimeout(500);
      const host = hostOf(page, 'audio-in');
      await host.getByRole('button', { name: 'Connect' }).click();
      await page.waitForFunction(() => window.__synthStudio.hub.getState('audio-in').status === 'live', null, { timeout: 10000 });
      const st = await store(page, () => window.__synthStudio.hub.getState('audio-in'));
      const asked = await page.evaluate(() => window.__gum[window.__gum.length - 1].audio);
      const level = await levelPeak(page, 1200);
      const meter = await page.evaluate(() => Math.max(...[...document.querySelectorAll('[data-meter]')].map(el => { const m = /scaleX\(([\d.]+)\)/.exec(el.style.transform); return m ? parseFloat(m[1]) * 100 : 0; })));
      const peakText = await host.locator('[data-peak]').innerText();
      await page.screenshot({ path: path.join(OUT, 'audio-in-desktop.png') });
      assert(asked.echoCancellation === false && asked.noiseSuppression === false && asked.autoGainControl === false, `constraints ${JSON.stringify(asked)}`);
      assert(level > 0.01, `master level ${level}`);
      assert(meter > 0, `meter ${meter}%`);
      assert(Math.abs(parseFloat(peakText) + 12) < 0.6, `peak readout ${peakText} dBFS`);
      await host.locator('[data-control="mute"]').click();
      await page.waitForTimeout(300);
      const muted = await levelPeak(page, 800);
      const meterMuted = await page.evaluate(() => Math.max(...[...document.querySelectorAll('[data-meter]')].map(el => { const m = /scaleX\(([\d.]+)\)/.exec(el.style.transform); return m ? parseFloat(m[1]) * 100 : 0; })));
      await host.locator('[data-control="mute"]').click();
      assert(muted < level / 4, `muted level ${muted}`);
      assert(meterMuted > 0, 'meter still reads while muted');
      return { device: st.deviceLabel, constraints: asked, level, peakText, muted };
    });

    await check('Audio input: level check says Good at -12 dBFS; +18 dB of GAIN latches CLIP', async () => {
      const host = hostOf(page, 'audio-in');
      await host.getByRole('button', { name: 'Check the input level' }).click();
      await page.waitForTimeout(5600);
      const verdict = await host.getByTestId('level-verdict').innerText();
      const lc = (await dataOf(page, 'audio-in')).levelCheck;
      await store(page, () => window.__synthStudio.store.getState().setControlValue('audio-in', 'gain', 18));
      await page.waitForTimeout(500);
      await store(page, () => window.__synthStudio.store.getState().setControlValue('audio-in', 'gain', 0));
      await page.waitForTimeout(400);
      const clipBg = await host.locator('[data-clip]').evaluate(el => el.style.background);
      await host.locator('[data-clip]').click();
      await page.waitForTimeout(100);
      const cleared = await host.locator('[data-clip]').evaluate(el => el.style.background);
      assert(/Good level/.test(verdict) && Math.abs(lc.peakDb + 12) < 0.6, `verdict: ${verdict} (${lc && lc.peakDb})`);
      assert(/239, 68, 68|ef4444/.test(clipBg), `CLIP latched after GAIN went back down (${clipBg})`);
      assert(!/239, 68, 68|ef4444/.test(cleared), 'tap clears CLIP');
      return { verdict, peakDb: lc.peakDb };
    });

    await check('Audio input: Record take saves a WAV of this input (starting the studio) and lists it', async () => {
      const host = hostOf(page, 'audio-in');
      const download = page.waitForEvent('download', { timeout: 15000 });
      await host.getByRole('button', { name: /Record take/ }).click();
      await page.waitForTimeout(1600);
      const playing = await page.evaluate(() => window.__synthStudio.transport.playing);
      await host.getByRole('button', { name: /Stop take/ }).click();
      const dl = await download;
      const file = path.join(OUT, 'take.wav');
      await dl.saveAs(file);
      await page.waitForTimeout(300);
      const takes = (await dataOf(page, 'audio-in')).takes;
      const stopped = await page.evaluate(() => !window.__synthStudio.transport.playing);
      const size = fs.statSync(file).size;
      assert(playing, 'the take started the studio');
      assert(stopped, 'stopping the take stopped the studio it started');
      assert(takes.length === 1 && takes[0].seconds > 1 && Math.abs(takes[0].peakDb + 12) < 1, `take ${JSON.stringify(takes)}`);
      assert(/take 1\.wav$/.test(dl.suggestedFilename()) && size > 44 + 48000 * 6, `wav ${dl.suggestedFilename()} ${size} bytes`);
      return { file: dl.suggestedFilename(), bytes: size, take: takes[0] };
    });

    await check('Audio input routed to a Xone:96 channel (master fallback while the Xone has no studio inputs)', async () => {
      await store(page, () => window.__synthStudio.store.getState().addToRack('xone96'));
      await page.waitForFunction(() => window.__synthStudio.hub.hasInstance('xone96'), null, { timeout: 15000 });
      await page.waitForTimeout(800);
      const inputs = await page.evaluate(() => {
        const m = window.__synthStudio.hub.getModule('xone96');
        return (m && m.studio && m.studio.mixerInputs || []).map(i => i.id);
      });
      const options = await hostOf(page, 'audio-in').locator('select[aria-label="Output: where this input goes"] option').allTextContents();
      await store(page, () => window.__synthStudio.store.getState().setRoute('audio-in', 'xone96:studio_1'));
      await page.waitForTimeout(600);
      const level = await levelPeak(page, 1000);
      const route = await store(page, () => window.__synthStudio.store.getState().studio.routes['audio-in']);
      assert(route === 'xone96:studio_1', 'route stored');
      assert(level > 0.01, `audio reaches the output through the route (${level})`);
      if (inputs.includes('studio_1')) assert(options.some(o => /STUDIO 1/i.test(o)), `OUTPUT lists the Xone channels: ${options}`);
      await store(page, () => window.__synthStudio.store.getState().setRoute('audio-in', 'master'));
      return { xoneInputs: inputs.length ? inputs : 'none at this commit (fell back to master)', options, level };
    });

    await check('Audio input <- Practice synth: its direct sound switches off while the input listens', async () => {
      const host = hostOf(page, 'audio-in');
      await host.getByRole('radio', { name: 'Practice synth' }).click();
      await page.waitForFunction(() => window.__synthStudio.hub.getState('audio-in').source === 'practice', null, { timeout: 5000 });
      await page.waitForTimeout(300);
      const listeners = await page.evaluate(() => window.__synthStudioMidi.practiceSynth.getStatus().listeners);
      await page.evaluate(() => window.__synthStudio.hub.event('audio-in', 'audition'));
      let meter = 0;
      for (let i = 0; i < 20; i++) {
        meter = Math.max(meter, await page.evaluate(() => Math.max(...[...document.querySelectorAll('[data-meter]')].map(el => { const m = /scaleX\(([\d.]+)\)/.exec(el.style.transform); return m ? parseFloat(m[1]) * 100 : 0; }))));
        await page.waitForTimeout(60);
      }
      const label = await (await tab(page, 'audio-in')).innerText();
      await page.screenshot({ path: path.join(OUT, 'audio-in-practice-desktop.png') });
      assert(listeners === 1, `one listener (${listeners})`);
      assert(meter > 20, `the Practice synth reaches the input meter (${meter}%)`);
      assert(/Practice synth audio/.test(label), `rack tab named after the source: ${label}`);
      return { listeners, meter, label };
    });

    await check('Practice synth arpeggiator: follows MIDI clock while it arrives, its own 104 BPM without it', async () => {
      const synth = () => page.evaluate(() => window.__synthStudioMidi.practiceSynth.getStatus());
      // Arp on for the keys part (CC 80 on channel 2), latch a chord
      await page.evaluate(() => {
        const ps = window.__synthStudioMidi.practiceSynth;
        ps.send([0xb1, 80, 127]);
        [60, 63, 67].forEach(n => ps.send([0x91, n, 100]));
        [60, 63, 67].forEach(n => ps.send([0x81, n, 0]));
      });
      await page.waitForTimeout(700);
      const free = await synth();
      // Clock to the Practice synth, then play: it locks to the studio
      await page.getByRole('button', { name: /^MIDI settings/ }).click();
      await page.getByRole('dialog').getByLabel('Send clock to Practice synth (built in)').check();
      await page.getByRole('dialog').getByRole('button', { name: 'Close' }).last().click();
      await page.getByRole('button', { name: 'Play studio' }).click();
      await page.waitForTimeout(1500);
      const locked = await synth();
      const sounding = await levelPeak(page, 400);
      await page.getByRole('button', { name: 'Stop studio' }).click();
      await page.waitForTimeout(600);
      const stopped = await synth();
      await page.evaluate(() => window.__synthStudioMidi.practiceSynth.send([0xb1, 80, 0]));
      await page.getByRole('button', { name: /^MIDI settings/ }).click();
      await page.getByRole('dialog').getByLabel('Send clock to Practice synth (built in)').uncheck();
      await page.getByRole('dialog').getByRole('button', { name: 'Close' }).last().click();
      assert(free.parts[1].arp && !free.clock.present && Date.now() > 0 && free.parts[1].lastNote > 0, `free-running arp: ${JSON.stringify(free.parts[1])}`);
      assert(locked.clock.present && locked.clock.running && Math.abs(locked.clock.bpm - 120) < 1, `locked to the clock: ${JSON.stringify(locked.clock)}`);
      assert(sounding > 0.005, `the arpeggio sounds (${sounding})`);
      assert(!stopped.clock.running, 'Stop halts it');
      return { free: free.clock, locked: locked.clock, stopped: stopped.clock, sounding };
    });

    // ---- Web Audio plugin: built-in plugins ----------------------------------------
    await check('Built-in plugins: Studio Mono plays from the keys; its window saves settings with the project', async () => {
      await (await tab(page, 'wam-plugin')).click();
      await page.waitForTimeout(500);
      const host = hostOf(page, 'wam-plugin');
      await host.getByRole('button', { name: 'Choose plugin…' }).click();
      const dlg = page.getByRole('dialog');
      await dlg.getByRole('button', { name: /Studio Mono/ }).click();
      await dlg.getByRole('button', { name: 'Load plugin' }).click();
      await page.waitForFunction(() => window.__synthStudio.hub.getState('wam-plugin').status === 'ready', null, { timeout: 5000 });
      await page.mouse.click(5, 5);
      await page.keyboard.down('a');
      const peak = await levelPeak(page, 600);
      await page.keyboard.up('a');
      await host.getByRole('button', { name: 'Open plugin window' }).click();
      const win = page.getByRole('dialog', { name: /plugin window/ });
      await win.waitFor();
      await win.getByLabel('Cutoff').evaluate(el => { el.value = '150'; el.dispatchEvent(new Event('input', { bubbles: true })); });
      await page.screenshot({ path: path.join(OUT, 'wam-mono-window-desktop.png') });
      await win.getByRole('button', { name: 'Close plugin window' }).click();
      await page.waitForTimeout(300);
      const data = await dataOf(page, 'wam-plugin');
      const label = await (await tab(page, 'wam-plugin')).innerText();
      assert(peak > 0.01, `Studio Mono sounds (peak ${peak})`);
      assert(data.state && data.state.cutoff < 300, `state saved (${JSON.stringify(data.state)})`);
      assert(label === 'Studio Mono', `rack tab named after the plugin: ${label}`);
      return { peak, cutoff: Math.round(data.state.cutoff), label };
    });

    await check('Built-in plugins: Studio Echo processes the test sound; BYPASS passes it dry', async () => {
      const host = hostOf(page, 'wam-plugin');
      await host.getByRole('button', { name: 'Change…' }).click();
      const dlg = page.getByRole('dialog');
      await dlg.getByRole('button', { name: /Studio Echo/ }).click();
      await dlg.getByRole('button', { name: 'Load plugin' }).click();
      await page.waitForFunction(() => window.__synthStudio.hub.getState('wam-plugin').plugin?.name === 'Studio Echo', null, { timeout: 5000 });
      await host.getByRole('button', { name: /Test sound/ }).click();
      const wet = await levelPeak(page, 1200);
      await host.locator('[data-control="bypass"]').click();
      const dry = await levelPeak(page, 800);
      await host.locator('[data-control="bypass"]').click();
      await page.screenshot({ path: path.join(OUT, 'wam-echo-desktop.png') });
      assert(wet > 0.01 && dry > 0.01, `wet ${wet}, dry ${dry}`);
      return { wet, dry };
    });

    // ---- WAM: unreachable URLs --------------------------------------------------------
    const PLUGINS = 'https://www.webaudiomodules.com/community/plugins/';
    const waitPlugin = url => page.waitForFunction(u => {
      const st = window.__synthStudio.hub.getState('wam-plugin');
      return st.url === u && ['ready', 'error', 'untrusted'].includes(st.status);
    }, url, { timeout: 30000 });
    const pluginState = () => store(page, () => window.__synthStudio.hub.getState('wam-plugin'));
    const loadUrl = async url => {
      await hostOf(page, 'wam-plugin').getByRole('button', { name: /Choose plugin…|Change…/ }).click();
      const dlg = page.getByRole('dialog');
      await dlg.locator('#wam-url').fill(url);
      const trust = dlg.getByRole('checkbox');
      if (await trust.count()) await trust.check();
      await dlg.getByRole('button', { name: 'Load plugin' }).click();
    };
    await check('WAM host: unreachable URLs fail cleanly with a clear message', async () => {
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
      await hostOf(page, 'wam-plugin').getByRole('button', { name: /Choose plugin…|Change…/ }).click();
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
        const local = `${WAM_BASE}burns-audio/synth101/index.js`;
        await loadUrl(local);
        await waitPlugin(local);
        const st = await pluginState();
        assert(st.status === 'ready', `status ${st.status}: ${st.error}`);
        await page.mouse.click(5, 5);
        await page.keyboard.down('a');
        const peak = await levelPeak(page, 700);
        await page.keyboard.up('a');
        assert(peak > 0.01, `plugin sounds from the keys (peak ${peak})`);
        return { plugin: st.plugin, peak, curated: `${PLUGINS}burns-audio/synth101/index.js` };
      });
      if (WAM_INDEX) {
        await check('WAM host: every curated plugin loads from its npm copy', async () => {
          const src = fs.readFileSync(path.resolve(__dirname, '../../wam/plugins.ts'), 'utf8');
          const list = [...src.matchAll(/p\('([^']+)', '[^']+', '(instrument|effect)', '([^']+)'/g)].map(m => ({ name: m[1], kind: m[2], path: m[3] }));
          const out = {};
          for (const pl of list) {
            const url = `${WAM_BASE}${pl.path}`;
            await loadUrl(url);
            await waitPlugin(url);
            out[pl.name] = (await pluginState()).status;
          }
          const bad = Object.entries(out).filter(([, v]) => v !== 'ready');
          assert(!bad.length, JSON.stringify(out));
          return out;
        });
      }
    }

    // ---- Studio view ------------------------------------------------------------------
    await check('Studio view: every external device in the rack, named after its gear, with routable outputs', async () => {
      await page.locator('nav[aria-label="Instruments"]').getByRole('button', { name: /Studio/ }).click();
      await page.waitForTimeout(1200);
      await page.screenshot({ path: path.join(OUT, 'studio-desktop.png'), fullPage: true });
      const outputs = await page.locator('select').evaluateAll(els => els.filter(e => [...e.options].some(o => o.value === 'master')).length);
      const names = await page.locator('section[aria-label]').evaluateAll(els => els.map(e => e.getAttribute('aria-label')));
      assert(outputs >= 4, `Output selects: ${outputs}`);
      // Bass, and the second synth renamed by the drums starter
      assert(names.includes('Bass') && names.includes('Practice drums') && names.includes('Practice synth audio'), `rack names: ${names}`);
      return { outputs, names };
    });

    const overflowDesktop = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    await context.close();

    // ---- iPad: no Web MIDI; Practice synth, audio input and plugins work -------------------
    phase = 'ipad';
    const ipadUa = 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
    const ipad = await openPage(browser, { viewport: { width: 1180, height: 820 }, touch: true, ua: ipadUa, midi: false, rack, current: 'midi-synth', session: true });
    await check('iPad 1180x820: kind no-MIDI guidance, what works instead; Practice synth plays; audio input connects', async () => {
      const p = ipad.page;
      await p.getByText(/iPad has no Web MIDI/).first().waitFor({ timeout: 5000 });
      await p.screenshot({ path: path.join(OUT, 'midi-synth-ipad.png') });
      await unlockAudio(p).catch(() => undefined);
      await hostOf(p, 'midi-synth').locator('[data-note="60"]').tap();
      const peak = await levelPeak(p, 500);
      await p.getByRole('button', { name: /^MIDI settings/ }).tap();
      const dlg = p.getByRole('dialog');
      await dlg.getByText(/iPad and iPhone browsers have no Web MIDI/).waitFor();
      await dlg.getByText('What works on this iPad').waitFor();
      await dlg.getByText(/Chrome or Edge on a computer/).first().waitFor();
      await dlg.getByText('Practice synth (built in)').waitFor();
      await p.screenshot({ path: path.join(OUT, 'midi-settings-ipad.png') });
      await dlg.getByRole('button', { name: 'Close' }).last().tap();
      await hostOf(p, 'midi-synth').getByRole('button', { name: 'Setup…' }).tap();
      await p.getByRole('dialog').getByText(/iPad and iPhone browsers have no Web MIDI/).waitFor();
      await p.screenshot({ path: path.join(OUT, 'midi-synth-setup-ipad.png') });
      await p.getByRole('dialog').getByRole('button', { name: 'Cancel' }).tap();
      await (await tab(p, 'audio-in')).tap();
      await p.waitForTimeout(400);
      await hostOf(p, 'audio-in').getByRole('button', { name: 'Connect' }).tap();
      await p.waitForFunction(() => window.__synthStudio.hub.getState('audio-in').status === 'live', null, { timeout: 10000 });
      // The audio session allows recording while the input is open (WebKit 'playback' has no mic)
      const session = await p.evaluate(() => ({ type: navigator.audioSession.type, count: globalThis.__synthCaptureCount, set: window.__sessionTypes.slice() }));
      await p.waitForTimeout(600);
      await p.screenshot({ path: path.join(OUT, 'audio-in-ipad.png') });
      await hostOf(p, 'audio-in').getByRole('button', { name: 'Disconnect' }).tap();
      await p.waitForTimeout(300);
      const after = await p.evaluate(() => ({ type: navigator.audioSession.type, count: globalThis.__synthCaptureCount }));
      assert(session.count === 1 && session.type === 'play-and-record', `capture session while live: ${JSON.stringify(session)}`);
      assert(after.count === 0 && after.type === 'playback', `session restored after the input closed: ${JSON.stringify(after)}`);
      await (await tab(p, 'wam-plugin')).tap();
      await p.waitForTimeout(500);
      await p.screenshot({ path: path.join(OUT, 'wam-plugin-ipad.png') });
      await p.locator('nav[aria-label="Instruments"]').getByRole('button', { name: /Studio/ }).tap();
      await p.waitForTimeout(1200);
      await p.screenshot({ path: path.join(OUT, 'studio-ipad.png'), fullPage: true });
      const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      assert(peak > 0.01, `Practice synth plays on iPad (peak ${peak})`);
      assert(!overflow, 'no horizontal page overflow on iPad');
      return { peak, overflow, session, after };
    });
    await ipad.context.close();

    // ---- macOS Safari: no Web MIDI ------------------------------------------------------------
    phase = 'safari';
    const safariUa = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
    const safari = await openPage(browser, { viewport: { width: 1440, height: 900 }, midi: false, ua: safariUa, rack: ['midi-synth', 'audio-in'], current: 'midi-synth' });
    await check('Safari (macOS, no Web MIDI): guidance instead of errors; the Practice synth plays', async () => {
      const p = safari.page;
      await p.getByText(/Safari has no Web MIDI, so this plays the built-in Practice synth/).first().waitFor({ timeout: 5000 });
      await unlockAudio(p).catch(() => undefined);
      await p.mouse.click(5, 5);
      await p.keyboard.down('a');
      const peak = await levelPeak(p, 500);
      await p.keyboard.up('a');
      await p.getByRole('button', { name: /^MIDI settings/ }).click();
      const dlg = p.getByRole('dialog');
      await dlg.getByText(/Safari has no Web MIDI/).first().waitFor();
      await dlg.getByText('What works in this browser').waitFor();
      await p.screenshot({ path: path.join(OUT, 'midi-settings-safari.png') });
      const learnDisabled = await dlg.getByRole('button', { name: 'Start MIDI learn' }).isDisabled();
      await dlg.getByRole('button', { name: 'Close' }).last().click();
      await p.screenshot({ path: path.join(OUT, 'midi-synth-safari.png') });
      const errs = consoleErrors.filter(e => e.phase === 'safari');
      assert(peak > 0.01, `Practice synth plays in Safari (peak ${peak})`);
      assert(learnDisabled, 'MIDI learn explained, not offered');
      assert(!errs.length, `no console errors: ${JSON.stringify(errs)}`);
      return { peak };
    });
    await safari.context.close();

    await check('no horizontal overflow on desktop', async () => { assert(!overflowDesktop, 'desktop overflow'); });
  } finally {
    await browser.close();
  }

  // Console errors: the only acceptable ones are the browser's own logs for the URLs we made fail on purpose
  const deliberate = /127\.0\.0\.1:9\/|plugins\.invalid/;
  const unexpected = consoleErrors.filter(e => !(deliberate.test(e.text) || deliberate.test(e.url)));
  console.log(`\nconsole errors: ${consoleErrors.length} (${consoleErrors.length - unexpected.length} from the deliberately unreachable plugin URLs)`);
  unexpected.forEach(e => console.log(`  UNEXPECTED [${e.phase} ${e.viewport}] ${e.text} ${e.url}`));
  if (unexpected.length) failed++;
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ results, consoleErrors, unexpected }, null, 2));
  console.log(`\n${results.filter(r => r.ok).length} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
