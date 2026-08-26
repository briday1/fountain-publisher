# Fountain Publisher

A source-first Fountain screenplay studio with a Pugflow-style application shell: collapsible and resizable panels, persistent light/dark themes, native file handling, contextual completion, a directly editable published screenplay, exact PDF preview, and production statistics.

The browser app compiles Fountain to HTML, PDF, and Final Draft FDX entirely in JavaScript, so the complete studio works on static hosting. The optional Python app and CLI provide a Screenplain-backed compilation path for local workflows.

The GitHub Pages demo is the complete browser application, including editing, live and PDF preview, file handling, insights, themes, documentation, and PDF/HTML/FDX export. The optional local Python application and CLI use Screenplain as their compiler.

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
fountain-publisher screenplay.fountain --format html --output screenplay.html
fountain-publisher screenplay.fountain --format fdx --output screenplay.fdx
fountain-publisher screenplay.fountain --page-size a4 --output screenplay.pdf
```

## Editor workflow

- **File** supports New, Open, Save, Save As, PDF, HTML, and Final Draft export.
- Save overwrites the open file where the browser's File System Access API is available; other browsers download safely.
- Source and Insights panels collapse, resize with mouse or keyboard, and remember their layout.
- Theme follows the system until explicitly set to light or dark.
- Use Ctrl/Command+Space for contextual title-page, character, scene, location, time-of-day, and transition completion.
- Edit either the Fountain source or a line on the published screenplay page.
- The live page is optimized for editing. Switch to **PDF** for exact output from the same compiler used by export.
- Insights show scene count, estimated pages/runtime, dialogue/action balance, locations, and per-character dialogue lines, words, scenes, and speaking duration.

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
