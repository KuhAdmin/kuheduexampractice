import {
  importConceptContent,
  normalizeConceptImportPayload,
  validateConceptImportPayload,
} from "../services/conceptImportService.js";

// Streams newline-delimited JSON progress events while the import runs (see
// importConceptContent's onProgress), so the admin UI can show a live log of
// concept nodes as they're actually processed instead of only a summary once
// everything finishes. Shape validation happens *before* any of that
// streaming starts, specifically so a malformed file still gets a normal
// JSON 400 response -- once the NDJSON stream begins the HTTP status is
// already committed and can't change, so any error found after that point
// has to be reported as a {type:"error"} line instead.
export const postConceptImport = async (req, res, next) => {
  const { payload: rawPayload } = req.body || {};

  if (!rawPayload || typeof rawPayload !== "object") {
    return res.status(400).json({ message: "A JSON payload is required." });
  }

  let payload;
  try {
    payload = normalizeConceptImportPayload(rawPayload);
    validateConceptImportPayload(payload);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }

  res.writeHead(200, {
    "Content-Type": "application/x-ndjson",
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",
  });
  const writeEvent = (event) => res.write(`${JSON.stringify(event)}\n`);

  try {
    const summary = await importConceptContent({
      payload,
      userId: req.user?.id || null,
      onProgress: writeEvent,
    });

    writeEvent({ type: "summary", summary });
  } catch (error) {
    writeEvent({ type: "error", message: error.message || "Import failed." });
  } finally {
    res.end();
  }
};
