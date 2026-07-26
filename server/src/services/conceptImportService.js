// Imports an admin-uploaded JSON file into this app's content tables. The
// JSON mirrors the companion content app's own schema (content_root/
// content_processor_card, inspected directly against its Postgres database)
// rather than a hand-authored shape: a flat `cards[]` array, each card
// carrying {contentuitab, processorkey, parentCardkey, cardkey, title,
// summary, details:[{label,value}]}, plus root-level board/class/subject/
// chapter/section/book/chapterName/sectionName metadata. That metadata
// resolves to a real mst_book/mst_chapter/source_section chain the same way
// it always has (conceptImportCatalogService.js's resolveOrCreateCatalogTarget,
// unchanged), auto-creating whatever master data doesn't exist yet.
//
// Card routing (by contentuitab/processorkey):
//  - extraction/concepts (parentCardkey="") -> one assessment_unit row per
//    card (assessment_unit_id = "${contentKey}:${cardkey}", stable across
//    re-imports so mastery/attempt history survives) plus a mirrored
//    content_card row.
//  - teaching/{teachme,explain,eli5,storymode,analogy,realworld} ->
//    content_card rows (Learn tab) + merged into content_concept_memory
//    (eli5/storymode -> story, analogy -> analogy, realworld -> real-world
//    connection -- same 3-of-6 mapping this importer has always used).
//  - assessment/{mcq,assertionreason,truefalse,shortanswer,fillintheblank,hots}
//    -> content_assessment_item rows (structured, feeds grading + practice
//    sets). assessment/{hotspot,casestudy,einsteinmode} have no structured
//    interaction shape and stay as content_card rows only (the "Challenges"
//    feature).
//  - revision/*, tutor/*, deeplearning/* -> content_card rows only, read
//    directly by mode-tab filtering (their {title,summary,details} shape
//    already matches StudentDetailCard exactly).
//  - pdfassets/*, visual/* (root-level, parentCardkey="") -> content_card
//    rows scoped to the section instead of a concept (diagrams/mind-maps/etc,
//    each an image-generation prompt an admin can attach an uploaded image
//    to via content_card_media).
//
// Re-importing the same contentKey is a hard overwrite for content_card/
// content_assessment_item/content_concept_memory (deleted then re-inserted),
// but assessment_unit rows are UPSERTed by their stable assessment_unit_id --
// never deleted -- so student_mastery/student_attempt history tied to a
// concept survives a re-import instead of cascading away.
import { pool } from "../db/pool.js";
import { resolveOrCreateCatalogTarget } from "./conceptImportCatalogService.js";
import * as conceptCardCache from "./conceptCardCache.js";

class ConceptImportError extends Error {
  constructor(message) {
    super(message);
    this.statusCode = 400;
  }
}

const SECTION_SCOPED_TABS = new Set(["pdfassets", "visual"]);

const STRUCTURED_ASSESSMENT_FAMILIES = {
  mcq: "single_select",
  assertionreason: "single_select",
  truefalse: "single_select",
  shortanswer: "free_text",
  fillintheblank: "free_text",
  hots: "free_text",
};

const toArray = (value) => (Array.isArray(value) ? value : []);
const normalize = (value) => String(value ?? "").trim();

const findDetailValue = (details, labelPattern) => {
  const entry = toArray(details).find((item) => labelPattern.test(normalize(item?.label)));
  return entry ? entry.value : undefined;
};

const parseEstimatedSeconds = (text) => {
  const match = /(\d+(?:\.\d+)?)/.exec(normalize(text));
  if (!match) return 0;
  const value = Number(match[1]);
  return /minute/i.test(normalize(text)) ? Math.round(value * 60) : Math.round(value);
};

const REQUIRED_ROOT_FIELDS = ["board", "class", "subject", "chapter", "section", "book", "chapterName", "sectionName"];

// Backward compatibility for files produced before this importer switched to
// mirroring the content app's own flat-cards schema: the old shape had
// board/classNum/subject/book/chapterNum/chapterName/sectionNo/sectionName
// root fields, a root "extraction.concepts[]" array, and a "concepts" object
// keyed by concept title/id holding {teaching,assessment,revision,tutor}
// mode buckets (each an array of {id,title,summary,details} items). Detected
// purely structurally (no version field ever existed on either shape) and
// converted into the new {contentKey,...,cards[]} contract before anything
// else touches the payload, so the rest of this file only ever sees the new
// shape.
const isLegacyPayloadShape = (payload) =>
  Boolean(payload) &&
  typeof payload === "object" &&
  !Array.isArray(payload.cards) &&
  Array.isArray(payload?.extraction?.concepts) &&
  Boolean(payload?.concepts) &&
  typeof payload.concepts === "object" &&
  !Array.isArray(payload.concepts);

const slugify = (value) =>
  normalize(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const synthesizeLegacyContentKey = (payload) =>
  [
    slugify(payload.board),
    `class${slugify(payload.classNum)}`,
    slugify(payload.subject),
    `ch${slugify(payload.chapterNum)}`,
    slugify(payload.sectionNo),
  ]
    .filter(Boolean)
    .join("-");

const findLegacyConceptEntry = (conceptsMap, concept) => {
  const titleKey = normalize(concept.title).toLowerCase();
  const idKey = normalize(concept.id).toLowerCase();
  const entries = Object.entries(conceptsMap || {});

  const byTitle = entries.find(([key]) => normalize(key).toLowerCase() === titleKey);
  if (byTitle) return byTitle[1];

  const byId = entries.find(([key]) => normalize(key).toLowerCase() === idKey);
  return byId ? byId[1] : null;
};

const LEGACY_TEACHING_MODES = ["teachme", "explain", "eli5", "storymode", "analogy", "realworld"];
const LEGACY_ASSESSMENT_MODES = [
  "mcq",
  "assertionreason",
  "truefalse",
  "shortanswer",
  "fillintheblank",
  "hots",
  "hotspot",
  "casestudy",
  "einsteinmode",
];
const LEGACY_REVISION_MODES = ["flashcards", "cheatsheet", "mnemonics", "examnotes"];
const LEGACY_TUTOR_MODES = ["coach", "interview", "viva"];

// The source file uses "deepLearning" (camelCase, confirmed against a real
// upload), not "deeplearning" -- so bucket names are matched
// case-insensitively against a list of candidate spellings rather than a
// single exact key, to avoid a silent no-op if the source file's naming
// drifts again.
const getFirstBucket = (entry, candidateNames) => {
  if (!entry) return null;
  const lowerCandidates = candidateNames.map((name) => name.toLowerCase());
  const key = Object.keys(entry).find((k) => lowerCandidates.includes(k.toLowerCase()));
  return key ? entry[key] : null;
};

const convertLegacyPayload = (payload) => {
  const extractionConcepts = toArray(payload?.extraction?.concepts);
  const conceptsMap = payload?.concepts || {};
  const cards = [];

  extractionConcepts.forEach((concept, conceptIndex) => {
    if (!concept?.id || !concept?.title) return;

    cards.push({
      contentuitab: "extraction",
      processorkey: "concepts",
      parentCardkey: "",
      cardkey: concept.id,
      sortOrder: conceptIndex,
      title: concept.title,
      summary: concept.summary || "",
      details: toArray(concept.details),
      imageDataUrl: concept?.image?.dataUrl || null,
    });

    const conceptEntry = findLegacyConceptEntry(conceptsMap, concept);
    if (!conceptEntry) return;

    const pushMode = (contentuitab, mode, items) => {
      toArray(items).forEach((item, itemIndex) => {
        cards.push({
          contentuitab,
          processorkey: mode,
          parentCardkey: concept.id,
          cardkey: `${mode}-${itemIndex + 1}`,
          sortOrder: itemIndex,
          title: item?.title || null,
          summary: item?.summary || null,
          details: toArray(item?.details),
          // Source shape is a nested { image: { dataUrl } } object, not a
          // flat "imageDataUrl" string -- confirmed against a real upload
          // (this was previously dropped entirely, regardless of key name,
          // since nothing here ever read the source item's "image" field).
          imageDataUrl: item?.image?.dataUrl || null,
        });
      });
    };

    // deeplearning is walked dynamically (whatever processorkeys the source
    // file actually has -- e.g. "firstprinciples" alongside
    // "misconceptions") rather than a fixed mode list like the 4 buckets
    // above, since it doesn't have a pinned-down processorkey vocabulary the
    // way teaching's 6 modes do.
    const pushDynamicBucket = (contentuitab, bucket) => {
      Object.entries(bucket || {}).forEach(([mode, items]) => {
        toArray(items).forEach((item, itemIndex) => {
          cards.push({
            contentuitab,
            processorkey: mode,
            parentCardkey: concept.id,
            cardkey: `${mode}-${itemIndex + 1}`,
            sortOrder: itemIndex,
            title: item?.title || null,
            summary: item?.summary || null,
            details: toArray(item?.details),
            imageDataUrl: item?.image?.dataUrl || null,
          });
        });
      });
    };

    const teaching = conceptEntry.teaching || {};
    const assessment = conceptEntry.assessment || {};
    const revision = conceptEntry.revision || {};
    const tutor = conceptEntry.tutor || {};

    LEGACY_TEACHING_MODES.forEach((mode) => pushMode("teaching", mode, teaching[mode]));
    LEGACY_ASSESSMENT_MODES.forEach((mode) => pushMode("assessment", mode, assessment[mode]));
    LEGACY_REVISION_MODES.forEach((mode) => pushMode("revision", mode, revision[mode]));
    LEGACY_TUTOR_MODES.forEach((mode) => pushMode("tutor", mode, tutor[mode]));
    pushDynamicBucket("deeplearning", getFirstBucket(conceptEntry, ["deeplearning"]));
  });

  // Unlike deepLearning, "visual" sits at the payload ROOT (a sibling of
  // "extraction"/"concepts"), not nested inside any one concept -- confirmed
  // against a real upload. That matches the real content app's schema
  // anyway (mind maps/posters are section-wide, shared across every concept
  // in the section, not owned by one), so these cards are pushed once, here,
  // section-scoped (parentCardkey ""), instead of per concept.
  const visualBucket = getFirstBucket(payload, ["visual", "visuallearning"]);
  Object.entries(visualBucket || {}).forEach(([mode, items]) => {
    toArray(items).forEach((item, itemIndex) => {
      cards.push({
        contentuitab: "visual",
        processorkey: mode,
        parentCardkey: "",
        cardkey: `${mode}-${itemIndex + 1}`,
        sortOrder: itemIndex,
        title: item?.title || null,
        summary: item?.summary || null,
        details: toArray(item?.details),
        imageDataUrl: item?.image?.dataUrl || null,
      });
    });
  });

  return {
    contentKey: synthesizeLegacyContentKey(payload),
    board: payload.board,
    class: payload.classNum,
    subject: payload.subject,
    chapter: payload.chapterNum,
    section: payload.sectionNo,
    book: payload.book,
    chapterName: payload.chapterName,
    sectionName: payload.sectionName,
    cards,
  };
};

// Idempotent/pure -- safe to call more than once on the same payload (the
// controller calls it once for early validation, importConceptContent calls
// it again defensively). A payload that already matches the new shape
// (has "cards") passes through unchanged.
export const normalizeConceptImportPayload = (payload) =>
  isLegacyPayloadShape(payload) ? convertLegacyPayload(payload) : payload;

export const validateConceptImportPayload = (payload) => {
  if (!payload || typeof payload !== "object") {
    throw new ConceptImportError("A JSON payload is required.");
  }

  const contentKey = normalize(payload.contentKey);
  if (!contentKey) {
    throw new ConceptImportError('"contentKey" is required.');
  }

  const cards = toArray(payload.cards);
  if (cards.length === 0) {
    throw new ConceptImportError('"cards" must be a non-empty array.');
  }

  const missingRootFields = REQUIRED_ROOT_FIELDS.filter((field) => !normalize(payload[field]));
  if (missingRootFields.length) {
    throw new ConceptImportError(`Missing required root field(s): ${missingRootFields.join(", ")}.`);
  }

  for (const card of cards) {
    if (!card?.contentuitab || !card?.processorkey || !card?.cardkey) {
      throw new ConceptImportError("Every card needs contentuitab, processorkey, and cardkey.");
    }
  }

  return { contentKey, cards };
};

// assertionreason cards carry the two statements as separate "Assertion"/
// "Reason" labels instead of a single "Question" label -- without this, the
// question-text fallback (card.summary/card.title) silently substitutes a
// generic one-line description and the actual A/R statements the options
// (A/R true-false combinations) refer to never reach the student at all.
const buildQuestionText = (details, card) => {
  const question = findDetailValue(details, /^question$/i);
  if (question) return question;

  const assertion = findDetailValue(details, /^assertion$/i);
  const reason = findDetailValue(details, /^reason$/i);
  if (assertion && reason) {
    return `Assertion (A): ${assertion}\nReason (R): ${reason}`;
  }

  return card.summary || card.title || "";
};

const insertStructuredAssessmentItem = async ({ syncRunId, contentKey, assessmentUnitId, card, interactionType }) => {
  const details = card.details;
  const question = buildQuestionText(details, card);
  const options = toArray(findDetailValue(details, /^options?$/i));
  const correctAnswer = findDetailValue(details, /^correct answer$/i) || null;
  const answerExplanation = findDetailValue(details, /^answer$/i) || null;
  const difficulty = findDetailValue(details, /^difficulty$/i) || null;
  const bloomsLevel = findDetailValue(details, /^bloom/i) || null;
  const learningObjective = findDetailValue(details, /^learning outcome$/i) || null;
  const hints = toArray(findDetailValue(details, /^hints?$/i));
  const estimatedTimeSeconds = parseEstimatedSeconds(findDetailValue(details, /^expected time$/i));
  // cardkey (e.g. "mcq-1") is only unique WITHIN one concept -- every concept
  // in a file independently numbers its own mcq-1/mcq-2/... -- so item_id
  // must include parentCardkey too, or two different concepts' "mcq-1" items
  // collide on the same item_id and ON CONFLICT DO UPDATE silently makes the
  // later one overwrite the earlier one's question/options/correct_answer.
  const itemId = `${contentKey}:${card.parentCardkey}:${card.cardkey}`;

  await pool.query(
    `
      INSERT INTO content_assessment_item (
        sync_run_id, content_card_id, assessment_unit_id, item_id, question_family, interaction_type,
        question, options, correct_answer, answer_explanation, difficulty, blooms_level,
        learning_objective, hints, estimated_time_seconds, marks
      )
      VALUES (
        $1,
        (SELECT id FROM content_card WHERE content_key = $2 AND processorkey = $3 AND parent_cardkey = $4 AND cardkey = $5),
        $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, 1
      )
      ON CONFLICT (item_id) DO UPDATE
      SET content_card_id = EXCLUDED.content_card_id,
          assessment_unit_id = EXCLUDED.assessment_unit_id,
          question = EXCLUDED.question,
          options = EXCLUDED.options,
          correct_answer = EXCLUDED.correct_answer,
          answer_explanation = EXCLUDED.answer_explanation,
          difficulty = EXCLUDED.difficulty,
          blooms_level = EXCLUDED.blooms_level,
          learning_objective = EXCLUDED.learning_objective,
          hints = EXCLUDED.hints,
          estimated_time_seconds = EXCLUDED.estimated_time_seconds
    `,
    [
      syncRunId,
      contentKey,
      card.processorkey,
      card.parentCardkey || "",
      card.cardkey,
      assessmentUnitId,
      itemId,
      card.processorkey,
      interactionType,
      question,
      JSON.stringify(options),
      correctAnswer,
      answerExplanation,
      difficulty,
      bloomsLevel,
      learningObjective,
      JSON.stringify(hints),
      estimatedTimeSeconds,
    ]
  );
};

const noopProgress = () => {};

export const importConceptContent = async ({ payload: rawPayload, userId = null, onProgress = noopProgress }) => {
  const payload = normalizeConceptImportPayload(rawPayload);
  const { contentKey, cards } = validateConceptImportPayload(payload);
  onProgress({ type: "info", message: `Parsed ${cards.length} card(s) for content key "${contentKey}".` });

  onProgress({
    type: "info",
    message: "Resolving chapter/section from the file's board/class/subject/chapter/section metadata...",
  });
  const catalogTarget = await resolveOrCreateCatalogTarget({
    board: payload.board,
    classNum: String(payload.class),
    subject: payload.subject,
    book: payload.book,
    chapterNum: String(payload.chapter),
    chapterName: payload.chapterName,
    sectionNo: String(payload.section),
    sectionName: payload.sectionName,
    userId,
  });

  if (!catalogTarget) {
    throw new ConceptImportError(
      "Could not resolve a chapter/section from the file's board/class/subject/chapter/section/book/chapterName/sectionName fields."
    );
  }
  const { sourceSectionId, fkMstChapterId } = catalogTarget;
  onProgress({ type: "success", message: `Linked to chapter #${fkMstChapterId} / section #${sourceSectionId}.` });

  const syncRunResult = await pool.query(
    `INSERT INTO content_sync_run (content_key, status, created_by) VALUES ($1, 'completed', $2) RETURNING id`,
    [contentKey, userId]
  );
  const syncRunId = syncRunResult.rows[0].id;

  // Concept cards first (extraction/concepts, parentCardkey="") -- every
  // other card is scoped to one of these by parentCardkey, so their
  // assessment_unit rows must exist before anything else is inserted.
  const conceptCards = cards.filter((card) => card.contentuitab === "extraction" && card.processorkey === "concepts");
  if (conceptCards.length === 0) {
    throw new ConceptImportError('At least one "extraction/concepts" card is required.');
  }

  const assessmentUnitIdByCardkey = new Map();
  for (const card of conceptCards) {
    let assessmentUnitId = `${contentKey}:${card.cardkey}`;

    // The source file's own concept "id" isn't guaranteed stable across
    // regenerations of the "same" content -- seen in practice: one export
    // used "concepts-0-bharat" and the next used "concepts-1" for the exact
    // same concept. When the freshly computed id doesn't match an existing
    // row, fall back to matching by title within this section before
    // minting a new one, so re-imports keep updating the same row (and its
    // student_mastery/student_attempt history) instead of orphaning it as a
    // stale, content-less duplicate while a sibling with no history absorbs
    // all the fresh content.
    const existingById = await pool.query(
      "SELECT 1 FROM assessment_unit WHERE assessment_unit_id = $1",
      [assessmentUnitId]
    );
    if (existingById.rows.length === 0) {
      const title = card.title || card.cardkey;
      const existingByTitle = await pool.query(
        `
          SELECT assessment_unit_id FROM assessment_unit
          WHERE source_section_id = $1 AND is_active = TRUE AND LOWER(primary_concept) = LOWER($2)
          ORDER BY id ASC
          LIMIT 1
        `,
        [sourceSectionId, title]
      );
      if (existingByTitle.rows.length > 0) {
        assessmentUnitId = existingByTitle.rows[0].assessment_unit_id;
        onProgress({
          type: "info",
          message: `Concept "${title}" matched existing unit ${assessmentUnitId} by title (source id "${card.cardkey}" changed since last import).`,
        });
      }
    }

    assessmentUnitIdByCardkey.set(card.cardkey, assessmentUnitId);

    await pool.query(
      `
        INSERT INTO assessment_unit (
          generation_id, assessment_unit_id, source_section_id, fk_mst_chapter_id,
          primary_concept, learning_objective, concept_category, curriculum_importance, is_active
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'general', 'medium', TRUE)
        ON CONFLICT (assessment_unit_id) DO UPDATE
        SET generation_id = EXCLUDED.generation_id,
            source_section_id = EXCLUDED.source_section_id,
            fk_mst_chapter_id = EXCLUDED.fk_mst_chapter_id,
            primary_concept = EXCLUDED.primary_concept,
            learning_objective = EXCLUDED.learning_objective,
            is_active = TRUE,
            updated_at = NOW()
      `,
      [syncRunId, assessmentUnitId, sourceSectionId, fkMstChapterId, card.title || card.cardkey, card.summary || null]
    );
    onProgress({ type: "info", message: `Concept "${card.title || card.cardkey}" (${assessmentUnitId}) written.` });
  }
  onProgress({ type: "success", message: `Wrote ${conceptCards.length} concept(s).` });

  // Hard-overwrite purge for pure derived content -- content_card by
  // content_key (covers concept-scoped and section-scoped cards alike),
  // content_assessment_item by this batch's assessment_unit_ids.
  // question_bank_item/student_attempt_item's item_id FKs are ON DELETE SET
  // NULL, so this doesn't touch practice/attempt history -- syncPracticeSetItems
  // repopulates question_bank_item from the fresh rows on next materialization.
  const assessmentUnitIds = [...assessmentUnitIdByCardkey.values()];
  await pool.query("DELETE FROM content_card WHERE content_key = $1", [contentKey]);
  await pool.query("DELETE FROM content_assessment_item WHERE assessment_unit_id = ANY($1)", [assessmentUnitIds]);

  const summary = {
    conceptsProcessed: conceptCards.length,
    counts: { teaching: 0, assessmentCore: 0, assessmentExtra: 0, revision: 0, tutor: 0, deeplearning: 0, visual: 0 },
    warnings: [],
    catalogTarget: { sourceSectionId, fkMstChapterId },
  };

  const conceptMemoryByUnit = new Map();
  let cardSortOrder = 0;

  for (const card of cards) {
    const isConceptCard = card.contentuitab === "extraction" && card.processorkey === "concepts";
    const parentAssessmentUnitId = card.parentCardkey ? assessmentUnitIdByCardkey.get(card.parentCardkey) : null;

    if (!isConceptCard && card.parentCardkey && !parentAssessmentUnitId) {
      summary.warnings.push(
        `Card "${card.cardkey}" (${card.contentuitab}/${card.processorkey}) references unknown parentCardkey "${card.parentCardkey}" -- skipped.`
      );
      continue;
    }

    const isSectionScoped = SECTION_SCOPED_TABS.has(card.contentuitab) && !card.parentCardkey;
    const assessmentUnitIdForCard = isConceptCard
      ? assessmentUnitIdByCardkey.get(card.cardkey)
      : parentAssessmentUnitId || null;

    // Modern "cards" array files: source shape is nested { image: { dataUrl } },
    // not a flat "imageDataUrl" string (confirmed against a real upload) --
    // legacy-converted cards already carry a flat imageDataUrl from
    // convertLegacyPayload above, so both are checked here.
    const imageDataUrl = card.image?.dataUrl || card.imageDataUrl || null;

    const insertResult = await pool.query(
      `
        INSERT INTO content_card (
          sync_run_id, assessment_unit_id, source_section_id, content_key,
          contentuitab, processorkey, parent_cardkey, cardkey, sort_order,
          title, summary, details, image_data_url
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (content_key, processorkey, parent_cardkey, cardkey) DO NOTHING
        RETURNING id
      `,
      [
        syncRunId,
        isSectionScoped ? null : assessmentUnitIdForCard,
        isSectionScoped ? sourceSectionId : null,
        contentKey,
        card.contentuitab,
        card.processorkey,
        card.parentCardkey || "",
        card.cardkey,
        card.sortOrder ?? cardSortOrder,
        card.title || null,
        card.summary || null,
        JSON.stringify(toArray(card.details)),
        imageDataUrl,
      ]
    );
    cardSortOrder += 1;

    // image_data_url on content_card is only the imported source-of-truth
    // copy -- the actual student-facing diagram viewer (getDiagramMedia,
    // used by /user/diagrams/:id/media) reads from content_card_media
    // instead (it's versioned, supports admin re-uploads replacing the
    // imported image). Without this insert, an imported image is captured
    // in content_card but the viewer always finds no content_card_media row
    // and renders the "coming soon" placeholder forever.
    const insertedCardId = insertResult.rows[0]?.id;
    if (insertedCardId && imageDataUrl) {
      const mimeType = /^data:([^;,]+)[;,]/.exec(imageDataUrl)?.[1] || "image/png";
      await pool.query(
        `
          INSERT INTO content_card_media (
            content_card_id, version_number, is_selected, media_data, mime_type, created_by
          )
          VALUES ($1, 1, TRUE, $2, $3, $4)
          ON CONFLICT (content_card_id, version_number) DO UPDATE
          SET media_data = EXCLUDED.media_data,
              mime_type = EXCLUDED.mime_type,
              is_selected = TRUE
        `,
        [insertedCardId, imageDataUrl, mimeType, userId]
      );
    }
    onProgress({
      type: "info",
      message: `Card "${card.title || card.cardkey}" (${card.contentuitab}/${card.processorkey}) written.`,
    });
    // Debug aid for images not being picked up during import: lists the
    // property names actually present on this card node (values omitted) so
    // it's possible to see, per card, whether an image field exists at all
    // and under what key -- e.g. "imageDataUrl" vs. a differently-named or
    // missing field from the source JSON. Remove once the import's image
    // handling is confirmed working end to end.
    onProgress({
      type: "info",
      message: `  properties: ${Object.keys(card).join(", ")}`,
    });

    if (isConceptCard) {
      continue;
    }

    if (card.contentuitab === "teaching" && parentAssessmentUnitId) {
      summary.counts.teaching += 1;
      const memory = conceptMemoryByUnit.get(parentAssessmentUnitId) || {};
      if (card.processorkey === "eli5" || card.processorkey === "storymode") {
        memory.story = memory.story || card.summary || null;
      } else if (card.processorkey === "analogy") {
        memory.analogy = card.summary || null;
      } else if (card.processorkey === "realworld") {
        memory.realWorldConnection = card.summary || null;
      }
      conceptMemoryByUnit.set(parentAssessmentUnitId, memory);
    } else if (card.contentuitab === "assessment" && parentAssessmentUnitId) {
      const structuredType = STRUCTURED_ASSESSMENT_FAMILIES[card.processorkey];
      if (structuredType) {
        await insertStructuredAssessmentItem({
          syncRunId,
          contentKey,
          assessmentUnitId: parentAssessmentUnitId,
          card,
          interactionType: structuredType,
        });
        summary.counts.assessmentCore += 1;
      } else {
        summary.counts.assessmentExtra += 1;
      }
    } else if (card.contentuitab === "revision" && parentAssessmentUnitId) {
      summary.counts.revision += 1;
    } else if (card.contentuitab === "tutor" && parentAssessmentUnitId) {
      summary.counts.tutor += 1;
    } else if (card.contentuitab === "deeplearning" && parentAssessmentUnitId) {
      summary.counts.deeplearning += 1;
    } else if (isSectionScoped) {
      summary.counts.visual += 1;
    }
  }

  for (const [assessmentUnitId, memory] of conceptMemoryByUnit) {
    await pool.query(
      `
        INSERT INTO content_concept_memory (assessment_unit_id, story, analogy, real_world_connection, updated_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (assessment_unit_id) DO UPDATE
        SET story = EXCLUDED.story,
            analogy = EXCLUDED.analogy,
            real_world_connection = EXCLUDED.real_world_connection,
            updated_at = NOW()
      `,
      [assessmentUnitId, memory.story || null, memory.analogy || null, memory.realWorldConnection || null]
    );
  }

  for (const assessmentUnitId of assessmentUnitIds) {
    conceptCardCache.invalidate(assessmentUnitId);
  }

  onProgress({ type: "success", message: "Import complete." });
  return summary;
};
