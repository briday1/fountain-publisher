# Account integrations

The hosted beta reuses the existing `fountain-publisher` Cloudflare Worker through a service binding. It does not require new Google/GitHub OAuth apps, copy stored credentials, or read existing secrets. Browser requests use `https://api.fountain-publisher.com/beta/api` with the existing API host's HttpOnly session cookies.

The new `fountain-publisher-beta` Worker adapts repository, branch, content, folder, sharing and version APIs. Google access tokens obtained from the shared service stay inside this Worker. GitHub writes use the opened content SHA. Drive reads verify the version both before and after downloading; writes use Drive v2 ETags and conditional media uploads. A missing version or concurrent update stops the write, preserving the local draft.

Google authorization retains the existing `drive.file` scope. The browser lists files and folders already authorized for this app; it does not gain unrestricted access to an account's entire Drive. Files selected previously through the original app's Google picker remain accessible. Shared files are subject to the same provider permissions. Sharing grants access without sending a notification email.

Beta uses the already registered OAuth callback URLs. Only the two exact callback paths route through the beta adapter, which calls the original service. Ordinary main-app callbacks pass through unchanged. A beta-started login sets a short-lived HttpOnly return marker; its callback targets the beta popup opener. Session cookies and OAuth state still belong to the original service.

Disconnecting affects the shared API session, so it also disconnects that account in the main app in this browser.

## Optional independent local server

Copy `.env.example` to `.env` and configure your own development OAuth applications. Never put client secrets in `VITE_` variables. Register callback URLs:

- `http://127.0.0.1:5173/api/auth/github/callback`
- `http://127.0.0.1:5173/api/auth/google/callback`

The Express server listens at port 5174 behind Vite's `/api` proxy. It persists opaque sessions and encrypted credentials under `.data/`, which is ignored by Git. `APP_ORIGIN` must match the web origin; production origins require HTTPS. A generated encryption key is private to this local installation. For a managed standalone deployment, supply `DATA_ENCRYPTION_KEY` and a persistent data directory.

The independent local Google OAuth flow uses broader Drive scope for browsing; hosted beta uses the existing narrow scope. Do not confuse a local test account with the production shared account service.

## Current collaboration boundary

The beta supports opening shared Drive files, permission changes, revisions and conditional saves. Real-time multiwriter collaboration is not enabled. Editing a file from beta is an external edit from the original app's live-room perspective; do not concurrently edit that same document in a main-app collaboration room during beta acceptance. Use a copy when evaluating the new editor alongside the old one.

The new editor owns structured ProseMirror transactions. Reusing the original source-text Yjs room without a migration protocol would undermine selection and undo, so the beta does not pretend those formats are interchangeable.
