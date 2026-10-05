import { sequenceDiff } from "./versionDiff";

export type ReviewPart =
  | { text: string }
  | { id: number; older: string; current: string; details?: boolean };
export type ReviewChoice = "older" | "current";
function splitDetails(source: string) {
  const match =
    /\n\n(?:\/\*\nFOUNTAIN-PUBLISHER v1\n([^]*?)\n\*\/|<!-- WriteShape metadata\n([^]*?)\n-->)\n?$/.exec(
      source,
    );
  if (match) {
    try {
      const data = JSON.parse(match[1] || match[2]);
      if (data.version === 1 && data.metadata && Array.isArray(data.blocks))
        return {
          body: source.slice(0, match.index),
          suffix: match[0],
          metadata: JSON.stringify(data.metadata),
        };
    } catch {
      /* Unrecognized comments remain ordinary, reviewable text. */
    }
  }
  return { body: source, suffix: "", metadata: "" };
}
/** A lossless text comparison. App bookkeeping stays intact as one document-details choice. */
export function reviewDiff(older: string, current: string) {
  const a = splitDetails(older),
    b = splitDetails(current);
  const parts: ReviewPart[] = [];
  let id = 0;
  const append = (edits: ReturnType<typeof sequenceDiff<string>>) => {
    for (let i = 0; i < edits.length;) {
      if (!edits[i].change) {
        const text = edits[i++].value;
        const last = parts.at(-1);
        if (last && "text" in last) last.text += text;
        else parts.push({ text });
      } else {
        let removed = "",
          added = "";
        while (i < edits.length && edits[i].change) {
          const edit = edits[i++];
          if (edit.change === "removed") removed += edit.value;
          else added += edit.value;
        }
        parts.push({ id: id++, older: removed, current: added });
      }
    }
  };
  const lines = sequenceDiff(
    a.body.match(/[^\n]*\n|[^\n]+$/g) || [],
    b.body.match(/[^\n]*\n|[^\n]+$/g) || [],
    (x, y) => x === y,
  );
  for (let i = 0; i < lines.length;) {
    if (!lines[i].change) {
      append([lines[i++]]);
      continue;
    }
    let left = "",
      right = "";
    while (i < lines.length && lines[i].change) {
      const line = lines[i++];
      if (line.change === "removed") left += line.value;
      else right += line.value;
    }
    append(
      sequenceDiff(
        left.match(/\s+|[^\s]+/gu) || [],
        right.match(/\s+|[^\s]+/gu) || [],
        (x, y) => x === y,
      ),
    );
  }
  if (a.metadata !== b.metadata)
    parts.push({ id: id++, older: a.suffix, current: b.suffix, details: true });
  return {
    parts,
    suffix: a.metadata === b.metadata ? b.suffix : "",
    count: id,
  };
}
export function resolveReview(
  review: ReturnType<typeof reviewDiff>,
  choices: Record<number, ReviewChoice>,
) {
  return (
    review.parts
      .map((part) => {
        if ("text" in part) return part.text;
        if (!choices[part.id])
          throw new Error(
            "Choose which version to keep for every change before saving.",
          );
        return part[choices[part.id]];
      })
      .join("") + review.suffix
  );
}
