# Find, replace, and Vim commands

Search always covers the **entire open screenplay**, including title fields,
notes, and Fountain markup. It does not search other files in Drive, GitHub,
or the local filesystem. Search runs locally; no query or screenplay is sent
to a search service.

## Find and replace

Use Edit → Find (`Ctrl/Cmd+F`) or Edit → Replace (`Ctrl+H`, or `Option+Cmd+F`
on macOS). `Cmd+H` also works where the browser permits it; macOS may reserve
that shortcut for hiding the application.

- Enter, F3, or Ctrl/Cmd+G finds the next match. Shift reverses direction.
- Match case, Whole word, and Regex are optional. Ordinary search and replacement
  are literal; regex replacement supports JavaScript captures such as `$1`,
  `$<name>`, and `$&`.
- Replace changes the selected match; Replace all changes every match in one
  undoable action. Enter in the replacement field replaces one match. Shift+Enter
  or a multiline paste inserts literal newlines into the replacement field.
- Escape closes Find and returns focus to the editor.

Visible matches are selected in Preview. Matches hidden by formatting are
revealed in Source, with an explanatory status message. View-only documents
can be searched, but cannot be changed. A document change invalidates pending
results and replacement plans; it never silently reuses stale coordinates.

## Vim mode

In Normal or Visual mode, `/` searches forward and `?` searches backward.
Enter submits the pattern; an empty pattern repeats the last Vim search.
`n` repeats in the original direction and `N` reverses it. Escape cancels the
prompt and restores the entry selection. Arrow Up/Down recalls command history
for that kind of prompt. History is local to this open document and is not saved.

`:` opens the command line. In Visual mode it prepopulates `'<,'>` to limit a
substitution to the selected lines.

| Command | Behavior |
| --- | --- |
| `:s/old/new/` | Replace the first match on the current line. |
| `:%s/old/new/g` | Replace every match throughout the screenplay. |
| `:3,12s/old/new/gi` | Replace all matches on lines 3–12, ignoring case. |
| `:'<,'>s/old/new/g` | Replace within the selected visual lines. |
| `:%s/pattern//gn` | Count matches without changing the document. |
| `:grep /pattern/` or `:vimgrep /pattern/` | List matching lines in this screenplay. |
| `:g/pattern/p` | List matching lines, optionally within a line range. |
| `:v/pattern/p` | List nonmatching lines. |
| `:copen`, `:cclose` | Show or hide the last results list. |
| `:cnext`, `:cprev`, `:cfirst`, `:clast` | Navigate the results. |
| `:42`, `:$` | Go to a line or the last line. |

Substitution accepts alternate delimiters, for example `:%s#old/path#new/path#g`.
Escape a delimiter with a backslash. Addresses include numbers, `.`, `$`, visual
marks, offsets such as `.+2`, and comma/semicolon ranges. Substitution flags are
`g` (all per line), `i` (ignore case), `I` (case sensitive), and `n` (count only).
The replacement uses Vim-style `&` for the whole match, `\1`–`\9` for captures,
`\r` for a newline, and `\t` for a tab. An empty substitute pattern reuses the
last search pattern. Confirmation flag `c` is intentionally rejected: use the
Find/Replace dock to review matches individually.

This is a documented subset, **not a complete Vim/Ex interpreter**. Patterns use
JavaScript Unicode regular expressions with multiline anchors, not Vim's regex
dialect; `\<` and `\>` word boundaries are also accepted in Vim prompts/commands.
No shell execution, filesystem grep, command pipelines, or destructive `:g`
commands are supported. Unsupported commands and flags produce an error.

The results list renders at most 100 rows at a time; quickfix navigation can
traverse all results. Editing the document invalidates the list; run grep again
to refresh its positions.

## Reliability and performance boundaries

- Search/Ex evaluation runs in a disposable dedicated worker, not on the UI
  thread. An execution exceeding one second is terminated and can be retried
  with a simpler pattern. Worker startup has a separate five-second limit.
- Documents/output are bounded to eight million UTF-16 units, queries to 16,384,
  replacement templates to 65,536, and Ex commands to 100,000. More than 10,000
  matches fails explicitly. These limits never apply a partial replacement.
- Replacement plans are checked against document identity, edit revision, exact
  text, composition state, and write permission immediately before application.
- Live replacements use one sparse Yjs transaction. Unchanged text identities,
  other collaborators' changes, and relative cursor anchors are preserved.
- Local replacements have exact undo/redo, including source-backed metadata;
  beat assignments are rebased per changed line interval.
- The build and offline app shell include the worker and its dependencies.

Automated coverage includes real Yjs concurrency/undo, stale async responses,
read-only/IME guards, Unicode boundaries, zero-width matches, replacement limits,
command parsing, focus ownership, and a real worker pathological-regex timeout.
Native browser visual/interaction verification still needs to be performed on
the deployed preview; controlled DOM tests are not a substitute for that check.
