// ============================================================================
// Saved-settings upgrades. When a rebuilt instrument changes what a control
// *means* (its range, unit or taper), settings saved by the older version must
// keep sounding the same - the way plugins convert old presets on load.
//
// Each upgrade runs once: on the browser's saved studio when the store version
// moves past it, and on project files written before it. To add one, append an
// entry and bump both versions below.
//
// Saves only keep the controls someone touched; the rest follow the spec's
// default. So when a rebuild also changes defaults, an entry lists the old ones
// (`oldDefaults`) and they are filled in first: the conversion then sees the
// patch the user actually heard.
// ============================================================================

import type { ControlValue } from '@/types';
import type { RackSlot } from '@/devices/types';

type Values = Record<string, ControlValue>;

interface Upgrade {
  /** First store version with the new meaning */
  store: number;
  /** First project-file version with the new meaning */
  project: number;
  device: string;
  /** Defaults of the version being replaced, for controls whose default changed or that were removed */
  oldDefaults?: Values;
  apply: (values: Values) => Values;
}

const UPGRADES: Upgrade[] = [
  {
    // DFAM rebuild: TEMPO used to count steps per minute; it is now BPM with
    // each step a 16th note (the hardware's 0.7-700 Hz). A quarter of the old
    // number plays at the same speed.
    store: 5,
    project: 2,
    device: 'dfam',
    oldDefaults: { vco_decay: 300, vco2_level: 50, vcf_cutoff: 1000, vcf_decay: 400, vca_decay: 500, tempo: 120 },
    apply: v => (typeof v.tempo === 'number' ? { ...v, tempo: Math.min(10500, Math.max(10.5, v.tempo / 4)) } : v),
  },
  {
    // Xone:96 rebuild to the User Guide: MASTER and BOOTH have unity at 8 on a new
    // law (it was 7.5), the crossfader's second curve is TRANSITION (DIPPED is gone),
    // SEND 1 PRE became a switch per channel, and the sends gained +6 dB of travel.
    store: 6,
    project: 3,
    device: 'xone96',
    oldDefaults: {
      master: 7.5, booth: 6, send1_pre: 0,
      cha_fader: 7, chb_fader: 7, cha_midf: 700, chb_midf: 700,
      ch2_src: 1, ch3_src: 4, ch4_src: 5, ch2_fader: 0, ch3_fader: 0, ch4_fader: 0,
    },
    apply: v => {
      const out: Values = { ...v };
      const law = (x: ControlValue) =>
        typeof x === 'number' ? Math.min(10, Math.max(0, 8 * Math.pow(Math.max(0, x) / 7.5, 0.644))) : x;
      if (out.master !== undefined) out.master = law(out.master);
      if (out.booth !== undefined) out.booth = law(out.booth);
      if (out.xf_curve === 1) out.xf_curve = 0;
      if (out.send1_pre !== undefined) {
        for (const ch of ['ch1', 'ch2', 'ch3', 'ch4', 'cha', 'chb']) {
          if (out[`${ch}_pre`] === undefined) out[`${ch}_pre`] = out.send1_pre;
        }
        delete out.send1_pre;
      }
      for (const k of Object.keys(out)) {
        const x = out[k];
        if (/_snd[12]$/.test(k) && typeof x === 'number') out[k] = x * 0.707;
      }
      return out;
    },
  },
  {
    // Sub 37 rebuild to the Subsequent 37 manual (pages in devices/sub37/REFERENCE.md):
    // the arpeggiator and OSC 2 keyboard control were redesigned, key tracking is
    // centred on MIDI 48 (was 60) and only shortens decay/release, the mod busses
    // got the real destination lists, and glide covers 15.1 ms - 6 s.
    store: 7,
    project: 4,
    device: 'sub37',
    oldDefaults: {
      mix_osc1: 80, cutoff: 1200, filter_kb_amt: 50, filter_eg_amt: 40,
      feg_attack: 5, feg_decay: 400, feg_sustain: 30, feg_release: 300, feg_vel_amt: 50,
      aeg_attack: 2, aeg_sustain: 80, aeg_release: 200, aeg_vel_amt: 50,
      glide_time: 150, glide_type: 1,
      arp_mode: 0, arp_range: 2, osc2_kb_ctrl: true, duo_mode: false,
      mod1_pgm_dest: 0, mod1_pgm_amt: 0, mod2_pgm_dest: 0, mod2_pgm_amt: 0,
    },
    apply: v => {
      const o: Values = { ...v };
      const num = (k: string, d = 0) => (typeof o[k] === 'number' ? (o[k] as number) : d);
      // Arpeggiator: same patterns at new indices; range gains two states (0 moves from index 2 to 3).
      // The old arp stepped once per beat with a 55 % gate.
      o.arp_pattern = num('arp_mode');
      o.arp_oct_range = num('arp_range', 2) + 1;
      o.arp_div = 10;
      o.arp_gate = 55;
      delete o.arp_mode;
      delete o.arp_range;
      // OSC 2 keyboard control: a bool became OFF/LO/HI, which only acts in DUO MODE
      const wasDuo = o.duo_mode === true;
      if (o.osc2_kb_ctrl === false) {
        // OSC 2 droned: keep that with KB CTRL OFF in DUO, at the same pitch (FREQUENCY spans ±3 oct there)
        o.kb_ctrl = 0;
        o.duo_mode = true;
        o.osc2_frequency = num('osc2_frequency') * 7 / 36;
      } else {
        o.kb_ctrl = 2;
      }
      if (wasDuo) o.key_priority = 1; // the old OSC 1 took the lowest key
      delete o.osc2_kb_ctrl;
      // Key tracking now pivots on MIDI 48: shift the base so every key keeps its cutoff and times
      const fkb = num('filter_kb_amt', 50);
      o.cutoff = Math.min(20000, Math.max(20, num('cutoff', 1200) * Math.pow(2, -fkb / 100)));
      for (const eg of ['feg', 'aeg']) {
        const amt = num(`${eg}_kb_amt`);
        if (!amt) continue;
        for (const stage of ['decay', 'release']) {
          const k = `${eg}_${stage}`;
          if (typeof o[k] === 'number') o[k] = Math.min(10000, (o[k] as number) * Math.pow(2, amt / 100));
        }
      }
      // Mod busses: the PGM destination (WAVE, RES, EG TIME, AMP) maps onto MOD DEST / PGM DEST
      for (const n of [1, 2]) {
        const dest = num(`mod${n}_pgm_dest`);
        if (dest === 0) o[`mod${n}_dest`] = 3;
        else if (dest === 1) { o[`mod${n}_dest`] = 6; o[`mod${n}_pgm_dst`] = 1; }
        else if (dest === 2) { o[`mod${n}_dest`] = 6; o[`mod${n}_pgm_dst`] = 0; }
        else if (dest === 3) o[`mod${n}_dest`] = 1;
        o[`mod${n}_mod_amt`] = num(`mod${n}_pgm_amt`);
        delete o[`mod${n}_pgm_dest`];
        delete o[`mod${n}_pgm_amt`];
      }
      if (typeof o.glide_time === 'number') o.glide_time = Math.min(6000, Math.max(15.1, o.glide_time));
      return o;
    },
  },
  {
    // Analog Four MKII rebuild to the OS 1.55 manual: every sound and sequencer
    // parameter was redefined (about 500 ids replaced; old patterns lived in control
    // strings). No faithful conversion exists, and keeping the few surviving ids
    // would only make a hybrid, so old A4 settings start fresh: the new defaults
    // and the demo song.
    store: 7,
    project: 4,
    device: 'analog-four',
    apply: () => ({}),
  },
  {
    // Mother-32 rebuild to the v2 Owner's Manual: three switches list their
    // positions in panel order, VCF MOD became AMOUNT plus a POLARITY switch,
    // FREQUENCY spans ±1 octave and PW 2-98 %, and the global gate length became
    // a gate per step (SEQ GATE, 1-8 eighths of a step).
    store: 8,
    project: 5,
    device: 'mother32',
    oldDefaults: {
      seq_notes: 'mmym0pmtmmwmr0tp................', gate_length: 50,
      vco_wave: 0, vco_mod_dest: 0, lfo_wave: 0, vcf_mod_amount: 40,
      cutoff: 1200, resonance: 15, volume: 70, attack: 2, decay: 400, lfo_rate: 4, vc_mix: 50, assign_source: 0,
    },
    apply: v => {
      const o: Values = { ...v };
      const flip = (k: string) => { if (typeof o[k] === 'number') o[k] = 1 - (o[k] as number); };
      flip('vco_wave');
      flip('vco_mod_dest');
      flip('lfo_wave');
      if (typeof o.vcf_mod_amount === 'number') {
        const a = o.vcf_mod_amount;
        o.vcf_mod_amount = Math.abs(a);
        o.vcf_mod_polarity = a < 0 ? 1 : 0;
      }
      if (typeof o.frequency === 'number') o.frequency = Math.min(1, Math.max(-1, o.frequency));
      if (typeof o.pulse_width === 'number') o.pulse_width = Math.min(98, Math.max(2, o.pulse_width));
      if (typeof o.gate_length === 'number') {
        const step = Math.min(8, Math.max(1, Math.round(o.gate_length / 12.5)));
        o.seq_gate = String(step).repeat(32);
        delete o.gate_length;
      }
      return o;
    },
  },
];

/** Lessons replaced by a rebuild: completing the old one counts for its successor */
const LESSON_RENAMES: { store: number; map: Record<string, string> }[] = [
  {
    store: 7,
    map: {
      'sub37-waveforms': 'sub37-f1-oscillators',
      'sub37-octaves-beating': 'sub37-f2-osc2-tuning',
      'sub37-sub-mixer-noise': 'sub37-f3-mixer',
      'sub37-filter': 'sub37-f4-filter',
      'sub37-kb-tracking': 'sub37-f4-filter',
      'sub37-envelopes': 'sub37-f5-envelopes',
      'sub37-mod-busses': 'sub37-f7-modulation',
      'sub37-duo-loop': 'sub37-f8-duo',
      'sub37-arpeggiator': 'sub37-sq1-arpeggiator',
      'sub37-glide': 'sub37-p1-wheels-glide-latch',
      'sub37-hard-sync': 'sub37-sd2-sync-lead',
      'sub37-multidrive': 'sub37-sd3-grit',
    },
  },
  {
    store: 8,
    map: {
      'm32-first-sound': 'mother32-f1-vco',
      'm32-waveforms-pwm': 'mother32-f1-vco',
      'm32-filter': 'mother32-f3-filter',
      'm32-envelopes': 'mother32-f4-eg-vca',
      'm32-lfo': 'mother32-f5-modulation',
      'm32-sequence': 'mother32-f6-sequencer',
      'm32-patching-basics': 'mother32-f7-patching',
      'm32-mults-attenuators': 'mother32-f7-patching',
      'm32-external-clock': 'mother32-st1-studio-clock',
    },
  },
];

/** Carry lesson completions over to the lessons that replaced them */
export function upgradeCompletedLessons(done: string[], from: number): string[] {
  const pending = LESSON_RENAMES.filter(r => r.store > from);
  if (!pending.length) return done;
  const out = new Set(done);
  pending.forEach(r => done.forEach(id => { if (r.map[id]) out.add(r.map[id]); }));
  return [...out];
}

export const STORE_VERSION = 8;
export const PROJECT_VERSION = 5;

/**
 * Upgrade the control values of every instance saved before version `from`
 * ('store' for browser saves, 'project' for project files). `rack` maps
 * instance ids to devices; ids not in it are "<device>" or "<device>#n".
 */
export function upgradeDevices<S extends { controlValues?: Values }>(
  devices: Record<string, S>,
  rack: RackSlot[],
  key: 'store' | 'project',
  from: number,
): Record<string, S> {
  const pending = UPGRADES.filter(u => u[key] > from);
  if (!pending.length) return devices;
  const out: Record<string, S> = {};
  Object.entries(devices).forEach(([instance, state]) => {
    const device = rack.find(r => r.id === instance)?.device ?? instance.split('#')[0];
    let values = state.controlValues;
    pending.forEach(u => {
      if (values && u.device === device) values = u.apply(u.oldDefaults ? { ...u.oldDefaults, ...values } : values);
    });
    out[instance] = values === state.controlValues ? state : { ...state, controlValues: values };
  });
  return out;
}
