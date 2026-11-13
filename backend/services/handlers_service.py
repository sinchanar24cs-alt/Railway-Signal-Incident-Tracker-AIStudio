"""
Framework-agnostic REST API controller handlers.
Shared identically by Flask routes (api_routes.py) and the zero-dependency stdlib WSGI/HTTP runner.
"""

import json
import uuid
from datetime import datetime
from database import get_connection, transaction
from seed_data import seed_database
import config
from services.regex_validator import validate_and_compare
from services.classifier import classify_incident
from services.dispatch import execute_dispatch, process_pending_queue


def _serialize_report_row(conn, row) -> dict:
    rid = row["report_id"]
    val = conn.execute("SELECT * FROM validation_results WHERE report_id = ?", (rid,)).fetchone()
    cls = conn.execute("SELECT * FROM classifications WHERE report_id = ?", (rid,)).fetchone()
    asg = conn.execute(
        """SELECT a.*, h.name AS handler_name, h.handler_code, h.role AS handler_role, h.team AS handler_team,
                  z.zone_code, z.zone_name, d.division_code, d.division_name
           FROM assignments a
           LEFT JOIN handlers h ON a.handler_id = h.id
           LEFT JOIN zones z ON h.zone_id = z.id
           LEFT JOIN railway_divisions d ON h.division_id = d.id
           WHERE a.report_id = ?""",
        (rid,),
    ).fetchone()
    esc = conn.execute(
        """SELECT e.*, h.name AS zonal_handler_name
           FROM escalations e
           LEFT JOIN handlers h ON e.zonal_handler_id = h.id
           WHERE e.report_id = ?""",
        (rid,),
    ).fetchone()
    last_log = conn.execute(
        "SELECT * FROM dispatch_logs WHERE report_id = ? ORDER BY id DESC LIMIT 1",
        (rid,),
    ).fetchone()

    st = conn.execute(
        """SELECT s.station_name, z.zone_code, z.zone_name, d.division_code, d.division_name
           FROM stations s
           JOIN zones z ON s.zone_id = z.id
           JOIN railway_divisions d ON s.division_id = d.id
           WHERE s.station_code = ? OR s.station_prefix = ?
           LIMIT 1""",
        (row["station_code"], row["station_code"][:3]),
    ).fetchone()

    zone_code = (asg["zone_code"] if asg and asg["zone_code"] else None) or (st["zone_code"] if st else "ZONE-FALLBACK")
    zone_name = (asg["zone_name"] if asg and asg["zone_name"] else None) or (st["zone_name"] if st else "Central Fallback Queue")
    division_name = (asg["division_name"] if asg and asg["division_name"] else None) or (st["division_name"] if st else "Central Fallback Correction Unit")

    return {
        "report_id": row["report_id"],
        "station_code": row["station_code"],
        "station_name": st["station_name"] if st else "Unmapped Station (Fallback)",
        "incident_code": row["incident_code"],
        "description": row["description"],
        "urgency": row["urgency"],
        "priority": row["priority"],
        "reporter_name": row["reporter_name"],
        "submitted_at": row["submitted_at"],
        "status": row["status"],
        "is_sample": bool(row["is_sample"]),
        "created_at": row["created_at"],
        "zone_code": zone_code,
        "zone_name": zone_name,
        "division_name": division_name,
        "category": cls["category"] if cls else None,
        "classification": {
            "category": cls["category"],
            "matched_patterns": json.loads(cls["matched_patterns_json"]),
            "conflict_detected": bool(cls["conflict_detected"]),
            "priority_rule_applied": cls["priority_rule_applied"],
            "reason": cls["classification_reason"],
        } if cls else None,
        "validation": {
            "station_dfa_valid": bool(val["station_dfa_valid"]),
            "station_regex_valid": bool(val["station_regex_valid"]),
            "station_agree": bool(val["station_agree"]),
            "incident_dfa_valid": bool(val["incident_dfa_valid"]),
            "incident_regex_valid": bool(val["incident_regex_valid"]),
            "incident_agree": bool(val["incident_agree"]),
            "overall_valid": bool(val["overall_valid"]),
            "validation_summary": val["validation_summary"],
            "dfa_trace": json.loads(val["dfa_trace_json"]),
        } if val else None,
        "assignment": {
            "handler_id": asg["handler_id"],
            "handler_code": asg["handler_code"],
            "handler_name": asg["handler_name"],
            "handler_role": asg["handler_role"],
            "handler_team": asg["handler_team"],
            "assignment_type": asg["assignment_type"],
            "assignment_status": asg["assignment_status"],
            "resolution_notes": asg["resolution_notes"],
            "assigned_at": asg["assigned_at"],
            "resolved_at": asg["resolved_at"],
        } if asg else None,
        "escalation": dict(esc) if esc else None,
        "latest_dispatch_log": dict(last_log) if last_log else None,
    }


def handle_health():
    return 200, {"status": "ok", "service": "Railway Signal Incident Tracker API"}


def handle_validate(data: dict):
    station_code = data.get("station_code", "")
    incident_code = data.get("incident_code", "")
    return 200, validate_and_compare(station_code, incident_code)


def handle_classify(data: dict):
    incident_code = data.get("incident_code", "")
    description = data.get("description", "")
    val = validate_and_compare("ABC12", incident_code)
    if not val["incident"]["valid"]:
        return 400, {
            "classified": False,
            "error": "Cannot classify an invalid incident identifier.",
            "validation": val["incident"],
        }
    res = classify_incident(incident_code, description)
    return (200 if res["classified"] else 422), res


def handle_submit_report(data: dict):
    station_code = (data.get("station_code") or "").strip()
    incident_code = (data.get("incident_code") or "").strip()
    description = (data.get("description") or "").strip()
    urgency = (data.get("urgency") or "Medium").strip()
    reporter_name = (data.get("reporter_name") or "").strip()
    submitted_at = (data.get("submitted_at") or datetime.now().isoformat(timespec="seconds")).strip()
    report_id = (data.get("report_id") or f"INC-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}").strip()

    if not description or not reporter_name:
        return 400, {"error": "Incident description and reporter name are required."}

    if urgency not in config.VALID_URGENCIES:
        return 400, {"error": f"Invalid urgency '{urgency}'. Must be one of {config.VALID_URGENCIES}."}

    val_res = validate_and_compare(station_code, incident_code)
    if not val_res["overall_valid"]:
        return 400, {
            "error": "Automata validation failed. Report rejected.",
            "validation": val_res,
            "details": val_res["errors"],
        }

    cls_res = classify_incident(incident_code, description)
    if not cls_res["classified"]:
        return 422, {
            "error": "Incident classification failed. Report rejected.",
            "validation": val_res,
            "classification": cls_res,
        }

    try:
        with transaction() as conn:
            dup = conn.execute("SELECT 1 FROM reports WHERE report_id = ?", (report_id,)).fetchone()
            if dup:
                return 409, {"error": f"Report ID '{report_id}' already exists."}

            conn.execute(
                """INSERT INTO reports
                   (report_id, station_code, incident_code, description, urgency, priority,
                    reporter_name, submitted_at, status, is_sample)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending', 0)""",
                (report_id, station_code, incident_code, description, urgency, urgency, reporter_name, submitted_at),
            )

            conn.execute(
                """INSERT INTO validation_results
                   (report_id, station_dfa_valid, station_regex_valid, station_agree,
                    incident_dfa_valid, incident_regex_valid, incident_agree,
                    overall_valid, dfa_trace_json, validation_summary)
                   VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)""",
                (
                    report_id,
                    int(val_res["station"]["dfa"]["valid"]),
                    int(val_res["station"]["regex"]["valid"]),
                    int(val_res["station"]["agree"]),
                    int(val_res["incident"]["dfa"]["valid"]),
                    int(val_res["incident"]["regex"]["valid"]),
                    int(val_res["incident"]["agree"]),
                    json.dumps({
                        "station": val_res["station"]["dfa"],
                        "incident": val_res["incident"]["dfa"],
                    }),
                    "DFA and Regex independently validated and agreed on both identifiers.",
                ),
            )

            conn.execute(
                """INSERT INTO classifications
                   (report_id, category, matched_patterns_json, conflict_detected,
                    priority_rule_applied, classification_reason)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (
                    report_id,
                    cls_res["category"],
                    json.dumps(cls_res["matched_patterns"]),
                    int(cls_res["conflict_detected"]),
                    cls_res["priority_rule_applied"],
                    cls_res["reason"],
                ),
            )

            dispatch_res = execute_dispatch(conn, report_id, actor="Auto-Dispatch Pipeline")

            row = conn.execute("SELECT * FROM reports WHERE report_id = ?", (report_id,)).fetchone()
            full_report = _serialize_report_row(conn, row)

        return 201, {
            "message": "Report validated, classified, dispatched, and persisted.",
            "report": full_report,
            "dispatch": dispatch_res,
        }
    except ValueError as ve:
        return 400, {"error": str(ve)}
    except Exception as ex:
        return 500, {"error": f"Database transaction failed: {str(ex)}"}


def handle_dispatch(data: dict):
    report_id = (data.get("report_id") or "").strip()
    if not report_id:
        return 400, {"error": "report_id is required."}
    try:
        with transaction() as conn:
            res = execute_dispatch(conn, report_id, actor="Manual Dispatch API")
        return 200, res
    except ValueError as ve:
        return 400, {"error": str(ve)}


def handle_process_queue():
    with transaction() as conn:
        results = process_pending_queue(conn)
    return 200, {"processed": len(results), "results": results}


def handle_get_reports(args: dict):
    search = (args.get("search") or "").strip().lower()
    category = (args.get("category") or "").strip()
    zone = (args.get("zone") or "").strip()
    priority = (args.get("priority") or "").strip()
    status = (args.get("status") or "").strip()
    record_type = (args.get("record_type") or "").strip()

    conn = get_connection()
    try:
        rows = conn.execute("SELECT * FROM reports ORDER BY id DESC").fetchall()
        reports = [_serialize_report_row(conn, r) for r in rows]

        if search:
            reports = [
                r for r in reports
                if search in r["report_id"].lower()
                or search in r["station_code"].lower()
                or search in r["incident_code"].lower()
                or search in r["reporter_name"].lower()
            ]
        if category and category != "ALL":
            reports = [r for r in reports if r["category"] == category]
        if zone and zone != "ALL":
            reports = [r for r in reports if r["zone_code"] == zone]
        if priority and priority != "ALL":
            reports = [r for r in reports if r["priority"] == priority]
        if status and status != "ALL":
            reports = [r for r in reports if r["status"] == status]
        if record_type == "live":
            reports = [r for r in reports if not r["is_sample"]]
        elif record_type == "sample":
            reports = [r for r in reports if r["is_sample"]]

        return 200, {"reports": reports, "count": len(reports)}
    finally:
        conn.close()


def handle_get_report_detail(report_id: str):
    conn = get_connection()
    try:
        row = conn.execute("SELECT * FROM reports WHERE report_id = ?", (report_id,)).fetchone()
        if row is None:
            return 404, {"error": f"Report '{report_id}' not found."}

        data = _serialize_report_row(conn, row)
        history = [
            dict(h) for h in conn.execute(
                "SELECT * FROM status_history WHERE report_id = ? ORDER BY id ASC", (report_id,)
            ).fetchall()
        ]
        logs = [
            dict(l) for l in conn.execute(
                "SELECT * FROM dispatch_logs WHERE report_id = ? ORDER BY id ASC", (report_id,)
            ).fetchall()
        ]
        data["status_history"] = history
        data["dispatch_logs"] = logs
        return 200, data
    finally:
        conn.close()


def handle_update_report_status(report_id: str, data: dict):
    new_status = (data.get("status") or "").strip()
    changed_by = (data.get("changed_by") or "Handler").strip()
    notes = (data.get("notes") or "").strip()

    if new_status not in config.VALID_STATUSES:
        return 400, {"error": f"Invalid status '{new_status}'. Allowed: {config.VALID_STATUSES}."}

    with transaction() as conn:
        row = conn.execute("SELECT * FROM reports WHERE report_id = ?", (report_id,)).fetchone()
        if row is None:
            return 404, {"error": f"Report '{report_id}' not found."}

        old_status = row["status"]
        if old_status == "Resolved" and new_status != "Resolved":
            return 400, {"error": "Resolved reports cannot be reverted to an active state."}

        conn.execute("UPDATE reports SET status = ? WHERE report_id = ?", (new_status, report_id))

        asg = conn.execute("SELECT * FROM assignments WHERE report_id = ?", (report_id,)).fetchone()
        if new_status == "Resolved" and old_status != "Resolved" and asg:
            conn.execute(
                "UPDATE assignments SET resolution_notes = ?, resolved_at = datetime('now') WHERE report_id = ?",
                (notes or "Incident resolved and verified.", report_id),
            )
            if asg["handler_id"] is not None and asg["assignment_status"] == "Assigned":
                conn.execute(
                    "UPDATE handlers SET current_load = CASE WHEN current_load > 0 THEN current_load - 1 ELSE 0 END WHERE id = ?",
                    (asg["handler_id"],),
                )
        elif notes and asg:
            conn.execute(
                "UPDATE assignments SET resolution_notes = ? WHERE report_id = ?",
                (notes, report_id),
            )

        conn.execute(
            """INSERT INTO status_history (report_id, old_status, new_status, changed_by, notes)
               VALUES (?, ?, ?, ?, ?)""",
            (report_id, old_status, new_status, changed_by, notes),
        )

        drained = []
        if new_status == "Resolved":
            drained = process_pending_queue(conn)

        updated = _serialize_report_row(
            conn, conn.execute("SELECT * FROM reports WHERE report_id = ?", (report_id,)).fetchone()
        )

    return 200, {"report": updated, "queue_drained": drained}


def handle_get_handlers():
    conn = get_connection()
    try:
        rows = conn.execute(
            """SELECT h.*, d.division_code, d.division_name, z.zone_code, z.zone_name,
                      (SELECT COUNT(*) FROM assignments a
                       JOIN reports r ON a.report_id = r.report_id
                       WHERE a.handler_id = h.id AND r.status != 'Resolved') AS active_assignments
               FROM handlers h
               JOIN railway_divisions d ON h.division_id = d.id
               JOIN zones z ON h.zone_id = z.id
               ORDER BY d.id, h.role, h.id"""
        ).fetchall()
        return 200, {"handlers": [dict(r) for r in rows]}
    finally:
        conn.close()


def handle_add_handler(data: dict):
    required = ["handler_code", "name", "role", "team", "branch", "division_code", "zone_code"]
    for f in required:
        if not (str(data.get(f) or "")).strip():
            return 400, {"error": f"Field '{f}' is required."}

    max_capacity = int(data.get("max_capacity", 3))
    if max_capacity <= 0:
        return 400, {"error": "max_capacity must be greater than 0."}

    try:
        with transaction() as conn:
            div = conn.execute(
                "SELECT id FROM railway_divisions WHERE division_code = ?", (data["division_code"],)
            ).fetchone()
            zone = conn.execute(
                "SELECT id FROM zones WHERE zone_code = ?", (data["zone_code"],)
            ).fetchone()
            if not div or not zone:
                return 400, {"error": "Invalid division_code or zone_code."}

            conn.execute(
                """INSERT INTO handlers
                   (handler_code, name, role, team, branch, division_id, zone_id, is_available, current_load, max_capacity)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)""",
                (
                    data["handler_code"].strip(),
                    data["name"].strip(),
                    data["role"].strip(),
                    data["team"].strip(),
                    data["branch"].strip(),
                    div["id"],
                    zone["id"],
                    1 if data.get("is_available", True) else 0,
                    max_capacity,
                ),
            )
            created = conn.execute(
                "SELECT * FROM handlers WHERE handler_code = ?", (data["handler_code"].strip(),)
            ).fetchone()
        return 201, {"handler": dict(created)}
    except Exception as ex:
        return 400, {"error": str(ex)}


def handle_update_handler(handler_id: int, data: dict):
    with transaction() as conn:
        h = conn.execute("SELECT * FROM handlers WHERE id = ?", (handler_id,)).fetchone()
        if not h:
            return 404, {"error": "Handler not found."}

        is_available = int(bool(data["is_available"])) if "is_available" in data else h["is_available"]
        max_capacity = int(data["max_capacity"]) if "max_capacity" in data else h["max_capacity"]
        if max_capacity <= 0:
            return 400, {"error": "max_capacity must be >= 1."}

        conn.execute(
            "UPDATE handlers SET is_available = ?, max_capacity = ? WHERE id = ?",
            (is_available, max_capacity, handler_id),
        )
        updated = conn.execute("SELECT * FROM handlers WHERE id = ?", (handler_id,)).fetchone()
    return 200, {"handler": dict(updated)}


def handle_get_routing():
    conn = get_connection()
    try:
        rules = conn.execute(
            """SELECT r.id, r.station_prefix, r.station_code, s.station_name,
                      d.division_code, d.division_name, z.zone_code, z.zone_name,
                      r.branch, r.team, r.depot, r.incident_category, r.default_priority,
                      ph.id AS primary_handler_id, ph.name AS primary_handler_name,
                      ph.is_available AS primary_available, ph.current_load AS primary_load, ph.max_capacity AS primary_capacity,
                      bh.id AS backup_handler_id, bh.name AS backup_handler_name,
                      bh.is_available AS backup_available, bh.current_load AS backup_load, bh.max_capacity AS backup_capacity
               FROM routing_rules r
               LEFT JOIN stations s ON r.station_code = s.station_code
               JOIN railway_divisions d ON r.division_id = d.id
               JOIN zones z ON r.zone_id = z.id
               JOIN handlers ph ON r.primary_handler_id = ph.id
               JOIN handlers bh ON r.backup_handler_id = bh.id
               ORDER BY d.id, r.station_code"""
        ).fetchall()

        queued = conn.execute(
            """SELECT r.report_id, r.station_code, r.incident_code, r.priority, r.submitted_at,
                      c.category, a.assignment_type, dl.queue_order, dl.reason
               FROM reports r
               JOIN assignments a ON r.report_id = a.report_id
               LEFT JOIN classifications c ON r.report_id = c.report_id
               LEFT JOIN dispatch_logs dl ON dl.id = (
                   SELECT id FROM dispatch_logs WHERE report_id = r.report_id ORDER BY id DESC LIMIT 1
               )
               WHERE r.status = 'Pending'
               ORDER BY COALESCE(dl.queue_order, 999999) ASC, r.id ASC"""
        ).fetchall()

        logs = conn.execute("SELECT * FROM dispatch_logs ORDER BY id DESC LIMIT 50").fetchall()
        divisions = conn.execute("SELECT * FROM railway_divisions ORDER BY id").fetchall()
        zones = conn.execute("SELECT * FROM zones ORDER BY id").fetchall()
        stations = conn.execute(
            """SELECT s.*, d.division_code, d.division_name, z.zone_code, z.zone_name
               FROM stations s
               JOIN railway_divisions d ON s.division_id = d.id
               JOIN zones z ON s.zone_id = z.id
               ORDER BY d.id, s.station_code"""
        ).fetchall()

        return 200, {
            "routing_rules": [dict(r) for r in rules],
            "queued_reports": [dict(q) for q in queued],
            "dispatch_logs": [dict(l) for l in logs],
            "divisions": [dict(d) for d in divisions],
            "zones": [dict(z) for z in zones],
            "stations": [dict(s) for s in stations],
        }
    finally:
        conn.close()


def handle_update_routing_rule(rule_id: int, data: dict):
    with transaction() as conn:
        existing = conn.execute("SELECT * FROM routing_rules WHERE id = ?", (rule_id,)).fetchone()
        if not existing:
            return 404, {"error": "Routing rule not found."}

        primary_id = int(data.get("primary_handler_id", existing["primary_handler_id"]))
        backup_id = int(data.get("backup_handler_id", existing["backup_handler_id"]))
        default_priority = data.get("default_priority", existing["default_priority"])
        branch = data.get("branch", existing["branch"])
        team = data.get("team", existing["team"])

        conn.execute(
            """UPDATE routing_rules
               SET primary_handler_id = ?, backup_handler_id = ?, default_priority = ?, branch = ?, team = ?
               WHERE id = ?""",
            (primary_id, backup_id, default_priority, branch, team, rule_id),
        )
    return 200, {"message": "Routing rule updated."}


def handle_get_escalations():
    conn = get_connection()
    try:
        rows = conn.execute(
            """SELECT e.*, r.station_code, r.incident_code, r.status AS report_status,
                      r.submitted_at, c.category, h.name AS zonal_handler_name
               FROM escalations e
               JOIN reports r ON e.report_id = r.report_id
               LEFT JOIN classifications c ON e.report_id = c.report_id
               LEFT JOIN handlers h ON e.zonal_handler_id = h.id
               ORDER BY e.id DESC"""
        ).fetchall()
        return 200, {"escalations": [dict(r) for r in rows]}
    finally:
        conn.close()


def handle_get_analytics():
    conn = get_connection()
    try:
        total = conn.execute("SELECT COUNT(*) FROM reports").fetchone()[0]
        by_status = conn.execute("SELECT status, COUNT(*) AS count FROM reports GROUP BY status").fetchall()
        status_map = {r["status"]: r["count"] for r in by_status}

        by_category = conn.execute(
            "SELECT category AS name, COUNT(*) AS value FROM classifications GROUP BY category ORDER BY value DESC"
        ).fetchall()

        by_priority = conn.execute(
            "SELECT priority AS name, COUNT(*) AS value FROM reports GROUP BY priority"
        ).fetchall()

        report_rows = conn.execute("SELECT report_id, station_code FROM reports").fetchall()
        zone_counts: dict[str, int] = {}
        for rr in report_rows:
            st = conn.execute(
                """SELECT z.zone_name FROM stations s
                   JOIN zones z ON s.zone_id = z.id
                   WHERE s.station_code = ? OR s.station_prefix = ?
                   LIMIT 1""",
                (rr["station_code"], rr["station_code"][:3]),
            ).fetchone()
            z_name = st["zone_name"] if st else "Central Fallback Queue"
            zone_counts[z_name] = zone_counts.get(z_name, 0) + 1
        by_zone = [{"name": k, "count": v} for k, v in zone_counts.items()]

        monthly_trends = conn.execute(
            """SELECT substr(submitted_at, 1, 7) AS month,
                      COUNT(*) AS total,
                      SUM(CASE WHEN status = 'Resolved' THEN 1 ELSE 0 END) AS resolved
               FROM reports
               GROUP BY substr(submitted_at, 1, 7)
               ORDER BY month ASC"""
        ).fetchall()

        handler_workload = conn.execute(
            """SELECT name, role, current_load, max_capacity, is_available
               FROM handlers
               WHERE role IN ('Primary', 'Backup')
               ORDER BY division_id, role"""
        ).fetchall()

        escalation_count = conn.execute("SELECT COUNT(*) FROM escalations").fetchone()[0]
        resolved_count = status_map.get("Resolved", 0)
        unresolved_count = total - resolved_count

        return 200, {
            "summary": {
                "total": total,
                "pending": status_map.get("Pending", 0),
                "assigned": status_map.get("Assigned", 0),
                "in_progress": status_map.get("In Progress", 0),
                "resolved": resolved_count,
                "unresolved": unresolved_count,
                "escalations": escalation_count,
            },
            "by_zone": by_zone,
            "by_category": [dict(r) for r in by_category],
            "by_priority": [dict(r) for r in by_priority],
            "monthly_trends": [dict(r) for r in monthly_trends],
            "handler_workload": [dict(r) for r in handler_workload],
        }
    finally:
        conn.close()


def handle_demo_reset():
    seed_database(reset=True)
    return 200, {"message": "Demonstration database reset to initial 30-station state."}
