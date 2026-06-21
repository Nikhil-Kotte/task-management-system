# TaskFlow — Project Overview

A full-stack task management web app where users register, sign in, and manage
their own tasks through a clean, SaaS-style interface. Each task moves through a
status workflow, and the app tracks daily productivity stats and completion
streaks.

## What it does

- **Authentication** — register and log in with a username and password. Sessions
  use a JWT stored in the browser; protected routes require a valid token.
- **Task management** — create, edit, and delete tasks with a title, description,
  and priority (Low / Medium / High).
- **Status workflow** — every task is **To Do**, **In Progress**, or **Done**,
  switched from a segmented control on the task card.
- **Productivity stats** — a dashboard shows totals, tasks completed today, a
  completion rate, and a 🔥 day-streak built from consecutive days with a
  completed task.
- **Safe deletes** — deleting a completed task warns that it will remove the task
  from your stats and streak before it's erased.
- **Profile** — change your username, or change your password (current password
  required, with new + confirm fields).

## Tech stack

| Layer    | Technology |
|----------|------------|
| Frontend | React 19 (Vite), React Router, Axios, Bootstrap 5 + a custom CSS theme |
| Backend  | Python Flask REST API, Flask-JWT-Extended, Flask-SQLAlchemy, Flask-CORS |
| Database | SQLite |
| Auth     | JWT (bearer token), password hashing via Werkzeug |
| Testing  | pytest (backend) |

## Structure

```
task-management-system/
├── backend/                  Flask API
│   ├── app.py                models, routes, validation
│   └── test_app.py           pytest suite
└── frontend/
    └── src/
        ├── api.js            Axios client + JWT interceptor
        ├── App.jsx           routes / auth guard
        ├── passwordStrength.js   shared username/password validation
        ├── index.css         design system + theme
        ├── components/       AuthShell, AppNav, PasswordField, ConfirmDialog
        └── pages/            Login, Register, Tasks, Profile
```

## Data model

- **User** — `id`, `username` (unique), `password_hash`.
- **Task** — `id`, `title`, `description`, `priority` (1–3), `status`
  (`todo` / `in_progress` / `done`), `completed`, `completed_at`, `created_at`,
  `user_id`. The legacy `completed` flag stays in sync with `status` for
  backward compatibility.

## API surface

| Method | Route            | Auth | Purpose                         |
|--------|------------------|------|---------------------------------|
| POST   | `/register`      | —    | Create an account               |
| POST   | `/login`         | —    | Get a JWT                       |
| GET    | `/me`            | JWT  | Current user                    |
| GET    | `/tasks`         | JWT  | List tasks (paginated)          |
| POST   | `/tasks`         | JWT  | Create a task                   |
| PUT    | `/tasks/<id>`    | JWT  | Update a task                   |
| DELETE | `/tasks/<id>`    | JWT  | Delete a task                   |
| GET    | `/stats`         | JWT  | Totals, completed-today, streak |
| GET    | `/profile`       | JWT  | Profile + task count            |
| PUT    | `/profile`       | JWT  | Update username / password      |

## Validation rules

- **Username** — at least 3 characters and must contain at least one letter.
- **Password** — at least 8 characters, with at least one uppercase letter, one
  lowercase letter, one number, and one special character.

These rules are enforced on the server (source of truth) and mirrored on the
client, which shows a live requirements checklist and a strength meter while you
type. Validation errors are returned per-field so the UI can highlight the exact
input that's wrong.

## Design

The interface is built on Bootstrap 5 with a custom theme layer: an indigo→cyan
brand palette, the Inter typeface, soft shadows, and rounded cards. The auth
pages use a split layout — a glassmorphism brand panel (gradient, blurred glow
shapes, a product mockup, and trust stats) beside the sign-in/up form.

## Running it

See [README.md](README.md) for full setup and API documentation. In short:

```bash
# backend  (http://localhost:5000)
cd backend && pip install -r requirements.txt && python app.py

# frontend (http://localhost:5173)
cd frontend && npm install && npm run dev
```

Backend tests:

```bash
cd backend && pip install -r requirements-dev.txt && pytest
```
