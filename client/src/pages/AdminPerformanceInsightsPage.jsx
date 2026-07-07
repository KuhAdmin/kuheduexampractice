import { Link } from "react-router-dom";

const trendCards = [
  {
    title: "Completion stability",
    value: "79%",
    note: "Weekly average completion across all active practice sets.",
  },
  {
    title: "Retry lift",
    value: "+12%",
    note: "Weak-area retry packs are improving second-attempt performance.",
  },
  {
    title: "Premium depth",
    value: "68%",
    note: "Premium board-pattern sets still lag in final-section accuracy.",
  },
  {
    title: "Revision return",
    value: "3.4 days",
    note: "Average time before learners return to the same chapter family.",
  },
];

const funnelSignals = [
  {
    step: "Chapter viewed",
    value: "100%",
    detail: "Learners are consistently reaching practice discovery from chapter study.",
  },
  {
    step: "Practice started",
    value: "72%",
    detail: "Start rate is healthy, but Biology chapters still trail on first attempt momentum.",
  },
  {
    step: "Practice completed",
    value: "58%",
    detail: "Longer board-pattern sets create the largest completion drop-off.",
  },
  {
    step: "Retry attempted",
    value: "31%",
    detail: "Retry adoption improves when weak-area follow-ups are available immediately.",
  },
];

const atRiskSets = [
  {
    title: "Calculus Timed Mock",
    signal: "High finish drop in final section",
    action: "Tighten the last 2 questions or split into staged difficulty.",
    link: "/admin/practice-sets?subject=Mathematics&q=Calculus&type=Board+Pattern",
  },
  {
    title: "Organic Chemistry Mastery Set",
    signal: "Good starts, weak memory retention after 72 hours",
    action: "Add a paired Memory Booster follow-up pack.",
    link: "/admin/practice-sets?subject=Chemistry&q=Organic",
  },
  {
    title: "Electrostatics Retry Pack",
    signal: "Strong retries, but explanation quality needs review",
    action: "Route back through Content Review before further scaling.",
    link: "/admin/content-review",
  },
];

const subjectMomentum = [
  {
    subject: "Physics",
    positive: "Retry pack impact is climbing.",
    caution: "Question-bank depth is still thin for Class 12 electricity topics.",
    action: "/admin/question-bank?subject=Physics",
  },
  {
    subject: "Chemistry",
    positive: "Rapid revision sets create strong return visits.",
    caution: "Memory boosters are underused in organic chapters.",
    action: "/admin/practice-sets?subject=Chemistry&type=Memory+Booster",
  },
  {
    subject: "Mathematics",
    positive: "Timed mocks are heavily attempted.",
    caution: "Late-set drop-offs are hurting completion confidence.",
    action: "/admin/practice-sets?subject=Mathematics&type=Board+Pattern",
  },
  {
    subject: "Biology",
    positive: "Concept builder sets are steady.",
    caution: "Fewer learners convert into retry practice after first attempt.",
    action: "/admin/practice-sets?subject=Biology&type=Weak+Area+Retry",
  },
];

const nextActions = [
  {
    title: "Add shorter endings to long mocks",
    detail: "Reduce fatigue in Mathematics and Chemistry board-pattern sets.",
    to: "/admin/assessment-studio",
  },
  {
    title: "Expand Physics retry inventory",
    detail: "Weak-topic signals are outpacing reusable question coverage.",
    to: "/admin/question-bank",
  },
  {
    title: "Tighten review turnaround",
    detail: "Better review speed will unlock more retry-ready content this week.",
    to: "/admin/content-review",
  },
];

export const AdminPerformanceInsightsPage = () => (
  <section className="admin-performance-page">
    <div className="admin-performance-hero">
      <div>
        <span className="eyebrow">Admin module</span>
        <h1>Performance Insights</h1>
        <p>
          Track where learners drop, where content performs, and what the team
          should improve next across practice, review, and revision workflows.
        </p>
      </div>
      <div className="admin-performance-hero-card">
        <p>Priority signal</p>
        <strong>Completion is healthy overall, but long board-pattern endings are creating avoidable drop-off.</strong>
      </div>
    </div>

    <section className="admin-performance-summary-grid">
      {trendCards.map((item) => (
        <article key={item.title} className="admin-performance-summary-card">
          <strong>{item.value}</strong>
          <span>{item.title}</span>
          <p>{item.note}</p>
        </article>
      ))}
    </section>

    <section className="admin-performance-grid">
      <div className="admin-panel">
        <div className="admin-panel-head">
          <h2>Learner flow signals</h2>
          <span>Where momentum holds and where it breaks</span>
        </div>
        <div className="admin-performance-funnel">
          {funnelSignals.map((item) => (
            <article key={item.step} className="admin-performance-funnel-card">
              <strong>{item.step}</strong>
              <span>{item.value}</span>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="admin-panel">
        <div className="admin-panel-head">
          <h2>Immediate next actions</h2>
          <span>Operational responses to the strongest signals</span>
        </div>
        <div className="admin-performance-action-list">
          {nextActions.map((item) => (
            <article key={item.title} className="admin-performance-action-card">
              <strong>{item.title}</strong>
              <p>{item.detail}</p>
              <Link className="ghost-button" to={item.to}>
                Open Module
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>

    <section className="admin-performance-grid">
      <div className="admin-panel">
        <div className="admin-panel-head">
          <h2>At-risk content</h2>
          <span>High-value sets that need intervention</span>
        </div>
        <div className="admin-performance-list">
          {atRiskSets.map((item) => (
            <article key={item.title} className="admin-performance-row-card">
              <div>
                <strong>{item.title}</strong>
                <p>{item.signal}</p>
                <span>{item.action}</span>
              </div>
              <Link className="ghost-button" to={item.link}>
                Investigate
              </Link>
            </article>
          ))}
        </div>
      </div>

      <div className="admin-panel">
        <div className="admin-panel-head">
          <h2>Subject momentum</h2>
          <span>What is working and what needs support</span>
        </div>
        <div className="admin-performance-list">
          {subjectMomentum.map((item) => (
            <article key={item.subject} className="admin-performance-row-card compact">
              <div>
                <strong>{item.subject}</strong>
                <p>{item.positive}</p>
                <span>{item.caution}</span>
              </div>
              <Link className="ghost-button" to={item.action}>
                Take Action
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  </section>
);
