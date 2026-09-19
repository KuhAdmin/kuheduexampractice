import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getTeacherBatches } from "../api/client";

export const TeacherClassesPage = () => {
  const navigate = useNavigate();
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedBatchId, setCopiedBatchId] = useState(null);

  const loadBatches = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getTeacherBatches();
      setBatches(result?.batches || []);
    } catch (loadError) {
      setError(loadError.message || "Failed to load classes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

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
          <span className="eyebrow">Teacher module</span>
          <h1>My Classes</h1>
          <p>
            One class is created automatically for every class section and subject your school admin assigns you
            to. Share a class&apos;s code with students so they can join.
          </p>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      {loading ? (
        <p>Loading classes...</p>
      ) : batches.length === 0 ? (
        <div className="admin-panel">
          <p>No classes yet. Ask your school admin to assign you to a class section and subject.</p>
        </div>
      ) : (
        <div className="teacher-card-list">
          {batches.map((batch) => (
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
  );
};
