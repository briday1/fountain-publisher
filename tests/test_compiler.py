import io
import unittest
from unittest import mock
from types import SimpleNamespace
from importlib.metadata import metadata

from fountain_publisher.compiler import CompileOptions, analyze_source, count_pdf_pages, render_fdx, render_html, render_pdf


SOURCE = """Title: Signals
Author: A. Writer

INT. LAB - NIGHT

MAYA
We found it.
This changes everything.

ELI
(under his breath)
Or ends it.
"""


class AnalyzeSourceTests(unittest.TestCase):
    def test_character_and_scene_statistics_keep_source_lines(self):
        result = analyze_source(SOURCE)
        self.assertEqual(1, len(result["scenes"]))
        self.assertEqual("LAB", result["locations"][0])
        self.assertEqual(["MAYA", "ELI"], [character["name"] for character in result["characters"]])
        self.assertEqual(2, result["characters"][0]["lines"])
        self.assertEqual(1, result["characters"][1]["lines"])
        self.assertGreater(result["dialogueWords"], 0)

    def test_title_fields_are_available_for_completion(self):
        result = analyze_source(SOURCE)
        self.assertEqual(["Title", "Author"], result["titleFields"])


class ScreenplainIntegrationTests(unittest.TestCase):
    def test_runtime_versions_are_pinned_for_browser_parity(self):
        requirements = metadata("fountain-publisher").get_all("Requires-Dist") or []
        self.assertIn("screenplain==0.12.0", requirements)
        self.assertIn("reportlab==5.0.1", requirements)

    def test_html_uses_screenplain_formatter(self):
        html = render_html(SOURCE)
        self.assertIn('class="dialog"', html)
        self.assertIn("INT. LAB - NIGHT", html)
        # Margin mode: scene number appears in margin spans, not prepended inline
        self.assertIn('class="scnuml"', html)

    def test_scene_numbers_are_generated_without_source_markers(self):
        html = render_html("EXT. PARK - DAY\n\nAction.\n\nINT. HOME - NIGHT\n")
        self.assertIn("EXT. PARK - DAY", html)
        self.assertIn("INT. HOME - NIGHT", html)
        # Numbers appear in margin spans by default
        self.assertIn('class="scnuml"', html)

    def test_dot_forced_int_is_a_numbered_scene(self):
        source = ".INT. BASEMENT - NIGHT\n\nA light flickers.\n"
        self.assertEqual("INT. BASEMENT - NIGHT", analyze_source(source)["scenes"][0]["heading"])
        html = render_html(source)
        self.assertIn("INT. BASEMENT - NIGHT", html)
        self.assertNotIn(".INT. BASEMENT", html)

    def test_reportlab_pdf_pages_are_counted(self):
        self.assertEqual(2, count_pdf_pages(b"/Type /Pages /Type /Page /Type\n/Page\n"))

    def test_title_page_consumes_one_sheet_without_a_redundant_blank(self):
        source = "Title: Test\nCredit: Written by\nAuthor: Writer\n\n===\n\nINT. ROOM - DAY\n\nAction.\n"
        self.assertEqual(2, count_pdf_pages(render_pdf(source)))

    def test_fdx_is_final_draft_xml(self):
        fdx = render_fdx(SOURCE)
        self.assertTrue(fdx.startswith(b"<?xml"))
        self.assertIn(b"FinalDraft", fdx)

    def test_pdf_passes_selected_page_size(self):
        fake_pdf = mock.Mock()
        settings = SimpleNamespace(
            title_style=SimpleNamespace(fontSize=24, leading=30, fontName="Courier-Bold"),
            slug_style=SimpleNamespace(fontName="Courier"),
            centered_style=SimpleNamespace(fontName="Courier-Bold"),
            default_style=SimpleNamespace(fontName="Courier-Bold"),
            contact_style=SimpleNamespace(fontName="Courier-Bold"),
            font_settings=SimpleNamespace(
                family_name="Courier",
                regular="Courier",
                bold="Courier-Bold",
                italic="Courier-Oblique",
                bold_italic="Courier-BoldOblique",
            ),
            font_size=12,
            line_height=12,
        )
        fake_pdf.Settings.return_value = settings
        fake_pdf.to_pdf.side_effect = lambda screenplay, output, settings, **kwargs: output.write(b"%PDF-test")
        with mock.patch("fountain_publisher.compiler._screenplain", return_value=(None, None, fake_pdf, None)), \
             mock.patch("fountain_publisher.compiler.parse_screenplay", return_value=object()):
            result = render_pdf(SOURCE, CompileOptions(page_size="a4"))
        self.assertEqual(b"%PDF-test", result)
        fake_pdf.to_pdf.assert_called_once()
        self.assertIn("template_constructor", fake_pdf.to_pdf.call_args.kwargs)
        self.assertEqual(12, settings.title_style.fontSize)
        self.assertEqual(24, settings.title_style.leading)
        self.assertEqual(24, settings.centered_style.leading)
        self.assertEqual(24, settings.default_style.leading)
        self.assertEqual(24, settings.contact_style.leading)
        self.assertEqual(-12, settings.title_style.spaceAfter)
        self.assertEqual("CourierPrime", settings.title_style.fontName)
        self.assertEqual("CourierPrime", settings.centered_style.fontName)
        self.assertEqual("CourierPrime", settings.default_style.fontName)
        self.assertEqual("CourierPrime", settings.contact_style.fontName)
        self.assertEqual("CourierPrime-Bold", settings.slug_style.fontName)
        self.assertEqual("CourierPrime", settings.font_settings.family_name)
        self.assertEqual("CourierPrime", settings.font_settings.regular)
        self.assertEqual("CourierPrime-Bold", settings.font_settings.bold)
        self.assertEqual("CourierPrime-Italic", settings.font_settings.italic)
        self.assertEqual("CourierPrime-BoldItalic", settings.font_settings.bold_italic)
        self.assertFalse(fake_pdf.Settings.call_args.kwargs["strong_slugs"])


if __name__ == "__main__":
    unittest.main()
