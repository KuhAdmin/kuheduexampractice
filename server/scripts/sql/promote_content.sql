-- ============================================================================
-- Content Promotion (Local -> Production) -- SQL/dblink alternative to
-- server/scripts/promoteContent.js. Run entirely FROM the local database
-- (e.g. via pgAdmin's Query Tool connected to your LOCAL server) -- it opens
-- an outbound dblink connection to production and does all writes there.
-- This direction (local reaches out to prod) works with outbound-only
-- network access; it does NOT require production to reach back to your
-- machine.
--
-- Install once (run against your LOCAL database):
--   \i server/scripts/sql/promote_content.sql
--
-- Usage (also against LOCAL, since the function lives there):
--   SELECT promote_content_to_production('host=<prod-host> port=5432 dbname=<db> user=<user> password=<pass>', NULL, TRUE);   -- dry run, everything
--   SELECT promote_content_to_production('host=<prod-host> port=5432 dbname=<db> user=<user> password=<pass>', NULL, FALSE);  -- promote everything
--   SELECT promote_content_to_production('host=<prod-host> port=5432 dbname=<db> user=<user> password=<pass>', 'BIO-AU-1-001', FALSE); -- one unit
--
-- Output is via RAISE NOTICE -- watch the "Messages" tab in pgAdmin.
--
-- This mirrors promoteContent.js's design 1:1, including its two hard-won
-- safety properties (see PROMOTION_PLAYBOOK.md section 6):
--   1. assessment_unit is NEVER deleted, only upserted in place -- a real
--      production DB has student_mastery.assessment_unit_id ON DELETE
--      CASCADE, so deleting it would destroy real student data.
--   2. A single layer-1 generation_id is normally shared by every
--      assessment unit the pipeline extracted from one section, so
--      generation registration/clearing is batched across the WHOLE run,
--      not done per-unit.
--
-- GENERATION_PARENT_TABLES / GENERATION_CHILD_TABLES / the backref-null
-- statements below are copy-pasted from
-- server/src/services/assessmentStudioService.js (same exported constants
-- promoteContent.js imports directly). If that file's lists ever change,
-- these two functions must be updated to match.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS dblink;

-- ----------------------------------------------------------------------------
-- Static table lists (kept in sync with assessmentStudioService.js)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION _promo_parent_tables() RETURNS text[] AS $$
  SELECT ARRAY[
    'layer1_core_concept','layer1_structure','layer1_function','layer1_process',
    'layer1_stage_sequence','layer1_cause_effect','layer1_relationship','layer1_comparison',
    'layer1_classification','layer1_diagram','layer1_terminology','layer1_exception',
    'layer1_common_misconception','layer1_memory_hook','layer1_question_pattern',
    'layer1_assessment_unit','layer1_knowledge_contract','layer2_concept_memory',
    'layer2_concept_memory_contract','layer3_assessment_capability_contract',
    'layer4_assessment_strategy_contract','layer5_item_blueprint','layer5_item_blueprint_contract',
    'layer6_assessment_item','layer6_assessment_item_contract','layer7_learning_support',
    'layer7_learning_support_contract','concept'
  ];
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION _promo_child_tables() RETURNS text[] AS $$
  SELECT ARRAY[
    'layer1_structure_part','layer1_process_input','layer1_process_output','layer1_process_step',
    'layer1_stage_sequence_stage','layer1_comparison_difference','layer1_comparison_similarity',
    'layer1_classification_group','layer1_diagram_label','layer1_diagram_tested_label',
    'layer1_terminology_related_concept','layer2_concept_memory_supporting_concept',
    'layer2_concept_memory_retrieval_cue','layer2_concept_memory_associated_concept',
    'layer6_assessment_item_option','layer6_assessment_item_acceptable_answer',
    'layer7_distractor_analysis','layer7_progressive_hint','layer7_misconception_feedback',
    'layer7_adaptive_remediation','assessment_unit_supporting_concept','assessment_unit_dependency',
    'concept_alias'
  ];
$$ LANGUAGE sql IMMUTABLE;

-- ----------------------------------------------------------------------------
-- Generic schema-introspection + row-copy helpers
-- (mirrors server/scripts/lib/introspect.js and generationTree.js)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION _promo_column_names(p_table text) RETURNS text[] AS $$
  SELECT array_agg(column_name ORDER BY ordinal_position)
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = p_table AND column_name <> 'id';
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION _promo_foreign_keys(p_table text)
RETURNS TABLE(column_name text, ref_table text, ref_column text) AS $$
  SELECT kcu.column_name, ccu.table_name, ccu.column_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public' AND tc.table_name = p_table;
$$ LANGUAGE sql STABLE;

-- Inserts one local row (by id) of p_table into production over p_conn,
-- type-safely quoting every column's LOCAL value via quote_nullable() (never
-- via a JSON-text round-trip, which would mangle real array columns like
-- layer1_relationship.related_concepts), remapping any bare-serial-id FK
-- column via _promo_id_map, and recording the new production id.
CREATE OR REPLACE FUNCTION _promo_insert_row(p_conn text, p_table text, p_local_id bigint)
RETURNS bigint AS $$
DECLARE
  v_columns text[];
  v_col_list text;
  v_quoted_expr text;
  v_values text[];
  v_sql text;
  v_new_id bigint;
  v_fk record;
  v_col_idx int;
  v_raw_fk_value bigint;
  v_prod_fk_value bigint;
BEGIN
  v_columns := _promo_column_names(p_table);

  SELECT string_agg(quote_ident(c), ', ' ORDER BY ord)
  INTO v_col_list
  FROM unnest(v_columns) WITH ORDINALITY AS u(c, ord);

  SELECT string_agg(format('quote_nullable(%I)', c), ', ' ORDER BY ord)
  INTO v_quoted_expr
  FROM unnest(v_columns) WITH ORDINALITY AS u(c, ord);

  EXECUTE format('SELECT ARRAY[%s]::text[] FROM %I WHERE id = $1', v_quoted_expr, p_table)
  INTO v_values
  USING p_local_id;

  IF v_values IS NULL THEN
    RAISE EXCEPTION 'Local row not found: %.id = %', p_table, p_local_id;
  END IF;

  FOR v_fk IN SELECT * FROM _promo_foreign_keys(p_table) WHERE ref_column = 'id' LOOP
    v_col_idx := array_position(v_columns, v_fk.column_name);
    IF v_col_idx IS NOT NULL THEN
      EXECUTE format('SELECT %I FROM %I WHERE id = $1', v_fk.column_name, p_table)
      INTO v_raw_fk_value
      USING p_local_id;

      IF v_raw_fk_value IS NOT NULL THEN
        SELECT prod_id INTO v_prod_fk_value
        FROM _promo_id_map WHERE table_name = v_fk.ref_table AND local_id = v_raw_fk_value;

        IF v_prod_fk_value IS NULL THEN
          RAISE EXCEPTION 'Cannot promote %.% -> %.id = %: no production id recorded yet (check table order)',
            p_table, v_fk.column_name, v_fk.ref_table, v_raw_fk_value;
        END IF;

        v_values[v_col_idx] := v_prod_fk_value::text;
      END IF;
    END IF;
  END LOOP;

  v_sql := format('INSERT INTO %I (%s) VALUES (%s) RETURNING id',
    p_table, v_col_list, array_to_string(v_values, ', '));

  SELECT id INTO v_new_id FROM dblink(p_conn, v_sql) AS t(id bigint);

  INSERT INTO _promo_id_map(table_name, local_id, prod_id) VALUES (p_table, p_local_id, v_new_id)
  ON CONFLICT (table_name, local_id) DO UPDATE SET prod_id = EXCLUDED.prod_id;

  RETURN v_new_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION _promo_insert_table_for_generations(p_conn text, p_table text, p_generation_ids uuid[])
RETURNS void AS $$
DECLARE
  v_id bigint;
BEGIN
  FOR v_id IN EXECUTE format('SELECT id FROM %I WHERE generation_id = ANY($1) ORDER BY id', p_table)
    USING p_generation_ids
  LOOP
    PERFORM _promo_insert_row(p_conn, p_table, v_id);
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Deletes generation-tree content rows on PRODUCTION for the given
-- generation ids. NEVER touches assessment_unit or generation_registry
-- (see header comment).
CREATE OR REPLACE FUNCTION _promo_clear_generation_content(p_conn text, p_generation_ids uuid[])
RETURNS void AS $$
DECLARE
  v_table text;
  v_ids_sql text;
BEGIN
  IF p_generation_ids IS NULL OR array_length(p_generation_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  v_ids_sql := (SELECT string_agg(quote_literal(x), ',') FROM unnest(p_generation_ids) AS x);

  FOREACH v_table IN ARRAY _promo_child_tables() LOOP
    PERFORM dblink_exec(p_conn, format('DELETE FROM %I WHERE generation_id = ANY(ARRAY[%s]::uuid[])', v_table, v_ids_sql));
  END LOOP;
  FOREACH v_table IN ARRAY _promo_parent_tables() LOOP
    PERFORM dblink_exec(p_conn, format('DELETE FROM %I WHERE generation_id = ANY(ARRAY[%s]::uuid[])', v_table, v_ids_sql));
  END LOOP;

  PERFORM dblink_exec(p_conn, format('DELETE FROM layer_generation_version WHERE generation_id = ANY(ARRAY[%s]::uuid[])', v_ids_sql));
END;
$$ LANGUAGE plpgsql;

-- Retires generations no longer selected for anything. Callers must ensure
-- assessment_unit has ALREADY been repointed away from these ids before
-- calling this (see main function ordering) -- otherwise the
-- generation_registry delete at the end will fail its FK check.
CREATE OR REPLACE FUNCTION _promo_retire_superseded_generations(p_conn text, p_generation_ids uuid[])
RETURNS void AS $$
DECLARE
  v_ids_sql text;
BEGIN
  IF p_generation_ids IS NULL OR array_length(p_generation_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  PERFORM _promo_clear_generation_content(p_conn, p_generation_ids);

  v_ids_sql := (SELECT string_agg(quote_literal(x), ',') FROM unnest(p_generation_ids) AS x);

  PERFORM dblink_exec(p_conn, format('UPDATE layer_run SET parent_generation_id = NULL WHERE parent_generation_id = ANY(ARRAY[%s]::uuid[])', v_ids_sql));
  PERFORM dblink_exec(p_conn, format('UPDATE layer_input_contract SET parent_generation_id = NULL WHERE parent_generation_id = ANY(ARRAY[%s]::uuid[])', v_ids_sql));
  PERFORM dblink_exec(p_conn, format('UPDATE layer_output_contract SET parent_generation_id = NULL WHERE parent_generation_id = ANY(ARRAY[%s]::uuid[])', v_ids_sql));
  PERFORM dblink_exec(p_conn, format('UPDATE question_bank_item SET generation_id = NULL WHERE generation_id = ANY(ARRAY[%s]::uuid[])', v_ids_sql));
  PERFORM dblink_exec(p_conn, format('UPDATE question_bank_item_version SET generation_id = NULL WHERE generation_id = ANY(ARRAY[%s]::uuid[])', v_ids_sql));
  PERFORM dblink_exec(p_conn, format('UPDATE student_response SET generation_id = NULL WHERE generation_id = ANY(ARRAY[%s]::uuid[])', v_ids_sql));
  PERFORM dblink_exec(p_conn, format('UPDATE student_mastery SET last_generation_id = NULL WHERE last_generation_id = ANY(ARRAY[%s]::uuid[])', v_ids_sql));

  PERFORM dblink_exec(p_conn, format('DELETE FROM generation_registry WHERE generation_id = ANY(ARRAY[%s]::uuid[])', v_ids_sql));
END;
$$ LANGUAGE plpgsql;

-- ON CONFLICT DO NOTHING makes this safe even when a "new" generation_id is
-- actually unchanged from a prior promotion (idempotent rerun). Must run
-- BEFORE assessment_unit is upserted (its generation_id FK needs this row
-- to already exist).
--
-- Returns the count of generation_registry rows ACTUALLY inserted (parsed
-- from dblink_exec's "INSERT 0 <n>" command tag) -- this is the signal the
-- caller uses to decide whether anything genuinely new happened this run,
-- so a true no-op rerun doesn't emit duplicate content_update_event rows.
CREATE OR REPLACE FUNCTION _promo_register_new_generations(p_conn text, p_generation_ids uuid[])
RETURNS int AS $$
DECLARE
  v_gid uuid;
  v_columns text[];
  v_col_list text;
  v_quoted_expr text;
  v_values text[];
  v_sql text;
  v_tag text;
  v_inserted_count int := 0;
BEGIN
  v_columns := _promo_column_names('generation_registry');

  SELECT string_agg(quote_ident(c), ', ' ORDER BY ord) INTO v_col_list
  FROM unnest(v_columns) WITH ORDINALITY AS u(c, ord);
  SELECT string_agg(format('quote_nullable(%I)', c), ', ' ORDER BY ord) INTO v_quoted_expr
  FROM unnest(v_columns) WITH ORDINALITY AS u(c, ord);

  FOREACH v_gid IN ARRAY p_generation_ids LOOP
    EXECUTE format('SELECT ARRAY[%s]::text[] FROM generation_registry WHERE generation_id = $1', v_quoted_expr)
    INTO v_values USING v_gid;

    IF v_values IS NULL THEN
      RAISE EXCEPTION 'generation_registry row not found locally for %', v_gid;
    END IF;

    -- pipeline_job_id / created_by: not promoted (no cross-env pipeline-run or user mapping)
    IF array_position(v_columns, 'pipeline_job_id') IS NOT NULL THEN
      v_values[array_position(v_columns, 'pipeline_job_id')] := 'NULL';
    END IF;
    IF array_position(v_columns, 'created_by') IS NOT NULL THEN
      v_values[array_position(v_columns, 'created_by')] := 'NULL';
    END IF;

    v_sql := format('INSERT INTO generation_registry (%s) VALUES (%s) ON CONFLICT (generation_id) DO NOTHING',
      v_col_list, array_to_string(v_values, ', '));
    v_tag := dblink_exec(p_conn, v_sql);
    v_inserted_count := v_inserted_count + COALESCE(split_part(v_tag, ' ', 3)::int, 0);
  END LOOP;

  RETURN v_inserted_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION _promo_insert_generation_content(p_conn text, p_generation_ids uuid[])
RETURNS void AS $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY _promo_parent_tables() LOOP
    PERFORM _promo_insert_table_for_generations(p_conn, v_table, p_generation_ids);
  END LOOP;
  FOREACH v_table IN ARRAY _promo_child_tables() LOOP
    PERFORM _promo_insert_table_for_generations(p_conn, v_table, p_generation_ids);
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- layer_run is NOT part of _promo_parent_tables()/_promo_child_tables()
-- (that's the app's own delete-order list for cascadeDeleteGenerations,
-- deliberately left untouched to avoid affecting the unrelated admin
-- delete-generation feature) and was originally excluded from promotion
-- entirely as "local-only pipeline bookkeeping, never read by student-facing
-- code." That assumption was wrong: getLatestLayer1GenerationForSection()
-- (assessmentStudioContextAssembler.js) -- the sole path flashcards,
-- diagrams, and section-overview text use to find their active generation
-- -- reads layer_run directly. Without it promoted, those three features
-- silently return empty even though their actual content
-- (layer1_terminology/layer1_diagram/layer1_knowledge_contract) promoted
-- fine. Call this after source_document/source_section/chapter resolution
-- so _promo_id_map already has what's needed for source_document_id/
-- source_section_id/fk_mst_chapter_id.
CREATE OR REPLACE FUNCTION _promo_promote_layer_run(p_conn text, p_generation_ids uuid[])
RETURNS void AS $$
DECLARE
  v_ids_sql text;
  v_columns text[];
  v_col_list text;
  v_quoted_expr text;
  v_values text[];
  v_col_idx int;
  v_id bigint;
  v_sql text;
  v_fk record;
  v_raw_fk_value bigint;
  v_prod_fk_value bigint;
BEGIN
  IF p_generation_ids IS NULL OR array_length(p_generation_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  v_ids_sql := (SELECT string_agg(quote_literal(x), ',') FROM unnest(p_generation_ids) AS x);
  -- Idempotent-rerun safety -- superseded generations already cascade-delete
  -- their own layer_run rows via ON DELETE CASCADE when
  -- _promo_retire_superseded_generations removes generation_registry.
  PERFORM dblink_exec(p_conn, format('DELETE FROM layer_run WHERE generation_id = ANY(ARRAY[%s]::uuid[])', v_ids_sql));

  v_columns := _promo_column_names('layer_run');
  SELECT string_agg(quote_ident(c), ', ' ORDER BY ord) INTO v_col_list
  FROM unnest(v_columns) WITH ORDINALITY AS u(c, ord);
  SELECT string_agg(format('quote_nullable(%I)', c), ', ' ORDER BY ord) INTO v_quoted_expr
  FROM unnest(v_columns) WITH ORDINALITY AS u(c, ord);

  FOR v_id IN EXECUTE 'SELECT id FROM layer_run WHERE generation_id = ANY($1)' USING p_generation_ids
  LOOP
    EXECUTE format('SELECT ARRAY[%s]::text[] FROM layer_run WHERE id = $1', v_quoted_expr)
    INTO v_values USING v_id;

    -- created_by is the only ref_column='id' FK among the three columns
    -- being nulled below (pipeline_job_id/parent_generation_id reference
    -- job_id/generation_id, not id, so the ref_column filter already
    -- excludes them) -- users are never promoted, so resolving it here
    -- would always throw. Skip it explicitly rather than nulling v_values
    -- afterward, since this loop re-reads the raw local value independent
    -- of whatever v_values already holds.
    FOR v_fk IN SELECT * FROM _promo_foreign_keys('layer_run') WHERE ref_column = 'id' AND column_name <> 'created_by' LOOP
      v_col_idx := array_position(v_columns, v_fk.column_name);
      IF v_col_idx IS NOT NULL THEN
        EXECUTE format('SELECT %I FROM layer_run WHERE id = $1', v_fk.column_name)
        INTO v_raw_fk_value USING v_id;

        IF v_raw_fk_value IS NOT NULL THEN
          SELECT prod_id INTO v_prod_fk_value FROM _promo_id_map
          WHERE table_name = v_fk.ref_table AND local_id = v_raw_fk_value;

          IF v_prod_fk_value IS NULL THEN
            RAISE EXCEPTION 'Cannot promote layer_run.% -> %.id = %: no production id recorded yet',
              v_fk.column_name, v_fk.ref_table, v_raw_fk_value;
          END IF;

          v_values[v_col_idx] := v_prod_fk_value::text;
        END IF;
      END IF;
    END LOOP;

    -- Pipeline-run bookkeeping and per-environment user identity are both
    -- out of promotion scope -- null rather than remap to something that
    -- doesn't exist in production.
    v_col_idx := array_position(v_columns, 'pipeline_job_id');
    IF v_col_idx IS NOT NULL THEN v_values[v_col_idx] := 'NULL'; END IF;
    v_col_idx := array_position(v_columns, 'parent_generation_id');
    IF v_col_idx IS NOT NULL THEN v_values[v_col_idx] := 'NULL'; END IF;
    v_col_idx := array_position(v_columns, 'created_by');
    IF v_col_idx IS NOT NULL THEN v_values[v_col_idx] := 'NULL'; END IF;

    v_sql := format('INSERT INTO layer_run (%s) VALUES (%s)', v_col_list, array_to_string(v_values, ', '));
    PERFORM dblink_exec(p_conn, v_sql);
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- Business-key resolution + bespoke upserts (mirror promoteContent.js 1:1)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION _promo_resolve_chapter_id(p_conn text, p_local_chapter_id bigint)
RETURNS bigint AS $$
DECLARE
  v_cached bigint;
  v_chapter record;
  v_book record;
  v_level_code text;
  v_goal_id text;
  v_prod_book_id bigint;
  v_prod_chapter_id bigint;
BEGIN
  IF p_local_chapter_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT prod_id INTO v_cached FROM _promo_id_map WHERE table_name = 'mst_chapter' AND local_id = p_local_chapter_id;
  IF v_cached IS NOT NULL THEN
    RETURN v_cached;
  END IF;

  SELECT chapter_number, section_number, topic_name, fk_mst_book_id INTO v_chapter
  FROM mst_chapter WHERE id = p_local_chapter_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT name_code, fk_mst_level_id, fk_mst_exam_goal_id INTO v_book
  FROM mst_book WHERE id = v_chapter.fk_mst_book_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT name_code INTO v_level_code FROM mst_level WHERE id = v_book.fk_mst_level_id;
  SELECT goal_id INTO v_goal_id FROM mst_exam_goal WHERE id = v_book.fk_mst_exam_goal_id;
  IF v_level_code IS NULL OR v_goal_id IS NULL THEN RETURN NULL; END IF;

  SELECT id INTO v_prod_book_id FROM dblink(p_conn, format(
    'SELECT mb.id FROM mst_book mb
     JOIN mst_level lv ON lv.id = mb.fk_mst_level_id
     JOIN mst_exam_goal eg ON eg.id = mb.fk_mst_exam_goal_id
     WHERE mb.name_code = %L AND lv.name_code = %L AND eg.goal_id = %L',
    v_book.name_code, v_level_code, v_goal_id
  )) AS t(id bigint);
  IF v_prod_book_id IS NULL THEN RETURN NULL; END IF;

  SELECT id INTO v_prod_chapter_id FROM dblink(p_conn, format(
    'SELECT id FROM mst_chapter
     WHERE fk_mst_book_id = %s AND chapter_number = %L
       AND section_number IS NOT DISTINCT FROM %L
       AND topic_name IS NOT DISTINCT FROM %L',
    v_prod_book_id, v_chapter.chapter_number, v_chapter.section_number, v_chapter.topic_name
  )) AS t(id bigint);

  IF v_prod_chapter_id IS NOT NULL THEN
    INSERT INTO _promo_id_map(table_name, local_id, prod_id) VALUES ('mst_chapter', p_local_chapter_id, v_prod_chapter_id)
    ON CONFLICT (table_name, local_id) DO UPDATE SET prod_id = EXCLUDED.prod_id;
  END IF;

  RETURN v_prod_chapter_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION _promo_upsert_source_document(p_conn text, p_local_id bigint)
RETURNS bigint AS $$
DECLARE
  v_doc record;
  v_id bigint;
BEGIN
  SELECT document_code, title, description, source_type, board_name, class_name,
         subject_name, chapter_name, language_code, review_status
  INTO v_doc FROM source_document WHERE id = p_local_id;

  IF v_doc.document_code IS NULL THEN
    RAISE EXCEPTION 'source_document id=% has no document_code; cannot promote without a stable business key.', p_local_id;
  END IF;

  SELECT id INTO v_id FROM dblink(p_conn, format(
    'INSERT INTO source_document (
       document_code, title, description, source_type, board_name,
       class_name, subject_name, chapter_name, language_code, owner_user_id, review_status
     ) VALUES (%L,%L,%L,%L,%L,%L,%L,%L,%L,NULL,%L)
     ON CONFLICT (document_code) DO UPDATE SET
       title = EXCLUDED.title, description = EXCLUDED.description, source_type = EXCLUDED.source_type,
       board_name = EXCLUDED.board_name, class_name = EXCLUDED.class_name, subject_name = EXCLUDED.subject_name,
       chapter_name = EXCLUDED.chapter_name, language_code = EXCLUDED.language_code, updated_at = NOW()
     RETURNING id',
    v_doc.document_code, v_doc.title, v_doc.description, v_doc.source_type, v_doc.board_name,
    v_doc.class_name, v_doc.subject_name, v_doc.chapter_name, v_doc.language_code, v_doc.review_status
  )) AS t(id bigint);

  INSERT INTO _promo_id_map(table_name, local_id, prod_id) VALUES ('source_document', p_local_id, v_id)
  ON CONFLICT (table_name, local_id) DO UPDATE SET prod_id = EXCLUDED.prod_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION _promo_upsert_source_section(p_conn text, p_local_id bigint)
RETURNS bigint AS $$
DECLARE
  v_sec record;
  v_prod_doc_id bigint;
  v_prod_chapter_id bigint;
  v_id bigint;
BEGIN
  SELECT source_document_id, fk_mst_chapter_id, section_code, section_number, title,
         page_start, page_end, review_status
  INTO v_sec FROM source_section WHERE id = p_local_id;

  IF v_sec.section_code IS NULL THEN
    RAISE EXCEPTION 'source_section id=% has no section_code; cannot promote without a stable business key.', p_local_id;
  END IF;

  SELECT prod_id INTO v_prod_doc_id FROM _promo_id_map WHERE table_name = 'source_document' AND local_id = v_sec.source_document_id;
  IF v_prod_doc_id IS NULL THEN
    RAISE EXCEPTION 'source_document local id % not yet promoted for source_section %', v_sec.source_document_id, p_local_id;
  END IF;

  v_prod_chapter_id := _promo_resolve_chapter_id(p_conn, v_sec.fk_mst_chapter_id);

  SELECT id INTO v_id FROM dblink(p_conn, format(
    'INSERT INTO source_section (
       source_document_id, fk_mst_chapter_id, section_code, section_number,
       title, page_start, page_end, review_status
     ) VALUES (%s,%s,%L,%L,%L,%s,%s,%L)
     ON CONFLICT (source_document_id, section_code) DO UPDATE SET
       fk_mst_chapter_id = EXCLUDED.fk_mst_chapter_id, section_number = EXCLUDED.section_number,
       title = EXCLUDED.title, page_start = EXCLUDED.page_start, page_end = EXCLUDED.page_end, updated_at = NOW()
     RETURNING id',
    v_prod_doc_id, COALESCE(v_prod_chapter_id::text, 'NULL'),
    v_sec.section_code, v_sec.section_number, v_sec.title,
    COALESCE(v_sec.page_start::text, 'NULL'), COALESCE(v_sec.page_end::text, 'NULL'),
    v_sec.review_status
  )) AS t(id bigint);

  INSERT INTO _promo_id_map(table_name, local_id, prod_id) VALUES ('source_section', p_local_id, v_id)
  ON CONFLICT (table_name, local_id) DO UPDATE SET prod_id = EXCLUDED.prod_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- No natural key: delete+reinsert scoped to the resolved production
-- source_section_id. pipeline_job_id/generation_id nulled -- pipeline-run
-- byproducts, excluded from promotion scope.
CREATE OR REPLACE FUNCTION _promo_promote_section_artifacts(p_conn text, p_local_section_id bigint, p_prod_section_id bigint)
RETURNS void AS $$
DECLARE
  v_table text;
  v_columns text[];
  v_insert_columns text[];
  v_col_list text;
  v_quoted_expr text;
  v_id bigint;
  v_values text[];
  v_col_idx int;
  v_sql text;
BEGIN
  PERFORM dblink_exec(p_conn, format('DELETE FROM source_section_image WHERE source_section_id = %s', p_prod_section_id));
  PERFORM dblink_exec(p_conn, format('DELETE FROM source_ocr_text WHERE source_section_id = %s', p_prod_section_id));
  PERFORM dblink_exec(p_conn, format('DELETE FROM source_parse_version WHERE source_section_id = %s', p_prod_section_id));

  FOREACH v_table IN ARRAY ARRAY['source_section_image', 'source_ocr_text', 'source_parse_version'] LOOP
    v_columns := _promo_column_names(v_table);
    v_insert_columns := ARRAY(SELECT c FROM unnest(v_columns) AS c WHERE c <> 'source_section_id');

    SELECT string_agg(quote_ident(c), ', ' ORDER BY ord) INTO v_col_list
    FROM unnest(v_insert_columns) WITH ORDINALITY AS u(c, ord);
    SELECT string_agg(format('quote_nullable(%I)', c), ', ' ORDER BY ord) INTO v_quoted_expr
    FROM unnest(v_insert_columns) WITH ORDINALITY AS u(c, ord);

    FOR v_id IN EXECUTE format('SELECT id FROM %I WHERE source_section_id = $1', v_table) USING p_local_section_id
    LOOP
      EXECUTE format('SELECT ARRAY[%s]::text[] FROM %I WHERE id = $1', v_quoted_expr, v_table)
      INTO v_values USING v_id;

      v_col_idx := array_position(v_insert_columns, 'pipeline_job_id');
      IF v_col_idx IS NOT NULL THEN v_values[v_col_idx] := 'NULL'; END IF;
      v_col_idx := array_position(v_insert_columns, 'generation_id');
      IF v_col_idx IS NOT NULL THEN v_values[v_col_idx] := 'NULL'; END IF;

      v_sql := format('INSERT INTO %I (source_section_id, %s) VALUES (%s, %s)',
        v_table, v_col_list, p_prod_section_id, array_to_string(v_values, ', '));
      PERFORM dblink_exec(p_conn, v_sql);
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Never deletes/recreates assessment_unit -- always an in-place upsert by
-- its stable assessment_unit_id business key. See header comment.
CREATE OR REPLACE FUNCTION _promo_upsert_assessment_unit(p_conn text, p_assessment_unit_id text)
RETURNS void AS $$
DECLARE
  v_unit record;
  v_prod_section_id bigint;
  v_prod_chapter_id bigint;
BEGIN
  SELECT generation_id, source_section_id, fk_mst_chapter_id, primary_concept,
         learning_objective, concept_category, curriculum_importance, is_active
  INTO v_unit FROM assessment_unit WHERE assessment_unit_id = p_assessment_unit_id;

  IF v_unit.source_section_id IS NOT NULL THEN
    SELECT prod_id INTO v_prod_section_id FROM _promo_id_map
    WHERE table_name = 'source_section' AND local_id = v_unit.source_section_id;
  END IF;

  v_prod_chapter_id := _promo_resolve_chapter_id(p_conn, v_unit.fk_mst_chapter_id);

  PERFORM dblink_exec(p_conn, format(
    'INSERT INTO assessment_unit (
       generation_id, assessment_unit_id, source_section_id, fk_mst_chapter_id,
       primary_concept, learning_objective, concept_category, curriculum_importance, is_active
     ) VALUES (%L,%L,%s,%s,%L,%L,%L,%L,%L)
     ON CONFLICT (assessment_unit_id) DO UPDATE SET
       generation_id = EXCLUDED.generation_id, source_section_id = EXCLUDED.source_section_id,
       fk_mst_chapter_id = EXCLUDED.fk_mst_chapter_id, primary_concept = EXCLUDED.primary_concept,
       learning_objective = EXCLUDED.learning_objective, concept_category = EXCLUDED.concept_category,
       curriculum_importance = EXCLUDED.curriculum_importance, is_active = EXCLUDED.is_active, updated_at = NOW()',
    v_unit.generation_id, p_assessment_unit_id,
    COALESCE(v_prod_section_id::text, 'NULL'), COALESCE(v_prod_chapter_id::text, 'NULL'),
    v_unit.primary_concept, v_unit.learning_objective, v_unit.concept_category,
    v_unit.curriculum_importance, v_unit.is_active
  ));
END;
$$ LANGUAGE plpgsql;

-- Any previously-selected version for this (assessment_unit_id,
-- layer_number) was already cleared by _promo_retire_superseded_generations,
-- so this is always a fresh insert (mirrors upsertLayerGenerationVersion).
CREATE OR REPLACE FUNCTION _promo_insert_layer_generation_version(p_conn text, p_assessment_unit_id text, p_layer_number int, p_generation_id uuid)
RETURNS void AS $$
DECLARE
  v_row record;
BEGIN
  SELECT version_number, token_input, token_output INTO v_row
  FROM layer_generation_version
  WHERE assessment_unit_id = p_assessment_unit_id AND layer_number = p_layer_number AND generation_id = p_generation_id;

  PERFORM dblink_exec(p_conn, format(
    'INSERT INTO layer_generation_version (
       assessment_unit_id, layer_number, generation_id, pipeline_job_id,
       version_number, is_selected, token_input, token_output, created_by
     ) VALUES (%L,%s,%L,NULL,%s,TRUE,%s,%s,NULL)',
    p_assessment_unit_id, p_layer_number, p_generation_id,
    v_row.version_number, v_row.token_input, v_row.token_output
  ));
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION _promo_upsert_memory_hook_media(p_conn text, p_local_id bigint)
RETURNS void AS $$
DECLARE
  v_media record;
BEGIN
  SELECT assessment_unit_id, section_key, media_type, source, version_number,
         prompt_text, aspect_ratio, media_data, mime_type, original_file_name,
         model_name, status, error_message
  INTO v_media FROM memory_hook_media WHERE id = p_local_id;

  PERFORM dblink_exec(p_conn, format(
    'UPDATE memory_hook_media SET is_selected = FALSE WHERE assessment_unit_id = %L AND section_key = %L AND is_selected = TRUE',
    v_media.assessment_unit_id, v_media.section_key
  ));

  PERFORM dblink_exec(p_conn, format(
    'INSERT INTO memory_hook_media (
       assessment_unit_id, section_key, media_type, source, version_number,
       is_selected, prompt_text, aspect_ratio, media_data, mime_type,
       original_file_name, model_name, status, error_message, created_by
     ) VALUES (%L,%L,%L,%L,%s,TRUE,%L,%L,%L,%L,%L,%L,%L,%L,NULL)
     ON CONFLICT (assessment_unit_id, section_key, version_number) DO UPDATE SET
       media_type = EXCLUDED.media_type, source = EXCLUDED.source, is_selected = TRUE,
       prompt_text = EXCLUDED.prompt_text, aspect_ratio = EXCLUDED.aspect_ratio,
       media_data = EXCLUDED.media_data, mime_type = EXCLUDED.mime_type,
       original_file_name = EXCLUDED.original_file_name, model_name = EXCLUDED.model_name,
       status = EXCLUDED.status, error_message = EXCLUDED.error_message',
    v_media.assessment_unit_id, v_media.section_key, v_media.media_type, v_media.source, v_media.version_number,
    v_media.prompt_text, v_media.aspect_ratio, v_media.media_data, v_media.mime_type,
    v_media.original_file_name, v_media.model_name, v_media.status, v_media.error_message
  ));
END;
$$ LANGUAGE plpgsql;

-- Fresh event per promoted section, timestamped at promotion time -- not
-- copied from local, so local iteration never spams the student "what's
-- new" feed with backdated entries.
CREATE OR REPLACE FUNCTION _promo_emit_content_update_event(p_conn text, p_prod_section_id bigint)
RETURNS void AS $$
BEGIN
  PERFORM dblink_exec(p_conn, format(
    'INSERT INTO content_update_event (
       exam_goal_code, level_code, subject_code, chapter_number, chapter_name,
       section_number, topic_name, source_section_id, fk_mst_chapter_id,
       target_layer_number, pipeline_job_id
     )
     SELECT eg.goal_id, lv.name_code, sub.name_code, mc.chapter_number, mc.chapter_name,
            ss.section_number, mc.topic_name, ss.id, mc.id, NULL, NULL
     FROM source_section ss
     JOIN mst_chapter mc ON mc.id = ss.fk_mst_chapter_id
     JOIN mst_book mb ON mb.id = mc.fk_mst_book_id
     JOIN mst_level lv ON lv.id = mb.fk_mst_level_id
     JOIN mst_exam_goal eg ON eg.id = mb.fk_mst_exam_goal_id
     JOIN mst_subject sub ON sub.id = mb.fk_mst_subject_id
     WHERE ss.id = %s',
    p_prod_section_id
  ));
END;
$$ LANGUAGE plpgsql;

-- Layer 1 has no layer_generation_version row (see main function comment);
-- its previous generation is read off assessment_unit.generation_id
-- instead. p_layer_generation_ids is a jsonb object {"1": "<uuid>", "2": ...}.
CREATE OR REPLACE FUNCTION _promo_find_generation_ids_to_retire(p_conn text, p_assessment_unit_id text, p_layer_generation_ids jsonb)
RETURNS uuid[] AS $$
DECLARE
  v_result uuid[] := ARRAY[]::uuid[];
  v_old_id uuid;
  v_layer_key text;
  v_layer_num int;
BEGIN
  IF p_layer_generation_ids ? '1' THEN
    SELECT generation_id INTO v_old_id FROM dblink(p_conn, format(
      'SELECT generation_id FROM assessment_unit WHERE assessment_unit_id = %L', p_assessment_unit_id
    )) AS t(generation_id uuid);
    IF v_old_id IS NOT NULL AND v_old_id::text <> (p_layer_generation_ids ->> '1') THEN
      v_result := array_append(v_result, v_old_id);
    END IF;
  END IF;

  FOR v_layer_key IN SELECT jsonb_object_keys(p_layer_generation_ids) LOOP
    IF v_layer_key = '1' THEN CONTINUE; END IF;
    v_layer_num := v_layer_key::int;

    SELECT generation_id INTO v_old_id FROM dblink(p_conn, format(
      'SELECT generation_id FROM layer_generation_version WHERE assessment_unit_id = %L AND layer_number = %s AND is_selected = TRUE',
      p_assessment_unit_id, v_layer_num
    )) AS t(generation_id uuid);

    IF v_old_id IS NOT NULL AND v_old_id::text <> (p_layer_generation_ids ->> v_layer_key) THEN
      v_result := array_append(v_result, v_old_id);
    END IF;
  END LOOP;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- Main entry point
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION promote_content_to_production(
  p_target_dsn text,
  p_assessment_unit_id text DEFAULT NULL,
  p_dry_run boolean DEFAULT TRUE
) RETURNS void AS $$
DECLARE
  v_conn text := 'promo_prod';
  v_rec record;
  v_layer_gen_ids_by_unit jsonb := '{}'::jsonb;
  v_unit_ids text[];
  v_promotable_unit_ids text[] := ARRAY[]::text[];
  v_all_new_gen_ids uuid[];
  v_old_gen_ids uuid[] := ARRAY[]::uuid[];
  v_tmp uuid[];
  v_section_ids bigint[] := ARRAY[]::bigint[];
  v_doc_ids bigint[];
  v_prod_section_id bigint;
  v_prod_chapter_id bigint;
  v_local_section_id bigint;
  v_new_registrations_count int := 0;
  v_unit_id text;
  v_media_count int := 0;
  v_layer_version_count int := 0;
BEGIN
  DROP TABLE IF EXISTS _promo_id_map;
  CREATE TEMP TABLE _promo_id_map (
    table_name text, local_id bigint, prod_id bigint,
    PRIMARY KEY (table_name, local_id)
  );

  BEGIN
    PERFORM dblink_disconnect(v_conn);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  PERFORM dblink_connect(v_conn, p_target_dsn);

  -- Approved-content predicate: mirrors getSelectedGenerationId
  -- (assessmentStudioContextAssembler.js).
  FOR v_rec IN
    SELECT lgv.assessment_unit_id, lgv.layer_number, lgv.generation_id
    FROM layer_generation_version lgv
    JOIN generation_registry gr ON gr.generation_id = lgv.generation_id
    WHERE lgv.is_selected = TRUE
      AND lgv.approval_status <> 'rejected'
      AND gr.status = 'completed'
      AND (p_assessment_unit_id IS NULL OR lgv.assessment_unit_id = p_assessment_unit_id)
    ORDER BY lgv.assessment_unit_id, lgv.layer_number
  LOOP
    v_layer_gen_ids_by_unit := jsonb_set(
      v_layer_gen_ids_by_unit,
      ARRAY[v_rec.assessment_unit_id],
      COALESCE(v_layer_gen_ids_by_unit -> v_rec.assessment_unit_id, '{}'::jsonb)
        || jsonb_build_object(v_rec.layer_number::text, v_rec.generation_id::text),
      true
    );
    -- Counts real layer_generation_version rows only (layers 2-7) -- matches
    -- promoteContent.js's reported count, which doesn't count the synthetic
    -- layer-1 entries added to v_layer_gen_ids_by_unit below.
    v_layer_version_count := v_layer_version_count + 1;
  END LOOP;

  IF v_layer_gen_ids_by_unit = '{}'::jsonb THEN
    RAISE NOTICE 'Nothing to promote: no approved, selected, completed generations found locally%',
      CASE WHEN p_assessment_unit_id IS NOT NULL THEN format(' for assessment unit %s.', p_assessment_unit_id) ELSE '.' END;
    PERFORM dblink_disconnect(v_conn);
    RETURN;
  END IF;

  v_unit_ids := ARRAY(SELECT jsonb_object_keys(v_layer_gen_ids_by_unit));

  -- Layer-1 gate (layer 1 has no layer_generation_version row -- it
  -- defaults to "approved" once its pipeline run completes; see
  -- moderationService.js). Also collects layer-1 generation ids and
  -- source_section ids.
  FOR v_rec IN
    SELECT au.assessment_unit_id, au.generation_id, au.source_section_id, gr.status AS layer1_status
    FROM assessment_unit au
    LEFT JOIN generation_registry gr ON gr.generation_id = au.generation_id
    WHERE au.assessment_unit_id = ANY(v_unit_ids)
  LOOP
    IF v_rec.layer1_status = 'completed' THEN
      v_promotable_unit_ids := array_append(v_promotable_unit_ids, v_rec.assessment_unit_id);
      v_layer_gen_ids_by_unit := jsonb_set(
        v_layer_gen_ids_by_unit, ARRAY[v_rec.assessment_unit_id],
        (v_layer_gen_ids_by_unit -> v_rec.assessment_unit_id) || jsonb_build_object('1', v_rec.generation_id::text),
        true
      );
      IF v_rec.source_section_id IS NOT NULL THEN
        v_section_ids := array_append(v_section_ids, v_rec.source_section_id);
      END IF;
    ELSE
      RAISE NOTICE 'Skipping assessment unit %: layer-1 pipeline run not completed locally (status=%)',
        v_rec.assessment_unit_id, COALESCE(v_rec.layer1_status, 'NULL');
    END IF;
  END LOOP;

  IF array_length(v_promotable_unit_ids, 1) IS NULL THEN
    RAISE NOTICE 'Nothing to promote after layer-1 gating.';
    PERFORM dblink_disconnect(v_conn);
    RETURN;
  END IF;

  -- Multiple assessment units routinely share the same source_section, so
  -- dedupe before using this list to drive per-section work (upsert,
  -- artifacts, content_update_event) -- otherwise a section with N units
  -- would get N duplicate "what's new" events.
  SELECT array_agg(DISTINCT x) INTO v_section_ids FROM unnest(v_section_ids) AS x;

  SELECT array_agg(DISTINCT source_document_id) INTO v_doc_ids
  FROM source_section WHERE id = ANY(v_section_ids);

  SELECT array_agg(DISTINCT (kv.value)::uuid) INTO v_all_new_gen_ids
  FROM jsonb_each(v_layer_gen_ids_by_unit) AS units(unit_id, layers)
  CROSS JOIN LATERAL jsonb_each_text(units.layers) AS kv(layer_num, value);

  RAISE NOTICE '% assessment unit(s), % layer version(s), % generation id(s), % section(s), % document(s) eligible.',
    array_length(v_promotable_unit_ids, 1), v_layer_version_count,
    array_length(v_all_new_gen_ids, 1), array_length(v_section_ids, 1), array_length(v_doc_ids, 1);

  IF p_dry_run THEN
    FOR v_rec IN SELECT id, document_code FROM source_document WHERE id = ANY(v_doc_ids) LOOP
      IF EXISTS (SELECT 1 FROM dblink(v_conn, format('SELECT id FROM source_document WHERE document_code = %L', v_rec.document_code)) AS t(id bigint)) THEN
        RAISE NOTICE 'source_document "%": exists in prod (will update)', v_rec.document_code;
      ELSE
        RAISE NOTICE 'source_document "%": new (will insert)', v_rec.document_code;
      END IF;
    END LOOP;

    FOR v_rec IN SELECT id, section_code, fk_mst_chapter_id FROM source_section WHERE id = ANY(v_section_ids) LOOP
      v_prod_chapter_id := _promo_resolve_chapter_id(v_conn, v_rec.fk_mst_chapter_id);
      IF v_prod_chapter_id IS NULL AND v_rec.fk_mst_chapter_id IS NOT NULL THEN
        RAISE NOTICE 'source_section "%": chapter resolves to prod mst_chapter.id=MISSING -- WARNING: promotion would fail here', v_rec.section_code;
      ELSE
        RAISE NOTICE 'source_section "%": chapter resolves to prod mst_chapter.id=%', v_rec.section_code, v_prod_chapter_id;
      END IF;
    END LOOP;

    RAISE NOTICE 'DRY RUN complete -- no writes made.';
    PERFORM dblink_disconnect(v_conn);
    RETURN;
  END IF;

  BEGIN
    PERFORM dblink_exec(v_conn, 'BEGIN');

    FOR v_rec IN SELECT id FROM source_document WHERE id = ANY(v_doc_ids) LOOP
      PERFORM _promo_upsert_source_document(v_conn, v_rec.id);
    END LOOP;

    FOR v_rec IN SELECT id FROM source_section WHERE id = ANY(v_section_ids) LOOP
      v_prod_section_id := _promo_upsert_source_section(v_conn, v_rec.id);
      PERFORM _promo_promote_section_artifacts(v_conn, v_rec.id, v_prod_section_id);
    END LOOP;

    -- Old generations to retire, computed BEFORE anything is cleared or
    -- registered (a single layer-1 generation_id is normally shared across
    -- every unit from the same section, so this is batched across the
    -- whole run, not done per-unit).
    FOREACH v_unit_id IN ARRAY v_promotable_unit_ids LOOP
      v_tmp := _promo_find_generation_ids_to_retire(v_conn, v_unit_id, v_layer_gen_ids_by_unit -> v_unit_id);
      v_old_gen_ids := v_old_gen_ids || v_tmp;
    END LOOP;
    SELECT array_agg(DISTINCT x) INTO v_old_gen_ids FROM unnest(v_old_gen_ids) AS x;

    -- Ordering is load-bearing (see header comment): register new
    -- generation_registry rows, THEN upsert assessment_unit in place
    -- (repointing at the new layer-1 generation), THEN retire superseded
    -- generations (now safe -- assessment_unit no longer references them),
    -- THEN clear/reinsert the target generations' own content.
    v_new_registrations_count := _promo_register_new_generations(v_conn, v_all_new_gen_ids);

    FOREACH v_unit_id IN ARRAY v_promotable_unit_ids LOOP
      PERFORM _promo_upsert_assessment_unit(v_conn, v_unit_id);
    END LOOP;

    PERFORM _promo_retire_superseded_generations(v_conn, v_old_gen_ids);
    PERFORM _promo_clear_generation_content(v_conn, v_all_new_gen_ids);
    PERFORM _promo_insert_generation_content(v_conn, v_all_new_gen_ids);
    PERFORM _promo_promote_layer_run(v_conn, v_all_new_gen_ids);

    FOR v_rec IN
      SELECT lgv.assessment_unit_id, lgv.layer_number, lgv.generation_id
      FROM layer_generation_version lgv
      JOIN generation_registry gr ON gr.generation_id = lgv.generation_id
      WHERE lgv.is_selected = TRUE
        AND lgv.approval_status <> 'rejected'
        AND gr.status = 'completed'
        AND lgv.assessment_unit_id = ANY(v_promotable_unit_ids)
    LOOP
      PERFORM _promo_insert_layer_generation_version(v_conn, v_rec.assessment_unit_id, v_rec.layer_number, v_rec.generation_id);
    END LOOP;

    FOR v_rec IN
      SELECT id FROM memory_hook_media WHERE assessment_unit_id = ANY(v_promotable_unit_ids) AND is_selected = TRUE
    LOOP
      PERFORM _promo_upsert_memory_hook_media(v_conn, v_rec.id);
      v_media_count := v_media_count + 1;
    END LOOP;

    -- Only announce "what's new" if something was genuinely new this run
    -- (a real generation registered, or a generation retired/replaced) --
    -- a true no-op rerun (nothing changed locally) must not re-spam the
    -- student feed with duplicate identical events.
    IF v_new_registrations_count > 0 OR array_length(v_old_gen_ids, 1) > 0 THEN
      FOREACH v_local_section_id IN ARRAY v_section_ids LOOP
        v_prod_section_id := (SELECT prod_id FROM _promo_id_map WHERE table_name = 'source_section' AND local_id = v_local_section_id);
        IF v_prod_section_id IS NOT NULL THEN
          PERFORM _promo_emit_content_update_event(v_conn, v_prod_section_id);
        END IF;
      END LOOP;
    ELSE
      RAISE NOTICE 'No new or changed generations this run -- skipping content_update_event (no-op rerun).';
    END IF;

    PERFORM dblink_exec(v_conn, 'COMMIT');
    RAISE NOTICE 'Promotion committed: % assessment unit(s), % media row(s).', array_length(v_promotable_unit_ids, 1), v_media_count;
  EXCEPTION WHEN OTHERS THEN
    PERFORM dblink_exec(v_conn, 'ROLLBACK');
    PERFORM dblink_disconnect(v_conn);
    RAISE;
  END;

  PERFORM dblink_disconnect(v_conn);
END;
$$ LANGUAGE plpgsql;
