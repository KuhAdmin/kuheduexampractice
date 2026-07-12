import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { StudentPageShell } from "../components/StudentPageShell";
import { getStudentMindMap } from "../api/client";

const BackIcon = () => (
  <svg viewBox="0 0 24 24" className="student-dashboard-icon" aria-hidden="true">
    <path
      d="m15 6-6 6 6 6"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.9"
    />
  </svg>
);

// Renders the assessment_unit_dependency graph as a nested list: each concept
// with no prerequisite is a root, and every concept that depends on it nests
// beneath as a child. A concept with multiple prerequisites appears under
// each of them (the data is a graph, not strictly a tree).
const buildTree = ({ nodes, edges }) => {
  const byId = new Map(nodes.map((node) => [node.assessmentUnitId, node]));
  const childrenByParent = new Map();
  const hasParent = new Set();

  for (const edge of edges) {
    if (!childrenByParent.has(edge.from)) {
      childrenByParent.set(edge.from, []);
    }
    childrenByParent.get(edge.from).push(edge.to);
    hasParent.add(edge.to);
  }

  const roots = nodes.filter((node) => !hasParent.has(node.assessmentUnitId));

  const renderNode = (assessmentUnitId, depth, seen) => {
    const node = byId.get(assessmentUnitId);
    if (!node) return null;
    const children = childrenByParent.get(assessmentUnitId) || [];
    const nextSeen = new Set(seen).add(assessmentUnitId);

    return {
      assessmentUnitId,
      primaryConcept: node.primaryConcept,
      depth,
      children: children
        .filter((childId) => !seen.has(childId))
        .map((childId) => renderNode(childId, depth + 1, nextSeen))
        .filter(Boolean),
    };
  };

  return roots.map((root) => renderNode(root.assessmentUnitId, 0, new Set())).filter(Boolean);
};

const MINDMAP_TONE_COUNT = 5;

const TreeNode = ({ node }) => (
  <li>
    <span
      className={`student-mindmap-node is-tone-${node.depth % MINDMAP_TONE_COUNT} ${
        node.depth === 0 ? "is-root" : ""
      }`}
    >
      {node.primaryConcept}
    </span>
    {node.children.length > 0 && (
      <ul>
        {node.children.map((child) => (
          <TreeNode key={child.assessmentUnitId} node={child} />
        ))}
      </ul>
    )}
  </li>
);

export const StudentMindMapPage = () => {
  const navigate = useNavigate();
  const { chapterId: chapterNumber, sectionId: sourceSectionId } = useParams();
  const [mindMap, setMindMap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeRootIndex, setActiveRootIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setActiveRootIndex(0);

    getStudentMindMap(sourceSectionId)
      .then((result) => {
        if (!cancelled) setMindMap(result);
      })
      .catch((fetchError) => {
        if (!cancelled) setError(fetchError.message || "Failed to load mind map.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sourceSectionId]);

  const tree = useMemo(() => (mindMap ? buildTree(mindMap) : []), [mindMap]);
  const activeRoot = tree[activeRootIndex];

  const goToRoot = (nextIndex) => {
    setActiveRootIndex(Math.max(0, Math.min(nextIndex, tree.length - 1)));
  };

  return (
    <StudentPageShell pageClass="student-page--mindmap" legacyModifierClass="student-mindmap-phone">
        <header className="student-section-detail-header">
          <button
            type="button"
            className="student-chapter-detail-back"
            aria-label="Back to section"
            onClick={() => navigate(`/chapters/${chapterNumber}/sections/${sourceSectionId}`)}
          >
            <BackIcon />
          </button>
          <h1>Mind Map</h1>
        </header>

        {loading ? (
          <p className="student-empty-state">Loading mind map...</p>
        ) : error ? (
          <p className="student-empty-state">{error}</p>
        ) : tree.length === 0 ? (
          <p className="student-empty-state">
            No concept dependencies have been recorded for this section yet.
          </p>
        ) : (
          <>
            {tree.length > 1 && (
              <nav className="student-mindmap-nav" aria-label="Mind map roots">
                <button
                  type="button"
                  className="student-concept-learning-nav is-previous"
                  onClick={() => goToRoot(activeRootIndex - 1)}
                  disabled={activeRootIndex === 0}
                >
                  <span>Previous</span>
                </button>
                <span className="student-concept-learning-counter">
                  {activeRootIndex + 1}/{tree.length}
                </span>
                <button
                  type="button"
                  className="student-concept-learning-nav is-next"
                  onClick={() => goToRoot(activeRootIndex + 1)}
                  disabled={activeRootIndex === tree.length - 1}
                >
                  <span>Next</span>
                </button>
              </nav>
            )}

            <ul className="student-mindmap-tree">
              <TreeNode key={activeRoot.assessmentUnitId} node={activeRoot} />
            </ul>
          </>
        )}

    </StudentPageShell>
  );
};
