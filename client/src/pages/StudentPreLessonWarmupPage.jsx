import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { StudentPageShell } from "../components/StudentPageShell";
import { StudentMediaViewer } from "../components/StudentMediaViewer";
import { StudentOpenResponsePanel } from "../components/StudentOpenResponsePanel";
import { SingleSelectOptions } from "../components/SingleSelectOptions";
import { StudentHookCaption } from "../components/StudentHookCaption";
import { StudentBreadcrumb } from "../components/StudentBreadcrumb";
import { useBreakpoint } from "../hooks/useBreakpoint";
import { startPreWarmupPhase, submitPreWarmupAnswer, getStudentSections } from "../api/client";
import { HIERARCHY_LABELS } from "../content/hierarchyLabels";
import { getSubsectionMeta } from "../content/preWarmupSubsections";
import { decodeSelectionChapterId } from "./studentChapterData";

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

// Each visit is scoped to exactly one sub-section (StudentSectionDetailPage.jsx's
// accordion always links here with ?section=<key>) -- so this fetches only
// that sub-section's items (server-filtered, see startPreWarmupPhase's
// subsectionKey param) and walks just those, instead of the whole phase in
// one long sitting. Finishing a sub-section returns to the section list
// rather than continuing into an unrelated one; the phase itself
// auto-completes server-side once every sub-section has been visited (see
// finalizeAttemptIfComplete in studentPreWarmupService.js), so there's no
// separate "final submit" step here anymore.
export const StudentPreLessonWarmupPage = () => {
  const navigate = useNavigate();
  const tier = useBreakpoint();
  const { chapterId: chapterNumber, sectionId: sourceSectionId } = useParams();
  const selectionOverride = decodeSelectionChapterId(chapterNumber);
  const displayChapterNumber = selectionOverride?.chapterNumber ?? chapterNumber;
  const [searchParams] = useSearchParams();
  const subsectionKey = searchParams.get("section");
  const basePath = `/chapters/${chapterNumber}/sections/${sourceSectionId}`;
  const subsectionMeta = getSubsectionMeta("preLessonWarmup", subsectionKey);
  // Breadcrumb-only metadata (desktop/tablet) -- same fetch-once-by-section
  // pattern as StudentConceptLearningPage.jsx/StudentSectionDetailPage.jsx.
  const [breadcrumbMeta, setBreadcrumbMeta] = useState({ chapterName: "", sectionNumber: "", topicName: "" });

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
  // Mirrors StudentVoiceTextAnswerPanel's own recording stage/countdown
  // (Sensory Warm-Up's voice capture) so the "Start Recording" button and
  // live countdown can also be overlaid on the expanded image, not just
  // shown below it. voiceRef lets that overlay button trigger the actual
  // recording, which only StudentVoiceTextAnswerPanel knows how to do.
  const voiceRef = useRef(null);
  const [voiceStage, setVoiceStage] = useState("idle");
  const [voiceCountdown, setVoiceCountdown] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    if (!subsectionKey) {
      setError("No section specified.");
      setLoading(false);
      return undefined;
    }

    startPreWarmupPhase(sourceSectionId, "preLessonWarmup", subsectionKey)
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
        if (!cancelled) setError(fetchError.message || `This ${HIERARCHY_LABELS.lesson.toLowerCase()} has no warm-up content yet.`);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sourceSectionId, subsectionKey]);

  useEffect(() => {
    let cancelled = false;

    getStudentSections(displayChapterNumber, selectionOverride || undefined)
      .then((result) => {
        if (cancelled) return;
        const section = (result?.sections || []).find(
          (item) => String(item.sourceSectionId) === String(sourceSectionId)
        );
        setBreadcrumbMeta({
          chapterName: result?.chapterName || "",
          sectionNumber: section?.sectionNumber || "",
          topicName: section?.topicName || section?.sectionNumber || "",
        });
      })
      .catch(() => {
        if (!cancelled) setBreadcrumbMeta({ chapterName: "", sectionNumber: "", topicName: "" });
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterNumber, sourceSectionId]);

  const activeItem = items[activeIndex];

  useEffect(() => {
    if (!activeItem) return;
    setAnswerState(activeItem.itemTier === "scored" ? null : activeItem.studentAnswer || null);
    setVoiceStage("idle");
    setVoiceCountdown(null);
    if (activeItem.studentAnswer !== null) {
      setFeedback({ isCorrect: activeItem.isCorrect, correctAnswer: null, aiFeedback: activeItem.aiFeedback });
      setPhase("feedback");
    } else {
      setFeedback(null);
      setPhase("item");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeItem?.itemKey]);

  const advance = () => {
    setFeedback(null);
    setStartedAt(Date.now());
    if (activeIndex + 1 < items.length) {
      setActiveIndex((current) => current + 1);
      setPhase("item");
    } else {
      setPhase("done");
    }
  };

  const applyGradedResult = (itemKey, itemFields, phaseCompleted) => {
    setItems((current) => current.map((item) => (item.itemKey === itemKey ? { ...item, ...itemFields } : item)));
    if (phaseCompleted) setWholePhaseCompleted(true);
  };

  const recordAnswer = async (studentAnswer) => {
    setSubmitting(true);
    setError("");
    const timeTakenSeconds = startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0;
    try {
      const graded = await submitPreWarmupAnswer(attemptId, activeItem.itemKey, studentAnswer, timeTakenSeconds);
      applyGradedResult(
        activeItem.itemKey,
        { studentAnswer, isCorrect: graded.isCorrect, aiFeedback: graded.aiFeedback },
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

  // AVS/AVS Visual are each their own single-item sub-section visit now (the
  // accordion always scopes to one sub-section, see the file header comment)
  // -- advance() would just land on the "done" screen immediately after, so
  // skip that redundant hop and go straight back to the section list.
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
    const { content, itemTier } = activeItem;

    if (activeItem.itemKey === "vocabularyWarmup.avs") {
      return (
        <div style={{ display: "grid", gap: 10 }}>
          <div className="student-avs-grid">
            {(content.anchorVocabularySet || []).map((entry, index) => (
              <div key={index} className="student-instant-feedback is-neutral">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span className="student-concept-practice-badge">{index + 1}</span>
                  <strong>{entry.anchor}</strong>
                </div>
                <p>{entry.explanation}</p>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="student-concept-practice-next"
            disabled={submitting}
            onClick={recordAndReturn}
          >
            {submitting ? "Saving..." : "Back to Section"}
          </button>
        </div>
      );
    }

    if (activeItem.itemKey === "vocabularyWarmup.avsVisual") {
      return (
        <div style={{ display: "grid", gap: 10 }}>
          {content.image?.mediaData ? (
            <StudentMediaViewer
              mediaType="image"
              src={content.image.mediaData}
              alt="Vocabulary skeleton"
              className="student-media-viewer--contain"
            />
          ) : (
            <p className="student-empty-state">{`No image has been generated for this ${HIERARCHY_LABELS.lesson.toLowerCase()} yet.`}</p>
          )}
          <button
            type="button"
            className="student-concept-practice-next"
            disabled={submitting}
            onClick={recordAndReturn}
          >
            {submitting ? "Saving..." : "Back to Section"}
          </button>
        </div>
      );
    }

    if (itemTier === "scored") {
      return (
        <div style={{ display: "grid", gap: 10 }}>
          {content.image?.mediaData && (
            <StudentMediaViewer mediaType="image" src={content.image.mediaData} alt="Vocabulary visual quiz" />
          )}
          <div className="student-concept-practice-head">
            <span>{`Which picture matches "${content.avs}"?`}</span>
          </div>
          <SingleSelectOptions
            options={["A", "B"]}
            answerState={answerState}
            disabled={phase === "feedback"}
            feedback={phase === "feedback" ? feedback : null}
            onSelect={setAnswerState}
          />
          {phase === "item" && (
            <button
              type="button"
              className="student-concept-practice-next"
              disabled={submitting || !answerState}
              onClick={() => recordAnswer(answerState)}
            >
              {submitting ? "Checking..." : "Check Answer"}
            </button>
          )}
          {phase === "feedback" && feedback && (
            <div className={`student-instant-feedback ${feedback.isCorrect ? "is-correct" : "is-incorrect"}`}>
              <strong>{feedback.isCorrect ? "Correct!" : "Not quite"}</strong>
              <button type="button" className="student-concept-practice-next" onClick={advance}>
                {activeIndex + 1 < items.length ? "Next" : "Finish"}
              </button>
            </div>
          )}
        </div>
      );
    }

    const isSensory = activeItem.itemKey === "sensoryWarmup";
    return (
      <div style={{ display: "grid", gap: 10 }}>
        {isSensory && content.image?.mediaData && (
          <StudentMediaViewer
            mediaType="image"
            src={content.image.mediaData}
            alt="Vocabulary skeleton"
            className="student-media-viewer--contain"
            expandedOverlay={
              voiceStage === "idle" ? (
                <button
                  type="button"
                  className="student-media-viewer-timer-button"
                  onClick={() => voiceRef.current?.startRecording()}
                >
                  Start Recording
                </button>
              ) : voiceStage === "recording" ? (
                <span className="student-media-viewer-timer-badge">{voiceCountdown}s</span>
              ) : undefined
            }
          />
        )}
        <div className="student-concept-practice-head">
          <span>{isSensory ? content.responsePrompt : content.question}</span>
        </div>
        <StudentOpenResponsePanel
          responseKey={activeItem.itemKey}
          cues={isSensory ? undefined : content.cues}
          captureMode="voice"
          voiceMaxSeconds={120}
          voiceRef={voiceRef}
          onVoiceStageChange={setVoiceStage}
          onVoiceCountdownChange={setVoiceCountdown}
          fetchResponse={async () =>
            activeItem.studentAnswer
              ? {
                  responseText: activeItem.studentAnswer,
                  feedback: activeItem.aiFeedback,
                  issues: activeItem.aiFeedbackIssues || [],
                }
              : null
          }
          submitResponse={async (_key, text) => {
            const timeTakenSeconds = startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0;
            const graded = await submitPreWarmupAnswer(attemptId, activeItem.itemKey, text, timeTakenSeconds);
            const aiFeedback = graded.aiFeedback || "Thanks for sharing your thoughts!";
            const aiFeedbackIssues = graded.aiFeedbackIssues || [];
            applyGradedResult(
              activeItem.itemKey,
              { studentAnswer: text, isCorrect: null, aiFeedback, aiFeedbackIssues },
              graded.phaseCompleted
            );
            setFeedback({ isCorrect: null, correctAnswer: null, aiFeedback });
            return { feedback: aiFeedback, issues: aiFeedbackIssues };
          }}
        />
        {feedback?.aiFeedback && (
          <button type="button" className="student-concept-practice-next" onClick={advance}>
            {activeIndex + 1 < items.length ? "Next" : "Finish"}
          </button>
        )}
      </div>
    );
  };

  const scoredInThisVisit = items.filter((item) => item.itemTier === "scored");
  const correctInThisVisit = scoredInThisVisit.filter((item) => item.isCorrect).length;

  return (
    <StudentPageShell pageClass="student-page--pre-warmup" legacyModifierClass="student-assessment-phone">
      <div className="student-assessment-wide">
        {tier === "mobile" ? (
          <header className="student-section-detail-header">
            <button
              type="button"
              className="student-chapter-detail-back"
              aria-label={`Back to ${HIERARCHY_LABELS.lesson.toLowerCase()}`}
              onClick={() => navigate(basePath)}
            >
              <BackIcon />
            </button>
            <h1>{subsectionMeta?.title || "Pre-Lesson Warm-Up"}</h1>
          </header>
        ) : (
          <StudentBreadcrumb
            items={[
              {
                label: `Chapter ${displayChapterNumber}${breadcrumbMeta.chapterName ? `. ${breadcrumbMeta.chapterName}` : ""}`,
                to: `/chapters/${chapterNumber}`,
              },
              {
                label: breadcrumbMeta.topicName
                  ? `${breadcrumbMeta.sectionNumber ? `${breadcrumbMeta.sectionNumber} ` : ""}${breadcrumbMeta.topicName}`
                  : `Section ${sourceSectionId}`,
                to: basePath,
              },
              { label: subsectionMeta?.title || "Pre-Lesson Warm-Up" },
            ]}
          />
        )}
        {subsectionMeta?.caption && <StudentHookCaption text={subsectionMeta.caption} />}

        {loading ? (
          <p className="student-empty-state">Loading warm-up...</p>
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
                ? `Nice work! You've finished the whole Pre-Lesson Warm-Up — you're ready to start this ${HIERARCHY_LABELS.lesson.toLowerCase()}.`
                : `Nice work — you finished "${subsectionMeta?.title}".`}
            </p>
            <button type="button" className="student-concept-practice-next" onClick={() => navigate(basePath)}>
              Back to Section
            </button>
          </section>
        ) : (
          <section className="student-concept-practice-panel">
            <div className="student-concept-practice-question">
              {items.length > 1 && (
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
      </div>
    </StudentPageShell>
  );
};
