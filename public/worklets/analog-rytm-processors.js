/* eslint-disable */
// ============================================================================
// Analog Rytm MKII - device worklets (see devices/analog-rytm/REFERENCE.md)
//
//  'analog-rytm'         8 voices (12 tracks, voice sharing), 34 machines, the
//                        sample layer, overdrive -> multimode filter (Simper SVF,
//                        the same filter as the shared 'svf' processor) with its
//                        ADSR, amp envelope (attack / hold / decay), pan, volume,
//                        delay and reverb sends, 12 track LFOs + the FX LFO, and
//                        the FX track's stereo delay.
//                        out 0: dry stereo, out 1: delay return stereo,
//                        out 2: reverb send stereo (into a shared Reverb2).
//  'analog-rytm-master'  the FX track's analog distortion and compressor with the
//                        delay / reverb PRE / POST routing.
//                        in 0: dry, in 1: delay return, in 2: reverb return.
//
// Machine models follow the firmware's machine functions (rytm-mods machines.md):
// the two-oscillator circuit on the BD, SD and RS/CP voices, the tuned
// resonator on BT, LT and MT/HT, the six-oscillator hat bank on CH/OH and the
// cymbal / cowbell bank on CY/CB, plus the digital-only machines (CP CLASSIC,
// UT NOISE, UT IMPULSE). Absolute curves (Hz, ms) are tuned by ear where the
// firmware doesn't fix them; REFERENCE.md lists which.
//
// Messages (all times are AudioContext seconds; 0 = now):
//   { t:'k', tr, i, v, at }        track parameter (model.ts IX)
//   { t:'m', tr, m, slots, at }    machine + its 8 slot values
//   { t:'fx', i, v, at }           FX parameter (model.ts FX)
//   { t:'kit', at, tracks:[{m, p}], fx }   whole kit at once
//   { t:'ovr', tr, i, v }          scene value (NaN clears), tr 12 = FX
//   { t:'perf', tr, i, target, amt }   performance morph
//   { t:'trig', at, tr, vel, note, acc, len, locks:{i:v}, rt }   note trig
//   { t:'locks', at, tr, locks }   lock trig (no note)
//   { t:'off', at, tr }            note-off (gate end)
//   { t:'fxlocks', at, locks }     FX track lock trig
//   { t:'tempo', bpm }
//   { t:'stop' }                   [STOP]: cut every voice off (5 ms fade; the FX ring on)
// Reports: { t:'lv', lv: Float32Array(12) } track levels at ~30 Hz while sounding.
// ============================================================================

const SR = sampleRate;
const INV_SR = 1 / SR;
const TWO_PI = Math.PI * 2;
const LN1000 = 6.907755278982137; // ln(1000): 60 dB

// ---------------------------------------------------------------------------
// Fast math (same approximations as synth-processors.js)
// ---------------------------------------------------------------------------
const POW2 = new Float64Array(129);
for (let i = 0; i <= 128; i++) POW2[i] = Math.pow(2, i - 64);
const ROUND_MAGIC = 6755399441055744.0;
function exp2(x) {
  if (x > 60) x = 60; else if (x < -60) x = -60;
  const k = (x + ROUND_MAGIC) - ROUND_MAGIC;
  const f = x - k;
  return (1.0000000754953540 + f * (0.69314720671060703 + f * (0.24022107355813041 + f * (0.055503272142182529 +
    f * (0.0096760370985559188 + f * 0.0013400432164069483))))) * POW2[(k + 64) | 0];
}
function tanhF(x) {
  if (x > 4.97) return 1;
  if (x < -4.97) return -1;
  const x2 = x * x;
  return x * (135135 + x2 * (17325 + x2 * (378 + x2))) / (135135 + x2 * (62370 + x2 * (3150 + x2 * 28)));
}
function tanF(x) {
  const x2 = x * x;
  return x * (945 + x2 * (-105 + x2)) / (945 + x2 * (-420 + x2 * 15));
}
function sin2pi(p) {
  let u = p - Math.floor(p + 0.5);
  if (u > 0.25) u = 0.5 - u; else if (u < -0.25) u = -0.5 - u;
  const u2 = u * u;
  return u * (6.2831852802603860 + u2 * (-41.341680667564709 + u2 * (81.602480704356452 + u2 * (-76.581283596342473 + u2 * 39.760714499738548))));
}
const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
/** lo * (hi/lo)^(v/127) */
const expT = (v, lo, hi) => lo * Math.pow(hi / lo, clamp(v, 0, 127) / 127);
/** per-sample multiplier that falls 60 dB in T seconds */
const k60 = T => Math.exp(-LN1000 / (Math.max(1e-4, T) * SR));
/** per-sample multiplier with time constant tau seconds */
const kTau = tau => Math.exp(-1 / (Math.max(1e-5, tau) * SR));
/** one-pole low-pass coefficient for a cutoff in Hz */
const lpA = f => 1 - Math.exp(-TWO_PI * clamp(f, 5, SR * 0.45) * INV_SR);
/** Simper SVF g for a cutoff in Hz */
const svfG = f => { const w = clamp(f, 5, SR * 0.47) * Math.PI * INV_SR; return w < 1.42 ? tanF(w) : Math.tan(w); };

// ---------------------------------------------------------------------------
// Indices (keep in sync with devices/analog-rytm/model.ts)
// ---------------------------------------------------------------------------
const NP = 48;
const IX_SMP_TUN = 8, IX_SMP_FIN = 9, IX_SMP_BR = 10, IX_SMP_SLOT = 11, IX_SMP_STA = 12, IX_SMP_END = 13, IX_SMP_LOP = 14, IX_SMP_LEV = 15;
const IX_FLT_ATK = 16, IX_FLT_DEC = 17, IX_FLT_SUS = 18, IX_FLT_REL = 19, IX_FLT_FRQ = 20, IX_FLT_RES = 21, IX_FLT_TYP = 22, IX_FLT_ENV = 23;
const IX_AMP_ATK = 24, IX_AMP_HLD = 25, IX_AMP_DEC = 26, IX_AMP_OVR = 27, IX_AMP_DEL = 28, IX_AMP_REV = 29, IX_AMP_PAN = 30, IX_AMP_VOL = 31;
const IX_LFO_SPD = 32, IX_LFO_MUL = 33, IX_LFO_FAD = 34, IX_LFO_DST = 35, IX_LFO_WAV = 36, IX_LFO_SPH = 37, IX_LFO_MOD = 38, IX_LFO_DEP = 39;
const IX_TRK_LEV = 40, IX_ACC_LEV = 41, IX_VEL_VOL = 42, IX_TRIG_SYN = 43, IX_TRIG_SMP = 44, IX_TRIG_ENV = 45, IX_TRIG_LFO = 46;

const NFX = 40;
const FX_DEL_TIM = 0, FX_DEL_X = 1, FX_DEL_WID = 2, FX_DEL_FDB = 3, FX_DEL_HPF = 4, FX_DEL_LPF = 5, FX_DEL_REV = 6, FX_DEL_VOL = 7;
const FX_REV_PRE = 8, FX_REV_DEC = 9, FX_REV_FRQ = 10, FX_REV_GAI = 11, FX_REV_HPF = 12, FX_REV_LPF = 13, FX_REV_VOL = 14, FX_TRK_LEV = 15;
const FX_DIS_AMT = 16, FX_DIS_SYM = 17, FX_DIS_DOV = 18, FX_DIS_DEL = 19, FX_DIS_REV = 20;
const FX_CMP_THR = 24, FX_CMP_ATK = 25, FX_CMP_REL = 26, FX_CMP_MUP = 27, FX_CMP_RAT = 28, FX_CMP_SEQ = 29, FX_CMP_MIX = 30, FX_CMP_VOL = 31;
const FX_LFO_SPD = 32, FX_LFO_MUL = 33, FX_LFO_FAD = 34, FX_LFO_DST = 35, FX_LFO_WAV = 36, FX_LFO_SPH = 37, FX_LFO_MOD = 38, FX_LFO_DEP = 39;

// Machines (hardware numbering)
const BD_HARD = 0, BD_CLASSIC = 1, SD_HARD = 2, SD_CLASSIC = 3, RS_HARD = 4, RS_CLASSIC = 5, CP_CLASSIC = 6,
  BT_CLASSIC = 7, XT_CLASSIC = 8, CH_CLASSIC = 9, OH_CLASSIC = 10, CY_CLASSIC = 11, CB_CLASSIC = 12,
  BD_FM = 13, SD_FM = 14, UT_NOISE = 15, UT_IMPULSE = 16, CH_METALLIC = 17, OH_METALLIC = 18,
  CY_METALLIC = 19, CB_METALLIC = 20, BD_PLASTIC = 21, BD_SILKY = 22, SD_NATURAL = 23, HH_BASIC = 24,
  CY_RIDE = 25, BD_SHARP = 26, DISABLE = 27, SY_DUAL_VCO = 28, SY_CHIP = 29, BD_ACOUSTIC = 30,
  SD_ACOUSTIC = 31, SY_RAW = 32, HH_LAB = 33;

// Track -> voice: BD SD RS CP BT LT MT HT CH OH CY CB
const TRACK_VOICE = [0, 1, 2, 2, 3, 4, 5, 5, 6, 6, 7, 7];
const NT = 12;

// LFO destinations (model.ts LFO_DESTS order): param index and range (-1 = none)
const LFO_DEST_IDX = [-1, 0, 1, 2, 3, 4, 5, 6, 7, IX_SMP_TUN, IX_SMP_FIN, IX_SMP_SLOT, IX_SMP_BR, IX_SMP_STA, IX_SMP_END, IX_SMP_LOP, IX_SMP_LEV,
  IX_FLT_ENV, IX_FLT_ATK, IX_FLT_DEC, IX_FLT_SUS, IX_FLT_REL, IX_FLT_FRQ, IX_FLT_RES,
  IX_AMP_ATK, IX_AMP_HLD, IX_AMP_DEC, IX_AMP_OVR, IX_AMP_VOL, IX_AMP_PAN, IX_ACC_LEV, IX_AMP_DEL, IX_AMP_REV];
const LFO_DEST_RANGE = [0, 128, 128, 128, 128, 128, 128, 128, 128, 48, 128, 16, 128, 120, 120, 2, 128,
  128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128];
// FX LFO destinations (model.ts FX_LFO_DESTS, libanalogrytm order): delay, reverb, distortion, compressor
const FX_LFO_DEST_IDX = [-1, FX_DEL_TIM, FX_DEL_X, FX_DEL_WID, FX_DEL_FDB, FX_DEL_HPF, FX_DEL_LPF, FX_DEL_REV, FX_DEL_VOL, FX_DIS_DOV,
  FX_REV_PRE, FX_REV_DEC, FX_REV_FRQ, FX_REV_GAI, FX_REV_HPF, FX_REV_LPF, FX_REV_VOL,
  FX_DIS_AMT, FX_DIS_SYM, FX_CMP_THR, FX_CMP_ATK, FX_CMP_REL, FX_CMP_RAT, FX_CMP_SEQ, FX_CMP_MUP, FX_CMP_MIX, FX_CMP_VOL];
const FX_LFO_DEST_RANGE = [0, 128, 2, 128, 198, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 7, 8, 4, 4, 128, 128, 128];
const LFO_MULT = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048];
/** Samples over which a retriggered voice blends out of its last output */
const DECLICK_N = Math.max(16, Math.round(0.0013 * SR));
/** Right-hand track of each shared voice (it wins when both trig together; manual p.21) */
const RIGHT_OF = [-1, -1, 3, -1, -1, -1, 7, -1, 9, -1, 11, -1];
// Tables used by the generators (module level: nothing is allocated per block)
const HH_LAB_SLOTS = [1, 3, 4, 5, 6, 7];
/** SY CHIP SPD 0..23: note values in bars */
const CHIP_NOTEV = [1 / 128 * 2 / 3, 1 / 128, 1 / 64 * 2 / 3, 1.5 / 128, 1 / 64, 1 / 32 * 2 / 3, 1.5 / 64, 1 / 32, 1 / 16 * 2 / 3, 1.5 / 32, 1 / 16, 1 / 8 * 2 / 3,
  1.5 / 16, 1 / 8, 1 / 4 * 2 / 3, 1.5 / 8, 1 / 4, 1 / 2 * 2 / 3, 1.5 / 4, 1 / 2, 2 / 3, 1.5 / 2, 1, 1.5];
/** SY CHIP SPD 24..56: fixed rates; 57..65: single-shot rates */
const CHIP_HZ = [1, 1.56, 1.88, 2, 3.13, 3.75, 4, 5, 6.25, 7.5, 10, 12.5, 15, 20, 25, 30, 40, 50, 60, 75, 100, 120, 150, 180, 200, 240, 250, 300, 350, 360, 400, 420, 480,
  240, 200, 150, 120, 100, 60, 50, 30, 25];
const CHIP_ONESHOT = 57;
/** SY CHIP ANM1-4: ring-modulated analog pairs (wave, partner wave, partner ratio) */
const CHIP_ANIM = [[0, 5, 2], [2, 4, 1.5], [3, 5, 3], [1, 2, 2.5]];
/** SY CHIP ANM5 and TBL1-3: waveforms that alternate (ANM5 every note, TBL after a noise burst) */
const CHIP_TBL = [[0, 2, 3, 4, 5], [0, 5, 4], [2, 3, 5], [4, 0, 1]];
// FX parameters the master node reads from the voice node's control output (one channel each)
const MASTER_CH = [FX_DIS_AMT, FX_DIS_SYM, FX_DIS_DEL, FX_DIS_REV, FX_CMP_THR, FX_CMP_ATK, FX_CMP_REL, FX_CMP_MUP, FX_CMP_RAT, FX_CMP_SEQ, FX_CMP_MIX, FX_CMP_VOL];

// TR-808 metal bank (firmware ratios, rytm-mods machines.md / rytm-emu)
const BANK_808 = [205.3, 304.4, 369.6, 522.7, 540.0, 800.0];
const BANK_BASIC = [407.0, 691.5, 509.6, 728.1, 398.9, 1037.5];       // HH BASIC ratios 1 : 1.699 : 1.252 : 1.789 : 0.980 : 2.549
const BANK_METAL = [263.0, 404.0, 581.0, 739.0, 897.0, 1214.0];       // wider inharmonic set (metallic machines; firmware table not decoded)
const BANK_METAL2 = [317.0, 499.0, 643.0, 822.0, 1067.0, 1391.0];

// ---------------------------------------------------------------------------
// Shared noise / transient tables
// ---------------------------------------------------------------------------
let seed = 0x2545f491;
function rnd() { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; }

/** A short recorded-style transient: a decaying burst of filtered noise + a 3 kHz blip (BD SHARP TIC, 88 samples at 48 kHz) */
const TICK = new Float32Array(Math.round(0.0019 * SR));
(() => { let lp = 0; for (let i = 0; i < TICK.length; i++) { const t = i / TICK.length; lp += 0.45 * ((rnd() * 2 - 1) - lp); TICK[i] = (lp * 0.8 + Math.sin(TWO_PI * 3100 * i * INV_SR) * 0.7) * Math.pow(1 - t, 2); } })();
/** Beater / stick impulses (BD / SD ACOUSTIC IMP) */
const BEATER = new Float32Array(Math.round(0.06 * SR));
(() => { let lp = 0, lp2 = 0; for (let i = 0; i < BEATER.length; i++) { const t = i * INV_SR; lp += 0.08 * ((rnd() * 2 - 1) - lp); lp2 += 0.3 * (lp - lp2); BEATER[i] = (lp2 * 3 + Math.sin(TWO_PI * 95 * t) * 0.5) * Math.exp(-t / 0.012) + (i < 30 ? (1 - i / 30) * 0.9 : 0); } })();
const STICK = new Float32Array(Math.round(0.025 * SR));
(() => { let hp = 0, prev = 0; for (let i = 0; i < STICK.length; i++) { const t = i * INV_SR; const n = rnd() * 2 - 1; hp = 0.85 * (hp + n - prev); prev = n; STICK[i] = (hp * 0.7 + Math.sin(TWO_PI * 1800 * t) * 0.5) * Math.exp(-t / 0.004); } })();
/**
 * The machines' digital clicks (BD HARD TIC, BD CLASSIC TRA, the SD HARD and RS HARD
 * ticks): one smooth 0.5 ms tick around 2.6 kHz that starts and ends at zero. Defined
 * in time, it sounds the same at 44.1 and 48 kHz, and a retrigger over a ringing voice
 * (whose declick matches the first sample) can't turn it into a step.
 */
const CLICK = new Float32Array(Math.max(8, Math.round(0.0005 * SR)));
(() => { const n = CLICK.length; for (let i = 0; i < n; i++) { const u = (i + 0.5) / n; CLICK[i] = Math.pow(Math.sin(Math.PI * u), 2) * Math.cos(TWO_PI * 2600 * i * INV_SR); } })();
/** A smooth one-sided push (0.35 ms): the snap of BD FM, SD CLASSIC and SD FM */
const BUMP = new Float32Array(Math.max(6, Math.round(0.00035 * SR)));
(() => { const n = BUMP.length; for (let i = 0; i < n; i++) { const u = (i + 0.5) / n; BUMP[i] = Math.pow(Math.sin(Math.PI * u), 2); } })();
const CLICK_N = CLICK.length, BUMP_N = BUMP.length;

// ---------------------------------------------------------------------------
// Sample layer: synthesized one-shots (generated on first use)
// ---------------------------------------------------------------------------
const SAMPLES = new Array(33).fill(null);
function genSample(slot) {
  const len = (s) => new Float32Array(Math.round(s * SR));
  let b;
  const N = () => rnd() * 2 - 1;
  const env = (t, a, d) => (t < a ? t / a : Math.exp(-(t - a) / d));
  switch (slot) {
    case 1: { b = len(0.5); let p = 0, lp = 0; for (let i = 0; i < b.length; i++) { const t = i * INV_SR; const f = 52 + 110 * Math.exp(-t / 0.025); p += f * INV_SR; lp += 0.1 * (N() - lp); b[i] = Math.sin(TWO_PI * p) * Math.exp(-t / 0.16) * 0.9 + lp * 1.5 * Math.exp(-t / 0.008) + (i < 24 ? 0.6 : 0); } break; }
    case 2: { b = len(0.45); let p = 0; for (let i = 0; i < b.length; i++) { const t = i * INV_SR; const f = 48 + 190 * Math.exp(-t / 0.012); p += f * INV_SR; b[i] = tanhF(Math.sin(TWO_PI * p) * 1.8 * Math.exp(-t / 0.18)) * 0.85 + N() * 0.25 * Math.exp(-t / 0.004); } break; }
    case 3: { b = len(1.4); let p = 0; for (let i = 0; i < b.length; i++) { const t = i * INV_SR; const f = 41 + 60 * Math.exp(-t / 0.03); p += f * INV_SR; b[i] = tanhF(Math.sin(TWO_PI * p) * 1.4) * Math.exp(-t / 0.5) * 0.85; } break; }
    case 4: { b = len(0.45); let p = 0, hp = 0, pn = 0, lp = 0; for (let i = 0; i < b.length; i++) { const t = i * INV_SR; p += (190 + 80 * Math.exp(-t / 0.01)) * INV_SR; const n = N(); hp = 0.9 * (hp + n - pn); pn = n; lp += 0.5 * (hp - lp); b[i] = Math.sin(TWO_PI * p) * Math.exp(-t / 0.05) * 0.6 + lp * 0.7 * Math.exp(-t / 0.13); } break; }
    case 5: { b = len(0.25); let p1 = 0, p2 = 0; for (let i = 0; i < b.length; i++) { const t = i * INV_SR; p1 += 480 * INV_SR; p2 += 1760 * INV_SR; b[i] = tanhF((Math.sin(TWO_PI * p1) + 0.6 * Math.sin(TWO_PI * p2)) * 2) * Math.exp(-t / 0.025) * 0.7 + N() * 0.3 * Math.exp(-t / 0.05); } break; }
    case 6: { b = len(0.6); let lp = 0, hp = 0, pn = 0; for (let i = 0; i < b.length; i++) { const t = i * INV_SR; const n = N(); hp = 0.7 * (hp + n - pn); pn = n; lp += 0.3 * (hp - lp); b[i] = lp * 0.9 * env(t, 0.02, 0.18); } break; }
    case 7: { b = len(0.6); let bp1 = 0, bp2 = 0; const g = Math.tan(Math.PI * 1300 * INV_SR), k = 1.2; for (let i = 0; i < b.length; i++) { const t = i * INV_SR; let e = 0; for (let c = 0; c < 4; c++) { const tt = t - c * 0.011; if (tt >= 0) e += Math.exp(-tt / (c === 3 ? 0.2 : 0.006)) * (c === 3 ? 0.9 : 1); } const x = N() * e; const v1 = (bp1 + g * (x - bp2)) / (1 + g * (g + k)); const v2 = bp2 + g * v1; bp1 = 2 * v1 - bp1; bp2 = 2 * v2 - bp2; b[i] = v1 * 1.6; } break; }
    case 8: { b = len(0.12); let p = 0; for (let i = 0; i < b.length; i++) { const t = i * INV_SR; p += 1650 * INV_SR; b[i] = (Math.sin(TWO_PI * p) * 0.8 + Math.sin(TWO_PI * p * 0.55) * 0.3) * Math.exp(-t / 0.018); } break; }
    case 9: case 10: { const open = slot === 10; b = len(open ? 0.8 : 0.12); let hp = 0, pn = 0; const ph = new Float64Array(6); for (let i = 0; i < b.length; i++) { const t = i * INV_SR; let s = 0; for (let k = 0; k < 6; k++) { ph[k] += BANK_808[k] * 1.6 * INV_SR; s += (ph[k] % 1) < 0.5 ? 1 : -1; } const x = s * 0.16 + N() * 0.35; hp = 0.75 * (hp + x - pn); pn = x; b[i] = hp * Math.exp(-t / (open ? 0.25 : 0.022)); } break; }
    case 11: { b = len(1.6); const ph = new Float64Array(5); const f = [530, 811, 1270, 1740, 2915]; for (let i = 0; i < b.length; i++) { const t = i * INV_SR; let s = 0; for (let k = 0; k < 5; k++) { ph[k] += f[k] * INV_SR; s += Math.sin(TWO_PI * ph[k]) / (k + 1); } b[i] = s * 0.45 * Math.exp(-t / 0.5) + N() * 0.08 * Math.exp(-t / 0.3); } break; }
    case 12: { b = len(2.2); let hp = 0, pn = 0, lp = 0; for (let i = 0; i < b.length; i++) { const t = i * INV_SR; const n = N(); hp = 0.6 * (hp + n - pn); pn = n; lp += 0.6 * (hp - lp); b[i] = lp * 0.8 * env(t, 0.003, 0.7); } break; }
    case 13: { b = len(0.18); let hp = 0, pn = 0; for (let i = 0; i < b.length; i++) { const t = i * INV_SR; const n = N(); hp = 0.5 * (hp + n - pn); pn = n; b[i] = hp * 0.9 * env(t, 0.03, 0.04); } break; }
    case 14: { b = len(0.35); let hp = 0, pn = 0; const ph = new Float64Array(3); for (let i = 0; i < b.length; i++) { const t = i * INV_SR; const n = N(); hp = 0.6 * (hp + n - pn); pn = n; let s = 0; for (let k = 0; k < 3; k++) { ph[k] += (4100 + k * 1730) * INV_SR; s += Math.sin(TWO_PI * ph[k]); } b[i] = (hp * 0.7 + s * 0.08) * env(t, 0.004, 0.09); } break; }
    case 15: case 16: case 17: { const f0 = slot === 15 ? 340 : slot === 16 ? 210 : 470; b = len(0.5); let p = 0; for (let i = 0; i < b.length; i++) { const t = i * INV_SR; p += (f0 + f0 * 0.25 * Math.exp(-t / 0.015)) * INV_SR; b[i] = tanhF(Math.sin(TWO_PI * p) * 1.6) * Math.exp(-t / (slot === 17 ? 0.08 : 0.16)) * 0.8 + N() * 0.15 * Math.exp(-t / 0.003); } break; }
    case 18: { b = len(0.12); let p = 0; for (let i = 0; i < b.length; i++) { const t = i * INV_SR; p += 2500 * INV_SR; b[i] = Math.sin(TWO_PI * p) * Math.exp(-t / 0.02) * 0.8; } break; }
    case 19: { b = len(0.5); let p1 = 0, p2 = 0; for (let i = 0; i < b.length; i++) { const t = i * INV_SR; p1 += 587 * INV_SR; p2 += 845 * INV_SR; const sq = ((p1 % 1) < 0.5 ? 1 : -1) + ((p2 % 1) < 0.5 ? 1 : -1); b[i] = sq * 0.3 * (t < 0.01 ? 1 : 0.4 + 0.6 * Math.exp(-(t - 0.01) / 0.01)) * Math.exp(-t / 0.2); } break; }
    case 20: { b = len(0.2); let p = 0; for (let i = 0; i < b.length; i++) { const t = i * INV_SR; p += 760 * INV_SR; b[i] = (Math.sin(TWO_PI * p) + 0.4 * Math.sin(TWO_PI * p * 2.7)) * Math.exp(-t / 0.03) * 0.6; } break; }
    case 21: { b = len(1.8); let p = 0; for (let i = 0; i < b.length; i++) { const t = i * INV_SR; p += 3520 * INV_SR; b[i] = (Math.sin(TWO_PI * p) * 0.5 + Math.sin(TWO_PI * p * 2.42) * 0.2) * Math.exp(-t / 0.6); } break; }
    case 22: { b = len(1.0); let lp = 0, hp = 0, pn = 0; for (let i = 0; i < b.length; i++) { const n = N(); hp = 0.98 * (hp + n - pn); pn = n; lp += 0.3 * (hp - lp); b[i] = lp * 0.08 + (rnd() < 0.0012 ? (rnd() * 2 - 1) * 0.8 : 0); } break; }
    case 23: { b = len(1.2); let s1 = 0, s2 = 0; for (let i = 0; i < b.length; i++) { const t = i * INV_SR; const f = 300 * Math.pow(30, t / 1.2); const g = Math.tan(Math.PI * Math.min(f, 18000) * INV_SR), k = 0.4; const x = N(); const v1 = (s1 + g * (x - s2)) / (1 + g * (g + k)); const v2 = s2 + g * v1; s1 = 2 * v1 - s1; s2 = 2 * v2 - s2; b[i] = v1 * 0.5 * env(t, 1.0, 0.05); } break; }
    case 24: { b = len(0.35); let p = 0; for (let i = 0; i < b.length; i++) { const t = i * INV_SR; p += (120 + 3000 * Math.exp(-t / 0.03)) * INV_SR; b[i] = ((p % 1) * 2 - 1) * 0.5 * Math.exp(-t / 0.12); } break; }
    case 25: { b = len(1.5); let pc = 0, pm = 0; for (let i = 0; i < b.length; i++) { const t = i * INV_SR; pm += 1225 * INV_SR; pc += 350 * INV_SR; b[i] = Math.sin(TWO_PI * pc + 4 * Math.exp(-t / 0.15) * Math.sin(TWO_PI * pm)) * Math.exp(-t / 0.5) * 0.6; } break; }
    case 26: { b = len(0.35); let p = 0, s1 = 0, s2 = 0, s3 = 0, s4 = 0; for (let i = 0; i < b.length; i++) { const t = i * INV_SR; p += 180 * INV_SR; const x = ((p % 1) * 2 - 1) * env(t, 0.01, 0.1); const g1 = Math.tan(Math.PI * 800 * INV_SR), g2 = Math.tan(Math.PI * 1300 * INV_SR); let v1 = (s1 + g1 * (x - s2)) / (1 + g1 * (g1 + 0.3)); let v2 = s2 + g1 * v1; s1 = 2 * v1 - s1; s2 = 2 * v2 - s2; const a = v1; v1 = (s3 + g2 * (x - s4)) / (1 + g2 * (g2 + 0.35)); v2 = s4 + g2 * v1; s3 = 2 * v1 - s3; s4 = 2 * v2 - s4; b[i] = (a + v1 * 0.7) * 0.8; } break; }
    case 27: { b = len(0.12); let hp = 0, pn = 0; for (let i = 0; i < b.length; i++) { const t = i * INV_SR; const n = N(); hp = 0.8 * (hp + n - pn); pn = n; b[i] = (hp * 0.8 + Math.sin(TWO_PI * 2200 * t) * 0.5) * (Math.exp(-t / 0.006) + 0.6 * (t > 0.03 ? Math.exp(-(t - 0.03) / 0.006) : 0)); } break; }
    case 28: { b = len(0.9); const f = [2350, 3610, 5170, 6890]; const ph = new Float64Array(4); for (let i = 0; i < b.length; i++) { const t = i * INV_SR; let s = 0; for (let k = 0; k < 4; k++) { ph[k] += f[k] * INV_SR; s += Math.sin(TWO_PI * ph[k]) * Math.exp(-t / (0.35 - k * 0.07)); } b[i] = s * 0.25 + N() * 0.2 * Math.exp(-t / 0.002); } break; }
    case 29: { b = len(0.7); const f = [311, 467, 732, 1043, 1517]; const ph = new Float64Array(5); for (let i = 0; i < b.length; i++) { const t = i * INV_SR; let s = 0; for (let k = 0; k < 5; k++) { ph[k] += f[k] * INV_SR; s += ((ph[k] % 1) < 0.5 ? 1 : -1); } b[i] = s * 0.12 * Math.exp(-t / 0.18) + N() * 0.3 * Math.exp(-t / 0.004); } break; }
    case 30: { b = len(1.5); let p = 0; for (let i = 0; i < b.length; i++) { const t = i * INV_SR; p += (30 + 90 * Math.exp(-t / 0.4)) * INV_SR; b[i] = Math.sin(TWO_PI * p) * Math.exp(-t / 0.6) * 0.9; } break; }
    case 31: { b = len(0.7); let p = 0; for (let i = 0; i < b.length; i++) { const t = i * INV_SR; p += (120 + 70 * Math.exp(-t / 0.05)) * INV_SR; b[i] = Math.sin(TWO_PI * p) * Math.exp(-t / 0.22) * 0.8 + N() * 0.12 * Math.exp(-t / 0.02); } break; }
    case 32: { b = len(0.05); for (let i = 0; i < b.length; i++) { const t = i * INV_SR; b[i] = N() * Math.exp(-t / 0.0035) * 0.9 + (i < 8 ? 0.8 : 0); } break; }
    default: b = new Float32Array(1);
  }
  let peak = 0;
  for (let i = 0; i < b.length; i++) peak = Math.max(peak, Math.abs(b[i]));
  if (peak > 0) for (let i = 0; i < b.length; i++) b[i] *= 0.8 / peak;
  return b;
}
function sampleBuf(slot) {
  if (slot <= 0 || slot >= SAMPLES.length) return null;
  if (!SAMPLES[slot]) SAMPLES[slot] = genSample(slot);
  return SAMPLES[slot];
}

// ---------------------------------------------------------------------------
// Waveforms of the two-oscillator circuit (phase 0..1)
// ---------------------------------------------------------------------------
/** 2-point polyBLEP residual for a unit step at phase 0 (t = phase since the edge, 0..1) */
function blep(t, dt) {
  if (t < dt) { const x = t / dt; return x + x - x * x - 1; }
  if (t > 1 - dt) { const x = (t - 1) / dt; return x * x + x + x + 1; }
  return 0;
}
/** wave: 0 sine, 1 asymmetric (skewed) sine, 2 triangle, 3 sinesaw, 4 saw, 5 square */
function wave(p, w, dt) {
  switch (w) {
    case 0: return sin2pi(p);
    case 1: { const s = 0.32; const q = p < s ? p * (0.5 / s) : 0.5 + (p - s) * (0.5 / (1 - s)); return sin2pi(q) * 0.95 + 0.05; }
    case 2: return p < 0.25 ? 4 * p : p < 0.75 ? 2 - 4 * p : 4 * p - 4;
    case 3: { const s = 0.12; const q = p < s ? p * (0.5 / s) : 0.5 + (p - s) * (0.5 / (1 - s)); return sin2pi(q); }
    case 4: return 1 - 2 * p + blep(p, dt);
    default: { let q = p + 0.5; if (q >= 1) q -= 1; return (p < 0.5 ? 1 : -1) + blep(p, dt) - blep(q, dt); }
  }
}
/** Band-limited pulse with width w (0..1) */
function pulse(p, w, dt) {
  let q = p - w; if (q < 0) q += 1;
  return (p < w ? 1 : -1) + blep(p, dt) - blep(q, dt);
}

// ============================================================================
// Voice
// ============================================================================

class Voice {
  constructor(index) {
    this.index = index;
    this.track = -1;
    this.m = DISABLE;
    this.active = false;
    this.P = new Float64Array(NP);
    this.lockMask = new Uint8Array(NP);
    this.lockVal = new Float64Array(NP);
    this.vel = 1; this.acc = 0; this.note = 60;
    this.t = 0;          // samples since the trig
    // oscillators
    this.p = new Float64Array(6); this.f = new Float64Array(6);
    this.e = new Float64Array(8); this.k = new Float64Array(8); // machine envelopes and their multipliers
    this.h = new Float64Array(4);                              // hold counters / misc
    this.s = new Float64Array(16);                             // misc filter / generator states
    this.rng = (0x9e3779b9 * (index + 1)) >>> 0;
    this.gen = 0;        // machine generator "alive" level estimate
    // machine-derived per-block values
    this.base = 55; this.fb = new Float64Array(8);
    // chip arp: the notes (semitones), how many, single-shot
    this.step = 0; this.stepLeft = 0;
    this.arp = new Float64Array(4); this.arpN = 1; this.arpShot = false; this.arpDone = false;
    this.trigAt = -1;     // audio time of the last trig (right-hand priority of shared voices)
    // clap
    this.clapLeft = 0; this.clapNext = 0; this.clapEnv = 0;
    // sample layer
    this.sBuf = null; this.sPos = 0; this.sInc = 1; this.sEnd = 0; this.sStart = 0; this.sLoop = false; this.sOn = false; this.sGain = 0;
    // filter
    this.ic1 = 0; this.ic2 = 0; this.fe = 0; this.feStage = 0; this.feAtk = 0; this.feKd = 1; this.feKr = 1;
    this.g = 0; this.a1 = 0; this.a2 = 0; this.a3 = 0; this.m0 = 0; this.m1 = 0; this.m2 = 1; this.kk = 2;
    this.fBaseOct = 0; this.fEnvOct = 0; this.fRes = 0; this.fType = 0;
    // amp
    this.amp = 0; this.ampStage = 0; this.ampAtk = 1; this.ampHold = 0; this.ampKd = 1; this.ampInf = true; this.gate = false;
    this.choke = 0; // > 0: fading out for a voice steal
    // drive / output
    this.drv = 0; this.drvN = 1; this.gl = 1; this.gr = 1; this.dsend = 0; this.rsend = 0; this.gain = 0;
    this.peak = 0;
    this.quiet = 0;
    this.dts = new Float64Array(6);
    this.lastY = 0; this.dclArm = false; this.dcl = 0; this.dclN = 0;
  }

  noise() { let x = this.rng; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; this.rng = x >>> 0; return (x | 0) * 4.656612873077393e-10; }
}

// ============================================================================
// Processor
// ============================================================================

class AnalogRytmProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.base = new Float64Array(NT * NP);
    this.ovr = new Float64Array(NT * NP).fill(NaN);
    this.perfAdd = new Float64Array(NT * NP);
    this.atAdd = new Float64Array(NT);   // pad pressure (aftertouch) on FLT FRQ
    this.mach = new Int32Array(NT).fill(DISABLE);
    this.fx = new Float64Array(NFX);
    this.fxOvr = new Float64Array(NFX).fill(NaN);
    this.fxPerfAdd = new Float64Array(NFX);
    this.fxEff = new Float64Array(NFX);
    this.fxLockMask = new Uint8Array(NFX);
    this.fxLockVal = new Float64Array(NFX);
    this.voices = [];
    for (let v = 0; v < 8; v++) this.voices.push(new Voice(v));
    this.G = new Float64Array(128);
    // LFOs: 12 tracks + FX (index 12)
    this.lfoPh = new Float64Array(13); this.lfoOut = new Float64Array(13); this.lfoHeld = new Float64Array(13);
    this.lfoFade = new Float64Array(13).fill(1); this.lfoRun = new Uint8Array(13).fill(1); this.lfoRnd = new Float64Array(13);
    this.lfoT = new Float64Array(13);
    this.lfoSlew = new Float64Array(13);
    this.bpm = 120;
    this.queue = [];
    // delay
    this.dMax = Math.ceil(SR * 4.2);
    this.dL = new Float32Array(this.dMax); this.dR = new Float32Array(this.dMax);
    this.dW = 0; this.dTime = 0.25 * SR; this.dTarget = 0.25 * SR;
    this.dHpL = 0; this.dHpR = 0; this.dLpL = 0; this.dLpR = 0; this.dHpxL = 0; this.dHpxR = 0;
    this.dIdle = 0;
    this.lvTimer = 0;
    this.lvOut = new Float32Array(NT);
    this.anyActive = false;
    // defaults so a fresh node makes sound before the engine's first messages
    for (let tr = 0; tr < NT; tr++) {
      const o = tr * NP;
      this.base[o + IX_FLT_FRQ] = 127; this.base[o + IX_FLT_DEC] = 64; this.base[o + IX_FLT_REL] = 64;
      this.base[o + IX_AMP_DEC] = 127; this.base[o + IX_AMP_VOL] = 100; this.base[o + IX_TRK_LEV] = 100;
      this.base[o + IX_ACC_LEV] = 32; this.base[o + IX_VEL_VOL] = 1; this.base[o + IX_SMP_END] = 120; this.base[o + IX_SMP_LEV] = 100;
      this.base[o + IX_TRIG_SYN] = 1; this.base[o + IX_TRIG_SMP] = 1; this.base[o + IX_TRIG_ENV] = 1; this.base[o + IX_TRIG_LFO] = 1;
      this.base[o + IX_LFO_SPD] = 48; this.base[o + IX_LFO_MUL] = 4;
    }
    this.fx[FX_DEL_TIM] = 23; this.fx[FX_DEL_FDB] = 49; this.fx[FX_DEL_HPF] = 32; this.fx[FX_DEL_LPF] = 96; this.fx[FX_DEL_VOL] = 110; this.fx[FX_TRK_LEV] = 100;
    this.lvMsg = { t: 'lv', lv: this.lvOut, rv: -1, rvv: 0 };
    this.port.onmessage = e => this.onMessage(e.data);
  }

  onMessage(m) {
    if (!m) return;
    switch (m.t) {
      case 'ovr':
        if (m.tr === 12) this.fxOvr[m.i] = m.v; else this.ovr[m.tr * NP + m.i] = m.v;
        return;
      case 'perf':
        // the summed depth of the engaged macros on one parameter
        if (m.tr === 12) this.fxPerfAdd[m.i] = m.add; else this.perfAdd[m.tr * NP + m.i] = m.add;
        return;
      case 'ovrclear':
        this.ovr.fill(NaN); this.fxOvr.fill(NaN); return;
      case 'perfclear':
        this.perfAdd.fill(0); this.fxPerfAdd.fill(0); return;
      case 'at':
        // SOUND SETTINGS > AFTERTOUCH, the default slot: +16 FLT FRQ at full pressure
        this.atAdd[m.tr] = clamp(m.v || 0, 0, 1) * 16; return;
      case 'tempo': this.bpm = clamp(m.bpm || 120, 20, 300); return;
      case 'fxoff':
        // [STOP] twice: the delay's repeats stop too
        this.dL.fill(0); this.dR.fill(0); this.dHpL = this.dHpR = this.dLpL = this.dLpR = 0; this.dIdle = SR * 6;
        return;
      case 'stop':
        // [STOP]: every track's sound is cut off (a 5 ms fade); the delay and reverb ring on (manual p.37)
        this.queue.length = 0;
        for (const v of this.voices) if (v.active) { v.gate = false; if (v.ampStage < 3) v.ampStage = 3; if (!(v.choke > 0)) v.choke = 1; }
        return;
    }
    if (!m.at || m.at <= currentTime) { this.apply(m); return; }
    // keep the queue sorted by time (stable)
    const q = this.queue;
    let i = q.length;
    while (i > 0 && q[i - 1].at > m.at) i--;
    q.splice(i, 0, m);
  }

  apply(m) {
    switch (m.t) {
      case 'k': this.base[m.tr * NP + m.i] = m.v; break;
      case 'm':
        this.mach[m.tr] = m.m;
        for (let s = 0; s < 8; s++) this.base[m.tr * NP + s] = m.slots[s] || 0;
        break;
      case 'fx': this.fx[m.i] = m.v; break;
      case 'kit':
        for (let tr = 0; tr < NT; tr++) {
          const k = m.tracks[tr];
          if (!k) continue;
          this.mach[tr] = k.m;
          const o = tr * NP;
          for (let i = 0; i < NP; i++) this.base[o + i] = k.p[i];
        }
        if (m.fx) for (let i = 0; i < NFX; i++) this.fx[i] = m.fx[i];
        break;
      case 'trig': this.trig(m); break;
      case 'locks': this.lockTrig(m); break;
      case 'off': {
        const v = this.voices[TRACK_VOICE[m.tr]];
        if (v.track === m.tr) { v.gate = false; if (v.feStage === 2 || v.feStage === 1) v.feStage = 3; }
        break;
      }
      case 'fxlocks': {
        this.fxLockMask.fill(0);
        for (const k in m.locks) { const i = +k; this.fxLockMask[i] = 1; this.fxLockVal[i] = m.locks[k]; }
        if (this.fxEff[FX_LFO_MOD] > 0) this.lfoRetrig(12);
        break;
      }
    }
  }

  // --------------------------------------------------------------------------
  // Parameters
  // --------------------------------------------------------------------------

  /** Effective parameters of a voice: base, lock, scene, performance, LFO */
  resolve(v) {
    const tr = v.track;
    if (tr < 0) return;
    const o = tr * NP, P = v.P, base = this.base, ovr = this.ovr, pAdd = this.perfAdd, lm = v.lockMask, lv = v.lockVal;
    for (let i = 0; i < NP; i++) {
      let x = ovr[o + i];
      if (x !== x) x = lm[i] ? lv[i] : base[o + i];
      P[i] = x + pAdd[o + i];
    }
    P[IX_FLT_FRQ] += this.atAdd[tr];
    // LFO (DEP 128 swings half the destination's range either way)
    const dst = Math.round(P[IX_LFO_DST]);
    if (dst > 0 && dst < LFO_DEST_IDX.length) {
      const amt = this.lfoOut[tr] * (P[IX_LFO_DEP] / 128) * LFO_DEST_RANGE[dst] * 0.5;
      P[LFO_DEST_IDX[dst]] += amt;
    }
  }

  resolveFx() {
    const E = this.fxEff;
    for (let i = 0; i < NFX; i++) {
      let x = this.fxOvr[i];
      if (x !== x) x = this.fxLockMask[i] ? this.fxLockVal[i] : this.fx[i];
      E[i] = x + this.fxPerfAdd[i];
    }
    const dst = Math.round(E[FX_LFO_DST]);
    if (dst > 0 && dst < FX_LFO_DEST_IDX.length) E[FX_LFO_DEST_IDX[dst]] += this.lfoOut[12] * (E[FX_LFO_DEP] / 128) * FX_LFO_DEST_RANGE[dst] * 0.5;
  }

  // --------------------------------------------------------------------------
  // LFOs (block rate)
  // --------------------------------------------------------------------------

  lfoRetrig(l) {
    const o = l * NP;
    const b = l === 12 ? this.fx : this.base;
    const off = l === 12 ? 0 : o;
    const sph = l === 12 ? b[FX_LFO_SPH] : b[off + IX_LFO_SPH];
    const mode = Math.round(l === 12 ? b[FX_LFO_MOD] : b[off + IX_LFO_MOD]);
    const fad = l === 12 ? b[FX_LFO_FAD] : b[off + IX_LFO_FAD];
    this.lfoT[l] = 0;
    this.lfoFade[l] = fad < 0 ? 0 : 1;
    if (mode === 0) return; // FREE
    if (mode === 2) { this.lfoHeld[l] = this.lfoValue(l, this.lfoPh[l]); return; } // HLD: sample the free LFO
    this.lfoPh[l] = clamp(sph, 0, 127) / 128;
    this.lfoRun[l] = 1;
    this.lfoRnd[l] = rnd() * 2 - 1;
  }

  lfoValue(l, ph) {
    const wav = Math.round(l === 12 ? this.fx[FX_LFO_WAV] : this.base[l * NP + IX_LFO_WAV]);
    switch (wav) {
      case 0: return ph < 0.25 ? 4 * ph : ph < 0.75 ? 2 - 4 * ph : 4 * ph - 4;
      case 1: return sin2pi(ph);
      case 2: return ph < 0.5 ? 1 : -1;
      case 3: return 1 - 2 * ph;
      case 4: return Math.exp(-ph * 4.6) * 2 - 1 + 0.02;
      case 5: return 2 * ph - 1;
      default: return this.lfoRnd[l];
    }
  }

  stepLfos(n) {
    const bpm = this.bpm;
    for (let l = 0; l < 13; l++) {
      const fx = l === 12;
      const b = fx ? this.fx : this.base, o = fx ? 0 : l * NP;
      const spd = fx ? b[FX_LFO_SPD] : b[o + IX_LFO_SPD];
      const mul = Math.round(fx ? b[FX_LFO_MUL] : b[o + IX_LFO_MUL]);
      const mode = Math.round(fx ? b[FX_LFO_MOD] : b[o + IX_LFO_MOD]);
      const fad = fx ? b[FX_LFO_FAD] : b[o + IX_LFO_FAD];
      const dep = fx ? b[FX_LFO_DEP] : b[o + IX_LFO_DEP];
      const dst = fx ? b[FX_LFO_DST] : b[o + IX_LFO_DST];
      if (!dep || !dst) { this.lfoOut[l] = 0; continue; }
      const t = mul >= 12 ? 120 : bpm;
      const cps = Math.abs(spd) * LFO_MULT[mul % 12] * t / (128 * 240);
      const dir = spd < 0 ? -1 : 1;
      let ph = this.lfoPh[l];
      if (this.lfoRun[l]) {
        const before = ph;
        ph += dir * cps * n * INV_SR;
        const limit = mode === 3 ? 1 : mode === 4 ? 0.5 : Infinity;
        if (mode >= 3) {
          // ONE / HLF: run from the start phase for one (half) cycle, then hold
          this.lfoT[l] += cps * n * INV_SR;
          if (this.lfoT[l] >= limit) { this.lfoRun[l] = 0; this.lfoT[l] = limit; }
        }
        if (ph >= 1 || ph < 0) { ph -= Math.floor(ph); this.lfoRnd[l] = rnd() * 2 - 1; }
        if (Math.floor(before * 2) !== Math.floor(ph * 2) && Math.round(fx ? b[FX_LFO_WAV] : b[o + IX_LFO_WAV]) === 6 && cps > 40) this.lfoRnd[l] = rnd() * 2 - 1;
      }
      this.lfoPh[l] = ph;
      let val = mode === 2 ? this.lfoHeld[l] : this.lfoValue(l, ph);
      // WAV RND: SPH adds slew to the steps (OS 1.70)
      if (Math.round(fx ? b[FX_LFO_WAV] : b[o + IX_LFO_WAV]) === 6) {
        const sph = clamp(fx ? b[FX_LFO_SPH] : b[o + IX_LFO_SPH], 0, 127) / 127;
        if (sph > 0 && cps > 0) {
          const a = Math.min(1, n / (sph * SR / cps * 0.5 + 1));
          this.lfoSlew[l] += (val - this.lfoSlew[l]) * a;
          val = this.lfoSlew[l];
        } else this.lfoSlew[l] = val;
      }
      if (fad) {
        const fadeTime = Math.pow(Math.abs(fad) / 64, 2) * 16 * 60 / bpm; // up to ~4 bars
        const step = n * INV_SR / Math.max(0.005, fadeTime);
        if (fad < 0) this.lfoFade[l] = Math.min(1, this.lfoFade[l] + step);
        else this.lfoFade[l] = Math.max(0, this.lfoFade[l] - step);
        val *= this.lfoFade[l];
      }
      this.lfoOut[l] = val;
    }
  }

  // --------------------------------------------------------------------------
  // Trigs
  // --------------------------------------------------------------------------

  setLocks(v, locks) {
    v.lockMask.fill(0);
    if (locks) for (const k in locks) { const i = +k; if (i >= 0 && i < NP) { v.lockMask[i] = 1; v.lockVal[i] = locks[k]; } }
  }

  lockTrig(m) {
    const v = this.voices[TRACK_VOICE[m.tr]];
    if (v.track !== m.tr) return;
    this.setLocks(v, m.locks);
    this.resolve(v);
    this.prepare(v, false);
  }

  trig(m) {
    const tr = m.tr;
    const v = this.voices[TRACK_VOICE[tr]];
    // both tracks of a pair at once: the right-hand track (CP, HT, OH, CB) plays
    const at = m.at || currentTime;
    if (RIGHT_OF[tr] >= 0 && v.track === RIGHT_OF[tr] && v.active && Math.abs(at - v.trigAt) < 0.0015) return;
    v.trigAt = at;
    const prevTrack = v.track;
    v.track = tr;
    this.setLocks(v, m.locks);
    const o = tr * NP;
    // LFO trig (TRIG page LFO flag)
    const lfoFlag = v.lockMask[IX_TRIG_LFO] ? v.lockVal[IX_TRIG_LFO] : this.base[o + IX_TRIG_LFO];
    if (lfoFlag > 0.5) this.lfoRetrig(tr);
    this.resolve(v);
    const P = v.P;
    v.vel = clamp(m.vel || 100, 1, 127) / 127;
    v.acc = m.acc ? 1 : 0;
    v.note = m.note === undefined ? 60 : m.note;
    v.gate = true;
    v.gateLen = m.len;
    v.choke = 0;
    const machine = this.mach[tr];
    const synth = P[IX_TRIG_SYN] > 0.5;
    if (synth || prevTrack !== tr || v.m !== machine) {
      if (v.m !== machine) { v.s.fill(0); v.h.fill(0); v.e.fill(0); v.clapLeft = 0; v.step = 0; v.stepLeft = 0; }
      v.m = machine;
      this.startMachine(v, synth, prevTrack !== tr);
    }
    // sample layer
    const slot = Math.round(P[IX_SMP_SLOT]);
    if (P[IX_TRIG_SMP] > 0.5 && slot > 0) {
      const buf = sampleBuf(slot);
      if (buf) {
        v.sBuf = buf;
        const len = buf.length;
        const sta = clamp(P[IX_SMP_STA], 0, 120) / 120, end = clamp(P[IX_SMP_END], 0, 120) / 120;
        v.sRev = end < sta;
        // forward: STA -> END; reverse (END below STA): STA down to END
        v.sStart = Math.min(len - 2, Math.floor(sta * (len - 1)));
        v.sEnd = v.sRev ? Math.floor(end * (len - 1)) : Math.max(v.sStart + 1, Math.floor(end * (len - 1)));
        v.sPos = v.sStart;
        v.sOn = true;
      }
    } else if (prevTrack !== tr) v.sOn = false;
    // filter envelope
    if (P[IX_TRIG_ENV] > 0.5 || !v.active) { v.fe = 0; v.feStage = 1; }
    // amp envelope: continues from the current level (hardware), restarts the stages
    if (!v.active || prevTrack !== tr) v.amp = v.active ? v.amp * 0.5 : 0;
    v.ampStage = 1;
    v.ampHoldLeft = -1;
    if (!v.active) { v.ic1 = 0; v.ic2 = 0; v.lastY = 0; }
    else v.dclArm = true;
    v.active = true;
    v.quiet = 0;
    v.t = 0;
    this.prepare(v, true);
  }

  /** Machine setup at a trig: phases, envelope start levels, counters */
  startMachine(v, synth, newTrack) {
    const P = v.P, e = v.e, p = v.p, h = v.h, s = v.s;
    const m = v.m;
    if (!synth) { if (newTrack) { e.fill(0); v.gen = 0; } return; }
    // most machines restart their oscillators on the trig (as the firmware's trig reset)
    h.fill(0);
    switch (m) {
      case BD_HARD: case BD_CLASSIC: case BD_FM: case BD_PLASTIC: case BD_SILKY: case BD_SHARP: case BD_ACOUSTIC:
      case SD_HARD: case SD_CLASSIC: case SD_FM: case SD_NATURAL: case SD_ACOUSTIC: case RS_HARD: case RS_CLASSIC: {
        const wx = Math.round(P[6]);
        const free = (m === BD_SHARP || m === BD_ACOUSTIC) && (wx & 1);
        if (!free) { p[0] = 0; p[1] = 0; p[2] = 0; }
        e[0] = 1; e[1] = 1; e[2] = 1; e[3] = 1; e[4] = 1; e[5] = 1;
        h[0] = 0; h[1] = 0;
        break;
      }
      case CP_CLASSIC: {
        // NUM claps, then the tail (NUM 0 = a single clap)
        v.clapLeft = 1 + Math.round(clamp(P[3], 0, 127));
        v.clapNext = 0; v.clapEnv = 0; e[0] = 0; e[1] = 0;
        break;
      }
      case BT_CLASSIC: case XT_CLASSIC:
        s[0] = 0; s[1] = 0; e[0] = 1; e[1] = 1; e[2] = 1; h[0] = 0;
        break;
      case CH_CLASSIC: case OH_CLASSIC: case CH_METALLIC: case OH_METALLIC: case HH_BASIC: case HH_LAB:
      case CY_CLASSIC: case CY_METALLIC: case CY_RIDE: {
        const reset = m === CY_RIDE || (m === HH_BASIC && P[5] > 0.5);
        if (reset) for (let i = 0; i < 6; i++) p[i] = 0;
        else if (!v.active) for (let i = 0; i < 6; i++) p[i] = rnd();
        e.fill(1); h[0] = 0;
        break;
      }
      case CB_CLASSIC: case CB_METALLIC:
        if (!v.active) { p[0] = rnd(); p[1] = rnd(); }
        e[0] = 1; e[1] = 1; h[0] = 0;
        break;
      case UT_NOISE: e[0] = 0; e[1] = 1; h[0] = 0; break;
      case UT_IMPULSE: e[0] = 0; h[0] = 0; break;
      case SY_DUAL_VCO: {
        // even CFG values ("_") reset the oscillators on the trig
        const cfg = Math.round(clamp(P[7], 0, 79));
        if (!(cfg & 1)) { p[0] = 0; p[1] = 0; }
        e[0] = 1; e[1] = 1; e[2] = 1;
        break;
      }
      case SY_RAW: if (Math.round(clamp(P[6], 0, 3)) < 2) { p[0] = 0; p[1] = 0; } e[0] = 1; break;
      case SY_CHIP: {
        // the arpeggio: TUN, then OF2..OF4 up to the first 0 (which restarts it)
        v.arp[0] = 0; let n = 1;
        for (let k = 3; k <= 5; k++) { const o = Math.round(clamp(P[k], -24, 24)); if (!o) break; v.arp[n++] = o; }
        v.arpN = n; v.arpShot = Math.round(clamp(P[7], 0, 65)) >= CHIP_ONESHOT; v.arpDone = false;
        v.step = 0; v.stepLeft = 0; e[0] = 1; s[0] = 1; s[1] = 0; s[3] = 0;
        break;
      }
      default: break;
    }
    v.gen = 1;
  }

  // --------------------------------------------------------------------------
  // Block preparation: machine coefficients, filter, amp, output gains
  // --------------------------------------------------------------------------

  prepare(v, atTrig) {
    const P = v.P;
    const m = v.m;
    const semi = P[1] + (v.note - 60); // TUN (+ trig note) for most machines
    const fb = v.fb;
    switch (m) {
      case BD_HARD: case BD_CLASSIC: case BD_SILKY: case BD_SHARP: case BD_ACOUSTIC: {
        v.base = 55 * exp2(semi / 12);
        const swt = P[4], dec = P[2], hld = P[3];
        v.k[0] = kTau(m === BD_HARD ? expT(swt, 0.0012, 0.25) : expT(swt, 0.001, 0.32));    // sweep
        fb[0] = m === BD_HARD ? 2.0 : 4.2 * Math.pow(clamp(P[5], 0, 127) / 127, 2);           // sweep depth (oct)
        fb[1] = m === BD_HARD ? 2.4 * Math.pow(clamp(P[5], 0, 127) / 127, 1.5) : 0;            // snap depth (oct)
        v.k[1] = kTau(0.0007);
        v.k[2] = k60(expT(dec, 0.03, 6));                                                     // body decay
        fb[2] = expT(hld, 0.0005, 0.6) * SR * (hld < 0.5 ? 0 : 1);                            // hold (samples)
        fb[3] = Math.pow(clamp(P[0], 0, 127) / 127, 2);                                       // LEV^2
        break;
      }
      case BD_FM: {
        v.base = 55 * exp2(semi / 12);
        v.k[0] = kTau(expT(P[4], 0.001, 0.25));      // carrier sweep
        v.k[1] = kTau(expT(P[5], 0.0008, 0.25));     // modulator sweep
        v.k[2] = k60(expT(P[2], 0.03, 5));           // carrier decay
        v.k[3] = k60(expT(P[6], 0.006, 2.5));        // FM decay
        fb[0] = 2.0; fb[1] = 1.0;
        fb[2] = 5.5 * Math.pow(clamp(P[3], 0, 127) / 127, 1.6); // FM index
        fb[3] = Math.pow(clamp(P[0], 0, 127) / 127, 2);
        fb[4] = 2 * exp2(P[7] / 12);                 // modulator ratio (octave up at 0)
        break;
      }
      case BD_PLASTIC: {
        v.base = 55 * exp2(semi / 12);
        v.k[0] = kTau(expT(P[5], 0.0003, 0.05));     // very fast sweeps: the plastic click
        fb[0] = 3.0 * Math.pow(clamp(P[6], 0, 127) / 127, 1.4);
        v.k[2] = k60(expT(P[2], 0.03, 4.5));
        fb[2] = 0.004 * SR;                          // short fixed hold
        fb[3] = Math.pow(clamp(P[0], 0, 127) / 127, 2);
        fb[4] = 1.8 * Math.pow(clamp(P[4], 0, 127) / 127, 2); // MOD^2: FM index
        fb[5] = Math.round(P[3]) >= 1 ? 0.45 : 0;    // TYP B: FM with ring modulation (A: FM only)
        break;
      }
      case SD_HARD: case SD_CLASSIC: case SD_FM: case SD_ACOUSTIC: case SD_NATURAL: {
        v.base = 185 * exp2(semi / 12);
        fb[3] = Math.pow(clamp(P[0], 0, 127) / 127, 2);
        if (m === SD_HARD) {
          v.k[0] = kTau(expT(P[7], 0.0008, 0.12));
          fb[0] = 2.2 * Math.pow(clamp(P[3], 0, 127) / 127, 1.5);
          v.k[2] = k60(expT(P[2], 0.03, 2.2));
          v.k[3] = k60(expT(P[2], 0.03, 2.2) * 0.93);
          v.k[4] = k60(expT(P[5], 0.03, 2.5));        // noise (linear fade time stored in fb[5])
          fb[5] = expT(P[5], 0.03, 2.5);
          fb[6] = Math.pow(clamp(P[6], 0, 127) / 127, 1.5);
          fb[7] = Math.pow(clamp(P[4], 0, 127) / 127, 2);
        } else if (m === SD_CLASSIC) {
          v.k[0] = kTau(0.0018);
          fb[0] = 1.4 * Math.pow(clamp(P[4], 0, 127) / 127, 1.5); // SNP
          fb[1] = exp2((clamp(P[3], 0, 127) / 127 * 24) / 12);     // DET: 0..24 semitones
          v.k[2] = k60(expT(P[2], 0.03, 2.2));
          v.k[3] = k60(expT(P[2], 0.03, 2.2) * 0.6);
          v.k[4] = k60(expT(P[5], 0.025, 2.5));
          fb[6] = Math.pow(clamp(P[6], 0, 127) / 127, 1.5);
          const bal = clamp(P[7], -64, 63) / 64;
          fb[4] = 0.5 - 0.5 * bal; fb[5] = 0.5 + 0.5 * bal;
        } else if (m === SD_FM) {
          v.k[0] = kTau(0.0025);
          fb[4] = 2 * exp2(P[3] / 12) * 0.5 + 0.0;           // modulator ratio
          v.k[3] = k60(expT(P[4], 0.005, 1.5));
          v.k[2] = k60(expT(P[2], 0.03, 2.2));
          fb[5] = expT(P[5], 0.03, 2.5);
          fb[6] = Math.pow(clamp(P[6], 0, 127) / 127, 1.5);
          fb[2] = 4.5 * Math.pow(clamp(P[7], 0, 127) / 127, 1.6);
        } else if (m === SD_ACOUSTIC) {
          v.k[0] = kTau(0.004);
          fb[0] = 1.5 * Math.pow(clamp(P[6], 0, 127) / 127, 1.5);
          v.k[2] = k60(expT(P[2], 0.04, 2.0));
          fb[2] = expT(P[5], 0.0005, 0.25) * SR;
          v.k[4] = k60(expT(P[3], 0.03, 2.5));
          fb[6] = Math.pow(clamp(P[4], 0, 127) / 127, 1.5);
          fb[7] = Math.pow(clamp(P[7], 0, 127) / 127, 1.2);
        } else {
          v.k[2] = k60(expT(P[2], 0.03, 2.0));          // BDY
          v.k[4] = k60(expT(P[3], 0.03, 2.5));          // DEC: noise
          const bal = clamp(P[4], 0, 127) / 127;
          fb[4] = 1 - bal; fb[5] = bal;
          fb[6] = svfG(expT(P[5], 400, 18000));        // noise LPF
          fb[7] = lpA(expT(P[6], 30, 9000));           // noise HPF
          fb[0] = 2 - 1.9 * clamp(P[7], 0, 127) / 127;  // noise resonance (SVF k)
        }
        break;
      }
      case RS_HARD: case RS_CLASSIC: {
        fb[3] = Math.pow(clamp(P[0], 0, 127) / 127, 2);
        fb[7] = clamp(P[m === RS_HARD ? 6 : 5], -64, 63) / 64;   // SYM
        v.k[2] = k60(expT(P[2], 0.008, 1.2));
        if (m === RS_HARD) {
          v.base = 455 * exp2(semi / 12);
          fb[1] = 3.66;
          v.k[0] = kTau(expT(P[7], 0.0005, 0.06));
          fb[0] = 1.5 * Math.pow(clamp(P[3], 0, 127) / 127, 1.5);
          fb[4] = 0.75; fb[5] = 0.25;
          fb[6] = Math.pow(clamp(P[5], 0, 127) / 127, 1.5);
          fb[2] = Math.pow(clamp(P[4], 0, 127) / 127, 2);
        } else {
          v.base = 455 * exp2((P[1] + v.note - 60) / 12);
          fb[1] = 3.66 * exp2((P[4] - P[1]) / 12);
          fb[0] = 0;
          const bal = clamp(P[3], -64, 63) / 64;
          fb[4] = 0.5 - 0.5 * bal; fb[5] = 0.5 + 0.5 * bal;
          fb[6] = Math.pow(clamp(P[6], 0, 127) / 127, 1.5);
          fb[2] = Math.pow(clamp(P[7], 0, 127) / 127, 2);
        }
        break;
      }
      case CP_CLASSIC: {
        fb[3] = Math.pow(clamp(P[0], 0, 127) / 127, 2);
        fb[0] = svfG(expT(P[1], 450, 4200));         // TON: band-pass centre
        fb[1] = expT(127 - clamp(P[4], 0, 127), 0.0035, 0.045) * SR; // RAT: higher = faster claps (spacing in samples)
        fb[2] = clamp(P[6], 0, 127) / 127;           // RND
        v.k[0] = k60(expT(P[7], 0.0015, 0.045));     // CPD: each clap
        v.k[1] = k60(expT(P[2], 0.05, 3.0));         // NOD: tail
        fb[4] = Math.pow(clamp(P[5], 0, 127) / 127, 1.5); // NOL: tail level
        break;
      }
      case BT_CLASSIC: case XT_CLASSIC: {
        // TUN shows -64..63: XT half a semitone a step (+-2.7 octaves), BT a quarter (+-16 semitones).
        // One circuit tuning for LT, MT and HT: their default kit values (+34, +44, +50) give G2, C3, D#3.
        const bt = m === BT_CLASSIC;
        const semis = clamp(P[1], -64, 63) * (bt ? 0.25 : 0.5);
        v.base = (bt ? 51.9 : 36.7) * exp2((semis + v.note - 60) / 12);
        fb[3] = Math.pow(clamp(P[0], 0, 127) / 127, 2);
        fb[0] = (bt ? 1.0 : 1.6) * Math.pow(clamp(P[bt ? 6 : 3], 0, 127) / 127, 1.3);   // SWD (oct)
        v.k[0] = bt ? kTau(0.017) : kTau(expT(P[4], 0.004, 0.4));                     // sweep
        fb[1] = expT(P[2], 0.04, bt ? 2.5 : 3.0);                                     // ring T60
        if (bt) {
          fb[2] = Math.round(clamp(P[5], 0, 3));      // SNP
          fb[4] = Math.pow(clamp(P[4], 0, 127) / 127, 2); // NOL
          v.k[1] = k60(0.06);
        } else {
          fb[4] = Math.pow(clamp(P[6], 0, 127) / 127, 2);  // NOL
          v.k[1] = k60(expT(P[5], 0.01, 1.2));             // NOD
          fb[5] = svfG(clamp(v.base * 6 * exp2(clamp(P[7], -64, 63) / 32), 80, 16000)); // TON follows TUN
        }
        break;
      }
      case CH_CLASSIC: case OH_CLASSIC: case CH_METALLIC: case OH_METALLIC: case HH_BASIC: case HH_LAB: {
        const bank = (m === CH_METALLIC || m === OH_METALLIC) ? BANK_METAL : m === HH_BASIC ? BANK_BASIC : BANK_808;
        const tm = exp2((clamp(P[1], -64, 63) * 0.5 + v.note - 60) / 12);   // TUN: half a semitone a step
        if (m === HH_LAB) {
          for (let i = 0; i < 6; i++) v.f[i] = 110 * exp2(clamp(P[HH_LAB_SLOTS[i]], 0, 127) / 127 * 7) * exp2((v.note - 60) / 12);
        } else for (let i = 0; i < 6; i++) v.f[i] = bank[i] * tm;
        fb[3] = Math.pow(clamp(P[0], 0, 127) / 127, 2);
        const open = m === OH_CLASSIC || m === OH_METALLIC;
        const dec = P[2];
        v.k[0] = (m === HH_LAB && dec >= 127) ? 1 : k60(open ? expT(dec, 0.12, 4.5) : expT(dec, 0.025, 1.8));
        v.k[1] = kTau(0.004);  // closed hat's fixed initial drop
        const col = (m === HH_BASIC ? P[3] : P[3]) || 0;
        const colOct = (m === CH_CLASSIC || m === OH_CLASSIC || m === HH_BASIC) ? clamp(col, -64, 63) / 64 * 1.5 : 0;
        fb[0] = svfG(clamp(6500 * exp2(colOct), 1200, 18000));   // high-pass corner (COL / TON)
        fb[1] = svfG(clamp(9500 * exp2(colOct * 0.5), 2000, 19000));
        if (m === HH_BASIC) {
          v.k[2] = k60(expT(P[4], 0.002, 0.08));    // TRD
          fb[4] = Math.pow(clamp(P[6], 0, 127) / 127, 1.5);
          v.k[3] = P[7] >= 127 ? 1 : k60(expT(P[7], 0.01, 2));
        }
        break;
      }
      case CY_CLASSIC: case CY_METALLIC: case CY_RIDE: {
        let bank = BANK_808;
        if (m === CY_METALLIC) bank = BANK_METAL2;
        if (m === CY_RIDE) { const ty = Math.round(clamp(P[3], 0, 3)); bank = ty === 0 ? BANK_808 : ty === 1 ? BANK_BASIC : ty === 2 ? BANK_METAL : BANK_METAL2; }
        const tm = exp2((clamp(P[1], -64, 63) * 0.5 + v.note - 60) / 12);
        for (let i = 0; i < 6; i++) v.f[i] = bank[i] * tm;
        fb[3] = Math.pow(clamp(P[0], 0, 127) / 127, 2);
        const colOct = m === CY_CLASSIC ? clamp(P[3], -64, 63) / 64 : 0;
        fb[0] = svfG(3400 * exp2(colOct));
        fb[1] = svfG(7000 * exp2(colOct));
        fb[2] = svfG(9000 * exp2(colOct * 0.7));
        v.k[2] = k60(expT(P[2], 0.25, 9));           // tail
        if (m === CY_CLASSIC) {
          const ton = clamp(P[4], -64, 63) / 64;
          fb[4] = 0.55 - 0.45 * ton; fb[5] = 0.25; fb[6] = 0.55 + 0.45 * ton;
          v.k[0] = k60(0.09); v.k[1] = k60(0.35);
        } else if (m === CY_METALLIC) {
          const ton = clamp(P[3], -64, 63) / 64;
          fb[4] = 0.6 - 0.4 * ton; fb[6] = 0.6 + 0.4 * ton;
          v.k[0] = k60(expT(P[4], 0.005, 0.6));       // TRD
        } else {
          v.k[0] = k60(expT(P[4], 0.01, 0.8));        // HIT
          v.k[1] = k60(expT(P[2], 0.2, 6));
          fb[4] = clamp(P[5], 0, 127) / 127; fb[5] = clamp(P[6], 0, 127) / 127; fb[6] = clamp(P[7], 0, 127) / 127;
        }
        break;
      }
      case CB_CLASSIC: case CB_METALLIC: {
        // firmware: oscillator 2 = TUN + DET/4 in TUN steps (half semitones); METALLIC halves TUN and takes DET whole
        const met = m === CB_METALLIC;
        const t = clamp(P[1], -64, 63) * (met ? 0.25 : 0.5);
        v.f[0] = 540 * exp2((t + v.note - 60) / 12);
        v.f[1] = v.f[0] * exp2(clamp(P[3], 0, 127) * (met ? 0.5 : 0.125) / 12);
        fb[3] = Math.pow(clamp(P[0], 0, 127) / 127, 2);
        fb[0] = 0.5 + clamp(P[4], -64, 63) / 64 * 0.45;
        fb[1] = 0.5 + clamp(P[5], -64, 63) / 64 * 0.45;
        v.k[0] = k60(0.025);                         // fixed first stage
        v.k[1] = k60(expT(P[2], 0.06, 3.0));          // DEC
        fb[2] = svfG(met ? 4200 : 2640);
        break;
      }
      case UT_NOISE: {
        fb[3] = Math.pow(clamp(P[0], 0, 127) / 127, 2);
        fb[0] = expT(P[1], 60, 20000);                // LPF
        fb[1] = lpA(expT(P[3], 20, 12000));           // HPF (one-pole)
        fb[2] = 2 - 1.92 * clamp(P[4], 0, 127) / 127; // LPQ
        fb[4] = clamp(P[7], -64, 63) / 64 * 5;        // sweep depth (oct)
        v.k[0] = kTau(expT(P[6], 0.001, 2.0));        // sweep time
        fb[5] = expT(P[5], 0.0005, 3.0) * SR;         // attack (samples)
        v.k[1] = P[2] >= 127 ? 1 : k60(expT(P[2], 0.01, 8));
        break;
      }
      case UT_IMPULSE: {
        fb[3] = Math.pow(clamp(P[0], 0, 127) / 127, 2);
        fb[0] = Math.max(1, expT(P[1], 0.00002, 0.5) * SR * (P[1] < 0.5 ? 0 : 1));
        v.k[0] = k60(expT(P[2], 0.0004, 2.0));
        fb[1] = Math.round(P[7]) ? -1 : 1;
        break;
      }
      case SY_DUAL_VCO: {
        v.base = 65.41 * exp2(semi / 12);
        fb[0] = exp2(clamp(P[3], -16, 16) / 12);     // DET (semitones)
        fb[1] = clamp(P[6], -64, 63) / 24;           // BND: 24 steps an octave
        v.k[0] = kTau(0.066);
        v.k[2] = P[2] >= 127 ? 1 : k60(expT(P[2], 0.02, 8));
        v.k[3] = P[4] >= 127 ? 1 : k60(expT(P[4], 0.02, 8));
        // BAL: 0 = both oscillators full; negative turns oscillator 2 down, positive oscillator 1
        const bal = clamp(P[5], -64, 63) / 64;
        fb[2] = bal > 0 ? 1 - bal : 1; fb[7] = bal < 0 ? 1 + bal : 1;
        fb[3] = Math.pow(clamp(P[0], 0, 127) / 127, 2);
        const cfg = Math.round(clamp(P[7], 0, 79));
        fb[4] = (cfg / 40) | 0 ? 3 : 0;              // osc 1 wave: sine / sinesaw
        fb[5] = ((cfg % 40) / 10) | 0;               // 0 mix, 1 ring, 2 FM, 3 FM + ring
        fb[6] = ((cfg % 10) / 2) | 0;                 // osc 2 wave: sine, skewed sine, triangle, sinesaw, saw
        break;
      }
      case SY_RAW: {
        v.base = 65.41 * exp2(semi / 12);
        fb[0] = exp2(clamp(P[3], -24, 24) / 12);
        v.k[2] = P[2] >= 127 ? 1 : k60(expT(P[2], 0.02, 8));
        fb[2] = clamp(P[7], -64, 63) / 64;
        fb[3] = Math.pow(clamp(P[0], 0, 127) / 127, 2);
        fb[4] = Math.round(clamp(P[5], 0, 6));
        fb[5] = Math.round(clamp(P[6], 0, 3));
        fb[6] = Math.pow(clamp(P[4], 0, 127) / 127, 1.5);
        break;
      }
      case SY_CHIP: {
        v.base = 65.41 * exp2(semi / 12);
        fb[3] = Math.pow(clamp(P[0], 0, 127) / 127, 2);
        v.k[2] = P[2] >= 127 ? 1 : k60(expT(P[2], 0.02, 8));
        const spd = Math.round(clamp(P[7], 0, 65));
        // SPD: note values of the tempo (0..23), fixed rates in Hz, single-shot rates (57..65)
        fb[5] = spd < 24 ? CHIP_NOTEV[spd] * 4 * 60 / this.bpm * SR : SR / CHIP_HZ[Math.min(CHIP_HZ.length - 1, spd - 24)];
        fb[6] = Math.round(clamp(P[6], 0, 127));
        break;
      }
      default: break;
    }

    // ---- Filter -------------------------------------------------------------
    const typ = Math.round(clamp(P[IX_FLT_TYP], 0, 6));
    v.fType = typ;
    v.fBaseOct = (P[IX_FLT_FRQ] - 60) / 12;          // octaves re 440 Hz
    v.fEnvOct = clamp(P[IX_FLT_ENV], -64, 64) * 2 / 12;
    const res = clamp(P[IX_FLT_RES], 0, 127) / 127;
    v.fRes = res;
    const pk = typ === 6;
    v.kk = pk ? 0.7 : 2 - 1.96 * res;
    v.m0 = typ >= 3 ? 1 : 0;
    v.m2 = typ === 0 || typ === 1 ? 1 : typ === 3 || typ === 4 ? -1 : 0;
    v.m1 = typ === 1 ? 1 : typ === 2 ? 0.5 + 0.5 * v.kk : typ === 3 ? 1 - v.kk : pk ? res * 4 * v.kk : typ >= 4 ? -v.kk : 0;
    v.feAtk = 1 / Math.max(1, (P[IX_FLT_ATK] < 0.5 ? 0.0003 : expT(P[IX_FLT_ATK], 0.0005, 8)) * SR);
    v.feKd = k60(expT(P[IX_FLT_DEC], 0.003, 10));
    v.feKr = k60(expT(P[IX_FLT_REL], 0.003, 10));
    v.feSus = clamp(P[IX_FLT_SUS], 0, 127) / 127;
    // ---- Amp ----------------------------------------------------------------
    const atk = P[IX_AMP_ATK];
    v.ampAtk = 1 / Math.max(1, (atk < 0.5 ? 0.0004 : expT(atk, 0.0006, 7)) * SR);
    const hld = P[IX_AMP_HLD];
    v.ampHoldS = hld < 0.5 ? -1 : expT(hld, 0.001, 6) * SR;
    v.ampInf = P[IX_AMP_DEC] >= 126.5;
    v.ampKd = v.ampInf ? 1 : k60(expT(P[IX_AMP_DEC], 0.006, 9));
    if (atTrig && v.ampHoldLeft < 0) v.ampHoldLeft = v.ampHoldS;
    // ---- Drive and output -----------------------------------------------------
    const ovr = clamp(P[IX_AMP_OVR], 0, 127) / 127;
    v.drv = ovr;
    v.drvG = 1 + ovr * ovr * 14;
    v.drvN = 1 / Math.sqrt(v.drvG) * (1 + ovr * 0.6);
    const vol = clamp(P[IX_AMP_VOL], 0, 127) / 100;
    const trk = clamp(P[IX_TRK_LEV], 0, 127) / 100;
    let velG = P[IX_VEL_VOL] > 0.5 ? v.vel : 1;
    if (v.acc) velG *= 1 + clamp(P[IX_ACC_LEV], 0, 127) / 127;
    v.gain = vol * vol * trk * trk * velG * 0.55;
    const pan = clamp(P[IX_AMP_PAN], -64, 63) / 64;
    v.gl = pan > 0 ? 1 - pan : 1;
    v.gr = pan < 0 ? 1 + pan : 1;
    v.dsend = Math.pow(clamp(P[IX_AMP_DEL], 0, 127) / 127, 2);
    v.rsend = Math.pow(clamp(P[IX_AMP_REV], 0, 127) / 127, 2);
    // ---- Sample layer --------------------------------------------------------
    if (v.sOn && v.sBuf) {
      v.sInc = exp2((P[IX_SMP_TUN] + P[IX_SMP_FIN] / 64 + v.note - 60) / 12) * (v.sRev ? -1 : 1);
      v.sGain = Math.pow(clamp(P[IX_SMP_LEV], 0, 127) / 127, 2) * v.vel;
      v.sLoop = P[IX_SMP_LOP] > 0.5;
      const br = clamp(P[IX_SMP_BR], 0, 127);
      v.sQ = br < 0.5 ? 0 : Math.pow(2, 15 - br / 127 * 14);
    }
  }

  // --------------------------------------------------------------------------
  // Generators: write the machine's output for samples [i0, i1) into G
  // --------------------------------------------------------------------------

  generate(v, G, i0, i1) {
    const e = v.e, k = v.k, p = v.p, fb = v.fb, h = v.h, s = v.s;
    let alive = 0;
    switch (v.m) {
      case BD_HARD: case BD_CLASSIC: case BD_SILKY: case BD_SHARP: case BD_ACOUSTIC: {
        const P = v.P;
        const m = v.m;
        const wv = m === BD_SHARP || m === BD_ACOUSTIC ? Math.round(clamp(P[6], 0, 11)) >> 1 : m === BD_SILKY ? 0 : Math.round(clamp(P[6], 0, 2));
        const base = v.base, lev = fb[3];
        const hold = fb[2];
        const tic = m === BD_HARD || m === BD_SHARP ? Math.pow(clamp(P[7], 0, 127) / 127, 2) : 0;
        const tra = m === BD_CLASSIC ? Math.round(clamp(P[7], 0, 55)) : 0;
        const traClick = tra ? ((tra % 4) + 1) / 4 : 0, traNoise = tra ? ((tra >> 2) % 7) / 6 : 0, traBright = tra >= 28;
        const dus = m === BD_SILKY ? Math.pow(clamp(P[6], 0, 127) / 127 * lev, 1) : 0;
        const clk = m === BD_SILKY ? Math.pow(clamp(P[7], 0, 127) / 127, 2) : 0;
        const imp = m === BD_ACOUSTIC ? Math.pow(clamp(P[7], 0, 127) / 127, 1.2) : 0;
        const settle = m === BD_HARD;
        for (let i = i0; i < i1; i++) {
          const t = v.t++;
          // pitch: sweep + snap
          const oct = fb[0] * e[0] + fb[1] * e[1];
          e[0] *= k[0]; e[1] *= k[1];
          const f = base * exp2(oct);
          const dt = f * INV_SR;
          p[0] += dt; if (p[0] >= 1) p[0] -= 1;
          let y = wave(p[0], wv, dt);
          // body: BD HARD peaks and settles a little during the hold
          let a = e[2];
          if (t < hold) { if (settle) e[3] += (0.78 - e[3]) * 0.0025; }
          else e[2] *= k[2];
          if (settle) a *= e[3];
          y *= a * lev;
          // digital layer
          if (tic && t < CLICK_N) y += CLICK[t] * 0.42 * tic * lev;
          if (m === BD_SHARP && tic && t < TICK.length) y += TICK[t] * tic * lev * 0.8;
          if (traClick && t < CLICK_N) y += CLICK[t] * 0.4 * traClick * lev;
          if (traNoise && t < 1200) { const n = v.noise(); s[0] += (traBright ? 0.6 : 0.15) * (n - s[0]); y += s[0] * traNoise * 0.5 * lev * Math.exp(-t / 160); }
          if (m === BD_HARD && t < 900) { const n = v.noise(); s[0] += 0.3 * (n - s[0]); y += s[0] * 0.06 * lev * (1 - t / 900); }
          if (dus) { const n = v.noise(); s[1] += 0.2 * (n - s[1]); y += s[1] * dus * 0.35 * e[2]; }
          if (clk) { y += clk * lev * 0.9 * Math.exp(-t / 34); }
          if (imp && t < BEATER.length) y += BEATER[t] * imp * lev * 0.7;
          G[i] = y;
        }
        alive = e[2] * lev;
        break;
      }
      case BD_FM: {
        const base = v.base, lev = fb[3], idx = fb[2], ratio = fb[4];
        for (let i = i0; i < i1; i++) {
          const t = v.t++;
          const fc = base * exp2(fb[0] * e[0]);
          const fm = base * ratio * exp2(fb[1] * e[1]);
          e[0] *= k[0]; e[1] *= k[1];
          p[1] += fm * INV_SR; if (p[1] >= 1) p[1] -= 1;
          p[0] += fc * INV_SR; if (p[0] >= 1) p[0] -= 1;
          const mod = sin2pi(p[1]) * idx * e[3];
          e[3] *= k[3];
          const y = sin2pi(p[0] + mod * 0.159);
          // short fixed punch, then DEC
          if (t > 0.005 * SR) e[2] *= k[2];
          G[i] = y * e[2] * lev + (t < BUMP_N ? BUMP[t] * 0.15 * lev : 0);
        }
        alive = e[2] * lev;
        break;
      }
      case BD_PLASTIC: {
        const base = v.base, lev = fb[3], hold = fb[2], fmi = fb[4], ring = fb[5];
        const tic = Math.pow(clamp(v.P[7], 0, 127) / 127, 2);
        for (let i = i0; i < i1; i++) {
          const t = v.t++;
          const f = base * exp2(fb[0] * e[0]);
          e[0] *= k[0];
          const dt = f * INV_SR;
          p[1] += dt; if (p[1] >= 1) p[1] -= 1;
          const m2 = wave(p[1], 3, dt);
          p[0] += dt; if (p[0] >= 1) p[0] -= 1;
          let y = sin2pi(p[0] + m2 * fmi * 0.159);
          if (ring) y = y * (1 - ring) + y * m2 * ring * 1.6;
          if (t >= hold) e[2] *= k[2];
          y *= e[2] * lev;
          if (tic && t < 32) y += (t < 8 ? t / 8 : t < 24 ? 1 - (t - 8) / 8 : (t - 32) / 8 * 0) * tic * lev * 0.7;
          G[i] = y;
        }
        alive = e[2] * lev;
        break;
      }
      case SD_HARD: {
        const base = v.base, lev = fb[3];
        const nLev = fb[6], tic = fb[7], nDur = fb[5] * SR;
        for (let i = i0; i < i1; i++) {
          const t = v.t++;
          const oct = fb[0] * e[0];
          e[0] *= k[0];
          const f = base * exp2(oct);
          p[0] += f * INV_SR; if (p[0] >= 1) p[0] -= 1;       // low tone (3x louder)
          p[1] += f * 1.5 * INV_SR; if (p[1] >= 1) p[1] -= 1; // a fifth up
          let y = sin2pi(p[0]) * e[2] * 0.75 + sin2pi(p[1]) * e[3] * 0.25;
          e[2] *= k[2]; e[3] *= k[3];
          // wires: band-limited noise, fading linearly over NOD
          if (t < nDur) {
            const n = v.noise();
            s[0] = 0.88 * (s[0] + n - s[1]); s[1] = n;   // high-pass
            s[2] += 0.55 * (s[0] - s[2]);                 // gentle low-pass
            y += s[2] * nLev * (1 - t / nDur) * 0.9;
          }
          if (tic && t < CLICK_N) y += CLICK[t] * 0.36 * tic;
          G[i] = y * lev;
        }
        alive = Math.max(e[2], v.t < nDur ? 1 - v.t / nDur : 0) * lev;
        break;
      }
      case SD_CLASSIC: case SD_FM: case SD_ACOUSTIC: case SD_NATURAL: {
        const m = v.m, base = v.base, lev = fb[3];
        for (let i = i0; i < i1; i++) {
          const t = v.t++;
          let y = 0;
          if (m === SD_CLASSIC) {
            const oct = fb[0] * e[0]; e[0] *= k[0];
            const f = base * exp2(oct);
            p[0] += f * INV_SR; if (p[0] >= 1) p[0] -= 1;
            p[1] += f * fb[1] * INV_SR; if (p[1] >= 1) p[1] -= 1;
            y = (wave(p[0], 2, 0) * 0.6 + sin2pi(p[0]) * 0.4) * e[2] * fb[4] + sin2pi(p[1]) * e[3] * fb[5];
            e[2] *= k[2]; e[3] *= k[3];
            const n = v.noise();
            s[0] = 0.86 * (s[0] + n - s[1]); s[1] = n;
            s[2] += 0.6 * (s[0] - s[2]);
            y += s[2] * fb[6] * e[4] * 0.9;
            e[4] *= k[4];
            if (t < BUMP_N) y += BUMP[t] * 0.3;
          } else if (m === SD_FM) {
            const blip = 0.7 * e[0]; e[0] *= k[0];
            const f = base * exp2(blip);
            p[1] += f * fb[4] * INV_SR; if (p[1] >= 1) p[1] -= 1;
            p[0] += f * INV_SR; if (p[0] >= 1) p[0] -= 1;
            y = sin2pi(p[0] + sin2pi(p[1]) * fb[2] * e[3] * 0.159) * e[2];
            e[2] *= k[2]; e[3] *= k[3];
            const nd = fb[5] * SR;
            if (t < nd) { const n = v.noise(); s[0] = 0.86 * (s[0] + n - s[1]); s[1] = n; y += s[0] * fb[6] * (1 - t / nd) * 0.8; }
            if (t < BUMP_N) y += BUMP[t] * 0.24;
          } else if (m === SD_ACOUSTIC) {
            const oct = fb[0] * e[0]; e[0] *= k[0];
            const f = base * exp2(oct);
            p[0] += f * INV_SR; if (p[0] >= 1) p[0] -= 1;
            p[1] += f * 1.4983 * INV_SR; if (p[1] >= 1) p[1] -= 1;
            y = (sin2pi(p[0]) + sin2pi(p[1]) * 0.17) * e[2] * 0.85;
            if (t >= fb[2]) e[2] *= k[2];
            const n = v.noise();
            s[0] = 0.9 * (s[0] + n - s[1]); s[1] = n;
            s[2] += 0.45 * (s[0] - s[2]);
            y += s[2] * fb[6] * e[4]; e[4] *= k[4];
            if (fb[7] && t < STICK.length) y += STICK[t] * fb[7];
          } else {
            p[1] += base * INV_SR; if (p[1] >= 1) p[1] -= 1;
            y = sin2pi(p[1]) * e[2] * fb[4];
            if (t > 0.0007 * SR) e[2] *= k[2];
            // noise through its own SVF (LPF + RES) and a one-pole HPF
            const n = v.noise();
            const g = fb[6], kq = fb[0];
            const a1 = 1 / (1 + g * (g + kq)), a2 = g * a1, a3 = g * a2;
            const v3 = n - s[5]; const v1 = a1 * s[4] + a2 * v3; const v2 = s[5] + a2 * s[4] + a3 * v3;
            s[4] = 2 * v1 - s[4]; s[5] = 2 * v2 - s[5];
            s[6] += fb[7] * (v2 - s[6]);
            y += (v2 - s[6]) * fb[5] * e[4] * 0.9; e[4] *= k[4];
            if (t < 32) y += (1 - t / 32) * 0.3;
          }
          G[i] = y * lev;
        }
        alive = Math.max(e[2], e[4] || 0, m === SD_FM ? (v.t < fb[5] * SR ? 1 : 0) : 0) * lev;
        break;
      }
      case RS_HARD: case RS_CLASSIC: {
        const base = v.base, lev = fb[3], sym = fb[7], ratio = fb[1];
        for (let i = i0; i < i1; i++) {
          const t = v.t++;
          const oct = fb[0] * e[0]; e[0] *= k[0];
          const f = base * exp2(oct);
          p[0] += f * INV_SR; if (p[0] >= 1) p[0] -= 1;
          p[1] += f * ratio * INV_SR; if (p[1] >= 1) p[1] -= 1;
          let x = (sin2pi(p[0]) * fb[4] + sin2pi(p[1]) * fb[5]) * 2.2;
          // asymmetric clipping: the rim's knock
          x = tanhF(x + sym * 0.9) - tanhF(sym * 0.9);
          let y = x * e[2] * 0.7;
          e[2] *= k[2];
          if (t < 1400) { const n = v.noise(); s[0] = 0.8 * (s[0] + n - s[1]); s[1] = n; y += s[0] * fb[6] * Math.exp(-t / 220) * 0.6; }
          if (fb[2] && t < CLICK_N) y += CLICK[t] * 0.47 * fb[2];
          G[i] = y * lev;
        }
        alive = e[2] * lev;
        break;
      }
      case CP_CLASSIC: {
        const lev = fb[3], g = fb[0], kq = 1.1;
        const a1 = 1 / (1 + g * (g + kq)), a2 = g * a1, a3 = g * a2;
        for (let i = i0; i < i1; i++) {
          v.t++;
          // bursts: NUM claps RAT apart (RND jitter), each decaying by CPD, then the tail
          if (v.clapLeft > 0) {
            if (v.clapNext <= 0) {
              v.clapLeft--;
              e[0] = 1;
              if (v.clapLeft === 0) e[1] = 1;
              v.clapNext = fb[1] * (1 + (rnd() - 0.5) * fb[2] * 1.2);
            }
            v.clapNext--;
          }
          const n = v.noise();
          const env = e[0] + e[1] * fb[4] * 0.8;
          e[0] *= k[0]; e[1] *= k[1];
          const x = n * env;
          const v3 = x - s[1]; const v1 = a1 * s[0] + a2 * v3; const v2 = s[1] + a2 * s[0] + a3 * v3;
          s[0] = 2 * v1 - s[0]; s[1] = 2 * v2 - s[1];
          G[i] = (v1 * 2.4 + (x - kq * v1 - v2) * 0.25) * lev;
        }
        alive = Math.max(e[0], e[1], v.clapLeft > 0 ? 1 : 0) * lev;
        break;
      }
      case BT_CLASSIC: case XT_CLASSIC: {
        const bt = v.m === BT_CLASSIC;
        const lev = fb[3];
        const T60 = fb[1];
        const r = Math.exp(-LN1000 / (T60 * SR));
        const snapLen = bt ? fb[2] * 0.004 * SR * 75 / Math.max(40, v.base) : 0;
        for (let i = i0; i < i1; i++) {
          const t = v.t++;
          if ((t & 15) === 0) {
            const f = v.base * exp2(fb[0] * e[0]);
            const rr = t < snapLen ? r * 0.996 : r;
            const w = TWO_PI * clamp(f, 10, SR * 0.45) * INV_SR;
            h[1] = 2 * rr * Math.cos(w); h[2] = rr * rr; h[3] = Math.sin(w);
          }
          e[0] *= k[0];
          // strike: a short raised-cosine pulse into the resonator
          const exc = t < 96 ? (1 - Math.cos(TWO_PI * t / 96)) * 0.5 : 0;
          const y0 = h[1] * s[0] - h[2] * s[1] + exc * h[3] * 0.024;
          s[1] = s[0]; s[0] = y0;
          let y = tanhF(y0 * 1.3) * 0.85;
          if (fb[4]) {
            const n = v.noise();
            if (bt) { s[2] += 0.4 * (n - s[2]); y += s[2] * fb[4] * e[1]; }
            else {
              const g = fb[5], kq = 1.4, a1 = 1 / (1 + g * (g + kq)), a2 = g * a1, a3 = g * a2;
              const v3 = n - s[3]; const v1 = a1 * s[2] + a2 * v3; const v2 = s[3] + a2 * s[2] + a3 * v3;
              s[2] = 2 * v1 - s[2]; s[3] = 2 * v2 - s[3];
              y += v1 * fb[4] * e[1] * 1.5;
            }
            e[1] *= k[1];
          }
          G[i] = y * lev;
        }
        alive = (Math.abs(s[0]) + Math.abs(s[1]) + e[1] * fb[4]) * lev + (v.t < 200 ? 1 : 0);
        break;
      }
      case CH_CLASSIC: case OH_CLASSIC: case CH_METALLIC: case OH_METALLIC: case HH_BASIC: case HH_LAB: {
        const m = v.m, lev = fb[3];
        const f = v.f;
        const dt0 = f[0] * INV_SR, dt1 = f[1] * INV_SR, dt2 = f[2] * INV_SR, dt3 = f[3] * INV_SR, dt4 = f[4] * INV_SR, dt5 = f[5] * INV_SR;
        const gH = fb[0], gB = fb[1];
        const closed = m === CH_CLASSIC || m === CH_METALLIC || m === HH_BASIC || m === HH_LAB;
        const metal = m === CH_METALLIC || m === OH_METALLIC;
        for (let i = i0; i < i1; i++) {
          const t = v.t++;
          p[0] += dt0; if (p[0] >= 1) p[0] -= 1; p[1] += dt1; if (p[1] >= 1) p[1] -= 1; p[2] += dt2; if (p[2] >= 1) p[2] -= 1;
          p[3] += dt3; if (p[3] >= 1) p[3] -= 1; p[4] += dt4; if (p[4] >= 1) p[4] -= 1; p[5] += dt5; if (p[5] >= 1) p[5] -= 1;
          let x;
          if (metal) {
            // ring-modulated pairs: harder, clangorous
            x = (pulse(p[0], 0.5, dt0) * pulse(p[3], 0.5, dt3) + pulse(p[1], 0.5, dt1) * pulse(p[4], 0.5, dt4) + pulse(p[2], 0.5, dt2) * pulse(p[5], 0.5, dt5)) * 0.18;
          } else {
            x = (pulse(p[0], 0.5, dt0) + pulse(p[1], 0.5, dt1) + pulse(p[2], 0.5, dt2) + pulse(p[3], 0.5, dt3) + pulse(p[4], 0.5, dt4) + pulse(p[5], 0.5, dt5)) * 0.166;
          }
          if (m === HH_BASIC && fb[4]) x += v.noise() * fb[4] * e[3] * 0.8;
          // band-pass then high-pass (the metal path), COL moves both
          const kb = 1.6, a1 = 1 / (1 + gB * (gB + kb)), a2 = gB * a1, a3 = gB * a2;
          let v3 = x - s[1]; let v1 = a1 * s[0] + a2 * v3; let v2 = s[1] + a2 * s[0] + a3 * v3;
          s[0] = 2 * v1 - s[0]; s[1] = 2 * v2 - s[1];
          const bp = v1;
          const kh = 1.3, b1 = 1 / (1 + gH * (gH + kh)), b2 = gH * b1, b3 = gH * b2;
          v3 = bp - s[3]; v1 = b1 * s[2] + b2 * v3; v2 = s[3] + b2 * s[2] + b3 * v3;
          s[2] = 2 * v1 - s[2]; s[3] = 2 * v2 - s[3];
          const hp = bp - kh * v1 - v2;
          // envelope: the closed path drops fast at first, then DEC
          let env = e[0];
          if (closed) { env *= 0.45 + 0.55 * e[1]; e[1] *= k[1]; }
          if (m === HH_BASIC) { env *= 0.6 + 0.4 * e[2]; e[2] *= k[2]; e[3] *= k[3]; }
          e[0] *= k[0];
          let y = hp * env * 4.6;
          if (m === HH_BASIC && t < 16) y += (1 - t / 16) * 0.35;
          G[i] = y * lev * (m === HH_LAB ? 1.6 : 1);
        }
        alive = e[0] * lev;
        break;
      }
      case CY_CLASSIC: case CY_METALLIC: case CY_RIDE: {
        const m = v.m, lev = fb[3], f = v.f;
        const dts = v.dts;
        for (let j = 0; j < 6; j++) dts[j] = f[j] * INV_SR;
        for (let i = i0; i < i1; i++) {
          const t = v.t++;
          let x = 0;
          for (let j = 0; j < 6; j++) { p[j] += dts[j]; if (p[j] >= 1) p[j] -= 1; x += pulse(p[j], 0.5, dts[j]); }
          x *= 0.166;
          if (m === CY_METALLIC || (m === CY_RIDE && Math.round(v.P[3]) >= 2)) x = x * (pulse(p[0] * 1.37 % 1, 0.5, dts[0]) * 0.5 + 0.5);
          // three bands
          let out = 0;
          for (let b = 0; b < 3; b++) {
            const g = fb[b], kq = b === 2 ? 1.2 : 1.5;
            const a1 = 1 / (1 + g * (g + kq)), a2 = g * a1, a3 = g * a2;
            const o = 4 + b * 2;
            const v3 = x - s[o + 1]; const v1 = a1 * s[o] + a2 * v3; const v2 = s[o + 1] + a2 * s[o] + a3 * v3;
            s[o] = 2 * v1 - s[o]; s[o + 1] = 2 * v2 - s[o + 1];
            const y = b === 2 ? x - kq * v1 - v2 : v1;
            let lvl;
            if (m === CY_CLASSIC) lvl = b === 0 ? fb[4] * e[0] : b === 1 ? fb[5] * e[1] : fb[6] * e[2];
            else if (m === CY_METALLIC) lvl = b === 0 ? fb[4] * e[0] * 0.8 : b === 1 ? fb[4] * e[0] * 0.5 : fb[6] * e[2];
            else lvl = b === 0 ? fb[4] * e[0] : b === 1 ? fb[5] * e[1] : fb[6] * e[2];
            out += y * lvl;
          }
          e[0] *= k[0]; e[1] *= (m === CY_CLASSIC ? k[1] : m === CY_RIDE ? k[1] : k[2]); e[2] *= k[2];
          let y = out * 3.6;
          if ((m === CY_METALLIC || m === CY_RIDE) && t < 48) y += v.noise() * (1 - t / 48) * 0.5;
          G[i] = y * lev;
        }
        alive = Math.max(e[0], e[1], e[2]) * lev;
        break;
      }
      case CB_CLASSIC: case CB_METALLIC: {
        const lev = fb[3], f = v.f, g = fb[2], kq = v.m === CB_METALLIC ? 0.9 : 1.2;
        const dt0 = f[0] * INV_SR, dt1 = f[1] * INV_SR;
        const a1 = 1 / (1 + g * (g + kq)), a2 = g * a1, a3 = g * a2;
        for (let i = i0; i < i1; i++) {
          v.t++;
          p[0] += dt0; if (p[0] >= 1) p[0] -= 1; p[1] += dt1; if (p[1] >= 1) p[1] -= 1;
          const x = (pulse(p[0], fb[0], dt0) + pulse(p[1], fb[1], dt1)) * 0.5;
          const v3 = x - s[1]; const v1 = a1 * s[0] + a2 * v3; const v2 = s[1] + a2 * s[0] + a3 * v3;
          s[0] = 2 * v1 - s[0]; s[1] = 2 * v2 - s[1];
          const y = v.m === CB_METALLIC ? (x - kq * v1 - v2) * 0.5 + v1 * 0.8 : v1 * 1.4 + v2 * 0.25;
          const env = 0.35 * e[0] + 0.65 * e[1];
          e[0] *= k[0]; e[1] *= k[1];
          G[i] = y * env * lev * 0.95;
        }
        alive = Math.max(e[0], e[1]) * lev;
        break;
      }
      case UT_NOISE: {
        const lev = fb[3], kq = fb[2];
        for (let i = i0; i < i1; i++) {
          const t = v.t++;
          if ((t & 7) === 0) { h[1] = svfG(clamp(fb[0] * exp2(fb[4] * e[1]), 20, 20000)); }
          e[1] *= k[0];
          const atkN = fb[5];
          if (t < atkN) e[0] = t / atkN; else e[0] = (t === Math.ceil(atkN) ? 1 : e[0]) * k[1];
          const g = h[1], a1 = 1 / (1 + g * (g + kq)), a2 = g * a1, a3 = g * a2;
          const n = v.noise();
          const v3 = n - s[1]; const v1 = a1 * s[0] + a2 * v3; const v2 = s[1] + a2 * s[0] + a3 * v3;
          s[0] = 2 * v1 - s[0]; s[1] = 2 * v2 - s[1];
          s[2] += fb[1] * (v2 - s[2]);
          G[i] = (v2 - s[2]) * e[0] * lev * 0.9;
        }
        alive = (v.t < fb[5] ? 1 : e[0]) * lev;
        break;
      }
      case UT_IMPULSE: {
        const lev = fb[3], atkN = fb[0], pol = fb[1];
        for (let i = i0; i < i1; i++) {
          const t = v.t++;
          if (t < atkN) e[0] = (t + 1) / atkN; else e[0] *= k[0];
          G[i] = e[0] * pol * lev;
        }
        alive = e[0] * lev;
        break;
      }
      case SY_DUAL_VCO: {
        const lev = fb[3], w1 = fb[4], mode = fb[5], w2 = fb[6], g1 = fb[2], g2 = fb[7];
        // FM modes: oscillator 2's level (BAL) is the modulation depth (firmware: BAL^2)
        const fmAmt = (mode === 2 || mode === 3) ? g2 * g2 * 1.6 : 0;
        for (let i = i0; i < i1; i++) {
          v.t++;
          const bend = fb[1] * e[0]; e[0] *= k[0];
          const f1 = v.base * exp2(bend), f2 = f1 * fb[0];
          const d1 = f1 * INV_SR, d2 = f2 * INV_SR;
          p[1] += d2; if (p[1] >= 1) p[1] -= 1;
          const o2 = wave(p[1], w2 === 1 ? 1 : w2, d2);
          p[0] += d1; if (p[0] >= 1) p[0] -= 1;
          let o1;
          if (fmAmt) { let q = p[0] + o2 * fmAmt * e[2] * 0.159; q -= Math.floor(q); o1 = wave(q, w1, d1); }
          else o1 = wave(p[0], w1, d1);
          let y;
          const a1 = e[1], a2 = e[2];
          if (mode === 1 || mode === 3) y = o1 * o2 * 0.9 * a1 * g1;
          else if (mode === 2) y = o1 * a1 * g1;
          else y = (o1 * a1 * g1 + o2 * a2 * g2) * 0.6;
          e[1] *= k[2]; e[2] *= k[3];
          G[i] = y * lev * 0.9;
        }
        alive = Math.max(e[1], e[2]) * lev;
        break;
      }
      case SY_RAW: {
        const lev = fb[3], w1 = fb[4], w2 = fb[5], bal = fb[2], nl = fb[6];
        for (let i = i0; i < i1; i++) {
          v.t++;
          const f2 = v.base, f1 = f2 * fb[0];
          const d1 = f1 * INV_SR, d2 = f2 * INV_SR;
          p[0] += d1; if (p[0] >= 1) p[0] -= 1;
          p[1] += d2; if (p[1] >= 1) p[1] -= 1;
          const o2 = (w2 & 1) ? wave(p[1], 3, d2) : sin2pi(p[1]);
          let o1;
          switch (w1) { case 0: o1 = sin2pi(p[0]); break; case 1: o1 = wave(p[0], 1, d1); break; case 2: o1 = wave(p[0], 2, d1); break; case 3: o1 = wave(p[0], 3, d1); break;
            case 4: { const sk = 0.8; o1 = p[0] < sk ? p[0] / sk * 2 - 1 : 1 - (p[0] - sk) / (1 - sk) * 2; break; } case 5: o1 = wave(p[0], 4, d1); break;
            default: o1 = (p[0] < 0.5 ? 1 : -1) * o2; }   // RING: oscillator 1 ring-modulates oscillator 2 with a square
          let y = o1 * (0.5 - 0.5 * bal) + o2 * (0.5 + 0.5 * bal);
          if (nl) y += v.noise() * nl * 0.6;
          y *= e[0]; e[0] *= k[2];
          G[i] = y * lev * 0.9;
        }
        alive = e[0] * lev;
        break;
      }
      case SY_CHIP: {
        const lev = fb[3], prog = fb[6], len = fb[5];
        for (let i = i0; i < i1; i++) {
          const t = v.t++;
          // the arpeggio: a note every SPD; single-shot stops on its last note
          if (v.stepLeft <= 0) {
            if (t > 0) {
              if (v.step + 1 < v.arpN) v.step++;
              else if (!v.arpShot) v.step = 0;
              else v.arpDone = true;
            }
            v.stepLeft = len;
            s[1] = v.base * exp2(v.arp[v.step] / 12);
            s[3] = 0;                                  // samples into this note
          }
          v.stepLeft--;
          const f = s[1], dt = f * INV_SR;
          p[0] += dt; if (p[0] >= 1) p[0] -= 1;
          const nt = s[3]++;
          let y;
          if (prog <= 5) y = wave(p[0], prog, dt);
          else if (prog === 6) { if (p[0] < dt) s[2] = v.noise() < 0 ? -1 : 1; y = s[2]; }          // pitched chip noise
          else if (prog <= 10) {                                                                     // ANM1-4: ring-modulated pairs
            const a = CHIP_ANIM[prog - 7];
            p[1] += dt * a[2]; if (p[1] >= 1) p[1] -= 1;
            y = wave(p[0], a[0], dt) * wave(p[1], a[1], dt * a[2]);
          } else if (prog === 11) { const tb = CHIP_TBL[0]; y = wave(p[0], tb[v.step % tb.length], dt); } // ANM5: a new wave every note
          else if (prog <= 13) {                                                                     // PWM+ from 50 %, PWM- from 10 %, swept over each note
            const ph = Math.min(1, nt / Math.max(1, len));
            const w = prog === 12 ? 0.5 - 0.42 * ph : 0.1 + 0.4 * ph;
            y = pulse(p[0], w, dt);
          } else if (prog <= 25) {                                                                   // .WAV +WAV WAV+ WAV*: noise frames around the wave
            const wv = prog <= 17 ? 2 : prog <= 21 ? 4 : 5;
            const q = (prog - 14) & 3;
            const frame = (t / Math.max(1, len)) | 0;                                                // SPD periods since the trig
            const noisy = q === 0 ? t < 0.006 * SR : q === 1 ? frame === 0 : q === 2 ? frame === 1 : frame === 1 || frame === 2;
            if (noisy) { if (p[0] < dt) s[2] = v.noise() < 0 ? -1 : 1; y = s[2]; } else y = wave(p[0], wv, dt);
          } else if (prog <= 28) {                                                                   // TBL1-3: a noise burst, then alternating waves
            const tb = CHIP_TBL[prog - 25];
            if (t < 0.006 * SR) { if (p[0] < dt) s[2] = v.noise() < 0 ? -1 : 1; y = s[2]; } else y = wave(p[0], tb[v.step % tb.length], dt);
          } else y = pulse(p[0], clamp((prog - 28) / 100, 0.01, 0.99), dt);                          // P1 % .. P99 %
          y *= e[0]; e[0] *= k[2];
          G[i] = y * lev * 0.5;
        }
        alive = e[0] * lev;
        break;
      }
      default:
        for (let i = i0; i < i1; i++) G[i] = 0;
        alive = 0;
    }
    return alive;
  }

  // --------------------------------------------------------------------------
  // The voice channel: (machine + sample) -> overdrive -> filter -> amp -> pan
  // --------------------------------------------------------------------------

  renderVoice(v, i0, i1, oL, oR, dL, dR, rL, rR) {
    const G = this.G;
    const genAlive = this.generate(v, G, i0, i1);
    // sample layer
    if (v.sOn && v.sBuf) {
      const buf = v.sBuf, inc = v.sInc, end = v.sEnd, g = v.sGain, q = v.sQ;
      let pos = v.sPos;
      const rev = inc < 0;
      for (let i = i0; i < i1; i++) {
        if (rev ? pos <= end : pos >= end) { if (v.sLoop) pos = v.sStart + (pos - end); else { v.sOn = false; break; } }
        const ip = pos | 0, fr = pos - ip;
        let x = buf[ip] + (buf[ip + 1 < buf.length ? ip + 1 : ip] - buf[ip]) * fr;
        if (q) x = Math.round(x * q) / q;
        G[i] += x * g;
        pos += inc;
      }
      v.sPos = pos;
    }
    // filter coefficients: per block from FRQ; per 8 samples while the envelope moves
    const typ = v.fType, kk = v.kk, m0 = v.m0, m1 = v.m1, m2 = v.m2;
    const envOct = v.fEnvOct;
    const modulated = envOct !== 0;
    let g = svfG(440 * exp2(v.fBaseOct + envOct * v.fe));
    let a1 = 1 / (1 + g * (g + kk)), a2 = g * a1, a3 = g * a2;
    let ic1 = v.ic1, ic2 = v.ic2;
    const drv = v.drv, drvG = v.drvG, drvN = v.drvN;
    let amp = v.amp;
    const gain = v.gain, gl = v.gl * gain, gr = v.gr * gain, ds = v.dsend, rs = v.rsend;
    let peak = v.peak;
    let fe = v.fe;
    for (let i = i0; i < i1; i++) {
      // filter envelope (ADSR, gate = trig length)
      switch (v.feStage) {
        case 1: fe += v.feAtk; if (fe >= 1) { fe = 1; v.feStage = 2; } break;
        case 2: fe = v.feSus + (fe - v.feSus) * v.feKd; if (!v.gate) v.feStage = 3; break;
        case 3: fe *= v.feKr; break;
      }
      if (modulated && (i & 7) === 0) {
        const w = clamp(440 * exp2(v.fBaseOct + envOct * fe), 5, SR * 0.47) * Math.PI * INV_SR;
        g = w < 1.42 ? tanF(w) : 1.42 + (w - 1.42) * 8;
        a1 = 1 / (1 + g * (g + kk)); a2 = g * a1; a3 = g * a2;
      }
      // amp envelope: attack (from the current level) -> hold (HLD or the gate) -> decay
      switch (v.ampStage) {
        case 1: amp += v.ampAtk; if (amp >= 1) { amp = 1; v.ampStage = 2; } break;
        case 2:
          if (v.ampHoldLeft >= 0) { v.ampHoldLeft--; if (v.ampHoldLeft < 0) v.ampStage = 3; }
          else if (!v.gate) v.ampStage = 3;
          break;
        case 3: amp *= v.ampKd; break;
      }
      let x = G[i];
      if (drv > 0) x = tanhF(x * drvG) * drvN;
      const v3 = x - ic2;
      const v1 = a1 * ic1 + a2 * v3;
      const v2 = ic2 + a2 * ic1 + a3 * v3;
      ic1 = 2 * v1 - ic1;
      ic2 = 2 * v2 - ic2;
      let y = (m0 * x + m1 * v1 + m2 * v2) * amp;
      if (v.choke > 0) { y *= v.choke; v.choke -= 0.004; if (v.choke <= 0) { v.choke = 0; amp = 0; } }
      if (v.dclArm) { v.dclArm = false; v.dcl = v.lastY - y; v.dclN = DECLICK_N; }
      if (v.dclN > 0) { y += v.dcl * (v.dclN / DECLICK_N); v.dclN--; }
      v.lastY = y;
      const l = y * gl, r = y * gr;
      oL[i] += l; oR[i] += r;
      if (ds) { dL[i] += l * ds; dR[i] += r * ds; }
      if (rs) { rL[i] += l * rs; rR[i] += r * rs; }
      const a = y < 0 ? -y : y;
      if (a > peak) peak = a;
    }
    if (!Number.isFinite(ic1) || !Number.isFinite(ic2)) { ic1 = 0; ic2 = 0; }
    if (Math.abs(ic1) < 1e-20) ic1 = 0;
    if (Math.abs(ic2) < 1e-20) ic2 = 0;
    v.ic1 = ic1; v.ic2 = ic2; v.amp = amp; v.fe = fe;
    v.peak = peak;
    v.gen = genAlive;
    // silence detection: generator, sample and filter ring all gone
    const silent = (genAlive * amp < 3e-5 && !v.sOn && Math.abs(ic1) + Math.abs(ic2) < 1e-4) || (amp < 1e-5 && v.ampStage === 3);
    if (silent) { if (++v.quiet > 8) { v.active = false; v.amp = 0; } } else v.quiet = 0;
  }

  // --------------------------------------------------------------------------
  // FX track delay (in this node so the voices' sends need no extra graph)
  // --------------------------------------------------------------------------

  renderDelay(n, dL, dR, outL, outR, revL, revR) {
    const E = this.fxEff;
    const tim = clamp(E[FX_DEL_TIM], 0, 127);
    const secs = Math.max(1, tim) / 128 * 4 * 60 / this.bpm;
    this.dTarget = clamp(secs * SR, 32, this.dMax - 4);
    const fdb = clamp(E[FX_DEL_FDB], 0, 198) / 128;
    const pp = E[FX_DEL_X] > 0.5;
    const wid = clamp(E[FX_DEL_WID], -64, 63) / 63;
    // X off: WID pans the (mono) repeats; X on: they alternate and WID sets how far
    const panL = wid > 0 ? 1 - wid : 1, panR = wid < 0 ? 1 + wid : 1;
    const hpA = lpA(expT(E[FX_DEL_HPF], 15, 8000) * (E[FX_DEL_HPF] < 0.5 ? 0 : 1) + (E[FX_DEL_HPF] < 0.5 ? 5 : 0));
    const lpAc = lpA(E[FX_DEL_LPF] >= 126.5 ? 20000 : expT(E[FX_DEL_LPF], 300, 20000));
    const dov = clamp(E[FX_DIS_DOV], 0, 127) / 127;
    // DOV: a saturator in the loop with unity small-signal gain (FDB alone sets the repeat level); harder = more distortion, the return gets the make-up
    const dg = 0.6 + dov * 7, dInv = 1 / dg;
    const trkLev = clamp(E[FX_TRK_LEV], 0, 127) / 100;
    const vol = Math.pow(clamp(E[FX_DEL_VOL], 0, 127) / 127, 2) * 1.2 * (1 + dov * 1.5) * trkLev * trkLev;
    const toRev = Math.pow(clamp(E[FX_DEL_REV], 0, 127) / 127, 2);
    const max = this.dMax, L = this.dL, R = this.dR;
    let w = this.dW, time = this.dTime;
    let hpL = this.dHpL, hpR = this.dHpR, lpL = this.dLpL, lpR = this.dLpR;
    let energy = 0;
    const glide = 1 - Math.exp(-1 / (0.06 * SR));
    for (let i = 0; i < n; i++) {
      time += (this.dTarget - time) * glide;
      let rp = w - time; if (rp < 0) rp += max;
      const ip = rp | 0, fr = rp - ip, ip2 = ip + 1 >= max ? 0 : ip + 1;
      const yl = L[ip] + (L[ip2] - L[ip]) * fr;
      const yr = R[ip] + (R[ip2] - R[ip]) * fr;
      // loop filters
      lpL += lpAc * (yl - lpL); lpR += lpAc * (yr - lpR);
      hpL += hpA * (lpL - hpL); hpR += hpA * (lpR - hpR);
      let fl = lpL - hpL, fr2 = lpR - hpR;
      // overdrive in the loop (DOV), always a soft limit so FDB > 127 builds up without exploding
      fl = tanhF(fl * dg) * dInv;
      fr2 = tanhF(fr2 * dg) * dInv;
      const inM = (dL[i] + dR[i]) * 0.5;
      let ol, or;
      if (pp) {
        // ping-pong: in to the left line, each repeat crosses over
        L[w] = inM + fr2 * fdb; R[w] = fl * fdb;
        const mid = (yl + yr) * 0.5, side = (yl - yr) * 0.5 * wid;
        ol = (mid + side) * vol; or = (mid - side) * vol;
      } else {
        L[w] = inM + fl * fdb; R[w] = 0;
        ol = yl * panL * vol; or = yl * panR * vol;
      }
      w++; if (w >= max) w = 0;
      outL[i] += ol; outR[i] += or;
      if (toRev) { revL[i] += ol * toRev; revR[i] += or * toRev; }
      energy += Math.abs(yl) + Math.abs(yr) + Math.abs(inM);
    }
    this.dW = w; this.dTime = time;
    this.dHpL = Math.abs(hpL) < 1e-20 ? 0 : hpL; this.dHpR = Math.abs(hpR) < 1e-20 ? 0 : hpR;
    this.dLpL = Math.abs(lpL) < 1e-20 ? 0 : lpL; this.dLpR = Math.abs(lpR) < 1e-20 ? 0 : lpR;
    return energy;
  }

  // --------------------------------------------------------------------------

  process(inputs, outputs) {
    const out0 = outputs[0], out1 = outputs[1], out2 = outputs[2], ctl = outputs[3];
    const oL = out0[0], oR = out0[1] || out0[0];
    const n = oL.length;
    const dLo = out1[0], dRo = out1[1] || out1[0];
    const rL = out2[0], rR = out2[1] || out2[0];
    // scratch buses for the delay input (reuse the reverb output arrays? no: own buffers)
    if (!this.dIn || this.dIn[0].length !== n) this.dIn = [new Float32Array(n), new Float32Array(n)];
    const dInL = this.dIn[0], dInR = this.dIn[1];
    dInL.fill(0); dInR.fill(0);
    oL.fill(0); if (oR !== oL) oR.fill(0);
    dLo.fill(0); if (dRo !== dLo) dRo.fill(0);
    rL.fill(0); if (rR !== rL) rR.fill(0);
    const voices = this.voices;

    const blockStart = currentTime;
    const blockEnd = blockStart + n * INV_SR;
    this.stepLfos(n);
    this.resolveFx();
    for (let k = 0; k < 8; k++) { const v = voices[k]; if (v.active) { this.resolve(v); this.prepare(v, false); } }

    let i0 = 0;
    const q = this.queue;
    let any = false;
    while (true) {
      let i1 = n;
      let ev = null;
      if (q.length && q[0].at < blockEnd) {
        ev = q[0];
        i1 = Math.max(i0, Math.min(n, Math.round((ev.at - blockStart) * SR)));
      }
      if (i1 > i0) {
        for (let k = 0; k < 8; k++) {
          const v = voices[k];
          if (!v.active) continue;
          any = true;
          this.renderVoice(v, i0, i1, oL, oR, dInL, dInR, rL, rR);
        }
        i0 = i1;
      }
      if (!ev) break;
      q.shift();
      this.apply(ev);
      if (ev.t === 'fx' || ev.t === 'kit' || ev.t === 'fxlocks') this.resolveFx();
    }
    // delay (skips work once silent)
    let delayActive = any || this.dIdle < SR * 6;
    if (delayActive) {
      const energy = this.renderDelay(n, dInL, dInR, dLo, dRo, rL, rR);
      if (energy < 1e-7) this.dIdle += n; else this.dIdle = 0;
    }
    // master-section parameters (effective: locks, scenes, performance, FX LFO) for the master node
    if (ctl) {
      const E = this.fxEff;
      for (let c = 0; c < MASTER_CH.length && c < ctl.length; c++) ctl[c].fill(E[MASTER_CH[c]]);
    }
    // level report for the pads (about 30 Hz)
    this.lvTimer += n;
    if (this.lvTimer >= 1600) {
      this.lvTimer = 0;
      let sounding = false;
      const lv = this.lvOut;
      lv.fill(0);
      for (let k = 0; k < 8; k++) {
        const v = voices[k];
        if (v.track >= 0 && v.active) { lv[v.track] = Math.min(1, v.peak * 1.6); sounding = true; }
        v.peak *= 0.25;
      }
      const fd = Math.round(this.fxEff[FX_LFO_DST]);
      const rv = fd >= 10 && fd <= 16 && this.fxEff[FX_LFO_DEP] ? FX_LFO_DEST_IDX[fd] : -1;
      if (sounding || this.anyActive || rv >= 0) {
        const msg = this.lvMsg;
        msg.rv = rv; msg.rvv = rv >= 0 ? this.fxEff[rv] : 0;
        this.port.postMessage(msg);
      }
      this.anyActive = sounding;
    }
    return true;
  }
}

// ============================================================================
// Master: analog distortion and compressor
//
// A calibrated model of the hardware (rytm-mods mod 0006: compressor-model.md,
// calibration.toml and the measurements in compressor-hardware.md, OS 1.73):
//   distortion  DIST gain table, then an order-12 soft clipper at about
//               0.68 / 0.72 of full scale (it is there even at AMT 0); SYM is a
//               bias before it and a gain after it (17-point tables)
//   detector    two first-order sections per side for SEQ (fitted to the
//               hardware's sidechain response), max(|L|, |R|), a peak
//               follower with a 5 ms fall, at half the sample rate
//   curve       GR = slope * w * softplus((L - T) / w), T = knee + 0.955 dB a
//               THR step, per stored RAT (the labels 1:2 .. MAX run against
//               the behaviour: stored 0 compresses hardest)
//   ballistics  slow-attack scale from ATK, REL and RAT; attack a pole,
//               release a proportional fall per 32-sample block
//   output      MUP about 0.6 dB a step to 48 then flattening to +40 dB;
//               MIX a linear crossfade; VOL scales the dry path by the
//               measured table and the wet path 1.95 dB per dB
//   coupling    the main outputs are AC coupled: a 5 Hz one-pole high-pass
//               after the returns, so asymmetric kicks leave no DC
// ============================================================================

const DIST_X = [0, 32, 64, 96, 127];
const DIST_G = [1.0, 2.853, 4.534, 5.947, 7.127];
const SAT_CP = 0.68, SAT_CN = 0.72;
const SYM_BIAS = [0.7199, 0.4966, 0.4372, 0.396, 0.352, 0.2717, 0.1695, 0.0741, 0.0, -0.0821, -0.1599, -0.2592, -0.3479, -0.4139, -0.4662, -0.5353, -0.5988];
/** SYM tables are at raw SYM 0, 8, .., 120 and 127 (display -64 .. +63) */
const SYM_X = [0, 8, 16, 24, 32, 40, 48, 56, 64, 72, 80, 88, 96, 104, 112, 120, 127];
const SYM_GAIN_DB = [-8.927, -8.114, -5.625, -3.508, -1.747, -0.94, -0.026, -0.43, 0.0, -0.42, -0.571, -0.919, -1.589, -2.867, -4.825, -7.143, -9.541];
// SEQ sidechain: [pole Hz, zero Hz] for two sections, per OFF, LPF, HPF, HIT (designed at 24 kHz)
const SC_SEC = [
  [[21.0396, 81.1054], [7114.411, 7735.874]],
  [[44.6039, 11759.917], [3366.864, 11760.0]],
  [[458.9453, 75.2315], [9312.442, 11760.0]],
  [[546.3291, 158.8602], [11760.0, 2159.736]],
];
const SC_LEVEL_DB = [0.0, -8.9111, 2.2171, 2.5194 + 1.36];
const CMP_KNEE = [-55.8984375, -58.60546875, -64.7421875, -71.2109375];
const CMP_WIDTH = [0.5, 0.5, 0.5, 1.8515625];
const CMP_SLOPE = [0.7763671875, 0.738525390625, 0.6640625, 0.512451171875];
const CMP_THR_STEP = 0.955322265625, CMP_CAP = 35.875, CMP_SILENCE = -70;
const CMP_ATK_S = [0.00003, 0.0001, 0.0003, 0.001, 0.003, 0.01, 0.03];
const CMP_REL_Q16 = [964, 317, 206, 114, 57, 21, 263, 195];
const CMP_COUPLING = [[0.588, 1.2406], [0.9948, 1.2406], [1.0296, 0.9205], [2.042, 0.789]];
const CMP_REL_EFF = [0.084, 0.243, 0.412, 2.017, 6.937, 6.937, 0.171, 0.345];
const CMP_SEQ_ATK_DB = [1.56, 0.0, 2.77, 3.47];
const CMP_VOL_X = [0, 40, 52, 64, 76, 88, 100, 112, 124, 127];
const CMP_DRY_DB = [-24, -10.85, -8.30, -6.38, -4.85, -3.44, -2.20, -1.13, -0.21, 0];
const CMP_WMD_DB = [-23, -16.57, -14.18, -12.35, -10.86, -9.59, -8.42, -7.38, -6.34, -6.26];

const interp = (xs, ys, x) => {
  if (x <= xs[0]) return ys[0];
  for (let i = 1; i < xs.length; i++) if (x <= xs[i]) return ys[i - 1] + (x - xs[i - 1]) / (xs[i] - xs[i - 1]) * (ys[i] - ys[i - 1]);
  return ys[ys.length - 1];
};
/** order-12 soft clipper: unchanged below c/2, a hard-ish knee at c */
function sat12(u) {
  const c = u >= 0 ? SAT_CP : SAT_CN;
  const a = (u < 0 ? -u : u) / c;
  if (a < 0.5) return u;
  const a2 = a * a, a4 = a2 * a2, a12 = a4 * a4 * a4;
  return u * Math.pow(1 + a12, -1 / 12);
}

/** First-order section y = k x - k r x[-1] + P y[-1] with peak gain 1 */
function scSection(fp, fz, fs) {
  const P = Math.exp(-TWO_PI * Math.min(fp, fs * 0.49) / fs), r = Math.exp(-TWO_PI * Math.min(fz, fs * 0.49) / fs);
  const dc = (1 - r) / (1 - P), ny = (1 + r) / (1 + P);
  const k = 1 / Math.max(dc, ny);
  const mag = f => { const w = TWO_PI * f / fs; return k * Math.sqrt((1 - 2 * r * Math.cos(w) + r * r) / (1 - 2 * P * Math.cos(w) + P * P)); };
  return { k, kr: k * r, P, mag };
}

class AnalogRytmMasterProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.p = new Float64Array(NFX);
    this.p[FX_DIS_REV] = 1; this.p[FX_CMP_THR] = 96; this.p[FX_CMP_REL] = 2; this.p[FX_CMP_SEQ] = 1; this.p[FX_CMP_VOL] = 64;
    const fs2 = SR / 2;
    // per SEQ: 2 sections, and the level offset (the cascade's 1 kHz loss against OFF's, plus the fitted level)
    this.sec = SC_SEC.map(row => row.map(([fp, fz]) => scSection(fp, fz, fs2)));
    const loss = this.sec.map(row => -20 * Math.log10(row[0].mag(1000) * row[1].mag(1000)));
    this.scOff = this.sec.map((_, i) => loss[i] - loss[0] + SC_LEVEL_DB[i]);
    // detector state per side: 2 sections x (x1, y1)
    this.dz = new Float64Array(8);
    this.pk = 0;
    this.pkFall = Math.exp(-1 / (0.005 * fs2));
    // the estimator's 32-sample block, run four times as often here so attacks land within 8 samples
    this.blockN = Math.max(4, Math.round(8 * SR / 48000));
    this.cnt = 0;
    this.state = 0;      // gain reduction, dB
    this.g = 1; this.gStep = 0; this.gTarget = 1;
    this.idle = 0;
    // output coupling (DC blocker) state
    this.dcR = Math.exp(-TWO_PI * 5 / SR);
    this.dcxL = 0; this.dcyL = 0; this.dcxR = 0; this.dcyR = 0;
    this.port.onmessage = e => { const m = e.data; if (m && m.t === 'p') { if (m.all) this.p.set(m.all); else this.p[m.i] = m.v; } };
  }

  /** The gain-reduction demand and the output gain, once a block */
  block(P) {
    const rat = Math.round(clamp(P[FX_CMP_RAT], 0, 3));
    const seq = Math.round(clamp(P[FX_CMP_SEQ], 0, 3));
    const atkI = Math.round(clamp(P[FX_CMP_ATK], 0, 6));
    const relI = Math.round(clamp(P[FX_CMP_REL], 0, 7));
    const L = 20 * Math.log10(this.pk + 1e-12) + 3.01 + this.scOff[seq];
    let demand = 0;
    if (L > CMP_SILENCE) {
      const T = CMP_KNEE[rat] + CMP_THR_STEP * (clamp(P[FX_CMP_THR], 0, 127) - 64);
      const w = CMP_WIDTH[rat];
      const x = (L - T) / w;
      const sp = x > 30 ? x : Math.log1p(Math.exp(x));
      demand = Math.min(CMP_SLOPE[rat] * w * sp, CMP_CAP);
      // a slow attack settles at less reduction (scaled by ATK against REL, per ratio)
      const C = CMP_COUPLING[rat][0], pw = CMP_COUPLING[rat][1], rel = CMP_REL_EFF[relI];
      demand *= (1 + C * Math.pow(0.00003 / rel, pw)) / (1 + C * Math.pow(CMP_ATK_S[atkI] / rel, pw));
      demand = Math.max(0, demand - CMP_SEQ_ATK_DB[seq] * atkI / 6);
    }
    let st = this.state;
    if (demand > st) st += (demand - st) * (1 - Math.exp(-8 / (CMP_ATK_S[atkI] * 48000)));
    else st = Math.max(demand, st - Math.max(st * CMP_REL_Q16[relI] / 262144, 1 / 1024));
    this.state = st;
    // output stage
    const mup = clamp(P[FX_CMP_MUP], 0, 127);
    const mupDb = mup <= 48 ? 0.6 * mup : 28.8 + 11.5 * (1 - Math.pow(1 - (mup - 48) / 79, 2));
    const vol = clamp(P[FX_CMP_VOL], 0, 127);
    const dryDb = interp(CMP_VOL_X, CMP_DRY_DB, vol);
    const wetDb = dryDb + interp(CMP_VOL_X, CMP_WMD_DB, vol) + mupDb - st;
    const mix = clamp(P[FX_CMP_MIX], 0, 127) / 127;
    return (1 - mix) * Math.pow(10, dryDb / 20) + mix * Math.pow(10, wetDb / 20);
  }

  process(inputs, outputs) {
    const out = outputs[0];
    const oL = out[0], oR = out[1] || out[0];
    const n = oL.length;
    const inD = inputs[0], inE = inputs[1], inV = inputs[2];
    const dl = inD && inD[0], dr = inD && (inD[1] || inD[0]);
    const el = inE && inE[0], er = inE && (inE[1] || inE[0]);
    const vl = inV && inV[0], vr = inV && (inV[1] || inV[0]);
    const P = this.p;
    const ctl = inputs[3];
    if (ctl && ctl.length >= MASTER_CH.length) for (let c = 0; c < MASTER_CH.length; c++) P[MASTER_CH[c]] = ctl[c][0];
    // idle: nothing coming in and the detector at rest
    let mx = 0;
    if (dl) for (let i = 0; i < n; i += 4) { const a = Math.abs(dl[i]) + Math.abs(dr[i]); if (a > mx) mx = a; }
    if (el) for (let i = 0; i < n; i += 4) { const a = Math.abs(el[i]) + Math.abs(er[i]); if (a > mx) mx = a; }
    if (vl) for (let i = 0; i < n; i += 4) { const a = Math.abs(vl[i]) + Math.abs(vr[i]); if (a > mx) mx = a; }
    if (mx < 1e-7 && this.pk < 1e-6 && this.state < 0.01 && Math.abs(this.dcyL) + Math.abs(this.dcyR) < 1e-7) {
      if (++this.idle > 4) { oL.fill(0); if (oR !== oL) oR.fill(0); this.pk = 0; this.dcxL = this.dcyL = this.dcxR = this.dcyR = 0; return true; }
    } else this.idle = 0;
    // distortion
    const amt = clamp(P[FX_DIS_AMT], 0, 127);
    const dg = interp(DIST_X, DIST_G, amt);
    const symRaw = clamp(P[FX_DIS_SYM], -64, 63) + 64;
    const bias = interp(SYM_X, SYM_BIAS, symRaw);
    const symG = Math.pow(10, interp(SYM_X, SYM_GAIN_DB, symRaw) / 20);
    const satB = sat12(bias);
    const plain = bias === 0;
    const delPost = P[FX_DIS_DEL] > 0.5, revPost = P[FX_DIS_REV] > 0.5;
    // detector sections for this SEQ
    const seq = Math.round(clamp(P[FX_CMP_SEQ], 0, 3));
    const s0 = this.sec[seq][0], s1 = this.sec[seq][1];
    const z = this.dz;
    const pkFall = this.pkFall;
    let pk = this.pk, cnt = this.cnt;
    let g = this.g, gStep = this.gStep;
    const dcR = this.dcR;
    let dxl = this.dcxL, dyl = this.dcyL, dxr = this.dcxR, dyr = this.dcyR;
    for (let i = 0; i < n; i++) {
      let l = dl ? dl[i] : 0, r = dr ? dr[i] : 0;
      const del = el ? el[i] : 0, delR = er ? er[i] : 0;
      const rev = vl ? vl[i] : 0, revR = vr ? vr[i] : 0;
      if (!delPost) { l += del; r += delR; }
      if (!revPost) { l += rev; r += revR; }
      if (plain) { l = sat12(l * dg); r = sat12(r * dg); }
      else { l = symG * (sat12(l * dg + bias) - satB); r = symG * (sat12(r * dg + bias) - satB); }
      // detector at half rate: SEQ sections per side, then the louder side into the peak follower
      if (i & 1) {
        let a = s0.k * l - s0.kr * z[0] + s0.P * z[1]; z[0] = l; z[1] = a;
        let b = s1.k * a - s1.kr * z[2] + s1.P * z[3]; z[2] = a; z[3] = b;
        let c = s0.k * r - s0.kr * z[4] + s0.P * z[5]; z[4] = r; z[5] = c;
        let d = s1.k * c - s1.kr * z[6] + s1.P * z[7]; z[6] = c; z[7] = d;
        const det = Math.max(b < 0 ? -b : b, d < 0 ? -d : d);
        pk = det > pk ? det : det + (pk - det) * pkFall;
      }
      if (++cnt >= this.blockN) {
        cnt = 0;
        this.pk = pk;
        const target = this.block(P);
        gStep = (target - g) / this.blockN;
      }
      g += gStep;
      l *= g; r *= g;
      if (delPost) { l += del; r += delR; }
      if (revPost) { l += rev; r += revR; }
      // AC-coupled output
      dyl = l - dxl + dcR * dyl; dxl = l;
      dyr = r - dxr + dcR * dyr; dxr = r;
      oL[i] = dyl; if (oR !== oL) oR[i] = dyr;
    }
    this.dcxL = dxl; this.dcyL = Math.abs(dyl) < 1e-20 ? 0 : dyl; this.dcxR = dxr; this.dcyR = Math.abs(dyr) < 1e-20 ? 0 : dyr;
    for (let j = 0; j < 8; j++) if (Math.abs(z[j]) < 1e-20) z[j] = 0;
    this.pk = pk; this.cnt = cnt; this.g = g; this.gStep = gStep;
    return true;
  }
}

registerProcessor('analog-rytm', AnalogRytmProcessor);
registerProcessor('analog-rytm-master', AnalogRytmMasterProcessor);
