import { createContext, useContext } from "react";

// Split out of ClassSubjectContext.jsx: Vite's react-refresh plugin only
// preserves component state across HMR for files that export components
// ONLY -- mixing this hook/util into the same file as the ClassSubjectProvider
// component meant an edit to either that file or one of its consumers could
// leave some already-mounted consumers holding a stale module instance of
// ClassSubjectContext, throwing "must be used within a ClassSubjectProvider"
// despite the component tree being structurally correct (a real, previously
// unresolved crash -- reproducible after enough live edits, not fixed by a
// browser reload since the stale state lives in the dev server's module
// graph, not the browser).
export const ClassSubjectContext = createContext(null);

export const selectionKey = ({ examGoalCode, levelCode, subjectCode }) =>
  `${examGoalCode}|${levelCode}|${subjectCode}`;

export const useClassSubject = () => {
  const ctx = useContext(ClassSubjectContext);
  if (!ctx) {
    throw new Error("useClassSubject must be used within a ClassSubjectProvider");
  }
  return ctx;
};
