import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { StudentPageShell } from "../components/StudentPageShell";
import { QuestionInteractionRenderer, INTERACTION_HANDLERS, resolveInteractionType } from "../components/QuestionInteractionRenderer";
import { MathPreview } from "../components/MathPreview";
import { getTestLabAttempt, submitTestLabAnswer, setTestLabItemReviewFlag, submitTestLabAttempt } from "../api/client";

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" className="student-dashboard-icon" aria-hidden="true">
    <path
      d="M6 6l12 12M18 6 6 18"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.9"
    />
  </svg>
);

const ClockIcon = () => (
  <svg viewBox="0 0 24 24" className="student-testlab-timer-icon" aria-hidden="true">
    <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
    <path d="M12 7.5V12l3 2" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
  </svg>
);

const PauseIcon = () => (
  <svg viewBox="0 0 24 24" className="student-testlab-pause-icon" aria-hidden="true">
    <path d="M8 6v12M16 6v12" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.2" />
  </svg>
);

const PlayIcon = () => (
  <svg viewBox="0 0 24 24" className="student-testlab-pause-icon" aria-hidden="true">
    <path d="M8 5.5v13l11-6.5-11-6.5Z" fill="currentColor" />
  </svg>
);

const BookmarkIcon = () => (
  <svg viewBox="0 0 24 24" className="student-testlab-mark-review-icon" aria-hidden="true">
    <path
      d="M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.6-6 3.6V5.5a1 1 0 0 1 1-1Z"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
    />
  </svg>
);

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

const SOURCE_TYPE_LABEL = { question_bank: "Question Bank", hots: "HOTS" };
const SOURCE_TYPE_TONE = { question_bank: "indigo", hots: "danger" };

const formatElapsed = (totalSeconds) => {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  const pad = (value) => String(value).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
};

// Decodes a previously-saved student_answer back into the shape
// QuestionInteractionRenderer/INTERACTION_HANDLERS expect (the inverse of
// handler.serialize) so revisiting an already-answered question via Previous
// shows the same state the student left it in, not a blank slate.
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

export const StudentTestLabSessionPage = () => {
  const navigate = useNavigate();
  const { attemptId } = useParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [reviewFlags, setReviewFlags] = useState({});
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [paused, setPaused] = useState(false);
  const [saving, setSaving] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [questionStartedAt, setQuestionStartedAt] = useState(Date.now());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    getTestLabAttempt(attemptId)
      .then((result) => {
        if (cancelled) return;
        setAttempt(result);

        const nextAnswers = {};
        const nextReviewFlags = {};
        result.items.forEach((item) => {
          nextAnswers[item.displayOrder] = hydrateAnswerState(item, resolveInteractionType(item));
          nextReviewFlags[item.displayOrder] = Boolean(item.isMarkedForReview);
        });
        setAnswers(nextAnswers);
        setReviewFlags(nextReviewFlags);

        const firstUnanswered = result.items.findIndex((item) => item.studentAnswer === null);
        setActiveIndex(firstUnanswered === -1 ? Math.max(0, result.items.length - 1) : firstUnanswered);

        const elapsedAtLoad = result.startedAt
          ? Math.max(0, Math.floor((Date.now() - new Date(result.startedAt).getTime()) / 1000))
          : 0;
        setElapsedSeconds(elapsedAtLoad);
      })
      .catch((fetchError) => {
        if (!cancelled) setError(fetchError.message || "This TestLab set could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [attemptId]);

  useEffect(() => {
    if (paused || finishing || !attempt || attempt.status !== "in_progress") return undefined;
    const interval = setInterval(() => setElapsedSeconds((current) => current + 1), 1000);
    return () => clearInterval(interval);
  }, [paused, finishing, attempt]);

  useEffect(() => {
    setQuestionStartedAt(Date.now());
  }, [activeIndex]);

  const items = attempt?.items || [];
  const activeItem = items[activeIndex];
  const interactionType = activeItem ? resolveInteractionType(activeItem) : "single_select";
  const handler = INTERACTION_HANDLERS[interactionType];
  const answerValue = activeItem ? answers[activeItem.displayOrder] : null;
  const isMarkedForReview = activeItem ? Boolean(reviewFlags[activeItem.displayOrder]) : false;
  const isLastQuestion = items.length > 0 && activeIndex === items.length - 1;

  const handleAnswerChange = (nextValue) => {
    if (!activeItem) return;
    setAnswers((current) => ({ ...current, [activeItem.displayOrder]: nextValue }));
  };

  // Saves whatever the student currently has entered for the active
  // question -- called before moving in either direction so an edited
  // answer is never lost, but skipped when there's nothing new to save
  // (never attempted, or unchanged since it was last stored).
  const persistCurrentAnswer = async () => {
    if (!activeItem) return;
    if (!handler.isReady(answerValue)) return;
    const serialized = handler.serialize(answerValue);
    if (serialized === (activeItem.studentAnswer ?? "")) return;

    const timeTakenSeconds = Math.round((Date.now() - questionStartedAt) / 1000);
    setSaving(true);
    setError("");
    try {
      await submitTestLabAnswer(attemptId, activeItem.displayOrder, serialized, timeTakenSeconds);
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
        await submitTestLabAttempt(attemptId);
        navigate(`/test-lab/attempts/${attemptId}/result`);
      } catch (finishError) {
        setError(finishError.message || "Failed to submit this TestLab set.");
        setFinishing(false);
      }
      return;
    }

    setActiveIndex((current) => current + 1);
  };

  const handleToggleReview = async () => {
    if (!activeItem) return;
    const next = !isMarkedForReview;
    setReviewFlags((current) => ({ ...current, [activeItem.displayOrder]: next }));
    try {
      await setTestLabItemReviewFlag(attemptId, activeItem.displayOrder, next);
    } catch {
      // Roll back rather than leave the UI claiming a flag that didn't
      // actually persist.
      setReviewFlags((current) => ({ ...current, [activeItem.displayOrder]: !next }));
    }
  };

  if (loading) {
    return (
      <StudentPageShell pageClass="student-page--test-lab" legacyModifierClass="student-testlab-phone">
        <p className="student-empty-state">Loading your TestLab set...</p>
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
        <p className="student-empty-state">Scoring your set...</p>
      </StudentPageShell>
    );
  }

  return (
    <StudentPageShell pageClass="student-page--test-lab" legacyModifierClass="student-testlab-phone">
      <header className="student-testlab-header">
        <button type="button" className="student-testlab-icon-button" aria-label="Exit TestLab set" onClick={() => navigate("/test-lab")}>
          <CloseIcon />
        </button>
        <div className="student-testlab-header-copy">
          <h1>TestLab</h1>
          <p>Mixed practice sets, drawn fresh from Question Bank + HOTS.</p>
        </div>
      </header>

      <div className="student-testlab-card">
        <div className="student-testlab-step-heading">
          <span className="student-testlab-step-badge">3</span>
          <div>
            <h2>Attempt Test</h2>
            <p>Clean, focused, distraction-free</p>
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
          <span className="student-testlab-timer-pill">
            <ClockIcon />
            {formatElapsed(elapsedSeconds)}
          </span>
          <button type="button" className="student-testlab-pause-button" onClick={() => setPaused((current) => !current)}>
            {paused ? <PlayIcon /> : <PauseIcon />}
            {paused ? "Resume" : "Pause"}
          </button>
        </div>

        <div className="student-testlab-pick-tags student-testlab-session-tags">
          {activeItem.passage && (
            <span className="student-testlab-pick-tag is-tone-blue">Case-based</span>
          )}
          <span className={`student-testlab-pick-tag is-tone-${SOURCE_TYPE_TONE[activeItem.sourceType] || "indigo"}`}>
            {SOURCE_TYPE_LABEL[activeItem.sourceType] || ""}
          </span>
        </div>

        {activeItem.passage && (
          <div className="student-testlab-passage-box">
            <strong>Read the passage and answer the questions that follow.</strong>
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

        <button
          type="button"
          className={`student-testlab-mark-review ${isMarkedForReview ? "is-marked" : ""}`}
          onClick={handleToggleReview}
        >
          <BookmarkIcon />
          {isMarkedForReview ? "Marked for Review" : "Mark for Review"}
        </button>

        <div className="student-testlab-session-nav">
          <button
            type="button"
            className="student-testlab-session-prev"
            disabled={activeIndex === 0 || saving || paused}
            onClick={handlePrevious}
          >
            <ArrowLeftIcon />
            Previous
          </button>
          <button
            type="button"
            className="student-testlab-generate-button"
            disabled={saving || finishing || paused}
            onClick={handleSaveAndNext}
          >
            {saving ? "Saving..." : isLastQuestion ? "Submit Test" : "Save & Next"}
            {!isLastQuestion && <ArrowRightIcon />}
          </button>
        </div>
      </div>
    </StudentPageShell>
  );
};
