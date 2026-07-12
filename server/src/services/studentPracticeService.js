import { pool } from "../db/pool.js";
import {
  getAssessmentUnitsForSourceSection,
  getLayer6Items,
  getLayer7Support,
} from "./assessmentStudioContextAssembler.js";
import { createStructuredCompletion } from "./openAiService.js";
import { resolveBookIdForChapter } from "./chapterExerciseService.js";
import { listSectionsForChapter } from "./studentContentService.js";

const MASTERY_COMPLETE_THRESHOLD = 0.8;
const MASTERY_DEVELOPING_THRESHOLD = 0.5;

const FREE_TEXT_GRADING_MODEL_ID = "deepseek-v4-flash";

// Descriptive answers can't be exact-string-matched, so grade them with an AI
// call that judges meaning rather than exact wording. Returns null (never
// throws) on any failure -- missing API key, network error, malformed model
// output -- so the caller can safely fall back to the existing acceptable-
// answers string match instead of blocking submission.
const gradeFreeTextAnswerWithAi = async ({ question, correctAnswer, acceptableAnswers, studentAnswer }) => {
  if (!studentAnswer?.trim()) {
    return null;
  }

  try {
    const acceptableAnswersText = acceptableAnswers.length
      ? `\nOther accepted answers: ${acceptableAnswers.join("; ")}`
      : "";
    const userPrompt = `Question: ${question || "(question text unavailable)"}
Expected answer: ${correctAnswer || "(not specified)"}${acceptableAnswersText}
Student's answer: ${studentAnswer}

Grade the student's answer against the expected answer. Judge by meaning, not exact wording -- accept correct paraphrases and partially-worded-but-substantively-correct answers as correct.

Schema:
{
  "isCorrect": true or false,
  "feedback": "1-2 sentences, addressed directly to the student, explaining why their specific answer is right or wrong"
}`;

    const { parsed } = await createStructuredCompletion({
      systemPrompt:
        "You are a fair, encouraging exam grader for a school assessment. Return only valid JSON that exactly matches the requested schema.",
      userPrompt,
      responseFormatName: "free_text_grading",
      modelId: FREE_TEXT_GRADING_MODEL_ID,
    });

    if (typeof parsed?.isCorrect !== "boolean") {
      return null;
    }

    return {
      isCorrect: parsed.isCorrect,
      feedback: typeof parsed.feedback === "string" && parsed.feedback.trim() ? parsed.feedback.trim() : null,
    };
  } catch {
    return null;
  }
};

const withTransaction = async (work) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const normalizeAnswer = (value) => String(value ?? "").trim().toLowerCase();

const shuffleInPlace = (array) => {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

// interaction_data directly encodes the correct answer for "ordering"
// (sequence = the correct order) and "matching" (pairs = the correct
// pairing), so it must never reach the client before submission -- same
// reasoning as correct_answer/acceptable_answers being excluded below.
// "ordering" needs nothing beyond the (already-sent) shuffled "options" to
// build its initial UI. "matching" needs a left list and a shuffled right
// list with the correspondence stripped out.
const buildStudentSafeInteractionData = (item) => {
  if (item.interaction_type === "matching") {
    const pairs = Array.isArray(item.interaction_data?.pairs) ? item.interaction_data.pairs : [];
    return {
      leftItems: pairs.map((pair) => pair.left),
      rightItems: shuffleInPlace(pairs.map((pair) => pair.right)),
    };
  }
  return undefined;
};

// single_select / free_text: exact string match against correct_answer or any
// acceptable_answers variant, unchanged from before "ordering"/"matching" existed.
const isSingleSelectOrFreeTextCorrect = ({ correctAnswer, acceptableAnswers, studentAnswer }) => {
  const candidates = [correctAnswer, ...acceptableAnswers]
    .filter(Boolean)
    .map(normalizeAnswer);
  return candidates.includes(normalizeAnswer(studentAnswer));
};

// studentAnswer is a JSON-stringified array of option texts in the student's
// chosen order (see StudentAssessmentPage.jsx's "ordering" serialize()).
const isOrderingCorrect = ({ interactionData, studentAnswer }) => {
  const expectedSequence = Array.isArray(interactionData?.sequence) ? interactionData.sequence : [];
  if (!expectedSequence.length) {
    return false;
  }

  let submittedSequence;
  try {
    submittedSequence = JSON.parse(studentAnswer);
  } catch {
    return false;
  }

  if (!Array.isArray(submittedSequence) || submittedSequence.length !== expectedSequence.length) {
    return false;
  }

  return submittedSequence.every(
    (value, index) => normalizeAnswer(value) === normalizeAnswer(expectedSequence[index])
  );
};

// studentAnswer is a JSON-stringified array of {left, right} assignments (see
// StudentAssessmentPage.jsx's "matching" serialize()). Order-independent.
const isMatchingCorrect = ({ interactionData, studentAnswer }) => {
  const expectedPairs = Array.isArray(interactionData?.pairs) ? interactionData.pairs : [];
  if (!expectedPairs.length) {
    return false;
  }

  let submittedPairs;
  try {
    submittedPairs = JSON.parse(studentAnswer);
  } catch {
    return false;
  }

  if (!Array.isArray(submittedPairs) || submittedPairs.length !== expectedPairs.length) {
    return false;
  }

  const expectedByLeft = new Map(
    expectedPairs.map((pair) => [normalizeAnswer(pair?.left), normalizeAnswer(pair?.right)])
  );

  return submittedPairs.every(
    (pair) => expectedByLeft.get(normalizeAnswer(pair?.left)) === normalizeAnswer(pair?.right)
  );
};

const isAnswerCorrect = ({ interactionType, correctAnswer, interactionData, acceptableAnswers, studentAnswer }) => {
  if (interactionType === "ordering") {
    return isOrderingCorrect({ interactionData, studentAnswer });
  }
  if (interactionType === "matching") {
    return isMatchingCorrect({ interactionData, studentAnswer });
  }
  return isSingleSelectOrFreeTextCorrect({ correctAnswer, acceptableAnswers, studentAnswer });
};

const deriveMasteryLevel = (probability) => {
  if (probability >= MASTERY_COMPLETE_THRESHOLD) return "Mastered";
  if (probability >= MASTERY_DEVELOPING_THRESHOLD) return "Developing";
  return "Needs Practice";
};

// Recomputes mastery for one assessment unit from the student's full response
// history and upserts it. Called right after every answer (not just at full
// attempt submission) so progress views reflect practice in real time.
const updateMasteryForUnit = async ({ userId, assessmentUnitId, generationId }) => {
  const historyResult = await pool.query(
    `
      SELECT sr.is_correct
      FROM student_response sr
      INNER JOIN student_attempt sa ON sa.id = sr.student_attempt_id
      WHERE sa.user_id = $1 AND sr.assessment_unit_id = $2
    `,
    [userId, assessmentUnitId]
  );
  const total = historyResult.rows.length;
  const correct = historyResult.rows.filter((row) => row.is_correct).length;
  const probability = total ? correct / total : 0;

  await pool.query(
    `
      INSERT INTO student_mastery (user_id, assessment_unit_id, mastery_level, mastery_probability, last_generation_id, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (user_id, assessment_unit_id) DO UPDATE
      SET mastery_level = EXCLUDED.mastery_level,
          mastery_probability = EXCLUDED.mastery_probability,
          last_generation_id = EXCLUDED.last_generation_id,
          updated_at = NOW()
    `,
    [userId, assessmentUnitId, deriveMasteryLevel(probability), probability, generationId || null]
  );
};

const toArray = (value) => (Array.isArray(value) ? value : []);

const MINIMUM_OPTIONS_BY_INTERACTION_TYPE = {
  single_select: 2,
  ordering: 2,
};

// Some generations produce a single_select/ordering item with too few options
// to be an answerable question (e.g. a single-select MCQ with only one
// choice), or a matching item with fewer than 2 pairs. These can never be
// meaningfully answered, so exclude them from the practice set entirely
// rather than serving a broken question to students. free_text items have no
// options by design and are never excluded by this check.
const hasSufficientOptions = (item) => {
  const interactionType =
    item.interaction_type || (toArray(item.options).length > 0 ? "single_select" : "free_text");

  if (interactionType === "matching") {
    return toArray(item.interaction_data?.pairs).length >= 2;
  }

  const minimumOptions = MINIMUM_OPTIONS_BY_INTERACTION_TYPE[interactionType];
  return minimumOptions ? toArray(item.options).length >= minimumOptions : true;
};

// Shared tail of materializing any practice_set (section- or concept-scoped):
// syncs question_bank_item / practice_set_item rows against whichever Layer
// 5/6 generations are CURRENTLY SELECTED (getLayer6Items already resolves the
// selected version) for the given practiceSetId, dropping rows for items that
// no longer belong. Safe to call every time a student starts an assessment.
const syncPracticeSetItems = async (client, practiceSetId, currentItems) => {
  const questionBankEntries = [];
  for (const item of currentItems) {
    const inserted = await client.query(
      `
        INSERT INTO question_bank_item (generation_id, assessment_unit_id, blueprint_id, item_id, status)
        VALUES ($1, $2, $3, $4, 'active')
        ON CONFLICT (item_id) WHERE item_id IS NOT NULL DO UPDATE
        SET generation_id = EXCLUDED.generation_id,
            assessment_unit_id = EXCLUDED.assessment_unit_id,
            blueprint_id = EXCLUDED.blueprint_id,
            updated_at = NOW()
        RETURNING id
      `,
      [item.generation_id, item.assessment_unit_id, item.blueprint_id, item.item_id]
    );

    questionBankEntries.push({ questionBankItemId: inserted.rows[0].id, item });
  }

  const currentQuestionBankItemIds = questionBankEntries.map(
    (entry) => entry.questionBankItemId
  );

  if (currentQuestionBankItemIds.length) {
    await client.query(
      `
        DELETE FROM practice_set_item
        WHERE practice_set_id = $1 AND NOT (question_bank_item_id = ANY($2))
      `,
      [practiceSetId, currentQuestionBankItemIds]
    );
  } else {
    await client.query("DELETE FROM practice_set_item WHERE practice_set_id = $1", [
      practiceSetId,
    ]);
  }

  for (const [index, { questionBankItemId, item }] of questionBankEntries.entries()) {
    await client.query(
      `
        INSERT INTO practice_set_item (practice_set_id, question_bank_item_id, assessment_unit_id, display_order)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (practice_set_id, question_bank_item_id) DO UPDATE
        SET display_order = EXCLUDED.display_order,
            assessment_unit_id = EXCLUDED.assessment_unit_id
      `,
      [practiceSetId, questionBankItemId, item.assessment_unit_id, index]
    );
  }

  return {
    practiceSetId,
    items: questionBankEntries.map(({ questionBankItemId, item }, index) => ({
      questionBankItemId,
      displayOrder: index,
      itemId: item.item_id,
      assessmentUnitId: item.assessment_unit_id,
      question: item.question,
      options: item.options,
      questionFamily: item.question_family,
      interactionType: item.interaction_type,
      interactionData: buildStudentSafeInteractionData(item),
      assessmentDimension: item.assessment_dimension,
      bloomsLevel: item.blooms_level,
      difficulty: item.difficulty,
      marks: Number(item.marks || 0),
      estimatedTimeSeconds: Number(item.estimated_time_seconds || 0),
      // correct_answer / acceptable_answers deliberately excluded — server-side only.
    })),
  };
};

// Finds (or creates) the section's canonical practice_set, then syncs it
// against every assessment unit in the section.
const materializePracticeSetForSection = async (sourceSectionId) =>
  withTransaction(async (client) => {
    const existingSet = await client.query(
      "SELECT id FROM practice_set WHERE source_section_id = $1",
      [sourceSectionId]
    );

    let practiceSetId = existingSet.rows[0]?.id;
    if (!practiceSetId) {
      const inserted = await client.query(
        `
          INSERT INTO practice_set (source_section_id, name, status)
          VALUES ($1, $2, 'active')
          RETURNING id
        `,
        [sourceSectionId, `Section ${sourceSectionId} Assessment`]
      );
      practiceSetId = inserted.rows[0].id;
    }

    const assessmentUnitIds = await getAssessmentUnitsForSourceSection(sourceSectionId);
    const currentItems = [];
    for (const assessmentUnitId of assessmentUnitIds) {
      const items = (await getLayer6Items(assessmentUnitId)).filter(hasSufficientOptions);
      currentItems.push(...items);
    }

    return syncPracticeSetItems(client, practiceSetId, currentItems);
  });

// Finds (or creates) a single concept's canonical practice_set, then syncs it
// against just that one assessment unit's items -- lets a student practice
// one concept in isolation instead of the whole section at once, so
// correctness/mastery signal isn't diluted across every other concept in the
// section.
const materializePracticeSetForConcept = async (assessmentUnitId) =>
  withTransaction(async (client) => {
    const existingSet = await client.query(
      "SELECT id FROM practice_set WHERE source_assessment_unit_id = $1",
      [assessmentUnitId]
    );

    let practiceSetId = existingSet.rows[0]?.id;
    if (!practiceSetId) {
      const inserted = await client.query(
        `
          INSERT INTO practice_set (source_assessment_unit_id, name, status)
          VALUES ($1, $2, 'active')
          RETURNING id
        `,
        [assessmentUnitId, `Concept ${assessmentUnitId} Practice`]
      );
      practiceSetId = inserted.rows[0].id;
    }

    const currentItems = (await getLayer6Items(assessmentUnitId)).filter(hasSufficientOptions);

    return syncPracticeSetItems(client, practiceSetId, currentItems);
  });

// Finds (or creates) the whole chapter's canonical practice_set, then syncs
// it against every assessment unit in every section of the chapter. Reuses
// the already-unused practice_set_code column (no schema change needed) as
// the natural key, since a chapter has no single row of its own to hang a FK
// off -- mst_chapter is actually one row per section (see the comment on
// resolveBookIdForChapter), so "book + chapter number" is the closest stable
// identity for "this chapter's content," same as chapterExerciseService.js
// uses for book questions.
const materializePracticeSetForChapter = async ({ board, studentClass, subject, chapterNumber, userId }) => {
  const fkMstBookId = await resolveBookIdForChapter({ board, studentClass, subject, chapterNumber });
  if (!fkMstBookId) {
    return { practiceSetId: null, items: [] };
  }

  const { sections } = await listSectionsForChapter({ board, studentClass, subject, chapterNumber, userId });
  const sourceSectionIds = sections
    .filter((section) => section.hasContent && section.sourceSectionId)
    .map((section) => section.sourceSectionId);

  return withTransaction(async (client) => {
    const practiceSetCode = `chapter:${fkMstBookId}:${chapterNumber}`;
    const existingSet = await client.query(
      "SELECT id FROM practice_set WHERE practice_set_code = $1",
      [practiceSetCode]
    );

    let practiceSetId = existingSet.rows[0]?.id;
    if (!practiceSetId) {
      const inserted = await client.query(
        `
          INSERT INTO practice_set (practice_set_code, name, status)
          VALUES ($1, $2, 'active')
          RETURNING id
        `,
        [practiceSetCode, `Chapter ${chapterNumber} Assessment`]
      );
      practiceSetId = inserted.rows[0].id;
    }

    const currentItems = [];
    for (const sourceSectionId of sourceSectionIds) {
      const assessmentUnitIds = await getAssessmentUnitsForSourceSection(sourceSectionId);
      for (const assessmentUnitId of assessmentUnitIds) {
        const items = (await getLayer6Items(assessmentUnitId)).filter(hasSufficientOptions);
        currentItems.push(...items);
      }
    }

    return syncPracticeSetItems(client, practiceSetId, currentItems);
  });
};

// Recovers the exact item order an attempt was originally presented in --
// needed only for chapter assessments, where that order was randomized at
// creation (see startOrResumeChapterAssessment) and must stay stable across
// resumes. student_attempt_item has no "presentation position" column, but
// createAttempt inserts one row per item in presentation order, so the rows'
// own auto-increment id order reconstructs it without a schema change.
const reorderItemsForAttempt = async ({ attemptId, items }) => {
  const result = await pool.query(
    "SELECT display_order FROM student_attempt_item WHERE student_attempt_id = $1 ORDER BY id ASC",
    [attemptId]
  );
  const itemsByDisplayOrder = new Map(items.map((item) => [item.displayOrder, item]));
  const ordered = result.rows
    .map((row) => itemsByDisplayOrder.get(row.display_order))
    .filter(Boolean);
  return ordered.length === items.length ? ordered : items;
};

const findInProgressAttempt = async ({ userId, practiceSetId }) => {
  const result = await pool.query(
    `
      SELECT id, status
      FROM student_attempt
      WHERE user_id = $1 AND practice_set_id = $2 AND status = 'in_progress'
      LIMIT 1
    `,
    [userId, practiceSetId]
  );
  return result.rows[0] || null;
};

const createAttempt = async ({ userId, practiceSetId, items }) => {
  try {
    return await withTransaction(async (client) => {
      const inserted = await client.query(
        `
          INSERT INTO student_attempt (user_id, practice_set_id, status)
          VALUES ($1, $2, 'in_progress')
          RETURNING id, status
        `,
        [userId, practiceSetId]
      );
      const attemptId = inserted.rows[0].id;

      for (const item of items) {
        await client.query(
          `
            INSERT INTO student_attempt_item (student_attempt_id, question_bank_item_id, item_id, display_order)
            VALUES ($1, $2, $3, $4)
          `,
          [attemptId, item.questionBankItemId, item.itemId, item.displayOrder]
        );
      }

      return { id: attemptId, status: "in_progress" };
    });
  } catch (error) {
    // Double-submit race: another request already created the in_progress
    // attempt (idx_student_attempt_in_progress). Re-fetch it instead of
    // erroring or creating a duplicate.
    if (error.code === "23505") {
      const existing = await findInProgressAttempt({ userId, practiceSetId });
      if (existing) {
        return existing;
      }
    }
    throw error;
  }
};

const getResponsesForAttempt = async (attemptId) => {
  const result = await pool.query(
    `
      SELECT sai.display_order, sr.student_answer, sr.is_correct
      FROM student_attempt_item sai
      LEFT JOIN student_response sr ON sr.student_attempt_item_id = sai.id
      WHERE sai.student_attempt_id = $1
      ORDER BY sr.created_at ASC
    `,
    [attemptId]
  );

  const byDisplayOrder = new Map();
  for (const row of result.rows) {
    if (row.student_answer !== null) {
      byDisplayOrder.set(row.display_order, {
        studentAnswer: row.student_answer,
        isCorrect: row.is_correct,
      });
    }
  }
  return byDisplayOrder;
};

// source_section.section_code is always "${bookId}:${chapterNumber}:${sectionNumber}"
// (see studentContentService.js/moderationService.js for the same pattern),
// so it reliably recovers the section's display number/topic name from just a
// sourceSectionId.
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

// Like getSectionDisplayMeta, but for a single concept -- reuses it for the
// section number and overrides topicName with the concept's own name, which
// is more meaningful than the section's topic name on a single-concept quiz.
const getConceptDisplayMeta = async (assessmentUnitId) => {
  const unitResult = await pool.query(
    "SELECT primary_concept, source_section_id FROM assessment_unit WHERE assessment_unit_id = $1",
    [assessmentUnitId]
  );
  const unit = unitResult.rows[0];
  if (!unit) {
    return { sectionNumber: null, topicName: null };
  }

  const sectionMeta = await getSectionDisplayMeta(unit.source_section_id);
  return { sectionNumber: sectionMeta.sectionNumber, topicName: unit.primary_concept };
};

const buildAssessmentResponse = async ({ attempt, items, displayMeta }) => {
  const responseByDisplayOrder = await getResponsesForAttempt(attempt.id);

  return {
    attemptId: attempt.id,
    status: attempt.status,
    sectionNumber: displayMeta.sectionNumber,
    topicName: displayMeta.topicName,
    totalMarks: items.reduce((sum, item) => sum + item.marks, 0),
    estimatedDurationSeconds: items.reduce((sum, item) => sum + item.estimatedTimeSeconds, 0),
    items: items.map((item) => ({
      ...item,
      studentAnswer: responseByDisplayOrder.get(item.displayOrder)?.studentAnswer ?? null,
      isCorrect: responseByDisplayOrder.get(item.displayOrder)?.isCorrect ?? null,
    })),
  };
};

export const startOrResumeAssessment = async ({ sourceSectionId, userId }) => {
  const [{ practiceSetId, items }, displayMeta] = await Promise.all([
    materializePracticeSetForSection(sourceSectionId),
    getSectionDisplayMeta(sourceSectionId),
  ]);

  if (!items.length) {
    const error = new Error("This section has no generated assessment items yet.");
    error.statusCode = 404;
    throw error;
  }

  let attempt = await findInProgressAttempt({ userId, practiceSetId });
  if (!attempt) {
    attempt = await createAttempt({ userId, practiceSetId, items });
  }

  return buildAssessmentResponse({ attempt, items, displayMeta });
};

export const startOrResumeConceptAssessment = async ({ assessmentUnitId, userId }) => {
  const [{ practiceSetId, items }, displayMeta] = await Promise.all([
    materializePracticeSetForConcept(assessmentUnitId),
    getConceptDisplayMeta(assessmentUnitId),
  ]);

  if (!items.length) {
    const error = new Error("This concept has no generated assessment items yet.");
    error.statusCode = 404;
    throw error;
  }

  let attempt = await findInProgressAttempt({ userId, practiceSetId });
  if (!attempt) {
    attempt = await createAttempt({ userId, practiceSetId, items });
  }

  return buildAssessmentResponse({ attempt, items, displayMeta });
};

// Abandons any in-progress attempt (freeing the one-in-progress-per-practice-set
// slot enforced by idx_student_attempt_in_progress) and starts a brand new one
// at item 1, discarding the old attempt's progress. Previously *completed*
// attempts are untouched and keep showing in the recent-attempts history.
export const restartAssessment = async ({ sourceSectionId, userId }) => {
  const [{ practiceSetId, items }, displayMeta] = await Promise.all([
    materializePracticeSetForSection(sourceSectionId),
    getSectionDisplayMeta(sourceSectionId),
  ]);

  if (!items.length) {
    const error = new Error("This section has no generated assessment items yet.");
    error.statusCode = 404;
    throw error;
  }

  await pool.query(
    "UPDATE student_attempt SET status = 'abandoned' WHERE user_id = $1 AND practice_set_id = $2 AND status = 'in_progress'",
    [userId, practiceSetId]
  );

  const attempt = await createAttempt({ userId, practiceSetId, items });

  return buildAssessmentResponse({ attempt, items, displayMeta });
};

// Most recent COMPLETED attempts for this section's practice set, with
// attempted/correct/incorrect counts, for the "recent attempts" trail on the
// assessment instructions screen. In-progress/abandoned attempts are excluded
// -- they aren't a meaningful finished result to trend against.
export const listRecentAttemptsForSection = async ({ sourceSectionId, userId, limit = 5 }) => {
  const practiceSetResult = await pool.query(
    "SELECT id FROM practice_set WHERE source_section_id = $1",
    [sourceSectionId]
  );
  const practiceSetId = practiceSetResult.rows[0]?.id;
  if (!practiceSetId) {
    return { attempts: [] };
  }

  const attemptsResult = await pool.query(
    `
      SELECT
        sa.id,
        sa.started_at,
        sa.submitted_at,
        sa.score,
        COUNT(DISTINCT sai.id) AS total_count,
        COUNT(DISTINCT sr.student_attempt_item_id) AS attempted_count,
        COUNT(DISTINCT sr.student_attempt_item_id) FILTER (WHERE sr.is_correct) AS correct_count
      FROM student_attempt sa
      LEFT JOIN student_attempt_item sai ON sai.student_attempt_id = sa.id
      LEFT JOIN student_response sr ON sr.student_attempt_item_id = sai.id
      WHERE sa.user_id = $1 AND sa.practice_set_id = $2 AND sa.status = 'completed'
      GROUP BY sa.id, sa.started_at, sa.submitted_at, sa.score
      ORDER BY sa.started_at DESC
      LIMIT $3
    `,
    [userId, practiceSetId, limit]
  );

  return {
    attempts: attemptsResult.rows.map((row) => {
      const attemptedCount = Number(row.attempted_count) || 0;
      const correctCount = Number(row.correct_count) || 0;
      return {
        attemptId: row.id,
        startedAt: row.started_at,
        submittedAt: row.submitted_at,
        score: row.score !== null ? Number(row.score) : null,
        totalCount: Number(row.total_count) || 0,
        attemptedCount,
        correctCount,
        incorrectCount: attemptedCount - correctCount,
      };
    }),
  };
};

// Same as listRecentAttemptsForSection, but for a single concept's practice
// set -- gives the student a transparent trail of their own past attempts at
// just this concept (date/time + score), matching the isolation the
// concept-scoped practice feature is for.
export const listRecentAttemptsForConcept = async ({ assessmentUnitId, userId, limit = 5 }) => {
  const practiceSetResult = await pool.query(
    "SELECT id FROM practice_set WHERE source_assessment_unit_id = $1",
    [assessmentUnitId]
  );
  const practiceSetId = practiceSetResult.rows[0]?.id;
  if (!practiceSetId) {
    return { attempts: [] };
  }

  const attemptsResult = await pool.query(
    `
      SELECT
        sa.id,
        sa.started_at,
        sa.submitted_at,
        sa.score,
        COUNT(DISTINCT sai.id) AS total_count,
        COUNT(DISTINCT sr.student_attempt_item_id) AS attempted_count,
        COUNT(DISTINCT sr.student_attempt_item_id) FILTER (WHERE sr.is_correct) AS correct_count
      FROM student_attempt sa
      LEFT JOIN student_attempt_item sai ON sai.student_attempt_id = sa.id
      LEFT JOIN student_response sr ON sr.student_attempt_item_id = sai.id
      WHERE sa.user_id = $1 AND sa.practice_set_id = $2 AND sa.status = 'completed'
      GROUP BY sa.id, sa.started_at, sa.submitted_at, sa.score
      ORDER BY sa.started_at DESC
      LIMIT $3
    `,
    [userId, practiceSetId, limit]
  );

  return {
    attempts: attemptsResult.rows.map((row) => {
      const attemptedCount = Number(row.attempted_count) || 0;
      const correctCount = Number(row.correct_count) || 0;
      return {
        attemptId: row.id,
        startedAt: row.started_at,
        submittedAt: row.submitted_at,
        score: row.score !== null ? Number(row.score) : null,
        totalCount: Number(row.total_count) || 0,
        attemptedCount,
        correctCount,
        incorrectCount: attemptedCount - correctCount,
      };
    }),
  };
};

const getChapterDisplayMeta = async ({ board, studentClass, subject, chapterNumber, userId }) => {
  const { chapterName } = await listSectionsForChapter({ board, studentClass, subject, chapterNumber, userId });
  return { sectionNumber: null, topicName: chapterName };
};

export const startOrResumeChapterAssessment = async ({ board, studentClass, subject, chapterNumber, userId }) => {
  const [{ practiceSetId, items }, displayMeta] = await Promise.all([
    materializePracticeSetForChapter({ board, studentClass, subject, chapterNumber, userId }),
    getChapterDisplayMeta({ board, studentClass, subject, chapterNumber, userId }),
  ]);

  if (!items.length) {
    const error = new Error("This chapter has no generated assessment items yet.");
    error.statusCode = 404;
    throw error;
  }

  // Random order is chapter-assessment-specific -- only reshuffled when a
  // new attempt is actually created; resuming an in-progress attempt
  // recovers that same original order instead of reshuffling again.
  let attempt = await findInProgressAttempt({ userId, practiceSetId });
  let presentedItems;
  if (attempt) {
    presentedItems = await reorderItemsForAttempt({ attemptId: attempt.id, items });
  } else {
    presentedItems = shuffleInPlace([...items]);
    attempt = await createAttempt({ userId, practiceSetId, items: presentedItems });
  }

  return buildAssessmentResponse({ attempt, items: presentedItems, displayMeta });
};

export const restartChapterAssessment = async ({ board, studentClass, subject, chapterNumber, userId }) => {
  const [{ practiceSetId, items }, displayMeta] = await Promise.all([
    materializePracticeSetForChapter({ board, studentClass, subject, chapterNumber, userId }),
    getChapterDisplayMeta({ board, studentClass, subject, chapterNumber, userId }),
  ]);

  if (!items.length) {
    const error = new Error("This chapter has no generated assessment items yet.");
    error.statusCode = 404;
    throw error;
  }

  await pool.query(
    "UPDATE student_attempt SET status = 'abandoned' WHERE user_id = $1 AND practice_set_id = $2 AND status = 'in_progress'",
    [userId, practiceSetId]
  );

  const presentedItems = shuffleInPlace([...items]);
  const attempt = await createAttempt({ userId, practiceSetId, items: presentedItems });

  return buildAssessmentResponse({ attempt, items: presentedItems, displayMeta });
};

// Same as listRecentAttemptsForSection, but for a whole chapter's practice
// set (see materializePracticeSetForChapter for why practice_set_code is the
// lookup key here instead of a direct FK column).
export const listRecentAttemptsForChapter = async ({ board, studentClass, subject, chapterNumber, userId, limit = 5 }) => {
  const fkMstBookId = await resolveBookIdForChapter({ board, studentClass, subject, chapterNumber });
  if (!fkMstBookId) {
    return { attempts: [] };
  }

  const practiceSetResult = await pool.query(
    "SELECT id FROM practice_set WHERE practice_set_code = $1",
    [`chapter:${fkMstBookId}:${chapterNumber}`]
  );
  const practiceSetId = practiceSetResult.rows[0]?.id;
  if (!practiceSetId) {
    return { attempts: [] };
  }

  const attemptsResult = await pool.query(
    `
      SELECT
        sa.id,
        sa.started_at,
        sa.submitted_at,
        sa.score,
        COUNT(DISTINCT sai.id) AS total_count,
        COUNT(DISTINCT sr.student_attempt_item_id) AS attempted_count,
        COUNT(DISTINCT sr.student_attempt_item_id) FILTER (WHERE sr.is_correct) AS correct_count
      FROM student_attempt sa
      LEFT JOIN student_attempt_item sai ON sai.student_attempt_id = sa.id
      LEFT JOIN student_response sr ON sr.student_attempt_item_id = sai.id
      WHERE sa.user_id = $1 AND sa.practice_set_id = $2 AND sa.status = 'completed'
      GROUP BY sa.id, sa.started_at, sa.submitted_at, sa.score
      ORDER BY sa.started_at DESC
      LIMIT $3
    `,
    [userId, practiceSetId, limit]
  );

  return {
    attempts: attemptsResult.rows.map((row) => {
      const attemptedCount = Number(row.attempted_count) || 0;
      const correctCount = Number(row.correct_count) || 0;
      return {
        attemptId: row.id,
        startedAt: row.started_at,
        submittedAt: row.submitted_at,
        score: row.score !== null ? Number(row.score) : null,
        totalCount: Number(row.total_count) || 0,
        attemptedCount,
        correctCount,
        incorrectCount: attemptedCount - correctCount,
      };
    }),
  };
};

export const submitAnswer = async ({ attemptId, displayOrder, studentAnswer, timeTakenSeconds, userId }) => {
  const attemptResult = await pool.query(
    "SELECT id, user_id, status FROM student_attempt WHERE id = $1",
    [attemptId]
  );
  const attempt = attemptResult.rows[0];
  if (!attempt || String(attempt.user_id) !== String(userId)) {
    return null;
  }
  if (attempt.status !== "in_progress") {
    const error = new Error("This assessment has already been submitted.");
    error.statusCode = 409;
    throw error;
  }

  const attemptItemResult = await pool.query(
    `
      SELECT id AS attempt_item_id, item_id
      FROM student_attempt_item
      WHERE student_attempt_id = $1 AND display_order = $2
    `,
    [attemptId, displayOrder]
  );
  const attemptItem = attemptItemResult.rows[0];
  if (!attemptItem) {
    return null;
  }

  const layer6Result = await pool.query(
    `
      SELECT id, assessment_unit_id, generation_id, correct_answer, marks, interaction_type, interaction_data, question
      FROM layer6_assessment_item
      WHERE item_id = $1
    `,
    [attemptItem.item_id]
  );
  const layer6Item = layer6Result.rows[0];
  if (!layer6Item) {
    return null;
  }

  const [acceptableResult, optionCountResult] = await Promise.all([
    pool.query(
      "SELECT answer_text FROM layer6_assessment_item_acceptable_answer WHERE layer6_assessment_item_id = $1",
      [layer6Item.id]
    ),
    pool.query(
      "SELECT COUNT(*)::int AS count FROM layer6_assessment_item_option WHERE layer6_assessment_item_id = $1",
      [layer6Item.id]
    ),
  ]);
  const acceptableAnswers = acceptableResult.rows.map((row) => row.answer_text);

  // Mirrors the client's resolveInteractionType fallback (StudentAssessmentPage.jsx)
  // so legacy items with no interaction_type are graded the same way they're
  // rendered: no options -> free_text, otherwise single_select.
  const resolvedInteractionType =
    layer6Item.interaction_type || (optionCountResult.rows[0]?.count > 0 ? "single_select" : "free_text");

  let correct;
  let aiFeedback = null;

  if (resolvedInteractionType === "free_text") {
    const aiGrading = await gradeFreeTextAnswerWithAi({
      question: layer6Item.question,
      correctAnswer: layer6Item.correct_answer,
      acceptableAnswers,
      studentAnswer,
    });

    if (aiGrading) {
      correct = aiGrading.isCorrect;
      aiFeedback = aiGrading.feedback;
    } else {
      correct = isAnswerCorrect({
        interactionType: resolvedInteractionType,
        correctAnswer: layer6Item.correct_answer,
        interactionData: layer6Item.interaction_data,
        acceptableAnswers,
        studentAnswer,
      });
    }
  } else {
    correct = isAnswerCorrect({
      interactionType: resolvedInteractionType,
      correctAnswer: layer6Item.correct_answer,
      interactionData: layer6Item.interaction_data,
      acceptableAnswers,
      studentAnswer,
    });
  }

  await withTransaction(async (client) => {
    await client.query(
      `
        INSERT INTO student_response (
          generation_id, student_attempt_id, student_attempt_item_id, assessment_unit_id,
          student_answer, is_correct, time_taken_seconds
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        layer6Item.generation_id,
        attemptId,
        attemptItem.attempt_item_id,
        layer6Item.assessment_unit_id,
        studentAnswer,
        correct,
        Number(timeTakenSeconds || 0),
      ]
    );
    await client.query("UPDATE student_attempt_item SET marks_awarded = $1 WHERE id = $2", [
      correct ? Number(layer6Item.marks || 0) : 0,
      attemptItem.attempt_item_id,
    ]);
  });

  await updateMasteryForUnit({
    userId,
    assessmentUnitId: layer6Item.assessment_unit_id,
    generationId: layer6Item.generation_id,
  });

  const support = await getLayer7Support(layer6Item.assessment_unit_id);
  const distractorMatch = support?.distractorAnalysis?.find(
    (distractor) => normalizeAnswer(distractor.optionText) === normalizeAnswer(studentAnswer)
  );

  const dependencyResult = await pool.query(
    `
      SELECT depends_on_assessment_unit_id
      FROM assessment_unit_dependency
      WHERE assessment_unit_id = $1
      ORDER BY id ASC
      LIMIT 1
    `,
    [layer6Item.assessment_unit_id]
  );

  let relatedConcept = null;
  if (dependencyResult.rows[0]) {
    const relatedUnitResult = await pool.query(
      "SELECT primary_concept FROM assessment_unit WHERE assessment_unit_id = $1",
      [dependencyResult.rows[0].depends_on_assessment_unit_id]
    );
    relatedConcept = relatedUnitResult.rows[0]?.primary_concept || null;
  }

  return {
    isCorrect: correct,
    correctAnswer: layer6Item.correct_answer,
    explanation:
      aiFeedback ||
      (correct
        ? support?.correctAnswerReasoning || support?.conceptExplanation || null
        : distractorMatch?.whyIncorrect || support?.conceptExplanation || null),
    relatedConcept,
    hints: support?.progressiveHints || [],
  };
};

export const getAssessmentResult = async ({ attemptId, userId }) => {
  const attemptResult = await pool.query(
    "SELECT id, user_id, status, score FROM student_attempt WHERE id = $1",
    [attemptId]
  );
  const attempt = attemptResult.rows[0];
  if (!attempt || String(attempt.user_id) !== String(userId)) {
    return null;
  }

  const itemsResult = await pool.query(
    `
      SELECT
        sai.id AS attempt_item_id,
        sai.display_order,
        lai.marks,
        lai.assessment_unit_id,
        au.primary_concept
      FROM student_attempt_item sai
      LEFT JOIN layer6_assessment_item lai ON lai.item_id = sai.item_id
      LEFT JOIN assessment_unit au ON au.assessment_unit_id = lai.assessment_unit_id
      WHERE sai.student_attempt_id = $1
      ORDER BY sai.display_order ASC
    `,
    [attemptId]
  );

  const responsesResult = await pool.query(
    "SELECT student_attempt_item_id, is_correct FROM student_response WHERE student_attempt_id = $1",
    [attemptId]
  );
  const correctnessByAttemptItemId = new Map(
    responsesResult.rows.map((row) => [row.student_attempt_item_id, row.is_correct])
  );

  let correctCount = 0;
  let incorrectCount = 0;
  let unattemptedCount = 0;
  let totalMarks = 0;
  const topicMap = new Map();

  for (const row of itemsResult.rows) {
    totalMarks += Number(row.marks || 0);
    const isAnswered = correctnessByAttemptItemId.has(row.attempt_item_id);
    const isCorrect = correctnessByAttemptItemId.get(row.attempt_item_id);

    if (!isAnswered) {
      unattemptedCount += 1;
    } else if (isCorrect) {
      correctCount += 1;
    } else {
      incorrectCount += 1;
    }

    if (row.assessment_unit_id) {
      const topic = topicMap.get(row.assessment_unit_id) || {
        assessmentUnitId: row.assessment_unit_id,
        primaryConcept: row.primary_concept,
        correctCount: 0,
        totalCount: 0,
      };
      topic.totalCount += 1;
      if (isAnswered && isCorrect) {
        topic.correctCount += 1;
      }
      topicMap.set(row.assessment_unit_id, topic);
    }
  }

  return {
    attemptId: attempt.id,
    status: attempt.status,
    score: attempt.score !== null ? Number(attempt.score) : null,
    totalMarks,
    correctCount,
    incorrectCount,
    unattemptedCount,
    performanceByTopic: [...topicMap.values()].map((topic) => ({
      ...topic,
      percentage: topic.totalCount ? Math.round((topic.correctCount / topic.totalCount) * 100) : 0,
    })),
  };
};

export const submitAssessment = async ({ attemptId, userId }) => {
  const attemptResult = await pool.query(
    "SELECT id, user_id, status FROM student_attempt WHERE id = $1",
    [attemptId]
  );
  const attempt = attemptResult.rows[0];
  if (!attempt || String(attempt.user_id) !== String(userId)) {
    return null;
  }

  if (attempt.status === "in_progress") {
    const totalsResult = await pool.query(
      `
        SELECT
          COALESCE(SUM(lai.marks), 0) AS total_marks,
          COALESCE(SUM(sai.marks_awarded), 0) AS scored_marks
        FROM student_attempt_item sai
        LEFT JOIN layer6_assessment_item lai ON lai.item_id = sai.item_id
        WHERE sai.student_attempt_id = $1
      `,
      [attemptId]
    );
    const totalMarks = Number(totalsResult.rows[0].total_marks || 0);
    const scoredMarks = Number(totalsResult.rows[0].scored_marks || 0);
    const score = totalMarks ? Math.round((scoredMarks / totalMarks) * 10000) / 100 : 0;

    await pool.query(
      "UPDATE student_attempt SET status = 'completed', submitted_at = NOW(), score = $1 WHERE id = $2",
      [score, attemptId]
    );

    const touchedUnitsResult = await pool.query(
      `
        SELECT DISTINCT assessment_unit_id
        FROM student_response
        WHERE student_attempt_id = $1 AND assessment_unit_id IS NOT NULL
      `,
      [attemptId]
    );

    for (const row of touchedUnitsResult.rows) {
      const assessmentUnitId = row.assessment_unit_id;
      const lastGenerationResult = await pool.query(
        `
          SELECT generation_id
          FROM student_response
          WHERE student_attempt_id = $1 AND assessment_unit_id = $2
          ORDER BY created_at DESC
          LIMIT 1
        `,
        [attemptId, assessmentUnitId]
      );

      // Mastery is already kept current per-answer by submitAnswer; this is an
      // idempotent safety net for any response written outside that path.
      await updateMasteryForUnit({
        userId,
        assessmentUnitId,
        generationId: lastGenerationResult.rows[0]?.generation_id || null,
      });
    }
  }

  return getAssessmentResult({ attemptId, userId });
};

export const getMindMapForSection = async (sourceSectionId) => {
  const assessmentUnitIds = await getAssessmentUnitsForSourceSection(sourceSectionId);
  if (!assessmentUnitIds.length) {
    return { nodes: [], edges: [] };
  }

  const [nodesResult, edgesResult] = await Promise.all([
    pool.query(
      "SELECT assessment_unit_id, primary_concept FROM assessment_unit WHERE assessment_unit_id = ANY($1)",
      [assessmentUnitIds]
    ),
    pool.query(
      "SELECT assessment_unit_id, depends_on_assessment_unit_id FROM assessment_unit_dependency WHERE assessment_unit_id = ANY($1)",
      [assessmentUnitIds]
    ),
  ]);

  return {
    nodes: nodesResult.rows.map((row) => ({
      assessmentUnitId: row.assessment_unit_id,
      primaryConcept: row.primary_concept,
    })),
    edges: edgesResult.rows.map((row) => ({
      from: row.depends_on_assessment_unit_id,
      to: row.assessment_unit_id,
    })),
  };
};
