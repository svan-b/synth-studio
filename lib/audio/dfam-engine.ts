/**
 * DFAM Audio Engine - Web Audio API Implementation
 *
 * Signal Flow Architecture (based on Moog DFAM Manual):
 *
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │                        OSCILLATORS                              │
 *   │  ┌─────────┐                              ┌─────────┐          │
 *   │  │  VCO 1  │──────┬──────────────────────▶│  MIXER  │          │
 *   │  │ TRI/SQR │      │                       │         │          │
 *   │  └────┬────┘      │ FM                    │ VCO1 LVL│          │
 *   │       │           ▼                       │ VCO2 LVL│          │
 *   │       │      ┌─────────┐                  │ NOISE   │          │
 *   │       │      │  VCO 2  │─────────────────▶│         │          │
 *   │       │      │ TRI/SQR │                  └────┬────┘          │
 *   │       │      └────┬────┘                       │               │
 *   │       │           │                            │               │
 *   │       │ HARD SYNC │                            │               │
 *   │       └───────────┘                            │               │
 *   │                                                │               │
 *   │  ┌──────────┐                                  │               │
 *   │  │  NOISE   │─────────────────────────────────▶│               │
 *   │  └──────────┘                                  ▼               │
 *   └────────────────────────────────────────────────┬───────────────┘
 *                                                    │
 *   ┌────────────────────────────────────────────────┼───────────────┐
 *   │                        FILTER                  │               │
 *   │                                                ▼               │
 *   │                                          ┌─────────┐           │
 *   │     ┌──────────┐                         │   VCF   │           │
 *   │     │ VCF EG   │────────────────────────▶│  MOOG   │           │
 *   │     │ (decay)  │     EG AMT              │ LADDER  │           │
 *   │     └──────────┘                         │ HP/LP   │           │
 *   │                                          └────┬────┘           │
 *   │     ┌──────────┐         NOISE MOD            │               │
 *   │     │  NOISE   │─────────────────────────────▶│               │
 *   │     └──────────┘                              │               │
 *   └───────────────────────────────────────────────┼───────────────┘
 *                                                   │
 *   ┌───────────────────────────────────────────────┼───────────────┐
 *   │                        AMPLIFIER              │               │
 *   │                                               ▼               │
 *   │                                          ┌─────────┐          │
 *   │     ┌──────────┐                         │   VCA   │          │
 *   │     │ VCA EG   │────────────────────────▶│         │──────▶OUT│
 *   │     │FAST/SLOW │                         │ VOLUME  │          │
 *   │     │ (decay)  │                         └─────────┘          │
 *   │     └──────────┘                                              │
 *   └───────────────────────────────────────────────────────────────┘
 *
 *   ┌───────────────────────────────────────────────────────────────┐
 *   │                        VCO ENVELOPE                           │
 *   │     ┌──────────┐                                              │
 *   │     │ VCO EG   │───────────▶ VCO 1 PITCH (via EG AMT)        │
 *   │     │ (decay)  │───────────▶ VCO 2 PITCH (via EG AMT)        │
 *   │     └──────────┘                                              │
 *   └───────────────────────────────────────────────────────────────┘
 *
 *   ┌───────────────────────────────────────────────────────────────┐
 *   │                     8-STEP SEQUENCER                          │
 *   │  ┌───┬───┬───┬───┬───┬───┬───┬───┐                           │
 *   │  │ 1 │ 2 │ 3 │ 4 │ 5 │ 6 │ 7 │ 8 │  PITCH (per step)        │
 *   │  ├───┼───┼───┼───┼───┼───┼───┼───┤                           │
 *   │  │ 1 │ 2 │ 3 │ 4 │ 5 │ 6 │ 7 │ 8 │  VELOCITY (per step)     │
 *   │  └───┴───┴───┴───┴───┴───┴───┴───┘                           │
 *   │  TEMPO ─── RUN/STOP ─── ADVANCE ─── TRIGGER                  │
 *   └───────────────────────────────────────────────────────────────┘
 */

// Type definitions for audio engine parameters
export interface DFAMParams {
  // VCO 1
  vco1_frequency: number;    // -5 to +5 octaves from center
  vco1_eg_amount: number;    // -100 to +100 %
  vco1_wave: number;         // 0 = SQR, 1 = TRI
  vco1_level: number;        // 0 to 100 %

  // VCO 2
  vco2_frequency: number;    // -5 to +5 octaves from center
  vco2_eg_amount: number;    // -100 to +100 %
  vco2_wave: number;         // 0 = SQR, 1 = TRI
  vco2_level: number;        // 0 to 100 %

  // Oscillator modulation
  fm_amount: number;         // 0 to 100 %
  hard_sync: number;         // 0 = ON, 1 = OFF

  // VCO Envelope
  vco_decay: number;         // 10 to 10000 ms
  seq_pitch_mod: number;     // 0 = VCO 1&2, 1 = OFF, 2 = VCO 2 only

  // Mixer
  noise_level: number;       // 0 to 100 %

  // VCF (Filter)
  vcf_cutoff: number;        // 20 to 20000 Hz
  vcf_resonance: number;     // 0 to 100 %
  vcf_eg_amount: number;     // -100 to +100 %
  vcf_mode: number;          // 0 = HP, 1 = LP
  vcf_decay: number;         // 10 to 10000 ms
  noise_vcf_mod: number;     // 0 to 100 %

  // VCA
  vca_decay: number;         // 10 to 10000 ms
  vca_attack_mode: number;   // 0 = FAST (1ms), 1 = SLOW (linear)
  volume: number;            // 0 to 100 %

  // Sequencer
  tempo: number;             // 10 to 10000 BPM
  pitch_1: number; pitch_2: number; pitch_3: number; pitch_4: number;
  pitch_5: number; pitch_6: number; pitch_7: number; pitch_8: number;
  velocity_1: number; velocity_2: number; velocity_3: number; velocity_4: number;
  velocity_5: number; velocity_6: number; velocity_7: number; velocity_8: number;

  // Transport (boolean-like)
  run_stop: boolean;
  trigger: boolean;
  advance: boolean;
}

// Envelope generator state
interface EnvelopeState {
  phase: 'idle' | 'attack' | 'decay';
  value: number;
  startTime: number;
}

/**
 * DFAM Audio Engine
 * Implements the complete DFAM signal flow using Web Audio API
 */
export class DFAMAudioEngine {
  private ctx: AudioContext | null = null;
  private isInitialized = false;

  // Audio nodes - organized by signal flow section
  // === OSCILLATORS ===
  private vco1: OscillatorNode | null = null;
  private vco2: OscillatorNode | null = null;
  private noiseSource: AudioBufferSourceNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  // === MIXER ===
  private vco1Gain: GainNode | null = null;
  private vco2Gain: GainNode | null = null;
  private noiseGain: GainNode | null = null;
  private mixerOutput: GainNode | null = null;

  // === FM MODULATION ===
  private fmGain: GainNode | null = null;

  // === FILTER ===
  private vcf: BiquadFilterNode | null = null;
  private vcfEnvGain: GainNode | null = null;

  // === VCA ===
  private vca: GainNode | null = null;
  private masterVolume: GainNode | null = null;

  // === ENVELOPE GENERATORS ===
  private vcoEnvelope: EnvelopeState = { phase: 'idle', value: 0, startTime: 0 };
  private vcfEnvelope: EnvelopeState = { phase: 'idle', value: 0, startTime: 0 };
  private vcaEnvelope: EnvelopeState = { phase: 'idle', value: 0, startTime: 0 };

  // === SEQUENCER STATE ===
  private sequencerStep = 0;
  private sequencerRunning = false;
  private sequencerIntervalId: ReturnType<typeof setInterval> | null = null;
  private lastTriggerTime = 0;

  // === PARAMETERS (cached for real-time updates) ===
  private params: Partial<DFAMParams> = {};

  // === CALLBACKS ===
  private onStepChange?: (step: number) => void;

  // Base frequency for VCOs (C3 = 130.81 Hz as center)
  private readonly BASE_FREQ = 130.81;

  /**
   * Initialize the audio engine
   * Must be called after user interaction (browser autoplay policy)
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.ctx = new AudioContext();
      await this.ctx.resume();

      this.createAudioGraph();
      this.createNoiseBuffer();
      this.startOscillators();

      this.isInitialized = true;
      console.log('[DFAMAudioEngine] Initialized successfully');
    } catch (error) {
      console.error('[DFAMAudioEngine] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Create the complete audio graph following DFAM signal flow
   */
  private createAudioGraph(): void {
    if (!this.ctx) return;

    // === CREATE VCO 1 ===
    this.vco1 = this.ctx.createOscillator();
    this.vco1.type = 'triangle';
    this.vco1.frequency.value = this.BASE_FREQ;

    this.vco1Gain = this.ctx.createGain();
    this.vco1Gain.gain.value = 0.75;

    // === CREATE VCO 2 ===
    this.vco2 = this.ctx.createOscillator();
    this.vco2.type = 'triangle';
    this.vco2.frequency.value = this.BASE_FREQ;

    this.vco2Gain = this.ctx.createGain();
    this.vco2Gain.gain.value = 0.5;

    // === FM MODULATION (VCO1 → VCO2) ===
    this.fmGain = this.ctx.createGain();
    this.fmGain.gain.value = 0;

    // === NOISE GENERATOR ===
    this.noiseGain = this.ctx.createGain();
    this.noiseGain.gain.value = 0;

    // === MIXER ===
    this.mixerOutput = this.ctx.createGain();
    this.mixerOutput.gain.value = 1;

    // === VCF (Moog Ladder Filter approximation) ===
    this.vcf = this.ctx.createBiquadFilter();
    this.vcf.type = 'lowpass';
    this.vcf.frequency.value = 1000;
    this.vcf.Q.value = 0;

    this.vcfEnvGain = this.ctx.createGain();
    this.vcfEnvGain.gain.value = 0;

    // === VCA ===
    this.vca = this.ctx.createGain();
    this.vca.gain.value = 0;

    // === MASTER VOLUME ===
    this.masterVolume = this.ctx.createGain();
    this.masterVolume.gain.value = 0.75;

    // === CONNECT THE SIGNAL FLOW ===

    // VCO1 → VCO1 Gain → Mixer
    this.vco1.connect(this.vco1Gain);
    this.vco1Gain.connect(this.mixerOutput);

    // VCO1 → FM Gain → VCO2 frequency (FM modulation)
    this.vco1.connect(this.fmGain);
    this.fmGain.connect(this.vco2.frequency);

    // VCO2 → VCO2 Gain → Mixer
    this.vco2.connect(this.vco2Gain);
    this.vco2Gain.connect(this.mixerOutput);

    // Noise → Noise Gain → Mixer
    this.noiseGain.connect(this.mixerOutput);

    // Mixer → VCF → VCA → Master → Output
    this.mixerOutput.connect(this.vcf);
    this.vcf.connect(this.vca);
    this.vca.connect(this.masterVolume);
    this.masterVolume.connect(this.ctx.destination);
  }

  /**
   * Create white noise buffer for noise generator
   */
  private createNoiseBuffer(): void {
    if (!this.ctx) return;

    const bufferSize = this.ctx.sampleRate * 2; // 2 seconds of noise
    this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  }

  /**
   * Start/restart noise source (needs to be recreated each time)
   */
  private startNoiseSource(): void {
    if (!this.ctx || !this.noiseBuffer || !this.noiseGain) return;

    // Stop existing noise source
    if (this.noiseSource) {
      try {
        this.noiseSource.stop();
        this.noiseSource.disconnect();
      } catch {
        // Ignore errors from already stopped source
      }
    }

    this.noiseSource = this.ctx.createBufferSource();
    this.noiseSource.buffer = this.noiseBuffer;
    this.noiseSource.loop = true;
    this.noiseSource.connect(this.noiseGain);
    this.noiseSource.start();
  }

  /**
   * Start oscillators
   */
  private startOscillators(): void {
    this.vco1?.start();
    this.vco2?.start();
    this.startNoiseSource();
  }

  /**
   * Update a single parameter
   */
  setParam(name: keyof DFAMParams, value: number | boolean): void {
    if (!this.ctx) return;

    this.params[name] = value as never;
    const now = this.ctx.currentTime;

    switch (name) {
      // === VCO 1 ===
      case 'vco1_frequency':
        this.updateVCO1Frequency();
        break;
      case 'vco1_wave':
        if (this.vco1) {
          this.vco1.type = value === 0 ? 'square' : 'triangle';
        }
        break;
      case 'vco1_level':
        this.vco1Gain?.gain.setTargetAtTime((value as number) / 100, now, 0.01);
        break;

      // === VCO 2 ===
      case 'vco2_frequency':
        this.updateVCO2Frequency();
        break;
      case 'vco2_wave':
        if (this.vco2) {
          this.vco2.type = value === 0 ? 'square' : 'triangle';
        }
        break;
      case 'vco2_level':
        this.vco2Gain?.gain.setTargetAtTime((value as number) / 100, now, 0.01);
        break;

      // === FM / MODULATION ===
      case 'fm_amount':
        // FM amount scales the modulation depth (0-100% maps to 0-500Hz depth)
        this.fmGain?.gain.setTargetAtTime((value as number) * 5, now, 0.01);
        break;

      // === NOISE / MIXER ===
      case 'noise_level':
        this.noiseGain?.gain.setTargetAtTime((value as number) / 100, now, 0.01);
        break;

      // === VCF ===
      case 'vcf_cutoff':
        this.vcf?.frequency.setTargetAtTime(value as number, now, 0.01);
        break;
      case 'vcf_resonance':
        // Q factor: 0-100% maps to 0-20 (self-oscillation around 20)
        this.vcf?.Q.setTargetAtTime((value as number) / 5, now, 0.01);
        break;
      case 'vcf_mode':
        if (this.vcf) {
          this.vcf.type = value === 0 ? 'highpass' : 'lowpass';
        }
        break;

      // === VCA ===
      case 'volume':
        this.masterVolume?.gain.setTargetAtTime((value as number) / 100, now, 0.01);
        break;

      // === SEQUENCER ===
      case 'tempo':
        this.updateSequencerTempo();
        break;
      case 'run_stop':
        if (value) {
          this.startSequencer();
        } else {
          this.stopSequencer();
        }
        break;
      case 'trigger':
        if (value) {
          this.triggerEnvelopes();
        }
        break;
      case 'advance':
        if (value) {
          this.advanceSequencer();
        }
        break;
    }
  }

  /**
   * Update VCO1 frequency based on base freq + octave offset + envelope
   */
  private updateVCO1Frequency(): void {
    if (!this.vco1 || !this.ctx) return;

    const octaveOffset = (this.params.vco1_frequency ?? 0) as number;
    const freq = this.BASE_FREQ * Math.pow(2, octaveOffset);

    this.vco1.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.01);
  }

  /**
   * Update VCO2 frequency based on base freq + octave offset + envelope
   */
  private updateVCO2Frequency(): void {
    if (!this.vco2 || !this.ctx) return;

    const octaveOffset = (this.params.vco2_frequency ?? 0) as number;
    const freq = this.BASE_FREQ * Math.pow(2, octaveOffset);

    this.vco2.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.01);
  }

  /**
   * Trigger all envelope generators (VCO, VCF, VCA)
   */
  triggerEnvelopes(): void {
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    // Prevent double-triggering
    if (now - this.lastTriggerTime < 0.01) return;
    this.lastTriggerTime = now;

    // Get envelope parameters
    const vcoDecay = ((this.params.vco_decay ?? 300) as number) / 1000;
    const vcfDecay = ((this.params.vcf_decay ?? 400) as number) / 1000;
    const vcaDecay = ((this.params.vca_decay ?? 500) as number) / 1000;
    const vcaAttackMode = (this.params.vca_attack_mode ?? 0) as number;
    const vcaAttack = vcaAttackMode === 0 ? 0.001 : 0.05; // FAST = 1ms, SLOW = 50ms

    // Get modulation amounts
    const vco1EgAmount = ((this.params.vco1_eg_amount ?? 0) as number) / 100;
    const vco2EgAmount = ((this.params.vco2_eg_amount ?? 0) as number) / 100;
    const vcfEgAmount = ((this.params.vcf_eg_amount ?? 0) as number) / 100;

    // Get velocity for current step (affects envelope strength)
    const stepVelocities = [
      this.params.velocity_1 ?? 100,
      this.params.velocity_2 ?? 100,
      this.params.velocity_3 ?? 100,
      this.params.velocity_4 ?? 100,
      this.params.velocity_5 ?? 100,
      this.params.velocity_6 ?? 100,
      this.params.velocity_7 ?? 100,
      this.params.velocity_8 ?? 100,
    ];
    const velocity = (stepVelocities[this.sequencerStep] as number) / 100;

    // === VCO ENVELOPE → PITCH MODULATION ===
    if (this.vco1 && vco1EgAmount !== 0) {
      const baseFreq1 = this.BASE_FREQ * Math.pow(2, (this.params.vco1_frequency ?? 0) as number);
      const maxPitchMod = baseFreq1 * 2 * Math.abs(vco1EgAmount); // Up to 2 octaves
      const direction = vco1EgAmount > 0 ? 1 : -1;

      this.vco1.frequency.cancelScheduledValues(now);
      this.vco1.frequency.setValueAtTime(baseFreq1 + maxPitchMod * direction * velocity, now);
      this.vco1.frequency.exponentialRampToValueAtTime(baseFreq1, now + vcoDecay);
    }

    if (this.vco2 && vco2EgAmount !== 0) {
      const baseFreq2 = this.BASE_FREQ * Math.pow(2, (this.params.vco2_frequency ?? 0) as number);
      const maxPitchMod = baseFreq2 * 2 * Math.abs(vco2EgAmount);
      const direction = vco2EgAmount > 0 ? 1 : -1;

      this.vco2.frequency.cancelScheduledValues(now);
      this.vco2.frequency.setValueAtTime(baseFreq2 + maxPitchMod * direction * velocity, now);
      this.vco2.frequency.exponentialRampToValueAtTime(baseFreq2, now + vcoDecay);
    }

    // === VCF ENVELOPE → CUTOFF MODULATION ===
    if (this.vcf && vcfEgAmount !== 0) {
      const baseCutoff = (this.params.vcf_cutoff ?? 1000) as number;
      const maxCutoffMod = Math.min(baseCutoff * 4, 20000 - baseCutoff) * vcfEgAmount;

      this.vcf.frequency.cancelScheduledValues(now);
      this.vcf.frequency.setValueAtTime(
        Math.max(20, Math.min(20000, baseCutoff + maxCutoffMod * velocity)),
        now
      );
      this.vcf.frequency.exponentialRampToValueAtTime(
        Math.max(20, baseCutoff),
        now + vcfDecay
      );
    }

    // === VCA ENVELOPE → AMPLITUDE ===
    if (this.vca) {
      this.vca.gain.cancelScheduledValues(now);
      this.vca.gain.setValueAtTime(0, now);
      // Attack
      this.vca.gain.linearRampToValueAtTime(velocity, now + vcaAttack);
      // Decay
      this.vca.gain.exponentialRampToValueAtTime(0.001, now + vcaAttack + vcaDecay);
      this.vca.gain.setValueAtTime(0, now + vcaAttack + vcaDecay + 0.01);
    }
  }

  /**
   * Start the sequencer
   */
  startSequencer(): void {
    if (this.sequencerRunning) return;

    this.sequencerRunning = true;
    this.updateSequencerTempo();
  }

  /**
   * Stop the sequencer
   */
  stopSequencer(): void {
    this.sequencerRunning = false;
    if (this.sequencerIntervalId) {
      clearInterval(this.sequencerIntervalId);
      this.sequencerIntervalId = null;
    }
  }

  /**
   * Advance sequencer to next step
   */
  advanceSequencer(): void {
    this.sequencerStep = (this.sequencerStep + 1) % 8;
    this.applySequencerStep();
    this.onStepChange?.(this.sequencerStep);
  }

  /**
   * Apply current sequencer step (pitch CV + trigger)
   */
  private applySequencerStep(): void {
    // Get pitch for current step
    const stepPitches = [
      this.params.pitch_1 ?? 0,
      this.params.pitch_2 ?? 0,
      this.params.pitch_3 ?? 0,
      this.params.pitch_4 ?? 0,
      this.params.pitch_5 ?? 0,
      this.params.pitch_6 ?? 0,
      this.params.pitch_7 ?? 0,
      this.params.pitch_8 ?? 0,
    ];

    const seqPitchMod = (this.params.seq_pitch_mod ?? 0) as number;
    const pitchCV = stepPitches[this.sequencerStep] as number;

    // Apply pitch CV based on SEQ PITCH MOD setting
    // 0 = VCO 1&2, 1 = OFF, 2 = VCO 2 only
    if (seqPitchMod !== 1 && this.vco1 && this.ctx) {
      const baseFreq1 = this.BASE_FREQ * Math.pow(2, (this.params.vco1_frequency ?? 0) as number);
      const seqFreq1 = baseFreq1 * Math.pow(2, pitchCV);
      this.vco1.frequency.setTargetAtTime(seqFreq1, this.ctx.currentTime, 0.001);
    }

    if ((seqPitchMod === 0 || seqPitchMod === 2) && this.vco2 && this.ctx) {
      const baseFreq2 = this.BASE_FREQ * Math.pow(2, (this.params.vco2_frequency ?? 0) as number);
      const seqFreq2 = baseFreq2 * Math.pow(2, pitchCV);
      this.vco2.frequency.setTargetAtTime(seqFreq2, this.ctx.currentTime, 0.001);
    }

    // Trigger envelopes
    this.triggerEnvelopes();
  }

  /**
   * Update sequencer tempo
   */
  private updateSequencerTempo(): void {
    if (!this.sequencerRunning) return;

    // Clear existing interval
    if (this.sequencerIntervalId) {
      clearInterval(this.sequencerIntervalId);
    }

    const tempo = (this.params.tempo ?? 120) as number;
    const intervalMs = 60000 / tempo; // Convert BPM to ms per beat

    this.sequencerIntervalId = setInterval(() => {
      this.advanceSequencer();
    }, intervalMs);
  }

  /**
   * Set callback for step changes
   */
  setOnStepChange(callback: (step: number) => void): void {
    this.onStepChange = callback;
  }

  /**
   * Get current sequencer step
   */
  getCurrentStep(): number {
    return this.sequencerStep;
  }

  /**
   * Check if engine is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Suspend audio context (save CPU when not in use)
   */
  suspend(): void {
    this.ctx?.suspend();
  }

  /**
   * Resume audio context
   */
  resume(): void {
    this.ctx?.resume();
  }

  /**
   * Clean up and dispose of audio resources
   */
  dispose(): void {
    this.stopSequencer();

    this.vco1?.stop();
    this.vco2?.stop();
    this.noiseSource?.stop();

    this.ctx?.close();

    this.isInitialized = false;
    console.log('[DFAMAudioEngine] Disposed');
  }
}

// Singleton instance
let engineInstance: DFAMAudioEngine | null = null;

/**
 * Get the DFAM audio engine singleton
 */
export function getDFAMEngine(): DFAMAudioEngine {
  if (!engineInstance) {
    engineInstance = new DFAMAudioEngine();
  }
  return engineInstance;
}

/**
 * Dispose of the engine singleton
 */
export function disposeDFAMEngine(): void {
  if (engineInstance) {
    engineInstance.dispose();
    engineInstance = null;
  }
}
