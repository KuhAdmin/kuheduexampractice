import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

const questionLibrary = [
  {
    id: "qb-1",
    title: "Newton's first law misconception check",
    subject: "Physics",
    className: "Class 11",
    chapter: "Laws of Motion",
    section: "1",
    format: "MCQ",
    difficulty: "Core",
    usage: 18,
    status: "Approved",
    lastUpdated: "2 days ago",
    tags: ["Concept Builder", "Misconception"],
    prompt:
      "A passenger in a moving bus leans forward when the bus stops suddenly. Which law explains the motion best?",
    explanation:
      "The body tends to remain in its state of motion due to inertia, which makes Newton's first law the right conceptual anchor.",
  },
  {
    id: "qb-2",
    title: "Atomic structure rapid recall pair",
    subject: "Chemistry",
    className: "Class 11",
    chapter: "Structure of Atom",
    section: "2",
    format: "Assertion",
    difficulty: "Focused",
    usage: 11,
    status: "Approved",
    lastUpdated: "Today",
    tags: ["Rapid Revision", "Recall"],
    prompt:
      "Assertion: Electrons revolve around the nucleus in fixed circular paths. Reason: Every orbit has a fixed energy value.",
    explanation:
      "The statement is framed to quickly surface whether the learner still remembers the Bohr model and orbit-energy linkage.",
  },
  {
    id: "qb-3",
    title: "Calculus board-pattern long answer",
    subject: "Mathematics",
    className: "Class 12",
    chapter: "Calculus",
    section: "3",
    format: "Long Answer",
    difficulty: "Advanced",
    usage: 7,
    status: "Needs Review",
    lastUpdated: "Yesterday",
    tags: ["Board Pattern", "Exam Style"],
    prompt:
      "Differentiate the function and interpret the rate of change at the given point, then connect it to a real-world application.",
    explanation:
      "This item is useful for board-style depth but needs tighter mark allocation and a cleaner final instruction.",
  },
  {
    id: "qb-4",
    title: "Organic chemistry reagent memory booster",
    subject: "Chemistry",
    className: "Class 12",
    chapter: "Organic Chemistry",
    section: "4",
    format: "Flash Recall",
    difficulty: "Core",
    usage: 23,
    status: "Approved",
    lastUpdated: "1 day ago",
    tags: ["Memory Booster", "Reagent Recall"],
    prompt:
      "Match each reagent to the most likely transformation outcome in one-pass rapid recall mode.",
    explanation:
      "This question works best in short revision loops where students need retrieval over long solution-writing.",
  },
  {
    id: "qb-5",
    title: "Electrostatics weak-area retry prompt",
    subject: "Physics",
    className: "Class 12",
    chapter: "Electrostatics",
    section: "2",
    format: "Numerical",
    difficulty: "Focused",
    usage: 14,
    status: "Draft",
    lastUpdated: "Today",
    tags: ["Weak Area Retry", "Numerical"],
    prompt:
      "Calculate the electric field at the given point after identifying the sign and direction of each charge contribution.",
    explanation:
      "This item is aimed at students who repeatedly miss sign convention and vector direction in field calculations.",
  },
  {
    id: "qb-6",
    title: "Genetics concept-bridge case",
    subject: "Biology",
    className: "Class 12",
    chapter: "Genetics",
    section: "1",
    format: "Case Study",
    difficulty: "Balanced",
    usage: 9,
    status: "Approved",
    lastUpdated: "3 days ago",
    tags: ["Concept Builder", "Case Study"],
    prompt:
      "Read the inheritance scenario and identify which evidence supports dominant, recessive, and carrier patterns.",
    explanation:
      "The case study format helps students connect textbook rules to a more realistic inheritance pattern.",
  },
];

const filterOptions = {
  subject: ["All subjects", "Physics", "Chemistry", "Mathematics", "Biology"],
  className: ["All classes", "Class 11", "Class 12"],
  format: ["All formats", "MCQ", "Assertion", "Long Answer", "Flash Recall", "Numerical", "Case Study"],
  difficulty: ["All levels", "Core", "Balanced", "Focused", "Advanced"],
  status: ["All statuses", "Approved", "Needs Review", "Draft"],
};

const tagClassMap = {
  "Concept Builder": "concept-builder",
  "Rapid Revision": "rapid-revision",
  "Board Pattern": "board-pattern",
  "Weak Area Retry": "weak-area-retry",
  "Memory Booster": "memory-booster",
};

export const AdminQuestionBankPage = () => {
  const [filters, setFilters] = useState({
    query: "",
    subject: filterOptions.subject[0],
    className: filterOptions.className[0],
    format: filterOptions.format[0],
    difficulty: filterOptions.difficulty[0],
    status: filterOptions.status[0],
  });
  const [activeId, setActiveId] = useState(questionLibrary[0]?.id ?? null);

  const filteredQuestions = useMemo(() => {
    return questionLibrary.filter((item) => {
      const matchesQuery =
        !filters.query ||
        [item.title, item.chapter, item.subject, item.format, item.tags.join(" ")]
          .join(" ")
          .toLowerCase()
          .includes(filters.query.toLowerCase());

      const matchesSubject =
        filters.subject === filterOptions.subject[0] || item.subject === filters.subject;
      const matchesClass =
        filters.className === filterOptions.className[0] ||
        item.className === filters.className;
      const matchesFormat =
        filters.format === filterOptions.format[0] || item.format === filters.format;
      const matchesDifficulty =
        filters.difficulty === filterOptions.difficulty[0] ||
        item.difficulty === filters.difficulty;
      const matchesStatus =
        filters.status === filterOptions.status[0] || item.status === filters.status;

      return (
        matchesQuery &&
        matchesSubject &&
        matchesClass &&
        matchesFormat &&
        matchesDifficulty &&
        matchesStatus
      );
    });
  }, [filters]);

  const activeQuestion =
    filteredQuestions.find((item) => item.id === activeId) ?? filteredQuestions[0] ?? null;

  const summary = useMemo(
    () => ({
      total: questionLibrary.length,
      approved: questionLibrary.filter((item) => item.status === "Approved").length,
      review: questionLibrary.filter((item) => item.status === "Needs Review").length,
      drafts: questionLibrary.filter((item) => item.status === "Draft").length,
    }),
    [],
  );

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      query: "",
      subject: filterOptions.subject[0],
      className: filterOptions.className[0],
      format: filterOptions.format[0],
      difficulty: filterOptions.difficulty[0],
      status: filterOptions.status[0],
    });
  };

  return (
    <section className="admin-question-bank-page">
      <div className="admin-question-bank-hero">
        <div>
          <span className="eyebrow">Admin module</span>
          <h1>Question Bank</h1>
          <p>
            Review reusable questions, spot gaps by chapter, and route the right
            inventory into assessment creation.
          </p>
        </div>
        <div className="admin-question-bank-hero-card">
          <p>Current opportunity</p>
          <strong>Chemistry recall questions are healthy, but Physics retry inventory still needs more depth.</strong>
        </div>
      </div>

      <section className="admin-question-bank-summary-grid">
        <article className="admin-question-bank-summary-card">
          <strong>{summary.total}</strong>
          <span>Total reusable questions</span>
        </article>
        <article className="admin-question-bank-summary-card">
          <strong>{summary.approved}</strong>
          <span>Approved and ready</span>
        </article>
        <article className="admin-question-bank-summary-card">
          <strong>{summary.review}</strong>
          <span>Need review</span>
        </article>
        <article className="admin-question-bank-summary-card">
          <strong>{summary.drafts}</strong>
          <span>Still in draft</span>
        </article>
      </section>

      <section className="admin-panel admin-question-bank-filter-panel">
        <div className="admin-panel-head">
          <h2>Filter library</h2>
          <span>Search by chapter, format, difficulty, and review state</span>
        </div>

        <div className="admin-question-bank-filter-grid">
          <label className="admin-filter-field admin-question-bank-search">
            <span>Search</span>
            <input
              type="search"
              placeholder="Search title, chapter, subject, or tag"
              value={filters.query}
              onChange={(event) => updateFilter("query", event.target.value)}
            />
          </label>

          <label className="admin-filter-field">
            <span>Subject</span>
            <select
              value={filters.subject}
              onChange={(event) => updateFilter("subject", event.target.value)}
            >
              {filterOptions.subject.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>

          <label className="admin-filter-field">
            <span>Class</span>
            <select
              value={filters.className}
              onChange={(event) => updateFilter("className", event.target.value)}
            >
              {filterOptions.className.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>

          <label className="admin-filter-field">
            <span>Format</span>
            <select
              value={filters.format}
              onChange={(event) => updateFilter("format", event.target.value)}
            >
              {filterOptions.format.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>

          <label className="admin-filter-field">
            <span>Difficulty</span>
            <select
              value={filters.difficulty}
              onChange={(event) => updateFilter("difficulty", event.target.value)}
            >
              {filterOptions.difficulty.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>

          <label className="admin-filter-field">
            <span>Status</span>
            <select
              value={filters.status}
              onChange={(event) => updateFilter("status", event.target.value)}
            >
              {filterOptions.status.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="admin-question-bank-filter-footer">
          <span>
            {filteredQuestions.length} question{filteredQuestions.length === 1 ? "" : "s"} match
            the current filters
          </span>
          <button type="button" className="ghost-button" onClick={clearFilters}>
            Clear Filters
          </button>
        </div>
      </section>

      <section className="admin-question-bank-layout">
        <div className="admin-panel admin-question-bank-list-panel">
          <div className="admin-panel-head">
            <h2>Question inventory</h2>
            <span>Tap a question to inspect and route it</span>
          </div>

          <div className="admin-question-bank-list">
            {filteredQuestions.length ? (
              filteredQuestions.map((item) => (
                <article
                  key={item.id}
                  className={`admin-question-card ${
                    item.id === activeQuestion?.id ? "is-active" : ""
                  }`}
                  onClick={() => setActiveId(item.id)}
                >
                  <div className="admin-question-card-head">
                    <div>
                      <strong>{item.title}</strong>
                      <p>
                        {item.subject} | {item.className} | {item.chapter}
                      </p>
                    </div>
                    <span
                      className={`admin-status-pill ${
                        item.status === "Approved"
                          ? "published"
                          : item.status === "Needs Review"
                            ? "pending-review"
                            : "draft"
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>

                  <div className="admin-question-card-tags">
                    {item.tags.map((tag) => (
                      <span
                        key={tag}
                        className={`admin-type-pill ${tagClassMap[tag] || ""}`}
                      >
                        {tag}
                      </span>
                    ))}
                    <span className="admin-meta-pill">{item.format}</span>
                    <span className="admin-meta-pill">{item.difficulty}</span>
                  </div>

                  <div className="admin-question-card-footer">
                    <span>Section {item.section}</span>
                    <span>Used in {item.usage} sets</span>
                    <span>Updated {item.lastUpdated}</span>
                  </div>
                </article>
              ))
            ) : (
              <div className="admin-question-bank-empty-state">
                <strong>No questions match those filters.</strong>
                <p>Broaden the filters to review more reusable inventory.</p>
              </div>
            )}
          </div>
        </div>

        <div className="admin-panel admin-question-bank-detail-panel">
          {activeQuestion ? (
            <>
              <div className="admin-question-detail-head">
                <div>
                  <span className="eyebrow">Question inspector</span>
                  <h2>{activeQuestion.title}</h2>
                  <p>
                    {activeQuestion.subject} | {activeQuestion.className} | {activeQuestion.chapter}
                  </p>
                </div>
                <span
                  className={`admin-status-pill ${
                    activeQuestion.status === "Approved"
                      ? "published"
                      : activeQuestion.status === "Needs Review"
                        ? "pending-review"
                        : "draft"
                  }`}
                >
                  {activeQuestion.status}
                </span>
              </div>

              <section className="admin-question-detail-grid">
                <article className="admin-question-detail-card">
                  <span>Format</span>
                  <strong>{activeQuestion.format}</strong>
                </article>
                <article className="admin-question-detail-card">
                  <span>Difficulty</span>
                  <strong>{activeQuestion.difficulty}</strong>
                </article>
                <article className="admin-question-detail-card">
                  <span>Section</span>
                  <strong>{activeQuestion.section}</strong>
                </article>
                <article className="admin-question-detail-card">
                  <span>Reused in</span>
                  <strong>{activeQuestion.usage} practice sets</strong>
                </article>
              </section>

              <section className="admin-question-detail-stack">
                <div className="admin-question-detail-panel-card">
                  <div className="admin-panel-head">
                    <h3>Prompt</h3>
                    <span>Student-facing question text</span>
                  </div>
                  <p>{activeQuestion.prompt}</p>
                </div>

                <div className="admin-question-detail-panel-card">
                  <div className="admin-panel-head">
                    <h3>Why it belongs in the bank</h3>
                    <span>Editorial explanation</span>
                  </div>
                  <p>{activeQuestion.explanation}</p>
                </div>

                <div className="admin-question-detail-panel-card">
                  <div className="admin-panel-head">
                    <h3>Route next</h3>
                    <span>Use this question in the next creation flow</span>
                  </div>
                  <div className="admin-question-detail-actions">
                    <Link
                      className="primary-button"
                      to={`/admin/assessment-studio?mode=bank&subject=${encodeURIComponent(
                        activeQuestion.subject,
                      )}&class=${encodeURIComponent(
                        activeQuestion.className.replace("Class ", ""),
                      )}&chapter=${encodeURIComponent(
                        activeQuestion.chapter,
                      )}&practiceType=${encodeURIComponent(activeQuestion.tags[0] || "Concept Builder")}`}
                    >
                      Use in Assessment Studio
                    </Link>
                    <button type="button" className="ghost-button">
                      Mark for Review
                    </button>
                    <button type="button" className="ghost-button">
                      Duplicate Question
                    </button>
                  </div>
                </div>
              </section>
            </>
          ) : (
            <div className="admin-question-bank-empty-state">
              <strong>No active question selected.</strong>
              <p>Select a question from the inventory to inspect it in detail.</p>
            </div>
          )}
        </div>
      </section>
    </section>
  );
};
