import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../db/pool.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "../..", "..");
const auditLogDir = path.join(workspaceRoot, "server", "runtime", "audit-logs");

const ensureAuditDirectory = async () => {
  await fs.mkdir(auditLogDir, { recursive: true });
};

const normalizeJson = (value) => {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  return value;
};

const formatJson = (value) => JSON.stringify(value ?? null, null, 2);

const buildAuditText = (snapshot) => {
  const lines = [
    `Pipeline Audit Log`,
    `Job ID: ${snapshot.job.jobId}`,
    `Status: ${snapshot.job.status}`,
    `Created At: ${snapshot.job.createdAt || ""}`,
    `Updated At: ${snapshot.job.updatedAt || ""}`,
    `Source Section ID: ${snapshot.job.sourceSectionId ?? ""}`,
    `Source Document ID: ${snapshot.job.sourceDocumentId ?? ""}`,
    `MST Chapter ID: ${snapshot.job.fkMstChapterId ?? ""}`,
    "",
    "REQUEST PAYLOAD",
    formatJson(snapshot.job.requestPayload),
    "",
    "LAYERS",
    "",
  ];

  snapshot.layers.forEach((layer, index) => {
    lines.push(`Layer Entry ${index + 1}`);
    lines.push(`Layer Number: ${layer.layerNumber}`);
    lines.push(`Layer Name: ${layer.layerName}`);
    lines.push(`Assessment Unit ID: ${layer.assessmentUnitId || ""}`);
    lines.push(`Status: ${layer.status}`);
    lines.push(`Is Cached: ${layer.isCached}`);
    lines.push(`Generation ID: ${layer.generationId || ""}`);
    lines.push(`Generation Source Job ID: ${layer.generationPipelineJobId || ""}`);
    lines.push(`Prompt Version: ${layer.promptVersion || ""}`);
    lines.push(`Model: ${layer.modelName || ""}`);
    lines.push(`OpenAI Response ID: ${layer.openAiResponseId || ""}`);
    lines.push(`Token Input: ${layer.tokenInput ?? 0}`);
    lines.push(`Token Output: ${layer.tokenOutput ?? 0}`);
    lines.push(`Created At: ${layer.createdAt || ""}`);
    lines.push(`Updated At: ${layer.updatedAt || ""}`);
    lines.push("");
    lines.push("INPUT JSON");
    lines.push(formatJson(layer.inputJson));
    lines.push("");
    lines.push("OUTPUT JSON");
    lines.push(formatJson(layer.outputJson));
    lines.push("");
    lines.push("-".repeat(80));
    lines.push("");
  });

  return lines.join("\n");
};

export const getAssessmentStudioAuditSnapshot = async (jobId) => {
  const runResult = await pool.query(
    `
      SELECT
        job_id,
        source_document_id,
        source_section_id,
        fk_mst_chapter_id,
        request_payload,
        status,
        created_at,
        updated_at
      FROM assessment_pipeline_run
      WHERE job_id = $1
    `,
    [jobId]
  );

  const job = runResult.rows[0];
  if (!job) {
    return null;
  }

  const layerResult = await pool.query(
    `
      SELECT
        aprl.id,
        aprl.job_id,
        aprl.generation_id,
        aprl.layer_number,
        aprl.layer_name,
        aprl.source_section_id,
        aprl.assessment_unit_id,
        aprl.prompt_version,
        aprl.model_name,
        aprl.status,
        aprl.is_cached,
        aprl.token_input,
        aprl.token_output,
        aprl.openai_response_id,
        aprl.created_at,
        aprl.updated_at,
        gr.pipeline_job_id AS generation_pipeline_job_id,
        lic.input_json,
        loc.output_json
      FROM assessment_pipeline_run_layer aprl
      LEFT JOIN generation_registry gr
        ON gr.generation_id = aprl.generation_id
      LEFT JOIN layer_input_contract lic
        ON lic.generation_id = aprl.generation_id
      LEFT JOIN layer_output_contract loc
        ON loc.generation_id = aprl.generation_id
      WHERE aprl.job_id = $1
      ORDER BY aprl.layer_number ASC, aprl.created_at ASC, aprl.id ASC
    `,
    [jobId]
  );

  const snapshot = {
    job: {
      jobId: job.job_id,
      sourceDocumentId: job.source_document_id,
      sourceSectionId: job.source_section_id,
      fkMstChapterId: job.fk_mst_chapter_id,
      requestPayload: normalizeJson(job.request_payload),
      status: job.status,
      createdAt: job.created_at,
      updatedAt: job.updated_at,
    },
    layers: layerResult.rows.map((row) => ({
      id: row.id,
      jobId: row.job_id,
      generationId: row.generation_id,
      generationPipelineJobId: row.generation_pipeline_job_id,
      layerNumber: row.layer_number,
      layerName: row.layer_name,
      sourceSectionId: row.source_section_id,
      assessmentUnitId: row.assessment_unit_id,
      promptVersion: row.prompt_version,
      modelName: row.model_name,
      status: row.status,
      isCached: row.is_cached,
      tokenInput: row.token_input,
      tokenOutput: row.token_output,
      openAiResponseId: row.openai_response_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      inputJson: normalizeJson(row.input_json),
      outputJson: normalizeJson(row.output_json),
    })),
  };

  return snapshot;
};

export const exportAssessmentStudioAuditText = async (jobId) => {
  const snapshot = await getAssessmentStudioAuditSnapshot(jobId);
  if (!snapshot) {
    return null;
  }

  await ensureAuditDirectory();
  const fileName = `${jobId}.txt`;
  const filePath = path.join(auditLogDir, fileName);
  const text = buildAuditText(snapshot);
  await fs.writeFile(filePath, text, "utf8");

  return {
    snapshot,
    text,
    fileName,
    filePath,
  };
};
