// Read layer for student-facing content, backed by the content-app-shaped
// schema (content_card / content_concept_memory / content_assessment_item --
// see conceptImportService.js) that replaced the seven-layer pipeline schema.
// Exports the same function names/shapes assessmentStudioContextAssembler.js
// used to, so studentContentService.js / studentPracticeService.js /
// microActivityService.js / diagramImageService.js need no logic changes
// beyond the import path.
import { pool } from "../db/pool.js";

const toArray = (value) => (Array.isArray(value) ? value : []);

const getAssessmentUnitBase = async (assessmentUnitId) => {
  const result = await pool.query(
    `
      SELECT
        assessment_unit_id,
        source_section_id,
        fk_mst_chapter_id,
        primary_concept,
        learning_objective,
        concept_category,
        curriculum_importance,
        is_active
      FROM assessment_unit
      WHERE assessment_unit_id = $1
      LIMIT 1
    `,
    [assessmentUnitId]
  );

  return result.rows[0] || null;
};

const getSupportingConcepts = async (assessmentUnitId) => {
  const result = await pool.query(
    `
      SELECT supporting_concept
      FROM assessment_unit_supporting_concept
      WHERE assessment_unit_id = $1
      ORDER BY display_order ASC, id ASC
    `,
    [assessmentUnitId]
  );

  return result.rows.map((row) => row.supporting_concept);
};

const getDependencies = async (assessmentUnitId) => {
  const result = await pool.query(
    `
      SELECT depends_on_assessment_unit_id, dependency_type
      FROM assessment_unit_dependency
      WHERE assessment_unit_id = $1
      ORDER BY id ASC
    `,
    [assessmentUnitId]
  );

  return result.rows;
};

// The concept's own "extraction/concepts" content_card row (see
// conceptImportService.js's card routing) -- title/summary/details, the same
// {label,value} shape every other content_card row uses.
const getConceptCard = async (assessmentUnitId) => {
  const result = await pool.query(
    `
      SELECT title, summary, details
      FROM content_card
      WHERE assessment_unit_id = $1 AND processorkey = 'concepts' AND is_hidden = FALSE
      LIMIT 1
    `,
    [assessmentUnitId]
  );
  return result.rows[0] || null;
};

const extractCoreConcepts = (details) => {
  const keyFeatures = toArray(details).find((entry) =>
    String(entry?.label || "").toLowerCase().includes("key feature")
  );
  return Array.isArray(keyFeatures?.value) ? keyFeatures.value : [];
};

// knowledge.relationships/comparisons/processes/misconceptions/memory_hooks
// stay permanently empty -- the content app's "concepts" card has no
// equivalent structured breakdown, matching the fact that admin-imported
// content never populated these fields either (persistLayer1Knowledge was
// only ever called here with context_summary/core_concepts/assessment_units,
// nothing richer), so this is not a new regression.
export const getLayer1Context = async (assessmentUnitId) => {
  const base = await getAssessmentUnitBase(assessmentUnitId);
  if (!base) {
    return null;
  }

  const [supportingConcepts, dependencies, conceptCard] = await Promise.all([
    getSupportingConcepts(assessmentUnitId),
    getDependencies(assessmentUnitId),
    getConceptCard(assessmentUnitId),
  ]);

  return {
    assessment_unit: {
      assessment_unit_id: base.assessment_unit_id,
      primary_concept: base.primary_concept,
      learning_objective: base.learning_objective,
      concept_category: base.concept_category,
      curriculum_importance: base.curriculum_importance,
      source_section_id: base.source_section_id,
      fk_mst_chapter_id: base.fk_mst_chapter_id,
      supporting_concepts: supportingConcepts,
      dependencies,
    },
    knowledge: {
      context_summary: conceptCard?.summary || "",
      core_concepts: extractCoreConcepts(conceptCard?.details),
      relationships: [],
      comparisons: [],
      processes: [],
      misconceptions: [],
      memory_hooks: [],
    },
  };
};

// Replaces layer2_concept_memory -- content_concept_memory only carries
// story/analogy/real_world_connection (see conceptImportService.js's
// importConceptMemory), so visual_hook/memory_trick/curiosity_hook/
// micro_activity/misconception_alert/memory_difficulty/retrieval_cues/
// associated_concepts stay null/empty, matching current behavior (the admin
// JSON import path never populated those either).
export const getLayer2Memory = async (assessmentUnitId) => {
  const result = await pool.query(
    `
      SELECT cm.assessment_unit_id, au.primary_concept, cm.story, cm.analogy, cm.real_world_connection
      FROM content_concept_memory cm
      INNER JOIN assessment_unit au ON au.assessment_unit_id = cm.assessment_unit_id
      WHERE cm.assessment_unit_id = $1
    `,
    [assessmentUnitId]
  );

  const memory = result.rows[0];
  if (!memory) {
    return null;
  }

  return {
    assessment_unit_id: memory.assessment_unit_id,
    primary_concept: memory.primary_concept,
    formula: null,
    story: memory.story,
    analogy: memory.analogy,
    visual_hook: null,
    real_world_connection: memory.real_world_connection,
    memory_trick: null,
    curiosity_hook: null,
    micro_activity: null,
    misconception_alert: null,
    memory_difficulty: null,
    retrieval_cues: [],
    associated_concepts: [],
  };
};

// Structured assessment items for grading/practice-set materialization --
// content_assessment_item stores options/hints as JSON arrays directly, no
// child tables to join. blueprint_id/assessment_dimension/diagram_instruction
// stay null (no equivalent in the new content app); acceptable_answers stays
// empty (free_text grading is AI-judged, see studentPracticeService.js).
export const getLayer6Items = async (assessmentUnitId) => {
  const result = await pool.query(
    `
      SELECT
        sync_run_id AS generation_id,
        item_id,
        assessment_unit_id,
        question_family,
        interaction_type,
        difficulty,
        blooms_level,
        learning_objective,
        question,
        correct_answer,
        options,
        marks,
        estimated_time_seconds
      FROM content_assessment_item
      WHERE assessment_unit_id = $1
      ORDER BY id ASC
    `,
    [assessmentUnitId]
  );

  return result.rows.map((row) => ({
    generation_id: row.generation_id,
    item_id: row.item_id,
    blueprint_id: null,
    assessment_unit_id: row.assessment_unit_id,
    question_family: row.question_family,
    interaction_type: row.interaction_type,
    difficulty: row.difficulty,
    blooms_level: row.blooms_level,
    assessment_dimension: null,
    learning_objective: row.learning_objective,
    question: row.question,
    correct_answer: row.correct_answer,
    interaction_data: {},
    diagram_instruction: null,
    marks: row.marks,
    estimated_time_seconds: row.estimated_time_seconds,
    options: toArray(row.options),
    acceptable_answers: [],
  }));
};

export const getAssessmentUnitsForSourceSection = async (sourceSectionId) => {
  const result = await pool.query(
    `
      SELECT assessment_unit_id
      FROM assessment_unit
      WHERE source_section_id = $1
        AND is_active = TRUE
      ORDER BY id ASC
    `,
    [sourceSectionId]
  );

  return result.rows.map((row) => row.assessment_unit_id);
};

// Section-scoped root cards (pdfassets/visual, see conceptImportService.js's
// card routing) -- the content app's diagram/mind-map cards are AI-image-
// generation prompts, not interactive labeled diagrams, so there's no
// labels/testedLabels data anymore (StudentDiagramsPage.jsx's flip-card back
// face was simplified to match). "ocr" is raw extracted text, not a visual,
// so it's excluded here.
export const getDiagramsForSection = async (sourceSectionId) => {
  const result = await pool.query(
    `
      SELECT id, title, summary
      FROM content_card
      WHERE source_section_id = $1
        AND contentuitab IN ('pdfassets', 'visual')
        AND processorkey <> 'ocr'
        AND is_hidden = FALSE
      ORDER BY sort_order ASC, id ASC
    `,
    [sourceSectionId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    diagramName: row.title,
    purpose: row.summary,
  }));
};

// No equivalent of layer1_terminology in the content app's schema -- always
// empty. StudentFlashcardsPage.jsx (fed by this) will show its empty state;
// the separate Revision page's "flashcards" mode tab (content_card,
// contentuitab='revision') is the populated flashcard source going forward.
export const getTerminologyForSection = async () => [];

// visual/{mindmap,flowchart,infographics,notebooknotes,visualposter} cards --
// section-scoped like pdfassets/visual are for getDiagramsForSection, but
// kept as its own query (contentuitab='visual' only, no 'pdfassets') so the
// Explore tab's "Visual Learning" step doesn't duplicate what the Diagrams
// page already shows. Same content_card rows either way, so the existing
// content_card_media-backed diagram media endpoint works unchanged for these
// ids too.
export const getVisualLearningCardsForSection = async (sourceSectionId) => {
  const result = await pool.query(
    `
      SELECT id, processorkey, title, summary, details
      FROM content_card
      WHERE source_section_id = $1 AND contentuitab = 'visual' AND is_hidden = FALSE
      ORDER BY sort_order ASC, id ASC
    `,
    [sourceSectionId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    mode: row.processorkey,
    title: row.title,
    summary: row.summary,
    details: toArray(row.details),
  }));
};

// textbook/{activities,exercises} cards -- section-scoped like pdfassets/
// visual (see conceptImportService.js's card routing), feeds the student
// "Exercises/Activities" tab. Items are the textbook's own end-of-section
// activities and reflection questions, not tied to a single concept.
// activityKey ("${content_key}:${cardkey}") is exposed alongside the row id
// because it -- not the row id -- is the stable identity for a card's
// student response history: content_card rows are hard-deleted/re-inserted
// (fresh ids) on every re-import, but content_key+cardkey survives (see
// textbook_content_response in init.sql).
export const getTextbookContentForSection = async (sourceSectionId) => {
  const result = await pool.query(
    `
      SELECT id, content_key, cardkey, processorkey, title, summary, details
      FROM content_card
      WHERE source_section_id = $1 AND contentuitab = 'textbook' AND is_hidden = FALSE
      ORDER BY sort_order ASC, id ASC
    `,
    [sourceSectionId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    activityKey: `${row.content_key}:${row.cardkey}`,
    mode: row.processorkey,
    title: row.title,
    summary: row.summary,
    details: toArray(row.details),
  }));
};

// Competencies ("learning pillars") each concept develops, via
// concept_learning_pillar (see conceptImportService.js's
// resolveConceptPillarLinks). Joined on (content_key, pillar_cardkey)
// rather than a content_card.id FK -- same reason as everywhere else in
// this file: content_card rows churn ids on re-import, but that composite
// key survives. Returns a Map so callers building a per-concept list (e.g.
// getSectionOverview) can look up by assessmentUnitId with no N+1 queries.
export const getConceptLearningPillars = async (assessmentUnitIds) => {
  if (!assessmentUnitIds.length) {
    return new Map();
  }

  const result = await pool.query(
    `
      SELECT clp.assessment_unit_id, cc.cardkey AS pillar_cardkey, cc.title AS pillar_title
      FROM concept_learning_pillar clp
      JOIN content_card cc
        ON cc.content_key = clp.content_key
       AND cc.cardkey = clp.pillar_cardkey
       AND cc.contentuitab = 'learningpillars'
       AND cc.is_hidden = FALSE
      WHERE clp.assessment_unit_id = ANY($1)
      ORDER BY cc.sort_order ASC, cc.id ASC
    `,
    [assessmentUnitIds]
  );

  const byUnit = new Map();
  for (const row of result.rows) {
    const list = byUnit.get(row.assessment_unit_id) || [];
    list.push({ key: row.pillar_cardkey, title: row.pillar_title });
    byUnit.set(row.assessment_unit_id, list);
  }
  return byUnit;
};

export const getSectionKnowledgeSummary = async (sourceSectionId) => {
  const result = await pool.query(
    `
      SELECT COUNT(*)::int AS count
      FROM assessment_unit
      WHERE source_section_id = $1 AND is_active = TRUE
    `,
    [sourceSectionId]
  );

  const count = result.rows[0]?.count || 0;
  return count > 0 ? `This Textbook Section covers ${count} Concept${count === 1 ? "" : "s"}.` : null;
};
