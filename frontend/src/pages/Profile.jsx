import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";

export default function Profile() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [taskCount, setTaskCount] = useState(0);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadProfile() {
      try {
        const response = await api.get("/profile");
        setUsername(response.data.username);
        setEmail(response.data.email || "");
        setTaskCount(response.data.task_count);
      } catch (error) {
        setMessage(error.response?.data?.error || "Failed to load profile");
      }
    }

    loadProfile();
  }, []);

  async function saveProfile(event) {
    event.preventDefault();
    setMessage("");

    const body = { username, email };

    if (password) {
      body.password = password;
    }

    try {
      await api.put("/profile", body);
      setPassword("");
      setMessage("Profile saved");
    } catch (error) {
      setMessage(error.response?.data?.error || "Failed to save profile");
    }
  }

  return (
    <form onSubmit={saveProfile} className="container mt-5" style={{ maxWidth: 400 }}>
      <h2>Profile</h2>

      {message && <div className="alert alert-info">{message}</div>}

      <p className="mb-3">Tasks created: {taskCount}</p>

      <input
        className="form-control mb-2"
        placeholder="Username"
        value={username}
        onChange={(event) => setUsername(event.target.value)}
      />

      <input
        className="form-control mb-2"
        type="email"
        placeholder="Email (for notifications)"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />

      <input
        className="form-control mb-2"
        type="password"
        placeholder="New password optional"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />

      <button className="btn btn-primary w-100">Save</button>

      <p className="mt-3 text-center">
        <Link to="/tasks">Back to Tasks</Link>
      </p>
    </form>
  );
}