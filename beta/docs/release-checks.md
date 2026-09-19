# Release checks

Automated checks are evidence for the tested contracts, not a guarantee of an absence of defects.

Baseline validation on 2026-09-14 (rerun the commands below for the current release, including the new collaboration checks):

- All 167 contract tests, the production build, and 28 local native Chrome browser regressions passed. The browser suite covers title-page editing without undo resets, exact beat ranges, the writing guide, cumulative pacing, cast/scene/act analytics, individual dialogue navigation, fractional PDF-derived page counts, PNG exports, the single responsive toolbar, beat-sheet overlays, native full screen, Zen exits, and desktop/mobile layouts.
- Normal title/body pages and long title/contact/dialogue overflow were rendered and visually checked across eight PDF pages. Typesetting tests verify the original margins, type weights, scene indents, page numbers, and every overflow row.
- A 1,920-paragraph screenplay with Insights and 15 assigned beats measured 16.3 ms at the 95th percentile from native keydown to the next animation frame across 192 inputs on this development machine. The browser also verifies an untouched paragraph remains mounted. This is a local measurement, not an all-device latency guarantee.
- A 1,352-block screenplay with 450 character cues measured 15.8 ms typing and 16.7 ms popup frame intervals at the 95th percentile. Removing backdrop blur and blocking wheel/touch listeners reduced the same popup benchmark from 33.4 ms to 16.8 ms; background scroll containment still passes on desktop and mobile.
- A 1,304-paragraph live shared screenplay measured 16.7 ms input-to-paint latency at the 95th percentile across 201 native inputs while a second browser received real Yjs updates. Both editor nodes and untouched paragraphs stayed mounted. The transport was mocked locally; signed-in network acceptance and measurements on other devices remain separate checks.
- Highlighted PDFs were visually inspected for two distinct cue colors, dual dialogue, and continuation pages. Highlights preserve the ordinary PDF's pagination and leave dialogue/action uncolored. The download name includes selected characters.
- Final Draft import covers styles, Unicode, UTF-16 byte-order marks, title pages, dual dialogue, notes and malformed input; imported files save as Fountain without writing over the source FDX.
- Google Picker file/folder/cancel/save interactions are tested against a mocked SDK and API. The real Google SDK and picker frame also load under the production CSP without violations using invalid test credentials; authenticated account browsing remains an acceptance check. Native picker access tokens are origin-checked and uncached.
- The supplied Cabin file imports 19 distinct line ranges and word positions. Legacy beat annotations are handled during Fountain import.
- The primary site and API health endpoint remained available. The beta and primary authorization flows use the existing registered callback addresses.

The deployed suite also checks both provider authorization redirects, offline reload of saved writing, further offline edits, and PDF compilation without a connection. These checks use temporary browser profiles and do not sign into user accounts.

Repeat the deployed checks with:

```sh
TEST_BASE_URL=https://fountain-publisher.com npm run test:browser
```

Set `PLAYWRIGHT_CHROME_PATH` if using an installed Chrome instead of Playwright's Chromium. Local development runs skip the two deployment-only checks.

Covered by executable tests:

- Single editor DOM ownership, automatic formatting, multiblock editing, marks, clipboard identity, undo/redo, and composition deferral.
- Native Chrome typing, selection replacement before `selectionchange`, Unicode deletion, find/replace, view changes, reload recovery, PDF generation, and mobile layout.
- Exact beat line ranges, legacy Fountain range imports, cumulative-word interpolation, assignment deletion, keyboard reordering, writing-guide advancement, saved beat details, and PNG export. Character chart word positions and dialogue-line counts include speech around omitted text and lyrics.
- A 3,000-block editor regression with 15 assigned beats verifies 100 keystrokes preserve unaffected paragraph DOM nodes and do not request document snapshots. Beat anchors follow splits, joins, earlier edits, and undo/redo without becoming part of the rendered document.
- PDF page usage comes from actual occupied rows and rounds up to eighths. Fractional values are checked alongside downloaded physical page counts, including empty documents, title-page exclusion in Insights, explicit breaks, continued/dual dialogue, and Letter/A4 geometry.
- Full screen exercises the browser API. Zen retains the same editor, offers a visible exit, preserves active full screen when exited, and closes a dialog or search before Escape exits Zen. Long paragraphs retain the same selection and a visible caret after reflow; pointer full-screen entry and exit retain writing focus. Nested pacing/beat-sheet dialogs close one at a time and retain scroll containment.
- Character dialogue is grouped in script order under scene headings, including repeated headings and dialogue before the first scene. Navigation highlights the exact line and leaves a collapsed caret; immediate typing does not replace the passage. Scrolling dialog content at its boundaries or scrolling the backdrop leaves the underlying page still.
- Every Fountain element, styles, external edits, metadata, legacy notes/beats, inline annotations, PDF bytes/page count, FDX/XML escaping and CSV formula neutralization.
- IndexedDB version checks, quota/availability errors, independent tab recovery, save acknowledgments and stale open/fork boundaries. Only live snapshots for the same Google account and Drive file may bypass a stale workspace revision; ordinary drafts and mismatched accounts/files still conflict.
- Two isolated browser contexts share real Yjs updates through mocked HTTP/WebSocket boundaries. Scenarios cover concurrent edits, local undo preserving the other author's changes, cursor presence excluded from exports, offline reconnect merges, view-only access, and synchronized title/beat metadata. Offline reload renders the durable CRDT before a stale workspace snapshot, and two title forms retain independent field edits. Signed-in Google acceptance is separate from this browser transport test.
- Opaque encrypted local sessions, OAuth state/PKCE, CSRF, GitHub SHA checks, conditional Drive saves, and beta callback pass-through.
- Offline releases cache matching HTML and assets together. Mutable HTML/service-worker responses bypass stale CDN caches; failed installations cannot leave a partial cache advertised as complete.

Manual acceptance checks:

1. Use a nonproduction file to connect each real provider, open, save, reopen, change branches/folders, and deliberately create a concurrent remote version. Verify the saved text and conflict recovery, not only the status indicator.
2. Check Google shared-reader/writer permissions and revision downloads with two accounts. Full Drive browsing requires the granted full Drive scope; older limited sessions keep their existing authorized-file access until reconnecting.
3. Test Japanese, Chinese and Korean native IMEs; accent dead keys; autocorrection; emoji/combining-character deletion; drag/drop; touch selection; and platform editing menus in Safari, Chrome, Firefox and iPad.
4. Test long scripts and offline reopening on target devices with realistic notes and beat sheets. Recovery must survive a failed remote save and a second tab editing the same local draft.
5. Inspect dialogue continuation, dual dialogue, long title/contact fields and non-Latin font warnings in representative PDFs. Fountain and FDX preserve all text; Courier Prime's PDF glyph coverage is limited.
6. Open one Drive Fountain file from two Google accounts using its sharing link. Verify simultaneous edits, local undo, title/beat changes, writer presence, view-only permissions, disconnection/reconnection, and a second tab on the same account. Change the Drive file outside the shared room and confirm collaboration pauses without overwriting either version; save a local recovery copy before resolving the conflict.

PDF import/reconstruction and regex search are not included in this application. Animated dots, topographic contours and hyperspace are implemented by the current app, with reduced-motion support. Source and Vim modes were intentionally removed. Native browser spellcheck replaces the old custom spelling subsystem.
