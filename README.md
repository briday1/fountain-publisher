# Fountain Publisher

[Write at fountain-publisher.com.](https://fountain-publisher.com)

Fountain Publisher is a screenplay editor built around a continuous, formatted writing surface. Scene headings, character cues, dialogue and transitions format naturally as you type. Screenplays save as portable `.fountain` files, including beat assignments, notes and title details in ignored Fountain comments.

The application lives in [`beta/`](beta/). That directory name is retained for repository continuity; `main` publishes it as the production application. Root commands and commands inside `beta/` use this same editor and PDF engine. The previous Python application, Screenplain renderer, and Python command-line compiler have been retired.

Every release includes third-party copyright notices and full license terms in `licenses.html` and `THIRD_PARTY_NOTICES.txt`, accessible through Help and cached with the installed app. These are part of the distributed application, independent of repository visibility. See [dependency licensing](beta/docs/third-party-licenses.md).

## Run locally

Use Node.js 22 or 24.

From the repository root:

```sh
npm ci
npm start
```

Open http://127.0.0.1:5174. Root `npm ci` (or `npm install`) installs the application using `beta/package-lock.json`; `npm start` builds the current source and serves it with the application's Express server. Use `PORT=4173 npm start` to keep the previous local port, or set `HOST` and `APP_ORIGIN` when using a different address. Optional server settings live in `beta/.env` and local server data lives in `beta/.data`. If you copy the development `.env.example`, update `APP_ORIGIN` to match the address you open when using `npm start`.

For development with live updates:

```sh
npm run dev
```

Open http://127.0.0.1:5173. Both modes use the production editor and PDF engine. Local writing, recovery, analysis, import and export work without accounts. Use File → Open to load a screenplay and the app's export commands to save Fountain, FDX, or PDF files. See [account integrations](beta/docs/integrations.md) for optional local OAuth setup and hosted collaboration requirements. Device-local drafts belong to their browser origin, so changing hostname or port opens a separate local workspace.

Commands inside `beta/` remain available for deployment and development. After `cd beta && npm ci`, use `npm run dev`, or `npm run build && npm start` for a built local app. Root `npm run build` writes that same local build to `beta/dist`; `npm run build:web` is a compatibility alias.

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

Run from the repository root:

```sh
npm test
npm run build
npm run test:browser
```

Install Chromium with `cd beta && npx playwright install chromium`, or set `PLAYWRIGHT_CHROME_PATH` to an installed Chrome binary. Root `npm run check` runs the unit/integration tests and local build. `npm run build:beta` selects the hosted API configuration used by production; the script name is retained for deployment compatibility.

For deployed checks:

```sh
TEST_BASE_URL=https://fountain-publisher.com npm run test:browser
```

Automated collaboration checks use real document synchronization over controlled provider boundaries. Real signed-in accounts, native IMEs and target devices still need acceptance testing; see the [release checks](beta/docs/release-checks.md) for the measured coverage.

## Deployment

Pushes to `main` run the application's unit/integration tests, browser suite and production build, then publish `beta/dist` to the existing GitHub Pages root. The workflow preserves `CNAME`, `.nojekyll`, and older assets still needed by open writing sessions. Pull requests run the same checks and keep a downloadable build artifact. The retired [beta.fountain-publisher.com](https://beta.fountain-publisher.com) address forwards to production.

The existing Cloudflare account service continues to own Google/GitHub OAuth and encrypted sessions. The `fountain-publisher-beta` Worker name and `/beta/api` URLs remain stable infrastructure identifiers for both app origins, preserving the existing live collaboration rooms. Worker changes are deployed separately from static builds; primary DNS and provider callback registrations stay in place.

See [deployment and rollback](beta/docs/beta-deployment.md) before changing those bindings, routes or room namespaces.

[Writing app notices](https://fountain-publisher.com/THIRD_PARTY_NOTICES.txt) are included in each build and cover the dependencies shipped with the current application.
