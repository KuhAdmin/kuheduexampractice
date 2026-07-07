import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

const initialPracticeSets = [
  {
    id: "motion-foundations",
    title: "Motion Foundations",
    subject: "Physics",
    className: "Class 11",
    chapter: "Laws of Motion",
    type: "Concept Builder",
    status: "Published",
    premium: "Free",
    difficulty: "Core",
    questions: 20,
    duration: "25 min",
    accuracy: "82%",
    averageScore: "71%",
    students: 186,
    completed: "92%",
    retryRate: "18%",
    weakQuestions: ["Question 8", "Question 12", "Question 16"],
    suggestion: "Create Retry Pack",
    lastUpdated: "2 days ago",
    needsWork: false,
  },
  {
    id: "atomic-structure",
    title: "Atomic Structure",
    subject: "Chemistry",
    className: "Class 11",
    chapter: "Structure of Atom",
    type: "Rapid Revision",
    status: "Draft",
    premium: "Premium",
    difficulty: "Core",
    questions: 15,
    duration: "18 min",
    accuracy: "Incomplete",
    averageScore: "Draft",
    students: 0,
    completed: "0%",
    retryRate: "-",
    weakQuestions: ["Question selection incomplete"],
    suggestion: "Complete draft and send for review",
    lastUpdated: "Today",
    needsWork: true,
  },
  {
    id: "calculus-timed-mock",
    title: "Calculus Timed Mock",
    subject: "Mathematics",
    className: "Class 12",
    chapter: "Differentiation",
    type: "Board Pattern",
    status: "Published",
    premium: "Premium",
    difficulty: "Advanced",
    questions: 30,
    duration: "45 min",
    accuracy: "76%",
    averageScore: "74%",
    students: 241,
    completed: "88%",
    retryRate: "21%",
    weakQuestions: ["Question 5", "Question 14", "Question 22"],
    suggestion: "Add Board Pattern revision set",
    lastUpdated: "Yesterday",
    needsWork: false,
  },
  {
    id: "genetics-concept-check",
    title: "Genetics Concept Check",
    subject: "Biology",
    className: "Class 12",
    chapter: "Genetics",
    type: "Concept Builder",
    status: "Pending Review",
    premium: "Free",
    difficulty: "Core",
    questions: 18,
    duration: "22 min",
    accuracy: "71%",
    averageScore: "68%",
    students: 97,
    completed: "81%",
    retryRate: "24%",
    weakQuestions: ["Question 4", "Question 9", "Question 13"],
    suggestion: "Move to editorial review with stronger retry prompts",
    lastUpdated: "4 hours ago",
    needsWork: true,
  },
  {
    id: "electrostatics-retry-pack",
    title: "Electrostatics Retry Pack",
    subject: "Physics",
    className: "Class 12",
    chapter: "Electrostatics",
    type: "Weak Area Retry",
    status: "Published",
    premium: "Premium",
    difficulty: "Focused",
    questions: 16,
    duration: "20 min",
    accuracy: "58%",
    averageScore: "61%",
    students: 154,
    completed: "73%",
    retryRate: "39%",
    weakQuestions: ["Question 3", "Question 7", "Question 11"],
    suggestion: "Create Weak Area Retry follow-up",
    lastUpdated: "1 day ago",
    needsWork: true,
  },
  {
    id: "organic-memory-booster",
    title: "Organic Memory Booster",
    subject: "Chemistry",
    className: "Class 12",
    chapter: "Haloalkanes",
    type: "Memory Booster",
    status: "AI Enhanced",
    premium: "Premium",
    difficulty: "Focused",
    questions: 12,
    duration: "15 min",
    accuracy: "Pending launch",
    averageScore: "Pending launch",
    students: 0,
    completed: "0%",
    retryRate: "-",
    weakQuestions: ["Awaiting first cohort"],
    suggestion: "Publish after editorial review",
    lastUpdated: "Today",
    needsWork: false,
  },
];

const aiSuggestions = [
  {
    title: "Current Electricity",
    subject: "Physics",
    className: "Class 12",
    chapter: "Current Electricity",
    type: "Weak Area Retry",
    detail: "High retry rate across Class 12 Physics",
    recommendation: "Create Weak Area Retry",
  },
  {
    title: "Organic Chemistry",
    subject: "Chemistry",
    className: "Class 12",
    chapter: "Organic Chemistry",
    type: "Memory Booster",
    detail: "Falling recall after 3-day gap",
    recommendation: "Create Memory Booster",
  },
  {
    title: "Probability",
    subject: "Mathematics",
    className: "Class 12",
    chapter: "Probability",
    type: "Board Pattern",
    detail: "Repeated low accuracy in board-style attempts",
    recommendation: "Add Board Pattern revision set",
  },
];

const subjectOptions = ["All subjects", "Physics", "Chemistry", "Mathematics", "Biology"];
const classOptions = ["All classes", "Class 11", "Class 12"];
const typeOptions = [
  "All types",
  "Concept Builder",
  "Rapid Revision",
  "Board Pattern",
  "Full Mock",
  "Weak Area Retry",
  "Memory Booster",
];
const statusOptions = [
  "All statuses",
  "Draft",
  "AI Enhanced",
  "Pending Review",
  "Published",
  "Needs Improvement",
  "Archived",
];
const premiumOptions = ["All access", "Free", "Premium"];
const difficultyOptions = ["All difficulty", "Core", "Focused", "Advanced"];

const getStatusClass = (status, needsWork) => {
  if (needsWork && status === "Published") {
    return "needs-improvement";
  }

  return status.toLowerCase().replaceAll(" ", "-");
};

export const AdminPracticeSetsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [sets, setSets] = useState(initialPracticeSets);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkMessage, setBulkMessage] = useState("");
  const [activeAnalyticsId, setActiveAnalyticsId] = useState(null);

  const query = searchParams.get("q") || "";
  const subject = searchParams.get("subject") || subjectOptions[0];
  const className = searchParams.get("class") || classOptions[0];
  const type = searchParams.get("type") || typeOptions[0];
  const status = searchParams.get("status") || statusOptions[0];
  const premium = searchParams.get("access") || premiumOptions[0];
  const difficulty = searchParams.get("difficulty") || difficultyOptions[0];

  const updateFilterParam = (key, value, defaultValue) => {
    const nextParams = new URLSearchParams(searchParams);

    if (!value || value === defaultValue) {
      nextParams.delete(key);
    } else {
      nextParams.set(key, value);
    }

    setSearchParams(nextParams);
  };

  const clearFilters = () => {
    setSearchParams(new URLSearchParams());
    setBulkMessage("");
  };

  const filteredSets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return sets.filter((item) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        [item.title, item.subject, item.chapter, item.type]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      const matchesSubject = subject === subjectOptions[0] || item.subject === subject;
      const matchesClass = className === classOptions[0] || item.className === className;
      const matchesType = type === typeOptions[0] || item.type === type;
      const matchesStatus =
        status === statusOptions[0] ||
        (status === "Needs Improvement" ? item.needsWork : item.status === status);
      const matchesPremium = premium === premiumOptions[0] || item.premium === premium;
      const matchesDifficulty =
        difficulty === difficultyOptions[0] || item.difficulty === difficulty;

      return (
        matchesQuery &&
        matchesSubject &&
        matchesClass &&
        matchesType &&
        matchesStatus &&
        matchesPremium &&
        matchesDifficulty
      );
    });
  }, [className, difficulty, premium, query, sets, status, subject, type]);

  useEffect(() => {
    setSelectedIds((current) =>
      current.filter((id) => filteredSets.some((item) => item.id === id))
    );
  }, [filteredSets]);

  useEffect(() => {
    if (activeAnalyticsId && !sets.some((item) => item.id === activeAnalyticsId)) {
      setActiveAnalyticsId(null);
    }
  }, [activeAnalyticsId, sets]);

  const filteredIds = filteredSets.map((item) => item.id);
  const activeAnalyticsSet = sets.find((item) => item.id === activeAnalyticsId) || null;
  const allVisibleSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selectedIds.includes(id));

  const toggleSelection = (id) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  const toggleSelectAllVisible = () => {
    setSelectedIds((current) =>
      allVisibleSelected
        ? current.filter((id) => !filteredIds.includes(id))
        : [...new Set([...current, ...filteredIds])]
    );
  };

  const openStudioWithAiSuggestion = (payload) => {
    const params = new URLSearchParams({
      mode: "ai",
      subject: payload.subject,
      class: payload.className.replace("Class ", ""),
      chapter: payload.chapter,
      practiceType: payload.type,
      recommendation: payload.recommendation,
    });
    navigate(`/admin/assessment-studio?${params.toString()}`);
  };

  const openStudioWithAnalyticsAction = (item, mode) => {
    const params = new URLSearchParams({
      mode,
      subject: item.subject,
      class: item.className.replace("Class ", ""),
      chapter: item.chapter,
      practiceType:
        mode === "retry"
          ? "Weak Area Retry"
          : mode === "memory"
            ? "Memory Booster"
            : item.type,
      fromSet: item.title,
    });
    navigate(`/admin/assessment-studio?${params.toString()}`);
    setActiveAnalyticsId(null);
  };

  const applyBulkAction = (action) => {
    if (!selectedIds.length) {
      return;
    }

    if (action === "export") {
      setBulkMessage(`Prepared ${selectedIds.length} practice sets for export.`);
      return;
    }

    if (action === "clone") {
      const clones = sets
        .filter((item) => selectedIds.includes(item.id))
        .map((item, index) => ({
          ...item,
          id: `${item.id}-clone-${Date.now()}-${index}`,
          title: `${item.title} (Clone)`,
          status: "Draft",
          lastUpdated: "Just now",
          needsWork: false,
        }));

      setSets((current) => [...clones, ...current]);
      setBulkMessage(`Cloned ${clones.length} practice sets into Draft.`);
      setSelectedIds([]);
      return;
    }

    const actionMap = {
      publish: { status: "Published", needsWork: false, message: "Published" },
      archive: { status: "Archived", needsWork: false, message: "Archived" },
      moveToDraft: { status: "Draft", needsWork: false, message: "Moved to Draft" },
    };

    const nextAction = actionMap[action];
    if (!nextAction) {
      return;
    }

    setSets((current) =>
      current.map((item) =>
        selectedIds.includes(item.id)
          ? {
              ...item,
              status: nextAction.status,
              needsWork: nextAction.needsWork,
              lastUpdated: "Just now",
            }
          : item
      )
    );
    setBulkMessage(`${nextAction.message} ${selectedIds.length} practice sets.`);
    setSelectedIds([]);
  };

  return (
    <section className="admin-practice-sets-page">
      <div className="admin-practice-header">
        <div>
          <span className="eyebrow">Admin module</span>
          <h1>Practice Sets</h1>
          <p>Create, manage and improve chapter-wise practice for KUHEDU.</p>
        </div>
        <Link className="primary-button admin-practice-cta" to="/admin/assessment-studio">
          + New Practice Set
        </Link>
      </div>

      <div className="admin-practice-filter-panel">
        <div className="admin-practice-search-row">
          <label className="admin-filter-field admin-filter-search">
            <span>Search</span>
            <input
              type="search"
              placeholder="Search by title, chapter, subject, or type"
              value={query}
              onChange={(event) => updateFilterParam("q", event.target.value, "")}
            />
          </label>
        </div>

        <div className="admin-practice-filter-grid">
          <label className="admin-filter-field">
            <span>Subject</span>
            <select
              value={subject}
              onChange={(event) =>
                updateFilterParam("subject", event.target.value, subjectOptions[0])
              }
            >
              {subjectOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-filter-field">
            <span>Class</span>
            <select
              value={className}
              onChange={(event) =>
                updateFilterParam("class", event.target.value, classOptions[0])
              }
            >
              {classOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-filter-field">
            <span>Practice Type</span>
            <select
              value={type}
              onChange={(event) =>
                updateFilterParam("type", event.target.value, typeOptions[0])
              }
            >
              {typeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-filter-field">
            <span>Status</span>
            <select
              value={status}
              onChange={(event) =>
                updateFilterParam("status", event.target.value, statusOptions[0])
              }
            >
              {statusOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-filter-field">
            <span>Access</span>
            <select
              value={premium}
              onChange={(event) =>
                updateFilterParam("access", event.target.value, premiumOptions[0])
              }
            >
              {premiumOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-filter-field">
            <span>Difficulty</span>
            <select
              value={difficulty}
              onChange={(event) =>
                updateFilterParam("difficulty", event.target.value, difficultyOptions[0])
              }
            >
              {difficultyOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="admin-practice-filter-footer">
          <span>
            {filteredSets.length} result{filteredSets.length === 1 ? "" : "s"} with current
            filters
          </span>
          <button className="ghost-button" type="button" onClick={clearFilters}>
            Clear Filters
          </button>
        </div>
      </div>

      <section className="admin-practice-summary-grid">
        <article className="admin-practice-summary-card">
          <strong>128</strong>
          <span>Published</span>
        </article>
        <article className="admin-practice-summary-card">
          <strong>14</strong>
          <span>Drafts</span>
        </article>
        <article className="admin-practice-summary-card">
          <strong>5</strong>
          <span>Pending Review</span>
        </article>
        <article className="admin-practice-summary-card">
          <strong>27</strong>
          <span>Weak Topic Opportunities</span>
        </article>
      </section>

      <section className="admin-practice-ai-panel">
        <div className="admin-panel-head">
          <h2>AI Suggestions</h2>
          <span>Analytics-driven opportunities</span>
        </div>
        <div className="admin-practice-ai-grid">
          {aiSuggestions.map((item) => (
            <article key={item.title} className="admin-practice-ai-card">
              <strong>{item.title}</strong>
              <p>{item.detail}</p>
              <span>{item.recommendation}</span>
              <button
                className="ghost-button admin-ai-action"
                type="button"
                onClick={() => openStudioWithAiSuggestion(item)}
              >
                Create
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-practice-results">
        <div className="admin-panel-head">
          <h2>Practice Set Cards</h2>
          <div className="admin-practice-results-tools">
            <button
              className="ghost-button"
              type="button"
              onClick={toggleSelectAllVisible}
            >
              {allVisibleSelected ? "Clear Visible Selection" : "Select All Visible"}
            </button>
            <span>{filteredSets.length} results</span>
          </div>
        </div>

        {selectedIds.length ? (
          <div className="admin-bulk-toolbar">
            <div>
              <strong>{selectedIds.length} selected</strong>
              <span>Bulk actions apply only to the currently selected practice sets.</span>
            </div>
            <div className="admin-bulk-actions">
              <button className="ghost-button" type="button" onClick={() => applyBulkAction("publish")}>
                Publish
              </button>
              <button className="ghost-button" type="button" onClick={() => applyBulkAction("archive")}>
                Archive
              </button>
              <button className="ghost-button" type="button" onClick={() => applyBulkAction("clone")}>
                Clone
              </button>
              <button className="ghost-button" type="button" onClick={() => applyBulkAction("moveToDraft")}>
                Move to Draft
              </button>
              <button className="ghost-button" type="button" onClick={() => applyBulkAction("export")}>
                Export
              </button>
            </div>
          </div>
        ) : null}

        {bulkMessage ? <p className="admin-bulk-message">{bulkMessage}</p> : null}

        {filteredSets.length ? (
          <div className="admin-practice-card-grid">
            {filteredSets.map((item) => (
              <article
                key={item.id}
                className={`admin-practice-card admin-practice-card-${item.type
                  .toLowerCase()
                  .replaceAll(" ", "-")} ${
                  selectedIds.includes(item.id) ? "is-selected" : ""
                }`}
              >
                <div className="admin-practice-card-head">
                  <div>
                    <h3>{item.title}</h3>
                    <p>
                      {item.subject} · {item.className} · {item.chapter}
                    </p>
                  </div>
                  <div className="admin-practice-card-head-controls">
                    <label className="admin-card-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(item.id)}
                        onChange={() => toggleSelection(item.id)}
                      />
                      <span>Select</span>
                    </label>
                    <span
                      className={`admin-status-pill ${getStatusClass(
                        item.status,
                        item.needsWork
                      )}`}
                    >
                      {item.needsWork && item.status === "Published"
                        ? "Needs Improvement"
                        : item.status}
                    </span>
                  </div>
                </div>

                <div className="admin-practice-card-tags">
                  <span className="admin-type-pill">{item.type}</span>
                  <span className="admin-meta-pill">{item.premium}</span>
                  <span className="admin-meta-pill">{item.difficulty}</span>
                </div>

                <div className="admin-practice-metrics">
                  <div>
                    <span>Questions</span>
                    <strong>{item.questions}</strong>
                  </div>
                  <div>
                    <span>Time</span>
                    <strong>{item.duration}</strong>
                  </div>
                  <div>
                    <span>Avg Accuracy</span>
                    <strong>{item.accuracy}</strong>
                  </div>
                  <div>
                    <span>Retry Rate</span>
                    <strong>{item.retryRate}</strong>
                  </div>
                </div>

                <div className="admin-practice-card-footer">
                  <span>Last updated {item.lastUpdated}</span>
                  <div className="admin-practice-actions">
                    <button className="ghost-button" type="button">
                      {item.status === "Draft" ? "Continue" : "Edit"}
                    </button>
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => setActiveAnalyticsId(item.id)}
                    >
                      Analytics
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="admin-practice-empty-state">
            <strong>No practice sets match those filters.</strong>
            <p>Try widening the filters or clearing the search to see more sets.</p>
          </div>
        )}
      </section>

      {activeAnalyticsSet ? (
        <div
          className="admin-analytics-modal-backdrop"
          role="presentation"
          onClick={() => setActiveAnalyticsId(null)}
        >
          <aside
            className="admin-analytics-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="analytics-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="admin-analytics-head">
              <div>
                <span className="eyebrow">Analytics</span>
                <h3 id="analytics-title">{activeAnalyticsSet.title}</h3>
                <p>
                  {activeAnalyticsSet.subject} · {activeAnalyticsSet.className} ·{" "}
                  {activeAnalyticsSet.type}
                </p>
              </div>
              <button
                className="close-button admin-drawer-close"
                type="button"
                onClick={() => setActiveAnalyticsId(null)}
              >
                x
              </button>
            </div>

            <div className="admin-analytics-metrics">
              <div>
                <span>Students</span>
                <strong>{activeAnalyticsSet.students}</strong>
              </div>
              <div>
                <span>Completed</span>
                <strong>{activeAnalyticsSet.completed}</strong>
              </div>
              <div>
                <span>Average Score</span>
                <strong>{activeAnalyticsSet.averageScore}</strong>
              </div>
              <div>
                <span>Retry Rate</span>
                <strong>{activeAnalyticsSet.retryRate}</strong>
              </div>
            </div>

            <div className="admin-analytics-section">
              <strong>Weak Questions</strong>
              <div className="admin-analytics-chip-list">
                {activeAnalyticsSet.weakQuestions.map((item) => (
                  <span key={item} className="admin-analytics-chip">
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="admin-analytics-section">
              <strong>Suggestion</strong>
              <p>{activeAnalyticsSet.suggestion}</p>
            </div>

            <div className="admin-analytics-actions">
              <button
                className="primary-button"
                type="button"
                onClick={() => openStudioWithAnalyticsAction(activeAnalyticsSet, "retry")}
              >
                Create Retry Pack
              </button>
              <button
                className="ghost-button"
                type="button"
                onClick={() => openStudioWithAnalyticsAction(activeAnalyticsSet, "duplicate")}
              >
                Duplicate Existing
              </button>
              <button
                className="ghost-button"
                type="button"
                onClick={() => openStudioWithAnalyticsAction(activeAnalyticsSet, "ai")}
              >
                Open Assessment Studio
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      <Link className="primary-button admin-practice-floating-cta" to="/admin/assessment-studio">
        + New Practice Set
      </Link>
    </section>
  );
};
