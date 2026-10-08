# Book export fidelity acceptance — 2026-10-08

PDF, DOCX, EPUB and RTF preserve the representative manuscript in both default-font and selected-font exports. Actual Calibre EPUB-reader acceptance now passes. The run found and fixed three Book export defects: silent missing glyphs in a selected PDF font, tabs becoming missing characters in PDFs, and RTF footnote numerals falling back to another font.

The initial source was `1de87b6be90bc2e2719c6f5a87e48ac3ebe02aaf`. The change was rebased onto `eab8a77b9c7dda1a9caf071131c3ce8eb55f5b11`; that intervening commit changes branding, not export code. The full tests and both product builds were rerun after rebasing. Application privacy, Access, billing, deployment configuration and screenplay export code are unchanged. No production deployment was performed.

## Manuscript and font variants

`tests/fixtures/book-export.ts` creates **The Tide Ledger & Other Stories**, a synthetic manuscript with 42 body blocks, 3,286 body/front-matter words and 1,437 footnote words. It contains:

- Title, author and dedication front matter.
- Two Book headings, three independently numbered Chapter headings, and three lower-level headings.
- Twenty-one substantial paragraphs, epigraphs, attributions, multiline quotations and section breaks.
- Bold, italic, combined bold/italic and underline in every substantial paragraph.
- Twelve footnotes numbered consecutively across chapters; note 6 is deliberately long enough to require continuation with the selected font.
- Curly quotes, an em dash, `café`, `€`, braces and a literal backslash.
- A private editor bookmark, which remains manuscript metadata rather than becoming publication text.
- Unique paragraph boundaries and final words for checking truncation.

Eight samples were generated: all four formats with export defaults, and all four with **DejaVu Serif** selected and its regular, bold, italic and bold/italic font files supplied. Saved Markdown is also parsed again in regression coverage before comparing DOCX and EPUB contents.

## Format comparison

| Format | Text, numbering and front matter | Footnotes and reader behavior | Font result | Pages: default / selected |
| --- | --- | --- | --- | --- |
| PDF | Exact body and note text after removing layout whitespace and display counters; Book 1–2 and Chapter 1–3 retained; final words present. | Notes reserve space above the bottom margin with no body overlap. Selected-font note 6 continues onto another page without losing text. PDF page numbers remain consecutive. | Default uses the four Times styles. Selected export embeds and renders all four DejaVu Serif styles. | 14 / 17 |
| DOCX | Every paragraph and native note matches the saved manuscript in package checks and LibreOffice text extraction; title, author, dedication, headings and marks render correctly. | Twelve native Word footnote references and notes. LibreOffice positions notes at page bottoms and continues the long note. | Default names Georgia; this host substitutes Noto Serif because Georgia is absent. Selected export contains four embedded DejaVu font parts and renders all four styles. | 17 / 16 in LibreOffice |
| EPUB | Every body paragraph and note matches the saved manuscript. Heading navigation and independent Book/Chapter numbers are retained. | Both variants pass EPUBCheck. Actual Calibre opens all 12 note popups, preserves each complete note, and returns to the visible matching reference, including references 10–12 and the long note. | Default leaves the serif choice to the reader. Selected export includes four font files; Calibre reports all four faces loaded and DejaVu Serif as the body family. | Reflowable; reader-dependent |
| RTF | LibreOffice extraction matches all body and note text; front matter, headings, emphasis, literal braces/backslash and final words survive native import. | Twelve native footnotes. LibreOffice positions notes at page bottoms and continues notes when required. | Font family is referenced rather than embedded. With DejaVu Serif installed, all four styles and footnote numerals render in that family after the fix. Default Georgia falls back to Noto Serif on this host. | 15 / 14 in LibreOffice |

Pagination differs by format, font metrics and reader. DOCX and RTF use the importing application's pagination; EPUB reflows and its reader controls page breaks. This acceptance does not require identical page counts across formats.

All eight representative exports report no warnings. MuPDF extraction compared body and note streams separately in the original PDFs and LibreOffice-rendered DOCX/RTF files: all six rendered documents match the source exactly after excluding layout whitespace, reference numerals and PDF page counters. Every extracted text span is within its page bounds. All 31 original PDF pages, 33 DOCX pages and 29 RTF pages were visually inspected, including front matter, note continuations and final pages.

## Defects and regression coverage

1. **Selected PDF fonts could silently lose unsupported characters.** `PDFFont.encodeText()` may successfully encode the font's missing-glyph box, so the previous exception-based check returned no warning. PDF body and note text now check the selected face's actual character coverage. A body-and-note Han-character regression verifies the existing visible `?` fallback and accurate warning count. This provides a warning; it does not add missing glyphs to the selected font. DOCX, EPUB and RTF retain the original Unicode text.
2. **PDF tabs could become `?` or an invisible missing glyph.** Tabs in both body and footnote text now expand to four spaces before wrapping. Both default and selected-font regressions require preserved spacing and no missing-character warning.
3. **RTF note numerals could ignore the selected font.** Actual LibreOffice import of the baseline selected-font RTF rendered note numerals in Liberation Serif while the text used DejaVu Serif. The Normal paragraph style now explicitly inherits the export's default font and size. Reimported output uses DejaVu Serif throughout; the regression locks this style inheritance and the twelve native notes.

Six new tests also cover every saved DOCX/EPUB paragraph and note, both EPUB link targets, double-digit references, all PDF drawn body/note text, bottom-note separation, long-note continuation and selected PDF font usage. Existing Book/font tests retain package, style and default-option coverage.

Validation passed:

- `npm test -- --reporter=dot`: **549 tests across 68 files**. Includes existing screenplay export, PDF presentation, FDX and font contracts, and the 100,575-word Book test (225 PDF pages).
- `npm run build:writeshape`: passed, including TypeScript checks.
- `npm run build`: passed for Fountain Publisher.
- EPUBCheck **4.2.6**: both EPUB files accepted using EPUB 3.2 rules, with zero errors and warnings.
- Calibre **7.6** desktop E-book viewer / QtWebEngine: **24 of 24 forward-note and return-link pairs** passed across the two EPUB variants. Actual reader popups and return navigation were exercised through its DOM; note text was compared in full and the returning reference checked within the visible viewport. The app ran offscreen in the test environment.
- LibreOfficeDev **26.8.0.0.alpha0**: both DOCX and RTF variants imported and rendered with native footnotes.

## Reproduce and remaining limits

From `beta/`:

```sh
npm ci
npm test -- --reporter=dot
node scripts/book-export-samples.mjs /absolute/path/to/book-samples
npm run build:writeshape
npm run build
epubcheck /absolute/path/to/book-samples/book-default.epub
epubcheck /absolute/path/to/book-samples/book-selected.epub
ebook-viewer --new-instance /absolute/path/to/book-samples/book-selected.epub
```

In the actual EPUB reader, open every reference 1–12, compare the note text, then activate its return link and verify the matching reference is revealed. Check the long note by scrolling the popup. Repeat with the default-font file. For RTF selected-font checks, install the generated `qa-fonts/*.ttf` on the disposable reader host first. Those host-font files are test setup, not embedded RTF assets.

The evidence package contains the eight exports, source Markdown/JSON, warning results, rendered-text/font audit, EPUBCheck logs, Calibre link/font results and reader screenshots. It contains synthetic content only.

Microsoft Word, Apple Books, Kindle, physical iOS/Android readers and reader edit/reimport round trips were not tested in this run. Fresh application Chromium/WebKit checks could not run locally because the browser download failed; prior browser acceptance is separate evidence. Calibre closes the previously missing actual EPUB-reader acceptance for that reader and version. Other reader compatibility remains unverified. No launch or provider-acceptance blocker is marked complete by these export tests.
