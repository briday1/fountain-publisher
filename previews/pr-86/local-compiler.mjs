// One compiler per browser tab. Only immutable job inputs cross the asynchronous
// runtime-loading boundary; neither transport nor application state belongs here.
export function createLocalCompiler(loadRuntime) {
  return async function compileLocally(kind, input, { isCurrent = () => true } = {}) {
    if (kind !== "pdf" && kind !== "fdx") throw new Error(`Unsupported export kind: ${kind}`);
    const request = Object.freeze({
      source: String(input.source),
      pageSize: input.pageSize ?? "letter",
      sceneNumbers: input.sceneNumbers ?? "margin",
      sceneNumberFormat: input.sceneNumberFormat ?? "sequential",
    });
    if (!isCurrent()) return null;
    const runtime = await loadRuntime();
    if (!isCurrent()) return null;

    // Keep setters, synchronous Python execution, and result capture together.
    // An await here would let another job overwrite the runtime's scratch globals.
    runtime.globals.set("_fp_source", request.source);
    runtime.globals.set("_fp_kind", kind);
    runtime.globals.set("_fp_page_size", request.pageSize);
    runtime.globals.set("_fp_scene_numbers", request.sceneNumbers);
    runtime.globals.set("_fp_scene_number_format", request.sceneNumberFormat);
    const value = runtime.runPython("_fp_compile(_fp_source, _fp_kind, _fp_page_size, _fp_scene_numbers, _fp_scene_number_format)");
    try {
      const bytes = value instanceof Uint8Array ? value : value.toJs();
      const lastPageEighths = Number(runtime.globals.get("_fp_last_page_eighths")) || 0;
      const titlePages = Number(runtime.globals.get("_fp_title_page_count")) || 0;
      const physicalPages = kind === "pdf"
        ? (new TextDecoder("latin1").decode(bytes).match(/\/Type\s*\/Page\b/g) || []).length
        : 0;
      return Object.freeze({
        request,
        blob: new Blob([bytes], { type: kind === "pdf" ? "application/pdf" : "application/xml;charset=utf-8" }),
        pageCount: Math.max(0, physicalPages - titlePages),
        lastPageEighths,
      });
    } finally {
      value.destroy?.();
    }
  };
}
