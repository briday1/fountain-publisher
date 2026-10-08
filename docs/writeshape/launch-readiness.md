# WriteShape launch acceptance inventory

Updated 2026-10-08. This is the persistent checklist for all discussed work. “Implemented” is not the same as verified against a real provider or physical device.

Current release remains behind approved-email Cloudflare Access. Stripe uses the sandbox. No invitations, real charges, or public launch are authorized. Owner must explicitly approve final activation.

| Area | State | Evidence / remaining acceptance |
| --- | --- | --- |
| Branding, title and minimal tile icon | Done | Private deployed WriteShape identity; earlier merged releases. |
| Unified Cloud / Drive / Local browser | Working and verified | Shared picker, unlinked Drive connect action, local folder chooser/change-folder action. Real macOS folder chooser/module read-write/reopen/change-folder and stale-revision protection passed on isolated synthetic files. |
| Cloud autosave and saved-file sync | Verified in prior private release | Server revision checks, local draft retention, pending/conflict UI. Own tabs/devices sync saved versions; offline edits require shared storage before other devices receive them. |
| Google Drive storage | Implemented, external verification pending | Actual signed-in production Chrome: Drive browsing, new Markdown Book save, and autosave reached Google Drive saved. Live two-tab edits, split panes, explicit checkpoint and reload recovery passed in production Chrome. Google app remains Testing; coordinator owns full-scope provider review. |
| Local storage | Working and verified | Production writeshape.com opened the macOS folder picker, requested access only to the disposable folder, saved a new Book and autosaved edits verified on disk. Save As detached the old Drive room; local-only text did not reach that room. Native module read/reopen/stale-write refusal/change-folder also passed. Permission revocation and physical mobile remain unverified. |
| Draft recovery/offline/conflicts | Working; verified in isolated browser and automated tests | Forced IndexedDB save failure, reload and restore-as-copy drill preserved original and newest recovered text. Two actual LiveClient instances over real workerd sockets passed disconnect, offline edit, persisted-cache reload, concurrent peer merge, repeat reconnect and durable checkpoint. IndexedDB uses a synthetic engine in this isolated runtime test. Production network-drop drill remains unverified. |
| Desktop tabs, splits and linked views | Done | PR138; independent buffers and shared views, protected section focus. |
| Single-document mobile | Implemented; physical-device acceptance open | PR139; no tabs, splits, Left/Right or pane controls; resize preserves desktop state and drafts. PR152/155 and follow-ups shipped menu/account cleanup; PR156/157 shipped selector and keyboard-hint changes. Automated WebKit checks pass, but the owner still reports unwanted iPhone payment/autofill controls. Physical iOS/Android acceptance remains open. |
| Screenplay and Book | Working and deployed in PR140 | Keep internal novel identifiers and Markdown compatibility. New chooser must say Screenplay / Book, description “Fiction or nonfiction, saved as Markdown.” |
| Book exports and screenplay exports | Book rendered exports and Calibre EPUB-reader acceptance passed | Prior 100,575-word Book round trip, DOCX/EPUB/RTF trailing marker, PDF over 100 pages without warnings, and actual browser load/edit/undo passed. Prior 2,105-word Book: seven PDF and seven DOCX pages inspected, plus six RTF pages after LibreOffice import; headings 1–6, emphasis, quotes and final text passed. October 8: three-chapter manuscript with 12 notes, front matter and both default/selected fonts passed PDF/DOCX/RTF exact rendered-text comparisons and visual checks. Both EPUBs passed EPUBCheck and all 24 actual Calibre note/return-link pairs. Three Book export defects fixed; 549 tests and both product builds pass. See [book-export-fidelity.md](book-export-fidelity.md). Microsoft Word, other EPUB readers and reader edit/reimport remain unverified. |
| Nested beats, history, goals, backgrounds | Done | PR134–136 merged/deployed; writing goals remain browser-local. |
| Collaboration | Private runtime/tab verification passed; real two-account acceptance open | Dedicated WriteShape routes, durable rooms, session/Access identity, library writer/read-only grants and full-scope Drive adapter. Real workerd tests use separate synthetic authenticated accounts, concurrent edits, checkpoint, reader rejection, revocation and durable reopen. Book/Screenplay pane tests cover independent carets, one activity credit, peer-safe undo and focused-section outside edits. Production Chrome verified library and Drive live links in separate tabs, peer text delivery, presence, split panes and reload recovery. Library checkpoint confirmed directly in D1 (revision 2, peer text present). Separate real Google-account acceptance remains required. |
| Account and subscription management | Done | PR139 merged 3aa41d9d. Mobile-first Account entry, actual versus selected plan, invoices/payment methods, monthly/yearly changes, direct cancellation. No obstructive retention flow. |
| Real sandbox subscription QA | Done | Actual hosted checkout $8 test, annual change $72 test, monthly return, scheduled cancellation. Declined proration/pending update retained only paid window; retry succeeded. |
| Stripe signed webhook ingress | Signed-event acceptance passed; live boundary smoke recorded below | The application's unauthenticated webhook handler matches exactly /api/billing/webhook and requires a signature. Actual event updated D1; duplicate replay no version change; older annual event reconciled canonical monthly state; final cancellation revoked paid window. The trailing-slash URL returns an authentication denial rather than an Access redirect; see September 30 evidence below. |
| Complimentary codes | Deployed; automated and owner UI verified | Owner-managed custom/generated codes, duration/deadline/limits, revocation, HMAC hashes, atomic redemption, audit records; no real recipient codes issued. |
| Prepared live billing | Implemented and tested, disabled | Separate live customer/entitlement/checkout fields, explicit live credentials/catalog plus LIVE_BILLING_APPROVED; current mode remains test. |
| Ordinary signup and tenant isolation | API regression verified; real Google fresh-signup pending | Google subject identity, no email auto-merge, ordinary accounts default Free. Fresh non-owner flow, grants, downgrade/export and cross-account API regression required. No real invitations. |
| Support | Incoming delivery verified; sending as the domain pending | support@writeshape.com forwards through Cloudflare to the AgentMail inbox. Brian’s Gmail test arrived October 1. Report a problem and account contact use this address. Support triage reviews reports without sending replies. Outbound replies from the domain remain unconfigured. |
| Public Google / Drive approval | External blocker | Testing app currently owner only. Search Console DOMAIN ownership verified by coordinator using Google apex TXT. Confirm callback and policy URLs; complete Google production/verification as required before customer launch. |
| Stripe identity/business/bank, catalog and live keys | Owner/provider blocker | Business/legal entity decision and Stripe activation incomplete. No real payment testing now. |
| Legal/privacy/refunds/seller identity | Private-preview pages updated; paid launch decisions remain | Separate WriteShape About, Privacy and Terms pages describe current device/cloud storage, support processing, reversible Trash, downgrade access and test billing. Fountain pages remain separate. Paid seller/refund terms and retention/deletion procedures still need decisions before customer launch. |
| Operational errors/backup/rollback | Implemented; partly verified | Sanitized error-reference tests pass; rollback runbook below. Isolated local D1 export/restore passed exact rows, immutable history, revoked-grant protection and saves after restore. Production disaster recovery, durable-room/Drive backup and full deployment rollback rehearsal remain unverified. |
| Final launch | Held | Requires explicit owner approval after acceptance and external blockers, not merely removal of Access. |

## Proven current safeguards

- Production Fountain site is separate and untouched.
- Private email gate stays in place. Worker public mode is independently disabled.
- The unauthenticated payment handler matches exactly `/api/billing/webhook`; other API routes require identity. Live root/account/library/Drive/billing checks reached Access redirects on September 30. The slash-variant webhook URL reached a 401 denial; external Access path normalization has not been independently audited through its administration API.
- Duplicate checkout prevention, idempotent requests, paid invoice checks, ownership checks, and canonical subscription reconciliation are covered by worker tests.
- Sandbox event proof: `evt_1UK2YACoZzTH3rR0KzMGzTlx` replay left billing version 1; older `evt_1UK2TjCoZzTH3rR00Lgeyyp9` produced version 2, current monthly paid end and scheduled cancellation; cleanup cancellation produced version 3 with paid-until zero. Synthetic customer only.

## Release assessment and automation (2026-09-30)

- Current reviewed source `9d02e79182fc40dc92489663da96c0b24bcba54f`: [checks run 36624783930](https://github.com/briday1/fountain-publisher/actions/runs/36624783930) passed 470 app tests, 73 browser checks (5 skipped), 3 mobile WebKit checks, and 99 WriteShape Worker tests. These are recorded CI results, not fresh provider/device acceptance.
- [Private deploy run 36624783939](https://github.com/briday1/fountain-publisher/actions/runs/36624783939) succeeded with Worker version `ffd6dcbe-2c03-4bee-a2a8-3edfc1c4a770`. The missing deployment-token blocker is resolved. The token is available to GitHub Actions; direct DNS, Access, email and D1 administration permissions have not been established in this session.
- Deployment now belongs to the main checks workflow and requires successful `build`, `writeshape_private`, and `account_worker` jobs for the same revision. The private deployment workflow is callable only; manual releases start the main checks workflow and cannot skip its gate. Failed, skipped or canceled prerequisite checks do not deploy.
- A post-deployment smoke checks the private root/account/library/Drive/billing routes for the configured Access redirect. The trailing-slash webhook path must redirect to Access or return the Worker's specific 401 authentication denial with a matching request reference. An unsigned POST to the exact webhook must reach application signature validation and be rejected. The smoke sends no credentials and changes no document or subscription. Its success must be recorded by the actual deployment run; local test doubles alone are not live acceptance.
- First gated release: [run 36740247511](https://github.com/briday1/fountain-publisher/actions/runs/36740247511) passed all three prerequisite jobs and then deployed `d16c4b42201e8fa5cdbdb02955ae47e18eadc8f9` as version `205b0bce-583f-4064-bbec-571294142915`. Its initial smoke rejected the slash variant's 401 because it incorrectly required a redirect there. The exact Worker routing authenticates that variant; the smoke now requires its specific authentication denial and matching request reference rather than accepting arbitrary error pages. Full post-deploy smoke completion is reported by the latest [main workflow run](https://github.com/briday1/fountain-publisher/actions/workflows/pages-preview.yml?query=branch%3Amain). This does not certify public launch, authenticated provider acceptance, physical keyboard behavior, or production disaster recovery.

### Work still required before customer launch

1. Full-scope Google production review: keep the owner's chosen full-Drive behavior. Complete approved public information/policy pages and provider configuration, then perform fresh non-owner signup and real two-account acceptance.
2. Approved seller/privacy/refund/retention decisions, verified support send/receive, and Stripe business/bank activation plus the intended live catalog. The sandbox annual QA price was $72; planned live annual pricing is $80 and needs its own catalog validation.
3. Physical iPhone and Android editing/save/reopen acceptance, including the reported payment/autofill controls. Desktop WebKit CI does not close this item.
4. Production recovery/rollback evidence, broader EPUB-reader compatibility and edit/reimport checks, and verified canonical-www handling. Calibre 7.6 reader acceptance passed on October 8; other readers remain unverified. Keep existing local/synthetic drill evidence separate from these remaining checks.
5. Explicit final public-launch and live-billing approval after the evidence above. Public mode, live billing, Google scope, Access policies and customer data are unchanged by the release-process work.

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

A lower-scope `drive.file` plus Google Picker path can restrict access to files created by WriteShape or individually chosen/shared with it. It does not preserve arbitrary full-Drive folder browsing: unseen files and existing children cannot silently become accessible. Choosing this path requires Google Picker API configuration, an API key constrained to the approved origin, UI to select/import files and folders with clear scope limits, migration/re-consent handling for existing grants, and round-trip testing on browsers/devices. Owner has explicitly chosen to retain current full-Drive browsing/access even if Google verification delays launch. Do not substitute drive.file/Picker-limited behavior without a new decision. Full Drive retains that behavior but requires Google's restricted-scope production review and any required security assessment. No scope or provider publication mutation performed.

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

Owner update: full Google Drive access takes precedence over the tentative 1–2 day launch target. Continue full-scope verification preparation; OAuth publishing, paid assessments and final public launch remain unapproved.

## WriteShape collaboration acceptance (2026-09-26)

- Dedicated worker entry and WriteShapeLiveRoom namespace; Fountain runtime defaults and deployment remain unchanged.
- Additive file_edit_shares schema. Writer grants bind stable account IDs and each update/checkpoint rechecks entitlement and access. An atomic SQL grant predicate prevents a revocation racing a checkpoint from saving content or history.
- Library owner Premium covers invited existing writers; Drive writers require their own Premium and provider editing permission. No invitation emails or public bearer links are created.
- Each document buffer owns one durable Yjs client; each pane has independent selection/scroll. A focused section restricts local editing while accepting remote changes outside that section. Save As detaches the prior room before editing a new destination.
- Real runtime fixtures use production WriteShape Worker, account session resolution, D1 schemas and durable object class. Google responses are synthetic; this proves adapter wiring and permission enforcement, not production Google verification.
- Browser mobile remains one document without desktop tab/split controls. Physical-device keyboard tests are still pending.
- Live writing preserves a local outbox and room state; separate direct-file edits can cause a visible conflict requiring preservation of both versions. Existing Fountain live-file metadata requires a separate copy rather than silently migrating rooms.
- Error telemetry contains only request reference, route area and status. No document content, query strings, credentials or account identifiers are logged by the new error handler.

## Private release evidence

- PR141 code head `d679c5837bcae642b83aa099443627f7e60bced4`: GitHub run `36274189725` passed all three check jobs. App tests: 450; browser regressions: 70; WriteShape worker tests: 99. Both product builds and Worker dry runs passed. Final evidence-only documentation update does not change the tested deployment code.
- Deployed private version `79bce71e-4773-43fe-9ab4-6a84397809a7`. Approved-email Access, sole tester setting, full Google Drive scope and BILLING_MODE=test preserved. Root and /api/account return 302 without authentication.
- Remote live-sharing.sql applied through D1 query execution (four additive statements). The file-import endpoint rejected authentication before import; query execution succeeded. No existing document/account rows were migrated or removed.
- Browser acceptance used only clearly named synthetic QA files. Original Untitled.fountain draft and user Drive files were preserved. Synthetic library/Drive documents are retained as acceptance fixtures; no real people were invited.
- Actual live-link auto-restore race found during production QA was fixed. Existing buffers are activated directly, and background peer changes do not invalidate opening a separate document tab. Regression coverage added; fixed link reload verified without an error banner.

Remaining customer-launch blockers: full-scope Google production review, corrected and approved WriteShape policy pages, seller/business/bank/live-Stripe activation, verified support delivery, fresh non-owner real Google onboarding, physical iOS/Android checks, and explicit final public-launch approval. None is silently treated as complete because the private build works.

## Additional acceptance drills (2026-09-26)

See [acceptance-drills.md](acceptance-drills.md) for commands, scope and evidence. No production application changes were needed for these checks; private deployment and billing configuration remain unchanged.

- Google Search Console DOMAIN ownership is verified under Brian, as confirmed by the coordinator. This completes only the ownership prerequisite, not OAuth branding publication, restricted Drive scope verification or public launch approval.
- Canonical www handling needs preparation: the coordinator found no DNS record or redirect for www.writeshape.com. Target is an HTTPS redirect to the apex preserving safe paths, without serving the application on an ungated alias. Before activation, configure TLS/DNS and an exact-host redirect, verify an unauthenticated request reaches gated apex access, and verify account/API paths cannot bypass Access. Do not broaden the billing-webhook exception or copy authentication cookies to another host. Callback URLs remain the approved apex URLs. This is a plan only; no www DNS/route mutation was made.
- Support delivery was subsequently verified on October 1; the current policy pages use `support@writeshape.com`.

## Support and downgrade preparation (2026-10-01)

- Report a problem is available from WriteShape Help and mobile Preferences. The writer reviews optional technical details and sends the report through their email app, or downloads it. Diagnostics omit document text, filenames, account emails, raw errors, and URLs. Nothing is submitted merely by opening the form.
- Public support address: `support@writeshape.com`. Cloudflare Email Routing forwards it to `writeshape-support@agentmail.to`. Brian's Gmail test was received end to end on October 1. Outbound sending as the custom address is not configured.
- Support triage checks the temporary inbox hourly. Reports are untrusted input. Reproducible fixes may get a separate branch and draft PR; triage never merges, deploys, changes access/billing, or sends replies. No report is called fixed based solely on tests.
- Losing Premium makes bound cloud documents read-only; downloads and explicit editable local copies remain available. Drive sync stops. Unsynced drafts remain on the device across reloads and require explicit sync resumption after Premium returns. Conflict resolution remains explicit.
- File browser is available directly from Files. WriteShape cloud files support selected/folder downloads, rename, move, and reversible Trash. Folder deletion requires an empty folder. Owner writes remain Premium-gated; owner reads/downloads remain available on Free. This does not add remote Drive file management or permanent deletion.
- These changes do not launch a public beta, activate live billing, or change Access policies. Outbound custom-domain sending and physical-device acceptance remain open.

## October 1 policy and interface copy update

- Owner requested plain language for policies and Premium, plus consistent Settings/menu/dialog styling. WriteShape builds replace the shared About/Privacy/Terms URLs with dedicated private-preview pages; Fountain builds keep their own pages. The WriteShape pages and their shared styles/theme script are included in the offline release and its version hash. They follow the editor's stored theme.
- Premium copy explains actual tools and downgrade access. Settings uses Appearance, Screenplay and Writing groups, shared theme colors and controls. Support copy uses the verified custom address and removes the obsolete delivery-unverified notice.
- These are current private-preview terms, not a paid-launch policy package. Google configuration, public access, live billing and the permanent-deletion implementation remain unchanged.
