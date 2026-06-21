import { Link, useNavigate } from "react-router-dom";

export default function AppNav({ active }) {
  const navigate = useNavigate();

  function logout() {
    localStorage.removeItem("token");
    navigate("/login");
  }

  return (
    <nav className="app-nav">
      <div className="app-nav__inner">
        <Link to="/tasks" className="app-brand">
          <span className="app-brand__mark">✓</span>
          TaskFlow
        </Link>

        <div className="d-flex align-items-center gap-2">
          <Link
            to="/tasks"
            className={`btn btn-sm ${active === "tasks" ? "btn-primary" : "btn-outline-primary"}`}
          >
            Tasks
          </Link>
          <Link
            to="/profile"
            className={`btn btn-sm ${active === "profile" ? "btn-primary" : "btn-outline-primary"}`}
          >
            Profile
          </Link>
          <button className="btn btn-sm btn-outline-secondary" onClick={logout}>
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
