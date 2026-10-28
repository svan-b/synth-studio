// ============================================================================
// Analog Rytm MKII - factory-style kits, their patterns, and the default
// project with its demo song.
//
// Kit names are "Category / Name". The Rytm's real factory kits and Elektron's
// sound packs (Straight 808, Divine 909, Synthetics, Curcussion, ...) are
// copyrighted content we cannot ship; each kit here is our own sound design
// in the same character, and says "Recreation of ..." where it borrows a
// style. Every kit has a matching pattern in bank B of the default project.
//
// Pattern rows: one character per step (spaces are ignored).
//   .  no trig        x  trig            X  accent (velocity 127)
//   o  ghost (45)     v  medium (80)     r  retrig roll (1/32 over a step)
//   R  roll, triplet 1/24 over two steps, fading in
//   h  50 %           a  1:2             b  2:2            c  4:4
//   f  FILL           n  !FILL           p  1ST
// ============================================================================

import {
  LEN_1_STEP, RETRIG_RATE_32, createPattern, createProject, type Pattern, type Project, type Speed, type Step,
} from '@/lib/sequencer/elektron';
import { MACHINES, SEQ_TRACKS, TRACKS, TRACK_INDEX } from './model';

type TrackKey = 'bd' | 'sd' | 'rs' | 'cp' | 'bt' | 'lt' | 'mt' | 'ht' | 'ch' | 'oh' | 'cy' | 'cb';
type Vals = Record<string, number>;

/** Sound values for a track: `machine` by name, then parameter keys without the track prefix */
type Sound = { machine?: string } & Record<string, number | string | undefined>;

export interface KitDef {
  key: string;
  name: string;
  description: string;
  factory?: boolean;
  /** Control values (ids) */
  values: Vals;
  bpm: number;
  swing?: number;
  pattern: PatDef;
}

export interface PatDef {
  name: string;
  len?: number;
  swing?: number;
  speed?: Speed;
  rows: Partial<Record<TrackKey | 'fx', string>>;
  /** Track default velocity */
  vel?: Partial<Record<TrackKey, number>>;
  /** Extra per-step data merged into the generated trigs (locks, micro timing, notes ...) */
  steps?: Partial<Record<TrackKey | 'fx', Record<number, Step>>>;
  /** Track default note (60 = the sound's own pitch) */
  note?: Partial<Record<TrackKey, number>>;
  /** Track length (PER TRACK scale) */
  trackLen?: Partial<Record<TrackKey, number>>;
}

// ----------------------------------------------------------------------------
// Builders
// ----------------------------------------------------------------------------

/** Kit control values from per-track sounds and FX settings */
export function kitValues(sounds: Partial<Record<TrackKey, Sound>>, fx: Record<string, number> = {}, extra: Vals = {}): Vals {
  const out: Vals = {};
  for (const [tk, snd] of Object.entries(sounds) as [TrackKey, Sound][]) {
    const t = TRACKS[TRACK_INDEX[tk]];
    for (const [k, v] of Object.entries(snd)) {
      if (v === undefined) continue;
      if (k === 'machine') {
        const id = Object.values(MACHINES).find(m => m.name === v)?.id;
        const idx = id === undefined ? -1 : t.machines.indexOf(id);
        if (idx < 0) throw new Error(`kit: ${tk} cannot run ${v}`);
        out[`${tk}_machine`] = idx;
      } else out[`${tk}_${k}`] = v as number;
    }
  }
  for (const [k, v] of Object.entries(fx)) out[`fx_${k}`] = v;
  return { ...out, ...extra };
}

const COND: Record<string, string> = { h: '50%', a: '1:2', b: '2:2', c: '4:4', f: 'FILL', n: '!FILL', p: '1ST' };

function stepFor(ch: string): Step | null {
  switch (ch) {
    case 'x': return {};
    case 'X': return { vel: 127, accent: true };
    case 'o': return { vel: 45 };
    case 'v': return { vel: 80 };
    case 'r': return { retrig: { rate: RETRIG_RATE_32, len: LEN_1_STEP, vel: 0 } };
    case 'R': return { retrig: { rate: 11, len: 30, vel: 40 } };
    default: return COND[ch] ? { cond: COND[ch] } : null;
  }
}

/** Build a sequencer pattern from rows */
export function buildPattern(def: PatDef, kit = ''): Pattern {
  const p = createPattern(SEQ_TRACKS, { name: def.name, length: def.len ?? 16, swing: def.swing ?? 50, speed: def.speed ?? '1x', kit });
  const keys = [...TRACKS.map(t => t.id), 'fx'] as (TrackKey | 'fx')[];
  keys.forEach((tk, ti) => {
    const row = def.rows[tk];
    const tr = p.tracks[ti];
    if (tk !== 'fx') {
      if (def.vel?.[tk] !== undefined) tr.vel = def.vel[tk]!;
      if (def.note?.[tk] !== undefined) tr.note = def.note[tk]!;
      if (def.trackLen?.[tk]) { tr.length = def.trackLen[tk]; p.scaleMode = 'track'; }
    }
    if (row) {
      const chars = row.replace(/\s+/g, '');
      for (let i = 0; i < chars.length && i < 64; i++) {
        const s = stepFor(chars[i]);
        if (s) tr.steps[i] = s;
      }
    }
    const extra = def.steps?.[tk];
    if (extra) for (const [k, s] of Object.entries(extra)) {
      const i = Number(k);
      tr.steps[i] = { ...(tr.steps[i] ?? {}), ...s, locks: { ...(tr.steps[i]?.locks ?? {}), ...(s.locks ?? {}) } };
      if (!Object.keys(tr.steps[i].locks!).length) delete tr.steps[i].locks;
    }
  });
  return p;
}

// ----------------------------------------------------------------------------
// The default kit (kit 01) is the spec's default sound: these are its values,
// so they also define the controls' defaults (spec.ts reads machine defaults
// from model.ts; this list only documents the kit and the drop variation).
// ----------------------------------------------------------------------------

/** Kit 02: the demo song's drop - the default kit pushed harder */
const DROP_KIT = kitValues({
  bd: { amp_ovr: 46, dec: 56, snp: 70, tic: 64 },
  sd: { amp_vol: 108 },
  cp: { amp_rev: 40, nol: 80 },
  ch: { flt_frq: 127, amp_vol: 112 },
  oh: { dec: 54, amp_vol: 108 },
  cy: { amp_vol: 92 },
}, { dis_amt: 24, cmp_thr: 82, cmp_rat: 1, cmp_mup: 60, cmp_atk: 2, del_fdb: 70 });

// ----------------------------------------------------------------------------
// Factory-style kits
// ----------------------------------------------------------------------------

const K = (key: string, name: string, description: string, bpm: number, sounds: Partial<Record<TrackKey, Sound>>, fx: Record<string, number>, pattern: PatDef, swing?: number): KitDef =>
  ({ key, name, description, bpm, swing, values: kitValues(sounds, fx), pattern });

export const KIT_PRESETS: KitDef[] = [
  K('warehouse', 'Techno / Warehouse',
    'Recreation of the driving, compressed techno kits the Rytm is known for: a hard kick with snap and drive, clap, rim into the delay, ride.',
    130,
    {
      bd: { machine: 'BD HARD', tun: -3, dec: 60, hld: 18, swt: 36, snp: 62, wav: 1, tic: 52, amp_ovr: 34 },
      sd: { machine: 'SD HARD', tun: 3, dec: 34, swd: 30, nol: 80, nod: 46, amp_vol: 84 },
      rs: { machine: 'RS HARD', dec: 22, amp_del: 64, amp_pan: -18 },
      cp: { machine: 'CP CLASSIC', ton: 72, num: 64, rat: 42, nod: 54, nol: 72, amp_rev: 46 },
      lt: { tun: -9, dec: 46, swd: 54, amp_del: 30, amp_pan: 20 },
      ch: { dec: 22, col: 10, amp_vol: 96 },
      oh: { dec: 58, col: 8, amp_vol: 92 },
      cy: { machine: 'CY RIDE', typ: 1, dec: 78, c1: 70, amp_vol: 74 },
    },
    { del_tim: 24, del_fdb: 72, del_lpf: 92, del_hpf: 30, rev_dec: 72, dis_amt: 14, cmp_thr: 86, cmp_rat: 2, cmp_atk: 2, cmp_rel: 2, cmp_mup: 54 },
    {
      name: 'WAREHOUSE',
      rows: {
        bd: 'x...x...x...x...',
        cp: '....x.......x...',
        ch: 'o.x.o.x.o.x.o.xo',
        oh: '..........a...x.',
        rs: '...x..x.h..x..x.',
        lt: '.......x......h.',
        cy: 'x.o.x.o.x.o.x.o.',
      },
      vel: { ch: 90, cy: 80 },
    }),

  K('industrial', 'Techno / Industrial Grind',
    'Distorted plastic kick, FM snare noise, metallic hats and an overdriven delay: industrial techno.',
    128,
    {
      bd: { machine: 'BD PLASTIC', tun: -2, dec: 52, typ: 0, mod: 70, swt: 30, swd: 92, tic: 80, amp_ovr: 80 },
      sd: { machine: 'SD FM', tun: -4, dec: 30, fmt: 7, fmd: 40, fma: 90, nod: 60, nol: 100, amp_ovr: 40 },
      rs: { machine: 'RS HARD', tun: -5, dec: 30, sym: 40, amp_del: 80 },
      cp: { machine: 'CP CLASSIC', ton: 40, num: 90, rat: 30, nod: 70, nol: 90, amp_ovr: 50, amp_rev: 30 },
      bt: { machine: 'UT NOISE', lpf: 70, hpf: 30, lpq: 90, dec: 40, nswd: 50, swt: 40, amp_del: 40 },
      ch: { machine: 'CH METALLIC', dec: 20, amp_vol: 100 },
      oh: { machine: 'OH METALLIC', dec: 52, amp_vol: 90 },
      cy: { machine: 'CY METALLIC', dec: 60, ton: 20 },
    },
    { del_tim: 16, del_fdb: 110, del_hpf: 40, del_lpf: 80, dis_dov: 70, dis_amt: 46, dis_sym: 12, rev_dec: 60, cmp_thr: 78, cmp_rat: 0, cmp_atk: 3, cmp_rel: 1, cmp_mup: 64 },
    {
      name: 'GRIND',
      rows: {
        bd: 'x..xx...x..xx..x',
        sd: '....x.......x.r.',
        cp: '....X.......X...',
        ch: 'xxxxxxxxxxxxxxxx',
        oh: '..x...x...x...x.',
        rs: '.x...x.h.x...x..',
        bt: 'x.......h.......',
      },
      vel: { ch: 70, rs: 90 },
      steps: { ch: { 3: { vel: 110 }, 7: { vel: 110 }, 11: { vel: 110 }, 15: { vel: 110 } } },
    }),

  K('dubtechno', 'Techno / Dub Chords',
    'Recreation of the dub-techno chord-and-echo sound: deep silky kick, a two-oscillator chord stab soaked in ping-pong delay and reverb, soft metallic hats.',
    120,
    {
      bd: { machine: 'BD SILKY', tun: -4, dec: 64, hld: 10, swt: 40, swd: 60, dus: 10, clk: 24 },
      sd: { machine: 'SY DUAL VCO', tun: 3, vdet: 7, dec: 50, dec2: 46, bal: -10, cfg: 7, flt_frq: 84, flt_res: 30, flt_env: 18, flt_dec: 50, amp_del: 96, amp_rev: 70, amp_vol: 80 },
      rs: { machine: 'RS CLASSIC', dec: 26, amp_del: 70, amp_rev: 40, amp_pan: 26 },
      ch: { machine: 'CH METALLIC', dec: 18, amp_vol: 80 },
      oh: { machine: 'OH CLASSIC', dec: 50, col: -10, amp_vol: 74 },
      cy: { machine: 'CY CLASSIC', dec: 86, ton: -20, amp_vol: 60 },
    },
    { del_tim: 24, del_x: 1, del_fdb: 112, del_hpf: 36, del_lpf: 76, del_rev: 60, rev_dec: 96, rev_gai: 70, rev_pre: 20, cmp_thr: 92, cmp_rat: 3 },
    {
      name: 'DUB CHORDS',
      rows: {
        bd: 'x...x...x...x...',
        sd: '..x.......x..a..',
        rs: '.......x......x.',
        ch: 'o.x.o.x.o.x.o.x.',
        oh: '..x...x...x...x.',
      },
      vel: { ch: 70, oh: 60 },
      swing: 54,
    }, 54),

  K('deephouse', 'House / Deep Garage',
    'Swung deep house: a round classic kick, roomy clap, shuffling hats and a rim / tom groove.',
    122,
    {
      bd: { machine: 'BD CLASSIC', tun: -2, dec: 56, hld: 8, swt: 46, swd: 70, wav: 0, tra: 12 },
      cp: { machine: 'CP CLASSIC', ton: 60, num: 48, rat: 54, nod: 70, nol: 80, amp_rev: 70 },
      rs: { machine: 'RS CLASSIC', dec: 30, amp_del: 40, amp_pan: -24 },
      lt: { tun: -2, dec: 40, swd: 30, amp_pan: 30 },
      mt: { tun: 3, dec: 36, swd: 30, amp_pan: -30 },
      ch: { dec: 28, col: -6, amp_vol: 92 },
      oh: { dec: 46, col: -4, amp_vol: 88 },
      cb: { machine: 'CB CLASSIC', dec: 30, amp_vol: 70, amp_del: 50 },
    },
    { del_tim: 24, del_fdb: 60, del_lpf: 90, rev_dec: 66, rev_gai: 84, cmp_thr: 94, cmp_rat: 3, cmp_mup: 50 },
    {
      name: 'GARAGE',
      rows: {
        bd: 'x...x...x...x...',
        cp: '....x.......x...',
        ch: 'x.xxx.xxx.xxx.xx',
        oh: '..x...x...x...x.',
        rs: '...x.x......x..x',
        lt: '..........x.....',
        mt: '.......h.....x..',
        cb: '.............h..',
      },
      vel: { ch: 76, oh: 84 },
      swing: 58,
      steps: { ch: { 0: { vel: 110 }, 4: { vel: 110 }, 8: { vel: 110 }, 12: { vel: 110 } } },
    }, 58),

  K('nineoh', 'House / Nine-O-Nine Box',
    'Recreation of the TR-909 character (the ground Elektron\'s Divine 909 pack covers): punchy kick with tick, noisy snare, layered sample hats, crash.',
    126,
    {
      bd: { machine: 'BD HARD', tun: -1, dec: 54, hld: 14, swt: 30, snp: 50, wav: 0, tic: 72 },
      sd: { machine: 'SD HARD', tun: 4, dec: 30, swd: 46, swt: 24, tic: 50, nod: 58, nol: 96 },
      cp: { machine: 'CP CLASSIC', ton: 76, num: 56, rat: 40, nod: 46, nol: 64, amp_rev: 34 },
      lt: { tun: -5, dec: 54, swd: 60, swt: 50 },
      mt: { tun: 0, dec: 50, swd: 60, swt: 50 },
      ht: { tun: 5, dec: 46, swd: 60, swt: 50 },
      ch: { dec: 18, lev: 70, smp_slot: 9, smp_lev: 100, amp_vol: 96 },
      oh: { dec: 50, lev: 70, smp_slot: 10, smp_lev: 90, amp_vol: 90 },
      cy: { machine: 'CY CLASSIC', dec: 90, ton: 30, smp_slot: 12, smp_lev: 70, amp_vol: 70 },
    },
    { rev_dec: 56, cmp_thr: 88, cmp_rat: 2, cmp_atk: 1, cmp_mup: 54, dis_amt: 8 },
    {
      name: 'NINE OH',
      rows: {
        bd: 'x...x...x...x...',
        sd: '....x.......x..o',
        cp: '....x.......x...',
        ch: 'x.x.x.x.x.x.x.x.',
        oh: '..x...x...x...x.',
        cy: 'p...............',
        lt: '..............ff',
        ht: '............ff..',
      },
      vel: { ch: 88 },
    }),

  K('miami', 'Electro / Miami Bass',
    'Booming 808-style kick with a long decay, snappy classic snare, claps, cowbell and toms: electro and Miami bass.',
    118,
    {
      bd: { machine: 'BD CLASSIC', tun: -5, dec: 104, hld: 30, swt: 70, swd: 66, wav: 0, tra: 4 },
      sd: { machine: 'SD CLASSIC', tun: 2, dec: 36, det: 58, snp: 70, nod: 40, nol: 70, bal: 10 },
      cp: { machine: 'CP CLASSIC', ton: 64, num: 40, rat: 46, nod: 40, nol: 60, amp_rev: 30 },
      rs: { machine: 'RS CLASSIC', dec: 24, amp_pan: -20 },
      lt: { tun: -7, dec: 70, swd: 30, swt: 70 },
      mt: { tun: -2, dec: 66, swd: 30, swt: 70 },
      ch: { dec: 20, amp_vol: 90 },
      oh: { dec: 50 },
      cb: { machine: 'CB CLASSIC', dec: 40, amp_vol: 74, amp_del: 40 },
    },
    { del_tim: 16, del_fdb: 50, del_x: 1, rev_dec: 50, cmp_thr: 92, cmp_rat: 3 },
    {
      name: 'MIAMI',
      rows: {
        bd: 'x.....x...x.....',
        sd: '....x.......x...',
        cp: '....x.......x...',
        ch: 'x.x.x.x.x.x.x.x.',
        oh: '.............x..',
        cb: '..x..x....x..x..',
        lt: '..............x.',
        mt: '.............x..',
        rs: '.........x......',
      },
    }),

  K('robotfunk', 'Electro / Robot Funk',
    'FM kick and snare, metallic hats and a chip arpeggio on the rim track: machine funk.',
    112,
    {
      bd: { machine: 'BD FM', tun: -3, dec: 56, fma: 50, swt: 36, fms: 20, fmd: 30, fmt: 0 },
      sd: { machine: 'SD FM', tun: 2, dec: 34, fmt: 12, fmd: 30, fma: 70, nod: 40, nol: 64 },
      rs: { machine: 'SY CHIP', tun: 10, dec: 40, of2: 7, of3: 12, of4: 3, cwav: 5, cspd: 13, amp_vol: 70, amp_del: 50 },
      cp: { machine: 'CP CLASSIC', ton: 80, num: 30, nod: 30, amp_rev: 20 },
      ch: { machine: 'CH METALLIC', dec: 14 },
      oh: { machine: 'OH METALLIC', dec: 40 },
      cb: { machine: 'CB METALLIC', dec: 30, cdet: 7, amp_vol: 70 },
    },
    { del_tim: 12, del_x: 1, del_fdb: 80, rev_dec: 40, cmp_thr: 90, cmp_rat: 2 },
    {
      name: 'ROBOT',
      rows: {
        bd: 'x..x..x...x..x..',
        sd: '....x.......x...',
        rs: 'x.......x.......',
        ch: 'x.xxx.xxx.xxx.xx',
        oh: '......x.......x.',
        cb: '...x.......x....',
        cp: '............h...',
      },
      vel: { ch: 80 },
    }),

  K('straight808', 'Drum Machine / Straight Boom',
    'Recreation of the TR-808 character with the Rytm\'s classic circuits (the idea behind Elektron\'s Straight 808 pack): BD/SD/RS/CP/CH/OH/CY/CB CLASSIC and analog toms.',
    100,
    {
      bd: { machine: 'BD CLASSIC', tun: -2, dec: 92, hld: 20, swt: 64, swd: 54, tra: 2 },
      sd: { machine: 'SD CLASSIC', tun: 0, dec: 32, det: 56, snp: 60, nod: 44, nol: 64 },
      rs: { machine: 'RS CLASSIC', dec: 26 },
      cp: { machine: 'CP CLASSIC', ton: 64, num: 48, rat: 50, nod: 48, nol: 60 },
      bt: { tun: 0, dec: 64 },
      lt: { tun: -3, dec: 62, swd: 20 },
      mt: { tun: 2, dec: 60, swd: 20 },
      ht: { tun: 7, dec: 56, swd: 20 },
      ch: { machine: 'CH CLASSIC', dec: 26 },
      oh: { machine: 'OH CLASSIC', dec: 62 },
      cy: { machine: 'CY CLASSIC', dec: 100, ton: 0 },
      cb: { machine: 'CB CLASSIC', dec: 44 },
    },
    { rev_dec: 40, cmp_thr: 105 },
    {
      name: 'STRAIGHT',
      rows: {
        bd: 'x.........x.....',
        sd: '....x.......x...',
        ch: 'x.x.x.x.x.x.x.x.',
        oh: '..............x.',
        cp: '............x...',
        rs: '.......x........',
        cb: '..........x..x..',
        cy: 'p...............',
        ht: '.............f..',
        mt: '..............f.',
        lt: '...............f',
      },
    }),

  K('boombap', 'Hip-Hop / Dusty Boom Bap',
    'Swung boom bap: a soft silky kick with dust, a natural snare layered with an acoustic snare sample, bit-reduced hats and vinyl crackle.',
    90,
    {
      bd: { machine: 'BD SILKY', tun: -3, dec: 70, hld: 16, swt: 46, swd: 50, dus: 40, clk: 36, smp_slot: 1, smp_lev: 70, smp_br: 30 },
      sd: { machine: 'SD NATURAL', tun: -2, bdy: 40, nbal: 70, dec: 50, lpf: 90, hpf: 40, nres: 20, smp_slot: 4, smp_lev: 90, smp_br: 40, amp_rev: 26 },
      rs: { machine: 'RS CLASSIC', dec: 20, smp_slot: 8, smp_lev: 60 },
      ch: { dec: 24, col: -20, smp_slot: 9, smp_lev: 80, smp_br: 50, amp_vol: 84, flt_frq: 112 },
      oh: { dec: 46, col: -20, amp_vol: 70, flt_frq: 110 },
      cy: { machine: 'UT NOISE', lpf: 90, hpf: 40, dec: 127, lev: 40, smp_slot: 22, smp_lop: 1, smp_lev: 70, amp_vol: 50 },
    },
    { rev_dec: 44, rev_gai: 60, cmp_thr: 84, cmp_rat: 2, cmp_atk: 3, cmp_rel: 3, cmp_mup: 56, dis_amt: 10 },
    {
      name: 'BOOM BAP',
      rows: {
        bd: 'x......x.xh.....',
        sd: '....x..o.o..x..o',
        ch: 'x.x.x.x.x.x.x.x.',
        oh: '.............x..',
        rs: '..............h.',
        cy: 'x...............',
      },
      vel: { sd: 112, ch: 84 },
      swing: 62,
      steps: { ch: { 2: { vel: 60 }, 6: { vel: 60 }, 10: { vel: 60 }, 14: { vel: 60 } }, bd: { 7: { micro: 4 } } },
    }, 62),

  K('trap', 'Hip-Hop / Trap Sub',
    'A long, tuned 808-style sub kick, snappy snare with a clap layer and hi-hat rolls made with retrigs.',
    140,
    {
      bd: { machine: 'BD CLASSIC', tun: -7, dec: 116, hld: 40, swt: 60, swd: 46, wav: 0, tra: 6, amp_ovr: 20 },
      sd: { machine: 'SD CLASSIC', tun: 5, dec: 30, det: 50, snp: 80, nod: 46, nol: 90 },
      cp: { machine: 'CP CLASSIC', ton: 70, num: 40, rat: 36, nod: 40, nol: 70, amp_rev: 24 },
      ch: { dec: 16, col: 20, amp_vol: 92 },
      oh: { dec: 40, col: 20 },
      rs: { machine: 'RS HARD', dec: 20, amp_del: 40 },
    },
    { rev_dec: 50, cmp_thr: 86, cmp_rat: 2, cmp_mup: 54 },
    {
      name: 'TRAP SUB',
      len: 32,
      rows: {
        bd: 'x.........x.....x.....x...x.....',
        sd: '........x...............x.......',
        cp: '........x...............x.......',
        ch: 'x.x.x.x.x.x.r.x.x.x.x.x.R...x.x.',
        oh: '..............x.................',
        rs: '...............h...............x',
      },
      note: { bd: 60 },
      steps: { bd: { 22: { note: 63 }, 26: { note: 58 } }, ch: { 12: { vel: 90 } } },
    }),

  K('jungle', 'Breaks / Jungle Roller',
    'Acoustic kick and snare with ghost notes and a ride: a fast rolling breakbeat.',
    170,
    {
      bd: { machine: 'BD ACOUSTIC', tun: -1, dec: 50, hld: 10, swt: 50, swd: 40, wavx: 0, imp: 70 },
      sd: { machine: 'SD ACOUSTIC', tun: 4, bdy: 40, nod: 50, nol: 80, hld: 4, swd: 30, imp: 80 },
      ch: { dec: 22, smp_slot: 9, smp_lev: 70 },
      oh: { dec: 44 },
      cy: { machine: 'CY RIDE', typ: 0, dec: 84, hit: 30, c1: 80, c2: 70, c3: 60, amp_vol: 76 },
      mt: { tun: 4, dec: 50 },
    },
    { rev_dec: 40, cmp_thr: 80, cmp_rat: 1, cmp_atk: 2, cmp_rel: 1, cmp_mup: 62 },
    {
      name: 'ROLLER',
      rows: {
        bd: 'x.x.......x.....',
        sd: '....x..o.o..x..o',
        ch: 'x.xxx.xxx.xxx.x.',
        cy: 'x.x.x.x.x.x.x.x.',
        oh: '.......h........',
        mt: '..............fx',
      },
      vel: { sd: 116, ch: 76, cy: 70 },
      swing: 52,
    }, 52),

  K('bigbeat', 'Breaks / Big Beat',
    'A saw-wave kick and a driven snare through heavy master distortion: big beat breaks.',
    128,
    {
      bd: { machine: 'BD SHARP', tun: -2, dec: 52, hld: 14, swt: 34, swd: 76, wavx: 8, tic: 60, amp_ovr: 60, flt_frq: 96, flt_res: 30 },
      sd: { machine: 'SD HARD', tun: 0, dec: 38, swd: 50, swt: 30, tic: 60, nod: 56, nol: 110, amp_ovr: 70 },
      cp: { machine: 'CP CLASSIC', ton: 54, num: 70, rat: 40, nod: 50, nol: 80, amp_ovr: 40 },
      ch: { machine: 'CH METALLIC', dec: 22 },
      oh: { machine: 'OH METALLIC', dec: 46 },
      cy: { machine: 'CY CLASSIC', dec: 96, smp_slot: 12, smp_lev: 80 },
    },
    { dis_amt: 60, dis_sym: -10, rev_dec: 50, cmp_thr: 76, cmp_rat: 1, cmp_atk: 3, cmp_rel: 2, cmp_mup: 66 },
    {
      name: 'BIG BEAT',
      rows: {
        bd: 'x.....x...x..x..',
        sd: '....x..o....x...',
        cp: '....x.......x...',
        ch: 'x.x.x.x.x.x.x.x.',
        oh: '......x.......x.',
        cy: 'p...............',
      },
    }),

  K('microclick', 'Minimal / Micro Clicks',
    'Minimal: a short kick, impulses pinging resonant filters as tuned percussion, tiny clicks into the delay.',
    124,
    {
      bd: { machine: 'BD SILKY', tun: -2, dec: 40, hld: 4, swt: 30, swd: 50, clk: 50 },
      rs: { machine: 'RS HARD', tun: 8, dec: 14, amp_del: 76, amp_pan: 30 },
      cp: { machine: 'CP CLASSIC', ton: 90, num: 20, rat: 30, nod: 20, nol: 40, amp_rev: 40 },
      bt: { machine: 'UT IMPULSE', atk: 0, dec: 20, flt_typ: 2, flt_frq: 70, flt_res: 118, amp_del: 40 },
      lt: { machine: 'UT IMPULSE', atk: 0, dec: 16, flt_typ: 2, flt_frq: 79, flt_res: 120, amp_pan: -30, amp_del: 30 },
      ch: { dec: 12, col: 30, amp_vol: 86 },
      oh: { dec: 36, col: 30, amp_vol: 74 },
    },
    { del_tim: 24, del_x: 1, del_fdb: 96, del_hpf: 50, del_lpf: 84, rev_dec: 60, cmp_thr: 96, cmp_rat: 3 },
    {
      name: 'MICRO',
      rows: {
        bd: 'x...x...x...x...',
        rs: '..x....x..h...x.',
        ch: '..x...x...x...x.',
        bt: '.x...h.....x..h.',
        lt: '...x.....x..h...',
        oh: '......b.......a.',
        cp: '............h...',
      },
      steps: { bt: { 11: { locks: { flt_frq: 74 } } }, lt: { 9: { locks: { flt_frq: 84 } } } },
    }),

  K('glitch', 'IDM / Glitch Lab',
    'Plastic kicks, noise sweeps, a chip arpeggio and a hand-tuned hat lab, with conditions, probability and retrig rolls.',
    150,
    {
      bd: { machine: 'BD PLASTIC', tun: -1, dec: 40, typ: 1, mod: 50, swt: 24, swd: 80, tic: 70 },
      sd: { machine: 'UT NOISE', lpf: 96, hpf: 50, lpq: 70, dec: 30, atk: 0, swt: 30, nswd: -40 },
      rs: { machine: 'SY CHIP', tun: 12, dec: 30, of2: 12, of3: 19, of4: 24, cwav: 13, cspd: 10, amp_del: 60, amp_vol: 64 },
      cp: { machine: 'CP CLASSIC', ton: 100, num: 110, rat: 16, rnd: 90, nod: 30, nol: 60 },
      ch: { machine: 'HH LAB', osc1: 70, osc2: 77, osc3: 90, osc4: 96, osc5: 104, osc6: 118, dec: 14 },
      oh: { machine: 'HH LAB', osc1: 60, osc2: 66, osc3: 81, osc4: 95, osc5: 99, osc6: 110, dec: 40 },
      cy: { machine: 'CY METALLIC', dec: 50, trd: 10, ton: 40 },
    },
    { del_tim: 6, del_fdb: 120, del_x: 1, del_lpf: 100, dis_dov: 40, rev_dec: 64, cmp_thr: 84, cmp_rat: 1 },
    {
      name: 'GLITCH',
      rows: {
        bd: 'x..h..x.h.x..r..',
        sd: '....x..h...hx..r',
        rs: 'x.....h.....a...',
        cp: '..........R.....',
        ch: 'xhxhxhxhxhxhxhxh',
        oh: '...a.......b....',
        cy: 'p.......f.......',
      },
      vel: { ch: 76 },
      steps: { ch: { 1: { micro: 6 }, 5: { micro: -5 }, 9: { micro: 8 } } },
    }),

  K('dubecho', 'Dub / Echo Chamber',
    'Slow dub: a deep boom, rim and snare thrown into a ping-pong delay with overdrive and a long reverb.',
    76,
    {
      bd: { machine: 'BD CLASSIC', tun: -4, dec: 100, hld: 20, swt: 60, swd: 50, tra: 2 },
      sd: { machine: 'SD CLASSIC', tun: -3, dec: 40, det: 60, snp: 40, nod: 54, nol: 60, amp_del: 70, amp_rev: 80 },
      rs: { machine: 'RS CLASSIC', dec: 28, amp_del: 100, amp_rev: 50, amp_pan: -30 },
      ch: { dec: 22, col: -16, amp_vol: 80, amp_del: 30 },
      oh: { dec: 50, col: -16, amp_vol: 70 },
      cb: { machine: 'CB CLASSIC', dec: 34, amp_del: 90, amp_vol: 60 },
    },
    { del_tim: 24, del_x: 1, del_fdb: 130, del_hpf: 40, del_lpf: 70, del_rev: 50, dis_dov: 50, rev_dec: 104, rev_gai: 60, rev_pre: 30, cmp_thr: 90, cmp_rat: 3 },
    {
      name: 'ECHO',
      rows: {
        bd: 'x.........x.....',
        sd: '........x.......',
        rs: '...x......x...a.',
        ch: '..x...x...x...x.',
        oh: '..............x.',
        cb: '.............b..',
      },
      swing: 56,
    }, 56),

  K('studio', 'Acoustic / Studio Kit',
    'An acoustic-style kit: acoustic machines layered with sampled one-shots, tuned toms and a ride.',
    96,
    {
      bd: { machine: 'BD ACOUSTIC', tun: -2, dec: 50, swt: 56, swd: 40, imp: 60, smp_slot: 1, smp_lev: 80 },
      sd: { machine: 'SD ACOUSTIC', tun: 2, bdy: 44, nod: 54, nol: 76, imp: 70, smp_slot: 4, smp_lev: 80, amp_rev: 30 },
      lt: { tun: -5, dec: 56, swd: 24, nol: 30, smp_slot: 31, smp_lev: 60 },
      mt: { tun: 0, dec: 52, swd: 24, nol: 30 },
      ht: { tun: 5, dec: 48, swd: 24, nol: 30 },
      ch: { dec: 22, lev: 60, smp_slot: 9, smp_lev: 100 },
      oh: { dec: 48, lev: 60, smp_slot: 10, smp_lev: 90 },
      cy: { machine: 'CY RIDE', typ: 0, dec: 90, hit: 34, c1: 70, c2: 80, c3: 64 },
      cb: { machine: 'CB CLASSIC', lev: 40, smp_slot: 12, smp_lev: 100, dec: 20 },
    },
    { rev_dec: 52, rev_pre: 12, rev_gai: 90, cmp_thr: 92, cmp_rat: 3, cmp_atk: 4 },
    {
      name: 'STUDIO',
      rows: {
        bd: 'x.....x.x.......',
        sd: '....x.......x...',
        ch: 'x.x.x.x.x.x.x.x.',
        oh: '..............a.',
        cy: '................',
        ht: '............f...',
        mt: '.............ff.',
        lt: '...............f',
        cb: 'p...............',
      },
      vel: { ch: 80 },
      steps: { sd: { 7: { vel: 40 }, 15: { vel: 40 } } },
    }),

  K('brushes', 'Acoustic / Brush Jazz',
    'Swung brushes on a natural snare, a feathered kick, foot hats and a ride: jazz time.',
    130,
    {
      bd: { machine: 'BD SILKY', tun: -1, dec: 46, hld: 6, swt: 40, swd: 30, lev: 70 },
      sd: { machine: 'SD NATURAL', tun: 0, bdy: 20, nbal: 104, dec: 70, lpf: 80, hpf: 50, nres: 10, amp_atk: 20 },
      ch: { dec: 18, col: -30, amp_vol: 70 },
      cy: { machine: 'CY RIDE', typ: 0, dec: 96, hit: 40, c1: 90, c2: 60, c3: 50, amp_vol: 88 },
    },
    { rev_dec: 58, rev_gai: 80, cmp_thr: 105 },
    {
      name: 'BRUSHES',
      rows: {
        cy: 'x..xx..xx..xx..x',
        sd: 'x.o.x.o.x.o.x.o.',
        bd: 'o...o...o...o...',
        ch: '....x.......x...',
      },
      vel: { sd: 60, cy: 90 },
      swing: 66,
      steps: { cy: { 0: { vel: 110 }, 4: { vel: 110 }, 8: { vel: 110 }, 12: { vel: 110 } } },
    }, 66),

  K('lofi', 'Lo-Fi / Bitcrushed Tape',
    'Lo-fi beats: bit-reduced sample layers, a slow LFO wobbling the pitch like a worn tape, dusty and compressed.',
    84,
    {
      bd: { machine: 'BD SILKY', tun: -3, dec: 60, dus: 50, smp_slot: 2, smp_lev: 70, smp_br: 70, lfo_dst: 2, lfo_dep: 6, lfo_spd: 4, lfo_mul: 3 },
      sd: { machine: 'SD NATURAL', tun: -3, bdy: 30, nbal: 80, smp_slot: 5, smp_lev: 90, smp_br: 80, flt_frq: 100 },
      ch: { dec: 20, smp_slot: 13, smp_lev: 80, smp_br: 60, flt_frq: 104, amp_vol: 80 },
      cy: { machine: 'UT NOISE', dec: 127, lev: 30, lpf: 80, smp_slot: 22, smp_lop: 1, smp_lev: 90, amp_vol: 60 },
      rs: { machine: 'RS CLASSIC', dec: 24, smp_slot: 18, smp_lev: 70, smp_br: 40 },
    },
    { rev_dec: 48, rev_gai: 50, cmp_thr: 80, cmp_rat: 1, cmp_atk: 4, cmp_rel: 3, cmp_mup: 60, dis_amt: 16, dis_sym: 8 },
    {
      name: 'TAPE',
      rows: {
        bd: 'x.....x...x.....',
        sd: '....x.......x...',
        ch: 'x.x.x.xxx.x.x.x.',
        rs: '..........h....x',
        cy: 'x...............',
      },
      vel: { ch: 72 },
      swing: 60,
    }, 60),

  K('afrolatin', 'Percussion / Afro-Latin',
    'Recreation of a percussion kit in the spirit of Elektron\'s Curcussion pack: congas and bongos from tuned toms and samples, clave, cowbell and shaker.',
    112,
    {
      bd: { machine: 'BD CLASSIC', tun: -2, dec: 54, swd: 30, swt: 40 },
      rs: { machine: 'RS CLASSIC', t1: 8, t2: 10, dec: 14, smp_slot: 18, smp_lev: 90 },
      bt: { tun: 6, dec: 40, nol: 10, smp_slot: 16, smp_lev: 70 },
      lt: { tun: 3, dec: 36, swd: 20, smp_slot: 16, smp_lev: 80 },
      mt: { tun: 8, dec: 34, swd: 20, smp_slot: 15, smp_lev: 80 },
      ht: { tun: 14, dec: 30, swd: 20, smp_slot: 17, smp_lev: 70 },
      ch: { machine: 'UT NOISE', lpf: 110, hpf: 90, dec: 20, atk: 10, smp_slot: 13, smp_lev: 80, amp_vol: 80 },
      cb: { machine: 'CB CLASSIC', dec: 36, amp_vol: 80 },
    },
    { rev_dec: 50, cmp_thr: 96, cmp_rat: 3 },
    {
      name: 'CLAVE',
      rows: {
        bd: 'x.......x.......',
        rs: 'x..x..x...x.x...',
        lt: '..x..x.....x..x.',
        mt: 'x...x...x.o.x...',
        ht: '.......x.......x',
        ch: 'xxxxxxxxxxxxxxxx',
        cb: 'x.x.xx.x.x.xx.x.',
      },
      vel: { ch: 64, cb: 80 },
      swing: 54,
      steps: { ch: { 0: { vel: 100 }, 4: { vel: 100 }, 8: { vel: 100 }, 12: { vel: 100 } } },
    }, 54),

  K('toys', 'Synth / Analog Toys',
    'The synth machines: a dual-VCO bassline on the kick track, a raw lead stab, a chip arpeggio, played melodically with trig NOTE.',
    120,
    {
      bd: { machine: 'SY DUAL VCO', tun: -12, vdet: 12, dec: 56, dec2: 40, bal: -30, bnd: 10, cfg: 25, flt_typ: 0, flt_frq: 66, flt_res: 64, flt_env: 30, flt_dec: 46 },
      sd: { machine: 'SY RAW', tun: 0, rdet: 7, dec: 40, wav1: 5, wav2: 1, bal: 0, flt_frq: 90, flt_res: 30, amp_del: 50, amp_vol: 80 },
      rs: { machine: 'SY CHIP', tun: 24, dec: 50, of2: 4, of3: 7, of4: 12, cwav: 16, cspd: 10, amp_del: 60, amp_vol: 60 },
      cp: { machine: 'CP CLASSIC', num: 40, nod: 50, amp_rev: 50 },
      ch: { dec: 18 },
      oh: { dec: 46 },
    },
    { del_tim: 24, del_x: 1, del_fdb: 80, rev_dec: 64, cmp_thr: 92, cmp_rat: 3 },
    {
      name: 'TOYS',
      rows: {
        bd: 'x..x..x...x..x.x',
        sd: '......x.......x.',
        rs: 'x.......x.......',
        cp: '....x.......x...',
        ch: 'x.x.x.x.x.x.x.x.',
        oh: '..x...x...x...x.',
      },
      steps: {
        bd: { 3: { note: 72 }, 6: { note: 63 }, 10: { note: 67 }, 13: { note: 65 }, 15: { note: 70 } },
        sd: { 6: { note: 67 }, 14: { note: 63 } },
        rs: { 8: { note: 65 } },
      },
    }),
];

// ----------------------------------------------------------------------------
// The demo song (bank A), on kit 01 (the default kit) with kit 02 for the drop
// ----------------------------------------------------------------------------

const SONG_PATTERNS: [string, PatDef, string][] = [
  ['A01', {
    name: 'INTRO',
    rows: {
      bd: 'x...x...x...x...',
      ch: '..x...x...x...x.',
      rs: '...........h....',
      cy: 'p...............',
    },
    vel: { ch: 70 },
    steps: {
      bd: { 0: { locks: { flt_frq: 70 } }, 4: { locks: { flt_frq: 78 } }, 8: { locks: { flt_frq: 86 } }, 12: { locks: { flt_frq: 96 } } },
      ch: { 14: { locks: { amp_del: 70 } } },
    },
  }, '01'],
  ['A02', {
    name: 'GROOVE',
    rows: {
      bd: 'x...x...x...x...',
      cp: '....x.......x...',
      ch: 'o.x.o.x.o.x.o.xo',
      oh: '..............x.',
      rs: '...x..x.......x.',
      lt: '.......x........',
    },
    vel: { ch: 92 },
  }, '01'],
  ['A03', {
    name: 'GROOVE B',
    rows: {
      bd: 'x...x...x...x..a',
      cp: '....x.......x...',
      sd: '.......o.h....o.',
      ch: 'o.x.o.x.o.x.o.xo',
      oh: '......a.......x.',
      rs: '...x..x..h...x..',
      lt: '.......x......b.',
      mt: '...........h....',
      cb: '..........b.....',
    },
    vel: { ch: 92, sd: 60 },
    steps: { oh: { 14: { locks: { dec: 76 } } } },
  }, '01'],
  ['A04', {
    name: 'FILL',
    rows: {
      bd: 'x...x...x...x...',
      sd: '........x.x.rrRR',
      cp: '....x...........',
      ch: 'o.x.o.x.........',
      ht: '........x.......',
      mt: '..........x.....',
      lt: '............x...',
      bt: '..............x.',
      cy: '...............x',
    },
    vel: { ch: 92 },
    steps: { sd: { 12: { vel: 70 }, 13: { vel: 90 } } },
  }, '01'],
  ['A05', {
    name: 'BREAKDOWN',
    rows: {
      cp: '....x.......x...',
      oh: '..x...x...x...x.',
      rs: '...x.......x..x.',
      cy: 'x.......x.......',
      bt: 'x...........x...',
    },
    vel: { oh: 70 },
    steps: {
      cp: { 4: { locks: { amp_rev: 100, nod: 90 } }, 12: { locks: { amp_rev: 110, nod: 96 } } },
      oh: { 2: { locks: { flt_frq: 80 } }, 6: { locks: { flt_frq: 90 } }, 10: { locks: { flt_frq: 100 } }, 14: { locks: { flt_frq: 110 } } },
      rs: { 3: { locks: { amp_del: 90 } }, 11: { locks: { amp_del: 90 } } },
    },
  }, '01'],
  ['A06', {
    name: 'BUILD',
    rows: {
      bd: 'x...x...x...x.xx',
      sd: 'x.x.x.x.xxxxrrrr',
      ch: 'xxxxxxxxxxxxxxxx',
      cy: '...............X',
    },
    vel: { sd: 70, ch: 70 },
    steps: {
      sd: { 0: { vel: 40 }, 2: { vel: 48 }, 4: { vel: 56 }, 6: { vel: 64 }, 8: { vel: 72 }, 9: { vel: 78 }, 10: { vel: 84 }, 11: { vel: 90 }, 12: { vel: 96 }, 13: { vel: 104 }, 14: { vel: 112 }, 15: { vel: 120 } },
      ch: Object.fromEntries(Array.from({ length: 16 }, (_, i) => [i, { locks: { flt_frq: 70 + i * 3 } }])),
    },
  }, '01'],
  ['A07', {
    name: 'DROP',
    rows: {
      bd: 'X...x...x...x...',
      cp: '....x.......x...',
      sd: '.......o.......o',
      ch: 'x.x.x.x.x.x.x.xx',
      oh: '..x...x...x...x.',
      rs: '...x..x....x..x.',
      lt: '.......x......x.',
      cy: 'x...............',
      cb: '..........h.....',
    },
    vel: { ch: 100, sd: 52 },
  }, '02'],
  ['A08', {
    name: 'OUTRO',
    rows: {
      bd: 'x...x...x...x...',
      ch: '..x...x...x...x.',
      oh: '..............x.',
      cy: 'p...............',
    },
    vel: { ch: 76 },
    steps: { bd: { 8: { locks: { flt_frq: 90 } }, 12: { locks: { flt_frq: 76 } } } },
  }, '01'],
];

/** Kit ids: 01 the default kit (spec defaults), 02 the drop, 03.. the factory-style kits */
export const kitIdOf = (i: number) => String(i + 3).padStart(2, '0');
/** Pattern of a factory-style kit's demo (bank B) */
export const kitPatternOf = (i: number) => `B${String(i + 1).padStart(2, '0')}`;

export interface RytmKit {
  name: string;
  /** Control values that differ from the defaults */
  values: Vals;
  /** 12 scenes: control id -> value */
  scenes?: Vals[];
  /** 12 performance macros: control id -> target value */
  perfs?: Vals[];
}

export interface RytmProject extends Project {
  /** The kit whose sounds are in the panel (and the engine) now */
  kit?: string;
  kits?: Record<string, RytmKit>;
  /** Last engine operation applied by the panel (see ui.tsx DataSync) */
  opsApplied?: { sid: string; n: number };
  /** Data format of the Rytm extras */
  rv?: number;
}

/** Default scenes and performance macros of the factory kits */
export const DEFAULT_SCENES = (): Vals[] => {
  const s: Vals[] = Array.from({ length: 12 }, () => ({}));
  s[0] = { bd_flt_frq: 70, ch_flt_frq: 90, oh_flt_frq: 90, cp_flt_frq: 84 };                   // 1: low-passed
  s[1] = { bd_flt_typ: 4, bd_flt_frq: 60, sd_flt_typ: 4, sd_flt_frq: 66 };                      // 2: thin (high-passed kick & snare)
  s[2] = { cp_amp_rev: 120, sd_amp_rev: 110, rs_amp_rev: 120, fx_rev_dec: 116 };              // 3: big reverb
  s[3] = { rs_amp_del: 120, cp_amp_del: 100, fx_del_fdb: 150, fx_del_x: 1 };                  // 4: dub delay
  s[4] = { fx_dis_amt: 90, fx_cmp_thr: 60, fx_cmp_mup: 70 };                                   // 5: crush
  s[5] = { bd_dec: 110, bd_hld: 50, bd_swd: 90, bd_tun: -7 };                                  // 6: boom
  s[6] = { ch_dec: 70, oh_dec: 110 };                                                           // 7: washy hats
  s[7] = { bd_amp_vol: 0 };                                                                      // 8: kick out
  return s;
};
export const DEFAULT_PERFS = (): Vals[] => {
  const p: Vals[] = Array.from({ length: 12 }, () => ({}));
  p[0] = { bd_flt_frq: 40, sd_flt_frq: 40, cp_flt_frq: 40, ch_flt_frq: 60, oh_flt_frq: 60 };  // 1: filter sweep down
  p[1] = { fx_del_fdb: 170, rs_amp_del: 127, cp_amp_del: 110 };                                // 2: delay build-up
  p[2] = { fx_rev_dec: 127, cp_amp_rev: 127, sd_amp_rev: 127 };                                // 3: reverb wash
  p[3] = { fx_dis_amt: 110 };                                                                    // 4: distortion
  p[4] = { ch_dec: 90, oh_dec: 120 };                                                           // 5: open the hats
  p[5] = { bd_tun: 12, sd_tun: 12 };                                                            // 6: pitch up
  return p;
};

export const PROJECT_RV = 1;

/** The default project: demo song (bank A), factory-style kit demos (bank B), every kit */
export function defaultProject(): RytmProject {
  const base = createProject({ tracks: SEQ_TRACKS, defaults: { note: 60, vel: 100 }, active: 'A01', mode: 'song' });
  const patterns: Record<string, Pattern> = {};
  for (const [id, def, kit] of SONG_PATTERNS) patterns[id] = buildPattern(def, kit);
  KIT_PRESETS.forEach((k, i) => { patterns[kitPatternOf(i)] = buildPattern(k.pattern, kitIdOf(i)); });
  const kits: Record<string, RytmKit> = {
    '01': { name: 'RYTM STUDIO', values: {}, scenes: DEFAULT_SCENES(), perfs: DEFAULT_PERFS() },
    '02': { name: 'RYTM DROP', values: DROP_KIT, scenes: DEFAULT_SCENES(), perfs: DEFAULT_PERFS() },
  };
  KIT_PRESETS.forEach((k, i) => {
    const values = { ...k.values };
    kits[kitIdOf(i)] = { name: k.name.split('/').pop()!.trim().toUpperCase().slice(0, 15), values, scenes: DEFAULT_SCENES(), perfs: DEFAULT_PERFS() };
  });
  return {
    ...base,
    patterns,
    chain: ['A02', 'A03', 'A02', 'A04'],
    song: {
      name: 'RYTM DEMO',
      loop: true,
      loopRow: 0,
      rows: [
        { pattern: 'A01', repeats: 2 },
        { pattern: 'A02', repeats: 4 },
        { pattern: 'A03', repeats: 4 },
        { pattern: 'A04', repeats: 1 },
        { pattern: 'A05', repeats: 2 },
        { pattern: 'A06', repeats: 1 },
        { pattern: 'A07', repeats: 4 },
        { pattern: 'A04', repeats: 1 },
        { pattern: 'A07', repeats: 4 },
        { pattern: 'A08', repeats: 2 },
      ],
    },
    kit: '01',
    kits,
    rv: PROJECT_RV,
  };
}

export const SONG_BPM = 124;
export { kitIdOf as factoryKitId };
