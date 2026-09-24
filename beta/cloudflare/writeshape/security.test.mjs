import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { createHandler, identity } from "./worker.mjs";
import { testDB } from "./test-db.mjs";
const setup = testDB;
const handler = createHandler(async (req) => {
  const id = req.headers.get("test-user");
  if (!id) return null;
  return { id, email: id + "@example.test", private_tester: 1 };
});
const request = (user, path = "", body, origin = "https://writeshape.com") =>
  new Request("https://writeshape.com/api/library" + path, {
    method: body ? "POST" : "GET",
    headers: {
      ...(user ? { "test-user": user } : {}),
      Origin: origin,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
test("unauthenticated requests rejected", async () =>
  assert.equal((await handler(request(null), setup())).status, 401));
test("cross-account list, read, update and parent access denied", async () => {
  const env = setup();
  const folder = await (
    await handler(
      request("alice", "", { name: "Private", parent: "", kind: "folder" }),
      env,
    )
  ).json();
  const file = await (
    await handler(
      request("alice", "", {
        name: "Script.fountain",
        parent: folder.id,
        kind: "file",
        content: "Secret",
      }),
      env,
    )
  ).json();
  assert.equal(
    (await handler(request("bob", "?parent=" + folder.id), env)).status,
    404,
  );
  assert.equal((await handler(request("bob", "/" + file.id), env)).status, 404);
  assert.equal(
    (
      await handler(
        request("bob", "", {
          ...file,
          parent: "",
          kind: "file",
          content: "Overwrite",
        }),
        env,
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await handler(
        request("bob", "", {
          name: "Bad",
          parent: folder.id,
          kind: "file",
          content: "x",
        }),
        env,
      )
    ).status,
    404,
  );
  assert.equal(
    (await (await handler(request("alice", "/" + file.id), env)).json())
      .content,
    "Secret",
  );
});
test("stale revisions cannot overwrite a saved file", async () => {
  const env = setup();
  const file = await (
    await handler(
      request("alice", "", {
        name: "Script.fountain",
        parent: "",
        kind: "file",
        content: "One",
      }),
      env,
    )
  ).json();
  assert.equal(
    (
      await handler(
        request("alice", "", {
          ...file,
          parent: "",
          kind: "file",
          content: "Two",
        }),
        env,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await handler(
        request("alice", "", {
          ...file,
          parent: "",
          kind: "file",
          content: "Stale",
        }),
        env,
      )
    ).status,
    409,
  );
  assert.equal(
    (await (await handler(request("alice", "/" + file.id), env)).json())
      .content,
    "Two",
  );
});
test("cross-origin writes rejected", async () =>
  assert.equal(
    (
      await handler(
        request(
          "alice",
          "",
          { name: "x", parent: "", kind: "file", content: "x" },
          "https://attacker.test",
        ),
        setup(),
      )
    ).status,
    403,
  ));
test("JWT verifier rejects missing and forged tokens", async () => {
  await assert.rejects(() =>
    identity(new Request("https://writeshape.com"), {}),
  );
  await assert.rejects(() =>
    identity(
      new Request("https://writeshape.com", {
        headers: { "Cf-Access-Jwt-Assertion": "eyJhbGciOiJub25lIn0.e30.x" },
      }),
      {},
    ),
  );
});
