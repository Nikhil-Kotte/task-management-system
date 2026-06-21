import { useEffect, useState } from "react";
import api from "../api";
import AppNav from "../components/AppNav.jsx";
import PasswordField from "../components/PasswordField.jsx";
import { scorePassword, MIN_PASSWORD_LENGTH } from "../passwordStrength.js";

export default function Profile() {
  const [username, setUsername] = useState("");
  const [taskCount, setTaskCount] = useState(0);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);

  const strength = scorePassword(newPassword);
  const changingPassword = Boolean(currentPassword || newPassword || confirmPassword);

  useEffect(() => {
    async function loadProfile() {
      try {
        const response = await api.get("/profile");
        setUsername(response.data.username);
        setTaskCount(response.data.task_count);
      } catch (error) {
        setMessage({
          type: "danger",
          text: error.response?.data?.error || "Failed to load profile",
        });
      }
    }
    loadProfile();
  }, []);

  function validate() {
    const next = {};
    if (!username.trim()) next.username = "Username can't be empty";

    if (changingPassword) {
      if (!currentPassword) next.current_password = "Enter your current password";
      if (!newPassword) {
        next.password = "Enter a new password";
      } else if (newPassword.length < MIN_PASSWORD_LENGTH) {
        next.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
      }
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

      <main className="app-main" style={{ maxWidth: 560 }}>
        <h1 style={{ fontWeight: 800, letterSpacing: "-0.02em" }}>Profile</h1>
        <p style={{ color: "var(--ink-soft)" }}>
          Manage your account details and password.
        </p>

        <div className="stat-card mb-4" style={{ maxWidth: 220 }}>
          <div className="stat-card__value">{taskCount}</div>
          <div className="stat-card__label">Tasks created</div>
        </div>

        {message && (
          <div className={`alert alert-${message.type}`} role="alert">
            {message.text}
          </div>
        )}

        <form onSubmit={saveProfile} className="surface p-4" noValidate>
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

          <hr style={{ borderColor: "var(--line)", margin: "1.5rem 0 1rem" }} />

          <h2 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "0.25rem" }}>
            Change password
          </h2>
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

          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </form>
      </main>
    </>
  );
}
