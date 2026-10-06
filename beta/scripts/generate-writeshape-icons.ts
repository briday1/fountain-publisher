// Regenerate the complete approved branding set. Requires Inkscape for PNG exports.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { zipSync, strToU8 } from "fflate";
import {
  WriteShapeMark,
  WriteShapeLogo,
  writeShapeRoseColors,
} from "../src/components/WriteShapeMark";
import { writeShapeThemes } from "../src/branding/writeShapeThemes";

const publicDir = resolve(import.meta.dirname, "../public");
const brandDir = resolve(publicDir, "branding/writeshape");
mkdirSync(resolve(brandDir, "icons"), { recursive: true });
mkdirSync(resolve(brandDir, "logos"), { recursive: true });
const vectors: Record<string, Uint8Array> = {};
const svg = (markup: string) =>
  markup.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ') + "\n";
function png(source: string, target: string, size: number) {
  execFileSync(
    "inkscape",
    [
      source,
      "--export-type=png",
      `--export-width=${size}`,
      `--export-filename=${target}`,
    ],
    { stdio: "pipe" },
  );
}
const iconBoard: string[] = [],
  logoBoard: string[] = [];
for (const [i, theme] of writeShapeThemes.entries()) {
  const icon = svg(
    renderToStaticMarkup(
      createElement(WriteShapeMark, {
        size: 900,
        colors: theme.colors,
        opaque: true,
      }),
    ),
  );
  const logo = svg(
    renderToStaticMarkup(
      createElement(WriteShapeLogo, { width: 900, colors: theme.colors }),
    ),
  );
  for (const [folder, markup] of [
    ["icons", icon],
    ["logos", logo],
  ] as const) {
    const name = `${folder}/writeshape-${theme.id}.svg`;
    const path = resolve(brandDir, name);
    writeFileSync(path, markup);
    vectors[name] = strToU8(markup);
    png(path, path.replace(/\.svg$/, ".png"), 900);
  }
  const x = (i % 3) * 500 + 30,
    y = Math.floor(i / 3) * 520 + 18;
  const nested = (markup: string) =>
    markup
      .replaceAll("writeshape-_", `writeshape-${theme.id}-_`)
      .replace(
        /<svg[^>]*viewBox="([^"]+)"[^>]*>/,
        (_all, viewBox) =>
          `<svg x="${x}" y="${y}" width="440" height="440" viewBox="${viewBox}" overflow="hidden">`,
      );
  const label = (color: string) =>
    `<text x="${(i % 3) * 500 + 250}" y="${Math.floor(i / 3) * 520 + 492}" text-anchor="middle" font-family="DejaVu Sans,sans-serif" font-size="24" font-weight="600" fill="${color}">${theme.name}</text>`;
  iconBoard.push(nested(icon), label("#45434c"));
  logoBoard.push(
    `<rect x="${(i % 3) * 500 + 6}" y="${Math.floor(i / 3) * 520 + 6}" width="488" height="508" fill="${theme.colors.bg}"/>`,
    nested(logo),
    label(theme.colors.accent),
  );
}
for (const [name, cells] of [
  ["icons", iconBoard],
  ["logos", logoBoard],
] as const) {
  const markup = `<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="1560" viewBox="0 0 1500 1560"><rect width="1500" height="1560" fill="#f5f4f6"/>${cells.join("")}</svg>\n`;
  const path = resolve(brandDir, `${name}-comparison.svg`);
  writeFileSync(path, markup);
  vectors[`${name}-comparison.svg`] = strToU8(markup);
  png(path, path.replace(/\.svg$/, ".png"), 1500);
}
const readme = `# WriteShape branding\n\nThe approved W/S design uses only two staggered keys, with simple depth on the right and bottom. Both share the theme accent. The complete silhouette, including its depth, is centered and fully visible with no rim or outer frame.\n\n- icons/: centered W/S icons in all nine themes.\n- logos/: the same two keys uncropped, with the Courier Prime WriteShape wordmark underneath and a transparent background.\n- *-comparison: all nine variants together. Backdrops and labels are for comparison only.\n- writeshape-brand-vectors.zip: all SVGs, comparison sheets, font licenses and this guide.\n\nThe app uses WriteShapeMark and WriteShapeLogo for theme-aware branding. Downloads/install icons use Rose. Maskable artwork is slightly reduced so both filled keys fit the safe circle; the background fills the tile.\n\nRun npm run brand:icons from beta/ after changing the shared vector geometry or palettes. Requires Inkscape. Sources: src/components/writeShapeKeyboard.ts, src/components/WriteShapeMark.tsx, src/branding/writeShapeThemes.ts, scripts/generate-writeshape-icons.ts.\n\nKey legends use DejaVu Sans Bold outlined paths; the wordmark uses Courier Prime Bold. Both font licenses are in the archive.\n`;
writeFileSync(resolve(brandDir, "README.md"), readme);
vectors["README.md"] = strToU8(readme);
const courierLicense = readFileSync(
  resolve(
    import.meta.dirname,
    "../node_modules/@fontsource/courier-prime/LICENSE",
  ),
);
writeFileSync(resolve(brandDir, "COURIER-PRIME-LICENSE.txt"), courierLicense);
vectors["COURIER-PRIME-LICENSE.txt"] = courierLicense;
vectors["FONT-LICENSE.txt"] = readFileSync(
  resolve(import.meta.dirname, "../src/fonts/LICENSE.txt"),
);
writeFileSync(
  resolve(brandDir, "writeshape-brand-vectors.zip"),
  zipSync(vectors),
);
const rose = readFileSync(resolve(brandDir, "icons/writeshape-rose.svg"));
writeFileSync(resolve(publicDir, "writeshape-icon.svg"), rose);
writeFileSync(resolve(publicDir, "writeshape-brand-preview.svg"), rose);
writeFileSync(
  resolve(publicDir, "writeshape-maskable.svg"),
  svg(
    renderToStaticMarkup(
      createElement(WriteShapeMark, {
        size: 900,
        colors: writeShapeRoseColors,
        maskable: true,
      }),
    ),
  ),
);
for (const [source, target, size] of [
  ["writeshape-icon.svg", "writeshape-icon-192.png", 192],
  ["writeshape-icon.svg", "writeshape-icon-512.png", 512],
  ["writeshape-maskable.svg", "writeshape-maskable-512.png", 512],
] as const)
  png(resolve(publicDir, source), resolve(publicDir, target), size);
// iOS supplies its own outside corner mask; keep the PNG opaque under it.
execFileSync(
  "inkscape",
  [
    "--pipe",
    "--export-type=png",
    "--export-width=180",
    `--export-filename=${resolve(publicDir, "writeshape-apple-touch-icon.png")}`,
  ],
  {
    input: svg(
      renderToStaticMarkup(
        createElement(WriteShapeMark, {
          size: 900,
          colors: writeShapeRoseColors,
          opaque: true,
        }),
      ),
    ),
    stdio: ["pipe", "pipe", "pipe"],
  },
);
console.log(
  "Saved nine icons and nine uncropped wordmarks as SVG/PNG, comparisons, vector archive and Rose install icons.",
);
