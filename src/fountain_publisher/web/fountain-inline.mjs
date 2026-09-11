// Source is authoritative. Rendering, selections, and editing all consume this
// representation; none of them reconstruct Fountain from generated HTML.
// Offsets are UTF-16, matching textarea selections and DOM text ranges. Input
// adapters, not this format layer, decide grapheme/word deletion boundaries.
const cache = new Map();
let cachedCharacters = 0;
const MAX_CACHED_CHARACTERS = 65_536;
const MAX_CACHED_LINES = 128;
const MARKERS = ["**", "*", "_"];
const TAGS = [["<strong>", "</strong>"], ["<em>", "</em>"], ["<u>", "</u>"]];

function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function parseUncached(source) {
  // 1 = escape prefix, 2 = opening delimiter, 3 = closing delimiter.
  const hidden = new Uint8Array(source.length);
  const openers = [[], [], []];
  const spans = [];
  for (let index = 0; index < source.length;) {
    const character = source[index];
    // Screenplain, the export engine, only supports escaping stars. Do not
    // invent Preview-only underscore/backslash escapes that change on export.
    if (character === "\\" && source[index + 1] === "*") {
      hidden[index] = 1;
      index += 2;
      continue;
    }
    if (character === "\n" || character === "\r") {
      openers.forEach((stack) => { stack.length = 0; });
      index += 1;
      continue;
    }
    if (character !== "*" && character !== "_") { index += 1; continue; }
    let end = index + 1;
    if (character === "*") while (source[end] === "*") end += 1;
    // Whitespace-adjacent delimiters and unmatched markers remain literal.
    const canClose = index > 0 && !/\s/.test(source[index - 1]);
    const canOpen = end < source.length && !/\s/.test(source[end]);
    while (index < end) {
      const candidates = character === "_" ? [2] : end - index >= 2 ? [0, 1] : [1];
      let style = -1;
      if (canClose) {
        for (const candidate of candidates) {
          const opener = openers[candidate].at(-1);
          if (opener !== undefined && opener + MARKERS[candidate].length < index
            && (style < 0 || opener > openers[style].at(-1))) style = candidate;
        }
      }
      if (style >= 0) {
        const openStart = openers[style].pop();
        const size = MARKERS[style].length;
        const span = { marker: MARKERS[style], style, openStart, openEnd: openStart + size, closeStart: index, closeEnd: index + size };
        hidden.fill(2, span.openStart, span.openEnd);
        hidden.fill(3, span.closeStart, span.closeEnd);
        spans.push(span);
        index += size;
      } else {
        style = candidates[0];
        if (canOpen) openers[style].push(index);
        index += MARKERS[style].length;
      }
    }
  }
  spans.sort((left, right) => left.openStart - right.openStart);
  const changes = MARKERS.map(() => new Int32Array(source.length + 1));
  for (const span of spans) {
    changes[span.style][span.openEnd] += 1;
    changes[span.style][span.closeStart] -= 1;
  }
  const counts = [0, 0, 0];
  const starts = [];
  const ends = [];
  const sourceToDisplay = new Uint32Array(source.length + 1);
  const runs = [];
  let text = "";
  let run = null;
  for (let index = 0; index < source.length; index += 1) {
    for (let style = 0; style < counts.length; style += 1) counts[style] += changes[style][index];
    sourceToDisplay[index] = text.length;
    if (hidden[index]) continue;
    const styles = counts.reduce((mask, count, style) => mask | (count > 0 ? 1 << style : 0), 0);
    if (!run || run.styles !== styles) { run = { styles, text: "" }; runs.push(run); }
    run.text += source[index];
    text += source[index];
    starts.push(index > 0 && hidden[index - 1] === 1 ? index - 1 : index);
    ends.push(index + 1);
  }
  sourceToDisplay[source.length] = text.length;
  const startMap = [...starts, ends.at(-1) ?? 0];
  const endMap = [starts[0] ?? 0, ...ends];
  const caretMap = endMap.map((_, offset) => {
    let rawOffset = offset ? ends[offset - 1] : 0;
    const next = offset < starts.length ? starts[offset] : source.length;
    // At the end of styled text, insertion belongs outside its closing markers.
    // At the beginning it belongs before its opening markers. Selection edges
    // instead use startMap/endMap to preserve unselected formatting.
    while (rawOffset < next && hidden[rawOffset] === 3) rawOffset += 1;
    return rawOffset;
  });
  const html = runs.map((part) => {
    let output = escapeHtml(part.text);
    for (let style = TAGS.length - 1; style >= 0; style -= 1) {
      if (part.styles & (1 << style)) output = TAGS[style][0] + output + TAGS[style][1];
    }
    return output;
  }).join("");
  return {
    source, text, html, spans, runs,
    sourceMap: {
      startMap, endMap, caretMap, sourceToDisplay,
      toDisplay(offset) { return sourceToDisplay[Math.max(0, Math.min(source.length, offset))]; },
    },
    activeMarkersAt(offset) {
      const active = spans.filter((span) => offset >= span.openEnd && offset <= span.closeStart);
      const markers = [];
      let previous = null;
      for (const span of active) {
        if (previous && previous.openEnd === span.openStart && previous.closeStart === span.closeEnd) {
          markers[markers.length - 1] += span.marker;
        } else markers.push(span.marker);
        previous = span;
      }
      return markers;
    },
  };
}

export function parseFountainInline(value) {
  const source = String(value);
  if (cache.has(source)) {
    const model = cache.get(source);
    cache.delete(source);
    cache.set(source, model);
    return model;
  }
  const model = parseUncached(source);
  // Bound both the number of retained lines and their total source size. Large
  // pastes are parsed once per call, not retained indefinitely in an editor cache.
  if (source.length <= MAX_CACHED_CHARACTERS) {
    while (cache.size && (cache.size >= MAX_CACHED_LINES || cachedCharacters + source.length > MAX_CACHED_CHARACTERS)) {
      const oldest = cache.keys().next().value;
      cachedCharacters -= oldest.length;
      cache.delete(oldest);
    }
    cache.set(source, model);
    cachedCharacters += source.length;
  }
  return model;
}

function repairWhitespaceEdges(source, pairs, caret) {
  if (!pairs.length) return { source, caret };
  const hidden = new Uint8Array(source.length);
  for (const pair of pairs) {
    hidden.fill(1, pair.open, pair.open + pair.marker.length);
    hidden.fill(1, pair.close, pair.close + pair.marker.length);
  }
  const nextText = new Uint32Array(source.length + 1);
  const previousText = new Int32Array(source.length + 1);
  let previous = -1;
  for (let index = 0; index < source.length; index += 1) {
    previousText[index] = previous;
    if (!hidden[index] && !/\s/.test(source[index])) previous = index;
  }
  previousText[source.length] = previous;
  let next = source.length;
  nextText[source.length] = next;
  for (let index = source.length - 1; index >= 0; index -= 1) {
    if (!hidden[index] && !/\s/.test(source[index])) next = index;
    nextText[index] = next;
  }
  const removed = new Uint8Array(source.length);
  const insertions = new Map();
  const move = (from, to, marker) => {
    removed.fill(1, from, from + marker.length);
    if (to === null) return;
    if (!insertions.has(to)) insertions.set(to, []);
    insertions.get(to).push({ from, marker });
  };
  for (const pair of pairs) {
    if (!pair.affected) continue;
    const first = nextText[pair.open + pair.marker.length];
    const last = previousText[pair.close];
    if (first >= pair.close) {
      move(pair.open, null, pair.marker);
      move(pair.close, null, pair.marker);
    } else {
      if (first > pair.open + pair.marker.length) move(pair.open, first, pair.marker);
      if (last + 1 < pair.close) move(pair.close, last + 1, pair.marker);
    }
  }
  let result = "";
  let nextCaret = caret;
  for (let index = 0; index <= source.length; index += 1) {
    if (index === caret) nextCaret = result.length;
    const inserted = insertions.get(index);
    if (inserted) {
      inserted.sort((left, right) => left.from - right.from);
      result += inserted.map((entry) => entry.marker).join("");
    }
    if (index < source.length && !removed[index]) result += source[index];
  }
  return { source: result, caret: nextCaret };
}

// Apply a visible-selection edit expressed in source coordinates, retaining
// formatting on surviving text. Only affected delimiter pairs are repaired;
// unrelated source bytes, including unusual/literal markup, stay untouched.
export function replaceFountainRange(value, start, end, replacement) {
  const model = parseFountainInline(value);
  const source = model.source;
  start = Math.max(0, Math.min(source.length, start));
  end = Math.max(start, Math.min(source.length, end));
  replacement = String(replacement);
  if (start === end) return { source: source.slice(0, start) + replacement + source.slice(end), caret: start + replacement.length };
  const removals = new Uint8Array(source.length);
  removals.fill(1, start, end);
  const closing = [];
  const opening = [];
  const visibleStart = model.sourceMap.toDisplay(start);
  const visibleEnd = model.sourceMap.toDisplay(end);
  for (const span of model.spans) {
    const removesBody = visibleStart <= model.sourceMap.toDisplay(span.openEnd) && visibleEnd >= model.sourceMap.toDisplay(span.closeStart);
    if (!replacement && removesBody) {
      removals.fill(1, span.openStart, span.openEnd);
      removals.fill(1, span.closeStart, span.closeEnd);
    } else if (span.openEnd <= start && span.closeStart >= start && span.closeEnd <= end) {
      closing.push(span);
    } else if (span.openStart >= start && span.openEnd <= end && span.closeStart >= end) {
      opening.push(span);
    }
  }
  closing.sort((left, right) => left.closeStart - right.closeStart);
  opening.sort((left, right) => left.openStart - right.openStart);
  const positions = new Uint32Array(source.length + 1);
  const retained = (from, to, offset) => {
    let result = "";
    for (let index = from; index < to; index += 1) {
      positions[index] = offset + result.length;
      if (!removals[index]) result += source[index];
    }
    return result;
  };
  const before = retained(0, start, 0);
  const repairedOpen = new Map();
  const repairedClose = new Map();
  let inserted = replacement;
  for (const span of closing) { repairedClose.set(span, before.length + inserted.length); inserted += span.marker; }
  for (const span of opening) { repairedOpen.set(span, before.length + inserted.length); inserted += span.marker; }
  const after = retained(end, source.length, before.length + inserted.length);
  const pairs = [];
  for (const span of model.spans) {
    const open = repairedOpen.get(span) ?? (!removals[span.openStart] ? positions[span.openStart] : null);
    const close = repairedClose.get(span) ?? (!removals[span.closeStart] ? positions[span.closeStart] : null);
    if (open !== null && close !== null) pairs.push({
      marker: span.marker, open, close,
      affected: start <= span.closeStart && end >= span.openEnd,
    });
  }
  // Deleting the first/last word of styled text must not expose its markers.
  // Move only affected delimiters around newly exposed edge whitespace; leave
  // the whitespace itself, and every unrelated source range, untouched.
  return repairWhitespaceEdges(before + inserted + after, pairs, before.length + replacement.length);
}
