import { createElement } from 'react';
import type { PanelElement, PanelLayout } from '@/types/panel';
import { KNOB_IDS, asData } from './config';
import { Header, KnobCaption, StepEditor } from './ui';

// Millimetres. 290 x 170 mm at 4 px/mm.
const W = 290;
const H = 170;
const COLS = 8;
const COL_W = 278 / COLS;
const colX = (c: number) => 6 + COL_W * (c + 0.5);
const ROW_Y = [42, 70];
const KNOB_D = 13;

const knobs: PanelElement[] = KNOB_IDS.flatMap((id, i): PanelElement[] => {
  const x = colX(i % COLS);
  const y = ROW_Y[Math.floor(i / COLS)];
  return [
    {
      kind: 'knob', x, y, diameter: KNOB_D, variant: 'moog-black', capColor: '#2dd4bf', label: 'none', value: 'never',
      // Knobs without a CC assigned are drawn as inert caps (no data yet = all shown)
      control: ({ data }) => (data === undefined || asData(data).knobs[i] ? id : null),
    },
    // Label above and CC value below, from the instance's data (not clickable - the knob is)
    { kind: 'custom', x: x - 16, y: y - 13.5, w: 32, h: 27, render: ctx => createElement(KnobCaption, { index: i, ctx }) },
  ];
});

export const MIDI_SYNTH_LAYOUT: PanelLayout = {
  width: W,
  height: H,
  pxPerMm: 4,
  theme: {
    background: 'linear-gradient(180deg, #1c2a29 0%, #121b1a 100%)',
    text: '#e6f2f0',
    muted: '#8fa8a5',
    accent: '#2dd4bf',
  },
  elements: [
    { kind: 'custom', x: 6, y: 4, w: 278, h: 15, render: ctx => createElement(Header, ctx) },

    { kind: 'section', x: 6, y: 22, w: 278, h: 64, title: 'CONTROLS · MIDI CC', border: '1px solid #2c403e', radius: 2 },
    ...knobs,

    { kind: 'section', x: 6, y: 90, w: 278, h: 41, title: 'STEP SEQUENCER · FOLLOWS THE STUDIO TRANSPORT', border: '1px solid #2c403e', radius: 2 },
    { kind: 'button', control: 'play', x: 16, y: 101, shape: 'rect', w: 12, h: 7, color: '#1b2726', ledColor: '#4ade80', lit: ({ engine, values }) => !!engine.playing || !!values.play },
    { kind: 'button', control: 'seq', x: 34, y: 101, shape: 'rect', w: 12, h: 7, color: '#1b2726', ledColor: '#2dd4bf' },
    { kind: 'knob', control: 'gate', x: 13, y: 121, diameter: 8.5, variant: 'moog-black', capColor: '#2dd4bf' },
    { kind: 'knob', control: 'length', x: 29, y: 121, diameter: 8.5, variant: 'moog-black', capColor: '#2dd4bf' },
    { kind: 'knob', control: 'transpose', x: 45, y: 121, diameter: 8.5, variant: 'moog-black', capColor: '#2dd4bf' },
    { kind: 'custom', x: 56, y: 93.5, w: 226, h: 35, render: ctx => createElement(StepEditor, ctx) },

    { kind: 'keyboard', x: 6, y: 134, w: 278, h: 32, lowNote: 36, numKeys: 37 },
  ],
};
