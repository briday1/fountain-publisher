import { test, expect } from "@playwright/test";
test("Drive picker opens files and destination folders, restores its dialog on cancel, and keeps background inert", async ({
  page,
}) => {
  const requests: string[] = [];
  let pickerApiKey = "test-only-key";
  let saved: Record<string, unknown> | undefined;
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.split("/api")[1];
    requests.push(path + url.search);
    let body: unknown;
    if (path === "/status")
      body = {
        csrfToken: "test-csrf",
        // Exercise the independent local server's Picker/file flow. Shared-room
        // joins, edits and saves are covered in live-collaboration.spec.ts.
        collaboration: false,
        google: { configured: true, connected: true, account: "Writer" },
        github: { configured: false, connected: false },
      };
    else if (path === "/google/picker")
      body = {
        accessToken: "test-only-token",
        apiKey: pickerApiKey,
        appId: "test-project",
      };
    else if (path === "/google/files")
      body = {
        items:
          url.searchParams.get("parent") === "folder-123"
            ? [
                {
                  id: "child-folder",
                  name: "Drafts",
                  mimeType: "application/vnd.google-apps.folder",
                },
              ]
            : [],
      };
    else if (path === "/google/open")
      body = {
        name: "Picked.fountain",
        content: "INT. ROOM - DAY\n\nThe selected Drive screenplay.",
        remote: { provider: "google", id: "chosen-123", etag: "version-one" },
      };
    else if (path === "/google/create") {
      saved = request.postDataJSON();
      body = {
        name: saved!.name,
        content: saved!.content,
        remote: { provider: "google", id: "new-123", etag: "version-two" },
      };
    } else throw new Error("Unexpected Drive request " + path);
    await route.fulfill({ json: body });
  });
  await page.addInitScript(() => {
    const scope = window.top as unknown as {
      google: unknown;
      pickerOptions: Record<string, unknown>;
      pickerFault?: boolean;
    };
    type Item = { id: string; name: string; mimeType: string };
    class DocsView {
      includeFolders = false;
      folder = false;
      drives = false;
      mode = "";
      mime = "";
      parent = "";
      setIncludeFolders(value: boolean) {
        this.includeFolders = value;
        return this;
      }
      setSelectFolderEnabled(value: boolean) {
        this.folder = value;
        return this;
      }
      setEnableDrives(value: boolean) {
        this.drives = value;
        return this;
      }
      setMode(value: string) {
        this.mode = value;
        return this;
      }
      setMimeTypes(value: string) {
        this.mime = value;
        return this;
      }
      setParent(value: string) {
        this.parent = value;
        return this;
      }
    }
    class PickerBuilder {
      view!: DocsView;
      callback!: (data: { action: string; docs?: Item[] }) => void;
      origin = "";
      title = "";
      developerKey = "";
      document = document;
      setDocument(value: Document) {
        if (value !== window.document || value.defaultView !== window.top)
          throw new Error("Picker must use the top-page account context");
        this.document = value;
        return this;
      }
      addView(value: DocsView) {
        this.view = value;
        return this;
      }
      setAppId() {
        return this;
      }
      setDeveloperKey(value: string) {
        this.developerKey = value;
        return this;
      }
      setOAuthToken() {
        return this;
      }
      setOrigin(value: string) {
        this.origin = value;
        return this;
      }
      setTitle(value: string) {
        this.title = value;
        return this;
      }
      setSize() {
        return this;
      }
      setCallback(value: typeof this.callback) {
        this.callback = value;
        return this;
      }
      build() {
        const document = this.document;
        if (this.developerKey !== "test-only-key")
          throw new Error("Picker must receive the configured browser API key");
        scope.pickerOptions = {
          ...this.view,
          origin: this.origin,
          developerKey: this.developerKey,
        };
        const overlay = document.createElement("div");
        overlay.className = "picker-dialog";
        overlay.setAttribute("role", "region");
        overlay.setAttribute("aria-label", "Google Picker test UI");
        Object.assign(overlay.style, {
          position: "fixed",
          inset: "60px",
          zIndex: "9999",
          background: "white",
          padding: "24px",
        });
        const choose = document.createElement("button");
        choose.textContent = this.view.folder
          ? "Choose Scripts folder"
          : "Choose screenplay from nested folder";
        choose.onclick = () =>
          this.callback({
            action: "picked",
            docs: [
              this.view.folder
                ? {
                    id: "folder-123",
                    name: "Scripts",
                    mimeType: "application/vnd.google-apps.folder",
                  }
                : {
                    id: "chosen-123",
                    name: "Picked.fountain",
                    mimeType: "text/plain",
                  },
            ],
          });
        const cancel = document.createElement("button");
        cancel.textContent = "Cancel Google Picker";
        cancel.onclick = () => this.callback({ action: "cancel" });
        overlay.append(choose, cancel);
        const fault = scope.pickerFault;
        if (fault) {
          overlay.textContent =
            "There was an error! The API developer key is invalid.";
          overlay.tabIndex = 0;
        }
        return {
          setVisible() {
            document.body.append(overlay);
            if (fault) overlay.focus();
            else choose.focus();
          },
          dispose() {
            overlay.remove();
            if (fault) throw new Error("Google's error UI failed to dispose");
          },
        };
      }
    }
    (window as unknown as { google: unknown }).google = {
      picker: {
        DocsView,
        PickerBuilder,
        DocsViewMode: { LIST: "list" },
        Action: { PICKED: "picked", CANCEL: "cancel" },
      },
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page
    .getByRole("button", { name: "Open from Google Drive…", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Google Drive",
    exact: true,
  });
  await dialog.getByRole("button", { name: "Browse Google Drive…" }).click();
  const picker = page;
  await expect(page.locator('iframe[title="Google Drive files"]')).toHaveCount(
    0,
  );
  await expect(
    picker.getByRole("region", { name: "Google Picker test UI" }),
  ).toBeVisible();
  expect(await page.locator("#root").evaluate((el) => el.inert)).toBe(true);
  await expect(dialog).not.toBeVisible();
  expect(
    await page.evaluate(
      () => (window as unknown as { pickerOptions: unknown }).pickerOptions,
    ),
  ).toMatchObject({
    includeFolders: true,
    folder: false,
    drives: true,
    mode: "list",
    developerKey: "test-only-key",
  });
  await picker.getByRole("button", { name: "Cancel Google Picker" }).click();
  await expect(dialog).toBeVisible();
  expect(await page.locator("#root").evaluate((el) => el.inert)).toBe(false);
  await page.evaluate(() => {
    (window as unknown as { pickerFault: boolean }).pickerFault = true;
  });
  for (const exit of ["button", "backdrop", "escape"]) {
    await dialog.getByRole("button", { name: "Browse Google Drive…" }).click();
    await expect(
      picker.getByText("There was an error! The API developer key is invalid."),
    ).toBeVisible();
    if (exit === "button")
      await page
        .getByRole("button", { name: "Close Drive browser", exact: true })
        .click();
    else if (exit === "backdrop") await page.mouse.click(2, 900);
    else await page.keyboard.press("Escape");
    await expect(
      page.getByRole("dialog", { name: "Browse Google Drive", exact: true }),
    ).toHaveCount(0);
    await expect(dialog).toBeVisible();
    expect(await page.locator("#root").evaluate((el) => el.inert)).toBe(false);
  }
  await page.evaluate(() => {
    (window as unknown as { pickerFault: boolean }).pickerFault = false;
  });
  await dialog.getByRole("button", { name: "Browse Google Drive…" }).click();
  await picker
    .getByRole("button", { name: "Choose screenplay from nested folder" })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Screenplay editor" }),
  ).toContainText("The selected Drive screenplay.");
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.getByRole("button", { name: "Save to Google Drive…" }).click();
  await dialog
    .getByRole("button", { name: "Choose destination folder…" })
    .click();
  await picker.getByRole("button", { name: "Choose Scripts folder" }).click();
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Drafts", exact: true }),
  ).toBeVisible();
  expect(
    requests.some((path) => path.includes("/google/files?parent=folder-123")),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => (window as unknown as { pickerOptions: unknown }).pickerOptions,
    ),
  ).toMatchObject({ folder: true, mime: "application/vnd.google-apps.folder" });
  await dialog
    .getByRole("textbox", { name: "Filename", exact: true })
    .fill("Another draft.fountain");
  await dialog.getByRole("button", { name: "Save here", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(saved).toMatchObject({
    parent: "folder-123",
    name: "Another draft.fountain",
  });
  expect(await page.locator("#root").evaluate((el) => el.inert)).toBe(false);
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
  // Missing setup must produce an app-owned error, not a broken Google frame.
  pickerApiKey = "";
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page
    .getByRole("button", { name: "Open from Google Drive…", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Browse Google Drive…" }).click();
  await expect(dialog.getByText(/configuration is incomplete/)).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "Browse Google Drive", exact: true }),
  ).toHaveCount(0);
  expect(await page.locator("#root").evaluate((el) => el.inert)).toBe(false);
});
