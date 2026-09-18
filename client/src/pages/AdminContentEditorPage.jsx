import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getContentEditorBooks,
  getContentEditorTree,
  renameContentEditorChapter,
  renameContentEditorSection,
  renameContentEditorConcept,
  setContentEditorSectionVisibility,
  setContentEditorConceptVisibility,
  getContentEditorChapterDeletionPreview,
  deleteContentEditorChapter,
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
import { SectionPreWarmupPanel } from "../components/SectionPreWarmupPanel";
import { useAuth } from "../context/authHooks";
import { isAdmin } from "../roles";
import {
  ASPECT_RATIO_OPTIONS,
  QUALITY_OPTIONS,
  STYLE_OPTIONS,
  DEFAULT_ASPECT_RATIO_DIAGRAM,
  DEFAULT_ASPECT_RATIO_MEMORY_HOOK,
  DEFAULT_QUALITY,
  DEFAULT_STYLE,
} from "../content/imageGenerationOptions";

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
    label: "Micro Learning Units",
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
// step, and "memoryTrick" is aliased to the Simply Explained step's Visual
// tab (it has no display of its own -- see that file's comment on the alias).
const MEMORY_HOOK_SECTIONS = [
  { key: "analogy", label: "Analogy/Compare" },
  { key: "visualHook", label: "Visual Hook" },
  { key: "curiosityHook", label: "Curiosity Hook" },
  { key: "memoryTrick", label: "Simple Explained Visual" },
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

const ImageDropZone = ({ onFile, busy }) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragOver(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) onFile(file);
  };

  const handlePaste = (event) => {
    const item = Array.from(event.clipboardData?.items || []).find((entry) =>
      entry.type.startsWith("image/")
    );
    const file = item?.getAsFile();
    if (file) {
      event.preventDefault();
      onFile(file);
    }
  };

  return (
    <div
      className={`admin-image-drop-zone${isDragOver ? " is-drag-over" : ""}`}
      tabIndex={0}
      role="button"
      aria-label="Drop or paste an image to upload"
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      onPaste={handlePaste}
    >
      {busy ? "Working..." : "Drag & drop an image here, or click and paste (Ctrl+V)"}
    </div>
  );
};

const CardImagePanel = ({ card }) => {
  const [media, setMedia] = useState(null);
  const [loading, setLoading] = useState(true);
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState(DEFAULT_ASPECT_RATIO_DIAGRAM);
  const [quality, setQuality] = useState(DEFAULT_QUALITY);
  const [style, setStyle] = useState(DEFAULT_STYLE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadMedia = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getDiagramMedia(card.id);
      setMedia(result?.media || null);
      setPrompt(result?.media?.promptText || "");
      setAspectRatio(result?.media?.aspectRatio || DEFAULT_ASPECT_RATIO_DIAGRAM);
      setQuality(result?.media?.quality || DEFAULT_QUALITY);
      setStyle(result?.media?.style || DEFAULT_STYLE);
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
      await regenerateContentCardImage(card.id, prompt.trim(), aspectRatio, quality, style);
      await loadMedia();
    } catch (genError) {
      setError(genError.message || "Image generation failed.");
    } finally {
      setBusy(false);
    }
  };

  const uploadFile = async (file) => {
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

  const handleUpload = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    uploadFile(file);
  };

  return (
    <div className="admin-studio-field">
      <span>Image</span>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 3fr", gap: 16, alignItems: "start" }}>
        <div style={{ display: "grid", gap: 10 }}>
          {loading ? (
            <p>Loading image...</p>
          ) : media ? (
            <div>
              <img
                src={media.mediaData}
                alt={card.title || "Card image"}
                style={{
                  maxWidth: "100%",
                  maxHeight: 180,
                  borderRadius: 8,
                  display: "block",
                  margin: "0 auto 8px",
                }}
              />
              <p style={{ fontSize: 12, opacity: 0.75, textAlign: "center" }}>
                Source: {media.source} {media.modelName ? `· ${media.modelName}` : ""}
              </p>
            </div>
          ) : (
            <p>No image yet.</p>
          )}
          <ImageDropZone onFile={uploadFile} busy={busy} />
        </div>
        <div style={{ display: "grid", gap: 10, minWidth: 0 }}>
          <textarea
            rows={5}
            value={prompt}
            placeholder="Describe the image to generate..."
            onChange={(event) => setPrompt(event.target.value)}
          />
          <div className="admin-studio-field" style={{ gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            <label>
              Aspect ratio
              <select value={aspectRatio} onChange={(event) => setAspectRatio(event.target.value)} disabled={busy}>
                {ASPECT_RATIO_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Quality
              <select value={quality} onChange={(event) => setQuality(event.target.value)} disabled={busy}>
                {QUALITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Style
              <select value={style} onChange={(event) => setStyle(event.target.value)} disabled={busy}>
                {STYLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            <div className="admin-bulk-pipeline-dialog-actions admin-image-gen-actions">
              <label className="ghost-button" style={{ cursor: "pointer" }}>
                Upload file
                <input type="file" accept="image/*" onChange={handleUpload} disabled={busy} hidden />
              </label>
              <button type="button" className="primary-button" onClick={handleGenerate} disabled={busy}>
                {busy ? "Working..." : media?.mediaData ? "Regenerate image" : "Generate image"}
              </button>
            </div>
          </div>
        </div>
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
  // The last value actually persisted to the server for activeSection --
  // compared against the live `prompt` textarea to drive the Save button's
  // enabled state (only "dirty" once the moderator edits past what's saved).
  const [savedPrompt, setSavedPrompt] = useState("");
  // Aspect ratio/quality/style are purely staged, not dirty-tracked --
  // whatever's currently selected is what the next Generate/Save persists
  // (see persistPrompt/handleGenerate), no separate save affordance.
  const [aspectRatio, setAspectRatio] = useState(DEFAULT_ASPECT_RATIO_MEMORY_HOOK);
  const [quality, setQuality] = useState(DEFAULT_QUALITY);
  const [style, setStyle] = useState(DEFAULT_STYLE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [viewImageOpen, setViewImageOpen] = useState(false);
  const [fitToWindow, setFitToWindow] = useState(true);

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
    const persistedPrompt = media?.[sectionKey]?.promptText || "";
    const backingText = conceptMemory?.[sourceField] || "";
    // Resolved as locals (not read back from state) since setAspectRatio/
    // setQuality below won't be visible to handleGeneratePrompt/persistPrompt
    // if they run synchronously later in this same call -- React state
    // updates don't apply until the next render.
    const resolvedAspectRatio = media?.[sectionKey]?.aspectRatio || DEFAULT_ASPECT_RATIO_MEMORY_HOOK;
    const resolvedQuality = media?.[sectionKey]?.quality || DEFAULT_QUALITY;
    const resolvedStyle = media?.[sectionKey]?.style || DEFAULT_STYLE;
    setError("");
    setAspectRatio(resolvedAspectRatio);
    setQuality(resolvedQuality);
    setStyle(resolvedStyle);

    if (persistedPrompt) {
      setPrompt(persistedPrompt);
      setSavedPrompt(persistedPrompt);
      return;
    }

    // These sections have no backing text to prefill from (see the comment
    // on MEMORY_HOOK_PROMPT_SOURCE_FIELD), so draft the prompt from the
    // concept automatically instead of making the admin find and click the
    // "Generate prompt from concept" button every time.
    if (PROMPT_GENERATABLE_SECTIONS.has(sectionKey)) {
      setPrompt("");
      setSavedPrompt("");
      handleGeneratePrompt(sectionKey, resolvedAspectRatio);
      return;
    }

    // Analogy prefills from real backing text (content_concept_memory.analogy)
    // instead of an AI draft -- persist it the same way the other three
    // sections do, so it doesn't need a separate manual "Save prompt" click
    // the first time either. Used as-is, no style wording added -- style is
    // a UI-selectable param applied separately at generation time.
    if (backingText) {
      setPrompt(backingText);
      setSavedPrompt("");
      persistPrompt(sectionKey, backingText, resolvedAspectRatio);
      return;
    }

    setPrompt("");
    setSavedPrompt("");
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError("Enter a prompt to generate an image.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await regenerateMemoryHookImage(assessmentUnitId, activeSection, prompt.trim(), aspectRatio, quality, style);
      setSavedPrompt(prompt.trim());
      await loadMedia();
    } catch (genError) {
      setError(genError.message || "Image generation failed.");
    } finally {
      setBusy(false);
    }
  };

  // Persist immediately -- the server upserts a draft row (no image yet) or
  // updates the existing selected row's prompt_text, so a concept-drafted
  // prompt survives a reload even before "Generate image" has ever been
  // clicked for this section. Shared by the AI-drafted sections
  // (handleGeneratePrompt) and Analogy's real-backing-text prefill
  // (openSection) -- both persist the very first prompt a section shows
  // without a manual "Save prompt" click.
  const persistPrompt = async (sectionKey, finalPrompt, aspectRatioOverride) => {
    setBusy(true);
    setError("");
    try {
      const saved = await updateMemoryHookPrompt(
        assessmentUnitId,
        sectionKey,
        finalPrompt,
        aspectRatioOverride || aspectRatio
      );
      setMedia((current) => ({ ...current, [sectionKey]: saved }));
      setSavedPrompt(finalPrompt);
    } catch (saveError) {
      setError(saveError.message || "Failed to save prompt.");
    } finally {
      setBusy(false);
    }
  };

  const handleGeneratePrompt = async (sectionKeyOverride, aspectRatioOverride) => {
    const sectionKey = typeof sectionKeyOverride === "string" ? sectionKeyOverride : activeSection;
    setBusy(true);
    setError("");
    try {
      const result = await generateMemoryHookPrompt(assessmentUnitId, sectionKey);
      const finalPrompt = result.prompt;
      setPrompt(finalPrompt);
      await persistPrompt(sectionKey, finalPrompt, aspectRatioOverride);
    } catch (genError) {
      setError(genError.message || "Prompt generation failed.");
      setBusy(false);
    }
  };

  const handleSavePrompt = () => persistPrompt(activeSection, prompt.trim());

  const uploadFile = async (file) => {
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

  const handleUpload = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    uploadFile(file);
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
                  {section.label} {media?.[section.key]?.mediaData ? "✓" : ""}
                </button>
              ))}
            </div>
          )}
          {activeSection && (
            <div className="admin-studio-field" style={{ marginTop: 12 }}>
              <span>{MEMORY_HOOK_SECTIONS.find((s) => s.key === activeSection)?.label}</span>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 3fr", gap: 16, alignItems: "start" }}>
                <div style={{ display: "grid", gap: 10 }}>
                  {activeMedia?.mediaData && (
                    <img
                      src={activeMedia.mediaData}
                      alt={activeSection}
                      style={{ maxWidth: "100%", maxHeight: 180, borderRadius: 8, display: "block", margin: "0 auto" }}
                    />
                  )}
                  <ImageDropZone onFile={uploadFile} busy={busy} />
                </div>
                <div style={{ display: "grid", gap: 10, minWidth: 0 }}>
                  <textarea
                    rows={5}
                    value={prompt}
                    placeholder="Describe the image to generate..."
                    onChange={(event) => setPrompt(event.target.value)}
                  />
                  <div className="admin-studio-field" style={{ gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                    <label>
                      Aspect ratio
                      <select
                        value={aspectRatio}
                        onChange={(event) => setAspectRatio(event.target.value)}
                        disabled={busy}
                      >
                        {ASPECT_RATIO_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Quality
                      <select value={quality} onChange={(event) => setQuality(event.target.value)} disabled={busy}>
                        {QUALITY_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Style
                      <select value={style} onChange={(event) => setStyle(event.target.value)} disabled={busy}>
                        {STYLE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div style={{ display: "grid", gap: 10 }}>
                    <div className="admin-bulk-pipeline-dialog-actions admin-image-gen-actions">
                      {activeMedia?.mediaData && (
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => {
                            setFitToWindow(true);
                            setViewImageOpen(true);
                          }}
                        >
                          View image
                        </button>
                      )}
                      {PROMPT_GENERATABLE_SECTIONS.has(activeSection) && (
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => handleGeneratePrompt()}
                          disabled={busy}
                        >
                          {busy ? "Working..." : "Generate prompt from micro learning unit"}
                        </button>
                      )}
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={handleSavePrompt}
                        disabled={busy || prompt.trim() === savedPrompt}
                        title={prompt.trim() === savedPrompt ? "No changes to save" : undefined}
                      >
                        Save prompt
                      </button>
                      <label className="ghost-button" style={{ cursor: "pointer" }}>
                        Upload file
                        <input type="file" accept="image/*" onChange={handleUpload} disabled={busy} hidden />
                      </label>
                      <button type="button" className="primary-button" onClick={handleGenerate} disabled={busy}>
                        {busy ? "Working..." : activeMedia?.mediaData ? "Regenerate image" : "Generate image"}
                      </button>
                    </div>
                  </div>
                </div>
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
            <div className="admin-bulk-pipeline-header-actions" style={{ marginBottom: 12 }}>
              <button
                type="button"
                className={`ghost-button${fitToWindow ? " is-active" : ""}`}
                onClick={() => setFitToWindow(true)}
              >
                Fit to Window
              </button>
              <button
                type="button"
                className={`ghost-button${fitToWindow ? "" : " is-active"}`}
                onClick={() => setFitToWindow(false)}
              >
                Actual Size
              </button>
            </div>
            <img
              src={activeMedia.mediaData}
              alt={activeSection}
              style={
                fitToWindow
                  ? {
                      display: "block",
                      margin: "0 auto",
                      maxWidth: "100%",
                      maxHeight: "75vh",
                      width: "auto",
                      height: "auto",
                      borderRadius: 8,
                    }
                  : { display: "block", margin: "0 auto", borderRadius: 8 }
              }
            />
          </div>
        </div>
      )}
    </div>
  );
};

export const AdminContentEditorPage = () => {
  const { user } = useAuth();
  const canEditJson = isAdmin(user);
  const canDeleteChapter = isAdmin(user);

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

  const [deletingChapter, setDeletingChapter] = useState(null);
  const [deletionPreview, setDeletionPreview] = useState(null);
  const [deletionPreviewError, setDeletionPreviewError] = useState("");
  const [deletionPreviewLoading, setDeletionPreviewLoading] = useState(false);
  const [deletionConfirmText, setDeletionConfirmText] = useState("");
  const [deletionInProgress, setDeletionInProgress] = useState(false);

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

  const handleRequestDeleteChapter = async (chapterNumber, chapterName) => {
    setDeletingChapter({ chapterNumber, chapterName });
    setDeletionPreview(null);
    setDeletionPreviewError("");
    setDeletionConfirmText("");
    setDeletionPreviewLoading(true);
    try {
      const result = await getContentEditorChapterDeletionPreview(selectedBookId, chapterNumber);
      setDeletionPreview(result?.preview || null);
    } catch (previewError) {
      setDeletionPreviewError(previewError.message || "Failed to load deletion preview.");
    } finally {
      setDeletionPreviewLoading(false);
    }
  };

  const closeDeleteChapterModal = () => {
    setDeletingChapter(null);
    setDeletionPreview(null);
    setDeletionPreviewError("");
    setDeletionConfirmText("");
  };

  const handleConfirmDeleteChapter = async () => {
    if (!deletingChapter || deletionConfirmText.trim() !== String(deletingChapter.chapterNumber)) {
      return;
    }
    setDeletionInProgress(true);
    setDeletionPreviewError("");
    try {
      await deleteContentEditorChapter(selectedBookId, deletingChapter.chapterNumber);
      setTree((current) => current.filter((chapter) => chapter.chapterNumber !== deletingChapter.chapterNumber));
      setNotice(`Deleted Chapter ${deletingChapter.chapterNumber} — ${deletingChapter.chapterName}.`);
      closeDeleteChapterModal();
    } catch (deleteError) {
      setDeletionPreviewError(deleteError.message || "Failed to delete chapter.");
    } finally {
      setDeletionInProgress(false);
    }
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
              canDeleteChapter={canDeleteChapter}
              onDeleteChapter={handleRequestDeleteChapter}
            />
          )}
        </div>
      )}

      {selectedSection?.sourceSectionId && (
        <SectionPreWarmupPanel sourceSectionId={selectedSection.sourceSectionId} canEdit={canEditJson} />
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

      {deletingChapter && (
        <div className="modal-backdrop" onClick={closeDeleteChapterModal}>
          <div
            className="modal-panel admin-content-editor-delete-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" className="close-button" aria-label="Close" onClick={closeDeleteChapterModal}>
              &times;
            </button>
            <h2>Delete Chapter {deletingChapter.chapterNumber}</h2>
            <p>
              This permanently deletes <strong>Chapter {deletingChapter.chapterNumber} — {deletingChapter.chapterName}</strong>{" "}
              and everything under it (sections, concepts, cards, practice sets). This cannot be undone.
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
                    Real student history will be permanently destroyed, not just orphaned:{" "}
                    {deletionPreview.studentAttemptCount} practice attempt(s),{" "}
                    {deletionPreview.studentMasteryCount} mastery record(s),{" "}
                    {deletionPreview.preWarmupAttemptCount} pre-warmup attempt(s),{" "}
                    {deletionPreview.hotsAttemptCount} HOTS attempt(s).
                  </li>
                )}
              </ul>
            )}

            {deletionPreviewError && <p className="error-text">{deletionPreviewError}</p>}

            <label className="admin-studio-field">
              <span>
                Type the chapter number (<strong>{deletingChapter.chapterNumber}</strong>) to confirm
              </span>
              <input
                value={deletionConfirmText}
                onChange={(event) => setDeletionConfirmText(event.target.value)}
                autoFocus
                disabled={deletionInProgress}
              />
            </label>

            <div className="admin-bulk-pipeline-dialog-actions">
              <button type="button" className="ghost-button" onClick={closeDeleteChapterModal} disabled={deletionInProgress}>
                Cancel
              </button>
              <button
                type="button"
                className="primary-button admin-content-editor-delete-confirm"
                disabled={
                  deletionInProgress ||
                  deletionPreviewLoading ||
                  deletionConfirmText.trim() !== String(deletingChapter.chapterNumber)
                }
                onClick={handleConfirmDeleteChapter}
              >
                {deletionInProgress ? "Deleting..." : "Permanently delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
