import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { parseFountainInline, replaceFountainRange } from "../../src/fountain_publisher/web/fountain-inline.mjs";

const app = await readFile(new URL("../../src/fountain_publisher/web/app.mjs", import.meta.url), "utf8");
function functions(start, end) {
  return app.slice(app.indexOf(`function ${start}(`), app.indexOf(`function ${end}(`));
}
const sandbox = {
  parseFountainInline,
  TITLE_KEYS: new Set(["title", "author", "credit", "draft date"]),
  docSettings: { sceneNumbers: "off" },
};
runInNewContext([
  functions("escapeHtml", "decodeNotePart"),
  functions("isScene", "analyzeLocally"),
  functions("previewLineHtml", "annotationAfter"),
  functions("fountainInlineSourceMap", "previewTextOffset"),
].join("\n"), sandbox);

const decode = (value) => value.replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&amp;", "&");
function renderedLine(document, index, numbering = "off") {
  sandbox.docSettings.sceneNumbers = numbering;
  const line = sandbox.classifyLines(document)[index];
  const label = numbering !== "off" && line.type === "scene" ? "7" : null;
  const html = sandbox.previewLineHtml(line, label);
  const attribute = (name) => decode(html.match(new RegExp(`${name}="([^"]*)"`))?.[1] || "");
  const classes = new Set(attribute("class").split(" "));
  const element = {
    dataset: { prefix: attribute("data-prefix"), sceneNumber: attribute("data-scene-number") },
    classList: { contains: (name) => classes.has(name) },
  };
  return { line, element, visible: attribute("data-display"), html };
}

test("forced elements override an unfinished dialogue block and reset following prose", () => {
  for (const [forced, type, display] of [
    ["!A door slams.", "action", "A door slams."],
    ["  !A door slams.", "action", "A door slams."],
    ["> DISSOLVE TO:", "transition", "DISSOLVE TO:"],
    ["> **END** <", "centered", "**END**"],
    [".somewhere else", "scene", "somewhere else"],
    ["~A lyric", "lyric", "A lyric"],
  ]) {
    const lines = sandbox.classifyLines(`ALICE\nHello.\n${forced}\nOrdinary action.`);
    assert.equal(lines[2].type, type, forced);
    assert.equal(lines[2].display, display, forced);
    assert.equal(lines[3].type, "action", forced);
  }
  assert.equal(sandbox.classifyLines("ALICE\nI HAVE TO:")[1].type, "dialogue", "unforced speech is not promoted to a transition");
});

test("explicit character cues bypass completion heuristics; implicit cues keep their escape hatch", () => {
  for (const name of ["someone with an unusually long character name and extension", "person TO:", "INT. NOT A SCENE"]) {
    const line = sandbox.classifyLines(`@${name}\nHello.`)[0];
    assert.equal(line.type, "character");
    assert.equal(line.display, name);
  }
  assert.equal(sandbox.classifyLines("ALICE  \nAn action.")[0].type, "action", "two trailing spaces force uppercase prose to remain action, matching export");
  assert.equal(sandbox.classifyLines("@\nAn action.")[0].type, "action", "a bare marker is not an empty character name");
  assert.equal(sandbox.classifyLines("...a pause.")[0].type, "action", "ellipsis is not a forced scene prefix");
});

const lineFixtures = [
  ["  !**Forced** action.  ", 0, "Forced action.  "],
  ["  @ Bob (V.O.) ^  \nReply.", 0, "Bob (V.O.)"],
  ["  ALICE\nHello.", 0, "ALICE"],
  ["ALICE\nHello.\n\nBOB ^\nReply.", 3, "BOB"],
  ["  >   **Centered** words  <  ", 0, "Centered words"],
  ["\t>\tDISSOLVE TO:\t", 0, "DISSOLVE TO:"],
  ["  FADE TO:", 0, "FADE TO:"],
  ["Title:\t  **A title**  ", 0, "A title"],
  ["Title: A title\n    _A subtitle_  ", 1, "A subtitle"],
  ["  # Act One  ", 0, "Act One"],
  ["  ~ **A lyric**  ", 0, " A lyric  "],
  ["  .  INT. ROOM - DAY   #12#  ", 0, "INT. ROOM - DAY"],
  ["  INT. ROOM - DAY #12#  ", 0, "INT. ROOM - DAY"],
];

for (const [document, index, expected] of lineFixtures) {
  test(`visible/source roundtrip preserves hidden line markers in ${JSON.stringify(document)}`, () => {
    for (const numbering of ["off", "margin", "inline"]) {
      const { line, element, visible } = renderedLine(document, index, numbering);
      const prefix = line.type === "scene" && numbering === "inline" ? "7. " : "";
      assert.equal(visible, prefix + expected);
      const body = sandbox.previewSourceBody(element, line.raw);
      assert.equal(parseFountainInline(line.raw.slice(body.start, body.end)).text, expected);
      assert.equal(document.split("\n")[index], line.raw, "classification does not rewrite source");
      for (let offset = 0; offset <= expected.length; offset += 1) {
        const position = sandbox.previewSourceOffset(element, line.raw, prefix.length + offset);
        assert.equal(body.map.toDisplay(position - body.start), offset, "the reverse map points at the same visible caret");
        const result = replaceFountainRange(line.raw, position, position, "X");
        assert.equal(result.source.slice(0, body.start), line.raw.slice(0, body.start), "prefix is untouched by typing");
        assert.equal(result.source.slice(body.end + 1), line.raw.slice(body.end), "suffix is untouched by typing");
        assert.equal(parseFountainInline(result.source.slice(body.start, body.end + 1)).text,
          expected.slice(0, offset) + "X" + expected.slice(offset), "typing targets exactly the displayed range");
      }
    }
  });
}
