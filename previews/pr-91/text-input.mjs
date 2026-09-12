// Text offsets throughout the editor are UTF-16 offsets, like DOM Range and
// textarea selection. A deletion must nevertheless remove a complete grapheme.
const graphemes = typeof Intl.Segmenter === "function" ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;
const words = typeof Intl.Segmenter === "function" ? new Intl.Segmenter(undefined, { granularity: "word" }) : null;

export function graphemeBoundaries(value) {
  if (graphemes) return [...graphemes.segment(value)].map(({ index }) => index).concat(value.length);
  // Older engines: preserve code points, combining marks, emoji modifiers,
  // joiner sequences and paired regional indicators even without Segmenter.
  const boundaries = [0];
  let offset = 0;
  let previous = "";
  let regionalCount = 0;
  for (const point of value) {
    const regional = /\p{Regional_Indicator}/u.test(point);
    const joined = /[\p{Mark}\p{Emoji_Modifier}\uFE0E\uFE0F\u200D]/u.test(point)
      || previous === "\u200D" || (previous === "\r" && point === "\n")
      || (regional && regionalCount % 2 === 1);
    if (offset && !joined) boundaries.push(offset);
    offset += point.length;
    regionalCount = regional ? regionalCount + 1 : 0;
    previous = point;
  }
  if (offset) boundaries.push(offset);
  return boundaries;
}

export function previousGraphemeBoundary(value, offset) {
  const position = Math.max(0, Math.min(value.length, offset));
  const boundaries = graphemeBoundaries(value);
  return boundaries.findLast((boundary) => boundary < position) ?? 0;
}

export function nextGraphemeBoundary(value, offset) {
  const position = Math.max(0, Math.min(value.length, offset));
  return graphemeBoundaries(value).find((boundary) => boundary > position) ?? value.length;
}

export function textDifference(before, after) {
  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start += 1;
  let oldEnd = before.length;
  let newEnd = after.length;
  while (oldEnd > start && newEnd > start && before[oldEnd - 1] === after[newEnd - 1]) { oldEnd -= 1; newEnd -= 1; }
  const oldBoundaries = new Set(graphemeBoundaries(before));
  const newBoundaries = new Set(graphemeBoundaries(after));
  while (start && (!oldBoundaries.has(start) || !newBoundaries.has(start))) start -= 1;
  while ((!oldBoundaries.has(oldEnd) || !newBoundaries.has(newEnd)) && oldEnd < before.length && newEnd < after.length) {
    oldEnd += 1;
    newEnd += 1;
  }
  return { start, oldEnd, newEnd };
}

function wordBoundary(value, offset, forward) {
  const segments = words ? [...words.segment(value)] : [...value.matchAll(/\s+|[^\s]+/gu)].map((match) => ({ index: match.index, segment: match[0] }));
  if (forward) {
    let position = offset;
    while (position < value.length && /\s/u.test(value[position])) position += 1;
    const next = segments.find(({ index, segment }) => index + segment.length > position);
    return next ? next.index + next.segment.length : value.length;
  }
  let position = offset;
  while (position > 0 && /\s/u.test(value[position - 1])) position -= 1;
  return segments.findLast(({ index }) => index < position)?.index ?? 0;
}

// The caller supplies visual-line bounds for soft line deletion (from the
// browser's beforeinput target range, or measured wrapped-line rectangles).
export function deletionRange(value, offset, inputType, visualLine = null) {
  const position = Math.max(0, Math.min(value.length, offset));
  if (inputType === "deleteEntireSoftLine") return { start: visualLine?.start ?? 0, end: visualLine?.end ?? value.length };
  const forward = inputType.endsWith("Forward");
  let boundary;
  if (inputType.includes("Word")) boundary = wordBoundary(value, position, forward);
  else if (inputType.includes("SoftLine")) boundary = forward ? (visualLine?.end ?? value.length) : (visualLine?.start ?? 0);
  else if (inputType.includes("HardLine")) boundary = forward ? value.length : 0;
  else boundary = forward ? nextGraphemeBoundary(value, position) : previousGraphemeBoundary(value, position);
  // At an unexpected DOM offset inside a grapheme, remove the whole grapheme,
  // not the tail/head that happens to be on one side of the caret.
  const boundaries = graphemeBoundaries(value);
  const start = Math.min(position, boundary);
  const end = Math.max(position, boundary);
  return {
    start: boundaries.findLast((point) => point <= start) ?? 0,
    end: boundaries.find((point) => point >= end) ?? value.length,
  };
}

export function nativeHistoryAction(inputType) {
  return inputType === "historyUndo" ? "undo" : inputType === "historyRedo" ? "redo" : null;
}
