export const MIN_PASSWORD_LENGTH = 8;
export const MIN_USERNAME_LENGTH = 3;

export const PASSWORD_RULES = [
  { test: (p) => p.length >= MIN_PASSWORD_LENGTH, label: "At least 8 characters" },
  { test: (p) => /[A-Z]/.test(p), label: "One uppercase letter" },
  { test: (p) => /[a-z]/.test(p), label: "One lowercase letter" },
  { test: (p) => /\d/.test(p), label: "One number" },
  { test: (p) => /[^A-Za-z0-9]/.test(p), label: "One special character" },
];

export function validateUsername(username) {
  const value = username.trim();
  if (!value) return "Username is required";
  if (value.length < MIN_USERNAME_LENGTH) {
    return `Username must be at least ${MIN_USERNAME_LENGTH} characters`;
  }
  if (!/[A-Za-z]/.test(value)) return "Username must contain at least one letter";
  return null;
}

export function validatePassword(password) {
  if (!password) return "Password is required";
  const failing = PASSWORD_RULES.find((rule) => !rule.test(password));
  return failing ? failing.label : null;
}

export function scorePassword(password) {
  if (!password) {
    return { score: 0, label: "", color: "var(--line)" };
  }

  const passed = PASSWORD_RULES.filter((rule) => rule.test(password)).length;
  const score = Math.min(Math.max(passed - 1, 0), 4);

  const meta = [
    { label: "Too weak", color: "#ef4444" },
    { label: "Weak", color: "#f59e0b" },
    { label: "Fair", color: "#eab308" },
    { label: "Good", color: "#22c55e" },
    { label: "Strong", color: "#16a34a" },
  ][score];

  return { score, ...meta };
}
