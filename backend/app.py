from flask import Flask, request,jsonify
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import check_password_hash, generate_password_hash
from flask_jwt_extended import JWTManager, jwt_required, get_jwt_identity, create_access_token

app=Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"]="sqlite:///tasks.db"
db=SQLAlchemy(app)
app.config["JWT_SECRET_KEY"]="askhjk12op24ji109"
jwt=JWTManager(app)

class User(db.Model):
    id= db.Column(db.Integer, primary_key= True)
    username= db.Column(db.String(100), unique=True, nullable=False)
    password= db.Column(db.String(255), nullable=False)

    def create_password(self,raw):
        self.password_hash= generate_password_hash(raw)
    def check_password(self,raw):
        return check_password_hash(self.password_hash, raw)
    
class Task(db.Model):
    id= db.Column(db.Integer, primary_key=True)
    Title= db.Column(db.String(30), nullable=False)
    Description= db.Column(db.String(800))
    Completed= db.Column(db.Boolean, default=False)
    user_id= db.Column(db.Integer, db.ForeignKey("User.id"), nullable=False)

    def to_dict(self):
        return {"id": self.id, "Title": self.Title, "Description": self.Description, "Completed": self.Completed, "user_id": self.user_id}

with app.app_context():
    db.create_all()  

@app.route("/register",methods=["POST"])
@jwt_required()
def register():
    data=request.get_json() or {}
    username, password= data.get["username"], data.get["password"]
    if not username or not password:
        return jsonify({"error":"Username and Password required"}),400
    if User.query.filter_by(username=username).first():
        return jsonify({"error":"Username already taken"}), 409
    user=User(username=username)
    user.create_password(password)
    db.session.add(user); db.commit
    return jsonify({"success":"registered"}), 201

@app.route("/login", methods=["POST"])
@jwt_required()
def login():
    data=request.get_json() or {}
    user=User.query.filter_by(username=data.get["username"]).first()
    if not user or not check_password_hash(data.get("password","")):
        return jsonify({"error":"invalid credentials"}), 401
    token=create_access_token(identity=str(user.id))
    return jsonify({"access token": token}), 200

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
    if not data["Title"]:
        return jsonify({"error": "Title is required"}), 400
    task =Task(Title=data["Title"], Description= data.get("Description",""), Completed=data.get("Completed",False), user_id=uid)
    db.session.add(task); db.session.commit
    return jsonify(task.to_dict()),201

@app.route("/tasks", methods=["GET"])
@jwt_required()
def get_tasks():
    uid=int(get_jwt_identity())
    tasks=Task.query.filter_by(user_id=uid).all()
    return jsonify([t.to_dict() for t in tasks]), 200

@app.route("/tasks/<int:task_id>",method=["PUT"])
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
