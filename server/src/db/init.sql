CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT,
  google_id VARCHAR(255) UNIQUE,
  provider VARCHAR(30) NOT NULL DEFAULT 'local',
  avatar_url TEXT,
  role VARCHAR(30) NOT NULL DEFAULT 'student',
  board VARCHAR(60),
  student_class VARCHAR(30),
  subject VARCHAR(60),
  onboarding_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS board VARCHAR(60);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS student_class VARCHAR(30);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS subject VARCHAR(60);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS last_notifications_seen_at TIMESTAMPTZ;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS theme VARCHAR(10) NOT NULL DEFAULT 'dawn';

ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_premium BOOLEAN NOT NULL DEFAULT FALSE;

-- Set only for the ₹9/1-hour trial plan (paymentService.js's
-- PLAN_AMOUNTS_PAISE.trial) -- NULL means premium never auto-expires (the
-- normal monthly/yearly case). userService.js's findUserById lazily flips
-- is_premium back to FALSE once this passes, on the next request that loads
-- the user.
ALTER TABLE users
ADD COLUMN IF NOT EXISTS premium_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);

-- Razorpay Standard Checkout order/payment record for the STEMLab Premium
-- one-time purchase (see server/src/services/paymentService.js). status
-- only ever flips created -> paid via a verified HMAC signature match, or
-- created -> failed on a signature mismatch -- never set directly from
-- client-supplied data.
CREATE TABLE IF NOT EXISTS payment_order (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  razorpay_order_id VARCHAR(64) NOT NULL UNIQUE,
  razorpay_payment_id VARCHAR(64),
  amount INTEGER NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  status VARCHAR(20) NOT NULL DEFAULT 'created',
  receipt VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payment_order_user_id ON payment_order(user_id);

-- monthly vs yearly only changes the charged amount (see paymentService.js) --
-- default 'yearly' keeps existing rows consistent with the flat ₹1999
-- purchase they were created under before this column existed.
ALTER TABLE payment_order
ADD COLUMN IF NOT EXISTS plan VARCHAR(20) NOT NULL DEFAULT 'yearly';

-- Running total of processed refunds against this order, used to decide
-- "fully refunded" (see payment_refund below) without re-summing on every
-- webhook delivery.
ALTER TABLE payment_order
ADD COLUMN IF NOT EXISTS refunded_amount INTEGER NOT NULL DEFAULT 0;

-- Captured from the Razorpay payment entity on payment.captured/order.paid
-- webhook deliveries (see razorpayWebhookService.js) -- e.g. "card"/"upi"/
-- "netbanking"/"wallet"/"emi"/"paylater". NULL for rows paid before this
-- column existed, or whose webhook delivery hasn't landed yet.
ALTER TABLE payment_order
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(30);

CREATE INDEX IF NOT EXISTS idx_payment_order_created_at ON payment_order(created_at);

-- Audit log + idempotency guard for inbound Razorpay webhook deliveries
-- (see razorpayWebhookService.js). Razorpay does not guarantee a stable
-- top-level event id on every payload, so event_key is a composite of
-- event_type + the relevant entity id (e.g. "payment.captured:pay_xxx") --
-- a duplicate insert (retry/redelivery) hits the unique constraint and is
-- treated as already-processed.
CREATE TABLE IF NOT EXISTS webhook_event (
  id BIGSERIAL PRIMARY KEY,
  provider VARCHAR(20) NOT NULL DEFAULT 'razorpay',
  event_type VARCHAR(60) NOT NULL,
  event_key VARCHAR(120) NOT NULL UNIQUE,
  payload JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per Razorpay refund against a payment_order (refund.created /
-- refund.processed webhook events).
CREATE TABLE IF NOT EXISTS payment_refund (
  id BIGSERIAL PRIMARY KEY,
  payment_order_id BIGINT NOT NULL REFERENCES payment_order(id),
  razorpay_refund_id VARCHAR(64) NOT NULL UNIQUE,
  amount INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payment_refund_payment_order_id ON payment_refund(payment_order_id);

-- One row per Razorpay dispute against a payment_order (payment.dispute.*
-- webhook events) -- for admin visibility only, no automated action taken.
CREATE TABLE IF NOT EXISTS payment_dispute (
  id BIGSERIAL PRIMARY KEY,
  payment_order_id BIGINT NOT NULL REFERENCES payment_order(id),
  razorpay_dispute_id VARCHAR(64) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL,
  amount INTEGER,
  reason_code VARCHAR(80),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payment_dispute_payment_order_id ON payment_dispute(payment_order_id);

-- Recurring STEMLab Premium Monthly subscription (12 monthly charges via
-- Razorpay Subscriptions -- see subscriptionService.js). Separate from
-- payment_order/payment_refund, which only ever track one-time Yearly
-- purchases; a subscription's own charges are tracked in
-- subscription_invoice below, not payment_order.
CREATE TABLE IF NOT EXISTS subscription (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  razorpay_subscription_id VARCHAR(64) NOT NULL UNIQUE,
  razorpay_plan_id VARCHAR(64) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'created',
  total_count INTEGER NOT NULL DEFAULT 12,
  paid_count INTEGER NOT NULL DEFAULT 0,
  current_start TIMESTAMPTZ,
  current_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_subscription_user_id ON subscription(user_id);

-- Which pricing card (see client/src/content/pricingContent.js's
-- pricingCards) this recurring subscription is for -- e.g. "science",
-- "mathematics". NULL for any pre-existing rows from before per-card
-- pricing existed.
ALTER TABLE subscription
ADD COLUMN IF NOT EXISTS card_id VARCHAR(40);

-- One row per Razorpay invoice (a single monthly charge) against a
-- subscription (invoice.paid / invoice.partially_paid webhook events) --
-- for admin visibility only, mirrors payment_refund's shape.
CREATE TABLE IF NOT EXISTS subscription_invoice (
  id BIGSERIAL PRIMARY KEY,
  subscription_id BIGINT NOT NULL REFERENCES subscription(id),
  razorpay_invoice_id VARCHAR(64) NOT NULL UNIQUE,
  amount INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_subscription_invoice_subscription_id ON subscription_invoice(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_invoice_paid_at ON subscription_invoice(paid_at);

-- Mirrors payment_order.payment_method above -- captured from the payment
-- entity accompanying invoice.paid/invoice.partially_paid webhook deliveries.
ALTER TABLE subscription_invoice
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(30);

CREATE TABLE IF NOT EXISTS app_settings (
  setting_key VARCHAR(120) PRIMARY KEY,
  setting_value JSONB NOT NULL,
  updated_by BIGINT REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mst_country (
  id BIGSERIAL PRIMARY KEY,
  name_code VARCHAR(10) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL
);

CREATE TABLE IF NOT EXISTS mst_state (
  id BIGSERIAL PRIMARY KEY,
  state_id VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  fk_country_id BIGINT NOT NULL REFERENCES mst_country(id)
);

CREATE TABLE IF NOT EXISTS mst_exam_type (
  id BIGSERIAL PRIMARY KEY,
  type_id VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL
);

CREATE TABLE IF NOT EXISTS mst_exam_goal (
  id BIGSERIAL PRIMARY KEY,
  goal_id VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  fk_mst_exam_type_id BIGINT NOT NULL REFERENCES mst_exam_type(id),
  fk_state_id BIGINT NOT NULL REFERENCES mst_state(id),
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- The board a student picks at signup (users.board, e.g. "CBSE") resolves to
-- an exam goal through this column, not through goal_id/name -- goal_id is an
-- exam-specific code (AISSCE, JEE-MAIN, ...) that doesn't itself read as a
-- board. Nullable: only board-type exam goals need it, and only one per
-- board is expected (resolveDashboardAcademicFilters in catalogService.js
-- takes the first match).
ALTER TABLE IF EXISTS mst_exam_goal
ADD COLUMN IF NOT EXISTS board_code VARCHAR(60);

CREATE TABLE IF NOT EXISTS mst_level (
  id BIGSERIAL PRIMARY KEY,
  name_code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS mst_subject (
  id BIGSERIAL PRIMARY KEY,
  name_code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS mst_book (
  id BIGSERIAL PRIMARY KEY,
  name_code VARCHAR(40) NOT NULL,
  name VARCHAR(255) NOT NULL,
  fk_mst_subject_id BIGINT NOT NULL REFERENCES mst_subject(id),
  fk_mst_level_id BIGINT NOT NULL REFERENCES mst_level(id),
  fk_mst_exam_goal_id BIGINT NOT NULL REFERENCES mst_exam_goal(id),
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (name_code, fk_mst_level_id, fk_mst_exam_goal_id)
);

CREATE TABLE IF NOT EXISTS mst_chapter (
  id BIGSERIAL PRIMARY KEY,
  chapter_number VARCHAR(40) NOT NULL,
  chapter_name VARCHAR(255) NOT NULL,
  section_number VARCHAR(40),
  topic_name VARCHAR(255),
  display_order INTEGER NOT NULL DEFAULT 0,
  fk_mst_book_id BIGINT NOT NULL REFERENCES mst_book(id),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (fk_mst_book_id, chapter_number, section_number, topic_name)
);

ALTER TABLE mst_chapter
DROP CONSTRAINT IF EXISTS mst_chapter_fk_mst_book_id_chapter_number_section_number_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mst_chapter_book_chapter_section_topic
ON mst_chapter (fk_mst_book_id, chapter_number, section_number, topic_name);

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP TABLE IF EXISTS student_mastery CASCADE;
DROP TABLE IF EXISTS student_response CASCADE;
DROP TABLE IF EXISTS student_attempt_item CASCADE;
DROP TABLE IF EXISTS student_attempt CASCADE;
DROP TABLE IF EXISTS practice_set_item CASCADE;
DROP TABLE IF EXISTS practice_set CASCADE;
DROP TABLE IF EXISTS question_bank_item CASCADE;
DROP TABLE IF EXISTS content_assessment_item CASCADE;
DROP TABLE IF EXISTS content_card_media CASCADE;
DROP TABLE IF EXISTS content_card CASCADE;
DROP TABLE IF EXISTS content_concept_memory CASCADE;
DROP TABLE IF EXISTS content_sync_run CASCADE;
DROP TABLE IF EXISTS assessment_unit_dependency CASCADE;
DROP TABLE IF EXISTS assessment_unit_supporting_concept CASCADE;
DROP TABLE IF EXISTS assessment_unit CASCADE;
DROP TABLE IF EXISTS source_section CASCADE;
DROP TABLE IF EXISTS source_document CASCADE;

-- Replaces generation_registry+layer_run (seven-layer pipeline, removed) --
-- one row per admin JSON-upload import, see conceptImportService.js.
CREATE TABLE IF NOT EXISTS content_sync_run (
  id BIGSERIAL PRIMARY KEY,
  content_key VARCHAR(160) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'completed',
  created_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_sync_run_content_key
ON content_sync_run (content_key, created_at DESC);

CREATE TABLE IF NOT EXISTS source_document (
  id BIGSERIAL PRIMARY KEY,
  document_code VARCHAR(80) UNIQUE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  source_type VARCHAR(60) NOT NULL DEFAULT 'textbook',
  board_name VARCHAR(120),
  class_name VARCHAR(120),
  subject_name VARCHAR(120),
  chapter_name VARCHAR(255),
  language_code VARCHAR(20) NOT NULL DEFAULT 'en',
  owner_user_id BIGINT REFERENCES users(id),
  review_status VARCHAR(40) NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Durable storage for an admin-uploaded chapter PDF, split into pages
-- client-side (no server-side PDF processing) -- kept so a completed
-- pipeline run can later re-show the original document, not just its
-- derived page images.
ALTER TABLE IF EXISTS source_document
ADD COLUMN IF NOT EXISTS pdf_data TEXT;

ALTER TABLE IF EXISTS source_document
ADD COLUMN IF NOT EXISTS original_file_name VARCHAR(255);

ALTER TABLE IF EXISTS source_document
ADD COLUMN IF NOT EXISTS page_count INTEGER;

CREATE TABLE IF NOT EXISTS source_section (
  id BIGSERIAL PRIMARY KEY,
  source_document_id BIGINT NOT NULL REFERENCES source_document(id) ON DELETE CASCADE,
  fk_mst_chapter_id BIGINT REFERENCES mst_chapter(id),
  section_code VARCHAR(80),
  section_number VARCHAR(80),
  title VARCHAR(255) NOT NULL,
  page_start INTEGER,
  page_end INTEGER,
  review_status VARCHAR(40) NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_document_id, section_code)
);

-- Free-text admin instructions for this section, distinct from the source
-- content itself -- surfaced in Layer 1's human-readable prompt directives,
-- not just buried in the JSON context dump (see buildPracticeDirectivesForPrompt).
ALTER TABLE IF EXISTS source_section
ADD COLUMN IF NOT EXISTS admin_notes TEXT;

CREATE TABLE IF NOT EXISTS content_update_event (
  id BIGSERIAL PRIMARY KEY,
  exam_goal_code VARCHAR(20) NOT NULL,
  level_code VARCHAR(20) NOT NULL,
  subject_code VARCHAR(20) NOT NULL,
  chapter_number VARCHAR(40),
  chapter_name VARCHAR(255) NOT NULL,
  section_number VARCHAR(80),
  topic_name VARCHAR(255),
  source_section_id BIGINT REFERENCES source_section(id) ON DELETE SET NULL,
  fk_mst_chapter_id BIGINT REFERENCES mst_chapter(id) ON DELETE SET NULL,
  target_layer_number INTEGER,
  -- Was a FK to assessment_pipeline_run(job_id) ON DELETE SET NULL -- that
  -- table (the seven-layer pipeline's run tracker) was removed along with
  -- the pipeline itself, so this is now a plain, always-null column. Kept
  -- rather than dropped since nothing writes new content_update_event rows
  -- anymore anyway (the sole writer was the same removed pipeline code) --
  -- this table stays purely for studentDashboardService.js's
  -- getNotificationsForUser to keep reading whatever history already exists.
  pipeline_job_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_update_event_audience
ON content_update_event (exam_goal_code, level_code, subject_code, created_at DESC);

CREATE TABLE IF NOT EXISTS assessment_unit (
  id BIGSERIAL PRIMARY KEY,
  -- Was NOT NULL REFERENCES generation_registry(generation_id) -- that table
  -- was removed along with the seven-layer pipeline. Repointed at
  -- content_sync_run(id) and made nullable rather than backfilled, so
  -- existing rows from before this migration are left untouched (stale
  -- until re-imported) instead of destroyed -- see conceptImportService.js.
  generation_id BIGINT REFERENCES content_sync_run(id),
  assessment_unit_id VARCHAR(80) NOT NULL UNIQUE,
  source_section_id BIGINT REFERENCES source_section(id),
  fk_mst_chapter_id BIGINT REFERENCES mst_chapter(id),
  primary_concept VARCHAR(255) NOT NULL,
  learning_objective TEXT,
  concept_category VARCHAR(80) NOT NULL,
  curriculum_importance VARCHAR(40) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS assessment_unit_supporting_concept (
  id BIGSERIAL PRIMARY KEY,
  generation_id BIGINT REFERENCES content_sync_run(id),
  assessment_unit_id VARCHAR(80) NOT NULL REFERENCES assessment_unit(assessment_unit_id) ON DELETE CASCADE,
  supporting_concept VARCHAR(255) NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS assessment_unit_dependency (
  id BIGSERIAL PRIMARY KEY,
  generation_id BIGINT REFERENCES content_sync_run(id),
  assessment_unit_id VARCHAR(80) NOT NULL REFERENCES assessment_unit(assessment_unit_id) ON DELETE CASCADE,
  depends_on_assessment_unit_id VARCHAR(80) NOT NULL REFERENCES assessment_unit(assessment_unit_id) ON DELETE CASCADE,
  dependency_type VARCHAR(80) NOT NULL DEFAULT 'prerequisite',
  UNIQUE (assessment_unit_id, depends_on_assessment_unit_id, dependency_type)
);

-- Generic content card, mirroring the companion content app's
-- content_processor_card shape (contentuitab/processorkey/parentCardkey/
-- cardkey/title/summary/details) -- see conceptImportService.js. Replaces
-- the entire layer1_*/layer2_concept_memory* schema plus the four
-- concept_import_* tables. assessment_unit_id is set for concept-scoped
-- cards (teaching/assessment/revision/tutor/deeplearning/extraction);
-- source_section_id is set for section-scoped root cards (pdfassets/visual).
CREATE TABLE IF NOT EXISTS content_card (
  id BIGSERIAL PRIMARY KEY,
  sync_run_id BIGINT REFERENCES content_sync_run(id) ON DELETE CASCADE,
  assessment_unit_id VARCHAR(80) REFERENCES assessment_unit(assessment_unit_id) ON DELETE CASCADE,
  source_section_id BIGINT REFERENCES source_section(id) ON DELETE CASCADE,
  content_key VARCHAR(160) NOT NULL,
  contentuitab VARCHAR(40) NOT NULL,
  processorkey VARCHAR(40) NOT NULL,
  parent_cardkey VARCHAR(80) NOT NULL DEFAULT '',
  cardkey VARCHAR(80) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  title TEXT,
  summary TEXT,
  details JSONB NOT NULL DEFAULT '[]'::jsonb,
  image_data_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (content_key, processorkey, parent_cardkey, cardkey)
);

CREATE INDEX IF NOT EXISTS idx_content_card_assessment_unit
ON content_card (assessment_unit_id, contentuitab, processorkey);

CREATE INDEX IF NOT EXISTS idx_content_card_source_section
ON content_card (source_section_id, contentuitab, processorkey);

-- Content-moderator show/hide toggle (see contentEditorService.js) -- every
-- student-facing read of content_card must filter WHERE is_hidden = FALSE
-- for this to actually hide anything, not just cosmetically flag it in the
-- editor.
ALTER TABLE IF EXISTS content_card
ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT FALSE;

-- Replaces layer2_concept_memory -- synthesized at import time from a
-- concept's eli5/storymode/analogy/realworld content_card rows (same 3-of-6
-- mapping conceptImportService.js's importConceptMemory always did). The old
-- estimated_memory_strength heuristic is dropped -- confirmed unused by any
-- client field.
CREATE TABLE IF NOT EXISTS content_concept_memory (
  assessment_unit_id VARCHAR(80) PRIMARY KEY REFERENCES assessment_unit(assessment_unit_id) ON DELETE CASCADE,
  story TEXT,
  analogy TEXT,
  real_world_connection TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Structured assessment items (replaces layer6_assessment_item + its two
-- child tables, and concept_import_assessment_item for the families that DO
-- have a clean single_select/free_text shape -- hotspot/casestudy/
-- einsteinmode stay in content_card only, no structured row here). Feeds
-- grading (studentPracticeService.js) and question_bank_item sync.
CREATE TABLE IF NOT EXISTS content_assessment_item (
  id BIGSERIAL PRIMARY KEY,
  sync_run_id BIGINT REFERENCES content_sync_run(id) ON DELETE CASCADE,
  content_card_id BIGINT REFERENCES content_card(id) ON DELETE CASCADE,
  assessment_unit_id VARCHAR(80) NOT NULL REFERENCES assessment_unit(assessment_unit_id) ON DELETE CASCADE,
  item_id VARCHAR(160) NOT NULL UNIQUE,
  question_family VARCHAR(40) NOT NULL,
  interaction_type VARCHAR(20) NOT NULL,
  question TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_answer TEXT,
  answer_explanation TEXT,
  difficulty TEXT,
  blooms_level TEXT,
  learning_objective TEXT,
  hints JSONB NOT NULL DEFAULT '[]'::jsonb,
  estimated_time_seconds INTEGER NOT NULL DEFAULT 0,
  marks INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Both were originally VARCHAR(40)/VARCHAR(80) -- widened to TEXT after a
-- real import failed with "value too long for type character varying(40)"
-- on difficulty: neither column is ever compared against a known short
-- enum anywhere in the code (grepped client+server), they're just
-- free-text labels from the source JSON, so there's no reason to cap their
-- length at all. ALTER COLUMN TYPE TEXT is a safe widening cast, re-running
-- it on an already-TEXT column is a no-op.
ALTER TABLE IF EXISTS content_assessment_item ALTER COLUMN difficulty TYPE TEXT;
ALTER TABLE IF EXISTS content_assessment_item ALTER COLUMN blooms_level TYPE TEXT;

CREATE INDEX IF NOT EXISTS idx_content_assessment_item_unit
ON content_assessment_item (assessment_unit_id);

-- Admin-uploaded images for root-level pdfassets/visual content_card rows
-- (diagrams, mind maps, etc.) -- same version_number + is_selected pattern as
-- the untouched memory_hook_media, scoped to a content_card instead of an
-- assessment_unit+section_key.
CREATE TABLE IF NOT EXISTS content_card_media (
  id BIGSERIAL PRIMARY KEY,
  content_card_id BIGINT NOT NULL REFERENCES content_card(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  is_selected BOOLEAN NOT NULL DEFAULT TRUE,
  media_data TEXT NOT NULL,
  mime_type VARCHAR(60) NOT NULL,
  original_file_name VARCHAR(255),
  created_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (content_card_id, version_number)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_content_card_media_selected
ON content_card_media (content_card_id) WHERE is_selected;

-- Mirrors memory_hook_media's already-proven source/prompt_text/model_name/
-- status/error_message shape (see that table below) -- lets diagram images
-- be AI-regenerated the same way memory-hook images already can be, via
-- diagramImageService.js's regenerateDiagramMedia.
ALTER TABLE IF EXISTS content_card_media
ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'uploaded';

ALTER TABLE IF EXISTS content_card_media
ADD COLUMN IF NOT EXISTS prompt_text TEXT;

ALTER TABLE IF EXISTS content_card_media
ADD COLUMN IF NOT EXISTS model_name VARCHAR(80);

ALTER TABLE IF EXISTS content_card_media
ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'completed';

ALTER TABLE IF EXISTS content_card_media
ADD COLUMN IF NOT EXISTS error_message TEXT;

CREATE TABLE IF NOT EXISTS memory_hook_media (
  id BIGSERIAL PRIMARY KEY,
  assessment_unit_id VARCHAR(80) NOT NULL REFERENCES assessment_unit(assessment_unit_id) ON DELETE CASCADE,
  section_key VARCHAR(24) NOT NULL CHECK (section_key IN (
    'analogy', 'visualHook', 'curiosityHook', 'memoryTrick',
    'story', 'realWorldConnection', 'microActivity'
  )),
  media_type VARCHAR(10) NOT NULL CHECK (media_type IN ('image', 'video')),
  source VARCHAR(10) NOT NULL CHECK (source IN ('generated', 'uploaded')),
  version_number INTEGER NOT NULL,
  is_selected BOOLEAN NOT NULL DEFAULT FALSE,
  prompt_text TEXT,
  aspect_ratio VARCHAR(10) DEFAULT '3:2',
  media_data TEXT NOT NULL,
  mime_type VARCHAR(60) NOT NULL,
  original_file_name VARCHAR(255),
  model_name VARCHAR(120),
  status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'failed')),
  error_message TEXT,
  created_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (assessment_unit_id, section_key, version_number)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_memory_hook_media_selected
ON memory_hook_media (assessment_unit_id, section_key) WHERE is_selected;

-- Append-only log of a student's own responses to the Layer 2 "Try This"
-- micro-activity prompt, plus the qualitative AI feedback each one got. No
-- is_selected/versioning idiom here -- unlike memory_hook_media, there's no
-- single "active" response to pick, just a history read via ORDER BY
-- created_at DESC.
CREATE TABLE IF NOT EXISTS micro_activity_response (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assessment_unit_id VARCHAR(80) NOT NULL REFERENCES assessment_unit(assessment_unit_id) ON DELETE CASCADE,
  response_text TEXT NOT NULL,
  feedback_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_micro_activity_response_lookup
ON micro_activity_response (user_id, assessment_unit_id, created_at DESC);

-- Optional per-page source photos when the response was built from OCR'd
-- handwritten-note captures: [{ "order": 1, "imageData": "data:image/..." }].
-- NULL for typed-only answers, same as today.
ALTER TABLE IF EXISTS micro_activity_response
ADD COLUMN IF NOT EXISTS source_page_images JSONB;

-- Student responses to textbook Activities/Exercises content (content_card
-- rows with contentuitab='textbook', see conceptImportService.js). Same
-- open-ended, no-single-right-answer nature as micro_activity_response (a
-- reflection question or hands-on activity), so this mirrors its shape and
-- append-only history exactly -- but keyed by activity_key
-- ("${contentKey}:${cardkey}", same convention assessment_unit_id already
-- uses) instead of a content_card.id FK: content_card rows for a
-- content_key are hard-deleted and re-inserted on every re-import (fresh
-- ids each time), so a row-id FK would silently orphan/cascade-delete every
-- student's response history on the next re-import. activity_key survives
-- re-imports because cardkey is sourced from the item's own stable "id"
-- field in the source JSON.
CREATE TABLE IF NOT EXISTS textbook_content_response (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_key VARCHAR(240) NOT NULL,
  response_text TEXT NOT NULL,
  feedback_text TEXT,
  source_page_images JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_textbook_content_response_lookup
ON textbook_content_response (user_id, activity_key, created_at DESC);

-- Student responses to Challenges tab items (content_card rows with
-- contentuitab='assessment', processorkey IN 'casestudy'/'einsteinmode' --
-- a free-text answer to a case-study question, or a written summary of an
-- Object Hunt; hotspot stays self-check only, tapping markers has no
-- free-text answer to grade). Same open-ended shape/history as
-- textbook_content_response, but response_key
-- is "${assessmentUnitId}:${cardkey}" instead of "${contentKey}:${cardkey}"
-- -- these cards are concept-scoped, not section-scoped, and
-- assessment_unit_id (not content_key) is this app's stable per-concept
-- identity. assessmentUnitId itself already contains one ":" (it's
-- "${contentKey}:${conceptCardkey}"), so parsing response_key back apart
-- must split on the LAST ":", not the first -- cardkey values (e.g.
-- "casestudy-1") never contain one, so that's always the right split point.
CREATE TABLE IF NOT EXISTS challenge_response (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  response_key VARCHAR(240) NOT NULL,
  response_text TEXT NOT NULL,
  feedback_text TEXT,
  source_page_images JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_challenge_response_lookup
ON challenge_response (user_id, response_key, created_at DESC);

-- Many-to-many link between concepts (assessment_unit) and the "learning
-- pillars" (competencies) they develop -- learningpillars content_card rows,
-- see conceptImportService.js's card routing. Joined back to content_card by
-- (content_key, pillar_cardkey) rather than a content_card.id FK, same
-- reasoning as activity_key above: content_card rows for a content_key are
-- hard-deleted/re-inserted on every re-import (fresh ids each time), but
-- content_key+cardkey survives because cardkey is sourced from the pillar's
-- own stable "id" field in the source JSON.
CREATE TABLE IF NOT EXISTS concept_learning_pillar (
  id BIGSERIAL PRIMARY KEY,
  assessment_unit_id VARCHAR(80) NOT NULL REFERENCES assessment_unit(assessment_unit_id) ON DELETE CASCADE,
  content_key VARCHAR(160) NOT NULL,
  pillar_cardkey VARCHAR(80) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (assessment_unit_id, content_key, pillar_cardkey)
);

CREATE INDEX IF NOT EXISTS idx_concept_learning_pillar_unit
ON concept_learning_pillar (assessment_unit_id);

CREATE INDEX IF NOT EXISTS idx_concept_learning_pillar_pillar
ON concept_learning_pillar (content_key, pillar_cardkey);

-- Chapter-end textbook exercise questions, extracted from an admin-uploaded
-- photo of the exercise page. Keyed by (fk_mst_book_id, chapter_number) --
-- NOT a single mst_chapter row, since mst_chapter is itself row-per-section
-- (it carries section_number/topic_name), so "a whole chapter" has no single
-- row to reference. Unlike Layer 6 items (generated from chapter body text
-- with no single right answer to guess), these questions DO have one true
-- answer that the AI must infer without seeing an answer key -- hence the
-- approval_status gate: nothing reaches students until a moderator approves it.
CREATE TABLE IF NOT EXISTS chapter_exercise_upload (
  id BIGSERIAL PRIMARY KEY,
  fk_mst_book_id BIGINT NOT NULL REFERENCES mst_book(id),
  chapter_number VARCHAR(40) NOT NULL,
  chapter_name VARCHAR(255),
  image_data TEXT NOT NULL,
  mime_type VARCHAR(60) NOT NULL,
  extraction_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (extraction_status IN ('pending', 'completed', 'failed')),
  error_message TEXT,
  -- Was a FK to assessment_pipeline_run(job_id) ON DELETE SET NULL -- that
  -- table was removed along with the seven-layer pipeline. Kept as a plain
  -- column; chapterExerciseAdminController.js's uploadChapterExerciseHandler
  -- still accepts an optional pipelineJobId field but nothing populates a
  -- real one anymore.
  pipeline_job_id UUID,
  created_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chapter_exercise_question (
  id BIGSERIAL PRIMARY KEY,
  chapter_exercise_upload_id BIGINT NOT NULL REFERENCES chapter_exercise_upload(id) ON DELETE CASCADE,
  fk_mst_book_id BIGINT NOT NULL REFERENCES mst_book(id),
  chapter_number VARCHAR(40) NOT NULL,
  question_number VARCHAR(20),
  question_text TEXT NOT NULL,
  interaction_type VARCHAR(20) NOT NULL CHECK (interaction_type IN ('single_select', 'free_text', 'matching')),
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_answer TEXT,
  interaction_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  approval_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  reviewed_by BIGINT REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chapter_exercise_question_lookup
ON chapter_exercise_question (fk_mst_book_id, chapter_number, approval_status);

-- Upsert-on-conflict (one current answer per student per question), unlike
-- micro_activity_response's append-only history -- here we want a clean
-- answered/correct state per question to drive the Book Questions %.
CREATE TABLE IF NOT EXISTS chapter_exercise_response (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chapter_exercise_question_id BIGINT NOT NULL REFERENCES chapter_exercise_question(id) ON DELETE CASCADE,
  student_answer TEXT NOT NULL,
  is_correct BOOLEAN,
  feedback_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, chapter_exercise_question_id)
);

-- Optional per-page source photos when the response was built from OCR'd
-- handwritten-note captures: [{ "order": 1, "imageData": "data:image/..." }].
-- NULL for typed-only or non-free-text answers, same as today.
ALTER TABLE IF EXISTS chapter_exercise_response
ADD COLUMN IF NOT EXISTS source_page_images JSONB;

-- Materialized practice-bank snapshot, synced from content_assessment_item
-- (studentPracticeService.js's syncPracticeSetItems) -- kept from the prior
-- seven-layer-removal migration since practice_set/student_attempt already
-- depend on it. question_bank_item_version (unused, zero readers/writers)
-- and the old generation_registry/layer5_item_blueprint/layer6_assessment_item
-- FKs are dropped along with the rest of the seven-layer schema.
CREATE TABLE IF NOT EXISTS question_bank_item (
  id BIGSERIAL PRIMARY KEY,
  generation_id BIGINT REFERENCES content_sync_run(id),
  assessment_unit_id VARCHAR(80) REFERENCES assessment_unit(assessment_unit_id) ON DELETE SET NULL,
  item_id VARCHAR(160) REFERENCES content_assessment_item(item_id) ON DELETE SET NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'draft',
  current_version_number INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- CREATE TABLE IF NOT EXISTS above is a no-op on a question_bank_item that
-- already existed pre-item_id (e.g. from before the seven-layer-removal
-- migration) -- this ALTER guarantees the column exists before the index
-- below is built, instead of relying on bootstrap.js's JS-side
-- pruneRedundantAssessmentStudioSchema() cleanup, which only runs AFTER
-- this whole init.sql query and is too late to save this statement.
ALTER TABLE question_bank_item
ADD COLUMN IF NOT EXISTS item_id VARCHAR(160) REFERENCES content_assessment_item(item_id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_question_bank_item_item_id
ON question_bank_item (item_id) WHERE item_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS practice_set (
  id BIGSERIAL PRIMARY KEY,
  practice_set_code VARCHAR(80) UNIQUE,
  name VARCHAR(255) NOT NULL,
  fk_mst_subject_id BIGINT REFERENCES mst_subject(id),
  fk_mst_level_id BIGINT REFERENCES mst_level(id),
  fk_mst_exam_goal_id BIGINT REFERENCES mst_exam_goal(id),
  fk_mst_chapter_id BIGINT REFERENCES mst_chapter(id),
  status VARCHAR(40) NOT NULL DEFAULT 'draft',
  is_premium BOOLEAN NOT NULL DEFAULT FALSE,
  created_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE practice_set
ADD COLUMN IF NOT EXISTS source_section_id BIGINT REFERENCES source_section(id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_practice_set_source_section
ON practice_set (source_section_id) WHERE source_section_id IS NOT NULL;

ALTER TABLE practice_set
ADD COLUMN IF NOT EXISTS source_assessment_unit_id VARCHAR(80) REFERENCES assessment_unit(assessment_unit_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_practice_set_source_assessment_unit
ON practice_set (source_assessment_unit_id) WHERE source_assessment_unit_id IS NOT NULL;

-- Third practice_set identity, alongside source_section_id/source_assessment_unit_id above --
-- a demo-mode "chapter" assessment aggregating every concept tagged with the same
-- (demo_class_label, demo_subject_label, demo_chapter_label) triple (see
-- materializePracticeSetForDemoChapter in studentPracticeService.js).
ALTER TABLE practice_set
ADD COLUMN IF NOT EXISTS source_demo_chapter_key VARCHAR(400);

CREATE UNIQUE INDEX IF NOT EXISTS idx_practice_set_source_demo_chapter
ON practice_set (source_demo_chapter_key) WHERE source_demo_chapter_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS practice_set_item (
  id BIGSERIAL PRIMARY KEY,
  practice_set_id BIGINT NOT NULL REFERENCES practice_set(id) ON DELETE CASCADE,
  question_bank_item_id BIGINT NOT NULL REFERENCES question_bank_item(id) ON DELETE CASCADE,
  assessment_unit_id VARCHAR(80) REFERENCES assessment_unit(assessment_unit_id) ON DELETE SET NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  publish_state VARCHAR(40) NOT NULL DEFAULT 'draft',
  UNIQUE (practice_set_id, question_bank_item_id)
);

CREATE TABLE IF NOT EXISTS student_attempt (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  practice_set_id BIGINT NOT NULL REFERENCES practice_set(id) ON DELETE CASCADE,
  status VARCHAR(40) NOT NULL DEFAULT 'in_progress',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  score NUMERIC(8,2)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_student_attempt_in_progress
ON student_attempt (user_id, practice_set_id) WHERE status = 'in_progress';

CREATE TABLE IF NOT EXISTS student_attempt_item (
  id BIGSERIAL PRIMARY KEY,
  student_attempt_id BIGINT NOT NULL REFERENCES student_attempt(id) ON DELETE CASCADE,
  question_bank_item_id BIGINT REFERENCES question_bank_item(id) ON DELETE SET NULL,
  item_id VARCHAR(160) REFERENCES content_assessment_item(item_id) ON DELETE SET NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  marks_awarded NUMERIC(8,2),
  UNIQUE (student_attempt_id, display_order)
);

CREATE TABLE IF NOT EXISTS student_response (
  id BIGSERIAL PRIMARY KEY,
  generation_id BIGINT REFERENCES content_sync_run(id),
  student_attempt_id BIGINT REFERENCES student_attempt(id) ON DELETE CASCADE,
  student_attempt_item_id BIGINT REFERENCES student_attempt_item(id) ON DELETE CASCADE,
  assessment_unit_id VARCHAR(80) REFERENCES assessment_unit(assessment_unit_id) ON DELETE SET NULL,
  student_answer TEXT,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  time_taken_seconds INTEGER NOT NULL DEFAULT 0,
  confidence_rating NUMERIC(4,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Optional per-page source photos when the response was built from OCR'd
-- handwritten-note captures: [{ "order": 1, "imageData": "data:image/..." }].
-- NULL for typed-only or non-free-text answers, same as today.
ALTER TABLE IF EXISTS student_response
ADD COLUMN IF NOT EXISTS source_page_images JSONB;

CREATE TABLE IF NOT EXISTS student_mastery (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assessment_unit_id VARCHAR(80) NOT NULL REFERENCES assessment_unit(assessment_unit_id) ON DELETE CASCADE,
  mastery_level VARCHAR(40) NOT NULL DEFAULT 'Needs Practice',
  mastery_probability NUMERIC(4,3) NOT NULL DEFAULT 0.000,
  last_generation_id BIGINT REFERENCES content_sync_run(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, assessment_unit_id)
);

-- assessment_unit_id was VARCHAR(80) everywhere it appears, but
-- conceptImportService.js builds it as "${contentKey}:${cardkey}" -- the
-- exact same formula textbook_content_response.activity_key and
-- challenge_response.response_key already use at VARCHAR(240), because a
-- real contentKey+cardkey pair routinely exceeds 80 characters. A real
-- import failed with "value too long for type character varying(80)" once
-- cardkey/parent_cardkey/pillar_cardkey (sourced directly from the source
-- JSON's own item ids, no length guarantee) or that concatenation got long
-- enough. None of these are ever compared against a known short enum
-- anywhere in the code -- same reasoning as the difficulty/blooms_level
-- widening above -- so TEXT everywhere rather than picking another cap that
-- could just as easily be hit again. ALTER COLUMN TYPE TEXT is a safe
-- widening cast that keeps existing FKs/unique constraints/indexes intact;
-- re-running it on an already-TEXT column is a no-op.
ALTER TABLE IF EXISTS assessment_unit ALTER COLUMN assessment_unit_id TYPE TEXT;
ALTER TABLE IF EXISTS assessment_unit_supporting_concept ALTER COLUMN assessment_unit_id TYPE TEXT;
ALTER TABLE IF EXISTS assessment_unit_dependency ALTER COLUMN assessment_unit_id TYPE TEXT;
ALTER TABLE IF EXISTS assessment_unit_dependency ALTER COLUMN depends_on_assessment_unit_id TYPE TEXT;
ALTER TABLE IF EXISTS content_card ALTER COLUMN assessment_unit_id TYPE TEXT;
ALTER TABLE IF EXISTS content_card ALTER COLUMN parent_cardkey TYPE TEXT;
ALTER TABLE IF EXISTS content_card ALTER COLUMN cardkey TYPE TEXT;
ALTER TABLE IF EXISTS content_concept_memory ALTER COLUMN assessment_unit_id TYPE TEXT;
ALTER TABLE IF EXISTS content_assessment_item ALTER COLUMN assessment_unit_id TYPE TEXT;
ALTER TABLE IF EXISTS memory_hook_media ALTER COLUMN assessment_unit_id TYPE TEXT;
ALTER TABLE IF EXISTS micro_activity_response ALTER COLUMN assessment_unit_id TYPE TEXT;
ALTER TABLE IF EXISTS concept_learning_pillar ALTER COLUMN assessment_unit_id TYPE TEXT;
ALTER TABLE IF EXISTS concept_learning_pillar ALTER COLUMN pillar_cardkey TYPE TEXT;
ALTER TABLE IF EXISTS question_bank_item ALTER COLUMN assessment_unit_id TYPE TEXT;
ALTER TABLE IF EXISTS practice_set ALTER COLUMN source_assessment_unit_id TYPE TEXT;
ALTER TABLE IF EXISTS practice_set_item ALTER COLUMN assessment_unit_id TYPE TEXT;
ALTER TABLE IF EXISTS student_response ALTER COLUMN assessment_unit_id TYPE TEXT;
ALTER TABLE IF EXISTS student_mastery ALTER COLUMN assessment_unit_id TYPE TEXT;

-- Smart Tutor usage meter (see tutorUsageService.js) -- one row per user per
-- calendar month, incremented on every text (Ask/Coach) reply and every
-- voice/avatar session end. Converted to hours via 1,000,000 tokens = 30
-- hours for text; voice_seconds is added directly as elapsed time, since
-- Gemini Live bills by session-minutes, not tokens.
CREATE TABLE IF NOT EXISTS tutor_usage_period (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_month DATE NOT NULL,
  input_tokens BIGINT NOT NULL DEFAULT 0,
  output_tokens BIGINT NOT NULL DEFAULT 0,
  voice_seconds BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, period_month)
);

CREATE INDEX IF NOT EXISTS idx_source_section_mst_chapter
ON source_section (fk_mst_chapter_id);

CREATE INDEX IF NOT EXISTS idx_assessment_unit_section
ON assessment_unit (source_section_id, fk_mst_chapter_id);

CREATE INDEX IF NOT EXISTS idx_student_response_au
ON student_response (assessment_unit_id, created_at);

-- Concept card load path (getConceptCard / contentReadService.js) was doing
-- sequential scans on these FK/filter columns -- confirmed via EXPLAIN
-- ANALYZE before adding these.
CREATE INDEX IF NOT EXISTS idx_assessment_unit_supporting_concept_au
ON assessment_unit_supporting_concept (assessment_unit_id);

-- Standalone admin demo tool: capture any question (PDF-page crop or camera
-- photo) for any subject, capture a handwritten answer (up to 5 pages, same
-- source_page_images-style JSONB shape as micro_activity_response), and run
-- one fast multimodal AI grading call. Deliberately independent of the
-- 7-layer pipeline / assessment_unit -- there's no curriculum anchor for an
-- ad-hoc photographed question, so this has its own single-table history.
CREATE TABLE IF NOT EXISTS admin_demo_submission (
  id BIGSERIAL PRIMARY KEY,
  fk_mst_subject_id BIGINT NOT NULL REFERENCES mst_subject(id),
  capture_method VARCHAR(20) NOT NULL CHECK (capture_method IN ('pdf_page', 'camera_photo')),
  question_image_data TEXT NOT NULL,
  question_text TEXT,
  answer_text TEXT,
  answer_source_images JSONB,
  ai_is_correct BOOLEAN,
  ai_ideal_answer TEXT,
  ai_feedback TEXT,
  model_name VARCHAR(120),
  created_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_demo_submission_created
ON admin_demo_submission (created_at DESC);

DROP MATERIALIZED VIEW IF EXISTS mv_book_catalog;

CREATE MATERIALIZED VIEW mv_book_catalog AS
SELECT
  book.id AS book_id,
  book.name_code AS book_code,
  book.name AS book_name,
  book.display_order AS book_display_order,
  book.is_active AS book_is_active,
  subject.id AS subject_id,
  subject.name_code AS subject_code,
  subject.name AS subject_name,
  subject.display_order AS subject_display_order,
  subject.is_active AS subject_is_active,
  level.id AS level_id,
  level.name_code AS level_code,
  level.name AS level_name,
  level.display_order AS level_display_order,
  exam_goal.id AS exam_goal_id,
  exam_goal.goal_id AS exam_goal_code,
  exam_goal.name AS exam_goal_name,
  exam_goal.is_active AS exam_goal_is_active,
  exam_type.id AS exam_type_id,
  exam_type.type_id AS exam_type_code,
  exam_type.name AS exam_type_name,
  state.id AS state_id,
  state.state_id AS state_code,
  state.name AS state_name,
  country.id AS country_id,
  country.name_code AS country_code,
  country.name AS country_name
FROM mst_book AS book
JOIN mst_subject AS subject
  ON subject.id = book.fk_mst_subject_id
JOIN mst_level AS level
  ON level.id = book.fk_mst_level_id
JOIN mst_exam_goal AS exam_goal
  ON exam_goal.id = book.fk_mst_exam_goal_id
JOIN mst_exam_type AS exam_type
  ON exam_type.id = exam_goal.fk_mst_exam_type_id
JOIN mst_state AS state
  ON state.id = exam_goal.fk_state_id
JOIN mst_country AS country
  ON country.id = state.fk_country_id;

CREATE UNIQUE INDEX idx_mv_book_catalog_book_id
ON mv_book_catalog (book_id);

CREATE INDEX idx_mv_book_catalog_filters
ON mv_book_catalog (
  subject_code,
  level_code,
  exam_goal_code,
  book_is_active
);

DROP MATERIALIZED VIEW IF EXISTS mv_chapter_catalog;

CREATE MATERIALIZED VIEW mv_chapter_catalog AS
SELECT
  chapter.id AS chapter_id,
  chapter.chapter_number,
  chapter.chapter_name,
  chapter.section_number,
  chapter.topic_name,
  chapter.display_order AS chapter_display_order,
  chapter.is_active AS chapter_is_active,
  chapter.fk_mst_book_id AS book_id,
  book.name_code AS book_code,
  book.name AS book_name,
  book.display_order AS book_display_order,
  book.is_active AS book_is_active,
  subject.id AS subject_id,
  subject.name_code AS subject_code,
  subject.name AS subject_name,
  level.id AS level_id,
  level.name_code AS level_code,
  level.name AS level_name,
  exam_goal.id AS exam_goal_id,
  exam_goal.goal_id AS exam_goal_code,
  exam_goal.name AS exam_goal_name,
  exam_type.id AS exam_type_id,
  exam_type.type_id AS exam_type_code,
  exam_type.name AS exam_type_name,
  state.id AS state_id,
  state.state_id AS state_code,
  state.name AS state_name,
  country.id AS country_id,
  country.name_code AS country_code,
  country.name AS country_name,
  COALESCE(array_length(string_to_array(chapter.section_number, '.'), 1), 0) AS section_depth,
  CONCAT_WS(
    ' > ',
    country.name,
    state.name,
    exam_type.name,
    exam_goal.name,
    level.name,
    subject.name,
    book.name,
    chapter.chapter_name,
    chapter.topic_name
  ) AS breadcrumb
FROM mst_chapter AS chapter
JOIN mst_book AS book
  ON book.id = chapter.fk_mst_book_id
JOIN mst_subject AS subject
  ON subject.id = book.fk_mst_subject_id
JOIN mst_level AS level
  ON level.id = book.fk_mst_level_id
JOIN mst_exam_goal AS exam_goal
  ON exam_goal.id = book.fk_mst_exam_goal_id
JOIN mst_exam_type AS exam_type
  ON exam_type.id = exam_goal.fk_mst_exam_type_id
JOIN mst_state AS state
  ON state.id = exam_goal.fk_state_id
JOIN mst_country AS country
  ON country.id = state.fk_country_id;

CREATE UNIQUE INDEX idx_mv_chapter_catalog_chapter_id
ON mv_chapter_catalog (chapter_id);

CREATE INDEX idx_mv_chapter_catalog_filters
ON mv_chapter_catalog (
  book_id,
  chapter_number,
  section_number,
  chapter_is_active
);

CREATE INDEX idx_mv_chapter_catalog_academic
ON mv_chapter_catalog (
  subject_code,
  level_code,
  exam_goal_code
);

DROP MATERIALIZED VIEW IF EXISTS mv_book_chapter_summary;

CREATE MATERIALIZED VIEW mv_book_chapter_summary AS
SELECT
  book.id AS book_id,
  book.name_code AS book_code,
  book.name AS book_name,
  book.display_order AS book_display_order,
  book.is_active AS book_is_active,
  subject.id AS subject_id,
  subject.name_code AS subject_code,
  subject.name AS subject_name,
  level.id AS level_id,
  level.name_code AS level_code,
  level.name AS level_name,
  exam_goal.id AS exam_goal_id,
  exam_goal.goal_id AS exam_goal_code,
  exam_goal.name AS exam_goal_name,
  COUNT(chapter.id) AS topic_count,
  COUNT(*) FILTER (WHERE chapter.is_active) AS active_topic_count,
  COUNT(DISTINCT chapter.chapter_number) AS chapter_count,
  MIN(chapter.display_order) AS first_topic_display_order,
  MAX(chapter.display_order) AS last_topic_display_order
FROM mst_book AS book
JOIN mst_subject AS subject
  ON subject.id = book.fk_mst_subject_id
JOIN mst_level AS level
  ON level.id = book.fk_mst_level_id
JOIN mst_exam_goal AS exam_goal
  ON exam_goal.id = book.fk_mst_exam_goal_id
LEFT JOIN mst_chapter AS chapter
  ON chapter.fk_mst_book_id = book.id
GROUP BY
  book.id,
  book.name_code,
  book.name,
  book.display_order,
  book.is_active,
  subject.id,
  subject.name_code,
  subject.name,
  level.id,
  level.name_code,
  level.name,
  exam_goal.id,
  exam_goal.goal_id,
  exam_goal.name;

CREATE UNIQUE INDEX idx_mv_book_chapter_summary_book_id
ON mv_book_chapter_summary (book_id);

CREATE INDEX idx_mv_book_chapter_summary_filters
ON mv_book_chapter_summary (
  subject_code,
  level_code,
  exam_goal_code,
  book_is_active
);
