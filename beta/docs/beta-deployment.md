# Deployment and rollback

## Topology

- Production: `https://fountain-publisher.com`, published from `main` to the existing GitHub Pages root.
- Retired beta: `https://beta.fountain-publisher.com` forwards to production. Its forwarding files are published from `main` to `previews/beta/`.
- Retired pull-request previews: existing `previews/pr-N/` entrypoints forward to production, preserving document links.
- Application source: `beta/` in `briday1/fountain-publisher`. Local development, the local production server, and Pages use this same application.
- Account and collaboration adapter: `fountain-publisher-beta`, at `https://api.fountain-publisher.com/beta/api/*`.
- Shared account service: the existing `fountain-publisher` Worker via its service binding.

The Worker name and compatibility API prefix remain stable infrastructure identifiers. Existing production and beta sessions use the same `LIVE_ROOMS` binding and `structured-v1:<Drive file ID>` room identities. Do not rename or delete the Worker, class or binding without migrating its durable state. The primary account Worker retains OAuth, credentials, D1 and the previous application generation’s rooms.

## Frontend releases

The production workflow tests the application, runs its browser suite, builds `beta/dist`, and validates both Cloudflare Worker bundles without deploying them. Account Worker tests are a required publishing dependency. The built artifact is checked with the publication script, including mandatory `licenses.html` and `THIRD_PARTY_NOTICES.txt`, before it is retained or deployed. No Python or Pyodide compiler is built or tested, and no Cloudflare deployment secret is required. Pull requests retain a tested build artifact; they do not publish another editor.

The publishing job holds the `pages-push` lock while reading the latest Pages tree, preparing it, and deploying it. The [publication script](../../.github/scripts/prepare-pages.mjs) copies the tested app to the root and removes the retired Python editor, Screenplain wheels, Pyodide runtime, and their supporting files. Both root service-worker URLs remain available. Current-app hashed assets and root offline shells from prior releases remain available for already-open writing sessions.

The same release replaces beta and existing `previews/pr-N/` entrypoints and both service-worker URLs with forwarding files. Retired preview offline HTML and Python runtime assets are removed. The forwarding page preserves query strings and fragments and replaces browser history. It does not clear browser storage or forcibly reload open tabs. The primary domain remains on GitHub Pages DNS; no new DNS record, account service or OAuth registration is needed.

After the tested cleanup release reaches `main`, fast-forward the historical `beta/writing-first` branch to that same commit. Its existing head is an ancestor of the cleanup release, so this preserves its history without a force push or branch deletion. Removing the obsolete workflow from both branches prevents an ordinary future beta-branch push from publishing another editor:

```sh
git fetch origin main beta/writing-first
git merge-base --is-ancestor origin/beta/writing-first origin/main
git push origin origin/main:refs/heads/beta/writing-first
```

Proceed with the push only if the ancestry check succeeds and `origin/main` is the tested release. Check for queued or running historical beta deployments and cancel them before completing retirement. There is no separate beta publishing workflow after this change. Repository owners may additionally disable the historical **Writing-first beta** workflow (`gh workflow disable beta.yml`) and restrict Pages deployment environments to `main`; these are optional administrative protections. Do not rerun historical publishing jobs or restore their workflow files from an old feature branch.

## Adapter releases

The Pages workflow deploys frontend files only. A successful Pages release does not update either Cloudflare Worker. Deploy compatible API changes before publishing a frontend that needs them, in this order:

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

Wrangler uses the existing Cloudflare authentication. Automated Worker deployment is not configured; it would require separately provisioning an appropriate Cloudflare API token. The current CI checks and Pages release need no new secrets.

The adapter's routes retain the beta custom domain, `/beta/*` API adapter and two exact existing OAuth callbacks. It accepts only the exact production and beta origins, retains CSRF checks, and directs authorization messages to the trusted origin that opened the popup. Credentials remain in the existing account service.

The beta Worker proxies static files from `https://fountain-publisher.com/previews/beta`. Do not point the primary apex at this Worker while retaining that upstream URL: it would proxy back into itself. Production static files continue to be served by Pages.

## Existing drafts and installed applications

The old main-origin local draft is imported before editor startup into the new IndexedDB workspace. Imports use stable content identities and insert-only transactions, retain a differing previous saved draft as a snapshot, and never delete the original localStorage record. Later edits from a still-open old tab become a separate recoverable import.

Beta local drafts and offline collaboration updates remain on the beta origin and are not deleted or automatically migrated by the redirect; production cannot read another origin's storage. Export any beta-only drafts from an already-open beta writing session before closing it. Retaining browser storage does not make those drafts visible in the production workspace. Shared Drive rooms remain common to both origins.

`sw.js` and the legacy `service-worker.js` URL serve the same versioned production offline worker. Each release caches matching HTML and assets together. Updates wait for existing controlled clients to close; they do not reload an active writing session. Legacy browser caches are not cleared by the retirement release, and current-app static assets remain available during promotion.

The retired Python runtime is removed immediately from the published tree. A still-open legacy editor may therefore be unable to fetch an uncached compiler or generate another PDF. Preserve its work as Fountain or in its local draft, then reopen the production app. This cleanup does not erase device-local drafts, account credentials, or durable room data.

## Rollback

Revert a current application source commit on `main` and let the checks publish the previous version of the same app. Keep the retirement workflow changes and forwarding pages in place; do not restore the Python editor or publish from `beta/writing-first`. Keep the account adapter compatible with both app releases; `npx wrangler rollback` can restore its prior version if needed. Never delete durable rooms or account data as part of a static rollback.

Use `TEST_BASE_URL=https://fountain-publisher.com npm run test:browser` after publication. The beta URL should redirect to that same app with its query string and fragment intact. These checks use isolated profiles and simulated provider sessions; authenticated account acceptance remains separate.
