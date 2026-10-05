import type { ScriptBlock, TextSpan } from "./model";
/** Inline storage keeps a note and its reference together through editing, undo and collaboration. */
export const footnotePattern = () => /\^\[((?:\\.|[^\]\\])*)\]/g;
export const encodeFootnote = (text: string) =>
  `^[${text.trim().replace(/\\/g, "\\\\").replace(/\]/g, "\\]").replace(/\n/g, " ")}]`;
export const decodeFootnote = (text: string) => text.replace(/\\(.)/g, "$1");
export type FootnoteRun = TextSpan & {
  note?: { number: number; text: string };
};
export function footnoteRuns(
  block: ScriptBlock,
  counter = { value: 0 },
): FootnoteRun[] {
  const source =
    block.spans?.map((s) => s.text).join("") === block.text
      ? block.spans!
      : [{ text: block.text }];
  const result: FootnoteRun[] = [];
  const slice = (from: number, to: number) => {
    let offset = 0;
    for (const span of source) {
      const start = Math.max(from, offset),
        end = Math.min(to, offset + span.text.length);
      if (end > start)
        result.push({
          ...span,
          text: span.text.slice(start - offset, end - offset),
        });
      offset += span.text.length;
    }
  };
  let end = 0;
  for (const match of block.text.matchAll(footnotePattern())) {
    slice(end, match.index!);
    const number = ++counter.value;
    result.push({
      text: String(number),
      note: { number, text: decodeFootnote(match[1]) },
    });
    end = match.index! + match[0].length;
  }
  slice(end, block.text.length);
  return result;
}
