# Account integrations

The production app and beta preview reuse the existing `fountain-publisher` Cloudflare Worker through a service binding. It does not require new Google/GitHub OAuth apps, copy stored credentials, or read existing secrets. Browser requests use `https://api.fountain-publisher.com/beta/api` with the existing API host's HttpOnly session cookies.

The `fountain-publisher-beta` Worker adapts repository, branch, content, folder, sharing and version APIs. Google access tokens used for file operations stay inside this Worker. The native Google Picker receives the short-lived scoped access token through an origin-checked, uncached endpoint; the browser keeps it only in memory and does not log it. GitHub writes use the opened content SHA. Drive reads verify the version both before and after downloading; writes use Drive v2 ETags and conditional media uploads. A missing version or concurrent update stops the write, preserving the local draft.

Google authorization retains the existing `drive.file` scope. The quick list contains files and folders already authorized for this app. Browse Google Drive opens Google's native picker for folder navigation, search, shared drives, and choosing files to authorize. Choose destination folder uses the same picker when saving a copy. Files selected previously through the original app's Google picker remain accessible. Shared files are subject to the same provider permissions. Sharing grants access without sending a notification email.

Both app origins use the registered OAuth callback URLs. The adapter records the exact trusted origin that started the login and returns the popup message to that origin. Legacy callbacks without a return marker still pass through. Session cookies and OAuth state remain owned by the original account service.

Disconnecting affects the shared API session, so it also disconnects that account in the main app in this browser.

## Optional independent local server

Copy `.env.example` to `.env` and configure your own development OAuth applications. For native Drive browsing, enable the Picker API, set `GOOGLE_APP_ID` to the same Cloud project number as your OAuth app, and configure `GOOGLE_API_KEY` as a browser API key from that project. The picker receives all three: OAuth token, app ID, and developer key. For the hosted app these settings belong to the shared account Worker. Restrict the key to the Google Picker API (and Drive API if needed); website restrictions must allow the application origins and `https://docs.google.com/*`, where Google renders its picker. See [Google's Picker setup guide](https://developers.google.com/workspace/drive/picker/guides/web-picker). The browser key is not an OAuth client secret. Its app-owned dialog retains a close control, Escape and backdrop dismissal independently of Google’s iframe, including error states. Never put client secrets in `VITE_` variables. Register callback URLs:

- `http://127.0.0.1:5173/api/auth/github/callback`
- `http://127.0.0.1:5173/api/auth/google/callback`

The Express server listens at port 5174 behind Vite's `/api` proxy. It persists opaque sessions and encrypted credentials under `.data/`, which is ignored by Git. `APP_ORIGIN` must match the web origin; production origins require HTTPS. A generated encryption key is private to this local installation. For a managed standalone deployment, supply `DATA_ENCRYPTION_KEY` and a persistent data directory.

The independent local Google OAuth flow uses broader Drive scope for browsing; the hosted app uses the existing narrow scope. Do not confuse a local test account with the production shared account service.

## Live collaboration

The hosted app automatically joins a shared room when opening a Google Drive Fountain file. Its sharing link is `https://fountain-publisher.com/?drive=FILE_ID`; beta links reach the same room. Each person connects their own Google account and must already have access to that file; copying the link does not change Drive permissions. The live banner lists other writers, and editor cursors show their current positions. Drive readers receive updates in a view-only editor and can save a separate copy.

The room stores structured Yjs updates for the screenplay, title page, and beat metadata. Concurrent edits merge, and local Undo affects the current writer's changes. Presence and cursor labels are transient; they are excluded from Fountain and published exports. The Cloudflare room receives document updates, so this is not end-to-end encryption. Each browser still compiles its own PDF using its own export settings.

Incremental document updates are saved in an account-specific IndexedDB cache. Disconnected writing remains on the device and is merged after the connection returns. Workspace entries are display snapshots of that shared state: two tabs using the same Drive file and Google account may refresh those snapshots without a revision conflict. Ordinary local and GitHub drafts retain their existing revision checks.

Save checkpoints the room into the original Fountain file using a conditional Drive write. If another editor has changed the Drive file outside the room, live synchronization pauses before replacing that external version. Preserve the local Fountain draft and resolve the competing version explicitly. Permission changes can also stop editing; reconnecting never grants more access than Drive allows.

Production and beta share the existing structured room namespace. The previous application generation’s source-text room remains separate. Editing through an old application tab or another editor is treated as an external file change. Local device storage remains origin-specific; beta drafts and disconnected updates stay available on beta. The independent Express development server does not provide Cloudflare's durable room service.
