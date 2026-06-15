import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api";

export default function Register() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const navigate = useNavigate();

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (username === "" || password === "") {
      setError("Fill all fields");
      return;
    }
    if (password.length < 4) {
      setError("Password too short");
      return;
    }

    try {
      await api.post("/register", { username, email, password });
      navigate("/login");
    } catch (err) {
      setError(err.response?.data?.error || "Registration failed");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="container mt-5" style={{ maxWidth: 400 }}>
      <h2>Register</h2>
      {error && <div className="alert alert-danger">{error}</div>}
      <input
        className="form-control mb-2"
        placeholder="Username"
        value={username}
        onChange={(event) => setUsername(event.target.value)}
      />
      <input
        className="form-control mb-2"
        type="email"
        placeholder="Email (optional, for notifications)"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <input
        className="form-control mb-2"
        type="password"
        placeholder="Password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <button className="btn btn-primary w-100">Register</button>
      <p className="mt-2">
        Have an account? <Link to="/login">Login</Link>
      </p>
    </form>
  );
}