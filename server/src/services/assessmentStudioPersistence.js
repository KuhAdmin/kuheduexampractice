import { pool } from "../db/pool.js";

const toArray = (value) => (Array.isArray(value) ? value : []);

const toTextArray = (value) =>
  toArray(value)
    .map((item) =>
      typeof item === "string" ? item : item?.name || item?.text || item?.label || null
    )
    .filter(Boolean);

// The Layer 6 prompt schema (assessmentStudioService.js) only spells out
// { "assessment_items": [] } with no per-item field contract, so in practice
// the model has emitted at least three different (and mutually inconsistent,
// even across generations of the same assessment unit) shapes for the same
// concepts: "question"/"correct_answer" as plain text, "prompt"/
// "correct_option_id" with options as {text, option_id}, and "question_text"/
// "correct_answer": [optionId] with options as {option_text, option_id}. These
// resolvers cover all three so question/correct_answer are never silently
// blank, without disturbing content already using the originally expected
// field names.
export const resolveItemQuestionText = (item) =>
  item?.question || item?.prompt || item?.question_text || item?.questionText || "";

export const extractOptionText = (option) => {
  if (typeof option === "string") {
    return option;
  }
  return (
    option?.text ||
    option?.option_text ||
    option?.optionText ||
    option?.name ||
    option?.label ||
    null
  );
};

const extractOptionId = (option) =>
  option && typeof option === "object" ? option.option_id || option.optionId || option.id || null : null;

const resolveOptionTextById = (options, id) => {
  const match = toArray(options).find((option) => extractOptionId(option) === id);
  return match ? extractOptionText(match) : null;
};

// Some generations mark correctness with a bare option letter ("A"/"B"/"(C)"/
// "D.") referring to the option's POSITION rather than its id or text -- most
// often when options are plain strings with no option_id field at all, so
// resolveOptionTextById never matches and silently falls back to returning
// the letter itself. Only used as a last resort (see resolveItemCorrectAnswerText)
// after a literal text match is ruled out, so a genuinely single-letter answer
// text (e.g. blood group "B") is never misread as a position reference.
const BARE_LETTER_LABEL_PATTERN = /^\(?([A-Da-d])\)?\.?$/;

const resolveOptionTextByLetter = (options, candidate) => {
  const match = String(candidate || "").trim().match(BARE_LETTER_LABEL_PATTERN);
  if (!match) {
    return null;
  }
  const letterIndex = match[1].toUpperCase().charCodeAt(0) - "A".charCodeAt(0);
  const optionAtIndex = toArray(options)[letterIndex];
  return optionAtIndex ? extractOptionText(optionAtIndex) : null;
};

export const resolveItemCorrectAnswerText = (item) => {
  // Some generations mark correctness by a numeric index into a plain-string
  // options array (e.g. "correct_answer_index": 0) instead of an id/text.
  const correctIndex = item?.correct_answer_index ?? item?.correctAnswerIndex;
  if (Number.isInteger(correctIndex)) {
    const optionAtIndex = toArray(item?.options)[correctIndex];
    const resolvedFromIndex = optionAtIndex ? extractOptionText(optionAtIndex) : null;
    if (resolvedFromIndex) {
      return resolvedFromIndex;
    }
  }

  const rawCorrect =
    item?.correct_answer ??
    item?.correctAnswer ??
    item?.correct_option_id ??
    item?.correctOptionId ??
    item?.answer_key ??
    item?.answerKey ??
    item?.answer;

  if (rawCorrect === undefined || rawCorrect === null) {
    return null;
  }

  const optionTexts = toArray(item?.options).map(extractOptionText).filter(Boolean);

  const candidates = Array.isArray(rawCorrect) ? rawCorrect : [rawCorrect];
  const resolved = candidates
    .map((candidate) => {
      if (typeof candidate !== "string" || !candidate.trim()) {
        return null;
      }
      const trimmedCandidate = candidate.trim();

      // Prefer resolving to the option's actual text (candidate may just be an
      // option id).
      const byId = resolveOptionTextById(item?.options, trimmedCandidate);
      if (byId) {
        return byId;
      }

      // If the candidate is already the literal text of one of the options
      // (covers non-MCQ items, and short-answer MCQs like blood groups where
      // the answer text itself happens to be a single letter), keep it as-is
      // before ever treating it as a positional label.
      const literalMatch = optionTexts.find(
        (text) => text.toLowerCase() === trimmedCandidate.toLowerCase()
      );
      if (literalMatch) {
        return literalMatch;
      }

      // Last resort: candidate is a bare option letter ("B") referring to the
      // option's position in a plain-string options array.
      return resolveOptionTextByLetter(item?.options, trimmedCandidate) || trimmedCandidate;
    })
    .filter(Boolean);

  return resolved.length ? resolved.join("; ") : null;
};

const toTextList = (value) => {
  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }
  return toTextArray(value);
};

const asJson = (value) => JSON.stringify(value ?? {});

// Layer 6's "ordering"/"matching" interaction types carry structured payloads
// in interaction_data (see assessmentStudioService.js's Layer 6 prompt schema)
// -- normalize/validate their shape before storing so a malformed model
// response never persists something the scoring logic in
// studentPracticeService.js can't consume. Any other interaction_type's
// interaction_data is opaque and stored as-is (unchanged behavior).
const normalizeInteractionData = (item) => {
  const interactionType = item?.interaction_type || item?.interactionType || null;
  const raw = item?.interaction_data || item?.interactionData || {};

  if (interactionType === "ordering") {
    const sequence = toArray(raw?.sequence)
      .map((value) => String(value ?? "").trim())
      .filter(Boolean);
    return sequence.length ? { sequence } : {};
  }

  if (interactionType === "matching") {
    const pairs = toArray(raw?.pairs)
      .map((pair) => ({
        left: String(pair?.left ?? "").trim(),
        right: String(pair?.right ?? "").trim(),
      }))
      .filter((pair) => pair.left && pair.right);
    return pairs.length ? { pairs } : {};
  }

  return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
};

const toText = (value) =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const getComparisonItems = (comparison = {}) => {
  const explicitItems = comparison?.items_compared || comparison?.itemsCompared;
  if (Array.isArray(explicitItems)) {
    return explicitItems.map(toText).filter(Boolean);
  }

  return [
    comparison?.entity_1,
    comparison?.entity1,
    comparison?.left,
    comparison?.entity_2,
    comparison?.entity2,
    comparison?.right,
  ]
    .map(toText)
    .filter(Boolean);
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const normalizeMemoryDifficulty = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "low") {
    return 0.18;
  }
  if (normalized === "high") {
    return 0.48;
  }
  return 0.32;
};

const calculateEstimatedMemoryStrength = ({ memory = {}, inputContext = {} }) => {
  const assessmentUnit = inputContext.assessment_unit || {};
  const supportingConcepts = toTextArray(
    memory.supporting_concepts ||
      memory.supportingConcepts ||
      assessmentUnit.supporting_concepts ||
      assessmentUnit.supportingConcepts
  );
  const retrievalCues = toTextArray(memory.retrieval_cues || memory.retrievalCues);
  const associatedConcepts = toTextArray(
    memory.associated_concepts || memory.associatedConcepts
  );
  const dependencies = toArray(
    assessmentUnit.dependencies || assessmentUnit.prerequisites
  );
  const misconceptions = toArray(
    inputContext.misconception_profile || inputContext.misconceptions
  );

  const difficultyPenalty = normalizeMemoryDifficulty(
    memory.memory_difficulty || memory.memoryDifficulty
  );
  const conceptDensityPenalty = clamp(
    (supportingConcepts.length + associatedConcepts.length - 5) * 0.025,
    0,
    0.16
  );
  const dependencyPenalty = clamp(dependencies.length * 0.04, 0, 0.16);
  const misconceptionPenalty = clamp(misconceptions.length * 0.035, 0, 0.14);
  const retrievalSupport = clamp(retrievalCues.length * 0.035, 0, 0.18);
  const memoryAssetSupport =
    ["story", "analogy", "visual_hook", "real_world_connection", "memory_trick"].filter(
      (key) => {
        const value =
          memory[key] || memory[key.replace(/_([a-z])/g, (_, char) => char.toUpperCase())];
        return typeof value === "string" && value.trim().length >= 20;
      }
    ).length * 0.025;

  const strength =
    0.74 -
    difficultyPenalty -
    conceptDensityPenalty -
    dependencyPenalty -
    misconceptionPenalty +
    retrievalSupport +
    memoryAssetSupport;

  return Number(clamp(strength, 0.1, 0.98).toFixed(3));
};

const normalizeAssessmentUnits = (parsed) =>
  toArray(parsed?.assessment_units).map((unit, index) => ({
    assessmentUnitId:
      unit?.assessment_unit_id || unit?.assessmentUnitId || unit?.id || `AU-${index + 1}`,
    primaryConcept:
      unit?.primary_concept ||
      unit?.primaryConcept ||
      unit?.concept ||
      `Assessment Unit ${index + 1}`,
    learningObjective:
      unit?.learning_objective || unit?.learningObjective || unit?.mastery_objective || null,
    conceptCategory:
      unit?.concept_category || unit?.conceptCategory || unit?.category || "general",
    curriculumImportance:
      unit?.curriculum_importance || unit?.curriculumImportance || "medium",
    supportingConcepts:
      toTextArray(unit?.supporting_concepts || unit?.supportingConcepts),
    dependencies: toArray(unit?.dependencies || unit?.prerequisites).map((dependency) => ({
      dependsOn:
        dependency?.depends_on_assessment_unit_id ||
        dependency?.assessment_unit_id ||
        dependency?.dependsOnAssessmentUnitId ||
        dependency?.dependsOn ||
        dependency,
      dependencyType:
        dependency?.dependency_type || dependency?.dependencyType || "prerequisite",
    })),
  }));

const insertConcept = async ({
  db,
  generationId,
  sourceSectionId,
  fkMstChapterId,
  assessmentUnitId,
  conceptName,
  conceptFamily,
  description = null,
  aliases = [],
}) => {
  const conceptResult = await db.query(
    `
      INSERT INTO concept (
        generation_id,
        source_section_id,
        fk_mst_chapter_id,
        assessment_unit_id,
        concept_name,
        concept_family,
        description
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `,
    [
      generationId,
      sourceSectionId,
      fkMstChapterId,
      assessmentUnitId || null,
      conceptName,
      conceptFamily,
      description,
    ]
  );

  const conceptId = conceptResult.rows[0].id;
  for (const alias of toTextArray(aliases)) {
    await db.query(
      `
        INSERT INTO concept_alias (generation_id, concept_id, alias_name)
        VALUES ($1, $2, $3)
      `,
      [generationId, conceptId, alias]
    );
  }
};

const retireStaleAssessmentUnits = async ({
  db,
  generationId,
  sourceSectionId,
  activeAssessmentUnitIds,
}) => {
  const staleResult = await db.query(
    `
      SELECT assessment_unit_id
      FROM assessment_unit
      WHERE source_section_id = $1
        AND is_active = TRUE
        AND NOT (assessment_unit_id = ANY($2::varchar[]))
    `,
    [sourceSectionId, activeAssessmentUnitIds]
  );

  const staleIds = staleResult.rows.map((row) => row.assessment_unit_id);
  if (staleIds.length === 0) {
    return;
  }

  await db.query(
    `
      UPDATE assessment_unit
      SET is_active = FALSE,
          generation_id = $2,
          updated_at = NOW()
      WHERE assessment_unit_id = ANY($1::varchar[])
    `,
    [staleIds, generationId]
  );

  await db.query(
    `
      DELETE FROM assessment_unit_supporting_concept
      WHERE assessment_unit_id = ANY($1::varchar[])
    `,
    [staleIds]
  );

  await db.query(
    `
      DELETE FROM assessment_unit_dependency
      WHERE assessment_unit_id = ANY($1::varchar[])
         OR depends_on_assessment_unit_id = ANY($1::varchar[])
    `,
    [staleIds]
  );
};

export const persistLayer1Knowledge = async ({
  db = pool,
  generationId,
  sourceSectionId,
  fkMstChapterId,
  parsed,
}) => {
  await db.query(
    `
      INSERT INTO layer1_knowledge_contract (
        generation_id,
        source_section_id,
        fk_mst_chapter_id,
        context_summary,
        contract_json
      )
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (generation_id) DO UPDATE
      SET context_summary = EXCLUDED.context_summary,
          contract_json = EXCLUDED.contract_json
    `,
    [
      generationId,
      sourceSectionId,
      fkMstChapterId,
      parsed?.context_summary || "",
      asJson(parsed),
    ]
  );

  const assessmentUnits = normalizeAssessmentUnits(parsed);
  const activeAssessmentUnitIds = assessmentUnits.map((unit) => unit.assessmentUnitId);
  await retireStaleAssessmentUnits({
    db,
    generationId,
    sourceSectionId,
    activeAssessmentUnitIds:
      activeAssessmentUnitIds.length > 0 ? activeAssessmentUnitIds : ["__none__"],
  });

  for (const [index, conceptName] of toTextArray(parsed?.core_concepts).entries()) {
    await db.query(
      `
        INSERT INTO layer1_core_concept (generation_id, concept_name, display_order)
        VALUES ($1, $2, $3)
      `,
      [generationId, conceptName, index]
    );

    await insertConcept({
      db,
      generationId,
      sourceSectionId,
      fkMstChapterId,
      conceptName,
      conceptFamily: "core_concept",
    });
  }

  for (const structure of toArray(parsed?.structures)) {
    const structureName = structure?.name || structure?.structure_name || structure?.title;
    if (!structureName) {
      continue;
    }

    const structureResult = await db.query(
      `
        INSERT INTO layer1_structure (
          generation_id,
          name,
          type,
          location,
          description
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `,
      [
        generationId,
        structureName,
        structure?.type || null,
        structure?.location || null,
        structure?.description || null,
      ]
    );

    await insertConcept({
      db,
      generationId,
      sourceSectionId,
      fkMstChapterId,
      conceptName: structureName,
      conceptFamily: "structure",
      description: structure?.description || null,
      aliases: structure?.aliases,
    });

    for (const [index, part] of toTextArray(
      structure?.important_parts || structure?.parts || structure?.labels
    ).entries()) {
      await db.query(
        `
          INSERT INTO layer1_structure_part (
            generation_id,
            layer1_structure_id,
            important_part,
            display_order
          )
          VALUES ($1, $2, $3, $4)
        `,
        [generationId, structureResult.rows[0].id, part, index]
      );
    }
  }

  for (const fn of toArray(parsed?.functions)) {
    const functionText = fn?.function || fn?.function_text || fn?.name || fn?.description;
    if (!functionText) {
      continue;
    }

    await db.query(
      `
        INSERT INTO layer1_function (
          generation_id,
          structure_name,
          function_text,
          importance,
          related_process
        )
        VALUES ($1, $2, $3, $4, $5)
      `,
      [
        generationId,
        fn?.structure_name || fn?.structure || null,
        functionText,
        fn?.importance || null,
        fn?.related_process || fn?.relatedProcess || null,
      ]
    );
  }

  for (const process of toArray(parsed?.processes)) {
    const processName = process?.name || process?.process_name || process?.title;
    if (!processName) {
      continue;
    }

    const processResult = await db.query(
      `
        INSERT INTO layer1_process (
          generation_id,
          name,
          purpose,
          location
        )
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `,
      [
        generationId,
        processName,
        process?.purpose || process?.summary || null,
        process?.location || null,
      ]
    );

    await insertConcept({
      db,
      generationId,
      sourceSectionId,
      fkMstChapterId,
      conceptName: processName,
      conceptFamily: "process",
      description: process?.purpose || null,
      aliases: process?.aliases,
    });

    for (const [index, inputValue] of toTextArray(
      process?.inputs || process?.input || process?.requirements
    ).entries()) {
      await db.query(
        `
          INSERT INTO layer1_process_input (
            generation_id,
            layer1_process_id,
            input_value,
            display_order
          )
          VALUES ($1, $2, $3, $4)
        `,
        [generationId, processResult.rows[0].id, inputValue, index]
      );
    }

    for (const [index, outputValue] of toTextArray(
      process?.outputs || process?.output || process?.products
    ).entries()) {
      await db.query(
        `
          INSERT INTO layer1_process_output (
            generation_id,
            layer1_process_id,
            output_value,
            display_order
          )
          VALUES ($1, $2, $3, $4)
        `,
        [generationId, processResult.rows[0].id, outputValue, index]
      );
    }

    for (const [index, step] of toTextArray(
      process?.steps || process?.step_sequence || process?.sequence
    ).entries()) {
      await db.query(
        `
          INSERT INTO layer1_process_step (
            generation_id,
            layer1_process_id,
            step_text,
            display_order
          )
          VALUES ($1, $2, $3, $4)
        `,
        [generationId, processResult.rows[0].id, step, index]
      );
    }
  }

  for (const sequence of toArray(parsed?.stages_sequences)) {
    const sequenceName = sequence?.name || sequence?.sequence_name || sequence?.title;
    if (!sequenceName) {
      continue;
    }

    const sequenceResult = await db.query(
      `
        INSERT INTO layer1_stage_sequence (
          generation_id,
          name,
          sequence_type,
          important_notes
        )
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `,
      [
        generationId,
        sequenceName,
        sequence?.sequence_type || sequence?.type || null,
        sequence?.important_notes || sequence?.notes || null,
      ]
    );

    for (const [index, stageName] of toTextArray(
      sequence?.stages || sequence?.stage_names || sequence?.items
    ).entries()) {
      await db.query(
        `
          INSERT INTO layer1_stage_sequence_stage (
            generation_id,
            layer1_stage_sequence_id,
            stage_name,
            display_order
          )
          VALUES ($1, $2, $3, $4)
        `,
        [generationId, sequenceResult.rows[0].id, stageName, index]
      );
    }
  }

  for (const item of toArray(parsed?.cause_effect)) {
    const cause = item?.cause || item?.trigger;
    const effect = item?.effect || item?.outcome;
    if (!cause || !effect) {
      continue;
    }

    await db.query(
      `
        INSERT INTO layer1_cause_effect (
          generation_id,
          cause,
          effect,
          biological_reason
        )
        VALUES ($1, $2, $3, $4)
      `,
      [generationId, cause, effect, item?.biological_reason || item?.reason || null]
    );
  }

  for (const comparison of toArray(parsed?.comparisons)) {
    const comparisonItems = getComparisonItems(comparison);
    const entity1 = comparisonItems[0];
    const entity2 = comparisonItems.slice(1).join(", ");
    if (!entity1 || !entity2) {
      continue;
    }

    const comparisonResult = await db.query(
      `
        INSERT INTO layer1_comparison (
          generation_id,
          entity_1,
          entity_2
        )
        VALUES ($1, $2, $3)
        RETURNING id
      `,
      [generationId, entity1, entity2]
    );

    for (const [index, difference] of toTextList(
      comparison?.differences ||
        comparison?.difference_points ||
        comparison?.key_difference ||
        comparison?.keyDifference
    ).entries()) {
      await db.query(
        `
          INSERT INTO layer1_comparison_difference (
            generation_id,
            layer1_comparison_id,
            difference_text,
            display_order
          )
          VALUES ($1, $2, $3, $4)
        `,
        [generationId, comparisonResult.rows[0].id, difference, index]
      );
    }

    for (const [index, similarity] of toTextArray(
      comparison?.similarities || comparison?.similar_points
    ).entries()) {
      await db.query(
        `
          INSERT INTO layer1_comparison_similarity (
            generation_id,
            layer1_comparison_id,
            similarity_text,
            display_order
          )
          VALUES ($1, $2, $3, $4)
        `,
        [generationId, comparisonResult.rows[0].id, similarity, index]
      );
    }
  }

  for (const relationship of toArray(parsed?.relationships)) {
    const relationshipName = relationship?.relationship_name || relationship?.name;
    const relatedConcepts = toTextArray(
      relationship?.related_concepts || relationship?.relatedConcepts
    );
    const relationshipType =
      relationship?.relationship_type || relationship?.relationshipType || null;
    const relationshipSummary =
      relationship?.relationship_summary || relationship?.summary || null;
    if (!relationshipName || relatedConcepts.length < 2 || !relationshipSummary) {
      continue;
    }

    await db.query(
      `
        INSERT INTO layer1_relationship (
          generation_id,
          relationship_name,
          relationship_type,
          related_concepts,
          relationship_summary
        )
        VALUES ($1, $2, $3, $4, $5)
      `,
      [
        generationId,
        relationshipName,
        relationshipType,
        relatedConcepts,
        relationshipSummary,
      ]
    );

    await insertConcept({
      db,
      generationId,
      sourceSectionId,
      fkMstChapterId,
      conceptName: relationshipName,
      conceptFamily: "relationship",
      description: relationshipSummary,
      aliases: relatedConcepts,
    });
  }

  for (const classification of toArray(parsed?.classifications)) {
    const category = classification?.category || classification?.name || classification?.title;
    if (!category) {
      continue;
    }

    const classificationResult = await db.query(
      `
        INSERT INTO layer1_classification (
          generation_id,
          category,
          classification_basis
        )
        VALUES ($1, $2, $3)
        RETURNING id
      `,
      [
        generationId,
        category,
        classification?.classification_basis || classification?.basis || null,
      ]
    );

    for (const [index, groupName] of toTextArray(
      classification?.groups || classification?.members || classification?.types
    ).entries()) {
      await db.query(
        `
          INSERT INTO layer1_classification_group (
            generation_id,
            layer1_classification_id,
            group_name,
            display_order
          )
          VALUES ($1, $2, $3, $4)
        `,
        [generationId, classificationResult.rows[0].id, groupName, index]
      );
    }
  }

  for (const diagram of toArray(parsed?.diagrams)) {
    const diagramName = diagram?.diagram_name || diagram?.name || diagram?.title;
    if (!diagramName) {
      continue;
    }

    const diagramResult = await db.query(
      `
        INSERT INTO layer1_diagram (
          generation_id,
          diagram_name,
          purpose
        )
        VALUES ($1, $2, $3)
        RETURNING id
      `,
      [generationId, diagramName, diagram?.purpose || null]
    );

    for (const [index, labelName] of toTextArray(
      diagram?.labels || diagram?.parts || diagram?.annotations
    ).entries()) {
      await db.query(
        `
          INSERT INTO layer1_diagram_label (
            generation_id,
            layer1_diagram_id,
            label_name,
            display_order
          )
          VALUES ($1, $2, $3, $4)
        `,
        [generationId, diagramResult.rows[0].id, labelName, index]
      );
    }

    for (const [index, labelName] of toTextArray(
      diagram?.tested_labels || diagram?.exam_labels || diagram?.frequently_tested_labels
    ).entries()) {
      await db.query(
        `
          INSERT INTO layer1_diagram_tested_label (
            generation_id,
            layer1_diagram_id,
            label_name,
            display_order
          )
          VALUES ($1, $2, $3, $4)
        `,
        [generationId, diagramResult.rows[0].id, labelName, index]
      );
    }
  }

  for (const term of toArray(parsed?.terminology)) {
    const termName = term?.term || term?.name || term?.label;
    if (!termName) {
      continue;
    }

    const termResult = await db.query(
      `
        INSERT INTO layer1_terminology (
          generation_id,
          term,
          definition
        )
        VALUES ($1, $2, $3)
        RETURNING id
      `,
      [generationId, termName, term?.definition || null]
    );

    await insertConcept({
      db,
      generationId,
      sourceSectionId,
      fkMstChapterId,
      conceptName: termName,
      conceptFamily: "terminology",
      description: term?.definition || null,
      aliases: term?.aliases,
    });

    for (const [index, relatedConcept] of toTextArray(
      term?.related_concepts || term?.relatedConcepts
    ).entries()) {
      await db.query(
        `
          INSERT INTO layer1_terminology_related_concept (
            generation_id,
            layer1_terminology_id,
            related_concept,
            display_order
          )
          VALUES ($1, $2, $3, $4)
        `,
        [generationId, termResult.rows[0].id, relatedConcept, index]
      );
    }
  }

  for (const item of toArray(parsed?.exceptions)) {
    const topic = item?.topic || item?.rule || item?.name;
    const exceptionText = item?.exception_text || item?.exception || item?.text;
    if (!topic || !exceptionText) {
      continue;
    }

    await db.query(
      `
        INSERT INTO layer1_exception (
          generation_id,
          topic,
          exception_text,
          reason
        )
        VALUES ($1, $2, $3, $4)
      `,
      [generationId, topic, exceptionText, item?.reason || null]
    );
  }

  for (const misconception of toArray(parsed?.common_misconceptions)) {
    const misconceptionText = misconception?.misconception || misconception?.text;
    if (!misconceptionText) {
      continue;
    }

    await db.query(
      `
        INSERT INTO layer1_common_misconception (
          generation_id,
          concept,
          misconception,
          reason_for_confusion,
          correction
        )
        VALUES ($1, $2, $3, $4, $5)
      `,
      [
        generationId,
        misconception?.concept || null,
        misconceptionText,
        misconception?.reason_for_confusion || misconception?.reasonForConfusion || null,
        misconception?.correction || null,
      ]
    );
  }

  for (const hook of toArray(parsed?.memory_hooks)) {
    const isStringHook = typeof hook === "string";
    const memoryHook = isStringHook ? hook : hook?.memory_hook || hook?.memoryHook || hook?.hook;
    const concept = isStringHook
      ? hook.split(/\s+needs?\s+memory\s+support\s+because\s+/i)[0]?.trim() || "memory support"
      : hook?.concept || hook?.linked_concept || hook?.linkedConcept;
    if (!concept || !memoryHook) {
      continue;
    }

    await db.query(
      `
        INSERT INTO layer1_memory_hook (
          generation_id,
          concept,
          memory_type,
          memory_hook,
          why_it_helps
        )
        VALUES ($1, $2, $3, $4, $5)
      `,
      [
        generationId,
        concept,
        isStringHook ? "support_candidate" : hook?.memory_type || hook?.memoryType || null,
        memoryHook,
        isStringHook
          ? hook.split(/\s+because\s+/i).slice(1).join(" because ") || null
          : hook?.why_it_helps || hook?.whyItHelps || null,
      ]
    );
  }

  for (const [index, pattern] of toArray(parsed?.question_patterns).entries()) {
    const patternName =
      (typeof pattern === "string" ? pattern : null) ||
      pattern?.pattern_name ||
      pattern?.name ||
      pattern?.question_family;
    if (!patternName) {
      continue;
    }

    await db.query(
      `
        INSERT INTO layer1_question_pattern (
          generation_id,
          pattern_name,
          display_order
        )
        VALUES ($1, $2, $3)
      `,
      [generationId, patternName, index]
    );
  }

  for (const unit of assessmentUnits) {
    await db.query(
      `
        INSERT INTO layer1_assessment_unit (
          generation_id,
          assessment_unit_id,
          primary_concept,
          learning_objective,
          concept_category,
          curriculum_importance
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (generation_id, assessment_unit_id) DO UPDATE
        SET primary_concept = EXCLUDED.primary_concept,
            learning_objective = EXCLUDED.learning_objective,
            concept_category = EXCLUDED.concept_category,
            curriculum_importance = EXCLUDED.curriculum_importance
      `,
      [
        generationId,
        unit.assessmentUnitId,
        unit.primaryConcept,
        unit.learningObjective,
        unit.conceptCategory,
        unit.curriculumImportance,
      ]
    );

    await db.query(
      `
        INSERT INTO assessment_unit (
          generation_id,
          assessment_unit_id,
          source_section_id,
          fk_mst_chapter_id,
          primary_concept,
          learning_objective,
          concept_category,
          curriculum_importance,
          is_active,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, NOW())
        ON CONFLICT (assessment_unit_id) DO UPDATE
        SET generation_id = EXCLUDED.generation_id,
            source_section_id = EXCLUDED.source_section_id,
            fk_mst_chapter_id = EXCLUDED.fk_mst_chapter_id,
            primary_concept = EXCLUDED.primary_concept,
            learning_objective = EXCLUDED.learning_objective,
            concept_category = EXCLUDED.concept_category,
            curriculum_importance = EXCLUDED.curriculum_importance,
            is_active = TRUE,
            updated_at = NOW()
      `,
      [
        generationId,
        unit.assessmentUnitId,
        sourceSectionId,
        fkMstChapterId,
        unit.primaryConcept,
        unit.learningObjective,
        unit.conceptCategory,
        unit.curriculumImportance,
      ]
    );

    await db.query(
      `
        DELETE FROM assessment_unit_supporting_concept
        WHERE assessment_unit_id = $1
      `,
      [unit.assessmentUnitId]
    );

    await db.query(
      `
        DELETE FROM assessment_unit_dependency
        WHERE assessment_unit_id = $1
      `,
      [unit.assessmentUnitId]
    );

    await insertConcept({
      db,
      generationId,
      sourceSectionId,
      fkMstChapterId,
      assessmentUnitId: unit.assessmentUnitId,
      conceptName: unit.primaryConcept,
      conceptFamily: "assessment_unit",
      description: unit.conceptCategory,
      aliases: unit.supportingConcepts,
    });
  }

  for (const unit of assessmentUnits) {
    for (const [index, supportingConcept] of unit.supportingConcepts.entries()) {
      await db.query(
        `
          INSERT INTO assessment_unit_supporting_concept (
            generation_id,
            assessment_unit_id,
            supporting_concept,
            display_order
          )
          VALUES ($1, $2, $3, $4)
        `,
        [generationId, unit.assessmentUnitId, supportingConcept, index]
      );
    }
  }

  for (const unit of assessmentUnits) {
    for (const dependency of unit.dependencies.filter((item) => item.dependsOn)) {
      await db.query(
        `
          INSERT INTO assessment_unit_dependency (
            generation_id,
            assessment_unit_id,
            depends_on_assessment_unit_id,
            dependency_type
          )
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (assessment_unit_id, depends_on_assessment_unit_id, dependency_type) DO NOTHING
        `,
        [
          generationId,
          unit.assessmentUnitId,
          dependency.dependsOn,
          dependency.dependencyType,
        ]
      );
    }
  }
};

export const persistLayer2ConceptMemory = async ({
  db = pool,
  generationId,
  assessmentUnitId,
  parsed,
  inputContext,
}) => {
  const memory =
    parsed?.concept_memory ||
    toArray(parsed?.concept_memories).find((item) => item?.assessment_unit_id === assessmentUnitId) ||
    toArray(parsed?.concept_memories)[0];

  if (!memory) {
    await db.query(
      `
        INSERT INTO layer2_concept_memory_contract (generation_id, contract_json)
        VALUES ($1, $2)
        ON CONFLICT (generation_id) DO UPDATE
        SET contract_json = EXCLUDED.contract_json
      `,
      [generationId, asJson(parsed)]
    );
    return;
  }

  const estimatedMemoryStrength = calculateEstimatedMemoryStrength({
    memory,
    inputContext,
  });

  memory.estimated_memory_strength = estimatedMemoryStrength;
  memory.estimatedMemoryStrength = estimatedMemoryStrength;

  await db.query(
    `
      INSERT INTO layer2_concept_memory_contract (generation_id, contract_json)
      VALUES ($1, $2)
      ON CONFLICT (generation_id) DO UPDATE
      SET contract_json = EXCLUDED.contract_json
    `,
    [generationId, asJson(parsed)]
  );

  const insertResult = await db.query(
    `
      INSERT INTO layer2_concept_memory (
        generation_id,
        assessment_unit_id,
        primary_concept,
        canonical_json,
        story,
        analogy,
        visual_hook,
        real_world_connection,
        memory_trick,
        curiosity_hook,
        micro_activity,
        misconception_alert,
        memory_difficulty,
        estimated_memory_strength
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (generation_id, assessment_unit_id) DO UPDATE
      SET primary_concept = EXCLUDED.primary_concept,
          canonical_json = EXCLUDED.canonical_json,
          story = EXCLUDED.story,
          analogy = EXCLUDED.analogy,
          visual_hook = EXCLUDED.visual_hook,
          real_world_connection = EXCLUDED.real_world_connection,
          memory_trick = EXCLUDED.memory_trick,
          curiosity_hook = EXCLUDED.curiosity_hook,
          micro_activity = EXCLUDED.micro_activity,
          misconception_alert = EXCLUDED.misconception_alert,
          memory_difficulty = EXCLUDED.memory_difficulty,
          estimated_memory_strength = EXCLUDED.estimated_memory_strength
      RETURNING id
    `,
    [
      generationId,
      assessmentUnitId,
      memory?.concept_label || memory?.primary_concept || memory?.primaryConcept || "",
      asJson(memory),
      memory?.story || null,
      memory?.analogy || null,
      memory?.visual_hook || memory?.visualHook || null,
      memory?.real_world_connection || memory?.realWorldConnection || null,
      memory?.memory_trick || memory?.memoryTrick || null,
      memory?.curiosity_hook || memory?.curiosityHook || null,
      memory?.micro_activity || memory?.microActivity || null,
      memory?.misconception_alert || memory?.misconceptionAlert || null,
      memory?.memory_difficulty || memory?.memoryDifficulty || null,
      estimatedMemoryStrength,
    ]
  );

  const layer2Id = insertResult.rows[0].id;

  for (const [index, supportingConcept] of toTextArray(
    memory?.supporting_concepts || memory?.supportingConcepts
  ).entries()) {
    await db.query(
      `
        INSERT INTO layer2_concept_memory_supporting_concept (
          generation_id,
          layer2_concept_memory_id,
          supporting_concept,
          display_order
        )
        VALUES ($1, $2, $3, $4)
      `,
      [generationId, layer2Id, supportingConcept, index]
    );
  }

  for (const [index, retrievalCue] of toTextArray(
    memory?.retrieval_cues || memory?.retrievalCues
  ).entries()) {
    await db.query(
      `
        INSERT INTO layer2_concept_memory_retrieval_cue (
          generation_id,
          layer2_concept_memory_id,
          retrieval_cue,
          display_order
        )
        VALUES ($1, $2, $3, $4)
      `,
      [generationId, layer2Id, retrievalCue, index]
    );
  }

  for (const [index, associatedConcept] of toTextArray(
    memory?.associated_concepts || memory?.associatedConcepts
  ).entries()) {
    await db.query(
      `
        INSERT INTO layer2_concept_memory_associated_concept (
          generation_id,
          layer2_concept_memory_id,
          associated_concept,
          display_order
        )
        VALUES ($1, $2, $3, $4)
      `,
      [generationId, layer2Id, associatedConcept, index]
    );
  }
};

export const persistLayer3Capability = async ({
  db = pool,
  generationId,
  assessmentUnitId,
  parsed,
}) => {
  await db.query(
    `
      INSERT INTO layer3_assessment_capability_contract (generation_id, assessment_unit_id, output_json)
      VALUES ($1, $2, $3)
      ON CONFLICT (generation_id) DO UPDATE
      SET assessment_unit_id = EXCLUDED.assessment_unit_id,
          output_json = EXCLUDED.output_json
    `,
    [generationId, assessmentUnitId, asJson(parsed)]
  );
};

export const persistLayer4Strategy = async ({
  db = pool,
  generationId,
  assessmentUnitId,
  parsed,
}) => {
  await db.query(
    `
      INSERT INTO layer4_assessment_strategy_contract (generation_id, assessment_unit_id, output_json)
      VALUES ($1, $2, $3)
      ON CONFLICT (generation_id) DO UPDATE
      SET assessment_unit_id = EXCLUDED.assessment_unit_id,
          output_json = EXCLUDED.output_json
    `,
    [generationId, assessmentUnitId, asJson(parsed)]
  );
};

export const persistLayer5Blueprint = async ({
  db = pool,
  generationId,
  assessmentUnitId,
  parsed,
}) => {
  const blueprint =
    parsed?.blueprint ||
    toArray(parsed?.blueprints)[0] ||
    null;

  await db.query(
    `
      INSERT INTO layer5_item_blueprint_contract (generation_id, assessment_unit_id, blueprint_id, output_json)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (generation_id) DO UPDATE
      SET assessment_unit_id = EXCLUDED.assessment_unit_id,
          blueprint_id = EXCLUDED.blueprint_id,
          output_json = EXCLUDED.output_json
    `,
    [
      generationId,
      assessmentUnitId,
      blueprint?.blueprint_id || blueprint?.blueprintId || null,
      asJson(parsed),
    ]
  );

  if (!blueprint) {
    return;
  }

  const blueprintId =
    blueprint?.blueprint_id || blueprint?.blueprintId || `${assessmentUnitId}-BP-1`;

  await db.query(
    `
      INSERT INTO layer5_item_blueprint (
        generation_id,
        blueprint_id,
        assessment_unit_id,
        question_family,
        interaction_type,
        expected_answer_type,
        blooms_level,
        difficulty,
        marks,
        estimated_time_seconds,
        common_misconception,
        success_criteria,
        memory_support,
        generator_constraints
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14
      )
      ON CONFLICT (blueprint_id) DO UPDATE
      SET generation_id = EXCLUDED.generation_id,
          assessment_unit_id = EXCLUDED.assessment_unit_id,
          question_family = EXCLUDED.question_family,
          interaction_type = EXCLUDED.interaction_type,
          expected_answer_type = EXCLUDED.expected_answer_type,
          blooms_level = EXCLUDED.blooms_level,
          difficulty = EXCLUDED.difficulty,
          marks = EXCLUDED.marks,
          estimated_time_seconds = EXCLUDED.estimated_time_seconds,
          common_misconception = EXCLUDED.common_misconception,
          success_criteria = EXCLUDED.success_criteria,
          memory_support = EXCLUDED.memory_support,
          generator_constraints = EXCLUDED.generator_constraints
    `,
    [
      generationId,
      blueprintId,
      assessmentUnitId,
      blueprint?.question_family || blueprint?.questionFamily || null,
      blueprint?.interaction_type || blueprint?.interactionType || null,
      blueprint?.expected_answer_type || blueprint?.expectedAnswerType || null,
      blueprint?.blooms_level || blueprint?.bloomsLevel || null,
      blueprint?.difficulty || null,
      Number(blueprint?.marks || 0),
      Number(blueprint?.estimated_time_seconds || blueprint?.estimatedTimeSeconds || 0),
      blueprint?.common_misconception || blueprint?.commonMisconception || null,
      blueprint?.success_criteria || blueprint?.successCriteria || null,
      asJson(blueprint?.memory_support || blueprint?.memorySupport || {}),
      asJson(blueprint?.generator_constraints || blueprint?.generatorConstraints || {}),
    ]
  );
};

export const persistLayer6Items = async ({
  db = pool,
  generationId,
  assessmentUnitId,
  parsed,
}) => {
  await db.query(
    `
      INSERT INTO layer6_assessment_item_contract (generation_id, contract_json)
      VALUES ($1, $2)
      ON CONFLICT (generation_id) DO UPDATE
      SET contract_json = EXCLUDED.contract_json
    `,
    [generationId, asJson(parsed)]
  );

  for (const [index, item] of toArray(parsed?.assessment_items).entries()) {
    const itemId = item?.item_id || item?.itemId || `${assessmentUnitId}-ITEM-${index + 1}`;
    const itemResult = await db.query(
      `
        INSERT INTO layer6_assessment_item (
          generation_id,
          item_id,
          blueprint_id,
          assessment_unit_id,
          question_family,
          interaction_type,
          difficulty,
          blooms_level,
          assessment_dimension,
          learning_objective,
          question,
          correct_answer,
          interaction_data,
          diagram_instruction,
          marks,
          estimated_time_seconds
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        ON CONFLICT (item_id) DO UPDATE
        SET generation_id = EXCLUDED.generation_id,
            blueprint_id = EXCLUDED.blueprint_id,
            assessment_unit_id = EXCLUDED.assessment_unit_id,
            question_family = EXCLUDED.question_family,
            interaction_type = EXCLUDED.interaction_type,
            difficulty = EXCLUDED.difficulty,
            blooms_level = EXCLUDED.blooms_level,
            assessment_dimension = EXCLUDED.assessment_dimension,
            learning_objective = EXCLUDED.learning_objective,
            question = EXCLUDED.question,
            correct_answer = EXCLUDED.correct_answer,
            interaction_data = EXCLUDED.interaction_data,
            diagram_instruction = EXCLUDED.diagram_instruction,
            marks = EXCLUDED.marks,
            estimated_time_seconds = EXCLUDED.estimated_time_seconds
        RETURNING id
      `,
      [
        generationId,
        itemId,
        item?.blueprint_id || item?.blueprintId || null,
        assessmentUnitId,
        item?.question_family || item?.questionFamily || null,
        item?.interaction_type || item?.interactionType || null,
        item?.difficulty || null,
        item?.blooms_level || item?.bloomsLevel || null,
        item?.assessment_dimension || item?.assessmentDimension || null,
        item?.learning_objective || item?.learningObjective || null,
        resolveItemQuestionText(item),
        resolveItemCorrectAnswerText(item),
        asJson(normalizeInteractionData(item)),
        item?.diagram_instruction || item?.diagramInstruction || null,
        Number(item?.marks || 0),
        Number(item?.estimated_time_seconds || item?.estimatedTimeSeconds || 0),
      ]
    );

    const layer6ItemId = itemResult.rows[0].id;

    // Some generations repeat the correct answer as a second, redundant
    // option (e.g. options: ["Dog", "Cat", "Rat", "Dog"]) -- an MCQ must never
    // show the same choice twice, so dedupe by normalized text before storing,
    // keeping the first occurrence's position.
    const seenOptionTexts = new Set();
    const optionTexts = toArray(item?.options)
      .map(extractOptionText)
      .filter(Boolean)
      .filter((optionText) => {
        const normalized = optionText.trim().toLowerCase();
        if (seenOptionTexts.has(normalized)) {
          return false;
        }
        seenOptionTexts.add(normalized);
        return true;
      });

    await db.query("DELETE FROM layer6_assessment_item_option WHERE layer6_assessment_item_id = $1", [
      layer6ItemId,
    ]);

    for (const [optionIndex, optionText] of optionTexts.entries()) {
      await db.query(
        `
          INSERT INTO layer6_assessment_item_option (
            generation_id,
            layer6_assessment_item_id,
            option_text,
            display_order
          )
          VALUES ($1, $2, $3, $4)
        `,
        [generationId, layer6ItemId, optionText, optionIndex]
      );
    }

    await db.query(
      "DELETE FROM layer6_assessment_item_acceptable_answer WHERE layer6_assessment_item_id = $1",
      [layer6ItemId]
    );

    for (const [answerIndex, answerText] of toTextArray(
      item?.acceptable_answers || item?.acceptableAnswers
    ).entries()) {
      await db.query(
        `
          INSERT INTO layer6_assessment_item_acceptable_answer (
            generation_id,
            layer6_assessment_item_id,
            answer_text,
            display_order
          )
          VALUES ($1, $2, $3, $4)
        `,
        [generationId, layer6ItemId, answerText, answerIndex]
      );
    }
  }
};

export const persistLayer7Support = async ({
  db = pool,
  generationId,
  assessmentUnitId,
  parsed,
}) => {
  await db.query(
    `
      INSERT INTO layer7_learning_support_contract (generation_id, assessment_unit_id, contract_json)
      VALUES ($1, $2, $3)
      ON CONFLICT (generation_id) DO UPDATE
      SET assessment_unit_id = EXCLUDED.assessment_unit_id,
          contract_json = EXCLUDED.contract_json
    `,
    [generationId, assessmentUnitId, asJson(parsed)]
  );

  const support = parsed?.learning_support || {};
  const supportResult = await db.query(
    `
      INSERT INTO layer7_learning_support (
        generation_id,
        assessment_unit_id,
        concept_explanation,
        correct_answer_reasoning,
        real_world_insight,
        mastery_recommendation
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `,
    [
      generationId,
      assessmentUnitId,
      support?.concept_explanation || support?.conceptExplanation || null,
      support?.correct_answer_reasoning || support?.correctAnswerReasoning || null,
      support?.real_world_insight || support?.realWorldInsight || null,
      support?.mastery_recommendation || support?.masteryRecommendation || null,
    ]
  );

  const supportId = supportResult.rows[0].id;

  for (const [index, distractor] of toArray(
    support?.distractor_analysis || support?.distractorAnalysis
  ).entries()) {
    await db.query(
      `
        INSERT INTO layer7_distractor_analysis (
          generation_id,
          layer7_learning_support_id,
          option_text,
          reason_selected,
          why_incorrect,
          display_order
        )
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [
        generationId,
        supportId,
        distractor?.option || distractor?.option_text || null,
        distractor?.reason_selected || distractor?.reasonSelected || null,
        distractor?.why_incorrect || distractor?.whyIncorrect || null,
        index,
      ]
    );
  }

  for (const [index, hint] of toTextArray(
    support?.progressive_hints || support?.progressiveHints
  ).entries()) {
    await db.query(
      `
        INSERT INTO layer7_progressive_hint (
          generation_id,
          layer7_learning_support_id,
          hint_text,
          display_order
        )
        VALUES ($1, $2, $3, $4)
      `,
      [generationId, supportId, hint, index]
    );
  }

  const misconceptionFeedback = support?.misconception_feedback || support?.misconceptionFeedback;
  if (misconceptionFeedback) {
    await db.query(
      `
        INSERT INTO layer7_misconception_feedback (
          generation_id,
          layer7_learning_support_id,
          misconception,
          reason,
          correction
        )
        VALUES ($1, $2, $3, $4, $5)
      `,
      [
        generationId,
        supportId,
        misconceptionFeedback?.misconception || null,
        misconceptionFeedback?.reason || null,
        misconceptionFeedback?.correction || null,
      ]
    );
  }

  for (const [index, remediation] of toTextArray(
    support?.adaptive_remediation || support?.adaptiveRemediation
  ).entries()) {
    await db.query(
      `
        INSERT INTO layer7_adaptive_remediation (
          generation_id,
          layer7_learning_support_id,
          remediation_text,
          display_order
        )
        VALUES ($1, $2, $3, $4)
      `,
      [generationId, supportId, remediation, index]
    );
  }
};
