import io
import unittest
from unittest import mock
from types import SimpleNamespace

from fountain_publisher.compiler import CompileOptions, analyze_source, render_fdx, render_html, render_pdf


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
    def test_html_uses_screenplain_formatter(self):
        html = render_html(SOURCE)
        self.assertIn('class="dialog"', html)
        self.assertIn("INT. LAB - NIGHT", html)

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
            font_size=12,
            line_height=12,
        )
        fake_pdf.Settings.return_value = settings
        fake_pdf.to_pdf.side_effect = lambda screenplay, output, settings: output.write(b"%PDF-test")
        with mock.patch("fountain_publisher.compiler._screenplain", return_value=(None, None, fake_pdf, None)), \
             mock.patch("fountain_publisher.compiler.parse_screenplay", return_value=object()):
            result = render_pdf(SOURCE, CompileOptions(page_size="a4"))
        self.assertEqual(b"%PDF-test", result)
        fake_pdf.to_pdf.assert_called_once()
        self.assertEqual(10, settings.title_style.fontSize)
        self.assertEqual(12, settings.title_style.leading)
        self.assertEqual("Courier", settings.title_style.fontName)
        self.assertEqual("Courier", settings.centered_style.fontName)
        self.assertEqual("Courier", settings.default_style.fontName)
        self.assertEqual("Courier", settings.contact_style.fontName)
        self.assertEqual("Courier-Bold", settings.slug_style.fontName)
        self.assertFalse(fake_pdf.Settings.call_args.kwargs["strong_slugs"])


if __name__ == "__main__":
    unittest.main()
