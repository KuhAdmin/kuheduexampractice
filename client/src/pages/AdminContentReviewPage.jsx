import { useMemo, useState } from "react";

const initialReviewItems = [
  {
    id: "review-1",
    title: "Electrostatics Retry Pack",
    subject: "Physics",
    className: "Class 12",
    chapter: "Electrostatics",
    type: "Weak Area Retry",
    status: "Pending Review",
    owner: "Aditi Rao",
    reviewer: "Content Lead",
    submittedAt: "Today, 10:40 AM",
    turnaround: "2h in queue",
    priority: "High",
    summary:
      "Built from weak-question signals in recent Class 12 Physics attempts.",
    checklist: [
      "Retry questions align with weak-topic analytics.",
      "Difficulty stays focused on improvement, not full-mock pressure.",
      "Explanation quality is ready for student retry loops.",
    ],
    comments: [
      {
        id: "c1",
        author: "Aditi Rao",
        role: "Creator",
        text: "I narrowed the set to charge distribution and field-intensity errors only.",
        time: "Today, 10:12 AM",
      },
      {
        id: "c2",
        author: "Content Lead",
        role: "Reviewer",
        text: "Looks strong overall. Double-check explanation consistency on the final two questions.",
        time: "Today, 10:48 AM",
      },
    ],
    audit: [
      "Draft created by Aditi Rao",
      "AI-enhanced distractors applied",
      "Submitted for review",
    ],
  },
  {
    id: "review-2",
    title: "Organic Memory Booster",
    subject: "Chemistry",
    className: "Class 12",
    chapter: "Organic Chemistry",
    type: "Memory Booster",
    status: "AI Enhanced",
    owner: "Rohan Shah",
    reviewer: "Content Lead",
    submittedAt: "Yesterday, 4:15 PM",
    turnaround: "Needs final submit",
    priority: "Medium",
    summary:
      "Short reinforcement set for high-decay reactions and reagent mapping.",
    checklist: [
      "Booster prompts are concise enough for quick recall sessions.",
      "Question sequence moves from recognition to retrieval.",
      "Student-facing copy avoids ambiguity in reagent names.",
    ],
    comments: [
      {
        id: "c3",
        author: "Rohan Shah",
        role: "Creator",
        text: "AI suggestions are in, but I still need to validate the reagent wording.",
        time: "Yesterday, 4:20 PM",
      },
    ],
    audit: ["Draft created by Rohan Shah", "AI-enhanced hint set generated"],
  },
  {
    id: "review-3",
    title: "Calculus Board Pattern Set",
    subject: "Mathematics",
    className: "Class 12",
    chapter: "Calculus",
    type: "Board Pattern",
    status: "Draft",
    owner: "Nisha Menon",
    reviewer: "Senior Editor",
    submittedAt: "Yesterday, 12:05 PM",
    turnaround: "Awaiting creator polish",
    priority: "Medium",
    summary:
      "Board-style practice set shaped around common differentiation and application patterns.",
    checklist: [
      "Section flow should resemble board exam pacing.",
      "Marks distribution needs balance across difficulty bands.",
      "Final long-answer question needs one cleaner prompt.",
    ],
    comments: [
      {
        id: "c4",
        author: "Senior Editor",
        role: "Reviewer",
        text: "Please tighten the final long-answer prompt before sending this to review.",
        time: "Yesterday, 12:18 PM",
      },
    ],
    audit: [
      "Draft created by Nisha Menon",
      "Returned to draft for final section polish",
    ],
  },
  {
    id: "review-4",
    title: "Genetics Concept Check",
    subject: "Biology",
    className: "Class 12",
    chapter: "Genetics",
    type: "Concept Builder",
    status: "Published",
    owner: "Aditi Rao",
    reviewer: "Senior Editor",
    submittedAt: "Jun 5, 3:30 PM",
    turnaround: "Published 1 day ago",
    priority: "Low",
    summary:
      "Concept-first chapter set built to strengthen inheritance fundamentals.",
    checklist: [
      "Core misconceptions are covered early.",
      "Concept sequence matches chapter learning flow.",
      "Publishing notes are complete and traceable.",
    ],
    comments: [
      {
        id: "c5",
        author: "Senior Editor",
        role: "Reviewer",
        text: "Approved for publish. Strong concept progression and good explanation clarity.",
        time: "Jun 5, 3:44 PM",
      },
    ],
    audit: [
      "Draft created by Aditi Rao",
      "Submitted for review",
      "Approved by Senior Editor",
      "Published to student library",
    ],
  },
];

const statusOptions = ["All", "Pending Review", "AI Enhanced", "Draft", "Published"];

const statusClassMap = {
  Draft: "draft",
  "AI Enhanced": "ai-enhanced",
  "Pending Review": "pending-review",
  Published: "published",
};

const typeClassMap = {
  "Concept Builder": "concept-builder",
  "Rapid Revision": "rapid-revision",
  "Board Pattern": "board-pattern",
  "Weak Area Retry": "weak-area-retry",
  "Memory Booster": "memory-booster",
  "Full Mock": "full-mock",
};

export const AdminContentReviewPage = () => {
  const [reviewItems, setReviewItems] = useState(initialReviewItems);
  const [statusFilter, setStatusFilter] = useState("All");
  const [activeId, setActiveId] = useState(initialReviewItems[0]?.id ?? null);
  const [commentDraft, setCommentDraft] = useState("");

  const filteredItems = useMemo(() => {
    if (statusFilter === "All") {
      return reviewItems;
    }

    return reviewItems.filter((item) => item.status === statusFilter);
  }, [reviewItems, statusFilter]);

  const activeItem = useMemo(() => {
    if (!filteredItems.length) {
      return null;
    }

    return filteredItems.find((item) => item.id === activeId) ?? filteredItems[0];
  }, [activeId, filteredItems]);

  const summary = useMemo(() => {
    const pending = reviewItems.filter((item) => item.status === "Pending Review").length;
    const aiEnhanced = reviewItems.filter((item) => item.status === "AI Enhanced").length;
    const drafts = reviewItems.filter((item) => item.status === "Draft").length;
    const published = reviewItems.filter((item) => item.status === "Published").length;

    return { pending, aiEnhanced, drafts, published };
  }, [reviewItems]);

  const updateItem = (itemId, updater) => {
    setReviewItems((current) =>
      current.map((item) => (item.id === itemId ? updater(item) : item)),
    );
  };

  const addComment = () => {
    if (!activeItem || !commentDraft.trim()) {
      return;
    }

    const trimmed = commentDraft.trim();

    updateItem(activeItem.id, (item) => ({
      ...item,
      comments: [
        ...item.comments,
        {
          id: `comment-${Date.now()}`,
          author: "Content Lead",
          role: "Reviewer",
          text: trimmed,
          time: "Just now",
        },
      ],
      audit: [...item.audit, "Reviewer added comment"],
    }));

    setCommentDraft("");
  };

  const handleWorkflowAction = (nextStatus, auditEntry, reviewerComment) => {
    if (!activeItem) {
      return;
    }

    updateItem(activeItem.id, (item) => ({
      ...item,
      status: nextStatus,
      turnaround:
        nextStatus === "Published"
          ? "Published just now"
          : nextStatus === "Draft"
            ? "Returned to creator"
            : "Waiting on creator updates",
      comments: reviewerComment
        ? [
            ...item.comments,
            {
              id: `comment-${Date.now()}`,
              author: "Content Lead",
              role: "Reviewer",
              text: reviewerComment,
              time: "Just now",
            },
          ]
        : item.comments,
      audit: [...item.audit, auditEntry],
    }));
  };

  return (
    <section className="admin-review-page">
      <div className="admin-review-hero">
        <div>
          <span className="eyebrow">Admin module</span>
          <h1>Content Review</h1>
          <p>
            Review drafts, approve publishing decisions, and keep editorial handoffs
            traceable across the practice-set workflow.
          </p>
        </div>
        <div className="admin-review-hero-card">
          <p>Current bottleneck</p>
          <strong>Physics retry packs are entering review faster than editors are clearing them.</strong>
        </div>
      </div>

      <section className="admin-review-summary-grid">
        <article className="admin-review-summary-card">
          <strong>{summary.pending}</strong>
          <span>Pending review</span>
        </article>
        <article className="admin-review-summary-card">
          <strong>{summary.aiEnhanced}</strong>
          <span>AI enhanced and not yet submitted</span>
        </article>
        <article className="admin-review-summary-card">
          <strong>{summary.drafts}</strong>
          <span>Returned for creator updates</span>
        </article>
        <article className="admin-review-summary-card">
          <strong>{summary.published}</strong>
          <span>Published with review trace</span>
        </article>
      </section>

      <section className="admin-review-layout">
        <div className="admin-panel admin-review-queue-panel">
          <div className="admin-panel-head">
            <h2>Review queue</h2>
            <span>Move work from draft to publish with a clear handoff</span>
          </div>

          <div className="admin-review-filter-row">
            {statusOptions.map((option) => (
              <button
                key={option}
                type="button"
                className={`admin-review-filter-chip ${
                  option === statusFilter ? "is-active" : ""
                }`}
                onClick={() => setStatusFilter(option)}
              >
                {option}
              </button>
            ))}
          </div>

          <div className="admin-review-queue-list">
            {filteredItems.map((item) => (
              <article
                key={item.id}
                className={`admin-review-queue-card ${
                  item.id === activeItem?.id ? "is-active" : ""
                }`}
                onClick={() => setActiveId(item.id)}
              >
                <div className="admin-review-queue-head">
                  <div>
                    <strong>{item.title}</strong>
                    <p>
                      {item.subject} · {item.className} · {item.chapter}
                    </p>
                  </div>
                  <span className={`admin-status-pill ${statusClassMap[item.status]}`}>
                    {item.status}
                  </span>
                </div>

                <div className="admin-review-queue-tags">
                  <span className={`admin-type-pill ${typeClassMap[item.type]}`}>
                    {item.type}
                  </span>
                  <span className="admin-meta-pill">{item.priority} priority</span>
                </div>

                <p className="admin-review-queue-summary">{item.summary}</p>

                <div className="admin-review-queue-footer">
                  <span>Owner: {item.owner}</span>
                  <span>{item.turnaround}</span>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="admin-panel admin-review-detail-panel">
          {activeItem ? (
            <>
              <div className="admin-review-detail-head">
                <div>
                  <span className="eyebrow">Review workspace</span>
                  <h2>{activeItem.title}</h2>
                  <p>
                    {activeItem.subject} · {activeItem.className} · {activeItem.chapter}
                  </p>
                </div>
                <div className="admin-review-detail-status">
                  <span className={`admin-status-pill ${statusClassMap[activeItem.status]}`}>
                    {activeItem.status}
                  </span>
                  <span className={`admin-type-pill ${typeClassMap[activeItem.type]}`}>
                    {activeItem.type}
                  </span>
                </div>
              </div>

              <section className="admin-review-metadata-grid">
                <article className="admin-review-metadata-card">
                  <span>Creator</span>
                  <strong>{activeItem.owner}</strong>
                </article>
                <article className="admin-review-metadata-card">
                  <span>Reviewer</span>
                  <strong>{activeItem.reviewer}</strong>
                </article>
                <article className="admin-review-metadata-card">
                  <span>Submitted</span>
                  <strong>{activeItem.submittedAt}</strong>
                </article>
                <article className="admin-review-metadata-card">
                  <span>Turnaround</span>
                  <strong>{activeItem.turnaround}</strong>
                </article>
              </section>

              <section className="admin-review-detail-grid">
                <div className="admin-review-section-card">
                  <div className="admin-panel-head">
                    <h3>Review checklist</h3>
                    <span>Editorial quality gates</span>
                  </div>
                  <ul className="admin-review-checklist">
                    {activeItem.checklist.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                </div>

                <div className="admin-review-section-card">
                  <div className="admin-panel-head">
                    <h3>Approval actions</h3>
                    <span>Keep creator and reviewer handoff explicit</span>
                  </div>
                  <div className="admin-review-action-grid">
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() =>
                        handleWorkflowAction(
                          "Published",
                          "Approved and published by Content Lead",
                          "Approved for publish. Review criteria are complete.",
                        )
                      }
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() =>
                        handleWorkflowAction(
                          "Draft",
                          "Sent back to creator for revision",
                          "Sent back for revision. Please tighten the content before resubmitting.",
                        )
                      }
                    >
                      Send Back
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() =>
                        handleWorkflowAction(
                          "AI Enhanced",
                          "Fixes requested before review approval",
                          "Please address the flagged quality gaps, then resubmit for review.",
                        )
                      }
                    >
                      Request Fixes
                    </button>
                  </div>
                </div>
              </section>

              <section className="admin-review-detail-grid">
                <div className="admin-review-section-card">
                  <div className="admin-panel-head">
                    <h3>Reviewer comments</h3>
                    <span>Context the creator can act on immediately</span>
                  </div>

                  <div className="admin-review-comment-list">
                    {activeItem.comments.map((comment) => (
                      <article key={comment.id} className="admin-review-comment-card">
                        <div className="admin-review-comment-head">
                          <strong>{comment.author}</strong>
                          <span>
                            {comment.role} · {comment.time}
                          </span>
                        </div>
                        <p>{comment.text}</p>
                      </article>
                    ))}
                  </div>

                  <div className="admin-review-comment-composer">
                    <textarea
                      value={commentDraft}
                      onChange={(event) => setCommentDraft(event.target.value)}
                      placeholder="Add a review note, publishing rationale, or creator guidance."
                    />
                    <button type="button" className="ghost-button" onClick={addComment}>
                      Add Comment
                    </button>
                  </div>
                </div>

                <div className="admin-review-section-card">
                  <div className="admin-panel-head">
                    <h3>Audit history</h3>
                    <span>Traceable editorial path from draft to publish</span>
                  </div>

                  <div className="admin-review-audit-list">
                    {activeItem.audit.map((entry, index) => (
                      <article key={`${entry}-${index}`} className="admin-review-audit-item">
                        <span className="admin-review-audit-dot" />
                        <p>{entry}</p>
                      </article>
                    ))}
                  </div>
                </div>
              </section>
            </>
          ) : (
            <div className="admin-review-empty-state">
              <strong>No items match this filter.</strong>
              <p>Choose another review state to continue triaging the content pipeline.</p>
            </div>
          )}
        </div>
      </section>
    </section>
  );
};
