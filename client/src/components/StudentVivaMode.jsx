import { useEffect, useRef, useState } from "react";
import { getVivaFeedback, getVivaQuestions } from "../api/client";

const REPLY_WINDOW_SECONDS = 6;

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

// Bottom-most section on the concept Explore tab, beneath Einstein Mode: a
// spoken 5-question viva scoped strictly to this concept, with questions
// generated fresh every run (see vivaService.js -- never the same set
// twice). Speaks each question via TTS, listens for a spoken reply (Web
// Speech API) for a fixed window with a visible countdown -- a typed
// fallback is always available too, for unsupported browsers or a denied
// mic. A reply within the window gets spoken feedback before moving on; no
// reply just advances to the next question.
export const StudentVivaMode = ({ assessmentUnitId }) => {
  const [state, setState] = useState(emptyState);
  const [manualAnswer, setManualAnswer] = useState("");

  const set = (patch) => setState((current) => ({ ...current, ...patch }));

  const cancelledRef = useRef(false);
  const recognitionRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const listenResolverRef = useRef(null);

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

  const speak = (text) =>
    new Promise((resolve) => {
      if (cancelledRef.current || typeof window === "undefined" || !window.speechSynthesis || !text) {
        resolve();
        return;
      }
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = resolve;
      utterance.onerror = resolve;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    });

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
      const finish = (value) => {
        if (settled) return;
        settled = true;
        stopListening();
        listenResolverRef.current = null;
        resolve(value);
      };
      listenResolverRef.current = finish;

      const SpeechRecognitionCtor = getSpeechRecognitionCtor();
      if (SpeechRecognitionCtor) {
        const recognition = new SpeechRecognitionCtor();
        recognition.lang = "en-IN";
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        recognition.onresult = (event) => finish((event.results?.[0]?.[0]?.transcript || "").trim());
        recognition.onerror = () => finish("");
        recognition.onend = () => finish("");
        recognitionRef.current = recognition;
        try {
          recognition.start();
        } catch {
          /* mic busy/denied -- the typed fallback below still works */
        }
      }

      let secondsLeft = timeoutSeconds;
      set({ countdown: secondsLeft });
      countdownIntervalRef.current = setInterval(() => {
        secondsLeft -= 1;
        set({ countdown: secondsLeft });
        if (secondsLeft <= 0) finish("");
      }, 1000);
    });

  const handleManualSubmit = (event) => {
    event.preventDefault();
    const value = manualAnswer.trim();
    if (!value || !listenResolverRef.current) return;
    setManualAnswer("");
    listenResolverRef.current(value);
  };

  const runViva = async () => {
    cancelledRef.current = false;
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

    set({ stage: "running", totalQuestions: questions.length });
    await speak(
      `Hello, I am going to ask you ${questions.length} questions in ${
        questions.length * REPLY_WINDOW_SECONDS
      } seconds. Think carefully and reply.`
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

      await speak(question);
      if (cancelledRef.current) return;

      set({ stage: "listening" });
      setManualAnswer("");
      const reply = await listenForReply(REPLY_WINDOW_SECONDS);
      if (cancelledRef.current) return;

      const isLastQuestion = i === questions.length - 1;

      if (!reply) {
        set({ stage: "no-reply" });
        await speak(
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
        await speak(feedbackResult.feedback);
        results.push({ question, answer: reply, feedback: feedbackResult.feedback });
      } catch (error) {
        const fallbackFeedback = error.message || "Sorry, I couldn't grade that answer.";
        set({ stage: "feedback", feedback: fallbackFeedback });
        results.push({ question, answer: reply, feedback: "" });
      }
      if (cancelledRef.current) return;
    }

    set({ stage: "complete", results });
    await speak("Viva complete! Here's your report card.");
  };

  const showQuestionPanel = ["running", "listening", "no-reply", "grading", "feedback"].includes(state.stage);

  return (
    <section className="student-viva-mode" aria-label="Viva">
      <header className="student-ai-tutor-header">
        <h2>Viva</h2>
        <p>A quick spoken Q&amp;A on this concept -- 5 questions, answer out loud (or type) when asked.</p>
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
          <p className="student-viva-progress">
            Question {state.questionIndex + 1} of {state.totalQuestions}
          </p>
          <p className="student-viva-question">{state.currentQuestion}</p>

          {state.stage === "listening" && (
            <div className="student-viva-listening">
              <span className="student-viva-countdown">{state.countdown}</span>
              <p className="admin-workbench-muted">Listening for your answer...</p>
              <form className="student-viva-manual-form" onSubmit={handleManualSubmit}>
                <input
                  type="text"
                  value={manualAnswer}
                  onChange={(event) => setManualAnswer(event.target.value)}
                  placeholder="Or type your answer here"
                />
                <button type="submit" className="ghost-button" disabled={!manualAnswer.trim()}>
                  Submit
                </button>
              </form>
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

          {state.stage === "grading" && <p className="admin-workbench-muted">Getting feedback...</p>}

          {state.stage === "feedback" && (
            <div className="admin-ai-demo-feedback-block">
              <strong>Feedback</strong>
              <p>{state.feedback}</p>
            </div>
          )}
        </div>
      )}

      {state.stage === "complete" && (
        <div className="admin-ai-demo-panel">
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
                        <em>Feedback:</em> {result.feedback}
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
          <div className="admin-ai-demo-actions">
            <button type="button" className="primary-button" onClick={runViva}>
              Take Questions Again
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
