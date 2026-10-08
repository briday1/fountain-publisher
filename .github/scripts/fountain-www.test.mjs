import assert from "node:assert/strict";
import test from "node:test";
import redirect from "../../beta/cloudflare/fountain-www.mjs";

test("www links retain document paths and query strings on the existing apex origin", () => {
  const response = redirect.fetch(
    new Request(
      "https://www.fountain-publisher.com/previews/beta/?drive=shared-file&room=existing",
    ),
  );
  assert.equal(response.status, 301);
  assert.equal(
    response.headers.get("location"),
    "https://fountain-publisher.com/previews/beta/?drive=shared-file&room=existing",
  );
});
