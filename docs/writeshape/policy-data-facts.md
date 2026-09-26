# WriteShape policy drafting facts

Engineering preparation dated 2026-09-26. This is a factual basis for separate WriteShape policy drafts, not approved legal terms or a public privacy policy. Existing beta/public/privacy.html and terms.html describe Fountain Publisher and must not be presented as accurate WriteShape policies without revision and owner review.

## Confirmed implemented data flows

- Local browser drafts, recovery copies, document views and live collaboration outbox are stored on the device. A selected local directory permits reading and writing files in that directory. Local-only edits do not synchronize between devices by themselves.
- The WriteShape cloud library stores file content, names, ownership, revisions and immutable saved history in Cloudflare D1. Collaboration adds durable room state and distributes authorized edits and presence to connected participants. Library grants use stable recipient account IDs and can be revoked.
- Google sign-in and Google Drive linking are separate. Account identity includes provider subject, verified email and display name. Existing private access is approved-email Cloudflare Access; ordinary public signup remains disabled.
- Drive linking requests full Google Drive scope, as explicitly chosen by the owner. OAuth connection tokens are encrypted before storage. Drive read/write operations use the connected account's permissions and conditional file revisions. This deployment is still Google External/Testing; production approval is incomplete.
- Library and Drive live rooms require authenticated access and fresh permissions. Durable collaboration state and local recovery copies may remain after permission loss so recovery and retention require an explicit policy. Revocation prevents further authorized room participation; it cannot retract copies already received by a recipient.
- Stripe handles hosted checkout and billing portal interactions. The current deployment uses sandbox billing and performs no real charges. Account records retain billing identifiers and entitlement state. Live billing has separate configuration and is disabled.
- New application failure telemetry records a request reference, route category and status, excluding document content, account identifiers, credentials and query strings. Provider infrastructure logging and its retention need separate confirmation; do not infer universal zero logging.

## Decisions and verification still needed

Confirm seller/legal identity, jurisdiction, support/contact details, processor terms and data locations, retention periods for documents/history/room state/recoveries/logs, deletion and export request handling, backups, age eligibility, refunds and cancellation terms. Do not invent retention or deletion promises: the current immutable file-history mechanism and local recovery copies require a designed policy and implementation check.

support@writeshape.com is currently displayed with a delivery-unverified notice. Confirm actual receiving/reply capability before calling it operational. Public homepage/privacy/terms URLs and Google publication are separate launch actions; preparing this document does not publish them or open the editor.
