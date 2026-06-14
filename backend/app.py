import os
from flask import Flask, request,jsonify
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import check_password_hash, generate_password_hash
from flask_jwt_extended import JWTManager, jwt_required, get_jwt_identity, create_access_token
from flask_cors import CORS


app=Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"]="sqlite:///tasks.db"
db=SQLAlchemy(app)
app.config["JWT_SECRET_KEY"] = os.environ.get(
    "JWT_SECRET_KEY",
    "abd21341nckjahwkmncawlhjxmLK12KJ"
)
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
    id          = db.Column(db.Integer, primary_key=True)
    title       = db.Column(db.String(120), nullable=False)   # also bumped 30 -> 120
    description = db.Column(db.String(800))
    completed   = db.Column(db.Boolean, default=False)
    priority    = db.Column(db.Integer, default=2)
    user_id     = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)

    def to_dict(self):
        return {"id": self.id, "title": self.title, "description": self.description,
                "completed": self.completed, "priority": self.priority,
                "user_id": self.user_id}

with app.app_context():
    db.create_all()  

@app.route("/register",methods=["POST"])
def register():
    data=request.get_json() or {}
    username, password= data.get("username"), data.get("password")
    if not username or not password:
        return jsonify({"error":"Username and Password required"}),400
    if User.query.filter_by(username=username).first():
        return jsonify({"error":"Username already taken"}), 409
    user=User(username=username)
    user.create_password(password)
    db.session.add(user); db.session.commit()
    return jsonify({"success":"registered"}), 201

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
    task = Task(title=data["title"], description=data.get("description", ""),
                completed=data.get("completed", False), priority=priority, user_id=uid)
    db.session.add(task); db.session.commit()
    return jsonify(task.to_dict()),201

@app.route("/tasks", methods=["GET"])
@jwt_required()
def get_tasks():
    uid=int(get_jwt_identity())
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 5, type=int)
    query = (Task.query.filter_by(user_id=uid)
             .order_by(Task.completed.asc(), Task.priority.desc(), Task.id.desc()))
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
    task = Task.query.filter_by(id=task_id, user_id=uid).first()   # ownership filter!
    if not task:
        return jsonify({"error": "not found"}), 404
    data = request.get_json() or {}
    if "title" in data:        task.title = data["title"]
    if "description" in data:  task.description = data["description"]
    if "completed" in data:    task.completed = data["completed"]
    if "priority" in data:
        if data["priority"] not in (1, 2, 3):
            return jsonify({"error": "priority must be 1, 2, or 3"}), 400
        task.priority = data["priority"]
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

@jwt.unauthorized_loader
def missing(_):  return jsonify({"error": "missing token"}), 401

@jwt.invalid_token_loader
def invalid(_):  return jsonify({"error": "invalid token"}), 422

@jwt.expired_token_loader
def expired(h, p): return jsonify({"error": "token expired"}), 401

if __name__ == "__main__":
    app.run(debug=True, port=5000) 
