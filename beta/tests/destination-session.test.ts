// @vitest-environment node
import "fake-indexeddb/auto";
import { afterEach, expect, it, vi } from "vitest";
import { DocumentSession } from "../src/core/session";
import { emptyScreenplay } from "../src/core/model";
import { serializeFountain } from "../src/core/fountain";
import { importScreenplay } from "../src/core/fdx";
import { WorkspaceRepository, type WorkspaceDocument } from "../src/storage/workspace";
import { canonicalContent, destinationAdapter, type WriteShapeDestination } from "../src/storage/destinations";
import { cloudRequest, libraryRequest } from "../src/storage/writeshapeLibrary";
import { readDirectoryFile, type FileHandle } from "../src/storage/localDirectory";

vi.mock("../src/storage/writeshapeLibrary", () => ({ cloudRequest: vi.fn(), libraryRequest: vi.fn() }));
const repositories: WorkspaceRepository[] = [];
const sessions: DocumentSession[] = [];
function repo() { const value = new WorkspaceRepository(crypto.randomUUID()); repositories.push(value); return value; }
function script(text: string) { const value = emptyScreenplay(); value.blocks[0].text = text; return value; }
function destination(overrides: Partial<WriteShapeDestination> = {}): WriteShapeDestination {
  return { provider: "writeshape", id: "remote-file", accountId: "owner", parent: "folder", name: "Draft.fountain", revision: "1", baseContent: serializeFountain(script("Original")), canWrite: true, ...overrides };
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((r) => { resolve = r; }); return { promise, resolve }; }
function session(initial: WorkspaceDocument, repository: WorkspaceRepository) { const s = new DocumentSession(initial, repository); sessions.push(s); return s; }
async function saved(repository: WorkspaceRepository) { return repository.save({ id: "draft", name: "Draft.fountain", screenplay: script("Original"), destination: destination() }, null); }

afterEach(async () => { for (const s of sessions.splice(0)) s.dispose(); for (const r of repositories.splice(0)) await r.close(); vi.restoreAllMocks(); vi.clearAllMocks(); });

it("persists destination ownership, revision and canonical base across device reload", async () => {
  const r = repo();
  const initial = await saved(r);
  const first = session(initial, r);
  const binding = destination({ revision: "8", baseContent: serializeFountain(script("Last synced")) });
  first.setDestination(binding);
  first.rename("Local title.fountain");
  await first.flush();
  const reloaded = await r.load(initial.id);
  const next = session(reloaded!, r);
  expect(next.current.destination).toEqual(binding);
  expect(next.current.name).toBe("Local title.fountain");
  expect(next.dirty).toBe(false);
});

it("forks the draft without carrying remote ownership or a destination binding", async () => {
  const r = repo();
  const initial = await saved(r);
  const s = session(initial, r);
  await s.fork();
  expect(s.current.id).not.toBe(initial.id);
  expect(s.current.destination).toBeUndefined();
  expect(s.current.remote).toBeUndefined();
  expect((await r.load(s.current.id))?.destination).toBeUndefined();
  expect((await r.load(initial.id))?.destination).toEqual(initial.destination);
});

it("guarded external apply keeps edits made while the device flush is awaiting persistence", async () => {
  const r = repo();
  const s = session(await saved(r), r);
  s.markChanged();
  const expected = s.token();
  const wait = deferred<void>();
  const originalSave = r.save.bind(r);
  vi.spyOn(r, "save").mockImplementationOnce(async (...args) => { await wait.promise; return originalSave(...args); });
  const replacement = script("Remote update");
  const apply = s.applyExternal(replacement, "Remote.fountain", expected);
  await Promise.resolve();
  s.rename("Typing continued.fountain");
  wait.resolve();
  await expect(apply).rejects.toThrow("changed");
  expect(s.current.name).toBe("Typing continued.fountain");
  expect(s.current.screenplay.blocks[0].text).toBe("Original");
});

it("opens a shared file with its destination already attached in the first visible snapshot", async () => {
  const r = repo();
  const initial = await saved(r);
  const s = session(initial, r);
  const binding = destination({ id: "another-shared-file", revision: "9" });
  const snapshots: Array<{ id: string; destination?: WriteShapeDestination }> = [];
  s.onSnapshot = value => { snapshots.push({ id: value.id, destination: value.destination }); };
  await s.open(script("Opened shared file"), binding.name, undefined, undefined, binding);
  const firstNew = snapshots.find(value => value.id !== initial.id);
  expect(firstNew?.destination).toEqual(binding);
  expect((await r.load(s.current.id))?.destination).toEqual(binding);
});

it("revalidates account or provider access after asynchronous preparation before switching", async () => {
  const r = repo();
  const initial = await saved(r);
  const s = session(initial, r);
  const wait = deferred<void>();
  let permitted = true;
  s.onBeforeOpen = () => wait.promise;
  const opening = s.open(script("Restricted content"), "Other.fountain", undefined, undefined, destination({ id: "other" }), () => {
    if (!permitted) throw new Error("Account changed");
  });
  permitted = false;
  wait.resolve();
  await expect(opening).rejects.toThrow("Account changed");
  expect(s.current.id).toBe(initial.id);
  expect(s.current.screenplay.blocks[0].text).toBe("Original");
});

it("revalidates the active destination after flushing before applying external content", async () => {
  const r = repo();
  const s = session(await saved(r), r);
  s.markChanged();
  const token = s.token();
  const wait = deferred<void>();
  const originalSave = r.save.bind(r);
  vi.spyOn(r, "save").mockImplementationOnce(async (...args) => { await wait.promise; return originalSave(...args); });
  let permitted = true;
  const applying = s.applyExternal(script("Remote"), "Remote.fountain", token, () => {
    if (!permitted) throw new Error("Destination changed");
  });
  await Promise.resolve();
  permitted = false;
  wait.resolve();
  await expect(applying).rejects.toThrow("Destination changed");
  expect(s.current.screenplay.blocks[0].text).toBe("Original");
});

it("adopts a newer workspace revision only for the same clean document", async () => {
  const r = repo();
  const initial = await saved(r);
  const s = session(initial, r);
  const remote = await r.save({ ...initial, screenplay: script("Other tab"), destination: destination({ revision: "2" }) }, initial.revision);
  expect(await s.adoptWorkspace({ ...remote, id: "other-document" })).toBe(false);
  expect(await s.adoptWorkspace(remote)).toBe(true);
  expect(s.current.destination?.revision).toBe("2");
  expect(s.current.screenplay.blocks[0].text).toBe("Other tab");
  s.rename("My newer edit.fountain");
  expect(await s.adoptWorkspace({ ...remote, revision: 3 })).toBe(false);
  expect(s.current.name).toBe("My newer edit.fountain");
});

it("refuses out-of-order workspace adoption that would roll a clean document backward", async () => {
  const r = repo();
  const initial = await saved(r);
  const s = session(initial, r);
  const newest = { ...initial, revision: 3, screenplay: script("Newest"), destination: destination({ revision: "3" }) };
  expect(await s.adoptWorkspace(newest)).toBe(true);
  expect(await s.adoptWorkspace({ ...initial, revision: 2, screenplay: script("Stale response") })).toBe(false);
  expect(s.current.screenplay.blocks[0].text).toBe("Newest");
  expect(s.current.destination?.revision).toBe("3");
});

it("propagates cloud stale revisions without manufacturing a successful acknowledgment", async () => {
  const binding = destination();
  const adapter = destinationAdapter(() => binding);
  vi.mocked(libraryRequest).mockRejectedValueOnce(Object.assign(new Error("Newer version"), { status: 409, code: "REVISION_CONFLICT" }));
  const draft = { content: "My draft", name: binding.name, revision: "1" };
  await expect(adapter.write(draft)).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
  expect(libraryRequest).toHaveBeenCalledWith("", { id: binding.id, parent: "folder", kind: "file", revision: 1, name: binding.name, content: draft.content });
  expect(binding.revision).toBe("1");
});

it("uses Drive etags for conditional saves and propagates stale preconditions", async () => {
  const binding = destination({ provider: "drive", revision: '"etag-1"' });
  const adapter = destinationAdapter(() => binding);
  vi.mocked(cloudRequest).mockRejectedValueOnce(Object.assign(new Error("Changed"), { status: 412 }));
  await expect(adapter.write({ content: "Mine", name: binding.name, revision: binding.revision })).rejects.toMatchObject({ status: 412 });
  expect(cloudRequest).toHaveBeenCalledWith("/api/drive/save", expect.objectContaining({ id: binding.id, etag: '"etag-1"', content: "Mine" }));
});

it("does not claim a Drive rename was persisted when the provider retained the original name", async () => {
  const binding = destination({ provider: "drive", revision: '"etag-1"' });
  vi.mocked(cloudRequest).mockResolvedValueOnce({ name: binding.name, etag: '"etag-2"' });
  const outcome = await destinationAdapter(() => binding).write({ content: "Saved", name: "Renamed.fountain", revision: binding.revision }).then(
    value => ({ value, rejected: false }),
    () => ({ value: undefined, rejected: true }),
  );
  if (!outcome.rejected) expect(outcome.value?.name).toBe(binding.name);
});

function localHandle(raw: string) {
  let content = raw;
  let afterClose: string | undefined;
  const handle: FileHandle = {
    kind: "file", name: "Draft.fountain",
    queryPermission: async () => "granted", requestPermission: async () => "granted",
    getFile: async () => new File([content], "Draft.fountain", { type: "text/plain" }),
    createWritable: async () => {
      let pending = "";
      return { write: async value => { pending = value; }, close: async () => { content = afterClose ?? pending; }, abort: async () => {} };
    },
  };
  return { handle, replaceAfterClose(value: string) { afterClose = value; }, external(value: string) { content = value; } };
}

it("keeps a canonical local base while its SHA revision refers to original raw bytes", async () => {
  const raw = "INT. ROOM - DAY\r\n\r\nAn original line.\r\n";
  const local = localHandle(raw);
  const original = await readDirectoryFile(local.handle);
  const binding = destination({ provider: "local", handle: local.handle, revision: original.revision, baseContent: canonicalContent(raw, original.name) });
  const adapter = destinationAdapter(() => binding);
  const read = await adapter.read();
  expect(read.content).toBe(binding.baseContent);
  expect(read.revision).toBe(original.revision);
  local.external("INT. ROOM - DAY\n\nChanged externally.\n");
  const changed = await adapter.read();
  expect(changed.revision).not.toBe(binding.revision);
  expect(importScreenplay(changed.content, binding.name).screenplay.blocks.map(b => b.text)).toEqual(["INT. ROOM - DAY", "Changed externally."]);
  await expect(adapter.write({ name: binding.name, content: binding.baseContent, revision: binding.revision })).rejects.toMatchObject({ code: "LOCAL_CONFLICT" });
});

it("does not disguise a local file changed immediately after close as the submitted content", async () => {
  const local = localHandle("Original");
  const original = await readDirectoryFile(local.handle);
  const binding = destination({ provider: "local", handle: local.handle, revision: original.revision, baseContent: canonicalContent(original.content, original.name) });
  local.replaceAfterClose("External writer won");
  const result = await destinationAdapter(() => binding).write({ content: "Submitted", name: binding.name, revision: binding.revision });
  expect(importScreenplay(result.content, binding.name).screenplay.blocks[0].text).toBe("External writer won");
});
