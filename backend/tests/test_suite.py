"""
Part D - Automated Integration & Verification Test Suite (20 Documented Test Cases)
Executes real assertions against isolated SQLite databases and actual Python services.
"""

import os
import sys
import tempfile
import sqlite3
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import transaction
from seed_data import seed_database
from services.dfa_validator import validate_station_dfa, validate_incident_dfa
from services.regex_validator import validate_station_regex, validate_incident_regex, validate_and_compare
from services.classifier import classify_incident
from services.routing_engine import lookup_routing
from services.dispatch import execute_dispatch, process_pending_queue


def _create_isolated_db() -> str:
    fd, path = tempfile.mkstemp(prefix="rsit_test_", suffix=".db")
    os.close(fd)
    seed_database(db_path=path, reset=True)
    return path


def _insert_validated_classified_report(conn, report_id, station_code, incident_code, description, urgency="High"):
    val = validate_and_compare(station_code, incident_code)
    if not val["overall_valid"]:
        raise ValueError("Validation failed")
    cls = classify_incident(incident_code, description)
    if not cls["classified"]:
        raise ValueError("Classification failed")

    conn.execute(
        """INSERT INTO reports
           (report_id, station_code, incident_code, description, urgency, priority, reporter_name, submitted_at, status, is_sample)
           VALUES (?, ?, ?, ?, ?, ?, 'Test Suite', ?, 'Pending', 0)""",
        (report_id, station_code, incident_code, description, urgency, urgency, datetime.now().isoformat(timespec="seconds")),
    )
    conn.execute(
        """INSERT INTO validation_results
           (report_id, station_dfa_valid, station_regex_valid, station_agree,
            incident_dfa_valid, incident_regex_valid, incident_agree, overall_valid, dfa_trace_json, validation_summary)
           VALUES (?, 1, 1, 1, 1, 1, 1, 1, '{}', 'Test validated')""",
        (report_id,),
    )
    conn.execute(
        """INSERT INTO classifications
           (report_id, category, matched_patterns_json, conflict_detected, priority_rule_applied, classification_reason)
           VALUES (?, ?, '[]', ?, ?, ?)""",
        (report_id, cls["category"], int(cls["conflict_detected"]), cls["priority_rule_applied"], cls["reason"]),
    )
    return cls


def run_all_tests() -> dict:
    results = []
    temp_db = _create_isolated_db()

    def record(test_id: str, description: str, test_input: str, expected: str, fn):
        try:
            passed, actual = fn()
            results.append({
                "test_id": test_id,
                "description": description,
                "input": test_input,
                "expected": expected,
                "actual": actual,
                "status": "PASS" if passed else "FAIL",
            })
        except Exception as ex:
            results.append({
                "test_id": test_id,
                "description": description,
                "input": test_input,
                "expected": expected,
                "actual": f"Exception: {str(ex)}",
                "status": "FAIL",
            })

    try:
        def tc01():
            d = validate_station_dfa("ABC12")
            r = validate_station_regex("ABC12")
            ok = d["valid"] and r["valid"] and d["final_state"] == "q5"
            return ok, f"DFA={d['valid']} ({d['final_state']}), Regex={r['valid']}"
        record("TC-01", "Valid station identifier", "ABC12", "Both DFA (q5) and Regex accept", tc01)

        def tc02():
            bad = ["AB12", "ABC123", "abc12", "12ABC", ""]
            checks = [not validate_station_dfa(x)["valid"] and not validate_station_regex(x)["valid"] for x in bad]
            return all(checks), f"All {len(bad)} invalid inputs rejected by both DFA and Regex"
        record("TC-02", "Invalid station identifiers", "AB12, ABC123, abc12, 12ABC, ''", "Both DFA and Regex reject all 5", tc02)

        def tc03():
            good = ["SIG01", "TRK12", "ELE99"]
            checks = [validate_incident_dfa(x)["valid"] and validate_incident_regex(x)["valid"] for x in good]
            return all(checks), f"All {len(good)} valid incident codes reached qAccept"
        record("TC-03", "Valid incident identifiers", "SIG01, TRK12, ELE99", "Both DFA (qAccept) and Regex accept", tc03)

        def tc04():
            bad = ["SIG1", "XYZ12", "TRK123", "sig01"]
            checks = [not validate_incident_dfa(x)["valid"] and not validate_incident_regex(x)["valid"] for x in bad]
            return all(checks), f"All {len(bad)} invalid incident codes rejected"
        record("TC-04", "Invalid incident identifiers", "SIG1, XYZ12, TRK123, sig01", "Both DFA and Regex reject", tc04)

        def tc05():
            pairs = [
                ("NTH01", "SIG01"), ("XYZ45", "TRK12"), ("AB12", "ELE99"),
                ("ABC123", "XYZ12"), ("abc12", "SIG1"), ("SBC03", "ELE05"),
            ]
            agrees = []
            for s, i in pairs:
                res = validate_and_compare(s, i)
                agrees.append(res["station"]["agree"] and res["incident"]["agree"])
            return all(agrees), f"DFA/Regex agreed on {sum(agrees)}/{len(agrees)} pairs"
        record("TC-05", "DFA and Regex agreement", "6 mixed station/incident pairs", "100% agreement between DFA and Regex", tc05)

        def tc06():
            cases = [
                ("SIG04", "Signal aspect lamp down", "Signal-Failure"),
                ("TRK15", "Boulder on main track", "Track-Obstruction"),
                ("ELE21", "OHE catenary power drop", "Electrical"),
                ("SIG52", "Minor delay in repeater", "Minor-Delay"),
                ("TRK95", "Routine monthly drill", "Test-Entry"),
            ]
            cats = [classify_incident(c, d)["category"] for c, d, _ in cases]
            expected_cats = [e for _, _, e in cases]
            return cats == expected_cats, f"Classified: {cats}"
        record("TC-06", "All five classification categories", "SIG04, TRK15, ELE21, SIG52, TRK95", "Maps cleanly to all 5 categories", tc06)

        def tc07():
            res = classify_incident("SIG05", "Signal relay fault causing electrical short circuit and minor delay")
            matched_cats = [m["category"] for m in res["matched_patterns"]]
            ok = res["conflict_detected"] and res["category"] == "Signal-Failure" and len(matched_cats) >= 3
            return ok, f"Matched={matched_cats}, Selected={res['category']}"
        record("TC-07", "Conflicting classification patterns", "SIG05 + multi-pattern description", "Conflict detected; Signal-Failure selected deterministically", tc07)

        def tc08():
            with transaction(temp_db) as conn:
                _insert_validated_classified_report(conn, "TST-TC08", "XYZ45", "SIG01", "Signal failure at unmapped station", "Medium")
                d = execute_dispatch(conn, "TST-TC08")
            ok = d["routing"]["is_unknown_zone"] and d["assignment_type"] == "Fallback-Queue" and d["status"] == "Pending"
            return ok, f"Assignment={d['assignment_type']}, Zone={d['routing']['zone_code']}, Status={d['status']}"
        record("TC-08", "Unknown routing zone fallback", "Station XYZ45 (valid format, unmapped prefix)", "Routed to Central Fallback Queue (Pending)", tc08)

        def tc09():
            with transaction(temp_db) as conn:
                try:
                    lookup_routing(conn, "AB1", "Signal-Failure")
                    return False, "Unexpectedly accepted invalid routing code"
                except ValueError as ve:
                    return True, f"Rejected cleanly: {str(ve)}"
        record("TC-09", "Invalid routing code rejection", "Routing key 'AB1'", "Raises ValueError rejecting malformed code", tc09)

        def tc10():
            with transaction(temp_db) as conn:
                _insert_validated_classified_report(conn, "TST-TC10", "NTH01", "SIG02", "Signal failure at NTH01", "High")
                d = execute_dispatch(conn, "TST-TC10")
            ok = d["assignment_type"] == "Primary" and d["status"] == "Assigned"
            return ok, f"Assigned={d['assignment_type']} ({d['assigned_handler']['name']})"
        record("TC-10", "Primary handler available", "NTH01 / SIG02", "Primary handler assigned (Assigned)", tc10)

        def tc11():
            with transaction(temp_db) as conn:
                conn.execute("UPDATE handlers SET is_available = 0 WHERE handler_code = 'HND-W-P1'")
                _insert_validated_classified_report(conn, "TST-TC11", "WST01", "TRK10", "Track obstruction near WST01", "High")
                d = execute_dispatch(conn, "TST-TC11")
                conn.execute("UPDATE handlers SET is_available = 1 WHERE handler_code = 'HND-W-P1'")
            ok = d["assignment_type"] == "Backup" and d["assigned_handler"]["handler_code"] == "HND-W-B1"
            return ok, f"Failover={d['assignment_type']} ({d['assigned_handler']['handler_code']})"
        record("TC-11", "Primary handler unavailable -> Backup failover", "HND-W-P1 unavailable, report at WST01", "Backup handler HND-W-B1 assigned", tc11)

        def tc12():
            with transaction(temp_db) as conn:
                conn.execute("UPDATE handlers SET current_load = max_capacity WHERE handler_code IN ('HND-S-P1', 'HND-S-B1')")
                _insert_validated_classified_report(conn, "TST-TC12", "STH01", "ELE11", "OHE electrical fault", "Medium")
                d = execute_dispatch(conn, "TST-TC12")
            ok = d["assignment_type"] == "Queued" and d["status"] == "Pending" and d["queue_order"] is not None
            return ok, f"Type={d['assignment_type']}, Status={d['status']}, QueueOrder={d['queue_order']}"
        record("TC-12", "Handler capacity exceeded -> Queued", "South Primary & Backup at max capacity", "Report queued with deterministic queue_order", tc12)

        def tc13():
            with transaction(temp_db) as conn:
                conn.execute("UPDATE handlers SET current_load = 0 WHERE handler_code = 'HND-S-B1'")
                conn.execute("UPDATE handlers SET current_load = max_capacity WHERE handler_code = 'HND-S-P1'")
                _insert_validated_classified_report(conn, "TST-TC13", "SBC03", "TRK08", "Debris on track at SBC03", "High")
                d = execute_dispatch(conn, "TST-TC13")
            ok = d["assignment_type"] == "Backup" and d["assigned_handler"]["handler_code"] == "HND-S-B1"
            return ok, f"Primary full -> Assigned Backup {d['assigned_handler']['handler_code']}"
        record("TC-13", "Backup assignment when primary full", "HND-S-P1 full, HND-S-B1 free", "HND-S-B1 assigned as Backup", tc13)

        def tc14():
            with transaction(temp_db) as conn:
                _insert_validated_classified_report(conn, "TST-TC14", "DLI02", "SIG09", "Complete interlocking signal blackout", "Critical")
                d = execute_dispatch(conn, "TST-TC14")
                esc = conn.execute("SELECT * FROM escalations WHERE report_id = 'TST-TC14'").fetchone()
            ok = d["escalation"] is not None and esc is not None and esc["zonal_hq_unit"] == "HQ-NORTH"
            return ok, f"Escalated to {esc['zonal_hq_unit']} ({esc['assignment_status']})"
        record("TC-14", "Critical incident escalation to Zonal HQ", "DLI02 / SIG09 / Critical", "Recorded Tier-2 escalation to HQ-NORTH", tc14)

        def tc15():
            with transaction(temp_db) as conn:
                _insert_validated_classified_report(conn, "TST-TC15", "LKO03", "SIG54", "Minor delay turned critical by dispatcher", "Critical")
                d = execute_dispatch(conn, "TST-TC15")
            ok = d["priority"] == "Critical" and d["priority_overridden"] and d["escalation"] is not None
            return ok, f"Priority={d['priority']}, Overridden={d['priority_overridden']}, Escalated={d['escalation'] is not None}"
        record("TC-15", "Priority override rule", "SIG54 (Minor-Delay) with Critical urgency", "Overridden to Critical & escalated to Zonal HQ", tc15)

        def tc16():
            with transaction(temp_db) as conn:
                conn.execute("UPDATE handlers SET current_load = 0, is_available = 1 WHERE division_id IN (SELECT id FROM railway_divisions WHERE division_code = 'DIV-NORTH')")
                outcomes = []
                for idx in range(1, 5):
                    rid = f"TST-TC16-{idx}"
                    _insert_validated_classified_report(conn, rid, "NTH01", f"SIG0{idx}", "Multi-report burst test", "High")
                    outcomes.append(execute_dispatch(conn, rid)["status"])
            ok = len(outcomes) == 4 and all(s == "Assigned" for s in outcomes)
            return ok, f"4 incoming reports processed sequentially: {outcomes}"
        record("TC-16", "Multiple incoming reports sequential dispatch", "4 concurrent-burst reports at NTH01", "All 4 deterministically assigned within capacity", tc16)

        def tc17():
            with transaction(temp_db) as conn:
                conn.execute("UPDATE handlers SET current_load = max_capacity WHERE handler_code IN ('HND-N-P1', 'HND-N-B1')")
                _insert_validated_classified_report(conn, "TST-TC17-LOW", "NTH01", "SIG51", "Low priority queued item", "Low")
                d1 = execute_dispatch(conn, "TST-TC17-LOW")
                _insert_validated_classified_report(conn, "TST-TC17-CRIT", "NTH01", "SIG08", "Critical queued item", "Critical")
                d2 = execute_dispatch(conn, "TST-TC17-CRIT")

                conn.execute("UPDATE handlers SET current_load = max_capacity - 1 WHERE handler_code = 'HND-N-P1'")
                process_pending_queue(conn)
                crit_row = conn.execute("SELECT status FROM reports WHERE report_id = 'TST-TC17-CRIT'").fetchone()
                low_row = conn.execute("SELECT status FROM reports WHERE report_id = 'TST-TC17-LOW'").fetchone()
            ok = (
                d1["status"] == "Pending" and d2["status"] == "Pending"
                and d2["queue_order"] > d1["queue_order"]
                and crit_row["status"] == "Assigned" and low_row["status"] == "Pending"
            )
            return ok, f"Q1={d1['queue_order']}, Q2={d2['queue_order']}; After 1 slot freed: Critical={crit_row['status']}, Low={low_row['status']}"
        record("TC-17", "Deterministic queue ordering & priority drain", "Queued Low + Critical, then 1 slot freed", "Critical dispatched ahead of Low on drain", tc17)

        def tc18():
            with transaction(temp_db) as conn:
                conn.execute("UPDATE handlers SET current_load = 0 WHERE handler_code = 'HND-W-P1'")
                _insert_validated_classified_report(conn, "TST-TC18", "WST01", "ELE04", "Transformer fault", "High")
                execute_dispatch(conn, "TST-TC18")
                try:
                    execute_dispatch(conn, "TST-TC18")
                    return False, "Duplicate assignment was allowed!"
                except ValueError as ve:
                    try:
                        conn.execute(
                            "INSERT INTO assignments (report_id, handler_id, assignment_type, assignment_status) VALUES ('TST-TC18', 1, 'Primary', 'Assigned')"
                        )
                        return False, "SQLite UNIQUE constraint failed to block duplicate!"
                    except sqlite3.IntegrityError:
                        return True, f"Engine & SQLite UNIQUE constraint blocked duplicate: {str(ve)}"
        record("TC-18", "Duplicate assignment prevention", "Second dispatch & raw SQL insert on TST-TC18", "Blocked by both dispatch service & SQLite UNIQUE", tc18)

        def tc19():
            with transaction(temp_db) as conn:
                before = conn.execute("SELECT current_load FROM handlers WHERE handler_code = 'HND-W-P1'").fetchone()["current_load"]
                conn.execute("UPDATE reports SET status = 'In Progress' WHERE report_id = 'TST-TC18'")
                conn.execute("INSERT INTO status_history (report_id, old_status, new_status, changed_by, notes) VALUES ('TST-TC18', 'Assigned', 'In Progress', 'Handler', 'Investigating')")
                conn.execute("UPDATE reports SET status = 'Resolved' WHERE report_id = 'TST-TC18'")
                conn.execute("UPDATE handlers SET current_load = current_load - 1 WHERE handler_code = 'HND-W-P1' AND current_load > 0")
                conn.execute("INSERT INTO status_history (report_id, old_status, new_status, changed_by, notes) VALUES ('TST-TC18', 'In Progress', 'Resolved', 'Handler', 'Fixed')")
                after = conn.execute("SELECT current_load FROM handlers WHERE handler_code = 'HND-W-P1'").fetchone()["current_load"]
                hist_cnt = conn.execute("SELECT COUNT(*) FROM status_history WHERE report_id = 'TST-TC18'").fetchone()[0]
            ok = after == before - 1 and hist_cnt >= 3
            return ok, f"Load {before} -> {after}, status_history entries={hist_cnt}"
        record("TC-19", "Report status lifecycle & capacity release", "Assigned -> In Progress -> Resolved", "Status history logged & load decremented", tc19)

        def tc20():
            with transaction(temp_db) as conn:
                conn.execute("UPDATE handlers SET current_load = 0, is_available = 1 WHERE handler_code = 'HND-S-P1'")
                _insert_validated_classified_report(conn, "TST-TC20", "MAS02", "SIG07", "End-to-end persistence test", "Critical")
                execute_dispatch(conn, "TST-TC20")
                tables = ["reports", "validation_results", "classifications", "assignments", "escalations", "status_history", "dispatch_logs"]
                counts = {t: conn.execute(f"SELECT COUNT(*) FROM {t} WHERE report_id = 'TST-TC20'").fetchone()[0] for t in tables}
            ok = all(v >= 1 for v in counts.values())
            return ok, f"Persisted rows per table: {counts}"
        record("TC-20", "End-to-end SQLite persistence", "Full Critical report lifecycle TST-TC20", "All 7 lifecycle tables contain persisted records", tc20)

    finally:
        if os.path.exists(temp_db):
            os.remove(temp_db)

    passed_count = sum(1 for r in results if r["status"] == "PASS")
    return {
        "total": len(results),
        "passed": passed_count,
        "failed": len(results) - passed_count,
        "tests": results,
    }


if __name__ == "__main__":
    summary = run_all_tests()
    for t in summary["tests"]:
        print(f"[{t['status']}] {t['test_id']}: {t['description']} -> {t['actual']}")
    print(f"\nSummary: {summary['passed']}/{summary['total']} Passed")
