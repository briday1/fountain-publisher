# Editor contracts — implementation and release gate

This follows the [original reliability review](editor-reliability-review.md) and
merged PR #84. The implementation preserves the visual design and addresses the
four principal code risks from that review. Source and Preview remain two
surfaces of the same document.

**Status: implemented with deterministic regression coverage; release acceptance
is not complete.** No browser was connected during this work. Real input devices,
Google conditional writes and Cloudflare alarms still need the checks below.
A green suite is not a certification that the editor has no latent bugs.

## Collaboration and document integrity

- Protocol 2 exchanges Yjs state vectors on each connection. Missing local
  updates are retransmitted, acknowledged only after durable storage, and retried
  idempotently. Bounded messages and backpressure prevent an unbounded outbox.
- Local-origin `Y.UndoManager` replaces whole-document snapshot undo for live
  documents. Remote callbacks never enter local snapshot history. Disconnecting
  cannot fall back to snapshots that erase intervening remote work.
- Selection is captured as CRDT-relative anchor/head positions before remote
  changes, then restored in Source/Preview with direction and source/display
  mapping intact. Background updates do not steal dialog focus.
- Native composition suspends remote CRDT delivery, commits against its original
  baseline, then merges queued remote updates.
- The room owns serialized checkpoints. Browser Save acknowledges the room's
  actual saved text instead of overwriting it with a client snapshot. Durable
  alarms retry after the last tab closes, using a revalidated writer session.
- Conditional Drive writes detect external edits. Persisted write intents
  recover after lost responses, including a second edit before retry. Conflicts
  preserve both versions rather than choosing a silent winner.
- Rooms bind to an exact Drive file. Copied properties cannot grant access to
  another bound room. Writes/checkpoints revalidate permission; outgoing read
  permission has a maximum 30-second lease. Public presence contains no session
  identifiers.
- Large snapshots are chunked transactionally. Candidate updates are validated
  and persisted before becoming live or receiving an ACK.
- File → **Recover document versions…** downloads individually named editor,
  live-room and Drive copies without replacing anything. Local backup remains
  available if the remote request fails authorization.
- Writable legacy files without a room ID are adopted with a conditional,
  race-safe property update. Files that never joined a room retain local undo.

Tests: `editor_collaboration`, `editor_room`, `editor_selection`,
`editor_lifecycle`, and `editor_recovery` JS suites.

Important limitations:

- Offline CRDT state survives reconnect while the tab stays open, not across
  offline tab closure/crashes. Existing local workspace recovery is a text
  backup, not a persistent CRDT outbox. Save a local copy before closing offline.
- An unbound legacy room already different from Drive cannot safely be assigned
  to a file automatically: the old format did not store a trustworthy file ID.
  Never expose it based only on a copied property or silently discard a version.
- A durable room ACK and “Saved to Drive” are different claims. Expired
  authorization/provider failure can prevent a checkpoint while room text stays
  durable.
- Chunked snapshot migration is forward-only. Do not roll back to an old Worker
  that only understands single-key snapshots.

See [Worker deployment and recovery details](../github-worker/COLLABORATION.md).

## Native text-input ownership

- Both surfaces leave IME under native ownership through commit/cancel, including
  trailing input after `compositionend`. Intermediate composition does not
  rewrite Preview DOM, record history or broadcast partial text. Decorations
  also avoid mutating the composing subtree.
- A composition is one isolated collaborative undo group. Grapheme-aware
  deletion preserves emoji, combining marks, flags and joined sequences.
- Word, hard-line and wrapped-line deletions have distinct ranges. Browser target
  ranges take priority for replacement/autocorrection. Null or noncancelable
  replacements do not delete text or apply it twice.
- Browser/menu Undo and Redo route through document history. Ctrl/⌘+Shift+V
  bypasses PDF-paste reconstruction; reconstruction notices explain that shortcut.
- Preview reconciles visible changes into source ranges, retaining untouched
  emphasis, escaped literals and annotation buttons.
- Vim horizontal movement/deletion respects graphemes, and Preview Vim caret
  placement maps source offsets through hidden formatting.

Tests: `editor_native_input`, `editor_preview`, and `editor_vim` JS suites.
Native-device acceptance remains mandatory, including revocation during active
composition: uncommitted input must not transmit after permission is removed.

## Shared permission and asynchronous-edit contract

`editor-contract.mjs` supplies local/remote/load permission rules and
revision-bound edit targets. `sourceChanged` rejects an unguarded local read-only
mutation before history, dirty-state, persistence or sync side effects. Mutation
entry points guard early, leaving selection/copy/navigation usable. Backend
authorization remains independent of these browser affordances.

Vim, completion, formatting, title-page/template insertion, managed-note updates,
clipboard and native input use this boundary. Async clipboard completion,
local/Drive/GitHub opens and PDF imports reject stale targets or active
composition. Saves avoid transient composition text; late GitHub resolution
cannot replace a Preview composition baseline.

Tests: `editor_contract`, `editor_lifecycle`, `github_conflicts`, native-input
and room suites.

## Shared formatting representation

`fountain-inline.mjs` drives Preview HTML, visible text, source/display maps,
active markers and source-preserving range edits. Its bounded cache holds at
most 128 entries/64K source characters; long lines are not retained.

Explicit element markers also escape stale dialogue classification. Hidden
character `@`/`^` markers, title/centered/transition padding, and scene numbering
off now use matching visible/source ranges. Ellipses no longer become forced
scene headings. `fountain_lines.test.mjs` covers these block/prefix cases.

Fixtures cover nested emphasis, escaped stars, one-character formatting, Unicode
offsets, safe HTML, selection replacements and whitespace-edge edits. A common
inline corpus runs against both Preview and the Python export engine. This is
not a new Fountain dialect: underscore/backslash escape behavior retains export
compatibility. Malformed/noncanonical syntax has no blanket parity guarantee.
The live line classifier still accommodates incomplete editing, while Screenplain
parses complete paragraphs; full block-grammar equivalence is not claimed.

Tests: `fountain_inline.test.mjs`, `test_inline_contract.py`, shared
`tests/fixtures/fountain-inline.json`, and actual Preview helper regressions.

User-visible rules: switching surfaces does not rewrite source; formatting is
deliberate and undoable; completion does not hijack action prose; decoration
contributes no characters; selection preserves meaning/direction; recovery does
not implicitly select a conflict winner.

## Maintainability and performance

Independently imported modules now own permission/revision rules, text boundaries
and inline representation. The app remains a large coordinator; architecture
extraction is not complete. Next move lifecycle/history, block classification and
surface adapters behind these contracts. Avoid a wholesale rewrite in one patch.

The earlier unused `previewValueToSource` was removed after caller verification.
This pass replaces active duplicate mapping implementations. There is no claim
that every remaining function is necessary or all duplication is eliminated.

`npm run benchmark:editor` measures actual classification, Preview HTML generation
and analysis helpers. Initial local medians:

| Fixture | Classify | Generate HTML | Analyze |
| --- | ---: | ---: | ---: |
| 1,353 lines / 29,919 UTF-16 units | 0.35 ms | 3.54 ms | 1.74 ms |
| 5,403 lines / 119,919 UTF-16 units | 1.11 ms | 12.52 ms | 6.05 ms |

These are machine-specific CPU baselines, **not typing latency**. They exclude
DOM layout, selection geometry, input devices, network and storage. Measure
browser latency and multiwriter throughput before specifying production size
limits. Every update performs authorization and durable storage work; tests do
not establish capacity or operating cost.

## Release gate — still required

1. Complete JS/Python suite, production frontend build and Worker dry-run on each
   PR. Editor CI now runs all three. Make the check required in branch protection.
2. Browser/device matrix: typing, reversed/multiline selection, cut/paste/drop,
   native undo/redo, wrapped navigation, surface switching, IME commit/cancel.
   Include iPad hardware and software keyboards.
3. Two real accounts: simultaneous edits, offline/reconnect, undo own changes,
   role downgrade/revocation, large paste and recovery copies. Compare both
   editors with the reopened Drive file.
4. Staging Worker/disposable Drive file: prove stale `If-Match` returns 412, alarm
   checkpoints continue after the last tab closes, retries recover provider
   failures, and external edits preserve both versions.
5. Follow the coordinated protocol-2 rollout and legacy-room limitations. No
   production deployment or data migration was performed during implementation.

Source-sliced VM harnesses remain transitional: they execute handlers, but future
extraction should replace slicing with direct imports. Neither these tests nor
source-pattern assertions substitute for native interaction coverage.
