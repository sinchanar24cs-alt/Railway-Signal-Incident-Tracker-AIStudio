"""
BCS503 - Automata Theory & Computability
Independent Regular Expression validators equivalent to the Station & Incident DFAs.
"""

import re

STATION_REGEX_PATTERN = r"^[A-Z]{3}[0-9]{2}$"
INCIDENT_REGEX_PATTERN = r"^(SIG|TRK|ELE)[0-9]{2}$"

_STATION_RE = re.compile(STATION_REGEX_PATTERN)
_INCIDENT_RE = re.compile(INCIDENT_REGEX_PATTERN)


def validate_station_regex(input_str: str) -> dict:
    if not isinstance(input_str, str):
        input_str = ""
    matched = bool(_STATION_RE.match(input_str)) and ("\n" not in input_str)
    reason = (
        f"Matched regular expression {STATION_REGEX_PATTERN}."
        if matched
        else f"Did not match {STATION_REGEX_PATTERN}. Expected exactly 3 uppercase letters [A-Z] followed by 2 digits [0-9]."
    )
    return {
        "method": "Regex",
        "target": "station_code",
        "input": input_str,
        "pattern": STATION_REGEX_PATTERN,
        "valid": matched,
        "reason": reason,
    }


def validate_incident_regex(input_str: str) -> dict:
    if not isinstance(input_str, str):
        input_str = ""
    matched = bool(_INCIDENT_RE.match(input_str)) and ("\n" not in input_str)
    reason = (
        f"Matched regular expression {INCIDENT_REGEX_PATTERN}."
        if matched
        else f"Did not match {INCIDENT_REGEX_PATTERN}. Expected prefix SIG, TRK, or ELE followed by 2 digits [0-9]."
    )
    return {
        "method": "Regex",
        "target": "incident_code",
        "input": input_str,
        "pattern": INCIDENT_REGEX_PATTERN,
        "valid": matched,
        "reason": reason,
    }


def validate_and_compare(station_code: str, incident_code: str) -> dict:
    from services.dfa_validator import validate_station_dfa, validate_incident_dfa

    s_dfa = validate_station_dfa(station_code)
    s_reg = validate_station_regex(station_code)
    i_dfa = validate_incident_dfa(incident_code)
    i_reg = validate_incident_regex(incident_code)

    station_agree = s_dfa["valid"] == s_reg["valid"]
    incident_agree = i_dfa["valid"] == i_reg["valid"]
    overall_valid = (
        s_dfa["valid"] and s_reg["valid"] and station_agree
        and i_dfa["valid"] and i_reg["valid"] and incident_agree
    )

    errors = []
    if not (s_dfa["valid"] and s_reg["valid"]):
        errors.append(f"Station Code '{station_code}': {s_dfa['reason']}")
    if not (i_dfa["valid"] and i_reg["valid"]):
        errors.append(f"Incident Code '{incident_code}': {i_dfa['reason']}")
    if not (station_agree and incident_agree):
        errors.append("Automata discrepancy detected between DFA and Regex validators.")

    return {
        "overall_valid": overall_valid,
        "station": {
            "dfa": s_dfa,
            "regex": s_reg,
            "agree": station_agree,
            "valid": s_dfa["valid"] and s_reg["valid"] and station_agree,
        },
        "incident": {
            "dfa": i_dfa,
            "regex": i_reg,
            "agree": incident_agree,
            "valid": i_dfa["valid"] and i_reg["valid"] and incident_agree,
        },
        "errors": errors,
    }
