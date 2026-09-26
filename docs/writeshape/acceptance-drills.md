# WriteShape acceptance drills — 26 September 2026

These checks use synthetic writing and isolated databases. They do not open signup, enable real billing, publish policies or modify production documents.

## Book exports

From `beta/`, run `node_modules/.bin/tsx scripts/generate-book-acceptance.ts`. This generates the same representative fixture in `work/export-acceptance/` through WriteShape's actual Markdown parser and exporters: 2,105 words, 44 blocks, two chapters, heading levels 1–6, epigraphs and attributions, an inset quotation, bold/italic/both/underline, accented text, a section break, long paragraphs and an ending marker.

Acceptance performed:

- PDF: seven pages, no export warnings. All pages rendered with Poppler and visually inspected. Correct title/headings, italic epigraphs, inline emphasis, inset quotes, chapter breaks, page numbers and ending text; no clipping or overlapping text. Standard PDF font references were independently checked. The local Poppler installation needed an isolated fontconfig pointing to the bundled Liberation font family to render bold/italic correctly; this was a test-tool configuration issue, not an exporter defect.
- DOCX: imported and rendered with bundled headless LibreOffice via the document renderer; all seven pages inspected. Heading hierarchy, emphasis, quotation/epigraph/attribution layouts, chapter page breaks and final content survived import. This verifies that importer, not Microsoft Word or an edit-and-reimport workflow.
- RTF: actual bundled LibreOffice import to PDF; all six pages inspected. Headings, quotes, emphasis and final content remained intact. RTF uses continuous chapter flow rather than PDF/DOCX's chapter page breaks. No Word-specific or edit-and-reimport claim.
- EPUB: ZIP mimetype is first and uncompressed; XML parses, navigation references resolve to existing anchors and the final text is present. These are structural checks only. An actual EPUB reader/import check remains pending; the current navigation is flat, not a nested heading tree.

The earlier 100,575-word test establishes long-document structural coverage, not a visual inspection of every long-book page. Physical mobile devices remain unverified. PDF pagination can leave a single paragraph line at a page boundary; this pass does not claim publication-grade widow/orphan control.

QA artifacts remain untracked under `beta/work/export-acceptance/`. Generated documents are synthetic acceptance fixtures, not public downloadable samples.

## Isolated local D1 export and restore

From `beta/`, run `node scripts/verify-local-d1-backup.mjs`.

The script creates separate source and destination local D1 databases beneath a new `work/isolated-d1-backup-*` directory. It uses a fictional database ID, its own configuration and explicit `--local` on every database operation; the command wrapper rejects `--remote`. No production configuration, export, overwrite or rollback is used.

The fixture applies the real account/library/history/sharing schemas, then inserts three synthetic accounts, a folder and a Book, two historical revisions, one read-only grant, a revoked editing grant and a new active editing grant. Wrangler exports SQL from the source and imports into the separate destination.

Recorded result: exact rows restored across accounts (3), identities (3), items (2), history (2), read-only shares (1) and editing shares (2). Attempts to mutate immutable history or reactivate the revoked grant failed as expected. A subsequent save advanced revision and archived the prior text. Source rows remained unchanged.

The first successful drill's SQL backup SHA-256 was `e9f277113925b865782a167f3f090e720c6e6994ace717ee3b083b44c0f174a2`. The script writes its own report and checksum each run.

This verifies the application's SQL export/restore path in local D1. It does not prove remote D1 Time Travel, production disaster recovery, OAuth credential restoration, Google Drive backup, Durable Object room restoration or deployment rollback.

## Two-client disconnect and persisted outbox

From `beta/`, run `node_modules/.bin/vitest run tests/writeshape-live-runtime.test.ts --maxWorkers=1`.

The library test exercises the production WriteShape Worker, actual Durable Object class and real local D1. Two actual `LiveClient` instances use separate synthetic account sessions; a small browser WebSocket adapter forwards messages through real workerd sockets, and fake-indexeddb supplies the IndexedDB engine for the production cache implementation. Collaboration messages and the cache module are not mocked.

One transport is closed, that client edits offline, persists and is destroyed before retry. The second writer continues online. A new client reloads the first account's cached state, reconnects and merges both changes. Another reconnect confirms each text marker appears exactly once in the saved document body. The durable D1 checkpoint contains both writers' text. Existing read-only, unauthorized-file, revocation and durable-reopen checks still pass.

This is a reproducible synthetic runtime drill. It does not assert a production network drop, independent browser processes, physical devices or a real Google outage were exercised. Prior private production two-tab Drive/library collaboration evidence remains recorded separately in the launch inventory.

## Policy drafts and remaining provider work

WriteShape-specific [privacy and terms drafts](policy-drafts/README.md) are outside public assets. Unknown operator identity, retention/deletion, support delivery, commercial terms and jurisdiction remain explicit review items. Nothing was published.

Coordinator confirmed Google Search Console domain ownership. Full Drive production review remains outstanding, as does verified support mail delivery. The launch inventory records a gated canonical-www preparation plan, not a DNS change.
