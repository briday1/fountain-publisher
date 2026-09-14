# Release checks

Automated checks are evidence for the tested contracts, not a guarantee of an absence of defects.

Validated on 2026-09-14:

- All 167 contract tests, the production build, and 28 local native Chrome browser regressions passed. The browser suite covers title-page editing without undo resets, exact beat ranges, the writing guide, cumulative pacing, cast/scene/act analytics, individual dialogue navigation, fractional PDF-derived page counts, PNG exports, the single responsive toolbar, beat-sheet overlays, native full screen, Zen exits, and desktop/mobile layouts.
- Normal title/body pages and long title/contact/dialogue overflow were rendered and visually checked across eight PDF pages. Typesetting tests verify the original margins, type weights, scene indents, page numbers, and every overflow row.
- A 1,920-paragraph screenplay with Insights and 15 assigned beats measured 16.3 ms at the 95th percentile from native keydown to the next animation frame across 192 inputs on this development machine. The browser also verifies an untouched paragraph remains mounted. This is a local measurement, not an all-device latency guarantee.
- A 1,352-block screenplay with 450 character cues measured 15.8 ms typing and 16.7 ms popup frame intervals at the 95th percentile. Removing backdrop blur and blocking wheel/touch listeners reduced the same popup benchmark from 33.4 ms to 16.8 ms; background scroll containment still passes on desktop and mobile.
- Highlighted PDFs were visually inspected for two distinct cue colors, dual dialogue, and continuation pages. Highlights preserve the ordinary PDF's pagination and leave dialogue/action uncolored. The download name includes selected characters.
- Final Draft import covers styles, Unicode, UTF-16 byte-order marks, title pages, dual dialogue, notes and malformed input; imported files save as Fountain without writing over the source FDX.
- Google Picker file/folder/cancel/save interactions are tested against a mocked SDK and API. The real Google SDK and picker frame also load under the production CSP without violations using invalid test credentials; authenticated account browsing remains an acceptance check. Native picker access tokens are origin-checked and uncached.
- The supplied Cabin file imports 19 distinct line ranges and word positions. The existing-draft repair workflow restores original anchors from a matching source file without modifying screenplay text or notes.
- The primary site and API health endpoint remained available. The beta and primary authorization flows use the existing registered callback addresses.

The deployed suite also checks both provider authorization redirects, offline reload of saved writing, further offline edits, and PDF compilation without a connection. These checks use temporary browser profiles and do not sign into user accounts.

Repeat the deployed checks with:

```sh
TEST_BASE_URL=https://beta.fountain-publisher.com npm run test:browser
```

Set `PLAYWRIGHT_CHROME_PATH` if using an installed Chrome instead of Playwright's Chromium. Local development runs skip the two deployment-only checks.

Covered by executable tests:

- Single editor DOM ownership, automatic formatting, multiblock editing, marks, clipboard identity, undo/redo, and composition deferral.
- Native Chrome typing, selection replacement before `selectionchange`, Unicode deletion, find/replace, view changes, reload recovery, PDF generation, and mobile layout.
- Exact beat line ranges, original-source range migration, cumulative-word interpolation, assignment deletion, keyboard reordering, writing-guide advancement, saved beat details, and PNG export. Character chart word positions and dialogue-line counts include speech around omitted text and lyrics.
- A 3,000-block editor regression with 15 assigned beats verifies 100 keystrokes preserve unaffected paragraph DOM nodes and do not request document snapshots. Beat anchors follow splits, joins, earlier edits, and undo/redo without becoming part of the rendered document.
- PDF page usage comes from actual occupied rows and rounds up to eighths. Fractional values are checked alongside downloaded physical page counts, including empty documents, title pages, explicit breaks, continued/dual dialogue, and Letter/A4 geometry.
- Full screen exercises the browser API. Zen retains the same editor, offers a visible exit, preserves active full screen when exited, and closes a dialog or search before Escape exits Zen. Long paragraphs retain the same selection and a visible caret after reflow; pointer full-screen entry and exit retain writing focus. Nested pacing/beat-sheet dialogs close one at a time and retain scroll containment.
- Clicking individual dialogue lines selects and reveals the exact text on desktop/mobile. Scrolling dialog content at its boundaries or scrolling the backdrop leaves the underlying page still.
- Every Fountain element, styles, external edits, metadata, legacy notes/beats, inline annotations, PDF bytes/page count, FDX/XML escaping and CSV formula neutralization.
- IndexedDB version checks, quota/availability errors, independent tab recovery, save acknowledgments and stale open/fork boundaries.
- Opaque encrypted local sessions, OAuth state/PKCE, CSRF, GitHub SHA checks, conditional Drive saves, and beta callback pass-through.
- Offline releases cache matching HTML and assets together. Mutable HTML/service-worker responses bypass stale CDN caches; failed installations cannot leave a partial cache advertised as complete.

Before graduating beta to production:

1. Use a nonproduction file to connect each real provider, open, save, reopen, change branches/folders, and deliberately create a concurrent remote version. Verify the saved text and conflict recovery, not only the status indicator.
2. Check Google shared-reader/writer permissions and revision downloads with two accounts. The hosted authorization scope only includes files authorized for the existing app.
3. Test Japanese, Chinese and Korean native IMEs; accent dead keys; autocorrection; emoji/combining-character deletion; drag/drop; touch selection; and platform editing menus in Safari, Chrome, Firefox and iPad.
4. Test long scripts and offline reopening on target devices with realistic notes and beat sheets. Recovery must survive a failed remote save and a second tab editing the same local draft.
5. Inspect dialogue continuation, dual dialogue, long title/contact fields and non-Latin font warnings in representative PDFs. Fountain and FDX preserve all text; Courier Prime's PDF glyph coverage is limited.
6. Design and validate structured-document collaboration before enabling live multiwriter rooms. It is deliberately unavailable in this beta.

PDF import/reconstruction, regex search, the old animated background effects, and live collaboration are not included in this first beta. Source and Vim modes were intentionally removed. Native browser spellcheck replaces the old custom spelling subsystem.
