import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { StudentPageShell } from "../components/StudentPageShell";
import { extractSourcePageImages, StudentMultiPageAnswerInput } from "../components/StudentMultiPageAnswerInput";
import { MathPreview } from "../components/MathPreview";
import { getBookQuestions, submitBookQuestionResponse } from "../api/client";

const BackIcon = () => (
  <svg viewBox="0 0 24 24" className="student-dashboard-icon" aria-hidden="true">
    <path
      d="m15 6-6 6 6 6"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.9"
    />
  </svg>
);

const ChevronIcon = ({ direction }) => (
  <svg viewBox="0 0 24 24" className="student-dashboard-icon" aria-hidden="true">
    <path
      d={direction === "left" ? "m14.5 6-6 6 6 6" : "m9.5 6 6 6-6 6"}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.9"
    />
  </svg>
);

const SWIPE_THRESHOLD = 50;

const normalizeForCompare = (value) => String(value ?? "").trim().toLowerCase();

const shuffleArray = (array) => {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

// MCQ correctness is determined at extraction time (no answer key exists on
// the photographed page, so the AI decides once, up front, and a moderator
// approves it) -- unlike Layer 6 practice, there is no server-side "correct
// option" reveal beyond what a live submit response returns in this session.
const initialDraftForQuestion = (question) => {
  if (question.interactionType === "matching") {
    const pairs = question.interactionData?.pairs || [];
    return {
      left: pairs.map((pair) => pair.left),
      rightShuffled: shuffleArray(pairs.map((pair) => pair.right)),
      assignments: {},
      armedLeft: null,
    };
  }
  return "";
};

export const StudentBookQuestionsPage = () => {
  const navigate = useNavigate();
  const { chapterId: chapterNumber } = useParams();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [editingIds, setEditingIds] = useState(() => new Set());
  const [draft, setDraft] = useState("");
  const [sourcePageImages, setSourcePageImages] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const swipeStartX = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    getBookQuestions(chapterNumber)
      .then((result) => {
        if (cancelled) return;
        setQuestions(result?.questions || []);
        setActiveIndex(0);
      })
      .catch((fetchError) => {
        if (!cancelled) setError(fetchError.message || "Failed to load book questions.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [chapterNumber]);

  const activeQuestion = questions[activeIndex];
  const isEditing = Boolean(
    activeQuestion && (activeQuestion.isCorrect === null || editingIds.has(activeQuestion.id))
  );

  useEffect(() => {
    if (!activeQuestion) return;
    setSubmitError("");
    if (activeQuestion.isCorrect === null) {
      setDraft(initialDraftForQuestion(activeQuestion));
      setSourcePageImages([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeQuestion?.id]);

  const goToQuestion = (nextIndex) => {
    setActiveIndex((current) => {
      const clamped = Math.max(0, Math.min(nextIndex, questions.length - 1));
      return clamped === current ? current : clamped;
    });
  };

  const handleSwipeStart = (event) => {
    swipeStartX.current = (event.touches?.[0] ?? event).clientX;
  };

  const handleSwipeEnd = (event) => {
    if (swipeStartX.current === null) return;
    const endX = (event.changedTouches?.[0] ?? event).clientX;
    const deltaX = endX - swipeStartX.current;
    swipeStartX.current = null;
    if (Math.abs(deltaX) < SWIPE_THRESHOLD) return;
    goToQuestion(activeIndex + (deltaX < 0 ? 1 : -1));
  };

  const handleAnswerAgain = () => {
    setEditingIds((current) => new Set(current).add(activeQuestion.id));
    setDraft(initialDraftForQuestion(activeQuestion));
    setSourcePageImages([]);
    setSubmitError("");
  };

  const armMatchingLeft = (leftValue) => {
    setDraft((current) => ({
      ...current,
      armedLeft: current.armedLeft === leftValue ? null : leftValue,
    }));
  };

  const assignMatchingPair = (rightValue) => {
    setDraft((current) => {
      if (!current.armedLeft) return current;
      return {
        ...current,
        assignments: { ...current.assignments, [current.armedLeft]: rightValue },
        armedLeft: null,
      };
    });
  };

  const isReadyToSubmit = () => {
    if (!activeQuestion) return false;
    if (activeQuestion.interactionType === "matching") {
      return Boolean(draft?.left?.length) && draft.left.every((leftValue) => Boolean(draft.assignments[leftValue]));
    }
    if (activeQuestion.interactionType === "free_text") {
      return Boolean(draft?.trim?.());
    }
    return Boolean(draft);
  };

  const handleSubmit = async () => {
    if (!activeQuestion) return;

    const serializedAnswer =
      activeQuestion.interactionType === "matching"
        ? JSON.stringify(
            (draft.left || []).map((leftValue) => ({ left: leftValue, right: draft.assignments[leftValue] }))
          )
        : draft;

    setSubmitting(true);
    setSubmitError("");
    try {
      const result = await submitBookQuestionResponse(
        chapterNumber,
        activeQuestion.id,
        serializedAnswer,
        sourcePageImages
      );
      const questionId = activeQuestion.id;
      setQuestions((current) =>
        current.map((question) =>
          question.id === questionId
            ? {
                ...question,
                studentAnswer: serializedAnswer,
                isCorrect: result.isCorrect,
                feedback: result.feedback,
                correctAnswer: result.correctAnswer,
              }
            : question
        )
      );
      setEditingIds((current) => {
        const next = new Set(current);
        next.delete(questionId);
        return next;
      });
    } catch (submitFailure) {
      setSubmitError(submitFailure.message || "Failed to submit your answer.");
    } finally {
      setSubmitting(false);
    }
  };

  const renderSingleSelect = () => (
    <div className="student-concept-practice-options">
      {(activeQuestion.options || []).map((option, index) => {
        const optionId = String.fromCharCode(65 + index);
        const isSelected = isEditing ? draft === option : activeQuestion.studentAnswer === option;
        const isRevealedCorrect =
          !isEditing &&
          ((activeQuestion.correctAnswer &&
            normalizeForCompare(option) === normalizeForCompare(activeQuestion.correctAnswer)) ||
            (isSelected && activeQuestion.isCorrect === true));
        const isRevealedIncorrect = !isEditing && isSelected && activeQuestion.isCorrect === false;

        const className = [
          "student-concept-practice-option",
          isSelected ? "is-selected" : "",
          isRevealedCorrect ? "is-correct" : "",
          isRevealedIncorrect ? "is-incorrect" : "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <button
            key={option}
            type="button"
            className={className}
            disabled={!isEditing}
            onClick={() => isEditing && setDraft(option)}
          >
            <span className="student-concept-practice-badge">{optionId}</span>
            <span className="student-concept-practice-text">
              {option}
              <MathPreview text={option} />
            </span>
            <span className="student-concept-practice-radio" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );

  const renderFreeText = () => (
    <div className="student-free-text-panel">
      <StudentMultiPageAnswerInput
        value={isEditing ? draft : activeQuestion.studentAnswer || ""}
        onChange={(text, pages) => {
          if (!isEditing) return;
          setDraft(text);
          setSourcePageImages(extractSourcePageImages(pages));
        }}
        resetKey={`${activeQuestion?.id}:${isEditing}`}
        disabled={!isEditing}
        statusClassName={!isEditing ? (activeQuestion.isCorrect ? "is-correct" : "is-incorrect") : ""}
        placeholder="Type your answer, or capture a photo of your handwritten answer above"
        rows={8}
      />
    </div>
  );

  const renderMatching = () => {
    if (!isEditing) {
      let submittedPairs = [];
      try {
        submittedPairs = JSON.parse(activeQuestion.studentAnswer || "[]");
      } catch {
        submittedPairs = [];
      }

      return (
        <ul className="student-matching-column">
          {submittedPairs.map((pair, index) => (
            <li key={index}>
              <span className="student-matching-item">
                {pair.left} → {pair.right}
              </span>
            </li>
          ))}
        </ul>
      );
    }

    const state = draft && draft.left ? draft : { left: [], rightShuffled: [], assignments: {}, armedLeft: null };

    return (
      <div className="student-matching-columns">
        <ul className="student-matching-column">
          {state.left.map((leftValue) => {
            const assignedRight = state.assignments[leftValue];
            const isArmed = state.armedLeft === leftValue;
            const className = [
              "student-matching-item",
              isArmed ? "is-selected" : "",
              assignedRight ? "is-matched" : "",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <li key={leftValue}>
                <button type="button" className={className} onClick={() => armMatchingLeft(leftValue)}>
                  {leftValue}
                  {assignedRight ? ` → ${assignedRight}` : ""}
                </button>
              </li>
            );
          })}
        </ul>
        <ul className="student-matching-column">
          {state.rightShuffled.map((rightValue) => {
            const isUsed = Object.values(state.assignments).includes(rightValue);
            return (
              <li key={rightValue}>
                <button
                  type="button"
                  className={`student-matching-item ${isUsed ? "is-matched" : ""}`}
                  disabled={!state.armedLeft}
                  onClick={() => assignMatchingPair(rightValue)}
                >
                  {rightValue}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  const renderInteraction = () => {
    if (!activeQuestion) return null;
    if (activeQuestion.interactionType === "matching") return renderMatching();
    if (activeQuestion.interactionType === "single_select") return renderSingleSelect();
    return renderFreeText();
  };

  return (
    <StudentPageShell pageClass="student-page--book-questions" legacyModifierClass="student-assessment-phone">
        <header className="student-section-detail-header">
          <button
            type="button"
            className="student-chapter-detail-back"
            aria-label="Back to chapter"
            onClick={() => navigate(`/chapters/${chapterNumber}`)}
          >
            <BackIcon />
          </button>
          <h1>Book Questions</h1>
        </header>

        {loading ? (
          <p className="student-empty-state">Loading book questions...</p>
        ) : error ? (
          <p className="student-empty-state">{error}</p>
        ) : questions.length === 0 ? (
          <p className="student-empty-state">
            No chapter-end exercise questions have been added for this chapter yet.
          </p>
        ) : (
          <section className="student-concept-practice-panel">
            <div className="student-memory-booster-counter-row">
              <button
                type="button"
                className="student-memory-booster-counter-nav"
                aria-label="Previous question"
                onClick={() => goToQuestion(activeIndex - 1)}
                disabled={activeIndex === 0}
              >
                <ChevronIcon direction="left" />
              </button>
              <span className="student-memory-booster-concept-counter">
                Question {activeIndex + 1} of {questions.length}
              </span>
              <button
                type="button"
                className="student-memory-booster-counter-nav"
                aria-label="Next question"
                onClick={() => goToQuestion(activeIndex + 1)}
                disabled={activeIndex === questions.length - 1}
              >
                <ChevronIcon direction="right" />
              </button>
            </div>

            <article
              className="student-concept-practice-head"
              onTouchStart={handleSwipeStart}
              onTouchEnd={handleSwipeEnd}
              onPointerDown={handleSwipeStart}
              onPointerUp={handleSwipeEnd}
            >
              <span>{activeQuestion.questionNumber ? `Q${activeQuestion.questionNumber}` : "Question"}</span>
              <h2>{activeQuestion.questionText}</h2>
              <MathPreview text={activeQuestion.questionText} />
            </article>

            {renderInteraction()}

            {isEditing ? (
              <>
                {submitError && <p className="error-text">{submitError}</p>}
                <button
                  type="button"
                  className="student-concept-practice-next"
                  disabled={submitting || !isReadyToSubmit()}
                  onClick={handleSubmit}
                >
                  {submitting ? "Submitting..." : "Submit"}
                </button>
              </>
            ) : (
              <>
                <div
                  className={`student-instant-feedback ${activeQuestion.isCorrect ? "is-correct" : "is-incorrect"}`}
                >
                  <strong>{activeQuestion.isCorrect ? "Correct!" : "Not quite"}</strong>
                  {activeQuestion.correctAnswer && !activeQuestion.isCorrect && (
                    <>
                      <p className="student-instant-feedback-answer">
                        Correct answer: {activeQuestion.correctAnswer}
                      </p>
                      <MathPreview text={activeQuestion.correctAnswer} />
                    </>
                  )}
                  {activeQuestion.feedback && (
                    <>
                      <p>{activeQuestion.feedback}</p>
                      <MathPreview text={activeQuestion.feedback} />
                    </>
                  )}
                </div>
                <button type="button" className="ghost-button" onClick={handleAnswerAgain}>
                  Answer Again
                </button>
              </>
            )}
          </section>
        )}

    </StudentPageShell>
  );
};
