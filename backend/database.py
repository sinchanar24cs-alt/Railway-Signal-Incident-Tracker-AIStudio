import os
import sqlite3
from contextlib import contextmanager
import config


def get_connection(db_path: str | None = None) -> sqlite3.Connection:
    target = db_path or config.DATABASE_PATH
    os.makedirs(os.path.dirname(target), exist_ok=True)
    conn = sqlite3.connect(target)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


@contextmanager
def transaction(db_path: str | None = None):
    conn = get_connection(db_path)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS railway_divisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    division_code TEXT NOT NULL UNIQUE,
    division_name TEXT NOT NULL,
    zonal_hq_unit TEXT NOT NULL,
    is_demo INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS zones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    zone_code TEXT NOT NULL UNIQUE,
    zone_name TEXT NOT NULL,
    division_id INTEGER NOT NULL,
    hq_station TEXT NOT NULL,
    is_fallback INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (division_id) REFERENCES railway_divisions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS stations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    station_code TEXT NOT NULL UNIQUE,
    station_prefix TEXT NOT NULL,
    station_name TEXT NOT NULL,
    division_id INTEGER NOT NULL,
    zone_id INTEGER NOT NULL,
    is_demo INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (division_id) REFERENCES railway_divisions(id) ON DELETE CASCADE,
    FOREIGN KEY (zone_id) REFERENCES zones(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS handlers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    handler_code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('Primary', 'Backup', 'Zonal-HQ', 'Fallback')),
    team TEXT NOT NULL,
    branch TEXT NOT NULL,
    division_id INTEGER NOT NULL,
    zone_id INTEGER NOT NULL,
    is_available INTEGER NOT NULL DEFAULT 1 CHECK(is_available IN (0, 1)),
    current_load INTEGER NOT NULL DEFAULT 0 CHECK(current_load >= 0),
    max_capacity INTEGER NOT NULL DEFAULT 3 CHECK(max_capacity > 0),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (division_id) REFERENCES railway_divisions(id),
    FOREIGN KEY (zone_id) REFERENCES zones(id)
);

CREATE TABLE IF NOT EXISTS routing_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    station_prefix TEXT NOT NULL,
    station_code TEXT NOT NULL,
    division_id INTEGER NOT NULL,
    zone_id INTEGER NOT NULL,
    branch TEXT NOT NULL,
    team TEXT NOT NULL,
    depot TEXT NOT NULL,
    primary_handler_id INTEGER NOT NULL,
    backup_handler_id INTEGER NOT NULL,
    incident_category TEXT NOT NULL DEFAULT 'ALL',
    default_priority TEXT NOT NULL CHECK(default_priority IN ('Low', 'Medium', 'High', 'Critical')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(station_code, incident_category),
    FOREIGN KEY (division_id) REFERENCES railway_divisions(id),
    FOREIGN KEY (zone_id) REFERENCES zones(id),
    FOREIGN KEY (primary_handler_id) REFERENCES handlers(id),
    FOREIGN KEY (backup_handler_id) REFERENCES handlers(id)
);

CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id TEXT NOT NULL UNIQUE,
    station_code TEXT NOT NULL,
    incident_code TEXT NOT NULL,
    description TEXT NOT NULL,
    urgency TEXT NOT NULL CHECK(urgency IN ('Low', 'Medium', 'High', 'Critical')),
    priority TEXT NOT NULL CHECK(priority IN ('Low', 'Medium', 'High', 'Critical')),
    reporter_name TEXT NOT NULL,
    submitted_at TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('Pending', 'Assigned', 'In Progress', 'Resolved')),
    is_sample INTEGER NOT NULL DEFAULT 0 CHECK(is_sample IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS validation_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id TEXT NOT NULL UNIQUE,
    station_dfa_valid INTEGER NOT NULL CHECK(station_dfa_valid IN (0, 1)),
    station_regex_valid INTEGER NOT NULL CHECK(station_regex_valid IN (0, 1)),
    station_agree INTEGER NOT NULL CHECK(station_agree IN (0, 1)),
    incident_dfa_valid INTEGER NOT NULL CHECK(incident_dfa_valid IN (0, 1)),
    incident_regex_valid INTEGER NOT NULL CHECK(incident_regex_valid IN (0, 1)),
    incident_agree INTEGER NOT NULL CHECK(incident_agree IN (0, 1)),
    overall_valid INTEGER NOT NULL CHECK(overall_valid IN (0, 1)),
    dfa_trace_json TEXT NOT NULL,
    validation_summary TEXT NOT NULL,
    validated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (report_id) REFERENCES reports(report_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS classifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL CHECK(category IN ('Signal-Failure', 'Track-Obstruction', 'Electrical', 'Minor-Delay', 'Test-Entry')),
    matched_patterns_json TEXT NOT NULL,
    conflict_detected INTEGER NOT NULL DEFAULT 0 CHECK(conflict_detected IN (0, 1)),
    priority_rule_applied TEXT NOT NULL,
    classification_reason TEXT NOT NULL,
    classified_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (report_id) REFERENCES reports(report_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id TEXT NOT NULL UNIQUE,
    handler_id INTEGER,
    assignment_type TEXT NOT NULL CHECK(assignment_type IN ('Primary', 'Backup', 'Queued', 'Fallback-Queue')),
    assignment_status TEXT NOT NULL CHECK(assignment_status IN ('Assigned', 'Queued')),
    resolution_notes TEXT DEFAULT '',
    assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
    resolved_at TEXT,
    FOREIGN KEY (report_id) REFERENCES reports(report_id) ON DELETE CASCADE,
    FOREIGN KEY (handler_id) REFERENCES handlers(id)
);

CREATE TABLE IF NOT EXISTS escalations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id TEXT NOT NULL UNIQUE,
    initial_division TEXT NOT NULL,
    zonal_hq_unit TEXT NOT NULL,
    zonal_handler_id INTEGER,
    escalation_reason TEXT NOT NULL,
    priority TEXT NOT NULL,
    assignment_status TEXT NOT NULL,
    escalated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (report_id) REFERENCES reports(report_id) ON DELETE CASCADE,
    FOREIGN KEY (zonal_handler_id) REFERENCES handlers(id)
);

CREATE TABLE IF NOT EXISTS status_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id TEXT NOT NULL,
    old_status TEXT,
    new_status TEXT NOT NULL CHECK(new_status IN ('Pending', 'Assigned', 'In Progress', 'Resolved')),
    changed_by TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    changed_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (report_id) REFERENCES reports(report_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS dispatch_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id TEXT NOT NULL,
    routing_key TEXT NOT NULL,
    division_name TEXT NOT NULL,
    zone_name TEXT NOT NULL,
    decision TEXT NOT NULL,
    reason TEXT NOT NULL,
    queue_order INTEGER,
    logged_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (report_id) REFERENCES reports(report_id) ON DELETE CASCADE
);
"""


def init_db(db_path: str | None = None) -> None:
    with transaction(db_path) as conn:
        conn.executescript(SCHEMA_SQL)
