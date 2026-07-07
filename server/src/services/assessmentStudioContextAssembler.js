import { pool } from "../db/pool.js";
import {
  buildPracticeDirectivesText,
  getPracticeTypeProfile,
} from "./assessmentStudioPracticeProfile.js";

const toArray = (value) => (Array.isArray(value) ? value : []);

const extractAssessmentUnitSlice = (contractJson, assessmentUnitId) =>
  toArray(contractJson?.assessment_units).find(
    (unit) => unit?.assessment_unit_id === assessmentUnitId
  ) || null;

const filterByConcept = (items, primaryConcept) => {
  const normalizedConcept = (primaryConcept || "").toString().trim().toLowerCase();

  if (!normalizedConcept) {
    return items;
  }

  const matching = items.filter((item) =>
    (item?.concept || "")
      .toString()
      .trim()
      .toLowerCase()
      .includes(normalizedConcept)
  );

  return matching.length > 0 ? matching : items;
};

const normalizeText = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const BENGALI_SCRIPT_PATTERN = /[\u0980-\u09FF]/u;

const normalizeLanguageCode = (value = "") => {
  const normalized = String(value || "").trim().toLowerCase();

  if (!normalized) {
    return "";
  }

  if (["bn", "bn-bd", "bn-in", "bengali", "bangla"].includes(normalized)) {
    return "bn";
  }

  if (["en", "en-us", "en-gb", "english"].includes(normalized)) {
    return "en";
  }

  return normalized;
};

const detectSourceLanguage = (value = "") =>
  BENGALI_SCRIPT_PATTERN.test(String(value || "")) ? "bn" : "en";

const toMemoryHookObject = (hook) => {
  if (typeof hook === "string") {
    const [conceptPart, reasonPart] = hook.split(/\s+needs?\s+memory\s+support\s+because\s+/i);
    return {
      concept: conceptPart?.trim() || "memory support",
      memory_type: "support_candidate",
      memory_hook: hook,
      why_it_helps: reasonPart?.trim() || null,
    };
  }

  return {
    concept: hook?.concept || hook?.linked_concept || hook?.linkedConcept || null,
    memory_type: hook?.memory_type || hook?.memoryType || null,
    memory_hook: hook?.memory_hook || hook?.memoryHook || hook?.hook || null,
    why_it_helps: hook?.why_it_helps || hook?.whyItHelps || hook?.reason || null,
  };
};

const getRelevantMemoryHooks = ({ hooks = [], primaryConcept, supportingConcepts = [] }) => {
  const normalizedPrimary = normalizeText(primaryConcept);
  const supportTerms = supportingConcepts.map(normalizeText).filter(Boolean);
  const normalizedHooks = hooks
    .map(toMemoryHookObject)
    .filter((hook) => hook.memory_hook);

  if (!normalizedPrimary && supportTerms.length === 0) {
    return normalizedHooks;
  }

  const matching = normalizedHooks.filter((hook) => {
    const combined = normalizeText(
      [hook.concept, hook.memory_hook, hook.why_it_helps].filter(Boolean).join(" ")
    );
    return (
      (normalizedPrimary && combined.includes(normalizedPrimary)) ||
      supportTerms.some((term) => term && combined.includes(term))
    );
  });

  return matching.length > 0 ? matching : normalizedHooks;
};

const getAssessmentUnitBase = async (assessmentUnitId) => {
  const result = await pool.query(
    `
      SELECT
        assessment_unit_id,
        generation_id,
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

const getRunDirectivesForSection = async (sourceSectionId) => {
  const result = await pool.query(
    `
      SELECT request_payload
      FROM assessment_pipeline_run
      WHERE source_section_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `,
    [sourceSectionId]
  );

  const payload = result.rows[0]?.request_payload || {};
  const practiceProfile = getPracticeTypeProfile(payload?.practiceType);
  const sourceText =
    payload?.sectionOcrText || payload?.section_text || payload?.ocrText || "";
  const sourceLanguage =
    normalizeLanguageCode(
      payload?.sourceLanguage || payload?.source_language || payload?.language || payload?.languageCode
    ) || detectSourceLanguage(sourceText);
  const outputLanguage =
    normalizeLanguageCode(payload?.outputLanguage || payload?.output_language) || sourceLanguage;

  return {
    board: payload?.board || null,
    className: payload?.className || null,
    subject: payload?.subject || null,
    chapter: payload?.chapter || null,
    practiceType: payload?.practiceType || null,
    targetDifficulty: payload?.targetDifficulty || null,
    duration: payload?.duration || null,
    blueprint: payload?.blueprint || null,
    source_language: sourceLanguage,
    output_language: outputLanguage,
    practice_profile: practiceProfile,
    practice_type_directives: buildPracticeDirectivesText(practiceProfile),
  };
};

export const getLayer1Context = async (assessmentUnitId) => {
  const base = await getAssessmentUnitBase(assessmentUnitId);
  if (!base) {
    return null;
  }

  const [supportingConcepts, dependencies, contractResult, misconceptionsResult, hooksResult, coreConceptsResult] =
    await Promise.all([
      getSupportingConcepts(assessmentUnitId),
      getDependencies(assessmentUnitId),
      pool.query(
        `
          SELECT contract_json
          FROM layer1_knowledge_contract
          WHERE generation_id = $1
          LIMIT 1
        `,
        [base.generation_id]
      ),
      pool.query(
        `
          SELECT concept, misconception, correction
          FROM layer1_common_misconception
          WHERE generation_id = $1
          ORDER BY id ASC
        `,
        [base.generation_id]
      ),
      pool.query(
        `
          SELECT concept, memory_type, memory_hook, why_it_helps
          FROM layer1_memory_hook
          WHERE generation_id = $1
          ORDER BY id ASC
        `,
        [base.generation_id]
      ),
      pool.query(
        `
          SELECT concept_name, display_order
          FROM layer1_core_concept
          WHERE generation_id = $1
          ORDER BY display_order ASC, id ASC
        `,
        [base.generation_id]
      ),
    ]);

  const contractJson = contractResult.rows[0]?.contract_json || {};
  const unitSlice = extractAssessmentUnitSlice(contractJson, assessmentUnitId);
  const misconceptions = filterByConcept(
    misconceptionsResult.rows.map((row) => ({
      concept: row.concept,
      misconception: row.misconception,
      correction: row.correction,
    })),
    base.primary_concept
  );
  const normalizedMemoryHooks = hooksResult.rows.map((row) => ({
      concept: row.concept,
      memory_type: row.memory_type,
      memory_hook: row.memory_hook,
      why_it_helps: row.why_it_helps,
  }));
  const contractMemoryHooks = toArray(contractJson?.memory_hooks);
  const memoryHooks = getRelevantMemoryHooks({
    hooks:
      normalizedMemoryHooks.length > 0
        ? normalizedMemoryHooks
        : contractMemoryHooks,
    primaryConcept: base.primary_concept,
    supportingConcepts,
  });
  const coreConcepts = coreConceptsResult.rows.map((row) => row.concept_name);
  const runDirectives = await getRunDirectivesForSection(base.source_section_id);

  return {
    assessment_unit: {
      assessment_unit_id: base.assessment_unit_id,
      primary_concept: base.primary_concept,
      learning_objective: base.learning_objective || unitSlice?.learning_objective || null,
      concept_category: base.concept_category,
      curriculum_importance: base.curriculum_importance,
      source_section_id: base.source_section_id,
      fk_mst_chapter_id: base.fk_mst_chapter_id,
      supporting_concepts: supportingConcepts,
      dependencies,
    },
    knowledge: {
      assessment_unit: unitSlice,
      context_summary: contractJson?.context_summary || "",
      core_concepts: coreConcepts,
      relationships: toArray(contractJson?.relationships),
      comparisons: toArray(contractJson?.comparisons),
      processes: toArray(contractJson?.processes),
      misconceptions,
      memory_hooks: memoryHooks,
    },
    generation_directives: runDirectives,
  };
};

// A well-formed but unreachable UUID: forces every caller's
// "item.generation_id = $2" filter to match zero rows, without needing to
// special-case the moderation gate at each of the several call sites below.
const UNREACHABLE_GENERATION_ID = "00000000-0000-0000-0000-000000000000";

// Returns the generation_id an assessment unit's layer output should be read
// from: the explicitly selected version if one has been chosen (via the
// pipeline runs UI, including after a layer re-run), otherwise null so callers
// fall back to "latest by created_at" for data that predates versioning.
//
// If the selected version has been rejected by a moderator (approval_status),
// this deliberately does NOT return null -- null would make every caller fall
// back to "latest generation regardless of selection," which would silently
// defeat the moderation gate. Instead it returns a generation id that can
// never match, so callers correctly surface "not generated yet" instead of
// quietly serving rejected content.
export const getSelectedGenerationId = async ({ assessmentUnitId, layerNumber }) => {
  const result = await pool.query(
    `
      SELECT generation_id, approval_status
      FROM layer_generation_version
      WHERE assessment_unit_id = $1 AND layer_number = $2 AND is_selected = TRUE
      LIMIT 1
    `,
    [assessmentUnitId, layerNumber]
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return row.approval_status === "rejected" ? UNREACHABLE_GENERATION_ID : row.generation_id;
};

const getLatestRowByAssessmentUnit = async ({
  tableName,
  assessmentUnitId,
  layerNumber,
  selectSql,
  whereSql = "",
}) => {
  const selectedGenerationId = layerNumber
    ? await getSelectedGenerationId({ assessmentUnitId, layerNumber })
    : null;

  const result = await pool.query(
    `
      SELECT ${selectSql}
      FROM ${tableName} item
      INNER JOIN generation_registry gr
        ON gr.generation_id = item.generation_id
      WHERE item.assessment_unit_id = $1
        ${whereSql}
        ${selectedGenerationId ? "AND item.generation_id = $2" : ""}
      ORDER BY gr.created_at DESC, item.id DESC
      LIMIT 1
    `,
    selectedGenerationId ? [assessmentUnitId, selectedGenerationId] : [assessmentUnitId]
  );

  return result.rows[0] || null;
};

const getLayer2Context = async (assessmentUnitId) => {
  const layer1Context = await getLayer1Context(assessmentUnitId);
  if (!layer1Context) {
    return null;
  }

  return {
    assessment_unit: layer1Context.assessment_unit,
    supporting_concepts: layer1Context.assessment_unit.supporting_concepts,
    dependencies: layer1Context.assessment_unit.dependencies,
    misconception_profile: layer1Context.knowledge.misconceptions,
    memory_hooks: layer1Context.knowledge.memory_hooks,
    generation_directives: layer1Context.generation_directives,
  };
};

export const getLayer2Memory = async (assessmentUnitId) => {
  const memory = await getLatestRowByAssessmentUnit({
    tableName: "layer2_concept_memory",
    assessmentUnitId,
    layerNumber: 2,
    selectSql: `
      item.id,
      item.generation_id,
      item.assessment_unit_id,
      item.primary_concept,
      item.canonical_json,
      item.story,
      item.analogy,
      item.visual_hook,
      item.real_world_connection,
      item.memory_trick,
      item.curiosity_hook,
      item.micro_activity,
      item.misconception_alert,
      item.memory_difficulty,
      item.estimated_memory_strength
    `,
  });

  if (!memory) {
    return null;
  }

  const [supportingConceptsResult, retrievalCuesResult, associatedConceptsResult] =
    await Promise.all([
      pool.query(
        `
          SELECT supporting_concept
          FROM layer2_concept_memory_supporting_concept
          WHERE layer2_concept_memory_id = $1
          ORDER BY display_order ASC, id ASC
        `,
        [memory.id]
      ),
      pool.query(
        `
          SELECT retrieval_cue
          FROM layer2_concept_memory_retrieval_cue
          WHERE layer2_concept_memory_id = $1
          ORDER BY display_order ASC, id ASC
        `,
        [memory.id]
      ),
      pool.query(
        `
          SELECT associated_concept
          FROM layer2_concept_memory_associated_concept
          WHERE layer2_concept_memory_id = $1
          ORDER BY display_order ASC, id ASC
        `,
        [memory.id]
      ),
    ]);

  return {
    generation_id: memory.generation_id,
    assessment_unit_id: memory.assessment_unit_id,
    ...(memory.canonical_json || {}),
    primary_concept: memory.primary_concept,
    story: memory.story,
    analogy: memory.analogy,
    visual_hook: memory.visual_hook,
    real_world_connection: memory.real_world_connection,
    memory_trick: memory.memory_trick,
    curiosity_hook: memory.curiosity_hook,
    micro_activity: memory.micro_activity,
    misconception_alert: memory.misconception_alert,
    memory_difficulty: memory.memory_difficulty,
    estimated_memory_strength: memory.estimated_memory_strength,
    supporting_concepts: supportingConceptsResult.rows.map((row) => row.supporting_concept),
    retrieval_cues: retrievalCuesResult.rows.map((row) => row.retrieval_cue),
    associated_concepts: associatedConceptsResult.rows.map(
      (row) => row.associated_concept
    ),
  };
};

export const getLayer3Capability = async (assessmentUnitId) =>
  getLatestRowByAssessmentUnit({
    tableName: "layer3_assessment_capability_contract",
    assessmentUnitId,
    layerNumber: 3,
    selectSql: "item.generation_id, item.assessment_unit_id, item.output_json",
  });

export const getLayer4Strategy = async (assessmentUnitId) =>
  getLatestRowByAssessmentUnit({
    tableName: "layer4_assessment_strategy_contract",
    assessmentUnitId,
    layerNumber: 4,
    selectSql: "item.generation_id, item.assessment_unit_id, item.output_json",
  });

export const getLayer5Blueprint = async (assessmentUnitId) => {
  const selectedGenerationId = await getSelectedGenerationId({
    assessmentUnitId,
    layerNumber: 5,
  });

  const result = await pool.query(
    `
      SELECT
        item.blueprint_id,
        item.question_family,
        item.interaction_type,
        item.expected_answer_type,
        item.blooms_level,
        item.difficulty,
        item.marks,
        item.estimated_time_seconds,
        item.common_misconception,
        item.success_criteria,
        item.memory_support,
        item.generator_constraints
      FROM layer5_item_blueprint item
      INNER JOIN generation_registry gr ON gr.generation_id = item.generation_id
      WHERE item.assessment_unit_id = $1
        ${selectedGenerationId ? "AND item.generation_id = $2" : ""}
      ORDER BY gr.created_at DESC, item.id DESC
      LIMIT 1
    `,
    selectedGenerationId ? [assessmentUnitId, selectedGenerationId] : [assessmentUnitId]
  );

  return result.rows[0] || null;
};

export const getLayer6Items = async (assessmentUnitId) => {
  const selectedGenerationId = await getSelectedGenerationId({
    assessmentUnitId,
    layerNumber: 6,
  });

  const itemsResult = await pool.query(
    `
      SELECT
        item.id,
        item.generation_id,
        item.item_id,
        item.blueprint_id,
        item.assessment_unit_id,
        item.question_family,
        item.interaction_type,
        item.difficulty,
        item.blooms_level,
        item.assessment_dimension,
        item.learning_objective,
        item.question,
        item.correct_answer,
        item.interaction_data,
        item.diagram_instruction,
        item.marks,
        item.estimated_time_seconds
      FROM layer6_assessment_item item
      INNER JOIN generation_registry gr ON gr.generation_id = item.generation_id
      WHERE item.assessment_unit_id = $1
        ${selectedGenerationId ? "AND item.generation_id = $2" : ""}
      ORDER BY gr.created_at ASC, item.id ASC
    `,
    selectedGenerationId ? [assessmentUnitId, selectedGenerationId] : [assessmentUnitId]
  );

  const items = [];
  for (const row of itemsResult.rows) {
    const [optionsResult, acceptableAnswersResult] = await Promise.all([
      pool.query(
        `
          SELECT option_text
          FROM layer6_assessment_item_option
          WHERE layer6_assessment_item_id = $1
          ORDER BY display_order ASC, id ASC
        `,
        [row.id]
      ),
      pool.query(
        `
          SELECT answer_text
          FROM layer6_assessment_item_acceptable_answer
          WHERE layer6_assessment_item_id = $1
          ORDER BY display_order ASC, id ASC
        `,
        [row.id]
      ),
    ]);

    items.push({
      generation_id: row.generation_id,
      item_id: row.item_id,
      blueprint_id: row.blueprint_id,
      assessment_unit_id: row.assessment_unit_id,
      question_family: row.question_family,
      interaction_type: row.interaction_type,
      difficulty: row.difficulty,
      blooms_level: row.blooms_level,
      assessment_dimension: row.assessment_dimension,
      learning_objective: row.learning_objective,
      question: row.question,
      correct_answer: row.correct_answer,
      interaction_data: row.interaction_data,
      diagram_instruction: row.diagram_instruction,
      marks: row.marks,
      estimated_time_seconds: row.estimated_time_seconds,
      options: optionsResult.rows.map((option) => option.option_text),
      acceptable_answers: acceptableAnswersResult.rows.map(
        (answer) => answer.answer_text
      ),
    });
  }

  return items;
};

// Reads the persisted Layer 7 output for an assessment unit (student-facing
// feedback: explanations, distractor analysis, hints, misconception
// correction, remediation). Note this is scoped to the assessment unit as a
// whole, not to one specific Layer 6 item -- a unit can have several items but
// only one Layer 7 support record per generation, so "why was this wrong
// option wrong" is matched by option_text at the unit level.
export const getLayer7Support = async (assessmentUnitId) => {
  const selectedGenerationId = await getSelectedGenerationId({
    assessmentUnitId,
    layerNumber: 7,
  });

  const result = await pool.query(
    `
      SELECT
        item.id,
        item.generation_id,
        item.concept_explanation,
        item.correct_answer_reasoning,
        item.real_world_insight,
        item.mastery_recommendation
      FROM layer7_learning_support item
      INNER JOIN generation_registry gr ON gr.generation_id = item.generation_id
      WHERE item.assessment_unit_id = $1
        ${selectedGenerationId ? "AND item.generation_id = $2" : ""}
      ORDER BY gr.created_at DESC, item.id DESC
      LIMIT 1
    `,
    selectedGenerationId ? [assessmentUnitId, selectedGenerationId] : [assessmentUnitId]
  );

  const support = result.rows[0];
  if (!support) {
    return null;
  }

  const [distractorsResult, hintsResult, misconceptionResult, remediationResult] =
    await Promise.all([
      pool.query(
        `
          SELECT option_text, reason_selected, why_incorrect
          FROM layer7_distractor_analysis
          WHERE layer7_learning_support_id = $1
          ORDER BY display_order ASC, id ASC
        `,
        [support.id]
      ),
      pool.query(
        `
          SELECT hint_text
          FROM layer7_progressive_hint
          WHERE layer7_learning_support_id = $1
          ORDER BY display_order ASC, id ASC
        `,
        [support.id]
      ),
      pool.query(
        `
          SELECT misconception, reason, correction
          FROM layer7_misconception_feedback
          WHERE layer7_learning_support_id = $1
          LIMIT 1
        `,
        [support.id]
      ),
      pool.query(
        `
          SELECT remediation_text
          FROM layer7_adaptive_remediation
          WHERE layer7_learning_support_id = $1
          ORDER BY display_order ASC, id ASC
        `,
        [support.id]
      ),
    ]);

  return {
    conceptExplanation: support.concept_explanation,
    correctAnswerReasoning: support.correct_answer_reasoning,
    realWorldInsight: support.real_world_insight,
    masteryRecommendation: support.mastery_recommendation,
    distractorAnalysis: distractorsResult.rows.map((row) => ({
      optionText: row.option_text,
      reasonSelected: row.reason_selected,
      whyIncorrect: row.why_incorrect,
    })),
    progressiveHints: hintsResult.rows.map((row) => row.hint_text),
    misconceptionFeedback: misconceptionResult.rows[0]
      ? {
          misconception: misconceptionResult.rows[0].misconception,
          reason: misconceptionResult.rows[0].reason,
          correction: misconceptionResult.rows[0].correction,
        }
      : null,
    adaptiveRemediation: remediationResult.rows.map((row) => row.remediation_text),
  };
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

// Layer 1 has no per-assessment-unit version selection (a Layer 1 re-run is
// blocked because it would redefine every downstream assessment unit), so
// section-level Layer 1 reads (context summary, diagrams, terminology) simply
// use the most recently completed Layer 1 generation for that source section.
export const getLatestLayer1GenerationForSection = async (sourceSectionId) => {
  const result = await pool.query(
    `
      SELECT gr.generation_id
      FROM layer_run lr
      INNER JOIN generation_registry gr ON gr.generation_id = lr.generation_id
      WHERE lr.source_section_id = $1
        AND lr.layer_number = 1
        AND gr.status = 'completed'
      ORDER BY gr.created_at DESC, gr.id DESC
      LIMIT 1
    `,
    [sourceSectionId]
  );

  return result.rows[0]?.generation_id || null;
};

export const getDiagramsForSection = async (sourceSectionId) => {
  const generationId = await getLatestLayer1GenerationForSection(sourceSectionId);
  if (!generationId) {
    return [];
  }

  const diagramsResult = await pool.query(
    `
      SELECT id, diagram_name, purpose
      FROM layer1_diagram
      WHERE generation_id = $1
      ORDER BY id ASC
    `,
    [generationId]
  );

  const diagrams = [];
  for (const diagram of diagramsResult.rows) {
    const [labelsResult, testedLabelsResult] = await Promise.all([
      pool.query(
        `
          SELECT label_name
          FROM layer1_diagram_label
          WHERE layer1_diagram_id = $1
          ORDER BY display_order ASC, id ASC
        `,
        [diagram.id]
      ),
      pool.query(
        `
          SELECT label_name
          FROM layer1_diagram_tested_label
          WHERE layer1_diagram_id = $1
          ORDER BY display_order ASC, id ASC
        `,
        [diagram.id]
      ),
    ]);

    diagrams.push({
      diagramName: diagram.diagram_name,
      purpose: diagram.purpose,
      labels: labelsResult.rows.map((row) => row.label_name),
      testedLabels: testedLabelsResult.rows.map((row) => row.label_name),
    });
  }

  return diagrams;
};

export const getTerminologyForSection = async (sourceSectionId) => {
  const generationId = await getLatestLayer1GenerationForSection(sourceSectionId);
  if (!generationId) {
    return [];
  }

  const termsResult = await pool.query(
    `
      SELECT id, term, definition
      FROM layer1_terminology
      WHERE generation_id = $1
      ORDER BY id ASC
    `,
    [generationId]
  );

  const terms = [];
  for (const row of termsResult.rows) {
    const relatedResult = await pool.query(
      `
        SELECT related_concept
        FROM layer1_terminology_related_concept
        WHERE layer1_terminology_id = $1
        ORDER BY display_order ASC, id ASC
      `,
      [row.id]
    );

    terms.push({
      term: row.term,
      definition: row.definition,
      relatedConcepts: relatedResult.rows.map((item) => item.related_concept),
    });
  }

  return terms;
};

export const getSectionKnowledgeSummary = async (sourceSectionId) => {
  const generationId = await getLatestLayer1GenerationForSection(sourceSectionId);
  if (!generationId) {
    return null;
  }

  const result = await pool.query(
    `
      SELECT context_summary
      FROM layer1_knowledge_contract
      WHERE generation_id = $1
      LIMIT 1
    `,
    [generationId]
  );

  return result.rows[0]?.context_summary || null;
};

export const buildAssessmentUnitLayerContext = async ({
  layerNumber,
  assessmentUnitId,
}) => {
  switch (layerNumber) {
    case 2:
      return getLayer2Context(assessmentUnitId);
    case 3: {
      const [layer1Context, layer2Memory] = await Promise.all([
        getLayer1Context(assessmentUnitId),
        getLayer2Memory(assessmentUnitId),
      ]);

      if (!layer1Context) {
        return null;
      }

      return {
        assessment_unit: layer1Context.assessment_unit,
        concept_memory: layer2Memory,
        prerequisite_list: layer1Context.assessment_unit.dependencies,
        generation_directives: layer1Context.generation_directives,
      };
    }
    case 4: {
      const [layer1Context, layer2Memory, layer3Capability] = await Promise.all([
        getLayer1Context(assessmentUnitId),
        getLayer2Memory(assessmentUnitId),
        getLayer3Capability(assessmentUnitId),
      ]);

      if (!layer1Context) {
        return null;
      }

      return {
        assessment_unit: layer1Context.assessment_unit,
        capability: layer3Capability?.output_json?.capability || layer3Capability?.output_json || {},
        memory_profile: layer2Memory,
        misconception_profile: layer1Context.knowledge.misconceptions,
        generation_directives: layer1Context.generation_directives,
      };
    }
    case 5: {
      const [layer1Context, layer2Memory, layer4Strategy] = await Promise.all([
        getLayer1Context(assessmentUnitId),
        getLayer2Memory(assessmentUnitId),
        getLayer4Strategy(assessmentUnitId),
      ]);

      if (!layer1Context) {
        return null;
      }

      return {
        assessment_unit: layer1Context.assessment_unit,
        memory: layer2Memory,
        strategy: layer4Strategy?.output_json?.strategy || layer4Strategy?.output_json || {},
        generation_directives: layer1Context.generation_directives,
      };
    }
    case 6: {
      const [layer1Context, blueprint] = await Promise.all([
        getLayer1Context(assessmentUnitId),
        getLayer5Blueprint(assessmentUnitId),
      ]);

      if (!layer1Context) {
        return null;
      }

      return {
        assessment_unit: layer1Context.assessment_unit,
        blueprint,
        generation_directives: layer1Context.generation_directives,
      };
    }
    case 7: {
      const [layer1Context, layer2Memory, assessmentItems] = await Promise.all([
        getLayer1Context(assessmentUnitId),
        getLayer2Memory(assessmentUnitId),
        getLayer6Items(assessmentUnitId),
      ]);

      if (!layer1Context) {
        return null;
      }

      return {
        assessment_unit: layer1Context.assessment_unit,
        assessment_items: assessmentItems,
        memory: layer2Memory,
        misconception_profile: layer1Context.knowledge.misconceptions,
        generation_directives: layer1Context.generation_directives,
        student_response: null,
      };
    }
    default:
      return null;
  }
};
