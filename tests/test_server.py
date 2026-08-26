import json
import threading
import unittest
from urllib.request import Request, urlopen

from fountain_publisher.server import create_server


class ServerTests(unittest.TestCase):
    def setUp(self):
        self.server = create_server("127.0.0.1", 0, quiet=True)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.base_url = f"http://127.0.0.1:{self.server.server_address[1]}"

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)

    def test_health_endpoint(self):
        with urlopen(f"{self.base_url}/healthz") as response:
            payload = json.load(response)
        self.assertEqual("ok", payload["status"])

    def test_frontend_is_packaged(self):
        with urlopen(f"{self.base_url}/") as response:
            document = response.read().decode("utf-8")
        self.assertIn("Fountain Publisher", document)
        self.assertIn("stats-panel", document)

    def compile(self, **payload):
        request = Request(
            f"{self.base_url}/api/compile",
            data=json.dumps({"source": "INT. ROOM - DAY\n\nAction.", **payload}).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urlopen(request) as response:
            return json.load(response)

    def test_live_compile_does_not_duplicate_document_as_html(self):
        payload = self.compile()
        self.assertNotIn("html", payload)
        self.assertEqual(1, payload["pageCount"])

    def test_page_count_excludes_title_page(self):
        payload = self.compile(source="Title: Test\nAuthor: Writer\n\nINT. ROOM - DAY\n\nAction.\n")
        self.assertEqual(1, payload["pageCount"])


    def test_unexpected_exception_returns_json_error_not_html(self):
        """Any exception from the compiler must produce a JSON 400, not an HTML 500."""
        import json
        from unittest import mock

        with mock.patch(
            "fountain_publisher.server.analyze_source",
            side_effect=AttributeError("unexpected internal error"),
        ):
            request = Request(
                f"{self.base_url}/api/compile",
                data=json.dumps({"source": "INT. ROOM - DAY\n"}).encode(),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            try:
                with urlopen(request) as response:
                    payload = json.load(response)
                self.fail("Expected HTTPError but got 200")
            except Exception as exc:  # noqa: BLE001
                import urllib.error

                if isinstance(exc, urllib.error.HTTPError):
                    self.assertEqual(400, exc.code)
                    body = json.loads(exc.read().decode("utf-8"))
                    self.assertIn("error", body)
                else:
                    raise


if __name__ == "__main__":
    unittest.main()
