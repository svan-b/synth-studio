// ============================================================================
// Analog Four two-key moves, with two real touch points (iPad landscape, 1180 x 820):
//   node scripts/e2e/a4-combos.cjs <baseUrl>
//
//   page randomise  [FLTR] held + [YES] gives the FILTERS page new values, and again on
//                   the next press (manual p.17)
//   page reload     [FLTR] held + [NO] puts the page back as the kit has it (p.17, p.21)
//   the other key   [YES] held + [AMP] randomises the AMP page and opens it; [NO] held +
//                   [AMP] reloads it
//   not by accident [FLTR] then [YES], one after the other, changes nothing
//   control all     [T2] held + the FRQ knob moves filter 1 on all four synth tracks by
//                   the same amount; [NO] before [T2] is released takes it back (p.18)
//   one track       without a track key the knob moves its own track only
//   with a mouse    a right-click (or Alt-click) holds a key down and a click lets it go, so
//                   the same moves work without a second finger: [FLTR] held + [YES] / [NO],
//                   and nothing once the key is let go
// Fingers go through the DevTools protocol, the path a real finger takes.
// Prints one JSON object; scripts/e2e/run.cjs checks `ok`.
// ============================================================================
const { chromium } = require('playwright');

(async () => {
  const [, , base = 'http://localhost:3100'] = process.argv;
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('synth-studio-welcomed', '1');
    localStorage.setItem('synth-studio-storage', JSON.stringify({ state: { currentDevice: 'analog-four', devices: {}, completedLessons: [] }, version: 3 }));
  });
  const log = {};
  const failed = [];
  const check = (name, ok, detail) => { log[name] = ok ? true : detail ?? false; if (!ok) failed.push(name); };
  try {
    await p.goto(base, { waitUntil: 'networkidle' });
    await p.waitForFunction(() => !!window.__synthStudio, null, { timeout: 30000 });
    await p.waitForSelector('[data-control="key:FLTR"]', { timeout: 30000 });
    await p.waitForTimeout(1500); // the demo kit's sounds are applied when the panel first shows

    // ---- fingers -------------------------------------------------------------------------
    const cdp = await ctx.newCDPSession(p);
    const down = new Map();
    const points = () => [...down].map(([id, q]) => ({ id, x: q.x, y: q.y, radiusX: 6, radiusY: 6, force: 1 }));
    const touchDown = async (id, x, y) => { down.set(id, { x, y }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points() }); };
    const touchMove = async (id, x, y) => { down.set(id, { x, y }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points() }); };
    const touchUp = async id => { const q = down.get(id); down.delete(id); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ id, x: q.x, y: q.y }] }); };
    const centre = async sel => {
      const el = p.locator(sel).first();
      await el.scrollIntoViewIfNeeded();
      const r = await el.boundingBox();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    };
    const key = name => centre(`[data-control="key:${name}"]`);
    /** Hold one key, tap another, let go */
    const holdAndTap = async (held, tapped, keepHeld = false) => {
      const h = await key(held);
      if (!down.has(1)) { await touchDown(1, h.x, h.y); await p.waitForTimeout(160); }
      const t = await key(tapped);
      await touchDown(2, t.x, t.y); await p.waitForTimeout(90); await touchUp(2); await p.waitForTimeout(220);
      if (!keepHeld) { await touchUp(1); await p.waitForTimeout(160); }
    };
    const vals = keys => p.evaluate(ks => {
      const v = window.__synthStudio.store.getState().devices['analog-four']?.controlValues ?? {};
      return ks.map(k => v[k]);
    }, keys);
    const same = (a, c) => a.length === c.length && a.every((x, i) => x === c[i]);

    // ---- [PARAMETER] + [YES] / [NO] ------------------------------------------------------------
    const F = ['t1_flt1_frq', 't1_flt1_res', 't1_flt1_ovr', 't1_flt1_trk', 't1_flt1_dep', 't1_flt2_frq', 't1_flt2_res', 't1_flt2_typ', 't1_flt2_trk', 't1_flt2_dep'];
    const kit = await vals(F);
    await holdAndTap('FLTR', 'YES', true);
    const roll1 = await vals(F);
    await holdAndTap('FLTR', 'YES', true);
    const roll2 = await vals(F);
    check('[FLTR] + [YES] rolls the FILTERS page, anew each press', !same(kit, roll1) && !same(roll1, roll2) && roll1.every(v => typeof v === 'number'), { kit, roll1, roll2 });
    await holdAndTap('FLTR', 'NO');
    check('[FLTR] + [NO] puts the page back as the kit has it', same(kit, await vals(F)), { kit, now: await vals(F) });

    const A = ['t1_amp_atk', 't1_amp_dec', 't1_amp_sus', 't1_amp_rel', 't1_amp_shp', 't1_amp_cho', 't1_amp_del', 't1_amp_rev', 't1_amp_pan', 't1_amp_vol'];
    const ampKit = await vals(A);
    await holdAndTap('YES', 'AMP');
    const ampRoll = await vals(A);
    const page = (await vals(['page']))[0];
    check('[YES] + [AMP] rolls the AMP page and opens it', !same(ampKit, ampRoll) && page === 7, { ampKit, ampRoll, page });
    await holdAndTap('NO', 'AMP');
    check('[NO] + [AMP] reloads it', same(ampKit, await vals(A)), { ampKit, now: await vals(A) });

    await p.locator('[data-control="key:FLTR"]').tap(); await p.waitForTimeout(160);
    await p.locator('[data-control="key:YES"]').tap(); await p.waitForTimeout(220);
    check('[FLTR] then [YES], one after the other, changes nothing', same(kit, await vals(F)), await vals(F));

    // ---- CONTROL ALL -----------------------------------------------------------------------------
    const C = ['t1_flt1_frq', 't2_flt1_frq', 't3_flt1_frq', 't4_flt1_frq'];
    const before = await vals(C);
    const dragKnob = async (id, px) => {
      const k = await centre(`[data-control="${id}"]`);
      await touchDown(2, k.x, k.y); await p.waitForTimeout(60);
      for (let i = 1; i <= 10; i++) { await touchMove(2, k.x, k.y + (px * i) / 10); await p.waitForTimeout(16); }
      await touchUp(2); await p.waitForTimeout(260);
    };
    const t2 = await key('T2');
    await touchDown(1, t2.x, t2.y); await p.waitForTimeout(260);
    await dragKnob('t2_flt1_frq', 40);
    const moved = await vals(C);
    const delta = moved[1] - before[1];
    check('[T2] held + FRQ moves all four tracks by the same amount', delta !== 0 && moved.every((v, i) => v - before[i] === delta || v === 0 || v === 127), { before, moved });
    const n = await key('NO');
    await touchDown(2, n.x, n.y); await p.waitForTimeout(90); await touchUp(2); await p.waitForTimeout(260);
    check('[NO] before [T2] is released takes it back', same(before, await vals(C)), { before, now: await vals(C) });
    await touchUp(1); await p.waitForTimeout(160);
    await dragKnob('t2_flt1_frq', 24);
    const alone = await vals(C);
    check('without a track key the knob moves its own track only', alone[1] !== before[1] && alone[0] === before[0] && alone[2] === before[2] && alone[3] === before[3], { before, alone });
    // ---- with a mouse: a latched key -----------------------------------------------------------
    const mctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const m = await mctx.newPage();
    m.on('pageerror', e => errs.push(String(e)));
    await m.addInitScript(() => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('synth-studio-welcomed', '1');
      localStorage.setItem('synth-studio-storage', JSON.stringify({ state: { currentDevice: 'analog-four', devices: {}, completedLessons: [] }, version: 3 }));
    });
    await m.goto(base, { waitUntil: 'networkidle' });
    await m.waitForFunction(() => !!window.__synthStudio, null, { timeout: 30000 });
    await m.waitForSelector('[data-control="key:FLTR"]', { timeout: 30000 });
    await m.waitForTimeout(1500);
    const mvals = keys => m.evaluate(ks => {
      const v = window.__synthStudio.store.getState().devices['analog-four']?.controlValues ?? {};
      return ks.map(k => v[k]);
    }, keys);
    const mkey = name => m.locator(`[data-control="key:${name}"]`);
    const held = name => mkey(name).getAttribute('data-held');
    const mkit = await mvals(F);
    await mkey('FLTR').click({ button: 'right' });
    await m.waitForTimeout(150);
    const isHeld = (await held('FLTR')) !== null;
    await mkey('YES').click(); await m.waitForTimeout(220);
    const mroll = await mvals(F);
    await mkey('NO').click(); await m.waitForTimeout(220);
    const mback = await mvals(F);
    await mkey('FLTR').click(); await m.waitForTimeout(150); // lets go
    const letGo = (await held('FLTR')) === null;
    await mkey('YES').click(); await m.waitForTimeout(220);
    const mafter = await mvals(F);
    check('mouse: a right-click holds [FLTR], [YES] rolls its page and [NO] reloads it', isHeld && !same(mkit, mroll) && same(mkit, mback), { isHeld, mkit, mroll, mback });
    check('mouse: a click lets the key go, and [YES] alone then changes nothing', letGo && same(mkit, mafter), { letGo, mafter });
    await mkey('AMP').click({ modifiers: ['Alt'] });
    await m.waitForTimeout(150);
    const altHeld = (await held('AMP')) !== null;
    await mkey('AMP').click({ modifiers: ['Alt'] });
    await m.waitForTimeout(150);
    check('mouse: Alt-click holds a key too, and lets it go', altHeld && (await held('AMP')) === null, { altHeld });
    await mctx.close();
  } catch (e) {
    check('ran to the end', false, String(e).split('\n')[0]);
  }
  await b.close();
  console.log(JSON.stringify({ ok: failed.length === 0 && errs.length === 0, failed, errs: errs.slice(0, 6), log }));
})();
