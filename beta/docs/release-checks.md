# Release checks

Automated checks are evidence for the tested contracts, not a guarantee of an absence of defects.

Covered by executable tests:

- Single editor DOM ownership, automatic formatting, multiblock editing, marks, clipboard identity, undo/redo, and composition deferral.
- Native Chrome typing, selection replacement before `selectionchange`, Unicode deletion, find/replace, view changes, reload recovery, PDF generation, and mobile layout.
- A 3,000-block editor regression that verifies 100 keystrokes preserve unaffected paragraph DOM nodes and do not request document snapshots.
- Every Fountain element, styles, external edits, metadata, legacy notes/beats, inline annotations, PDF bytes/page count, FDX/XML escaping and CSV formula neutralization.
- IndexedDB version checks, quota/availability errors, independent tab recovery, save acknowledgments and stale open/fork boundaries.
- Opaque encrypted local sessions, OAuth state/PKCE, CSRF, GitHub SHA checks, conditional Drive saves, and beta callback pass-through.

Before graduating beta to production:

1. Use a nonproduction file to connect each real provider, open, save, reopen, change branches/folders, and deliberately create a concurrent remote version. Verify the saved text and conflict recovery, not only the status indicator.
2. Check Google shared-reader/writer permissions and revision downloads with two accounts. The hosted authorization scope only includes files authorized for the existing app.
3. Test Japanese, Chinese and Korean native IMEs; accent dead keys; autocorrection; emoji/combining-character deletion; drag/drop; touch selection; and platform editing menus in Safari, Chrome, Firefox and iPad.
4. Test long scripts and offline reopening on target devices with realistic notes and beat sheets. Recovery must survive a failed remote save and a second tab editing the same local draft.
5. Inspect dialogue continuation, dual dialogue, long title/contact fields and non-Latin font warnings in representative PDFs. Fountain and FDX preserve all text; Courier Prime's PDF glyph coverage is limited.
6. Design and validate structured-document collaboration before enabling live multiwriter rooms. It is deliberately unavailable in this beta.

PDF import/reconstruction, regex search, the old animated background effects, and live collaboration are not included in this first beta. Source and Vim modes were intentionally removed. Native browser spellcheck replaces the old custom spelling subsystem.
