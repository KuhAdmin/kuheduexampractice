import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { StudentBottomNav } from "../components/StudentBottomNav";
import { StudentDrilldownCard } from "../components/StudentDrilldownCard";
import { getBookQuestions, getStudentSections } from "../api/client";

const ChapterDetailIcon = ({ type, className = "" }) => {
  const classes = `student-dashboard-icon ${className}`.trim();

  if (type === "back") {
    return (
      <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
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
  }

  return (
    <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
      <path
        d="m9 6 6 6-6 6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
};

export const StudentChapterDetailPage = ({ dashboard }) => {
  const navigate = useNavigate();
  const { chapterId: chapterNumber } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("sections");
  const [bookQuestions, setBookQuestions] = useState([]);
  const [bookQuestionsLoading, setBookQuestionsLoading] = useState(true);
  const [bookQuestionsError, setBookQuestionsError] = useState("");

  const dashboardChapter = (Array.isArray(dashboard?.chapters) ? dashboard.chapters : []).find(
    (chapter) => String(chapter.chapterNumber) === String(chapterNumber)
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    getStudentSections(chapterNumber)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((fetchError) => {
        if (!cancelled) setError(fetchError.message || "Failed to load chapter sections.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [chapterNumber]);

  useEffect(() => {
    let cancelled = false;
    setBookQuestionsLoading(true);
    setBookQuestionsError("");

    getBookQuestions(chapterNumber)
      .then((result) => {
        if (!cancelled) setBookQuestions(result?.questions || []);
      })
      .catch((fetchError) => {
        if (!cancelled) setBookQuestionsError(fetchError.message || "Failed to load book questions.");
      })
      .finally(() => {
        if (!cancelled) setBookQuestionsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [chapterNumber]);

  const chapterName = data?.chapterName || dashboardChapter?.title || "Chapter";
  const sections = data?.sections || [];
  const generatedSections = sections.filter((section) => section.hasContent);
  // Weighted by conceptCount (not a plain per-section average) so this matches
  // the concept-weighted definition used everywhere else (dashboard chapter
  // list, today's goal) -- otherwise a 3-concept section and a 17-concept
  // section count equally and the number drifts from the real mastery ratio.
  const totalConcepts = generatedSections.reduce(
    (sum, section) => sum + (section.conceptCount || 0),
    0
  );
  const overallProgress = totalConcepts
    ? Math.round(
        generatedSections.reduce(
          (sum, section) => sum + (section.progress || 0) * (section.conceptCount || 0),
          0
        ) / totalConcepts
      )
    : 0;

  const bookQuestionsAnsweredCount = bookQuestions.filter((question) => question.isCorrect !== null).length;
  const bookQuestionsCorrectCount = bookQuestions.filter((question) => question.isCorrect === true).length;
  const bookQuestionsProgress = bookQuestions.length
    ? Math.round((bookQuestionsCorrectCount / bookQuestions.length) * 100)
    : 0;

  return (
    <main className="student-dashboard-shell">
      <section className="student-dashboard-phone student-chapter-detail-phone">
        <header className="student-chapter-detail-header">
          <button
            type="button"
            className="student-chapter-detail-back"
            aria-label="Back to chapters"
            onClick={() => navigate("/chapters")}
          >
            <ChapterDetailIcon type="back" />
          </button>
          <h1>{`Chapter ${chapterNumber}. ${chapterName}`}</h1>
        </header>

        <section className="student-chapter-detail-card">
          <div className="student-chapter-detail-progress-copy">
            <span>Overall Progress</span>
            <strong>{overallProgress}%</strong>
            <p>
              {generatedSections.length}/{sections.length || 0} Sections Available
            </p>
            <div className="student-chapter-detail-progress-bar" aria-hidden="true">
              <span style={{ width: `${overallProgress}%` }} />
            </div>
            {bookQuestions.length > 0 && (
              <>
                <span>Book Questions</span>
                <strong>{bookQuestionsProgress}%</strong>
                <p>
                  {bookQuestionsAnsweredCount}/{bookQuestions.length} Answered
                </p>
                <div className="student-chapter-detail-progress-bar" aria-hidden="true">
                  <span style={{ width: `${bookQuestionsProgress}%` }} />
                </div>
              </>
            )}
          </div>
          <img
            src="/plant.png"
            alt=""
            className="student-chapter-detail-illustration"
            aria-hidden="true"
          />
        </section>

        <nav className="student-section-detail-tabs" aria-label="Chapter content">
          <button
            type="button"
            className={`student-section-detail-tab ${activeTab === "sections" ? "is-active" : ""}`}
            onClick={() => setActiveTab("sections")}
          >
            Sections ({sections.length})
          </button>
          <button
            type="button"
            className={`student-section-detail-tab ${activeTab === "bookQuestions" ? "is-active" : ""}`}
            onClick={() => setActiveTab("bookQuestions")}
          >
            Book Questions ({bookQuestions.length})
          </button>
        </nav>

        {activeTab === "sections" ? (
          <section className="student-chapter-detail-section">
            {loading ? (
              <p className="student-empty-state">Loading sections...</p>
            ) : error ? (
              <p className="student-empty-state">{error}</p>
            ) : sections.length === 0 ? (
              <p className="student-empty-state">No sections found for this chapter yet.</p>
            ) : (
              <div className="student-chapter-detail-list">
                {sections.map((section) => (
                  <StudentDrilldownCard
                    key={section.sectionNumber}
                    className={`student-chapter-detail-row ${!section.hasContent ? "is-disabled" : ""}`}
                    onClick={() =>
                      section.hasContent &&
                      navigate(`/chapters/${chapterNumber}/sections/${section.sourceSectionId}`)
                    }
                    leading={<div className="student-chapter-detail-index">{section.sectionNumber}</div>}
                    title={section.topicName || section.sectionNumber}
                    subtitle={
                      section.hasContent
                        ? `${section.conceptCount} Concepts - ${section.progress}%`
                        : "Not generated yet"
                    }
                  >
                  </StudentDrilldownCard>
                ))}
              </div>
            )}
          </section>
        ) : (
          <section className="student-chapter-detail-section">
            {bookQuestionsLoading ? (
              <p className="student-empty-state">Loading book questions...</p>
            ) : bookQuestionsError ? (
              <p className="student-empty-state">{bookQuestionsError}</p>
            ) : bookQuestions.length === 0 ? (
              <p className="student-empty-state">
                No chapter-end exercise questions have been added for this chapter yet.
              </p>
            ) : (
              <StudentDrilldownCard
                className="student-chapter-detail-row"
                onClick={() => navigate(`/chapters/${chapterNumber}/book-questions`)}
                leading={<div className="student-chapter-detail-index">{bookQuestions.length}</div>}
                title="Chapter-end exercise questions"
                subtitle={`${bookQuestionsAnsweredCount}/${bookQuestions.length} Answered - ${bookQuestionsProgress}%`}
              >
              </StudentDrilldownCard>
            )}
          </section>
        )}

        <StudentBottomNav activeItem="chapters" />
      </section>
    </main>
  );
};
