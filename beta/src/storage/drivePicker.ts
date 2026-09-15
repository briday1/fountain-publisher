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
  setOwnedByMe(value: boolean): DocsView;
  setLabel(value: string): DocsView;
}
interface Picker {
  setVisible(value: boolean): void;
  dispose(): void;
}
interface PickerBuilder {
  addView(view: DocsView): PickerBuilder;
  setAppId(value: string): PickerBuilder;
  setDeveloperKey(value: string): PickerBuilder;
  enableFeature(value: string): PickerBuilder;
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
      DocsView: new (viewId: string) => DocsView;
      PickerBuilder: new () => PickerBuilder;
      ViewId: { DOCS: string };
      Feature: { SUPPORT_DRIVES: string };
      DocsViewMode: { LIST: string };
      Action: { PICKED: string; CANCEL: string; ERROR: string };
    };
  };
}
let pickerSdkPromise: Promise<GoogleSdk> | undefined;
function loadPicker(): Promise<GoogleSdk> {
  const sdk = window as unknown as GoogleSdk;
  if (sdk.google?.picker) return Promise.resolve(sdk);
  if (pickerSdkPromise) return pickerSdkPromise;
  pickerSdkPromise = new Promise<GoogleSdk>((resolve, reject) => {
    let timeout: ReturnType<typeof setTimeout>;
    let script: HTMLScriptElement | undefined;
    const fail = () => {
      clearTimeout(timeout);
      script?.remove();
      reject(
        new Error(
          "Google Drive’s browser could not load. Check your connection and try again.",
        ),
      );
    };
    const ready = () =>
      sdk.gapi
        ? sdk.gapi.load("picker", {
            callback: () => {
              clearTimeout(timeout);
              resolve(sdk);
            },
            onerror: fail,
            timeout: 15000,
            ontimeout: fail,
          })
        : fail();
    timeout = setTimeout(fail, 20000);
    if (sdk.gapi) ready();
    else {
      script = document.createElement("script");
      script.src = "https://apis.google.com/js/api.js";
      script.async = true;
      script.onerror = fail;
      script.onload = ready;
      document.head.append(script);
    }
  }).catch((error: unknown) => {
    pickerSdkPromise = undefined;
    throw error;
  });
  return pickerSdkPromise;
}

/** Google owns the dialog, backdrop and account frame, as in the legacy app. */
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
    const focus = document.activeElement;
    const previousPickerNodes = new Set(
      document.querySelectorAll(".picker-dialog, .picker-dialog-bg"),
    );
    // A small sibling control strip stays usable even if Google's frame errors.
    // It is not a dialog: do not introduce another modal or browsing context.
    const controls = document.createElement("div");
    controls.className = "drive-picker-controls";
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
    const loading = document.createElement("p");
    loading.className = "drive-picker-loading";
    loading.setAttribute("role", "status");
    loading.textContent = "Loading Google Drive…";
    header.append(title, close);
    controls.append(header, loading);
    let pickerWidth = 0;
    let pickerHeight = 0;
    const resize = () => {
      const viewport = window.visualViewport;
      const width = viewport?.width || innerWidth;
      const height = viewport?.height || innerHeight;
      const availableWidth = Math.max(1, width - 24);
      const availableHeight = Math.max(1, height - 88);
      // Google enforces a 566 × 350 minimum. Scale only its outer dialog on
      // phones; never resize or reparent Google's account iframe.
      const scale = pickerWidth
        ? Math.min(
            1,
            availableWidth / pickerWidth,
            availableHeight / pickerHeight,
          )
        : 1;
      const shownWidth = pickerWidth
        ? pickerWidth * scale
        : Math.min(540, availableWidth);
      const shownHeight = pickerHeight ? pickerHeight * scale + 64 : 144;
      const style = document.documentElement.style;
      style.setProperty("--drive-picker-scale", String(scale));
      style.setProperty("--drive-picker-width", `${shownWidth}px`);
      style.setProperty(
        "--drive-picker-left",
        `${(viewport?.offsetLeft || 0) + Math.max(12, (width - shownWidth) / 2)}px`,
      );
      style.setProperty(
        "--drive-picker-top",
        `${(viewport?.offsetTop || 0) + Math.max(12, (height - shownHeight) / 2)}px`,
      );
    };
    let finished = false;
    const finish = (item?: PickedDriveItem, error?: Error) => {
      if (finished) return;
      finished = true;
      options.signal.removeEventListener("abort", abort);
      document.removeEventListener("keydown", escape, true);
      document.removeEventListener("pointerdown", backdrop, true);
      window.removeEventListener("resize", resize);
      window.visualViewport?.removeEventListener("resize", resize);
      window.visualViewport?.removeEventListener("scroll", resize);
      document.body.classList.remove("drive-picker-active");
      // Even a broken SDK's dispose must not prevent returning to the editor.
      try {
        picker?.dispose();
      } catch {
        // The SDK can throw on account-error screens. Still unblock the app.
      } finally {
        for (const node of document.querySelectorAll(
          ".picker-dialog, .picker-dialog-bg",
        )) {
          if (!previousPickerNodes.has(node)) node.remove();
        }
        controls.remove();
        for (const property of ["scale", "width", "left", "top"])
          document.documentElement.style.removeProperty(
            `--drive-picker-${property}`,
          );
        if (root) root.inert = wasInert;
        if (focus instanceof HTMLElement && focus.isConnected)
          focus.focus({ preventScroll: true });
      }
      if (error) reject(error);
      else resolve(item);
    };
    const abort = () =>
      finish(undefined, new DOMException("Picker closed", "AbortError"));
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        finish();
      }
    };
    const backdrop = (event: PointerEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest(".picker-dialog-bg")
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        finish();
      }
    };
    close.addEventListener("click", () => finish());
    options.signal.addEventListener("abort", abort, { once: true });
    try {
      options.onReady();
      if (finished) return;
      if (focus instanceof HTMLElement) focus.blur();
      document.body.append(controls);
      resize();
      document.body.classList.add("drive-picker-active");
      document.addEventListener("keydown", escape, true);
      document.addEventListener("pointerdown", backdrop, true);
      window.addEventListener("resize", resize);
      window.visualViewport?.addEventListener("resize", resize);
      window.visualViewport?.addEventListener("scroll", resize);
      if (root) root.inert = true;
      void Promise.all([cloud.drivePicker(), loadPicker()])
        .then(([config, sdk]) => {
          if (finished) return;
          if (!config.accessToken || !config.appId || !config.apiKey)
            throw new Error(
              "Google Drive browsing needs an OAuth token, Google project number, and Picker API key. This installation’s configuration is incomplete. Your existing files are still available below.",
            );
          const api = sdk.google!.picker;
          const docsView = () => {
            const view = new api.DocsView(api.ViewId.DOCS)
              .setIncludeFolders(true)
              .setSelectFolderEnabled(!!options.folder)
              .setMode(api.DocsViewMode.LIST);
            if (options.folder) view.setMimeTypes(driveFolder);
            return view;
          };
          const viewport = window.visualViewport;
          pickerWidth = Math.max(
            566,
            Math.min(1051, (viewport?.width || innerWidth) - 24),
          );
          pickerHeight = Math.max(
            350,
            Math.min(650, (viewport?.height || innerHeight) - 88),
          );
          const builder = new api.PickerBuilder()
            .addView(docsView().setOwnedByMe(false).setLabel("Shared with me"))
            .addView(docsView().setParent("root").setLabel("My Drive"))
            .addView(docsView().setLabel("All files"))
            .addView(docsView().setEnableDrives(true).setLabel("Shared drives"))
            .enableFeature(api.Feature.SUPPORT_DRIVES)
            .setAppId(config.appId)
            .setDeveloperKey(config.apiKey)
            .setOAuthToken(config.accessToken)
            .setOrigin(location.origin)
            .setTitle(title.textContent!)
            .setSize(pickerWidth, pickerHeight);
          if (options.parent && options.parent !== "root")
            builder.addView(
              docsView().setParent(options.parent).setLabel("Current folder"),
            );
          picker = builder
            .setCallback((data) => {
              if (data.action === api.Action.CANCEL) finish();
              else if (data.action === api.Action.ERROR)
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
          resize();
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
