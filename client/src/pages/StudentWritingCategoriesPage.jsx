import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StudentPageShell } from "../components/StudentPageShell";
import { StudentDrilldownCard } from "../components/StudentDrilldownCard";
import { StudentBreadcrumb } from "../components/StudentBreadcrumb";
import { useBreakpoint } from "../hooks/useBreakpoint";
import { getWritingPracticeCategories } from "../api/client";

export const StudentWritingCategoriesPage = () => {
  const navigate = useNavigate();
  const tier = useBreakpoint();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    getWritingPracticeCategories()
      .then((result) => {
        if (!cancelled) setCategories(result?.categories || []);
      })
      .catch((fetchError) => {
        if (!cancelled) setError(fetchError.message || "Failed to load writing practice.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <StudentPageShell pageClass="student-page--writing-practice" legacyModifierClass="student-assessment-phone">
      {tier === "mobile" ? (
        <header className="student-section-detail-header">
          <h1>Writing Practice</h1>
        </header>
      ) : (
        <StudentBreadcrumb items={[{ label: "Writing Practice" }]} />
      )}

      {loading ? (
        <p className="student-empty-state">Loading writing practice...</p>
      ) : error ? (
        <p className="student-empty-state">{error}</p>
      ) : categories.length === 0 ? (
        <p className="student-empty-state">No writing practice categories have been added yet.</p>
      ) : (
        <div className="student-writing-drilldown-list">
          {categories.map((category, index) => (
            <StudentDrilldownCard
              key={category.slug}
              onClick={() => navigate(`/tests/write/${category.slug}`)}
              leading={<span className="student-writing-index">{index + 1}</span>}
              title={category.title}
              subtitle={category.subtitle}
            >
              {category.description && <p className="student-writing-category-blurb">{category.description}</p>}
            </StudentDrilldownCard>
          ))}
        </div>
      )}
    </StudentPageShell>
  );
};
