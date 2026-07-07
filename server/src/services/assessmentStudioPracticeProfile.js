const defaultProfile = {
  practice_type: "General",
  generation_mode: "balanced_mixed",
  target_outcomes: [
    "Blend recall, understanding, and application.",
    "Keep question forms varied and curriculum-aligned.",
  ],
  layer_emphasis: {
    layer1: "Extract all examinable concepts without bias.",
    layer2: "Build memory support that is useful across question styles.",
    layer3: "Balance recall and reasoning capabilities.",
    layer4: "Mix direct, conceptual, and applied strategies.",
    layer5: "Create balanced blueprints.",
    layer6: "Generate a mixed assessment set.",
    layer7: "Provide general remediation and learning support.",
  },
  constraints: [
    "Do not over-specialize unless the selected practice type requires it.",
  ],
};

const practiceProfiles = {
  "Quick Revision": {
    practice_type: "Quick Revision",
    generation_mode: "fast_retrieval",
    target_outcomes: [
      "Maximize high-yield recall and rapid concept refresh.",
      "Prefer concise, memory-efficient prompts.",
    ],
    layer_emphasis: {
      layer1: "Prioritize high-yield facts, terminology, and commonly tested distinctions.",
      layer2: "Create compact memory hooks and retrieval cues.",
      layer3: "Favor recall and quick understanding capabilities.",
      layer4: "Prefer rapid-fire, short-stem strategies.",
      layer5: "Keep blueprints lightweight and retrieval oriented.",
      layer6: "Generate short, time-efficient items.",
      layer7: "Return crisp revision notes and quick correction support.",
    },
    constraints: [
      "Limit long case-based setups unless essential.",
      "Prefer dense learning value per minute.",
    ],
  },
  "Chapter Master": {
    practice_type: "Chapter Master",
    generation_mode: "full_coverage_mastery",
    target_outcomes: [
      "Cover the selected section's independently assessable learning objectives comprehensively.",
      "Balance foundational, conceptual, and applied mastery.",
    ],
    layer_emphasis: {
      layer1: "Extract complete mastery coverage without creating separate units for examples, list members, or isolated facts.",
      layer2: "Support durable memory across the full concept range.",
      layer3: "Model broad chapter mastery capabilities.",
      layer4: "Mix strategies across all major question families.",
      layer5: "Create coverage-balanced blueprints.",
      layer6: "Generate representative items spanning the chapter.",
      layer7: "Provide mastery-focused remediation.",
    },
    constraints: [
      "Avoid narrow focus on only the easiest or most famous concepts.",
      "Do not convert every term or hierarchy member into a separate assessment unit.",
    ],
  },
  "Competency Based": {
    practice_type: "Competency Based",
    generation_mode: "applied_reasoning",
    target_outcomes: [
      "Prioritize application, interpretation, and reasoning.",
      "Test transfer of knowledge, not just recall.",
    ],
    layer_emphasis: {
      layer1: "Highlight causal understanding, processes, comparisons, and real-world relevance.",
      layer2: "Support conceptual understanding over rote memorization.",
      layer3: "Favor interpretation, analysis, application, and evidence-based reasoning capabilities.",
      layer4: "Prefer contextual, case-based, inference-driven assessment strategies.",
      layer5: "Blueprint for competency demonstration, not fact listing.",
      layer6: "Generate applied, data-aware, case, scenario, or reasoning-rich items where suitable.",
      layer7: "Explain reasoning, misconception patterns, and transfer gaps.",
    },
    constraints: [
      "Reduce pure fact-only items unless they support a larger applied objective.",
      "Prefer prompts that require selecting, connecting, explaining, or interpreting.",
    ],
  },
  "Full Mock": {
    practice_type: "Full Mock",
    generation_mode: "exam_simulation",
    target_outcomes: [
      "Simulate exam-like sequencing and pressure.",
      "Balance coverage, difficulty, and timing realism.",
    ],
    layer_emphasis: {
      layer1: "Extract exam-relevant structures and common traps.",
      layer2: "Support timed retrieval and quick recall under pressure.",
      layer3: "Balance recall, understanding, and exam-style application.",
      layer4: "Prefer exam-pattern strategies and mixed sequencing.",
      layer5: "Create realistic blueprint distributions by difficulty and marks.",
      layer6: "Generate exam-like items with appropriate pacing.",
      layer7: "Provide performance review and revision guidance.",
    },
    constraints: [
      "Preserve timing realism.",
      "Keep item mix representative of an exam set.",
    ],
  },
  "Memory Booster": {
    practice_type: "Memory Booster",
    generation_mode: "retention_reinforcement",
    target_outcomes: [
      "Strengthen recall durability and associative memory.",
      "Surface likely forgetting points and reinforce them.",
    ],
    layer_emphasis: {
      layer1: "Prioritize definitions, labels, steps, sequences, and confusion-prone details.",
      layer2: "Maximize stories, analogies, retrieval cues, and visual hooks.",
      layer3: "Focus on memory-sensitive capabilities.",
      layer4: "Prefer reinforcement and spaced-retrieval friendly strategies.",
      layer5: "Blueprint for memory reinforcement and structured repetition.",
      layer6: "Generate compact but sticky retrieval tasks.",
      layer7: "Return memory-first hints and reinforcement notes.",
    },
    constraints: [
      "Prefer memorable structure over broad complexity.",
    ],
  },
  "Weak Area Retry": {
    practice_type: "Weak Area Retry",
    generation_mode: "targeted_remediation",
    target_outcomes: [
      "Target common misconceptions and weak concepts aggressively.",
      "Promote correction and retry success.",
    ],
    layer_emphasis: {
      layer1: "Highlight misconceptions, edge cases, and confusion clusters.",
      layer2: "Focus memory support around previously weak zones.",
      layer3: "Model recovery-oriented capabilities.",
      layer4: "Prefer remediation and misconception-correction strategies.",
      layer5: "Blueprint for targeted corrective practice.",
      layer6: "Generate retry-friendly, diagnostic items.",
      layer7: "Provide strong corrective explanation and next-step remediation.",
    },
    constraints: [
      "Do not over-broaden into unrelated chapter areas.",
      "Keep feedback highly diagnostic.",
    ],
  },
};

export const getPracticeTypeProfile = (practiceType) =>
  practiceProfiles[practiceType] || {
    ...defaultProfile,
    practice_type: practiceType || defaultProfile.practice_type,
  };

export const buildPracticeDirectivesText = (practiceProfile) => {
  const layerEmphasis = Object.entries(practiceProfile.layer_emphasis || {})
    .map(([layer, guidance]) => `- ${layer}: ${guidance}`)
    .join("\n");
  const targetOutcomes = (practiceProfile.target_outcomes || [])
    .map((item) => `- ${item}`)
    .join("\n");
  const constraints = (practiceProfile.constraints || [])
    .map((item) => `- ${item}`)
    .join("\n");

  return [
    `Practice Type: ${practiceProfile.practice_type}`,
    `Generation Mode: ${practiceProfile.generation_mode}`,
    "Target Outcomes:",
    targetOutcomes,
    "Layer Emphasis:",
    layerEmphasis,
    "Constraints:",
    constraints,
    "Apply these directives explicitly while producing the JSON.",
  ].join("\n");
};
