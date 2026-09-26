import type { Node } from "prosemirror-model";
const word = /[\p{L}\p{N}]/u;
/** Count new word starts in a text edit. Extending an existing word earns no extra word. */
export function authoredWords(before: Node, after: Node): number {
  const start = before.content.findDiffStart(after.content);
  if (start == null) return 0;
  const end = before.content.findDiffEnd(after.content);
  if (!end) return 0;
  const finish = Math.max(start, end.b),
    oldFinish = Math.max(start, end.a);
  const inserted = after.textBetween(start, finish, "\n", "\n");
  if (
    !inserted ||
    inserted === before.textBetween(start, oldFinish, "\n", "\n")
  )
    return 0;
  const left = after.textBetween(Math.max(0, start - 1), start, "\n", "\n");
  const right = after.textBetween(
    finish,
    Math.min(after.content.size, finish + 1),
    "\n",
    "\n",
  );
  let count = 0;
  const matches = [
    ...inserted.matchAll(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu),
  ];
  for (const match of matches) {
    const begins = match.index === 0 && word.test(left),
      ends =
        match.index + match[0].length === inserted.length && word.test(right);
    if (!begins && !ends) count++;
  }
  return count;
}
