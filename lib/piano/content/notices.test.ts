import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CREDITS, PRIVACY, PRIVACY_INTRO } from './about';

describe('credit and privacy', () => {
  it('ships a licence notice for every package in the app, up to date with the code', () => {
    // Fails when a package is added or updated and the notices were not written again.
    expect(() => execFileSync('node', ['scripts/piano-notices.mjs', '--check'], { stdio: 'pipe' })).not.toThrow();
    const text = fs.readFileSync('public/piano/licences.txt', 'utf8');
    for (const name of ['next', 'react', 'vexflow', 'ts-fsrs', 'zustand']) expect(text).toContain(`\n${name} `);
    expect(text).toContain('Salamander Grand Piano V3');
    expect(text).toContain('SIL OPEN FONT LICENSE');
  }, 30000);

  it('credits the recordings and the font the way their licences ask', () => {
    const piano = CREDITS.find((c) => c.heading === 'The piano sound');
    expect(piano?.text).toMatch(/Alexander Holm/);
    // Creative Commons Attribution asks for a link to the licence and a note of what was changed.
    expect(piano?.links?.some((l) => l.href.includes('creativecommons.org/licenses/by/3.0'))).toBe(true);
    expect(piano?.text).toMatch(/shortened/);
    expect(CREDITS.some((c) => /Bravura/.test(c.text) && /Open Font License/.test(c.text))).toBe(true);
  });

  it('says in the privacy policy what the app does with the microphone, Bluetooth and progress', () => {
    const all = [PRIVACY_INTRO, ...PRIVACY.map((p) => `${p.heading} ${p.text}`)].join(' ');
    for (const word of ['microphone', 'Bluetooth', 'progress', 'Delet', 'Children']) expect(all).toContain(word);
    // Written in plain words, without dashes standing in for punctuation.
    expect(all).not.toMatch(/[—–]|--/);
  });
});
