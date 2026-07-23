import { useState } from "react";
import { askConceptTutor } from "../api/client";
import { MathPreview } from "./MathPreview";
import { StudentVoiceSessionPanel } from "./StudentVoiceSessionPanel";

// AI Tutor panel embedded in the Explore tab of StudentConceptLearningPage.
// Two modes only -- "ask" (free question) and "coach" (walk me through this,
// no question needed) -- see tutorChatService.js on the server for why
// Interview/Viva/Debate aren't ported here.
export const StudentAiTutorPanel = ({ assessmentUnitId }) => {
  const [question, setQuestion] = useState("");
  const [entries, setEntries] = useState([]);
  const [pendingMode, setPendingMode] = useState(null);
  const [error, setError] = useState("");

  const runTutor = async (mode, questionText) => {
    setPendingMode(mode);
    setError("");
    try {
      const { answer } = await askConceptTutor(assessmentUnitId, { mode, question: questionText });
      setEntries((prev) => [...prev, { mode, question: questionText, answer }]);
      if (mode === "ask") setQuestion("");
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setPendingMode(null);
    }
  };

  const handleAsk = (event) => {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || pendingMode) return;
    runTutor("ask", trimmed);
  };

  const handleCoach = () => {
    if (pendingMode) return;
    runTutor("coach", "");
  };

  return (
    <section className="student-ai-tutor-panel" aria-label="AI Tutor">
      <header className="student-ai-tutor-header">
        <h2>AI Tutor</h2>
        <p>Ask a question, or have the tutor walk you through this concept.</p>
      </header>

      <button
        type="button"
        className="student-ai-tutor-coach-button"
        onClick={handleCoach}
        disabled={pendingMode !== null}
      >
        {pendingMode === "coach" ? "Thinking…" : "Walk me through this"}
      </button>

      <form className="student-ai-tutor-ask-form" onSubmit={handleAsk}>
        <input
          type="text"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask a question about this concept…"
          disabled={pendingMode !== null}
        />
        <button type="submit" disabled={pendingMode !== null || !question.trim()}>
          {pendingMode === "ask" ? "Asking…" : "Ask"}
        </button>
      </form>

      {error && <p className="student-ai-tutor-error">{error}</p>}

      <StudentVoiceSessionPanel mode="ask" label="Ask" assessmentUnitId={assessmentUnitId} />

      {entries.length > 0 && (
        <ul className="student-ai-tutor-history">
          {entries.map((entry, index) => (
            <li key={index} className="student-ai-tutor-entry">
              {entry.mode === "ask" && <p className="student-ai-tutor-entry-question">{entry.question}</p>}
              <p className="student-ai-tutor-entry-answer">{entry.answer}</p>
              <MathPreview text={entry.answer} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
