import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createAdminInstitution, getAdminExamGoals, getAdminInstitutions, updateAdminInstitution } from "../api/client";

const emptyForm = {
  name: "",
  code: "",
  address: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  mstExamGoalId: "",
  isActive: true,
};

const licenseBadgeClass = (status) => {
  if (status === "licensed") return "is-completed";
  if (status === "suspended") return "is-aborted";
  return "";
};

export const AdminInstitutionsPage = () => {
  const navigate = useNavigate();
  const [institutions, setInstitutions] = useState([]);
  const [examGoals, setExamGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [formMode, setFormMode] = useState(null); // null | "create" | "edit"
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadInstitutions = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getAdminInstitutions();
      setInstitutions(result?.institutions || []);
    } catch (loadError) {
      setError(loadError.message || "Failed to load institutions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInstitutions();
    getAdminExamGoals()
      .then((result) => setExamGoals(result?.examGoals || []))
      .catch(() => setExamGoals([]));
  }, [loadInstitutions]);

  const openCreateModal = () => {
    setForm(emptyForm);
    setEditingId(null);
    setFormError("");
    setFormMode("create");
  };

  const openEditModal = (institution) => {
    setForm({
      name: institution.name,
      code: institution.code,
      address: institution.address || "",
      contactName: institution.contactName || "",
      contactEmail: institution.contactEmail || "",
      contactPhone: institution.contactPhone || "",
      mstExamGoalId: institution.mstExamGoalId || "",
      isActive: institution.isActive,
    });
    setEditingId(institution.id);
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
      const payload = { ...form, name: form.name.trim(), code: form.code.trim() };
      if (formMode === "edit") {
        await updateAdminInstitution(editingId, payload);
        setNotice(`Updated ${payload.name}.`);
      } else {
        await createAdminInstitution(payload);
        setNotice(`Added ${payload.name}.`);
      }
      setFormMode(null);
      await loadInstitutions();
    } catch (submitError) {
      setFormError(submitError.message || "Failed to save institution.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="admin-bulk-pipeline-page">
      <header className="admin-bulk-pipeline-header">
        <div>
          <span className="eyebrow">Admin module</span>
          <h1>Institutions</h1>
          <p>Manage the schools and coaching institutes on the platform, their licensing, and their teachers.</p>
        </div>
        <div className="admin-bulk-pipeline-header-actions">
          <button type="button" className="primary-button" onClick={openCreateModal}>
            + Add Institution
          </button>
        </div>
      </header>

      {notice && <div className="admin-bulk-pipeline-concurrency">{notice}</div>}
      {error && <p className="error-text">{error}</p>}

      <div className="admin-bulk-pipeline-grid-shell">
        {loading ? (
          <div className="admin-bulk-pipeline-empty">Loading institutions...</div>
        ) : institutions.length === 0 ? (
          <div className="admin-bulk-pipeline-empty">No institutions yet. Add one to get started.</div>
        ) : (
          <table className="admin-exam-types-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Code</th>
                <th>License</th>
                <th>Seats</th>
                <th>Status</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {institutions.map((institution) => (
                <tr key={institution.id}>
                  <td>{institution.name}</td>
                  <td>
                    <span className="admin-exam-types-code-badge">{institution.code}</span>
                  </td>
                  <td>
                    <span className={`admin-bulk-pipeline-status-badge ${licenseBadgeClass(institution.licenseStatus)}`}>
                      {institution.licenseStatus}
                    </span>
                  </td>
                  <td>
                    {institution.seatsUsed ?? 0}
                    {institution.licenseSeatCap != null ? ` / ${institution.licenseSeatCap}` : ""}
                  </td>
                  <td>
                    <span
                      className={`admin-bulk-pipeline-status-badge ${
                        institution.isActive ? "is-completed" : "is-aborted"
                      }`}
                    >
                      {institution.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button type="button" className="ghost-button" onClick={() => openEditModal(institution)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="primary-button"
                        onClick={() => navigate(`/admin/institutions/${institution.id}`)}
                      >
                        Manage
                      </button>
                    </div>
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
            <h2>{formMode === "edit" ? "Edit Institution" : "Add Institution"}</h2>
            <form className="admin-exam-types-form" onSubmit={handleSubmit}>
              <label className="admin-studio-field">
                <span>Name</span>
                <input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="e.g. Greenwood Public School"
                  required
                  autoFocus
                />
              </label>
              <label className="admin-studio-field">
                <span>Code</span>
                <input
                  value={form.code}
                  onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
                  placeholder="e.g. GREENWOOD"
                  maxLength={40}
                  required
                />
              </label>
              <label className="admin-studio-field">
                <span>Address</span>
                <input
                  value={form.address}
                  onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
                />
              </label>
              <label className="admin-studio-field">
                <span>Contact name</span>
                <input
                  value={form.contactName}
                  onChange={(event) => setForm((current) => ({ ...current, contactName: event.target.value }))}
                />
              </label>
              <label className="admin-studio-field">
                <span>Contact email</span>
                <input
                  type="email"
                  value={form.contactEmail}
                  onChange={(event) => setForm((current) => ({ ...current, contactEmail: event.target.value }))}
                />
              </label>
              <label className="admin-studio-field">
                <span>Contact phone</span>
                <input
                  value={form.contactPhone}
                  onChange={(event) => setForm((current) => ({ ...current, contactPhone: event.target.value }))}
                />
              </label>
              <label className="admin-studio-field">
                <span>Curriculum board</span>
                <select
                  value={form.mstExamGoalId}
                  onChange={(event) => setForm((current) => ({ ...current, mstExamGoalId: event.target.value }))}
                >
                  <option value="">Not set yet</option>
                  {examGoals.map((goal) => (
                    <option key={goal.id} value={goal.id}>
                      {goal.name}
                    </option>
                  ))}
                </select>
              </label>
              {formMode === "edit" && (
                <label className="admin-exam-types-checkbox-field">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
                  />
                  <span>Active</span>
                </label>
              )}
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
    </section>
  );
};
