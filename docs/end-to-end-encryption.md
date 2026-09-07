# End-to-end encryption: draft implementation and release gates

Status: **not enabled, not production-ready, not independently audited.** This
branch fixes collaboration room isolation and contains a tested experimental
record-encryption primitive. It does not yet encrypt editor traffic or Drive
files. No UI should claim otherwise. The experimental module is not imported
by the app, copied by the web build, or used by the Worker.

## What can be read today

Drive API calls use the signed-in user's OAuth access token. Collaboration
admission checks that user's access to the requested Drive file and derives
writer status from `capabilities.canEdit`. Existing connections receive a
five-minute authorization lease; messages and broadcasts enforce its expiry.
Revocation is therefore not instantaneous. A subsequent connection must pass
Drive authorization again. Broader Drive permissions (including link sharing,
folder inheritance, groups and shared drives) can give broader access.

Cloudflare processes plaintext Yjs updates and keeps a readable Yjs snapshot.
Drive stores plaintext screenplay content. The browser's optional workspace
recovery cache also contains plaintext. HTTPS and encrypted OAuth credentials
are useful protections, but **neither makes documents end-to-end encrypted**.
Infrastructure administrators with the relevant access are inside today's
trust boundary. No claim of zero risk or an "airtight" security audit is made.

### Room-isolation fix in this branch

Drive `appProperties` are editable metadata, not an access-control boundary.
Room names now incorporate the actual file ID returned by an authorized Drive
lookup, as well as the document ID. Two files with copied document metadata
cannot address the same Durable Object. File-ID mismatches, trashed files,
Drive failures and missing sessions fail before any room is accessed.
Caller-supplied identity/capability headers are replaced on admission.
Legacy socket attachments cannot submit updates or receive broadcasts.

This is authorization hardening, **not encryption**.

## Target trust boundary

Only unlocked, authorized collaborators' browsers should hold the document
decryption key or interpret its source, Yjs updates, or cursor positions.
The Worker should authorize access and route/store opaque ciphertext. Drive
should hold an encrypted snapshot. Neither service should receive the key.

Google account identity, Drive ACLs, file IDs, folder membership, timestamps,
traffic sizes/timing, and connections remain visible metadata. Filenames remain
visible unless the user chooses a generic encrypted filename. Server routing
still knows participants' Google identities even if presence payloads are
encrypted; do not advertise anonymous collaboration.

E2EE does not stop authorized recipients from copying plaintext, undo prior
access, protect compromised browsers/extensions, or prevent denial of service.
A compromised app-delivery server can serve JavaScript that steals keys: a
normal web application cannot promise protection against an actively malicious
operator controlling its delivered code. Publishing/reviewing reproducible
client builds is a separate mitigation, not a solved property of this draft.

## Key distribution: user choice required before wiring the editor

Each encrypted document gets a random 256-bit secret, independent of Google
OAuth tokens and Worker secrets. Two possible first-release flows:

1. A separate encryption passphrase, shared privately. Derive a key-encryption
   key in the browser with a reviewed password KDF and random salt; use it to
   wrap the random document secret. A passphrase is not itself an AES key.
   Define strength requirements, bounded KDF parameters, and recovery UX before
   implementation. Weak passphrases permit offline guessing of encrypted files.
2. An invitation link carrying the random secret in its URL fragment. Drive
   permission is still required to download or join. The fragment must never be
   copied into requests, telemetry, logs, or rendered links, and should be
   removed from the address bar on import. Anyone who obtains both the link and
   ciphertext can decrypt, regardless of their current Drive access. Forwarding,
   browser history/sync and screenshots can expose such links.

Neither flow supports a server-side "forgot encryption password" reset.
Require an explicit recovery-key export/acknowledgment before committing an
encrypted document; never silently retain the secret on the server. An
account-key/public-key sharing system could eliminate manual key exchange but
requires its own identity verification, multi-device onboarding, backup,
rotation, and recovery design. It is not supplied by Google sign-in.

Removing a user in Drive blocks future authorized fetches after the existing
lease expires, but cannot revoke downloaded content or a known encryption key.
Protecting future content additionally requires a fresh random key and epoch,
distributed only to remaining collaborators. Incrementing an epoch with the
same master secret does not revoke a key holder. A safe first release may use a
new encrypted document/copy for rotation instead of claiming in-place revocation.

## Implemented primitive

`experimental/e2ee/document-crypto.mjs` uses native WebCrypto:

- A randomly generated 32-byte document secret is imported as a non-extractable
  HKDF key. Its string representation exists for the eventual key-sharing flow;
  non-extractable CryptoKeys do not remove that earlier copy from JS memory.
- Each record has a fresh random 128-bit ID, an HKDF-SHA-256-derived AES-256 key,
  and a fresh random 96-bit GCM nonce with a 128-bit authentication tag.
- The fixed-order authenticated header is
  `[format, version, fileId, documentId, epoch, purpose, recordId]`.
  The same header is HKDF info. A protocol-specific constant is the HKDF salt.
  File/document/epoch/purpose expectations come from the caller's established
  context, not from untrusted ciphertext. The serialized envelope deliberately
  does not supply a replacement file ID.
- Snapshot, update and presence records have different purposes and bounded
  plaintext sizes (5,000,000 / 65,536 / 4,096 bytes respectively). Strict,
  canonical base64url decoding and envelope validation bound allocations and
  reject unknown formats. Decryption authenticates before returning bytes.

This primitive deliberately does not implement networking, persistent key
storage, password derivation, replay prevention, rollback detection or author
signatures. All holders of a shared symmetric key can manufacture valid
ciphertext; successful decryption is not proof of a specific author's identity.
Reader/writer enforcement still belongs to the authenticated relay. Protection
against malicious relay attribution would need separately verified signing keys.

Tests cover random key/record generation, Unicode/binary/empty payloads,
independent Node crypto interoperability, wrong keys and contexts, tampering,
bounded parsing, and caller mutations during async operations. These are
regression tests, not an independent cryptographic review.

## Required integration before enabling E2EE

- [ ] Choose and implement key distribution, recovery, key confirmation, lock,
  document switching, cancellation and fresh-key rotation. No keys in OAuth
  state, Worker/D1 secrets, requests, query strings or ordinary localStorage.
- [ ] Define a distinct encrypted file format (for example `.fountain.enc`) and
  a separate versioned collaboration endpoint/room class. Plaintext clients must
  fail closed on encrypted documents; no fallback to plaintext initialization,
  save, or collaboration. A legacy client with Drive write access can still
  corrupt a file, so compatibility/rollback testing is required.
- [ ] Reserve/create an empty Drive file to obtain its real ID *before*
  encrypting the first snapshot; never seed a supposedly encrypted file with
  plaintext while waiting for an ID. Handle cancellation/orphan cleanup without
  deleting other user files. Copying ciphertext to a new Drive file must require
  an explicit decrypt/re-encrypt operation, since ciphertext binds to the ID.
- [ ] Encrypt/decrypt Drive snapshots and every save/checkpoint in the browser.
  Store the complete Yjs state, not just rendered text, to preserve CRDT identity
  across reconnects. Budget for base64/envelope overhead in upload limits.
- [ ] Replace server-side `Y.applyUpdate`/compaction with a bounded, durable,
  opaque encrypted log. Authorize every connection via the actual Drive file.
  Enforce writer roles, leases, message limits, rate limits and storage quotas.
- [ ] Add durable acknowledgments, stable record IDs for retries, deduplication,
  client-side replay/epoch checks, pagination, and ordered processing of async
  decryptions. Do not discard unacknowledged local edits on reconnect.
- [ ] Design atomic log/snapshot coordination: a client may checkpoint only a
  known log prefix, and later records must remain replayable. Use a serialized
  checkpoint lease/CAS scheme and test crashes at each upload/commit boundary.
  Never trim the log merely because one browser says "saved". Rollback detection
  for new devices also needs a trusted checkpoint or must be an explicit limit.
- [ ] Encrypt cursor/selection payloads before transport, decrypt before UI use,
  and keep identity labels safely text-rendered. No source snippets in status
  messages, errors, presence, logs or telemetry.
- [ ] Encrypt or disable local recovery for encrypted documents. Audit cached
  source, savedSource, undo/history, service worker caches, preview and export
  paths. Keep preview/compilation browser-local in encrypted mode; no plaintext
  server fallback. Explicit local exports should explain they are plaintext.
- [ ] Test two real browser accounts: authorized editor, reader, outsider,
  removed collaborator, wrong/lost key, link-forwarding, copied metadata,
  concurrent edits, long offline edits, reconnects, file switching, failed saves,
  rotation, malformed records, and unavailable Drive. Inspect network payloads
  and persisted room/Drive data using synthetic marker text to detect leaks.
- [ ] Review the complete protocol and client delivery dependencies, then update
  privacy/user documentation with the actual guarantees and remaining metadata.

Existing plaintext Drive revisions, local recovery data, and legacy room
snapshots are not retroactively encrypted. Offer an opt-in *new encrypted copy*,
and explain that older plaintext copies/backups may remain. No automatic
destructive migration or blanket retention/deletion promises.

## Rollout of room isolation (independent of future encryption)

Do **not** automatically deploy this draft. It changes the room namespace and
requires coordinated rollout, even though the document format stays plaintext.

1. Arrange an editing pause. Every active collaborator must save/checkpoint to
   Drive and keep a local backup of unsaved work, then close editing tabs.
2. Verify the current Drive contents before switching namespaces. Legacy room
   state may contain edits not yet checkpointed; there is no trustworthy
   historical file-to-room registry from which to migrate it automatically.
3. Deploy the Worker and frontend with this change together. No D1 schema or
   Google Console change is needed for the isolation fix. Newly initialized
   rooms seed only from the authorized file's Drive content. Old room storage is
   left intact for deliberate operator recovery, not silently copied/deleted.
4. Reopen/reload the app. New clients request `roomProtocol=2`; old clients cannot
   join the new namespace and accidentally merge two independently seeded Yjs
   documents. Updated room handlers close legacy attachments before reads/writes.
5. Run the two-account tests above before resuming normal editing. Confirm that
   edits saved during rollout were not omitted. Recover any missing work from
   the participants' backups, not a guessed metadata-to-file association.

Rolling the Worker back to metadata-only routing would reopen the access-control
gap and revive stale room state. A safe rollback disables collaboration while
preserving files and backups; it does not restore the vulnerable namespace.
Future E2EE relay deployment and retention/cleanup need a separate rollout plan.

## References

- [W3C Web Cryptography API](https://www.w3.org/TR/webcrypto/) — cryptographic
  operations, key handling and web-application security considerations; not a
  ready-made collaboration protocol.
- [Google Drive sharing and permissions](https://developers.google.com/workspace/drive/api/guides/manage-sharing)
  — roles, inheritance and capabilities.
- [Cloudflare Durable Object limits](https://developers.cloudflare.com/durable-objects/platform/limits/)
  — constraints to account for in encrypted log and checkpoint design.
