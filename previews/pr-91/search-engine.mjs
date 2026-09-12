// Search patterns use JavaScript Unicode regular expressions with global and
// multiline flags, not Vim's regex dialect. Only Vim's \< / \> are translated.
export const SEARCH_LIMITS = Object.freeze({ matches: 10_000, text: 8_000_000, output: 8_000_000, query: 16_384, replacement: 65_536, command: 100_000 });
const WORD = /[\p{L}\p{N}\p{M}_]/u;
const WORD_CLASS = "[\\p{L}\\p{N}\\p{M}_]";

function inputText(value) {
  const text = String(value ?? "");
  if (text.length > SEARCH_LIMITS.text) throw new Error("This document exceeds the 8-million-character search limit.");
  return text;
}

function lineStarts(text) {
  const starts = [0];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "\n") starts.push(index + 1);
    if (starts.length > 1_000_000) throw new Error("This document has too many lines to search safely.");
  }
  return starts;
}

function position(starts, offset) {
  let low = 0;
  let high = starts.length;
  while (low + 1 < high) {
    const middle = (low + high) >>> 1;
    if (starts[middle] <= offset) low = middle;
    else high = middle;
  }
  return { line: low + 1, column: offset - starts[low] + 1 };
}

function regexp(query, { regex = false, caseSensitive = false } = {}) {
  query = String(query ?? "");
  if (query.length > SEARCH_LIMITS.query) throw new Error("The search pattern exceeds the 16,384-character limit.");
  const pattern = regex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  try { return new RegExp(pattern, `gum${caseSensitive ? "" : "i"}`); }
  catch (error) { throw new Error(`Invalid JavaScript regular expression: ${error.message}`); }
}

function advance(text, index) {
  return index + (text.codePointAt(index) > 0xffff ? 2 : 1);
}

function assertWellFormed(text, label) {
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(++index);
      if (next >= 0xdc00 && next <= 0xdfff) continue;
    } else if (code < 0xdc00 || code > 0xdfff) continue;
    throw new Error(`${label} contains an incomplete Unicode character. No replacements were applied.`);
  }
}

function assertEditBoundary(text, offset) {
  const before = text.charCodeAt(offset - 1);
  const after = text.charCodeAt(offset);
  if (before >= 0xd800 && before <= 0xdbff && after >= 0xdc00 && after <= 0xdfff) {
    throw new Error("A replacement would split a Unicode character. No replacements were applied.");
  }
}

function wholeWordMatch(text, start, end) {
  const before = [...text.slice(Math.max(0, start - 2), start)].at(-1) ?? "";
  const after = String.fromCodePoint(text.codePointAt(end) ?? 0);
  return !WORD.test(before) && !WORD.test(after);
}

function replacementBuilder(limit) {
  const fragments = [];
  let length = 0;
  return {
    append(value) {
      if (length + value.length > limit) throw new Error("The replacement would exceed the 8-million-character output limit. No replacements were applied.");
      length += value.length;
      if (value) fragments.push(value);
    },
    finish() { return fragments.join(""); },
  };
}

function jsReplacement(template, match, text, limit) {
  const builder = replacementBuilder(limit);
  function substitution(token, key) {
    if (key === "$") return "$";
    if (key === "&") return match[0];
    if (key === "`") return text.slice(0, match.index);
    if (key === "'") return text.slice(match.index + match[0].length);
    if (key.startsWith("<")) return match.groups ? match.groups[key.slice(1, -1)] ?? "" : token;
    const number = Number(key);
    if (number > 0 && number < match.length) return match[number] ?? "";
    const first = Number(key[0]);
    if (key.length === 2 && first > 0 && first < match.length) return (match[first] ?? "") + key[1];
    return token;
  }
  const tokens = /\$(\$|&|`|'|<[^>]*>|\d{1,2})/g;
  let previous = 0;
  let token;
  while ((token = tokens.exec(template))) {
    builder.append(template.slice(previous, token.index));
    builder.append(substitution(token[0], token[1]));
    previous = token.index + token[0].length;
  }
  builder.append(template.slice(previous));
  return builder.finish();
}

function exReplacement(template, match, delimiter, limit = SEARCH_LIMITS.output) {
  const builder = replacementBuilder(limit);
  for (let index = 0; index < template.length; index += 1) {
    const char = template[index];
    if (char === "&") { builder.append(match[0]); continue; }
    if (char !== "\\") { builder.append(char); continue; }
    const escaped = template[++index];
    if (escaped == null) throw new Error("A substitute replacement cannot end with an unescaped backslash.");
    if (/\d/.test(escaped)) builder.append(match[Number(escaped)] ?? "");
    else if (escaped === "r") builder.append("\n");
    else if (escaped === "t") builder.append("\t");
    else if (escaped === "&" || escaped === "\\" || escaped === delimiter) builder.append(escaped);
    else throw new Error(`Unsupported substitute replacement escape \\${escaped}. Use \\r for a new line, \\1–\\9 for captures, or the search UI for literal replacement.`);
  }
  return builder.finish();
}

function collect(options, { firstPerLine = false, replacementStyle = "js", delimiter = "/", outputLimit = SEARCH_LIMITS.output } = {}) {
  const text = inputText(options.text);
  const rawQuery = String(options.query ?? "");
  const query = options.vim && options.regex ? translateVimBoundaries(rawQuery) : rawQuery;
  const replacing = Object.hasOwn(options, "replacement");
  const replacement = replacing ? String(options.replacement ?? "") : "";
  if (replacement.length > SEARCH_LIMITS.replacement) throw new Error("The replacement template exceeds the 65,536-character limit.");
  if (replacing) {
    assertWellFormed(text, "The document");
    assertWellFormed(replacement, "The replacement");
  }
  const matches = [];
  const edits = [];
  if (!query && !options.regex) return { matches, count: 0, ...(replacing ? { edits } : {}) };
  const pattern = regexp(query, options);
  const starts = lineStarts(text);
  let outputLength = 0;
  let previousEnd = 0;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    const accepted = !options.wholeWord || wholeWordMatch(text, start, end);
    if (accepted) {
      if (matches.length >= SEARCH_LIMITS.matches) throw new Error("More than 10,000 matches were found. Narrow the search; no replacements were applied.");
      const location = position(starts, start);
      matches.push({ start, end, ...location });
      if (replacing) {
        const remaining = outputLimit - outputLength - (start - previousEnd);
        const value = replacementStyle === "ex" ? exReplacement(replacement, match, delimiter, remaining)
          : options.regex ? jsReplacement(replacement, match, text, remaining) : replacement;
        outputLength += start - previousEnd + value.length;
        if (outputLength > outputLimit) throw new Error("The replacement would exceed the 8-million-character output limit. No replacements were applied.");
        assertEditBoundary(text, start);
        assertEditBoundary(text, end);
        assertWellFormed(value, "The replacement");
        previousEnd = end;
        edits.push({ start, end, text: value });
      }
      if (firstPerLine) {
        const nextLine = starts[location.line];
        if (nextLine == null) break;
        pattern.lastIndex = Math.max(pattern.lastIndex, nextLine);
      }
    }
    if (start === end && pattern.lastIndex <= start) {
      if (start === text.length) break;
      pattern.lastIndex = advance(text, start);
    }
  }
  if (replacing && outputLength + text.length - previousEnd > outputLimit) {
    throw new Error("The replacement would exceed the 8-million-character output limit. No replacements were applied.");
  }
  return { matches, count: matches.length, ...(replacing ? { edits } : {}) };
}

export function runSearch(options = {}) { return collect(options); }

export function translateVimBoundaries(pattern) {
  return pattern.replace(/\\[\s\S]/g, (escape) => escape === "\\<" ? `(?<!${WORD_CLASS})(?=${WORD_CLASS})`
    : escape === "\\>" ? `(?<=${WORD_CLASS})(?!${WORD_CLASS})` : escape);
}

function delimited(source, start, delimiter, requireClose = true) {
  let value = "";
  let index = start;
  while (index < source.length) {
    if (source[index] === delimiter) return { value, end: index + 1, closed: true };
    if (source[index] === "\\" && index + 1 < source.length) value += source[index++] + source[index++];
    else value += source[index++];
  }
  if (requireClose) throw new Error(`Missing closing ${delimiter} delimiter.`);
  return { value, end: index, closed: false };
}

function unescapePatternDelimiter(pattern, delimiter) {
  let inClass = false;
  return pattern.replace(/\\[\s\S]|[\s\S]/g, (token) => {
    if (token === "[") inClass = true;
    else if (token === "]") inClass = false;
    if (token[0] !== "\\" || token[1] !== delimiter) return token;
    if (delimiter === "-" && inClass) return token;
    return /[.*+?^${}()|[\]\\/]/.test(delimiter) ? token : delimiter;
  });
}

function searchPattern(pattern, delimiter, lastQuery) {
  const query = unescapePatternDelimiter(pattern, delimiter);
  if (query) return translateVimBoundaries(query);
  if (lastQuery == null || String(lastQuery) === "") throw new Error("There is no previous search pattern. Enter a pattern between the delimiters.");
  return translateVimBoundaries(String(lastQuery));
}

function validDelimiter(value) {
  if (!value || /[\p{L}\p{N}\s\\\uD800-\uDFFF]/u.test(value)) throw new Error("Use a non-letter delimiter, for example :s/old/new/g or :s#old#new#g.");
  return value;
}

function flags(value, allowed) {
  if (value.includes("c")) throw new Error("The c confirmation flag is not supported. Use Find and Replace to review replacements one at a time.");
  for (const flag of value) if (!allowed.includes(flag)) throw new Error(`Unsupported flag: ${flag}. Supported flags: ${allowed.split("").join(", ")}.`);
  return { global: value.includes("g"), caseSensitive: value.lastIndexOf("I") > value.lastIndexOf("i") || !value.includes("i"), countOnly: value.includes("n") };
}

export function parseEx(command, { text = "", currentLine = 1, visualRange, lastQuery } = {}) {
  const document = inputText(text);
  const starts = lineStarts(document);
  const source = String(command ?? "").trim().replace(/^:\s*/, "");
  if (source.length > SEARCH_LIMITS.command) throw new Error("The Ex command exceeds the 100,000-character limit.");
  if (!source) throw new Error("Enter an Ex command, for example :%s/old/new/g.");
  let cursor = 0;
  let range = null;
  const current = Math.min(starts.length, Math.max(1, Math.trunc(Number(currentLine)) || 1));
  const skipSpace = () => { while (/\s/.test(source[cursor] ?? "") && cursor < source.length) cursor += 1; };
  function address(relative = current) {
    skipSpace();
    const token = source.slice(cursor).match(/^(\d+|\.|\$|'<|'>)/)?.[0];
    if (!token) return null;
    cursor += token.length;
    let line;
    if (token === ".") line = relative;
    else if (token === "$") line = starts.length;
    else if (token[0] === "'") {
      if (!visualRange || visualRange.length !== 2) throw new Error("This command needs a visual line selection.");
      line = token === "'<" ? Math.min(...visualRange) : Math.max(...visualRange);
    } else line = Number(token);
    let offset;
    while ((offset = source.slice(cursor).match(/^([+-])(\d*)/))) {
      line += (offset[1] === "+" ? 1 : -1) * Number(offset[2] || 1);
      cursor += offset[0].length;
    }
    if (!Number.isInteger(line) || line < 1 || line > starts.length) throw new Error(`Line ${line} is outside this document (1–${starts.length}).`);
    return line;
  }
  if (source[cursor] === "%") { range = [1, starts.length]; cursor += 1; }
  else {
    const first = address();
    if (first != null) {
      range = [first, first];
      skipSpace();
      if (source[cursor] === "," || source[cursor] === ";") {
        const separator = source[cursor++];
        const last = address(separator === ";" ? first : current);
        if (last == null) throw new Error("The range needs an ending line.");
        if (last < first) throw new Error("The ending line must not precede the starting line.");
        range[1] = last;
      }
    }
  }
  skipSpace();
  const remaining = source.slice(cursor);
  if (!remaining && range?.[0] === range?.[1]) return { type: "line", line: range[0] };
  const quickfix = { copen: "open", cclose: "close", cnext: "next", cprev: "previous", cprevious: "previous", cfirst: "first", clast: "last" };
  if (Object.hasOwn(quickfix, remaining)) {
    if (range) throw new Error("Quickfix commands do not accept a line range.");
    return { type: "quickfix", action: quickfix[remaining] };
  }
  const substitute = remaining.match(/^(?:substitute|s)(?=[^\p{L}\p{N}_]|$)/u)?.[0];
  if (substitute) {
    const rest = remaining.slice(substitute.length).trimStart();
    const delimiter = validDelimiter(rest[0]);
    const pattern = delimited(rest, 1, delimiter);
    const replacement = delimited(rest, pattern.end, delimiter, false);
    if (replacement.value.length > SEARCH_LIMITS.replacement) throw new Error("The replacement template exceeds the 65,536-character limit.");
    const selectedFlags = flags(rest.slice(replacement.end).trim(), "giIn");
    if (!selectedFlags.countOnly) exReplacement(replacement.value, Array(10).fill(""), delimiter);
    return { type: "substitute", range: range ?? [current, current], query: searchPattern(pattern.value, delimiter, lastQuery), replacement: replacement.value, delimiter, ...selectedFlags };
  }
  const global = remaining.match(/^(vglobal|global|g|v)(?=[^\p{L}\p{N}_]|$)/u)?.[0];
  if (global) {
    const rest = remaining.slice(global.length).trimStart();
    const delimiter = validDelimiter(rest[0]);
    const pattern = delimited(rest, 1, delimiter);
    if (!/^(?:p|print)$/.test(rest.slice(pattern.end).trim())) throw new Error("Global commands currently support printing matches only: :g/pattern/p or :v/pattern/p.");
    return { type: "grep", range: range ?? [1, starts.length], query: searchPattern(pattern.value, delimiter, lastQuery), invert: global.startsWith("v"), caseSensitive: true };
  }
  const grep = remaining.match(/^(grep|vimgrep)(?:\s+|$)/)?.[0];
  if (grep) {
    if (range) throw new Error("Use :g/pattern/p for a range-limited document search.");
    const rest = remaining.slice(grep.length).trim();
    if (!rest) throw new Error("Enter a grep pattern, for example :grep /dialogue/.");
    let query = rest;
    let selectedFlags = { caseSensitive: true };
    if (/^[^\p{L}\p{N}\s\\]/u.test(rest)) {
      const delimiter = validDelimiter(rest[0]);
      const pattern = delimited(rest, 1, delimiter);
      selectedFlags = flags(rest.slice(pattern.end).trim(), "iI");
      query = searchPattern(pattern.value, delimiter, lastQuery);
    } else query = translateVimBoundaries(query);
    return { type: "grep", range: [1, starts.length], query, invert: false, caseSensitive: selectedFlags.caseSensitive };
  }
  throw new Error(`Unsupported Ex command: ${remaining || source}. Supported: substitute, grep, vimgrep, g/pattern/p, v/pattern/p, quickfix navigation, and line numbers.`);
}

export function runEx({ text = "", command, currentLine, visualRange, lastQuery } = {}) {
  text = inputText(text);
  const descriptor = parseEx(command, { text, currentLine, visualRange, lastQuery });
  if (descriptor.type === "quickfix" || descriptor.type === "line") return descriptor;
  if (descriptor.type === "substitute" && !descriptor.countOnly) assertWellFormed(text, "The document");
  const starts = lineStarts(text);
  const [first, last] = descriptor.range;
  const offset = starts[first - 1];
  const end = last < starts.length ? starts[last] - 1 : text.length;
  const scoped = text.slice(offset, end);
  const options = { text: scoped, query: descriptor.query, regex: true, caseSensitive: descriptor.caseSensitive };
  if (descriptor.type === "substitute" && !descriptor.countOnly) options.replacement = descriptor.replacement;
  const result = collect(options, { firstPerLine: descriptor.type === "grep" || !descriptor.global, replacementStyle: "ex", delimiter: descriptor.delimiter, outputLimit: SEARCH_LIMITS.output - (text.length - scoped.length) });
  let matches = result.matches.map((match) => ({ ...match, start: match.start + offset, end: match.end + offset, line: match.line + first - 1 }));
  if (descriptor.type === "grep" && descriptor.invert) {
    const matchedLines = new Set(matches.map((match) => match.line));
    matches = [];
    for (let line = first; line <= last; line += 1) {
      if (matchedLines.has(line)) continue;
      if (matches.length >= SEARCH_LIMITS.matches) throw new Error("More than 10,000 matching lines were found. Narrow the search.");
      matches.push({ start: starts[line - 1], end: line < starts.length ? starts[line] - 1 : text.length, line, column: 1 });
    }
  }
  const edits = (result.edits ?? []).map((edit) => ({ ...edit, start: edit.start + offset, end: edit.end + offset }));
  if (descriptor.type === "substitute" && edits.reduce((length, edit) => length + edit.text.length - (edit.end - edit.start), text.length) > SEARCH_LIMITS.output) {
    throw new Error("The replacement would exceed the 8-million-character output limit. No replacements were applied.");
  }
  return { ...descriptor, matches, count: matches.length, ...(descriptor.type === "substitute" ? { edits } : {}) };
}
