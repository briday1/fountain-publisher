import { createHash } from "node:crypto";
import { readFile, copyFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Plugin } from "vite";

const description =
  "Write screenplays and books, organize beats, and export your work.";
export const writeShapePages = [
  "about.html",
  "privacy.html",
  "terms.html",
  "backup.html",
] as const;
export const writeShapePageAssets = [
  ...writeShapePages,
  "writeshape-site.css",
  "writeshape-site.js",
] as const;
export const writeShapeBrandAssets = [
  "writeshape-icon.svg",
  "writeshape-maskable.svg",
  "writeshape-icon-192.png",
  "writeshape-icon-512.png",
  "writeshape-maskable-512.png",
  "writeshape-apple-touch-icon.png",
  "writeshape-manifest.webmanifest",
] as const;

/** Keep Fountain source metadata intact; brand only the isolated WriteShape mode. */
export function writeshapeBrand(): Plugin {
  let publicDir = "";
  let pagesDir = "";
  return {
    name: "writeshape-brand",
    apply: (_config, { mode }) => mode === "writeshape",
    configResolved(config) {
      publicDir = config.publicDir;
      pagesDir = resolve(import.meta.dirname, "../writeshape-pages");
    },
    transformIndexHtml: {
      order: "pre",
      async handler(html) {
        // A branding-only update must also produce a new offline release.
        const hash = createHash("sha256");
        for (const fileName of writeShapeBrandAssets)
          hash.update(await readFile(resolve(publicDir, fileName)));
        for (const fileName of writeShapePageAssets)
          hash.update(await readFile(resolve(pagesDir, fileName)));
        const brandRevision = hash.digest("hex").slice(0, 16);
        return {
          html: html
            .replace(/<title>[^<]*<\/title>/, "<title>WriteShape</title>")
            .replace(
              /(<meta\s+name="description"\s+content=")[^"]*("\s*\/?>)/,
              `$1${description}$2`,
            )
            .replace(
              /(<meta\s+name="theme-color"\s+content=")[^"]*("\s*\/?>)/,
              "$1#80516f$2",
            )
            .replace('href="/favicon.svg"', 'href="/writeshape-icon.svg"')
            .replace(
              'href="/manifest.webmanifest"',
              'href="/writeshape-manifest.webmanifest" crossorigin="use-credentials"',
            ),
          tags: [
            {
              tag: "meta",
              attrs: {
                name: "writeshape-brand-revision",
                content: brandRevision,
              },
              injectTo: "head",
            },
            {
              tag: "meta",
              attrs: { name: "application-name", content: "WriteShape" },
              injectTo: "head",
            },
            {
              tag: "meta",
              attrs: {
                name: "apple-mobile-web-app-title",
                content: "WriteShape",
              },
              injectTo: "head",
            },
            {
              tag: "meta",
              attrs: { property: "og:title", content: "WriteShape" },
              injectTo: "head",
            },
            {
              tag: "meta",
              attrs: { property: "og:description", content: description },
              injectTo: "head",
            },
            {
              tag: "link",
              attrs: {
                rel: "apple-touch-icon",
                sizes: "180x180",
                // Home-screen icon fetches must not depend on an Access session.
                href: "https://fountain-publisher.com/writeshape-apple-touch-icon.png?v=keys7",
              },
              injectTo: "head",
            },
          ],
        };
      },
    },
    async generateBundle() {
      // The shared public pages belong to Fountain. Replace them only in this
      // build, and emit them before offlineShell captures the release assets.
      for (const fileName of writeShapePageAssets)
        this.emitFile({
          type: "asset",
          fileName,
          source: await readFile(resolve(pagesDir, fileName)),
        });
      // Emit public brand assets into Rollup's bundle so offlineShell includes
      // them in its atomic release. Public-only files otherwise aren't cached.
      for (const fileName of writeShapeBrandAssets)
        this.emitFile({
          type: "asset",
          fileName,
          source: await readFile(resolve(publicDir, fileName)),
        });
    },
    async writeBundle(options) {
      // Existing installed apps may still fetch the original manifest/icon URLs.
      // Write these aliases AFTER bundle generation, keeping offlineShell's fixed
      // canonical URLs out of bundle.assets (cache.addAll rejects duplicates).
      if (!options.dir) return;
      await Promise.all([
        copyFile(
          resolve(publicDir, "writeshape-icon.svg"),
          resolve(options.dir, "favicon.svg"),
        ),
        copyFile(
          resolve(publicDir, "writeshape-manifest.webmanifest"),
          resolve(options.dir, "manifest.webmanifest"),
        ),
      ]);
    },
  };
}
