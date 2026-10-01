# WriteShape policy drafting facts

Engineering facts updated 2026-10-01. Dedicated current-preview pages live in beta/writeshape-pages and replace About/Privacy/Terms only in WriteShape builds. Shared beta/public pages continue to describe Fountain Publisher. Paid-launch commercial terms and permanent-deletion procedures remain unresolved.

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

support@writeshape.com receives through Cloudflare forwarding to writeshape-support@agentmail.to. Brian’s Gmail test arrived on October 1. Outbound support mail from the custom domain is not configured. Support messages and attachments may be reviewed using AI tools to triage reports and prepare fixes; automatic diagnostics exclude writing and filenames. Publishing pages within the private app does not make public Google policy URLs available or open the editor.
