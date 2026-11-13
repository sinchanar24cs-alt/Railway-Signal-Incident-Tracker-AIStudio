from flask import Blueprint, jsonify
from tests.test_suite import run_all_tests

test_bp = Blueprint("tests", __name__, url_prefix="/api/tests")


@test_bp.route("/run", methods=["POST", "GET"])
def api_run_tests():
    results = run_all_tests()
    return jsonify(results), 200
