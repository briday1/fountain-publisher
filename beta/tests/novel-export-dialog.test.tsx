import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeAll, expect, it, vi } from "vitest";
import { NovelExportDialog } from "../src/components/NovelExportDialog";

beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});

it("exports each PDF preset with its selected size and keeps PDF controls out of EPUB and RTF", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container),
    onExport = vi.fn();
  const select = (label: string) =>
    Array.from(container.querySelectorAll("label.field"))
      .find((node) => node.firstChild?.textContent?.trim() === label)!
      .querySelector("select")!;
  const choose = async (label: string, value: string) =>
    act(async () => {
      const field = select(label);
      field.value = value;
      field.dispatchEvent(new Event("change", { bubbles: true }));
    });
  const submit = () =>
    act(async () =>
      container.querySelector<HTMLButtonElement>("button.primary")!.click(),
    );
  try {
    await act(async () =>
      root.render(
        <NovelExportDialog
          busy={false}
          onClose={() => {}}
          onExport={onExport}
        />,
      ),
    );
    expect(select("PDF style").value).toBe("book");
    expect(select("Page size").value).toBe("6x9");
    expect(
      container.querySelector<HTMLInputElement>("input[type=checkbox]")!
        .checked,
    ).toBe(false);
    await submit();
    expect(onExport).toHaveBeenLastCalledWith("pdf", false, undefined, {
      pdfStyle: "book",
      pageSize: "6x9",
    });
    await choose("Page size", "5.5x8.5");
    await choose("PDF style", "manuscript");
    expect(select("Page size").value).toBe("letter");
    await choose("Page size", "a4");
    await submit();
    expect(onExport).toHaveBeenLastCalledWith("pdf", false, undefined, {
      pdfStyle: "manuscript",
      pageSize: "a4",
    });
    await choose("PDF style", "book");
    expect(select("Page size").value).toBe("5.5x8.5");
    for (const format of ["epub", "rtf", "docx"]) {
      await choose("Export format", format);
      expect(container.textContent).not.toContain("PDF style");
      expect(container.textContent).not.toContain("Page size");
      await submit();
      expect(onExport).toHaveBeenLastCalledWith(format, false, undefined, {});
    }
    await choose("Export format", "pdf");
    await submit();
    expect(onExport).toHaveBeenLastCalledWith("pdf", false, undefined, {
      pdfStyle: "book",
      pageSize: "5.5x8.5",
    });
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
