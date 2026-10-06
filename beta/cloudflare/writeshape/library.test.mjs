import { test } from "node:test";
import assert from "node:assert/strict";
import { testDB } from "./test-db.mjs";
import { createHandler } from "./worker.mjs";
const handler = createHandler(async (r, env) => {
  const id = r.headers.get("test-user");
  if (id)
    await env.DB.prepare(
      "INSERT OR IGNORE INTO accounts(id,email,created) VALUES(?,?,0)",
    )
      .bind(id, "fixture@example.test")
      .run();
  return r.headers.has("test-user")
    ? {
        id: r.headers.get("test-user"),
        email: "fixture@example.test",
        private_tester: r.headers.get("test-free") ? 0 : 1,
      }
    : null;
});
const request = (user, path = "", body, free = false) =>
  new Request("https://writeshape.com/api/library" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(user ? { "test-user": user } : {}),
      ...(free ? { "test-free": "1" } : {}),
      Origin: "https://writeshape.com",
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const call = (env, user, path = "", body, free = false) =>
  handler(request(user, path, body, free), env);
async function create(
  env,
  content = "first",
  parent = "",
  name = "Test.fountain",
  user = "alice",
) {
  const response = await call(env, user, "", {
    name,
    kind: "file",
    parent,
    content,
  });
  assert.equal(response.status, 201);
  return response.json();
}
const update = (env, file, content) =>
  call(env, "alice", "", { ...file, content });
const versions = async (env, file, user = "alice") =>
  (await call(env, user, `/${file.id}/versions`)).json();
test("every save archives an immutable version and restoring creates a new revision", async () => {
  const env = testDB();
  let file = await create(env, "one");
  const v1 = file.versionId;
  const second = await update(env, file, "two");
  assert.equal(second.status, 200);
  file = await second.json();
  let history = await versions(env, file);
  assert.deepEqual(
    history.versions.map((v) => v.revision),
    [2, 1],
  );
  assert.ok(history.versions.every((v) => v.savedAt));
  assert.equal(history.versions[1].id, v1);
  const old = await (
    await call(env, "alice", `/${file.id}/versions/${encodeURIComponent(v1)}`)
  ).json();
  assert.equal(old.content, "one");
  const restored = await call(env, "alice", `/${file.id}/restore`, {
    versionId: v1,
    revision: 2,
  });
  assert.equal(restored.status, 200);
  assert.equal((await restored.json()).revision, 3);
  history = await versions(env, file);
  assert.deepEqual(
    history.versions.map((v) => v.revision),
    [3, 2, 1],
  );
  assert.equal(
    (await (await call(env, "alice", "/" + file.id)).json()).content,
    "one",
  );
  assert.equal(
    (
      await (
        await call(env, "alice", `/${file.id}/versions/${file.id}:2`)
      ).json()
    ).content,
    "two",
  );
  assert.throws(
    () => env.sql.prepare("UPDATE file_versions SET content=?").run("bad"),
    /IMMUTABLE/,
  );
  assert.throws(() => env.sql.exec("DELETE FROM file_versions"), /IMMUTABLE/);
});
test("storage measures exact UTF-8 current and historical content, separately per owner", async () => {
  const env = testDB();
  let file = await create(env, "é🌊");
  assert.equal(file.bytes, 6);
  await update(env, file, "abc");
  await create(env, "secret", "", "Other.fountain", "bob");
  const usage = await (await call(env, "alice", "/usage")).json();
  assert.deepEqual(
    [
      usage.currentBytes,
      usage.historyBytes,
      usage.usedBytes,
      usage.versionCount,
    ],
    [3, 6, 9, 1],
  );
  assert.equal(usage.quotaBytes, null);
  assert.equal(usage.historyLimit, null);
  assert.equal(usage.fileCount, 1);
  assert.equal((await (await call(env, "bob", "/usage")).json()).usedBytes, 6);
});
test("quota growth includes archived content; failed saves and restores leave history unchanged", async () => {
  const env = { ...testDB(), STORAGE_QUOTA_BYTES: "7" };
  let file = await create(env, "1234");
  let result = await update(env, file, "abc");
  assert.equal(result.status, 200);
  file = await result.json();
  result = await update(env, file, "x");
  assert.equal(result.status, 413);
  assert.equal((await result.json()).code, "QUOTA_EXCEEDED");
  result = await call(env, "alice", `/${file.id}/restore`, {
    versionId: `${file.id}:1`,
    revision: 2,
  });
  assert.equal(result.status, 413);
  assert.equal((await versions(env, file)).versions.length, 2);
  assert.equal(
    (await (await call(env, "alice", "/" + file.id)).json()).content,
    "abc",
  );
  assert.equal(
    (await (await call(env, "alice", "/usage")).json()).usedBytes,
    7,
  );
});
test("parallel file creation cannot race past a finite account quota", async () => {
  const env = { ...testDB(), STORAGE_QUOTA_BYTES: "6" };
  const responses = await Promise.all(
    ["A.fountain", "B.fountain"].map((name) =>
      call(env, "alice", "", {
        name,
        kind: "file",
        parent: "",
        content: "1234",
      }),
    ),
  );
  assert.deepEqual(responses.map((r) => r.status).sort(), [201, 413]);
  assert.equal(
    (await (await call(env, "alice", "/usage")).json()).usedBytes,
    4,
  );
});
test("parallel saves to different files serialize their combined quota growth", async () => {
  const env = { ...testDB(), STORAGE_QUOTA_BYTES: "10" };
  const a = await create(env, "aa", "", "A.fountain"),
    b = await create(env, "bb", "", "B.fountain");
  const responses = await Promise.all([
    update(env, a, "1234"),
    update(env, b, "5678"),
  ]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 413]);
  const usage = await (await call(env, "alice", "/usage")).json();
  assert.equal(usage.usedBytes, 8);
  assert.equal(usage.versionCount, 1);
});
test("stale save and restore cannot overwrite newer content or append ghost history", async () => {
  const env = testDB();
  const file = await create(env, "one");
  await update(env, file, "two");
  const stale = await update(env, file, "stale");
  assert.equal(stale.status, 409);
  assert.equal((await stale.json()).code, "REVISION_CONFLICT");
  const restore = await call(env, "alice", `/${file.id}/restore`, {
    versionId: `${file.id}:1`,
    revision: 1,
  });
  assert.equal(restore.status, 409);
  assert.equal((await versions(env, file)).versions.length, 2);
  const concurrent = await Promise.all([
    update(env, { ...file, revision: 2 }, "winner A"),
    update(env, { ...file, revision: 2 }, "winner B"),
  ]);
  assert.deepEqual(concurrent.map((r) => r.status).sort(), [200, 409]);
  assert.equal((await versions(env, file)).versions.length, 3);
});
test("folders, contents, usage and history remain isolated across accounts", async () => {
  const env = testDB();
  const folder = await (
    await call(env, "alice", "", {
      name: "Private",
      kind: "folder",
      parent: "",
    })
  ).json();
  const file = await create(env, "secret", folder.id);
  await update(env, file, "new secret");
  for (const path of [
    "?parent=" + folder.id,
    "/" + file.id,
    `/${file.id}/versions`,
    `/${file.id}/versions/${file.id}:1`,
  ])
    assert.equal((await call(env, "bob", path)).status, 404);
  assert.equal(
    (
      await call(env, "bob", `/${file.id}/restore`, {
        versionId: `${file.id}:1`,
        revision: 2,
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await call(env, "bob", "", {
        name: "Bad",
        kind: "file",
        parent: folder.id,
        content: "x",
      })
    ).status,
    404,
  );
  assert.equal((await (await call(env, "bob", "/usage")).json()).usedBytes, 0);
  const list = await (await call(env, "alice", "?parent=" + folder.id)).json();
  assert.equal(list.breadcrumbs[0].name, "Private");
  assert.equal(list.items[0].name, "Test.fountain");
});
test("configured retention caps block new history without ever deleting existing versions", async () => {
  const env = { ...testDB(), HISTORY_MAX_VERSIONS: "1" };
  let file = await create(env);
  file = await (await update(env, file, "second")).json();
  const result = await update(env, file, "third");
  assert.equal(result.status, 409);
  assert.equal((await result.json()).code, "HISTORY_LIMIT");
  assert.equal((await versions(env, file)).versions.length, 2);
  env.HISTORY_MAX_VERSIONS = "0";
  assert.equal((await update(env, file, "third")).status, 409);
  assert.equal((await versions(env, file)).versions.length, 2);
  delete env.HISTORY_MAX_VERSIONS;
  assert.equal((await update(env, file, "third")).status, 200);
  assert.equal((await versions(env, file)).versions.length, 3);
});
test("concurrent duplicate names are rejected without replacing files", async () => {
  const env = testDB();
  const results = await Promise.all(
    ["Script.fountain", "script.fountain"].map((name) =>
      call(env, "alice", "", { name, kind: "file", parent: "", content: "x" }),
    ),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  assert.equal(
    (await (await call(env, "alice", "/usage")).json()).fileCount,
    1,
  );
});
test("legacy files acquire history on next save without fabricating earlier revisions", async () => {
  const env = testDB();
  env.sql
    .prepare("INSERT INTO accounts(id,email,created) VALUES(?,?,0)")
    .run("alice", "alice@example.test");
  const id = crypto.randomUUID();
  env.sql
    .prepare("INSERT INTO items VALUES (?,?,?,?,?,?,?,?)")
    .run(
      id,
      "alice",
      "",
      "Legacy.fountain",
      "file",
      "legacy",
      9,
      "2026-09-01T00:00:00.000Z",
    );
  let history = await versions(env, { id });
  assert.deepEqual(
    history.versions.map((v) => v.revision),
    [9],
  );
  const result = await update(
    env,
    { id, parent: "", name: "Legacy.fountain", kind: "file", revision: 9 },
    "latest",
  );
  assert.equal(result.status, 200);
  history = await versions(env, { id });
  assert.deepEqual(
    history.versions.map((v) => v.revision),
    [10, 9],
  );
  assert.equal(history.versions[1].savedAt, "2026-09-01T00:00:00.000Z");
});
test("free owners may inspect history but cannot restore or write; unauthenticated history is rejected", async () => {
  const env = testDB();
  const file = await create(env);
  await update(env, file, "second");
  assert.equal(
    (await call(env, "alice", `/${file.id}/versions`, undefined, true)).status,
    200,
  );
  assert.equal(
    (
      await call(
        env,
        "alice",
        `/${file.id}/restore`,
        { versionId: `${file.id}:1`, revision: 2 },
        true,
      )
    ).status,
    403,
  );
  assert.equal((await call(env, null, `/${file.id}/versions`)).status, 401);
});
test("invalid configured quotas fail closed and zero bytes is a real enforced limit", async () => {
  const env = { ...testDB(), STORAGE_QUOTA_BYTES: "not a number" };
  assert.equal(
    (
      await call(env, "alice", "", {
        name: "A",
        kind: "file",
        parent: "",
        content: "x",
      })
    ).status,
    503,
  );
  env.STORAGE_QUOTA_BYTES = "0";
  assert.equal(
    (
      await call(env, "alice", "", {
        name: "A",
        kind: "file",
        parent: "",
        content: "x",
      })
    ).status,
    413,
  );
  assert.equal(
    (await (await call(env, "alice", "/usage")).json()).usedBytes,
    0,
  );
});

test("file management preserves versions, rejects stale/cross-account edits, and restores from Trash", async () => {
  const env = testDB();
  let file = await create(env, "Keep these words");
  const action = (user, body, free = false) =>
    call(env, user, `/${file.id}/manage`, body, free);
  assert.equal(
    (await action("bob", { action: "trash", revision: 1 })).status,
    404,
  );
  assert.equal(
    (await action("alice", { action: "trash", revision: 1 }, true)).status,
    403,
  );
  let response = await action("alice", {
    action: "rename",
    revision: 1,
    name: "Renamed.fountain",
  });
  assert.equal(response.status, 200);
  file = await response.json();
  assert.equal(
    (await action("alice", { action: "trash", revision: 1 })).status,
    409,
  );
  response = await action("alice", { action: "trash", revision: 2 });
  assert.equal(response.status, 200);
  file = await response.json();
  assert.equal((await (await call(env, "alice")).json()).items.length, 0);
  assert.equal(
    (
      await (
        await call(env, "alice", "?parent=__trash__", undefined, true)
      ).json()
    ).items.length,
    1,
  );
  assert.equal(
    (await (await call(env, "alice", `/${file.id}`, undefined, true)).json())
      .content,
    "Keep these words",
  );
  response = await action("alice", { action: "move", revision: 3, parent: "" });
  assert.equal(response.status, 200);
  assert.equal((await versions(env, file)).versions.length, 4);
});
test("folder management rejects cycles and trashes and restores a complete nested tree", async () => {
  const env = testDB();
  const folder = await (
    await call(env, "alice", "", { kind: "folder", parent: "", name: "Parent" })
  ).json();
  const child = await (
    await call(env, "alice", "", {
      kind: "folder",
      parent: folder.id,
      name: "Child",
    })
  ).json();
  for (const input of [
    { action: "move", parent: child.id },
    { action: "move", parent: folder.id },
  ]) {
    assert.equal(
      (
        await call(env, "alice", `/${folder.id}/manage`, {
          ...input,
          revision: 1,
        })
      ).status,
      409,
    );
  }
  const file = await create(env, "Nested writing", child.id, "Nested.fountain");
  const trashed = await call(env, "alice", `/${folder.id}/manage`, {
    action: "trash",
    revision: 1,
  });
  assert.equal(trashed.status, 200);
  assert.equal((await trashed.json()).parent, "__trash__");
  const trash = await (await call(env, "alice", "?parent=__trash__")).json();
  assert.equal(trash.items[0].id, folder.id);
  const nested = await (await call(env, "alice", `?parent=${child.id}`)).json();
  assert.deepEqual(
    nested.breadcrumbs.map((c) => c.name),
    ["Trash", "Parent", "Child"],
  );
  assert.equal(nested.items[0].id, file.id);
  const restored = await call(env, "alice", `/${folder.id}/manage`, {
    action: "move",
    revision: 2,
    parent: "",
  });
  assert.equal(restored.status, 200);
  assert.equal(
    (await (await call(env, "alice", `/${file.id}`)).json()).content,
    "Nested writing",
  );
  assert.equal(
    (await (await call(env, "alice", `?parent=${child.id}`)).json())
      .breadcrumbs[0].name,
    "Parent",
  );
});

test("copy duplicates a nested folder atomically with fresh IDs, current contents and no sharing or history", async () => {
  const env = testDB();
  const folder = await (
    await call(env, "alice", "", {
      kind: "folder",
      name: "Stories",
      parent: "",
    })
  ).json();
  const nested = await (
    await call(env, "alice", "", {
      kind: "folder",
      name: "Chapters",
      parent: folder.id,
    })
  ).json();
  let file = await create(env, "old", nested.id, "Book.md");
  file = await (await update(env, file, "current é🌊")).json();
  const originalUsage = await (await call(env, "alice", "/usage")).json();
  const response = await call(env, "alice", `/${folder.id}/copy`, {
    name: "Stories copy",
    parent: "",
    revision: folder.revision,
  });
  assert.equal(response.status, 201);
  const copy = await response.json();
  assert.notEqual(copy.id, folder.id);
  const children = await (
    await call(env, "alice", "?parent=" + copy.id)
  ).json();
  assert.equal(children.items.length, 1);
  assert.notEqual(children.items[0].id, nested.id);
  const grandchildren = await (
    await call(env, "alice", "?parent=" + children.items[0].id)
  ).json();
  const copiedFile = grandchildren.items[0];
  assert.equal(copiedFile.name, "Book.md");
  assert.equal(copiedFile.revision, 1);
  assert.notEqual(copiedFile.id, file.id);
  assert.equal(
    (await (await call(env, "alice", "/" + copiedFile.id)).json()).content,
    "current é🌊",
  );
  assert.equal((await versions(env, copiedFile)).versions.length, 1);
  assert.equal((await versions(env, file)).versions.length, 2);
  const usage = await (await call(env, "alice", "/usage")).json();
  assert.equal(usage.usedBytes, originalUsage.usedBytes + file.bytes);
  assert.equal(usage.historyBytes, originalUsage.historyBytes);
  assert.equal(
    env.sql
      .prepare("SELECT COUNT(*) n FROM file_edit_shares WHERE file_id=?")
      .get(copiedFile.id).n,
    0,
  );
});

test("copy preserves originals and rejects collisions, stale revisions, foreign owners, free accounts, cycles, trash and quota overflow", async () => {
  const env = testDB();
  const file = await create(env, "é🌊");
  const body = { name: "Test copy.fountain", parent: "", revision: 1 };
  assert.equal((await call(env, "bob", `/${file.id}/copy`, body)).status, 404);
  assert.equal(
    (await call(env, "alice", `/${file.id}/copy`, body, true)).status,
    403,
  );
  assert.equal(
    (await call(env, "alice", `/${file.id}/copy`, { ...body, revision: 2 }))
      .status,
    409,
  );
  assert.equal(
    (await call(env, "alice", `/${file.id}/copy`, { ...body, name: file.name }))
      .status,
    409,
  );
  env.STORAGE_QUOTA_BYTES = "11";
  assert.equal(
    (await call(env, "alice", `/${file.id}/copy`, body)).status,
    409,
  );
  assert.equal(env.sql.prepare("SELECT COUNT(*) n FROM items").get().n, 1);
  env.STORAGE_QUOTA_BYTES = "12";
  assert.equal(
    (await call(env, "alice", `/${file.id}/copy`, body)).status,
    201,
  );
  assert.equal((await versions(env, file)).versions.length, 1);
  delete env.STORAGE_QUOTA_BYTES;
  const folder = await (
    await call(env, "alice", "", { kind: "folder", name: "Folder", parent: "" })
  ).json();
  assert.equal(
    (
      await call(env, "alice", `/${folder.id}/copy`, {
        name: "Cycle",
        parent: folder.id,
        revision: 1,
      })
    ).status,
    400,
  );
  const nested = await create(env, "abc", folder.id, "Nested.fountain");
  env.STORAGE_QUOTA_BYTES = "14";
  assert.equal(
    (
      await call(env, "alice", `/${folder.id}/copy`, {
        name: "No partial copy",
        parent: "",
        revision: 1,
      })
    ).status,
    409,
  );
  assert.equal(env.sql.prepare("SELECT COUNT(*) n FROM items").get().n, 4);
  delete env.STORAGE_QUOTA_BYTES;
  await call(env, "alice", `/${nested.id}/manage`, {
    action: "trash",
    revision: 1,
  });
  assert.equal(
    (
      await call(env, "alice", `/${nested.id}/copy`, {
        name: "Restore first",
        parent: "",
        revision: 2,
      })
    ).status,
    400,
  );
});

test("rolling history keeps newest versions, preserves current content, and allows further saves at quota", async () => {
  const env = testDB();
  env.HISTORY_RETENTION_MODE = "rolling";
  env.HISTORY_MAX_VERSIONS = "2";
  env.STORAGE_QUOTA_BYTES = "9";
  let file = await create(env, "one");
  for (const content of ["two", "tri", "for", "fiv"]) {
    const response = await update(env, file, content);
    assert.equal(response.status, 200);
    file = await response.json();
  }
  const history = await versions(env, file);
  assert.deepEqual(
    history.versions.map((v) => v.revision),
    [5, 4, 3],
  );
  assert.equal(history.historyMode, "rolling");
  assert.equal(
    (await call(env, "alice", `/${file.id}/versions/${file.id}:1`)).status,
    404,
  );
  assert.equal((await call(env, "alice", `/${file.id}`)).status, 200);
  const usage = await (await call(env, "alice", "/usage")).json();
  assert.equal(usage.usedBytes, 9);
  assert.equal(usage.historyBytes, 6);
  assert.throws(() => env.sql.exec("DELETE FROM file_versions"), /IMMUTABLE/);
  const failed = await update(env, file, "too large");
  assert.equal(failed.status, 413);
  assert.deepEqual(
    (await versions(env, file)).versions.map((v) => v.revision),
    [5, 4, 3],
  );
  // Renaming/trashing must remain usable after reaching the history cap.
  const renamed = await call(env, "alice", `/${file.id}/manage`, {
    action: "rename",
    revision: file.revision,
    name: "Renamed.fountain",
  });
  assert.equal(renamed.status, 200);
  assert.deepEqual(
    (await versions(env, file)).versions.map((v) => v.revision),
    [6, 5, 4],
  );
});

test("rolling retention isolates owners, rejects stale writes without pruning, and restores as a new bounded revision", async () => {
  const env = testDB();
  env.HISTORY_RETENTION_MODE = "rolling";
  env.HISTORY_MAX_VERSIONS = "1";
  let file = await create(env, "original");
  const bob = await create(env, "bob", "", "Bob.fountain", "bob");
  const stale = file;
  file = await (await update(env, file, "second")).json();
  file = await (await update(env, file, "third")).json();
  assert.equal((await update(env, stale, "stale")).status, 409);
  assert.equal((await versions(env, file)).versions.length, 2);
  const restored = await call(env, "alice", `/${file.id}/restore`, {
    revision: file.revision,
    versionId: `${file.id}:2`,
  });
  assert.equal(restored.status, 200);
  const current = await (await call(env, "alice", `/${file.id}`)).json();
  assert.equal(current.content, "second");
  assert.deepEqual(
    (await versions(env, file)).versions.map((v) => v.revision),
    [4, 3],
  );
  assert.equal((await versions(env, bob, "bob")).versions.length, 1);
});

test("rolling zero history retains only the current file", async () => {
  const env = testDB();
  env.HISTORY_RETENTION_MODE = "rolling";
  env.HISTORY_MAX_VERSIONS = "0";
  env.STORAGE_QUOTA_BYTES = "3";
  let file = await create(env, "one");
  file = await (await update(env, file, "two")).json();
  assert.deepEqual(
    (await versions(env, file)).versions.map((v) => v.revision),
    [2],
  );
  assert.equal(
    (await (await call(env, "alice", "/usage")).json()).usedBytes,
    3,
  );
});
