import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { loadPyodide } from "pyodide";
import { createLocalCompiler } from "../src/fountain_publisher/web/local-compiler.mjs";

const webRoot = new URL("../src/fountain_publisher/web/", import.meta.url);
const pyodide = await loadPyodide();
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

// Exercise the browser's production helpers, not a separate simplified compiler.
// Decode only this static JS string literal so escaped Python regular expressions
// have exactly the same meaning here as when app.mjs initializes the runtime.
const appSource = await readFile(new URL("app.mjs", webRoot), "utf8");
const helperTemplate = appSource.match(/pyodide\.runPython\((`\nimport io\n[\s\S]*?\n`)\);/)?.[1];
assert.ok(helperTemplate, "The browser compiler's Python helper template must be present");
assert.ok(!helperTemplate.slice(1, -1).includes("`"), "The helper template must contain no nested JavaScript literals");
assert.ok(!helperTemplate.includes("${"), "The helper template must contain no JavaScript interpolation");
const helpers = runInNewContext(helperTemplate, Object.create(null), { timeout: 1000 });
pyodide.runPython(helpers);

const summary = JSON.parse(pyodide.runPython(`
import xml.etree.ElementTree as ET

def inspect_pdf(data, expected_size, expected_text, absent_text=None):
    assert data.startswith(b"%PDF"), "Compiler must return PDF bytes"
    reader = PdfReader(io.BytesIO(data))
    assert len(reader.pages) > 0, "Compiler must return at least one PDF page"
    for page in reader.pages:
        assert abs(float(page.mediabox.width) - expected_size[0]) < 0.01
        assert abs(float(page.mediabox.height) - expected_size[1]) < 0.01
    text = "\\n".join(page.extract_text() or "" for page in reader.pages)
    assert expected_text in text, (expected_text, text)
    if absent_text is not None:
        assert absent_text not in text, "One compile must not reuse another document's content"
    return len(reader.pages)

assert _fp_register_pdf_fonts()[0] == "CourierPrime", "Bundled fonts must load without the fallback"
first_source = "Title: First Browser\\nAuthor: Local Writer\\n\\n# Act One\\n\\nINT. FIRST LAB - DAY\\n\\nUnique first document action.\\n"
second_source = "# Act Two\\n\\nEXT. SECOND GARDEN - NIGHT\\n\\n" + "Unique second document action.\\n" * 12

first_pdf = _fp_compile(first_source, "pdf", "letter", "margin", "sequential")
first_eighths = _fp_last_page_eighths
assert _fp_title_page_count == 1
assert 1 <= first_eighths <= 8
first_pages = inspect_pdf(first_pdf, letter, "Unique first document action.", "Unique second document action.")
assert first_pages == 2, "The title page and screenplay page must both be present"

second_pdf = _fp_compile(second_source, "pdf", "a4", "inline", "act")
second_eighths = _fp_last_page_eighths
assert _fp_title_page_count == 0
assert 1 <= second_eighths <= 8
assert second_eighths != first_eighths, "The fixtures must exercise different page-usage metrics"
second_pages = inspect_pdf(second_pdf, A4, "A1S1. EXT. SECOND GARDEN - NIGHT", "Unique first document action.")
assert second_pages == 1

first_fdx = _fp_compile(first_source, "fdx", "a4", "off", "act")
assert _fp_last_page_eighths == 0, "FDX must reset PDF metrics from the preceding compile"
assert _fp_title_page_count == 0, "FDX must reset the preceding compile's title-page count"
first_xml = ET.fromstring(first_fdx)
assert first_xml.tag == "FinalDraft"
assert "Unique first document action." in "".join(first_xml.itertext())
assert "Unique second document action." not in "".join(first_xml.itertext())
first_headings = first_xml.findall(".//Paragraph[@Type='Scene Heading']")
assert first_headings and all("Number" not in heading.attrib for heading in first_headings)

second_fdx = _fp_compile(second_source, "fdx", "letter", "inline", "act")
assert _fp_last_page_eighths == 0
second_xml = ET.fromstring(second_fdx)
assert "Unique second document action." in "".join(second_xml.itertext())
assert "Unique first document action." not in "".join(second_xml.itertext())
assert "".join(node.text or "" for node in second_xml.findall(".//Paragraph[@Type='Scene Heading']/Text")) == "A1S1. EXT. SECOND GARDEN - NIGHT"

empty_pdf = _fp_compile("", "pdf", "letter", "off", "sequential")
assert empty_pdf.startswith(b"%PDF")
assert _fp_last_page_eighths == 0, "An empty compile must not retain another document's page usage"

beat_pdf = _fp_compile_beat_sheet("Local Beats", "A local premise.", ["First isolated beat.", "Second isolated beat."], "a4")
beat_pages = inspect_pdf(beat_pdf, A4, "First isolated beat.", "Unique first document action.")
assert _fp_last_page_eighths == 0, "Beat-sheet export must not alter screenplay page metrics"

# Repeat the original job after every other export to catch runtime-global leaks.
repeat_pdf = _fp_compile(first_source, "pdf", "letter", "margin", "sequential")
assert inspect_pdf(repeat_pdf, letter, "Unique first document action.", "Unique second document action.") == first_pages
assert _fp_last_page_eighths == first_eighths
json.dumps({"pdfCompiles": 4, "fdxCompiles": 2, "beatSheetCompiles": 1, "firstPages": first_pages, "secondPages": second_pages, "beatPages": beat_pages, "firstEighths": first_eighths, "secondEighths": second_eighths})
`));

// Exercise the JS adapter too: concurrent callers must each capture their own
// bytes and metrics before the next job can mutate the runtime's scratch globals.
const compileLocally = createLocalCompiler(async () => pyodide);
const firstRequest = {
  source: pyodide.globals.get("first_source"),
  pageSize: "letter",
  sceneNumbers: "margin",
  sceneNumberFormat: "sequential",
};
const secondRequest = {
  source: pyodide.globals.get("second_source"),
  pageSize: "a4",
  sceneNumbers: "inline",
  sceneNumberFormat: "act",
};
const [firstJob, secondJob, fdxJob] = await Promise.all([
  compileLocally("pdf", firstRequest),
  compileLocally("pdf", secondRequest),
  compileLocally("fdx", firstRequest),
]);
assert.equal(firstJob.pageCount, 1, "The adapter must exclude the first document's title page");
assert.equal(secondJob.pageCount, 1, "The adapter must not deduct the first document's title page from the next document");
assert.equal(firstJob.lastPageEighths, summary.firstEighths);
assert.equal(secondJob.lastPageEighths, summary.secondEighths);
assert.equal(firstJob.blob.type, "application/pdf");
assert.equal(secondJob.blob.type, "application/pdf");
assert.equal(fdxJob.pageCount, 0);
assert.equal(fdxJob.lastPageEighths, 0);
assert.equal(fdxJob.blob.type, "application/xml;charset=utf-8");
assert.match(await fdxJob.blob.text(), /<FinalDraft\b/);
const physicalPageCount = async (blob) => (new TextDecoder("latin1").decode(await blob.arrayBuffer()).match(/\/Type\s*\/Page\b/g) || []).length;
assert.equal(await physicalPageCount(firstJob.blob), 2);
assert.equal(await physicalPageCount(secondJob.blob), 1);
const titleOnly = await compileLocally("pdf", { ...firstRequest, source: "Title: Only a title\n" });
assert.equal(await physicalPageCount(titleOnly.blob), 1);
assert.equal(titleOnly.pageCount, 0);
assert.equal(titleOnly.lastPageEighths, 0);
const empty = await compileLocally("pdf", { ...firstRequest, source: "" });
assert.equal(empty.pageCount, 0);
assert.equal(empty.lastPageEighths, 0);
summary.adapterCompiles = 5;
console.log(`Browser Screenplain WebAssembly smoke passed: ${JSON.stringify(summary)}`);
