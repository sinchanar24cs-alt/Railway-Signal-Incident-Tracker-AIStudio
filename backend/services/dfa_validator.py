"""
BCS503 - Automata Theory & Computability
Deterministic Finite Automaton (DFA) implementations for:
1. Station Code: [A-Z]{3}[0-9]{2}
2. Incident Code: (SIG|TRK|ELE)[0-9]{2}
"""

STATION_DFA_DEFINITION = {
    "name": "Station Code DFA",
    "pattern_description": "[A-Z]{3}[0-9]{2}",
    "states": ["q0", "q1", "q2", "q3", "q4", "q5", "q_dead"],
    "alphabet": ["A-Z", "0-9"],
    "initial_state": "q0",
    "accepting_states": ["q5"],
    "transitions": [
        {"from": "q0", "symbol": "A-Z", "to": "q1"},
        {"from": "q1", "symbol": "A-Z", "to": "q2"},
        {"from": "q2", "symbol": "A-Z", "to": "q3"},
        {"from": "q3", "symbol": "0-9", "to": "q4"},
        {"from": "q4", "symbol": "0-9", "to": "q5"},
    ],
}

INCIDENT_DFA_DEFINITION = {
    "name": "Incident Code DFA",
    "pattern_description": "(SIG|TRK|ELE)[0-9]{2}",
    "states": [
        "q0",
        "qS1", "qS2",
        "qT1", "qT2",
        "qE1", "qE2",
        "qP", "qD1", "qAccept", "q_dead",
    ],
    "alphabet": ["S", "I", "G", "T", "R", "K", "E", "L", "0-9"],
    "initial_state": "q0",
    "accepting_states": ["qAccept"],
    "transitions": [
        {"from": "q0", "symbol": "S", "to": "qS1"},
        {"from": "qS1", "symbol": "I", "to": "qS2"},
        {"from": "qS2", "symbol": "G", "to": "qP"},
        {"from": "q0", "symbol": "T", "to": "qT1"},
        {"from": "qT1", "symbol": "R", "to": "qT2"},
        {"from": "qT2", "symbol": "K", "to": "qP"},
        {"from": "q0", "symbol": "E", "to": "qE1"},
        {"from": "qE1", "symbol": "L", "to": "qE2"},
        {"from": "qE2", "symbol": "E", "to": "qP"},
        {"from": "qP", "symbol": "0-9", "to": "qD1"},
        {"from": "qD1", "symbol": "0-9", "to": "qAccept"},
    ],
}


def _is_upper_ascii(ch: str) -> bool:
    return len(ch) == 1 and "A" <= ch <= "Z"


def _is_digit_ascii(ch: str) -> bool:
    return len(ch) == 1 and "0" <= ch <= "9"


def validate_station_dfa(input_str: str) -> dict:
    if not isinstance(input_str, str):
        input_str = ""

    current_state = "q0"
    accepting_states = {"q5"}
    steps = []

    for idx, ch in enumerate(input_str):
        prev_state = current_state
        if current_state == "q0":
            next_state = "q1" if _is_upper_ascii(ch) else "q_dead"
        elif current_state == "q1":
            next_state = "q2" if _is_upper_ascii(ch) else "q_dead"
        elif current_state == "q2":
            next_state = "q3" if _is_upper_ascii(ch) else "q_dead"
        elif current_state == "q3":
            next_state = "q4" if _is_digit_ascii(ch) else "q_dead"
        elif current_state == "q4":
            next_state = "q5" if _is_digit_ascii(ch) else "q_dead"
        else:
            next_state = "q_dead"

        steps.append({
            "step": idx + 1,
            "input_char": ch,
            "from_state": prev_state,
            "to_state": next_state,
            "transition_valid": next_state != "q_dead",
        })
        current_state = next_state

    accepted = current_state in accepting_states
    if accepted:
        reason = "Accepted: Reached accepting state q5 after 3 uppercase letters [A-Z] and 2 digits [0-9]."
    elif input_str == "":
        reason = "Rejected: Empty input remained in initial state q0."
    elif current_state == "q_dead":
        reason = "Rejected: Transition entered dead state q_dead due to invalid character or excessive length."
    else:
        reason = f"Rejected: Incomplete input terminated in non-accepting state {current_state} (expected q5)."

    return {
        "method": "DFA",
        "target": "station_code",
        "input": input_str,
        "valid": accepted,
        "initial_state": "q0",
        "final_state": current_state,
        "accepting_states": list(accepting_states),
        "steps": steps,
        "reason": reason,
        "definition": STATION_DFA_DEFINITION,
    }


def validate_incident_dfa(input_str: str) -> dict:
    if not isinstance(input_str, str):
        input_str = ""

    current_state = "q0"
    accepting_states = {"qAccept"}
    steps = []

    transition_map = {
        ("q0", "S"): "qS1",
        ("qS1", "I"): "qS2",
        ("qS2", "G"): "qP",
        ("q0", "T"): "qT1",
        ("qT1", "R"): "qT2",
        ("qT2", "K"): "qP",
        ("q0", "E"): "qE1",
        ("qE1", "L"): "qE2",
        ("qE2", "E"): "qP",
    }

    for idx, ch in enumerate(input_str):
        prev_state = current_state
        if (current_state, ch) in transition_map:
            next_state = transition_map[(current_state, ch)]
        elif current_state == "qP" and _is_digit_ascii(ch):
            next_state = "qD1"
        elif current_state == "qD1" and _is_digit_ascii(ch):
            next_state = "qAccept"
        else:
            next_state = "q_dead"

        steps.append({
            "step": idx + 1,
            "input_char": ch,
            "from_state": prev_state,
            "to_state": next_state,
            "transition_valid": next_state != "q_dead",
        })
        current_state = next_state

    accepted = current_state in accepting_states
    if accepted:
        reason = "Accepted: Reached accepting state qAccept with valid prefix (SIG|TRK|ELE) and 2 digits."
    elif input_str == "":
        reason = "Rejected: Empty input remained in initial state q0."
    elif current_state == "q_dead":
        reason = "Rejected: Transition entered dead state q_dead due to unsupported prefix, invalid character, or excessive length."
    else:
        reason = f"Rejected: Incomplete input terminated in non-accepting state {current_state} (expected qAccept)."

    return {
        "method": "DFA",
        "target": "incident_code",
        "input": input_str,
        "valid": accepted,
        "initial_state": "q0",
        "final_state": current_state,
        "accepting_states": list(accepting_states),
        "steps": steps,
        "reason": reason,
        "definition": INCIDENT_DFA_DEFINITION,
    }
