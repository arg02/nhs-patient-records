#!/usr/bin/env python3
"""Local dev server with caching disabled so edits always show on refresh.

Auth routes (/__logout, /__activity, /__auth) are handled by Firebase siteGate in production.
Locally they are harmless no-ops so nav “Sign out” and stale bookmarks do not 404.

POST /__edit (localhost only) writes on-page text edits from js/page-edit.js back into the HTML file.
"""
import json
import os
import re
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

ROOT = os.path.dirname(os.path.abspath(__file__))
LOCAL_CLIENTS = {"127.0.0.1", "::1", "::ffff:127.0.0.1"}


def flexible_pattern(fragment):
    """Regex for an HTML fragment that tolerates differences in whitespace/indentation."""
    tokens = fragment.strip().split()
    return re.compile(r"\s+".join(re.escape(t) for t in tokens))


def apply_edits(source, edits):
    applied, failed = 0, []
    for i, edit in enumerate(edits):
        matches = list(flexible_pattern(edit["from"]).finditer(source))
        n = int(edit.get("n", 0))
        if n >= len(matches):
            failed.append({"index": i, "found": len(matches)})
            continue
        m = matches[n]
        source = source[: m.start()] + edit["to"].strip() + source[m.end():]
        applied += 1
    return source, applied, failed


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/__logout":
            self.send_response(303)
            self.send_header("Location", "/")
            self.end_headers()
            return
        if path in ("/__activity", "/__auth"):
            self.send_response(204)
            self.end_headers()
            return
        super().do_GET()

    def do_POST(self):
        path = urlparse(self.path).path
        if path in ("/__activity", "/__auth", "/__logout"):
            self.send_response(204)
            self.end_headers()
            return
        if path == "/__edit":
            self.handle_edit()
            return
        self.send_error(405, "Method Not Allowed")

    def send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def handle_edit(self):
        if self.client_address[0] not in LOCAL_CLIENTS:
            self.send_json(403, {"error": "Edits are only accepted from localhost"})
            return
        try:
            length = int(self.headers.get("Content-Length", 0))
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            rel = payload["path"].lstrip("/") or "index.html"
            target = os.path.realpath(os.path.join(ROOT, rel))
            if not target.endswith(".html") or os.path.dirname(target) != ROOT:
                self.send_json(400, {"error": "Only top-level .html files can be edited"})
                return
            with open(target, encoding="utf-8") as f:
                source = f.read()
            updated, applied, failed = apply_edits(source, payload["edits"])
            if applied:
                with open(target, "w", encoding="utf-8") as f:
                    f.write(updated)
            self.send_json(200, {"applied": applied, "failed": failed})
        except Exception as exc:  # noqa: BLE001 — report any failure back to the page
            self.send_json(500, {"error": str(exc)})


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    ThreadingHTTPServer(("", port), NoCacheHandler).serve_forever()
