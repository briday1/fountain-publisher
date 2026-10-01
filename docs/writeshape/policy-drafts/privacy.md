> Historical paid-launch planning draft. Current private-preview copy is in beta/writeshape-pages; October 1 receiving-email verification supersedes the delivery-unverified statements below. Commercial decisions remain open.

# WriteShape privacy notice — draft

**Internal review draft, 26 September 2026. Not published, approved, or effective.** Bracketed items require decisions or verification before publication. This notice describes the private WriteShape implementation; it does not assert that Google has approved the app.

## Who operates WriteShape

WriteShape is a writing application for screenplays and books. [Insert the confirmed operator/legal identity, contact address, privacy contact and effective date.] Access currently requires explicit email approval. Public signup and real billing are disabled.

## Account and connection information

Google sign-in provides your Google account identifier, verified email and display name so WriteShape can identify your account and enforce access. Linking Google Drive is a separate action. WriteShape stores connection credentials encrypted so it can perform the Drive operations you request. Sign-in sessions and the private access gateway use authentication cookies.

## Your writing and where it is stored

Browser drafts, recovery copies, writing goals, document views and pending collaboration changes are stored on your device. Choosing a local folder grants the browser access to that folder. Local-only files and offline changes do not automatically appear on another device; shared storage must receive the changes first. Clearing browser data can remove local drafts and recovery information.

When you save to the WriteShape cloud library, file names, contents, ownership, saved revisions and document history are stored in Cloudflare D1. Live collaboration also stores document synchronization state in Cloudflare Durable Objects and sends authorized edits and presence information to connected participants. A Drive document used in live collaboration therefore also has synchronization state outside Google Drive. Browser recovery and pending changes can contain copies of cloud or Drive writing.

## Google Drive access

The current Drive connection requests full Drive access to support browsing existing folders and opening and saving documents across your Drive. This permission is broader than access only to files created by WriteShape. WriteShape's current integration uses the connection for folder/file browsing, document loading, saving and authorized collaboration, subject to the connected account's Google permissions.

You can manage the connection in WriteShape and revoke the app's Google access through your Google account. Revocation prevents future authorized access; it does not automatically delete documents, browser recovery copies or previously stored collaboration state. [Confirm and describe disconnect/token deletion behavior and the separate deletion process before publication.]

[Owner review required: approve an explicit Google Limited Use commitment after reviewing the complete implementation and operational practices. Suggested commitment: “WriteShape follows Google's applicable user-data policies and their Limited Use restrictions when handling information obtained through Google APIs.” Do not publish this as a verified compliance claim until review is complete.]

## Sharing and service providers

Library access is granted to specific existing accounts, with read-only or editing permission. Drive access follows Google's file permissions. Revoking a grant stops future authorized participation; it cannot retract copies another participant already received. Connected collaborators can see shared document content and presence details such as display name.

Cloudflare provides hosting, authentication gateway, database and collaboration infrastructure. Google provides sign-in and connected Drive storage. Stripe provides hosted checkout and account billing interactions; the private deployment uses its sandbox and makes no real charges. WriteShape stores billing references and entitlement status. [Confirm processor terms, locations, international transfers, any additional services and any applicable legal bases.]

## Diagnostics, retention and requests

The application's new error reporting records a request reference, route category and status, excluding writing, account identifiers, query strings and credentials from that handler. Infrastructure providers may maintain separate logs. [Confirm provider logging, retention and operational access; do not describe the whole service as collecting no logs.]

[Before publication: specify retention for accounts, documents, immutable history, live rooms, backups, recovery copies, tokens and logs; implement and test deletion/export request handling; identify applicable privacy rights and a verified request channel. Do not promise immediate or complete deletion while these details remain unresolved.]

## Contact and changes

[Insert a verified privacy contact and the process for notifying users of material changes.] The displayed support@writeshape.com mailbox has not yet passed delivery testing and is not a verified privacy-request channel.
