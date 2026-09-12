import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { parseFountainInline } from "../../src/fountain_publisher/web/fountain-inline.mjs";

const app = await readFile(new URL("../../src/fountain_publisher/web/app.mjs", import.meta.url), "utf8");
const code = app.slice(app.indexOf("function escapeHtml("), app.indexOf("function alignAnnotationOrbs("));

// Frozen pre-optimization renderer: compare complete generated markup, not just
// visible text. This guards caret maps, annotation orbs and hidden source IDs.
function legacyPreviewLineHtml(line, sceneLabel = null, annotation = null) {
  const centered = line.raw.trim().match(/^>\s*(.*?)\s*<$/);
  const act = line.type === "section" ? line.raw.trim().match(/^#\s+(Act\b.*)$/i) : null;
  const type = centered ? "centered" : line.type;
  const className = `script-line ${type}${act ? " act" : ""}`;
  let display = act?.[1] || line.display;
  const prefix = act ? "#" : line.prefix;
  if (centered) display = centered[1];
  else if (type === "transition" && line.raw.trim().startsWith(">")) display = line.raw.trim().slice(1).trimStart();
  if (type === "scene") {
    const cleanDisplay = line.display.replace(/^\./, "").replace(/\s+#[^#]+#\s*$/, "");
    display = sceneLabel !== null && docSettings.sceneNumbers === "inline" ? `${sceneLabel}. ${cleanDisplay}` : cleanDisplay;
  }
  const note = type === "note" ? managedNote(line.raw) : null;
  const content = display ? fountainInlineHtml(display) : "<br>";
  const sceneAttr = sceneLabel !== null ? escapeHtml(sceneLabel) : "";
  if (type === "note" && !note) return "";
  if (type === "note" && note) return `<div class="script-line note managed-note" data-line="${line.index}"></div>`;
  const orb = annotation
    ? `<button class="annotation-orb" type="button" data-annotation-line="${annotation.index}" title="${escapeHtml(annotation.text)}" aria-label="Edit annotation: ${escapeHtml(annotation.text)}"></button>`
    : "";
  const spellcheckAttr = type === "character" ? ` spellcheck="false" autocorrect="off" autocomplete="off"` : "";
  return `<div class="${className}" data-line="${line.index}" data-type="${escapeHtml(type)}" data-prefix="${escapeHtml(prefix)}" data-scene-number="${sceneAttr}" data-display="${escapeHtml(parseFountainInline(display).text)}"${spellcheckAttr}>${content}${orb}</div>`;
}

function harness() {
  const calls = [];
  const context = {
    parseFountainInline(value) { calls.push(value); return parseFountainInline(value); },
    docSettings: { sceneNumbers: "margin", sceneNumberFormat: "sequential" }, state: { metadata: {} },
  };
  runInNewContext(`${app.match(/^const TITLE_KEYS = .+;$/m)[0]}\n${app.match(/^const MANAGED_NOTE_RE = .+;$/m)[0]}\n${code}\n${legacyPreviewLineHtml.toString()}`, context);
  return { context, calls };
}

const screenplay = [
  "Title: **A title**", "Credit: Written by", "Author: Élodie", "    _A subtitle_", "",
  "# Act One", "## Sequence", "= A synopsis", "", "  . INT. ROOM - DAY #12#", "",
  "!**Bright _blue_** light & <literal> words.", "[[Annotation with \"quotes\" & markup]]", "",
  "@ÉLODIE (V.O.)", "(quietly)", "A _line_ of dialogue with 👩‍💻 and café.", "",
  "MAYA ^", "Concurrent **dialogue**.", "", ">  DISSOLVE TO:", ">**END**<", "~Lyrics", "===", "",
  "/*", "Hidden **prose**", "*/", "",
  "[[FP-GENERAL:General%20note]]", "[[FP-CHARACTER:MAYA:Character%20note]]",
  "[[FP-BEATS:%7B%22premise%22%3A%22Story%22%2C%22beats%22%3A%5B%22Beat%22%5D%7D]]",
  "[[FP-BEATS:invalid-json]]", "",
].join("\n");

test("optimized Preview line markup exactly matches the original across element types and scene settings", () => {
  const h = harness();
  const lines = h.context.classifyLines(screenplay);
  for (const sceneNumbers of ["off", "margin", "inline"]) {
    h.context.docSettings.sceneNumbers = sceneNumbers;
    for (const line of lines) {
      for (const annotation of [null, { index: line.index + 1, text: 'Annotation <tag> & "quotes"' }]) {
        const sceneLabel = line.type === "scene" ? "A1S12" : null;
        assert.equal(h.context.previewLineHtml(line, sceneLabel, annotation),
          h.context.legacyPreviewLineHtml(line, sceneLabel, annotation), `${sceneNumbers}: ${line.raw}`);
      }
    }
  }
});

test("each visible line parses inline markup once for both HTML and caret display metadata", () => {
  const h = harness();
  for (const line of h.context.classifyLines(screenplay)) {
    h.calls.length = 0;
    h.context.previewLineHtml(line);
    assert.equal(h.calls.length, line.type === "note" ? 0 : 1, line.raw);
  }
});

test("large managed notes retain empty source anchors without any inline parsing of encoded payloads", () => {
  const h = harness();
  const payload = encodeURIComponent("A long note with **emphasis**, symbols & Unicode 👩‍💻. ".repeat(250));
  const source = Array.from({ length: 100 }, (_, index) => `[[FP-GENERAL:${index}%20${payload}]]`).join("\n");
  const lines = h.context.classifyLines(source);
  const markup = h.context.renderPreviewLines(lines);
  assert.equal(h.calls.length, 0);
  assert.equal((markup.match(/class="script-line note managed-note"/g) || []).length, 100);
  for (let index = 0; index < 100; index += 1) assert.ok(markup.includes(`data-line="${index}"`));
  assert.ok(markup.length < 10_000, "encoded content never leaks into the hidden anchor markup");
});

test("whole-document title pages, dual dialogue, annotations and scene labels keep identical HTML", () => {
  const h = harness();
  const lines = h.context.classifyLines(screenplay);
  const optimized = h.context.previewLineHtml;
  for (const sceneNumbers of ["off", "margin", "inline"]) for (const sceneNumberFormat of ["sequential", "act"]) {
    Object.assign(h.context.docSettings, { sceneNumbers, sceneNumberFormat });
    h.context.previewLineHtml = h.context.legacyPreviewLineHtml;
    const expected = h.context.renderPreviewLines(lines);
    h.context.previewLineHtml = optimized;
    assert.equal(h.context.renderPreviewLines(lines), expected);
  }
});
