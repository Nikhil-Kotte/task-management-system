import os
import re
from datetime import datetime, timezone, timedelta
from flask import Flask, request,jsonify
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import or_
from werkzeug.security import check_password_hash, generate_password_hash
from flask_jwt_extended import JWTManager, jwt_required, get_jwt_identity, create_access_token
from flask_cors import CORS

STATUSES = ("todo", "in_progress", "done")
DEFAULT_CATEGORIES = ("Personal", "Work", "Study", "Health")
MAX_CATEGORY_LENGTH = 30

MIN_PASSWORD_LENGTH = 8
MIN_USERNAME_LENGTH = 3

_INVALID = object()


def utc_today():
    return datetime.now(timezone.utc).date()


def normalize_category(value):
    if value is None:
        return "Personal"
    cleaned = str(value).strip()
    if not cleaned:
        return "Personal"
    if len(cleaned) > MAX_CATEGORY_LENGTH:
        return _INVALID
    return cleaned


def parse_due_date(value):
    if value is None or value == "":
        return None
    try:
        text = str(value).strip()
        if "T" in text:
            parsed = datetime.fromisoformat(text)
        else:
            parsed = datetime.strptime(text, "%Y-%m-%d")
        return datetime(parsed.year, parsed.month, parsed.day, tzinfo=timezone.utc)
    except (ValueError, TypeError):
        return _INVALID


def validate_username(username):
    if not username:
        return "Username is required"
    if len(username) < MIN_USERNAME_LENGTH:
        return f"Username must be at least {MIN_USERNAME_LENGTH} characters"
    if not re.search(r"[A-Za-z]", username):
        return "Username must contain at least one letter"
    return None


def validate_password(password):
    if not password:
        return "Password is required"
    if len(password) < MIN_PASSWORD_LENGTH:
        return f"Password must be at least {MIN_PASSWORD_LENGTH} characters"
    if not re.search(r"[A-Z]", password):
        return "Password must contain an uppercase letter"
    if not re.search(r"[a-z]", password):
        return "Password must contain a lowercase letter"
    if not re.search(r"\d", password):
        return "Password must contain a number"
    if not re.search(r"[^A-Za-z0-9]", password):
        return "Password must contain a special character"
    return None


app=Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"]="sqlite:///tasks.db"
db=SQLAlchemy(app)

secret = os.environ.get("JWT_SECRET_KEY")
if not secret:
    is_dev = __name__ == "__main__" or os.environ.get("FLASK_DEBUG") == "1"
    if is_dev:
        secret = "dev-only-insecure-secret-change-me"
    else:
        raise RuntimeError(
            "JWT_SECRET_KEY environment variable is required. "
            "Set it before running, e.g. export JWT_SECRET_KEY=..."
        )
app.config["JWT_SECRET_KEY"] = secret
jwt=JWTManager(app)
CORS(app)

class User(db.Model):
    id= db.Column(db.Integer, primary_key= True)
    username= db.Column(db.String(100), unique=True, nullable=False)
    password_hash= db.Column(db.String(255), nullable=False)

    def create_password(self,raw):
        self.password_hash= generate_password_hash(raw)
    def check_password(self,raw):
        return check_password_hash(self.password_hash, raw)

class Task(db.Model):
    id           = db.Column(db.Integer, primary_key=True)
    title        = db.Column(db.String(120), nullable=False)
    description  = db.Column(db.Text)
    completed    = db.Column(db.Boolean, default=False)
    status       = db.Column(db.String(20), default="todo", nullable=False)
    priority     = db.Column(db.Integer, default=2)
    category     = db.Column(db.String(30), default="Personal", nullable=False)
    due_date     = db.Column(db.DateTime)
    completed_at = db.Column(db.DateTime)
    created_at   = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    user_id      = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)

    def set_status(self, status):
        self.status = status
        self.completed = status == "done"
        if status == "done":
            if self.completed_at is None:
                self.completed_at = datetime.now(timezone.utc)
        else:
            self.completed_at = None

    @property
    def is_overdue(self):
        return (self.status != "done"
                and self.due_date is not None
                and self.due_date.date() < utc_today())

    def to_dict(self):
        return {"id": self.id, "title": self.title, "description": self.description,
                "completed": self.completed, "status": self.status,
                "priority": self.priority, "category": self.category,
                "due_date": self.due_date.date().isoformat() if self.due_date else None,
                "is_overdue": self.is_overdue,
                "completed_at": self.completed_at.isoformat() if self.completed_at else None,
                "user_id": self.user_id}

with app.app_context():
    db.create_all()  

@app.route("/register",methods=["POST"])
def register():
    data=request.get_json() or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    if not username and not password:
        return jsonify({"error": "Username and password are required"}), 400

    username_error = validate_username(username)
    if username_error:
        return jsonify({"error": username_error, "field": "username"}), 400

    password_error = validate_password(password)
    if password_error:
        return jsonify({"error": password_error, "field": "password"}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({"error": "That username is already taken", "field": "username"}), 409

    user = User(username=username)
    user.create_password(password)
    db.session.add(user); db.session.commit()
    return jsonify({"success": "registered"}), 201

@app.route("/login", methods=["POST"])
def login():
    data=request.get_json() or {}
    user=User.query.filter_by(username=data.get("username")).first()
    if not user or not user.check_password(data.get("password","")):
        return jsonify({"error":"invalid credentials"}), 401
    token=create_access_token(identity=str(user.id))
    return jsonify({"access_token": token}), 200

@app.route("/me", methods=["GET"])
@jwt_required()
def me():
    user_id=int(get_jwt_identity())
    user=User.query.get(user_id)
    return jsonify({"id": user.id, "username": user.username,})


@app.route("/tasks", methods=["POST"])
@jwt_required()
def create_task():
    uid=int(get_jwt_identity())
    data=request.get_json() or {}
    if not data.get("title"):
        return jsonify({"error": "title is required"}), 400
    priority = data.get("priority", 2)
    if priority not in (1, 2, 3):
        return jsonify({"error": "priority must be 1, 2, or 3"}), 400

    status = data.get("status", "todo")
    if status not in STATUSES:
        return jsonify({"error": "status must be todo, in_progress, or done"}), 400

    category = normalize_category(data.get("category"))
    if category is _INVALID:
        return jsonify({"error": f"category must be at most {MAX_CATEGORY_LENGTH} characters"}), 400

    due_date = parse_due_date(data.get("due_date"))
    if due_date is _INVALID:
        return jsonify({"error": "due_date must be a valid date (YYYY-MM-DD)"}), 400

    task = Task(title=data["title"], description=data.get("description", ""),
                priority=priority, category=category, due_date=due_date, user_id=uid)
    if data.get("completed"):
        status = "done"
    task.set_status(status)
    db.session.add(task); db.session.commit()
    return jsonify(task.to_dict()),201

@app.route("/tasks", methods=["GET"])
@jwt_required()
def get_tasks():
    uid=int(get_jwt_identity())
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 5, type=int)

    query = Task.query.filter_by(user_id=uid)

    search = (request.args.get("search") or "").strip()
    if search:
        pattern = f"%{search}%"
        query = query.filter(or_(Task.title.ilike(pattern),
                                 Task.description.ilike(pattern)))

    category = (request.args.get("category") or "").strip()
    if category and category.lower() != "all":
        query = query.filter(Task.category == category)

    status = (request.args.get("status") or "").strip()
    if status and status in STATUSES:
        query = query.filter(Task.status == status)

    priority = request.args.get("priority", type=int)
    if priority in (1, 2, 3):
        query = query.filter(Task.priority == priority)

    due = (request.args.get("due") or "").strip()
    if due:
        today = datetime(*utc_today().timetuple()[:3], tzinfo=timezone.utc)
        if due == "today":
            query = query.filter(Task.due_date >= today,
                                 Task.due_date < today + timedelta(days=1))
        elif due == "week":
            query = query.filter(Task.due_date >= today,
                                 Task.due_date < today + timedelta(days=7))
        elif due == "overdue":
            query = query.filter(Task.status != "done", Task.due_date < today)

    query = query.order_by(Task.completed.asc(), Task.priority.desc(), Task.id.desc())
    paginated = query.paginate(page=page, per_page=per_page, error_out=False)
    return jsonify({
        "tasks": [t.to_dict() for t in paginated.items],
        "page": paginated.page,
        "pages": paginated.pages,
        "total": paginated.total,
        "has_next": paginated.has_next,
        "has_prev": paginated.has_prev,
    }), 200

@app.route("/tasks/<int:task_id>",methods=["PUT"])
@jwt_required()
def update_task(task_id):
    uid = int(get_jwt_identity())
    task = Task.query.filter_by(id=task_id, user_id=uid).first()
    if not task:
        return jsonify({"error": "not found"}), 404
    data = request.get_json() or {}
    if "title" in data:        task.title = data["title"]
    if "description" in data:  task.description = data["description"]
    if "priority" in data:
        if data["priority"] not in (1, 2, 3):
            return jsonify({"error": "priority must be 1, 2, or 3"}), 400
        task.priority = data["priority"]

    if "category" in data:
        category = normalize_category(data["category"])
        if category is _INVALID:
            return jsonify({"error": f"category must be at most {MAX_CATEGORY_LENGTH} characters"}), 400
        task.category = category

    if "due_date" in data:
        due_date = parse_due_date(data["due_date"])
        if due_date is _INVALID:
            return jsonify({"error": "due_date must be a valid date (YYYY-MM-DD)"}), 400
        task.due_date = due_date

    if "status" in data:
        if data["status"] not in STATUSES:
            return jsonify({"error": "status must be todo, in_progress, or done"}), 400
        task.set_status(data["status"])
    elif "completed" in data:
        task.set_status("done" if data["completed"] else "todo")

    db.session.commit()
    return jsonify(task.to_dict()), 200

@app.route("/tasks/<int:task_id>", methods=["DELETE"])
@jwt_required()
def delete_task(task_id):
    uid = int(get_jwt_identity())
    task = Task.query.filter_by(id=task_id, user_id=uid).first()
    if not task:
        return jsonify({"error": "not found"}), 404
    db.session.delete(task); db.session.commit()
    return jsonify({"message": "deleted"}), 200


@app.route("/profile", methods=["GET"])
@jwt_required()
def get_profile():
    user = db.session.get(User, int(get_jwt_identity()))

    if not user:
        return jsonify({"error": "user not found"}), 404

    task_count = Task.query.filter_by(user_id=user.id).count()

    return jsonify({
        "id": user.id,
        "username": user.username,
        "task_count": task_count,
    }), 200


@app.route("/profile", methods=["PUT"])
@jwt_required()
def update_profile():
    user = db.session.get(User, int(get_jwt_identity()))

    if not user:
        return jsonify({"error": "user not found"}), 404

    data = request.get_json() or {}
    new_username = (data.get("username") or "").strip()
    new_password = data.get("password") or ""

    if new_username and new_username != user.username:
        username_error = validate_username(new_username)
        if username_error:
            return jsonify({"error": username_error, "field": "username"}), 400
        clash = User.query.filter_by(username=new_username).first()
        if clash and clash.id != user.id:
            return jsonify({"error": "That username is already taken", "field": "username"}), 409
        user.username = new_username

    if new_password:
        current_password = data.get("current_password") or ""
        if not current_password:
            return jsonify({"error": "Enter your current password to change it",
                            "field": "current_password"}), 400
        if not user.check_password(current_password):
            return jsonify({"error": "Current password is incorrect",
                            "field": "current_password"}), 400
        password_error = validate_password(new_password)
        if password_error:
            return jsonify({"error": password_error, "field": "password"}), 400
        user.create_password(new_password)

    db.session.commit()

    return jsonify({"message": "updated"}), 200


@app.route("/stats", methods=["GET"])
@jwt_required()
def stats():
    uid = int(get_jwt_identity())
    tasks = Task.query.filter_by(user_id=uid).all()

    total = len(tasks)
    by_status = {"todo": 0, "in_progress": 0, "done": 0}
    for t in tasks:
        by_status[t.status if t.status in by_status else "todo"] += 1

    done_dates = set()
    today = utc_today()
    completed_today = 0
    due_today = 0
    overdue = 0
    by_category = {}
    for t in tasks:
        by_category[t.category] = by_category.get(t.category, 0) + 1
        if t.is_overdue:
            overdue += 1
        if t.status != "done" and t.due_date and t.due_date.date() == today:
            due_today += 1
        if t.completed_at:
            d = t.completed_at.date()
            done_dates.add(d)
            if d == today:
                completed_today += 1

    streak = 0
    cursor = today if today in done_dates else today - timedelta(days=1)
    while cursor in done_dates:
        streak += 1
        cursor -= timedelta(days=1)

    completion_rate = round((by_status["done"] / total) * 100) if total else 0

    return jsonify({
        "total": total,
        "todo": by_status["todo"],
        "in_progress": by_status["in_progress"],
        "done": by_status["done"],
        "completed_today": completed_today,
        "due_today": due_today,
        "overdue": overdue,
        "by_category": by_category,
        "streak": streak,
        "completion_rate": completion_rate,
    }), 200


@jwt.unauthorized_loader
def missing(_):  return jsonify({"error": "missing token"}), 401

@jwt.invalid_token_loader
def invalid(_):  return jsonify({"error": "invalid token"}), 422

@jwt.expired_token_loader
def expired(h, p): return jsonify({"error": "token expired"}), 401

if __name__ == "__main__":
    app.run(
        debug=os.environ.get("FLASK_DEBUG") == "1",
        port=5000,
        use_reloader=False,
    )
