import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";

const worker = await readFile(new URL("../../github-worker/src/index.mjs", import.meta.url), "utf8");
const folderId = "destination-folder_123";
const writableFolder = {
  id: folderId,
  mimeType: "application/vnd.google-apps.folder",
  trashed: false,
  capabilities: { canAddChildren: true },
};

function folderHarness({ folder = writableFolder, status = 200, networkError = false } = {}) {
  const requests = [];
  const context = {
    URL,
    Response,
    getGoogleSession: async () => ({ access_token: "test-token" }),
    randomToken: (length) => "a".repeat(length * 2),
    json: (body, code = 200) => Response.json(body, { status: code }),
    fetch: async (url, init) => {
      requests.push({ url, ...init });
      if (url.pathname.startsWith("/upload/")) return Response.json({ id: "created-file_123", name: "Script.fountain" });
      if (networkError) throw new Error("Network unavailable");
      return Response.json(status === 200 ? folder : { error: { message: "Folder unavailable" } }, { status });
    },
  };
  runInNewContext(worker.slice(worker.indexOf("async function driveFetch("), worker.indexOf("async function authorizeCollaboration(")), context);
  return {
    requests,
    create: async (body) => {
      const request = new Request("https://api.example/api/google/drive/files", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Script.fountain", content: "INT. ROOM - DAY", ...body }),
      });
      try {
        return await context.googleApiRequest(request, {}, new URL(request.url));
      } catch (error) {
        if (error instanceof Response) return error;
        throw error;
      }
    },
  };
}

function uploadedMetadata(request) {
  assert.equal(request.method, "POST");
  assert.equal(request.url.pathname, "/upload/drive/v3/files");
  assert.equal(request.url.searchParams.get("uploadType"), "multipart");
  assert.equal(request.url.searchParams.get("supportsAllDrives"), "true");
  assert.match(request.headers["content-type"], /^multipart\/related; boundary=fp_/);
  assert.match(request.body, /Content-Type: text\/plain; charset=UTF-8\r\n\r\nINT\. ROOM - DAY\r\n/);
  const metadata = JSON.parse(request.body.split("\r\n\r\n")[1].split("\r\n--")[0]);
  assert.equal(metadata.name, "Script.fountain");
  assert.equal(metadata.mimeType, "text/plain");
  assert.equal(metadata.appProperties.fountainPublisherDocument, "true");
  assert.match(metadata.appProperties.fountainPublisherDocumentId, /^[a-f0-9]{48}$/);
  return metadata;
}

test("Drive creation preserves legacy root and accepts explicit root without a folder lookup", async () => {
  for (const parentId of [undefined, "root"]) {
    const harness = folderHarness();
    const response = await harness.create({ parentId });
    assert.equal(response.status, 201);
    assert.equal((await response.json()).file.id, "created-file_123");
    assert.equal(harness.requests.length, 1);
    const metadata = uploadedMetadata(harness.requests[0]);
    if (parentId === undefined) assert.equal(Object.hasOwn(metadata, "parents"), false);
    else assert.deepEqual(metadata.parents, ["root"]);
  }
});

test("Drive creation validates a writable folder before uploading with its parent", async () => {
  for (const parentId of [folderId, "a".repeat(10), "Z".repeat(200)]) {
    const harness = folderHarness({ folder: { ...writableFolder, id: parentId } });
    const response = await harness.create({ parentId });
    assert.equal(response.status, 201);
    assert.equal(harness.requests.length, 2);
    const [lookup, upload] = harness.requests;
    assert.equal(lookup.url.pathname, `/drive/v3/files/${parentId}`);
    assert.equal(lookup.url.searchParams.get("fields"), "id,mimeType,trashed,capabilities(canAddChildren)");
    assert.equal(lookup.url.searchParams.get("supportsAllDrives"), "true");
    assert.equal(lookup.method, undefined);
    assert.equal(lookup.headers.authorization, ["Bearer", "test-token"].join(" "));
    assert.deepEqual(uploadedMetadata(upload).parents, [parentId]);
  }
});

test("Drive creation rejects invalid parent IDs and types before any Drive request", async () => {
  for (const parentId of [
    null, true, false, 1234567890, [], [folderId], {}, { id: folderId },
    "", "ROOT", "short", "a".repeat(201), "../folder_123", "folder/name_123",
    "folder\\name_123", "folder%2Fname_123", "folder?name_123", "folder#name_123",
    ` ${folderId}`, `${folderId} `, `${folderId}\n`, `${folderId}\r`,
    `${folderId}\u0000`, `${folderId}\u2028`, "földér-name_123",
  ]) {
    const harness = folderHarness();
    const response = await harness.create({ parentId });
    assert.equal(response.status, 400, JSON.stringify(parentId));
    assert.equal((await response.json()).error, "Invalid Drive folder");
    assert.equal(harness.requests.length, 0);
  }
});

test("Drive creation rejects nonfolders, trashed folders, and unwritable folders without uploading", async () => {
  for (const [folder, status] of [
    [{ ...writableFolder, mimeType: "text/plain" }, 400],
    [{ ...writableFolder, mimeType: "application/vnd.google-apps.shortcut" }, 400],
    [{ ...writableFolder, trashed: true }, 400],
    [{ ...writableFolder, capabilities: { canAddChildren: false, canEdit: true } }, 403],
    [{ ...writableFolder, capabilities: { canAddChildren: "true" } }, 403],
    [{ ...writableFolder, capabilities: {} }, 403],
    [{ ...writableFolder, capabilities: undefined }, 403],
  ]) {
    const harness = folderHarness({ folder });
    assert.equal((await harness.create({ parentId: folderId })).status, status);
    assert.equal(harness.requests.length, 1);
    assert.equal(harness.requests[0].url.pathname, `/drive/v3/files/${folderId}`);
  }
});

test("Drive folder lookup errors never fall back to an upload", async () => {
  for (const status of [401, 403, 404, 429, 500]) {
    const harness = folderHarness({ status });
    const response = await harness.create({ parentId: folderId });
    assert.equal(response.status, status);
    assert.equal((await response.json()).error, "Folder unavailable");
    assert.equal(harness.requests.length, 1);
  }
  const harness = folderHarness({ networkError: true });
  await assert.rejects(harness.create({ parentId: folderId }), /Network unavailable/);
  assert.equal(harness.requests.length, 1);
});
