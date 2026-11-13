from flask import Blueprint, request, jsonify
from services import handlers_service as svc

api_bp = Blueprint("api", __name__, url_prefix="/api")


@api_bp.route("/health", methods=["GET"])
def health():
    code, body = svc.handle_health()
    return jsonify(body), code


@api_bp.route("/validate", methods=["POST"])
def api_validate():
    code, body = svc.handle_validate(request.get_json(silent=True) or {})
    return jsonify(body), code


@api_bp.route("/classify", methods=["POST"])
def api_classify():
    code, body = svc.handle_classify(request.get_json(silent=True) or {})
    return jsonify(body), code


@api_bp.route("/reports", methods=["POST"])
def api_submit_report():
    code, body = svc.handle_submit_report(request.get_json(silent=True) or {})
    return jsonify(body), code


@api_bp.route("/dispatch", methods=["POST"])
def api_dispatch():
    code, body = svc.handle_dispatch(request.get_json(silent=True) or {})
    return jsonify(body), code


@api_bp.route("/dispatch/process-queue", methods=["POST"])
def api_process_queue():
    code, body = svc.handle_process_queue()
    return jsonify(body), code


@api_bp.route("/reports", methods=["GET"])
def api_get_reports():
    code, body = svc.handle_get_reports(request.args)
    return jsonify(body), code


@api_bp.route("/reports/<report_id>", methods=["GET"])
def api_get_report_detail(report_id: str):
    code, body = svc.handle_get_report_detail(report_id)
    return jsonify(body), code


@api_bp.route("/reports/<report_id>/status", methods=["PATCH"])
def api_update_report_status(report_id: str):
    code, body = svc.handle_update_report_status(report_id, request.get_json(silent=True) or {})
    return jsonify(body), code


@api_bp.route("/handlers", methods=["GET"])
def api_get_handlers():
    code, body = svc.handle_get_handlers()
    return jsonify(body), code


@api_bp.route("/handlers", methods=["POST"])
def api_add_handler():
    code, body = svc.handle_add_handler(request.get_json(silent=True) or {})
    return jsonify(body), code


@api_bp.route("/handlers/<int:handler_id>", methods=["PATCH"])
def api_update_handler(handler_id: int):
    code, body = svc.handle_update_handler(handler_id, request.get_json(silent=True) or {})
    return jsonify(body), code


@api_bp.route("/routing", methods=["GET"])
def api_get_routing():
    code, body = svc.handle_get_routing()
    return jsonify(body), code


@api_bp.route("/routing/<int:rule_id>", methods=["PATCH"])
def api_update_routing_rule(rule_id: int):
    code, body = svc.handle_update_routing_rule(rule_id, request.get_json(silent=True) or {})
    return jsonify(body), code


@api_bp.route("/escalations", methods=["GET"])
def api_get_escalations():
    code, body = svc.handle_get_escalations()
    return jsonify(body), code


@api_bp.route("/analytics", methods=["GET"])
def api_get_analytics():
    code, body = svc.handle_get_analytics()
    return jsonify(body), code


@api_bp.route("/demo/reset", methods=["POST"])
def api_demo_reset():
    code, body = svc.handle_demo_reset()
    return jsonify(body), code
