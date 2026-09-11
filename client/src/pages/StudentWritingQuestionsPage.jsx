import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { StudentPageShell } from "../components/StudentPageShell";
import { StudentDrilldownCard } from "../components/StudentDrilldownCard";
import { StudentBreadcrumb } from "../components/StudentBreadcrumb";
import { useBreakpoint } from "../hooks/useBreakpoint";
import { getWritingPracticeCategoryDetail, getWritingPracticeQuestions } from "../api/client";

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

export const StudentWritingQuestionsPage = () => {
  const navigate = useNavigate();
  const tier = useBreakpoint();
  const { categorySlug, subCategorySlug } = useParams();
  const [category, setCategory] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    Promise.all([
      getWritingPracticeCategoryDetail(categorySlug),
      getWritingPracticeQuestions(categorySlug, subCategorySlug),
    ])
      .then(([categoryResult, questionsResult]) => {
        if (cancelled) return;
        setCategory(categoryResult);
        setQuestions(questionsResult?.questions || []);
      })
      .catch((fetchError) => {
        if (!cancelled) setError(fetchError.message || "Failed to load these questions.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [categorySlug, subCategorySlug]);

  const subcategory = category?.subcategories?.find((sc) => sc.slug === subCategorySlug);

  return (
    <StudentPageShell pageClass="student-page--writing-practice" legacyModifierClass="student-assessment-phone">
      {tier === "mobile" ? (
        <header className="student-section-detail-header">
          <button
            type="button"
            className="student-chapter-detail-back"
            aria-label="Back to categories"
            onClick={() => navigate(`/tests/write/${categorySlug}`)}
          >
            <BackIcon />
          </button>
          <h1>{subcategory?.title || "Questions"}</h1>
        </header>
      ) : (
        <StudentBreadcrumb
          items={[
            { label: "Writing Practice", to: "/tests/write" },
            { label: category?.title || "Category", to: `/tests/write/${categorySlug}` },
            { label: subcategory?.title || "Topic" },
          ]}
        />
      )}

      {loading ? (
        <p className="student-empty-state">Loading...</p>
      ) : error ? (
        <p className="student-empty-state">{error}</p>
      ) : questions.length === 0 ? (
        <p className="student-empty-state">No questions have been added to this topic yet.</p>
      ) : (
        <div className="student-writing-drilldown-list">
          {questions.map((question) => (
            <StudentDrilldownCard
              key={question.id}
              onClick={() => navigate(`/tests/write/${categorySlug}/${subCategorySlug}/${question.id}`)}
              leading={
                <span className="student-concept-practice-badge">
                  {question.questionNumber ? `Q${question.questionNumber}` : "?"}
                </span>
              }
              title={question.title}
              subtitle={question.wordLimit ? `${question.wordLimit} words` : undefined}
            />
          ))}
        </div>
      )}
    </StudentPageShell>
  );
};
