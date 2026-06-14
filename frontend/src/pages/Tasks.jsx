import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    async function fetchTasks() {
      try {
        const response = await api.get("/tasks");
        setTasks(response.data);
      } catch (error) {
        setError(error.response?.data?.error || "Failed to load tasks");
      }
    }

    fetchTasks();
  }, []);

  async function loadTasks() {
    try {
      const response = await api.get("/tasks");
      setTasks(response.data);
    } catch (error) {
      setError(error.response?.data?.error || "Failed to load tasks");
    }
  }

  async function addTask(event) {
    event.preventDefault();
    setError("");

    if (title.trim() === "") {
      setError("Title is required");
      return;
    }

    try {
      await api.post("/tasks", {
        title,
        description,
      });

      setTitle("");
      setDescription("");
      await loadTasks();
    } catch (error) {
      setError(error.response?.data?.error || "Failed to add task");
    }
  }

  async function toggleTask(task) {
    try {
      await api.put(`/tasks/${task.id}`, {
        completed: !task.completed,
      });

      await loadTasks();
    } catch (error) {
      setError(error.response?.data?.error || "Failed to update task");
    }
  }

  async function deleteTask(taskId) {
    try {
      await api.delete(`/tasks/${taskId}`);
      await loadTasks();
    } catch (error) {
      setError(error.response?.data?.error || "Failed to delete task");
    }
  }

  function logout() {
    localStorage.removeItem("token");
    navigate("/login");
  }

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between">
        <h2>My Tasks</h2>

        <button className="btn btn-outline-secondary" onClick={logout}>
          Logout
        </button>
      </div>

      {error && <div className="alert alert-danger mt-3">{error}</div>}

      <form onSubmit={addTask} className="my-3">
        <input
          className="form-control mb-2"
          placeholder="Title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />

        <input
          className="form-control mb-2"
          placeholder="Description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />

        <button className="btn btn-primary">Add Task</button>
      </form>

      <ul className="list-group">
        {tasks.map((task) => (
          <li
            key={task.id}
            className="list-group-item d-flex justify-content-between align-items-center"
          >
            <span
              style={{
                textDecoration: task.completed ? "line-through" : "none",
              }}
            >
              <input
                type="checkbox"
                className="me-2"
                checked={task.completed}
                onChange={() => toggleTask(task)}
              />

              <strong>{task.title}</strong> - {task.description}
            </span>

            <button
              className="btn btn-sm btn-danger"
              onClick={() => deleteTask(task.id)}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}