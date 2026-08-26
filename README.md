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
