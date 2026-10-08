import { createNovel } from "../../src/core/markdown";
import { encodeFootnote } from "../../src/core/footnotes";
import type { ScriptBlock, TextSpan } from "../../src/core/model";

/** Synthetic manuscript shared by export regressions and reader acceptance. */
export function bookExportFixture() {
  const doc = createNovel();
  doc.titlePage.title = "The Tide Ledger & Other Stories";
  doc.titlePage.author = "Alex Morgan";
  doc.titlePage.extra = { Dedication: "For the keepers of small lights." };
  doc.blocks = [];
  const add = (
    kind: ScriptBlock["kind"],
    spans: TextSpan[],
    level?: number,
  ) => {
    doc.blocks.push({
      id: `fixture-${doc.blocks.length}`,
      kind,
      level,
      text: spans.map((s) => s.text).join(""),
      spans,
    });
  };
  const paragraph =
    "Mara carried the tide ledger across the harbor before sunrise. The names on its pages belonged to people who had kept the lamps burning through winter. She checked each entry against the brass clock, then set the book beside a cup of tea. Outside, a gull called over the empty street. Inside, the silence gave her enough time to decide what she would tell the keeper when he returned. ";
  let note = 0;
  for (let chapter = 1; chapter <= 3; chapter++) {
    if (chapter !== 2)
      add("section", [{ text: `Book ${chapter === 1 ? 1 : 2}` }], 1);
    add(
      "section",
      [
        {
          text: `Chapter ${chapter} — ${["The Harbor", "The Letter", "The Return"][chapter - 1]}`,
        },
      ],
      2,
    );
    add("centered", [{ text: "Keep a light for those who arrive late." }]);
    add("parenthetical", [{ text: "— The keeper’s ledger" }]);
    for (let p = 1; p <= 7; p++) {
      const runs: TextSpan[] = [
        { text: `C${chapter}P${p} START. ${paragraph}` },
      ];
      if (p <= 4) {
        note++;
        const detail =
          note === 6
            ? "LONG NOTE START. " +
              "The original ledger records the tide, the weather, and the name of the keeper on duty. ".repeat(
                75,
              ) +
              "LONG NOTE END."
            : `NOTE ${note} START. The ledger’s café entry costs €3; braces { } and a backslash \\ remain literal. NOTE ${note} END.`;
        runs.push({ text: encodeFootnote(detail) });
      }
      runs.push(
        { text: " Bold words", marks: ["bold"] },
        { text: " italic words", marks: ["italic"] },
        { text: " combined words", marks: ["bold", "italic"] },
        { text: " underlined words", marks: ["underline"] },
        { text: `. ${paragraph}C${chapter}P${p} END.` },
      );
      add("action", runs);
    }
    add("dialogue", [
      { text: "The keeper wrote:\nFirst keep the light. Then open the door." },
    ]);
    add("section", [{ text: `A pause in chapter ${chapter}` }], 3);
    add("pageBreak", [{ text: "" }]);
  }
  add("action", [
    { text: "MANUSCRIPT FINAL WORDS. Mara closed the ledger and went home." },
  ]);
  doc.metadata.bookmarks = [
    {
      id: "private-bookmark",
      name: "Review the letter",
      color: "#c84b76",
      blockId: "fixture-14",
      offset: 0,
    },
  ];
  return doc;
}
