"""Shared Preview/export fixtures for supported Fountain inline syntax."""

import json
from pathlib import Path
import unittest

from screenplain.richstring import parse_emphasis
from fountain_publisher.compiler import parse_screenplay


class InlineExportContractTests(unittest.TestCase):
    def test_supported_forced_elements_match_preview_contract(self):
        for source, kind, visible in [
            ("!INT. NOT A SCENE", "Action", "INT. NOT A SCENE"),
            ("@person TO:\nHello.", "Dialog", "person TO:"),
            ("@someone with an unusually long character name and extension\nHello.", "Dialog", "someone with an unusually long character name and extension"),
            (".somewhere else", "Slug", "SOMEWHERE ELSE"),
            ("> DISSOLVE TO:", "Transition", "DISSOLVE TO:"),
            ("> **END** <", "Action", "END"),
            ("ALICE  \nAn action.", "Action", "ALICE"),
            ("...a pause.", "Action", "...a pause."),
        ]:
            with self.subTest(source=source):
                paragraph = parse_screenplay(source).paragraphs[0]
                self.assertEqual(type(paragraph).__name__, kind)
                content = (
                    paragraph.character if kind == "Dialog"
                    else paragraph.lines[0] if kind == "Action"
                    else paragraph.line
                )
                self.assertEqual(str(content), visible)

    def test_shared_inline_fixtures_match_export_rich_text(self):
        fixtures = json.loads(
            (Path(__file__).parent / "fixtures" / "fountain-inline.json").read_text()
        )
        for fixture in fixtures:
            with self.subTest(source=fixture["source"]):
                actual = [
                    (character, sorted(style.name() for style in segment.styles))
                    for segment in parse_emphasis(fixture["source"]).segments
                    for character in segment.text
                ]
                expected = [
                    (character, sorted(run["styles"]))
                    for run in fixture["runs"]
                    for character in run["text"]
                ]
                self.assertEqual(actual, expected)
