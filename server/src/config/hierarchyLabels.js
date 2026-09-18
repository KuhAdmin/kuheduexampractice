// Single source of truth for the content hierarchy's display names
// (Chapter > Lesson > Micro Learning Unit), mirroring
// client/src/content/hierarchyLabels.js. "Lesson" here is the level the
// rest of the codebase still calls "section" internally (column/variable
// names) -- only server-generated, user-facing copy should read from this.
export const HIERARCHY_LABELS = {
  chapter: "Chapter",
  chapterPlural: "Chapters",
  lesson: "Lesson",
  lessonPlural: "Lessons",
  microLearningUnit: "Micro Learning Unit",
  microLearningUnitPlural: "Micro Learning Units",
};
