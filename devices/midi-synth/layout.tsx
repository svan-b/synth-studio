import { createElement } from 'react';
import type { PanelElement, PanelLayout } from '@/types/panel';
import { KNOB_IDS, asData } from './config';
import { Header, KnobCaption, MonitorBox, ProgramBox, StepEditor } from './ui';

// Millimetres. 290 x 180 mm at 4 px/mm: buttons are at least 11 mm (44 px) high.
const W = 290;
const H = 180;
const COLS = 8;
const KNOBS_W = 196;
const COL_W = KNOBS_W / COLS;
const colX = (c: number) => 6 + COL_W * (c + 0.5);
const ROW_Y = [42, 72];
const KNOB_D = 12.5;

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
    { kind: 'custom', x: x - 12, y: y - 13.5, w: 24, h: 27, render: ctx => createElement(KnobCaption, { index: i, ctx }) },
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
    { kind: 'custom', x: 6, y: 3, w: 278, h: 17, render: ctx => createElement(Header, ctx) },

    { kind: 'section', x: 6, y: 22, w: KNOBS_W, h: 64, title: 'CONTROLS · MIDI CC', border: '1px solid #2c403e', radius: 2 },
    ...knobs,

    { kind: 'section', x: 205, y: 22, w: 79, h: 22, title: 'PROGRAM CHANGE', border: '1px solid #2c403e', radius: 2 },
    { kind: 'knob', control: 'program', x: 214.5, y: 35, diameter: 10, variant: 'moog-black', capColor: '#2dd4bf', label: 'none', value: 'never' },
    { kind: 'custom', x: 222, y: 26, w: 60, h: 17, render: ctx => createElement(ProgramBox, ctx) },

    { kind: 'section', x: 205, y: 47, w: 79, h: 39, title: 'MIDI MONITOR · WHAT THIS PANEL SENDS', border: '1px solid #2c403e', radius: 2 },
    { kind: 'custom', x: 206.5, y: 51.5, w: 76, h: 33, render: ctx => createElement(MonitorBox, ctx) },

    { kind: 'section', x: 6, y: 89, w: 278, h: 50, title: 'STEP SEQUENCER · FOLLOWS THE STUDIO TRANSPORT', border: '1px solid #2c403e', radius: 2 },
    { kind: 'button', control: 'play', x: 16, y: 102, shape: 'rect', w: 14, h: 11, color: '#1b2726', ledColor: '#4ade80', lit: ({ engine, values }) => !!engine.playing || !!values.play },
    { kind: 'button', control: 'seq', x: 34, y: 102, shape: 'rect', w: 14, h: 11, color: '#1b2726', ledColor: '#2dd4bf' },
    { kind: 'knob', control: 'gate', x: 13, y: 127, diameter: 10, variant: 'moog-black', capColor: '#2dd4bf' },
    { kind: 'knob', control: 'length', x: 29, y: 127, diameter: 10, variant: 'moog-black', capColor: '#2dd4bf' },
    { kind: 'knob', control: 'transpose', x: 45, y: 127, diameter: 10, variant: 'moog-black', capColor: '#2dd4bf' },
    { kind: 'custom', x: 56, y: 93, w: 226, h: 43, render: ctx => createElement(StepEditor, ctx) },

    { kind: 'keyboard', x: 6, y: 142, w: 278, h: 35, lowNote: 36, numKeys: 37 },
  ],
};
