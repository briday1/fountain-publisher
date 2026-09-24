// @vitest-environment node
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { build } from "vite";
import { expect, it } from "vitest";
import { offlineShell } from "../build-tools/offline";
import {
  writeshapeBrand,
  writeShapeBrandAssets,
} from "../build-tools/writeshapeBrand";
import { WriteShapeMark } from "../src/components/WriteShapeMark";

const repo = resolve(import.meta.dirname, "..");
it("brands real WriteShape builds and offline installs without changing default or beta Fountain builds", async () => {
  await mkdir(resolve(repo, "work"), { recursive: true });
  const dir = await mkdtemp(resolve(repo, "work/writeshape-brand-test-"));
  const sourceHTML = await readFile(resolve(repo, "index.html"), "utf8");
  const sourceIcon = await readFile(
    resolve(repo, "public/favicon.svg"),
    "utf8",
  );
  const sourceManifest = await readFile(
    resolve(repo, "public/manifest.webmanifest"),
    "utf8",
  );
  try {
    await writeFile(
      resolve(dir, "index.html"),
      sourceHTML.replace(
        /<script[^>]*src="\/src\/main.tsx"[^>]*><\/script>/,
        "",
      ),
    );
    for (const mode of ["production", "beta", "writeshape"]) {
      const outDir = resolve(dir, mode);
      await build({
        configFile: false,
        root: dir,
        mode,
        logLevel: "silent",
        publicDir: resolve(repo, "public"),
        plugins: [writeshapeBrand(), offlineShell()],
        build: { outDir, emptyOutDir: true },
      });
      const html = await readFile(resolve(outDir, "index.html"), "utf8");
      const icon = await readFile(resolve(outDir, "favicon.svg"), "utf8");
      const manifest = await readFile(
        resolve(outDir, "manifest.webmanifest"),
        "utf8",
      );
      const sw = await readFile(resolve(outDir, "sw.js"), "utf8");
      const files: string[] = JSON.parse(
        sw.match(/const FILES=(\[[^\n]*\]);/)![1],
      );
      expect(new Set(files).size).toBe(files.length);
      const shell = await readFile(
        resolve(
          outDir,
          files.find((f) => f.startsWith("/offline-shell-"))!.slice(1),
        ),
        "utf8",
      );
      if (mode === "writeshape") {
        expect(html).toContain("<title>WriteShape</title>");
        expect(html).toContain('content="WriteShape"');
        expect(html).toContain('href="/writeshape-icon.svg"');
        expect(html).toContain('href="/writeshape-manifest.webmanifest"');
        expect(html).toContain('href="/writeshape-apple-touch-icon.png"');
        expect(shell).toBe(html);
        expect(icon).not.toContain("<text");
        expect(icon).toBe(
          await readFile(resolve(repo, "public/writeshape-icon.svg"), "utf8"),
        );
        const installed = JSON.parse(manifest);
        expect(installed.name).toBe("WriteShape");
        expect(installed.short_name).toBe("WriteShape");
        expect(installed.start_url).toBe("/");
        expect(
          installed.icons.some(
            (i: { purpose: string }) => i.purpose === "maskable",
          ),
        ).toBe(true);
        for (const path of writeShapeBrandAssets) {
          expect(files).toContain("/" + path);
          expect(
            (await readFile(resolve(outDir, path))).length,
          ).toBeGreaterThan(0);
        }
      } else {
        expect(html).toContain("<title>Fountain Publisher</title>");
        expect(html).toContain('href="/favicon.svg"');
        expect(html).not.toContain('content="WriteShape"');
        expect(icon).toBe(sourceIcon);
        expect(manifest).toBe(sourceManifest);
        expect(shell).toBe(html);
        expect(files).not.toContain("/writeshape-icon.svg");
      }
    }
    expect(await readFile(resolve(repo, "index.html"), "utf8")).toBe(
      sourceHTML,
    );
    expect(await readFile(resolve(repo, "public/favicon.svg"), "utf8")).toBe(
      sourceIcon,
    );
    expect(
      await readFile(resolve(repo, "public/manifest.webmanifest"), "utf8"),
    ).toBe(sourceManifest);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}, 20000);

it("uses the same letter-free geometry for the editor mark and favicon", async () => {
  const component = renderToStaticMarkup(
    createElement(WriteShapeMark, { size: 28 }),
  );
  const asset = await readFile(
    resolve(repo, "public/writeshape-icon.svg"),
    "utf8",
  );
  const paths = (svg: string) =>
    [...svg.matchAll(/\bd="([^"]+)"/g)].map((match) => match[1]);
  expect(paths(component)).toEqual(paths(asset));
  expect(component).toContain('aria-hidden="true"');
  expect(component).toContain('width="28"');
  expect(component).not.toContain("<text");
});
