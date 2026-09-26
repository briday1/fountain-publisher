import { test } from "node:test";
import assert from "node:assert/strict";
import { createHandler } from "./worker.mjs";
test("unexpected failures expose a correlation reference without logging content, credentials or identifiers", async (t) => {
  const logs = [];
  t.mock.method(console, "error", (value) => logs.push(value));
  const handler = createHandler(async () => {
    throw new Error("secret-token private-manuscript person@example.test");
  });
  const response = await handler(
    new Request(
      "https://writeshape.com/api/library/private-document?token=secret-token",
      { headers: { Authorization: "secret-token" } },
    ),
    {},
  );
  assert.equal(response.status, 500);
  const body = await response.json();
  assert.equal(body.reference, response.headers.get("X-WriteShape-Request-ID"));
  assert.equal(logs.length, 1);
  assert.deepEqual(Object.keys(JSON.parse(logs[0])).sort(), [
    "area",
    "event",
    "reference",
    "status",
  ]);
  assert.equal(JSON.parse(logs[0]).area, "library");
  assert.doesNotMatch(
    logs[0] + JSON.stringify(body),
    /secret-token|private-document|private-manuscript|person@example/,
  );
});
