'use strict';
// ============================================================================
// Audio QA - metric self-test on synthetic signals (no browser).
//   node scripts/audio-qa.cjs --selftest
// Checks the meters against BS.1770-4 / EBU Tech 3341 reference cases and the
// click, DC, correlation, dropout and tail detectors against known signals.
// ============================================================================

const M = require('./metrics.cjs');

function sine(fs, seconds, freq, amp, phase = 0) {
  const n = Math.round(fs * seconds);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = amp * Math.sin(2 * Math.PI * freq * (i / fs) + phase);
  return x;
}

function concat(...parts) {
  const n = parts.reduce((s, p) => s + p.length, 0);
  const out = new Float32Array(n);
  let o = 0;
  parts.forEach(p => { out.set(p, o); o += p.length; });
  return out;
}

const zeros = (fs, seconds) => new Float32Array(Math.round(fs * seconds));
const dbAmp = db => Math.pow(10, db / 20);

/** Deterministic white noise */
function noise(fs, seconds, amp, seed = 1) {
  let s = seed >>> 0;
  const x = new Float32Array(Math.round(fs * seconds));
  for (let i = 0; i < x.length; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    x[i] = amp * ((s / 4294967296) * 2 - 1);
  }
  return x;
}

function naiveSaw(fs, seconds, freq, amp) {
  const x = new Float32Array(Math.round(fs * seconds));
  let ph = 0.37;
  for (let i = 0; i < x.length; i++) {
    x[i] = amp * (2 * ph - 1);
    ph += freq / fs;
    if (ph >= 1) ph -= 1;
  }
  return x;
}

function naiveSquare(fs, seconds, freq, amp) {
  const x = new Float32Array(Math.round(fs * seconds));
  let ph = 0.1;
  for (let i = 0; i < x.length; i++) {
    x[i] = ph < 0.5 ? amp : -amp;
    ph += freq / fs;
    if (ph >= 1) ph -= 1;
  }
  return x;
}

function run({ log = console.log } = {}) {
  const results = [];
  const check = (name, value, lo, hi, fmt = v => (typeof v === 'number' ? v.toFixed(3) : String(v))) => {
    const ok = typeof value === 'number' ? value >= lo && value <= hi : value === lo;
    results.push({ name, value, expected: typeof value === 'number' ? `${lo} .. ${hi}` : String(lo), ok });
    log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}: ${fmt(value)}  (expected ${typeof value === 'number' ? `${lo} .. ${hi}` : lo})`);
  };

  // K-weighting at 48 kHz against the table in BS.1770-4
  const [shelf, hp] = M.kWeighting(48000);
  const ref = [1.53512485958697, -2.69169618940638, 1.19839281085285, -1.69065929318241, 0.73248077421585, -1.99004745483398, 0.99007225036621];
  const got = [shelf.b[0], shelf.b[1], shelf.b[2], shelf.a[1], shelf.a[2], hp.a[1], hp.a[2]];
  check('K-weighting coefficients at 48 kHz, max abs error', Math.max(...ref.map((r, i) => Math.abs(r - got[i]))), 0, 1e-8, v => v.toExponential(2));

  for (const fs of [48000, 44100]) {
    log(`  -- ${fs} Hz`);
    const tone = sine(fs, 5, 1000, 0.1);
    const z = zeros(fs, 5);
    const ref1 = M.loudness([tone, z], fs).integrated;
    check(`1 kHz -20 dBFS in one channel (BS.1770 reference -23.01)`, ref1, -23.06, -22.96);
    check(`1 kHz -20 dBFS dual mono L=R (as the stereo bus hears a mono source)`, M.loudness([tone, tone], fs).integrated, -20.05, -19.95);
    const p = M.peaks(tone);
    check('1 kHz -20 dBFS sample peak', M.toDb(p.samplePeak), -20.01, -19.99);
    check('1 kHz -20 dBFS true peak', M.toDb(p.truePeak), -20.02, -19.95);
    const c1 = sine(fs, 20, 1000, dbAmp(-23));
    check('EBU 3341 case 1: stereo 1 kHz -23 dBFS', M.loudness([c1, c1], fs).integrated, -23.1, -22.9);
    const c2 = sine(fs, 20, 1000, dbAmp(-33));
    check('EBU 3341 case 2: stereo 1 kHz -33 dBFS', M.loudness([c2, c2], fs).integrated, -33.1, -32.9);
    const c3 = concat(sine(fs, 10, 1000, dbAmp(-36)), sine(fs, 60, 1000, dbAmp(-23)), sine(fs, 10, 1000, dbAmp(-36)));
    check('EBU 3341 case 3: -36/-23/-36 dBFS (relative gate)', M.loudness([c3, c3], fs).integrated, -23.1, -22.9);
    const c4 = concat(sine(fs, 10, 1000, dbAmp(-72)), sine(fs, 10, 1000, dbAmp(-36)), sine(fs, 60, 1000, dbAmp(-23)), sine(fs, 10, 1000, dbAmp(-36)), sine(fs, 10, 1000, dbAmp(-72)));
    check('EBU 3341 case 4: -72/-36/-23/-36/-72 dBFS (both gates)', M.loudness([c4, c4], fs).integrated, -23.1, -22.9);
    check('silence integrated loudness', M.loudness([z, z], fs).integrated, -Infinity, -Infinity, String);
  }

  const fs = 48000;
  // True peak: fs/4 sine at 45 degrees, amplitude 0.5 -> samples at +-0.354 (-9.03 dBFS), true peak -6.02 dBTP
  const q = new Float32Array(48000);
  for (let i = 0; i < q.length; i++) q[i] = 0.5 * Math.sin(Math.PI / 4 + (i * Math.PI) / 2);
  const pq = M.peaks(q);
  check('fs/4 sine at 45 deg: sample peak (-9.03 dBFS)', M.toDb(pq.samplePeak), -9.04, -9.02);
  check('fs/4 sine at 45 deg: true peak (-6.02 dBTP, EBU 3341 tolerance +0.2/-0.4 dB)', M.toDb(pq.truePeak), -6.42, -5.82);
  const full = sine(fs, 2, 997, 1.0);
  check('997 Hz 0 dBFS sine: true peak', M.toDb(M.peaks(full).truePeak), -0.05, 0.1);

  // DC and correlation
  const dcSig = sine(fs, 2, 220, 0.3).map(v => v + 0.01);
  check('DC offset of sine + 0.01', M.meanOf(dcSig, 0, dcSig.length), 0.0099, 0.0101, v => v.toFixed(5));
  const s440 = sine(fs, 1, 440, 0.3);
  check('correlation L = R', M.correlation(s440, s440), 0.999, 1.001);
  check('correlation L = -R', M.correlation(s440, s440.map(v => -v)), -1.001, -0.999);
  check('correlation of independent noise', Math.abs(M.correlation(noise(fs, 2, 0.3, 1), noise(fs, 2, 0.3, 7))), 0, 0.05);

  // Clicks: periodic discontinuities and noise must not count
  const clicks = x => M.detectClicks([x, x], fs).count;
  check('clicks in a naive saw, 25 Hz', clicks(naiveSaw(fs, 2, 25, 0.5)), 0, 0);
  check('clicks in a naive saw, 40 Hz', clicks(naiveSaw(fs, 2, 40, 0.5)), 0, 0);
  check('clicks in a naive saw, 110 Hz', clicks(naiveSaw(fs, 2, 110, 0.5)), 0, 0);
  check('clicks in a naive saw, 1.76 kHz', clicks(naiveSaw(fs, 2, 1760, 0.5)), 0, 0);
  check('clicks in a naive square, 50 Hz', clicks(naiveSquare(fs, 2, 50, 0.5)), 0, 0);
  check('clicks in white noise', clicks(noise(fs, 2, 0.3)), 0, 0);
  const fadeOut = (x, ms) => x.map((v, i, a) => v * Math.min(1, (a.length - 1 - i) / (ms * fs / 1000)));
  check('clicks in a noise burst after silence (instant start, 3 ms fade out)', clicks(concat(zeros(fs, 0.5), fadeOut(noise(fs, 0.2, 0.5), 3), zeros(fs, 0.5))), 0, 0);
  // A kick: exponential sweep 400 -> 50 Hz starting at phase 0, 300 ms decay
  const kick = new Float32Array(fs);
  let ph = 0;
  for (let i = 0; i < kick.length; i++) {
    const t = i / fs;
    const f = 50 + 350 * Math.exp(-t / 0.03);
    ph += (2 * Math.PI * f) / fs;
    kick[i] = 0.9 * Math.exp(-t / 0.3) * Math.sin(ph);
  }
  check('clicks in a phase-0 kick', clicks(concat(zeros(fs, 0.2), kick, kick, zeros(fs, 0.2))), 0, 0);
  check('clicks in an envelope-shaped saw (5 ms attack, 50 ms release)', clicks(concat(zeros(fs, 0.2), naiveSaw(fs, 0.5, 110, 0.5).map((v, i, a) => v * Math.min(1, i / 240, (a.length - i) / 2400)), zeros(fs, 0.3))), 0, 0);
  // Corners (an instant attack on a waveform at a steep point) are not steps
  const corner = concat(zeros(fs, 0.3), new Float32Array(Math.round(fs * 0.3)).map((v, i) => 0.6 * Math.exp(-i / fs / 0.08) * Math.sin(2 * Math.PI * 300 * i / fs)), zeros(fs, 0.3));
  check('clicks at an instant-attack corner (value continuous, slope jumps)', clicks(corner), 0, 0);
  // 0.05 -> 0.45 -> 0.15 with ~24-sample tanh edges: steep but continuous
  const steep = new Float32Array(Math.round(fs * 0.5)).map((v, i) => 0.25 + 0.2 * Math.tanh((i - 0.2 * fs) / 6) - 0.15 * Math.tanh((i - 0.3 * fs) / 6));
  check('clicks in a steep smooth transient (24-sample edges)', clicks(steep), 0, 0);
  // A 2 ms band-passed noise burst (beater click) into the kick: a designed transient, not a step
  const burst = noise(fs, 0.002, 0.3, 3);
  for (let i = 1; i < burst.length; i++) burst[i] = 0.6 * burst[i] + 0.4 * burst[i - 1];
  const beater = concat(zeros(fs, 0.2), burst, kick, zeros(fs, 0.2));
  check('clicks in a noise burst into a kick', clicks(beater), 0, 0);
  // ... and real discontinuities must
  const steal = concat(zeros(fs, 0.2), kick.slice(0, Math.round(0.15 * fs)), kick, zeros(fs, 0.2));
  const stealR = M.detectClicks([steal, steal], fs);
  check('clicks in a kick cut off by a retrigger (voice steal)', stealR.count, 1, 1);
  check('... classified as mid-sound', stealR.events[0] && stealR.events[0].kind, 'mid');
  const flip = concat(sine(fs, 0.5, 220, 0.5), sine(fs, 0.5, 220, 0.5, Math.PI / 2));
  const flipR = M.detectClicks([flip, flip], fs);
  check('clicks in a 220 Hz sine with a 90 deg phase jump', flipR.count, 1, 1);
  check('... classified as mid-sound', flipR.events[0] && flipR.events[0].kind, 'mid');
  const gated = concat(zeros(fs, 0.3), sine(fs, 0.5, 220, 0.5, 1.2), zeros(fs, 0.3));
  const gatedR = M.detectClicks([gated, gated], fs);
  check('clicks in a hard-gated sine (instant attack and release)', gatedR.count, 2, 2);
  check('... onset + cutoff', gatedR.events.map(e => e.kind).join('+'), 'onset+cutoff');
  const bl = sine(fs, 1, 200, 0.4);
  for (let i = 24000; i < bl.length; i++) bl[i] += i === 24000 ? 0.05 : 0.1; // a +0.1 step spread over 2 samples
  check('clicks at a band-limited (2-sample) step inside a sine', clicks(bl), 1, 1);
  const cutNoise = concat(noise(fs, 0.5, 0.4, 9), zeros(fs, 0.5));
  const cutR = M.detectClicks([cutNoise, cutNoise], fs);
  check('clicks where white noise stops dead (abrupt cutoff)', cutR.count, 1, 1);
  check('... classified as cutoff', cutR.events[0] && cutR.events[0].kind, 'cutoff');
  const fadeNoise = concat(noise(fs, 0.5, 0.4, 9).map((v, i, a) => v * Math.min(1, (a.length - i) / (0.005 * fs))), zeros(fs, 0.5));
  check('clicks where white noise fades out over 5 ms', clicks(fadeNoise), 0, 0);
  check('clicks where white noise fades out over 2 ms', clicks(concat(fadeOut(noise(fs, 0.5, 0.4, 9), 2), zeros(fs, 0.5))), 0, 0);
  check('clicks where a 1 kHz tone stops dead at a zero crossing', clicks(concat(sine(fs, 0.5, 1000, 0.3), zeros(fs, 0.5))), 1, 1);
  check('clicks in a -40 dBFS sine with a phase jump (quiet click)', clicks(concat(sine(fs, 0.5, 300, 0.01), sine(fs, 0.5, 300, 0.01, 2))), 1, 1);

  // Dropouts
  const drop = sine(fs, 1, 330, 0.4);
  drop.fill(0, 24000, 24128);
  check('dropout of 128 samples inside a sine', M.detectDropouts([drop, drop], fs).count, 1, 1);
  check('no dropout between separate notes', M.detectDropouts([gated, gated], fs).count, 0, 0);

  // Tail after stop
  const stop = fs;
  const ring = concat(sine(fs, 1, 220, 0.5), sine(fs, 2.5, 220, 0.5).map((v, i) => v * Math.exp(-i / fs / 0.15)));
  const tr = M.tailStats([ring, ring], fs, stop);
  check('released tail (tau 150 ms): peak 2 s after stop below -60 dBFS', tr.peakDb, -Infinity, -60);
  const held = sine(fs, 3.5, 220, 0.1);
  const th = M.tailStats([held, held], fs, stop);
  check('stuck note: tail peak 2 s after stop (-20 dBFS)', th.peakDb, -20.1, -19.9);
  check('stuck note: decay rate ~0 dB/s', th.decayDbPerSec, -0.5, 0.5);
  check('stuck note: release time never reached (null)', th.releaseSec, null, null, String);

  // Full analysis of a capture: a steady tone over the whole capture (as the calibration feeds it)
  const steady = sine(fs, 5, 1000, 0.1);
  const a = M.analyzeTap([steady, new Float32Array(steady.length)], fs, {});
  check('analyzeTap: steady -20 dBFS 1 kHz tone in one channel (-23.01 LUFS)', a.lufs, -23.06, -22.96);
  check('analyzeTap: crest factor of a sine (3.01 dB)', a.crestDb, 2.95, 3.07);
  check('analyzeTap: max short-term loudness of the tone', a.maxShortTermLufs, -23.06, -22.96);
  // ... and a note with pre-roll and tail: 400 ms edge blocks lower the integrated value slightly
  const cap = concat(zeros(fs, 0.25), fadeOut(sine(fs, 4, 1000, 0.1), 5), zeros(fs, 2.5));
  const b = M.analyzeTap([cap, cap], fs, { excite: Math.round(0.25 * fs), stop: Math.round(4.25 * fs) }, { stereo: true });
  check('analyzeTap: 4 s dual-mono tone with silence around it (edge blocks gated in)', b.lufs, -20.5, -19.95);
  check('analyzeTap: tail level of a released note', b.tail.peakDb, -Infinity, -Infinity, String);
  check('analyzeTap: dual-mono correlation', b.correlation, 0.999, 1.001);
  check('analyzeTap: no clicks in a phase-0 tone', b.clicks.count, 0, 0);

  const failed = results.filter(r => !r.ok);
  log(`  ${results.length - failed.length}/${results.length} checks passed`);
  return { passed: results.length - failed.length, failed: failed.length, results };
}

module.exports = { run };
