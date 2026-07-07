const overviewStats = [
  { label: "Active test suites", value: 128 },
  { label: "Papers drafted this week", value: 14 },
  { label: "Students practicing today", value: 386 },
  { label: "Weak topic alerts", value: 27 },
];

const workflowCards = [
  {
    title: "Practice Sets",
    description: "Create, update, tag, and publish chapter-wise practice sets.",
  },
  {
    title: "Assessment Studio",
    description: "Assemble board-style papers with balanced chapter coverage.",
  },
  {
    title: "Learning Analytics",
    description: "Track attempt volume, chapter completion, and weak-topic trends.",
  },
];

const quickInsights = [
  "Calculus Timed Mock is the most attempted suite today.",
  "Electrostatics Retry Pack triggered the highest weak-topic retries.",
  "Class 12 Chemistry has the fastest growth in daily practice sessions.",
];

export const AdminOverviewPage = () => (
  <>
    <div className="admin-hero">
      <div>
        <span className="eyebrow">Admin dashboard</span>
        <h1>Run KUHEDU from one workspace.</h1>
        <p>
          Monitor student behavior, manage chapter-wise suites, and create
          assessment workflows from a single admin shell.
        </p>
      </div>
      <div className="admin-hero-card">
        <p>Today&apos;s priority</p>
        <strong>Review weak-topic trends and publish the next revision-ready suite.</strong>
      </div>
    </div>

    <section className="admin-stat-grid">
      {overviewStats.map((item) => (
        <article key={item.label} className="admin-stat-card">
          <strong>{item.value}</strong>
          <span>{item.label}</span>
        </article>
      ))}
    </section>

    <section className="admin-content-grid">
      <div className="admin-panel">
        <div className="admin-panel-head">
          <h2>Core actions</h2>
          <span>Editorial and analytics tools</span>
        </div>
        <div className="admin-workflow-grid">
          {workflowCards.map((item) => (
            <article key={item.title} className="admin-workflow-card">
              <strong>{item.title}</strong>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="admin-panel">
        <div className="admin-panel-head">
          <h2>Analytics feed</h2>
          <span>What needs attention</span>
        </div>
        <div className="admin-insight-list">
          {quickInsights.map((item) => (
            <article key={item} className="admin-insight-card">
              {item}
            </article>
          ))}
        </div>
      </div>
    </section>
  </>
);
