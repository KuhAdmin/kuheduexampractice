import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { StudentPageShell } from "../components/StudentPageShell";
import { SingleSelectOptions } from "../components/SingleSelectOptions";
import { OrderingList, parseArrowSequence } from "../components/OrderingList";
import { StudentVoiceTextAnswerPanel } from "../components/StudentVoiceTextAnswerPanel";
import { StudentAnnotatedAnswer } from "../components/StudentAnnotatedAnswer";
import { EquationDisplay } from "../components/EquationDisplay";
import { StudentHookCaption } from "../components/StudentHookCaption";
import { startChapterHots, submitHotsAnswer } from "../api/client";

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
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d={direction === "left" ? "m15 6-6 6 6 6" : "m9 6 6 6-6 6"}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.9"
    />
  </svg>
);

const safeJsonParse = (value, fallback) => {
  if (value == null) return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

// Same fixed CBSE 4-option verdict set as StudentPostLessonPage.jsx's
// assertion_reason branch, duplicated here rather than shared -- see that
// file's comment for why (no `options` authored for this format).
const ASSERTION_REASON_OPTIONS = [
  "Both Assertion and Reason are true, and Reason is the correct explanation of Assertion.",
  "Both Assertion and Reason are true, but Reason is not the correct explanation of Assertion.",
  "Assertion is true, but Reason is false.",
  "Assertion is false, but Reason is true.",
];

const FREE_TEXT_FORMATS = new Set(["fill_in_blank", "short_answer", "hots_infer", "hots_predict", "hots_recall"]);

// Same mapping as StudentPostLessonPage.jsx/PreWarmupContentPreview.jsx --
// duplicated per the established convention rather than shared, since every
// one of these small format/content maps is expected to be able to diverge
// independently per page.
const COGNITIVE_LEVEL_BY_FORMAT = {
  fill_in_blank: "Remember",
  true_false: "Remember",
  hots_recall: "Remember",
  short_answer: "Understand",
  mcq: "Understand",
  assertion_reason: "Analyze",
  reorder: "Analyze",
  hots_infer: "Analyze",
  hots_predict: "Evaluate",
};

const BLOOMS_ORDER = ["Remember", "Understand", "Analyze", "Evaluate"];

const isAnswerReady = (format, answerState) => {
  if (format === "reorder") return Array.isArray(answerState) && answerState.length > 0;
  if (FREE_TEXT_FORMATS.has(format)) return Boolean(answerState?.trim());
  return Boolean(answerState);
};

const serializeAnswer = (format, answerState) => (format === "reorder" ? JSON.stringify(answerState) : answerState);

// "HOTS (n)" -- a chapter-wide combined quiz shuffling every section's Story
// Anchor Questions into one continuous session (StudentChapterDetailPage.jsx's
// row below Question Bank). Forked from StudentPostLessonPage.jsx's Story
// Anchor Questions rendering (same formats/grading/Bloom's chips/voice
// capture/AI issue-marking), stripped of the sub-section machinery that page
// needs (Transferable Patterns, subsectionKey) since this page only ever
// shows one thing. Items are addressed by `displayOrder` (unique per attempt)
// rather than `itemKey` (which collides across sections -- two different
// sections can each have a "storyAnchorQuestions.q0").
export const StudentHotsPage = () => {
  const navigate = useNavigate();
  const { chapterId: chapterNumber } = useParams();
  const basePath = `/chapters/${chapterNumber}`;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attemptId, setAttemptId] = useState(null);
  const [items, setItems] = useState([]);
  const [phase, setPhase] = useState("item"); // item | feedback | done
  const [activeIndex, setActiveIndex] = useState(0);
  const [answerState, setAnswerState] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [startedAt, setStartedAt] = useState(null);
  // Bloom's-level filter -- purely a client-side view over the already-fetched
  // `items`, null = show everything.
  const [levelFilter, setLevelFilter] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    startChapterHots(chapterNumber)
      .then((data) => {
        if (cancelled) return;
        setAttemptId(data.attemptId);
        setItems(data.items);
        const firstUnanswered = data.items.findIndex((item) => item.studentAnswer === null);
        setActiveIndex(firstUnanswered === -1 ? 0 : firstUnanswered);
        setStartedAt(Date.now());
        setPhase("item");
      })
      .catch((fetchError) => {
        if (!cancelled) setError(fetchError.message || "This chapter has no Story Anchor Questions yet.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [chapterNumber]);

  const levelCounts = BLOOMS_ORDER.map((level) => ({
    level,
    count: items.filter((item) => COGNITIVE_LEVEL_BY_FORMAT[item.format] === level).length,
  })).filter(({ count }) => count > 0);

  const displayedItems = levelFilter
    ? items.filter((item) => COGNITIVE_LEVEL_BY_FORMAT[item.format] === levelFilter)
    : items;

  const activeItem = displayedItems[activeIndex];

  // Shared by the mount/resume effect below, advance(), and the filter-chip
  // handler -- each must set answerState in the SAME batch as activeIndex,
  // same stale-render caution as StudentPostLessonPage.jsx's identical
  // comment (see the "labdlord" bug that pattern fixed there).
  const computeAnswerStateForItem = (item) => {
    if (item.format === "reorder") {
      return item.studentAnswer
        ? safeJsonParse(item.studentAnswer, [...(item.content.options || [])])
        : [...(item.content.options || [])];
    }
    return item.studentAnswer || null;
  };

  useEffect(() => {
    if (!activeItem) return;
    setAnswerState(computeAnswerStateForItem(activeItem));
    if (activeItem.studentAnswer !== null) {
      setFeedback({
        isCorrect: activeItem.isCorrect,
        correctAnswer: null,
        aiFeedback: activeItem.aiFeedback,
        aiFeedbackIssues: activeItem.aiFeedbackIssues,
      });
      setPhase("feedback");
    } else {
      setFeedback(null);
      setPhase("item");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeItem?.displayOrder]);

  const goToIndex = (nextIndex) => {
    const nextItem = displayedItems[nextIndex];
    if (!nextItem) return;
    setStartedAt(Date.now());
    setActiveIndex(nextIndex);
    setAnswerState(computeAnswerStateForItem(nextItem));
    if (nextItem.studentAnswer !== null) {
      setFeedback({
        isCorrect: nextItem.isCorrect,
        correctAnswer: null,
        aiFeedback: nextItem.aiFeedback,
        aiFeedbackIssues: nextItem.aiFeedbackIssues,
      });
      setPhase("feedback");
    } else {
      setFeedback(null);
      setPhase("item");
    }
  };

  const advance = () => {
    if (activeIndex + 1 < displayedItems.length) {
      goToIndex(activeIndex + 1);
    } else {
      setFeedback(null);
      setPhase("done");
    }
  };

  const goToPrev = () => goToIndex(activeIndex - 1);
  const goToNext = () => goToIndex(activeIndex + 1);

  const applyGradedResult = (displayOrder, itemFields) => {
    setItems((current) =>
      current.map((item) => (item.displayOrder === displayOrder ? { ...item, ...itemFields } : item))
    );
  };

  const handleFilterClick = (level) => {
    const nextFilter = levelFilter === level ? null : level;
    const view = nextFilter ? items.filter((item) => COGNITIVE_LEVEL_BY_FORMAT[item.format] === nextFilter) : items;
    const nextItem = view[0];

    setLevelFilter(nextFilter);
    setActiveIndex(0);
    setStartedAt(Date.now());
    setAnswerState(nextItem ? computeAnswerStateForItem(nextItem) : null);
    if (nextItem && nextItem.studentAnswer !== null) {
      setFeedback({
        isCorrect: nextItem.isCorrect,
        correctAnswer: null,
        aiFeedback: nextItem.aiFeedback,
        aiFeedbackIssues: nextItem.aiFeedbackIssues,
      });
      setPhase("feedback");
    } else {
      setFeedback(null);
      setPhase("item");
    }
  };

  const recordAnswer = async (studentAnswer) => {
    setSubmitting(true);
    setError("");
    const timeTakenSeconds = startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0;
    try {
      const graded = await submitHotsAnswer(attemptId, activeItem.displayOrder, studentAnswer, timeTakenSeconds);
      applyGradedResult(activeItem.displayOrder, {
        studentAnswer,
        isCorrect: graded.isCorrect,
        aiFeedback: graded.aiFeedback,
        aiFeedbackIssues: graded.aiFeedbackIssues,
      });
      setFeedback(graded);
      setPhase("feedback");
    } catch (submitError) {
      setError(submitError.message || "Failed to submit your answer.");
    } finally {
      setSubmitting(false);
    }
  };

  const renderItemBody = () => {
    if (!activeItem) return null;
    const { content } = activeItem;
    const format = content.format;
    const isFreeText = FREE_TEXT_FORMATS.has(format);
    const isReorder = format === "reorder";
    const isAssertionReason = format === "assertion_reason";
    const options = isAssertionReason ? ASSERTION_REASON_OPTIONS : content.options || [];
    const cognitiveLevel = COGNITIVE_LEVEL_BY_FORMAT[format] || null;

    return (
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="student-concept-practice-badge">{activeIndex + 1}</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <span className="student-concept-explore-tag is-format">{format}</span>
            {cognitiveLevel && <span className="student-concept-explore-tag">{cognitiveLevel}</span>}
          </div>
        </div>
        <div className="student-concept-practice-head">
          <span>{content.question}</span>
        </div>

        {format === "fill_in_blank" ? (
          <div className="student-free-text-panel">
            <EquationDisplay
              value={answerState || ""}
              onChange={phase === "feedback" ? undefined : setAnswerState}
              placeholder="Type your answer"
              className={phase === "feedback" ? (feedback?.isCorrect ? "is-correct" : "is-incorrect") : ""}
            />
          </div>
        ) : isFreeText ? (
          <StudentVoiceTextAnswerPanel
            value={answerState}
            onChange={setAnswerState}
            resetKey={activeItem.displayOrder}
            disabled={phase === "feedback"}
            statusClassName={phase === "feedback" ? (feedback?.isCorrect ? "is-correct" : "is-incorrect") : ""}
          />
        ) : isReorder ? (
          <OrderingList
            rows={Array.isArray(answerState) ? answerState : content.options || []}
            disabled={phase === "feedback"}
            correctSequence={phase === "feedback" && feedback ? parseArrowSequence(feedback.correctAnswer) : null}
            onReorder={setAnswerState}
          />
        ) : (
          <SingleSelectOptions
            options={options}
            answerState={answerState}
            disabled={phase === "feedback"}
            feedback={phase === "feedback" ? feedback : null}
            onSelect={setAnswerState}
          />
        )}

        {phase === "item" && (
          <button
            type="button"
            className="student-concept-practice-next"
            disabled={submitting || !isAnswerReady(format, answerState)}
            onClick={() => recordAnswer(serializeAnswer(format, answerState))}
          >
            {submitting ? "Submitting..." : "Submit"}
          </button>
        )}

        {phase === "feedback" && feedback && (
          <div className={`student-instant-feedback ${feedback.isCorrect ? "is-correct" : "is-incorrect"}`}>
            <strong>{feedback.isCorrect ? "Correct!" : "Not quite"}</strong>
            {!feedback.isCorrect && feedback.correctAnswer && <p>Correct answer: {feedback.correctAnswer}</p>}
            {feedback.aiFeedback && <p>{feedback.aiFeedback}</p>}
            {isFreeText && feedback.aiFeedbackIssues?.length > 0 && (
              <StudentAnnotatedAnswer text={activeItem.studentAnswer} issues={feedback.aiFeedbackIssues} />
            )}
            {content.anchorSentence && (
              <p style={{ fontStyle: "italic" }}>{`From the story: "${content.anchorSentence}"`}</p>
            )}
            <button type="button" className="student-concept-practice-next" onClick={advance}>
              {activeIndex + 1 < displayedItems.length ? "Next" : "Finish"}
            </button>
          </div>
        )}
      </div>
    );
  };

  const correctCount = displayedItems.filter((item) => item.isCorrect).length;

  return (
    <StudentPageShell pageClass="student-page--post-lesson" legacyModifierClass="student-assessment-phone">
      <div className="student-assessment-wide">
        <header className="student-section-detail-header">
          <button
            type="button"
            className="student-chapter-detail-back"
            aria-label="Back to chapter"
            onClick={() => navigate(basePath)}
          >
            <BackIcon />
          </button>
          <h1>HOTS</h1>
        </header>
        <StudentHookCaption text="Story Anchor Questions from across the whole chapter." />

        {!loading && !error && phase !== "done" && levelCounts.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
            {levelCounts.map(({ level, count }) => (
              <button
                key={level}
                type="button"
                className={`student-concept-explore-tag ${levelFilter === level ? "is-active" : ""}`}
                onClick={() => handleFilterClick(level)}
              >
                {level} ({count})
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <p className="student-empty-state">Loading...</p>
        ) : error ? (
          <p className="student-empty-state">{error}</p>
        ) : items.length === 0 ? (
          <>
            <p className="student-empty-state">This chapter has no Story Anchor Questions yet.</p>
            <button type="button" className="student-concept-practice-next" onClick={() => navigate(basePath)}>
              Back to Chapter
            </button>
          </>
        ) : phase === "done" ? (
          <section className="student-assessment-instructions">
            <div className="student-assessment-instructions-stats">
              <div>
                <span>Score</span>
                <strong>
                  {correctCount}/{displayedItems.length}
                </strong>
              </div>
            </div>
            <p>Great work! You've finished HOTS for this chapter.</p>
            <button type="button" className="student-concept-practice-next" onClick={() => navigate(basePath)}>
              Back to Chapter
            </button>
          </section>
        ) : (
          <section className="student-concept-practice-panel">
            <div className="student-concept-practice-question">
              {error && <p className="error-text">{error}</p>}
              {renderItemBody()}
            </div>
          </section>
        )}

        {!loading && !error && phase !== "done" && items.length > 0 && displayedItems.length > 1 && (
          <footer className="student-concept-learning-footer">
            <button
              type="button"
              className="student-concept-learning-nav is-previous"
              onClick={goToPrev}
              disabled={activeIndex === 0}
            >
              <ChevronIcon direction="left" />
              <span>Prev</span>
            </button>
            <span className="student-concept-learning-counter">
              {activeIndex + 1}/{displayedItems.length}
            </span>
            <button
              type="button"
              className="student-concept-learning-nav is-next"
              onClick={goToNext}
              disabled={activeIndex >= displayedItems.length - 1}
            >
              <span>Next</span>
              <ChevronIcon direction="right" />
            </button>
          </footer>
        )}
      </div>
    </StudentPageShell>
  );
};
