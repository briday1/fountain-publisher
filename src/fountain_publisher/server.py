"""Loopback HTTP server for the Fountain Publisher frontend."""

from __future__ import annotations

import json
import sys
import threading
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import quote, unquote, urlsplit

from . import __version__
from .compiler import CompileOptions, analyze_source, count_pdf_pages, render_fdx, render_pdf, render_pdf_with_metrics

STATIC_ROOT = Path(__file__).resolve().with_name("web")
MAX_REQUEST_BYTES = 8 * 1024 * 1024
PYODIDE_RUNTIME_FILES = frozenset({
    "pyodide.mjs", "pyodide.asm.mjs", "pyodide.asm.wasm",
    "pyodide-lock.json", "python_stdlib.zip",
})
MICROPIP_WHEEL = "micropip-0.11.1-py3-none-any.whl"


def browser_runtime_asset(filename: str) -> Path | None:
    """Resolve only the pinned browser runtime, never arbitrary node_modules files."""
    if filename not in PYODIDE_RUNTIME_FILES | {MICROPIP_WHEEL}:
        return None
    roots = [STATIC_ROOT / "pyodide"]
    repository = STATIC_ROOT.parents[2]
    if ((repository / "pyproject.toml").is_file()
            and (repository / "src" / "fountain_publisher" / "web").resolve() == STATIC_ROOT.resolve()):
        roots.append(repository / "node_modules" / "pyodide")
    for root in roots:
        root = root.resolve()
        # Do not mix a partially prepared runtime with another installation.
        if not all((root / item).is_file() and (root / item).resolve().parent == root
                   for item in PYODIDE_RUNTIME_FILES):
            continue
        candidate = (root / filename).resolve()
        if candidate.parent == root and candidate.is_file():
            return candidate
        if filename == MICROPIP_WHEEL:
            vendor = (STATIC_ROOT / "vendor").resolve()
            candidate = (vendor / filename).resolve()
            if candidate.parent == vendor and candidate.is_file():
                return candidate
    return None


class FountainRequestHandler(SimpleHTTPRequestHandler):
    server_version = f"FountainPublisher/{__version__}"
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".mjs": "text/javascript",
        ".wasm": "application/wasm",
        ".whl": "application/octet-stream",
    }

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

    def send_head(self):
        path = unquote(urlsplit(self.path).path)
        if "pyodide" not in path.split("/"):
            return super().send_head()
        asset = browser_runtime_asset(path.removeprefix("/pyodide/"))
        if asset is None:
            self.send_error(404, "Browser runtime asset unavailable; run npm ci in the source checkout or install a runtime-prepared desktop package")
            return None
        try:
            stream = asset.open("rb")
        except OSError:
            self.send_error(404, "Browser runtime asset unavailable")
            return None
        self.send_response(200)
        self.send_header("Content-Type", self.guess_type(str(asset)))
        self.send_header("Content-Length", str(asset.stat().st_size))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        return stream

    def do_POST(self) -> None:  # noqa: N802
        path = urlsplit(self.path).path
        if path not in {"/api/compile", "/api/render/pdf", "/api/export/fdx", "/api/import/pdf"}:
            self.send_error(404)
            return
        try:
            if path == "/api/import/pdf":
                return self._import_pdf()
            body = self._read_json()
            source = body.get("source")
            if not isinstance(source, str):
                raise ValueError("source must be a string")
            options = CompileOptions(
                page_size=str(body.get("pageSize", "letter")),
                scene_numbers=str(body.get("sceneNumbers", "margin")),
                scene_number_format=str(body.get("sceneNumberFormat", "sequential")),
            )
            if path == "/api/render/pdf":
                return self._send_bytes(render_pdf(source, options), "application/pdf")
            if path == "/api/export/fdx":
                return self._send_bytes(render_fdx(source, options), "application/xml; charset=utf-8")
            payload = analyze_source(source)
            pdf_payload, last_page_eighths = render_pdf_with_metrics(source, options)
            physical_pages = count_pdf_pages(pdf_payload)
            screenplay_pages = max(0, physical_pages - (1 if payload["titleFields"] else 0))
            payload["pageCount"] = screenplay_pages
            payload["lastPageEighths"] = last_page_eighths
            payload["estimatedSeconds"] = screenplay_pages * 60
            return self._send_json(payload)
        except Exception as error:
            self._send_json({"error": str(error)}, status=400)

    def _import_pdf(self) -> None:
        from io import BytesIO

        try:
            from pypdf import PdfReader
        except ModuleNotFoundError:
            bundled_wheel = STATIC_ROOT / "vendor" / "pypdf-6.17.0-py3-none-any.whl"
            if not bundled_wheel.is_file():
                raise RuntimeError("PDF import support is not installed") from None
            sys.path.insert(0, str(bundled_wheel))
            from pypdf import PdfReader

        payload = self._read_bytes()
        reader = PdfReader(BytesIO(payload))
        pages = []
        for page in reader.pages:
            try:
                text = page.extract_text(extraction_mode="layout") or ""
            except Exception:
                text = page.extract_text() or ""
            pages.append(text)
        self._send_json({"pages": pages})

    def _read_bytes(self) -> bytes:
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError as error:
            raise ValueError("invalid Content-Length") from error
        if length <= 0 or length > MAX_REQUEST_BYTES:
            raise ValueError("PDF is empty or larger than 8 MB")
        return self.rfile.read(length)

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
        self.send_header("Content-Security-Policy", "default-src 'self' blob:; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; frame-src blob:")
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
