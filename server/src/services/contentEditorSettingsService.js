import { getSetting, setSetting } from "./appSettingsService.js";

// Global on/off switch for the student Concept Learning page's Exercises/
// Activities tab (StudentConceptLearningPage.jsx) -- a single moderator/
// admin toggle in the Content Editor, not scoped per book/section/concept.
// Defaults to HIDDEN when never explicitly set -- a moderator has to
// opt in, not opt out.
const EXERCISES_ACTIVITIES_TAB_KEY = "exercises_activities_tab_visible";

export const getExercisesActivitiesTabVisible = async () => {
  const value = await getSetting(EXERCISES_ACTIVITIES_TAB_KEY, false);
  return value === true;
};

export const setExercisesActivitiesTabVisible = async (visible, { updatedBy = null } = {}) =>
  setSetting(EXERCISES_ACTIVITIES_TAB_KEY, Boolean(visible), { updatedBy });
