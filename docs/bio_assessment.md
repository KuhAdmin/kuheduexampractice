# KUHEDU Biology Assessment Platform

## Product Requirements Document

Version: 1.0  
Status: Draft for Architecture Freeze  
Scope: Biology-first adaptive assessment system

## 1. Executive Summary

KUHEDU should evolve the current Biology prompt framework into a production-grade assessment platform. The platform will transform textbook biology content into structured educational knowledge, memory assets, assessment blueprints, learner-facing questions, and personalized post-attempt support.

This document defines:

- the product understanding behind the multi-layer Biology prompt system
- the implementation direction for data, APIs, and UX
- the phased rollout plan
- the todo list required to move from architecture to production

The system should treat `Assessment Unit` as the core educational entity across all layers.

## 2. Product Understanding

The Biology prompt stack is not a single content prompt. It is a multi-stage educational pipeline intended to compile textbook content into reusable learning and assessment assets.

The pipeline currently expresses seven layers:

1. Knowledge Extraction Layer
2. Concept Memory Layer
3. Assessment Capability Layer
4. Assessment Strategy Layer
5. Assessment Item Blueprint Layer
6. Assessment Item Generation Layer
7. Learning Support and Feedback Layer

The architectural center of gravity is the `Assessment Unit`.

An Assessment Unit is the smallest independent educational unit that can be:

- remembered independently
- assessed independently
- remediated independently

Every major concept extracted from source content should map to exactly one Assessment Unit. All downstream artifacts should reference that Assessment Unit rather than rebuilding concept identity repeatedly.

## 3. Product Goal

Build a Biology-first authoring and delivery system that can:

- ingest textbook section content
- extract structured curriculum knowledge
- reduce prompt payload size drastically between layers
- generate AI-assisted assessment design assets
- support admin-led question making
- deliver student practice experiences
- power teacher-facing review and intervention workflows

## 4. Primary Users

### Admin

Needs:

- upload source material
- run and review AI layer outputs
- manage the curriculum graph
- approve or edit generated assets
- author and publish questions
- monitor quality and usage

### Question Maker

Needs:

- inspect layer outputs
- edit assessment units
- create and refine blueprints
- generate and revise assessment items
- preview learner experience before publish

### Student

Needs:

- consume chapter-wise practice
- understand mistakes
- receive memory-based reinforcement
- improve through targeted retries

### Teacher

Needs:

- review learner performance by concept
- inspect misconceptions and weak areas
- assign remediation and follow-up practice

## 5. Product Principles

- `Assessment Unit` is the canonical educational key.
- AI should preserve traceability from source content to learner feedback.
- Each layer should consume structured outputs from prior layers, not raw textbook content again.
- Prompt size should be reduced aggressively by passing only minimal necessary references and summaries.
- Human review remains mandatory for publishing.
- Student UX must stay simple even if authoring and analytics become sophisticated.

## 6. In Scope

- Biology-only first implementation
- PRD and architecture freeze
- layer-wise data model design
- layer-wise database schema
- OpenAI API integration
- Question Maker UX
- Student UX
- Admin UX
- Teacher UX
- layer payload compression strategy

## 7. Out of Scope for Initial Biology Rollout

- multi-subject generalized prompt orchestration
- multilingual delivery
- full OCR vendor optimization
- advanced psychometrics
- fully autonomous publishing without human review

## 8. Core Domain Model Freeze

The data model must satisfy two requirements at the same time:

- remain 100% in sync with the layered prompt JSON contracts
- support PostgreSQL-backed caching so downstream layers can reuse prior outputs and reduce token usage by about 95%

Because of that, the model should be split into:

- canonical contract tables
- relational projection tables
- delivery and workflow tables

### 8.1 Generation ID Rule

Every layer contract must include `generation_id`.

Purpose:

- acts as the cache key for a generated contract instance
- allows exact reuse of prior outputs without regenerating tokens
- supports lineage from source section to student-facing delivery
- makes prompt-version migration auditable

`generation_id` should exist in:

- every layer input contract
- every layer output contract
- every persisted layer table
- every relational child record derived from that contract

Recommended format:

- PostgreSQL `UUID`

Recommended companion fields:

- `prompt_version`
- `model_name`
- `contract_schema_version`
- `cache_key`
- `source_hash`
- `status`
- `created_at`

### 8.2 Canonical Contract Tables

These tables preserve the exact JSON shapes produced or consumed by each layer.

#### Shared Contract Infrastructure

- `generation_registry`
- `layer_run`
- `layer_input_contract`
- `layer_output_contract`
- `layer_contract_dependency`

#### Shared Contract Fields

Every contract table should contain:

- `id`
- `generation_id`
- `layer_number`
- `layer_name`
- `source_document_id`
- `source_section_id`
- `fk_mst_chapter_id`
- `assessment_unit_id` when applicable
- `parent_generation_id` when derived from a previous layer
- `prompt_version`
- `contract_schema_version`
- `model_name`
- `cache_key`
- `source_hash`
- `input_json`
- `output_json`
- `status`
- `token_input`
- `token_output`
- `latency_ms`
- `created_by`
- `created_at`

### 8.3 Source and Content Tables

- `source_document`
- `source_section`
- `source_section_image`
- `source_ocr_text`
- `source_parse_version`

#### `source_document`

Stores:

- document metadata
- board, class, subject, book, chapter context
- source ownership and review state

#### `source_section`

Stores:

- one logical textbook section unit
- title
- section number
- page range
- raw extracted text reference

#### `source_section_image`

Stores:

- uploaded image asset metadata
- storage location
- image sequence

#### `source_ocr_text`

Stores:

- OCR text
- OCR confidence
- OCR provider
- normalized text

### 8.4 Canonical Educational Graph Tables

- `assessment_unit`
- `assessment_unit_supporting_concept`
- `assessment_unit_dependency`
- `concept`
- `concept_alias`

#### `assessment_unit`

Frozen columns:

- `id`
- `generation_id`
- `assessment_unit_id`
- `source_section_id`
- `fk_mst_chapter_id`
- `primary_concept`
- `learning_objective`
- `concept_category`
- `curriculum_importance`
- `is_active`
- `created_at`
- `updated_at`

#### `assessment_unit_supporting_concept`

Frozen columns:

- `id`
- `generation_id`
- `assessment_unit_id`
- `supporting_concept`
- `display_order`

#### `assessment_unit_dependency`

Frozen columns:

- `id`
- `generation_id`
- `assessment_unit_id`
- `depends_on_assessment_unit_id`
- `dependency_type`

#### `concept`

Stores normalized concepts extracted from Layer 1 and linked to Assessment Units.

Frozen columns:

- `id`
- `generation_id`
- `source_section_id`
- `fk_mst_chapter_id`
- `assessment_unit_id`
- `concept_name`
- `concept_family`
- `description`

### 8.5 Layer 1 Model: Knowledge Extraction

Layer 1 output contract fields are explicitly known from the prompt and should map exactly.

#### Layer 1 Contract Table

- `layer1_knowledge_contract`

Frozen scalar fields:

- `generation_id`
- `source_section_id`
- `fk_mst_chapter_id`
- `context_summary`

Frozen array/object families:

- `core_concepts`
- `structures`
- `functions`
- `processes`
- `stages_sequences`
- `cause_effect`
- `relationships`
- `comparisons`
- `classifications`
- `diagrams`
- `terminology`
- `exceptions`
- `common_misconceptions`
- `memory_hooks`
- `question_patterns`
- `assessment_units`

#### Layer 1 Projection Tables

- `layer1_core_concept`
- `layer1_structure`
- `layer1_structure_part`
- `layer1_function`
- `layer1_process`
- `layer1_process_input`
- `layer1_process_output`
- `layer1_process_step`
- `layer1_stage_sequence`
- `layer1_stage_sequence_stage`
- `layer1_cause_effect`
- `layer1_relationship`
- `layer1_comparison`
- `layer1_comparison_difference`
- `layer1_comparison_similarity`
- `layer1_classification`
- `layer1_classification_group`
- `layer1_diagram`
- `layer1_diagram_label`
- `layer1_diagram_tested_label`
- `layer1_terminology`
- `layer1_terminology_related_concept`
- `layer1_exception`
- `layer1_common_misconception`
- `layer1_memory_hook`
- `layer1_question_pattern`
- `layer1_assessment_unit`

#### Layer 1 Field Mapping

`layer1_structure`

- `name`
- `type`
- `location`
- `description`

`layer1_function`

- `structure`
- `function`
- `importance`
- `related_process`

`layer1_process`

- `name`
- `purpose`
- `location`

`layer1_stage_sequence`

- `name`
- `sequence_type`
- `important_notes`

`layer1_cause_effect`

- `cause`
- `effect`
- `biological_reason`

`layer1_relationship`

- `relationship_name`
- `relationship_type`
- `related_concepts`
- `relationship_summary`

`layer1_comparison`

- `entity_1`
- `entity_2`

`layer1_classification`

- `category`
- `classification_basis`

`layer1_diagram`

- `diagram`
- `purpose`

`layer1_terminology`

- `term`
- `definition`

`layer1_exception`

- `topic`
- `exception`
- `reason`

`layer1_common_misconception`

- `concept`
- `misconception`
- `reason_for_confusion`
- `correction`

`layer1_memory_hook`

- `concept`
- `memory_type`
- `memory_hook`
- `why_it_helps`

`layer1_assessment_unit`

- `assessment_unit_id`
- `primary_concept`
- `learning_objective`
- `concept_category`
- `curriculum_importance`

#### Layer 1 Refactor Spec: Pedagogical Assessment Units

Layer 1 must evolve from a pure information extraction contract into a pedagogical knowledge graph contract.

The core rule is:

`Assessment Unit = smallest independently assessable domain concept with an attached learning objective`

An Assessment Unit must keep concept identity stable while separately stating what the learner is expected to do with that concept. It must not be merely an example, fact fragment, source phrase, or supporting evidence.

##### Revised Assessment Unit Rules

Layer 1 must follow these Assessment Unit rules:

- An Assessment Unit must be independently assessable, remediable, and reusable by downstream layers.
- `primary_concept` must be a stable domain concept label, not a Bloom/action-verb learning objective.
- `learning_objective` must carry learner-action verbs such as interpret, apply, justify, compare, classify, or explain.
- An Assessment Unit must not be created for examples, evidence, memory anchors, isolated features, or incidental facts.
- Examples must be attached to an Assessment Unit as `examples`, not promoted into separate Assessment Units.
- Evidence or source details must be attached as `evidence_from_source`, not promoted into separate Assessment Units.
- Supporting concepts must be true prerequisites or enabling concepts, not synonyms or restatements.
- Dependencies must represent prerequisite logic, not the order in which facts appear in the textbook.
- Dependencies may be multiple and graph-shaped; a simple chain should be rejected unless the source truly demands it.
- Each Assessment Unit must have a clear `learning_objective`.
- Each Assessment Unit must have at least one `evidence_of_mastery` statement describing what a correct learner response would demonstrate.
- Each Assessment Unit should usually cover one conceptual relationship, rule, hierarchy, process, or definition family.
- For a short textbook section of roughly 1,500 to 2,000 words, expected Assessment Unit count should usually be 6 to 10 unless the source is unusually dense.

Example correction:

Bad separate Assessment Units:

- `Insects as recognizable taxonomic group`
- `Three pairs of jointed legs in insects`

Better single Assessment Unit:

- `Taxonomic group recognition through shared characters`

Attached example:

- `Insects`

Attached evidence:

- `Insects share common features such as three pairs of jointed legs.`

##### Layer 1 Schema Corrections

The next Layer 1 contract version should preserve source-grounded extraction while correcting semantic drift in the current schema.

Recommended contract version:

- `contract_schema_version`: `1.1.0`

Top-level corrections:

- Replace or deprecate `structures` with `entities`.
- Split `entities` into `biological_entities` and `conceptual_entities` when useful.
- Replace or deprecate `functions` with `principles_or_roles` for chapters where the source is conceptual rather than anatomical or physiological.
- Replace `memory_hooks` with `memory_support_candidates`.
- Keep actual mnemonic generation in Layer 2.
- Keep `question_patterns`, but require exam-relevant pattern coverage when the source supports it.
- Keep raw source traceability through source snippets or source references.

Revised Assessment Unit shape:

```json
{
  "assessment_unit_id": "BIO-801-1.2-AU001",
  "primary_concept": "Taxonomic group recognition through shared characters",
  "learning_objective": "Explain how shared characters allow organisms to be recognized as a taxonomic group.",
  "concept_category": "Relationship",
  "concept_type": "Rule",
  "curriculum_importance": "high",
  "bloom_baseline": "Understand",
  "cognitive_load": "medium",
  "abstraction_level": "conceptual",
  "supporting_concepts": [
    "classification",
    "shared characters",
    "taxonomic category"
  ],
  "examples": [
    {
      "label": "Insects",
      "source_detail": "Insects share common features such as three pairs of jointed legs."
    }
  ],
  "non_examples": [],
  "evidence_from_source": [
    "Groups represent category. Category further denotes rank."
  ],
  "evidence_of_mastery": [
    "Learner can infer that a group sharing common characters can be assigned a taxonomic rank."
  ],
  "dependencies": [
    {
      "assessment_unit_id": "BIO-801-1.2-AU000",
      "dependency_type": "prerequisite"
    }
  ]
}
```

Recommended `concept_category` values:

- `Structure`
- `Function`
- `Process`
- `Relationship`
- `Principle`
- `Classification`
- `Terminology`
- `Hierarchy`
- `Definition`
- `Rule`
- `Observation`
- `Reasoning`

Recommended `concept_type` values:

- `LearningObjective`
- `Definition`
- `Relationship`
- `Hierarchy`
- `Rule`
- `ExampleUse`
- `Observation`
- `ProcessStep`
- `Comparison`
- `MisconceptionRisk`

Assessment Unit ID format should become section-scoped to avoid collisions:

- Preferred: `BIO-{fk_mst_chapter_id}-{section_number}-AU{sequence}`
- Example: `BIO-801-1.2-AU001`

##### Automatic Validation Rules

Layer 1 validation must reject outputs that are structurally valid but pedagogically weak.

Hard validation rules:

- Reject if `assessment_units` is missing or empty.
- Reject if any Assessment Unit lacks `assessment_unit_id`, `primary_concept`, `learning_objective`, `concept_category`, `curriculum_importance`, `evidence_of_mastery`, or `dependencies`.
- Reject if `assessment_unit_id` does not match the section-scoped ID format for the current source section.
- Reject if `primary_concept` is longer than 12 words.
- Reject if `learning_objective` does not describe learner capability using verbs such as explain, identify, distinguish, infer, arrange, classify, relate, apply, or justify.
- Reject if `primary_concept` starts with Bloom/action verbs such as interpret, apply, justify, compare, recognise, explain, evaluate, identify, or distinguish.
- Reject if an Assessment Unit has `concept_type = ExampleUse` and no broader parent concept.
- Reject if an Assessment Unit's `primary_concept` is mostly an example label from `examples`, `memory_support_candidates`, or source examples.
- Reject if an Assessment Unit is an isolated feature without a broader concept, such as `three pairs of jointed legs`, unless the source section is specifically about that feature as a mastery target.
- Reject if `supporting_concepts` contains only synonyms or restatements of `primary_concept`.
- Reject if dependency IDs reference Assessment Units that do not exist.
- Reject if more than 80% of dependencies form a simple one-to-one chain for sections with more than five Assessment Units.
- Reject if there are duplicate or near-duplicate Assessment Units by normalized `primary_concept`.
- Reject if `memory_support_candidates` contains invented mnemonics, analogies, or stories not present in the source.
- Reject if `entities` classifies abstract curriculum objects as physical biology structures.

Example-as-AU rejection heuristic:

An Assessment Unit should be rejected as an example-as-AU candidate when two or more of these are true:

- `primary_concept` starts with or contains patterns such as `as an example`, `example of`, `such as`, or `insects as`.
- `primary_concept` is mostly a named organism, group, object, diagram label, or isolated source example.
- `primary_concept` repeats a value found in the `examples` array of another Assessment Unit.
- `supporting_concepts` are mostly features of the example rather than prerequisites.
- `evidence_of_mastery` can be answered by memorizing the example alone.

Auto-repair guidance:

- Merge example-as-AU records into the nearest broader Assessment Unit.
- Move example labels to `examples`.
- Move factual details to `evidence_from_source`.
- Keep the broader Assessment Unit's `primary_concept` as a stable domain label and move learner actions into `learning_objective`.
- Recompute dependencies after merging.

Quality gates before Layer 2:

- Layer 1 must pass JSON schema validation.
- Layer 1 must pass pedagogical validation.
- Layer 1 must produce a non-linear dependency graph when the content requires it.
- Layer 1 must keep examples, evidence, memory candidates, and mastery objectives in separate fields.
- Layer 1 must preserve the full canonical output in PostgreSQL before any downstream layer starts.

### 8.6 Layer 2 Model: Concept Memory

Layer 2 must remain a pure cognitive-memory layer. Its purpose is to answer:

`How will the learner remember this assessment unit durably?`

Layer 2 must not generate assessment strategy, question prompts, blueprint guidance, competency prompts, evidence of mastery, instructional use, or cross-layer alignment. Those belong to Layers 3-7 or future experiential-learning layers.

Layer 2 should receive relevant Layer 1 `memory_hooks` as source-grounded memory support candidates. These hooks guide memory asset generation but are not themselves final mnemonics.

#### Layer 2 Contract Table

- `layer2_concept_memory_contract`

Frozen top-level field:

- `generation_id`

Frozen array:

- `concept_memories`

#### Layer 2 Projection Tables

- `layer2_concept_memory`
- `layer2_concept_memory_supporting_concept`
- `layer2_concept_memory_retrieval_cue`
- `layer2_concept_memory_associated_concept`

#### Layer 2 Field Mapping

`layer2_concept_memory`

- `generation_id`
- `assessment_unit_id`
- `primary_concept`
- `story`
- `analogy`
- `visual_hook`
- `real_world_connection`
- `memory_trick`
- `curiosity_hook`
- `micro_activity`
- `misconception_alert`
- `memory_difficulty`
- `estimated_memory_strength` backend-computed; not generated by the LLM

Child arrays:

- `supporting_concepts`
- `retrieval_cues`
- `associated_concepts`

Forbidden Layer 2 fields:

- `reasoning_patterns`
- `instructional_use`
- `instructional_emphasis`
- `instructional_alignment`
- `competency_prompts`
- `evidence_of_mastery`
- `assessment_readiness`
- `question_prompts`
- `blueprint_guidance`
- `strategy_guidance`
- `layer3_alignment`
- `layer4_alignment`
- `layer5_alignment`
- `layer6_alignment`
- `layer7_alignment`

Backend-computed Layer 2 fields:

- `estimated_memory_strength` must be calculated after LLM validation from `memory_difficulty`, retrieval cue count, supporting/associated concept density, dependency depth, and misconception risk.

### 8.7 Layer 3 Model: Assessment Capability

Layer 3 must remain exact to its JSON contract, but it should be modeled contract-first because its prompt details may evolve as capability ranking logic matures.

#### Layer 3 Contract Table

- `layer3_assessment_capability_contract`

Minimum frozen columns:

- `generation_id`
- `assessment_unit_id`
- `output_json`

#### Layer 3 Projection Tables

- `layer3_assessment_capability`
- `layer3_capability_dimension`
- `layer3_capability_dependency`
- `layer3_capability_opportunity`

Required rule:

- retain the full raw JSON in `output_json`
- project stable fields only after exact prompt contract freeze

### 8.8 Layer 4 Model: Assessment Strategy

#### Layer 4 Contract Table

- `layer4_assessment_strategy_contract`

Minimum frozen columns:

- `generation_id`
- `assessment_unit_id`
- `output_json`

#### Layer 4 Projection Tables

- `layer4_assessment_strategy`
- `layer4_strategy_recommendation`
- `layer4_strategy_remediation`
- `layer4_strategy_generator_constraint`

Expected strategy dimensions:

- question family
- interaction type
- Bloom level
- difficulty
- adaptive priority
- remediation direction

### 8.9 Layer 5 Model: Assessment Item Blueprint

#### Layer 5 Contract Table

- `layer5_item_blueprint_contract`

Frozen top-level identifier fields:

- `generation_id`
- `assessment_unit_id`
- `blueprint_id`

Required raw preservation:

- exact `output_json`

#### Layer 5 Projection Tables

- `layer5_item_blueprint`
- `layer5_blueprint_secondary_concept`
- `layer5_blueprint_concept_dependency`
- `layer5_blueprint_recommended_after_failure`

Known blueprint projection groups from the prompt:

- `identity`
- `pedagogy`
- `question`
- `reasoning`
- `memory_support`
- `adaptive`
- `generator_constraints`
- `assessment_notes`

### 8.10 Layer 6 Model: Assessment Item Generation

#### Layer 6 Contract Table

- `layer6_assessment_item_contract`

Frozen top-level field:

- `generation_id`

Frozen array:

- `assessment_items`

#### Layer 6 Projection Tables

- `layer6_assessment_item`
- `layer6_assessment_item_option`
- `layer6_assessment_item_acceptable_answer`

#### Layer 6 Field Mapping

`layer6_assessment_item`

- `generation_id`
- `item_id`
- `blueprint_id`
- `assessment_unit_id`
- `question_family`
- `interaction_type`
- `difficulty`
- `blooms_level`
- `assessment_dimension`
- `learning_objective`
- `question`
- `correct_answer`
- `diagram_instruction`
- `marks`
- `estimated_time_seconds`

Special field:

- `interaction_data` as `JSONB`

Child arrays:

- `options`
- `acceptable_answers`

### 8.11 Layer 7 Model: Learning Support and Feedback

#### Layer 7 Contract Table

- `layer7_learning_support_contract`

Frozen top-level fields:

- `generation_id`
- `assessment_unit_id`

Frozen object:

- `learning_support`

#### Layer 7 Projection Tables

- `layer7_learning_support`
- `layer7_distractor_analysis`
- `layer7_progressive_hint`
- `layer7_memory_reinforcement`
- `layer7_memory_reinforcement_retrieval_cue`
- `layer7_adaptive_remediation`
- `layer7_revision_note`
- `layer7_teacher_note`
- `layer7_parent_note`
- `layer7_performance_summary`
- `layer7_adaptive_next_action`
- `layer7_learning_analytics`

#### Layer 7 Field Mapping

`layer7_learning_support`

- `generation_id`
- `assessment_unit_id`
- `concept_explanation`
- `correct_answer_reasoning`
- `real_world_insight`
- `mastery_recommendation`

`layer7_distractor_analysis`

- `option`
- `reason_selected`
- `why_incorrect`

`layer7_memory_reinforcement`

- `story`
- `analogy`
- `visual_hook`
- `memory_trick`

`layer7_teacher_note`

- `likely_issue`
- `classroom_intervention`
- `follow_up_activity`

`layer7_parent_note`

- `observed_issue`
- `home_support`

`layer7_performance_summary`

- `answered_correctly`
- `attempt_number`
- `time_taken_seconds`
- `confidence_rating`
- `detected_misconception`

`layer7_learning_analytics`

- `confidence_gain`
- `retention_impact`
- `misconception_severity`
- `prerequisite_dependency`
- `mastery_probability`

### 8.12 Assessment, Publishing, and Workflow Tables

- `question_bank_item`
- `question_bank_item_version`
- `practice_set`
- `practice_set_item`
- `publish_bundle`
- `review_queue`
- `review_decision`
- `editorial_comment`
- `audit_event`

#### `question_bank_item`

Should reference:

- `generation_id`
- `assessment_unit_id`
- `blueprint_id`
- `item_id`
- current approved item version

#### `practice_set_item`

Should reference:

- `question_bank_item_id`
- `assessment_unit_id`
- ordering
- publish state

### 8.13 Delivery and Performance Tables

- `student_attempt`
- `student_attempt_item`
- `student_response`
- `student_mastery`
- `teacher_assignment`
- `teacher_feedback_note`

#### `student_response`

Must preserve prompt-aligned student response fields because Layer 7 expects them:

- `generation_id`
- `assessment_unit_id`
- `student_answer`
- `is_correct`
- `attempt_number`
- `time_taken_seconds`
- `confidence_rating`

### 8.14 Modeling Decision Summary

The final modeling decision is:

- every layer keeps an exact JSON contract in PostgreSQL
- every contract gets `generation_id`
- relational child tables are created for querying, UX, analytics, and caching
- layers 3, 4, and 5 keep `output_json` as the absolute source of truth until every field is frozen line-by-line from the final prompt text
- layers 1, 2, 6, and 7 are already explicit enough to project directly into stable relational tables

## 9. Layer-by-Layer System Intent

### Layer 1: Knowledge Extraction

Purpose:

- convert section content into structured biology knowledge
- identify Assessment Units
- normalize educational metadata

Output shape:

- curriculum graph and concept graph
- atomic assessment units
- misconceptions, terms, structures, functions, processes

### Layer 2: Concept Memory

Purpose:

- create retention assets for each Assessment Unit
- support later remediation and fast recall

Output shape:

- story
- analogy
- visual hook
- memory trick
- retrieval cues
- misconception alert

### Layer 3: Assessment Capability

Purpose:

- decide what each Assessment Unit can validly assess

Output shape:

- assessable dimensions
- cognitive capability map
- candidate assessment opportunities

### Layer 4: Assessment Strategy

Purpose:

- choose best question families, Bloom level, interaction, and difficulty

Output shape:

- strategy recommendations
- interaction constraints
- adaptive priority

### Layer 5: Assessment Item Blueprint

Purpose:

- create implementation-ready specifications for item generation

Output shape:

- blueprint identity
- learning objective
- item structure
- reasoning constraints
- generator constraints

### Layer 6: Assessment Item Generation

Purpose:

- generate learner-facing assessment items from blueprint contracts

Output shape:

- final item payload
- options
- correct answer
- interaction data
- diagram instruction when needed

### Layer 7: Learning Support and Feedback

Purpose:

- create post-response explanation, remediation, and adaptive next steps

Output shape:

- concept explanation
- distractor analysis
- hints
- memory reinforcement
- teacher notes
- parent notes
- mastery recommendation
- next actions

## 10. 95% Input Reduction Strategy

The current prompt stack is too large to operate efficiently and reliably at production scale. The target is to reduce per-layer effective input size by approximately 95%.

### Compression Rules

- never resend raw source text after Layer 1 unless a hard fallback is required
- pass entity IDs and structured references instead of repeating narrative content
- create compact layer contracts rather than full verbose JSON chains
- separate immutable knowledge from derived strategy
- store large canonical outputs in the database and send only task-specific slices to the model

### Compression Methods

#### Layer 1

- input: raw OCR text + minimal metadata
- output: full structured canonical record stored in DB

#### Layer 2

- input only:
  - `assessment_unit_id`
  - `primary_concept`
  - supporting concepts
  - linked misconception summary
  - minimal concept description

#### Layer 3

- input only:
  - `assessment_unit_id`
  - concept category
  - curriculum importance
  - prerequisite list

#### Layer 4

- input only:
  - capability summary
  - memory difficulty
  - misconception profile
  - concept importance

#### Layer 5

- input only:
  - chosen strategy row
  - assessment unit reference
  - minimal supporting concept list

#### Layer 6

- input only:
  - blueprint row
  - relevant distractor policy
  - minimal factual support slice

#### Layer 7

- input only:
  - assessment item
  - answer key
  - misconception record
  - relevant memory object
  - student response

### Required Enablers

- concise internal JSON schemas per layer
- retrieval functions that fetch only required concept slices
- prompt templates built around IDs and compact summaries
- token accounting and telemetry for each layer run

## 11. UX Requirements

### Question Maker UX

The question maker experience should support:

- source section selection
- layer-by-layer run status
- editable Assessment Units
- side-by-side memory and capability inspection
- blueprint creation and editing
- item generation with revision controls
- preview before publish

### Student UX

The student experience should support:

- chapter-wise entry
- concept-aware practice attempts
- result review with memory reinforcement
- targeted retry and next-step guidance

### Admin UX

The admin experience should support:

- catalog and source management
- layer run monitoring
- review queues
- publishing workflows
- audit visibility
- usage analytics

### Teacher UX

The teacher experience should support:

- learner weakness review
- concept-level mastery view
- assignment recommendations
- intervention notes
- progress follow-up

## 12. OpenAI API Integration Requirements

- central prompt orchestration service
- model selection policy per layer
- prompt template versioning
- response schema validation
- retry and fallback handling
- layer run logging
- token usage accounting
- editorial review hooks before publish

## 13. Success Metrics

### System Metrics

- average token reduction per layer
- schema-valid response rate
- layer run success rate
- human edit rate after generation

### Authoring Metrics

- time from source upload to publishable question
- number of questions generated per approved Assessment Unit
- review turnaround time

### Student Metrics

- retry rate after feedback
- concept mastery progression
- memory-support engagement

### Teacher Metrics

- intervention adoption
- assignment completion
- mastery improvement after intervention

## 14. Phased Implementation Plan

## Phase 0: PRD and Architecture Freeze

Goal:

- convert the prompt vision into a stable product and engineering contract

Deliverables:

- biology assessment PRD
- frozen domain model
- layer contracts
- glossary of core entities

TODO:

- [ ] finalize the canonical definition of `Assessment Unit`
- [ ] upgrade Layer 1 to the pedagogical Assessment Unit refactor spec
- [ ] add deterministic validation to reject example-as-Assessment-Unit outputs
- [ ] add auto-repair rules for merging examples and evidence into broader Assessment Units
- [ ] finalize naming for all layer entities
- [ ] define frozen JSON contracts for Layer 1 through Layer 7
- [ ] define which outputs are canonical vs derived
- [ ] define editorial workflow states
- [ ] define publishability rules
- [ ] define token telemetry requirements
- [ ] define acceptance criteria for prompt quality

## AI Generated Question Research Workbench UX

The pipeline layers are implementation details and should not be the default teacher-facing UX. Teachers and content designers should work with meaningful research objects:

- `Concept`
- `Memory`
- `Assessment Intelligence`
- `Question Blueprint`
- `Generated Questions`
- `Learning Support`
- `Analytics`
- `Search`
- `AI Inspector`

### User-Facing Tabs to Internal Pipeline Mapping

| Workbench Tab | Internal Source |
| --- | --- |
| Concept | Layer 1 |
| Memory | Layer 2 |
| Assessment Intelligence | Layers 3 and 4 |
| Question Blueprint | Layer 5 |
| Generated Questions | Layer 6 |
| Learning Support | Layer 7 |
| Analytics | Aggregated outputs |
| Search | Cross-layer index |
| AI Inspector | Advanced JSON/debug audit |

### UX Principles

- Hide raw JSON by default.
- Show Assessment Units as editable concept cards.
- Show memory, blueprint, questions, and learning support as plain-English cards.
- Keep `AI Inspector` available for advanced users and debugging.
- Every editable card should eventually support `Edit`, `Save`, `Restore AI`, and `Version History`.
- Use a research timeline language such as `Knowledge Extracted`, `Memory Built`, `Blueprint Created`, and `Question Generated` instead of exposing layer numbers.

### Selective Regeneration Rules

| Edited Object | Regenerate |
| --- | --- |
| Concept | Layers 2-7 |
| Memory | Layers 5-7 |
| Assessment Strategy | Layers 5-7 |
| Blueprint | Layers 6-7 |
| Generated Question | Layer 7 only |
| Learning Support | Layer 7 only |

### First Implementation

The first Workbench version reads the existing pipeline audit snapshot and renders teacher-friendly tabs/cards without changing canonical pipeline persistence. Editing controls are displayed as disabled affordances until versioned save, cache invalidation, and downstream regeneration endpoints are implemented.

## Phase 1: Data Model and Database Foundation

Goal:

- create the persistent structure for the multi-layer pipeline

Deliverables:

- PostgreSQL schema for all frozen entities
- migrations for layer-wise tables
- indexes and materialized views for authoring and analytics

TODO:

- [ ] create `source_document` and `source_section` tables
- [ ] create `assessment_unit` and dependency tables
- [ ] create concept-family tables for structures, functions, processes, terms, and misconceptions
- [ ] create `layer_run`, `layer_run_input`, and `layer_run_output`
- [ ] create layer-specific output tables for Layer 1 to Layer 7
- [ ] create question bank and publishing tables
- [ ] create attempt and response tables for student delivery
- [ ] create audit and review tables
- [ ] create seed data and migration strategy
- [ ] create layer-focused materialized views for admin and teacher dashboards

## Phase 2: Prompt Contract Compression and Orchestration

Goal:

- reduce layer input size by about 95% and operationalize prompt execution

Deliverables:

- compact prompt schemas
- orchestration service
- token logging
- retrieval policy for minimal inputs

TODO:

- [ ] define compact input schema per layer
- [ ] define compact output schema per layer
- [ ] build prompt template registry
- [ ] build layer runner service
- [ ] build schema validator for model outputs
- [ ] build token accounting and latency logging
- [ ] implement prompt context slicer and retrieval helpers
- [ ] add fallback policy for incomplete or invalid JSON
- [ ] benchmark token savings against current raw prompts

## Phase 3: OpenAI API Integration

Goal:

- integrate the AI pipeline into the application backend safely

Deliverables:

- OpenAI-backed layer execution
- structured response storage
- error recovery and review visibility

TODO:

- [ ] add OpenAI configuration to environment strategy
- [ ] create server-side OpenAI client wrapper
- [ ] support model routing by layer
- [ ] implement request and response persistence
- [ ] implement deterministic schema validation
- [ ] implement retry, timeout, and fallback rules
- [ ] expose internal APIs to trigger layer runs
- [ ] expose APIs to fetch layer run history
- [ ] add secure admin-only access controls

## Phase 4: Admin and Question Maker UX

Goal:

- create the internal authoring system used to inspect layers and create questions

Deliverables:

- source intake UI
- Assessment Unit review UI
- blueprint authoring UI
- item generation UI
- publishing controls

TODO:

- [ ] create source upload and section registration screens
- [ ] create layer run dashboard with status, token use, and model info
- [ ] create Assessment Unit editor and dependency editor
- [ ] create memory layer review panel
- [ ] create capability and strategy review panels
- [ ] create blueprint list and blueprint editor
- [ ] create item generation workspace
- [ ] create diff and revision workflow for generated items
- [ ] create publish and archive flows
- [ ] create review queue and approval UI

## Phase 5: Student UX

Goal:

- deliver concept-aware assessment experiences to students

Deliverables:

- chapter entry
- practice attempt flow
- results and remediation flow
- retry and mastery loop

TODO:

- [ ] design student information architecture for Biology practice
- [ ] create chapter and concept practice entry screens
- [ ] create attempt experience for generated items
- [ ] create answer submission and autosave flow
- [ ] create results screen using Layer 7 support
- [ ] create memory reinforcement and retry panels
- [ ] create mastery and next-step recommendations
- [ ] add mobile optimization for all learner flows

## Phase 6: Teacher UX

Goal:

- create teacher-facing intervention and monitoring workflows

Deliverables:

- class and student mastery visibility
- concept-level review
- assignment recommendations
- intervention notes

TODO:

- [ ] create teacher dashboard shell
- [ ] create concept mastery summaries by student
- [ ] create misconception review panels
- [ ] create assignment and follow-up recommendation workflow
- [ ] create intervention note entry
- [ ] create student history and progress view
- [ ] create export or share-ready summaries for teacher action

## Phase 7: Quality, Analytics, and Publish Governance

Goal:

- make the system safe, measurable, and scalable

Deliverables:

- analytics layer
- auditability
- governance workflows
- production readiness checks

TODO:

- [ ] create quality scoring rules for generated outputs
- [ ] create edit-distance metrics between AI draft and published asset
- [ ] create review SLA metrics
- [ ] create student mastery analytics
- [ ] create teacher intervention effectiveness analytics
- [ ] create admin governance dashboards
- [ ] create production checklists for publishing
- [ ] add observability for layer failures and schema drift

## 15. Recommended Build Order

1. Freeze the domain model and contracts.
2. Create the database schema and migration plan.
3. Implement compact prompt orchestration.
4. Integrate OpenAI execution and persistence.
5. Build admin and question maker workflows.
6. Build student delivery flows.
7. Build teacher intervention flows.
8. Add analytics, governance, and production hardening.

## 16. Immediate Next Actions

- [ ] review and approve this PRD
- [ ] freeze the canonical layer contracts
- [ ] draft the Biology ERD
- [ ] implement the layer-wise PostgreSQL tables
- [ ] design the compact prompt payload strategy
- [ ] create the first admin/question maker wireframes
