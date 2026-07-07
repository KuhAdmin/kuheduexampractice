import { createStructuredCompletion } from "./openAiService.js";

// Base64 data URLs run ~33% larger than the underlying bytes; this keeps
// uploads comfortably inside app.js's express.json({ limit: "15mb" }) body cap.
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const OCR_INSTRUCTION =
  'Extract all the text from this photo of a student\'s handwritten (or printed) answer. Transcribe it exactly as written, correcting only obvious OCR artifacts (e.g. stray marks misread as characters). Preserve line breaks where they carry meaning. If no legible text is present, return an empty string.\n\nSchema:\n{\n  "extractedText": ""\n}';

export const extractTextFromHandwrittenImage = async ({ imageDataUrl }) => {
  if (typeof imageDataUrl !== "string" || !imageDataUrl.startsWith("data:image/")) {
    const error = new Error("A valid image is required.");
    error.statusCode = 400;
    throw error;
  }

  const approxBytes = Math.ceil((imageDataUrl.length * 3) / 4);
  if (approxBytes > MAX_IMAGE_BYTES) {
    const error = new Error("Image is too large. Please upload a smaller or more compressed photo.");
    error.statusCode = 400;
    throw error;
  }

  const { parsed } = await createStructuredCompletion({
    systemPrompt:
      "You are an OCR engine for a student assessment app. Return only valid JSON that exactly matches the requested schema.",
    userPrompt: OCR_INSTRUCTION,
    userContent: [
      { type: "text", text: OCR_INSTRUCTION },
      { type: "image_url", image_url: { url: imageDataUrl } },
    ],
    responseFormatName: "handwritten_note_ocr",
  });

  return {
    text: typeof parsed?.extractedText === "string" ? parsed.extractedText.trim() : "",
  };
};
