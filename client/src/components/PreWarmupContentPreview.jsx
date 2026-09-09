import { useState } from "react";
import { generatePreWarmupImage } from "../api/client";
import {
  ASPECT_RATIO_OPTIONS,
  QUALITY_OPTIONS,
  STYLE_OPTIONS,
  DEFAULT_ASPECT_RATIO_MEMORY_HOOK,
  DEFAULT_QUALITY,
  DEFAULT_STYLE,
} from "../content/imageGenerationOptions";

// Renders a pre-warmup payload the way a moderator needs to review it:
// using the same "admin-student-*" preview classes the learner-facing
// question UI uses (see index.css -- defined for an assessment workbench
// preview, reusable here since the visual language is exactly "how this
// will look to a learner"), plus an explicit answer-key readout per
// assessment row so a moderator can actually verify correctness, which a
// real learner view wouldn't reveal. Tolerant of the legacy-upgraded shape
// (see preWarmupImportService.js's normalizePreWarmupPayload), which never
// has sensoryWarmup/holisticAssessment -- each section renders a "not
// authored yet" note instead of crashing on missing data.

const safeJsonParse = (value, fallback) => {
  if (value == null) return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

// The authored `prompt` fields (avsVisual.prompt, avsAssessment.prompt,
// etc.) only describe the MECHANIC ("depict the flow", "3x5 grid of
// contrasting visuals") -- they never inline the actual anchor words,
// because that context previously only existed in the surrounding chat
// conversation, not in the JSON itself. Sent to the image API as-is, the
// model has nothing concrete to draw and falls back to a generic stock
// illustration (observed: a "hero's journey" infographic instead of this
// story's actual vocabulary). These helpers splice the real content back
// in so the prompt sent at generation time is self-contained.
// The structural template below ("numbered cards + banner + connecting
// arrows + culminating final card + takeaway footer") is not a guess --
// it's exactly what the model produced once given the real anchor list
// (see the "Story Skeleton" result this replaced a generic stock
// illustration with). Baking that proven layout into the prompt itself,
// rather than leaving it to chance each time, means every section gets a
// consistently well-structured visual instead of a one-off lucky result.
const buildAvsVisualPrompt = (basePrompt, anchors) => {
  if (!Array.isArray(anchors) || anchors.length === 0) return basePrompt || "";
  const anchorList = anchors.map((item, index) => `${index + 1}. ${item.anchor} (${item.explanation})`).join("; ");
  return (
    `${basePrompt || ""}\n\n` +
    `Lay this out as a single infographic-style "story skeleton": a bold title banner at the top naming the story's arc, ` +
    `with a subtitle noting the anchor count (e.g. "${anchors.length} Anchor Vocabulary Points (AVS)"). Below it, render ` +
    `each anchor as its own rounded, color-bordered card containing: a numbered circle badge, the anchor phrase as a ` +
    `colored title, a small relevant illustration, and its one-line explanation beneath. Arrange the cards in numbered ` +
    `reading order, connected by curved arrows showing the story's flow from card to card, wrapping row by row. The final ` +
    `card should visually culminate the story's resolution. Close with a short one-line takeaway/moral banner at the ` +
    `bottom. Use a warm, colorful, semi-illustrative (not photorealistic) style appropriate for a Class 6 learner, with no ` +
    `text beyond the card titles/explanations and the banners described.\n\n` +
    `Depict these specific vocabulary anchors, in this exact order: ${anchorList}.`
  );
};

// basePrompt already says "ANCHOR ONLY, NO EXPLANATION, NO IMAGE" for the
// first cell (confirmed working -- a generated batch showed exactly this:
// bare anchor text in column one, contrasting visuals in columns two/
// three). But folding each anchor's explanation into the same per-row line
// without separating "what the cell text says" from "what the correct
// image should depict" leaves room for the model to blur the two on a
// less lucky run. Keeping those as two explicitly separate clauses per row
// is what makes that result reliable across regenerations, not a one-off.
const buildBatchImagePrompt = (basePrompt, batch, anchorsByName) => {
  const items = batch?.answerKey?.items || [];
  if (items.length === 0) return basePrompt || "";
  const rows = items
    .map((item) => {
      const explanation = anchorsByName.get(item.avs);
      return (
        `Row ${item.row}: first-cell text is exactly "${item.avs}" (the word(s) only -- never the explanation, never an ` +
        `image); the correct visual is option ${item.correct_option}, and it should depict${explanation ? `: ${explanation}` : ` "${item.avs}"`}`
      );
    })
    .join("; ");
  return (
    `${basePrompt || ""}\n\n` +
    `This set's specific rows (first-cell anchor text must be the bare word(s) only in every row): ${rows}.`
  );
};

// `prompt` is the generation prompt authored in the JSON (e.g.
// avsVisual.prompt, sensoryWarmup.prompt, or an assessment's shared
// batch-grid prompt) -- surfaced here so a moderator reviewing a pending
// placeholder can actually see what would be generated, not just that
// something is missing.
// Mirrors MemoryHookPanel's own "View image" modal (AdminContentEditorPage.jsx)
// exactly -- same Fit to Window / Actual Size toggle -- so a moderator gets
// the identical maximize experience whether they're reviewing a memory-hook
// image or a pre-warmup one.
const ImagePlaceholder = ({ image, label, prompt }) => {
  const [viewOpen, setViewOpen] = useState(false);
  const [fitToWindow, setFitToWindow] = useState(true);

  if (image?.mediaData) {
    return (
      <>
        <div style={{ position: "relative" }}>
          <img
            src={image.mediaData}
            alt={label || "Illustration"}
            style={{ maxWidth: "100%", borderRadius: 12, display: "block" }}
          />
          <button
            type="button"
            className="ghost-button"
            style={{ position: "absolute", top: 8, right: 8 }}
            onClick={() => setViewOpen(true)}
          >
            ⤢ Maximize
          </button>
        </div>
        {viewOpen && (
          <div className="modal-backdrop" onClick={() => setViewOpen(false)}>
            <div className="modal-panel is-wide" onClick={(event) => event.stopPropagation()}>
              <button type="button" className="close-button" aria-label="Close" onClick={() => setViewOpen(false)}>
                &times;
              </button>
              <h2>{label || "Image"}</h2>
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
                src={image.mediaData}
                alt={label || "Illustration"}
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
      </>
    );
  }
  return (
    <div
      style={{
        display: "grid",
        gap: 8,
        minHeight: 120,
        borderRadius: 12,
        border: "1.5px dashed rgba(15, 23, 42, 0.18)",
        color: "#64748b",
        fontSize: "0.85rem",
        padding: 12,
      }}
    >
      <span style={{ textAlign: "center" }}>
        {label || "Image"} pending generation{image?.aspectRatio ? ` (${image.aspectRatio})` : ""}
      </span>
      {prompt && (
        <div
          style={{
            borderRadius: 8,
            background: "rgba(15, 23, 42, 0.04)",
            padding: "8px 10px",
            color: "#475569",
            fontSize: "0.8rem",
            lineHeight: 1.5,
          }}
        >
          <strong style={{ display: "block", marginBottom: 4, color: "#334155" }}>Generation prompt</strong>
          {prompt}
        </div>
      )}
    </div>
  );
};

// Self-contained: owns its own expanded/busy/error/prompt/aspect/quality/
// style state and calls the API directly, rather than lifting all of that
// into SectionPreWarmupPanel -- there can be up to 5 of these on screen at
// once (avsVisual, 3 avsAssessment batches, sensoryWarmup), each independently generatable, same as how
// MemoryHookPanel manages its own per-section generation state. `path` is
// the exact array this image lives at inside the payload (see call sites
// below) -- passed straight through to generatePreWarmupImage, which is
// the only thing standing between an admin/moderator and overwriting the
// wrong nested field, so it must match reality exactly.
const GeneratableImage = ({ image, label, prompt, path, sourceSectionId, onUpdated }) => {
  const [expanded, setExpanded] = useState(false);
  // `prompt` (freshly derived from the story's own content -- see call
  // sites below) wins over `image?.promptText` (whatever was actually sent
  // last time) on purpose: these prompts are meant to be derived from the
  // AVS/story data, not hand-authored free text, so if a prior generation
  // used a stale/incomplete prompt, reopening this shouldn't keep
  // resurfacing it.
  const [promptText, setPromptText] = useState(prompt || image?.promptText || "");
  const [aspectRatio, setAspectRatio] = useState(image?.aspectRatio || DEFAULT_ASPECT_RATIO_MEMORY_HOOK);
  const [quality, setQuality] = useState(image?.quality || DEFAULT_QUALITY);
  const [style, setStyle] = useState(image?.style || DEFAULT_STYLE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    if (!promptText.trim()) {
      setError("Enter a prompt to generate an image.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await generatePreWarmupImage(sourceSectionId, path, promptText.trim(), aspectRatio, quality, style);
      onUpdated(result?.preWarmup || null);
      setExpanded(false);
    } catch (genError) {
      setError(genError.message || "Image generation failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <ImagePlaceholder image={image} label={label} prompt={expanded ? null : prompt} />
      {!expanded && (
        <button type="button" className="ghost-button" onClick={() => setExpanded(true)}>
          {image?.mediaData ? "Regenerate image" : "Generate image"}
        </button>
      )}
      {expanded && (
        <div className="admin-studio-field">
          <span>Prompt</span>
          <textarea
            rows={8}
            value={promptText}
            onChange={(event) => setPromptText(event.target.value)}
            disabled={busy}
          />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
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
          {error && <p className="error-text">{error}</p>}
          <div className="admin-bulk-pipeline-dialog-actions">
            <button type="button" className="ghost-button" onClick={() => setExpanded(false)} disabled={busy}>
              Cancel
            </button>
            <button type="button" className="primary-button" onClick={handleGenerate} disabled={busy}>
              {busy ? "Working..." : image?.mediaData ? "Regenerate image" : "Generate image"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const ResponseCaptureBadges = ({ responseCapture }) => {
  if (!responseCapture) return null;
  const badges = [];
  if (responseCapture.inputModes?.includes("text")) badges.push("⌨ Text");
  if (responseCapture.inputModes?.includes("mic")) badges.push("🎤 Mic");
  if (responseCapture.inputModes?.includes("select")) {
    badges.push(`✓ Select (${responseCapture.optionsPerItem || 2} options, ${responseCapture.uiPattern || "list"})`);
  }
  if (responseCapture.maxDurationSeconds) {
    badges.push(`⏱ ${responseCapture.maxDurationSeconds}s${responseCapture.countdownTimer ? " countdown" : ""}`);
  }
  if (badges.length === 0) return null;
  return (
    <div className="admin-student-preview-topline">
      {badges.map((badge) => (
        <span key={badge}>{badge}</span>
      ))}
    </div>
  );
};

// Deliberately its own layout rather than reusing .admin-student-option --
// that class's fixed 38px/1fr grid was built for short single-line MCQ
// option text, and an anchor phrase ("worried wife") wrapped inside the
// same flowing <span> as its explanation, colliding with the number badge.
// Anchor and explanation each get a dedicated column here instead, and the
// cards lay out in a responsive multi-column grid rather than one long list.
const AnchorVocabularyList = ({ avs }) => {
  const items = safeJsonParse(avs?.anchorVocabularySet, []);
  if (!Array.isArray(items) || items.length === 0) return <p className="admin-workbench-muted">No anchors authored.</p>;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
      {items.map((item, index) => (
        <div
          key={`${item.anchor}-${index}`}
          style={{
            display: "grid",
            gap: 8,
            padding: "0.9rem",
            borderRadius: 18,
            border: "1.5px solid rgba(15, 23, 42, 0.12)",
            background: "#ffffff",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <strong
              style={{
                width: 32,
                height: 32,
                flexShrink: 0,
                borderRadius: "999px",
                display: "grid",
                placeItems: "center",
                background: "#e2e8f0",
                color: "#0f172a",
                fontSize: "0.85rem",
              }}
            >
              {index + 1}
            </strong>
            <span style={{ fontWeight: 700, color: "#0f172a" }}>{item.anchor}</span>
          </div>
          <span style={{ color: "#334155", lineHeight: 1.5 }}>{item.explanation}</span>
        </div>
      ))}
    </div>
  );
};

const AssessmentBatches = ({ assessment, title, pathPrefix, sourceSectionId, onUpdated, anchorsByName }) => {
  if (!assessment) return <p className="admin-workbench-muted">{title} not yet authored.</p>;
  return (
    <div style={{ display: "grid", gap: 16 }}>
      {(assessment.batches || []).map((batch, index) => (
        <div className="admin-student-preview" key={batch.answerKey?.set ?? index}>
          <div className="admin-student-preview-topline">
            <span>Set {batch.answerKey?.set}</span>
            <span>{batch.answerKey?.format}</span>
          </div>
          <GeneratableImage
            image={batch.image}
            label={`Set ${batch.answerKey?.set} grid`}
            prompt={buildBatchImagePrompt(assessment.prompt, batch, anchorsByName)}
            path={[...pathPrefix, "batches", index, "image"]}
            sourceSectionId={sourceSectionId}
            onUpdated={onUpdated}
          />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
            {(batch.answerKey?.items || []).map((item) => (
              <div
                key={item.row}
                style={{
                  display: "grid",
                  gap: 6,
                  padding: "0.75rem",
                  borderRadius: 14,
                  border: "1.5px solid rgba(22, 163, 74, 0.24)",
                  background: "#f0fdf4",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <strong
                    style={{
                      width: 28,
                      height: 28,
                      flexShrink: 0,
                      borderRadius: "999px",
                      display: "grid",
                      placeItems: "center",
                      background: "#e2e8f0",
                      color: "#0f172a",
                      fontSize: "0.8rem",
                    }}
                  >
                    {item.row}
                  </strong>
                  <span style={{ fontWeight: 700, color: "#0f172a" }}>{item.avs}</span>
                </div>
                <span style={{ color: "#166534", fontWeight: 600, fontSize: "0.85rem" }}>
                  Correct: Option {item.correct_option}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
      {(!assessment.batches || assessment.batches.length === 0) && (
        <p className="admin-workbench-muted">No batches authored.</p>
      )}
    </div>
  );
};

const ExperientialQuestions = ({ experientialWarmup }) => {
  const questions =
    safeJsonParse(experientialWarmup?.content, {}).questions ?? experientialWarmup?.questions;
  if (!Array.isArray(questions) || questions.length === 0) {
    return <p className="admin-workbench-muted">Experiential warm-up not yet authored.</p>;
  }
  return (
    <div style={{ display: "grid", gap: 16 }}>
      {questions.map((item, index) => (
        <div className="admin-student-preview" key={index}>
          <p className="admin-student-question">{item.question}</p>
          {item.cues?.length > 0 && (
            <div className="admin-student-written-answer">
              <span>Cues</span>
              <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                {item.cues.map((cue, cueIndex) => (
                  <li key={cueIndex}>{cue}</li>
                ))}
              </ul>
            </div>
          )}
          <ResponseCaptureBadges
            responseCapture={
              item.responseCapture || {
                inputModes: ["text", "mic"],
                maxDurationSeconds: 120,
                countdownTimer: true,
              }
            }
          />
        </div>
      ))}
    </div>
  );
};

const TransferablePatternsList = ({ transferablePatterns }) => {
  const patterns = safeJsonParse(transferablePatterns?.content, {}).patterns;
  if (!Array.isArray(patterns) || patterns.length === 0) {
    return <p className="admin-workbench-muted">Not yet authored.</p>;
  }
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {patterns.map((pattern, index) => (
        <div className="admin-student-feedback is-correct" key={pattern.id || index}>
          <strong>{pattern.pattern}</strong>
          <span>{pattern.meaning || pattern.description}</span>
          <span style={{ fontStyle: "italic" }}>
            Story evidence: {pattern.storyAnchor || pattern.storyEvidence}
          </span>
          {pattern.usageExamples?.length > 0 ? (
            <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
              {pattern.usageExamples.map((example, exampleIndex) => (
                <li key={exampleIndex}>{example}</li>
              ))}
            </ul>
          ) : (
            <span>Transferability: {pattern.transferability}</span>
          )}
          {pattern.note && <span className="admin-workbench-muted">{pattern.note}</span>}
        </div>
      ))}
    </div>
  );
};

// The authored content only has a `format` per question (mcq/true_false/
// fill_in_blank/short_answer/reorder/assertion_reason/hots_infer/
// hots_predict/hots_recall) -- format is a STRUCTURAL type (how the
// learner answers), not a cognitive one (what thinking it demands), and
// the hots_* values only hint at cognitive level informally. This maps
// every format actually used in this content to a Bloom's-taxonomy level
// so it can render as its own chip. Prefers an explicit `cognitiveLevel`/
// `cognitive_level` field on the item if content authoring ever adds one
// directly, falling back to this derivation otherwise.
const COGNITIVE_LEVEL_BY_FORMAT = {
  fill_in_blank: "Remember",
  true_false: "Remember",
  hots_recall: "Remember",
  short_answer: "Understand",
  mcq: "Understand",
  assertion_reason: "Analyze",
  reorder: "Analyze",
  hots_infer: "Analyze",
  hots_predict: "Evaluate",
};

const StoryAnchorQuestionsList = ({ storyAnchorQuestions }) => {
  const questions = safeJsonParse(storyAnchorQuestions?.content, {}).questions;
  if (!Array.isArray(questions) || questions.length === 0) {
    return <p className="admin-workbench-muted">Not yet authored.</p>;
  }
  return (
    <div style={{ display: "grid", gap: 16 }}>
      {questions.map((item, index) => {
        const cognitiveLevel =
          item.cognitiveLevel || item.cognitive_level || COGNITIVE_LEVEL_BY_FORMAT[item.format] || null;
        return (
        <div className="admin-student-preview" key={index}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <strong
              style={{
                width: 32,
                height: 32,
                flexShrink: 0,
                borderRadius: "999px",
                display: "grid",
                placeItems: "center",
                background: "#e2e8f0",
                color: "#0f172a",
                fontSize: "0.85rem",
              }}
            >
              {index + 1}
            </strong>
            <div className="admin-student-preview-topline" style={{ flex: 1 }}>
              <span>{item.format}</span>
              {cognitiveLevel && <span>{cognitiveLevel}</span>}
            </div>
          </div>
          <p className="admin-workbench-muted" style={{ fontStyle: "italic" }}>
            "{item.anchorSentence}"
          </p>
          <p style={{ margin: 0, color: "#0f172a", fontSize: "1rem", fontWeight: 700, lineHeight: 1.55 }}>
            {item.question}
          </p>
          {Array.isArray(item.options) && item.options.length > 0 ? (
            // Not .admin-student-option here -- that class's fixed 38px/1fr
            // grid expects a number-badge <strong> as the first child; with
            // only a single <span>, the option text itself collapses into
            // the 38px badge column and wraps one word per line. These
            // options have no badge, so they get a plain full-width block
            // row instead.
            <div style={{ display: "grid", gap: 8 }}>
              {item.options.map((option) => (
                <div
                  key={option}
                  style={{
                    padding: "0.75rem 0.9rem",
                    borderRadius: 14,
                    border:
                      option === item.answer ? "1.5px solid rgba(22, 163, 74, 0.42)" : "1.5px solid rgba(15, 23, 42, 0.12)",
                    background: option === item.answer ? "#f0fdf4" : "#ffffff",
                    color: "#0f172a",
                  }}
                >
                  {option}
                </div>
              ))}
            </div>
          ) : (
            <div className="admin-student-feedback is-correct">
              <strong>Model answer</strong>
              <span>{item.answer}</span>
            </div>
          )}
        </div>
        );
      })}
    </div>
  );
};

export const PreWarmupContentPreview = ({ payload, sourceSectionId, onUpdated }) => {
  const preLessonWarmup = payload?.preLessonWarmup || {};
  const postLesson = payload?.postLesson || {};
  const vocabularyWarmup = preLessonWarmup.vocabularyWarmup || {};
  const anchors = safeJsonParse(vocabularyWarmup.avs?.anchorVocabularySet, []);
  const anchorsByName = new Map(Array.isArray(anchors) ? anchors.map((item) => [item.anchor, item.explanation]) : []);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <details className="admin-studio-field" open>
        <summary>Pre-Lesson Warm-Up</summary>
        <div
          style={{
            display: "grid",
            gap: 16,
            marginTop: 12,
            paddingLeft: 20,
            borderLeft: "2px solid rgba(15, 23, 42, 0.1)",
          }}
        >
          <details className="admin-studio-field">
            <summary>Vocabulary Warm-Up — Anchor Set</summary>
            <div style={{ marginTop: 12 }}>
              <AnchorVocabularyList avs={vocabularyWarmup.avs} />
            </div>
          </details>
          <details className="admin-studio-field">
            <summary>Vocabulary Warm-Up — Visual</summary>
            <div style={{ marginTop: 12, maxWidth: 320 }}>
              <GeneratableImage
                image={vocabularyWarmup.avsVisual?.image}
                label="Vocabulary skeleton"
                prompt={buildAvsVisualPrompt(vocabularyWarmup.avsVisual?.prompt, anchors)}
                path={["preLessonWarmup", "vocabularyWarmup", "avsVisual", "image"]}
                sourceSectionId={sourceSectionId}
                onUpdated={onUpdated}
              />
            </div>
          </details>
          <details className="admin-studio-field">
            <summary>Vocabulary Warm-Up — Assessment</summary>
            <div style={{ marginTop: 12 }}>
              <AssessmentBatches
                assessment={vocabularyWarmup.avsAssessment}
                title="Assessment"
                pathPrefix={["preLessonWarmup", "vocabularyWarmup", "avsAssessment"]}
                sourceSectionId={sourceSectionId}
                onUpdated={onUpdated}
                anchorsByName={anchorsByName}
              />
            </div>
          </details>
          <details className="admin-studio-field">
            <summary>Sensory Warm-Up</summary>
            {preLessonWarmup.sensoryWarmup || vocabularyWarmup.avsVisual ? (
              <div className="admin-student-preview" style={{ marginTop: 12 }}>
                <div style={{ maxWidth: 320 }}>
                  <ImagePlaceholder image={vocabularyWarmup.avsVisual?.image} label="Vocabulary skeleton" />
                  <p className="admin-workbench-muted" style={{ fontSize: "0.8rem", marginTop: 6 }}>
                    Reuses the Vocabulary Warm-Up — Visual image above (generate/regenerate it there, not here).
                  </p>
                </div>
                <p className="admin-student-question">
                  {preLessonWarmup.sensoryWarmup?.responsePrompt ||
                    "Look at the Vocabulary Warm-Up image again, as a whole. Based on what you see, type or say what you think this story might be about."}
                </p>
                <ResponseCaptureBadges
                  responseCapture={
                    preLessonWarmup.sensoryWarmup?.responseCapture || {
                      inputModes: ["text", "mic"],
                      maxDurationSeconds: 120,
                      countdownTimer: true,
                    }
                  }
                />
                {!preLessonWarmup.sensoryWarmup && (
                  <p className="admin-workbench-muted" style={{ fontSize: "0.8rem" }}>
                    This section's own sensoryWarmup content hasn't been authored yet (likely imported before this
                    activity existed) -- the image above is real, but the prompt/response settings shown are
                    fallback defaults until it's authored.
                  </p>
                )}
              </div>
            ) : (
              <p className="admin-workbench-muted" style={{ marginTop: 12 }}>
                Not yet authored (this section didn't exist before the pre/post-lesson restructure).
              </p>
            )}
          </details>
          <details className="admin-studio-field">
            <summary>Experiential Warm-Up</summary>
            <div style={{ marginTop: 12 }}>
              <ExperientialQuestions experientialWarmup={preLessonWarmup.experientialWarmup} />
            </div>
          </details>
        </div>
      </details>

      <details className="admin-studio-field">
        <summary>Post-Lesson Follow-Up</summary>
        <div
          style={{
            display: "grid",
            gap: 16,
            marginTop: 12,
            paddingLeft: 20,
            borderLeft: "2px solid rgba(15, 23, 42, 0.1)",
          }}
        >
          <details className="admin-studio-field">
            <summary>Transferable Patterns</summary>
            <div style={{ marginTop: 12 }}>
              <TransferablePatternsList transferablePatterns={postLesson.transferablePatterns} />
            </div>
          </details>
          <details className="admin-studio-field">
            <summary>Story Anchor Questions</summary>
            <div style={{ marginTop: 12 }}>
              <StoryAnchorQuestionsList storyAnchorQuestions={postLesson.storyAnchorQuestions} />
            </div>
          </details>
        </div>
      </details>
    </div>
  );
};
