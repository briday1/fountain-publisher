# Account-scoped read-only sharing

Apply `library-sharing.sql` after the existing `schema.sql`, `accounts.sql`, and history migration. The migration is additive and idempotent; existing files and owner IDs are untouched. Mirror all four sharing files to the source and runtime trees. Dispatch `sharingRoutes(request, env, account)` **before** `libraryRoutes`; return its Response when non-null. The existing worker account resolution and Cloudflare Access gate remain mandatory.

External sharing requires **both** `PUBLIC_LAUNCH="true"` and `SHARING_ENABLED="true"`. Keep both absent/false for the private pilot. These flags do not bypass the Access gate or authorize launch. Current creation is disabled, recipient list is empty with a reason, and direct recipient content reads return 403. Owner listing and revocation remain available. No invitation, email, public URL, anonymous access, or public signup is created by this module.

## Routes

- `GET /api/library/:fileId/shares`: owner-only `{shares,canShare,reason}`; includes revoked records. Share metadata: `id,fileId,recipientEmail,role,createdAt,revokedAt`.
- `POST /api/library/:fileId/shares`: owner Premium, same origin; JSON `{email,role?:"read-only"}`. Returns `{share,created}` with 201 for a new grant or 200 for an existing active grant. Recipient must already have exactly one matching verified account; no arbitrary matching/merging. Current trusted proof is an existing Google identity or a private tester account created through signed Cloudflare Access. Future identity providers must explicitly be added to this check.
- `POST /api/library/:fileId/shares/:shareId/revoke`: owner and same origin; works after downgrade and while sharing is disabled. Returns `{share}`. First revocation timestamp is retained.
- `GET /api/shared`: recipient-only `{shares,canReadShared,reason}`. Entries: `shareId,name,kind,revision,updated,bytes,role,sharedAt`.
- `GET /api/shared/:shareId`: recipient-only current `{shareId,name,content,revision,updated,bytes,role,readOnly:true}`. No file/folder/owner identifiers or historical versions. Do not bind this result as an owned cloud document in the editor; changes can be saved locally or as the reader's separate owned copy.

Shares bind stable account IDs, never email as an authorization key. The entered email only resolves the explicit recipient and is retained as a historical display snapshot. An email change or reassignment does not transfer grants. IDs are UUIDs, not bearer secrets. Guessing a share ID never grants access. Existing shares remain readable after owner/recipient downgrade if launch/sharing flags permit; owners always retain revocation rights. Reads use one SQL join checking recipient, active grant, current file owner, and file kind. No grant authorizes owner library/history, writes, restoration, sharing onward, or revocation. Previously downloaded copies cannot be recalled.

The unique partial index serializes duplicate grants. Revocation is immediate for subsequent reads. Re-sharing after revocation uses a new UUID; old IDs stay revoked. A database trigger prevents changing share identity, role, creation time, or an existing revocation timestamp. No share deletion or silent retention cleanup is implemented.

Shared content is referenced in place, never duplicated; screenplay storage accounting continues to count owner current content and revisions. Sharing metadata is not counted as screenplay content bytes. Sharing does not change D1 encryption at rest or HTTPS transport, and is not end-to-end encryption.

## Verification

`node --test cloudflare/writeshape/sharing.test.mjs` uses isolated real SQLite fixtures and the actual library dispatcher for unauthorized owner-path probes. It covers pilot gating, recipient-only current-content reads, lack of library/history/write access, cross-account ID guessing, revocation/re-sharing, concurrent duplicates, missing/ambiguous/unverified accounts, email reassignment, downgrade behavior, origin protection, unsupported methods, and folder isolation. These are local fixture tests, not connected external recipient or provider tests. External recipient testing remains blocked intentionally by the owner-only private launch gate.
