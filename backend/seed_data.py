import json
from database import init_db, transaction
from services.dfa_validator import validate_station_dfa, validate_incident_dfa
from services.regex_validator import validate_station_regex, validate_incident_regex
from services.classifier import classify_incident


DIVISIONS = [
    ("DIV-NORTH", "Northern Demo Division", "HQ-NORTH", 1),
    ("DIV-WEST", "Western Demo Division", "HQ-WEST", 1),
    ("DIV-SOUTH", "Southern Demo Division", "HQ-SOUTH", 1),
    ("DIV-FALLBACK", "Central Fallback Correction Unit", "HQ-CENTRAL", 1),
]

ZONES = [
    ("ZONE-N", "Northern Demo Zone", "DIV-NORTH", "NTH01", 0),
    ("ZONE-W", "Western Demo Zone", "DIV-WEST", "WST01", 0),
    ("ZONE-S", "Southern Demo Zone", "DIV-SOUTH", "STH01", 0),
    ("ZONE-FALLBACK", "Central Fallback Queue", "DIV-FALLBACK", "FALLBACK", 1),
]

# 30 Illustrative Demonstration Stations (10 per operational division)
STATIONS = [
    # Northern Demo Division (10)
    ("NTH01", "NTH", "[DEMO] North Central Terminal", "DIV-NORTH", "ZONE-N"),
    ("DLI02", "DLI", "[DEMO] Metro North Junction", "DIV-NORTH", "ZONE-N"),
    ("LKO03", "LKO", "[DEMO] North East Freight Yard", "DIV-NORTH", "ZONE-N"),
    ("UMB04", "UMB", "[DEMO] Cantonment Signal Block", "DIV-NORTH", "ZONE-N"),
    ("FZR05", "FZR", "[DEMO] Frontier Relay Post", "DIV-NORTH", "ZONE-N"),
    ("MBD06", "MBD", "[DEMO] River Bridge Interlocking", "DIV-NORTH", "ZONE-N"),
    ("JUC07", "JUC", "[DEMO] Northern Loop Cabin", "DIV-NORTH", "ZONE-N"),
    ("ASR08", "ASR", "[DEMO] Border Terminus", "DIV-NORTH", "ZONE-N"),
    ("CDG09", "CDG", "[DEMO] Sector Alpha Halt", "DIV-NORTH", "ZONE-N"),
    ("PNP10", "PNP", "[DEMO] Thermal Power Siding", "DIV-NORTH", "ZONE-N"),
    # Western Demo Division (10)
    ("WST01", "WST", "[DEMO] West Grand Terminus", "DIV-WEST", "ZONE-W"),
    ("BCT02", "BCT", "[DEMO] Coastal Harbor Yard", "DIV-WEST", "ZONE-W"),
    ("ADI03", "ADI", "[DEMO] Industrial Freight Corridor", "DIV-WEST", "ZONE-W"),
    ("BRC04", "BRC", "[DEMO] Western Traction Hub", "DIV-WEST", "ZONE-W"),
    ("RJT05", "RJT", "[DEMO] Salt Flat Block Post", "DIV-WEST", "ZONE-W"),
    ("BKN06", "BKN", "[DEMO] Arid Line Relay Cabin", "DIV-WEST", "ZONE-W"),
    ("JPR07", "JPR", "[DEMO] Ridge Line Junction", "DIV-WEST", "ZONE-W"),
    ("KTT08", "KTT", "[DEMO] OHE Sub-Station Crossing", "DIV-WEST", "ZONE-W"),
    ("AII09", "AII", "[DEMO] Carriage Workshop Siding", "DIV-WEST", "ZONE-W"),
    ("UDZ10", "UDZ", "[DEMO] Valley Signal Cabin", "DIV-WEST", "ZONE-W"),
    # Southern Demo Division (10)
    ("STH01", "STH", "[DEMO] South Central Terminal", "DIV-SOUTH", "ZONE-S"),
    ("MAS02", "MAS", "[DEMO] Dockyard Link Cabin", "DIV-SOUTH", "ZONE-S"),
    ("SBC03", "SBC", "[DEMO] Tech Corridor Junction", "DIV-SOUTH", "ZONE-S"),
    ("MYS04", "MYS", "[DEMO] Heritage Line Block", "DIV-SOUTH", "ZONE-S"),
    ("TPJ05", "TPJ", "[DEMO] Delta Track Interlocking", "DIV-SOUTH", "ZONE-S"),
    ("MDU06", "MDU", "[DEMO] Southern Bypass Post", "DIV-SOUTH", "ZONE-S"),
    ("TVC07", "TVC", "[DEMO] Peninsula Terminus", "DIV-SOUTH", "ZONE-S"),
    ("PGT08", "PGT", "[DEMO] Ghat Tunnel Signal", "DIV-SOUTH", "ZONE-S"),
    ("SAZ09", "SAZ", "[DEMO] Steel Plant Siding", "DIV-SOUTH", "ZONE-S"),
    ("HYD10", "HYD", "[DEMO] Plateau Freight Loop", "DIV-SOUTH", "ZONE-S"),
]

HANDLERS = [
    ("HND-N-P1", "A. Sharma (North Primary)", "Primary", "Signal Response Alpha", "Signal & Telecom", "DIV-NORTH", "ZONE-N", 1, 0, 4),
    ("HND-N-B1", "R. Verma (North Backup)", "Backup", "Signal Reserve Bravo", "Signal & Telecom", "DIV-NORTH", "ZONE-N", 1, 0, 4),
    ("HND-N-HQ", "Cmdr. K. Nair (North Zonal HQ)", "Zonal-HQ", "Zonal Command North", "Zonal Escalation", "DIV-NORTH", "ZONE-N", 1, 0, 10),
    ("HND-W-P1", "M. Patel (West Primary)", "Primary", "Traction & Track Alpha", "Engineering & OHE", "DIV-WEST", "ZONE-W", 1, 0, 3),
    ("HND-W-B1", "S. Kulkarni (West Backup)", "Backup", "Traction Reserve Bravo", "Engineering & OHE", "DIV-WEST", "ZONE-W", 1, 0, 3),
    ("HND-W-HQ", "Cmdr. D. Joshi (West Zonal HQ)", "Zonal-HQ", "Zonal Command West", "Zonal Escalation", "DIV-WEST", "ZONE-W", 1, 0, 10),
    ("HND-S-P1", "V. Iyer (South Primary)", "Primary", "Southern Rapid Ops", "Signal & Track", "DIV-SOUTH", "ZONE-S", 1, 0, 3),
    ("HND-S-B1", "L. Reddy (South Backup)", "Backup", "Southern Reserve Ops", "Signal & Track", "DIV-SOUTH", "ZONE-S", 1, 0, 3),
    ("HND-S-HQ", "Cmdr. P. Menon (South Zonal HQ)", "Zonal-HQ", "Zonal Command South", "Zonal Escalation", "DIV-SOUTH", "ZONE-S", 1, 0, 10),
    ("HND-FB-1", "Central Correction Desk", "Fallback", "Routing Correction Queue", "Central Control", "DIV-FALLBACK", "ZONE-FALLBACK", 1, 0, 20),
]

SAMPLE_REPORTS = [
    {
        "report_id": "DEMO-2026-0001",
        "station_code": "NTH01",
        "incident_code": "SIG04",
        "description": "Main home signal red aspect failure at North Central block.",
        "urgency": "Critical",
        "priority": "Critical",
        "reporter_name": "SM R. Kapoor [DEMO]",
        "submitted_at": "2026-09-14T08:15:00",
        "status": "Assigned",
        "handler_code": "HND-N-P1",
        "assignment_type": "Primary",
        "escalate_hq": ("DIV-NORTH", "HQ-NORTH", "HND-N-HQ"),
        "notes": "",
    },
    {
        "report_id": "DEMO-2026-0002",
        "station_code": "WST01",
        "incident_code": "TRK18",
        "description": "Track obstruction reported near yard turnout point 14.",
        "urgency": "High",
        "priority": "High",
        "reporter_name": "SM T. Desai [DEMO]",
        "submitted_at": "2026-10-03T11:40:00",
        "status": "In Progress",
        "handler_code": "HND-W-P1",
        "assignment_type": "Primary",
        "escalate_hq": None,
        "notes": "Engineering crew dispatched to clear turnout.",
    },
    {
        "report_id": "DEMO-2026-0003",
        "station_code": "SBC03",
        "incident_code": "ELE22",
        "description": "OHE catenary voltage fluctuation on loop line 2.",
        "urgency": "High",
        "priority": "High",
        "reporter_name": "SM N. Rao [DEMO]",
        "submitted_at": "2026-10-19T14:20:00",
        "status": "Resolved",
        "handler_code": "HND-S-P1",
        "assignment_type": "Primary",
        "escalate_hq": None,
        "notes": "Insulator replaced and OHE voltage stabilized.",
    },
    {
        "report_id": "DEMO-2026-0004",
        "station_code": "DLI02",
        "incident_code": "SIG52",
        "description": "Minor delay in distant signal repeater indication.",
        "urgency": "Low",
        "priority": "Low",
        "reporter_name": "SM A. Gupta [DEMO]",
        "submitted_at": "2026-11-05T09:05:00",
        "status": "Pending",
        "handler_code": None,
        "assignment_type": "Queued",
        "escalate_hq": None,
        "notes": "Queued pending preventive maintenance slot.",
    },
    {
        "report_id": "DEMO-2026-0005",
        "station_code": "MAS02",
        "incident_code": "TRK91",
        "description": "Scheduled monthly track sensor test entry.",
        "urgency": "Low",
        "priority": "Low",
        "reporter_name": "SM K. Subramanian [DEMO]",
        "submitted_at": "2026-11-10T16:00:00",
        "status": "Resolved",
        "handler_code": "HND-S-B1",
        "assignment_type": "Backup",
        "escalate_hq": None,
        "notes": "Diagnostic drill verified and logged.",
    },
]


def seed_database(db_path: str | None = None, reset: bool = False) -> None:
    init_db(db_path)

    with transaction(db_path) as conn:
        if reset:
            for tbl in (
                "dispatch_logs",
                "status_history",
                "escalations",
                "assignments",
                "classifications",
                "validation_results",
                "reports",
                "routing_rules",
                "handlers",
                "stations",
                "zones",
                "railway_divisions",
            ):
                conn.execute(f"DELETE FROM {tbl}")

        existing_divs = conn.execute("SELECT COUNT(*) FROM railway_divisions").fetchone()[0]
        if existing_divs > 0 and not reset:
            return

        for d in DIVISIONS:
            conn.execute(
                "INSERT INTO railway_divisions (division_code, division_name, zonal_hq_unit, is_demo) VALUES (?, ?, ?, ?)",
                d,
            )

        div_map = {
            row["division_code"]: row["id"]
            for row in conn.execute("SELECT id, division_code FROM railway_divisions").fetchall()
        }

        for z_code, z_name, d_code, hq_st, is_fb in ZONES:
            conn.execute(
                "INSERT INTO zones (zone_code, zone_name, division_id, hq_station, is_fallback) VALUES (?, ?, ?, ?, ?)",
                (z_code, z_name, div_map[d_code], hq_st, is_fb),
            )

        zone_map = {
            row["zone_code"]: row["id"]
            for row in conn.execute("SELECT id, zone_code FROM zones").fetchall()
        }

        for st_code, prefix, st_name, d_code, z_code in STATIONS:
            conn.execute(
                "INSERT INTO stations (station_code, station_prefix, station_name, division_id, zone_id, is_demo) VALUES (?, ?, ?, ?, ?, 1)",
                (st_code, prefix, st_name, div_map[d_code], zone_map[z_code]),
            )

        for h_code, h_name, role, team, branch, d_code, z_code, avail, load, cap in HANDLERS:
            conn.execute(
                """INSERT INTO handlers
                   (handler_code, name, role, team, branch, division_id, zone_id, is_available, current_load, max_capacity)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (h_code, h_name, role, team, branch, div_map[d_code], zone_map[z_code], avail, load, cap),
            )

        handler_map = {
            row["handler_code"]: row["id"]
            for row in conn.execute("SELECT id, handler_code FROM handlers").fetchall()
        }

        division_routing_defaults = {
            "DIV-NORTH": ("Signal & Telecom", "North Alpha Team", "NTH-Central Depot", "HND-N-P1", "HND-N-B1", "High"),
            "DIV-WEST": ("Engineering & OHE", "West Alpha Team", "WST-Main Depot", "HND-W-P1", "HND-W-B1", "High"),
            "DIV-SOUTH": ("Signal & Track", "South Alpha Team", "STH-South Depot", "HND-S-P1", "HND-S-B1", "Medium"),
        }

        for st_code, prefix, _name, d_code, z_code in STATIONS:
            branch, team, depot, p_code, b_code, prio = division_routing_defaults[d_code]
            conn.execute(
                """INSERT INTO routing_rules
                   (station_prefix, station_code, division_id, zone_id, branch, team, depot,
                    primary_handler_id, backup_handler_id, incident_category, default_priority)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ALL', ?)""",
                (
                    prefix,
                    st_code,
                    div_map[d_code],
                    zone_map[z_code],
                    branch,
                    team,
                    depot,
                    handler_map[p_code],
                    handler_map[b_code],
                    prio,
                ),
            )

        for idx, sr in enumerate(SAMPLE_REPORTS, start=1):
            conn.execute(
                """INSERT INTO reports
                   (report_id, station_code, incident_code, description, urgency, priority,
                    reporter_name, submitted_at, status, is_sample)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)""",
                (
                    sr["report_id"],
                    sr["station_code"],
                    sr["incident_code"],
                    sr["description"],
                    sr["urgency"],
                    sr["priority"],
                    sr["reporter_name"],
                    sr["submitted_at"],
                    sr["status"],
                ),
            )

            s_dfa = validate_station_dfa(sr["station_code"])
            s_reg = validate_station_regex(sr["station_code"])
            i_dfa = validate_incident_dfa(sr["incident_code"])
            i_reg = validate_incident_regex(sr["incident_code"])
            cls_res = classify_incident(sr["incident_code"], sr["description"])

            conn.execute(
                """INSERT INTO validation_results
                   (report_id, station_dfa_valid, station_regex_valid, station_agree,
                    incident_dfa_valid, incident_regex_valid, incident_agree,
                    overall_valid, dfa_trace_json, validation_summary)
                   VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)""",
                (
                    sr["report_id"],
                    int(s_dfa["valid"]),
                    int(s_reg["valid"]),
                    int(s_dfa["valid"] == s_reg["valid"]),
                    int(i_dfa["valid"]),
                    int(i_reg["valid"]),
                    int(i_dfa["valid"] == i_reg["valid"]),
                    json.dumps({"station": s_dfa, "incident": i_dfa}),
                    "DFA and Regex independently accepted both station and incident codes.",
                ),
            )

            conn.execute(
                """INSERT INTO classifications
                   (report_id, category, matched_patterns_json, conflict_detected,
                    priority_rule_applied, classification_reason)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (
                    sr["report_id"],
                    cls_res["category"],
                    json.dumps(cls_res["matched_patterns"]),
                    int(cls_res["conflict_detected"]),
                    cls_res["priority_rule_applied"],
                    cls_res["reason"],
                ),
            )

            h_id = handler_map[sr["handler_code"]] if sr["handler_code"] else None
            a_status = "Assigned" if sr["status"] != "Pending" else "Queued"
            resolved_at = sr["submitted_at"] if sr["status"] == "Resolved" else None
            conn.execute(
                """INSERT INTO assignments
                   (report_id, handler_id, assignment_type, assignment_status, resolution_notes, assigned_at, resolved_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    sr["report_id"],
                    h_id,
                    sr["assignment_type"],
                    a_status,
                    sr["notes"],
                    sr["submitted_at"],
                    resolved_at,
                ),
            )

            if sr["status"] in ("Assigned", "In Progress") and h_id is not None:
                conn.execute(
                    "UPDATE handlers SET current_load = current_load + 1 WHERE id = ?",
                    (h_id,),
                )

            if sr["escalate_hq"]:
                div_code, hq_unit, hq_h_code = sr["escalate_hq"]
                conn.execute(
                    """INSERT INTO escalations
                       (report_id, initial_division, zonal_hq_unit, zonal_handler_id,
                        escalation_reason, priority, assignment_status, escalated_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        sr["report_id"],
                        div_code,
                        hq_unit,
                        handler_map[hq_h_code],
                        "Critical incident mandatory second-tier escalation to Zonal HQ.",
                        sr["priority"],
                        "Escalated & Monitored",
                        sr["submitted_at"],
                    ),
                )

            conn.execute(
                """INSERT INTO status_history (report_id, old_status, new_status, changed_by, notes, changed_at)
                   VALUES (?, NULL, ?, 'System Seed', 'Initial demonstration record', ?)""",
                (sr["report_id"], sr["status"], sr["submitted_at"]),
            )

            conn.execute(
                """INSERT INTO dispatch_logs
                   (report_id, routing_key, division_name, zone_name, decision, reason, queue_order, logged_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    sr["report_id"],
                    sr["station_code"][:3],
                    "Seeded Division",
                    "Seeded Zone",
                    f"{sr['assignment_type']} -> {sr['status']}",
                    "Demonstration dataset entry.",
                    idx if sr["status"] == "Pending" else None,
                    sr["submitted_at"],
                ),
            )


if __name__ == "__main__":
    seed_database()
    print("Database initialized and seeded successfully.")
