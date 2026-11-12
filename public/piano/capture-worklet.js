// Runs on the audio thread. Collects microphone samples into blocks and
// hands them to the page, stamped with the audio clock time of the first sample.
class CaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.size = 1024;
    this.buffer = new Float32Array(this.size);
    this.filled = 0;
    this.startTime = 0;
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (!channel) return true;
    let offset = 0;
    while (offset < channel.length) {
      if (this.filled === 0) this.startTime = currentTime + offset / sampleRate;
      const take = Math.min(channel.length - offset, this.size - this.filled);
      this.buffer.set(channel.subarray(offset, offset + take), this.filled);
      this.filled += take;
      offset += take;
      if (this.filled === this.size) {
        const block = this.buffer.slice(0);
        this.port.postMessage({ samples: block, time: this.startTime }, [block.buffer]);
        this.filled = 0;
      }
    }
    return true;
  }
}

registerProcessor('mc-capture', CaptureProcessor);
