import { Link, useSearchParams } from "react-router-dom";

const subjectPlaybooks = {
  Physics: {
    title: "Physics Manual Builder",
    cue: "Structure around concept -> force -> application -> retry.",
    lanes: [
      {
        title: "Concept Check",
        detail: "Start with one misconception or law-identification prompt to anchor the chapter.",
      },
      {
        title: "Numerical Core",
        detail: "Add 2 to 3 worked-solution style numericals that build from direct to applied use.",
      },
      {
        title: "Diagram / Case",
        detail: "Use one visual or force-analysis situation to test reasoning, not just formula recall.",
      },
      {
        title: "Weak Area Retry",
        detail: "Finish with one misconception-correction item for the most common error pattern.",
      },
    ],
    prompts: [
      "Which concept in this chapter is most often confused with a similar law?",
      "Where should students shift from substitution to physical reasoning?",
      "Which diagram or vector step usually causes the retry spike?",
    ],
  },
  Chemistry: {
    title: "Chemistry Manual Builder",
    cue: "Move from recall -> relationship -> exception -> revision.",
    lanes: [
      {
        title: "Recall Trigger",
        detail: "Open with a fast atomic, reagent, or term-recall question to wake up memory.",
      },
      {
        title: "Concept Link",
        detail: "Build one assertion or explanation item that connects two ideas from the chapter.",
      },
      {
        title: "Exception Finder",
        detail: "Add a trap-style prompt around common exceptions, trends, or reaction confusion.",
      },
      {
        title: "Revision Booster",
        detail: "Close with a short booster prompt built for repeat exposure after 48-72 hours.",
      },
    ],
    prompts: [
      "Which reagent or trend is forgotten first in this chapter?",
      "Where can one assertion-reason question expose weak understanding quickly?",
      "What should the student still remember after a short revision session?",
    ],
  },
  Mathematics: {
    title: "Mathematics Manual Builder",
    cue: "Sequence from method recall -> guided solve -> board-style depth.",
    lanes: [
      {
        title: "Method Recall",
        detail: "Start with one crisp question that checks whether the student remembers the solving path.",
      },
      {
        title: "Stepwise Solve",
        detail: "Use one or two guided problems where each step builds confidence before speed.",
      },
      {
        title: "Board Pattern",
        detail: "Add one exam-style question with marks-worthy structure and cleaner final wording.",
      },
      {
        title: "Retry Focus",
        detail: "Finish with the exact step or transformation learners usually miss in attempts.",
      },
    ],
    prompts: [
      "Which solving step deserves its own focused question?",
      "Where do students lose marks: method choice, algebra, or final interpretation?",
      "What board-style version of this chapter will feel exam-real without being too long?",
    ],
  },
  Biology: {
    title: "Biology Manual Builder",
    cue: "Build from recognition -> concept relation -> application -> terminology recall.",
    lanes: [
      {
        title: "Recognition Start",
        detail: "Open with a definition, diagram label, or trait-identification prompt to lower friction.",
      },
      {
        title: "Concept Relation",
        detail: "Use a question that connects process, structure, and function inside the chapter.",
      },
      {
        title: "Application Check",
        detail: "Add one case, example, or inheritance-style situation that tests actual understanding.",
      },
      {
        title: "Term Booster",
        detail: "End with one memory booster around exact vocabulary or sequence recall.",
      },
    ],
    prompts: [
      "Which chapter terms are forgotten even when the concept is understood?",
      "Where can a diagram or case make the practice set feel more intuitive?",
      "Which concept relation should students explain in their own words?",
    ],
  },
};

const fallbackPlaybook = {
  title: "Manual Builder",
  cue: "Shape the practice set around chapter intent, memory value, and retry potential.",
  lanes: [
    {
      title: "Understand",
      detail: "Start with a question that anchors the central concept of the chapter.",
    },
    {
      title: "Apply",
      detail: "Add the question type that best tests working understanding.",
    },
    {
      title: "Review",
      detail: "Include one prompt that exposes the most likely weak area.",
    },
    {
      title: "Retry",
      detail: "Close with a focused retry or memory-booster item.",
    },
  ],
  prompts: [
    "What should the student remember after this set?",
    "Which mistake should the set catch early?",
    "What should the final question reinforce?",
  ],
};

export const AdminAssessmentManualPage = () => {
  const [searchParams] = useSearchParams();
  const subject = searchParams.get("subject") || "Physics";
  const className = searchParams.get("class") || "11";
  const chapter = searchParams.get("chapter") || "Selected Chapter";
  const practiceType = searchParams.get("practiceType") || "Concept Builder";
  const sectionNumber = searchParams.get("sectionNumber") || "1";

  const playbook = subjectPlaybooks[subject] || fallbackPlaybook;
  const studioQuery = new URLSearchParams({
    mode: "manual",
    subject,
    class: className,
    chapter,
    practiceType,
    sectionNumber,
  }).toString();

  return (
    <section className="admin-manual-page">
      <div className="admin-manual-header">
        <div>
          <span className="eyebrow">Assessment Studio</span>
          <h1>{playbook.title}</h1>
          <p>
            Create the first structure manually for {subject}, then carry it back into
            the studio flow when you are ready.
          </p>
        </div>
        <div className="admin-manual-draft">
          <strong>
            {subject} | Class {className} | {practiceType}
          </strong>
          <span>
            Chapter: {chapter} | Section {sectionNumber}
          </span>
        </div>
      </div>

      <section className="admin-manual-callout">
        <strong>Subject cue</strong>
        <p>{playbook.cue}</p>
      </section>

      <section className="admin-manual-grid">
        <div className="admin-panel">
          <div className="admin-panel-head">
            <h2>Recommended manual lanes</h2>
            <span>Use this structure as a subject-aware starting point</span>
          </div>
          <div className="admin-manual-lane-grid">
            {playbook.lanes.map((lane, index) => (
              <article key={lane.title} className="admin-manual-lane-card">
                <span>{index + 1}</span>
                <strong>{lane.title}</strong>
                <p>{lane.detail}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="admin-panel">
          <div className="admin-panel-head">
            <h2>Prompt checklist</h2>
            <span>Questions to ask yourself while composing manually</span>
          </div>
          <div className="admin-manual-prompt-list">
            {playbook.prompts.map((prompt) => (
              <article key={prompt} className="admin-manual-prompt-card">
                {prompt}
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="admin-panel admin-manual-action-panel">
        <div className="admin-panel-head">
          <h2>Next step</h2>
          <span>Go back to source strategy or continue into the studio canvas</span>
        </div>
        <div className="admin-manual-actions">
          <Link className="ghost-button" to={`/admin/assessment-studio?${studioQuery}`}>
            Back to Source Strategy
          </Link>
          <Link className="primary-button" to={`/admin/assessment-studio?${studioQuery}&step=2`}>
            Continue in Studio Canvas
          </Link>
        </div>
      </section>
    </section>
  );
};
