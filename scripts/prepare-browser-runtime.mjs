// Prepare browser compiler assets before building a distributable Python wheel.
// Source checkouts can instead serve this same pinned runtime from node_modules.
import { access, cp, mkdir } from "node:fs/promises";

const runtimeFiles = [
  "pyodide.mjs", "pyodide.asm.mjs", "pyodide.asm.wasm",
  "pyodide-lock.json", "python_stdlib.zip",
];
const runtime = new URL("../node_modules/pyodide/", import.meta.url);
const target = new URL("../src/fountain_publisher/web/pyodide/", import.meta.url);
const micropip = "micropip-0.11.1-py3-none-any.whl";
const wheel = new URL(`../src/fountain_publisher/web/vendor/${micropip}`, import.meta.url);

try {
  await Promise.all([...runtimeFiles.map((name) => access(new URL(name, runtime))), access(wheel)]);
} catch (error) {
  throw new Error("Browser runtime assets are missing. Run npm ci in this checkout before preparing the desktop package.", { cause: error });
}
await mkdir(target, { recursive: true });
await Promise.all([
  ...runtimeFiles.map((name) => cp(new URL(name, runtime), new URL(name, target))),
  cp(wheel, new URL(micropip, target)),
]);
console.log("Prepared the local browser compiler runtime for Python packaging.");
