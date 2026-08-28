# Fountain Publisher

[Open the live app at fountain-publisher.com.](https://fountain-publisher.com)

A source-first Fountain screenplay studio with a Pugflow-style application shell: collapsible and resizable panels, persistent light/dark themes, native file handling, contextual completion, a directly editable published screenplay, exact PDF preview, and production statistics.

The browser and local Python apps use [Screenplain](https://github.com/vilcans/screenplain) 0.12.0 as the authoritative Fountain parser and PDF/Final Draft compiler. The browser runs it in Python/WebAssembly. Both paths pin ReportLab 5.0.1, bundle Courier Prime, and apply the same PDF settings for consistent output.

The live site is the complete browser application, including editing, live and PDF preview, file handling, insights, themes, documentation, and PDF/FDX export. The optional local Python application and CLI use the same Screenplain compiler.

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
- **Open from GitHub** browses repositories, branches, and Fountain files available to a user-supplied fine-grained personal access token. A GitHub-backed document remembers its owner, repository, branch, path, and blob SHA; regular Save creates a commit while Save As remains available for a local copy.
- **Save to GitHub As** selects a repository/branch and destination path. If a file changed remotely, reload it or preserve the draft on a new branch and open a pull request. Protected branches use the same branch-and-PR fallback.
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

## GitHub integration on GoDaddy

The editor and GitHub API operations remain browser-based. On GoDaddy Linux hosting, two small PHP endpoints provide the normal **Sign in with GitHub** popup and exchange the temporary OAuth code without exposing the GitHub client secret. The built site includes these endpoints under `auth/github/`.

Create a GitHub OAuth App with:

- **Homepage URL:** `https://fountain-publisher.com`
- **Authorization callback URL:** `https://fountain-publisher.com/auth/github/callback.php`

Place `fountain-publisher-oauth.php` one directory above GoDaddy's document root (normally alongside `public_html`, not inside it):

```php
<?php
return [
    'client_id' => 'your OAuth app client ID',
    'client_secret' => 'your OAuth app client secret',
    'callback_url' => 'https://fountain-publisher.com/auth/github/callback.php',
];
```

Never commit or upload that configuration inside the public web root. The PHP hosting account needs the cURL and session extensions, which are normally enabled on GoDaddy Linux shared hosting. Upload the contents of `dist/web` after running `npm run build:web`.

OAuth authorization requests repository access. For finer repository selection, users can expand **Use an access token instead**, paste a [fine-grained personal access token](https://github.com/settings/personal-access-tokens/new), restrict it to intended repositories, and grant:

- **Contents: Read and write** to browse and commit files and create branches.
- **Pull requests: Read and write** to create the protected-branch fallback pull request.
- **Metadata: Read-only** (included automatically).

The token is held in memory and `sessionStorage` only. It is never written to `localStorage`, the workspace recovery record, a file, or the repository, and **Forget token** removes it immediately. Session storage lasts for the current tab session, so close the tab to discard it. Treat any token used in a browser as accessible to scripts running on that origin; keep the site free of untrusted scripts and use the narrowest repository access and expiration possible.

The current GitHub file identity (but never its token) is included in local workspace recovery. The Contents API uses the remembered blob SHA for optimistic concurrency; stale saves offer reload or a new branch/pull request, and protected-branch failures offer the branch/pull-request path automatically. The CSP permits network access only to GitHub's REST API.
