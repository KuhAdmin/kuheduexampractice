import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { StudentPageShell } from "../components/StudentPageShell";
import { extractSourcePageImages, StudentMultiPageAnswerInput } from "../components/StudentMultiPageAnswerInput";
import { MathPreview } from "../components/MathPreview";
import { useBreakpoint } from "../hooks/useBreakpoint";
import {
  getRecentAssessmentAttempts,
  getRecentChapterAssessmentAttempts,
  getRecentConceptAssessmentAttempts,
  getStudentSections,
  restartChapterAssessment,
  restartSectionAssessment,
  startChapterAssessment,
  startConceptAssessment,
  startSectionAssessment,
  submitAssessment,
  submitAssessmentAnswer,
} from "../api/client";

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

const MoveIcon = ({ direction }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d={direction === "up" ? "m6 14 6-6 6 6" : "m6 10 6 6 6-6"}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.9"
    />
  </svg>
);

// Same breadcrumb/hero icons as StudentConceptLearningPage's desktop chrome,
// reused here so the assessment/practice screens share the exact same top
// design instead of falling back to a bare back-chevron + title.
const HomeIcon = () => (
  <svg viewBox="0 0 24 24" className="student-dashboard-icon" aria-hidden="true">
    <path
      d="m4 11 8-6.5L20 11v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1Z"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
    />
  </svg>
);

const ChevronRightIcon = () => (
  <svg viewBox="0 0 24 24" className="student-dashboard-icon" aria-hidden="true">
    <path
      d="m9.5 6 6 6-6 6"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.9"
    />
  </svg>
);

const BookIcon = () => (
  <svg viewBox="0 0 24 24" className="student-dashboard-icon" aria-hidden="true">
    <path
      d="M4 5.5c0-.83.67-1.5 1.5-1.5H12v16H5.5A1.5 1.5 0 0 0 4 21.5v-16Z"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.6"
    />
    <path
      d="M20 5.5c0-.83-.67-1.5-1.5-1.5H12v16h6.5a1.5 1.5 0 0 1 1.5 1.5v-16Z"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.6"
    />
  </svg>
);

const formatDuration = (seconds) => {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} min`;
};

const normalizeForCompare = (value) => String(value ?? "").trim().toLowerCase();

const shuffleArray = (array) => {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

// Legacy items generated before the interaction_type schema existed have no
// interactionType at all -- fall back to the original "has options -> MCQ,
// otherwise free text" heuristic so their behavior never changes.
const resolveInteractionType = (item) => {
  const type = item?.interactionType;
  if (type === "ordering" || type === "matching" || type === "free_text" || type === "single_select") {
    return type;
  }
  return (item?.options?.length ?? 0) > 0 ? "single_select" : "free_text";
};

// One entry per interaction type: how to seed local answer state for a fresh
// item, when that state counts as "ready to submit", and how to serialize it
// into the single string the submit-answer API expects. Adding a future type
// is one more entry here (plus a render branch) -- handleSubmitAnswer, the
// submit-button readiness check, and the answer-state reset never change.
const INTERACTION_HANDLERS = {
  single_select: {
    initialState: () => "",
    isReady: (state) => Boolean(state),
    serialize: (state) => state,
  },
  free_text: {
    initialState: () => "",
    isReady: (state) => Boolean(state?.trim()),
    serialize: (state) => state,
  },
  ordering: {
    initialState: (item) => [...(item.options || [])],
    isReady: (state) => Array.isArray(state) && state.length > 1,
    serialize: (state) => JSON.stringify(state),
  },
  matching: {
    initialState: (item) => ({
      left: item.interactionData?.leftItems || [],
      rightShuffled: shuffleArray(item.interactionData?.rightItems || []),
      assignments: {},
      armedLeft: null,
    }),
    isReady: (state) =>
      Boolean(state?.left?.length) && state.left.every((leftValue) => Boolean(state.assignments[leftValue])),
    serialize: (state) =>
      JSON.stringify(state.left.map((leftValue) => ({ left: leftValue, right: state.assignments[leftValue] }))),
  },
};

// Parses the "Kingdom; Phylum; ..." / "Left -> Right; Left2 -> Right2" style
// display strings the server returns in feedback.correctAnswer once an answer
// has been submitted (safe to reveal at that point, unlike interaction_data).
const parseCorrectSequence = (correctAnswer) =>
  String(correctAnswer || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);

const parseCorrectPairs = (correctAnswer) =>
  parseCorrectSequence(correctAnswer)
    .map((part) => {
      const [left, right] = part.split("->").map((piece) => piece?.trim());
      return left && right ? { left, right } : null;
    })
    .filter(Boolean);

export const StudentAssessmentPage = () => {
  const navigate = useNavigate();
  const tier = useBreakpoint();
  const isDesktop = tier !== "mobile";
  const { chapterId: chapterNumber, sectionId: sourceSectionId, conceptId } = useParams();
  const isConceptMode = Boolean(conceptId);
  const isChapterMode = !sourceSectionId && !conceptId;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [assessment, setAssessment] = useState(null);
  const [phase, setPhase] = useState("instructions"); // instructions | question | feedback | finishing
  const [activeIndex, setActiveIndex] = useState(0);
  const [answerState, setAnswerState] = useState(null);
  const [sourcePageImages, setSourcePageImages] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [answering, setAnswering] = useState(false);
  const [startedAt, setStartedAt] = useState(null);
  const [recentAttempts, setRecentAttempts] = useState([]);
  const [restarting, setRestarting] = useState(false);
  const [breadcrumbMeta, setBreadcrumbMeta] = useState({ chapterName: "", sectionNumber: "", sectionTopicName: "" });

  // Same breadcrumb data source as StudentConceptLearningPage's desktop
  // chrome, extended to also resolve the section's own topic name (distinct
  // from the concept's name) so concept-mode gets the identical four-level
  // Home > Chapter > Section > Concept breadcrumb as the Concept Learning
  // page it's reached from via the Practice tab.
  useEffect(() => {
    let cancelled = false;

    getStudentSections(chapterNumber)
      .then((result) => {
        if (cancelled) return;
        const section = (result?.sections || []).find(
          (item) => String(item.sourceSectionId) === String(sourceSectionId)
        );
        setBreadcrumbMeta({
          chapterName: result?.chapterName || "",
          sectionNumber: section?.sectionNumber || "",
          sectionTopicName: section?.topicName || "",
        });
      })
      .catch(() => {
        if (!cancelled) setBreadcrumbMeta({ chapterName: "", sectionNumber: "", sectionTopicName: "" });
      });

    return () => {
      cancelled = true;
    };
  }, [chapterNumber, sourceSectionId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    const startAssessment = isChapterMode
      ? startChapterAssessment(chapterNumber)
      : isConceptMode
      ? startConceptAssessment(conceptId)
      : startSectionAssessment(sourceSectionId);

    startAssessment
      .then((result) => {
        if (cancelled) return;
        setAssessment(result);
        const firstUnanswered = result.items.findIndex((item) => item.studentAnswer === null);
        setActiveIndex(firstUnanswered === -1 ? result.items.length : firstUnanswered);
      })
      .catch((fetchError) => {
        if (!cancelled) {
          setError(
            fetchError.message ||
              (isChapterMode
                ? "This chapter has no practice questions yet."
                : isConceptMode
                ? "This concept has no practice questions yet."
                : "This section has no assessment yet.")
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const recentAttemptsRequest = isChapterMode
      ? getRecentChapterAssessmentAttempts(chapterNumber)
      : isConceptMode
      ? getRecentConceptAssessmentAttempts(conceptId)
      : getRecentAssessmentAttempts(sourceSectionId);

    recentAttemptsRequest
      .then((result) => {
        if (!cancelled) setRecentAttempts(result?.attempts || []);
      })
      .catch(() => {
        if (!cancelled) setRecentAttempts([]);
      });

    return () => {
      cancelled = true;
    };
  }, [chapterNumber, sourceSectionId, conceptId, isConceptMode, isChapterMode]);

  const items = assessment?.items || [];
  const activeItem = items[activeIndex];
  const interactionType = activeItem ? resolveInteractionType(activeItem) : "single_select";
  const handler = INTERACTION_HANDLERS[interactionType];

  // Seed/reset local answer state whenever the active item changes (initial
  // load landing on the first unanswered item, or advancing via handleNext).
  useEffect(() => {
    if (!activeItem) return;
    setAnswerState(INTERACTION_HANDLERS[resolveInteractionType(activeItem)].initialState(activeItem));
    setSourcePageImages([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeItem?.itemId]);

  const sectionPath = `/chapters/${chapterNumber}/sections/${sourceSectionId}`;
  // Both "back" and the post-submit result route resolve relative to wherever
  // this assessment was launched from -- the chapter detail page in chapter
  // mode, the section overview in section mode, or the concept page in
  // concept mode.
  const basePath = isChapterMode
    ? `/chapters/${chapterNumber}`
    : isConceptMode
    ? `${sectionPath}/concepts/${conceptId}`
    : sectionPath;

  const beginAssessment = async () => {
    if (activeIndex >= items.length) {
      // Every item was already answered in a prior session; finish straight away.
      setPhase("finishing");
      try {
        await submitAssessment(assessment.attemptId);
        navigate(`${basePath}/assessment/result/${assessment.attemptId}`);
      } catch (finishError) {
        setError(finishError.message || "Failed to submit the assessment.");
        setPhase("instructions");
      }
      return;
    }

    setStartedAt(Date.now());
    setPhase("question");
  };

  const handleRestartAssessment = async () => {
    setRestarting(true);
    setError("");
    try {
      const result = isChapterMode
        ? await restartChapterAssessment(chapterNumber)
        : await restartSectionAssessment(sourceSectionId);
      setAssessment(result);
      setActiveIndex(0);
      setStartedAt(Date.now());
      setPhase("question");
    } catch (restartError) {
      setError(restartError.message || "Failed to restart the assessment.");
    } finally {
      setRestarting(false);
    }
  };

  const handleSubmitAnswer = async () => {
    if (!handler.isReady(answerState)) return;
    const answer = handler.serialize(answerState);

    setAnswering(true);
    setError("");
    const timeTakenSeconds = startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0;

    try {
      const result = await submitAssessmentAnswer(
        assessment.attemptId,
        activeItem.displayOrder,
        answer,
        timeTakenSeconds,
        sourcePageImages
      );
      setFeedback(result);
      setPhase("feedback");
    } catch (submitError) {
      setError(submitError.message || "Failed to submit answer.");
    } finally {
      setAnswering(false);
    }
  };

  const handleNext = async () => {
    setFeedback(null);
    setStartedAt(Date.now());

    if (activeIndex + 1 < items.length) {
      setActiveIndex((current) => current + 1);
      setPhase("question");
      return;
    }

    setPhase("finishing");
    try {
      await submitAssessment(assessment.attemptId);
      navigate(`${basePath}/assessment/result/${assessment.attemptId}`);
    } catch (finishError) {
      setError(finishError.message || "Failed to submit the assessment.");
      setPhase("feedback");
    }
  };

  const moveOrderingRow = (index, targetIndex) => {
    setAnswerState((current) => {
      if (!Array.isArray(current) || targetIndex < 0 || targetIndex >= current.length) {
        return current;
      }
      const next = [...current];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  };

  const armMatchingLeft = (leftValue) => {
    setAnswerState((current) => ({
      ...current,
      armedLeft: current.armedLeft === leftValue ? null : leftValue,
    }));
  };

  const assignMatchingPair = (rightValue) => {
    setAnswerState((current) => {
      if (!current.armedLeft) return current;
      return {
        ...current,
        assignments: { ...current.assignments, [current.armedLeft]: rightValue },
        armedLeft: null,
      };
    });
  };

  const totalQuestions = items.length;

  const renderSingleSelect = () => (
    <div className="student-concept-practice-options">
      {activeItem.options.map((option, index) => {
        const optionId = String.fromCharCode(65 + index);
        const isSelected = answerState === option;
        const isRevealedCorrect =
          phase === "feedback" &&
          feedback &&
          normalizeForCompare(option) === normalizeForCompare(feedback.correctAnswer);
        const isRevealedIncorrect = phase === "feedback" && isSelected && feedback && !feedback.isCorrect;

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
            disabled={phase === "feedback"}
            onClick={() => phase === "question" && setAnswerState(option)}
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
        value={answerState || ""}
        onChange={(text, pages) => {
          setAnswerState(text);
          setSourcePageImages(extractSourcePageImages(pages));
        }}
        resetKey={activeItem?.itemId}
        disabled={phase === "feedback"}
        statusClassName={phase === "feedback" ? (feedback?.isCorrect ? "is-correct" : "is-incorrect") : ""}
        placeholder="Type your answer, or capture a photo of your handwritten answer above"
        rows={8}
      />
    </div>
  );

  const renderOrdering = () => {
    const correctSequence = phase === "feedback" && feedback ? parseCorrectSequence(feedback.correctAnswer) : [];
    const rows = Array.isArray(answerState) ? answerState : [];

    return (
      <ol className="student-ordering-list">
        {rows.map((value, index) => {
          const isCorrectRow =
            phase === "feedback" && correctSequence[index] !== undefined
              ? normalizeForCompare(value) === normalizeForCompare(correctSequence[index])
              : false;
          const isIncorrectRow = phase === "feedback" && correctSequence[index] !== undefined && !isCorrectRow;

          const className = [
            "student-ordering-row",
            isCorrectRow ? "is-correct" : "",
            isIncorrectRow ? "is-incorrect" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <li key={value} className={className}>
              <span className="student-concept-practice-badge">{index + 1}</span>
              <span className="student-concept-practice-text">
                {value}
                <MathPreview text={value} />
              </span>
              <div className="student-ordering-controls">
                <button
                  type="button"
                  className="student-ordering-move"
                  aria-label={`Move ${value} up`}
                  disabled={phase === "feedback" || index === 0}
                  onClick={() => moveOrderingRow(index, index - 1)}
                >
                  <MoveIcon direction="up" />
                </button>
                <button
                  type="button"
                  className="student-ordering-move"
                  aria-label={`Move ${value} down`}
                  disabled={phase === "feedback" || index === rows.length - 1}
                  onClick={() => moveOrderingRow(index, index + 1)}
                >
                  <MoveIcon direction="down" />
                </button>
              </div>
            </li>
          );
        })}
      </ol>
    );
  };

  const renderMatching = () => {
    const state = answerState || { left: [], rightShuffled: [], assignments: {} };
    const correctPairs = phase === "feedback" && feedback ? parseCorrectPairs(feedback.correctAnswer) : [];
    const correctRightByLeft = new Map(correctPairs.map((pair) => [normalizeForCompare(pair.left), pair.right]));

    return (
      <div className="student-matching-columns">
        <ul className="student-matching-column">
          {state.left.map((leftValue) => {
            const assignedRight = state.assignments[leftValue];
            const isArmed = state.armedLeft === leftValue;
            const isCorrectPair =
              phase === "feedback" && assignedRight
                ? normalizeForCompare(assignedRight) === normalizeForCompare(correctRightByLeft.get(normalizeForCompare(leftValue)))
                : false;
            const isIncorrectPair = phase === "feedback" && assignedRight && !isCorrectPair;

            const className = [
              "student-matching-item",
              isArmed ? "is-selected" : "",
              assignedRight && phase === "question" ? "is-matched" : "",
              isCorrectPair ? "is-correct" : "",
              isIncorrectPair ? "is-incorrect" : "",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <li key={leftValue}>
                <button
                  type="button"
                  className={className}
                  disabled={phase === "feedback"}
                  onClick={() => armMatchingLeft(leftValue)}
                >
                  {leftValue}
                  {assignedRight ? ` → ${assignedRight}` : ""}
                  <MathPreview text={leftValue} />
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
                  disabled={!state.armedLeft || phase === "feedback"}
                  onClick={() => assignMatchingPair(rightValue)}
                >
                  {rightValue}
                  <MathPreview text={rightValue} />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  const renderInteraction = () => {
    if (!activeItem) return null;
    if (interactionType === "ordering") return renderOrdering();
    if (interactionType === "matching") return renderMatching();
    if (interactionType === "single_select") return renderSingleSelect();
    return renderFreeText();
  };

  // Every phase now uses the same wide layout (mobile is unaffected --
  // .student-assessment-wide only has rules inside min-width media queries,
  // so it's visually a no-op below 640px). Previously only ordering/matching
  // questions and the instructions/feedback screens got this width, which
  // made the card visibly jump in size between the question and feedback
  // steps for simple single_select/free_text questions.
  const Wrapper = "div";
  const wrapperProps = { className: "student-assessment-wide" };

  const assessmentTitle = isChapterMode
    ? assessment?.topicName
      ? `${assessment.topicName} Chapter Assessment`
      : "Chapter Assessment"
    : isConceptMode
    ? assessment?.topicName
      ? `${assessment.topicName} Practice`
      : "Concept Practice"
    : assessment?.sectionNumber
    ? `${assessment.sectionNumber} Section Assessment`
    : "Section Assessment";

  // Breadcrumb is persistent chrome across every phase now (previously it
  // only showed on the instructions screen, which meant it vanished the
  // moment a question started -- the exact gap reported). The hero card
  // (icon + badge + big title) stays instructions-only since it just
  // repeats what the question card's own heading already shows once a
  // question is on screen.
  return (
    <StudentPageShell pageClass="student-page--assessment" legacyModifierClass="student-assessment-phone">
      <Wrapper {...wrapperProps}>
        {isDesktop ? (
          <div className="student-concept-desktop">
            <nav className="student-concept-breadcrumb" aria-label="Breadcrumb">
              <button type="button" onClick={() => navigate("/dashboard")} aria-label="Home">
                <HomeIcon />
              </button>
              <ChevronRightIcon />
              <button type="button" onClick={() => navigate(`/chapters/${chapterNumber}`)}>
                {`Chapter ${chapterNumber}${breadcrumbMeta.chapterName ? `. ${breadcrumbMeta.chapterName}` : ""}`}
              </button>
              {isConceptMode ? (
                <>
                  <ChevronRightIcon />
                  <button type="button" onClick={() => navigate(`/chapters/${chapterNumber}/sections/${sourceSectionId}`)}>
                    {breadcrumbMeta.sectionTopicName
                      ? `${breadcrumbMeta.sectionNumber ? `${breadcrumbMeta.sectionNumber} ` : ""}${breadcrumbMeta.sectionTopicName}`
                      : `Section ${sourceSectionId}`}
                  </button>
                  <ChevronRightIcon />
                  <span className="is-current">
                    {`${conceptId ? `${conceptId} ` : ""}${assessment?.topicName || ""}`}
                  </span>
                </>
              ) : (
                <>
                  <ChevronRightIcon />
                  <span className="is-current">{assessmentTitle}</span>
                </>
              )}
            </nav>

            {phase === "instructions" && (
              <header className="student-concept-hero">
                <div className="student-concept-hero-icon">
                  <BookIcon />
                </div>
                <div className="student-concept-hero-copy">
                  <span className="student-concept-hero-badge">Chapter {chapterNumber}</span>
                  <h1>{assessmentTitle}</h1>
                </div>
              </header>
            )}
          </div>
        ) : (
          <header className="student-section-detail-header">
            <button
              type="button"
              className="student-chapter-detail-back"
              aria-label="Back to section"
              onClick={() => navigate(basePath)}
            >
              <BackIcon />
            </button>
            <h1>{assessmentTitle}</h1>
          </header>
        )}

        {loading ? (
          <p className="student-empty-state">Loading assessment...</p>
        ) : error && !assessment ? (
          <p className="student-empty-state">{error}</p>
        ) : !assessment || totalQuestions === 0 ? (
          <p className="student-empty-state">
            {isConceptMode
              ? "No practice questions have been generated for this concept yet."
              : "No assessment items have been generated for this section yet."}
          </p>
        ) : phase === "instructions" ? (
          <section className="student-assessment-instructions">
            <div className="student-assessment-instructions-stats">
              <div>
                <span>Questions</span>
                <strong>{totalQuestions}</strong>
              </div>
              <div>
                <span>Marks</span>
                <strong>{assessment.totalMarks}</strong>
              </div>
              <div>
                <span>Est. Time</span>
                <strong>{formatDuration(assessment.estimatedDurationSeconds)}</strong>
              </div>
            </div>
            <ul className="student-assessment-instructions-list">
              <li>All questions are compulsory.</li>
              <li>There is no negative marking.</li>
              <li>Read each question carefully.</li>
              <li>Tap "Submit" after choosing your answer to see instant feedback.</li>
            </ul>
            <div className="student-assessment-cta-row">
              <button
                type="button"
                className="student-concept-practice-next"
                disabled={restarting}
                onClick={beginAssessment}
              >
                {isConceptMode ? "Practice Concept" : "Continue Assessment"}
              </button>
              {!isConceptMode && (
                <button
                  type="button"
                  className="ghost-button student-assessment-restart"
                  disabled={restarting}
                  onClick={handleRestartAssessment}
                >
                  {restarting ? "Restarting..." : "Restart Assessment"}
                </button>
              )}
            </div>

            <div className="student-assessment-history">
              <h2>Recent Attempts</h2>
              {recentAttempts.length === 0 ? (
                <p className="student-assessment-history-empty">No previous attempts yet.</p>
              ) : (
                <div className="student-assessment-history-list">
                  {recentAttempts.map((attempt) => {
                    const startedAtDate = attempt.startedAt ? new Date(attempt.startedAt) : null;
                    return (
                      <div key={attempt.attemptId} className="student-assessment-history-row">
                        <div className="student-assessment-history-date">
                          <strong>{startedAtDate ? startedAtDate.toLocaleDateString() : "-"}</strong>
                          <span>
                            {startedAtDate
                              ? startedAtDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                              : ""}
                          </span>
                        </div>
                        <div className="student-assessment-history-stats">
                          <span>{attempt.attemptedCount} attempted</span>
                          <span className="is-correct">{attempt.correctCount} correct</span>
                          <span className="is-incorrect">{attempt.incorrectCount} incorrect</span>
                          {attempt.score !== null && (
                            <span className="student-assessment-history-score">{attempt.score}% score</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        ) : phase === "finishing" ? (
          <p className="student-empty-state">Submitting your assessment...</p>
        ) : (
          <section className="student-concept-practice-panel has-feedback-split">
            <div className="student-concept-practice-question">
              <div className="student-concept-practice-head">
                <span>Question {activeIndex + 1} of {totalQuestions}</span>
                <p>
                  <small>{activeItem.marks} mark{activeItem.marks === 1 ? "" : "s"}</small>
                </p>
              </div>
              <h2>{activeItem.question}</h2>
              <MathPreview text={activeItem.question} />
              {activeItem.diagramInstruction && (
                <p className="student-diagram-instruction">{activeItem.diagramInstruction}</p>
              )}

              {renderInteraction()}

              {phase === "question" && (
                <>
                  {error && <p className="error-text">{error}</p>}

                  <button
                    type="button"
                    className="student-concept-practice-next"
                    disabled={answering || !handler.isReady(answerState)}
                    onClick={handleSubmitAnswer}
                  >
                    {answering ? "Submitting..." : "Submit"}
                  </button>
                </>
              )}
            </div>

            {phase === "feedback" && feedback ? (
              <div className="student-concept-practice-feedback-col">
                <div className={`student-instant-feedback ${feedback.isCorrect ? "is-correct" : "is-incorrect"}`}>
                  <strong>{feedback.isCorrect ? "Correct!" : "Not quite"}</strong>
                  {!feedback.isCorrect && (
                    <>
                      <p className="student-instant-feedback-answer">
                        Correct answer: {feedback.correctAnswer}
                      </p>
                      <MathPreview text={feedback.correctAnswer} />
                    </>
                  )}
                  {feedback.explanation && (
                    <>
                      <p>{feedback.explanation}</p>
                      <MathPreview text={feedback.explanation} />
                    </>
                  )}
                  {feedback.relatedConcept && (
                    <p className="student-instant-feedback-related">
                      Related concept: {feedback.relatedConcept}
                    </p>
                  )}
                </div>
                {error && <p className="error-text">{error}</p>}
                <button type="button" className="student-concept-practice-next" onClick={handleNext}>
                  {activeIndex + 1 < totalQuestions ? "Next Question" : "See Result"}
                </button>
              </div>
            ) : (
              <div className="student-concept-practice-feedback-col is-placeholder">
                <p>Your feedback will appear here after you submit.</p>
              </div>
            )}
          </section>
        )}
      </Wrapper>
    </StudentPageShell>
  );
};
