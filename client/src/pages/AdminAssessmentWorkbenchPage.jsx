import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { MathPreview } from "../components/MathPreview";
import {
  generateAllMemoryHookImages,
  generateDiagramImage,
  generateMemoryHookImage,
  getAssessmentStudioPipelineAudit,
  getAssessmentUnitDiagrams,
  getDiagramMedia,
  getMemoryHookMedia,
  uploadDiagramMedia,
  uploadMemoryHookMedia,
} from "../api/client";

const tabs = [
  "Concept",
  "Memory",
  "Assessment",
  "Blueprint",
  "Question",
  "Support",
  "Analytics",
  "Search",
  "AI Inspector",
];

const formatJson = (value) => JSON.stringify(value ?? null, null, 2);

const asArray = (value) => (Array.isArray(value) ? value : []);
const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const parseJsonString = (value) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed || (!trimmed.startsWith("{") && !trimmed.startsWith("["))) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
};

const toDisplayText = (value) => {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (!value) {
    return "";
  }

  if (Array.isArray(value)) {
    return value.map(toDisplayText).filter(Boolean).join(" ");
  }

  if (typeof value === "object") {
    return (
      value.text ||
      value.stem ||
      value.prompt ||
      value.question ||
      value.explanation ||
      formatJson(value)
    );
  }

  return "";
};

const getPromptDesignSummary = (value) => {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return {
      text: value,
      details: [],
    };
  }

  if (typeof value !== "object") {
    return {
      text: String(value),
      details: [],
    };
  }

  const text =
    toDisplayText(
      value.prompt_stem ||
        value.promptStem ||
        value.scenario ||
        value.task ||
        value.prompt ||
        value.description
    ) || formatJson(value);

  const details = [
    value.task_format || value.taskFormat,
    value.task_type || value.taskType,
    Array.isArray(value.contextual_variants) && value.contextual_variants.length > 0
      ? `Variants: ${value.contextual_variants.join(", ")}`
      : "",
    Array.isArray(value.response_requirements) && value.response_requirements.length > 0
      ? `Response: ${value.response_requirements.join("; ")}`
      : "",
    Array.isArray(value.required_response_actions) && value.required_response_actions.length > 0
      ? `Actions: ${value.required_response_actions.join("; ")}`
      : "",
  ].filter(Boolean);

  return {
    text,
    details,
  };
};

const getQuestionPayload = (item = {}) => {
  const inlineQuestion = item.question_object || item.questionObject || item.question_payload;
  if (inlineQuestion && typeof inlineQuestion === "object") {
    return inlineQuestion;
  }

  if (item.question && typeof item.question === "object") {
    return item.question;
  }

  const parsedQuestion =
    parseJsonString(item.question) ||
    parseJsonString(item.question_stem) ||
    parseJsonString(item.stem) ||
    null;

  return parsedQuestion && typeof parsedQuestion === "object" ? parsedQuestion : null;
};

const getLayerRows = (audit, layerNumber) =>
  asArray(audit?.layers).filter((layer) => layer.layerNumber === layerNumber);

const getLayerOutputForAu = (audit, layerNumber, assessmentUnitId) =>
  getLayerRows(audit, layerNumber).find(
    (layer) => layer.assessmentUnitId === assessmentUnitId
  )?.outputJson || null;

const getLayer1Output = (audit) =>
  getLayerRows(audit, 1).find((layer) => !layer.assessmentUnitId)?.outputJson || null;

const getLayer2MemoryObject = (output = {}) => {
  if (isPlainObject(output?.concept_memory)) {
    return output.concept_memory;
  }

  if (isPlainObject(output?.memory)) {
    return output.memory;
  }

  if (Array.isArray(output?.concept_memories) && output.concept_memories.length > 0) {
    return output.concept_memories[0];
  }

  return isPlainObject(output) ? output : null;
};

const getCapabilityObject = (output = {}) => {
  if (isPlainObject(output?.capability)) {
    return output.capability;
  }

  if (Array.isArray(output?.capabilities) && output.capabilities.length === 1) {
    return output.capabilities[0];
  }

  return isPlainObject(output) ? output : null;
};

const getStrategyObject = (output = {}) => {
  if (isPlainObject(output?.strategy)) {
    return output.strategy;
  }

  if (Array.isArray(output?.strategies) && output.strategies.length === 1) {
    return output.strategies[0];
  }

  return isPlainObject(output) ? output : null;
};

const getBlueprintObject = (output = {}) => {
  if (isPlainObject(output?.blueprint)) {
    return output.blueprint;
  }

  if (Array.isArray(output?.blueprints) && output.blueprints.length === 1) {
    return output.blueprints[0];
  }

  return isPlainObject(output) ? output : null;
};

const getMemoryForAu = (audit, assessmentUnitId) => {
  const output = getLayerOutputForAu(audit, 2, assessmentUnitId);
  const singleMemory = getLayer2MemoryObject(output);

  if (singleMemory?.assessment_unit_id === assessmentUnitId || !singleMemory?.assessment_unit_id) {
    return singleMemory;
  }

  return (
    asArray(output?.concept_memories).find(
      (memory) => memory.assessment_unit_id === assessmentUnitId
    ) || singleMemory || null
  );
};

const getAssessmentUnits = (audit) =>
  asArray(getLayer1Output(audit)?.assessment_units);

const getQuestionItems = (output) =>
  asArray(output?.items || output?.questions || output?.assessment_items || output?.generated_items);

const getAllQuestionPreviews = (audit, assessmentUnits) => {
  const conceptByAssessmentUnitId = new Map(
    asArray(assessmentUnits).map((unit) => [unit.assessment_unit_id, unit.primary_concept || ""])
  );

  return getLayerRows(audit, 6).flatMap((layer) =>
    getQuestionItems(layer.outputJson).map((item, index) => ({
      item,
      index,
      assessmentUnitId: layer.assessmentUnitId || "",
      conceptName: conceptByAssessmentUnitId.get(layer.assessmentUnitId) || "",
      layerId: layer.id,
    }))
  );
};

const humanizeLabel = (value = "") =>
  String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const uniqueList = (items) => [...new Set(asArray(items).filter(Boolean).map(String))];

const getCapabilityItems = (output) => {
  if (Array.isArray(output?.capabilities)) {
    return output.capabilities;
  }

  if (Array.isArray(output?.assessment_capabilities)) {
    return output.assessment_capabilities;
  }

  const capability = getCapabilityObject(output);
  return capability ? [capability] : [];
};

const getStrategyItems = (output) => {
  if (Array.isArray(output?.strategies)) {
    return output.strategies;
  }

  if (Array.isArray(output?.assessment_strategies)) {
    return output.assessment_strategies;
  }

  if (Array.isArray(output?.recommendations)) {
    return output.recommendations;
  }

  const strategy = getStrategyObject(output);
  return strategy ? [strategy] : [];
};

const getBlueprintItems = (output) =>
  asArray(
    output?.blueprints ||
      output?.item_blueprints ||
      output?.blueprint_items ||
      output?.item_blueprint_contracts ||
      output?.items ||
      (getBlueprintObject(output) ? [getBlueprintObject(output)] : [])
  );

const getTextList = (value) => {
  if (Array.isArray(value)) {
    return value.map(toDisplayText).filter(Boolean);
  }

  if (typeof value === "string") {
    const parsed = parseJsonString(value);
    if (Array.isArray(parsed)) {
      return parsed.map(toDisplayText).filter(Boolean);
    }
    return value.trim() ? [value.trim()] : [];
  }

  return [];
};

const formatDifficultyDistribution = (value) => {
  if (!isPlainObject(value)) {
    return "";
  }

  return ["E", "M", "H"]
    .map((key) =>
      Number.isFinite(Number(value[key])) ? `${key}: ${Number(value[key])}%` : ""
    )
    .filter(Boolean)
    .join(" | ");
};

const getOptionEntries = (item = {}) => {
  const questionPayload = getQuestionPayload(item);
  const options =
    item.options ||
    item.choices ||
    item.answer_options ||
    item.answerOptions ||
    questionPayload?.options ||
    [];
  if (Array.isArray(options)) {
    return options.map((option, index) => {
      if (typeof option === "string") {
        return { key: String.fromCharCode(65 + index), text: option };
      }

      return {
        key: option.key || option.label || option.option_id || option.optionId || String.fromCharCode(65 + index),
        text: option.text || option.value || option.option || option.answer || "",
      };
    });
  }

  if (options && typeof options === "object") {
    return Object.entries(options).map(([key, value]) => ({
      key,
      text: typeof value === "string" ? value : value?.text || value?.value || value?.option || "",
    }));
  }

  return [];
};

const getCorrectOptionKeys = (item = {}) => {
  const questionPayload = getQuestionPayload(item);
  const correct =
    item.correct_answer ||
    item.correctAnswer ||
    item.correct_option ||
    item.correctOption ||
    item.answer_key ||
    item.answerKey ||
    item.correct_option_id ||
    item.correctOptionId ||
    questionPayload?.correct_option_id ||
    questionPayload?.correctOptionId ||
    questionPayload?.correct_answer ||
    questionPayload?.correctAnswer ||
    item.expected_answer ||
    "";

  if (Array.isArray(correct)) {
    return correct.map(String);
  }

  if (correct && typeof correct === "object") {
    return [correct.key || correct.label || correct.option || correct.answer].filter(Boolean).map(String);
  }

  return String(correct || "")
    .split(/[,\s]+/)
    .map((value) => value.trim())
    .filter(Boolean);
};

const getOptionFeedback = (item = {}, optionKey = "") => {
  const explanations =
    item.option_explanations ||
    item.optionExplanations ||
    item.answer_explanations ||
    item.answerExplanations ||
    {};
  if (explanations && typeof explanations === "object" && !Array.isArray(explanations)) {
    const explanation = explanations[optionKey];
    if (typeof explanation === "string") {
      return explanation;
    }
    return explanation?.text || explanation?.explanation || "";
  }

  return "";
};

const summarizeQuestion = (item = {}) => {
  const questionPayload = getQuestionPayload(item);

  return {
    id: item.item_id || item.question_id || item.id || "",
    text: toDisplayText(
      questionPayload?.stem ||
        questionPayload?.question ||
        item.question ||
        item.stem ||
        item.question_stem ||
        item.question_text ||
        item.questionText ||
        item.prompt
    ),
    family: humanizeLabel(
      item.item_family || item.question_family || item.questionFamily || item.type || ""
    ),
    difficulty: humanizeLabel(
      item.difficulty || item.target_difficulty || item.targetDifficulty || ""
    ),
    estimatedTime:
      item.estimated_time_seconds ||
      item.estimatedTimeSeconds ||
      item.estimated_time ||
      item.estimatedTime ||
      "",
    misconception:
      item.common_misconception_addressed ||
      item.commonMisconceptionAddressed ||
      item.misconception_addressed ||
      "",
    explanation: toDisplayText(
      item.explanation ||
        item.rationale ||
        item.solution ||
        item.model_answer ||
        item.modelAnswer
    ),
    teacherNote: toDisplayText(
      item.teacher_note || item.teacherNote || item.review_note || item.reviewNote
    ),
  };
};

const summarizeCapability = (capabilityOutput) => {
  const capability = getCapabilityObject(capabilityOutput) || {};
  const items = getCapabilityItems(capabilityOutput);
  const itemTypes = uniqueList(
    items.flatMap((item) => [
      ...asArray(item.item_types || item.itemTypes),
      item.response_format || item.responseFormat || "",
      item.interaction_type || item.interactionType || "",
      item.question_family || item.questionFamily || "",
      item.expected_answer_type || item.expectedAnswerType || "",
    ])
  );
  const capabilityNames = uniqueList(
    items.map((item) => item.capability_name || item.name || item.capability).filter(Boolean)
  );
  const evidence = uniqueList(
    items.flatMap((item) => asArray(item.evidence_requirements || item.evidenceRequirements))
  );
  const descriptions = uniqueList(
    items.map((item) => item.capability_description || item.description).filter(Boolean)
  );

  return {
    concept: capability.concept || "",
    objectives: uniqueList(
      items.flatMap((item) =>
        asArray(
          item.objectives ||
            item.objective_refs ||
            item.objectiveRefs ||
            item.learning_objectives ||
            item.learningObjectives
        )
      )
    ),
    competencies: uniqueList(
      items.flatMap((item) => asArray(item.competencies || item.competency_targets))
    ),
    skills: uniqueList(items.flatMap((item) => asArray(item.skills))),
    bloom: uniqueList(items.flatMap((item) => asArray(item.bloom || item.blooms))),
    mastery: uniqueList(items.flatMap((item) => asArray(item.mastery))),
    misconceptions: uniqueList(
      items.flatMap((item) => asArray(item.misconceptions || item.misconception_checks))
    ),
    dependencies: uniqueList(items.flatMap((item) => asArray(item.dependencies))),
    itemTypes,
    capabilityNames,
    evidence,
    descriptions,
  };
};

const summarizeStrategy = (strategyOutput) => {
  const strategy = getStrategyObject(strategyOutput) || {};
  const items = getStrategyItems(strategyOutput);
  const strategies = uniqueList(
    items.map((item) => item.strategy_name || item.name || item.strategy).filter(Boolean)
  );
  const itemTypes = uniqueList(items.flatMap((item) => asArray(item.item_types || item.itemTypes)));
  const rationale = uniqueList(items.map((item) => item.rationale || item.reason).filter(Boolean));
  const promptDesign = items
    .map((item) => getPromptDesignSummary(item.prompt_design || item.promptDesign || item.prompt))
    .filter((item) => item?.text);
  const difficulties = uniqueList(items.map((item) => item.difficulty).filter(Boolean));

  return {
    objectiveRef: strategy.objective_ref || strategy.objectiveRef || "",
    blooms: uniqueList(items.flatMap((item) => asArray(item.blooms || item.bloom))),
    skills: uniqueList(items.flatMap((item) => asArray(item.skills))),
    contexts: uniqueList(items.flatMap((item) => asArray(item.contexts))),
    patterns: uniqueList(
      items.flatMap((item) => asArray(item.patterns || item.question_patterns))
    ),
    misconceptions: uniqueList(
      items.flatMap((item) => asArray(item.misconceptions || item.misconception_checks))
    ),
    constraints: uniqueList(items.flatMap((item) => asArray(item.constraints))),
    evidence: uniqueList(
      items.flatMap((item) =>
        asArray(item.evidence || item.evidence_requirements || item.performance_indicators)
      )
    ),
    difficultyDistribution:
      formatDifficultyDistribution(strategy.difficulty) ||
      uniqueList(items.map((item) => item.difficulty).filter(Boolean)).join(", "),
    strategies,
    itemTypes,
    rationale,
    promptDesign,
    difficulties,
  };
};

const summarizeBlueprint = (item = {}) => {
  const promptBlueprint = item.prompt_blueprint || item.promptBlueprint || item.prompt_design || {};
  const answerBlueprint = item.answer_blueprint || item.answerBlueprint || item.scoring_blueprint || {};
  const distractorStrategy =
    item.distractor_strategy || item.distractorStrategy || item.distractors || item.trap_design || {};
  const promptText =
    promptBlueprint.task ||
    promptBlueprint.prompt ||
    promptBlueprint.stem ||
    item.task ||
    item.prompt ||
    item.question_prompt ||
    item.questionPrompt ||
    "";
  const trapText =
    typeof distractorStrategy === "string"
      ? distractorStrategy
      : distractorStrategy.name ||
        distractorStrategy.type ||
        distractorStrategy.summary ||
        distractorStrategy.strategy ||
        distractorStrategy.focus ||
        "";

  return {
    id: item.item_id || item.blueprint_id || item.id || "",
    family: humanizeLabel(
      item.item_family ||
        item.question_family ||
        item.questionFamily ||
        item.family ||
        item.interaction_type ||
        ""
    ),
    strategy: item.strategy_name || item.strategyName || item.strategy || "",
    objective:
      item.competency_focus ||
      item.learning_objective ||
      item.learningObjective ||
      item.objective ||
      "",
    promptText,
    difficulty: humanizeLabel(item.difficulty || item.target_difficulty || item.targetDifficulty || ""),
    marks: item.marks || item.points || promptBlueprint.marks || promptBlueprint.points || "",
    time:
      item.estimated_time_seconds ||
      item.estimatedTimeSeconds ||
      item.estimated_time ||
      item.estimatedTime ||
      item.time_limit ||
      item.timeLimit ||
      promptBlueprint.estimated_time ||
      "",
    interactionType: humanizeLabel(item.interaction_type || item.interactionType || ""),
    expectedAnswerType: humanizeLabel(
      item.expected_answer_type || item.expectedAnswerType || ""
    ),
    bloomsLevel: humanizeLabel(item.blooms_level || item.bloomsLevel || ""),
    successCriteria: getTextList(item.success_criteria || item.successCriteria),
    commonMisconception:
      item.common_misconception || item.commonMisconception || "",
    generatorConstraints:
      item.generator_constraints || item.generatorConstraints || {},
    memorySupport: item.memory_support || item.memorySupport || {},
    expectedAnswer: uniqueList([
      ...asArray(item.evidence_requirements || item.evidenceRequirements),
      ...asArray(item.success_criteria || item.successCriteria),
      ...asArray(answerBlueprint.must_include || answerBlueprint.mustInclude),
      ...asArray(answerBlueprint.scoring_points || answerBlueprint.scoringPoints),
      ...asArray(answerBlueprint.key_points || answerBlueprint.keyPoints),
      ...asArray(promptBlueprint.success_criteria || promptBlueprint.successCriteria),
    ]),
    trapText,
  };
};

const summarizeSupport = (supportOutput) => {
  const support =
    (isPlainObject(supportOutput?.learning_support) ? supportOutput.learning_support : null) ||
    (isPlainObject(supportOutput) ? supportOutput : {});

  const misconceptionFeedback = isPlainObject(support.misconception_feedback)
    ? support.misconception_feedback
    : {};
  const memorySupportRefs = isPlainObject(support.memory_support_refs)
    ? support.memory_support_refs
    : {};

  return {
    assessmentUnitId: support.assessment_unit_id || support.assessmentUnitId || "",
    conceptExplanation: support.concept_explanation || support.conceptExplanation || "",
    correctAnswerReasoning:
      support.correct_answer_reasoning || support.correctAnswerReasoning || "",
    realWorldInsight: support.real_world_insight || support.realWorldInsight || "",
    distractorAnalysis: asArray(
      support.distractor_analysis || support.distractorAnalysis
    )
      .map((entry) => {
        if (typeof entry === "string") {
          return {
            optionText: entry,
            whyIncorrect: "",
            reasonSelected: "",
          };
        }

        if (!isPlainObject(entry)) {
          return null;
        }

        return {
          optionText: toDisplayText(entry.option_text || entry.optionText || entry.option || ""),
          whyIncorrect: toDisplayText(
            entry.why_incorrect || entry.whyIncorrect || entry.explanation || ""
          ),
          reasonSelected: toDisplayText(
            entry.reason_selected || entry.reasonSelected || entry.selection_reason || ""
          ),
        };
      })
      .filter(
        (entry) =>
          entry && (entry.optionText || entry.whyIncorrect || entry.reasonSelected)
      ),
    progressiveHints: getTextList(support.progressive_hints || support.progressiveHints),
    adaptiveRemediation: getTextList(
      support.adaptive_remediation || support.adaptiveRemediation
    ),
    masteryRecommendation:
      support.mastery_recommendation || support.masteryRecommendation || "",
    misconceptionFeedback: Object.entries(misconceptionFeedback)
      .map(([key, value]) => `${humanizeLabel(key)}: ${toDisplayText(value)}`)
      .filter((item) => item && !item.endsWith(": ")),
    memorySupportRefs: Object.entries(memorySupportRefs)
      .map(([key, value]) => `${humanizeLabel(key)}: ${toDisplayText(value)}`)
      .filter((item) => item && !item.endsWith(": ")),
  };
};

const WorkbenchCard = ({ title, children, actionLabel = "Edit" }) => (
  <article className="admin-workbench-card">
    <div className="admin-workbench-card-head">
      <h3>{title}</h3>
      <button className="ghost-button is-compact" type="button" disabled>
        {actionLabel}
      </button>
    </div>
    {children}
  </article>
);

// Distinct from WorkbenchCard (whose action button is a page-wide, always-
// disabled placeholder shared by ~20+ cards) -- this one has real, working
// actions: AI generation (image-type sections only) and manual upload (all
// 7 memory-hook sections, image or video depending on the section).
const MemoryHookMediaCard = ({
  title,
  sectionKey,
  mediaType,
  media,
  canGenerate,
  onGenerate,
  generateBusy,
  generateError,
  onUpload,
  uploadBusy,
  uploadError,
  children,
}) => (
  <article className="admin-workbench-card">
    <div className="admin-workbench-card-head">
      <h3>{title}</h3>
      <div className="admin-workbench-media-actions">
        {canGenerate && (
          <button
            className="ghost-button is-compact"
            type="button"
            disabled={generateBusy}
            onClick={() => onGenerate(sectionKey)}
          >
            {generateBusy ? "Generating..." : media?.source === "generated" ? "Regenerate" : "Generate"}
          </button>
        )}
        <label className={`ghost-button is-compact admin-workbench-upload-label ${uploadBusy ? "is-disabled" : ""}`}>
          {uploadBusy ? "Uploading..." : "Upload"}
          <input
            type="file"
            accept={mediaType === "video" ? "video/*" : "image/*"}
            hidden
            disabled={uploadBusy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) onUpload(sectionKey, file);
            }}
          />
        </label>
      </div>
    </div>
    {children}
    {generateError && <p className="error-text">{generateError}</p>}
    {uploadError && <p className="error-text">{uploadError}</p>}
    {media ? (
      <>
        {mediaType === "video" ? (
          <video
            src={media.mediaData}
            controls
            className="admin-workbench-memory-image admin-workbench-memory-video"
          />
        ) : (
          <img src={media.mediaData} alt={`${title} illustration`} className="admin-workbench-memory-image" />
        )}
        <p className="admin-workbench-muted">
          v{media.versionNumber} · {media.source === "generated" ? media.promptText : media.originalFileName || "Uploaded"}
        </p>
      </>
    ) : (
      <p className="admin-workbench-muted">No {mediaType} generated or uploaded yet.</p>
    )}
  </article>
);

const ChipList = ({ items }) => {
  const values = asArray(items).filter(Boolean);
  if (values.length === 0) {
    return <p className="admin-workbench-muted">No entries available yet.</p>;
  }

  return (
    <div className="admin-workbench-chip-list">
      {values.map((item, index) => (
        <span key={`${item}-${index}`}>{String(item)}</span>
      ))}
    </div>
  );
};

export const AdminAssessmentWorkbenchPage = () => {
  const { jobId = "" } = useParams();
  const [audit, setAudit] = useState(null);
  const [activeTab, setActiveTab] = useState("Concept");
  const [selectedAssessmentUnitId, setSelectedAssessmentUnitId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadAudit = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await getAssessmentStudioPipelineAudit(jobId);
        if (!cancelled) {
          setAudit(data);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError.message || "Failed to load workbench data.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadAudit();
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  const assessmentUnits = useMemo(() => getAssessmentUnits(audit), [audit]);
  const selectedAssessmentUnit =
    assessmentUnits.find((unit) => unit.assessment_unit_id === selectedAssessmentUnitId) ||
    assessmentUnits[0] ||
    null;
  const selectedId = selectedAssessmentUnit?.assessment_unit_id || "";
  const layer1Output = getLayer1Output(audit);
  const memory = selectedId ? getMemoryForAu(audit, selectedId) : null;
  const capability = selectedId ? getLayerOutputForAu(audit, 3, selectedId) : null;
  const strategy = selectedId ? getLayerOutputForAu(audit, 4, selectedId) : null;
  const blueprint = selectedId ? getLayerOutputForAu(audit, 5, selectedId) : null;
  const support = selectedId ? getLayerOutputForAu(audit, 7, selectedId) : null;
  const allQuestionPreviews = useMemo(
    () => getAllQuestionPreviews(audit, assessmentUnits),
    [audit, assessmentUnits]
  );

  useEffect(() => {
    if (!selectedAssessmentUnitId && assessmentUnits[0]?.assessment_unit_id) {
      setSelectedAssessmentUnitId(assessmentUnits[0].assessment_unit_id);
    }
  }, [assessmentUnits, selectedAssessmentUnitId]);

  const [memoryMedia, setMemoryMedia] = useState({});
  const [generateBusyKey, setGenerateBusyKey] = useState("");
  const [generateErrors, setGenerateErrors] = useState({});
  const [uploadBusyKey, setUploadBusyKey] = useState("");
  const [uploadErrors, setUploadErrors] = useState({});
  const [bulkImageBusy, setBulkImageBusy] = useState(false);
  const [bulkImageNotice, setBulkImageNotice] = useState("");

  const [diagrams, setDiagrams] = useState([]);
  const [diagramMedia, setDiagramMedia] = useState({});
  const [diagramGenerateBusyKey, setDiagramGenerateBusyKey] = useState("");
  const [diagramGenerateErrors, setDiagramGenerateErrors] = useState({});
  const [diagramUploadBusyKey, setDiagramUploadBusyKey] = useState("");
  const [diagramUploadErrors, setDiagramUploadErrors] = useState({});

  const loadMemoryMedia = async (assessmentUnitId) => {
    if (!assessmentUnitId) {
      setMemoryMedia({});
      return;
    }
    try {
      const result = await getMemoryHookMedia(assessmentUnitId);
      setMemoryMedia(result.media || {});
    } catch {
      setMemoryMedia({});
    }
  };

  // Diagrams belong to the section a unit was extracted from, shared by
  // every unit from that section -- fetch the list, then each diagram's own
  // selected media (if any) alongside it.
  const loadDiagrams = async (assessmentUnitId) => {
    if (!assessmentUnitId) {
      setDiagrams([]);
      setDiagramMedia({});
      return;
    }
    try {
      const result = await getAssessmentUnitDiagrams(assessmentUnitId);
      const nextDiagrams = result.diagrams || [];
      setDiagrams(nextDiagrams);

      const mediaEntries = await Promise.all(
        nextDiagrams.map((diagram) =>
          getDiagramMedia(diagram.id)
            .then((mediaResult) => [diagram.id, mediaResult.media])
            .catch(() => [diagram.id, null])
        )
      );
      setDiagramMedia(Object.fromEntries(mediaEntries));
    } catch {
      setDiagrams([]);
      setDiagramMedia({});
    }
  };

  useEffect(() => {
    loadMemoryMedia(selectedId);
    loadDiagrams(selectedId);
    setGenerateErrors({});
    setUploadErrors({});
    setBulkImageNotice("");
    setDiagramGenerateErrors({});
    setDiagramUploadErrors({});
  }, [selectedId]);

  const handleGenerateImage = async (sectionKey) => {
    setGenerateBusyKey(sectionKey);
    setGenerateErrors((current) => ({ ...current, [sectionKey]: "" }));
    try {
      const result = await generateMemoryHookImage(selectedId, sectionKey);
      setMemoryMedia((current) => ({ ...current, [sectionKey]: result }));
    } catch (generateError) {
      setGenerateErrors((current) => ({
        ...current,
        [sectionKey]: generateError.message || "Failed to generate image.",
      }));
    } finally {
      setGenerateBusyKey("");
    }
  };

  const handleGenerateAllImages = async () => {
    const confirmed = window.confirm(
      "Generate images for all 4 image-type memory-hook cards (Analogy, Visual Hook, Curiosity Hook, Memory Trick)? This can take a minute or two."
    );
    if (!confirmed) return;

    setBulkImageBusy(true);
    setBulkImageNotice("");
    setGenerateErrors({});
    try {
      const result = await generateAllMemoryHookImages(selectedId);
      setBulkImageNotice(`Generated ${result.succeeded} of 4 image(s); ${result.failed} failed.`);

      // Surface each section's own outcome on its card (not just the
      // aggregate count above) -- the bulk result already carries per-section
      // detail, it just wasn't being read before.
      const nextErrors = {};
      const nextMedia = { ...memoryMedia };
      for (const row of result.results || []) {
        if (row.status === "success") {
          nextMedia[row.sectionKey] = row;
        } else {
          nextErrors[row.sectionKey] = row.message || "Failed to generate image.";
        }
      }
      setGenerateErrors(nextErrors);
      setMemoryMedia(nextMedia);
    } catch (bulkError) {
      setBulkImageNotice(bulkError.message || "Failed to generate images.");
    } finally {
      setBulkImageBusy(false);
    }
  };

  const readFileAsDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => reject(new Error("Failed to read the selected file."));
      reader.readAsDataURL(file);
    });

  const handleUploadMedia = async (sectionKey, file) => {
    setUploadBusyKey(sectionKey);
    setUploadErrors((current) => ({ ...current, [sectionKey]: "" }));
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const result = await uploadMemoryHookMedia(selectedId, sectionKey, dataUrl, file.name);
      setMemoryMedia((current) => ({ ...current, [sectionKey]: result }));
    } catch (uploadError) {
      setUploadErrors((current) => ({
        ...current,
        [sectionKey]: uploadError.message || "Failed to upload file.",
      }));
    } finally {
      setUploadBusyKey("");
    }
  };

  const handleGenerateDiagramImage = async (diagramId) => {
    setDiagramGenerateBusyKey(diagramId);
    setDiagramGenerateErrors((current) => ({ ...current, [diagramId]: "" }));
    try {
      const result = await generateDiagramImage(diagramId);
      setDiagramMedia((current) => ({ ...current, [diagramId]: result }));
    } catch (generateError) {
      setDiagramGenerateErrors((current) => ({
        ...current,
        [diagramId]: generateError.message || "Failed to generate image.",
      }));
    } finally {
      setDiagramGenerateBusyKey("");
    }
  };

  const handleUploadDiagramMedia = async (diagramId, file) => {
    setDiagramUploadBusyKey(diagramId);
    setDiagramUploadErrors((current) => ({ ...current, [diagramId]: "" }));
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const result = await uploadDiagramMedia(diagramId, dataUrl, file.name);
      setDiagramMedia((current) => ({ ...current, [diagramId]: result }));
    } catch (uploadError) {
      setDiagramUploadErrors((current) => ({
        ...current,
        [diagramId]: uploadError.message || "Failed to upload file.",
      }));
    } finally {
      setDiagramUploadBusyKey("");
    }
  };

  const searchResults = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return [];
    }

    const results = [];
    assessmentUnits.forEach((unit) => {
      const unitText = formatJson(unit).toLowerCase();
      if (unitText.includes(term)) {
        results.push({ area: "Concept", label: unit.primary_concept, id: unit.assessment_unit_id });
      }
      const unitMemory = getMemoryForAu(audit, unit.assessment_unit_id);
      if (formatJson(unitMemory).toLowerCase().includes(term)) {
        results.push({ area: "Memory", label: unit.primary_concept, id: unit.assessment_unit_id });
      }
    });
    return results;
  }, [assessmentUnits, audit, searchTerm]);

  const renderTab = () => {
    if (!selectedAssessmentUnit) {
      return <p className="admin-workbench-muted">Run the pipeline to generate assessment units.</p>;
    }

    if (activeTab === "Concept") {
      return (
        <div className="admin-workbench-grid">
          <WorkbenchCard title="Concept Name">
            <p className="admin-workbench-large">{selectedAssessmentUnit.primary_concept}</p>
            <p>{selectedAssessmentUnit.learning_objective || "Learning objective pending."}</p>
          </WorkbenchCard>
          <WorkbenchCard title="Supporting Concepts">
            <ChipList items={selectedAssessmentUnit.supporting_concepts} />
          </WorkbenchCard>
          <WorkbenchCard title="Common Misconceptions">
            <div className="admin-workbench-stack">
              {asArray(layer1Output?.common_misconceptions).map((item, index) => (
                <div key={index} className="admin-workbench-note">
                  <strong>{item.misconception || item}</strong>
                  {item.correction ? <span>{item.correction}</span> : null}
                </div>
              ))}
            </div>
          </WorkbenchCard>
          <WorkbenchCard title="Dependencies">
            <ChipList
              items={asArray(selectedAssessmentUnit.dependencies).map(
                (item) => item.depends_on_assessment_unit_id || item
              )}
            />
          </WorkbenchCard>
          {diagrams.length > 0 && (
            <WorkbenchCard title="Diagrams (shared by this unit's source section)">
              <div className="admin-workbench-stack">
                {diagrams.map((diagram) => (
                  <MemoryHookMediaCard
                    key={diagram.id}
                    title={diagram.diagramName}
                    sectionKey={diagram.id}
                    mediaType="image"
                    canGenerate
                    media={diagramMedia[diagram.id]}
                    onGenerate={handleGenerateDiagramImage}
                    generateBusy={diagramGenerateBusyKey === diagram.id}
                    generateError={diagramGenerateErrors[diagram.id]}
                    onUpload={handleUploadDiagramMedia}
                    uploadBusy={diagramUploadBusyKey === diagram.id}
                    uploadError={diagramUploadErrors[diagram.id]}
                  >
                    <p>{diagram.purpose || "No purpose recorded."}</p>
                    <ChipList items={diagram.labels} />
                  </MemoryHookMediaCard>
                ))}
              </div>
            </WorkbenchCard>
          )}
        </div>
      );
    }

    if (activeTab === "Memory") {
      return (
        <>
          <div className="layer-versions-toolbar">
            <button
              type="button"
              className="primary-button"
              onClick={handleGenerateAllImages}
              disabled={bulkImageBusy}
            >
              {bulkImageBusy ? "Generating all..." : "Generate All Memory-Hook Images"}
            </button>
            {bulkImageNotice && <span className="admin-bulk-pipeline-concurrency">{bulkImageNotice}</span>}
          </div>
          <div className="admin-workbench-grid">
          <WorkbenchCard title="Memory Definition">
            <p>{memory?.definition || "No canonical definition saved yet."}</p>
          </WorkbenchCard>
          <MemoryHookMediaCard
            title="Analogy"
            sectionKey="analogy"
            mediaType="image"
            canGenerate
            media={memoryMedia.analogy}
            onGenerate={handleGenerateImage}
            generateBusy={generateBusyKey === "analogy"}
            generateError={generateErrors.analogy}
            onUpload={handleUploadMedia}
            uploadBusy={uploadBusyKey === "analogy"}
            uploadError={uploadErrors.analogy}
          >
            <p>{memory?.analogy || "Not generated yet."}</p>
          </MemoryHookMediaCard>
          <MemoryHookMediaCard
            title="Visual Hook"
            sectionKey="visualHook"
            mediaType="image"
            canGenerate
            media={memoryMedia.visualHook}
            onGenerate={handleGenerateImage}
            generateBusy={generateBusyKey === "visualHook"}
            generateError={generateErrors.visualHook}
            onUpload={handleUploadMedia}
            uploadBusy={uploadBusyKey === "visualHook"}
            uploadError={uploadErrors.visualHook}
          >
            <p>{memory?.visual_hook || "Not generated yet."}</p>
          </MemoryHookMediaCard>
          <MemoryHookMediaCard
            title="Curiosity Hook"
            sectionKey="curiosityHook"
            mediaType="image"
            canGenerate
            media={memoryMedia.curiosityHook}
            onGenerate={handleGenerateImage}
            generateBusy={generateBusyKey === "curiosityHook"}
            generateError={generateErrors.curiosityHook}
            onUpload={handleUploadMedia}
            uploadBusy={uploadBusyKey === "curiosityHook"}
            uploadError={uploadErrors.curiosityHook}
          >
            <p>{memory?.curiosity_hook || "Not generated yet."}</p>
          </MemoryHookMediaCard>
          <MemoryHookMediaCard
            title="Memory Trick"
            sectionKey="memoryTrick"
            mediaType="image"
            canGenerate
            media={memoryMedia.memoryTrick}
            onGenerate={handleGenerateImage}
            generateBusy={generateBusyKey === "memoryTrick"}
            generateError={generateErrors.memoryTrick}
            onUpload={handleUploadMedia}
            uploadBusy={uploadBusyKey === "memoryTrick"}
            uploadError={uploadErrors.memoryTrick}
          >
            <p>{memory?.memory_trick || "Not generated yet."}</p>
          </MemoryHookMediaCard>
          <MemoryHookMediaCard
            title="Story"
            sectionKey="story"
            mediaType="video"
            media={memoryMedia.story}
            onUpload={handleUploadMedia}
            uploadBusy={uploadBusyKey === "story"}
            uploadError={uploadErrors.story}
          >
            <p>{memory?.story || "Not generated yet."}</p>
          </MemoryHookMediaCard>
          <MemoryHookMediaCard
            title="Real-world Connection"
            sectionKey="realWorldConnection"
            mediaType="video"
            media={memoryMedia.realWorldConnection}
            onUpload={handleUploadMedia}
            uploadBusy={uploadBusyKey === "realWorldConnection"}
            uploadError={uploadErrors.realWorldConnection}
          >
            <p>{memory?.real_world_connection || "Not generated yet."}</p>
          </MemoryHookMediaCard>
          <MemoryHookMediaCard
            title="Micro Activity"
            sectionKey="microActivity"
            mediaType="video"
            media={memoryMedia.microActivity}
            onUpload={handleUploadMedia}
            uploadBusy={uploadBusyKey === "microActivity"}
            uploadError={uploadErrors.microActivity}
          >
            <p>{memory?.micro_activity || "Not generated yet."}</p>
          </MemoryHookMediaCard>
          <WorkbenchCard title="Retrieval Cues">
            <ChipList items={memory?.retrieval_cues} />
          </WorkbenchCard>
          <WorkbenchCard title="Associated Concepts">
            <ChipList items={memory?.associated_concepts} />
          </WorkbenchCard>
          <WorkbenchCard title="Supporting Concepts">
            <ChipList items={memory?.supporting_concepts} />
          </WorkbenchCard>
          <WorkbenchCard title="Misconception Alert">
            <p>{memory?.misconception_alert || "Not generated yet."}</p>
          </WorkbenchCard>
          </div>
        </>
      );
    }

    if (activeTab === "Assessment") {
      const capabilitySummary = summarizeCapability(capability);
      const strategySummary = summarizeStrategy(strategy);

      return (
        <div className="admin-workbench-grid">
          <WorkbenchCard title="Assessment Objectives">
            <p>These are the Layer 3 objective references for this assessment unit.</p>
            <ChipList items={capabilitySummary.objectives} />
          </WorkbenchCard>

          <WorkbenchCard title="Competencies and Skills">
            <div className="admin-workbench-stack">
              <div>
                <strong>Competencies</strong>
                <ChipList items={capabilitySummary.competencies.map(humanizeLabel)} />
              </div>
              <div>
                <strong>Skills</strong>
                <ChipList items={capabilitySummary.skills.map(humanizeLabel)} />
              </div>
            </div>
          </WorkbenchCard>

          <WorkbenchCard title="Bloom, Mastery, Dependencies">
            <div className="admin-workbench-stack">
              <div>
                <strong>Bloom</strong>
                <ChipList items={capabilitySummary.bloom.map(humanizeLabel)} />
              </div>
              <div>
                <strong>Mastery</strong>
                <ChipList items={capabilitySummary.mastery.map(humanizeLabel)} />
              </div>
              <div>
                <strong>Dependencies</strong>
                <ChipList items={capabilitySummary.dependencies} />
              </div>
            </div>
          </WorkbenchCard>

          <WorkbenchCard title="Misconceptions to Check">
            <ChipList items={capabilitySummary.misconceptions} />
          </WorkbenchCard>

          <WorkbenchCard title="Strategy Patterns and Contexts">
            <div className="admin-workbench-stack">
              <div>
                <strong>Patterns</strong>
                <ChipList items={strategySummary.patterns.map(humanizeLabel)} />
              </div>
              <div>
                <strong>Contexts</strong>
                <ChipList items={strategySummary.contexts} />
              </div>
            </div>
          </WorkbenchCard>

          <WorkbenchCard title="Evidence and Constraints">
            <div className="admin-workbench-stack">
              {strategySummary.evidence.length > 0 ? (
                strategySummary.evidence.map((item, index) => (
                  <div key={index} className="admin-workbench-note">
                    <strong>{index + 1}. Evidence</strong>
                    <span>{item}</span>
                  </div>
                ))
              ) : (
                <p className="admin-workbench-muted">No evidence rules available yet.</p>
              )}
              <div>
                <strong>Constraints</strong>
                <ChipList items={strategySummary.constraints} />
              </div>
            </div>
          </WorkbenchCard>

          <WorkbenchCard title="Difficulty and format fit">
            <div className="admin-workbench-balance">
              <div>
                <strong>Difficulty Mix</strong>
                <p>{strategySummary.difficultyDistribution || "Not specified yet."}</p>
              </div>
              <div>
                <strong>Format fit</strong>
                <ChipList
                  items={[
                    ...strategySummary.itemTypes.map(humanizeLabel),
                    ...capabilitySummary.itemTypes.map(humanizeLabel),
                  ]}
                />
              </div>
            </div>
          </WorkbenchCard>
        </div>
      );
    }

    if (activeTab === "Blueprint") {
      const blueprintItems = getBlueprintItems(blueprint);

      return (
        <div className="admin-workbench-grid">
          {blueprintItems.length > 0 ? (
            blueprintItems.map((item, index) => {
              const summary = summarizeBlueprint(item);

              return (
                <WorkbenchCard key={summary.id || index} title={`Question Plan #${index + 1}`}>
                  <div className="admin-workbench-field-grid">
                    <div className="admin-workbench-field">
                      <span>Question style</span>
                      <strong>{summary.family || "Not specified yet"}</strong>
                    </div>
                    <div className="admin-workbench-field">
                      <span>Difficulty / marks / time</span>
                      <strong>
                        {[summary.difficulty, summary.marks ? `${summary.marks} marks` : "", summary.time]
                          .filter(Boolean)
                          .join(" · ") || "Not specified yet"}
                      </strong>
                    </div>
                  </div>

                  <div className="admin-workbench-stack">
                    <div className="admin-workbench-note">
                      <strong>Blueprint ID</strong>
                      <span>{summary.id || "No blueprint id available yet."}</span>
                    </div>
                    <div className="admin-workbench-note">
                      <strong>Interaction / answer / Bloom</strong>
                      <span>
                        {[
                          summary.interactionType,
                          summary.expectedAnswerType,
                          summary.bloomsLevel,
                        ]
                          .filter(Boolean)
                          .join(" | ") || "No interaction metadata available yet."}
                      </span>
                    </div>
                    <div className="admin-workbench-note">
                      <strong>Learning goal</strong>
                      <span>{summary.objective || "No learning goal available yet."}</span>
                    </div>
                    {summary.promptText ? (
                      <div className="admin-workbench-note">
                        <strong>Student task</strong>
                        <span>{summary.promptText}</span>
                      </div>
                    ) : null}
                    {summary.strategy ? (
                      <div className="admin-workbench-note">
                        <strong>Assessment strategy</strong>
                        <span>{summary.strategy}</span>
                      </div>
                    ) : null}
                    {summary.trapText ? (
                      <div className="admin-workbench-note">
                        <strong>Likely trap to check</strong>
                        <span>{summary.trapText}</span>
                      </div>
                    ) : null}
                    {summary.commonMisconception ? (
                      <div className="admin-workbench-note">
                        <strong>Common misconception</strong>
                        <span>{summary.commonMisconception}</span>
                      </div>
                    ) : null}
                  </div>

                  <div className="admin-workbench-section">
                    <strong>What the answer should include</strong>
                    <ChipList items={[...summary.expectedAnswer, ...summary.successCriteria]} />
                  </div>

                  <div className="admin-workbench-section">
                    <strong>Generator constraints</strong>
                    <pre>{formatJson(summary.generatorConstraints)}</pre>
                  </div>

                  <div className="admin-workbench-section">
                    <strong>Memory support cues</strong>
                    <pre>{formatJson(summary.memorySupport)}</pre>
                  </div>
                </WorkbenchCard>
              );
            })
          ) : (
            <WorkbenchCard title="Question Plan">
              <p className="admin-workbench-muted">
                No question blueprint has been generated for this concept yet.
              </p>
            </WorkbenchCard>
          )}
        </div>
      );
    }

    if (activeTab === "Question") {
      return (
        <div className="admin-workbench-grid">
          {allQuestionPreviews.length > 0 ? (
            allQuestionPreviews.map((preview, index) => {
              const { item, assessmentUnitId, conceptName, layerId } = preview;
              const summary = summarizeQuestion(item);
              const optionEntries = getOptionEntries(item);
              const correctKeys = getCorrectOptionKeys(item);
              const interactionType = item.interaction_type || item.interactionType || "";
              const orderingSequence = item.interaction_data?.sequence || item.interactionData?.sequence || [];
              const matchingPairs = item.interaction_data?.pairs || item.interactionData?.pairs || [];
              const answerKey = summary.id || `${assessmentUnitId || "layer6"}-${layerId}-${index}`;
              const selectedAnswer = selectedAnswers[answerKey] || "";
              const hasSelection = Boolean(selectedAnswer);
              const isCorrect = hasSelection && correctKeys.includes(String(selectedAnswer));
              const selectedFeedback = hasSelection ? getOptionFeedback(item, selectedAnswer) : "";

              return (
                <WorkbenchCard key={answerKey} title={`Student Preview ${index + 1}`} actionLabel="Edit">
                  <div className="admin-student-preview">
                    <div className="admin-student-preview-topline">
                      {conceptName ? <span>{conceptName}</span> : null}
                      {assessmentUnitId ? <span>{assessmentUnitId}</span> : null}
                      <span>{summary.family || "Question"}</span>
                      {summary.difficulty ? <span>{summary.difficulty}</span> : null}
                      {summary.estimatedTime ? <span>{summary.estimatedTime}s</span> : null}
                    </div>
                    <p className="admin-student-question">{summary.text || "Question text pending."}</p>
                    <MathPreview text={summary.text || ""} />

                    {interactionType === "ordering" && orderingSequence.length > 0 ? (
                      <ol className="admin-student-sequence-list">
                        {orderingSequence.map((value, sequenceIndex) => (
                          <li key={`${value}-${sequenceIndex}`} className="admin-student-option is-correct">
                            <strong>{sequenceIndex + 1}</strong>
                            <span>{value}</span>
                          </li>
                        ))}
                      </ol>
                    ) : interactionType === "matching" && matchingPairs.length > 0 ? (
                      <ul className="admin-student-sequence-list">
                        {matchingPairs.map((pair, pairIndex) => (
                          <li key={`${pair.left}-${pairIndex}`} className="admin-student-option is-correct">
                            <strong>{pair.left}</strong>
                            <span> &rarr; {pair.right}</span>
                          </li>
                        ))}
                      </ul>
                    ) : optionEntries.length > 0 ? (
                      <div className="admin-student-options" role="group" aria-label="Answer choices">
                        {optionEntries.map((option) => {
                          const optionKey = String(option.key);
                          const isSelected = selectedAnswer === optionKey;
                          const shouldShowCorrect = hasSelection && correctKeys.includes(optionKey);

                          return (
                            <button
                              key={optionKey}
                              type="button"
                              className={[
                                "admin-student-option",
                                isSelected ? "is-selected" : "",
                                shouldShowCorrect ? "is-correct" : "",
                                isSelected && !isCorrect ? "is-incorrect" : "",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                              onClick={() =>
                                setSelectedAnswers((current) => ({
                                  ...current,
                                  [answerKey]: optionKey,
                                }))
                              }
                            >
                              <strong>{optionKey}</strong>
                              <span>
                                {option.text || "Option text pending."}
                                <MathPreview text={option.text || ""} />
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="admin-student-written-answer">
                        <span>Student answer area</span>
                        <p>Students would type or write their response here.</p>
                      </div>
                    )}

                    {hasSelection ? (
                      <div
                        className={
                          isCorrect
                            ? "admin-student-feedback is-correct"
                            : "admin-student-feedback is-incorrect"
                        }
                      >
                        <strong>{isCorrect ? "Correct" : "Not quite"}</strong>
                        <span>
                          {selectedFeedback ||
                            summary.explanation ||
                            "Use the teacher notes below to explain the answer."}
                        </span>
                      </div>
                    ) : (
                      <div className="admin-student-feedback">
                        <strong>Preview mode</strong>
                        <span>Click an option to see the student-facing feedback behavior.</span>
                      </div>
                    )}
                  </div>

                  <div className="admin-workbench-section">
                    <strong>Teacher preview notes</strong>
                    <div className="admin-workbench-field-grid">
                      <div className="admin-workbench-field">
                        <span>Answer key</span>
                        <strong>{correctKeys.join(", ") || "Not specified yet"}</strong>
                      </div>
                      <div className="admin-workbench-field">
                        <span>Misconception checked</span>
                        <strong>{summary.misconception || "Not specified yet"}</strong>
                      </div>
                    </div>
                    {summary.explanation || summary.teacherNote ? (
                      <div className="admin-workbench-note">
                        <strong>Explanation</strong>
                        <span>{summary.explanation || summary.teacherNote}</span>
                      </div>
                    ) : null}
                  </div>
                </WorkbenchCard>
              );
            })
          ) : (
            <WorkbenchCard title="Generated Questions">
              <p className="admin-workbench-muted">
                No student-facing questions have been generated in Layer 6 yet.
              </p>
            </WorkbenchCard>
          )}
        </div>
      );
    }

    if (activeTab === "Support") {
      const supportSummary = summarizeSupport(support);

      return (
        <div className="admin-workbench-grid">
          <WorkbenchCard title="Learning Support">
            <div className="admin-workbench-stack">
              <div className="admin-workbench-note">
                <strong>Concept explanation</strong>
                <span>{supportSummary.conceptExplanation || "Not generated yet."}</span>
              </div>
              <div className="admin-workbench-note">
                <strong>Correct answer reasoning</strong>
                <span>{supportSummary.correctAnswerReasoning || "Not generated yet."}</span>
              </div>
              <div className="admin-workbench-note">
                <strong>Real-world insight</strong>
                <span>{supportSummary.realWorldInsight || "Not generated yet."}</span>
              </div>
              <div className="admin-workbench-note">
                <strong>Mastery recommendation</strong>
                <span>{supportSummary.masteryRecommendation || "Not generated yet."}</span>
              </div>
            </div>
          </WorkbenchCard>

          <WorkbenchCard title="Progressive Hints">
            <div className="admin-workbench-stack">
              {supportSummary.progressiveHints.length > 0 ? (
                supportSummary.progressiveHints.map((item, index) => (
                  <div key={index} className="admin-workbench-note">
                    <strong>Hint {index + 1}</strong>
                    <span>{item}</span>
                  </div>
                ))
              ) : (
                <p className="admin-workbench-muted">No hints generated yet.</p>
              )}
            </div>
          </WorkbenchCard>

          <WorkbenchCard title="Distractor Analysis">
            <div className="admin-workbench-stack">
              {supportSummary.distractorAnalysis.length > 0 ? (
                supportSummary.distractorAnalysis.map((item, index) => (
                  <div key={index} className="admin-workbench-note">
                    <strong>Distractor {index + 1}</strong>
                    {item.optionText ? <span>Option: {item.optionText}</span> : null}
                    {item.whyIncorrect ? (
                      <span>Why it is incorrect: {item.whyIncorrect}</span>
                    ) : null}
                    {item.reasonSelected ? (
                      <span>Why students may choose it: {item.reasonSelected}</span>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="admin-workbench-muted">No distractor analysis generated yet.</p>
              )}
            </div>
          </WorkbenchCard>

          <WorkbenchCard title="Misconception Feedback">
            <div className="admin-workbench-stack">
              {supportSummary.misconceptionFeedback.length > 0 ? (
                supportSummary.misconceptionFeedback.map((item, index) => (
                  <div key={index} className="admin-workbench-note">
                    <span>{item}</span>
                  </div>
                ))
              ) : (
                <p className="admin-workbench-muted">No misconception feedback generated yet.</p>
              )}
            </div>
          </WorkbenchCard>

          <WorkbenchCard title="Adaptive Remediation">
            <div className="admin-workbench-stack">
              {supportSummary.adaptiveRemediation.length > 0 ? (
                supportSummary.adaptiveRemediation.map((item, index) => (
                  <div key={index} className="admin-workbench-note">
                    <strong>Next step {index + 1}</strong>
                    <span>{item}</span>
                  </div>
                ))
              ) : (
                <p className="admin-workbench-muted">No remediation steps generated yet.</p>
              )}
            </div>
          </WorkbenchCard>

          <WorkbenchCard title="Memory Support References">
            <div className="admin-workbench-stack">
              {supportSummary.memorySupportRefs.length > 0 ? (
                supportSummary.memorySupportRefs.map((item, index) => (
                  <div key={index} className="admin-workbench-note">
                    <span>{item}</span>
                  </div>
                ))
              ) : (
                <p className="admin-workbench-muted">No memory support references generated yet.</p>
              )}
            </div>
          </WorkbenchCard>
        </div>
      );
    }

    if (activeTab === "Analytics") {
      const completedLayers = asArray(audit?.layers).filter((layer) => layer.status === "completed");
      const tokenTotal = asArray(audit?.layers).reduce(
        (sum, layer) => sum + Number(layer.tokenInput || 0) + Number(layer.tokenOutput || 0),
        0
      );
      return (
        <div className="admin-workbench-grid">
          <WorkbenchCard title="Coverage">
            <p className="admin-workbench-large">{assessmentUnits.length} Assessment Units</p>
            <p>{completedLayers.length} completed layer outputs</p>
          </WorkbenchCard>
          <WorkbenchCard title="Token Usage">
            <p className="admin-workbench-large">{tokenTotal.toLocaleString()}</p>
            <p>Total input and output tokens recorded in audit.</p>
          </WorkbenchCard>
          <WorkbenchCard title="Question Families">
            <ChipList items={layer1Output?.question_patterns} />
          </WorkbenchCard>
        </div>
      );
    }

    if (activeTab === "Search") {
      return (
        <div className="admin-workbench-grid">
          <WorkbenchCard title="Universal Search" actionLabel="Search">
            <input
              className="admin-workbench-search-input"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search concept, memory story, misconception, cue..."
            />
            <div className="admin-workbench-stack">
              {searchResults.map((result, index) => (
                <button
                  key={`${result.area}-${result.id}-${index}`}
                  type="button"
                  className="admin-workbench-search-result"
                  onClick={() => {
                    setSelectedAssessmentUnitId(result.id);
                    setActiveTab(result.area);
                  }}
                >
                  <strong>{result.area}</strong>
                  <span>{result.label}</span>
                </button>
              ))}
              {searchTerm && searchResults.length === 0 ? (
                <p className="admin-workbench-muted">No matches yet.</p>
              ) : null}
            </div>
          </WorkbenchCard>
        </div>
      );
    }

    return (
      <div className="admin-workbench-grid">
        {asArray(audit?.layers).map((layer) => (
          <WorkbenchCard
            key={layer.id}
            title={`Layer ${layer.layerNumber}: ${layer.layerName}`}
            actionLabel="Inspect"
          >
            <pre>{formatJson(layer.outputJson)}</pre>
          </WorkbenchCard>
        ))}
      </div>
    );
  };

  return (
    <section className="admin-studio-page admin-workbench-page">
      <div className="admin-studio-header">
        <div>
          <span className="eyebrow">AI research workbench</span>
          <h1>Question Research Workspace</h1>
          <p>Inspect and shape AI-generated assessment assets without editing raw JSON.</p>
        </div>
        <div className="admin-studio-draft">
          <strong>{audit?.job?.status || "Loading"}</strong>
          <span>{jobId}</span>
          <small>{assessmentUnits.length} assessment units</small>
        </div>
      </div>

      <section className="admin-studio-panel admin-workbench-toolbar">
        <div className="admin-panel-head">
          <h2>Research Output</h2>
          <span>Choose the concept to inspect, edit, or regenerate downstream later.</span>
        </div>
        <div className="admin-workbench-actions">
          <Link className="ghost-button" to={`/admin/ai-assessment-studio?step=1&jobId=${jobId}`}>
            Back to Pipeline
          </Link>
          <Link className="ghost-button" to={`/admin/ai-assessment-studio/audit/${jobId}`}>
            AI Inspector Log
          </Link>
        </div>
        {error ? <p className="admin-studio-pipeline-error">{error}</p> : null}
      </section>

      <div className="admin-workbench-shell">
        <aside className="admin-workbench-sidebar">
          <input
            className="admin-workbench-search-input"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search concept..."
          />
          <div className="admin-workbench-au-list">
            {loading ? <p>Loading workbench...</p> : null}
            {assessmentUnits.map((unit) => (
              <button
                key={unit.assessment_unit_id}
                type="button"
                className={
                  unit.assessment_unit_id === selectedId
                    ? "admin-workbench-au is-active"
                    : "admin-workbench-au"
                }
                onClick={() => setSelectedAssessmentUnitId(unit.assessment_unit_id)}
              >
                <strong>{unit.primary_concept}</strong>
                <span>{unit.assessment_unit_id}</span>
              </button>
            ))}
          </div>
        </aside>

        <main className="admin-workbench-main">
          <div className="admin-workbench-tabs">
            {tabs.map((tab) => (
              <button
                key={tab}
                type="button"
                className={activeTab === tab ? "is-active" : ""}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
          {renderTab()}
        </main>
      </div>
    </section>
  );
};
