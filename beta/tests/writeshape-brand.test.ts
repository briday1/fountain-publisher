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
  writeShapePages,
  writeShapePageAssets,
} from "../build-tools/writeshapeBrand";
import {
  WriteShapeMark,
  WriteShapeLogo,
  writeShapeRoseColors,
} from "../src/components/WriteShapeMark";

import { writeShapeThemes } from "../src/branding/writeShapeThemes";

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
      for (const page of writeShapePages) {
        const actual = await readFile(resolve(outDir, page), "utf8");
        const expected = await readFile(
          resolve(
            repo,
            mode === "writeshape" ? "writeshape-pages" : "public",
            page,
          ),
          "utf8",
        );
        expect(actual).toBe(expected);
      }
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
        expect(html).toContain(
          'href="https://fountain-publisher.com/writeshape-apple-touch-icon.png?v=keyboard5"',
        );
        expect(html).toContain('crossorigin="use-credentials"');
        expect(shell).toBe(html);
        expect(icon).not.toContain("<text");
        expect(icon).toBe(
          await readFile(resolve(repo, "public/writeshape-icon.svg"), "utf8"),
        );
        const installed = JSON.parse(manifest);
        expect(installed.name).toBe("WriteShape");
        expect(installed.short_name).toBe("WriteShape");
        expect(installed.start_url).toBe("/");
        expect(installed.theme_color).toBe("#80516f");
        expect(installed.background_color).toBe("#fff9fc");
        for (const icon of installed.icons) {
          expect(new URL(icon.src).searchParams.get("v")).toBe("keyboard5");
          expect(new URL(icon.src).origin).toBe(
            "https://fountain-publisher.com",
          );
        }
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
        for (const page of writeShapePageAssets) {
          expect(files).toContain("/" + page);
          expect(await readFile(resolve(outDir, page), "utf8")).toBe(
            await readFile(resolve(repo, "writeshape-pages", page), "utf8"),
          );
        }
      } else {
        expect(html).toContain("<title>Fountain Publisher</title>");
        expect(html).toContain('href="/favicon.svg"');
        expect(html).not.toContain('content="WriteShape"');
        expect(icon).toBe(sourceIcon);
        expect(manifest).toBe(sourceManifest);
        expect(shell).toBe(html);
        expect(files).not.toContain("/writeshape-icon.svg");
        for (const page of writeShapePageAssets)
          expect(files).not.toContain("/" + page);
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

it("uses the approved keycap geometry for the themed editor and Rose install icons", async () => {
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
  expect(component).toContain("var(--accent, #80516f)");
  expect(component.match(/data-key="[WS]"/g)).toHaveLength(2);
  expect(component).not.toMatch(/<linearGradient|<radialGradient|<filter/);
  const rose = renderToStaticMarkup(
    createElement(WriteShapeMark, { colors: writeShapeRoseColors }),
  );
  const artwork = rose.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
  expect(asset).toContain(artwork);
  expect(asset).not.toContain("var(--");
  expect(asset).toContain('fill="#fff9fc"');
  const maskable = await readFile(
    resolve(repo, "public/writeshape-maskable.svg"),
    "utf8",
  );
  expect(paths(maskable)).toEqual(paths(asset));
  const points = (svg: string) =>
    [...svg.matchAll(/points="([^"]+)"/g)].map((match) => match[1]);
  expect(points(maskable)).toEqual(points(asset));
  expect(maskable).toContain("scale(.90)");
  expect(maskable).toContain('<path d="M0 0H900V900H0Z" fill="#fff9fc"');
  expect(asset).not.toContain("<rect");
  for (const [file, size] of [
    ["writeshape-icon-192.png", 192],
    ["writeshape-icon-512.png", 512],
    ["writeshape-maskable-512.png", 512],
    ["writeshape-apple-touch-icon.png", 180],
  ] as const) {
    const png = await readFile(resolve(repo, "public", file));
    expect(png.subarray(1, 4).toString()).toBe("PNG");
    expect(png.readUInt32BE(16)).toBe(size);
    expect(png.readUInt32BE(20)).toBe(size);
  }
});

it("keeps all nine saved icons and transparent uncropped logos in sync with app geometry", async () => {
  const inner = (svg: string) =>
    svg
      .trim()
      .replace(/^<svg[^>]*>/, "")
      .replace(/<\/svg>$/, "");
  for (const theme of writeShapeThemes) {
    const icon = await readFile(
      resolve(
        repo,
        `public/branding/writeshape/icons/writeshape-${theme.id}.svg`,
      ),
      "utf8",
    );
    const logo = await readFile(
      resolve(
        repo,
        `public/branding/writeshape/logos/writeshape-${theme.id}.svg`,
      ),
      "utf8",
    );
    expect(inner(icon)).toBe(
      inner(
        renderToStaticMarkup(
          createElement(WriteShapeMark, { colors: theme.colors }),
        ),
      ),
    );
    expect(inner(logo)).toBe(
      inner(
        renderToStaticMarkup(
          createElement(WriteShapeLogo, { colors: theme.colors }),
        ),
      ),
    );
    expect(logo).not.toContain("<clipPath");
    expect(logo).not.toContain("<rect");
    expect(logo).not.toContain("<text");
    expect(logo).toContain('aria-label="WriteShape"');
    const png = await readFile(
      resolve(
        repo,
        `public/branding/writeshape/logos/writeshape-${theme.id}.png`,
      ),
    );
    expect(png.readUInt32BE(16)).toBe(900);
    expect(png[25]).toBe(6); // RGBA export retains a transparent background.
  }
});
