import { useCallback, useEffect, useState } from "react";
import {
  createAdminUser,
  getAdminUsers,
  getClassSubjectOptions,
  resetAdminUserPassword,
  updateAdminUserRole,
  updateSuperstudentAccess,
} from "../api/client";

const ROLES = ["student", "moderator", "admin", "superstudent"];

// The seed admin login is exempt from the access toggle -- it's the
// fallback account used to recover the admin panel, so it must never be
// left ambiguous about whether it has full access.
const PROTECTED_ACCESS_EMAIL = "admin@example.com";

const emptyForm = {
  name: "",
  email: "",
  password: "",
  role: "moderator",
  remarks: "",
  scopeType: "all",
  scopeClassKeys: [],
  scopeSubjectCodes: [],
};

const classKey = (row) => `${row.examGoalCode}|${row.levelCode}`;

const getDistinctClasses = (options) => {
  const map = new Map();
  options.forEach((row) => {
    const key = classKey(row);
    if (!map.has(key)) {
      map.set(key, {
        key,
        examGoalCode: row.examGoalCode,
        levelCode: row.levelCode,
        examGoalName: row.examGoalName,
        levelName: row.levelName,
      });
    }
  });
  return Array.from(map.values());
};

const getDistinctSubjects = (options) => {
  const map = new Map();
  options.forEach((row) => {
    if (!map.has(row.subjectCode)) {
      map.set(row.subjectCode, { subjectCode: row.subjectCode, subjectName: row.subjectName });
    }
  });
  return Array.from(map.values());
};

// Short access-scope summary shown under each user's name -- computed
// entirely from fields already present on the mapped user object, no extra
// server call needed.
const describeAccessScope = (user) => {
  if (user.superstudentAccessEnabled) {
    if (user.superstudentScopeType === "all") {
      return "Full access · All classes & subjects";
    }

    const classCodes = (user.superstudentScopeClasses || []).map((entry) => entry.levelCode);
    const classesLabel = classCodes.length ? `Classes ${classCodes.join(", ")}` : "no classes set";

    if (user.superstudentScopeType === "class") {
      return `Full access · ${classesLabel} · all subjects`;
    }

    const subjectNames = (user.superstudentScopeSubjects || []).map((entry) => entry.subjectName);
    const subjectsLabel = subjectNames.length ? subjectNames.join(", ") : "no subjects set";
    return `Full access · ${classesLabel} · ${subjectsLabel}`;
  }

  if (user.role === "admin") return "Admin panel access";
  if (user.role === "moderator") return "Content moderation";

  const tier = user.isPremium ? "Premium" : "Free";
  if (!user.board && !user.studentClass && !user.subject) {
    return `${tier} · no class selected`;
  }

  const boardLabel = user.board ? user.board.toUpperCase() : "—";
  const classLabel = user.studentClass || "—";
  const subjectLabel = user.subject ? user.subject.charAt(0).toUpperCase() + user.subject.slice(1) : "—";
  return `${tier} · Class ${classLabel} (${boardLabel}) · ${subjectLabel}`;
};

export const AdminUsersPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [busyUserId, setBusyUserId] = useState("");
  const [editingRemarksUserId, setEditingRemarksUserId] = useState("");
  const [remarksDraft, setRemarksDraft] = useState("");
  const [resettingPasswordUserId, setResettingPasswordUserId] = useState("");
  const [newPasswordDraft, setNewPasswordDraft] = useState("");
  const [classSubjectOptions, setClassSubjectOptions] = useState([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState("");

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getAdminUsers();
      setUsers(result?.users || []);
    } catch (loadError) {
      setError(loadError.message || "Failed to load users.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const loadClassSubjectOptions = async () => {
    setOptionsLoading(true);
    setOptionsError("");
    try {
      const result = await getClassSubjectOptions();
      setClassSubjectOptions(result?.options || []);
    } catch (loadError) {
      setOptionsError(loadError.message || "Failed to load class/subject options.");
    } finally {
      setOptionsLoading(false);
    }
  };

  const handleRoleFieldChange = (role) => {
    setForm((current) => ({
      ...current,
      role,
      scopeType: "all",
      scopeClassKeys: [],
      scopeSubjectCodes: [],
    }));
    if (role === "superstudent" && classSubjectOptions.length === 0 && !optionsLoading) {
      loadClassSubjectOptions();
    }
  };

  const toggleScopeClass = (key) => {
    setForm((current) => ({
      ...current,
      scopeClassKeys: current.scopeClassKeys.includes(key)
        ? current.scopeClassKeys.filter((existing) => existing !== key)
        : [...current.scopeClassKeys, key],
    }));
  };

  const toggleScopeSubject = (subjectCode) => {
    setForm((current) => ({
      ...current,
      scopeSubjectCodes: current.scopeSubjectCodes.includes(subjectCode)
        ? current.scopeSubjectCodes.filter((existing) => existing !== subjectCode)
        : [...current.scopeSubjectCodes, subjectCode],
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (form.role === "superstudent") {
      if (!form.remarks.trim()) {
        setError("Remarks are required for a superstudent account.");
        return;
      }
      if (form.scopeType !== "all" && form.scopeClassKeys.length === 0) {
        setError("Select at least one class for this scope.");
        return;
      }
      if (form.scopeType === "class_subject" && form.scopeSubjectCodes.length === 0) {
        setError("Select at least one subject for this scope.");
        return;
      }
    }

    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      const scopeClasses = form.scopeClassKeys.map((key) => {
        const [examGoalCode, levelCode] = key.split("|");
        return { examGoalCode, levelCode };
      });
      await createAdminUser({
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
        remarks: form.remarks,
        scopeType: form.scopeType,
        scopeClasses,
        scopeSubjects: form.scopeSubjectCodes,
      });
      setNotice(`Created ${form.role} account for ${form.email}.`);
      setForm(emptyForm);
      await loadUsers();
    } catch (submitError) {
      setError(submitError.message || "Failed to create user.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRoleChange = async (userId, role) => {
    setBusyUserId(userId);
    setError("");
    try {
      await updateAdminUserRole(userId, role);
      await loadUsers();
    } catch (updateError) {
      setError(updateError.message || "Failed to update role.");
    } finally {
      setBusyUserId("");
    }
  };

  const handleAccessToggle = async (userId, isEnabled) => {
    setBusyUserId(userId);
    setError("");
    try {
      await updateSuperstudentAccess(userId, { isEnabled });
      await loadUsers();
    } catch (updateError) {
      setError(updateError.message || "Failed to update access.");
    } finally {
      setBusyUserId("");
    }
  };

  const startEditingRemarks = (user) => {
    setEditingRemarksUserId(user.id);
    setRemarksDraft(user.superstudentRemarks || "");
  };

  const handleRemarksSave = async (userId) => {
    setBusyUserId(userId);
    setError("");
    try {
      await updateSuperstudentAccess(userId, { remarks: remarksDraft });
      setEditingRemarksUserId("");
      await loadUsers();
    } catch (updateError) {
      setError(updateError.message || "Failed to update remarks.");
    } finally {
      setBusyUserId("");
    }
  };

  const startResettingPassword = (userId) => {
    setResettingPasswordUserId(userId);
    setNewPasswordDraft("");
  };

  const handlePasswordReset = async (userId) => {
    if (newPasswordDraft.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    setBusyUserId(userId);
    setError("");
    try {
      await resetAdminUserPassword(userId, newPasswordDraft);
      setNotice("Password updated.");
      setResettingPasswordUserId("");
      setNewPasswordDraft("");
    } catch (updateError) {
      setError(updateError.message || "Failed to reset password.");
    } finally {
      setBusyUserId("");
    }
  };

  const distinctClasses = getDistinctClasses(classSubjectOptions);
  const distinctSubjects = getDistinctSubjects(classSubjectOptions);

  return (
    <section className="admin-bulk-pipeline-page">
      <div className="admin-bulk-pipeline-header">
        <div>
          <span className="eyebrow">Admin module</span>
          <h1>Users</h1>
          <p>
            Add moderator, admin, and superstudent accounts, and manage existing users' roles. Grant any
            account (other than the primary admin login) full or scoped class/subject/chapter access
            regardless of subscription, and toggle it on/off at any time.
          </p>
        </div>
      </div>

      <form className="admin-add-user-form" onSubmit={handleSubmit}>
        <h2>Add User</h2>
        <div className="admin-studio-form-grid">
          <label className="admin-studio-field">
            <span>Name</span>
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              required
            />
          </label>
          <label className="admin-studio-field">
            <span>Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              required
            />
          </label>
          <label className="admin-studio-field">
            <span>Password</span>
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              required
              minLength={8}
            />
          </label>
          <label className="admin-studio-field">
            <span>Role</span>
            <select value={form.role} onChange={(event) => handleRoleFieldChange(event.target.value)}>
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>
          {form.role === "superstudent" && (
            <label className="admin-studio-field">
              <span>Remarks (who is this for?)</span>
              <input
                value={form.remarks}
                onChange={(event) => setForm((current) => ({ ...current, remarks: event.target.value }))}
                placeholder="e.g. Greenwood Public School evaluation account"
                required
              />
            </label>
          )}
          {form.role === "superstudent" && (
            <label className="admin-studio-field">
              <span>Scope</span>
              <select
                value={form.scopeType}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    scopeType: event.target.value,
                    scopeClassKeys: [],
                    scopeSubjectCodes: [],
                  }))
                }
              >
                <option value="all">All access (every class &amp; subject)</option>
                <option value="class">Classes only (all subjects)</option>
                <option value="class_subject">Classes + Subjects</option>
              </select>
            </label>
          )}
        </div>

        {form.role === "superstudent" && form.scopeType !== "all" && (
          <div className="admin-users-scope-picker">
            {optionsLoading && <p>Loading classes...</p>}
            {optionsError && <p className="error-text">{optionsError}</p>}
            {!optionsLoading && !optionsError && (
              <>
                <div>
                  <span>Classes</span>
                  <div className="admin-users-scope-checklist">
                    {distinctClasses.map((option) => (
                      <label key={option.key}>
                        <input
                          type="checkbox"
                          checked={form.scopeClassKeys.includes(option.key)}
                          onChange={() => toggleScopeClass(option.key)}
                        />
                        {option.levelName} ({option.examGoalName})
                      </label>
                    ))}
                  </div>
                </div>
                {form.scopeType === "class_subject" && (
                  <div>
                    <span>Subjects</span>
                    <div className="admin-users-scope-checklist">
                      {distinctSubjects.map((option) => (
                        <label key={option.subjectCode}>
                          <input
                            type="checkbox"
                            checked={form.scopeSubjectCodes.includes(option.subjectCode)}
                            onChange={() => toggleScopeSubject(option.subjectCode)}
                          />
                          {option.subjectName}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {error && <p className="error-text">{error}</p>}
        {notice && <div className="admin-bulk-pipeline-concurrency">{notice}</div>}
        <button type="submit" className="primary-button" disabled={submitting}>
          {submitting ? "Creating..." : "Add User"}
        </button>
      </form>

      <div className="admin-bulk-pipeline-grid-shell">
        {loading ? (
          <div className="admin-bulk-pipeline-empty">Loading users...</div>
        ) : (
          <table className="admin-bulk-pipeline-grid">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Full access</th>
                <th>Actions</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div className="admin-users-name-cell">
                      <span>{user.name}</span>
                      <span className="admin-users-scope-label">{describeAccessScope(user)}</span>
                    </div>
                  </td>
                  <td>{user.email}</td>
                  <td>
                    <select
                      value={user.role}
                      disabled={busyUserId === user.id}
                      onChange={(event) => handleRoleChange(user.id, event.target.value)}
                    >
                      {ROLES.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {user.email !== PROTECTED_ACCESS_EMAIL ? (
                      <div className="admin-superstudent-access-cell">
                        <label className="admin-settings-toggle admin-superstudent-access-toggle">
                          <span>{user.superstudentAccessEnabled ? "On" : "Off"}</span>
                          <input
                            type="checkbox"
                            checked={Boolean(user.superstudentAccessEnabled)}
                            disabled={busyUserId === user.id}
                            onChange={(event) => handleAccessToggle(user.id, event.target.checked)}
                          />
                        </label>
                        {editingRemarksUserId === user.id ? (
                          <div className="admin-superstudent-remarks-editor">
                            <textarea
                              value={remarksDraft}
                              onChange={(event) => setRemarksDraft(event.target.value)}
                              rows={2}
                            />
                            <div className="admin-superstudent-remarks-actions">
                              <button
                                type="button"
                                className="primary-button"
                                disabled={busyUserId === user.id}
                                onClick={() => handleRemarksSave(user.id)}
                              >
                                Save
                              </button>
                              <button type="button" onClick={() => setEditingRemarksUserId("")}>
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="admin-superstudent-remarks-text" onClick={() => startEditingRemarks(user)}>
                            {user.superstudentRemarks || "Add remarks..."}
                          </p>
                        )}
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td>
                    {resettingPasswordUserId === user.id ? (
                      <div className="admin-users-password-editor">
                        <input
                          type="password"
                          value={newPasswordDraft}
                          onChange={(event) => setNewPasswordDraft(event.target.value)}
                          minLength={8}
                          placeholder="New password"
                        />
                        <div className="admin-superstudent-remarks-actions">
                          <button
                            type="button"
                            className="primary-button"
                            disabled={busyUserId === user.id}
                            onClick={() => handlePasswordReset(user.id)}
                          >
                            Save
                          </button>
                          <button type="button" onClick={() => setResettingPasswordUserId("")}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button type="button" onClick={() => startResettingPassword(user.id)}>
                        Reset password
                      </button>
                    )}
                  </td>
                  <td className="admin-pipeline-runs-datetime">
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
};
