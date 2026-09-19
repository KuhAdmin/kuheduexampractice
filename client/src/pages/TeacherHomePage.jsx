import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/authHooks";
import { getTeacherHome } from "../api/client";

const firstName = (name) => (name ? name.trim().split(/\s+/)[0] : "Teacher");

export const TeacherHomePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedBatchId, setCopiedBatchId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getTeacherHome()
      .then((result) => {
        if (!cancelled) setSummary(result);
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError.message || "Failed to load your dashboard.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const batches = summary?.batches || [];

  const copyCode = async (batch) => {
    try {
      await navigator.clipboard.writeText(batch.joinCode);
      setCopiedBatchId(batch.id);
      setTimeout(() => setCopiedBatchId((current) => (current === batch.id ? null : current)), 1500);
    } catch {
      // Clipboard permission denied -- the code is still visible on the card.
    }
  };

  return (
    <div className="teacher-page">
      <div className="teacher-page-header">
        <div>
          <span className="eyebrow">Teacher dashboard</span>
          <h2>Good morning, {firstName(user?.name)}! 👋</h2>
        </div>
      </div>

      <div className="teacher-greeting-banner">
        <div>
          <strong>Great teachers change tomorrow.</strong>
          <p>Here&apos;s what needs your attention today.</p>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="teacher-stat-grid">
        <div className="teacher-stat-tile tone-blue">
          <strong>{loading ? "—" : summary?.batchCount ?? 0}</strong>
          <span>Classes</span>
        </div>
        <div className="teacher-stat-tile tone-green">
          <strong>{loading ? "—" : summary?.studentCount ?? 0}</strong>
          <span>Students</span>
        </div>
        <div className="teacher-stat-tile tone-red">
          <strong>{loading ? "—" : summary?.needsSupportCount ?? 0}</strong>
          <span>Need Help</span>
        </div>
        <div className="teacher-stat-tile tone-purple">
          <strong>{loading ? "—" : summary?.pendingGradingCount ?? 0}</strong>
          <span>Pending Grading</span>
        </div>
      </div>

      <div className="admin-panel">
        <div className="admin-panel-head">
          <h2>My Classes</h2>
          <button type="button" className="ghost-button" onClick={() => navigate("/teacher/classes")}>
            View all &rarr;
          </button>
        </div>

        {loading ? (
          <p>Loading classes...</p>
        ) : batches.length === 0 ? (
          <p>
            You don&apos;t have any classes yet. Ask your school admin to assign you to a class section and
            subject &mdash; a class and join code are created automatically.
          </p>
        ) : (
          <div className="teacher-card-list">
            {batches.slice(0, 3).map((batch) => (
              <div key={batch.id} className="teacher-card">
                <div className="teacher-card-head">
                  <h3>
                    {batch.className}-{batch.sectionName}
                  </h3>
                  <span>{batch.subjectName}</span>
                </div>
                <div className="teacher-progress-row">
                  <span>{batch.studentCount} students</span>
                  <div className="teacher-progress-track">
                    <div className="teacher-progress-fill" style={{ width: `${batch.overallProgress}%` }} />
                  </div>
                  <span>{batch.overallProgress}%</span>
                </div>
                {batch.studentsNeedingSupport > 0 && (
                  <p className="teacher-alert-line">
                    {batch.studentsNeedingSupport} student{batch.studentsNeedingSupport === 1 ? "" : "s"} need additional
                    support
                  </p>
                )}
                <div className="teacher-card-row">
                  <div className="teacher-join-code-row">
                    <span className="teacher-card-meta">Join Code:</span>
                    <span className="teacher-join-code">{batch.joinCode}</span>
                    <button type="button" className="ghost-button" onClick={() => copyCode(batch)}>
                      {copiedBatchId === batch.id ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <button type="button" className="primary-button" onClick={() => navigate(`/teacher/classes/${batch.id}`)}>
                    View Class &rarr;
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
