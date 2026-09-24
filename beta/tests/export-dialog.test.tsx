// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeAll, expect, it, vi } from "vitest";
import { ExportDialog } from "../src/components/ExportDialog";

beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});

it("defaults to plain PDF, shares mobile and character settings, and hides PDF options for Final Draft", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const onExport = vi.fn();
  try {
    await act(async () =>
      root.render(
        <ExportDialog
          names={["MARA", "ELI"]}
          busy={false}
          onExport={onExport}
          onClose={() => {}}
        />,
      ),
    );
    const submit = () =>
      container.querySelector<HTMLButtonElement>("button.primary")!;
    const select = container.querySelector("select")!;
    expect(select.value).toBe("pdf");
    expect(submit().disabled).toBe(false);
    await act(async () => submit().click());
    expect(onExport).toHaveBeenLastCalledWith({
      format: "pdf",
      mobile: false,
      characters: [],
    });
    const boxes = container.querySelectorAll<HTMLInputElement>(
      "input[type=checkbox]",
    );
    await act(async () => boxes[0].click());
    await act(async () => boxes[1].click());
    await act(async () => submit().click());
    expect(onExport).toHaveBeenLastCalledWith({
      format: "pdf",
      mobile: true,
      characters: ["MARA"],
    });
    await act(async () => {
      select.value = "fdx";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(container.querySelectorAll("input[type=checkbox]").length).toBe(0);
    expect(container.textContent).not.toContain("Find a character");
    await act(async () => submit().click());
    expect(onExport).toHaveBeenLastCalledWith({
      format: "fdx",
      mobile: false,
      characters: [],
    });
    await act(async () => {
      select.value = "pdf";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(
      container.querySelector<HTMLInputElement>("input[type=checkbox]")!
        .checked,
    ).toBe(true);
    await act(async () => submit().click());
    expect(onExport).toHaveBeenLastCalledWith({
      format: "pdf",
      mobile: true,
      characters: ["MARA"],
    });
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
