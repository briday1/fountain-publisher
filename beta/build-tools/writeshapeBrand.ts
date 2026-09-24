import { createHash } from "node:crypto";
import { readFile, copyFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Plugin } from "vite";

const description =
  "A focused screenplay studio. Write, organize your story, and publish Fountain screenplays.";
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
  return {
    name: "writeshape-brand",
    apply: (_config, { mode }) => mode === "writeshape",
    configResolved(config) {
      publicDir = config.publicDir;
    },
    transformIndexHtml: {
      order: "pre",
      async handler(html) {
        // A branding-only update must also produce a new offline release.
        const hash = createHash("sha256");
        for (const fileName of writeShapeBrandAssets)
          hash.update(await readFile(resolve(publicDir, fileName)));
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
              "$1#243A35$2",
            )
            .replace('href="/favicon.svg"', 'href="/writeshape-icon.svg"')
            .replace(
              'href="/manifest.webmanifest"',
              'href="/writeshape-manifest.webmanifest"',
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
                href: "/writeshape-apple-touch-icon.png",
              },
              injectTo: "head",
            },
          ],
        };
      },
    },
    async generateBundle() {
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
