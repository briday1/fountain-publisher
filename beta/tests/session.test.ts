import { it, expect, vi } from "vitest";
import { DocumentSession } from "../src/core/session";
import { emptyScreenplay } from "../src/core/model";
const initial = () => ({
  id: "draft",
  name: "Draft.fountain",
  screenplay: emptyScreenplay(),
  epoch: 0,
});
const deferred = () => {
  let resolve!: (value: unknown) => void;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};
it("does not acknowledge newer typing as saved when an older save completes", async () => {
  const wait = deferred();
  let revision = 0;
  const repo = {
    save: vi.fn(async (data) => {
      await wait.promise;
      return { ...data, revision: ++revision, createdAt: 0, updatedAt: 0 };
    }),
    writeRecovery: vi.fn(),
    setActiveId: vi.fn(),
  };
  const session = new DocumentSession(initial(), repo);
  const status = vi.fn();
  session.onStatus = status;
  session.markChanged();
  const saving = session.flush();
  session.markChanged();
  wait.resolve(null);
  await saving;
  expect(session.dirty).toBe(true);
  expect(status).not.toHaveBeenCalledWith("saved");
  await session.flush();
  expect(session.dirty).toBe(false);
  session.dispose();
});
it("finishes a queued durable save after the UI is disposed", async () => {
  const repo = {
    save: vi.fn(async (data) => ({
      ...data,
      revision: 1,
      createdAt: 0,
      updatedAt: 0,
    })),
    writeRecovery: vi.fn(),
    setActiveId: vi.fn(),
  };
  const session = new DocumentSession(initial(), repo);
  const saving = session.flush();
  session.dispose();
  await saving;
  expect(repo.save).toHaveBeenCalledOnce();
});
it("refuses a delayed document switch after the current document changes", async () => {
  const wait = deferred();
  const repo = {
    save: vi.fn(async (data) => {
      await wait.promise;
      return { ...data, revision: 1, createdAt: 0, updatedAt: 0 };
    }),
    writeRecovery: vi.fn(),
    setActiveId: vi.fn(),
  };
  const session = new DocumentSession(initial(), repo);
  const opening = session.open(emptyScreenplay(), "Other.fountain");
  session.markChanged();
  wait.resolve(null);
  await expect(opening).rejects.toThrow("changed");
  expect(session.current.name).toBe("Draft.fountain");
  session.dispose();
});
it("keeps edits made while an asynchronous before-open hook finishes", async () => {
  const wait = deferred();
  const repo = {
    save: vi.fn(async (data) => ({
      ...data,
      revision: 1,
      createdAt: 0,
      updatedAt: 0,
    })),
    writeRecovery: vi.fn(),
    setActiveId: vi.fn(),
  };
  const session = new DocumentSession(initial(), repo);
  const current = emptyScreenplay();
  const setDocument = vi.fn();
  session.editor = { getDocument: () => current, setDocument };
  session.onBeforeOpen = async () => {
    await wait.promise;
  };
  const opening = session.open(emptyScreenplay(), "Other.fountain");
  current.blocks[0].text = "The sentence written while the connection closes.";
  session.markChanged();
  wait.resolve(null);
  await expect(opening).rejects.toThrow("changed");
  expect(session.current.name).toBe("Draft.fountain");
  expect(session.current.screenplay.blocks[0].text).toBe(
    current.blocks[0].text,
  );
  expect(repo.save).toHaveBeenCalledWith(
    expect.objectContaining({ screenplay: current }),
    null,
  );
  expect(setDocument).not.toHaveBeenCalled();
  session.dispose();
});
it("does not fork another document that replaced the original while its hook was pending", async () => {
  const wait = deferred();
  const repo = {
    save: vi.fn(),
    writeRecovery: vi.fn(),
    setActiveId: vi.fn(),
  };
  const session = new DocumentSession(initial(), repo);
  session.onBeforeOpen = async () => {
    await wait.promise;
  };
  const forking = session.fork();
  session.current = {
    ...initial(),
    id: "different-document",
    name: "Other.fountain",
  };
  wait.resolve(null);
  await expect(forking).rejects.toThrow("active document changed");
  expect(session.current.id).toBe("different-document");
  expect(repo.save).not.toHaveBeenCalled();
  session.dispose();
});
it("keeps recovery on persistence failure and never claims success", async () => {
  const repo = {
    save: vi.fn().mockRejectedValue(new Error("Disk full")),
    writeRecovery: vi.fn(),
    setActiveId: vi.fn(),
  };
  const session = new DocumentSession(initial(), repo);
  const status = vi.fn();
  session.onStatus = status;
  await expect(session.flush()).rejects.toThrow("Disk full");
  expect(repo.writeRecovery).toHaveBeenCalled();
  expect(session.dirty).toBe(true);
  expect(status).toHaveBeenCalledWith("error", "Disk full");
  session.dispose();
});
it("never resets the editor or undo history when marking a cloud save complete", async () => {
  const repo = {
    save: vi.fn(async (data) => ({
      ...data,
      revision: 1,
      createdAt: 0,
      updatedAt: 0,
    })),
    writeRecovery: vi.fn(),
    setActiveId: vi.fn(),
  };
  const session = new DocumentSession(initial(), repo);
  const setDocument = vi.fn();
  session.editor = { getDocument: (base) => base, setDocument };
  session.setRemote(
    { provider: "google", id: "drive-file", etag: "v1" },
    session.token(),
  );
  await session.flush();
  expect(setDocument).not.toHaveBeenCalled();
  session.dispose();
});
