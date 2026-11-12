// ============================================================================
// Analog Rytm full-track features:  npx tsx scripts/test-rytm.ts
//
// The pure parts of live recording (devices/analog-rytm/live.ts), the Sound
// pool (pool.ts), the Euclidean sequencer (euclid.ts) and the WAV / AIFF
// readers of the user samples (samples.ts). Exits non-zero on failure.
// ============================================================================

import { LOCK_LIMIT_RYTM, NOTE_LENGTHS, createProject, getPattern, getStep, setLock, setStep, toggleTrig, trigSteps, updatePatternSettings } from '../lib/sequencer/elektron';
import { eraseLocks, eraseTrigs, lenIndexOf, recordHit, recordHitLength, recordLock, stepsBetween } from '../devices/analog-rytm/live';
import { bjorklund, euclidRefused, euclidSteps, euclidView, euclidWriteBack, setEuclid } from '../devices/analog-rytm/euclid';
import { captureSound, cleanPool, setSoundLock, soundControls, soundFits, soundLockMap, withSound } from '../devices/analog-rytm/pool';
import { cleanSampleMap, decodeAudioFile, sampleId, sampleName } from '../devices/analog-rytm/samples';
import { M, TRACKS } from '../devices/analog-rytm/model';
import { ANALOG_RYTM } from '../devices/analog-rytm/spec';

let fails = 0, passes = 0;
const ok = (c: boolean, m: string) => { if (c) passes++; else { fails++; console.log('FAIL', m); } };
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const str = (b: boolean[]) => b.map(x => (x ? 'x' : '.')).join('');

// ---- live recording (manual pp.40-41, 47) ------------------------------------
function live() {
  ok(eq(stepsBetween(2, 5, 16), [3, 4]) && eq(stepsBetween(14, 1, 16), [15, 0]) && eq(stepsBetween(3, 3, 16), []), 'stepsBetween');
  ok(NOTE_LENGTHS[lenIndexOf(1)] === 1 && NOTE_LENGTHS[lenIndexOf(2)] === 2 && lenIndexOf(1000) === 127, 'lenIndexOf');
  let p = createProject({ tracks: 13, defaults: { note: 60, vel: 100 } });
  p = recordLock(p, { pattern: 'A01', track: 8, step: 3, key: 'flt_frq', value: 80 }, LOCK_LIMIT_RYTM);
  ok(eq(getStep(p, 'A01', 8, 3), { trigless: true, locks: { flt_frq: 80 } }), 'a turn on an empty step places a lock trig');
  p = recordHit(p, { pattern: 'A01', track: 8, step: 3, micro: -4, vel: 90, note: 63 });
  ok(eq(getStep(p, 'A01', 8, 3), { locks: { flt_frq: 80 }, vel: 90, micro: -4, note: 63 }), 'a hit keeps the locks and records note, micro, velocity');
  p = recordHitLength(p, { pattern: 'A01', track: 8, step: 3, len: 30 });
  ok(getStep(p, 'A01', 8, 3)?.len === 30, 'the press length');
  p = recordHitLength(p, { pattern: 'A01', track: 8, step: 3, len: 14 });
  ok(getStep(p, 'A01', 8, 3)?.len === undefined, 'the track LEN is not stored');
  p = recordLock(p, { pattern: 'A01', track: 8, step: 7, key: 'flt_frq', value: 60, fill: { steps: [4, 5, 6], value: 70 } }, LOCK_LIMIT_RYTM);
  ok([4, 5, 6].every(s => getStep(p, 'A01', 8, s)?.locks?.flt_frq === 70) && getStep(p, 'A01', 8, 7)?.locks?.flt_frq === 60, 'the steps between turns');
  p = recordLock(p, { pattern: 'A01', track: 8, step: 3, key: 'sound', value: 2 }, LOCK_LIMIT_RYTM);
  p = eraseLocks(p, 'A01', 8, [3, 4], null);
  ok(eq(getStep(p, 'A01', 8, 3)?.locks, { sound: 2 }) && getStep(p, 'A01', 8, 4) === undefined, '[FUNC] + [NO]: locks go, the sound lock stays');
  p = recordLock(p, { pattern: 'A01', track: 8, step: 5, key: 'amp_dec', value: 30 }, LOCK_LIMIT_RYTM);
  p = eraseLocks(p, 'A01', 8, [5], 'flt_frq');
  ok(eq(getStep(p, 'A01', 8, 5), { trigless: true, locks: { amp_dec: 30 } }), '[NO] + an encoder: that parameter only');
  p = eraseTrigs(p, 'A01', 8, [3, 5, 6]);
  ok(eq(getStep(p, 'A01', 8, 3), { trigless: true, locks: { sound: 2 } }) && getStep(p, 'A01', 8, 5) === undefined, '[NO] + pads: trigs go, the sound lock stays');
  p = recordHit(p, { pattern: 'A01', track: 8, step: 3, micro: 0, vel: 100 });
  ok(eq(getStep(p, 'A01', 8, 3), { locks: { sound: 2 }, vel: 100 }), 'a hit on a kept sound lock gets it back');
  p = recordHit(p, { pattern: 'A01', track: 1, step: 0, micro: 0, vel: 100, retrig: { rate: 12, len: 14, vel: -64 } });
  p = recordHitLength(p, { pattern: 'A01', track: 1, step: 0, len: 46, retrig: true });
  ok(eq(getStep(p, 'A01', 1, 0)?.retrig, { rate: 12, len: 46, vel: -64 }), 'a recorded roll');
  let q = createProject({ tracks: 13 });
  for (let i = 0; i < 80; i++) q = recordLock(q, { pattern: 'A01', track: i % 12, step: i % 16, key: `k${i}`, value: 1 }, LOCK_LIMIT_RYTM);
  let n = 0; for (const t of q.patterns.A01.tracks) for (const s of Object.values(t.steps)) n += Object.keys(s.locks ?? {}).length;
  ok(n === 72, `the 72-parameter lock limit (${n})`);
}

// ---- Euclidean sequencer (manual p.44) ----------------------------------------
function euclid() {
  ok(str(bjorklund(3, 8)) === 'x..x..x.' && str(bjorklund(5, 8)) === 'x.xx.xx.' && str(bjorklund(7, 16)) === 'x..x.x.x..x.x.x.', 'Bjorklund rhythms');
  ok(str(bjorklund(4, 16)) === 'x...x...x...x...' && str(bjorklund(0, 8)) === '........' && str(bjorklund(8, 8)) === 'xxxxxxxx', 'even and edge cases');
  const E = (o: object) => ({ pl1: 4, pl2: 0, ro1: 0, ro2: 0, tro: 0, op: 0, ...o });
  ok(eq(euclidSteps(E({}), 16), [0, 4, 8, 12]) && eq(euclidSteps(E({ ro1: 2 }), 16), [2, 6, 10, 14]) && eq(euclidSteps(E({ tro: -1 }), 16), [3, 7, 11, 15]), 'rotations');
  ok(eq(euclidSteps(E({ pl2: 3 }), 8), [0, 2, 3, 4, 6]) && eq(euclidSteps(E({ pl2: 3, op: 1 }), 8), [2, 3, 4])
    && eq(euclidSteps(E({ pl2: 3, op: 2 }), 8), [0, 6]) && eq(euclidSteps(E({ pl2: 3, op: 3 }), 8), [2, 4]), 'OR, XOR, AND, SUB');
  let p = createProject({ tracks: 13, defaults: { note: 60, vel: 100 } });
  p = toggleTrig(p, 'A01', 0, 1);
  p = setStep(p, 'A01', 0, 4, { vel: 50, locks: { dec: 99 } });
  ok(euclidView(p) === p, 'no Euclidean track: the view is the project');
  p = setEuclid(p, 'A01', 0, { on: true });
  const v = euclidView(p);
  ok(v !== p && euclidView(p) === v, 'the view is cached');
  ok(eq(trigSteps(v, 'A01', 0), [0, 4, 8, 12]) && eq(trigSteps(p, 'A01', 0), [1, 4]), 'generated trigs play, the own ones are kept hidden');
  ok(eq(getStep(v, 'A01', 0, 4), { vel: 50, locks: { dec: 99 } }), 'a generated trig on an own trig plays it');
  const back = euclidWriteBack(p, setLock(v, 'A01', 0, [8], 'flt_frq', 70, { limit: LOCK_LIMIT_RYTM }));
  ok(eq(getPattern(back, 'A01').tracks[0].steps, getPattern(p, 'A01').tracks[0].steps) && getStep(euclidView(back), 'A01', 0, 8)?.locks?.flt_frq === 70, 'a lock on a generated trig goes to euc.steps');
  for (const s of [2, 0]) {
    const next = toggleTrig(euclidView(back), 'A01', 0, s);
    ok(euclidRefused(back, next) && eq(trigSteps(euclidView(euclidWriteBack(back, next)), 'A01', 0), [0, 4, 8, 12]), `adding or removing a trig is refused (${s})`);
  }
  const other = updatePatternSettings(toggleTrig(euclidView(back), 'A01', 1, 3), 'A01', { swing: 60 });
  const b2 = euclidWriteBack(back, other);
  ok(eq(trigSteps(b2, 'A01', 1), [3]) && getPattern(b2, 'A01').swing === 60 && !euclidRefused(back, other), 'other edits pass');
  const off = setEuclid(back, 'A01', 0, { on: false });
  ok(eq(trigSteps(off, 'A01', 0), [1, 4, 8]) && euclidView(off) === off, 'EUC off: the own trigs and the edited ones');
  const conv = setEuclid(back, 'A01', 0, { on: false }, { convert: true });
  ok(eq(trigSteps(conv, 'A01', 0), [0, 4, 8, 12]) && getStep(conv, 'A01', 0, 4)?.vel === 50, '[FUNC] + EUC off keeps the generated trigs');
}

// ---- Sound pool (manual pp.26, 48) --------------------------------------------
function pool() {
  const values: Record<string, number> = {};
  for (const [id, c] of Object.entries(ANALOG_RYTM.controls)) if ('default' in c && typeof c.default === 'number') values[id] = c.default;
  values.bd_dec = 99; values.bd_flt_frq = 70;
  const snd = captureSound(values, 0);
  ok(snd.machine === M.BD_HARD && snd.values.dec === 99 && snd.values.flt_frq === 70 && snd.name === 'BD HARD', 'a captured Sound');
  ok(soundFits(snd, 1) && soundFits(snd, 3) && !soundFits(snd, 8), 'BD HARD fits BD, SD, RS / CP, not the hats');
  const vals = soundControls(snd, 1);
  ok(vals.sd_machine === TRACKS[1].machines.indexOf(M.BD_HARD) && vals.sd_dec === 99, 'loaded to another track');
  const m = soundLockMap(snd);
  ok(m[20] === 70 && Object.keys(m).length >= 30, 'the Sound as worklet locks');
  const list = withSound(withSound(undefined, 2, snd), 0, snd);
  ok(list.length === 3 && list[1] === null && eq(cleanPool(JSON.parse(JSON.stringify(list))), list), 'pool slots survive a save');
  let p = createProject({ tracks: 13 });
  p = toggleTrig(p, 'A01', 1, 0);
  p = setStep(p, 'A01', 1, 2, { trigless: true, locks: { amp_vol: 1 } });
  p = setSoundLock(p, 'A01', 1, [0, 2, 5], 3, list);
  ok(getStep(p, 'A01', 1, 0)?.locks?.sound === 3 && !getStep(p, 'A01', 1, 2)?.locks?.sound && !getStep(p, 'A01', 1, 5), 'sound locks go on note trigs only');
  ok(setSoundLock(p, 'A01', 8, [0], 3, list) === p, 'not on a track that can\'t run it');
  p = setSoundLock(p, 'A01', 1, [0], 0, list);
  ok(!getStep(p, 'A01', 1, 0)?.locks?.sound, 'TRACK SOUND removes it');
}

// ---- WAV and AIFF readers ------------------------------------------------------
const N = 1000, RATE = 44100;
const sig = (i: number, c: number) => Math.sin(i * 0.05 + c) * 0.5;
function wav(bits: number, channels: number, float = false, extensible = false): ArrayBuffer {
  const bytes = bits / 8, dataLen = N * channels * bytes, fmtLen = extensible ? 40 : 16;
  const buf = new ArrayBuffer(20 + 8 + fmtLen + 8 + dataLen);
  const dv = new DataView(buf);
  const w4 = (at: number, s: string) => { for (let i = 0; i < 4; i++) dv.setUint8(at + i, s.charCodeAt(i)); };
  w4(0, 'RIFF'); dv.setUint32(4, buf.byteLength - 8, true); w4(8, 'WAVE'); w4(12, 'LIST'); dv.setUint32(16, 0, true);
  let at = 20;
  w4(at, 'fmt '); dv.setUint32(at + 4, fmtLen, true); dv.setUint16(at + 8, extensible ? 0xfffe : float ? 3 : 1, true);
  dv.setUint16(at + 10, channels, true); dv.setUint32(at + 12, RATE, true); dv.setUint32(at + 16, RATE * channels * bytes, true);
  dv.setUint16(at + 20, channels * bytes, true); dv.setUint16(at + 22, bits, true);
  if (extensible) { dv.setUint16(at + 24, 22, true); dv.setUint16(at + 26, bits, true); dv.setUint16(at + 32, float ? 3 : 1, true); }
  at += 8 + fmtLen;
  w4(at, 'data'); dv.setUint32(at + 4, dataLen, true); at += 8;
  for (let i = 0; i < N; i++) for (let c = 0; c < channels; c++) {
    const x = sig(i, c), o = at + (i * channels + c) * bytes;
    if (float) dv.setFloat32(o, x, true);
    else if (bits === 16) dv.setInt16(o, Math.round(x * 32767), true);
    else if (bits === 24) { const v = Math.round(x * 8388607); dv.setUint8(o, v & 255); dv.setUint8(o + 1, (v >> 8) & 255); dv.setUint8(o + 2, (v >> 16) & 255); }
    else dv.setUint8(o, Math.round(x * 127) + 128);
  }
  return buf;
}
function aiff(bits: number, channels: number, comp: 'sowt' | 'fl32' | null): ArrayBuffer {
  const bytes = comp === 'fl32' ? 4 : bits / 8, dataLen = N * channels * bytes, commLen = comp ? 24 : 18;
  const buf = new ArrayBuffer(12 + 8 + commLen + 16 + dataLen);
  const dv = new DataView(buf);
  const w4 = (at: number, s: string) => { for (let i = 0; i < 4; i++) dv.setUint8(at + i, s.charCodeAt(i)); };
  w4(0, 'FORM'); dv.setUint32(4, buf.byteLength - 8); w4(8, comp ? 'AIFC' : 'AIFF');
  let at = 12;
  w4(at, 'COMM'); dv.setUint32(at + 4, commLen); dv.setInt16(at + 8, channels); dv.setUint32(at + 10, N); dv.setInt16(at + 14, comp === 'fl32' ? 32 : bits);
  // 44100 Hz as an 80-bit extended float
  dv.setUint16(at + 16, 16383 + 15); dv.setUint32(at + 18, 44100 * 2 ** 16); dv.setUint32(at + 22, 0);
  if (comp) w4(at + 26, comp);
  at += 8 + commLen;
  w4(at, 'SSND'); dv.setUint32(at + 4, 8 + dataLen); at += 16;
  for (let i = 0; i < N; i++) for (let c = 0; c < channels; c++) {
    const x = sig(i, c), o = at + (i * channels + c) * bytes;
    if (comp === 'fl32') dv.setFloat32(o, x);
    else if (bits === 16) dv.setInt16(o, Math.round(x * 32767), comp === 'sowt');
    else { const v = Math.round(x * 8388607); dv.setUint8(o, (v >> 16) & 255); dv.setUint8(o + 1, (v >> 8) & 255); dv.setUint8(o + 2, v & 255); }
  }
  return buf;
}
async function samples() {
  const cases: [string, ArrayBuffer, number, number][] = [
    ['WAV 16-bit stereo', wav(16, 2), 2, 1e-4], ['WAV 24-bit', wav(24, 1), 1, 1e-6], ['WAV 8-bit', wav(8, 1), 1, 1e-2],
    ['WAV float', wav(32, 2, true), 2, 1e-7], ['WAV extensible', wav(16, 2, false, true), 2, 1e-4],
    ['AIFF 16-bit stereo', aiff(16, 2, null), 2, 1e-4], ['AIFF 24-bit', aiff(24, 1, null), 1, 1e-6],
    ['AIFC sowt', aiff(16, 1, 'sowt'), 1, 1e-4], ['AIFC fl32', aiff(32, 2, 'fl32'), 2, 1e-7],
  ];
  for (const [name, b, ch, tol] of cases) {
    const d = await decodeAudioFile(b);
    let err = 0;
    for (let i = 0; i < N; i++) { let m = 0; for (let c = 0; c < ch; c++) m += sig(i, c); err = Math.max(err, Math.abs(d.data[i] - m / ch)); }
    ok(d.data.length === N && d.rate === RATE && err < tol, `${name}: ${d.data.length} frames at ${d.rate} Hz, error ${err.toExponential(1)}`);
  }
  const d = await decodeAudioFile(wav(16, 1));
  ok(/^s[0-9a-f]{8}-1000-44100$/.test(sampleId(d)) && sampleName('my_kick 01.WAV') === 'MY KICK 01', 'ids and names');
  ok(eq(cleanSampleMap({ 3: { id: 'x', name: 'A' }, 40: { id: 'y' }, 5: { name: 'no id' } }), { 3: { id: 'x', name: 'A' } }), 'a saved slot map, repaired');
  let rejected = false;
  try { await decodeAudioFile(new ArrayBuffer(16)); } catch { rejected = true; }
  ok(rejected, 'not audio: refused');
}

(async () => {
  live();
  euclid();
  pool();
  await samples();
  console.log(`${passes} passed, ${fails} failed`);
  process.exit(fails ? 1 : 0);
})();
