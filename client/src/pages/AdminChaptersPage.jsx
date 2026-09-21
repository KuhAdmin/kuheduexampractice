import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createAdminChapter,
  deleteContentEditorChapter,
  getAdminBookOptions,
  getAdminBooks,
  getAdminChaptersForBook,
  getContentEditorChapterDeletionPreview,
  renameContentEditorChapter,
  updateAdminChapterActive,
  updateAdminChapterHidden,
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

const emptyCreateForm = { chapterNumber: "", chapterName: "", displayOrder: "" };

export const AdminChaptersPage = () => {
  const [books, setBooks] = useState([]);
  const [levelOptions, setLevelOptions] = useState([]);
  const [subjectOptions, setSubjectOptions] = useState([]);
  const [examGoalOptions, setExamGoalOptions] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [levelId, setLevelId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [examGoalId, setExamGoalId] = useState("");
  const [bookId, setBookId] = useState("");

  const [chapters, setChapters] = useState([]);
  const [chaptersLoading, setChaptersLoading] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);

  const [renamingChapter, setRenamingChapter] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameError, setRenameError] = useState("");
  const [renaming, setRenaming] = useState(false);

  const [deletingChapter, setDeletingChapter] = useState(null);
  const [deletionPreview, setDeletionPreview] = useState(null);
  const [deletionPreviewLoading, setDeletionPreviewLoading] = useState(false);
  const [deletionError, setDeletionError] = useState("");
  const [deletionConfirmText, setDeletionConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const [togglingKey, setTogglingKey] = useState("");

  useEffect(() => {
    setLoadingOptions(true);
    Promise.all([getAdminBooks(), getAdminBookOptions()])
      .then(([booksResult, optionsResult]) => {
        setBooks(booksResult?.books || []);
        setLevelOptions(optionsResult?.levels || []);
        setSubjectOptions(optionsResult?.subjects || []);
        setExamGoalOptions(optionsResult?.examGoals || []);
      })
      .catch((loadError) => setError(loadError.message || "Failed to load classes/subjects."))
      .finally(() => setLoadingOptions(false));
  }, []);

  const matchingBooks = useMemo(() => {
    if (!levelId || !subjectId || !examGoalId) return [];
    return books.filter(
      (book) =>
        String(book.levelId) === String(levelId) &&
        String(book.subjectId) === String(subjectId) &&
        String(book.examGoalId) === String(examGoalId)
    );
  }, [books, levelId, subjectId, examGoalId]);

  useEffect(() => {
    if (matchingBooks.length === 1) {
      setBookId(String(matchingBooks[0].id));
    } else {
      setBookId("");
    }
  }, [matchingBooks]);

  const selectedBook = books.find((book) => String(book.id) === String(bookId));

  const loadChapters = useCallback(async () => {
    if (!bookId) {
      setChapters([]);
      return;
    }
    setChaptersLoading(true);
    setError("");
    try {
      const result = await getAdminChaptersForBook(bookId);
      setChapters(result?.chapters || []);
    } catch (loadError) {
      setError(loadError.message || "Failed to load chapters.");
    } finally {
      setChaptersLoading(false);
    }
  }, [bookId]);

  useEffect(() => {
    loadChapters();
  }, [loadChapters]);

  const openCreateModal = () => {
    setCreateForm(emptyCreateForm);
    setCreateError("");
    setCreateOpen(true);
  };

  const handleCreateSubmit = async (event) => {
    event.preventDefault();
    setCreating(true);
    setCreateError("");
    try {
      await createAdminChapter({
        bookId,
        chapterNumber: createForm.chapterNumber.trim(),
        chapterName: createForm.chapterName.trim(),
        displayOrder: createForm.displayOrder === "" ? undefined : Number(createForm.displayOrder),
      });
      setNotice(`Added Chapter ${createForm.chapterNumber.trim()}.`);
      setCreateOpen(false);
      await loadChapters();
    } catch (createErr) {
      setCreateError(createErr.message || "Failed to add chapter.");
    } finally {
      setCreating(false);
    }
  };

  const openRenameModal = (chapter) => {
    setRenamingChapter(chapter);
    setRenameValue(chapter.chapterName);
    setRenameError("");
  };

  const handleRenameSubmit = async (event) => {
    event.preventDefault();
    setRenaming(true);
    setRenameError("");
    try {
      await renameContentEditorChapter(bookId, renamingChapter.chapterNumber, renameValue.trim());
      setNotice(`Renamed Chapter ${renamingChapter.chapterNumber}.`);
      setRenamingChapter(null);
      await loadChapters();
    } catch (renameErr) {
      setRenameError(renameErr.message || "Failed to rename chapter.");
    } finally {
      setRenaming(false);
    }
  };

  const toggleActive = async (chapter) => {
    setTogglingKey(`active-${chapter.chapterNumber}`);
    setError("");
    try {
      await updateAdminChapterActive(bookId, chapter.chapterNumber, !chapter.isActive);
      await loadChapters();
    } catch (toggleError) {
      setError(toggleError.message || "Failed to update chapter.");
    } finally {
      setTogglingKey("");
    }
  };

  const toggleHidden = async (chapter) => {
    setTogglingKey(`hidden-${chapter.chapterNumber}`);
    setError("");
    try {
      await updateAdminChapterHidden(bookId, chapter.chapterNumber, !chapter.isHidden);
      await loadChapters();
    } catch (toggleError) {
      setError(toggleError.message || "Failed to update chapter.");
    } finally {
      setTogglingKey("");
    }
  };

  const openDeleteModal = async (chapter) => {
    setDeletingChapter(chapter);
    setDeletionPreview(null);
    setDeletionError("");
    setDeletionConfirmText("");
    setDeletionPreviewLoading(true);
    try {
      const result = await getContentEditorChapterDeletionPreview(bookId, chapter.chapterNumber);
      setDeletionPreview(result?.preview || null);
    } catch (previewError) {
      setDeletionError(previewError.message || "Failed to load deletion preview.");
    } finally {
      setDeletionPreviewLoading(false);
    }
  };

  const closeDeleteModal = () => {
    if (deleting) return;
    setDeletingChapter(null);
  };

  const handleConfirmDelete = async () => {
    setDeleting(true);
    setDeletionError("");
    try {
      await deleteContentEditorChapter(bookId, deletingChapter.chapterNumber);
      setNotice(`Deleted Chapter ${deletingChapter.chapterNumber} -- ${deletingChapter.chapterName}.`);
      setDeletingChapter(null);
      await loadChapters();
    } catch (deleteErr) {
      setDeletionError(deleteErr.message || "Failed to delete chapter.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="admin-bulk-pipeline-page">
      <header className="admin-bulk-pipeline-header">
        <div>
          <span className="eyebrow">Admin module</span>
          <h1>Chapters</h1>
          <p>Class + subject-wise inventory of chapters (mst_chapter). Pick a class, subject and exam goal to manage that book's chapters.</p>
        </div>
        <div className="admin-bulk-pipeline-header-actions">
          <button type="button" className="primary-button" onClick={openCreateModal} disabled={!bookId}>
            + Add Chapter
          </button>
        </div>
      </header>

      {notice && <div className="admin-bulk-pipeline-concurrency">{notice}</div>}
      {error && <p className="error-text">{error}</p>}

      <div className="admin-bulk-pipeline-grid-shell">
        {loadingOptions ? (
          <div className="admin-bulk-pipeline-empty">Loading...</div>
        ) : (
          <>
            <div className="admin-studio-form-grid">
              <label className="admin-studio-field">
                <span>Class</span>
                <select value={levelId} onChange={(event) => setLevelId(event.target.value)}>
                  <option value="">Select a class...</option>
                  {levelOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="admin-studio-field">
                <span>Subject</span>
                <select value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>
                  <option value="">Select a subject...</option>
                  {subjectOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="admin-studio-field">
                <span>Exam Goal</span>
                <select value={examGoalId} onChange={(event) => setExamGoalId(event.target.value)}>
                  <option value="">Select an exam goal...</option>
                  {examGoalOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {levelId && subjectId && examGoalId && matchingBooks.length === 0 && (
              <p>No book exists for this Class + Subject + Exam Goal combination yet -- create one under Masters &rarr; Books first.</p>
            )}

            {matchingBooks.length > 1 && (
              <label className="admin-studio-field">
                <span>Book</span>
                <select value={bookId} onChange={(event) => setBookId(event.target.value)}>
                  <option value="">Select a book...</option>
                  {matchingBooks.map((book) => (
                    <option key={book.id} value={book.id}>
                      {book.name} ({book.nameCode})
                    </option>
                  ))}
                </select>
              </label>
            )}

            {bookId && (
              <>
                {chaptersLoading ? (
                  <div className="admin-bulk-pipeline-empty">Loading chapters...</div>
                ) : chapters.length === 0 ? (
                  <div className="admin-bulk-pipeline-empty">
                    No chapters yet for {selectedBook?.name}. Add one to get started.
                  </div>
                ) : (
                  <table className="admin-exam-types-table">
                    <thead>
                      <tr>
                        <th>Chapter #</th>
                        <th>Chapter Name</th>
                        <th>Display Order</th>
                        <th>Sections</th>
                        <th>Active</th>
                        <th>Hidden</th>
                        <th aria-label="Actions" />
                      </tr>
                    </thead>
                    <tbody>
                      {chapters.map((chapter) => (
                        <tr key={chapter.chapterNumber}>
                          <td className="admin-exam-types-id-cell">{chapter.chapterNumber}</td>
                          <td>{chapter.chapterName}</td>
                          <td>{chapter.displayOrder}</td>
                          <td>{chapter.rowCount}</td>
                          <td>
                            <button
                              type="button"
                              className={`admin-bulk-pipeline-status-badge ${chapter.isActive ? "is-completed" : "is-aborted"}`}
                              onClick={() => toggleActive(chapter)}
                              disabled={togglingKey === `active-${chapter.chapterNumber}`}
                            >
                              {chapter.isActive ? "Active" : "Inactive"}
                            </button>
                          </td>
                          <td>
                            <button
                              type="button"
                              className={`admin-bulk-pipeline-status-badge ${chapter.isHidden ? "is-aborted" : "is-completed"}`}
                              onClick={() => toggleHidden(chapter)}
                              disabled={togglingKey === `hidden-${chapter.chapterNumber}`}
                            >
                              {chapter.isHidden ? "Hidden" : "Visible"}
                            </button>
                          </td>
                          <td className="admin-exam-types-row-actions">
                            <button
                              type="button"
                              className="admin-exam-types-icon-button"
                              aria-label={`Rename ${chapter.chapterName}`}
                              onClick={() => openRenameModal(chapter)}
                            >
                              <EditIcon />
                            </button>
                            <button
                              type="button"
                              className="admin-exam-types-icon-button is-danger"
                              aria-label={`Delete ${chapter.chapterName}`}
                              onClick={() => openDeleteModal(chapter)}
                            >
                              <TrashIcon />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </>
        )}
      </div>

      {createOpen && (
        <div className="modal-backdrop" onClick={() => !creating && setCreateOpen(false)}>
          <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="close-button" aria-label="Close" onClick={() => setCreateOpen(false)} disabled={creating}>
              &times;
            </button>
            <h2>Add Chapter</h2>
            <form className="admin-exam-types-form" onSubmit={handleCreateSubmit}>
              <label className="admin-studio-field">
                <span>Chapter Number</span>
                <input
                  value={createForm.chapterNumber}
                  onChange={(event) => setCreateForm((current) => ({ ...current, chapterNumber: event.target.value }))}
                  placeholder="e.g. 7"
                  maxLength={40}
                  autoFocus
                  required
                />
              </label>
              <label className="admin-studio-field">
                <span>Chapter Name</span>
                <input
                  value={createForm.chapterName}
                  onChange={(event) => setCreateForm((current) => ({ ...current, chapterName: event.target.value }))}
                  placeholder="e.g. Tissues in Action"
                  maxLength={255}
                  required
                />
              </label>
              <label className="admin-studio-field">
                <span>Display Order (optional)</span>
                <input
                  type="number"
                  value={createForm.displayOrder}
                  onChange={(event) => setCreateForm((current) => ({ ...current, displayOrder: event.target.value }))}
                  placeholder="Leave blank to add at the end"
                />
              </label>
              {createError && <p className="error-text">{createError}</p>}
              <div className="admin-bulk-pipeline-dialog-actions">
                <button type="button" className="ghost-button" onClick={() => setCreateOpen(false)} disabled={creating}>
                  Cancel
                </button>
                <button type="submit" className="primary-button" disabled={creating}>
                  {creating ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {renamingChapter && (
        <div className="modal-backdrop" onClick={() => !renaming && setRenamingChapter(null)}>
          <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="close-button" aria-label="Close" onClick={() => setRenamingChapter(null)} disabled={renaming}>
              &times;
            </button>
            <h2>Rename Chapter {renamingChapter.chapterNumber}</h2>
            <form className="admin-exam-types-form" onSubmit={handleRenameSubmit}>
              <label className="admin-studio-field">
                <span>Chapter Name</span>
                <input value={renameValue} onChange={(event) => setRenameValue(event.target.value)} autoFocus required maxLength={255} />
              </label>
              {renameError && <p className="error-text">{renameError}</p>}
              <div className="admin-bulk-pipeline-dialog-actions">
                <button type="button" className="ghost-button" onClick={() => setRenamingChapter(null)} disabled={renaming}>
                  Cancel
                </button>
                <button type="submit" className="primary-button" disabled={renaming}>
                  {renaming ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deletingChapter && (
        <div className="modal-backdrop" onClick={closeDeleteModal}>
          <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="close-button" aria-label="Close" onClick={closeDeleteModal} disabled={deleting}>
              &times;
            </button>
            <h2>Delete Chapter {deletingChapter.chapterNumber}</h2>
            <p>
              This will permanently delete <strong>{deletingChapter.chapterName}</strong> and everything under it (sections,
              concepts, cards, practice sets). This cannot be undone.
            </p>

            {deletionPreviewLoading && <p>Loading what this will delete...</p>}

            {!deletionPreviewLoading && deletionPreview && (
              <ul className="admin-content-editor-delete-summary">
                <li>{deletionPreview.sectionCount} section(s)</li>
                <li>{deletionPreview.conceptCount} concept(s)</li>
                <li>{deletionPreview.contentCardCount} content card(s)</li>
                <li>{deletionPreview.practiceSetCount} practice set(s)</li>
                <li>{deletionPreview.exerciseQuestionCount} chapter-end exercise question(s)</li>
                {(deletionPreview.studentAttemptCount > 0 ||
                  deletionPreview.studentMasteryCount > 0 ||
                  deletionPreview.preWarmupAttemptCount > 0 ||
                  deletionPreview.hotsAttemptCount > 0) && (
                  <li className="admin-content-editor-delete-summary-warning">
                    Real student history will be permanently destroyed, not just orphaned: {deletionPreview.studentAttemptCount} practice
                    attempt(s), {deletionPreview.studentMasteryCount} mastery record(s), {deletionPreview.preWarmupAttemptCount} pre-warmup
                    attempt(s), {deletionPreview.hotsAttemptCount} HOTS attempt(s).
                  </li>
                )}
              </ul>
            )}

            {deletionError && <p className="error-text">{deletionError}</p>}

            <label className="admin-studio-field">
              <span>
                Type <strong>{deletingChapter.chapterNumber}</strong> to confirm
              </span>
              <input value={deletionConfirmText} onChange={(event) => setDeletionConfirmText(event.target.value)} autoFocus />
            </label>

            <div className="admin-bulk-pipeline-dialog-actions">
              <button type="button" className="ghost-button" onClick={closeDeleteModal} disabled={deleting}>
                Cancel
              </button>
              <button
                type="button"
                className="ghost-button admin-pipeline-runs-danger"
                onClick={handleConfirmDelete}
                disabled={deleting || deletionPreviewLoading || deletionConfirmText.trim() !== String(deletingChapter.chapterNumber)}
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
