'use client';
// ============================================================================
// Analog Four MKII - which graphic each parameter gets on the OLED
//
// The graphics themselves are the Elektron OLED kit's (components/sequencer/
// OledGraphics.tsx), shared with the Analog Rytm. This file follows the A4's
// page figures (manual p.18, p.87-100): a dial for a plain value, a switch for
// on/off, a level column for levels and sends, the waveform for WAV and SUB,
// a curve across FRQ and RES for each filter, the envelope across ATK, DEC,
// SUS and REL, a word for lists (MUL, MOD, DST), a hatched square for a knob
// that does nothing.
// ============================================================================

import type { ReactNode } from 'react';
import {
  AdsrGraph, BandGraph, DialIcon, FLAT_PATH, FadeIcon, FilterTypeIcon, LFO_WAVE_PATHS, LadderGraph, LevelIcon, MultimodeGraph, PanIcon, PathIcon,
  PulseWidthIcon, ShapeIcon, ShelfGraph, SwitchIcon, type Fall, type Rise,
} from '@/components/sequencer/OledGraphics';
import { ONOFF, type PageId, type ParamDef } from './params';

export { DialIcon, UnusedIcon } from '@/components/sequencer/OledGraphics';

export const OLED_ON = '#e9f1ff';
export const OLED_DIM = '#8693a9';
/** Height of every graphic, in CSS px */
export const GRAPHIC_H = 14;

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** Oscillator waves: SAW, TRP (a pulse with a sloping top), PUL, TRI */
const OSC_WAVES = [
  'M 2 11.5 L 12.5 2.5 V 11.5 L 23 2.5 V 11.5',
  'M 2 11.5 V 3 L 7.5 5.5 V 11.5 H 13 V 3 L 18.5 5.5 V 11.5 H 24',
  'M 2 11.5 V 2.5 H 7.5 V 11.5 H 13 V 2.5 H 18.5 V 11.5 H 24',
  'M 2 11.5 L 7.5 2.5 L 13 11.5 L 18.5 2.5 L 24 11.5',
];
/** Sub oscillators: OFF, 1OCT (a square twice as long as the oscillator's), 2OCT, 2PUL (25 %), 5TH (33 %) */
const SUB_WAVES = [
  FLAT_PATH,
  'M 2 11.5 V 2.5 H 13 V 11.5 H 24',
  'M 2 11.5 V 2.5 H 24',
  'M 2 11.5 V 2.5 H 7.5 V 11.5 H 24',
  'M 2 11.5 V 2.5 H 9.3 V 11.5 H 24',
];

/** The envelope shapes (SHP >> 1) as the voice plays them: [attack, decay and release] (manual p.74-75) */
const SHAPE_CURVES: [Rise, Fall][] = [
  ['linear', 'linear'], ['standard', 'exponential'], ['exponential', 'linear'], ['exponential', 'exponential'], ['full', 'linear'], ['full', 'exponential'],
];
const curvesOf = (shape: number) => SHAPE_CURVES[Math.round(clamp(shape, 0, 11)) >> 1];

/** A graphic that spans several knob slots, starting at `slot` of a page */
export interface WideGraphic { span: number; render: (v: (key: string) => number) => ReactNode }

/** The wide graphics of a page, by the slot they start at */
export function wideGraphics(page: PageId): Record<number, WideGraphic> {
  const env = (e: string): WideGraphic => ({
    span: 4,
    render: v => {
      const [attack, decay] = curvesOf(v(`${e}_shp`));
      return <AdsrGraph atk={v(`${e}_atk`)} dec={v(`${e}_dec`)} sus={v(`${e}_sus`)} rel={v(`${e}_rel`)} attack={attack} decay={decay} hold={v(`${e}_rel`) >= 127} />;
    },
  });
  const band = (fx: string): WideGraphic => ({ span: 2, render: v => <BandGraph hpf={v(`${fx}_hpf`)} lpf={v(`${fx}_lpf`)} /> });
  switch (page) {
    case 'filters': return {
      0: { span: 2, render: v => <LadderGraph frq={v('flt1_frq')} res={v('flt1_res')} /> },
      5: { span: 2, render: v => <MultimodeGraph frq={v('flt2_frq')} res={v('flt2_res')} type={v('flt2_typ')} /> },
    };
    case 'amp': return { 0: env('amp') };
    case 'envf': return { 0: env('envf') };
    case 'env2': return { 0: env('env2') };
    case 'chorus': return { 5: band('cho') };
    case 'delay': return { 5: band('del') };
    case 'reverb': return { 2: { span: 2, render: v => <ShelfGraph frq={v('rev_frq')} gain={v('rev_gai')} /> }, 5: band('rev') };
    default: return {};
  }
}

const LEVELS = /^(osc[12]_lev|noise_lev|amp_(cho|del|rev|vol)|ext[lr]_(cho|del|rev|lev)|cho_(del|rev|vol)|del_(rev|vol)|rev_vol)$/;

/**
 * The graphic of one parameter. `null`: the parameter is shown as a word (its value), the way the
 * hardware shows lists such as MUL, MOD and DST.
 */
export function paramGraphic(p: ParamDef, value: number, norm: number): ReactNode {
  const k = p.key;
  const i = Math.round(value);
  if (p.options === ONOFF) return <SwitchIcon on={value >= 0.5} />;
  if (LEVELS.test(k)) return <LevelIcon norm={norm} />;
  if (/_pan$/.test(k)) return <PanIcon norm={norm} />;
  if (/^osc[12]_wav$/.test(k)) {
    if (i >= 0 && i < OSC_WAVES.length) return <PathIcon d={OSC_WAVES[i]} />;
    return p.options?.[i] === 'OFF' ? <PathIcon d={FLAT_PATH} /> : null; // INL, INR, FDB, NEI: a word
  }
  if (/^osc[12]_sub$/.test(k)) return <PathIcon d={SUB_WAVES[clamp(i, 0, SUB_WAVES.length - 1)]} />;
  if (/^osc[12]_pw$/.test(k)) return <PulseWidthIcon norm={norm} />;
  if (/^(noise_fad|osc_vfa|(fx)?lfo[12]_fad)$/.test(k)) return <FadeIcon value={value} />;
  if (/^(fx)?lfo[12]_wav$/.test(k)) return <PathIcon d={LFO_WAVE_PATHS[clamp(i, 0, LFO_WAVE_PATHS.length - 1)]} />;
  if (/_shp$/.test(k)) {
    const [attack, decay] = curvesOf(value);
    return <ShapeIcon attack={attack} decay={decay} restart={Math.round(clamp(value, 0, 11)) % 2 === 1} />;
  }
  if (k === 'flt2_typ') return <FilterTypeIcon type={value} />;
  if (p.options) return null;
  return <DialIcon norm={norm} />;
}

/** The name under a graphic: the screen's own spelling where it differs from the manual's text (S&H reads SNH) */
export function screenLabel(p: ParamDef): string {
  return p.key === 'noise_snh' ? 'SNH' : p.short;
}

const LFO_MODE_WORDS: Record<string, string> = { FRE: 'FREE', TRG: 'TRIG', HLD: 'HOLD', ONE: 'ONE', HLF: 'HALF' };
/** A list value as the screen writes it: the LFO modes in full, the multipliers with their own signs */
export function screenWord(p: ParamDef, text: string): string {
  if (/lfo[12]_mod$/.test(p.key)) return LFO_MODE_WORDS[text] ?? text;
  if (/lfo[12]_mul$/.test(p.key)) return text.replace(/^x/, '×').replace(/^\./, '•');
  return text;
}
