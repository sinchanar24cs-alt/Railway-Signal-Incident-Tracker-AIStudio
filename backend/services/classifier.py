"""
BCS503 - Classification Engine
Classifies validated incident codes + descriptions into exactly five categories:
1. Signal-Failure
2. Track-Obstruction
3. Electrical
4. Minor-Delay
5. Test-Entry
"""

import re
import config

CLASSIFICATION_RULES = [
    {
        "category": "Signal-Failure",
        "code_regex": re.compile(r"^SIG(0[1-9]|[1-4][0-9])$"),
        "keywords": ["signal", "aspect", "interlocking", "relay", "red lamp", "point failure", "repeater"],
        "rule_label": "Code SIG01-SIG49 or Signal keyword match",
    },
    {
        "category": "Track-Obstruction",
        "code_regex": re.compile(r"^TRK(0[1-9]|[1-4][0-9])$"),
        "keywords": ["track", "obstruction", "derail", "boulder", "rail fracture", "debris", "turnout", "obstacle"],
        "rule_label": "Code TRK01-TRK49 or Track Obstruction keyword match",
    },
    {
        "category": "Electrical",
        "code_regex": re.compile(r"^ELE(0[1-9]|[1-4][0-9])$"),
        "keywords": ["electrical", "ohe", "catenary", "power", "voltage", "short circuit", "transformer", "insulator"],
        "rule_label": "Code ELE01-ELE49 or Electrical keyword match",
    },
    {
        "category": "Minor-Delay",
        "code_regex": re.compile(r"^(SIG|TRK|ELE)(5[0-9])$"),
        "keywords": ["minor", "delay", "slow", "caution", "lag", "flicker"],
        "rule_label": "Code *50-*59 or Minor-Delay keyword match",
    },
    {
        "category": "Test-Entry",
        "code_regex": re.compile(r"^(SIG|TRK|ELE)(9[0-9])$"),
        "keywords": ["test", "drill", "mock", "calibration", "trial", "simulation"],
        "rule_label": "Code *90-*99 or Test-Entry keyword match",
    },
]

UNMAPPED_CODE_REGEX = re.compile(r"^(SIG|TRK|ELE)(00|[6-8][0-9])$")


def classify_incident(incident_code: str, description: str = "") -> dict:
    code = (incident_code or "").strip()
    desc_lower = (description or "").lower()

    if UNMAPPED_CODE_REGEX.match(code):
        return {
            "classified": False,
            "category": None,
            "matched_patterns": [],
            "conflict_detected": False,
            "priority_rule_applied": "Reject Unmapped Code",
            "reason": (
                f"Incident code '{code}' uses an unmapped numeric range (00 or 60-89). "
                "Mapped ranges: 01-49 (Primary Category), 50-59 (Minor-Delay), 90-99 (Test-Entry)."
            ),
        }

    matched_patterns = []

    for rule in CLASSIFICATION_RULES:
        code_hit = bool(rule["code_regex"].match(code))
        keyword_hits = [
            kw for kw in rule["keywords"]
            if re.search(rf"\b{re.escape(kw)}\b", desc_lower)
        ]

        if code_hit or keyword_hits:
            matched_patterns.append({
                "category": rule["category"],
                "matched_by_code": code_hit,
                "matched_keywords": keyword_hits,
                "rule_label": rule["rule_label"],
                "priority_rank": config.CLASSIFICATION_PRIORITY_ORDER.index(rule["category"]) + 1,
            })

    if not matched_patterns:
        return {
            "classified": False,
            "category": None,
            "matched_patterns": [],
            "conflict_detected": False,
            "priority_rule_applied": "No Match Found",
            "reason": f"Incident code '{code}' and description did not match any known classification pattern.",
        }

    matched_patterns.sort(
        key=lambda m: (
            0 if m["matched_by_code"] else 1,
            config.CLASSIFICATION_PRIORITY_ORDER.index(m["category"]),
        )
    )
    selected = matched_patterns[0]
    conflict_detected = len(matched_patterns) > 1

    if conflict_detected:
        matched_names = ", ".join(m["category"] for m in matched_patterns)
        priority_rule = (
            "Explicit Code-Range Match > Safety-First Deterministic Precedence "
            f"({' > '.join(config.CLASSIFICATION_PRIORITY_ORDER)})"
        )
        reason = (
            f"Multiple classification patterns matched [{matched_names}]. "
            f"Applied deterministic priority rule to select '{selected['category']}' (Rank #{selected['priority_rank']})."
        )
    else:
        priority_rule = "Single Unambiguous Pattern Match"
        reason = f"Unambiguously classified as '{selected['category']}' via {selected['rule_label']}."

    return {
        "classified": True,
        "category": selected["category"],
        "matched_patterns": matched_patterns,
        "conflict_detected": conflict_detected,
        "priority_rule_applied": priority_rule,
        "reason": reason,
    }
