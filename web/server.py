import http.server
import socketserver
import os
import sys
import json
from pathlib import Path

WEB_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = WEB_DIR.parent / "AdaptiveGuard-Scheduler"
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

PORT = 8080

class AdaptiveGuardHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB_DIR), **kwargs)

    def end_headers(self):
        # Enable CORS and disable aggressive caching for local dev
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        if self.path == "/api/status":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            status_obj = {
                "status": "online",
                "project": "AdaptiveGuard",
                "framework": "Mixed-Criticality Scheduling Simulation",
                "python_version": sys.version,
            }
            self.wfile.write(json.dumps(status_obj).encode("utf-8"))
            return
        return super().do_GET()

def start_server(port=PORT):
    for p in range(port, port + 20):
        try:
            with socketserver.TCPServer(("", p), AdaptiveGuardHandler) as httpd:
                print(f"============================================================")
                print(f" AdaptiveGuard Simulation Platform Web Server Running")
                print(f" URL: http://localhost:{p}")
                print(f" Serving Directory: {WEB_DIR}")
                print(f" Press Ctrl+C to terminate server")
                print(f"============================================================")
                httpd.serve_forever()
                break
        except OSError:
            print(f"Port {p} occupied, testing port {p+1}...")

if __name__ == "__main__":
    start_server()
