// Regenerate after changing the approved artwork. Requires Inkscape for PNG exports.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import {
  WriteShapeMark,
  writeShapeRoseColors,
} from "../src/components/WriteShapeMark";
import { keycapViewBox } from "../src/components/writeShapeKeycaps";

const publicDir = resolve(import.meta.dirname, "../public");
const markup = renderToStaticMarkup(
  createElement(WriteShapeMark, { colors: writeShapeRoseColors }),
);
const artwork = markup.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
const [x, y, w, h] = keycapViewBox.split(" ").map(Number);
// Use most of the normal icon tile; only maskable icons need the safe-circle inset.
function icon(round: boolean, coverage = 0.9) {
  const scale = (512 * coverage) / w;
  const transform = `translate(256 256) scale(${scale}) translate(${-x - w / 2} ${-y - h / 2})`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" ${round ? 'rx="112"' : ""} fill="#e4d7dc"/><g transform="${transform}">${artwork}</g></svg>\n`;
}
writeFileSync(resolve(publicDir, "writeshape-icon.svg"), icon(true));
writeFileSync(resolve(publicDir, "writeshape-maskable.svg"), icon(false, 0.76));
for (const [source, target, size] of [
  ["writeshape-icon.svg", "writeshape-icon-192.png", 192],
  ["writeshape-icon.svg", "writeshape-icon-512.png", 512],
  ["writeshape-maskable.svg", "writeshape-maskable-512.png", 512],
] as const) {
  execFileSync("inkscape", [
    resolve(publicDir, source),
    "--export-type=png",
    `--export-width=${size}`,
    `--export-height=${size}`,
    `--export-filename=${resolve(publicDir, target)}`,
  ]);
}
// iOS supplies its own corner mask. Keep its artwork as large as the regular icon.
execFileSync(
  "inkscape",
  [
    "--pipe",
    "--export-type=png",
    "--export-width=180",
    "--export-height=180",
    `--export-filename=${resolve(publicDir, "writeshape-apple-touch-icon.png")}`,
  ],
  { input: icon(false) },
);
writeFileSync(resolve(publicDir, "writeshape-brand-preview.svg"), icon(true));
