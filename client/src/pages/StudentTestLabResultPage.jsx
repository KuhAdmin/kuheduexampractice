import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { StudentPageShell } from "../components/StudentPageShell";
import { MathPreview } from "../components/MathPreview";
import { useAuth } from "../context/authHooks";
import { getTestLabAttemptResult } from "../api/client";

const SOURCE_TYPE_LABEL = { question_bank: "Question Bank", hots: "HOTS" };
const STRENGTH_THRESHOLD = 70;
const CONFETTI_PIECES = 10;

const firstNameFromUser = (name) => {
  if (!name) return "Student";
  return name.trim().split(/\s+/)[0] || "Student";
};

const formatTimeTaken = (totalSeconds) => {
  if (totalSeconds === null || totalSeconds === undefined) return "--";
  const safeSeconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}m ${seconds}s`;
};

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" className="student-testlab-report-stat-icon" aria-hidden="true">
    <path d="m5 13 4 4 10-10" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
  </svg>
);

const CrossIcon = () => (
  <svg viewBox="0 0 24 24" className="student-testlab-report-stat-icon" aria-hidden="true">
    <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
  </svg>
);

const ClockIcon = () => (
  <svg viewBox="0 0 24 24" className="student-testlab-report-stat-icon" aria-hidden="true">
    <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <path d="M12 7.5V12l3 2" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
  </svg>
);

const TargetIcon = () => (
  <svg viewBox="0 0 24 24" className="student-testlab-report-stat-icon" aria-hidden="true">
    <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <circle cx="12" cy="12" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" />
  </svg>
);

const TABS = [
  { key: "chapter", label: "Chapter-wise" },
  { key: "type", label: "Question Type" },
  { key: "strengths", label: "Strengths & Gaps" },
];

const BreakdownRow = ({ label, correct, total, percentage }) => (
  <div className="student-testlab-report-row">
    <span className="student-testlab-report-row-label">{label}</span>
    <span className="student-testlab-report-row-fraction">
      {correct}/{total}
    </span>
    <div className="student-testlab-report-row-bar" aria-hidden="true">
      <span style={{ width: `${percentage}%` }} />
    </div>
    <strong className="student-testlab-report-row-percent">{percentage}%</strong>
  </div>
);

export const StudentTestLabResultPage = () => {
  const navigate = useNavigate();
  const { attemptId } = useParams();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [activeTab, setActiveTab] = useState("chapter");
  const [showDetailedReport, setShowDetailedReport] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getTestLabAttemptResult(attemptId)
      .then((data) => {
        if (!cancelled) setResult(data);
      })
      .catch((fetchError) => {
        if (!cancelled) setError(fetchError.message || "This TestLab report card could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [attemptId]);

  // The ring and the stat grid must always agree with each other (see plan:
  // `score` is marks-weighted and can subtly differ from a plain
  // correct/total ratio), so this screen computes one accuracy percentage
  // from correctCount/totalCount and uses it everywhere it appears.
  const accuracyPercent = useMemo(() => {
    if (!result || !result.totalCount) return 0;
    return Math.round((result.correctCount / result.totalCount) * 100);
  }, [result]);

  const tier = accuracyPercent >= 80 ? "high" : accuracyPercent >= 50 ? "mid" : "low";
  const firstName = firstNameFromUser(user?.name);
  const headline =
    tier === "high" ? `Great Job, ${firstName}!` : tier === "mid" ? `Good Effort, ${firstName}!` : `Keep Going, ${firstName}!`;

  const combinedBreakdown = useMemo(() => {
    if (!result) return [];
    const chapterRows = (result.chapterBreakdown || []).map((entry) => ({
      key: `chapter-${entry.chapterNumber}`,
      label: `Chapter ${entry.chapterNumber}`,
      correct: entry.correct,
      total: entry.total,
      percentage: entry.percentage,
    }));
    const typeRows = (result.interactionTypeBreakdown || [])
      .filter((entry) => entry.total > 0)
      .map((entry) => ({
        key: `type-${entry.interactionType}`,
        label: entry.label,
        correct: entry.correct,
        total: entry.total,
        percentage: entry.percentage,
      }));
    return [...chapterRows, ...typeRows];
  }, [result]);

  const strengths = combinedBreakdown.filter((entry) => entry.percentage >= STRENGTH_THRESHOLD).sort((a, b) => b.percentage - a.percentage);
  const gaps = combinedBreakdown.filter((entry) => entry.percentage < STRENGTH_THRESHOLD).sort((a, b) => a.percentage - b.percentage);

  return (
    <StudentPageShell pageClass="student-page--test-lab" legacyModifierClass="student-testlab-phone">
      <header className="student-testlab-header">
        <div className="student-testlab-header-copy">
          <h1>TestLab</h1>
          <p>Mixed practice sets, drawn fresh from Question Bank + HOTS.</p>
        </div>
      </header>

      {loading ? (
        <p className="student-empty-state">Scoring your set...</p>
      ) : error || !result ? (
        <p className="student-empty-state">{error || "Result not found."}</p>
      ) : (
        <div className="student-testlab-card">
          <div className="student-testlab-step-heading">
            <span className="student-testlab-step-badge is-tone-green">4</span>
            <div>
              <h2>Submit &amp; View Report</h2>
              <p>Get instant results and detailed analysis</p>
            </div>
          </div>

          <div className="student-testlab-report-celebrate">
            {tier === "high" && (
              <div className="student-testlab-report-confetti" aria-hidden="true">
                {Array.from({ length: CONFETTI_PIECES }).map((_, index) => (
                  <span key={index} />
                ))}
              </div>
            )}
            <span className="student-testlab-report-trophy" aria-hidden="true">
              {tier === "high" ? "\u{1F3C6}" : tier === "mid" ? "\u{1F3AF}" : "\u{1F4AA}"}
            </span>
            <h3>{headline}</h3>
            <p>You've completed the test.</p>
          </div>

          <div className="student-testlab-report-ring" style={{ "--progress": `${accuracyPercent}%` }}>
            <span className="student-testlab-report-ring-fraction">
              {result.correctCount}/{result.totalCount}
            </span>
            <span className="student-testlab-report-ring-percent">{accuracyPercent}%</span>
          </div>

          <div className="student-testlab-report-stats">
            <div className="student-testlab-report-stat">
              <span className="student-testlab-report-stat-icon-wrap is-tone-success">
                <CheckIcon />
              </span>
              <div>
                <strong>{result.correctCount}</strong>
                <span>Correct</span>
              </div>
            </div>
            <div className="student-testlab-report-stat">
              <span className="student-testlab-report-stat-icon-wrap is-tone-danger">
                <CrossIcon />
              </span>
              <div>
                <strong>{result.incorrectCount}</strong>
                <span>Incorrect</span>
              </div>
            </div>
            <div className="student-testlab-report-stat">
              <span className="student-testlab-report-stat-icon-wrap is-tone-blue">
                <ClockIcon />
              </span>
              <div>
                <strong>{formatTimeTaken(result.timeTakenSeconds)}</strong>
                <span>Time Taken</span>
              </div>
            </div>
            <div className="student-testlab-report-stat">
              <span className="student-testlab-report-stat-icon-wrap is-tone-indigo">
                <TargetIcon />
              </span>
              <div>
                <strong>{accuracyPercent}%</strong>
                <span>Accuracy</span>
              </div>
            </div>
          </div>

          {result.summary && (
            <div className="student-testlab-report-quote">
              <span aria-hidden="true">{"⭐"}</span>
              <p>{result.summary}</p>
            </div>
          )}

          <div className="student-testlab-report-tabs" role="tablist">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.key}
                className={`student-testlab-report-tab ${activeTab === tab.key ? "is-active" : ""}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "chapter" && (
            <div className="student-testlab-report-panel">
              {(result.chapterBreakdown || []).map((entry) => (
                <BreakdownRow
                  key={entry.chapterNumber}
                  label={`Chapter ${entry.chapterNumber}`}
                  correct={entry.correct}
                  total={entry.total}
                  percentage={entry.percentage}
                />
              ))}
            </div>
          )}

          {activeTab === "type" && (
            <div className="student-testlab-report-panel">
              {(result.interactionTypeBreakdown || [])
                .filter((entry) => entry.total > 0)
                .map((entry) => (
                  <BreakdownRow
                    key={entry.interactionType}
                    label={entry.label}
                    correct={entry.correct}
                    total={entry.total}
                    percentage={entry.percentage}
                  />
                ))}
            </div>
          )}

          {activeTab === "strengths" && (
            <div className="student-testlab-report-panel student-testlab-report-strengths">
              <div>
                <h4>Strengths</h4>
                {strengths.length ? (
                  strengths.map((entry) => <BreakdownRow key={entry.key} {...entry} />)
                ) : (
                  <p className="student-empty-state">Nothing above {STRENGTH_THRESHOLD}% yet -- keep practicing.</p>
                )}
              </div>
              <div>
                <h4>Gaps</h4>
                {gaps.length ? (
                  gaps.map((entry) => <BreakdownRow key={entry.key} {...entry} />)
                ) : (
                  <p className="student-empty-state">No gaps below {STRENGTH_THRESHOLD}% -- great spread!</p>
                )}
              </div>
            </div>
          )}

          <div className="student-testlab-report-actions">
            <button type="button" className="student-testlab-generate-button" onClick={() => setShowDetailedReport(true)}>
              View Detailed Report
            </button>
            <div className="student-testlab-report-actions-row">
              <button type="button" className="student-testlab-report-secondary" onClick={() => navigate("/test-lab")}>
                Retry Test
              </button>
              <button type="button" className="student-testlab-report-secondary" onClick={() => navigate("/dashboard")}>
                Finish
              </button>
            </div>
          </div>
        </div>
      )}

      {showDetailedReport && result && (
        <div className="modal-backdrop" onClick={() => setShowDetailedReport(false)}>
          <div className="modal-panel is-wide" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="close-button"
              aria-label="Close"
              onClick={() => setShowDetailedReport(false)}
            >
              &times;
            </button>
            <h3>Detailed Report</h3>
            <section className="student-testlab-review">
              {result.items.map((item, index) => (
                <article
                  key={item.displayOrder}
                  className={`student-testlab-review-item ${
                    item.isCorrect ? "is-correct" : item.isCorrect === false ? "is-incorrect" : "is-unattempted"
                  }`}
                >
                  <header>
                    <span>Q{index + 1}</span>
                    <span className="student-testlab-review-source">{SOURCE_TYPE_LABEL[item.sourceType]}</span>
                  </header>
                  <p className="student-testlab-question-text">
                    {item.question}
                    <MathPreview text={item.question} />
                  </p>
                  <p>
                    <strong>Your answer: </strong>
                    {item.studentAnswer || "No answer given."}
                  </p>
                  {item.correctAnswer && (
                    <p>
                      <strong>Correct answer: </strong>
                      {item.correctAnswer}
                    </p>
                  )}
                  {item.aiFeedback && <p className="student-testlab-review-feedback">{item.aiFeedback}</p>}
                </article>
              ))}
            </section>
          </div>
        </div>
      )}
    </StudentPageShell>
  );
};
