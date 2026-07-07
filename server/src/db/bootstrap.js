import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import { pool } from "./pool.js";
import {
  extractOptionText,
  resolveItemCorrectAnswerText,
  resolveItemQuestionText,
} from "../services/assessmentStudioPersistence.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const defaultUsers = [
  {
    name: "Default Student",
    email: "student@example.com",
    password: "password123",
    role: "student",
  },
  {
    name: "Default Admin",
    email: "admin@example.com",
    password: "admin12345",
    role: "admin",
  },
];

const seedDefaultUsers = async () => {
  for (const user of defaultUsers) {
    const passwordHash = await bcrypt.hash(user.password, 10);

    await pool.query(
      `
        INSERT INTO users (name, email, password_hash, provider, role)
        VALUES ($1, $2, $3, 'local', $4)
        ON CONFLICT (email) DO UPDATE
        SET name = EXCLUDED.name,
            password_hash = EXCLUDED.password_hash,
            provider = EXCLUDED.provider,
            role = EXCLUDED.role,
            updated_at = NOW()
      `,
      [user.name, user.email, passwordHash, user.role]
    );
  }
};

const refreshMaterializedViews = async () => {
  const materializedViews = [
    "mv_book_catalog",
    "mv_chapter_catalog",
    "mv_book_chapter_summary",
  ];

  for (const viewName of materializedViews) {
    await pool.query(`REFRESH MATERIALIZED VIEW ${viewName}`);
  }
};

const pruneRedundantAssessmentStudioSchema = async () => {
  const cleanupStatements = [
    "DROP TABLE IF EXISTS layer3_capability_opportunity CASCADE",
    "DROP TABLE IF EXISTS layer3_capability_dependency CASCADE",
    "DROP TABLE IF EXISTS layer3_capability_dimension CASCADE",
    "DROP TABLE IF EXISTS layer3_assessment_capability CASCADE",
    "DROP TABLE IF EXISTS layer4_strategy_generator_constraint CASCADE",
    "DROP TABLE IF EXISTS layer4_strategy_remediation CASCADE",
    "DROP TABLE IF EXISTS layer4_strategy_recommendation CASCADE",
    "DROP TABLE IF EXISTS layer4_assessment_strategy CASCADE",
    "DROP TABLE IF EXISTS layer5_blueprint_recommended_after_failure CASCADE",
    "DROP TABLE IF EXISTS layer5_blueprint_concept_dependency CASCADE",
    "DROP TABLE IF EXISTS layer5_blueprint_secondary_concept CASCADE",
    "DROP TABLE IF EXISTS layer7_learning_analytics CASCADE",
    "DROP TABLE IF EXISTS layer7_adaptive_next_action CASCADE",
    "DROP TABLE IF EXISTS layer7_performance_summary CASCADE",
    "DROP TABLE IF EXISTS layer7_parent_note CASCADE",
    "DROP TABLE IF EXISTS layer7_teacher_note CASCADE",
    "DROP TABLE IF EXISTS layer7_revision_note CASCADE",
    "DROP TABLE IF EXISTS layer7_memory_reinforcement_retrieval_cue CASCADE",
    "DROP TABLE IF EXISTS layer7_memory_reinforcement CASCADE",
    "ALTER TABLE IF EXISTS layer5_item_blueprint DROP COLUMN IF EXISTS primary_concept",
    "ALTER TABLE IF EXISTS layer5_item_blueprint DROP COLUMN IF EXISTS assessment_dimension",
    "ALTER TABLE IF EXISTS layer5_item_blueprint DROP COLUMN IF EXISTS learning_objective",
    "ALTER TABLE IF EXISTS layer5_item_blueprint DROP COLUMN IF EXISTS partial_credit",
    "ALTER TABLE IF EXISTS layer5_item_blueprint DROP COLUMN IF EXISTS distractor_strategy",
    "ALTER TABLE IF EXISTS layer5_item_blueprint DROP COLUMN IF EXISTS adaptive_json",
    "ALTER TABLE IF EXISTS layer5_item_blueprint DROP COLUMN IF EXISTS assessment_notes",
  ];

  for (const sql of cleanupStatements) {
    await pool.query(sql);
  }
};

// Populates layer_generation_version for generations that predate the versioning
// feature, so pre-existing pipeline data gets a version history for free. Only
// touches (assessment_unit_id, layer_number) groups that have no rows yet, and
// only marks a selection when none exists, so it never overrides an explicit
// choice the user already made via the "set as default" action.
const backfillLayerGenerationVersions = async () => {
  await pool.query(`
    INSERT INTO layer_generation_version (
      assessment_unit_id, layer_number, generation_id, pipeline_job_id,
      version_number, is_selected, token_input, token_output, created_by, created_at
    )
    SELECT
      lr.assessment_unit_id,
      lr.layer_number,
      lr.generation_id,
      lr.pipeline_job_id,
      ROW_NUMBER() OVER (
        PARTITION BY lr.assessment_unit_id, lr.layer_number
        ORDER BY gr.created_at ASC, gr.id ASC
      ) AS version_number,
      FALSE,
      COALESCE(arl.token_input, 0),
      COALESCE(arl.token_output, 0),
      lr.created_by,
      gr.created_at
    FROM layer_run lr
    INNER JOIN generation_registry gr ON gr.generation_id = lr.generation_id
    LEFT JOIN assessment_pipeline_run_layer arl ON arl.generation_id = lr.generation_id
    WHERE lr.assessment_unit_id IS NOT NULL
      AND lr.layer_number BETWEEN 2 AND 7
      AND gr.status = 'completed'
    ON CONFLICT (generation_id) DO NOTHING
  `);

  await pool.query(`
    UPDATE layer_generation_version v
    SET is_selected = TRUE
    FROM (
      SELECT DISTINCT ON (assessment_unit_id, layer_number) id
      FROM layer_generation_version
      ORDER BY assessment_unit_id, layer_number, version_number DESC
    ) latest
    WHERE v.id = latest.id
      AND NOT EXISTS (
        SELECT 1
        FROM layer_generation_version selected
        WHERE selected.assessment_unit_id = v.assessment_unit_id
          AND selected.layer_number = v.layer_number
          AND selected.is_selected = TRUE
      )
  `);
};

// Repairs layer6_assessment_item rows persisted before persistLayer6Items
// learned to read the model's actual field names (it emitted "prompt"/
// "correct_option_id"/"question_text" in different generations rather than the
// "question"/"correct_answer" fields the persistence code originally read
// verbatim, leaving question blank and correct_answer/options empty). The raw
// model JSON is still available in layer6_assessment_item_contract, so this
// re-derives question/correct_answer/options from it using the same resolvers
// persistLayer6Items now uses going forward. Idempotent: only touches rows
// that still look unfixed.
const backfillLayer6QuestionText = async () => {
  const affectedGenerationsResult = await pool.query(`
    SELECT DISTINCT generation_id
    FROM layer6_assessment_item
    WHERE COALESCE(question, '') = ''
       OR correct_answer IS NULL
       OR correct_answer ~ '^[(]?[A-Da-d][)]?[.]?$'
  `);

  for (const { generation_id: generationId } of affectedGenerationsResult.rows) {
    const contractResult = await pool.query(
      "SELECT contract_json FROM layer6_assessment_item_contract WHERE generation_id = $1",
      [generationId]
    );
    const assessmentItems = contractResult.rows[0]?.contract_json?.assessment_items || [];
    if (!assessmentItems.length) {
      continue;
    }

    // Some generations' items carry no recognizable id field at all (neither
    // item_id nor itemId), so id-based matching silently misses them. Rows for
    // a generation are inserted in assessment_items array order (persistLayer6Items
    // iterates the array with toArray(...).entries()), so falling back to
    // positional (array-index) correlation covers that case too.
    const rowsResult = await pool.query(
      "SELECT id, item_id FROM layer6_assessment_item WHERE generation_id = $1 ORDER BY id ASC",
      [generationId]
    );

    const rawItemsById = new Map(
      assessmentItems
        .filter((item) => item?.item_id || item?.itemId)
        .map((item) => [item.item_id || item.itemId, item])
    );

    for (const [index, row] of rowsResult.rows.entries()) {
      const rawItem = rawItemsById.get(row.item_id) || assessmentItems[index];
      if (!rawItem) {
        continue;
      }

      const question = resolveItemQuestionText(rawItem);
      const correctAnswer = resolveItemCorrectAnswerText(rawItem);
      const optionTexts = (Array.isArray(rawItem?.options) ? rawItem.options : [])
        .map(extractOptionText)
        .filter(Boolean);

      await pool.query(
        "UPDATE layer6_assessment_item SET question = $1, correct_answer = $2 WHERE id = $3",
        [question, correctAnswer, row.id]
      );

      if (optionTexts.length) {
        await pool.query(
          "DELETE FROM layer6_assessment_item_option WHERE layer6_assessment_item_id = $1",
          [row.id]
        );
        for (const [optionIndex, optionText] of optionTexts.entries()) {
          await pool.query(
            `
              INSERT INTO layer6_assessment_item_option (generation_id, layer6_assessment_item_id, option_text, display_order)
              VALUES ($1, $2, $3, $4)
            `,
            [generationId, row.id, optionText, optionIndex]
          );
        }
      }
    }
  }
};

// Some generations repeat the correct answer as a second, redundant option
// (e.g. options: ["Dog", "Cat", "Rat", "Dog"]), which persistLayer6Items now
// dedupes going forward -- this repairs rows already persisted before that
// fix. Idempotent: re-running finds nothing once every item's options are
// unique per (item, normalized text).
const backfillDuplicateLayer6Options = async () => {
  await pool.query(`
    WITH ranked AS (
      SELECT id,
             ROW_NUMBER() OVER (
               PARTITION BY layer6_assessment_item_id, lower(trim(option_text))
               ORDER BY display_order ASC, id ASC
             ) AS rn
      FROM layer6_assessment_item_option
    )
    DELETE FROM layer6_assessment_item_option
    WHERE id IN (SELECT id FROM ranked WHERE rn > 1)
  `);

  await pool.query(`
    WITH renumbered AS (
      SELECT id,
             ROW_NUMBER() OVER (
               PARTITION BY layer6_assessment_item_id
               ORDER BY display_order ASC, id ASC
             ) - 1 AS new_order
      FROM layer6_assessment_item_option
    )
    UPDATE layer6_assessment_item_option o
    SET display_order = r.new_order
    FROM renumbered r
    WHERE o.id = r.id AND o.display_order <> r.new_order
  `);
};

// Layer 6 previously had no schema for interaction_type/interaction_data (see
// assessmentStudioService.js's Layer 6 buildUserPrompt/validateContract), so
// existing "reorder these items" questions were persisted as plain
// single_select-shaped rows: options = the items to arrange, correct_answer =
// the full correct order joined with "; ". They render as N separate radio
// buttons (pick exactly one) and can never be scored correctly (a single
// selected option can't match a multi-term joined string). This detects and
// repairs them retroactively using two independent signals:
//  1. question phrasing that asks for a reorder/arrangement/sequence, and
//  2. correct_answer splitting into a BIJECTION with the item's options (same
//     count, every part matches exactly one option, none left over) --
//     this is what separates a genuine full-reorder item from a multi-select
//     MCQ whose correct_answer can also be "; "-joined (from an array-typed
//     correct_answer_index/correct_option_id) but only covers a SUBSET of
//     the options.
// No "matching" backfill: interaction_data has been empty on every existing
// row, so there is no prior pairs-shaped data anywhere to reconstruct from --
// matching only exists for generations made under the new Layer 6 schema.
// Idempotent: only touches rows not already marked interaction_type='ordering'.
const ORDERING_QUESTION_PATTERN =
  /\b(reorder|re-order|rearrange|arrange|sequence|order)\b.{0,40}\b(from|in|these|the following)\b/i;

const backfillLayer6OrderingItems = async () => {
  const candidatesResult = await pool.query(`
    SELECT item.id, item.question, item.correct_answer,
           array_agg(opt.option_text ORDER BY opt.display_order) AS option_texts
    FROM layer6_assessment_item item
    INNER JOIN layer6_assessment_item_option opt
      ON opt.layer6_assessment_item_id = item.id
    WHERE COALESCE(item.interaction_type, '') <> 'ordering'
      AND item.correct_answer LIKE '%; %'
    GROUP BY item.id, item.question, item.correct_answer
  `);

  for (const row of candidatesResult.rows) {
    if (!ORDERING_QUESTION_PATTERN.test(row.question || "")) {
      continue;
    }

    const options = (row.option_texts || []).filter(Boolean);
    const correctParts = String(row.correct_answer || "")
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean);

    if (correctParts.length < 3 || correctParts.length !== options.length) {
      continue;
    }

    const optionByNormalizedText = new Map(options.map((option) => [option.trim().toLowerCase(), option]));
    const resolvedSequence = correctParts.map((part) => optionByNormalizedText.get(part.toLowerCase()));

    const isBijection =
      resolvedSequence.every(Boolean) && new Set(resolvedSequence).size === options.length;
    if (!isBijection) {
      continue;
    }

    await pool.query(
      `
        UPDATE layer6_assessment_item
        SET interaction_type = 'ordering',
            interaction_data = $2::jsonb
        WHERE id = $1
      `,
      [row.id, JSON.stringify({ sequence: resolvedSequence })]
    );
  }
};

// student_mastery previously only got written when a full attempt was
// submitted (see studentPracticeService.js's submitAssessment), never after
// an individual answer -- so any student who answered questions without ever
// clicking "Submit" on a full attempt has real student_response history but
// zero rows in student_mastery, making progress views (chapter overview,
// dashboard) read a permanent, honest-looking 0% that never moves. Answers
// now update mastery live (studentPracticeService.js's submitAnswer calls the
// same recompute-and-upsert logic), but this repairs the pre-existing gap
// for responses recorded before that change. Idempotent: recomputes the same
// probability from the same response history every time it runs.
const backfillStudentMasteryFromResponseHistory = async () => {
  await pool.query(`
    INSERT INTO student_mastery (
      user_id, assessment_unit_id, mastery_level, mastery_probability, last_generation_id, updated_at
    )
    SELECT
      sa.user_id,
      sr.assessment_unit_id,
      CASE
        WHEN AVG(CASE WHEN sr.is_correct THEN 1.0 ELSE 0.0 END) >= 0.8 THEN 'Mastered'
        WHEN AVG(CASE WHEN sr.is_correct THEN 1.0 ELSE 0.0 END) >= 0.5 THEN 'Developing'
        ELSE 'Needs Practice'
      END,
      AVG(CASE WHEN sr.is_correct THEN 1.0 ELSE 0.0 END),
      (ARRAY_AGG(sr.generation_id ORDER BY sr.created_at DESC))[1],
      NOW()
    FROM student_response sr
    INNER JOIN student_attempt sa ON sa.id = sr.student_attempt_id
    WHERE sr.assessment_unit_id IS NOT NULL
    GROUP BY sa.user_id, sr.assessment_unit_id
    ON CONFLICT (user_id, assessment_unit_id) DO UPDATE
    SET mastery_level = EXCLUDED.mastery_level,
        mastery_probability = EXCLUDED.mastery_probability,
        last_generation_id = EXCLUDED.last_generation_id,
        updated_at = NOW()
  `);
};

const buildStartupSafeSql = (sql) =>
  sql
    .replace(/^DROP TABLE IF EXISTS .+?;\s*$/gim, "")
    .replace(/^DROP MATERIALIZED VIEW IF EXISTS .+?;\s*$/gim, "")
    .replace(/^CREATE UNIQUE INDEX\s+(?!IF NOT EXISTS\s+)/gim, "CREATE UNIQUE INDEX IF NOT EXISTS ")
    .replace(/^CREATE INDEX\s+(?!IF NOT EXISTS\s+)/gim, "CREATE INDEX IF NOT EXISTS ")
    .replace(
      /^CREATE MATERIALIZED VIEW\s+([a-zA-Z0-9_]+)\s+AS/gim,
      "CREATE MATERIALIZED VIEW IF NOT EXISTS $1 AS"
    );

export const initializeDatabase = async ({ reset = false } = {}) => {
  const rawInitSql = await fs.readFile(path.join(__dirname, "init.sql"), "utf8");
  const initSql = reset ? rawInitSql : buildStartupSafeSql(rawInitSql);
  const dbFiles = await fs.readdir(__dirname);
  const seedFiles = dbFiles
    .filter((file) => file.startsWith("seed_") && file.endsWith(".sql"))
    .sort();

  await pool.query(initSql);
  await pruneRedundantAssessmentStudioSchema();
  await backfillLayerGenerationVersions();
  await backfillLayer6QuestionText();
  await backfillDuplicateLayer6Options();
  await backfillLayer6OrderingItems();
  await backfillStudentMasteryFromResponseHistory();

  for (const file of seedFiles) {
    const sql = await fs.readFile(path.join(__dirname, file), "utf8");
    await pool.query(sql);
  }

  await refreshMaterializedViews();
  await seedDefaultUsers();
};
