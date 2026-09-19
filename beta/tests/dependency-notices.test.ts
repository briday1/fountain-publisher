// @vitest-environment node
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import {
  buildDependencyNotices,
  validateLicenseText,
} from "../build-tools/notices";
import { noticesPage } from "../build-tools/licenses-page";

it("distributes runtime, embedded-code, font, and historical data permissions", async () => {
  const text = await buildDependencyNotices();
  for (const notice of [
    "pdf-lib 1.17.1",
    "Apache License",
    "SIL OPEN FONT LICENSE",
    "Joergen Ibsen",
    "International Business Machines",
    "HarfBuzz",
    "Adobe Systems",
    "Unicode, Inc.",
    "Niklas von Hertzen",
  ]) {
    expect(text).toContain(notice);
  }
  expect(text).toContain("Permission is hereby granted, free of charge");
  expect(noticesPage("<script>alert('test')</script>")).toContain(
    "&lt;script&gt;",
  );
  expect(noticesPage(text)).not.toContain("<script");
});

it("rejects bare license links, incomplete permissions, and unreviewed license types", () => {
  expect(() =>
    validateLicenseText("MIT", "https://opensource.org/licenses/MIT", "test"),
  ).toThrow("Incomplete");
  expect(() =>
    validateLicenseText("Apache-2.0", "Apache License Version 2.0", "test"),
  ).toThrow("Incomplete");
  expect(() => validateLicenseText("AGPL-3.0", "License", "test")).toThrow(
    "Unreviewed",
  );
});

it("stops changed notices, vendored artifacts, and dependency upgrades pending review", async () => {
  const root = await mkdtemp(join(tmpdir(), "fp-notice-test-"));
  const pkg = join(root, "node_modules/widget");
  const hash = (text: string) =>
    createHash("sha256").update(text).digest("hex");
  try {
    await mkdir(pkg, { recursive: true });
    const license = await readFile(
      new URL("../node_modules/pdf-lib/LICENSE.md", import.meta.url),
      "utf8",
    );
    const metadata = JSON.stringify({
      name: "widget",
      version: "1.0.0",
      license: "MIT",
    });
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({ dependencies: { widget: "1.0.0" } }),
    );
    await writeFile(join(pkg, "package.json"), metadata);
    await writeFile(join(pkg, "LICENSE"), license);
    await writeFile(join(pkg, "bundle.js"), "reviewed bundle");
    const inventoryPath = join(root, "inventory.json");
    await writeFile(
      inventoryPath,
      JSON.stringify({
        packages: {
          "widget@1.0.0": {
            license: "MIT",
            packageJsonSha256: hash(metadata),
            files: [{ path: "LICENSE", sha256: hash(license) }],
            artifacts: [{ path: "bundle.js", sha256: hash("reviewed bundle") }],
          },
        },
        supplements: {},
      }),
    );
    await expect(
      buildDependencyNotices(root, inventoryPath),
    ).resolves.toContain(license);
    await writeFile(join(pkg, "LICENSE"), "MIT");
    await expect(buildDependencyNotices(root, inventoryPath)).rejects.toThrow(
      "LICENSE has changed",
    );
    await writeFile(join(pkg, "LICENSE"), license);
    await writeFile(join(pkg, "bundle.js"), "new embedded dependency");
    await expect(buildDependencyNotices(root, inventoryPath)).rejects.toThrow(
      "bundle.js has changed",
    );
    await writeFile(join(pkg, "bundle.js"), "reviewed bundle");
    await writeFile(
      join(pkg, "package.json"),
      metadata.replace("1.0.0", "2.0.0"),
    );
    await expect(buildDependencyNotices(root, inventoryPath)).rejects.toThrow(
      "License review required for widget@2.0.0",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
