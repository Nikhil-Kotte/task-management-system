import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import api from "../api";
import AuthShell from "../components/AuthShell.jsx";
import PasswordField from "../components/PasswordField.jsx";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const justRegistered = location.state?.registered;

  function validate() {
    const next = {};
    if (!username.trim()) next.username = "Username is required";
    if (!password) next.password = "Password is required";
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
      const response = await api.post("/login", {
        username: username.trim(),
        password,
      });
      localStorage.setItem("token", response.data.access_token);
      navigate("/tasks");
    } catch (err) {
      if (err.response?.status === 401) {
        setErrors({ form: "Incorrect username or password." });
      } else if (err.response?.data?.error) {
        setErrors({ form: err.response.data.error });
      } else if (err.response) {
        setErrors({ form: `Login failed (server said ${err.response.status}).` });
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
      title="Welcome back"
      subtitle="Sign in to pick up where you left off."
    >
      {justRegistered && (
        <div className="alert alert-success" role="status">
          Account created — please sign in.
        </div>
      )}
      {errors.form && (
        <div className="alert alert-danger" role="alert">
          {errors.form}
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
            placeholder="Your username"
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
          autoComplete="current-password"
        />

        <button
          className="btn btn-primary w-100"
          type="submit"
          disabled={submitting}
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-3 mb-0 text-center" style={{ color: "var(--ink-soft)" }}>
        New here? <Link to="/register">Create an account</Link>
      </p>
    </AuthShell>
  );
}
