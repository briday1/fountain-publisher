import assert from "node:assert/strict";
import test from "node:test";
import { parseEx, runEx, runSearch, SEARCH_LIMITS, translateVimBoundaries } from "../../src/fountain_publisher/web/search-engine.mjs";
import { handleSearchTask } from "../../src/fountain_publisher/web/search-worker.mjs";

function replace(text, edits) {
  return edits.reduceRight((value, edit) => value.slice(0, edit.start) + edit.text + value.slice(edit.end), text);
}

test("literal search reports UTF-16 offsets and one-based line/column without interpreting regex", () => {
  const result = runSearch({ text: "😀.*\n.*", query: ".*" });
  assert.deepEqual(result, { matches: [{ start: 2, end: 4, line: 1, column: 3 }, { start: 5, end: 7, line: 2, column: 1 }], count: 2 });
  assert.equal(runSearch({ text: "Cat CAT cat", query: "cat" }).count, 3);
  assert.equal(runSearch({ text: "Cat CAT cat", query: "cat", caseSensitive: true }).count, 1);
});

test("whole-word matching handles Unicode letters, combining marks, numbers, and underscores", () => {
  const result = runSearch({ text: "cat cats _cat cat2 écat caté cat\u0301 cat", query: "cat", wholeWord: true });
  assert.equal(result.count, 2);
  assert.equal(runSearch({ text: "猫 猫咪 小猫", query: "猫", wholeWord: true }).count, 1);
});

test("an empty literal query does nothing, while zero-width Unicode regex matches advance safely", () => {
  assert.deepEqual(runSearch({ text: "abc", query: "", replacement: "X" }), { matches: [], count: 0, edits: [] });
  const result = runSearch({ text: "😀x", query: "", regex: true, replacement: "-" });
  assert.deepEqual(result.matches.map(({ start, end }) => [start, end]), [[0, 0], [2, 2], [3, 3]]);
  assert.equal(replace("😀x", result.edits), "-😀-x-");
  assert.equal(runSearch({ text: "", query: "^", regex: true }).count, 1);
});

test("regex matching is global, Unicode-aware, and multiline", () => {
  assert.equal(runSearch({ text: "cat\nCAT\ndog", query: "^cat$", regex: true }).count, 2);
  assert.deepEqual(runSearch({ text: "😀😀", query: ".", regex: true }).matches.map(({ start, end }) => [start, end]), [[0, 2], [2, 4]]);
  assert.throws(() => runSearch({ text: "abc", query: "[", regex: true }), /Invalid JavaScript regular expression/);
});

test("literal replacement preserves dollar signs and backslashes verbatim", () => {
  const text = "cat cat";
  const result = runSearch({ text, query: "cat", replacement: "$& $1 \\1" });
  assert.equal(replace(text, result.edits), "$& $1 \\1 $& $1 \\1");
});

for (const [pattern, replacement] of [
  ["(a)(b)?", "$1|$2|$&|$$|$0|$01|$10|$12|$99"],
  ["(?<first>a)(?<second>b)?", "$<first>-$<second>-$<missing>-$$"],
  ["a", "$<missing>-$1-$0-$00-$01"],
  ["(a)", "$`:$&:$'"],
  ["()", "[$1][$&]"],
]) {
  test(`regex replacements match native JavaScript substitution semantics: ${replacement}`, () => {
    const text = "ab a";
    const result = runSearch({ text, query: pattern, regex: true, caseSensitive: true, replacement });
    assert.equal(replace(text, result.edits), text.replace(new RegExp(pattern, "gmu"), replacement));
  });
}

test("match and query limits fail explicitly instead of returning partial replacement plans", () => {
  assert.equal(runSearch({ text: "a".repeat(SEARCH_LIMITS.matches), query: "a" }).count, SEARCH_LIMITS.matches);
  assert.throws(() => runSearch({ text: "a".repeat(SEARCH_LIMITS.matches + 1), query: "a", replacement: "b" }), /10,000 matches.*no replacements/i);
  assert.throws(() => runSearch({ text: "", query: "a".repeat(SEARCH_LIMITS.query + 1) }), /pattern exceeds/);
  assert.throws(() => runSearch({ text: "a".repeat(SEARCH_LIMITS.text + 1), query: "a" }), /document exceeds/);
});

test("replacement output limits include unchanged text outside a scoped Ex range", () => {
  assert.throws(() => runSearch({ text: "a".repeat(1_000), query: "a", replacement: "x".repeat(10_000) }), /output limit/);
  const text = "x".repeat(SEARCH_LIMITS.output - 3) + "\na";
  assert.throws(() => runEx({ text, command: "$s/a/aaaa/" }), /output limit/);
});

test("capture expansion is bounded before large replacement strings are allocated", () => {
  const text = "a".repeat(4_000_000);
  assert.throws(() => runSearch({ text, query: "a+", regex: true, replacement: "$&".repeat(32_768) }), /output limit/);
  assert.throws(() => runEx({ text, command: ":s/a+/" + "&".repeat(65_536) + "/" }), /output limit/);
  assert.throws(() => runSearch({ text: "a", query: "a", replacement: "b".repeat(SEARCH_LIMITS.replacement + 1) }), /replacement template exceeds/);
  assert.throws(() => parseEx(":s/a/" + "b".repeat(SEARCH_LIMITS.command)), /command exceeds/);
});

test("substitute defaults to the current line and the first occurrence on each selected line", () => {
  const text = "cat cat\ncat cat\ncat";
  const current = runEx({ text, command: ":s/cat/dog/", currentLine: 2 });
  assert.deepEqual(current.range, [2, 2]);
  assert.deepEqual(current.matches, [{ start: 8, end: 11, line: 2, column: 1 }]);
  assert.equal(replace(text, current.edits), "cat cat\ndog cat\ncat");
  assert.equal(replace(text, runEx({ text, command: ":%s/cat/dog/" }).edits), "dog cat\ndog cat\ndog");
  assert.equal(replace(text, runEx({ text, command: ":%s/cat/dog/g" }).edits), "dog dog\ndog dog\ndog");
});

test("first-per-line Ex substitutions do not enumerate every unused occurrence", () => {
  const result = runEx({ text: "a".repeat(SEARCH_LIMITS.matches + 1), command: ":s/a/b/" });
  assert.equal(result.count, 1);
  assert.equal(result.edits.length, 1);
});

test("numeric/current/end/visual and offset ranges resolve to exact source lines", () => {
  const text = "a\na\na\na\na";
  assert.deepEqual(parseEx(":2,4s/a/b/", { text }).range, [2, 4]);
  assert.deepEqual(parseEx(":.,$s/a/b/", { text, currentLine: 3 }).range, [3, 5]);
  assert.deepEqual(parseEx(":'<,'>s/a/b/", { text, visualRange: [4, 2] }).range, [2, 4]);
  assert.deepEqual(parseEx(":.+1,$-1s/a/b/", { text, currentLine: 1 }).range, [2, 4]);
  assert.deepEqual(parseEx(":2;.+1s/a/b/", { text, currentLine: 5 }).range, [2, 3]);
  assert.throws(() => parseEx(":'<,'>s/a/b/", { text }), /visual line selection/);
  assert.throws(() => parseEx(":4,2s/a/b/", { text }), /must not precede/);
});

test("alternate delimiters and escaped delimiters preserve literal pattern/replacement characters", () => {
  assert.equal(replace("a#b", runEx({ text: "a#b", command: String.raw`:s#a\#b#c\#d#` }).edits), "c#d");
  assert.equal(replace("a|b", runEx({ text: "a|b", command: String.raw`:s|a\|b|c\|d|` }).edits), "c|d");
  assert.equal(replace("a/b", runEx({ text: "a/b", command: String.raw`:s/a\/b/c\/d/` }).edits), "c/d");
  assert.equal(replace("a-mz", runEx({ text: "a-mz", command: String.raw`:s-[a\-z]-x-g` }).edits), "xxmx");
  assert.equal(replace("cat", runEx({ text: "cat", command: ":s/cat/dog" }).edits), "dog");
});

test("Ex replacement uses ampersands, backreferences, and newline escapes, not dollar syntax", () => {
  const text = "cat";
  const result = runEx({ text, command: String.raw`:s/(c)(at)/&-\2\1-\&-\0-$1-\r-end/` });
  assert.equal(replace(text, result.edits), "cat-atc-&-cat-$1-\n-end");
  assert.equal(replace(text, runEx({ text, command: String.raw`:s/cat/\\/` }).edits), "\\");
  assert.throws(() => runEx({ text, command: String.raw`:s/cat/\U&/` }), /Unsupported substitute replacement escape/);
});

test("Ex case flags are explicit and count-only substitution emits no edits", () => {
  const text = "cat CAT\nCat";
  assert.equal(runEx({ text, command: ":%s/cat/dog/g" }).count, 1);
  assert.equal(runEx({ text, command: ":%s/cat/dog/gi" }).count, 3);
  assert.equal(runEx({ text, command: ":%s/cat/dog/giI" }).count, 1);
  assert.equal(runEx({ text, command: ":%s/cat/dog/gIi" }).count, 3);
  const counted = runEx({ text, command: ":%s/cat/dog/gin" });
  assert.equal(counted.count, 3);
  assert.equal(counted.countOnly, true);
  assert.deepEqual(counted.edits, []);
});

test("empty Ex patterns reuse an explicit previous query and Vim word boundaries are Unicode-aware", () => {
  assert.equal(runEx({ text: "cat cat", command: ":s//dog/g", lastQuery: "cat" }).count, 2);
  assert.throws(() => runEx({ text: "cat", command: ":s//dog/" }), /no previous search pattern/);
  assert.equal(runEx({ text: "café caféine", command: String.raw`:%s/\<café\>/tea/g` }).count, 1);
  assert.equal(runEx({ text: "猫 猫咪", command: String.raw`:%s/\<猫\>/dog/g` }).count, 1);
  assert.equal(translateVimBoundaries(String.raw`\\<`), String.raw`\\<`);
  assert.equal(runSearch({ text: "cat cats", query: String.raw`\<cat\>`, regex: true, vim: true }).count, 1);
});

test("replacement plans reject malformed UTF-16 consistently for local and collaborative documents", () => {
  assert.throws(() => runSearch({ text: "😀", query: ".", regex: true, replacement: "\ud800" }), /incomplete Unicode character/);
  assert.throws(() => runSearch({ text: "a", query: "a", replacement: "\udc00" }), /incomplete Unicode character/);
  assert.throws(() => runSearch({ text: "\ud800", query: String.raw`[\uD800]`, regex: true, replacement: "x" }), /incomplete Unicode character/);
  assert.throws(() => runEx({ text: "\ud800\na", command: ":2s/a/b/" }), /incomplete Unicode character/);
  assert.equal(replace("😀", runSearch({ text: "😀", query: ".", regex: true, replacement: "🐈" }).edits), "🐈");
  const insertion = runSearch({ text: "😀", query: "", regex: true, replacement: "🐈" });
  assert.deepEqual(insertion.edits.map(({ start }) => start), [0, 2]);
});

test("document grep and global-print produce one result per matching line", () => {
  const text = "cat cat\ndog\nCat cat";
  const grep = runEx({ text, command: ":grep /cat/" });
  assert.equal(grep.type, "grep");
  assert.deepEqual(grep.matches, [{ start: 0, end: 3, line: 1, column: 1 }, { start: 16, end: 19, line: 3, column: 5 }]);
  assert.deepEqual(runEx({ text, command: ":vimgrep /cat/i" }).matches.map(({ column }) => column), [1, 1]);
  assert.equal(runEx({ text, command: ":grep cat" }).count, 2);
  assert.equal(runEx({ text, command: ":g/cat/p" }).count, 2);
  assert.deepEqual(runEx({ text, command: ":v/cat/p" }).matches, [{ start: 8, end: 11, line: 2, column: 1 }]);
  assert.equal(runEx({ text, command: ":2,3g/cat/print" }).count, 1);
});

test("line and quickfix commands are parsed without performing mutations", () => {
  const text = "one\ntwo\nthree";
  assert.deepEqual(runEx({ text, command: ":2" }), { type: "line", line: 2 });
  assert.deepEqual(runEx({ text, command: ":$" }), { type: "line", line: 3 });
  for (const [command, action] of Object.entries({ copen: "open", cclose: "close", cnext: "next", cprev: "previous", cfirst: "first", clast: "last" })) {
    assert.deepEqual(runEx({ text, command: `:${command}` }), { type: "quickfix", action });
  }
});

for (const command of [":sort", ":s/a/b/c", ":s/a/b/e", ":g/a/d", ":s/foo", ":0", ":999", ":%copen", ":grep /a/ file.fountain", ":vimgrep /a/g", ":1,2"]) {
  test(`unsupported or malformed Ex command is rejected explicitly: ${command}`, () => {
    assert.throws(() => runEx({ text: "a\nb", command }), Error);
  });
}

test("worker task dispatch exposes only the supported search operations", () => {
  assert.equal(handleSearchTask("search", { text: "a", query: "a" }).count, 1);
  assert.equal(handleSearchTask("ex", { text: "a", command: ":s/a/b/" }).count, 1);
  assert.deepEqual(handleSearchTask("parse-ex", { text: "a", command: ":1" }), { type: "line", line: 1 });
  assert.throws(() => handleSearchTask("eval", {}), /Unknown search task/);
});
