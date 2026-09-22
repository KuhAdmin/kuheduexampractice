import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { StudentPageShell } from "../components/StudentPageShell";
import { QuestionInteractionRenderer, INTERACTION_HANDLERS, resolveInteractionType } from "../components/QuestionInteractionRenderer";
import { MathPreview } from "../components/MathPreview";
import { getTestPaperAttempt, submitTestPaperAnswer, submitTestPaperAttempt } from "../api/client";

const ArrowLeftIcon = () => (
  <svg viewBox="0 0 24 24" className="student-testlab-arrow-icon" aria-hidden="true">
    <path d="M19 12H5M11 6l-6 6 6 6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg viewBox="0 0 24 24" className="student-testlab-arrow-icon" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
  </svg>
);

// Inverse of handler.serialize, same idiom as StudentTestLabSessionPage's
// hydrateAnswerState -- lets Previous show what was already saved instead of
// a blank slate.
const hydrateAnswerState = (item, interactionType) => {
  const handler = INTERACTION_HANDLERS[interactionType];
  if (item.studentAnswer === null || item.studentAnswer === undefined) {
    return handler.initialState(item);
  }
  if (interactionType === "ordering") {
    try {
      const parsed = JSON.parse(item.studentAnswer);
      return Array.isArray(parsed) ? parsed : handler.initialState(item);
    } catch {
      return handler.initialState(item);
    }
  }
  return item.studentAnswer;
};

export const StudentTestPaperSessionPage = () => {
  const navigate = useNavigate();
  const { attemptId } = useParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [saving, setSaving] = useState(false);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    getTestPaperAttempt(attemptId)
      .then((result) => {
        if (cancelled) return;
        setAttempt(result);
        const nextAnswers = {};
        result.items.forEach((item) => {
          nextAnswers[item.displayOrder] = hydrateAnswerState(item, resolveInteractionType(item));
        });
        setAnswers(nextAnswers);
        const firstUnanswered = result.items.findIndex((item) => item.studentAnswer === null);
        setActiveIndex(firstUnanswered === -1 ? Math.max(0, result.items.length - 1) : firstUnanswered);
      })
      .catch((fetchError) => {
        if (!cancelled) setError(fetchError.message || "This test could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [attemptId]);

  const items = attempt?.items || [];
  const activeItem = items[activeIndex];
  const interactionType = activeItem ? resolveInteractionType(activeItem) : "single_select";
  const handler = INTERACTION_HANDLERS[interactionType];
  const answerValue = activeItem ? answers[activeItem.displayOrder] : null;
  const isLastQuestion = items.length > 0 && activeIndex === items.length - 1;

  const handleAnswerChange = (nextValue) => {
    if (!activeItem) return;
    setAnswers((current) => ({ ...current, [activeItem.displayOrder]: nextValue }));
  };

  const persistCurrentAnswer = async () => {
    if (!activeItem) return;
    if (!handler.isReady(answerValue)) return;
    const serialized = handler.serialize(answerValue);
    if (serialized === (activeItem.studentAnswer ?? "")) return;

    setSaving(true);
    setError("");
    try {
      await submitTestPaperAnswer(attemptId, activeItem.displayOrder, serialized);
      setAttempt((current) => ({
        ...current,
        items: current.items.map((item) =>
          item.displayOrder === activeItem.displayOrder ? { ...item, studentAnswer: serialized } : item
        ),
      }));
    } catch (saveError) {
      setError(saveError.message || "Failed to save your answer.");
      throw saveError;
    } finally {
      setSaving(false);
    }
  };

  const handlePrevious = async () => {
    if (activeIndex === 0 || saving || finishing) return;
    try {
      await persistCurrentAnswer();
    } catch {
      return;
    }
    setActiveIndex((current) => current - 1);
  };

  const handleSaveAndNext = async () => {
    if (saving || finishing) return;
    try {
      await persistCurrentAnswer();
    } catch {
      return;
    }

    if (isLastQuestion) {
      setFinishing(true);
      try {
        const result = await submitTestPaperAttempt(attemptId);
        navigate("/test-papers", { state: { justSubmitted: result } });
      } catch (finishError) {
        setError(finishError.message || "Failed to submit this test.");
        setFinishing(false);
      }
      return;
    }

    setActiveIndex((current) => current + 1);
  };

  if (loading) {
    return (
      <StudentPageShell pageClass="student-page--test-lab" legacyModifierClass="student-testlab-phone">
        <p className="student-empty-state">Loading your test...</p>
      </StudentPageShell>
    );
  }

  if (error && !attempt) {
    return (
      <StudentPageShell pageClass="student-page--test-lab" legacyModifierClass="student-testlab-phone">
        <p className="student-empty-state">{error}</p>
      </StudentPageShell>
    );
  }

  if (finishing || !activeItem) {
    return (
      <StudentPageShell pageClass="student-page--test-lab" legacyModifierClass="student-testlab-phone">
        <p className="student-empty-state">Submitting your test...</p>
      </StudentPageShell>
    );
  }

  return (
    <StudentPageShell pageClass="student-page--test-lab" legacyModifierClass="student-testlab-phone">
      <div className="student-testlab-card">
        <div className="student-testlab-step-heading">
          <div>
            <h2>{attempt?.status === "completed" ? "Test (Submitted)" : "Take Test"}</h2>
            <p>Answer every question, then submit.</p>
          </div>
        </div>

        <div className="student-testlab-session-toprow">
          <span className="student-testlab-session-count">
            <span className="student-testlab-session-count-full">
              Question {activeIndex + 1} of {items.length}
            </span>
            <span className="student-testlab-session-count-short">
              Q{activeIndex + 1}/{items.length}
            </span>
          </span>
        </div>

        {activeItem.passage && (
          <div className="student-testlab-passage-box">
            <strong>Read the passage and answer the question below.</strong>
            <p>{activeItem.passage}</p>
          </div>
        )}

        {error && <p className="student-testlab-start-error">{error}</p>}

        <article className="student-testlab-question-card">
          <p className="student-testlab-question-text">
            {activeItem.question}
            <MathPreview text={activeItem.question} />
          </p>

          <QuestionInteractionRenderer
            item={activeItem}
            interactionType={interactionType}
            value={answerValue}
            onChange={handleAnswerChange}
            phase="question"
          />
        </article>

        <div className="student-testlab-session-nav">
          <button
            type="button"
            className="student-testlab-session-prev"
            disabled={activeIndex === 0 || saving}
            onClick={handlePrevious}
          >
            <ArrowLeftIcon />
            Previous
          </button>
          <button type="button" className="student-testlab-generate-button" disabled={saving || finishing} onClick={handleSaveAndNext}>
            {saving ? "Saving..." : isLastQuestion ? "Submit Test" : "Save & Next"}
            {!isLastQuestion && <ArrowRightIcon />}
          </button>
        </div>
      </div>
    </StudentPageShell>
  );
};
