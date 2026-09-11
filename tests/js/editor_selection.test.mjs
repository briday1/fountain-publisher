import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { parseFountainInline } from "../../src/fountain_publisher/web/fountain-inline.mjs";

const app = await readFile(new URL("../../src/fountain_publisher/web/app.mjs", import.meta.url), "utf8");
const section = (start, end) => app.slice(app.indexOf(start), app.indexOf(end, app.indexOf(start)));

function harness() {
  const events = [], domSelection = [];
  const source = {
    value: "!**Hello** world", selectionStart: 3, selectionEnd: 8, selectionDirection: "backward",
    setSelectionRange(start, end, direction) { this.selectionStart = start; this.selectionEnd = end; this.selectionDirection = direction; },
  };
  const line = { dataset: { line: "0" }, classList: { contains: name => name === "action" }, textContent: "Hello world" };
  const page = { contains: element => element === page };
  const document = { activeElement: source, body: { classList: { toggle: () => {} } } };
  const state = { documentRevision: 1, googleDriveFile: { id: "file" } };
  let callbacks;
  class Client {
    constructor(options) { callbacks = options; this.synced = true; }
    captureSelection(selection) { events.push(["capture", selection]); return selection; }
    resolveSelection() { return { anchor: 8, head: 3 }; }
    resumeRemoteUpdates() { events.push("resume"); }
  }
  const context = {
    source, page, document, state, CollaborationClient: Client, parseFountainInline,
    docSettings: { sceneNumbers: "off" },
    $: () => line, sourceLines: () => source.value.split("\n"),
    sourceOffsetForLine: (_lines, _line, column) => column,
    vimLinePosition: offset => ({ line: 0, column: offset, lines: [source.value] }),
    previewSelection: () => ({ startLine: line, endLine: line, startOffset: 0, endOffset: 5, direction: "backward" }),
    previewTextPoint: (element, offset) => ({ node: element, offset }),
    revealPreviewEmptyRun() {}, getSelection: () => ({ setBaseAndExtent: (...args) => domSelection.push(args) }),
    sourceChanged: options => events.push(["changed", options, state.collaborationApplying]),
    renderCollaborationPresence: () => events.push("presence"), scheduleWorkspaceCache() {},
  };
  runInNewContext([
    section("function fountainInlineSourceMap(", "function activeInlineMarkers("),
    section("function captureEditorSelection(", "const COLLABORATOR_COLORS"),
  ].join("\n"), context);
  return { context, callbacks, source, state, document, page, line, events, domSelection };
}

test("remote updates bypass local snapshot history and preserve backward Source selection", () => {
  const h = harness();
  const handle = h.callbacks.onBeforeRemoteUpdate();
  assert.equal(handle.surface, "source");
  assert.equal(handle.anchor, 8); assert.equal(handle.head, 3);
  h.callbacks.onDocument("!**Hello** world changed", true, handle);
  const change = h.events.find(event => event[0] === "changed");
  assert.equal(change[1].record, false); assert.equal(change[1].origin, "remote"); assert.equal(change[2], true);
  assert.equal(h.source.selectionStart, 3); assert.equal(h.source.selectionEnd, 8);
  assert.equal(h.source.selectionDirection, "backward");
  assert.equal(h.state.collaborationApplying, false);
  assert.deepEqual(h.domSelection, []);
});

test("Preview captures source coordinates and restores visible offsets across forced/inline markers", () => {
  const h = harness(); h.document.activeElement = h.page;
  const handle = h.callbacks.onBeforeRemoteUpdate();
  assert.equal(handle.surface, "preview"); assert.equal(handle.anchor, 8); assert.equal(handle.head, 3);
  h.callbacks.onDocument("!**Hello** world changed", true, handle);
  assert.equal(h.domSelection.length, 1);
  assert.deepEqual(h.domSelection[0], [h.line, 5, h.line, 0]);
});

test("remote selection restoration never steals focus from a dialog or applies another document's handle", () => {
  const h = harness(); h.document.activeElement = h.page;
  const handle = h.callbacks.onBeforeRemoteUpdate();
  h.document.activeElement = { dialog: true };
  h.context.restoreEditorSelection(handle);
  assert.deepEqual(h.domSelection, []);
  h.source.selectionStart = 1; h.state.documentRevision++;
  h.context.restoreEditorSelection(handle);
  assert.equal(h.source.selectionStart, 1);
});

test("composition flush resumes remote CRDT delivery only after both native surfaces release ownership", () => {
  const h = harness(); h.state.previewComposing = true;
  h.context.flushDeferredCollaborationDocument(); assert.deepEqual(h.events, []);
  h.state.previewComposing = false; h.state.sourceComposing = true;
  h.context.flushDeferredCollaborationDocument(); assert.deepEqual(h.events, []);
  h.state.sourceComposing = false;
  h.context.flushDeferredCollaborationDocument(); assert.deepEqual(h.events, ["resume"]);
});

test("server checkpoint acknowledges exactly the returned room text, only for its file", () => {
  const h = harness();
  h.callbacks.onCheckpoint({ file: { id: "other" }, content: "wrong" });
  assert.equal(h.state.savedSource, undefined);
  h.callbacks.onCheckpoint({ file: { id: "file" }, content: "acknowledged" });
  assert.equal(h.state.savedSource, "acknowledged");
  assert.equal(h.source.value, "!**Hello** world");
});
