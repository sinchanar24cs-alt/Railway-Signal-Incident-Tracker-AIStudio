# RAILWAY SIGNAL INCIDENT TRACKER
**"Report. Validate. Classify. Dispatch. Resolve."**

An academic full-stack engineering platform integrating:
- **BCS503 – Automata Theory & Computability**: Deterministic Finite Automata (DFA) + independent Regular Expression validators, equivalence checking, visual state-transition diagrams, and deterministic conflict-aware classification.
- **BCS502 – Computer Networks**: 30-station / 3-division routing table lookup, primary/backup handler failover, capacity-aware dispatch, deterministic queuing, unknown-zone central fallback routing, and mandatory Tier-2 Zonal HQ escalation for Critical incidents.

---

## Architecture

- **Frontend**: React, TypeScript, Vite, Tailwind CSS, Recharts, Lucide Icons (`src/`)
- **Backend**: Python, Flask + Flask-CORS (with automatic stdlib HTTP fallback if Flask is absent), modular Python services (`backend/`)
- **Database**: SQLite with 12 relational tables, foreign keys, unique constraints, and atomic transactions (`database/railway_incidents.db`)

---

## Local Setup in VS Code (Windows)

### 1. Backend Setup (Python + Flask + SQLite)
Open a PowerShell or Command Prompt terminal in the project root:

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python seed_data.py
python app.py
```
The Flask REST API starts on `http://127.0.0.1:5000`.

### 2. Frontend Setup (React + TypeScript + Vite)
In a second terminal at the project root:

```powershell
npm install
npm run dev
```
The full-stack dev server starts on `http://localhost:3000` (which automatically manages/proxies `/api/*` to the Python backend on port `5000`).

---

## Running the 20 Automated Integration Tests

Via Python CLI:
```powershell
python backend\tests\test_suite.py
```

Or interactively inside the application under the **Test Centre** tab (`POST /api/tests/run`).

---

## REST API Endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/validate` | Run independent DFA and Regex validation & comparison |
| `POST` | `/api/classify` | Classify validated incident into 5 deterministic categories |
| `POST` | `/api/reports` | Validate, classify, dispatch, escalate, and persist report |
| `POST` | `/api/dispatch` | Execute routing & dispatch for a validated report |
| `POST` | `/api/dispatch/process-queue` | Drain pending queued reports in priority + FIFO order |
| `GET` | `/api/reports` | List reports with search, category, zone, priority, status filters |
| `GET` | `/api/reports/<report_id>` | Retrieve full lifecycle record, trace, logs, and status history |
| `PATCH` | `/api/reports/<report_id>/status` | Update status, save resolution notes, free handler capacity |
| `GET` | `/api/handlers` | List handlers, availability, workload, and capacity |
| `POST` | `/api/handlers` | Register a new handler |
| `PATCH` | `/api/handlers/<id>` | Update handler availability or max capacity |
| `GET` | `/api/routing` | Retrieve 30-station routing table, queued reports, and logs |
| `PATCH` | `/api/routing/<id>` | Update routing rule handlers or default priority |
| `GET` | `/api/escalations` | Retrieve Zonal HQ Tier-2 escalations |
| `GET` | `/api/analytics` | Retrieve SQLite-backed metrics and chart series |
| `POST` | `/api/tests/run` | Execute all 20 documented automated test cases |
| `POST` | `/api/demo/reset` | Reset SQLite database to clean 30-station demonstration seed |
