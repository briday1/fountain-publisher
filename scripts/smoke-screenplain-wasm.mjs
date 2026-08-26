import { readFile } from "node:fs/promises";
import { loadPyodide } from "pyodide";

const pyodide = await loadPyodide();
await pyodide.loadPackage(new URL("../src/fountain_publisher/web/vendor/micropip-0.11.1-py3-none-any.whl", import.meta.url).href);
const wheels = [
  "six-1.17.0-py2.py3-none-any.whl",
  "pillow-12.2.0-cp314-cp314-pyemscripten_2026_0_wasm32.whl",
  "charset_normalizer-3.4.7-py3-none-any.whl",
  "reportlab-5.0.1-py3-none-any.whl",
  "screenplain-0.12.0-py3-none-any.whl",
];
for (const wheel of wheels) pyodide.FS.writeFile(`/${wheel}`, await readFile(`src/fountain_publisher/web/vendor/${wheel}`));
pyodide.globals.set("_wheels", wheels);
await pyodide.runPythonAsync(`
import micropip
for wheel in _wheels:
    await micropip.install("emfs:/" + wheel, deps=False)
`);
const result = pyodide.runPython(`
import io
from screenplain.export import pdf
from screenplain.parsers.fountain import parse
screenplay = parse(io.StringIO("Title: WASM Test\\nAuthor: Screenplain\\n\\nINT. LAB - DAY\\n\\nIt works.\\n"))
output = io.BytesIO()
pdf.to_pdf(screenplay, output)
output.getvalue()
`);
const pdf = result instanceof Uint8Array ? result : result.toJs();
result.destroy?.();
if (!(pdf instanceof Uint8Array) || new TextDecoder("latin1").decode(pdf.slice(0, 4)) !== "%PDF") throw new Error("Screenplain did not produce a PDF in WebAssembly");
console.log(`Screenplain WebAssembly PDF: ${pdf.byteLength} bytes`);
