"""
Local survey server.

Runs a tiny HTTP server that:
  • Serves the static study site (index.html, survey.html, app.js, etc.)
  • Serves the stimuli/ folder (your HTML + CSS files)
  • Receives POST submissions at /submit and appends them to responses/responses.csv

USAGE:
    python server.py
    # then open http://localhost:8000

REQUIREMENTS:
    Python 3.7+ (standard library only — no pip install needed)

To use fake Prolific params for testing:
    http://localhost:8000/?PROLIFIC_PID=TEST123&STUDY_ID=S1&SESSION_ID=X1
"""

import csv
import json
import os
import sys
from datetime import datetime
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from threading import Lock

PORT = int(os.environ.get("PORT", 8000))
ROOT = Path(__file__).parent.resolve()
RESPONSES_DIR = ROOT / "responses"
RESPONSES_CSV = RESPONSES_DIR / "responses.csv"
CONFIG_PATH = ROOT / "config.json"

# Columns saved to CSV — keep in sync with question IDs in config.json
FIELDS = [
    "timestamp_iso",
    "prolific_pid",
    "study_id",
    "session_id",
    "pair_index",
    "pair_id",
    "product_id",
    "about_id",
    "source_product_url",
    "source_about_url",
    "time_on_pair_seconds",
    "q1_magical_claims",
    "q2_product_type",
    "q3_price",
    "q4_magic_terms",
    "q5_magic_degree",
    "q6_engagement",
    "q7_promised_outcome",
    "q8_demographic",
    "q9_evidence",
    "q10_notes",
]

write_lock = Lock()


def ensure_csv():
    """Create responses.csv with header row if it doesn't exist."""
    RESPONSES_DIR.mkdir(exist_ok=True)
    if not RESPONSES_CSV.exists():
        with open(RESPONSES_CSV, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(FIELDS)


class StudyHandler(SimpleHTTPRequestHandler):
    """Serves files from ROOT and handles POST /submit."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    # Suppress the noisy default logging; keep just our submission log
    def log_message(self, format, *args):
        if "/submit" in (args[0] if args else "") or self.path == "/submit":
            sys.stderr.write("%s - %s\n" % (self.address_string(), format % args))

    def do_POST(self):
        if self.path != "/submit":
            self.send_error(404, "Not found")
            return

        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length).decode("utf-8")

        try:
            record = json.loads(raw)
        except json.JSONDecodeError as e:
            self.send_response(400)
            self._cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({"ok": False, "error": str(e)}).encode())
            return

        row = [record.get(f, "") for f in FIELDS]

        with write_lock:
            with open(RESPONSES_CSV, "a", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                writer.writerow(row)

        pid = record.get("prolific_pid", "?")
        idx = record.get("pair_index", "?")
        print(f"  ✓ saved row: pid={pid} pair={idx}")

        self.send_response(200)
        self._cors_headers()
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"ok": True}).encode())

    def do_OPTIONS(self):
        # CORS preflight — not needed when served from same origin, but harmless
        self.send_response(204)
        self._cors_headers()
        self.end_headers()

    def _cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def end_headers(self):
        # Disable caching so config.json edits show up immediately
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        super().end_headers()


def patch_config_for_local():
    """Ensure config.json points to the local /submit endpoint."""
    if not CONFIG_PATH.exists():
        print("⚠ config.json not found — skipping endpoint patch")
        return
    with open(CONFIG_PATH, encoding="utf-8") as f:
        config = json.load(f)
    desired = "/submit"
    if config.get("sheets_endpoint") != desired:
        config["sheets_endpoint"] = desired
        with open(CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(config, f, indent=2)
        print(f"✓ Patched config.json: sheets_endpoint → {desired}")


def main():
    ensure_csv()
    patch_config_for_local()

    server = HTTPServer(("0.0.0.0", PORT), StudyHandler)
    url = f"http://localhost:{PORT}"
    print("=" * 60)
    print(f"  Study server running at: {url}")
    print(f"  Responses will be saved to: {RESPONSES_CSV.relative_to(ROOT)}")
    print(f"  Stop the server with Ctrl+C")
    print("=" * 60)
    print(f"\n  For quick testing, open:")
    print(f"    {url}/?PROLIFIC_PID=TEST123&STUDY_ID=S1&SESSION_ID=X1\n")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")


if __name__ == "__main__":
    main()
