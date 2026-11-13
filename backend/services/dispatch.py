"""
BCS502 - Dispatch & Handler Assignment Engine
Implements handler availability, capacity checks, backup failover,
deterministic queuing, and duplicate assignment prevention.
"""

from services.routing_engine import lookup_routing, resolve_effective_priority
from services.escalation import evaluate_and_record_escalation


def _is_handler_eligible(handler_row) -> tuple[bool, str]:
    if handler_row is None:
        return False, "Handler record does not exist."
    if handler_row["is_available"] != 1:
        return False, f"Handler '{handler_row['name']}' is marked unavailable."
    if handler_row["current_load"] >= handler_row["max_capacity"]:
        return False, (
            f"Handler '{handler_row['name']}' capacity exceeded "
            f"({handler_row['current_load']}/{handler_row['max_capacity']})."
        )
    return True, "Eligible"


def _next_queue_order(conn) -> int:
    row = conn.execute("SELECT COALESCE(MAX(queue_order), 0) AS max_q FROM dispatch_logs").fetchone()
    return (row["max_q"] or 0) + 1


def execute_dispatch(conn, report_id: str, actor: str = "Dispatch Engine") -> dict:
    """
    Executes routing, escalation, handler selection, queuing, and persistent logging
    inside the active SQLite transaction. Prevents duplicate assignments.
    """
    report = conn.execute("SELECT * FROM reports WHERE report_id = ?", (report_id,)).fetchone()
    if report is None:
        raise ValueError(f"Report '{report_id}' not found.")

    validation = conn.execute(
        "SELECT * FROM validation_results WHERE report_id = ?", (report_id,)
    ).fetchone()
    if validation is None or validation["overall_valid"] != 1:
        raise ValueError(f"Report '{report_id}' has not passed automata validation and cannot be dispatched.")

    classification = conn.execute(
        "SELECT * FROM classifications WHERE report_id = ?", (report_id,)
    ).fetchone()
    if classification is None:
        raise ValueError(f"Report '{report_id}' has not been classified and cannot be dispatched.")

    existing_assign = conn.execute(
        "SELECT * FROM assignments WHERE report_id = ? AND assignment_status = 'Assigned'",
        (report_id,),
    ).fetchone()
    if existing_assign is not None:
        raise ValueError(f"Duplicate assignment prevented: Report '{report_id}' is already assigned.")

    category = classification["category"]
    routing = lookup_routing(conn, report["station_code"], category)
    effective_priority, overridden, override_reason = resolve_effective_priority(
        category, report["urgency"], routing["default_priority"]
    )

    if effective_priority != report["priority"]:
        conn.execute(
            "UPDATE reports SET priority = ? WHERE report_id = ?",
            (effective_priority, report_id),
        )

    escalation = evaluate_and_record_escalation(
        conn, report_id, routing, effective_priority, report["urgency"], category
    )

    if routing["is_unknown_zone"]:
        q_order = _next_queue_order(conn)
        conn.execute(
            """INSERT OR REPLACE INTO assignments
               (report_id, handler_id, assignment_type, assignment_status, resolution_notes)
               VALUES (?, ?, 'Fallback-Queue', 'Queued', '')""",
            (report_id, routing["primary_handler_id"]),
        )
        conn.execute("UPDATE reports SET status = 'Pending' WHERE report_id = ?", (report_id,))
        reason = (
            f"Unknown station prefix '{routing['routing_key']}'. "
            f"Routed to Central Fallback Correction Queue (Queue #{q_order}). {override_reason}"
        )
        conn.execute(
            """INSERT INTO dispatch_logs
               (report_id, routing_key, division_name, zone_name, decision, reason, queue_order)
               VALUES (?, ?, ?, ?, 'Fallback-Queue -> Pending', ?, ?)""",
            (report_id, routing["routing_key"], routing["division_name"], routing["zone_name"], reason, q_order),
        )
        conn.execute(
            """INSERT INTO status_history (report_id, old_status, new_status, changed_by, notes)
               VALUES (?, ?, 'Pending', ?, ?)""",
            (report_id, report["status"], actor, reason),
        )
        return {
            "report_id": report_id,
            "status": "Pending",
            "assignment_type": "Fallback-Queue",
            "assigned_handler": None,
            "routing": routing,
            "priority": effective_priority,
            "priority_overridden": overridden,
            "escalation": escalation,
            "queue_order": q_order,
            "decision_reason": reason,
        }

    primary = conn.execute(
        "SELECT * FROM handlers WHERE id = ?", (routing["primary_handler_id"],)
    ).fetchone()
    backup = conn.execute(
        "SELECT * FROM handlers WHERE id = ?", (routing["backup_handler_id"],)
    ).fetchone()

    p_ok, p_reason = _is_handler_eligible(primary)
    if p_ok:
        selected_handler = primary
        assign_type = "Primary"
        decision = f"Assigned Primary Handler: {primary['name']}"
        reason = f"{routing['match_type']}. Primary handler eligible ({primary['current_load']}/{primary['max_capacity']}). {override_reason}"
    else:
        b_ok, b_reason = _is_handler_eligible(backup)
        if b_ok:
            selected_handler = backup
            assign_type = "Backup"
            decision = f"Assigned Backup Handler: {backup['name']}"
            reason = (
                f"{routing['match_type']}. Primary unavailable/full ({p_reason}) -> "
                f"Failover to Backup handler ({backup['current_load']}/{backup['max_capacity']}). {override_reason}"
            )
        else:
            q_order = _next_queue_order(conn)
            decision = f"Queued (Queue #{q_order})"
            reason = (
                f"No eligible handler. Primary: {p_reason} | Backup: {b_reason}. "
                f"Placed in deterministic dispatch queue at position #{q_order}. {override_reason}"
            )

            conn.execute(
                """INSERT OR REPLACE INTO assignments
                   (report_id, handler_id, assignment_type, assignment_status, resolution_notes)
                   VALUES (?, NULL, 'Queued', 'Queued', '')""",
                (report_id,),
            )
            conn.execute("UPDATE reports SET status = 'Pending' WHERE report_id = ?", (report_id,))
            conn.execute(
                """INSERT INTO dispatch_logs
                   (report_id, routing_key, division_name, zone_name, decision, reason, queue_order)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (report_id, routing["routing_key"], routing["division_name"], routing["zone_name"], decision, reason, q_order),
            )
            conn.execute(
                """INSERT INTO status_history (report_id, old_status, new_status, changed_by, notes)
                   VALUES (?, ?, 'Pending', ?, ?)""",
                (report_id, report["status"], actor, reason),
            )
            return {
                "report_id": report_id,
                "status": "Pending",
                "assignment_type": "Queued",
                "assigned_handler": None,
                "routing": routing,
                "priority": effective_priority,
                "priority_overridden": overridden,
                "escalation": escalation,
                "queue_order": q_order,
                "decision_reason": reason,
            }

    conn.execute(
        "UPDATE handlers SET current_load = current_load + 1 WHERE id = ?",
        (selected_handler["id"],),
    )
    conn.execute(
        """INSERT INTO assignments
           (report_id, handler_id, assignment_type, assignment_status, resolution_notes)
           VALUES (?, ?, ?, 'Assigned', '')
           ON CONFLICT(report_id) DO UPDATE SET
               handler_id = excluded.handler_id,
               assignment_type = excluded.assignment_type,
               assignment_status = 'Assigned',
               assigned_at = datetime('now')""",
        (report_id, selected_handler["id"], assign_type),
    )
    conn.execute("UPDATE reports SET status = 'Assigned' WHERE report_id = ?", (report_id,))
    conn.execute(
        """INSERT INTO dispatch_logs
           (report_id, routing_key, division_name, zone_name, decision, reason, queue_order)
           VALUES (?, ?, ?, ?, ?, ?, NULL)""",
        (report_id, routing["routing_key"], routing["division_name"], routing["zone_name"], decision, reason),
    )
    conn.execute(
        """INSERT INTO status_history (report_id, old_status, new_status, changed_by, notes)
           VALUES (?, ?, 'Assigned', ?, ?)""",
        (report_id, report["status"], actor, reason),
    )

    return {
        "report_id": report_id,
        "status": "Assigned",
        "assignment_type": assign_type,
        "assigned_handler": {
            "id": selected_handler["id"],
            "handler_code": selected_handler["handler_code"],
            "name": selected_handler["name"],
            "role": selected_handler["role"],
            "team": selected_handler["team"],
        },
        "routing": routing,
        "priority": effective_priority,
        "priority_overridden": overridden,
        "escalation": escalation,
        "queue_order": None,
        "decision_reason": reason,
    }


def process_pending_queue(conn) -> list[dict]:
    """
    Processes queued 'Pending' reports in deterministic priority + FIFO order
    whenever handlers have available capacity.
    """
    queued = conn.execute(
        """SELECT r.report_id
           FROM reports r
           JOIN assignments a ON r.report_id = a.report_id
           WHERE r.status = 'Pending' AND a.assignment_type = 'Queued'
           ORDER BY
             CASE r.priority
               WHEN 'Critical' THEN 1
               WHEN 'High' THEN 2
               WHEN 'Medium' THEN 3
               ELSE 4
             END ASC,
             r.created_at ASC,
             r.id ASC"""
    ).fetchall()

    results = []
    for row in queued:
        res = execute_dispatch(conn, row["report_id"], actor="Queue Processor")
        results.append(res)
    return results
