#!/usr/bin/env node
// Promotes locally-reviewed/approved pipeline content (chapters, concepts,
// assessment items, memory-hook media) from the local Postgres database to
// production, in one transaction. See the design writeup for full context.
//
// Usage (run from server/):
//   node scripts/promoteContent.js --dry-run
//   node scripts/promoteContent.js --confirm
//   node scripts/promoteContent.js --confirm --assessment-unit=<assessment_unit_id>
import { parseArgs } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import pg from "pg";
import { env } from "../src/config/env.js";
import { pool as localPool } from "../src/db/pool.js";
import {
  registerNewGenerations,
  clearGenerationContentTablesForReinsert,
  insertGenerationContent,
  retireSupersededGenerations,
  findGenerationIdsToRetire,
  GENERATION_PARENT_TABLES,
  GENERATION_CHILD_TABLES,
} from "./lib/generationTree.js";
import { getColumns } from "./lib/introspect.js";

const execFileAsync = promisify(execFile);
const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "..", "..");
const backupRootDir = path.join(workspaceRoot, "server", "runtime", "promotion-backups");
const logDir = path.join(workspaceRoot, "server", "runtime", "promotion-logs");

const ARTIFACT_TABLES = ["source_section_image", "source_ocr_text", "source_parse_version"];

const getInScopeTableList = () => [
  "source_document",
  "source_section",
  ...ARTIFACT_TABLES,
  "generation_registry",
  ...GENERATION_PARENT_TABLES,
  ...GENERATION_CHILD_TABLES,
  "assessment_unit",
  "layer_generation_version",
  "memory_hook_media",
  "content_update_event",
];

const redactConnectionString = (connectionString) => {
  try {
    const parsed = new URL(connectionString);
    if (parsed.password) parsed.password = "***";
    return parsed.toString();
  } catch {
    return "[unparseable connection string]";
  }
};

// Guards against the easy-to-make mistake of DATABASE_URL and
// PRODUCTION_DATABASE_URL resolving to the same server+database -- e.g. two
// identically-named "kuhedu_practice" databases distinguished only by which
// Postgres server they live under, where a copy-pasted or misconfigured
// connection string can silently point both env vars at the same place.
// Compares host+port+database name, not credentials, so it still catches
// this even if the two URLs use different usernames.
const isSameConnectionTarget = (urlA, urlB) => {
  try {
    const a = new URL(urlA);
    const b = new URL(urlB);
    return (
      a.hostname.toLowerCase() === b.hostname.toLowerCase() &&
      (a.port || "5432") === (b.port || "5432") &&
      a.pathname === b.pathname
    );
  } catch {
    return false;
  }
};

// ---------------------------------------------------------------------------
// Local reads: the approved-content predicate and everything it pulls in.
// Mirrors getSelectedGenerationId (assessmentStudioContextAssembler.js) so
// promotion never diverges from what the admin review UI actually shows.
// ---------------------------------------------------------------------------

const fetchApprovedLayerVersions = async (assessmentUnitFilter) => {
  const params = [];
  let filterSql = "";
  if (assessmentUnitFilter) {
    params.push(assessmentUnitFilter);
    filterSql = "AND lgv.assessment_unit_id = $1";
  }

  const { rows } = await localPool.query(
    `
      SELECT lgv.assessment_unit_id, lgv.layer_number, lgv.generation_id,
             lgv.version_number, lgv.token_input, lgv.token_output
      FROM layer_generation_version lgv
      JOIN generation_registry gr ON gr.generation_id = lgv.generation_id
      WHERE lgv.is_selected = TRUE
        AND lgv.approval_status <> 'rejected'
        AND gr.status = 'completed'
        ${filterSql}
      ORDER BY lgv.assessment_unit_id, lgv.layer_number
    `,
    params
  );
  return rows;
};

// Layer 1 has no layer_generation_version row of its own (see
// generationTree.js's header comment) -- moderationService.js treats it as
// always-"approved" and gates only on the pipeline run having completed.
// That gate is generation_registry.status for whichever generation
// assessment_unit.generation_id currently points to.
const fetchAssessmentUnitsWithLayer1Status = async (assessmentUnitIds) => {
  if (!assessmentUnitIds.length) return [];
  const { rows } = await localPool.query(
    `
      SELECT au.*, gr.status AS layer1_generation_status
      FROM assessment_unit au
      LEFT JOIN generation_registry gr ON gr.generation_id = au.generation_id
      WHERE au.assessment_unit_id = ANY($1)
    `,
    [assessmentUnitIds]
  );
  return rows;
};

const fetchSourceSections = async (sourceSectionIds) => {
  if (!sourceSectionIds.length) return [];
  const { rows } = await localPool.query(
    "SELECT * FROM source_section WHERE id = ANY($1)",
    [sourceSectionIds]
  );
  return rows;
};

const fetchSourceDocuments = async (sourceDocumentIds) => {
  if (!sourceDocumentIds.length) return [];
  const { rows } = await localPool.query(
    "SELECT * FROM source_document WHERE id = ANY($1)",
    [sourceDocumentIds]
  );
  return rows;
};

const fetchMemoryHookMedia = async (assessmentUnitIds) => {
  if (!assessmentUnitIds.length) return [];
  const { rows } = await localPool.query(
    "SELECT * FROM memory_hook_media WHERE assessment_unit_id = ANY($1) AND is_selected = TRUE",
    [assessmentUnitIds]
  );
  return rows;
};

// ---------------------------------------------------------------------------
// Reference-data (mst_chapter) business-key resolution. Never trust that a
// local numeric id equals the same row in production -- always resolve via
// chapter_number/section_number/topic_name + book/level/exam-goal codes.
// Resolutions are cached into idMap under the `mst_chapter:<localId>` key so
// promoteGenerationTree's generic FK remap (concept, layer1_knowledge_contract)
// picks them up too.
// ---------------------------------------------------------------------------

const resolveChapterId = async (prodClient, localChapterId, idMap) => {
  if (!localChapterId) return null;

  const cacheKey = `mst_chapter:${localChapterId}`;
  if (idMap.has(cacheKey)) return idMap.get(cacheKey);

  const { rows: chapterRows } = await localPool.query(
    "SELECT chapter_number, section_number, topic_name, fk_mst_book_id FROM mst_chapter WHERE id = $1",
    [localChapterId]
  );
  const chapter = chapterRows[0];
  if (!chapter) return null;

  const { rows: bookRows } = await localPool.query(
    "SELECT name_code, fk_mst_level_id, fk_mst_exam_goal_id FROM mst_book WHERE id = $1",
    [chapter.fk_mst_book_id]
  );
  const book = bookRows[0];
  if (!book) return null;

  const { rows: levelRows } = await localPool.query(
    "SELECT name_code FROM mst_level WHERE id = $1",
    [book.fk_mst_level_id]
  );
  const { rows: goalRows } = await localPool.query(
    "SELECT goal_id FROM mst_exam_goal WHERE id = $1",
    [book.fk_mst_exam_goal_id]
  );
  const levelCode = levelRows[0]?.name_code;
  const goalId = goalRows[0]?.goal_id;
  if (!levelCode || !goalId) return null;

  const { rows: prodBookRows } = await prodClient.query(
    `
      SELECT mb.id FROM mst_book mb
      JOIN mst_level lv ON lv.id = mb.fk_mst_level_id
      JOIN mst_exam_goal eg ON eg.id = mb.fk_mst_exam_goal_id
      WHERE mb.name_code = $1 AND lv.name_code = $2 AND eg.goal_id = $3
    `,
    [book.name_code, levelCode, goalId]
  );
  const prodBookId = prodBookRows[0]?.id;
  if (!prodBookId) return null;

  const { rows: prodChapterRows } = await prodClient.query(
    `
      SELECT id FROM mst_chapter
      WHERE fk_mst_book_id = $1 AND chapter_number = $2
        AND section_number IS NOT DISTINCT FROM $3
        AND topic_name IS NOT DISTINCT FROM $4
    `,
    [prodBookId, chapter.chapter_number, chapter.section_number, chapter.topic_name]
  );
  const prodChapterId = prodChapterRows[0]?.id || null;
  if (prodChapterId) idMap.set(cacheKey, prodChapterId);
  return prodChapterId;
};

// Pre-resolves every mst_chapter referenced by concept/layer1_knowledge_contract
// rows for the given generations, so promoteGenerationTree's generic FK remap
// never has to resolve a business key mid-tree-walk.
const preResolveChaptersForGenerations = async (prodClient, generationIds, idMap) => {
  if (!generationIds.length) return;
  const { rows } = await localPool.query(
    `
      SELECT DISTINCT fk_mst_chapter_id FROM concept
        WHERE generation_id = ANY($1) AND fk_mst_chapter_id IS NOT NULL
      UNION
      SELECT DISTINCT fk_mst_chapter_id FROM layer1_knowledge_contract
        WHERE generation_id = ANY($1) AND fk_mst_chapter_id IS NOT NULL
    `,
    [generationIds]
  );
  for (const row of rows) {
    await resolveChapterId(prodClient, row.fk_mst_chapter_id, idMap);
  }
};

// ---------------------------------------------------------------------------
// Upserts for the tables with a genuine cross-environment business key.
// ---------------------------------------------------------------------------

const upsertSourceDocument = async (client, doc) => {
  if (!doc.document_code) {
    throw new Error(
      `source_document id=${doc.id} has no document_code; cannot promote without a stable business key.`
    );
  }
  const { rows } = await client.query(
    `
      INSERT INTO source_document (
        document_code, title, description, source_type, board_name,
        class_name, subject_name, chapter_name, language_code,
        owner_user_id, review_status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NULL,$10)
      ON CONFLICT (document_code) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        source_type = EXCLUDED.source_type,
        board_name = EXCLUDED.board_name,
        class_name = EXCLUDED.class_name,
        subject_name = EXCLUDED.subject_name,
        chapter_name = EXCLUDED.chapter_name,
        language_code = EXCLUDED.language_code,
        updated_at = NOW()
      RETURNING id
    `,
    [
      doc.document_code, doc.title, doc.description, doc.source_type, doc.board_name,
      doc.class_name, doc.subject_name, doc.chapter_name, doc.language_code, doc.review_status,
    ]
  );
  return rows[0].id;
};

const upsertSourceSection = async (client, section, prodSourceDocumentId, prodChapterId) => {
  if (!section.section_code) {
    throw new Error(
      `source_section id=${section.id} has no section_code; cannot promote without a stable business key.`
    );
  }
  const { rows } = await client.query(
    `
      INSERT INTO source_section (
        source_document_id, fk_mst_chapter_id, section_code, section_number,
        title, page_start, page_end, review_status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (source_document_id, section_code) DO UPDATE SET
        fk_mst_chapter_id = EXCLUDED.fk_mst_chapter_id,
        section_number = EXCLUDED.section_number,
        title = EXCLUDED.title,
        page_start = EXCLUDED.page_start,
        page_end = EXCLUDED.page_end,
        updated_at = NOW()
      RETURNING id
    `,
    [
      prodSourceDocumentId, prodChapterId, section.section_code, section.section_number,
      section.title, section.page_start, section.page_end, section.review_status,
    ]
  );
  return rows[0].id;
};

// No natural key (confirmed against init.sql): delete+reinsert scoped to the
// resolved production source_section_id. pipeline_job_id/generation_id are
// nulled -- these are pipeline-run byproducts excluded from promotion scope.
const promoteSectionArtifacts = async (client, localSectionId, prodSectionId) => {
  for (const table of ARTIFACT_TABLES) {
    await client.query(`DELETE FROM ${table} WHERE source_section_id = $1`, [prodSectionId]);

    const { rows } = await localPool.query(
      `SELECT * FROM ${table} WHERE source_section_id = $1`,
      [localSectionId]
    );
    if (!rows.length) continue;

    const columns = await getColumns(client, table);
    const insertColumns = columns.filter((c) => c !== "id" && c !== "source_section_id");

    for (const row of rows) {
      const values = [
        prodSectionId,
        ...insertColumns.map((c) => {
          if (c === "pipeline_job_id" || c === "generation_id") return null;
          return row[c];
        }),
      ];
      const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");
      await client.query(
        `INSERT INTO ${table} (source_section_id, ${insertColumns.join(", ")}) VALUES (${placeholders})`,
        values
      );
    }
  }
};

const upsertLayerGenerationVersion = async (client, row) => {
  // Any previously-selected version for this (assessment_unit_id,
  // layer_number) -- including a same-generationId row from a prior
  // promotion run -- was already cleared by promoteGenerationTree, so this
  // is always a fresh insert.
  await client.query(
    `
      INSERT INTO layer_generation_version (
        assessment_unit_id, layer_number, generation_id, pipeline_job_id,
        version_number, is_selected, token_input, token_output, created_by
      ) VALUES ($1,$2,$3,NULL,$4,TRUE,$5,$6,NULL)
    `,
    [row.assessment_unit_id, row.layer_number, row.generation_id, row.version_number, row.token_input, row.token_output]
  );
};

const upsertAssessmentUnit = async (client, unit, idMap) => {
  const prodSourceSectionId = unit.source_section_id
    ? idMap.get(`source_section:${unit.source_section_id}`) ?? null
    : null;
  const prodChapterId = await resolveChapterId(client, unit.fk_mst_chapter_id, idMap);

  await client.query(
    `
      INSERT INTO assessment_unit (
        generation_id, assessment_unit_id, source_section_id, fk_mst_chapter_id,
        primary_concept, learning_objective, concept_category,
        curriculum_importance, is_active
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (assessment_unit_id) DO UPDATE SET
        generation_id = EXCLUDED.generation_id,
        source_section_id = EXCLUDED.source_section_id,
        fk_mst_chapter_id = EXCLUDED.fk_mst_chapter_id,
        primary_concept = EXCLUDED.primary_concept,
        learning_objective = EXCLUDED.learning_objective,
        concept_category = EXCLUDED.concept_category,
        curriculum_importance = EXCLUDED.curriculum_importance,
        is_active = EXCLUDED.is_active,
        updated_at = NOW()
    `,
    [
      unit.generation_id, unit.assessment_unit_id, prodSourceSectionId, prodChapterId,
      unit.primary_concept, unit.learning_objective, unit.concept_category,
      unit.curriculum_importance, unit.is_active,
    ]
  );
};

const upsertMemoryHookMedia = async (client, media) => {
  await client.query(
    `
      UPDATE memory_hook_media SET is_selected = FALSE
      WHERE assessment_unit_id = $1 AND section_key = $2 AND is_selected = TRUE
    `,
    [media.assessment_unit_id, media.section_key]
  );

  await client.query(
    `
      INSERT INTO memory_hook_media (
        assessment_unit_id, section_key, media_type, source, version_number,
        is_selected, prompt_text, aspect_ratio, media_data, mime_type,
        original_file_name, model_name, status, error_message, created_by
      ) VALUES ($1,$2,$3,$4,$5,TRUE,$6,$7,$8,$9,$10,$11,$12,$13,NULL)
      ON CONFLICT (assessment_unit_id, section_key, version_number) DO UPDATE SET
        media_type = EXCLUDED.media_type,
        source = EXCLUDED.source,
        is_selected = TRUE,
        prompt_text = EXCLUDED.prompt_text,
        aspect_ratio = EXCLUDED.aspect_ratio,
        media_data = EXCLUDED.media_data,
        mime_type = EXCLUDED.mime_type,
        original_file_name = EXCLUDED.original_file_name,
        model_name = EXCLUDED.model_name,
        status = EXCLUDED.status,
        error_message = EXCLUDED.error_message
    `,
    [
      media.assessment_unit_id, media.section_key, media.media_type, media.source,
      media.version_number, media.prompt_text, media.aspect_ratio, media.media_data,
      media.mime_type, media.original_file_name, media.model_name, media.status, media.error_message,
    ]
  );
};

// Emits a fresh "what's new" event for a just-promoted section, timestamped
// at promotion time -- not copied from local, so local iteration noise never
// reaches the student dashboard feed (studentDashboardService.js:435).
const emitContentUpdateEvent = async (client, prodSectionId) => {
  const { rows } = await client.query(
    `
      SELECT
        eg.goal_id AS exam_goal_code,
        lv.name_code AS level_code,
        sub.name_code AS subject_code,
        mc.chapter_number,
        mc.chapter_name,
        ss.section_number,
        mc.topic_name,
        ss.id AS source_section_id,
        mc.id AS fk_mst_chapter_id
      FROM source_section ss
      JOIN mst_chapter mc ON mc.id = ss.fk_mst_chapter_id
      JOIN mst_book mb ON mb.id = mc.fk_mst_book_id
      JOIN mst_level lv ON lv.id = mb.fk_mst_level_id
      JOIN mst_exam_goal eg ON eg.id = mb.fk_mst_exam_goal_id
      JOIN mst_subject sub ON sub.id = mb.fk_mst_subject_id
      WHERE ss.id = $1
    `,
    [prodSectionId]
  );
  const info = rows[0];
  if (!info) return;

  await client.query(
    `
      INSERT INTO content_update_event (
        exam_goal_code, level_code, subject_code, chapter_number, chapter_name,
        section_number, topic_name, source_section_id, fk_mst_chapter_id,
        target_layer_number, pipeline_job_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NULL,NULL)
    `,
    [
      info.exam_goal_code, info.level_code, info.subject_code, info.chapter_number,
      info.chapter_name, info.section_number, info.topic_name, info.source_section_id,
      info.fk_mst_chapter_id,
    ]
  );
};

// ---------------------------------------------------------------------------
// Safety net: pg_dump snapshot of every in-scope table before the write
// transaction, mirroring the server/runtime/audit-logs/ convention
// (assessmentStudioAuditService.js).
// ---------------------------------------------------------------------------

// Each table is a fresh pg_dump subprocess (own connection, own SSH-tunnel
// round trip if applicable) -- with ~50 in-scope tables this can take a
// while even when nothing is wrong, so progress logging isn't cosmetic:
// without it, "slow" and "hung" look identical from the outside. The
// per-table log line is the primary "is this actually stuck" signal; the
// timeout below only exists to turn a genuine indefinite hang (e.g.
// pg_dump silently blocking on an interactive password prompt with no
// stdin attached) into an eventual clear error rather than a freeze --
// kept generous because memory_hook_media holds base64 images/video and a
// real (not stuck) dump of it over a slow tunnel could legitimately take
// a while.
const PG_DUMP_TIMEOUT_MS = 120000;

const backupProductionTables = async () => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = path.join(backupRootDir, timestamp);
  await fs.mkdir(dir, { recursive: true });

  const tables = getInScopeTableList();
  console.log(`Backing up ${tables.length} table(s) to ${dir} ...`);
  const startedAt = Date.now();

  for (let i = 0; i < tables.length; i += 1) {
    const table = tables[i];
    const file = path.join(dir, `${table}.sql`);
    const tableStartedAt = Date.now();
    try {
      await execFileAsync(
        env.pgDumpPath,
        ["--data-only", "--table", table, "--file", file, env.productionDatabaseUrl],
        { timeout: PG_DUMP_TIMEOUT_MS }
      );
      console.log(`  [${i + 1}/${tables.length}] ${table} (${Date.now() - tableStartedAt}ms)`);
    } catch (error) {
      const timedOut = error.killed && error.signal === "SIGTERM";
      throw new Error(
        `pg_dump backup failed for table "${table}" using "${env.pgDumpPath}" after ` +
          `${Date.now() - tableStartedAt}ms${timedOut ? ` (timed out after ${PG_DUMP_TIMEOUT_MS}ms -- ` +
          `likely pg_dump blocked on an interactive prompt, e.g. a password it couldn't parse from the ` +
          `connection string, or the SSH tunnel stalled)` : ""}: ${error.message}`
      );
    }
  }

  console.log(`Pre-promotion backup written to ${dir} (${Date.now() - startedAt}ms total)`);
  return dir;
};

const writePromotionLog = async (data) => {
  await fs.mkdir(logDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(logDir, `${timestamp}.json`);
  await fs.writeFile(file, JSON.stringify({ timestamp, ...data }, null, 2));
  return file;
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const main = async () => {
  const { values: args } = parseArgs({
    options: {
      "dry-run": { type: "boolean", default: false },
      confirm: { type: "boolean", default: false },
      "assessment-unit": { type: "string" },
    },
  });

  if (!args["dry-run"] && !args.confirm) {
    console.error(
      "Refusing to run: pass --dry-run to preview, or --confirm to actually write to production."
    );
    process.exitCode = 1;
    return;
  }

  if (!env.productionDatabaseUrl) {
    console.error("PRODUCTION_DATABASE_URL is not set (see .env.example).");
    process.exitCode = 1;
    return;
  }

  if (isSameConnectionTarget(env.databaseUrl, env.productionDatabaseUrl)) {
    console.error(
      "Refusing to run: DATABASE_URL and PRODUCTION_DATABASE_URL resolve to the same " +
        "host+port+database. This is almost always a misconfiguration (e.g. two identically " +
        "named databases on different servers, with the wrong host copied into one of the env vars)."
    );
    process.exitCode = 1;
    return;
  }

  const prodPool = new Pool({
    connectionString: env.productionDatabaseUrl,
    max: 5,
    connectionTimeoutMillis: 10000,
  });

  try {
    const approvedRows = await fetchApprovedLayerVersions(args["assessment-unit"]);
    if (!approvedRows.length) {
      console.log(
        "Nothing to promote: no approved, selected, completed generations found locally" +
          (args["assessment-unit"] ? ` for assessment unit ${args["assessment-unit"]}.` : ".")
      );
      return;
    }

    const assessmentUnitIds = [...new Set(approvedRows.map((r) => r.assessment_unit_id))];
    const unitsWithLayer1Status = await fetchAssessmentUnitsWithLayer1Status(assessmentUnitIds);

    const promotableUnits = unitsWithLayer1Status.filter((u) => u.layer1_generation_status === "completed");
    const skippedUnits = unitsWithLayer1Status.filter((u) => u.layer1_generation_status !== "completed");

    // layerGenerationIds: assessment_unit_id -> Map<layerNumber, generationId>.
    // Layer 1 is included for every promotable unit (its "approval" gate is
    // generation_registry.status, not a layer_generation_version row -- see
    // generationTree.js); layers 2-7 come from the approved-content query.
    const layerGenerationIdsByUnit = new Map(
      promotableUnits.map((u) => [u.assessment_unit_id, new Map([[1, u.generation_id]])])
    );
    for (const row of approvedRows) {
      const layerMap = layerGenerationIdsByUnit.get(row.assessment_unit_id);
      if (layerMap) layerMap.set(row.layer_number, row.generation_id);
    }
    const allGenerationIds = [...layerGenerationIdsByUnit.values()].flatMap((m) => [...m.values()]);

    const sourceSectionIds = [...new Set(promotableUnits.map((u) => u.source_section_id).filter(Boolean))];
    const sourceSections = await fetchSourceSections(sourceSectionIds);
    const sourceDocumentIds = [...new Set(sourceSections.map((s) => s.source_document_id))];
    const sourceDocuments = await fetchSourceDocuments(sourceDocumentIds);

    const report = {
      assessmentUnits: promotableUnits.length,
      skippedAssessmentUnits: skippedUnits.map((u) => u.assessment_unit_id),
      layerVersions: approvedRows.length,
      sourceSections: sourceSections.length,
      sourceDocuments: sourceDocuments.length,
    };

    if (skippedUnits.length) {
      console.warn(
        `Skipping ${skippedUnits.length} assessment unit(s) whose layer-1 pipeline run is not ` +
          `"completed" locally: ${skippedUnits.map((u) => u.assessment_unit_id).join(", ")}`
      );
    }

    if (args["dry-run"]) {
      console.log("=== DRY RUN: promotion preview ===");
      console.log(JSON.stringify(report, null, 2));

      for (const doc of sourceDocuments) {
        const { rows } = await prodPool.query(
          "SELECT id FROM source_document WHERE document_code = $1",
          [doc.document_code]
        );
        console.log(
          `source_document "${doc.document_code}": ${rows.length ? "exists in prod (will update)" : "new (will insert)"}`
        );
      }

      const idMap = new Map();
      for (const section of sourceSections) {
        const prodChapterId = await resolveChapterId(prodPool, section.fk_mst_chapter_id, idMap);
        console.log(
          `source_section "${section.section_code}": chapter resolves to prod mst_chapter.id=${prodChapterId ?? "MISSING"}` +
            (prodChapterId === null && section.fk_mst_chapter_id
              ? " -- WARNING: promotion would fail here, no matching chapter in production"
              : "")
        );
      }

      console.log(
        `\n${approvedRows.length} layer version(s) across ${promotableUnits.length} assessment unit(s) would be promoted.`
      );
      return;
    }

    console.log(
      `About to promote ${approvedRows.length} layer version(s) across ${promotableUnits.length} assessment unit(s) to ${redactConnectionString(env.productionDatabaseUrl)}.`
    );
    console.log("Proceeding in 3s -- Ctrl+C to abort.");
    await new Promise((resolve) => setTimeout(resolve, 3000));

    await backupProductionTables();

    const client = await prodPool.connect();
    const idMap = new Map();
    const promotedSectionIds = new Set();

    // Each step below is its own batch of individually-awaited round trips
    // to production (no batching/pipelining) -- through a slow connection
    // (e.g. an SSH tunnel) this adds up to real wall-clock time even when
    // nothing is wrong, so every step logs a start line, a per-item
    // progress line, and an elapsed time. Without this, a slow run and a
    // hung run look identical from the terminal.
    const phaseStartedAt = Date.now();
    const logPhase = (label) => console.log(`[${((Date.now() - phaseStartedAt) / 1000).toFixed(1)}s] ${label}`);

    try {
      await client.query("BEGIN");

      logPhase(`Upserting ${sourceDocuments.length} source_document row(s)...`);
      for (const doc of sourceDocuments) {
        const prodId = await upsertSourceDocument(client, doc);
        idMap.set(`source_document:${doc.id}`, prodId);
      }

      logPhase(`Upserting ${sourceSections.length} source_section row(s) (+ image/OCR/parse artifacts)...`);
      for (const section of sourceSections) {
        const prodSourceDocumentId = idMap.get(`source_document:${section.source_document_id}`);
        const prodChapterId = await resolveChapterId(client, section.fk_mst_chapter_id, idMap);
        const prodId = await upsertSourceSection(client, section, prodSourceDocumentId, prodChapterId);
        idMap.set(`source_section:${section.id}`, prodId);
        await promoteSectionArtifacts(client, section.id, prodId);
        promotedSectionIds.add(prodId);
      }

      await preResolveChaptersForGenerations(client, allGenerationIds, idMap);

      // A single layer-1 generation_id is routinely shared across every
      // assessment unit the pipeline produced from the same source section,
      // so old/new generation ids are collected across the WHOLE batch and
      // cleared/inserted once -- per-unit would double-clear and
      // double-insert shared rows (see generationTree.js).
      const oldGenerationIds = new Set();
      for (const unit of promotableUnits) {
        const retiredIds = await findGenerationIdsToRetire(
          client,
          unit.assessment_unit_id,
          layerGenerationIdsByUnit.get(unit.assessment_unit_id)
        );
        for (const id of retiredIds) oldGenerationIds.add(id);
      }
      const newGenerationIds = [...new Set(allGenerationIds)];

      // Ordering is load-bearing and deliberately never deletes
      // assessment_unit (see generationTree.js's header comment on
      // clearGenerationContentTables -- a real production DB has
      // student_response rows CASCADE-deleting off assessment_unit):
      //   1. register new generation_registry rows (ON CONFLICT DO NOTHING)
      //   2. upsert assessment_unit IN PLACE, repointing generation_id at
      //      the new (now-existing) layer-1 generation
      //   3. only now retire superseded generations -- assessment_unit no
      //      longer references them, so their generation_registry rows can
      //      finally be deleted safely
      //   4. clear any stale rows already at the new generation ids
      //      (idempotent-rerun case) and insert fresh content
      logPhase(`Registering ${newGenerationIds.length} generation_registry row(s)...`);
      const newRegistrationsCount = await registerNewGenerations({ localPool, prodClient: client, newGenerationIds });

      logPhase(`Upserting ${promotableUnits.length} assessment_unit row(s)...`);
      for (const unit of promotableUnits) {
        await upsertAssessmentUnit(client, unit, idMap);
      }

      logPhase(`Retiring ${oldGenerationIds.size} superseded generation(s)...`);
      await retireSupersededGenerations(client, [...oldGenerationIds]);
      await clearGenerationContentTablesForReinsert(client, newGenerationIds);

      logPhase(
        `Inserting generation content across ${GENERATION_PARENT_TABLES.length + GENERATION_CHILD_TABLES.length} tables ` +
          `for ${newGenerationIds.length} generation(s) -- this is usually the slowest step, one row = one round trip...`
      );
      await insertGenerationContent({
        localPool,
        prodClient: client,
        newGenerationIds,
        idMap,
        onTableComplete: ({ table, rowCount, elapsedMs, tableIndex, tableCount }) => {
          if (rowCount > 0) {
            logPhase(`  [${tableIndex}/${tableCount}] ${table}: ${rowCount} row(s) (${elapsedMs}ms)`);
          }
        },
      });

      logPhase(`Upserting ${approvedRows.length} layer_generation_version row(s)...`);
      for (const row of approvedRows) {
        if (!layerGenerationIdsByUnit.has(row.assessment_unit_id)) continue;
        await upsertLayerGenerationVersion(client, row);
      }

      const mediaRows = await fetchMemoryHookMedia(promotableUnits.map((u) => u.assessment_unit_id));
      logPhase(`Upserting ${mediaRows.length} memory_hook_media row(s)...`);
      for (const media of mediaRows) {
        await upsertMemoryHookMedia(client, media);
      }

      // Only announce "what's new" if something was genuinely new this run
      // (a real generation registered, or a generation retired/replaced) --
      // a true no-op rerun (nothing changed locally) must not re-spam the
      // student feed with duplicate identical events.
      if (newRegistrationsCount > 0 || oldGenerationIds.size > 0) {
        logPhase(`Emitting content_update_event for ${promotedSectionIds.size} section(s)...`);
        for (const prodSectionId of promotedSectionIds) {
          await emitContentUpdateEvent(client, prodSectionId);
        }
      } else {
        logPhase("No new or changed generations this run -- skipping content_update_event (no-op rerun).");
      }

      logPhase("Committing...");
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    const logFile = await writePromotionLog({ ...report, mode: "promoted" });
    logPhase(`Promotion committed. Log: ${logFile}`);
  } finally {
    await prodPool.end();
    await localPool.end();
  }
};

main().catch((error) => {
  console.error("Promotion failed:", error);
  process.exitCode = 1;
});
