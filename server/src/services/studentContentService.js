import { pool } from "../db/pool.js";
import { resolveDashboardAcademicFilters } from "./catalogService.js";
import {
  getAssessmentUnitsForSourceSection,
  getDiagramsForSection,
  getLayer1Context,
  getLayer2Memory,
  getSectionKnowledgeSummary,
  getTerminologyForSection,
} from "./assessmentStudioContextAssembler.js";
import { getMemoryHookMedia } from "./memoryHookImageService.js";
import * as conceptCardCache from "./conceptCardCache.js";

const MASTERY_COMPLETE_THRESHOLD = 0.8;

// Student-facing read-only content service. Every function here reads
// already-generated pipeline content (layer1/layer2 tables, via the shared
// getters in assessmentStudioContextAssembler.js) and reshapes it into clean,
// camelCase student-facing payloads. Nothing here writes anything, and every
// function returns null/empty (never fabricated content) when a section or
// assessment unit hasn't been generated yet.

// source_section.fk_mst_chapter_id is set imprecisely by the pipeline (it can
// point at a sibling section's mst_chapter row), so the reliable join key is
// section_code, which the pipeline always builds as
// "${bookId}:${chapterNumber}:${sectionNumber}" (assessmentStudioService.js
// buildSourceRecords). Resolving through it instead of fk_mst_chapter_id is
// what actually distinguishes e.g. section 7.1 from 7.2.1 under the same book
// + chapter.
const resolveMostRecentSourceSectionId = async ({ bookId, chapterNumber, sectionNumber }) => {
  const sectionCode = `${bookId}:${chapterNumber}:${sectionNumber}`;
  const result = await pool.query(
    `
      SELECT id
      FROM source_section
      WHERE section_code = $1
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `,
    [sectionCode]
  );

  return result.rows[0]?.id || null;
};

const getMasteryByAssessmentUnitId = async ({ userId, assessmentUnitIds }) => {
  if (!userId || !assessmentUnitIds.length) {
    return new Map();
  }

  const result = await pool.query(
    `
      SELECT assessment_unit_id, mastery_probability
      FROM student_mastery
      WHERE user_id = $1 AND assessment_unit_id = ANY($2)
    `,
    [userId, assessmentUnitIds]
  );

  return new Map(
    result.rows.map((row) => [row.assessment_unit_id, Number(row.mastery_probability || 0)])
  );
};

// Same "has the student ever attempted this" signal Today's Goal uses
// (studentDashboardService.js's latest_responses CTE) so a concept's status
// here is computed the same way everywhere in the app: completed (mastery
// over threshold), in progress (attempted but not yet mastered), or not
// started (never attempted).
const getLastActivityByAssessmentUnitId = async ({ userId, assessmentUnitIds }) => {
  if (!userId || !assessmentUnitIds.length) {
    return new Map();
  }

  const result = await pool.query(
    `
      SELECT sr.assessment_unit_id, MAX(sr.created_at) AS last_response_at
      FROM student_response AS sr
      JOIN student_attempt AS sa
        ON sa.id = sr.student_attempt_id
      WHERE sa.user_id = $1 AND sr.assessment_unit_id = ANY($2)
      GROUP BY sr.assessment_unit_id
    `,
    [userId, assessmentUnitIds]
  );

  return new Map(result.rows.map((row) => [row.assessment_unit_id, row.last_response_at]));
};

const listAssessmentUnitsWithMeta = async (sourceSectionId) => {
  const result = await pool.query(
    `
      SELECT assessment_unit_id, primary_concept, curriculum_importance
      FROM assessment_unit
      WHERE source_section_id = $1 AND is_active = TRUE
      ORDER BY id ASC
    `,
    [sourceSectionId]
  );

  return result.rows.map((row) => ({
    assessmentUnitId: row.assessment_unit_id,
    primaryConcept: row.primary_concept,
    curriculumImportance: row.curriculum_importance,
  }));
};

// Returns every curriculum section for a chapter (chapterNumber, resolved from
// the student's board/class/subject) alongside whichever pipeline-generated
// source_section (if any) backs it, plus mastery-based progress. Sections with
// no generated content yet come back with sourceSectionId: null and an empty
// concept list so the client can render an honest "not generated yet" state.
export const listSectionsForChapter = async ({
  board,
  studentClass,
  subject,
  chapterNumber,
  userId,
}) => {
  const { examGoalCode, levelCode, subjectCode, isValid } = resolveDashboardAcademicFilters({
    board,
    studentClass,
    subject,
  });

  if (!isValid || !chapterNumber) {
    return { chapterNumber: chapterNumber || null, chapterName: null, sections: [] };
  }

  const chapterResult = await pool.query(
    `
      SELECT DISTINCT ON (section_number)
        chapter_id AS "chapterId",
        book_id AS "bookId",
        chapter_name AS "chapterName",
        section_number AS "sectionNumber",
        topic_name AS "topicName",
        chapter_display_order AS "displayOrder"
      FROM mv_chapter_catalog
      WHERE exam_goal_code = $1
        AND level_code = $2
        AND subject_code = $3
        AND chapter_number = $4
        AND book_is_active = TRUE
        AND chapter_is_active = TRUE
      ORDER BY section_number, chapter_display_order ASC
    `,
    [examGoalCode, levelCode, subjectCode, chapterNumber]
  );

  if (!chapterResult.rows.length) {
    return { chapterNumber, chapterName: null, sections: [] };
  }

  const sections = await Promise.all(
    chapterResult.rows
      .sort((a, b) => a.displayOrder - b.displayOrder || a.sectionNumber.localeCompare(b.sectionNumber))
      .map(async (row) => {
        const sourceSectionId = await resolveMostRecentSourceSectionId({
          bookId: row.bookId,
          chapterNumber,
          sectionNumber: row.sectionNumber,
        });

        if (!sourceSectionId) {
          return {
            sectionNumber: row.sectionNumber,
            topicName: row.topicName,
            sourceSectionId: null,
            conceptCount: 0,
            progress: 0,
            hasContent: false,
          };
        }

        const units = await listAssessmentUnitsWithMeta(sourceSectionId);
        const masteryByUnit = await getMasteryByAssessmentUnitId({
          userId,
          assessmentUnitIds: units.map((unit) => unit.assessmentUnitId),
        });
        const masteredCount = units.filter(
          (unit) => (masteryByUnit.get(unit.assessmentUnitId) || 0) >= MASTERY_COMPLETE_THRESHOLD
        ).length;

        return {
          sectionNumber: row.sectionNumber,
          topicName: row.topicName,
          sourceSectionId,
          conceptCount: units.length,
          progress: units.length ? Math.round((masteredCount / units.length) * 100) : 0,
          hasContent: units.length > 0,
        };
      })
  );

  return {
    chapterNumber,
    chapterName: chapterResult.rows[0].chapterName,
    sections,
  };
};

// source_section.section_code is always "${bookId}:${chapterNumber}:${sectionNumber}"
// (see the comment on resolveMostRecentSourceSectionId above), so it's a
// reliable way to recover the section's display number/topic name from just a
// sourceSectionId, without needing the student's board/class/subject context.
const getSectionDisplayMeta = async (sourceSectionId) => {
  const sectionResult = await pool.query(
    "SELECT section_code, section_number FROM source_section WHERE id = $1",
    [sourceSectionId]
  );
  const section = sectionResult.rows[0];
  if (!section) {
    return { sectionNumber: null, topicName: null };
  }

  const [bookId, chapterNumber, sectionNumber] = String(section.section_code || "").split(":");
  if (!bookId || !chapterNumber || !sectionNumber) {
    return { sectionNumber: section.section_number, topicName: null };
  }

  const catalogResult = await pool.query(
    `
      SELECT topic_name AS "topicName"
      FROM mv_chapter_catalog
      WHERE book_id = $1 AND chapter_number = $2 AND section_number = $3
      LIMIT 1
    `,
    [bookId, chapterNumber, sectionNumber]
  );

  return {
    sectionNumber,
    topicName: catalogResult.rows[0]?.topicName || null,
  };
};

export const getSectionOverview = async ({ sourceSectionId, userId }) => {
  if (!sourceSectionId) {
    return null;
  }

  const [overview, units, displayMeta] = await Promise.all([
    getSectionKnowledgeSummary(sourceSectionId),
    listAssessmentUnitsWithMeta(sourceSectionId),
    getSectionDisplayMeta(sourceSectionId),
  ]);

  if (!units.length) {
    return null;
  }

  const assessmentUnitIds = units.map((unit) => unit.assessmentUnitId);
  const [masteryByUnit, lastActivityByUnit] = await Promise.all([
    getMasteryByAssessmentUnitId({ userId, assessmentUnitIds }),
    getLastActivityByAssessmentUnitId({ userId, assessmentUnitIds }),
  ]);
  const masteredCount = units.filter(
    (unit) => (masteryByUnit.get(unit.assessmentUnitId) || 0) >= MASTERY_COMPLETE_THRESHOLD
  ).length;

  return {
    sourceSectionId,
    sectionNumber: displayMeta.sectionNumber,
    topicName: displayMeta.topicName,
    overview: overview || "",
    conceptCount: units.length,
    progress: Math.round((masteredCount / units.length) * 100),
    concepts: units.map((unit) => {
      const isMastered = (masteryByUnit.get(unit.assessmentUnitId) || 0) >= MASTERY_COMPLETE_THRESHOLD;
      const status = isMastered
        ? "completed"
        : lastActivityByUnit.has(unit.assessmentUnitId)
        ? "inProgress"
        : "notStarted";

      return {
        assessmentUnitId: unit.assessmentUnitId,
        title: unit.primaryConcept,
        curriculumImportance: unit.curriculumImportance,
        completed: isMastered,
        status,
      };
    }),
  };
};

// "Learning Map": same ordered concept list as the section overview, exposed
// separately so the client can render the big-picture sequence view before a
// student drills into any one concept card.
export const getLearningMap = async ({ sourceSectionId, userId }) => {
  const overview = await getSectionOverview({ sourceSectionId, userId });
  if (!overview) {
    return null;
  }

  return {
    sourceSectionId,
    concepts: overview.concepts,
  };
};

// Media (analogyMedia/storyMedia/etc.) is deliberately NOT fetched here.
// memory_hook_media.media_data is base64 image/video, up to ~20MB decoded per
// section and up to 7 sections per concept -- fetching all of it on every
// card load was measured at ~40MB/card in the worst real case, dominating
// load time. The client fetches one section's media on demand (only the
// section actually being viewed) via getStudentMemoryHookMediaForSection.
export const getConceptCard = async ({ assessmentUnitId }) => {
  const cached = conceptCardCache.get(assessmentUnitId);
  if (cached !== undefined) {
    return cached;
  }

  const [context, memory] = await Promise.all([
    getLayer1Context(assessmentUnitId),
    getLayer2Memory(assessmentUnitId),
  ]);
  if (!context) {
    return null;
  }

  const memoryBooster = shapeMemoryBooster(memory);

  const card = {
    assessmentUnitId: context.assessment_unit.assessment_unit_id,
    primaryConcept: context.assessment_unit.primary_concept,
    learningObjective: context.assessment_unit.learning_objective,
    conceptCategory: context.assessment_unit.concept_category,
    curriculumImportance: context.assessment_unit.curriculum_importance,
    supportingConcepts: context.assessment_unit.supporting_concepts,
    contextSummary: context.knowledge.context_summary,
    coreConcepts: context.knowledge.core_concepts,
    relationships: context.knowledge.relationships,
    comparisons: context.knowledge.comparisons,
    processes: context.knowledge.processes,
    memoryHooks: context.knowledge.memory_hooks,
    misconceptions: context.knowledge.misconceptions,
    analogy: memoryBooster?.analogy || null,
    story: memoryBooster?.story || null,
    visualHook: memoryBooster?.visualHook || null,
    realWorldConnection: memoryBooster?.realWorldConnection || null,
    memoryTrick: memoryBooster?.memoryTrick || null,
    curiosityHook: memoryBooster?.curiosityHook || null,
    microActivity: memoryBooster?.microActivity || null,
    misconceptionAlert: memoryBooster?.misconceptionAlert || null,
    retrievalCues: memoryBooster?.retrievalCues || [],
    associatedConcepts: memoryBooster?.associatedConcepts || [],
  };

  conceptCardCache.set(assessmentUnitId, card);
  return card;
};

const shapeMemoryBooster = (memory) => {
  if (!memory) {
    return null;
  }

  return {
    assessmentUnitId: memory.assessment_unit_id,
    primaryConcept: memory.primary_concept,
    story: memory.story,
    analogy: memory.analogy,
    visualHook: memory.visual_hook,
    realWorldConnection: memory.real_world_connection,
    memoryTrick: memory.memory_trick,
    curiosityHook: memory.curiosity_hook,
    microActivity: memory.micro_activity,
    misconceptionAlert: memory.misconception_alert,
    memoryDifficulty: memory.memory_difficulty,
    retrievalCues: memory.retrieval_cues,
    associatedConcepts: memory.associated_concepts,
  };
};

const mergeMemoryHookMedia = (shapedBooster, media) => ({
  ...shapedBooster,
  analogyMedia: media.analogy,
  visualHookMedia: media.visualHook,
  curiosityHookMedia: media.curiosityHook,
  memoryTrickMedia: media.memoryTrick,
  storyMedia: media.story,
  realWorldConnectionMedia: media.realWorldConnection,
  microActivityMedia: media.microActivity,
});

export const getMemoryBoosterForUnit = async ({ assessmentUnitId }) => {
  const [memory, media] = await Promise.all([
    getLayer2Memory(assessmentUnitId),
    getMemoryHookMedia(assessmentUnitId),
  ]);
  const shaped = shapeMemoryBooster(memory);
  return shaped ? mergeMemoryHookMedia(shaped, media) : null;
};

export const getMemoryBoosterForSection = async ({ sourceSectionId }) => {
  const [assessmentUnitIds, displayMeta] = await Promise.all([
    getAssessmentUnitsForSourceSection(sourceSectionId),
    getSectionDisplayMeta(sourceSectionId),
  ]);

  if (!assessmentUnitIds.length) {
    return { ...displayMeta, memoryAids: [] };
  }

  const [memories, mediaByUnit] = await Promise.all([
    Promise.all(assessmentUnitIds.map((assessmentUnitId) => getLayer2Memory(assessmentUnitId))),
    Promise.all(assessmentUnitIds.map((assessmentUnitId) => getMemoryHookMedia(assessmentUnitId))),
  ]);

  const memoryAids = memories
    .map((memory, index) => {
      const shaped = shapeMemoryBooster(memory);
      return shaped ? mergeMemoryHookMedia(shaped, mediaByUnit[index]) : null;
    })
    .filter(Boolean);

  return { ...displayMeta, memoryAids };
};

export const getFlashcardsForSection = async ({ sourceSectionId }) => {
  const terms = await getTerminologyForSection(sourceSectionId);
  return terms.map((term) => ({
    term: term.term,
    definition: term.definition,
    relatedConcepts: term.relatedConcepts,
  }));
};

export const getDiagramsForSourceSection = async ({ sourceSectionId }) => {
  const diagrams = await getDiagramsForSection(sourceSectionId);
  return diagrams.map((diagram) => ({
    diagramName: diagram.diagramName,
    purpose: diagram.purpose,
    labels: diagram.labels,
    testedLabels: diagram.testedLabels,
  }));
};
