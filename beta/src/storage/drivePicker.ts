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
  setDeveloperKey(value: string): PickerBuilder;
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

/** The Google UI supplies full folder/search/shared-drive browsing with drive.file grants. */
export async function pickDriveItem(options: {
  folder?: boolean;
  parent?: string;
  signal: AbortSignal;
  onReady: () => void;
}): Promise<PickedDriveItem | undefined> {
  const [config] = await Promise.all([cloud.drivePicker(), loadPicker()]);
  options.signal.throwIfAborted();
  if (!config.accessToken || !config.apiKey || !config.appId)
    throw new Error(
      "Google Drive browsing is missing its Picker configuration. Your existing files are still available below.",
    );
  const api = sdk.google!.picker;
  return new Promise((resolve, reject) => {
    let picker: Picker | undefined;
    const root = document.getElementById("root");
    const wasInert = root?.inert ?? false;
    let finished = false;
    const finish = (item?: PickedDriveItem, error?: Error) => {
      if (finished) return;
      finished = true;
      options.signal.removeEventListener("abort", abort);
      picker?.dispose();
      if (root) root.inert = wasInert;
      if (error) reject(error);
      else resolve(item);
    };
    const abort = () =>
      finish(undefined, new DOMException("Picker closed", "AbortError"));
    try {
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
        .setAppId(config.appId)
        .setDeveloperKey(config.apiKey)
        .setOAuthToken(config.accessToken)
        .setOrigin(location.origin)
        .setTitle(
          options.folder ? "Choose a screenplay folder" : "Open a screenplay",
        )
        .setSize(
          Math.min(1050, innerWidth - 20),
          Math.min(740, innerHeight - 24),
        )
        .setCallback((data) => {
          if (data.action === api.Action.CANCEL) finish();
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
      options.onReady();
      if (root) root.inert = true;
      options.signal.addEventListener("abort", abort, { once: true });
      picker.setVisible(true);
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
