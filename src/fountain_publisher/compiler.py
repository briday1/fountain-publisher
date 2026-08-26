"""Canonical Fountain compilation and editor metadata."""

from __future__ import annotations

import io
import re
from collections import defaultdict
from dataclasses import dataclass
from typing import Any

SCENE_RE = re.compile(r"^(?:\.|(?:INT|EXT|EST|INT\.?/EXT\.?|I/E)[ .]).+", re.IGNORECASE)
CHARACTER_RE = re.compile(r"^@?([A-Z][A-Z0-9 ._'\-]*(?:\s*\([^)]*\))?)(\^)?$")
TITLE_RE = re.compile(r"^([A-Za-z][A-Za-z ]+):\s*(.*)$")
TITLE_KEYS = {"title", "credit", "author", "authors", "source", "draft date", "date", "contact", "copyright", "notes"}
SECTION_RE = re.compile(r"^(#{1,6})\s+(.+)$")
SCENE_NUMBER_RE = re.compile(r"\s+#([^#]+)#\s*$")
CHARACTER_EXTENSION_RE = re.compile(r"\s*\([^)]*\)\s*$")


@dataclass(frozen=True)
class CompileOptions:
    page_size: str = "letter"
    bold_scene_headings: bool = True


def _screenplain() -> tuple[Any, Any, Any, Any]:
    try:
        from screenplain.export import fdx, html, pdf
        from screenplain.parsers.fountain import parse
    except ImportError as error:  # pragma: no cover - exercised by packaging failures
        raise RuntimeError(
            "Screenplain is not installed. Run: python -m pip install -e ."
        ) from error
    return parse, html, pdf, fdx


def parse_screenplay(source: str) -> Any:
    parse, _, _, _ = _screenplain()
    return parse(io.StringIO(source))


def number_screenplay_scenes(screenplay: Any) -> Any:
    """Prefix scene headings in render order without changing Fountain source."""
    try:
        from screenplain.richstring import plain
        from screenplain.types import Slug
    except ImportError:  # pragma: no cover
        return screenplay
    number = 0
    for paragraph in getattr(screenplay, "paragraphs", ()):
        if isinstance(paragraph, Slug):
            number += 1
            paragraph.line = plain(f"{number}. ") + paragraph.line
            paragraph.scene_number = None
    return screenplay


def render_html(source: str) -> str:
    screenplay = number_screenplay_scenes(parse_screenplay(source))
    _, html, _, _ = _screenplain()
    output = io.StringIO()
    html.convert(screenplay, output, bare=True)
    return output.getvalue()


def render_pdf(source: str, options: CompileOptions | None = None) -> bytes:
    screenplay = number_screenplay_scenes(parse_screenplay(source))
    _, _, pdf, _ = _screenplain()
    options = options or CompileOptions()
    try:
        from reportlab.lib.pagesizes import A4, letter
    except ImportError as error:  # pragma: no cover
        raise RuntimeError("ReportLab is required for PDF export.") from error
    settings = pdf.Settings(
        page_size=A4 if options.page_size.lower() == "a4" else letter,
        # Screenplain's strong slugs wrap headings in both <b> and <u>.
        # Keep it disabled and use slug_style for bold so headings are not underlined.
        strong_slugs=False,
    )
    if hasattr(settings, "slug_style"):
        settings.slug_style.fontName = "Courier-Bold" if options.bold_scene_headings else "Courier"
    # Screenplain's default doubles title text to 24pt. Keep title pages in
    # restrained screenplay typography instead of turning the title into a poster.
    if hasattr(settings, "title_style"):
        settings.title_style.fontSize = settings.font_size
        settings.title_style.leading = settings.line_height
    # Screenplain renders credit/author/source with centered_style and the lower
    # title-page fields with default/contact styles, not title_style. Pin every
    # title-page style to the regular face so none inherit Courier-Bold.
    for style_name in ("title_style", "centered_style", "default_style", "contact_style"):
        style = getattr(settings, style_name, None)
        if style is not None:
            style.fontName = "Courier"
    output = io.BytesIO()
    pdf.to_pdf(screenplay, output, settings=settings)
    return output.getvalue()


def render_fdx(source: str) -> bytes:
    screenplay = number_screenplay_scenes(parse_screenplay(source))
    _, _, _, fdx = _screenplain()
    output = io.BytesIO()
    try:
        fdx.to_fdx(screenplay, output)
    except TypeError:
        text_output = io.StringIO()
        fdx.to_fdx(screenplay, text_output)
        return text_output.getvalue().encode("utf-8")
    value = output.getvalue()
    return value if isinstance(value, bytes) else str(value).encode("utf-8")


def analyze_source(source: str) -> dict[str, Any]:
    """Return line-aware completion and production statistics.

    Screenplain remains authoritative for HTML/PDF/FDX compilation. This scanner
    retains source positions, which Screenplain's public model intentionally omits.
    """

    lines = source.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    scenes: list[dict[str, Any]] = []
    sections: list[dict[str, Any]] = []
    title_fields: list[str] = []
    characters: dict[str, dict[str, Any]] = defaultdict(
        lambda: {"cues": 0, "lines": 0, "words": 0, "scenes": set(), "last_line": 0}
    )
    locations: set[str] = set()
    active_character: str | None = None
    current_scene = 0
    title_page = True
    in_boneyard = False
    dialogue_words = 0
    action_words = 0

    for index, raw in enumerate(lines):
        line_number = index + 1
        stripped = raw.strip()
        if "/*" in stripped:
            in_boneyard = True
        if in_boneyard:
            if "*/" in stripped:
                in_boneyard = False
            continue
        if not stripped:
            active_character = None
            if title_fields:
                title_page = False
            continue
        if stripped.startswith("[[") and stripped.endswith("]]" ):
            continue

        if title_page:
            match = TITLE_RE.match(raw)
            if match and match.group(1).strip().lower() in TITLE_KEYS:
                title_fields.append(match.group(1).strip())
                continue
            title_page = False

        section_match = SECTION_RE.match(stripped)
        if section_match:
            sections.append({"level": len(section_match.group(1)), "title": section_match.group(2), "line": line_number})
            active_character = None
            continue

        if SCENE_RE.match(stripped):
            heading = stripped[1:] if stripped.startswith(".") else stripped
            number_match = SCENE_NUMBER_RE.search(heading)
            scene_number = number_match.group(1) if number_match else str(len(scenes) + 1)
            clean_heading = SCENE_NUMBER_RE.sub("", heading).strip().upper()
            location = re.sub(r"^(?:INT|EXT|EST|INT\.?/EXT\.?|I/E)[ .]+", "", clean_heading, flags=re.IGNORECASE)
            location = re.split(r"\s+-\s+", location, maxsplit=1)[0].strip()
            if location:
                locations.add(location)
            scenes.append({"number": scene_number, "heading": clean_heading, "line": line_number, "words": 0})
            current_scene = len(scenes)
            active_character = None
            continue

        character_match = CHARACTER_RE.match(stripped)
        is_candidate = bool(character_match and len(stripped) <= 45 and not stripped.endswith("TO:"))
        if is_candidate and (index == 0 or not lines[index - 1].strip()):
            raw_name = character_match.group(1).lstrip("@").strip()
            name = CHARACTER_EXTENSION_RE.sub("", raw_name).strip()
            if name:
                active_character = name
                record = characters[name]
                record["cues"] += 1
                record["last_line"] = line_number
                if current_scene:
                    record["scenes"].add(current_scene)
            continue

        words = len(re.findall(r"\b[\w'’-]+\b", stripped))
        if active_character:
            if stripped.startswith("(") and stripped.endswith(")"):
                continue
            record = characters[active_character]
            record["lines"] += 1
            record["words"] += words
            dialogue_words += words
        else:
            action_words += words
            if scenes:
                scenes[-1]["words"] += words

    character_items = []
    for name, record in characters.items():
        seconds = round(record["words"] / 130 * 60)
        character_items.append(
            {
                "name": name,
                "cues": record["cues"],
                "lines": record["lines"],
                "words": record["words"],
                "seconds": seconds,
                "scenes": len(record["scenes"]),
                "lastLine": record["last_line"],
            }
        )
    character_items.sort(key=lambda item: (-item["words"], item["name"]))
    total_words = dialogue_words + action_words
    return {
        "lineCount": len(lines),
        "wordCount": total_words,
        "dialogueWords": dialogue_words,
        "actionWords": action_words,
        "estimatedSeconds": round(total_words / 180 * 60),
        "characters": character_items,
        "scenes": scenes,
        "sections": sections,
        "locations": sorted(locations),
        "titleFields": title_fields,
    }
