// ============================================================================
// Analog Rytm: a key held with the mouse, and with a finger.
//   node scripts/e2e/rytm-hold.cjs <baseUrl>
//
// The hardware's two-key moves need one key held while another is pressed. A touch
// screen has two fingers. A mouse has one pointer, so a right-click (or Alt-click) on a
// key keeps it down, and any click on it lets it go (`Key` in devices/analog-rytm/ui.tsx).
//
//   mouse   [YES] held by a right-click + [FLTR] rolls the FILTER page; a click lets [YES]
//           go; [NO] held + [FLTR] puts the page back as the kit has it; with nothing held
//           [FLTR] only opens its page
//   touch   [YES] held by one finger + [FLTR] with another rolls the page, [NO] + [FLTR]
//           reloads it (manual: PARAMETER page random and reload)
// Prints one JSON object; scripts/e2e/run.cjs checks `ok`.
// ============================================================================
const { chromium } = require('playwright');

const F = ['bd_flt_atk', 'bd_flt_dec', 'bd_flt_sus', 'bd_flt_rel', 'bd_flt_frq', 'bd_flt_res', 'bd_flt_typ', 'bd_flt_env'];

(async () => {
  const [, , base = 'http://localhost:3100'] = process.argv;
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const errs = [];
  const log = {};
  const failed = [];
  const check = (name, ok, detail) => { log[name] = ok ? true : detail ?? false; if (!ok) failed.push(name); };
  const same = (a, c) => a.length === c.length && a.every((x, i) => x === c[i]);
  const open = async options => {
    const ctx = await b.newContext({ deviceScaleFactor: 1, ...options });
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(String(e)));
    await p.addInitScript(() => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('synth-studio-welcomed', '1');
      localStorage.setItem('synth-studio-storage', JSON.stringify({ state: { currentDevice: 'analog-rytm', devices: {}, completedLessons: [] }, version: 3 }));
    });
    await p.goto(base, { waitUntil: 'networkidle' });
    await p.waitForFunction(() => !!window.__synthStudio, null, { timeout: 30000 });
    await p.waitForSelector('[data-control="key:fltr"]', { timeout: 30000 });
    await p.waitForTimeout(1500);
    return { ctx, p };
  };
  /** The BD track's FILTER page as the engine has it: the stored values over the spec's defaults */
  const vals = p => p.evaluate(ks => {
    const { store, hub } = window.__synthStudio;
    const spec = hub.getModule('analog-rytm').spec;
    const v = store.getState().devices['analog-rytm']?.controlValues ?? {};
    return ks.map(k => v[k] ?? spec.controls[k].default);
  }, F);

  try {
    // ---- mouse ---------------------------------------------------------------------------
    {
      const { ctx, p } = await open({ viewport: { width: 1440, height: 900 } });
      const key = n => p.locator(`[data-control="key:${n}"]`);
      const held = async n => (await key(n).getAttribute('data-held')) !== null;
      const kit = await vals(p);
      await key('yes').click({ button: 'right' }); await p.waitForTimeout(150);
      const yesHeld = await held('yes');
      await key('fltr').click(); await p.waitForTimeout(250);
      const rolled = await vals(p);
      await key('yes').click(); await p.waitForTimeout(150);
      const yesGone = !(await held('yes'));
      check('mouse: a right-click holds [YES], [FLTR] then rolls the FILTER page, a click lets [YES] go', yesHeld && !same(kit, rolled) && yesGone, { yesHeld, yesGone, kit, rolled });
      await key('no').click({ modifiers: ['Alt'] }); await p.waitForTimeout(150);
      const noHeld = await held('no');
      await key('fltr').click(); await p.waitForTimeout(250);
      const back = await vals(p);
      await key('no').click(); await p.waitForTimeout(150);
      check('mouse: Alt-click holds [NO], [FLTR] then puts the page back as the kit has it', noHeld && same(kit, back) && !(await held('no')), { noHeld, kit, back });
      await key('fltr').click(); await p.waitForTimeout(250);
      check('mouse: with nothing held [FLTR] changes no value', same(kit, await vals(p)), await vals(p));
      await ctx.close();
    }
    // ---- touch: two fingers -------------------------------------------------------------------
    {
      const { ctx, p } = await open({ viewport: { width: 1180, height: 820 }, hasTouch: true });
      const cdp = await ctx.newCDPSession(p);
      const down = new Map();
      const points = () => [...down].map(([id, q]) => ({ id, x: q.x, y: q.y, radiusX: 6, radiusY: 6, force: 1 }));
      const touchDown = async (id, x, y) => { down.set(id, { x, y }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points() }); };
      const touchUp = async id => { const q = down.get(id); down.delete(id); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ id, x: q.x, y: q.y }] }); };
      const centre = async n => {
        const el = p.locator(`[data-control="key:${n}"]`).first();
        await el.scrollIntoViewIfNeeded();
        const r = await el.boundingBox();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      };
      const holdAndTap = async (heldKey, tapped) => {
        const h = await centre(heldKey);
        await touchDown(1, h.x, h.y); await p.waitForTimeout(160);
        const t = await centre(tapped);
        await touchDown(2, t.x, t.y); await p.waitForTimeout(90); await touchUp(2); await p.waitForTimeout(250);
        await touchUp(1); await p.waitForTimeout(160);
      };
      const kit = await vals(p);
      await holdAndTap('yes', 'fltr');
      const rolled = await vals(p);
      await holdAndTap('no', 'fltr');
      const back = await vals(p);
      check('touch: [YES] + [FLTR] rolls the FILTER page and [NO] + [FLTR] reloads it', !same(kit, rolled) && same(kit, back), { kit, rolled, back });
      await ctx.close();
    }
  } catch (e) {
    check('ran to the end', false, String(e).split('\n')[0]);
  }
  await b.close();
  console.log(JSON.stringify({ ok: failed.length === 0 && errs.length === 0, failed, errs: errs.slice(0, 6), log }));
})();
