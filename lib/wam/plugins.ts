// ============================================================================
// Known public WAM 2 plugins (the wam-community collection hosted at
// webaudiomodules.com). Paths come from the collection's own index
// (dist/plugins.json in the wam-community@0.4.9 npm package).
//
// None of these could be loaded from their public URL while this was built
// (the build environment could only reach GitHub and npm), so every entry is
// marked unverified. `testedCopy` marks plugins whose identical files from the
// npm package were loaded in this host in automated tests (served locally).
// Plugins that need host extensions (window.WAMExtensions: notes, assets,
// modulation targets...) are left out.
// ============================================================================

export interface KnownPlugin {
  name: string;
  vendor: string;
  kind: 'instrument' | 'effect';
  description: string;
  url: string;
  /** Loaded from its public URL in testing */
  verified: boolean;
  /** The same files (npm wam-community@0.4.9) loaded in this host in testing */
  testedCopy?: boolean;
}

export const WAM_COMMUNITY = 'https://www.webaudiomodules.com/community/plugins/';

const p = (name: string, vendor: string, kind: KnownPlugin['kind'], path: string, description: string, testedCopy = false): KnownPlugin =>
  ({ name, vendor, kind, description, url: `${WAM_COMMUNITY}${path}`, verified: false, ...(testedCopy ? { testedCopy } : {}) });

export const KNOWN_PLUGINS: KnownPlugin[] = [
  p('Synth-101', 'Sequencer Party', 'instrument', 'burns-audio/synth101/index.js', 'Monophonic analog-style synth in the spirit of the SH-101'),
  p('Spectrum: Modal', 'Sequencer Party', 'instrument', 'burns-audio/modal/index.js', 'Modal synthesis: struck and bowed resonators'),
  p('Microverb', 'Sequencer Party', 'effect', 'burns-audio/reverb/index.js', 'Compact reverb'),
  p('Simple Delay', 'Sequencer Party', 'effect', 'burns-audio/delay/index.js', 'Feedback delay'),
  p('Simple Distortion', 'Sequencer Party', 'effect', 'burns-audio/distortion/index.js', 'Waveshaper distortion with variable curve and gain'),
  p('Simple EQ', 'Sequencer Party', 'effect', 'burns-audio/simpleEQ/index.js', 'Equalizer'),
  p('PingPongDelay', 'Wimmics', 'effect', 'wimmics/pingpongdelay/dist/index.js', 'Stereo ping-pong delay'),
  p('Big Muff', 'Wimmics', 'effect', 'wimmics/BigMuff/index.js', 'Fuzz pedal model'),
  p('StonePhaser', 'Wimmics', 'effect', 'wimmics/stonephaser/index.js', 'Phaser'),
  p('Grey Hole', 'Wimmics', 'effect', 'wimmics/greyhole/index.js', 'Huge diffuse reverb'),
  p('ThruZeroFlanger', 'Wimmics', 'effect', 'wimmics/ThruZeroFlanger/index.js', 'Through-zero flanger'),
];

export const findKnownPlugin = (url: string | null | undefined) => (url ? KNOWN_PLUGINS.find(k => k.url === url) : undefined);
