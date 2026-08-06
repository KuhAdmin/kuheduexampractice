import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  getContentEditorBooks,
  getContentEditorChapters,
  getContentEditorCards,
  updateContentEditorCard,
  regenerateContentCardImage,
  regenerateMemoryHookImage,
  updateMemoryHookPrompt,
  generateMemoryHookPrompt,
  getDiagramMedia,
  uploadDiagramMedia,
  getMemoryHookMedia,
  uploadMemoryHookMedia,
  getStudentMemoryBoosterForUnit,
  getAdminExercisesActivitiesTabVisible,
  updateAdminExercisesActivitiesTabVisible,
} from "../api/client";

// Mirrors contentReadService.js's getDiagramsForSection filter -- only these
// cards actually have a content_card_media row to regenerate/upload against.
const isDiagramCard = (card) =>
  card.contentuitab === "pdfassets" || (card.contentuitab === "visual" && card.processorkey !== "ocr");

const MEMORY_HOOK_SECTIONS = [
  { key: "analogy", label: "Analogy" },
  { key: "visualHook", label: "Visual Hook" },
  { key: "curiosityHook", label: "Curiosity Hook" },
  { key: "memoryTrick", label: "Memory Trick" },
];

// Sections the server can draft a prompt for from the concept's existing
// learn content (see memoryHookImageService.js's generateMemoryHookPrompt).
// Analogy is excluded -- it already pre-fills from real backing text below.
const PROMPT_GENERATABLE_SECTIONS = new Set(["visualHook", "curiosityHook", "memoryTrick"]);

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read the selected file."));
    reader.readAsDataURL(file);
  });

const CardImagePanel = ({ card }) => {
  const [media, setMedia] = useState(null);
  const [loading, setLoading] = useState(true);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadMedia = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getDiagramMedia(card.id);
      setMedia(result?.media || null);
      setPrompt(result?.media?.promptText || "");
    } catch (loadError) {
      setError(loadError.message || "Failed to load image.");
    } finally {
      setLoading(false);
    }
  }, [card.id]);

  useEffect(() => {
    loadMedia();
  }, [loadMedia]);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError("Enter a prompt to generate an image.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await regenerateContentCardImage(card.id, prompt.trim());
      await loadMedia();
    } catch (genError) {
      setError(genError.message || "Image generation failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const dataUrl = await readFileAsDataUrl(file);
      await uploadDiagramMedia(card.id, dataUrl, file.name);
      await loadMedia();
    } catch (uploadError) {
      setError(uploadError.message || "Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-studio-field">
      <span>Image</span>
      {loading ? (
        <p>Loading image...</p>
      ) : media ? (
        <div>
          <img
            src={media.mediaData}
            alt={card.title || "Card image"}
            style={{ maxWidth: "100%", maxHeight: 220, borderRadius: 8, display: "block", marginBottom: 8 }}
          />
          <p style={{ fontSize: 12, opacity: 0.75 }}>
            Source: {media.source} {media.modelName ? `· ${media.modelName}` : ""}
          </p>
        </div>
      ) : (
        <p>No image yet.</p>
      )}
      <textarea
        rows={3}
        value={prompt}
        placeholder="Describe the image to generate..."
        onChange={(event) => setPrompt(event.target.value)}
      />
      <div className="admin-bulk-pipeline-dialog-actions">
        <label className="ghost-button" style={{ cursor: "pointer" }}>
          Upload file
          <input type="file" accept="image/*" onChange={handleUpload} disabled={busy} hidden />
        </label>
        <button type="button" className="primary-button" onClick={handleGenerate} disabled={busy}>
          {busy ? "Working..." : media ? "Regenerate image" : "Generate image"}
        </button>
      </div>
      {error && <p className="error-text">{error}</p>}
    </div>
  );
};

// Only "analogy" has real backing text today (content_concept_memory.analogy,
// imported from a teaching/analogy card -- see conceptImportService.js).
// visualHook/curiosityHook/memoryTrick have no storage anywhere in the
// current schema (studentContentService.js's getLayer2Memory hardcodes them
// null), so there's nothing to default those 3 from yet even though this
// object is shaped to cover all 4 -- it'll start working for them for free
// the moment that gap is closed on the import side.
const MEMORY_HOOK_PROMPT_SOURCE_FIELD = {
  analogy: "analogy",
  visualHook: "visualHook",
  curiosityHook: "curiosityHook",
  memoryTrick: "memoryTrick",
};

const MemoryHookPanel = ({ assessmentUnitId, label }) => {
  const [open, setOpen] = useState(false);
  const [media, setMedia] = useState(null);
  const [conceptMemory, setConceptMemory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState(null);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [viewImageOpen, setViewImageOpen] = useState(false);

  const loadMedia = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [mediaResult, memoryResult] = await Promise.all([
        getMemoryHookMedia(assessmentUnitId),
        getStudentMemoryBoosterForUnit(assessmentUnitId).catch(() => null),
      ]);
      setMedia(mediaResult?.media || null);
      setConceptMemory(memoryResult || null);
    } catch (loadError) {
      setError(loadError.message || "Failed to load memory hook media.");
    } finally {
      setLoading(false);
    }
  }, [assessmentUnitId]);

  useEffect(() => {
    if (open) {
      loadMedia();
    }
  }, [open, loadMedia]);

  const openSection = (sectionKey) => {
    setActiveSection(sectionKey);
    setViewImageOpen(false);
    const sourceField = MEMORY_HOOK_PROMPT_SOURCE_FIELD[sectionKey];
    setPrompt(media?.[sectionKey]?.promptText || conceptMemory?.[sourceField] || "");
    setError("");
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError("Enter a prompt to generate an image.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await regenerateMemoryHookImage(assessmentUnitId, activeSection, prompt.trim());
      await loadMedia();
    } catch (genError) {
      setError(genError.message || "Image generation failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleGeneratePrompt = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await generateMemoryHookPrompt(assessmentUnitId, activeSection);
      setPrompt(result.prompt);
      // Persist immediately when there's already an image to attach the
      // prompt to (the update-prompt endpoint has nothing to save against
      // otherwise -- for a first-ever image, this prompt is saved as part
      // of the "Generate image" call below instead).
      if (media?.[activeSection]) {
        const saved = await updateMemoryHookPrompt(assessmentUnitId, activeSection, result.prompt);
        setMedia((current) => ({ ...current, [activeSection]: saved }));
      }
    } catch (genError) {
      setError(genError.message || "Prompt generation failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleSavePrompt = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await updateMemoryHookPrompt(assessmentUnitId, activeSection, prompt.trim());
      setMedia((current) => ({ ...current, [activeSection]: result }));
    } catch (saveError) {
      setError(saveError.message || "Failed to save prompt.");
    } finally {
      setBusy(false);
    }
  };

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const dataUrl = await readFileAsDataUrl(file);
      await uploadMemoryHookMedia(assessmentUnitId, activeSection, dataUrl, file.name);
      await loadMedia();
    } catch (uploadError) {
      setError(uploadError.message || "Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  const activeMedia = activeSection ? media?.[activeSection] : null;

  return (
    <div className="admin-bulk-pipeline-grid-shell" style={{ padding: 16, marginTop: 12 }}>
      <button type="button" className="ghost-button" onClick={() => setOpen((current) => !current)}>
        {open ? "Hide" : "Show"} Memory Hook Images — {label}
      </button>
      {open && (
        <div style={{ marginTop: 12 }}>
          {loading ? (
            <p>Loading...</p>
          ) : (
            <div className="admin-bulk-pipeline-header-actions" style={{ flexWrap: "wrap" }}>
              {MEMORY_HOOK_SECTIONS.map((section) => (
                <button
                  key={section.key}
                  type="button"
                  className="ghost-button"
                  onClick={() => openSection(section.key)}
                >
                  {section.label} {media?.[section.key] ? "✓" : ""}
                </button>
              ))}
            </div>
          )}
          {activeSection && (
            <div className="admin-studio-field" style={{ marginTop: 12 }}>
              <span>{MEMORY_HOOK_SECTIONS.find((s) => s.key === activeSection)?.label}</span>
              {activeMedia?.mediaData && (
                <img
                  src={activeMedia.mediaData}
                  alt={activeSection}
                  style={{ maxWidth: "100%", maxHeight: 180, borderRadius: 8, display: "block", marginBottom: 8 }}
                />
              )}
              <textarea
                rows={3}
                value={prompt}
                placeholder="Describe the image to generate..."
                onChange={(event) => setPrompt(event.target.value)}
              />
              <div className="admin-bulk-pipeline-dialog-actions">
                {activeMedia?.mediaData && (
                  <button type="button" className="ghost-button" onClick={() => setViewImageOpen(true)}>
                    View image
                  </button>
                )}
                {PROMPT_GENERATABLE_SECTIONS.has(activeSection) && (
                  <button type="button" className="ghost-button" onClick={handleGeneratePrompt} disabled={busy}>
                    {busy ? "Working..." : "Generate prompt from concept"}
                  </button>
                )}
                {activeMedia && (
                  <button type="button" className="ghost-button" onClick={handleSavePrompt} disabled={busy}>
                    Save prompt
                  </button>
                )}
                <label className="ghost-button" style={{ cursor: "pointer" }}>
                  Upload file
                  <input type="file" accept="image/*" onChange={handleUpload} disabled={busy} hidden />
                </label>
                <button type="button" className="primary-button" onClick={handleGenerate} disabled={busy}>
                  {busy ? "Working..." : activeMedia ? "Regenerate image" : "Generate image"}
                </button>
              </div>
              {error && <p className="error-text">{error}</p>}
            </div>
          )}
        </div>
      )}

      {viewImageOpen && activeMedia?.mediaData && (
        <div className="modal-backdrop" onClick={() => setViewImageOpen(false)}>
          <div className="modal-panel is-wide" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="close-button"
              aria-label="Close"
              onClick={() => setViewImageOpen(false)}
            >
              &times;
            </button>
            <h2>{MEMORY_HOOK_SECTIONS.find((s) => s.key === activeSection)?.label}</h2>
            <img src={activeMedia.mediaData} alt={activeSection} style={{ maxWidth: "100%", borderRadius: 8 }} />
          </div>
        </div>
      )}
    </div>
  );
};

export const AdminContentEditorPage = () => {
  const [books, setBooks] = useState([]);
  const [booksLoading, setBooksLoading] = useState(true);
  const [selectedBookId, setSelectedBookId] = useState("");

  const [chapters, setChapters] = useState([]);
  const [chaptersLoading, setChaptersLoading] = useState(false);
  const [selectedChapterId, setSelectedChapterId] = useState("");

  const [cards, setCards] = useState([]);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [editingCard, setEditingCard] = useState(null);
  const [form, setForm] = useState({ title: "", summary: "", detailsText: "", isHidden: false });
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Global, not scoped to the book/chapter picker below -- one switch turns
  // the Exercises/Activities tab on/off for every student everywhere (see
  // StudentConceptLearningPage.jsx's TABS filtering). null while loading so
  // the checkbox doesn't flash an initial state before the real value
  // arrives.
  const [exercisesActivitiesTabVisible, setExercisesActivitiesTabVisibleState] = useState(null);
  const [exercisesActivitiesTabSaving, setExercisesActivitiesTabSaving] = useState(false);

  useEffect(() => {
    getAdminExercisesActivitiesTabVisible()
      .then((result) => setExercisesActivitiesTabVisibleState(result?.visible ?? false))
      .catch(() => setExercisesActivitiesTabVisibleState(false));
  }, []);

  const handleToggleExercisesActivitiesTab = async (event) => {
    const next = event.target.checked;
    setExercisesActivitiesTabVisibleState(next);
    setExercisesActivitiesTabSaving(true);
    setError("");
    try {
      await updateAdminExercisesActivitiesTabVisible(next);
    } catch (toggleError) {
      setExercisesActivitiesTabVisibleState(!next);
      setError(toggleError.message || "Failed to update Exercises/Activities tab visibility.");
    } finally {
      setExercisesActivitiesTabSaving(false);
    }
  };

  useEffect(() => {
    getContentEditorBooks()
      .then((result) => setBooks(result?.books || []))
      .catch((loadError) => setError(loadError.message || "Failed to load books."))
      .finally(() => setBooksLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedBookId) {
      setChapters([]);
      setSelectedChapterId("");
      return;
    }
    setChaptersLoading(true);
    setSelectedChapterId("");
    setCards([]);
    getContentEditorChapters(selectedBookId)
      .then((result) => setChapters(result?.chapters || []))
      .catch((loadError) => setError(loadError.message || "Failed to load chapters."))
      .finally(() => setChaptersLoading(false));
  }, [selectedBookId]);

  const selectedChapter = useMemo(
    () => chapters.find((chapter) => String(chapter.id) === String(selectedChapterId)) || null,
    [chapters, selectedChapterId]
  );

  const loadCards = useCallback(async (sourceSectionId) => {
    setCardsLoading(true);
    setError("");
    try {
      const result = await getContentEditorCards(sourceSectionId);
      setCards(result?.cards || []);
    } catch (loadError) {
      setError(loadError.message || "Failed to load content cards.");
    } finally {
      setCardsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedChapter?.sourceSectionId) {
      setCards([]);
      return;
    }
    loadCards(selectedChapter.sourceSectionId);
  }, [selectedChapter, loadCards]);

  const openEditModal = (card) => {
    setEditingCard(card);
    setForm({
      title: card.title || "",
      summary: card.summary || "",
      detailsText: JSON.stringify(card.details ?? [], null, 2),
      isHidden: Boolean(card.isHidden),
    });
    setFormError("");
  };

  const closeEditModal = () => {
    if (submitting) return;
    setEditingCard(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    let details;
    try {
      details = form.detailsText.trim() ? JSON.parse(form.detailsText) : [];
    } catch {
      setFormError("Details must be valid JSON.");
      return;
    }

    setSubmitting(true);
    setFormError("");
    try {
      await updateContentEditorCard(editingCard.id, {
        title: form.title.trim(),
        summary: form.summary.trim(),
        details,
        isHidden: form.isHidden,
      });
      setNotice(`Saved "${form.title.trim()}".`);
      setEditingCard(null);
      if (selectedChapter?.sourceSectionId) {
        await loadCards(selectedChapter.sourceSectionId);
      }
    } catch (submitError) {
      setFormError(submitError.message || "Failed to save card.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleHidden = async (card) => {
    setError("");
    try {
      await updateContentEditorCard(card.id, {
        title: card.title,
        summary: card.summary,
        details: card.details,
        isHidden: !card.isHidden,
      });
      if (selectedChapter?.sourceSectionId) {
        await loadCards(selectedChapter.sourceSectionId);
      }
    } catch (toggleError) {
      setError(toggleError.message || "Failed to update visibility.");
    }
  };

  const memoryHookUnits = useMemo(() => {
    const seen = new Map();
    cards.forEach((card) => {
      if (card.assessmentUnitId && !seen.has(card.assessmentUnitId)) {
        seen.set(card.assessmentUnitId, card.primaryConcept || card.assessmentUnitId);
      }
    });
    return Array.from(seen.entries()).map(([assessmentUnitId, label]) => ({ assessmentUnitId, label }));
  }, [cards]);

  let lastConcept = null;

  return (
    <section className="admin-bulk-pipeline-page">
      <header className="admin-bulk-pipeline-header">
        <div>
          <span className="eyebrow">Admin module</span>
          <h1>Content Editor</h1>
          <p>Edit card text, show/hide content, and generate or replace images.</p>
        </div>
        <label className="admin-exam-types-checkbox-field">
          <input
            type="checkbox"
            checked={Boolean(exercisesActivitiesTabVisible)}
            disabled={exercisesActivitiesTabVisible === null || exercisesActivitiesTabSaving}
            onChange={handleToggleExercisesActivitiesTab}
          />
          <span>Show Exercises/Activities tab to students</span>
        </label>
      </header>

      {notice && <div className="admin-bulk-pipeline-concurrency">{notice}</div>}
      {error && <p className="error-text">{error}</p>}

      <div className="admin-bulk-pipeline-header-actions" style={{ flexWrap: "wrap", gap: 16 }}>
        <label className="admin-studio-field" style={{ minWidth: 260 }}>
          <span>Book</span>
          <select
            value={selectedBookId}
            onChange={(event) => setSelectedBookId(event.target.value)}
            disabled={booksLoading}
          >
            <option value="">Select a book...</option>
            {books.map((book) => (
              <option key={book.id} value={book.id}>
                {book.name} ({book.subjectName} · {book.levelName})
              </option>
            ))}
          </select>
        </label>

        <label className="admin-studio-field" style={{ minWidth: 260 }}>
          <span>Chapter / Section</span>
          <select
            value={selectedChapterId}
            onChange={(event) => setSelectedChapterId(event.target.value)}
            disabled={!selectedBookId || chaptersLoading}
          >
            <option value="">Select a chapter...</option>
            {chapters.map((chapter) => (
              <option key={chapter.id} value={chapter.id} disabled={!chapter.sourceSectionId}>
                {chapter.chapterNumber}
                {chapter.sectionNumber ? `.${chapter.sectionNumber}` : ""} — {chapter.topicName || chapter.chapterName}
                {!chapter.sourceSectionId ? " (not imported)" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      {memoryHookUnits.map((unit) => (
        <MemoryHookPanel key={unit.assessmentUnitId} assessmentUnitId={unit.assessmentUnitId} label={unit.label} />
      ))}

      <div className="admin-bulk-pipeline-grid-shell" style={{ marginTop: 16 }}>
        {cardsLoading ? (
          <div className="admin-bulk-pipeline-empty">Loading cards...</div>
        ) : !selectedChapter?.sourceSectionId ? (
          <div className="admin-bulk-pipeline-empty">Select a book and chapter to browse its content cards.</div>
        ) : cards.length === 0 ? (
          <div className="admin-bulk-pipeline-empty">No content cards found for this section.</div>
        ) : (
          <table className="admin-exam-types-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Type</th>
                <th>Status</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {cards.map((card) => {
                const showConceptHeader = card.primaryConcept !== lastConcept;
                lastConcept = card.primaryConcept;
                return (
                  <Fragment key={card.id}>
                    {showConceptHeader && card.primaryConcept && (
                      <tr>
                        <td colSpan={4} style={{ fontWeight: 600, opacity: 0.75 }}>
                          {card.primaryConcept}
                        </td>
                      </tr>
                    )}
                    <tr>
                      <td>{card.title || "(untitled)"}</td>
                      <td>
                        <span className="admin-exam-types-code-badge">
                          {card.contentuitab}
                          {card.processorkey ? ` / ${card.processorkey}` : ""}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`admin-bulk-pipeline-status-badge ${
                            card.isHidden ? "is-aborted" : "is-completed"
                          }`}
                        >
                          {card.isHidden ? "Hidden" : "Visible"}
                        </span>
                      </td>
                      <td className="admin-exam-types-row-actions">
                        <button type="button" className="ghost-button" onClick={() => toggleHidden(card)}>
                          {card.isHidden ? "Show" : "Hide"}
                        </button>
                        <button type="button" className="primary-button" onClick={() => openEditModal(card)}>
                          Edit
                        </button>
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {editingCard && (
        <div className="modal-backdrop" onClick={closeEditModal}>
          <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="close-button" aria-label="Close" onClick={closeEditModal}>
              &times;
            </button>
            <h2>Edit Card</h2>
            <form className="admin-exam-types-form" onSubmit={handleSubmit}>
              <label className="admin-studio-field">
                <span>Title</span>
                <input
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  autoFocus
                />
              </label>
              <label className="admin-studio-field">
                <span>Summary</span>
                <textarea
                  rows={3}
                  value={form.summary}
                  onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))}
                />
              </label>
              <label className="admin-studio-field">
                <span>Details (JSON)</span>
                <textarea
                  rows={10}
                  value={form.detailsText}
                  onChange={(event) => setForm((current) => ({ ...current, detailsText: event.target.value }))}
                  style={{ fontFamily: "monospace", fontSize: 13 }}
                />
              </label>
              <label className="admin-exam-types-checkbox-field">
                <input
                  type="checkbox"
                  checked={form.isHidden}
                  onChange={(event) => setForm((current) => ({ ...current, isHidden: event.target.checked }))}
                />
                <span>Hidden from students</span>
              </label>

              {isDiagramCard(editingCard) && <CardImagePanel card={editingCard} />}

              {formError && <p className="error-text">{formError}</p>}
              <div className="admin-bulk-pipeline-dialog-actions">
                <button type="button" className="ghost-button" onClick={closeEditModal} disabled={submitting}>
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
