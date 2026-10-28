/* eslint-disable */
// ============================================================================
// Studio worklets
//   'recorder' - captures its stereo input in chunks and posts them to the main
//                thread (used to bounce the studio master to a WAV file).
// ============================================================================

class RecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.recording = false;
    this.chunkFrames = 4096;
    this.left = new Float32Array(this.chunkFrames);
    this.right = new Float32Array(this.chunkFrames);
    this.fill = 0;
    this.port.onmessage = (e) => {
      if (e.data === 'start') { this.recording = true; this.fill = 0; }
      else if (e.data === 'stop') { this.flush(); this.recording = false; this.port.postMessage({ type: 'done' }); }
    };
  }

  flush() {
    if (this.fill === 0) return;
    const l = this.left.slice(0, this.fill);
    const r = this.right.slice(0, this.fill);
    this.port.postMessage({ type: 'chunk', l, r }, [l.buffer, r.buffer]);
    this.fill = 0;
  }

  process(inputs, outputs) {
    const input = inputs[0];
    // Pass-through so the node can sit inline if needed
    const out = outputs[0];
    if (input && input.length) {
      for (let ch = 0; ch < out.length; ch++) {
        const src = input[ch] || input[0];
        if (src) out[ch].set(src);
      }
    }
    if (!this.recording || !input || !input.length) return true;
    const l = input[0];
    const r = input[1] || input[0];
    let i = 0;
    while (i < l.length) {
      const n = Math.min(l.length - i, this.chunkFrames - this.fill);
      this.left.set(l.subarray(i, i + n), this.fill);
      this.right.set(r.subarray(i, i + n), this.fill);
      this.fill += n;
      i += n;
      if (this.fill === this.chunkFrames) this.flush();
    }
    return true;
  }
}

registerProcessor('recorder', RecorderProcessor);
