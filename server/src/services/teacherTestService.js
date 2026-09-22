// Teacher paper generation, reusing the exact same content pipeline
// TestLab's student flow uses (collectAnswerableChapterItems/
// collectChapterHotsItems/getChaptersForClassSubjectSelection), scoped to a
// batch's resolved board/class/subject instead of a student profile. Adds
// two selection modes on top of TestLab's existing pure-random one (marks
// target, difficulty mix), and a parallel chapter-scoped path for
// teacher-authored custom questions, which the existing pipeline can't see
// (it is keyed entirely off assessment_unit_id, which custom questions don't
// have -- see content_assessment_item's fk_mst_chapter_id column).
import { pool } from "../db/pool.js";
import { collectAnswerableChapterItems } from "./studentPracticeService.js";
import { collectChapterHotsItems } from "./studentPreWarmupService.js";
import { getChaptersForClassSubjectSelection } from "./studentDashboardService.js";
import { assertTeacherOwnsBatch, resolveChapterId } from "./teacherContentContext.js";
import { createStructuredCompletion } from "./openAiService.js";

const toArray = (value) => (Array.isArray(value) ? value : []);

const shuffleInPlace = (array) => {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

const resolveQbInteractionType = (item) =>
  item.interaction_type || (toArray(item.options).length > 0 ? "single_select" : "free_text");
const resolveQbQuestionFamily = (item) => item.question_family || resolveQbInteractionType(item);

// A printed test paper needs a real answer key for every question.
// single_select/ordering/matching items already can't reach this pool without
// a correct_answer (collectAnswerableChapterItems filters those out
// upstream), so this only ever excludes free_text items with no answer on
// record -- and those get an AI-generated answer instead of being dropped,
// see fillMissingAnswersWithAi below. difficulty is left ungated entirely --
// it's rarely populated in the content bank, and gating on it would exclude
// nearly everything.
const isUsableCandidate = (item) =>
  item.interactionType === "free_text" || Boolean(String(item.correctAnswer || "").trim());

const REFERENCE_ANSWER_MODEL_ID = "deepseek-v4-flash";

const optionText = (option) => (typeof option === "string" ? option : option?.text || "");

const generateReferenceAnswerWithAi = async ({ question, options }) => {
  try {
    const optionsList = toArray(options);
    const optionsText = optionsList.length
      ? `\nOptions: ${optionsList
          .map((option, i) => `${String.fromCharCode(97 + i)}) ${optionText(option)}`)
          .join(" | ")}`
      : "";
    const userPrompt = `Question: ${question}${optionsText}

Provide the single correct answer to this question, exactly as it should appear on a teacher's answer key. Be concise -- just the answer text, no explanation.

Schema:
{
  "answer": "the correct answer text"
}`;
    const { parsed } = await createStructuredCompletion({
      systemPrompt:
        "You are an expert teacher preparing an answer key for a school test. Return only valid JSON that exactly matches the requested schema.",
      userPrompt,
      responseFormatName: "reference_answer",
      modelId: REFERENCE_ANSWER_MODEL_ID,
    });
    const answer = typeof parsed?.answer === "string" ? parsed.answer.trim() : "";
    return answer || null;
  } catch {
    return null;
  }
};

// Called once a question is actually selected onto a paper (generation or
// swap-in) -- not for every candidate in the pool, so a chapter's whole
// question bank never triggers AI calls just to build the filter-options
// list or a selection preview. Persists the generated answer back onto
// content_assessment_item so the next paper that pulls this same question
// finds correct_answer already filled in and skips the AI call entirely.
const fillMissingAnswersWithAi = async (items) => {
  for (const item of items) {
    if (item.interactionType !== "free_text" || String(item.correctAnswer || "").trim()) {
      continue;
    }
    const answer = await generateReferenceAnswerWithAi({ question: item.question, options: item.options });
    if (!answer) continue;
    item.correctAnswer = answer;
    if (item.contentAssessmentItemId) {
      await pool.query("UPDATE content_assessment_item SET correct_answer = $1 WHERE id = $2", [
        answer,
        item.contentAssessmentItemId,
      ]);
    }
  }
};

const CUSTOM_QUESTION_FAMILY_INTERACTION_TYPE = {
  mcq: "single_select",
  truefalse: "single_select",
  assertionreason: "single_select",
  shortanswer: "free_text",
  fillintheblank: "free_text",
};

const fetchCustomQuestionsForChapter = async ({ chapterId, requestingTeacherUserId }) => {
  if (!chapterId) return [];
  const result = await pool.query(
    `
      SELECT id, item_id, question, options, correct_answer, question_family, interaction_type,
             difficulty, marks, review_status, created_by_teacher_id
      FROM content_assessment_item
      WHERE fk_mst_chapter_id = $1
        AND created_by_teacher_id IS NOT NULL
        AND (review_status = 'approved' OR created_by_teacher_id = $2)
    `,
    [chapterId, requestingTeacherUserId]
  );
  return result.rows;
};

const buildRawQuestionPool = async ({ context, chapterNumbers, teacherUserId }) => {
  const items = [];

  for (const chapterNumber of chapterNumbers) {
    const [{ items: qbItems }, { items: hotsItems }, chapterId] = await Promise.all([
      collectAnswerableChapterItems({
        board: context.board,
        studentClass: context.studentClass,
        subject: context.subject,
        chapterNumber,
        userId: teacherUserId,
      }),
      collectChapterHotsItems({
        board: context.board,
        studentClass: context.studentClass,
        subject: context.subject,
        chapterNumber,
        userId: teacherUserId,
      }),
      resolveChapterId({
        chapterNumber,
        examGoalCode: context.examGoalCode,
        levelCode: context.levelCode,
        subjectCode: context.subjectCode,
      }),
    ]);

    qbItems.forEach((item) => {
      items.push({
        sourceType: "question_bank",
        sourceItemId: item.item_id,
        contentAssessmentItemId: item.id || null,
        chapterNumber: String(chapterNumber),
        question: item.question,
        options: toArray(item.options),
        correctAnswer: item.correct_answer,
        interactionType: resolveQbInteractionType(item),
        questionFamily: resolveQbQuestionFamily(item),
        difficulty: item.difficulty || null,
        marks: Number(item.marks || 1),
      });
    });

    hotsItems
      .filter((item) => item.itemTier === "scored")
      .forEach((item) => {
        items.push({
          sourceType: "hots",
          sourceItemId: `${item.sourceSectionId}:${item.itemKey}`,
          contentAssessmentItemId: null,
          chapterNumber: String(chapterNumber),
          question: item.content?.question,
          options: toArray(item.content?.options),
          correctAnswer: item.correctAnswer,
          interactionType: item.format === "reorder" ? "ordering" : "single_select",
          // format/passage are dropped nowhere else that matters today (only
          // buildRawQuestionPool consumers care), but a HOTS "reorder" item is
          // ungradable without `format` -- digital test-taking's grader
          // dispatches on it exactly like TestLab's gradeTestLabItem does.
          format: item.format || null,
          passage: item.content?.anchorSentence || null,
          questionFamily: "hots",
          difficulty: null,
          marks: 1,
        });
      });

    const customItems = await fetchCustomQuestionsForChapter({ chapterId, requestingTeacherUserId: teacherUserId });
    customItems.forEach((item) => {
      items.push({
        sourceType: "question_bank",
        sourceItemId: item.item_id,
        contentAssessmentItemId: item.id,
        chapterNumber: String(chapterNumber),
        question: item.question,
        options: toArray(item.options),
        correctAnswer: item.correct_answer,
        interactionType: item.interaction_type,
        questionFamily: item.question_family,
        difficulty: item.difficulty || null,
        marks: Number(item.marks || 1),
        reviewStatus: item.review_status,
        isCustom: true,
      });
    });
  }

  return items.filter(isUsableCandidate);
};

export const getTeacherTestFilterOptions = async ({ batchId, teacherUserId }) => {
  const context = await assertTeacherOwnsBatch(batchId, teacherUserId);
  if (!context.isContentConfigured) {
    return { chapters: [], questionFamilies: [], contentConfigured: false };
  }

  const { chapters } = await getChaptersForClassSubjectSelection({
    userId: teacherUserId,
    examGoalCode: context.examGoalCode,
    levelCode: context.levelCode,
    subjectCode: context.subjectCode,
  });
  const chapterNumbers = chapters.map((chapter) => String(chapter.chapterNumber));
  const pool_ = await buildRawQuestionPool({ context, chapterNumbers, teacherUserId });
  const families = Array.from(new Set(pool_.map((item) => item.questionFamily)));

  return { chapters, questionFamilies: families, contentConfigured: true };
};

const MINIMUM_POOL_SIZE = 3;
const DEFAULT_QUESTION_COUNT = 20;

const selectByMarksTarget = (candidatePool, targetMarks) => {
  const shuffled = shuffleInPlace([...candidatePool]);
  const selected = [];
  let sum = 0;
  for (const item of shuffled) {
    if (sum >= targetMarks) break;
    selected.push(item);
    sum += item.marks;
  }
  return selected;
};

const normalizeDifficultyBucket = (value) => {
  const text = String(value || "").toLowerCase();
  if (text.includes("easy") || text.includes("basic") || text.includes("simple")) return "easy";
  if (text.includes("hard") || text.includes("difficult") || text.includes("advanced")) return "hard";
  return "medium";
};

const selectByDifficultyMix = (candidatePool, distribution, questionCount) => {
  const buckets = { easy: [], medium: [], hard: [] };
  candidatePool.forEach((item) => buckets[normalizeDifficultyBucket(item.difficulty)].push(item));
  Object.values(buckets).forEach(shuffleInPlace);

  const selected = [];
  ["easy", "medium", "hard"].forEach((key) => {
    const percent = Number(distribution?.[key] || 0);
    const want = Math.round((percent / 100) * questionCount);
    selected.push(...buckets[key].slice(0, want));
  });

  if (selected.length < questionCount) {
    const usedIds = new Set(selected.map((item) => item.sourceItemId));
    const leftover = shuffleInPlace(candidatePool.filter((item) => !usedIds.has(item.sourceItemId)));
    selected.push(...leftover.slice(0, questionCount - selected.length));
  }
  return selected.slice(0, questionCount);
};

// "By Question Type" mode -- typeConfig is { [questionFamily]: { count, marks } }.
// The type's configured marks is authoritative for every question drawn into
// that family (overriding whatever marks the source question happened to
// carry), since the teacher is deliberately setting a per-type mark value.
// Families that can't fulfill their requested count are reported in
// `shortages` instead of silently under-filling the paper.
const selectByTypeConfig = (candidatePool, typeConfig) => {
  const selected = [];
  const shortages = [];
  for (const [family, config] of Object.entries(typeConfig || {})) {
    const count = Number(config?.count || 0);
    if (count <= 0) continue;
    const marksPerQuestion = Number(config?.marks) || 1;
    const familyPool = shuffleInPlace(candidatePool.filter((item) => item.questionFamily === family));
    if (familyPool.length < count) {
      shortages.push(`${family} (${familyPool.length} available, ${count} requested)`);
      continue;
    }
    familyPool.slice(0, count).forEach((item) => selected.push({ ...item, marks: marksPerQuestion }));
  }
  return { selected, shortages };
};

const mapPaperItemRow = (row) => ({
  id: row.id,
  displayOrder: row.display_order,
  ...row.question_snapshot,
  marks: Number(row.marks),
});

const mapPaper = (paper, itemRows) => ({
  id: paper.id,
  title: paper.title,
  batchId: paper.fk_batch_id,
  generationMode: paper.generation_mode,
  chapterNumbers: paper.chapter_numbers || [],
  questionFamilies: paper.question_families || [],
  targetTotalMarks: paper.target_total_marks,
  difficultyDistribution: paper.difficulty_distribution,
  status: paper.status,
  createdAt: paper.created_at,
  isOpenForStudents: paper.is_open_for_students,
  openedAt: paper.opened_at,
  dueAt: paper.due_at,
  items: itemRows.map(mapPaperItemRow),
  totalMarks: itemRows.reduce((sum, row) => sum + Number(row.marks), 0),
});

const getPaperOrThrow = async (paperId, teacherUserId) => {
  const paperResult = await pool.query("SELECT * FROM teacher_test_paper WHERE id = $1 AND fk_teacher_id = $2", [
    paperId,
    teacherUserId,
  ]);
  const paper = paperResult.rows[0];
  if (!paper) {
    const error = new Error("Test paper not found.");
    error.statusCode = 404;
    throw error;
  }
  return paper;
};

export const getTeacherTestPaper = async (paperId, teacherUserId) => {
  const paper = await getPaperOrThrow(paperId, teacherUserId);
  const itemsResult = await pool.query(
    "SELECT * FROM teacher_test_paper_item WHERE fk_teacher_test_paper_id = $1 ORDER BY display_order ASC",
    [paperId]
  );
  return mapPaper(paper, itemsResult.rows);
};

export const listTeacherTestPapers = async (teacherUserId) => {
  const result = await pool.query(
    `
      SELECT
        p.*,
        inst.name AS "institutionName",
        lvl.name AS "className",
        sec.name AS "sectionName",
        subj.name AS "subjectName",
        (SELECT COUNT(*) FROM teacher_test_paper_item i WHERE i.fk_teacher_test_paper_id = p.id) AS question_count,
        (SELECT COALESCE(SUM(i.marks), 0) FROM teacher_test_paper_item i WHERE i.fk_teacher_test_paper_id = p.id) AS total_marks
      FROM teacher_test_paper p
      LEFT JOIN batches b ON b.id = p.fk_batch_id
      LEFT JOIN teacher_class_assignment ta ON ta.id = b.fk_teacher_class_assignment_id
      LEFT JOIN institution_teacher it ON it.id = ta.fk_institution_teacher_id
      LEFT JOIN institutions inst ON inst.id = it.fk_institution_id
      LEFT JOIN institution_section sec ON sec.id = ta.fk_institution_section_id
      LEFT JOIN institution_class ic ON ic.id = sec.fk_institution_class_id
      LEFT JOIN mst_level lvl ON lvl.id = ic.fk_mst_level_id
      LEFT JOIN mst_subject subj ON subj.id = ta.fk_mst_subject_id
      WHERE p.fk_teacher_id = $1
      ORDER BY p.created_at DESC
    `,
    [teacherUserId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    status: row.status,
    institutionName: row.institutionName,
    className: row.className,
    sectionName: row.sectionName,
    subjectName: row.subjectName,
    questionCount: Number(row.question_count),
    totalMarks: Number(row.total_marks),
    createdAt: row.created_at,
    isOpenForStudents: row.is_open_for_students,
    dueAt: row.due_at,
  }));
};

const persistTeacherTestPaper = async ({
  teacherUserId,
  batchId,
  title,
  generationMode,
  chapters,
  questionFamilies,
  targetTotalMarks,
  difficultyDistribution,
  selected,
}) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const paperResult = await client.query(
      `
        INSERT INTO teacher_test_paper
          (fk_teacher_id, fk_batch_id, title, generation_mode, chapter_numbers, question_families, target_total_marks, difficulty_distribution)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `,
      [
        teacherUserId,
        batchId,
        title,
        generationMode,
        JSON.stringify(chapters),
        JSON.stringify(questionFamilies || []),
        targetTotalMarks || null,
        difficultyDistribution ? JSON.stringify(difficultyDistribution) : null,
      ]
    );
    const paper = paperResult.rows[0];

    let order = 1;
    for (const item of selected) {
      await client.query(
        `
          INSERT INTO teacher_test_paper_item (fk_teacher_test_paper_id, display_order, source_content_assessment_item_id, question_snapshot, marks)
          VALUES ($1, $2, $3, $4, $5)
        `,
        [paper.id, order, item.contentAssessmentItemId || null, JSON.stringify(item), item.marks]
      );
      order += 1;
    }

    await client.query("COMMIT");
    return paper.id;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const generateTeacherTestPaper = async ({
  teacherUserId,
  batchId,
  title,
  generationMode = "custom_mix",
  chapterNumbers,
  questionFamilies,
  questionCount,
  targetTotalMarks,
  difficultyDistribution,
  typeConfig,
}) => {
  const context = await assertTeacherOwnsBatch(batchId, teacherUserId);
  if (!context.isContentConfigured) {
    const error = new Error(
      "This institution has no curriculum board configured yet -- ask an admin to set it on the institution."
    );
    error.statusCode = 400;
    throw error;
  }

  const chapters = toArray(chapterNumbers).map(String);
  if (!chapters.length) {
    const error = new Error("Select at least one chapter.");
    error.statusCode = 400;
    throw error;
  }

  let candidatePool = await buildRawQuestionPool({ context, chapterNumbers: chapters, teacherUserId });
  const familyFilter = toArray(questionFamilies);
  if (familyFilter.length) {
    candidatePool = candidatePool.filter((item) => familyFilter.includes(item.questionFamily));
  }

  if (candidatePool.length < MINIMUM_POOL_SIZE) {
    const error = new Error("Not enough questions match these filters -- try more chapters or question types.");
    error.statusCode = 400;
    throw error;
  }

  let selected;
  if (generationMode === "type_mix") {
    const { selected: typeSelected, shortages } = selectByTypeConfig(candidatePool, typeConfig);
    if (shortages.length) {
      const error = new Error(`Not enough questions available: ${shortages.join(", ")}.`);
      error.statusCode = 400;
      throw error;
    }
    selected = typeSelected;
  } else if (generationMode === "marks_target") {
    selected = selectByMarksTarget(candidatePool, Number(targetTotalMarks) || 0);
  } else if (generationMode === "difficulty_mix") {
    selected = selectByDifficultyMix(candidatePool, difficultyDistribution, Number(questionCount) || DEFAULT_QUESTION_COUNT);
  } else {
    selected = shuffleInPlace([...candidatePool]).slice(0, Number(questionCount) || DEFAULT_QUESTION_COUNT);
  }

  if (!selected.length) {
    const error = new Error("No questions could be selected with these settings.");
    error.statusCode = 400;
    throw error;
  }

  await fillMissingAnswersWithAi(selected);

  // Every paper needs a real target to check individual marks overrides
  // against later (finalizeTeacherTestPaper) -- only marks_target mode sets
  // one explicitly, so the rest fall back to the total actually generated.
  const resolvedTargetTotalMarks = Number(targetTotalMarks) || selected.reduce((sum, item) => sum + item.marks, 0);

  const paperId = await persistTeacherTestPaper({
    teacherUserId,
    batchId,
    title: title || "Untitled Test",
    generationMode,
    chapters,
    questionFamilies: familyFilter,
    targetTotalMarks: resolvedTargetTotalMarks,
    difficultyDistribution,
    selected,
  });

  return getTeacherTestPaper(paperId, teacherUserId);
};

export const removeTeacherTestPaperItem = async (paperId, itemId, teacherUserId) => {
  const paper = await getPaperOrThrow(paperId, teacherUserId);
  if (paper.status !== "draft") {
    const error = new Error("Only a draft paper's questions can be changed.");
    error.statusCode = 400;
    throw error;
  }
  await pool.query("DELETE FROM teacher_test_paper_item WHERE id = $1 AND fk_teacher_test_paper_id = $2", [
    itemId,
    paperId,
  ]);
  return getTeacherTestPaper(paperId, teacherUserId);
};

export const swapTeacherTestPaperItem = async (paperId, itemId, teacherUserId) => {
  const paper = await getPaperOrThrow(paperId, teacherUserId);
  if (paper.status !== "draft") {
    const error = new Error("Only a draft paper's questions can be changed.");
    error.statusCode = 400;
    throw error;
  }

  const itemResult = await pool.query(
    "SELECT * FROM teacher_test_paper_item WHERE id = $1 AND fk_teacher_test_paper_id = $2",
    [itemId, paperId]
  );
  const currentItem = itemResult.rows[0];
  if (!currentItem) {
    const error = new Error("Question not found on this paper.");
    error.statusCode = 404;
    throw error;
  }

  const context = await assertTeacherOwnsBatch(paper.fk_batch_id, teacherUserId);
  const chapterNumber = currentItem.question_snapshot.chapterNumber;
  const candidatePool = await buildRawQuestionPool({ context, chapterNumbers: [chapterNumber], teacherUserId });

  const usedRowsResult = await pool.query(
    "SELECT question_snapshot->>'sourceItemId' AS sid FROM teacher_test_paper_item WHERE fk_teacher_test_paper_id = $1",
    [paperId]
  );
  const usedIds = new Set(usedRowsResult.rows.map((row) => row.sid));

  const sameFamily = shuffleInPlace(
    candidatePool.filter(
      (item) => item.questionFamily === currentItem.question_snapshot.questionFamily && !usedIds.has(item.sourceItemId)
    )
  );
  const anyAlternative = sameFamily.length
    ? sameFamily
    : shuffleInPlace(candidatePool.filter((item) => !usedIds.has(item.sourceItemId)));

  if (!anyAlternative.length) {
    const error = new Error("No alternative question is available for this chapter.");
    error.statusCode = 400;
    throw error;
  }

  const replacement = anyAlternative[0];
  await fillMissingAnswersWithAi([replacement]);
  await pool.query(
    "UPDATE teacher_test_paper_item SET question_snapshot = $1, marks = $2, source_content_assessment_item_id = $3 WHERE id = $4",
    [JSON.stringify(replacement), replacement.marks, replacement.contentAssessmentItemId || null, itemId]
  );

  return getTeacherTestPaper(paperId, teacherUserId);
};

export const updateTeacherTestPaperItemMarks = async (paperId, itemId, marks, teacherUserId) => {
  const paper = await getPaperOrThrow(paperId, teacherUserId);
  if (paper.status !== "draft") {
    const error = new Error("Only a draft paper's questions can be changed.");
    error.statusCode = 400;
    throw error;
  }

  const numericMarks = Number(marks);
  if (!Number.isFinite(numericMarks) || numericMarks <= 0) {
    const error = new Error("Marks must be a positive number.");
    error.statusCode = 400;
    throw error;
  }

  const result = await pool.query(
    `
      UPDATE teacher_test_paper_item
      SET marks = $1, question_snapshot = jsonb_set(question_snapshot, '{marks}', to_jsonb($1::numeric))
      WHERE id = $2 AND fk_teacher_test_paper_id = $3
      RETURNING id
    `,
    [numericMarks, itemId, paperId]
  );
  if (!result.rows[0]) {
    const error = new Error("Question not found on this paper.");
    error.statusCode = 404;
    throw error;
  }

  return getTeacherTestPaper(paperId, teacherUserId);
};

const roundTo2 = (value) => Math.round(Number(value || 0) * 100) / 100;

export const finalizeTeacherTestPaper = async (paperId, teacherUserId) => {
  const paper = await getTeacherTestPaper(paperId, teacherUserId);
  if (paper.targetTotalMarks != null && roundTo2(paper.targetTotalMarks) !== roundTo2(paper.totalMarks)) {
    const error = new Error(
      `Total marks (${paper.totalMarks}) must equal the target total marks (${paper.targetTotalMarks}) before finalizing.`
    );
    error.statusCode = 400;
    throw error;
  }

  const result = await pool.query(
    "UPDATE teacher_test_paper SET status = 'finalized' WHERE id = $1 AND fk_teacher_id = $2 RETURNING id",
    [paperId, teacherUserId]
  );
  if (!result.rows[0]) {
    const error = new Error("Test paper not found.");
    error.statusCode = 404;
    throw error;
  }
  return getTeacherTestPaper(paperId, teacherUserId);
};

// ---- Digital test-taking: opening a finalized paper for its batch's
// students to take online (see studentTestPaperService.js for the attempt
// flow this unlocks) ----

export const setTeacherTestPaperAssignment = async (paperId, teacherUserId, { isOpen, dueAt }) => {
  const paper = await getPaperOrThrow(paperId, teacherUserId);
  if (paper.status !== "finalized") {
    const error = new Error("Only a finalized paper can be assigned to students.");
    error.statusCode = 400;
    throw error;
  }

  const result = await pool.query(
    `
      UPDATE teacher_test_paper
      SET is_open_for_students = $1,
          opened_at = CASE WHEN $1 THEN COALESCE(opened_at, NOW()) ELSE NULL END,
          due_at = $2
      WHERE id = $3 AND fk_teacher_id = $4
      RETURNING id
    `,
    [Boolean(isOpen), dueAt || null, paperId, teacherUserId]
  );
  if (!result.rows[0]) {
    const error = new Error("Test paper not found.");
    error.statusCode = 404;
    throw error;
  }
  return getTeacherTestPaper(paperId, teacherUserId);
};

// Whitelists exactly what a student may see before/while attempting a
// digital test -- correctAnswer/interactionData/acceptableAnswers are
// deliberately excluded, same discipline as testLabService.js's
// buildClientSafeItem.
export const buildStudentSafeTestPaperItem = (row) => ({
  displayOrder: row.display_order,
  question: row.question_snapshot?.question,
  options: row.question_snapshot?.options || [],
  interactionType: row.question_snapshot?.interactionType,
  marks: row.question_snapshot?.marks,
  passage: row.question_snapshot?.passage || null,
  studentAnswer: row.student_answer ?? null,
  isCorrect: row.is_correct ?? null,
});

// ---- Teacher-authored custom questions (Decision #3: usable in the
// author's own paper immediately, joins the shared bank only once approved) ----

const CUSTOM_QUESTION_FAMILIES = Object.keys(CUSTOM_QUESTION_FAMILY_INTERACTION_TYPE);

export const authorCustomQuestion = async ({
  teacherUserId,
  batchId,
  chapterNumber,
  question,
  options,
  correctAnswer,
  questionFamily,
  difficulty,
  marks,
}) => {
  const context = await assertTeacherOwnsBatch(batchId, teacherUserId);
  if (!context.isContentConfigured) {
    const error = new Error("This institution has no curriculum board configured yet.");
    error.statusCode = 400;
    throw error;
  }
  if (!CUSTOM_QUESTION_FAMILIES.includes(questionFamily)) {
    const error = new Error(`questionFamily must be one of: ${CUSTOM_QUESTION_FAMILIES.join(", ")}.`);
    error.statusCode = 400;
    throw error;
  }
  if (!String(question || "").trim()) {
    const error = new Error("question is required.");
    error.statusCode = 400;
    throw error;
  }

  const chapterId = await resolveChapterId({
    chapterNumber,
    examGoalCode: context.examGoalCode,
    levelCode: context.levelCode,
    subjectCode: context.subjectCode,
  });
  if (!chapterId) {
    const error = new Error("That chapter isn't available for this class/subject.");
    error.statusCode = 400;
    throw error;
  }

  const itemId = `teacher-${teacherUserId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const interactionType = CUSTOM_QUESTION_FAMILY_INTERACTION_TYPE[questionFamily];

  const result = await pool.query(
    `
      INSERT INTO content_assessment_item
        (item_id, question_family, interaction_type, question, options, correct_answer, difficulty, marks,
         fk_mst_chapter_id, created_by_teacher_id, review_status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending')
      RETURNING *
    `,
    [
      itemId,
      questionFamily,
      interactionType,
      question.trim(),
      JSON.stringify(toArray(options)),
      correctAnswer || null,
      difficulty || null,
      Number(marks) || 1,
      chapterId,
      teacherUserId,
    ]
  );

  return mapCustomQuestionRow(result.rows[0]);
};

const mapCustomQuestionRow = (row) => ({
  id: row.id,
  itemId: row.item_id,
  question: row.question,
  questionFamily: row.question_family,
  difficulty: row.difficulty,
  marks: row.marks,
  reviewStatus: row.review_status,
  reviewNotes: row.review_notes,
  createdAt: row.created_at,
});

export const listMyCustomQuestions = async (teacherUserId) => {
  const result = await pool.query(
    `
      SELECT cai.*, mc.chapter_name AS "chapterName", mc.chapter_number AS "chapterNumber"
      FROM content_assessment_item cai
      LEFT JOIN mst_chapter mc ON mc.id = cai.fk_mst_chapter_id
      WHERE cai.created_by_teacher_id = $1
      ORDER BY cai.created_at DESC
    `,
    [teacherUserId]
  );
  return result.rows.map((row) => ({ ...mapCustomQuestionRow(row), chapterName: row.chapterName, chapterNumber: row.chapterNumber }));
};
