"""
Railway Signal Incident Tracker - Python Backend Entry Point
Uses Flask + Flask-CORS when installed; falls back to Python stdlib ThreadingHTTPServer
in restricted environments without pip packages while running the exact same services & SQLite DB.
"""

import json
import os
import sys
import re
from urllib.parse import urlparse, parse_qs, unquote

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from seed_data import seed_database
from services import handlers_service as svc
from tests.test_suite import run_all_tests


def run_flask_app():
    from flask import Flask
    from flask_cors import CORS
    import config
    from routes.api_routes import api_bp
    from routes.test_routes import test_bp

    app = Flask(__name__)
    CORS(app, resources={r"/api/*": {"origins": config.CORS_ORIGINS}})
    seed_database(reset=False)
    app.register_blueprint(api_bp)
    app.register_blueprint(test_bp)
    port = int(os.environ.get("RSIT_BACKEND_PORT", "5000"))
    app.run(host="127.0.0.1", port=port, debug=False)


def run_stdlib_server():
    from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

    seed_database(reset=False)

    class Handler(BaseHTTPRequestHandler):
        def _send_json(self, status_code: int, payload: dict):
            body = json.dumps(payload).encode("utf-8")
            self.send_response(status_code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.end_headers()
            self.wfile.write(body)

        def _read_json(self) -> dict:
            length = int(self.headers.get("Content-Length", "0") or "0")
            if length == 0:
                return {}
            raw = self.rfile.read(length).decode("utf-8")
            try:
                return json.loads(raw)
            except Exception:
                return {}

        def log_message(self, format, *args):
            pass

        def do_OPTIONS(self):
            self._send_json(200, {"ok": True})

        def do_GET(self):
            parsed = urlparse(self.path)
            path = parsed.path
            qs = {k: v[0] for k, v in parse_qs(parsed.query).items()}

            if path == "/api/health":
                return self._send_json(*svc.handle_health())
            if path == "/api/reports":
                return self._send_json(*svc.handle_get_reports(qs))
            m = re.match(r"^/api/reports/([^/]+)$", path)
            if m:
                return self._send_json(*svc.handle_get_report_detail(unquote(m.group(1))))
            if path == "/api/handlers":
                return self._send_json(*svc.handle_get_handlers())
            if path == "/api/routing":
                return self._send_json(*svc.handle_get_routing())
            if path == "/api/escalations":
                return self._send_json(*svc.handle_get_escalations())
            if path == "/api/analytics":
                return self._send_json(*svc.handle_get_analytics())
            if path == "/api/tests/run":
                return self._send_json(200, run_all_tests())
            return self._send_json(404, {"error": f"Not found: {path}"})

        def do_POST(self):
            path = urlparse(self.path).path
            data = self._read_json()

            if path == "/api/validate":
                return self._send_json(*svc.handle_validate(data))
            if path == "/api/classify":
                return self._send_json(*svc.handle_classify(data))
            if path == "/api/reports":
                return self._send_json(*svc.handle_submit_report(data))
            if path == "/api/dispatch":
                return self._send_json(*svc.handle_dispatch(data))
            if path == "/api/dispatch/process-queue":
                return self._send_json(*svc.handle_process_queue())
            if path == "/api/handlers":
                return self._send_json(*svc.handle_add_handler(data))
            if path == "/api/tests/run":
                return self._send_json(200, run_all_tests())
            if path == "/api/demo/reset":
                return self._send_json(*svc.handle_demo_reset())
            return self._send_json(404, {"error": f"Not found: {path}"})

        def do_PATCH(self):
            path = urlparse(self.path).path
            data = self._read_json()

            m_rep = re.match(r"^/api/reports/([^/]+)/status$", path)
            if m_rep:
                return self._send_json(*svc.handle_update_report_status(unquote(m_rep.group(1)), data))
            m_hnd = re.match(r"^/api/handlers/(\d+)$", path)
            if m_hnd:
                return self._send_json(*svc.handle_update_handler(int(m_hnd.group(1)), data))
            m_rt = re.match(r"^/api/routing/(\d+)$", path)
            if m_rt:
                return self._send_json(*svc.handle_update_routing_rule(int(m_rt.group(1)), data))
            return self._send_json(404, {"error": f"Not found: {path}"})

    port = int(os.environ.get("RSIT_BACKEND_PORT", "5000"))
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"Python backend listening on http://127.0.0.1:{port} (stdlib HTTP mode)")
    server.serve_forever()


if __name__ == "__main__":
    try:
        import flask  # noqa: F401
        import flask_cors  # noqa: F401
        run_flask_app()
    except ImportError:
        run_stdlib_server()
