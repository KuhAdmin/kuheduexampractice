import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { StudentPageShell } from "../components/StudentPageShell";
import { useBreakpoint } from "../hooks/useBreakpoint";
import { getAssessmentResult, getStudentSections } from "../api/client";

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

export const StudentAssessmentResultPage = () => {
  const navigate = useNavigate();
  const tier = useBreakpoint();
  const isDesktop = tier !== "mobile";
  const { chapterId: chapterNumber, sectionId: sourceSectionId, conceptId, attemptId } = useParams();
  const isConceptMode = Boolean(conceptId);
  const isChapterMode = !sourceSectionId && !conceptId;
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [breadcrumbMeta, setBreadcrumbMeta] = useState({ chapterName: "", sectionNumber: "", sectionTopicName: "" });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    getAssessmentResult(attemptId)
      .then((data) => {
        if (!cancelled) setResult(data);
      })
      .catch((fetchError) => {
        if (!cancelled) setError(fetchError.message || "Failed to load result.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [attemptId]);

  // Same breadcrumb data source as StudentAssessmentPage -- this result
  // screen is reached straight from there, so it needs the identical
  // Home > Chapter > Section > Concept trail, not just a bare title.
  useEffect(() => {
    let cancelled = false;

    getStudentSections(chapterNumber)
      .then((sections) => {
        if (cancelled) return;
        const section = (sections?.sections || []).find(
          (item) => String(item.sourceSectionId) === String(sourceSectionId)
        );
        setBreadcrumbMeta({
          chapterName: sections?.chapterName || "",
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

  const sectionPath = `/chapters/${chapterNumber}/sections/${sourceSectionId}`;
  const basePath = isChapterMode
    ? `/chapters/${chapterNumber}`
    : isConceptMode
    ? `${sectionPath}/concepts/${conceptId}`
    : sectionPath;
  const scorePercent = result?.score ?? 0;
  const conceptName = result?.performanceByTopic?.[0]?.primaryConcept || "";

  return (
    <StudentPageShell pageClass="student-page--assessment-result" legacyModifierClass="student-assessment-result-phone">
        {isDesktop ? (
          <div className="student-assessment-result-topbar">
          <nav className="student-concept-breadcrumb" aria-label="Breadcrumb">
            <button type="button" onClick={() => navigate("/dashboard")} aria-label="Home">
              <HomeIcon />
            </button>
            {isChapterMode ? (
              <>
                <ChevronRightIcon />
                <span className="is-current">
                  {`Chapter ${chapterNumber}${breadcrumbMeta.chapterName ? `. ${breadcrumbMeta.chapterName}` : ""}`}
                </span>
              </>
            ) : (
              <>
                <ChevronRightIcon />
                <button type="button" onClick={() => navigate(`/chapters/${chapterNumber}`)}>
                  {`Chapter ${chapterNumber}${breadcrumbMeta.chapterName ? `. ${breadcrumbMeta.chapterName}` : ""}`}
                </button>
                {isConceptMode ? (
                  <>
                    <ChevronRightIcon />
                    <button type="button" onClick={() => navigate(sectionPath)}>
                      {breadcrumbMeta.sectionTopicName
                        ? `${breadcrumbMeta.sectionNumber ? `${breadcrumbMeta.sectionNumber} ` : ""}${breadcrumbMeta.sectionTopicName}`
                        : `Section ${sourceSectionId}`}
                    </button>
                    <ChevronRightIcon />
                    <span className="is-current">{`${conceptId ? `${conceptId} ` : ""}${conceptName}`}</span>
                  </>
                ) : (
                  <>
                    <ChevronRightIcon />
                    <span className="is-current">
                      {breadcrumbMeta.sectionTopicName
                        ? `${breadcrumbMeta.sectionNumber ? `${breadcrumbMeta.sectionNumber} ` : ""}${breadcrumbMeta.sectionTopicName}`
                        : `Section ${sourceSectionId}`}
                    </span>
                  </>
                )}
              </>
            )}
          </nav>
          <h1 className="student-assessment-result-heading">Assessment Result</h1>
          </div>
        ) : (
          <header className="student-section-detail-header">
            <h1>Assessment Result</h1>
          </header>
        )}

        {loading ? (
          <p className="student-empty-state">Loading result...</p>
        ) : error || !result ? (
          <p className="student-empty-state">{error || "Result not found."}</p>
        ) : (
          <>
            <div className="student-result-score-ring">
              <span className="student-result-score-value">{scorePercent}%</span>
              <span className="student-result-score-label">
                {scorePercent >= 80 ? "Great job!" : scorePercent >= 50 ? "Good effort!" : "Keep practicing!"}
              </span>
            </div>

            <div className="student-result-counts">
              <div>
                <strong>{result.correctCount}</strong>
                <span>Correct</span>
              </div>
              <div>
                <strong>{result.incorrectCount}</strong>
                <span>Incorrect</span>
              </div>
              <div>
                <strong>{result.unattemptedCount}</strong>
                <span>Unattempted</span>
              </div>
            </div>

            <section className="student-result-topics">
              <h2>Performance by Topic</h2>
              {result.performanceByTopic.map((topic) => (
                <div key={topic.assessmentUnitId} className="student-result-topic-row">
                  <span>{topic.primaryConcept}</span>
                  <div className="student-result-topic-bar" aria-hidden="true">
                    <span style={{ width: `${topic.percentage}%` }} />
                  </div>
                  <strong>{topic.percentage}%</strong>
                </div>
              ))}
            </section>

            <div className="student-result-actions">
              <button
                type="button"
                className="ghost-button"
                onClick={() => navigate(basePath)}
              >
                Back to Overview
              </button>
              <button
                type="button"
                className="student-concept-practice-next"
                onClick={() => navigate(`${basePath}/assessment`)}
              >
                Retake Assessment
              </button>
            </div>
          </>
        )}

    </StudentPageShell>
  );
};
