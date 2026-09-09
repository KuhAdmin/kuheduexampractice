import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { StudentPageShell } from "../components/StudentPageShell";
import { SingleSelectOptions } from "../components/SingleSelectOptions";
import { OrderingList, parseArrowSequence } from "../components/OrderingList";
import { StudentVoiceTextAnswerPanel } from "../components/StudentVoiceTextAnswerPanel";
import { StudentAnnotatedAnswer } from "../components/StudentAnnotatedAnswer";
import { EquationDisplay } from "../components/EquationDisplay";
import { StudentHookCaption } from "../components/StudentHookCaption";
import { startPreWarmupPhase, submitPatternExercise, submitPreWarmupAnswer } from "../api/client";
import { getSubsectionMeta } from "../content/preWarmupSubsections";

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

// No `options` field authored for assertion_reason in the source JSON --
// just one canonical verdict sentence as `answer` -- so the fixed CBSE
// 4-option set is built here, phrased to match the exact wording this
// content's own assertion_reason answers use (see
// content/cbse/class6/english/ch1-1-1-prewarmup-with-prompts.json), so an
// exact-match grade in studentPreWarmupService.js is achievable.
const ASSERTION_REASON_OPTIONS = [
  "Both Assertion and Reason are true, and Reason is the correct explanation of Assertion.",
  "Both Assertion and Reason are true, but Reason is not the correct explanation of Assertion.",
  "Assertion is true, but Reason is false.",
  "Assertion is false, but Reason is true.",
];

const FREE_TEXT_FORMATS = new Set(["fill_in_blank", "short_answer", "hots_infer", "hots_predict", "hots_recall"]);

// Same derivation as PreWarmupContentPreview.jsx's admin preview (the source
// of truth for this mapping) -- format is a STRUCTURAL type (how the learner
// answers), not a cognitive one (what thinking it demands), so this maps
// every format actually used in Story Anchor Questions to a Bloom's-taxonomy
// level for its own chip, matching what a moderator already sees in the
// Content Editor.
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

// Each visit is scoped to exactly one sub-section (StudentSectionDetailPage.jsx's
// accordion always links here with ?section=<key>) -- see
// StudentPreLessonWarmupPage.jsx for the full rationale (same redesign,
// shared server support in studentPreWarmupService.js).
export const StudentPostLessonPage = () => {
  const navigate = useNavigate();
  const { chapterId: chapterNumber, sectionId: sourceSectionId } = useParams();
  const [searchParams] = useSearchParams();
  const subsectionKey = searchParams.get("section");
  const basePath = `/chapters/${chapterNumber}/sections/${sourceSectionId}`;
  const subsectionMeta = getSubsectionMeta("postLesson", subsectionKey);

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
  const [wholePhaseCompleted, setWholePhaseCompleted] = useState(false);
  // Bloom's-level filter for Story Anchor Questions -- purely a client-side
  // view over the already-fetched `items`, null = show everything (today's
  // behavior unchanged).
  const [levelFilter, setLevelFilter] = useState(null);
  // Transferable Patterns paginates content.patterns one card at a time --
  // separate from activeIndex/items, since patterns all live inside this one
  // item's content rather than being separate items themselves.
  const [patternIndex, setPatternIndex] = useState(0);
  // The "write 3 sentences using this pattern" exercise -- keyed to whichever
  // pattern is currently shown, reloaded (from any previously-saved responses
  // in content.patternResponses) whenever patternIndex changes.
  const [patternExercise, setPatternExercise] = useState({ texts: ["", "", ""], results: null, submitting: false, error: "" });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    if (!subsectionKey) {
      setError("No section specified.");
      setLoading(false);
      return undefined;
    }

    startPreWarmupPhase(sourceSectionId, "postLesson", subsectionKey)
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
        if (!cancelled) setError(fetchError.message || "This section has no post-lesson content yet.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sourceSectionId, subsectionKey]);

  // How many of each Bloom's level are present, in taxonomy order -- only
  // meaningful for Story Anchor Questions (Transferable Patterns items have
  // no `format`, so COGNITIVE_LEVEL_BY_FORMAT[undefined] is just undefined
  // and never counted).
  const levelCounts = BLOOMS_ORDER.map((level) => ({
    level,
    count: items.filter((item) => COGNITIVE_LEVEL_BY_FORMAT[item.format] === level).length,
  })).filter(({ count }) => count > 0);

  // The list actually being walked/numbered -- everything when no filter is
  // active (today's behavior, unchanged), or just the selected level's
  // questions. `items` itself (with every item's grading state) stays the
  // source of truth; this is purely a view over it.
  const displayedItems = levelFilter
    ? items.filter((item) => COGNITIVE_LEVEL_BY_FORMAT[item.format] === levelFilter)
    : items;

  const activeItem = displayedItems[activeIndex];

  useEffect(() => {
    if (activeItem?.itemKey !== "transferablePatterns") return;
    const patterns = activeItem.content?.patterns || [];
    if (!patterns[patternIndex]) return;
    const saved = activeItem.content?.patternResponses?.[`p${patternIndex}`];
    setPatternExercise({
      texts: saved ? saved.map((response) => response.text || "") : ["", "", ""],
      results: saved ? saved.map((response) => ({ isCorrect: response.isCorrect, feedback: response.feedback })) : null,
      submitting: false,
      error: "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeItem?.itemKey, patternIndex]);

  const handlePatternExerciseSubmit = async () => {
    const patterns = activeItem.content?.patterns || [];
    const pattern = patterns[patternIndex];
    if (!pattern) return;
    setPatternExercise((prev) => ({ ...prev, submitting: true, error: "" }));
    try {
      const result = await submitPatternExercise(
        attemptId,
        `p${patternIndex}`,
        pattern.pattern,
        pattern.meaning || pattern.description,
        patternExercise.texts
      );
      setPatternExercise({
        texts: result.responses.map((response) => response.text || ""),
        results: result.responses.map((response) => ({ isCorrect: response.isCorrect, feedback: response.feedback })),
        submitting: false,
        error: "",
      });
    } catch (submitError) {
      setPatternExercise((prev) => ({
        ...prev,
        submitting: false,
        error: submitError.message || "Failed to submit. Please try again.",
      }));
    }
  };

  // Shared by the mount/resume effect below, advance(), and the filter-chip
  // handler -- each of those must set answerState in the SAME batch as
  // activeIndex (not leave it to this effect alone), otherwise there's one
  // intermediate render where a resetKey-driven child (previously
  // FreeTextAnswerPanel's StudentMultiPageAnswerInput, before it was swapped
  // for StudentVoiceTextAnswerPanel here) has already re-keyed for the new
  // item but `value` is still the previous question's text, and seeds its
  // internal state from that stale value (see the "labdlord" bug this fixed).
  // Kept even though every current branch here is now a plain controlled
  // input with no such internal state -- still the correct pattern for
  // avoiding any future stale-render class of bug.
  const computeAnswerStateForItem = (item) => {
    if (item.itemTier === "scored" && item.format === "reorder") {
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
  }, [activeItem?.itemKey]);

  // Shared by advance() and the Prev/Next footer nav -- moves to a specific
  // position in displayedItems, setting activeIndex/answerState/feedback/
  // phase together (see the comment above computeAnswerStateForItem for why
  // that has to be synchronous). Free navigation, not gated on whether the
  // target item has been answered -- Prev/Next just browse, same as
  // StudentConceptLearningPage.jsx's slide nav.
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

  const applyGradedResult = (itemKey, itemFields, phaseCompleted) => {
    setItems((current) => current.map((item) => (item.itemKey === itemKey ? { ...item, ...itemFields } : item)));
    if (phaseCompleted) setWholePhaseCompleted(true);
  };

  // Single-select toggle: tapping the active level clears back to the full
  // list. Always lands on position 1 of the new view (NOT "first unanswered"
  // -- that resume logic is only for the initial page-load effect above,
  // where "continue where you left off across a page revisit" makes sense.
  // Picking a filter is a deliberate browse action -- the learner expects to
  // see that category starting from its first card and step through all of
  // it via Next/Prev, not have some already discover-answered-elsewhere
  // cards silently skipped from the front, which made it look like only
  // part of the category was reachable (see the "starts at 6 instead of 1"
  // report). Everything (levelFilter, activeIndex, answerState, feedback,
  // phase) is set together in this one handler -- see the comment above
  // computeAnswerStateForItem for why that has to happen synchronously
  // rather than reactively in an effect keyed on levelFilter.
  const handleFilterClick = (level) => {
    const nextFilter = levelFilter === level ? null : level;
    const view = nextFilter
      ? items.filter((item) => COGNITIVE_LEVEL_BY_FORMAT[item.format] === nextFilter)
      : items;
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
      const graded = await submitPreWarmupAnswer(attemptId, activeItem.itemKey, studentAnswer, timeTakenSeconds);
      applyGradedResult(
        activeItem.itemKey,
        {
          studentAnswer,
          isCorrect: graded.isCorrect,
          aiFeedback: graded.aiFeedback,
          aiFeedbackIssues: graded.aiFeedbackIssues,
        },
        graded.phaseCompleted
      );
      if (activeItem.itemTier === "reference") {
        advance();
      } else {
        setFeedback(graded);
        setPhase("feedback");
      }
    } catch (submitError) {
      setError(submitError.message || "Failed to submit your answer.");
    } finally {
      setSubmitting(false);
    }
  };

  // Transferable Patterns is its own single-item sub-section visit now (the
  // accordion always scopes to one sub-section) -- advance() would just land
  // on the "done" screen immediately after, so skip that redundant hop and
  // go straight back to the section list.
  const recordAndReturn = async () => {
    setSubmitting(true);
    setError("");
    const timeTakenSeconds = startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0;
    try {
      await submitPreWarmupAnswer(attemptId, activeItem.itemKey, "viewed", timeTakenSeconds);
    } catch {
      /* best-effort -- still navigate back even if recording "viewed" failed */
    } finally {
      setSubmitting(false);
      navigate(basePath);
    }
  };

  const renderItemBody = () => {
    if (!activeItem) return null;
    const { content } = activeItem;

    if (activeItem.itemKey === "transferablePatterns") {
      const patterns = content.patterns || [];
      const pattern = patterns[patternIndex];
      if (!pattern) {
        return <p className="student-empty-state">No transferable patterns yet.</p>;
      }
      return (
        <div className="student-instant-feedback is-neutral">
          <strong>{pattern.pattern}</strong>
          <p>{pattern.meaning || pattern.description}</p>
          <p style={{ fontStyle: "italic" }}>Story evidence: {pattern.storyAnchor || pattern.storyEvidence}</p>
          {pattern.usageExamples?.length > 0 ? (
            <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
              {pattern.usageExamples.map((example, exampleIndex) => (
                <li key={exampleIndex}>{example}</li>
              ))}
            </ul>
          ) : (
            <p>{pattern.transferability}</p>
          )}
          {pattern.note && <p className="student-hook-caption">{pattern.note}</p>}
          <div className="student-pattern-exercise">
            <p className="student-pattern-exercise-prompt">Now try it yourself -- write 3 sentences of your own using this pattern.</p>
            {patternExercise.texts.map((text, index) => (
              <div key={index} className="student-pattern-exercise-row">
                <EquationDisplay
                  value={text}
                  onChange={(value) =>
                    setPatternExercise((prev) => {
                      const texts = [...prev.texts];
                      texts[index] = value;
                      return { ...prev, texts, results: null };
                    })
                  }
                  placeholder={`Example ${index + 1}`}
                />
                {patternExercise.results?.[index] && (
                  <p
                    className={`student-pattern-exercise-feedback ${
                      patternExercise.results[index].isCorrect ? "is-correct" : "is-incorrect"
                    }`}
                  >
                    {patternExercise.results[index].isCorrect ? "Correct -- " : "Not quite -- "}
                    {patternExercise.results[index].feedback}
                  </p>
                )}
              </div>
            ))}
            <button
              type="button"
              className="student-concept-practice-next"
              disabled={patternExercise.submitting || patternExercise.texts.every((text) => !text.trim())}
              onClick={handlePatternExerciseSubmit}
            >
              {patternExercise.submitting ? "Checking..." : "Submit for Feedback"}
            </button>
            {patternExercise.error && <p className="error-text">{patternExercise.error}</p>}
          </div>
        </div>
      );
    }

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
          // No photo-capture chrome for a one-word blank -- just the plain
          // input EquationDisplay already wraps (same one
          // StudentMultiPageAnswerInput uses per-page internally).
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
            resetKey={activeItem.itemKey}
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

  const scoredInThisVisit = displayedItems.filter((item) => item.itemTier === "scored");
  const correctInThisVisit = scoredInThisVisit.filter((item) => item.isCorrect).length;

  return (
    <StudentPageShell pageClass="student-page--post-lesson" legacyModifierClass="student-assessment-phone">
      <div className="student-assessment-wide">
        <header className="student-section-detail-header">
          <button
            type="button"
            className="student-chapter-detail-back"
            aria-label="Back to section"
            onClick={() => navigate(basePath)}
          >
            <BackIcon />
          </button>
          <h1>{subsectionMeta?.title || "Post-Lesson Follow-Up"}</h1>
        </header>
        {subsectionMeta?.caption && <StudentHookCaption text={subsectionMeta.caption} />}

        {!loading && !error && phase !== "done" && subsectionKey === "storyAnchorQuestions" && levelCounts.length > 0 && (
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
            <p className="student-empty-state">This part hasn't been added yet.</p>
            <button type="button" className="student-concept-practice-next" onClick={() => navigate(basePath)}>
              Back to Section
            </button>
          </>
        ) : phase === "done" ? (
          <section className="student-assessment-instructions">
            {scoredInThisVisit.length > 0 && (
              <div className="student-assessment-instructions-stats">
                <div>
                  <span>Score</span>
                  <strong>
                    {correctInThisVisit}/{scoredInThisVisit.length}
                  </strong>
                </div>
              </div>
            )}
            <p>
              {wholePhaseCompleted
                ? "Great work! You've finished the whole Post-Lesson Follow-Up."
                : `Nice work — you finished "${subsectionMeta?.title}".`}
            </p>
            <button type="button" className="student-concept-practice-next" onClick={() => navigate(basePath)}>
              Back to Section
            </button>
          </section>
        ) : (
          <section className="student-concept-practice-panel">
            <div className="student-concept-practice-question">
              {items.length > 1 && !activeItem?.itemKey?.startsWith("storyAnchorQuestions") && (
                <div className="student-concept-practice-head">
                  <span>
                    Step {activeIndex + 1} of {items.length}
                  </span>
                </div>
              )}
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

        {!loading && !error && phase !== "done" && activeItem?.itemKey === "transferablePatterns" && (
          <>
            {(activeItem.content?.patterns?.length || 0) > 1 && (
              <footer className="student-concept-learning-footer">
                <button
                  type="button"
                  className="student-concept-learning-nav is-previous"
                  onClick={() => setPatternIndex((index) => index - 1)}
                  disabled={patternIndex === 0}
                >
                  <ChevronIcon direction="left" />
                  <span>Prev</span>
                </button>
                <span className="student-concept-learning-counter">
                  {patternIndex + 1}/{activeItem.content.patterns.length}
                </span>
                <button
                  type="button"
                  className="student-concept-learning-nav is-next"
                  onClick={() => setPatternIndex((index) => index + 1)}
                  disabled={patternIndex >= activeItem.content.patterns.length - 1}
                >
                  <span>Next</span>
                  <ChevronIcon direction="right" />
                </button>
              </footer>
            )}
            <button
              type="button"
              className="student-concept-practice-next"
              disabled={submitting}
              onClick={recordAndReturn}
            >
              {submitting ? "Saving..." : "Back to Section"}
            </button>
          </>
        )}
      </div>
    </StudentPageShell>
  );
};
