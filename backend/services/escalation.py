"""
BCS502 - Critical Incident Second-Tier Escalation to Zonal HQ
"""


def evaluate_and_record_escalation(
    conn,
    report_id: str,
    routing_info: dict,
    priority: str,
    urgency: str,
    category: str,
) -> dict | None:
    """
    Critical-class incidents automatically escalate to Zonal HQ as a mandatory second routing tier.
    """
    is_critical = (priority == "Critical") or (urgency == "Critical")
    if not is_critical:
        return None

    zonal_handler = conn.execute(
        """SELECT * FROM handlers
           WHERE division_id = ? AND role = 'Zonal-HQ' AND is_available = 1
           LIMIT 1""",
        (routing_info["division_id"],),
    ).fetchone()

    if zonal_handler is None:
        zonal_handler = conn.execute(
            "SELECT * FROM handlers WHERE role = 'Zonal-HQ' LIMIT 1"
        ).fetchone()

    reason = (
        f"Mandatory Tier-2 Zonal HQ Escalation: Category '{category}' with effective priority '{priority}' "
        f"(Urgency: '{urgency}') escalated from {routing_info['division_code']} to {routing_info['zonal_hq_unit']}."
    )

    conn.execute(
        """INSERT OR REPLACE INTO escalations
           (report_id, initial_division, zonal_hq_unit, zonal_handler_id,
            escalation_reason, priority, assignment_status)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (
            report_id,
            routing_info["division_code"],
            routing_info["zonal_hq_unit"],
            zonal_handler["id"] if zonal_handler else None,
            reason,
            priority,
            "Escalated to Zonal HQ",
        ),
    )

    return {
        "escalated": True,
        "report_id": report_id,
        "initial_division": routing_info["division_code"],
        "zonal_hq_unit": routing_info["zonal_hq_unit"],
        "zonal_handler_name": zonal_handler["name"] if zonal_handler else "Zonal Command Duty Officer",
        "escalation_reason": reason,
        "priority": priority,
        "assignment_status": "Escalated to Zonal HQ",
    }
