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

    def test_html_can_be_requested_for_export(self):
        self.assertIn("html", self.compile(includeHtml=True))


if __name__ == "__main__":
    unittest.main()
