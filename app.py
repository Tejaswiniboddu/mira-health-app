"""
MIRA - Medical Intelligence Robotic Automation
Flask Backend with SQLite + Claude AI Health Prediction
"""

import os
import re
import json
import sqlite3
from datetime import datetime, date

from groq import Groq
from dotenv import load_dotenv
load_dotenv()
from flask import Flask, render_template, request, jsonify, g

app = Flask(__name__)
app.config["DATABASE"] = os.path.join(app.instance_path, "mira.db")
os.makedirs(app.instance_path, exist_ok=True)

# ── Database helpers ────────────────────────────────────────────────────────

def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(
            app.config["DATABASE"],
            detect_types=sqlite3.PARSE_DECLTYPES,
        )
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(error):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    db = get_db()
    db.execute(
        """
        CREATE TABLE IF NOT EXISTS patients (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name   TEXT    NOT NULL,
            dob         TEXT    NOT NULL,
            email       TEXT    NOT NULL,
            glucose     REAL    NOT NULL,
            haemoglobin REAL    NOT NULL,
            cholesterol REAL    NOT NULL,
            remarks     TEXT,
            created_at  TEXT    DEFAULT (datetime('now'))
        )
        """
    )
    db.commit()


# ── Validation helpers ───────────────────────────────────────────────────────

def validate_patient(data, is_update=False):
    errors = []

    name = (data.get("full_name") or "").strip()
    if not name:
        errors.append("Full name is required.")

    dob_str = (data.get("dob") or "").strip()
    if not dob_str:
        errors.append("Date of birth is required.")
    else:
        try:
            dob = datetime.strptime(dob_str, "%Y-%m-%d").date()
            if dob >= date.today():
                errors.append("Date of birth cannot be today or a future date.")
        except ValueError:
            errors.append("Invalid date of birth format (use YYYY-MM-DD).")

    email = (data.get("email") or "").strip()
    if not email:
        errors.append("Email is required.")
    elif not re.match(r"^[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}$", email):
        errors.append("Invalid email address format.")

    for field in ("glucose", "haemoglobin", "cholesterol"):
        val = data.get(field)
        if val is None or str(val).strip() == "":
            errors.append(f"{field.capitalize()} is required.")
        else:
            try:
                fval = float(val)
                if fval < 0:
                    errors.append(f"{field.capitalize()} must be a positive number.")
            except (ValueError, TypeError):
                errors.append(f"{field.capitalize()} must be a numeric value.")

    return errors


# ── AI Prediction ────────────────────────────────────────────────────────────

def get_ai_prediction(full_name, dob, glucose, haemoglobin, cholesterol):
    
    client = Groq(
        api_key=os.getenv("GROQ_API_KEY")
    )

    try:
        birth = datetime.strptime(dob, "%Y-%m-%d").date()
        age = (date.today() - birth).days // 365
    except:
        age = "Unknown"

    prompt = f"""
You are a medical AI assistant.

Patient: {full_name}
Age: {age}

Blood Test Results:
- Glucose: {glucose} mg/dL
- Haemoglobin: {haemoglobin} g/dL
- Cholesterol: {cholesterol} mg/dL

Give a short health risk assessment in 2-3 sentences.
Mention possible risks if values are abnormal.
End with: Consult a healthcare professional for proper diagnosis.
"""

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {
                "role": "user",
                "content": prompt
            }
        ]
    )

    return response.choices[0].message.content

# ── Routes ───────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/patients", methods=["GET"])
def list_patients():
    db = get_db()
    rows = db.execute(
        "SELECT * FROM patients ORDER BY created_at DESC"
    ).fetchall()
    return jsonify([dict(r) for r in rows])


@app.route("/api/patients/<int:pid>", methods=["GET"])
def get_patient(pid):
    db = get_db()
    row = db.execute("SELECT * FROM patients WHERE id=?", (pid,)).fetchone()
    if not row:
        return jsonify({"error": "Patient not found"}), 404
    return jsonify(dict(row))


@app.route("/api/patients", methods=["POST"])
def create_patient():
    data = request.get_json(force=True)
    errors = validate_patient(data)
    if errors:
        return jsonify({"errors": errors}), 400

    try:
        remarks = get_ai_prediction(
            data["full_name"], data["dob"],
            float(data["glucose"]), float(data["haemoglobin"]),
            float(data["cholesterol"]),
        )
    except Exception as e:
        remarks = f"AI prediction unavailable: {e}"

    db = get_db()
    cur = db.execute(
        """INSERT INTO patients (full_name, dob, email, glucose, haemoglobin, cholesterol, remarks)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (
            data["full_name"].strip(), data["dob"].strip(), data["email"].strip(),
            float(data["glucose"]), float(data["haemoglobin"]), float(data["cholesterol"]),
            remarks,
        ),
    )
    db.commit()
    new = db.execute("SELECT * FROM patients WHERE id=?", (cur.lastrowid,)).fetchone()
    return jsonify(dict(new)), 201


@app.route("/api/patients/<int:pid>", methods=["PUT"])
def update_patient(pid):
    db = get_db()
    existing = db.execute("SELECT * FROM patients WHERE id=?", (pid,)).fetchone()
    if not existing:
        return jsonify({"error": "Patient not found"}), 404

    data = request.get_json(force=True)
    errors = validate_patient(data, is_update=True)
    if errors:
        return jsonify({"errors": errors}), 400

    # Re-generate AI remarks
    try:
        remarks = get_ai_prediction(
            data["full_name"], data["dob"],
            float(data["glucose"]), float(data["haemoglobin"]),
            float(data["cholesterol"]),
        )
    except Exception as e:
        remarks = f"AI prediction unavailable: {e}"

    db.execute(
        """UPDATE patients SET full_name=?, dob=?, email=?, glucose=?, haemoglobin=?,
           cholesterol=?, remarks=? WHERE id=?""",
        (
            data["full_name"].strip(), data["dob"].strip(), data["email"].strip(),
            float(data["glucose"]), float(data["haemoglobin"]), float(data["cholesterol"]),
            remarks, pid,
        ),
    )
    db.commit()
    updated = db.execute("SELECT * FROM patients WHERE id=?", (pid,)).fetchone()
    return jsonify(dict(updated))


@app.route("/api/patients/<int:pid>", methods=["DELETE"])
def delete_patient(pid):
    db = get_db()
    existing = db.execute("SELECT * FROM patients WHERE id=?", (pid,)).fetchone()
    if not existing:
        return jsonify({"error": "Patient not found"}), 404
    db.execute("DELETE FROM patients WHERE id=?", (pid,))
    db.commit()
    return jsonify({"message": "Patient deleted successfully"})


# ── Startup ──────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    with app.app_context():
        init_db()
    app.run(debug=True, port=5000)
