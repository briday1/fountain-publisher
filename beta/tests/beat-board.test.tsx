import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { BeatBoard } from "../src/components/BeatBoard";
import { emptyScreenplay, type Screenplay } from "../src/core/model";
it("folds and restores nested detail, adds a child and preserves it when its parent is deleted", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const initial = emptyScreenplay();
  initial.metadata.beats = [
    {
      id: "parent",
      title: "A choice",
      description: "Parent notes",
      act: "Act I",
      color: "#123456",
    },
    {
      id: "child",
      parentId: "parent",
      title: "A hesitation",
      description: "Keep this detail",
      act: "Act I",
      color: "#123456",
    },
  ];
  let saved: Screenplay = initial;
  function Harness() {
    const [doc, setDoc] = useState(initial);
    return (
      <BeatBoard
        doc={doc}
        onChange={(d) => {
          saved = d;
          setDoc(d);
        }}
        onAssign={() => {}}
        onRange={() => {}}
        onExport={() => {}}
        onExportCsv={() => {}}
      />
    );
  }
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const click = async (label: string) => {
    const node = host.querySelector<HTMLButtonElement>(
      `button[aria-label="${label}"]`,
    );
    expect(node).not.toBeNull();
    await act(async () => node!.click());
  };
  try {
    await act(async () => root.render(<Harness />));
    await click("Collapse sub-beats of A choice");
    expect(host.querySelector('input[value="A hesitation"]')).toBeNull();
    expect(saved.metadata.beats[1].description).toBe("Keep this detail");
    await click("Expand sub-beats of A choice");
    expect(host.querySelector('input[value="A hesitation"]')).not.toBeNull();
    await click("Add sub-beat to beat 1");
    expect(saved.metadata.beats).toHaveLength(3);
    expect(saved.metadata.beats[2].parentId).toBe("parent");
    await click("Delete beat 1");
    expect(saved.metadata.beats).toHaveLength(2);
    expect(saved.metadata.beats.every((b) => !b.parentId)).toBe(true);
    expect(saved.metadata.beats[0].description).toBe("Keep this detail");
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});

it("uses chapters for book beat creation and editing, including legacy act data", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const initial = emptyScreenplay();
  initial.metadata.format = "markdown";
  initial.blocks = [
    { id: "chapter", kind: "section", level: 2, text: "Chapter 1" },
    { id: "text", kind: "action", text: "A beginning." },
  ];
  initial.metadata.beats = [
    {
      id: "old",
      title: "Opening",
      description: "Keep me",
      act: "Act II",
      color: "#123456",
      groupSceneId: "chapter",
    },
  ];
  let saved = initial;
  function Harness() {
    const [doc, setDoc] = useState(initial);
    return (
      <BeatBoard
        doc={doc}
        onChange={(next) => {
          saved = next;
          setDoc(next);
        }}
        onAssign={() => {}}
        onRange={() => {}}
        onExport={() => {}}
        onExportCsv={() => {}}
      />
    );
  }
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<Harness />));
    expect(host.querySelector(".beat-act-heading")).toBeNull();
    expect(host.querySelector(".beat-scene-heading")?.textContent).toContain(
      "Chapter 1",
    );
    await act(async () =>
      host
        .querySelector<HTMLButtonElement>(
          'button[aria-label="Beat 1 details"]',
        )!
        .click(),
    );
    expect(host.querySelector('select[aria-label="Beat 1 act"]')).toBeNull();
    expect(
      host.querySelector('select[aria-label="Beat 1 chapter group"]'),
    ).not.toBeNull();
    const add = [...host.querySelectorAll("button")].find(
      (b) => b.textContent?.trim() === "Add beat",
    )!;
    await act(async () => add.click());
    expect(saved.metadata.beats).toHaveLength(2);
    expect(
      saved.metadata.beats.every(
        (b) => b.act === "" && b.groupSceneId === "chapter",
      ),
    ).toBe(true);
    expect(saved.metadata.beats[0].description).toBe("Keep me");
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
