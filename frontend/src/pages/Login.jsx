import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const navigate = useNavigate();

  function areFieldsEmpty() {
    return username === "" || password === "";
  }

  function saveToken(token) {
    localStorage.setItem("token", token);
  }

  async function loginUser() {
    const response = await api.post("/login", {
      username: username,
      password: password,
    });

    saveToken(response.data.access_token);
    navigate("/tasks");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");

    if (areFieldsEmpty()) {
      setError("Fill all fields");
      return;
    }

    try {
      await loginUser();
    } catch (error) {
      setError(error.response?.data?.error || "Login failed");
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="container mt-5"
      style={{ maxWidth: 400 }}
    >
      <h2>Login</h2>

      {error && <div className="alert alert-danger">{error}</div>}

      <input
        className="form-control mb-2"
        placeholder="Username"
        value={username}
        onChange={(event) => setUsername(event.target.value)}
      />

      <input
        className="form-control mb-2"
        type="password"
        placeholder="Password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />

      <button className="btn btn-primary w-100">Login</button>

      <p className="mt-2">
        No account? <Link to="/register">Register</Link>
      </p>
    </form>
  );
}