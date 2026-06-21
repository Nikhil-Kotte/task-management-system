# Task Management System

A full-stack task manager with JWT authentication. Users can register, log in,
and create, view, edit, complete, and delete their own tasks.

## Live Demo

- **App (front-end):** https://task-management-system-1-jnby.onrender.com
- **API (back-end):** https://task-management-system-7n09.onrender.com

Both are deployed on [Render](https://render.com). The free tier sleeps after
inactivity, so the first request may take ~30–60s to wake the services.

- **Front-end:** React 19 (Vite) + Bootstrap 5, Axios for HTTP
- **Back-end:** Python Flask REST API with Flask-JWT-Extended
- **Database:** SQLite (via Flask-SQLAlchemy)

Features include:

- **Auth** with strong password rules and a username/password profile editor.
- **Tasks** with title, description, priority (low/medium/high), **category**
  (Personal / Work / Study / Health, or a custom value), and an optional
  **due date** with overdue detection.
- A three-state **status workflow** (To Do → In Progress → Done).
- **Search & filtering** by text, category, status, priority, and due window
  (today / this week / overdue), with pagination.
- A **productivity dashboard** (`/stats`): totals, completed-today, due-today,
  overdue, per-category counts, completion rate, and a daily **streak**.
- An **account dashboard** (Profile) showing your stats and "member since" date.

> **A note on the front-end tooling:** the brief suggested `create-react-app`,
> but this project uses **Vite**. CRA has been deprecated and is no longer
> recommended by the React team; Vite is its modern successor and offers
> significantly faster builds and dev startup. All functional requirements
> (React, React Router, hooks, Axios, JWT in localStorage) are fully met.

```
task-management-system/
├── backend/        Flask API
│   ├── app.py                  models, routes, validation
│   ├── requirements.txt        runtime dependencies
│   ├── requirements-dev.txt    test dependencies (pytest)
│   └── test_app.py             backend test suite
└── frontend/       React (Vite) app
    └── src/
        ├── api.js              Axios client + JWT interceptor
        ├── App.jsx             routes / auth guard
        ├── passwordStrength.js shared username/password validation
        ├── index.css           design system + theme
        ├── components/         AuthShell, AppNav, PasswordField, ConfirmDialog
        └── pages/              Login, Register, Tasks, Profile
```

---

## Prerequisites

- **Python** 3.10+
- **Node.js** 18+ and npm

---

## Back-end setup (Flask)

All commands run from the `backend/` directory.

### 1. Create and activate a virtual environment

**Windows (PowerShell):**
```powershell
cd backend
python -m venv venv
venv\Scripts\Activate.ps1
```

**macOS / Linux:**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

To also install test dependencies:
```bash
pip install -r requirements-dev.txt
```

### 3. Run the API

```bash
python app.py
```

The API starts at **http://localhost:5000**. The SQLite database
(`instance/tasks.db`) is created automatically on first run.

### JWT secret key

The app reads its JWT signing key from the `JWT_SECRET_KEY` environment
variable.

- When you run `python app.py` directly, a **dev-only** fallback secret is used
  automatically — no setup needed for local development.
- For any real deployment (e.g. running under gunicorn/WSGI), `JWT_SECRET_KEY`
  **must** be set or the app will refuse to start:

  ```bash
  # macOS / Linux
  export JWT_SECRET_KEY="a-long-random-secret"

  # Windows (PowerShell)
  $env:JWT_SECRET_KEY = "a-long-random-secret"
  ```

### Running the tests

```bash
cd backend
pip install -r requirements-dev.txt   # if not already installed
pytest
```

The suite covers registration/login, the username and password complexity
rules, password hashing and password-change verification, the JWT auth guard,
task CRUD, status/category/due-date handling and overdue detection, search and
filtering, the `/stats` aggregates, input validation, pagination, and cross-user
ownership isolation.

---

## Front-end setup (React / Vite)

All commands run from the `frontend/` directory.

### 1. Install dependencies

```bash
cd frontend
npm install
```

### 2. Run the dev server

```bash
npm run dev
```

The app opens at **http://localhost:5173** (Vite's default) and talks to the
Flask API at `http://localhost:5000`.

### Pointing at a different API URL (optional)

By default the front-end calls `http://localhost:5000`. To override it (e.g. a
deployed API), create a `.env` file in `frontend/`:

```
VITE_API_URL=https://your-api-host.example.com
```

### Production build

```bash
npm run build      # outputs static files to frontend/dist/
npm run preview    # serves the built files locally
```

> **Note:** Start the back-end before the front-end so login and task requests
> succeed.

---

## API Documentation

Base URL: `http://localhost:5000`

All requests and responses use JSON. Task and profile routes require a JWT,
sent as an `Authorization` header:

```
Authorization: Bearer <access_token>
```

### Authentication errors

Protected routes return these errors when the token is missing or bad:

| Condition          | Status | Body                          |
|--------------------|--------|-------------------------------|
| No token provided  | 401    | `{ "error": "missing token" }` |
| Malformed token    | 422    | `{ "error": "invalid token" }` |
| Expired token      | 401    | `{ "error": "token expired" }` |

---

### Auth routes

#### `POST /register`

Register a new user.

**Request body**
```json
{ "username": "alice", "password": "Secret1!" }
```

- `username` — **required**; at least 3 characters and must contain at least one
  letter.
- `password` — **required**; at least 8 characters with at least one uppercase
  letter, one lowercase letter, one number, and one special character.

**Responses**

| Status | Body                                                   | When                          |
|--------|--------------------------------------------------------|-------------------------------|
| 201    | `{ "success": "registered" }`                          | Created                       |
| 400    | `{ "error": "<message>", "field": "username" }`        | Username missing/too short/no letter |
| 400    | `{ "error": "<message>", "field": "password" }`        | Password fails a complexity rule |
| 409    | `{ "error": "That username is already taken", "field": "username" }` | Username exists |

Validation errors include a `field` key (`"username"` or `"password"`) so the UI
can highlight the exact input that's wrong.

---

#### `POST /login`

Authenticate and receive a JWT.

**Request body**
```json
{ "username": "alice", "password": "Secret1!" }
```

**Responses**

| Status | Body                              | When               |
|--------|-----------------------------------|--------------------|
| 200    | `{ "access_token": "<jwt>" }`     | Success            |
| 401    | `{ "error": "invalid credentials" }` | Bad username/password |

---

### Task routes  *(JWT required)*

A task object looks like:

```json
{
  "id": 1,
  "title": "Buy milk",
  "description": "2 litres",
  "completed": false,
  "status": "todo",
  "priority": 2,
  "category": "Personal",
  "due_date": "2026-06-30",
  "is_overdue": false,
  "completed_at": null,
  "user_id": 1
}
```

- `status`: `"todo"` (default), `"in_progress"`, or `"done"`. `completed` is kept
  in sync with `status` (`true` only when `done`); `completed_at` is the ISO
  timestamp set when a task first becomes done.
- `priority`: `1` = Low, `2` = Medium (default), `3` = High.
- `category`: a free-text label (default `"Personal"`, max 30 chars). The UI
  offers Personal / Work / Study / Health plus a custom option.
- `due_date`: an ISO date (`YYYY-MM-DD`) or `null`.
- `is_overdue`: `true` when the task is not done and its `due_date` is in the
  past (computed; read-only).

---

#### `POST /tasks`

Create a task for the authenticated user.

**Request body**
```json
{
  "title": "Buy milk",
  "description": "2 litres",
  "priority": 3,
  "category": "Personal",
  "due_date": "2026-06-30",
  "status": "todo"
}
```
- `title` — **required**
- `description` — optional (defaults to `""`)
- `priority` — optional, must be `1`, `2`, or `3` (defaults to `2`)
- `category` — optional, max 30 chars (defaults to `"Personal"`)
- `due_date` — optional ISO date `YYYY-MM-DD` or `null`
- `status` — optional, one of `todo` / `in_progress` / `done` (defaults to `todo`)
- `completed` — optional boolean shortcut; `true` is treated as `status: "done"`

**Responses**

| Status | Body                                                  |
|--------|-------------------------------------------------------|
| 201    | The created task object                               |
| 400    | `{ "error": "title is required" }`                    |
| 400    | `{ "error": "priority must be 1, 2, or 3" }`          |
| 400    | `{ "error": "status must be todo, in_progress, or done" }` |
| 400    | `{ "error": "due_date must be a valid date (YYYY-MM-DD)" }` |
| 400    | `{ "error": "category must be at most 30 characters" }` |

---

#### `GET /tasks`

List the authenticated user's tasks, paginated. Tasks are ordered with
incomplete first, then by priority (high → low), then newest first. Search and
filters are applied server-side **before** pagination, so `total`/`pages` reflect
the filtered result set.

**Query parameters** (all optional)

| Param      | Default | Description                                              |
|------------|---------|----------------------------------------------------------|
| `page`     | 1       | Page number                                              |
| `per_page` | 5       | Items per page                                           |
| `search`   | —       | Case-insensitive match on title **or** description       |
| `category` | —       | Exact category match (omit or `all` for no filter)       |
| `status`   | —       | One of `todo` / `in_progress` / `done`                   |
| `priority` | —       | `1`, `2`, or `3`                                          |
| `due`      | —       | `today`, `week` (next 7 days), or `overdue`              |

**Examples:**
`GET /tasks?page=1&per_page=5`
`GET /tasks?search=react&category=Work&due=overdue`

**Response — 200**
```json
{
  "tasks": [ /* array of task objects */ ],
  "page": 1,
  "pages": 3,
  "total": 12,
  "has_next": true,
  "has_prev": false
}
```

---

#### `PUT /tasks/<id>`

Update a task. Any subset of fields may be sent; only those provided are
changed. Only the task's owner may update it.

**Request body (all fields optional)**
```json
{
  "title": "New title",
  "description": "Updated",
  "status": "done",
  "priority": 1,
  "category": "Work",
  "due_date": "2026-07-15"
}
```
- Send `"due_date": null` to clear a due date.
- `status` is the source of truth; sending `"completed": true`/`false` is also
  accepted and maps to `done` / `todo`.

**Responses**

| Status | Body                                         |
|--------|----------------------------------------------|
| 200    | The updated task object                      |
| 400    | `{ "error": "priority must be 1, 2, or 3" }` |
| 400    | `{ "error": "status must be todo, in_progress, or done" }` |
| 400    | `{ "error": "due_date must be a valid date (YYYY-MM-DD)" }` |
| 404    | `{ "error": "not found" }` (missing or not yours) |

---

#### `DELETE /tasks/<id>`

Delete a task. Only the task's owner may delete it.

**Responses**

| Status | Body                          |
|--------|-------------------------------|
| 200    | `{ "message": "deleted" }`    |
| 404    | `{ "error": "not found" }`    |

---

### Stats route  *(JWT required)*

#### `GET /stats`

Return productivity aggregates for the authenticated user. Powers the Tasks and
Profile dashboards. "Today" is computed in UTC for consistency with stored
timestamps.

**Response — 200**
```json
{
  "total": 12,
  "todo": 5,
  "in_progress": 3,
  "done": 4,
  "completed_today": 2,
  "due_today": 1,
  "overdue": 3,
  "by_category": { "Personal": 7, "Work": 5 },
  "streak": 4,
  "completion_rate": 33
}
```

- `completion_rate` — percentage of tasks that are done (0 when there are none).
- `streak` — consecutive days (ending today/yesterday) with at least one task
  completed.
- `by_category` — task counts keyed by category.

---

### Profile routes  *(JWT required)*

#### `GET /profile`

Return the authenticated user's profile.

**Response — 200**
```json
{
  "id": 1,
  "username": "alice",
  "task_count": 4,
  "created_at": "2026-06-22T10:15:00+00:00"
}
```

- `created_at` — ISO timestamp of when the account was created (shown as
  "member since" in the UI); may be `null` for very old accounts.

---

#### `PUT /profile`

Update the username and/or password. All fields are optional, but **changing the
password requires the current password**.

**Request body**
```json
{
  "username": "alice2",
  "current_password": "Secret1!",
  "password": "NewPass2@"
}
```
- `username` — optional; same rules as registration (≥3 chars, ≥1 letter).
- `password` — optional new password; must meet the complexity rules. When
  present, `current_password` is **required** and must match.

**Responses**

| Status | Body                                                          | When                         |
|--------|---------------------------------------------------------------|------------------------------|
| 200    | `{ "message": "updated" }`                                    | Success                      |
| 400    | `{ "error": "Enter your current password to change it", "field": "current_password" }` | New password without current |
| 400    | `{ "error": "Current password is incorrect", "field": "current_password" }` | Wrong current password |
| 400    | `{ "error": "<message>", "field": "username" \| "password" }` | Validation failure           |
| 409    | `{ "error": "That username is already taken", "field": "username" }` | Username in use       |
| 404    | `{ "error": "user not found" }`                               | User missing                 |

---

## Using the app — register and log in

Once both servers are running (see setup above), open the front-end URL printed
by Vite (default **http://localhost:5173**). You'll land on the **Sign in** page.

### Create an account

1. Click **Create an account** (or go to `/register`).
2. Choose a **username** — at least 3 characters and containing at least one
   letter.
3. Choose a **password** that meets all of these rules (a live checklist shows
   your progress):
   - at least **8 characters**
   - at least one **uppercase** letter
   - at least one **lowercase** letter
   - at least one **number**
   - at least one **special character** (e.g. `!`, `@`, `#`)
4. Re-enter the same password in **Confirm password**.
5. Click **Create account**. On success you're taken to the sign-in page.

> Example valid credentials: username `alex_morgan`, password `Secret1!`

### Sign in

1. On the **Sign in** page (`/login`), enter your username and password.
2. Click **Sign in**. You're taken to your **Tasks** page, where you can add,
   edit, categorize, set due dates for, search, filter, and complete tasks.

Your session is kept with a token in the browser, so you stay signed in until you
click **Logout** (top-right). Visit **Profile** to see your productivity stats,
your "member since" date, and to change your username or password.

If you can't reach the server when registering or signing in, make sure the
**back-end is running** at http://localhost:5000.

---

## Quick start (TL;DR)

```bash
# Terminal 1 — back-end
cd backend
python -m venv venv && venv\Scripts\Activate.ps1   # (or: source venv/bin/activate)
pip install -r requirements.txt
python app.py

# Terminal 2 — front-end
cd frontend
npm install
npm run dev
```

Then open the front-end URL printed by Vite (default
http://localhost:5173), register an account, and start managing tasks.
