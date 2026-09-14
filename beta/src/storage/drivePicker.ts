import { cloud } from "./cloud";
export const driveFolder = "application/vnd.google-apps.folder";
export interface PickedDriveItem {
  id: string;
  name: string;
  mimeType: string;
}
interface DocsView {
  setIncludeFolders(value: boolean): DocsView;
  setSelectFolderEnabled(value: boolean): DocsView;
  setEnableDrives(value: boolean): DocsView;
  setMode(value: string): DocsView;
  setMimeTypes(value: string): DocsView;
  setParent(value: string): DocsView;
}
interface Picker {
  setVisible(value: boolean): void;
  dispose(): void;
}
interface PickerBuilder {
  addView(view: DocsView): PickerBuilder;
  setAppId(value: string): PickerBuilder;
  setDocument(value: Document): PickerBuilder;
  setOAuthToken(value: string): PickerBuilder;
  setOrigin(value: string): PickerBuilder;
  setTitle(value: string): PickerBuilder;
  setSize(width: number, height: number): PickerBuilder;
  setCallback(
    value: (data: { action: string; docs?: PickedDriveItem[] }) => void,
  ): PickerBuilder;
  build(): Picker;
}
interface GoogleSdk {
  gapi?: {
    load(
      module: string,
      options: {
        callback: () => void;
        onerror: () => void;
        timeout: number;
        ontimeout: () => void;
      },
    ): void;
  };
  google?: {
    picker: {
      DocsView: new () => DocsView;
      PickerBuilder: new () => PickerBuilder;
      DocsViewMode: { LIST: string };
      Action: { PICKED: string; CANCEL: string };
    };
  };
}
const sdk = window as unknown as GoogleSdk;
let loading: Promise<void> | undefined;
function loadPicker(): Promise<void> {
  if (sdk.google?.picker) return Promise.resolve();
  return (loading ??= new Promise<void>((resolve, reject) => {
    let timeout: ReturnType<typeof setTimeout>;
    const script = document.createElement("script");
    const fail = () => {
      clearTimeout(timeout);
      script.remove();
      loading = undefined;
      reject(
        new Error(
          "Google Drive’s browser could not load. Check your connection and try again.",
        ),
      );
    };
    script.src = "https://apis.google.com/js/api.js";
    script.async = true;
    script.onerror = fail;
    script.onload = () =>
      sdk.gapi
        ? sdk.gapi.load("picker", {
            callback: () => {
              clearTimeout(timeout);
              resolve();
            },
            onerror: fail,
            timeout: 15000,
            ontimeout: fail,
          })
        : fail();
    timeout = setTimeout(fail, 20000);
    document.head.append(script);
  }));
}

/** Keep Google's iframe and focus handling inside our own closable modal. */
export function pickDriveItem(options: {
  folder?: boolean;
  parent?: string;
  signal: AbortSignal;
  onReady: () => void;
}): Promise<PickedDriveItem | undefined> {
  return new Promise((resolve, reject) => {
    options.signal.throwIfAborted();
    let picker: Picker | undefined;
    const root = document.getElementById("root");
    const wasInert = root?.inert ?? false;
    const host = document.createElement("dialog");
    host.className = "drive-picker-host";
    host.setAttribute("aria-label", "Browse Google Drive");
    const header = document.createElement("header");
    const title = document.createElement("strong");
    title.textContent = options.folder
      ? "Choose a screenplay folder"
      : "Open a screenplay";
    const close = document.createElement("button");
    close.type = "button";
    close.className = "drive-picker-close";
    close.textContent = "Close ×";
    close.setAttribute("aria-label", "Close Drive browser");
    const frame = document.createElement("iframe");
    frame.title = "Google Drive files";
    frame.className = "drive-picker-frame";
    const viewport = document.createElement("div");
    viewport.className = "drive-picker-viewport";
    viewport.append(frame);
    const loading = document.createElement("p");
    loading.className = "drive-picker-loading";
    loading.setAttribute("role", "status");
    loading.textContent = "Loading Google Drive…";
    header.append(title, close);
    host.append(header, loading, viewport);
    let finished = false;
    const finish = (item?: PickedDriveItem, error?: Error) => {
      if (finished) return;
      finished = true;
      options.signal.removeEventListener("abort", abort);
      // Even a broken SDK's dispose must not prevent returning to the editor.
      try {
        picker?.dispose();
      } catch {
        // Removing the host also removes every Google-owned frame and overlay.
      } finally {
        host.close();
        host.remove();
        if (root) root.inert = wasInert;
      }
      if (error) reject(error);
      else resolve(item);
    };
    const abort = () =>
      finish(undefined, new DOMException("Picker closed", "AbortError"));
    close.addEventListener("click", () => finish());
    host.addEventListener("cancel", (event) => {
      event.preventDefault();
      finish();
    });
    host.addEventListener("click", (event) => {
      if (event.target === host) finish();
    });
    options.signal.addEventListener("abort", abort, { once: true });
    try {
      options.onReady();
      document.body.append(host);
      host.showModal();
      if (root) root.inert = true;
      const target = frame.contentDocument!;
      const style = target.createElement("style");
      style.textContent =
        "html,body{margin:0;width:100%;height:100%;overflow:hidden;background:white}";
      target.head.append(style);
      // Key events from our inner document do not bubble to the parent dialog.
      target.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          finish();
        }
      });
      void Promise.all([cloud.drivePicker(), loadPicker()])
        .then(([config]) => {
          if (finished) return;
          if (!config.accessToken || !config.appId)
            throw new Error(
              "Google Drive browsing is unavailable because its account configuration is incomplete. Your existing files are still available below.",
            );
          const api = sdk.google!.picker;
          const view = new api.DocsView()
            .setIncludeFolders(true)
            .setSelectFolderEnabled(!!options.folder)
            .setEnableDrives(true)
            .setMode(api.DocsViewMode.LIST);
          if (options.folder) view.setMimeTypes(driveFolder);
          if (options.parent && options.parent !== "root")
            view.setParent(options.parent);
          picker = new api.PickerBuilder()
            .addView(view)
            .setDocument(target)
            .setAppId(config.appId)
            .setOAuthToken(config.accessToken)
            .setOrigin(location.origin)
            .setTitle(title.textContent!)
            .setSize(frame.clientWidth, frame.clientHeight)
            .setCallback((data) => {
              if (data.action === api.Action.CANCEL) finish();
              else if (data.action === "error")
                finish(
                  undefined,
                  new Error(
                    "Google Drive could not open its browser. Please try again.",
                  ),
                );
              else if (data.action === api.Action.PICKED) {
                const item = data.docs?.[0];
                if (
                  !item?.id ||
                  !item.name ||
                  (options.folder
                    ? item.mimeType !== driveFolder
                    : !/\.(fountain|txt|fdx)$/i.test(item.name))
                )
                  finish(
                    undefined,
                    new Error(
                      options.folder
                        ? "Choose a Google Drive folder."
                        : "Choose a Fountain (.fountain), text (.txt), or Final Draft (.fdx) screenplay.",
                    ),
                  );
                else finish(item);
              }
            })
            .build();
          loading.remove();
          picker.setVisible(true);
        })
        .catch((error: unknown) =>
          finish(
            undefined,
            error instanceof Error
              ? error
              : new Error("Google Drive browsing could not open."),
          ),
        );
    } catch (error) {
      finish(
        undefined,
        error instanceof Error
          ? error
          : new Error("Google Drive browsing could not open."),
      );
    }
  });
}
