import {
  importPreWarmupContent,
  normalizePreWarmupPayload,
  validatePreWarmupPayload,
} from "../services/preWarmupImportService.js";

// Plain synchronous request/response -- unlike Concept Import this writes a
// single row (one JSON blob per section), so there's no multi-item pipeline
// needing NDJSON progress streaming.
export const postPreWarmupImport = async (req, res, next) => {
  const { payload: rawPayload } = req.body || {};

  if (!rawPayload || typeof rawPayload !== "object") {
    return res.status(400).json({ message: "A JSON payload is required." });
  }

  try {
    const payload = normalizePreWarmupPayload(rawPayload);
    validatePreWarmupPayload(payload);
    const summary = await importPreWarmupContent({ payload, userId: req.user?.id || null });
    return res.status(200).json({ summary });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};
