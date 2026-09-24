import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DestinationSync,
  type DestinationDraft,
  type DestinationSnapshot,
  type DestinationStatus,
} from "../src/core/destinationSync";

const initial = (): DestinationSnapshot => ({ name: "Draft.fountain", content: "Original", revision: "1" });
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
}
function fixture(canWrite = true) {
  let local: DestinationDraft = initial();
  let remote = initial();
  let persisted = initial();
  const statuses: DestinationStatus[] = [];
  const read = vi.fn(async () => ({ ...remote }));
  const write = vi.fn(async (draft: DestinationSnapshot) => {
    if (draft.revision !== remote.revision) throw { status: 409 };
    remote = { ...draft, revision: String(Number(remote.revision) + 1) };
    return { ...remote };
  });
  const apply = vi.fn(async (next: DestinationSnapshot, expected: DestinationDraft) => {
    if (local.name !== expected.name || local.content !== expected.content) throw { code: "LOCAL_CONFLICT" };
    local = { content: next.content, name: next.name };
  });
  const acknowledge = vi.fn(async (next: DestinationSnapshot) => { persisted = { ...next }; });
  const sync = new DestinationSync({
    base: initial(), adapter: { read, write }, canWrite,
    capture: () => ({ ...local }), apply, acknowledge,
    onStatus: (status) => statuses.push(status),
  });
  return {
    sync, read, write, apply, acknowledge, statuses,
    edit(content: string) { local = { ...local, content }; sync.changed(); },
    setLocal(value: DestinationDraft) { local = { ...value }; },
    setRemote(value: DestinationSnapshot) { remote = { ...value }; },
    get local() { return local; },
    get persisted() { return persisted; },
    get last() { return statuses.at(-1); },
  };
}

describe("destination autosave and synchronization", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("debounces edits and enforces a maximum wait during continuous typing", async () => {
    const f = fixture();
    f.edit("one");
    await vi.advanceTimersByTimeAsync(600);
    f.edit("two");
    await vi.advanceTimersByTimeAsync(999);
    expect(f.write).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(f.write).toHaveBeenCalledWith({ ...initial(), content: "two" });
    expect(f.last?.phase).toBe("saved");
    f.edit("continuous-0");
    for (let i = 1; i <= 6; i++) {
      await vi.advanceTimersByTimeAsync(800);
      f.edit(`continuous-${i}`);
    }
    expect(f.write).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(200);
    expect(f.write).toHaveBeenCalledTimes(2);
    expect(f.write.mock.calls[1][0].content).toBe("continuous-6");
    f.sync.dispose();
  });

  it("serializes writes and saves typing that arrives during an older write", async () => {
    const f = fixture();
    const waiting = deferred<DestinationSnapshot>();
    f.write.mockImplementationOnce(() => waiting.promise);
    f.edit("first edit");
    const first = f.sync.flush();
    await Promise.resolve();
    f.edit("newer edit");
    const second = f.sync.flush();
    expect(f.write).toHaveBeenCalledTimes(1);
    f.setRemote({ ...initial(), content: "first edit", revision: "2" });
    waiting.resolve({ ...initial(), content: "first edit", revision: "2" });
    await first;
    await second;
    expect(f.write.mock.calls[1][0]).toEqual({ ...initial(), content: "newer edit", revision: "2" });
    expect(f.local.content).toBe("newer edit");
    expect(f.persisted.content).toBe("newer edit");
    expect(f.sync.dirty).toBe(false);
    f.sync.dispose();
  });

  it("automatically schedules another save for typing during a write", async () => {
    const f = fixture();
    const waiting = deferred<DestinationSnapshot>();
    f.write.mockImplementationOnce(() => waiting.promise);
    f.edit("first");
    const flush = f.sync.flush();
    await Promise.resolve();
    f.edit("second");
    f.setRemote({ ...initial(), content: "first", revision: "2" });
    waiting.resolve({ ...initial(), content: "first", revision: "2" });
    await flush;
    expect(f.last?.phase).toBe("pending");
    expect(f.sync.dirty).toBe(true);
    await vi.advanceTimersByTimeAsync(1000);
    expect(f.write).toHaveBeenCalledTimes(2);
    expect(f.last?.phase).toBe("saved");
    f.sync.dispose();
  });

  it("applies a newer shared snapshot only when the local draft is clean", async () => {
    const f = fixture();
    const next = { ...initial(), content: "Other device", revision: "2" };
    f.setRemote(next);
    await f.sync.refresh();
    expect(f.apply).toHaveBeenCalledWith(next, initial());
    expect(f.local.content).toBe("Other device");
    expect(f.persisted).toEqual(next);
    expect(f.write).not.toHaveBeenCalled();
    expect(f.last?.phase).toBe("saved");
  });

  it("does not acknowledge unchanged refreshes and avoids broadcast feedback loops", async () => {
    const f = fixture();
    await f.sync.refresh();
    await f.sync.refresh();
    expect(f.acknowledge).not.toHaveBeenCalled();
    expect(f.apply).not.toHaveBeenCalled();
    expect(f.write).not.toHaveBeenCalled();
    expect(f.last?.phase).toBe("saved");
  });

  it("synchronizes a name-only edit using the existing revision", async () => {
    const f = fixture();
    f.setLocal({ name: "Renamed.fountain", content: initial().content });
    f.sync.changed();
    await f.sync.flush();
    expect(f.write).toHaveBeenCalledWith({ ...initial(), name: "Renamed.fountain" });
    expect(f.last?.phase).toBe("saved");
  });

  it("preserves a dirty draft and old base on a remote conflict, including later flushes", async () => {
    const f = fixture();
    f.edit("Local work");
    f.setRemote({ ...initial(), content: "Remote work", revision: "2" });
    await f.sync.refresh();
    await f.sync.flush();
    f.edit("Still local");
    await vi.advanceTimersByTimeAsync(10000);
    expect(f.last?.phase).toBe("conflict");
    expect(f.apply).not.toHaveBeenCalled();
    expect(f.acknowledge).not.toHaveBeenCalled();
    expect(f.write).not.toHaveBeenCalled();
    expect(f.persisted).toEqual(initial());
    expect(f.local.content).toBe("Still local");
  });

  it("acknowledges an identical remote draft without writing or replacing local content", async () => {
    const f = fixture();
    f.edit("Identical");
    const next = { ...initial(), content: "Identical", revision: "7" };
    f.setRemote(next);
    await f.sync.refresh();
    expect(f.persisted).toEqual(next);
    expect(f.sync.dirty).toBe(false);
    expect(f.apply).not.toHaveBeenCalled();
    expect(f.write).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(5000);
    expect(f.write).not.toHaveBeenCalled();
  });

  it("retains local work offline and retries only when explicitly refreshed", async () => {
    const f = fixture();
    f.write.mockRejectedValueOnce({ status: 0 });
    f.edit("Offline work");
    await vi.advanceTimersByTimeAsync(1000);
    expect(f.last?.phase).toBe("offline");
    f.edit("More offline work");
    await vi.advanceTimersByTimeAsync(10000);
    expect(f.write).toHaveBeenCalledTimes(1);
    expect(f.sync.dirty).toBe(true);
    await f.sync.refresh();
    expect(f.write).toHaveBeenCalledTimes(2);
    expect(f.last?.phase).toBe("saved");
    expect(f.persisted.content).toBe("More offline work");
  });

  it("passive refresh checks for changes without retrying a paused failed save", async () => {
    const f = fixture();
    f.write.mockRejectedValueOnce({ status: 0 });
    f.edit("Pending local work");
    await f.sync.flush();
    await f.sync.refresh(false);
    await f.sync.refresh(false);
    expect(f.read).toHaveBeenCalledTimes(2);
    expect(f.write).toHaveBeenCalledOnce();
    expect(f.last?.phase).toBe("offline");
    await f.sync.refresh();
    expect(f.write).toHaveBeenCalledTimes(2);
    expect(f.last?.phase).toBe("saved");
  });

  it("passive refresh still detects a remote conflict while a failed save is paused", async () => {
    const f = fixture();
    f.write.mockRejectedValueOnce({ status: 0 });
    f.edit("Pending local work");
    await f.sync.flush();
    f.setRemote({ ...initial(), content: "Other device", revision: "2" });
    await f.sync.refresh(false);
    expect(f.write).toHaveBeenCalledOnce();
    expect(f.last?.phase).toBe("conflict");
    expect(f.local.content).toBe("Pending local work");
  });

  it.each([409, 412])("never retries a conditional write rejected with %s", async (status) => {
    const f = fixture();
    f.write.mockRejectedValueOnce({ status });
    f.edit("Keep this");
    await f.sync.flush();
    await f.sync.flush();
    await f.sync.refresh();
    expect(f.write).toHaveBeenCalledTimes(1);
    expect(f.last?.phase).toBe("conflict");
    expect(f.persisted).toEqual(initial());
    expect(f.local.content).toBe("Keep this");
  });

  it("ignores a completed read after disposal and skips queued writes", async () => {
    const f = fixture();
    const waiting = deferred<DestinationSnapshot>();
    f.read.mockReturnValueOnce(waiting.promise);
    const read = f.sync.refresh();
    await Promise.resolve();
    f.edit("Local");
    const write = f.sync.flush();
    f.sync.dispose();
    const count = f.statuses.length;
    waiting.resolve({ ...initial(), content: "Remote", revision: "2" });
    await Promise.all([read, write]);
    expect(f.apply).not.toHaveBeenCalled();
    expect(f.acknowledge).not.toHaveBeenCalled();
    expect(f.write).not.toHaveBeenCalled();
    expect(f.statuses).toHaveLength(count);
  });

  it("does not acknowledge a completed write after disposal", async () => {
    const f = fixture();
    const waiting = deferred<DestinationSnapshot>();
    f.write.mockReturnValueOnce(waiting.promise);
    f.edit("Local");
    const write = f.sync.flush();
    await Promise.resolve();
    f.sync.dispose();
    waiting.resolve({ ...initial(), content: "Local", revision: "2" });
    await write;
    expect(f.acknowledge).not.toHaveBeenCalled();
    expect(f.persisted).toEqual(initial());
  });

  it("allows read-only destinations to refresh while refusing all writes", async () => {
    const f = fixture(false);
    f.setRemote({ ...initial(), content: "Fresh read", revision: "2" });
    await f.sync.refresh();
    expect(f.local.content).toBe("Fresh read");
    f.edit("Read-only local draft");
    await f.sync.flush();
    await vi.advanceTimersByTimeAsync(10000);
    expect(f.write).not.toHaveBeenCalled();
    expect(f.sync.dirty).toBe(true);
    expect(f.last?.phase).toBe("readonly");
    f.sync.setWritable(true);
    await vi.advanceTimersByTimeAsync(1000);
    expect(f.last?.phase).toBe("saved");
    expect(f.persisted.content).toBe("Read-only local draft");
  });

  it("serializes refresh behind an in-flight write", async () => {
    const f = fixture();
    const waiting = deferred<DestinationSnapshot>();
    f.write.mockReturnValueOnce(waiting.promise);
    f.edit("Local");
    const save = f.sync.flush();
    await Promise.resolve();
    const refresh = f.sync.refresh();
    expect(f.read).not.toHaveBeenCalled();
    const next = { ...initial(), content: "Local", revision: "2" };
    f.setRemote(next);
    waiting.resolve(next);
    await Promise.all([save, refresh]);
    expect(f.read).toHaveBeenCalledOnce();
    expect(f.last?.phase).toBe("saved");
  });

  it("detects typing while a remote read is in flight", async () => {
    const f = fixture();
    const waiting = deferred<DestinationSnapshot>();
    f.read.mockReturnValueOnce(waiting.promise);
    const refreshing = f.sync.refresh();
    await Promise.resolve();
    f.edit("Do not replace");
    waiting.resolve({ ...initial(), content: "Other device", revision: "2" });
    await refreshing;
    expect(f.apply).not.toHaveBeenCalled();
    expect(f.last?.phase).toBe("conflict");
    expect(f.local.content).toBe("Do not replace");
  });

  it("requires the atomic apply guard and preserves typing during a delayed apply", async () => {
    const f = fixture();
    const waiting = deferred<void>();
    f.apply.mockImplementationOnce(async (_remote, expected) => {
      await waiting.promise;
      if (f.local.content !== expected.content) throw { code: "LOCAL_CONFLICT" };
    });
    f.setRemote({ ...initial(), content: "Remote", revision: "2" });
    const refresh = f.sync.refresh();
    await Promise.resolve();
    await Promise.resolve();
    f.edit("Typing during apply");
    waiting.resolve();
    await refresh;
    expect(f.local.content).toBe("Typing during apply");
    expect(f.acknowledge).not.toHaveBeenCalled();
    expect(f.last?.phase).toBe("conflict");
  });

  it("does not report saved or advance base when acknowledgment persistence fails", async () => {
    const f = fixture();
    f.acknowledge.mockRejectedValueOnce(new Error("Storage unavailable"));
    f.edit("Written remotely");
    await f.sync.flush();
    expect(f.last?.phase).toBe("error");
    expect(f.sync.dirty).toBe(true);
    expect(f.persisted).toEqual(initial());
    await vi.advanceTimersByTimeAsync(10000);
    expect(f.write).toHaveBeenCalledOnce();
    await f.sync.refresh();
    expect(f.last?.phase).toBe("saved");
    expect(f.write).toHaveBeenCalledOnce();
  });

  it("rechecks edits made during acknowledgment and never marks them synchronized", async () => {
    const f = fixture();
    const waiting = deferred<void>();
    f.acknowledge.mockImplementationOnce(async () => { await waiting.promise; });
    f.edit("Earlier");
    const saving = f.sync.flush();
    await Promise.resolve();
    await Promise.resolve();
    f.edit("Later");
    waiting.resolve();
    await saving;
    expect(f.last?.phase).toBe("pending");
    expect(f.sync.dirty).toBe(true);
    expect(f.local.content).toBe("Later");
    f.sync.dispose();
  });
});
