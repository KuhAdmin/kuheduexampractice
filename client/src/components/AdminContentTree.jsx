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

// Mirrors the student "Deep Learn" action-row icon set (AdminContentEditorPage.jsx
// used to render these below the tree; moved here now that a concept's
// content types render as its own tree children).
const ContentGroupIcon = ({ type }) => {
  const paths = {
    assessment: <path d="M9 12.5 11 14.5 15 9.5 M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />,
    revision: <path d="M6 4h9a2 2 0 0 1 2 2v14l-6.5-3.5L4 20V6a2 2 0 0 1 2-2Z" />,
    tutor: <path d="M4 5h16v11H8l-4 4V5Z" />,
    learn: <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3 11.2c.6.4 1 1 1 1.8h4c0-.8.4-1.4 1-1.8A6 6 0 0 0 12 3Z" />,
    explore: <path d="M9 3a3 3 0 0 0-3 3v.3A3.5 3.5 0 0 0 4 9.5 3.5 3.5 0 0 0 6 16h.5A2.5 2.5 0 0 0 9 18.5V21m6-18a3 3 0 0 1 3 3v.3a3.5 3.5 0 0 1 2 3.2 3.5 3.5 0 0 1-2 3.2V13a2.5 2.5 0 0 1-2.5 2.5V21" />,
    extraction: <path d="M20.6 12 12 20.6 3.4 12 12 3.4 20.6 12ZM12 9.5v.01" />,
    textbook: <path d="M6 4h8l4 4v12H6V4ZM9 10h6M9 13h6M9 16h4" />,
    other: <path d="M12 12m-2 0a2 2 0 1 0 4 0 2 2 0 1 0-4 0" />,
  };
  return (
    <svg viewBox="0 0 24 24" className="admin-content-editor-action-icon" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6">
        {paths[type] || paths.other}
      </g>
    </svg>
  );
};

// Reuses the same ghost-button Hide/Show text-button convention the
// per-card toggle already uses (toggleHidden in AdminContentEditorPage.jsx)
// rather than a new switch widget, so the interaction language stays
// identical across card rows, concept rows, and section rows.
const VisibilityButton = ({ isHidden, disabled, lockedReason, onToggle }) => (
  <button
    type="button"
    className="ghost-button admin-content-tree-visibility"
    title={disabled ? lockedReason : undefined}
    disabled={disabled}
    onClick={(event) => {
      event.stopPropagation();
      onToggle(!isHidden);
    }}
  >
    {isHidden ? "Show" : "Hide"}
  </button>
);

const CountBadge = ({ cardCount }) => (
  <span className="admin-content-tree-count-badge">
    {cardCount.visible}/{cardCount.total}
  </span>
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

// Shared by a top-level content-type group and (for a group with
// subGroups, e.g. Explore's Simple/Story/Deep Dive/Compare) each of its
// sub-groups -- same Title/Type/Status/Actions shape either way.
const CardTable = ({ cards, section, concept, onEditCard, onToggleCardHidden }) => (
  <table className="admin-exam-types-table">
    <thead>
      <tr>
        <th>Title</th>
        <th>Type</th>
        <th>Status</th>
        <th aria-label="Actions" />
      </tr>
    </thead>
    <tbody>
      {cards.map((card) => {
        const lockedByAncestor = card.isHidden && (Boolean(section.isHidden) || Boolean(concept.isHidden));
        return (
          <tr key={card.id}>
            <td>{card.title || "(untitled)"}</td>
            <td>
              <span className="admin-exam-types-code-badge">
                {card.contentuitab}
                {card.processorkey ? ` / ${card.processorkey}` : ""}
              </span>
            </td>
            <td>
              <span className={`admin-bulk-pipeline-status-badge ${card.isHidden ? "is-aborted" : "is-completed"}`}>
                {card.isHidden ? "Hidden" : "Visible"}
              </span>
            </td>
            <td className="admin-content-editor-row-actions">
              <button
                type="button"
                className="ghost-button"
                disabled={lockedByAncestor}
                title={lockedByAncestor ? "This card's concept or section is hidden -- un-hide that first." : undefined}
                onClick={() => onToggleCardHidden(card)}
              >
                {card.isHidden ? "Show" : "Hide"}
              </button>
              <button type="button" className="primary-button" onClick={() => onEditCard(card)}>
                Edit
              </button>
            </td>
          </tr>
        );
      })}
    </tbody>
  </table>
);

// A concept's content-type groups (Assessment/Revision/Tutor Notes/etc.),
// rendered as the concept's own tree children -- each expandable to reveal
// its card table. Only meaningful once the concept's OWN section is the
// one whose cards are currently loaded (cards are fetched once per
// section, shared by every concept in it -- see AdminContentEditorPage.jsx's
// loadCards), hence the sectionIsLoaded gate below.
const ConceptChildren = ({
  section,
  concept,
  sectionIsLoaded,
  cardsLoading,
  typeGroups,
  expandedGroups,
  onToggleGroup,
  onEditCard,
  onToggleCardHidden,
  onToggleGroupHidden,
}) => {
  if (!sectionIsLoaded) {
    return <div className="admin-content-tree-empty">Select this section to load its content.</div>;
  }
  if (cardsLoading) {
    return <div className="admin-content-tree-empty">Loading...</div>;
  }
  if (!typeGroups.length) {
    return <div className="admin-content-tree-empty">No cards for this concept.</div>;
  }

  // A group/sub-group has no is_hidden of its own (it isn't a real
  // database entity, just a client-side categorization of cards) -- its
  // "hidden" state is derived: fully hidden only once every card in it is.
  // Locked the same way a card is: while the concept or section is hidden.
  const ancestorLocked = Boolean(section.isHidden) || Boolean(concept.isHidden);

  return (
    <>
      {typeGroups.map(({ group, cards: groupCards, subGroups }) => {
        const groupKey = `${concept.assessmentUnitId}::${group.key}`;
        const isGroupOpen = expandedGroups.has(groupKey);
        const visibleCount = groupCards.filter((card) => !card.isHidden).length;
        const groupIsHidden = visibleCount === 0;
        return (
          <div key={groupKey} className="admin-content-tree-node">
            <div
              className="admin-content-tree-row is-group"
              onClick={() => onToggleGroup(groupKey)}
            >
              <ChevronIcon open={isGroupOpen} />
              <span className={`admin-content-editor-action-mark ${group.colorClass}`}>
                <ContentGroupIcon type={group.key} />
              </span>
              <span className="admin-content-tree-label">{group.label}</span>
              <CountBadge cardCount={{ visible: visibleCount, total: groupCards.length }} />
              <VisibilityButton
                isHidden={groupIsHidden}
                disabled={ancestorLocked}
                lockedReason="This concept or its section is hidden — un-hide that to change this group."
                onToggle={(next) => onToggleGroupHidden(groupCards, next)}
              />
            </div>
            {isGroupOpen && (
              <div className="admin-content-tree-children">
                {subGroups ? (
                  subGroups.map(({ subGroup, cards: subCards }) => {
                    const subKey = `${groupKey}::${subGroup.key}`;
                    const isSubOpen = expandedGroups.has(subKey);
                    const subVisible = subCards.filter((card) => !card.isHidden).length;
                    const subIsHidden = subVisible === 0;
                    return (
                      <div key={subKey} className="admin-content-tree-node">
                        <div
                          className="admin-content-tree-row is-group is-sub-group"
                          onClick={() => onToggleGroup(subKey)}
                        >
                          <ChevronIcon open={isSubOpen} />
                          <span className="admin-content-tree-label">{subGroup.label}</span>
                          <CountBadge cardCount={{ visible: subVisible, total: subCards.length }} />
                          <VisibilityButton
                            isHidden={subIsHidden}
                            disabled={ancestorLocked}
                            lockedReason="This concept or its section is hidden — un-hide that to change this group."
                            onToggle={(next) => onToggleGroupHidden(subCards, next)}
                          />
                        </div>
                        {isSubOpen && (
                          <div className="admin-content-tree-children">
                            <CardTable
                              cards={subCards}
                              section={section}
                              concept={concept}
                              onEditCard={onEditCard}
                              onToggleCardHidden={onToggleCardHidden}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <CardTable
                    cards={groupCards}
                    section={section}
                    concept={concept}
                    onEditCard={onEditCard}
                    onToggleCardHidden={onToggleCardHidden}
                  />
                )}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
};

export const AdminContentTree = ({
  tree,
  selectedSectionId,
  cardsLoading,
  conceptGroupsByAssessmentUnitId,
  onSelectSection,
  onSelectConcept,
  onRenameChapter,
  onRenameSection,
  onRenameConcept,
  onToggleSectionVisibility,
  onToggleConceptVisibility,
  onEditCard,
  onToggleCardHidden,
  onToggleGroupHidden,
}) => {
  const [expandedChapters, setExpandedChapters] = useState(() => new Set());
  const [expandedSections, setExpandedSections] = useState(() => new Set());
  const [expandedConcepts, setExpandedConcepts] = useState(() => new Set());
  const [expandedGroups, setExpandedGroups] = useState(() => new Set());
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

  const toggleConcept = (assessmentUnitId) => {
    setExpandedConcepts((current) => {
      const next = new Set(current);
      if (next.has(assessmentUnitId)) next.delete(assessmentUnitId);
      else next.add(assessmentUnitId);
      return next;
    });
  };

  const toggleGroup = (groupKey) => {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
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
                  const isSectionSelected = selectedSectionId === section.id;
                  return (
                    <div key={sectionKey} className="admin-content-tree-node">
                      <div
                        className={`admin-content-tree-row is-section ${isSectionSelected ? "is-selected" : ""} ${
                          section.isHidden ? "is-hidden" : ""
                        }`}
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
                        <CountBadge cardCount={section.cardCount} />
                        <VisibilityButton
                          isHidden={section.isHidden}
                          disabled={false}
                          onToggle={(next) => onToggleSectionVisibility(section, next)}
                        />
                      </div>

                      {isSectionOpen && (
                        <div className="admin-content-tree-children">
                          {(conceptGroupsByAssessmentUnitId.get("") || []).length > 0 && (() => {
                            const rootKey = `${section.id}::root`;
                            const isRootOpen = expandedConcepts.has(rootKey);
                            return (
                              <div className="admin-content-tree-node">
                                <div className="admin-content-tree-row is-concept" onClick={() => toggleConcept(rootKey)}>
                                  <ChevronIcon open={isRootOpen} />
                                  <span className="admin-content-tree-label">General Content (not concept-specific)</span>
                                </div>
                                {isRootOpen && (
                                  <div className="admin-content-tree-children">
                                    <ConceptChildren
                                      section={section}
                                      concept={{ assessmentUnitId: "", isHidden: false }}
                                      sectionIsLoaded={selectedSectionId === section.id}
                                      cardsLoading={cardsLoading}
                                      typeGroups={conceptGroupsByAssessmentUnitId.get("") || []}
                                      expandedGroups={expandedGroups}
                                      onToggleGroup={toggleGroup}
                                      onEditCard={onEditCard}
                                      onToggleCardHidden={onToggleCardHidden}
                                      onToggleGroupHidden={onToggleGroupHidden}
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                          {section.concepts.length === 0 ? (
                            <div className="admin-content-tree-empty">No concepts in this section.</div>
                          ) : (
                            section.concepts.map((concept) => {
                              const conceptKey = `concept-${concept.assessmentUnitId}`;
                              const isConceptOpen = expandedConcepts.has(concept.assessmentUnitId);
                              return (
                                <div key={conceptKey} className="admin-content-tree-node">
                                  <div
                                    className={`admin-content-tree-row is-concept ${
                                      concept.isHidden ? "is-hidden" : ""
                                    }`}
                                    onClick={() => {
                                      toggleConcept(concept.assessmentUnitId);
                                      onSelectConcept(section, concept);
                                    }}
                                  >
                                    <ChevronIcon open={isConceptOpen} />
                                    <TreeRowLabel
                                      rowKey={conceptKey}
                                      label={concept.primaryConcept}
                                      editKey={editKey}
                                      onStartEdit={setEditKey}
                                      onCancelEdit={() => setEditKey(null)}
                                      onSave={(value) => onRenameConcept(concept.assessmentUnitId, value)}
                                    />
                                    <CountBadge cardCount={concept.cardCount} />
                                    <VisibilityButton
                                      isHidden={concept.isHidden}
                                      disabled={section.isHidden}
                                      lockedReason="Section is hidden — un-hide the section to change this concept."
                                      onToggle={(next) => onToggleConceptVisibility(section, concept, next)}
                                    />
                                  </div>

                                  {isConceptOpen && (
                                    <div className="admin-content-tree-children">
                                      <ConceptChildren
                                        section={section}
                                        concept={concept}
                                        sectionIsLoaded={selectedSectionId === section.id}
                                        cardsLoading={cardsLoading}
                                        typeGroups={conceptGroupsByAssessmentUnitId.get(concept.assessmentUnitId) || []}
                                        expandedGroups={expandedGroups}
                                        onToggleGroup={toggleGroup}
                                        onEditCard={onEditCard}
                                        onToggleCardHidden={onToggleCardHidden}
                                        onToggleGroupHidden={onToggleGroupHidden}
                                      />
                                    </div>
                                  )}
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
