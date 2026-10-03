import { expect, it } from "vitest";
import { documentSaveLabel } from "../src/components/DocumentStatusBar";
import type { DocumentBuffer } from "../src/core/documentWorkspace";

it("reports the actual destination, including unsynced edits and conflicts", () => {
  const buffer = { snapshot: {}, status: "saved" } as DocumentBuffer;
  expect(documentSaveLabel(buffer)).toBe("Saved on this device");
  buffer.snapshot.destination = {
    provider: "writeshape",
    id: "file",
    name: "Draft.fountain",
    revision: "1",
    baseContent: "",
    canWrite: true,
  };
  for (const [phase, label] of [
    ["saved", "Saved to WriteShape"],
    ["saving", "Saving to WriteShape…"],
    ["offline", "WriteShape offline · edits kept on this device"],
    ["conflict", "WriteShape changed · review before saving"],
  ] as const) {
    buffer.syncStatus = { phase, message: "" };
    expect(documentSaveLabel(buffer)).toBe(label);
  }
  buffer.snapshot.destination.provider = "drive";
  buffer.syncStatus = { phase: "saved", message: "" };
  expect(documentSaveLabel(buffer)).toBe("Saved to Google Drive");
});
