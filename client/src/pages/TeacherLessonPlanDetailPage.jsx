import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  addTeacherLessonPlanEntry,
  deleteTeacherLessonPlanEntry,
  downloadTeacherLessonPlanPdf,
  getTeacherLessonPlanDetail,
  publishTeacherLessonPlan,
  updateTeacherLessonPlanEntry,
} from "../api/client";

const emptyEntry = { entryDate: "", topic: "", learningObjectives: "", activities: "", resources: "", homework: "", assessmentNotes: "" };

export const TeacherLessonPlanDetailPage = () => {
  const { planId } = useParams();
  const navigate = useNavigate();
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [form, setForm] = useState(emptyEntry);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setPlan(await getTeacherLessonPlanDetail(planId));
    } catch (loadError) {
      setError(loadError.message || "Failed to load this lesson plan.");
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    load();
  }, [load]);

  const openAddForm = () => {
    setEditingEntryId(null);
    setForm(emptyEntry);
    setFormOpen(true);
  };

  const openEditForm = (entry) => {
    setEditingEntryId(entry.id);
    setForm({ ...emptyEntry, ...entry });
    setFormOpen(true);
  };

  const handleSubmitEntry = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      if (editingEntryId) {
        await updateTeacherLessonPlanEntry(planId, editingEntryId, form);
      } else {
        await addTeacherLessonPlanEntry(planId, form);
      }
      setFormOpen(false);
      await load();
    } catch (submitError) {
      setError(submitError.message || "Failed to save entry.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEntry = async (entryId) => {
    try {
      await deleteTeacherLessonPlanEntry(planId, entryId);
      await load();
    } catch (deleteError) {
      setError(deleteError.message || "Failed to delete entry.");
    }
  };

  const handlePublish = async () => {
    try {
      await publishTeacherLessonPlan(planId);
      setNotice("Lesson plan published.");
      await load();
    } catch (publishError) {
      setError(publishError.message || "Failed to publish.");
    }
  };

  if (loading) {
    return (
      <div className="teacher-page">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="teacher-page">
      <div className="teacher-page-header">
        <div>
          <button type="button" className="teacher-back-link" onClick={() => navigate("/teacher/lessons")}>
            &larr; Lessons
          </button>
          <h1>{plan?.title}</h1>
        </div>
        <div>
          <span className={`teacher-badge tone-${plan?.status}`}>{plan?.status}</span>
          {plan?.status === "draft" && (
            <button type="button" className="ghost-button" onClick={handlePublish}>
              Publish
            </button>
          )}
          <button type="button" className="ghost-button" onClick={() => downloadTeacherLessonPlanPdf(planId, `${plan.title}.pdf`)}>
            Download PDF
          </button>
          <button type="button" className="primary-button" onClick={openAddForm}>
            + Add Day
          </button>
        </div>
      </div>

      {notice && <div className="admin-bulk-pipeline-concurrency">{notice}</div>}
      {error && <p className="error-text">{error}</p>}

      {plan?.entries.length === 0 ? (
        <div className="admin-panel">
          <p>No lessons added yet -- add your first day.</p>
        </div>
      ) : (
        <div className="teacher-card-list">
          {plan?.entries.map((entry, index) => (
            <div key={entry.id} className="admin-panel">
              <div className="admin-panel-head">
                <h2>
                  Day {index + 1}
                  {entry.entryDate ? ` – ${new Date(entry.entryDate).toLocaleDateString()}` : ""}: {entry.topic}
                </h2>
                <div>
                  <button type="button" className="ghost-button" onClick={() => openEditForm(entry)}>
                    Edit
                  </button>
                  <button type="button" className="ghost-button admin-pipeline-runs-danger" onClick={() => handleDeleteEntry(entry.id)}>
                    Delete
                  </button>
                </div>
              </div>
              <div className="teacher-lesson-grid">
                <div className="teacher-lesson-field">
                  <span>Learning Objectives</span>
                  <p>{entry.learningObjectives || "-"}</p>
                </div>
                <div className="teacher-lesson-field">
                  <span>Homework</span>
                  <p>{entry.homework || "-"}</p>
                </div>
                <div className="teacher-lesson-field">
                  <span>Activities</span>
                  <p>{entry.activities || "-"}</p>
                </div>
                <div className="teacher-lesson-field">
                  <span>Assessment Notes</span>
                  <p>{entry.assessmentNotes || "-"}</p>
                </div>
              </div>
              {entry.resources && (
                <div className="teacher-lesson-field">
                  <span>Resources</span>
                  <p>{entry.resources}</p>
                </div>
              )}
              <div className="teacher-callout">
                <span>Related Practice: build a question-bank test for this class</span>
                <button type="button" className="ghost-button" onClick={() => navigate("/teacher/tests/new", { state: { batchId: plan.batchId } })}>
                  Assign Practice
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {formOpen && (
        <div className="modal-backdrop" onClick={() => !submitting && setFormOpen(false)}>
          <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="close-button" onClick={() => setFormOpen(false)} disabled={submitting}>
              &times;
            </button>
            <h2>{editingEntryId ? "Edit Day" : "Add Day"}</h2>
            <form className="admin-exam-types-form" onSubmit={handleSubmitEntry}>
              <label className="admin-studio-field">
                <span>Date</span>
                <input type="date" value={form.entryDate || ""} onChange={(e) => setForm((c) => ({ ...c, entryDate: e.target.value }))} />
              </label>
              <label className="admin-studio-field">
                <span>Topic</span>
                <input value={form.topic} onChange={(e) => setForm((c) => ({ ...c, topic: e.target.value }))} required />
              </label>
              <label className="admin-studio-field">
                <span>Learning Objectives</span>
                <textarea rows={2} value={form.learningObjectives || ""} onChange={(e) => setForm((c) => ({ ...c, learningObjectives: e.target.value }))} />
              </label>
              <label className="admin-studio-field">
                <span>Activities</span>
                <textarea rows={2} value={form.activities || ""} onChange={(e) => setForm((c) => ({ ...c, activities: e.target.value }))} />
              </label>
              <label className="admin-studio-field">
                <span>Resources</span>
                <input value={form.resources || ""} onChange={(e) => setForm((c) => ({ ...c, resources: e.target.value }))} />
              </label>
              <label className="admin-studio-field">
                <span>Homework</span>
                <input value={form.homework || ""} onChange={(e) => setForm((c) => ({ ...c, homework: e.target.value }))} />
              </label>
              <label className="admin-studio-field">
                <span>Assessment Notes</span>
                <input value={form.assessmentNotes || ""} onChange={(e) => setForm((c) => ({ ...c, assessmentNotes: e.target.value }))} />
              </label>
              <div className="admin-bulk-pipeline-dialog-actions">
                <button type="button" className="ghost-button" onClick={() => setFormOpen(false)} disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" className="primary-button" disabled={submitting}>
                  {submitting ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
