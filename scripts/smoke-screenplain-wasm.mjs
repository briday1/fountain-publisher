import assert from "node:assert/strict";
import { Worker } from "node:worker_threads";
import { createLocalCompiler } from "../src/fountain_publisher/web/local-compiler.mjs";
import { createCompilerWorkerClient } from "../src/fountain_publisher/web/compiler-client.mjs";
import { loadNodeCompilerRuntime } from "./compiler-node-runtime.mjs";

const pyodide = await loadNodeCompilerRuntime();

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

// Measure the old UI-thread execution against the exact same engine in a real
// dedicated thread. A timer heartbeat is a scheduling check, not browser FPS.
const representative = "Title: Worker Responsiveness\nAuthor: Local Writer\n\n"
  + Array.from({ length: 80 }, (_, scene) => `INT. TEST ROOM ${scene + 1} - DAY\n\n`
    + Array.from({ length: 8 }, () => "A writer studies the screenplay, compares the pages, and makes another careful revision.\n\nWRITER\nThe next scene needs a little more room to breathe.\n\n").join("")).join("");
const benchmarkRequest = { ...firstRequest, source: representative };
async function measure(operation) {
  let heartbeats = 0;
  let longestGap = 0;
  let lastTick = performance.now();
  const ticker = setInterval(() => {
    const now = performance.now();
    longestGap = Math.max(longestGap, now - lastTick);
    lastTick = now;
    heartbeats += 1;
  }, 10);
  const started = performance.now();
  try {
    const result = await operation();
    const elapsedMs = performance.now() - started;
    return { result, elapsedMs: Math.round(elapsedMs), heartbeats, longestGapMs: Math.round(Math.max(longestGap, performance.now() - lastTick)) };
  } finally { clearInterval(ticker); }
}
const baseline = await measure(() => compileLocally("pdf", benchmarkRequest));
const workerInstances = [];
const client = createCompilerWorkerClient({ createWorker() {
  const worker = new Worker(new URL("./compiler-worker-node.mjs", import.meta.url), { execArgv: [] });
  workerInstances.push(worker);
  return {
    addEventListener(type, handler) {
      worker.on(type, (data) => handler(type === "message" ? { data } : data));
    },
    postMessage(data, transfer) { worker.postMessage(data, transfer); },
    terminate() { void worker.terminate(); },
  };
} });
try {
  // Warm both runtimes before comparing compilation itself, excluding startup.
  const warmed = await client.compile("pdf", firstRequest);
  assert.equal(warmed.pageCount, firstJob.pageCount);
  const offThread = await measure(() => client.compile("pdf", benchmarkRequest));
  assert.equal(offThread.result.pageCount, baseline.result.pageCount);
  assert.equal(offThread.result.lastPageEighths, baseline.result.lastPageEighths);
  assert.equal(baseline.heartbeats, 0, "The baseline must demonstrate the synchronous engine's main-thread blockage");
  assert.ok(offThread.heartbeats >= 2, "The main thread must keep servicing timers while the worker compiles");
  const imported = await client.extractPdf(await firstJob.blob.arrayBuffer());
  assert.equal(imported.length, 2);
  assert.ok(imported.some((page) => page.includes("Unique first document action.")));
  const beatSheet = await client.beatSheet({ title: "Worker Beats", premise: "Local only", beats: ["A worker exports a beat sheet"], pageSize: "a4" });
  assert.equal(beatSheet.type, "application/pdf");
  assert.equal(await physicalPageCount(beatSheet), 1);
  summary.worker = {
    pages: offThread.result.pageCount,
    baseline: { elapsedMs: baseline.elapsedMs, heartbeats: baseline.heartbeats, longestGapMs: baseline.longestGapMs },
    dedicatedThread: { elapsedMs: offThread.elapsedMs, heartbeats: offThread.heartbeats, longestGapMs: offThread.longestGapMs },
    importPages: imported.length,
  };
} finally {
  client.dispose();
  await Promise.all(workerInstances.map((worker) => worker.terminate()));
}
console.log(`Browser Screenplain WebAssembly smoke passed: ${JSON.stringify(summary)}`);
