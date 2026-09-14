# Fountain Publisher

[Write at fountain-publisher.com.](https://fountain-publisher.com)

Fountain Publisher is a screenplay editor built around a continuous, formatted writing surface. Scene headings, character cues, dialogue and transitions format naturally as you type. Screenplays save as portable `.fountain` files, including beat assignments, notes and title details in ignored Fountain comments.

The current application lives in [`beta/`](beta/). That directory name is retained for repository continuity; `main` publishes it as the production application. The previous application and Python tools remain in the repository, while the production workflow builds the new editor.

## Run locally

Use Node.js 22 or 24.

```sh
cd beta
npm ci
npm run dev
```

Open http://127.0.0.1:5173. Local writing, recovery, analysis, import and export work without accounts. See [account integrations](beta/docs/integrations.md) for optional local OAuth setup.

## Write and publish

- One editor and undo history, native selection and spellcheck, character-name Tab completion, automatic screenplay elements, and find/replace.
- A scene outline, character dialogue grouped by scene, character analytics and Gantt charts, notes, and a beat sheet with precise line assignments and cumulative-word pacing.
- A compact toolbar, optional beat guide, six themes, responsive panels, native full screen, and Zen mode with a visible exit. Beat and dialogue navigation move the caret without selecting passages for replacement.
- A dashed title-page frame, Courier Prime typography, and PDF preview and export from the same pagination engine. Insights counts screenplay pages in eighths, excluding title pages.
- Fountain and Final Draft FDX import/export, character-highlighted PDFs, and device-local drafts, history and offline reopening.
- GitHub repository browsing and commits; Google Drive file and folder access, sharing and live collaboration through shared Fountain files.

Opening a Drive Fountain file starts a shared writing session. Send its `https://fountain-publisher.com/?drive=FILE_ID` link to someone who already has Drive access. Concurrent writing merges; each writer's Undo preserves the other writer's changes. Drive readers can follow along without editing. Saving checkpoints the shared screenplay into the original Fountain file with conflict checks.

More details: [writing tools and compatibility](beta/README.md), [integrations](beta/docs/integrations.md), and [release checks](beta/docs/release-checks.md).

## Validation

```sh
cd beta
npm test
npm run build:beta
npm run test:browser
```

Install Chromium with `npx playwright install chromium`, or set `PLAYWRIGHT_CHROME_PATH` to an installed Chrome binary. The `build:beta` name currently selects the shared hosted API configuration for both production and beta.

For deployed checks:

```sh
TEST_BASE_URL=https://fountain-publisher.com npm run test:browser
```

Automated collaboration checks use real document synchronization over controlled provider boundaries. Real signed-in accounts, native IMEs and target devices still need acceptance testing; see the [release checks](beta/docs/release-checks.md) for the measured coverage.

## Deployment

Pushes to `main` run the new application's unit/integration tests, browser suite and production build, then publish `beta/dist` to the existing GitHub Pages root. The workflow preserves preview directories, `CNAME`, `.nojekyll`, and older assets still needed by open writing sessions. Pull requests run the same checks and keep a downloadable build artifact. The live preview remains [beta.fountain-publisher.com](https://beta.fountain-publisher.com), published from `beta/writing-first`.

The existing Cloudflare account service continues to own Google/GitHub OAuth and encrypted sessions. The `fountain-publisher-beta` Worker name and `/beta/api` URLs remain stable infrastructure identifiers for both app origins, preserving the existing live collaboration rooms. Worker changes are deployed separately from static builds; primary DNS and provider callback registrations stay in place.

See [deployment and rollback](beta/docs/beta-deployment.md) before changing those bindings, routes or room namespaces.
