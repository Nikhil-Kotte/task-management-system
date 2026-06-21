import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../api";
import AppNav from "../components/AppNav.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";

const PRIORITY_LABEL = { 1: "Low", 2: "Medium", 3: "High" };
const STATUSES = [
  { key: "todo", label: "To Do" },
  { key: "in_progress", label: "In Progress" },
  { key: "done", label: "Done" },
];
const CATEGORIES = ["Personal", "Work", "Study", "Health"];
const CUSTOM_OPTION = "__custom__";

const EMPTY_STATS = {
  total: 0,
  todo: 0,
  in_progress: 0,
  done: 0,
  completed_today: 0,
  due_today: 0,
  overdue: 0,
  by_category: {},
  streak: 0,
  completion_rate: 0,
};

function categoryClass(category) {
  const known = CATEGORIES.map((c) => c.toLowerCase());
  return known.includes((category || "").toLowerCase())
    ? `badge-category badge-category--${category.toLowerCase()}`
    : "badge-category";
}

function formatDue(value) {
  const parsed = new Date(`${value}T00:00:00`);
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState(EMPTY_STATS);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState(2);
  const [category, setCategory] = useState("Personal");
  const [customCategory, setCustomCategory] = useState("");
  const [dueDate, setDueDate] = useState("");

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterDue, setFilterDue] = useState("all");

  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, pages: 1, has_next: false, has_prev: false });
  const [error, setError] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPriority, setEditPriority] = useState(2);
  const [editCategory, setEditCategory] = useState("Personal");
  const [editDueDate, setEditDueDate] = useState("");

  const [pendingDelete, setPendingDelete] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  function applyFilter(setter) {
    return (event) => {
      setter(event.target.value);
      setPage(1);
    };
  }

  const loadStats = useCallback(async () => {
    try {
      const response = await api.get("/stats");
      setStats(response.data);
    } catch {
      setStats((current) => current);
    }
  }, []);

  const loadTasks = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), per_page: "5" });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (filterCategory !== "all") params.set("category", filterCategory);
    if (filterStatus !== "all") params.set("status", filterStatus);
    if (filterPriority !== "all") params.set("priority", filterPriority);
    if (filterDue !== "all") params.set("due", filterDue);

    try {
      const response = await api.get(`/tasks?${params.toString()}`);
      setTasks(response.data.tasks);
      setMeta(response.data);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load tasks");
    }
  }, [page, debouncedSearch, filterCategory, filterStatus, filterPriority, filterDue]);

  useEffect(() => {
    let active = true;
    (async () => {
      await Promise.resolve();
      if (active) await Promise.all([loadTasks(), loadStats()]);
    })();
    return () => {
      active = false;
    };
  }, [loadTasks, loadStats]);

  async function refresh() {
    await Promise.all([loadTasks(), loadStats()]);
  }

  const filterCategoryOptions = useMemo(() => {
    const set = new Set(CATEGORIES);
    tasks.forEach((task) => set.add(task.category));
    Object.keys(stats.by_category || {}).forEach((c) => set.add(c));
    return [...set];
  }, [tasks, stats]);

  function resolvedCategory() {
    if (category === CUSTOM_OPTION) return customCategory.trim() || "Personal";
    return category;
  }

  async function addTask(event) {
    event.preventDefault();
    setError("");

    if (title.trim() === "") {
      setError("Please enter a task title.");
      return;
    }

    try {
      await api.post("/tasks", {
        title: title.trim(),
        description,
        priority,
        category: resolvedCategory(),
        due_date: dueDate || null,
      });
      setTitle("");
      setDescription("");
      setPriority(2);
      setCategory("Personal");
      setCustomCategory("");
      setDueDate("");

      if (page === 1) {
        await refresh();
      } else {
        setPage(1);
      }
    } catch (err) {
      setError(err.response?.data?.error || "Failed to add task");
    }
  }

  function startEdit(task) {
    setError("");
    setEditingId(task.id);
    setEditTitle(task.title);
    setEditDescription(task.description || "");
    setEditPriority(task.priority);
    setEditCategory(task.category || "Personal");
    setEditDueDate(task.due_date || "");
  }

  async function saveEdit(taskId) {
    if (editTitle.trim() === "") {
      setError("Title is required");
      return;
    }
    try {
      await api.put(`/tasks/${taskId}`, {
        title: editTitle.trim(),
        description: editDescription,
        priority: editPriority,
        category: editCategory.trim() || "Personal",
        due_date: editDueDate || null,
      });
      setEditingId(null);
      await refresh();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update task");
    }
  }

  async function changeStatus(task, status) {
    if (task.status === status) return;
    try {
      await api.put(`/tasks/${task.id}`, { status });
      await refresh();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update task");
    }
  }

  async function confirmDelete() {
    const taskId = pendingDelete.id;
    setPendingDelete(null);
    try {
      await api.delete(`/tasks/${taskId}`);
      if (tasks.length === 1 && page > 1) {
        setPage((current) => current - 1);
      } else {
        await refresh();
      }
    } catch (err) {
      setError(err.response?.data?.error || "Failed to delete task");
    }
  }

  return (
    <>
      <AppNav active="tasks" />

      <main className="app-main">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-card__value">{stats.total}</div>
            <div className="stat-card__label">Total tasks</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__value">{stats.due_today}</div>
            <div className="stat-card__label">Due today</div>
          </div>
          <div className="stat-card stat-card--overdue">
            <div className="stat-card__value">{stats.overdue}</div>
            <div className="stat-card__label">Overdue</div>
          </div>
          <div className="stat-card stat-card--done">
            <div className="stat-card__value">{stats.done}</div>
            <div className="stat-card__label">Completed</div>
            <div className="stat-progress">
              <div
                className="stat-progress__fill"
                style={{ width: `${stats.completion_rate}%` }}
              />
            </div>
          </div>
          <div className="stat-card stat-card--streak">
            <div className="stat-card__value">🔥 {stats.streak}</div>
            <div className="stat-card__label">Day streak</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__value">{stats.in_progress}</div>
            <div className="stat-card__label">In progress</div>
          </div>
        </div>

        {stats.completed_today > 0 && (
          <p style={{ color: "var(--ink-soft)", marginTop: "-0.75rem" }}>
            You've completed <strong>{stats.completed_today}</strong>{" "}
            {stats.completed_today === 1 ? "task" : "tasks"} today. Keep it going!
          </p>
        )}

        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={addTask} className="surface p-3 mb-4">
          <input
            className="form-control mb-2"
            placeholder="What needs doing?"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <textarea
            className="form-control mb-2"
            placeholder="Add more detail (optional)"
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
          <div className="task-form-row">
            <select
              className="form-select"
              value={priority}
              onChange={(event) => setPriority(Number(event.target.value))}
            >
              <option value={1}>Low priority</option>
              <option value={2}>Medium priority</option>
              <option value={3}>High priority</option>
            </select>
            <select
              className="form-select"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <option value={CUSTOM_OPTION}>+ Custom…</option>
            </select>
            {category === CUSTOM_OPTION && (
              <input
                className="form-control"
                placeholder="Custom category"
                maxLength={30}
                value={customCategory}
                onChange={(event) => setCustomCategory(event.target.value)}
              />
            )}
            <input
              className="form-control"
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
            <button className="btn btn-primary ms-auto" type="submit">
              Add task
            </button>
          </div>
        </form>

        <div className="filter-bar surface p-3 mb-4">
          <input
            className="form-control"
            type="text"
            placeholder="Search tasks…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="filter-bar__selects">
            <select
              className="form-select"
              value={filterCategory}
              onChange={applyFilter(setFilterCategory)}
            >
              <option value="all">All categories</option>
              {filterCategoryOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              className="form-select"
              value={filterStatus}
              onChange={applyFilter(setFilterStatus)}
            >
              <option value="all">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
            <select
              className="form-select"
              value={filterPriority}
              onChange={applyFilter(setFilterPriority)}
            >
              <option value="all">All priorities</option>
              <option value="3">High</option>
              <option value="2">Medium</option>
              <option value="1">Low</option>
            </select>
            <select
              className="form-select"
              value={filterDue}
              onChange={applyFilter(setFilterDue)}
            >
              <option value="all">Any due date</option>
              <option value="today">Due today</option>
              <option value="week">Due this week</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
        </div>

        {tasks.length === 0 ? (
          <div className="empty-state surface">
            <div className="empty-state__emoji">📝</div>
            <h3 style={{ fontWeight: 700 }}>No tasks found</h3>
            <p>Try adjusting your search or filters, or add a new task above.</p>
          </div>
        ) : (
          <div className="d-flex flex-column gap-3">
            {tasks.map((task) =>
              editingId === task.id ? (
                <div key={task.id} className="surface p-3">
                  <input
                    className="form-control mb-2"
                    placeholder="Title"
                    value={editTitle}
                    onChange={(event) => setEditTitle(event.target.value)}
                  />
                  <textarea
                    className="form-control mb-2"
                    placeholder="Description"
                    rows={3}
                    value={editDescription}
                    onChange={(event) => setEditDescription(event.target.value)}
                  />
                  <div className="task-form-row mb-3">
                    <select
                      className="form-select"
                      value={editPriority}
                      onChange={(event) => setEditPriority(Number(event.target.value))}
                    >
                      <option value={1}>Low</option>
                      <option value={2}>Medium</option>
                      <option value={3}>High</option>
                    </select>
                    <input
                      className="form-control"
                      placeholder="Category"
                      maxLength={30}
                      value={editCategory}
                      onChange={(event) => setEditCategory(event.target.value)}
                    />
                    <input
                      className="form-control"
                      type="date"
                      value={editDueDate}
                      onChange={(event) => setEditDueDate(event.target.value)}
                    />
                  </div>
                  <button
                    className="btn btn-sm btn-primary me-2"
                    onClick={() => saveEdit(task.id)}
                  >
                    Save
                  </button>
                  <button
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => setEditingId(null)}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div
                  key={task.id}
                  className={`task-card task-card--p${task.priority}${
                    task.status === "done" ? " task-card--done" : ""
                  }${task.is_overdue ? " task-card--overdue" : ""}`}
                >
                  <div className="flex-grow-1">
                    <div className="task-card__title">{task.title}</div>
                    {task.description && (
                      <div className="task-card__desc" style={{ whiteSpace: "pre-wrap" }}>
                        {task.description}
                      </div>
                    )}

                    <div className="task-card__meta">
                      <span className="status-pills">
                        {STATUSES.map((s) => (
                          <button
                            key={s.key}
                            className={`status-pill status-pill--${s.key}${
                              task.status === s.key ? " status-pill--active" : ""
                            }`}
                            onClick={() => changeStatus(task, s.key)}
                          >
                            {s.label}
                          </button>
                        ))}
                      </span>

                      <span className={categoryClass(task.category)}>
                        {task.category}
                      </span>

                      <span className={`badge-priority badge-priority--p${task.priority}`}>
                        {PRIORITY_LABEL[task.priority]}
                      </span>

                      {task.is_overdue && <span className="badge-overdue">Overdue</span>}

                      {task.due_date && (
                        <span className="task-card__due">Due: {formatDue(task.due_date)}</span>
                      )}
                    </div>
                  </div>

                  <div className="d-flex gap-2">
                    <button
                      className="icon-btn"
                      title="Edit task"
                      onClick={() => startEdit(task)}
                    >
                      ✎
                    </button>
                    <button
                      className="icon-btn icon-btn--danger"
                      title="Delete task"
                      onClick={() => setPendingDelete(task)}
                    >
                      🗑
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        )}

        {meta.pages > 1 && (
          <div className="d-flex justify-content-between align-items-center mt-4">
            <button
              className="btn btn-sm btn-outline-primary"
              disabled={!meta.has_prev}
              onClick={() => setPage((current) => current - 1)}
            >
              ← Previous
            </button>
            <span style={{ color: "var(--ink-soft)" }}>
              Page {meta.page} of {meta.pages || 1}
            </span>
            <button
              className="btn btn-sm btn-outline-primary"
              disabled={!meta.has_next}
              onClick={() => setPage((current) => current + 1)}
            >
              Next →
            </button>
          </div>
        )}
      </main>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this task?"
        message={
          pendingDelete?.status === "done"
            ? `"${pendingDelete?.title}" is marked done. Deleting it will remove it from your completed count and streak. This can't be undone.`
            : `"${pendingDelete?.title}" will be permanently deleted. This can't be undone.`
        }
        confirmLabel="Delete"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}
