// Promotes one assessment unit's row-tree (layer1-7 content tables) from
// local to production. Reuses this app's own maintained table-order lists
// (GENERATION_PARENT_TABLES / GENERATION_CHILD_TABLES / BACKREF_UPDATES,
// exercised every time an admin deletes a pipeline run) as the single source
// of truth for dependency order, instead of re-deriving/duplicating it here.
//
// Important: generation_registry has one row PER LAYER (layer_number is a
// column on it), not one row per assessment unit or per pipeline job. A
// single assessment unit's content tree is therefore spread across several
// generation_id values -- one per layer that contributed to it -- which is
// exactly why cascadeDeleteGenerations (and this promotion code) always
// operates on an array of generation ids with `= ANY($1)`, matching each
// table to whichever of those ids it actually carries.
import {
  GENERATION_CHILD_TABLES,
  GENERATION_PARENT_TABLES,
  GENERATION_BACKREF_UPDATES,
} from "../../src/services/assessmentStudioService.js";
import { getColumns, getForeignKeys } from "./introspect.js";

export { GENERATION_CHILD_TABLES, GENERATION_PARENT_TABLES };

// Deletes only the generation-tree content tables (never assessment_unit,
// never generation_registry itself) for the given generation ids. Safe to
// call for both superseded AND about-to-be-reinserted generation ids.
//
// assessment_unit is deliberately NEVER deleted by promotion. In a real
// production DB (unlike the empty scratch DB this was developed against),
// assessment_unit is referenced by student_response.assessment_unit_id with
// ON DELETE CASCADE -- deleting an assessment_unit row, even to immediately
// reinsert one with the same business key, would permanently destroy real
// students' answer history (a new row's `id` does not retroactively
// re-satisfy an FK match that already cascaded on delete). assessment_unit
// is always upserted in place instead (see promoteContent.js).
const clearGenerationContentTables = async (client, generationIds) => {
  const ids = generationIds.filter(Boolean);
  if (!ids.length) return;

  const params = [ids];

  for (const table of GENERATION_CHILD_TABLES) {
    await client.query(`DELETE FROM ${table} WHERE generation_id = ANY($1)`, params);
  }
  for (const table of GENERATION_PARENT_TABLES) {
    await client.query(`DELETE FROM ${table} WHERE generation_id = ANY($1)`, params);
  }

  await client.query(
    "DELETE FROM layer_generation_version WHERE generation_id = ANY($1)",
    params
  );
};

// Retires generations no longer selected for anything (the assessment_unit
// row was already repointed away from them by the time this runs -- see
// promoteContent.js's ordering). Nulls dangling backreferences from
// out-of-scope tables (layer_run, question_bank_item, student_response,
// student_mastery) first, mirroring cascadeDeleteGenerations, then deletes
// the now-unreferenced generation_registry rows themselves.
export const retireSupersededGenerations = async (client, oldGenerationIds) => {
  const ids = oldGenerationIds.filter(Boolean);
  if (!ids.length) return;

  await clearGenerationContentTables(client, ids);

  const params = [ids];
  for (const sql of GENERATION_BACKREF_UPDATES) {
    await client.query(sql, params);
  }
  await client.query("DELETE FROM generation_registry WHERE generation_id = ANY($1)", params);
};

const remapRow = (table, row, foreignKeys, idMap) => {
  const remapped = { ...row };

  for (const fk of foreignKeys) {
    // Only bare-serial-id references need remapping. generation_id (->
    // generation_registry) and business-key text FKs (e.g. assessment_unit_id)
    // are portable across environments as-is.
    if (fk.refColumn !== "id") continue;

    const value = remapped[fk.column];
    if (value === null || value === undefined) continue;

    const key = `${fk.refTable}:${value}`;
    if (!idMap.has(key)) {
      throw new Error(
        `Cannot promote ${table}.${fk.column} -> ${fk.refTable}.id = ${value}: ` +
          `no production id recorded for that row yet. Check table promotion order.`
      );
    }
    remapped[fk.column] = idMap.get(key);
  }

  return remapped;
};

const insertRow = async (client, table, row) => {
  const columns = await getColumns(client, table);
  const insertColumns = columns.filter((c) => c !== "id");
  const values = insertColumns.map((c) => row[c]);
  const placeholders = insertColumns.map((_, i) => `$${i + 1}`).join(", ");

  const { rows } = await client.query(
    `INSERT INTO ${table} (${insertColumns.join(", ")}) VALUES (${placeholders}) RETURNING id`,
    values
  );
  return rows[0].id;
};

// Finds, per layer, whichever generation_id production currently has
// selected for this assessment unit -- layer 1 has no layer_generation_version
// row (it defaults to "approved" purely from generation_registry.status, per
// moderationService.js), so its previous generation is read off
// assessment_unit.generation_id instead. Exported so the caller can collect
// this across every unit in the run BEFORE clearing anything (a single
// layer-1 generation_id is typically shared by every assessment unit the
// pipeline produced from the same section, so retirement/clearing must be
// computed and applied once globally, not per unit -- see below).
export const findGenerationIdsToRetire = async (prodClient, assessmentUnitId, layerGenerationIds) => {
  const toRetire = [];

  if (layerGenerationIds.has(1)) {
    const { rows } = await prodClient.query(
      "SELECT generation_id FROM assessment_unit WHERE assessment_unit_id = $1",
      [assessmentUnitId]
    );
    const oldId = rows[0]?.generation_id || null;
    if (oldId && oldId !== layerGenerationIds.get(1)) toRetire.push(oldId);
  }

  for (const [layerNumber, generationId] of layerGenerationIds) {
    if (layerNumber === 1) continue;
    const { rows } = await prodClient.query(
      `SELECT generation_id FROM layer_generation_version
       WHERE assessment_unit_id = $1 AND layer_number = $2 AND is_selected = TRUE`,
      [assessmentUnitId, layerNumber]
    );
    const oldId = rows[0]?.generation_id || null;
    if (oldId && oldId !== generationId) toRetire.push(oldId);
  }

  return toRetire;
};

// newGenerationIds is the UNION across every assessment unit in this
// promotion run (deduplicated) -- NOT scoped to one unit. A single layer-1
// generation_id is routinely shared by every assessment unit the pipeline
// produced from the same source section (one layer-1 run extracts a whole
// section's concepts/units at once), so registering/inserting per-unit would
// double-insert shared rows and corrupt idMap.
//
// ON CONFLICT DO NOTHING makes this safe to call even on an idempotent
// rerun where a "new" generation_id is actually unchanged from what's
// already in production (nothing local changed since the last promotion).
// Must run BEFORE upsertAssessmentUnit, since assessment_unit.generation_id
// requires the row to already exist.
// Returns the count of generation_registry rows ACTUALLY inserted (via
// rowCount, since ON CONFLICT DO NOTHING silently no-ops for unchanged
// generation ids) -- the caller uses this to decide whether anything
// genuinely new happened this run, so a true no-op rerun doesn't emit
// duplicate content_update_event rows.
export const registerNewGenerations = async ({ localPool, prodClient, newGenerationIds }) => {
  let insertedCount = 0;
  for (const generationId of newGenerationIds) {
    const { rows: registryRows } = await localPool.query(
      "SELECT * FROM generation_registry WHERE generation_id = $1",
      [generationId]
    );
    if (!registryRows.length) {
      throw new Error(`generation_registry row not found locally for ${generationId}`);
    }
    const columns = await getColumns(prodClient, "generation_registry");
    const insertColumns = columns.filter((c) => c !== "id");
    const row = { ...registryRows[0], pipeline_job_id: null, created_by: null };
    const values = insertColumns.map((c) => row[c]);
    const placeholders = insertColumns.map((_, i) => `$${i + 1}`).join(", ");
    const result = await prodClient.query(
      `INSERT INTO generation_registry (${insertColumns.join(", ")}) VALUES (${placeholders})
       ON CONFLICT (generation_id) DO NOTHING`,
      values
    );
    insertedCount += result.rowCount;
  }
  return insertedCount;
};

// Clears any pre-existing rows for newGenerationIds before reinserting --
// covers the idempotent-rerun case where content tables already hold rows
// for an unchanged generation_id from the prior promotion. Call AFTER
// assessment_unit has been upserted (see promoteContent.js ordering).
export const clearGenerationContentTablesForReinsert = clearGenerationContentTables;

// onTableComplete: optional ({ table, rowCount, elapsedMs, tableIndex,
// tableCount }) => void, called after each table finishes -- each row is
// one individually-awaited round trip to production, so on a slow
// connection this whole function can take a long time even when nothing is
// wrong. Without per-table progress, a slow run and a hung run are
// indistinguishable from the caller's side.
export const insertGenerationContent = async ({
  localPool,
  prodClient,
  newGenerationIds,
  idMap,
  onTableComplete,
}) => {
  const allTables = [...GENERATION_PARENT_TABLES, ...GENERATION_CHILD_TABLES];
  let tableIndex = 0;

  for (const table of GENERATION_PARENT_TABLES) {
    tableIndex += 1;
    const startedAt = Date.now();
    const foreignKeys = await getForeignKeys(prodClient, table);
    const { rows } = await localPool.query(
      `SELECT * FROM ${table} WHERE generation_id = ANY($1)`,
      [newGenerationIds]
    );
    for (const row of rows) {
      const remapped = remapRow(table, row, foreignKeys, idMap);
      const newId = await insertRow(prodClient, table, remapped);
      idMap.set(`${table}:${row.id}`, newId);
    }
    onTableComplete?.({
      table, rowCount: rows.length, elapsedMs: Date.now() - startedAt,
      tableIndex, tableCount: allTables.length,
    });
  }

  for (const table of GENERATION_CHILD_TABLES) {
    tableIndex += 1;
    const startedAt = Date.now();
    const foreignKeys = await getForeignKeys(prodClient, table);
    const { rows } = await localPool.query(
      `SELECT * FROM ${table} WHERE generation_id = ANY($1)`,
      [newGenerationIds]
    );
    for (const row of rows) {
      const remapped = remapRow(table, row, foreignKeys, idMap);
      await insertRow(prodClient, table, remapped);
    }
    onTableComplete?.({
      table, rowCount: rows.length, elapsedMs: Date.now() - startedAt,
      tableIndex, tableCount: allTables.length,
    });
  }
};

// layer_run is NOT part of GENERATION_PARENT_TABLES/CHILD_TABLES (it's the
// app's own delete-order list for cascadeDeleteGenerations, deliberately
// left untouched here to avoid affecting the unrelated admin
// delete-generation feature) and was originally excluded from promotion
// entirely as "local-only pipeline bookkeeping, never read by student-facing
// code." That assumption was wrong: getLatestLayer1GenerationForSection()
// (assessmentStudioContextAssembler.js) -- the sole path flashcards,
// diagrams, and section-overview text use to find their active generation
// -- reads layer_run directly. Without it promoted, those three features
// silently return empty even though their actual content
// (layer1_terminology/layer1_diagram/layer1_knowledge_contract) promoted
// fine. Call this after source_document/source_section/chapter resolution
// (Tier 1-3) so idMap already has what remapRow needs for
// source_document_id/source_section_id/fk_mst_chapter_id.
export const promoteLayerRunRows = async ({ localPool, prodClient, newGenerationIds, idMap }) => {
  const ids = newGenerationIds.filter(Boolean);
  if (!ids.length) return;

  // Idempotent-rerun safety, same reasoning as clearGenerationContentTables:
  // an unchanged generation_id may already have rows here from a prior
  // promotion. Superseded generations don't need this -- layer_run.generation_id
  // is ON DELETE CASCADE, so retireSupersededGenerations's generation_registry
  // delete already takes care of those.
  await prodClient.query("DELETE FROM layer_run WHERE generation_id = ANY($1)", [ids]);

  const foreignKeys = await getForeignKeys(prodClient, "layer_run");
  const { rows } = await localPool.query("SELECT * FROM layer_run WHERE generation_id = ANY($1)", [ids]);

  for (const row of rows) {
    // Null these BEFORE remapping, not after -- created_by is a bare-id FK
    // to users(id) (users are never promoted, so idMap has no entry for it
    // and remapRow would throw), and pipeline_job_id/parent_generation_id
    // reference tables/generations outside promotion scope. remapRow already
    // skips null values, so nulling first sidesteps all three instead of
    // remapping them and overwriting afterwards.
    const preparedRow = { ...row, pipeline_job_id: null, parent_generation_id: null, created_by: null };
    const remapped = remapRow("layer_run", preparedRow, foreignKeys, idMap);
    await insertRow(prodClient, "layer_run", remapped);
  }
};
