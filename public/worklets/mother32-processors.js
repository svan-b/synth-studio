/* eslint-disable */
// ============================================================================
// Mother-32 AudioWorklet processors
//
//   'm32-edges' - gate / clock edge detector for the sequencer inputs
//                 (TEMPO, RUN/STOP, RESET, HOLD). Four inputs, one per jack.
//                 Posts { ch, high, time } on every rising and falling edge,
//                 sample-accurately timestamped, so patched clocks and gates
//                 (LFO SQ, GATE, ASSIGN...) drive the sequencer exactly.
//                 Thresholds: rises above 1.5 V, falls below 1 V (1.0 = 5 V).
// ============================================================================

class M32EdgeProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.high = [false, false, false, false];
  }

  process(inputs, outputs) {
    for (let ch = 0; ch < 4; ch++) {
      const inp = inputs[ch] && inputs[ch][0];
      if (!inp) {
        // Nothing connected: the input reads 0 V
        if (this.high[ch]) {
          this.high[ch] = false;
          this.port.postMessage({ ch, high: false, time: currentTime });
        }
        continue;
      }
      for (let i = 0; i < inp.length; i++) {
        const v = inp[i];
        if (!this.high[ch] && v > 0.3) {
          this.high[ch] = true;
          this.port.postMessage({ ch, high: true, time: currentTime + i / sampleRate });
        } else if (this.high[ch] && v < 0.2) {
          this.high[ch] = false;
          this.port.postMessage({ ch, high: false, time: currentTime + i / sampleRate });
        }
      }
    }
    const out = outputs[0] && outputs[0][0];
    if (out) out.fill(0);
    return true;
  }
}

registerProcessor('m32-edges', M32EdgeProcessor);
