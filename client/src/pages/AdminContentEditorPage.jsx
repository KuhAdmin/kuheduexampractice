import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getContentEditorBooks,
  getContentEditorTree,
  renameContentEditorChapter,
  renameContentEditorSection,
  renameContentEditorConcept,
  setContentEditorSectionVisibility,
  setContentEditorConceptVisibility,
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
// "Explore" mirrors the student Explore tab exactly (StudentConceptLearningPage.jsx's
// EXPLORE_STEPS): Simple/Story/Compare are the SAME contentuitab="teaching"
// cards as "Learn" below, just different processorkeys, and "Deep Dive" is
// contentuitab="deeplearning" (that pipeline only ever produces
// processorkey="misconceptions" today, so no further split needed there).
// "Learn" is what's left of "teaching" once those three processorkeys are
// pulled out -- explain (the student Learn tab's own content).
const EXPLORE_SUB_GROUPS = [
  { key: "simple", label: "Simple", match: (card) => card.contentuitab === "teaching" && card.processorkey === "eli5" },
  { key: "story", label: "Story", match: (card) => card.contentuitab === "teaching" && card.processorkey === "storymode" },
  { key: "deepdive", label: "Deep Dive", match: (card) => card.contentuitab === "deeplearning" },
  { key: "compare", label: "Compare", match: (card) => card.contentuitab === "teaching" && card.processorkey === "analogy" },
];

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
    key: "learn",
    label: "Learn",
    description: "Core structured explanation",
    colorClass: "is-green",
    match: (card) => card.contentuitab === "teaching" && card.processorkey === "explain",
  },
  {
    key: "explore",
    label: "Explore",
    description: "Simple, Story, Deep Dive & Compare",
    colorClass: "is-lilac",
    match: (card) => EXPLORE_SUB_GROUPS.some((sub) => sub.match(card)),
    subGroups: EXPLORE_SUB_GROUPS,
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
    key: "extraction",
    label: "Concepts",
    description: "Extracted characters, setting & ideas",
    colorClass: "is-blue",
    match: (card) => card.contentuitab === "extraction",
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

// One card belongs to exactly one top-level group (first match wins), same
// as before. Groups declaring `subGroups` (currently just "Explore") ALSO
// get their cards split a second time within that group, one match-wins
// pass against their own sub-list -- cards matching none of a group's
// subGroups fall into a synthetic "Other" bucket for that group so nothing
// silently disappears if a new processorkey shows up under an existing
// contentuitab later.
const groupCardsByType = (conceptCards) => {
  const byKey = new Map();
  conceptCards.forEach((card) => {
    const group = getCardGroup(card);
    if (!byKey.has(group.key)) byKey.set(group.key, { group, cards: [] });
    byKey.get(group.key).cards.push(card);
  });

  return [...CONTENT_TYPE_GROUPS, OTHER_GROUP]
    .map((group) => byKey.get(group.key))
    .filter(Boolean)
    .map((entry) => {
      if (!entry.group.subGroups) return entry;
      const bySubKey = new Map();
      entry.cards.forEach((card) => {
        const subGroup = entry.group.subGroups.find((sub) => sub.match(card));
        const subKey = subGroup?.key || "other";
        if (!bySubKey.has(subKey)) {
          bySubKey.set(subKey, { subGroup: subGroup || { key: "other", label: "Other" }, cards: [] });
        }
        bySubKey.get(subKey).cards.push(card);
      });
      const subGroups = [...entry.group.subGroups, { key: "other", label: "Other" }]
        .map((sub) => bySubKey.get(sub.key))
        .filter(Boolean);
      return { ...entry, subGroups };
    });
};

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

  const [cards, setCards] = useState([]);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

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
      return;
    }
    setTreeLoading(true);
    setSelectedSectionId("");
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
  };

  // A concept's content only becomes visible once its OWN section's cards
  // are loaded (cards are fetched once per section, shared by every
  // concept in it) -- so expanding a concept still needs to trigger the
  // same section-level load as clicking the section itself would.
  const handleSelectConcept = (section) => {
    setSelectedSectionId(section.id);
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

  // Bulk-writing content_card.is_hidden (the server's cascade) always
  // leaves every affected card at the SAME is_hidden value, so the
  // resulting visible count is deterministic without a refetch: hiding ->
  // visible = 0, un-hiding -> visible = total.
  const handleToggleSectionVisibility = async (section, nextHidden) => {
    setError("");
    try {
      const result = await setContentEditorSectionVisibility(section.id, nextHidden);
      const isHidden = result.section.isHidden;
      setTree((current) =>
        current.map((chapter) => ({
          ...chapter,
          sections: chapter.sections.map((s) =>
            s.id !== section.id
              ? s
              : {
                  ...s,
                  isHidden,
                  cardCount: { ...s.cardCount, visible: isHidden ? 0 : s.cardCount.total },
                  concepts: s.concepts.map((c) => ({
                    ...c,
                    isHidden,
                    cardCount: { ...c.cardCount, visible: isHidden ? 0 : c.cardCount.total },
                  })),
                }
          ),
        }))
      );
      if (selectedSection?.id === section.id) {
        setCards((current) => current.map((card) => ({ ...card, isHidden })));
      }
    } catch (toggleError) {
      setError(toggleError.message || "Failed to update visibility.");
    }
  };

  const handleToggleConceptVisibility = async (section, concept, nextHidden) => {
    setError("");
    try {
      const result = await setContentEditorConceptVisibility(concept.assessmentUnitId, nextHidden);
      const isHidden = result.concept.isHidden;
      setTree((current) =>
        current.map((chapter) => ({
          ...chapter,
          sections: chapter.sections.map((s) => {
            if (s.id !== section.id) return s;
            let visibleDelta = 0;
            const concepts = s.concepts.map((c) => {
              if (c.assessmentUnitId !== concept.assessmentUnitId) return c;
              const newVisible = isHidden ? 0 : c.cardCount.total;
              visibleDelta = newVisible - c.cardCount.visible;
              return { ...c, isHidden, cardCount: { ...c.cardCount, visible: newVisible } };
            });
            return { ...s, concepts, cardCount: { ...s.cardCount, visible: s.cardCount.visible + visibleDelta } };
          }),
        }))
      );
      if (selectedSection?.id === section.id) {
        setCards((current) =>
          current.map((card) =>
            card.assessmentUnitId === concept.assessmentUnitId ? { ...card, isHidden } : card
          )
        );
      }
    } catch (toggleError) {
      setError(toggleError.message || "Failed to update visibility.");
    }
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

  // Content-type groups (Assessment/Explore/Simple/etc.) aren't real
  // entities in the database -- unlike Section/Concept, there's no
  // mst_chapter.is_hidden-style column to toggle. "Hide this group" just
  // means bulk-hiding every card currently in it, reusing the existing
  // per-card endpoint (which already enforces the same concept/section
  // ancestry lock -- see contentEditorService.js's assertCardAncestryVisible)
  // rather than adding a new bulk endpoint for what's ultimately N of the
  // same PUT calls in parallel.
  const toggleGroupHidden = async (groupCards, nextHidden) => {
    setError("");
    const results = await Promise.allSettled(
      groupCards.map((card) =>
        updateContentEditorCard(card.id, {
          title: card.title,
          summary: card.summary,
          details: card.details,
          isHidden: nextHidden,
        })
      )
    );
    const failures = results.filter((result) => result.status === "rejected");
    if (failures.length) {
      setError(
        `Failed to update ${failures.length} of ${groupCards.length} card(s): ${
          failures[0].reason?.message || "unknown error"
        }`
      );
    }
    if (selectedSection?.sourceSectionId) {
      await loadCards(selectedSection.sourceSectionId);
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

  // Keyed the same way as conceptGroups above -- "" is the root/section-scoped
  // (not concept-specific) group. AdminContentTree renders this directly as
  // each concept's (or the section's "General Content" pseudo-concept's)
  // own tree children now, so it's passed down as a lookup rather than
  // rendered here.
  const conceptGroupsByAssessmentUnitId = useMemo(
    () => new Map(conceptGroups.map((group) => [group.assessmentUnitId, group.typeGroups])),
    [conceptGroups]
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
              cardsLoading={cardsLoading}
              conceptGroupsByAssessmentUnitId={conceptGroupsByAssessmentUnitId}
              onSelectSection={handleSelectSection}
              onSelectConcept={handleSelectConcept}
              onRenameChapter={handleRenameChapter}
              onRenameSection={handleRenameSection}
              onRenameConcept={handleRenameConcept}
              onToggleSectionVisibility={handleToggleSectionVisibility}
              onToggleConceptVisibility={handleToggleConceptVisibility}
              onEditCard={openEditModal}
              onToggleCardHidden={toggleHidden}
              onToggleGroupHidden={toggleGroupHidden}
            />
          )}
        </div>
      )}

      {memoryHookUnits.map((unit) => (
        <MemoryHookPanel key={unit.assessmentUnitId} assessmentUnitId={unit.assessmentUnitId} label={unit.label} />
      ))}

      {editingCard && (
        <div className="modal-backdrop" onClick={closeEditModal}>
          <div className="modal-panel admin-content-editor-edit-modal" onClick={(event) => event.stopPropagation()}>
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
