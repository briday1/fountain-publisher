import { test, expect } from "@playwright/test";
import { mobileSection } from "./mobile-menu-helper";

for (const mobile of [false, true]) {
  test(`app Drive browser navigates views and saves inside folders ${mobile ? "on mobile" : "on desktop"}`, async ({
    page,
  }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    const browsed: URL[] = [];
    let created: Record<string, unknown> | undefined;
    await page.route("**/api/**", async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname.split("/api")[1];
      let body: unknown;
      if (path === "/status")
        body = {
          csrfToken: "test",
          collaboration: false,
          google: {
            configured: true,
            connected: true,
            account: "Writer",
            driveAccess: "full",
          },
          github: { configured: false, connected: false },
        };
      else if (path === "/google/browser") {
        browsed.push(url);
        const view = url.searchParams.get("view");
        const parent = url.searchParams.get("parent");
        body = {
          items:
            view === "drives" && !parent
              ? [
                  {
                    id: "team",
                    name: "Studio",
                    capabilities: { canAddChildren: true },
                  },
                ]
              : parent
                ? [
                    {
                      id: "nested",
                      name: "Drafts",
                      mimeType: "application/vnd.google-apps.folder",
                      capabilities: { canAddChildren: true },
                    },
                  ]
                : [
                    {
                      id: "scripts",
                      name: "Scripts",
                      mimeType: "application/vnd.google-apps.folder",
                      capabilities: { canAddChildren: true },
                    },
                  ],
        };
      } else if (path === "/google/create") {
        created = route.request().postDataJSON();
        body = {
          name: created!.name,
          content: created!.content,
          remote: { provider: "google", id: "new", etag: "v1" },
        };
      } else throw new Error("Unexpected API request " + path);
      await route.fulfill({ json: body });
    });
    await page.goto("/");
    if (mobile) await mobileSection(page, "Share");
    else await page.getByRole("button", { name: "File", exact: true }).click();
    await page
      .getByRole("button", { name: "Save to Google Drive…", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Google Drive",
      exact: true,
    });
    await expect(
      dialog.getByRole("button", { name: "Scripts", exact: true }),
    ).toBeVisible();
    for (const [view, label] of [
      ["shared", "Shared with me"],
      ["recent", "Recent"],
      ["starred", "Starred"],
      ["all", "All files"],
    ]) {
      await dialog
        .getByRole("navigation", { name: "Drive views" })
        .getByRole("button", { name: label, exact: true })
        .click();
      await expect
        .poll(() => browsed.at(-1)?.searchParams.get("view"))
        .toBe(view);
      await expect(
        dialog.getByRole("button", { name: "Save here", exact: true }),
      ).toBeDisabled();
    }
    await dialog.getByRole("textbox", { name: "Search Drive" }).fill("Cabin");
    await dialog.getByRole("button", { name: "Search", exact: true }).click();
    await expect
      .poll(() => browsed.at(-1)?.searchParams.get("search"))
      .toBe("Cabin");
    await dialog
      .getByRole("navigation", { name: "Drive views" })
      .getByRole("button", { name: "Shared drives", exact: true })
      .click();
    await dialog.getByRole("button", { name: "Studio", exact: true }).click();
    await expect
      .poll(() => browsed.at(-1)?.searchParams.get("driveId"))
      .toBe("team");
    await dialog.getByRole("button", { name: "Drafts", exact: true }).click();
    await expect(
      dialog.getByText("Save in: Studio / Drafts", { exact: true }),
    ).toBeVisible();
    await dialog
      .getByRole("textbox", { name: "Filename", exact: true })
      .fill("Cabin");
    await page.screenshot({
      path: test.info().outputPath("drive-browser.png"),
    });
    await dialog
      .getByRole("button", { name: "Save here", exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
    expect(created).toMatchObject({ parent: "nested", name: "Cabin.fountain" });
  });
}

test("mobile Write menu adds annotations without intercepting the native context menu", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const editor = page.getByRole("textbox", { name: "Screenplay editor" });
  await editor.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.insertText("An annotated paragraph.");
  await mobileSection(page, "Write");
  await page
    .getByRole("button", { name: "Add annotation…", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Add Annotation" });
  await dialog
    .getByRole("textbox", { name: "Annotation" })
    .fill("Remember this.");
  await dialog.getByRole("button", { name: "Save annotation" }).click();
  await expect(
    editor.getByRole("button", { name: "Edit annotation: Remember this." }),
  ).toBeVisible();
  await mobileSection(page, "View");
  await page.getByRole("button", { name: "Annotations…", exact: true }).click();
  const list = page.getByRole("dialog", { name: "Annotations", exact: true });
  await list.getByRole("button", { name: "Go to annotation: Remember this." }).click();
  await expect(list).not.toBeVisible();
  await expect(editor).toBeFocused();
  await editor.getByRole("button", { name: "Edit annotation: Remember this." }).click();
  await expect(
    page.getByRole("dialog", { name: "Edit Annotation" }),
  ).toBeVisible();
});
