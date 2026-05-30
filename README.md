# MIRA — Medical Intelligence Robotic Automation

A health prediction web application built with **Python (Flask)** + **SQLite** + **Claude AI** (Anthropic API).

---

## Features

- **CRUD** — Create, Read, Update, Delete patient records
- **AI Health Prediction** — Automatically generates clinical remarks via Claude AI based on blood test values (Glucose, Haemoglobin, Cholesterol)
- **Data Validation** — Email format, DOB not in future, numeric blood values
- **Persistent Storage** — SQLite database via Flask's `g` context
- **Clean UI** — Dark clinical theme, colour-coded blood values, live search, stats bar

---

## Tech Stack

| Layer      | Technology              |
|------------|-------------------------|
| Backend    | Python 3.10+, Flask 3   |
| Database   | SQLite (built-in)       |
| AI/ML API  | Anthropic Claude Sonnet |
| Frontend   | HTML5, CSS3, Vanilla JS |

---

## Setup

### 1. Clone / unzip the project

```bash
cd mira_health
```

### 2. Create a virtual environment

```bash
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Set your Anthropic API key

```bash
# Linux / macOS
export ANTHROPIC_API_KEY=sk-ant-...

# Windows (CMD)
set ANTHROPIC_API_KEY=sk-ant-...

# Windows (PowerShell)
$env:ANTHROPIC_API_KEY="sk-ant-..."
```

> Get your free API key at https://console.anthropic.com

### 5. Run the app

```bash
python app.py
```

Open your browser at **http://localhost:5000**

---

## Project Structure

```
mira_health/
├── app.py                  # Flask backend — routes, DB, AI prediction
├── requirements.txt        # Python dependencies
├── README.md
├── instance/
│   └── mira.db             # SQLite DB (auto-created on first run)
├── templates/
│   └── index.html          # Single-page HTML template
└── static/
    ├── css/
    │   └── style.css       # Dark clinical stylesheet
    └── js/
        └── app.js          # Frontend CRUD + UI logic
```

---

## API Endpoints

| Method | Endpoint               | Description          |
|--------|------------------------|----------------------|
| GET    | `/api/patients`        | List all patients    |
| GET    | `/api/patients/<id>`   | Get single patient   |
| POST   | `/api/patients`        | Create + AI predict  |
| PUT    | `/api/patients/<id>`   | Update + re-predict  |
| DELETE | `/api/patients/<id>`   | Delete patient       |

---

## Notes

- **No API key in code** — key is loaded from environment variable only.
- The SQLite database file (`instance/mira.db`) is auto-created on first run.
- AI remarks are regenerated whenever a patient record is created or updated.
