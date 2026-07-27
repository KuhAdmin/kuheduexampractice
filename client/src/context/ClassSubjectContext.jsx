import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getClassSubjectOptions, getDashboardForSelection } from "../api/client";

export const selectionKey = ({ examGoalCode, levelCode, subjectCode }) =>
  `${examGoalCode}|${levelCode}|${subjectCode}`;

const ClassSubjectContext = createContext(null);

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

  const isDefaultSelection =
    !selection || (defaultOption && selectionKey(selection) === selectionKey(defaultOption));

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

export const useClassSubject = () => {
  const ctx = useContext(ClassSubjectContext);
  if (!ctx) {
    throw new Error("useClassSubject must be used within a ClassSubjectProvider");
  }
  return ctx;
};
