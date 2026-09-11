import assert from "node:assert/strict";
import test from "node:test";
import { createLocalCompiler } from "../../src/fountain_publisher/web/local-compiler.mjs";

const encode = (value) => new TextEncoder().encode(value);

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((accept, fail) => { resolve = accept; reject = fail; });
  return { promise, resolve, reject };
}

function fakeRuntime(compile = () => encode("/Type /Page")) {
  const globals = new Map();
  const calls = [];
  const runtime = {
    globals: {
      set(key, value) { calls.push(["set", key, value]); globals.set(key, value); },
      get(key) { calls.push(["get", key]); return globals.get(key); },
    },
    runPython(code) {
      const request = {
        source: globals.get("_fp_source"),
        kind: globals.get("_fp_kind"),
        pageSize: globals.get("_fp_page_size"),
        sceneNumbers: globals.get("_fp_scene_numbers"),
        sceneNumberFormat: globals.get("_fp_scene_number_format"),
      };
      calls.push(["compile", request]);
      assert.equal(code, "_fp_compile(_fp_source, _fp_kind, _fp_page_size, _fp_scene_numbers, _fp_scene_number_format)");
      return compile(request, globals);
    },
  };
  return { runtime, calls, globals };
}

test("local compiler snapshots source and every export setting before deferred runtime loading", async () => {
  const loading = deferred();
  const { runtime, calls } = fakeRuntime();
  const compile = createLocalCompiler(() => loading.promise);
  const input = {
    source: "Original screenplay",
    pageSize: "a4",
    sceneNumbers: "inline",
    sceneNumberFormat: "act",
  };
  const resultPromise = compile("pdf", input);
  Object.assign(input, { source: "Edited while loading", pageSize: "letter", sceneNumbers: "off", sceneNumberFormat: "sequential" });
  assert.deepEqual(calls, []);
  loading.resolve(runtime);
  const result = await resultPromise;
  assert.deepEqual(result.request, {
    source: "Original screenplay", pageSize: "a4", sceneNumbers: "inline", sceneNumberFormat: "act",
  });
  assert.deepEqual(calls.find(([type]) => type === "compile")[1], { ...result.request, kind: "pdf" });
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.request));
  assert.throws(() => { result.request.source = "Mutable result"; }, TypeError);
});

test("local compiler snapshots string conversion and supplies stable setting defaults", async () => {
  const loading = deferred();
  let source = "First";
  const { runtime } = fakeRuntime();
  const compile = createLocalCompiler(() => loading.promise);
  const pending = compile("fdx", { source: { toString: () => source } });
  source = "Second";
  loading.resolve(runtime);
  const result = await pending;
  assert.deepEqual(result.request, { source: "First", pageSize: "letter", sceneNumbers: "margin", sceneNumberFormat: "sequential" });
});

test("interleaved PDF and FDX jobs capture their own bytes, page counts and metrics before globals change", async () => {
  const loading = deferred();
  // Model a runtime whose next job reuses both scratch globals and byte memory.
  const scratch = new Uint8Array(256);
  const snapshots = new Map();
  const { runtime, calls, globals } = fakeRuntime((request, values) => {
    scratch.fill(0);
    const content = request.kind === "pdf"
      ? "%PDF-1.7\n/Type /Pages\n/Type /Page\n/Type /Page\n/Type /Page\nPDF screenplay"
      : "<?xml version='1.0'?><FinalDraft>FDX screenplay</FinalDraft>";
    scratch.set(encode(content));
    snapshots.set(request.kind, scratch.slice());
    values.set("_fp_last_page_eighths", request.kind === "pdf" ? 5 : 0);
    values.set("_fp_title_page_count", request.kind === "pdf" ? 1 : 0);
    return scratch;
  });
  const compile = createLocalCompiler(() => loading.promise);
  const pendingPdf = compile("pdf", { source: "PDF screenplay", pageSize: "a4" });
  const pendingFdx = compile("fdx", { source: "FDX screenplay", sceneNumbers: "off" });
  loading.resolve(runtime);
  const [pdf, fdx] = await Promise.all([pendingPdf, pendingFdx]);
  assert.equal(globals.get("_fp_source"), "FDX screenplay", "the runtime has advanced to another job");
  assert.deepEqual(new Uint8Array(await pdf.blob.arrayBuffer()), snapshots.get("pdf"));
  assert.deepEqual(new Uint8Array(await fdx.blob.arrayBuffer()), snapshots.get("fdx"));
  assert.equal(pdf.blob.type, "application/pdf");
  assert.equal(fdx.blob.type, "application/xml;charset=utf-8");
  assert.equal(pdf.pageCount, 2, "subtract title pages without counting the /Pages container");
  assert.equal(pdf.lastPageEighths, 5);
  assert.equal(fdx.pageCount, 0);
  assert.equal(fdx.lastPageEighths, 0);
  assert.deepEqual(calls.filter(([type]) => type === "compile").map(([, request]) => request), [
    { source: "PDF screenplay", kind: "pdf", pageSize: "a4", sceneNumbers: "margin", sceneNumberFormat: "sequential" },
    { source: "FDX screenplay", kind: "fdx", pageSize: "letter", sceneNumbers: "off", sceneNumberFormat: "sequential" },
  ]);
});

test("two compiler instances keep their runtimes and job results independent", async () => {
  const firstLoading = deferred();
  const secondLoading = deferred();
  const first = fakeRuntime((_request, globals) => {
    globals.set("_fp_last_page_eighths", 3);
    globals.set("_fp_title_page_count", 0);
    return encode("/Type /Page\nFirst tab");
  });
  const second = fakeRuntime((_request, globals) => {
    globals.set("_fp_last_page_eighths", 7);
    globals.set("_fp_title_page_count", 1);
    return encode("/Type /Page\n/Type /Page\n/Type /Page\nSecond tab");
  });
  const firstCompile = createLocalCompiler(() => firstLoading.promise);
  const secondCompile = createLocalCompiler(() => secondLoading.promise);
  const firstPending = firstCompile("pdf", { source: "First tab source" });
  const secondPending = secondCompile("pdf", { source: "Second tab source" });
  secondLoading.resolve(second.runtime);
  const secondResult = await secondPending;
  assert.deepEqual(first.calls, [], "loading one tab does not execute the other tab's job");
  firstLoading.resolve(first.runtime);
  const firstResult = await firstPending;
  assert.equal(first.globals.get("_fp_source"), "First tab source");
  assert.equal(second.globals.get("_fp_source"), "Second tab source");
  assert.equal(firstResult.pageCount, 1);
  assert.equal(firstResult.lastPageEighths, 3);
  assert.equal(secondResult.pageCount, 2);
  assert.equal(secondResult.lastPageEighths, 7);
  assert.equal(await firstResult.blob.text(), "/Type /Page\nFirst tab");
  assert.equal(await secondResult.blob.text(), "/Type /Page\n/Type /Page\n/Type /Page\nSecond tab");
});

test("a cancelled job before loading does not request a runtime", async () => {
  let loads = 0;
  const compile = createLocalCompiler(() => { loads += 1; throw new Error("must not load"); });
  assert.equal(await compile("pdf", { source: "Cancelled" }, { isCurrent: () => false }), null);
  assert.equal(loads, 0);
});

test("a job invalidated during loading leaves Python and runtime scratch globals untouched", async () => {
  const loading = deferred();
  const { runtime, calls } = fakeRuntime();
  let current = true;
  const compile = createLocalCompiler(() => loading.promise);
  const pending = compile("pdf", { source: "Old revision" }, { isCurrent: () => current });
  current = false;
  loading.resolve(runtime);
  assert.equal(await pending, null);
  assert.deepEqual(calls, []);
});

test("a runtime-loading failure propagates unchanged and a later compile can retry", async () => {
  const failure = new Error("WASM runtime unavailable");
  const { runtime } = fakeRuntime();
  let loads = 0;
  const compile = createLocalCompiler(async () => {
    loads += 1;
    if (loads === 1) throw failure;
    return runtime;
  });
  await assert.rejects(compile("pdf", { source: "First attempt" }), (error) => error === failure);
  const result = await compile("pdf", { source: "Retry" });
  assert.equal(result.pageCount, 1);
  assert.equal(result.request.source, "Retry");
  assert.equal(loads, 2);
});

test("Python compilation errors propagate without poisoning subsequent jobs", async () => {
  const failure = new Error("Screenplay syntax error");
  const { runtime } = fakeRuntime((request) => {
    if (request.source === "Bad") throw failure;
    return encode("/Type /Page\nRecovered");
  });
  const compile = createLocalCompiler(async () => runtime);
  await assert.rejects(compile("pdf", { source: "Bad" }), (error) => error === failure);
  assert.equal(await (await compile("pdf", { source: "Good" })).blob.text(), "/Type /Page\nRecovered");
});

test("successful PyProxy conversion releases the proxy and retains the converted bytes", async () => {
  const bytes = encode("/Type /Page\nProxy bytes");
  let converted = 0;
  let destroyed = 0;
  const { runtime } = fakeRuntime(() => ({
    toJs() { converted += 1; return bytes; },
    destroy() { destroyed += 1; bytes.fill(0); },
  }));
  const result = await createLocalCompiler(async () => runtime)("pdf", { source: "Proxy screenplay" });
  assert.equal(converted, 1);
  assert.equal(destroyed, 1);
  assert.equal(await result.blob.text(), "/Type /Page\nProxy bytes", "the Blob owns a snapshot before proxy destruction");
});

test("failed PyProxy conversion still destroys the proxy exactly once", async () => {
  const failure = new Error("Cannot convert Python bytes");
  let destroyed = 0;
  const { runtime } = fakeRuntime(() => ({
    toJs() { throw failure; },
    destroy() { destroyed += 1; },
  }));
  await assert.rejects(createLocalCompiler(async () => runtime)("fdx", { source: "Proxy failure" }), (error) => error === failure);
  assert.equal(destroyed, 1);
});

test("metric-capture failure also releases a converted PyProxy", async () => {
  const failure = new Error("Runtime metrics unavailable");
  let destroyed = 0;
  const { runtime } = fakeRuntime(() => ({
    toJs: () => encode("/Type /Page"),
    destroy() { destroyed += 1; },
  }));
  runtime.globals.get = () => { throw failure; };
  await assert.rejects(createLocalCompiler(async () => runtime)("pdf", { source: "Metrics failure" }), (error) => error === failure);
  assert.equal(destroyed, 1);
});

test("unsupported kinds fail before loading a runtime or reading input fields", async () => {
  let loads = 0;
  const compile = createLocalCompiler(() => { loads += 1; throw new Error("must not load"); });
  const input = { get source() { throw new Error("must not inspect input"); } };
  for (const kind of ["html", "txt", "PDF", "", null]) {
    await assert.rejects(compile(kind, input), /Unsupported export kind:/);
  }
  assert.equal(loads, 0);
});

test("missing metrics default to zero and title-page subtraction cannot create negative page counts", async () => {
  const noMetrics = fakeRuntime(() => encode("No PDF pages"));
  const empty = await createLocalCompiler(async () => noMetrics.runtime)("pdf", { source: "Empty" });
  assert.equal(empty.pageCount, 0);
  assert.equal(empty.lastPageEighths, 0);
  const tooManyTitlePages = fakeRuntime((_request, globals) => {
    globals.set("_fp_title_page_count", 2);
    globals.set("_fp_last_page_eighths", "5");
    return encode("/Type /Page");
  });
  const titleOnly = await createLocalCompiler(async () => tooManyTitlePages.runtime)("pdf", { source: "Title" });
  assert.equal(titleOnly.pageCount, 0);
  assert.equal(titleOnly.lastPageEighths, 5);
});
