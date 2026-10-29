// ============================================================================
// Analog Four MKII arpeggiator settings belong to the pattern, not the kit
// (manual p.16, p.38, p.43). Each pattern keeps an `a4arp` entry per track;
// a pattern without one falls back to the track's ARP values (the kit's sound
// settings), which is how kit presets and the demo song set their arps.
// Only NO2-NO4 can also be parameter locked per trig (manual p.44, p.49).
// ============================================================================

import { getPattern, withPattern, type Pattern, type PatternId, type Project } from '@/lib/sequencer/elektron';

export const ARP_KEYS = ['arp_mod', 'arp_spd', 'arp_rng', 'arp_nlen', 'arp_leg', 'arp_n2', 'arp_n3', 'arp_n4'] as const;
export type ArpKey = (typeof ARP_KEYS)[number];
export type ArpSettings = Partial<Record<ArpKey, number>>;

/** A pattern with the A4's per-track arpeggiator settings */
export type A4Pattern = Pattern & { a4arp?: Record<number, ArpSettings> };

export const isArpKey = (k: string): k is ArpKey => (ARP_KEYS as readonly string[]).includes(k);

/** The pattern's own arpeggiator settings for a track (undefined: it uses the track's values) */
export function patternArp(p: Project, id: PatternId, track: number): ArpSettings | undefined {
  return (getPattern(p, id) as A4Pattern).a4arp?.[track];
}

/** Set one arpeggiator value on a pattern's track; the first edit copies the track's current values in */
export function setPatternArp(p: Project, id: PatternId, track: number, key: ArpKey, value: number, current: ArpSettings): Project {
  return withPattern(p, id, pat => {
    const a = (pat as A4Pattern).a4arp ?? {};
    const prev = a[track] ?? current;
    return { ...pat, a4arp: { ...a, [track]: { ...prev, [key]: value } } } as A4Pattern;
  });
}

/** Give a pattern's track its own arpeggiator settings (kits, the sound browser) */
export function withPatternArp(pat: Pattern, track: number, settings: ArpSettings): A4Pattern {
  const a = (pat as A4Pattern).a4arp ?? {};
  return { ...pat, a4arp: { ...a, [track]: { ...(a[track] ?? {}), ...settings } } } as A4Pattern;
}
