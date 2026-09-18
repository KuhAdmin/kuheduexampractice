// TestLab: a student-filtered, freshly-randomized 20-question set mixing
// Question Bank (content_assessment_item, via collectAnswerableChapterItems)
// and HOTS story-anchor questions (via collectChapterHotsItems) together in
// one attempt. Both source types are heterogeneous in shape, so every picked
// item is normalized once here and then fully snapshotted into
// test_lab_attempt_item.question_snapshot -- see init.sql's comment on that
// table for why (same anti-drift reasoning as question_bank_item/hots_attempt).
import { pool } from "../db/pool.js";
import { gradeFreeTextAnswerWithAi, isAnswerCorrect, collectAnswerableChapterItems } from "./studentPracticeService.js";
import { collectChapterHotsItems, gradeScoredItem } from "./studentPreWarmupService.js";
import { resolveDashboardAcademicFilters } from "./catalogService.js";
import { getChaptersForClassSubjectSelection } from "./studentDashboardService.js";

// Reverse of resolveDashboardAcademicFilters's board/subject lookups -- goes
// from an already-chosen (examGoalCode, subjectCode) pair (the class/subject
// SWITCHER's selection, see ClassSubjectContext.jsx) back to the free-text
// board/subject strings collectAnswerableChapterItems/collectChapterHotsItems
// require (they ultimately call listSectionsForChapter, which re-derives
// codes from free text itself -- there's no codes-based entry point into that
// chain today, so this round-trip is the smallest change that adds it).
// levelCode needs no lookup: resolveDashboardAcademicFilters sets it to
// `String(studentClass)` directly with no DB step, so it's already the value
// collectAnswerableChapterItems calls studentClass.
const resolveBoardAndSubjectFromCodes = async ({ examGoalCode, subjectCode }) => {
  const [examGoalResult, subjectResult] = await Promise.all([
    pool.query("SELECT board_code FROM mst_exam_goal WHERE goal_id = $1 AND is_active = TRUE LIMIT 1", [examGoalCode]),
    pool.query("SELECT name FROM mst_subject WHERE name_code = $1 AND is_active = TRUE LIMIT 1", [subjectCode]),
  ]);
  return {
    board: examGoalResult.rows[0]?.board_code || null,
    subject: subjectResult.rows[0]?.name || null,
  };
};

const QUESTION_SET_SIZE = 20;
const MINIMUM_POOL_SIZE = 5;
const MAX_QUESTION_SET_SIZE = 50;

// Clamps the student's "Number of Questions" choice (StudentTestLabPage.jsx's
// 10/20/30/50 buttons) to a sane positive integer, falling back to the
// existing default when omitted or garbage -- keeps this endpoint safe even
// if a caller sends something outside that fixed button set.
const resolveQuestionSetSize = (questionCount) => {
  const parsed = Number(questionCount);
  if (!Number.isFinite(parsed) || parsed <= 0) return QUESTION_SET_SIZE;
  return Math.min(Math.floor(parsed), MAX_QUESTION_SET_SIZE);
};

const INTERACTION_TYPE_OPTIONS = [
  { value: "single_select", label: "Multiple Choice" },
  { value: "free_text", label: "Short Answer" },
  { value: "ordering", label: "Ordering" },
  { value: "matching", label: "Matching" },
];

// Mirrors FREE_TEXT_FORMATS in studentPreWarmupService.js -- kept as a
// separate copy here rather than importing it since it isn't exported, and
// this mapping is TestLab-specific (translating a HOTS "format" into the
// same interaction-type vocabulary the Question Types filter already uses).
const HOTS_FREE_TEXT_FORMATS = new Set(["fill_in_blank", "short_answer", "hots_infer", "hots_predict", "hots_recall"]);

const toArray = (value) => (Array.isArray(value) ? value : []);

const resolveQbInteractionType = (item) =>
  item.interaction_type || (toArray(item.options).length > 0 ? "single_select" : "free_text");

const resolveHotsInteractionType = (format) => {
  if (format === "reorder") return "ordering";
  if (HOTS_FREE_TEXT_FORMATS.has(format)) return "free_text";
  return "single_select";
};

const shuffleInPlace = (array) => {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

// Resolves the (board, studentClass, subject, examGoalCode, levelCode,
// subjectCode) sextuple TestLab needs everywhere, from either an explicit
// class/subject-switcher selection (examGoalCode/levelCode/subjectCode, all
// three required -- see StudentTestLabPage.jsx reading useClassSubject())
// or, when none is given, the requesting user's own profile fields. The
// switcher path matters for accounts with no fixed profile at all (e.g. a
// superstudent with unrestricted "all" scope, whose board/studentClass/
// subject columns are genuinely NULL by design) -- without it, TestLab would
// be permanently unusable for exactly the accounts meant to browse freely.
const resolveAcademicContext = async ({ userId, board, studentClass, subject, examGoalCode, levelCode, subjectCode }) => {
  if (examGoalCode && levelCode && subjectCode) {
    const resolved = await resolveBoardAndSubjectFromCodes({ examGoalCode, subjectCode });
    if (!resolved.board || !resolved.subject) {
      console.error("[testLabService] resolveAcademicContext: switcher codes didn't resolve", {
        userId,
        examGoalCode,
        levelCode,
        subjectCode,
        resolved,
      });
      const error = new Error("That class/subject selection isn't available -- pick a different one.");
      error.statusCode = 400;
      throw error;
    }
    return { examGoalCode, levelCode, subjectCode, board: resolved.board, studentClass: levelCode, subject: resolved.subject };
  }

  const filters = await resolveDashboardAcademicFilters({ board, studentClass, subject });
  if (!filters.isValid) {
    // Logged so a real "profile isn't set up" report can actually be
    // diagnosed -- this string alone doesn't say whether board/studentClass/
    // subject were empty, or non-empty but didn't match any active
    // mst_exam_goal/mst_subject row.
    console.error("[testLabService] resolveAcademicContext failed to resolve a valid combo", {
      userId,
      board,
      studentClass,
      subject,
      resolvedExamGoalCode: filters.examGoalCode || null,
      resolvedLevelCode: filters.levelCode || null,
      resolvedSubjectCode: filters.subjectCode || null,
    });
    const error = new Error("Your class/subject profile isn't set up yet -- update your profile to use TestLab.");
    error.statusCode = 400;
    throw error;
  }
  return { ...filters, board, studentClass, subject };
};

export const getTestLabFilterOptions = async ({ userId, board, studentClass, subject, examGoalCode, levelCode, subjectCode }) => {
  const resolved = await resolveAcademicContext({ userId, board, studentClass, subject, examGoalCode, levelCode, subjectCode });
  const { chapters } = await getChaptersForClassSubjectSelection({
    userId,
    examGoalCode: resolved.examGoalCode,
    levelCode: resolved.levelCode,
    subjectCode: resolved.subjectCode,
  });

  // Question Types shown on StudentTestLabPage.jsx must reflect what this
  // board/class/subject's content actually has, not the full fixed
  // vocabulary -- a subject with no ordering/matching items would otherwise
  // show checkboxes that can never affect a Generate Test result. Scans the
  // same unfiltered pool startTestLabAttempt would build (across every
  // chapter, not just ones the student ends up selecting -- that filter is a
  // sibling control, not a prerequisite) and keeps only the types it found.
  const chapterNumbers = chapters.map((chapter) => String(chapter.chapterNumber));
  const questionPool = await buildTestLabQuestionPool({
    board: resolved.board,
    studentClass: resolved.studentClass,
    subject: resolved.subject,
    chapterNumbers,
    interactionTypes: [],
    userId,
  });
  const presentTypes = new Set(questionPool.map((item) => item.interactionType));
  const interactionTypes = INTERACTION_TYPE_OPTIONS.filter((option) => presentTypes.has(option.value));

  return { chapters, interactionTypes };
};

// Pulls every answerable Question Bank item and every HOTS story-anchor item
// across the selected chapters, normalizes both into one common shape, and
// filters by the selected answer-format types (if any). HOTS items whose
// format doesn't match a selected type are naturally excluded here too --
// e.g. filtering to "Multiple Choice only" drops HOTS' typically free-text
// questions, which is expected (see the plan's Question Types decision).
const buildTestLabQuestionPool = async ({ board, studentClass, subject, chapterNumbers, interactionTypes, userId }) => {
  const typeFilter = toArray(interactionTypes);
  const questionPool = [];

  for (const chapterNumber of chapterNumbers) {
    const [{ items: qbItems }, { items: hotsItems }] = await Promise.all([
      collectAnswerableChapterItems({ board, studentClass, subject, chapterNumber, userId }),
      collectChapterHotsItems({ board, studentClass, subject, chapterNumber, userId }),
    ]);

    qbItems.forEach((item) => {
      const interactionType = resolveQbInteractionType(item);
      if (typeFilter.length && !typeFilter.includes(interactionType)) return;
      questionPool.push({
        sourceType: "question_bank",
        sourceItemId: item.item_id,
        assessmentUnitId: item.assessment_unit_id,
        chapterNumber: String(chapterNumber),
        question: item.question,
        options: toArray(item.options),
        correctAnswer: item.correct_answer,
        interactionType,
        interactionData: item.interaction_data || {},
        acceptableAnswers: toArray(item.acceptable_answers),
        marks: Number(item.marks || 0),
        estimatedTimeSeconds: Number(item.estimated_time_seconds || 0),
      });
    });

    hotsItems
      .filter((item) => item.itemTier === "scored")
      .forEach((item) => {
        const interactionType = resolveHotsInteractionType(item.format);
        if (typeFilter.length && !typeFilter.includes(interactionType)) return;
        questionPool.push({
          sourceType: "hots",
          sourceItemId: `${item.sourceSectionId}:${item.itemKey}`,
          assessmentUnitId: null,
          chapterNumber: String(chapterNumber),
          question: item.content?.question,
          options: toArray(item.content?.options),
          correctAnswer: item.correctAnswer,
          interactionType,
          format: item.format,
          // Genuinely passage-like content, distinct from the question text
          // itself -- lets the Attempt Test screen show a real "Case-based"
          // passage box for HOTS story-anchor items instead of inventing a
          // topic classification (see plan: no `"case_based"` format value
          // exists anywhere, so this is the one honest signal available).
          passage: item.content?.anchorSentence || null,
          marks: 1,
          estimatedTimeSeconds: 60,
        });
      });
  }

  return questionPool;
};

const buildClientSafeItem = (row) => ({
  displayOrder: row.display_order,
  sourceType: row.source_type,
  chapterNumber: row.chapter_number,
  question: row.question_snapshot?.question,
  options: row.question_snapshot?.options || [],
  interactionType: row.question_snapshot?.interactionType,
  marks: row.question_snapshot?.marks,
  passage: row.question_snapshot?.passage || null,
  studentAnswer: row.student_answer ?? null,
  isCorrect: row.is_correct ?? null,
  isMarkedForReview: Boolean(row.is_marked_for_review),
  // correctAnswer / interactionData / acceptableAnswers deliberately excluded
  // -- server-side grading only, same discipline as the section/chapter
  // assessment flow's buildStudentSafeInteractionData.
});

export const startTestLabAttempt = async ({
  userId,
  board,
  studentClass,
  subject,
  examGoalCode,
  levelCode,
  subjectCode,
  chapterNumbers,
  interactionTypes,
  questionCount,
}) => {
  const cleanChapterNumbers = toArray(chapterNumbers).map(String).filter(Boolean);
  if (!cleanChapterNumbers.length) {
    const error = new Error("Select at least one chapter to start a TestLab set.");
    error.statusCode = 400;
    throw error;
  }

  const resolved = await resolveAcademicContext({ userId, board, studentClass, subject, examGoalCode, levelCode, subjectCode });

  const questionPool = await buildTestLabQuestionPool({
    board: resolved.board,
    studentClass: resolved.studentClass,
    subject: resolved.subject,
    chapterNumbers: cleanChapterNumbers,
    interactionTypes,
    userId,
  });

  if (questionPool.length < MINIMUM_POOL_SIZE) {
    const error = new Error("Not enough questions match these filters yet -- try selecting more chapters or types.");
    error.statusCode = 422;
    throw error;
  }

  const setSize = resolveQuestionSetSize(questionCount);
  const sampled = shuffleInPlace([...questionPool]).slice(0, Math.min(setSize, questionPool.length));

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const attemptInsert = await client.query(
      `
        INSERT INTO test_lab_attempt (user_id, chapter_numbers, interaction_types)
        VALUES ($1, $2, $3)
        RETURNING id, status
      `,
      [userId, JSON.stringify(cleanChapterNumbers), JSON.stringify(toArray(interactionTypes))]
    );
    const attempt = attemptInsert.rows[0];

    const rows = [];
    for (const [index, item] of sampled.entries()) {
      const snapshot = {
        question: item.question,
        options: item.options,
        correctAnswer: item.correctAnswer,
        interactionType: item.interactionType,
        interactionData: item.interactionData || {},
        acceptableAnswers: item.acceptableAnswers || [],
        format: item.format || null,
        passage: item.passage || null,
        marks: item.marks,
      };
      const inserted = await client.query(
        `
          INSERT INTO test_lab_attempt_item
            (test_lab_attempt_id, display_order, source_type, source_item_id, assessment_unit_id, chapter_number, question_snapshot)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING display_order, source_type, chapter_number
        `,
        [
          attempt.id,
          index,
          item.sourceType,
          String(item.sourceItemId),
          item.assessmentUnitId,
          item.chapterNumber,
          JSON.stringify(snapshot),
        ]
      );
      rows.push({
        ...inserted.rows[0],
        question_snapshot: snapshot,
        student_answer: null,
        is_correct: null,
        is_marked_for_review: false,
      });
    }

    await client.query("COMMIT");

    return {
      attemptId: attempt.id,
      status: attempt.status,
      totalCount: rows.length,
      items: rows.map(buildClientSafeItem),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const getTestLabAttempt = async ({ attemptId, userId }) => {
  const attemptResult = await pool.query(
    "SELECT id, status, started_at FROM test_lab_attempt WHERE id = $1 AND user_id = $2",
    [attemptId, userId]
  );
  const attempt = attemptResult.rows[0];
  if (!attempt) return null;

  const itemsResult = await pool.query(
    `
      SELECT display_order, source_type, chapter_number, question_snapshot, student_answer, is_correct, is_marked_for_review
      FROM test_lab_attempt_item
      WHERE test_lab_attempt_id = $1
      ORDER BY display_order ASC
    `,
    [attemptId]
  );

  return {
    attemptId: attempt.id,
    status: attempt.status,
    // The Attempt Test screen's elapsed-time stopwatch (StudentTestLabSessionPage.jsx)
    // seeds itself from this on every load/refresh, rather than from the
    // moment the page happened to mount -- TestLab has no time-limit/duration
    // concept to count down against, so this is real time-spent, not a guess.
    startedAt: attempt.started_at,
    totalCount: itemsResult.rows.length,
    items: itemsResult.rows.map(buildClientSafeItem),
  };
};

const gradeTestLabItem = async ({ sourceType, question, correctAnswer, interactionType, interactionData, acceptableAnswers, format }, studentAnswer) => {
  if (sourceType === "hots") {
    const graded = await gradeScoredItem({ format, correctAnswer, content: { question } }, studentAnswer);
    return { isCorrect: graded.isCorrect, aiFeedback: graded.aiFeedback || null };
  }

  if (interactionType === "free_text") {
    const aiGrading = await gradeFreeTextAnswerWithAi({
      question,
      correctAnswer,
      acceptableAnswers: acceptableAnswers || [],
      studentAnswer,
    });
    if (aiGrading) {
      return { isCorrect: aiGrading.isCorrect, aiFeedback: aiGrading.feedback };
    }
  }

  return {
    isCorrect: isAnswerCorrect({
      interactionType,
      correctAnswer,
      interactionData: interactionData || {},
      acceptableAnswers: acceptableAnswers || [],
      studentAnswer,
    }),
    aiFeedback: null,
  };
};

export const submitTestLabAnswer = async ({ attemptId, displayOrder, studentAnswer, timeTakenSeconds, userId }) => {
  const attemptResult = await pool.query(
    "SELECT id, user_id, status FROM test_lab_attempt WHERE id = $1",
    [attemptId]
  );
  const attempt = attemptResult.rows[0];
  if (!attempt || String(attempt.user_id) !== String(userId)) {
    return null;
  }
  if (attempt.status !== "in_progress") {
    const error = new Error("This TestLab set has already been submitted.");
    error.statusCode = 409;
    throw error;
  }

  const itemResult = await pool.query(
    `
      SELECT id, source_type, question_snapshot
      FROM test_lab_attempt_item
      WHERE test_lab_attempt_id = $1 AND display_order = $2
    `,
    [attemptId, displayOrder]
  );
  const item = itemResult.rows[0];
  if (!item) return null;

  const snapshot = item.question_snapshot;
  const graded = await gradeTestLabItem({ sourceType: item.source_type, ...snapshot }, studentAnswer);

  await pool.query(
    `
      UPDATE test_lab_attempt_item
      SET student_answer = $1, is_correct = $2, marks_awarded = $3, ai_feedback = $4, time_taken_seconds = $5
      WHERE id = $6
    `,
    [
      studentAnswer,
      graded.isCorrect,
      graded.isCorrect ? Number(snapshot.marks || 0) : 0,
      graded.aiFeedback,
      Number(timeTakenSeconds || 0),
      item.id,
    ]
  );

  return {
    isCorrect: graded.isCorrect,
    correctAnswer: snapshot.correctAnswer,
    explanation: graded.aiFeedback || null,
  };
};

// "Mark for Review" toggle on StudentTestLabSessionPage.jsx -- independent of
// answering (a question can be marked with or without a saved answer), so it
// gets its own small update rather than piggybacking on submitTestLabAnswer.
export const setTestLabItemReviewFlag = async ({ attemptId, displayOrder, userId, markedForReview }) => {
  const attemptResult = await pool.query(
    "SELECT id, user_id, status FROM test_lab_attempt WHERE id = $1",
    [attemptId]
  );
  const attempt = attemptResult.rows[0];
  if (!attempt || String(attempt.user_id) !== String(userId)) {
    return null;
  }
  if (attempt.status !== "in_progress") {
    const error = new Error("This TestLab set has already been submitted.");
    error.statusCode = 409;
    throw error;
  }

  const result = await pool.query(
    `
      UPDATE test_lab_attempt_item
      SET is_marked_for_review = $1
      WHERE test_lab_attempt_id = $2 AND display_order = $3
      RETURNING display_order, is_marked_for_review
    `,
    [Boolean(markedForReview), attemptId, displayOrder]
  );
  const updated = result.rows[0];
  if (!updated) return null;

  return { displayOrder: updated.display_order, isMarkedForReview: updated.is_marked_for_review };
};

const INTERACTION_TYPE_LABEL_BY_VALUE = Object.fromEntries(
  INTERACTION_TYPE_OPTIONS.map((option) => [option.value, option.label])
);

// Report-card-only label map -- SOURCE_TYPE_LABEL already exists client-side
// (StudentTestLabResultPage.jsx) for the same two values; this copy is just
// for building the summary sentence below, server-side.
const REPORT_SOURCE_TYPE_LABEL = { question_bank: "Question Bank", hots: "HOTS" };

// A single, real-data-backed sentence for the report card's quote box (no AI
// call -- see the plan: templated from the attempt's own score tier plus
// whichever source-type/question-type bucket actually performed best or
// worst, never a fabricated topic/chapter name).
const buildResultSummary = ({ scorePercent, sourceTypeBreakdown, interactionTypeBreakdown }) => {
  const candidates = [
    ...sourceTypeBreakdown
      .filter((bucket) => bucket.total > 0)
      .map((bucket) => ({
        label: REPORT_SOURCE_TYPE_LABEL[bucket.sourceType],
        percentage: Math.round((bucket.correct / bucket.total) * 100),
      })),
    ...interactionTypeBreakdown
      .filter((bucket) => bucket.total > 0)
      .map((bucket) => ({ label: bucket.label, percentage: bucket.percentage })),
  ];

  if (scorePercent >= 80) {
    const best = candidates.reduce((max, candidate) => (!max || candidate.percentage > max.percentage ? candidate : max), null);
    return best
      ? `Great job! You performed especially well on ${best.label} questions.`
      : "Great job! You showed strong understanding across the board.";
  }

  const weakest = candidates.reduce((min, candidate) => (!min || candidate.percentage < min.percentage ? candidate : min), null);
  if (scorePercent >= 50) {
    return weakest
      ? `Good effort! A bit more practice on ${weakest.label} questions will help.`
      : "Good effort! Keep practicing to build on this.";
  }

  return weakest
    ? `Keep practicing! ${weakest.label} questions need the most attention right now.`
    : "Keep practicing! Review the topics below and try again.";
};

export const getTestLabAttemptResult = async ({ attemptId, userId }) => {
  const attemptResult = await pool.query(
    `
      SELECT id, status, started_at, submitted_at, score, correct_count, incorrect_count, unattempted_count
      FROM test_lab_attempt
      WHERE id = $1 AND user_id = $2
    `,
    [attemptId, userId]
  );
  const attempt = attemptResult.rows[0];
  if (!attempt) return null;

  const itemsResult = await pool.query(
    `
      SELECT display_order, source_type, chapter_number, question_snapshot, student_answer, is_correct, ai_feedback
      FROM test_lab_attempt_item
      WHERE test_lab_attempt_id = $1
      ORDER BY display_order ASC
    `,
    [attemptId]
  );

  const bySourceType = {
    question_bank: { sourceType: "question_bank", total: 0, correct: 0 },
    hots: { sourceType: "hots", total: 0, correct: 0 },
  };
  const byChapter = new Map();
  const byInteractionType = new Map();

  itemsResult.rows.forEach((row) => {
    const bucket = bySourceType[row.source_type];
    if (bucket) {
      bucket.total += 1;
      if (row.is_correct) bucket.correct += 1;
    }

    const chapterBucket = byChapter.get(row.chapter_number) || {
      chapterNumber: row.chapter_number,
      total: 0,
      correct: 0,
    };
    chapterBucket.total += 1;
    if (row.is_correct) chapterBucket.correct += 1;
    byChapter.set(row.chapter_number, chapterBucket);

    const interactionType = row.question_snapshot?.interactionType || "single_select";
    const interactionBucket = byInteractionType.get(interactionType) || {
      interactionType,
      label: INTERACTION_TYPE_LABEL_BY_VALUE[interactionType] || interactionType,
      total: 0,
      correct: 0,
    };
    interactionBucket.total += 1;
    if (row.is_correct) interactionBucket.correct += 1;
    byInteractionType.set(interactionType, interactionBucket);
  });

  const sourceTypeBreakdown = [bySourceType.question_bank, bySourceType.hots];
  const interactionTypeBreakdown = Array.from(byInteractionType.values()).map((entry) => ({
    ...entry,
    percentage: entry.total ? Math.round((entry.correct / entry.total) * 100) : 0,
  }));
  const score = attempt.score !== null ? Number(attempt.score) : null;

  return {
    attemptId: attempt.id,
    status: attempt.status,
    startedAt: attempt.started_at,
    submittedAt: attempt.submitted_at,
    // Real wall-clock time spent on the whole attempt (start to submit) --
    // TestLab has no per-attempt duration/time-limit field to fall back on,
    // so this is the one honest "time taken" figure available.
    timeTakenSeconds:
      attempt.submitted_at && attempt.started_at
        ? Math.round((new Date(attempt.submitted_at).getTime() - new Date(attempt.started_at).getTime()) / 1000)
        : null,
    score,
    correctCount: attempt.correct_count,
    incorrectCount: attempt.incorrect_count,
    unattemptedCount: attempt.unattempted_count,
    totalCount: itemsResult.rows.length,
    sourceTypeBreakdown,
    chapterBreakdown: Array.from(byChapter.values()).map((entry) => ({
      ...entry,
      percentage: entry.total ? Math.round((entry.correct / entry.total) * 100) : 0,
    })),
    interactionTypeBreakdown,
    summary: buildResultSummary({ scorePercent: score || 0, sourceTypeBreakdown, interactionTypeBreakdown }),
    items: itemsResult.rows.map((row) => ({
      displayOrder: row.display_order,
      sourceType: row.source_type,
      chapterNumber: row.chapter_number,
      question: row.question_snapshot?.question,
      options: row.question_snapshot?.options || [],
      interactionType: row.question_snapshot?.interactionType,
      correctAnswer: row.question_snapshot?.correctAnswer,
      studentAnswer: row.student_answer,
      isCorrect: row.is_correct,
      aiFeedback: row.ai_feedback,
    })),
  };
};

export const submitTestLabAttempt = async ({ attemptId, userId }) => {
  const attemptResult = await pool.query(
    "SELECT id, user_id, status FROM test_lab_attempt WHERE id = $1",
    [attemptId]
  );
  const attempt = attemptResult.rows[0];
  if (!attempt || String(attempt.user_id) !== String(userId)) {
    return null;
  }
  if (attempt.status === "completed") {
    return getTestLabAttemptResult({ attemptId, userId });
  }

  const itemsResult = await pool.query(
    `
      SELECT source_type, student_answer, is_correct, marks_awarded, question_snapshot
      FROM test_lab_attempt_item
      WHERE test_lab_attempt_id = $1
    `,
    [attemptId]
  );
  const items = itemsResult.rows;
  const correctCount = items.filter((row) => row.is_correct === true).length;
  const incorrectCount = items.filter((row) => row.student_answer !== null && row.is_correct === false).length;
  const unattemptedCount = items.filter((row) => row.student_answer === null).length;
  const totalMarks = items.reduce((sum, row) => sum + Number(row.question_snapshot?.marks || 0), 0);
  const earnedMarks = items.reduce((sum, row) => sum + Number(row.marks_awarded || 0), 0);
  const score = totalMarks > 0 ? Math.round((earnedMarks / totalMarks) * 100) : 0;

  await pool.query(
    `
      UPDATE test_lab_attempt
      SET status = 'completed', submitted_at = NOW(), score = $1, correct_count = $2, incorrect_count = $3, unattempted_count = $4
      WHERE id = $5
    `,
    [score, correctCount, incorrectCount, unattemptedCount, attemptId]
  );

  return getTestLabAttemptResult({ attemptId, userId });
};

export const listRecentTestLabAttempts = async ({ userId, limit = 10 }) => {
  const result = await pool.query(
    `
      SELECT id, chapter_numbers, interaction_types, status, started_at, submitted_at, score, correct_count, unattempted_count
      FROM test_lab_attempt
      WHERE user_id = $1
      ORDER BY started_at DESC
      LIMIT $2
    `,
    [userId, limit]
  );

  return {
    attempts: result.rows.map((row) => ({
      attemptId: row.id,
      chapterNumbers: row.chapter_numbers,
      interactionTypes: row.interaction_types,
      status: row.status,
      startedAt: row.started_at,
      submittedAt: row.submitted_at,
      score: row.score !== null ? Number(row.score) : null,
      correctCount: row.correct_count,
      unattemptedCount: row.unattempted_count,
    })),
  };
};
