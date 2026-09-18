// Shared by every SpeechSynthesisUtterance caller in the app (StudentVivaMode,
// StudentOpenResponsePanel, StudentMicroActivityPanel, StudentMediaViewer,
// StudentDetailCard) -- picks a US-English voice when the browser/OS's
// installed voice list has one, rather than leaving it to whatever default
// voice the platform happens to pick. Gender is not a factor -- either a US
// male or US female voice scores the same. Falls back gracefully (any
// English voice, then the platform default) since not every browser/OS ships
// an en-US voice under that exact tag.
const scoreVoice = (voice) => {
  const lang = (voice.lang || "").toLowerCase();

  if (!lang.startsWith("en")) {
    return -1; // never pick a non-English voice for English feedback text
  }

  return lang === "en-us" ? 2 : 1;
};

// getVoices() can return an empty list on first call in some browsers until
// the async "voiceschanged" event fires -- kick that off at module load so
// the list is warm well before any "read aloud" button (always a deliberate
// user click, never on mount) is actually pressed.
if (typeof window !== "undefined" && window.speechSynthesis) {
  window.speechSynthesis.getVoices();
}

let cachedVoice;
let cachedVoiceCount = -1;

export const getPreferredVoice = () => {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return undefined;
  }

  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) {
    return undefined;
  }

  // Cheap re-run guard -- avoids rescoring on every single speak() call, but
  // still picks up a voice pack installed mid-session (list length changes).
  if (cachedVoiceCount === voices.length) {
    return cachedVoice;
  }

  let best;
  let bestScore = -1;
  for (const voice of voices) {
    const score = scoreVoice(voice);
    if (score > bestScore) {
      bestScore = score;
      best = voice;
    }
  }

  cachedVoice = bestScore >= 0 ? best : undefined;
  cachedVoiceCount = voices.length;
  return cachedVoice;
};

// Mutates and returns the utterance for convenient chaining at the call site.
export const applyPreferredVoice = (utterance) => {
  const voice = getPreferredVoice();
  if (voice) {
    utterance.voice = voice;
  }
  return utterance;
};
