import crypto from "node:crypto";
import { env } from "../config/env.js";
import { pool } from "../db/pool.js";
import {
  buildAssessmentUnitLayerContext,
  getAssessmentUnitsForSourceSection,
} from "./assessmentStudioContextAssembler.js";
import {
  createStructuredCompletion,
  isOpenAiConfigured,
} from "./openAiService.js";
import { resolveModelForLayer } from "./llm/modelSelectionService.js";
import { getModelRegistryEntry } from "./llm/modelRegistry.js";
import {
  getSubjectProfileFromContext,
  getSubjectLabelFromContext,
} from "./assessmentStudioSubjectProfiles.js";
import { runGated, getConcurrencyStats } from "./llm/concurrencyGate.js";
import { resolveDashboardAcademicFilters } from "./catalogService.js";
import {
  buildPracticeDirectivesText,
  getPracticeTypeProfile,
} from "./assessmentStudioPracticeProfile.js";
import {
  persistLayer1Knowledge,
  persistLayer2ConceptMemory,
  persistLayer3Capability,
  persistLayer4Strategy,
  persistLayer5Blueprint,
  persistLayer6Items,
  persistLayer7Support,
} from "./assessmentStudioPersistence.js";

// Prompt versions are part of every layer's cache key. They MUST be bumped
// whenever the corresponding system/user prompt text changes, otherwise stale
// cached generations are returned. Bumped for the multi-subject refactor.
const DEFAULT_PROMPT_VERSION = "1.1.0";
const LAYER1_PROMPT_VERSION = "1.1.0";
const LAYER2_PROMPT_VERSION = "1.1.0";
const DEFAULT_CONTRACT_SCHEMA_VERSION = "1.0.0";
const MAX_SOURCE_TEXT_CHARS = 12000;
const LAYER1_MAX_ATTEMPTS = 3;
const BENGALI_SCRIPT_PATTERN = /[\u0980-\u09FF]/u;
const allowedAssessmentUnitCategories = [
  "Structure",
  "Function",
  "Process",
  "Relationship",
  "Principle",
  "Classification",
  "Terminology",
];
const allowedCurriculumImportance = ["high", "medium", "low"];

const classifyPipelineFailure = (error) => {
  const message = error?.message || String(error || "");

  if (/^OpenAI network request failed/i.test(message) || /ECONNRESET|ETIMEDOUT|EAI_AGAIN|fetch failed/i.test(message)) {
    return { category: "network", retryable: true, message };
  }
  if (/\(429\)/.test(message)) {
    return { category: "rate_limit", retryable: true, message };
  }
  if (/\((401|403)\)/.test(message) || /insufficient_quota|exceeded your current quota|billing/i.test(message)) {
    return { category: "quota_exceeded", retryable: false, message };
  }
  if (/\((500|502|503|504)\)/.test(message)) {
    return { category: "provider_error", retryable: true, message };
  }
  if (/is not configured/i.test(message)) {
    return { category: "configuration", retryable: false, message };
  }
  if (/validation failed/i.test(message)) {
    return { category: "validation", retryable: true, message };
  }

  return { category: "unknown", retryable: true, message };
};

const getLayer1SourceTextLength = (inputContract = {}) =>
  Number(inputContract?.source_artifacts?.section_text?.full_text_length) ||
  inputContract?.source_artifacts?.section_text?.normalized_text?.length ||
  0;

const getLayer1MaxAssessmentUnitCount = (inputContract = {}) => {
  const sourceLength = getLayer1SourceTextLength(inputContract);

  if (sourceLength <= 800) {
    return 6;
  }
  if (sourceLength <= 2000) {
    return 10;
  }
  if (sourceLength <= 4000) {
    return 14;
  }
  if (sourceLength <= 8000) {
    return 18;
  }
  return 24;
};

const isTaxonomyText = (value = "") =>
  /\btaxonom|taxonomic|taxonomy|classification hierarchy|taxonomic hierarchy\b/i.test(
    String(value || "")
  );

const getLayer1AssessmentUnitCountRange = (inputContract = {}) => {
  const sourceLength = getLayer1SourceTextLength(inputContract);
  const sourceText =
    inputContract?.source_artifacts?.section_text?.normalized_text ||
    inputContract?.context?.chapter ||
    "";
  const max = getLayer1MaxAssessmentUnitCount(inputContract);

  if (sourceLength <= 800) {
    return { min: 3, max };
  }

  if (sourceLength <= 2000 && isTaxonomyText(sourceText)) {
    return { min: 8, max };
  }

  if (sourceLength <= 2000) {
    return { min: 6, max };
  }

  if (sourceLength <= 4000) {
    return { min: 8, max };
  }

  if (sourceLength <= 8000) {
    return { min: 10, max };
  }

  return { min: 12, max };
};

const normalizeConceptText = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeLanguageCode = (value = "") => {
  const normalized = String(value || "").trim().toLowerCase();

  if (!normalized) {
    return "";
  }

  if (["bn", "bn-bd", "bn-in", "bengali", "bangla"].includes(normalized)) {
    return "bn";
  }

  if (["en", "en-us", "en-gb", "english"].includes(normalized)) {
    return "en";
  }

  return normalized;
};

const detectSourceLanguage = (value = "") =>
  BENGALI_SCRIPT_PATTERN.test(String(value || "")) ? "bn" : "en";

const getLanguageDirectives = (inputContract = {}) => {
  const language = inputContract?.language || {};
  const directives = inputContract?.generation_directives || {};
  const sourceLanguage =
    normalizeLanguageCode(language.source_language || directives.source_language) || "en";
  const outputLanguage =
    normalizeLanguageCode(language.output_language || directives.output_language || sourceLanguage) ||
    sourceLanguage;

  return {
    sourceLanguage,
    outputLanguage,
    sameLanguageOutput: sourceLanguage === outputLanguage,
    localizeLearnerFacingText: outputLanguage !== "en",
  };
};

const buildLanguageRulesForPrompt = (inputContract = {}) => {
  const { sourceLanguage, outputLanguage } = getLanguageDirectives(inputContract);
  const targetLabel = outputLanguage === "bn" ? "Bengali" : outputLanguage;

  return [
    "Language rules:",
    `- Source language code: ${sourceLanguage}`,
    `- Output language code: ${outputLanguage}`,
    `- All learner-facing strings in the JSON values must be written in ${targetLabel}.`,
    "- Keep JSON keys, assessment_unit_id values, enum codes, and canonical pattern slugs in English.",
    "- Keep question_patterns as canonical English slugs such as hierarchy-completion or odd-one-out even when the surrounding explanatory text is in another language.",
    "- Do not translate machine-facing field names or schema keys.",
  ].join("\n");
};

const collectLayer1ExampleLabels = (parsed = {}) => {
  const labels = new Set();

  for (const item of parsed.classifications || []) {
    const name = normalizeConceptText(item?.name);
    if (name.includes("example")) {
      for (const member of item?.members || []) {
        const label = normalizeConceptText(member);
        if (label) {
          labels.add(label);
        }
      }
    }
  }

  for (const hook of parsed.memory_hooks || []) {
    const text =
      typeof hook === "string"
        ? hook
        : hook?.hook || hook?.linked_concept || hook?.concept || "";
    const quoted = String(text).match(/'([^']+)'|"([^"]+)"/g) || [];
    for (const value of quoted) {
      const label = normalizeConceptText(value.replace(/['"]/g, ""));
      if (label && label.split(/\s+/).length <= 5) {
        labels.add(label);
      }
    }
  }

  return labels;
};

const isExampleLikeAssessmentUnit = ({ primaryConcept, supportingConcepts, exampleLabels }) => {
  const normalizedPrimary = normalizeConceptText(primaryConcept);
  if (!normalizedPrimary) {
    return false;
  }

  const examplePhrasePatterns = [
    // Requires "recognisable/recognizable" (not just "as a group/category") so
    // legitimate definitional phrasing like "Genus as a group of closely
    // related species" is not mistaken for example-promotion, matching the
    // "insects as a recognisable group" case this rule was written for.
    /\bas (an?|the)?\s*(recognisable|recognizable)\s*(taxonomic\s*)?(group|example|category)\b/,
    /\bexample of\b/,
    /\bsuch as\b/,
  ];
  if (examplePhrasePatterns.some((pattern) => pattern.test(normalizedPrimary))) {
    return true;
  }

  for (const label of exampleLabels) {
    if (
      label &&
      (normalizedPrimary === label ||
        normalizedPrimary.startsWith(`${label} as `) ||
        normalizedPrimary.includes(` ${label} as `))
    ) {
      return true;
    }
  }

  const supportText = normalizeConceptText((supportingConcepts || []).join(" "));
  const exampleOnlySupportPatterns = [
    /\bcommon features\b/,
    /\bshared features\b/,
    /\bgroup recognition\b/,
    /\bcategory assignment\b/,
  ];

  return (
    [...exampleLabels].some((label) => normalizedPrimary.includes(label)) &&
    exampleOnlySupportPatterns.some((pattern) => pattern.test(supportText))
  );
};

const isObservableFactAssessmentUnit = ({ primaryConcept, supportingConcepts }) => {
  const normalizedPrimary = normalizeConceptText(primaryConcept);
  if (!normalizedPrimary) {
    return false;
  }

  const factOnlyPatterns = [
    /\b\d+\s*(pairs?|sets?|types?|kinds?)\b/,
    /\b(one|two|three|four|five|six|seven|eight|nine|ten)\s+(pairs?|sets?|types?|kinds?)\b/,
    /\bjointed legs?\b/,
    /\blowest category\b/,
    /\bplant equivalent\b/,
    /\bequivalent to\b/,
  ];
  const broaderObjectivePatterns = [
    /\busing\b/,
    /\bbasis\b/,
    /\brecognition\b/,
    /\bclassification\b/,
    /\brelationship\b/,
    /\bprinciple\b/,
    /\brole\b/,
    /\bprocess\b/,
  ];

  if (
    factOnlyPatterns.some((pattern) => pattern.test(normalizedPrimary)) &&
    !broaderObjectivePatterns.some((pattern) => pattern.test(normalizedPrimary))
  ) {
    return true;
  }

  const supportText = normalizeConceptText((supportingConcepts || []).join(" "));
  const supportLooksLikeFeatureEvidence =
    /\bcharacters?\b|\bfeatures?\b|\bshared\b|\binsect\b|\bexample\b/.test(supportText);

  return (
    supportLooksLikeFeatureEvidence &&
    /\b(legs?|pairs?|equivalent|lowest)\b/.test(normalizedPrimary) &&
    !broaderObjectivePatterns.some((pattern) => pattern.test(normalizedPrimary))
  );
};

const terminologyMergeClusters = [
  {
    name: "taxonomic category-rank-taxon relationship",
    terms: [
      "category",
      "taxonomic category",
      "rank",
      "taxon",
      "taxa",
      "unit of classification",
    ],
    preferredConcept: "taxonomic category, rank, and taxon relationship",
  },
];

const findTerminologyOverfragmentation = (assessmentUnits = []) => {
  for (const cluster of terminologyMergeClusters) {
    const matchedUnits = assessmentUnits.filter((unit) => {
      const primary = normalizeConceptText(unit?.primary_concept || unit?.primaryConcept);
      return cluster.terms.some((term) => primary === term);
    });

    if (matchedUnits.length >= 3) {
      return {
        cluster,
        matchedConcepts: matchedUnits
          .map((unit) => unit.primary_concept || unit.primaryConcept)
          .filter(Boolean),
      };
    }
  }

  return null;
};

const hierarchyMemberClusters = [
  {
    name: "common taxonomic hierarchy ranks",
    members: [
      "kingdom",
      "phylum",
      "division",
      "class",
      "order",
      "family",
      "genus",
      "species",
    ],
    preferredConcept: "common taxonomic hierarchy levels",
  },
];

const findHierarchyMemberFragmentation = (assessmentUnits = []) => {
  for (const cluster of hierarchyMemberClusters) {
    const matchedUnits = assessmentUnits.filter((unit) => {
      const primary = normalizeConceptText(unit?.primary_concept || unit?.primaryConcept);
      return cluster.members.some((member) => primary === member);
    });

    if (matchedUnits.length >= 3) {
      return {
        cluster,
        matchedConcepts: matchedUnits
          .map((unit) => unit.primary_concept || unit.primaryConcept)
          .filter(Boolean),
      };
    }
  }

  return null;
};

const normalizeDependencyId = (dependency) =>
  typeof dependency === "string"
    ? dependency
    : dependency?.assessment_unit_id ||
      dependency?.assessmentUnitId ||
      dependency?.depends_on_assessment_unit_id ||
      dependency?.dependsOnAssessmentUnitId ||
      "";

const analyzeLayer1DependencyGraph = (assessmentUnits = []) => {
  const ids = new Set(
    assessmentUnits
      .map((unit) => unit?.assessment_unit_id || unit?.assessmentUnitId)
      .filter(Boolean)
  );
  const dependencyLists = assessmentUnits.map((unit) =>
    (unit?.dependencies || [])
      .map(normalizeDependencyId)
      .filter(Boolean)
  );
  const invalidDependencyId = dependencyLists
    .flat()
    .find((dependencyId) => !ids.has(dependencyId));

  if (invalidDependencyId) {
    return {
      isValid: false,
      reason: `unknown dependency id "${invalidDependencyId}"`,
    };
  }

  if (assessmentUnits.length < 6) {
    return { isValid: true };
  }

  const dependencyCounts = dependencyLists.map((dependencies) => dependencies.length);
  const dependentUnits = dependencyCounts.filter((count) => count > 0).length;
  const singleDependencyUnits = dependencyCounts.filter((count) => count === 1).length;
  const multiDependencyUnits = dependencyCounts.filter((count) => count > 1).length;
  const mostlyLinear =
    dependentUnits >= assessmentUnits.length - 1 &&
    singleDependencyUnits / Math.max(dependentUnits, 1) > 0.8 &&
    multiDependencyUnits < 2;

  if (mostlyLinear) {
    return {
      isValid: false,
      reason:
        "dependency graph is mostly a one-parent linear chain; use prerequisite relationships and multiple parents where concepts combine",
    };
  }

  return { isValid: true };
};

const findConceptualStructureMisclassification = (structures = []) =>
  structures.find((structure) => {
    const name = normalizeConceptText(
      typeof structure === "string" ? structure : structure?.name || structure?.structure || ""
    );
    const description = normalizeConceptText(
      typeof structure === "string"
        ? ""
        : [
            structure?.description,
            structure?.type,
            structure?.location,
            ...normalizeTextArray(structure?.components),
          ].join(" ")
    );
    const combined = `${name} ${description}`.trim();

    return /\b(hierarchy|taxonomic hierarchy|category|rank|classification system|arrangement)\b/.test(
      combined
    );
  });

const findPrincipleFunctionMisclassification = (functions = []) =>
  functions.find((entry) => {
    const entity = normalizeConceptText(
      typeof entry === "string"
        ? entry
        : entry?.entity || entry?.structure || entry?.name || entry?.concept || ""
    );
    const functionText = normalizeConceptText(
      typeof entry === "string"
        ? entry
        : entry?.function || entry?.importance || entry?.description || ""
    );
    const combined = `${entity} ${functionText}`.trim();

    return (
      /\b(knowledge|comparison|similarities|dissimilarities|characters of organisms|identification)\b/.test(
        combined
      ) &&
      /\b(helps?|supports?|used to|basis|classification|placing organisms|taxonomic categories)\b/.test(
        combined
      )
    );
  });

const relationshipTermPattern =
  /\b(taxonomic category|category|rank|taxon|taxa|unit of classification|classification unit)\b/;

const getComparisonTerms = (comparison = {}) => {
  const explicitItems = comparison?.items_compared || comparison?.itemsCompared;
  if (Array.isArray(explicitItems)) {
    return explicitItems.map(normalizeConceptText).filter(Boolean);
  }

  return [
    comparison?.entity_1,
    comparison?.entity1,
    comparison?.left,
    comparison?.entity_2,
    comparison?.entity2,
    comparison?.right,
  ]
    .map(normalizeConceptText)
    .filter(Boolean);
};

const findConceptualRelationshipAsComparison = (comparisons = []) =>
  comparisons.find((comparison) => {
    const terms = getComparisonTerms(comparison);
    const relationshipTerms = terms.filter((term) => relationshipTermPattern.test(term));
    const combined = normalizeConceptText(
      [
        ...terms,
        comparison?.key_difference,
        comparison?.keyDifference,
        comparison?.comparison_basis,
        comparison?.comparisonBasis,
        comparison?.relationship_summary,
        comparison?.summary,
      ].join(" ")
    );

    return (
      relationshipTerms.length >= 2 &&
      /\b(role|taxonomy|taxonomic|classification|relationship|represents|termed|denotes)\b/.test(
        combined
      )
    );
  });

const findReminderMemoryHook = (memoryHooks = []) =>
  memoryHooks.find((entry) => {
    const text = normalizeConceptText(
      typeof entry === "string"
        ? entry
        : [entry?.hook, entry?.memory_hook, entry?.linked_concept, entry?.concept]
            .filter(Boolean)
            .join(" ")
    );

    if (!text) {
      return false;
    }

    const reminderPatterns = [
      /\bsource states\b/,
      /\bis listed\b/,
      /\blisted in the source\b/,
      /\bidentified in the text\b/,
      /\bhierarchy is\b/,
      /\bspecies is the lowest\b/,
      /\bkingdom phylum\b/,
      /\bthree pairs of jointed legs\b/,
    ];
    const actualMemorySupportPatterns = [
      /\brequires memory support\b/,
      /\bmemory load\b/,
      /\brecall difficulty\b/,
      /\bconfusion risk\b/,
      /\bsequence recall\b/,
      /\bterminology recall\b/,
      /\brecognised by\b/,
      /\brecognized by\b/,
      /\bshared characters?\b/,
      /\bshared features?\b/,
      /\bconfusion-prone\b/,
      /\bneeds? memory support\b/,
    ];

    return (
      reminderPatterns.some((pattern) => pattern.test(text)) &&
      !actualMemorySupportPatterns.some((pattern) => pattern.test(text))
    );
  });

const isTaxonomyHierarchyContent = (parsed = {}) => {
  const combined = normalizeConceptText(
    [
      parsed.context_summary,
      ...normalizeTextArray(parsed.core_concepts),
      ...normalizeTextArray(parsed.terminology).map((item) => `${item?.term || ""} ${item?.meaning || ""}`),
      ...normalizeTextArray(parsed.stages_sequences).map(
        (item) => `${item?.name || ""} ${normalizeTextArray(item?.sequence).join(" ")}`
      ),
      ...normalizeTextArray(parsed.classifications).map(
        (item) => `${item?.name || ""} ${normalizeTextArray(item?.members).join(" ")}`
      ),
    ].join(" ")
  );

  return (
    /\btaxonom|taxonomic|taxonomy\b/.test(combined) ||
    (/\bhierarchy\b/.test(combined) &&
      /\bkingdom\b|\bphylum\b|\bgenus\b|\bspecies\b/.test(combined))
  );
};

const findMissingTaxonomyQuestionPattern = (parsed = {}) => {
  if (!isTaxonomyHierarchyContent(parsed)) {
    return null;
  }

  const patterns = (parsed.question_patterns || []).map(normalizeConceptText);
  const requiredFamilies = [
    {
      label: "hierarchy-completion",
      matches: [/hierarchy.*completion/, /sequence.*completion/],
    },
    {
      label: "table-completion",
      matches: [/table.*completion/, /completion.*table/],
    },
    {
      label: "odd-one-out",
      matches: [/odd.*one.*out/, /odd.*out/],
    },
    {
      label: "taxonomy-tree-interpretation",
      matches: [/taxonomy.*tree/, /classification.*tree/, /tree.*interpretation/],
    },
  ];

  return requiredFamilies.find(
    (family) =>
      !patterns.some((pattern) => family.matches.some((matcher) => matcher.test(pattern)))
  );
};

const getQuestionPatternValue = (item) =>
  typeof item === "string"
    ? item
    : item?.pattern_name || item?.name || item?.question_family || item?.label || "";

const findInvalidQuestionPattern = (questionPatterns = []) =>
  questionPatterns.find((item) => {
    const value = getQuestionPatternValue(item);
    const trimmed = String(value || "").trim();
    const normalized = normalizeConceptText(trimmed);

    if (!trimmed) {
      return true;
    }

    const isSlugLabel = /^[a-z][a-z0-9]*(?:-[a-z0-9]+){1,5}$/i.test(trimmed);
    const isShortNounPhrase =
      !/[?]/.test(trimmed) &&
      trimmed.split(/\s+/).length <= 4 &&
      !/^(define|explain|why|how|list|differentiate|compare|describe|arrange|identify|what|which|when|where)\b/i.test(
        trimmed
      );

    return (
      !isSlugLabel &&
      !isShortNounPhrase &&
      (/[?]/.test(trimmed) ||
        /^(define|explain|why|how|list|differentiate|compare|describe|arrange|identify|what|which|when|where)\b/i.test(
          trimmed
        ) ||
        normalized.split(/\s+/).length > 4)
    );
  });

const learningObjectiveVerbPattern =
  /^(apply|interpret|justify|compare|recognise|recognize|explain|evaluate|analyze|analyse|identify|distinguish|differentiate|classify|use|relate|arrange|sequence|order|rank|infer|predict|describe)\b/i;

const isLearningObjectiveLikePrimaryConcept = (primaryConcept = "") =>
  learningObjectiveVerbPattern.test(String(primaryConcept || "").trim());

// Rewrites Layer 1 assessment_unit ids to a subject-scoped, section-scoped form
// (e.g. MAT-AU-42-001) so two different sections can never collide on a global
// unique id, and remaps every dependency reference to match. Deterministic and
// idempotent (same input order -> same ids), so it is safe on both fresh and
// cached outputs. The id is opaque VARCHAR(80) downstream, so this needs no
// schema change.
const buildLayer1AssessmentUnitId = (prefix, sectionId, index) =>
  `${prefix}-AU-${sectionId ? `${sectionId}-` : ""}${String(index + 1).padStart(3, "0")}`;

const normalizeLayer1AssessmentUnitIds = ({ parsed, profile, sourceSectionId }) => {
  if (!parsed || !Array.isArray(parsed.assessment_units)) {
    return parsed;
  }

  const prefix = profile.auPrefix;
  const idMap = new Map();

  const newIds = parsed.assessment_units.map((unit, index) => {
    const originalId = String(
      unit?.assessment_unit_id || unit?.assessmentUnitId || unit?.id || ""
    ).trim();
    const newId = buildLayer1AssessmentUnitId(prefix, sourceSectionId, index);
    if (originalId) {
      idMap.set(originalId, newId);
    }
    return newId;
  });

  const remapDependency = (dependency) => {
    const depId = normalizeDependencyId(dependency);
    const mappedId = idMap.get(depId) || depId;
    if (typeof dependency === "string") {
      return mappedId;
    }
    if (dependency && typeof dependency === "object") {
      return { ...dependency, depends_on_assessment_unit_id: mappedId };
    }
    return mappedId;
  };

  parsed.assessment_units = parsed.assessment_units.map((unit, index) => {
    const nextUnit = { ...unit, assessment_unit_id: newIds[index] };
    delete nextUnit.assessmentUnitId;
    delete nextUnit.id;
    if (Array.isArray(unit?.dependencies)) {
      nextUnit.dependencies = unit.dependencies.map(remapDependency);
    }
    return nextUnit;
  });

  return parsed;
};

const layer2AllowedMemoryKeys = new Set([
  "concept_memory",
  "concept_memories",
  "assessment_unit_id",
  "assessmentUnitId",
  "concept_id",
  "conceptId",
  "concept_label",
  "conceptLabel",
  "definition",
  "formula",
  "attributes",
  "properties",
  "classification",
  "classifications",
  "examples",
  "exceptions",
  "terms",
  "aliases",
  "relationships",
  "prerequisites",
  "flashcards",
  "concept_map_edges",
  "conceptMapEdges",
  "mind_map_branches",
  "mindMapBranches",
  "tutor_grounding",
  "tutorGrounding",
  "search_metadata",
  "searchMetadata",
  "primary_concept",
  "primaryConcept",
  "story",
  "analogy",
  "visual_hook",
  "visualHook",
  "real_world_connection",
  "realWorldConnection",
  "memory_trick",
  "memoryTrick",
  "curiosity_hook",
  "curiosityHook",
  "micro_activity",
  "microActivity",
  "retrieval_cues",
  "retrievalCues",
  "misconception_alert",
  "misconceptionAlert",
  "associated_concepts",
  "associatedConcepts",
  "supporting_concepts",
  "supportingConcepts",
  "memory_difficulty",
  "memoryDifficulty",
]);

const layer2ForbiddenKeys = new Set([
  "learning_objectives",
  "learningObjectives",
  "objective_ref",
  "objectiveRef",
  "competencies",
  "skills",
  "bloom",
  "blooms",
  "difficulty",
  "reasoning_patterns",
  "reasoningPatterns",
  "instructional_use",
  "instructionalUse",
  "instructional_emphasis",
  "instructionalEmphasis",
  "instructional_alignment",
  "instructionalAlignment",
  "competency_prompts",
  "competencyPrompts",
  "evidence_of_mastery",
  "evidenceOfMastery",
  "assessment_readiness",
  "assessmentReadiness",
  "mastery_evidence",
  "masteryEvidence",
  "question_prompts",
  "questionPrompts",
  "blueprint_guidance",
  "blueprintGuidance",
  "strategy_guidance",
  "strategyGuidance",
  "question_patterns",
  "questionPatterns",
  "layer1_alignment",
  "layer2_alignment",
  "layer3_alignment",
  "layer4_alignment",
  "layer5_alignment",
  "layer6_alignment",
  "layer7_alignment",
]);

const findForbiddenLayer2Key = (value) => {
  if (!value || typeof value !== "object") {
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findForbiddenLayer2Key(item);
      if (found) {
        return found;
      }
    }
    return null;
  }

  for (const key of Object.keys(value)) {
    if (layer2ForbiddenKeys.has(key)) {
      return key;
    }
    const found = findForbiddenLayer2Key(value[key]);
    if (found) {
      return found;
    }
  }

  return null;
};

const layer5ForbiddenBlueprintKeys = new Set([
  "primary_concept",
  "primaryConcept",
  "assessment_dimension",
  "assessmentDimension",
  "learning_objective",
  "learningObjective",
  "partial_credit",
  "partialCredit",
  "distractor_strategy",
  "distractorStrategy",
  "adaptive_json",
  "adaptiveJson",
  "adaptive",
  "assessment_notes",
  "assessmentNotes",
]);

const layer4ForbiddenStrategyKeys = new Set([
  "assessment_philosophy",
  "assessmentPhilosophy",
  "pedagogical_rationale",
  "pedagogicalRationale",
  "strategy_summary",
  "strategySummary",
  "curriculum_alignment_notes",
  "curriculumAlignmentNotes",
  "why_this_strategy",
  "whyThisStrategy",
  "teaching_implications",
  "teachingImplications",
  "expected_learning_behaviour",
  "expectedLearningBehaviour",
  "assessment_intent",
  "assessmentIntent",
  "instructional_considerations",
  "instructionalConsiderations",
  "recommendations",
  "remediations",
  "remediation",
]);

const layer3ForbiddenCapabilityKeys = new Set([
  "learning_summary",
  "learningSummary",
  "chapter_summary",
  "chapterSummary",
  "pedagogical_notes",
  "pedagogicalNotes",
  "teacher_guidance",
  "teacherGuidance",
  "importance",
  "real_world_importance",
  "realWorldImportance",
  "why_this_matters",
  "whyThisMatters",
  "instructional_notes",
  "instructionalNotes",
  "teaching_recommendations",
  "teachingRecommendations",
  "curriculum_notes",
  "curriculumNotes",
  "assessment_rationale",
  "assessmentRationale",
  "notes",
  "description",
  "rationale",
  "opportunities",
  "dimensions",
]);

const layer7ForbiddenSupportKeys = new Set([
  "story",
  "analogy",
  "visual_hook",
  "visualHook",
  "memory_trick",
  "memoryTrick",
  "retrieval_cues",
  "retrievalCues",
  "curiosity_hook",
  "curiosityHook",
  "micro_activity",
  "microActivity",
  "revision_note",
  "revisionNote",
  "revision_notes",
  "revisionNotes",
  "teacher_note",
  "teacherNote",
  "teacher_notes",
  "teacherNotes",
  "parent_note",
  "parentNote",
  "parent_notes",
  "parentNotes",
  "performance_summary",
  "performanceSummary",
  "learning_analytics",
  "learningAnalytics",
  "memory_reinforcement",
  "memoryReinforcement",
]);

const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const extractEntryText = (entry) => {
  if (typeof entry === "string") {
    return entry.trim();
  }
  if (typeof entry === "number" || typeof entry === "boolean") {
    return String(entry);
  }
  if (isPlainObject(entry)) {
    const candidateKeys = [
      "text",
      "hint",
      "value",
      "label",
      "name",
      "term",
      "content",
      "description",
      "detail",
      "note",
      "message",
      "action",
      "step",
    ];
    for (const key of candidateKeys) {
      if (typeof entry[key] === "string" && entry[key].trim()) {
        return entry[key].trim();
      }
    }
    const stringValues = Object.values(entry).filter(
      (value) => typeof value === "string" && value.trim()
    );
    if (stringValues.length) {
      return stringValues.join(" ").trim();
    }
  }
  return "";
};

const toMachineSlug = (value = "") =>
  extractEntryText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const toTitleToken = (value = "") => {
  const normalized = String(value || "")
    .trim()
    .replace(/[_-]+/g, " ")
    .toLowerCase();

  if (!normalized) {
    return "";
  }

  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
};

const normalizeTextArray = (value, transform = (item) => item) => {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  const seen = new Set();
  const items = [];

  for (const entry of values) {
    const normalized = transform(entry);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    items.push(normalized);
  }

  return items;
};

const getStrategyObject = (parsed = {}) => {
  if (isPlainObject(parsed?.strategy)) {
    return parsed.strategy;
  }

  if (Array.isArray(parsed?.strategies) && parsed.strategies.length === 1) {
    return parsed.strategies[0];
  }

  return null;
};

const getCapabilityObject = (parsed = {}) => {
  if (isPlainObject(parsed?.capability)) {
    return parsed.capability;
  }

  if (Array.isArray(parsed?.capabilities) && parsed.capabilities.length === 1) {
    return parsed.capabilities[0];
  }

  return null;
};

const getLayer2MemoryObject = (parsed = {}) => {
  if (isPlainObject(parsed?.concept_memory)) {
    return parsed.concept_memory;
  }

  if (Array.isArray(parsed?.concept_memories) && parsed.concept_memories.length === 1) {
    return parsed.concept_memories[0];
  }

  return null;
};

const getLayer7SupportObject = (parsed = {}) =>
  isPlainObject(parsed?.learning_support) ? parsed.learning_support : null;

const normalizeLayer3CapabilityContract = (
  parsed = {},
  { assessmentUnitId, inputContract } = {}
) => {
  const capability = getCapabilityObject(parsed) || {};
  const resolvedAssessmentUnitId =
    assessmentUnitId ||
    inputContract?.assessment_unit?.assessment_unit_id ||
    capability?.assessment_unit_id ||
    capability?.assessmentUnitId ||
    "";
  const concept = toMachineSlug(
    capability?.concept ||
      capability?.primary_concept ||
      capability?.primaryConcept ||
      inputContract?.assessment_unit?.primary_concept ||
      ""
  );
  const rawObjectives =
    capability?.objectives ||
    capability?.objective_refs ||
    capability?.objectiveRefs ||
    capability?.learning_objectives ||
    capability?.learningObjectives ||
    capability?.objective_ref ||
    capability?.objectiveRef ||
    [];
  const objectives = normalizeTextArray(rawObjectives, (entry) => {
    if (typeof entry === "string") {
      const trimmed = entry.trim();
      return trimmed || "";
    }
    if (isPlainObject(entry)) {
      return (
        String(entry?.id || entry?.objective_id || entry?.objectiveId || "").trim() || ""
      );
    }
    return "";
  });

  const competencies = normalizeTextArray(
    capability?.competencies || capability?.skills,
    (entry) => toMachineSlug(typeof entry === "string" ? entry : entry?.name || entry?.skill)
  );
  const skills = normalizeTextArray(
    capability?.skills || capability?.behaviours || capability?.behaviors,
    (entry) => toMachineSlug(typeof entry === "string" ? entry : entry?.name || entry?.skill)
  );
  const bloom = normalizeTextArray(
    capability?.bloom || capability?.blooms || capability?.cognitive_level || capability?.cognitiveLevel,
    (entry) => toTitleToken(typeof entry === "string" ? entry : entry?.level || entry?.name)
  );
  const mastery = normalizeTextArray(
    capability?.mastery || capability?.mastery_indicators || capability?.masteryIndicators,
    (entry) => toMachineSlug(typeof entry === "string" ? entry : entry?.name || entry?.indicator)
  );

  const misconceptionSource =
    capability?.misconceptions ||
    inputContract?.misconception_profile ||
    [];
  const misconceptionValues = Array.isArray(misconceptionSource)
    ? misconceptionSource
    : misconceptionSource
      ? [misconceptionSource]
      : [];
  const misconceptions = [];
  for (const [index, entry] of misconceptionValues.entries()) {
    let code = "";
    if (typeof entry === "string") {
      const trimmed = entry.trim();
      code = /^M\d{2,}$/i.test(trimmed)
        ? trimmed.toUpperCase()
        : `M${String(index + 1).padStart(2, "0")}`;
    } else if (
      isPlainObject(entry) &&
      typeof entry?.code === "string" &&
      /^M\d{2,}$/i.test(entry.code)
    ) {
      code = entry.code.toUpperCase();
    } else {
      code = `M${String(index + 1).padStart(2, "0")}`;
    }

    if (!misconceptions.includes(code)) {
      misconceptions.push(code);
    }
  }

  const dependencies = normalizeTextArray(
    capability?.dependencies || inputContract?.prerequisite_list || [],
    (entry) => {
      if (typeof entry === "string") {
        return entry.trim();
      }
      return (
        String(
          entry?.assessment_unit_id ||
            entry?.assessmentUnitId ||
            entry?.depends_on_assessment_unit_id ||
            entry?.dependsOnAssessmentUnitId ||
            entry?.dependency_name ||
            entry?.name ||
            ""
        ).trim() || ""
      );
    }
  );

  return {
    capability: {
      assessment_unit_id: resolvedAssessmentUnitId,
      concept: concept || toMachineSlug(resolvedAssessmentUnitId),
      objectives:
        objectives.length > 0 ? objectives : [`${resolvedAssessmentUnitId}-OBJ-1`],
      competencies: competencies.length > 0 ? competencies : ["classify"],
      skills: skills.length > 0 ? skills : ["identify"],
      bloom: bloom.length > 0 ? bloom : ["Understand"],
      mastery: mastery.length > 0 ? mastery : ["correct_understanding"],
      misconceptions,
      dependencies,
    },
  };
};

const normalizeDifficultyDistribution = (difficulty, fallback = "medium") => {
  const base = normalizeDifficultyValue(fallback, "medium");
  const source = isPlainObject(difficulty) ? difficulty : {};
  const easy =
    Number(source?.E ?? source?.easy ?? (base === "easy" ? 60 : base === "hard" ? 10 : 20)) || 0;
  const medium =
    Number(
      source?.M ?? source?.medium ?? (base === "easy" ? 30 : base === "hard" ? 30 : 60)
    ) || 0;
  const hard =
    Number(source?.H ?? source?.hard ?? (base === "easy" ? 10 : base === "hard" ? 60 : 20)) || 0;
  const total = easy + medium + hard;

  if (total <= 0) {
    return { E: 20, M: 60, H: 20 };
  }

  return {
    E: Math.round((easy / total) * 100),
    M: Math.round((medium / total) * 100),
    H: Math.max(0, 100 - Math.round((easy / total) * 100) - Math.round((medium / total) * 100)),
  };
};

const normalizeLayer2ConceptMemoryContract = (
  parsed = {},
  { assessmentUnitId, inputContract } = {}
) => {
  const memory = getLayer2MemoryObject(parsed) || {};
  const resolvedAssessmentUnitId =
    assessmentUnitId ||
    inputContract?.assessment_unit?.assessment_unit_id ||
    memory?.assessment_unit_id ||
    memory?.assessmentUnitId ||
    "";
  const conceptLabel = String(
    memory?.concept_label ||
      memory?.conceptLabel ||
      memory?.primary_concept ||
      memory?.primaryConcept ||
      inputContract?.assessment_unit?.primary_concept ||
      ""
  ).trim();
  const conceptId =
    String(memory?.concept_id || memory?.conceptId || "").trim() ||
    toMachineSlug(conceptLabel) ||
    toMachineSlug(resolvedAssessmentUnitId);

  const relationships = normalizeTextArray(memory?.relationships, (entry) => {
    if (typeof entry === "string") {
      const target = toMachineSlug(entry);
      return target ? JSON.stringify({ relation: "related_to", target }) : "";
    }
    if (isPlainObject(entry)) {
      const relation = toMachineSlug(entry?.relation || entry?.type || "related_to");
      const target = toMachineSlug(entry?.target || entry?.concept || entry?.name || "");
      if (relation && target) {
        return JSON.stringify({ relation, target });
      }
    }
    return "";
  }).map((entry) => JSON.parse(entry));

  const conceptMapEdges = normalizeTextArray(
    memory?.concept_map_edges || memory?.conceptMapEdges || memory?.relationships,
    (entry) => {
      if (typeof entry === "string") {
        const target = toMachineSlug(entry);
        return target
          ? JSON.stringify({ source: conceptId, relation: "related_to", target })
          : "";
      }
      if (isPlainObject(entry)) {
        const source = toMachineSlug(entry?.source || conceptId);
        const relation = toMachineSlug(entry?.relation || entry?.type || "related_to");
        const target = toMachineSlug(entry?.target || entry?.concept || entry?.name || "");
        if (source && relation && target) {
          return JSON.stringify({ source, relation, target });
        }
      }
      return "";
    }
  ).map((entry) => JSON.parse(entry));

  const flashcards = normalizeTextArray(memory?.flashcards, (entry) => {
    if (typeof entry === "string") {
      return JSON.stringify({ front: conceptLabel, back: entry.trim() });
    }
    if (isPlainObject(entry)) {
      const front = String(entry?.front || entry?.question || "").trim();
      const back = String(entry?.back || entry?.answer || "").trim();
      if (front && back) {
        return JSON.stringify({ front, back, tag: toMachineSlug(entry?.tag || "") || undefined });
      }
    }
    return "";
  }).map((entry) => JSON.parse(entry));

  const mindMapBranches = normalizeTextArray(
    memory?.mind_map_branches || memory?.mindMapBranches || memory?.supporting_concepts || memory?.supportingConcepts,
    (entry) => {
      if (typeof entry === "string") {
        const label = entry.trim();
        return label ? JSON.stringify({ label }) : "";
      }
      if (isPlainObject(entry)) {
        const label = String(entry?.label || entry?.name || "").trim();
        const children = normalizeTextArray(entry?.children, (child) =>
          typeof child === "string" ? child.trim() : String(child?.label || child?.name || "").trim()
        );
        if (label) {
          return JSON.stringify({ label, children });
        }
      }
      return "";
    }
  ).map((entry) => JSON.parse(entry));

  const tutorGrounding = {
    summary: String(memory?.definition || memory?.story || "").trim(),
    misconceptions: normalizeTextArray(
      [memory?.misconception_alert || memory?.misconceptionAlert],
      (entry) => extractEntryText(entry)
    ),
    retrieval_cues: normalizeTextArray(
      memory?.retrieval_cues || memory?.retrievalCues,
      (entry) => extractEntryText(entry)
    ),
    prerequisites: normalizeTextArray(memory?.prerequisites, (entry) =>
      typeof entry === "string" ? entry.trim() : String(entry?.concept || entry?.id || "").trim()
    ),
  };

  const searchMetadata = {
    keywords: normalizeTextArray(
      [
        ...normalizeTextArray(memory?.terms),
        ...normalizeTextArray(memory?.aliases),
        ...normalizeTextArray(memory?.examples),
        conceptLabel,
      ],
      (entry) => extractEntryText(entry)
    ),
    semantic_text: [
      conceptLabel,
      memory?.definition,
      ...normalizeTextArray(memory?.properties, (entry) => extractEntryText(entry)),
      ...normalizeTextArray(memory?.attributes, (entry) => extractEntryText(entry)),
      ...normalizeTextArray(memory?.examples, (entry) => extractEntryText(entry)),
    ]
      .filter(Boolean)
      .join(" | "),
  };

  return {
    concept_memory: {
      assessment_unit_id: resolvedAssessmentUnitId,
      concept_id: conceptId,
      concept_label: conceptLabel,
      definition: String(memory?.definition || "").trim(),
      formula: String(memory?.formula || "").trim(),
      attributes: normalizeTextArray(memory?.attributes, (entry) => toMachineSlug(entry)),
      properties: normalizeTextArray(memory?.properties, (entry) => toMachineSlug(entry)),
      classification: normalizeTextArray(
        memory?.classification || memory?.classifications,
        (entry) => toMachineSlug(entry)
      ),
      examples: normalizeTextArray(memory?.examples, (entry) => toMachineSlug(entry)),
      exceptions: normalizeTextArray(memory?.exceptions, (entry) => toMachineSlug(entry)),
      terms: normalizeTextArray(memory?.terms, (entry) => toMachineSlug(entry)),
      aliases: normalizeTextArray(memory?.aliases, (entry) => extractEntryText(entry)),
      relationships,
      prerequisites: normalizeTextArray(memory?.prerequisites, (entry) =>
        typeof entry === "string" ? entry.trim() : String(entry?.concept || entry?.id || "").trim()
      ),
      flashcards,
      concept_map_edges: conceptMapEdges,
      mind_map_branches: mindMapBranches,
      tutor_grounding: tutorGrounding,
      search_metadata: searchMetadata,
      primary_concept: String(
        memory?.primary_concept ||
          memory?.primaryConcept ||
          inputContract?.assessment_unit?.primary_concept ||
          ""
      ).trim(),
      story: String(memory?.story || "").trim(),
      analogy: String(memory?.analogy || "").trim(),
      visual_hook: String(memory?.visual_hook || memory?.visualHook || "").trim(),
      real_world_connection: String(
        memory?.real_world_connection || memory?.realWorldConnection || ""
      ).trim(),
      memory_trick: String(memory?.memory_trick || memory?.memoryTrick || "").trim(),
      curiosity_hook: String(memory?.curiosity_hook || memory?.curiosityHook || "").trim(),
      micro_activity: String(memory?.micro_activity || memory?.microActivity || "").trim(),
      retrieval_cues: normalizeTextArray(
        memory?.retrieval_cues || memory?.retrievalCues,
        (entry) => extractEntryText(entry)
      ),
      misconception_alert: String(
        memory?.misconception_alert || memory?.misconceptionAlert || ""
      ).trim(),
      associated_concepts: normalizeTextArray(
        memory?.associated_concepts || memory?.associatedConcepts,
        (entry) => extractEntryText(entry)
      ),
      supporting_concepts: normalizeTextArray(
        memory?.supporting_concepts || memory?.supportingConcepts,
        (entry) => extractEntryText(entry)
      ),
      memory_difficulty: String(memory?.memory_difficulty || memory?.memoryDifficulty || "medium").trim(),
    },
  };
};

const normalizeLayer4StrategyContract = (
  parsed = {},
  { assessmentUnitId, inputContract } = {}
) => {
  const strategy = getStrategyObject(parsed) || {};
  const directives = inputContract?.generation_directives || {};
  const practiceProfile = directives.practice_profile || {};
  const resolvedAssessmentUnitId =
    assessmentUnitId ||
    inputContract?.assessment_unit?.assessment_unit_id ||
    strategy?.assessment_unit_id ||
    strategy?.assessmentUnitId ||
    "";

  const targetDifficulty = normalizeTargetDifficulty(directives.target_difficulty);
  const patterns = normalizeTextArray(
    strategy?.patterns ||
      strategy?.question_patterns ||
      strategy?.questionPatterns ||
      strategy?.question_family ||
      strategy?.questionFamily,
    (entry) => toMachineSlug(typeof entry === "string" ? entry : entry?.pattern || entry?.name)
  );
  const blooms = normalizeTextArray(
    strategy?.blooms || strategy?.bloom || strategy?.blooms_level || strategy?.bloomsLevel,
    (entry) => toTitleToken(typeof entry === "string" ? entry : entry?.level || entry?.name)
  );
  const skills = normalizeTextArray(
    strategy?.skills || strategy?.evidence || strategy?.competencies,
    (entry) => toMachineSlug(typeof entry === "string" ? entry : entry?.skill || entry?.name)
  );
  const contexts = normalizeTextArray(
    strategy?.contexts || strategy?.contexts_used || strategy?.contextsUsed,
    (entry) => toMachineSlug(typeof entry === "string" ? entry : entry?.context || entry?.name)
  );
  const evidence = normalizeTextArray(
    strategy?.evidence || strategy?.skills,
    (entry) => toMachineSlug(typeof entry === "string" ? entry : entry?.evidence || entry?.name)
  );
  const constraints = normalizeTextArray(
    strategy?.constraints || strategy?.generator_constraints || strategy?.generatorConstraints,
    (entry) => {
      if (typeof entry === "string") {
        return toMachineSlug(entry);
      }
      if (isPlainObject(entry)) {
        return toMachineSlug(entry?.constraint_name || entry?.name || "");
      }
      return "";
    }
  );

  const misconceptionSource =
    strategy?.misconceptions ||
    strategy?.common_misconceptions ||
    strategy?.commonMisconceptions ||
    inputContract?.misconception_profile ||
    [];
  const misconceptionValues = Array.isArray(misconceptionSource)
    ? misconceptionSource
    : misconceptionSource
      ? [misconceptionSource]
      : [];
  const misconceptions = [];
  for (const [index, entry] of misconceptionValues.entries()) {
    let code = "";
    if (typeof entry === "string") {
      const trimmed = entry.trim();
      code = /^M\d{2,}$/i.test(trimmed)
        ? trimmed.toUpperCase()
        : `M${String(index + 1).padStart(2, "0")}`;
    } else if (
      isPlainObject(entry) &&
      typeof entry?.code === "string" &&
      /^M\d{2,}$/i.test(entry.code)
    ) {
      code = entry.code.toUpperCase();
    } else {
      code = `M${String(index + 1).padStart(2, "0")}`;
    }

    if (!misconceptions.includes(code)) {
      misconceptions.push(code);
    }
  }

  const objectiveRef =
    String(strategy?.objective_ref || strategy?.objectiveRef || "").trim() ||
    `${resolvedAssessmentUnitId}-OBJ-1`;

  const normalizedStrategy = {
    assessment_unit_id: resolvedAssessmentUnitId,
    objective_ref: objectiveRef,
    blooms: blooms.length > 0 ? blooms : ["Understand"],
    skills: skills.length > 0 ? skills : ["identify"],
    contexts,
    patterns: patterns.length > 0 ? patterns : ["short_answer"],
    difficulty: normalizeDifficultyDistribution(strategy?.difficulty, targetDifficulty),
    misconceptions,
    constraints:
      constraints.length > 0
        ? constraints
        : [toMachineSlug(practiceProfile.generation_mode || "balanced_mixed")].filter(Boolean),
    evidence: evidence.length > 0 ? evidence : (skills.length > 0 ? skills : ["identify"]),
  };

  return {
    strategy: normalizedStrategy,
  };
};

const normalizeLayer7SupportContract = (
  parsed = {},
  { assessmentUnitId, inputContract } = {}
) => {
  const support = getLayer7SupportObject(parsed) || {};
  const memory = inputContract?.memory || {};
  const conceptId = memory?.concept_id || memory?.conceptId || "";
  const memorySupportRefs = {
    concept_id: String(conceptId || "").trim() || undefined,
    reuse_existing_memory: true,
    suggested_assets: normalizeTextArray(
      [
        ...(memory?.retrieval_cues || []),
        memory?.analogy ? "analogy" : "",
        memory?.memory_trick ? "memory_trick" : "",
        (memory?.flashcards || []).length > 0 ? "flashcards" : "",
      ],
      (entry) =>
        typeof entry === "string" && ["analogy", "memory_trick", "flashcards"].includes(entry)
          ? entry
          : ""
    ),
  };

  const distractorAnalysis = normalizeTextArray(
    support?.distractor_analysis || support?.distractorAnalysis,
    (entry) => {
      if (!isPlainObject(entry)) {
        return "";
      }
      const option_text = String(entry?.option_text || entry?.option || "").trim();
      const reason_selected = String(entry?.reason_selected || entry?.reasonSelected || "").trim();
      const why_incorrect = String(entry?.why_incorrect || entry?.whyIncorrect || "").trim();
      if (!option_text && !reason_selected && !why_incorrect) {
        return "";
      }
      return JSON.stringify({ option_text, reason_selected, why_incorrect });
    }
  ).map((entry) => JSON.parse(entry));

  const progressiveHints = normalizeTextArray(
    support?.progressive_hints || support?.progressiveHints,
    (entry) => extractEntryText(entry)
  );

  const misconceptionFeedback = isPlainObject(
    support?.misconception_feedback || support?.misconceptionFeedback
  )
    ? {
        misconception: String(
          support?.misconception_feedback?.misconception ||
            support?.misconceptionFeedback?.misconception ||
            ""
        ).trim(),
        reason: String(
          support?.misconception_feedback?.reason || support?.misconceptionFeedback?.reason || ""
        ).trim(),
        correction: String(
          support?.misconception_feedback?.correction ||
            support?.misconceptionFeedback?.correction ||
            ""
        ).trim(),
      }
    : null;

  const nextAction = String(
    support?.next_action || support?.nextAction || support?.mastery_recommendation || support?.masteryRecommendation || ""
  )
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

  return {
    learning_support: {
      assessment_unit_id:
        assessmentUnitId || inputContract?.assessment_unit?.assessment_unit_id || "",
      concept_explanation: String(
        support?.concept_explanation || support?.conceptExplanation || ""
      ).trim(),
      correct_answer_reasoning: String(
        support?.correct_answer_reasoning || support?.correctAnswerReasoning || ""
      ).trim(),
      real_world_insight: String(
        support?.real_world_insight || support?.realWorldInsight || ""
      ).trim(),
      distractor_analysis: distractorAnalysis,
      progressive_hints: progressiveHints,
      misconception_feedback:
        misconceptionFeedback &&
        (misconceptionFeedback.misconception ||
          misconceptionFeedback.reason ||
          misconceptionFeedback.correction)
          ? misconceptionFeedback
          : null,
      adaptive_remediation: normalizeTextArray(
        support?.adaptive_remediation || support?.adaptiveRemediation,
        (entry) => extractEntryText(entry)
      ),
      mastery_recommendation: nextAction || "review_memory",
      memory_support_refs: memorySupportRefs,
    },
  };
};

const getBlueprintObject = (parsed = {}) => {
  if (isPlainObject(parsed?.blueprint)) {
    return parsed.blueprint;
  }

  if (Array.isArray(parsed?.blueprints) && parsed.blueprints.length === 1) {
    return parsed.blueprints[0];
  }

  return null;
};

const getBlueprintValue = (blueprint, snakeKey, camelKey) =>
  blueprint?.[snakeKey] ?? blueprint?.[camelKey];

const requireNonEmptyBlueprintString = (blueprint, keys, label) => {
  const value = keys.reduce(
    (found, key) => (found !== undefined ? found : blueprint?.[key]),
    undefined
  );

  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Layer 5 validation failed: "${label}" must be a non-empty string.`);
  }

  return value.trim();
};

const requirePositiveBlueprintInteger = (blueprint, keys, label) => {
  const rawValue = keys.reduce(
    (found, key) => (found !== undefined ? found : blueprint?.[key]),
    undefined
  );
  const value = Number(rawValue);

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(
      `Layer 5 validation failed: "${label}" must be a positive integer.`
    );
  }

  return value;
};

const normalizeDifficultyValue = (value = "", fallback = "medium") => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (["easy", "low", "basic", "foundation"].includes(normalized)) {
    return "easy";
  }
  if (["medium", "moderate", "balanced", "standard"].includes(normalized)) {
    return "medium";
  }
  if (["hard", "high", "advanced", "challenging"].includes(normalized)) {
    return "hard";
  }

  return fallback;
};

const normalizeTargetDifficulty = (value = "") =>
  normalizeDifficultyValue(value, "medium");

const deriveExpectedAnswerType = ({
  interactionType = "",
  questionFamily = "",
}) => {
  const combined = `${interactionType} ${questionFamily}`.toLowerCase();

  if (
    /\b(mcq|multiple.choice|multiple-choice|single-select|single_select|single choice|single_choice|odd-one-out|odd_one_out|true.false|true-false)\b/.test(
      combined
    )
  ) {
    return "single_option";
  }

  if (/\b(multi-select|multi_select|multiple response|multiple_response)\b/.test(combined)) {
    return "multiple_option";
  }

  if (/\b(match|matching|pairing)\b/.test(combined)) {
    return "matching_pairs";
  }

  if (/\b(sequence|ordering|arrange|arrangement|hierarchy-completion)\b/.test(combined)) {
    return "ordered_response";
  }

  if (/\b(fill-?in|blank|completion|short|one-word|one_word)\b/.test(combined)) {
    return "short_text";
  }

  if (/\b(label|diagram)\b/.test(combined)) {
    return "labelled_response";
  }

  return "short_text";
};

const deriveMarks = ({ difficulty = "medium", interactionType = "", questionFamily = "" }) => {
  const normalizedDifficulty = normalizeDifficultyValue(difficulty);
  const combined = `${interactionType} ${questionFamily}`.toLowerCase();
  const baseMarks =
    normalizedDifficulty === "easy" ? 1 : normalizedDifficulty === "hard" ? 3 : 2;

  const interactionBonus = /\b(case|scenario|matching|ordering|sequence|diagram|tree)\b/.test(
    combined
  )
    ? 1
    : 0;

  return Math.max(1, Math.min(5, baseMarks + interactionBonus));
};

const deriveEstimatedTimeSeconds = ({
  difficulty = "medium",
  interactionType = "",
  questionFamily = "",
  generationMode = "",
}) => {
  const normalizedDifficulty = normalizeDifficultyValue(difficulty);
  const combined = `${interactionType} ${questionFamily}`.toLowerCase();
  let seconds =
    normalizedDifficulty === "easy" ? 45 : normalizedDifficulty === "hard" ? 105 : 75;

  if (/\b(case|scenario|matching|ordering|sequence|diagram|tree)\b/.test(combined)) {
    seconds += 20;
  }
  if (/\bfast_retrieval\b/.test(generationMode)) {
    seconds -= 15;
  }
  if (/\bexam_simulation\b/.test(generationMode)) {
    seconds += 10;
  }

  return Math.max(30, seconds);
};

const normalizeConstraintObject = (value) => {
  if (!isPlainObject(value)) {
    return {};
  }

  return Object.entries(value).reduce((accumulator, [key, entryValue]) => {
    if (
      entryValue === undefined ||
      entryValue === null ||
      entryValue === "" ||
      (Array.isArray(entryValue) && entryValue.length === 0)
    ) {
      return accumulator;
    }

    accumulator[key] = entryValue;
    return accumulator;
  }, {});
};

const normalizeLayer5BlueprintContract = (
  parsed = {},
  { assessmentUnitId, inputContract } = {}
) => {
  const blueprint = getBlueprintObject(parsed) || {};
  const directives = inputContract?.generation_directives || {};
  const practiceProfile = directives.practice_profile || {};
  const resolvedAssessmentUnitId =
    assessmentUnitId ||
    inputContract?.assessment_unit?.assessment_unit_id ||
    blueprint?.assessment_unit_id ||
    blueprint?.assessmentUnitId ||
    "";
  const questionFamily = String(
    blueprint?.question_family || blueprint?.questionFamily || ""
  ).trim();
  const interactionType = String(
    blueprint?.interaction_type || blueprint?.interactionType || ""
  ).trim();
  const targetDifficulty = normalizeTargetDifficulty(directives.target_difficulty);
  const difficulty = normalizeDifficultyValue(blueprint?.difficulty, targetDifficulty);
  const generationMode =
    directives.generation_mode || practiceProfile.generation_mode || "";
  const expectedAnswerType =
    String(
      blueprint?.expected_answer_type || blueprint?.expectedAnswerType || ""
    ).trim() ||
    deriveExpectedAnswerType({ interactionType, questionFamily });
  const marks =
    Number(blueprint?.marks) > 0
      ? Number(blueprint.marks)
      : deriveMarks({ difficulty, interactionType, questionFamily });
  const estimatedTimeSeconds =
    Number(blueprint?.estimated_time_seconds || blueprint?.estimatedTimeSeconds) > 0
      ? Number(blueprint?.estimated_time_seconds || blueprint?.estimatedTimeSeconds)
      : deriveEstimatedTimeSeconds({
          difficulty,
          interactionType,
          questionFamily,
          generationMode,
        });

  const derivedConstraints = {
    practice_type: directives.practice_type || practiceProfile.practice_type || undefined,
    generation_mode: generationMode || undefined,
    target_difficulty: difficulty,
    expected_answer_type: expectedAnswerType,
    output_language: directives.output_language || undefined,
    source_language: directives.source_language || undefined,
    time_limit_minutes: directives.time_limit_minutes || undefined,
    concise_stem: generationMode === "fast_retrieval" ? true : undefined,
  };

  const normalizedBlueprint = {
    blueprint_id:
      String(blueprint?.blueprint_id || blueprint?.blueprintId || "").trim() ||
      `${resolvedAssessmentUnitId}-BP-1`,
    assessment_unit_id: resolvedAssessmentUnitId,
    question_family: questionFamily,
    interaction_type: interactionType,
    expected_answer_type: expectedAnswerType,
    blooms_level: String(blueprint?.blooms_level || blueprint?.bloomsLevel || "").trim(),
    difficulty,
    marks,
    estimated_time_seconds: estimatedTimeSeconds,
    generator_constraints: {
      ...derivedConstraints,
      ...normalizeConstraintObject(
        blueprint?.generator_constraints || blueprint?.generatorConstraints
      ),
    },
  };

  const commonMisconception = String(
    blueprint?.common_misconception || blueprint?.commonMisconception || ""
  ).trim();
  if (commonMisconception) {
    normalizedBlueprint.common_misconception = commonMisconception;
  }

  const successCriteria = String(
    blueprint?.success_criteria || blueprint?.successCriteria || ""
  ).trim();
  if (successCriteria) {
    normalizedBlueprint.success_criteria = successCriteria;
  }

  const memorySupport = normalizeConstraintObject(
    blueprint?.memory_support || blueprint?.memorySupport
  );
  if (Object.keys(memorySupport).length > 0) {
    normalizedBlueprint.memory_support = memorySupport;
  }

  return {
    blueprint: normalizedBlueprint,
  };
};

const isTextbookStyleContextSummary = (summary = "") => {
  const normalized = normalizeConceptText(summary);
  if (!normalized) {
    return false;
  }

  const textbookPatterns = [
    /^section\s+\d/,
    /^this section\s+(explains|states|describes|introduces|discusses)\b/,
    /^the section\s+(explains|states|describes|introduces|discusses)\b/,
    /\bit states that\b/,
    /\bit explains\b/,
  ];
  const learningGoalPatterns = [
    /\bstudents?\s+(learn|understand|identify|explain|classify|relate|distinguish|infer)\b/,
    /\blearners?\s+(learn|understand|identify|explain|classify|relate|distinguish|infer)\b/,
    /\blearning goal\b/,
    /\bmastery\b/,
  ];

  return (
    textbookPatterns.some((pattern) => pattern.test(normalized)) &&
    !learningGoalPatterns.some((pattern) => pattern.test(normalized))
  );
};

const shouldUseEnglishSemanticValidation = (inputContract = {}) =>
  getLanguageDirectives(inputContract).outputLanguage === "en";

const layerModelMap = {
  1: env.openAiModelLayer1,
  2: env.openAiModelLayer2,
  3: env.openAiModelLayer3,
  4: env.openAiModelLayer4,
  5: env.openAiModelLayer5,
  6: env.openAiModelLayer6,
  7: env.openAiModelLayer7,
};

const pipelineDefinitions = [
  {
    layerNumber: 1,
    layerName: "Knowledge Extraction",
    scope: "section",
    promptVersion: LAYER1_PROMPT_VERSION,
    responseFormatName: "layer1_knowledge_contract",
    systemPrompt: ({ inputContract } = {}) => {
      const profile = getSubjectProfileFromContext(inputContract);
      return `You are a ${profile.engineLabel} knowledge extraction engine. Return only valid JSON that exactly matches the requested schema.`;
    },
    buildUserPrompt: ({ inputContract }) => {
      const assessmentUnitRange = getLayer1AssessmentUnitCountRange(inputContract);
      const profile = getSubjectProfileFromContext(inputContract);
      const conceptCategoryList = profile.conceptCategories.join(" | ");
      return `
Return a strict Layer 1 knowledge extraction JSON for this ${profile.subjectName} section using the source metadata, OCR text, and section image when present.
Practice directives:
${buildPracticeDirectivesForPrompt(inputContract, 1)}
${buildLanguageRulesForPrompt(inputContract)}

Hard rules:
- Layer 1 is ONLY for source-grounded knowledge extraction.
- Do not output question types such as "definitions", "ordered recall", "conceptual understanding" as assessment units.
- Every assessment unit must be the smallest independently assessable learning objective.
- Create ${assessmentUnitRange.min}-${assessmentUnitRange.max} assessment units for this source section unless the source is clearly too sparse.
- Practice type coverage means complete coverage of independently assessable learning objectives, not one assessment unit per term, example, list member, or fact.
- Dependencies must form a prerequisite graph, not a textbook-order chain. Use multiple dependencies when one objective requires two prior ideas.
- Do not make every assessment unit depend only on the immediately previous assessment unit unless the source is truly a step-by-step process.
- Concrete example: if unit C's objective is only fully understood by combining unit A's idea with unit B's idea (for example, C interprets an ordered list using a relationship/terminology idea introduced earlier), then C's dependencies must list BOTH A and B, not just the unit immediately before it. Before finalizing "dependencies", check every assessment unit that combines or applies two earlier ideas and give it two (or more) dependencies instead of extending a single A-to-B-to-C chain.
- Mandatory self-check for sections with 6 or more assessment units: count how many assessment units have 2 or more entries in "dependencies". That count must be at least 2, not 0 or 1. If it is fewer than 2, re-examine the assessment units and find at least one more unit whose objective genuinely combines two earlier ideas (for example, a unit that orders/ranks a list together with a unit that defines what the items being ordered mean), and list both of those earlier units as its dependencies. Only add a dependency where the prerequisite relationship is genuinely real; never invent a dependency purely to pass this check.

Subject-specific dimension guidance (${profile.subjectName}):
${profile.dimensionGuidance}

Subject-specific rules (${profile.subjectName}):
${profile.hardRules}

General dimension rules:
- "relationships" is for conceptual mappings between terms or ideas, prerequisite conceptual links, and source-grounded idea relationships.
- "comparisons" is only for contrast/compare cases where two or more entities differ or share features. Do not use comparisons for pure conceptual mappings; put those in relationships.
- "memory_hooks" in Layer 1 means source-grounded memory support candidates only: identify concepts that need memory support and why. Good format: "concept needs memory support because source-grounded reason". Do not create mnemonics, analogies, stories, or plain reminders; Layer 2 creates actual memory aids.
- "context_summary" must be a compact learning-goal summary for downstream AI. Prefer learner-centered framing in the target language, equivalent to "Students learn/understand/can...". Do not write a textbook recap like "Section 1.2 explains..." or "The section states...".
- Every assessment unit MUST include:
  - "assessment_unit_id"
  - "primary_concept" as a stable domain concept label or noun phrase of 12 words or fewer
  - "learning_objective" as a student-action objective using verbs such as interpret, apply, justify, compare, or classify
  - "supporting_concepts"
  - "concept_category"
  - "curriculum_importance"
- "primary_concept" must not start with Bloom/action verbs such as interpret, apply, justify, compare, recognise, explain, evaluate, identify, or distinguish. Put those verbs in "learning_objective".
${profile.primaryConceptExamples}
- "core_concepts" must be noun phrases or concept labels, not explanatory sentences.
- "memory_hooks" must be source-grounded memory support candidates, not final mnemonics or reminders.
- "question_patterns" must be abstract assessment pattern labels only, never full question stems.
${profile.questionPatternExamples}
- If the source does not support a field, return an empty array.

Context:
${stringifyPromptInputContract(inputContract, 1)}

Schema:
{
  "context_summary": "",
  "core_concepts": [],
  "structures": [],
  "functions": [],
  "processes": [],
  "stages_sequences": [],
  "cause_effect": [],
  "relationships": [
    {
      "relationship_name": "",
      "related_concepts": [],
      "relationship_type": "conceptual-mapping | prerequisite | equivalence | usage | part-whole | classification-basis",
      "relationship_summary": ""
    }
  ],
  "comparisons": [],
  "classifications": [],
  "diagrams": [],
  "terminology": [],
  "exceptions": [],
  "common_misconceptions": [],
  "memory_hooks": [],
  "question_patterns": [],
  "assessment_units": [
    {
      "assessment_unit_id": "${profile.auPrefix}-AU-001",
      "primary_concept": "",
      "learning_objective": "",
      "supporting_concepts": [],
      "concept_category": "${conceptCategoryList}",
      "curriculum_importance": "high | medium | low",
      "dependencies": []
    }
  ]
}
`.trim();
    },
    buildUserContent: ({ inputContract, userPrompt, media }) => {
      const content = [{ type: "text", text: userPrompt }];
      const imageDataUrl =
        media?.sectionImageDataUrl || inputContract?.source_artifacts?.section_image?.data_url;
      if (imageDataUrl) {
        content.push({
          type: "image_url",
          image_url: { url: imageDataUrl },
        });
      }
      return content;
    },
    normalizeContract: (parsed, { inputContract, sourceRefs } = {}) => {
      const profile = getSubjectProfileFromContext(inputContract);
      return normalizeLayer1AssessmentUnitIds({
        parsed,
        profile,
        sourceSectionId: sourceRefs?.sourceSectionId,
      });
    },
    validateContract: (parsed, { inputContract } = {}) => {
      const profile = getSubjectProfileFromContext(inputContract);
      const auIdPattern = new RegExp(`^${profile.auPrefix}-AU-(?:\\d+-)?\\d{3,}$`);
      const allowedCategories = profile.conceptCategories;
      const requiredArrayKeys = [
        "core_concepts",
        "structures",
        "functions",
        "processes",
        "stages_sequences",
        "cause_effect",
        "relationships",
        "comparisons",
        "classifications",
        "diagrams",
        "terminology",
        "exceptions",
        "common_misconceptions",
        "memory_hooks",
        "question_patterns",
        "assessment_units",
      ];

      for (const key of requiredArrayKeys) {
        if (!Array.isArray(parsed?.[key])) {
          throw new Error(`Layer 1 validation failed: "${key}" must be an array.`);
        }
      }

      if (typeof parsed?.context_summary !== "string" || !parsed.context_summary.trim()) {
        throw new Error('Layer 1 validation failed: "context_summary" must be a non-empty string.');
      }

      if (
        shouldUseEnglishSemanticValidation(inputContract) &&
        isTextbookStyleContextSummary(parsed.context_summary)
      ) {
        throw new Error(
          'Layer 1 validation failed: "context_summary" must be a learner-centered conceptual summary, not a textbook-style section recap. Rewrite it using "Students learn/understand/can..." framing.'
        );
      }

      if (parsed.assessment_units.length === 0) {
        throw new Error('Layer 1 validation failed: "assessment_units" must not be empty.');
      }

      const assessmentUnitRange = getLayer1AssessmentUnitCountRange(inputContract);
      if (parsed.assessment_units.length > assessmentUnitRange.max) {
        throw new Error(
          `Layer 1 validation failed: produced ${parsed.assessment_units.length} assessment units, but this source section allows at most ${assessmentUnitRange.max}. Merge terms, list members, examples, and evidence into broader independently assessable learning objectives.`
        );
      }

      if (parsed.assessment_units.length < assessmentUnitRange.min) {
        throw new Error(
          `Layer 1 validation failed: produced ${parsed.assessment_units.length} assessment units, but this source section needs about ${assessmentUnitRange.min}-${assessmentUnitRange.max} independently assessable learning objectives. Split only true mastery objectives, not terms, examples, or list members.`
        );
      }

      const invalidCoreConcept = parsed.core_concepts.find(
        (item) =>
          typeof item !== "string" ||
          !item.trim() ||
          /[.?!]/.test(item.trim()) ||
          item.trim().split(/\s+/).length > 8
      );
      if (invalidCoreConcept) {
        throw new Error(
          'Layer 1 validation failed: "core_concepts" must contain short concept labels or noun phrases only.'
        );
      }

      const invalidQuestionPattern = findInvalidQuestionPattern(parsed.question_patterns);
      if (invalidQuestionPattern) {
        const invalidPatternValue = getQuestionPatternValue(invalidQuestionPattern);
        throw new Error(
          `Layer 1 validation failed: question_patterns contains "${invalidPatternValue || "empty value"}", which is a full question stem or invalid label. Use abstract short pattern labels only, for example "hierarchy-completion", "taxonomy-tree-interpretation", "odd-one-out", or "classification-justification".`
        );
      }

      const missingTaxonomyPattern = profile.validators.taxonomyPatterns
        ? findMissingTaxonomyQuestionPattern(parsed)
        : null;
      if (missingTaxonomyPattern) {
        throw new Error(
          `Layer 1 validation failed: taxonomy hierarchy content must include the "${missingTaxonomyPattern.label}" question pattern family. Add it to question_patterns when the source supports taxonomy/classification hierarchy.`
        );
      }

      const conceptualStructure = profile.validators.structureMisclassification
        ? findConceptualStructureMisclassification(parsed.structures)
        : null;
      if (conceptualStructure) {
        const structureName =
          typeof conceptualStructure === "string"
            ? conceptualStructure
            : conceptualStructure.name || conceptualStructure.structure || "conceptual structure";
        throw new Error(
          `Layer 1 validation failed: "${structureName}" is a conceptual hierarchy or classification system, not a physical biological structure. Move it from structures into stages_sequences, classifications, terminology, or assessment_units.`
        );
      }

      const principleFunction = profile.validators.functionMisclassification
        ? findPrincipleFunctionMisclassification(parsed.functions)
        : null;
      if (principleFunction) {
        const functionName =
          typeof principleFunction === "string"
            ? principleFunction
            : principleFunction.entity ||
              principleFunction.structure ||
              principleFunction.name ||
              principleFunction.concept ||
              "function entry";
        throw new Error(
          `Layer 1 validation failed: "${functionName}" is an educational principle or classification basis, not a biological function. Move it from functions into processes, cause_effect, relationships, comparisons, or assessment_units as a principle.`
        );
      }

      const invalidRelationship = parsed.relationships.find((relationship) => {
        const relatedConcepts =
          relationship?.related_concepts || relationship?.relatedConcepts || [];
        return (
          !relationship ||
          typeof relationship !== "object" ||
          Array.isArray(relationship) ||
          typeof (relationship.relationship_name || relationship.name || "") !== "string" ||
          !(relationship.relationship_name || relationship.name || "").trim() ||
          typeof (relationship.relationship_type || relationship.relationshipType || "") !==
            "string" ||
          !(relationship.relationship_type || relationship.relationshipType || "").trim() ||
          !Array.isArray(relatedConcepts) ||
          relatedConcepts.filter((concept) => typeof concept === "string" && concept.trim())
            .length < 2 ||
          typeof (relationship.relationship_summary || relationship.summary || "") !==
            "string" ||
          !(relationship.relationship_summary || relationship.summary || "").trim()
        );
      });
      if (invalidRelationship) {
        throw new Error(
          'Layer 1 validation failed: each "relationships" entry must include relationship_name, at least two related_concepts, relationship_type, and relationship_summary.'
        );
      }

      const relationshipAsComparison = profile.validators.relationshipAsComparison
        ? findConceptualRelationshipAsComparison(parsed.comparisons)
        : null;
      if (relationshipAsComparison) {
        const terms = getComparisonTerms(relationshipAsComparison).join(", ");
        throw new Error(
          `Layer 1 validation failed: "${terms}" is a conceptual relationship, not a comparison. Move category/rank/taxon-style mappings from comparisons into relationships.`
        );
      }

      const reminderMemoryHook = profile.validators.reminderMemoryHook
        ? findReminderMemoryHook(parsed.memory_hooks)
        : null;
      if (reminderMemoryHook) {
        const hookText =
          typeof reminderMemoryHook === "string"
            ? reminderMemoryHook
            : reminderMemoryHook.hook ||
              reminderMemoryHook.memory_hook ||
              reminderMemoryHook.linked_concept ||
              reminderMemoryHook.concept ||
              "memory hook";
        throw new Error(
          `Layer 1 validation failed: "${hookText}" is a reminder or source fact, not a memory support candidate. Replace memory_hooks with source-grounded flags describing which concepts need memory support and why; Layer 2 will generate the actual memory aid.`
        );
      }

      const terminologyOverfragmentation = profile.validators.terminologyFragmentation
        ? findTerminologyOverfragmentation(parsed.assessment_units)
        : null;
      if (terminologyOverfragmentation) {
        throw new Error(
          `Layer 1 validation failed: terminology over-fragmentation detected for ${terminologyOverfragmentation.cluster.name}. Merge ${terminologyOverfragmentation.matchedConcepts.join(
            ", "
          )} into one assessment unit such as "${terminologyOverfragmentation.cluster.preferredConcept}".`
        );
      }

      const hierarchyMemberFragmentation = profile.validators.hierarchyFragmentation
        ? findHierarchyMemberFragmentation(parsed.assessment_units)
        : null;
      if (hierarchyMemberFragmentation) {
        throw new Error(
          `Layer 1 validation failed: hierarchy members were promoted into separate assessment units for ${hierarchyMemberFragmentation.cluster.name}. Merge ${hierarchyMemberFragmentation.matchedConcepts.join(
            ", "
          )} into one assessment unit such as "${hierarchyMemberFragmentation.cluster.preferredConcept}", and keep the rank list in stages_sequences or supporting_concepts.`
        );
      }

      const dependencyGraph = analyzeLayer1DependencyGraph(parsed.assessment_units);
      if (!dependencyGraph.isValid) {
        throw new Error(
          `Layer 1 validation failed: ${dependencyGraph.reason}. Rebuild dependencies as a prerequisite graph, not a simple sequence.`
        );
      }

      const exampleLabels = collectLayer1ExampleLabels(parsed);

      parsed.assessment_units.forEach((unit, index) => {
        const path = `assessment_units[${index}]`;
        if (!unit || typeof unit !== "object" || Array.isArray(unit)) {
          throw new Error(`Layer 1 validation failed: "${path}" must be an object.`);
        }

        const assessmentUnitId = unit.assessment_unit_id || unit.assessmentUnitId;
        const primaryConcept = unit.primary_concept || unit.primaryConcept;
        const learningObjective = unit.learning_objective || unit.learningObjective;
        const supportingConcepts = unit.supporting_concepts || unit.supportingConcepts;
        const conceptCategory = unit.concept_category || unit.conceptCategory;
        const curriculumImportance =
          unit.curriculum_importance || unit.curriculumImportance;

        if (
          typeof assessmentUnitId !== "string" ||
          !auIdPattern.test(assessmentUnitId.trim())
        ) {
          throw new Error(
            `Layer 1 validation failed: "${path}.assessment_unit_id" must match ${profile.auPrefix}-AU-### format.`
          );
        }

        if (
          typeof primaryConcept !== "string" ||
          !primaryConcept.trim() ||
          primaryConcept.trim().split(/\s+/).length > 12
        ) {
          throw new Error(
            `Layer 1 validation failed: "${path}.primary_concept" must be a stable domain concept label or noun phrase of 12 words or fewer. Put learner actions in learning_objective.`
          );
        }

        if (
          shouldUseEnglishSemanticValidation(inputContract) &&
          isLearningObjectiveLikePrimaryConcept(primaryConcept)
        ) {
          throw new Error(
            `Layer 1 validation failed: "${path}.primary_concept" starts with an assessment verb. Keep primary_concept domain-centric, for example "Standard taxonomic hierarchy", and move the action verb to learning_objective.`
          );
        }

        const invalidLearningObjective =
          typeof learningObjective !== "string" ||
          !learningObjective.trim() ||
          (shouldUseEnglishSemanticValidation(inputContract) &&
            !learningObjectiveVerbPattern.test(learningObjective.trim()));

        if (invalidLearningObjective) {
          throw new Error(
            `Layer 1 validation failed: "${path}.learning_objective" must be a student-action objective starting with a learning verb such as interpret, apply, justify, compare, classify, or explain.`
          );
        }

        if (!Array.isArray(supportingConcepts)) {
          throw new Error(
            `Layer 1 validation failed: "${path}.supporting_concepts" must be an array.`
          );
        }

        if (
          supportingConcepts.some(
            (item) =>
              typeof item !== "string" || !item.trim() || item.trim().split(/\s+/).length > 10
          )
        ) {
          throw new Error(
            `Layer 1 validation failed: "${path}.supporting_concepts" must contain non-empty concept labels.`
          );
        }

        if (
          isExampleLikeAssessmentUnit({
            primaryConcept,
            supportingConcepts,
            exampleLabels,
          })
        ) {
          throw new Error(
            `Layer 1 validation failed: "${path}.primary_concept" appears to be an example promoted into an assessment unit. Merge it into the broader independently assessable learning objective and keep the example as supporting evidence.`
          );
        }

        if (
          isObservableFactAssessmentUnit({
            primaryConcept,
            supportingConcepts,
          })
        ) {
          throw new Error(
            `Layer 1 validation failed: "${path}.primary_concept" appears to be an observable fact or isolated evidence promoted into an assessment unit. Merge it into the broader independently assessable objective and keep the fact as supporting evidence.`
          );
        }

        if (!allowedCategories.includes(conceptCategory)) {
          throw new Error(
            `Layer 1 validation failed: "${path}.concept_category" must be one of ${allowedCategories.join(
              ", "
            )}.`
          );
        }

        if (!allowedCurriculumImportance.includes(curriculumImportance)) {
          throw new Error(
            `Layer 1 validation failed: "${path}.curriculum_importance" must be one of ${allowedCurriculumImportance.join(
              ", "
            )}.`
          );
        }
      });
    },
    persistContract: persistLayer1Knowledge,
  },
  {
    layerNumber: 2,
    layerName: "Concept Memory",
    scope: "assessmentUnit",
    promptVersion: LAYER2_PROMPT_VERSION,
    responseFormatName: "layer2_concept_memory_contract",
    systemPrompt: ({ inputContract } = {}) =>
      `You are a ${getSubjectLabelFromContext(inputContract)} cognitive memory encoding engine. Return only valid JSON that exactly matches the requested schema.`,
    buildUserPrompt: ({ inputContract }) => `
Generate Layer 2 canonical concept-memory JSON for exactly one assessment unit.
Practice directives:
${buildPracticeDirectivesForPrompt(inputContract, 2)}
${buildLanguageRulesForPrompt(inputContract)}

Layer 2 purpose:
- Store what the AI should permanently know about this concept.
- Preserve canonical concept knowledge first, then add memory assets that help recall.
- Do not generate teaching strategy, assessment strategy, question prompts, blueprint guidance, competency prompts, evidence of mastery, or cross-layer alignment.
- Do not mention Layer 3, Layer 4, Layer 5, Layer 6, or Layer 7.
- Reuse assessment_unit_id exactly from the input.
- Include canonical concept fields such as concept_id, concept_label, definition, relationships, examples, terms, and prerequisites when supported by the source.
- Include graph-ready fields that can later support concept maps, mind maps, tutoring, flashcards, semantic search, and prerequisite analysis.
- Use input memory_hooks as source-grounded memory support candidates; refine them into story, analogy, visual hook, memory trick, retrieval cues, and flashcard-ready recall support.
- Keep output compact, machine-readable, and reusable beyond assessment generation.

Input:
${stringifyPromptInputContract(inputContract, 2)}

Schema:
{
  "concept_memory": {
    "assessment_unit_id": "",
    "concept_id": "",
    "concept_label": "",
    "definition": "",
    "formula": "",
    "attributes": [],
    "properties": [],
    "classification": [],
    "examples": [],
    "exceptions": [],
    "terms": [],
    "aliases": [],
    "relationships": [],
    "prerequisites": [],
    "flashcards": [],
    "concept_map_edges": [],
    "mind_map_branches": [],
    "tutor_grounding": {},
    "search_metadata": {},
    "story": "",
    "analogy": "",
    "visual_hook": "",
    "real_world_connection": "",
    "memory_trick": "",
    "curiosity_hook": "",
    "micro_activity": "",
    "retrieval_cues": [],
    "misconception_alert": "",
    "associated_concepts": [],
    "supporting_concepts": [],
    "memory_difficulty": "low | medium | high"
  }
}
`.trim(),
    validateContract: (parsed, { assessmentUnitId, inputContract } = {}) => {
      const memory = getLayer2MemoryObject(parsed);
      if (!memory) {
        throw new Error(
          'Layer 2 validation failed: response must contain exactly one top-level "concept_memory" object.'
        );
      }

      if (Array.isArray(parsed?.concept_memories)) {
        throw new Error(
          'Layer 2 validation failed: "concept_memories" array is no longer allowed. Use a single "concept_memory" object.'
        );
      }

      const forbiddenKey = findForbiddenLayer2Key(parsed);
      if (forbiddenKey) {
        throw new Error(
          `Layer 2 validation failed: "${forbiddenKey}" belongs to downstream teaching, assessment, blueprint, or alignment layers. Keep Layer 2 canonical and memory-focused only.`
        );
      }

      const normalized = normalizeLayer2ConceptMemoryContract(parsed, {
        assessmentUnitId,
        inputContract,
      });
      const normalizedMemory = normalized.concept_memory;

      const invalidMemoryKey = Object.keys(normalizedMemory).find(
        (key) => !layer2AllowedMemoryKeys.has(key)
      );
      if (invalidMemoryKey) {
        throw new Error(
          `Layer 2 validation failed: "${invalidMemoryKey}" is not a memory asset field. Remove it from Layer 2.`
        );
      }

      const memoryAssessmentUnitId =
        normalizedMemory.assessment_unit_id || normalizedMemory.assessmentUnitId;
      if (assessmentUnitId && memoryAssessmentUnitId !== assessmentUnitId) {
        throw new Error(
          `Layer 2 validation failed: assessment_unit_id must be "${assessmentUnitId}".`
        );
      }

      const expectedPrimaryConcept = inputContract?.assessment_unit?.primary_concept;
      const primaryConcept = normalizedMemory.primary_concept || normalizedMemory.primaryConcept;
      if (
        expectedPrimaryConcept &&
        String(primaryConcept || "").trim() !== String(expectedPrimaryConcept).trim()
      ) {
        throw new Error(
          "Layer 2 validation failed: primary_concept must be reused exactly from Layer 1."
        );
      }

      if (
        typeof normalizedMemory.concept_id !== "string" ||
        !normalizedMemory.concept_id.trim()
      ) {
        throw new Error(
          'Layer 2 validation failed: "concept_id" must be a non-empty concept slug.'
        );
      }

      if (
        typeof normalizedMemory.concept_label !== "string" ||
        !normalizedMemory.concept_label.trim()
      ) {
        throw new Error(
          'Layer 2 validation failed: "concept_label" must be a non-empty concept label.'
        );
      }

      if (
        typeof normalizedMemory.definition !== "string" ||
        !normalizedMemory.definition.trim()
      ) {
        throw new Error(
          'Layer 2 validation failed: "definition" must be a non-empty canonical definition.'
        );
      }

      const requiredTextFields = [
        "memory_difficulty",
      ];
      const missingTextField = requiredTextFields.find((key) => {
        const value =
          normalizedMemory[key] ||
          normalizedMemory[key.replace(/_([a-z])/g, (_, char) => char.toUpperCase())];
        return typeof value !== "string" || !value.trim();
      });
      if (missingTextField) {
        throw new Error(
          `Layer 2 validation failed: "${missingTextField}" must be a non-empty memory asset.`
        );
      }

      const retrievalCues = normalizedMemory.retrieval_cues || normalizedMemory.retrievalCues;
      if (!Array.isArray(retrievalCues) || retrievalCues.length < 2) {
        throw new Error(
          "Layer 2 validation failed: retrieval_cues must contain at least two compact retrieval cues."
        );
      }

      const associatedConcepts =
        normalizedMemory.associated_concepts || normalizedMemory.associatedConcepts;
      if (!Array.isArray(associatedConcepts)) {
        throw new Error(
          "Layer 2 validation failed: associated_concepts must be an array."
        );
      }

      const supportingConcepts =
        normalizedMemory.supporting_concepts || normalizedMemory.supportingConcepts;
      if (!Array.isArray(supportingConcepts)) {
        throw new Error(
          "Layer 2 validation failed: supporting_concepts must be an array."
        );
      }

      const canonicalArrays = [
        "attributes",
        "properties",
        "classification",
        "examples",
        "exceptions",
        "terms",
        "aliases",
        "prerequisites",
      ];
      for (const key of canonicalArrays) {
        if (
          !Array.isArray(normalizedMemory[key]) ||
          normalizedMemory[key].some((entry) => typeof entry !== "string")
        ) {
          throw new Error(
            `Layer 2 validation failed: "${key}" must be an array of strings.`
          );
        }
      }

      if (!Array.isArray(normalizedMemory.relationships)) {
        throw new Error('Layer 2 validation failed: "relationships" must be an array.');
      }

      if (!Array.isArray(normalizedMemory.flashcards)) {
        throw new Error('Layer 2 validation failed: "flashcards" must be an array.');
      }

      if (!Array.isArray(normalizedMemory.concept_map_edges)) {
        throw new Error('Layer 2 validation failed: "concept_map_edges" must be an array.');
      }

      if (!Array.isArray(normalizedMemory.mind_map_branches)) {
        throw new Error('Layer 2 validation failed: "mind_map_branches" must be an array.');
      }

      if (!isPlainObject(normalizedMemory.tutor_grounding)) {
        throw new Error('Layer 2 validation failed: "tutor_grounding" must be an object.');
      }

      if (!isPlainObject(normalizedMemory.search_metadata)) {
        throw new Error('Layer 2 validation failed: "search_metadata" must be an object.');
      }
    },
    normalizeContract: normalizeLayer2ConceptMemoryContract,
    persistContract: persistLayer2ConceptMemory,
  },
  {
    layerNumber: 3,
    layerName: "Assessment Capability",
    scope: "assessmentUnit",
    promptVersion: DEFAULT_PROMPT_VERSION,
    responseFormatName: "layer3_assessment_capability_contract",
    systemPrompt: ({ inputContract } = {}) =>
      `You are a ${getSubjectLabelFromContext(inputContract)} assessment capability engine. Return only valid JSON that exactly matches the requested schema.`,
    buildUserPrompt: ({ inputContract }) => `
Create Layer 3 capability JSON for exactly one assessment unit.
Practice directives:
${buildPracticeDirectivesForPrompt(inputContract, 3)}
${buildLanguageRulesForPrompt(inputContract)}

Input:
${stringifyPromptInputContract(inputContract, 3)}

Rules:
- Return exactly one compact machine-facing capability object under the top-level key "capability".
- Do not return a "capabilities" array.
- Do not write pedagogy, teacher guidance, curriculum notes, importance notes, rationale, summaries, or question-design prose.
- Reuse assessment_unit_id exactly from the input.
- Keep all arrays compact and machine-readable.
- "objectives" must contain compact objective references, not prose sentences.
- "competencies", "skills", "mastery", and "dependencies" must use compact slugs or ids.
- "bloom" must be an array of compact Bloom level labels.
- "misconceptions" should use compact codes such as M01, M02 when possible.

Schema:
{
  "capability": {
    "assessment_unit_id": "",
    "concept": "",
    "objectives": [],
    "competencies": [],
    "skills": [],
    "bloom": [],
    "mastery": [],
    "misconceptions": [],
    "dependencies": []
  }
}
`.trim(),
    validateContract: (parsed, { assessmentUnitId, inputContract } = {}) => {
      const capability = getCapabilityObject(parsed);
      if (!capability) {
        throw new Error(
          'Layer 3 validation failed: response must contain exactly one top-level "capability" object.'
        );
      }

      if (Array.isArray(parsed?.capabilities)) {
        throw new Error(
          'Layer 3 validation failed: "capabilities" array is no longer allowed. Use a single "capability" object.'
        );
      }

      const forbiddenKey = Object.keys(capability).find((key) =>
        layer3ForbiddenCapabilityKeys.has(key)
      );
      if (forbiddenKey) {
        throw new Error(
          `Layer 3 validation failed: "${forbiddenKey}" belongs to narrative, pedagogy, or report-style output. Keep Layer 3 capability-only.`
        );
      }

      const normalized = normalizeLayer3CapabilityContract(parsed, {
        assessmentUnitId,
        inputContract,
      });
      const normalizedCapability = normalized.capability;

      if (
        typeof normalizedCapability.assessment_unit_id !== "string" ||
        !normalizedCapability.assessment_unit_id.trim()
      ) {
        throw new Error(
          'Layer 3 validation failed: "assessment_unit_id" must be a non-empty string.'
        );
      }

      const expectedAssessmentUnitId =
        assessmentUnitId || inputContract?.assessment_unit?.assessment_unit_id;
      if (
        expectedAssessmentUnitId &&
        normalizedCapability.assessment_unit_id !== expectedAssessmentUnitId
      ) {
        throw new Error(
          `Layer 3 validation failed: assessment_unit_id must be "${expectedAssessmentUnitId}".`
        );
      }

      if (
        typeof normalizedCapability.concept !== "string" ||
        !normalizedCapability.concept.trim()
      ) {
        throw new Error(
          'Layer 3 validation failed: "concept" must be a non-empty compact concept slug.'
        );
      }

      const requiredArrays = [
        "objectives",
        "competencies",
        "skills",
        "bloom",
        "mastery",
        "dependencies",
      ];
      for (const key of requiredArrays) {
        if (
          !Array.isArray(normalizedCapability[key]) ||
          normalizedCapability[key].some(
            (entry) => typeof entry !== "string" || !entry.trim()
          )
        ) {
          throw new Error(
            `Layer 3 validation failed: "${key}" must be an array of non-empty strings.`
          );
        }
      }

      if (
        normalizedCapability.misconceptions !== undefined &&
        (!Array.isArray(normalizedCapability.misconceptions) ||
          normalizedCapability.misconceptions.some(
            (entry) => typeof entry !== "string" || !entry.trim()
          ))
      ) {
        throw new Error(
          'Layer 3 validation failed: "misconceptions" must be an array of non-empty strings.'
        );
      }
    },
    normalizeContract: normalizeLayer3CapabilityContract,
    persistContract: persistLayer3Capability,
  },
  {
    layerNumber: 4,
    layerName: "Assessment Strategy",
    scope: "assessmentUnit",
    promptVersion: DEFAULT_PROMPT_VERSION,
    responseFormatName: "layer4_assessment_strategy_contract",
    systemPrompt: ({ inputContract } = {}) =>
      `You are a ${getSubjectLabelFromContext(inputContract)} assessment strategy engine. Return only valid JSON that exactly matches the requested schema.`,
    buildUserPrompt: ({ inputContract }) => `
Create Layer 4 strategy JSON for exactly one assessment unit.
Practice directives:
${buildPracticeDirectivesForPrompt(inputContract, 4)}
${buildLanguageRulesForPrompt(inputContract)}

Input:
${stringifyPromptInputContract(inputContract, 4)}

Rules:
- Return exactly one compact machine-facing strategy object under the top-level key "strategy".
- Do not return a "strategies" array.
- Do not write explanations, rationale, summaries, pedagogy notes, curriculum notes, teaching implications, or other report prose.
- Reuse assessment_unit_id exactly from the input.
- Prefer compact enums, slugs, and arrays over sentences.
- "blooms", "skills", "patterns", "constraints", and "evidence" must be compact arrays.
- "difficulty" must be a compact distribution object using E, M, and H integer percentages.
- "misconceptions" must be compact codes such as M01, M02 when possible.
- "objective_ref" must be a compact machine reference, not a paragraph.

Schema:
{
  "strategy": {
    "assessment_unit_id": "",
    "objective_ref": "",
    "blooms": [],
    "skills": [],
    "contexts": [],
    "patterns": [],
    "difficulty": {
      "E": 0,
      "M": 0,
      "H": 0
    },
    "misconceptions": [],
    "constraints": [],
    "evidence": []
  }
}
`.trim(),
    validateContract: (parsed, { assessmentUnitId, inputContract } = {}) => {
      const strategy = getStrategyObject(parsed);
      if (!strategy) {
        throw new Error(
          'Layer 4 validation failed: response must contain exactly one top-level "strategy" object.'
        );
      }

      if (Array.isArray(parsed?.strategies)) {
        throw new Error(
          'Layer 4 validation failed: "strategies" array is no longer allowed. Use a single "strategy" object.'
        );
      }

      const forbiddenKey = Object.keys(strategy).find((key) =>
        layer4ForbiddenStrategyKeys.has(key)
      );
      if (forbiddenKey) {
        throw new Error(
          `Layer 4 validation failed: "${forbiddenKey}" is report-style prose. Keep Layer 4 machine-readable only.`
        );
      }

      const normalized = normalizeLayer4StrategyContract(parsed, {
        assessmentUnitId,
        inputContract,
      });
      const normalizedStrategy = normalized.strategy;

      if (
        typeof normalizedStrategy.assessment_unit_id !== "string" ||
        !normalizedStrategy.assessment_unit_id.trim()
      ) {
        throw new Error(
          'Layer 4 validation failed: "assessment_unit_id" must be a non-empty string.'
        );
      }

      const expectedAssessmentUnitId =
        assessmentUnitId || inputContract?.assessment_unit?.assessment_unit_id;
      if (
        expectedAssessmentUnitId &&
        normalizedStrategy.assessment_unit_id !== expectedAssessmentUnitId
      ) {
        throw new Error(
          `Layer 4 validation failed: assessment_unit_id must be "${expectedAssessmentUnitId}".`
        );
      }

      if (
        typeof normalizedStrategy.objective_ref !== "string" ||
        !normalizedStrategy.objective_ref.trim()
      ) {
        throw new Error(
          'Layer 4 validation failed: "objective_ref" must be a non-empty machine reference.'
        );
      }

      const requiredArrays = [
        "blooms",
        "skills",
        "patterns",
        "constraints",
        "evidence",
      ];
      for (const key of requiredArrays) {
        if (
          !Array.isArray(normalizedStrategy[key]) ||
          normalizedStrategy[key].some(
            (entry) => typeof entry !== "string" || !entry.trim()
          )
        ) {
          throw new Error(
            `Layer 4 validation failed: "${key}" must be an array of non-empty strings.`
          );
        }
      }

      if (
        normalizedStrategy.contexts !== undefined &&
        (!Array.isArray(normalizedStrategy.contexts) ||
          normalizedStrategy.contexts.some(
            (entry) => typeof entry !== "string" || !entry.trim()
          ))
      ) {
        throw new Error(
          'Layer 4 validation failed: "contexts" must be an array of non-empty strings.'
        );
      }

      if (
        normalizedStrategy.misconceptions !== undefined &&
        (!Array.isArray(normalizedStrategy.misconceptions) ||
          normalizedStrategy.misconceptions.some(
            (entry) => typeof entry !== "string" || !entry.trim()
          ))
      ) {
        throw new Error(
          'Layer 4 validation failed: "misconceptions" must be an array of non-empty strings.'
        );
      }

      if (!isPlainObject(normalizedStrategy.difficulty)) {
        throw new Error(
          'Layer 4 validation failed: "difficulty" must be an object with E, M, and H integer percentages.'
        );
      }

      for (const key of ["E", "M", "H"]) {
        if (!Number.isInteger(normalizedStrategy.difficulty[key])) {
          throw new Error(
            `Layer 4 validation failed: "difficulty.${key}" must be an integer percentage.`
          );
        }
      }
    },
    normalizeContract: normalizeLayer4StrategyContract,
    persistContract: persistLayer4Strategy,
  },
  {
    layerNumber: 5,
    layerName: "Blueprint Generation",
    scope: "assessmentUnit",
    promptVersion: DEFAULT_PROMPT_VERSION,
    responseFormatName: "layer5_item_blueprint_contract",
    systemPrompt: ({ inputContract } = {}) =>
      `You are a ${getSubjectLabelFromContext(inputContract)} assessment blueprint engine. Return only valid JSON that exactly matches the requested schema.`,
    buildUserPrompt: ({ inputContract }) => `
Create Layer 5 blueprint JSON for exactly one assessment unit.
Practice directives:
${buildPracticeDirectivesForPrompt(inputContract, 5)}
${buildLanguageRulesForPrompt(inputContract)}

Input:
${stringifyPromptInputContract(inputContract, 5)}

Rules:
- Return exactly one compact machine-facing blueprint object under the top-level key "blueprint".
- Do not return a "blueprints" array.
- Do not write explanations, rationale, teaching notes, assessment notes, or cross-layer commentary.
- Reuse assessment_unit_id exactly from the input.
- Choose only the item-spec fields needed for downstream item generation.
- Do not copy primary_concept, assessment_dimension, or learning_objective into the blueprint. Those already exist upstream.
- The pipeline derives blueprint_id, expected_answer_type, default marks, default estimated_time_seconds, and base generator constraints. You may omit them when the choice is obvious from question_family, interaction_type, difficulty, and run directives.
- Do not include partial_credit, distractor_strategy, adaptive_json, adaptive, or assessment_notes.
- "generator_constraints" must be a JSON object with compact machine-facing constraints only.
- Optional keys may be omitted when not useful: "common_misconception", "success_criteria", and "memory_support".
- "memory_support", if present, must be a JSON object with concise machine-facing cues only.

Schema:
{
  "blueprint": {
    "blueprint_id": "",
    "assessment_unit_id": "",
    "question_family": "",
    "interaction_type": "",
    "expected_answer_type": "",
    "blooms_level": "",
    "difficulty": "",
    "marks": 0,
    "estimated_time_seconds": 0,
    "generator_constraints": {}
  }
}
`.trim(),
    validateContract: (parsed, { assessmentUnitId, inputContract } = {}) => {
      const blueprint = getBlueprintObject(parsed);
      if (!blueprint) {
        throw new Error(
          'Layer 5 validation failed: response must contain exactly one top-level "blueprint" object.'
        );
      }

      if (Array.isArray(parsed?.blueprints)) {
        throw new Error(
          'Layer 5 validation failed: "blueprints" array is no longer allowed. Use a single "blueprint" object.'
        );
      }

      const forbiddenKey = Object.keys(blueprint).find((key) =>
        layer5ForbiddenBlueprintKeys.has(key)
      );
      if (forbiddenKey) {
        throw new Error(
          `Layer 5 validation failed: "${forbiddenKey}" is redundant or narrative. Keep Layer 5 as a compact item blueprint only.`
        );
      }

      const normalized = normalizeLayer5BlueprintContract(parsed, {
        assessmentUnitId,
        inputContract,
      });
      const normalizedBlueprint = normalized.blueprint;

      const expectedAssessmentUnitId =
        assessmentUnitId || inputContract?.assessment_unit?.assessment_unit_id;
      const actualAssessmentUnitId = requireNonEmptyBlueprintString(
        normalizedBlueprint,
        ["assessment_unit_id", "assessmentUnitId"],
        "assessment_unit_id"
      );
      if (expectedAssessmentUnitId && actualAssessmentUnitId !== expectedAssessmentUnitId) {
        throw new Error(
          `Layer 5 validation failed: assessment_unit_id must be "${expectedAssessmentUnitId}".`
        );
      }

      requireNonEmptyBlueprintString(
        normalizedBlueprint,
        ["blueprint_id", "blueprintId"],
        "blueprint_id"
      );
      requireNonEmptyBlueprintString(
        normalizedBlueprint,
        ["question_family", "questionFamily"],
        "question_family"
      );
      requireNonEmptyBlueprintString(
        normalizedBlueprint,
        ["interaction_type", "interactionType"],
        "interaction_type"
      );
      requireNonEmptyBlueprintString(
        normalizedBlueprint,
        ["expected_answer_type", "expectedAnswerType"],
        "expected_answer_type"
      );
      requireNonEmptyBlueprintString(
        normalizedBlueprint,
        ["blooms_level", "bloomsLevel"],
        "blooms_level"
      );
      requireNonEmptyBlueprintString(normalizedBlueprint, ["difficulty"], "difficulty");

      requirePositiveBlueprintInteger(normalizedBlueprint, ["marks"], "marks");
      requirePositiveBlueprintInteger(
        normalizedBlueprint,
        ["estimated_time_seconds", "estimatedTimeSeconds"],
        "estimated_time_seconds"
      );

      if (
        !isPlainObject(
          normalizedBlueprint.generator_constraints ||
            normalizedBlueprint.generatorConstraints
        )
      ) {
        throw new Error(
          'Layer 5 validation failed: "generator_constraints" must be a JSON object.'
        );
      }

      const memorySupport = getBlueprintValue(
        normalizedBlueprint,
        "memory_support",
        "memorySupport"
      );
      if (memorySupport !== undefined && !isPlainObject(memorySupport)) {
        throw new Error(
          'Layer 5 validation failed: "memory_support" must be a JSON object when provided.'
        );
      }

      const commonMisconception = getBlueprintValue(
        normalizedBlueprint,
        "common_misconception",
        "commonMisconception"
      );
      if (
        commonMisconception !== undefined &&
        (typeof commonMisconception !== "string" || !commonMisconception.trim())
      ) {
        throw new Error(
          'Layer 5 validation failed: "common_misconception" must be a non-empty string when provided.'
        );
      }

      const successCriteria = getBlueprintValue(
        normalizedBlueprint,
        "success_criteria",
        "successCriteria"
      );
      if (
        successCriteria !== undefined &&
        (typeof successCriteria !== "string" || !successCriteria.trim())
      ) {
        throw new Error(
          'Layer 5 validation failed: "success_criteria" must be a non-empty string when provided.'
        );
      }
    },
    normalizeContract: normalizeLayer5BlueprintContract,
    persistContract: persistLayer5Blueprint,
  },
  {
    layerNumber: 6,
    layerName: "Item Generation",
    scope: "assessmentUnit",
    promptVersion: DEFAULT_PROMPT_VERSION,
    responseFormatName: "layer6_assessment_item_contract",
    systemPrompt: ({ inputContract } = {}) =>
      `You are a ${getSubjectLabelFromContext(inputContract)} item generation engine. Return only valid JSON that exactly matches the requested schema.`,
    buildUserPrompt: ({ inputContract }) => `
Create Layer 6 assessment item JSON for exactly one assessment unit.
Practice directives:
${buildPracticeDirectivesForPrompt(inputContract, 6)}
${buildLanguageRulesForPrompt(inputContract)}

Input:
${stringifyPromptInputContract(inputContract, 6)}

Rules:
- "interaction_type" must be exactly one of: "single_select", "free_text", "ordering", "matching".
- "single_select" (a standard multiple-choice question): "options" has 3-5 distinct plain-text choices; "correct_answer" is the exact text of the one correct option; "interaction_data" must be {}.
- "free_text" (a short written/descriptive answer): "options" must be [] (empty array); "correct_answer" is the model answer text; "acceptable_answers" may list accepted synonyms/variants; "interaction_data" must be {}.
- "ordering" (student arranges items into the correct sequence): "options" lists the items to be arranged, in SHUFFLED (not correct) order; "interaction_data.sequence" is an array of those same option strings in the CORRECT order (every entry must exactly match one "options" entry, one-to-one, same count); "correct_answer" is the correct order joined with "; " for display.
- "matching" (student pairs items from a left set with items from a right set): "options" must be [] (empty array); "interaction_data.pairs" is an array of {"left","right"} objects, one per correct pairing (3-5 pairs); "correct_answer" is "left -> right" pairs joined with "; " for display.
- Only use "ordering" or "matching" when the question explicitly asks the student to arrange/sequence/order a list, or to match/pair items from two sets. Do not use "ordering" for a question about a single position in a ranked list (that is "single_select"). Default to "single_select" or "free_text" otherwise.
- Every item needs: item_id, question_family, interaction_type, difficulty, blooms_level, assessment_dimension, learning_objective, question, options, correct_answer, acceptable_answers, interaction_data, marks, estimated_time_seconds.

Schema:
{
  "assessment_items": [
    {
      "item_id": "",
      "question_family": "",
      "interaction_type": "single_select | free_text | ordering | matching",
      "difficulty": "",
      "blooms_level": "",
      "assessment_dimension": "",
      "learning_objective": "",
      "question": "",
      "options": [],
      "correct_answer": "",
      "acceptable_answers": [],
      "interaction_data": {},
      "marks": 0,
      "estimated_time_seconds": 0
    }
  ]
}
`.trim(),
    validateContract: (parsed) => {
      if (!Array.isArray(parsed?.assessment_items)) {
        throw new Error('Layer 6 validation failed: "assessment_items" must be an array.');
      }

      const VALID_LAYER6_INTERACTION_TYPES = new Set(["single_select", "free_text", "ordering", "matching"]);
      const toItemArray = (value) => (Array.isArray(value) ? value : []);

      parsed.assessment_items.forEach((item, index) => {
        const label = `Layer 6 validation failed (item ${index + 1})`;
        const interactionType = item?.interaction_type || item?.interactionType;

        // Lenient when interaction_type is absent -- this field is new, and
        // older/other generation paths may still omit it. Only enforce the
        // enum and per-type shape when the model DID supply a value.
        if (!interactionType) {
          return;
        }

        if (!VALID_LAYER6_INTERACTION_TYPES.has(interactionType)) {
          throw new Error(
            `${label}: "interaction_type" must be one of ${[...VALID_LAYER6_INTERACTION_TYPES].join(", ")}.`
          );
        }

        const options = toItemArray(item?.options);

        if (interactionType === "single_select" && options.length < 2) {
          throw new Error(`${label}: "single_select" items need at least 2 "options".`);
        }

        if (interactionType === "ordering") {
          const sequence = toItemArray(item?.interaction_data?.sequence);
          if (sequence.length < 2) {
            throw new Error(
              `${label}: "ordering" items need "interaction_data.sequence" with at least 2 entries.`
            );
          }
          const optionTexts = new Set(
            options.map((option) => (typeof option === "string" ? option.trim().toLowerCase() : ""))
          );
          const missing = sequence.some(
            (entry) => !optionTexts.has(String(entry ?? "").trim().toLowerCase())
          );
          if (missing) {
            throw new Error(
              `${label}: every "interaction_data.sequence" entry must match one of the "options" entries.`
            );
          }
        }

        if (interactionType === "matching") {
          const pairs = toItemArray(item?.interaction_data?.pairs);
          if (pairs.length < 2) {
            throw new Error(`${label}: "matching" items need "interaction_data.pairs" with at least 2 entries.`);
          }
          const invalid = pairs.some((pair) => !pair?.left || !pair?.right);
          if (invalid) {
            throw new Error(`${label}: every "interaction_data.pairs" entry needs non-empty "left" and "right".`);
          }
        }
      });
    },
    persistContract: persistLayer6Items,
  },
  {
    layerNumber: 7,
    layerName: "Learning Support",
    scope: "assessmentUnit",
    promptVersion: DEFAULT_PROMPT_VERSION,
    responseFormatName: "layer7_learning_support_contract",
    systemPrompt: ({ inputContract } = {}) =>
      `You are a ${getSubjectLabelFromContext(inputContract)} learning support engine. Return only valid JSON that exactly matches the requested schema.`,
    buildUserPrompt: ({ inputContract }) => `
Create Layer 7 learning support JSON for exactly one assessment unit.
Practice directives:
${buildPracticeDirectivesForPrompt(inputContract, 7)}
${buildLanguageRulesForPrompt(inputContract)}

Input:
${stringifyPromptInputContract(inputContract, 7)}

Rules:
- Return exactly one compact machine-facing support object under the top-level key "learning_support".
- Do not regenerate generic stories, analogies, visual hooks, memory tricks, retrieval cues, curiosity hooks, or micro activities. Reuse Layer 2 memory by reference.
- Focus on item explanation, misconception diagnosis, progressive hints, and next-step remediation.
- Keep output concise, learner-supportive, and directly actionable.
- "mastery_recommendation" must be a compact action slug, not a paragraph.
- "memory_support_refs" must reference existing Layer 2 memory support instead of inventing new memory assets.

Schema:
{
  "learning_support": {
    "assessment_unit_id": "",
    "concept_explanation": "",
    "correct_answer_reasoning": "",
    "real_world_insight": "",
    "distractor_analysis": [],
    "progressive_hints": [],
    "misconception_feedback": {},
    "adaptive_remediation": [],
    "mastery_recommendation": "",
    "memory_support_refs": {}
  }
}
`.trim(),
    validateContract: (parsed, { assessmentUnitId, inputContract } = {}) => {
      const support = getLayer7SupportObject(parsed);
      if (!support) {
        throw new Error('Layer 7 validation failed: "learning_support" must be an object.');
      }

      const forbiddenKey = Object.keys(support).find((key) =>
        layer7ForbiddenSupportKeys.has(key)
      );
      if (forbiddenKey) {
        throw new Error(
          `Layer 7 validation failed: "${forbiddenKey}" duplicates Layer 2 memory or stale support outputs.`
        );
      }

      const normalized = normalizeLayer7SupportContract(parsed, {
        assessmentUnitId,
        inputContract,
      });
      const normalizedSupport = normalized.learning_support;

      const expectedAssessmentUnitId =
        assessmentUnitId || inputContract?.assessment_unit?.assessment_unit_id;
      if (
        expectedAssessmentUnitId &&
        normalizedSupport.assessment_unit_id !== expectedAssessmentUnitId
      ) {
        throw new Error(
          `Layer 7 validation failed: assessment_unit_id must be "${expectedAssessmentUnitId}".`
        );
      }

      for (const key of [
        "concept_explanation",
        "correct_answer_reasoning",
        "mastery_recommendation",
      ]) {
        if (
          typeof normalizedSupport[key] !== "string" ||
          !normalizedSupport[key].trim()
        ) {
          throw new Error(
            `Layer 7 validation failed: "${key}" must be a non-empty string.`
          );
        }
      }

      if (!Array.isArray(normalizedSupport.distractor_analysis)) {
        throw new Error(
          'Layer 7 validation failed: "distractor_analysis" must be an array.'
        );
      }

      if (!Array.isArray(normalizedSupport.progressive_hints)) {
        throw new Error(
          'Layer 7 validation failed: "progressive_hints" must be an array.'
        );
      }

      if (!Array.isArray(normalizedSupport.adaptive_remediation)) {
        throw new Error(
          'Layer 7 validation failed: "adaptive_remediation" must be an array.'
        );
      }

      if (!isPlainObject(normalizedSupport.memory_support_refs)) {
        throw new Error(
          'Layer 7 validation failed: "memory_support_refs" must be an object.'
        );
      }
    },
    normalizeContract: normalizeLayer7SupportContract,
    persistContract: persistLayer7Support,
  },
];

const jobs = new Map();
const pipelineLayerNames = pipelineDefinitions.map((layer) => layer.layerName);

const normalizeTargetLayerNumber = (value) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return pipelineDefinitions.length;
  }

  return Math.min(Math.max(parsed, 1), pipelineDefinitions.length);
};

const buildLiveLayerStatuses = (job) =>
  pipelineDefinitions.map((_, index) => {
    if (job.generationIds[index]?.length) {
      return "completed";
    }

    if (["queued", "running"].includes(job.status) && index === job.activeLayerIndex) {
      return job.status;
    }

    if (job.status === "aborted" && index === job.activeLayerIndex) {
      return "aborted";
    }

    if (job.status === "failed" && index === job.activeLayerIndex) {
      return "failed";
    }

    return "paused";
  });

const toSafeText = (value) => (typeof value === "string" ? value.trim() : "");

const truncateText = (value, limit = MAX_SOURCE_TEXT_CHARS) => {
  if (!value || value.length <= limit) {
    return value;
  }
  return `${value.slice(0, limit)}\n...[truncated]`;
};

const createCacheKey = (payload, layerNumber) =>
  crypto
    .createHash("sha256")
    .update(JSON.stringify({ payload, layerNumber }))
    .digest("hex");

const buildSourceMetadataContext = (payload) => ({
  board: payload.board,
  className: payload.className,
  subject: payload.subject,
  subjectCode: payload.subjectCode,
  chapter: payload.chapter,
  chapterKey: payload.chapterKey,
  sectionNumber: payload.sectionNumber,
});

const buildGenerationDirectives = (payload, { compact = false } = {}) => {
  const practiceProfile = getPracticeTypeProfile(payload.practiceType);
  const practiceDirectives = buildPracticeDirectivesText(practiceProfile);
  const requestedSourceLanguage = normalizeLanguageCode(
    payload.sourceLanguage || payload.source_language || payload.language || payload.languageCode
  );
  const requestedOutputLanguage = normalizeLanguageCode(
    payload.outputLanguage || payload.output_language
  );

  if (compact) {
    return {
      practice_type: practiceProfile.practice_type,
      generation_mode: practiceProfile.generation_mode,
      target_outcomes: practiceProfile.target_outcomes || [],
      layer_focus: practiceProfile.layer_emphasis?.layer1 || "",
      constraints: practiceProfile.constraints || [],
      target_difficulty: payload.targetDifficulty || "Balanced",
      time_limit_minutes: payload.duration || null,
      blueprint_hint: payload.blueprint || "",
      source_language: requestedSourceLanguage || undefined,
      output_language: requestedOutputLanguage || requestedSourceLanguage || undefined,
    };
  }

  return {
    practice_profile: practiceProfile,
    practice_type_directives: practiceDirectives,
    target_difficulty: payload.targetDifficulty || "Balanced",
    time_limit_minutes: payload.duration || null,
    blueprint_hint: payload.blueprint || "",
    source_language: requestedSourceLanguage || undefined,
    output_language: requestedOutputLanguage || requestedSourceLanguage || undefined,
  };
};

const buildPromptInputContract = (inputContract = {}, layerNumber = 1) => {
  const generationDirectives = inputContract.generation_directives || {};
  const practiceProfile = generationDirectives.practice_profile || {};
  const compactDirectives = {
    practice_type: generationDirectives.practice_type || practiceProfile.practice_type,
    generation_mode: generationDirectives.generation_mode || practiceProfile.generation_mode,
    target_outcomes: generationDirectives.target_outcomes || practiceProfile.target_outcomes,
    layer_focus:
      generationDirectives.layer_focus ||
      practiceProfile.layer_emphasis?.[`layer${layerNumber}`],
    constraints: generationDirectives.constraints || practiceProfile.constraints,
    target_difficulty: generationDirectives.target_difficulty,
    time_limit_minutes: generationDirectives.time_limit_minutes,
    blueprint_hint: generationDirectives.blueprint_hint,
    source_language: generationDirectives.source_language,
    output_language: generationDirectives.output_language,
  };

  Object.keys(compactDirectives).forEach((key) => {
    if (
      compactDirectives[key] === undefined ||
      compactDirectives[key] === null ||
      compactDirectives[key] === ""
    ) {
      delete compactDirectives[key];
    }
  });

  return {
    ...inputContract,
    generation_directives: compactDirectives,
  };
};

const stringifyPromptInputContract = (inputContract, layerNumber = 1) =>
  JSON.stringify(buildPromptInputContract(inputContract, layerNumber), null, 2);

const buildPracticeDirectivesForPrompt = (inputContract = {}, layerNumber = 1) => {
  const directives = inputContract.generation_directives || {};
  const practiceProfile = directives.practice_profile || {};
  const practiceType = directives.practice_type || practiceProfile.practice_type;
  const generationMode = directives.generation_mode || practiceProfile.generation_mode;
  const targetOutcomes = directives.target_outcomes || practiceProfile.target_outcomes || [];
  const layerFocus =
    directives.layer_focus || practiceProfile.layer_emphasis?.[`layer${layerNumber}`] || "";
  const constraints = directives.constraints || practiceProfile.constraints || [];

  const lines = [
    practiceType ? `Practice Type: ${practiceType}` : null,
    generationMode ? `Generation Mode: ${generationMode}` : null,
    directives.source_language ? `Source Language: ${directives.source_language}` : null,
    directives.output_language ? `Output Language: ${directives.output_language}` : null,
  ].filter(Boolean);

  if (Array.isArray(targetOutcomes) && targetOutcomes.length > 0) {
    lines.push(
      "Target Outcomes:",
      ...targetOutcomes.map((item) => `- ${item}`)
    );
  }

  if (layerFocus) {
    lines.push(`Layer ${layerNumber} Focus:`, `- ${layerFocus}`);
  }

  if (Array.isArray(constraints) && constraints.length > 0) {
    lines.push("Constraints:", ...constraints.map((item) => `- ${item}`));
  }

  if (lines.length === 0 && directives.practice_type_directives) {
    return directives.practice_type_directives;
  }

  return lines.join("\n");
};

const buildDocumentCode = (payload) =>
  [
    payload.board,
    payload.className,
    payload.subjectCode || payload.subject,
    payload.chapterKey || payload.chapter,
  ]
    .filter(Boolean)
    .join(":")
    .replace(/\s+/g, "_")
    .toUpperCase();

// systemPrompt may be a static string or a function of the input contract (used
// to inject the subject name for multi-subject support). Resolve to a string.
const resolveLayerSystemPrompt = (layer, inputContract) =>
  typeof layer.systemPrompt === "function"
    ? layer.systemPrompt({ inputContract })
    : layer.systemPrompt;

const resolveLayerModelSelection = (layerNumber, modelOverrideId = null) => {
  if (modelOverrideId) {
    const entry = getModelRegistryEntry(modelOverrideId);
    if (!entry) {
      const error = new Error(`Unknown AI model id: ${modelOverrideId}`);
      error.statusCode = 400;
      throw error;
    }
    return Promise.resolve({ modelId: entry.id, modelName: entry.modelName });
  }

  return resolveModelForLayer(layerNumber, {
    fallbackModelName: layerModelMap[layerNumber] || env.openAiModel || "gpt-5.4-mini",
  });
};

const withTransaction = async (work) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const createPipelineRun = async ({ jobId, payload, userId }) => {
  await pool.query(
    `
      INSERT INTO assessment_pipeline_run (
        job_id,
        request_payload,
        status,
        created_by
      )
      VALUES ($1, $2, 'queued', $3)
    `,
    [jobId, JSON.stringify(payload), userId || null]
  );
};

const updatePipelineRun = async ({
  jobId,
  status,
  sourceDocumentId,
  sourceSectionId,
  fkMstChapterId,
}) => {
  await pool.query(
    `
      UPDATE assessment_pipeline_run
      SET status = COALESCE($2, status),
          source_document_id = COALESCE($3, source_document_id),
          source_section_id = COALESCE($4, source_section_id),
          fk_mst_chapter_id = COALESCE($5, fk_mst_chapter_id),
          updated_at = NOW()
      WHERE job_id = $1
    `,
    [jobId, status || null, sourceDocumentId || null, sourceSectionId || null, fkMstChapterId || null]
  );
};

const recordPipelineRunLayer = async ({
  jobId,
  generationId,
  layer,
  sourceSectionId,
  assessmentUnitId,
  promptVersion,
  modelName,
  status,
  isCached,
  usage,
  openAiResponseId,
}) => {
  await pool.query(
    `
      INSERT INTO assessment_pipeline_run_layer (
        job_id,
        generation_id,
        layer_number,
        layer_name,
        source_section_id,
        assessment_unit_id,
        prompt_version,
        model_name,
        status,
        is_cached,
        token_input,
        token_output,
        openai_response_id,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
    `,
    [
      jobId,
      generationId || null,
      layer.layerNumber,
      layer.layerName,
      sourceSectionId || null,
      assessmentUnitId || null,
      promptVersion,
      modelName || null,
      status,
      Boolean(isCached),
      usage?.inputTokens || 0,
      usage?.outputTokens || 0,
      openAiResponseId || null,
    ]
  );
};

// Every fresh (non-cached) layer 2-7 generation becomes a new, auto-selected
// version for its assessment unit + layer. Older versions are kept, not
// deleted, so they remain available for side-by-side comparison and can be
// restored later via selectAssessmentStudioLayerVersion.
const recordLayerGenerationVersion = async ({
  assessmentUnitId,
  layerNumber,
  generationId,
  jobId,
  userId,
  usage,
}) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const versionResult = await client.query(
      `
        SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version
        FROM layer_generation_version
        WHERE assessment_unit_id = $1 AND layer_number = $2
      `,
      [assessmentUnitId, layerNumber]
    );
    const nextVersion = versionResult.rows[0].next_version;

    await client.query(
      `
        UPDATE layer_generation_version
        SET is_selected = FALSE
        WHERE assessment_unit_id = $1 AND layer_number = $2 AND is_selected = TRUE
      `,
      [assessmentUnitId, layerNumber]
    );

    await client.query(
      `
        INSERT INTO layer_generation_version (
          assessment_unit_id, layer_number, generation_id, pipeline_job_id,
          version_number, is_selected, token_input, token_output, created_by
        )
        VALUES ($1, $2, $3, $4, $5, TRUE, $6, $7, $8)
        ON CONFLICT (generation_id) DO NOTHING
      `,
      [
        assessmentUnitId,
        layerNumber,
        generationId,
        jobId,
        nextVersion,
        usage?.inputTokens || 0,
        usage?.outputTokens || 0,
        userId || null,
      ]
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const recordContentUpdateEvent = async ({ job, sourceRefs }) => {
  const payload = job.payload || {};

  if (!payload.board || !payload.className || !payload.subjectCode) {
    return;
  }

  const { examGoalCode, levelCode, subjectCode, isValid } = resolveDashboardAcademicFilters({
    board: payload.board,
    studentClass: payload.className,
    subject: payload.subject,
  });

  if (!isValid) {
    return;
  }

  try {
    const chapterKeyParts = toSafeText(payload.chapterKey).split(":");
    const chapterNumber = chapterKeyParts[1] || null;

    await pool.query(
      `
        INSERT INTO content_update_event (
          exam_goal_code,
          level_code,
          subject_code,
          chapter_number,
          chapter_name,
          section_number,
          topic_name,
          source_section_id,
          fk_mst_chapter_id,
          target_layer_number,
          pipeline_job_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, NULL, $7, $8, $9, $10)
      `,
      [
        examGoalCode,
        levelCode,
        subjectCode,
        chapterNumber,
        payload.chapter || null,
        payload.sectionNumber || null,
        sourceRefs?.sourceSectionId || null,
        sourceRefs?.fkMstChapterId || null,
        job.targetLayerNumber,
        job.jobId,
      ]
    );
  } catch (error) {
    console.error("Failed to record content_update_event", error);
  }
};

const createSourceRecords = async (db, payload, userId) => {
  const documentTitle = `${payload.subject} | Class ${payload.className} | ${payload.chapter}`;
  const documentCode = buildDocumentCode(payload);
  const sourceDocumentResult = await db.query(
    `
      INSERT INTO source_document (
        document_code,
        title,
        source_type,
        board_name,
        class_name,
        subject_name,
        chapter_name,
        owner_user_id,
        review_status
      )
      VALUES ($1, $2, 'admin_pipeline', $3, $4, $5, $6, $7, 'draft')
      ON CONFLICT (document_code) DO UPDATE
      SET title = EXCLUDED.title,
          board_name = EXCLUDED.board_name,
          class_name = EXCLUDED.class_name,
          subject_name = EXCLUDED.subject_name,
          chapter_name = EXCLUDED.chapter_name,
          owner_user_id = EXCLUDED.owner_user_id,
          updated_at = NOW()
      RETURNING id
    `,
    [
      documentCode,
      documentTitle,
      payload.board,
      payload.className,
      payload.subject,
      payload.chapter,
      userId || null,
    ]
  );

  const sourceDocumentId = sourceDocumentResult.rows[0].id;
  const chapterKeyParts = toSafeText(payload.chapterKey).split(":");
  const chapterBookId = chapterKeyParts[0] || null;
  const chapterNumber = chapterKeyParts[1] || null;

  const chapterResult =
    chapterBookId && chapterNumber
      ? await db.query(
          `
            SELECT id
            FROM mst_chapter
            WHERE fk_mst_book_id = $1 AND chapter_number = $2
            ORDER BY id ASC
            LIMIT 1
          `,
          [chapterBookId, chapterNumber]
        )
      : { rows: [] };

  const fkMstChapterId = chapterResult.rows[0]?.id || null;
  const sectionCode = `${payload.chapterKey || "chapter"}:${payload.sectionNumber || "section"}`;

  const sourceSectionResult = await db.query(
    `
      INSERT INTO source_section (
        source_document_id,
        fk_mst_chapter_id,
        section_code,
        section_number,
        title,
        review_status
      )
      VALUES ($1, $2, $3, $4, $5, 'draft')
      ON CONFLICT (source_document_id, section_code) DO UPDATE
      SET fk_mst_chapter_id = EXCLUDED.fk_mst_chapter_id,
          section_number = EXCLUDED.section_number,
          title = EXCLUDED.title,
          updated_at = NOW()
      RETURNING id
    `,
    [
      sourceDocumentId,
      fkMstChapterId,
      sectionCode,
      payload.sectionNumber || null,
      payload.chapter || "Section",
    ]
  );

  return {
    sourceDocumentId,
    sourceSectionId: sourceSectionResult.rows[0].id,
    fkMstChapterId,
  };
};

const persistSourceArtifacts = async (db, payload, sourceRefs) => {
  await db.query(`DELETE FROM source_section_image WHERE source_section_id = $1`, [
    sourceRefs.sourceSectionId,
  ]);
  await db.query(`DELETE FROM source_ocr_text WHERE source_section_id = $1`, [
    sourceRefs.sourceSectionId,
  ]);

  const sectionText = toSafeText(payload.sectionOcrText);
  if (sectionText) {
    await db.query(
      `
        INSERT INTO source_ocr_text (
          source_section_id,
          ocr_provider,
          ocr_confidence,
          raw_text,
          normalized_text
        )
        VALUES ($1, $2, $3, $4, $5)
      `,
      [sourceRefs.sourceSectionId, "admin_manual", null, sectionText, sectionText]
    );
  }

  const imageDataUrl = toSafeText(payload.sectionImageDataUrl);
  if (imageDataUrl) {
    const imageHash = crypto.createHash("sha256").update(imageDataUrl).digest("hex");
    await db.query(
      `
        INSERT INTO source_section_image (
          source_section_id,
          image_sequence,
          storage_path,
          mime_type
        )
        VALUES ($1, 0, $2, $3)
      `,
      [
        sourceRefs.sourceSectionId,
        `inline://${imageHash}/${payload.sectionImageName || "section-image"}`,
        payload.sectionImageMimeType || null,
      ]
    );
  }
};

const loadSourceArtifacts = async (sourceSectionId) => {
  const [imageResult, ocrResult] = await Promise.all([
    pool.query(
      `
        SELECT storage_path, mime_type
        FROM source_section_image
        WHERE source_section_id = $1
        ORDER BY image_sequence ASC, id ASC
        LIMIT 1
      `,
      [sourceSectionId]
    ),
    pool.query(
      `
        SELECT raw_text, normalized_text
        FROM source_ocr_text
        WHERE source_section_id = $1
        ORDER BY id DESC
        LIMIT 1
      `,
      [sourceSectionId]
    ),
  ]);

  return {
    sectionImageRecord: imageResult.rows[0] || null,
    sectionOcrRecord: ocrResult.rows[0] || null,
  };
};

const buildLayer1InputContract = async ({ payload, sourceRefs }) => {
  const metadata = buildSourceMetadataContext(payload);
  const artifacts = await loadSourceArtifacts(sourceRefs.sourceSectionId);
  const normalizedText =
    artifacts.sectionOcrRecord?.normalized_text || artifacts.sectionOcrRecord?.raw_text || "";
  const inferredSourceLanguage =
    normalizeLanguageCode(
      payload.sourceLanguage || payload.source_language || payload.language || payload.languageCode
    ) || detectSourceLanguage(normalizedText);
  const inferredOutputLanguage =
    normalizeLanguageCode(payload.outputLanguage || payload.output_language) ||
    inferredSourceLanguage;
  const imageDigest = payload.sectionImageDataUrl
    ? crypto.createHash("sha256").update(payload.sectionImageDataUrl).digest("hex")
    : null;

  const sourceArtifacts = {
    section_text: {
      has_text: Boolean(normalizedText),
      normalized_text: truncateText(normalizedText),
      full_text_length: normalizedText.length,
    },
  };

  if (payload.sectionImageDataUrl || artifacts.sectionImageRecord) {
    sourceArtifacts.section_image = {
      has_image: Boolean(payload.sectionImageDataUrl),
      file_name: payload.sectionImageName || null,
      mime_type:
        payload.sectionImageMimeType || artifacts.sectionImageRecord?.mime_type || null,
      storage_path: artifacts.sectionImageRecord?.storage_path || null,
      image_digest: imageDigest,
    };
  }

  return {
    context: metadata,
    generation_directives: buildGenerationDirectives(payload, { compact: true }),
    language: {
      source_language: inferredSourceLanguage,
      output_language: inferredOutputLanguage,
    },
    source_artifacts: sourceArtifacts,
  };
};

const createGenerationAndRun = async ({
  jobId,
  layer,
  userId,
  sourceDocumentId,
  sourceSectionId,
  fkMstChapterId,
  assessmentUnitId,
  parentGenerationId,
  dependencies = [],
  inputJson,
  promptVersion,
  modelName,
  cacheKey,
  sourceHash,
}) => {
  const generationResult = await pool.query(
    `
      INSERT INTO generation_registry (
        pipeline_job_id,
        layer_number,
        layer_name,
        prompt_version,
        contract_schema_version,
        model_name,
        cache_key,
        source_hash,
        status,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'running', $9)
      RETURNING generation_id
    `,
    [
      jobId,
      layer.layerNumber,
      layer.layerName,
      promptVersion,
      DEFAULT_CONTRACT_SCHEMA_VERSION,
      modelName,
      cacheKey,
      sourceHash,
      userId || null,
    ]
  );

  const generationId = generationResult.rows[0].generation_id;

  await pool.query(
    `
      INSERT INTO layer_run (
        generation_id,
        pipeline_job_id,
        layer_number,
        layer_name,
        source_document_id,
        source_section_id,
        fk_mst_chapter_id,
        assessment_unit_id,
        parent_generation_id,
        prompt_version,
        contract_schema_version,
        model_name,
        cache_key,
        source_hash,
        status,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'running', $15)
    `,
    [
      generationId,
      jobId,
      layer.layerNumber,
      layer.layerName,
      sourceDocumentId,
      sourceSectionId,
      fkMstChapterId,
      assessmentUnitId || null,
      parentGenerationId || null,
      promptVersion,
      DEFAULT_CONTRACT_SCHEMA_VERSION,
      modelName,
      cacheKey,
      sourceHash,
      userId || null,
    ]
  );

  await pool.query(
    `
      INSERT INTO layer_input_contract (
        generation_id,
        pipeline_job_id,
        layer_number,
        layer_name,
        source_document_id,
        source_section_id,
        fk_mst_chapter_id,
        assessment_unit_id,
        parent_generation_id,
        prompt_version,
        contract_schema_version,
        model_name,
        cache_key,
        source_hash,
        input_json,
        status,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'running', $16)
    `,
    [
      generationId,
      jobId,
      layer.layerNumber,
      layer.layerName,
      sourceDocumentId,
      sourceSectionId,
      fkMstChapterId,
      assessmentUnitId || null,
      parentGenerationId || null,
      promptVersion,
      DEFAULT_CONTRACT_SCHEMA_VERSION,
      modelName,
      cacheKey,
      sourceHash,
      JSON.stringify(inputJson),
      userId || null,
    ]
  );

  for (const dependency of dependencies) {
    if (!dependency?.generationId) {
      continue;
    }

    await pool.query(
      `
        INSERT INTO layer_contract_dependency (
          generation_id,
          depends_on_generation_id,
          dependency_role
        )
        VALUES ($1, $2, $3)
        ON CONFLICT (generation_id, depends_on_generation_id, dependency_role) DO NOTHING
      `,
      [generationId, dependency.generationId, dependency.role || "dependency"]
    );
  }

  return generationId;
};

const logOpenAiAuditEvent = async ({
  db,
  generationId,
  layer,
  assessmentUnitId,
  sourceSectionId,
  modelName,
  openAiResponseId,
  usage,
  createdBy,
}) => {
  await db.query(
    `
      INSERT INTO audit_event (
        entity_type,
        entity_id,
        event_type,
        event_payload,
        created_by
      )
      VALUES ('generation_registry', 0, 'openai_response_logged', $1, $2)
    `,
    [
      JSON.stringify({
        generation_id: generationId,
        layer_number: layer.layerNumber,
        layer_name: layer.layerName,
        assessment_unit_id: assessmentUnitId || null,
        source_section_id: sourceSectionId || null,
        model_name: modelName || null,
        openai_response_id: openAiResponseId || null,
        token_input: usage?.inputTokens || 0,
        token_output: usage?.outputTokens || 0,
        token_total: usage?.totalTokens || 0,
      }),
      createdBy || null,
    ]
  );
};

const persistSourceParseVersion = async ({
  db,
  jobId,
  generationId,
  sourceSectionId,
  inputJson,
  outputJson,
}) => {
  await db.query(`DELETE FROM source_parse_version WHERE source_section_id = $1`, [
    sourceSectionId,
  ]);

  await db.query(
    `
      INSERT INTO source_parse_version (
        source_section_id,
        pipeline_job_id,
        generation_id,
        parse_version,
        parser_name,
        parse_status,
        parsed_text,
        metadata_json
      )
      VALUES ($1, $2, $3, $4, $5, 'completed', $6, $7)
    `,
    [
      sourceSectionId,
      jobId,
      generationId,
      DEFAULT_CONTRACT_SCHEMA_VERSION,
      "assessment_studio_layer1",
      inputJson?.source_artifacts?.section_text?.normalized_text || null,
      JSON.stringify({
        source_image: inputJson?.source_artifacts?.section_image || null,
        extracted_context_summary: outputJson?.context_summary || "",
      }),
    ]
  );
};

const finalizeGeneration = async ({
  db,
  jobId,
  generationId,
  layer,
  sourceDocumentId,
  sourceSectionId,
  fkMstChapterId,
  assessmentUnitId,
  parentGenerationId,
  outputJson,
  usage,
  modelName,
  openAiResponseId,
  userId,
  promptVersion,
  cacheKey,
  sourceHash,
}) => {
  await db.query(
    `
      INSERT INTO layer_output_contract (
        generation_id,
        pipeline_job_id,
        layer_number,
        layer_name,
        source_document_id,
        source_section_id,
        fk_mst_chapter_id,
        assessment_unit_id,
        parent_generation_id,
        prompt_version,
        contract_schema_version,
        model_name,
        openai_response_id,
        cache_key,
        source_hash,
        output_json,
        status,
        token_output,
        latency_ms,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'completed', $17, 0, $18)
    `,
    [
      generationId,
      jobId,
      layer.layerNumber,
      layer.layerName,
      sourceDocumentId,
      sourceSectionId,
      fkMstChapterId,
      assessmentUnitId || null,
      parentGenerationId || null,
      promptVersion,
      DEFAULT_CONTRACT_SCHEMA_VERSION,
      modelName,
      openAiResponseId || null,
      cacheKey,
      sourceHash,
      JSON.stringify(outputJson),
      usage.outputTokens,
      userId || null,
    ]
  );

  await db.query(
    `
      UPDATE generation_registry
      SET model_name = $2,
          openai_response_id = $3,
          status = 'completed'
      WHERE generation_id = $1
    `,
    [generationId, modelName, openAiResponseId || null]
  );

  await db.query(
    `
      UPDATE layer_run
      SET model_name = $2,
          openai_response_id = $3,
          status = 'completed',
          token_input = $4,
          token_output = $5
      WHERE generation_id = $1
    `,
    [
      generationId,
      modelName,
      openAiResponseId || null,
      usage.inputTokens,
      usage.outputTokens,
    ]
  );

  await db.query(
    `
      UPDATE layer_input_contract
      SET model_name = $2,
          openai_response_id = $3,
          status = 'completed',
          token_input = $4
      WHERE generation_id = $1
    `,
    [generationId, modelName, openAiResponseId || null, usage.inputTokens]
  );

  await logOpenAiAuditEvent({
    db,
    generationId,
    layer,
    assessmentUnitId,
    sourceSectionId,
    modelName,
    openAiResponseId,
    usage,
    createdBy: userId,
  });
};

const failGeneration = async (
  generationId,
  message,
  jobId = null,
  { category = "unknown", retryable = true, layerNumber = null } = {}
) => {
  await pool.query(
    `
      UPDATE generation_registry
      SET status = 'failed'
      WHERE generation_id = $1
    `,
    [generationId]
  );
  await pool.query(
    `
      UPDATE layer_run
      SET status = 'failed'
      WHERE generation_id = $1
    `,
    [generationId]
  );
  await pool.query(
    `
      INSERT INTO audit_event (entity_type, entity_id, event_type, event_payload, created_by)
      VALUES ('generation_registry', 0, 'pipeline_failure', $1, NULL)
    `,
    [JSON.stringify({ generationId, job_id: jobId, message, category, retryable, layer_number: layerNumber })]
  );
};

const layerDependencyRoles = {
  2: [{ layerNumber: 1, role: "knowledge_contract" }],
  3: [
    { layerNumber: 1, role: "knowledge_contract" },
    { layerNumber: 2, role: "concept_memory_contract" },
  ],
  4: [
    { layerNumber: 1, role: "knowledge_contract" },
    { layerNumber: 2, role: "concept_memory_contract" },
    { layerNumber: 3, role: "assessment_capability_contract" },
  ],
  5: [
    { layerNumber: 1, role: "knowledge_contract" },
    { layerNumber: 2, role: "concept_memory_contract" },
    { layerNumber: 4, role: "assessment_strategy_contract" },
  ],
  6: [
    { layerNumber: 1, role: "knowledge_contract" },
    { layerNumber: 5, role: "item_blueprint_contract" },
  ],
  7: [
    { layerNumber: 1, role: "knowledge_contract" },
    { layerNumber: 2, role: "concept_memory_contract" },
    { layerNumber: 6, role: "assessment_item_contract" },
  ],
};

const getAssessmentUnitDependencies = ({
  assessmentUnitId,
  assessmentUnitState,
  layerNumber,
}) =>
  (layerDependencyRoles[layerNumber] || [])
    .map((dependency) => ({
      generationId:
        assessmentUnitState[assessmentUnitId]?.[dependency.layerNumber] || null,
      role: dependency.role,
    }))
    .filter((dependency) => dependency.generationId);

const getCachedLayerResult = async ({
  layerNumber,
  promptVersion,
  modelName,
  cacheKey,
  assessmentUnitId,
}) => {
  const result = assessmentUnitId
    ? await pool.query(
        `
          SELECT
            gr.generation_id,
            loc.output_json
          FROM generation_registry gr
          INNER JOIN layer_output_contract loc
            ON loc.generation_id = gr.generation_id
          WHERE gr.layer_number = $1
            AND gr.prompt_version = $2
            AND COALESCE(gr.model_name, '') = COALESCE($3, '')
            AND gr.cache_key = $4
            AND loc.assessment_unit_id = $5
            AND gr.status = 'completed'
            AND loc.status = 'completed'
          ORDER BY gr.created_at DESC
          LIMIT 1
        `,
        [layerNumber, promptVersion, modelName, cacheKey, assessmentUnitId]
      )
    : await pool.query(
        `
          SELECT
            gr.generation_id,
            loc.output_json
          FROM generation_registry gr
          INNER JOIN layer_output_contract loc
            ON loc.generation_id = gr.generation_id
          WHERE gr.layer_number = $1
            AND gr.prompt_version = $2
            AND COALESCE(gr.model_name, '') = COALESCE($3, '')
            AND gr.cache_key = $4
            AND loc.assessment_unit_id IS NULL
            AND gr.status = 'completed'
            AND loc.status = 'completed'
          ORDER BY gr.created_at DESC
          LIMIT 1
        `,
        [layerNumber, promptVersion, modelName, cacheKey]
      );

  return result.rows[0] || null;
};

const buildValidationRetryPrompt = (basePrompt, validationError, attemptNumber) => `
${basePrompt}

Previous attempt failed validation.
Attempt number: ${attemptNumber}
Validation failure:
${validationError}

Fix the JSON and return a corrected response that exactly matches the required schema and rules.
`.trim();

const getPersistedPipelineStatus = async (jobId) => {
  const [runResult, layersResult, failureResult] = await Promise.all([
    pool.query(
      `
        SELECT job_id, status
        FROM assessment_pipeline_run
        WHERE job_id = $1
        LIMIT 1
      `,
      [jobId]
    ),
    pool.query(
      `
        SELECT
          arl.layer_number,
          arl.status,
          arl.generation_id,
          arl.token_input,
          arl.token_output
        FROM assessment_pipeline_run_layer arl
        LEFT JOIN layer_generation_version lgv ON lgv.generation_id = arl.generation_id
        WHERE arl.job_id = $1
          AND (
            arl.layer_number = 1
            OR lgv.is_selected IS TRUE
            OR lgv.generation_id IS NULL
          )
        ORDER BY arl.layer_number ASC, arl.created_at ASC, arl.id ASC
      `,
      [jobId]
    ),
    pool.query(
      `
        SELECT event_payload
        FROM audit_event
        WHERE event_type = 'pipeline_failure'
          AND (event_payload->>'job_id') = $1
        ORDER BY created_at DESC, id DESC
        LIMIT 1
      `,
      [jobId]
    ),
  ]);

  const run = runResult.rows[0];
  if (!run) {
    return null;
  }

  const tokenRows = pipelineDefinitions.map(() => 0);
  const generationIds = pipelineDefinitions.map(() => []);

  for (const row of layersResult.rows) {
    const index = Number(row.layer_number) - 1;
    if (index < 0 || index >= pipelineDefinitions.length) {
      continue;
    }

    tokenRows[index] += Number(row.token_input || 0) + Number(row.token_output || 0);
    if (row.generation_id) {
      generationIds[index].push(row.generation_id);
    }
  }

  const highestStartedIndex = layersResult.rows.reduce((max, row) => {
    const index = Number(row.layer_number) - 1;
    return index > max ? index : max;
  }, -1);

  const runningRow = layersResult.rows.find((row) => row.status === "running");
  const completedLayerNumbers = new Set(
    layersResult.rows
      .filter((row) => row.status === "completed")
      .map((row) => Number(row.layer_number))
  );
  const layerStatuses = pipelineDefinitions.map((_, index) => {
    const layerNumber = index + 1;
    if (completedLayerNumbers.has(layerNumber)) {
      return "completed";
    }
    if (runningRow && Number(runningRow.layer_number) === layerNumber) {
      return "running";
    }
    if (run.status === "aborted" && index === highestStartedIndex) {
      return "aborted";
    }
    if (run.status === "failed" && index === highestStartedIndex) {
      return "failed";
    }
    return "paused";
  });
  const activeLayerIndex =
    run.status === "completed"
      ? highestStartedIndex
      : run.status === "queued"
        ? -1
        : runningRow
          ? Number(runningRow.layer_number) - 1
          : highestStartedIndex;

  const failurePayload = failureResult.rows[0]?.event_payload || null;

  return {
    jobId,
    status: run.status,
    activeLayerIndex,
    tokenRows,
    totalTokens: tokenRows.reduce((sum, value) => sum + value, 0),
    generationIds,
    layerStatuses,
    error: failurePayload?.message || "",
    errorCategory: failurePayload?.category || "",
    errorRetryable: failurePayload?.retryable !== false,
    failedLayerNumber: failurePayload?.layer_number ?? null,
    layers: pipelineLayerNames,
    restoredFromDb: true,
  };
};

const executePipelineLayer = async ({
  job,
  layer,
  inputJson,
  media,
  sourceRefs,
  assessmentUnitId = null,
  parentGenerationId = null,
  dependencies = [],
  forceRegenerate = false,
  modelOverrideId = null,
}) => {
  const { modelId, modelName } = await resolveLayerModelSelection(layer.layerNumber, modelOverrideId);
  const cacheKey = createCacheKey(
    {
      inputJson,
      promptVersion: layer.promptVersion,
      modelName,
      assessmentUnitId,
    },
    layer.layerNumber
  );
  const sourceHash = createCacheKey(inputJson, layer.layerNumber);

  const cached = forceRegenerate
    ? null
    : await getCachedLayerResult({
        layerNumber: layer.layerNumber,
        promptVersion: layer.promptVersion,
        modelName,
        cacheKey,
        assessmentUnitId,
      });

  if (cached) {
    try {
      const normalizedCachedOutput = layer.normalizeContract
        ? layer.normalizeContract(cached.output_json, {
            assessmentUnitId,
            inputContract: inputJson,
            sourceRefs,
          })
        : cached.output_json;
      layer.validateContract?.(cached.output_json, {
        assessmentUnitId,
        inputContract: inputJson,
        sourceRefs,
      });
      await recordPipelineRunLayer({
        jobId: job.jobId,
        generationId: cached.generation_id,
        layer,
        sourceSectionId: sourceRefs.sourceSectionId,
        assessmentUnitId,
        promptVersion: layer.promptVersion,
        modelName,
        status: "completed",
        isCached: true,
        usage: { inputTokens: 0, outputTokens: 0 },
        openAiResponseId: null,
      });

      return {
        generationId: cached.generation_id,
        parsed: normalizedCachedOutput,
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        model: modelName,
        cached: true,
      };
    } catch {
      // Ignore stale invalid cache entries and regenerate a strict contract.
    }
  }

  const generationId = await createGenerationAndRun({
    jobId: job.jobId,
    layer,
    userId: job.userId,
    ...sourceRefs,
    assessmentUnitId,
    parentGenerationId,
    dependencies,
    inputJson,
    promptVersion: layer.promptVersion,
    modelName,
    cacheKey,
    sourceHash,
  });

  job.currentGenerationId = generationId;

  const userPrompt = layer.buildUserPrompt({ inputContract: inputJson });

  let parsed;
  let usage;
  let model;
  let responseId;
  let lastValidationError = "";

  const maxAttempts = layer.layerNumber === 1 ? LAYER1_MAX_ATTEMPTS : 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const promptForAttempt =
      attempt === 1
        ? userPrompt
        : buildValidationRetryPrompt(userPrompt, lastValidationError, attempt);
    const contentForAttempt = layer.buildUserContent
      ? layer.buildUserContent({
          inputContract: inputJson,
          userPrompt: promptForAttempt,
          media,
        })
      : promptForAttempt;

    const completion = await createStructuredCompletion({
      systemPrompt: resolveLayerSystemPrompt(layer, inputJson),
      userPrompt: promptForAttempt,
      userContent: contentForAttempt,
      responseFormatName: layer.responseFormatName,
      signal: job.abortController.signal,
      modelName,
      modelId,
    });

    parsed = completion.parsed;
    usage = completion.usage;
    model = completion.model;
    responseId = completion.responseId;

    if (layer.normalizeContract) {
      parsed = layer.normalizeContract(parsed, {
        assessmentUnitId,
        inputContract: inputJson,
        sourceRefs,
      });
    }

    try {
      layer.validateContract?.(parsed, {
        assessmentUnitId,
        inputContract: inputJson,
        sourceRefs,
      });
      lastValidationError = "";
      break;
    } catch (error) {
      lastValidationError = error.message;
      if (attempt === maxAttempts) {
        throw error;
      }
    }
  }

  await withTransaction(async (db) => {
    await finalizeGeneration({
      db,
      jobId: job.jobId,
      generationId,
      layer,
      ...sourceRefs,
      assessmentUnitId,
      parentGenerationId,
      outputJson: parsed,
      usage,
      modelName: model,
      openAiResponseId: responseId,
      userId: job.userId,
      promptVersion: layer.promptVersion,
      cacheKey,
      sourceHash,
    });

    await layer.persistContract({
      db,
      generationId,
      sourceSectionId: sourceRefs.sourceSectionId,
      fkMstChapterId: sourceRefs.fkMstChapterId,
      assessmentUnitId,
      parsed,
      inputContext: inputJson,
    });

    if (layer.layerNumber === 1) {
      await persistSourceParseVersion({
        db,
        jobId: job.jobId,
        generationId,
        sourceSectionId: sourceRefs.sourceSectionId,
        inputJson,
        outputJson: parsed,
      });
    }
  });

  await recordPipelineRunLayer({
    jobId: job.jobId,
    generationId,
    layer,
    sourceSectionId: sourceRefs.sourceSectionId,
    assessmentUnitId,
    promptVersion: layer.promptVersion,
    modelName: model,
    status: "completed",
    isCached: false,
    usage,
    openAiResponseId: responseId,
  });

  if (assessmentUnitId && layer.layerNumber >= 2) {
    await recordLayerGenerationVersion({
      assessmentUnitId,
      layerNumber: layer.layerNumber,
      generationId,
      jobId: job.jobId,
      userId: job.userId,
      usage,
    });
  }

  return {
    generationId,
    parsed,
    usage,
    model,
    cached: false,
  };
};

const runPipelineJob = async (job) => {
  try {
    await updatePipelineRun({
      jobId: job.jobId,
      status: "running",
    });

    const sourceRefs = await withTransaction(async (db) => {
      const refs = await createSourceRecords(db, job.payload, job.userId);
      await persistSourceArtifacts(db, job.payload, refs);
      return refs;
    });

    job.sourceRefs = sourceRefs;
    await updatePipelineRun({
      jobId: job.jobId,
      status: "running",
      sourceDocumentId: sourceRefs.sourceDocumentId,
      sourceSectionId: sourceRefs.sourceSectionId,
      fkMstChapterId: sourceRefs.fkMstChapterId,
    });
    const layer1Input = await buildLayer1InputContract({
      payload: job.payload,
      sourceRefs,
    });
    const assessmentUnitState = {};

    const layer1 = pipelineDefinitions[0];
    job.status = "running";
    job.activeLayerIndex = 0;
    job.generationIds[0] = [];

    const layer1Result = await executePipelineLayer({
      job,
      layer: layer1,
      inputJson: layer1Input,
      media: {
        sectionImageDataUrl: job.payload.sectionImageDataUrl || null,
      },
      sourceRefs,
    });

    job.generationIds[0].push(layer1Result.generationId);
    job.tokenRows[0] += layer1Result.usage.totalTokens;
    job.totalTokens = job.tokenRows.reduce((sum, value) => sum + value, 0);

    const assessmentUnitIds = await getAssessmentUnitsForSourceSection(
      sourceRefs.sourceSectionId
    );

    for (const assessmentUnitId of assessmentUnitIds) {
      assessmentUnitState[assessmentUnitId] = { 1: layer1Result.generationId };
    }

    for (let index = 1; index < job.targetLayerNumber; index += 1) {
      if (job.abortController.signal.aborted) {
        job.status = "aborted";
        break;
      }

      const layer = pipelineDefinitions[index];
      job.status = "running";
      job.activeLayerIndex = index;
      job.generationIds[index] = [];

      for (const assessmentUnitId of assessmentUnitIds) {
        if (job.abortController.signal.aborted) {
          job.status = "aborted";
          break;
        }

        const layerContext = await buildAssessmentUnitLayerContext({
          layerNumber: layer.layerNumber,
          assessmentUnitId,
        });

        if (!layerContext) {
          continue;
        }

        const dependencies = getAssessmentUnitDependencies({
          assessmentUnitId,
          assessmentUnitState,
          layerNumber: layer.layerNumber,
        });
        const parentGenerationId =
          dependencies[dependencies.length - 1]?.generationId ||
          assessmentUnitState[assessmentUnitId]?.[layer.layerNumber - 1] ||
          layer1Result.generationId;

        const layerResult = await executePipelineLayer({
          job,
          layer,
          inputJson: layerContext,
          sourceRefs,
          assessmentUnitId,
          parentGenerationId,
          dependencies,
        });

        assessmentUnitState[assessmentUnitId][layer.layerNumber] =
          layerResult.generationId;
        job.generationIds[index].push(layerResult.generationId);
        job.tokenRows[index] += layerResult.usage.totalTokens;
        job.totalTokens = job.tokenRows.reduce((sum, value) => sum + value, 0);
      }
    }

    if (job.status !== "aborted") {
      job.status = "completed";
      job.activeLayerIndex = job.targetLayerNumber - 1;
      await updatePipelineRun({
        jobId: job.jobId,
        status: "completed",
      });

      await recordContentUpdateEvent({ job, sourceRefs });
    }
  } catch (error) {
    if (job.abortController.signal.aborted) {
      job.status = "aborted";
      await updatePipelineRun({
        jobId: job.jobId,
        status: "aborted",
      });
      return;
    }

    const failure = classifyPipelineFailure(error);
    job.status = "failed";
    job.error = failure.message;
    job.errorCategory = failure.category;
    job.errorRetryable = failure.retryable;
    job.failedLayerNumber = job.activeLayerIndex >= 0 ? job.activeLayerIndex + 1 : null;
    await updatePipelineRun({
      jobId: job.jobId,
      status: "failed",
    });

    const failedGenerationId = job.currentGenerationId;
    if (failedGenerationId) {
      await failGeneration(failedGenerationId, failure.message, job.jobId, {
        category: failure.category,
        retryable: failure.retryable,
        layerNumber: job.failedLayerNumber,
      });
    }
  }
};

export const startAssessmentStudioPipeline = async ({ payload, userId }) => {
  if (!isOpenAiConfigured()) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const jobId = crypto.randomUUID();
  const targetLayerNumber = normalizeTargetLayerNumber(payload.targetLayerNumber);
  const job = {
    jobId,
    payload,
    userId,
    targetLayerNumber,
    status: "queued",
    activeLayerIndex: -1,
    tokenRows: pipelineDefinitions.map(() => 0),
    totalTokens: 0,
    generationIds: [],
    currentGenerationId: null,
    abortController: new AbortController(),
    error: "",
    errorCategory: "",
    errorRetryable: true,
    failedLayerNumber: null,
  };

  await createPipelineRun({
    jobId,
    payload,
    userId,
  });

  jobs.set(jobId, job);
  runGated(() => runPipelineJob(job));

  return {
    jobId,
    status: job.status,
    targetLayerNumber,
  };
};

export const getAssessmentStudioPipelineStatus = async (jobId) => {
  const job = jobs.get(jobId);
  if (!job) {
    return getPersistedPipelineStatus(jobId);
  }

  return {
    jobId: job.jobId,
    status: job.status,
    activeLayerIndex: job.activeLayerIndex,
    tokenRows: job.tokenRows,
    totalTokens: job.totalTokens,
    generationIds: job.generationIds,
    layerStatuses: buildLiveLayerStatuses(job),
    targetLayerNumber: job.targetLayerNumber,
    error: job.error,
    errorCategory: job.errorCategory || "",
    errorRetryable: job.errorRetryable !== false,
    failedLayerNumber: job.failedLayerNumber ?? null,
    layers: pipelineLayerNames,
    restoredFromDb: false,
  };
};

export const getAssessmentStudioPipelineConcurrency = () => getConcurrencyStats();

export const getAssessmentStudioPipelineStatusBatch = async (jobIds = []) => {
  const uniqueJobIds = [...new Set(jobIds.filter(Boolean))];
  const results = await Promise.all(
    uniqueJobIds.map(async (jobId) => {
      try {
        const status = await getAssessmentStudioPipelineStatus(jobId);
        return status ? { jobId, ...status } : { jobId, status: "not_found" };
      } catch (error) {
        return { jobId, status: "not_found", error: error.message };
      }
    })
  );

  return { jobs: results };
};

export const getAssessmentStudioPipelineNavigator = async (jobId = null) => {
  const currentResult = jobId
    ? await pool.query(
        `
          SELECT
            id,
            job_id,
            request_payload,
            status,
            created_at,
            updated_at
          FROM assessment_pipeline_run
          WHERE job_id = $1
          LIMIT 1
        `,
        [jobId]
      )
    : await pool.query(
        `
          SELECT
            id,
            job_id,
            request_payload,
            status,
            created_at,
            updated_at
          FROM assessment_pipeline_run
          ORDER BY created_at DESC, id DESC
          LIMIT 1
        `
      );

  const current = currentResult.rows[0];
  if (!current) {
    return null;
  }

  const [previousResult, nextResult] = await Promise.all([
    pool.query(
      `
        SELECT job_id
        FROM assessment_pipeline_run
        WHERE created_at < $1
           OR (created_at = $1 AND id < $2)
        ORDER BY created_at DESC, id DESC
        LIMIT 1
      `,
      [current.created_at, current.id]
    ),
    pool.query(
      `
        SELECT job_id
        FROM assessment_pipeline_run
        WHERE created_at > $1
           OR (created_at = $1 AND id > $2)
        ORDER BY created_at ASC, id ASC
        LIMIT 1
      `,
      [current.created_at, current.id]
    ),
  ]);

  const requestPayload =
    current.request_payload && typeof current.request_payload === "object"
      ? current.request_payload
      : {};

  return {
    current: {
      jobId: current.job_id,
      requestPayload,
      status: current.status,
      createdAt: current.created_at,
      updatedAt: current.updated_at,
    },
    previousJobId: previousResult.rows[0]?.job_id || null,
    nextJobId: nextResult.rows[0]?.job_id || null,
  };
};

export const abortAssessmentStudioPipeline = (jobId) => {
  const job = jobs.get(jobId);
  if (!job) {
    return null;
  }

  job.abortController.abort();
  job.status = "aborted";
  updatePipelineRun({
    jobId: job.jobId,
    status: "aborted",
  }).catch(() => {});

  return {
    jobId: job.jobId,
    status: job.status,
  };
};

// ---------------------------------------------------------------------------
// Pipeline run management: list completed runs, delete a run, re-run one layer.
// ---------------------------------------------------------------------------

// Tables that carry a generation_id and must be cleared before their parent
// generation_registry rows can be removed. Children (rows that reference a
// layerN parent row) are listed first so intra-layer FKs resolve cleanly.
export const GENERATION_CHILD_TABLES = [
  "layer1_structure_part",
  "layer1_process_input",
  "layer1_process_output",
  "layer1_process_step",
  "layer1_stage_sequence_stage",
  "layer1_comparison_difference",
  "layer1_comparison_similarity",
  "layer1_classification_group",
  "layer1_diagram_label",
  "layer1_diagram_tested_label",
  "layer1_terminology_related_concept",
  "layer2_concept_memory_supporting_concept",
  "layer2_concept_memory_retrieval_cue",
  "layer2_concept_memory_associated_concept",
  "layer6_assessment_item_option",
  "layer6_assessment_item_acceptable_answer",
  "layer7_distractor_analysis",
  "layer7_progressive_hint",
  "layer7_misconception_feedback",
  "layer7_adaptive_remediation",
  "assessment_unit_supporting_concept",
  "assessment_unit_dependency",
  "concept_alias",
];

export const GENERATION_PARENT_TABLES = [
  "layer1_core_concept",
  "layer1_structure",
  "layer1_function",
  "layer1_process",
  "layer1_stage_sequence",
  "layer1_cause_effect",
  "layer1_relationship",
  "layer1_comparison",
  "layer1_classification",
  "layer1_diagram",
  "layer1_terminology",
  "layer1_exception",
  "layer1_common_misconception",
  "layer1_memory_hook",
  "layer1_question_pattern",
  "layer1_assessment_unit",
  "layer1_knowledge_contract",
  "layer2_concept_memory",
  "layer2_concept_memory_contract",
  "layer3_assessment_capability_contract",
  "layer4_assessment_strategy_contract",
  "layer5_item_blueprint",
  "layer5_item_blueprint_contract",
  "layer6_assessment_item",
  "layer6_assessment_item_contract",
  "layer7_learning_support",
  "layer7_learning_support_contract",
  "concept",
];

// Nullable back-references from downstream/consumer tables into
// generation_registry. These are RESTRICT/SET NULL and would otherwise block
// deleting a generation, so they are cleared first.
export const GENERATION_BACKREF_UPDATES = [
  "UPDATE layer_run SET parent_generation_id = NULL WHERE parent_generation_id = ANY($1)",
  "UPDATE layer_input_contract SET parent_generation_id = NULL WHERE parent_generation_id = ANY($1)",
  "UPDATE layer_output_contract SET parent_generation_id = NULL WHERE parent_generation_id = ANY($1)",
  "UPDATE question_bank_item SET generation_id = NULL WHERE generation_id = ANY($1)",
  "UPDATE question_bank_item_version SET generation_id = NULL WHERE generation_id = ANY($1)",
  "UPDATE student_response SET generation_id = NULL WHERE generation_id = ANY($1)",
  "UPDATE student_mastery SET last_generation_id = NULL WHERE last_generation_id = ANY($1)",
];

// Fully removes every persisted artifact tied to the supplied generation ids,
// including the generation_registry rows themselves. Layer output/input/run
// rows cascade automatically from generation_registry. Safe to call for a whole
// run's generations or for just one layer's generations.
const cascadeDeleteGenerations = async (client, generationIds) => {
  if (!generationIds.length) {
    return;
  }

  const params = [generationIds];

  for (const sql of GENERATION_BACKREF_UPDATES) {
    await client.query(sql, params);
  }

  await client.query(
    "DELETE FROM source_parse_version WHERE generation_id = ANY($1)",
    params
  );
  await client.query(
    "DELETE FROM layer_contract_dependency WHERE generation_id = ANY($1) OR depends_on_generation_id = ANY($1)",
    params
  );

  for (const table of GENERATION_CHILD_TABLES) {
    await client.query(`DELETE FROM ${table} WHERE generation_id = ANY($1)`, params);
  }

  for (const table of GENERATION_PARENT_TABLES) {
    await client.query(`DELETE FROM ${table} WHERE generation_id = ANY($1)`, params);
  }

  // assessment_unit master rows created by these generations (layer 1 owns them).
  await client.query(
    "DELETE FROM assessment_unit WHERE generation_id = ANY($1)",
    params
  );

  await client.query(
    "DELETE FROM generation_registry WHERE generation_id = ANY($1)",
    params
  );
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const getPipelineRunRow = async (jobId) => {
  if (!UUID_PATTERN.test(String(jobId || ""))) {
    return null;
  }

  const result = await pool.query(
    `
      SELECT
        job_id,
        source_document_id,
        source_section_id,
        fk_mst_chapter_id,
        request_payload,
        status
      FROM assessment_pipeline_run
      WHERE job_id = $1
      LIMIT 1
    `,
    [jobId]
  );

  return result.rows[0] || null;
};

export const listCompletedAssessmentStudioRuns = async () => {
  const runsResult = await pool.query(
    `
      SELECT
        r.job_id,
        r.status,
        r.request_payload,
        r.created_at,
        r.updated_at,
        d.subject_name,
        d.class_name,
        d.chapter_name
      FROM assessment_pipeline_run r
      LEFT JOIN source_document d ON d.id = r.source_document_id
      WHERE r.status = 'completed'
      ORDER BY r.updated_at DESC, r.id DESC
    `
  );

  const jobIds = runsResult.rows.map((row) => row.job_id);

  const layerAggregates = new Map();
  if (jobIds.length) {
    const layersResult = await pool.query(
      `
        SELECT
          arl.job_id,
          arl.layer_number,
          MAX(arl.layer_name) AS layer_name,
          BOOL_OR(arl.status = 'completed') AS has_completed,
          COALESCE(SUM(arl.token_input + arl.token_output), 0) AS tokens
        FROM assessment_pipeline_run_layer arl
        LEFT JOIN layer_generation_version lgv ON lgv.generation_id = arl.generation_id
        WHERE arl.job_id = ANY($1)
          AND (
            arl.layer_number = 1
            OR lgv.is_selected IS TRUE
            OR lgv.generation_id IS NULL
          )
        GROUP BY arl.job_id, arl.layer_number
      `,
      [jobIds]
    );

    for (const row of layersResult.rows) {
      if (!layerAggregates.has(row.job_id)) {
        layerAggregates.set(row.job_id, new Map());
      }
      layerAggregates.get(row.job_id).set(Number(row.layer_number), {
        completed: row.has_completed,
        tokens: Number(row.tokens || 0),
      });
    }
  }

  return {
    layers: pipelineLayerNames,
    runs: runsResult.rows.map((row) => {
      const payload =
        row.request_payload && typeof row.request_payload === "object"
          ? row.request_payload
          : {};
      const byLayer = layerAggregates.get(row.job_id) || new Map();

      const layerStatuses = pipelineDefinitions.map((_, index) => {
        const agg = byLayer.get(index + 1);
        return agg?.completed ? "completed" : "paused";
      });
      const tokenRows = pipelineDefinitions.map((_, index) => {
        const agg = byLayer.get(index + 1);
        return agg?.tokens || 0;
      });

      return {
        jobId: row.job_id,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        subject: row.subject_name || payload.subject || "",
        className: row.class_name || payload.className || "",
        chapter: row.chapter_name || payload.chapter || "",
        chapterKey: payload.chapterKey || "",
        sectionNumber: payload.sectionNumber || "",
        practiceType: payload.practiceType || "",
        targetDifficulty: payload.targetDifficulty || "",
        targetLayerNumber: normalizeTargetLayerNumber(payload.targetLayerNumber),
        layerStatuses,
        tokenRows,
        totalTokens: tokenRows.reduce((sum, value) => sum + value, 0),
      };
    }),
  };
};

export const deleteAssessmentStudioPipelineRun = async (jobId) => {
  const run = await getPipelineRunRow(jobId);
  if (!run) {
    return null;
  }

  if (run.status === "running" || run.status === "queued") {
    const activeJob = jobs.get(jobId);
    if (activeJob) {
      activeJob.abortController.abort();
    }
    const error = new Error("Cannot delete a pipeline run while it is still running.");
    error.statusCode = 409;
    throw error;
  }

  const generationsResult = await pool.query(
    "SELECT generation_id FROM generation_registry WHERE pipeline_job_id = $1",
    [jobId]
  );
  const generationIds = generationsResult.rows.map((row) => row.generation_id);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await cascadeDeleteGenerations(client, generationIds);
    // Remove any parse versions still tied to the run by job id (generation null).
    await client.query(
      "DELETE FROM source_parse_version WHERE pipeline_job_id = $1",
      [jobId]
    );
    // assessment_pipeline_run_layer cascades from the run delete.
    await client.query("DELETE FROM assessment_pipeline_run WHERE job_id = $1", [jobId]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  jobs.delete(jobId);

  return {
    jobId,
    deletedGenerations: generationIds.length,
  };
};

export const rerunAssessmentStudioPipelineLayer = async ({
  jobId,
  layerNumber,
  userId = null,
  modelId = null,
}) => {
  const targetLayer = Number(layerNumber);
  if (!Number.isInteger(targetLayer) || targetLayer < 1 || targetLayer > pipelineDefinitions.length) {
    const error = new Error("Invalid layer number.");
    error.statusCode = 400;
    throw error;
  }

  if (targetLayer === 1) {
    const error = new Error(
      "Layer 1 defines the assessment units for every downstream layer, so it cannot be re-run in isolation. Start a new pipeline run instead."
    );
    error.statusCode = 400;
    throw error;
  }

  if (modelId && !getModelRegistryEntry(modelId)) {
    const error = new Error(`Unknown AI model id: ${modelId}`);
    error.statusCode = 400;
    throw error;
  }

  const run = await getPipelineRunRow(jobId);
  if (!run) {
    return null;
  }

  if (run.status === "running" || run.status === "queued") {
    const error = new Error("Cannot re-run a layer while the pipeline is still running.");
    error.statusCode = 409;
    throw error;
  }

  if (!run.source_section_id) {
    const error = new Error("This run has no source section to rebuild layer context from.");
    error.statusCode = 400;
    throw error;
  }

  if (!isOpenAiConfigured()) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const layer = pipelineDefinitions[targetLayer - 1];
  const sourceRefs = {
    sourceDocumentId: run.source_document_id,
    sourceSectionId: run.source_section_id,
    fkMstChapterId: run.fk_mst_chapter_id,
  };

  const assessmentUnitIds = await getAssessmentUnitsForSourceSection(
    run.source_section_id
  );

  if (!assessmentUnitIds.length) {
    const error = new Error("No assessment units found for this run's source section.");
    error.statusCode = 400;
    throw error;
  }

  // Previous generations for this layer are intentionally left in place: each
  // regenerated assessment unit becomes a NEW version (see
  // recordLayerGenerationVersion, hooked into executePipelineLayer) and is
  // auto-selected as the active one. Nothing else is deleted, so every prior
  // version stays available for side-by-side comparison and can be restored
  // via selectAssessmentStudioLayerVersion.
  const job = {
    jobId,
    userId,
    abortController: new AbortController(),
    currentGenerationId: null,
  };

  const results = [];
  for (const assessmentUnitId of assessmentUnitIds) {
    const layerContext = await buildAssessmentUnitLayerContext({
      layerNumber: targetLayer,
      assessmentUnitId,
    });

    if (!layerContext) {
      continue;
    }

    const layerResult = await executePipelineLayer({
      job,
      layer,
      inputJson: layerContext,
      sourceRefs,
      assessmentUnitId,
      forceRegenerate: true,
      modelOverrideId: modelId,
    });

    results.push({
      assessmentUnitId,
      generationId: layerResult.generationId,
      tokens: layerResult.usage?.totalTokens || 0,
      modelName: layerResult.model,
    });
  }

  await updatePipelineRun({ jobId, status: "completed" });

  return {
    jobId,
    layerNumber: targetLayer,
    layerName: layer.layerName,
    regeneratedUnits: results.length,
    totalTokens: results.reduce((sum, item) => sum + item.tokens, 0),
    modelName: results[0]?.modelName || null,
  };
};

// ---------------------------------------------------------------------------
// Layer version history: list every version generated for a run's layer (one
// list per assessment unit) with full output JSON for side-by-side compare,
// and let the user pick which version is "live" for downstream layers.
// ---------------------------------------------------------------------------

export const listAssessmentStudioLayerVersions = async ({ jobId, layerNumber }) => {
  const targetLayer = Number(layerNumber);
  if (!Number.isInteger(targetLayer) || targetLayer < 1 || targetLayer > pipelineDefinitions.length) {
    const error = new Error("Invalid layer number.");
    error.statusCode = 400;
    throw error;
  }

  const run = await getPipelineRunRow(jobId);
  if (!run) {
    return null;
  }

  const layer = pipelineDefinitions[targetLayer - 1];

  if (targetLayer === 1 || !run.source_section_id) {
    return { jobId, layerNumber: targetLayer, layerName: layer.layerName, assessmentUnits: [] };
  }

  const assessmentUnitIds = await getAssessmentUnitsForSourceSection(run.source_section_id);
  if (!assessmentUnitIds.length) {
    return { jobId, layerNumber: targetLayer, layerName: layer.layerName, assessmentUnits: [] };
  }

  const versionsResult = await pool.query(
    `
      SELECT
        lgv.assessment_unit_id,
        lgv.generation_id,
        lgv.version_number,
        lgv.is_selected,
        lgv.token_input,
        lgv.token_output,
        lgv.created_at,
        gr.model_name,
        gr.status,
        loc.output_json
      FROM layer_generation_version lgv
      INNER JOIN generation_registry gr ON gr.generation_id = lgv.generation_id
      LEFT JOIN layer_output_contract loc ON loc.generation_id = lgv.generation_id
      WHERE lgv.assessment_unit_id = ANY($1) AND lgv.layer_number = $2
      ORDER BY lgv.assessment_unit_id ASC, lgv.version_number ASC
    `,
    [assessmentUnitIds, targetLayer]
  );

  const grouped = new Map();
  for (const row of versionsResult.rows) {
    if (!grouped.has(row.assessment_unit_id)) {
      grouped.set(row.assessment_unit_id, []);
    }
    grouped.get(row.assessment_unit_id).push({
      generationId: row.generation_id,
      versionNumber: row.version_number,
      isSelected: row.is_selected,
      status: row.status,
      modelName: row.model_name,
      tokenInput: Number(row.token_input || 0),
      tokenOutput: Number(row.token_output || 0),
      totalTokens: Number(row.token_input || 0) + Number(row.token_output || 0),
      createdAt: row.created_at,
      outputJson: row.output_json || null,
    });
  }

  return {
    jobId,
    layerNumber: targetLayer,
    layerName: layer.layerName,
    assessmentUnits: assessmentUnitIds.map((assessmentUnitId) => ({
      assessmentUnitId,
      versions: grouped.get(assessmentUnitId) || [],
    })),
  };
};

export const selectAssessmentStudioLayerVersion = async ({
  assessmentUnitId,
  layerNumber,
  generationId,
}) => {
  const targetLayer = Number(layerNumber);
  if (!Number.isInteger(targetLayer) || targetLayer < 2 || targetLayer > pipelineDefinitions.length) {
    const error = new Error("Invalid layer number.");
    error.statusCode = 400;
    throw error;
  }

  const versionResult = await pool.query(
    `
      SELECT id
      FROM layer_generation_version
      WHERE assessment_unit_id = $1 AND layer_number = $2 AND generation_id = $3
      LIMIT 1
    `,
    [assessmentUnitId, targetLayer, generationId]
  );

  if (!versionResult.rows[0]) {
    return null;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `
        UPDATE layer_generation_version
        SET is_selected = FALSE
        WHERE assessment_unit_id = $1 AND layer_number = $2 AND is_selected = TRUE
      `,
      [assessmentUnitId, targetLayer]
    );
    await client.query(
      `
        UPDATE layer_generation_version
        SET is_selected = TRUE
        WHERE id = $1
      `,
      [versionResult.rows[0].id]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return { assessmentUnitId, layerNumber: targetLayer, generationId };
};

