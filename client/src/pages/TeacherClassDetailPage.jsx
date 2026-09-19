import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { TeacherIcon } from "../components/TeacherIcon";
import {
  getTeacherBatchActivity,
  getTeacherBatchInsights,
  getTeacherBatches,
  getTeacherBatchStudents,
  regenerateTeacherBatchCode,
  removeTeacherBatchStudent,
} from "../api/client";

const TABS = [
  { id: "Overview", icon: "grid" },
  { id: "Students", icon: "people" },
  { id: "Learning Insights", icon: "book" },
  { id: "Activity", icon: "bolt" },
];

const ACTIVITY_PREVIEW_COUNT = 3;

const SUBJECT_TAGLINES = {
  English: "Explore. Express. Excel.",
  Mathematics: "Practice. Persist. Progress.",
  Science: "Question. Explore. Discover.",
};

const initials = (name) =>
  String(name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

const ACTIVITY_META = {
  joined: { icon: "person-add", tone: "green", verb: "joined the class" },
  practice_completed: { icon: "document", tone: "purple", verb: "completed a practice session" },
  testlab_completed: { icon: "star", tone: "amber", verb: "completed a TestLab attempt" },
};

export const TeacherClassDetailPage = () => {
  const { batchId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("Overview");
  const [batch, setBatch] = useState(null);
  const [students, setStudents] = useState([]);
  const [insights, setInsights] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [copied, setCopied] = useState(false);
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const [activityExpanded, setActivityExpanded] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [batchesResult, studentsResult, insightsResult, activityResult] = await Promise.all([
        getTeacherBatches(),
        getTeacherBatchStudents(batchId),
        getTeacherBatchInsights(batchId),
        getTeacherBatchActivity(batchId),
      ]);
      const matchedBatch = (batchesResult?.batches || []).find((item) => String(item.id) === String(batchId));
      setBatch(matchedBatch || null);
      setStudents(studentsResult?.students || []);
      setInsights(insightsResult || null);
      setActivity(activityResult?.activity || []);
    } catch (loadError) {
      setError(loadError.message || "Failed to load this class.");
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(batch.joinCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard permission denied -- the code is still visible.
    }
  };

  const handleRegenerateCode = async () => {
    setBusy(true);
    setError("");
    try {
      await regenerateTeacherBatchCode(batchId);
      setNotice("New join code generated. The old code no longer works.");
      await loadData();
    } catch (regenerateError) {
      setError(regenerateError.message || "Failed to generate a new code.");
    } finally {
      setBusy(false);
    }
  };

  const confirmRemoveStudent = async () => {
    if (!removeTarget) return;
    setBusy(true);
    setError("");
    try {
      await removeTeacherBatchStudent(batchId, removeTarget.id);
      setNotice(`Removed ${removeTarget.name} from this class.`);
      setRemoveTarget(null);
      await loadData();
    } catch (removeError) {
      setError(removeError.message || "Failed to remove student.");
    } finally {
      setBusy(false);
    }
  };

  const recentJoins = [...students].sort((a, b) => new Date(b.joinedAt) - new Date(a.joinedAt)).slice(0, 3);

  return (
    <div className="teacher-page">
      <div className="teacher-detail-header">
        <div>
          <button type="button" className="teacher-back-link" onClick={() => navigate("/teacher/classes")}>
            &larr; My Classes
          </button>
          <h1>{batch ? `${batch.className}-${batch.sectionName}` : "Class"}</h1>
          {batch && <p style={{ margin: "2px 0 6px" }}>{batch.subjectName}</p>}
          {batch && <p style={{ margin: 0, fontStyle: "italic", color: "var(--tblue)" }}>{SUBJECT_TAGLINES[batch.subjectName] || "Learn. Practice. Grow."}</p>}

          {batch && (
            <div className="teacher-stat-badges">
              <div className="teacher-stat-badge">
                <span className="teacher-stat-badge-icon">
                  <TeacherIcon type="person" />
                </span>
                <div className="teacher-stat-badge-text">
                  <strong>{students.length} Student{students.length === 1 ? "" : "s"}</strong>
                  <span>Enrolled</span>
                </div>
              </div>
              <div className="teacher-stat-badges-divider" />
              <div className="teacher-stat-badge">
                <span className="teacher-stat-badge-icon tone-green">
                  <TeacherIcon type="book" />
                </span>
                <div className="teacher-stat-badge-text">
                  <strong>{batch.subjectName}</strong>
                  <span>Subject</span>
                </div>
              </div>
              <div className="teacher-stat-badges-divider" />
              <div className="teacher-stat-badge">
                <span className="teacher-stat-badge-icon">
                  <TeacherIcon type="building" />
                </span>
                <div className="teacher-stat-badge-text">
                  <strong>{batch.institutionName}</strong>
                  <span>Institution</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {batch && (
          <div className="teacher-header-illustration">
            <span className="teacher-header-illustration-bar tone-1">Read</span>
            <span className="teacher-header-illustration-bar tone-2">Write</span>
            <span className="teacher-header-illustration-bar tone-3">Think</span>
            <span className="teacher-header-illustration-bar tone-4">Grow</span>
          </div>
        )}

        {batch && (
          <div className="teacher-joincode-card">
            <div className="teacher-joincode-card-head">
              <span>Join Code</span>
              <button type="button" className="teacher-howitworks-link" onClick={() => setHowItWorksOpen(true)}>
                <TeacherIcon type="help-circle" /> How it works?
              </button>
            </div>
            <div className="teacher-joincode-card-row">
              <span className="teacher-join-code">{batch.joinCode}</span>
              <button type="button" className="teacher-joincode-icon-button" title="Copy code" onClick={handleCopyCode}>
                <TeacherIcon type="copy" />
              </button>
            </div>
            <button type="button" className="teacher-regenerate-button" disabled={busy} onClick={handleRegenerateCode}>
              <TeacherIcon type="refresh" style={{ width: 16, height: 16 }} />
              {copied ? "Copied!" : "Regenerate code"}
            </button>
            {notice && <p className="teacher-joincode-notice">{notice}</p>}
          </div>
        )}
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="teacher-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`teacher-tab ${activeTab === tab.id ? "is-active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <TeacherIcon type={tab.icon} />
            {tab.id}
          </button>
        ))}
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : activeTab === "Overview" ? (
        <div className="admin-panel">
          <div className="admin-panel-head">
            <h2>Class Progress</h2>
          </div>
          <div style={{ display: "flex", gap: "32px", flexWrap: "wrap", alignItems: "center" }}>
            <div className="teacher-donut-wrap">
              <div className="teacher-donut" style={{ "--pct": insights?.overallProgress ?? 0 }}>
                <span>{insights?.overallProgress ?? 0}%</span>
              </div>
              <span className="teacher-donut-label">Overall progress</span>
            </div>
            <div className="teacher-metric-list" style={{ flex: 1, minWidth: 240 }}>
              <div className="teacher-metric-row">
                <span>Concept mastery</span>
                <div className="teacher-progress-track">
                  <div className="teacher-progress-fill" style={{ width: `${insights?.conceptMastery ?? 0}%` }} />
                </div>
                <span>{insights?.conceptMastery ?? 0}%</span>
              </div>
              <div className="teacher-metric-row">
                <span>Practice consistency</span>
                <div className="teacher-progress-track">
                  <div className="teacher-progress-fill" style={{ width: `${insights?.practiceConsistency ?? 0}%` }} />
                </div>
                <span>{insights?.practiceConsistency ?? 0}%</span>
              </div>
              <div className="teacher-metric-row">
                <span>Students needing support</span>
                <div className="teacher-progress-track">
                  <div
                    className="teacher-progress-fill"
                    style={{
                      width: students.length ? `${(insights?.studentsNeedingSupport / students.length) * 100}%` : "0%",
                    }}
                  />
                </div>
                <span>{insights?.studentsNeedingSupport ?? 0}</span>
              </div>
            </div>
          </div>

          <div className="admin-panel-head" style={{ marginTop: "18px" }}>
            <h2>Needs Your Attention</h2>
          </div>
          {!insights?.needsAttention?.length ? (
            <p>No students currently flagged -- nice work!</p>
          ) : (
            <div className="teacher-card-list">
              {insights.needsAttention.map((row) => (
                <div key={row.studentId} className="teacher-flag-row">
                  <div className="teacher-flag-main">
                    <span className="teacher-flag-dot tone-red">{row.weakConceptCount}</span>
                    <span>{row.studentName}</span>
                    <span className="teacher-flag-topic">{row.topic}</span>
                  </div>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => navigate(`/teacher/classes/${batchId}/students/${row.studentId}`)}
                  >
                    View
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : activeTab === "Students" ? (
        <div className="admin-bulk-pipeline-grid-shell">
          {students.length === 0 ? (
            <div className="admin-bulk-pipeline-empty">No students have joined yet. Share this class&apos;s join code.</div>
          ) : (
            <table className="admin-exam-types-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Joined</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id}>
                    <td>{student.name}</td>
                    <td>{student.email}</td>
                    <td>{student.joinedAt ? new Date(student.joinedAt).toLocaleDateString() : "-"}</td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => navigate(`/teacher/classes/${batchId}/students/${student.id}`)}
                        >
                          Insight
                        </button>
                        <button
                          type="button"
                          className="ghost-button admin-pipeline-runs-danger"
                          onClick={() => setRemoveTarget(student)}
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : activeTab === "Learning Insights" ? (
        <div className="admin-panel">
          <div className="admin-panel-head">
            <h2>Concepts needing attention</h2>
            <span>Every student currently flagged &quot;Needs Practice&quot; on a concept in this subject</span>
          </div>
          {!insights?.needsAttention?.length ? (
            <p>No learning gaps flagged for this class right now.</p>
          ) : (
            <div className="teacher-card-list">
              {insights.needsAttention.map((row) => (
                <div key={row.studentId} className="teacher-flag-row">
                  <div className="teacher-flag-main">
                    <span className="teacher-flag-dot tone-amber">{row.weakConceptCount}</span>
                    <span>{row.studentName}</span>
                    <span className="teacher-flag-topic">Weakest: {row.topic}</span>
                  </div>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => navigate(`/teacher/classes/${batchId}/students/${row.studentId}`)}
                  >
                    View
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="teacher-activity-layout">
          <div className="admin-panel">
            <div className="admin-panel-head">
              <h2>Recent Activity</h2>
              <span>Live updates from your class</span>
            </div>
            {activity.length === 0 ? (
              <p>No activity yet -- once students start practicing, it&apos;ll show up here.</p>
            ) : (
              <>
                <div className="teacher-activity-list">
                  {(activityExpanded ? activity : activity.slice(0, ACTIVITY_PREVIEW_COUNT)).map((row, index) => {
                    const meta = ACTIVITY_META[row.eventType] || ACTIVITY_META.joined;
                    return (
                      <button
                        key={index}
                        type="button"
                        className="teacher-activity-row is-clickable"
                        onClick={() => row.userId && navigate(`/teacher/classes/${batchId}/students/${row.userId}`)}
                      >
                        <span className={`teacher-activity-icon tone-${meta.tone}`}>
                          <TeacherIcon type={meta.icon} />
                        </span>
                        <div className="teacher-activity-main">
                          <span style={{ color: "var(--text)" }}>
                            <strong>{row.studentName}</strong>{" "}
                            {row.eventType === "testlab_completed" && row.maxScore
                              ? `scored ${row.score}/${row.maxScore} in a TestLab attempt`
                              : meta.verb}
                          </span>
                          {row.topic && <span>Topic: {row.topic}</span>}
                        </div>
                        <span className="teacher-activity-time">
                          {row.eventTime ? new Date(row.eventTime).toLocaleString() : "-"}
                        </span>
                        <TeacherIcon type="chevron-right" className="teacher-activity-chevron" />
                      </button>
                    );
                  })}
                </div>
                {activity.length > ACTIVITY_PREVIEW_COUNT && (
                  <button type="button" className="ghost-button" style={{ width: "100%", marginTop: "10px" }} onClick={() => setActivityExpanded((current) => !current)}>
                    {activityExpanded ? "Show less" : "View all activity"} {!activityExpanded && "→"}
                  </button>
                )}
              </>
            )}
          </div>

          <div style={{ display: "grid", gap: "16px" }}>
            <div className="teacher-side-card tone-green">
              <div className="teacher-side-card-head">
                <TeacherIcon type="chart" style={{ width: 18, height: 18 }} />
                Most recently joined students
              </div>
              {recentJoins.length === 0 ? (
                <p style={{ margin: 0, color: "var(--muted)" }}>No students yet.</p>
              ) : (
                recentJoins.map((student) => (
                  <div key={student.id} className="teacher-recent-join-row">
                    <span className="teacher-recent-join-avatar">{initials(student.name)}</span>
                    <div className="teacher-recent-join-info">
                      <strong>{student.name}</strong>
                      <span>Joined on {new Date(student.joinedAt).toLocaleDateString()}</span>
                    </div>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => navigate(`/teacher/classes/${batchId}/students/${student.id}`)}
                    >
                      View Profile
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="teacher-side-card tone-blue">
              <div className="teacher-side-card-head">
                <TeacherIcon type="bulb" style={{ width: 18, height: 18 }} />
                Keep your class engaged!
              </div>
              <ul className="teacher-tip-list">
                <li>
                  <TeacherIcon type="check" /> Share interesting practice tasks
                </li>
                <li>
                  <TeacherIcon type="check" /> Assign a short quiz
                </li>
                <li>
                  <TeacherIcon type="check" /> Celebrate student progress
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="teacher-quote-banner">
        &ldquo;A classroom is a community of curious minds.&rdquo;
        <cite>&mdash; Kuhedu</cite>
      </div>

      {howItWorksOpen && (
        <div className="modal-backdrop" onClick={() => setHowItWorksOpen(false)}>
          <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="close-button" aria-label="Close" onClick={() => setHowItWorksOpen(false)}>
              &times;
            </button>
            <h2>How the join code works</h2>
            <p>Share this code with your students however you like -- write it on the board, message it, or read it aloud.</p>
            <p>
              Each student enters it once from their own profile. It links their account to this class, so their
              practice and test activity shows up here.
            </p>
            <p>
              If a code leaks or you want to stop new students from joining with it, use <strong>Regenerate code</strong> --
              the old code stops working immediately, but no one already in the class is removed.
            </p>
          </div>
        </div>
      )}

      {removeTarget && (
        <div className="modal-backdrop" onClick={() => !busy && setRemoveTarget(null)}>
          <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="close-button" aria-label="Close" onClick={() => setRemoveTarget(null)} disabled={busy}>
              &times;
            </button>
            <h2>Remove Student</h2>
            <p>
              Remove <strong>{removeTarget.name}</strong> from this class? They can rejoin later with the same join
              code.
            </p>
            <div className="admin-bulk-pipeline-dialog-actions">
              <button type="button" className="ghost-button" onClick={() => setRemoveTarget(null)} disabled={busy}>
                Cancel
              </button>
              <button type="button" className="ghost-button admin-pipeline-runs-danger" onClick={confirmRemoveStudent} disabled={busy}>
                {busy ? "Removing..." : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
