// Deterministic CPU baseline, not a browser typing/layout benchmark. Run the
// same Node version/machine before and after changes when comparing results.
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { performance } from "node:perf_hooks";
import { parseFountainInline } from "../src/fountain_publisher/web/fountain-inline.mjs";

const app = await readFile(new URL("../src/fountain_publisher/web/app.mjs", import.meta.url), "utf8");
const context = {
  parseFountainInline,
  TITLE_KEYS: new Set(["title", "credit", "author", "draft date"]),
  MANAGED_NOTE_RE: /^\[\[FP-(GENERAL|CHARACTER|BEATS):(.+)\]\]$/,
  docSettings: { sceneNumbers: "margin", sceneNumberFormat: "sequential" },
  state: { metadata: {} },
};
// Transitional harness: these helpers still live in app.mjs; import them
// directly once the full Fountain block model is extracted.
runInNewContext(app.slice(app.indexOf("function escapeHtml("), app.indexOf("function alignAnnotationOrbs(")), context);

function measure(operation) {
  operation();
  const durations = Array.from({ length: 7 }, () => {
    const start = performance.now(); operation(); return performance.now() - start;
  }).sort((a, b) => a - b);
  return { medianMs: Number(durations[3].toFixed(2)), maxMs: Number(durations[6].toFixed(2)) };
}

const results = [150, 600].map(scenes => {
  const text = "Title: Reliability baseline\n\n" + Array.from({ length: scenes }, (_, index) =>
    `INT. ROOM ${index} - DAY\n\nA **bright _blue_ light** crosses the room. A writer types café and 👩‍💻.\n\nMAYA\nThe line continues with enough dialogue to represent a full sentence.\n\n!Ordinary action resumes.\n\n`).join("");
  const classified = context.classifyLines(text);
  return {
    scenes, utf16Length: text.length, lines: classified.length,
    classify: measure(() => context.classifyLines(text)),
    renderHtml: measure(() => context.renderPreviewLines(classified)),
    analyze: measure(() => context.analyzeLocally(text)),
  };
});
console.log(JSON.stringify({ scope: "CPU only; excludes DOM layout, input devices, network and storage", results }, null, 2));
