import { useCallback, useEffect, useState } from "react";
import {
  createAdminExamGoal,
  deleteAdminExamGoal,
  getAdminExamGoalOptions,
  getAdminExamGoals,
  updateAdminExamGoal,
} from "../api/client";

const EditIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M4 20h4l10.5-10.5a1.5 1.5 0 0 0 0-2.12l-1.88-1.88a1.5 1.5 0 0 0-2.12 0L4 16v4Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M5 7h14M9.5 7V5.5a1.5 1.5 0 0 1 1.5-1.5h2a1.5 1.5 0 0 1 1.5 1.5V7M7 7l.7 12a1.5 1.5 0 0 0 1.5 1.4h5.6a1.5 1.5 0 0 0 1.5-1.4L17 7"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const emptyForm = { goalId: "", name: "", examTypeId: "", stateId: "", isActive: true };

export const AdminExamGoalsPage = () => {
  const [examGoals, setExamGoals] = useState([]);
  const [examTypeOptions, setExamTypeOptions] = useState([]);
  const [stateOptions, setStateOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [formMode, setFormMode] = useState(null); // null | "create" | "edit"
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [goalsResult, optionsResult] = await Promise.all([
        getAdminExamGoals(),
        getAdminExamGoalOptions(),
      ]);
      setExamGoals(goalsResult?.examGoals || []);
      setExamTypeOptions(optionsResult?.examTypes || []);
      setStateOptions(optionsResult?.states || []);
    } catch (loadError) {
      setError(loadError.message || "Failed to load exam goals.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const openCreateModal = () => {
    setForm({
      ...emptyForm,
      examTypeId: examTypeOptions[0]?.id ? String(examTypeOptions[0].id) : "",
      stateId: stateOptions[0]?.id ? String(stateOptions[0].id) : "",
    });
    setEditingId(null);
    setFormError("");
    setFormMode("create");
  };

  const openEditModal = (examGoal) => {
    setForm({
      goalId: examGoal.goalId,
      name: examGoal.name,
      examTypeId: String(examGoal.examTypeId),
      stateId: String(examGoal.stateId),
      isActive: examGoal.isActive,
    });
    setEditingId(examGoal.id);
    setFormError("");
    setFormMode("edit");
  };

  const closeFormModal = () => {
    if (submitting) return;
    setFormMode(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setFormError("");
    try {
      const payload = {
        goalId: form.goalId.trim(),
        name: form.name.trim(),
        examTypeId: Number(form.examTypeId),
        stateId: Number(form.stateId),
        isActive: form.isActive,
      };
      if (formMode === "edit") {
        await updateAdminExamGoal(editingId, payload);
        setNotice(`Updated ${payload.name}.`);
      } else {
        await createAdminExamGoal(payload);
        setNotice(`Added ${payload.name}.`);
      }
      setFormMode(null);
      await loadAll();
    } catch (submitError) {
      setFormError(submitError.message || "Failed to save exam goal.");
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteAdminExamGoal(deleteTarget.id);
      setNotice(`Deleted ${deleteTarget.name}.`);
      setDeleteTarget(null);
      await loadAll();
    } catch (deleteErr) {
      setDeleteError(deleteErr.message || "Failed to delete exam goal.");
    } finally {
      setDeleting(false);
    }
  };

  const hasFormOptions = examTypeOptions.length > 0 && stateOptions.length > 0;

  return (
    <section className="admin-bulk-pipeline-page">
      <header className="admin-bulk-pipeline-header">
        <div>
          <span className="eyebrow">Admin module</span>
          <h1>Exam Goals</h1>
          <p>
            Manage the exam goal reference list (mst_exam_goal) that books and practice sets are
            organized under.
          </p>
        </div>
        <div className="admin-bulk-pipeline-header-actions">
          <button
            type="button"
            className="primary-button"
            onClick={openCreateModal}
            disabled={!hasFormOptions}
            title={hasFormOptions ? undefined : "Add an exam type and a state first."}
          >
            + Add Exam Goal
          </button>
        </div>
      </header>

      {notice && <div className="admin-bulk-pipeline-concurrency">{notice}</div>}
      {error && <p className="error-text">{error}</p>}

      <div className="admin-bulk-pipeline-grid-shell">
        {loading ? (
          <div className="admin-bulk-pipeline-empty">Loading exam goals...</div>
        ) : examGoals.length === 0 ? (
          <div className="admin-bulk-pipeline-empty">No exam goals yet. Add one to get started.</div>
        ) : (
          <table className="admin-exam-types-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Code</th>
                <th>Name</th>
                <th>Exam Type</th>
                <th>State</th>
                <th>Status</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {examGoals.map((examGoal) => (
                <tr key={examGoal.id}>
                  <td className="admin-exam-types-id-cell">{examGoal.id}</td>
                  <td>
                    <span className="admin-exam-types-code-badge">{examGoal.goalId}</span>
                  </td>
                  <td>{examGoal.name}</td>
                  <td>{examGoal.examTypeName}</td>
                  <td>{examGoal.stateName}</td>
                  <td>
                    <span
                      className={`admin-bulk-pipeline-status-badge ${
                        examGoal.isActive ? "is-completed" : "is-aborted"
                      }`}
                    >
                      {examGoal.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="admin-exam-types-row-actions">
                    <button
                      type="button"
                      className="admin-exam-types-icon-button"
                      aria-label={`Edit ${examGoal.name}`}
                      onClick={() => openEditModal(examGoal)}
                    >
                      <EditIcon />
                    </button>
                    <button
                      type="button"
                      className="admin-exam-types-icon-button is-danger"
                      aria-label={`Delete ${examGoal.name}`}
                      onClick={() => {
                        setDeleteError("");
                        setDeleteTarget(examGoal);
                      }}
                    >
                      <TrashIcon />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {formMode && (
        <div className="modal-backdrop" onClick={closeFormModal}>
          <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="close-button" aria-label="Close" onClick={closeFormModal}>
              &times;
            </button>
            <h2>{formMode === "edit" ? "Edit Exam Goal" : "Add Exam Goal"}</h2>
            <form className="admin-exam-types-form" onSubmit={handleSubmit}>
              <label className="admin-studio-field">
                <span>Code</span>
                <input
                  value={form.goalId}
                  onChange={(event) => setForm((current) => ({ ...current, goalId: event.target.value }))}
                  placeholder="e.g. AISSCE"
                  maxLength={40}
                  autoFocus
                  required
                />
              </label>
              <label className="admin-studio-field">
                <span>Name</span>
                <input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="e.g. All India Senior School Certificate Examination"
                  maxLength={255}
                  required
                />
              </label>
              <label className="admin-studio-field">
                <span>Exam Type</span>
                <select
                  value={form.examTypeId}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, examTypeId: event.target.value }))
                  }
                  required
                >
                  {examTypeOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name} ({option.typeId})
                    </option>
                  ))}
                </select>
              </label>
              <label className="admin-studio-field">
                <span>State</span>
                <select
                  value={form.stateId}
                  onChange={(event) => setForm((current) => ({ ...current, stateId: event.target.value }))}
                  required
                >
                  {stateOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="admin-exam-types-checkbox-field">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, isActive: event.target.checked }))
                  }
                />
                <span>Active</span>
              </label>
              {formError && <p className="error-text">{formError}</p>}
              <div className="admin-bulk-pipeline-dialog-actions">
                <button type="button" className="ghost-button" onClick={closeFormModal} disabled={submitting}>
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

      {deleteTarget && (
        <div className="modal-backdrop" onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="close-button"
              aria-label="Close"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              &times;
            </button>
            <h2>Delete Exam Goal</h2>
            <p>
              Are you sure you want to delete <strong>{deleteTarget.name}</strong> (
              {deleteTarget.goalId})? This can&apos;t be undone.
            </p>
            {deleteError && <p className="error-text">{deleteError}</p>}
            <div className="admin-bulk-pipeline-dialog-actions">
              <button
                type="button"
                className="ghost-button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="ghost-button admin-pipeline-runs-danger"
                onClick={confirmDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
