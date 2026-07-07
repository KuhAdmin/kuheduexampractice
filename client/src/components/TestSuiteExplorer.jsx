import { useMemo, useState } from "react";
import { motion } from "framer-motion";

const testSuites = [
  {
    id: "phy-11-motion-foundation",
    title: "Motion Foundations Drill",
    subject: "Physics",
    grade: "Class 11",
    examType: "Chapter Test",
    badge: "Concept Builder",
    duration: "25 min",
    questions: 20,
  },
  {
    id: "chem-11-atomic-structure",
    title: "Atomic Structure Rapid Revision",
    subject: "Chemistry",
    grade: "Class 11",
    examType: "Revision Set",
    badge: "Rapid Revision",
    duration: "18 min",
    questions: 15,
  },
  {
    id: "math-12-calculus-mock",
    title: "Calculus Timed Mock",
    subject: "Mathematics",
    grade: "Class 12",
    examType: "Full Mock",
    badge: "Board Pattern",
    duration: "45 min",
    questions: 30,
  },
  {
    id: "bio-12-genetics-focus",
    title: "Genetics Concept Check",
    subject: "Biology",
    grade: "Class 12",
    examType: "Chapter Test",
    badge: "Concept Builder",
    duration: "22 min",
    questions: 18,
  },
  {
    id: "phy-12-electrostatics-retry",
    title: "Electrostatics Retry Pack",
    subject: "Physics",
    grade: "Class 12",
    examType: "Weak Area Retry",
    badge: "Weak Area Retry",
    duration: "20 min",
    questions: 16,
  },
  {
    id: "chem-12-organic-mastery",
    title: "Organic Chemistry Mastery Set",
    subject: "Chemistry",
    grade: "Class 12",
    examType: "Full Mock",
    badge: "Board Pattern",
    duration: "40 min",
    questions: 28,
  },
];

const filterOptions = {
  subject: ["All subjects", "Physics", "Chemistry", "Mathematics", "Biology"],
  grade: ["All classes", "Class 11", "Class 12"],
  examType: [
    "All test types",
    "Chapter Test",
    "Revision Set",
    "Full Mock",
    "Weak Area Retry",
  ],
};

const subjectShare = [
  { label: "Physics", icon: "⚡" },
  { label: "Chemistry", icon: "🧪" },
  { label: "Mathematics", icon: "📐" },
  { label: "Biology", icon: "🧬" },
];

export const TestSuiteExplorer = ({ onAuthOpen, user }) => {
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState(filterOptions.subject[0]);
  const [grade, setGrade] = useState(filterOptions.grade[0]);
  const [examType, setExamType] = useState(filterOptions.examType[0]);

  const filteredSuites = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return testSuites.filter((suite) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        [suite.title, suite.subject, suite.grade, suite.examType]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);

      const matchesSubject =
        subject === filterOptions.subject[0] || suite.subject === subject;
      const matchesGrade =
        grade === filterOptions.grade[0] || suite.grade === grade;
      const matchesExamType =
        examType === filterOptions.examType[0] || suite.examType === examType;

      return matchesQuery && matchesSubject && matchesGrade && matchesExamType;
    });
  }, [examType, grade, query, subject]);

  const applySubject = (nextSubject) => {
    setSubject(nextSubject);
  };

  return (
    <section className="suite-explorer" id="test-suites">
      <motion.div
        className="suite-explorer-hero"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.25 }}
      >
        <div className="suite-explorer-copy">
          <span className="eyebrow">Test suite discovery</span>
          <h2>
            Practice what matters most.
            <br />
            Find chapter-wise practice sets
            <br />
            for CBSE Class 11 & 12.
          </h2>
          <p>
            Choose a subject, pick a chapter,
            <br />
            and jump straight into focused practice.
          </p>
        </div>

        {!user ? (
          <div className="premium-card premium-card-hero">
            <p>Unlock Unlimited Practice</p>
            <ul className="premium-list">
              <li>Unlimited Practice</li>
              <li>1000+ Practice Sets</li>
              <li>Full Mock Tests</li>
              <li>Memory Booster Sets</li>
            </ul>
            <strong>Rs. 500/month</strong>
            <button className="primary-button premium-button" onClick={onAuthOpen}>
              Upgrade
            </button>
          </div>
        ) : null}
      </motion.div>

      <motion.div
        className="suite-filter-shell"
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.15 }}
      >
        <div className="suite-insight-strip">
          <div className="suite-insight-card">
            <p>Students are Practicing</p>
            <strong>🔥 Calculus Timed Mock</strong>
          </div>
          <div className="suite-insight-card">
            <div className="distribution-header">
              <p>Popular Subjects</p>
              <strong>Start here</strong>
            </div>
            <div className="subject-chip-grid">
              {subjectShare.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className={`subject-chip ${subject === item.label ? "is-active" : ""}`}
                  onClick={() => applySubject(item.label)}
                >
                  <i>{item.icon}</i>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="suite-filter-grid">
          <label className="suite-filter search-filter">
            <span>Search test suites</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by chapter, subject, or format"
            />
          </label>

          <label className="suite-filter">
            <span>Subject</span>
            <select value={subject} onChange={(event) => setSubject(event.target.value)}>
              {filterOptions.subject.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="suite-filter">
            <span>Class</span>
            <select value={grade} onChange={(event) => setGrade(event.target.value)}>
              {filterOptions.grade.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="suite-filter">
            <span>Test type</span>
            <select
              value={examType}
              onChange={(event) => setExamType(event.target.value)}
            >
              {filterOptions.examType.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="suite-results-header">
          <p>
            {filteredSuites.length} suite{filteredSuites.length === 1 ? "" : "s"} match
            your filters
          </p>
          {user ? (
            <button className="ghost-button" onClick={onAuthOpen}>
              Open dashboard
            </button>
          ) : null}
        </div>

        <div className="suite-card-grid">
          {filteredSuites.map((suite, index) => (
            <motion.article
              key={suite.id}
              className={`suite-card suite-card-${suite.badge
                .toLowerCase()
                .replaceAll(" ", "-")}`}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.35, delay: index * 0.04 }}
            >
              <div className="suite-card-topline">
                <span>{suite.subject}</span>
                <span>{suite.grade}</span>
              </div>
              <div className="suite-badge-row">
                <span className="suite-badge">{suite.badge}</span>
              </div>
              <h3>{suite.title}</h3>
              <p>{suite.examType}</p>
              <div className="suite-meta">
                <strong>{suite.questions} questions</strong>
                <strong>{suite.duration}</strong>
              </div>
            </motion.article>
          ))}
        </div>

        {filteredSuites.length === 0 ? (
          <div className="suite-empty-state">
            <p>No suites match that combination yet. Try widening one of the filters.</p>
          </div>
        ) : null}
      </motion.div>
    </section>
  );
};
