import { useCallback, useEffect, useState } from "react";
import {
  createAdminExamType,
  deleteAdminExamType,
  getAdminExamTypes,
  updateAdminExamType,
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

const emptyForm = { typeId: "", name: "" };

// mst_exam_type's seeded rows (BRD/COM/ENT/JOB) all use short uppercase
// codes -- keep new codes consistent with that convention rather than
// letting mixed-case duplicates ("brd" vs "BRD") accumulate, since Postgres
// text uniqueness is case-sensitive.
const normalizeTypeId = (value) => value.toUpperCase();

export const AdminExamTypesPage = () => {
  const [examTypes, setExamTypes] = useState([]);
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

  const loadExamTypes = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getAdminExamTypes();
      setExamTypes(result?.examTypes || []);
    } catch (loadError) {
      setError(loadError.message || "Failed to load exam types.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadExamTypes();
  }, [loadExamTypes]);

  const openCreateModal = () => {
    setForm(emptyForm);
    setEditingId(null);
    setFormError("");
    setFormMode("create");
  };

  const openEditModal = (examType) => {
    setForm({ typeId: examType.typeId, name: examType.name });
    setEditingId(examType.id);
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
      const payload = { typeId: form.typeId.trim(), name: form.name.trim() };
      if (formMode === "edit") {
        await updateAdminExamType(editingId, payload);
        setNotice(`Updated ${payload.name}.`);
      } else {
        await createAdminExamType(payload);
        setNotice(`Added ${payload.name}.`);
      }
      setFormMode(null);
      await loadExamTypes();
    } catch (submitError) {
      setFormError(submitError.message || "Failed to save exam type.");
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteAdminExamType(deleteTarget.id);
      setNotice(`Deleted ${deleteTarget.name}.`);
      setDeleteTarget(null);
      await loadExamTypes();
    } catch (deleteErr) {
      setDeleteError(deleteErr.message || "Failed to delete exam type.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="admin-bulk-pipeline-page">
      <header className="admin-bulk-pipeline-header">
        <div>
          <span className="eyebrow">Admin module</span>
          <h1>Exam Types</h1>
          <p>
            Manage the exam type reference list (mst_exam_type) used to classify exam goals across the
            curriculum catalog.
          </p>
        </div>
        <div className="admin-bulk-pipeline-header-actions">
          <button type="button" className="primary-button" onClick={openCreateModal}>
            + Add Exam Type
          </button>
        </div>
      </header>

      {notice && <div className="admin-bulk-pipeline-concurrency">{notice}</div>}
      {error && <p className="error-text">{error}</p>}

      <div className="admin-bulk-pipeline-grid-shell">
        {loading ? (
          <div className="admin-bulk-pipeline-empty">Loading exam types...</div>
        ) : examTypes.length === 0 ? (
          <div className="admin-bulk-pipeline-empty">No exam types yet. Add one to get started.</div>
        ) : (
          <table className="admin-exam-types-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Code</th>
                <th>Name</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {examTypes.map((examType) => (
                <tr key={examType.id}>
                  <td className="admin-exam-types-id-cell">{examType.id}</td>
                  <td>
                    <span className="admin-exam-types-code-badge">{examType.typeId}</span>
                  </td>
                  <td>{examType.name}</td>
                  <td className="admin-exam-types-row-actions">
                    <button
                      type="button"
                      className="admin-exam-types-icon-button"
                      aria-label={`Edit ${examType.name}`}
                      onClick={() => openEditModal(examType)}
                    >
                      <EditIcon />
                    </button>
                    <button
                      type="button"
                      className="admin-exam-types-icon-button is-danger"
                      aria-label={`Delete ${examType.name}`}
                      onClick={() => {
                        setDeleteError("");
                        setDeleteTarget(examType);
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
            <h2>{formMode === "edit" ? "Edit Exam Type" : "Add Exam Type"}</h2>
            <form className="admin-exam-types-form" onSubmit={handleSubmit}>
              <label className="admin-studio-field">
                <span>Code</span>
                <input
                  value={form.typeId}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, typeId: normalizeTypeId(event.target.value) }))
                  }
                  placeholder="e.g. BRD"
                  maxLength={20}
                  autoFocus
                  required
                />
              </label>
              <label className="admin-studio-field">
                <span>Name</span>
                <input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="e.g. Board"
                  maxLength={120}
                  required
                />
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
            <h2>Delete Exam Type</h2>
            <p>
              Are you sure you want to delete <strong>{deleteTarget.name}</strong> (
              {deleteTarget.typeId})? This can&apos;t be undone.
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
