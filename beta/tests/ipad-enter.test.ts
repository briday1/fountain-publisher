import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

for (const browser of ["Version/18.0", "CriOS/130.0.0.0"]) {
  it(`inserts one dialogue line after Enter and beforeinput (${browser})`, async () => {
    vi.spyOn(navigator, "vendor", "get").mockReturnValue("Apple Computer, Inc.");
    vi.spyOn(navigator, "platform", "get").mockReturnValue("MacIntel");
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      `Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 ${browser} Mobile/15E148 Safari/604.1`,
    );
    Range.prototype.getBoundingClientRect = () => new DOMRect(0, 0, 10, 20);
    Range.prototype.getClientRects = () =>
      [new DOMRect(0, 0, 10, 20)] as unknown as DOMRectList;
    vi.spyOn(window, "scrollBy").mockImplementation(() => {});
    const { EditorController } = await import("../src/editor/EditorController");
    const { emptyScreenplay } = await import("../src/core/model");
    const host = document.createElement("div");
    document.body.append(host);
    const editor = new EditorController(host, emptyScreenplay());
    try {
      editor.setKind("character");
      editor.view.dispatch(editor.view.state.tr.insertText("ADA"));
      const key = new KeyboardEvent("keydown", {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true,
      });
      editor.view.dom.dispatchEvent(key);
      editor.view.dom.dispatchEvent(
        new InputEvent("beforeinput", {
          inputType: "insertParagraph",
          bubbles: true,
          cancelable: true,
        }),
      );
      // ProseMirror's iOS keydown fallback fires at 200ms. The previous test
      // checked synchronously, and omitted keyCode and Safari's vendor signal.
      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(editor.getBlocks().map(({ kind, text }) => [kind, text])).toEqual([
        ["character", "ADA"],
        ["dialogue", ""],
      ]);
      expect(key.defaultPrevented).toBe(true);
      editor.view.dispatch(editor.view.state.tr.insertText("Hello."));
      expect(editor.getBlocks()[1]).toMatchObject({
        kind: "dialogue",
        text: "Hello.",
      });
    } finally {
      editor.destroy();
    }
  });
}
