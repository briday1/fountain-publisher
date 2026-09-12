import { readFile } from "node:fs/promises";
import { loadPyodide } from "pyodide";
import { compilerPythonHelpers } from "../src/fountain_publisher/web/compiler-runtime.mjs";

// Node-only asset loading for the real-WASM smoke and worker responsiveness test.
// The engine and Python helpers are the same modules shipped to browsers.
export async function loadNodeCompilerRuntime() {
  const webRoot = new URL("../src/fountain_publisher/web/", import.meta.url);
  // Node worker_threads streams do not expose numeric stdout/stderr descriptors.
  const pyodide = await loadPyodide({ stdout: (message) => console.log(message), stderr: (message) => console.error(message) });
  await pyodide.loadPackage(new URL("vendor/micropip-0.11.1-py3-none-any.whl", webRoot).href);
  const wheels = [
    "six-1.17.0-py2.py3-none-any.whl",
    "pillow-12.2.0-cp314-cp314-pyemscripten_2026_0_wasm32.whl",
    "charset_normalizer-3.4.7-py3-none-any.whl",
    "reportlab-5.0.1-py3-none-any.whl",
    "screenplain-0.12.0-py3-none-any.whl",
    "pypdf-6.17.0-py3-none-any.whl",
  ];
  for (const wheel of wheels) pyodide.FS.writeFile(`/${wheel}`, await readFile(new URL(`vendor/${wheel}`, webRoot)));
  pyodide.FS.mkdirTree("/fonts");
  for (const font of ["CourierPrime-Regular.ttf", "CourierPrime-Bold.ttf", "CourierPrime-Italic.ttf", "CourierPrime-BoldItalic.ttf"]) {
    pyodide.FS.writeFile(`/fonts/${font}`, await readFile(new URL(`fonts/${font}`, webRoot)));
  }
  pyodide.globals.set("_wheels", wheels);
  await pyodide.runPythonAsync(`
import micropip
for wheel in _wheels:
    await micropip.install("emfs:/" + wheel, deps=False)
`);
  pyodide.runPython(compilerPythonHelpers);
  return pyodide;
}
