import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

const app = await readFile(new URL("../../src/fountain_publisher/web/app.mjs", import.meta.url), "utf8");
const code = app.slice(app.indexOf("async function openGoogleRecovery("), app.indexOf("async function refreshGoogleSession("));

function harness() {
  const nodes = new Map(), downloads = [], requests = [];
  const state = { filename: "Draft.fountain", googleDriveFile: { id: "file", appProperties: { fountainPublisherDocumentId: "room" } } };
  const context = {
    state, source: { value: "local draft" }, Blob,
    $: id => { if (!nodes.has(id)) nodes.set(id, { disabled: false, showModal() {} }); return nodes.get(id); },
    googleRequest: async url => { requests.push(url); return { roomContent: "shared", driveContent: "stored" }; },
    download: async (blob, name) => downloads.push({ name, text: await blob.text() }),
    toast() {},
  };
  runInNewContext(code, context);
  return { context, nodes, downloads, requests, state };
}

test("recovery downloads individually named copies without changing the editor or remote files", async () => {
  const h = harness(); await h.context.openGoogleRecovery();
  assert.equal(h.requests[0], "/api/collaboration/room/recovery?fileId=file");
  h.context.source.value = "newer typing";
  for (const version of ["local", "room", "drive"]) await h.context.downloadGoogleRecovery(version);
  assert.deepEqual(h.downloads, [
    { name: "Draft-local-recovery.fountain", text: "local draft" },
    { name: "Draft-room-recovery.fountain", text: "shared" },
    { name: "Draft-drive-recovery.fountain", text: "stored" },
  ]);
  assert.equal(h.context.source.value, "newer typing");
  assert.equal(h.requests.length, 1);
});

test("failed recovery authorization keeps only the local backup available", async () => {
  const h = harness(); h.context.googleRequest = async () => { throw new Error("Access denied"); };
  await h.context.openGoogleRecovery();
  assert.match(h.nodes.get("#google-recovery-status").textContent, /Access denied/);
  assert.equal(h.nodes.get("#google-recovery-room").disabled, true);
  assert.equal(h.nodes.get("#google-recovery-drive").disabled, true);
  await h.context.downloadGoogleRecovery("room"); await h.context.downloadGoogleRecovery("local");
  assert.equal(h.downloads.length, 1); assert.equal(h.downloads[0].text, "local draft");
});

test("a late recovery fetch cannot repopulate a closed dialog", async () => {
  const h = harness(); let finish;
  h.context.googleRequest = () => new Promise(resolve => { finish = resolve; });
  const opening = h.context.openGoogleRecovery(); h.state.googleRecovery = null;
  finish({ roomContent: "shared", driveContent: "stored" }); await opening;
  assert.equal(h.state.googleRecovery, null);
  assert.equal(h.nodes.get("#google-recovery-room").disabled, true);
});
