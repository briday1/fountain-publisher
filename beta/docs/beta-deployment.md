# Deployment and rollback

## Topology

- Production: `https://fountain-publisher.com`, published from `main` to the existing GitHub Pages root.
- Retired beta: `https://beta.fountain-publisher.com` forwards to production. Its forwarding files are published from `main` to `previews/beta/`.
- Application source: `beta/` in `briday1/fountain-publisher`.
- Account and collaboration adapter: `fountain-publisher-beta`, at `https://api.fountain-publisher.com/beta/api/*`.
- Shared account service: the existing `fountain-publisher` Worker via its service binding.

The Worker name and compatibility API prefix remain stable infrastructure identifiers. Production and beta use the same `LIVE_ROOMS` binding and `structured-v1:<Drive file ID>` room identities. Do not rename or delete the Worker, class or binding without migrating its durable state. The primary account Worker retains OAuth, credentials, D1 and the previous application generation’s rooms.

## Frontend releases

The production workflow tests the new app, runs its browser suite, and builds `beta/dist`. Its publishing job shares the `pages-push` lock with beta, reads the latest Pages tree, and copies the tested app to the root. Preview directories, domain files and earlier assets remain available for existing writing sessions. Pull requests run checks and retain a build artifact; they do not publish a path-scoped editor or post comments.

The production workflow also publishes `beta/public/previews/beta/` to the retired beta directory, including both service-worker URLs. The forwarding page preserves query strings and fragments, and replaces browser history. Existing beta assets and local data are retained; already-open writing sessions are not forcibly reloaded. Do not publish the old `beta/writing-first` frontend again: it would overwrite the forwarding page. The primary domain remains on GitHub Pages DNS; no new DNS record, account service or OAuth registration is needed.

## Adapter releases

The Pages workflows deploy frontend files only. A successful Pages release does not update either Cloudflare Worker. Deploy compatible API changes before publishing a frontend that needs them, in this order:

1. Apply any required `github-worker` database migrations, then deploy the shared `fountain-publisher` account Worker when that service changes. Follow the prerequisites in [Account integrations](integrations.md); the full Drive browser requires migration `0004_google_scopes.sql` and the updated shared Worker.
2. Test, build, and deploy the `fountain-publisher-beta` adapter from the same source revision that will be published:

```sh
cd beta
npm test
npm run build:beta
npx wrangler deploy --dry-run
npx wrangler deploy
```

3. Check the deployed account routes before publishing Pages:

```sh
TEST_BASE_URL=https://fountain-publisher.com npm run test:browser -- e2e/editor.spec.ts --grep 'deployed app exposes Drive browsing'
```

4. Publish the frontend through the main Pages workflow, then run the deployed browser suite.

The account smoke check requires unauthenticated `/beta/api/google/browser` requests to return `401 NOT_CONNECTED` with the correct origin header. A `404` reveals an outdated adapter even when OAuth redirects still work. This check runs only against the deployed app; local browser checks cannot establish which Worker version is live.

Wrangler uses the existing Cloudflare authentication. Automated deployment would additionally require a GitHub Actions `CLOUDFLARE_API_TOKEN` secret created with the [Edit Cloudflare Workers policy](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/) and scoped to the existing account and `fountain-publisher.com` zone. No automated Worker deployment is configured by the current Pages workflow.

The adapter's routes retain the beta custom domain, `/beta/*` API adapter and two exact existing OAuth callbacks. It accepts only the exact production and beta origins, retains CSRF checks, and directs authorization messages to the trusted origin that opened the popup. Credentials remain in the existing account service.

The beta Worker proxies static files from `https://fountain-publisher.com/previews/beta`. Do not point the primary apex at this Worker while retaining that upstream URL: it would proxy back into itself. Production static files continue to be served by Pages.

## Existing drafts and installed applications

The old main-origin local draft is imported before editor startup into the new IndexedDB workspace. Imports use stable content identities and insert-only transactions, retain a differing previous saved draft as a snapshot, and never delete the original localStorage record. Later edits from a still-open old tab become a separate recoverable import.

Beta local drafts and offline collaboration updates remain on the beta origin and are not deleted or automatically migrated by the redirect; production cannot read another origin's storage. Shared Drive rooms remain common to both origins.

`sw.js` and the legacy `service-worker.js` URL serve the same versioned offline worker. Each release caches matching HTML and assets together. Updates wait for existing controlled clients to close; they do not reload an active writing session. Existing caches and earlier static assets are retained during promotion.

## Rollback

Revert a production source commit on `main` and let its checks publish the previous app. Revert preview source on `beta/writing-first` to roll back beta independently. Keep the account adapter compatible with both app releases; `npx wrangler rollback` can restore its prior version if needed. Never delete durable rooms or account data as part of a static rollback.

Use `TEST_BASE_URL=https://fountain-publisher.com npm run test:browser` after publication. The beta URL supports the same deployed suite. These checks use isolated profiles and simulated provider sessions; authenticated account acceptance remains separate.
