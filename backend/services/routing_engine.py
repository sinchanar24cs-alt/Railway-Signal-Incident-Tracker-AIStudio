"""
BCS502 - Computer Networks: Routing Table Lookup & Priority Override Engine
"""

import config
from services.regex_validator import validate_station_regex


CATEGORY_DEFAULT_PRIORITY = {
    "Signal-Failure": "High",
    "Track-Obstruction": "High",
    "Electrical": "High",
    "Minor-Delay": "Medium",
    "Test-Entry": "Low",
}

PRIORITY_RANK = {"Low": 1, "Medium": 2, "High": 3, "Critical": 4}


def resolve_effective_priority(category: str, urgency: str, rule_priority: str | None) -> tuple[str, bool, str]:
    base = rule_priority or CATEGORY_DEFAULT_PRIORITY.get(category, "Medium")
    if urgency == "Critical":
        return "Critical", True, "Priority Override: Reporter urgency 'Critical' escalated effective priority to Critical."
    if PRIORITY_RANK.get(urgency, 1) > PRIORITY_RANK.get(base, 2):
        return urgency, True, f"Priority Override: Reporter urgency '{urgency}' elevated rule priority '{base}' to '{urgency}'."
    return base, False, f"Standard routing priority '{base}' retained."


def lookup_routing(conn, station_code: str, category: str) -> dict:
    """
    Extract routing key from validated station_code and look up division, zone, and handlers.
    Returns unknown-zone fallback metadata if station/prefix is unmapped.
    Raises ValueError for invalid routing codes.
    """
    reg_check = validate_station_regex(station_code)
    if not reg_check["valid"]:
        raise ValueError(f"Invalid routing code '{station_code}': {reg_check['reason']}")

    prefix = station_code[:3]

    rule = conn.execute(
        """SELECT r.*, d.division_code, d.division_name, d.zonal_hq_unit,
                  z.zone_code, z.zone_name, z.is_fallback
           FROM routing_rules r
           JOIN railway_divisions d ON r.division_id = d.id
           JOIN zones z ON r.zone_id = z.id
           WHERE r.station_code = ? AND (r.incident_category = ? OR r.incident_category = 'ALL')
           ORDER BY CASE WHEN r.incident_category = ? THEN 0 ELSE 1 END
           LIMIT 1""",
        (station_code, category, category),
    ).fetchone()

    match_type = "Exact Station Match"

    if rule is None:
        rule = conn.execute(
            """SELECT r.*, d.division_code, d.division_name, d.zonal_hq_unit,
                      z.zone_code, z.zone_name, z.is_fallback
               FROM routing_rules r
               JOIN railway_divisions d ON r.division_id = d.id
               JOIN zones z ON r.zone_id = z.id
               WHERE r.station_prefix = ? AND (r.incident_category = ? OR r.incident_category = 'ALL')
               ORDER BY CASE WHEN r.incident_category = ? THEN 0 ELSE 1 END, r.id ASC
               LIMIT 1""",
            (prefix, category, category),
        ).fetchone()
        match_type = "Station Prefix Match"

    if rule is None:
        fb_zone = conn.execute(
            """SELECT z.id AS zone_id, z.zone_code, z.zone_name,
                      d.id AS division_id, d.division_code, d.division_name, d.zonal_hq_unit
               FROM zones z
               JOIN railway_divisions d ON z.division_id = d.id
               WHERE z.zone_code = ?""",
            (config.FALLBACK_ZONE_CODE,),
        ).fetchone()
        fb_handler = conn.execute(
            "SELECT * FROM handlers WHERE role = 'Fallback' LIMIT 1"
        ).fetchone()

        return {
            "found": False,
            "is_unknown_zone": True,
            "routing_key": prefix,
            "station_code": station_code,
            "match_type": "Unknown Zone -> Central Fallback Queue",
            "division_id": fb_zone["division_id"] if fb_zone else None,
            "division_code": fb_zone["division_code"] if fb_zone else config.FALLBACK_DIVISION_CODE,
            "division_name": fb_zone["division_name"] if fb_zone else "Central Fallback Correction Unit",
            "zonal_hq_unit": fb_zone["zonal_hq_unit"] if fb_zone else "HQ-CENTRAL",
            "zone_id": fb_zone["zone_id"] if fb_zone else None,
            "zone_code": fb_zone["zone_code"] if fb_zone else config.FALLBACK_ZONE_CODE,
            "zone_name": fb_zone["zone_name"] if fb_zone else "Central Fallback Queue",
            "branch": "Central Control",
            "team": "Routing Correction Queue",
            "depot": "HQ-CORRECTION-DESK",
            "primary_handler_id": fb_handler["id"] if fb_handler else None,
            "backup_handler_id": None,
            "default_priority": "Medium",
        }

    return {
        "found": True,
        "is_unknown_zone": False,
        "routing_key": prefix,
        "station_code": station_code,
        "match_type": match_type,
        "rule_id": rule["id"],
        "division_id": rule["division_id"],
        "division_code": rule["division_code"],
        "division_name": rule["division_name"],
        "zonal_hq_unit": rule["zonal_hq_unit"],
        "zone_id": rule["zone_id"],
        "zone_code": rule["zone_code"],
        "zone_name": rule["zone_name"],
        "branch": rule["branch"],
        "team": rule["team"],
        "depot": rule["depot"],
        "primary_handler_id": rule["primary_handler_id"],
        "backup_handler_id": rule["backup_handler_id"],
        "default_priority": rule["default_priority"],
    }
