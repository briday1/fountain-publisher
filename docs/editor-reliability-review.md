# Editor reliability review — September 2026

Scope: the merged app at `338fb09`, followed by the first bounded hardening pass
on `fix/editor-reliability`. Preserve the visual design. Treat Preview and Source
as two views of one text editor, not independent sources of truth.

This is a code review with executable regression reproductions, **not** a
certification that the editor is production-ready. No browser was connected to
the review session. Native selection, composition, touch behavior and visual
layout still require real-browser/device verification. Encryption is out of scope.

## Fixed in this pass

| Failure | Cause / changed behavior | Regression coverage |
| --- | --- | --- |
| New/GitHub document text could be sent into the previous Drive room | `setDocument` now tears down collaboration before replacing source; open/import callers no longer own separate teardown rules | `editor_lifecycle.test.mjs` |
| Save discarded undo history and mislabeled in-flight edits as saved | Local save acknowledges the captured content without loading a new document. Local/Drive save results are bound to document identity; cancelled/failed Save As preserves the old handle | `editor_lifecycle.test.mjs` |
| Slow local/Drive open could replace newer editing | Match the existing GitHub open revision check; stale opens fail without replacing source | `editor_lifecycle.test.mjs` |
| Old sockets/checkpoints affected a newly opened document | Socket callbacks and checkpoint results are bound to their originating document/session | `editor_collaboration.test.mjs` |
| Typing before initial collaboration sync duplicated the original text | Queue pending edits until the baseline arrives; replay only against the known loaded baseline. If the room diverged, pause sync and preserve the local text for recovery instead of overwriting either side | `editor_collaboration.test.mjs` |
| Collaborator names became screenplay text | Presence markers are empty, noneditable decorations; labels use CSS-generated text | `editor_preview.test.mjs` |
| Shift+vertical-arrow selection collapsed at Preview paragraph boundaries | Custom vertical navigation now handles only unmodified arrows; composing key events bypass it | `editor_preview.test.mjs` |
| Lowercase action text offered character-name completion | Check original casing before normalizing suggestions; retain explicit character cues | `editor_preview.test.mjs` |
| Visible/source positions disagreed around forced action and one-character emphasis | Preserve the hidden `!` prefix and align one-character markup recognition with current rendering | `editor_preview.test.mjs` |
| Vim word operators were unreachable / `w` moved one character | Dispatch pending operators before standalone commands; find word boundaries in the original string | `editor_vim.test.mjs` |

Removed `previewValueToSource` only after confirming it had no callers. It
duplicated part of the active mapping path. This is a targeted cleanup, not a
claim that every remaining function is needed or every duplicate is eliminated.

## Remaining release risks, in priority order

### 1. Collaboration does not yet meet a reliable editing contract

These are document-integrity issues, not cosmetic issues:

- **Offline edits are not retransmitted on reconnect.** A deterministic test of
  the old/current reconnect protocol leaves a client with its offline text and
  the server with the prior text; no missing update is sent. Initial-sync queuing
  in this pass does not solve reconnect synchronization. Add bidirectional Yjs
  state-vector synchronization, acknowledgments/retries and bounded large-update
  transport before calling offline collaboration supported.
- **Undo includes other people's changes.** `onDocument` records remote updates
  in the same snapshot history as local edits; `restoreHistory` replaces the
  whole source and republishes it. Use local-origin transaction-aware undo. Just
  disabling history recording for remote updates is insufficient: old local
  snapshots would still remove intervening remote work.
- **Remote updates destroy Preview DOM selection.** The callback preserves only
  textarea offsets before rerendering the sheet. Track selection in document
  positions (CRDT-relative positions for collaboration), then restore it in the
  correct surface without stealing focus. Numeric offsets alone do not survive
  insertions before the caret.
- **Drive checkpoints and room state need one consistency policy.** A saved
  plain-text file and an existing Yjs room can disagree. Checkpoint ordering,
  failures, external Drive edits and stale rooms must not silently choose a loser.

Acceptance: two clients edit online/offline, reconnect repeatedly, and undo their
own edits without losing the other's work; both clients and the reopened Drive
file converge. Include large pastes, role revocation and failed checkpoints.

### 2. Native text-input lifecycle is not fully owned

`insertCompositionText` reaches the Preview `input` handler, which calls
`syncPreviewLine`; that rewrites `innerHTML` and moves the caret while an IME may
still own the DOM. The new composing **keydown** guard does not solve this.
Preview deletions also operate on JavaScript string offsets, not grapheme
boundaries. One Backspace can split emoji/surrogate pairs or combining sequences.
Word/line deletion input types need distinct semantics, not a shared one-character
deletion fallback. Native browser undo/menu input events need the same deliberate
ownership as toolbar and keyboard shortcuts.

Acceptance: Japanese/Chinese/Korean composition and accented-character input
commit/cancel correctly on Chrome, Firefox, Safari and iPad; no rerender replaces
the active composition. Emoji/combining text delete as user-perceived characters.
Test cut, paste, drop, autocorrection, replacement, line deletion and undo by
actual browser input events, not only direct helper calls.

### 3. Read-only must guard every editing command

`source.readOnly` prevents native typing, but does not prevent scripted
`setRangeText` or direct `source.value` assignment. Tab, paste, Vim and context
actions can still modify a view-only document's local buffer. The new Drive save
guard is not a general solution and is not a claim of a backend permission bypass.

Acceptance: a shared viewer can select, copy and navigate, but no command changes
source, history or dirty state. Mutation permissions should be checked once at
the document-command boundary, with transport enforcement as a separate layer.

### 4. Formatting needs a shared representation and predictable UX

Rendering, inline source maps, active formatting markers and line classification
have separate recognition rules. The one-character fixes align specific cases;
they do not solve nested/escaped markup or all Fountain round-trips. Preview
currently has both intercepted edits and native-DOM reconciliation paths.

Adopt these user-visible rules before adding more heuristics:

- Typing changes exactly the intended range. Styling is a view of that text;
  merely switching Preview/Source must never rewrite it.
- Selection and navigation are native-feeling, including backwards and
  cross-paragraph selections. Decoration never contributes document characters.
- Automatic formatting is contextual and reversible as one undoable action.
  Character completion must not hijack ordinary action prose.
- Show the active Fountain element unobtrusively and keep explicit formatting
  commands available. Do not add another modal or toolbar redesign by default.
- PDF-paste reconstruction should be clearly identified and easy to undo; add
  a literal-paste path rather than forcing heuristics on all clipboard content.

Acceptance: a fixture corpus round-trips between Source, Preview edits and
exports. Include empty lines, title pages, forced elements, inline emphasis,
annotations, dual dialogue, Unicode and partial/multiline selections.

## Maintainability sequence

Do not reformat or replace the entire 6,000-line app in one patch. The safer
sequence is to establish contracts and extract modules behind them:

1. **Document controller:** one document identity/revision, loading, save
   acknowledgments and lifecycle cleanup. Saving is not loading.
2. **Edit transactions:** source ranges, replacement text, before/after
   selection, origin and undo grouping. Route Source, Preview and commands
   through the same permission/history boundary.
3. **Fountain view model:** one parsed representation for rendering and
   bidirectional position mapping; format-specific rules live here.
4. **Surface adapters:** native input/composition, selection and rendering belong
   to Source/Preview adapters, not storage or collaboration callbacks.
5. **Persistence/transport:** observe transactions and acknowledge a specific
   document/revision. Neither should replace unrelated editor state.

Extract and test pure helpers incrementally. Avoid a speculative framework or
editor-engine migration until a representative prototype proves the hard input
and Fountain-mapping cases better than the current design.

## Test and release discipline

The previous CI built the app and checked a few compiler strings, but did not run
`npm test`. The new `editor-tests.yml` runs the complete JS/Python suite for PRs
and main. Repository settings must make that check required before merge; a
workflow file alone does not enforce branch protection.

Many existing frontend tests assert that snippets of code/CSS exist. Those are
useful wiring checks but do not demonstrate typing behavior. New tests execute
actual handlers/client code with controlled DOM/socket boundaries and deferred
I/O. Source-sliced VM harnesses remain an interim technique: extracted modules
should be imported directly, and browser suites must exercise native behavior.

Before a professional-editor release, require:

- Contract/regression tests and a production build on every change.
- Real-browser interaction coverage and manual iPad/IME checks where automation
  cannot accurately represent the input device.
- A long-document responsiveness baseline (typing, selection, undo, preview
  reclassification), with performance measured rather than inferred.
- The collaboration integrity cases above before marketing reliable live edits.
- A regression test for each reproduced editor bug; no unrelated cleanup in the
  fix commit, and no claim that a green suite proves absent latent defects.
