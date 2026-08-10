#!/usr/bin/env python3
"""Local dev server with caching disabled so edits always show on refresh.

Auth routes (/__logout, /__activity, /__auth) are Vercel middleware only.
Locally they are harmless no-ops so nav “Sign out” and stale bookmarks do not 404.
"""
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse


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
        self.send_error(405, "Method Not Allowed")


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    HTTPServer(("", port), NoCacheHandler).serve_forever()
