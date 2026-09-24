# WriteShape Google Drive integration

This module is independent of Fountain Publisher's existing Google endpoints, credentials, workers, cookies, and provider state. It has no dependency on `cloudflare/beta.ts` or the shared Fountain API. It preserves the existing Drive v2 strong ETag approach while using v3 for browsing and metadata.

## Integration and configuration

Apply `drive.sql` after `accounts.sql`; it is additive and leaves existing files, accounts, sharing, and history unchanged. Dispatch `driveRoutes(request, env, account)` after the existing account resolution and before the API not-found response. An authenticated WriteShape account is required on **every** route, including callback/status. Keep Cloudflare Access owner-only. Do not create a callback bypass: this flow uses the same signed-in private browser. No public sign-in or launch capability is added.

Required dedicated WriteShape settings:

- `APP_ORIGIN=https://writeshape.com`.
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` from the isolated WriteShape OAuth web client, never the existing Fountain client. Enable the Google Drive API in that isolated Google project.
- Add exactly `https://writeshape.com/api/drive/callback` to that client's authorized redirect URIs, retaining its separate existing sign-in callback if configured.
- `DRIVE_TOKEN_KEY`: a separately generated cryptographically random **32-byte base64** Worker secret. Provision through the platform's secret workflow; never use a Vite/public variable or committed file. This key is separate from the Google client secret. Changing or losing it makes existing encrypted connections unreadable; users must reconnect unless a deliberate re-encryption migration is performed.

None of these provider settings, secrets, or credentials were created or changed by this implementation. Missing/invalid configuration yields `{configured:false,connected:false,canWrite:false,reason:...}`. Tests use only synthetic credentials and injected provider fixtures; connected Google OAuth/Drive testing remains unperformed until configuration exists.

The explicit Connect action asks for `openid email https://www.googleapis.com/auth/drive`, offline access, and consent/account selection. Existing identity-only login scopes are unchanged. Full Drive access is required here for browsing and opening the user's existing folder tree; the narrower `drive.file` scope would not provide this same browser. Google classifies full Drive access as restricted; review its verification requirements before any future public launch. Do not reuse or modify Fountain's consent setup.

## API contract

All responses have `Cache-Control: no-store`; tokens are never returned to the browser or logged. Mutations require same origin. Connect/create/save and successful callback require Premium. Disconnect remains available after downgrade and even when configuration is missing; existing connected free accounts can browse/open/download.

- `GET /api/drive/status` → `{configured,connected,email,canWrite,reason}`. `connected` means credentials are stored, not that a live provider validation just succeeded.
- `POST /api/drive/connect` → `{url}` plus a secure, HttpOnly, SameSite=Lax state cookie. Frontend should preserve its current draft before navigating the browser to `url`.
- `GET /api/drive/callback?state=...&code=...` → validates account-bound state, cookie, PKCE and nonce/verified ID token; returns 303 to `https://writeshape.com/?driveConnected=1`. It **never** signs a user in, links/merges WriteShape identities, or changes account/session tables. A user may explicitly connect a different Google account for Drive; its verified Google subject is stored only in this account's Drive connection.
- `POST /api/drive/disconnect` → `{disconnected:true}`. Atomically removes local credentials and invalidates outstanding OAuth attempts. It does not remotely revoke the Google client's combined grants, because doing so could disrupt separate WriteShape Google sign-in. The user can separately remove the provider grant through their Google account. Already in-flight provider requests cannot be recalled.
- `GET /api/drive/browser?parent=root&search=...&pageToken=...` → `{items:[{id,name,kind:'file'|'folder',modifiedTime,bytes,canEdit,canAddChildren}],nextPageToken}`. Search applies within the selected folder. Only folders and Fountain/text files are surfaced. Capabilities report Google permission; combine them with `status.canWrite` for editing affordances.
- `GET /api/drive/open?id=...` → `{id,name,content,etag,modifiedTime,canEdit}`.
- `POST /api/drive/save` with `{id,etag,content}` → same file object. `etag` must be a strong quoted version from open/previous save. No blind overwrite path exists.
- `POST /api/drive/create` with `{name,parent?:'root',content}` → same file object, HTTP 201. Only `.fountain`/`.txt` files; parent must permit adding children. Google Drive permits duplicate names; each explicit Create is a new file, never an implicit overwrite.

Errors use `HttpError.status`; important `code` values are `DRIVE_CONFLICT` (409: stop automatic saving, preserve draft, open latest or create an explicit new copy) and `DRIVE_REOPEN_REQUIRED` (503: provider write outcome/version uncertain, stop retries and browse/reopen before another write). The worker must include `error.code` when serializing errors. A 409 connection-refresh message can be retried shortly; it has no conflict code. Input/content errors, provider permission failures, authentication failures, and unavailable configuration return actionable sanitized text without provider bodies.

## Security and synchronization

OAuth state is hashed, bound to the initiating account and a secure browser cookie, expires in ten minutes, and is consumed with a conditional delete before token exchange. The PKCE verifier is encrypted separately from tokens. Google ID tokens use the existing cryptographic `verifyGoogleToken` validator, including audience, issuer, expiry, nonce, and verified email. There is no email-based WriteShape identity lookup or merging.

Access and refresh tokens use AES-256-GCM with random 96-bit IVs and authenticated additional data containing the stable WriteShape account ID and encryption purpose. Copying ciphertext between accounts fails authentication. A database lock serializes refresh; compare-and-swap protects against disconnect/reconnect races. OAuth callback generations prevent stale consent completion from re-establishing a disconnected connection. All token and API calls use fixed Google hosts, authorization headers, redirect rejection and timeouts.

Only UTF-8 Fountain/text documents up to 2,000,000 bytes are accepted. Reads are stream-bounded. Search literals escape backslashes/quotes and file IDs are constrained before path/query construction. Provider responses never expose tokens, raw diagnostics, or account ownership from another WriteShape account.

Open brackets metadata plus content with two strong Drive v2 ETags. Save verifies current type/edit permission/version and sends `If-Match` with the upload. HTTP 412 is a conflict. The save response uses the upload's acknowledged ETag, never a later metadata version belonging to someone else's write. Create verifies destination capability and reads the new file back under the same ETag protections; ambiguous create failures require browsing before retrying to avoid duplicate documents. Autosave timers and document-switch guards are frontend responsibilities. There is no background sync, polling loop, sharing/invitation, or revision-management behavior in this backend.

## Verification

Run `node --test cloudflare/writeshape/drive.test.mjs`. Fixtures use isolated SQLite, genuine signed ID tokens with a local test JWKS, and injected HTTP responses. Coverage includes configuration/account/origin gates, PKCE/state/nonce verification and replay, encrypted account isolation, downgrade reads, serialized refresh/disconnect races, sanitized provider failures, folder/search filtering, bounded UTF-8 text, read races, stale and concurrent conditional saves, weak/missing ETags, and uncertain create handling.

No live provider calls, credentials, app permission changes, deployments, or Git actions are part of these tests. UI/browser and real Google connection testing must be reported separately.

## Official references

- [Google web-server OAuth flow](https://developers.google.com/identity/protocols/oauth2/web-server): consent, offline tokens, state, token exchange and refresh.
- [Drive OAuth scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth): full Drive scope classification and verification requirements.
- [Drive file search](https://developers.google.com/workspace/drive/api/guides/search-files): parent queries and escaping search literals.
- [Drive uploads](https://developers.google.com/workspace/drive/api/guides/manage-uploads): multipart uploads and updates.
- [Drive v2 files.update](https://developers.google.com/workspace/drive/api/reference/rest/v2/files/update): the v2 upload endpoint used for the existing strong ETag update strategy.
