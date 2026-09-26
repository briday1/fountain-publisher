# WriteShape launch acceptance inventory

Updated 2026-09-26. This is the persistent checklist for all discussed work. “Implemented” is not the same as verified against a real provider or physical device.

Current release remains behind approved-email Cloudflare Access. Stripe uses the sandbox. No invitations, real charges, or public launch are authorized. Owner must explicitly approve final activation.

| Area | State | Evidence / remaining acceptance |
| --- | --- | --- |
| Branding, title and minimal tile icon | Done | Private deployed WriteShape identity; earlier merged releases. |
| Unified Cloud / Drive / Local browser | Implemented | Shared picker, unlinked Drive connect action, local folder chooser/change-folder action. Native OS folder round trip pending. |
| Cloud autosave and saved-file sync | Verified in prior private release | Server revision checks, local draft retention, pending/conflict UI. Own tabs/devices sync saved versions; offline edits require shared storage before other devices receive them. |
| Google Drive storage | Implemented, external verification pending | OAuth/API configured. Real connect/save/reopen and multi-device round trip still required; Google app remains Testing. Coordinator owns provider audit. |
| Local storage | Implemented, hands-on pending | Local drafts and per-session directory handle retention; unsupported browser uses file fallback. Folder handle does not persist across browser reload. Real OS chooser permissions/revoke/reopen need manual check. |
| Draft recovery/offline/conflicts | Automated coverage, broaden acceptance | Retain pending local drafts and compare revisions. Complete real offline/reconnect and backup export/restore check. No silent overwrite allowed. |
| Desktop tabs, splits and linked views | Done | PR138; independent buffers and shared views, protected section focus. |
| Single-document mobile | Done | PR139; no tabs, splits, Left/Right or pane controls; resize preserves desktop state and drafts. Responsive browser QA done; physical iOS/Android keyboard check pending. |
| Screenplay and Book | Implemented, deployment underway | Keep internal novel identifiers and Markdown compatibility. New chooser must say Screenplay / Book, description “Fiction or nonfiction, saved as Markdown.” |
| Book exports and screenplay exports | Implemented | PR137 PDF/DOCX/EPUB/RTF plus Markdown; automated export tests. Representative long manuscript render/round-trip checks pending. |
| Nested beats, history, goals, backgrounds | Done | PR134–136 merged/deployed; writing goals remain browser-local. |
| Collaboration | Honest planned state | Showcase explicitly distinguishes planned live co-editing from current saved-file synchronization. |
| Account and subscription management | Done | PR139 merged 3aa41d9d. Mobile-first Account entry, actual versus selected plan, invoices/payment methods, monthly/yearly changes, direct cancellation. No obstructive retention flow. |
| Real sandbox subscription QA | Done | Actual hosted checkout $8 test, annual change $72 test, monthly return, scheduled cancellation. Declined proration/pending update retained only paid window; retry succeeded. |
| Stripe signed webhook ingress | Done | Exact Access bypass only /api/billing/webhook. Signature required. Actual event updated D1; duplicate replay no version change; older annual event reconciled canonical monthly state; final cancellation revoked paid window. |
| Complimentary codes | Implemented and tested, deployment underway | Owner-managed custom/generated codes, duration/deadline/limits, revocation, HMAC hashes, atomic redemption, audit records; no real recipient codes issued. |
| Prepared live billing | Implemented and tested, disabled | Separate live customer/entitlement/checkout fields, explicit live credentials/catalog plus LIVE_BILLING_APPROVED; current mode remains test. |
| Ordinary signup and tenant isolation | API regression verified; real Google fresh-signup pending | Google subject identity, no email auto-merge, ordinary accounts default Free. Fresh non-owner flow, grants, downgrade/export and cross-account API regression required. No real invitations. |
| Support | External owner/provider dependency | support@writeshape.com displayed with delivery-unverified disclosure. Coordinator owns Help Scout, password/verification and email setup. Do not claim working until send/receive verified. |
| Public Google / Drive approval | External blocker | Testing app currently owner only. Confirm scopes, domain and callback ownership; complete Google production/verification as required before customer launch. |
| Stripe identity/business/bank, catalog and live keys | Owner/provider blocker | Business/legal entity decision and Stripe activation incomplete. No real payment testing now. |
| Legal/privacy/refunds/seller identity | Owner decision | Do not invent company or policy. Final customer-facing terms/contact must reflect actual seller. |
| Operational errors/backup/rollback | In progress | Add release runbook; verify logs redact credentials, D1 recovery and code rollback; preserve gate and test mode. |
| Final launch | Held | Requires explicit owner approval after acceptance and external blockers, not merely removal of Access. |

## Proven current safeguards

- Production Fountain site is separate and untouched.
- Private email gate stays in place. Worker public mode is independently disabled.
- Payment transport exception is exactly `/api/billing/webhook`; application/account/library/Drive remain gated.
- Duplicate checkout prevention, idempotent requests, paid invoice checks, ownership checks, and canonical subscription reconciliation are covered by worker tests.
- Sandbox event proof: `evt_1UK2YACoZzTH3rR0KzMGzTlx` replay left billing version 1; older `evt_1UK2TjCoZzTH3rR00Lgeyyp9` produced version 2, current monthly paid end and scheduled cancellation; cleanup cancellation produced version 3 with paid-until zero. Synthetic customer only.

## Activation prerequisites (do not execute yet)

1. Finish acceptance checklist and support/legal/provider setup.
2. Apply additive migrations before code using new tables/columns. Verify schema first; launch-billing.sql is apply-once, access-codes.sql is idempotent.
3. Create approved live product and exact USD monthly $8/yearly $80 recurring prices only after owner authorization. Supply STRIPE_LIVE_PRODUCT_ID, STRIPE_LIVE_MONTHLY_PRICE_ID, STRIPE_LIVE_YEARLY_PRICE_ID; upload STRIPE_LIVE_SECRET_KEY and STRIPE_LIVE_WEBHOOK_SECRET through secret storage, never committed files.
4. Configure live signed events on exact webhook path. Preserve signature validation and account mapping. Do not reuse sandbox customers, subscriptions, paid windows, or checkout attempts.
5. Separately set BILLING_MODE=live and LIVE_BILLING_APPROVED=true only after explicit approval. Validate catalog, invoices, portal actions and live webhook delivery before customer exposure.
6. PUBLIC_LAUNCH=true switches to ordinary Google sessions; removing Access alone is insufficient. Verify non-owner signup and callbacks before removing the private email gate.
7. Keep a known-good worker version and dated deployment/migration evidence. Roll back worker code to the last compatible version; leave additive tables/columns intact. Restore BILLING_MODE=test and remove live approval if needed; do not delete customer documents or grants as a rollback.

## Repository separation decision (planning only)

Verified remote is GitHub `https://github.com/briday1/fountain-publisher.git`. User mentioned GitLab; destination host is undecided. User requests a separate private WriteShape repository eventually and explicitly forbids moving anything or closing Fountain Publisher now.

Before any migration, inventory WriteShape `beta/` code, root build tooling, assets/fonts and licenses, shared Fountain modules, history ownership and desired retained commits. Enumerate GitHub Actions, Cloudflare build watches/deploy tokens, environment variables and secret names (never values), custom domains, callbacks, D1 bindings and retention, storage namespaces, branch protections and release tags. Design a read-only rehearsal/export and reproducible build from a private new repository only after explicit migration authorization. Preserve existing D1 IDs and document ownership; moving code must not create an empty replacement datastore. Keep the old deployment/repository available for rollback and define redirects before any later retirement. No repository creation, visibility change, remote rewrite, copy, move, deletion or retirement has been performed.

## Google audit and scope alternatives

Coordinator verified External/Testing with Brian as sole test user. Branding has WriteShape name, support email and writeshape.com domain, but homepage/privacy/terms URL fields are empty; Publish app is disabled. Basic sign-in requests openid/email/profile separately from Drive and must be assessed independently. Full `auth/drive` is classified restricted. Existing privacy/terms assets are behind the private gate; public information pages require a deliberate publishing decision while the editor remains gated.

A lower-scope `drive.file` plus Google Picker path can restrict access to files created by WriteShape or individually chosen/shared with it. It does not preserve arbitrary full-Drive folder browsing: unseen files and existing children cannot silently become accessible. Choosing this path requires Google Picker API configuration, an API key constrained to the approved origin, UI to select/import files and folders with clear scope limits, migration/re-consent handling for existing grants, and round-trip testing on browsers/devices. Keep the current all-files browsing behavior until the owner chooses the tradeoff. Full Drive retains that behavior but requires Google's restricted-scope production review and any required security assessment. No scope or provider publication mutation performed.

## Named near-term drills

- Synthetic interrupted-save/reload recovery, then immutable-history restore; record recovered content and revisions. Isolated database only, never restore over real documents.
- Ordinary-account create/read/write/history isolation and downgrade download/export access, including complimentary entitlement revocation.
- Representative 100k-word Book Markdown/export and editor operation check; record timings and formats without equating automated checks to physical mobile browser QA.

## 2026-09-26 acceptance evidence

- 442 app tests across 55 files; 93 WriteShape worker tests; private production build passes. CI now explicitly tests and dry-builds the WriteShape Worker without deployment.
- Actual Chromium/IndexedDB isolated recovery drill: synthetic failed `DocumentSession.flush()` wrote recovery; navigation/reload retained newest words; `importDraft` produced separate recovered copy; actual `DocumentSession.open` history restore produced another copy. Original “Original saved text.” and recovered “Newest words survive interruption.” both remained intact. This does not simulate a total-disk failure before any durable recovery write.
- Ordinary-account API integration: grant recipient can save; other account cannot read/history/overwrite/restore. History restore created revision 3 with original content and retained revision 2. Grant revocation stops new cloud saves but existing file reads/download remain available. Fresh Google browser signup still requires provider setup.
- Synthetic 100,575-word, 525-block Book: Markdown full structure round-trip and DOCX/EPUB/RTF final marker checks passed; PDF exported over 100 pages without warnings. Chromium editor module loaded in 21 ms; final-paragraph insertion and undo completed in 7 ms and restored all text. Local machine measurements are not promises for physical mobile hardware. Export test suite took ~13 seconds locally.
- Owner code creation form exercised with a local mocked API, and mobile 390px account/redemption layout visually inspected. Worker code tests use real SQLite and validate owner-only management, HMAC-only stored code, rate limits, invalid terms, repeated/concurrent redemption, capacity, expiry, non-stacking and revocation/audit behavior. No real recipient codes have been created.
- Applied additive launch-billing and access-code schemas remotely after checking existing columns/tables. Uploaded ACCESS_CODE_KEY through secret storage; no secret persisted in git. Keep this key stable: changing it invalidates lookup of previously issued codes.
- Synthetic Stripe subscriptions canceled and QA customer removed. Signed final event confirmed canceled/paid-until zero. Isolated QA account removed from remote D1; real owner data untouched. Temporary sandbox credential files removed.
- Support address is visibly marked delivery-unverified until coordinator completes the inbox. Private gate and sandbox mode remain unchanged.
