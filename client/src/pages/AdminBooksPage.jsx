import { useCallback, useEffect, useRef, useState } from "react";
import {
  createAdminBook,
  deleteAdminBook,
  getAdminBookOptions,
  getAdminBooks,
  updateAdminBook,
  uploadAdminBooksBulk,
} from "../api/client";

// Keep in sync with server/src/services/bookService.js's BOOK_BULK_UPLOAD_HEADERS
// -- the uploader reads columns by these exact header names.
const BULK_TEMPLATE_HEADERS = [
  "nameCode",
  "name",
  "subjectCode",
  "levelCode",
  "examGoalCode",
  "displayOrder",
  "isActive",
];

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Failed to read the selected file."));
    reader.readAsDataURL(file);
  });

const downloadBookBulkTemplate = () => {
  const csvContent = `${BULK_TEMPLATE_HEADERS.join(",")}\n`;
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = "mst_book_upload_template.csv";
  link.click();
  URL.revokeObjectURL(objectUrl);
};

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

const emptyForm = {
  nameCode: "",
  name: "",
  subjectId: "",
  levelId: "",
  examGoalId: "",
  displayOrder: "0",
  isActive: true,
};

export const AdminBooksPage = () => {
  const [books, setBooks] = useState([]);
  const [subjectOptions, setSubjectOptions] = useState([]);
  const [levelOptions, setLevelOptions] = useState([]);
  const [examGoalOptions, setExamGoalOptions] = useState([]);
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

  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadResult, setUploadResult] = useState(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [booksResult, optionsResult] = await Promise.all([getAdminBooks(), getAdminBookOptions()]);
      setBooks(booksResult?.books || []);
      setSubjectOptions(optionsResult?.subjects || []);
      setLevelOptions(optionsResult?.levels || []);
      setExamGoalOptions(optionsResult?.examGoals || []);
    } catch (loadError) {
      setError(loadError.message || "Failed to load books.");
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
      subjectId: subjectOptions[0]?.id ? String(subjectOptions[0].id) : "",
      levelId: levelOptions[0]?.id ? String(levelOptions[0].id) : "",
      examGoalId: examGoalOptions[0]?.id ? String(examGoalOptions[0].id) : "",
    });
    setEditingId(null);
    setFormError("");
    setFormMode("create");
  };

  const openEditModal = (book) => {
    setForm({
      nameCode: book.nameCode,
      name: book.name,
      subjectId: String(book.subjectId),
      levelId: String(book.levelId),
      examGoalId: String(book.examGoalId),
      displayOrder: String(book.displayOrder),
      isActive: book.isActive,
    });
    setEditingId(book.id);
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
        subjectId: Number(form.subjectId),
        levelId: Number(form.levelId),
        examGoalId: Number(form.examGoalId),
        displayOrder: Number(form.displayOrder) || 0,
        isActive: form.isActive,
      };
      if (formMode === "edit") {
        await updateAdminBook(editingId, payload);
        setNotice(`Updated ${payload.name}.`);
      } else {
        await createAdminBook(payload);
        setNotice(`Added ${payload.name}.`);
      }
      setFormMode(null);
      await loadAll();
    } catch (submitError) {
      setFormError(submitError.message || "Failed to save book.");
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteAdminBook(deleteTarget.id);
      setNotice(`Deleted ${deleteTarget.name}.`);
      setDeleteTarget(null);
      await loadAll();
    } catch (deleteErr) {
      setDeleteError(deleteErr.message || "Failed to delete book.");
    } finally {
      setDeleting(false);
    }
  };

  const hasFormOptions =
    subjectOptions.length > 0 && levelOptions.length > 0 && examGoalOptions.length > 0;

  const handleFileSelected = async (event) => {
    const file = event.target.files?.[0] || null;
    event.target.value = "";
    if (!file) return;

    setUploading(true);
    setUploadError("");
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const result = await uploadAdminBooksBulk({ fileName: file.name, dataUrl });
      setUploadResult(result?.summary ? result : { summary: { created: 0, updated: 0, errors: [] }, results: [] });
      await loadAll();
    } catch (uploadErr) {
      setUploadError(uploadErr.message || "Failed to upload the file.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="admin-bulk-pipeline-page">
      <header className="admin-bulk-pipeline-header">
        <div>
          <span className="eyebrow">Admin module</span>
          <h1>Books</h1>
          <p>
            Manage the book reference list (mst_book) that chapters and exercises are organized
            under, by subject, level, and exam goal.
          </p>
        </div>
        <div className="admin-bulk-pipeline-header-actions">
          <button type="button" className="ghost-button" onClick={downloadBookBulkTemplate}>
            Download Template
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? "Uploading..." : "Upload Excel/CSV"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            style={{ display: "none" }}
            onChange={handleFileSelected}
          />
          <button
            type="button"
            className="primary-button"
            onClick={openCreateModal}
            disabled={!hasFormOptions}
            title={hasFormOptions ? undefined : "Add a subject, a level, and an exam goal first."}
          >
            + Add Book
          </button>
        </div>
      </header>

      {notice && <div className="admin-bulk-pipeline-concurrency">{notice}</div>}
      {error && <p className="error-text">{error}</p>}
      {uploadError && <p className="error-text">{uploadError}</p>}

      <div className="admin-bulk-pipeline-grid-shell">
        {loading ? (
          <div className="admin-bulk-pipeline-empty">Loading books...</div>
        ) : books.length === 0 ? (
          <div className="admin-bulk-pipeline-empty">No books yet. Add one to get started.</div>
        ) : (
          <table className="admin-exam-types-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Code</th>
                <th>Name</th>
                <th>Subject</th>
                <th>Level</th>
                <th>Exam Goal</th>
                <th>Display Order</th>
                <th>Status</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {books.map((book) => (
                <tr key={book.id}>
                  <td className="admin-exam-types-id-cell">{book.id}</td>
                  <td>
                    <span className="admin-exam-types-code-badge">{book.nameCode}</span>
                  </td>
                  <td>{book.name}</td>
                  <td>{book.subjectName}</td>
                  <td>{book.levelName}</td>
                  <td>{book.examGoalName}</td>
                  <td>{book.displayOrder}</td>
                  <td>
                    <span
                      className={`admin-bulk-pipeline-status-badge ${
                        book.isActive ? "is-completed" : "is-aborted"
                      }`}
                    >
                      {book.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="admin-exam-types-row-actions">
                    <button
                      type="button"
                      className="admin-exam-types-icon-button"
                      aria-label={`Edit ${book.name}`}
                      onClick={() => openEditModal(book)}
                    >
                      <EditIcon />
                    </button>
                    <button
                      type="button"
                      className="admin-exam-types-icon-button is-danger"
                      aria-label={`Delete ${book.name}`}
                      onClick={() => {
                        setDeleteError("");
                        setDeleteTarget(book);
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
          <div className="modal-panel is-wide" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="close-button" aria-label="Close" onClick={closeFormModal}>
              &times;
            </button>
            <h2>{formMode === "edit" ? "Edit Book" : "Add Book"}</h2>
            <form className="admin-exam-types-form admin-books-form" onSubmit={handleSubmit}>
              <label className="admin-studio-field">
                <span>Code</span>
                <input
                  value={form.nameCode}
                  onChange={(event) => setForm((current) => ({ ...current, nameCode: event.target.value }))}
                  placeholder="e.g. PHY11I"
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
                  placeholder="e.g. Physics Part I"
                  maxLength={255}
                  required
                />
              </label>
              <label className="admin-studio-field">
                <span>Subject</span>
                <select
                  value={form.subjectId}
                  onChange={(event) => setForm((current) => ({ ...current, subjectId: event.target.value }))}
                  required
                >
                  {subjectOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name} ({option.nameCode})
                    </option>
                  ))}
                </select>
              </label>
              <label className="admin-studio-field">
                <span>Level</span>
                <select
                  value={form.levelId}
                  onChange={(event) => setForm((current) => ({ ...current, levelId: event.target.value }))}
                  required
                >
                  {levelOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name} ({option.nameCode})
                    </option>
                  ))}
                </select>
              </label>
              <label className="admin-studio-field">
                <span>Exam Goal</span>
                <select
                  value={form.examGoalId}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, examGoalId: event.target.value }))
                  }
                  required
                >
                  {examGoalOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name} ({option.goalId})
                    </option>
                  ))}
                </select>
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
              <label className="admin-exam-types-checkbox-field admin-books-form-full">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, isActive: event.target.checked }))
                  }
                />
                <span>Active</span>
              </label>
              {formError && <p className="error-text admin-books-form-full">{formError}</p>}
              <div className="admin-bulk-pipeline-dialog-actions admin-books-form-full">
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
            <h2>Delete Book</h2>
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

      {uploadResult && (
        <div className="modal-backdrop" onClick={() => setUploadResult(null)}>
          <div className="modal-panel is-wide" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="close-button"
              aria-label="Close"
              onClick={() => setUploadResult(null)}
            >
              &times;
            </button>
            <h2>Upload Results</h2>
            <div className="admin-bulk-pipeline-summary">
              <span>Created: {uploadResult.summary.created}</span>
              <span>Updated: {uploadResult.summary.updated}</span>
              <span>Errors: {uploadResult.summary.errors.length}</span>
            </div>
            {uploadResult.summary.errors.length > 0 && (
              <div className="admin-books-bulk-results-list">
                {uploadResult.summary.errors.map((errorRow) => (
                  <div className="admin-bulk-pipeline-failure-banner" key={`${errorRow.row}-${errorRow.nameCode}`}>
                    <strong>
                      Row {errorRow.row}
                      {errorRow.nameCode ? ` (${errorRow.nameCode})` : ""}
                    </strong>
                    <span>{errorRow.message}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="admin-bulk-pipeline-dialog-actions">
              <button type="button" className="primary-button" onClick={() => setUploadResult(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
