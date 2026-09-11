# Collaboration integrity contract

The browser and Worker ship together as protocol version 2. This is a bounded
CRDT implementation with explicit conflict recovery, not a claim that every
browser, network, and Google Drive failure has been exercised in production.

## Ownership and durability

- A Durable Object is permanently bound to an exact Drive file ID and document
  property ID. Possessing a copied document property is not access to that room.
- The room owns text persistence. Browsers submit Yjs deltas; plain-text PUTs
  only request a checkpoint if the submitted text already equals room content.
- Deltas are acknowledged only after a transactional snapshot write. One
  in-flight update per browser bounds the outbox; later local edits remain in
  its Yjs document. A reconnect exchanges room state and a state vector, then
  transmits the missing local state. Duplicate deltas are idempotent.
- A durable alarm checkpoints after editing, including after the final browser
  closes. It revalidates the last writer's session. Transient failures use the
  platform's alarm retries; permanent permission/conflict failures do not write.
- Undo tracks the browser's local transaction origin only. Other users' work
  is not entered into its undo stack. Relative selection handles survive edits
  before the selection. Composition defers remote application until commit.
- Offline CRDT changes survive reconnect **while the tab stays open**. They are
  not a persistent offline outbox across reloads, tab closure or browser crashes.
  Save a local copy before closing an offline editor.

## Google Drive consistency

Reads bracket the media fetch with Drive v2 ETag reads. Media writes use the
v2 upload endpoint with `If-Match`; absent/weak/wildcard validators never cause
an unconditional fallback. v3 remains in use for permissions and normal file
metadata. Drive v2 explicitly exposes the file ETag; v3 does not expose that
resource field. See the [v2 file resource](https://developers.google.com/workspace/drive/api/reference/rest/v2/files)
and [v2 update method](https://developers.google.com/workspace/drive/api/reference/rest/v2/files/update).

Checkpoints run in the same serialized room queue as edits. A persisted write
intent and content digest distinguish our own upload with a lost response from
an external edit. A subsequent attempt first adopts a proven earlier intent
as its baseline before replacing that intent. A different external Drive body
is a conflict, not a last-write-wins overwrite.

Legacy adoption is also conditional: read v2 properties and ETag together,
assign private document properties using that validator, and refetch the winner
after a competing adopter receives 412. Private v2 properties correspond to v3
`appProperties`; see [custom file properties](https://developers.google.com/workspace/drive/api/guides/properties).

Authenticated `GET /api/collaboration/:documentId/recovery?fileId=...` returns
both the live-room and Drive text for a **verified, bound room**, without changing
either. The frontend can offer both as local downloads. It is not a merge or an
operator-access endpoint.

## Permissions and limits

Every editing mutation and checkpoint rechecks the signed-in Google session,
Drive access, exact document property, and `canEdit`. Outgoing data uses a maximum
30-second read-permission lease, refreshed before sending once expired. Thus
read revocation is bounded, not instantaneous. Initial sync revalidates a lease
that expired while initialization was queued. Credentials and session IDs never
appear in public presence or save payloads.

Room snapshots and updates are capped at 12 MiB; JSON frames at 17 MiB; source
text at 5,000,000 UTF-16 units. Oversized work is preserved in the local editor
for recovery instead of silently truncated. Long-lived CRDT history counts
toward the snapshot limit; automatic history compaction is not implemented.
Snapshots use transactional 60 KiB chunks, below both SQLite and legacy KV value
limits. Compare the [Durable Object limits](https://developers.cloudflare.com/durable-objects/platform/limits/)
and [storage API](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/).

## Deployment and release gates

No new secrets, OAuth scopes, D1 migration, or Durable Object binding is needed.
The Worker and web application must be deployed as one coordinated release.
Outdated writers are rejected; refresh their tabs after preserving local work.

Before deployment, ask active editors to finish saving and retain local copies.
An old room can acquire its missing file binding only when its text agrees with
Drive. If an unbound legacy room and Drive already differ, the old data contains
no trustworthy original file ID: automatically disclosing it through any file
with a copied property would violate the binding guarantee. Preserve existing
browser/local copies. That legacy ambiguity cannot be repaired by guessing.

The chunked snapshot migration is forward-only. Do not independently roll back
the Worker to the old snapshot reader or plain-text checkpoint implementation.
Use a forward fix that understands the current stored format.

Before removing draft/release gates, test on a nonproduction Drive document:

1. Confirm v2 ETag retrieval, successful conditional media upload, a deliberately
   stale `If-Match` returning 412, and private-property adoption on actual Google
   Drive. No mock test proves provider compare-and-swap behavior.
2. Run two accounts through editing, sustained offline edits, reconnect, local
   undo/redo, large paste, and closing the last editor immediately after an ACK.
   Reopen Drive and compare all text, not only the connection indicator.
3. Revoke writer and reader access, expire/sign out a session, and test a copied
   file with the same application property. The copy must not join the original.
4. Edit Drive externally and verify both recovery downloads. Inject failed
   storage/upload responses, reconstruct the room, and confirm no silent winner.
5. Exercise real Worker hibernation, alarms and quota failures. The deterministic
   suite models these boundaries but does not replace deployment validation.

`tests/js/editor_collaboration.test.mjs` imports the real browser client/Yjs;
`tests/js/editor_room.test.mjs` imports the real Worker and room with controlled
storage, Drive, sessions and sockets. They cover repeatable integrity failures,
not real IME behavior or production load/cost characteristics.
