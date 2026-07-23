import { createStructuredCompletion } from "./openAiService.js";
import { resolveOcrModelForSubject } from "./llm/demoModelSelectionService.js";

// Base64 data URLs run ~33% larger than the underlying bytes; this keeps
// uploads comfortably inside app.js's express.json({ limit: "15mb" }) body cap.
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const OCR_INSTRUCTION =
  'You are a literal OCR engine, not an editor -- you transcribe pixels into text, you do not think about what the student meant. Extract all the text from this photo of a student\'s handwritten (or printed) answer, character for character and word for word, EXACTLY as written on the page.\n\n' +
  'Do NOT correct spelling. Do NOT fix grammar. Do NOT change word order or punctuation. Do NOT paraphrase, summarize, reword, tidy up, or "improve" the writing in any way. Do NOT add words that are not visibly on the page, and do NOT drop words that are. If the student wrote something wrong, misspelled, ungrammatical, or nonsensical, transcribe it exactly as wrong, misspelled, ungrammatical, or nonsensical -- your output is evidence of what the student actually wrote, not a corrected version of it. The ONLY judgment call you are allowed to make is resolving which specific character a stray pen mark or smudge represents (a true OCR decision, e.g. deciding an ambiguous stroke is "a" and not "o") -- that is the single exception, and it never extends to changing a whole word, phrase, or sentence.\n\n' +
  'Preserve line breaks where they carry meaning. If no legible text is present, return an empty string.\n\n' +
  'If the page contains mathematical equations, physics formulas, chemical formulas/equations, or other scientific notation, transcribe them as LaTeX instead of plain characters -- e.g. \\frac{a}{b}, x^2, H_2O, \\int, \\sum, \\rightarrow for reaction arrows. Wrap inline math in single dollar signs ($...$) and standalone/display equations in double dollar signs ($$...$$), and leave surrounding prose as plain text outside those delimiters. ' +
  'This $ / $$ wrapping is a REQUIRED formatting marker for this system, not extra content -- adding it around math notation is not "adding words that are not on the page" and does not violate the literal-transcription rule above; that rule is about not changing the student\'s actual wording, not about withholding the delimiters this system needs to render the math. Every equation MUST be wrapped in $...$ or $$...$$ -- raw, unwrapped LaTeX commands (e.g. \\frac{a}{b} sitting outside any $ signs) are treated as a formatting error.\n\n' +
  'If the page contains a graph, diagram, or figure that cannot be transcribed as text or notation, do not attempt to redraw it -- instead insert a short bracketed description in its place, e.g. [Graph: parabola opening upward, vertex near origin].\n\n' +
  'Schema:\n{\n  "extractedText": ""\n}';

export const extractTextFromHandwrittenImage = async ({ imageDataUrl, subjectCode, modelId: forcedModelId }) => {
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

  // Admin-configurable per subject (Admin > Demo Model Settings); falls back
  // to the system default (Hindi/Bengali -> Gemini, else provider default)
  // when no override has been set for this subject. Callers that need a
  // specific model regardless of subject/admin config (e.g. the student
  // concept-practice capture feature, always Gemini Vision) pass modelId
  // directly and skip this resolution entirely.
  const { modelId } = forcedModelId ? { modelId: forcedModelId } : await resolveOcrModelForSubject(subjectCode);

  const { parsed } = await createStructuredCompletion({
    systemPrompt:
      "You are an OCR engine for a student assessment app, not a writing assistant. Transcribe literally -- never correct, edit, paraphrase, or rephrase the student's actual words, even if they contain errors. Return only valid JSON that exactly matches the requested schema.",
    userPrompt: OCR_INSTRUCTION,
    userContent: [
      { type: "text", text: OCR_INSTRUCTION },
      { type: "image_url", image_url: { url: imageDataUrl } },
    ],
    responseFormatName: "handwritten_note_ocr",
    modelId,
  });

  return {
    text: typeof parsed?.extractedText === "string" ? parsed.extractedText.trim() : "",
  };
};
