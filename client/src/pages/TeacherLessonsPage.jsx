import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getTeacherBatches,
  getTeacherLessonPlanDashboard,
  getTeacherLessonPlans,
  getTeacherLessonPlansSharedWithMe,
  getTeacherMasterLessonPlans,
  getTeacherMasterLessonPlansSharedWithMe,
} from "../api/client";

const STATUS_FILTERS = ["All", "Draft", "Completed"];

// "Completed" here is just this table's display label for the plan's real
// `published` status (matching the reference dashboard's wording) -- there
// is no third "in progress" state in the data model, so it isn't shown as
// one; a plan is either a draft or it's been published.
const statusLabel = (status) => (status === "published" ? "Completed" : "Draft");

export const TeacherLessonsPage = () => {
  const navigate = useNavigate();
  const [batches, setBatches] = useState([]);
  const [plans, setPlans] = useState([]);
  const [masterPlans, setMasterPlans] = useState([]);
  const [sharedPlans, setSharedPlans] = useState([]);
  const [sharedMasterPlans, setSharedMasterPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState("mine"); // "mine" | "shared"
  const [statusFilter, setStatusFilter] = useState("All");

  const [progressBatchId, setProgressBatchId] = useState("");
  const [curriculumProgress, setCurriculumProgress] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [plansResult, sharedResult, masterPlansResult, sharedMasterResult] = await Promise.all([
        getTeacherLessonPlans(),
        getTeacherLessonPlansSharedWithMe(),
        getTeacherMasterLessonPlans(),
        getTeacherMasterLessonPlansSharedWithMe(),
      ]);
      setPlans(plansResult?.plans || []);
      setSharedPlans(sharedResult?.shares || []);
      setMasterPlans(masterPlansResult?.plans || []);
      setSharedMasterPlans(sharedMasterResult?.shares || []);
    } catch (loadError) {
      setError(loadError.message || "Failed to load lesson plans.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    getTeacherBatches().then((result) => {
      const list = result?.batches || [];
      setBatches(list);
      setProgressBatchId((current) => current || list[0]?.id || "");
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setStatsLoading(true);
    getTeacherLessonPlanDashboard(progressBatchId || undefined)
      .then((result) => {
        setCurriculumProgress(result?.curriculumProgress || null);
      })
      .catch(() => {
        setCurriculumProgress(null);
      })
      .finally(() => setStatsLoading(false));
  }, [progressBatchId]);

  const filteredPlans = useMemo(
    () =>
      plans.filter((plan) => {
        if (statusFilter === "Draft") return plan.status === "draft";
        if (statusFilter === "Completed") return plan.status === "published";
        return true;
      }),
    [plans, statusFilter]
  );

  // Master Lesson Plans have no draft/published status (they're a single
  // chapter-level record, not a workflow), so they only show up under the
  // "All" filter -- the Draft/Completed tabs are meaningless for them.
  const inventoryItems = useMemo(() => {
    const dailyItems = filteredPlans.map((plan) => ({ ...plan, planType: "daily" }));
    if (statusFilter !== "All") return dailyItems;
    const masterItems = masterPlans.map((plan) => ({ ...plan, planType: "master" }));
    return [...masterItems, ...dailyItems];
  }, [filteredPlans, masterPlans, statusFilter]);

  const sharedInventoryItems = useMemo(
    () => [
      ...sharedMasterPlans.map((share) => ({ ...share, planType: "master" })),
      ...sharedPlans.map((share) => ({ ...share, planType: "daily" })),
    ],
    [sharedPlans, sharedMasterPlans]
  );

  const progressBatch = batches.find((batch) => String(batch.id) === String(progressBatchId));
  const progressTotal = curriculumProgress?.totalChapters || 0;
  const progressPercent = progressTotal ? Math.round(((curriculumProgress.completed || 0) / progressTotal) * 100) : 0;

  return (
    <div className="teacher-page">
      <div className="teacher-lessons-hero">
        <div>
          <span className="eyebrow">Lesson Planner</span>
          <h1>Plan. Personalise. Teach. Inspire.</h1>
          <p>Create structured, curriculum-aligned lesson plans in minutes -- with the power of AI.</p>
          <div className="teacher-lessons-hero-badges">
            <span>✅ Aligned to your curriculum</span>
            <span>⏱️ Save time, teach better</span>
            <span>✏️ Ready-to-use & editable</span>
          </div>
        </div>
        <div className="teacher-lessons-hero-actions">
          <button type="button" className="ghost-button teacher-lessons-ai-pill" onClick={() => navigate("/teacher/lessons/new")}>
            ✨ AI Assistant
          </button>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="teacher-lessons-layout">
        <div className="teacher-lessons-main">
          <div className="admin-panel">
            <div className="admin-panel-head teacher-lessons-quick-actions-head">
              <h2>Quick Actions</h2>
              <p>Start creating, or manage your existing lesson plans.</p>
            </div>
            <div className="teacher-lessons-quick-actions">
              <div className="teacher-lessons-quick-action tone-red">
                <span className="teacher-lessons-quick-action-icon">🗂️</span>
                <h3>Master Lesson Plan</h3>
                <p>Chapter-level plan: previous knowledge, aids, objectives, methodology</p>
                <button type="button" className="primary-button" onClick={() => navigate("/teacher/lessons/master-plan")}>
                  Generate with AI →
                </button>
              </div>
              <div className="teacher-lessons-quick-action tone-purple">
                <span className="teacher-lessons-quick-action-icon">✨</span>
                <h3>Daily Lesson Plan</h3>
                <p>Generate a complete day-by-day lesson plan in seconds</p>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => navigate("/teacher/lessons/new", { state: { mode: "ai" } })}
                >
                  Generate with AI →
                </button>
              </div>
              <div className="teacher-lessons-quick-action tone-amber">
                <span className="teacher-lessons-quick-action-icon">📚</span>
                <h3>My Lesson Plans</h3>
                <p>View, edit and manage your saved plans</p>
                <button type="button" className="primary-button" onClick={() => setView("mine")}>
                  View My Plans →
                </button>
              </div>
              <div className="teacher-lessons-quick-action tone-green">
                <span className="teacher-lessons-quick-action-icon">🤝</span>
                <h3>Shared with Me</h3>
                <p>Plans your colleagues have shared with you</p>
                <button type="button" className="primary-button" onClick={() => setView("shared")}>
                  View Shared {sharedInventoryItems.length > 0 ? `(${sharedInventoryItems.length})` : ""} →
                </button>
              </div>
            </div>
          </div>

          <div className="admin-panel">
            <div className="admin-panel-head">
              <h2>{view === "shared" ? "Shared with Me" : "My Lesson Plans"}</h2>
            </div>

            {view === "mine" && (
              <div className="teacher-lessons-status-filter">
                {STATUS_FILTERS.map((label) => (
                  <button
                    key={label}
                    type="button"
                    className={`teacher-tab ${statusFilter === label ? "is-active" : ""}`}
                    onClick={() => setStatusFilter(label)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {loading ? (
              <p>Loading...</p>
            ) : view === "shared" ? (
              sharedInventoryItems.length === 0 ? (
                <p>No lesson plans have been shared with you yet.</p>
              ) : (
                <div className="teacher-card-list">
                  {sharedInventoryItems.map((share) =>
                    share.planType === "master" ? (
                      <div
                        key={`master-share-${share.shareId}`}
                        className="teacher-card teacher-lessons-plan-card is-clickable"
                        role="button"
                        tabIndex={0}
                        onClick={() => navigate(`/teacher/lessons/master-plan/shared/${share.shareId}`)}
                        onKeyDown={(e) => e.key === "Enter" && navigate(`/teacher/lessons/master-plan/shared/${share.shareId}`)}
                      >
                        <div className="teacher-card-head">
                          <h3>{share.chapterLabel}</h3>
                          <span className="teacher-lessons-badge-group">
                            <span className="teacher-badge tone-red">Master</span>
                            <span className={`teacher-badge tone-${share.status}`}>{statusLabel(share.status)}</span>
                          </span>
                        </div>
                        <p className="teacher-card-meta">
                          {share.classTransactionTime || "-"} classes &middot; Shared by {share.sharedByName} &middot;{" "}
                          {new Date(share.sharedAt).toLocaleDateString()}
                        </p>
                      </div>
                    ) : (
                      <div
                        key={`daily-share-${share.shareId}`}
                        className="teacher-card teacher-lessons-plan-card is-clickable"
                        role="button"
                        tabIndex={0}
                        onClick={() => navigate(`/teacher/lessons/shared/${share.shareId}`)}
                        onKeyDown={(e) => e.key === "Enter" && navigate(`/teacher/lessons/shared/${share.shareId}`)}
                      >
                        <div className="teacher-card-head">
                          <h3>{share.title}</h3>
                          <span className="teacher-lessons-badge-group">
                            <span className="teacher-badge tone-purple">Daily</span>
                            <span className={`teacher-badge tone-${share.status}`}>{statusLabel(share.status)}</span>
                          </span>
                        </div>
                        <p className="teacher-card-meta">
                          {share.entryCount} lesson{share.entryCount === 1 ? "" : "s"} &middot; Shared by {share.sharedByName}
                          &middot; {new Date(share.sharedAt).toLocaleDateString()}
                        </p>
                      </div>
                    )
                  )}
                </div>
              )
            ) : inventoryItems.length === 0 ? (
              <p>No lesson plans here yet.</p>
            ) : (
              <div className="teacher-card-list">
                {inventoryItems.map((plan) =>
                  plan.planType === "master" ? (
                    <div
                      key={`master-${plan.id}`}
                      className="teacher-card teacher-lessons-plan-card is-clickable"
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate("/teacher/lessons/master-plan", { state: { batchId: plan.batchId, chapterNumber: plan.chapterNumber } })}
                      onKeyDown={(e) =>
                        e.key === "Enter" &&
                        navigate("/teacher/lessons/master-plan", { state: { batchId: plan.batchId, chapterNumber: plan.chapterNumber } })
                      }
                    >
                      <div className="teacher-card-head">
                        <h3>{plan.chapterLabel}</h3>
                        <span className="teacher-lessons-badge-group">
                          <span className="teacher-badge tone-red">Master</span>
                          <span className={`teacher-badge tone-${plan.status}`}>{statusLabel(plan.status)}</span>
                        </span>
                      </div>
                      <p className="teacher-card-meta">
                        {plan.className}-{plan.sectionName} &middot; {plan.subjectName} &middot; {plan.classTransactionTime || "-"} classes &middot; Updated{" "}
                        {new Date(plan.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                  ) : (
                    <div
                      key={`daily-${plan.id}`}
                      className="teacher-card teacher-lessons-plan-card is-clickable"
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(`/teacher/lessons/${plan.id}`)}
                      onKeyDown={(e) => e.key === "Enter" && navigate(`/teacher/lessons/${plan.id}`)}
                    >
                      <div className="teacher-card-head">
                        <h3>{plan.title}</h3>
                        <span className="teacher-lessons-badge-group">
                          <span className="teacher-badge tone-purple">Daily</span>
                          <span className={`teacher-badge tone-${plan.status}`}>{statusLabel(plan.status)}</span>
                        </span>
                      </div>
                      <p className="teacher-card-meta">
                        {plan.className}-{plan.sectionName} &middot; {plan.subjectName} &middot; {plan.entryCount} lesson
                        {plan.entryCount === 1 ? "" : "s"} &middot; Updated {new Date(plan.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </div>

        <div className="teacher-lessons-sidebar">
          <div className="teacher-lessons-widget tone-green">
            <div className="teacher-lessons-widget-head">
              <h3>Curriculum Progress</h3>
              {batches.length > 0 && (
                <select value={progressBatchId} onChange={(e) => setProgressBatchId(e.target.value)}>
                  {batches.map((batch) => (
                    <option key={batch.id} value={batch.id}>
                      {batch.className}-{batch.sectionName} · {batch.subjectName}
                    </option>
                  ))}
                </select>
              )}
            </div>
            {batches.length === 0 ? (
              <p>No classes assigned yet.</p>
            ) : statsLoading ? (
              <p>Loading…</p>
            ) : (
              <>
                <div className="teacher-progress-track">
                  <div className="teacher-progress-fill" style={{ width: `${progressPercent}%` }} />
                </div>
                <p className="teacher-lessons-progress-caption">
                  {curriculumProgress?.completed || 0} / {progressTotal} chapters planned
                  {progressBatch ? ` · ${progressBatch.className} - ${progressBatch.subjectName}` : ""}
                </p>
                <div className="teacher-lessons-progress-legend">
                  <span className="tone-green">● Completed {curriculumProgress?.completed || 0}</span>
                  <span className="tone-blue">● In Progress {curriculumProgress?.inProgress || 0}</span>
                  <span className="tone-muted">● Not Started {curriculumProgress?.notStarted || 0}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
