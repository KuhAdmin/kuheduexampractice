import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { StudentPageShell } from "../components/StudentPageShell";
import { StudentDrilldownCard } from "../components/StudentDrilldownCard";
import { StudentWritingFormatGuide } from "../components/StudentWritingFormatGuide";
import { StudentBreadcrumb } from "../components/StudentBreadcrumb";
import { useBreakpoint } from "../hooks/useBreakpoint";
import { getWritingPracticeCategoryDetail } from "../api/client";

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

export const StudentWritingSubCategoriesPage = () => {
  const navigate = useNavigate();
  const tier = useBreakpoint();
  const { categorySlug } = useParams();
  const [category, setCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showFormatGuide, setShowFormatGuide] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setShowFormatGuide(false);

    getWritingPracticeCategoryDetail(categorySlug)
      .then((result) => {
        if (!cancelled) setCategory(result);
      })
      .catch((fetchError) => {
        if (!cancelled) setError(fetchError.message || "Failed to load this writing category.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [categorySlug]);

  return (
    <StudentPageShell pageClass="student-page--writing-practice" legacyModifierClass="student-assessment-phone">
      {tier === "mobile" ? (
        <header className="student-section-detail-header">
          <button
            type="button"
            className="student-chapter-detail-back"
            aria-label="Back to writing practice"
            onClick={() => navigate("/tests/write")}
          >
            <BackIcon />
          </button>
          <h1>{category?.title || "Writing Practice"}</h1>
        </header>
      ) : (
        <StudentBreadcrumb
          items={[
            { label: "Writing Practice", to: "/tests/write" },
            { label: category?.title || "Category" },
          ]}
        />
      )}

      {loading ? (
        <p className="student-empty-state">Loading...</p>
      ) : error ? (
        <p className="student-empty-state">{error}</p>
      ) : (
        <>
          {category?.subtitle && <p className="student-writing-category-blurb">{category.subtitle}</p>}
          {category?.description && <p className="student-writing-intro">{category.description}</p>}

          {category?.formatTemplate?.length > 0 && (
            <>
              <button
                type="button"
                className="ghost-button student-writing-format-toggle"
                onClick={() => setShowFormatGuide((current) => !current)}
              >
                {showFormatGuide ? "Hide Format Guide" : "Show Format Guide"}
              </button>
              {showFormatGuide && <StudentWritingFormatGuide steps={category.formatTemplate} />}
            </>
          )}

          {category?.subcategories?.length === 0 ? (
            <p className="student-empty-state">No topics have been added to this category yet.</p>
          ) : (
            <div className="student-writing-drilldown-list">
              {category?.subcategories?.map((subcategory, index) => (
                <StudentDrilldownCard
                  key={subcategory.slug}
                  onClick={() => navigate(`/tests/write/${categorySlug}/${subcategory.slug}`)}
                  leading={<span className="student-writing-index">{index + 1}</span>}
                  title={subcategory.title}
                />
              ))}
            </div>
          )}
        </>
      )}
    </StudentPageShell>
  );
};
