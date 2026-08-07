import { useState } from "react";

const ChevronIcon = ({ open }) => (
  <svg
    viewBox="0 0 24 24"
    className={`admin-content-tree-chevron ${open ? "is-open" : ""}`}
    aria-hidden="true"
  >
    <path d="m9 6 6 6-6 6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
  </svg>
);

const PencilIcon = () => (
  <svg viewBox="0 0 24 24" className="admin-content-tree-pencil-icon" aria-hidden="true">
    <path
      d="M4 20h4L18.5 9.5a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L4 15.5V20Z"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.6"
    />
  </svg>
);

// A row's label, swappable for a text input + Save/Cancel when `editKey` is
// the row currently being renamed. `onSave` is only called with a
// non-empty, changed value -- the API/service layer still validates too
// (defense in depth, see contentEditorService.js's validateName), but this
// avoids a pointless round-trip for a no-op edit.
const TreeRowLabel = ({ rowKey, label, editKey, onStartEdit, onCancelEdit, onSave }) => {
  const [draft, setDraft] = useState(label);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const isEditing = editKey === rowKey;

  if (!isEditing) {
    return (
      <>
        <span className="admin-content-tree-label">{label}</span>
        <button
          type="button"
          className="admin-content-tree-pencil"
          aria-label={`Rename ${label}`}
          onClick={(event) => {
            event.stopPropagation();
            setDraft(label);
            setError("");
            onStartEdit(rowKey);
          }}
        >
          <PencilIcon />
        </button>
      </>
    );
  }

  const handleSave = async (event) => {
    event.stopPropagation();
    const trimmed = draft.trim();
    if (!trimmed || trimmed === label) {
      onCancelEdit();
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave(trimmed);
      onCancelEdit();
    } catch (saveError) {
      setError(saveError.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <span className="admin-content-tree-edit" onClick={(event) => event.stopPropagation()}>
      <input
        autoFocus
        value={draft}
        disabled={saving}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") handleSave(event);
          if (event.key === "Escape") onCancelEdit();
        }}
      />
      <button type="button" className="ghost-button" disabled={saving} onClick={() => onCancelEdit()}>
        Cancel
      </button>
      <button type="button" className="primary-button" disabled={saving} onClick={handleSave}>
        {saving ? "Saving..." : "Save"}
      </button>
      {error && <span className="admin-content-tree-edit-error">{error}</span>}
    </span>
  );
};

export const AdminContentTree = ({
  tree,
  selectedSectionId,
  selectedConceptId,
  onSelectSection,
  onSelectConcept,
  onRenameChapter,
  onRenameSection,
  onRenameConcept,
}) => {
  const [expandedChapters, setExpandedChapters] = useState(() => new Set());
  const [expandedSections, setExpandedSections] = useState(() => new Set());
  const [editKey, setEditKey] = useState(null);

  const toggleChapter = (chapterNumber) => {
    setExpandedChapters((current) => {
      const next = new Set(current);
      if (next.has(chapterNumber)) next.delete(chapterNumber);
      else next.add(chapterNumber);
      return next;
    });
  };

  const toggleSection = (sectionId) => {
    setExpandedSections((current) => {
      const next = new Set(current);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  if (!tree.length) {
    return <div className="admin-bulk-pipeline-empty">No chapters found for this book.</div>;
  }

  return (
    <div className="admin-content-tree">
      {tree.map((chapter) => {
        const chapterKey = `chapter-${chapter.chapterNumber}`;
        const isChapterOpen = expandedChapters.has(chapter.chapterNumber);
        return (
          <div key={chapterKey} className="admin-content-tree-node">
            <div
              className="admin-content-tree-row is-chapter"
              onClick={() => toggleChapter(chapter.chapterNumber)}
            >
              <ChevronIcon open={isChapterOpen} />
              <TreeRowLabel
                rowKey={chapterKey}
                label={`Chapter ${chapter.chapterNumber} — ${chapter.chapterName}`}
                editKey={editKey}
                onStartEdit={setEditKey}
                onCancelEdit={() => setEditKey(null)}
                onSave={(value) => onRenameChapter(chapter.chapterNumber, value)}
              />
            </div>

            {isChapterOpen && (
              <div className="admin-content-tree-children">
                {chapter.sections.map((section) => {
                  const sectionKey = `section-${section.id}`;
                  const isSectionOpen = expandedSections.has(section.id);
                  const isSectionSelected = selectedSectionId === section.id && !selectedConceptId;
                  return (
                    <div key={sectionKey} className="admin-content-tree-node">
                      <div
                        className={`admin-content-tree-row is-section ${isSectionSelected ? "is-selected" : ""}`}
                        onClick={() => {
                          toggleSection(section.id);
                          onSelectSection(section);
                        }}
                      >
                        <ChevronIcon open={isSectionOpen} />
                        <TreeRowLabel
                          rowKey={sectionKey}
                          label={
                            section.sectionNumber
                              ? `${chapter.chapterNumber}.${section.sectionNumber} — ${section.topicName}`
                              : section.topicName
                          }
                          editKey={editKey}
                          onStartEdit={setEditKey}
                          onCancelEdit={() => setEditKey(null)}
                          onSave={(value) => onRenameSection(section.id, value)}
                        />
                      </div>

                      {isSectionOpen && (
                        <div className="admin-content-tree-children">
                          {section.concepts.length === 0 ? (
                            <div className="admin-content-tree-empty">No concepts in this section.</div>
                          ) : (
                            section.concepts.map((concept) => {
                              const conceptKey = `concept-${concept.assessmentUnitId}`;
                              const isConceptSelected = selectedConceptId === concept.assessmentUnitId;
                              return (
                                <div
                                  key={conceptKey}
                                  className={`admin-content-tree-row is-concept ${isConceptSelected ? "is-selected" : ""}`}
                                  onClick={() => onSelectConcept(section, concept)}
                                >
                                  <TreeRowLabel
                                    rowKey={conceptKey}
                                    label={concept.primaryConcept}
                                    editKey={editKey}
                                    onStartEdit={setEditKey}
                                    onCancelEdit={() => setEditKey(null)}
                                    onSave={(value) => onRenameConcept(concept.assessmentUnitId, value)}
                                  />
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
