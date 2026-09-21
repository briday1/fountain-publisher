export interface FileHandle {
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<{
    write(data: string): Promise<void>;
    close(): Promise<void>;
    abort?(): Promise<void>;
  }>;
}
interface FileAccessWindow extends Window {
  showOpenFilePicker?: (options: unknown) => Promise<FileHandle[]>;
  showSaveFilePicker?: (options: unknown) => Promise<FileHandle>;
}
const fileTypes = [
  {
    description: "Fountain screenplay",
    accept: { "text/plain": [".fountain", ".txt"] },
  },
  {
    description: "Final Draft screenplay",
    accept: { "application/xml": [".fdx"] },
  },
];
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
let localFileInput: HTMLInputElement | undefined;

function prefersInputFilePicker(): boolean {
  if (typeof window === "undefined") return false;
  const mobileUserAgent = /Android|iPhone|iPad|iPod/i.test(
    navigator.userAgent,
  );
  const coarsePointer =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches;
  return mobileUserAgent || coarsePointer;
}

function stableLocalFileInput(): HTMLInputElement {
  localFileInput ??= document.createElement("input");
  const input = localFileInput;
  input.type = "file";
  input.accept = ".fountain,.txt,.fdx,text/plain,application/xml";
  input.tabIndex = -1;
  input.setAttribute("aria-hidden", "true");
  input.setAttribute("data-fp-local-file-picker", "true");
  Object.assign(input.style, {
    position: "fixed",
    left: "-10000px",
    top: "0",
    width: "1px",
    height: "1px",
    opacity: "0",
    pointerEvents: "none",
  });
  if (!input.isConnected) document.body.append(input);
  return input;
}

export function supportsFileAccess() {
  return (
    typeof window !== "undefined" &&
    !!(window as FileAccessWindow).showOpenFilePicker
  );
}
export async function readLocalFile(
  file: File,
): Promise<{ name: string; content: string }> {
  if (file.size > MAX_FILE_BYTES)
    throw new Error("This file exceeds the 10 MB screenplay limit.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const encoding =
    bytes[0] === 0xff && bytes[1] === 0xfe
      ? "utf-16le"
      : bytes[0] === 0xfe && bytes[1] === 0xff
        ? "utf-16be"
        : "utf-8";
  let content: string;
  try {
    content = new TextDecoder(encoding, { fatal: true }).decode(bytes);
  } catch {
    throw new Error(
      "Choose a Fountain text file or Final Draft (.fdx) screenplay.",
    );
  }
  if (content.includes("\0"))
    throw new Error(
      "Choose a Fountain text file or Final Draft (.fdx) screenplay.",
    );
  return { name: file.name, content };
}
export async function openLocalFile(): Promise<{
  name: string;
  content: string;
  handle?: FileHandle;
} | null> {
  const access = window as FileAccessWindow;
  if (access.showOpenFilePicker && !prefersInputFilePicker()) {
    try {
      const [handle] = await access.showOpenFilePicker({
        multiple: false,
        types: fileTypes,
      });
      return { ...(await readLocalFile(await handle.getFile())), handle };
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return null;
      throw e;
    }
  }
  return new Promise((resolve, reject) => {
    const input = stableLocalFileInput();
    // Reset before every open so choosing the same Downloads file again still
    // produces a selection event in Chrome.
    input.value = "";
    let settled = false;
    const cleanup = () => {
      input.removeEventListener("input", selected);
      input.removeEventListener("change", selected);
      input.removeEventListener("cancel", cancelled);
    };
    const finish = <T,>(fn: (value: T) => void, value: T) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn(value);
    };
    const cancelled = () => finish(resolve, null);
    const selected = () => {
      if (settled) return;
      const file = input.files?.[0];
      if (!file) {
        finish(resolve, null);
        return;
      }
      settled = true;
      cleanup();
      // Keep the input attached while Android's document provider finishes
      // reading the selected File. Removing a transient input can lose the
      // selection callback/file backing on mobile Chrome.
      void readLocalFile(file).then(resolve, reject);
    };
    input.addEventListener("input", selected);
    input.addEventListener("change", selected);
    input.addEventListener("cancel", cancelled);
    try {
      input.click();
    } catch (error) {
      cleanup();
      settled = true;
      reject(error);
    }
  });
}
export function downloadFile(
  content: string | Blob,
  name: string,
  mime = "text/plain;charset=utf-8",
): void {
  const url = URL.createObjectURL(
    content instanceof Blob ? content : new Blob([content], { type: mime }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  // A modal makes the rest of the document inert, including body-level links.
  (
    document.querySelector("dialog[open]:last-of-type .modal-content") ??
    document.body
  ).append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
export async function saveLocalFile(
  content: string,
  name: string,
  handle?: FileHandle,
): Promise<FileHandle | undefined> {
  const access = window as FileAccessWindow;
  let target = handle;
  if (!target && access.showSaveFilePicker)
    target = await access.showSaveFilePicker({
      suggestedName: name.endsWith(".fountain") ? name : `${name}.fountain`,
      types: [fileTypes[0]],
    });
  if (!target) {
    downloadFile(
      content,
      name.endsWith(".fountain") ? name : `${name}.fountain`,
    );
    return undefined;
  }
  const stream = await target.createWritable();
  try {
    await stream.write(content);
    await stream.close();
  } catch (error) {
    await stream.abort?.().catch(() => {});
    throw error;
  }
  return target;
}
