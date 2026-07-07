import { Link } from "react-router-dom";

const subjectTrends = [
  {
    subject: "Physics",
    completion: "78%",
    weakTopics: 9,
    opportunity: "Current Electricity retry packs are underbuilt.",
    query: "subject=Physics&status=Needs+Improvement",
  },
  {
    subject: "Chemistry",
    completion: "74%",
    weakTopics: 7,
    opportunity: "Organic recall drops after 3-day gaps.",
    query: "subject=Chemistry&type=Memory+Booster",
  },
  {
    subject: "Mathematics",
    completion: "81%",
    weakTopics: 6,
    opportunity: "Probability and Calculus need more board-pattern depth.",
    query: "subject=Mathematics&type=Board+Pattern",
  },
  {
    subject: "Biology",
    completion: "76%",
    weakTopics: 5,
    opportunity: "Genetics revision sets need stronger retry follow-ups.",
    query: "subject=Biology&type=Weak+Area+Retry",
  },
];

const weakTopicClusters = [
  {
    chapter: "Current Electricity",
    subject: "Physics",
    signal: "High retry rate",
    action: "Create Weak Area Retry",
    query: "subject=Physics&q=Current+Electricity",
  },
  {
    chapter: "Organic Chemistry",
    subject: "Chemistry",
    signal: "Recall decay after 72 hours",
    action: "Create Memory Booster",
    query: "subject=Chemistry&q=Organic",
  },
  {
    chapter: "Probability",
    subject: "Mathematics",
    signal: "Low board-pattern accuracy",
    action: "Add Board Pattern set",
    query: "subject=Mathematics&q=Probability",
  },
];

const practiceTypeEffectiveness = [
  { type: "Concept Builder", value: "82%", note: "Best for early concept retention." },
  { type: "Rapid Revision", value: "76%", note: "Strong for quick chapter reactivation." },
  { type: "Board Pattern", value: "71%", note: "Good for exam-style conditioning." },
  { type: "Weak Area Retry", value: "64%", note: "Highest impact on improvement loops." },
];

const opportunityMap = [
  {
    title: "Build more retry packs for Physics",
    detail: "Three Class 12 chapters show retry spikes without supporting retry sets.",
    query: "subject=Physics&status=Needs+Improvement",
  },
  {
    title: "Expand Chemistry memory boosters",
    detail: "Students revisit Organic topics, but booster coverage is thin.",
    query: "subject=Chemistry&type=Memory+Booster",
  },
  {
    title: "Review premium board-pattern depth",
    detail: "High-performing premium sets still have weak final-section accuracy.",
    query: "access=Premium&type=Board+Pattern",
  },
];

export const AdminLearningAnalyticsPage = () => (
  <section className="admin-analytics-page">
    <div className="admin-analytics-hero">
      <div>
        <span className="eyebrow">Admin module</span>
        <h1>Learning Analytics</h1>
        <p>
          Track learning patterns, spot weak-topic clusters, and move directly into
          the practice sets that need attention.
        </p>
      </div>
      <div className="admin-analytics-hero-card">
        <p>Current opportunity</p>
        <strong>Physics retry demand is rising faster than retry-pack coverage.</strong>
      </div>
    </div>

    <section className="admin-analytics-summary-grid">
      <article className="admin-analytics-summary-card">
        <strong>27</strong>
        <span>Weak topic opportunities</span>
      </article>
      <article className="admin-analytics-summary-card">
        <strong>81%</strong>
        <span>Average completion rate</span>
      </article>
      <article className="admin-analytics-summary-card">
        <strong>12</strong>
        <span>Chapters trending downward</span>
      </article>
      <article className="admin-analytics-summary-card">
        <strong>9</strong>
        <span>Sets ready for improvement</span>
      </article>
    </section>

    <section className="admin-analytics-grid">
      <div className="admin-panel">
        <div className="admin-panel-head">
          <h2>Subject trends</h2>
          <span>Completion and weak-topic coverage</span>
        </div>
        <div className="admin-analytics-list">
          {subjectTrends.map((item) => (
            <article key={item.subject} className="admin-analytics-row-card">
              <div>
                <strong>{item.subject}</strong>
                <p>{item.opportunity}</p>
              </div>
              <div className="admin-analytics-row-metrics">
                <span>{item.completion} completion</span>
                <span>{item.weakTopics} weak topics</span>
              </div>
              <Link className="ghost-button" to={`/admin/practice-sets?${item.query}`}>
                View Practice Sets
              </Link>
            </article>
          ))}
        </div>
      </div>

      <div className="admin-panel">
        <div className="admin-panel-head">
          <h2>Weak-topic clusters</h2>
          <span>High-priority chapter signals</span>
        </div>
        <div className="admin-analytics-list">
          {weakTopicClusters.map((item) => (
            <article key={item.chapter} className="admin-analytics-row-card compact">
              <div>
                <strong>
                  {item.chapter} · {item.subject}
                </strong>
                <p>{item.signal}</p>
              </div>
              <span className="admin-analytics-action-pill">{item.action}</span>
              <Link className="ghost-button" to={`/admin/practice-sets?${item.query}`}>
                Investigate
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>

    <section className="admin-analytics-grid">
      <div className="admin-panel">
        <div className="admin-panel-head">
          <h2>Practice type effectiveness</h2>
          <span>Which formats are helping most</span>
        </div>
        <div className="admin-effectiveness-grid">
          {practiceTypeEffectiveness.map((item) => (
            <article key={item.type} className="admin-effectiveness-card">
              <strong>{item.type}</strong>
              <span>{item.value}</span>
              <p>{item.note}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="admin-panel">
        <div className="admin-panel-head">
          <h2>Opportunity map</h2>
          <span>Fastest routes to new content value</span>
        </div>
        <div className="admin-analytics-list">
          {opportunityMap.map((item) => (
            <article key={item.title} className="admin-analytics-row-card">
              <div>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
              </div>
              <Link className="ghost-button" to={`/admin/practice-sets?${item.query}`}>
                Open Matching Sets
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  </section>
);
