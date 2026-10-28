// ============================================================================
// Known public WAM 2 plugins: the wam-community collection hosted at
// webaudiomodules.com. Paths come from the collection's own index
// (dist/plugins.json in the wam-community@0.4.9 npm package).
//
// None of these could be loaded from their public URL while this was built
// (the build environment could only reach GitHub and npm), so every entry is
// marked unverified. Each one was loaded in this host from the identical files
// of the npm package (served locally) - `testedCopy`. Left out: plugins that
// need host extensions (window.WAMExtensions: notes, assets, modulation
// targets, video), MIDI-only utilities, and Wimmics plugins whose npm copy is
// missing shared files (they may work from the hosted collection - paste the
// URL to try them).
// ============================================================================

export interface KnownPlugin {
  name: string;
  vendor: string;
  kind: 'instrument' | 'effect';
  description: string;
  url: string;
  /** Loaded from its public URL in testing */
  verified: boolean;
  /** The identical files (npm wam-community@0.4.9) loaded in this host in testing */
  testedCopy?: boolean;
}

export const WAM_COMMUNITY = 'https://www.webaudiomodules.com/community/plugins/';
/** The collection's own index, for people who want the full list */
export const WAM_COMMUNITY_INDEX = 'https://www.webaudiomodules.com/community/plugins.json';

const p = (name: string, vendor: string, kind: KnownPlugin['kind'], path: string, description: string): KnownPlugin =>
  ({ name, vendor, kind, description, url: `${WAM_COMMUNITY}${path}`, verified: false, testedCopy: true });

export const KNOWN_PLUGINS: KnownPlugin[] = [
  p('Synth-101', 'Sequencer Party', 'instrument', 'burns-audio/synth101/index.js', 'Monophonic analog-style synth in the spirit of the SH-101'),
  p('Spectrum: Modal', 'Sequencer Party', 'instrument', 'burns-audio/modal/index.js', 'Modal synthesis: struck and bowed resonators'),
  p('Microverb', 'Sequencer Party', 'effect', 'burns-audio/reverb/index.js', 'Compact reverb'),
  p('Simple Delay', 'Sequencer Party', 'effect', 'burns-audio/delay/index.js', 'Feedback delay'),
  p('Simple Distortion', 'Sequencer Party', 'effect', 'burns-audio/distortion/index.js', 'Waveshaper distortion with variable curve and gain'),
  p('Simple EQ', 'Sequencer Party', 'effect', 'burns-audio/simpleEQ/index.js', 'Equalizer'),
  p('PingPongDelay', 'Wimmics', 'effect', 'wimmics/pingpongdelay/dist/index.js', 'Stereo ping-pong delay'),
  p('QuadraFuzz', 'Wimmics', 'effect', 'wimmics/quadrafuzz/dist/index.js', 'Four-band fuzz distortion'),
  p('Oscilloscope', 'Wimmics', 'effect', 'wimmics/SRVisualizers/dist/oscilloscope/index.js', 'See the waveform of whatever you patch into IN'),
  p('Spectrogram', 'Wimmics', 'effect', 'wimmics/SRVisualizers/dist/spectrogram/index.js', 'See the frequencies of whatever you patch into IN'),
];

export const findKnownPlugin = (url: string | null | undefined) => (url ? KNOWN_PLUGINS.find(k => k.url === url) : undefined);
