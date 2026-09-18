import { pool } from "../db/pool.js";
import { getPreWarmupContentForSection } from "./preWarmupImportService.js";
import { gradeFreeTextAnswerWithAi, normalizeAnswer } from "./studentPracticeService.js";
import { createStructuredCompletion } from "./openAiService.js";
import { ISSUES_PROMPT_INSTRUCTION, ISSUES_SCHEMA_FRAGMENT, normalizeAiTextIssues } from "./aiTextIssueUtils.js";
import { listSectionsForChapter } from "./studentContentService.js";
import { resolveBookIdForChapter } from "./chapterExerciseService.js";

const PHASES = new Set(["preLessonWarmup", "postLesson"]);

const DEFAULT_RESPONSE_CAPTURE = { inputModes: ["text", "mic"], maxDurationSeconds: 120, countdownTimer: true };

const safeJsonParse = (value, fallback) => {
  if (value == null) return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const FREE_TEXT_FORMATS = new Set(["fill_in_blank", "short_answer", "hots_infer", "hots_predict", "hots_recall"]);

const parseReorderSequence = (answer) =>
  String(answer || "")
    .split(/\s*(?:→|->)\s*/)
    .map((step) => step.trim())
    .filter(Boolean);

// Single source of truth for both (a) the answer-key-stripped content sent to
// the client (the `content` sub-object never carries `correctAnswer`) and (b)
// grading a submitted answer -- so the two can never drift out of sync.
// item_key is synthesized from the payload's own array/batch indices, same
// stability assumption preserveExistingImages() in preWarmupImportService.js
// already relies on for re-imports.
const buildPhaseItems = (payload, phase) => {
  if (phase === "preLessonWarmup") {
    const preLessonWarmup = payload?.preLessonWarmup || {};
    const vocabularyWarmup = preLessonWarmup.vocabularyWarmup || {};
    const items = [];

    if (vocabularyWarmup.avs) {
      items.push({
        itemKey: "vocabularyWarmup.avs",
        itemTier: "reference",
        subsectionKey: "avs",
        content: {
          prompt: vocabularyWarmup.avs.prompt,
          anchorVocabularySet: safeJsonParse(vocabularyWarmup.avs.anchorVocabularySet, []),
        },
      });
    }

    if (vocabularyWarmup.avsVisual) {
      items.push({
        itemKey: "vocabularyWarmup.avsVisual",
        itemTier: "reference",
        subsectionKey: "avsVisual",
        content: { prompt: vocabularyWarmup.avsVisual.prompt, image: vocabularyWarmup.avsVisual.image },
      });
    }

    (vocabularyWarmup.avsAssessment?.batches || []).forEach((batch, batchIndex) => {
      (batch?.answerKey?.items || []).forEach((row, rowIndex) => {
        items.push({
          itemKey: `vocabularyWarmup.avsAssessment.batch${batchIndex}.row${rowIndex}`,
          itemTier: "scored",
          subsectionKey: "avsAssessment",
          format: "avsAssessmentRow",
          correctAnswer: row.correct_option,
          content: { row: row.row, avs: row.avs, image: batch.image },
        });
      });
    });

    if (preLessonWarmup.sensoryWarmup || vocabularyWarmup.avsVisual) {
      items.push({
        itemKey: "sensoryWarmup",
        itemTier: "tracked",
        subsectionKey: "sensoryWarmup",
        content: {
          responsePrompt:
            preLessonWarmup.sensoryWarmup?.responsePrompt ||
            "Look at the Vocabulary Warm-Up image again, as a whole. Based on what you see, type or say what you think this story might be about.",
          responseCapture: preLessonWarmup.sensoryWarmup?.responseCapture || DEFAULT_RESPONSE_CAPTURE,
          image: vocabularyWarmup.avsVisual?.image,
        },
      });
    }

    const experientialQuestions =
      safeJsonParse(preLessonWarmup.experientialWarmup?.content, {}).questions ??
      preLessonWarmup.experientialWarmup?.questions;
    (experientialQuestions || []).forEach((question, index) => {
      items.push({
        itemKey: `experientialWarmup.q${index}`,
        itemTier: "tracked",
        subsectionKey: "experientialWarmup",
        content: {
          question: question.question,
          cues: question.cues || [],
          responseCapture: question.responseCapture || DEFAULT_RESPONSE_CAPTURE,
        },
      });
    });

    return items;
  }

  const postLesson = payload?.postLesson || {};
  const items = [];

  if (postLesson.transferablePatterns) {
    items.push({
      itemKey: "transferablePatterns",
      itemTier: "reference",
      subsectionKey: "transferablePatterns",
      content: {
        prompt: postLesson.transferablePatterns.prompt,
        patterns: safeJsonParse(postLesson.transferablePatterns.content, {}).patterns || [],
      },
    });
  }

  const storyAnchorQuestions = safeJsonParse(postLesson.storyAnchorQuestions?.content, {}).questions || [];
  storyAnchorQuestions.forEach((question, index) => {
    items.push({
      itemKey: `storyAnchorQuestions.q${index}`,
      itemTier: "scored",
      subsectionKey: "storyAnchorQuestions",
      format: question.format,
      correctAnswer: question.answer,
      content: {
        anchorSentence: question.anchorSentence,
        format: question.format,
        question: question.question,
        options: question.options || [],
      },
    });
  });

  return items;
};

export const gradeScoredItem = async (item, studentAnswer) => {
  const { format } = item;

  if (format === "reorder") {
    const expected = parseReorderSequence(item.correctAnswer);
    let submitted;
    try {
      submitted = JSON.parse(studentAnswer);
    } catch {
      submitted = null;
    }
    const isCorrect =
      Array.isArray(submitted) &&
      submitted.length === expected.length &&
      submitted.every((value, index) => normalizeAnswer(value) === normalizeAnswer(expected[index]));
    return { isCorrect, aiFeedback: null };
  }

  if (FREE_TEXT_FORMATS.has(format)) {
    const aiGrading = await gradeFreeTextAnswerWithAi({
      question: item.content.question,
      correctAnswer: item.correctAnswer,
      acceptableAnswers: [],
      studentAnswer,
      includeIssues: true,
    });
    if (aiGrading) {
      return { isCorrect: aiGrading.isCorrect, aiFeedback: aiGrading.feedback, aiFeedbackIssues: aiGrading.issues || [] };
    }
    return { isCorrect: normalizeAnswer(studentAnswer) === normalizeAnswer(item.correctAnswer), aiFeedback: null };
  }

  // avsAssessmentRow, mcq, true_false: closed-option, exact match. assertion_reason
  // has no `options` field in the source JSON (just one canonical verdict
  // sentence) -- the client builds the fixed 4-option CBSE verdict set itself,
  // so this still just needs an exact match against that same sentence.
  return { isCorrect: normalizeAnswer(studentAnswer) === normalizeAnswer(item.correctAnswer), aiFeedback: null };
};

// Sensory/Experiential Warm-Up have no single correct answer -- qualitative,
// formative feedback only, same spirit as microActivityService.js's
// buildMicroActivityFeedback but framed for a short pre-reading reflection
// rather than a hands-on activity tied to one concept.
const buildReflectionFeedback = async ({ prompt, studentAnswer }) => {
  if (!studentAnswer?.trim()) return { feedback: null, issues: [] };
  try {
    const { parsed } = await createStructuredCompletion({
      systemPrompt:
        "You are an encouraging teacher responding to a student's short reflection before/after reading a " +
        "story. There is no single correct answer -- respond warmly but specifically to what they actually " +
        "wrote, in 1-2 sentences. Return only valid JSON matching the schema.",
      userPrompt:
        `Reflection prompt: ${prompt || ""}\nStudent's response: ${studentAnswer}\n\n${ISSUES_PROMPT_INSTRUCTION}` +
        `\n\nSchema:\n{ "feedback": ""${ISSUES_SCHEMA_FRAGMENT} }`,
      responseFormatName: "pre_warmup_reflection_feedback",
    });
    const feedback = typeof parsed?.feedback === "string" ? parsed.feedback.trim() : "";
    return {
      feedback: feedback || null,
      issues: normalizeAiTextIssues(parsed?.issues, studentAnswer),
    };
  } catch {
    return { feedback: null, issues: [] };
  }
};

// Transferable Patterns' "write 3 sentences using this pattern" exercise --
// one AI call grades all 3 together (cheaper/faster than 3 separate calls,
// and lets the model compare them for variety). Always returns exactly 3
// results, defensively padding/truncating a malformed response so the caller
// never has to special-case a short array.
const gradePatternExercise = async ({ pattern, meaning, responses }) => {
  const fallback = responses.map(() => ({ isCorrect: null, feedback: null }));
  if (!responses.some((text) => text?.trim())) {
    return fallback;
  }

  try {
    const numberedResponses = responses
      .map((text, index) => `${index + 1}. ${text?.trim() || "(left blank)"}`)
      .join("\n");
    const { parsed } = await createStructuredCompletion({
      systemPrompt:
        "You are a fair, encouraging English teacher. A student was shown a grammatical pattern and asked to " +
        "write their own example sentences using it correctly. Judge each sentence independently -- is the " +
        "pattern used correctly (grammatically, and with the right meaning)? Return only valid JSON matching " +
        "the schema.",
      userPrompt: `Pattern: ${pattern}\nMeaning: ${meaning || "(not specified)"}\n\nStudent's sentences:\n${numberedResponses}\n\nSchema:\n{ "results": [ { "isCorrect": true or false, "feedback": "1 short sentence addressed to the student" } ] }\n(exactly ${responses.length} entries in "results", same order as the sentences above)`,
      responseFormatName: "pre_warmup_pattern_exercise",
    });

    const results = Array.isArray(parsed?.results) ? parsed.results : [];
    return responses.map((_, index) => {
      const result = results[index];
      return {
        isCorrect: typeof result?.isCorrect === "boolean" ? result.isCorrect : null,
        feedback: typeof result?.feedback === "string" && result.feedback.trim() ? result.feedback.trim() : null,
      };
    });
  } catch {
    return fallback;
  }
};

const patternResponseRowsToMap = (rows) =>
  Object.fromEntries(rows.map((row) => [row.pattern_key, row.responses]));

export const submitPatternExercise = async ({ attemptId, patternKey, pattern, meaning, responses, userId }) => {
  const attemptResult = await pool.query(
    "SELECT id, user_id, status FROM pre_warmup_attempt WHERE id = $1",
    [attemptId]
  );
  const attempt = attemptResult.rows[0];
  if (!attempt || String(attempt.user_id) !== String(userId)) {
    return null;
  }
  if (attempt.status !== "in_progress") {
    const error = new Error("This activity has already been submitted.");
    error.statusCode = 409;
    throw error;
  }

  const cleanResponses = (Array.isArray(responses) ? responses : []).slice(0, 3).map((text) => String(text || ""));
  while (cleanResponses.length < 3) cleanResponses.push("");

  const results = await gradePatternExercise({ pattern, meaning, responses: cleanResponses });
  const savedResponses = cleanResponses.map((text, index) => ({
    text,
    isCorrect: results[index].isCorrect,
    feedback: results[index].feedback,
  }));

  await pool.query(
    `INSERT INTO pre_warmup_pattern_response (pre_warmup_attempt_id, pattern_key, responses, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (pre_warmup_attempt_id, pattern_key)
     DO UPDATE SET responses = EXCLUDED.responses, updated_at = NOW()`,
    [attemptId, patternKey, JSON.stringify(savedResponses)]
  );

  return { responses: savedResponses };
};

const requirePhase = (phase) => {
  if (!PHASES.has(phase)) {
    const error = new Error('phase must be "preLessonWarmup" or "postLesson".');
    error.statusCode = 400;
    throw error;
  }
};

const loadItemsForAttempt = async (attempt) => {
  const content = await getPreWarmupContentForSection(attempt.source_section_id);
  return buildPhaseItems(content?.payload, attempt.phase);
};

export const startPreWarmupPhase = async ({ sourceSectionId, phase, userId, subsectionKey }) => {
  requirePhase(phase);

  const content = await getPreWarmupContentForSection(sourceSectionId);
  if (!content) {
    const error = new Error("No pre-warmup content exists for this section yet.");
    error.statusCode = 404;
    throw error;
  }

  const allItems = buildPhaseItems(content.payload, phase);
  if (!allItems.length) {
    const error = new Error("This section has no pre-warmup content for this phase yet.");
    error.statusCode = 404;
    throw error;
  }

  // Attempts/responses are always tracked at the whole-phase grain (unchanged
  // below) -- only the ITEMS actually sent back are scoped to one sub-section
  // when asked, so a learner opening e.g. "Story Anchor Questions" isn't also
  // downloading AVS Visual/Assessment's embedded image payloads.
  const items = subsectionKey ? allItems.filter((item) => item.subsectionKey === subsectionKey) : allItems;

  const existing = await pool.query(
    `SELECT id, status, score FROM pre_warmup_attempt
     WHERE user_id = $1 AND source_section_id = $2 AND phase = $3 AND status = 'in_progress'`,
    [userId, sourceSectionId, phase]
  );
  let attempt = existing.rows[0];
  if (!attempt) {
    const inserted = await pool.query(
      `INSERT INTO pre_warmup_attempt (user_id, source_section_id, phase)
       VALUES ($1, $2, $3)
       RETURNING id, status, score`,
      [userId, sourceSectionId, phase]
    );
    attempt = inserted.rows[0];
  }

  const responsesResult = await pool.query(
    `SELECT item_key, student_answer, is_correct, ai_feedback, ai_feedback_issues
     FROM pre_warmup_response
     WHERE pre_warmup_attempt_id = $1`,
    [attempt.id]
  );
  const responseByItemKey = new Map(responsesResult.rows.map((row) => [row.item_key, row]));

  // Only ever needed for transferablePatterns -- one query up front (rather
  // than N queries inside items.map) is cheap and simpler than special-casing.
  const patternResponsesResult = await pool.query(
    `SELECT pattern_key, responses FROM pre_warmup_pattern_response WHERE pre_warmup_attempt_id = $1`,
    [attempt.id]
  );
  const patternResponses = patternResponseRowsToMap(patternResponsesResult.rows);

  return {
    attemptId: attempt.id,
    phase,
    status: attempt.status,
    score: attempt.score !== null ? Number(attempt.score) : null,
    items: items.map((item) => {
      const response = responseByItemKey.get(item.itemKey);
      return {
        itemKey: item.itemKey,
        itemTier: item.itemTier,
        subsectionKey: item.subsectionKey,
        format: item.format || null,
        content:
          item.itemKey === "transferablePatterns" ? { ...item.content, patternResponses } : item.content,
        studentAnswer: response?.student_answer ?? null,
        isCorrect: response ? response.is_correct : null,
        aiFeedback: response?.ai_feedback ?? null,
        aiFeedbackIssues: response?.ai_feedback_issues ?? [],
      };
    }),
  };
};

// A learner now visits one sub-section at a time (see startPreWarmupPhase's
// subsectionKey filter) rather than walking the whole phase in one linear
// sitting, so there's no longer a single "last screen" to hang an explicit
// Submit button on. Instead, every answer checks whether it was the LAST
// unanswered item across the WHOLE phase (not just the current sub-section)
// and finalizes right there if so -- same scoring submitPreWarmupAttempt
// already does, just triggered automatically instead of on an explicit call.
const finalizeAttemptIfComplete = async ({ attemptId, phaseItems }) => {
  const responsesResult = await pool.query(
    `SELECT item_key, item_tier, is_correct FROM pre_warmup_response WHERE pre_warmup_attempt_id = $1`,
    [attemptId]
  );
  const responseByItemKey = new Map(responsesResult.rows.map((row) => [row.item_key, row]));
  const allAnswered = phaseItems.every((item) => responseByItemKey.has(item.itemKey));
  if (!allAnswered) {
    return false;
  }

  const scoredRows = responsesResult.rows.filter((row) => row.item_tier === "scored");
  const score = scoredRows.length
    ? Math.round((scoredRows.filter((row) => row.is_correct).length / scoredRows.length) * 10000) / 100
    : null;

  await pool.query(
    `UPDATE pre_warmup_attempt SET status = 'completed', submitted_at = NOW(), score = $1
     WHERE id = $2 AND status = 'in_progress'`,
    [score, attemptId]
  );
  return true;
};

export const submitPreWarmupAnswer = async ({ attemptId, itemKey, studentAnswer, timeTakenSeconds, userId }) => {
  const attemptResult = await pool.query(
    "SELECT id, user_id, source_section_id, phase, status FROM pre_warmup_attempt WHERE id = $1",
    [attemptId]
  );
  const attempt = attemptResult.rows[0];
  if (!attempt || String(attempt.user_id) !== String(userId)) {
    return null;
  }
  if (attempt.status !== "in_progress") {
    const error = new Error("This activity has already been submitted.");
    error.statusCode = 409;
    throw error;
  }

  const items = await loadItemsForAttempt(attempt);
  const item = items.find((candidate) => candidate.itemKey === itemKey);
  if (!item) {
    return null;
  }

  let isCorrect = null;
  let aiFeedback = null;
  let aiFeedbackIssues = [];

  if (item.itemTier === "scored") {
    const graded = await gradeScoredItem(item, studentAnswer);
    isCorrect = graded.isCorrect;
    aiFeedback = graded.aiFeedback;
    aiFeedbackIssues = graded.aiFeedbackIssues ?? [];
  } else if (item.itemTier === "tracked") {
    const reflection = await buildReflectionFeedback({
      prompt: item.content.question || item.content.responsePrompt,
      studentAnswer,
    });
    aiFeedback = reflection.feedback;
    aiFeedbackIssues = reflection.issues ?? [];
  }

  await pool.query(
    `INSERT INTO pre_warmup_response
       (pre_warmup_attempt_id, item_key, item_tier, student_answer, is_correct, ai_feedback, ai_feedback_issues, time_taken_seconds)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (pre_warmup_attempt_id, item_key)
     DO UPDATE SET
       student_answer = EXCLUDED.student_answer,
       is_correct = EXCLUDED.is_correct,
       ai_feedback = EXCLUDED.ai_feedback,
       ai_feedback_issues = EXCLUDED.ai_feedback_issues,
       time_taken_seconds = EXCLUDED.time_taken_seconds`,
    [
      attemptId,
      itemKey,
      item.itemTier,
      studentAnswer,
      isCorrect,
      aiFeedback,
      JSON.stringify(aiFeedbackIssues),
      Number(timeTakenSeconds || 0),
    ]
  );

  const phaseCompleted = await finalizeAttemptIfComplete({ attemptId, phaseItems: items });

  return {
    isCorrect,
    correctAnswer: item.itemTier === "scored" ? item.correctAnswer : null,
    aiFeedback,
    aiFeedbackIssues,
    phaseCompleted,
  };
};

export const submitPreWarmupAttempt = async ({ attemptId, userId }) => {
  const attemptResult = await pool.query(
    "SELECT id, user_id, status FROM pre_warmup_attempt WHERE id = $1",
    [attemptId]
  );
  const attempt = attemptResult.rows[0];
  if (!attempt || String(attempt.user_id) !== String(userId)) {
    return null;
  }

  if (attempt.status === "in_progress") {
    const scoredResult = await pool.query(
      `SELECT is_correct FROM pre_warmup_response WHERE pre_warmup_attempt_id = $1 AND item_tier = 'scored'`,
      [attemptId]
    );
    const scoredRows = scoredResult.rows;
    const score = scoredRows.length
      ? Math.round((scoredRows.filter((row) => row.is_correct).length / scoredRows.length) * 10000) / 100
      : null;

    await pool.query(
      "UPDATE pre_warmup_attempt SET status = 'completed', submitted_at = NOW(), score = $1 WHERE id = $2",
      [score, attemptId]
    );
  }

  return getPreWarmupResult({ attemptId, userId });
};

export const getPreWarmupResult = async ({ attemptId, userId }) => {
  const attemptResult = await pool.query(
    `SELECT id, user_id, phase, status, started_at, submitted_at, score
     FROM pre_warmup_attempt WHERE id = $1`,
    [attemptId]
  );
  const attempt = attemptResult.rows[0];
  if (!attempt || String(attempt.user_id) !== String(userId)) {
    return null;
  }

  const responsesResult = await pool.query(
    `SELECT item_key, item_tier, student_answer, is_correct, ai_feedback
     FROM pre_warmup_response WHERE pre_warmup_attempt_id = $1`,
    [attemptId]
  );

  const scored = responsesResult.rows.filter((row) => row.item_tier === "scored");
  const correctCount = scored.filter((row) => row.is_correct).length;

  return {
    attemptId: attempt.id,
    phase: attempt.phase,
    status: attempt.status,
    startedAt: attempt.started_at,
    submittedAt: attempt.submitted_at,
    score: attempt.score !== null ? Number(attempt.score) : null,
    scoredCount: scored.length,
    correctCount,
    incorrectCount: scored.length - correctCount,
    items: responsesResult.rows.map((row) => ({
      itemKey: row.item_key,
      itemTier: row.item_tier,
      studentAnswer: row.student_answer,
      isCorrect: row.is_correct,
      aiFeedback: row.ai_feedback,
    })),
  };
};

// Deletes rather than marks "abandoned" (unlike student_attempt) -- an
// in-progress pre_warmup_attempt never had a meaningful partial result worth
// keeping around, and ON DELETE CASCADE takes its responses with it.
export const restartPreWarmupAttempt = async ({ sourceSectionId, phase, userId }) => {
  requirePhase(phase);
  await pool.query(
    `DELETE FROM pre_warmup_attempt
     WHERE user_id = $1 AND source_section_id = $2 AND phase = $3 AND status = 'in_progress'`,
    [userId, sourceSectionId, phase]
  );
  return startPreWarmupPhase({ sourceSectionId, phase, userId });
};

// ---------------------------------------------------------------------------
// "HOTS (n)" -- chapter-wide combined quiz shuffling every section's Story
// Anchor Questions into one continuous attempt (StudentChapterDetailPage.jsx's
// row below Question Bank). Mirrors materializePracticeSetForChapter/
// startOrResumeChapterAssessment's shuffle-on-create/recover-order-on-resume
// pattern (studentPracticeService.js), but far simpler: there's no shared
// question_bank_item layer to sync, since content is always re-derived live
// from pre_warmup_content per section, same anti-tamper posture as the rest
// of this file. gradeScoredItem is reused completely unchanged -- it's
// already section-agnostic, only the fetch/assembly here is chapter-wide.
// ---------------------------------------------------------------------------

const shuffleInPlace = (array) => {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

export const collectChapterHotsItems = async ({ board, studentClass, subject, chapterNumber, userId }) => {
  const { sections } = await listSectionsForChapter({ board, studentClass, subject, chapterNumber, userId });
  const sourceSectionIds = sections.map((section) => section.sourceSectionId).filter(Boolean);

  const items = [];
  for (const sourceSectionId of sourceSectionIds) {
    const content = await getPreWarmupContentForSection(sourceSectionId);
    if (!content) continue;
    const sectionItems = buildPhaseItems(content.payload, "postLesson").filter(
      (item) => item.subsectionKey === "storyAnchorQuestions"
    );
    sectionItems.forEach((item) => items.push({ ...item, sourceSectionId }));
  }

  return { items };
};

// Read-only -- never writes to hots_attempt/hots_response, same discipline as
// getChapterAssessmentPreview.
export const getChapterHotsPreview = async ({ board, studentClass, subject, chapterNumber, userId }) => {
  const { items } = await collectChapterHotsItems({ board, studentClass, subject, chapterNumber, userId });
  const sectionCount = new Set(items.map((item) => item.sourceSectionId)).size;
  return { sectionCount, questionCount: items.length };
};

export const startOrResumeChapterHots = async ({ board, studentClass, subject, chapterNumber, userId }) => {
  const fkMstBookId = await resolveBookIdForChapter({ board, studentClass, subject, chapterNumber });
  if (!fkMstBookId) {
    const error = new Error("Chapter not found.");
    error.statusCode = 404;
    throw error;
  }
  const chapterKey = `chapter:${fkMstBookId}:${chapterNumber}`;

  const { items: currentItems } = await collectChapterHotsItems({ board, studentClass, subject, chapterNumber, userId });
  if (!currentItems.length) {
    const error = new Error("This chapter has no Story Anchor Questions yet.");
    error.statusCode = 404;
    throw error;
  }
  const itemsByKey = new Map(currentItems.map((item) => [`${item.sourceSectionId}:${item.itemKey}`, item]));

  const existingAttemptResult = await pool.query(
    `SELECT id, status, score FROM hots_attempt WHERE user_id = $1 AND chapter_key = $2 AND status = 'in_progress'`,
    [userId, chapterKey]
  );
  let attempt = existingAttemptResult.rows[0];
  let responseRows;

  if (attempt) {
    const existingResponses = await pool.query(
      `SELECT source_section_id, item_key, display_order, student_answer, is_correct, ai_feedback, ai_feedback_issues
       FROM hots_response WHERE hots_attempt_id = $1 ORDER BY display_order ASC`,
      [attempt.id]
    );
    responseRows = existingResponses.rows;
  } else {
    const shuffled = shuffleInPlace([...currentItems]);
    const inserted = await pool.query(
      `INSERT INTO hots_attempt (user_id, chapter_key) VALUES ($1, $2) RETURNING id, status, score`,
      [userId, chapterKey]
    );
    attempt = inserted.rows[0];

    await pool.query(
      `INSERT INTO hots_response (hots_attempt_id, source_section_id, item_key, display_order)
       SELECT $1, unnest($2::bigint[]), unnest($3::text[]), unnest($4::int[])`,
      [
        attempt.id,
        shuffled.map((item) => item.sourceSectionId),
        shuffled.map((item) => item.itemKey),
        shuffled.map((_, index) => index),
      ]
    );
    responseRows = shuffled.map((item, index) => ({
      source_section_id: item.sourceSectionId,
      item_key: item.itemKey,
      display_order: index,
      student_answer: null,
      is_correct: null,
      ai_feedback: null,
      ai_feedback_issues: null,
    }));
  }

  return {
    attemptId: attempt.id,
    status: attempt.status,
    score: attempt.score !== null ? Number(attempt.score) : null,
    items: responseRows.map((row) => {
      const item = itemsByKey.get(`${row.source_section_id}:${row.item_key}`);
      return {
        itemKey: row.item_key,
        sourceSectionId: row.source_section_id,
        displayOrder: row.display_order,
        format: item?.format || null,
        content: item?.content || null,
        studentAnswer: row.student_answer,
        isCorrect: row.is_correct,
        aiFeedback: row.ai_feedback,
        aiFeedbackIssues: row.ai_feedback_issues || [],
      };
    }),
  };
};

export const submitHotsAnswer = async ({ attemptId, displayOrder, studentAnswer, timeTakenSeconds, userId }) => {
  const attemptResult = await pool.query("SELECT id, user_id, status FROM hots_attempt WHERE id = $1", [attemptId]);
  const attempt = attemptResult.rows[0];
  if (!attempt || String(attempt.user_id) !== String(userId)) {
    return null;
  }
  if (attempt.status !== "in_progress") {
    const error = new Error("This quiz has already been submitted.");
    error.statusCode = 409;
    throw error;
  }

  const responseResult = await pool.query(
    `SELECT id, source_section_id, item_key FROM hots_response WHERE hots_attempt_id = $1 AND display_order = $2`,
    [attemptId, displayOrder]
  );
  const responseRow = responseResult.rows[0];
  if (!responseRow) {
    return null;
  }

  const content = await getPreWarmupContentForSection(responseRow.source_section_id);
  const sectionItems = buildPhaseItems(content?.payload, "postLesson");
  const item = sectionItems.find((candidate) => candidate.itemKey === responseRow.item_key);
  if (!item) {
    const error = new Error("This question is no longer available.");
    error.statusCode = 404;
    throw error;
  }

  const graded = await gradeScoredItem(item, studentAnswer);
  const aiFeedbackIssues = graded.aiFeedbackIssues ?? [];

  await pool.query(
    `UPDATE hots_response
     SET student_answer = $1, is_correct = $2, ai_feedback = $3, ai_feedback_issues = $4, time_taken_seconds = $5
     WHERE id = $6`,
    [
      studentAnswer,
      graded.isCorrect,
      graded.aiFeedback,
      JSON.stringify(aiFeedbackIssues),
      Number(timeTakenSeconds || 0),
      responseRow.id,
    ]
  );

  const remainingResult = await pool.query(
    `SELECT id FROM hots_response WHERE hots_attempt_id = $1 AND student_answer IS NULL`,
    [attemptId]
  );

  let phaseCompleted = false;
  if (remainingResult.rows.length === 0) {
    const scoredResult = await pool.query(`SELECT is_correct FROM hots_response WHERE hots_attempt_id = $1`, [
      attemptId,
    ]);
    const scoredRows = scoredResult.rows;
    const score = scoredRows.length
      ? Math.round((scoredRows.filter((row) => row.is_correct).length / scoredRows.length) * 10000) / 100
      : null;
    await pool.query(
      `UPDATE hots_attempt SET status = 'completed', submitted_at = NOW(), score = $1 WHERE id = $2 AND status = 'in_progress'`,
      [score, attemptId]
    );
    phaseCompleted = true;
  }

  return {
    isCorrect: graded.isCorrect,
    correctAnswer: item.correctAnswer,
    aiFeedback: graded.aiFeedback,
    aiFeedbackIssues,
    phaseCompleted,
  };
};
