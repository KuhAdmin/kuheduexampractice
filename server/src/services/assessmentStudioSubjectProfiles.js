// Subject family profiles for the 7-layer assessment pipeline.
//
// Layer 1's knowledge-extraction prompt was originally biology-only. The output
// schema (16 dimension arrays + assessment_units) is generic, so instead of a
// prompt-per-subject we keep ONE holistic prompt skeleton (in
// assessmentStudioService.js) and inject subject-family-specific pieces from
// here: the engine label, the assessment-unit id prefix, allowed concept
// categories, per-dimension guidance, family "hard rules", question-pattern
// examples, and flags that gate the biology-specific semantic validators.
//
// A "family" groups subjects that share extraction semantics (e.g. Physics and
// Chemistry both live in `physical-science`). Adding a new subject is usually
// just a new entry in SUBJECT_FAMILY_MAP; unknown codes fall back to `general`.

// The seven categories that exist in the DB-agnostic base contract. Families may
// extend this list (concept_category is a free VARCHAR, so new values are safe).
const BASE_CONCEPT_CATEGORIES = [
  "Structure",
  "Function",
  "Process",
  "Relationship",
  "Principle",
  "Classification",
  "Terminology",
];

// Biology hard-rules text, preserved VERBATIM from the original Layer 1 prompt
// (assessmentStudioService.js lines ~1887-1916) so biology behavior is unchanged.
const BIOLOGY_HARD_RULES = `- Do not create separate assessment units for list members such as kingdom, phylum, class, order, family, genus, and species when they belong to one hierarchy objective.
- If a hierarchy is taught as a sequence, create one assessment unit for interpreting or ordering the hierarchy. Put individual hierarchy members in stages_sequences or supporting_concepts, not as separate assessment units.
- Do not create separate assessment units for examples such as insects or evidence such as three pairs of jointed legs; attach examples to the broader learning objective in supporting_concepts, classifications, relationships, or comparisons instead.
- Example framing such as "insects as a recognisable group" is not an assessment unit. The assessment unit should be the broader objective, for example "recognition of taxonomic groups using shared characters".
- Observable facts such as "three pairs of jointed legs", "species is the lowest category", or "division is equivalent to phylum for plants" are not assessment units by themselves. They must support broader objectives such as group recognition, hierarchy interpretation, or taxonomic rank relationships.
- Do not fragment tightly related terminology into separate assessment units. Terms taught as one relationship, such as taxonomic category, rank, taxon, taxa, and unit of classification, must be merged into one broader terminology relationship objective.
- "structures" is only for physical biological structures or anatomical/morphological parts. Do not put conceptual systems such as taxonomic hierarchy, classification hierarchy, categories, ranks, or arrangements in "structures"; put them in stages_sequences, classifications, relationships, terminology, or assessment_units as appropriate.
- "functions" is only for biological functions of real biological entities, structures, molecules, organs, or systems. Do not put educational principles such as "knowledge of characters helps classification" or "comparison of similarities and dissimilarities supports classification" in "functions"; put them in processes, cause_effect, relationships, comparisons, or assessment_units as principles.
- For taxonomy or classification hierarchy content, question_patterns must include hierarchy-completion, table-completion, odd-one-out, and taxonomy-tree-interpretation when supported by the source.
- "concept_category" must always be one of the seven allowed values (Structure, Function, Process, Relationship, Principle, Classification, Terminology). There is no "Hierarchy" or "Taxonomy" category: assessment units about taxonomic hierarchy, rank order, category-taxon relationships, or classification systems must use "Classification". Never invent a category value outside the allowed list.
- For sections about a taxonomic rank (genus, family, order, class, phylum/division, kingdom) that are mostly made up of example genera/species (e.g. Solanum, Panthera, Felis; potato, brinjal, lion, tiger, leopard), create ONE assessment unit for the definition/principle of that rank, for example "Genus as a group of closely related species sharing more characters with each other than with other genera". Keep the example genus and species names out of primary_concept; put them in supporting_concepts or classifications instead. Do not use phrases such as "such as", "example of", or a bare genus/species name as primary_concept.`;

const BIOLOGY_PRIMARY_CONCEPT_EXAMPLES = `- Good primary_concept examples: "Standard taxonomic hierarchy", "Species as lowest taxonomic category", "Category-rank-taxon relationship", "Characters as classification basis", "Genus as a group of closely related species".
- Bad primary_concept examples (example genus/species promoted into the objective): "Solanum genus of potato and brinjal", "Panthera as example of a genus", "Genus such as Panthera and Felis".
- Good learning_objective examples: "Interpret the order of the standard taxonomic hierarchy.", "Apply species as the lowest category in plant and animal examples.", "Justify taxonomic grouping using shared characters.", "Classify species into a genus using shared characters."`;

const BIOLOGY_QUESTION_PATTERN_EXAMPLES = `- Good question_patterns examples: "hierarchy-completion", "table-completion", "odd-one-out", "taxonomy-tree-interpretation", "classification-justification", "term-relationship-mapping", "example-to-principle-transfer".
- Bad question_patterns examples: "Explain how categories are arranged", "Identify the lowest taxonomic category", "What is a taxon?", "Arrange kingdom to species".`;

// All biology validators ON. Every other family turns the biology-specific ones
// OFF so non-biology content is not rejected for "not being a physical
// biological structure" etc. Generic guards (fragmentation-by-count, dependency
// graph, question-pattern-is-a-slug) stay ON for all families.
const BIOLOGY_VALIDATORS = {
  taxonomyPatterns: true,
  structureMisclassification: true,
  functionMisclassification: true,
  relationshipAsComparison: true,
  reminderMemoryHook: true,
  hierarchyFragmentation: true,
  terminologyFragmentation: true,
};

const GENERIC_VALIDATORS = {
  taxonomyPatterns: false,
  structureMisclassification: false,
  functionMisclassification: false,
  relationshipAsComparison: false,
  reminderMemoryHook: false,
  hierarchyFragmentation: false,
  terminologyFragmentation: false,
};

const FAMILY_PROFILES = {
  biology: {
    familyId: "biology",
    conceptCategories: BASE_CONCEPT_CATEGORIES,
    dimensionGuidance: `- "structures" = physical biological structures and anatomical/morphological parts.
- "functions" = biological functions of real biological entities, structures, molecules, organs, or systems.
- "processes" = biological processes and mechanisms (e.g. respiration, transport, reproduction).
- "diagrams" = labelled biological diagrams and specimens when the source has them.`,
    hardRules: BIOLOGY_HARD_RULES,
    primaryConceptExamples: BIOLOGY_PRIMARY_CONCEPT_EXAMPLES,
    questionPatternExamples: BIOLOGY_QUESTION_PATTERN_EXAMPLES,
    validators: BIOLOGY_VALIDATORS,
  },

  "physical-science": {
    familyId: "physical-science",
    conceptCategories: [...BASE_CONCEPT_CATEGORIES, "Law", "Quantity"],
    dimensionGuidance: `- "structures" = physical or molecular/atomic structures (apparatus, molecular geometry, circuit-free physical arrangements).
- "functions" = the role a physical/chemical entity plays; leave empty if the concept is a law or quantity rather than an entity with a function.
- "processes" = derivations, reactions, mechanisms, and experimental procedures.
- "relationships" = quantitative or formula relationships between quantities (use relationship_type "proportionality" or "equivalence" for laws such as V=IR), and conceptual links.
- "classifications" = groupings such as periodic families, compound classes, or force types.
- "cause_effect" = physical/chemical causality.
- "diagrams" = ray/force/free-body diagrams, apparatus setups, circuit schematics, and molecular/structural or titration-setup diagrams when the source has them -- do not leave this empty just because the subject is not electronics/graphics.`,
    hardRules: `- Treat formulas and laws as "relationships" (relationship_summary states the law in words), not as free-floating facts.
- Do not fragment a single derivation or reaction mechanism into one assessment unit per step; make one objective for applying/deriving it and keep the steps in stages_sequences.
- Numerical problem-solving objectives are valid assessment units (e.g. "Apply the kinematics equations to compute displacement").`,
    primaryConceptExamples: `- Good primary_concept examples: "Ohm's law", "Newton's second law", "Rate of a first-order reaction", "Electric field of a point charge".
- Good learning_objective examples: "Apply Ohm's law to series and parallel circuits.", "Derive the equation of motion for uniform acceleration.", "Predict reaction feasibility using Gibbs free energy."`,
    questionPatternExamples: `- Good question_patterns examples: "numerical-computation", "formula-application", "derivation-completion", "graph-interpretation", "unit-dimensional-analysis", "reaction-prediction", "concept-justification".
- Bad question_patterns examples: "Calculate the current in the circuit", "What is Ohm's law?", "Solve for acceleration".`,
    validators: GENERIC_VALIDATORS,
  },

  mathematics: {
    familyId: "mathematics",
    conceptCategories: [...BASE_CONCEPT_CATEGORIES, "Procedure", "Theorem"],
    dimensionGuidance: `- "functions" = mathematical functions and their properties (NOT biological functions); leave empty when the section is not about functions.
- "structures" = mathematical objects/structures (sets, matrices, geometric figures); usually sparse.
- "processes" and "stages_sequences" = solution procedures, algorithms, and proof steps.
- "relationships" = theorems, identities, and formula relationships (relationship_type "equivalence" or "usage").
- "cause_effect" = implications (if-then results, conditions -> conclusions).
- "diagrams" = function/graph plots, geometric figures, and coordinate-plane diagrams when the source has them -- do not leave this empty just because the subject is not graphics.`,
    hardRules: `- Treat theorems, identities, and formulas as "relationships" (relationship_summary states them in words), and treat solution methods as one "processes" or "stages_sequences" entry, not one assessment unit per step.
- A worked-example type is not an assessment unit; the assessment unit is the general method or theorem it illustrates.
- Numerical and algebraic problem-solving objectives are valid assessment units.`,
    primaryConceptExamples: `- Good primary_concept examples: "Quadratic formula", "Derivative of composite functions", "Pythagorean theorem", "Properties of definite integrals".
- Good learning_objective examples: "Apply the chain rule to differentiate composite functions.", "Justify a result using the Pythagorean theorem.", "Sequence the steps to solve a quadratic by completing the square."`,
    questionPatternExamples: `- Good question_patterns examples: "numerical-computation", "formula-application", "proof-completion", "step-sequencing", "graph-interpretation", "theorem-application", "counterexample-identification".
- Bad question_patterns examples: "Solve the equation", "State the theorem", "Find the derivative".`,
    validators: GENERIC_VALIDATORS,
  },

  computing: {
    familyId: "computing",
    conceptCategories: [...BASE_CONCEPT_CATEGORIES, "Algorithm", "Procedure"],
    dimensionGuidance: `- "structures" = data structures and system/architecture components.
- "processes" = algorithms and computational procedures; "stages_sequences" = execution/control flow and pipeline stages.
- "diagrams" = flowcharts, ER diagrams, architecture diagrams when present.
- "relationships" = mappings such as client-server, class-object, schema relationships (relationship_type "usage" or "part-whole").
- "functions" = the role/responsibility of a component or routine; leave empty when not applicable.`,
    hardRules: `- Treat an algorithm as one "processes" entry and one assessment objective for applying/tracing it; do not make one assessment unit per line of code.
- Code-reading, output-prediction, and debugging objectives are valid assessment units.
- Put syntax details and API names in supporting_concepts or terminology, not as separate assessment units.`,
    primaryConceptExamples: `- Good primary_concept examples: "Binary search algorithm", "Normalization in relational databases", "Client-server request cycle", "Supervised learning workflow".
- Good learning_objective examples: "Trace the execution of binary search on a sorted array.", "Apply normalization to remove redundancy from a schema.", "Predict the output of a loop with nested conditionals."`,
    questionPatternExamples: `- Good question_patterns examples: "output-prediction", "code-tracing", "debug-the-error", "algorithm-step-sequencing", "complexity-analysis", "schema-design", "concept-justification".
- Bad question_patterns examples: "Write a program to sort", "What is a variable?", "Explain the algorithm".`,
    validators: GENERIC_VALIDATORS,
  },

  electronics: {
    familyId: "electronics",
    conceptCategories: [...BASE_CONCEPT_CATEGORIES, "Law", "Quantity"],
    dimensionGuidance: `- "structures" = electronic components and circuits.
- "diagrams" = circuit diagrams and schematics (expect these to be central).
- "cause_effect" = signal/behavioral causality (input -> output behavior).
- "processes" = circuit analysis and construction procedures.
- "relationships" = component/quantity relationships and laws (relationship_type "proportionality").`,
    hardRules: `- Treat a circuit-analysis method as one "processes" entry plus one assessment objective, not one unit per node.
- Numerical circuit-analysis objectives are valid assessment units.
- Put individual component ratings/values in supporting_concepts, not as separate assessment units.`,
    primaryConceptExamples: `- Good primary_concept examples: "Voltage divider rule", "Half-wave rectifier operation", "Logic gate truth tables", "RC time constant".
- Good learning_objective examples: "Apply the voltage divider rule to a resistive network.", "Predict the output waveform of a half-wave rectifier.", "Interpret a logic circuit using its truth table."`,
    questionPatternExamples: `- Good question_patterns examples: "circuit-analysis", "numerical-computation", "waveform-prediction", "truth-table-completion", "schematic-interpretation", "fault-diagnosis".
- Bad question_patterns examples: "Solve the circuit", "What is a resistor?", "Draw the diagram".`,
    validators: GENERIC_VALIDATORS,
  },

  graphics: {
    familyId: "graphics",
    conceptCategories: [...BASE_CONCEPT_CATEGORIES, "Procedure"],
    dimensionGuidance: `- "diagrams" = projections, orthographic/isometric views, and constructions (this dimension is central for this subject).
- "processes" and "stages_sequences" = step-by-step construction/drawing procedures.
- "structures" = geometric solids and features.
- Most other dimensions (functions, cause_effect, memory_hooks) will often be empty; that is expected.`,
    hardRules: `- Treat a drawing/construction method as one "processes" entry and one assessment objective, not one unit per construction line.
- Interpreting and producing views (front/top/side, isometric) are valid assessment objectives.
- This subject is diagram-dominant; do not force content into structures/functions when it belongs in diagrams or processes.`,
    primaryConceptExamples: `- Good primary_concept examples: "Orthographic projection of a solid", "Isometric view construction", "Sectional views", "Development of surfaces".
- Good learning_objective examples: "Construct the orthographic views of a given solid.", "Interpret an isometric drawing into its front and top views.", "Sequence the steps to develop the surface of a cylinder."`,
    questionPatternExamples: `- Good question_patterns examples: "view-construction", "view-interpretation", "step-sequencing", "diagram-labeling", "missing-view-completion".
- Bad question_patterns examples: "Draw the projection", "What is isometric?", "Construct the view".`,
    validators: GENERIC_VALIDATORS,
  },

  "language-arts": {
    familyId: "language-arts",
    conceptCategories: [...BASE_CONCEPT_CATEGORIES, "Grammar Rule", "Literary Device"],
    dimensionGuidance: `- "terminology" = grammar terms, parts of speech, and literary devices (metaphor, simile, alliteration, etc.) with their meanings.
- "structures" = sentence/text structure (clauses, stanza structure, paragraph structure) when explicitly taught; otherwise leave empty.
- "processes" = writing, comprehension, and composition processes (e.g. drafting, summarizing, paraphrasing).
- "stages_sequences" = narrative/plot sequence in a story or poem.
- "cause_effect" = character motivations and their consequences within a narrative.
- "relationships" = character relationships, word relationships (synonym/antonym/word-family), and figure-of-speech-to-meaning mappings.
- "comparisons" = contrasts between characters, themes, poems, or grammatical forms (e.g. active vs passive voice).
- "classifications" = grammatical categories (tenses, parts of speech), genres, or types of literary devices.
- "functions" = the grammatical or rhetorical function of a word, phrase, or device within a sentence/passage; leave empty when not applicable.
- "diagrams" is usually empty for this subject unless the source has a labeled diagram (e.g. sentence diagram).`,
    hardRules: `- Treat a grammar rule as one "relationships" or "classifications" entry and one assessment objective for applying it; do not fragment it into one unit per example sentence.
- Comprehension-passage interpretation, inference, and vocabulary-in-context are valid assessment objectives.
- Treat a poem or prose piece's theme/message as one assessment unit, not one unit per line or stanza; keep line-level details in supporting_concepts.
- Put individual vocabulary words, character names, and quotations in supporting_concepts, not as separate assessment units.
- Grammar and literature content from the same section may both be present; keep grammar objectives and literature objectives as separate assessment units.`,
    primaryConceptExamples: `- Good primary_concept examples: "Active and passive voice", "Simile as a literary device", "Central theme of the poem", "Direct and indirect speech".
- Good learning_objective examples: "Apply the rules of converting active voice to passive voice.", "Identify similes and explain their effect in the poem.", "Interpret the central theme of the poem.", "Convert direct speech into indirect speech."`,
    questionPatternExamples: `- Good question_patterns examples: "grammar-transformation", "error-correction", "literary-device-identification", "theme-interpretation", "vocabulary-in-context", "comprehension-inference", "character-analysis", "compare-contrast".
- Bad question_patterns examples: "Change this sentence to passive voice", "What is a simile?", "Explain the poem".`,
    validators: GENERIC_VALIDATORS,
  },

  social: {
    familyId: "social",
    conceptCategories: [...BASE_CONCEPT_CATEGORIES, "Event"],
    dimensionGuidance: `- "stages_sequences" = chronologies and ordered developments (historical timelines, procedural stages).
- "cause_effect" = causes and consequences of events and phenomena.
- "comparisons" = contrasts between periods, regions, systems, or ideologies.
- "structures" = physical/geographic structures (landforms, institutions treated as structures) when applicable.
- "classifications" = types/categories (forms of government, climate types, economic systems).
- "relationships" = conceptual and economic relationships (relationship_type "usage", "part-whole", or "conceptual-mapping").
- "diagrams" = maps, graphs, and charts when the source has them.`,
    hardRules: `- Treat a chronology as one "stages_sequences" entry and, if assessed, one objective for ordering/interpreting it; do not make one assessment unit per date or event unless each is independently assessable.
- Cause-and-consequence analysis and source/data interpretation are valid assessment objectives.
- Put individual names, dates, and place facts in supporting_concepts, not as separate assessment units.`,
    primaryConceptExamples: `- Good primary_concept examples: "Causes of the French Revolution", "Formation of river landforms", "Separation of powers", "Law of demand".
- Good learning_objective examples: "Analyze the economic causes of the French Revolution.", "Interpret how meandering forms river landforms.", "Compare presidential and parliamentary systems.", "Apply the law of demand to a price change."`,
    questionPatternExamples: `- Good question_patterns examples: "cause-effect-analysis", "chronology-sequencing", "source-interpretation", "map-interpretation", "compare-contrast", "data-interpretation", "concept-application".
- Bad question_patterns examples: "When did the revolution happen?", "What is demand?", "List the causes".`,
    validators: GENERIC_VALIDATORS,
  },

  general: {
    familyId: "general",
    conceptCategories: BASE_CONCEPT_CATEGORIES,
    dimensionGuidance: `- Use each dimension by its plain meaning; place content where it fits best and leave dimensions that do not apply as empty arrays.
- "relationships" = conceptual mappings and dependencies; "processes" = procedures and mechanisms; "cause_effect" = causality.`,
    hardRules: `- Make each assessment unit the smallest independently assessable learning objective; keep individual facts, examples, and list members in supporting_concepts.
- Do not fragment one method, sequence, or relationship into many units.`,
    primaryConceptExamples: `- Good primary_concept examples: concise domain concept labels such as "Water cycle", "Balanced diet", "Safe use of tools".
- Good learning_objective examples: "Explain how the water cycle recycles water.", "Apply the principles of a balanced diet to plan a meal."`,
    questionPatternExamples: `- Good question_patterns examples: "concept-application", "cause-effect-analysis", "classification", "sequence-ordering", "compare-contrast", "interpretation".
- Bad question_patterns examples: full question stems such as "What is the water cycle?" or "Explain photosynthesis".`,
    validators: GENERIC_VALIDATORS,
  },
};

// mst_subject.name_code -> family id. Codes match the DB seed in init.sql.
const SUBJECT_FAMILY_MAP = {
  BIO: "biology",
  BTC: "biology",
  PHY: "physical-science",
  CHM: "physical-science",
  SCI: "physical-science",
  MAT: "mathematics",
  CSC: "computing",
  IPR: "computing",
  AIN: "computing",
  ITE: "computing",
  WEB: "computing",
  DSC: "computing",
  EHW: "electronics",
  EGR: "graphics",
  HIS: "social",
  GEO: "social",
  POL: "social",
  ECO: "social",
  SST: "social",
  SSC: "social",
  EVS: "general",
  ENG: "language-arts",
  HIN: "language-arts",
  BEN: "language-arts",
};

const sanitizeAuPrefix = (subjectCode) => {
  const cleaned = String(subjectCode || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  return cleaned || "GEN";
};

// Returns the resolved profile used by Layer 1 (prompt + validators) and by the
// systemPrompt of every layer. subjectCode drives the family + AU prefix;
// subjectName is only used for the human-readable engine label in prompts.
export const getSubjectProfile = (subjectCode, subjectName) => {
  const normalizedCode = String(subjectCode || "").toUpperCase().trim();
  const familyId = SUBJECT_FAMILY_MAP[normalizedCode] || "general";
  const family = FAMILY_PROFILES[familyId] || FAMILY_PROFILES.general;
  const label = String(subjectName || "").trim() || normalizedCode || "the subject";

  return {
    ...family,
    subjectCode: normalizedCode,
    subjectName: label,
    engineLabel: label,
    auPrefix: sanitizeAuPrefix(subjectCode),
  };
};

// Convenience for building "You are a <Subject> <role> engine" system prompts
// across all seven layers from whatever context object the layer receives.
export const getSubjectLabelFromContext = (inputContract = {}) => {
  const context = inputContract?.context || {};
  const directives = inputContract?.generation_directives || {};
  const assessmentUnit = inputContract?.assessment_unit || {};
  return (
    context.subject ||
    directives.subject ||
    assessmentUnit.subject ||
    "the subject"
  );
};

export const getSubjectProfileFromContext = (inputContract = {}) => {
  const context = inputContract?.context || {};
  const directives = inputContract?.generation_directives || {};
  const subjectCode = context.subjectCode || directives.subjectCode || "";
  const subjectName = context.subject || directives.subject || "";
  return getSubjectProfile(subjectCode, subjectName);
};

export { FAMILY_PROFILES, SUBJECT_FAMILY_MAP, BASE_CONCEPT_CATEGORIES };
