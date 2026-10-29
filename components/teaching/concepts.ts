// Short names for synthesis concepts (lesson tags, the end-of-lesson summary).
// Kept apart from the coach so the lesson browser can use them without loading it.

const CONCEPT_LABELS: Record<string, string> = {
  'oscillator-pitch': 'Pitch', 'oscillator-waveform': 'Waveforms', 'oscillator-sync': 'Hard sync',
  'frequency-modulation': 'FM', subharmonics: 'Subharmonics', noise: 'Noise', mixing: 'Mixing',
  'envelope-attack': 'Attack', 'envelope-decay': 'Decay', 'envelope-sustain': 'Sustain', 'envelope-release': 'Release',
  'envelope-shape': 'Envelope shape', 'filter-cutoff': 'Filter cutoff', 'filter-resonance': 'Resonance',
  'filter-type': 'Filter type', lfo: 'LFO', 'modulation-source': 'Mod sources', 'modulation-depth': 'Mod depth',
  'signal-routing': 'Patching', 'velocity-dynamics': 'Velocity', glide: 'Glide', 'timing-tempo': 'Tempo',
  'sequencer-pattern': 'Sequencing', polyrhythm: 'Polyrhythm', 'parameter-locks': 'Parameter locks',
  effects: 'Effects', equalization: 'EQ', 'dj-mixing': 'DJ mixing', 'gain-staging': 'Gain staging',
};

export function conceptLabel(c: string) {
  return CONCEPT_LABELS[c] ?? c;
}
