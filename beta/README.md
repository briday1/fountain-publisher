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
- Contextual scene headings, character/dialogue progression, Tab element cycling, and explicit element controls.
- Bold, italic, underline, native spellcheck, Unicode input, find/replace, undo/redo, and cross-paragraph clipboard operations.
- A scene outline; character dialogue, speech, scene-presence and timing statistics; locations; character notes; and story notes.
- Beat cards with acts, colors, descriptions, scene assignments, reordering, a 15-beat starting guide, pacing, PDF export, and CSV export.
- Title-page editing, six themes, responsive panels, keyboard panel resizing, focus mode, typewriter scrolling, zoom, Letter/A4, and scene numbering.
- Fountain import/export, Final Draft FDX export, formatted HTML, and independently compiled PDF pages. PDF fonts and composition run outside the editor's main thread.
- Device-local IndexedDB drafts and retained versions. Concurrent tabs use revision checks and independent recovery records. Saves do not load the document or reset undo.
- Installable app shell and offline loading after the first successful installation. Cloud requests are never cached by the service worker.

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
