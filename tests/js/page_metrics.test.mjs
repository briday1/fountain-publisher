import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";

const app = await readFile(new URL("../../src/fountain_publisher/web/app.mjs", import.meta.url), "utf8");
const code = app.slice(app.indexOf("function pageMetricParts("), app.indexOf("function renderCharacterTable("));
const target = { innerHTML: "", textContent: "", attributes: {}, setAttribute(name, value) { this.attributes[name] = value; } };
const { pageMetricParts, renderPageMetric } = runInNewContext(`${code}\n({pageMetricParts, renderPageMetric})`, { $: () => target });

function parts(metadata) { return JSON.parse(JSON.stringify(pageMetricParts(metadata))); }

test("a tenth page filled to seven eighths represents nine and seven eighths pages", () => {
  assert.deepEqual(parts({ pageCount: 10, lastPageEighths: 7 }), { wholePages: 9, fraction: [7, 8] });
  renderPageMetric({ pageCount: 10, lastPageEighths: 7 });
  assert.equal(target.innerHTML, '9 <small class="page-fraction"><sup>7</sup><sub>8</sub></small>');
  assert.equal(target.attributes["aria-label"], "9 7/8 pages");
});

test("an exactly full tenth page stays ten pages without an extra fraction", () => {
  assert.deepEqual(parts({ pageCount: 10, lastPageEighths: 8 }), { wholePages: 10, fraction: null });
  renderPageMetric({ pageCount: 10, lastPageEighths: 8 });
  assert.equal(target.innerHTML, "10");
  assert.equal(target.attributes["aria-label"], "10 pages");
});

test("every partial first-page measurement displays a fraction without a leading zero", () => {
  const fractions = [[1, 8], [1, 4], [3, 8], [1, 2], [5, 8], [3, 4], [7, 8]];
  for (let eighths = 1; eighths <= 7; eighths += 1) {
    const fraction = fractions[eighths - 1];
    assert.deepEqual(parts({ pageCount: 1, lastPageEighths: eighths }), { wholePages: 0, fraction });
    renderPageMetric({ pageCount: 1, lastPageEighths: eighths });
    assert.equal(target.innerHTML, `<small class="page-fraction"><sup>${fraction[0]}</sup><sub>${fraction[1]}</sub></small>`);
    assert.equal(target.attributes["aria-label"], `${fraction[0]}/${fraction[1]} pages`);
  }
});

test("missing or invalid occupancy falls back to the known physical page count", () => {
  for (const lastPageEighths of [undefined, null, 0, -1, 9, 1.5, NaN, "7"]) {
    assert.deepEqual(parts({ pageCount: 10, lastPageEighths }), { wholePages: 10, fraction: null });
    renderPageMetric({ pageCount: 10, lastPageEighths });
    assert.equal(target.innerHTML, "10");
  }
});

test("empty documents remain zero even if stale occupancy metadata is nonzero", () => {
  for (const lastPageEighths of [undefined, 0, 1, 7, 8]) {
    assert.deepEqual(parts({ pageCount: 0, lastPageEighths }), { wholePages: 0, fraction: null });
    renderPageMetric({ pageCount: 0, lastPageEighths });
    assert.equal(target.innerHTML, "0");
    assert.equal(target.attributes["aria-label"], "0 pages");
  }
});

test("unknown or invalid page counts remain unavailable instead of yielding negative or NaN totals", () => {
  for (const pageCount of [undefined, null, -1, NaN, Infinity, 1.5, "10"]) {
    assert.equal(pageMetricParts({ pageCount, lastPageEighths: 7 }), null);
    renderPageMetric({ pageCount, lastPageEighths: 7 });
    assert.equal(target.textContent, "—");
    assert.equal(target.attributes["aria-label"], "Page count not available");
  }
});
