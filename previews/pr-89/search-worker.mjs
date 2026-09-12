import { parseEx, runEx, runSearch } from "./search-engine.mjs";

export function handleSearchTask(task, payload) {
  if (task === "search") return runSearch(payload);
  if (task === "ex") return runEx(payload);
  if (task === "parse-ex") return parseEx(payload.command, payload);
  throw new Error(`Unknown search task: ${task}`);
}

if (typeof self !== "undefined" && typeof self.document === "undefined") {
  self.addEventListener("message", ({ data }) => {
    if (!Number.isSafeInteger(data?.id)) return;
    try { self.postMessage({ id: data.id, result: handleSearchTask(data.task, data.payload) }); }
    catch (error) { self.postMessage({ id: data.id, error: error instanceof Error ? error.message : String(error) }); }
  });
  self.postMessage({ type: "ready" });
}
