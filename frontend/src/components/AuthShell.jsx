export default function AuthShell({ title, subtitle, children }) {
  return (
    <div className="auth-wrap">
      <aside className="auth-brand">
        <div className="auth-brand__logo">
          <span className="auth-brand__logo-mark">✓</span>
          TaskFlow
        </div>

        <div>
          <h2 className="auth-brand__headline">
            Turn your to-do list into a winning streak.
          </h2>
          <p className="auth-brand__sub">
            Organize tasks, track progress, and watch your daily completions
            add up.
          </p>

          <ul className="auth-brand__features">
            <li>
              <span className="auth-brand__check">✓</span>
              Prioritize what matters with clear status
            </li>
            <li>
              <span className="auth-brand__check">✓</span>
              Build streaks by finishing tasks each day
            </li>
            <li>
              <span className="auth-brand__check">✓</span>
              Everything in one clean, fast workspace
            </li>
          </ul>
        </div>

        <p className="auth-brand__sub" style={{ fontSize: "0.85rem" }}>
          © {new Date().getFullYear()} TaskFlow
        </p>
      </aside>

      <main className="auth-panel">
        <div className="auth-card">
          <h1>{title}</h1>
          <p className="auth-card__sub">{subtitle}</p>
          {children}
        </div>
      </main>
    </div>
  );
}
