// Runs on the audio rendering thread (not the main thread). The recording
// AudioContext that loads this is created at sampleRate 16000 directly (see
// src/lib/voiceClient.js), so the browser's own audio pipeline handles
// resampling from the mic's native rate down to 16kHz -- this worklet only
// has to convert the resulting Float32 samples to the Int16 PCM Gemini Live
// expects, and hand each 128-sample block back to the main thread to batch
// and send.
class PCMRecorderProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const channelData = inputs[0]?.[0];
    if (channelData && channelData.length > 0) {
      const pcm16 = new Int16Array(channelData.length);
      for (let i = 0; i < channelData.length; i++) {
        const sample = Math.max(-1, Math.min(1, channelData[i]));
        pcm16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      }
      this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
    }
    return true;
  }
}

registerProcessor("pcm-recorder", PCMRecorderProcessor);
