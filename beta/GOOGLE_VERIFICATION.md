# Google OAuth verification

The current hosted authorization request includes a restricted Drive scope. Google controls the verification warning: a frontend release or changing the app's publishing status does not remove it. This document prepares the existing Cloud project for review; it does not record an approval or a submitted application. [Google's app-state explanation](https://developers.google.com/identity/protocols/oauth2/production-readiness/overview)

## Current implementation

The hosted account service requests these exact scope strings in `github-worker/src/index.mjs`:

| Scope                                   | Purpose                                                                                                                           |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `openid`                                | Identify the Google account used for Drive access and collaboration.                                                              |
| `email`                                 | Show account identity and identify collaborators.                                                                                 |
| `profile`                               | Show the account name and profile image.                                                                                          |
| `https://www.googleapis.com/auth/drive` | Browse existing folders and screenplays, open files, save changes, inspect revisions, and manage sharing at the user's direction. |

The optional local server requests the Drive scope in `beta/server/app.ts`; its credentials are separate. Existing hosted sessions retain their previously granted access until the user reconnects. Scope requests, granted scopes, and the Cloud console declaration must agree; do not infer a full grant from a successful sign-in alone.

The app-owned browser navigates My Drive, Shared with me, shared drives, recent and starred files, and searches. It opens existing screenplay files beyond those originally created by the app. `drive.file` would limit access to individually authorized or app-created files, requiring a different file-authorization flow. `drive.metadata.readonly` is also restricted and would not authorize screenplay content changes. Keep the current full-browser behavior in the review demonstration and explain why that interaction needs the broader scope. Google decides whether the justification is sufficient. [Drive scope guidance](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)

## Public pages and branding

Publish these pages before submitting:

- App homepage: <https://fountain-publisher.com/about.html>
- Privacy: <https://fountain-publisher.com/privacy.html>
- Terms: <https://fountain-publisher.com/terms.html>
- Editor: <https://fountain-publisher.com/>
- Existing support/developer contact: `brian.day1@gmail.com`

The pages are maintained in `beta/public/` and included in the normal build. Confirm they load without sign-in and that the deployed privacy description matches the reviewed version.

Using an owner/editor account for the existing OAuth project, verify `fountain-publisher.com` ownership in [Search Console](https://search.google.com/search-console). In [Google Auth Platform — Branding](https://console.cloud.google.com/auth/branding), select that project, set the public links and contact details, and include the domain used by the homepage and existing API callback. Retain the registered callback `https://api.fountain-publisher.com/auth/google/callback`. Verify and publish the branding, resolving any reported issues. [Google's branding requirements](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification)

## Data access review

Declare the requested scopes in [Data Access](https://console.cloud.google.com/auth/scopes). Use the existing project's [Verification Center](https://console.cloud.google.com/auth/verification) for the scope submission after branding is published.

Prepare an English demonstration video showing the consent flow, app name, client ID in the address bar, and each requested capability. Use dedicated sample screenplays and accounts. Demonstrate folder navigation/search, opening an existing file, saving, sharing, revisions, and two authorized collaborators editing. Show the public privacy page and explain the Google → Cloudflare → browser data flow. Provide the video and scope justification through the review form. Do not expose tokens, client secrets, or unrelated personal files.

The account service stores encrypted OAuth tokens in D1. Drive operations pass through Cloudflare; durable rooms retain screenplay synchronization data. This server processing matters: Google's restricted-scope rules require a security assessment unless an applicable exemption is confirmed. Follow the assessment instructions and any evidence requests from Google's review team; do not claim certification, an exemption, or a completion date that has not been granted. [Restricted-scope review and assessment requirements](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification)

Record the submission date, project, client IDs, review status, and evidence links after submission. After approval, verify a new account can complete authorization without the unverified-app warning and exercise actual Drive browsing, saving, and collaboration. Automated tests with simulated Google responses do not establish Google's approval or real-account acceptance.
