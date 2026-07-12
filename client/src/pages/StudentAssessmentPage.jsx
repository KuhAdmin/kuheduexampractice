import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { StudentPageShell } from "../components/StudentPageShell";
import { FocusLayout } from "../components/FocusLayout";
import { StudentCameraCapture } from "../components/StudentCameraCapture";
import {
  getRecentAssessmentAttempts,
  getRecentChapterAssessmentAttempts,
  getRecentConceptAssessmentAttempts,
  ocrHandwrittenNote,
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

const CameraIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l.9-1.5A1.5 1.5 0 0 1 9.7 4.75h4.6a1.5 1.5 0 0 1 1.3.75L16.5 7h2A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5v-9Z"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
    />
    <circle cx="12" cy="12.5" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
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
  const { chapterId: chapterNumber, sectionId: sourceSectionId, conceptId } = useParams();
  const isConceptMode = Boolean(conceptId);
  const isChapterMode = !sourceSectionId && !conceptId;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [assessment, setAssessment] = useState(null);
  const [phase, setPhase] = useState("instructions"); // instructions | question | feedback | finishing
  const [activeIndex, setActiveIndex] = useState(0);
  const [answerState, setAnswerState] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [answering, setAnswering] = useState(false);
  const [startedAt, setStartedAt] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrApplied, setOcrApplied] = useState(false);
  const [ocrError, setOcrError] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [recentAttempts, setRecentAttempts] = useState([]);
  const [restarting, setRestarting] = useState(false);

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
    setOcrApplied(false);
    setOcrError("");
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
        timeTakenSeconds
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

  const handleCapturedPhoto = async (imageDataUrl) => {
    setOcrError("");
    setOcrApplied(false);
    setOcrLoading(true);
    try {
      const result = await ocrHandwrittenNote(imageDataUrl);
      if (result?.text) {
        setAnswerState(result.text);
        setOcrApplied(true);
      } else {
        setOcrError("We couldn't find any text in that photo. Try a clearer photo, or type your answer instead.");
      }
    } catch (ocrFailure) {
      setOcrError(ocrFailure.message || "Failed to read that photo. Please try again or type your answer.");
    } finally {
      setOcrLoading(false);
    }
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
            <span className="student-concept-practice-text">{option}</span>
            <span className="student-concept-practice-radio" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );

  const renderFreeText = () => (
    <div className="student-free-text-panel">
      {phase === "question" && (
        <button
          type="button"
          className={`student-ocr-upload-button ${ocrLoading ? "is-disabled" : ""}`}
          disabled={ocrLoading}
          onClick={() => setCameraOpen(true)}
        >
          <CameraIcon />
          <span>{ocrLoading ? "Reading your photo..." : "Capture Photo"}</span>
        </button>
      )}

      {cameraOpen && (
        <StudentCameraCapture
          onCapture={(dataUrl) => {
            setCameraOpen(false);
            handleCapturedPhoto(dataUrl);
          }}
          onCancel={() => setCameraOpen(false)}
        />
      )}

      <textarea
        rows={8}
        className={`student-assessment-text-input ${
          phase === "feedback" ? (feedback?.isCorrect ? "is-correct" : "is-incorrect") : ""
        }`}
        placeholder="Type your answer, or upload a photo of your handwritten answer above"
        value={answerState || ""}
        onChange={(event) => setAnswerState(event.target.value)}
        readOnly={phase === "feedback"}
        disabled={phase === "feedback"}
      />

      {ocrApplied && phase === "question" && (
        <p className="student-ocr-hint">
          We've filled this in from your photo — please check it reads correctly and fix anything before
          submitting.
        </p>
      )}
      {ocrError && phase === "question" && <p className="error-text">{ocrError}</p>}
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
              <span className="student-concept-practice-text">{value}</span>
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

  // Ordering/matching questions carry real multi-item content that benefits
  // from desktop width; single_select/free_text stay in the narrow focus
  // layout while still being answered, since that's a single, simple
  // decision. The instructions screen (stats + rules + recent attempts) is
  // overview content, not a single-task question, so it also gets the wide
  // layout -- and once feedback is showing (any interaction type), the
  // question sits beside its feedback in a second column, so that's wide too.
  const isWideQuestion =
    (phase === "question" || phase === "feedback") && (interactionType === "ordering" || interactionType === "matching");
  const isWide = isWideQuestion || phase === "instructions" || phase === "feedback";

  const Wrapper = isWide ? "div" : FocusLayout;
  const wrapperProps = isWide ? { className: "student-assessment-wide" } : {};

  return (
    <StudentPageShell pageClass="student-page--assessment" legacyModifierClass="student-assessment-phone">
      <Wrapper {...wrapperProps}>
        <header className="student-section-detail-header">
          <button
            type="button"
            className="student-chapter-detail-back"
            aria-label="Back to section"
            onClick={() => navigate(basePath)}
          >
            <BackIcon />
          </button>
          <h1>
            {isChapterMode
              ? assessment?.topicName
                ? `${assessment.topicName} Chapter Assessment`
                : "Chapter Assessment"
              : isConceptMode
              ? assessment?.topicName
                ? `${assessment.topicName} Practice`
                : "Concept Practice"
              : assessment?.sectionNumber
              ? `${assessment.sectionNumber} Section Assessment`
              : "Section Assessment"}
          </h1>
        </header>

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
          <section
            className={`student-concept-practice-panel ${phase === "feedback" ? "has-feedback-split" : ""}`}
          >
            <div className="student-concept-practice-question">
              <div className="student-concept-practice-head">
                <span>Question {activeIndex + 1} of {totalQuestions}</span>
                <p>
                  <small>{activeItem.marks} mark{activeItem.marks === 1 ? "" : "s"}</small>
                </p>
              </div>
              <h2>{activeItem.question}</h2>

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

            {phase === "feedback" && feedback && (
              <div className="student-concept-practice-feedback-col">
                <div className={`student-instant-feedback ${feedback.isCorrect ? "is-correct" : "is-incorrect"}`}>
                  <strong>{feedback.isCorrect ? "Correct!" : "Not quite"}</strong>
                  {!feedback.isCorrect && (
                    <p className="student-instant-feedback-answer">
                      Correct answer: {feedback.correctAnswer}
                    </p>
                  )}
                  {feedback.explanation && <p>{feedback.explanation}</p>}
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
            )}
          </section>
        )}
      </Wrapper>
    </StudentPageShell>
  );
};
