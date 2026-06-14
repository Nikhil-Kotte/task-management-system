import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const navigate = useNavigate();

  async function loadTasks() {
    const response = await api.get("/tasks");
    setTasks(response.data);
  }

  useEffect(() => {
    loadTasks();
  }, []);

  async function addTask(event) {
    event.preventDefault();

    if (title.trim() === "") {
      return;
    }

    await api.post("/tasks", {
      title: title,
      description: description,
    });

    setTitle("");
    setDescription("");

    loadTasks();
  }

  async function toggleTask(task) {
    await api.put(`/tasks/${task.id}`, {
      completed: !task.completed,
    });

    loadTasks();
  }

  async function deleteTask(taskId) {
    await api.delete(`/tasks/${taskId}`);

    loadTasks();
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