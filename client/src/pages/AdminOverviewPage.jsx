import { useEffect, useState } from "react";
import { getAdminOverviewStats } from "../api/client";

const STAT_TILES = [
  { key: "activeTestSuites", label: "Active test suites" },
  { key: "papersDraftedThisWeek", label: "Papers drafted this week" },
  { key: "studentsPracticingToday", label: "Students practicing today" },
  { key: "weakTopicAlerts", label: "Weak topic alerts" },
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

export const AdminOverviewPage = () => {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    getAdminOverviewStats()
      .then((result) => setStats(result?.stats))
      .catch(() => setStats(null));
  }, []);

  return (
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
        {STAT_TILES.map((tile) => (
          <article key={tile.key} className="admin-stat-card">
            <strong>{stats ? stats[tile.key] : "—"}</strong>
            <span>{tile.label}</span>
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
};
