// Pure JavaScript/draw-work diagnostic. Canvas methods are no-ops: timings do
// NOT include browser style/layout, rasterization, compositing or GPU work.
// Example: node scripts/benchmark-backgrounds.mjs --baseline=main
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import vm from "node:vm";
import { backgroundBitmapSize, backgroundElementVisible, backgroundTileGrid, createBackgroundLoop } from "../src/fountain_publisher/web/background-performance.mjs";

const sourcePath = "src/fountain_publisher/web/app.mjs";
const current = await readFile(new URL(`../${sourcePath}`, import.meta.url), "utf8");
const baseline = process.argv.find((arg) => arg.startsWith("--baseline="))?.slice("--baseline=".length);
const versions = baseline
  ? [[baseline, execFileSync("git", ["show", `${baseline}:${sourcePath}`], { encoding: "utf8" })], ["working tree", current]]
  : [["working tree", current]];

function measure(source, width, height, dpr, pattern) {
  const counts = { bounds: 0, paths: 0, rectangles: 0 };
  const context = new Proxy({}, { get(target, key) {
    return target[key] ?? (() => {
      if (key === "lineTo") counts.paths += 1;
      if (key === "fillRect" || key === "strokeRect") counts.rectangles += 1;
    });
  } });
  const canvas = { width: 0, height: 0, closest: () => null,
    getBoundingClientRect() { counts.bounds += 1; return { width, height }; },
    getContext: () => context,
  };
  const sandbox = vm.createContext({
    canvas, performance, devicePixelRatio: dpr,
    document: { documentElement: { dataset: { effectiveTheme: "dark" } } },
    getComputedStyle: () => ({ getPropertyValue: () => "#ffffff" }),
    matchMedia: () => ({ matches: false }), requestAnimationFrame: () => 0, cancelAnimationFrame() {},
    backgroundBitmapSize, backgroundElementVisible, backgroundTileGrid, createBackgroundLoop,
  });
  const end = source.includes("const backgroundResizeObserver =") ? "const backgroundResizeObserver =" : "function escapeHtml(";
  vm.runInContext(source.slice(source.indexOf("const DOT_DIRECTIONS ="), source.indexOf(end)), sandbox);
  vm.runInContext(`ambientPattern = ${JSON.stringify(pattern)}; ambientDensity = 240;
    if (typeof prepareBackgroundCanvas === "function") prepareBackgroundCanvas(canvas);`, sandbox);
  const draw = vm.runInContext("(time) => drawAmbient(canvas, time)", sandbox);
  for (let index = 0; index < 8; index += 1) draw(index * 33.34);
  counts.bounds = counts.paths = counts.rectangles = 0;
  const samples = [];
  const frames = 40;
  for (let index = 0; index < frames; index += 1) {
    const start = performance.now();
    draw((index + 8) * 33.34);
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  return { medianMs: +samples[20].toFixed(3), p95Ms: +samples[38].toFixed(3),
    bitmapPixels: canvas.width * canvas.height,
    geometryReadsPerFrame: counts.bounds / frames,
    pathSegmentsPerFrame: counts.paths / frames,
    tileRectanglesPerFrame: counts.rectangles / frames,
  };
}

console.log("NO-OP CANVAS: JS and draw-work only; not browser frame times. Density 240%.");
for (const [width, height, dpr] of [[1440, 900, 2], [2560, 1440, 2], [5120, 2880, 1]]) {
  for (const pattern of ["constellation", "topographic", "tiles"]) {
    for (const [version, source] of versions) {
      console.log(JSON.stringify({ version, surface: `${width}x${height}@${dpr}x`, pattern, ...measure(source, width, height, dpr, pattern) }));
    }
  }
}
