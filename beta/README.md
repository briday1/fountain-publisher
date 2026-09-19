# Fountain Publisher

A fresh implementation of Fountain Publisher built around one continuous ProseMirror editor. The previous application supplied the product reference and existing cloud infrastructure; its editor and application implementation were not copied.

The application lives in the `beta/` directory of `briday1/fountain-publisher`. The directory name is retained for repository continuity: local development, the local production server, and `main` publishing at https://fountain-publisher.com all use this editor. The retired beta domain and historical preview entrypoints forward to production.

## Run locally

Use Node.js 22 or 24 (supported LTS releases).

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173. Writing, imports, local recovery, insights, beat sheets, and exports work without account setup. Local account connections use the optional server described in [integration setup](docs/integrations.md).

## Writing and story tools

- One native text selection and transaction history across the whole screenplay.
- Contextual scene headings, character/dialogue progression, character-name Tab completion, Tab element cycling, and explicit element controls.
- Bold, italic, underline, native spellcheck, Unicode input, find/replace, undo/redo, and cross-paragraph clipboard operations.
- A scene outline; character dialogue, speech, scene-presence and timing statistics; character notes; and story notes. Character Analytics restores the cast overview and scene/act Gantt charts alongside the full-dialogue browser. Dialogue is grouped under scene headings in script order. Clicking a line reveals and highlights it, with a collapsed writing caret so typing does not replace the passage; scrolling dialogs stays inside them.
- A connected beat sheet overlay with acts, colors, descriptions, precise line assignments, reordering, cumulative-word pacing, PDF export, and CSV export. Assign native text selections or enter line ranges; assignments follow edits and undo/redo. Navigating to an assignment highlights it without selecting it for replacement. Pacing counts story words before each beat's first assigned line. Legacy Fountain beat annotations are handled during import.
- One compact, responsive toolbar keeps preview as the writing surface. A simple optional beat guide shows the next beat above the canvas; Assign + Next binds selected lines and advances.
- Courier Prime screenplay typography and a compact dashed title-page frame on the writing canvas. Multiline title details and copyright remain editable without changing the active editor or undo history.
- Six themes, responsive panels, keyboard panel resizing, Zen mode with a visible Exit Zen control and Escape exit, native browser full screen, typewriter scrolling, zoom, Letter/A4, scene numbering, and optional bold scene headings.
- Fountain and Final Draft FDX import/export, character-highlighted PDF export, and independently compiled PDF pages. Insights measures occupied screenplay rows in the generated PDF, excluding title pages, rounded up to eighths (⅛, ¼, ½). It refreshes after writing settles; the eye button or View → PDF pages opens the full physical export over the canvas. PDF fonts and composition run outside the editor's main thread.
- Device-local IndexedDB drafts and retained versions. Ordinary drafts use revision checks and independent recovery records across tabs. Tabs for the same live Drive file and Google account share an incremental collaboration cache; refreshing their workspace snapshots does not cause a competing-tab conflict. Saves do not load the document or reset undo.
- Installable app shell and offline loading after the first successful installation. Cloud requests are never cached by the service worker.

PDF presentation follows the original application's twelve-point Courier Prime layout: a restrained centered title, date/contact lower-left, copyright centered, left-margin scene numbers, page numbering from the first screenplay page, and the original dialogue indents. Long fields and dialogue retain overflow and continuation protection.

The sample screenplay is editable example content. File → New screenplay starts a blank document.

## Writing together in Google Drive

Opening a Google Drive Fountain file starts live collaboration automatically. Share its link, `https://fountain-publisher.com/?drive=FILE_ID`, with another person who has Drive access. Main and beta use the same shared room for each file. The link opens the same screenplay; it does not grant permission. The live status shows connected writers, and their cursors appear in the editor.

Concurrent writing merges through structured document updates, and Undo reverses your own edits while preserving the other writer's work. Title-page details and beat cards travel with the shared document. A Drive reader can watch updates and save a copy, but cannot change the shared screenplay.

If the connection drops, writing continues on the device and merges after reconnecting. The live status reports connection or saving problems. Saving checkpoints the merged screenplay back into the Fountain file. If another editor changes that Drive file outside the shared room, synchronization pauses rather than overwriting the external version; keep a local Fountain copy while resolving the conflict. See [account integrations](docs/integrations.md) for permissions and the boundary with the original app.

## Fountain compatibility

The ordinary screenplay is serialized as Fountain, including explicit element markers when necessary to avoid ambiguous reclassification in other editors. Application metadata travels inside a standard ignored `/* ... */` comment, carrying stable paragraph IDs, beat cards, notes and exact style ranges. Opening and saving a document does not require a source view.

Externally edited screenplay text is authoritative; a stale embedded snapshot never replaces it. Original `FP-BEATS`, `FP-GENERAL`, and `FP-CHARACTER` annotations are imported into editable metadata and their original values retained. Unknown notes/comments remain recoverable.

## Deployment

See [deployment and rollback](docs/beta-deployment.md). Pushes to `main` test and build this app, publishing at the existing Pages root and refreshing the beta and historical preview redirects. The obsolete Python/Screenplain runtime is removed during publication; both service-worker migration URLs and current-app hashed assets remain available. There is no separate beta frontend release. Existing main-origin local drafts migrate into the new workspace without deleting their original cache. Beta-origin storage is retained but cannot be read from production; export beta-only drafts from an already-open beta session before closing it.

## Validation

```sh
npm test
npm run build:beta
npm run test:browser
```

For the browser suite, install Chromium with `npx playwright install chromium`, or set `PLAYWRIGHT_CHROME_PATH` to an installed Chrome binary. CI uses its installed Chrome when available. The suite launches an isolated temporary profile, never your personal browser profile.

Set `TEST_BASE_URL=https://fountain-publisher.com` to run against the deployed app, including offline recovery and the existing Google/GitHub authorization redirects. The beta URL works too. These checks do not sign into an account or save any cloud files.

Tests exercise real editor transactions, native browser typing/selection/undo, PDF compilation, Fountain round trips, storage failures, concurrent saves, stale requests, OAuth boundaries, and provider conflict handling. Collaboration browser tests use isolated contexts and real Yjs updates over mocked authenticated HTTP/WebSocket boundaries; signed-in Drive acceptance remains a separate check. Run `npm run check` for unit/integration tests plus a production build.

Automated tests do not establish all-device reliability. Real Google/GitHub acceptance with signed-in accounts, native Japanese/Chinese/Korean IMEs, Safari/iPad input, and sustained usage remain acceptance checks. See [release checks](docs/release-checks.md).
