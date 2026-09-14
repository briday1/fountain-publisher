# Deployment and rollback

## Topology

- Production: `https://fountain-publisher.com`, published from `main` to the existing GitHub Pages root.
- Preview: `https://beta.fountain-publisher.com`, published from `beta/writing-first` to `previews/beta/`.
- Application source: `beta/` in `briday1/fountain-publisher`.
- Account and collaboration adapter: `fountain-publisher-beta`, at `https://api.fountain-publisher.com/beta/api/*`.
- Shared account service: the existing `fountain-publisher` Worker via its service binding.

The Worker name and compatibility API prefix remain stable infrastructure identifiers. Production and beta use the same `LIVE_ROOMS` binding and `structured-v1:<Drive file ID>` room identities. Do not rename or delete the Worker, class or binding without migrating its durable state. The primary account Worker retains OAuth, credentials, D1 and the previous application generation’s rooms.

## Frontend releases

The production workflow tests the new app, runs its browser suite, and builds `beta/dist`. Its publishing job shares the `pages-push` lock with beta, reads the latest Pages tree, and copies the tested app to the root. Preview directories, domain files and earlier assets remain available for existing writing sessions. Pull requests run checks and retain a build artifact; they do not publish a path-scoped editor or post comments.

The beta workflow updates only `previews/beta/`. Both workflows keep `CNAME` and `.nojekyll`. The primary domain remains on GitHub Pages DNS; no new DNS record, account service or OAuth registration is needed.

## Adapter releases

Deploy compatible API changes before releasing a frontend that needs them:

```sh
cd beta
npm test
npm run build:beta
npx wrangler deploy --dry-run
npx wrangler deploy
```

Wrangler uses the existing Cloudflare authentication. Its routes retain the beta custom domain, `/beta/*` API adapter and two exact existing OAuth callbacks. The adapter accepts only the exact production and beta origins, retains CSRF checks, and directs authorization messages to the trusted origin that opened the popup. Credentials remain in the existing account service.

The beta Worker proxies static files from `https://fountain-publisher.com/previews/beta`. Do not point the primary apex at this Worker while retaining that upstream URL: it would proxy back into itself. Production static files continue to be served by Pages.

## Existing drafts and installed applications

The old main-origin local draft is imported before editor startup into the new IndexedDB workspace. Imports use stable content identities and insert-only transactions, retain a differing previous saved draft as a snapshot, and never delete the original localStorage record. Later edits from a still-open old tab become a separate recoverable import.

Beta local drafts and offline collaboration updates remain on the beta origin. Keep that origin available; its storage cannot be read directly by the production origin. Shared Drive rooms remain common to both origins.

`sw.js` and the legacy `service-worker.js` URL serve the same versioned offline worker. Each release caches matching HTML and assets together. Updates wait for existing controlled clients to close; they do not reload an active writing session. Existing caches and earlier static assets are retained during promotion.

## Rollback

Revert a production source commit on `main` and let its checks publish the previous app. Revert preview source on `beta/writing-first` to roll back beta independently. Keep the account adapter compatible with both app releases; `npx wrangler rollback` can restore its prior version if needed. Never delete durable rooms or account data as part of a static rollback.

Use `TEST_BASE_URL=https://fountain-publisher.com npm run test:browser` after publication. The beta URL supports the same deployed suite. These checks use isolated profiles and simulated provider sessions; authenticated account acceptance remains separate.
