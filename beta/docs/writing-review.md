# Writing review and automatic merging

Opening a WriteShape cloud document connects it automatically. Sharing grants access to the same document; it does not start or end a separate editing session. A second session, including another session on the same account, appears at its editing position using the preview's inline writer markers. The bottom bar remains one row.

Changes with a shared saved base merge automatically when they affect independent words, paragraphs, rich formatting, or story details. Different edits to the same word, deleting a paragraph another writer edited, and incompatible rearrangements require review. Neither side is silently discarded. Device drafts without a verifiable base remain available for review.

**File → Review changes** shows the current writing with author labels, timestamps, and recent changes. Each change has **Undo this change**. Undo compares the inverse change with the latest document, keeps subsequent compatible writing, and asks for a choice if writing overlaps. Readers can review; only writers can undo or merge. Changes are attributed by the room's authenticated account, never by client-supplied author fields. Display names are used, with the account's existing fallback if none is set.

Authorship starts when this feature is deployed. Earlier writing is left unlabeled rather than assigned to an assumed writer. Recent undo history is bounded to 200 changes and 1.5 MB; current passage attribution is retained separately up to 3 MB. Very large changes can fall outside recent undo history. Ordinary saved versions remain available in Version history according to the file's history policy.

The room saves the document, author spans, change history, and merge bases in one durable transaction before acknowledging or broadcasting an edit or undo. Review choices are rejected if the document or saved file changed during review. Repeating a successful undo does not apply it twice. Unresolved device merges survive reload and cannot be cleared by ordinary cache writes from another session. Removing access does not delete unsynced device writing or permit it to overwrite the server.

Compatible device recovery records are reconciled automatically before Files opens. Only overlapping or unbased writing is listed under **Changes to review**. A recovery record is cleared only if the merged writing is saved and the record still matches the reviewed draft.

Validation includes three-way merge and rich-formatting tests, competing IndexedDB writers, durable-room restart and failed-transaction tests, actual Worker/D1/socket tests for shared writers and readers, and browser review/undo checks in all nine themes. The mobile browser gate checks review alongside the inline markers and fixed-height footer.
