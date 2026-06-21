import os
import tempfile
from datetime import datetime, timezone, timedelta

os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-of-sufficient-length-123")

import pytest

import app as app_module
from app import app, db


def utc_today():
    return datetime.now(timezone.utc).date()


@pytest.fixture
def client():
    db_fd, db_path = tempfile.mkstemp(suffix=".db")
    app.config["TESTING"] = True
    app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{db_path}"

    with app.app_context():
        db.create_all()

    with app.test_client() as client:
        yield client

    with app.app_context():
        db.drop_all()

    os.close(db_fd)
    os.remove(db_path)


def register(client, username="alice", password="Secret1!"):
    return client.post("/register", json={"username": username, "password": password})


def login(client, username="alice", password="Secret1!"):
    resp = client.post("/login", json={"username": username, "password": password})
    return resp.get_json().get("access_token")


def auth_header(token):
    return {"Authorization": f"Bearer {token}"}


def test_register_success(client):
    resp = register(client)
    assert resp.status_code == 201


def test_register_requires_fields(client):
    resp = client.post("/register", json={"username": "", "password": ""})
    assert resp.status_code == 400


def test_register_duplicate_username(client):
    register(client)
    resp = register(client)
    assert resp.status_code == 409


def test_login_success_returns_token(client):
    register(client)
    resp = client.post("/login", json={"username": "alice", "password": "Secret1!"})
    assert resp.status_code == 200
    assert "access_token" in resp.get_json()


def test_login_wrong_password(client):
    register(client)
    resp = client.post("/login", json={"username": "alice", "password": "nope"})
    assert resp.status_code == 401


def test_password_is_hashed(client):
    register(client)
    with app.app_context():
        user = app_module.User.query.filter_by(username="alice").first()
        assert user.password_hash != "Secret1!"


def test_tasks_require_token(client):
    resp = client.get("/tasks")
    assert resp.status_code == 401


def test_tasks_reject_invalid_token(client):
    resp = client.get("/tasks", headers={"Authorization": "Bearer garbage"})
    assert resp.status_code == 422


def test_create_and_list_task(client):
    register(client)
    token = login(client)

    create = client.post(
        "/tasks",
        json={"title": "Buy milk", "description": "2L", "priority": 3},
        headers=auth_header(token),
    )
    assert create.status_code == 201
    assert create.get_json()["title"] == "Buy milk"

    listed = client.get("/tasks", headers=auth_header(token))
    assert listed.status_code == 200
    body = listed.get_json()
    assert body["total"] == 1
    assert body["tasks"][0]["title"] == "Buy milk"


def test_create_task_requires_title(client):
    register(client)
    token = login(client)
    resp = client.post("/tasks", json={"title": ""}, headers=auth_header(token))
    assert resp.status_code == 400


def test_create_task_rejects_bad_priority(client):
    register(client)
    token = login(client)
    resp = client.post(
        "/tasks", json={"title": "x", "priority": 9}, headers=auth_header(token)
    )
    assert resp.status_code == 400


def test_update_task(client):
    register(client)
    token = login(client)
    task_id = client.post(
        "/tasks", json={"title": "old"}, headers=auth_header(token)
    ).get_json()["id"]

    resp = client.put(
        f"/tasks/{task_id}",
        json={"title": "new", "completed": True, "priority": 1},
        headers=auth_header(token),
    )
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["title"] == "new"
    assert data["completed"] is True
    assert data["priority"] == 1


def test_delete_task(client):
    register(client)
    token = login(client)
    task_id = client.post(
        "/tasks", json={"title": "temp"}, headers=auth_header(token)
    ).get_json()["id"]

    resp = client.delete(f"/tasks/{task_id}", headers=auth_header(token))
    assert resp.status_code == 200

    listed = client.get("/tasks", headers=auth_header(token))
    assert listed.get_json()["total"] == 0


def test_user_cannot_access_other_users_task(client):
    register(client, "alice", "Secret1!")
    alice_token = login(client, "alice", "Secret1!")
    task_id = client.post(
        "/tasks", json={"title": "alice task"}, headers=auth_header(alice_token)
    ).get_json()["id"]

    register(client, "bob", "Secret1!")
    bob_token = login(client, "bob", "Secret1!")

    assert client.get("/tasks", headers=auth_header(bob_token)).get_json()["total"] == 0
    assert client.put(
        f"/tasks/{task_id}", json={"title": "hijack"}, headers=auth_header(bob_token)
    ).status_code == 404
    assert client.delete(
        f"/tasks/{task_id}", headers=auth_header(bob_token)
    ).status_code == 404


def test_register_short_password(client):
    resp = client.post("/register", json={"username": "alice", "password": "abc"})
    assert resp.status_code == 400
    assert resp.get_json()["field"] == "password"


def test_register_short_username(client):
    resp = client.post("/register", json={"username": "ab", "password": "Secret1!"})
    assert resp.status_code == 400
    assert resp.get_json()["field"] == "username"


def test_register_username_requires_a_letter(client):
    resp = client.post("/register", json={"username": "123", "password": "Secret1!"})
    assert resp.status_code == 400
    assert resp.get_json()["field"] == "username"


@pytest.mark.parametrize(
    "password",
    [
        "Short1!",        # too short (7)
        "lowercase1!",    # no uppercase
        "UPPERCASE1!",    # no lowercase
        "NoNumber!!",     # no digit
        "NoSpecial1",     # no special char
    ],
)
def test_register_password_complexity(client, password):
    resp = client.post(
        "/register", json={"username": "alice", "password": password}
    )
    assert resp.status_code == 400
    assert resp.get_json()["field"] == "password"


def test_register_accepts_strong_password(client):
    resp = client.post(
        "/register", json={"username": "alice", "password": "Secret1!"}
    )
    assert resp.status_code == 201


def test_create_task_defaults_to_todo(client):
    register(client)
    token = login(client)
    task = client.post(
        "/tasks", json={"title": "x"}, headers=auth_header(token)
    ).get_json()
    assert task["status"] == "todo"
    assert task["completed"] is False
    assert task["completed_at"] is None


def test_status_done_sets_completed_and_timestamp(client):
    register(client)
    token = login(client)
    task_id = client.post(
        "/tasks", json={"title": "x"}, headers=auth_header(token)
    ).get_json()["id"]

    done = client.put(
        f"/tasks/{task_id}", json={"status": "done"}, headers=auth_header(token)
    ).get_json()
    assert done["status"] == "done"
    assert done["completed"] is True
    assert done["completed_at"] is not None


def test_reject_bad_status(client):
    register(client)
    token = login(client)
    resp = client.post(
        "/tasks", json={"title": "x", "status": "nope"}, headers=auth_header(token)
    )
    assert resp.status_code == 400


def test_stats_endpoint(client):
    register(client)
    token = login(client)
    for i in range(3):
        client.post("/tasks", json={"title": f"t{i}"}, headers=auth_header(token))
    task_id = client.post(
        "/tasks", json={"title": "done one"}, headers=auth_header(token)
    ).get_json()["id"]
    client.put(f"/tasks/{task_id}", json={"status": "done"}, headers=auth_header(token))

    stats = client.get("/stats", headers=auth_header(token)).get_json()
    assert stats["total"] == 4
    assert stats["done"] == 1
    assert stats["completed_today"] == 1
    assert stats["streak"] == 1


def test_change_password_requires_current(client):
    register(client)
    token = login(client)
    resp = client.put(
        "/profile", json={"password": "newsecret"}, headers=auth_header(token)
    )
    assert resp.status_code == 400
    assert resp.get_json()["field"] == "current_password"


def test_change_password_wrong_current(client):
    register(client)
    token = login(client)
    resp = client.put(
        "/profile",
        json={"current_password": "wrong", "password": "newsecret"},
        headers=auth_header(token),
    )
    assert resp.status_code == 400
    assert resp.get_json()["field"] == "current_password"


def test_change_password_success(client):
    register(client)
    token = login(client)
    resp = client.put(
        "/profile",
        json={"current_password": "Secret1!", "password": "NewPass2@"},
        headers=auth_header(token),
    )
    assert resp.status_code == 200
    assert client.post(
        "/login", json={"username": "alice", "password": "Secret1!"}
    ).status_code == 401
    assert client.post(
        "/login", json={"username": "alice", "password": "NewPass2@"}
    ).status_code == 200


def test_change_password_rejects_weak(client):
    register(client)
    token = login(client)
    resp = client.put(
        "/profile",
        json={"current_password": "Secret1!", "password": "weakpass"},
        headers=auth_header(token),
    )
    assert resp.status_code == 400
    assert resp.get_json()["field"] == "password"


def test_update_username_only_no_current_password_needed(client):
    register(client)
    token = login(client)
    resp = client.put(
        "/profile", json={"username": "alice2"}, headers=auth_header(token)
    )
    assert resp.status_code == 200


def test_create_task_defaults_category_personal(client):
    register(client)
    token = login(client)
    task = client.post(
        "/tasks", json={"title": "x"}, headers=auth_header(token)
    ).get_json()
    assert task["category"] == "Personal"
    assert task["due_date"] is None
    assert task["is_overdue"] is False


def test_create_task_with_category_and_due_date(client):
    register(client)
    token = login(client)
    task = client.post(
        "/tasks",
        json={"title": "x", "category": "Work", "due_date": "2026-06-30"},
        headers=auth_header(token),
    ).get_json()
    assert task["category"] == "Work"
    assert task["due_date"] == "2026-06-30"


def test_create_task_rejects_bad_due_date(client):
    register(client)
    token = login(client)
    resp = client.post(
        "/tasks",
        json={"title": "x", "due_date": "not-a-date"},
        headers=auth_header(token),
    )
    assert resp.status_code == 400


def test_overdue_flag(client):
    register(client)
    token = login(client)
    yesterday = (utc_today() - timedelta(days=1)).isoformat()
    task = client.post(
        "/tasks", json={"title": "late", "due_date": yesterday}, headers=auth_header(token)
    ).get_json()
    assert task["is_overdue"] is True

    done = client.put(
        f"/tasks/{task['id']}", json={"status": "done"}, headers=auth_header(token)
    ).get_json()
    assert done["is_overdue"] is False


def test_clear_due_date(client):
    register(client)
    token = login(client)
    task_id = client.post(
        "/tasks", json={"title": "x", "due_date": "2026-06-30"}, headers=auth_header(token)
    ).get_json()["id"]
    cleared = client.put(
        f"/tasks/{task_id}", json={"due_date": None}, headers=auth_header(token)
    ).get_json()
    assert cleared["due_date"] is None


def test_search_filter(client):
    register(client)
    token = login(client)
    client.post("/tasks", json={"title": "Learn React"}, headers=auth_header(token))
    client.post("/tasks", json={"title": "Buy milk", "description": "react to nothing"},
                headers=auth_header(token))
    client.post("/tasks", json={"title": "Walk dog"}, headers=auth_header(token))

    body = client.get("/tasks?search=react", headers=auth_header(token)).get_json()
    assert body["total"] == 2


def test_category_filter(client):
    register(client)
    token = login(client)
    client.post("/tasks", json={"title": "a", "category": "Work"}, headers=auth_header(token))
    client.post("/tasks", json={"title": "b", "category": "Study"}, headers=auth_header(token))

    body = client.get("/tasks?category=Work", headers=auth_header(token)).get_json()
    assert body["total"] == 1
    assert body["tasks"][0]["category"] == "Work"


def test_status_and_priority_filters(client):
    register(client)
    token = login(client)
    client.post("/tasks", json={"title": "a", "priority": 3}, headers=auth_header(token))
    low_id = client.post(
        "/tasks", json={"title": "b", "priority": 1}, headers=auth_header(token)
    ).get_json()["id"]
    client.put(f"/tasks/{low_id}", json={"status": "done"}, headers=auth_header(token))

    high = client.get("/tasks?priority=3", headers=auth_header(token)).get_json()
    assert high["total"] == 1
    done = client.get("/tasks?status=done", headers=auth_header(token)).get_json()
    assert done["total"] == 1


def test_due_overdue_filter(client):
    register(client)
    token = login(client)
    yesterday = (utc_today() - timedelta(days=1)).isoformat()
    client.post("/tasks", json={"title": "late", "due_date": yesterday}, headers=auth_header(token))
    client.post("/tasks", json={"title": "no due"}, headers=auth_header(token))

    body = client.get("/tasks?due=overdue", headers=auth_header(token)).get_json()
    assert body["total"] == 1
    assert body["tasks"][0]["title"] == "late"


def test_stats_includes_due_and_category(client):
    register(client)
    token = login(client)
    today = utc_today().isoformat()
    yesterday = (utc_today() - timedelta(days=1)).isoformat()
    client.post("/tasks", json={"title": "due today", "due_date": today, "category": "Work"},
                headers=auth_header(token))
    client.post("/tasks", json={"title": "overdue", "due_date": yesterday, "category": "Work"},
                headers=auth_header(token))
    client.post("/tasks", json={"title": "study task", "category": "Study"},
                headers=auth_header(token))

    stats = client.get("/stats", headers=auth_header(token)).get_json()
    assert stats["due_today"] == 1
    assert stats["overdue"] == 1
    assert stats["by_category"]["Work"] == 2
    assert stats["by_category"]["Study"] == 1


def test_pagination(client):
    register(client)
    token = login(client)
    for i in range(7):
        client.post("/tasks", json={"title": f"t{i}"}, headers=auth_header(token))

    page1 = client.get("/tasks?page=1&per_page=5", headers=auth_header(token)).get_json()
    assert len(page1["tasks"]) == 5
    assert page1["total"] == 7
    assert page1["pages"] == 2
    assert page1["has_next"] is True

    page2 = client.get("/tasks?page=2&per_page=5", headers=auth_header(token)).get_json()
    assert len(page2["tasks"]) == 2
    assert page2["has_next"] is False
