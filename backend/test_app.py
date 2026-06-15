import os
import tempfile

os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-of-sufficient-length-123")

import pytest

import app as app_module
from app import app, db


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


def register(client, username="alice", password="secret", email=None):
    body = {"username": username, "password": password}
    if email is not None:
        body["email"] = email
    return client.post("/register", json=body)


def login(client, username="alice", password="secret"):
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
    resp = client.post("/login", json={"username": "alice", "password": "secret"})
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
        assert user.password_hash != "secret"


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
    register(client, "alice", "secret")
    alice_token = login(client, "alice", "secret")
    task_id = client.post(
        "/tasks", json={"title": "alice task"}, headers=auth_header(alice_token)
    ).get_json()["id"]

    register(client, "bob", "secret")
    bob_token = login(client, "bob", "secret")

    assert client.get("/tasks", headers=auth_header(bob_token)).get_json()["total"] == 0
    assert client.put(
        f"/tasks/{task_id}", json={"title": "hijack"}, headers=auth_header(bob_token)
    ).status_code == 404
    assert client.delete(
        f"/tasks/{task_id}", headers=auth_header(bob_token)
    ).status_code == 404


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


def test_register_stores_email(client):
    register(client, email="alice@example.com")
    with app.app_context():
        user = app_module.User.query.filter_by(username="alice").first()
        assert user.email == "alice@example.com"


def test_notify_on_task_create(client, caplog):
    register(client, email="alice@example.com")
    token = login(client)

    with caplog.at_level("INFO", logger="notifications"):
        client.post("/tasks", json={"title": "Buy milk"}, headers=auth_header(token))

    assert any("Task created" in r.message for r in caplog.records)


def test_notify_on_task_complete(client, caplog):
    register(client, email="alice@example.com")
    token = login(client)
    task_id = client.post(
        "/tasks", json={"title": "Buy milk"}, headers=auth_header(token)
    ).get_json()["id"]

    with caplog.at_level("INFO", logger="notifications"):
        client.put(
            f"/tasks/{task_id}", json={"completed": True}, headers=auth_header(token)
        )

    assert any("Task completed" in r.message for r in caplog.records)


def test_notify_on_task_update(client, caplog):
    register(client, email="alice@example.com")
    token = login(client)
    task_id = client.post(
        "/tasks", json={"title": "old"}, headers=auth_header(token)
    ).get_json()["id"]

    with caplog.at_level("INFO", logger="notifications"):
        client.put(
            f"/tasks/{task_id}", json={"title": "new"}, headers=auth_header(token)
        )

    assert any("Task updated" in r.message for r in caplog.records)


def test_no_notification_without_email(client, caplog):
    register(client)
    token = login(client)

    with caplog.at_level("INFO", logger="notifications"):
        client.post("/tasks", json={"title": "Buy milk"}, headers=auth_header(token))

    assert not any("EMAIL" in r.message for r in caplog.records)
