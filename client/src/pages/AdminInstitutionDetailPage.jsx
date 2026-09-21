import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  addAdminInstitutionClass,
  addAdminInstitutionSection,
  addAdminInstitutionTeacher,
  getAdminInstitution,
  getAdminInstitutionClasses,
  getAdminInstitutionSections,
  getAdminInstitutionTeacherAssignments,
  getAdminInstitutionTeachers,
  getAdminLevels,
  getAdminUsers,
  removeAdminInstitutionClass,
  removeAdminInstitutionSection,
  removeAdminInstitutionTeacher,
  saveAdminInstitutionTeacherAssignments,
  updateAdminInstitutionLicense,
  updateAdminInstitutionSection,
} from "../api/client";

const LICENSE_STATUSES = ["unlicensed", "licensed", "suspended"];

const assignmentKey = (sectionId, subjectId) => `${sectionId}|${subjectId}`;

const toDateInputValue = (value) => (value ? String(value).slice(0, 10) : "");

export const AdminInstitutionDetailPage = () => {
  const { institutionId } = useParams();
  const navigate = useNavigate();

  const [institution, setInstitution] = useState(null);
  const [levels, setLevels] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sectionsByClass, setSectionsByClass] = useState({});
  const [teachers, setTeachers] = useState([]);
  const [teacherUsers, setTeacherUsers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [licenseForm, setLicenseForm] = useState({
    licenseStatus: "unlicensed",
    licenseSeatCap: "",
    licenseValidFrom: "",
    licenseValidUntil: "",
  });
  const [licenseSaving, setLicenseSaving] = useState(false);

  const [addClassLevelId, setAddClassLevelId] = useState("");
  const [classBusy, setClassBusy] = useState(false);
  const [newSectionNameByClass, setNewSectionNameByClass] = useState({});

  const [addTeacherUserId, setAddTeacherUserId] = useState("");
  const [teacherBusy, setTeacherBusy] = useState(false);

  const [openAssignmentsFor, setOpenAssignmentsFor] = useState(null);
  const [assignmentGrid, setAssignmentGrid] = useState(null);
  const [assignmentChecks, setAssignmentChecks] = useState({});
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [assignmentSaving, setAssignmentSaving] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [institutionResult, levelsResult, classesResult, teachersResult, usersResult] = await Promise.all([
        getAdminInstitution(institutionId),
        getAdminLevels(),
        getAdminInstitutionClasses(institutionId),
        getAdminInstitutionTeachers(institutionId),
        getAdminUsers(),
      ]);

      setInstitution(institutionResult.institution);
      setLicenseForm({
        licenseStatus: institutionResult.institution.licenseStatus,
        licenseSeatCap: institutionResult.institution.licenseSeatCap ?? "",
        licenseValidFrom: toDateInputValue(institutionResult.institution.licenseValidFrom),
        licenseValidUntil: toDateInputValue(institutionResult.institution.licenseValidUntil),
      });
      setLevels(levelsResult.levels || []);
      const classRows = classesResult.classes || [];
      setClasses(classRows);
      setTeachers(teachersResult.teachers || []);
      setTeacherUsers((usersResult.users || []).filter((user) => user.role === "teacher"));

      const sectionEntries = await Promise.all(
        classRows.map(async (cls) => [cls.id, (await getAdminInstitutionSections(cls.id)).sections || []])
      );
      setSectionsByClass(Object.fromEntries(sectionEntries));
    } catch (loadError) {
      setError(loadError.message || "Failed to load this institution.");
    } finally {
      setLoading(false);
    }
  }, [institutionId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleSaveLicense = async (event) => {
    event.preventDefault();
    setLicenseSaving(true);
    setError("");
    try {
      await updateAdminInstitutionLicense(institutionId, licenseForm);
      setNotice("License updated.");
      await loadAll();
    } catch (saveError) {
      setError(saveError.message || "Failed to update the license.");
    } finally {
      setLicenseSaving(false);
    }
  };

  const handleAddClass = async () => {
    if (!addClassLevelId) return;
    setClassBusy(true);
    setError("");
    try {
      await addAdminInstitutionClass(institutionId, Number(addClassLevelId));
      setAddClassLevelId("");
      await loadAll();
    } catch (addError) {
      setError(addError.message || "Failed to add class.");
    } finally {
      setClassBusy(false);
    }
  };

  const handleRemoveClass = async (institutionClassId) => {
    setClassBusy(true);
    setError("");
    try {
      await removeAdminInstitutionClass(institutionId, institutionClassId);
      await loadAll();
    } catch (removeError) {
      setError(removeError.message || "Failed to remove class.");
    } finally {
      setClassBusy(false);
    }
  };

  const handleAddSection = async (institutionClassId) => {
    const name = (newSectionNameByClass[institutionClassId] || "").trim();
    if (!name) return;
    setClassBusy(true);
    setError("");
    try {
      await addAdminInstitutionSection(institutionClassId, { name });
      setNewSectionNameByClass((current) => ({ ...current, [institutionClassId]: "" }));
      await loadAll();
    } catch (addError) {
      setError(addError.message || "Failed to add section.");
    } finally {
      setClassBusy(false);
    }
  };

  const handleToggleSection = async (section) => {
    setClassBusy(true);
    setError("");
    try {
      if (section.isActive) {
        await removeAdminInstitutionSection(section.id);
      } else {
        await updateAdminInstitutionSection(section.id, {
          name: section.name,
          displayOrder: section.displayOrder,
          isActive: true,
        });
      }
      await loadAll();
    } catch (toggleError) {
      setError(toggleError.message || "Failed to update section.");
    } finally {
      setClassBusy(false);
    }
  };

  const handleAddTeacher = async () => {
    if (!addTeacherUserId) return;
    setTeacherBusy(true);
    setError("");
    try {
      await addAdminInstitutionTeacher(institutionId, Number(addTeacherUserId));
      setAddTeacherUserId("");
      await loadAll();
    } catch (addError) {
      setError(addError.message || "Failed to link teacher.");
    } finally {
      setTeacherBusy(false);
    }
  };

  const handleRemoveTeacher = async (institutionTeacherId) => {
    setTeacherBusy(true);
    setError("");
    try {
      await removeAdminInstitutionTeacher(institutionId, institutionTeacherId);
      if (openAssignmentsFor === institutionTeacherId) {
        setOpenAssignmentsFor(null);
        setAssignmentGrid(null);
      }
      await loadAll();
    } catch (removeError) {
      setError(removeError.message || "Failed to unlink teacher.");
    } finally {
      setTeacherBusy(false);
    }
  };

  const openAssignments = async (institutionTeacherId) => {
    setOpenAssignmentsFor(institutionTeacherId);
    setAssignmentGrid(null);
    setAssignmentLoading(true);
    setError("");
    try {
      const grid = await getAdminInstitutionTeacherAssignments(institutionTeacherId);
      setAssignmentGrid(grid);
      const checks = {};
      (grid.assignments || []).forEach((assignment) => {
        checks[assignmentKey(assignment.institutionSectionId, assignment.mstSubjectId)] = assignment.isActive;
      });
      setAssignmentChecks(checks);
    } catch (loadError) {
      setError(loadError.message || "Failed to load assignments.");
    } finally {
      setAssignmentLoading(false);
    }
  };

  const toggleAssignment = (sectionId, subjectId) => {
    const key = assignmentKey(sectionId, subjectId);
    const takenBy = (assignmentGrid?.takenByOthers || []).some(
      (taken) => assignmentKey(taken.institutionSectionId, taken.mstSubjectId) === key
    );
    if (takenBy) return;
    setAssignmentChecks((current) => ({ ...current, [key]: !current[key] }));
  };

  const handleSaveAssignments = async () => {
    if (!assignmentGrid) return;
    setAssignmentSaving(true);
    setError("");
    try {
      const assignments = [];
      assignmentGrid.sections.forEach((section) => {
        assignmentGrid.subjects.forEach((subject) => {
          assignments.push({
            institutionSectionId: section.id,
            mstSubjectId: subject.id,
            isActive: Boolean(assignmentChecks[assignmentKey(section.id, subject.id)]),
          });
        });
      });
      const grid = await saveAdminInstitutionTeacherAssignments(openAssignmentsFor, assignments);
      setAssignmentGrid(grid);
      const checks = {};
      (grid.assignments || []).forEach((assignment) => {
        checks[assignmentKey(assignment.institutionSectionId, assignment.mstSubjectId)] = assignment.isActive;
      });
      setAssignmentChecks(checks);
      setNotice("Assignments saved. A batch and join code were created for any newly checked section & subject.");
      await loadAll();
    } catch (saveError) {
      setError(saveError.message || "Failed to save assignments.");
    } finally {
      setAssignmentSaving(false);
    }
  };

  if (loading && !institution) {
    return (
      <section className="admin-bulk-pipeline-page">
        <div className="admin-bulk-pipeline-empty">Loading institution...</div>
      </section>
    );
  }

  const availableLevels = levels.filter(
    (level) => !classes.some((cls) => cls.mstLevelId === level.id && cls.isActive)
  );
  const availableTeacherUsers = teacherUsers.filter(
    (user) => !teachers.some((teacher) => teacher.userId === user.id && teacher.isActive)
  );
  const openTeacher = teachers.find((teacher) => teacher.id === openAssignmentsFor);

  const takenByOthersMap = {};
  (assignmentGrid?.takenByOthers || []).forEach((taken) => {
    takenByOthersMap[assignmentKey(taken.institutionSectionId, taken.mstSubjectId)] = taken.teacherName;
  });

  return (
    <section className="admin-bulk-pipeline-page">
      <header className="admin-bulk-pipeline-header">
        <div>
          <button type="button" className="ghost-button" onClick={() => navigate("/admin/institutions")}>
            &larr; Back to institutions
          </button>
          <h1>{institution?.name}</h1>
          <p>
            <span className="admin-exam-types-code-badge">{institution?.code}</span>
          </p>
        </div>
      </header>

      {notice && <div className="admin-bulk-pipeline-concurrency">{notice}</div>}
      {error && <p className="error-text">{error}</p>}

      <div className="admin-panel">
        <div className="admin-panel-head">
          <h2>License</h2>
          <span>Controls whether students in this institution's batches get app access</span>
        </div>
        <form className="admin-studio-form-grid" onSubmit={handleSaveLicense}>
          <label className="admin-studio-field">
            <span>Status</span>
            <select
              value={licenseForm.licenseStatus}
              onChange={(event) => setLicenseForm((current) => ({ ...current, licenseStatus: event.target.value }))}
            >
              {LICENSE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-studio-field">
            <span>Seat cap (blank = uncapped)</span>
            <input
              type="number"
              min="0"
              value={licenseForm.licenseSeatCap}
              onChange={(event) => setLicenseForm((current) => ({ ...current, licenseSeatCap: event.target.value }))}
            />
          </label>
          <label className="admin-studio-field">
            <span>Valid from</span>
            <input
              type="date"
              value={licenseForm.licenseValidFrom}
              onChange={(event) =>
                setLicenseForm((current) => ({ ...current, licenseValidFrom: event.target.value }))
              }
            />
          </label>
          <label className="admin-studio-field">
            <span>Valid until (blank = no end date)</span>
            <input
              type="date"
              value={licenseForm.licenseValidUntil}
              onChange={(event) =>
                setLicenseForm((current) => ({ ...current, licenseValidUntil: event.target.value }))
              }
            />
          </label>
          <div className="admin-bulk-pipeline-dialog-actions">
            <button type="submit" className="primary-button" disabled={licenseSaving}>
              {licenseSaving ? "Saving..." : "Save License"}
            </button>
          </div>
        </form>
      </div>

      <div className="admin-panel">
        <div className="admin-panel-head">
          <h2>Classes &amp; Class Sections</h2>
          <span>Which classes this institution runs, and their cohorts (e.g. 8-A, 8-B)</span>
        </div>

        <div className="admin-studio-form-grid">
          <label className="admin-studio-field">
            <span>Activate a class</span>
            <select value={addClassLevelId} onChange={(event) => setAddClassLevelId(event.target.value)}>
              <option value="">Select a class...</option>
              {availableLevels.map((level) => (
                <option key={level.id} value={level.id}>
                  {level.name}
                </option>
              ))}
            </select>
          </label>
          <div className="admin-bulk-pipeline-dialog-actions">
            <button type="button" className="primary-button" disabled={!addClassLevelId || classBusy} onClick={handleAddClass}>
              Add Class
            </button>
          </div>
        </div>

        {classes.filter((cls) => cls.isActive).length === 0 ? (
          <p>No classes activated yet.</p>
        ) : (
          classes
            .filter((cls) => cls.isActive)
            .map((cls) => (
              <div key={cls.id} className="admin-panel" style={{ marginTop: "1rem" }}>
                <div className="admin-panel-head">
                  <h2>{cls.levelName}</h2>
                  <button type="button" className="ghost-button admin-pipeline-runs-danger" disabled={classBusy} onClick={() => handleRemoveClass(cls.id)}>
                    Remove class
                  </button>
                </div>

                <div className="admin-users-scope-checklist">
                  {(sectionsByClass[cls.id] || []).map((section) => (
                    <label key={section.id} className={section.isActive ? "" : "is-disabled"}>
                      <input type="checkbox" checked={section.isActive} onChange={() => handleToggleSection(section)} />
                      {section.name}
                    </label>
                  ))}
                </div>

                <div className="admin-studio-form-grid">
                  <label className="admin-studio-field">
                    <span>New class section (e.g. A, B, Morning)</span>
                    <input
                      value={newSectionNameByClass[cls.id] || ""}
                      onChange={(event) =>
                        setNewSectionNameByClass((current) => ({ ...current, [cls.id]: event.target.value }))
                      }
                    />
                  </label>
                  <div className="admin-bulk-pipeline-dialog-actions">
                    <button
                      type="button"
                      className="primary-button"
                      disabled={classBusy || !(newSectionNameByClass[cls.id] || "").trim()}
                      onClick={() => handleAddSection(cls.id)}
                    >
                      + Add Section
                    </button>
                  </div>
                </div>
              </div>
            ))
        )}
      </div>

      <div className="admin-panel">
        <div className="admin-panel-head">
          <h2>Teachers</h2>
          <span>Link a teacher account, then assign the sections &amp; subjects they teach</span>
        </div>

        <div className="admin-studio-form-grid">
          <label className="admin-studio-field">
            <span>Link a teacher</span>
            <select value={addTeacherUserId} onChange={(event) => setAddTeacherUserId(event.target.value)}>
              <option value="">Select a teacher account...</option>
              {availableTeacherUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.email})
                </option>
              ))}
            </select>
          </label>
          <div className="admin-bulk-pipeline-dialog-actions">
            <button type="button" className="primary-button" disabled={!addTeacherUserId || teacherBusy} onClick={handleAddTeacher}>
              Link Teacher
            </button>
          </div>
        </div>
        {teacherUsers.length === 0 && (
          <p>
            No teacher accounts exist yet. Create one from <button type="button" className="ghost-button" onClick={() => navigate("/admin/users")}>Admin &rarr; Users</button> with role "teacher" first.
          </p>
        )}

        {teachers.filter((teacher) => teacher.isActive).length === 0 ? (
          <p>No teachers linked yet.</p>
        ) : (
          <div className="admin-bulk-pipeline-grid-shell">
            <table className="admin-exam-types-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Assignments</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {teachers
                  .filter((teacher) => teacher.isActive)
                  .map((teacher) => (
                    <tr key={teacher.id}>
                      <td>{teacher.name}</td>
                      <td>{teacher.email}</td>
                      <td>{teacher.assignmentCount}</td>
                      <td>
                        <div className="table-actions">
                          <button type="button" className="primary-button" onClick={() => openAssignments(teacher.id)}>
                            Manage assignments
                          </button>
                          <button
                            type="button"
                            className="ghost-button admin-pipeline-runs-danger"
                            disabled={teacherBusy}
                            onClick={() => handleRemoveTeacher(teacher.id)}
                          >
                            Unlink
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

        {openAssignmentsFor && (
          <div className="admin-panel" style={{ marginTop: "1rem" }}>
            <div className="admin-panel-head">
              <h2>Assignments for {openTeacher?.name}</h2>
              <span>Check every class section &amp; subject this teacher teaches -- a batch and join code appear automatically</span>
            </div>

            {assignmentLoading && <p>Loading...</p>}

            {!assignmentLoading && assignmentGrid && assignmentGrid.sections.length === 0 && (
              <p>This institution has no active class sections yet -- add one above first.</p>
            )}

            {!assignmentLoading && assignmentGrid && assignmentGrid.sections.length > 0 && (
              <>
                <div className="admin-bulk-pipeline-grid-shell">
                  <table className="admin-exam-types-table">
                    <thead>
                      <tr>
                        <th>Class section</th>
                        {assignmentGrid.subjects.map((subject) => (
                          <th key={subject.id}>{subject.name}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {assignmentGrid.sections.map((section) => (
                        <tr key={section.id}>
                          <td>
                            {section.className} - {section.name}
                          </td>
                          {assignmentGrid.subjects.map((subject) => {
                            const takenBy = takenByOthersMap[assignmentKey(section.id, subject.id)];
                            return (
                              <td key={subject.id} className={takenBy ? "admin-assignment-cell-taken" : undefined}>
                                <input
                                  type="checkbox"
                                  checked={Boolean(assignmentChecks[assignmentKey(section.id, subject.id)])}
                                  onChange={() => toggleAssignment(section.id, subject.id)}
                                  disabled={Boolean(takenBy)}
                                  title={takenBy ? `Already assigned to ${takenBy}` : undefined}
                                />
                                {takenBy && <span className="admin-assignment-cell-taken-label">{takenBy}</span>}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="admin-bulk-pipeline-dialog-actions">
                  <button type="button" className="ghost-button" onClick={() => setOpenAssignmentsFor(null)}>
                    Close
                  </button>
                  <button type="button" className="primary-button" disabled={assignmentSaving} onClick={handleSaveAssignments}>
                    {assignmentSaving ? "Saving..." : "Save Assignments"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
