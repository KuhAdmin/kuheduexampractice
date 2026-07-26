import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import { pool } from "./pool.js";

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

// See the seven-layer pipeline removal: these DROP statements are what
// actually clean an already-running (non-reset) database, since
// buildStartupSafeSql() strips every DROP TABLE line out of init.sql in
// non-reset mode -- editing init.sql's own DROP block alone would only take
// effect on a full db:reset.
const pruneRedundantAssessmentStudioSchema = async () => {
  const cleanupStatements = [
    "DROP TABLE IF EXISTS assessment_pipeline_run_layer CASCADE",
    "DROP TABLE IF EXISTS assessment_pipeline_run CASCADE",
    "DROP TABLE IF EXISTS layer_contract_dependency CASCADE",
    "DROP TABLE IF EXISTS layer_output_contract CASCADE",
    "DROP TABLE IF EXISTS layer_input_contract CASCADE",
    "DROP TABLE IF EXISTS source_parse_version CASCADE",
    "DROP TABLE IF EXISTS source_ocr_text CASCADE",
    "DROP TABLE IF EXISTS publish_bundle CASCADE",
    "DROP TABLE IF EXISTS review_decision CASCADE",
    "DROP TABLE IF EXISTS review_queue CASCADE",
    "DROP TABLE IF EXISTS editorial_comment CASCADE",
    "DROP TABLE IF EXISTS audit_event CASCADE",
    "DROP TABLE IF EXISTS mst_section CASCADE",
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

    // Content-storage migration (seven-layer schema -> content app's card
    // model, see conceptImportService.js): every layer1-7 table plus
    // generation_registry/layer_run/layer_generation_version/concept_import_*
    // /question_bank_item_version. content_card/content_concept_memory/
    // content_assessment_item/content_card_media (init.sql) replace them.
    "DROP TABLE IF EXISTS concept_import_tutor_item CASCADE",
    "DROP TABLE IF EXISTS concept_import_revision_item CASCADE",
    "DROP TABLE IF EXISTS concept_import_assessment_item CASCADE",
    "DROP TABLE IF EXISTS concept_import_teaching_item CASCADE",
    "DROP TABLE IF EXISTS question_bank_item_version CASCADE",
    "DROP TABLE IF EXISTS layer7_adaptive_remediation CASCADE",
    "DROP TABLE IF EXISTS layer7_misconception_feedback CASCADE",
    "DROP TABLE IF EXISTS layer7_progressive_hint CASCADE",
    "DROP TABLE IF EXISTS layer7_distractor_analysis CASCADE",
    "DROP TABLE IF EXISTS layer7_learning_support CASCADE",
    "DROP TABLE IF EXISTS layer7_learning_support_contract CASCADE",
    "DROP TABLE IF EXISTS layer6_assessment_item_acceptable_answer CASCADE",
    "DROP TABLE IF EXISTS layer6_assessment_item_option CASCADE",
    "DROP TABLE IF EXISTS layer6_assessment_item CASCADE",
    "DROP TABLE IF EXISTS layer6_assessment_item_contract CASCADE",
    "DROP TABLE IF EXISTS layer5_item_blueprint CASCADE",
    "DROP TABLE IF EXISTS layer5_item_blueprint_contract CASCADE",
    "DROP TABLE IF EXISTS layer4_assessment_strategy_contract CASCADE",
    "DROP TABLE IF EXISTS layer3_assessment_capability_contract CASCADE",
    "DROP TABLE IF EXISTS layer2_concept_memory_associated_concept CASCADE",
    "DROP TABLE IF EXISTS layer2_concept_memory_retrieval_cue CASCADE",
    "DROP TABLE IF EXISTS layer2_concept_memory_supporting_concept CASCADE",
    "DROP TABLE IF EXISTS layer2_concept_memory CASCADE",
    "DROP TABLE IF EXISTS layer2_concept_memory_contract CASCADE",
    "DROP TABLE IF EXISTS layer1_assessment_unit CASCADE",
    "DROP TABLE IF EXISTS layer1_question_pattern CASCADE",
    "DROP TABLE IF EXISTS layer1_memory_hook CASCADE",
    "DROP TABLE IF EXISTS layer1_common_misconception CASCADE",
    "DROP TABLE IF EXISTS layer1_exception CASCADE",
    "DROP TABLE IF EXISTS layer1_terminology_related_concept CASCADE",
    "DROP TABLE IF EXISTS layer1_terminology CASCADE",
    "DROP TABLE IF EXISTS layer1_diagram_media CASCADE",
    "DROP TABLE IF EXISTS layer1_diagram_tested_label CASCADE",
    "DROP TABLE IF EXISTS layer1_diagram_label CASCADE",
    "DROP TABLE IF EXISTS layer1_diagram CASCADE",
    "DROP TABLE IF EXISTS layer1_classification_group CASCADE",
    "DROP TABLE IF EXISTS layer1_classification CASCADE",
    "DROP TABLE IF EXISTS layer1_comparison_similarity CASCADE",
    "DROP TABLE IF EXISTS layer1_comparison_difference CASCADE",
    "DROP TABLE IF EXISTS layer1_comparison CASCADE",
    "DROP TABLE IF EXISTS layer1_relationship CASCADE",
    "DROP TABLE IF EXISTS layer1_cause_effect CASCADE",
    "DROP TABLE IF EXISTS layer1_stage_sequence_stage CASCADE",
    "DROP TABLE IF EXISTS layer1_stage_sequence CASCADE",
    "DROP TABLE IF EXISTS layer1_process_step CASCADE",
    "DROP TABLE IF EXISTS layer1_process_output CASCADE",
    "DROP TABLE IF EXISTS layer1_process_input CASCADE",
    "DROP TABLE IF EXISTS layer1_process CASCADE",
    "DROP TABLE IF EXISTS layer1_function CASCADE",
    "DROP TABLE IF EXISTS layer1_structure_part CASCADE",
    "DROP TABLE IF EXISTS layer1_structure CASCADE",
    "DROP TABLE IF EXISTS layer1_core_concept CASCADE",
    "DROP TABLE IF EXISTS layer1_knowledge_contract CASCADE",
    "DROP TABLE IF EXISTS layer_generation_version CASCADE",
    "DROP TABLE IF EXISTS layer_run CASCADE",
    "DROP TABLE IF EXISTS generation_registry CASCADE",

    // Demo mode retired (no "demo" concept in the content app's source data
    // -- every card carries real board/class/subject/chapter/section
    // identity). Harmless to leave on an already-running DB otherwise, but
    // dropped for cleanliness.
    "ALTER TABLE IF EXISTS assessment_unit DROP COLUMN IF EXISTS demo_class_label",
    "ALTER TABLE IF EXISTS assessment_unit DROP COLUMN IF EXISTS demo_subject_label",
    "ALTER TABLE IF EXISTS assessment_unit DROP COLUMN IF EXISTS demo_chapter_label",

    // generation_id/item_id columns changed type (UUID->BIGINT referencing
    // content_sync_run, or widened VARCHAR(80)->VARCHAR(160) referencing
    // content_assessment_item) as part of the same migration. CREATE TABLE IF
    // NOT EXISTS in init.sql is a no-op on a table that already exists, so an
    // already-running database needs these applied explicitly. Old UUID
    // values are meaningless under the new schema (dropping their source
    // tables above already orphaned them), so DROP+ADD rather than a
    // same-column ALTER ... TYPE cast -- this matches the "existing content
    // goes stale until re-imported" decision, not a data-loss shortcut.
    "ALTER TABLE IF EXISTS assessment_unit DROP COLUMN IF EXISTS generation_id",
    "ALTER TABLE IF EXISTS assessment_unit ADD COLUMN IF NOT EXISTS generation_id BIGINT REFERENCES content_sync_run(id)",
    "ALTER TABLE IF EXISTS assessment_unit_supporting_concept DROP COLUMN IF EXISTS generation_id",
    "ALTER TABLE IF EXISTS assessment_unit_supporting_concept ADD COLUMN IF NOT EXISTS generation_id BIGINT REFERENCES content_sync_run(id)",
    "ALTER TABLE IF EXISTS assessment_unit_dependency DROP COLUMN IF EXISTS generation_id",
    "ALTER TABLE IF EXISTS assessment_unit_dependency ADD COLUMN IF NOT EXISTS generation_id BIGINT REFERENCES content_sync_run(id)",
    "ALTER TABLE IF EXISTS concept DROP COLUMN IF EXISTS generation_id",
    "ALTER TABLE IF EXISTS concept ADD COLUMN IF NOT EXISTS generation_id BIGINT REFERENCES content_sync_run(id)",
    "ALTER TABLE IF EXISTS concept_alias DROP COLUMN IF EXISTS generation_id",
    "ALTER TABLE IF EXISTS concept_alias ADD COLUMN IF NOT EXISTS generation_id BIGINT REFERENCES content_sync_run(id)",
    "ALTER TABLE IF EXISTS student_response DROP COLUMN IF EXISTS generation_id",
    "ALTER TABLE IF EXISTS student_response ADD COLUMN IF NOT EXISTS generation_id BIGINT REFERENCES content_sync_run(id)",
    "ALTER TABLE IF EXISTS student_mastery DROP COLUMN IF EXISTS last_generation_id",
    "ALTER TABLE IF EXISTS student_mastery ADD COLUMN IF NOT EXISTS last_generation_id BIGINT REFERENCES content_sync_run(id)",
    "ALTER TABLE IF EXISTS question_bank_item DROP COLUMN IF EXISTS generation_id",
    "ALTER TABLE IF EXISTS question_bank_item ADD COLUMN IF NOT EXISTS generation_id BIGINT REFERENCES content_sync_run(id)",
    "ALTER TABLE IF EXISTS question_bank_item DROP COLUMN IF EXISTS blueprint_id",
    "ALTER TABLE IF EXISTS question_bank_item DROP COLUMN IF EXISTS item_id",
    "ALTER TABLE IF EXISTS question_bank_item ADD COLUMN IF NOT EXISTS item_id VARCHAR(160) REFERENCES content_assessment_item(item_id) ON DELETE SET NULL",
    // DROP COLUMN above also drops any index defined on that column (the
    // partial unique index from init.sql included) -- recreate it
    // unconditionally since syncPracticeSetItems' ON CONFLICT (item_id)
    // upsert depends on it existing.
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_question_bank_item_item_id ON question_bank_item (item_id) WHERE item_id IS NOT NULL",
    "ALTER TABLE IF EXISTS student_attempt_item DROP COLUMN IF EXISTS item_id",
    "ALTER TABLE IF EXISTS student_attempt_item ADD COLUMN IF NOT EXISTS item_id VARCHAR(160) REFERENCES content_assessment_item(item_id) ON DELETE SET NULL",
  ];

  for (const sql of cleanupStatements) {
    await pool.query(sql);
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
  await backfillStudentMasteryFromResponseHistory();

  for (const file of seedFiles) {
    const sql = await fs.readFile(path.join(__dirname, file), "utf8");
    await pool.query(sql);
  }

  await refreshMaterializedViews();
  await seedDefaultUsers();
};
