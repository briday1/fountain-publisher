"""Command-line interface for Fountain Publisher."""

from __future__ import annotations

import argparse
from pathlib import Path

from . import __version__
from .compiler import CompileOptions, render_fdx, render_html, render_pdf
from .server import serve


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="fountain-publisher",
        description="Open the Fountain editor or compile a screenplay.",
    )
    parser.add_argument("input", nargs="?", type=Path, help="Fountain file to open or compile.")
    parser.add_argument("-o", "--output", type=Path, help="Output path. Providing it enables headless compilation.")
    parser.add_argument("--format", choices=("pdf", "html", "fdx"), default="pdf", help="Headless output format (default: pdf).")
    parser.add_argument("--page-size", choices=("letter", "a4"), default="letter", help="PDF paper size (default: letter).")
    parser.add_argument("--host", default="127.0.0.1", help="Interface to bind (default: 127.0.0.1).")
    parser.add_argument("--port", default=4173, type=int, help="Port to bind; use 0 for any available port.")
    parser.add_argument("--no-browser", action="store_true", help="Do not open the editor in a browser.")
    parser.add_argument("--quiet", action="store_true", help="Suppress HTTP request logs.")
    parser.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    return parser


def _compile(input_path: Path, output: Path, output_format: str, page_size: str) -> None:
    source = input_path.read_text(encoding="utf-8-sig")
    if output_format == "pdf":
        data = render_pdf(source, CompileOptions(page_size=page_size))
    elif output_format == "fdx":
        data = render_fdx(source)
    else:
        data = render_html(source).encode("utf-8")
    output.write_bytes(data)


def main(argv: list[str] | None = None) -> None:
    args = build_parser().parse_args(argv)
    if args.output:
        if not args.input:
            raise SystemExit("--output requires an input Fountain file")
        try:
            _compile(args.input, args.output, args.format, args.page_size)
        except (OSError, RuntimeError, ValueError) as error:
            raise SystemExit(f"error: {error}") from error
        print(f"Wrote {args.output}")
        return
    serve(
        args.host,
        args.port,
        source_path=args.input,
        open_browser=not args.no_browser,
        quiet=args.quiet,
    )


if __name__ == "__main__":
    main()
