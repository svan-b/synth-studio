'use strict';
// ============================================================================
// Audio QA - flags, statistics and reports.
// evaluateDevice() turns measured presets into flags, category targets and
// gain suggestions; it is pure, so `--from <dir>` re-evaluates saved JSON
// reports with a new config without measuring again.
// ============================================================================

const fs = require('fs');
const path = require('path');

const FLAGS = {
  errors: 'console, page or render errors (processor errors, NaN/Inf, dropouts, failed run)',
  silent: 'whole render below the silence threshold',
  'true-peak': 'true peak above the ceiling at the instrument output',
  'stuck-tail': 'still sounding after stop and not decaying (a note, gate or drone left on)',
  'long-tail': 'still above the tail threshold after stop, but decaying (long release or FX tail)',
  clicks: 'clicks / discontinuities',
  dc: 'DC offset',
  loudness: 'loudness outlier against the category target',
};
const FLAG_ORDER = Object.keys(FLAGS);

const fin = v => typeof v === 'number' && Number.isFinite(v);
const round = (v, d = 2) => (fin(v) ? Math.round(v * 10 ** d) / 10 ** d : null);
const fx = (v, d = 1, inf = '-inf') => (fin(v) ? v.toFixed(d) : v === null || v === -Infinity ? inf : '-');
const signed = (v, d = 1) => (fin(v) ? `${v > 0 ? '+' : ''}${v.toFixed(d)}` : '-');

function median(values) {
  const v = values.filter(fin).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

function quantile(values, q) {
  const v = values.filter(fin).sort((a, b) => a - b);
  if (!v.length) return null;
  const pos = (v.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return v[lo] + (v[hi] - v[lo]) * (pos - lo);
}

function categoryOf(name) {
  const i = String(name).indexOf(' / ');
  return i > 0 ? String(name).slice(0, i).trim() : null;
}

function ruleFor(name, rules) {
  const cat = categoryOf(name);
  const text = cat || String(name);
  for (const r of rules || []) {
    let re;
    try { re = new RegExp(r.match, 'i'); } catch { continue; }
    if (re.test(text)) return r;
  }
  return null;
}

/** Round a metrics object for the JSON report (non-finite numbers become null) */
function compact(obj) {
  if (Array.isArray(obj)) return obj.map(compact);
  if (obj && typeof obj === 'object') {
    const o = {};
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'number') {
        const d = k === 'dc' || k === 'dcTail' ? 5 : k === 'correlation' ? 3 : k === 't' ? 4 : 2;
        o[k] = fin(v) ? round(v, d) : null;
      } else o[k] = compact(v);
    }
    return o;
  }
  return obj;
}

// ---------------------------------------------------------------------------
// Flags
// ---------------------------------------------------------------------------
function computeFlags(p, th) {
  const flags = [];
  const add = (id, detail, score) => flags.push({ id, detail, score: round(score, 1) });
  const errs = [];
  if (p.runError) errs.push(`run failed: ${p.runError}`);
  (p.errors || []).forEach(e => errs.push(`${e.kind}: ${e.message}`));
  const i = p.inst;
  if (i) {
    if (i.nonFinite) errs.push(`${i.nonFinite} NaN/Inf samples at the instrument output`);
    if (i.dropouts && i.dropouts.count) errs.push(`${i.dropouts.count} dropout(s) (runs of exact zeros inside the sound, first at ${i.dropouts.events[0].t} s, ${i.dropouts.events[0].ms} ms)`);
  }
  if (errs.length) add('errors', errs.slice(0, 6).join(' | ') + (errs.length > 6 ? ` | +${errs.length - 6} more` : ''), 100 + errs.length);
  if (!i) return flags;

  if (i.silent) add('silent', `peak ${fx(i.samplePeakDb)} dBFS over the whole render (threshold ${th.silentDbfs} dBFS)`, 90);
  if (fin(i.truePeakDb) && i.truePeakDb > th.truePeakDbtp) {
    const clip = i.clip && i.clip.samples ? `, ${i.clip.samples} samples at or above 0 dBFS in ${i.clip.events} overs` : '';
    add('true-peak', `${signed(i.truePeakDb)} dBTP (sample peak ${signed(i.samplePeakDb)} dBFS${clip}); ceiling ${th.truePeakDbtp} dBTP`, 50 + 8 * (i.truePeakDb - th.truePeakDbtp));
  }
  if (i.tail && fin(i.tail.peakDb) && i.tail.peakDb > th.tailDbfs && !(p.rule && p.rule.sustain)) {
    const rate = i.tail.decayDbPerSec;
    const ringing = fin(rate) && rate < th.ringingDbPerSec;
    if (ringing) add('long-tail', `${fx(i.tail.peakDb)} dBFS peak ${i.tail.afterSec} s after stop, still decaying at ${fx(rate)} dB/s (long release or FX tail)`, 20 + (i.tail.peakDb - th.tailDbfs) / 2);
    else add('stuck-tail', `${fx(i.tail.peakDb)} dBFS peak ${i.tail.afterSec} s after stop and not decaying (${fin(rate) ? signed(rate) + ' dB/s' : 'flat'}): a note, gate or drone is left on`, 45 + (i.tail.peakDb - th.tailDbfs));
  }
  if (i.clicks && i.clicks.count >= th.clicksMin) {
    const k = i.clicks.kinds;
    const kinds = ['mid', 'onset', 'cutoff'].filter(x => k[x]).map(x => `${k[x]} ${x}`).join(', ');
    const first = i.clicks.events[0];
    add('clicks', `${i.clicks.count} (${kinds}); worst step ${fx(i.clicks.worstJumpDb)} dBFS; first at ${first ? first.t : '?'} s`, 30 + 6 * Math.log2(i.clicks.count) + Math.max(0, (i.clicks.worstJumpDb + 50) / 2) + (k.mid ? 10 : 0));
  }
  const dc = Math.max(i.dc || 0, i.dcTail || 0);
  if (dc > th.dc) add('dc', `${dc.toFixed(4)} (${(i.dcTail || 0) > (i.dc || 0) ? 'in the tail, after release' : 'during the excitation'}; limit ${th.dc})`, 30 + 15 * Math.log2(dc / th.dc));
  if (!i.silent && fin(i.lufs) && fin(p.target)) {
    const d = i.lufs - p.target;
    if (Math.abs(d) > p.tolerance) add('loudness', `${fx(i.lufs)} LUFS is ${signed(d)} LU from the ${p.rule ? p.rule.name : 'device'} target ${fx(p.target)} LUFS (tolerance ${p.tolerance} LU)`, 20 + 3 * (Math.abs(d) - p.tolerance));
  }
  flags.sort((a, b) => FLAG_ORDER.indexOf(a.id) - FLAG_ORDER.indexOf(b.id));
  return flags;
}

/** Notes that do not gate: context for reviewers */
function computeNotes(p) {
  const n = [...(p.runNotes || [])];
  const i = p.inst;
  const m = p.master;
  if (i && fin(i.idlePeakDb) && i.idlePeakDb > -60) n.push(`already sounding before the excitation (idle peak ${fx(i.idlePeakDb)} dBFS)`);
  if (i && p.rule && p.rule.sustain && i.tail && fin(i.tail.peakDb) && i.tail.peakDb > -60) n.push(`keeps sounding after stop (${fx(i.tail.peakDb)} dBFS ${i.tail.afterSec} s later), allowed for the ${p.rule.name} category`);
  if (i && m && fin(i.lufs) && fin(m.lufs) && fin(i.truePeakDb) && fin(m.truePeakDb)) {
    const gain = m.lufs - i.lufs;
    const peakGain = m.truePeakDb - i.truePeakDb;
    if (peakGain < gain - 1) n.push(`master limiter reduced peaks by ${(gain - peakGain).toFixed(1)} dB`);
  }
  if (m && m.clip && m.clip.samples) n.push(`${m.clip.samples} samples at or above 0 dBFS at the master output`);
  if (i && fin(i.correlation) && i.correlation < -0.2) n.push(`L/R correlation ${i.correlation.toFixed(2)}: partly out of phase, collapses in mono`);
  return n;
}

// ---------------------------------------------------------------------------
// Device evaluation
// ---------------------------------------------------------------------------
function evaluateDevice(rep, cfg, opts = {}) {
  const dcfg = (cfg.devices && cfg.devices[rep.device.id]) || {};
  const th = { ...cfg.thresholds, ...(dcfg.thresholds || {}) };
  const rules = dcfg.categories || cfg.categories || [];
  rep.presets.forEach(p => {
    p.category = categoryOf(p.name) || '(none)';
    const r = ruleFor(p.name, rules);
    p.rule = r ? { name: r.name, offset: r.offset || 0, tolerance: r.tolerance ?? null, sustain: !!r.sustain } : null;
  });
  const measured = rep.presets.filter(p => p.inst && !p.inst.silent && fin(p.inst.lufs));
  const regular = measured.filter(p => !(p.rule && p.rule.offset));
  const pool = regular.length >= 3 ? regular : measured;
  const deviceMedian = median(pool.map(p => p.inst.lufs));
  const fixed = fin(dcfg.target) ? dcfg.target : fin(opts.target) ? opts.target : null;
  const reference = fixed ?? deviceMedian;

  rep.presets.forEach(p => {
    const offset = p.rule ? p.rule.offset : 0;
    p.target = fin(reference) ? round(reference + offset, 2) : null;
    p.tolerance = p.rule && p.rule.tolerance != null ? p.rule.tolerance : th.loudnessLu;
    p.flags = computeFlags(p, th);
    p.notes = computeNotes(p);
    const loud = p.flags.find(f => f.id === 'loudness');
    p.suggestion = loud ? suggestion(p, th) : null;
  });

  const all = measured.map(p => p.inst.lufs);
  const flagCounts = {};
  rep.presets.forEach(p => p.flags.forEach(f => { flagCounts[f.id] = (flagCounts[f.id] || 0) + 1; }));
  const tps = rep.presets.filter(p => p.inst && fin(p.inst.truePeakDb)).map(p => p.inst.truePeakDb);
  const setupErrors = (rep.setupErrors || []).length;
  rep.stats = {
    setupErrors,
    presets: rep.presets.length,
    measured: measured.length,
    silent: rep.presets.filter(p => p.inst && p.inst.silent).length,
    failed: rep.presets.filter(p => !p.inst).length,
    median: round(deviceMedian),
    reference: round(reference),
    referenceKind: fixed != null ? 'fixed target' : regular.length >= 3 ? `median of ${regular.length} presets without a category offset` : `median of all ${measured.length} measured presets`,
    min: all.length ? round(Math.min(...all)) : null,
    max: all.length ? round(Math.max(...all)) : null,
    spread: all.length ? round(Math.max(...all) - Math.min(...all)) : null,
    iqr: all.length ? round(quantile(all, 0.75) - quantile(all, 0.25)) : null,
    maxTruePeak: tps.length ? round(Math.max(...tps)) : null,
    medianTruePeak: round(median(tps)),
    masterOffset: round(median(rep.presets.filter(p => p.inst && p.master && fin(p.inst.lufs) && fin(p.master.lufs)).map(p => p.master.lufs - p.inst.lufs))),
    flagged: rep.presets.filter(p => p.flags.length).length,
    flagCounts,
    thresholds: th,
  };

  const cats = new Map();
  rep.presets.forEach(p => {
    if (!cats.has(p.category)) cats.set(p.category, []);
    cats.get(p.category).push(p);
  });
  rep.categories = [...cats.entries()].map(([name, ps]) => {
    const v = ps.filter(p => p.inst && !p.inst.silent && fin(p.inst.lufs)).map(p => p.inst.lufs);
    const rule = ps[0].rule;
    return {
      name, rule: rule ? rule.name : null, presets: ps.length, measured: v.length,
      target: ps[0].target, median: round(median(v)),
      min: v.length ? round(Math.min(...v)) : null, max: v.length ? round(Math.max(...v)) : null,
      spread: v.length ? round(Math.max(...v) - Math.min(...v)) : null,
      vsDevice: fin(deviceMedian) && v.length ? round(median(v) - deviceMedian) : null,
      flagged: ps.filter(p => p.flags.length).length,
    };
  });
  return rep;
}

function suggestion(p, th) {
  const gain = round(p.target - p.inst.lufs, 1);
  const tpAfter = fin(p.inst.truePeakDb) ? round(p.inst.truePeakDb + gain, 1) : null;
  return {
    gainDb: gain,
    truePeakAfter: tpAfter,
    warning: fin(tpAfter) && tpAfter > th.truePeakDbtp ? `true peak would reach ${signed(tpAfter)} dBTP: limit or compress, or accept a lower target` : null,
  };
}

// ---------------------------------------------------------------------------
// Markdown
// ---------------------------------------------------------------------------
const esc = s => String(s).replace(/\|/g, '\\|');

function flagSummary(counts) {
  const parts = FLAG_ORDER.filter(f => counts[f]).map(f => `${f} ${counts[f]}`);
  return parts.length ? parts.join(', ') : 'none';
}

function deviceMarkdown(rep) {
  const d = rep.device;
  const s = rep.stats;
  const r = rep.run;
  const L = [];
  L.push(`# Audio QA: ${d.name} (\`${d.id}\`)`);
  L.push('');
  L.push(`${d.manufacturer ? d.manufacturer + ' ' : ''}${d.name}, ${s.presets} presets. Excitation **${d.excitation.mode}** (${d.excitation.why}), ${r.options.seconds} s + ${r.options.tail} s tail, ${r.sampleRate} Hz. Instrument output: ${d.output}${d.output === 'mono' ? ' (measured as the stereo bus hears it: L = R)' : ''}.`);
  L.push('');
  L.push(`Run ${r.date} against ${r.baseUrl}${r.appCommit ? `, app code at \`${r.appCommit}\`` : ''}${r.commit && r.commit !== r.appCommit ? ` (tool at \`${r.commit}\`)` : ''}${r.buildId ? `, build \`${r.buildId}\`` : ''}, Chromium ${r.browser || '?'}.`);
  L.push('');
  L.push('| Median | Spread | IQR | Max true peak | Master vs instrument | Flagged |');
  L.push('|---|---|---|---|---|---|');
  L.push(`| ${fx(s.median)} LUFS | ${fx(s.spread)} LU (${fx(s.min)} to ${fx(s.max)}) | ${fx(s.iqr)} LU | ${signed(s.maxTruePeak)} dBTP | ${signed(s.masterOffset)} LU | ${s.flagged} of ${s.presets} |`);
  L.push('');
  L.push(`Flags: ${flagSummary(s.flagCounts)}. Loudness reference: ${fx(s.reference)} LUFS (${s.referenceKind}).`);
  L.push('');
  if (s.setupErrors) {
    L.push(`**Errors while the app loaded this instrument (${s.setupErrors}):**`);
    L.push('');
    rep.setupErrors.forEach(e => L.push(`- ${e.kind}: ${esc(e.message)}`));
    L.push('');
  }

  L.push('## Presets by loudness');
  L.push('');
  L.push('| # | Preset | Category | LUFS | vs target | ST max | TP dBTP | Peak dBFS | Clip | DC | Crest dB | Clicks | Tail dBFS | Corr | Master LUFS | Flags |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  const sorted = [...rep.presets].sort((a, b) => {
    const la = a.inst && fin(a.inst.lufs) ? a.inst.lufs : -1e9;
    const lb = b.inst && fin(b.inst.lufs) ? b.inst.lufs : -1e9;
    return lb - la;
  });
  sorted.forEach((p, idx) => {
    const i = p.inst;
    const m = p.master;
    const flags = p.flags.map(f => f.id).join(', ') || 'ok';
    const label = `${esc(p.name)}${p.cables ? ` · ${p.cables} cable${p.cables > 1 ? 's' : ''}` : ''}`;
    if (!i) {
      L.push(`| ${idx + 1} | ${label} | ${esc(p.category)} | - | - | - | - | - | - | - | - | - | - | - | - | ${flags} |`);
      return;
    }
    const vs = fin(i.lufs) && fin(p.target) ? signed(i.lufs - p.target) : '-';
    const corr = d.output === 'mono' ? 'mono' : fx(i.correlation, 2, '-');
    L.push(`| ${idx + 1} | ${label} | ${esc(p.category)} | ${fx(i.lufs)} | ${vs} | ${fx(i.maxShortTermLufs)} | ${signed(i.truePeakDb)} | ${signed(i.samplePeakDb)} | ${i.clip ? i.clip.samples : '-'} | ${fin(Math.max(i.dc || 0, i.dcTail || 0)) ? Math.max(i.dc || 0, i.dcTail || 0).toFixed(4) : '-'} | ${fx(i.crestDb)} | ${i.clicks ? i.clicks.count : '-'} | ${i.tail ? fx(i.tail.peakDb) : '-'} | ${corr} | ${m ? fx(m.lufs) : 'n/a'} | ${flags} |`);
  });
  L.push('');

  L.push('## Categories');
  L.push('');
  L.push('| Category | Rule | Presets | Target LUFS | Median | Min | Max | Spread LU | vs device | Flagged |');
  L.push('|---|---|---|---|---|---|---|---|---|---|');
  rep.categories.forEach(c => {
    L.push(`| ${esc(c.name)} | ${c.rule || '-'} | ${c.presets} | ${fx(c.target)} | ${fx(c.median)} | ${fx(c.min)} | ${fx(c.max)} | ${fx(c.spread)} | ${signed(c.vsDevice)} | ${c.flagged} |`);
  });
  L.push('');

  const flagged = rep.presets.filter(p => p.flags.length || p.notes.length);
  L.push('## Flag details');
  L.push('');
  if (!flagged.length) L.push('No flags.');
  flagged.forEach(p => {
    L.push(`- **${esc(p.name)}** (\`${p.key}\`)`);
    p.flags.forEach(f => L.push(`  - ${f.id}: ${f.detail}`));
    p.notes.forEach(n => L.push(`  - note: ${n}`));
  });
  L.push('');

  const sugg = rep.presets.filter(p => p.suggestion);
  L.push('## Suggested gain changes');
  L.push('');
  if (!sugg.length) L.push('No loudness outliers.');
  else {
    L.push('Gain that would bring each loudness outlier to its category target. Nothing was edited: apply it with the preset\'s own level controls.');
    L.push('');
    L.push('| Preset | Category | LUFS | Target | Change | True peak after |');
    L.push('|---|---|---|---|---|---|');
    sugg.sort((a, b) => Math.abs(b.suggestion.gainDb) - Math.abs(a.suggestion.gainDb)).forEach(p => {
      L.push(`| ${esc(p.name)} | ${esc(p.category)} | ${fx(p.inst.lufs)} | ${fx(p.target)} | ${signed(p.suggestion.gainDb)} dB | ${signed(p.suggestion.truePeakAfter)} dBTP${p.suggestion.warning ? ' (over the ceiling)' : ''} |`);
    });
  }
  L.push('');

  const o = r.options;
  L.push('## Method');
  L.push('');
  L.push(`- Each preset is applied through the instrument's preset menu, exactly as a user picks it (${rep.presets.filter(p => p.appliedVia === 'ui').length} of ${s.presets} via the menu${rep.presets.some(p => p.appliedVia === 'store-fallback') ? '; the rest by replicating DeviceHost.applyPreset' : ''}), with the device as the only rack instrument. Between presets: stop all, all notes off, cables cleared, wait for silence.`);
  L.push(`- Taps: the hub slot's \`outGain\` (the instrument's own output, before the master) and every node feeding the AudioDestination (the master, after its limiter), both through one AudioWorklet capture node.`);
  if (d.excitation.mode === 'keys') L.push(`- Excitation: notes ${o.phrase.notes.join(', ')} (C2 C3 G3 C4), ${o.phrase.gate * 1000} ms each every ${o.phrase.step * 1000} ms, then ${o.phrase.hold.note} held from ${o.phrase.hold.at} s to ${o.seconds} s, velocity ${o.velocity}.`);
  if (d.excitation.mode === 'transport') L.push(`- Excitation: the studio Play (hub.startAll) for ${o.seconds} s at ${o.bpm} BPM, then Stop (hub.stopAll).`);
  if (d.excitation.mode === 'audition') L.push(`- Excitation: hub.audition() for ${o.seconds} s, then hub.stopAudition().`);
  L.push(`- Loudness: ITU-R BS.1770-4 integrated (gated), max short-term (3 s). True peak: BS.1770-4 Annex 2, 4x oversampled. DC over the excitation window and the last 0.5 s. Crest factor over the excitation window. Clicks: isolated sample-difference spikes (see docs/AUDIO_QA.md). Tail: peak from ${s.thresholds.tailAfterSec} s after stop to the end of the capture.`);
  L.push(`- Thresholds: silent < ${s.thresholds.silentDbfs} dBFS, true peak > ${s.thresholds.truePeakDbtp} dBTP, |DC| > ${s.thresholds.dc}, tail > ${s.thresholds.tailDbfs} dBFS, loudness > ${s.thresholds.loudnessLu} LU from the category target.`);
  L.push('');
  return L.join('\n');
}

// ---------------------------------------------------------------------------
// Summary across devices
// ---------------------------------------------------------------------------
function loadDeviceReports(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => { try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { return null; } })
    .filter(r => r && r.kind === 'audio-qa-device');
}

function topProblems(reports, n = 20) {
  const all = [];
  reports.forEach(rep => (rep.setupErrors || []).slice(0, 3).forEach(e => {
    all.push({ device: rep.device.id, preset: '(loading the instrument)', key: null, flag: 'errors', detail: `${e.kind}: ${e.message}`, score: 110 });
  }));
  reports.forEach(rep => rep.presets.forEach(p => p.flags.forEach(f => {
    all.push({ device: rep.device.id, preset: p.name, key: p.key, flag: f.id, detail: f.detail, score: f.score });
  })));
  return all.sort((a, b) => b.score - a.score).slice(0, n);
}

function summaryOf(reports, extra = {}) {
  const order = extra.order || [];
  const rank = id => (order.indexOf(id) < 0 ? 1e6 : order.indexOf(id));
  reports = [...reports].sort((a, b) => rank(a.device.id) - rank(b.device.id) || a.device.id.localeCompare(b.device.id));
  const devices = reports.map(rep => ({
    id: rep.device.id, name: rep.device.name, presets: rep.stats.presets, excitation: rep.device.excitation.mode,
    output: rep.device.output, median: rep.stats.median, spread: rep.stats.spread, iqr: rep.stats.iqr,
    min: rep.stats.min, max: rep.stats.max, maxTruePeak: rep.stats.maxTruePeak, masterOffset: rep.stats.masterOffset,
    flagged: rep.stats.flagged, flagCounts: rep.stats.flagCounts, setupErrors: rep.stats.setupErrors || 0, date: rep.run.date,
  }));
  const studioMedian = median(devices.map(d => d.median));
  devices.forEach(d => { d.vsStudio = fin(studioMedian) && fin(d.median) ? round(d.median - studioMedian) : null; });
  const totals = {};
  devices.forEach(d => Object.entries(d.flagCounts).forEach(([k, v]) => { totals[k] = (totals[k] || 0) + v; }));
  return {
    kind: 'audio-qa-summary',
    generated: new Date().toISOString(),
    devices,
    studioMedian: round(studioMedian),
    presets: devices.reduce((s, d) => s + d.presets, 0),
    flagged: devices.reduce((s, d) => s + d.flagged, 0),
    flagTotals: totals,
    top: topProblems(reports),
    calibration: extra.calibration || null,
    skipped: extra.skipped || [],
  };
}

function summaryMarkdown(sum, reports) {
  const L = [];
  const pos = new Map(sum.devices.map((d, i) => [d.id, i]));
  reports = [...reports].sort((a, b) => (pos.get(a.device.id) ?? 1e6) - (pos.get(b.device.id) ?? 1e6));
  L.push('# Audio QA: all devices');
  L.push('');
  const runs = [...new Set(reports.map(r => `${r.run.baseUrl}${r.run.appCommit || r.run.commit ? `, app code at \`${r.run.appCommit || r.run.commit}\`` : ''}`))];
  L.push(`${sum.devices.length} devices, ${sum.presets} presets, ${sum.flagged} flagged. Measured against ${runs.join('; ')}. Generated ${sum.generated}.`);
  const loadErr = sum.devices.filter(d => d.setupErrors);
  if (loadErr.length) {
    L.push('');
    L.push(`Errors while loading: ${loadErr.map(d => `${d.id} (${d.setupErrors})`).join(', ')}. See the device reports.`);
  }
  L.push('');
  if (sum.calibration) {
    L.push('## Meter calibration');
    L.push('');
    L.push(calibrationMarkdown(sum.calibration));
    L.push('');
  }
  L.push('## Devices');
  L.push('');
  L.push(`| Device | Presets | Excitation | Output | Median LUFS | vs studio | Spread LU | IQR | Max TP dBTP | Master vs inst | Flagged | ${FLAG_ORDER.join(' | ')} |`);
  L.push(`|---|---|---|---|---|---|---|---|---|---|---|${FLAG_ORDER.map(() => '---').join('|')}|`);
  sum.devices.forEach(d => {
    L.push(`| [${esc(d.name)}](${d.id}.md) | ${d.presets} | ${d.excitation} | ${d.output} | ${fx(d.median)} | ${signed(d.vsStudio)} | ${fx(d.spread)} | ${fx(d.iqr)} | ${signed(d.maxTruePeak)} | ${signed(d.masterOffset)} | ${d.flagged} | ${FLAG_ORDER.map(f => d.flagCounts[f] || 0).join(' | ')} |`);
  });
  L.push('');
  L.push(`Studio median (median of the device medians): ${fx(sum.studioMedian)} LUFS. "vs studio" is how far each instrument's typical preset sits from it at the instrument output; "Master vs inst" is the level change through the master bus at that loudness.`);
  L.push('');
  L.push('## Worst problems');
  L.push('');
  L.push('Ranked by severity (render errors, silence, true-peak overs and stuck notes first).');
  L.push('');
  sum.top.forEach((t, i) => L.push(`${i + 1}. **${t.device} / ${esc(t.preset)}**: ${t.flag}: ${t.detail}`));
  if (!sum.top.length) L.push('None.');
  L.push('');
  if (sum.skipped && sum.skipped.length) {
    L.push('## Not measured');
    L.push('');
    sum.skipped.forEach(s => L.push(`- \`${s.id}\`: ${s.why}`));
    L.push('');
  }
  return L.join('\n');
}

function calibrationMarkdown(cal) {
  const L = [];
  L.push(`Test signals injected into the instrument tap (the slot's outGain, ${cal.device}) and measured through the same capture as the presets, ${cal.sampleRate} Hz.`);
  L.push('');
  L.push('| Test | Measured | Expected | Result |');
  L.push('|---|---|---|---|');
  cal.tests.forEach(t => L.push(`| ${esc(t.name)} | ${esc(t.measured)} | ${esc(t.expected)} | ${t.ok ? 'pass' : '**FAIL**'} |`));
  if (cal.master) {
    L.push('');
    L.push(`Master output during the one-channel reference: ${cal.master}.`);
  }
  return L.join('\n');
}

module.exports = {
  FLAGS, FLAG_ORDER, computeFlags, evaluateDevice, ruleFor, deviceMarkdown, summaryOf, summaryMarkdown, calibrationMarkdown,
  loadDeviceReports, topProblems, compact, categoryOf, median, fx, signed, round, fin,
};
