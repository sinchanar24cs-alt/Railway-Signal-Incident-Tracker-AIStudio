import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATABASE_DIR = os.path.join(BASE_DIR, "database")
DATABASE_PATH = os.environ.get(
    "RSIT_DB_PATH", os.path.join(DATABASE_DIR, "railway_incidents.db")
)

CORS_ORIGINS = os.environ.get(
    "RSIT_CORS_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173",
).split(",")

VALID_STATUSES = ("Pending", "Assigned", "In Progress", "Resolved")
VALID_URGENCIES = ("Low", "Medium", "High", "Critical")

CLASSIFICATION_CATEGORIES = (
    "Signal-Failure",
    "Track-Obstruction",
    "Electrical",
    "Minor-Delay",
    "Test-Entry",
)

# Deterministic safety-first conflict resolution order (index 0 = highest priority)
CLASSIFICATION_PRIORITY_ORDER = [
    "Signal-Failure",
    "Track-Obstruction",
    "Electrical",
    "Minor-Delay",
    "Test-Entry",
]

FALLBACK_ZONE_CODE = "ZONE-FALLBACK"
FALLBACK_DIVISION_CODE = "DIV-FALLBACK"
