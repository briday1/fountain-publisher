# Fountain Publisher — writing-first beta

A fresh implementation of Fountain Publisher built around one continuous ProseMirror editor. The previous application supplied the product reference and existing cloud infrastructure; its editor and application implementation were not copied.

The active integration branch is `beta/writing-first` in `briday1/fountain-publisher`. The new application lives in that branch's `beta/` directory. The original app remains at the repository root, and production `main` is unchanged.

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
- A scene outline; character dialogue, speech, scene-presence and timing statistics; character notes; and story notes. Character Analytics restores the cast overview and scene/act Gantt charts alongside the full-dialogue browser. Clicking a dialogue line selects and reveals that exact line; scrolling dialogs stays inside them.
- A connected beat sheet overlay with acts, colors, descriptions, precise line assignments, reordering, a 15-beat starting guide, cumulative-word pacing, PDF export, and CSV export. Assign native text selections or enter line ranges; assignments follow edits and undo/redo. Pacing counts story words before each beat's first assigned line. Older beta imports with scene-wide legacy ranges can restore their original assignments from the untouched Fountain file using the beat-sheet repair button.
- One compact, responsive toolbar keeps preview as the writing surface. A simple optional beat guide shows the next beat above the canvas; Assign + Next binds selected lines and advances.
- Courier Prime screenplay typography and a compact dashed title-page frame on the writing canvas. Multiline title details and copyright remain editable without changing the active editor or undo history.
- Six themes, responsive panels, keyboard panel resizing, Zen mode with a visible Exit Zen control and Escape exit, native browser full screen, typewriter scrolling, zoom, Letter/A4, scene numbering, and optional bold scene headings.
- Fountain and Final Draft FDX import/export, character-highlighted PDF export, and independently compiled PDF pages. The page counter measures occupied rows in the generated PDF, including its title page, rounded up to eighths (⅛, ¼, ½). It refreshes after writing settles; The eye button or View → PDF pages opens the full physical export over the canvas. PDF fonts and composition run outside the editor's main thread.
- Device-local IndexedDB drafts and retained versions. Concurrent tabs use revision checks and independent recovery records. Saves do not load the document or reset undo.
- Installable app shell and offline loading after the first successful installation. Cloud requests are never cached by the service worker.

PDF presentation follows the original application's twelve-point Courier Prime layout: a restrained centered title, date/contact lower-left, copyright centered, left-margin scene numbers, page numbering from the first screenplay page, and the original dialogue indents. Long fields and dialogue retain overflow and continuation protection.

The sample screenplay is editable example content. File → New screenplay starts a blank document.

## Fountain compatibility

The ordinary screenplay is serialized as Fountain, including explicit element markers when necessary to avoid ambiguous reclassification in other editors. Application metadata travels inside a standard ignored `/* ... */` comment, carrying stable paragraph IDs, beat cards, notes and exact style ranges. Opening and saving a document does not require a source view.

Externally edited screenplay text is authoritative; a stale embedded snapshot never replaces it. Original `FP-BEATS`, `FP-GENERAL`, and `FP-CHARACTER` annotations are imported into editable metadata and their original values retained. Unknown notes/comments remain recoverable.

## Beta deployment

See [deployment and rollback](docs/beta-deployment.md). Pushes to `beta/writing-first` test and build this app, update only `gh-pages/previews/beta`, and publish through the established Pages workflow. Cloudflare serves that path at https://beta.fountain-publisher.com.

## Validation

```sh
npm test
npm run build:beta
npm run test:browser
```

For the browser suite, install Chromium with `npx playwright install chromium`, or set `PLAYWRIGHT_CHROME_PATH` to an installed Chrome binary. CI uses its installed Chrome when available. The suite launches an isolated temporary profile, never your personal browser profile.

Set `TEST_BASE_URL=https://beta.fountain-publisher.com` to run against the deployed app, including offline recovery and the existing Google/GitHub authorization redirects. These checks do not sign into an account or save any cloud files.

Tests exercise real editor transactions, native browser typing/selection/undo, PDF compilation, Fountain round trips, storage failures, concurrent saves, stale requests, OAuth boundaries, and provider conflict handling. Run `npm run check` for unit/integration tests plus a production build.

This is a beta, not a claim that automated tests establish all-device production readiness. Real Google/GitHub acceptance with signed-in accounts, native Japanese/Chinese/Korean IMEs, Safari/iPad input, and sustained production usage remain release checks. See [release checks](docs/release-checks.md).
