import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, expect, it } from "vitest";
import { NovelCharacters } from "../src/components/NovelCharacters";
import { parseMarkdown, serializeMarkdown } from "../src/core/markdown";
import type { Screenplay } from "../src/core/model";

beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});
let root: Root;
let host: HTMLDivElement;
let doc: Screenplay;
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
async function mount(profiles: unknown[] = []) {
  doc = parseMarkdown("# The book\n\nKeep the manuscript intact.");
  doc.metadata.proseCharacters = profiles;
  doc.metadata.notes = "Existing story notes";
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  const draw = () =>
    root.render(
      <NovelCharacters
        doc={doc}
        onChange={(next) => {
          doc = next;
          draw();
        }}
      />,
    );
  await act(async () => draw());
}
function button(label: string) {
  const result = [...host.querySelectorAll<HTMLButtonElement>("button")].find(
    (b) => b.textContent === label || b.getAttribute("aria-label") === label,
  );
  expect(result, label).toBeDefined();
  return result!;
}
async function edit(label: string, value: string) {
  const field = [...host.querySelectorAll("label")]
    .find((l) => l.firstChild?.textContent === label)
    ?.querySelector("input,textarea") as HTMLInputElement | HTMLTextAreaElement;
  expect(field, label).toBeDefined();
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      field instanceof HTMLInputElement
        ? HTMLInputElement.prototype
        : HTMLTextAreaElement.prototype,
      "value",
    )!.set!.call(field, value);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
it("Add character opens a full individual profile immediately and an untouched close creates no record", async () => {
  await mount();
  await act(async () => button("Add character").click());
  expect(host.querySelector("dialog[open] h2")?.textContent).toBe(
    "New character",
  );
  expect(host.querySelector("dialog")?.classList.contains("wide")).toBe(true);
  expect(
    host.querySelectorAll<HTMLTextAreaElement>("dialog textarea"),
  ).toHaveLength(6);
  expect(host.querySelector(".character-metrics")).toBeNull();
  expect(host.querySelector("dialog")?.textContent).not.toMatch(
    /statistics|locations|speeches|Dialogue/i,
  );
  await act(async () => button("Close dialog").click());
  expect(doc.metadata.proseCharacters).toEqual([]);
});
it("profile fields save on edit, survive Markdown round-trip, and leave existing writing and metadata intact", async () => {
  await mount();
  const blocks = structuredClone(doc.blocks);
  await act(async () => button("Add character").click());
  await edit("Name", "Mara");
  await edit("Role in the story", "Protagonist");
  await edit("Short profile", "A reluctant archivist.");
  await edit("Background", "Raised among lighthouse keepers.");
  await edit("Motivation & conflict", "Wants the truth but fears its cost.");
  await edit("Personality", "Patient, stubborn, observant.");
  await edit("Relationships", "Trusts her sister.");
  await edit("Character notes", "Keeps every promise.");
  await act(async () => button("Done").click());
  expect(host.querySelectorAll(".novel-character")).toHaveLength(1);
  expect(doc.blocks).toEqual(blocks);
  expect(doc.metadata.notes).toBe("Existing story notes");
  const restored = parseMarkdown(serializeMarkdown(doc));
  expect(restored.metadata.proseCharacters).toEqual(
    doc.metadata.proseCharacters,
  );
  expect((doc.metadata.proseCharacters as any[])[0]).toMatchObject({
    name: "Mara",
    role: "Protagonist",
    description: "A reluctant archivist.",
    background: "Raised among lighthouse keepers.",
    motivation: "Wants the truth but fears its cost.",
    personality: "Patient, stubborn, observant.",
    relationships: "Trusts her sister.",
    notes: "Keeps every promise.",
  });
  await act(async () =>
    host.querySelector<HTMLButtonElement>(".novel-character")!.click(),
  );
  expect(host.querySelector("dialog h2")?.textContent).toBe("Mara");
  expect(
    [...host.querySelectorAll<HTMLTextAreaElement>("dialog textarea")].at(-1)
      ?.value,
  ).toBe("Keeps every promise.");
});
it("opening and removing an existing character affects only that profile and retains legacy descriptions", async () => {
  await mount([
    {
      id: "one",
      name: "Mara",
      description: "Existing description",
      customField: "Keep me",
    },
    { id: "two", name: "Sol", description: "Another character" },
  ]);
  await act(async () =>
    host.querySelector<HTMLButtonElement>(".novel-character")!.click(),
  );
  expect(host.querySelector("dialog h2")?.textContent).toBe("Mara");
  expect(
    host.querySelector<HTMLTextAreaElement>("dialog textarea")?.value,
  ).toBe("Existing description");
  await edit("Background", "New background");
  expect((doc.metadata.proseCharacters as any[])[0].customField).toBe(
    "Keep me",
  );
  await act(async () => button("Remove character").click());
  expect(doc.metadata.proseCharacters).toEqual([
    { id: "two", name: "Sol", description: "Another character" },
  ]);
  expect(host.querySelector("dialog")).toBeNull();
  expect(button("Add character")).toBeDefined();
});
