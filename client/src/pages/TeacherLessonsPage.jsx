import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createTeacherLessonPlan, getTeacherBatches, getTeacherLessonPlans } from "../api/client";

const TABS = ["All Lessons", "Drafts", "Published"];

export const TeacherLessonsPage = () => {
  const navigate = useNavigate();
  const [batches, setBatches] = useState([]);
  const [batchId, setBatchId] = useState("");
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("All Lessons");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ batchId: "", title: "", startDate: "", endDate: "" });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getTeacherLessonPlans(batchId || undefined);
      setPlans(result?.plans || []);
    } catch (loadError) {
      setError(loadError.message || "Failed to load lesson plans.");
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    getTeacherBatches().then((result) => setBatches(result?.batches || []));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = plans.filter((plan) => {
    if (activeTab === "Drafts") return plan.status === "draft";
    if (activeTab === "Published") return plan.status === "published";
    return true;
  });

  const handleCreate = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const created = await createTeacherLessonPlan(form);
      setCreateOpen(false);
      navigate(`/teacher/lessons/${created.plan.id}`);
    } catch (createError) {
      setError(createError.message || "Failed to create lesson plan.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="teacher-page">
      <div className="teacher-page-header">
        <div>
          <span className="eyebrow">Teacher module</span>
          <h1>Lessons</h1>
          <p>Plan and organize your teaching.</p>
        </div>
        <button type="button" className="primary-button" onClick={() => setCreateOpen(true)}>
          + New Lesson Plan
        </button>
      </div>

      <div className="admin-studio-form-grid">
        <label className="admin-studio-field">
          <span>Class</span>
          <select value={batchId} onChange={(e) => setBatchId(e.target.value)}>
            <option value="">All classes</option>
            {batches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.className}-{batch.sectionName} &middot; {batch.subjectName}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="teacher-tabs">
        {TABS.map((tab) => (
          <button key={tab} type="button" className={`teacher-tab ${activeTab === tab ? "is-active" : ""}`} onClick={() => setActiveTab(tab)}>
            {tab}
          </button>
        ))}
      </div>

      {error && <p className="error-text">{error}</p>}

      {loading ? (
        <p>Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="admin-panel">
          <p>No lesson plans here yet.</p>
        </div>
      ) : (
        <div className="teacher-card-list">
          {filtered.map((plan) => (
            <div key={plan.id} className="teacher-card">
              <div className="teacher-card-head">
                <h3>{plan.title}</h3>
                <span className={`teacher-badge tone-${plan.status}`}>{plan.status}</span>
              </div>
              <p className="teacher-card-meta">
                {plan.className}-{plan.sectionName} &middot; {plan.subjectName}
              </p>
              <p className="teacher-card-meta">
                {plan.startDate ? new Date(plan.startDate).toLocaleDateString() : "-"} &ndash;{" "}
                {plan.endDate ? new Date(plan.endDate).toLocaleDateString() : "-"} &middot; {plan.entryCount} lesson
                {plan.entryCount === 1 ? "" : "s"}
              </p>
              <div className="teacher-card-row">
                <span />
                <button type="button" className="primary-button" onClick={() => navigate(`/teacher/lessons/${plan.id}`)}>
                  Open
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {createOpen && (
        <div className="modal-backdrop" onClick={() => !submitting && setCreateOpen(false)}>
          <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="close-button" onClick={() => setCreateOpen(false)} disabled={submitting}>
              &times;
            </button>
            <h2>New Lesson Plan</h2>
            <form className="admin-exam-types-form" onSubmit={handleCreate}>
              <label className="admin-studio-field">
                <span>Class</span>
                <select value={form.batchId} onChange={(e) => setForm((c) => ({ ...c, batchId: e.target.value }))} required>
                  <option value="">Select a class...</option>
                  {batches.map((batch) => (
                    <option key={batch.id} value={batch.id}>
                      {batch.className}-{batch.sectionName} &middot; {batch.subjectName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="admin-studio-field">
                <span>Title</span>
                <input value={form.title} onChange={(e) => setForm((c) => ({ ...c, title: e.target.value }))} required />
              </label>
              <label className="admin-studio-field">
                <span>Start date</span>
                <input type="date" value={form.startDate} onChange={(e) => setForm((c) => ({ ...c, startDate: e.target.value }))} />
              </label>
              <label className="admin-studio-field">
                <span>End date</span>
                <input type="date" value={form.endDate} onChange={(e) => setForm((c) => ({ ...c, endDate: e.target.value }))} />
              </label>
              <div className="admin-bulk-pipeline-dialog-actions">
                <button type="button" className="ghost-button" onClick={() => setCreateOpen(false)} disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" className="primary-button" disabled={submitting}>
                  {submitting ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
