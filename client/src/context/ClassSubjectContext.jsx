import { useEffect, useMemo, useState } from "react";
import { getClassSubjectOptions, getDashboardForSelection } from "../api/client";
import { ClassSubjectContext, selectionKey } from "./classSubjectHooks";

// This file exports ONLY the ClassSubjectProvider component -- see
// classSubjectHooks.js for why selectionKey/useClassSubject/the raw context
// object live in a separate, non-component file (Vite Fast Refresh
// requirement, not just style).
// Shared class/subject switcher state -- lifted out of StudentChaptersPage
// so the sidebar (persistent chrome, rendered above the routed page via
// StudentLayout/AppSidebarLayout) and the Chapters page itself can read/
// write the same selection instead of the sidebar needing its own copy.
// Every board/class/subject combo that has content in the DB, not just the
// student's own profile (see listClassSubjectOptionsWithContent server-side).
// Defaults to the student's own profile combo, matched by level + subject
// name once the options list loads.
export const ClassSubjectProvider = ({ user, children }) => {
  const [classSubjectOptions, setClassSubjectOptions] = useState([]);
  const [selection, setSelection] = useState(null);

  useEffect(() => {
    let cancelled = false;

    getClassSubjectOptions()
      .then((result) => {
        if (!cancelled) setClassSubjectOptions(result?.options || []);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  const defaultOption = useMemo(() => {
    if (!classSubjectOptions.length) return null;
    const userClass = String(user?.studentClass || "").trim();
    const userSubject = String(user?.subject || "").trim().toLowerCase();
    return (
      classSubjectOptions.find(
        (option) => option.levelCode === userClass && option.subjectName.toLowerCase() === userSubject
      ) || classSubjectOptions[0]
    );
  }, [classSubjectOptions, user?.studentClass, user?.subject]);

  useEffect(() => {
    if (defaultOption && !selection) {
      setSelection(defaultOption);
    }
  }, [defaultOption, selection]);

  // A user with no board/class/subject profile at all (e.g. a moderator --
  // App.jsx/HomePage.jsx's isStudentOnboardingComplete treats role=moderator
  // as always complete, so they never set these) has no real "default" to
  // speak of; defaultOption above still resolves to *something* (the first
  // class/subject combo with content) purely so the switcher has a sane
  // starting point, not because it's actually this user's own selection.
  // Without hasStudentProfile here, isDefaultSelection would be trivially
  // true (comparing that fallback against itself), so every consumer would
  // keep reusing the student `dashboard` prop instead of ever fetching real
  // data for the fallback combo -- and that prop is always empty for a
  // profile-less user (getReturningDashboardForUser has nothing to resolve
  // against), so the chapter list would silently stay blank forever.
  const hasStudentProfile = Boolean(String(user?.studentClass || "").trim() && String(user?.subject || "").trim());

  const isDefaultSelection =
    hasStudentProfile && (!selection || (defaultOption && selectionKey(selection) === selectionKey(defaultOption)));

  // Continue Learning/Today's Goal/Weak Concepts for a non-default selection
  // (see server/src/services/studentDashboardService.js's
  // getReturningDashboardForSelection) -- null while on the default
  // selection, where the Dashboard just uses its own already-loaded
  // `dashboard` prop instead (no extra request, same pattern
  // StudentChaptersPage already used for its own chapter list).
  const [selectionDashboard, setSelectionDashboard] = useState(null);

  useEffect(() => {
    if (!selection || isDefaultSelection) {
      setSelectionDashboard(null);
      return undefined;
    }

    let cancelled = false;

    getDashboardForSelection(selection)
      .then((result) => {
        if (!cancelled) setSelectionDashboard(result);
      })
      .catch(() => {
        if (!cancelled) setSelectionDashboard(null);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, isDefaultSelection]);

  const value = useMemo(
    () => ({
      classSubjectOptions,
      selection,
      setSelection,
      defaultOption,
      isDefaultSelection,
      selectionDashboard,
    }),
    [classSubjectOptions, selection, defaultOption, isDefaultSelection, selectionDashboard]
  );

  return <ClassSubjectContext.Provider value={value}>{children}</ClassSubjectContext.Provider>;
};
