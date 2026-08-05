-- ============================================================================
-- DESTRUCTIVE -- wipes every row in every table below. This does NOT drop the
-- schema (columns/constraints/indexes stay intact), only the data.
--
-- Before running:
--   * Confirm which database you're connected to (`\conninfo` in psql) --
--     never run this against a production database.
--   * Take a backup first if there's anything worth keeping
--     (e.g. `pg_dump` the database).
--
-- After running:
--   * mst_country/mst_state/mst_exam_type/mst_exam_goal/mst_level/
--     mst_subject/mst_book auto-repopulate on the next server start
--     (server/src/db/bootstrap.js re-runs init.sql's seed
--     INSERT ... ON CONFLICT blocks every boot).
--   * Everything else (users, payment/subscription records, imported
--     content, student activity) is gone for good until users re-register
--     and content is re-imported via the admin Concept Import flow.
--
-- Usage: psql "<connection string>" -f server/src/db/truncate_all.sql
-- ============================================================================

TRUNCATE TABLE
  -- Users & auth
  users,

  -- Payments & subscriptions
  payment_order,
  webhook_event,
  payment_refund,
  payment_dispute,
  subscription,
  subscription_invoice,
  app_settings,

  -- Master / reference data (auto-reseeded on next server restart)
  mst_country,
  mst_state,
  mst_exam_type,
  mst_exam_goal,
  mst_level,
  mst_subject,
  mst_book,
  mst_chapter,

  -- Content catalog & imported curriculum content
  content_sync_run,
  source_document,
  source_section,
  content_update_event,
  assessment_unit,
  assessment_unit_supporting_concept,
  assessment_unit_dependency,
  content_card,
  content_concept_memory,
  content_assessment_item,
  content_card_media,
  memory_hook_media,
  concept_learning_pillar,

  -- Chapter exercises (PDF upload -> extracted questions -> student answers)
  chapter_exercise_upload,
  chapter_exercise_question,
  chapter_exercise_response,

  -- Practice sets & student activity
  question_bank_item,
  practice_set,
  practice_set_item,
  student_attempt,
  student_attempt_item,
  student_response,
  student_mastery,

  -- Standalone response/activity logs
  micro_activity_response,
  textbook_content_response,
  challenge_response,

  -- Admin tools
  admin_demo_submission
RESTART IDENTITY CASCADE;
