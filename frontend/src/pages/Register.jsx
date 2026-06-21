import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api";
import AuthShell from "../components/AuthShell.jsx";
import PasswordField from "../components/PasswordField.jsx";
import { scorePassword, MIN_PASSWORD_LENGTH } from "../passwordStrength.js";

const MIN_USERNAME_LENGTH = 3;

export default function Register() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const navigate = useNavigate();
  const strength = scorePassword(password);

  function validate() {
    const next = {};
    if (!username.trim()) {
      next.username = "Username is required";
    } else if (username.trim().length < MIN_USERNAME_LENGTH) {
      next.username = `Username must be at least ${MIN_USERNAME_LENGTH} characters`;
    }

    if (!password) {
      next.password = "Password is required";
    } else if (password.length < MIN_PASSWORD_LENGTH) {
      next.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
    }

    if (!confirm) {
      next.confirm = "Please re-enter your password";
    } else if (confirm !== password) {
      next.confirm = "Passwords do not match";
    }

    return next;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setErrors({});

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/register", {
        username: username.trim(),
        password,
      });
      setSuccess(true);
      setTimeout(() => navigate("/login", { state: { registered: true } }), 800);
    } catch (err) {
      const data = err.response?.data;
      if (data?.field) {
        setErrors({ [data.field]: data.error });
      } else if (data?.error) {
        setErrors({ form: data.error });
      } else if (err.response) {
        setErrors({ form: `Registration failed (server said ${err.response.status}).` });
      } else {
        setErrors({
          form: "Can't reach the server. Make sure the backend is running, then try again.",
        });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Start organizing your tasks in seconds — no email required."
    >
      {errors.form && (
        <div className="alert alert-danger" role="alert">
          {errors.form}
        </div>
      )}
      {success && (
        <div className="alert alert-success" role="status">
          Account created! Taking you to sign in…
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="mb-3">
          <label className="form-label" htmlFor="username">
            Username
          </label>
          <input
            id="username"
            className={`form-control${errors.username ? " is-invalid" : ""}`}
            placeholder="e.g. alex_morgan"
            value={username}
            autoComplete="username"
            onChange={(event) => setUsername(event.target.value)}
          />
          {errors.username && <div className="field-error">{errors.username}</div>}
        </div>

        <PasswordField
          id="password"
          label="Password"
          value={password}
          onChange={setPassword}
          error={errors.password}
          autoComplete="new-password"
        />

        {password && (
          <div className="strength" style={{ marginTop: "-0.5rem", marginBottom: "1rem" }}>
            <div className="strength__bars">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className="strength__bar"
                  style={{
                    background: i < strength.score ? strength.color : "var(--line)",
                  }}
                />
              ))}
            </div>
            <div className="strength__label" style={{ color: strength.color }}>
              {strength.label}
            </div>
          </div>
        )}

        <PasswordField
          id="confirm"
          label="Confirm password"
          value={confirm}
          onChange={setConfirm}
          error={errors.confirm}
          autoComplete="new-password"
        />

        <button
          className="btn btn-primary w-100"
          type="submit"
          disabled={submitting || success}
        >
          {submitting ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="mt-3 mb-0 text-center" style={{ color: "var(--ink-soft)" }}>
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </AuthShell>
  );
}
