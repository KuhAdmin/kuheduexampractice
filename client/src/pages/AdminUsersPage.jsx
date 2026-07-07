import { useCallback, useEffect, useState } from "react";
import { createAdminUser, getAdminUsers, updateAdminUserRole } from "../api/client";

const ROLES = ["student", "moderator", "admin"];

const emptyForm = { name: "", email: "", password: "", role: "moderator" };

export const AdminUsersPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [busyUserId, setBusyUserId] = useState("");

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

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      await createAdminUser(form);
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

  return (
    <section className="admin-bulk-pipeline-page">
      <div className="admin-bulk-pipeline-header">
        <div>
          <span className="eyebrow">Admin module</span>
          <h1>Users</h1>
          <p>Add moderator and admin accounts, and manage existing users' roles.</p>
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
            <select
              value={form.role}
              onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}
            >
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>
        </div>
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
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.name}</td>
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
