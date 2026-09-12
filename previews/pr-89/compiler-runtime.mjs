import { createLocalCompiler } from "./local-compiler.mjs";

// This module is loaded only inside the per-tab compiler worker, never the UI.
let screenplainPromise;
export async function loadCompilerRuntime() {
  if (!screenplainPromise) screenplainPromise = (async () => {
    const runtimeBase = new URL("pyodide/", import.meta.url);
    const { loadPyodide } = await import(new URL("pyodide.mjs", runtimeBase).href);
    const pyodide = await loadPyodide({ indexURL: runtimeBase.href });
    await pyodide.loadPackage("micropip");
    pyodide.globals.set("_fp_charset_wheel", new URL("vendor/charset_normalizer-3.4.7-py3-none-any.whl", import.meta.url).href);
    pyodide.globals.set("_fp_reportlab_wheel", new URL("vendor/reportlab-5.0.1-py3-none-any.whl", import.meta.url).href);
    pyodide.globals.set("_fp_pillow_wheel", new URL("vendor/pillow-12.2.0-cp314-cp314-pyemscripten_2026_0_wasm32.whl", import.meta.url).href);
    pyodide.globals.set("_fp_screenplain_wheel", new URL("vendor/screenplain-0.12.0-py3-none-any.whl", import.meta.url).href);
    pyodide.globals.set("_fp_six_wheel", new URL("vendor/six-1.17.0-py2.py3-none-any.whl", import.meta.url).href);
    pyodide.globals.set("_fp_pypdf_wheel", new URL("vendor/pypdf-6.17.0-py3-none-any.whl", import.meta.url).href);
    const fontFiles = [
      "CourierPrime-Regular.ttf",
      "CourierPrime-Bold.ttf",
      "CourierPrime-Italic.ttf",
      "CourierPrime-BoldItalic.ttf",
    ];
    pyodide.FS.mkdirTree("/fonts");
    await Promise.all(fontFiles.map(async (fontFile) => {
      const response = await fetch(new URL(`fonts/${fontFile}`, import.meta.url));
      if (!response.ok) throw new Error(`Unable to load PDF font ${fontFile}`);
      pyodide.FS.writeFile(`/fonts/${fontFile}`, new Uint8Array(await response.arrayBuffer()));
    }));
    await pyodide.runPythonAsync(`
import micropip
await micropip.install(_fp_six_wheel, deps=False)
await micropip.install(_fp_pillow_wheel, deps=False)
await micropip.install(_fp_charset_wheel, deps=False)
await micropip.install(_fp_reportlab_wheel, deps=False)
await micropip.install(_fp_screenplain_wheel, deps=False)
await micropip.install(_fp_pypdf_wheel, deps=False)
`);
    pyodide.runPython(compilerPythonHelpers);
    return pyodide;
  })().catch((error) => {
    screenplainPromise = null;
    throw new Error(`Unable to initialize the bundled Screenplain PDF compiler: ${error.message}`, { cause: error });
  });
  return screenplainPromise;
}

export const compilerPythonHelpers = `
import io
import json
import math
import re
from reportlab.lib.pagesizes import A4, letter
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from xml.sax.saxutils import escape as xml_escape
from screenplain.export import fdx, pdf
from screenplain.parsers.fountain import parse
from screenplain.richstring import bold, plain
from screenplain.types import Action, Section, Slug
from pypdf import PdfReader

def _fp_extract_pdf(path):
    reader = PdfReader(path)
    pages = []
    for page in reader.pages:
        try:
            text = page.extract_text(extraction_mode="layout") or ""
        except Exception:
            text = page.extract_text() or ""
        pages.append(text)
    return json.dumps(pages)

def _fp_register_pdf_fonts():
    try:
        fonts = {
            "CourierPrime": "/fonts/CourierPrime-Regular.ttf",
            "CourierPrime-Bold": "/fonts/CourierPrime-Bold.ttf",
            "CourierPrime-Italic": "/fonts/CourierPrime-Italic.ttf",
            "CourierPrime-BoldItalic": "/fonts/CourierPrime-BoldItalic.ttf",
        }
        for name, path in fonts.items():
            try:
                pdfmetrics.getFont(name)
            except KeyError:
                pdfmetrics.registerFont(TTFont(name, path))
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

def _fp_number_scenes(screenplay, placement="margin", format_type="sequential"):
    if placement == "off":
        for paragraph in screenplay.paragraphs:
            if isinstance(paragraph, Slug):
                paragraph.scene_number = None
        return screenplay
    act_num = 0
    act_scene_num = 0
    sequential = 0
    try:
        from screenplain.types import Section as _Section
    except Exception:
        _Section = None
    for paragraph in screenplay.paragraphs:
        if _Section is not None and isinstance(paragraph, _Section) and getattr(paragraph, "level", 0) == 1:
            act_num += 1
            act_scene_num = 0
        elif isinstance(paragraph, Slug):
            sequential += 1
            act_scene_num += 1
            label = f"A{max(act_num, 1)}S{act_scene_num}" if format_type == "act" else str(sequential)
            if placement == "margin":
                paragraph.scene_number = plain(label)
            else:
                paragraph.line = plain(f"{label}. ") + paragraph.line
                paragraph.scene_number = None
    return screenplay

def _fp_prepare_screenplay(source, placement="margin", format_type="sequential"):
    from screenplain.types import PageBreak
    source = re.sub(r"(?m)^([^\\S\\r\\n]*)>(\\S(?:.*\\S)?)<[^\\S\\r\\n]*$", r"\\1> \\2 <", source)
    screenplay = parse(io.StringIO(source))
    if screenplay.title_page and screenplay.paragraphs and isinstance(screenplay.paragraphs[0], PageBreak):
        del screenplay.paragraphs[0]
    return _fp_number_scenes(screenplay, placement, format_type)

def _fp_format_pdf_act_headings(screenplay):
    screenplay.paragraphs = [
        Slug(bold(str(paragraph.text).upper()), scene_number=None)
        if isinstance(paragraph, Section)
        and getattr(paragraph, "level", 0) == 1
        and re.match(r"^Act\\b", str(paragraph.text), re.IGNORECASE)
        else paragraph
        for paragraph in screenplay.paragraphs
    ]
    return screenplay

def _fp_patch_scene_numbers_left_only():
    try:
        from reportlab.lib.units import inch as _inch
        def _left_only_draw(self):
            self.slug_paragraph.drawOn(self.canv, 0, 0)
            canvas = self.canv
            canvas.saveState()
            canvas.setFont(self.settings.font_settings.family_name, self.settings.font_size)
            canvas.drawString(-0.75 * _inch, 0, self.scene_number)
            canvas.restoreState()
        pdf.SlugWithSceneNumbers.draw = _left_only_draw
    except Exception:
        pass
_fp_patch_scene_numbers_left_only()

def _fp_compile_beat_sheet(title, premise, beats, page_size="letter"):
    output = io.BytesIO()
    _, regular_font, bold_font, _, _ = _fp_register_pdf_fonts()
    selected_size = A4 if page_size == "a4" else letter
    document = SimpleDocTemplate(
        output,
        pagesize=selected_size,
        leftMargin=54,
        rightMargin=54,
        topMargin=58,
        bottomMargin=52,
        title=f"{title} - Beat Sheet",
        author="Fountain Publisher",
    )
    ink = colors.HexColor("#22252a")
    muted = colors.HexColor("#66707a")
    accent = colors.HexColor("#67516c")
    soft = colors.HexColor("#f4f0f5")
    rule = colors.HexColor("#d9d5da")
    title_style = ParagraphStyle("BeatTitle", fontName=bold_font, fontSize=21, leading=25, textColor=ink, spaceAfter=5)
    eyebrow_style = ParagraphStyle("BeatEyebrow", fontName=bold_font, fontSize=8, leading=10, textColor=accent, tracking=1.6, spaceAfter=6)
    premise_style = ParagraphStyle("BeatPremise", fontName=regular_font, fontSize=10.5, leading=15, textColor=ink)
    beat_style = ParagraphStyle("BeatBody", fontName=regular_font, fontSize=11, leading=15, textColor=ink)
    number_style = ParagraphStyle("BeatNumber", fontName=bold_font, fontSize=10, leading=14, textColor=accent, alignment=TA_CENTER)
    story = [
        Paragraph("BEAT SHEET", eyebrow_style),
        Paragraph(xml_escape(title), title_style),
        Spacer(1, 16),
        Paragraph("PREMISE", eyebrow_style),
        Table([[Paragraph(xml_escape(premise) if premise else "No premise yet.", premise_style)]], colWidths=[document.width], style=TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), soft),
            ("BOX", (0, 0), (-1, -1), 0.7, rule),
            ("LEFTPADDING", (0, 0), (-1, -1), 14),
            ("RIGHTPADDING", (0, 0), (-1, -1), 14),
            ("TOPPADDING", (0, 0), (-1, -1), 12),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
        ])),
        Spacer(1, 22),
        Paragraph("STORY BEATS", eyebrow_style),
    ]
    if beats:
        for index, beat in enumerate(beats, 1):
            row = Table(
                [[Paragraph(str(index), number_style), Paragraph(xml_escape(str(beat)), beat_style)]],
                colWidths=[34, document.width - 34],
                style=TableStyle([
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LINEBELOW", (0, 0), (-1, -1), 0.6, rule),
                    ("LEFTPADDING", (0, 0), (0, 0), 0),
                    ("RIGHTPADDING", (0, 0), (0, 0), 8),
                    ("LEFTPADDING", (1, 0), (1, 0), 7),
                    ("RIGHTPADDING", (1, 0), (1, 0), 0),
                    ("TOPPADDING", (0, 0), (-1, -1), 10),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 11),
                ]),
            )
            story.append(KeepTogether([row]))
    else:
        story.append(Paragraph("No beats yet.", premise_style))

    def draw_page(canvas, doc):
        canvas.saveState()
        canvas.setStrokeColor(rule)
        canvas.line(doc.leftMargin, 34, selected_size[0] - doc.rightMargin, 34)
        canvas.setFont(regular_font, 8)
        canvas.setFillColor(muted)
        canvas.drawString(doc.leftMargin, 22, "Fountain Publisher")
        canvas.drawRightString(selected_size[0] - doc.rightMargin, 22, str(doc.page))
        canvas.restoreState()

    document.build(story, onFirstPage=draw_page, onLaterPages=draw_page)
    return output.getvalue()

def _fp_compile(source, kind, page_size, scene_numbers="margin", scene_number_format="sequential"):
    global _fp_last_page_eighths, _fp_title_page_count
    _fp_last_page_eighths = 0
    _fp_title_page_count = 0
    screenplay = _fp_prepare_screenplay(source, scene_numbers, scene_number_format)
    font_family, regular_font, bold_font, italic_font, bold_italic_font = _fp_register_pdf_fonts()
    if kind == "pdf":
        screenplay = _fp_format_pdf_act_headings(screenplay)
        output = io.BytesIO()
        settings = pdf.Settings(page_size=A4 if page_size == "a4" else letter, strong_slugs=False)
        font_settings = getattr(settings, "font_settings", None)
        if font_settings is not None:
            font_settings.family_name = font_family
            font_settings.regular = regular_font
            font_settings.bold = bold_font
            font_settings.italic = italic_font
            font_settings.bold_italic = bold_italic_font
        if hasattr(settings, "slug_style"):
            settings.slug_style.fontName = bold_font
        settings.title_style.fontSize = settings.font_size
        title_leading = settings.line_height * 2
        for style_name in ("title_style", "centered_style", "default_style", "contact_style"):
            style = getattr(settings, style_name, None)
            if style is not None:
                style.fontName = regular_font
                style.fontSize = settings.font_size
                style.leading = title_leading
        if hasattr(settings, "title_style"):
            settings.title_style.spaceAfter = -settings.line_height
        if hasattr(settings, "default_style"):
            settings.default_style.spaceAfter = -settings.line_height
        if hasattr(settings, "contact_style"):
            settings.contact_style.spaceAfter = -settings.line_height
        usage = {"page": 0, "used": 0.0, "title_pages": 0}
        class NumberedDocTemplate(pdf.DocTemplate):
            def handle_pageBegin(self):
                usage["title_pages"] = int(self.has_title_page)
                _font_settings = getattr(self.settings, "font_settings", None)
                self.canv.setFont(getattr(_font_settings, "family_name", "Courier"), self.settings.font_size, leading=self.settings.line_height)
                page = self.page if self.has_title_page else self.page + 1
                if page >= 1:
                    self.canv.drawRightString(self.settings.left_margin + self.settings.frame_width, self.settings.page_height - 42, f"{page}.")
                self._handle_pageBegin()
            def afterFlowable(self, flowable):
                title_pages = 1 if self.has_title_page else 0
                content_page = self.page - title_pages
                if content_page < 1 or type(flowable).__name__ in {"LCActionFlowable", "NextPageTemplate", "PageBreak"}:
                    return
                frame = getattr(self, "frame", None)
                if frame is None:
                    return
                used = max(0.0, min(self.settings.frame_height, frame._y2 - frame._y))
                if content_page > usage["page"]:
                    usage.update(page=content_page, used=used)
                elif content_page == usage["page"]:
                    usage["used"] = max(usage["used"], used)
        pdf.to_pdf(screenplay, output, template_constructor=NumberedDocTemplate, settings=settings)
        _fp_title_page_count = usage["title_pages"]
        _fp_last_page_eighths = min(8, max(1, math.ceil(usage["used"] / settings.frame_height * 8))) if usage["page"] else 0
        return output.getvalue()
    if kind == "fdx":
        output = io.BytesIO()
        try:
            fdx.to_fdx(screenplay, output)
            return output.getvalue()
        except TypeError:
            text = io.StringIO()
            fdx.to_fdx(screenplay, text)
            return text.getvalue().encode("utf-8")
    raise ValueError(f"Unsupported export kind: {kind}")
`;

export function createCompilerEngine(loadRuntime = loadCompilerRuntime) {
  const compile = createLocalCompiler(loadRuntime);
  let tail = Promise.resolve();
  function execute(operation, input) {
    const job = tail.then(async () => {
      if (operation === "compile") return compile(input.kind, input.request);
      const runtime = await loadRuntime();
      if (operation === "extract-pdf") {
        const path = "/tmp/fountain-publisher-import.pdf";
        runtime.FS.writeFile(path, new Uint8Array(input.bytes));
        try { return JSON.parse(String(runtime.runPython('_fp_extract_pdf("/tmp/fountain-publisher-import.pdf")'))); }
        finally { runtime.FS.unlink(path); }
      }
      if (operation === "beat-sheet") {
        runtime.globals.set("_fp_beat_title", input.title);
        runtime.globals.set("_fp_beat_premise", input.premise);
        runtime.globals.set("_fp_beat_json", JSON.stringify(input.beats));
        runtime.globals.set("_fp_beat_page_size", input.pageSize);
        const value = runtime.runPython("_fp_compile_beat_sheet(_fp_beat_title, _fp_beat_premise, json.loads(_fp_beat_json), _fp_beat_page_size)");
        try { return new Blob([value instanceof Uint8Array ? value : value.toJs()], { type: "application/pdf" }); }
        finally { value.destroy?.(); }
      }
      throw new Error(`Unsupported compiler operation: ${operation}`);
    });
    tail = job.catch(() => {});
    return job;
  }
  return { execute, initialize: loadRuntime };
}
