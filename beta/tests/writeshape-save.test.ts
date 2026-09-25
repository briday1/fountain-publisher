import { expect, it, vi } from "vitest";
import { DocumentSession } from "../src/core/session";
import { emptyScreenplay } from "../src/core/model";
import { captureWriteShapeSave } from "../src/core/writeShapeSave";
function setup() {
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
  const session = new DocumentSession(
    {
      id: "draft",
      name: "Untitled.fountain",
      screenplay: emptyScreenplay(),
      epoch: 0,
    },
    repo,
  );
  return { session, repo };
}
it("renames and persists the captured draft after first cloud save, including typing during the request", async () => {
  const { session, repo } = setup();
  const associate = vi.fn();
  const save = captureWriteShapeSave(session, associate, () => true);
  session.current.screenplay.blocks[0].text = "Newer typing";
  session.markChanged();
  save.onSaved({ name: "The Last Light.fountain" });
  expect(session.current.name).toBe("The Last Light.fountain");
  expect(session.current.screenplay.blocks[0].text).toBe("Newer typing");
  expect(associate).toHaveBeenCalledWith(
    { name: "The Last Light.fountain" },
    "draft",
  );
  await session.flush();
  expect(repo.save.mock.calls.at(-1)?.[0].name).toBe("The Last Light.fountain");
  session.dispose();
});
it("does not rename or associate a different document when a delayed save finishes", async () => {
  const { session } = setup();
  const associate = vi.fn();
  const save = captureWriteShapeSave(session, associate, () => true);
  await session.open(emptyScreenplay(), "Other.fountain");
  save.onSaved({ name: "Earlier.fountain" });
  expect(session.current.name).toBe("Other.fountain");
  expect(associate).not.toHaveBeenCalled();
  session.dispose();
});
it("ignores completion from a replaced session", () => {
  const { session } = setup();
  const associate = vi.fn();
  const save = captureWriteShapeSave(session, associate, () => false);
  save.onSaved({ name: "Earlier.fountain" });
  expect(session.current.name).toBe("Untitled.fountain");
  expect(associate).not.toHaveBeenCalled();
  session.dispose();
});
