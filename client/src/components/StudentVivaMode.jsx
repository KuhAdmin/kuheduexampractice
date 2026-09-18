import { useEffect, useRef, useState } from "react";
import { getVivaFeedback, getVivaQuestions } from "../api/client";
import { applyPreferredVoice } from "../utils/speechVoice";
import { useBreakpoint } from "../hooks/useBreakpoint";
import { RobotAvatar } from "./RobotAvatar";

// Fixed reply window per question -- no overall viva time limit.
const REPLY_WINDOW_SECONDS = 12;

const emptyState = () => ({
  stage: "idle", // idle | loading-questions | questions-error | running | listening | no-reply | grading | feedback | complete
  totalQuestions: 0,
  questionIndex: -1,
  currentQuestion: "",
  countdown: null,
  transcript: "",
  feedback: "",
  results: [],
  error: "",
});

const getSpeechRecognitionCtor = () =>
  (typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition)) || null;

const MicIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="9" y="2" width="6" height="12" rx="3" fill="currentColor" />
    <path
      d="M5 11a7 7 0 0 0 14 0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <path d="M12 18v3M9 21h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

// Bottom-most section on the concept Explore tab, beneath Einstein Mode: a
// spoken 5-question viva scoped strictly to this concept, with questions
// generated fresh every run (see vivaService.js -- never the same set
// twice). Speaks each question via TTS, listens for a spoken reply (Web
// Speech API) for a window with a visible countdown -- voice-only by design
// (no typed fallback), since this is meant to be a spoken exam. Note: iOS
// Safari has never implemented SpeechRecognition at all, so on iOS a
// question simply always times out as "no reply" -- there is currently no
// way to answer Viva questions on iOS.
// A reply within the window gets spoken feedback before moving on; no reply
// just advances to the next question.
export const StudentVivaMode = ({ assessmentUnitId }) => {
  const [state, setState] = useState(emptyState);
  // Desktop/tablet only -- the report card's per-question list is long
  // enough that showing it inline once complete made this card grow far
  // taller than its sibling in the Smart Tutor 2x2 grid, distorting that
  // layout. On mobile (single-column, no grid to distort) it still renders
  // inline as before. Reset on every fresh run so it doesn't stay dismissed
  // across attempts.
  const isDesktop = useBreakpoint() !== "mobile";
  const [reportCardDismissed, setReportCardDismissed] = useState(false);
  // True for the exact duration of ANY narration -- the intro line, every
  // question, the "didn't hear a reply" message, and the AI feedback --
  // never just however long a given stage happens to be on screen (e.g. the
  // grading-failed fallback sets stage "feedback" but never actually
  // speaks). Drives the avatar's visible "speaking" state everywhere in this
  // component: see the "Avatar behavior" note in CLAUDE.md -- the avatar
  // must be visible for every moment speech is actually playing, not just
  // some of them.
  const [isNarrating, setIsNarrating] = useState(false);

  const set = (patch) => setState((current) => ({ ...current, ...patch }));

  const cancelledRef = useRef(false);
  const recognitionRef = useRef(null);
  const countdownIntervalRef = useRef(null);

  useEffect(
    () => () => {
      cancelledRef.current = true;
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          /* already stopped */
        }
      }
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    },
    []
  );

  // iOS Safari (particularly an installed/standalone PWA) can leave
  // speechSynthesis.speak() either throwing synchronously or never firing
  // onend/onerror at all -- most often right after the questions-generation
  // network call above, which the same way as getUserMedia elsewhere in this
  // app (see voiceClient.js) can silently expire iOS's "this came from a user
  // gesture" grace period speech APIs rely on. Since runViva's stage only
  // advances to "listening" (showing the countdown) after this resolves, an
  // unguarded hang/throw here means the whole flow freezes before the
  // student ever gets a chance to answer. The timeout and try/catch below
  // guarantee this always settles, with or without narration.
  //
  // The timeout itself is sized to the text being spoken rather than a fixed
  // duration -- a flat cap (previously 8s) cut AI feedback off mid-sentence
  // whenever it ran longer than that, since genuinely-in-progress narration
  // looks identical to a hung engine from here. ~2.2 words/sec is a
  // deliberately slow, generous spoken pace so real speech is never mistaken
  // for a stall, plus a flat buffer for pauses/punctuation.
  const estimateSpeechTimeoutMs = (text) => {
    const wordCount = (text || "").trim().split(/\s+/).filter(Boolean).length;
    return Math.max(6000, Math.round((wordCount / 2.2) * 1000) + 4000);
  };

  const speak = (text) =>
    new Promise((resolve) => {
      if (cancelledRef.current || typeof window === "undefined" || !window.speechSynthesis || !text) {
        resolve();
        return;
      }
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        resolve();
      };
      const timeoutId = setTimeout(finish, estimateSpeechTimeoutMs(text));
      try {
        const utterance = applyPreferredVoice(new SpeechSynthesisUtterance(text));
        utterance.onend = finish;
        utterance.onerror = finish;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      } catch {
        finish();
      }
    });

  // Every narration in this component goes through here instead of calling
  // speak() directly, so isNarrating (and therefore the visible avatar) is
  // never accidentally left out for a particular line -- see CLAUDE.md's
  // avatar-behavior note this enforces.
  const speakWithAvatar = async (text) => {
    setIsNarrating(true);
    await speak(text);
    setIsNarrating(false);
  };

  const stopListening = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        /* already stopped */
      }
      recognitionRef.current = null;
    }
  };

  const listenForReply = (timeoutSeconds) =>
    new Promise((resolve) => {
      let settled = false;
      let secondsLeft = timeoutSeconds;
      let permissionDenied = false;
      // Every finalized phrase gets appended here rather than finishing on
      // the FIRST one -- the recognizer often finalizes a short phrase (a
      // clause, or even just the first few words) well before the student
      // is actually done answering, and finish()ing right there is what
      // looked like the mic cutting off mid-reply. The only things that end
      // listening now are the countdown reaching zero or a real
      // permission error -- never a recognized phrase or the browser's own
      // internal session timeout (Chrome and others auto-end a recognition
      // session after a few seconds of silence; onend below restarts a
      // fresh one, carrying accumulatedTranscript forward, as long as time
      // and permission both remain).
      let accumulatedTranscript = "";

      const finish = (value) => {
        if (settled) return;
        settled = true;
        stopListening();
        resolve(value);
      };

      const SpeechRecognitionCtor = getSpeechRecognitionCtor();

      const startRecognitionSession = () => {
        if (settled || secondsLeft <= 0 || permissionDenied) return;
        const recognition = new SpeechRecognitionCtor();
        recognition.lang = "en-IN";
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        recognition.onresult = (event) => {
          for (let i = event.resultIndex; i < event.results.length; i += 1) {
            const result = event.results[i];
            if (result.isFinal) {
              const text = (result[0]?.transcript || "").trim();
              if (text) accumulatedTranscript = `${accumulatedTranscript} ${text}`.trim();
            }
          }
        };
        recognition.onerror = (event) => {
          if (event?.error === "not-allowed" || event?.error === "service-not-allowed") {
            permissionDenied = true;
          }
          // Anything else (e.g. "no-speech") just ends this one internal
          // session -- onend below decides whether to restart.
        };
        recognition.onend = startRecognitionSession;
        recognitionRef.current = recognition;
        try {
          recognition.start();
        } catch {
          /* mic busy/denied */
        }
      };

      if (SpeechRecognitionCtor) startRecognitionSession();

      set({ countdown: secondsLeft });
      countdownIntervalRef.current = setInterval(() => {
        secondsLeft -= 1;
        set({ countdown: secondsLeft });
        if (secondsLeft <= 0) finish(accumulatedTranscript.trim());
      }, 1000);
    });

  const runViva = async () => {
    cancelledRef.current = false;
    setReportCardDismissed(false);
    setIsNarrating(false);
    set({ ...emptyState(), stage: "loading-questions" });

    let questions;
    try {
      const result = await getVivaQuestions(assessmentUnitId);
      questions = result.questions || [];
      if (questions.length === 0) throw new Error("No questions were generated.");
    } catch (error) {
      set({ stage: "questions-error", error: error.message || "Failed to prepare viva questions." });
      return;
    }
    if (cancelledRef.current) return;

    // questionIndex stays at emptyState's -1 for this intro line -- the
    // avatar is shown for it the same as any other narration (see the
    // questionIndex >= 0 check around the render below), just without a
    // "Question N of 5" heading yet.
    set({ stage: "running", totalQuestions: questions.length });
    await speakWithAvatar(
      `Hello, I am going to ask you ${questions.length} questions. You'll have ${REPLY_WINDOW_SECONDS} seconds to answer each one. Think carefully and reply.`
    );
    if (cancelledRef.current) return;

    const results = [];
    for (let i = 0; i < questions.length; i += 1) {
      if (cancelledRef.current) return;
      const question = questions[i];
      set({
        stage: "running",
        questionIndex: i,
        currentQuestion: question,
        transcript: "",
        feedback: "",
        countdown: null,
      });

      await speakWithAvatar(question);
      if (cancelledRef.current) return;

      set({ stage: "listening" });
      const reply = await listenForReply(REPLY_WINDOW_SECONDS);
      if (cancelledRef.current) return;

      const isLastQuestion = i === questions.length - 1;

      if (!reply) {
        set({ stage: "no-reply" });
        await speakWithAvatar(
          isLastQuestion ? "Didn't hear any reply." : "Didn't hear any reply, so moving to the next question."
        );
        results.push({ question, answer: "", feedback: "" });
        continue;
      }

      set({ stage: "grading", transcript: reply });
      try {
        const feedbackResult = await getVivaFeedback(assessmentUnitId, { question, answerText: reply });
        if (cancelledRef.current) return;
        set({ stage: "feedback", feedback: feedbackResult.feedback });
        await speakWithAvatar(feedbackResult.feedback);
        results.push({ question, answer: reply, feedback: feedbackResult.feedback });
      } catch (error) {
        const fallbackFeedback = error.message || "Sorry, I couldn't grade that answer.";
        set({ stage: "feedback", feedback: fallbackFeedback });
        results.push({ question, answer: reply, feedback: "" });
      }
      if (cancelledRef.current) return;
    }

    set({ stage: "complete", results });
    await speakWithAvatar("Viva complete! Here's your report card.");
  };

  const showQuestionPanel = ["running", "listening", "no-reply", "grading", "feedback"].includes(state.stage);

  // Shown specifically while the student is speaking (the "listening" reply
  // window) -- the robot avatar is used for feedback narration instead (see
  // the "feedback" stage below), but this stays a plain mic + ripple so
  // capturing a spoken reply reads unambiguously as "recording," not as the
  // avatar listening/reacting.
  const renderMicRipple = () => (
    <div className="student-viva-mic-indicator" aria-hidden="true">
      <span className="student-viva-mic-ripple" />
      <span className="student-viva-mic-ripple" />
      <span className="student-viva-mic-ripple" />
      <span className="student-viva-mic-icon">
        <MicIcon />
      </span>
    </div>
  );

  // The avatar's shared "speaking" presentation -- ripple rings around it,
  // same visual language as renderMicRipple -- used for every narration
  // moment (intro, each question, "no reply" message, feedback). See
  // CLAUDE.md's avatar-behavior note: the avatar must be visible for every
  // moment speech is actually playing.
  const renderSpeakingAvatar = () => (
    <div className="student-viva-avatar-ripple-wrap" aria-hidden="true">
      <span className="student-viva-avatar-ripple" />
      <span className="student-viva-avatar-ripple" />
      <span className="student-viva-avatar-ripple" />
      <RobotAvatar isSpeaking size={72} />
    </div>
  );

  const renderReportCard = ({ showNotNow = false } = {}) => (
    <>
      <h3>Viva Complete! Here's your report card.</h3>
      <ul className="student-viva-summary">
        {state.results.map((result, index) => (
          <li key={index}>
            <strong>Q{index + 1}:</strong> {result.question}
            {result.answer ? (
              <>
                <br />
                <em>You said:</em> {result.answer}
                {result.feedback && (
                  <>
                    <br />
                    <em>Feedback:</em> <em className="student-viva-feedback-text">{result.feedback}</em>
                  </>
                )}
              </>
            ) : (
              <>
                <br />
                <em>No reply given.</em>
              </>
            )}
          </li>
        ))}
      </ul>
      <div className="admin-ai-demo-actions student-viva-report-actions">
        <button type="button" className="primary-button" onClick={runViva}>
          Take Questions Again
        </button>
        {showNotNow && (
          <button type="button" className="ghost-button" onClick={() => setReportCardDismissed(true)}>
            Not Now
          </button>
        )}
      </div>
    </>
  );

  return (
    <section className="student-viva-mode" aria-label="Viva">
      <header className="student-ai-tutor-header">
        <h2>Viva</h2>
        <p>A quick spoken Q&amp;A on this micro learning unit -- 5 questions, answer out loud when asked.</p>
      </header>

      {state.stage === "idle" && (
        <button type="button" className="student-viva-mode-cta" onClick={runViva}>
          Take Questions
        </button>
      )}

      {state.stage === "loading-questions" && (
        <p className="admin-workbench-muted">Preparing your questions...</p>
      )}

      {state.stage === "questions-error" && (
        <div className="admin-ai-demo-panel">
          <p className="error-text">{state.error}</p>
          <div className="admin-ai-demo-actions">
            <button type="button" className="primary-button" onClick={runViva}>
              Retry
            </button>
          </div>
        </div>
      )}

      {showQuestionPanel && (
        <div className="admin-ai-demo-panel">
          {state.questionIndex >= 0 ? (
            <>
              <p className="student-viva-progress">
                Question {state.questionIndex + 1} of {state.totalQuestions}
              </p>
              <p className="student-viva-question">{state.currentQuestion}</p>
            </>
          ) : (
            <p className="student-viva-progress">Get ready...</p>
          )}

          {/* Covers the intro line, every question being read, and the
              "no reply" message -- the avatar is visible for every moment
              of narration, not just feedback (see CLAUDE.md). */}
          {isNarrating && (state.stage === "running" || state.stage === "no-reply") && renderSpeakingAvatar()}

          {state.stage === "listening" && (
            <div className="student-viva-listening">
              <div className="student-viva-listening-indicators">
                {renderMicRipple()}
                <span className="student-viva-countdown">{state.countdown}</span>
              </div>
              <p className="admin-workbench-muted">Listening for your answer...</p>
            </div>
          )}

          {state.stage === "no-reply" && (
            <p className="admin-workbench-muted">
              {state.questionIndex + 1 === state.totalQuestions
                ? "Didn't hear any reply."
                : "Didn't hear any reply -- moving to the next question..."}
            </p>
          )}

          {(state.stage === "grading" || state.stage === "feedback") && (
            <p className="student-viva-transcript">
              <strong>You said:</strong> {state.transcript}
            </p>
          )}

          {state.stage === "grading" && (
            <div className="student-viva-grading">
              <RobotAvatar isThinking size={72} />
              <p className="admin-workbench-muted">Getting feedback...</p>
            </div>
          )}

          {state.stage === "feedback" && (
            <div className="admin-ai-demo-feedback-block student-viva-feedback-block">
              {isNarrating && renderSpeakingAvatar()}
              <strong>Feedback</strong>
              <p>{state.feedback}</p>
            </div>
          )}
        </div>
      )}

      {state.stage === "complete" && !isDesktop && (
        <div className="admin-ai-demo-panel">{renderReportCard()}</div>
      )}

      {state.stage === "complete" && isDesktop && reportCardDismissed && (
        <div className="admin-ai-demo-panel">
          <p className="admin-workbench-muted">Viva complete.</p>
          <div className="admin-ai-demo-actions">
            <button type="button" className="ghost-button" onClick={() => setReportCardDismissed(false)}>
              View Report Card
            </button>
            <button type="button" className="primary-button" onClick={runViva}>
              Take Questions Again
            </button>
          </div>
        </div>
      )}

      {state.stage === "complete" && isDesktop && !reportCardDismissed && (
        <div className="modal-backdrop" onClick={() => setReportCardDismissed(true)}>
          <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="close-button"
              aria-label="Close"
              onClick={() => setReportCardDismissed(true)}
            >
              &times;
            </button>
            {renderReportCard({ showNotNow: true })}
          </div>
        </div>
      )}
    </section>
  );
};
