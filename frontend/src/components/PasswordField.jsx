import { useState } from "react";

export default function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder = "••••••••",
  error,
  autoComplete = "current-password",
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="mb-3">
      {label && (
        <label className="form-label" htmlFor={id}>
          {label}
        </label>
      )}
      <div className="password-field">
        <input
          id={id}
          className={`form-control${error ? " is-invalid" : ""}`}
          type={visible ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          autoComplete={autoComplete}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          className="password-toggle"
          onClick={() => setVisible((shown) => !shown)}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
      {error && <div className="field-error">{error}</div>}
    </div>
  );
}
