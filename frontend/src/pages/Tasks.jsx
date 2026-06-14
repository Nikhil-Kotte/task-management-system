import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";

const priorityBadge = {
  1: "secondary",
  2: "info",
  3: "danger",
};

const priorityLabel = {
  1: "Low",
  2: "Medium",
  3: "High",
};

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState(2);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({
    page: 1,
    pages: 1,
    has_next: false,
    has_prev: false,
  });
  const [error, setError] = useState("");

  const navigate = useNavigate();

  const loadTasks = useCallback(async () => {
    try {
      const response = await api.get(`/tasks?page=${page}&per_page=5`);
      setTasks(response.data.tasks);
      setMeta(response.data);
    } catch (error) {
      setError(error.response?.data?.error || "Failed to load tasks");
    }
  }, [page]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadTasks();
  }, [loadTasks]);

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
        priority,
      });

      setTitle("");
      setDescription("");
      setPriority(2);

      if (page === 1) {
        await loadTasks();
      } else {
        setPage(1);
      }
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

      if (tasks.length === 1 && page > 1) {
        setPage((currentPage) => currentPage - 1);
      } else {
        await loadTasks();
      }
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

        <select
          className="form-select mb-2"
          value={priority}
          onChange={(event) => setPriority(Number(event.target.value))}
        >
          <option value={1}>Low</option>
          <option value={2}>Medium</option>
          <option value={3}>High</option>
        </select>

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

              <span className={`badge bg-${priorityBadge[task.priority]} ms-2`}>
                {priorityLabel[task.priority]}
              </span>
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

      <div className="d-flex justify-content-between mt-3">
        <button
          className="btn btn-sm btn-outline-primary"
          disabled={!meta.has_prev}
          onClick={() => setPage((currentPage) => currentPage - 1)}
        >
          Previous
        </button>

        <span>
          Page {meta.page} of {meta.pages || 1}
        </span>

        <button
          className="btn btn-sm btn-outline-primary"
          disabled={!meta.has_next}
          onClick={() => setPage((currentPage) => currentPage + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
