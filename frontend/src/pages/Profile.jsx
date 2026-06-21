import { useEffect, useState } from "react";
import api from "../api";
import AppNav from "../components/AppNav.jsx";
import PasswordField from "../components/PasswordField.jsx";
import {
  scorePassword,
  validateUsername,
  validatePassword,
  PASSWORD_RULES,
} from "../passwordStrength.js";

const EMPTY_STATS = {
  total: 0,
  done: 0,
  streak: 0,
  completion_rate: 0,
};

function formatMemberSince(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

export default function Profile() {
  const [username, setUsername] = useState("");
  const [createdAt, setCreatedAt] = useState(null);
  const [stats, setStats] = useState(EMPTY_STATS);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showSecurity, setShowSecurity] = useState(false);

  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);

  const strength = scorePassword(newPassword);
  const changingPassword = Boolean(currentPassword || newPassword || confirmPassword);

  useEffect(() => {
    async function loadAccount() {
      try {
        const profile = await api.get("/profile");
        setUsername(profile.data.username);
        setCreatedAt(profile.data.created_at);
      } catch (error) {
        setMessage({
          type: "danger",
          text: error.response?.data?.error || "Failed to load profile",
        });
      }
      try {
        const stat = await api.get("/stats");
        setStats(stat.data);
      } catch {
        setStats((current) => current);
      }
    }
    loadAccount();
  }, []);

  function validate() {
    const next = {};
    const usernameError = validateUsername(username);
    if (usernameError) next.username = usernameError;

    if (changingPassword) {
      if (!currentPassword) next.current_password = "Enter your current password";
      const passwordError = validatePassword(newPassword);
      if (passwordError) next.password = passwordError;
      if (!confirmPassword) {
        next.confirm = "Re-enter your new password";
      } else if (confirmPassword !== newPassword) {
        next.confirm = "Passwords do not match";
      }
    }
    return next;
  }

  async function saveProfile(event) {
    event.preventDefault();
    setMessage(null);
    setErrors({});

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      if (validationErrors.current_password || validationErrors.password || validationErrors.confirm) {
        setShowSecurity(true);
      }
      return;
    }

    const body = { username: username.trim() };
    if (changingPassword) {
      body.current_password = currentPassword;
      body.password = newPassword;
    }

    setSaving(true);
    try {
      await api.put("/profile", body);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage({
        type: "success",
        text: changingPassword ? "Profile and password updated." : "Profile saved.",
      });
    } catch (error) {
      const data = error.response?.data;
      if (data?.field) {
        setErrors({ [data.field]: data.error });
        if (data.field !== "username") setShowSecurity(true);
      } else {
        setMessage({
          type: "danger",
          text: data?.error || "Failed to save profile",
        });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <AppNav active="profile" />

      <main className="app-main" style={{ maxWidth: 720 }}>
        <h1 style={{ fontWeight: 800, letterSpacing: "-0.02em" }}>Profile</h1>
        <p style={{ color: "var(--ink-soft)" }}>
          Your account at a glance — productivity, details, and security.
        </p>

        {message && (
          <div className={`alert alert-${message.type}`} role="alert">
            {message.text}
          </div>
        )}

        <h2 className="section-title">Productivity</h2>
        <div className="stats-grid stats-grid--account mb-4">
          <div className="stat-card">
            <div className="stat-card__value">{stats.total}</div>
            <div className="stat-card__label">Tasks created</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__value">{stats.done}</div>
            <div className="stat-card__label">Tasks completed</div>
          </div>
          <div className="stat-card stat-card--streak">
            <div className="stat-card__value">🔥 {stats.streak}</div>
            <div className="stat-card__label">Current streak</div>
          </div>
          <div className="stat-card stat-card--done">
            <div className="stat-card__value">{stats.completion_rate}%</div>
            <div className="stat-card__label">Completion rate</div>
            <div className="stat-progress">
              <div
                className="stat-progress__fill"
                style={{ width: `${stats.completion_rate}%` }}
              />
            </div>
          </div>
        </div>

        <form onSubmit={saveProfile} noValidate>
          <h2 className="section-title">Account information</h2>
          <div className="surface p-4 mb-4">
            <div className="mb-3">
              <label className="form-label" htmlFor="username">
                Username
              </label>
              <input
                id="username"
                className={`form-control${errors.username ? " is-invalid" : ""}`}
                placeholder="Username"
                value={username}
                autoComplete="username"
                onChange={(event) => setUsername(event.target.value)}
              />
              {errors.username && <div className="field-error">{errors.username}</div>}
            </div>

            <div className="account-row">
              <span className="account-row__label">Member since</span>
              <span className="account-row__value">{formatMemberSince(createdAt)}</span>
            </div>
          </div>

          <h2 className="section-title">Security</h2>
          <div className="surface p-4 mb-4">
            <button
              type="button"
              className="security-toggle"
              aria-expanded={showSecurity}
              onClick={() => setShowSecurity((open) => !open)}
            >
              <span>Change password</span>
              <span className="security-toggle__chevron">{showSecurity ? "▲" : "▼"}</span>
            </button>

            {showSecurity && (
              <div className="security-body">
                <p style={{ color: "var(--ink-soft)", fontSize: "0.88rem" }}>
                  Leave these blank to keep your current password.
                </p>

                <PasswordField
                  id="current-password"
                  label="Current password"
                  value={currentPassword}
                  onChange={setCurrentPassword}
                  placeholder="Enter current password"
                  error={errors.current_password}
                  autoComplete="current-password"
                />

                <PasswordField
                  id="new-password"
                  label="New password"
                  value={newPassword}
                  onChange={setNewPassword}
                  placeholder="Enter new password"
                  error={errors.password}
                  autoComplete="new-password"
                />

                {newPassword && (
                  <div className="strength" style={{ marginTop: "-0.5rem", marginBottom: "1rem" }}>
                    <div className="strength__bars">
                      {[0, 1, 2, 3].map((i) => (
                        <span
                          key={i}
                          className="strength__bar"
                          style={{ background: i < strength.score ? strength.color : "var(--line)" }}
                        />
                      ))}
                    </div>
                    <div className="strength__label" style={{ color: strength.color }}>
                      {strength.label}
                    </div>
                    <ul className="pw-rules">
                      {PASSWORD_RULES.map((rule) => {
                        const met = rule.test(newPassword);
                        return (
                          <li
                            key={rule.label}
                            className={`pw-rules__item${met ? " pw-rules__item--met" : ""}`}
                          >
                            <span className="pw-rules__icon">{met ? "✓" : "○"}</span>
                            {rule.label}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                <PasswordField
                  id="confirm-password"
                  label="Confirm new password"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  placeholder="Re-enter new password"
                  error={errors.confirm}
                  autoComplete="new-password"
                />
              </div>
            )}
          </div>

          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </form>
      </main>
    </>
  );
}
