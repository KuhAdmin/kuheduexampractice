import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { StudentPageShell } from "../components/StudentPageShell";
import { StudentDrilldownCard } from "../components/StudentDrilldownCard";
import { StudentBreadcrumb } from "../components/StudentBreadcrumb";
import { useBreakpoint } from "../hooks/useBreakpoint";
import { getAssignedTestPapers, startTestPaperAttempt } from "../api/client";

const STATUS_LABEL = { not_started: "Not started", in_progress: "In progress", completed: "Completed" };

export const StudentTestPapersPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const justSubmitted = location.state?.justSubmitted;
  const tier = useBreakpoint();
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [startingId, setStartingId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    getAssignedTestPapers()
      .then((result) => {
        if (!cancelled) setPapers(result?.papers || []);
      })
      .catch((fetchError) => {
        if (!cancelled) setError(fetchError.message || "Failed to load your assigned tests.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleOpen = async (paper) => {
    if (paper.attemptStatus === "completed") return;
    setStartingId(paper.id);
    setError("");
    try {
      const attempt = await startTestPaperAttempt(paper.id);
      navigate(`/test-papers/attempts/${attempt.attemptId}`);
    } catch (startError) {
      setError(startError.message || "Failed to start this test.");
    } finally {
      setStartingId(null);
    }
  };

  return (
    <StudentPageShell pageClass="student-page--test-papers" legacyModifierClass="student-assessment-phone">
      {tier === "mobile" ? (
        <header className="student-section-detail-header">
          <h1>My Tests</h1>
        </header>
      ) : (
        <StudentBreadcrumb items={[{ label: "My Tests" }]} />
      )}

      {justSubmitted && (
        <p className="student-empty-state">
          Test submitted! {justSubmitted.isProvisional
            ? `Provisional score: ${justSubmitted.score}% -- some answers are still awaiting your teacher's review.`
            : `Score: ${justSubmitted.score}%.`}
        </p>
      )}

      {loading ? (
        <p className="student-empty-state">Loading your assigned tests...</p>
      ) : error && !papers.length ? (
        <p className="student-empty-state">{error}</p>
      ) : papers.length === 0 ? (
        <p className="student-empty-state">No tests have been assigned to you yet.</p>
      ) : (
        <div className="student-writing-drilldown-list">
          {error && <p className="student-empty-state">{error}</p>}
          {papers.map((paper) => (
            <StudentDrilldownCard
              key={paper.id}
              onClick={() => handleOpen(paper)}
              title={paper.title}
              subtitle={`${paper.className || ""}${paper.className ? " · " : ""}${paper.subjectName || ""}`}
              trailing={startingId === paper.id ? "Opening..." : undefined}
            >
              <p className="student-writing-category-blurb">
                {paper.questionCount} questions &middot; {paper.totalMarks} marks
                {paper.dueAt ? ` · Due ${new Date(paper.dueAt).toLocaleDateString()}` : ""}
                {" · "}
                {paper.attemptStatus === "completed" && paper.score != null
                  ? `Completed · Score ${paper.score}%`
                  : STATUS_LABEL[paper.attemptStatus] || "Not started"}
              </p>
            </StudentDrilldownCard>
          ))}
        </div>
      )}
    </StudentPageShell>
  );
};
