# Fountain Publisher

[Open the live app at fountain-publisher.com.](https://fountain-publisher.com)

A source-first Fountain screenplay studio with a Pugflow-style application shell: collapsible and resizable panels, persistent light/dark themes, native file handling, contextual completion, a directly editable published screenplay, exact PDF preview, and production statistics.

The browser and local Python apps use [Screenplain](https://github.com/vilcans/screenplain) 0.12.0 as the authoritative Fountain parser and PDF/Final Draft compiler. The browser runs it in Python/WebAssembly. Both paths pin ReportLab 5.0.1, bundle Courier Prime, and apply the same PDF settings for consistent output.

The live site is the complete browser application, including editing, live and PDF preview, file handling, insights, themes, documentation, and PDF/FDX export. The optional local Python application and CLI use the same Screenplain compiler.

## GitHub integration

Fountain Publisher can connect to a user's GitHub account, browse repositories selected during GitHub App installation, open `.fountain` files, and save changes as ordinary commits. The static editor never receives a GitHub client secret or access token. A small Cloudflare Worker at `api.fountain-publisher.com` owns the OAuth exchange, stores encrypted credentials behind opaque sessions in D1, and calls GitHub's API.

### 1. Create the GitHub App

In GitHub **Settings → Developer settings → GitHub Apps**, create an app with:

- Homepage URL: `https://fountain-publisher.com`
- Callback URL: `https://api.fountain-publisher.com/auth/github/callback`
- Setup URL: `https://api.fountain-publisher.com/auth/github/installed`
- Request user authorization during installation: disabled (Fountain Publisher starts OAuth separately)
- Webhooks: disabled
- Repository permissions: **Contents — Read and write** (Metadata read access is automatic)
- Installation target: any account, with users choosing all or selected repositories

Record the app's Client ID and Client secret and use its URL slug as `GITHUB_APP_SLUG`. No private key is required because the Worker uses GitHub App user access tokens rather than installation tokens.

### 2. Create D1 and configure the Worker

```bash
cd github-worker
npm install
npx wrangler login
npx wrangler d1 create fountain-publisher-github
```

Copy the returned database ID into `github-worker/wrangler.jsonc`, replacing `REPLACE_WITH_CLOUDFLARE_D1_DATABASE_ID`, then create the tables:

```bash
npm run db:remote
```

Add the production secrets interactively. They are stored by Cloudflare and must never be committed:

```bash
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
npx wrangler secret put GITHUB_APP_SLUG
npx wrangler secret put TOKEN_ENCRYPTION_KEY
```

Generate the encryption value locally with `openssl rand -base64 32` and paste that output when Wrangler prompts for `TOKEN_ENCRYPTION_KEY`. Keep it with the other deployment secrets: changing or losing it invalidates existing GitHub sessions.

For local Worker development, copy `.dev.vars.example` to `.dev.vars`, fill in test credentials, and run `npm run db:local` followed by `npm run dev`. `.dev.vars` and Wrangler's local state are ignored by Git.

### 3. Deploy

After the `fountain-publisher.com` zone is active in Cloudflare, deploy from `github-worker`:

```bash
npm run deploy
```

The `custom_domain` route in `wrangler.jsonc` creates `api.fountain-publisher.com` and its certificate. Do not manually create an `api` DNS record first. Confirm `https://api.fountain-publisher.com/health` returns `{"ok":true}`.

The existing GitHub Pages workflow remains responsible for the static site. Cloudflare's optional Workers and Pages GitHub installation can later automate Worker deployments, but is not required.

### Security and operating notes

- Sessions are opaque, `HttpOnly`, `Secure`, and `SameSite=Lax`; GitHub tokens stay in D1 encrypted with AES-256-GCM.
- OAuth state values are single-use, expire after ten minutes, and are bound to the browser that initiated authorization.
- CORS permits credentialed API calls only from `https://fountain-publisher.com`.
- OAuth and API endpoints have per-client fixed-window rate limits; only a hash of the client address is stored for throttling.
- Repository access is the intersection of the signed-in user's access, the GitHub App's Contents permission, and the repositories selected during installation.
- Saving uses GitHub's content SHA for conflict detection. A stale file fails instead of silently replacing a newer commit.
- Expiring GitHub user tokens are refreshed server-side when GitHub supplies a refresh token.
- A daily Worker schedule deletes expired sessions, OAuth state, and rate-limit records; requests also trigger occasional cleanup as a fallback.

Migration `0002_security_hardening.sql` removes sessions created before encryption, so users reconnect once after it is deployed. Apply migrations before deploying the updated Worker.

## Install and run

Use Python 3.9 or newer:

```shell
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -e .
fountain-publisher
```

The application opens at <http://127.0.0.1:4173>. Other useful forms:

```shell
fountain-publisher screenplay.fountain
fountain-publisher --no-browser --port 8080
python -m fountain_publisher
```

The existing `npm start` shortcut also starts the Python application when package dependencies are installed.

## Compile from the command line

Providing `--output` enables headless compilation:

```shell
fountain-publisher screenplay.fountain --output screenplay.pdf
fountain-publisher screenplay.fountain --format fdx --output screenplay.fdx
fountain-publisher screenplay.fountain --page-size a4 --output screenplay.pdf
```

## Editor workflow

- **File** supports New, Open, Save, Save As, PDF, and Final Draft export.
- Save overwrites the open file where the browser's File System Access API is available; other browsers download safely.
- Source and Insights panels collapse, resize with mouse or keyboard, and remember their layout.
- Theme follows the system until explicitly set to light or dark.
- Use Ctrl/Command+Space for contextual title-page, character, scene, location, time-of-day, and transition completion.
- Source word wrap is enabled by default; wrapped continuations remain part of the same numbered Fountain line.
- Edit either the Fountain source or a line on the published screenplay page.
- The live page is optimized for editing. Switch to **PDF** for exact output from the same compiler used by export.
- Insights show scene count, compiled PDF pages, runtime at one minute per page, dialogue/action balance, locations, and per-character dialogue lines, words, scenes, and speaking duration.
- On supported mobile browsers, PDF and Final Draft exports open the system share sheet; other browsers download the file.
- A blank document shows a **Blank page** overlay with helper buttons — **Add title page** (opens a form to fill in Title, Credit, Author, Draft date, and Contact), **Add scene**, **Add dialogue**, and **Add direction** — that insert formatted Fountain snippets. You can also just start typing in Source and Fountain formats automatically.
- The **Documentation** shortcuts table shows only the shortcuts for your operating system (macOS or Windows/Linux).
- Scene numbers appear in the left margin by default. Use **Settings → Scene Numbers** to change the placement (Margin/Inline/Off) or format (Sequential 1 2 3 vs Act-prefixed A1S1 A1S2). Act prefixes are derived from top-level `# Act` section headings. Both the live preview and exported PDF respect these settings.

## App-style installation

The published site is an installable web app. On iPad, open it in Safari and choose **Share → Add to Home Screen** to launch Fountain Publisher in its own standalone window. Supporting desktop browsers expose **View → Install app**, and **View → Enter full screen** is available without installing. The installed app keeps the same private local workspace recovery behavior as the website.

## Tests

```shell
node --test tests/js/*.test.mjs
PYTHONPATH=src python -m unittest discover -s tests -v
```

## Architecture

```text
src/fountain_publisher/
	cli.py          command-line entry point
	compiler.py     Screenplain compilation and line-aware statistics
	server.py       loopback HTTP server and compile/export API
	web/            dependency-free browser application
```

The server binds to loopback by default, limits compile request size, serves no arbitrary filesystem paths, and sends restrictive browser security headers.

## Licensing

Fountain Publisher includes open-source dependencies. Their licenses and required attributions are collected in [Third-party notices](src/fountain_publisher/web/THIRD_PARTY_NOTICES.md).
