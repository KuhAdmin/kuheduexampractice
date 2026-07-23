// Browser-only client for a Gemini Live voice session. Connects DIRECTLY to
// Gemini's constrained WebSocket endpoint using a short-lived, server-minted,
// LOCKED ephemeral token (see server/src/services/geminiLiveTokenService.js)
// -- this file never sees GEMINIAPI_KEY, only ever the token that endpoint
// hands back, and the token's own locked config means nothing sent from here
// (including the setup frame below) can change the model/persona/tools the
// session runs.

import { getConceptTutorVoiceToken } from "../api/client";

const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;
const SEND_INTERVAL_MS = 150; // batches ~19 worklet callbacks (128 samples each) per send

function base64ToInt16Array(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Int16Array(bytes.buffer);
}

function int16ArrayToBase64(pcm) {
  const bytes = new Uint8Array(pcm.buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export class VoiceSession {
  // `avatar`, if provided, is {sendAudioChunk(pcm, end), interrupt()} --
  // lets a session hand its output audio to the shared AI-tutor avatar (see
  // components/AiTutorAvatarProvider.jsx) instead of playing it locally.
  // Undefined (avatar off/not ready) falls back to this class's own local
  // AudioContext playback below.
  constructor(callbacks, avatar) {
    this.callbacks = callbacks;
    this.avatar = avatar;
    this.ws = null;
    this.recordingContext = null;
    this.micStream = null;
    this.recorderNode = null;
    this.pendingChunks = [];
    this.sendTimer = null;
    this.playbackContext = null;
    this.nextPlaybackTime = 0;
    this.closed = false;
  }

  async start({ assessmentUnitId, mode }) {
    this.callbacks.onStatusChange("connecting");
    try {
      const { token } = await getConceptTutorVoiceToken(assessmentUnitId, mode);

      await this.connectSocket(token);
      await this.startMic();
      this.callbacks.onStatusChange("listening");
    } catch (err) {
      this.callbacks.onError(err instanceof Error ? err.message : "Could not start the voice session.");
      this.callbacks.onStatusChange("error");
      this.stop();
    }
  }

  connectSocket(token) {
    return new Promise((resolve, reject) => {
      const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(token)}`;
      const ws = new WebSocket(url);
      this.ws = ws;

      ws.onopen = () => {
        // A setup frame is still required as the first message, but it must
        // be sent EMPTY: the token's liveConnectConstraints already lock the
        // model/systemInstruction/responseModalities/tools server-side, and
        // re-specifying `model` here throws a "not found for API version
        // v1main" error rather than being merely ignored -- the constrained
        // endpoint expects the client to add nothing on top of what the
        // token already locked in.
        ws.send(JSON.stringify({ setup: {} }));
        resolve();
      };
      ws.onerror = () => reject(new Error("Could not connect to the voice service."));
      ws.onclose = () => {
        if (!this.closed) this.callbacks.onStatusChange("closed");
      };
      ws.onmessage = (event) => {
        void this.handleServerMessage(event);
      };
    });
  }

  async handleServerMessage(event) {
    const text = event.data instanceof Blob ? await event.data.text() : event.data;
    let message;
    try {
      message = JSON.parse(text);
    } catch {
      return;
    }

    const serverContent = message.serverContent;
    if (!serverContent) return;

    if (serverContent.interrupted) {
      if (this.avatar) this.avatar.interrupt();
      else this.flushPlayback();
      this.callbacks.onStatusChange("listening");
    }

    // Gemini emits PCM16 mono at a fixed 24kHz here. With an avatar bound,
    // each chunk is handed straight to it, which does its own audio playback
    // in sync with the rendered face -- this session never plays audio
    // locally in that case.
    const audioChunks = (serverContent.modelTurn?.parts ?? [])
      .map((part) => part.inlineData?.data)
      .filter((data) => Boolean(data));

    audioChunks.forEach((base64, index) => {
      this.callbacks.onStatusChange("speaking");
      if (this.avatar) {
        const isLastChunk = index === audioChunks.length - 1;
        this.sendToAvatar(base64, isLastChunk && Boolean(serverContent.turnComplete));
      } else {
        this.playChunk(base64);
      }
    });

    if (serverContent.turnComplete) {
      if (this.avatar && audioChunks.length === 0) this.sendToAvatar(null, true);
      this.callbacks.onStatusChange("listening");
    }
  }

  sendToAvatar(base64, end) {
    const buffer = base64 ? base64ToInt16Array(base64).buffer : new ArrayBuffer(0);
    this.avatar?.sendAudioChunk(buffer, end);
  }

  playChunk(base64) {
    if (!this.playbackContext) {
      this.playbackContext = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
      this.nextPlaybackTime = this.playbackContext.currentTime;
    }
    const context = this.playbackContext;
    const pcm16 = base64ToInt16Array(base64);
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 0x8000;

    const buffer = context.createBuffer(1, float32.length, OUTPUT_SAMPLE_RATE);
    buffer.copyToChannel(float32, 0);

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);

    const startAt = Math.max(this.nextPlaybackTime, context.currentTime);
    source.start(startAt);
    this.nextPlaybackTime = startAt + buffer.duration;
  }

  // The simplest reliable way to stop every scheduled-but-not-yet-played
  // chunk at once (the student interrupted, or the session is ending) --
  // close the whole playback context and let the next chunk lazily open a
  // fresh one.
  flushPlayback() {
    if (this.playbackContext) {
      void this.playbackContext.close();
      this.playbackContext = null;
      this.nextPlaybackTime = 0;
    }
  }

  async startMic() {
    this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const context = new AudioContext({ sampleRate: INPUT_SAMPLE_RATE });
    this.recordingContext = context;
    await context.audioWorklet.addModule("/audio/pcm-recorder-worklet.js");

    const source = context.createMediaStreamSource(this.micStream);
    const recorder = new AudioWorkletNode(context, "pcm-recorder");
    this.recorderNode = recorder;

    recorder.port.onmessage = (event) => {
      this.pendingChunks.push(new Int16Array(event.data));
    };
    source.connect(recorder);
    // Deliberately not connected to context.destination -- never play the
    // student's own mic back to them.

    this.sendTimer = setInterval(() => this.flushMicChunks(), SEND_INTERVAL_MS);
  }

  flushMicChunks() {
    if (this.pendingChunks.length === 0 || this.ws?.readyState !== WebSocket.OPEN) return;
    const totalLength = this.pendingChunks.reduce((sum, c) => sum + c.length, 0);
    const merged = new Int16Array(totalLength);
    let offset = 0;
    for (const chunk of this.pendingChunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    this.pendingChunks = [];
    this.ws.send(
      JSON.stringify({
        realtimeInput: { audio: { data: int16ArrayToBase64(merged), mimeType: `audio/pcm;rate=${INPUT_SAMPLE_RATE}` } },
      }),
    );
  }

  stop() {
    this.closed = true;
    if (this.sendTimer) clearInterval(this.sendTimer);
    this.sendTimer = null;
    this.pendingChunks = [];
    this.ws?.close();
    this.ws = null;
    this.recorderNode?.port.close();
    this.recorderNode?.disconnect();
    this.recorderNode = null;
    this.micStream?.getTracks().forEach((track) => track.stop());
    this.micStream = null;
    void this.recordingContext?.close();
    this.recordingContext = null;
    this.flushPlayback();
  }
}
