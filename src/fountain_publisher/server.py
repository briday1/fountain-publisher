"""Loopback HTTP server for the Fountain Publisher frontend."""

from __future__ import annotations

import json
import threading
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import quote, urlsplit

from . import __version__
from .compiler import CompileOptions, analyze_source, count_pdf_pages, render_fdx, render_html, render_pdf

STATIC_ROOT = Path(__file__).resolve().with_name("web")
MAX_REQUEST_BYTES = 8 * 1024 * 1024


class FountainRequestHandler(SimpleHTTPRequestHandler):
    server_version = f"FountainPublisher/{__version__}"
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, ".mjs": "text/javascript"}

    def __init__(self, *args, directory=None, **kwargs):
        super().__init__(*args, directory=str(directory or STATIC_ROOT), **kwargs)

    def do_GET(self) -> None:  # noqa: N802
        path = urlsplit(self.path).path
        if path == "/healthz":
            return self._send_json({"status": "ok", "version": __version__})
        if path == "/api/project":
            return self._send_json(
                {
                    "source": getattr(self.server, "project_source", ""),
                    "filename": getattr(self.server, "project_filename", "Untitled.fountain"),
                }
            )
        super().do_GET()

    def do_POST(self) -> None:  # noqa: N802
        path = urlsplit(self.path).path
        if path not in {"/api/compile", "/api/render/pdf", "/api/export/fdx"}:
            self.send_error(404)
            return
        try:
            body = self._read_json()
            source = body.get("source")
            if not isinstance(source, str):
                raise ValueError("source must be a string")
            options = CompileOptions(page_size=str(body.get("pageSize", "letter")))
            if path == "/api/render/pdf":
                return self._send_bytes(render_pdf(source, options), "application/pdf")
            if path == "/api/export/fdx":
                return self._send_bytes(render_fdx(source), "application/xml; charset=utf-8")
            payload = analyze_source(source)
            physical_pages = count_pdf_pages(render_pdf(source, options))
            payload["pageCount"] = max(0, physical_pages - (1 if payload["titleFields"] else 0))
            # The live editor only needs statistics. Rendering and returning a second,
            # full copy of the screenplay on every keystroke wastes substantial memory.
            if body.get("includeHtml") is True:
                payload["html"] = render_html(source)
            return self._send_json(payload)
        except (ValueError, RuntimeError, UnicodeError) as error:
            self._send_json({"error": str(error)}, status=400)

    def _read_json(self) -> dict:
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError as error:
            raise ValueError("invalid Content-Length") from error
        if length <= 0 or length > MAX_REQUEST_BYTES:
            raise ValueError("request body is empty or too large")
        try:
            payload = json.loads(self.rfile.read(length))
        except json.JSONDecodeError as error:
            raise ValueError("invalid JSON request") from error
        if not isinstance(payload, dict):
            raise ValueError("request body must be a JSON object")
        return payload

    def _send_json(self, value: object, status: int = 200) -> None:
        self._send_bytes(
            json.dumps(value, ensure_ascii=False).encode("utf-8"),
            "application/json; charset=utf-8",
            status,
        )

    def _send_bytes(self, payload: bytes, content_type: str, status: int = 200) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(payload)

    def end_headers(self) -> None:
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Frame-Options", "SAMEORIGIN")
        self.send_header("Content-Security-Policy", "default-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; frame-src blob:")
        super().end_headers()

    def log_message(self, format: str, *args: object) -> None:
        if not getattr(self.server, "quiet", False):
            super().log_message(format, *args)


class FountainServer(ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True


def create_server(host: str = "127.0.0.1", port: int = 4173, *, quiet: bool = False) -> FountainServer:
    if not STATIC_ROOT.joinpath("index.html").is_file():
        raise RuntimeError(f"Packaged web assets are missing from {STATIC_ROOT}.")
    server = FountainServer((host, port), FountainRequestHandler)
    server.quiet = quiet
    return server


def serve(
    host: str = "127.0.0.1",
    port: int = 4173,
    *,
    source_path: Path | None = None,
    open_browser: bool = True,
    quiet: bool = False,
) -> str:
    server = create_server(host, port, quiet=quiet)
    if source_path:
        server.project_source = source_path.read_text(encoding="utf-8-sig")
        server.project_filename = source_path.name
    actual_port = server.server_address[1]
    browser_host = "127.0.0.1" if host in {"0.0.0.0", "::"} else host
    query = f"?project=1&name={quote(source_path.name)}" if source_path else ""
    url = f"http://{browser_host}:{actual_port}/{query}"
    print(f"Fountain Publisher {__version__}: {url}")
    print("Press Ctrl+C to stop.")
    if open_browser:
        threading.Timer(0.25, webbrowser.open, args=(url,)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping Fountain Publisher.")
    finally:
        server.server_close()
    return url
