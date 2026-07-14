import { useCallback, useEffect, useState } from "react";
import { createAdminLevel, deleteAdminLevel, getAdminLevels, updateAdminLevel } from "../api/client";

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

const emptyForm = { nameCode: "", name: "", displayOrder: "0" };

export const AdminLevelsPage = () => {
  const [levels, setLevels] = useState([]);
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

  const loadLevels = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getAdminLevels();
      setLevels(result?.levels || []);
    } catch (loadError) {
      setError(loadError.message || "Failed to load levels.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLevels();
  }, [loadLevels]);

  const openCreateModal = () => {
    setForm(emptyForm);
    setEditingId(null);
    setFormError("");
    setFormMode("create");
  };

  const openEditModal = (level) => {
    setForm({ nameCode: level.nameCode, name: level.name, displayOrder: String(level.displayOrder) });
    setEditingId(level.id);
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
        nameCode: form.nameCode.trim(),
        name: form.name.trim(),
        displayOrder: Number(form.displayOrder) || 0,
      };
      if (formMode === "edit") {
        await updateAdminLevel(editingId, payload);
        setNotice(`Updated ${payload.name}.`);
      } else {
        await createAdminLevel(payload);
        setNotice(`Added ${payload.name}.`);
      }
      setFormMode(null);
      await loadLevels();
    } catch (submitError) {
      setFormError(submitError.message || "Failed to save level.");
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteAdminLevel(deleteTarget.id);
      setNotice(`Deleted ${deleteTarget.name}.`);
      setDeleteTarget(null);
      await loadLevels();
    } catch (deleteErr) {
      setDeleteError(deleteErr.message || "Failed to delete level.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="admin-bulk-pipeline-page">
      <header className="admin-bulk-pipeline-header">
        <div>
          <span className="eyebrow">Admin module</span>
          <h1>Levels</h1>
          <p>
            Manage the class/grade level reference list (mst_level) used to organize books and practice
            sets by grade.
          </p>
        </div>
        <div className="admin-bulk-pipeline-header-actions">
          <button type="button" className="primary-button" onClick={openCreateModal}>
            + Add Level
          </button>
        </div>
      </header>

      {notice && <div className="admin-bulk-pipeline-concurrency">{notice}</div>}
      {error && <p className="error-text">{error}</p>}

      <div className="admin-bulk-pipeline-grid-shell">
        {loading ? (
          <div className="admin-bulk-pipeline-empty">Loading levels...</div>
        ) : levels.length === 0 ? (
          <div className="admin-bulk-pipeline-empty">No levels yet. Add one to get started.</div>
        ) : (
          <table className="admin-exam-types-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Code</th>
                <th>Name</th>
                <th>Display Order</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {levels.map((level) => (
                <tr key={level.id}>
                  <td className="admin-exam-types-id-cell">{level.id}</td>
                  <td>
                    <span className="admin-exam-types-code-badge">{level.nameCode}</span>
                  </td>
                  <td>{level.name}</td>
                  <td>{level.displayOrder}</td>
                  <td className="admin-exam-types-row-actions">
                    <button
                      type="button"
                      className="admin-exam-types-icon-button"
                      aria-label={`Edit ${level.name}`}
                      onClick={() => openEditModal(level)}
                    >
                      <EditIcon />
                    </button>
                    <button
                      type="button"
                      className="admin-exam-types-icon-button is-danger"
                      aria-label={`Delete ${level.name}`}
                      onClick={() => {
                        setDeleteError("");
                        setDeleteTarget(level);
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
            <h2>{formMode === "edit" ? "Edit Level" : "Add Level"}</h2>
            <form className="admin-exam-types-form" onSubmit={handleSubmit}>
              <label className="admin-studio-field">
                <span>Code</span>
                <input
                  value={form.nameCode}
                  onChange={(event) => setForm((current) => ({ ...current, nameCode: event.target.value }))}
                  placeholder="e.g. 11"
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
                  placeholder="e.g. Class 11"
                  maxLength={120}
                  required
                />
              </label>
              <label className="admin-studio-field">
                <span>Display Order</span>
                <input
                  type="number"
                  value={form.displayOrder}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, displayOrder: event.target.value }))
                  }
                  placeholder="0"
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
            <h2>Delete Level</h2>
            <p>
              Are you sure you want to delete <strong>{deleteTarget.name}</strong> (
              {deleteTarget.nameCode})? This can&apos;t be undone.
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
