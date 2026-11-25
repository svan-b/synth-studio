#!/usr/bin/env node
/**
 * Writes public/piano/licences.txt, the notices for the work of others that
 * the piano teacher contains: the piano recordings, the music font, and
 * every open source package that ends up in the app's code.
 *
 * The list of packages is not written by hand. It is read from what the
 * bundler actually pulls in, so a package added later is never left out.
 *
 *   node scripts/piano-notices.mjs           writes the file
 *   node scripts/piano-notices.mjs --check   fails if the file is out of date
 */
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, 'public/piano/licences.txt');

/** Next.js puts its own runtime and its own copy of React into every page, whatever the page imports. */
const RUNTIME = ['next', 'react', 'react-dom', 'scheduler', '@swc/helpers'];

const RULE = '='.repeat(72);

/** The packages whose code the piano teacher's pages pull in. */
async function bundledPackages() {
  const result = await build({
    entryPoints: ['app/piano/PianoClient.tsx', 'components/piano/App.tsx'],
    absWorkingDir: root,
    outdir: 'out-notices',
    bundle: true,
    write: false,
    metafile: true,
    platform: 'browser',
    format: 'esm',
    jsx: 'automatic',
    loader: { '.css': 'empty' },
    logLevel: 'silent',
    // The runtime is listed by hand above. What the app's own code imports is found here.
    external: ['next', 'next/*', 'react', 'react/*', 'react-dom', 'react-dom/*'],
  });
  const found = new Set();
  for (const input of Object.keys(result.metafile.inputs)) {
    const m = /node_modules\/((?:@[^/]+\/)?[^/]+)\//.exec(input);
    if (m) found.add(m[1]);
  }
  return [...RUNTIME, ...[...found].filter((p) => !RUNTIME.includes(p)).sort()];
}

function licenceText(dir) {
  const names = fs.readdirSync(dir);
  const file = names.find((n) => /^licen[cs]e(\.md|\.txt)?$/i.test(n));
  const notice = names.find((n) => /^notice(\.md|\.txt)?$/i.test(n));
  let text = file ? fs.readFileSync(path.join(dir, file), 'utf8').trim() : '';
  if (notice) text += `\n\n${fs.readFileSync(path.join(dir, notice), 'utf8').trim()}`;
  return text;
}

function packageNotice(name) {
  const dir = path.join(root, 'node_modules', name);
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  const repo = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url;
  const where = (pkg.homepage || repo || '').replace(/^git\+/, '').replace(/\.git$/, '');
  const text = licenceText(dir);
  return [
    RULE,
    `${pkg.name} ${pkg.version}`,
    `Licence: ${pkg.license}`,
    ...(where ? [where] : []),
    '',
    text || `This package is published under the ${pkg.license} licence and ships no licence file of its own.`,
  ].join('\n');
}

export async function notices() {
  const packages = await bundledPackages();
  const ofl = fs.readFileSync(path.join(root, 'scripts/notices/OFL-1.1.txt'), 'utf8').trim();
  const parts = [
    'Middle C',
    'Notices for the work of others that this app contains',
    '',
    RULE,
    'The piano sound',
    '',
    'Salamander Grand Piano V3, recorded by Alexander Holm.',
    'Source: https://archive.org/details/SalamanderGrandPianoV3',
    'Licence: Creative Commons Attribution 3.0 Unported',
    'https://creativecommons.org/licenses/by/3.0/',
    '',
    'Changes made for this app: one of the sixteen loudness layers is used, and',
    'each recording was shortened, faded out at its end and encoded again as MP3.',
    'When a piano is connected over MIDI, demonstrations are played by that piano',
    'and these recordings are not used.',
    '',
    RULE,
    'The music symbols',
    '',
    'The notes, clefs and other symbols are drawn from Bravura, a music font by',
    'Steinberg Media Technologies GmbH, in the form converted for VexFlow.',
    'Copyright (c) Steinberg Media Technologies GmbH (http://www.steinberg.net/),',
    'with Reserved Font Name "Bravura".',
    'Licence: SIL Open Font License, Version 1.1, given in full here.',
    '',
    ofl,
    '',
    RULE,
    'Open source software',
    '',
    `The app's code includes these ${packages.length} packages, each under its own licence.`,
    '',
    ...packages.map(packageNotice).flatMap((p) => [p, '']),
  ];
  return `${parts.join('\n').trimEnd()}\n`;
}

const run = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (run) {
  const text = await notices();
  if (process.argv.includes('--check')) {
    const kept = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    if (kept !== text) {
      console.error('public/piano/licences.txt is out of date. Run: node scripts/piano-notices.mjs');
      process.exit(1);
    }
    console.log('public/piano/licences.txt is up to date.');
  } else {
    fs.writeFileSync(OUT, text);
    console.log(`Wrote ${path.relative(root, OUT)} (${text.length} characters).`);
  }
}
