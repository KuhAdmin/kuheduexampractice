import { pool } from "../db/pool.js";
import {
  getAssessmentUnitsForSourceSection,
  getLayer1Context,
  getLayer2Memory,
  getLayer3Capability,
  getLayer4Strategy,
  getLayer5Blueprint,
  getLayer6Items,
  getLayer7Support,
} from "./assessmentStudioContextAssembler.js";
import { getAssessmentStudioSections } from "./catalogService.js";
import * as conceptCardCache from "./conceptCardCache.js";

// Display-only labels; kept local rather than importing the (unexported)
// pipelineDefinitions from assessmentStudioService.js.
const LAYER_NAMES = [
  "Knowledge Extraction",
  "Concept Memory",
  "Assessment Capability",
  "Assessment Strategy",
  "Blueprint Generation",
  "Item Generation",
  "Learning Support",
];

const getLayerName = (layerNumber) => LAYER_NAMES[layerNumber - 1] || `Layer ${layerNumber}`;

const getSectionDisplayInfo = async (sourceSectionId) => {
  const sectionResult = await pool.query(
    "SELECT section_code, section_number FROM source_section WHERE id = $1",
    [sourceSectionId]
  );
  const section = sectionResult.rows[0];
  if (!section) {
    return { chapterName: null, sectionNumber: null, topicName: null };
  }

  const [bookId, chapterNumber, sectionNumber] = String(section.section_code || "").split(":");
  if (!bookId || !chapterNumber || !sectionNumber) {
    return { chapterName: null, sectionNumber: section.section_number, topicName: null };
  }

  const catalogResult = await pool.query(
    `
      SELECT chapter_name, topic_name
      FROM mv_chapter_catalog
      WHERE book_id = $1 AND chapter_number = $2 AND section_number = $3
      LIMIT 1
    `,
    [bookId, chapterNumber, sectionNumber]
  );

  return {
    chapterName: catalogResult.rows[0]?.chapter_name || null,
    sectionNumber,
    topicName: catalogResult.rows[0]?.topic_name || null,
  };
};

const shapeTask = (row) => {
  const dueAt = row.due_at ? new Date(row.due_at) : null;
  const isOpen = row.status === "assigned" || row.status === "moderator_reviewed";
  const isRunningLate = Boolean(isOpen && dueAt && dueAt.getTime() < Date.now());

  return {
    reviewQueueId: row.id,
    sourceSectionId: row.entity_id,
    layerNumber: row.layer_number,
    layerName: getLayerName(row.layer_number),
    status: row.status,
    dueAt: row.due_at,
    isRunningLate,
    assignedTo: row.assigned_to,
    assignedToName: row.assigned_to_name,
    createdBy: row.created_by,
    createdAt: row.created_at,
    chapterName: row.chapter_name,
    sectionNumber: row.section_number,
    topicName: row.topic_name,
  };
};

export const assignReviewTask = async ({ sourceSectionId, layerNumber, moderatorUserId, adminUserId, dueAt }) => {
  const layer = Number(layerNumber);
  if (!Number.isInteger(layer) || layer < 1 || layer > 7) {
    const error = new Error("layerNumber must be between 1 and 7.");
    error.statusCode = 400;
    throw error;
  }

  const inserted = await pool.query(
    `
      INSERT INTO review_queue (entity_type, entity_id, layer_number, status, assigned_to, created_by, due_at)
      VALUES ('section_layer', $1, $2, 'assigned', $3, $4, $5)
      RETURNING id
    `,
    [sourceSectionId, layer, moderatorUserId, adminUserId, dueAt || null]
  );

  return { reviewQueueId: inserted.rows[0].id };
};

// Sections whose target layer has finished generating but that have no
// review_queue row yet for that layer (regardless of status) — the pool an
// admin can pick from on the "Assign Review Task" form.
export const listAssignableSections = async ({ levelCode, subjectCode, chapterKey, layerNumber }) => {
  const layer = Number(layerNumber);
  if (!chapterKey || !Number.isInteger(layer) || layer < 1 || layer > 7) {
    return { sections: [] };
  }

  const { sections } = await getAssessmentStudioSections({
    levelCode,
    subjectCode,
    chapterKey,
    targetLayerNumber: layer,
  });

  const generatedSections = sections.filter((section) => section.completed);
  if (!generatedSections.length) {
    return { sections: [] };
  }

  const sectionCodeBySectionNumber = new Map(
    generatedSections.map((section) => [section.sectionNumber, `${chapterKey}:${section.sectionNumber}`])
  );

  const sourceSectionResult = await pool.query(
    `SELECT id, section_code FROM source_section WHERE section_code = ANY($1::text[])`,
    [[...sectionCodeBySectionNumber.values()]]
  );
  const sourceSectionIdByCode = new Map(
    sourceSectionResult.rows.map((row) => [row.section_code, row.id])
  );

  const candidateIds = [...sourceSectionIdByCode.values()];
  const assignedResult = candidateIds.length
    ? await pool.query(
        `
          SELECT DISTINCT entity_id
          FROM review_queue
          WHERE entity_type = 'section_layer' AND layer_number = $1 AND entity_id = ANY($2::bigint[])
        `,
        [layer, candidateIds]
      )
    : { rows: [] };
  const assignedIds = new Set(assignedResult.rows.map((row) => String(row.entity_id)));

  const assignableSections = generatedSections
    .map((section) => {
      const sourceSectionId = sourceSectionIdByCode.get(sectionCodeBySectionNumber.get(section.sectionNumber));
      return sourceSectionId
        ? { sectionNumber: section.sectionNumber, topicName: section.topicName, sourceSectionId }
        : null;
    })
    .filter(Boolean)
    .filter((section) => !assignedIds.has(String(section.sourceSectionId)));

  return { sections: assignableSections };
};

const listTasksBase = async (whereClause, params) => {
  const result = await pool.query(
    `
      SELECT
        rq.id,
        rq.entity_id,
        rq.layer_number,
        rq.status,
        rq.due_at,
        rq.assigned_to,
        moderator.name AS assigned_to_name,
        rq.created_by,
        rq.created_at,
        ss.section_code
      FROM review_queue rq
      LEFT JOIN users moderator ON moderator.id = rq.assigned_to
      LEFT JOIN source_section ss ON ss.id = rq.entity_id
      WHERE rq.entity_type = 'section_layer' ${whereClause}
      ORDER BY rq.created_at DESC
    `,
    params
  );

  const tasks = [];
  for (const row of result.rows) {
    const display = await getSectionDisplayInfo(row.entity_id);
    tasks.push(
      shapeTask({
        ...row,
        chapter_name: display.chapterName,
        section_number: display.sectionNumber,
        topic_name: display.topicName,
      })
    );
  }
  return tasks;
};

export const listTasksForModerator = async (moderatorUserId) =>
  listTasksBase("AND rq.assigned_to = $1", [moderatorUserId]);

export const listAllTasksForAdmin = async () => listTasksBase("", []);

export const getReviewTaskDetail = async (reviewQueueId) => {
  const taskResult = await pool.query(
    `
      SELECT
        rq.id, rq.entity_id, rq.layer_number, rq.status, rq.due_at,
        rq.assigned_to, rq.created_by, rq.created_at
      FROM review_queue rq
      WHERE rq.id = $1 AND rq.entity_type = 'section_layer'
    `,
    [reviewQueueId]
  );
  const task = taskResult.rows[0];
  if (!task) {
    return null;
  }

  const display = await getSectionDisplayInfo(task.entity_id);
  const assessmentUnitIds = await getAssessmentUnitsForSourceSection(task.entity_id);

  const units = [];
  for (const assessmentUnitId of assessmentUnitIds) {
    let content = null;
    switch (task.layer_number) {
      case 1:
        content = await getLayer1Context(assessmentUnitId);
        break;
      case 2:
        content = await getLayer2Memory(assessmentUnitId);
        break;
      case 3:
        content = await getLayer3Capability(assessmentUnitId);
        break;
      case 4:
        content = await getLayer4Strategy(assessmentUnitId);
        break;
      case 5:
        content = await getLayer5Blueprint(assessmentUnitId);
        break;
      case 6:
        content = await getLayer6Items(assessmentUnitId);
        break;
      case 7:
        content = await getLayer7Support(assessmentUnitId);
        break;
      default:
        content = null;
    }

    const versionResult = await pool.query(
      "SELECT is_selected, approval_status FROM layer_generation_version WHERE assessment_unit_id = $1 AND layer_number = $2 AND is_selected = TRUE",
      [assessmentUnitId, task.layer_number]
    );

    units.push({
      assessmentUnitId,
      approvalStatus: versionResult.rows[0]?.approval_status || (task.layer_number === 1 ? "approved" : "unversioned"),
      content,
    });
  }

  const decisionsResult = await pool.query(
    `
      SELECT decision, decision_notes, decided_by, decided_at, u.name AS decided_by_name
      FROM review_decision rd
      LEFT JOIN users u ON u.id = rd.decided_by
      WHERE review_queue_id = $1
      ORDER BY decided_at ASC
    `,
    [reviewQueueId]
  );

  return {
    reviewQueueId: task.id,
    sourceSectionId: task.entity_id,
    layerNumber: task.layer_number,
    layerName: getLayerName(task.layer_number),
    status: task.status,
    dueAt: task.due_at,
    assignedTo: task.assigned_to,
    createdBy: task.created_by,
    chapterName: display.chapterName,
    sectionNumber: display.sectionNumber,
    topicName: display.topicName,
    units,
    decisions: decisionsResult.rows.map((row) => ({
      decision: row.decision,
      notes: row.decision_notes,
      decidedBy: row.decided_by,
      decidedByName: row.decided_by_name,
      decidedAt: row.decided_at,
    })),
  };
};

const MODERATOR_DECISIONS = ["approve", "request_changes", "reject"];
const ADMIN_DECISIONS = ["admin_approve", "admin_reject"];

export const submitModeratorDecision = async ({ reviewQueueId, moderatorUserId, decision, notes }) => {
  if (!MODERATOR_DECISIONS.includes(decision)) {
    const error = new Error(`decision must be one of: ${MODERATOR_DECISIONS.join(", ")}.`);
    error.statusCode = 400;
    throw error;
  }

  const taskResult = await pool.query(
    "SELECT id, entity_id, layer_number, assigned_to, status FROM review_queue WHERE id = $1 AND entity_type = 'section_layer'",
    [reviewQueueId]
  );
  const task = taskResult.rows[0];
  if (!task || String(task.assigned_to) !== String(moderatorUserId)) {
    return null;
  }
  if (task.status !== "assigned") {
    const error = new Error("This task has already been reviewed.");
    error.statusCode = 409;
    throw error;
  }

  await pool.query(
    "INSERT INTO review_decision (review_queue_id, decision, decision_notes, decided_by) VALUES ($1, $2, $3, $4)",
    [reviewQueueId, decision, notes || null, moderatorUserId]
  );

  if (decision === "request_changes" || decision === "reject") {
    const assessmentUnitIds = await getAssessmentUnitsForSourceSection(task.entity_id);
    if (assessmentUnitIds.length) {
      await pool.query(
        `
          UPDATE layer_generation_version
          SET approval_status = 'rejected'
          WHERE assessment_unit_id = ANY($1) AND layer_number = $2 AND is_selected = TRUE
        `,
        [assessmentUnitIds, task.layer_number]
      );
      assessmentUnitIds.forEach((id) => conceptCardCache.invalidate(id));
    }
  }

  await pool.query("UPDATE review_queue SET status = 'moderator_reviewed', updated_at = NOW() WHERE id = $1", [
    reviewQueueId,
  ]);

  return { reviewQueueId, status: "moderator_reviewed" };
};

export const submitAdminFinalDecision = async ({ reviewQueueId, adminUserId, decision, notes }) => {
  if (!ADMIN_DECISIONS.includes(decision)) {
    const error = new Error(`decision must be one of: ${ADMIN_DECISIONS.join(", ")}.`);
    error.statusCode = 400;
    throw error;
  }

  const taskResult = await pool.query(
    "SELECT id, entity_id, layer_number, status FROM review_queue WHERE id = $1 AND entity_type = 'section_layer'",
    [reviewQueueId]
  );
  const task = taskResult.rows[0];
  if (!task) {
    return null;
  }
  if (task.status !== "moderator_reviewed") {
    const error = new Error("This task is not awaiting admin approval.");
    error.statusCode = 409;
    throw error;
  }

  await pool.query(
    "INSERT INTO review_decision (review_queue_id, decision, decision_notes, decided_by) VALUES ($1, $2, $3, $4)",
    [reviewQueueId, decision, notes || null, adminUserId]
  );

  if (decision === "admin_approve") {
    const assessmentUnitIds = await getAssessmentUnitsForSourceSection(task.entity_id);
    if (assessmentUnitIds.length) {
      await pool.query(
        `
          UPDATE layer_generation_version
          SET approval_status = 'approved'
          WHERE assessment_unit_id = ANY($1) AND layer_number = $2 AND is_selected = TRUE
        `,
        [assessmentUnitIds, task.layer_number]
      );
      assessmentUnitIds.forEach((id) => conceptCardCache.invalidate(id));
    }
  }

  const nextStatus = decision === "admin_approve" ? "admin_approved" : "admin_rejected";
  await pool.query("UPDATE review_queue SET status = $2, updated_at = NOW() WHERE id = $1", [
    reviewQueueId,
    nextStatus,
  ]);

  return { reviewQueueId, status: nextStatus };
};
