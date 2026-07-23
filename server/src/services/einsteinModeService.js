import { env } from "../config/env.js";
import { createStructuredCompletion } from "./openAiService.js";
import { getConceptCard } from "./studentContentService.js";

// "Einstein Mode" -- at the bottom of the concept Explore tab, beneath the
// AI Tutor and practice-capture sections. The app invents a real-world
// object related to the concept, the student photographs (camera -> two-pin
// crop, same as StudentConceptPracticeCapture) an object they believe
// matches it, and Gemini Vision judges whether their photo is a match.
const GEMINI_VISION_MODEL_ID = "gemini-vision";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const assertImage = (imageDataUrl, label = "photo") => {
  if (typeof imageDataUrl !== "string" || !imageDataUrl.startsWith("data:image/")) {
    const error = new Error(`A valid ${label} is required.`);
    error.statusCode = 400;
    throw error;
  }

  const approxBytes = Math.ceil((imageDataUrl.length * 3) / 4);
  if (approxBytes > MAX_IMAGE_BYTES) {
    const error = new Error(`That ${label} is too large. Please retake it with a tighter crop.`);
    error.statusCode = 400;
    throw error;
  }
};

const assertVisionModelConfigured = () => {
  if (!env.geminiApiKey || !env.geminiVisionModel) {
    const error = new Error("This feature isn't available right now. Please contact support.");
    error.statusCode = 503;
    throw error;
  }
};

const loadCardOrThrow = async (assessmentUnitId) => {
  const card = await getConceptCard({ assessmentUnitId });
  if (!card) {
    const error = new Error("This concept has not been generated yet.");
    error.statusCode = 404;
    throw error;
  }
  return card;
};

const describeConceptForPrompt = (card) => {
  const lines = [`Concept: ${card.primaryConcept}`];
  if (card.learningObjective) lines.push(`Learning objective: ${card.learningObjective}`);
  if (card.contextSummary) lines.push(`Summary: ${card.contextSummary}`);
  return lines.join("\n");
};

const CHALLENGE_SYSTEM =
  "You invent short 'go find and photograph this real-world object' challenges for a student " +
  "studying a specific concept, to reinforce it through real-world object recognition. The object " +
  "must be ordinary and physically photographable in a home or school right now -- never an " +
  "abstract idea, a diagram, a person, or anything rare/dangerous/expensive. Return only valid JSON " +
  "matching the schema.";

export const generateEinsteinChallenge = async ({ assessmentUnitId }) => {
  const card = await loadCardOrThrow(assessmentUnitId);

  // createStructuredCompletion pins temperature low for JSON reliability,
  // which otherwise makes the model repeat the same "obvious" object call
  // after call -- a random nonce in the prompt nudges it to vary instead.
  const nonce = Math.random().toString(36).slice(2, 8);

  const instructionText =
    `The student is currently studying this concept:\n${describeConceptForPrompt(card)}\n\n` +
    "Invent ONE concrete, everyday, physically photographable object that clearly relates to or " +
    'demonstrates this concept -- something the student could realistically find at home or school ' +
    'right now and take a photo of. Keep it to a short noun phrase (2-6 words), e.g. "a pair of ' +
    'scissors", "a bar magnet", "a slice of lemon". Do not describe a diagram, a person, or an ' +
    "abstract idea.\n\n" +
    `Vary your answer -- do not always pick the most obvious object. (random seed: ${nonce})\n\n` +
    'Schema:\n{\n  "object": ""\n}';

  const { parsed } = await createStructuredCompletion({
    systemPrompt: CHALLENGE_SYSTEM,
    userPrompt: instructionText,
    responseFormatName: "einstein_mode_challenge",
  });

  const object = typeof parsed?.object === "string" ? parsed.object.trim() : "";
  if (!object) {
    const error = new Error("Couldn't come up with a challenge right now. Please try again.");
    error.statusCode = 502;
    throw error;
  }

  return { object };
};

const RECOGNITION_SYSTEM =
  "You are an object-recognition engine for a student learning game. Identify the single main " +
  "real-world object shown in the photo in a short phrase, then judge whether it's a reasonable " +
  "match for the target object the student was asked to find -- accept clear real-world equivalents " +
  "and close variants (a different brand/color/size of the same kind of object still counts), but " +
  "reject a genuinely different object. Return only valid JSON matching the schema.";

export const recognizeEinsteinObject = async ({ targetObject, imageDataUrl }) => {
  assertImage(imageDataUrl, "photo");
  assertVisionModelConfigured();

  if (!targetObject?.trim()) {
    const error = new Error("No target object was provided.");
    error.statusCode = 422;
    throw error;
  }

  const instructionText =
    `The student was asked to find and photograph: "${targetObject.trim()}".\n\n` +
    "Look at the attached photo. Identify the single main object shown, in a short phrase. Then " +
    "decide whether it's a reasonable match for the target object above.\n\n" +
    "Schema:\n{\n" +
    '  "identifiedAs": "short phrase describing what the photo actually shows",\n' +
    '  "isMatch": true or false,\n' +
    '  "feedback": "one short sentence, addressed directly to the student, explaining the verdict"\n' +
    "}";

  const { parsed } = await createStructuredCompletion({
    systemPrompt: RECOGNITION_SYSTEM,
    userPrompt: instructionText,
    userContent: [
      { type: "text", text: instructionText },
      { type: "image_url", image_url: { url: imageDataUrl } },
    ],
    responseFormatName: "einstein_mode_recognition",
    modelId: GEMINI_VISION_MODEL_ID,
  });

  const identifiedAs = typeof parsed?.identifiedAs === "string" ? parsed.identifiedAs.trim() : "";
  const isMatch = parsed?.isMatch === true;
  const feedback =
    typeof parsed?.feedback === "string" && parsed.feedback.trim()
      ? parsed.feedback.trim()
      : isMatch
        ? "That looks right!"
        : "That doesn't look like a match -- give it another try.";

  return { identifiedAs, isMatch, feedback };
};
