import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getContentEditorBooks,
  getContentEditorTree,
  renameContentEditorChapter,
  renameContentEditorSection,
  renameContentEditorConcept,
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
import { AdminContentDetailsEditor } from "../components/AdminContentDetailsEditor";
import { AdminContentTree } from "../components/AdminContentTree";
import { useAuth } from "../context/authHooks";
import { isAdmin } from "../roles";

// Mirrors the student "Deep Learn" action-row groups (StudentSectionDetailPage.jsx)
// so moderators -- who use the student app daily -- see the same shape of
// list here: color-coded, one row per content type, instead of one long
// flat table. Order here is also the display order. "Other" (below) catches
// any contentuitab that doesn't match one of these, so a future/unknown
// type is never silently dropped from the list.
const CONTENT_TYPE_GROUPS = [
  {
    key: "assessment",
    label: "Assessment",
    description: "MCQ, True/False, Case Study & more",
    colorClass: "is-violet",
    match: (card) => card.contentuitab === "assessment",
  },
  {
    key: "revision",
    label: "Revision",
    description: "Cheat sheets, mnemonics & flashcards",
    colorClass: "is-rose",
    match: (card) => card.contentuitab === "revision",
  },
  {
    key: "tutor",
    label: "Tutor Notes",
    description: "Interview, viva & coach prep",
    colorClass: "is-teal",
    match: (card) => card.contentuitab === "tutor",
  },
  {
    key: "teaching",
    label: "Teaching",
    description: "Explain, ELI5, analogy & story mode",
    colorClass: "is-green",
    match: (card) => card.contentuitab === "teaching",
  },
  {
    key: "extraction",
    label: "Concepts",
    description: "Extracted characters, setting & ideas",
    colorClass: "is-blue",
    match: (card) => card.contentuitab === "extraction",
  },
  {
    key: "deeplearning",
    label: "Deep Learning",
    description: "Misconceptions",
    colorClass: "is-lilac",
    match: (card) => card.contentuitab === "deeplearning",
  },
  {
    key: "textbook",
    label: "Exercises & Activities",
    description: "Textbook exercises & activities",
    colorClass: "is-amber",
    match: (card) => card.contentuitab === "textbook",
  },
];

const OTHER_GROUP = {
  key: "other",
  label: "Other",
  description: "Additional content",
  colorClass: "",
  match: () => true,
};

const getCardGroup = (card) => CONTENT_TYPE_GROUPS.find((group) => group.match(card)) || OTHER_GROUP;

// One card belongs to exactly one group (first match wins); groups with no
// cards for this concept are omitted, but the canonical order above is
// preserved for the ones that do have cards.
const groupCardsByType = (conceptCards) => {
  const byKey = new Map();
  conceptCards.forEach((card) => {
    const group = getCardGroup(card);
    if (!byKey.has(group.key)) byKey.set(group.key, { group, cards: [] });
    byKey.get(group.key).cards.push(card);
  });
  return [...CONTENT_TYPE_GROUPS, OTHER_GROUP].map((group) => byKey.get(group.key)).filter(Boolean);
};

const ContentGroupIcon = ({ type }) => {
  const paths = {
    assessment: <path d="M9 12.5 11 14.5 15 9.5 M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />,
    revision: <path d="M6 4h9a2 2 0 0 1 2 2v14l-6.5-3.5L4 20V6a2 2 0 0 1 2-2Z" />,
    tutor: <path d="M4 5h16v11H8l-4 4V5Z" />,
    teaching: <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3 11.2c.6.4 1 1 1 1.8h4c0-.8.4-1.4 1-1.8A6 6 0 0 0 12 3Z" />,
    extraction: <path d="M20.6 12 12 20.6 3.4 12 12 3.4 20.6 12ZM12 9.5v.01" />,
    deeplearning: <path d="M9 3a3 3 0 0 0-3 3v.3A3.5 3.5 0 0 0 4 9.5 3.5 3.5 0 0 0 6 16h.5A2.5 2.5 0 0 0 9 18.5V21m6-18a3 3 0 0 1 3 3v.3a3.5 3.5 0 0 1 2 3.2 3.5 3.5 0 0 1-2 3.2V13a2.5 2.5 0 0 1-2.5 2.5V21" />,
    textbook: <path d="M6 4h8l4 4v12H6V4ZM9 10h6M9 13h6M9 16h4" />,
    other: <path d="M12 12m-2 0a2 2 0 1 0 4 0 2 2 0 1 0-4 0" />,
  };
  return (
    <svg viewBox="0 0 24 24" className="admin-content-editor-action-icon" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6">
        {paths[type] || paths.other}
      </g>
    </svg>
  );
};

const ChevronIcon = ({ open }) => (
  <svg
    viewBox="0 0 24 24"
    className={`admin-content-editor-action-chevron ${open ? "is-open" : ""}`}
    aria-hidden="true"
  >
    <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
  </svg>
);

// Mirrors contentReadService.js's getDiagramsForSection filter -- only these
// cards actually have a content_card_media row to regenerate/upload against.
const isDiagramCard = (card) =>
  card.contentuitab === "pdfassets" || (card.contentuitab === "visual" && card.processorkey !== "ocr");

// Labels reflect where each section actually renders to students today
// (see StudentConceptLearningPage.jsx's MEDIA_SECTION_KEY_ALIASES) rather
// than the raw field name: "analogy" backs the Explore tab's "Compare"
// step, and "memoryTrick" is aliased to the Story step's Visual tab (it
// has no display of its own -- see that file's comment on the alias).
const MEMORY_HOOK_SECTIONS = [
  { key: "analogy", label: "Analogy/Compare" },
  { key: "visualHook", label: "Visual Hook" },
  { key: "curiosityHook", label: "Curiosity Hook" },
  { key: "memoryTrick", label: "Story Visual" },
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
  const { user } = useAuth();
  const canEditJson = isAdmin(user);

  const [books, setBooks] = useState([]);
  const [booksLoading, setBooksLoading] = useState(true);
  const [selectedBookId, setSelectedBookId] = useState("");

  const [tree, setTree] = useState([]);
  const [treeLoading, setTreeLoading] = useState(false);
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [selectedConceptId, setSelectedConceptId] = useState(null);

  const [cards, setCards] = useState([]);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [expandedGroups, setExpandedGroups] = useState(() => new Set());

  const [editingCard, setEditingCard] = useState(null);
  const [form, setForm] = useState({ title: "", summary: "", details: [], isHidden: false });
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
      setTree([]);
      setSelectedSectionId("");
      setSelectedConceptId(null);
      return;
    }
    setTreeLoading(true);
    setSelectedSectionId("");
    setSelectedConceptId(null);
    setCards([]);
    getContentEditorTree(selectedBookId)
      .then((result) => setTree(result?.chapters || []))
      .catch((loadError) => setError(loadError.message || "Failed to load chapters."))
      .finally(() => setTreeLoading(false));
  }, [selectedBookId]);

  const selectedSection = useMemo(() => {
    for (const chapter of tree) {
      const section = chapter.sections.find((s) => String(s.id) === String(selectedSectionId));
      if (section) return section;
    }
    return null;
  }, [tree, selectedSectionId]);

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
    if (!selectedSection?.sourceSectionId) {
      setCards([]);
      return;
    }
    loadCards(selectedSection.sourceSectionId);
  }, [selectedSection, loadCards]);

  const handleSelectSection = (section) => {
    setSelectedSectionId(section.id);
    setSelectedConceptId(null);
  };

  const handleSelectConcept = (section, concept) => {
    setSelectedSectionId(section.id);
    setSelectedConceptId(concept.assessmentUnitId);
  };

  const handleRenameChapter = async (chapterNumber, chapterName) => {
    const result = await renameContentEditorChapter(selectedBookId, chapterNumber, chapterName);
    setTree((current) =>
      current.map((chapter) =>
        chapter.chapterNumber === chapterNumber
          ? { ...chapter, chapterName: result.chapter.chapterName }
          : chapter
      )
    );
  };

  const handleRenameSection = async (id, topicName) => {
    const result = await renameContentEditorSection(id, topicName);
    setTree((current) =>
      current.map((chapter) => ({
        ...chapter,
        sections: chapter.sections.map((section) =>
          section.id === id ? { ...section, topicName: result.section.topicName } : section
        ),
      }))
    );
  };

  const handleRenameConcept = async (assessmentUnitId, primaryConcept) => {
    const result = await renameContentEditorConcept(assessmentUnitId, primaryConcept);
    setTree((current) =>
      current.map((chapter) => ({
        ...chapter,
        sections: chapter.sections.map((section) => ({
          ...section,
          concepts: section.concepts.map((concept) =>
            concept.assessmentUnitId === assessmentUnitId
              ? { ...concept, primaryConcept: result.concept.primaryConcept }
              : concept
          ),
        })),
      }))
    );
    // Already-loaded cards carry their own primaryConcept (from the
    // assessment_unit JOIN in listContentCardsForSection) -- patch those too
    // so the card list's group heading updates without a refetch.
    setCards((current) =>
      current.map((card) =>
        card.assessmentUnitId === assessmentUnitId
          ? { ...card, primaryConcept: result.concept.primaryConcept }
          : card
      )
    );
  };

  const openEditModal = (card) => {
    setEditingCard(card);
    setForm({
      title: card.title || "",
      summary: card.summary || "",
      details: card.details ?? [],
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

    setSubmitting(true);
    setFormError("");
    try {
      await updateContentEditorCard(editingCard.id, {
        title: form.title.trim(),
        summary: form.summary.trim(),
        details: form.details,
        isHidden: form.isHidden,
      });
      setNotice(`Saved "${form.title.trim()}".`);
      setEditingCard(null);
      if (selectedSection?.sourceSectionId) {
        await loadCards(selectedSection.sourceSectionId);
      }
    } catch (submitError) {
      setFormError(submitError.message || "Failed to save card.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleGroup = (groupKey) => {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
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
      if (selectedSection?.sourceSectionId) {
        await loadCards(selectedSection.sourceSectionId);
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

  // Same outer grouping the flat table used (first-seen concept order),
  // with cards inside each concept now further split into the color-coded
  // content-type action-rows below (mirrors the student "Deep Learn" tab).
  // Keyed by assessmentUnitId, NOT the primaryConcept display text -- two
  // different concepts can share identical text, and the tree above
  // selects/scopes by assessmentUnitId, so grouping by text could silently
  // merge or mis-scope cards from a different concept that happens to have
  // the same label.
  const conceptGroups = useMemo(() => {
    const byConcept = new Map();
    cards.forEach((card) => {
      const key = card.assessmentUnitId || "";
      if (!byConcept.has(key)) byConcept.set(key, { label: card.primaryConcept || "", cards: [] });
      byConcept.get(key).cards.push(card);
    });
    return Array.from(byConcept.entries()).map(([assessmentUnitId, { label, cards: conceptCards }]) => ({
      assessmentUnitId,
      concept: label,
      typeGroups: groupCardsByType(conceptCards),
    }));
  }, [cards]);

  const visibleConceptGroups = useMemo(
    () =>
      selectedConceptId
        ? conceptGroups.filter((group) => group.assessmentUnitId === selectedConceptId)
        : conceptGroups,
    [conceptGroups, selectedConceptId]
  );

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
      </div>

      {selectedBookId && (
        <div className="admin-studio-field" style={{ marginTop: 16 }}>
          <span>Chapters</span>
          {treeLoading ? (
            <div className="admin-bulk-pipeline-empty">Loading chapters...</div>
          ) : (
            <AdminContentTree
              tree={tree}
              selectedSectionId={selectedSectionId}
              selectedConceptId={selectedConceptId}
              onSelectSection={handleSelectSection}
              onSelectConcept={handleSelectConcept}
              onRenameChapter={handleRenameChapter}
              onRenameSection={handleRenameSection}
              onRenameConcept={handleRenameConcept}
            />
          )}
        </div>
      )}

      {memoryHookUnits.map((unit) => (
        <MemoryHookPanel key={unit.assessmentUnitId} assessmentUnitId={unit.assessmentUnitId} label={unit.label} />
      ))}

      <div className="admin-bulk-pipeline-grid-shell" style={{ marginTop: 16 }}>
        {cardsLoading ? (
          <div className="admin-bulk-pipeline-empty">Loading cards...</div>
        ) : !selectedSection?.sourceSectionId ? (
          <div className="admin-bulk-pipeline-empty">Select a book and a section from the tree to browse its content cards.</div>
        ) : cards.length === 0 ? (
          <div className="admin-bulk-pipeline-empty">No content cards found for this section.</div>
        ) : (
          visibleConceptGroups.map(({ assessmentUnitId, concept, typeGroups }) => (
            <div key={assessmentUnitId || "__no_concept"} className="admin-content-editor-concept">
              {concept && <h3 className="admin-content-editor-concept-title">{concept}</h3>}
              <div className="admin-content-editor-action-list">
                {typeGroups.map(({ group, cards: groupCards }) => {
                  const groupKey = `${assessmentUnitId}::${group.key}`;
                  const isOpen = expandedGroups.has(groupKey);
                  return (
                    <div key={groupKey} className="admin-content-editor-action-wrap">
                      <button
                        type="button"
                        className={`admin-content-editor-action ${group.colorClass}`}
                        onClick={() => toggleGroup(groupKey)}
                      >
                        <span className={`admin-content-editor-action-mark ${group.colorClass}`}>
                          <ContentGroupIcon type={group.key} />
                        </span>
                        <span className="admin-content-editor-action-copy">
                          <strong>{group.label}</strong>
                          <small>
                            {groupCards.length} card{groupCards.length === 1 ? "" : "s"} · {group.description}
                          </small>
                        </span>
                        <ChevronIcon open={isOpen} />
                      </button>
                      {isOpen && (
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
                            {groupCards.map((card) => (
                              <tr key={card.id}>
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
                                <td className="admin-content-editor-row-actions">
                                  <button type="button" className="ghost-button" onClick={() => toggleHidden(card)}>
                                    {card.isHidden ? "Show" : "Hide"}
                                  </button>
                                  <button type="button" className="primary-button" onClick={() => openEditModal(card)}>
                                    Edit
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
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
              <AdminContentDetailsEditor
                details={form.details}
                onChange={(details) => setForm((current) => ({ ...current, details }))}
                canEditJson={canEditJson}
              />
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
