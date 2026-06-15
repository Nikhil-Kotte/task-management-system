# Task Management System

A full-stack task manager with JWT authentication. Users can register, log in,
and create, view, edit, complete, and delete their own tasks.

- **Front-end:** React 19 (Vite) + Bootstrap 5, Axios for HTTP
- **Back-end:** Python Flask REST API with Flask-JWT-Extended
- **Database:** SQLite (via Flask-SQLAlchemy)

Optional features included: task priority (low/medium/high) with sorting,
pagination, and a user profile page.

```
task-management-system/
├── backend/        Flask API
│   ├── app.py
│   ├── requirements.txt        runtime dependencies
│   ├── requirements-dev.txt    test dependencies (pytest)
│   └── test_app.py             backend test suite
└── frontend/       React (Vite) app
    └── src/
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

The suite covers registration/login, password hashing, the JWT auth guard,
task CRUD, input validation, pagination, and cross-user ownership isolation.

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
{ "username": "alice", "password": "secret" }
```

**Responses**

| Status | Body                                   | When                       |
|--------|----------------------------------------|----------------------------|
| 201    | `{ "success": "registered" }`          | Created                    |
| 400    | `{ "error": "Username and Password required" }` | Missing field     |
| 409    | `{ "error": "Username already taken" }`| Username exists            |

---

#### `POST /login`

Authenticate and receive a JWT.

**Request body**
```json
{ "username": "alice", "password": "secret" }
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
  "priority": 2,
  "user_id": 1
}
```

`priority`: `1` = Low, `2` = Medium (default), `3` = High.

---

#### `POST /tasks`

Create a task for the authenticated user.

**Request body**
```json
{ "title": "Buy milk", "description": "2 litres", "priority": 3 }
```
- `title` — **required**
- `description` — optional (defaults to `""`)
- `priority` — optional, must be `1`, `2`, or `3` (defaults to `2`)
- `completed` — optional boolean (defaults to `false`)

**Responses**

| Status | Body                                        |
|--------|---------------------------------------------|
| 201    | The created task object                     |
| 400    | `{ "error": "title is required" }`          |
| 400    | `{ "error": "priority must be 1, 2, or 3" }`|

---

#### `GET /tasks`

List the authenticated user's tasks, paginated. Tasks are ordered with
incomplete first, then by priority (high → low), then newest first.

**Query parameters**

| Param      | Default | Description            |
|------------|---------|------------------------|
| `page`     | 1       | Page number            |
| `per_page` | 5       | Items per page         |

**Example:** `GET /tasks?page=1&per_page=5`

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
{ "title": "New title", "description": "Updated", "completed": true, "priority": 1 }
```

**Responses**

| Status | Body                                         |
|--------|----------------------------------------------|
| 200    | The updated task object                      |
| 400    | `{ "error": "priority must be 1, 2, or 3" }` |
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

### Profile routes  *(JWT required)*

#### `GET /profile`

Return the authenticated user's profile and task count.

**Response — 200**
```json
{ "id": 1, "username": "alice", "task_count": 4 }
```

---

#### `PUT /profile`

Update the username and/or password. Both fields are optional.

**Request body**
```json
{ "username": "alice2", "password": "newsecret" }
```

**Responses**

| Status | Body                              | When               |
|--------|-----------------------------------|--------------------|
| 200    | `{ "message": "updated" }`        | Success            |
| 409    | `{ "error": "username taken" }`   | Username in use    |
| 404    | `{ "error": "user not found" }`   | User missing       |

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
