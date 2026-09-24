# WriteShape cloud library

The editor’s desktop Library button and File → Browse library open the same central browser. It supports nested folders, breadcrumb/up navigation, selection, keyboard arrows/Home/End/Enter, current-folder search, name/modified/size sorting, folder creation, and separate first-save naming. Mobile uses the same browser with compact rows. Existing file saves retain optimistic revision checks; conflicts offer browsing the latest history or saving a separate file. File switching uses DocumentSession.open so the local draft is flushed to the device workspace before replacement. Delayed responses cannot associate another account or replace a different open document.

## Storage and retention

The private tester has Unlimited application storage: STORAGE_QUOTA_BYTES is unset, represented by null in the API. This is an application allowance, not a claim that D1 or its infrastructure has infinite capacity. The existing 2,000,000 UTF-8 byte per-file limit remains. Displayed usage measures actual UTF-8 document content, including every retained previous version, separately from current content. It excludes database/index/metadata overhead and external-provider storage. Counts cover files, folders, and prior versions. Unset quotas never impose a hidden total cap.

A future nonnegative integer STORAGE_QUOTA_BYTES enforces a per-owner logical content limit. Zero is a real limit; malformed values fail closed. Quota checks and writes execute in one SQLite statement with transactional archive triggers, so simultaneous writes across files cannot overshoot the configured total. A save’s net growth is the full new content: old content remains as history. Rejected saves/restores do not archive a ghost version or change the current file.

HISTORY_MAX_VERSIONS is an optional nonnegative integer maximum number of prior snapshots per file. Unset retains history indefinitely. At a finite limit, further updates/restores fail with HISTORY_LIMIT and a clear message; no snapshot is silently purged. Lowering the limit preserves all existing data. This implementation intentionally has no automatic deletion or destructive retention job. Future time-based expiry/deletion policies would need a separately reviewed migration and explicit user-facing policy.

## Immutable history and migration

Apply library-history.sql after schema.sql/accounts.sql, and library-sharing.sql after accounts/history. These additive, repeatable migrations do not modify existing items. A legacy file’s existing current revision becomes its first available baseline; older overwritten content cannot be reconstructed. Each subsequent save atomically archives the previous current version. Stable version IDs are file UUID plus colon plus revision. Database triggers reject modifications/deletions of archived content and invalid revision jumps. The current version is returned with history without duplicate storage; a save archives that same stable ID.

Restore takes a version ID and expected current revision, then saves the selected content under the current filename as a new revision. It preserves all versions and does not change the editor’s open local draft. Open current file is a separate explicit action. History exposes dates, IDs, content previews, and version downloads. Ordinary saves and restores reject stale revision expectations. Refreshing after a conflict preserves the inspected immutable version.

Reads, history, quota totals, folders, and writes are owner-scoped. Premium is required for new saves/restores; owners retain read/download access after downgrade. Sharing uses a separate account-bound grant and never grants history, folder, library or write access. See SHARING.md. The private gate and server account identity remain authoritative.

## Verification and deployment

Run npm test, npm run build:writeshape, and node --test cloudflare/writeshape/*.test.mjs. Backend tests use real SQLite statements/triggers for quota races, stale/concurrent writes/restores, immutable history, retention, legacy baselines and cross-account isolation. UI tests cover navigation, opening, capture/acknowledgment, failure preservation, restore, conflicts, pilot sharing state and revocation. Browser QA uses synthetic scripts only. Production browser checks do not substitute for the multi-account isolated tests.

Deploy only with wrangler.writeshape.json after applying the additive migrations. Fountain Publisher’s provider configuration and deployment remain separate. Keep PUBLIC_LAUNCH and SHARING_ENABLED unset during the private pilot. Billing remains disabled until separate credential/setup and connected sandbox checks are completed; no live charges are supported.
