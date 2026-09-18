// Single source of truth for the content hierarchy's display names
// (Chapter > Lesson > Micro Learning Unit). "Lesson" here is the level the
// rest of the codebase still calls "Section" internally (route params,
// variable names, CSS classes) -- only the rendered copy changed, so this
// file is the seam a future Admin-configurable-labels screen would read
// from without another code-wide hunt.
export const HIERARCHY_LABELS = {
  chapter: "Chapter",
  chapterPlural: "Chapters",
  lesson: "Lesson",
  lessonPlural: "Lessons",
  microLearningUnit: "Micro Learning Unit",
  microLearningUnitPlural: "Micro Learning Units",
};
