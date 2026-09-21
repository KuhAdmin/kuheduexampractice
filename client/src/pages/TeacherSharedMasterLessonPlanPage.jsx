import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getTeacherSharedMasterLessonPlanDetail } from "../api/client";
import { BLOOM_LEVELS, BLOOM_LABELS } from "../constants/bloomLevels";

const TEACHING_AID_FIELDS = [
  { key: "boardChalk", label: "Board / Chalk / Textbook" },
  { key: "concreteObjects", label: "Concrete / Real Objects" },
  { key: "visualAids", label: "Visual Aids" },
  { key: "laboratoryAids", label: "Laboratory Aids" },
  { key: "digitalAiAids", label: "Digital / AI Aids" },
];

export const TeacherSharedMasterLessonPlanPage = () => {
  const { shareId } = useParams();
  const navigate = useNavigate();
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    getTeacherSharedMasterLessonPlanDetail(shareId)
      .then(setPlan)
      .catch((loadError) => setError(loadError.message || "Failed to load this master lesson plan."))
      .finally(() => setLoading(false));
  }, [shareId]);

  if (loading) return <div className="teacher-page"><p>Loading...</p></div>;
  if (error) return <div className="teacher-page"><p className="error-text">{error}</p></div>;
  if (!plan) return null;

  return (
    <div className="teacher-page">
      <div className="teacher-page-header">
        <div>
          <button type="button" className="teacher-back-link" onClick={() => navigate("/teacher/lessons")}>
            &larr; Lessons
          </button>
          <h1>{plan.chapterLabel}</h1>
          <p>Shared by {plan.sharedByName}</p>
        </div>
        <div>
          <span className={`teacher-badge tone-${plan.status}`}>{plan.status}</span>
        </div>
      </div>

      <div className="teacher-lesson-create-main">
        <div className="teacher-ai-generate-grid">
          <div className="teacher-ai-generate-panel">
            <p>
              <b>Class Transaction Time:</b> {plan.classTransactionTime ? `${plan.classTransactionTime} classes` : "-"}
            </p>

            {plan.previousKnowledge && (
              <>
                <h3>Previous Knowledge</h3>
                <p>{plan.previousKnowledge}</p>
              </>
            )}

            {TEACHING_AID_FIELDS.some((field) => plan.teachingAids?.[field.key]) && (
              <>
                <h3>Teaching Aids</h3>
                <div className="teacher-lesson-bloom-output">
                  {TEACHING_AID_FIELDS.filter((field) => plan.teachingAids?.[field.key]).map((field) => (
                    <div key={field.key} className="teacher-lesson-bloom-output-item">
                      <b>{field.label}</b>
                      <p>{plan.teachingAids[field.key]}</p>
                    </div>
                  ))}
                </div>
              </>
            )}

            {BLOOM_LEVELS.some((stage) => plan.objectives?.[stage]) && (
              <>
                <h3>Objectives (by Bloom's Level)</h3>
                <div className="teacher-lesson-bloom-output">
                  {BLOOM_LEVELS.filter((stage) => plan.objectives?.[stage]).map((stage) => (
                    <div key={stage} className="teacher-lesson-bloom-output-item">
                      <b>{BLOOM_LABELS[stage]}</b>
                      <p>{plan.objectives[stage]}</p>
                    </div>
                  ))}
                </div>
              </>
            )}

            {plan.skillsCompetencies?.length > 0 && (
              <>
                <h3>Skills and Competencies</h3>
                <div className="teacher-lesson-bloom-output">
                  {plan.skillsCompetencies.map((skill, index) => (
                    <div key={index} className="teacher-lesson-bloom-output-item">
                      <b>{skill.title}</b>
                      <p>{skill.description}</p>
                    </div>
                  ))}
                </div>
              </>
            )}

            {plan.transactionMethodology && (
              <>
                <h3>Transaction Methodology</h3>
                <p>{plan.transactionMethodology}</p>
              </>
            )}

            {plan.interDisciplinaryLinkage?.length > 0 && (
              <>
                <h3>Inter-Disciplinary Linkage</h3>
                <div className="teacher-lesson-bloom-output">
                  {plan.interDisciplinaryLinkage.map((link, index) => (
                    <div key={index} className="teacher-lesson-bloom-output-item">
                      <b>{link.subjectPair}</b>
                      <p>{link.description}</p>
                    </div>
                  ))}
                </div>
              </>
            )}

            {plan.assessmentQuestions?.length > 0 && (
              <>
                <h3>Assessment Questions</h3>
                <ol>
                  {plan.assessmentQuestions.map((question, index) => (
                    <li key={index}>{question}</li>
                  ))}
                </ol>
              </>
            )}

            {plan.extraQuestions?.length > 0 && (
              <>
                <h3>Extra Questions (Other Than Textual)</h3>
                <ol>
                  {plan.extraQuestions.map((question, index) => (
                    <li key={index}>{question}</li>
                  ))}
                </ol>
              </>
            )}

            {(plan.subjectTeacherName || plan.hodName || plan.principalName) && (
              <>
                <h3>Sign-off</h3>
                <p>
                  Subject Teacher: {plan.subjectTeacherName || "-"} &middot; H.O.D.: {plan.hodName || "-"} &middot; Principal:{" "}
                  {plan.principalName || "-"}
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
