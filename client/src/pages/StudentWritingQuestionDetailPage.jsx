import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { StudentPageShell } from "../components/StudentPageShell";
import { StudentWritingFormatGuide } from "../components/StudentWritingFormatGuide";
import { StudentOpenResponsePanel } from "../components/StudentOpenResponsePanel";
import { StudentBreadcrumb } from "../components/StudentBreadcrumb";
import { useBreakpoint } from "../hooks/useBreakpoint";
import { getWritingPracticeQuestion, getWritingPracticeResponse, submitWritingPracticeResponse } from "../api/client";

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

export const StudentWritingQuestionDetailPage = () => {
  const navigate = useNavigate();
  const tier = useBreakpoint();
  const { categorySlug, subCategorySlug, questionId } = useParams();
  const [question, setQuestion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showFormatGuide, setShowFormatGuide] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setShowFormatGuide(false);

    getWritingPracticeQuestion(questionId)
      .then((result) => {
        if (!cancelled) setQuestion(result);
      })
      .catch((fetchError) => {
        if (!cancelled) setError(fetchError.message || "Failed to load this question.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [questionId]);

  return (
    <StudentPageShell pageClass="student-page--writing-practice" legacyModifierClass="student-assessment-phone">
      {tier === "mobile" ? (
        <header className="student-section-detail-header">
          <button
            type="button"
            className="student-chapter-detail-back"
            aria-label="Back to questions"
            onClick={() => navigate(`/tests/write/${categorySlug}/${subCategorySlug}`)}
          >
            <BackIcon />
          </button>
          <h1>{question?.title || "Writing Practice"}</h1>
        </header>
      ) : (
        <StudentBreadcrumb
          items={[
            { label: "Writing Practice", to: "/tests/write" },
            { label: question?.category?.title || "Category", to: `/tests/write/${categorySlug}` },
            {
              label: question?.subcategory?.title || "Topic",
              to: `/tests/write/${categorySlug}/${subCategorySlug}`,
            },
            { label: question?.title || "Question" },
          ]}
        />
      )}

      {loading ? (
        <p className="student-empty-state">Loading...</p>
      ) : error ? (
        <p className="student-empty-state">{error}</p>
      ) : (
        <section className="student-concept-practice-panel student-writing-question-panel">
          <article className="student-concept-practice-head student-writing-question-head">
            <div className="student-writing-question-meta">
              <span>{question.questionNumber ? `Q${question.questionNumber}` : "Question"}</span>
              {(question.wordLimit || question.marks) && (
                <b>
                  {[
                    question.wordLimit ? `${question.wordLimit} words` : null,
                    question.marks ? `${question.marks} marks` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </b>
              )}
            </div>
            <h2>{question.description}</h2>
          </article>

          {question.formatTemplate?.length > 0 && (
            <>
              <button
                type="button"
                className="ghost-button student-writing-format-toggle"
                onClick={() => setShowFormatGuide((current) => !current)}
              >
                {showFormatGuide ? "Hide Format Guide" : "Show Format Guide"}
              </button>
              {showFormatGuide && <StudentWritingFormatGuide steps={question.formatTemplate} />}
            </>
          )}

          <div className="student-writing-response-panel">
            <StudentOpenResponsePanel
              responseKey={questionId}
              fetchResponse={getWritingPracticeResponse}
              submitResponse={submitWritingPracticeResponse}
              placeholder="Type your answer, or capture a photo of your handwritten answer above"
            />
          </div>
        </section>
      )}
    </StudentPageShell>
  );
};
