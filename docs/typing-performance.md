# Typing and note responsiveness

This follow-up reduces work competing with ordinary editing, including typing
in annotation, character/general-note, search and Beat Sheet fields.

## PDF scheduling

- Exact page counts still use the real local pagination engine. They are not
  character-count estimates, and this change does not introduce a separate
  count-only compiler with different layout behavior.
- Automatic counts require **10 seconds without typing** and run **at most once
  per minute**. Where available, they additionally wait for a browser idle
  callback with spare time; no timeout forces work into a busy UI deadline.
- Editing another text field postpones pending automatic work too. Hidden tabs
  and active composition sessions pause it. Returning resumes the quiet period.
- PDF-tab requests and exports bypass that delay. Matching PDF-tab requests can
  reuse/promote queued work or reuse the last exact source/settings snapshot.
  Successful matching PDF exports update the page count and reusable PDF.
- Explicit exports keep their click-time source and settings across later edits.
  They are not cancelled by background scheduling. An export requested during
  an already-running automatic job can still require a separate compilation.
- Compilation remains strictly local in each tab's dedicated worker. An active
  Python/WASM job cannot be preempted safely without terminating that runtime;
  cancellation drops queued work/stale results rather than interrupting exports.
  Off-thread execution is not a promise of zero CPU or battery contention.

## Editing work

- Source selection events coalesce once per animation frame. Redundant keyup
  events and inactive Source selection events do not repeat editor geometry,
  classification, completion or immediate full-workspace recovery serialization.
- The current document model, note offsets, dirty state and collaboration still
  update immediately. Sidebar DOM waits for a 650 ms typing pause, except when
  actionable scene/note/character/beat targets change and need immediate repair.
  Note dialogs pause the covered sidebar. Exposed analytics charts still update
  when collaborators change their underlying model.
- Unchanged outline, note, character and beat-guide markup retains its nodes.
  Beat highlighting uses one document traversal rather than one selector search
  per covered line, clamps ranges, and skips unchanged line-class writes.
- Hidden Source chrome and closed pacing graphs do no rendering. Beat drafts
  preserve composition, flush on view changes, skip unchanged saves, and reject
  callbacks/old card DOM belonging to another document.
- Background decoration stops behind modal dialogs, avoiding continual painting
  beneath their blurred backdrops. The background-settings preview itself can
  still animate. Closing the dialog resumes the workspace background.
- Preview skips inline parsing of hidden note payloads and parses each visible
  line once. Word analysis skips excluded note/title/cue payloads. Ordinary
  documents without beat assignments avoid unnecessary beat-rebasing scans.

## Evidence and limits

Deterministic tests cover typing bursts, sidebar/model freshness, modal pauses,
composition, view/document switches, queued/cached compilation and export
isolation. Run `npm test`, `npm run build:web`, and `npm run test:wasm`.

On a synthetic 18,400-word screenplay with 100 notes, actual Preview HTML
generation in a Node VM measured **13.94 ms to 5.06 ms**, with identical output;
hidden-note inline parsing went from 100 calls to zero. On the same instrumented
beat-guide fixture, selector calls went from **2,818 to 18**, and repeated
unchanged-sidebar HTML writes went from **5 to 1** (the remaining write is the
page metric). These measure CPU/DOM-call work, not browser frame times.

The actual 86-page WASM smoke test still produces matching PDFs off-thread,
with a roughly 11 ms maximum test-main-thread heartbeat gap versus 343 ms while
running the same engine synchronously. This is a Node worker measurement.

Native-browser profiling on the affected machine is still required: type long
notes and screenplay passages, use IME, keep Insights/beat guide open, change
views immediately after editing beats, and export while a collaborator edits.
Check responsiveness and input/cursor correctness as well as the saved content.
No Cloudflare configuration, storage migration or new dependency is needed.
