"""Canonical Fountain compilation and editor metadata."""

from __future__ import annotations

import io
import re
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any

SCENE_RE = re.compile(r"^(?:\.|(?:INT|EXT|EST|INT\.?/EXT\.?|I/E)[ .]).+", re.IGNORECASE)
CHARACTER_RE = re.compile(r"^@?([A-Z][A-Z0-9 ._'\-]*(?:\s*\([^)]*\))?)(\^)?$")
TITLE_RE = re.compile(r"^([A-Za-z][A-Za-z ]+):\s*(.*)$")
TITLE_KEYS = {"title", "credit", "author", "authors", "source", "draft date", "date", "contact", "copyright", "notes"}
SECTION_RE = re.compile(r"^(#{1,6})\s+(.+)$")
SCENE_NUMBER_RE = re.compile(r"\s+#([^#]+)#\s*$")
CHARACTER_EXTENSION_RE = re.compile(r"\s*\([^)]*\)\s*$")
COURIER_PRIME_FONT_ROOT = Path(__file__).resolve().with_name("web") / "fonts"
COURIER_PRIME_FONT_FILES = {
    "CourierPrime": "CourierPrime-Regular.ttf",
    "CourierPrime-Bold": "CourierPrime-Bold.ttf",
    "CourierPrime-Italic": "CourierPrime-Italic.ttf",
    "CourierPrime-BoldItalic": "CourierPrime-BoldItalic.ttf",
}


def _register_pdf_font_family() -> tuple[str, str, str, str, str]:
    """Register bundled screenplay fonts and return usable font names."""
    try:
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont
    except ImportError:
        return ("Courier", "Courier", "Courier-Bold", "Courier-Oblique", "Courier-BoldOblique")

    try:
        for font_name, file_name in COURIER_PRIME_FONT_FILES.items():
            font_path = COURIER_PRIME_FONT_ROOT / file_name
            if not font_path.is_file():
                raise FileNotFoundError(font_path)
            try:
                pdfmetrics.getFont(font_name)
            except KeyError:
                pdfmetrics.registerFont(TTFont(font_name, str(font_path)))
        pdfmetrics.registerFontFamily(
            "CourierPrime",
            normal="CourierPrime",
            bold="CourierPrime-Bold",
            italic="CourierPrime-Italic",
            boldItalic="CourierPrime-BoldItalic",
        )
        return ("CourierPrime", "CourierPrime", "CourierPrime-Bold", "CourierPrime-Italic", "CourierPrime-BoldItalic")
    except Exception:
        return ("Courier", "Courier", "Courier-Bold", "Courier-Oblique", "Courier-BoldOblique")


@dataclass(frozen=True)
class CompileOptions:
    page_size: str = "letter"
    bold_scene_headings: bool = True
    scene_numbers: str = "margin"  # "margin", "inline", "off"
    scene_number_format: str = "sequential"  # "sequential", "act"


def _screenplain() -> tuple[Any, Any, Any, Any]:
    try:
        from screenplain.export import fdx, html, pdf
        from screenplain.parsers.fountain import parse
    except ImportError as error:  # pragma: no cover - exercised by packaging failures
        raise RuntimeError(
            "Screenplain is not installed. Run: python -m pip install -e ."
        ) from error
    return parse, html, pdf, fdx


def _patch_scene_numbers_left_only() -> None:
    """Override SlugWithSceneNumbers to render scene numbers on the left margin only."""
    try:
        from reportlab.lib.units import inch
        from screenplain.export import pdf as sp_pdf

        def _left_only_draw(self: Any) -> None:
            self.slug_paragraph.drawOn(self.canv, 0, 0)
            canvas = self.canv
            canvas.saveState()
            canvas.setFont(self.settings.font_settings.family_name, self.settings.font_size)
            canvas.drawString(-0.75 * inch, 0, self.scene_number)
            canvas.restoreState()

        sp_pdf.SlugWithSceneNumbers.draw = _left_only_draw  # type: ignore[method-assign]
    except Exception:  # noqa: BLE001
        pass


def parse_screenplay(source: str) -> Any:
    parse, _, _, _ = _screenplain()
    source = re.sub(r"(?m)^(\s*)>(\S(?:.*\S)?)<\s*$", r"\1> \2 <", source)
    screenplay = parse(io.StringIO(source))
    try:
        from screenplain.types import PageBreak
        if screenplay.title_page and screenplay.paragraphs and isinstance(screenplay.paragraphs[0], PageBreak):
            del screenplay.paragraphs[0]
    except ImportError:  # pragma: no cover
        pass
    return screenplay


def number_screenplay_scenes(screenplay: Any, options: CompileOptions | None = None) -> Any:
    """Number scenes according to placement and format options."""
    try:
        from screenplain.richstring import plain
        from screenplain.types import Slug
    except ImportError:  # pragma: no cover
        return screenplay
    opts = options or CompileOptions()
    if opts.scene_numbers == "off":
        for paragraph in getattr(screenplay, "paragraphs", ()):
            if isinstance(paragraph, Slug):
                paragraph.scene_number = None
        return screenplay
    try:
        from screenplain.types import Section as _Section  # type: ignore[attr-defined]
    except ImportError:
        _Section = None
    act_num = 0
    act_scene_num = 0
    sequential = 0
    for paragraph in getattr(screenplay, "paragraphs", ()):
        if _Section is not None and isinstance(paragraph, _Section) and getattr(paragraph, "level", 0) == 1:
            act_num += 1
            act_scene_num = 0
        elif isinstance(paragraph, Slug):
            sequential += 1
            act_scene_num += 1
            label = (
                f"A{max(act_num, 1)}S{act_scene_num}"
                if opts.scene_number_format == "act"
                else str(sequential)
            )
            if opts.scene_numbers == "margin":
                paragraph.scene_number = plain(label)
            else:  # "inline"
                paragraph.line = plain(f"{label}. ") + paragraph.line
                paragraph.scene_number = None
    return screenplay


def render_html(source: str, options: CompileOptions | None = None) -> str:
    screenplay = number_screenplay_scenes(parse_screenplay(source), options)
    _, html, _, _ = _screenplain()
    output = io.StringIO()
    html.convert(screenplay, output, bare=True)
    return output.getvalue()


def render_pdf(source: str, options: CompileOptions | None = None) -> bytes:
    screenplay = number_screenplay_scenes(parse_screenplay(source), options)
    _, _, pdf, _ = _screenplain()
    options = options or CompileOptions()
    _patch_scene_numbers_left_only()
    font_family, regular_font, bold_font, italic_font, bold_italic_font = _register_pdf_font_family()
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
    font_settings = getattr(settings, "font_settings", None)
    if font_settings is not None:
        font_settings.family_name = font_family
        font_settings.regular = regular_font
        font_settings.bold = bold_font
        font_settings.italic = italic_font
        font_settings.bold_italic = bold_italic_font
    if hasattr(settings, "slug_style"):
        settings.slug_style.fontName = bold_font if options.bold_scene_headings else regular_font
    # Screenplain's default doubles title text to 24pt. Keep title pages in
    # restrained screenplay typography instead of turning the title into a poster.
    if hasattr(settings, "title_style"):
        settings.title_style.fontSize = settings.font_size
    # Use the screenplay face and size with a consistent blank line between
    # title-page rows. Negative after-space cancels Screenplain's extra spacer
    # before Credit, Contact, and Copyright so every interval stays identical.
    title_leading = settings.line_height * 2
    # Screenplain renders credit/author/source with centered_style and the lower
    # title-page fields with default/contact styles, not title_style. Pin every
    # title-page style to the regular face so none inherit Courier-Bold.
    for style_name in ("title_style", "centered_style", "default_style", "contact_style"):
        style = getattr(settings, style_name, None)
        if style is not None:
            style.fontName = regular_font
            style.fontSize = settings.font_size
            style.leading = title_leading
    settings.title_style.spaceAfter = -settings.line_height
    settings.default_style.spaceAfter = -settings.line_height
    settings.contact_style.spaceAfter = -settings.line_height
    output = io.BytesIO()
    class NumberedDocTemplate(pdf.DocTemplate):
        def handle_pageBegin(self) -> None:  # noqa: N802 - ReportLab callback name
            font_settings = getattr(self.settings, "font_settings", None)
            self.canv.setFont(
                getattr(font_settings, "family_name", "Courier"),
                self.settings.font_size,
                leading=self.settings.line_height,
            )
            page = self.page if self.has_title_page else self.page + 1
            if page >= 1:
                self.canv.drawRightString(
                    self.settings.left_margin + self.settings.frame_width,
                    self.settings.page_height - 42,
                    f"{page}.",
                )
            self._handle_pageBegin()

    pdf.to_pdf(screenplay, output, template_constructor=NumberedDocTemplate, settings=settings)
    return output.getvalue()


def count_pdf_pages(payload: bytes) -> int:
    """Count ReportLab page dictionaries without adding another PDF dependency."""
    return len(re.findall(rb"/Type\s*/Page\b", payload))


def render_fdx(source: str, options: CompileOptions | None = None) -> bytes:
    screenplay = number_screenplay_scenes(parse_screenplay(source), options)
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
        lambda: {"cues": 0, "lines": 0, "words": 0, "scenes": set(), "scene_lines": defaultdict(int), "last_line": 0}
    )
    locations: set[str] = set()
    active_character: str | None = None
    current_scene = 0
    current_act = ""
    current_act_number = 0
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
            level = len(section_match.group(1))
            title = section_match.group(2)
            sections.append({"level": level, "title": title, "line": line_number})
            if level == 1:
                current_act = title
                current_act_number += 1
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
            scenes.append(
                {
                    "number": scene_number,
                    "heading": clean_heading,
                    "line": line_number,
                    "words": 0,
                    "act": current_act or "Screenplay",
                    "actNumber": current_act_number,
                }
            )
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
            if current_scene:
                record["scene_lines"][current_scene] += 1
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
                "sceneLines": [
                    {"scene": scene, "lines": count}
                    for scene, count in sorted(record["scene_lines"].items())
                ],
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
