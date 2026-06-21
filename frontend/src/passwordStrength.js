export const MIN_PASSWORD_LENGTH = 6;

export function scorePassword(password) {
  if (!password) {
    return { score: 0, label: "", color: "var(--line)" };
  }

  let score = 0;
  if (password.length >= MIN_PASSWORD_LENGTH) score++;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  score = Math.min(score, 4);

  const meta = [
    { label: "Too weak", color: "#ef4444" },
    { label: "Weak", color: "#f59e0b" },
    { label: "Fair", color: "#eab308" },
    { label: "Good", color: "#22c55e" },
    { label: "Strong", color: "#16a34a" },
  ][score];

  return { score, ...meta };
}
